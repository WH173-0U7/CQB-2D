/* ================= PLAYER SHOOTING ================= */
function shoot() {
  alarms.push({ x: p.x, y: p.y, t: simT });
  const sup = attOn('supp'), rk = attOn('grip') ? ATTFX.grip.recoil : 1;      // suppressed; a grip holds the recoil down
  sfxShot(p.x, p.y, sup ? 'aks' : 'ak');
  ammo--; shots++; muzzle = 0.06; fireCd = AR.rate; p.shotT = 0.4; p.fightAt = simT;
  const g = p.gun, a = g.ang + (Math.random() + Math.random() - 1) * redHalf;   // scatter fills the red cone, along the real barrel
  bloom = Math.min(BLOOM.max, bloom + BLOOM.add * rk);
  recoilKick(arms, steady * (1 - clamp(turnRate / BRACE_TURN, 0, 1)), p.cov.mount, angDiff(a, g.ang), rk);
  pAnim.rv -= RECOIL.push * (1 - 0.4 * p.cov.mount) * rk; camKick.v -= RECOIL.cam * (1 - 0.4 * p.cov.mount) * rk;
  const ux = Math.cos(a), uy = Math.sin(a);
  bullets.push(makeBullet(g.mx, g.my, ux, uy, AR.speed, AR.dmg, 'p'));            // out of the muzzle
  ejectCasing(p.x, p.y, g.ang, p.cov.sh, p);
  gunSmoke(p, g.ang, p.cov.sh, 0);
  emitGun();
}

function soundMul(i, j) {
  if (i < 0 || j < 0 || i >= W || j >= H) return WALL_MUL;
  const k = j * W + i;
  if (doorAt[k] >= 0) { const d = doors[doorAt[k]]; return d.closed && !d.broken ? DOOR_MUL : 1; }   // closed doors muffle
  const c = solidAt[k];
  if (c === 'G') return 2.5;
  if (c === 'g') return 1;
  return c === '.' ? 1 : opq[k] ? WALL_MUL : FURN_MUL;
}
/* ---------- Sound ----------
   Sound spreads out in every direction but loses strength fast inside walls,
   so the reach is a circle in open space and shrinks where walls get in the way. */
function soundExtent(ox, oy, ang, radius) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let mx = Math.floor(ox / T), my = Math.floor(oy / T);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  let stepX, stepY, sideX, sideY;
  if (dx < 0) { stepX = -1; sideX = (ox / T - mx) * ddx; } else { stepX = 1; sideX = (mx + 1 - ox / T) * ddx; }
  if (dy < 0) { stepY = -1; sideY = (oy / T - my) * ddy; } else { stepY = 1; sideY = (my + 1 - oy / T) * ddy; }
  let tPrev = 0, cost = 0, dist = 0;
  for (let n = 0; n < 200; n++) {
    const tNext = Math.min(sideX, sideY);
    const seg = (tNext - tPrev) * T;
    const mul = soundMul(mx, my);
    if (cost + seg * mul >= radius) return dist + (radius - cost) / mul;
    cost += seg * mul; dist += seg; tPrev = tNext;
    if (sideX < sideY) { sideX += ddx; mx += stepX; } else { sideY += ddy; my += stepY; }
  }
  return dist;
}
function fillExtents(out, x, y, radius) {
  for (let k = 0; k < SOUND_RAYS; k++) out[k] = soundExtent(x, y, k / SOUND_RAYS * Math.PI * 2, radius);
}
function extentAt(ext, ang) {
  let f = ang / (Math.PI * 2) * SOUND_RAYS;
  f = ((f % SOUND_RAYS) + SOUND_RAYS) % SOUND_RAYS;
  const k0 = Math.floor(f), k1 = (k0 + 1) % SOUND_RAYS, t = f - k0;
  return ext[k0] * (1 - t) + ext[k1] * t;
}
/* Any bot that isn't already fighting and sits inside the sound's reach goes to investigate. */
function hearSound(ext, x, y, jitter) {
  const hearers = [];
  for (const b of bots) {
    if (b.dead || b.state === 'attack') continue;
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
    const e = extentAt(ext, Math.atan2(dy, dx));
    if (d > e) continue;
    hearers.push({ b, d, loud: 1 - d / Math.max(e, 1) });   // 1 = right next to it, 0 = barely audible
  }
  hearers.sort((a, c) => a.d - c.d);
  // bots already fighting or searching nearby count toward the limit, so they come in small groups
  let going = 0;
  for (const b of bots) if (!b.dead && (b.state === 'attack' || b.state === 'search') && Math.hypot(b.x - x, b.y - y) < HEAR.zone) going++;
  for (const h of hearers) {
    const b = h.b;
    const already = b.state === 'search';
    if (h.loud >= HEAR.loud && (already || going < HEAR.maxGo)) {   // clear and close: go and check it out
      if (!already) going++;
      let tx = x + (Math.random() * 2 - 1) * jitter, ty = y + (Math.random() * 2 - 1) * jitter;
      if (wall(Math.floor(tx / T), Math.floor(ty / T))) { tx = x; ty = y; }   // never aim at a wall
      investigate(b, tx, ty);
    } else if (b.state === 'patrol') {                     // faint, or others are already going: stop and look that way
      b.wait = Math.max(b.wait, 1.2 + Math.random()); b.path = [];
      b.lookAng = Math.atan2(y - b.y, x - b.x); b.lookT = b.wait;
    }
  }
}
/* A sound made by someone else: it shows up only if it actually reaches you
   (same wall-aware spread as your own sounds). The ring is centred on whoever made it. */
function hearAt(x, y, radius) {
  const d = Math.hypot(p.x - x, p.y - y);
  if (d > radius) return null;                 // too far to possibly hear
  const ext = new Float32Array(SOUND_RAYS);
  fillExtents(ext, x, y, radius);
  return d <= extentAt(ext, Math.atan2(p.y - y, p.x - x)) ? ext : null;   // null if walls swallowed it first
}
function emitHeard(x, y, radius, kind, dur) {
  if (!soundVis()) return false;                // shown only in the visual-sound mode (muted): nothing to work out otherwise
  const ext = hearAt(x, y, radius);
  if (!ext) return false;
  waves.push({ x, y, ext, f: 0, dur, kind });
  return true;
}
/* A noise someone made, shown by who made it: yours (bots hear it), your teammate's (bots hear it, drawn like yours),
   a bystander's (a faint neutral ring, nobody reacts) or an enemy's (a red ring with a pulse, if it reaches you). */
function noiseBy(who, x, y, r, gun) {
  if (who === p) makeNoise(x, y, r);
  else if (who && who.ally) allyNoise({ x, y }, r, 'walk');
  else if (who && who.civ) emitHeard(x, y, r, 'nwalk', 0.6);
  else emitHeard(x, y, r, gun ? 'egun' : 'ewalk', 0.6);
}
function emitGun() {
  if (gunWaveCd > 0) return;
  gunWaveCd = 0.25;
  const sup = attOn('supp'), ext = new Float32Array(SOUND_RAYS);   // suppressed: heard much less far, and hard to place
  fillExtents(ext, p.x, p.y, GUN_NOISE * (sup ? ATTFX.supp.noise : 1));
  waves.push({ x: p.x, y: p.y, ext, f: 0, dur: 0.6, kind: 'gun' });
  hearSound(ext, p.x, p.y, sup ? ATTFX.supp.jitter : 70);
}
/* A noise or a search out in the street (sidewalk, red carpet, asphalt) brings a bot inside only as far as the nearest
   spot indoors, to look out from there first. */
const OUTDOOR = 'saRv';
const isOut = (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); return i >= 0 && j >= 0 && i < W && j < H && OUTDOOR.includes(floorAt[j * W + i]); };
function insideNear(b, x, y) {                            // something outside caught their attention: the nearest spot inside to look from
  if (!isOut(x, y) || isOut(b.x, b.y)) return { x, y };
  const ci = Math.floor(x / T), cj = Math.floor(y / T);
  let best = null, bd = Infinity;
  for (let j = cj - 6; j <= cj + 6; j++) for (let i = ci - 6; i <= ci + 6; i++) {
    if (navBlocked(i, j) || OUTDOOR.includes(floorAt[j * W + i])) continue;
    const d = Math.hypot((i + 0.5) * T - x, (j + 0.5) * T - y);
    if (d < bd) { bd = d; best = { x: (i + 0.5) * T, y: (j + 0.5) * T }; }
  }
  return best || { x, y };
}
function investigate(b, x, y) {
  ({ x, y } = insideNear(b, x, y));
  if (b.state !== 'search') { b.state = 'search'; b.path = []; b.repathT = 0; b.alertT = 0.6; }
  b.lastKnown = { x, y }; b.searchT = 10; b.arrived = false;
}

