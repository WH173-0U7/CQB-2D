/* ================= WORKBENCH =================
   The armory workbench at the safe house (MAP.bench): walk into its ring and the bench opens (once per visit to the ring).
   Two tabs, the AKM and the Glock 17, each with a side-view drawing built from the real gun's dimensions (in mm) showing
   what's fitted, and its attachments (ATT): locked until that gun has `kills`, then bought with medals (and fitted at once),
   then fitted or taken off; one per slot. Tapping a row previews it on the drawing. While it's open, taps go to the menu
   (benchTap) and you don't move; Esc or the X closes it. */
const BENCH = { r: 26, zoom: 3.1, ax: 0.25, ay: 0.66, ease: 4, turn: 6,
  T: { fit: 1.7, supp: 2.4, off: 1.4 } };                      // how long fitting takes (the can screws on), and taking one off
let bench = null, benchIn = false, lockIn = false, benchK = 0, benchPic = null;
const benchStandY = () => benchPiece ? benchPiece.y + benchPiece.h + BODY_R + 1 : (MAP.bench.sy || MAP.bench.y) * T;   // where you stand: just clear of its front edge
const benchStand = k => k === 'pc' ? pcStand() : k === 'locker' ? { x: lockerPiece ? lockerPiece.x - BODY_R - 1 : MAP.locker.x * T, y: MAP.locker.y * T } : { x: MAP.bench.x * T, y: benchStandY() };   // the locker's doors face west
function benchStep(dt) {
  const B = MAP.bench, LK = MAP.locker, PC = pcRing();
  benchK += ((bench ? 1 : 0) - benchK) * Math.min(1, dt * BENCH.ease);   // the camera eases in on you at the bench, and back out
  if ((!B && !LK && !PC) || state !== 'play') { benchIn = lockIn = pcIn = false; if (bench) closeBench(); return; }
  const near = (k, R) => { if (!R) return false; const st = benchStand(k); return Math.hypot(p.x - R.x, p.y - R.y) < BENCH.r || (bench && bench.kind === k && Math.hypot(p.x - st.x, p.y - st.y) < BENCH.r); };
  const inB = near('bench', B && { x: B.x * T, y: B.y * T }), inL = near('locker', LK && { x: LK.x * T, y: LK.y * T }), inP = near('pc', PC);
  if (inB && !benchIn && !bench) openBench('bench');
  if (inL && !lockIn && !bench) openBench('locker');
  if (inP && !pcIn && !bench) openBench('pc');
  benchIn = inB; lockIn = inL; pcIn = inP;
  if (lockerPiece) lockerPiece.open = clamp((lockerPiece.open || 0) + dt * (bench && bench.kind === 'locker' ? 2.5 : -2.5), 0, 1);   // its doors swing open while you're at it
  if (!bench) return;
  p.aim += angDiff(bench.kind === 'locker' ? 0 : bench.kind === 'pc' ? pcFace() : -Math.PI / 2, p.aim) * Math.min(1, dt * BENCH.turn);   // face the bench, the locker or the screen (the walk up to it is in the movement)
  if (bench.kind === 'locker') { lockerStep(dt); return; }
  if (bench.kind === 'pc') return;
  const A = bench.anim;
  if (A && !(A.w === 'glock' && !p.side.out)) {                   // working on the gun (the Glock waits until it's in hand)
    const f0 = A.t / A.T; A.t += dt; const f = A.t / A.T, at = q => f0 < q && f >= q;
    if (A.off ? at(0.3) : at(0.26)) benchSnd('g_cloth', 0.35);                         // the part picked up / taken hold of
    if (A.off ? at(0.45) : at(0.6)) benchSnd(A.id === 'supp' ? 'r_rack' : 'r_in', 0.4); // clamped on (or the can seats), or comes free
    if (A.id === 'supp' && !A.off) for (const q of [0.66, 0.72, 0.78]) if (at(q)) benchSnd('g_mag', 0.2);   // turning it home
    if (A.off ? at(0.8) : false) benchSnd('magdrop', 0.25);                             // set down on the bench
    if (f >= 1) bench.anim = bench.queue.shift() || null;
  }
}
function benchPose(A, ba) {                                      // the animation for the pose, with where its part lies on the bench in the body's frame
  const sp = benchSpot(A.w, A.id), dx = sp.x - p.x, dy = sp.y - p.y, c = Math.cos(ba), s = Math.sin(ba);
  return { w: A.w, id: A.id, off: A.off, f: clamp(A.t / A.T, 0, 1), at: [(dx * c + dy * s) / CHAR_SCALE, (-dx * s + dy * c) / CHAR_SCALE] };
}
function benchSnd(key, g) { const v = sndAt(p.x, p.y, g, 300, 0.8, 0.3); if (v) sndPlay(v, key, 1, rv(0.06)); }
function openBench(kind) {
  bench = { kind: kind || 'bench', w: pWeapon(), sel: -1, msg: '', msgT: 0, hits: [], anim: null, queue: [], want0: p.side.want };
  sticks.move.id = sticks.aim.id = null;
  for (const k in keys) keys[k] = false;
}
function closeBench() { if (bench && bench.kind === 'pc') bannerT = 0;   // leaving the PC: the banner says what's next
  lockerFlush(); if (bench) p.side.want = bench.want0; if (bench && bench.la && bench.la.id !== 'nvg') bench.la = null; bench = null; }
function benchTab(w) {                                           // the tab you pick is the gun in your hands: the Glock comes out for its tab
  if (bench.anim || bench.kind !== 'bench') return;
  bench.w = w; bench.sel = -1; p.side.want = w === 'glock' ? 'pistol' : null;
}
function benchAct(w, a) {                                       // a row's button: buy (and fit), fit, or take off; each played out on the gun
  const own = prog.owned[w], fit = prog.fit[w], say = m => { bench.msg = m; bench.msgT = 2.5; };
  if (bench.anim) return;
  if (prog.kills[w] < a.kills) return say('NEEDS ' + (a.kills - prog.kills[w]) + ' MORE KILLS WITH THE ' + (w === 'ak' ? 'AK-47' : 'GLOCK'));
  const anim = (id, off) => ({ w, id, off, t: 0, T: off ? BENCH.T.off : id === 'supp' ? BENCH.T.supp : BENCH.T.fit });
  const put = () => { const old = fit[a.slot]; fit[a.slot] = a.id; saveProg(); const q = old ? [anim(old, true), anim(a.id, false)] : [anim(a.id, false)]; bench.anim = q.shift(); bench.queue = q; };
  if (!own[a.id]) {
    if (prog.medals < a.price) return say('NEEDS ' + (a.price - prog.medals) + ' MORE MEDALS: BRING CIVILIANS HOME');
    prog.medals -= a.price; own[a.id] = true; put(); return say(a.name + ' BOUGHT');
  }
  if (fit[a.slot] === a.id) { delete fit[a.slot]; saveProg(); bench.anim = anim(a.id, true); bench.queue = []; return say(a.name + ' COMING OFF'); }
  put(); say('FITTING THE ' + a.name);
}
/* What's on the gun as drawn: the saved fit, but mid-animation a part only appears once it's clamped on (and a part
   coming off stays until it's free), and one waiting its turn in the queue isn't on yet. */
function benchShown(w) {
  const A = fitSet(w);
  if (!bench) return A;
  for (const q of [bench.anim, ...bench.queue]) {
    if (!q || q.w !== w) continue;
    const f = q === bench.anim ? q.t / q.T : 0;
    if (q.off) { if (f < 0.45) A[q.id] = true; }
    else if (f < 0.6) delete A[q.id];
  }
  return A;
}
/* The gear locker's menu (bench.kind 'locker'): what's in it, what it does, buy, wear, take off, top up. Putting
   something on is played out like the workbench (bench.la): the support hand reaches into the locker, brings it out and
   mounts the night vision on the helmet's shroud or stows a grenade in its pouch. */
const LOCKER = { T: 1.5 };
const lockShown = id => {                                         // night vision on the helmet: the save, but only once the hand has mounted it (and until it's taken off)
  const on = !!prog.wear[id], A = bench && bench.la;
  if (!A || A.id !== id) return on;
  const f = A.t / A.T; return A.off ? f < 0.32 : f >= 0.72;
};
const nadeMax = id => prog.gear[id] ? GEAR.find(g => g.id === id).n : 0;
const fullNades = () => ({ m84: nadeMax('m84'), mk3: nadeMax('mk3') });
const KIT_IDS = ['helmet', 'plate', 'mag'];
function kitChange(A) {                                           // the moment a piece of kit actually goes on (or comes off) during its animation
  const pr = p.prot;
  if (A.id === 'helmet') { if (A.off) pr.helmet = 0; else { pr.helmet = HELMET_HP; pr.chipsH = []; } }
  else if (A.id === 'plate') { const F = A.side === 'front', k = F ? 'front' : 'back'; if (A.off) { pr[k] = 0; pr[F ? 'bareF' : 'bareB'] = true; } else { pr[k] = PLATE_HP; pr[F ? 'chipsF' : 'chipsB'] = []; pr[F ? 'bareF' : 'bareB'] = false; } }
  else if (A.id === 'mag') { if (A.off) { if (mags.length) mags.splice(mags.indexOf(Math.min(...mags)), 1); } else if (mags.length < MAG_VEST) mags.push(AR.mag); }
}
function lockerStep(dt) {
  const A = bench.la;
  if (!A) return;
  const f0 = A.t / A.T; A.t += dt; const f = A.t / A.T, at = q => f0 < q && f >= q, kit = KIT_IDS.includes(A.id);
  if (at(A.off ? 0.62 : 0.3)) benchSnd('g_cloth', 0.35);                                        // out of (or back into) the locker
  if (A.id === 'nvg' && at(A.off ? 0.28 : 0.72)) benchSnd('g_buckle', 0.45);                    // the mount clicks on (or off) the shroud
  if (kit) {                                                                                     // helmet: chin strap and the shell; plate: the bag's flap and the plate sliding; mag: the pouch
    const S = { helmet: ['g_buckle', 'g_helmet'], plate: ['g_velcro', 'g_cloth'], mag: ['g_velcro', 'g_mag'] }[A.id];
    if (at(A.off ? 0.12 : 0.62)) benchSnd(S[0], 0.4);
    if (at(A.off ? 0.32 : 0.72)) { benchSnd(S[1], 0.45); kitChange(A); A.done = true; }
  } else if (A.id !== 'nvg' && at(0.72)) { benchSnd('g_velcro', 0.4); p.nades[A.id] = Math.min(nadeMax(A.id), (p.nades[A.id] || 0) + 1); }   // into the pouch
  if (f >= 1) {
    bench.la = (bench.lq || []).shift() || null;
    if (!bench.la && !kit && A.id !== 'nvg' && (p.nades[A.id] || 0) < nadeMax(A.id)) bench.la = { id: A.id, off: false, t: 0, T: LOCKER.T * 0.8 };   // the next one
  }
}
function lockerFlush() {                                          // leaving mid-way: whatever was still to go on or come off does so at once
  if (!bench) return;
  for (const A of [bench.la].concat(bench.lq || [])) if (A && KIT_IDS.includes(A.id) && !A.done) kitChange(A);
  bench.lq = [];
}
function lockerAct(a) {
  const say = m => { bench.msg = m; bench.msgT = 2.5; };
  if (bench.la) return;
  if ((prog.missions || 0) < a.missions) return say('NEEDS ' + (a.missions - (prog.missions || 0)) + ' MORE MISSIONS COMPLETED');
  const go = off => { bench.la = { id: a.id, off, t: 0, T: LOCKER.T * (a.kind === 'nade' ? 0.8 : 1) }; };
  if (!prog.gear[a.id]) {
    if (prog.medals < a.price) return say('NEEDS ' + (a.price - prog.medals) + ' MORE MEDALS: BRING CIVILIANS HOME');
    prog.medals -= a.price; prog.gear[a.id] = true;
    if (a.kind === 'wear') prog.wear[a.id] = true;
    saveProg(); go(false); return say(a.name + ' BOUGHT');
  }
  if (a.kind === 'wear') { prog.wear[a.id] = !prog.wear[a.id]; saveProg(); go(!prog.wear[a.id]); return say(prog.wear[a.id] ? 'PUTTING ON THE ' + a.name : 'TAKING OFF THE ' + a.name); }
  if ((p.nades[a.id] || 0) < a.n) { go(false); return say('TOPPING UP'); }
  say('POUCH FULL');
}
/* Through the AN/PVS-14: one tube, so the night-vision picture (white phosphor: colour drained to a cool grey-white,
   fine grain that crawls) fills only its narrow field ahead of you (NVG.half either side, edges soft), at full range;
   everywhere else is what the naked eye makes out in the dark. */
let nvgNoise = null;
function drawNvgView(t, ax, ay) {
  const k = clamp(((p.nvgK || 0) - 0.6) / 0.4, 0, 1);
  if (!nvgNoise) {                                                // a tile of grain, made once
    nvgNoise = document.createElement('canvas'); nvgNoise.width = nvgNoise.height = 128;
    const g = nvgNoise.getContext('2d'), im = g.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }
  const R = Math.hypot(VW, VH), up = -Math.PI / 2;               // facing is always up the screen
  const me = 26 * S;                                                                    // you, at the tube's eyepiece, stay in view (in the same grey)
  const wedge = (h, withMe) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, up - h, up + h); ctx.closePath(); if (withMe) { ctx.moveTo(ax + me, ay); ctx.arc(ax, ay, me, 0, Math.PI * 2); } };
  for (const [h, a] of [[NVG.half, 1]]) {                                              // the white-phosphor picture in the tube's field: no colour at all
    ctx.save(); wedge(h, true); ctx.clip('nonzero');
    ctx.globalAlpha = k * a; ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, VW, VH); ctx.fillRect(0, 0, VW, VH);   // no colour (twice: fully grey)
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#d6e2f2'; ctx.fillRect(0, 0, VW, VH);                          // a cool white
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(70,80,96,0.18)'; ctx.fillRect(0, 0, VW, VH);                 // the tube's floor: blacks never quite black
    ctx.restore();
  }
  const band = (h0, h1, al) => {                                                        // the tube's edge: a dark rim fading in toward the middle and out into the naked-eye dark
    ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, up - h1, up + h1); ctx.closePath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, up + h0, up - h0, true); ctx.closePath();
    ctx.globalAlpha = k * al; ctx.fillStyle = '#000'; ctx.fill('evenodd'); ctx.restore();
  };
  band(NVG.half - NVG.soft, NVG.half - NVG.soft * 0.5, 0.3); band(NVG.half - NVG.soft * 0.5, NVG.half, 0.7);
  {                                                                                     // outside the tube: black. Your eye is behind it, so that's all there is
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, up - NVG.half, up + NVG.half); ctx.closePath(); ctx.clip('evenodd');
    ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.moveTo(ax + me, ay); ctx.arc(ax, ay, me, 0, Math.PI * 2); ctx.clip('evenodd');
    ctx.globalAlpha = k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
  ctx.save(); wedge(NVG.half); ctx.clip();                                              // grain that crawls
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = k * NVG.grain * 4;
  const pat = ctx.createPattern(nvgNoise, 'repeat'), ox = Math.random() * 128, oy = Math.random() * 128;
  ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(0, 0, VW + 128, VH + 128);
  ctx.restore();
}
/* Flipping the night vision: down on a mission (unless you flipped it up), up at home. Its look on your helmet follows. */
function nvgStep(dt) {
  const want = prog.wear.nvg && lockShown('nvg') && !p.nvgUp && !p.nvgLost && MAP.bots.length > 0 && !MAP.day && (state === 'play' || state === 'downed') ? 1 : 0, was = p.nvgK || 0;
  p.nvgK = clamp(was + Math.sign(want - was) * dt / NVG.flip, 0, 1);
  if ((was < 0.5) !== (p.nvgK < 0.5)) benchSnd('g_buckle', 0.3);                          // the mount clicks over
  PLAYER_LOOK.nods = lockShown('nvg') && !p.nvgLost ? p.nvgK : -1;
}
const nvgBtn = () => ({ x: VW - 140, y: 28, r: 15 });
const nvgBtnShown = () => prog.wear.nvg && !p.nvgLost && MAP.bots.length > 0 && !MAP.day && state === 'play' && !bench;
// The locker's items drawn in the workbench's style, side on, in mm (x along the item, y down)
const GEAR_ART = {
  nvg: { title: 'AN/PVS-14', spec: 'MONOCULAR NVG · ONE 18 MM WHITE PHOSPHOR TUBE · 40° FIELD OF VIEW · 350 G', box: [-6, -48, 132, 40],
    draw(K) {                                                     // side on, objective to the right: the tube body, focus ring, battery cap, eyecup, the arm up to the mount
      const P = attPaint(K);
      P.fill('#2c2e31', P.poly([[40, -26], [62, -26], [66, -44], [90, -44], [90, -34], [74, -24], [74, -12], [40, -12]]));   // J-arm and mount shoe
      P.fill('#3a3c40', P.rr(14, -12, 90, 34, 14));                                                                          // the tube body
      P.fill('#2a2b2f', P.rr(56, -18, 22, 8, 3));                                                                            // battery cap on top
      P.fill('#26282b', P.rr(98, -8, 24, 26, 5)); P.fill('#18191b', P.rr(118, -6, 8, 22, 3));                               // objective, its bezel
      P.fill('#1e1f22', P.rr(0, -6, 16, 22, 6)); P.fill('#121314', P.rr(-4, -4, 6, 18, 3));                                // eyepiece and eyecup
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (let x = 84; x < 98; x += 3) ctx.fillRect(x, -11, 1.5, 32);                     // focus ring knurling
      ctx.fillStyle = 'rgba(170,220,255,0.35)'; ctx.fillRect(124, -2, 1.6, 14);
      P.fill('#4a4c50', P.circ(38, 5, 5)); ctx.fillStyle = '#16171a'; ctx.fillRect(36.8, 1, 2.4, 8);                           // the power knob
    } },
  m84: { title: 'M84 STUN GRENADE', spec: '133 MM · 236 G · 1.0–2.3 S FUZE · 170–180 DB · 6–8 MILLION CANDELA', box: [-6, -38, 150, 30],
    draw(K) {                                                     // the perforated steel body, the fuze head, the spoon along the top and the pull ring
      const P = attPaint(K);
      P.fill('#4b5340', P.rr(0, -22, 104, 44, 4));
      ctx.fillStyle = '#14160f'; for (let x = 10; x < 98; x += 11) for (const y of [-14, -2, 10]) { ctx.beginPath(); ctx.arc(x + (y === -2 ? 5 : 0), y, 3.2, 0, Math.PI * 2); ctx.fill(); }   // the holes the flash and bang come out of
      ctx.fillStyle = 'rgba(232,210,100,0.85)'; ctx.font = '700 7px ' + FONT; ctx.fillText('M84', 6, 27);
      P.fill('#5a5e52', P.rr(104, -15, 16, 30, 3)); P.fill('#3e4136', P.rr(120, -11, 12, 22, 2));                             // fuze body
      P.fill('#6e7264', P.poly([[124, -14], [128, -22], [40, -27], [36, -22], [118, -16]]));                                  // the spoon, held down along the body
      ctx.strokeStyle = '#b9bcb2'; ctx.lineWidth = 2.4 / K; ctx.beginPath(); ctx.ellipse(140, -6, 9, 10, 0, 0, Math.PI * 2); ctx.stroke();   // pull ring
      ctx.lineWidth = 1.6 / K; ctx.beginPath(); ctx.moveTo(131, -4); ctx.lineTo(136, -4); ctx.stroke();
    } },
  mk3: { title: 'Mk3A2 OFFENSIVE GRENADE', spec: 'CONCUSSION · 227 G OF TNT · M206A2 FUZE 4–5 S · LETHAL WITHIN 2 M', box: [-6, -40, 152, 32],
    draw(K) {                                                     // the black fibre body with metal end caps, the fuze, spoon and ring
      const P = attPaint(K);
      P.fill('#1c1d1b', P.rr(0, -27, 104, 54, 5));
      P.fill('#55585a', P.rr(-2, -28, 8, 56, 2)); P.fill('#55585a', P.rr(98, -28, 8, 56, 2));                                 // end caps
      ctx.fillStyle = 'rgba(235,200,80,0.85)'; ctx.font = '700 8px ' + FONT; ctx.fillText('GRENADE HAND', 14, -4); ctx.fillText('OFFENSIVE MK3A2', 14, 8);
      P.fill('#5a5e52', P.rr(106, -15, 16, 30, 3)); P.fill('#3e4136', P.rr(122, -11, 12, 22, 2));
      P.fill('#6e7264', P.poly([[126, -14], [130, -22], [44, -32], [40, -27], [120, -16]]));
      ctx.strokeStyle = '#b9bcb2'; ctx.lineWidth = 2.4 / K; ctx.beginPath(); ctx.ellipse(142, -6, 9, 10, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.6 / K; ctx.beginPath(); ctx.moveTo(133, -4); ctx.lineTo(138, -4); ctx.stroke();
    } } };
function drawLocker(t) {
  const B = bench, busy = !!B.la;
  if (B.msgT > 0) B.msgT -= 1 / 60;
  B.hits = [];
  const hit = (x, y, ww, hh, fn) => B.hits.push({ x, y, w: ww, h: hh, fn });
  const pad = 10, X0 = Math.round(VW * 0.47), PW = VW - X0 - pad;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const sh = ctx.createLinearGradient(X0 - 40, 0, X0 + 10, 0); sh.addColorStop(0, 'rgba(9,11,14,0)'); sh.addColorStop(1, 'rgba(9,11,14,0.94)');
  ctx.fillStyle = sh; ctx.fillRect(X0 - 40, 0, 50, VH); ctx.fillStyle = 'rgba(9,11,14,0.94)'; ctx.fillRect(X0 + 10, 0, VW - X0, VH);
  ctx.fillStyle = '#e6edf5'; ctx.font = '700 17px ' + FONT; ctx.fillText('GEAR LOCKER', X0, pad + 12);
  ctx.textAlign = 'right'; ctx.font = '700 15px ' + FONT; ctx.fillStyle = '#f0c75a'; ctx.fillText('★ ' + prog.medals, VW - 50, pad + 12);
  ctx.strokeStyle = 'rgba(230,237,245,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(VW - 24, pad + 12, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VW - 29, pad + 7); ctx.lineTo(VW - 19, pad + 17); ctx.moveTo(VW - 19, pad + 7); ctx.lineTo(VW - 29, pad + 17); ctx.stroke();
  hit(VW - 44, 0, 44, pad + 30, () => closeBench());
  const ty = pad + 28;
  ctx.textAlign = 'left'; ctx.font = '600 11px ' + FONT; ctx.fillStyle = 'rgba(200,215,230,0.8)'; ctx.fillText('MISSIONS COMPLETED  ' + (prog.missions || 0), X0, ty + 10);
  ctx.textAlign = 'right'; ctx.fillText('CARRYING ' + loadOf(p).toFixed(1) + ' KG  ·  SPEED ' + Math.round(loadMul(p) * 100) + '%', X0 + PW, ty + 10);
  const top = ty + 22, ph = Math.round((VH - top - pad) * 0.4), bot = top + ph;
  ctx.fillStyle = '#111a23'; rrPath(X0, top, PW, ph, 6); ctx.fill();
  ctx.save(); rrPath(X0, top, PW, ph, 6); ctx.clip();
  ctx.strokeStyle = 'rgba(120,170,220,0.07)'; ctx.lineWidth = 1;
  for (let x = X0; x < X0 + PW; x += 12) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
  for (let y = top; y < bot; y += 12) { ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X0 + PW, y); ctx.stroke(); }
  const sel = GEAR[Math.max(0, B.sel)], art = GEAR_ART[sel.id];
  ctx.textAlign = 'left'; ctx.fillStyle = '#dbe8f5'; ctx.font = '700 12px ' + FONT; ctx.fillText(art.title, X0 + 8, top + 10);
  ctx.font = '600 9px ' + FONT; ctx.fillStyle = 'rgba(170,200,230,0.8)'; ctx.fillText(art.spec, X0 + 8, top + 22);
  const [bx0, by0, bx1, by1] = art.box, K = Math.min((PW - 24) / (bx1 - bx0), (ph - 44) / (by1 - by0));
  ctx.save(); ctx.translate(X0 + (PW - (bx1 - bx0) * K) / 2 - bx0 * K, top + 30 + (ph - 40 - (by1 - by0) * K) / 2 - by0 * K); ctx.scale(K, K);
  art.draw(K); ctx.restore();
  ctx.restore();
  const ly = bot + 6, lh = VH - pad - 14 - ly, rh = Math.min(50, (lh - GEAR.length * 4) / (GEAR.length + 1));
  GEAR.forEach((a, i) => {
    const y = ly + i * (rh + 4), owned = !!prog.gear[a.id], locked = (prog.missions || 0) < a.missions, afford = prog.medals >= a.price;
    const worn = a.kind === 'wear' && prog.wear[a.id], have = a.kind === 'nade' ? (p.nades[a.id] || 0) : 0, working = B.la && B.la.id === a.id;
    ctx.fillStyle = worn || (owned && a.kind === 'nade') ? 'rgba(70,150,95,0.22)' : 'rgba(255,255,255,0.05)'; rrPath(X0, y, PW, rh, 5); ctx.fill();
    if (B.sel === i) { ctx.strokeStyle = 'rgba(140,190,240,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    hit(X0, y, PW - 72, rh, () => { B.sel = i; });
    ctx.textAlign = 'left'; ctx.fillStyle = locked ? 'rgba(220,228,238,0.5)' : '#eef3f8'; ctx.font = '700 11px ' + FONT;
    ctx.fillText(a.name + (worn ? '  • WORN' : owned && a.kind === 'nade' ? '  • ' + have + ' CARRIED' : ''), X0 + 8, y + rh * 0.32);
    ctx.font = '600 9px ' + FONT; ctx.fillStyle = 'rgba(170,200,230,' + (locked ? 0.5 : 0.85) + ')'; ctx.fillText(a.real + '  ·  ' + Math.round((a.kind === 'wear' ? LOAD.nvg : LOAD[a.id] * a.n) * 1000) + ' G', X0 + 8, y + rh * 0.7);
    const bw = 64, bh = Math.min(24, rh - 12), bx = X0 + PW - bw - 6, by = y + (rh - bh) / 2;
    let label, col;
    if (working) { label = B.la.off ? 'TAKING OFF' : a.kind === 'nade' ? 'STOWING' : 'PUTTING ON'; col = 'rgba(200,160,50,' + (0.45 + 0.3 * Math.sin(t * 6)).toFixed(2) + ')'; }
    else if (locked) { label = (prog.missions || 0) + ' / ' + a.missions + ' MISSIONS'; col = 'rgba(120,125,135,0.5)'; }
    else if (!owned) { label = '★ ' + a.price + '  BUY'; col = afford ? 'rgba(200,160,50,0.85)' : 'rgba(150,110,60,0.45)'; }
    else if (a.kind === 'wear') { label = worn ? 'TAKE OFF' : 'WEAR'; col = worn ? 'rgba(150,80,70,0.7)' : 'rgba(70,140,200,0.85)'; }
    else if (have < a.n) { label = 'TOP UP'; col = 'rgba(70,140,200,0.85)'; }
    else { label = have + ' / ' + a.n; col = 'rgba(70,120,90,0.6)'; }
    if (busy && !working) ctx.globalAlpha = 0.45;
    ctx.fillStyle = col; rrPath(bx, by, bw, bh, 5); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 ' + (label.length > 10 ? 8 : 10) + 'px ' + FONT; ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
    ctx.globalAlpha = 1;
    hit(bx, by, bw, bh, () => { B.sel = i; lockerAct(a); });
  });
  {                                                              // your loadout: plates, helmet, spare mags (go light, or go without)
    const y = ly + GEAR.length * (rh + 4), L0 = lo(), bh = Math.min(22, rh - 10), by = y + (rh - bh) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; rrPath(X0, y, PW, rh, 5); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#eef3f8'; ctx.font = '700 11px ' + FONT; ctx.fillText('LOADOUT', X0 + 8, y + rh / 2);
    const btn = (x, w, label, on, fn) => {
      ctx.fillStyle = on ? 'rgba(70,140,200,0.85)' : 'rgba(120,125,135,0.55)'; rrPath(x, by, w, bh, 5); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 9px ' + FONT; ctx.fillText(label, x + w / 2, by + bh / 2 + 1);
      hit(x, by, w, bh, () => { if (!B.la && !equip) fn(); });
    };
    const x0 = X0 + 66, gw = (PW - 72) / 3 - 4;
    btn(x0, gw, 'PLATES: ' + ['NONE', 'FRONT', 'BOTH'][L0.plates], L0.plates > 0, () => setLoadout('plates', (L0.plates + 2) % 3));
    btn(x0 + gw + 4, gw, 'HELMET: ' + (L0.helmet ? 'ON' : 'OFF'), L0.helmet, () => setLoadout('helmet', !L0.helmet));
    btn(x0 + 2 * (gw + 4), gw, 'SPARE MAGS: ' + L0.mags, L0.mags > 0, () => setLoadout('mags', (L0.mags + MAG_VEST) % (MAG_VEST + 1)));
  }
  ctx.textAlign = 'center';
  if (B.msgT > 0) { ctx.globalAlpha = Math.min(1, B.msgT * 2); ctx.fillStyle = '#ffe3a0'; ctx.font = '700 11px ' + FONT; ctx.fillText(B.msg, X0 + PW / 2, VH - pad - 4); ctx.globalAlpha = 1; }
  else { ctx.fillStyle = 'rgba(215,228,240,0.9)'; ctx.font = '600 10px ' + FONT; ctx.fillText(sel.name + ': ' + sel.fx.toUpperCase(), X0 + PW / 2, VH - pad - 4); }
  ctx.restore();
}
/* The locker's doors, swung open while you're at it (drawn live over its sprite, in the scene pass). */
function drawLockerDoors() {
  const f = lockerPiece;
  if (!f || f.broken || !(f.open > 0.01)) return;
  const k = smooth01(f.open), L = f.h, D = f.w;
  ctx.save(); ctx.translate(f.x + f.w / 2, f.y + f.h / 2); ctx.rotate(f.rot || 0);
  ctx.fillStyle = '#0b0c0a'; ctx.fillRect(-L / 2 + 2, D / 2 - 3, L - 4, 3);                               // the dark inside, past the open doors
  for (const sd of [-1, 1]) {                                                                              // each leaf hinged at its outer front corner
    ctx.save(); ctx.translate(sd * (L / 2 - 0.5), D / 2 - 1); ctx.rotate(-sd * k * 1.75);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-sd * L / 2, 1, sd * L / 2, 2.4);
    ctx.fillStyle = '#41463b'; ctx.fillRect(-sd * L / 2, -0.8, sd * L / 2, 2); ctx.fillStyle = '#5c6151'; ctx.fillRect(-sd * L / 2, -0.8, sd * L / 2, 0.6);
    ctx.fillStyle = '#9a9a8a'; ctx.fillRect(-sd * (L / 2 - 2) - 0.8, 0.9, 1.6, 1.2);                   // the handle on its edge
    ctx.restore();
  }
  ctx.restore();
}
function benchTap(x, y) {
  for (const h of bench.hits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { h.fn(); return; }
}
/* The workbench drawings: the AK-47 (Type 2, milled) and the Glock 17 drawn from their real outlines, traced in mm from
   public-domain US government photos (AK-47: DoD DM-ST-89-01131; Glock 17 Gen 4: ATF), so every part sits where it
   really is: `GUN_TRACE` holds each gun's outline (with its real openings), the AK's wood and magazine, the Glock's
   slide. Drawn in the same lit, outlined style as the attachments over them (`attPaint`). Both face left, muzzle first:
   x is mm from the butt (or the slide's rear) toward the muzzle, mirrored onto the drawing. */
const GUN_TRACE = {"ak":{"body":[[[880.0,1.6],[878.4,11.3],[876.8,13.7],[866.3,13.7],[862.3,20.1],[855.9,22.5],[849.4,20.9],[752.8,22.5],[750.4,25.0],[745.6,25.0],[742.4,22.5],[670.7,24.2],[665.1,28.2],[657.0,27.4],[618.4,33.0],[555.6,35.4],[522.5,43.5],[516.9,42.7],[512.1,38.6],[507.2,37.0],[461.4,40.3],[458.1,43.5],[458.1,45.9],[464.6,69.2],[475.8,93.4],[483.9,107.1],[495.2,122.4],[512.9,140.9],[541.9,162.6],[535.4,172.3],[533.8,177.9],[530.6,180.4],[515.3,206.9],[511.3,211.8],[508.9,212.6],[491.1,201.3],[471.8,184.4],[454.9,167.5],[438.0,146.5],[427.5,130.4],[416.3,109.5],[408.2,90.2],[398.6,58.0],[394.5,55.6],[391.3,57.2],[389.7,69.2],[385.7,72.5],[384.9,78.9],[382.4,83.7],[382.4,74.1],[380.0,70.9],[374.4,72.5],[369.6,77.3],[365.5,78.9],[341.4,81.3],[326.1,81.3],[322.9,79.7],[316.4,72.5],[308.4,81.3],[287.4,133.7],[285.0,150.6],[282.6,153.0],[277.0,154.6],[264.9,154.6],[256.8,152.2],[251.2,149.0],[244.0,141.7],[239.9,134.5],[240.7,128.8],[248.0,113.5],[260.9,79.7],[261.7,71.7],[256.8,61.2],[256.8,53.1],[255.2,51.5],[244.8,50.7],[233.5,53.1],[219.8,60.4],[170.7,79.7],[122.4,103.9],[95.8,114.3],[92.6,114.3],[87.0,119.2],[74.1,126.4],[42.7,140.9],[30.6,148.1],[20.9,148.1],[18.5,145.7],[12.1,101.4],[8.9,90.2],[5.6,70.9],[0.0,50.7],[0.0,43.5],[3.2,40.3],[20.9,36.2],[29.8,36.2],[110.3,20.1],[145.7,15.3],[158.6,20.9],[172.3,21.7],[185.2,18.5],[187.6,19.3],[193.2,15.3],[202.9,16.1],[218.2,12.1],[223.8,12.1],[227.1,10.5],[243.2,8.1],[247.2,5.6],[250.4,0.0],[248.0,-3.2],[252.8,-7.2],[258.5,-8.9],[264.9,-16.9],[273.8,-24.2],[371.2,-26.6],[471.8,-26.6],[481.5,-27.4],[484.7,-30.6],[489.5,-30.6],[491.1,-32.2],[489.5,-33.8],[483.1,-33.0],[480.7,-37.0],[482.3,-40.3],[487.1,-36.2],[496.8,-39.5],[501.6,-37.0],[523.3,-38.6],[526.6,-37.8],[529.8,-40.3],[534.6,-38.6],[545.1,-38.6],[548.3,-37.8],[550.7,-35.4],[550.7,-31.4],[552.3,-29.8],[555.6,-33.8],[572.5,-34.6],[662.6,-32.2],[668.3,-27.4],[679.5,-28.2],[681.2,-26.6],[747.2,-27.4],[749.6,-25.8],[758.5,-12.1],[763.3,-7.2],[776.2,-0.8],[832.5,-0.8],[847.0,-31.4],[847.0,-41.9],[851.9,-45.1],[862.3,-45.1],[865.5,-41.9],[865.5,-36.2],[863.9,-33.8],[864.7,-14.5],[868.0,-12.1],[867.1,-7.2],[871.2,-1.6],[876.0,-3.2]],[[371.2,49.1],[368.0,45.9],[340.6,46.7],[334.9,53.1],[334.1,60.4],[334.9,63.6],[343.8,70.0],[342.2,70.9],[336.6,68.4],[333.3,65.2],[329.3,53.9],[319.6,48.3],[318.0,49.9],[319.6,63.6],[318.8,71.7],[326.1,78.1],[330.9,78.9],[354.3,77.3],[355.1,78.1],[365.5,76.5],[371.2,71.7]],[[738.3,16.1],[736.7,14.5],[683.6,15.3],[681.2,17.7],[682.8,19.3],[736.7,18.5]],[[834.9,15.3],[833.3,13.7],[777.0,13.7],[775.4,16.1],[777.0,17.7],[833.3,16.9]],[[737.5,-2.4],[737.5,-7.2],[735.9,-8.9],[682.0,-8.1],[680.4,-6.4],[685.2,0.0],[735.9,-0.8]],[[860.7,-13.7],[857.5,-17.7],[847.0,-17.7],[843.8,-14.5],[843.0,-9.7],[845.4,-7.2],[858.3,-8.1],[860.7,-10.5]]],"wood":[[[523.3,153.8],[525.8,154.6],[525.8,157.8],[523.3,161.0],[523.3,164.3],[525.8,167.5],[529.0,168.3],[534.6,163.4],[538.6,164.3],[536.2,170.7],[528.2,179.5],[516.1,169.9],[514.5,161.8],[516.1,158.6]],[[267.3,51.5],[272.9,53.1],[283.4,62.0],[311.6,57.2],[318.0,63.6],[318.0,66.8],[310.0,71.7],[304.3,78.9],[303.5,91.8],[289.9,124.8],[284.2,149.0],[277.8,153.8],[264.1,153.8],[253.6,149.8],[246.4,144.1],[240.7,134.5],[241.5,128.0],[254.4,99.0],[264.9,70.0],[264.9,66.8],[260.9,62.0],[260.1,58.0]],[[223.8,15.3],[230.3,51.5],[223.0,57.2],[213.4,61.2],[206.1,62.0],[193.2,69.2],[168.3,78.9],[162.6,82.9],[137.7,91.0],[123.2,102.3],[103.1,110.3],[95.8,111.1],[87.0,118.4],[71.7,122.4],[58.0,131.2],[49.9,131.2],[43.5,136.1],[35.4,136.9],[29.0,141.7],[23.3,140.1],[18.5,136.1],[8.1,80.5],[8.1,71.7],[5.6,66.0],[7.2,57.2],[5.6,43.5],[8.9,40.3],[75.7,26.6],[137.7,16.1],[149.0,16.9],[159.4,21.7],[172.3,22.5],[186.0,19.3],[193.2,19.3],[216.6,12.9],[220.6,12.9]],[[665.1,-26.6],[664.3,-19.3],[666.7,-15.3],[666.7,-5.6],[664.3,-0.8],[665.1,11.3],[660.2,19.3],[651.4,26.6],[623.2,31.4],[601.4,32.2],[595.8,33.8],[574.9,31.4],[566.0,33.8],[556.4,33.8],[528.2,41.1],[520.9,40.3],[515.3,33.8],[515.3,29.0],[512.1,24.2],[514.5,17.7],[511.3,9.7],[512.1,7.2],[515.3,4.8],[527.4,7.2],[538.6,-2.4],[545.9,-0.8],[549.9,-1.6],[552.3,-4.8],[551.5,-12.1],[554.8,-18.5],[553.1,-26.6],[554.8,-29.8],[559.6,-33.0],[653.0,-32.2],[661.0,-30.6]]],"mag":[[[369.6,40.3],[458.1,40.3],[459.7,41.9],[458.1,43.5],[458.1,45.9],[464.6,69.2],[475.8,93.4],[487.1,111.9],[495.2,122.4],[512.9,140.9],[541.9,162.6],[515.3,206.9],[511.3,211.8],[508.9,212.6],[482.3,194.0],[454.9,167.5],[438.0,146.5],[427.5,130.4],[416.3,109.5],[408.2,90.2],[401.0,65.2],[396.9,56.4],[392.9,55.6],[391.3,57.2],[389.7,69.2],[385.7,72.5],[384.9,78.9],[383.3,80.5],[381.6,78.9],[382.4,74.1],[380.0,70.9],[374.4,72.5],[369.6,77.3],[368.0,75.7],[371.2,71.7],[371.2,49.1],[368.0,45.9],[368.0,41.9]]]},"glock":{"body":[[[-14.0,119.8],[-14.0,116.3],[-12.8,109.0],[-12.0,107.9],[-12.0,106.4],[-11.4,105.8],[-11.4,104.4],[-10.8,103.8],[-9.9,100.3],[-8.5,98.0],[-8.5,97.1],[-7.3,94.8],[-6.4,93.9],[-6.4,93.0],[-4.4,90.1],[-4.4,89.2],[2.9,77.6],[3.2,76.1],[5.2,73.2],[5.2,72.0],[7.0,69.4],[7.0,68.2],[7.9,67.3],[7.9,66.2],[8.7,65.3],[9.3,62.4],[10.2,61.5],[10.2,60.3],[11.1,59.5],[11.1,58.3],[11.7,57.7],[11.7,56.3],[12.2,55.7],[12.2,54.2],[13.1,52.8],[15.5,43.1],[15.2,39.7],[14.3,36.7],[12.2,33.5],[10.5,31.8],[6.4,29.7],[0.0,28.9],[-1.2,27.7],[-1.7,26.2],[-1.5,22.7],[-0.3,21.0],[-0.3,3.2],[0.0,1.7],[1.5,-0.3],[2.6,-0.9],[8.2,-0.9],[10.5,-4.4],[11.4,-5.0],[14.3,-4.7],[19.0,-0.9],[174.9,-0.3],[176.4,-2.6],[179.3,-2.6],[181.6,0.0],[185.4,0.3],[187.5,2.6],[188.0,5.2],[188.0,17.2],[187.2,18.4],[186.9,21.6],[187.5,23.3],[187.5,29.4],[186.6,32.1],[182.8,36.2],[181.6,36.7],[162.4,37.6],[161.5,36.7],[160.6,37.6],[160.1,37.3],[149.9,37.9],[132.7,37.9],[126.5,38.5],[125.1,38.2],[121.6,38.8],[118.7,40.2],[117.2,41.7],[115.5,45.5],[115.2,57.4],[116.0,62.1],[117.2,64.7],[117.2,66.2],[116.0,66.8],[77.6,67.6],[73.8,67.1],[68.5,64.4],[65.0,64.4],[63.6,65.0],[61.2,67.3],[58.9,71.7],[57.4,76.7],[57.4,83.4],[54.8,84.8],[53.1,86.6],[50.7,90.7],[50.7,100.0],[48.4,101.5],[46.6,103.2],[43.1,110.8],[42.6,113.1],[43.1,119.8],[40.2,123.0],[36.7,125.9],[36.7,130.0],[32.7,134.4],[29.7,134.4],[28.6,135.0],[-5.5,134.4],[-6.1,133.8],[-5.8,129.7],[-3.2,127.1],[-3.8,126.5],[-6.1,126.5],[-8.7,125.7],[-12.8,121.9]],[[109.6,44.9],[107.3,41.4],[105.5,39.9],[102.6,38.5],[99.4,38.5],[97.7,39.1],[84.5,40.8],[83.1,41.4],[80.8,43.7],[78.7,49.0],[78.7,52.2],[80.8,58.6],[80.8,60.3],[80.2,60.9],[78.4,61.2],[76.4,60.1],[73.5,56.9],[71.1,51.9],[70.3,51.0],[69.1,51.6],[69.4,55.1],[70.3,57.1],[72.9,59.8],[75.8,61.5],[78.7,62.4],[95.3,62.7],[103.5,62.1],[105.8,60.9],[108.5,58.3],[109.6,56.3]]],"slide":[[[-0.3,3.2],[0.0,1.7],[1.5,-0.3],[2.6,-0.9],[8.2,-0.9],[10.5,-4.4],[11.4,-5.0],[14.3,-4.7],[19.0,-0.9],[174.9,-0.3],[176.4,-2.6],[179.3,-2.6],[181.6,0.0],[185.4,0.3],[187.8,3.2],[188.0,17.2],[187.2,18.4],[187.2,21.0],[-0.3,21.0]]]}};
function traceFill(polys, c0, c1, c2, y0, y1, K, rule) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(0.45, c1); g.addColorStop(1, c2);
  ctx.beginPath(); for (const pl of polys) { pl.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
  ctx.fillStyle = g; ctx.fill(rule || 'nonzero');
  ctx.strokeStyle = 'rgba(150,200,240,0.65)'; ctx.lineWidth = 1.2 / K; ctx.stroke();
}
const traceBox = pl => { let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const [x, y] of pl) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); } return { x0, x1, y0, y1 }; };
function drawAKTraced(K) {
  const Tr = GUN_TRACE.ak, ln = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  traceFill(Tr.body, '#8a8e96', '#43464c', '#1c1e22', -50, 60, K, 'evenodd');                 // blued steel
  ctx.save(); ctx.beginPath(); for (const pl of Tr.body) { pl.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); } ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4 / K;
  ln(262, -8, 492, -8);                                                                       // dust cover over the receiver
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrPath(428, 20, 76, 12, 3); ctx.fill();                // the milled lightening cut over the magazine well
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ln(430, 21, 502, 21);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (const x of [690, 702, 714, 726]) { rrPath(x, -24, 7, 4, 1.5); ctx.fill(); }   // gas tube vents
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ln(600, 14, 828, 14);                                // cleaning rod under the barrel
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(262, -26, 230, 3); ctx.fillRect(668, -24, 160, 2);   // light along the top
  ctx.restore();
  for (const [x, y] of [[389, 35], [373, 35], [332, 41], [308, 21]]) {                       // pins and rivets
    ctx.fillStyle = '#9a9ea6'; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1 / K; ctx.stroke();
  }
  for (const pl of Tr.mag) {                                                                   // steel magazine with its pressed ribs
    const b = traceBox(pl); traceFill([pl], '#55585e', '#2c2e32', '#141517', b.y0, b.y1, K);
    ctx.save(); ctx.beginPath(); pl.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2.2 / K;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(392 + i * 16, 46); ctx.quadraticCurveTo(410 + i * 16, 140, 470 + i * 14, 200); ctx.stroke(); }
    ctx.restore();
  }
  for (const pl of Tr.wood) {                                                                  // the wood: stock, pistol grip, handguards, with grain
    const b = traceBox(pl); traceFill([pl], '#a0663c', '#6e4026', '#3a2010', b.y0, b.y1, K);
    ctx.save(); ctx.beginPath(); pl.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = 'rgba(30,12,4,0.22)'; ctx.lineWidth = 1.1 / K;
    const slope = b.x1 < 260 ? (130 - 25) / 250 * 0.5 : 0;                                     // the stock's grain runs down its slope
    for (let y = b.y0 - 60; y < b.y1 + 60; y += 6.5) { ctx.beginPath(); ctx.moveTo(b.x0, y); for (let x = b.x0; x <= b.x1; x += 20) ctx.lineTo(x, y + (x - b.x0) * slope + Math.sin(x * 0.05 + y) * 1.4); ctx.stroke(); }
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(160,166,176,0.75)'; ctx.lineWidth = 1.6 / K; ctx.beginPath(); ctx.ellipse(196, 46, 5, 7, 0.3, 0, Math.PI * 2); ctx.stroke();   // sling swivel on the stock
}
function drawGlockTraced(K) {
  const Tr = GUN_TRACE.glock;
  traceFill(Tr.body, '#4a4c52', '#26272a', '#121314', 0, 140, K, 'evenodd');                 // polymer frame
  ctx.save(); ctx.beginPath(); for (const pl of Tr.body) { pl.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); } ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let x = 4; x < 60; x += 2.6) for (let y = 40; y < 128; y += 2.6) ctx.fillRect(x + (y % 5.2 ? 1.3 : 0) - (y - 40) * 0.38, y, 0.9, 0.9);   // grip texture
  ctx.restore();
  for (const pl of Tr.slide) {                                                                 // the slide: blackened steel, rear serrations
    const b = traceBox(pl); traceFill([pl], '#6a6d74', '#33353a', '#18191c', b.y0, b.y1, K);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.2 / K; for (let x = 4; x < 40; x += 3.6) { ctx.beginPath(); ctx.moveTo(x, b.y0 + 2); ctx.lineTo(x, b.y1 - 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(b.x0 + 4, b.y0 + 1, b.x1 - b.x0 - 8, 1.6);
  }
  ctx.fillStyle = '#3a3c42'; rrPath(92, 22, 10, 3, 1); ctx.fill(); rrPath(106, 24, 7, 4, 1); ctx.fill();   // slide stop, takedown lever
}
/* The gun, then what's fitted over it (`ghost`: one more, see-through, for the preview). Drawn in the box's px. */
function drawGunPic(G, A, ghost, K) {
  ctx.save(); ctx.translate(G.x0, G.y0); ctx.scale(-G.k, G.k);
  if (G.pic === 'ak' && (A.sling || ghost === 'sling')) { ctx.globalAlpha = A.sling ? 1 : 0.55; drawAKSling(K * G.k); ctx.globalAlpha = 1; }   // the sling hangs behind the gun
  G.gun(K * G.k);
  G.att(A, K * G.k);
  if (ghost) { ctx.globalAlpha = 0.55; G.att({ [ghost]: true }, K * G.k); ctx.globalAlpha = 1; }
  ctx.restore();
}
function attPaint(K) {                                           // shared helpers for the overlays (K: screen px per mm)
  const edge = 'rgba(150,200,240,0.65)';
  const shape = (path, y0, y1) => Object.assign(path, { y0, y1 });
  return {                                                       // each part lit from above like the photo: a sheen on top, shade underneath, a fine edge
    fill: (c, sh) => {
      ctx.fillStyle = c; sh(); ctx.fill();
      const g = ctx.createLinearGradient(0, sh.y0, 0, sh.y1);
      g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.18, 'rgba(255,255,255,0.08)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.2 / K; ctx.stroke();
    },
    poly: pts => shape(() => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }, Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[1]))),
    rr: (x, y, w, h, r) => shape(() => rrPath(x, y, w, h, r), y, y + h),
    circ: (x, y, r) => shape(() => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }, y - r, y + r)
  };
}
/* AK-47 attachments in mm (butt at x = 0, bore at y = 0): the photo's handguard runs ~520-668 mm, the dust cover's top is
   27 mm over the bore, the muzzle nut ends at 880. */
/* The VCAS on the workbench drawing (mm, butt at 0): from the stock's rear swivel to the front sling swivel on the gas
   block, hanging in a shallow curve behind the gun: 32 mm padded webbing with its stitching, a sewn loop through each
   swivel, and the quick-adjust buckle and pull tab lying along the strap near the stock. */
function drawAKSling(K) {
  const P0 = [196, 46], P1 = [330, 205], P2 = [640, 190], P3 = [770, 22];
  const at = t => { const u = 1 - t; return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]; };
  const path = () => { ctx.beginPath(); ctx.moveTo(P0[0], P0[1]); ctx.bezierCurveTo(P1[0], P1[1], P2[0], P2[1], P3[0], P3[1]); };
  ctx.lineCap = 'round'; ctx.strokeStyle = '#3a3226'; ctx.lineWidth = 34; path(); ctx.stroke();
  ctx.strokeStyle = COYOTE; ctx.lineWidth = 28; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,0.16)'; ctx.lineWidth = 2.5 / K; ctx.setLineDash([12, 9]); path(); ctx.stroke(); ctx.setLineDash([]);   // stitching
  const along = (t, w, h, col) => {                                // a part lying flat along the strap at t
    const a = at(t), b = at(t + 0.01), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(ang); ctx.fillStyle = col; rrPath(-w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(150,200,240,0.4)'; ctx.lineWidth = 1.2 / K; ctx.stroke(); ctx.restore();
  };
  along(0.035, 46, 30, '#5a4c38'); along(0.965, 46, 30, '#5a4c38');                   // sewn loops through the swivels
  along(0.2, 34, 40, '#1d1e1c');                                                     // the quick-adjust buckle
  along(0.27, 50, 16, '#4a4636');                                                    // its pull tab, lying along the strap
}
function drawAKAtt(A, K) {
  const { fill, poly, rr, circ } = attPaint(K);
  if (A.grip || A.laser || A.ir) {                               // M-LOK aluminium handguard over the wood: top rail, slots
    fill('#2a2c30', rr(506, -38, 166, 76, 6));
    ctx.fillStyle = '#3a3c42'; for (let x = 512; x < 666; x += 9) ctx.fillRect(x, -44, 5, 6);
    ctx.fillStyle = '#121315'; for (const x of [535, 570, 605, 640]) { rrPath(x, -18, 24, 8, 4); ctx.fill(); rrPath(x, 8, 24, 8, 4); ctx.fill(); }
  }
  if (A.grip) {                                                  // Magpul RVG
    fill('#202124', poly([[588, 38], [628, 38], [624, 112], [612, 120], [598, 118]]));
    ctx.strokeStyle = 'rgba(150,200,240,0.3)'; ctx.lineWidth = 1 / K; for (const y of [62, 77, 92]) { ctx.beginPath(); ctx.moveTo(594, y); ctx.lineTo(622, y); ctx.stroke(); }
  }
  if (A.laser) { fill('#1e1f22', rr(585, -48, 60, 5, 1)); fill('#232428', rr(575, -82, 90, 36, 6)); fill('#c0281e', circ(656, -64, 7)); }   // Holosun LS321
  if (A.ir) {                                                    // AN/PEQ-15 (117 mm), tan
    fill('#1e1f22', rr(590, -48, 40, 5, 1)); fill('#9a8460', rr(548, -90, 117, 46, 6)); fill('#8a7655', rr(534, -82, 16, 30, 4));
    fill('#111214', circ(656, -78, 6)); fill('#111214', circ(656, -57, 8));
  }
  if (A.dot) {                                                   // Aimpoint Micro T-2 (68 mm) on a side mount over the receiver
    fill('#1e1f22', poly([[360, -27], [470, -27], [470, -41], [455, -47], [372, -47], [360, -41]]));
    fill('#232428', rr(378, -85, 68, 38, 12)); fill('#2c2d31', rr(404, -93, 16, 9, 2)); fill('#2c2d31', circ(412, -66, 9));
    ctx.fillStyle = 'rgba(120,170,230,0.7)'; ctx.fillRect(443, -81, 3, 30);
  }
  if (A.supp) {                                                  // 180 mm can threaded on in place of the muzzle nut
    fill('#26272b', rr(868, -22, 182, 44, 10));
    ctx.strokeStyle = 'rgba(150,200,240,0.35)'; ctx.lineWidth = 1 / K; for (const x of [882, 892, 1036]) { ctx.beginPath(); ctx.moveTo(x, -21); ctx.lineTo(x, 21); ctx.stroke(); }
  }
}
/* Glock 17 attachments in mm (slide rear at x = 0, slide top at y = 0): the dust cover's rail sits 35 mm under the top. */
function drawGlockAtt(A, K) {
  const { fill, poly, rr } = attPaint(K);
  if (A.light) {                                                 // SureFire X300U-A (91 mm)
    fill('#1e1f22', rr(128, 35, 40, 3, 1)); fill('#1d1e21', rr(104, 37, 92, 28, 6)); fill('#2a2b2f', rr(190, 33, 10, 36, 3)); fill('#2a2b2f', rr(98, 42, 8, 16, 3));
    ctx.fillStyle = 'rgba(220,235,255,0.7)'; ctx.fillRect(198, 37, 2, 28);
  }
  if (A.laser) {                                                 // Crimson Trace CMR-201 Rail Master
    fill('#1e1f22', rr(140, 35, 30, 3, 1)); fill('#1d1e21', rr(128, 37, 58, 20, 5)); fill('#2a2b2f', rr(122, 42, 7, 10, 2));
    ctx.fillStyle = '#c0281e'; ctx.fillRect(183, 41, 4, 12);
  }
  if (A.dot) {                                                   // Trijicon RMR Type 2 (46 x 25 mm) in a slide cut
    fill('#26272b', rr(26, -3, 52, 4, 1)); fill('#232428', poly([[30, -2], [76, -2], [72, -25], [38, -26], [32, -18]]));
    ctx.fillStyle = 'rgba(120,170,230,0.65)'; ctx.beginPath(); ctx.moveTo(64, -5); ctx.lineTo(71, -5); ctx.lineTo(68, -21); ctx.lineTo(61, -21); ctx.closePath(); ctx.fill();
  }
}
const GUN_SPEC = {
  ak: { title: 'AK-47', cal: '7.62 x 39 mm  ·  TYPE 2, MILLED', pic: 'ak', x0: 1096, y0: 59, k: 1.242, att: drawAKAtt, gun: drawAKTraced,
    spec: () => (prog.fit.ak.muzzle ? '1050' : '880') + ' mm overall  ·  415 mm barrel  ·  30 rounds  ·  3.47 kg empty',
    len: () => prog.fit.ak.muzzle ? 1050 : 880, rear: 0,
    box: A => [A.supp ? 1096 - 1055 * 1.242 : 0, A.dot || A.laser || A.ir ? -60 : 0, 1100, 326] },
  glock: { title: 'GLOCK 17', cal: '9 x 19 mm  ·  GEN 4', pic: 'glock', x0: 648, y0: 20, k: 3.43, att: drawGlockAtt, gun: drawGlockTraced,
    spec: () => '202 mm overall  ·  186 mm slide  ·  114 mm barrel  ·  17 rounds  ·  0.63 kg',
    len: () => 202, rear: -14,
    box: A => [A.light ? -12 : 0, A.dot ? -80 : 0, 700, 486] }
};
function drawBench(t) {
  if (!bench) return;
  if (bench.kind === 'locker') return drawLocker(t);
  if (bench.kind === 'pc') return drawPc(t);
  const B = bench, w = B.w, list = ATT[w], fit = prog.fit[w], own = prog.owned[w], G = GUN_SPEC[w], busy = !!B.anim;
  if (B.msgT > 0) B.msgT -= 1 / 60;
  B.hits = [];
  const hit = (x, y, ww, hh, fn) => B.hits.push({ x, y, w: ww, h: hh, fn });
  const pad = 10, X0 = Math.round(VW * 0.47), PW = VW - X0 - pad;     // the menu is a panel on the right: you can watch yourself work on the left
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const sh = ctx.createLinearGradient(X0 - 40, 0, X0 + 10, 0); sh.addColorStop(0, 'rgba(9,11,14,0)'); sh.addColorStop(1, 'rgba(9,11,14,0.94)');
  ctx.fillStyle = sh; ctx.fillRect(X0 - 40, 0, 50, VH); ctx.fillStyle = 'rgba(9,11,14,0.94)'; ctx.fillRect(X0 + 10, 0, VW - X0, VH);
  // header: title, medals, close
  ctx.fillStyle = '#e6edf5'; ctx.font = '700 17px ' + FONT; ctx.fillText('WORKBENCH', X0, pad + 12);
  ctx.textAlign = 'right'; ctx.font = '700 15px ' + FONT; ctx.fillStyle = '#f0c75a'; ctx.fillText('★ ' + prog.medals, VW - 50, pad + 12);
  ctx.strokeStyle = 'rgba(230,237,245,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(VW - 24, pad + 12, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VW - 29, pad + 7); ctx.lineTo(VW - 19, pad + 17); ctx.moveTo(VW - 19, pad + 7); ctx.lineTo(VW - 29, pad + 17); ctx.stroke();
  hit(VW - 44, 0, 44, pad + 30, () => closeBench());
  // tabs
  const ty = pad + 28, tw = (PW - 6) / 2;
  [['ak', 'AK-47'], ['glock', 'GLOCK 17']].forEach(([k, label], i) => {
    const x = X0 + i * (tw + 6), on = k === w;
    ctx.fillStyle = on ? 'rgba(90,140,200,0.35)' : 'rgba(255,255,255,0.06)'; rrPath(x, ty, tw, 26, 5); ctx.fill();
    if (on) { ctx.strokeStyle = 'rgba(140,190,240,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.textAlign = 'left'; ctx.fillStyle = on ? '#fff' : 'rgba(220,228,238,0.7)'; ctx.font = '700 12px ' + FONT; ctx.fillText(label, x + 8, ty + 13);
    ctx.textAlign = 'right'; ctx.font = '600 10px ' + FONT; ctx.fillStyle = 'rgba(200,215,230,0.75)'; ctx.fillText(prog.kills[k] + ' KILLS', x + tw - 7, ty + 13);
    hit(x, ty, tw, 26, () => benchTab(k));
  });
  // the photo
  const top = ty + 32, ph = Math.round((VH - top - pad) * 0.4), px0 = X0, pw = PW, bot = top + ph;
  ctx.fillStyle = '#111a23'; rrPath(px0, top, pw, ph, 6); ctx.fill();
  ctx.save(); rrPath(px0, top, pw, ph, 6); ctx.clip();
  ctx.strokeStyle = 'rgba(120,170,220,0.07)'; ctx.lineWidth = 1;
  for (let x = px0; x < px0 + pw; x += 12) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
  for (let y = top; y < bot; y += 12) { ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px0 + pw, y); ctx.stroke(); }
  ctx.textAlign = 'left'; ctx.fillStyle = '#dbe8f5'; ctx.font = '700 12px ' + FONT; ctx.fillText(G.title + '   ' + G.cal, px0 + 8, top + 10);
  ctx.font = '600 9px ' + FONT; ctx.fillStyle = 'rgba(170,200,230,0.8)'; ctx.fillText(G.spec(), px0 + 8, top + 22);
  const A = benchShown(w), sel = B.sel >= 0 ? list[B.sel] : null, ghost = sel && !A[sel.id] && !busy ? sel : null;
  const A2 = Object.assign({}, A); if (ghost) for (const a of list) if (a.slot === ghost.slot) delete A2[a.id];   // a preview: the selected one in place of whatever shares its slot
  const [bx0, by0, bx1, by1] = G.box(ghost ? Object.assign({}, A2, { [ghost.id]: true }) : A), K = Math.min((pw - 16) / (bx1 - bx0), (ph - 46) / (by1 - by0));
  const ox = px0 + (pw - (bx1 - bx0) * K) / 2 - bx0 * K, oy = top + 28 + (ph - 46 - (by1 - by0) * K) / 2 - by0 * K;
  const pk = [w, JSON.stringify(A2), ghost ? ghost.id : '', pw, ph, DPR].join('|');   // the drawing is cached: redrawn only when the gun, its parts or the size change
  if (!benchPic || benchPic.key !== pk) {
    benchPic = benchPic || { cv: document.createElement('canvas') }; benchPic.key = pk;
    const c = benchPic.cv; c.width = Math.ceil(pw * DPR); c.height = Math.ceil(ph * DPR);
    const g = c.getContext('2d'), o = ctx; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, pw, ph);
    ctx = g; try { ctx.translate(ox - px0, oy - top); ctx.scale(K, K); drawGunPic(G, A2, ghost && ghost.id, K); } finally { ctx = o; }
  }
  ctx.drawImage(benchPic.cv, px0, top, pw, ph);
  const L0 = G.len(), dy = oy + by1 * K + 8, xr = ox + (G.x0 - G.rear * G.k) * K, xl = xr - L0 * G.k * K;   // overall length, butt (or grip) to muzzle
  ctx.strokeStyle = 'rgba(170,200,230,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xl, dy); ctx.lineTo(xr, dy);
  ctx.moveTo(xl, dy - 4); ctx.lineTo(xl, dy + 4); ctx.moveTo(xr, dy - 4); ctx.lineTo(xr, dy + 4); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(190,215,240,0.9)'; ctx.font = '600 9px ' + FONT; ctx.fillText(L0 + ' mm', (xl + xr) / 2, dy - 7);
  ctx.restore();
  // the attachments
  const ly = bot + 6, lh = VH - pad - 14 - ly, rh = Math.min(50, (lh - (list.length - 1) * 4) / list.length);
  list.forEach((a, i) => {
    const y = ly + i * (rh + 4), isFit = fit[a.slot] === a.id, owned = own[a.id], locked = prog.kills[w] < a.kills, afford = prog.medals >= a.price;
    const working = B.anim && B.anim.w === w && B.anim.id === a.id;
    ctx.fillStyle = isFit ? 'rgba(70,150,95,0.22)' : 'rgba(255,255,255,0.05)'; rrPath(X0, y, PW, rh, 5); ctx.fill();
    if (B.sel === i) { ctx.strokeStyle = 'rgba(140,190,240,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    hit(X0, y, PW - 72, rh, () => { B.sel = B.sel === i ? -1 : i; });
    ctx.textAlign = 'left'; ctx.fillStyle = locked ? 'rgba(220,228,238,0.5)' : '#eef3f8'; ctx.font = '700 11px ' + FONT;
    ctx.fillText(a.name + (isFit ? '  • FITTED' : ''), X0 + 8, y + rh * 0.32);
    ctx.font = '600 9px ' + FONT; ctx.fillStyle = 'rgba(170,200,230,' + (locked ? 0.5 : 0.85) + ')'; ctx.fillText(a.real + '  ·  ' + Math.round(LOAD.att[w][a.id] * 1000) + ' G', X0 + 8, y + rh * 0.7);
    const bw = 64, bh = Math.min(24, rh - 12), bx = X0 + PW - bw - 6, by = y + (rh - bh) / 2;
    let label, col;
    if (working) { label = B.anim.off ? 'REMOVING' : 'FITTING'; col = 'rgba(200,160,50,' + (0.45 + 0.3 * Math.sin(t * 6)).toFixed(2) + ')'; }
    else if (locked) { label = prog.kills[w] + ' / ' + a.kills + ' KILLS'; col = 'rgba(120,125,135,0.5)'; }
    else if (!owned) { label = '★ ' + a.price + '  BUY'; col = afford ? 'rgba(200,160,50,0.85)' : 'rgba(150,110,60,0.45)'; }
    else if (isFit) { label = 'REMOVE'; col = 'rgba(150,80,70,0.7)'; }
    else { label = 'FIT'; col = 'rgba(70,140,200,0.85)'; }
    if (busy && !working) ctx.globalAlpha = 0.45;
    ctx.fillStyle = col; rrPath(bx, by, bw, bh, 5); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 10px ' + FONT; ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
    ctx.globalAlpha = 1;
    hit(bx, by, bw, bh, () => benchAct(w, a));
  });
  ctx.textAlign = 'center';
  if (B.msgT > 0) { ctx.globalAlpha = Math.min(1, B.msgT * 2); ctx.fillStyle = '#ffe3a0'; ctx.font = '700 11px ' + FONT; ctx.fillText(B.msg, X0 + PW / 2, VH - pad - 4); ctx.globalAlpha = 1; }
  else if (sel) { ctx.fillStyle = 'rgba(215,228,240,0.9)'; ctx.font = '600 10px ' + FONT; ctx.fillText(sel.name + ': ' + sel.fx.toUpperCase(), X0 + PW / 2, VH - pad - 4); }   // what the selected one does
  else { ctx.fillStyle = 'rgba(190,205,220,0.55)'; ctx.font = '600 9px ' + FONT; ctx.fillText('TAP A PART TO SEE IT  ·  A MEDAL PER CIVILIAN  ·  KILLS UNLOCK PARTS', X0 + PW / 2, VH - pad - 4); }
  ctx.restore();
}

/* Your laser (see ATTACHMENTS): a thin beam from the muzzle to the first wall, door or body, with a bright dot where it
   lands. Red for the visible one (bots can notice the dot, and the beam pointed in their eyes, see botSees / noticeBeam);
   the IR one is what you see through your NVGs, a pale green, and nobody else can. Only while the gun is up. */
/* An enemy's visible laser, on while he's alert (searching or fighting) with the rifle up: a faint red beam and its dot,
   which you can see from anywhere in the dark, so it gives him away. */
function drawBotLasers(t, beam) {
  let clipped = false;                                // only the parts of a beam you have a line to: never through a wall
  for (const b of bots) {
    if (b.dead || !bKit(b, 'laser') || !b.gun || b.side.out || b.state === 'patrol' || b.melee || b.equip || !gunCanFire(b)) continue;
    const g = b.gun, c = Math.cos(g.ang), s = Math.sin(g.ang);
    let d = lightCast(g.mx, g.my, c, s, ATTFX.laser.reach);
    for (const o of [p].concat(allies, civs)) {
      if (o.dead || (o === p && state !== 'play')) continue;
      const tt = (o.x - g.mx) * c + (o.y - g.my) * s, off = Math.abs((o.y - g.my) * c - (o.x - g.mx) * s), R = BODY_R * 0.8;
      if (tt > 0 && off < R && tt - Math.sqrt(R * R - off * off) < d) d = Math.max(0, tt - Math.sqrt(R * R - off * off));
    }
    const x1 = g.mx + c * d, y1 = g.my + s * d;
    if (!onView((g.mx + x1) / 2, (g.my + y1) / 2, d / 2 + 6)) continue;
    if (!clipped) { clipped = true; const v = beam.view || (beam.view = lightPoly(p.x, p.y, Math.hypot(VW, VH) / (S * zoom))); ctx.save(); polyOn(ctx, v); ctx.clip(); }
    const gr = ctx.createLinearGradient(g.mx, g.my, x1, y1);
    gr.addColorStop(0, 'rgba(255,45,35,0.2)'); gr.addColorStop(1, 'rgba(255,45,35,0.12)');
    ctx.strokeStyle = gr; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(g.mx, g.my); ctx.lineTo(x1, y1); ctx.stroke();
    const fl = 0.85 + 0.15 * Math.sin(t * 37 + b.seed), dg = ctx.createRadialGradient(x1, y1, 0, x1, y1, 5);
    dg.addColorStop(0, 'rgba(255,45,35,' + (0.9 * fl).toFixed(2) + ')'); dg.addColorStop(0.35, 'rgba(255,45,35,0.33)'); dg.addColorStop(1, 'rgba(255,45,35,0)');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(x1, y1, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (clipped) ctx.restore();
}
function drawLaser(t) {
  laserDot = null;
  if (state !== 'play' || !laserOn() || !p.gun || p.side.sw || p.melee || reloading > 0 || p.side.reload > 0 || gearBusy() || !gunCanFire(p)) return;
  const g = p.gun, c = Math.cos(g.ang), s = Math.sin(g.ang), R = BODY_R * 0.8;
  let d = lightCast(g.mx, g.my, c, s, ATTFX.laser.reach);
  for (const o of bots.concat(civs, allies)) {
    if (o.dead) continue;
    const tt = (o.x - g.mx) * c + (o.y - g.my) * s, off = Math.abs((o.y - g.my) * c - (o.x - g.mx) * s);
    if (tt > 0 && off < R && tt - Math.sqrt(R * R - off * off) < d) d = Math.max(0, tt - Math.sqrt(R * R - off * off));
  }
  const x1 = g.mx + c * d, y1 = g.my + s * d, ir = attOn('ir'), col = ir ? '235,245,255' : '255,45,35', fl = 0.85 + 0.15 * Math.sin(t * 37);   // IR: a bright white line through the white-phosphor tube
  laserDot = { x: x1, y: y1 };
  const gr = ctx.createLinearGradient(g.mx, g.my, x1, y1);
  gr.addColorStop(0, 'rgba(' + col + ',' + (ir ? 0.45 : 0.22) + ')'); gr.addColorStop(1, 'rgba(' + col + ',' + (ir ? 0.25 : 0.14) + ')');
  if (ir) { ctx.save(); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, ATTFX.laser.reach + 20, p.aim - NVG.half - NVG.soft, p.aim + NVG.half + NVG.soft); ctx.closePath(); ctx.clip(); }   // seen only through the tube
  ctx.strokeStyle = gr; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(g.mx, g.my); ctx.lineTo(x1, y1); ctx.stroke();
  const dg = ctx.createRadialGradient(x1, y1, 0, x1, y1, ir ? 6 : 5);
  dg.addColorStop(0, 'rgba(' + col + ',' + (0.95 * fl).toFixed(2) + ')'); dg.addColorStop(0.35, 'rgba(' + col + ',0.35)'); dg.addColorStop(1, 'rgba(' + col + ',0)');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(x1, y1, ir ? 6 : 5, 0, Math.PI * 2); ctx.fill();
  if (ir) ctx.restore();
}

/* At the safe house workbench: the parts you own for the gun in your hands that aren't on it lie on the bench (a part being
   picked up or set down is in your hand instead). */
const benchSpot = (w, id) => {                                  // every part you own for a gun has its own spot along the bench's front edge
  const B = MAP.bench, own = ATT[w].filter(a => prog.owned[w][a.id]), i = own.findIndex(a => a.id === id), n = own.length;
  return { x: B.x * T - 5 + (i - (n - 1) / 2) * 8, y: (benchPiece ? benchPiece.y + benchPiece.h - 7 : (B.sy || B.y) * T - 17) - (i % 2) * 2.5, a: -Math.PI / 2 + 0.15 * (i % 2 ? 1 : -1) };
};
function drawBenchParts() {
  const B = MAP.bench;
  if (!B || !bench || bench.kind !== 'bench') return;
  const w = bench.w, A = benchShown(w), an = bench.anim;
  const inHand = a => an && an.w === w && an.id === a.id && (an.off ? an.t / an.T < 0.8 : an.t / an.T >= 0.26);
  for (const a of ATT[w]) {
    if (!prog.owned[w][a.id] || A[a.id] || inHand(a)) continue;
    const sp = benchSpot(w, a.id);
    ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(sp.a); ctx.scale(CHAR_SCALE, CHAR_SCALE); drawAttPart(w, a.id); ctx.restore();
  }
}
/* An attachment on its own, in a hand (top view, along the gun's axis, at the same size as on the gun). */
function drawAttPart(w, id, rim) {                              // rim: a faint lit edge, so a dark part reads against a dark glove
  const sh = (x, y, ww, hh, r, c0, c1, c2) => { const g = ctx.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrPath(x + 0.4, y + 0.5, ww, hh, r); ctx.fill(); ctx.fillStyle = g; rrPath(x, y, ww, hh, r); ctx.fill();
    ctx.strokeStyle = rim ? 'rgba(235,240,245,0.45)' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.3; ctx.stroke(); };
  const black = ['#4c4e54', '#232428', '#111214'], tan = ['#b8a37c', '#9a8460', '#6f5f43'];
  if (w === 'ak') {
    if (id === 'dot') { sh(-2.15, -1.3, 4.3, 2.6, 1, ...black); ctx.fillStyle = '#2c2d31'; ctx.beginPath(); ctx.arc(0, 0, 0.75, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(120,150,190,0.6)'; ctx.fillRect(1.9, -0.95, 0.25, 1.9); }
    else if (id === 'laser') { sh(-2.75, -1.2, 5.5, 2.4, 0.5, ...black); ctx.fillStyle = '#c0281e'; ctx.fillRect(2.4, -0.6, 0.35, 1.2); }
    else if (id === 'ir') { sh(-3.65, -1.3, 7.3, 2.6, 0.5, ...tan); ctx.fillStyle = '#1b1c1f'; ctx.fillRect(3.15, -1.05, 0.5, 0.8); ctx.fillRect(3.15, 0.3, 0.5, 0.8); }
    else if (id === 'sling') {                                    // VCAS, rolled up: a coil of coyote webbing, its buckle and swivel
      for (const r of [2.6, 1.9, 1.2]) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0.3, 0.3, r, r * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = COYOTE; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#1d1e1c'; ctx.fillRect(1.8, -0.7, 1.2, 1.4); ctx.fillStyle = '#8a8c90'; ctx.beginPath(); ctx.arc(-2.6, 1.6, 0.6, 0, Math.PI * 2); ctx.fill();
    }
    else if (id === 'grip') { sh(-1.5, -1.1, 3, 2.2, 0.9, ...black); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-1, -0.3, 2, 0.25); }
    else if (id === 'supp') { sh(-5.65, -1.45, 11.3, 2.9, 1, '#5a5c62', '#26272b', '#111214'); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-5, -1.45, 0.35, 2.9); ctx.fillRect(-4.2, -1.45, 0.35, 2.9); }
  } else {
    if (id === 'dot') { sh(-1.6, -1.05, 3.25, 2.1, 0.6, ...black); ctx.fillStyle = 'rgba(120,150,190,0.5)'; ctx.fillRect(1.4, -0.75, 0.2, 1.5); }
    else if (id === 'light') { sh(-3.2, -1.8, 6.4, 3.6, 0.6, ...black); ctx.fillStyle = 'rgba(230,240,255,0.6)'; ctx.fillRect(3.1, -1.1, 0.2, 2.2); }
    else if (id === 'laser') { sh(-1.8, -1.6, 3.6, 3.2, 0.6, ...black); ctx.fillStyle = '#c0281e'; ctx.fillRect(1.6, -0.45, 0.25, 0.9); }
  }
}

