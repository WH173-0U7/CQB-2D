/* ================= UPDATE ================= */
function update(dt, t) {
  simT = t; voxStep();
  if (state !== 'play') stateT += dt;

  // turning: swipe on the right side, or Q/E, or arrow keys
  let turn = VH ? turnAccum / VH * TURN_SENS : 0;
  turnAccum = 0;
  if (keys.KeyQ || keys.ArrowLeft) turn -= 2.4 * dt * sets.keys;
  if (keys.KeyE || keys.ArrowRight) turn += 2.4 * dt * sets.keys;
  if (p.melee && p.melee.rg && p.melee.rg.pin) turn *= MELEE.carryTurn;    // a body on the knife: heavy to swing round
  p.aim += turn; turned += Math.abs(turn);
  if (p.aim > Math.PI) p.aim -= Math.PI * 2; else if (p.aim < -Math.PI) p.aim += Math.PI * 2;

  // movement is relative to the screen: up = where you're facing
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA) mx -= 1;
  if (keys.KeyD) mx += 1;
  const mv = stickVec(sticks.move);
  mx += mv.x; my += mv.y;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const th = p.aim + Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
  const wx = mx * c - my * s, wy = my * c + mx * s;
  const ox = p.x, oy = p.y;
  let spd = p.speed * loadMul(p) * (1 - (1 - COVER.duckSpeed) * (p.cov.duck || 0)) * (p.melee && p.melee.rg && p.melee.rg.pin ? MELEE.carry : 1);   // heavier kit, slower; a body on the knife, much slower
  if (wx * wx + wy * wy > 1e-4) spd *= dirSpeed(Math.atan2(wy, wx), p.aim);     // forward fast, sideways slower, backwards slowest
  if (state === 'downed') {                                     // down: the stick drags you; the camera follows your body
    const rg = rags.find(q => q.c === p);
    if (rg && rg.alive) { rg.alive.ix = wx; rg.alive.iy = wy; p.x = (rg.pts[1].x + rg.pts[2].x) / 2; p.y = (rg.pts[1].y + rg.pts[2].y) / 2; }
    p.vx = p.vy = 0;
  }
  let tvx = wx * spd, tvy = wy * spd;
  if (bench) {                                                  // at the workbench, the locker or the PC: walk up to the spot in front of it (through the normal movement, so walls and the piece stop you), then stand
    const st = benchStand(bench.kind), dx = st.x - p.x, dy = st.y - p.y, d = Math.hypot(dx, dy), v = d > 1.5 ? Math.min(spd * 0.6, d * 5) : 0;
    tvx = d > 1.5 ? dx / d * v : 0; tvy = d > 1.5 ? dy / d * v : 0;
  }
  accelToward(p, state === 'play' ? tvx : 0, state === 'play' ? tvy : 0, dt);
  if (state === 'play') { moveChar(p, p.vx * dt, p.vy * dt); keepActualSpeed(p, ox, oy, dt); }
  moved += Math.hypot(p.x - ox, p.y - oy);

  // how steady you are, how wide your cone of fire is, how much noise you make
  {
    const speedNow = Math.hypot(p.x - ox, p.y - oy) / Math.max(dt, 1e-4);
    moveAmt += (clamp(speedNow / p.speed, 0, 1) - moveAmt) * Math.min(1, dt * 10);
    if (moveAmt < 0.08) steady = Math.min(1, steady + dt / STEADY_TIME);
    else steady = Math.max(0, steady - dt * 5);
    bloom = Math.max(0, bloom - BLOOM.decay * dt);
    const stepD = Math.hypot(p.x - ox, p.y - oy);
    pAnim.phase += stepD / (STEP_LEN * Math.max(0.3, moveAmt)) * Math.PI;
    if (stepD > 0.3) pAnim.mvAng = Math.atan2(p.y - oy, p.x - ox);
    bootStep(p, stepD, p.aim, pAnim.mvAng);
    springStep(pAnim, 'rx', 'rv', RECOIL.k, RECOIL.c, dt);                // rifle slides back home
    springStep(camKick, 'd', 'v', RECOIL.camK, RECOIL.camC, dt);
    if (footfall(pAnim) && stepD > 0.05) { sfxStep(p.x, p.y, moveAmt, 400, true); arms.w += arms.foot * ARMS.step * moveAmt; arms.foot = -arms.foot; }   // each step rocks the gun
    turnRate += (Math.abs(turn) / Math.max(dt, 1e-4) - turnRate) * Math.min(1, dt * 4);
    const brace = steady * (1 - clamp(turnRate / BRACE_TURN, 0, 1));            // turning breaks the brace
    if (p.doorTouch) p.doorTouch.t -= dt;
    const pushingDoor = p.doorTouch && p.doorTouch.t > 0;
    senseCover(p, p.aim, moveAmt, dt, reloading > 0 || pushingDoor || pickT > 0 || !!equip);
    easeSupp(p, dt); tunnelStep(dt);
    armsStep(arms, dt, turn, brace, p.cov.mount, p.supp);
    sway = arms.th;
    redAng = p.aim + sway;
    gunReach(p, redAng, p.cov.sh, dt, p.side.out ? PISTOL.len : attOn('supp') ? GUN.len + ATTFX.supp.len : 0, p.side.out ? PISTOL.lat : 0);
    holsterStep(p, dt, p.aim, reloading > 0 || equip || (pickItem && pickT > 0) || p.melee || p.secure || p.side.reload > 0 || p.side.sw, moveAmt);
    const stillH = STILL_HALF + (STEADY_HALF - STILL_HALF) * brace;
    const moveK = (attOn('grip') ? ATTFX.grip.move : 1) * (laserOn() ? ATTFX.laser.move : 1);   // a grip / a laser: much steadier on the move
    const target = Math.min(MAX_HALF, stillH * (1 - COVER.mountCone * p.cov.mount) + (MOVE_HALF - stillH) * moveAmt * moveK
      + (Math.abs(p.cov.sh) < 0.8 ? 0.12 : 0) + (pushingDoor ? 0.06 : 0) + SUPP.cone * (p.supp || 0) + bloom + ARMS.velWiden * Math.abs(arms.w));
    redHalf += (target - redHalf) * Math.min(1, dt * (target > redHalf ? 14 : 5));
    viewR = CONE_R * (1 + STEADY_RANGE * steady);
    redR = RED_R * (1 + STEADY_RANGE * steady) * (1 + (attOn('dot') ? ATTFX.dot[pWeapon()] : 0));   // a red dot: locks on further out
    {
      const ast = sticks.aim, held = ast.id !== null, kx = (keys.KeyE || keys.ArrowRight ? 1 : 0) - (keys.KeyQ || keys.ArrowLeft ? 1 : 0);
      // calm and still: ease in on yourself to read your gear; anything happening pulls straight back out
      const calm = state === 'play' && steady > 0.95 && moveAmt < 0.05 && !held && !kx && (p.supp || 0) < 0.15 && fireCd < -1 && !bots.some(b => !b.dead && b.seen);
      inspectT = calm ? inspectT + dt : 0;
      const it = inspectT > INSPECT.delay ? 1 : 0;
      inspect += (it - inspect) * Math.min(1, dt * (it > inspect ? INSPECT.in : INSPECT.out));
      zoom = (1 - (1 - STEADY_ZOOM) * steady * (1 - inspect)) * (1 + (INSPECT.zoom - 1) * inspect) * (1 - (attOn('dot') ? ATTFX.dot.zoom : 0) * (1 - inspect));   // ...and the view pulls back a little
      zoom *= 1 + (BENCH.zoom / zoom - 1) * benchK;                   // at the workbench: close in on your hands
      // aiming: the camera goes where you drag (it may leave you off screen)
      const sx = held ? clamp((ast.x - ast.ox) / STICK_R, -1, 1) : kx, sy = held ? clamp((ast.y - ast.oy) / STICK_R, -1, 1) : 0, k = Math.min(1, dt * LOOK.ease);
      look.x += (-sx * LOOK.side * VW - look.x) * k;
      look.y += ((held || kx ? LOOK.fwd * VH : 0) + Math.max(0, -sy) * LOOK.far * VH - look.y) * k;
    }

    const noiseTarget = moveAmt > 0.06 ? WALK_NOISE_MIN + (WALK_NOISE_MAX - WALK_NOISE_MIN) * moveAmt : 0;
    noiseR += (noiseTarget - noiseR) * Math.min(1, dt * 8);
    stepT -= dt;
    if (state === 'play' && noiseR > 40 && stepT <= 0) {
      stepT = 0.5;                                   // a footstep "pulse" twice a second
      const ext = new Float32Array(SOUND_RAYS);
      fillExtents(ext, p.x, p.y, noiseR * (glassAt(p.x, p.y, 10) ? GLASS_STEP : 1));   // crunching over glass carries further
      waves.push({ x: p.x, y: p.y, ext, f: 0, dur: 0.75, kind: 'walk' });
      hearSound(ext, p.x, p.y, 90);
    }
    for (let i = waves.length - 1; i >= 0; i--) { waves[i].f += dt / waves[i].dur; if (waves[i].f >= 1) waves.splice(i, 1); }
  }

  if (state === 'play' && hasLight(p)) { const c = Math.cos(redAng), s = Math.sin(redAng), d = lightCast(p.x, p.y, c, s, viewR); beamSpots = [0.4, 0.7, 1].map(f => ({ x: p.x + c * d * f, y: p.y + s * d * f })); }
  else beamSpots = [];
  // bot brains
  const live = state === 'play' || state === 'downed';            // the world goes on while you're down
  if (state === 'dead') for (const b of bots) if (b.melee && !b.dead) stepMelee(b, dt);   // the one who knifed you finishes the job
  if (state === 'play') squadThink(dt, t);
  if (live) {
    for (const b of bots) if (!b.dead) updateBot(b, dt, t);
    for (const a of allies) if (!a.dead) updateAlly(a, dt, t);
    for (const b of bots) if (!b.dead) moveBot(b, dt);
    for (const a of allies) if (!a.dead) moveBot(a, dt);
    separateBots();
    for (const b of bots) if (!b.dead) updateBotAim(b, dt, t);
    for (const a of allies) if (!a.dead) updateBotAim(a, dt, t);
    for (const a of allies) {                       // their footsteps: heard by the enemy, shown like yours
      if (a.dead || !a.stepNow) continue;
      a.stepNow = false; a.sx = a.x; a.sy = a.y; a.foot = -a.foot; a.stepCount++;
      a.arms.w += a.foot * ARMS.step * a.moveAmt;
      sfxStep(a.x, a.y, a.moveAmt, 500);
      if ((a.ringT || 0) > t) continue;
      a.ringT = t + 0.5; allyNoise(a, (WALK_NOISE_MIN + (WALK_NOISE_MAX - WALK_NOISE_MIN) * a.moveAmt) * (glassAt(a.x, a.y, 10) ? GLASS_STEP : 1), 'walk');
    }
    updateCivs(dt);
    for (const b of bots) {                         // their footsteps: one per stride they actually walk
      if (b.dead || !b.stepNow) continue;
      b.stepNow = false;
      b.sx = b.x; b.sy = b.y;
      b.foot = -b.foot; b.stepCount++;
      b.arms.w += b.foot * ARMS.step * b.moveAmt;          // their steps rock their gun too
      sfxStep(b.x, b.y, b.moveAmt, (WALK_NOISE_MIN + (WALK_NOISE_MAX - WALK_NOISE_MIN) * b.moveAmt) * RINGS.hear);   // heard as far as you'd pick out their step
      if ((b.ringT || 0) > t || !soundVis()) continue;         // a step ring at most twice a second, like yours (visual-sound mode only)
      const ext = hearAt(b.x, b.y, (WALK_NOISE_MIN + (WALK_NOISE_MAX - WALK_NOISE_MIN) * b.moveAmt) * RINGS.hear);   // you pick out their steps from further than the bare sound reach
      if (!ext) continue;                                     // you can't hear this step
      b.ringT = t + 0.5;
      waves.push({ x: b.x, y: b.y, ext, f: 0, dur: 0.75, kind: 'ewalk' });
    }
  }

  // bot visibility to you + red-cone lock
  let anyLocked = false;
  const lockTol = fireCd > -0.2 ? 1.3 : 1;
  for (const b of bots) {
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, to = Math.atan2(dy, dx), slack = Math.atan2(b.r, d);
    const clear = () => lightCast(p.x, p.y, ux, uy, d) >= d - 2;
    let seen = false;
    if (d < AWARE_R + b.r && clear()) seen = true;
    if (!seen && d < pDarkR(angDiff(to, p.aim)) && Math.abs(angDiff(to, p.aim)) < SEE.fov + slack && clear()) seen = true;   // your eyes: anywhere in front of you, as far as you can make things out in the dark
    if (!seen && hasLight(p) && d < viewR && Math.abs(angDiff(to, redAng)) < CONE_HALF + slack && clear()) seen = true;   // in your weapon light's beam
    if (!seen && !b.dead && b.muzzle > -0.08 && !cSupp(b) && d < viewR * 1.6 && clear()) seen = true;   // their muzzle flash gives them away
    if (!seen && !b.dead && litByScene(b.x, b.y, b) && clear()) seen = true;                // lit by a lamp, a flash or another beam
    if (seen) b.seenT = 0.35; else if ((b.seenT = (b.seenT || 0) - dt) > 0 && clear()) seen = true;   // a moment's grace: no popping in and out at the edge of sight or a flickering light
    const g = p.gun, gdx = b.x - g.mx, gdy = b.y - g.my, gd = Math.hypot(gdx, gdy) || 1;   // the cone starts at the muzzle and follows the barrel
    const onLaser = !b.dead && laserDot && laserOn() && Math.hypot(laserDot.x - b.x, laserDot.y - b.y) < b.r + 4;   // your laser's dot on them: you can shoot what you can't see
    b.locked = !b.dead && (seen || onLaser) && gd < redR && Math.abs(angDiff(Math.atan2(gdy, gdx), g.ang)) < redHalf * lockTol + Math.atan2(b.r, gd);
    if (b.locked) anyLocked = true;
    b.seen = seen;                                                                 // properly made out: lock-on, labels, "calm"
    const shown = seen || (!b.dead && d < viewR * 1.6 && clear());               // in your line at all: drawn, and the darkness fades it by how lit it is
    b.vis += ((shown ? 1 : 0) - b.vis) * Math.min(1, dt * (shown ? 20 : 8));
    b.know += ((seen ? 1 : 0) - (b.know || 0)) * Math.min(1, dt * (seen ? 20 : 8));
  }

  for (const a of allies) {                         // your teammate: drawn whenever you have a line to them
    if (a.dead) continue;
    const shown = Math.hypot(a.x - p.x, a.y - p.y) < viewR * 1.6 && losClear(p.x, p.y, a.x, a.y);
    a.vis += ((shown ? 1 : 0) - a.vis) * Math.min(1, dt * (shown ? 20 : 8));
  }
  for (const c of civs) {                           // bystanders: drawn whenever you have a line to them, faded by the dark like bots
    if (c.dead) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y), shown = d < viewR * 1.6 && losClear(p.x, p.y, c.x, c.y);
    c.vis += ((shown ? 1 : 0) - c.vis) * Math.min(1, dt * (shown ? 20 : 8));
  }

  // loot fades in when your light touches it
  for (const it of items) {
    const lit = isLit(it.x, it.y, 10);
    it.vis += ((lit ? 1 : 0) - it.vis) * Math.min(1, dt * (lit ? 20 : 8));
  }

  // reload + fire + heal + pick up
  if (state === 'play') {
    if (ammo === 0 && mags.length && reloading === 0 && !p.side.out && !p.side.sw) startReload();
    if (reloading > 0) {
      const f0 = 1 - reloading / AR.reload;
      reloading -= dt;
      sfxReload(p, 'ak', f0, 1 - Math.max(0, reloading) / AR.reload);
      if (!magDropped && reloading < AR.reload * 0.8) {   // old mag hits the floor (and makes a little noise)
        magDropped = true; ejectMag(p.x, p.y, redAng, ammo, p); ammo = 0; makeNoise(p.x, p.y, 120); sfxMagDrop(p.x, p.y);
      }
      if (reloading <= 0) { reloading = 0; ammo = pullMag(mags); }
    }
    fireCd -= dt; muzzle -= dt; gunWaveCd -= dt;
    const mb = mateHere(), fr = civs.length ? allies.concat(civs) : allies;
    p.blocked = friendInLine(p, mb && !mb.down ? fr.concat(mb) : fr, redR, redHalf);   // a friend, your co-op partner or a bystander in the line of fire: no auto-fire
    rescueSecure(dt);
    if (p.melee) stepMelee(p, dt);
    else if ((p.meleeCd = (p.meleeCd || 0) - dt) <= 0 && reloading === 0 && !gearBusy() && !equip && !p.side.out && !p.side.sw && !p.nade) { const o = meleeTarget(p); if (o) startMelee(p, o); }
    sideStep(dt, anyLocked && !p.nade && blindT < 0.8);
    nadeStep(dt);
    if (!p.nade && blindT < 0.8 && !p.side.out && !p.side.sw && anyLocked && !p.melee && !p.blocked && reloading === 0 && !gearBusy() && gunCanFire(p) && ammo > 0 && fireCd <= 0 && Math.abs(p.cov.sh) > 0.8) shoot();   // not mid shoulder-switch, not with gear going on
    updatePickup(dt);
    restockStep();
    benchStep(dt);
    nvgStep(dt);
    tvStep(dt);
  }
  hitFlash = Math.max(0, hitFlash - dt);
  bombStep(dt);
  coopStep(dt);

  updateBullets(dt);
  updateNades(dt);
  updateDebris(dt);
  stepFixtures(dt);
  updateRagdolls(dt);
  updateMists(dt);
  updateSmoke(dt); updateTrails(dt);
  for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].t -= dt; if (flashes[i].t <= 0) flashes.splice(i, 1); }
  for (let i = threats.length - 1; i >= 0; i--) { threats[i].t -= dt; if (threats[i].t <= 0) threats.splice(i, 1); }
  barrelWisps(p, redAng, p.cov.sh, pAnim.rx, dt);
  for (const b of bots) barrelWisps(b, b.ang + b.sway, b.cov ? b.cov.sh : 1, b.anim.rx, dt);
  updatePools(dt);
  if (live) { updateDoors(dt); updateScrapes(); }
  occT -= dt;
  if (occDirty && occT <= 0) { rebuildOcc(); occDirty = false; occT = 0.3; }

  if (state === 'play') {
    const aliveNow = bots.reduce((n, b) => n + (b.dead ? 0 : 1), 0);
    if (MAP.bots.length && aliveNow === 0 && !cleared) { cleared = true; bannerT = 0; slowMo(); }   // the last enemy just took the killing (or downing) hit
    if (coop && coop.go && MAP.id === 'house') { if (bench) closeBench(); travel('mission'); return; }   // co-op: the host's car has left, yours follows
    if (exitOpen()) {                                              // walk out: stand in the exit ring
      bannerT += dt;
      extractT = Math.hypot(p.x - EXIT.x, p.y - EXIT.y) < EXIT.r ? extractT + dt : 0;
      if (EXIT.carDoor) { const want = extractT > 0 ? clamp(extractT / EXIT.hold * 1.8, 0, 1) * VEH.doorOpen : 0; EXIT.carDoor.ang += (want - EXIT.carDoor.ang) * Math.min(1, dt * 8); }   // the door swings open as you get in
      if (EXIT.car && EXIT.veh === 'mine' && extractT > 0.2) EXIT.car.lightsOn = true;
      if (extractT >= EXIT.hold) { if (coopHold()) extractT = EXIT.hold; else { travel(EXIT.to); return; } }   // co-op: in your car, waiting for your partner
    }
  }
}

