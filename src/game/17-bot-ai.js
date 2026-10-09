/* ================= BOT AI ================= */
/* Bots see you by the same light rules: close up, in their own beam, lit by anything else, or dazzled by your light
   pointing at them (that includes your muzzle flash). Anything outside their eyes' field of view is missed. */
function botSees(b, dx, dy, d) {
  if (state !== 'play') return false;                                           // down or dead: not a target
  if (d > BOT.sight * (1 + STEADY_RANGE * b.steady)) return false;
  if (lightCast(b.x, b.y, dx / d, dy / d, d) < d - 2) return false;
  if (d < BOT.aware) return true;
  const off = Math.abs(angDiff(Math.atan2(dy, dx), b.ang));
  if (hasLight(b) && !b.dark && off < BOT.half) return true;                    // in their own beam (unless it's switched off)
  if (off > SEE.fov && b.state !== 'attack') return false;                        // behind them
  if (d < SEE.dark) return true;                                                  // a shape in the dark, close enough to make out
  if (hasLight(p) && Math.abs(angDiff(Math.atan2(-dy, -dx), redAng)) < CONE_HALF * SEE.glare && d < viewR * 1.4) return true;   // your light in their face
  if (attOn('laser') && laserDot && p.gun && off < SEE.fov && Math.abs(angDiff(Math.atan2(-dy, -dx), p.gun.ang)) < 0.06 && d < ATTFX.laser.reach) return true;   // a red beam straight at them, only if they're facing it
  return litByScene(p.x, p.y, p);
}
/* Not seeing you but seeing your beam land somewhere in front of them: suspicious, go and look toward the source. */
function noticeBeam(b, sees) {
  if (sees || b.state !== 'patrol' || (b.noticeT || 0) > performance.now() / 1000) return;
  if (attOn('laser') && laserDot && p.gun && state === 'play') {           // a visible laser: only noticed facing where it comes from, never from the flank or behind
    const g = p.gun, dx = g.mx - b.x, dy = g.my - b.y, d = Math.hypot(dx, dy);
    if (d < ATTFX.laser.reach && Math.abs(angDiff(Math.atan2(dy, dx), b.ang)) < SEE.fov && losClear(b.x, b.y, g.mx, g.my)) {
      b.noticeT = performance.now() / 1000 + SEE.noticeCd; investigate(b, p.x, p.y); return;
    }
  }
  for (const sp of beamSpots) {
    const dx = sp.x - b.x, dy = sp.y - b.y, d = Math.hypot(dx, dy);
    if (d > BOT.sight || Math.abs(angDiff(Math.atan2(dy, dx), b.ang)) > SEE.fov || !losClear(b.x, b.y, sp.x, sp.y)) continue;
    b.noticeT = performance.now() / 1000 + SEE.noticeCd;
    investigate(b, (sp.x + p.x) / 2, (sp.y + p.y) / 2);
    return;
  }
}

function pickWaypoint(b) {
  for (let n = 0; n < 80; n++) {
    let tx, ty;
    tx = 1 + Math.floor(Math.random() * (W - 2));
    ty = 1 + Math.floor(Math.random() * (H - 2));
    if (wall(tx, ty) || occ[ty * W + tx]) continue;          // not a wall, not under furniture
    if (n < 60 && OUTDOOR.includes(floorAt[ty * W + tx]) && Math.random() < 0.9) continue;   // patrols mostly stay indoors
    const gx = (tx + 0.5) * T, gy = (ty + 0.5) * T;
    if (Math.hypot(gx - b.x, gy - b.y) < 250) continue;
    const path = bfsPath(b.x, b.y, gx, gy, navBlocked);          // only somewhere it can really walk to (never a route through the bed: findPath falls back to ignoring furniture)
    if (path && path.length) { b.path = path; return; }
  }
  b.path = [];
}

function followPath(b, speed, dt) {
  speed *= loadMul(b) * PZ(b).speed;                                   // the same weight rule as yours
  let path = b.path;
  b.noSkip = (b.noSkip || 0) - dt;
  while (path.length) {
    const n = path[0], dx = n.x - b.x, dy = n.y - b.y;
    if (dx * dx + dy * dy < 64) { path.shift(); continue; }
    if (!path.safe && b.noSkip <= 0 && path.length > 1 && clearWide(b.x, b.y, path[1].x, path[1].y, b.r + 2)) { path.shift(); continue; }
    break;
  }
  if (!path.length) { b.stuckN = 0; return false; }
  const n = path[0], dx = n.x - b.x, dy = n.y - b.y, d = Math.hypot(dx, dy) || 1;
  const step = speed * dt;
  driveBot(b, dx / d, dy / d, path.length === 1 ? Math.min(speed, d * 4) : speed);   // ease into the final spot
  b.walkAng = Math.atan2(dy, dx);
  // snagged on a corner or wedged by someone: re-plan tile by tile from here, and step back toward open floor
  if ((b.lastMove || 0) < step * 0.25) b.blockT = (b.blockT || 0) + dt; else b.blockT = 0;
  // moving but getting no closer (jostling against light furniture, sliding back and forth): count it as blocked too
  if (n !== b.wpN) { b.wpN = n; b.wpD = d; b.wpT = 0; }
  else if (d < b.wpD - 2) { b.wpD = d; b.wpT = 0; }
  else if ((b.wpT += dt) > 1.5) { b.wpT = 0; b.wpD = d; b.blockT = 1; }
  if (b.blockT > 0.4) {
    b.blockT = 0; b.noSkip = 1.5;
    b.stuckN = (b.stuckN || 0) + 1;
    if (path.length === 1 || b.stuckN > 3) { b.path = []; b.stuckN = 0; return false; }   // can't get there: give up on this spot
    const goal = path[path.length - 1];
    b.path = findPath(b.x, b.y, goal.x, goal.y);
    const cx = (Math.floor(b.x / T) + 0.5) * T, cy = (Math.floor(b.y / T) + 0.5) * T;
    moveCircle(b, (cx - b.x) * 0.5, (cy - b.y) * 0.5);
  }
  return true;
}

function botShoot(b, d) {
  alarms.push({ x: b.x, y: b.y, t: simT });
  if (state === 'play' && !b.ally && !b.seen && Math.hypot(b.x - p.x, b.y - p.y) < BOT.fireRange * 1.4) threats.push({ x: b.x, y: b.y, t: THREAT_T, snd: true });   // fire from someone you can't see: show where it came from
  b.muzzle = 0.06; b.shotT = 0.4; b.fightAt = simT;
  const gl = b.side.out, sh = b.cov ? b.cov.sh : 1;
  const sup = !gl && bKit(b, 'supp');
  sfxShot(b.x, b.y, gl ? 'glock' : sup ? 'aks' : 'ak');
  if (gl) { b.burst = 0; b.fireCd = PISTOL.rate * (1.3 + Math.random() * 0.8); }  // the Glock: aimed single shots
  else if (++b.burst >= Math.max(1, BOT.burst + PZ(b).burst)) { b.burst = 0; b.fireCd = BOT.burstPause * (0.8 + Math.random() * 0.6); }
  else b.fireCd = BOT.burstRate;
  const g = b.gun || gunReach(b, b.ang + b.sway, sh, 0), a = g.ang + (Math.random() + Math.random() - 1) * Math.max(b.half, gl ? PISTOL.spread : 0) * PZ(b).aim;
  b.bloom = Math.min(BLOOM.max, b.bloom + BLOOM.add * (gl ? 0.8 : 1));
  recoilKick(b.arms, b.brace || 0, b.cov ? b.cov.mount : 0, angDiff(a, g.ang));
  b.anim.rv -= RECOIL.push * (gl ? 0.55 : 1);
  if (b.gunCd <= 0) { b.gunCd = 0.25; if (b.ally) allyNoise(b, GUN_NOISE, 'gun'); else emitHeard(b.x, b.y, GUN_NOISE * (sup ? ATTFX.supp.noise : 1), 'egun', 0.6); }
  const ux = Math.cos(a), uy = Math.sin(a);
  (b.ally ? bullets : botBullets).push(makeBullet(g.mx, g.my, ux, uy, gl ? PISTOL.speed : BOT.speed, gl ? PISTOL.dmg : BOT.dmg, b, gl ? 'pistol' : 'rifle'));   // out of the muzzle
  if (gl) { --b.side.ammo; b.hol.v += (Math.random() - 0.5) * 2; ejectCasing(b.x, b.y, g.ang, sh, b, [36, PISTOL.lat * (sh < 0 ? -1 : 1) + 2, 0.7]); }
  else { --b.ammo; ejectCasing(b.x, b.y, g.ang, sh, b); }
  gunSmoke(b, g.ang, b.cov ? b.cov.sh : 1, 0);
}

/* Hands and magazines, the same for bots and allies: rifle reloads, the Glock when the rifle is dry, scooping up mags. */
function botArms(b, dt) {
  if (b.reloadT > 0) {
    const f0 = 1 - b.reloadT / BOT.reload;
    b.reloadT -= dt;
    sfxReload(b, 'ak', f0, 1 - Math.max(0, b.reloadT) / BOT.reload);
    if (!b.magDropped && b.reloadT < BOT.reload * 0.8) { b.magDropped = true; sfxMagDrop(b.x, b.y); ejectMag(b.x, b.y, b.ang + b.sway, b.ammo, b); b.ammo = 0; if (b.ally) allyNoise(b, 120, 'walk'); else emitHeard(b.x, b.y, 120, 'ewalk', 0.4); }
    if (b.reloadT <= 0) { b.reloadT = 0; b.ammo = pullMag(b.mags); }
  } else if (b.mags.length && !b.grab && !b.equip && !b.side.out && !b.side.sw && (b.ammo <= 0 || (b.state !== 'attack' && b.ammo < BOT.mag * 0.4))) { b.reloadT = BOT.reload; b.magDropped = false; }   // empty, or top up when it's quiet (not mid gear swap)
  const rifleDry = b.ammo <= 0 && !b.mags.length && b.reloadT <= 0;
  sideTick(b, dt, rifleDry, b.ammo > 0 || b.mags.length > 0, !b.grab && !b.equip && !b.melee);   // the Glock comes out once the rifle is dry
  if (b.mags.length < MAG_VEST && (rifleDry || !fighting(b))) {   // scoop up the fullest magazine in reach (not the one they just dropped, unless dry); not mid-fight unless dry
    let bi = -1;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'mag' && (it.owner !== b || rifleDry) && Math.hypot(it.x - b.x, it.y - b.y) < PICKUP_R && (bi < 0 || it.rounds > items[bi].rounds)) bi = i;
    }
    if (bi >= 0) { b.mags.push(items[bi].rounds); items.splice(bi, 1); }
  }
  return rifleDry;
}
function updateBot(b, dt, t) {
  b.fireCd -= dt; b.muzzle -= dt; b.alertT -= dt; b.repathT -= dt; b.gunCd -= dt;
  const rifleDry = botArms(b, dt);
  if (b.stun > 0) {                                                  // flashed or concussed: blind and reeling, hands to the face
    b.stun -= dt; b.path = []; b.seesP = false; b.ang += Math.sin(t * 2.1 + b.seed) * dt * 1.6;
    if (b.stun > 0.6) driveBot(b, Math.cos(t * 0.8 + b.seed), Math.sin(t * 1.1 + b.seed), 22);
    if (b.stun <= 0 && b.stunAt) investigate(b, b.stunAt.x, b.stunAt.y);
    return;
  }
  if (b.evade && (b.evade.t -= dt) > 0) {                           // away from the grenade
    const ex = b.x - b.evade.x, ey = b.y - b.evade.y, el = Math.hypot(ex, ey) || 1; b.path = [];
    driveBot(b, ex / el, ey / el, 150); b.ang += clamp(angDiff(Math.atan2(ey, ex), b.ang), -6 * dt, 6 * dt);
    return;
  }
  const dry = rifleDry && !b.side;                                   // the Glock never runs out, so nobody carrying one is ever dry
  const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  const sees = botSees(b, dx, dy, d);
  noticeBeam(b, sees);
  b.seesP = sees;
  if (sees) intel = { x: p.x, y: p.y, t };                      // radioed to the squad
  if ((b.grab || b.equip) && botGear(b, dt, sees)) {            // gear going on: stands there, rifle down, can't fire
    b.path = []; if (sees) { const m = 3 * dt; b.ang += clamp(angDiff(Math.atan2(dy, dx), b.ang), -m, m); }
    return;
  }
  if (b.melee) { stepMelee(b, dt); return; }                       // knife out: nothing else until it's back in the sheath
  b.meleeCd = (b.meleeCd || 0) - dt;
  const mo = b.reloadT <= 0 && b.meleeCd <= 0 && !b.side.out && !b.side.sw ? meleeTarget(b) : null;
  b.meleeWait = mo ? (b.meleeWait || 0) + dt : 0;                    // a moment to react before going for the knife
  if (mo && b.meleeWait >= MELEE.react) { b.meleeWait = 0; startMelee(b, mo); return; }
  if (!sees && botReady(b) && civs.length && botShootsCiv(b, dt)) return;   // a bystander too close: they shoot them
  let foeA = null;                                                   // can't see you, but can see your teammate: fight them
  if (!sees) for (const a of allies) { if (a.dead) continue; const ax = a.x - b.x, ay = a.y - b.y, ad = Math.hypot(ax, ay) || 1; if (seesChar(b, a, ax, ay, ad, b.state === 'attack')) { foeA = a; break; } }
  if (foeA) {
    const ax = foeA.x - b.x, ay = foeA.y - b.y, ad = Math.hypot(ax, ay) || 1, to = Math.atan2(ay, ax);
    intel = { x: foeA.x, y: foeA.y, t }; b.lastKnown = { x: foeA.x, y: foeA.y };
    if (b.state !== 'attack') { b.state = 'attack'; b.reactT = BOT.react * PZ(b).react; b.alertT = 0.8; b.path = []; b.repathT = 0; b.burst = 0; }
    botTryFire(b, dt, ad, to);
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.holding = !b.holding; b.strafeDir = Math.random() < 0.5 ? -1 : 1; b.strafeT = b.holding ? 1.2 + Math.random() : 0.6 + Math.random() * 0.7; }
    if (!b.holding) driveBot(b, -Math.sin(to) * b.strafeDir, Math.cos(to) * b.strafeDir, BOT.strafeSpeed);
    const want = to + (Math.sin(t * 1.3 + b.seed) * 0.6 + Math.sin(t * 2.7 + b.seed * 2) * 0.4) * BOT.aimNoise * PZ(b).aim * (bKit(b, 'grip') ? 0.8 : 1), m = 7 * dt;
    b.ang += clamp(angDiff(want, b.ang), -m, m);
    return;
  }
  if (sees) b.hunt = null;
  else if (huntCiv(b, dt)) return;                                     // out hunting a bystander

  if (sees) {
    b.lastKnown = { x: p.x, y: p.y };
    if (b.state !== 'attack') { b.state = 'attack'; b.reactT = BOT.react * PZ(b).react; b.alertT = 0.8; b.path = []; b.repathT = 0; b.burst = 0; }
  } else if (b.state === 'attack') {
    b.state = 'search'; b.searchT = 10; b.arrived = false; b.path = []; b.repathT = 0;
  }

  let want = b.ang, rate = 3;
  if (!dry && b.wasDry) { b.wasDry = false; b.path = []; if (b.state !== 'attack' && b.lastKnown) investigate(b, b.lastKnown.x, b.lastKnown.y); }   // rearmed: back into the fight

  let tw = null;
  if (dry) [want, rate] = dryBot(b, dt, sees);
  else if (b.role && intel && (tw = tactic(b, dt, t, sees, dx, dy, d))) [want, rate] = tw;
  else if (b.state === 'attack') {
    const to = Math.atan2(dy, dx);
    want = to + (Math.sin(t * 1.3 + b.seed) * 0.6 + Math.sin(t * 2.7 + b.seed * 2) * 0.4) * BOT.aimNoise * PZ(b).aim * (bKit(b, 'grip') ? 0.8 : 1); rate = 7;
    botTryFire(b, dt, d, to);
    if (d > BOT.fireRange * 0.85 && (b.supp || 0) < 0.55 && b.role !== 'suppress' && advanceByCover(b, dt, t, d)) {
      // closing in from cover to cover (see advanceByCover)
    } else {                                         // plant feet and shoot, then reposition
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        b.holding = !b.holding;
        b.strafeDir = Math.random() < 0.5 ? -1 : 1;
        b.strafeT = b.holding ? 1.2 + Math.random() * 1.0 : 0.6 + Math.random() * 0.7;
      }
      if (!b.holding) driveBot(b, -Math.sin(to) * b.strafeDir, Math.cos(to) * b.strafeDir, BOT.strafeSpeed);
    }
  } else if (b.state === 'search') {
    b.searchT -= dt;
    if (b.searchT <= 0) { b.state = 'patrol'; b.path = []; b.wait = 0.5; b.arrived = false; }
    else if (b.arrived) {                            // look around
      b.scan -= dt; want = b.ang + 1; rate = 2.2;
      if (b.scan <= 0) { b.state = 'patrol'; b.path = []; b.wait = 0.3; b.arrived = false; }
    } else if (b.lastKnown) {
      if (b.repathT <= 0 || !b.path.length) { b.path = findPath(b.x, b.y, b.lastKnown.x, b.lastKnown.y); b.repathT = 0.6; }
      const moving = followPath(b, BOT.searchSpeed, dt);
      if (moving) want = b.walkAng;
      if (!moving || Math.hypot(b.lastKnown.x - b.x, b.lastKnown.y - b.y) < 24) { b.arrived = true; b.scan = 2.5; }
    } else { b.state = 'patrol'; }
  } else if (b.post) {                               // posted: holds their room, watching the ways in
    const P = b.post;
    if (Math.hypot(P.x - b.x, P.y - b.y) > 20) {
      if (!b.path.length) { b.path = findPath(b.x, b.y, P.x, P.y); if (!b.path.length) b.post = null; }   // can't get back: patrol instead
      if (followPath(b, BOT.patrolSpeed, dt)) want = b.walkAng; else b.path = [];
    } else if (b.lookT > 0) { b.lookT -= dt; want = b.lookAng; rate = 4; }   // turned toward a faint sound
    else { if ((P.t -= dt) <= 0) { P.t = 2 + Math.random() * 3; P.a = postLook(b); } want = P.a + Math.cos(t * 0.7 + b.seed) * 0.2; rate = 1.8; }
  } else {                                           // patrol
    if (b.wait > 0) {
      b.wait -= dt;
      if (b.lookT > 0) { b.lookT -= dt; want = b.lookAng; rate = 4; }   // turned toward a faint sound
      else { want = b.ang + Math.cos(t * 0.8 + b.seed) * 0.4; rate = 1.5; }
    }
    else {
      if (!b.path.length) pickWaypoint(b);
      const moving = followPath(b, BOT.patrolSpeed, dt);
      if (moving) want = b.walkAng; else { b.wait = 1 + Math.random() * 2; b.path = []; }
    }
  }
  const m = rate * dt;
  b.ang += clamp(angDiff(want, b.ang), -m, m);
}

