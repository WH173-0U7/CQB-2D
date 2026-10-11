/* ================= BOMB THREAT =================
   A bomb threat mission (MAP.bomb, picked on the mission PC): gunmen have planted a bomb in the house on a timer
   (`BOMB.time` s, counting down from the moment you arrive, also while you're down). `setupBomb` (in resetGame) puts it
   on a reachable floor tile deep in the house, against a wall if it can, and posts the nearest gunman in that room to
   guard it. It beeps (a ping every second, faster under 30 s and 10 s), so you can find it by ear. Next to it, hold
   DEFUSE (a button by reload, or F): the rifle hangs aside (`defusing` is part of gearBusy), your hand works at it, and
   after `BOMB.defuse` s it's safe; let go and the progress waits for you, but a hit puts you back to the start
   (`bombHit`, from takeHit). Defused: `BOMB.medals` medals, and the car takes you home (the exit opens, `missionDone`).
   At zero it goes off (`bombGo`): a blast far bigger than a grenade's (`BOMB.blast`, through a wall at half strength,
   wrecking furniture and blowing nearby doors apart), with its effects in `BOMB.fx`: a white-hot fireball and a shockwave
   ring over the darkness (`booms`), a ring of dust, showers of embers, a screen flash and a quake that dies away
   (`boomFlash`, `quake`), a moment of slow motion, a charred blast mark with soot streaks (`bigScorch`), a deeper roll
   under the bang and debris raining down after it (`bomb.after`), and small fires left burning round it (`fires`) that
   flicker light over the room (`fireLight`) and smoke. The mission has failed: after `fx.failT` s (so you see it) state
   'failed', or dead if you were too close. */
const BOMB = { time: 240, defuse: 5, reach: 36, medals: 3, banner: 5,
  blast: { kill: 190, down: 260, stun: 560, shove: 420, glass: 420, door: 340, light: 900, wall: 0.5, noDown: true, big: 2.2, pieceDmg: 260, doorBreak: 0.6 },
  fx: { ball: 175, ballT: 1.1, ring: 620, ringT: 0.55, embers: 80, dust: 18, fires: 7, fireR: 2.4, fireT: [14, 26], quake: 15, quakeT: 2.4, flash: 0.9, failT: 2.6 } };
let bomb = null, defPtr = null, booms = [], fires = [], fireLight = null, quake = 0, boomFlash = 0;
const missionDone = () => MAP.bomb ? !!bomb && bomb.state === 'defused' : cleared;   // what the mission asks of you
const defusing = () => !!bomb && bomb.hold;
const restartOK = (wait = 0.8) => stateT > (bomb && bomb.state === 'blown' && state === 'dead' ? BOMB.fx.failT + wait : wait);   // the overlay (and a tap to restart) waits while the blast that killed you plays out
const defuseBtn = () => { const b = reloadBtn(); return { x: b.x - b.r - 58, y: b.y + 4, r: 34 }; };
function setupBomb() {
  bomb = null; defPtr = null; booms = []; fires = []; fireLight = null; quake = 0; boomFlash = 0;
  if (!MAP.bomb) return;
  const R = rng32((MAP.seed || 1) ^ 0xb0b), dist = new Int16Array(W * H).fill(-1), q = [];
  const si = Math.floor(SPAWN.x / T), sj = Math.floor(SPAWN.y / T);
  dist[sj * W + si] = 0; q.push(si, sj);
  for (let h = 0; h < q.length; h += 2) {                        // how far every floor tile is from where you come in
    const i = q[h], j = q[h + 1], d = dist[j * W + i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + dx, b = j + dy;
      if (navBlocked(a, b) || dist[b * W + a] >= 0) continue;
      dist[b * W + a] = d + 1; q.push(a, b);
    }
  }
  const inside = k => !isOut((k % W + 0.5) * T, (Math.floor(k / W) + 0.5) * T);
  let far = 0;
  for (let k = 0; k < W * H; k++) if (dist[k] > far && inside(k)) far = dist[k];   // the deepest you can get into the house
  const cands = [];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {   // inside, well into the house, not in a doorway or the hall
    const k = j * W + i;
    if (dist[k] < far * 0.55 || doorAt[k] >= 0 || !inside(k) || 'w'.includes(floorAt[k])) continue;
    const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => wall(i + dx, j + dy) && doorAt[(j + dy) * W + i + dx] < 0);
    cands.push({ i, j, w: walls.length ? 3 : 1, wall: walls[0] });
  }
  if (!cands.length) for (let k = 0; k < W * H; k++) if (dist[k] > far * 0.4 && inside(k)) cands.push({ i: k % W, j: Math.floor(k / W), w: 1 });
  if (!cands.length) return;
  let tot = cands.reduce((s, c) => s + c.w, 0) * R(), c = cands[0];
  for (const o of cands) if ((tot -= o.w) <= 0) { c = o; break; }
  const x = (c.i + 0.5 + (c.wall ? c.wall[0] * 0.28 : 0)) * T, y = (c.j + 0.5 + (c.wall ? c.wall[1] * 0.28 : 0)) * T;   // up against the wall
  bomb = { x, y, ang: c.wall ? Math.atan2(c.wall[1], c.wall[0]) : R() * 6.28, t: BOMB.time, def: 0, state: 'armed', beepT: 0.5, hold: false, near: false, t0: simT, hitT: -9 };
  const gd = new Int16Array(W * H).fill(-1), gq = [c.i, c.j]; gd[c.j * W + c.i] = 0;   // a guard: the nearest gunman, posted 2-3 tiles off it
  let spot = null;
  for (let h = 0; h < gq.length && !spot; h += 2) {
    const i = gq[h], j = gq[h + 1], d = gd[j * W + i];
    if (d >= 2 && floorAt[j * W + i] === floorAt[c.j * W + c.i] && doorAt[j * W + i] < 0) spot = [i, j];
    if (d < 4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + dx, b = j + dy; if (!navBlocked(a, b) && gd[b * W + a] < 0) { gd[b * W + a] = d + 1; gq.push(a, b); } }
  }
  const g = bots.filter(b => !b.dead).sort((u, v) => Math.hypot(u.x - x, u.y - y) - Math.hypot(v.x - x, v.y - y))[0];
  if (g && spot) {
    g.x = g.px = (spot[0] + 0.5) * T; g.y = g.py = (spot[1] + 0.5) * T; g.ang = Math.atan2(g.y - y, g.x - x); g.path = [];
    g.post = { x: g.x, y: g.y, t: 0, a: g.ang };
  }
}
function bombHit() { if (bomb && bomb.state === 'armed' && bomb.def > 0) { bomb.def = 0; bomb.hitT = simT; } }   // hit while working on it: start again
function bombSnd(key, g, rate, reach) { const v = sndAt(bomb.x, bomb.y, g, reach || 320, 0.5, 0.3); if (v) sndPlay(v, key, 1, rate || rv(0.05)); }
function bombStep(dt) {
  bombFx(dt);
  if (bomb && bomb.state === 'blown') {                             // the aftermath: debris coming down, then the mission's lost
    bomb.since += dt;
    for (const a of bomb.after) if (!a.done && bomb.since >= a.t) { a.done = true; const v = sndAt(a.x, a.y, 0.7, 700, 0.6, 0.6); if (v) sndPlay(v, a.k, 1, rv(0.1)); }
    if (state === 'play' && bomb.since > BOMB.fx.failT) { state = 'failed'; stateT = 0; }
  }
  if (!bomb || bomb.state !== 'armed') { if (bomb) bomb.hold = false; return; }
  if (state === 'play' || state === 'downed') bomb.t -= dt;
  if ((bomb.beepT -= dt) <= 0) { bomb.beepT = bomb.t > 30 ? 1 : bomb.t > 10 ? 0.5 : 0.25; bombSnd('nade_spoon', 0.55, 1.7, 360); }   // its beep: faster as it runs down
  const d = Math.hypot(p.x - bomb.x, p.y - bomb.y);
  bomb.near = state === 'play' && d < BOMB.reach && losClear(p.x, p.y, bomb.x, bomb.y);
  const busy = p.melee || p.nade || equip || reloading > 0 || p.side.sw;
  bomb.hold = bomb.near && !busy && (defPtr !== null || !!keys.KeyF);
  if (bomb.hold) {
    const f0 = bomb.def / BOMB.defuse; bomb.def += dt; const f = bomb.def / BOMB.defuse;
    for (const k of [0.15, 0.4, 0.65, 0.85]) if (f0 < k && f >= k) bombSnd('nade_pin', 0.45);   // the casing, then the wires, one by one
    if (f >= 1) {
      bomb.state = 'defused'; bomb.hold = false; bombSnd('r_in', 0.5); bombSnd('g_buckle', 0.4);
      prog.medals += BOMB.medals; saveProg(); bannerT = 0;                  // safe: the car's open (exitOpen) and the banner says so
    }
  }
  if (bomb.t <= 0) bombGo();
}
function bombGo() {                                              // too late
  bomb.state = 'blown'; bomb.hold = false; bomb.t = 0; bomb.since = 0;
  const M = BOMB.blast, F = BOMB.fx, x = bomb.x, y = bomb.y, d = Math.hypot(x - p.x, y - p.y), near = clamp(1 - d / 900, 0, 1), seen = losClear(p.x, p.y, x, y);
  bigScorch(x, y); burnMark(x, y, 1.4);                             // (under everything the blast throws about)
  blastMk3(x, y, M);
  flashes.push({ x, y, t: 0.5, t0: 0.5, r: M.light, k: 1, col: [255, 210, 150] });
  booms.push({ x, y, t: 0 });
  slowMo();                                                         // the moment it goes
  quake = F.quake * (0.3 + 0.7 * near); boomFlash = F.flash * (seen ? 0.45 + 0.55 * near : 0.3 * near);
  for (let i = 0; i < F.embers; i++) {                              // embers flung out
    const a = Math.random() * 6.28, v = 140 + Math.random() * 520;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 1.4, max: 1.9, streak: true, drag: 1.4 + Math.random(), col: ['#ffd27a', '#ff9a3a', '#ff6a2a', '#fff2c0'][i % 4] });
  }
  for (let i = 0; i < F.dust; i++) {                                // the shockwave's ring of dust
    const a = (i + Math.random() * 0.5) / F.dust * 6.28, v = 260 + Math.random() * 180;
    puff(x + Math.cos(a) * 24, y + Math.sin(a) * 24, Math.cos(a) * v, Math.sin(a) * v, 12, 20, 1.8 + Math.random() * 0.8, 0.22, 0.15, 3.2);
  }
  for (let n = 0; n < 40 && fires.length < F.fires; n++) {         // fires left burning round it
    const a = Math.random() * 6.28, r = (0.3 + Math.random() * 0.7) * F.fireR * T, fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r;
    if (hitsWall(fx, fy, 6) || !losClear(x, y, fx, fy)) continue;
    fires.push({ x: fx, y: fy, t: 0, T: F.fireT[0] + Math.random() * (F.fireT[1] - F.fireT[0]), s: Math.random() * 10, sz: 0.6 + Math.random() * 0.6, smokeT: Math.random() });
  }
  fireLight = { x, y, r: 280, col: [255, 150, 70], k: 0 };
  const v = sndAt(x, y, 1.8, 6000, 3.6, 1.2); if (v) sndPlay(v, 'nade_boom', 0.9, 0.55, 0.06, 240);   // a deeper roll under the bang
  bomb.after = [[0.45, 'glass'], [0.6, 'wood'], [0.75, 'concrete'], [0.95, 'drywall'], [1.2, 'wood'], [1.5, 'concrete'], [1.9, 'wood']]   // debris coming down
    .map(([t, k]) => ({ t, k, x: x + (Math.random() - 0.5) * 220, y: y + (Math.random() - 0.5) * 220 }));
}
/* The blast mark: a wide charred patch with soot thrown out along the floor in streaks (painted into the floor art). */
function bigScorch(x, y) {
  const g = artG, R = 92;
  for (let n = 0; n < 16; n++) {                                    // soot streaks
    const a = n / 16 * 6.28 + Math.random() * 0.3, L = R * (0.9 + Math.random() * 0.9), w = 6 + Math.random() * 8;
    const gr = g.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L); gr.addColorStop(0, 'rgba(14,11,9,0.55)'); gr.addColorStop(1, 'rgba(14,11,9,0)');
    g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  const gr = g.createRadialGradient(x, y, 4, x, y, R);
  gr.addColorStop(0, 'rgba(8,6,5,0.85)'); gr.addColorStop(0.45, 'rgba(14,11,9,0.6)'); gr.addColorStop(1, 'rgba(18,14,11,0)');
  g.fillStyle = gr; g.beginPath(); for (let a = 0; a < 6.3; a += 0.3) { const rr = R * (0.7 + Math.random() * 0.4); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
  for (let n = 0; n < 4; n++) { const a = Math.random() * 6.28; scorch(x + Math.cos(a) * 30, y + Math.sin(a) * 30); }
  g.lineCap = 'butt';
}
/* Every frame: the fireball and shockwave age, the quake and the flash die away, the fires burn down (smoking, flickering). */
function bombFx(dt) {
  quake = Math.max(0, quake - dt * BOMB.fx.quake / BOMB.fx.quakeT); boomFlash = Math.max(0, boomFlash - dt * 1.6);
  for (let i = booms.length - 1; i >= 0; i--) if ((booms[i].t += dt) > Math.max(BOMB.fx.ballT, BOMB.fx.ringT) + 0.2) booms.splice(i, 1);
  let heat = 0;
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i]; f.t += dt;
    if (f.t > f.T) { fires.splice(i, 1); continue; }
    const life = Math.min(1, f.t * 3) * Math.min(1, (f.T - f.t) / 4); heat += life * f.sz;
    if ((f.smokeT -= dt) <= 0) { f.smokeT = 1.2 + Math.random() * 0.5; puff(f.x + (Math.random() - 0.5) * 8, f.y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, 5 * f.sz, 5, 2.2 + Math.random() * 0.8, 0.16 * life, 0, 1.4); }   // (smoke is what costs: kept to a few puffs a fire)
    if (Math.random() < dt * 2 * life) sparks.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.6, max: 0.6, streak: true, drag: 2, col: '#ffb45a' });
  }
  if (fireLight) {                                                  // one light for the fires (its shape cached like a fixture's), flickering with them
    const t = simT, fl = 0.78 + 0.12 * Math.sin(t * 13.1) * Math.sin(t * 7.7) + 0.1 * Math.sin(t * 23.3);
    fireLight.k = Math.min(0.6, heat * 0.14) * fl;
    if (!fires.length) fireLight = null;
  }
}
/* The bomb: a holdall with pipes taped together, wires and a timer on top (scene pass, under the darkness). */
function drawBomb(t) {
  if (!bomb || !onView(bomb.x, bomb.y, 40)) return;
  if (bomb.state === 'blown') return;
  ctx.save(); ctx.translate(bomb.x, bomb.y); ctx.rotate(bomb.ang + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b3f33'; rrPath(-14, -9, 28, 19, 4); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();   // the holdall
  ctx.strokeStyle = '#2a2d24'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();                   // its zip
  for (const yy of [-5.5, -1, 3.5]) {                              // three pipes, taped
    const g = ctx.createLinearGradient(0, yy - 2, 0, yy + 2); g.addColorStop(0, '#9a9890'); g.addColorStop(0.5, '#6a6862'); g.addColorStop(1, '#45443f');
    ctx.fillStyle = g; rrPath(-11, yy - 2, 18, 4, 1.6); ctx.fill();
    ctx.fillStyle = '#5a5850'; ctx.fillRect(-11.5, yy - 2.2, 2, 4.4); ctx.fillRect(5.5, yy - 2.2, 2, 4.4);   // end caps
  }
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-4, -8, 3, 15); ctx.fillRect(2, -8, 3, 15);                            // the tape round them
  ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  for (const [col, y0, y1] of [['#c83a2a', -5.5, -3], ['#2a5ac8', -1, -1.5], ['#d8c02a', 3.5, 0]]) {   // wires to the timer
    if (bomb.cut && bomb.cut[col]) continue;
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(7, y0); ctx.quadraticCurveTo(10, y0 + 2, 9.5, y1); ctx.stroke();
  }
  ctx.fillStyle = '#16171a'; rrPath(7.5, -5, 7, 9, 1.2); ctx.fill();                                            // the timer
  ctx.fillStyle = '#300'; ctx.fillRect(8.4, -4, 5.2, 4);
  ctx.restore();
}
/* What glows: the timer's digits and its LED (over the darkness, so you can spot it in the dark); once it's gone off, the
   fireball, the shockwave and the fires. */
function drawBombGlow(t) {
  const F = BOMB.fx;
  for (const b of booms) {
    if (!onView(b.x, b.y, F.ring)) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (b.t < F.ringT) {                                            // the shockwave: a bright thin ring racing out, a fainter one behind it
      const u = b.t / F.ringT, r = F.ring * (1 - Math.pow(1 - u, 2.2)), a = (1 - u) * 0.55;
      ctx.lineWidth = 3 + 10 * (1 - u); ctx.strokeStyle = 'rgba(255,240,220,' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(255,200,150,' + (a * 0.25).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.86, 0, Math.PI * 2); ctx.stroke();
    }
    if (b.t < F.ballT) {                                            // the fireball: white-hot, swelling, cooling through orange to a dull red
      const u = b.t / F.ballT, r = F.ball * (0.35 + 0.65 * (1 - Math.pow(1 - Math.min(1, u * 2.5), 3))), a = Math.pow(1 - u, 1.4);
      const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      gr.addColorStop(0, 'rgba(255,255,240,' + a.toFixed(3) + ')'); gr.addColorStop(0.25, 'rgba(255,220,140,' + (a * 0.95).toFixed(3) + ')');
      gr.addColorStop(0.55, 'rgba(255,130,50,' + (a * 0.7).toFixed(3) + ')'); gr.addColorStop(0.85, 'rgba(160,40,20,' + (a * 0.35).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(80,20,10,0)');
      ctx.fillStyle = gr; ctx.beginPath();
      for (let q = 0; q <= 24; q++) { const ang = q / 24 * Math.PI * 2, rr = r * (0.85 + 0.15 * Math.sin(ang * 5 + b.x + u * 9) * Math.sin(ang * 3 - u * 7)); ctx.lineTo(b.x + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  for (const f of fires) {                                          // the fires: flickering tongues of flame
    if (!onView(f.x, f.y, 30)) continue;
    const life = Math.min(1, f.t * 3) * Math.min(1, (f.T - f.t) / 4), r = 9 * f.sz * life;
    if (r < 0.5) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 3; q++) {
      const ox = Math.sin(t * (9 + q * 3) + f.s + q) * r * 0.35, oy = Math.cos(t * (7 + q * 2) + f.s * 2) * r * 0.35, rr = r * (1 - q * 0.25) * (0.85 + 0.15 * Math.sin(t * 17 + f.s + q));
      const gr = ctx.createRadialGradient(f.x + ox, f.y + oy, 0, f.x + ox, f.y + oy, rr * 1.8);
      gr.addColorStop(0, q === 2 ? 'rgba(255,250,210,0.9)' : 'rgba(255,190,90,0.7)'); gr.addColorStop(0.5, 'rgba(255,110,40,0.45)'); gr.addColorStop(1, 'rgba(160,40,10,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x + ox, f.y + oy, rr * 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (!bomb || bomb.state === 'blown' || !onView(bomb.x, bomb.y, 40)) return;
  ctx.save(); ctx.translate(bomb.x, bomb.y); ctx.rotate(bomb.ang + Math.PI / 2); ctx.globalCompositeOperation = 'lighter';
  const armed = bomb.state === 'armed', blink = armed && (bomb.beepT < 0.08 || bomb.t < 10 && Math.sin(t * 30) > 0);
  ctx.fillStyle = armed ? 'rgba(255,60,40,0.95)' : 'rgba(80,255,120,0.8)'; ctx.font = '700 3.6px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(11, -2); ctx.rotate(Math.PI / 2); ctx.fillText(armed ? clockTxt(bomb.t) : '--:--', 0, 0); ctx.rotate(-Math.PI / 2); ctx.translate(-11, 2);
  if (blink) { const g = ctx.createRadialGradient(11, 3, 0, 11, 3, 14); g.addColorStop(0, 'rgba(255,40,30,0.7)'); g.addColorStop(1, 'rgba(255,40,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(11, 3, 14, 0, Math.PI * 2); ctx.fill(); }
  if (armed && bomb.def > 0) {                                      // how far along the defusing is
    ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(120,220,255,0.85)';
    ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, bomb.def / BOMB.defuse)); ctx.stroke();
  }
  ctx.restore();
}
const clockTxt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
/* HUD: the countdown at the top, the briefing on arrival, and DEFUSE by the reload button while you're at it. */
function drawBombHud(t) {
  if (!bomb) return;
  if (boomFlash > 0) { ctx.save(); ctx.fillStyle = 'rgba(255,244,225,' + Math.min(1, boomFlash).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }   // the flash
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const armed = bomb.state === 'armed', low = armed && bomb.t < 30, pulse = low ? 0.6 + 0.4 * Math.sin(t * (bomb.t < 10 ? 16 : 8)) : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrPath(VW / 2 - 64, 8, 128, 34, 8); ctx.fill();
  ctx.font = '700 26px ' + FONT; ctx.fillStyle = armed ? 'rgba(255,' + (low ? 70 : 120) + ',90,' + pulse.toFixed(2) + ')' : bomb.state === 'defused' ? 'rgba(120,235,150,0.95)' : 'rgba(255,120,90,0.95)';
  ctx.fillText(armed ? 'BOMB ' + clockTxt(bomb.t) : bomb.state === 'defused' ? 'DEFUSED' : 'BOOM', VW / 2, 26);
  const since = simT - bomb.t0;
  if (since < BOMB.banner && armed) {                              // the briefing
    const a = clamp(Math.min(since * 3, (BOMB.banner - since) * 1.5), 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.45 * a).toFixed(2) + ')'; ctx.fillRect(VW / 2 - 220, VH * 0.2 - 26, 440, 58);
    ctx.fillStyle = 'rgba(255,225,215,' + a.toFixed(2) + ')'; ctx.font = '700 26px ' + FONT; ctx.fillText('BOMB THREAT', VW / 2, VH * 0.2 - 4);
    ctx.font = '600 15px ' + FONT; ctx.fillText('Find the bomb and defuse it before it goes off. Listen for the beeps.', VW / 2, VH * 0.2 + 20);
  }
  if (armed && bomb.near) {                                        // DEFUSE: hold it
    const b = defuseBtn(), f = Math.min(1, bomb.def / BOMB.defuse), hit = simT - bomb.hitT < 1;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,220,255,0.75)'; ctx.fillStyle = bomb.hold ? 'rgba(40,90,120,0.6)' : 'rgba(20,30,40,0.55)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (f > 0) { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(140,235,255,0.95)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(225,245,255,0.95)'; ctx.font = '700 11px ' + FONT; ctx.fillText('DEFUSE', b.x, b.y - 5);
    ctx.font = '600 9px ' + FONT; ctx.fillText(hit ? 'HIT: START AGAIN' : bomb.hold ? Math.round(f * 100) + '%' : isTouch ? 'HOLD' : 'HOLD F', b.x, b.y + 8);
  }
  ctx.restore();
}
