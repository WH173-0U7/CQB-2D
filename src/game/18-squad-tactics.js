/* ================= SQUAD TACTICS =================
   Whoever sees you radios it in (`intel`). The nearest few bots form a team and get roles, re-thought twice a second:
   - suppress: the one with eyes on you holds ground; when it loses sight it keeps putting bursts into where you were,
     to pin you down while the others move.
   - flank: up to two go quietly (slower = softer footsteps) to a spot off your side or behind you, away from where your
     light points, then engage from there.
   - cover: take a hidden spot near you, reload there, step out to a spot that sees you, fire, duck back when it gets hot.
   - ambush: with no fresh contact, hide where you can't see, light off, and wait for you to walk in.
   A lone bot uses cover. Roles drop when the intel goes stale. Out-of-ammo bots stay out of it (see dryBot). */
const SQUAD = { team: 4, radio: 450, fresh: 12, think: 0.5, contact: 1.5, flankers: 2, flankR: [160, 270], flankArc: [1.2, 2.3], quiet: 0.7, flankWait: 3,
  suppressFor: 6, suppressMin: 40, supRate: 0.2, supBurst: [3, 6], supPause: [0.6, 1.3],
  coverR: 5, coverDist: [110, 290], boundR: 6, wideR: 9, wideDist: [110, 330], boundGain: 70, boundPause: [0.8, 1.6], expoR: 10, expoPen: 60, ambushR: 8, ambushDist: [90, 320], retry: 1.5, hideT: [1.0, 2.2], peekT: [1.2, 2.2], supPeekT: [2.5, 4], ambushT: [10, 18] };
let intel = null, squadT = 0;
const rnd = ([a, b]) => a + Math.random() * (b - a);
const ammoLeft = b => b.ammo + b.mags.reduce((n, m) => n + m, 0) + (b.side ? b.side.ammo : 0);
const botReady = b => b.reloadT <= 0 && !b.side.sw && !(b.side.reload > 0) && (b.side.out ? b.side.ammo : b.ammo) > 0;   // the gun in hand is loaded and up
function setRole(b, r) { if (b.role === r) return; clearRole(b); b.role = r; b.tac = { phase: 'go', until: 0, goal: null, ref: null, n: 0, wait: 0, retry: 0 }; }
function clearRole(b) { b.role = null; b.tac = null; b.dark = false; }
function squadThink(dt, t) {
  squadT -= dt; if (squadT > 0) return; squadT = SQUAD.think;
  const alive = bots.filter(b => !b.dead);
  if (intel && t - intel.t > SWEEP.lost) { sweepThink(t, alive); return; }       // lost you for a while: rearm, then clear rooms
  sweep = null;
  if (!intel || t - intel.t > SQUAD.fresh) { for (const b of alive) if (b.role) clearRole(b); return; }
  const dI = b => Math.hypot(b.x - intel.x, b.y - intel.y);
  const team = alive.filter(b => dI(b) < SQUAD.radio && ammoLeft(b) > 0).sort((a, c) => dI(a) - dI(c)).slice(0, SQUAD.team);
  for (const b of alive) if (b.seesP && !team.includes(b) && ammoLeft(b) > 0) team.push(b);        // anyone in the fight is in the squad
  if (!team.length) { for (const b of alive) if (b.role) clearRole(b); return; }                   // nobody left who can fight
  if (!expoAt || Math.hypot(expoAt.x - intel.x, expoAt.y - intel.y) > T / 2) computeExposure(intel);
  for (const b of alive) if (b.role && !team.includes(b)) clearRole(b);
  for (const b of team) if (b.state === 'patrol') investigate(b, intel.x, intel.y);       // called in over the radio
  if (team.length === 1) { setRole(team[0], 'cover'); return; }
  const contact = t - intel.t < SQUAD.contact;
  const sup = team.find(b => b.role === 'suppress' && (b.seesP || !contact)) || team.find(b => b.seesP) || team[0];
  setRole(sup, 'suppress');
  let nf = 0;
  for (const b of team.filter(b => b !== sup).sort((a, c) => (PZ(c).flank ? 1 : 0) - (PZ(a).flank ? 1 : 0))) {   // rushers flank first
    if (nf < SQUAD.flankers && (b.role === 'flank' || !b.seesP) && !(PZ(b).ambush && !b.seesP && b.role === 'ambush')) { setRole(b, 'flank'); b.flankFrom = sup; nf++; }
    else setRole(b, contact && !(PZ(b).ambush && !b.seesP) ? 'cover' : 'ambush');   // the cautious would rather lie in wait
  }
}
function botTryFire(b, dt, d, to) {
  if (b.reactT > 0) { b.reactT -= dt; return; }
  if (d < BOT.fireRange * (1 + STEADY_RANGE * b.steady) * (bKit(b, 'dot') ? 1 + ATTFX.dot.ak : 1) && Math.abs(angDiff(to, b.gun ? b.gun.ang : b.ang + b.sway)) < b.half * 1.3 + Math.atan2(p.r, d) && gunCanFire(b) && b.fireCd <= 0 && botReady(b) && (!b.cov || Math.abs(b.cov.sh) > 0.8)) {
    const mate = friendInLine(b, bots, d, b.half);
    if (mate) clearLine(b, mate, dt);                                              // a teammate in the way: hold fire, open the line
    else if (Math.random() < (b.supp || 0) * 0.6 * PZ(b).nerve) b.fireCd = 0.15 + Math.random() * 0.2;   // suppressed: flinches instead of firing
    else botShoot(b, d);
  }
}
/* A hidden spot near you (no line from you to it, within coverDist) with a neighbouring tile that does see you (the peek). */
function bodyHidden(x, y, I, r) {                      // the whole body out of your line, not just its centre
  const dx = x - I.x, dy = y - I.y, d = Math.hypot(dx, dy) || 1, ox = -dy / d * r, oy = dx / d * r;
  return !losClear(I.x, I.y, x + ox, y + oy) && !losClear(I.x, I.y, x - ox, y - oy);
}
function findCover(b, I, amb, win, wide) {                    // ambushers look further and don't need a peek spot; `win` = distance-from-you window
  const bi = Math.floor(b.x / T), bj = Math.floor(b.y / T), R = wide ? SQUAD.wideR : amb ? SQUAD.ambushR : win ? SQUAD.boundR : SQUAD.coverR, [d0, d1] = wide ? SQUAD.wideDist : win || (amb ? SQUAD.ambushDist : SQUAD.coverDist), cands = [];
  for (let n = 0; n < (wide ? 90 : 50); n++) {
    const i = bi + Math.round((Math.random() * 2 - 1) * R), j = bj + Math.round((Math.random() * 2 - 1) * R);
    if (navBlocked(i, j)) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T, dPl = Math.hypot(x - I.x, y - I.y);
    if (dPl < d0 || dPl > d1) continue;
    if (losClear(I.x, I.y, x, y) || !bodyHidden(x, y, I, b.r)) {   // in the open from you, unless something sturdy is right in between: low cover
      const lc = lowCoverToward(x, y, I, b.r);
      if (lc) cands.push({ x: lc[0], y: lc[1], px: lc[0], py: lc[1], low: true, sc: Math.hypot(x - b.x, y - b.y) + (win ? dPl * 0.6 : Math.abs(dPl - 170) * 0.5) });
      continue;
    }
    let pk = amb ? [x, y] : null;
    for (const [a, c] of DIRS) {
      if (navBlocked(i + a, j + c)) continue;
      const nx = (i + a + 0.5) * T, ny = (j + c + 0.5) * T;
      if (losClear(nx, ny, I.x, I.y)) { pk = [nx, ny]; break; }
    }
    if (pk) cands.push({ x, y, px: pk[0], py: pk[1], sc: Math.hypot(x - b.x, y - b.y) + (win ? dPl * 0.6 : Math.abs(dPl - 170) * 0.5) });
  }
  cands.sort((a, c) => a.sc - c.sc);
  for (const c of cands.slice(0, 3)) if (Math.hypot(c.x - b.x, c.y - b.y) < 24 || findPath(b.x, b.y, c.x, c.y).length) return c;
  return !wide && !amb && !win ? findCover(b, I, false, null, true) : null;     // nothing close: look further out, to the edge of firing range
}
/* No cover anywhere near: darkness is cover. A firing spot off to the side of where your light points, within range. */
function findShadow(b, I) {
  const cands = [];
  for (let n = 0; n < 24; n++) {
    const a = p.aim + (n % 2 ? 1 : -1) * rnd([1.1, 2.4]), rr = rnd([170, 290]);
    const i = Math.floor((I.x + Math.cos(a) * rr) / T), j = Math.floor((I.y + Math.sin(a) * rr) / T);
    if (navBlocked(i, j)) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T;
    if (litByScene(x, y, null)) continue;                                          // under a lamp or in someone's beam isn't shadow
    cands.push({ x, y, px: x, py: y, shadow: true, sc: Math.hypot(x - b.x, y - b.y) });
  }
  cands.sort((a, c) => a.sc - c.sc);
  for (const c of cands.slice(0, 3)) if (findPath(b.x, b.y, c.x, c.y).length) return c;
  return null;
}
/* Low cover: something sturdy (heavy or bolted furniture, counters, cars, sills) within a tile of (x, y) on the line
   toward you. Returns the spot pressed up against it on the far side (where they duck behind it), or null. */
function lowCoverAt(x, y) {
  const i = Math.floor(x / T), j = Math.floor(y / T);
  if (i >= 0 && j >= 0 && i < W && j < H && coverComp[j * W + i] >= 0) return true;
  for (const f of pieces) if (!f.broken && (f.fixed || f.mass >= 1) && x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) return true;
  return false;
}
function lowCoverToward(x, y, I, r) {
  const d = Math.hypot(I.x - x, I.y - y) || 1, ux = (I.x - x) / d, uy = (I.y - y) / d;
  for (let s = 6; s <= T; s += 6) if (lowCoverAt(x + ux * s, y + uy * s)) {
    const back = Math.max(0, s - r - 4);
    return [x + ux * back, y + uy * back];
  }
  return null;
}
/* Off your side or behind you, relative to the suppressor; with a line to you; preferably outside where your light points. */
function findFlank(b, sup) {
  const S = Math.atan2((sup || b).y - intel.y, (sup || b).x - intel.x), cands = [];
  for (let n = 0; n < 24; n++) {
    const a = S + (n % 2 ? 1 : -1) * rnd(SQUAD.flankArc), rr = rnd(SQUAD.flankR);
    const i = Math.floor((intel.x + Math.cos(a) * rr) / T), j = Math.floor((intel.y + Math.sin(a) * rr) / T);
    if (navBlocked(i, j)) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T;
    if (!losClear(x, y, intel.x, intel.y)) continue;
    if (!lowCoverToward(x, y, intel, b.r) && litByScene(x, y, null)) continue;    // somewhere with cover, or at least dark
    const offAim = Math.abs(angDiff(Math.atan2(y - p.y, x - p.x), p.aim));
    cands.push({ x, y, sc: Math.hypot(x - b.x, y - b.y) - offAim * 80 });
  }
  cands.sort((a, c) => a.sc - c.sc);
  for (const c of cands.slice(0, 3)) if (findPath(b.x, b.y, c.x, c.y).length) return c;
  return null;
}
/* Exposure: which tiles near you can be seen from where you are (or were). Covered routes pay a heavy toll for every
   exposed tile, so bots go the long way round behind walls and furniture when there is one. */
const expo = new Uint8Array(W * H);
let expoAt = null;
function computeExposure(I) {
  expo.fill(0); expoAt = { x: I.x, y: I.y };
  const ci = Math.floor(I.x / T), cj = Math.floor(I.y / T), R = SQUAD.expoR;
  for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
    if (staticBlocked(i, j)) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T;
    if (Math.hypot(x - I.x, y - I.y) < BOT.sight * 1.4 && losClear(I.x, I.y, x, y)) expo[j * W + i] = 1;
  }
}
const sDist = new Int32Array(W * H), sPrev = new Int16Array(W * H);
function safePath(x0, y0, x1, y1) {                      // Dijkstra over the tiles, exposed ones cost extra; falls back to the plain route
  const sx = Math.floor(x0 / T), sy = Math.floor(y0 / T), gx = Math.floor(x1 / T), gy = Math.floor(y1 / T);
  if (staticBlocked(sx, sy) || staticBlocked(gx, gy)) return findPath(x0, y0, x1, y1);
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [{ x: x1, y: y1 }];
  sDist.fill(0x3fffffff); sPrev.fill(-1); sDist[start] = 0;
  const heap = [start];                                    // keyed by sDist
  const up = i => { while (i > 0) { const q = (i - 1) >> 1; if (sDist[heap[q]] <= sDist[heap[i]]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const down = () => { let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && sDist[heap[l]] < sDist[heap[m]]) m = l; if (r < heap.length && sDist[heap[r]] < sDist[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  while (heap.length) {
    const cur = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; down(); }
    if (cur === goal) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
      if (navBlocked(nx, ny) && ni !== goal) continue;
      if (dx && dy && (navBlocked(cx + dx, cy) || navBlocked(cx, cy + dy))) continue;
      const nd = sDist[cur] + (dx && dy ? 14 : 10) + expo[ni] * SQUAD.expoPen;
      if (nd < sDist[ni]) { const fresh = sDist[ni] === 0x3fffffff; sDist[ni] = nd; sPrev[ni] = cur; if (fresh) { heap.push(ni); up(heap.length - 1); } else up(heap.indexOf(ni)); }
    }
  }
  if (sPrev[goal] === -1) return findPath(x0, y0, x1, y1);
  const out = [];
  for (let c = goal; c !== start; c = sPrev[c]) out.push({ x: (c % W + 0.5) * T, y: (((c / W) | 0) + 0.5) * T });
  out.reverse(); out[out.length - 1] = { x: x1, y: y1 }; out.safe = true;
  return out;
}
/* Careful movement: a route that crosses more than ROUTE.maxRun tiles you can see in the light (expo + lit) waits, unless
   you're pinned down (suppressed) or they're already standing in the open (then getting out is the point). */
const ROUTE = { maxRun: 2, pinned: 0.4 };
function routeOk(b) {
  if (!expoAt || (p.supp || 0) >= ROUTE.pinned || !b.path || !b.path.length) return true;
  const seen = (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); return i >= 0 && j >= 0 && i < W && j < H && expo[j * W + i] && litByScene(x, y, null); };
  if (seen(b.x, b.y)) return true;
  let run = 0;
  for (const n of b.path) { run = seen(n.x, n.y) ? run + 1 : 0; if (run > Math.max(1, ROUTE.maxRun + PZ(b).run)) return false; }
  return true;
}
/* Closing in without walking into the open: dash to the next hidden spot that's nearer to you, pause, repeat.
   Returns false if there's nowhere better to go (the caller then holds its ground instead of walking in). */
function advanceByCover(b, dt, t, d) {
  const bd = b.bound;
  if (bd && bd.phase === 'pause') { if (t < bd.until) return true; b.bound = null; }
  if (!b.bound) {
    if (t < (b.boundRetry || 0)) return false;
    const c = intel && findCover(b, intel, false, [70, Math.max(90, d - SQUAD.boundGain)]);
    if (!c) { b.boundRetry = t + SQUAD.retry; return false; }
    b.bound = { phase: 'go', goal: c }; b.path = safePath(b.x, b.y, c.x, c.y);
    if (!routeOk(b)) { b.bound = null; b.path = []; b.boundRetry = t + 1; return false; }   // too exposed right now: hold
  }
  if (followPath(b, BOT.searchSpeed, dt) && Math.hypot(b.bound.goal.x - b.x, b.bound.goal.y - b.y) > 10) return true;
  b.bound = { phase: 'pause', until: t + rnd(SQUAD.boundPause) };
  return true;
}
