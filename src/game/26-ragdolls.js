/* ================= RAGDOLLS =================
   A death turns the body into a jointed ragdoll (verlet points held by sticks). It starts in the standing pose and the
   killing round shoves it, so it crumples and falls away from the shot (head first), limbs flailing, sliding to a stop
   against walls. The rifle flies out of the hands. Once settled, a blood pool spreads under it; when the pool has soaked
   into the floor, body and rifle are painted into the floor art for good. */
const RAG = { shove: 150, fricAir: 1.5, fricGround: 5, fricAlive: 30, airT: 0.25, iters: 5, restSpeed: 6, restT: 0.5, maxT: 3.5, maxStep: 6, limitEase: 0.6 };   // maxStep: px a joint may move per 1/60 s step
// joints: 0 head, 1 neck, 2 pelvis, 3/4 shoulders, 5/6 elbows, 7/8 hands, 9/10 hips, 11/12 knees, 13/14 feet
const RAG_START = [[8, 0], [2, 0], [-6, 0], [2, -10], [2, 10], [6, -12], [6, 12], [10, -9], [10, 9], [-6, -4.5], [-6, 4.5], [-12, -5], [-12, 5], [-17, -5], [-17, 5]];   // half-unfolded along the fall
const RAG_STICKS = [[0, 1, 9], [1, 2, 18], [1, 3, 10], [1, 4, 10], [3, 4, 20], [3, 2, 20.6], [4, 2, 20.6], [2, 9, 4.5], [2, 10, 4.5], [9, 10, 9],
  [1, 9, 18.6], [1, 10, 18.6], [0, 3, 13.4], [0, 4, 13.4], [3, 5, 11], [5, 7, 11], [4, 6, 11], [6, 8, 11], [9, 11, 15], [11, 13, 15], [10, 12, 15], [12, 14, 15],
  [9, 13, 27, 1], [10, 14, 27, 1], [3, 7, 12, 1], [4, 8, 12, 1], [11, 12, 6, 1], [13, 14, 6, 1], [5, 2, 12, 1], [6, 2, 12, 1]];   // a 4th entry = only keeps them at least that far apart (no folding flat, legs don't pass through each other)
/* Joint limits, so limbs only bend the way real ones can: [ref from, ref to, joint, child, min, max, side joint].
   The angle of joint→child against the ref direction is clamped; with a side joint, positive = away from the body on that side. */
const RAG_LIMITS = [
  [1, 2, 9, 11, -0.15, 0.75, 9], [1, 2, 10, 12, -0.15, 0.75, 10],   // thighs: along the body, splayed out a little, never across
  [9, 11, 11, 13, -0.3, 0.3, null], [10, 12, 12, 14, -0.3, 0.3, null],   // knees: close to straight seen from above
  [2, 1, 3, 5, -0.45, 2.7, 3], [2, 1, 4, 6, -0.45, 2.7, 4],         // upper arms: from down the side to over the head, not far across the chest
  [3, 5, 5, 7, -2.2, 2.2, null], [4, 6, 6, 8, -2.2, 2.2, null],     // elbows: no folding flat back on themselves
  [2, 1, 1, 0, -0.45, 0.45, null]];                                 // head stays in line with the spine
// A living body (downed, see DOWNED) can still bend: knees fold, legs draw up to the side, elbows bend further.
const RAG_LIMITS_ALIVE = RAG_LIMITS.map(L => {
  const [r0, r1, j, c] = L;
  if (j === 11 || j === 12) return [r0, r1, j, c, -1.9, 1.9, null];   // knees
  if (j === 9 || j === 10) return [r0, r1, j, c, -0.6, 1.3, L[6]];     // thighs
  if (j === 5 || j === 6) return [r0, r1, j, c, -2.7, 2.7, null];      // elbows
  return L;
});
function ragLimit(P, [r0, r1, j, c, lo, hi, sj]) {
  const rx = P[r1].x - P[r0].x, ry = P[r1].y - P[r0].y, rl = Math.hypot(rx, ry) || 1, vx = P[c].x - P[j].x, vy = P[c].y - P[j].y, vl = Math.hypot(vx, vy) || 1;
  const sd = sj === null ? 1 : (rx * (P[sj].y - P[r0].y) - ry * (P[sj].x - P[r0].x) >= 0 ? 1 : -1);
  const a = Math.atan2(rx * vy - ry * vx, rx * vx + ry * vy) * sd, ca = clamp(a, lo, hi);
  if (ca === a) return;
  const na = ca * sd, ux = rx / rl, uy = ry / rl, cs = Math.cos(na), sn = Math.sin(na);
  const tx = P[j].x + (ux * cs - uy * sn) * vl, ty = P[j].y + (ux * sn + uy * cs) * vl;
  P[c].x += (tx - P[c].x) * RAG.limitEase; P[c].y += (ty - P[c].y) * RAG.limitEase;   // eased over a few steps, so it never snaps
}
function startRagdoll(c, face, L, seed, ux, uy) {
  if (rags.some(q => q.c === c)) return;
  if (ux === undefined || ux === null) { ux = -Math.cos(face); uy = -Math.sin(face); }        // no shot to go by: fall backwards
  const K = CHAR_SCALE, px = -uy, py = ux, V = RAG.shove * (0.85 + Math.random() * 0.4);
  const pts = RAG_START.map(([a, b], i) => {
    const x = c.x + (ux * a + px * b) * K, y = c.y + (uy * a + py * b) * K;
    // shove share per joint; the feet kick back as the body goes over, so the legs straighten
    const sh = i <= 4 ? 1 : i <= 8 ? 0.8 : i <= 10 ? 0.45 : -0.3, j = i >= 5 && i <= 8 ? 80 : i >= 11 ? 20 : 10;
    const vx = ux * V * sh + (Math.random() - 0.5) * j, vy = uy * V * sh + (Math.random() - 0.5) * j;
    return { x, y, vx, vy };
  });
  // settle the pose before it moves: limbs out to their real lengths, joints within their limits, nothing inside a wall.
  // Only then give it the shove, so the unfolding doesn't turn into a fling.
  const inWall = q => wall(Math.floor(q.x / T), Math.floor(q.y / T));
  for (let it = 0; it < 12; it++) {
    ragSolve(pts);
    for (const q of pts) for (let n = 0; n < 8 && inWall(q); n++) { q.x += (c.x - q.x) * 0.3; q.y += (c.y - q.y) * 0.3; }
  }
  for (const q of pts) { q.px = q.x - q.vx / 60; q.py = q.y - q.vy / 60; }
  const rv = V * 0.6, ra = (Math.random() - 0.5) * 180, cx = (pts[1].x + pts[2].x) / 2, cy = (pts[1].y + pts[2].y) / 2;
  const pistol = !!(c.side && (c.side.out || (c.side.sw && c.side.sw.t >= PISTOL.draw * 0.5)));   // the Glock was in hand
  const hx = (pts[7].x + pts[8].x) / 2, hy = (pts[7].y + pts[8].y) / 2, rk = pistol ? 0.25 : 1;   // a slung rifle only slides off the body a little
  const gun = dropGun(hx, hy, ux * rv * rk - uy * ra * rk, uy * rv * rk + ux * ra * rk, face, (Math.random() - 0.5) * 10 * rk, DROP.rifle, cx, cy);
  const pr2 = pistol ? (Math.random() - 0.5) * 220 : 0;
  const side = pistol ? dropGun(hx, hy, ux * rv * 1.1 - uy * pr2, uy * rv * 1.1 + ux * pr2, face, (Math.random() - 0.5) * 16, DROP.glock, cx, cy) : null;
  rags.push({ c, L, seed, pr: c.prot, frontUp: Math.cos(face) * ux + Math.sin(face) * uy < 0, pts, t: 0, rest: 0, settled: false, pool: null,
    gun, side, holstered: !!(c.side && !pistol), att: c === p ? { ak: fitSet('ak'), glock: fitSet('glock') } : c.att && c.att.ak ? { ak: c.att.ak } : null,   // the guns keep what's fitted
    holJ: (pts[10].x - c.x) * -Math.sin(face) + (pts[10].y - c.y) * Math.cos(face) >= (pts[9].x - c.x) * -Math.sin(face) + (pts[9].y - c.y) * Math.cos(face) ? 10 : 9 });   // the hip that was on their right: the holster stays there
}
/* Dropped weapons (the rifle, and the Glock if it was in hand): a stick of length 2*half that skids, spins and bounces
   off walls. Both ends and the points between are kept out of walls (moves are split into short steps so nothing
   tunnels through), and it starts clear: pulled toward the body, then turned, until no part is inside a wall. */
const DROP = { rifle: 26 * CHAR_SCALE, glock: 7 * CHAR_SCALE, fric: 4, bounce: 0.35, sub: 5 };
function gunInWall(x, y, a, half) {
  const c = Math.cos(a) * half, s = Math.sin(a) * half;
  for (const k of [-1, -0.5, 0, 0.5, 1]) if (wall(Math.floor((x + c * k) / T), Math.floor((y + s * k) / T))) return true;
  return false;
}
function dropGun(x, y, vx, vy, a, va, half, cx, cy) {
  const g = { x, y, vx, vy, a, va, half };
  for (let n = 0; n < 12 && gunInWall(g.x, g.y, g.a, half); n++) { g.x += (cx - g.x) * 0.35; g.y += (cy - g.y) * 0.35; }
  for (let n = 0; n < 16 && gunInWall(g.x, g.y, g.a, half); n++) g.a += 0.4;
  if (gunInWall(g.x, g.y, g.a, half)) { g.x = cx; g.y = cy; for (let n = 0; n < 16 && gunInWall(g.x, g.y, g.a, half); n++) g.a += 0.4; }
  return g;
}
function stepGun(g, h) {
  const k = Math.exp(-DROP.fric * h); g.vx *= k; g.vy *= k; g.va *= k;
  const n = Math.max(1, Math.ceil(Math.max(Math.hypot(g.vx, g.vy) * h, Math.abs(g.va * h) * g.half) / DROP.sub)), s = h / n;
  for (let i = 0; i < n; i++) {
    const x = g.x + g.vx * s, y = g.y + g.vy * s, a = g.a + g.va * s;
    if (gunInWall(x, g.y, g.a, g.half)) { g.vx *= -DROP.bounce; g.va += (Math.random() - 0.5) * 3; } else g.x = x;   // glances off, with a twist
    if (gunInWall(g.x, y, g.a, g.half)) { g.vy *= -DROP.bounce; g.va += (Math.random() - 0.5) * 3; } else g.y = y;
    if (gunInWall(g.x, g.y, a, g.half)) g.va *= -0.4; else g.a = a;               // an end swinging into a wall stops it turning
  }
}
/* Sticks and joint limits, once. */
function ragSolve(P, lims = RAG_LIMITS) {
  const live = lims === RAG_LIMITS_ALIVE;
  for (const [a, b, len, min] of RAG_STICKS) {
    if (live && min && len > 20) continue;                                // a living body can draw its feet in (no hip-to-foot spacer)
    const A = P[a], B = P[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01, want = len * CHAR_SCALE;
    if (min && d >= want) continue;
    const m = (d - want) / d * 0.5;
    A.x += dx * m; A.y += dy * m; B.x -= dx * m; B.y -= dy * m;
  }
  for (const lim of lims) ragLimit(P, lim);
}
/* Fixed 1/60 s steps (a long frame can't amplify the motion), and no joint moves faster than RAG.maxStep px per step,
   so a stiff correction can never fling the body. */
function ragStep(rg, h) {
  const P = rg.pts, k = Math.exp(-(rg.alive && rg.t > 0.9 ? RAG.fricAlive : rg.t < RAG.airT ? RAG.fricAir : RAG.fricGround) * h);   // alive: it moves itself, no coasting
  rg.t += h;
  let top = 0;
  for (const q of P) {
    let vx = (q.x - q.px) * k, vy = (q.y - q.py) * k;
    const sp = Math.hypot(vx, vy);
    if (sp > RAG.maxStep) { vx *= RAG.maxStep / sp; vy *= RAG.maxStep / sp; }
    q.px = q.x; q.py = q.y; q.x += vx; q.y += vy;
    top = Math.max(top, Math.hypot(vx, vy) / h);
  }
  for (let it = 0; it < RAG.iters; it++) {
    ragSolve(P, rg.downed ? RAG_LIMITS_ALIVE : RAG_LIMITS);
    if (rg.pin) {                                             // stuck on a knife: the chest goes where the blade goes
      const cx = P[2].x + (P[1].x - P[2].x) * 0.62, cy = P[2].y + (P[1].y - P[2].y) * 0.62, mx = (rg.pin.x - cx) * 0.7, my = (rg.pin.y - cy) * 0.7;
      for (const j of [1, 2]) if (!wall(Math.floor((P[j].x + mx) / T), Math.floor((P[j].y + my) / T))) { P[j].x += mx; P[j].y += my; }
    }   // one who went down alive dies as they lay: bent knees stay bent
    for (const q of P) {                                      // walls stop it
      if (wall(Math.floor(q.x / T), Math.floor(q.py / T))) q.x = q.px;
      if (wall(Math.floor(q.x / T), Math.floor(q.y / T))) q.y = q.py;
    }
  }
  const g = rg.gun;                                           // the rifle (and a Glock in hand) skid and spin away on their own
  stepGun(g, h); if (rg.side) stepGun(rg.side, h);
  rg.rest = top < RAG.restSpeed && Math.hypot(g.vx, g.vy) < 10 && (!rg.side || Math.hypot(rg.side.vx, rg.side.vy) < 10) ? rg.rest + h : 0;
}
function updateRagdolls(dt) {
  if (dt <= 0) return;
  for (let n = rags.length - 1; n >= 0; n--) {
    const rg = rags[n], P = rg.pts;
    if (rg.settled) {                                          // waiting for the pool to soak in, then it's part of the floor
      if (!pools.includes(rg.pool)) { stampRagdoll(rg); rags.splice(n, 1); }
      continue;
    }
    if (!rg.alive && rg.t > RAG.airT) {                       // sliding to a stop: the body smears the blood under it
      const mx = (P[1].x + P[2].x) / 2, my = (P[1].y + P[2].y) / 2;
      if (rg.slx === undefined) { rg.slx = mx; rg.sly = my; }
      else if (Math.hypot(mx - rg.slx, my - rg.sly) > BLOODFX.slide) { smear(rg.slx, rg.sly, mx, my, 0.55); rg.slx = mx; rg.sly = my; }
    }
    rg.acc = Math.min((rg.acc || 0) + dt, 4 / 60);
    while (rg.acc >= 1 / 60) { rg.acc -= 1 / 60; if (rg.alive) downStep(rg, 1 / 60); ragStep(rg, 1 / 60); }
    if (rg.pin && (rg.pinT = (rg.pinT || 0) + dt) > MELEE.pinMax) rg.pin = null;   // never left hanging
    if (rg.alive || rg.pin) continue;                          // still alive on the floor, or hanging on a knife
    if (rg.rest > RAG.restT || rg.t > RAG.maxT) {
      rg.settled = true;
      addPool((P[1].x + P[2].x) / 2, (P[1].y + P[2].y) / 2); rg.pool = pools[pools.length - 1];
    }
  }
}
function drawRagdoll(rg) {
  const P = rg.pts, L = rg.L, K = CHAR_SCALE, pr = rg.pr;
  // a limb segment: tapered from wa to wb (px, before scale), rounded ends, thin dark edge
  const seg = (a, b, wa, wb, col, dx = 0, dy = 0) => {
    const A = P[a], B = P[b], ex = B.x - A.x, ey = B.y - A.y, d = Math.hypot(ex, ey) || 1, nx = -ey / d, ny = ex / d, ra = wa * K / 2, rb = wb * K / 2, an = Math.atan2(ny, nx);
    ctx.beginPath(); ctx.moveTo(A.x + dx + nx * ra, A.y + dy + ny * ra); ctx.lineTo(B.x + dx + nx * rb, B.y + dy + ny * rb);
    ctx.arc(B.x + dx, B.y + dy, rb, an, an + Math.PI, true); ctx.lineTo(A.x + dx - nx * ra, A.y + dy - ny * ra);
    ctx.arc(A.x + dx, A.y + dy, ra, an + Math.PI, an, true); ctx.closePath();
    if (typeof col !== 'string') pinCamo(col, A.x, A.y, Math.atan2(ey, ex));   // camo rides on the limb
    ctx.fillStyle = col; ctx.fill();
    if (!dx) { ctx.strokeStyle = L.rim; ctx.lineWidth = 0.55; ctx.stroke(); }
  };
  const LIMBS = [[9, 11, 5.6, 4.8], [11, 13, 4.6, 3.8], [10, 12, 5.6, 4.8], [12, 14, 4.6, 3.8]], ARMS_ = [[3, 5, 4, 3.5], [5, 7, 3.4, 2.8], [4, 6, 4, 3.5], [6, 8, 3.4, 2.8]];
  const sp = P[1], pe = P[2], ta = Math.atan2(sp.y - pe.y, sp.x - pe.x), Lt = Math.hypot(sp.x - pe.x, sp.y - pe.y) / K;
  // torso outline in its own frame (x from pelvis to neck, scaled): hips, a narrower waist, chest, shoulders
  const half = [[-4.5, 5.6], [-1.5, 8], [Lt * 0.38, 7], [Lt * 0.72, 8.6], [Lt - 1.5, 9.6], [Lt + 1, 8.2], [Lt + 2.2, 3.6]];
  const torso = (dx, dy) => {
    const pts = half.concat(half.slice().reverse().map(([x, y]) => [x, -y]));
    ctx.save(); ctx.translate(pe.x + dx, pe.y + dy); ctx.rotate(ta); ctx.scale(K, K);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {                       // smooth closed curve through the midpoints
      const a = pts[i], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (!i) { const z = pts[pts.length - 1]; ctx.moveTo((z[0] + a[0]) / 2, (z[1] + a[1]) / 2); }
      ctx.quadraticCurveTo(a[0], a[1], mx, my);
    }
    ctx.closePath(); ctx.restore();
  };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // contact shadow: the body's own shape, offset and soft-edged by drawing it twice
  for (const [o, al] of [[2.6, 0.16], [1.4, 0.2]]) {
    const sc = 'rgba(0,0,0,' + al + ')';
    for (const [a, b, wa, wb] of LIMBS.concat(ARMS_)) seg(a, b, wa + o, wb + o, sc, o * 0.6, o);
    torso(o * 0.6, o); ctx.fillStyle = sc; ctx.fill();
  }
  const g = rg.gun;                                           // the rifle, where it landed
  if (!L.civ) { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a); ctx.scale(K, K); ctx.translate(-28, 0); drawRifle(L, true, rg.att && rg.att.ak); ctx.restore(); }
  if (rg.side) { const q = rg.side; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.scale(K, K); ctx.translate(-4, 0); drawGlock(false, rg.att && rg.att.glock); ctx.restore(); }
  for (const [a, b, wa, wb] of LIMBS) seg(a, b, wa, wb, L.shin && (a === 11 || a === 12) ? L.shin : L.pants);   // shorts: bare shins
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (const kn of [11, 12]) { ctx.beginPath(); ctx.arc(P[kn].x, P[kn].y, 2.2 * K, 0, Math.PI * 2); ctx.fill(); }   // knee creases
  for (const [kn, ft] of [[11, 13], [12, 14]]) {               // boots, toes up
    ctx.save(); ctx.translate(P[ft].x, P[ft].y); ctx.rotate(Math.atan2(P[ft].y - P[kn].y, P[ft].x - P[kn].x)); ctx.scale(K, K);
    ctx.fillStyle = L.bootDark || 'rgba(0,0,0,0.6)'; rrPath(-2.5, -2.6, 6.6, 5.2, 2.2); ctx.fill();
    ctx.fillStyle = L.boot; rrPath(-1.8, -2.1, 5.4, 4.2, 1.8); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-1.6, -0.3, 4.6, 0.6);   // laces
    ctx.restore();
  }
  if (rg.holstered || rg.side) {                                // the holster stays on the hip, Glock still in it unless it was drawn
    const hj = P[rg.holJ || 10], hs = Math.sign((Math.cos(ta) * (hj.y - pe.y) - Math.sin(ta) * (hj.x - pe.x))) || 1;
    ctx.save(); ctx.translate(pe.x, pe.y); ctx.rotate(ta); ctx.scale(K, K); ctx.translate(6, -5 * hs); drawHolster(L, hs, 0, 0, rg.holstered); ctx.restore();
  }
  torso(0, 0); pinCamo(L.shirt, pe.x, pe.y, ta); ctx.fillStyle = L.shirt; ctx.fill(); ctx.strokeStyle = L.rim; ctx.lineWidth = 0.6; ctx.stroke();
  if (L.civ) { civRagDetail(rg, pe, ta, Lt); for (const [a, b, wa, wb] of ARMS_) seg(a, b, wa, wb, L.shortSleeve && (a === 5 || a === 6) ? L.skin : L.sleeve || L.shirt); civRagEnd(rg); ctx.restore(); return; }
  ctx.save(); ctx.translate(pe.x, pe.y); ctx.rotate(ta); ctx.scale(K, K);   // the carrier lying on the chest (or back)
  const x0 = Lt * 0.2, cw = Lt * 0.76, up = pr ? (rg.frontUp ? pr.front : pr.back) : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrPath(x0 - 0.5, -7.3, cw + 1, 14.6, 2); ctx.fill();
  ctx.fillStyle = L.carrier; rrPath(x0, -6.8, cw, 13.6, 1.8); ctx.fill();
  ctx.fillStyle = L.carrierDark; ctx.fillRect(x0 + cw * 0.15, -8.6, cw * 0.3, 1.8); ctx.fillRect(x0 + cw * 0.15, 6.8, cw * 0.3, 1.8);   // cummerbund
  ctx.fillStyle = L.carrierDark; ctx.fillRect(x0 + cw - 2.4, -5, 2.2, 1.6); ctx.fillRect(x0 + cw - 2.4, 3.4, 2.2, 1.6);                 // shoulder straps
  if (up > 0) { ctx.fillStyle = L.plate; ctx.globalAlpha *= 0.55; rrPath(x0 + 1, -5.6, cw - 2, 11.2, 1.4); ctx.fill(); ctx.globalAlpha /= 0.55; }
  else { ctx.fillStyle = 'rgba(0,0,0,0.55)'; rrPath(x0 + 1, -5.6, cw - 2, 11.2, 1.4); ctx.fill(); }
  ctx.strokeStyle = L.carrierDark; ctx.lineWidth = 0.4;                                         // MOLLE rows
  for (let q = x0 + 1.6; q < x0 + cw - 1; q += 2.2) { ctx.beginPath(); ctx.moveTo(q, -5.8); ctx.lineTo(q, 5.8); ctx.stroke(); }
  if (rg.frontUp) {                                                                              // mag pouches low on the front
    for (const py of [-4.6, -1.5, 1.6]) { ctx.fillStyle = L.carrierDark; rrPath(x0 + 0.6, py, 4.4, 2.9, 0.6); ctx.fill(); ctx.fillStyle = L.mag; ctx.fillRect(x0 + 0.2, py + 0.7, 1.2, 1.5); }
  } else {                                                                                       // radio pouch and drag handle on the back
    ctx.fillStyle = L.carrierDark; rrPath(x0 + 1, 1.2, 4.6, 4, 0.8); ctx.fill(); rrPath(x0 + cw - 2, -1.4, 1.6, 2.8, 0.5); ctx.fill();
  }
  ctx.restore();
  for (const [a, b, wa, wb] of ARMS_) seg(a, b, wa, wb, L.shirt);
  for (const [sh, el] of [[3, 5], [4, 6]]) {                     // sleeve patches on the upper arms, elbow pads (same kit as alive)
    const S0 = P[sh], E0 = P[el], ang = Math.atan2(E0.y - S0.y, E0.x - S0.x), mx = S0.x + (E0.x - S0.x) * 0.3, my = S0.y + (E0.y - S0.y) * 0.3;
    const flagHere = (sh === 4) === (L.flagSide > 0);
    if (flagHere || L.unitPatch) {
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.scale(K, K);
      if (flagHere) drawFlag(L.flag, -1.6, -1.1, 3.2, 2.2); else { ctx.fillStyle = L.unitPatch; rrPath(-1.4, -1.3, 2.8, 2.6, 0.6); ctx.fill(); }
      ctx.restore();
    }
    if (L.elbowPad) { ctx.fillStyle = L.elbowPad; ctx.beginPath(); ctx.arc(E0.x, E0.y, 2.3 * K, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const h of [7, 8]) {                                     // gloved hands, a little flattened along the forearm
    const e = h === 7 ? 5 : 6;
    ctx.save(); ctx.translate(P[h].x, P[h].y); ctx.rotate(Math.atan2(P[h].y - P[e].y, P[h].x - P[e].x)); ctx.scale(K, K);
    ctx.fillStyle = L.glove; ctx.beginPath(); ctx.ellipse(1, 0, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = L.rim; ctx.lineWidth = 0.5; ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(P[0].x, P[0].y); ctx.rotate(Math.atan2(P[0].y - P[1].y, P[0].x - P[1].x)); ctx.scale(K * 0.92, K * 0.92);
  drawHead(L, !pr || pr.helmet > 0, pr && pr.chipsH);
  ctx.restore();
  ctx.restore();
}
function stampRagdoll(rg) { const keep = ctx; ctx = artG; try { drawRagdoll(rg); } finally { ctx = keep; } }

