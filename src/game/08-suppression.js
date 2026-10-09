/* ================= SUPPRESSION =================
   Rounds cracking past you, smacking into things beside you, or hitting you pile up stress. Under fire your
   aim shakes and your cone opens up, and your vision blurs and tunnels in (bots get the same shaky aim and
   hesitate to fire). It eases off, faster behind cover. Win the fight before it comes to you. */
const SUPP_FX = { shake: 0.5, ahead: 0.22, clear0: 0.38, clear1: 0.26, centre: 0.15, vig: 0.95, vigIn: 0.5, vigOut: 0.42 };   // suppression look: camera jitter (px per unit), tunnel centre (share of screen height ahead of you), sharp-spot radius shrinking with stress, blur left in the middle, vignette darkness at the edge, its inner / outer radius. Strength follows sqrt(supp), so even one near miss reads on a dark screen
const SUPP = { near: 55, whiz: 0.16, impact: 0.12, hit: 0.35, jolt: 0.1, decay: 0.32, decayCover: 0.6, cone: 0.16, tremor: 4, soften: 0.35 };
const TUNNEL = { near: 150, whiz: 0.42, impact: 0.3, hit: 0.75, attack: 7, hold: 1.1, decay: 0.5 };   // your tunnel vision under fire: rounds cracking past within near px, landing near you or hitting you push it up almost at once (eases in at attack per s), it holds for hold s after the last one, then fades at decay per s
let tunT = 0, tunHold = 0;
function tunnelHit(v) { if (state !== 'play') return; tunT = Math.min(1, tunT + v); tunHold = TUNNEL.hold; }
function tunnelStep(dt) { tunHold -= dt; if (tunHold <= 0) tunT = Math.max(0, tunT - TUNNEL.decay * dt); p.tun = (p.tun || 0) + (tunT - (p.tun || 0)) * Math.min(1, TUNNEL.attack * dt * (tunT > (p.tun || 0) ? 1 : 0.5)); }
function addSupp(c, v) { if (!c || c.dead) return; c.supp = Math.min(1, (c.supp || 0) + v); }
function suppressAt(x, y, owner, r, v) {
  const test = c => { if (!c || c.dead || c === owner) return; const d = Math.hypot(c.x - x, c.y - y); if (d < r) addSupp(c, v * (1 - d / r)); };
  if (state === 'play') test(p);
  for (const b of bots) test(b);
  for (const a of allies) test(a);
}
function easeSupp(c, dt) { c.supp = Math.max(0, (c.supp || 0) - dt * (c.cov && c.cov.inCover ? SUPP.decayCover : SUPP.decay)); }

initWorld();

/* Grid raycast (DDA). Returns distance to first wall, or maxD. */
function cast(ox, oy, dx, dy, maxD, blocks) {
  const hit = blocks || wall;
  let mx = Math.floor(ox / T), my = Math.floor(oy / T);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  let stepX, stepY, sideX, sideY;
  if (dx < 0) { stepX = -1; sideX = (ox / T - mx) * ddx; } else { stepX = 1; sideX = (mx + 1 - ox / T) * ddx; }
  if (dy < 0) { stepY = -1; sideY = (oy / T - my) * ddy; } else { stepY = 1; sideY = (my + 1 - oy / T) * ddy; }
  const maxT = maxD / T;
  let t = 0;
  while (t < maxT) {
    if (sideX < sideY) { t = sideX; sideX += ddx; mx += stepX; }
    else { t = sideY; sideY += ddy; my += stepY; }
    if (t >= maxT) return maxD;
    if (hit(mx, my)) {
      return t * T;
    }
  }
  return maxD;
}

function hitsWall(x, y, r) {
  const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
  const y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    if (!wall(i, j)) continue;
    const cx = clamp(x, i * T, (i + 1) * T), cy = clamp(y, j * T, (j + 1) * T);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}
function moveCircle(e, dx, dy) {
  if (!hitsWall(e.x + dx, e.y, e.r)) e.x += dx;
  if (!hitsWall(e.x, e.y + dy, e.r)) e.y += dy;
}

/* ---------- Pathfinding (breadth-first search on the tile grid) ---------- */
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const bfsPrev = new Int16Array(W * H), bfsQ = new Int16Array(W * H);
const staticBlocked = (i, j) => i < 0 || j < 0 || i >= W || j >= H || (grid[j * W + i] === 1 && doorAt[j * W + i] < 0);
const navBlocked = (i, j) => staticBlocked(i, j) || occ[j * W + i] === 1;
function findPath(x0, y0, x1, y1) {
  return bfsPath(x0, y0, x1, y1, navBlocked) || bfsPath(x0, y0, x1, y1, staticBlocked) || [];
}
function bfsPath(x0, y0, x1, y1, blocked) {
  const sx = Math.floor(x0 / T), sy = Math.floor(y0 / T), gx = Math.floor(x1 / T), gy = Math.floor(y1 / T);
  if (staticBlocked(sx, sy) || staticBlocked(gx, gy)) return null;
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [{ x: x1, y: y1 }];
  bfsPrev.fill(-1); bfsPrev[start] = start;
  let qh = 0, qt = 0; bfsQ[qt++] = start;
  while (qh < qt) {
    const cur = bfsQ[qh++];
    if (cur === goal) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
      if (blocked(nx, ny) && ni !== goal) continue;
      if (dx && dy && (blocked(cx + dx, cy) || blocked(cx, cy + dy))) continue;   // no corner cutting
      if (bfsPrev[ni] !== -1) continue;
      bfsPrev[ni] = cur; bfsQ[qt++] = ni;
    }
  }
  if (bfsPrev[goal] === -1) return null;
  const out = [];
  for (let c = goal; c !== start; c = bfsPrev[c]) out.push({ x: (c % W + 0.5) * T, y: (((c / W) | 0) + 0.5) * T });
  out.reverse();
  out[out.length - 1] = { x: x1, y: y1 };
  return out;
}
/* Can a circle of radius r travel straight from A to B? */
function clearWide(ox, oy, tx, ty, r) {
  const dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  for (const off of [-r, 0, r]) {
    const sx = ox + nx * off, sy = oy + ny * off;
    if (wall(Math.floor(sx / T), Math.floor(sy / T))) return false;
    if (cast(sx, sy, ux, uy, d) < d - 2) return false;
  }
  for (const f of pieces) if (!f.broken && segBox(ox, oy, ux, uy, d, f.x - r, f.y - r, f.w + 2 * r, f.h + 2 * r) >= 0) return false;
  return true;
}

