/* ================= STATE ================= */
/* Bodies have weight: they speed up and slow down instead of snapping, and they're fastest moving forward,
   slower strafing, slowest backing up. Same rules for bots. */
const MOVE = { accel: 520, decel: 750, fwd: 1.0, side: 0.72, back: 0.5 };
function dirSpeed(moveAng, faceAng) {
  const c = Math.cos(angDiff(moveAng, faceAng));
  return c >= 0 ? MOVE.side + (MOVE.fwd - MOVE.side) * c : MOVE.side + (MOVE.back - MOVE.side) * -c;
}
function accelToward(c, tvx, tvy, dt) {
  const dx = tvx - c.vx, dy = tvy - c.vy, d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const a = (tvx * tvx + tvy * tvy > c.vx * c.vx + c.vy * c.vy ? MOVE.accel : MOVE.decel) * dt * loadMul(c) * loadMul(c);   // heavy kit is slow to get going and to stop
  if (d <= a) { c.vx = tvx; c.vy = tvy; } else { c.vx += dx / d * a; c.vy += dy / d * a; }
}
/* After moving: if a wall, furniture or another body stopped us short, that momentum is gone. */
function keepActualSpeed(c, ox, oy, dt) {
  if (dt <= 0) return;
  const ax = (c.x - ox) / dt, ay = (c.y - oy) / dt;
  if (ax * ax + ay * ay < c.vx * c.vx + c.vy * c.vy) { c.vx = ax; c.vy = ay; }
}
const p = { x: SPAWN.x, y: SPAWN.y, r: 12, nades: { m84: prog.gear.m84 ? 2 : 0, mk3: prog.gear.mk3 ? 2 : 0 }, aim: -Math.PI / 2, speed: 140, vx: 0, vy: 0,
  cov: { side: 0, mount: 0, hand: null, sh: 1, shT: 1, swT: 0, lean: 0 }, prot: newProt(), att: { light: false } };
/* Out of ammo (rifle and vest empty): run for the best magazine on the floor (`avoid` px around you counts against it),
   otherwise hide out of your sight within `hideR` tiles. Re-think every `replan` s; rearmed, go back to where they last saw you. */
const DRY = { speed: 135, replan: 1.5, avoid: 300, hideR: 8, tries: 40 };
const newBot = (tx, ty, n) => ({
  x: (tx + 0.5) * T, y: (ty + 0.5) * T, r: 13, ang: Math.random() * 6.28, seed: n * 1.7,
  vis: 0, locked: false, dead: false,
  state: 'patrol', path: [], wait: Math.random() * 2, lastKnown: null, searchT: 0, arrived: false, scan: 0,
  repathT: 0, reactT: 0, fireCd: 0, burst: 0, muzzle: 0, alertT: 0, strafeDir: 1, strafeT: 1, walkAng: 0,
  moveAmt: 0, steady: 0, bloom: 0, half: STILL_HALF, sway: 0, arms: { th: 0, w: 0, kickDir: 1, foot: 1 }, prevAng: null, holding: false, anim: { phase: 0, rx: 0, rv: 0 },
  stepT: Math.random() * 0.5, gunCd: 0, prot: newProt(), ammo: BOT.mag, mags: fullVest(), reloadT: 0, magDropped: false, side: freshSide(), hol: { a: 0, v: 0, pvx: 0, pvy: 0 }, mvAng: 0, foot: 1, lookAng: 0, lookT: 0, strideAcc: 0, stepCount: 0, sx: (tx + 0.5) * T, sy: (ty + 0.5) * T,
  px: (tx + 0.5) * T, py: (ty + 0.5) * T, att: { light: false }
});
/* Personalities: every enemy rolls one (`b.pers`, `b.persona`), which bends the shared rules instead of replacing them.
   aim: aim wander and scatter; react: delay before the first shot; nerve: how easily suppression makes them flinch and duck;
   hide/peek: time in cover and out of it; run: exposed tiles they'll accept on a route (ROUTE.maxRun +); burst: rounds per
   burst (BOT.burst +); speed: moving pace; post: chance (in a home) to hold their room instead of patrolling;
   flank: first pick for flanking; ambush: would rather lie in wait than trade shots. */
const PERSONA = {
  veteran:  { w: 2, aim: 0.75, react: 0.85, nerve: 0.6, hide: 1,   peek: 1.1, run: 0,  burst: 0,  speed: 1,    post: 0.35, kit: { grip: 0.9, dot: 0.85, laser: 0.5, supp: 0.6 } },
  rusher:   { w: 2, aim: 1.2,  react: 0.7,  nerve: 0.7, hide: 0.5, peek: 1.5, run: 3,  burst: 2,  speed: 1.12, post: 0.1, flank: true, kit: { grip: 0.6, laser: 0.4, dot: 0.15 } },
  cautious: { w: 2, aim: 1,    react: 1.15, nerve: 1.2, hide: 1.6, peek: 0.7, run: -1, burst: 0,  speed: 0.92, post: 0.6, ambush: true, kit: { supp: 0.5, dot: 0.3, grip: 0.2 } },
  green:    { w: 2, aim: 1.45, react: 1.4,  nerve: 1.7, hide: 1.3, peek: 0.8, run: 0,  burst: 1,  speed: 1,    post: 0.3, kit: { grip: 0.15, laser: 0.15 } },
  marksman: { w: 1, aim: 0.55, react: 1,    nerve: 0.9, hide: 1,   peek: 1.3, run: 0,  burst: -2, speed: 0.96, post: 0.5, kit: { dot: 0.85, supp: 0.4, grip: 0.3 } }
};
const NO_PERS = { aim: 1, react: 1, nerve: 1, hide: 1, peek: 1, run: 0, burst: 0, speed: 1, post: 0 };
const PZ = b => b.pers || NO_PERS;
/* An enemy's rifle kit, by personality (PERSONA[].kit: chance of each; never the IR laser): a veteran's is kitted out,
   a green conscript's mostly stock. Drawn on his AKM and it works like yours: the grip steadies his aim, the red dot
   reaches further, the can kills his flash and quietens his shots, and a visible laser shows where he's aiming. */
function rollKit(k) { const A = {}; for (const id in k || {}) if (Math.random() < k[id]) A[id] = true; return A; }
const cSupp = c => c === p ? attOn('supp') && !p.side.out : !!(c && c.att && c.att.ak && c.att.ak.supp && !(c.side && c.side.out));
const bKit = (b, id) => !!(b.att && b.att.ak && b.att.ak[id]);
function rollPersona() {
  const ks = Object.keys(PERSONA); let u = Math.random() * ks.reduce((a, k) => a + PERSONA[k].w, 0);
  for (const k of ks) if ((u -= PERSONA[k].w) < 0) return k;
  return ks[0];
}
const makeBots = () => MAP.bots.map(([tx, ty], n) => {
  const b = newBot(tx, ty, n); b.persona = rollPersona(); b.pers = PERSONA[b.persona]; b.att.ak = rollKit(b.pers.kit);
  if (MAP.gen && Math.random() < b.pers.post) b.post = { x: b.x, y: b.y, t: 0, a: b.ang };   // holds this room, watching the ways in
  return b;
});
/* Where a posted guard looks next: one of the doors in sight within 9 tiles, now and then anywhere. */
function postLook(b) {
  const P = b.post, ds = [];
  for (const d of MAP.doors) { const x = ((d[0] + d[2]) / 2 + 0.5) * T, y = ((d[1] + d[3]) / 2 + 0.5) * T; if (Math.hypot(x - P.x, y - P.y) < 9 * T && losClear(P.x, P.y, x, y)) ds.push(Math.atan2(y - P.y, x - P.x)); }
  return ds.length && Math.random() < 0.8 ? ds[Math.floor(Math.random() * ds.length)] : Math.random() * 6.28;
}
const LOOT_COL = { mag: '#ffc94d', helmet: '#d8c8a0', plate: '#b8c4d0' };
/* Weight: plates are heavy (2 each), a helmet lighter (1); only what's actually worn counts (a shattered plate or a
   knocked-off helmet isn't carried). Full kit moves at the base speeds; less armour is quicker, none quickest. */
/* What everyone carries, in kg (real weights): plates and helmet while worn, every magazine by its rounds, the rifle's
   and Glock's attachments, and your night vision and grenades. Speed, acceleration and stopping scale with it (per kg),
   so the standard kit (both plates, helmet, four full mags, stock guns) moves at the base speeds; more is slower,
   going light is quicker. */
const LOAD = { plate: 2.5, helmet: 1.5, mag: 0.33, round: 0.0167, per: 0.02, nvg: 0.55, m84: 0.24, mk3: 0.44,
  att: { ak: { grip: 0.07, laser: 0.2, ir: 0.2, dot: 0.15, supp: 0.6, sling: 0.2 }, glock: { laser: 0.04, light: 0.11, dot: 0.03 } } };
LOAD.ref = 2 * LOAD.plate + LOAD.helmet + 4 * (LOAD.mag + 30 * LOAD.round);
const magKg = r => LOAD.mag + r * LOAD.round;
function loadOf(c) {
  const pr = c.prot, isP = c === p;
  let kg = pr ? (pr.front > 0 ? LOAD.plate : 0) + (pr.back > 0 ? LOAD.plate : 0) + (pr.helmet > 0 ? LOAD.helmet : 0) : 0;
  const rifle = isP ? ammo : c.ammo, vest = isP ? mags : c.mags;
  if (rifle !== undefined) kg += magKg(rifle);
  if (vest) for (const r of vest) kg += magKg(r);
  const A = isP ? { ak: fitSet('ak'), glock: fitSet('glock') } : c.att && c.att.ak ? { ak: c.att.ak } : null;
  if (A) for (const w in A) for (const id in A[w]) kg += (LOAD.att[w] && LOAD.att[w][id]) || 0;
  if (isP) { if (prog.wear.nvg) kg += LOAD.nvg; if (p.nades) kg += (p.nades.m84 || 0) * LOAD.m84 + (p.nades.mk3 || 0) * LOAD.mk3; }
  return kg;
}
const loadMul = c => (1 - loadOf(c) * LOAD.per) / (1 - LOAD.ref * LOAD.per);
/* Your loadout, picked at the gear locker (prog.loadout): how many spare mags, which plates (2 both, 1 front only, 0
   none) and whether you wear a helmet. The restock, the locker and pickups all keep to it. */
const LOADOUT0 = { mags: 3, plates: 2, helmet: true };
const lo = () => prog.loadout || LOADOUT0;
const vestCap = () => clamp(lo().mags, 0, MAG_VEST);
function applyLoadout(fresh) {                           // strip what the loadout leaves behind (fresh: a whole new kit to it)
  const L = lo(), pr = p.prot;
  pr.bareF = L.plates < 1; pr.bareB = L.plates < 2;      // an empty bag, not a shot-up one
  if (pr.bareF) pr.front = 0;
  if (pr.bareB) pr.back = 0;
  if (!L.helmet) pr.helmet = 0;
  if (fresh) mags = fullVest(vestCap());
  else while (mags.length > vestCap()) mags.splice(mags.indexOf(Math.min(...mags)), 1);
}
function setLoadout(k, v) {                              // at the locker: each piece played out, taken from the locker and put on, or taken off and put back in it
  prog.loadout = Object.assign({}, lo(), { [k]: v }); saveProg();
  const pr = p.prot, q = [], an = (id, off, side) => q.push({ id, off, side, t: 0, T: LOCKER.T * (id === 'mag' ? 0.75 : 1) });
  if (k === 'plates') for (const [side, want] of [['front', v >= 1], ['back', v >= 2]]) { const has = pr[side] > 0; if (want && !has) an('plate', false, side); else if (!want && (has || !pr[side === 'front' ? 'bareF' : 'bareB'])) an('plate', true, side); }
  if (k === 'helmet') { if (v && pr.helmet <= 0) an('helmet', false); else if (!v && pr.helmet > 0) an('helmet', true); }
  if (k === 'mags') { const n = vestCap() - mags.length; for (let i = 0; i < Math.abs(n); i++) an('mag', n < 0); }
  if (bench && bench.kind === 'locker') { bench.la = q.shift() || null; bench.lq = q; }
  else { for (const A of q) kitChange(A); }
}
function fullVest(n = MAG_VEST) { return Array(n).fill(AR.mag); }
function freshLoot(kind) {                       // a full item of this kind: mag rounds, plate/helmet hp
  return kind === 'mag' ? { kind, rounds: AR.mag } : { kind, hp: kind === 'plate' ? PLATE_HP : HELMET_HP, chips: [] };
}
const looseCopy = it => { const { x, y, vis, rot, ...rest } = it; return rest; };   // an item to drop again somewhere else
function addItem(it, x, y, scatter) {            // drop loot on the floor, spread a little so pieces don't stack
  const a = Math.random() * 6.28, r = scatter ? scatter * (0.4 + Math.random() * 0.6) : 0;
  items.push(Object.assign({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vis: 1, bob: Math.random() * 6 }, it));
}
function pullMag(v) {                            // the fullest magazine comes out of the vest
  if (!v.length) return 0;
  let i = 0; for (let j = 1; j < v.length; j++) if (v[j] > v[i]) i = j;
  return v.splice(i, 1)[0];
}
/* The old magazine leaves the rifle mid-reload: empty ones are just clutter, one with rounds left is loot. */
function ejectMag(x, y, a, rounds, owner) {
  if (rounds <= 0) { dropMag(x, y, a); return; }
  const c = Math.cos(a), s = Math.sin(a);
  addItem({ kind: 'mag', rounds, owner }, x + c * 18 * CHAR_SCALE - s * 14, y + s * 18 * CHAR_SCALE + c * 14, 6);
}
function makeItems() {
  const out = [], spots = MAP.loot || {};
  for (const kind in spots) for (const [tx, ty] of spots[kind])
    if (!wall(tx, ty)) out.push(Object.assign({ x: (tx + 0.5) * T, y: (ty + 0.5) * T, vis: 0, bob: Math.random() * 6 }, freshLoot(kind)));
  return out;
}
let bots = makeBots();
let items = makeItems();
let moveAmt = 0, steady = 0, bloom = 0, zoom = 1, inspect = 0, inspectT = 0;
let pickT = 0, pickItem = null, equip = null;   // equip: { kind, it, t, side, off, on } while it goes on
let viewR = CONE_R, redR = RED_R, redHalf = STILL_HALF;
let sway = 0, redAng = -Math.PI / 2;   // sway = how far the gun has swung off your aim; redAng = where it really points
const arms = { th: 0, w: 0, kickDir: 1, foot: 1 };   // your arms: angle off aim, swing speed
const pAnim = { phase: 0, mvAng: -Math.PI / 2, rx: 0, rv: 0 };   // walk cycle + rifle slide
const camKick = { d: 0, v: 0 };
const look = { x: 0, y: 0 };   // camera lean in screen px, eased (see LOOK)
let pStride = 0, turnRate = 0;
let noiseR = 0, stepT = 0, gunWaveCd = 0;
const waves = [];
let magDropped = false;
const pools = [];   // blood pools spreading under the fallen
let ammo = AR.mag, mags = fullVest(), reloading = 0, fireCd = 0, muzzle = 0, shots = 0;
let state = 'play', stateT = 0;                 // 'play' | 'downed' (bleeding out, see DOWNED) | 'dead' ('dry' is unused while the Glock has unlimited mags)
/* Every map has a way out (MAP.exit): on a mission it opens once the building's clear (a ring by the taxi); at the safe
   house it's the front door. Stand in it for `hold` s and you travel to the next map. A banner says where to go. */
/* An exit can belong to a vehicle (exit.veh names the piece's `veh`): the ring sits just outside its door, on the
   kerb side (`door` = how far along the body), so it goes wherever the vehicle is. Otherwise it's a fixed spot. */
const mkExit = () => {
  const E = MAP.exit, v = E.veh && pieces.find(f => f.veh === E.veh && !f.broken), d = v && v.parts && v.parts.doors.find(q => q.id === E.door);
  return Object.assign({}, E, v ? { x: v.x + (d ? (d.x0 + d.x1) / 2 : 0.5) * v.w, y: v.y - E.r * 0.55, car: v, carDoor: d } : { x: E.x * T, y: E.y * T });
};
/* Slow motion: the shot that kills or downs the last enemy on the map plays out slowly (game time at `k` for `hold` real
   seconds, easing in over `in` and back out over `out`). A downed last enemy triggers it on the downing shot; bleeding out
   later doesn't trigger it again (the area is already clear). Sounds started meanwhile play slower and deeper (timeK). */
const SLOWMO = { k: 0.22, in: 0.06, hold: 1.1, out: 0.7 };
let slowT = -1, timeK = 1;
function slowMo() { slowT = 0; }
function slowStep(rdt) {
  if (slowT < 0) return (timeK = 1);
  slowT += rdt;
  const S = SLOWMO, e = slowT < S.in ? slowT / S.in : slowT < S.in + S.hold ? 1 : 1 - (slowT - S.in - S.hold) / S.out;
  if (e <= 0) { slowT = -1; return (timeK = 1); }
  const q = e * e * (3 - 2 * e);
  return (timeK = 1 + (S.k - 1) * q);
}
let EXIT = mkExit(), cleared = false, bannerT = 0, extractT = 0;
const BANNER_T = 5;
const exitOpen = () => EXIT && (!EXIT.needClear || cleared);
const kitNow = () => JSON.parse(JSON.stringify({ prot: p.prot, ammo, mags, side: { ammo: p.side.ammo }, nades: p.nades }));
let deployKit = null, runKills = { ak: 0, glock: 0 };              // kills this mission: lost if you die there                                   // what you left the safe house with (a restart on the mission uses it)
function travel(to) {                                   // your kit comes with you
  if (MAP.gen && cleared && to === 'house') { prog.missions = (prog.missions || 0) + 1; for (const k in runKills) prog.kills[k] += runKills[k]; saveProg(); }   // a home cleared and driven back from: a mission completed, and its kills count
  const kit = kitNow();
  carried = civs.filter(c => c.bound && !c.dead && !c.gone && !c.handed).map(c => c.look);   // the civilians you've secured come too
  prog.carried = carried; saveProg();
  if (to === 'mission') { to = MISSIONS[missionN++ % MISSIONS.length]; if (to === 'home') MAPS.home = Object.assign(homeMap(), opMap(opNow())); }   // ...the mission picked on the PC   // the car takes you to a house you've never seen
  MAP = MAPS[to]; applyMap();
  if (MAP.bots.length) deployKit = JSON.parse(JSON.stringify(kit));
  resetGame(kit);
}
let hitFlash = 0;
const bullets = [], botBullets = [], sparks = [], pops = [];
let moved = 0, turned = 0, turnAccum = 0, touchSeen = false;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function restart() {                                    // after dying: a generated mission starts over in a brand new house
  if (MAP.gen) { MAPS.home = Object.assign(homeMap(), opMap(MAP.op || opNow())); MAP = MAPS.home; applyMap(); }   // the same kind of mission
  resetGame();
}
function resetGame(kit) {
  p.x = SPAWN.x; p.y = SPAWN.y; p.aim = -Math.PI / 2; p.vx = p.vy = 0; p.nvgLost = false;   // a fresh map: the NVG is back on the helmet p.bloodSteps = 0;
  p.cov = { side: 0, mount: 0, hand: null, sh: 1, shT: 1, swT: 0, lean: 0 }; p.doorTouch = null; p.supp = 0; p.tun = 0; tunT = 0; tunHold = 0; flashes.length = 0; p.prot = newProt();
  initWorld(); dayNight(); intel = null; squadT = 0; expoAt = null; sweep = null; roomOf = null;
  bots = makeBots(); items = makeItems(); civs = makeCivs(); alarms.length = 0; p.melee = null; p.meleeCd = 0; p.secure = null; rescueBanner = null;
  pools.length = 0; smoke.length = 0; trails.length = 0; for (const c of [p].concat(bots, allies)) c.trail = null; p.heat = 0;
  moveAmt = 0; steady = 0; bloom = 0; inspect = 0; inspectT = 0; noiseR = 0; stepT = 0; gunWaveCd = 0; waves.length = 0; redHalf = STILL_HALF;
  pickT = 0; pickItem = null; equip = null; sway = 0;
  arms.th = 0; arms.w = 0; pStride = 0; pAnim.rx = pAnim.rv = 0; camKick.d = camKick.v = 0;
  ammo = AR.mag; mags = fullVest(); reloading = 0; fireCd = 0; muzzle = 0;
  bullets.length = 0; botBullets.length = 0; tracers.length = 0; sparks.length = 0; pops.length = 0; threats.length = 0; magDropped = false; voxQ.length = 0; slowT = -1; timeK = 1;
  hitFlash = 0;
  state = 'play'; stateT = 0; cleared = false; bannerT = 0; extractT = 0; swap = null;
  EXIT = mkExit();
  kit = kit || (MAP.bots.length && deployKit ? JSON.parse(JSON.stringify(deployKit)) : null);
  p.side = freshSide(); p.hol = { a: 0, v: 0, pvx: 0, pvy: 0 };
  allies.length = 0; allies.push(makeAlly());                 // your teammate comes with you to every map
  if (MAP.id === 'house') allyOffDuty(allies[0]);
  runKills = { ak: 0, glock: 0 }; nades.length = 0; p.nade = null; blindT = deafT = 0;
  applyLoadout(true);
  p.nades = fullNades(); p.nvgUp = false; p.nvgK = MAP.bots.length && prog.wear.nvg ? 1 : 0;
  if (kit) { p.prot = kit.prot; ammo = kit.ammo; mags = kit.mags; if (kit.side) p.side.ammo = kit.side.ammo; if (kit.nades) p.nades = Object.assign(fullNades(), kit.nades); }
}
const gearBusy = () => (equip && equip.kind !== 'mag') || (pickItem && pickT > 0 && pickItem.kind !== 'mag');   // rifle down while gear goes on
/* Reload button / R: drops whatever the hands are doing so you can shoot (a grab, gear going on, a reload whose old mag
   is still in). With the rifle empty it reloads instead; with nothing left at all there's nothing to cancel for. */
function reloadPressed() {
  if (state !== 'play') return;
  if (p.side.out || p.side.sw) { if (!p.side.sw && p.side.reload === 0 && p.side.ammo < PISTOL.mag) startPistolReload(); return; }
  if (equip || (pickItem && pickT > 0)) {
    if (ammo === 0 && !mags.length) return;
    cancelPickup();
    if (ammo > 0) return;
  } else if (reloading > 0 && !magDropped) { reloading = 0; return; }
  startReload();
}
function startReload() {
  if (state !== 'play' || reloading > 0 || equip || gearBusy() || ammo >= AR.mag || !mags.length) return;
  reloading = AR.reload; magDropped = false;
}

