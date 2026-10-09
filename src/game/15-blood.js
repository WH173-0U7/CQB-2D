/* ================= BLOOD FX =================
   Droplets fly in an arc (z) and land where they come down: on the floor (a round drop with a crown of spines if it
   fell steeply, a teardrop with a tail and satellite if it was flying fast, an irregular splash if it was big), on
   furniture (the stain stays on the piece, `f.blood`, and moves with it), or against a wall (a spatter stretched
   along the face by how steeply it hit, with runs). A killing shot also sprays the wall behind the target, a red mist
   hangs for a moment at the wound, and a falling body smears blood as it slides. */
const BLOODFX = { z0: 14, vz: 70, wallReach: 75, mist: 6, stainMax: 26, slide: 3.5 };
const pieceAt = (x, y) => pieces.find(f => !f.broken && x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h);
function bloodFlight(d, nx, ny) {                       // true when the drop has landed somewhere
  const ti = Math.floor(nx / T), tj = Math.floor(ny / T), ci = Math.floor(d.x / T), cj = Math.floor(d.y / T);
  if (wall(ti, cj) || wall(ci, tj)) {                   // against a wall: splatter on its face
    const hitX = wall(ti, cj), k = hitX ? cj * W + ti : tj * W + ci;
    const fx = hitX ? (d.vx > 0 ? ti * T : (ti + 1) * T) : d.x, fy = hitX ? d.y : (d.vy > 0 ? tj * T : (tj + 1) * T);
    wallBlood(k, fx, fy, hitX ? -Math.sign(d.vx) : 0, hitX ? 0 : -Math.sign(d.vy), d.vx, d.vy, d.size * 0.7);
    return true;
  }
  d.x = nx; d.y = ny;
  const f = (d.z || 0) < 22 ? pieceAt(d.x, d.y) : null;
  if (f && (d.z || 0) < 18) { stainPiece(f, d); return true; }   // hits the side of a piece or comes down on it
  if ((d.z || 0) <= 0 || d.t > 3 || (d.z === undefined && d.vx * d.vx + d.vy * d.vy < 64)) { stampBlood(d); return true; }
  return false;
}
function stampBlood(d) {
  const sp = Math.hypot(d.vx, d.vy), a = Math.atan2(d.vy, d.vx) || d.a0 || 0, r = d.size * 0.62;
  markBlood(d.x, d.y, 5, 35);
  if (sp < 70) {                                        // came down steeply: round, with a crown of tiny spines
    bloodCrown(artG, d.x, d.y, r * (0.9 + Math.random() * 0.3), d.col);
  } else if (r > 1.9 && Math.random() < 0.35) {         // a big drop: an irregular splash
    bloodBlob(artG, d.x, d.y, r * 1.2, a, d.col);
  } else bloodDrop(artG, d.x, d.y, r, a, 1 + clamp(sp / 140, 0, 2.2), d.col, 0.9);
}
function bloodCrown(g, x, y, r, col) {
  g.save(); g.translate(x, y);
  g.globalAlpha = 0.9; g.fillStyle = BLOOD[1]; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.55; g.fillStyle = col; g.beginPath(); g.arc(-r * 0.15, -r * 0.1, r * 0.65, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.8; g.fillStyle = BLOOD[1];
  for (let q = 5 + (Math.random() * 5 | 0); q > 0; q--) {
    const t = Math.random() * Math.PI * 2, l = r * (1.15 + Math.random() * 0.5), w = r * 0.18;
    g.beginPath(); g.moveTo(Math.cos(t - 0.25) * r * 0.9, Math.sin(t - 0.25) * r * 0.9); g.lineTo(Math.cos(t) * l, Math.sin(t) * l); g.lineTo(Math.cos(t + 0.25) * r * 0.9, Math.sin(t + 0.25) * r * 0.9); g.fill();
    if (Math.random() < 0.5) { g.beginPath(); g.arc(Math.cos(t) * (l + r * 0.5), Math.sin(t) * (l + r * 0.5), w, 0, Math.PI * 2); g.fill(); }   // satellite droplet
  }
  g.restore();
}
function bloodBlob(g, x, y, r, a, col) {
  g.save(); g.translate(x, y); g.rotate(a);
  const n = 9, pts = Array.from({ length: n }, (_, q) => { const t = q / n * Math.PI * 2, rr = r * (0.6 + Math.random() * 0.6); return [Math.cos(t) * rr * 1.4, Math.sin(t) * rr]; });
  g.globalAlpha = 0.9; g.fillStyle = BLOOD[1]; g.beginPath();
  pts.forEach(([px, py], q) => { const [qx, qy] = pts[(q + 1) % n]; if (!q) g.moveTo((px + qx) / 2, (py + qy) / 2); g.quadraticCurveTo(qx, qy, (qx + pts[(q + 2) % n][0]) / 2, (qy + pts[(q + 2) % n][1]) / 2); });
  g.fill();
  g.globalAlpha = 0.5; g.fillStyle = col; g.beginPath(); g.ellipse(-r * 0.2, 0, r * 0.7, r * 0.45, 0, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.8; g.fillStyle = BLOOD[1];
  for (let q = 2 + (Math.random() * 3 | 0); q > 0; q--) { const t = (Math.random() - 0.5) * 0.9, l = r * (1.8 + Math.random()); g.beginPath(); g.arc(Math.cos(t) * l, Math.sin(t) * l, r * 0.22, 0, Math.PI * 2); g.fill(); }   // flung beads ahead
  g.restore();
}
/* Blood against a wall face: painted just inside the face (like bullet marks), clipped to that wall tile. A glancing hit
   stretches along the wall, a square one stays round; heavier hits leave short runs into the face. */
function wallBlood(k, x, y, nx, ny, vx, vy, r) {
  const i = k % W, j = (k / W) | 0, g = artG, tx = -ny, ty = nx, sp = Math.hypot(vx, vy) || 1;
  const cosI = Math.abs((vx * nx + vy * ny) / sp), along = Math.sign(vx * tx + vy * ty) || 1, e = clamp(1 / Math.max(0.3, cosI), 1, 3.2);
  g.save(); g.beginPath(); g.rect(i * T, j * T, T, T); g.clip();
  const ins = 1.5 + Math.random() * 3.5, cx = x - nx * ins, cy = y - ny * ins, ang = Math.atan2(ty * along, tx * along);   // somewhere up the face
  bloodDrop(g, cx, cy, r, ang, e, BLOOD[(Math.random() * 3) | 0], 0.9);
  g.fillStyle = BLOOD[1];
  for (let q = (Math.random() * 3) | 0; q > 0; q--) {   // satellites along the face
    const o = (Math.random() * 2 + 1) * r * e * along; g.globalAlpha = 0.7;
    g.beginPath(); g.arc(cx + tx * o, cy + ty * o, r * (0.25 + Math.random() * 0.25), 0, Math.PI * 2); g.fill();
  }
  if (r > 1.2 && Math.random() < 0.6) {                 // a run down the face, thinning as it goes
    const L = 3 + Math.random() * 6, w = r * 0.5; g.globalAlpha = 0.75;
    g.beginPath(); g.moveTo(cx + tx * w, cy + ty * w); g.lineTo(cx - nx * L, cy - ny * L); g.lineTo(cx - tx * w, cy - ty * w); g.closePath(); g.fill();
    g.beginPath(); g.arc(cx - nx * L, cy - ny * L, w * 0.6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
/* A killing round carries blood out the far side: if a wall is close behind the target, it takes a spray. */
function exitSpray(hx, hy, ux, uy) {
  for (let d = 6; d < BLOODFX.wallReach; d += 3) {
    const x = hx + ux * d, y = hy + uy * d, ti = Math.floor(x / T), tj = Math.floor(y / T);
    if (!wall(ti, tj)) continue;
    const px = x - ux * 3, py = y - uy * 3, wasX = Math.floor(px / T) !== ti;
    const nx = wasX ? -Math.sign(ux) : 0, ny = wasX ? 0 : -Math.sign(uy), fx = wasX ? (ux > 0 ? ti * T : (ti + 1) * T) : x, fy = wasX ? y : (uy > 0 ? tj * T : (tj + 1) * T);
    const k = tj * W + ti, n = Math.round(18 * (1 - d / BLOODFX.wallReach)) + 6, tx = -ny, ty = nx;
    for (let q = 0; q < n; q++) {                       // a fan of drops across the face, bigger near the centre
      const o = (Math.random() - 0.5) * (10 + d * 0.6), sz = (3.6 - Math.abs(o) / 10) * (0.6 + Math.random() * 0.7);
      const k2 = (Math.floor((fy + ty * o - ny * 2) / T)) * W + Math.floor((fx + tx * o - nx * 2) / T);   // a fan can run onto the next tile of the same wall
      wallBlood(wall(k2 % W, (k2 / W) | 0) ? k2 : k, fx + tx * o, fy + ty * o, nx, ny, ux * 300 + tx * o * 20, uy * 300 + ty * o * 20, Math.max(0.6, sz));
    }
    const kc = tj * W + ti;                              // the heart of it: a dense splash where the round's line meets the wall
    wallBlood(kc, fx, fy, nx, ny, ux * 300, uy * 300, 4 * (1 - d / BLOODFX.wallReach) + 1.5);
    return;
  }
}
/* Furniture keeps its own stains (they move with it, and go when it breaks). */
function stainPiece(f, d) {
  const st = f.blood || (f.blood = []);
  if (st.length >= BLOODFX.stainMax) st.shift();
  const sp = Math.hypot(d.vx, d.vy);
  st.push({ x: clamp(d.x - f.x, 1, f.w - 1), y: clamp(d.y - f.y, 1, f.h - 1), r: d.size * 0.6, a: Math.atan2(d.vy, d.vx), e: 1 + clamp(sp / 140, 0, 2), col: d.col, crown: sp < 70 });
}
function drawStains(f) {
  ctx.save(); ctx.beginPath(); ctx.rect(f.x, f.y, f.w, f.h); ctx.clip();
  for (const q of f.blood) { if (q.crown) bloodCrownQuick(ctx, f.x + q.x, f.y + q.y, q.r); else bloodDrop(ctx, f.x + q.x, f.y + q.y, q.r, q.a, q.e, q.col, 0.85); }
  ctx.restore();
}
function bloodCrownQuick(g, x, y, r) { g.globalAlpha = 0.85; g.fillStyle = BLOOD[1]; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
/* A short-lived red mist at the wound, drawn in the scene (so the darkness covers it like everything else). */
function bloodMist(x, y, ux, uy) {
  for (let q = 0; q < BLOODFX.mist; q++) {
    if (mists.length > 60) mists.shift();
    const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * 1.2, v = 30 + Math.random() * 80;
    mists.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 3, t: 0, life: 0.35 + Math.random() * 0.3 });
  }
}
function updateMists(dt) {
  for (let i = mists.length - 1; i >= 0; i--) { const m = mists[i], k = Math.exp(-5 * dt); m.vx *= k; m.vy *= k; m.x += m.vx * dt; m.y += m.vy * dt; m.r += 14 * dt; if ((m.t += dt) >= m.life) mists.splice(i, 1); }
}
function drawMists() {
  for (const m of mists) {
    if (!onView(m.x, m.y, m.r)) continue;
    const f = 1 - m.t / m.life, gr = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    gr.addColorStop(0, 'rgba(120,8,16,' + (0.35 * f).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(120,8,16,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
  }
}
function markBlood(x, y, r, amt) {
  const i0 = Math.max(0, Math.floor((x - r) / BLOOD_CELL)), i1 = Math.min(BMW - 1, Math.floor((x + r) / BLOOD_CELL));
  const j0 = Math.max(0, Math.floor((y - r) / BLOOD_CELL)), j1 = Math.min(BMH - 1, Math.floor((y + r) / BLOOD_CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = (i + 0.5) * BLOOD_CELL - x, cy = (j + 0.5) * BLOOD_CELL - y;
    if (cx * cx + cy * cy <= r * r + BLOOD_CELL * BLOOD_CELL * 0.25) bloodMap[j * BMW + i] = Math.min(255, bloodMap[j * BMW + i] + amt);
  }
}
function bloodAt(x, y) {
  const i = Math.floor(x / BLOOD_CELL), j = Math.floor(y / BLOOD_CELL);
  return i < 0 || j < 0 || i >= BMW || j >= BMH ? 0 : bloodMap[j * BMW + i];
}
/* Boots: every step checks the floor under that foot. Step in blood and the next ~10 prints are red,
   fading as the boots dry. Prints point the way the body faces (so backing away leaves prints facing you). */
const BOOT = { step: 32, prints: 10, wet: 100 };
function bootStep(c, moved, faceAng, mvAng) {
  c.bootAcc = (c.bootAcc || 0) + moved;
  if (c.bootAcc < BOOT.step) return;
  c.bootAcc = Math.min(c.bootAcc - BOOT.step, BOOT.step);
  c.bootFoot = -(c.bootFoot || 1);
  const side = c.bootFoot * 5 * CHAR_SCALE;
  const fx = c.x - Math.sin(mvAng) * side, fy = c.y + Math.cos(mvAng) * side;
  let wet = bloodAt(fx, fy) >= BOOT.wet;
  if (!wet) for (const q of pools) if (Math.hypot(fx - q.x, fy - q.y) < q.r) { wet = true; break; }
  if (wet) { c.bloodSteps = BOOT.prints; return; }
  if (c.bloodSteps > 0) { stampBootPrint(fx, fy, faceAng, c.bloodSteps / BOOT.prints); c.bloodSteps--; }
}
function stampBootPrint(x, y, ang, strength) {
  artG.save(); artG.translate(x, y); artG.rotate(ang); artG.scale(CHAR_SCALE, CHAR_SCALE);
  artG.globalAlpha = 0.15 + 0.65 * strength;
  artG.fillStyle = BLOOD[1];
  artG.beginPath(); artG.ellipse(3, 0, 5.6, 2.8, 0, 0, Math.PI * 2); artG.fill();     // sole
  artG.beginPath(); artG.ellipse(-5.4, 0, 2.7, 2.5, 0, 0, Math.PI * 2); artG.fill();  // heel
  artG.restore();
}
function addPool(x, y) {
  pools.push({ x, y, r: 3, max: 22 + Math.random() * 12, rot: Math.random() * 3, t: 0, lobes: Array.from({ length: 12 }, () => 0.72 + Math.random() * 0.45) });
}
/* A pool with a lobed, uneven edge: darker where it's thin and drying at the rim, a wet sheen while it's fresh. */
function drawPool(g, q, dry) {
  const n = q.lobes.length, P = (k, i) => { const a = i / n * Math.PI * 2, rr = q.r * q.lobes[i % n] * k, c = Math.cos(q.rot), s = Math.sin(q.rot), lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * 0.8; return [q.x + lx * c - ly * s, q.y + lx * s + ly * c]; };
  const path = k => { g.beginPath(); for (let i = 0; i <= n; i++) { const [px, py] = P(k, i), [nx, ny] = P(k, i + 1), mx = (px + nx) / 2, my = (py + ny) / 2; if (!i) g.moveTo(mx, my); else g.quadraticCurveTo(px, py, mx, my); } g.closePath(); };
  g.fillStyle = 'rgba(62,3,8,0.92)'; path(1); g.fill();
  g.fillStyle = 'rgba(104,9,18,0.85)'; path(0.8); g.fill();
  if (!dry) { g.fillStyle = 'rgba(255,170,170,0.09)'; g.beginPath(); g.ellipse(q.x - q.r * 0.25, q.y - q.r * 0.2, q.r * 0.35, q.r * 0.14, q.rot - 0.5, 0, Math.PI * 2); g.fill(); }
}
function updatePools(dt) {
  for (let i = pools.length - 1; i >= 0; i--) {
    const q = pools[i];
    q.t += dt; q.r += (q.max - q.r) * Math.min(1, dt * 0.7);         // spreads out over a few seconds
    if (q.t > 7) { drawPool(artG, q, true); markBlood(q.x, q.y, q.r, 255); pools.splice(i, 1); }   // then it's part of the floor
  }
}

/* Tracers: rounds are far too quick to see as objects, so each frame leaves a thin streak from where the round was to
   where it got to (the hit point, if it struck something), fading out over TRACER.life. */
const TRACER = { life: 0.09, alpha: 0.8, width: 1.1, glow: 0.3 }, tracers = [];
function stepTraced(list, i, dt, drag, own) {
  const b = list[i], x0 = b.x, y0 = b.y, done = stepBullet(b, dt, drag);
  tracers.push({ x0, y0, x1: b.ex === undefined ? b.x : b.ex, y1: b.ey === undefined ? b.y : b.ey, t: TRACER.life, own });
  if (done) list.splice(i, 1);
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) stepTraced(bullets, i, dt, BUL.dragP, true);
  for (let i = botBullets.length - 1; i >= 0; i--) stepTraced(botBullets, i, dt, BUL.dragB, false);
  for (let i = tracers.length - 1; i >= 0; i--) if ((tracers[i].t -= dt) <= 0) tracers.splice(i, 1);
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i], k = Math.exp(-(s.streak ? 5 : 2.5) * dt);
    s.vx *= k; s.vy *= k; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0) sparks.splice(i, 1);
  }
  for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
}

/* ---------- impacts, damage, wrecks ---------- */
function impact(ev, hx, hy) {
  const nx = ev.nx, ny = ev.ny;
  if (ev.kind === 'hard') {
    const m = ev.k >= 0 ? wallMat[ev.k] : 2;
    spray(hx + nx * 2, hy + ny * 2, nx, ny, 2 + ((Math.random() * 3) | 0), (MAT[m] || MAT[2]).bits, 'chip', 140, 3, 2.2);
    impactFx(m === 1 ? 'drywall' : m === 3 ? 'spark' : 'concrete', hx, hy, nx, ny);
  } else {
    holeAt(hx - nx * 4, hy - ny * 4);                                  // permanent bullet hole in the fixture
    const car = ev.c === 'c' || ev.c === 'y';
    spray(hx + nx * 2, hy + ny * 2, nx, ny, 3, car ? GLASS_BITS : WOOD_BITS, car ? 'shard' : 'splinter', 120, 3, 2.4);
    impactFx(car || ev.c === 'K' ? 'spark' : 'wood', hx, hy, nx, ny);
  }
}
/* Bounce a round off a surface with normal (nx, ny), with a little scatter; false if it's too slow or has bounced enough. */
function bounceOff(b, hx, hy, nx, ny) {
  if (b.bounces >= RICO.max || b.v <= RICO.minV) return false;
  const dot = b.ux * nx + b.uy * ny, rx = b.ux - 2 * dot * nx, ry = b.uy - 2 * dot * ny;
  const j = (Math.random() * 2 - 1) * RICO.jitter, cj = Math.cos(j), sj = Math.sin(j);
  b.ux = rx * cj - ry * sj; b.uy = rx * sj + ry * cj;
  b.x = hx + nx * 1.5; b.y = hy + ny * 1.5;
  b.v *= RICO.keep; b.bounces++; b.rolled.clear();
  return true;
}
function holeAt(x, y) {
  artG.fillStyle = 'rgba(8,8,12,0.85)';
  artG.beginPath(); artG.arc(x, y, 2.4, 0, Math.PI * 2); artG.fill();
}
function damagePiece(f, dmg, hx, hy, ux, uy) {
  if (f.parts && vehHit(f, dmg, hx, hy, ux, uy)) return;   // a tyre, a light, a window, a mirror, the roof sign: that part takes it
  f.hp -= dmg;
  if (f.holes.length < 18) f.holes.push([clamp(hx - f.x + ux * 3, 2, f.w - 2), clamp(hy - f.y + uy * 3, 2, f.h - 2)]);
  const F = FURN[f.c], pd = f.pad === undefined ? 3 : f.pad;
  // a piece comes off right where it was hit: a chip out of the edge if the round struck near one, else a hole
  let lx = clamp(hx - f.x, -pd, f.w + pd), ly = clamp(hy - f.y, -pd, f.h + pd);
  const eL = lx + pd, eR = f.w + pd - lx, eT = ly + pd, eB = f.h + pd - ly, e = Math.min(eL, eR, eT, eB);
  let br = clamp(2.5 + dmg * 0.15, 3, 7);
  if (e < br * 1.6) { if (e === eL) lx = -pd; else if (e === eR) lx = f.w + pd; else if (e === eT) ly = -pd; else ly = f.h + pd; }
  else br *= 0.6;
  if (F.noBite) {                                       // a vehicle: a hole, sparks, and sometimes a shower of window glass
    if (f.parts && Math.random() < 0.3) { spray(hx - ux * 2, hy - uy * 2, -ux, -uy, 5, GLASS_BITS, 'shard', 120, 2.4, 2.2); impactFx('glass', hx, hy, -ux, -uy); }
  } else {
    const bites = f.bites || (f.bites = []);
    if (bites.length < BITE_MAX) bites.push(chunkPts(br, 7).map(([a, b]) => [lx + a, ly + b]));
    const wx = f.x + lx, wy = f.y + ly, ox = wx - (f.x + f.w / 2), oy = wy - (f.y + f.h / 2), ol = Math.hypot(ox, oy) || 1;
    launchChunk(wx, wy, ox / ol * 0.6 + ux * 0.8, oy / ol * 0.6 + uy * 0.8, 90 + Math.random() * 90, chunkPts(br * 0.85, 5), pickCol(F.bits));
  }
  spray(hx - ux * 2, hy - uy * 2, -ux, -uy, 2, F.bits, F.shape, 110, 3, 2.6);
  impactFx(F.mat === 'metal' || F.mat === 'thin' ? 'spark' : F.mat === 'soft' ? 'soft' : F.mat === 'ceramic' ? 'plate' : 'wood', hx - ux * 2, hy - uy * 2, -ux, -uy);
  if (f.hp <= 0) breakPiece(f, ux, uy);
}
/* Destroyed: what's left splits into chunks (roughly a grid over the piece) that fly apart and settle where they land. */
function breakPiece(f, ux, uy) {
  f.broken = true; occDirty = true;
  const F = FURN[f.c], cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  artG.fillStyle = 'rgba(0,0,0,0.16)'; artG.fillRect(f.x + 3, f.y + 3, f.w - 6, f.h - 6);           // dust where it stood
  const nx = Math.max(1, Math.round(f.w / 22)), ny = Math.max(1, Math.round(f.h / 22)), cw = f.w / nx, ch = f.h / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = f.x + (i + 0.3 + Math.random() * 0.4) * cw, y = f.y + (j + 0.3 + Math.random() * 0.4) * ch;
    launchChunk(x, y, (x - cx) / (f.w + 1) + (ux || 0) * 0.7, (y - cy) / (f.h + 1) + (uy || 0) * 0.7, 60 + Math.random() * 90,
      chunkPts(cw * 0.55, 6, ch * 0.55), (i + j) % 2 ? pickCol(F.wreck) : F.bits[0]);
  }
  spray(cx, cy, 1, 0, 8, F.bits, F.shape, 170, 4, Math.PI * 2);
}
function damageDoor(d, dmg, hx, hy, ux, uy, l) {
  d.hp -= dmg;
  if (l) {                                                     // the hit shoves the slab round its hinge
    const a = l.base + l.th, lever = Math.hypot(hx - l.hx, hy - l.hy) / l.L;
    l.w += (ux * -Math.sin(a) + uy * Math.cos(a)) * dmg * 0.09 * lever;
  }
  spray(hx - ux * 2, hy - uy * 2, -ux, -uy, 3, WOOD_BITS, 'splinter', 120, 3, 2.4);
  if (d.hp <= 0 && !d.broken) {
    d.broken = true; setDoorSolid(d, false);
    for (const lf of d.leaves) {                               // each slab splits into planks that tumble away
      const a = lf.base + lf.th, ca = Math.cos(a), sa = Math.sin(a), hl = lf.L / 6;
      for (let q = 0; q < 3; q++) {
        const m = (q + 0.5) * lf.L / 3;
        launchChunk(lf.hx + ca * m, lf.hy + sa * m, ux + (Math.random() - 0.5) * 0.6, uy + (Math.random() - 0.5) * 0.6, 70 + Math.random() * 80,
          [[-hl, -2.6], [hl * 0.8, -2.6], [hl, -0.6], [hl * 0.9, 2.6], [-hl, 2.6], [-hl * 0.85, 0.2]], q % 2 ? '#6b5038' : '#5a4330', { edge: '#2e2214', rot: a, vz: 40 + Math.random() * 60 });
      }
    }
    spray((d.rx0 + d.rx1) / 2, (d.ry0 + d.ry1) / 2, ux, uy, 8, WOOD_BITS, 'splinter', 160, 4, 2.6);
  }
}
function damageCrate(k, dmg, hx, hy, ux, uy) {
  const hp = (crateHp.has(k) ? crateHp.get(k) : CRATE_HP) - dmg;
  crateHp.set(k, hp);
  spray(hx - ux * 2, hy - uy * 2, -ux, -uy, 2, WOOD_BITS, 'splinter', 120, 3, 2.4);
  if (hp > 0) {                                                 // a splintered bite out of the slats, and the bit flies off
    notch(hx - ux * 2, hy - uy * 2, 3 + Math.random() * 2.5, k, CRATE_NOTCH);
    launchChunk(hx, hy, -ux * 0.5 + (Math.random() - 0.5), -uy * 0.5 + (Math.random() - 0.5), 80 + Math.random() * 70, chunkPts(3.2, 5, 1.6), pickCol(WOOD_BITS));
  } else {
    grid[k] = 0; opq[k] = 0; solidAt[k] = '.';
    const x = (k % W) * T, y = ((k / W) | 0) * T;
    artG.fillStyle = (FLOOR_COL[floorAt[k]] || FLOOR_COL.z)[0]; artG.fillRect(x, y, T, T);
    artG.fillStyle = 'rgba(0,0,0,0.16)'; artG.fillRect(x + 4, y + 4, T - 8, T - 8);
    for (let q = 0; q < 5; q++) {                               // the slats come apart
      const sy = y + 8 + q * 8;
      launchChunk(x + T / 2 + (Math.random() - 0.5) * 10, sy, (Math.random() - 0.5) + ux * 0.8, (sy - y - T / 2) / T + uy * 0.8, 60 + Math.random() * 90,
        [[-18, -3], [16, -3], [19, 0], [17, 3], [-18, 3], [-20, 0]], q % 2 ? '#7a6240' : '#6a5436', { edge: '#3a2c1c', rot: (Math.random() - 0.5) * 0.4 });
    }
    spray(x + T / 2, y + T / 2, 1, 0, 8, WOOD_BITS, 'splinter', 160, 4, Math.PI * 2);
    rebuildEdges();
  }
}
/* A ragged bite of exposed concrete, kept inside the wall tile. */
function notch(x, y, r, k, cols) {
  const tx = (k % W) * T, ty = ((k / W) | 0) * T;
  artG.save();
  artG.beginPath(); artG.rect(tx, ty, T, T); artG.clip();
  artG.fillStyle = cols ? cols[0] : '#3b3b42'; artG.beginPath();
  for (let q = 0; q < 7; q++) {
    const a = q / 7 * Math.PI * 2, rr = r * (0.6 + Math.random() * 0.6);
    if (q) artG.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else artG.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  artG.closePath(); artG.fill();
  artG.fillStyle = cols ? cols[1] : '#2c2c32'; artG.beginPath(); artG.arc(x, y, r * 0.35, 0, Math.PI * 2); artG.fill();
  artG.restore();
}
/* Wall cells: dig them out, repaint what shows (the floor behind a hole, exposed material round its edge),
   and when a tile has a body-wide gap mark it walkable; fully dug out, it becomes floor. */
/* A round meets a wall: the material decides. It may glance off (concrete, metal); otherwise it digs in along its path,
   cell by cell, losing speed in each one, and either stops inside (the cell it reached survives, or it's spent) or
   comes out the far side with a spray of spall. Returns true if the round is finished. */
/* Walls don't break: a round marks the face (pock-mark in the wall's own material, cracks on concrete), throws dust and
   chips back out, and stops, or glances off concrete and metal. Light, sight, rounds and people never get through. */
function wallHit(ev, b, hx, hy, dmg) {
  const k = ev.k, mat = MAT[wallMat[k]] || MAT[2];
  impact(ev, hx, hy);
  const cos = Math.abs(b.ux * ev.nx + b.uy * ev.ny);
  if (mat.rico && b.bounces < RICO.max && b.v > RICO.minV && Math.random() < RICO.base + RICO.graze * (1 - cos) + (mat.name === 'metal' ? 0.3 : 0)) {
    markWall(k, hx, hy, ev.nx, ev.ny, mat, 0.6);
    const dot = b.ux * ev.nx + b.uy * ev.ny, rx = b.ux - 2 * dot * ev.nx, ry = b.uy - 2 * dot * ev.ny;
    const jt = (Math.random() * 2 - 1) * RICO.jitter, cj = Math.cos(jt), sj = Math.sin(jt);
    b.ux = rx * cj - ry * sj; b.uy = rx * sj + ry * cj; b.x = hx + ev.nx * 1.5; b.y = hy + ev.ny * 1.5;
    b.v *= RICO.keep; b.bounces++; b.rolled.clear(); impactFx('spark', hx, hy, ev.nx, ev.ny); sfxRico(hx, hy);
    return false;
  }
  markWall(k, hx, hy, ev.nx, ev.ny, mat, 1);
  spray(hx + ev.nx * 2, hy + ev.ny * 2, ev.nx, ev.ny, 4, mat.bits, 'chip', 130, 3, 1.6);   // dust and chips back out of the hole
  return true;
}
/* Paint a bullet mark just inside the wall face (clipped to the wall tile): a ragged crater of raw material, a dark core. */
function markWall(k, hx, hy, nx, ny, mat, sz) {
  const i = k % W, j = (k / W) | 0, x = hx - nx * 1.2, y = hy - ny * 1.2, g = artG, r = (2.4 + Math.random() * 1.6) * sz;
  g.save(); g.beginPath(); g.rect(i * T, j * T, T, T); g.clip();
  g.fillStyle = mat.exposed; g.globalAlpha = 0.85; g.beginPath();
  for (let q = 0; q < 7; q++) { const a = q / 7 * Math.PI * 2, rr = r * (0.7 + Math.random() * 0.6); q ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.globalAlpha = 1; g.fillStyle = 'rgba(10,10,12,0.8)'; g.beginPath(); g.arc(x - nx * 0.5, y - ny * 0.5, r * 0.4, 0, Math.PI * 2); g.fill();
  if (mat.name !== 'drywall') {                                        // hairline cracks running out from it
    g.strokeStyle = 'rgba(20,20,24,0.5)'; g.lineWidth = 0.5;
    for (let q = 0; q < 3; q++) { const a = Math.random() * Math.PI * 2, l = r * (1.5 + Math.random() * 1.5); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.5 + (Math.random() - 0.5), y + Math.sin(a) * l * 0.5 + (Math.random() - 0.5)); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  g.restore();
}
const wallish = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return true; const c = solidAt[j * W + i]; return c === '#' || c === 'G' || c === 'g' || c === 'E'; };
/* Windows break in strips: each pane tile is GLASS_SEG strips. A round knocks out the strip it crosses (and maybe its
   neighbours) as tumbling glass chunks; cracks run into the glass that's left. Once every strip is gone it's 'g'. */
const GLASS_SEG = 6;
const paneAcross = k => { const i = k % W, j = (k / W) | 0; return wallish(i - 1, j) || wallish(i + 1, j); };
function glassStrip(k, ox, oy, ux, uy) {                // which strip a ray crosses, where it meets the pane's centre line
  const i = k % W, j = (k / W) | 0, across = paneAcross(k);
  let u;
  if (across) { const t = Math.abs(uy) > 1e-4 ? ((j + 0.5) * T - oy) / uy : 0; u = ox + ux * t - i * T; }
  else { const t = Math.abs(ux) > 1e-4 ? ((i + 0.5) * T - ox) / ux : 0; u = oy + uy * t - j * T; }
  return clamp(Math.floor(u / (T / GLASS_SEG)), 0, GLASS_SEG - 1);
}
/* The pane is its own thing: a thin sheet of glass on the centre line of its tile, running along the wall. The rest of the
   tile is the window opening over the sill (people can't walk through it, but a barrel, smoke and falling glass can go in).
   paneAt: how far along a ray it crosses the pane inside tile k (-1 if it doesn't); paneIntact: glass still there. */
const winAt = (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); if (i < 0 || j < 0 || i >= W || j >= H) return false; const c = solidAt[j * W + i]; return c === 'G' || c === 'g'; };
function paneAt(k, ox, oy, ux, uy) {
  const i = k % W, j = (k / W) | 0, across = paneAcross(k);
  const t = across ? (Math.abs(uy) > 1e-6 ? ((j + 0.5) * T - oy) / uy : -1) : (Math.abs(ux) > 1e-6 ? ((i + 0.5) * T - ox) / ux : -1);
  if (t < 0) return -1;
  const u = across ? ox + ux * t - i * T : oy + uy * t - j * T;
  return u >= 0 && u <= T ? t : -1;
}
const paneIntact = (k, ox, oy, ux, uy) => { if (solidAt[k] !== 'G') return false; const sg = glassSeg.get(k); return !sg || !!sg[glassStrip(k, ox, oy, ux, uy)]; };
function paneReach(x, y, c, s, maxD) {                  // distance along a ray to the first glass still in a pane (maxD if none)
  let mx = Math.floor(x / T), my = Math.floor(y / T), best = maxD, t = 0;
  const ddx = Math.abs(1 / (c || 1e-9)), ddy = Math.abs(1 / (s || 1e-9)), stepX = c < 0 ? -1 : 1, stepY = s < 0 ? -1 : 1;
  let sideX = (c < 0 ? x / T - mx : mx + 1 - x / T) * ddx, sideY = (s < 0 ? y / T - my : my + 1 - y / T) * ddy;
  while (t * T < best) {
    if (mx >= 0 && my >= 0 && mx < W && my < H && solidAt[my * W + mx] === 'G') {
      const k = my * W + mx, tp = paneAt(k, x, y, c, s);
      if (tp >= 0 && tp < best && paneIntact(k, x, y, c, s)) best = tp;
    }
    if (sideX < sideY) { t = sideX; sideX += ddx; mx += stepX; } else { t = sideY; sideY += ddy; my += stepY; }
  }
  return best;
}
function paneCross(x0, y0, x1, y1) {                    // does a short move pass through glass that's still in a pane?
  for (let e = 0; e < 2; e++) {
    const i = Math.floor((e ? x1 : x0) / T), j = Math.floor((e ? y1 : y0) / T);
    if (i < 0 || j < 0 || i >= W || j >= H || (e && i === Math.floor(x0 / T) && j === Math.floor(y0 / T))) continue;
    const k = j * W + i;
    if (solidAt[k] !== 'G') continue;
    const across = paneAcross(k), L = across ? (j + 0.5) * T : (i + 0.5) * T, a0 = across ? y0 : x0, a1 = across ? y1 : x1;
    if (a0 === a1 || (a0 - L) * (a1 - L) > 0) continue;
    const f = (L - a0) / (a1 - a0), u = across ? x0 + (x1 - x0) * f - i * T : y0 + (y1 - y0) * f - j * T;
    if (u < 0 || u > T) continue;
    const sg = glassSeg.get(k);
    if (!sg || sg[clamp(Math.floor(u / (T / GLASS_SEG)), 0, GLASS_SEG - 1)]) return true;
  }
  return false;
}
/* For things above the sill (smoke, glass falling out of a frame): window openings are open, only glass still in a pane
   stops them; everything else that's solid for bodies stops them too. */
const airWall = (x0, y0, x1, y1) => winAt(x1, y1) ? paneCross(x0, y0, x1, y1) : wall(Math.floor(x1 / T), Math.floor(y1 / T));
const paneEvent = (k, d, b) => paneAcross(k) ? { d, kind: 'glass', nx: 0, ny: -Math.sign(b.uy), k } : { d, kind: 'glass', nx: -Math.sign(b.ux), ny: 0, k };
function paintGlassGap(k, sg, q) {                      // a strip's glass is gone: the bare frame shows, broken off jaggedly, a sliver or two still stuck in it, cracks running on into the glass that's left
  const i = k % W, j = (k / W) | 0, x = i * T, y = j * T, across = paneAcross(k), sl = T / GLASS_SEG, u0 = q * sl, u1 = u0 + sl, g = artG;
  const P = (u, v) => across ? [x + u, y + T / 2 + v] : [x + T / 2 + v, y + u];
  const path = pts => { g.beginPath(); g.moveTo(...P(...pts[0])); for (let n = 1; n < pts.length; n++) g.lineTo(...P(...pts[n])); g.closePath(); };
  const glassL = q > 0 && sg[q - 1], glassR = q < GLASS_SEG - 1 && sg[q + 1];
  // the opening: where glass is left beside it the break is jagged (biting into it or leaving a lip); into a gap that's already there it just joins up
  const pts = [];
  for (let n = 0; n <= 4; n++) pts.push([u0 + (glassL ? -1.6 + Math.random() * 3.6 : -0.8), 5 - n * 2.5]);
  for (let n = 0; n <= 4; n++) pts.push([u1 + (glassR ? -2 + Math.random() * 3.6 : 0.8), -5 + n * 2.5]);
  path(pts); g.fillStyle = '#41464d'; g.fill();                                          // the empty frame
  g.strokeStyle = '#25282d'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(...P(u0 - (glassL ? 0 : 0.8), 0.3)); g.lineTo(...P(u1 + (glassR ? 0 : 0.8), 0.3)); g.stroke();   // the glazing channel
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(...P(u0, -2.4)); g.lineTo(...P(u1, -2.4)); g.stroke();
  // a sliver or two still stuck in the channel: thin edge-on bits, or shards leaning out of it
  const nS = Math.random() < 0.3 ? 0 : 1 + (Math.random() * 2.2 | 0);
  for (let n = 0; n < nS; n++) {
    const u = u0 + Math.random() * sl, len = 1.5 + Math.random() * 5;
    g.fillStyle = 'rgba(170,212,238,' + (0.55 + Math.random() * 0.3).toFixed(2) + ')'; g.strokeStyle = 'rgba(235,248,255,0.8)'; g.lineWidth = 0.5;
    if (Math.random() < 0.5) {                                                             // edge-on: a short sliver along the channel
      const v0 = (Math.random() - 0.5) * 1.2, v1 = v0 + (Math.random() - 0.5) * 1.6;
      path([[u, v0 - 0.6], [u + len, v1 - 0.4], [u + len * 0.8, v1 + 0.5], [u, v0 + 0.6]]); g.fill(); g.stroke();
    } else {                                                                               // tipped out of the frame: a pointed shard
      const w = 1.5 + Math.random() * 3, side = Math.random() < 0.5 ? -1 : 1;
      path([[u, 0], [u + w, 0], [u + Math.random() * w, side * (1.8 + Math.random() * 3)]]); g.fill(); g.stroke();
    }
  }
  // cracks running on into the glass either side
  g.strokeStyle = 'rgba(230,245,255,0.55)'; g.lineWidth = 0.6;
  for (const [has, ue, dir] of [[glassL, u0, -1], [glassR, u1, 1]]) {
    if (!has) continue;
    for (let n = 1 + (Math.random() * 2.5 | 0); n > 0; n--) {
      let u = ue, v = (Math.random() - 0.5) * 8;
      g.beginPath(); g.moveTo(...P(u, v));
      for (let m = 2 + (Math.random() * 3 | 0); m > 0; m--) {
        u += dir * (1.5 + Math.random() * 3.5); v = clamp(v + (Math.random() - 0.5) * 5, -4.5, 4.5); g.lineTo(...P(u, v));
        if (Math.random() < 0.25) { g.lineTo(...P(u + dir * (1 + Math.random() * 2), clamp(v + (Math.random() - 0.5) * 6, -4.5, 4.5))); g.moveTo(...P(u, v)); }   // a branch
      }
      g.stroke();
    }
  }
  // fine glass dust sprinkled on the sill either side
  for (let n = 2 + (Math.random() * 5 | 0); n > 0; n--) {
    const u = u0 - 2 + Math.random() * (sl + 4), v = (Math.random() < 0.5 ? -1 : 1) * (6.5 + Math.random() * Math.random() * 14), r = 0.4 + Math.random() * 0.7;
    g.fillStyle = 'rgba(205,230,246,' + (0.4 + Math.random() * 0.4).toFixed(2) + ')'; g.fillRect(...P(u, v), r, r);
  }
}
function shatterWindow(k, b, hx, hy) {
  const sg = glassSeg.get(k) || glassSeg.set(k, new Uint8Array(GLASS_SEG).fill(1)).get(k);
  const q0 = glassStrip(k, b.x, b.y, b.ux, b.uy), across = paneAcross(k), i = k % W, j = (k / W) | 0, sl = T / GLASS_SEG;
  const x = i * T, y = j * T;
  const hit = [q0];
  for (const dir of [-1, 1]) for (let n = 1, pr = 0.55; n <= 2 && Math.random() < pr; n++, pr *= 0.45) hit.push(q0 + dir * n);
  for (const q of hit) {
    if (q < 0 || q >= GLASS_SEG || !sg[q]) continue;
    sg[q] = 0; paintGlassGap(k, sg, q);
    for (let n = 2 + (Math.random() * 3 | 0); n > 0; n--) {      // pieces fall out of the frame: most carried on with the round, some back, some just drop onto the sill
      const u = (q + Math.random()) * sl, off = (Math.random() - 0.5) * 2;
      const cx = across ? i * T + u : (i + 0.5) * T + off, cy = across ? (j + 0.5) * T + off : j * T + u;
      const r = Math.random(), back = r < 0.22 ? -0.7 : 1, drop = r > 0.7, sz = 1.4 + Math.random() * (drop ? 2.2 : 3.6);
      launchChunk(cx, cy, b.ux * back + (Math.random() - 0.5) * 0.9, b.uy * back + (Math.random() - 0.5) * 0.9, drop ? 10 + Math.random() * 35 : 45 + Math.random() * 130,
        chunkPts(sz, 3 + (Math.random() * 3 | 0), sz * (0.45 + Math.random() * 0.6)), '#a8cbe4',
        { alpha: 0.45 + Math.random() * 0.3, edge: 'rgba(235,245,255,0.85)', vz: drop ? 5 + Math.random() * 25 : 25 + Math.random() * 70 });
    }
  }
  if (sg.every(v => !v)) solidAt[k] = 'g';
  spray(hx, hy, b.ux, b.uy, 4, GLASS_BITS, 'shard', 170, 3, 1.4);
  spray(hx, hy, -b.ux, -b.uy, 2, GLASS_BITS, 'shard', 90, 3, 1.6);
  impactFx('glass', hx, hy, b.ux, b.uy);
  const cx = x + T / 2, cy = y + T / 2;
  noiseBy(ownerOf(b), cx, cy, GLASS_NOISE, true);
}


/* ---------- debris: flies, skids, bounces off walls, then settles into the floor art for good ---------- */
function spray(x, y, nx, ny, n, cols, shape, speed, size, spread) {
  const base = Math.atan2(ny, nx);
  for (let i = 0; i < n; i++) {
    const a = base + (Math.random() - 0.5) * spread, v = speed * (0.35 + Math.random() * 0.9);
    debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 24,
      col: cols[(Math.random() * cols.length) | 0], shape, size: size * (0.6 + Math.random() * 0.8), fric: 5.5, t: 0,
      v0: shape === 'blood' ? v : 0, a0: a,                     // blood lands stretched along the way it flew
      ...(shape === 'blood' ? { z: BLOODFX.z0 * (0.6 + Math.random() * 0.6), vz: BLOODFX.vz * (Math.random() - 0.3), fric: 2 } : {}) });   // ...after an arc through the air
  }
}
/* Chunks: real fragments of the thing that broke. They pop up (z), tumble, land, skid, bounce off walls, then settle
   into the floor art for good. `pts` is the outline around the chunk's centre; `opt`: edge colour, alpha, vz, rot. */
const CHUNK = { grav: 520, bounce: 0.3, airDrag: 0.6, fric: 4 };
function chunkPts(rx, n, ry) {
  const pts = [], a0 = Math.random() * 6.28, m = n || 6;
  for (let q = 0; q < m; q++) {
    const a = a0 + (q + (Math.random() - 0.5) * 0.6) / m * Math.PI * 2, k = 0.55 + Math.random() * 0.5;
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * (ry || rx) * k]);
  }
  return pts;
}
function launchChunk(x, y, dx, dy, speed, pts, col, opt) {
  const o = opt || {}, l = Math.hypot(dx, dy) || 1, a = Math.atan2(dy / l, dx / l) + (Math.random() - 0.5) * 0.7, v = speed * (0.7 + Math.random() * 0.5);
  debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: o.rot !== undefined ? o.rot : Math.random() * 6.28, vr: (Math.random() - 0.5) * 12,
    col, edge: o.edge || 'rgba(0,0,0,0.45)', alpha: o.alpha || 1, shape: 'poly', pts, size: 1, fric: CHUNK.fric, t: 0,
    z: 0.5, vz: o.vz !== undefined ? o.vz : 70 + Math.random() * 90 });
}
const pickCol = cols => cols[(Math.random() * cols.length) | 0];
/* Empty magazine dropped during a reload: falls by the shooter's feet and stays there. */
function dropMag(x, y, a, size = 1, shape = 'mag') {
  const c = Math.cos(a), s = Math.sin(a), lx = 25 * CHAR_SCALE, ly = 8 * CHAR_SCALE;
  const v = 40 + Math.random() * 50;
  debris.push({ x: x + c * lx - s * ly, y: y + s * lx + c * ly, vx: -s * v + c * 10, vy: c * v + s * 10,
    rot: a + Math.PI / 2, vr: (Math.random() - 0.5) * 8, col: '#25262c', shape, size, fric: 7, t: 0 });
}
