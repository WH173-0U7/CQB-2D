function render(t) {
  refreshDoorSegs();
  if (edgesDirty) { edgesDirty = false; rebuildEdges(); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  const lm = LOOK.margin * S * zoom + 6, ay0 = VH * (ANCHOR_Y + (INSPECT.anchor - ANCHOR_Y) * inspect);   // you never leave the screen
  const ax = VW / 2 + clamp(look.x, lm - VW / 2, VW / 2 - lm) + (VW * BENCH.ax - VW / 2) * benchK, ay = ay0 + clamp(look.y, 0, Math.max(0, VH - lm - ay0)) + (VH * BENCH.ay - ay0) * benchK, sp = state === 'play' ? Math.max(p.supp || 0, p.tun || 0) : 0;
  // camera: player sits low on screen and the world rotates so "facing" is always up; recoil and suppression shake it
  const worldXf = () => {
    ctx.translate(ax, ay); ctx.rotate(-Math.PI / 2 - p.aim); ctx.scale(S * zoom, S * zoom); ctx.translate(-p.x, -p.y);
    ctx.translate(Math.cos(p.aim) * camKick.d + Math.sin(t * 37) * sp * SUPP_FX.shake, Math.sin(p.aim) * camKick.d + Math.cos(t * 29) * sp * SUPP_FX.shake);
  };
  const beamA = redAng;                              // the weapon light points where the rifle points
  const beam = {
    core: rayPoly(beamA - CONE_HALF * 0.5, beamA + CONE_HALF * 0.5, 60, viewR * 1.05),
    spill: rayPoly(beamA - CONE_HALF, beamA + CONE_HALF, 110, viewR),
    halo: rayPoly(beamA - CONE_HALF * 1.6, beamA + CONE_HALF * 1.6, 60, viewR * 0.45)
  };
  if (!hasLight(p)) { beam.eyes = lightPoly(p.x, p.y, SEE.darkView); beam.nvg = nvgOn() ? lightPoly(p.x, p.y, NVG.view) : null; }

  // ---- 1) the scene ----
  ctx.save(); worldXf();
  const WM = ctx.getTransform(); threatXf = WM;
  // only the part of the world that's on screen: the floor art is big, and the view is a small rotated window onto it
  const IM = WM.inverse(), cw = cv.width, ch = cv.height;
  let vx0 = Infinity, vy0 = Infinity, vx1 = -Infinity, vy1 = -Infinity;
  for (const [sx, sy] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) { const q = IM.transformPoint(new DOMPoint(sx, sy)); vx0 = Math.min(vx0, q.x); vy0 = Math.min(vy0, q.y); vx1 = Math.max(vx1, q.x); vy1 = Math.max(vy1, q.y); }
  vx0 = clamp(Math.floor(vx0) - 2, 0, W * T); vy0 = clamp(Math.floor(vy0) - 2, 0, H * T); vx1 = clamp(Math.ceil(vx1) + 2, 0, W * T); vy1 = clamp(Math.ceil(vy1) + 2, 0, H * T);
  const view = [vx0, vy0, vx1 - vx0, vy1 - vy0];
  VIEW.x0 = vx0; VIEW.y0 = vy0; VIEW.x1 = vx1; VIEW.y1 = vy1;
  const drawArt = () => { if (view[2] > 0 && view[3] > 0) ctx.drawImage(FLOOR_ART, view[0] * ART_RES, view[1] * ART_RES, view[2] * ART_RES, view[3] * ART_RES, view[0], view[1], view[2], view[3]); };
  drawArt();
  drawPieces();
  drawBenchParts(); drawLockerDoors();
  drawDoors();
  drawFixtures(false, t);
  drawItems(t);
  drawNades();
  for (const d of debris) if (onView(d.x, d.y, 12)) drawBit(ctx, d);
  drawMists();
  for (const q of pools) if (onView(q.x, q.y, q.r * 1.6 + 10)) drawPool(ctx, q);
  for (const rg of rags) if (onView(rg.pts[2].x, rg.pts[2].y, 90)) drawRagdoll(rg);
  if (state !== 'dead' && state !== 'downed') { const pc = p.cov || {}; contactShadow(p.x, p.y, Math.max(pickItem && pickT > 0 ? 1 : 0, (pc.duck || 0) * COVER.duck), [pc.px || 0, pc.py || 0]); }   // yours, on the floor under the darkness
  for (const b of bots) {                            // living bots (only while you can see them)
    if (b.dead || b.vis < 0.03 || !onView(b.x, b.y, 80)) continue;
    ctx.globalAlpha = b.vis;
    const bAng = b.ang + b.sway * ARMS.bodyFollow;
    drawChar(b.x, b.y, bAng, b.ang + b.sway, enemyLook(b), charPose(b, bAng, t, withGear({
      reload: b.reloadT > 0 ? 1 - b.reloadT / BOT.reload : -1, phase: b.anim.phase, walk: b.moveAmt,
      mvRel: angDiff(b.mvAng, bAng), rx: b.anim.rx, flash: b.muzzle > 0, att: b.att.ak, stun: b.stun > 0 ? 1 : 0, crouch: b.stun > 0 ? 0.5 : 0, knife: b.melee ? knifePose(b, bAng) : null, side: sidePose(b, b.anim.phase, b.moveAmt) }, b.grab && b.grab.it, b.grab ? clamp(b.grab.t / PICK_TIME[b.grab.it.kind], 0, 1) : 0, b.equip)));
    ctx.globalAlpha = 1;
  }
  for (const a of allies) {                          // your teammate
    if (a.relax) { a.x = a.seatX; a.y = a.seatY; if (a.cov) { a.cov.px = a.cov.py = a.cov.lean = a.cov.duck = 0; } }
    if (a.dead || a.vis < 0.03 || !onView(a.x, a.y, 80)) continue;
    ctx.globalAlpha = a.vis;
    const aAng = a.ang + a.sway * ARMS.bodyFollow;
    drawChar(a.x, a.y, aAng, a.ang + a.sway, ALLY_LOOK, charPose(a, aAng, t, {
      reload: a.reloadT > 0 ? 1 - a.reloadT / BOT.reload : -1, phase: a.anim.phase, walk: a.moveAmt,
      mvRel: angDiff(a.mvAng, aAng), rx: a.anim.rx, flash: a.muzzle > 0, knife: a.melee ? knifePose(a, aAng) : null, side: sidePose(a, a.anim.phase, a.moveAmt), sit: a.relax, relax: a.relax }));
    if (a.helmAt) { ctx.save(); ctx.translate(a.helmAt.x, a.helmAt.y); ctx.rotate(a.helmAt.a); ctx.scale(CHAR_SCALE, CHAR_SCALE); drawHelmet(ALLY_LOOK, null); ctx.restore(); }   // his helmet on the seat beside him
    ctx.globalAlpha = 1;
  }
  for (const c of civs) { if (c.dead || c.vis < 0.03 || !onView(c.x, c.y, 40)) continue; ctx.globalAlpha = c.vis; drawCiv(c, t); ctx.globalAlpha = 1; }
  drawSmoke(); drawTrails();
  ctx.restore();

  // ---- 2) darkness, carved away by every light ----
  const lights = gatherLights(t);
  frameLights = lights;
  const reach = Math.hypot(VW, VH) / (S * zoom), others = [];   // other characters' weapon lights, only where you can see
  for (const b of bots) {
    if (b.dead || b.dark || !hasLight(b) || Math.hypot(b.x - p.x, b.y - p.y) > reach + BOT.sight) continue;
    const bb = botBeam(b);
    others.push({ b, bb, spill: rayPoly(bb.a - CONE_HALF, bb.a + CONE_HALF, 36, bb.r, b.x, b.y), core: rayPoly(bb.a - CONE_HALF * 0.5, bb.a + CONE_HALF * 0.5, 20, bb.r * 1.05, b.x, b.y) });
  }
  beam.others = others;
  if (others.length) beam.view = lightPoly(p.x, p.y, reach);
  drawLightMap(WM, lights, beam);

  // ---- 3) glow and information over the dark ----
  ctx.save(); worldXf();
  glowLights(lights, beam);
  drawFixtures(true, t);
  drawExtract(t);
  ctx.save(); polyPath(beam.eyes || beam.spill); ctx.clip();      // edges caught by your light (or just seen, in the dark)
  ctx.lineWidth = 2.2; ctx.strokeStyle = hasLight(p) ? 'rgba(255,242,220,0.55)' : 'rgba(200,210,225,0.22)'; ctx.stroke(EDGES); strokeDoorEdges();
  ctx.restore();
  // red aiming cone
  const pg = p.gun || { ang: redAng, mx: p.x, my: p.y };
  const red = rayPoly(pg.ang - redHalf, pg.ang + redHalf, 22, redR, pg.mx, pg.my);   // from the muzzle, along the barrel
  let anyLock = false; for (const b of bots) if (b.locked) anyLock = true;
  polyPath(red);
  let g = ctx.createRadialGradient(pg.mx, pg.my, 2, pg.mx, pg.my, redR);
  if (p.blocked) { g.addColorStop(0, 'rgba(120,170,230,0.12)'); g.addColorStop(1, 'rgba(120,170,230,0.4)'); }   // a friend in the way: blue, and holding fire
  else {
    g.addColorStop(0, anyLock ? 'rgba(255,60,70,0.22)' : 'rgba(255,60,70,0.10)');
    g.addColorStop(1, anyLock ? 'rgba(255,60,70,0.55)' : 'rgba(255,60,70,0.34)');
  }
  if (state !== 'downed' && state !== 'dead' && !p.nade) { ctx.globalAlpha = (reloading > 0 || gearBusy() ? 0.3 : 1) * (1 - benchK); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1; }   // no cone once you're down, or at the workbench
  if (soundVis()) drawSound();                     // sound rings: only in the visual-sound mode (muted); otherwise you listen
  for (const b of bots) {                            // labels on bots you can make out
    if (b.dead || !(b.know > 0.03)) continue;
    ctx.globalAlpha = b.know;
    upright(b.x, b.y, () => {
      ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,80,90,0.85)';
      ctx.fillText('BOT', 0, 36);
      if (b.alertT > 0) { ctx.font = '700 28px ' + FONT; ctx.fillStyle = '#ffd24a'; ctx.fillText('!', 0, -46); }
    });
    ctx.globalAlpha = 1;
  }
  for (const c of civs) {                            // the officer out back: his tag, like your teammate's
    if (!c.officer || c.gone || c.dead || !onView(c.x, c.y, 60)) continue;
    ctx.globalAlpha = 0.45 + 0.5 * (c.vis || 0);
    upright(c.x, c.y, () => { ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(190,220,140,0.9)'; ctx.fillText('OFFICER', 0, 36);
      if (c.say && soundVis()) { ctx.globalAlpha = clamp(c.say.t / 0.6, 0, 1); ctx.font = 'italic 600 14px ' + FONT; ctx.fillStyle = 'rgba(235,240,225,0.95)'; ctx.fillText(c.say.txt, 0, -34); }   // what he says, as text while muted
    });
    ctx.globalAlpha = 1;
  }
  for (const a of allies) {                          // your teammate's tag, readable in the dark
    if (a.dead || !onView(a.x, a.y, 60)) continue;
    ctx.globalAlpha = 0.45 + 0.5 * a.vis;
    upright(a.x, a.y, () => { ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(120,190,255,0.9)'; ctx.fillText('ALLY', 0, 36); });
    ctx.globalAlpha = 1;
  }
  // tracers and sparks glow
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  drawLaser(t); drawBotLasers(t, beam); drawNadeArc(t); drawTvScreen(); drawPcScreen(t);
  for (const tr of tracers) {                       // thin, faint streaks: brighter at the head, fading to nothing at the tail
    const len = Math.hypot(tr.x1 - tr.x0, tr.y1 - tr.y0);
    if (len < 1 || (!onView(tr.x0, tr.y0, 4) && !onView(tr.x1, tr.y1, 4))) continue;
    const a = tr.t / TRACER.life, c = tr.own ? '255,238,205' : '255,200,165';
    const gr = ctx.createLinearGradient(tr.x0, tr.y0, tr.x1, tr.y1);
    gr.addColorStop(0, 'rgba(' + c + ',0)'); gr.addColorStop(1, 'rgba(' + c + ',' + (TRACER.alpha * a).toFixed(3) + ')');
    ctx.strokeStyle = gr; ctx.lineWidth = TRACER.width; ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
    ctx.globalAlpha = TRACER.glow * a; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;   // a faint glow round it
  }
  for (const sk of sparks) {
    const f = clamp(sk.life / sk.max, 0, 1);
    if (!onView(sk.x, sk.y, 20)) continue;
    ctx.globalAlpha = f;
    if (sk.ring) { ctx.strokeStyle = sk.col; ctx.lineWidth = 1.4 * f; ctx.beginPath(); ctx.arc(sk.x, sk.y, sk.ring * (1.15 - f), 0, Math.PI * 2); ctx.stroke(); continue; }
    if (sk.streak) { ctx.strokeStyle = sk.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sk.x, sk.y); ctx.lineTo(sk.x - sk.vx * 0.05, sk.y - sk.vy * 0.05); ctx.stroke(); continue; }
    if (sk.glint !== undefined) {                                    // a glass glint: a tiny star that twinkles
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(sk.glint + sk.life * 22)), r = 2.2 * tw;
      ctx.globalAlpha = f * tw; ctx.strokeStyle = sk.col; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(sk.x - r, sk.y); ctx.lineTo(sk.x + r, sk.y); ctx.moveTo(sk.x, sk.y - r); ctx.lineTo(sk.x, sk.y + r); ctx.stroke(); continue;
    }
    ctx.fillStyle = sk.col; ctx.beginPath(); ctx.arc(sk.x, sk.y, 2.4 * (0.5 + 0.5 * f), 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // you (always visible to yourself)
  if (state !== 'dead' && state !== 'downed') drawCharLit(p.x, p.y, p.aim + sway * ARMS.bodyFollow, redAng, PLAYER_LOOK, Object.assign(playerPose(t), { noShadow: true }), muzzle > 0);
  if ((pickItem && pickT > 0) || equip) {
    const k = equip ? equip.kind : pickItem.kind, tot = PICK_TIME[k] + EQUIP[k].T, f = clamp((equip ? PICK_TIME[k] + equip.t : pickT) / tot, 0, 1), R = 34;
    ctx.fillStyle = 'rgba(255,165,30,0.2)'; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,165,30,0.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = '#ffa51e';
    ctx.beginPath(); ctx.arc(p.x, p.y, R, p.aim, p.aim + f * Math.PI * 2); ctx.stroke();
  }
  for (const q of pops) {
    const f = 1 - q.life / q.max;
    upright(q.x, q.y, () => {
      ctx.globalAlpha = clamp(q.life / (q.max * 0.55), 0, 1);
      ctx.font = '700 16px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = q.col;
      ctx.fillText(q.txt, 0, -30 - f * 22);
      ctx.globalAlpha = 1;
    });
  }
  ctx.restore();
  if ((p.nvgK || 0) > 0.6 && state !== 'dead') drawNvgView(t, ax, ay);

  drawBlind();

  // ---- 4) suppression: the view blurs and tunnels in, pulsing with your heartbeat ----
  if (sp > 0.04) {
    const sv = Math.sqrt(sp);                                       // visual strength: one close crack already shows
    // Smooth blur on every browser: shrink the frame in halves (bilinear), then scale back up. Heavier suppression mixes
    // in the smallest level. Then the blur is masked to the edges, so you keep a sharp spot where you're looking (tunnel vision).
    if (!postLv) postLv = [2, 4, 8].map(d => { const c = document.createElement('canvas'), g = c.getContext('2d'); return { c, g, d }; });
    for (const L of postLv) {
      const w = Math.ceil(cv.width / L.d), h = Math.ceil(cv.height / L.d);
      if (L.c.width !== w || L.c.height !== h) { L.c.width = w; L.c.height = h; }
      L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalAlpha = 1; L.g.globalCompositeOperation = 'source-over'; L.g.imageSmoothingEnabled = true; L.g.imageSmoothingQuality = 'low';   // plain bilinear is enough when halving
    }
    const [H2, H4, H8] = postLv;
    H2.g.drawImage(cv, 0, 0, H2.c.width, H2.c.height);
    H4.g.drawImage(H2.c, 0, 0, H4.c.width, H4.c.height);
    H8.g.drawImage(H4.c, 0, 0, H8.c.width, H8.c.height);
    H4.g.globalAlpha = clamp((sv - 0.3) / 0.4, 0, 1); H4.g.drawImage(H8.c, 0, 0, H4.c.width, H4.c.height); H4.g.globalAlpha = 1;   // heavier: blurrier
    H2.g.drawImage(H4.c, 0, 0, H2.c.width, H2.c.height);
    const fx = ax * DPR / 2, fy = (ay - VH * SUPP_FX.ahead) * DPR / 2, sd = DPR / 2;          // tunnel centre: a little ahead of you
    const clearR = Math.min(VW, VH) * (SUPP_FX.clear0 - SUPP_FX.clear1 * sv) * sd, edgeR = Math.hypot(VW, VH) * 0.6 * sd;
    const mask = H2.g.createRadialGradient(fx, fy, clearR, fx, fy, edgeR);
    mask.addColorStop(0, 'rgba(0,0,0,' + (SUPP_FX.centre * sv).toFixed(3) + ')'); mask.addColorStop(1, 'rgba(0,0,0,1)');
    H2.g.globalCompositeOperation = 'destination-in'; H2.g.fillStyle = mask; H2.g.fillRect(0, 0, H2.c.width, H2.c.height); H2.g.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    ctx.globalAlpha = Math.min(1, 0.45 + sv); ctx.drawImage(H2.c, 0, 0, cv.width, cv.height);
    ctx.restore();
    // the dark closing in from the edges, pulsing with your heartbeat
    const hb = 0.5 + 0.5 * Math.sin(t * (6 + 6 * sp)), cy = ay - VH * SUPP_FX.ahead;
    const inner = Math.min(VW, VH) * (SUPP_FX.vigIn - 0.3 * sv), outer = Math.hypot(VW, VH) * SUPP_FX.vigOut;
    const vg = ctx.createRadialGradient(ax, cy, inner, ax, cy, outer);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.5, 'rgba(0,0,0,' + (0.5 * SUPP_FX.vig * sv).toFixed(3) + ')'); vg.addColorStop(1, 'rgba(0,0,0,' + Math.min(1, SUPP_FX.vig * sv * (0.88 + 0.12 * hb)).toFixed(3) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }

  /* ---------- HUD (screen space) ---------- */
  const aliveBots = bots.reduce((n, b) => n + (b.dead ? 0 : 1), 0);
  ctx.textAlign = 'left'; ctx.fillStyle = '#bcd3f2'; ctx.font = '600 22px ' + FONT;
  if (MAP.bots.length) {                                           // no headcount where there's no enemy
    ctx.fillText('ALIVE', 18, 32);
    const aw = ctx.measureText('ALIVE').width;
    pin(18 + aw + 22, 24, '#e5222f', aliveBots);
    pin(18 + aw + 92, 24, '#3fd13a', (state === 'play' ? 1 : 0) + allies.reduce((n, a) => n + (a.dead ? 0 : 1), 0));   // your side: you and your teammate
  }

  drawMoveStick(sticks.move, VW * 0.15, VH * 0.68);
  drawTurnPad(sticks.aim, VW * 0.7, VH * 0.45);
  drawReloadBtn(); drawSwap();
  drawThreats();
  drawExtractHud(t);
  drawRescueHud();
  { const mb = muteBtn();                                          // sound on/off
    ctx.save(); ctx.translate(mb.x, mb.y); ctx.globalAlpha = 0.75; ctx.fillStyle = ctx.strokeStyle = '#bcd3f2'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(-4, -4); ctx.lineTo(2, -10); ctx.lineTo(2, 10); ctx.lineTo(-4, 4); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    if (sndMuted) { ctx.moveTo(6, -5); ctx.lineTo(14, 5); ctx.moveTo(14, -5); ctx.lineTo(6, 5); }
    else { ctx.arc(3, 0, 6, -0.8, 0.8); ctx.moveTo(3 + 11 * Math.cos(-0.8), 11 * Math.sin(-0.8)); ctx.arc(3, 0, 11, -0.8, 0.8); }
    ctx.stroke(); ctx.restore(); }
  if (!bench) { const cb = creditsBtn();                           // credits ("i")
    ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = ctx.fillStyle = '#bcd3f2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cb.x, cb.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 13px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('i', cb.x, cb.y + 1); ctx.restore(); }
  if (nvgBtnShown()) { const nb = nvgBtn(), on = p.nvgK > 0.5;          // night vision: flip it up or down
    ctx.save(); ctx.globalAlpha = 0.8; ctx.strokeStyle = on ? '#d6e8ff' : 'rgba(188,211,242,0.6)'; ctx.fillStyle = on ? 'rgba(200,225,255,0.18)' : 'rgba(0,0,0,0)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(nb.x, nb.y, nb.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.font = '700 9px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NVG', nb.x, nb.y + 1); ctx.restore(); }
  if (!bench) { const sb = setBtn();                               // settings (a gear)
    ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = '#bcd3f2'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.translate(sb.x, sb.y);
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  if (BUILD) { ctx.save(); ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';   // the beta's build tag
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(BUILD, 19, 57); ctx.fillStyle = 'rgba(255,190,80,0.8)'; ctx.fillText(BUILD, 18, 56); ctx.restore(); }
  drawBench(t);                                                    // the workbench menu covers everything
  drawCredits(); drawSettings();

  // damage vignette
  if (hitFlash > 0) {
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.hypot(VW, VH) / 2);
    vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, 'rgba(255,30,30,' + (hitFlash * 1.4).toFixed(3) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }

  if (state === 'downed') {                                        // bleeding out: the edges close in, darker as it goes
    const rg = rags.find(q => q.c === p), f = rg && rg.alive ? clamp(rg.alive.t / rg.alive.life, 0, 1) : 1, hb = 0.5 + 0.5 * Math.sin(t * (4 - 2 * f));
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * (0.45 - 0.3 * f), VW / 2, VH / 2, Math.hypot(VW, VH) / 2);
    vg.addColorStop(0, 'rgba(40,0,0,0)'); vg.addColorStop(1, 'rgba(30,0,0,' + (0.55 + 0.4 * f + 0.05 * hb).toFixed(3) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center'; ctx.font = '700 26px ' + FONT; ctx.fillStyle = 'rgba(230,120,120,' + (0.6 + 0.3 * hb).toFixed(2) + ')';
    ctx.fillText('BLEEDING OUT', VW / 2, VH * 0.2);
  } else if (state !== 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e6f0ff'; ctx.font = '700 54px ' + FONT;
    ctx.fillText(state === 'clear' ? 'AREA CLEAR' : state === 'dead' ? 'YOU DIED' : 'OUT OF AMMO', VW / 2, VH * 0.46);
    if (stateT > 0.8) {
      ctx.font = '600 22px ' + FONT; ctx.fillStyle = 'rgba(190,215,245,0.9)';
      ctx.fillText(isTouch ? 'TAP TO PLAY AGAIN' : 'CLICK OR PRESS ENTER TO PLAY AGAIN', VW / 2, VH * 0.46 + 44);
    }
  }
}

