/* ================= GRENADES =================
   M84 stun grenades and Mk3A2 concussion grenades (bought at the gear locker, carried in pouches: `p.nades`). Pick one
   from the weapon picker (hold reload): the rifle drops on its sling and your right hand pulls it from the pouch
   (`p.nade`: draw → ready). The THROW button (where reload was; G on a keyboard) is press and hold: the left hand pulls
   the pin, the throwing arm cocks back further the longer you hold (power, `pow`), and the arc it will fly shows on the
   floor. Let go and it's thrown (the spoon flies off and the fuze starts), then the rifle comes back up. Tap PUT AWAY
   (or R) to stow it instead.
   In flight (`nades`) it has height and tumbles; it bounces off walls, glass (breaking it), door slabs (shoving them),
   tall furniture, low furniture it's too low to clear, and people, then rolls to a stop. M84: a blinding flash and a
   deafening bang: anyone with eyes on it is blinded (you: a whiteout with the scene burnt in, bots: stunned, hands to
   their faces), anyone near enough deafened (you: everything muffled under a ringing). Mk3A2: a blast that kills close
   up (plates don't stop it), stuns and shoves further out, breaks glass, blows doors open, scatters furniture and leaves
   a scorch on the floor. Walls stop both (shut doors and windows let some through). */
const NADE = { draw: 0.45, stow: 0.42, wind: 1.0, throwT: 0.34, rel: 0.35, min: 0.18, vMin: 130, vMax: 470, vzMin: 110, vzMax: 220, z0: 62, g: 560,
  rest: 0.42, floor: 0.3, roll: 260, r: 2.2, low: 26, bodyZ: 80,
  m84: { fuze: 1.5, flash: 420, deaf: 520, blind: 4.5, stun: 5, light: 620 },
  mk3: { fuze: 3.2, kill: 80, down: 120, stun: 260, shove: 320, glass: 200, door: 160, light: 380 } };
const nades = [];
let blindT = 0, blindMax = 1, deafT = 0, blindImg = null;             // your whiteout (s), its burnt-in frame, your deafness (s)
function startNade(id) {
  if (state !== 'play' || !(p.nades[id] > 0) || p.melee || (p.nade && p.nade.ph !== 'stow')) return;
  if (reloading > 0 && !magDropped) reloading = 0;
  if (equip || (pickItem && pickT > 0)) cancelPickup();
  if (p.side.out || p.side.sw) p.side.want = null;                     // the Glock goes back in its holster first
  p.nade = { id, ph: p.side.out || p.side.sw ? 'wait' : 'draw', t: 0, pow: 0, pin: true };
}
const nadeHeld = () => p.nade && p.nade.ph !== 'stow';
function nadePress() { const N = p.nade; if (N && N.ph === 'ready') { N.ph = 'wind'; N.t = 0; N.pow = 0; } }
function nadeRelease() { const N = p.nade; if (N && N.ph === 'wind') { N.ph = 'throw'; N.t = 0; N.pow = Math.max(NADE.min, N.pow); } }
function nadeCancel() { const N = p.nade; if (N && N.ph !== 'throw' && N.ph !== 'stow') { N.ph = 'stow'; N.t = 0; if (!N.pin) benchSnd('nade_pin', 0.3); N.pin = true; } }
const nadeLocal = (lx, ly) => { const c = Math.cos(p.aim), s = Math.sin(p.aim), K = CHAR_SCALE; return [p.x + K * (lx * c - ly * s), p.y + K * (lx * s + ly * c)]; };
function nadeLaunch(N) {                                             // out of the hand: speed and lob by how long you held it
  const k = N.pow, a = p.aim, [hx, hy] = nadeLocal(16, 4), vh = NADE.vMin + (NADE.vMax - NADE.vMin) * k;
  const sx = clamp(hx, p.x - 20, p.x + 20), sy = clamp(hy, p.y - 20, p.y + 20), ok = losClear(p.x, p.y, sx, sy);
  nades.push({ id: N.id, x: ok ? sx : p.x, y: ok ? sy : p.y, z: NADE.z0, vx: Math.cos(a) * vh + (p.vx || 0) * 0.5, vy: Math.sin(a) * vh + (p.vy || 0) * 0.5, vz: NADE.vzMin + (NADE.vzMax - NADE.vzMin) * k,
    a, av: (Math.random() - 0.5) * 8, tb: 0, tv: 9 + 9 * k, fuze: NADE[N.id].fuze, owner: p, t: 0, rest: false, sndT: 0 });
  nades.push({ spoon: true, x: ok ? sx : p.x, y: ok ? sy : p.y, z: NADE.z0, vx: -Math.sin(a) * 60 + (Math.random() - 0.5) * 40, vy: Math.cos(a) * 60 + (Math.random() - 0.5) * 40, vz: 140, a: 0, av: 20, tb: 0, tv: 30, t: 0, rest: false, sndT: 0 });
  const v = sndAt(hx, hy, 0.35, 400, 0.8, 0.2); if (v) sndPlay(v, 'nade_spoon', 1, rv(0.1));
  p.nades[N.id]--; makeNoise(p.x, p.y, 90);
}
function nadeStep(dt) {                                              // your hands
  const N = p.nade;
  if (!N) return;
  if (state !== 'play') { p.nade = null; return; }
  N.t += dt;
  if (N.ph === 'wait') { if (!p.side.out && !p.side.sw) { N.ph = 'draw'; N.t = 0; } return; }
  if (N.ph === 'draw' && N.t >= NADE.draw) { N.ph = 'ready'; N.t = 0; sfxGear(p, 'mag', 0, 0.6, false); }
  else if (N.ph === 'wind') {
    if (N.pin && N.t >= 0.12) { N.pin = false; const v = sndAt(p.x, p.y, 0.4, 350, 0.5, 0.2); if (v) sndPlay(v, 'nade_pin', 1, rv(0.08)); }
    N.pow = Math.min(1, N.t / NADE.wind);
  } else if (N.ph === 'throw') {
    if (!N.gone && N.t >= NADE.throwT * NADE.rel) { N.gone = true; nadeLaunch(N); }
    if (N.t >= NADE.throwT) { N.ph = 'stow'; N.t = 0; N.thrown = true; }
  } else if (N.ph === 'stow' && N.t >= NADE.stow) p.nade = null;
}
function nadePose() {
  const N = p.nade;
  if (!N || N.ph === 'wait') return null;
  const f = N.ph === 'draw' ? N.t / NADE.draw : N.ph === 'throw' ? N.t / NADE.throwT : N.ph === 'stow' ? N.t / NADE.stow : 0;
  return { id: N.id, ph: N.ph, f: clamp(f, 0, 1), pow: N.pow, pin: N.pin, thrown: !!N.thrown, wt: N.ph === 'wind' ? N.t : 0 };
}
/* Where it'll fly: the same physics, run ahead (for the arc shown while you wind up). */
function nadePredict(pow) {
  const a = p.aim, vh = NADE.vMin + (NADE.vMax - NADE.vMin) * pow, [hx, hy] = nadeLocal(16, 4);
  const g = { x: hx, y: hy, z: NADE.z0, vx: Math.cos(a) * vh, vy: Math.sin(a) * vh, vz: NADE.vzMin + (NADE.vzMax - NADE.vzMin) * pow, tb: 0, tv: 0, a, av: 0, t: 0, ghost: true };
  const pts = [[g.x, g.y]];
  for (let i = 0; i < 150 && !g.rest; i++) { nadeMove(g, 1 / 60); if (i % 3 === 0) pts.push([g.x, g.y]); }
  pts.push([g.x, g.y]);
  return pts;
}
const nadeSolid = (x, y, z) => {                                     // does a grenade at height z hit something at (x, y)?
  const i = Math.floor(x / T), j = Math.floor(y / T);
  if (i < 0 || j < 0 || i >= W || j >= H) return 'wall';
  const k = j * W + i, sc = solidAt[k];
  if (sc === 'G' || sc === 'g') return z > 18 && !paneIntactAt(k, x, y) ? null : (sc === 'G' && z > 18 ? 'glass' : 'wall');   // a window: through the opening above the sill, unless there's glass
  if (doorAt[k] >= 0) return null;                                    // doorways: the slabs decide
  if (grid[k]) return 'wall';
  for (const f of pieces) {
    if (f.broken || x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) continue;
    if (TALL.has(f.c) || z < NADE.low || f.c === 'c' || f.c === 'y') return f;
  }
  return null;
};
function paneIntactAt(k, x, y) { const sg = glassSeg.get(k); if (!sg) return solidAt[k] === 'G'; const q = clamp(Math.floor((paneAcross(k) ? x - (k % W) * T : y - ((k / W) | 0) * T) / (T / GLASS_SEG)), 0, GLASS_SEG - 1); return !!sg[q]; }
function nadeBounceSnd(g, hard) {
  if (g.ghost || g.sndT > 0) return; g.sndT = 0.07;
  const v = sndAt(g.x, g.y, (g.spoon ? 0.25 : 0.55) * clamp(hard / 300, 0.25, 1), 600, 0.6, 0.3);
  if (v) sndPlay(v, g.spoon ? 'case_hard' : 'nade_bounce', 1, rv(0.1) * (g.spoon ? 1.4 : 1));
  if (!g.spoon) makeNoise(g.x, g.y, 120);
}
function nadeMove(g, dt) {                                           // one step: fall, bounce, roll; sub-stepped so it never tunnels
  const sp = Math.hypot(g.vx, g.vy), n = Math.max(1, Math.ceil(sp * dt / 3));
  for (let s = 0; s < n; s++) {
    const h = dt / n;
    if (!g.rest) {
      if (g.z > 0 || g.vz > 0) { g.vz -= NADE.g * h; g.z += g.vz * h; }
      if (g.z <= 0) {
        g.z = 0;
        if (g.vz < -45) { nadeBounceSnd(g, -g.vz); g.vz = -g.vz * NADE.floor; g.vx *= 0.62; g.vy *= 0.62; const r = (Math.random() - 0.5) * 0.5, c = Math.cos(r), si = Math.sin(r); [g.vx, g.vy] = [g.vx * c - g.vy * si, g.vx * si + g.vy * c]; g.av *= 0.6; }
        else { g.vz = 0; const v = Math.hypot(g.vx, g.vy), dv = NADE.roll * h; if (v <= dv) { g.vx = g.vy = 0; g.rest = true; } else { g.vx -= g.vx / v * dv; g.vy -= g.vy / v * dv; } }   // rolling to a stop
      }
    }
    if (g.rest) break;
    const nx = g.x + g.vx * h, ny = g.y + g.vy * h;
    let hitX = nadeSolid(nx, g.y, g.z), hitY = nadeSolid(g.x, ny, g.z);
    const glassHit = q => { if (q !== 'glass' || g.ghost) return false; const k = Math.floor((q === hitX ? g.y : ny) / T) * W + Math.floor((q === hitX ? nx : g.x) / T); shatterWindow(k, { x: g.x, y: g.y, ux: g.vx / (sp || 1), uy: g.vy / (sp || 1) }, nx, ny); sfxHit('glass', nx, ny); g.vx *= 0.55; g.vy *= 0.55; return true; };
    if (glassHit(hitX)) hitX = null; if (glassHit(hitY)) hitY = null;
    const hard = Math.hypot(g.vx, g.vy);
    if (hitX) { g.vx = -g.vx * NADE.rest; g.vy *= 0.8; g.av = -g.av; nadeBounceSnd(g, hard); if (hitX.c) knockPiece(hitX, g); } else g.x = nx;
    if (hitY) { g.vy = -g.vy * NADE.rest; g.vx *= 0.8; g.av = -g.av; nadeBounceSnd(g, hard); if (hitY.c) knockPiece(hitY, g); } else g.y = ny;
    if (g.z < 90) for (const [ax, ay, ex, ey] of doorSegs) {         // a door slab: bounce off it and shove it
      const L2 = ex * ex + ey * ey, u = clamp(((g.x - ax) * ex + (g.y - ay) * ey) / L2, 0, 1), qx = ax + ex * u, qy = ay + ey * u, dx = g.x - qx, dy = g.y - qy, d = Math.hypot(dx, dy);
      if (d > NADE.r + DOOR.thick || d < 1e-6) continue;
      const nxn = dx / d, nyn = dy / d, vn = g.vx * nxn + g.vy * nyn;
      if (vn >= 0) continue;
      g.vx -= (1 + NADE.rest) * vn * nxn; g.vy -= (1 + NADE.rest) * vn * nyn; g.x = qx + nxn * (NADE.r + DOOR.thick + 0.5); g.y = qy + nyn * (NADE.r + DOOR.thick + 0.5);
      if (!g.ghost) { nadeBounceSnd(g, -vn); shoveDoorAt(qx, qy, -nxn * Math.abs(vn) * 0.004, -nyn * Math.abs(vn) * 0.004); }
    }
    if (!g.ghost && g.z < NADE.bodyZ) for (const c of [p].concat(bots, allies, civs)) {   // people: it bounces off them
      if (c.dead || c.gone || (c === g.owner && g.t < 0.25) || (c === p && state !== 'play')) continue;
      const dx = g.x - c.x, dy = g.y - c.y, d = Math.hypot(dx, dy), R = (c.r || BODY_R) + NADE.r;
      if (d >= R || d < 1e-6) continue;
      const nxn = dx / d, nyn = dy / d, vn = g.vx * nxn + g.vy * nyn;
      if (vn < 0) { g.vx -= (1 + 0.3) * vn * nxn; g.vy -= (1 + 0.3) * vn * nyn; nadeBounceSnd(g, -vn * 0.5); }
      g.x = c.x + nxn * R; g.y = c.y + nyn * R;
    }
  }
  const sp2 = Math.hypot(g.vx, g.vy);
  g.a += g.av * dt; g.av *= Math.pow(0.4, dt); if (g.z > 0) g.tb += g.tv * dt; else { g.tb += (Math.round(g.tb / Math.PI) * Math.PI - g.tb) * Math.min(1, dt * 12); g.a += sp2 * dt * 0.04; }
  g.t += dt; g.sndT -= dt;
}
function knockPiece(f, g) { if (!g.ghost && !f.fixed && f.mass < 2) { f.x += g.vx * 0.01; f.y += g.vy * 0.01; } }
function shoveDoorAt(x, y, fx, fy) {                                 // push the leaf nearest (x, y) by an impulse (fx, fy)
  for (const d of doors) {
    if (d.broken || x < d.rx0 - 60 || x > d.rx1 + 60 || y < d.ry0 - 60 || y > d.ry1 + 60) continue;
    for (const l of d.leaves) {
      const a = l.base + l.th, ca = Math.cos(a), sa = Math.sin(a), s = clamp((x - l.hx) * ca + (y - l.hy) * sa, 0, l.L);
      if (Math.hypot(l.hx + ca * s - x, l.hy + sa * s - y) > 12) continue;
      l.w += (fx * -sa + fy * ca) * s * 0.06;
    }
  }
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const g = nades[i];
    nadeMove(g, dt);
    if (g.spoon) { if (g.t > 30) nades.splice(i, 1); continue; }
    if (g.id === 'mk3' && g.t > 0.3) for (const b of bots) {          // a live grenade by their feet: they scramble away from it
      if (b.dead || b.stun > 0 || b.melee || Math.hypot(b.x - g.x, b.y - g.y) > 170 || !losClear(b.x, b.y, g.x, g.y)) continue;
      if (!b.evade || b.evade.t <= 0) b.evade = { x: g.x, y: g.y, t: 0.9 + Math.random() * 0.4 };
    }
    if ((g.fuze -= dt) <= 0) { nades.splice(i, 1); (g.id === 'm84' ? bangM84 : blastMk3)(g.x, g.y); }
  }
  blindT = Math.max(0, blindT - dt); deafT = Math.max(0, deafT - dt);
  if (sndDeafLP) { const k = clamp(deafT / 3, 0, 1); sndDeafLP.frequency.setTargetAtTime(20000 * Math.pow(0.025, k), AC.currentTime, 0.05); }
}
const nadeLos = (x, y, c) => lightCast(x, y, (c.x - x) / (Math.hypot(c.x - x, c.y - y) || 1), (c.y - y) / (Math.hypot(c.x - x, c.y - y) || 1), Math.hypot(c.x - x, c.y - y)) >= Math.hypot(c.x - x, c.y - y) - 2;
function bangM84(x, y) {                                             // the flash and the bang
  const M = NADE.m84;
  flashes.push({ x, y, t: 0.16, t0: 0.16, r: M.light, k: 1, col: [255, 255, 250] });
  for (let i = 0; i < 6; i++) puff(x, y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 4, 22 + Math.random() * 14, 2.2 + Math.random(), 0.32, 0, 3);
  lingerSmoke(x, y, SMOKE.linger.m84);
  const v = sndAt(x, y, 1.4, 3200, 2.2, 1); if (v) { sndPlay(v, 'nade_flash', 1, rv(0.04)); sndPlay(v, 'nade_flash', 0.7, rv(0.04) * 0.55, 0, 180); }
  alarms.push({ x, y, t: simT }); makeNoise(x, y, 1000);
  for (const c of [p].concat(bots, allies)) {
    if (c.dead || (c === p && state !== 'play')) continue;
    const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), los = nadeLos(x, y, c);
    const face = c === p ? p.aim : c.ang, look = clamp(0.3 + 0.7 * Math.cos(angDiff(Math.atan2(dy, dx), face)), 0.15, 1);   // looking at it: the full flash; away: some
    const blind = los && d < M.flash ? Math.sqrt(1 - d / M.flash) * look : 0, deaf = d < M.deaf ? (1 - d / M.deaf) * (los ? 1 : 0.45) : 0;
    if (c === p) {
      if (blind > 0.05) { const T0 = M.blind * blind * (nvgOn() ? NVG.blind : 1); if (T0 > blindT) { blindT = T0; blindMax = T0; grabBlindFrame(); } }
      if (deaf > 0.05) { deafT = Math.max(deafT, 6 * deaf); sfxRing(deaf); }
      addSupp(p, 0.6 * Math.max(blind, deaf)); tunnelHit(0.5 * Math.max(blind, deaf));
    } else if (blind > 0.05 || deaf > 0.3) {
      c.stun = Math.max(c.stun || 0, M.stun * Math.max(blind, deaf * 0.6)); c.stunAt = { x, y };
      if (!c.ally) { c.state = 'search'; c.path = []; }
    }
  }
}
function blastMk3(x, y) {                                            // the concussion
  const M = NADE.mk3;
  flashes.push({ x, y, t: 0.12, t0: 0.12, r: M.light, k: 1, col: [255, 190, 120] });
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, sp = 60 + Math.random() * 260; puff(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 5, 26 + Math.random() * 18, 2.6 + Math.random() * 1.5, 0.42, 1, 4); }
  lingerSmoke(x, y, SMOKE.linger.mk3);
  for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28; launchChunk(x, y, Math.cos(a), Math.sin(a), 120 + Math.random() * 260, chunkPts(1 + Math.random() * 1.4, 5), i % 3 ? '#1c1d1b' : '#55585a'); }   // bits of the fibre body
  const v = sndAt(x, y, 1.6, 4200, 2.6, 1.1); if (v) { sndPlay(v, 'nade_boom', 1, rv(0.05)); sndPlay(v, 'nade_boom', 0.8, rv(0.05) * 0.5, 0, 140); if (v.d > SND.far.from) sndPlay(v, 'far', 0.8 * clamp((v.d - SND.far.from) / (SND.far.full - SND.far.from), 0, 1), 0.7); }
  alarms.push({ x, y, t: simT }); makeNoise(x, y, 1200); camKick.v -= 30 * clamp(1 - Math.hypot(x - p.x, y - p.y) / 600, 0, 1);
  scorch(x, y);
  for (let j = Math.floor((y - M.glass) / T); j <= Math.floor((y + M.glass) / T); j++) for (let i = Math.floor((x - M.glass) / T); i <= Math.floor((x + M.glass) / T); i++) {   // windows nearby blow out
    if (i < 0 || j < 0 || i >= W || j >= H || solidAt[j * W + i] !== 'G') continue;
    const cx = (i + 0.5) * T, cy = (j + 0.5) * T, d = Math.hypot(cx - x, cy - y);
    if (d > M.glass) continue;
    const k = j * W + i, ux = (cx - x) / (d || 1), uy = (cy - y) / (d || 1), ac = paneAcross(k);
    for (let n = 0; n < GLASS_SEG; n++) { const u = (n + 0.5) * T / GLASS_SEG, qx = ac ? i * T + u : cx, qy = ac ? cy : j * T + u; if (paneIntactAt(k, qx, qy)) shatterWindow(k, { x: qx - ux * 6, y: qy - uy * 6, ux, uy }, qx, qy); }
    sfxHit('glass', cx, cy);
  }
  for (const d of doors) if (!d.broken) for (const l of d.leaves) {    // doors blown open
    const mx = l.hx + Math.cos(l.base + l.th) * l.L / 2, my = l.hy + Math.sin(l.base + l.th) * l.L / 2, dd = Math.hypot(mx - x, my - y);
    if (dd < M.door) shoveDoorAt(mx, my, (mx - x) / (dd || 1) * 3 * (1 - dd / M.door), (my - y) / (dd || 1) * 3 * (1 - dd / M.door));
  }
  for (const f of pieces) {                                            // furniture shoved and knocked about
    if (f.broken) continue;
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2, d = Math.hypot(cx - x, cy - y);
    if (d > M.down) continue;
    const ux = (cx - x) / (d || 1), uy = (cy - y) / (d || 1);
    if (d < M.kill) damagePiece(f, 60 * (1 - d / M.kill), cx - ux * f.w / 2, cy - uy * f.h / 2, ux, uy);
    if (!f.fixed && f.mass < 2) { const sh = (1 - d / M.down) * 26 / Math.max(0.5, f.mass); f.x += ux * sh; f.y += uy * sh; occDirty = true; }
  }
  for (const c of [p].concat(bots, allies, civs)) {
    if (c.dead || c.gone || (c === p && state !== 'play')) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > M.stun) continue;
    const ux = (c.x - x) / (d || 1), uy = (c.y - y) / (d || 1), open = nadeLos(x, y, c), wl = open ? 1 : wallsBetween(x, y, c.x, c.y).n ? 0 : 0.4;   // through a solid wall: nothing; a shut door or window: some
    if (!wl) continue;
    const de = d / wl;
    if (de < M.kill) { blastKill(c, ux, uy); continue; }
    const k = clamp(1 - de / M.stun, 0, 1);
    moveCircle(c, ux * M.shove * k * 0.08, uy * M.shove * k * 0.08); addSupp(c, k);
    if (de < M.down && c.prot && c.prot.helmet > 0) c.prot.helmet = Math.max(0, c.prot.helmet - 20 * k);
    if (c === p) { tunnelHit(k); deafT = Math.max(deafT, 5 * k); sfxRing(k); arms.w += (Math.random() < 0.5 ? -1 : 1) * 6 * k; if (k > 0.3) { blindT = Math.max(blindT, 1.2 * k); blindMax = Math.max(blindT, blindMax); } }
    else { c.stun = Math.max(c.stun || 0, 4 * k); c.stunAt = { x, y }; }
  }
}
function blastKill(c, ux, uy) {                                      // overpressure: no plate stops it
  if (c === p ? state !== 'play' : c.dead) return;
  bleedHit(c, c.x - ux * 6, c.y - uy * 6, ux, uy); sfxVoice(c, 'die');
  const down = Math.random() < DOWN.chance;
  if (c === p) { endMelee(p); p.nade = null; state = down ? 'downed' : 'dead'; stateT = 0; startRagdoll(p, p.aim, PLAYER_LOOK, 0.3, ux * 2, uy * 2); if (down) playerDown(ux, uy); }
  else { c.lastHit = [ux * 2, uy * 2]; killBot(c, down); }
}
function scorch(x, y) {                                              // a blast mark burnt into the floor
  const g = artG, r = 34;
  const gr = g.createRadialGradient(x, y, 2, x, y, r);
  gr.addColorStop(0, 'rgba(12,10,8,0.7)'); gr.addColorStop(0.5, 'rgba(18,15,12,0.38)'); gr.addColorStop(1, 'rgba(20,16,12,0)');
  g.fillStyle = gr; g.beginPath(); for (let a = 0; a < 6.3; a += 0.4) { const rr = r * (0.75 + Math.random() * 0.35); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
}
function grabBlindFrame() {                                          // the scene burnt into your eyes at the flash
  try { if (!blindImg) blindImg = document.createElement('canvas'); blindImg.width = cv.width; blindImg.height = cv.height; blindImg.getContext('2d').drawImage(cv, 0, 0); } catch (_) { blindImg = null; }
}
function sfxRing(k) {                                                // your ears ringing: straight into the mix, not muffled with the rest
  if (!AC || sndMuted || !sndBufs || !sndBufs.ring || !sndBufs.ring.length || !sndComp) return;
  const src = AC.createBufferSource(), gn = AC.createGain(); src.buffer = sndBufs.ring[0];
  const t = AC.currentTime; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.32 * k * SND.vol, t + 0.25); gn.gain.setTargetAtTime(0, t + 1 + 3 * k, 1.2);
  src.connect(gn); gn.connect(sndComp); src.start(t);
}
/* Drawing: grenades and spoons in the scene pass (under the darkness), with a floor shadow that drops away as they rise. */
function drawNades() {
  for (const g of nades) {
    if (!onView(g.x, g.y, 30)) continue;
    const sh = g.z * 0.25;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 / (1 + g.z / 60)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(g.x + sh * 0.6, g.y + sh, g.spoon ? 2 : 4, g.spoon ? 1 : 2.4, g.a, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a); const sc = 1 + g.z / 260; ctx.scale(sc, sc);
    if (g.spoon) { ctx.fillStyle = '#8b8f80'; ctx.fillRect(-2, -0.35, 4 * (0.4 + 0.6 * Math.abs(Math.cos(g.tb))), 0.7); }
    else drawNade(g.id, g.tb, 1, false, false);
    ctx.restore();
  }
}
/* While you wind up: the arc it'll fly, dotted on the floor, ending in a ring the size of what it'll do. */
function drawNadeArc(t) {
  const N = p.nade;
  if (!N || N.ph !== 'wind') return;
  const pts = nadePredict(Math.max(NADE.min, N.pow)), [lx, ly] = pts[pts.length - 1];
  ctx.save(); ctx.fillStyle = 'rgba(255,230,160,0.75)';
  for (let i = 1; i < pts.length - 1; i++) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 1.3, 0, Math.PI * 2); ctx.fill(); }
  const R = N.id === 'm84' ? 60 : NADE.mk3.kill, a = 0.45 + 0.25 * Math.sin(t * 8);
  ctx.strokeStyle = N.id === 'm84' ? 'rgba(220,235,255,' + a + ')' : 'rgba(255,140,90,' + a + ')'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}
/* Your eyes after a flash: white, the burnt-in frame fading through it. */
function drawBlind() {
  if (blindT <= 0) return;
  const k = blindT / Math.max(0.01, blindMax), white = clamp((blindT - 0.6) / 1.2, 0, 1);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (blindImg) { ctx.globalAlpha = clamp(k * 0.9, 0, 0.9); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(blindImg, 0, 0); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = Math.min(1, 0.15 + white); ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.restore();
}
/* The holster swings on a spring: sideways acceleration of the body, footsteps, and busy hands all shake it. */
function holsterStep(c, dt, aim, busy, move) {
  const h = c.hol, vx = c.vx || 0, vy = c.vy || 0, ax = (vx - h.pvx) / Math.max(dt, 1e-3), ay = (vy - h.pvy) / Math.max(dt, 1e-3);
  h.pvx = vx; h.pvy = vy;
  const lat = -Math.sin(aim) * ax + Math.cos(aim) * ay, fwd = Math.cos(aim) * ax + Math.sin(aim) * ay;
  if (busy && Math.random() < dt * 6) h.v += (Math.random() - 0.5) * HOL.busy;
  if ((h.step = (h.step || 0) + Math.hypot(vx, vy) * dt) > STEP_LEN) { h.step = 0; h.v += (Math.random() < 0.5 ? -1 : 1) * HOL.step * move; }
  h.v += (-HOL.k * h.a - HOL.c * h.v - lat * HOL.acc * 60 - fwd * HOL.acc * 25) * dt;
  h.a = clamp(h.a + h.v * dt, -HOL.max, HOL.max);
}
/* Drop-leg holster on the strong-side hip, swinging on its spring; the Glock's grip and slide stick out of it. */
function drawHolster(L, sgn, a, bob, full) {
  ctx.save(); ctx.translate(-2.5 + bob * 0.4, 12.2 * sgn); ctx.rotate(a * sgn);
  ctx.strokeStyle = L.carrierDark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, 1.2 * sgn); ctx.moveTo(-5, 0); ctx.lineTo(-6.5, 1.4 * sgn); ctx.stroke();   // leg straps
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(-11.5, -2.4 + 0.6 * sgn, 13, 5.4, 2); ctx.fill();
  ctx.fillStyle = '#1b1c1f'; rrPath(-11, -2.6, 12.5, 5.2, 2); ctx.fill();          // kydex shell
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-10, -2.2, 9.5, 0.8);
  if (full) {                                                                      // the Glock seated in it: grip and the back of the slide
    ctx.fillStyle = '#232427'; rrPath(-1.5, -1.9, 4.2, 3.8, 1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; for (let q = -1; q <= 2; q += 1.2) ctx.fillRect(q, -1.5, 0.4, 3);   // grip texture
    ctx.fillStyle = '#2e2f33'; ctx.fillRect(1.5, -1.3, 1.6, 2.6);
  } else { ctx.fillStyle = '#060607'; rrPath(-1, -1.6, 2.6, 3.2, 1); ctx.fill(); }  // empty: the open mouth of the holster
  ctx.restore();
}
/* A Glock 17 from above, grip at the origin, muzzle along +x: slide with rear serrations, ejection port, sights. */
function drawGlock(flash, A) {                                  // A: attachments (a unit is ~14 mm): rail light or laser under the dust cover, RMR on the slide
  A = A || {};
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(-2.8, -1.1, 14, 3, 1); ctx.fill();
  if (A.light || A.laser) {                                  // a touch wider than the slide, so its sides show; X300U-A 91 mm, CMR-201 about 50
    const light = A.light, x0 = light ? 4.6 : 6.8, len = light ? 6.4 : 3.6, w = light ? 3.6 : 3.2;
    const lg = ctx.createLinearGradient(0, -w / 2, 0, w / 2); lg.addColorStop(0, '#45474c'); lg.addColorStop(0.5, '#1b1c1f'); lg.addColorStop(1, '#0e0f10');
    ctx.fillStyle = lg; rrPath(x0, -w / 2, len, w, 0.6); ctx.fill();
    if (light) { ctx.fillStyle = '#2a2b2f'; rrPath(x0 + len - 0.7, -w / 2 - 0.1, 0.8, w + 0.2, 0.3); ctx.fill(); ctx.fillStyle = 'rgba(230,240,255,0.5)'; ctx.fillRect(x0 + len, -1.1, 0.18, 2.2); }   // bezel and lens
    else { ctx.fillStyle = '#c0281e'; ctx.fillRect(x0 + len - 0.2, -0.45, 0.25, 0.9); }
  }
  const g = ctx.createLinearGradient(0, -1.4, 0, 1.4); g.addColorStop(0, '#3a3b40'); g.addColorStop(0.5, '#1d1e21'); g.addColorStop(1, '#121315');
  ctx.fillStyle = g; rrPath(-2.6, -1.35, 13.1, 2.7, 0.8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.25; for (let q = -2; q < 0.4; q += 0.6) { ctx.beginPath(); ctx.moveTo(q, -1.2); ctx.lineTo(q, 1.2); ctx.stroke(); }   // slide serrations
  ctx.fillStyle = '#0c0c0e'; ctx.fillRect(2.2, -0.2, 3.2, 1.1);                    // ejection port
  ctx.fillStyle = '#c9c4b0'; ctx.fillRect(-2.1, -0.18, 0.6, 0.36); ctx.fillRect(9.6, -0.15, 0.5, 0.3);   // rear and front sights
  ctx.fillStyle = '#0a0a0b'; ctx.beginPath(); ctx.arc(10.5, 0, 0.45, 0, Math.PI * 2); ctx.fill();   // the muzzle
  if (A.dot) {                                               // Trijicon RMR (46 x 30 mm) on the MOS plate, just ahead of the rear sight
    const rg = ctx.createLinearGradient(0, -1.05, 0, 1.05); rg.addColorStop(0, '#4a4c52'); rg.addColorStop(0.5, '#25262a'); rg.addColorStop(1, '#141517');
    ctx.fillStyle = rg; rrPath(-1.4, -1.05, 3.25, 2.1, 0.6); ctx.fill();
    ctx.fillStyle = 'rgba(120,150,190,0.5)'; ctx.fillRect(1.6, -0.75, 0.2, 1.5); ctx.fillStyle = 'rgba(255,70,60,0.55)'; ctx.fillRect(-1.3, -0.15, 0.25, 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-1.1, -0.95, 2.6, 0.3);
  }
  if (flash) { ctx.save(); ctx.translate(10.5, 0); ctx.scale(0.55, 0.55); drawMuzzleFlash(0); ctx.restore(); }
}

