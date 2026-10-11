const sidePose = (c, phase, move) => { const S = c.side; return { out: S.out, sw: S.sw ? { to: S.sw.to, f: clamp(S.sw.t / PISTOL.draw, 0, 1) } : null, rl: S.reload > 0 ? 1 - S.reload / PISTOL.reload : -1, hol: c.hol.a, bob: Math.sin(phase) * move }; };
function charPose(c, bodyAng, t, extra) {
  const cv = c.cov || NO_POSE;
  const lean = cv.lean || 0;
  const toLocal = (wx, wy) => {
    const dx = wx - c.x, dy = wy - c.y, k = Math.cos(-bodyAng), s = Math.sin(-bodyAng);
    return [(dx * k - dy * s) / CHAR_SCALE, (dx * s + dy * k) / CHAR_SCALE - lean];
  };
  const pose = Object.assign({ reload: -1, crouch: 0, reach: null, t, phase: 0, walk: 0, mvRel: 0, rx: 0,
    sh: cv.sh === undefined ? 1 : cv.sh, lean, flash: false, doorHand: null, mountHand: null, prot: c.prot || null,
    gunIn: c.gun ? c.gun.in / CHAR_SCALE : 0, gunSw: c.gun ? c.gun.sw * c.gun.sd : 0 }, extra);
  pose.crouch = Math.max(pose.crouch || 0, (cv.duck || 0) * COVER.duck);       // ducked behind cover
  const px = cv.px || 0, py = cv.py || 0, kc = Math.cos(-bodyAng), ks = Math.sin(-bodyAng);   // peek: body offset from the planted boots
  pose.peekW = [px, py]; pose.peekL = [(px * kc - py * ks) / CHAR_SCALE, (px * ks + py * kc) / CHAR_SCALE];
  pose.peekK = clamp(Math.hypot(px, py) / PEEK.dist, 0, 1);
  if (c.doorTouch && c.doorTouch.t > 0) pose.doorHand = toLocal(c.doorTouch.x, c.doorTouch.y);
  if (cv.mount > 0.5 && cv.hand) pose.mountHand = toLocal(cv.hand[0], cv.hand[1]);
  if (pose.reachW) { pose.reach = toLocal(pose.reachW[0], pose.reachW[1]); }
  return pose;
}
function playerPose(t) {
  const ba0 = p.aim + sway * ARMS.bodyFollow;
  const extra = { reload: reloading > 0 ? 1 - reloading / AR.reload : -1, phase: pAnim.phase, walk: moveAmt,
    mvRel: angDiff(pAnim.mvAng, ba0), rx: pAnim.rx, flash: muzzle > 0, att: benchShown('ak'), attG: benchShown('glock'), breath: Math.sin(t * 1.7) * 0.35 * (1 - moveAmt) * (fireCd < -0.5 ? 1 : 0.3),
    attach: bench && bench.anim ? benchPose(bench.anim, ba0) : null, slingSt: p.slingSt || (p.slingSt = {}), locker: bench && bench.la ? { id: bench.la.id, off: bench.la.off, side: bench.la.side, f: clamp(bench.la.t / bench.la.T, 0, 1) } : null, nades: Object.assign({ max: fullNades() }, p.nades) };
  gearPose(extra, pickItem && pickT > 0 ? pickItem : null, pickItem ? clamp(pickT / PICK_TIME[pickItem.kind], 0, 1) : 0, equip);
  if (p.melee) extra.knife = knifePose(p, ba0);
  extra.side = sidePose(p, pAnim.phase, moveAmt);
  extra.nade = nadePose();
  if (p.secure || defusing()) {                                    // reaching for their wrists, or working at the bomb (its wires and timer, nudged as you work)
    const c = p.secure ? p.secure.c : bomb, dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
    const wx = c.x + dx / d * 6 + (p.secure ? 0 : Math.sin(t * 7) * 2), wy = c.y + dy / d * 6 + (p.secure ? 0 : Math.cos(t * 5.3) * 2);
    const k = Math.cos(-ba0), sn = Math.sin(-ba0);
    extra.doorHand = [((wx - p.x) * k - (wy - p.y) * sn) / CHAR_SCALE, ((wx - p.x) * sn + (wy - p.y) * k) / CHAR_SCALE - ((p.cov && p.cov.lean) || 0)];
  }
  return charPose(p, ba0, t, extra);
}

/* Run a drawing function in an "upright on screen" frame centred on a world point. */
function upright(x, y, fn) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2 + p.aim); fn(); ctx.restore();
}

function chevron(cx, cy, dir, size) {
  ctx.beginPath();
  ctx.moveTo(cx - dir * size * 0.5, cy - size);
  ctx.lineTo(cx + dir * size * 0.5, cy);
  ctx.lineTo(cx - dir * size * 0.5, cy + size);
  ctx.stroke();
}

function drawMoveStick(st, defX, defY) {
  const active = st.id !== null;
  if (!active && (!isTouch || touchSeen)) return;
  const bx = active ? st.ox : defX, by = active ? st.oy : defY;
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? 'rgba(170,200,235,0.55)' : 'rgba(170,200,235,0.25)';
  ctx.beginPath(); ctx.arc(bx, by, moveR(), 0, Math.PI * 2); ctx.stroke();
  let kx = bx, ky = by;
  if (active) {
    const dx = st.x - st.ox, dy = st.y - st.oy, l = Math.hypot(dx, dy) || 1, m = Math.min(l, moveR());
    kx = bx + dx / l * m; ky = by + dy / l * m;
  }
  ctx.fillStyle = active ? 'rgba(120,160,195,0.6)' : 'rgba(120,160,195,0.22)';
  ctx.beginPath(); ctx.arc(kx, ky, 26, 0, Math.PI * 2); ctx.fill();
  if (!active) {
    ctx.fillStyle = 'rgba(190,215,245,0.5)'; ctx.textAlign = 'center';
    ctx.font = '600 14px ' + FONT;
    ctx.fillText('MOVE', bx, by + moveR() + 22);
  }
}

function drawTurnPad(st, defX, defY) {
  const active = st.id !== null;
  if (!isTouch) return;
  if (!active && touchSeen) return;
  ctx.lineWidth = 3;
  if (active) {
    ctx.strokeStyle = 'rgba(170,200,235,0.3)';
    ctx.beginPath(); ctx.moveTo(st.ox, st.oy); ctx.lineTo(st.x, st.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(170,200,235,0.6)';
    ctx.beginPath(); ctx.arc(st.x, st.y, 32, 0, Math.PI * 2); ctx.stroke();
    chevron(st.x - 50, st.y, -1, 9); chevron(st.x + 50, st.y, 1, 9);
  } else {
    ctx.strokeStyle = 'rgba(170,200,235,0.25)';
    ctx.beginPath(); ctx.arc(defX, defY, 32, 0, Math.PI * 2); ctx.stroke();
    chevron(defX - 50, defY, -1, 9); chevron(defX + 50, defY, 1, 9);
    ctx.fillStyle = 'rgba(190,215,245,0.5)'; ctx.textAlign = 'center'; ctx.font = '600 14px ' + FONT;
    ctx.fillText('SWIPE TO TURN', defX, defY + STICK_R + 22);
  }
}

function drawThreats() {
  if (!threats.length) return;
  const M = threatXf;
  if (!M) return;
  const P0 = M.transformPoint(new DOMPoint(p.x, p.y)), px = P0.x / DPR, py = P0.y / DPR, m = 34;
  for (const q of threats) {
    if (q.snd && !soundVis()) continue;            // gunfire you only heard: shown only in the visual-sound mode
    const Q = M.transformPoint(new DOMPoint(q.x, q.y)), qx = Q.x / DPR, qy = Q.y / DPR;
    let dx = qx - px, dy = qy - py; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    if (qx > m && qx < VW - m && qy > m && qy < VH - m) continue;          // on screen: the flash shows them
    const tx = dx > 0 ? (VW - m - px) / dx : dx < 0 ? (m - px) / dx : Infinity, ty = dy > 0 ? (VH - m - py) / dy : dy < 0 ? (m - py) / dy : Infinity, k = Math.min(tx, ty);
    const ex = px + dx * k, ey = py + dy * k, a = Math.atan2(dy, dx), al = clamp(q.t / THREAT_T, 0, 1);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,60,50,' + (0.85 * al).toFixed(2) + ')';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -11); ctx.lineTo(-1, 0); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill();
    const gg = ctx.createRadialGradient(4, 0, 0, 4, 0, 26); gg.addColorStop(0, 'rgba(255,40,30,' + (0.35 * al).toFixed(2) + ')'); gg.addColorStop(1, 'rgba(255,40,30,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(4, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
/* Side-on silhouettes for the weapon picker, centred, about `s` px long. */
function gunSilhouette(g, kind, x, y, s, col) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.fillStyle = col; g.strokeStyle = col; g.lineJoin = 'round';
  if (kind === 'rifle') {                                    // AK: stock, receiver, curved magazine, pistol grip, handguard, gas tube, barrel and brake
    g.beginPath(); g.moveTo(-50, -4); g.lineTo(-30, -8); g.lineTo(-28, 2); g.lineTo(-50, 8); g.closePath(); g.fill();   // stock
    g.fillRect(-29, -9, 34, 10);                                                                                   // receiver
    g.beginPath(); g.moveTo(-6, 1); g.quadraticCurveTo(-2, 14, 6, 22); g.lineTo(13, 19); g.quadraticCurveTo(5, 10, 4, 1); g.closePath(); g.fill();   // magazine
    g.beginPath(); g.moveTo(-20, 1); g.lineTo(-24, 13); g.lineTo(-18, 14); g.lineTo(-14, 1); g.closePath(); g.fill();  // grip
    g.fillRect(5, -7, 18, 7); g.fillRect(5, -11, 22, 3); g.fillRect(23, -6, 22, 3); g.fillRect(43, -8, 6, 6);          // handguard, gas tube, barrel, brake
    g.fillRect(36, -13, 2, 6);                                                                                     // front sight
  } else {                                                   // Glock 17: slide, frame, grip, trigger guard
    g.beginPath(); g.moveTo(-30, -14); g.lineTo(32, -14); g.lineTo(32, -2); g.lineTo(-30, -2); g.closePath(); g.fill();   // slide
    g.beginPath(); g.moveTo(-24, -2); g.lineTo(26, -2); g.lineTo(26, 4); g.lineTo(-6, 4); g.lineTo(-10, 30); g.lineTo(-26, 30); g.lineTo(-22, 4); g.closePath(); g.fill();   // frame and grip
    g.lineWidth = 3; g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(-2, 14, 8, 4); g.stroke();                 // trigger guard
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let q = -24; q < -10; q += 4) g.fillRect(q, -13, 2, 10);                  // slide serrations
  }
  g.restore();
}
function drawSwap() {
  const b = reloadBtn();
  if (swap && !swap.open) {                                                // holding: a ring fills until the picker opens
    const f = clamp(swap.t / SWAP.hold, 0, 1);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(140,220,255,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  }
  if (!swap || !swap.open) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, VW, VH);                                        // the world steps back a little
  ctx.strokeStyle = 'rgba(180,225,255,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(swap.x, swap.y); ctx.stroke(); ctx.setLineDash([]);
  for (const ic of swapOpts()) {
    const to = ic.k, ok = swapCan(to), hot = Math.hypot(swap.x - ic.x, swap.y - ic.y) < ic.r + 14;
    ctx.fillStyle = hot && ok ? 'rgba(90,200,140,0.35)' : 'rgba(20,24,30,0.75)'; ctx.beginPath(); ctx.arc(ic.x, ic.y, ic.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = hot ? 4 : 2.5; ctx.strokeStyle = !ok ? 'rgba(200,90,80,0.8)' : hot ? 'rgba(130,255,170,0.95)' : 'rgba(190,220,250,0.85)'; ctx.stroke();
    if (isNade(to)) { ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(-0.5); drawNade(to, 0, 6.5); ctx.restore(); }
    else gunSilhouette(ctx, to, ic.x + (to === 'rifle' ? 0 : -2), ic.y + (to === 'rifle' ? 0 : -6), to === 'rifle' ? 68 : 52, ok ? (hot ? '#e8fff0' : '#d8e6f4') : 'rgba(200,200,200,0.4)');
    ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = ok ? 'rgba(220,235,250,0.95)' : 'rgba(230,140,130,0.95)';
    ctx.fillText(!ok ? 'NO RIFLE AMMO' : to === 'rifle' ? 'AK-47' : to === 'pistol' ? 'GLOCK 17' : NADE_NAME[to] + '  \u00d7' + p.nades[to], ic.x, ic.y + ic.r + 16);
  }
  ctx.restore();
}
function drawThrowBtn() {                                                         // a grenade in hand: THROW (its power filling as you hold) and PUT AWAY
  const b = reloadBtn(), N = p.nade, pb = putBtn();
  ctx.lineWidth = 4; ctx.strokeStyle = N.ph === 'ready' || N.ph === 'wind' ? 'rgba(255,215,140,0.85)' : 'rgba(170,205,240,0.4)';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
  if (N.ph === 'wind') { ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,190,90,0.95)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + N.pow * Math.PI * 2); ctx.stroke(); }
  ctx.save(); ctx.translate(b.x, b.y - 6); ctx.rotate(-0.6); drawNade(N.id, 0, 4.2, N.pin); ctx.restore();
  ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,230,180,0.95)'; ctx.fillText(N.ph === 'wind' ? 'LET GO' : 'HOLD TO THROW', b.x, b.y + 22);
  ctx.font = '700 22px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = '#a9cdf5'; ctx.fillText(NADE_NAME[N.id] + ' \u00d7' + p.nades[N.id], b.x + 40, b.y - b.r - 14);
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(190,220,250,0.75)'; ctx.fillStyle = 'rgba(20,24,30,0.6)'; ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = '700 9px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(220,235,250,0.95)'; ctx.fillText('PUT', pb.x, pb.y - 4); ctx.fillText('AWAY', pb.x, pb.y + 7);
}
function drawReloadBtn() {
  if (nadeHeld()) return drawThrowBtn();
  const b = reloadBtn();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(170,205,240,0.7)';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
  if (reloading > 0) {
    const f = 1 - reloading / AR.reload;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,220,120,0.95)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  }
  const canCancel = ((equip || (pickItem && pickT > 0)) && (ammo > 0 || mags.length)) || (reloading > 0 && !magDropped);
  if (canCancel) {                                                     // tap now cancels what the hands are doing: an X
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,170,90,0.95)'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - 11, b.y - 11); ctx.lineTo(b.x + 11, b.y + 11); ctx.moveTo(b.x + 11, b.y - 11); ctx.lineTo(b.x - 11, b.y + 11); ctx.stroke();
    ctx.lineCap = 'butt';
  } else {
    // circular-arrow icon
    const ea = Math.PI * 1.35;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(190,220,250,0.9)'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(b.x, b.y, 16, -0.3, ea); ctx.stroke();
    const ex = b.x + Math.cos(ea) * 16, ey = b.y + Math.sin(ea) * 16;
    const tx = -Math.sin(ea), ty = Math.cos(ea), nx = Math.cos(ea), ny = Math.sin(ea);
    ctx.fillStyle = 'rgba(190,220,250,0.9)';
    ctx.beginPath();
    ctx.moveTo(ex + tx * 10, ey + ty * 10);
    ctx.lineTo(ex + nx * 8, ey + ny * 8);
    ctx.lineTo(ex - nx * 8, ey - ny * 8);
    ctx.closePath(); ctx.fill();
    ctx.lineCap = 'butt';
  }
  // ammo count
  const low = (p.side.out ? p.side.ammo : ammo) <= 5;
  ctx.font = '700 34px ' + FONT;
  ctx.fillStyle = low ? '#ffb347' : '#a9cdf5';
  ctx.textAlign = 'right'; ctx.fillText(String(p.side.out ? p.side.ammo : ammo), b.x + 6, b.y - b.r - 14);
  if (p.side.out) { ctx.font = '600 13px ' + FONT; ctx.fillText('GLOCK 17 · \u221e MAGS', b.x + 40, b.y - b.r - 52); }
  for (let i = 0; i < vestCap(); i++) {                // spare magazines in the vest (as many as your loadout carries): outline per slot, filled by rounds left
    const x = b.x + 12 + i * 10, y = b.y - b.r - 38, h = 24;
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(169,205,245,0.45)'; ctx.strokeRect(x, y, 6, h);
    if (i < mags.length) { const f = mags[i] / AR.mag; ctx.fillStyle = 'rgba(169,205,245,0.85)'; ctx.fillRect(x, y + h * (1 - f), 6, h * f); }
  }
}


/* Pickups drawn as the real things lying on the floor (it: the item, for rounds, damage and whose kit it was). */
function drawIcon(kind, it) {
  ctx.lineJoin = 'round';
  const ln = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const shadow = path => { ctx.save(); ctx.translate(1.4, 2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; path(); ctx.fill(); ctx.restore(); };
  if (kind === 'mag') {                                  // a steel AK magazine: ribs, worn edges, brass at the lips if it has rounds
    ctx.scale(0.8, 0.8);
    const body = () => { ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(6, -12); ctx.quadraticCurveTo(5, 4, -1, 13); ctx.lineTo(-9, 11); ctx.quadraticCurveTo(-4, 1, -3, -12); ctx.closePath(); };
    shadow(body);
    body(); const mg = ctx.createLinearGradient(-9, 0, 6, 0); mg.addColorStop(0, '#24252a'); mg.addColorStop(0.55, '#3a3c42'); mg.addColorStop(1, '#2a2b30'); ctx.fillStyle = mg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.9; for (const y of [-7, -2, 3, 8]) ln(-10, y, 8, y - 1.2);   // stamped ribs
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; for (const y of [-6.2, -1.2, 3.8, 8.8]) ln(-10, y, 8, y - 1.2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(190,195,205,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(6, -12); ctx.quadraticCurveTo(5, 4, -1, 13); ctx.stroke();   // worn spine
    ctx.fillStyle = '#1c1d20'; ctx.fillRect(-3.4, -13.2, 9.8, 2);                                   // feed lips
    if (!it || it.rounds > 0) { ctx.fillStyle = '#b8873a'; ctx.beginPath(); ctx.ellipse(1.5, -13, 2.8, 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,230,170,0.5)'; ctx.fillRect(0.4, -13.8, 2, 0.8); }
  } else if (kind === 'helmet') {                        // a helmet lying on its side: shell, rails, straps; dents if it took hits
    const ir = it && it.ir, base = ir ? '#4c5135' : '#857656', dark = ir ? '#30331f' : '#5c4f37';
    const shell = () => { ctx.beginPath(); ctx.ellipse(0, 0, 12, 11, 0, 0, Math.PI * 2); };
    shadow(shell);
    ctx.strokeStyle = '#2a2620'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, 10); ctx.quadraticCurveTo(-1, 16, 4, 14); ctx.moveTo(5, 9); ctx.quadraticCurveTo(9, 13, 12, 11); ctx.stroke();   // chin straps
    shell(); const hg = ctx.createRadialGradient(-3.5, -3.5, 1, 0, 0, 12.5); hg.addColorStop(0, ir ? '#666b4a' : '#a39472'); hg.addColorStop(0.7, base); hg.addColorStop(1, dark); ctx.fillStyle = hg; ctx.fill();
    if (!ir) { pinCamo(OCP); ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = OCP; shell(); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ln(-7, -9, 5, -9.6); ln(-7, 9, 5, 9.6);             // side rails
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5; for (const x of [-5, -2, 1, 4]) { ln(x, -10.3, x, -8.6); ln(x, 8.6, x, 10.3); }
    if (!ir) { ctx.fillStyle = dark; ctx.fillRect(9.5, -2.5, 3.5, 5); ctx.fillStyle = '#2a2a26'; ctx.fillRect(11.5, -1.3, 1.6, 2.6); }   // NVG mount
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(0, 0, 11.2, 10.2, 0, 0, Math.PI * 2); ctx.stroke();   // edge trim
    for (const c of (it && it.chips) || []) {                                                     // dents and cracks
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(c.x * 1.6, c.y * 1.6, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.6; ln(c.x * 1.6, c.y * 1.6, c.x * 1.6 + c.cx * 1.6, c.y * 1.6 + c.cy * 1.6);
    }
  } else if (kind === 'plate') {                         // an armour plate in its fabric cover: cut corners, a label, cracks if it took hits
    const ir = it && it.ir;
    const shape = () => { ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(6, -13); ctx.lineTo(10, -8); ctx.lineTo(10, 13); ctx.lineTo(-10, 13); ctx.lineTo(-10, -8); ctx.closePath(); };
    shadow(shape);
    shape(); const pg = ctx.createLinearGradient(-10, 0, 10, 0); pg.addColorStop(0, ir ? '#3d3f32' : '#4a4436'); pg.addColorStop(0.5, ir ? '#55574a' : '#655c49'); pg.addColorStop(1, ir ? '#393b2e' : '#463f31'); ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-8.6, -7.4); ctx.lineTo(-5.4, -11.6); ctx.lineTo(5.4, -11.6); ctx.lineTo(8.6, -7.4); ctx.lineTo(8.6, 11.6); ctx.lineTo(-8.6, 11.6); ctx.closePath(); ctx.stroke();   // stitching
    ctx.fillStyle = '#c4bda8'; ctx.fillRect(-5, 1, 10, 7); ctx.fillStyle = 'rgba(40,36,30,0.7)';             // label
    for (const y of [2.5, 4.3, 6.1]) ctx.fillRect(-4, y, y === 2.5 ? 8 : 6, 0.8);
    const lost = it && it.hp !== undefined ? 1 - it.hp / PLATE_HP : 0;
    if (lost > 0.05) {                                                                               // cracks spreading as it took hits
      ctx.strokeStyle = 'rgba(15,14,12,0.75)'; ctx.lineWidth = 0.7;
      const n = Math.ceil(lost * 5);
      for (let q = 0; q < n; q++) { const sx = -6 + ((q * 37) % 12), sy = -9 + ((q * 53) % 16); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 3, sy + 2); ctx.lineTo(sx + 2, sy + 5); ctx.lineTo(sx + 5, sy + 7); ctx.stroke(); }
    }
  }
}

/* Loot shows as a plain icon once your light finds it. */
function drawItems(t) {
  for (const it of items) {
    if (it.vis < 0.03 || !onView(it.x, it.y, 20) || (it === pickItem && pickT >= PICK_TIME[it.kind] * 0.7)) continue;   // already in your hand
    ctx.globalAlpha = it.vis;
    if (it.rot === undefined) it.rot = Math.random() * Math.PI * 2;
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); drawIcon(it.kind, it); ctx.restore();
    const gl = Math.max(0, Math.sin(t * 1.7 + it.bob * 3)) ** 8;                                       // an occasional glint so it can be found
    if (gl > 0.02) { ctx.fillStyle = 'rgba(255,248,225,' + (0.55 * gl * it.vis).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(it.x + 3, it.y - 4, 1.6 + gl, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function extPath(ext, x, y, f) {
  ctx.beginPath();
  for (let k = 0; k < SOUND_RAYS; k++) {
    const a = k / SOUND_RAYS * Math.PI * 2, r = ext[k] * f;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
/* Sound pulses: thin, faint rings that roll outward and are cut short by walls.
   Footsteps are grey-white, gunshots are a little warmer and bigger. */

const WAVE_STYLE = {
  walk:  ['205,225,245', 0.26],   // your footsteps
  gun:   ['255,205,160', 0.32],   // your gunfire
  nwalk: ['225,225,230', 0.18],   // a bystander bumping something
  ewalk: ['255,120,120', 0.7],    // enemy footsteps you can hear: bolder
  egun:  ['255,100,80',  0.8]     // enemy gunfire you can hear
};
/* Enemy sound rings: shown out to RINGS.hear × a footstep's reach, drawn thicker (RINGS.width px on screen) with a
   pulse at the source so you can place them at a glance. Bots' own hearing is unchanged. */
const RINGS = { hear: 1.6, width: 1.4, dot: 5 };   // width 1.4: the same line as your own rings
function drawSound() {
  const lw = 1.4 / (S * zoom);                 // about a pixel and a half on screen
  for (const w of waves) {
    const [rgb, a0] = WAVE_STYLE[w.kind];
    const e = 1 - (1 - w.f) * (1 - w.f);
    extPath(w.ext, w.x, w.y, e);
    const enemy = w.kind[0] === 'e', a = (1 - w.f) * a0;
    ctx.lineWidth = enemy ? lw * RINGS.width / 1.4 : lw;
    ctx.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
    ctx.stroke();
    if (enemy) {                                    // a pulse where the sound came from
      ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(w.x, w.y, RINGS.dot / (S * zoom) * (1 - 0.5 * w.f), 0, Math.PI * 2); ctx.fill();
    }
  }
}

function pin(cx, cy, col, n) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#05070c'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e6f0ff'; ctx.textAlign = 'left'; ctx.font = '600 24px ' + FONT;
  ctx.fillText(String(n), cx + 16, cy + 8);
}


/* The exit ring (drawn over the darkness once it's open) and a pointer to it from the screen edge. */
function drawExtract(t) {
  const R = MAP.restock;
  if (R) {                                                           // the armory rack: blue while there's kit to top up
    const full = kitFull(), x = R.x * T, y = R.y * T, a = full ? 0.25 : 0.55 + 0.3 * Math.sin(t * 3);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,180,255,' + a.toFixed(2) + ')'; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(x, y, RESTOCK.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    upright(x, y, () => { ctx.fillStyle = 'rgba(190,220,255,' + (full ? 0.4 : 0.95) + ')'; ctx.font = '700 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(full ? 'STOCKED' : 'RESTOCK', 0, 0); });
    ctx.restore();
  }
  const WB = MAP.bench;
  if (WB && !bench) {                                                // the workbench: amber (hidden while you're at it)
    const x = WB.x * T, y = WB.y * T, a = 0.45 + 0.25 * Math.sin(t * 2.5);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,190,90,' + a.toFixed(2) + ')'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(x, y, BENCH.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    upright(x, y, () => { ctx.fillStyle = 'rgba(255,225,170,0.95)'; ctx.font = '700 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WORKBENCH', 0, 0); });
    ctx.restore();
  }
  const LR = MAP.locker;
  if (LR && !bench) {                                                // the gear locker: olive
    const x = LR.x * T, y = LR.y * T, a = 0.45 + 0.25 * Math.sin(t * 2.5 + 1);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(170,210,120,' + a.toFixed(2) + ')'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(x, y, BENCH.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    upright(x, y, () => { ctx.fillStyle = 'rgba(215,240,180,0.95)'; ctx.font = '700 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GEAR LOCKER', 0, 0); });
    ctx.restore();
  }
  const PR = pcRing();
  if (PR && !bench) {                                                // the mission PC: blue
    const a = 0.45 + 0.25 * Math.sin(t * 2.5 + 2);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,180,255,' + a.toFixed(2) + ')'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(PR.x, PR.y, BENCH.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    upright(PR.x, PR.y, () => { ctx.fillStyle = 'rgba(190,220,255,0.95)'; ctx.font = '700 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MISSIONS', 0, 0); });
    ctx.restore();
  }
  if (!exitOpen()) return;
  const E = EXIT, pulse = 0.5 + 0.5 * Math.sin(t * 4), f = clamp(extractT / E.hold, 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(80,255,140,' + (0.08 + 0.06 * pulse).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(E.x, E.y, E.r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(90,255,150,' + (0.55 + 0.35 * pulse).toFixed(3) + ')'; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
  if (f > 0) { ctx.lineWidth = 5; ctx.strokeStyle = '#5aff96'; ctx.beginPath(); ctx.arc(E.x, E.y, E.r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
  upright(E.x, E.y, () => { ctx.fillStyle = 'rgba(200,255,220,0.95)'; ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(E.label, 0, 0); });
  ctx.restore();
}
function drawExtractHud(t) {
  if (!exitOpen() || !threatXf) return;
  const E = EXIT;
  if (bannerT < BANNER_T && !bench) {                              // where to go, for a few seconds (not over the workbench)
    const a = clamp(Math.min(bannerT * 3, (BANNER_T - bannerT) * 1.5), 0, 1);
    const by = VH * 0.12 + (bomb ? 40 : 0);                       // (below the bomb's countdown)
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,' + (0.45 * a).toFixed(2) + ')'; ctx.fillRect(VW / 2 - 210, by - 30, 420, 64);
    ctx.fillStyle = 'rgba(230,255,238,' + a.toFixed(2) + ')'; ctx.font = '700 28px ' + FONT; ctx.fillText(bomb ? 'BOMB DEFUSED' : E.title, VW / 2, by);
    ctx.font = '600 16px ' + FONT; ctx.fillText(MAP.id === 'house' ? 'Next: ' + opTitle(opNow()) + (coopLinked() ? '. Get in your cars together' : '. Get in your car to deploy') : bomb ? '+' + BOMB.medals + ' medals. Get back in your car' : E.sub, VW / 2, by + 24);
  }
  if (MAP.id === 'house') return;                                    // at home you know where your car is: no arrow
  const M = threatXf, P0 = M.transformPoint(new DOMPoint(p.x, p.y)), Q = M.transformPoint(new DOMPoint(E.x, E.y));
  const px = P0.x / DPR, py = P0.y / DPR, qx = Q.x / DPR, qy = Q.y / DPR, m = 40;
  if (qx > m && qx < VW - m && qy > m && qy < VH - m) return;      // on screen: the ring shows itself
  let dx = qx - px, dy = qy - py; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  const tx = dx > 0 ? (VW - m - px) / dx : dx < 0 ? (m - px) / dx : Infinity, ty = dy > 0 ? (VH - m - py) / dy : dy < 0 ? (m - py) / dy : Infinity, k = Math.min(tx, ty);
  ctx.save(); ctx.translate(px + dx * k, py + dy * k); ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = 'rgba(90,255,150,0.9)'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-6, -12); ctx.lineTo(-1, 0); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(px + dx * (k - 26), py + dy * (k - 26)); ctx.fillStyle = 'rgba(200,255,220,0.9)'; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(E.label + ' ' + Math.round(dl / S / zoom / T * 0.9) + 'm', 0, 0); ctx.restore();
}
