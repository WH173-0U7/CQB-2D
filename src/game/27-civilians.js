/* ================= CIVILIANS =================
   Guests and staff going about their night in the hotel, each in their own clothes. A gunshot within earshot freezes
   them for a beat, then they run (hands over their heads) to the nearest place out of sight of the shooting, preferring
   a room off the main floor (restrooms, office, kitchen, back corridor), and cower there. A gunman showing up next to
   them sends them running again. Bots shoot any bystander who comes too close (CIV.botShootR). Rounds hit them like
   anyone else; your auto-fire won't shoot through one (they block the cone like a friend). They die as ragdolls in
   their own clothes, and can go down and crawl like anyone. */
const CIV = { broad: 1.2, r: 13, walk: 40, run: 150, hear: 560, near: 320, freeze: [0.25, 0.7], refugeSteps: 24, botShootR: 125, seeR: 170, rethink: 2.5 };   // near: a shot this close sends a hiding civilian running again
const SKIN = ['#e0b896', '#c99a74', '#a8764f', '#7a5236', '#f0cfb0'];
const civLook = (o) => Object.assign({ civ: true, rim: '#1c1a18', shoe: '#1b1a19', boot: '#1b1a19', bootDark: '#0e0d0c', glove: o.skin, hairHi: o.hair, plate: '#000', carrier: '#000', carrierDark: '#000' }, o, { shirt: o.top, sleeve: o.sleeve || o.top });
const CIV_LOOKS = {
  suit:      civLook({ kind: 'suit', top: '#272b34', topDark: '#191c22', pants: '#23262e', collar: '#ecebe6', tie: '#8a1f2a', hair: '#2a2119', style: 'short', skin: SKIN[0] }),
  clerk:     civLook({ kind: 'vest', top: '#e9e7e1', sleeve: '#e9e7e1', vest: '#6b1f2c', topDark: '#4a1520', pants: '#1c1c20', tie: '#b8913c', hair: '#3b2a1c', style: 'bun', skin: SKIN[1] }),
  bellhop:   civLook({ kind: 'bellhop', top: '#9a2430', topDark: '#6e1720', pants: '#16161a', trim: '#c9a24a', hair: '#1f1813', style: 'cap', skin: SKIN[2] }),
  tourist:   civLook({ kind: 'tee', top: '#3e70a8', topDark: '#2b5079', pants: '#2f4a6b', shoe: '#d8d6d0', boot: '#d8d6d0', bootDark: '#8c8a85', hair: '#c8a45c', style: 'long', skin: SKIN[4] }),
  dress:     civLook({ kind: 'dress', top: '#1f6b55', topDark: '#134636', pants: SKIN[0], dress: '#1f6b55', shoe: '#2a0d12', boot: '#2a0d12', hair: '#1a1210', style: 'long', skin: SKIN[0] }),
  bartender: civLook({ kind: 'vest', top: '#e4e2dc', sleeve: '#e4e2dc', vest: '#1c1c1f', topDark: '#0e0e10', pants: '#151517', tie: '#151517', apron: '#121214', hair: '#2b1d14', style: 'short', skin: SKIN[3] }),
  chef:      civLook({ kind: 'chef', top: '#ebe8e1', topDark: '#bdb9ae', pants: '#4a4c52', hair: '#2a2119', style: 'chef', skin: SKIN[1] }),
  casual:    civLook({ kind: 'hoodie', top: '#6e7076', topDark: '#4b4d52', pants: '#a08f6e', hair: '#5a3b22', style: 'short', skin: SKIN[2] })
};
/* Residents of a generated home: an outfit (what they had on when the door went in) and their own looks, all rolled
   from one seed (`residentLook`): colours, skin, hair colour and style, glasses, a beard. */
const SKIN_ALL = SKIN.concat(['#8d5d3b', '#5e3b26', '#d4a785']);
const HAIR = ['#1a1210', '#2a2119', '#3b2a1c', '#5a3b22', '#8a5a2e', '#c8a45c', '#d9c08a', '#7b2f1a'], GREY = ['#bdbab4', '#d8d6d2', '#9a9894', '#e8e6e0'];
const tone = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => clamp(Math.round(v * k), 0, 255).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
const OUTFITS = [   // w: how often; fn(R, pick) fills in the clothes
  { w: 3, fn: (R, pk) => { const c = pk(['#5b6f9a', '#9a5b6f', '#6f8a6a', '#cfc6b8', '#3d4560', '#8a6fa0']); return { kind: 'pjs', top: c, pants: c, stripe: pk(['#e8e4dc', '#2a2a30', tone(c, 0.6)]), shoe: pk(['#8a7a6a', '#3a3a44', '#b06a7a']), slipper: true }; } },
  { w: 2, fn: (R, pk) => { const c = pk(['#e8e4dc', '#9ab0c8', '#7a2c34', '#3c4a5c', '#c8a8b8']); return { kind: 'robe', top: c, dress: c, bare: true, belt: tone(c, 0.78), shoe: pk(['#e8e4dc', '#4a4a52']), slipper: true }; } },
  { w: 2, fn: (R, pk) => ({ kind: 'gym', top: pk(['#2a2a30', '#c8402c', '#3a78b8', '#e8e6e0', '#5aa070']), trim: pk(['#e8e6e0', '#1a1a1e', '#e8c040']), pants: pk(['#1a1a1e', '#3a3e48', '#5a5e68']), shorts: R() < 0.6, shortSleeve: true, shoe: pk(['#e8e6e0', '#d84a3a', '#2a2a30']) }) },
  { w: 3, fn: (R, pk) => ({ kind: 'sweater', top: pk(['#6a4a3a', '#3e5a4a', '#8a8478', '#2e3a52', '#a0603a', '#5a2a3a']), collar: pk(['#e8e6e0', '#a8c0d8']), pants: pk(['#2f4a6b', '#3a3a40', '#6a6050', '#8a8478']), shoe: pk(['#3a2e24', '#1b1a19', '#d8d6d0']) }) },
  { w: 1, fn: (R, pk) => { const c = pk(['#5a3a24', '#2a4a8a', '#c8302a', '#e8b020']); return { kind: 'polo', top: c, logo: pk(['#e8c040', '#e8e6e0']), pants: pk(['#5a4a32', '#2a2a30', '#3a4050']), shorts: R() < 0.5, shortSleeve: true, cap: c, capTrim: '#1a1a1e', style: 'cap', shoe: '#2a2420' }; } },
  { w: 2, elder: true, fn: (R, pk) => ({ kind: 'cardigan', top: pk(['#7a6a5a', '#5a6a7a', '#8a3a3a', '#a89a80', '#4a5a4a']), collar: pk(['#e8e6e0', '#d8d0c0', '#a8b8c8']), pants: pk(['#5a5248', '#3a3a40', '#7a7468']), shoe: pk(['#3a2e24', '#5a4a3a']) }) },
  { w: 1, fn: (R, pk) => ({ kind: 'tunic', top: pk(['#6a8aa0', '#7a9a80', '#4a4a5a', '#a07a8a']), apron: pk(['#ecebe6', '#d8d0c0']), pants: pk(['#2a2a30', '#4a4a5a']), shoe: '#1b1a19', style: R() < 0.7 ? 'bun' : 'pony' }) },
  { w: 2, fn: (R, pk) => ({ kind: 'tee', top: pk(['#3e70a8', '#c84a3a', '#e8e6e0', '#2a2a30', '#5a8a5a', '#e8a030']), pants: pk(['#2f4a6b', '#3a3a40', '#a08f6e']), shortSleeve: true, shoe: pk(['#d8d6d0', '#2a2a30']) }) },
  { w: 2, fn: (R, pk) => ({ kind: 'hoodie', top: pk(['#6e7076', '#2a2a30', '#5a2a3a', '#3a5a7a', '#7a6a3a']), pants: pk(['#2f4a6b', '#3a3a40', '#6e7076']), shoe: pk(['#d8d6d0', '#2a2a30']) }) },
  { w: 1, fn: (R, pk) => { const c = pk(['#1f6b55', '#7a2c44', '#2a3a6a', '#c8a040', '#1a1a1e']); return { kind: 'dress', top: c, dress: c, bare: true, shoe: pk(['#2a0d12', '#1a1a1e', '#c8a888']), style: R() < 0.7 ? 'long' : 'bun' }; } },
  { w: 1, fn: (R, pk) => ({ kind: 'suit', top: pk(['#272b34', '#3a3a40', '#2a3448']), collar: '#ecebe6', tie: pk(['#8a1f2a', '#2a3a6a', '#3a5a3a']), pants: '#23262e' }) },
  { w: 2, fn: (R, pk) => ({ kind: 'flannel', top: pk(['#8a2a2a', '#2a5a3a', '#2a3a6a', '#6a5a3a', '#5a2a4a']), check: pk(['#1a1a1e', '#e8e4dc', '#2a2a30']), pants: pk(['#2f4a6b', '#3a3e48', '#5a5040']), shoe: pk(['#5a3e28', '#2a2420', '#d8d6d0']) }) },
  { w: 1, fn: (R, pk) => ({ kind: 'puffer', top: pk(['#1a1a1e', '#2a4a8a', '#8a2a2a', '#3a5a3a', '#c8b090', '#e8e6e0']), pants: pk(['#2f4a6b', '#1a1a1e', '#3a3a40']), shoe: pk(['#1b1a19', '#d8d6d0']) }) },
  { w: 1, fn: (R, pk) => { const c = pk(['#4a7ab0', '#3a8a8a', '#6a5a9a', '#2a5a4a', '#8a4a6a']); return { kind: 'scrubs', top: c, pants: c, shortSleeve: true, badge: true, shoe: pk(['#e8e6e0', '#2a2a30', '#5a8ab0']) }; } },
  { w: 1, fn: (R, pk) => ({ kind: 'tank', top: pk(['#e8e6e0', '#1a1a1e', '#8a8478', '#c84a3a', '#3e70a8']), pants: pk(['#2f4a6b', '#3a3a40', '#6e7076']), shorts: R() < 0.5, bareArms: true, shoe: pk(['#d8d6d0', '#2a2a30']) }) },
  { w: 1, fn: (R, pk) => ({ kind: 'denim', top: pk(['#4a6a90', '#2f4a6b', '#6a88a8']), pants: pk(['#2a2a30', '#6a6050', '#3a3a40']), stitch: '#c89a50', shoe: pk(['#5a3e28', '#1b1a19']) }) },
  { w: 2, fn: (R, pk) => ({ kind: 'blouse', top: pk(['#e8dcd0', '#c8a0a8', '#a0b8c8', '#e8e4c0', '#d0c0e0']), pants: pk(['#2a2a30', '#5a5248', '#2f4a6b', '#8a8478']), style: pk(['long', 'bun', 'pony', 'long']), shoe: pk(['#2a0d12', '#1a1a1e', '#c8a888']) }) }
];
function residentLook(R) {
  const pk = a => a[Math.floor(R() * a.length)];
  let u = R() * OUTFITS.reduce((a, o) => a + o.w, 0), o = OUTFITS[0];
  for (const q of OUTFITS) { o = q; if ((u -= q.w) < 0) break; }
  const old = o.elder || R() < 0.12, c = o.fn(R, pk), skin = pk(SKIN_ALL);
  const style = c.style || pk(old ? ['short', 'bald', 'short', 'bun'] : ['short', 'long', 'bun', 'buzz', 'pony', 'curly', 'bald', 'short', 'long']);
  const hair = old ? pk(GREY) : pk(HAIR), masc = style === 'short' || style === 'buzz' || style === 'bald';
  const sh = c.shoe || '#1b1a19';
  const acc = {                                                   // the little things: a watch, a bracelet, a chain, headphones round the neck, a cross-body bag, a lanyard
    watch: R() < (old ? 0.6 : 0.35) ? pk(['#1a1a1e', '#c8b070', '#b8bcc4', '#5a3a24']) : null, watchSide: R() < 0.75 ? 1 : -1,
    bracelet: R() < 0.15 ? pk(['#d8b85a', '#c0c4cc', '#8a3a3a']) : null, necklace: !masc && R() < 0.3 ? pk(['#d8b85a', '#c0c4cc']) : masc && R() < 0.08 ? '#c0c4cc' : null,
    phones: !old && R() < 0.1 ? pk(['#1a1a1e', '#e8e6e0', '#c84a3a']) : null, bag: R() < 0.14 ? pk(['#3a2a20', '#1a1a1e', '#7a5a3a', '#8a2a3a']) : null,
    lanyard: c.badge || R() < 0.05 ? pk(['#2a4a8a', '#8a2a2a', '#1a1a1e']) : null };
  const covered = !masc && style !== 'bald' && R() < 0.12;        // a headscarf
  return civLook(Object.assign({ topDark: tone(c.top, 0.7), skin, hair, style: covered ? 'scarf' : style, scarfC: covered ? pk(['#2a2a30', '#5a3a4a', '#c8b8a0', '#3a4a6a', '#7a2a3a', '#4a5a4a']) : null,
    glasses: R() < (old ? 0.7 : 0.18), beard: masc && R() < 0.3, shoe: sh, boot: sh, bootDark: tone(sh, 0.6), fem: c.kind === 'dress' || c.kind === 'blouse' || (!masc && style !== 'cap') }, acc, c,
    { pants: c.bare ? skin : c.pants, shin: c.shorts || c.bare ? skin : null }, c.bareArms ? { sleeve: skin } : {}));
}
const HOTEL_CIVS = [[20, 14, 'clerk'], [16, 19, 'bellhop'], [14, 15, 'suit'], [12, 18, 'tourist'], [33, 14, 'bartender'], [26, 15, 'dress'], [2, 5, 'chef'], [5, 15, 'casual']];
MAPS.hotel.civs = HOTEL_CIVS;
function makeCivs() {
  if (MAP.id === 'house') return houseCivs();
  return (MAP.civs || []).map(([i, j, k], n) => {
    const x = (i + 0.5) * T, y = (j + 0.5) * T;
    return { civ: true, key: k, look: typeof k === 'number' ? residentLook(rng32(k)) : CIV_LOOKS[k], x, y, r: CIV.r, ang: Math.random() * 6.28, seed: 20 + n * 1.3, dead: false, vis: 0,
      state: MAP.hostages ? 'cower' : 'idle', hostage: !!MAP.hostages, path: [], phase: 0, mv: 0, cower: MAP.hostages ? 1 : 0, panicT: 0, idleT: Math.random() * 3, rethinkT: 0, mvAng: 0,
      prot: { front: 0, back: 0, helmet: 0, chipsF: [], chipsB: [], chipsH: [] }, ammo: 0, mags: [], equip: null, grab: null };
  });
}
/* Where to hide: the nearest tile (within refugeSteps) out of sight of every recent shot and every gunman nearby,
   better still inside a side room. */
function civRefuge(c) {
  const threats = [];                                    // recent shots and nearby gunmen, merged when they're within a tile of each other (few line checks)
  for (const [x, y] of bots.filter(b => !b.dead && Math.hypot(b.x - c.x, b.y - c.y) < 450).map(b => [b.x, b.y]).concat(alarms.filter(a => simT - a.t < 6).reverse().map(a => [a.x, a.y])))
    if (threats.length < 8 && !threats.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < T)) threats.push([x, y]);
  const sx = Math.floor(c.x / T), sy = Math.floor(c.y / T), start = sy * W + sx, dist = new Map([[start, 0]]), q = [start];
  let best = null, bestS = -1e9;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % W, cy = (cur / W) | 0, d = dist.get(cur), x = (cx + 0.5) * T, y = (cy + 0.5) * T;
    let seen = 0; for (const [tx, ty] of threats) if (losClear(tx, ty, x, y)) seen++;
    const room = 'uokzbn'.includes(floorAt[cur]) ? 300 : 0, near = threats.reduce((m, [tx, ty]) => Math.min(m, Math.hypot(tx - x, ty - y)), 1e9);
    const sc = (seen ? -400 * seen : 1000) + room - d * 18 + Math.min(near, 400) * 0.4;
    if (d >= 1 && sc > bestS) { bestS = sc; best = { x, y }; }
    if (d >= CIV.refugeSteps) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
      if (navBlocked(nx, ny) || dist.has(ni) || (dx && dy && (navBlocked(cx + dx, cy) || navBlocked(cx, cy + dy)))) continue;
      dist.set(ni, d + 1); q.push(ni);
    }
  }
  return best;
}
function civFlee(c) {
  const g = civRefuge(c);
  c.state = 'flee'; c.rethinkT = CIV.rethink;
  c.path = g ? findPath(c.x, c.y, g.x, g.y) : [];
}
function updateCivs(dt) {
  for (const c of civs) {
    if (c.dead || c.gone) continue;
    const ox = c.x, oy = c.y;
    const heard = alarms.some(a => simT - a.t < 0.4 && Math.hypot(a.x - c.x, a.y - c.y) < CIV.hear);
    const gunman = !c.hostage && bots.find(b => !b.dead && Math.hypot(b.x - c.x, b.y - c.y) < CIV.seeR && losClear(b.x, b.y, c.x, c.y));
    const spotted = !c.hostage && c.state === 'idle' && (c.spotT = (c.spotT || 0) - dt) <= 0 && (c.spotT = 0.2) && bots.some(b => { if (b.dead) return false; const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy) || 1; return seesChar(c, b, dx, dy, d, false); });   // an armed enemy in view
    const close = alarms.some(a => simT - a.t < 0.4 && Math.hypot(a.x - c.x, a.y - c.y) < CIV.near);
    c.rethinkT -= dt;
    if (c.bound || c.officer || c.state === 'restrain') { rescueStep(c, dt); }
    else if (c.state === 'idle' && (heard || spotted || gunman)) { c.state = 'freeze'; c.panicT = CIV.freeze[0] + Math.random() * (CIV.freeze[1] - CIV.freeze[0]); c.panicAt = spotted || gunman ? (gunman || bots.find(b => !b.dead && seesChar(c, b, b.x - c.x, b.y - c.y, Math.hypot(b.x - c.x, b.y - c.y) || 1, false))) : null; }
    else if (c.state === 'cower' && (gunman || close) && c.rethinkT <= 0) civFlee(c);   // a gunman's right there, or shots close by: run again
    if (c.state === 'freeze') {                                                // a beat of shock, looking toward the noise
      const a = c.panicAt && !c.panicAt.dead ? c.panicAt : alarms[alarms.length - 1];   // toward the gunman they saw, or the noise
      if (a) c.ang += clamp(angDiff(Math.atan2(a.y - c.y, a.x - c.x), c.ang), -6 * dt, 6 * dt);
      if ((c.panicT -= dt) <= 0) civFlee(c);
    } else if (c.state === 'flee') {
      while (c.path.length && Math.hypot(c.path[0].x - c.x, c.path[0].y - c.y) < 10) c.path.shift();
      if (!c.path.length) { c.state = 'cower'; c.rethinkT = CIV.rethink; }
      else {
        const tx = c.path[0].x - c.x, ty = c.path[0].y - c.y, l = Math.hypot(tx, ty) || 1, v = CIV.run * dt;
        moveChar(c, tx / l * v, ty / l * v);
        c.ang += clamp(angDiff(Math.atan2(ty, tx), c.ang), -10 * dt, 10 * dt);
        if (c.rethinkT <= 0 && Math.hypot(c.x - ox, c.y - oy) < v * 0.2) civFlee(c);   // stuck: find another way
      }
    } else if (c.state === 'idle') {                                           // milling about: a look round, a shift of weight
      if ((c.idleT -= dt) <= 0) { c.idleT = 2 + Math.random() * 4; c.lookTo = c.ang + (Math.random() - 0.5) * 2; }
      if (c.lookTo !== undefined) c.ang += clamp(angDiff(c.lookTo, c.ang), -1.5 * dt, 1.5 * dt);
    }
    for (const o of [p, ...bots, ...civs]) if (o !== c && !o.dead && !o.gone) bumpOut(c, o);
    const md = Math.hypot(c.x - ox, c.y - oy);
    if (md > 0.2) c.mvAng = Math.atan2(c.y - oy, c.x - ox);
    c.mv += (clamp(md / dt / CIV.run, 0, 1) - c.mv) * Math.min(1, dt * 10);
    c.phase += md / (STEP_LEN * 1.15) * Math.PI;
    bootStep(c, md, c.ang, c.mvAng);
    c.cower += ((c.state === 'cower' || c.state === 'restrain' ? 1 : 0) - c.cower) * Math.min(1, dt * 5);
  }
  for (let i = civs.length - 1; i >= 0; i--) if (civs[i].gone) civs.splice(i, 1);
  for (let i = alarms.length - 1; i >= 0; i--) if (simT - alarms[i].t > 8) alarms.splice(i, 1);
}
/* Now and then a bot with nothing better to do goes looking for a bystander to kill (`HUNT`): only while it isn't
   fighting you (no contact, no squad role), it picks the nearest living civilian within `reach`, walks a path to them,
   and once it has a clear line within `fireR` it turns and shoots (they'll usually see it coming and run, see
   updateCivs). Gives up after `giveUp` s, or as soon as it sees you. Each bot waits `first` s before its first hunt and
   `every` s between hunts. */
const HUNT = { first: [35, 70], every: [60, 120], reach: 900, fireR: 200, giveUp: 25 };
function huntCiv(b, dt) {
  if (b.state === 'attack' || b.role || !civs.length || (state !== 'play' && state !== 'downed')) { b.hunt = null; return false; }
  if (!b.hunt) {
    if (b.huntT === undefined) b.huntT = rnd(HUNT.first) * (MAP.gen ? 2 : 1);   // a house's gunmen hold their hostages longer
    if ((b.huntT -= dt) > 0) return false;
    b.huntT = rnd(HUNT.every) * (MAP.gen ? 1.5 : 1);
    let best = null, bd = HUNT.reach;
    for (const c of civs) { if (c.dead || c.gone || c.bound || c.officer) continue; const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < bd) { bd = d; best = c; } }
    if (!best) return false;
    b.hunt = { c: best, t: HUNT.giveUp, repath: 0 }; b.path = [];
  }
  const H = b.hunt, c = H.c;
  if (c.dead || c.gone || (H.t -= dt) <= 0) { b.hunt = null; b.path = []; return false; }
  const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy) || 1;
  if (d < HUNT.fireR * (H.closer ? 0.45 : 1) && losClear(b.x, b.y, c.x, c.y)) {   // in reach: turn on them and fire
    const to = Math.atan2(dy, dx), m = 6 * dt;
    b.path = []; b.ang += clamp(angDiff(to, b.ang), -m, m);
    if (Math.abs(angDiff(to, b.gun ? b.gun.ang : b.ang)) < 0.2 + Math.atan2(c.r, d) && gunCanFire(b) && b.fireCd <= 0 && botReady(b)) { botShoot(b, d); H.wait = 0; }
    else if ((H.wait = (H.wait || 0) + dt) > 1.5) { H.closer = true; H.wait = 0; }   // no shot from here (barrel blocked by furniture): get closer
    return true;
  }
  if ((H.repath -= dt) <= 0 || !b.path.length) { b.path = findPath(b.x, b.y, c.x, c.y); H.repath = 0.8; }
  if (followPath(b, BOT.searchSpeed, dt)) { const m = 4 * dt; b.ang += clamp(angDiff(b.walkAng, b.ang), -m, m); }
  else if (!b.path.length) { b.hunt = null; return false; }                       // no way to them
  return true;
}
/* A bot with a bystander right there (in its line, within botShootR) turns and shoots them. */
function botShootsCiv(b, dt) {
  let v = null, vd = CIV.botShootR;
  for (const c of civs) { if (c.dead || c.state === 'idle' || (c.hostage && c.state !== 'flee')) continue; const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < vd && losClear(b.x, b.y, c.x, c.y)) { v = c; vd = d; } }   // once the shooting starts
  if (!v) return false;
  const to = Math.atan2(v.y - b.y, v.x - b.x), m = 6 * dt;
  b.ang += clamp(angDiff(to, b.ang), -m, m); b.path = [];
  if (Math.abs(angDiff(to, b.gun ? b.gun.ang : b.ang)) < 0.2 + Math.atan2(v.r, vd) && gunCanFire(b) && b.fireCd <= 0 && botReady(b)) botShoot(b, vd);
  return true;
}
/* A civilian from above, in the same proportions as everyone else: shoes and legs that stride, clothes by look (suit
   with lapels and tie, waistcoat over a white shirt, bellhop jacket with brass buttons, T-shirt, dress, chef's whites,
   hoodie), arms swinging, pumping when running or clasped over the head when cowering, and a bare head with hair. */
function drawCiv(c, t) {
  const L = c.look, K = CHAR_SCALE, cw = c.cower, walk = clamp(c.mv * 1.4, 0, 1), run = c.state === 'flee' ? 1 : 0, ph = c.phase;
  const sh = cw > 0.5 ? Math.sin(t * 40 + c.seed) * 0.35 * cw : 0;               // trembling
  ctx.save(); ctx.translate(c.x + sh, c.y);
  contactShadow(0, 0, cw, [0, 0]);
  ctx.rotate(c.ang); ctx.scale(K, K); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const mix = (a, b) => a + (b - a) * cw;
  const sw = Math.sin(ph) * 6 * walk, mvR = angDiff(c.mvAng || c.ang, c.ang), mc = Math.cos(mvR), ms = Math.sin(mvR);
  for (const side of [-1, 1]) {                                                 // legs: stride, or folded under when crouched
    const F = [mix(-1 + side * sw * mc, -9), mix(side * 5.2 + side * sw * ms, side * 5.6)], Kn = [mix((F[0] - 1) / 2, 7), mix(side * 5.2, side * 8.2)], H = [-1, side * 4.6];
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(H[0], H[1]); ctx.lineTo(Kn[0], Kn[1]); ctx.lineTo(F[0], F[1]); ctx.stroke();
    ctx.strokeStyle = L.pants; ctx.lineWidth = 4.8; ctx.stroke();
    if (L.shin && L.shin !== L.pants) { ctx.strokeStyle = L.shin; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(Kn[0], Kn[1]); ctx.lineTo(F[0], F[1]); ctx.stroke(); }   // shorts: bare shins
    ctx.fillStyle = L.shoe; ctx.beginPath(); ctx.ellipse(F[0] + 1.5, F[1], 3.4, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (L.dress) { ctx.fillStyle = L.dress; ctx.beginPath(); ctx.ellipse(-1.5, 0, 7.4, 9.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6; ctx.stroke(); }
  ctx.translate(2 * cw, 0);                                                     // hunched over when cowering
  // torso and clothes (as broad as a soldier's body under the vest)
  ctx.save(); ctx.scale(1, CIV.broad);
  ctx.fillStyle = L.rim; ctx.beginPath(); ctx.ellipse(0, 0, 7.6, 12.6, 0, 0, Math.PI * 2); ctx.fill();
  pinCamo(L.top); ctx.fillStyle = L.top; ctx.beginPath(); ctx.ellipse(0, 0, 6.9, 11.9, 0, 0, Math.PI * 2); ctx.fill();
  const shg = ctx.createLinearGradient(charKey.x * 13, charKey.y * 13, -charKey.x * 13, -charKey.y * 13);
  shg.addColorStop(0, 'rgba(255,250,240,0.16)'); shg.addColorStop(0.5, 'rgba(0,0,0,0.04)'); shg.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = shg; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 6.9, 11.9, 0, 0, Math.PI * 2); ctx.clip();
  if (L.kind === 'suit') {                                                      // lapels, white shirt, tie
    ctx.fillStyle = L.collar; ctx.beginPath(); ctx.moveTo(7, -3); ctx.lineTo(1.5, 0); ctx.lineTo(7, 3); ctx.fill();
    ctx.fillStyle = L.tie; ctx.fillRect(1.8, -0.7, 5.4, 1.4);
    ctx.strokeStyle = L.topDark; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(7, -4.2); ctx.lineTo(1.2, -0.4); ctx.moveTo(7, 4.2); ctx.lineTo(1.2, 0.4); ctx.stroke();
  } else if (L.kind === 'vest') {                                               // waistcoat over a white shirt
    ctx.fillStyle = L.vest; ctx.fillRect(-7, -11, 14, 6.5); ctx.fillRect(-7, 4.5, 14, 6.5); ctx.fillRect(-7, -11, 4.5, 22);
    ctx.fillStyle = L.tie; ctx.fillRect(4.2, -0.8, 2.6, 1.6);
    if (L.apron) { ctx.fillStyle = L.apron; ctx.fillRect(1.5, -11, 3, 22); }
  } else if (L.kind === 'bellhop') {                                            // brass buttons and gold trim
    ctx.fillStyle = L.trim; for (const y of [-3.2, 3.2]) for (const x of [-1, 2, 5]) { ctx.beginPath(); ctx.arc(x, y, 0.75, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(-7, -11.9, 14, 1); ctx.fillRect(-7, 10.9, 14, 1);
  } else if (L.kind === 'chef') {                                               // double-breasted whites
    ctx.fillStyle = '#9c988c'; for (const y of [-2.6, 2.6]) for (const x of [0, 3]) { ctx.beginPath(); ctx.arc(x, y, 0.6, 0, Math.PI * 2); ctx.fill(); }
  } else if (L.kind === 'hoodie') {                                             // hood bunched behind the neck, drawstrings
    ctx.fillStyle = L.topDark; ctx.beginPath(); ctx.ellipse(-3.5, 0, 3.4, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8d6d0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(4.5, -1.6); ctx.lineTo(6.6, -1.4); ctx.moveTo(4.5, 1.6); ctx.lineTo(6.6, 1.4); ctx.stroke();
  } else if (L.kind === 'officer') {                                            // name tape, rank on the chest, US Army tape
    ctx.fillStyle = '#3d3a2c'; ctx.fillRect(1.2, -6.5, 1.6, 4.4); ctx.fillRect(1.2, 2.1, 1.6, 4.4);
    ctx.fillStyle = '#1d1d1a'; ctx.fillRect(3.4, -0.8, 1.2, 0.5); ctx.fillRect(3.4, 0.3, 1.2, 0.5);   // captain's bars, subdued
  } else if (L.kind === 'tee') {
    ctx.strokeStyle = L.topDark; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(3.2, 0, 2.6, -1.2, 1.2); ctx.stroke();   // crew neck
  } else if (L.kind === 'pjs') {                                                // striped pyjamas, piped collar
    ctx.strokeStyle = L.stripe; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.9; ctx.beginPath(); for (let y = -11; y <= 11; y += 2.8) { ctx.moveTo(-8, y); ctx.lineTo(8, y); } ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = L.stripe; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(7, -3.4); ctx.lineTo(3, 0); ctx.lineTo(7, 3.4); ctx.stroke();
  } else if (L.kind === 'robe') {                                               // wrap-over front, shawl collar, tied belt
    ctx.strokeStyle = L.topDark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(7, -4.6); ctx.lineTo(1.5, 1.2); ctx.moveTo(7, 4.6); ctx.lineTo(3, 0.4); ctx.stroke();
    ctx.fillStyle = L.belt; ctx.fillRect(-1, -12, 1.6, 24); ctx.beginPath(); ctx.ellipse(5.6, 2.2, 1.3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = L.belt; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(5.6, 2.6); ctx.lineTo(7.4, 3.8); ctx.moveTo(5.4, 2.8); ctx.lineTo(6.2, 5); ctx.stroke();
  } else if (L.kind === 'gym') {                                                // racer stripes over the shoulders
    ctx.fillStyle = L.trim; ctx.fillRect(-8, -7.6, 16, 1.2); ctx.fillRect(-8, 6.4, 16, 1.2);
  } else if (L.kind === 'sweater') {                                            // ribbed knit, a shirt collar at the neck
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5; ctx.beginPath(); for (let x = -7; x <= 7; x += 1.6) { ctx.moveTo(x, -12); ctx.lineTo(x, 12); } ctx.stroke();
    ctx.fillStyle = L.collar; ctx.beginPath(); ctx.moveTo(6.4, -3); ctx.lineTo(3.2, -0.3); ctx.lineTo(5, -0.2); ctx.closePath(); ctx.moveTo(6.4, 3); ctx.lineTo(3.2, 0.3); ctx.lineTo(5, 0.2); ctx.closePath(); ctx.fill();
  } else if (L.kind === 'polo') {                                               // placket and a company logo on the chest
    ctx.fillStyle = L.topDark; ctx.fillRect(3, -0.7, 4, 1.4); ctx.fillStyle = L.logo; ctx.fillRect(2, -6.4, 3.2, 2.2);
  } else if (L.kind === 'cardigan') {                                           // open cardigan over a shirt, buttons down the edge
    ctx.fillStyle = L.collar; ctx.fillRect(1, -2, 7, 4);
    ctx.fillStyle = L.topDark; for (const x of [2.5, 5.5]) { ctx.beginPath(); ctx.arc(x, -2.6, 0.6, 0, Math.PI * 2); ctx.fill(); }
  } else if (L.kind === 'tunic') {                                              // housekeeper: tunic and a white apron
    ctx.fillStyle = L.apron; ctx.fillRect(0.5, -7, 8, 14); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.5; ctx.strokeRect(0.5, -7, 8, 14);
  } else if (L.kind === 'flannel') {                                            // plaid: a check in two weights, a button placket
    ctx.strokeStyle = L.check; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.1; ctx.beginPath(); for (let q = -12; q <= 12; q += 3.2) { ctx.moveTo(-8, q); ctx.lineTo(8, q); ctx.moveTo(q * 0.6, -12); ctx.lineTo(q * 0.6, 12); } ctx.stroke();
    ctx.globalAlpha = 0.18; ctx.lineWidth = 0.4; ctx.beginPath(); for (let q = -10.4; q <= 12; q += 3.2) { ctx.moveTo(-8, q); ctx.lineTo(8, q); } ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = L.topDark; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(3, -0.5); ctx.lineTo(7.5, -0.5); ctx.stroke();
  } else if (L.kind === 'puffer') {                                             // quilted down jacket: puffed channels, a zip, a high collar
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6; for (const k of [0.8, 0.62, 0.44]) { ctx.beginPath(); ctx.ellipse(0, 0, 6.9 * k, 11.9 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; for (const k of [0.71, 0.53]) { ctx.beginPath(); ctx.ellipse(-0.4, -0.4, 6.9 * k, 11.9 * k, 0, 3.6, 5.4); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(3.6, 0); ctx.lineTo(7.2, 0); ctx.stroke();
  } else if (L.kind === 'scrubs') {                                             // V-neck scrub top, a breast pocket with pens, an ID badge
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.moveTo(7.4, -2.6); ctx.lineTo(3.6, 0); ctx.lineTo(7.4, 2.6); ctx.fill();
    ctx.strokeStyle = L.topDark; ctx.lineWidth = 0.5; ctx.strokeRect(2.6, -7, 3, 2.6); ctx.fillStyle = '#e8e6e0'; ctx.fillRect(2.4, -6.6, 0.5, 0.8); ctx.fillStyle = '#2a4a8a'; ctx.fillRect(2.4, -5.6, 0.5, 0.8);
  } else if (L.kind === 'tank') {                                               // tank top: bare shoulders, the straps over them
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(0, -10.2, 5.6, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 10.2, 5.6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.top; ctx.fillRect(-1.2, -9.8, 2.4, 3.4); ctx.fillRect(-1.2, 6.4, 2.4, 3.4);
  } else if (L.kind === 'denim') {                                              // denim jacket: collar, flap chest pockets, contrast stitching
    ctx.fillStyle = L.topDark; ctx.beginPath(); ctx.moveTo(6.6, -4); ctx.lineTo(2.6, -0.4); ctx.lineTo(4.8, -0.2); ctx.closePath(); ctx.moveTo(6.6, 4); ctx.lineTo(2.6, 0.4); ctx.lineTo(4.8, 0.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = L.stitch; ctx.setLineDash([0.6, 0.5]); ctx.lineWidth = 0.35; for (const y of [-6.4, 4.4]) ctx.strokeRect(2.4, y, 3.6, 2.4); ctx.beginPath(); ctx.moveTo(3, -0.2); ctx.lineTo(7.5, -0.2); ctx.stroke(); ctx.setLineDash([]);
  } else if (L.kind === 'blouse') {                                             // a soft collar and small buttons down the front
    ctx.strokeStyle = L.topDark; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(3.4, 0, 2.8, -1.3, 1.3); ctx.stroke();
    ctx.fillStyle = L.topDark; for (const x of [4.6, 6.2]) { ctx.beginPath(); ctx.arc(x, 0, 0.35, 0, Math.PI * 2); ctx.fill(); }
  }
  // every top: the shoulder seams, a few soft folds, the shadow round the neck
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.55; ctx.beginPath();
  for (const sd of [-1, 1]) { ctx.moveTo(4.5, sd * 7.4); ctx.quadraticCurveTo(0, sd * 8.6, -4.5, sd * 7.4); }
  ctx.moveTo(-5.4, -3.8); ctx.quadraticCurveTo(-4.2, -1.2, -5.6, 1.6); ctx.moveTo(4.8, 4.2); ctx.quadraticCurveTo(3.6, 6.2, 4.4, 8.4); ctx.stroke();
  const ng = ctx.createRadialGradient(1.2, 0, 3.5, 1.2, 0, 6.6); ng.addColorStop(0, 'rgba(0,0,0,0.35)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(1.2, 0, 6.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.restore();
  // accessories over the clothes
  if (L.lanyard) { ctx.strokeStyle = L.lanyard; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(2.6, -4.2); ctx.lineTo(6.6, -0.6); ctx.moveTo(2.6, 4.2); ctx.lineTo(6.6, 0.6); ctx.stroke(); ctx.fillStyle = '#ecebe6'; ctx.fillRect(6.4, -1.3, 1.4, 2.6); ctx.fillStyle = L.lanyard; ctx.fillRect(6.4, -1.3, 1.4, 0.6); }
  if (L.bag) {                                                                   // cross-body strap, the bag at the hip
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3.5, -9.2 * CIV.broad); ctx.lineTo(4.5, 6 * CIV.broad); ctx.stroke(); ctx.strokeStyle = L.bag; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrPath(-1.6, 11.6 * CIV.broad, 6, 3.2, 1); ctx.fill(); ctx.fillStyle = L.bag; rrPath(-2, 11.2 * CIV.broad, 6, 3.2, 1); ctx.fill();
  }
  if (L.necklace) { ctx.strokeStyle = L.necklace; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.arc(1.4 + 2 * cw, 0, 5.6, -1.25, 1.25); ctx.stroke(); }
  if (L.phones) { ctx.strokeStyle = L.phones; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(1 + 2 * cw, 0, 6.2, -1.6, 1.6); ctx.stroke(); ctx.fillStyle = L.phones; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(2.4 + 2 * cw, sd * 5.9, 1.9, 1.3, 0, 0, Math.PI * 2); ctx.fill(); } }
  // arms: swinging, pumping when running, over the head when cowering
  for (const side of [-1, 1]) {
    const S = [0, side * 9.2 * CIV.broad];
    let Hd = [mix(1 - side * sw * 0.5 * (1 - run) + run * Math.sin(ph) * side * 5, 6.5), mix(side * 11.5 * CIV.broad, side * 2.6)];
    if (run && !cw) Hd = [6 + Math.sin(ph) * side * 4, side * 4.5];               // running: hands over the head
    const bk = c.bound ? 1 : c.state === 'restrain' ? smooth01((c.restrainF || 0) * 1.6) : 0;   // hands going behind the back for the zip tie
    if (bk) Hd = [Hd[0] + (-6.5 - Hd[0]) * bk, Hd[1] + (side * 2.2 - Hd[1]) * bk];
    if (L.kind === 'officer' && !run) Hd = [-5, side * 3.4];                      // parade rest: hands behind the back
    const E = [(S[0] + Hd[0]) / 2 - 1.5, (S[1] + Hd[1]) / 2 + side * 2.5];
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(Hd[0], Hd[1]); ctx.stroke();
    ctx.strokeStyle = L.sleeve; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(Hd[0], Hd[1]); ctx.stroke();
    if (L.shortSleeve) { const m = [(S[0] + E[0]) / 2, (S[1] + E[1]) / 2]; ctx.strokeStyle = L.skin; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(Hd[0], Hd[1]); ctx.stroke(); }   // bare forearms
    else if (L.sleeve !== L.skin) { const q = 0.8, cx2 = E[0] + (Hd[0] - E[0]) * q, cy2 = E[1] + (Hd[1] - E[1]) * q; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3.8; ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 + (Hd[0] - E[0]) * 0.06, cy2 + (Hd[1] - E[1]) * 0.06); ctx.stroke(); }   // the cuff
    const wr = side === L.watchSide ? L.watch : side === -(L.watchSide || 1) ? L.bracelet : null;
    if (wr) { const q = 0.82, wx = E[0] + (Hd[0] - E[0]) * q, wy = E[1] + (Hd[1] - E[1]) * q; ctx.strokeStyle = wr; ctx.lineWidth = side === L.watchSide ? 1.7 : 0.8; ctx.beginPath(); ctx.moveTo(wx - (Hd[1] - E[1]) * 0.12, wy + (Hd[0] - E[0]) * 0.12); ctx.lineTo(wx + (Hd[1] - E[1]) * 0.12, wy - (Hd[0] - E[0]) * 0.12); ctx.stroke(); }   // a watch on one wrist, a bracelet on the other
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(Hd[0], Hd[1], 2.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  if (c.bound) {                                                                 // the zip tie across the wrists
    ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-6.5, -2.4); ctx.lineTo(-6.5, 2.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.4; ctx.stroke();
  }
  civHead(L, 1 + 2 * cw);
  ctx.restore();
}
function civHead(L, x) {
  ctx.save(); ctx.translate(x, 0);
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(1.2, 0, 4.8, 4.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.hair;
  if (L.style === 'long') { ctx.beginPath(); ctx.ellipse(-2.6, 0, 6.6, 5.4, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (L.style === 'bald') { ctx.fillStyle = 'rgba(255,240,220,0.18)'; ctx.beginPath(); ctx.ellipse(0.4, -1, 2.4, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = L.hair; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(-2.4, 0, 2.2, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }   // a fringe round the back
  else if (L.style === 'buzz') { ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(-0.6, 0, 4.4, 4.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  else if (L.style === 'curly') { for (let a = 0; a < 6.28; a += 0.75) { ctx.beginPath(); ctx.arc(-0.8 + Math.cos(a) * 3.4, Math.sin(a) * 3.4, 2.2, 0, Math.PI * 2); ctx.fill(); } ctx.beginPath(); ctx.arc(-0.8, 0, 3.6, 0, Math.PI * 2); ctx.fill(); }
  else if (L.style === 'pony') { ctx.beginPath(); ctx.ellipse(-0.8, 0, 4.6, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(-6.2, 0, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (L.style === 'chef') { ctx.fillStyle = '#f2efe8'; ctx.beginPath(); ctx.arc(-0.4, 0, 5.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#c9c5ba'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(-0.4, 0, 3, 0, Math.PI * 2); ctx.stroke(); }
  else if (L.style === 'scarf') {                                               // a headscarf: over the hair, draped down behind to the shoulders, a fold at the brow
    ctx.fillStyle = L.scarfC; ctx.beginPath(); ctx.ellipse(-4.4, 0, 4.6, 6.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.6, 0, 5.4, 5.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(-0.6, 0, 4.4, 4.4, 0, -1.1, 1.1); ctx.moveTo(-3, -4.2); ctx.quadraticCurveTo(-6, 0, -3, 4.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(-1.6, -1.8, 2.6, 1.4, -0.4, 0, Math.PI * 2); ctx.fill();
  }
  else { ctx.beginPath(); ctx.ellipse(-0.8, 0, 4.6, 4.5, 0, 0, Math.PI * 2); ctx.fill(); }
  if (L.style === 'bun') { ctx.beginPath(); ctx.arc(-5, 0, 2.2, 0, Math.PI * 2); ctx.fill(); }
  if (L.style && L.style !== 'bald' && L.style !== 'chef' && L.style !== 'scarf' && L.style !== 'cap' && L.style !== 'patrol') {   // a sheen on the hair, and a parting
    ctx.fillStyle = 'rgba(255,245,230,0.13)'; ctx.beginPath(); ctx.ellipse(-2, -1.8, 2.4, 1.2, -0.4, 0, Math.PI * 2); ctx.fill();
    if (L.style === 'long' || L.style === 'short') { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(2.6, 0.8); ctx.quadraticCurveTo(-0.5, 1.1, -3.6, 0.6); ctx.stroke(); }
  }
  if (L.style === 'patrol') { pinCamo(L.top); ctx.fillStyle = L.top; ctx.beginPath(); ctx.ellipse(-0.4, 0, 4.9, 4.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = L.topDark; ctx.beginPath(); ctx.ellipse(4, 0, 1.6, 3.8, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); }   // patrol cap and its brim
  if (L.style === 'cap' && L.cap) { ctx.fillStyle = L.cap; ctx.beginPath(); ctx.ellipse(-0.6, 0, 4.9, 4.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = L.capTrim; ctx.beginPath(); ctx.ellipse(4.2, 0, 2, 4, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); }   // a ball cap and its peak
  else if (L.style === 'cap') { ctx.fillStyle = L.top; ctx.beginPath(); ctx.arc(-0.6, 0, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = L.trim; ctx.lineWidth = 0.8; ctx.stroke(); }
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(3.6, 0, 1.8, 3, 0, 0, Math.PI * 2); ctx.fill();   // face, peeking out front
  if (L.beard) { ctx.fillStyle = L.hair; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(4.1, 0, 1.5, 3.1, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (L.glasses) { ctx.strokeStyle = '#141414'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(1, -4.6); ctx.lineTo(4.9, -2.6); ctx.lineTo(4.9, 2.6); ctx.lineTo(1, 4.6); ctx.stroke(); ctx.fillStyle = 'rgba(180,210,230,0.35)'; ctx.fillRect(4.6, -2.4, 0.9, 1.9); ctx.fillRect(4.6, 0.5, 0.9, 1.9); }
  ctx.restore();
}
/* Civilian ragdolls: their clothes over the torso, bare hands and head. */
function civRagDetail(rg, pe, ta, Lt) {
  const L = rg.L, K = CHAR_SCALE;
  ctx.save(); ctx.translate(pe.x, pe.y); ctx.rotate(ta); ctx.scale(K, K);
  if (L.kind === 'suit') { ctx.fillStyle = L.collar; ctx.beginPath(); ctx.moveTo(Lt, -3); ctx.lineTo(Lt * 0.62, 0); ctx.lineTo(Lt, 3); ctx.fill(); ctx.fillStyle = L.tie; ctx.fillRect(Lt * 0.55, -0.7, Lt * 0.42, 1.4); }
  else if (L.kind === 'vest') { ctx.fillStyle = L.vest; ctx.fillRect(Lt * 0.2, -7.5, Lt * 0.7, 3.5); ctx.fillRect(Lt * 0.2, 4, Lt * 0.7, 3.5); }
  else if (L.kind === 'bellhop') { ctx.fillStyle = L.trim; for (const y of [-2.6, 2.6]) for (let q = 0.35; q < 0.9; q += 0.2) { ctx.beginPath(); ctx.arc(Lt * q, y, 0.7, 0, Math.PI * 2); ctx.fill(); } }
  else if (L.kind === 'tunic') { ctx.fillStyle = L.apron; ctx.fillRect(Lt * 0.15, -4.5, Lt * 0.75, 9); }
  else if (L.kind === 'pjs') { ctx.strokeStyle = L.stripe; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8; ctx.beginPath(); for (let y = -7; y <= 7; y += 2.8) { ctx.moveTo(0, y); ctx.lineTo(Lt, y); } ctx.stroke(); ctx.globalAlpha = 1; }
  if (L.dress) { ctx.fillStyle = L.dress; ctx.beginPath(); ctx.ellipse(-2, 0, 8, 8.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function civRagEnd(rg) {
  const P = rg.pts, L = rg.L, K = CHAR_SCALE;
  for (const h of [7, 8]) { ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(P[h].x, P[h].y, 2.2 * K, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(P[0].x, P[0].y); ctx.rotate(Math.atan2(P[0].y - P[1].y, P[0].x - P[1].x)); ctx.scale(K * 0.92, K * 0.92);
  civHead(L, -2); ctx.restore();
}

