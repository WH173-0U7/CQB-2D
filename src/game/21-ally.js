/* ================= ALLY =================
   A US Army teammate who follows your lead (`allies`, `makeAlly`, `updateAlly`, `ALLY`). Same body, kit, rifle, Glock,
   knife and rules as everyone else (it runs on the bot body: `newBot`, `moveBot`, `updateBotAim`, `botArms`); only the
   brain is its own.
   - follow: holds a slot behind you on your support side (`allySlot`), keeps pace and runs to catch up, watches the
     flank you aren't covering while you move, sweeps it while you're still, and checks behind now and then.
   - out of your line: it never stands in your firing lane; it side-steps out of your cone (`allyClear`).
   - contact: it sees by the same light rules as everyone (`seesChar`). It calls it out (a CONTACT pop, and an edge
     marker for a threat you can't see yourself), and anything you can see it knows about too. It then fights from cover
     (`allyCover`: a tile near you hidden from the enemy, next to one that sees them): steps out to the peek tile and
     fires, ducks back to reload or when it gets hot, peeks again. With no cover in reach it holds and fires,
     side-stepping. Lost sight: it keeps rounds going into the last spot for `supFor` s (while it has ammo).
   - leash: it never fights more than `leash` from you; if you move off, it breaks off and comes with you, firing on the move.
   Enemies see and fight it like you (`seesChar` in updateBot); its rounds, footsteps and shots are heard by them. */
const ALLY = { back: 44, side: 26, leash: 240, hideR: 5, hideMin: 1.2, bound: 2.2, near: 26, run: 1.3, react: 0.3, aim: 0.35, repath: 0.4, coverR: 4, peekT: [1.6, 2.8], hideT: [0.8, 1.5],
  hot: 0.45, lose: 6, supFor: 4, supMin: 30, callCd: 4, rearT: [6, 10], rearFor: 1.1 };
/* At the safe house your teammate is off duty: on the living-room sofa watching TV, helmet off beside him, rifle slung.
   The TV flickers through colours as the picture changes (`tvStep`: its light and its screen). */
function allyOffDuty(a) {
  const so = pieces.filter(f => f.c === 'S').sort((u, v) => Math.hypot(u.x + u.w / 2 - 10 * T, u.y + u.h / 2 - 18.5 * T) - Math.hypot(v.x + v.w / 2 - 10 * T, v.y + v.h / 2 - 18.5 * T))[0];
  if (!so) return;
  const tvx = tvPiece ? tvPiece.x + tvPiece.w / 2 : so.x + so.w / 2, tvy = tvPiece ? tvPiece.y + tvPiece.h / 2 : so.y - 200;
  a.x = a.px = a.seatX = so.x + so.w / 2 - 14; a.y = a.py = a.seatY = so.y + so.h / 2 + 1; a.ang = Math.atan2(tvy - a.y, tvx - a.x);
  a.relax = true; a.prot.helmet = 0; a.helmAt = { x: so.x + so.w / 2 + 16, y: so.y + so.h / 2 + 1, a: 0.6 };
}
const TV = { col: [[130, 160, 255], [255, 210, 150], [120, 230, 160], [235, 240, 255], [255, 120, 110], [170, 120, 255], [90, 140, 220]], cut: [0.3, 1.6] };
let tvS = { t: 0, i: 0, k: 0.35 };
function tvStep(dt) {
  if (!tvPiece || tvPiece.broken || !tvPiece.light) return;
  if ((tvS.t -= dt) <= 0) { tvS.t = TV.cut[0] + Math.random() * (TV.cut[1] - TV.cut[0]); tvS.i = (tvS.i + 1 + (Math.random() * (TV.col.length - 1) | 0)) % TV.col.length; tvS.k = 0.25 + Math.random() * 0.2; }   // a new shot
  const L = tvPiece.light, c = TV.col[tvS.i];
  for (let q = 0; q < 3; q++) L.col[q] += (c[q] - L.col[q]) * Math.min(1, dt * 14);
  L.k = tvS.k * (0.9 + 0.1 * Math.sin(simT * 23) * Math.sin(simT * 7.3));    // the picture flickers a little
}
function drawTvScreen() {                                                       // the screen itself, glowing over the dark
  const f = tvPiece;
  if (!f || f.broken || !f.light || !onView(f.x + f.w / 2, f.y, 60)) return;
  const c = f.light.col.map(v => v | 0).join(',');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(' + c + ',' + (0.35 + f.light.k).toFixed(2) + ')'; ctx.fillRect(f.x + 7, f.y + 6.3, f.w - 14, 1.6); ctx.restore();
}
function makeAlly() {
  const c = Math.cos(p.aim), s = Math.sin(p.aim);
  let x = p.x, y = p.y;
  for (const [bk, sd] of [[ALLY.back, -ALLY.side], [ALLY.back, ALLY.side], [ALLY.back, 0], [0, -48], [0, 48]]) {   // just behind you at the start
    const tx = p.x - c * bk - s * sd, ty = p.y - s * bk + c * sd, i = Math.floor(tx / T), j = Math.floor(ty / T);
    if (!wall(i, j) && !occ[j * W + i] && losClear(p.x, p.y, tx, ty)) { x = tx; y = ty; break; }
  }
  const a = newBot(0, 0, 9);
  return Object.assign(a, { x, y, px: x, py: y, sx: x, sy: y, ang: p.aim, ally: true, look: ALLY_LOOK, vis: 0, mode: 'follow', lastFoe: null, tac: null, callT: -99, rearT: rnd(ALLY.rearT), rear: 0 });
}
/* Can viewer `v` see character `e`? The same light rules as everyone: close up, in a beam, in the dark within SEE.dark, a
   muzzle flash, or lit by anything else; outside the eyes' field of view only once already fighting. */
function seesChar(v, e, dx, dy, d, fight) {
  if (d > BOT.sight * (1 + STEADY_RANGE * (v.steady || 0))) return false;
  if (lightCast(v.x, v.y, dx / d, dy / d, d) < d - 2) return false;
  if (d < BOT.aware) return true;
  const off = Math.abs(angDiff(Math.atan2(dy, dx), v.ang));
  if (hasLight(v) && !v.dark && off < BOT.half) return true;
  if (off > SEE.fov && !fight) return false;
  if (d < SEE.dark || (e.muzzle || -1) > -0.08) return true;
  return litByScene(e.x, e.y, e);
}
function allyNoise(a, r, kind) {                      // a sound your teammate makes: the enemy hears it, you see it like your own
  const ext = new Float32Array(SOUND_RAYS);
  fillExtents(ext, a.x, a.y, r);
  waves.push({ x: a.x, y: a.y, ext, f: 0, dur: kind === 'gun' ? 0.6 : 0.75, kind });
  hearSound(ext, a.x, a.y, kind === 'gun' ? 70 : 90);
}
function allySlot() {                                  // behind you, off your support shoulder; the other side or straight behind if that's blocked
  const c = Math.cos(p.aim), s = Math.sin(p.aim), sd = -((p.cov && p.cov.sh) < 0 ? -1 : 1);
  for (const [bk, sx] of [[ALLY.back, ALLY.side * sd], [ALLY.back, -ALLY.side * sd], [ALLY.back, 0], [ALLY.back * 0.6, 0]]) {
    const x = p.x - c * bk - s * sx, y = p.y - s * bk + c * sx, i = Math.floor(x / T), j = Math.floor(y / T);
    if (!wall(i, j) && !occ[j * W + i] && losClear(p.x, p.y, x, y)) return { x, y, sd };
  }
  return { x: p.x, y: p.y, sd, close: true };
}
function allyTryFire(a, dt, x, y, r, d, to) {
  if (d < BOT.fireRange * (1 + STEADY_RANGE * a.steady) && Math.abs(angDiff(to, a.gun ? a.gun.ang : a.ang + a.sway)) < a.half * 1.3 + Math.atan2(r, d) && gunCanFire(a) && a.fireCd <= 0 && botReady(a) && (!a.cov || Math.abs(a.cov.sh) > 0.8)) {
    const f = friendInLine(a, state === 'play' || state === 'downed' ? [p].concat(civs) : civs, d, a.half);
    if (f) clearLine(a, f, dt);                                                     // you (or a bystander) in the way: hold fire, step to open the line
    else if (Math.random() < (a.supp || 0) * 0.4) a.fireCd = 0.15 + Math.random() * 0.2;
    else botShoot(a, d);
  }
}
function allyCover(a, I) {                            // a hidden tile near the ally (and you) with a neighbouring tile that sees the enemy
  const ai = Math.floor(a.x / T), aj = Math.floor(a.y / T), R = ALLY.coverR;
  let best = null, bs = 1e9;
  for (let j = aj - R; j <= aj + R; j++) for (let i = ai - R; i <= ai + R; i++) {
    if (wall(i, j) || occ[j * W + i]) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T, dI = Math.hypot(x - I.x, y - I.y);
    if (Math.hypot(x - p.x, y - p.y) > ALLY.leash * 0.75 || dI < 90 || dI > BOT.fireRange) continue;
    if (!bodyHidden(x, y, I, BODY_R)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (wall(ni, nj) || occ[nj * W + ni]) continue;
      const nx = (ni + 0.5) * T, ny = (nj + 0.5) * T;
      if (!losClear(nx, ny, I.x, I.y)) continue;
      const sc = Math.hypot(x - a.x, y - a.y) + 0.4 * Math.hypot(x - p.x, y - p.y);
      if (sc < bs) { bs = sc; best = { hx: x, hy: y, px: nx, py: ny }; }
      break;
    }
  }
  return best;
}
function allyHide(a, I) {                            // the nearest spot the whole body is hidden from the threat, leaning toward you
  const ai = Math.floor(a.x / T), aj = Math.floor(a.y / T), R = ALLY.hideR;
  let best = null, bs = 1e9;
  for (let j = aj - R; j <= aj + R; j++) for (let i = ai - R; i <= ai + R; i++) {
    if (i < 0 || j < 0 || i >= W || j >= H || wall(i, j) || occ[j * W + i]) continue;
    const x = (i + 0.5) * T, y = (j + 0.5) * T;
    if (!bodyHidden(x, y, I, BODY_R + 2)) continue;
    const sc = Math.hypot(x - a.x, y - a.y) + 0.5 * Math.hypot(x - p.x, y - p.y);
    if (sc < bs) { bs = sc; best = { x, y }; }
  }
  return best;
}
/* Cut off from you, or caught in the open with no fighting position, with a threat about: get the body out of its line first,
   fire at it on the way if it's in sight, sit tight until the fire eases, then bound on (`ALLY.bound` s without stopping to hide again). */
function allySurvive(a, dt, t, foe, fd) {
  const I = foe || a.lastFoe;
  if (!I) return null;
  let sf = a.safe;
  if (!sf) {
    if (t < (a.boundT || 0) || !losClear(I.x, I.y, a.x, a.y)) return null;      // bounding, or already out of its line
    const h = allyHide(a, I);
    if (!h) return null;
    sf = a.safe = { x: h.x, y: h.y, t0: t }; a.path = [];
  } else if (t - sf.t0 > 0.5 && !bodyHidden(sf.x, sf.y, I, BODY_R)) { a.safe = null; return null; }   // the threat moved: pick again
  const there = !allyGo(a, sf.x, sf.y, BOT.searchSpeed * 1.2, dt);
  if (there && a.ammo < BOT.mag * 0.6 && a.mags.length && a.reloadT <= 0 && !a.side.out && !a.side.sw) { a.reloadT = BOT.reload; a.magDropped = false; }   // reload behind it
  if (there && t - sf.t0 > ALLY.hideMin && (a.supp || 0) < 0.2 && a.reloadT <= 0) { a.safe = null; a.boundT = t + ALLY.bound; a.path = []; }
  const to = Math.atan2(I.y - a.y, I.x - a.x);
  if (foe) allyTryFire(a, dt, foe.x, foe.y, foe.r, fd, to);
  return [to, 6];
}
function allyGo(a, x, y, speed, dt) {                 // walk a path there (re-planned now and then); true while still on the way
  const d = Math.hypot(x - a.x, y - a.y);
  if (d < 10) { a.path = []; return false; }
  if ((a.repathT -= dt) <= 0 || !a.path.length) { a.path = findPath(a.x, a.y, x, y); a.repathT = ALLY.repath; }
  if (!followPath(a, Math.min(speed, 40 + d * 3), dt) && losClear(a.x, a.y, x, y)) driveBot(a, (x - a.x) / d, (y - a.y) / d, Math.min(speed, d * 4));
  return true;
}
function allyClear(a) {                               // standing in your firing lane: step out of it
  if (state !== 'play' || !p.gun) return;
  const g = p.gun, ux = Math.cos(g.ang), uy = Math.sin(g.ang), dx = a.x - g.mx, dy = a.y - g.my, s = dx * ux + dy * uy;
  if (s < -a.r || s > redR + 30) return;
  const off = dx * uy - dy * ux;
  if (Math.abs(off) > a.r + 12 + Math.max(0, s) * Math.tan(redHalf)) return;
  if (!losClear(g.mx, g.my, a.x, a.y)) return;
  const sd = off >= 0 ? 1 : -1;
  driveBot(a, uy * sd, -ux * sd, p.speed);
}
function updateAlly(a, dt, t) {
  a.fireCd -= dt; a.muzzle -= dt; a.gunCd -= dt;
  botArms(a, dt);
  if (a.relax) { a.vx = a.vy = 0; a.moveAmt = 0; a.x = a.px = a.seatX; a.y = a.py = a.seatY; return; }   // off duty on the sofa (nothing shoves him off it)
  if (a.stun > 0) { a.stun -= dt; a.ang += Math.sin(t * 2.1 + a.seed) * dt * 1.4; return; }   // caught by a flash or a blast: reeling
  if (a.melee) { stepMelee(a, dt); return; }                       // knife out: nothing else until it's sheathed
  a.meleeCd = (a.meleeCd || 0) - dt;
  if (a.meleeCd <= 0 && a.reloadT <= 0 && !a.side.out && !a.side.sw) { const o = meleeTarget(a); if (o) { startMelee(a, o); return; } }
  // who's out there: its own eyes first, then anything you can see (you'd tell it)
  let foe = null, fd = 1e9;
  for (const b of bots) {
    if (b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    if (d < fd && seesChar(a, b, dx, dy, d, a.mode === 'fight')) { foe = b; fd = d; }
  }
  if (foe) {
    if (a.mode !== 'fight') { a.reactT = ALLY.react; a.tac = null; if (t - a.callT > ALLY.callCd) pop(a.x, a.y - 24, 'CONTACT', '#8ecbff', 1); }
    a.callT = t; a.mode = 'fight'; a.lastFoe = { x: foe.x, y: foe.y, t, b: foe };
    if (state === 'play' && !foe.seen && (foe.callT || 0) < t) { foe.callT = t + 1.5; threats.push({ x: foe.x, y: foe.y, t: THREAT_T }); }   // one you can't see: shown at the screen edge
  } else {
    let kb = null, kd = BOT.fireRange * 1.3;
    for (const b of bots) if (!b.dead && b.seen) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < kd) { kd = d; kb = b; } }
    if (kb) { if (a.mode !== 'fight') a.tac = null; a.mode = 'fight'; a.lastFoe = { x: kb.x, y: kb.y, t, b: kb }; }
  }
  if (a.mode === 'fight' && (!a.lastFoe || t - a.lastFoe.t > ALLY.lose || (a.lastFoe.b && a.lastFoe.b.dead && !foe))) { a.mode = 'follow'; a.tac = null; a.path = []; }
  const dP = Math.hypot(p.x - a.x, p.y - a.y), leashed = dP > ALLY.leash || (dP > 150 && !losClear(a.x, a.y, p.x, p.y));
  let want = a.ang, rate = 3.5;
  if (a.mode === 'fight' && !leashed) [want, rate] = allyFight(a, dt, t, foe, fd);
  else [want, rate] = allyFollow(a, dt, t, foe, fd, leashed);
  allyClear(a);
  const m = rate * dt;
  a.ang += clamp(angDiff(want, a.ang), -m, m);
}
function allyFollow(a, dt, t, foe, fd, apart) {
  if (a.mode === 'fight') { a.tac = null; }
  const threat = foe || (a.lastFoe && t - a.lastFoe.t < ALLY.lose) || (a.supp || 0) > 0.2;
  if ((apart || a.safe) && threat) { const r = allySurvive(a, dt, t, foe, fd); if (r) return r; }   // separated under threat: its own survival first
  else a.safe = null;
  const sl = allySlot(), d = Math.hypot(sl.x - a.x, sl.y - a.y), pv = Math.hypot(p.vx, p.vy);
  if (d > ALLY.near + (a.path.length ? 0 : 14)) allyGo(a, sl.x, sl.y, Math.min(p.speed * ALLY.run, Math.max(80, pv * 1.2 + d * 0.8)), dt);   // keep up; run when falling behind
  else a.path = [];
  if (foe) {                                           // on the move with an enemy in sight: fire as it comes
    const to = Math.atan2(foe.y - a.y, foe.x - a.x);
    allyTryFire(a, dt, foe.x, foe.y, foe.r, fd, to);
    return [to, 6];
  }
  if ((a.rearT -= dt) <= 0) { a.rear = ALLY.rearFor; a.rearT = rnd(ALLY.rearT); }
  if (a.rear > 0) { a.rear -= dt; return [p.aim + Math.PI + sl.sd * 0.3, 4]; }   // a check behind
  if (pv > 30) return [p.aim + sl.sd * 0.5, 3.5];           // moving: the flank you aren't watching
  return [p.aim + sl.sd * (1.0 + 0.55 * Math.sin(t * 0.45 + a.seed)), 2];   // holding: sweep that side
}
function allyFight(a, dt, t, foe, fd) {
  const I = foe || a.lastFoe, to = Math.atan2(I.y - a.y, I.x - a.x), dI = foe ? fd : Math.hypot(I.x - a.x, I.y - a.y);
  const want = to + (Math.sin(t * 1.3 + a.seed) * 0.6 + Math.sin(t * 2.7 + a.seed * 2) * 0.4) * BOT.aimNoise * ALLY.aim;
  let tc = a.tac;
  if (!tc || t > tc.replan || Math.hypot(I.x - tc.ix, I.y - tc.iy) > 2 * T) {     // (re)pick cover against where the enemy is
    const c = allyCover(a, I);
    a.tac = tc = c ? Object.assign(c, { phase: 'peek', until: t + rnd(ALLY.peekT), ix: I.x, iy: I.y, replan: t + 6 }) : { none: true, ix: I.x, iy: I.y, replan: t + 1.5 };
    a.path = [];
  }
  const hot = (a.supp || 0) > ALLY.hot, low = a.ammo < BOT.mag * 0.3 && a.mags.length && !a.side.out;
  if (!tc.none) {
    a.safe = null;
    if (tc.phase === 'peek') {
      allyGo(a, tc.px, tc.py, BOT.searchSpeed, dt);
      if (hot || low || (t > tc.until && !foe)) { tc.phase = 'hide'; tc.until = t + rnd(ALLY.hideT); a.path = []; }
    } else {
      allyGo(a, tc.hx, tc.hy, BOT.searchSpeed * 1.1, dt);
      if (a.ammo < BOT.mag * 0.6 && a.mags.length && a.reloadT <= 0 && !a.side.out && !a.side.sw) { a.reloadT = BOT.reload; a.magDropped = false; }   // reload in cover
      if (t > tc.until && (a.supp || 0) < 0.25 && a.reloadT <= 0) { tc.phase = 'peek'; tc.until = t + rnd(ALLY.peekT); a.path = []; }
      return [want, 6];
    }
  } else if (hot || low || a.reloadT > 0 || a.safe) {   // no fighting position and it's getting hot: out of its line until it eases
    const r = allySurvive(a, dt, t, foe, fd);
    if (r) return r;
  } else {                                             // nowhere to hide: hold and fire, stepping side to side
    a.strafeT -= dt;
    if (a.strafeT <= 0) { a.holding = !a.holding; a.strafeDir = Math.random() < 0.5 ? -1 : 1; a.strafeT = a.holding ? 1.2 + Math.random() : 0.5 + Math.random() * 0.6; }
    if (!a.holding) driveBot(a, -Math.sin(to) * a.strafeDir, Math.cos(to) * a.strafeDir, BOT.strafeSpeed);
  }
  if (a.reactT > 0) { a.reactT -= dt; return [want, 7]; }
  if (foe) allyTryFire(a, dt, foe.x, foe.y, foe.r, fd, to);
  else if (t - I.t < ALLY.supFor && ammoLeft(a) > ALLY.supMin && losClear(a.x, a.y, I.x, I.y) && a.fireCd <= 0 && Math.abs(angDiff(to, a.ang)) < 0.15) {   // lost them: rounds into the last spot
    allyTryFire(a, dt, I.x, I.y, BODY_R, dI, to);
    if (a.fireCd > 0) a.fireCd = Math.max(a.fireCd, SQUAD.supRate + Math.random() * 0.25);
  }
  return [want, 7];
}

