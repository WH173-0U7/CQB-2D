/* ================= THE RIFLE IN THE WORLD =================
   The rifle is a real object: a barrel GUN.len long from the shoulder line. Walls, columns, crates, glass and door
   slabs stop it. Up close it's first pulled in (up to GUN.maxIn), then swung away from what it's touching (up to
   GUN.swing rad). Its tip shoves doors. Rounds, the red cone, smoke and the flash all start at the real muzzle and
   go where the barrel really points (`c.gun.ang`); swung far off (> GUN.noFire) it can't fire. */
const GUN = { len: 55, maxIn: 14, swing: 1.0, swingPer: 20, noFire: 0.3, ease: 14, tip: 2.5 };
const barrelBlock = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return true; const k = j * W + i, c = solidAt[k]; return c === '#' || c === 'E' || c === 'C' || c === 'X'; };   // windows: only the pane itself (paneReach); the sill is below the barrel
/* What else stops a barrel held at chest height: furniture taller than that (`TALL`; low things like tables, sofas,
   counters and cars pass under it) and the bodies of your own side and of bystanders (`BARREL_BODY` px round the centre;
   the downed and the dead lie below it). An enemy right in front of the muzzle doesn't push it aside: that's a shot.
   `who` is the one holding the gun. */
const TALL = new Set(['ward', 'shelf', 'fridge', 'cab', 'vend', 'rack', 'stall', 'shower', 'locker']), BARREL_BODY = 9;
function barrelReach(x, y, c, s, L, who) {
  let d = cast(x, y, c, s, L, barrelBlock);
  for (const f of pieces) {
    if (f.broken || !TALL.has(f.c) || f.x > x + L || f.x + f.w < x - L || f.y > y + L || f.y + f.h < y - L) continue;
    const t = segBox(x, y, c, s, d, f.x, f.y, f.w, f.h); if (t >= 0 && t < d) d = t;
  }
  const body = q => {
    if (!q || q === who || q.dead || q.gone) return;
    const ox = q.x - x, oy = q.y - y, t = ox * c + oy * s; if (t <= 0 || t - BARREL_BODY > d) return;
    const pd = Math.abs(ox * s - oy * c); if (pd >= BARREL_BODY) return;
    const tt = Math.max(0, t - Math.sqrt(BARREL_BODY * BARREL_BODY - pd * pd)); if (tt < d) d = tt;
  };
  const us = !who || who === p || who.ally;
  if (us) { if (state === 'play') body(p); for (const a of allies) body(a); }
  else for (const b of bots) body(b);
  for (const cv of civs) body(cv);
  d = Math.min(d, paneReach(x, y, c, s, d));                   // glass still in a window stops it; a shot-out pane lets it through
  for (const dr of doors) {
    if (dr.broken || x < dr.rx0 - 80 || x > dr.rx1 + 80 || y < dr.ry0 - 80 || y > dr.ry1 + 80) continue;
    for (const l of dr.leaves) {
      const a = l.base + l.th, ex = Math.cos(a) * l.L, ey = Math.sin(a) * l.L, den = c * ey - s * ex;
      if (Math.abs(den) < 1e-6) continue;
      const wx = l.hx - x, wy = l.hy - y, tt = (wx * ey - wy * ex) / den, uu = (wx * s - wy * c) / den;
      if (tt >= 0 && tt < d && uu >= 0 && uu <= 1) d = tt;
    }
  }
  return d;
}
function gunReach(c, ang, sh, dt, len, latK) {   // len / latK: a different gun in the hands (the Glock), else the rifle's
  const K = CHAR_SCALE, g = c.gun || (c.gun = { in: 0, sw: 0, sd: 1, ang, mx: c.x, my: c.y });
  const cv = c.cov || {}, lat = (latK || 4.2) * (sh === undefined ? 1 : sh) * K, L = (len || GUN.len) * K;
  // the shoulder where the drawn rifle sits: c.x/y already carry a peek; add the crouch hunch (forward) and the lean into a wall (sideways)
  const fwd = CROUCH.hunch * Math.min(1, (cv.duck || 0) * COVER.duck) * K, side = (cv.lean || 0) * K, ca = Math.cos(ang), sa = Math.sin(ang);
  const bx = c.x + ca * fwd - sa * (side + lat), by = c.y + sa * fwd + ca * (side + lat);
  const reach = a => barrelReach(bx, by, Math.cos(a), Math.sin(a), L + 2, c);
  const intr = Math.max(0, L + 2 - reach(ang));
  const tin = Math.min(intr, GUN.maxIn * K), tsw = Math.min(GUN.swing, (intr - tin) / (GUN.swingPer * K));
  if (g.sw < 0.05 && tsw > 0) g.sd = reach(ang + 0.6) >= reach(ang - 0.6) ? 1 : -1;   // swing toward the clearer side
  const e = Math.min(1, dt * GUN.ease);
  g.in += (tin - g.in) * e; g.sw += (tsw - g.sw) * e;
  g.ang = ang + g.sw * g.sd;
  const cs = Math.cos(g.ang), sn = Math.sin(g.ang), md = Math.max(4, Math.min(L - g.in, barrelReach(bx, by, cs, sn, L, c) - 1));
  g.mx = bx + cs * md; g.my = by + sn * md; g.bx = bx; g.by = by;
  pushDoors({ x: g.mx, y: g.my, r: GUN.tip }, c);                                   // the barrel shoves doors it touches
  return g;
}
const gunCanFire = c => !c.gun || c.gun.sw < GUN.noFire;
/* Friendly fire is on, so nobody shoots through a teammate: the first friend standing in the line of fire (out to `dist`,
   allowing for the scatter cone `half`) blocks the shot, unless a wall or shut door is in between. Returns that friend, or null. */
const allies = [];                                        // your squad (see ALLY); bots' friends are the other bots
const FF = { pad: 4, spread: 0.8, past: 30 };
function friendInLine(c, friends, dist, half) {
  const g = c.gun; if (!g) return null;
  const ux = Math.cos(g.ang), uy = Math.sin(g.ang);
  let wallD = -1;                                         // how far the bore runs before a wall stops the rounds (worked out once, only if needed)
  for (const f of friends) {
    if (f === c || f.dead) continue;
    const dx = f.x - g.mx, dy = f.y - g.my, s = dx * ux + dy * uy;
    if (s < -f.r || s > dist + FF.past) continue;
    if (Math.abs(dx * uy - dy * ux) >= f.r + FF.pad + Math.max(0, s) * Math.tan(half) * FF.spread) continue;
    if (wallD < 0) wallD = lightCast(g.mx, g.my, ux, uy, dist + FF.past);
    if (s - f.r > wallD || !losClear(g.mx, g.my, f.x, f.y)) continue;   // behind a wall (or a shut door): the rounds can't reach them
    return f;
  }
  return null;
}
/* A bot whose shot is blocked by a teammate holds fire and side-steps away from them to open the line. */
function clearLine(b, f, dt) {
  const ux = Math.cos(b.gun.ang), uy = Math.sin(b.gun.ang), side = (f.x - b.x) * uy - (f.y - b.y) * ux > 0 ? 1 : -1;
  moveChar(b, uy * side * BOT.searchSpeed * 0.6 * dt, -ux * side * BOT.searchSpeed * 0.6 * dt);
}
function moveChar(e, dx, dy) {
  moveCircle(e, dx, dy);
  pushPieces(e);
  pushDoors(e);
  bumpOut(e, p);
  for (const o of bots) bumpOut(e, o);
  for (const o of allies) bumpOut(e, o);
}

function driveBot(b, ux, uy, speed) {
  const sp = speed * dirSpeed(Math.atan2(uy, ux), b.ang) * (1 - (1 - COVER.duckSpeed) * ((b.cov && b.cov.duck) || 0));
  b.tvx = ux * sp; b.tvy = uy * sp;
}
function moveBot(b, dt) {
  b.vx = b.vx || 0; b.vy = b.vy || 0;
  accelToward(b, b.tvx || 0, b.tvy || 0, dt);
  const ox = b.x, oy = b.y;
  moveChar(b, b.vx * dt, b.vy * dt);
  keepActualSpeed(b, ox, oy, dt);
  b.lastMove = Math.hypot(b.x - ox, b.y - oy);
  b.tvx = 0; b.tvy = 0;                       // the AI has to keep asking to keep moving
}

function separateBots() {
  for (let i = 0; i < bots.length; i++) {
    const a = bots[i]; if (a.dead) continue;
    for (let j = i + 1; j < bots.length; j++) {
      const c = bots[j]; if (c.dead) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = BODY_R * 2;
      if (d > 0 && d < min) {
        const k = (min - d) / 2 / d;
        moveCircle(a, -dx * k, -dy * k); moveCircle(c, dx * k, dy * k);
      }
    }
    const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy), min = BODY_R * 2;
    if (d > 0 && d < min) { const k = (min - d) / d; moveCircle(a, dx * k, dy * k); }
  }
}

