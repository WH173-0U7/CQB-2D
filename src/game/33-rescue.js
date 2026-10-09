/* ================= RESCUE =================
   Once the hotel is clear (`cleared`), walk up to a surviving civilian and you secure them on your own: they kneel
   facing away, you take their wrists, and they're zip-tied (`c.bound`). Then they follow you (`follow`), and every one
   you've secured rides out with you when you extract (`carried`). At the safe house they turn up with you, and a US
   Army officer waits out in the yard: bring them to him and he takes them off your hands. They walk out to the street
   with him and are gone, and `handedOver` counts them (for compensation later). Anyone you didn't hand over is still
   with you next time you come home. */
const RESCUE = { r: 38, T: 1.5, follow: 44, speed: 112, handR: 85, officer: [31.2, 1.7], away: [34.2, 1.6], doneT: 3.5, sayT: 3.5 };   // the officer waits out back (through the armory's back door); they leave by the back gate
let rescueBanner = null;
const OFFICER_LOOK = civLook({ kind: 'officer', top: OCP, topDark: '#6b5f48', pants: OCP, boot: COYOTE, shoe: COYOTE, bootDark: COYOTE_DK, hair: '#3a2a1e', style: 'patrol', skin: SKIN[1] });
function houseCivs() {
  const out = carried.map((k, n) => ({ civ: true, key: k.kind, look: k, x: (11 + (n % 4)) * T, y: (17.2 - Math.floor(n / 4) * 0.8) * T, r: CIV.r, ang: Math.PI / 2,
    seed: 40 + n, dead: false, vis: 1, state: 'follow', bound: true, path: [], phase: 0, mv: 0, cower: 0, mvAng: 0, rethinkT: 0,
    prot: { front: 0, back: 0, helmet: 0, chipsF: [], chipsB: [], chipsH: [] }, ammo: 0, mags: [], equip: null, grab: null }));
  if (out.length) out.push({ civ: true, officer: true, key: 'officer', look: OFFICER_LOOK, x: RESCUE.officer[0] * T, y: RESCUE.officer[1] * T, r: CIV.r, ang: Math.PI, seed: 77,
    dead: false, vis: 1, state: 'wait', path: [], phase: 0, mv: 0, cower: 0, mvAng: 0, rethinkT: 0,
    prot: { front: 0, back: 0, helmet: 0, chipsF: [], chipsB: [], chipsH: [] }, ammo: 0, mags: [], equip: null, grab: null });
  return out;
}
const walkTo = (c, x, y, speed, dt) => {                // along a path, repathed now and then; true once there
  if (!c.path.length || (c.repath = (c.repath || 0) - dt) <= 0) { c.path = findPath(c.x, c.y, x, y); c.repath = 0.7; }
  while (c.path.length && Math.hypot(c.path[0].x - c.x, c.path[0].y - c.y) < 8) c.path.shift();
  if (!c.path.length) return Math.hypot(x - c.x, y - c.y) < 14;
  const tx = c.path[0].x - c.x, ty = c.path[0].y - c.y, l = Math.hypot(tx, ty) || 1, v = speed * dt;
  moveChar(c, tx / l * v, ty / l * v);
  c.ang += clamp(angDiff(Math.atan2(ty, tx), c.ang), -8 * dt, 8 * dt);
  return false;
};
/* Securing: you're up, the hotel is clear, a free civilian is in reach and in sight. */
function rescueSecure(dt) {
  if (!MAP.bots.length || !cleared) { if (p.secure) { p.secure.c.state = 'cower'; p.secure = null; } return; }
  if (p.secure) {
    const c = p.secure.c;
    if (c.dead || Math.hypot(c.x - p.x, c.y - p.y) > RESCUE.r * 1.8) { if (!c.dead) c.state = 'cower'; p.secure = null; return; }
    p.secure.t += dt; c.restrainF = p.secure.t / RESCUE.T;
    if (p.secure.t >= RESCUE.T) { c.bound = true; c.state = 'follow'; c.path = []; p.secure = null; }
    return;
  }
  if (p.melee || equip || gearBusy()) return;
  for (const c of civs) {
    if (c.dead || c.bound || c.officer || c.gone) continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < RESCUE.r && losClear(p.x, p.y, c.x, c.y)) { p.secure = { c, t: 0 }; c.state = 'restrain'; c.path = []; c.restrainF = 0; break; }
  }
}
/* What a secured civilian (or the officer) does, frame by frame. */
function rescueStep(c, dt) {
  if (c.state === 'restrain') {                         // kneels, facing away from you
    const away = Math.atan2(c.y - p.y, c.x - p.x);
    c.ang += clamp(angDiff(away, c.ang), -5 * dt, 5 * dt);
  } else if (c.state === 'follow') {                    // stays close behind you
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d > RESCUE.follow + 12) walkTo(c, p.x, p.y, RESCUE.speed * (d > 140 ? 1.3 : 1), dt);
    else { c.path = []; c.ang += clamp(angDiff(Math.atan2(p.y - c.y, p.x - c.x), c.ang), -3 * dt, 3 * dt); }
    const off = civs.find(o => o.officer && o.state === 'wait');
    if (off && Math.hypot(p.x - off.x, p.y - off.y) < RESCUE.handR) startHandover(off);
  } else if (c.state === 'wait') {                      // the officer: waits, watching you
    c.ang += clamp(angDiff(Math.atan2(p.y - c.y, p.x - c.x), c.ang), -2 * dt, 2 * dt);
  } else if (c.state === 'handover') {                  // walk over and stand by the officer
    const off = civs.find(o => o.officer);
    if (off && walkTo(c, c.hx, c.hy, RESCUE.speed, dt)) { c.path = []; c.ang += clamp(angDiff(Math.atan2(off.y - c.y, off.x - c.x), c.ang), -3 * dt, 3 * dt); c.ready = true; }
  } else if (c.state === 'leave') {                     // off down the street with the officer
    if (walkTo(c, RESCUE.away[0] * T, RESCUE.away[1] * T + (c.lane || 0) * 0.3, RESCUE.speed * 0.9, dt) || c.x > 33.7 * T) c.gone = true;   // out through the back gate
  }
  if (c.say && (c.say.t -= dt) <= 0) c.say = null;
  if (c.officer && c.state === 'take') {                 // everyone's here (or long enough): they go
    c.takeT -= dt;
    const group = civs.filter(o => o.handed && !o.gone);
    if (c.takeT <= 0 || group.every(o => o.ready)) {
      handedOver += group.length; prog.medals += group.length * MEDALS.perCiv; saveProg();   // a medal for every one
      rescueBanner = { n: group.length, t: 0 };
      group.forEach((o, i) => { o.state = 'leave'; o.path = []; o.lane = (i - group.length / 2) * 14; });
      c.state = 'leave'; c.path = []; c.lane = 0;
      c.say = { txt: '"Do better."', t: RESCUE.sayT };                 // every time: he's never impressed (shown in the visual-sound mode, see drawTags)
      carried = []; prog.carried = carried; prog.handed = handedOver; saveProg();
    }
  }
}
function startHandover(off) {
  const group = civs.filter(o => o.bound && o.state === 'follow');
  if (!group.length) return;
  off.state = 'take'; off.takeT = RESCUE.doneT;
  group.forEach((o, i) => { o.state = 'handover'; o.handed = true; o.path = []; o.ready = false;
    const a = Math.PI * (0.55 + i * 0.25), r = 34; o.hx = off.x + Math.cos(a) * r; o.hy = off.y + Math.sin(a) * r; });
}
/* HUD: on a cleared mission, how many you've secured; at home, the handover. */
function drawRescueHud() {
  ctx.save(); ctx.textAlign = 'center';
  if (MAP.bots.length && cleared) {
    const alive = civs.filter(c => !c.dead && !c.officer), sec = alive.filter(c => c.bound).length;
    if (alive.length) {
      ctx.font = '600 15px ' + FONT; ctx.fillStyle = sec === alive.length ? 'rgba(140,235,160,0.9)' : 'rgba(225,230,240,0.85)';
      ctx.fillText('CIVILIANS SECURED ' + sec + ' / ' + alive.length, VW / 2, VH - 18);
    }
  } else if (MAP.id === 'house') {
    const waiting = civs.filter(c => c.bound && !c.handed).length;
    if (waiting) { ctx.font = '600 15px ' + FONT; ctx.fillStyle = 'rgba(225,230,240,0.85)'; ctx.fillText('BRING ' + waiting + (waiting > 1 ? ' CIVILIANS' : ' CIVILIAN') + ' TO THE OFFICER OUT BACK (THROUGH THE ARMORY)', VW / 2, VH - 18); }
    if (rescueBanner && (rescueBanner.t += 1 / 60) < 4) {
      const a = Math.min(1, rescueBanner.t * 3, (4 - rescueBanner.t) * 1.5);
      ctx.globalAlpha = a; ctx.font = '700 30px ' + FONT; ctx.fillStyle = '#e6f0ff';
      ctx.fillText('CIVILIANS HANDED OVER', VW / 2, VH * 0.22);
      ctx.font = '600 17px ' + FONT; ctx.fillStyle = 'rgba(190,215,245,0.9)';
      ctx.fillText(rescueBanner.n + ' in Army custody  ·  ' + handedOver + ' rescued in all  ·  +' + rescueBanner.n * MEDALS.perCiv + ' MEDALS', VW / 2, VH * 0.22 + 26);
    }
  }
  ctx.restore();
}

