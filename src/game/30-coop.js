/* ================= CO-OP (proof of concept) =================
   Two phones on the same Wi-Fi, linked straight to each other: a WebRTC data channel, no server (no STUN either: only
   the phones' own addresses on the local network). Pairing by QR codes: the host's game shows one (a link to the game
   carrying its connection offer, `#coop=`), the other phone scans it with its camera app (which opens the game and
   joins) or with JOIN on its own co-op screen, then shows a code back for the host to scan (SCAN). The codes are the
   WebRTC descriptions, deflated and in base64url (`coopPack`). Once linked each phone sends where its soldier is
   `COOP.hz` times a second (`coopStep`) and draws the other one (`mate`, `drawMate`) where it was `COOP.lag` s ago,
   smoothly, under the darkness like the ally, with a PARTNER tag; you can't walk through each other. For now that's
   all: the two of you at the safe house. QR codes are made by qrcode-generator (MIT) and read by jsQR (Apache 2.0),
   both in src/lib. It's started from the mission PC at the safe house (its CO-OP row, `drawPc`); the co-op screen
   (`drawCoop`) pauses the game. */
const COOP = { hz: 20, lag: 0.12, lost: 6, gather: 3500, ver: 1 };
let coop = null;                                         // the link and its screen: { ui, role, pc, ch, qr, msg, hits, open, ... }
let mate = null;                                         // the other phone's soldier: { snaps, body, vis, fit, last }
const coopLinked = () => !!(coop && coop.ch && coop.ch.readyState === 'open');
const coopPaused = () => !!(coop && coop.open);
/* The codes. Mostly just the parts of a WebRTC description that differ each time (`c`: the ICE username and password,
   the certificate's fingerprint, the DTLS role, and each local address with its port and priority), from which the
   other side rebuilds the rest (`coopSdp`), so the QR code stays small enough to scan easily off a screen. Anything
   unusual falls back to the whole description, deflated where the browser can (`z`, else `p`), in base64url. */
const b64u = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
const SETUP = { actpass: 'a', active: 'c', passive: 'p' };
function coopSlim(sdp) {
  const L = sdp.split(/\r?\n/), get = k => { const l = L.find(q => q.startsWith('a=' + k + ':')); return l ? l.slice(k.length + 3).trim() : null; };
  const uf = get('ice-ufrag'), pw = get('ice-pwd'), fp = get('fingerprint'), su = get('setup');
  if (!uf || !pw || !fp || !SETUP[su] || get('mid') !== '0' || !/^sha-256 [0-9A-Fa-f:]+$/.test(fp) || /[~,]/.test(uf + pw)) return null;
  const cs = L.filter(l => l.startsWith('a=candidate:')).map(l => l.slice(12).split(' ')).filter(c => c[1] === '1' && /^udp$/i.test(c[2]) && c[7] === 'host').map(c => c[3] + ',' + c[4] + ',' + c[5]);
  if (!cs.length) return null;
  return 'c' + [uf, pw, b64u(fp.slice(8).split(':').map(h => parseInt(h, 16))), SETUP[su]].concat(cs).join('~');
}
function coopSdp(code) {
  const [uf, pw, fb, su, ...cs] = code.slice(1).split('~'), fp = Array.from(unb64u(fb), b => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
  let s = 'v=0\r\no=- ' + (1e14 + Math.floor(Math.random() * 8e14)) + ' 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\n';
  cs.forEach((c, i) => { const [pr, ad, po] = c.split(','); s += 'a=candidate:' + (i + 1) + ' 1 udp ' + pr + ' ' + ad + ' ' + po + ' typ host\r\n'; });
  return s + 'a=ice-ufrag:' + uf + '\r\na=ice-pwd:' + pw + '\r\na=ice-options:trickle\r\na=fingerprint:sha-256 ' + fp + '\r\na=setup:' + Object.keys(SETUP).find(k => SETUP[k] === su) + '\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n';
}
async function coopPack(desc) {
  const slim = coopSlim(desc.sdp); if (slim) return slim;
  const raw = new TextEncoder().encode(desc.sdp);
  if (typeof CompressionStream !== 'undefined') try { return 'z' + b64u(new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())); } catch (_) {}
  return 'p' + b64u(raw);
}
async function coopUnpack(code, type) {
  const tag = code[0];
  if (tag === 'c') return { type, sdp: coopSdp(code) };
  const bytes = unb64u(code.slice(1));
  return { type, sdp: tag === 'z' ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text() : new TextDecoder().decode(bytes) };
}
const coopGathered = pc => new Promise(res => {          // every local address found (or long enough): no trickling, the code carries them all
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, COOP.gather);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
function coopNew(role, ui, msg) {
  coopDrop(true);
  const pc = new RTCPeerConnection({ iceServers: [] });
  coop = { ui, role, pc, ch: null, qr: null, qrCv: null, msg, hits: [], open: true, err: null, sentT: 0, scan: null };
  pc.addEventListener('connectionstatechange', () => { if (coop && coop.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) coopFail(pc.connectionState === 'failed' ? 'The link failed. Are both phones on the same Wi-Fi?' : 'The link closed.'); });
  return coop;
}
function coopWire(ch) {
  const C = coop; C.ch = ch;
  ch.onopen = () => { if (coop !== C) return; C.ui = 'linked'; C.msg = ''; mate = { snaps: [], body: null, vis: 0, fit: {}, last: performance.now() / 1000 }; coopSend({ t: 'hi', v: COOP.ver, fit: fitSet('ak') }); };
  ch.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } coopGot(m); };
  ch.onclose = () => { if (coop === C && C.ui === 'linked') coopFail('Your partner left.'); };
}
async function coopHost() {
  const C = coopNew('host', 'wait', 'Making a code…');
  try {
    coopWire(C.pc.createDataChannel('cqb', { ordered: false, maxRetransmits: 0 }));   // positions: the newest is all that matters
    await C.pc.setLocalDescription(await C.pc.createOffer());
    await coopGathered(C.pc);
    if (coop !== C) return;
    coopShowQr(location.origin + location.pathname + '#coop=' + await coopPack(C.pc.localDescription));
    C.ui = 'host'; C.msg = '';
  } catch (e) { coopFail('Could not start a link here (' + e.message + ').'); }
}
async function coopJoin(code) {
  const C = coopNew('join', 'wait', 'Joining…');
  try {
    C.pc.addEventListener('datachannel', e => coopWire(e.channel));
    await C.pc.setRemoteDescription(await coopUnpack(code, 'offer'));
    await C.pc.setLocalDescription(await C.pc.createAnswer());
    await coopGathered(C.pc);
    if (coop !== C) return;
    coopShowQr('CQB-A:' + await coopPack(C.pc.localDescription));
    if (C.ui !== 'linked') { C.ui = 'answer'; C.msg = ''; }
  } catch (e) { coopFail('That code didn\'t work (' + e.message + ').'); }
}
async function coopAnswer(code) {
  const C = coop; C.ui = 'wait'; C.msg = 'Linking…';
  try { await C.pc.setRemoteDescription(await coopUnpack(code, 'answer')); }
  catch (e) { coopFail('That code didn\'t work (' + e.message + ').'); return; }
  setTimeout(() => { if (coop === C && C.ui === 'wait') coopFail('No link after 15 s. Are both phones on the same Wi-Fi?'); }, 15000);
}
function coopFail(msg) {                                 // shown at once at the safe house; on a mission it waits for the PC (no pausing mid-fight)
  if (!coop) return; coopScanStop(); coop.ui = 'error'; coop.msg = msg; coop.open = coop.open || MAP.id === 'house'; mate = null;
}
function coopDrop(quiet) {                               // end the link (and the camera)
  if (coop) { coopScanStop(); try { if (coopLinked()) coop.ch.send(JSON.stringify({ t: 'bye' })); } catch (_) {} try { coop.pc.close(); } catch (_) {} }
  mate = null; if (!quiet) coop = null;
}
function coopSend(m) { if (coopLinked()) try { coop.ch.send(JSON.stringify(m)); } catch (_) {} }
function coopGot(m) {
  if (!mate) return;
  mate.last = performance.now() / 1000;
  if (m.t === 'hi') mate.fit = m.fit || {};
  else if (m.t === 'bye') coopFail('Your partner left.');
  else if (m.t === 's') { mate.snaps.push(Object.assign({ at: mate.last }, m)); if (mate.snaps.length > 12) mate.snaps.shift(); }
}
/* A QR code, drawn once into its own canvas: dark modules on white with a quiet zone. */
function coopShowQr(text) {
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4, px = 6, cv2 = document.createElement('canvas'), g = cv2.getContext('2d');
  cv2.width = cv2.height = (n + m * 2) * px;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv2.width, cv2.height); g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + m) * px, (r + m) * px, px, px);
  coop.qr = text; coop.qrCv = cv2;
}
/* The camera, reading QR codes (jsQR) a few times a second while it's open. */
async function coopScan(kind) {
  const C = coop; C.prev = C.ui; C.ui = 'scan'; C.scanKind = kind; C.msg = 'Starting the camera…';
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
    if (coop !== C || C.ui !== 'scan') { st.getTracks().forEach(t => t.stop()); return; }
    const v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = st;
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none';
    document.body.appendChild(v); await v.play();
    C.scan = { v, st, cv: document.createElement('canvas'), t: 0 }; C.msg = '';
  } catch (e) { C.ui = C.prev; C.msg = 'No camera here (' + e.message + '). The other phone can scan instead.'; }
}
function coopScanStop() {
  const S = coop && coop.scan; if (!S) return;
  S.st.getTracks().forEach(t => t.stop()); S.v.remove(); coop.scan = null;
}
function coopScanStep() {
  const C = coop, S = C && C.scan; if (!S || S.v.readyState < 2) return;
  const now = performance.now(); if (now - S.t < 150) return; S.t = now;
  const w = 480, h = Math.round(w * S.v.videoHeight / S.v.videoWidth) || 360, g = S.cv.getContext('2d', { willReadFrequently: true });
  S.cv.width = w; S.cv.height = h; g.drawImage(S.v, 0, 0, w, h);
  const r = jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
  if (!r || !r.data) return;
  const d = r.data;
  if (C.scanKind === 'answer' && d.startsWith('CQB-A:')) { coopScanStop(); coopAnswer(d.slice(6)); }
  else if (C.scanKind === 'offer' && d.includes('#coop=')) { coopScanStop(); coopJoin(d.slice(d.indexOf('#coop=') + 6)); }
}
/* Every frame: send where you are; drop a partner gone quiet; you can't walk through each other. */
function coopStep(dt) {
  if (!coopLinked() || !mate) return;
  if ((coop.sentT -= dt) <= 0) {
    coop.sentT = 1 / COOP.hz;
    const ba = p.aim + sway * ARMS.bodyFollow;
    coopSend({ t: 's', m: MAP.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, a: +(p.aim + sway).toFixed(3), ba: +ba.toFixed(3), mv: +moveAmt.toFixed(2),
      ph: +pAnim.phase.toFixed(2), mr: +angDiff(pAnim.mvAng, ba).toFixed(2), rx: +(pAnim.rx || 0).toFixed(2), cr: +((p.cov && p.cov.duck) || 0).toFixed(2), so: p.side && p.side.out ? 1 : 0, st: state });
  }
  if (performance.now() / 1000 - mate.last > COOP.lost) { coopFail('Lost your partner.'); return; }
  const B = mateHere();
  if (B && state === 'play') bumpOut(p, B);
}
/* The partner where they were COOP.lag s ago, between the two snapshots either side (on this map, or null). */
function mateHere() {
  const M = mate; if (!M || M.snaps.length < 1) return null;
  const tt = performance.now() / 1000 - COOP.lag, S = M.snaps;
  let a = S[0], b = S[0];
  for (let i = 0; i < S.length; i++) { if (S[i].at <= tt) a = S[i]; if (S[i].at >= tt) { b = S[i]; break; } b = S[i]; }
  if (b.m !== MAP.id || MAP.id !== 'house') return null;            // (for now: only together at the safe house)
  const k = b.at > a.at ? clamp((tt - a.at) / (b.at - a.at), 0, 1) : 1, L = (u, v) => u + (v - u) * k, LA = (u, v) => u + angDiff(v, u) * k;
  const B = M.body || (M.body = Object.assign(newBot(0, 0, 7), { ally: true, look: ALLY_LOOK }));
  B.x = L(a.x, b.x); B.y = L(a.y, b.y); B.ang = LA(a.a, b.a); B.ba = LA(a.ba, b.ba); B.moveAmt = L(a.mv, b.mv); B.ph = b.ph; B.mr = b.mr; B.rx = b.rx;
  B.cov = { duck: L(a.cr, b.cr), px: 0, py: 0, lean: 0, sh: 1 }; B.side.out = !!b.so; B.down = b.st !== 'play';
  return B;
}
function drawMate(t) {
  const B = mateHere(); if (!B || B.down) return;
  const shown = Math.hypot(B.x - p.x, B.y - p.y) < viewR * 1.6 && losClear(p.x, p.y, B.x, B.y);
  mate.vis += ((shown ? 1 : 0) - mate.vis) * 0.25;
  if (mate.vis < 0.03 || !onView(B.x, B.y, 80)) return;
  ctx.globalAlpha = mate.vis;
  drawChar(B.x, B.y, B.ba, B.ang, ALLY_LOOK, charPose(B, B.ba, t, { reload: -1, phase: B.ph, walk: B.moveAmt, mvRel: B.mr, rx: B.rx, att: mate.fit, side: sidePose(B, B.ph, B.moveAmt) }));
  ctx.globalAlpha = 1;
}
function drawMateTag() {                                  // over the darkness, like the ally's
  const B = mateHere(); if (!B || B.down || !mate || mate.vis < 0.03 || !onView(B.x, B.y, 60)) return;
  ctx.globalAlpha = 0.45 + 0.5 * mate.vis;
  upright(B.x, B.y, () => { ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(120,235,150,0.95)'; ctx.fillText('PARTNER', 0, 36); });
  ctx.globalAlpha = 1;
}
/* The co-op screen, opened from the mission PC (or straight away when the game was opened from a host's QR code). */
function coopOpen() {
  if (!coop) coop = { ui: 'menu', role: null, pc: null, ch: null, qr: null, qrCv: null, msg: '', hits: [], open: true, sentT: 0, scan: null };
  coop.open = true; sticks.move.id = sticks.aim.id = null; for (const k in keys) keys[k] = false;
}
function coopClose() { if (!coop) return; coopScanStop(); if (coop.scanKind && coop.ui === 'scan') coop.ui = coop.prev; if (coopLinked() || coop.pc) coop.open = false; else coop = null; }
function coopTap(x, y) { for (const h of coop.hits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { h.fn(); return; } }
function coopFromLink() {                                // opened from the host's QR code with a phone's camera app: join straight away
  const h = location.hash; if (!h.startsWith('#coop=')) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
  coopOpen(); coopJoin(h.slice(6));
}
function drawCoop(t) {
  const C = coop; if (!C || !C.open) return;
  if (C.scan) coopScanStep();                            // (the game's paused under this screen: the camera's read from here)
  C.hits = [];
  const hit = (x, y, w, h, fn) => C.hits.push({ x, y, w, h, fn });
  const btn = (x, y, w, h, label, col, fn) => {
    ctx.fillStyle = col; rrPath(x, y, w, h, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1); hit(x, y, w, h, fn);
  };
  const wrap = (s, x, y, w, lh) => { let line = ''; for (const wd of s.split(' ')) { const tl = line ? line + ' ' + wd : wd; if (ctx.measureText(tl).width > w && line) { ctx.fillText(line, x, y); y += lh; line = wd; } else line = tl; } if (line) { ctx.fillText(line, x, y); y += lh; } return y; };
  ctx.save(); ctx.fillStyle = 'rgba(9,11,14,0.95)'; ctx.fillRect(0, 0, VW, VH);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = '700 20px ' + FONT; ctx.fillStyle = '#e6edf5'; ctx.fillText('CO-OP (TEST)', VW / 2, 30);
  ctx.strokeStyle = 'rgba(230,237,245,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(VW - 24, 24, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VW - 29, 19); ctx.lineTo(VW - 19, 29); ctx.moveTo(VW - 19, 19); ctx.lineTo(VW - 29, 29); ctx.stroke();
  hit(VW - 48, 0, 48, 48, () => coopClose());
  const qs = Math.min(VH - 80, VW * 0.42), qx = 24, qy = 52, tx = qx + qs + 28, tw = VW - tx - 24;
  ctx.textAlign = 'left'; ctx.font = '600 13px ' + FONT; ctx.fillStyle = 'rgba(205,220,236,0.92)';
  if (C.ui === 'menu') {
    ctx.textAlign = 'center';
    let y = wrap('Play with a friend on another phone. Both phones must be on the same Wi-Fi. For now you can walk round the safe house together.', VW / 2, 74, Math.min(VW - 60, 560), 18);
    const bw = 170, bh = 46, by = y + 18;
    btn(VW / 2 - bw - 10, by, bw, bh, 'HOST', 'rgba(70,140,200,0.9)', () => coopHost());
    btn(VW / 2 + 10, by, bw, bh, 'JOIN', 'rgba(70,160,110,0.9)', () => { coop.role = 'join'; coopScan('offer'); });
    ctx.font = '600 11px ' + FONT; ctx.fillStyle = 'rgba(170,190,210,0.8)'; ctx.textAlign = 'center';
    wrap('HOST shows a code. On the other phone, scan it with the camera app (or tap JOIN there and point it at the code).', VW / 2, by + bh + 26, Math.min(VW - 60, 560), 15);
  } else if (C.ui === 'host' || C.ui === 'answer') {
    if (C.qrCv) { ctx.imageSmoothingEnabled = false; ctx.drawImage(C.qrCv, qx, qy, qs, qs); ctx.imageSmoothingEnabled = true; }
    ctx.font = '700 15px ' + FONT; ctx.fillStyle = '#e6edf5';
    let y = wrap(C.ui === 'host' ? 'HOSTING' : 'ALMOST THERE', tx, qy + 12, tw, 20) + 6;
    ctx.font = '600 13px ' + FONT; ctx.fillStyle = 'rgba(205,220,236,0.92)';
    if (C.ui === 'host') {
      y = wrap('1. On the other phone, scan this code with its camera app (it opens the game and joins). Or open the game there, go to the computer, tap CO-OP, JOIN, and point it at this code.', tx, y, tw, 17) + 8;
      y = wrap('2. That phone then shows a code. Tap SCAN here and point this phone at it.', tx, y, tw, 17) + 12;
      btn(tx, y, Math.min(200, tw), 44, 'SCAN', 'rgba(70,140,200,0.9)', () => coopScan('answer'));
    } else {
      y = wrap('Show this code to the host: on their screen they tap SCAN and point their phone at it.', tx, y, tw, 17) + 8;
      ctx.fillStyle = 'rgba(170,190,210,0.8)'; wrap('Waiting for the host…', tx, y, tw, 17);
    }
  } else if (C.ui === 'scan') {
    const S = C.scan, vw = Math.min(VW - 48, (VH - 110) * 4 / 3), vh = vw * 3 / 4, vx = (VW - vw) / 2, vy = 50;
    ctx.fillStyle = '#000'; ctx.fillRect(vx, vy, vw, vh);
    if (S && S.v.readyState >= 2) { const ar = S.v.videoWidth / S.v.videoHeight, w2 = Math.min(vw, vh * ar), h2 = w2 / ar; ctx.drawImage(S.v, vx + (vw - w2) / 2, vy + (vh - h2) / 2, w2, h2); }
    ctx.strokeStyle = 'rgba(120,235,150,0.9)'; ctx.lineWidth = 3; const fs = Math.min(vw, vh) * 0.6; ctx.strokeRect(VW / 2 - fs / 2, vy + vh / 2 - fs / 2, fs, fs);
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(205,220,236,0.92)'; ctx.fillText(C.msg || (C.scanKind === 'answer' ? 'Point this phone at the code on the other phone' : 'Point this phone at the host\'s code'), VW / 2, vy + vh + 16);
    btn(VW / 2 - 70, vy + vh + 30, 140, 34, 'CANCEL', 'rgba(120,125,135,0.7)', () => { coopScanStop(); C.ui = C.prev === 'menu' || !C.prev ? 'menu' : C.prev; });
  } else if (C.ui === 'wait') {
    ctx.textAlign = 'center'; ctx.font = '700 16px ' + FONT; ctx.fillText(C.msg || 'Linking…', VW / 2, VH / 2 - 10);
    ctx.font = '600 11px ' + FONT; ctx.fillStyle = 'rgba(170,190,210,0.8)'; ctx.fillText('Keep both phones on this screen', VW / 2, VH / 2 + 14);
  } else if (C.ui === 'linked') {
    ctx.textAlign = 'center'; ctx.font = '700 26px ' + FONT; ctx.fillStyle = '#7ef09a'; ctx.fillText('CONNECTED', VW / 2, VH * 0.32);
    ctx.font = '600 13px ' + FONT; ctx.fillStyle = 'rgba(205,220,236,0.92)';
    wrap('Your partner is at the safe house with you (green PARTNER tag). Close this to play. Missions are still on your own for now.', VW / 2, VH * 0.32 + 32, Math.min(VW - 60, 520), 18);
    btn(VW / 2 - 140, VH * 0.62, 130, 40, 'DONE', 'rgba(70,160,110,0.9)', () => coopClose());
    btn(VW / 2 + 10, VH * 0.62, 130, 40, 'DISCONNECT', 'rgba(150,80,70,0.85)', () => { coopDrop(); });
  } else if (C.ui === 'error') {
    ctx.textAlign = 'center'; ctx.font = '600 14px ' + FONT; ctx.fillStyle = '#ffcf9a';
    const y = wrap(C.msg || 'Something went wrong.', VW / 2, VH * 0.36, Math.min(VW - 60, 520), 19);
    btn(VW / 2 - 70, y + 16, 140, 40, 'BACK', 'rgba(70,140,200,0.9)', () => { coopDrop(true); coop.ui = 'menu'; coop.msg = ''; coop.pc = null; coop.ch = null; });
  }
  if (C.msg && C.ui !== 'scan' && C.ui !== 'wait' && C.ui !== 'error') { ctx.textAlign = 'center'; ctx.font = '600 11px ' + FONT; ctx.fillStyle = '#ffcf9a'; ctx.fillText(C.msg, VW / 2, VH - 16); }
  ctx.restore();
}
