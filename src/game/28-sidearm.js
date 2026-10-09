/* ================= SIDEARM =================
   The Glock 17 rides in a holster on your strong-side hip. When the rifle runs completely dry (`ammo` and `mags` both
   empty) it comes out (`p.side.sw` 'pistol', PISTOL.draw s): the rifle swings down onto its sling at your side, your
   strong hand goes to the holster and draws, and you bring it up two-handed. Its barrel is the gun now (`gunReach` with
   PISTOL.len/lat), so the cone, the rounds, the casings (smaller, from its own port) and the flash come from its muzzle.
   It fires semi-auto (PISTOL.rate), reloads from a belt pouch (drop the empty, seat a fresh one, slide release). The
   moment the rifle has a magazine again (you scooped one up) it goes back in the holster and the rifle comes up and
   reloads. The holster jiggles on a spring (`p.hol`, `holsterStep`): body acceleration, every footstep, recoil, and
   busy hands (reloads, gear, the knife, securing someone) all shake it. */
function sideStep(dt, anyLocked) {
  const S = p.side; S.cd -= dt;
  const dry = ammo === 0 && !mags.length && reloading === 0, back = ammo > 0 || mags.length > 0;
  if (dry && p.side.want !== 'pistol') p.side.want = null;
  if (sideTick(p, dt, dry || (p.side.want === 'pistol' && reloading === 0), back && p.side.want !== 'pistol', !equip && !gearBusy() && !p.melee)) return;
  if (anyLocked && !p.blocked && !gearBusy() && !equip && S.ammo > 0 && S.cd <= 0 && gunCanFire(p)) pistolShoot();
}
/* Shared by you and the bots: draw or holster the Glock as the rifle runs dry or gets a magazine again, and reload it
   (the empty drops out, a fresh one goes in). True while the Glock isn't ready to fire. */
function sideTick(c, dt, rifleDry, rifleBack, free) {
  const S = c.side;
  if (!S.sw) {
    if (!S.out && rifleDry && free) S.sw = { to: 'pistol', t: 0 };
    else if (S.out && rifleBack && S.reload === 0) S.sw = { to: 'rifle', t: 0 };
  }
  if (S.sw) {
    S.sw.t += dt / (c === p && slingOn() ? SLING.swap : 1);                     // a sling lets the rifle drop and come back quicker
    if (S.sw.t >= PISTOL.draw * 0.5) S.out = S.sw.to === 'pistol';               // out of (or back into) the holster halfway through
    if (S.sw.t >= PISTOL.draw) S.sw = null;
    return true;
  }
  if (!S.out) return true;
  if (S.reload > 0) {
    const f0 = 1 - S.reload / PISTOL.reload;
    S.reload -= dt;
    sfxReload(c, 'glock', f0, 1 - Math.max(0, S.reload) / PISTOL.reload);
    if (!S.dropped && S.reload < PISTOL.reload * 0.8) {                          // the empty mag drops out
      S.dropped = true; S.ammo = 0; sfxMagDrop(c.x, c.y, true);
      const ga = c.gun ? c.gun.ang : c === p ? p.aim : c.ang;
      dropMag(c.x, c.y, ga, 0.6, 'pmag');                                                // falls out of the grip and clatters on the floor, like the rifle's
      if (c === p) makeNoise(p.x, p.y, 90); else if (c.ally) allyNoise(c, 90, 'walk'); else emitHeard(c.x, c.y, 90, 'ewalk', 0.3);
    }
    if (S.reload <= 0) { S.reload = 0; S.ammo = PISTOL.mag; }                // a fresh mag: there's always another
    return true;
  }
  if (S.ammo === 0) { S.reload = PISTOL.reload; S.dropped = false; c.hol.v += HOL.busy; return true; }
  return false;
}
function startPistolReload() { const S = p.side; if (S.reload > 0 || S.sw) return; S.reload = PISTOL.reload; S.dropped = false; p.hol.v += HOL.busy; }
function pistolShoot() {
  const S = p.side;
  alarms.push({ x: p.x, y: p.y, t: simT });
  S.ammo--; S.cd = PISTOL.rate; shots++; muzzle = 0.05; p.shotT = 0.4; p.fightAt = simT;
  sfxShot(p.x, p.y, 'glock');
  const g = p.gun, a = g.ang + (Math.random() + Math.random() - 1) * Math.max(PISTOL.spread, redHalf * 0.8);
  bloom = Math.min(BLOOM.max, bloom + BLOOM.add * 0.8);
  recoilKick(arms, steady * (1 - clamp(turnRate / BRACE_TURN, 0, 1)), p.cov.mount, angDiff(a, g.ang));
  pAnim.rv -= RECOIL.push * 0.55; camKick.v -= RECOIL.cam * 0.5; p.hol.v += (Math.random() - 0.5) * 2;
  bullets.push(makeBullet(g.mx, g.my, Math.cos(a), Math.sin(a), PISTOL.speed, PISTOL.dmg, 'p', 'pistol'));
  ejectCasing(p.x, p.y, g.ang, p.cov.sh, p, [36, PISTOL.lat * (p.cov.sh < 0 ? -1 : 1) + 2, 0.7]);
  gunSmoke(p, g.ang, p.cov.sh, 0);
  emitGun();
}
