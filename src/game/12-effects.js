/* ================= EFFECTS ================= */
/* Impact effects by material, all sharing the sparks list (drawn over the darkness):
   streak sparks (metal, concrete, helmets) with a brief flash of real light, a dust plume (smoke puffs) for walls,
   furniture and plates, glass glints that twinkle as they fall, and a quick shock ring where a round strikes armour. */
const IMPACT = { sparkN: 10, sparkV: 360, flashR: 80, flashK: 0.55, dust: 1.5 };
function impactFx(kind, x, y, nx, ny) {
  sfxHit(kind, x, y);
  const fan = (n, v, spread, make) => { const base = Math.atan2(ny, nx); for (let i = 0; i < n; i++) { const a = base + (Math.random() - 0.5) * spread, s = v * (0.35 + Math.random() * 0.65); sparks.push(make(Math.cos(a) * s, Math.sin(a) * s)); } };
  const dust = (n, a, col) => { for (let i = 0; i < n; i++) { const sp = 30 + Math.random() * 70, a2 = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.4; puff(x + nx * 2, y + ny * 2, Math.cos(a2) * sp, Math.sin(a2) * sp, 2.5 + Math.random() * 1.5, 10 + Math.random() * 8, 0.9 + Math.random() * 0.9, a * IMPACT.dust, 0, 6); } };
  if (kind === 'spark' || kind === 'helmet') {
    fan(kind === 'helmet' ? 6 : IMPACT.sparkN, IMPACT.sparkV, 2.2, (vx, vy) => ({ x, y, vx, vy, life: 0.15 + Math.random() * 0.25, max: 0.35, col: Math.random() < 0.5 ? '#fff4c8' : '#ffb658', streak: true }));
    flashes.push({ x: x + nx * 3, y: y + ny * 3, t: 0.05, t0: 0.05, r: IMPACT.flashR, k: IMPACT.flashK, col: [255, 214, 150] });
    if (kind === 'helmet') sparks.push({ x, y, vx: 0, vy: 0, life: 0.12, max: 0.12, ring: 9, col: 'rgba(255,250,235,0.9)' });
  } else if (kind === 'plate') {                                   // ceramic: a puff of white powder, no sparks
    dust(2, 0.22, null);
    fan(5, 120, 2.4, (vx, vy) => ({ x, y, vx, vy, life: 0.25 + Math.random() * 0.25, max: 0.5, col: 'rgba(235,230,215,0.8)' }));
    sparks.push({ x, y, vx: 0, vy: 0, life: 0.14, max: 0.14, ring: 15, col: 'rgba(240,236,224,0.9)' });
  } else if (kind === 'glass') {                                   // glints tumbling with the shards
    fan(8, 150, 2.6, (vx, vy) => ({ x, y, vx, vy, life: 0.4 + Math.random() * 0.5, max: 0.9, glint: Math.random() * 6, col: '#eaf6ff' }));
    dust(1, 0.08);
  } else if (kind === 'drywall') dust(3, 0.2);                     // a white plume of plaster
  else if (kind === 'concrete') { dust(2, 0.14); fan(3, 200, 1.8, (vx, vy) => ({ x, y, vx, vy, life: 0.1 + Math.random() * 0.12, max: 0.22, col: '#ffd890', streak: true })); }
  else if (kind === 'wood' || kind === 'soft') dust(kind === 'soft' ? 2 : 1, kind === 'soft' ? 0.16 : 0.12);
}
function burst(x, y, n, col, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + Math.random() * 0.25, max: 0.5, col });
  }
}
function pop(x, y, txt, col, life) {
  pops.push({ x, y, txt, col: col || '#ffe27a', life: life || 0.7, max: life || 0.7 });
}
/* The dead drop what they carried: the rifle's magazine, the vest's spares, any plate still whole and the helmet if it stayed on. */
function dropLoot(b) {
  if (b.ammo > 0) addItem({ kind: 'mag', rounds: b.ammo }, b.x, b.y, 22);
  for (const rounds of b.mags) addItem({ kind: 'mag', rounds }, b.x, b.y, 22);
  const pr = b.prot;
  if (pr.front > 0) addItem({ kind: 'plate', hp: pr.front, chips: pr.chipsF, ir: true }, b.x, b.y, 22);
  if (pr.back > 0) addItem({ kind: 'plate', hp: pr.back, chips: pr.chipsB, ir: true }, b.x, b.y, 22);
  if (pr.helmet > 0) addItem({ kind: 'helmet', hp: pr.helmet, chips: pr.chipsH, ir: true }, b.x, b.y, 22);
  if (b.equip && !b.equip.on) addItem(looseCopy(b.equip.it), b.x, b.y, 22);   // the piece it was putting on falls too
  b.grab = b.equip = null;
  b.ammo = 0; b.mags = [];
}
/* Only take what's an upgrade: a mag while the vest has room (or one fuller than your emptiest spare),
   a plate stronger than your front one, a helmet stronger than the one you're wearing. Nobody swaps their own back plate
   in the field (you can't reach round and slide one into the bag behind you): only the front plate and the helmet. */
function canTake(it) {                                   // only what your loadout has room for
  if (it.kind === 'mag') return mags.length < vestCap() || (mags.length > 0 && it.rounds > Math.min(...mags));
  if (it.kind === 'helmet') return lo().helmet && it.hp > p.prot.helmet;
  return lo().plates > 0 && it.hp > p.prot.front;
}
function pickGain(it) {                                 // how much better off you'd be, as a fraction of a full one
  const pr = p.prot;
  if (it.kind === 'mag') return (it.rounds - (mags.length < vestCap() ? 0 : Math.min(...mags))) / AR.mag;
  if (it.kind === 'helmet') return (it.hp - pr.helmet) / HELMET_HP;
  return (it.hp - pr.front) / PLATE_HP;
}
function stowMag(rounds) {                              // a mag into the vest; full, the emptiest one is left on the floor
  if (mags.length < vestCap()) mags.push(rounds);
  else { const i = mags.indexOf(Math.min(...mags)); addItem({ kind: 'mag', rounds: mags[i] }, p.x, p.y, 14); mags[i] = rounds; }
  pop(p.x, p.y, 'MAG ' + rounds, LOOT_COL.mag, 1.0);
}
/* Walk over loot and you scoop it up on the move: once the grab starts it's yours (no need to stay on the spot), and the
   hand carries it while you stow it or put it on. One job for the hands at a time: no grabbing mid-reload. Something you
   cancelled out of is left alone until you've stepped away from it (`it.skip`). */
function fighting(c) {                                 // in a fight right now, or was within PICKUP.calm s
  if ((c.supp || 0) > PICKUP.supp || (c === p && (p.tun || 0) > PICKUP.tun)) c.fightAt = simT;
  if (c === p ? bots.some(b => !b.dead && b.seen) : c.ally ? c.mode === 'fight' : c.seesP) c.fightAt = simT;
  return simT - (c.fightAt === undefined ? -99 : c.fightAt) < PICKUP.calm;
}
function updatePickup(dt) {
  for (const it of items) if (it.skip && Math.hypot(it.x - p.x, it.y - p.y) > PICKUP_R * 1.6) it.skip = false;
  const fight = fighting(p), dryP = ammo <= 0 && !mags.length;
  if (fight && !dryP && (pickItem || equip)) {            // a fight broke out mid-grab: hands back on the gun (gear already in place stays)
    cancelPickup();
    for (const it of items) it.skip = false;              // picked up again once it's quiet
  }
  if (equip) { stepEquip(dt); return; }
  if (pickItem && pickT > 0) {                            // committed: finish the grab even if you've walked on
    if (!items.includes(pickItem)) { pickItem = null; pickT = 0; return; }
    pickT += dt;
    if (pickT >= PICK_TIME[pickItem.kind]) {               // in hand: off the floor
      const it = pickItem;
      items.splice(items.indexOf(it), 1);
      equip = newEquip(p, it); pickItem = null; pickT = 0;
    }
    return;
  }
  pickItem = null;
  if (reloading > 0) return;
  let best = null, bg = 0, bd = PICKUP_R;                // in reach, take the biggest upgrade first (nearest on a tie)
  for (const it of items) {
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d >= PICKUP_R || it.skip || !canTake(it) || (fight && (!dryP || it.kind !== 'mag'))) continue;
    const g = pickGain(it);
    if (g > bg + 1e-6 || (g > bg - 1e-6 && d < bd)) { bg = g; bd = d; best = it; }
  }
  if (best) { pickItem = best; pickT = dt; sfxGrab(p, best.kind); }
}
/* Let go of whatever's being picked up or put on. Gear already in place stays; anything still in hand drops at your feet. */
function cancelPickup() {
  if (pickItem) { pickItem = null; pickT = 0; }
  for (const it of items) if (Math.hypot(it.x - p.x, it.y - p.y) < PICKUP_R * 1.6) it.skip = true;   // hands stay on the rifle until you move on
  const q = equip;
  if (!q) return;
  equip = null;
  if (q.on) { pop(p.x, p.y, q.kind === 'helmet' ? 'HELMET' : q.side === 'front' ? 'FRONT PLATE' : 'BACK PLATE', LOOT_COL[q.kind], 1.0); return; }   // only the strap / flap left undone
  addItem(looseCopy(q.it), p.x, p.y, 10); items[items.length - 1].skip = true;
}
/* Gear going on anyone (you or a bot): old piece off and dropped at `off`, new one in at `on`. True when finished. */
function gearStep(c, q, dt) {
  const E = EQUIP[q.kind], pr = c.prot, ir = c !== p ? true : undefined;
  sfxGear(c, q.kind, q.t / E.T, (q.t + dt) / E.T, q.hadOld);
  q.t += dt; const f = q.t / E.T;
  if (q.kind === 'helmet') {
    if (!q.off && f >= E.off) { q.off = true; if (pr.helmet > 0 && !q.rack) addItem({ kind: 'helmet', hp: pr.helmet, chips: pr.chipsH, ir }, c.x, c.y, 14); pr.helmet = 0; pr.chipsH = []; }
    if (!q.on && f >= E.on) { q.on = true; pr.helmet = q.it.hp; pr.chipsH = q.it.chips.slice(); }
  } else if (q.kind === 'plate') {
    const ck = q.side === 'front' ? 'chipsF' : 'chipsB';
    if (!q.off && f >= E.off) { q.off = true; if (pr[q.side] > 0 && !q.rack) addItem({ kind: 'plate', hp: pr[q.side], chips: pr[ck], ir }, c.x, c.y, 14); pr[q.side] = 0; pr[ck] = []; }
    if (!q.on && f >= E.on) { q.on = true; pr[q.side] = q.it.hp; pr[ck] = q.it.chips.slice(); }
  }
  return f >= 1;
}
function newEquip(c, it, rack) {                         // a plate goes in the front; only the armory restock at home (rack) refits the back one
  const pr = c.prot, side = it.kind === 'plate' ? (rack && c === p && lo().plates === 2 && pr.back < pr.front ? 'back' : 'front') : null;
  return { kind: it.kind, it, t: 0, side, off: false, on: false, hadOld: it.kind === 'helmet' ? pr.helmet > 0 : side ? pr[side] > 0 : false };
}
/* Armory restock (MAP.restock): standing at the gear rack puts fresh kit on you one piece at a time, with the normal
   animations: helmet, then plates (weaker side first), then vest mags, then a reload. What comes off goes on the rack. */
const RESTOCK = { r: 40 };
function restockStep() {
  const R = MAP.restock;
  if (!R || equip || reloading > 0 || (pickItem && pickT > 0) || Math.hypot(p.x - R.x * T, p.y - R.y * T) > RESTOCK.r) return;
  const pr = p.prot;
  const put = it => { equip = newEquip(p, it, true); equip.rack = true; };
  if (lo().helmet && pr.helmet < HELMET_HP) put({ kind: 'helmet', hp: HELMET_HP, chips: [] });
  else if (lo().plates && (lo().plates === 1 ? pr.front : Math.min(pr.front, pr.back)) < PLATE_HP) put({ kind: 'plate', hp: PLATE_HP, chips: [] });
  else if (mags.length < vestCap() || (mags.length && Math.min(...mags) < AR.mag)) put({ kind: 'mag', rounds: AR.mag });
  else if (ammo < AR.mag) startReload();
  else if (p.side.ammo < PISTOL.mag) { p.side.ammo = PISTOL.mag; pop(p.x, p.y, 'GLOCK MAG', LOOT_COL.mag, 0.8); }
  else for (const id of ['m84', 'mk3']) if ((p.nades[id] || 0) < nadeMax(id)) {                     // grenades: back in their pouch
    p.nades[id] = nadeMax(id); benchSnd('g_velcro', 0.4); pop(p.x, p.y, id === 'm84' ? 'M84' : 'Mk3A2', LOOT_COL.mag, 0.8); break;
  }
}
const kitFull = () => (!lo().helmet || p.prot.helmet >= HELMET_HP) && (!lo().plates || (lo().plates === 1 ? p.prot.front : Math.min(p.prot.front, p.prot.back)) >= PLATE_HP) && mags.length >= vestCap() && (!mags.length || Math.min(...mags) >= AR.mag) && ammo >= AR.mag && p.side.ammo >= PISTOL.mag && (p.nades.m84 || 0) >= nadeMax('m84') && (p.nades.mk3 || 0) >= nadeMax('mk3');
function stepEquip(dt) {
  const q = equip;
  if (!gearStep(p, q, dt)) return;
  if (q.kind === 'mag' && q.rack) {                                  // from the armory: into the vest, the emptiest one back on the rack
    if (mags.length < vestCap()) mags.push(q.it.rounds); else mags[mags.indexOf(Math.min(...mags))] = q.it.rounds;
    pop(p.x, p.y, 'MAG 30', LOOT_COL.mag, 0.8);
  } else if (q.kind === 'mag') stowMag(q.it.rounds);
  else { pop(p.x, p.y, q.kind === 'helmet' ? 'HELMET' : q.side === 'front' ? 'FRONT PLATE' : 'BACK PLATE', LOOT_COL[q.kind], 1.0); }
  equip = null;
}
/* A bot taking a plate or helmet: stoop and grab it (given up if it's gone or you show up), then put it on, rifle down,
   standing where it is. True while busy with it. */
function botGear(b, dt, sees) {
  const g = b.grab;
  if (g) {
    if (!items.includes(g.it) || sees || fighting(b)) { b.grab = null; return false; }
    if ((g.t += dt) < PICK_TIME[g.it.kind]) return true;
    items.splice(items.indexOf(g.it), 1); b.grab = null; b.equip = newEquip(b, g.it); sfxGrab(b, g.it.kind);
  }
  if (b.equip && gearStep(b, b.equip, dt)) b.equip = null;
  return !!b.equip;
}
const withGear = (extra, grabIt, g, eq) => { gearPose(extra, grabIt, g, eq); return extra; };
/* Pose bits for a grab in progress and gear going on (shared by you and the bots). */
function gearPose(extra, grabIt, g, eq) {
  const lookOf = it => it.ir ? BOT_LOOK : PLAYER_LOOK;
  if (grabIt) {
    extra.crouch = Math.min(1, g * 3) * (g < 0.75 ? 1 : 1 - (g - 0.75) * 2);   // stoop, then straighten with it
    extra.reachW = [grabIt.x, grabIt.y]; extra.grab = { f: g, kind: grabIt.kind, L: lookOf(grabIt) };
  }
  if (eq) extra.equip = { kind: eq.kind, f: clamp(eq.t / EQUIP[eq.kind].T, 0, 1), side: eq.side, hadOld: eq.hadOld, L: lookOf(eq.it) };
}
/* Is a point (with radius r) inside your flashlight or awareness bubble, with a clear line? */
/* ---------- who can see what: light decides ----------
   Everyone's weapon light is on. You can be seen if you're in the viewer's beam, very close, lit by some other light
   (lamps, signs, muzzle flashes, someone else's beam), or if you're shining your light at the viewer. */
const SEE = { fov: 1.3, glare: 1.25, minK: 0.25, reach: 0.85, noticeCd: 4, dark: 180, darkView: 215, darkK: 0.36, darkFlat: 0.7 };   // eyes' half-angle; how far off-axis a beam still dazzles; dimmest light that reveals; share of a light's radius that counts; seconds between "what was that light?"
/* Weapon lights are an attachment (`att.light`); nobody has one yet. Without one, your cone is just your eyes: in the dark
   you make out a person only within SEE.dark px (darkView/darkK = how far and how well the view shows), and anyone
   lit by a lamp, sign or muzzle flash from full sight range. */
const hasLight = c => !!(c && c.att && c.att.light) || (c === p && !!p.side && p.side.out && attOn('light'));   // the Glock's light, while it's in your hand
let frameLights = [], beamSpots = [], laserDot = null;   // laserDot: where your laser lands (set in render)   // points along the middle of your beam (lit floor a bot might notice)
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const losClear = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0) || 1; return lightCast(x0, y0, (x1 - x0) / d, (y1 - y0) / d, d) >= d - 2; };
const botBeam = b => ({ x: b.x, y: b.y, a: b.ang + b.sway, r: BOT.sight * (1 + STEADY_RANGE * b.steady) });
function inBeam(src, x, y, slack) {                     // inside a weapon light's cone and range, with nothing in the way
  const dx = x - src.x, dy = y - src.y, d = Math.hypot(dx, dy);
  return d < src.r && Math.abs(angDiff(Math.atan2(dy, dx), src.a)) < CONE_HALF * (slack || 1) && losClear(src.x, src.y, x, y);
}
function litByScene(x, y, who) {                        // lit by anything except `who`'s own light
  if (outLit(x, y)) return true;                        // broad daylight
  for (const L of frameLights) if (L.k >= SEE.minK && Math.hypot(x - L.x, y - L.y) < L.r * SEE.reach && inPoly(x, y, L.poly)) return true;
  if (who !== p && state === 'play' && hasLight(p) && inBeam({ x: p.x, y: p.y, a: redAng, r: viewR }, x, y)) return true;
  for (const b of bots) if (!b.dead && !b.dark && b !== who && hasLight(b) && inBeam(botBeam(b), x, y)) return true;
  return false;
}
function isLit(x, y, r) {
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const inBubble = d < AWARE_R + r;
  const inCone = (d < pDarkR(angDiff(Math.atan2(dy, dx), p.aim)) && Math.abs(angDiff(Math.atan2(dy, dx), p.aim)) < SEE.fov + Math.atan2(r, d))      // in front of your eyes, close enough to make out
    || (hasLight(p) && d < viewR && Math.abs(angDiff(Math.atan2(dy, dx), redAng)) < CONE_HALF + Math.atan2(r, d));   // or in your weapon light
  return (inBubble || inCone || litByScene(x, y, p)) && lightCast(p.x, p.y, ux, uy, d) >= d - 2;
}

