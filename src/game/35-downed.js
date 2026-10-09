/* ================= DOWNED =================
   A lethal hit doesn't always kill outright: with DOWN.chance the body goes down alive. It falls like any ragdoll, then
   squirms where it lies or drags itself away from the fight on its hands (reach, plant, pull), smearing a blood trail,
   weakening until it bleeds out after DOWN.life s. Down is out of the fight: nobody aims at, locks onto or shoots a
   downed body (bots count it as dead, your auto-fire skips it), though a stray round that hits one finishes it.
   Anyone can go down, you included: then the move stick drags you until you bleed out. */
const DOWN = { chance: 0.4, crawl: 0.8, life: [12, 22], ease: 3.8, gestGap: [0.15, 0.8], breath: 1.1, two: 0.45,
  reachT: 0.32, pullT: 0.55, turnAt: 1.0, turnMax: 1.1, turnT: 0.4, reach: 22, stroke: 30, goalSteps: 8, arrive: 16, rest: [0.05, 0.25], crawlTo: 0.15, trail: 4, hitR: 8, stuckT: 4,
  modes: [['crawl', 0.3], ['oneArm', 0.25], ['frog', 0.25], ['heels', 0.2]] };   // how a bot drags itself (you always crawl hand over hand)
/* Motion is kinematic and eased (joints glide toward targets set in the body's own frame; no random kicks), so a downed
   body moves like a hurt person: slow, deliberate, with long still moments. Body frame: a = along the spine from the
   pelvis toward the head, b = sideways; joints 3/5/7/9/11/13 are one side (s = A.side), 4/6/8/10/12/14 the other. */
function bodyFrame(P) {
  const ux = P[1].x - P[2].x, uy = P[1].y - P[2].y, l = Math.hypot(ux, uy) || 1;
  return { ox: P[2].x, oy: P[2].y, ux: ux / l, uy: uy / l, vx: -uy / l, vy: ux / l };
}
const bodyPt = (F, a, b) => ({ x: F.ox + (F.ux * a + F.vx * b) * CHAR_SCALE, y: F.oy + (F.uy * a + F.vy * b) * CHAR_SCALE });
/* What a hurt body does lying there. Each gesture: [weight, (s, J) → targets [joint, a, b], glide s, hold [min, max], (s, J) → targets
   to return to (or null)]. s = the side it happens on (in the body frame), J(s, j, k) = the joint on that side. */
let downSide = 1; const A_SIDE = () => downSide;   // the side joint 3 is on, for the body being stepped
const DOWN_GEST = [
  [0.22, (s, J) => [[J(s, 7, 8), 9 + Math.random() * 6, -s * (1 + Math.random() * 3)], [J(s, 5, 6), 11, s * 7]], 0.9, [1.2, 2.6], null],   // a hand clamps onto the wound
  [0.18, (s, J) => [[J(s, 11, 12), -8, s * 13], [J(s, 13, 14), -17, s * 10]], 0.8, [0.6, 1.6],
    (s, J) => [[J(s, 11, 12), -16, s * 5], [J(s, 13, 14), -31, s * 5]]],                                                    // a knee drawn up, then the leg slides straight
  [0.12, (s, J) => [[J(1, 11, 12), -8, 11], [J(-1, 11, 12), -8, -11], [J(1, 13, 14), -16, 8], [J(-1, 13, 14), -16, -8]], 1.0, [1, 2.2],
    (s, J) => [[J(1, 11, 12), -16, 5], [J(-1, 11, 12), -16, -5], [J(1, 13, 14), -31, 5], [J(-1, 13, 14), -31, -5]]],                                                       // curls up, both knees, then stretches out
  [0.2, (s, J) => [[J(s, 3, 4), 16, s * 13], [J(-s, 3, 4), 19, -s * 7], [0, 25, s * 6], [J(s, 9, 10), -1, -s * 2]], 0.8, [0.4, 1.2],
    (s, J) => [[J(s, 3, 4), 17, s * 10], [J(-s, 3, 4), 17, -s * 10], [0, 27, 0]]],                                          // writhes: rolls the shoulders over to one side and back
  [0.1, (s, J) => [[0, 22, s * 5]], 0.6, [0.6, 1.5], () => [[0, 27, 0]]],                                                   // lifts the head and lets it drop to one side
  [0.18, (s, J) => [[J(s, 7, 8), 24 + Math.random() * 8, s * (17 + Math.random() * 8)], [J(s, 5, 6), 20, s * 14]], 1.0, [0.5, 1.4],
    (s, J) => [[J(s, 7, 8), 4, s * 13], [J(s, 5, 6), 9, s * 13]]],
  [0.14, (s, J) => [[J(s, 3, 4), 17, s * 4], [J(-s, 3, 4), 17, -s * 2], [J(s, 9, 10), 0, s * 3], [J(-s, 9, 10), 0, -s * 1], [J(-s, 11, 12), -9, -s * 4], [0, 26, s * 3]], 1.1, [1.2, 2.8],
    (s, J) => [[J(s, 3, 4), 17, s * 10], [J(-s, 3, 4), 17, -s * 10], [J(s, 9, 10), 0, s * 4.5], [J(-s, 9, 10), 0, -s * 4.5], [J(-s, 11, 12), -15, -s * 5], [0, 27, 0]]],   // rolls onto one side, then back
  [0.1, (s, J) => [[7, 14, 2 * A_SIDE()], [8, 14, -2 * A_SIDE()], [5, 9, 9 * A_SIDE()], [6, 9, -9 * A_SIDE()]], 0.8, [1, 2.4], null],              // both hands pulling at the vest
  [0, (s, J) => [[J(s, 7, 8), 30, s * 6], [J(s, 5, 6), 24, s * 9], [0, 24, s * 2]], 1.6, [1, 2], null]];   // one last reach (only near the end)                                                          // an arm reaches out for something, then flops back
const pickW = list => { let r = Math.random() * list.reduce((a, q) => a + q[1], 0); for (const [v, w] of list) if ((r -= w) <= 0) return v; return list[0][0]; };
/* Where a downed bot drags itself: the nearest spot out of your sight (behind a wall, a counter, round a corner),
   within DOWN.goalSteps tiles; failing that, the reachable spot furthest from you. Returns a tile path to it. */
function crawlGoal(x, y) {
  const sx = Math.floor(x / T), sy = Math.floor(y / T), start = sy * W + sx, prev = new Map([[start, -1]]), dist = new Map([[start, 0]]), q = [start];
  let best = null, bestScore = -1e9;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % W, cy = (cur / W) | 0, d = dist.get(cur);
    if (d >= 2) {
      const tx = (cx + 0.5) * T, ty = (cy + 0.5) * T, hidden = state !== 'play' || !losClear(p.x, p.y, tx, ty);
      const score = (hidden ? 1000 - d * 20 : Math.hypot(tx - p.x, ty - p.y) - d * 4);
      if (score > bestScore) { bestScore = score; best = cur; }
    }
    if (d >= DOWN.goalSteps) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
      if (navBlocked(nx, ny) || prev.has(ni) || (dx && dy && (navBlocked(cx + dx, cy) || navBlocked(cx, cy + dy)))) continue;
      prev.set(ni, cur); dist.set(ni, d + 1); q.push(ni);
    }
  }
  if (best === null) return null;
  const out = [];
  for (let c = best; c !== start && c !== -1; c = prev.get(c)) out.push({ x: (c % W + 0.5) * T, y: (((c / W) | 0) + 0.5) * T });
  return out.reverse();
}
/* A downed ally's route to you: the tile path to where you are, ending a body's length short of you (null once it's there). */
function crawlToYou(P) {
  const mx = (P[1].x + P[2].x) / 2, my = (P[1].y + P[2].y) / 2;
  if (Math.hypot(p.x - mx, p.y - my) < 44) return null;
  const path = findPath(mx, my, p.x, p.y);
  while (path.length && Math.hypot(path[path.length - 1].x - p.x, path[path.length - 1].y - p.y) < 40) path.pop();
  while (path.length > 1 && Math.hypot(path[0].x - mx, path[0].y - my) < T * 0.75) path.shift();   // not back to the middle of the tile it's already on
  return path.length ? path : null;
}
function goDown(c, ux, uy) {
  const rg = rags.find(q => q.c === c);
  if (!rg) return;
  const P = rg.pts, l = Math.hypot(ux, uy) || 1, F = bodyFrame(P);
  rg.downed = true;
  rg.alive = { t: 0, life: DOWN.life[0] + Math.random() * (DOWN.life[1] - DOWN.life[0]),
    crawl: c === p || c.ally || Math.random() < DOWN.crawl, dx: ux / l, dy: uy / l,   // a bot drags itself on, away from whoever shot it; your teammate drags itself to you
    side: (P[3].x - F.ox) * F.vx + (P[3].y - F.oy) * F.vy >= 0 ? 1 : -1,           // which side of the spine joint 3 is on
    mode: c === p ? 'crawl' : pickW(DOWN.modes), drag: Math.random() < 0.5 ? 1 : -1, path: c === p ? null : c.ally ? crawlToYou(P) : crawlGoal(P[2].x, P[2].y), replanT: 1.5,
    gs: [], gapT: 0.3 + Math.random() * 0.5, cr: null, crRest: 0.8 + Math.random(), hand: 1, br: 0,
    pool: false, stuckT: 0, sx: P[2].x, sy: P[2].y, lx: (P[1].x + P[2].x) / 2, ly: (P[1].y + P[2].y) / 2 };
}
function downStep(rg, h) {
  const A = rg.alive, P = rg.pts, c = rg.c;
  A.t += h;
  if (A.t >= A.life) return endDown(rg);
  const life = 1 - A.t / A.life, str = 0.4 + 0.6 * life;                       // slower and weaker as they bleed out
  if (A.gT === undefined) A.gT = rnd(VOX.groan.first);
  if ((A.gT -= h) <= 0) { A.gT = rnd(VOX.groan.gap) * (1 + VOX.groan.weak * (1 - life)); sfxGroan(rg, life); }   // in pain the whole time
  // glide a joint toward a point: moved with its previous position too, so it carries no momentum; never into a wall
  const glide = (q, tx, ty, rate) => {
    const k = 1 - Math.exp(-rate * h), mx = (tx - q.x) * k, my = (ty - q.y) * k;
    if (wall(Math.floor((q.x + mx) / T), Math.floor((q.y + my) / T))) return;
    q.x += mx; q.y += my; q.px += mx; q.py += my;
  };
  const slide = (q, mx, my) => { if (!wall(Math.floor((q.x + mx) / T), Math.floor((q.y + my) / T))) { q.x += mx; q.y += my; q.px += mx; q.py += my; } };
  const F = bodyFrame(P);
  if (rg.t < 0.9) return;                                                      // let the fall finish first
  // breathing: the chest rises and falls, ragged at first, slow and shallow near the end
  const br0 = A.br; A.br += h * (1.6 - 0.8 * (1 - life)) * Math.PI * 2;
  const db = (Math.sin(A.br) - Math.sin(br0)) * DOWN.breath * str;
  slide(P[3], F.vx * db * A.side, F.vy * db * A.side); slide(P[4], -F.vx * db * A.side, -F.vy * db * A.side);
  // where to crawl: you steer with the move stick; a bot keeps going away from the fight while it has the strength
  let dx = A.dx, dy = A.dy, go = A.crawl && life > DOWN.crawlTo;
  if (c.ally && (state === 'play' || state === 'downed') && life > DOWN.crawlTo && (A.replanT -= h) <= 0) {   // your teammate keeps heading for wherever you are now
    A.replanT = 1;
    if (!A.path || Math.hypot(p.x - (A.gx || 0), p.y - (A.gy || 0)) > T * 1.5) { A.path = crawlToYou(P); A.gx = p.x; A.gy = p.y; A.crawl = !!A.path; go = A.crawl && life > DOWN.crawlTo; }
  }
  if (c === p) { const il = Math.hypot(A.ix || 0, A.iy || 0); go = il > 0.2 && life > 0.1; if (go) { dx = A.ix / il; dy = A.iy / il; } }
  else if (A.path) {                                                           // a bot heads for its spot along its path, then stays there
    const mx = (P[1].x + P[2].x) / 2, my = (P[1].y + P[2].y) / 2;
    while (A.path.length && Math.hypot(A.path[0].x - mx, A.path[0].y - my) < DOWN.arrive) A.path.shift();
    if (!A.path.length) { A.path = null; A.crawl = false; go = false; }
    else { const tx = A.path[0].x - mx, ty = A.path[0].y - my, tl = Math.hypot(tx, ty) || 1; dx = A.dx = tx / tl; dy = A.dy = ty / tl; }
  }
  if (go || A.cr) {
    // one stroke at a time, then a rest. Every style plants something (hands or heels), then hauls the body past it:
    //  crawl:  hand over hand, the knee on that side pushing
    //  oneArm: always the same arm; the other hand stays clamped on the wound, the opposite leg pushes
    //  frog:   both hands reach, both knees draw up, then one big pull and push
    //  heels:  on its back, heels and elbows dug in, pushing itself along head first
    if (!A.cr) {
      if ((A.crRest -= h) > 0) return trailStep(rg, A, P, go);
      if (A.mode === 'heels' && dx * F.ux + dy * F.uy < 0.5) A.mode = 'crawl';   // the way to go isn't where its head points: rolls over and crawls
      A.hand = A.mode === 'oneArm' ? A.drag : -A.hand; A.cr = { ph: 'reach', t: 0, s: A.hand, anchor: [], done: 0 }; A.gs = []; if (A.turnsOk) A.turns = 0; A.turnsOk = true;
      const off = Math.atan2(F.ux * dy - F.uy * dx, F.ux * dx + F.uy * dy);   // how far the way to go is from where its head points
      if (A.mode !== 'heels' && Math.abs(off) > DOWN.turnAt && (A.turns || 0) < 2) A.turns = (A.turns || 0) + 1, A.cr = { ph: 'turn', t: 0, s: A.hand, anchor: [], done: 0, rot: clamp(off, -DOWN.turnMax, DOWN.turnMax) };
    }
    const C = A.cr, s = C.s, m = A.mode, sd = s * A.side, sq = Math.sqrt(str), rT = DOWN.reachT / sq * (m === 'frog' ? 1.3 : 1), pT = DOWN.pullT / sq * (m === 'frog' ? 1.3 : m === 'oneArm' ? 1.2 : 1);
    const K2 = CHAR_SCALE, H1 = P[s > 0 ? 7 : 8], S1 = P[s > 0 ? 3 : 4];
    if (m === 'heels') { dx = F.ux; dy = F.uy; }                                  // it goes the way its head points
    C.t += h;
    if (m === 'oneArm') { const w = bodyPt(F, 11, -sd * 2); glide(P[s > 0 ? 8 : 7], w.x, w.y, DOWN.ease); }   // the other hand stays on the wound
    if (C.ph === 'turn') {                                                       // swings its upper body round toward where it's going, pushing off with a hand
      const e = x => x * x * (3 - 2 * x), f = clamp(C.t / (DOWN.turnT / sq), 0, 1), da = (e(f) - C.done) * C.rot; C.done = e(f);
      const ox = P[2].x, oy = P[2].y, cs = Math.cos(da), sn = Math.sin(da), cl = Math.cos(-da * 0.3), sl = Math.sin(-da * 0.3);
      const moves = P.map((q, j) => { if (j === 2) return null; const up = j <= 8, c2 = up ? cs : cl, s2 = up ? sn : sl, rx = q.x - ox, ry = q.y - oy;
        return [q, ox + rx * c2 - ry * s2 - q.x, oy + rx * s2 + ry * c2 - q.y]; }).filter(Boolean);   // the legs swing a little the other way
      if (moves.every(([q, mx, my]) => !wall(Math.floor((q.x + mx) / T), Math.floor((q.y + my) / T)))) for (const [q, mx, my] of moves) slide(q, mx, my);
      else { C.t = 1e9; A.turns = 2; }                                          // a wall in the way: no more turning for now, it crawls on as it is
      if (f >= 1 || C.t > 1e8) { A.cr = null; A.crRest = 0.05; A.turnsOk = false; }
    } else if (C.ph === 'reach') {
      if (m === 'heels') {                                                        // knees up, heels dug in near the hips, elbows planted at the sides
        for (const t of [1, -1]) {
          const kj = t * A.side > 0 ? 11 : 12, fj = t * A.side > 0 ? 13 : 14, ej = t * A.side > 0 ? 5 : 6, hj = t * A.side > 0 ? 7 : 8;
          const kp = bodyPt(F, -6, t * 9), fp = bodyPt(F, -13, t * 8), ep = bodyPt(F, 8, t * 13), hp = bodyPt(F, 1, t * 12);
          glide(P[kj], kp.x, kp.y, DOWN.ease * 1.2); glide(P[fj], fp.x, fp.y, DOWN.ease * 1.2); glide(P[ej], ep.x, ep.y, DOWN.ease); glide(P[hj], hp.x, hp.y, DOWN.ease);
        }
        const side = (A.dx * F.vx + A.dy * F.vy) * 3;                             // twists its shoulders to steer
        for (const j of [0, 1, 3, 4]) slide(P[j], F.vx * side * h, F.vy * side * h);
      } else {
        const reachTo = (H, S, o) => glide(H, S.x + (dx * DOWN.reach + -dy * o) * K2, S.y + (dy * DOWN.reach + dx * o) * K2, DOWN.ease * 1.4);
        if (m === 'frog') { reachTo(P[7], P[3], 5 * A.side); reachTo(P[8], P[4], -5 * A.side);
          for (const t of [1, -1]) { const kj = t * A.side > 0 ? 11 : 12, kp = bodyPt(F, -6, t * 13); glide(P[kj], kp.x, kp.y, DOWN.ease); } }   // knees out like a frog
        else reachTo(H1, S1, sd * 3);
        glide(P[0], P[1].x + dx * 9 * K2, P[1].y + dy * 9 * K2, DOWN.ease * 0.5);   // looks where it's going
      }
      if (C.t >= rT) {
        C.ph = 'pull'; C.t = 0;
        const planted = m === 'heels' ? [13, 14] : m === 'frog' ? [7, 8] : [s > 0 ? 7 : 8];   // heels: the feet push; the elbows just slide along
        C.anchor = planted.map(j => [j, P[j].x, P[j].y]);
      }
    } else {
      for (const [j, ax, ay] of C.anchor) { P[j].x = P[j].px = ax; P[j].y = P[j].py = ay; }   // planted hands and heels don't slide
      const e = x => x * x * (3 - 2 * x), f = clamp(C.t / pT, 0, 1);
      const len = DOWN.stroke * (m === 'frog' ? 1.2 : m === 'oneArm' ? 0.75 : m === 'heels' ? 0.6 : 1), d = (e(f) - C.done) * len * K2 * sq;
      C.done = e(f);
      const pullW = m === 'heels' ? [1, 1, 0.9, 1, 1, 0.8, 0.8, 0.7, 0.7, 0.85, 0.85, 0.45, 0.45, 0, 0]   // knees straighten as the body slides away from the heels
        : [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1];                                          // the whole body comes along (the legs drag with it)
      const fixed = new Set(C.anchor.map(q => q[0]));
      const moversFor = (ux, uy) => P.map((q, j) => !fixed.has(j) && pullW[j] ? [q, ux * d * pullW[j], uy * d * pullW[j]] : null).filter(Boolean);
      const clearOf = mv => mv.every(([q, mx, my]) => !wall(Math.floor((q.x + mx) / T), Math.floor((q.y + my) / T)));
      let movers = moversFor(dx, dy);
      for (const r of [0.5, -0.5]) {                                            // scraping a wall: angle off it a little rather than stop
        if (clearOf(movers)) break;
        const cs = Math.cos(r), sn = Math.sin(r), alt = moversFor(dx * cs - dy * sn, dx * sn + dy * cs);
        if (clearOf(alt)) movers = alt;
      }
      // a stroke ends when something hits a wall, or when a planted arm or leg is fully stretched: nothing is ever dragged out of joint
      const reachOf = { 7: [3, 21], 8: [4, 21], 13: [9, 29], 14: [10, 29] };
      const tooFar = C.anchor.some(([j]) => { const [r, len] = reachOf[j], q = P[r], mv = movers.find(v => v[0] === q);
        const now = Math.hypot(q.x - P[j].x, q.y - P[j].y), next = Math.hypot(q.x + (mv ? mv[1] : 0) - P[j].x, q.y + (mv ? mv[2] : 0) - P[j].y);
        return next > len * K2 && next > now; });                                // only once the pull would stretch it further
      if (!tooFar && clearOf(movers)) for (const [q, mx, my] of movers) slide(q, mx, my);
      else { C.t = pT; C.done = 1; }                                             // stop where it is (the rest of the stroke is dropped, not jumped)
      if (m === 'frog') for (const t of [1, -1]) { const kj = t * A.side > 0 ? 11 : 12, kp = bodyPt(F, -14, t * 6); glide(P[kj], kp.x, kp.y, DOWN.ease * 1.3); }   // both legs kick straight
      else if (m !== 'heels') { const kj = (m === 'oneArm' ? -sd : sd) > 0 ? 11 : 12, kp = bodyPt(F, -8, (m === 'oneArm' ? -sd : sd) * 10); glide(P[kj], kp.x, kp.y, DOWN.ease); }   // a knee comes up and pushes
      if (f >= 1) { A.cr = null; A.crRest = Math.min(0.6, (DOWN.rest[0] + Math.random() * (DOWN.rest[1] - DOWN.rest[0])) / (str * str)) * (c === p ? 0.3 : m === 'oneArm' ? 1.4 : 1); }
    }
    A.stuckT += h;
    if (A.stuckT > DOWN.stuckT) {                                                // a wall in the way: turn along it, or give up and lie there
      const wp = c !== p && A.path && A.path[0], wd = wp ? Math.hypot(wp.x - (P[1].x + P[2].x) / 2, wp.y - (P[1].y + P[2].y) / 2) : 0;
      const noGain = wp && A.wd !== undefined && wd > A.wd - 8;                  // shuffling about but no closer to the waypoint
      A.wd = wd;
      if ((noGain || Math.hypot(P[2].x - A.sx, P[2].y - A.sy) < 6) && wp && A.path.length > 1) { A.path.shift(); A.wd = undefined; }   // can't reach this waypoint: try the next
      else if (Math.hypot(P[2].x - A.sx, P[2].y - A.sy) < 6 && c !== p) {
        const r = (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.7), cs = Math.cos(r), sn = Math.sin(r);
        [A.dx, A.dy] = [A.dx * cs - A.dy * sn, A.dx * sn + A.dy * cs];
        if (A.mode === 'heels') A.mode = 'crawl'; else if (Math.random() < 0.35) A.crawl = false;   // can't scoot past it: rolls over and crawls
      }
      A.stuckT = 0; A.sx = P[2].x; A.sy = P[2].y;
    }
    return trailStep(rg, A, P, true);
  }
  // lying there: a slow movement or two at a time, short pauses between, fewer and smaller as they fade
  const J = (sd, j, k) => sd * A.side > 0 ? j : k;
  downSide = A.side;
  A.gs = A.gs || [];
  if ((A.gapT -= h) <= 0 && life > 0.1 && A.gs.length < (Math.random() < DOWN.two ? 2 : 1)) {
    let G = DOWN_GEST[pickW(DOWN_GEST.map((g, i) => [i, g[0]]))];
    if (life < 0.3 && Math.random() < 0.7) G = DOWN_GEST[[4, 0, 8][(Math.random() * 3) | 0]];   // near the end: the head, a hand to the wound, one last reach
    const sd = Math.random() < 0.5 ? 1 : -1, to = G[1](sd, J), busy = new Set(A.gs.flatMap(g => g.to.map(q => q[0])));
    if (!to.some(q => busy.has(q[0])))
      A.gs.push({ to, back: G[4] ? G[4](sd, J) : null, move: G[2] / str, hold: (G[3][0] + Math.random() * (G[3][1] - G[3][0])) * (0.6 + 0.4 * str), t: 0 });
    A.gapT = (DOWN.gestGap[0] + Math.random() * (DOWN.gestGap[1] - DOWN.gestGap[0])) / str;
  }
  for (let i = A.gs.length - 1; i >= 0; i--) {
    const g = A.gs[i]; g.t += h;
    let set = g.to, rate = DOWN.ease * str;
    if (g.t >= g.move && g.t < g.move + g.hold) rate = DOWN.ease * 0.7;                         // held, straining a little
    else if (g.t >= g.move + g.hold) { if (!g.back || g.t >= g.move * 2 + g.hold) { A.gs.splice(i, 1); continue; } set = g.back; }
    const hold = g.t >= g.move && g.t < g.move + g.hold;
    for (const [j, a, b] of set) {
      const tp = bodyPt(F, a, b);
      glide(P[j], tp.x + (hold ? Math.sin(A.t * 11 + j) * 0.5 : 0), tp.y + (hold ? Math.cos(A.t * 9 + j) * 0.5 : 0), rate);
    }
  }
  trailStep(rg, A, P, false);
}
/* bleeding: a smear behind a body that drags itself, a spreading pool under one that doesn't */
function trailStep(rg, A, P, moving) {
  const mx = (P[1].x + P[2].x) / 2, my = (P[1].y + P[2].y) / 2;
  if (Math.hypot(mx - A.lx, my - A.ly) > DOWN.trail) { smear(A.lx, A.ly, mx, my, 1 - A.t / A.life); A.lx = mx; A.ly = my; }
  if (!A.pool && rg.t > 1.5 && !moving) { A.pool = true; addPool(mx, my); }
}
/* A drag mark: a broad, thin wash with darker streaks running along it, painted into the floor. */
function smear(x0, y0, x1, y1, k) {
  const g = artG, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = 5 + 2 * k;
  g.save(); g.lineCap = 'round';
  g.globalAlpha = 0.16 + 0.12 * k; g.strokeStyle = BLOOD[1]; g.lineWidth = w;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.lineWidth = 0.7; g.globalAlpha = 0.3 + 0.2 * k; g.strokeStyle = BLOOD[0];
  for (let i = 0; i < 3; i++) {
    const o = (i / 2 - 0.5) * w * 0.7 + (Math.random() - 0.5) * 1.2;
    g.beginPath(); g.moveTo(x0 + nx * o, y0 + ny * o); g.lineTo(x1 + nx * o, y1 + ny * o); g.stroke();
  }
  g.restore();
  markBlood(x1, y1, w * 0.6, 60);
}
/* Bled out: the ragdoll goes still and settles like any death (pool, then painted in). A bot's gear comes off now. */
function endDown(rg) {
  sfxLastBreath(rg);
  rg.alive = null; rg.t = Math.max(rg.t, RAG.maxT); rg.rest = 0;
  const c = rg.c, P = rg.pts;
  for (const q of P) { q.px = q.x; q.py = q.y; }
  if (c === p) { if (state === 'downed') { state = 'dead'; stateT = 0; } }
  else { c.x = P[2].x; c.y = P[2].y; dropLoot(c); }
}
/* A round reaching a downed body finishes it. */
function hitDowned(b, best) {
  let hit = null;
  for (const rg of rags) {
    if (!rg.alive && !rg.pin) continue;                  // the downed, and a body hanging on a knife (a shield)
    for (const j of rg.pin ? [0, 1, 2, 3, 4, 9, 10] : [0, 1, 2]) {
      const q = rg.pts[j], s = clamp((q.x - b.x) * b.ux + (q.y - b.y) * b.uy, 0, best), cx = b.x + b.ux * s - q.x, cy = b.y + b.uy * s - q.y;
      if (cx * cx + cy * cy < DOWN.hitR * DOWN.hitR && s < best) { best = s; hit = rg; }
    }
  }
  return hit ? { rg: hit, s: best } : null;
}

