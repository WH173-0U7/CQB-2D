/* ================= GUN SMOKE =================
   Each shot blasts a cloud of gas out of the muzzle (mostly forward, some kicked right by the AK's slant brake)
   and a wisp out of the ejection port. A hot barrel keeps smoking after sustained fire, leaving a thin trail
   from the muzzle wherever the rifle goes. Smoke is soft, billowing, drifts on a light draught, swells and
   thins out, stops at walls, and shows up properly where your light catches it. */
const smoke = [];
const TRAIL = { gap: 5, life: 1.6, w0: 1.8, grow: 9, a: 0.2, max: 80 };   // a hot barrel's smoke as one continuous ribbon: a point every `gap` px of muzzle travel, each lasting `life` s, widening by `grow` px/s
const trails = [];
const SMOKE = { max: 420, linger: { m84: [8, 9, 13], mk3: [12, 11, 16] }, drift: { x: 5, y: -3 }, heatPerShot: 1, cool: 1.2, wispFrom: 1.5 };
const SMOKE_SPRITES = makeSmokeSprites();
function makeSmokeSprites() {
  const out = [];
  for (let n = 0; n < 4; n++) {                         // a few cloudy puff textures: overlapping soft blobs, feathered edge
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 13, x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d, r = 9 + Math.random() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, 64, 64);
    out.push(c);
  }
  return out;
}
function puff(x, y, vx, vy, r, grow, life, alpha, warm, drag, st) {   // st: a streak this many times longer than wide, laid along its flight, relaxing as it spreads
  if (smoke.length >= SMOKE.max) smoke.shift();
  smoke.push({ x, y, vx, vy, r, grow, life, max: life, a: alpha, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.2,
    sp: (Math.random() * SMOKE_SPRITES.length) | 0, warm: warm || 0, drag: drag || 2.4, st: st || 0, sa: Math.atan2(vy, vx) });
}
function trailPoint(c, x, y, a) {                     // add to the shooter's smoke ribbon (starts a new one if the last has ended)
  let tr = c.trail;
  if (!tr || tr.dead) { tr = c.trail = { pts: [] }; trails.push(tr); }
  const L = tr.pts[tr.pts.length - 1];
  if (L && Math.hypot(L.x - x, L.y - y) < TRAIL.gap) { L.a = Math.max(L.a, a); return; }
  tr.pts.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, age: 0, a });
  if (tr.pts.length > TRAIL.max) tr.pts.shift();
}
function updateTrails(dt) {
  for (let i = trails.length - 1; i >= 0; i--) {
    const tr = trails[i];
    for (const q of tr.pts) {
      q.age += dt;
      const nx = q.x + (q.vx + SMOKE.drift.x) * dt, ny = q.y + (q.vy + SMOKE.drift.y) * dt;
      if (!airWall(q.x, q.y, nx, ny)) { q.x = nx; q.y = ny; }
    }
    while (tr.pts.length && tr.pts[0].age > TRAIL.life) tr.pts.shift();
    if (!tr.pts.length) { tr.dead = true; trails.splice(i, 1); }
  }
}
function drawTrails() {                                 // smooth curves through the midpoints, so the ribbon has no beads at its joints
  ctx.lineCap = 'butt';
  for (const tr of trails) {
    const P = tr.pts;
    if (P.length < 3 || !onView(P[P.length >> 1].x, P[P.length >> 1].y, 160)) continue;
    for (let i = 1; i < P.length - 1; i++) {
      const q = P[i], f = 1 - q.age / TRAIL.life;
      if (f <= 0) continue;
      const ax = (P[i - 1].x + q.x) / 2, ay = (P[i - 1].y + q.y) / 2, bx = (q.x + P[i + 1].x) / 2, by = (q.y + P[i + 1].y) / 2;
      const w = TRAIL.w0 + TRAIL.grow * q.age, a = q.a * f * f * Math.min(1, q.age * 10 + 0.3);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(q.x, q.y, bx, by);
      ctx.strokeStyle = 'rgba(205,205,200,' + (a * 0.45).toFixed(3) + ')'; ctx.lineWidth = w * 2.2; ctx.stroke();   // soft outer haze
      ctx.strokeStyle = 'rgba(215,215,210,' + a.toFixed(3) + ')'; ctx.lineWidth = w; ctx.stroke();
    }
  }
}
function muzzlePoint(c, gunAng, sh, rx) {
  if (c.gun) { const g = c.gun, cg = Math.cos(g.ang), sg = Math.sin(g.ang), k = (rx || 0) * CHAR_SCALE; return [g.mx + cg * k, g.my + sg * k, cg, sg, 4.2 * (sh === undefined ? 1 : sh) * CHAR_SCALE]; }
  const cg = Math.cos(gunAng), sg = Math.sin(gunAng), lat = 4.2 * (sh === undefined ? 1 : sh) * CHAR_SCALE, L = (55 + (c === p && !p.side.out && attOn('supp') ? ATTFX.supp.len : 0) + (rx || 0)) * CHAR_SCALE;
  return [c.x + cg * L - sg * lat, c.y + sg * L + cg * lat, cg, sg, lat];
}
function gunSmoke(c, gunAng, sh, rx) {
  let [mx, my, cg, sg, lat] = muzzlePoint(c, gunAng, sh, rx);
  const L0 = Math.hypot(mx - c.x, my - c.y) || 1, safe = Math.max(0, Math.min(L0, cast(c.x, c.y, (mx - c.x) / L0, (my - c.y) / L0, L0) - 3));
  mx = c.x + (mx - c.x) / L0 * safe; my = c.y + (my - c.y) / L0 * safe;   // never inside a wall
  if (!cSupp(c)) flashes.push({ x: mx, y: my, t: 0.06 });   // a suppressor kills the flash
  for (let i = 0; i < 3; i++) {                                         // the blast jets out along the bore, then stalls and billows
    const a = gunAng + (Math.random() - 0.5) * 0.35, v = 170 + i * 70 + Math.random() * 60;
    puff(mx, my, Math.cos(a) * v, Math.sin(a) * v, 1.8 + i * 0.6, 12 + Math.random() * 8, 1.3 + Math.random() * 1.1, 0.26 - i * 0.04, 1, 8 + i * 2, 3.2);
  }
  for (let i = 0; i < 2; i++) {                                         // a slower cloud hanging at the muzzle
    const a = gunAng + (Math.random() - 0.5) * 2.2, v = 15 + Math.random() * 45;
    puff(mx, my, Math.cos(a) * v, Math.sin(a) * v, 3 + Math.random() * 2, 7 + Math.random() * 6, 1.6 + Math.random() * 1.2, 0.2, 1, 3, 2);
  }
  const ra = gunAng + Math.PI / 2 - 0.5 + (Math.random() - 0.5) * 0.3;  // slant brake vents to the right
  puff(mx, my, Math.cos(ra) * 110, Math.sin(ra) * 110, 2, 9, 1, 0.2, 1, 7, 2.6);
  const pl = lat + 3 * CHAR_SCALE, px = c.x + cg * 23 * CHAR_SCALE - sg * pl, py = c.y + sg * 23 * CHAR_SCALE + cg * pl;
  puff(px, py, -sg * 25, cg * 25, 1.5, 5, 0.6, 0.14, 0, 0, 2.2);        // a wisp from the ejection port
  c.heat = Math.min(25, (c.heat || 0) + SMOKE.heatPerShot);
  trailPoint(c, mx, my, 0.26);                                           // the ribbon starts at the first shot
}
/* A hot barrel keeps smoking: thin wisps from the muzzle that trail behind as the rifle moves. */
function barrelWisps(c, gunAng, sh, rx, dt) {
  c.heat = Math.max(0, (c.heat || 0) - SMOKE.cool * dt);
  if (c.dead || c.heat < SMOKE.wispFrom) { if (c.trail) c.trail = null; return; }   // cooled: this ribbon ends and drifts away
  const [mx, my] = muzzlePoint(c, gunAng, sh, rx);
  trailPoint(c, mx, my, clamp(0.08 + c.heat * 0.012, 0.08, 0.28));
}
function lingerSmoke(x, y, [n, life0, life1]) {          // a grenade's cloud: big slow puffs that hang in the room for many seconds, spreading and thinning
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 20 + Math.random() * 70;
    puff(x + Math.cos(a) * 6, y + Math.sin(a) * 6, Math.cos(a) * sp, Math.sin(a) * sp, 10 + Math.random() * 6, 5 + Math.random() * 4, life0 + Math.random() * (life1 - life0), 0.16 + Math.random() * 0.08, 0, 1.2);
  }
}
function updateSmoke(dt) {
  for (let i = smoke.length - 1; i >= 0; i--) {
    const s = smoke[i], k = Math.exp(-s.drag * dt);
    if (s.drag > 2.4) s.drag = Math.max(2.4, s.drag - dt * 10);           // a jet stalls fast, then drifts like the rest
    s.vx = s.vx * k + (SMOKE.drift.x + (Math.random() - 0.5) * 30) * (1 - k);   // slows into the draught, with a little turbulence
    s.vy = s.vy * k + (SMOKE.drift.y + (Math.random() - 0.5) * 30) * (1 - k);
    const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
    if (airWall(s.x, s.y, nx, s.y)) s.vx = 0; else s.x = nx;   // smoke doesn't go through walls (or glass), but drifts out of a broken window
    if (airWall(s.x, s.y, s.x, ny)) s.vy = 0; else s.y = ny;
    s.r += s.grow * dt * (s.life / s.max);                               // swells fast, then slower
    s.rot += s.vr * dt;
    s.life -= dt;
    if (s.life <= 0) smoke.splice(i, 1);
  }
}
function drawSmoke() {
  for (const s of smoke) {
    if (!onView(s.x, s.y, s.r * 1.2)) continue;
    const f = s.life / s.max, age = s.max - s.life;
    let a = s.a * Math.min(1, age * 12 + 0.25) * f;                       // quick bloom, slow fade
    const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
    a *= (s.warm && age < 0.08) ? 1.3 : 1;                               // the light map decides how much of it you can see
    if (a < 0.004) continue;
    const size = s.r * 2.2;
    ctx.globalAlpha = Math.min(1, a);
    ctx.save(); ctx.translate(s.x, s.y);
    if (s.st) {                                                          // a streak along its flight: long while it's fresh and fast, rounding off as it spreads
      const v = Math.hypot(s.vx, s.vy);
      if (v > 6) s.sa += angDiff(Math.atan2(s.vy, s.vx), s.sa) * 0.2;
      const k = 1 + (s.st - 1) * f * f + Math.min(1.5, v / 150);
      ctx.rotate(s.sa); ctx.drawImage(SMOKE_SPRITES[s.sp], -size * k / 2, -size * 0.38, size * k, size * 0.76);
    } else { ctx.rotate(s.rot); ctx.drawImage(SMOKE_SPRITES[s.sp], -size / 2, -size / 2, size, size); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* AK-47 ejection: the bolt flings the empty case out of the port on the right side of the receiver,
   out to the right and a little forward (about 2 o'clock), hard enough to land a couple of metres away.
   It always leaves the rifle's right side, whichever shoulder the rifle is on. */
/* Casings fly in a real arc: up out of the port, tumbling end over end (`tb`), shadow on the floor below. They bounce off
   the floor with a glint, ricochet off walls, furniture and people, can land on a tabletop, then roll on their side
   (bottlenecked, so they curve) before they settle and are painted in. */
const CASE = { z0: 16, vz: [90, 150], v: [200, 290], grav: 620, air: 0.7, bounce: 0.38, scatter: 0.7, rollFric: 2.2, slideFric: 12, curve: 0.035, top: 16, body: 34 };
function ejectCasing(x, y, gunAng, sh, owner, port) {   // port: [along, across, size] for another gun (the Glock), else the AK's
  const c = Math.cos(gunAng), s = Math.sin(gunAng), rx = -s, ry = c;
  const lx = (port ? port[0] : 23) * CHAR_SCALE, ly = (port ? port[1] : 4.2 * (sh === undefined ? 1 : sh) + 3) * CHAR_SCALE;
  const a = gunAng + Math.PI / 2 - 0.45 + (Math.random() - 0.5) * 0.4;
  const v = rnd(CASE.v);
  let ex = x + c * lx + rx * ly, ey = y + s * lx + ry * ly;
  for (let q = 1; q >= 0 && caseTall(ex, ey); q -= 0.2) { ex = x + (c * lx + rx * ly) * q; ey = y + (s * lx + ry * ly) * q; }   // port against a wall: it leaves on this side
  debris.push({ x: ex, y: ey, vx: Math.cos(a) * v, vy: Math.sin(a) * v, z: CASE.z0, vz: rnd(CASE.vz),
    rot: gunAng + (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 25, tb: 0, vt: 25 + Math.random() * 35, col: '#b8913c', shape: 'casing', size: port ? port[2] : 1, t: 0, tink: 0, owner, hops: 0 });
}
/* For casings: walls, columns, elevators, crates and shut doors are tall (they bounce off them), and so is glass still in a
   window pane (paneCross, on the pane's own line); cars, counters, desks, sofas, tables and window sills are low: a casing can
   land on top of them or bounce off their sides. */
const caseTall = (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); if (i < 0 || j < 0 || i >= W || j >= H) return true; const k = j * W + i; return doorAt[k] >= 0 ? grid[k] === 1 : '#ECX'.includes(solidAt[k]); };   // window panes: paneCross
const caseFloor = (x, y) => {
  const i = Math.floor(x / T), j = Math.floor(y / T);
  if (i >= 0 && j >= 0 && i < W && j < H && doorAt[j * W + i] < 0 && !'.#ECX'.includes(solidAt[j * W + i])) return CASE.top;   // window tiles are sills
  for (const f of pieces) if (!f.broken && x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) return CASE.top;
  return 0;
};
function stepCasing(d, dt) {
  d.t += dt; d.tink = Math.max(0, d.tink - dt);
  const fl = caseFloor(d.x, d.y), air = d.z > fl + 0.01 || d.vz > 0;
  if (air) {
    d.vz -= CASE.grav * dt; d.z += d.vz * dt; d.tb += d.vt * dt;
    const k = Math.exp(-CASE.air * dt); d.vx *= k; d.vy *= k;
    if (d.z <= fl) {                                                          // touchdown
      d.z = fl;
      if (d.vz < -45) {                                                       // a bounce: brass is lively, and lands at odd angles
        d.vz = -d.vz * CASE.bounce; const sc = (Math.random() - 0.5) * CASE.scatter * 2, cs = Math.cos(sc), sn = Math.sin(sc);
        const vx = d.vx * cs - d.vy * sn, vy = d.vx * sn + d.vy * cs; d.vx = vx * 0.65; d.vy = vy * 0.65;
        d.vt = (Math.random() - 0.5) * 60; d.vr += (Math.random() - 0.5) * 30; d.tink = 0.07; d.hops++;
        sfxCase(d, clamp(d.vz / 220, 0.2, 1));
        if (d.hops === 1 && d.t < 0.8) puff(d.x, d.y, 0, 0, 1, 3, 0.7, 0.05, 0);   // still hot: a breath of smoke
      } else { d.vz = 0; d.tb = Math.round(d.tb / Math.PI) * Math.PI; }        // lying flat on its side
    }
  } else {                                                                    // rolling: free across its axis, scrubbing along it, curving round the neck
    const ax = Math.cos(d.rot), ay = Math.sin(d.rot), along = d.vx * ax + d.vy * ay, cx = d.vx - ax * along, cy = d.vy - ay * along;
    const ka = Math.exp(-CASE.slideFric * dt), kr = Math.exp(-CASE.rollFric * dt), roll = Math.hypot(cx, cy);
    d.vx = ax * along * ka + cx * kr; d.vy = ay * along * ka + cy * kr;
    d.vr = d.vr * Math.exp(-8 * dt) + roll * CASE.curve * (d.seedDir || (d.seedDir = Math.random() < 0.5 ? -1 : 1));
  }
  d.rot += d.vr * dt;
  let nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
  const solid = (x, y) => caseTall(x, y) || (d.z < CASE.top - 1 && caseFloor(x, y) > d.z + 1);
  const stuck = solid(d.x, d.y);                                            // already inside something: let it get out, don't pin it there
  if (!stuck && (solid(nx, d.y) || paneCross(d.x, d.y, nx, d.y))) { sfxCase(d, clamp(Math.abs(d.vx) / 300, 0.15, 0.7), true); d.vx *= -0.45; d.vr += (Math.random() - 0.5) * 20; d.tink = 0.05; nx = d.x; }   // off walls and the sides of furniture
  if (!stuck && (solid(d.x, ny) || paneCross(d.x, d.y, d.x, ny))) { sfxCase(d, clamp(Math.abs(d.vy) / 300, 0.15, 0.7), true); d.vy *= -0.45; d.vr += (Math.random() - 0.5) * 20; d.tink = 0.05; ny = d.y; }
  d.x = nx; d.y = ny;
  if (d.z < CASE.body) for (const c of [p, ...bots]) {                      // off legs and bodies (not the shooter, as it leaves the port)
    if (c.dead || (c === d.owner && d.t < 0.15)) continue;
    const ex = d.x - c.x, ey = d.y - c.y, e = Math.hypot(ex, ey);
    if (e > c.r || e < 0.01) continue;
    const ux = ex / e, uy = ey / e, vn = d.vx * ux + d.vy * uy;
    if (vn < 0) { d.vx -= 1.4 * vn * ux; d.vy -= 1.4 * vn * uy; d.vx *= 0.5; d.vy *= 0.5; d.vr += (Math.random() - 0.5) * 30; }
    d.x = c.x + ux * c.r; d.y = c.y + uy * c.r;
  }
  return !air && d.vx * d.vx + d.vy * d.vy < 25;                              // settled
}
function drawBit(g, d) {
  g.save(); g.translate(d.x, d.y); g.rotate(d.rot);
  g.fillStyle = d.col;
  const s = d.size;
  switch (d.shape) {
    case 'casing': {                                   // 7.62x39: rim, tapered body, shoulder, neck; end over end in the air
      const z = d.z || 0, lf = d.tb === undefined ? 1 : 0.3 + 0.7 * Math.abs(Math.cos(d.tb)), up = 1 + z / 90;
      if (z > 0.5) {                                   // its shadow on the floor, then the case itself up above it
        g.restore(); g.save(); g.translate(d.x + z * 0.25, d.y + z * 0.45); g.rotate(d.rot);
        g.fillStyle = 'rgba(0,0,0,' + (0.35 - Math.min(0.2, z / 150)).toFixed(3) + ')'; g.beginPath(); g.ellipse(0, 0, 2.8 * lf, 1.1, 0, 0, Math.PI * 2); g.fill();
        g.restore(); g.save(); g.translate(d.x, d.y); g.rotate(d.rot);
      } else if (g !== artG) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-2.4, -0.6, 5.4, 1.9); }
      g.scale(lf * up, up);
      g.fillStyle = '#8a6a2a'; g.fillRect(-2.9, -1.15, 0.7, 2.3);                         // rim / extractor groove
      g.fillStyle = d.col; g.beginPath(); g.moveTo(-2.2, -1.1); g.lineTo(0.9, -0.95); g.lineTo(1.6, -0.6); g.lineTo(2.9, -0.55);
      g.lineTo(2.9, 0.55); g.lineTo(1.6, 0.6); g.lineTo(0.9, 0.95); g.lineTo(-2.2, 1.1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,190,0.55)'; g.fillRect(-2.2, -0.9, 3, 0.55);              // highlight down one side
      g.fillStyle = 'rgba(60,40,10,0.45)'; g.fillRect(-2.2, 0.5, 3, 0.5);
      g.fillStyle = '#2a1e0c'; g.fillRect(2.6, -0.35, 0.35, 0.7);                           // open mouth
      if (d.tink > 0) { g.fillStyle = 'rgba(255,250,220,' + (d.tink * 12).toFixed(2) + ')'; g.beginPath(); g.arc(0.5, 0, 2.6, 0, Math.PI * 2); g.fill(); }   // glint as it strikes
      break;
    }
    case 'chip': g.fillRect(-s / 2, -s * 0.35, s, s * 0.7); break;
    case 'blood': {                                    // a droplet in flight: stretched along its path, its shadow on the floor below
      const z = d.z || 0, sp = Math.hypot(d.vx, d.vy), e = 1 + Math.min(2.2, sp / 160);
      g.restore(); g.save();
      if (z > 0.5 && g !== artG) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(d.x + z * 0.25, d.y + z * 0.45, s * 0.4 * e, s * 0.3, Math.atan2(d.vy, d.vx), 0, Math.PI * 2); g.fill(); }
      g.translate(d.x, d.y); g.rotate(Math.atan2(d.vy, d.vx));
      g.fillStyle = d.col; g.beginPath(); g.ellipse(0, 0, s * 0.55 * e, s * 0.5 / Math.sqrt(e), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,190,190,0.35)'; g.beginPath(); g.arc(s * 0.15 * e, -s * 0.12, s * 0.16, 0, Math.PI * 2); g.fill();   // wet glint
      break;
    }
    case 'helmet':
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(1, 1.5, s, s * 0.92, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = d.col; g.beginPath(); g.ellipse(0, 0, s, s * 0.92, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s * 0.6, -s * 0.8); g.lineTo(s * 0.4, -s * 0.8); g.moveTo(-s * 0.6, s * 0.8); g.lineTo(s * 0.4, s * 0.8); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-s * 0.35, -s * 0.35, s * 0.4, s * 0.25, -0.5, 0, Math.PI * 2); g.fill();
      if (d.nods) { const o = ctx; ctx = g; g.save(); g.scale(s / 6.6, s / 6.6); drawNods(0.7); g.restore(); ctx = o; }   // the NVG still on its mount
      break;
    case 'splinter': g.fillRect(-s, -0.9, s * 2, 1.8); break;
    case 'fluff': g.beginPath(); g.arc(0, 0, s * 0.6, 0, Math.PI * 2); g.fill(); break;
    case 'shard': g.beginPath(); g.moveTo(-s, 0); g.lineTo(0, -s * 0.6); g.lineTo(s * 0.8, s * 0.4); g.closePath(); g.fill(); break;
    case 'chunk':
      g.beginPath(); g.moveTo(-s * 0.6, -s * 0.4); g.lineTo(s * 0.1, -s * 0.6); g.lineTo(s * 0.6, -s * 0.1);
      g.lineTo(s * 0.3, s * 0.5); g.lineTo(-s * 0.5, s * 0.4); g.closePath(); g.fill(); break;
    case 'poly': {                                     // a broken-off chunk; in the air it casts a shadow and looks bigger
      const z = g === ctx && d.z > 0 ? d.z : 0, path = (ox, oy) => { g.beginPath(); d.pts.forEach(([px, py], q) => q ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)); g.closePath(); };
      if (z) {
        const c = Math.cos(-d.rot), sn = Math.sin(-d.rot), wx = z * 0.35, wy = z * 0.55;
        g.fillStyle = 'rgba(0,0,0,0.3)'; path(wx * c - wy * sn, wx * sn + wy * c); g.fill();
        g.scale(1 + z / 70, 1 + z / 70);
      }
      g.globalAlpha = d.alpha; path(0, 0); g.fillStyle = d.col; g.fill();
      g.strokeStyle = d.edge; g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(d.pts[0][0], d.pts[0][1]); g.lineTo(d.pts[1][0], d.pts[1][1]); g.stroke();
      g.globalAlpha = 1;
      break;
    }
    case 'mag':                                        // curved AK magazine
      g.beginPath(); g.moveTo(-2.4, -5.5); g.quadraticCurveTo(1.2, 0, -0.2, 5.8); g.lineTo(3, 5.2); g.quadraticCurveTo(4.2, 0, 1.4, -5.8); g.closePath(); g.fill();
      break;
    case 'pmag':                                       // straight Glock magazine: polymer body, steel lips, base plate
      g.scale(s / 0.6, s / 0.6);
      g.fillStyle = '#141517'; g.fillRect(-1.5, -3.2, 3, 6.4);
      g.fillStyle = '#26272b'; g.fillRect(-1.8, 2.6, 3.6, 1.1);
      g.fillStyle = '#6e6f73'; g.fillRect(-1, -3.6, 2, 0.7);
      break;
  }
  g.restore();
}
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    if (d.shape === 'casing' && d.tb !== undefined) {
      if (stepCasing(d, dt) || d.t > 5) { d.z = 0; d.tink = 0; drawBit(artG, d); debris.splice(i, 1); }
      continue;
    }
    if (d.z !== undefined && (d.z > 0 || d.vz > 0)) {                             // chunks: up, over and down
      d.vz -= CHUNK.grav * dt; d.z += d.vz * dt;
      if (d.z <= 0 && d.shape !== 'blood') { d.z = 0; d.vz = d.vz < -50 ? -d.vz * CHUNK.bounce : 0; d.vx *= 0.7; d.vy *= 0.7; d.vr *= 0.6; }
    }
    const k = Math.exp(-(d.z > 0 ? CHUNK.airDrag : d.fric) * dt);
    d.vx *= k; d.vy *= k; d.vr *= k; d.rot += d.vr * dt; d.t += dt;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (d.shape === 'blood') { if (bloodFlight(d, nx, ny)) debris.splice(i, 1); continue; }   // blood: lands, splashes on walls and furniture
    const inWin = winAt(d.x, d.y);                   // glass falling out of a window frame: free to drop onto the sill or out past it
    if (inWin ? airWall(d.x, d.y, nx, d.y) : wall(Math.floor(nx / T), Math.floor(d.y / T))) d.vx *= -0.35; else d.x = nx;
    if (inWin ? airWall(d.x, d.y, d.x, ny) : wall(Math.floor(d.x / T), Math.floor(ny / T))) d.vy *= -0.35; else d.y = ny;
    if ((d.vx * d.vx + d.vy * d.vy < 64 && !(d.z > 0)) || d.t > 4) {               // settled: paint it in
      if (d.shape === 'blood') stampBlood(d); else { drawBit(artG, d); addGlass(d); }
      debris.splice(i, 1);
    }
  }
  while (debris.length > 450) { const d = debris.shift(); d.z = 0; d.tink = 0; drawBit(artG, d); addGlass(d); }
}

/* ---------- pushing furniture ---------- */
function boxBlocked(x, y, w, h, self, ignore) {
  const i0 = Math.floor(x / T), i1 = Math.floor((x + w - 0.01) / T), j0 = Math.floor(y / T), j1 = Math.floor((y + h - 0.01) / T);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (wall(i, j)) return true;
  for (const o of pieces) if (o !== self && !o.broken && x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y) return true;
  const body = c => {                                   // furniture can't be shoved through people (except the one pushing it)
    if (!c || c === ignore || c.dead) return false;
    const qx = clamp(c.x, x, x + w), qy = clamp(c.y, y, y + h);
    return (c.x - qx) * (c.x - qx) + (c.y - qy) * (c.y - qy) < (c.r - 1) * (c.r - 1);
  };
  if (body(p)) return true;
  for (const b of bots) if (body(b)) return true;
  return false;
}
function movePiece(f, dx, dy, ignore) {
  if (f.fixed) return 0;                                  // bolted down
  let moved = 0;
  if (dx && !boxBlocked(f.x + dx, f.y, f.w, f.h, f, ignore)) { f.x += dx; moved += Math.abs(dx); }
  if (dy && !boxBlocked(f.x, f.y + dy, f.w, f.h, f, ignore)) { f.y += dy; moved += Math.abs(dy); }
  if (moved > 0) { occDirty = true; f.scrape += moved; }
  return moved;
}
/* Whoever walks into furniture shoves it; heavy pieces barely budge, so you slow right down pushing them. */
function pushPieces(e) {
  if (e.relax) return;                             // the ally sitting on the sofa doesn't shove it
  for (const [hx, hy, ex, ey, , door] of carDoorSegs()) {   // open car doors: you bump into them
    if (e === p && door === EXIT.carDoor) continue;          // ...except the one you're climbing in by
    const L2 = ex * ex + ey * ey || 1, t = clamp(((e.x - hx) * ex + (e.y - hy) * ey) / L2, 0, 1), qx = hx + ex * t, qy = hy + ey * t;
    const dx = e.x - qx, dy = e.y - qy, d = Math.hypot(dx, dy), reach = e.r + 2.2;
    if (d < reach) { const nx = d > 1e-3 ? dx / d : -ey / Math.sqrt(L2), ny = d > 1e-3 ? dy / d : ex / Math.sqrt(L2); moveCircle(e, nx * (reach - d), ny * (reach - d)); }
  }
  for (const f of pieces) {
    if (f.broken) continue;
    const cx = clamp(e.x, f.x, f.x + f.w), cy = clamp(e.y, f.y, f.y + f.h);
    const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
    if (d >= e.r) continue;
    let nx, ny, pen;
    if (d > 0.001) { nx = dx / d; ny = dy / d; pen = e.r - d; }
    else {
      const l = e.x - f.x, r = f.x + f.w - e.x, t = e.y - f.y, b = f.y + f.h - e.y, m = Math.min(l, r, t, b);
      if (m === l) { nx = -1; ny = 0; pen = l + e.r; } else if (m === r) { nx = 1; ny = 0; pen = r + e.r; }
      else if (m === t) { nx = 0; ny = -1; pen = t + e.r; } else { nx = 0; ny = 1; pen = b + e.r; }
    }
    const share = clamp(PUSH_POWER / f.mass, 0.05, 0.85);
    const moved = movePiece(f, -nx * pen * share, -ny * pen * share, e);
    if (moved > 0) f.pusher = e;
    if (e !== p && !f.fixed && f.mass < 1 && moved < pen * 0.2 && (e.blockT || 0) > 0.2) continue;   // a light piece wedged fast (a bedside table against the bed): a bot that's been stuck on it squeezes past rather than walking into it forever
    moveCircle(e, nx * Math.max(0, pen - moved), ny * Math.max(0, pen - moved));
  }
}

function makeNoise(x, y, r) {          // a sound you made (bots can hear it)
  const ext = new Float32Array(SOUND_RAYS);
  fillExtents(ext, x, y, r);
  waves.push({ x, y, ext, f: 0, dur: 0.6, kind: 'walk' });
  hearSound(ext, x, y, 60);
}
function inSwing(l) {                                 // anyone standing where the leaf sweeps (within its length of the hinge)
  const R = l.L + BODY_R + 4, near = c => c && !c.dead && Math.hypot(c.x - l.hx, c.y - l.hy) < R;
  if ((state === 'play' || state === 'downed') && near(p)) return true;
  return bots.some(near) || allies.some(near) || civs.some(near);
}
function updateDoors(dt) {
  for (const d of doors) {
    if (d.broken) continue;
    let shut = true;
    for (const l of d.leaves) {
      if (d.closer && !inSwing(l)) l.w -= DOOR.closer * l.th * dt;      // the closer spring pulls it back (not while someone's in its swing: it waits for them)
      l.w *= Math.exp(-DOOR.damp * dt);
      if (l.pull && simT < l.pull.until) l.w = -l.pull.dir * DOOR.pull;   // being pulled open by hand
      l.th += l.w * dt;
      const dcx = (d.rx0 + d.rx1) / 2, dcy = (d.ry0 + d.ry1) / 2;
      if ((l.th > l.hi || l.th < l.lo) && Math.abs(l.w) > 1.5 && simT - (l.sndT || 0) > 0.4) l.sndT = simT, creakStop(l), sfxDoor(dcx, dcy, 'door_shut', clamp(Math.abs(l.w) / 8, 0.15, 0.6));   // banged into the stop
      if (l.th > l.hi) { l.th = l.hi; l.w = -l.w * 0.3; }               // hits the wall / stop
      else if (l.th < l.lo) { l.th = l.lo; l.w = -l.w * 0.3; }
      if (Math.abs(l.th) > SND.door.shutAt) l.wasOpen = true;
      else if (l.wasOpen && Math.abs(l.th) < 0.03) { l.wasOpen = false; l.sndT = simT; creakStop(l); sfxDoor(dcx, dcy, 'door_shut', clamp(0.25 + Math.abs(l.w) / 6, 0.25, 1)); }   // back in the frame: bang
      if (d.closer && Math.abs(l.th) < 0.02 && Math.abs(l.w) < 0.3) { l.th = 0; l.w = 0; }   // latched
      if (Math.abs(l.th) < 0.05) l.creak = false;
      creakStep(l, dt);
      if (Math.abs(l.th) > 0.35) shut = false;
    }
    if (shut !== d.closed) setDoorSolid(d, shut);
  }
}
/* Bodies vs door slabs: walking into a door shoves it round its hinge (easier the further from the hinge you push).
   Whatever the door doesn't give, pushes you back. The support hand comes off the rifle and goes on the door. */
const DT_NOM = 1 / 60;
function alongWall(e, l) {                             // moving along the door's wall line (past the doorway), not through it
  const vx = e.vx || 0, vy = e.vy || 0, v = Math.hypot(vx, vy);
  if (v < 8) return false;
  return Math.abs((vx * Math.cos(l.base) + vy * Math.sin(l.base)) / v) > 0.7;
}
function pushDoors(e, who) {
  who = who || e;
  for (const d of doors) {
    if (d.broken || e.x < d.rx0 - 70 || e.x > d.rx1 + 70 || e.y < d.ry0 - 70 || e.y > d.ry1 + 70) continue;
    for (const l of d.leaves) {
      const a = l.base + l.th, ca = Math.cos(a), sa = Math.sin(a);
      const s = clamp((e.x - l.hx) * ca + (e.y - l.hy) * sa, 0, l.L);
      const qx = l.hx + ca * s, qy = l.hy + sa * s;
      let nx = e.x - qx, ny = e.y - qy;
      const dist = Math.hypot(nx, ny), reach = e.r + DOOR.thick;
      if (dist >= reach) continue;
      if (dist < 1e-4) { nx = -sa; ny = ca; } else { nx /= dist; ny /= dist; }
      const pen = reach - dist, dirTh = nx * sa - ny * ca;
      let absorbed = 0;
      if (s > 6) {
        const before = l.th, want = dirTh * pen * clamp(DOOR.push * s / l.L, 0, 0.85) / s;
        if (l.pull && simT < l.pull.until && Math.sign(want) === l.pull.dir) { /* being pulled the other way: pushing it back shut does nothing */ }
        else l.th = clamp(l.th + want, l.lo, l.hi);
        if (e === who && alongWall(e, l) && Math.abs(l.th - before) < 1e-5 && Math.abs(want) > 1e-5 && !(l.pull && simT < l.pull.until)) {   // an open door across a hallway, walked into from along the hallway: take the handle and pull it shut out of the way (never when walking through the doorway)
          l.pull = { dir: Math.sign(want), until: simT + DOOR.pullT }; l.w = -Math.sign(want) * DOOR.pull;
        }
        const dth = l.th - before;
        if (!(l.pull && simT < l.pull.until)) l.w = l.w * 0.4 + dth / DT_NOM * 0.6;   // it keeps swinging after the shove
        absorbed = Math.abs(dth) * s;
        if (Math.abs(before) < 0.12 && Math.abs(l.th) >= 0.12 && !l.creak) {   // the latch gives: creak
          l.creak = true;
          const cx = (d.rx0 + d.rx1) / 2, cy = (d.ry0 + d.ry1) / 2;
          sfxDoor(cx, cy, 'door_latch', 0.5);
          if (Math.random() < 0.7) {                                    // most doors creak (some squeak) while they swing
            const c = sfxDoor(cx, cy, Math.random() < 0.3 ? 'door_squeak' : 'door_creak', 0.3 + Math.random() * 0.4);
            if (c) { creakStop(l); l.cv = { src: c.src, gn: c.gn, g0: c.gn.gain.value, t0: simT, still: 0 }; }
          }
          noiseBy(who, cx, cy, DOOR.noise);
        }
        if (Math.abs(dth) > 1e-4 && e === who) e.doorTouch = { x: qx + nx * DOOR.thick, y: qy + ny * DOOR.thick, t: 0.3 };
      }
      const backOff = Math.max(0, pen - absorbed);
      if (e === who) moveCircle(e, nx * backOff, ny * backOff);
    }
  }
}
/* Dragging furniture scrapes: whoever pushed it can be heard. */
function updateScrapes() {
  for (const f of pieces) {
    if (f.scrape < 36) continue;
    f.scrape = 0;
    const x = f.x + f.w / 2, y = f.y + f.h / 2;
    if (f.pusher) noiseBy(f.pusher, x, y, SCRAPE_NOISE);
  }
}

/* ---------- drawing doors and furniture (live, before the light so it lights them) ---------- */
function doorLeaves(d, fn) { for (const l of d.leaves) fn(l.hx, l.hy, l.base + l.th, l.L); }
function drawDoors() {
  for (const d of doors) {
    if (d.broken) continue;
    doorLeaves(d, (hx, hy, a, L) => {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
      ctx.fillStyle = '#6a4e34'; ctx.fillRect(1, -4.5, L - 2, 9);
      ctx.fillStyle = '#8a6a44'; ctx.fillRect(3, -2.5, L - 6, 3);
      if (d.hp < DOOR_HP * 0.6) {
        ctx.strokeStyle = '#21170f'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(L * 0.3, -4); ctx.lineTo(L * 0.45, 1); ctx.lineTo(L * 0.62, -2); ctx.stroke();
      }
      ctx.restore();
    });
  }
}
function strokeDoorEdges() {
  ctx.beginPath();
  for (const d of doors) {
    if (d.broken) continue;
    for (const l of d.leaves) {
      const a = l.base + l.th;
      ctx.moveTo(l.hx, l.hy); ctx.lineTo(l.hx + Math.cos(a) * l.L, l.hy + Math.sin(a) * l.L);
    }
  }
  ctx.stroke();
}
/* The world rect on screen this frame (set in render): anything wholly outside it isn't drawn. */
const VIEW = { x0: 0, y0: 0, x1: 1e9, y1: 1e9 };
const onView = (x, y, r) => x + r > VIEW.x0 && x - r < VIEW.x1 && y + r > VIEW.y0 && y - r < VIEW.y1;
function drawPieces() {
  for (const f of pieces) {
    if (f.broken || !onView(f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h) / 2 + 20)) continue;
    const pd = f.pad === undefined ? 3 : f.pad, bites = f.bites;
    const bitePath = bt => { ctx.moveTo(f.x + bt[0][0], f.y + bt[0][1]); for (let q = 1; q < bt.length; q++) ctx.lineTo(f.x + bt[q][0], f.y + bt[q][1]); ctx.closePath(); };
    if (bites && bites.length) {                       // chunks shot out: clip each one away (one clip per bite, so overlaps stay cut)
      ctx.save();
      for (const bt of bites) { ctx.beginPath(); ctx.rect(f.x - 60, f.y - 60, f.w + 120, f.h + 120); bitePath(bt); ctx.clip('evenodd'); }
    }
    const sp = pieceSprite(f, pd);
    if (f.parts) drawVehUnder(f);
    ctx.drawImage(sp.cv, f.x + sp.dx, f.y + sp.dy, sp.cv.width / sp.s, sp.cv.height / sp.s);
    if (f.hp < f.maxHp * 0.6) {                       // getting wrecked: cracks
      ctx.strokeStyle = 'rgba(15,10,10,0.7)'; ctx.lineWidth = 1.5;
      const s = f.seed;
      ctx.beginPath();
      ctx.moveTo(f.x + (s % 1) * f.w, f.y + 2); ctx.lineTo(f.x + f.w * 0.5, f.y + f.h * 0.5); ctx.lineTo(f.x + ((s * 7) % 1) * f.w, f.y + f.h - 2);
      ctx.stroke();
    }
    if (f.blood) drawStains(f);
    if (f.parts) drawVehOver(f);
    ctx.fillStyle = 'rgba(10,8,12,0.8)';
    for (const [hx, hy] of f.holes) { ctx.beginPath(); ctx.arc(f.x + hx, f.y + hy, 2.2, 0, Math.PI * 2); ctx.fill(); }
    if (bites && bites.length) {                       // raw broken edges around each bite
      ctx.restore(); ctx.save();
      ctx.beginPath(); ctx.rect(f.x - pd, f.y - pd, f.w + pd * 2, f.h + pd * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(20,14,10,0.65)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); for (const bt of bites) bitePath(bt); ctx.stroke();
      ctx.restore();
    }
  }
}


