/* ================= REARM AND SWEEP =================
   Lost you for SWEEP.lost seconds: the team (whoever was in the fight, or the nearest bots) first rearms - anyone with
   weak plates, no helmet or few rounds goes for the best loot around (same upgrade rules as yours) and tops up the rifle.
   Then they clear rooms: the one you were last seen in, then its neighbours. As a group they stack at the doorway, go in
   one after another, spread to different corners and scan; alone, a bot does the same by itself. Seeing you again hands
   straight back to the fight; once the last room is clear they forget you and go back to patrol. */
const SWEEP = { lost: 7, rearmT: 12, lootR: 700, needAmmo: 75, needPlate: 0.6, rooms: 4, minRoom: 10, stackT: 6, gap: 0.7, hold: 2.5, roomT: 18, maxT: 100, speed: 0.8 };
let sweep = null, roomOf = null, roomTiles = null;
function computeRooms() {                                // rooms = connected open floor of one floor type; tiny bits join a neighbour
  roomOf = new Int16Array(W * H).fill(-1); roomTiles = [];
  for (let k = 0; k < W * H; k++) {
    if (roomOf[k] >= 0 || wall(k % W, (k / W) | 0)) continue;
    const id = roomTiles.length, list = [k], code = floorAt[k]; roomOf[k] = id;
    for (let q = 0; q < list.length; q++) {
      const c = list[q], i = c % W, j = (c / W) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + a, nj = j + b, n = nj * W + ni;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H || roomOf[n] >= 0 || wall(ni, nj) || floorAt[n] !== code) continue;
        roomOf[n] = id; list.push(n);
      }
    }
    roomTiles.push(list);
  }
  for (let id = 0; id < roomTiles.length; id++) {
    if (roomTiles[id].length >= SWEEP.minRoom) continue;
    let into = -1;
    for (const c of roomTiles[id]) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = c + b * W + a, o = n >= 0 && n < W * H ? roomOf[n] : -1; if (o >= 0 && o !== id && roomTiles[o].length >= SWEEP.minRoom) into = o; }
    if (into >= 0) { for (const c of roomTiles[id]) { roomOf[c] = into; roomTiles[into].push(c); } roomTiles[id] = []; }
  }
}
function roomNeighbours(id) {
  const out = new Set();
  for (const c of roomTiles[id]) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = c + b * W + a; if (n >= 0 && n < W * H && roomOf[n] >= 0 && roomOf[n] !== id) out.add(roomOf[n]); }
  return [...out];
}
const tileXY = k => ({ x: (k % W + 0.5) * T, y: (((k / W) | 0) + 0.5) * T });
function botNeeds(b) {
  const pr = b.prot;
  return pr.front < PLATE_HP * SWEEP.needPlate || pr.helmet <= 0 || ammoLeft(b) < SWEEP.needAmmo;   // (a back plate can't be swapped in the field)
}
function botGain(b, it) {                                // like pickGain, for a bot
  const pr = b.prot;
  if (it.kind === 'mag') return b.mags.length < MAG_VEST ? it.rounds / AR.mag : (it.rounds - Math.min(...b.mags)) / AR.mag;
  if (it.kind === 'helmet') return (it.hp - pr.helmet) / HELMET_HP;
  return (it.hp - pr.front) / PLATE_HP;
}
function botTake(b, it) {                                // whatever gets swapped out is left on the floor
  const pr = b.prot;
  sfxGrab(b, it.kind);
  if (it.kind === 'mag') {
    if (b.mags.length < MAG_VEST) b.mags.push(it.rounds);
    else { const i = b.mags.indexOf(Math.min(...b.mags)); addItem({ kind: 'mag', rounds: b.mags[i], owner: b }, b.x, b.y, 14); b.mags[i] = it.rounds; }
  } else if (it.kind === 'helmet') {
    if (pr.helmet > 0) addItem({ kind: 'helmet', hp: pr.helmet, chips: pr.chipsH }, b.x, b.y, 14);
    pr.helmet = it.hp; pr.chipsH = it.chips.slice();
  } else {
    const side = 'front', ck = 'chipsF';                     // the front plate only: nobody reaches round to their back
    if (pr[side] > 0) addItem({ kind: 'plate', hp: pr[side], chips: pr[ck] }, b.x, b.y, 14);
    pr[side] = it.hp; pr[ck] = it.chips.slice();
  }
  items.splice(items.indexOf(it), 1);
}
function sweepThink(t, alive) {
  if (!roomOf) computeRooms();
  if (!sweep) {
    let team = alive.filter(b => b.role && ammoLeft(b) > 0);
    if (!team.length) team = alive.filter(b => ammoLeft(b) > 0).sort((a, c) => Math.hypot(a.x - intel.x, a.y - intel.y) - Math.hypot(c.x - intel.x, c.y - intel.y)).slice(0, 1);
    if (!team.length) { intel = null; return; }
    for (const b of alive) if (b.role && !team.includes(b)) clearRole(b);
    for (const b of team) { setRole(b, 'sweep'); b.tac.rearm = true; }
    sweep = { team, stage: 'rearm', until: t + SWEEP.rearmT, start: t, rooms: null, ri: 0, room: null };
  }
  const sw = sweep;
  sw.team = sw.team.filter(b => !b.dead && b.role === 'sweep');
  if (!sw.team.length || t - sw.start > SWEEP.maxT) { for (const b of sw.team) clearRole(b); sweep = null; intel = null; return; }
  if (sw.stage === 'rearm') {
    if (t < sw.until && sw.team.some(b => b.tac.rearm)) return;
    sw.stage = 'sweep';
    const k0 = Math.floor(intel.y / T) * W + Math.floor(intel.x / T);
    let r0 = roomOf[k0];
    if (r0 < 0) { let bd = 1e9; roomTiles.forEach((L, id) => { for (const c of L) { const p0 = tileXY(c), d = Math.hypot(p0.x - intel.x, p0.y - intel.y); if (d < bd) { bd = d; r0 = id; } } }); }
    const order = [r0];                                    // the room you vanished in, then outward
    for (let q = 0; q < order.length && order.length < SWEEP.rooms; q++) for (const n of roomNeighbours(order[q])) if (!order.includes(n) && order.length < SWEEP.rooms && roomTiles[n].length >= SWEEP.minRoom) order.push(n);
    sw.rooms = order; sw.ri = -1; nextRoom(t);
    return;
  }
  const rm = sw.room;
  if (!rm) return;
  if (rm.phase === 'stack' && (sw.team.every(b => b.tac.at) || t > rm.until)) { rm.phase = 'enter'; rm.go = t; rm.until = t + SWEEP.roomT; sw.team.forEach(b => { b.tac.at = false; b.tac.held = 0; }); }
  else if (rm.phase === 'enter' && (sw.team.every(b => b.tac.held && t > b.tac.held) || t > rm.until)) nextRoom(t);
}
function nextRoom(t) {
  const sw = sweep;
  sw.ri++;
  if (sw.ri >= sw.rooms.length) { for (const b of sw.team) clearRole(b); sweep = null; intel = null; return; }
  const id = sw.rooms[sw.ri], tiles = roomTiles[id].filter(k => !navBlocked(k % W, (k / W) | 0));
  const cx = sw.team.reduce((a, b) => a + b.x, 0) / sw.team.length, cy = sw.team.reduce((a, b) => a + b.y, 0) / sw.team.length;
  const inside = sw.team.some(b => roomOf[Math.floor(b.y / T) * W + Math.floor(b.x / T)] === id);
  let entry = null, stack = null, bd = 1e9;
  if (!inside) for (const k of tiles) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // the doorway nearest the team
    const n = k + b * W + a, i = k % W + a, j = ((k / W) | 0) + b;
    if (navBlocked(i, j) || roomOf[n] === id || roomOf[n] < 0) continue;
    const e = tileXY(k), o = tileXY(n), d = Math.hypot(o.x - cx, o.y - cy);
    if (d < bd) { bd = d; entry = e; stack = o; }
  }
  const pts = [];                                          // spread out: far corners first, each far from the others
  const from = entry || { x: cx, y: cy };
  for (let q = 0; q < Math.min(sw.team.length, 4) + 1 && tiles.length; q++) {
    let best = null, bs = -1;
    for (const k of tiles) { const c = tileXY(k), dd = Math.min(Math.hypot(c.x - from.x, c.y - from.y) * (q ? 0.5 : 1), ...pts.map(p0 => Math.hypot(c.x - p0.x, c.y - p0.y))); if (dd > bs) { bs = dd; best = c; } }
    pts.push(best);
  }
  sw.room = { id, entry, stack, pts, phase: entry ? 'stack' : 'enter', until: t + SWEEP.stackT, go: t };
  sw.team.forEach((b, i) => { b.tac.at = false; b.tac.held = 0; b.tac.slot = i; b.path = []; });
}
/* One bot's part in the rearm / sweep. Returns [facing wanted, turn rate], or null to fall back on plain attack. */
function sweepStep(b, dt, t, sees) {
  if (sees) return null;                                   // contact: the fight takes over
  const tc = b.tac, sw = sweep;
  if (!sw) return null;
  if (sw.stage === 'rearm') {
    if (!tc.rearm) return [b.ang + Math.sin(t * 0.9 + b.seed) * 0.6, 1.5];
    if (b.ammo < BOT.mag * 0.7 && b.mags.length && b.reloadT <= 0 && !b.side.out && !b.side.sw) { b.reloadT = BOT.reload; b.magDropped = false; }
    const it = tc.loot && items.includes(tc.loot) ? tc.loot : null;
    if (it && Math.hypot(it.x - b.x, it.y - b.y) < PICKUP_R && b.reloadT <= 0) {       // mags go straight in a pouch; gear takes time (botGear)
      if (it.kind === 'mag') botTake(b, it); else if (!fighting(b)) b.grab = { it, t: 0 };
      tc.loot = null; b.path = [];
    }
    if (!it || !b.path.length) {
      tc.loot = null;
      if (!botNeeds(b)) { tc.rearm = false; return null; }
      let best = null, bs = 0;
      for (const q of items) { const d = Math.hypot(q.x - b.x, q.y - b.y); if (d > SWEEP.lootR) continue; const g = botGain(b, q); if (g > 0.05 && g / (1 + d / 300) > bs) { bs = g / (1 + d / 300); best = q; } }
      if (!best) { tc.rearm = false; return null; }
      tc.loot = best; b.path = findPath(b.x, b.y, best.x, best.y);
      if (!b.path.length) { tc.rearm = false; return null; }
    }
    if (followPath(b, BOT.searchSpeed, dt)) return [b.walkAng, 5];
    return [b.ang, 2];
  }
  const rm = sw.room;
  if (!rm) return null;
  if (rm.phase === 'stack') {                              // line up at the doorway, one behind the other
    const bk = Math.hypot(rm.stack.x - rm.entry.x, rm.stack.y - rm.entry.y) || 1, ux = (rm.stack.x - rm.entry.x) / bk, uy = (rm.stack.y - rm.entry.y) / bk;
    let gx = rm.stack.x + ux * tc.slot * 26, gy = rm.stack.y + uy * tc.slot * 26;
    if (wall(Math.floor(gx / T), Math.floor(gy / T))) { gx = rm.stack.x; gy = rm.stack.y; }
    if (!b.path.length && Math.hypot(gx - b.x, gy - b.y) > 14) b.path = findPath(b.x, b.y, gx, gy);
    if (followPath(b, BOT.searchSpeed * SWEEP.speed, dt)) return [b.walkAng, 5];
    tc.at = true;
    return [Math.atan2(rm.entry.y - b.y, rm.entry.x - b.x), 4];
  }
  // enter one after another, take a corner, scan
  if (t < rm.go + tc.slot * SWEEP.gap) return [rm.entry ? Math.atan2(rm.entry.y - b.y, rm.entry.x - b.x) : b.ang, 4];
  const pt = rm.pts[tc.slot % rm.pts.length];
  if (!pt) return null;
  if (!tc.at) {
    if (!b.path.length) b.path = findPath(b.x, b.y, pt.x, pt.y);
    if (followPath(b, BOT.searchSpeed * SWEEP.speed, dt) && Math.hypot(pt.x - b.x, pt.y - b.y) > 14) return [b.walkAng, 5];
    tc.at = true; tc.held = t + SWEEP.hold;
  }
  const from = rm.entry || { x: b.x - Math.cos(b.ang), y: b.y - Math.sin(b.ang) };
  return [Math.atan2(pt.y - from.y, pt.x - from.x) + Math.sin(t * 1.6 + b.seed) * 1.2, 3];   // sweep the room with the light
}
/* The role's behaviour this frame: [facing wanted, turn rate], or null to fall back on plain attack/search. */
function tactic(b, dt, t, sees, dx, dy, d) {
  if (b.role === 'sweep') return sweepStep(b, dt, t, sees);
  const tc = b.tac, I = intel, toI = Math.atan2(I.y - b.y, I.x - b.x), dI = Math.hypot(I.x - b.x, I.y - b.y), to = Math.atan2(dy, dx);
  if (b.role === 'suppress') {
    if (sees || t - I.t > SQUAD.suppressFor || ammoLeft(b) < SQUAD.suppressMin || dI > BOT.fireRange * 1.5 || !losClear(b.x, b.y, I.x, I.y))
      return coverCycle(b, dt, t, sees, d, to, toI, false, SQUAD.supPeekT);      // eyes on (or no line): fight from cover, long peeks
    const mate = b.gun && friendInLine(b, bots, dI, b.half);
    if (mate) clearLine(b, mate, dt);
    else if (botReady(b) && b.fireCd <= 0 && gunCanFire(b) && Math.abs(angDiff(toI, b.ang + b.sway)) < 0.15) {   // bursts into where you were
      if (tc.n <= 0) tc.n = Math.round(rnd(SQUAD.supBurst));
      botShoot(b, dI); tc.n--; b.fireCd = Math.max(b.side.out ? b.fireCd : 0, tc.n > 0 ? SQUAD.supRate : rnd(SQUAD.supPause));
    }
    return [toI + Math.sin(t * 2.3 + b.seed) * 0.12, 6];
  }
  if (b.role === 'flank') {
    if (sees) { setRole(b, 'cover'); return null; }                                 // got the angle: dig in there and fight from cover
    if (!tc.goal || (t > tc.until && !tc.wait)) {
      tc.goal = findFlank(b, b.flankFrom); tc.until = t + 4;
      if (!tc.goal) { setRole(b, 'cover'); return null; }
      b.path = safePath(b.x, b.y, tc.goal.x, tc.goal.y);
      if (!routeOk(b)) { b.path = []; tc.goal = null; tc.until = t + 1; return [toI, 4]; }   // wait for a better moment
    }
    if (!tc.wait && followPath(b, BOT.searchSpeed * SQUAD.quiet, dt)) return [b.walkAng, 5];
    if (!tc.wait) tc.wait = t + SQUAD.flankWait;                                   // in position: watch where you should be
    if (t > tc.wait) { setRole(b, 'cover'); return null; }                          // then work in from cover
    return [toI, 4];
  }
  return coverCycle(b, dt, t, sees, d, to, toI, b.role === 'ambush', SQUAD.peekT);
}
/* No cover to go to (or the way is too exposed): never walk at you. In sight, hold and shoot; out of sight, pull back
   to the nearest spot you can't see and wait there. */
function noCover(b, dt, t, sees, d, to, toI) {
  if (sees) { b.path = []; botTryFire(b, dt, d, to); return [to, 7]; }
  const tc = b.tac;
  if (!tc.back || t > tc.backT) {
    tc.backT = t + 1.5; tc.back = null;
    if (!bodyHidden(b.x, b.y, p, b.r)) {
      const bi = Math.floor(b.x / T), bj = Math.floor(b.y / T);
      let best = null, bd = Infinity;
      for (let j = bj - 4; j <= bj + 4; j++) for (let i = bi - 4; i <= bi + 4; i++) {
        if (navBlocked(i, j)) continue;
        const x = (i + 0.5) * T, y = (j + 0.5) * T, dd = Math.hypot(x - b.x, y - b.y);
        if (dd < bd && bodyHidden(x, y, p, b.r)) { bd = dd; best = { x, y }; }
      }
      if (best) { tc.back = best; b.path = safePath(b.x, b.y, best.x, best.y); }
    }
  }
  if (tc.back && followPath(b, BOT.searchSpeed, dt)) return [b.walkAng, 6];
  return [toI, 3];
}
/* Hide in cover near you, step out to a spot that sees you, fire, duck back; ambushers just wait in the dark. */
function coverCycle(b, dt, t, sees, d, to, toI, amb, peekT) {
  const tc = b.tac, I = intel;
  if (sees && (amb || b.dark)) { b.dark = false; if (amb) { setRole(b, 'cover'); return null; } }
  if (!tc.goal || Math.hypot(tc.ref.x - I.x, tc.ref.y - I.y) > 120) {
    if (t < tc.retry) return noCover(b, dt, t, sees, d, to, toI);                 // nothing found (or too exposed) a moment ago: don't search every frame
    tc.goal = findCover(b, I, amb) || (amb ? null : findShadow(b, I)); tc.ref = { x: I.x, y: I.y }; tc.phase = 'go';
    if (!tc.goal) { tc.retry = t + SQUAD.retry; return noCover(b, dt, t, sees, d, to, toI); }
    b.path = safePath(b.x, b.y, tc.goal.x, tc.goal.y);
    if (!routeOk(b)) { b.path = []; tc.goal = null; tc.retry = t + 1; return noCover(b, dt, t, sees, d, to, toI); }   // the way there is too exposed
  }
  if (tc.goal.shadow && t > tc.retry && Math.abs(angDiff(Math.atan2(b.y - p.y, b.x - p.x), p.aim)) < CONE_HALF * 1.3 && Math.hypot(b.x - p.x, b.y - p.y) < viewR * 1.1) {
    tc.goal = null; tc.retry = t + 0.6; return [to, 7];                            // your light found them: slip back into the dark
  }
  if (tc.phase === 'go') {
    if (followPath(b, BOT.searchSpeed, dt) && Math.hypot(tc.goal.x - b.x, tc.goal.y - b.y) > 10) { if (sees) botTryFire(b, dt, d, to); return [sees ? to : b.walkAng, 6]; }
    tc.phase = 'hide'; tc.until = t + rnd(amb ? SQUAD.ambushT : SQUAD.hideT) * PZ(b).hide;
  }
  if (tc.phase === 'hide') {
    if (amb) b.dark = true;                                                         // lights off, lying in wait
    if (b.ammo < BOT.mag * 0.5 && b.mags.length && b.reloadT <= 0 && !b.side.out && !b.side.sw) { b.reloadT = BOT.reload; b.magDropped = false; }   // reload in cover
    if (sees) { botTryFire(b, dt, d, to); return [to, 7]; }                        // you walked into view
    if (t > tc.until) {
      if (amb) { clearRole(b); return null; }
      tc.phase = 'peek'; tc.until = t + rnd(peekT) * PZ(b).peek; b.path = findPath(b.x, b.y, tc.goal.px, tc.goal.py);
    }
    return [toI, 3];
  }
  b.dark = false;                                                                   // peek: step out, fire, duck back when it gets hot
  const moving = followPath(b, BOT.searchSpeed, dt);
  if (sees) botTryFire(b, dt, d, to);
  if (t > tc.until || (b.supp || 0) > 0.5 / PZ(b).nerve || b.reloadT > 0) { tc.phase = 'go'; b.path = safePath(b.x, b.y, tc.goal.x, tc.goal.y); }
  return [sees ? to : moving ? b.walkAng : toI, 7];
}
/* A bot with nothing left to shoot: go for a magazine, or get out of sight. Returns [facing wanted, turn rate]. */
function dryBot(b, dt, sees) {
  if (!b.wasDry) { b.wasDry = true; b.dryGoal = null; b.dryT = 0; b.path = []; }
  const g = b.dryGoal;
  if (g && g.it && !items.includes(g.it)) b.dryT = 0;                             // someone else took it
  if (g && !g.it && (sees || !hiddenFromPlayer(g.x, g.y))) b.dryT = 0;          // hiding spot is blown
  b.dryT -= dt;
  if (b.dryT <= 0) {
    b.dryT = DRY.replan;
    let best = null, bs = Infinity;
    for (const it of items) {
      if (it.kind !== 'mag' || (b.noReach && b.noReach.has(it))) continue;
      const sc = Math.hypot(it.x - b.x, it.y - b.y) + 2 * Math.max(0, DRY.avoid - Math.hypot(it.x - p.x, it.y - p.y));
      if (sc < bs) { bs = sc; best = it; }
    }
    if (best) {
      if (best !== (g && g.it) || !b.path.length) {                               // new target, or lost the way: plan again
        b.dryGoal = { x: best.x, y: best.y, it: best }; b.path = findPath(b.x, b.y, best.x, best.y);
        if (!b.path.length && Math.hypot(best.x - b.x, best.y - b.y) > PICKUP_R) (b.noReach || (b.noReach = new Set())).add(best);
      }
    } else if (!g || g.it || sees || !hiddenFromPlayer(g.x, g.y)) {
      const h = hideSpot(b);
      b.dryGoal = h; b.path = h ? findPath(b.x, b.y, h.x, h.y) : [];
    }
  }
  if (followPath(b, DRY.speed, dt)) return [b.walkAng, 6];
  const lk = b.lastKnown || p;                                                     // tucked away: watch the way you'd come
  return [Math.atan2(lk.y - b.y, lk.x - b.x), 3];
}
function hiddenFromPlayer(x, y) {
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
  return cast(p.x, p.y, dx / d, dy / d, d) < d - 4;
}
function hideSpot(b) {                                  // an open tile nearby that you can't see, as far from you as is sensible
  const bi = Math.floor(b.x / T), bj = Math.floor(b.y / T);
  let best = null, bs = -Infinity;
  for (let n = 0; n < DRY.tries; n++) {
    const i = bi + Math.round((Math.random() * 2 - 1) * DRY.hideR), j = bj + Math.round((Math.random() * 2 - 1) * DRY.hideR);
    if (navBlocked(i, j)) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T;
    if (!hiddenFromPlayer(x, y)) continue;
    const sc = Math.hypot(x - p.x, y - p.y) - 0.5 * Math.hypot(x - b.x, y - b.y);
    if (sc > bs) { bs = sc; best = { x, y, it: null }; }
  }
  return best;
}
function armsStep(a, dt, dAim, steady, mount, supp) {
  const sp = supp || 0;
  const m = mount || 0;
  const k = (ARMS.k + (ARMS.kSteady - ARMS.k) * steady) * (1 + COVER.mountK * m) * (1 - SUPP.soften * sp);   // rested: stiffer; suppressed: shakier
  const c = (ARMS.c + (ARMS.cSteady - ARMS.c) * steady) * (1 + 0.6 * m);
  a.th -= dAim * ARMS.lag;                                                         // body turned; the gun's weight drags behind
  a.w += (Math.random() * 2 - 1) * ARMS.tremor * (Math.max(0.15, 1 - steady) * (1 - m) + SUPP.tremor * sp * 0.25) * Math.sqrt(Math.max(dt, 0)) * 6;   // hands shake
  springStep(a, 'th', 'w', k, c, dt);                                              // arms pull it back onto the aim
  if (a.th > ARMS.maxSway) { a.th = ARMS.maxSway; if (a.w > 0) a.w = 0; }
  else if (a.th < -ARMS.maxSway) { a.th = -ARMS.maxSway; if (a.w < 0) a.w = 0; }
}
function recoilKick(a, steady, mount, dev, k = 1) {
  if (dev !== undefined && Math.random() < 0.65) a.kickDir = dev > 0 ? -1 : 1;       // the round leaving one side of the bore kicks the barrel the other way
  else if (Math.random() < 0.3) a.kickDir = -a.kickDir;                             // tends to push one way, then flips
  a.w += a.kickDir * (ARMS.recoil[0] + Math.random() * (ARMS.recoil[1] - ARMS.recoil[0])) * (1 - 0.6 * steady) * (1 - COVER.mountRecoil * (mount || 0)) * k;
}
/* Closest point on any wall / built-in within range of (x, y). */
function nearestWall(x, y, range) {
  let best = null;
  const i0 = Math.floor((x - range) / T), i1 = Math.floor((x + range) / T), j0 = Math.floor((y - range) / T), j1 = Math.floor((y + range) / T);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!wall(i, j)) continue;
    const qx = clamp(x, i * T, (i + 1) * T), qy = clamp(y, j * T, (j + 1) * T), d = Math.hypot(qx - x, qy - y);
    if (d > 0.001 && d <= range && (!best || d < best.d)) best = { x: qx, y: qy, d };
  }
  return best;
}
/* Nearest thing a body can lean on or rest a rifle on: walls, built-ins, window sills, movable furniture. */
function solidRay(x, y, a, max) {
  const c = Math.cos(a), s = Math.sin(a);
  let d = cast(x, y, c, s, max);
  for (const f of pieces) if (!f.broken) { const te = segBox(x, y, c, s, d, f.x, f.y, f.w, f.h); if (te >= 0 && te < d) d = te; }
  return d;
}
function senseCover(c, face, moveA, dt, busy) {
  const cv = c.cov || (c.cov = { side: 0, mount: 0, hand: null, sh: 1, shT: 1, swT: 0, lean: 0 });
  const r = c.r, near = r + COVER.side;
  const dR = solidRay(c.x, c.y, face + Math.PI / 2, near + 6), dL = solidRay(c.x, c.y, face - Math.PI / 2, near + 6);
  const dF = solidRay(c.x, c.y, face, 80), dFR = solidRay(c.x, c.y, face + 0.6, 60), dFL = solidRay(c.x, c.y, face - 0.6, 60);
  const nearR = dR < near, nearL = dL < near;
  let side = 0, mount = 0, hand = null;
  if (nearR !== nearL) side = nearR ? 1 : -1;                                    // wall on one side
  else if (dFR < COVER.edge && dF > 60 && dFL > dFR + 12) side = 1;              // a corner edge ahead-right
  else if (dFL < COVER.edge && dF > 60 && dFR > dFL + 12) side = -1;             // a corner edge ahead-left
  if (dF < r + COVER.front) { mount = 1; hand = [c.x + Math.cos(face) * (dF - 2), c.y + Math.sin(face) * (dF - 2)]; }   // low cover / sill in front
  else if (side && (side > 0 ? dFR : dFL) < COVER.edge) {                        // rifle resting on the corner
    const a = face + 0.6 * side, dd = (side > 0 ? dFR : dFL) - 2;
    mount = 1; hand = [c.x + Math.cos(a) * dd, c.y + Math.sin(a) * dd];
  } else if (nearR || nearL) mount = 0.5;                                        // shoulder braced on the wall
  // shoulder the rifle away from the cover (after the cover has been there a moment)
  const want = side > 0 ? -1 : 1;
  if (want !== cv.shT) { cv.swT += dt; if (cv.swT > COVER.hold) { cv.shT = want; cv.swT = 0; } } else cv.swT = 0;
  cv.sh += clamp(cv.shT - cv.sh, -2 * dt / COVER.switchTime, 2 * dt / COVER.switchTime);
  // in cover: touching a piece of low cover (furniture, counter, car, sofa, window sill). While touching it,
  // your own shots clear it and incoming fire aimed at you is stopped by it.
  let piece = null, comp = -1, cpt = null, gapBest = COVER.contact;
  for (const f of pieces) {
    if (f.broken) continue;
    const qx = clamp(c.x, f.x, f.x + f.w), qy = clamp(c.y, f.y, f.y + f.h), gap = Math.hypot(c.x - qx, c.y - qy) - r;
    if (gap < gapBest) { gapBest = gap; piece = f; comp = -1; cpt = [qx, qy]; }
  }
  const ti0 = Math.floor((c.x - r - COVER.contact) / T), ti1 = Math.floor((c.x + r + COVER.contact) / T);
  const tj0 = Math.floor((c.y - r - COVER.contact) / T), tj1 = Math.floor((c.y + r + COVER.contact) / T);
  for (let j = tj0; j <= tj1; j++) for (let i = ti0; i <= ti1; i++) {
    if (i < 0 || j < 0 || i >= W || j >= H || coverComp[j * W + i] < 0) continue;
    const qx = clamp(c.x, i * T, (i + 1) * T), qy = clamp(c.y, j * T, (j + 1) * T), gap = Math.hypot(c.x - qx, c.y - qy) - r;
    if (gap < gapBest) { gapBest = gap; piece = null; comp = coverComp[j * W + i]; cpt = [qx, qy]; }
  }
  cv.piece = piece; cv.comp = comp; cv.inCover = !!(piece || comp >= 0);
  if (cv.inCover) { mount = Math.max(mount, 1); hand = cpt; }                   // hand planted on the thing you're behind
  // duck down behind it; come up a bit to fire over it
  c.shotT = (c.shotT || 0) - dt;
  { // going down and coming up on a spring: they drop with a little dip and settle, rise with a push
    const want = cv.inCover ? (c.shotT > 0 ? 0.35 : 1) : 0, h = Math.min(dt, 0.05);
    cv.dv = (cv.dv || 0) + (CROUCH.k * (want - (cv.duck || 0)) - CROUCH.c * (cv.dv || 0)) * h;
    cv.duck = clamp((cv.duck || 0) + cv.dv * h, 0, CROUCH.dip);
  }
  cv.hand = hand; cv.side = side;
  const still = clamp(1 - moveA * 2, 0, 1);
  const rightShoulder = side === 0 || Math.sign(cv.sh) === -side;
  cv.mount += ((busy ? 0 : mount * still * (rightShoulder ? 1 : 0.5)) - cv.mount) * Math.min(1, dt * 6);
  const leanTo = (nearR || nearL) && side ? side * 2.2 * still : 0;              // lean into the wall you're hugging
  cv.lean += clamp(leanTo - cv.lean, -dt * 12, dt * 12);
  // peek past an edge: from where the boots are planted, is the view blocked ahead but clear a step to one side?
  const fx0 = c.x - (cv.px || 0), fy0 = c.y - (cv.py || 0);
  let pkWant = 0;
  if (!busy && moveA < PEEK.still) {
    const d0 = solidRay(fx0, fy0, face, PEEK.block);
    if (d0 < PEEK.block) {
      let best = 0;
      for (const s of [1, -1]) {
        const sa = face + s * Math.PI / 2;
        if (solidRay(fx0, fy0, sa, r + PEEK.dist) < r + PEEK.dist - 0.5) continue;                  // no room to lean that way
        const dO = solidRay(fx0 + Math.cos(sa) * PEEK.dist, fy0 + Math.sin(sa) * PEEK.dist, face, d0 + PEEK.gain + 200);
        if (dO > d0 + (cv.pkS === s ? PEEK.gain * 0.4 : PEEK.gain) && dO > best) { best = dO; pkWant = s; }   // easier to stay out than to start
      }
    }
  }
  cv.pkS = pkWant;
  if (moveA >= PEEK.still) { const k = Math.exp(-dt * 12); cv.px = (cv.px || 0) * k; cv.py = (cv.py || 0) * k; }   // walking: the boots catch up under the body
  else {
    const ta = face + pkWant * Math.PI / 2, tx = pkWant ? Math.cos(ta) * PEEK.dist : 0, ty = pkWant ? Math.sin(ta) * PEEK.dist : 0;
    let ddx = tx - (cv.px || 0), ddy = ty - (cv.py || 0);
    const dl = Math.hypot(ddx, ddy), mx = PEEK.speed * dt;
    if (dl > 0.01) {
      if (dl > mx) { ddx *= mx / dl; ddy *= mx / dl; }
      const bx = c.x, by = c.y; moveCircle(c, ddx, ddy);
      const mdx = c.x - bx, mdy = c.y - by;
      cv.px = (cv.px || 0) + mdx; cv.py = (cv.py || 0) + mdy;
      if (c.px !== undefined) { c.px += mdx; c.py += mdy; }                      // bots: a lean isn't a step
    }
  }
  // settle against the wall you're hugging (unless you're stepping away from it): straight toward the
  // nearest point on the wall, never along it, and stop just short of touching
  if ((nearR || nearL) && moveA < 0.4 && !pkWant && Math.hypot(cv.px || 0, cv.py || 0) < 1) {
    const q = nearestWall(c.x, c.y, r + COVER.side + 6);
    if (q) {
      const gap = q.d - (r + 1), ax = (q.x - c.x) / q.d, ay = (q.y - c.y) / q.d;
      if (gap > 0.5 && (c.vx || 0) * ax + (c.vy || 0) * ay > -20) moveCircle(c, ax * Math.min(gap, 30 * dt), ay * Math.min(gap, 30 * dt));
    }
  }
  return cv;
}

/* Every bot runs the same cone-of-fire rules as you: moving widens it, standing still steadies it,
   firing blooms it, and it sways and kicks. */
function updateBotAim(b, dt, t) {
  const mdx = b.x - b.px, mdy = b.y - b.py;
  const sp = Math.hypot(mdx, mdy) / Math.max(dt, 1e-4);
  if (Math.abs(mdx) + Math.abs(mdy) > 0.3) b.mvAng = Math.atan2(mdy, mdx);
  bootStep(b, Math.hypot(mdx, mdy), b.ang, b.mvAng);
  const md = Math.hypot(mdx, mdy);
  b.anim.phase += md / (STEP_LEN * Math.max(0.3, b.moveAmt)) * Math.PI;   // shorter steps when slower, so boots don't skate
  if (footfall(b.anim) && md > 0.05) b.stepNow = true;                 // a boot down: their footstep sound and print go with it
  springStep(b.anim, 'rx', 'rv', RECOIL.k, RECOIL.c, dt);
  b.px = b.x; b.py = b.y;
  b.moveAmt += (clamp(sp / BOT.refSpeed, 0, 1) - b.moveAmt) * Math.min(1, dt * 10);
  if (b.moveAmt < 0.08) b.steady = Math.min(1, b.steady + dt / STEADY_TIME);
  else b.steady = Math.max(0, b.steady - dt * 5);
  b.bloom = Math.max(0, b.bloom - BLOOM.decay * dt);
  const stillH = STILL_HALF + (STEADY_HALF - STILL_HALF) * (b.brace === undefined ? b.steady : b.brace);
  const dAng = b.prevAng === null ? 0 : angDiff(b.ang, b.prevAng);
  b.prevAng = b.ang;
  b.turnRate = (b.turnRate || 0) + (Math.abs(dAng) / Math.max(dt, 1e-4) - (b.turnRate || 0)) * Math.min(1, dt * 4);
  b.brace = b.steady * (1 - clamp(b.turnRate / BRACE_TURN, 0, 1));
  if (b.doorTouch) b.doorTouch.t -= dt;
  senseCover(b, b.ang, b.moveAmt, dt, b.reloadT > 0 || (b.doorTouch && b.doorTouch.t > 0) || (b.tac && b.tac.phase === 'hide'));   // no peek lean while hiding
  easeSupp(b, dt);
  armsStep(b.arms, dt, dAng, b.brace, b.cov.mount, b.supp);
  b.sway = b.arms.th;
  gunReach(b, b.ang + b.sway, b.cov.sh, dt, b.side.out ? PISTOL.len : 0, b.side.out ? PISTOL.lat : 0);
  holsterStep(b, dt, b.ang, b.reloadT > 0 || b.equip || b.grab || b.melee || b.side.reload > 0 || b.side.sw, b.moveAmt);
  const target = Math.min(MAX_HALF, stillH * (1 - COVER.mountCone * b.cov.mount) + (MOVE_HALF - stillH) * b.moveAmt + (Math.abs(b.cov.sh) < 0.8 ? 0.12 : 0) + SUPP.cone * (b.supp || 0) + b.bloom + ARMS.velWiden * Math.abs(b.arms.w));
  b.half += (target - b.half) * Math.min(1, dt * (target > b.half ? 14 : 5));
}

/* Characters are solid to each other: whoever is moving gets pushed back out of anyone they walk into,
   with a little sideways slide so two bots meeting in a doorway can squeeze past. */
function bumpOut(e, o) {
  if (o === e || o.dead) return;
  const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), min = BODY_R * 2;
  if (d >= min) return;
  if (d < 0.01) { moveCircle(e, Math.random() * 2 - 1, Math.random() * 2 - 1); return; }
  const push = min - d, nx = dx / d, ny = dy / d;
  moveCircle(e, nx * push - ny * push * 0.35, ny * push + nx * push * 0.35);
}
