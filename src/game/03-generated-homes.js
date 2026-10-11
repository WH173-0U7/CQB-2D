/* ================= GENERATED MISSIONS =================
   `genHome(seed)` builds a single-storey home on a lot, as map data in the same shape as MAPS.hotel: street and your car
   at the bottom, front lawn, the house, a back yard. Every seed is a different floor plan, built the way real houses are
   laid out:
   - a floor-plan type (`HOMEGEN.closed` / `.open`): center hall (a hallway from the front door to the back, rooms either side),
     cross hall (a hallway across the house, living room and a bedroom at the front, kitchen and bath behind), side hall
     (open-plan living and kitchen on one side, a bedroom hallway along it), or an L-shaped wing (the bedrooms in a wing
     set back from the front); bigger houses can add an attached garage;
   - a room programme for the house size (`HOMEGEN.sizes`): bedrooms (one a master, maybe with an en-suite), bathroom,
     kitchen, living room, maybe a dining room, office, laundry or entry hall;
   - room sizes from real floor areas (`ROOMS`, m², with a tile being 0.9 m), shared out along each side of the hallway;
   - furniture at real sizes (`REAL`, cm), set against walls by type (the bed's headboard on a wall without a door, the
     sofa facing the TV, counters along the longest kitchen wall, the toilet and vanity on bathroom walls), then dressed
     with small things on surfaces and floors (`top`, `clutter`).
   Windows go on outside walls; doors self-close only at the front and back. A layout whose rooms, doors, enemies or
   residents can't all be walked to from the street is thrown away (`homeMap` tries the next seed). */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* Sources for the home generator (real data, not guesses):
   - NAHB, "Spaces in New Homes" (Paul Emrath, Special Studies, 14 Mar 2019), Table 2: how often each room is present and its average size,
     for small (<2,000 sq ft), all and large (3,500+ sq ft) new single-family homes. Our small / medium / large homes use those three columns.
   - US Census Bureau, Characteristics of New Housing: median new single-family home 2,146 sq ft (2024); 2023: 66% two-car garages, 17% three-car+
     (via NAHB Eye on Housing, "Parking garages for new homes 2023").
   - International Residential Code R304/R311: habitable rooms at least 70 sq ft and 7 ft across, hallways at least 36 in.
   - Room sizes for small rooms: hall bath 5x8 ft (40-50 sq ft), powder room 4x4 to 6x6 ft, walk-in closet about 7x10 ft (Bob Vila, HomeGuide).
   - Published plans for layout patterns: Architectural Designs 51892HZ (split bedrooms, foyer to great room, mudroom off the garage, walk-in pantry,
     3'8" x 7' island), Family Home Plans 82557 (garage hall to mudroom and laundry, half bath between great room and bedrooms, master at the rear),
     The Plan Collection 100-1084 / 138-1217 (great room at the centre, master suite one side, bedrooms the other). */
const HOMEGEN = { sizes: [                               // each home rolls a size: footprint (tiles, walls included), enemies, residents, rooms
  // chances per room from NAHB Table 2 (small / all / large homes): master bath 100/99/98%, laundry 84/94/98%, dining 58/64/76%, foyer 77/90/98%,
  // study 23/60/93%, walk-in pantry 52/71/85%, an open great room 36/37/39%, a family room 39/56/66% (302-484 sq ft), a breakfast nook 36/50/56% (126-214 sq ft); garages from the Census (most new homes have one)
  { name: 'small',  p: 0.3,  w: [18, 22], d: [13, 16], bots: [1, 3], civs: [2, 3], beds: [1, 2], ens: 1,    powder: 0,   office: 0.23, laundry: 0.84, dining: 0.58, entry: 0.77, pantry: 0.52, open: 0.36, garage: 0.5, family: 0.39, nook: 0.36 },
  { name: 'medium', p: 0.45, w: [21, 26], d: [15, 18], bots: [2, 4], civs: [2, 5], beds: [2, 3], ens: 0.99, powder: 0.4, office: 0.6,  laundry: 0.94, dining: 0.64, entry: 0.9,  pantry: 0.71, open: 0.37, garage: 0.75, family: 0.56, nook: 0.5 },
  { name: 'large',  p: 0.25, w: [25, 30], d: [17, 19], bots: [3, 5], civs: [3, 6], beds: [3, 4], ens: 0.98, powder: 0.7, office: 0.93, laundry: 0.98, dining: 0.76, entry: 0.98, pantry: 0.85, open: 0.39, garage: 0.85, family: 0.66, nook: 0.56 }
], hall1: 0.5, closed: ['center', 'cross'], open: ['side', 'wing'], split: { medium: 0.6, large: 0.7 }, openK: 1.12 };   // openK: open plans pass homeMap's checks more often (measured), so they're rolled less to end up at NAHB's share   // open plans: the split-bedroom ranch where the lot is wide enough
/* Room floor areas in m² (a tile is 0.9 × 0.9 m = 0.81 m²) from NAHB Table 2 (small-home average .. all-home average, sq ft × 0.0929),
   the least the game can use (tiles: across, along) and d, the deepest it gets (tiles from its door wall, from typical real dimensions);
   a deeper side gets a wall and a small room behind it. */
const ROOMS = {
  living:  { a: [25.3, 31.9], min: [4, 5], fl: 'l', d: 6 },   // living room 272-343 sq ft (16x18 ft typical)
  kitchen: { a: [18.1, 26.8], min: [3, 4], fl: 'k', d: 4 },   // kitchen 195-288 sq ft (13x15 ft typical)
  dining:  { a: [12.9, 19.4], min: [4, 4], fl: 'l', d: 5 },   // dining room 139-209 sq ft
  master:  { a: [20.7, 29.0], min: [4, 5], fl: 'b', d: 5 },   // master bedroom 223-312 sq ft (14x16 ft typical)
  bed:     { a: [12.1, 15.8], min: [4, 4], fl: 'b', d: 4 },   // other bedrooms 285-503 sq ft over two to three rooms: 130-170 each
  ens:     { a: [10.4, 15.3], min: [2, 3], fl: 'n', d: 4 },   // master bath 112-165 sq ft (a small home's is a 5x8 ft three-quarter bath: shower, toilet, basin)
  bath:    { a: [3.7, 5.6],   min: [2, 3], fl: 'n', d: 3 },   // hall bath 40-60 sq ft (5x8 ft)
  powder:  { a: [1.7, 3.0],   min: [2, 2], fl: 'n', d: 3 },   // half bath 18-32 sq ft (4x4 to 6x6 ft)
  office:  { a: [11.9, 17.2], min: [3, 4], fl: 'o', d: 4 },   // study/den 128-185 sq ft
  laundry: { a: [6.7, 9.7],   min: [2, 2], fl: 'n', d: 3 },   // laundry room 72-104 sq ft (or a 6x6 ft laundry closet where space is short)
  pantry:  { a: [5.9, 9.5],   min: [2, 2], fl: 'k' },         // walk-in pantry 63-102 sq ft
  entry:   { a: [4.3, 8.4],   min: [2, 3], fl: 'w' },         // entry foyer 46-90 sq ft
  closet:  { a: [6.0, 9.3],   min: [2, 3], fl: 'b' },         // walk-in closet 65-100 sq ft (7x10 ft)
  storage: { a: [3, 5],       min: [3, 3], fl: 'o', d: 3 },
  vest:    { a: [1, 2],       min: [1, 2], fl: 'b' },
  family:  { a: [28.1, 37.0], min: [4, 4], fl: 'l' },         // family room 302-398 sq ft (NAHB), a second sitting room off the living or dining room
  nook:    { a: [11.7, 14.4], min: [3, 3], fl: 'k' },         // breakfast nook 126-155 sq ft, open to the kitchen         // a bedroom's short entry beside its closet (the bedroom keeps the outside wall and its window)
  hall: { fl: 'w' }, garage: { fl: 'z' }                      // garage inside 5.4 x 6.3 m (18x21 ft: the smallest usual two-car)
};
/* Furniture at real sizes (cm, width along the wall × depth). */
const CEIL = { on: { family: 0.7, nook: 0.55, vest: 0.2, entry: 0.6, closet: 0.1, powder: 0.3, pantry: 0.2, living: 0.8, kitchen: 0.75, dining: 0.5, hall: 0.6, master: 0.35, bed: 0.3, bath: 0.45, ens: 0.35, office: 0.5, laundry: 0.3, storage: 0.15, garage: 0.35 } };   // chance a room's light is on
const REAL = { queen: [160, 210], double: [140, 200], single: [100, 200], nstand: [50, 40], dresser: [140, 50], ward: [150, 60], chest: [110, 45],
  desk: [130, 65], sofa: [215, 92], loveseat: [160, 92], armch: [85, 85], coffee: [115, 60], stbl: [50, 50], tv: [170, 45], shelf: [90, 35],
  dine4: [120, 80], dine6: [180, 95], chair: [45, 50], fridge: [76, 74], vanity: [80, 50], toilet: [38, 70], tub: [170, 75], shower: [90, 90],
  washer: [60, 62], side: [150, 45], bench: [110, 40], plant: [40, 40], lamp: [40, 40], otto: [60, 45], laundry: [50, 36], boxes: [60, 48], ochair: [55, 55], stool: [35, 35] };
const LIGHT_PROPS = new Set(['chair', 'stool', 'bin', 'lamp', 'plant', 'ochair', 'nstand', 'stbl', 'laundry', 'otto', 'bike', 'mailbox']);   // shoved aside, not in the way
function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* `safe`: the safe house, built by the same rules (`safeHouse`): a medium or large home with a garage fitted out as the
   armory (its roller door shut: the workbench on the back wall, the gear locker, ammo crates and the RESTOCK ring, a
   weapon rack), a PC desk in the master bedroom (the MISSION PC), every light on, nobody else in it, and the Army
   officer's spot in the back garden by the gate in the fence. */
function genHome(seed, safe) {
  const R = rng32(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)], chance = p => R() < p;
  const cm = v => v * T / 90, M2 = 0.81;
  const S = [], F = [], inH = [];
  for (let j = 0; j < H; j++) { S.push(Array(W).fill('.')); F.push(Array(W).fill('v')); inH.push(Array(W).fill(false)); }
  for (let i = 0; i < W; i++) { S[0][i] = S[H - 1][i] = '#'; F[23][i] = 's'; F[H - 1][i] = 's'; for (let j = 24; j <= 28; j++) F[j][i] = 'a'; }
  for (let j = 0; j < H; j++) S[j][0] = S[j][W - 1] = '#';
  let Z = HOMEGEN.sizes[0]; for (let u = R(), n = 0; n < HOMEGEN.sizes.length; n++) { Z = HOMEGEN.sizes[n]; if ((u -= Z.p) < 0) break; }
  if (safe && Z.name === 'small') Z = HOMEGEN.sizes[1];                // the safe house is a family home with room for an armory
  const plan = !chance(Z.open * HOMEGEN.openK) ? (Z.name === 'large' ? 'center' : pick(HOMEGEN.closed)) :   // a big closed plan is a centre-hall house
     chance(HOMEGEN.split[Z.name] || 0) ? 'split' : pick(HOMEGEN.open), split = plan === 'split';
  // ---- the programme: which rooms this house has
  const nb = ri(Z.beds[0], Z.beds[1]), priv = [{ k: 'master' }];
  for (let n = 1; n < nb; n++) priv.push({ k: 'bed' });
  priv.splice(ri(1, priv.length), 0, { k: 'bath' });
  if (chance(Z.ens)) priv.splice(1, 0, { k: 'ens' });                    // straight after the master: its own door from there
  if (chance(Z.office)) priv.push({ k: 'office' });
  if (chance(Z.powder)) priv.push({ k: 'powder' });                       // a half bath at the front end, near the living room
  const pub = [{ k: 'kitchen' }]; if (split || chance(Z.dining)) pub.push({ k: 'dining' }); pub.push({ k: 'living' });   // back to front
  const extra = []; if (chance(Z.laundry)) extra.push({ k: 'laundry' });
  const hwd = chance(HOMEGEN.hall1) ? 1 : 2;   // hallway width in tiles: real ones are 36-42 in (IRC minimum 36 in), one tile; some homes get a wider one
  const wantPantry = chance(Z.pantry), wantEntry = chance(Z.entry), wantFamily = chance(Z.family), wantNook = chance(Z.nook);
  let hasFamily = false, hasNook = false;
  if (split) { for (const k of ['master', 'ens', 'office']) { const q = priv.findIndex(r => r.k === k); if (q >= 0) priv.splice(q, 1); } }
  for (const r of pub) { const D = ROOMS[r.k]; if (!r.area) r.area = D.a[0] + R() * (D.a[1] - D.a[0]); }   // the master suite and the study get their own wing
  for (const r of priv.concat(pub, extra)) { const D = ROOMS[r.k]; r.area = r.k === 'ens' && Z.name === 'small' ? 3.7 + R() * 2.3 : D.a[0] + R() * (D.a[1] - D.a[0]); }   // a small home's master bath is a 3/4 bath (40-65 sq ft)
  // ---- the footprint on the lot (front at the bottom, facing the street)
  const garage = (safe || chance(Z.garage)) && plan !== 'wing', gw = garage ? 8 : 0;
  if (safe && !garage) return fail();
  if ((split || plan === 'side') && garage) { if (!extra.length) extra.push({ k: 'laundry', area: 4 }); extra[0].must = true; }   // in from the garage through the laundry (a mudroom): kept at the front of the bedroom block, beside the garage
  const hw = Math.min(split ? Math.max(24, ri(Z.w[0], Z.w[1])) : ri(Z.w[0], Z.w[1]), W - 4 - gw), hd = ri(Z.d[0], Z.d[1]), hy1 = ri(18, 20), hy0 = Math.max(2, hy1 - hd + 1);   // (a game wall is a whole 0.9 m tile, a real one 0.15 m, so footprints run larger than real ones to hold real rooms)
  const gLeft = chance(0.5), hx0 = ri(2 + (gLeft ? gw : 0), W - 3 - hw + 1 - (gLeft ? 0 : gw)), hx1 = hx0 + hw - 1;
  const rooms = [], doors = [], open = [];
  const box = (x0, y0, x1, y1) => { for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { inH[j][i] = true; S[j][i] = j === y0 || j === y1 || i === x0 || i === x1 ? '#' : '.'; if (S[j][i] === '.') F[j][i] = 'w'; } };
  const wallLine = (x0, y0, x1, y1) => { for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) S[j][i] = '#'; };
  const mkRoom = (k, x0, y0, x1, y1) => { const r = { kind: k, x0, y0, x1, y1, dt: [] }; rooms.push(r); const fl = ROOMS[k].fl; for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) F[j][i] = fl; return r; };
  const roomAt = (a, b) => rooms.find(q => a >= q.x0 && a <= q.x1 && b >= q.y0 && b <= q.y1) || null;
  const nearDoor = (a, b, d0) => doors.some(d => Math.abs(d[0] - a) <= 1 && Math.abs(d[1] - b) <= 1 && (d0 || (Math.abs(d[0] - a) === 1 && Math.abs(d[1] - b) === 1)));
  const door = (i, j, r1, r2, cl) => {
    if (nearDoor(i, j)) {                                                  // two doors at an inside corner swing into each other: slide this one along its wall, keeping the same two rooms
      const inR = (r, q) => r && q[0] >= r.x0 && q[0] <= r.x1 && q[1] >= r.y0 && q[1] <= r.y1, key = q => inR(r1, q) ? r1 : inR(r2, q) ? r2 : roomAt(...q) || (inH[q[1]][q[0]] ? 'in' : 'out');
      const alongX = S[j][i - 1] === '#' && S[j][i + 1] === '#', sideA = alongX ? [i, j - 1] : [i - 1, j], sideB = alongX ? [i, j + 1] : [i + 1, j], rA = key(sideA), rB = key(sideB);
      for (const st of [1, -1, 2, -2]) {
        const a = alongX ? i + st : i, b = alongX ? j : j + st;
        if (!S[b] || S[b][a] !== '#' || nearDoor(a, b, true)) continue;
        const sa = alongX ? [a, b - 1] : [a - 1, b], sb = alongX ? [a, b + 1] : [a + 1, b], jamb = alongX ? S[b][a - 1] === '#' && S[b][a + 1] === '#' : S[b - 1][a] === '#' && S[b + 1][a] === '#';
        if (jamb && S[sa[1]][sa[0]] === '.' && S[sb[1]][sb[0]] === '.' && key(sa) === rA && key(sb) === rB) { i = a; j = b; break; }
      }
    }
    S[j][i] = '.'; F[j][i] = (r1 && ROOMS[r1.kind].fl) || 'w'; doors.push([i, j, i, j, !!cl]); for (const r of [r1, r2]) if (r) r.dt.push([i, j]); };
  const opening = (tiles, r1, r2) => { for (const [i, j] of tiles) { S[j][i] = '.'; F[j][i] = (r1 && ROOMS[r1.kind].fl) || 'w'; open.push([i, j]); for (const r of [r1, r2]) if (r) r.dt.push([i, j]); } };
  /* A laundry closet (6 ft deep) at a dead end of a hallway, as in many real plans: carved before the rooms go in, and no room's door may open
     onto that stretch (`avoid`, along the hallway). */
  let avoid = [];
  const hallLaundry = (hr, low, kind = 'laundry') => {                    // (also a powder room: a 6x6 ft half bath at the hall's end, off the hall)
    const vert = hr.y1 - hr.y0 > hr.x1 - hr.x0, a0 = vert ? hr.y0 : hr.x0, a1 = vert ? hr.y1 : hr.x1;
    if (a1 - a0 + 1 < 10) return null;
    const wl = low ? a0 + 2 : a1 - 2, cw0 = low ? a0 : a1 - 1, cw1 = low ? a0 + 1 : a1;
    let lr;
    if (vert) { wallLine(hr.x0, wl, hr.x1, wl); lr = mkRoom(kind, hr.x0, cw0, hr.x1, cw1); door(ri(hr.x0, hr.x1), wl, lr, hr); if (low) hr.y0 = wl + 1; else hr.y1 = wl - 1; }
    else { wallLine(wl, hr.y0, wl, hr.y1); lr = mkRoom(kind, cw0, hr.y0, cw1, hr.y1); door(wl, ri(hr.y0, hr.y1), lr, hr); if (low) hr.x0 = wl + 1; else hr.x1 = wl - 1; }
    avoid.push([Math.min(cw0, wl), Math.max(cw1, wl)]); lr.low = low;
    return lr;
  };
  const okU = u => avoid.every(([a, b]) => u < a || u > b);
  const dOf = k => k === 'master' && Z.name === 'small' ? 4 : ROOMS[k].d;   // a small home's master is 12x14 ft, not 14x16
  const bedLike = k => k === 'master' || k === 'bed' || k === 'kitchen' || k === 'bath' || k === 'powder' || k === 'ens' || k === 'laundry', backD = (k, depth) => clamp(depth - 1 - dOf(k), bedLike(k) ? 2 : 3, 4);   // (a closet or a pantry can be 2 tiles deep)   // how deep the room behind a deep one is
  const effD = (k, depth) => dOf(k) && depth - 1 - dOf(k) >= (bedLike(k) ? 2 : 3) ? depth - 1 - backD(k, depth) : depth;   // how deep the room itself ends up
  let hasDining = pub.some(r => r.k === 'dining'), hasStore = false, hasLaundry = extra.length > 0, hasOffice = split || priv.some(r => r.k === 'office'), hasPantry = pub.some(r => r.k === 'pantry');
  /* A row of rooms side by side along one axis, sharing walls, each touching a door line (a hallway's wall) on one side.
     ax 'x': rooms run along x from u0 to u1, spanning rows v0..v1; door line at row dv (null: none). ax 'y': swapped. */
  const strip = (ax, u0, u1, v0, v1, list, dv, hallR, bk, kind) => {
    if (!list.length) return [];
    const P = (u, v) => ax === 'x' ? [u, v] : [v, u], depth = v1 - v0 + 1, n = list.length, avail = u1 - u0 + 1 - (n - 1);
    if (depth < 3) return null;
        const eff2 = k => k === 'kitchen' && dv === null && effD(k, depth) < 5 ? depth : effD(k, depth), want = list.map(r => r.area / (eff2(r.k) * M2)), sum = want.reduce((a, b) => a + b, 0);
    const len = list.map((r, q) => Math.max(ROOMS[r.k].min[0], Math.round(want[q] / sum * avail)));
    let diff = avail - len.reduce((a, b) => a + b, 0);
    for (let guard = 0; diff !== 0 && guard < 50; guard++) { const q = diff > 0 ? want.indexOf(Math.max(...want)) : len.indexOf(Math.max(...len)); len[q] += Math.sign(diff); diff -= Math.sign(diff); }
    for (let q = 0; q < n; q++) { const mn = ROOMS[list[q].k].min; if (Math.min(len[q], depth) < mn[0] || Math.max(len[q], depth) < mn[1]) return null; }
    if (avoid.length && dv !== null) for (let q = 0, u = u0; q < n; u += len[q] + 1, q++) { let ok = false; for (let k = u; k < u + len[q]; k++) if (okU(k)) ok = true; if (!ok) return null; }   // every room needs a door clear of the closet (checked before anything is built)
    // a room deeper than real rooms get stops there: a wall, and the back becomes a small room off it (walk-in closet, en-suite, pantry, den, a foyer at the front)
    const fwd = dv === null ? (bk === 'hi' ? 1 : -1) : (dv < v0 ? 1 : -1), ensIn = list.some(r => r.k === 'ens');   // +1: the back is at v1
    const sp = list.map((r, q) => {
      const k = r.k, D = ROOMS[k], ln = len[q];
      if (!D.d || effD(k, depth) === depth) return null;
      const ok2 = (c2, b2) => { const m = ROOMS[c2].min; return Math.min(ln, b2) >= m[0] && Math.max(ln, b2) >= m[1]; };
      const bd = backD(k, depth), fd = depth - 1 - bd, ok = c => { const m = ROOMS[c].min; return Math.min(ln, bd) >= m[0] && Math.max(ln, bd) >= m[1]; };
      if (Math.min(ln, fd) < D.min[0] || Math.max(ln, fd) < D.min[1]) return null;
      if (k === 'kitchen' && dv === null && fd < 5) return null;           // an open-plan kitchen keeps its width (a 4-wide one with a pantry beside is a galley, not a great-room kitchen)
      let c = k === 'master' ? (!ensIn ? 'ens' : 'closet') : k === 'bed' ? (chance(0.3) ? 'ens' : 'closet')
        : k === 'ens' ? 'closet' : k === 'kitchen' && wantPantry && !hasPantry ? 'pantry' : k === 'kitchen' && wantNook && !hasNook ? 'nook' : k === 'kitchen' || k === 'bath' ? (!hasLaundry && (kind === 'cross' || hasStore || chance(0.5)) ? 'laundry' : 'storage') : k === 'living' ? (kind === 'cross' ? 'entry' : wantFamily && !hasFamily ? 'family' : hasStore || chance(0.7) ? 'office' : 'storage')
        : k === 'dining' ? (wantFamily && !hasFamily ? 'family' : hasStore || chance(0.7) ? 'office' : 'storage') : 'storage';
      if (!ok(c)) c = (k === 'kitchen' ? (hasPantry ? [] : ['pantry']) : bedLike(k) || k === 'office' ? ['closet'] : hasStore ? ['closet'] : ['storage', 'closet']).find(ok);   // a narrow back room is a linen or coat closet
      if (c === 'office' && (rooms.some(q => q.kind === 'office') || list.some(o => o.k === 'office') || (split && hasOffice))) c = hasStore ? null : 'storage';   // one study (a den here if the study was dropped), one box room
      if (c === 'storage' && hasStore) c = ok('closet') ? 'closet' : null;   // one box room a house
      if (!c) return null;
      if (c === 'storage') hasStore = true; if (c === 'laundry') hasLaundry = true; if (c === 'office') hasOffice = true; if (c === 'pantry') hasPantry = true; if (c === 'family') hasFamily = true; if (c === 'nook') hasNook = true;
      if (c === 'family' && depth - 1 - dOf(k) > bd) { const b2 = Math.min(6, depth - 1 - dOf(k)), f2 = depth - 1 - b2; if (Math.min(ln, b2) >= 4) return { c, f: fwd > 0 ? [v0, v0 + f2 - 1] : [v1 - f2 + 1, v1], b: fwd > 0 ? [v0 + f2 + 1, v1] : [v0, v1 - f2 - 1], w: fwd > 0 ? v0 + f2 : v1 - f2 }; }
      const capT = { storage: 18, laundry: 18, closet: 12, office: 22, nook: 20 }[c];
      if (capT && ln * bd > capT && Math.floor(capT / ln) >= 2 && Math.floor(capT / ln) < bd && ok2(c, Math.floor(capT / ln))) { const b2 = Math.floor(capT / ln), f2 = depth - 1 - b2; return { c, f: fwd > 0 ? [v0, v0 + f2 - 1] : [v1 - f2 + 1, v1], b: fwd > 0 ? [v0 + f2 + 1, v1] : [v0, v1 - f2 - 1], w: fwd > 0 ? v0 + f2 : v1 - f2 }; }   // a room behind kept to a real size
      if (c === 'pantry' && bd > (ln >= 6 ? 2 : 3)) { const b2 = ln >= 6 ? 2 : 3, f2 = depth - 1 - b2; return { c, f: fwd > 0 ? [v0, v0 + f2 - 1] : [v1 - f2 + 1, v1], b: fwd > 0 ? [v0 + f2 + 1, v1] : [v0, v1 - f2 - 1], w: fwd > 0 ? v0 + f2 : v1 - f2 }; }   // a walk-in pantry is at most 3 deep
      // a bedroom whose back is the outside wall keeps it (a bedroom needs a window to escape by, IRC R310): its closet or en-suite goes on the hall side instead,
      // with a one-tile entry beside it from the hallway (as real plans put a closet by the bedroom door)
      const [bi, bj] = P(u0 + Math.floor(len.slice(0, q).reduce((a, b) => a + b + 1, 0) + ln / 2), fwd > 0 ? v1 + 2 : v0 - 2);
      const ends = dv === null ? [] : [0, 1].map(e => { const ub = u0 + len.slice(0, q).reduce((a, b) => a + b + 1, 0); return e ? ub + ln - 1 : ub; }).filter(okU);
      if ((k === 'master' || k === 'bed') && dv !== null && ln >= 4 && ends.length && !(inH[bj] && inH[bj][bi])) {
        if (c === 'ens' && !((ln - 2 >= 2 && bd >= 3) || (ln - 2 >= 3 && bd >= 2))) c = 'closet';   // a 3/4 bath can be 2 deep and 3 long (6x9 ft)          // too tight for a bathroom on the hall side: a closet (a 6x6 ft walk-in at least)
        return { c, front: true, pe: pick(ends), f: fwd > 0 ? [v1 - fd + 1, v1] : [v0, v0 + fd - 1], b: fwd > 0 ? [v0, v0 + bd - 1] : [v1 - bd + 1, v1], w: fwd > 0 ? v0 + bd : v1 - bd };
      }
      return c ? { c, f: fwd > 0 ? [v0, v0 + fd - 1] : [v1 - fd + 1, v1], b: fwd > 0 ? [v0 + fd + 1, v1] : [v0, v1 - fd - 1], w: fwd > 0 ? v0 + fd : v1 - fd } : null;
    });
    for (let q = 0; q < n; q++) {                                        // a bath only 2 wide: the space behind it is the next room's closet (or the kitchen's pantry), its door from there
      const s = sp[q], k = list[q].k;
      if (!s || s.front || (k !== 'bath' && k !== 'powder' && k !== 'ens') || len[q] >= 3) continue;
      let side = 0; for (const d of [-1, 1]) { const o = list[q + d], os = sp[q + d]; if (!side && o && /^(bed|master|office|kitchen|dining|living|laundry|storage|entry)$/.test(o.k) && (!os || os.front)) side = d; }
      if (s.c === 'laundry') hasLaundry = rooms.some(r => r.kind === 'laundry') || list.some(r => r.k === 'laundry');
      if (s.c === 'storage') hasStore = rooms.some(r => r.kind === 'storage') || sp.some((o, q2) => q2 !== q && o && o.c === 'storage');
      if (!side) { sp[q] = null; if (k === 'powder' && depth > 4) list[q].k = hasStore ? 'closet' : (hasStore = true, 'storage'); continue; }   // else the bath keeps its depth (a closet behind it would leave a corridor with a door at each end); a long thin powder room is a hall closet instead
      s.c = list[q + side].k === 'kitchen' && !hasPantry ? 'pantry' : 'closet'; if (s.c === 'pantry') hasPantry = true; s.side = side;
    }
    const out = []; let u = u0;
    for (let q = 0; q < n; q++) {
      const fv = sp[q] ? sp[q].f : [v0, v1], a = u, b = u + len[q] - 1, [x0, y0] = P(a, fv[0]), [x1, y1] = P(b, fv[1]);
      const r = mkRoom(list[q].k, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)); r.ax = ax; r.u0 = a; r.u1 = b; r.vf = fv; out.push(r);
      if (q < n - 1) { const [wx0, wy0] = P(b + 1, v0), [wx1, wy1] = P(b + 1, v1); wallLine(Math.min(wx0, wx1), Math.min(wy0, wy1), Math.max(wx0, wx1), Math.max(wy0, wy1)); }
      u = b + 2;
    }
    for (let q = 0; q < n; q++) {                                         // ways in: a door off the hallway, an opening for open-plan rooms, the en-suite off its bedroom
      const r = out[q], pubK = r.kind === 'living' || r.kind === 'dining' || (r.kind === 'kitchen' && chance(0.6));
      const fs = sp[q];
      if (fs && fs.front) {                                                // hallway → entry → bedroom; the closet (or en-suite) beside the entry, its door from the bedroom
        const pe = fs.pe, wc = pe === r.u0 ? r.u0 + 1 : r.u1 - 1, c0 = pe === r.u0 ? r.u0 + 2 : r.u0, c1 = pe === r.u0 ? r.u1 : r.u1 - 2;
        for (let v = fs.b[0]; v <= fs.b[1]; v++) { const [i, j] = P(wc, v); S[j][i] = '#'; }
        for (let u = r.u0; u <= r.u1; u++) { const [i, j] = P(u, fs.w); S[j][i] = '#'; }
        const [a0, b0] = P(pe, fs.b[0]), [a1, b1] = P(pe, fs.b[1]), vs = mkRoom('vest', Math.min(a0, a1), Math.min(b0, b1), Math.max(a0, a1), Math.max(b0, b1));
        const [e0, f0] = P(c0, fs.b[0]), [e1, f1] = P(c1, fs.b[1]), cl = mkRoom(fs.c, Math.min(e0, e1), Math.min(f0, f1), Math.max(e0, e1), Math.max(f0, f1));
        const [di, dj] = P(pe, dv); door(di, dj, vs, hallR);
        const [oi, oj] = P(pe, fs.w); opening([[oi, oj]], vs, r);
        const [ci, cj] = P(pe === r.u0 ? c1 : c0, fs.w); door(ci, cj, cl, r);
        r.backR = cl; continue;
      }
      const mate = r.kind === 'ens' ? ['master', 'bed'] : r.kind === 'pantry' ? ['kitchen'] : null;   // an en-suite opens off its bedroom, a pantry off the kitchen
      if (mate) { let done = false; for (const d of [-1, 1]) { const o = out[q + d]; if (done || !o || !mate.includes(o.kind)) continue; const f0 = Math.max(r.vf[0], o.vf[0]), f1 = Math.min(r.vf[1], o.vf[1]); if (f1 - f0 < 2) continue; const [i, j] = P(d < 0 ? r.u0 - 1 : r.u1 + 1, ri(f0 + 1, f1 - 1)); door(i, j, r, o); done = true; } if (done) continue; }
      if (dv === null) continue;
      const w = Math.min(3, r.u1 - r.u0 - 1), so = []; if (pubK && r.u1 - r.u0 >= 3) for (let u = r.u0 + 1; u <= r.u1 - w; u++) if (okU(u) && okU(u + w - 1)) so.push(u);
      if (so.length) { const s0 = pick(so); const t = []; for (let k = 0; k < w; k++) t.push(P(s0 + k, dv)); opening(t, r, hallR); }
      else { const e = r.u1 > r.u0 + 1 ? 1 : 0, du = []; for (let u = r.u0 + e; u <= r.u1 - e; u++) if (okU(u)) du.push(u); if (!du.length) for (let u = r.u0; u <= r.u1; u++) if (okU(u)) du.push(u); if (!du.length) return null; const [i, j] = P(pick(du), dv); door(i, j, r, hallR); }
    }
    out.forEach((r, q) => {
      const s = sp[q]; if (!s || s.front) return;
      const [wx0, wy0] = P(r.u0, s.w), [wx1, wy1] = P(r.u1, s.w); wallLine(Math.min(wx0, wx1), Math.min(wy0, wy1), Math.max(wx0, wx1), Math.max(wy0, wy1));
      const [bx0, by0] = P(r.u0, s.b[0]), [bx1, by1] = P(r.u1, s.b[1]), bR = mkRoom(s.c, Math.min(bx0, bx1), Math.min(by0, by1), Math.max(bx0, bx1), Math.max(by0, by1));
      bR.ax = ax; bR.u0 = r.u0; bR.u1 = r.u1; bR.off = r; r.backR = bR;
      const du = r.dt.length ? (ax === 'x' ? r.dt[0][0] : r.dt[0][1]) : (r.u0 + r.u1) / 2, [i, j] = P(du - r.u0 < r.u1 - du ? r.u1 : r.u0, s.w);   // in the corner away from its own door, so the room keeps its floor
      if (s.side) { const [i2, j2] = P(s.side < 0 ? r.u0 - 1 : r.u1 + 1, fwd > 0 ? s.b[1] : s.b[0]); door(i2, j2, bR, out[q + s.side]); bR.off = out[q + s.side]; return; }
      if (s.c === 'entry' || s.c === 'family' || s.c === 'nook' || (r.kind === 'living' && r.u1 - r.u0 >= 4)) { const w = Math.min(2, r.u1 - r.u0 - 1), s0 = ri(r.u0 + 1, r.u1 - w); const t = []; for (let k = 0; k < w; k++) t.push(P(s0 + k, s.w)); opening(t, bR, r); }
      else door(i, j, bR, r);
    });
    return out;
  };
  const stripFit = (ax, u0, u1, v0, v1, list, dv, hallR, fill, bk) => {    // too many rooms for that side? leave the optional ones out until it fits
    const L = list.slice(), depth = v1 - v0 + 1, avail = u1 - u0 + 1;     // too few? rooms don't just stretch: add real ones (another bedroom, an office, storage)
        for (let guard = 0; fill && guard < 5 && L.reduce((a, r) => a + r.area / (effD(r.k, depth) * M2), 0) + L.length - 1 < avail * 0.75; guard++) {
      const opts = fill.filter(c => !(c === 'dining' && (hasDining || L.some(r => r.k === 'dining'))) && !(c === 'office' && (hasOffice || L.some(r => r.k === 'office'))) && !(c === 'storage' && hasStore)); if (!opts.length) break;
      const k = pick(opts); if (k === 'dining') hasDining = true; if (k === 'storage') hasStore = true; if (k === 'office') hasOffice = true;
      const D = ROOMS[k], lq = L.findIndex(r => r.k === 'living'); const mq = L.findIndex(r => r.must); L.splice(k === 'dining' && lq >= 0 ? lq : ri(0, mq >= 0 ? mq : L.length), 0, { k, area: D.a[0] + R() * (D.a[1] - D.a[0]) });   // a dining room sits next to the living room
    }
    for (;;) {
      const out = strip(ax, u0, u1, v0, v1, L, dv, hallR, bk, plan);
      if (out) return out;
      let q = -1; for (const k of ['storage', 'powder', 'office', 'dining', 'entry', 'pantry', 'bed', 'laundry', 'ens']) { q = L.map(r => r.must || (r.k === 'bed' && L.filter(o => o.k === 'bed').length < 2) ? '' : r.k).lastIndexOf(k); if (q >= 0) break; }   // least common rooms first (NAHB incidence); never the last spare bedroom
      if (q < 0) return null;
      L.splice(q, 1);
    }
  };
  const ix0 = hx0 + 1, ix1 = hx1 - 1, iy0 = hy0 + 1, iy1 = hy1 - 1;
  let frontDoor = null, backDoor = null, hall = null;
  const fail = () => null;
  if (plan === 'center' || plan === 'cross') {
    box(hx0, hy0, hx1, hy1);
    const ax = plan === 'center' ? 'y' : 'x';                               // rooms run along the hallway
    const U0 = ax === 'y' ? iy0 : ix0, U1 = ax === 'y' ? iy1 : ix1, V0 = ax === 'y' ? ix0 : iy0, V1 = ax === 'y' ? ix1 : iy1;
    let A, B;                                                              // A: below the hallway (left / back), B: above it (right / front)
    if (ax === 'y') { const pubLeft = garage ? gLeft : chance(0.5), oq = priv.findIndex(r => r.k === 'office'), pu = oq >= 0 ? pub.concat(priv.splice(oq, 1)) : pub, pv = priv.concat(extra.filter(e => e.k === 'laundry')); A = pubLeft ? pu : pv; B = pubLeft ? pv : pu; }   // the study at the front by the foyer, the laundry by the bedrooms
    else { const dn = pub.find(r => r.k === 'dining'), lvR = pub.find(r => r.k === 'living'), front = dn ? [dn, lvR] : [lvR, priv[priv.length - 1]].filter(Boolean); if (wantEntry) front.splice(1, 0, { k: 'entry', area: ROOMS.entry.a[0] + R() * 4 });   // like a centre-hall colonial: the foyer between the living and dining rooms
      const back = pub.filter(r => r !== lvR && r !== dn).concat(dn ? priv : priv.slice(0, -1), extra.filter(e => e.k === 'laundry')); A = back; B = front; if (chance(0.5)) { A.reverse(); B.reverse(); } }
    const aA = A.reduce((a, r) => a + r.area, 0), aB = B.reduce((a, r) => a + r.area, 0), span = V1 - V0 + 1 - 2 - hwd;   // the hallway sits where the two sides get their share
    const wA = clamp(Math.round(span * aA / (aA + aB)) + ri(-1, 1), ax === 'x' ? 4 : 3, span - (ax === 'x' ? 5 : 3)), c = V0 + wA + 1;   // a cross plan's front row is at least a living room deep (16 ft)
    const P = (u, v) => ax === 'x' ? [u, v] : [v, u];
    for (const v of [c - 1, c + hwd]) for (let u = U0; u <= U1; u++) { const [i, j] = P(u, v); S[j][i] = '#'; }
    const [hx0_, hy0_] = P(U0, c), [hx1_, hy1_] = P(U1, c + hwd - 1); hall = mkRoom('hall', Math.min(hx0_, hx1_), Math.min(hy0_, hy1_), Math.max(hx0_, hx1_), Math.max(hy0_, hy1_));
    avoid = []; let hl = null, hp = null;
    if (extra.length && !extra[0].must) { hl = hallLaundry(hall, ax === 'y' ? true : chance(0.5)); if (hl) for (const L of [A, B]) { const q = L.findIndex(r => r.k === 'laundry'); if (q >= 0) L.splice(q, 1); } }   // a laundry closet at the hallway's dead end
    if (ax === 'y' && hl) { const pv = A.some(r => r.k === 'living') ? B : A, pu = pv === A ? B : A, q = pv.findIndex(r => r.k === 'powder'); if (q >= 0) { const pw = pv.splice(q, 1)[0], lq = pu.findIndex(r => r.k === 'living'); pu.splice(lq >= 0 ? lq : pu.length, 0, pw); } }   // a centre-hall home's powder room on the living side, between dining and living, for guests
    if (hwd > 1 && A.concat(B).some(r => r.k === 'powder') && (ax === 'x' || !hl)) { hp = hallLaundry(hall, ax === 'y' ? true : hl ? !hl.low : chance(0.5), 'powder'); if (hp) for (const L of [A, B]) { const q = L.findIndex(r => r.k === 'powder'); if (q >= 0) L.splice(q, 1); } }   // a powder room at the other (or the back) end
    const fillOf = L => L.some(r => r.k === 'living') ? ['dining', 'office', 'storage'] : ['bed', 'bed', 'bed', 'office', 'bath', 'storage'];
    const ra = stripFit(ax, U0, U1, V0, c - 2, A, c - 1, hall, fillOf(A)), rb = stripFit(ax, U0, U1, c + hwd + 1, V1, B, c + hwd, hall, fillOf(B));
    avoid = [];
    if (!ra || !rb) return fail();
    if (ax === 'y') {
      let fr = hall;
      if (wantEntry && hall.y1 - hall.y0 >= 8) { hall.y1 -= 3; fr = mkRoom('entry', hall.x0, hall.y1 + 1, hall.x1, hall.y1 + 3); }   // the front of the hallway is the entry foyer
      const kt = rooms.find(r => r.kind === 'kitchen' && r.y0 === iy0);    // out the back through the kitchen, or through the laundry like a mudroom
      frontDoor = [c + ri(0, hwd - 1), hy1, fr]; backDoor = kt ? [ri(kt.x0 + 1, kt.x1 - 1), hy0, kt] : hl ? [ri(hl.x0, hl.x1), hy0, hl] : hp ? null : [c + ri(0, hwd - 1), hy0, hall];
    }
    else { const lv = rooms.find(r => r.kind === 'living'), kt = rooms.find(r => r.kind === 'kitchen'); const en = rooms.find(r => r.kind === 'entry' && r.y1 === iy1), fr = en || (lv.y1 === iy1 ? lv : lv.backR), kb = kt && (kt.y0 === iy0 ? kt : kt.backR); frontDoor = [ri(fr.x0 + 1, fr.x1 - 1), hy1, fr]; backDoor = kb && kb.y0 === iy0 ? [ri(kb.x0 + 1, kb.x1 - 1), hy0, kb] : null; }
  } else {                                                                 // side hall and wing: an open-plan block and a bedroom block
    const wing = plan === 'wing', pubLeft = garage ? !gLeft : chance(0.5);  // the bedroom block on the garage side: in from the garage through the laundry
    let pubW = clamp(Math.round(hw * (0.42 + R() * 0.12)), 9, hw - 9), mw = 0;
    let px0 = pubLeft ? hx0 : hx1 - pubW + 1, px1 = pubLeft ? hx0 + pubW - 1 : hx1;        // the public block (walls included)
    let qx0 = pubLeft ? px1 : hx0, qx1 = pubLeft ? hx1 : px0;                              // the private block shares the wall
    let mx0 = 0, mx1 = 0;
    if (split) {                                                           // split plan: master suite | great room | bedrooms, side by side
      const rest = hw - 7; mw = clamp(Math.round(rest * 0.3), 6, 7); let rd = clamp(Math.round(rest * 0.27), 4, 6), pi = rest - mw - rd;
      while (pi < 7 && rd > 4) { rd--; pi++; } while (pi > 9 && rd < 6) { rd++; pi--; }
      if (pi < 7) return fail();
      if (pubLeft) { mx0 = hx0; mx1 = hx0 + mw + 1; px0 = mx1; px1 = px0 + pi + 1; qx0 = px1; qx1 = hx1; }
      else { qx0 = hx0; qx1 = hx0 + rd + 4; px0 = qx1; px1 = px0 + pi + 1; mx0 = px1; mx1 = hx1; }
    }
    const qy1 = wing ? hy1 - ri(3, 5) : hy1;                                                // a wing is set back from the front: an L
    if (qy1 - hy0 < 8) return fail();
    box(px0, hy0, px1, hy1); box(qx0, hy0, qx1, qy1); if (split) box(mx0, hy0, mx1, hy1);
    for (let j = hy0; j <= Math.max(hy1, qy1); j++) { const sx = pubLeft ? px1 : px0; S[j][sx] = '#'; if (split) S[j][pubLeft ? px0 : px1] = '#'; }
    // public block: kitchen (and dining) behind, living at the front, wide openings between
    const pl = pub, ax0 = px0 + 1, ax1 = px1 - 1, rp = stripFit('y', hy0 + 1, hy1 - 1, ax0, ax1, pl, null, null, pl.some(r => r.k === 'dining') ? null : ['dining'], pubLeft === !split ? 'lo' : 'hi');   // rooms behind deep ones go on the outer wall (in a split plan, the bedroom-hall side: the master wing needs the wall)
    if (!rp) return fail();
    for (let q = 0; q < rp.length - 1; q++) {                              // open plan: the kitchen, dining and living areas run into each other, short wall stubs between
      const a = rp[q], b = rp[q + 1], wj = a.y1 + 1, x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), wd = x1 - x0 + 1, w = Math.max(3, wd - ri(1, 3)), s0 = ri(x0, x1 - w + 1);
      const t = []; for (let k = 0; k < w; k++) t.push([s0 + k, wj]); opening(t, a, b);
    }
    // private block: a hallway along the shared wall, rooms off it
    const hc = pubLeft ? qx0 + 1 : qx1 - hwd, bx0 = pubLeft ? hc + hwd + 1 : qx0 + 1, bx1 = pubLeft ? qx1 - 1 : hc - 2;
    for (let j = hy0 + 1; j <= qy1 - 1; j++) S[j][pubLeft ? hc + hwd : hc - 1] = '#';
    hall = mkRoom('hall', hc, hy0 + 1, hc + hwd - 1, qy1 - 1);
    avoid = []; let pv2 = priv.concat(extra.filter(e => e.k === 'laundry'));
    if (garage) pv2 = pv2.filter(r => r.k !== 'bath' && r.k !== 'powder' && r.k !== 'laundry').concat(pv2.filter(r => r.k === 'bath' || r.k === 'powder'), pv2.filter(r => r.k === 'laundry'));   // by the garage (no windows there): the hall bath and powder room next to the mudroom, not a bedroom
    if (extra.length && !extra[0].must && hallLaundry(hall, true)) pv2 = pv2.filter(r => r.k !== 'laundry');   // a laundry closet at the bedroom hall's back end
    if (wantPantry && !hasPantry && !avoid.length && hall.y1 - hall.y0 >= 9) {   // else a walk-in pantry there, its door from the kitchen through the wall (the hall's dead end backs onto the kitchen)
      const kt0 = rp[0], sxw = pubLeft ? px1 : px0, nx = pubLeft ? px1 - 1 : px0 + 1;
      if (kt0.kind === 'kitchen' && nx >= kt0.x0 && nx <= kt0.x1 && kt0.y0 <= hall.y0 && kt0.y1 >= hall.y0 + 1) {
        const wl = hall.y0 + 2; wallLine(hall.x0, wl, hall.x1, wl);
        const pr = mkRoom('pantry', hall.x0, hall.y0, hall.x1, hall.y0 + 1); door(sxw, hall.y0 + ri(0, 1), pr, kt0);
        avoid.push([hall.y0, wl]); hall.y0 = wl + 1; hasPantry = true;
      }
    }
    if (hwd > 1 && pv2.some(r => r.k === 'powder') && !avoid.length && hallLaundry(hall, true, 'powder')) pv2 = pv2.filter(r => r.k !== 'powder');   // else the powder room there
    const rq = stripFit('y', hy0 + 1, qy1 - 1, Math.min(bx0, bx1), Math.max(bx0, bx1), pv2, pubLeft ? hc + hwd : hc - 1, hall, ['bed', 'bed', 'bed', 'office', 'bath', 'storage']);
    avoid = [];
    if (!rq) return fail();
    const lv = rp[rp.length - 1], span = r => [Math.max(r.y0 + 1, hall.y0 + 1), Math.min(r.y1 - 2, hall.y1 - 2)];   // within the hallway (not the laundry closet carved off its end)
    const or = rp.slice().reverse().find(r => span(r)[0] <= span(r)[1]);  // the hallway opens onto the living room (or the dining room, if the wing stops short of it)
    if (!or) return fail();
    const [oa, ob] = span(or), oj = ri(oa, ob);
    opening([[pubLeft ? px1 : px0, oj], [pubLeft ? px1 : px0, oj + 1]], or, hall);
    frontDoor = [ri(lv.x0 + 1, lv.x1 - 1), hy1, lv];
    const kt = rp[0]; backDoor = [ri(kt.x0 + 1, kt.x1 - 1), hy0, kt];
    if (split) {                                                           // the master suite: bedroom at the back, en-suite and walk-in closet, a study at the front
      const i0 = mx0 + 1, i1 = mx1 - 1, sx = pubLeft ? mx1 : mx0, md = clamp(Math.max(ri(5, 6), rp.length > 1 ? rp[1].y0 - hy0 + 1 : 0), 5, 7), y1m = hy0 + md, wy1 = y1m + 1;   // deep enough to reach past the kitchen: the master door opens off the dining area
      let sd = 3, wy2 = wy1 + sd + 1; const fr = hy1 - 1 - wy2;
      if (fr < 3) { sd += fr + 1; wy2 = hy1; }
      wallLine(i0, wy1, i1, wy1); if (wy2 < hy1) wallLine(i0, wy2, i1, wy2);
      const ms = mkRoom('master', i0, hy0 + 1, i1, y1m);
      const ew = mw >= 7 && chance(0.5) ? 4 : 3, ensOut = chance(0.5);      // the en-suite on the outer wall (a window) or by the great room
      const ex0 = ensOut === pubLeft ? i0 : i1 - ew + 1, ex1 = ex0 + ew - 1, cx0 = ex0 === i0 ? ex1 + 2 : i0, cx1 = ex0 === i0 ? i1 : ex0 - 2, wx = ex0 === i0 ? ex1 + 1 : ex0 - 1;
      wallLine(wx, wy1 + 1, wx, wy1 + sd);
      const en = mkRoom('ens', ex0, wy1 + 1, ex1, wy1 + sd), cl = mkRoom('closet', cx0, wy1 + 1, cx1, wy1 + sd);
      door(ex0 === i0 ? ex1 - 1 : ex0 + 1, wy1, en, ms); door(cx0 === i0 ? cx1 : cx0, wy1, cl, ms);
      const nx = pubLeft ? sx + 1 : sx - 1, by = j => rooms.find(q => nx >= q.x0 && nx <= q.x1 && j >= q.y0 && j <= q.y1 && /^(kitchen|dining|living)$/.test(q.kind));   // the room really on the other side of the wall
      const mj = [], ofj = [];
      for (let j = hy0 + 2; j <= y1m; j++) { const q = by(j); if (q) mj.push([j, q]); }
      if (!mj.length) return fail();
      const pref = mj.filter(([, q]) => q.kind !== 'kitchen'), [dj, dq] = pick(pref.length ? pref : mj);   // in off the dining or living area, not the kitchen if it can be helped
      door(sx, dj, ms, dq);
      if (wy2 < hy1) {                                                     // the front: a foyer by the great room with a study off it (a guest room if the bedroom side lost one)
        const fr2 = hy1 - 1 - wy2, lost = priv.filter(r => r.k === 'bed').length > rq.filter(r => r.kind === 'bed').length;
        const k2 = lost && fr2 >= 4 && mw >= 7 ? 'bed' : fr2 >= 4 ? 'office' : 'powder', sw = k2 === 'bed' ? 4 : k2 === 'office' ? 3 : 2, fw = mw - 1 - sw;
        const fj = []; for (let j = wy2 + 1; j <= hy1 - 3; j++) if (by(j) && by(j + 1)) fj.push(j);
        if (wantEntry && fw >= 2 && fj.length) {
          const fx0 = pubLeft ? i1 - fw + 1 : i0, fx1 = fx0 + fw - 1, ox0 = pubLeft ? i0 : fx1 + 2, ox1 = ox0 + sw - 1, wx2 = pubLeft ? fx0 - 1 : fx1 + 1;
          wallLine(wx2, wy2 + 1, wx2, hy1 - 1);
          const fo = mkRoom('entry', fx0, wy2 + 1, fx1, hy1 - 1), o2 = mkRoom(k2, ox0, wy2 + 1, ox1, hy1 - 1);
          door(wx2, fr2 >= 3 ? ri(wy2 + 2, hy1 - 2) : wy2 + 1, o2, fo);
          const oj = pick(fj); opening([[sx, oj], [sx, oj + 1]], fo, by(oj));   // the foyer opens onto the great room
          frontDoor = [ri(fx0, fx1), hy1, fo];
        } else {
          const of = mkRoom(k2 === 'bed' ? 'bed' : 'office', i0, wy2 + 1, i1, hy1 - 1);
          for (let j = wy2 + 2; j <= hy1 - 2; j++) { const q = by(j); if (q) ofj.push([j, q]); }
          if (!ofj.length) return fail();
          const [oj2, oq] = pick(ofj); door(sx, oj2, of, oq);
        }
      }
    }
    if (wantEntry && !rooms.some(r => r.kind === 'entry') && hall.y1 - hall.y0 >= 8) {   // in through a foyer at the front of the bedroom hall (in an L, at its inside corner); it may open onto the living room too
      hall.y1 -= 3; const fo = mkRoom('entry', hall.x0, hall.y1 + 1, hall.x1, hall.y1 + 3); frontDoor = [ri(fo.x0, fo.x1), fo.y1 + 1, fo];
    }
  }
  // attached garage on one side, front-aligned, a door into the house and an open garage door to the drive
  let gar = null;
  if (garage) {
    const gx0 = gLeft ? hx0 - 7 : hx1, gx1 = gLeft ? hx0 : hx1 + 7, gy0 = hy1 - 8;
    if (gx0 >= 1 && gx1 <= W - 2 && gy0 > hy0) {
      for (let j = gy0; j <= hy1; j++) for (let i = gx0; i <= gx1; i++) if (!(i === (gLeft ? gx1 : gx0))) { inH[j][i] = true; S[j][i] = j === gy0 || j === hy1 || i === gx0 || i === gx1 ? '#' : '.'; }
      gar = mkRoom('garage', gx0 + 1, gy0 + 1, gx1 - 1, hy1 - 1);
      const sx = gLeft ? gx1 : gx0, nx = gLeft ? sx + 1 : sx - 1, cand = [];
      const GIN = ['laundry', 'storage', 'hall', 'entry', 'kitchen', 'dining', 'office', 'living'];   // in through a mudroom or a hallway, never into a bedroom or a bathroom
      for (let j = gy0 + 2; j <= hy1 - 2; j++) { const r = rooms.find(q => q !== gar && nx >= q.x0 && nx <= q.x1 && j >= q.y0 && j <= q.y1); if (r && GIN.includes(r.kind)) cand.push([j, r]); }
      if (cand.length) { const best = Math.min(...cand.map(([, r]) => GIN.indexOf(r.kind))), c2 = cand.filter(([, r]) => GIN.indexOf(r.kind) === best), [j, r] = pick(c2); door(sx, j, gar, r); }
      const gd = []; for (let i = gar.x0 + 1; i <= gar.x1 - 1; i++) gd.push([i, hy1]);
      if (!safe) opening(gd, gar, null);                                  // (the safe house's armory keeps its roller door shut)
      for (let j = hy1 + 1; j <= 22; j++) for (let i = gar.x0; i <= gar.x1; i++) F[j][i] = 's';   // the drive
    } else return fail();
  }
  if (!frontDoor) return fail();
  const [fd, fy, fr] = frontDoor; door(fd, fy, fr, null, true);
  if (backDoor) door(backDoor[0], backDoor[1], backDoor[2], null, true);
  const bd = backDoor ? backDoor[0] : null;
  for (let j = fy + 1; j <= 22; j++) F[j][fd] = 's';                    // the path to the pavement, a porch, a back step
  for (let i = fd - 1; i <= fd + 1; i++) if (!inH[fy + 1][i]) F[fy + 1][i] = 's';
  if (backDoor) for (let i = bd - 1; i <= bd + 1; i++) if (!inH[backDoor[1] - 1][i]) F[backDoor[1] - 1][i] = 's';
  // nothing goes in front of a door or an opening (both sides)
  const keep = [], props = [], decals = [], fixtures = [], spots = [];
  // an opening (no leaf) needs only a walkway through it: a wide one keeps 2 tiles in its middle clear, a metre deep each side, and a sofa's back can stand along the rest
  const openK = [], oseen = new Set(), isOpen = (i, j) => open.some(([a, b]) => a === i && b === j);
  for (const [i, j] of open) {
    if (oseen.has(j * W + i)) continue;
    const horiz = isOpen(i + 1, j) || isOpen(i - 1, j), run = []; let a = i, b = j;
    while (isOpen(horiz ? a - 1 : a, horiz ? b : b - 1)) { if (horiz) a--; else b--; }
    while (isOpen(a, b)) { run.push([a, b]); oseen.add(b * W + a); if (horiz) a++; else b++; }
    const mid = run.length >= 4 ? run.slice(Math.floor(run.length / 2) - 1, Math.floor(run.length / 2) + 1) : run;
    for (const t of mid) openK.push(t);
  }
  for (const [i, j] of doors.map(d => [d[0], d[1]]).concat(openK)) {     // the way through and the leaf's swing; furniture can stand against the wall beside it, as in real rooms
    const thruY = S[j - 1] && S[j + 1] && S[j - 1][i] !== '#' && S[j + 1][i] !== '#' && S[j - 1][i] !== 'G' && S[j + 1][i] !== 'G';
    const SMALLK = /^(bath|ens|powder|laundry|pantry|closet|storage|vest)$/, kindAt = (a, b) => { const r = rooms.find(q => a >= q.x0 && a <= q.x1 && b >= q.y0 && b <= q.y1); return r ? r.kind : ''; };
    const op = !doors.some(d => d[0] === i && d[1] === j), deep = op ? 1.1 : 1.5;   // no leaf to swing in an opening
    const dA = SMALLK.test(thruY ? kindAt(i, j - 1) : kindAt(i - 1, j)) ? 0.9 : deep, dB = SMALLK.test(thruY ? kindAt(i, j + 1) : kindAt(i + 1, j)) ? 0.9 : deep;   // a bathroom or closet door needs only its swing: the fixtures stand beside it, as in real ones
    keep.push(thruY ? [(i - 0.6) * T, (j - dA) * T, 2.2 * T, (1 + dA + dB) * T, op] : [(i - dA) * T, (j - 0.6) * T, (1 + dA + dB) * T, 2.2 * T, op]);
  }
  // windows: runs of plain outside wall between two rooms' worth of wall, clear of corners, doors and the hallway
  const isW = (i, j) => i >= 0 && j >= 0 && i < W && j < H && S[j][i] === '#';
  const winOK = (i, j, nx, ny, ax, ay) => isW(i, j) && inH[j][i] && !inH[j - ny] ?.[i - nx] && S[j + ny] && S[j + ny][i + nx] === '.' && inH[j + ny][i + nx] && F[j + ny][i + nx] !== 'w' && F[j + ny][i + nx] !== 'z'
    && isW(i + ax, j + ay) && isW(i - ax, j - ay) && !isW(i + nx + ax, j + ny + ay) && !isW(i + nx - ax, j + ny - ay);
  for (const [nx, ny, ax, ay] of [[0, 1, 1, 0], [0, -1, 1, 0], [1, 0, 0, 1], [-1, 0, 0, 1]]) {
    const seen = new Set();
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      if (seen.has(j * W + i) || !winOK(i, j, nx, ny, ax, ay)) continue;
      const run = []; let a = i, b = j; while (winOK(a, b, nx, ny, ax, ay)) { run.push([a, b]); seen.add(b * W + a); a += ax; b += ay; }
      if (run.length >= 2) { const wl = Math.min(run.length, run.length >= 5 ? 3 : 2), st = Math.floor((run.length - wl) / 2); for (let z = st; z < st + wl; z++) S[run[z][1]][run[z][0]] = 'G'; }
    }
  }
  // ---- furniture: boxes in px, refused where they'd overlap a wall, a doorway's clearance or each other
  const placed = [];
  const fits = (cx, cy, w, h, host) => {                                 // a chair may stand right up against its own table or desk (`host`), anything else keeps 4 px off; being light, it may stand in an opening's walkway (not a door's swing)
    const x = cx - w / 2, y = cy - h / 2;
    for (let j = Math.floor(y / T); j <= Math.floor((y + h - 0.01) / T); j++) for (let i = Math.floor(x / T); i <= Math.floor((x + w - 0.01) / T); i++) if (!S[j] || S[j][i] !== '.') return false;
    for (const [kx, ky, kw, kh, op] of keep) if (!(op && host) && x < kx + kw && x + w > kx && y < ky + kh && y + h > ky) return false;
    for (const q of placed) { const [qx, qy, qw, qh] = q, g = q === host ? 0.5 : 4; if (x < qx + qw + g && x + w + g > qx && y < qy + qh + g && y + h + g > qy) return false; }
    return true;
  };
  const put = (c, cx, cy, w, h, ex, host) => { if (!fits(cx, cy, w, h, host)) return false; placed.push([cx - w / 2, cy - h / 2, w, h, c, top.length]); props.push([c, cx, cy, w, h, ex]); return true; };
  const unput = n0 => { while (props.length > n0) { props.pop(); const pc = placed.pop(); top.length = pc[5]; } };
  /* A furnished room must still connect all its doorways (tiles; heavy furniture blocks, as in the final check): if not, the last pieces come back out. */
  const roomOK = r => {
    if (!r.dt.length) return true;
    const blk = (i, j) => S[j][i] !== '.' || placed.some(([x, y, w, h, c]) => !LIGHT_PROPS.has(c) && x + 4 < (i + 1) * T && x + w - 4 > i * T && y + 4 < (j + 1) * T && y + h - 4 > j * T);
    const inR = (i, j) => (i >= r.x0 && i <= r.x1 && j >= r.y0 && j <= r.y1) || r.dt.some(([a, b]) => a === i && b === j);
    const seen = new Set([r.dt[0][1] * W + r.dt[0][0]]), q = [r.dt[0]];
    while (q.length) { const [i, j] = q.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + b, k = nj * W + ni; if (seen.has(k) || !inR(ni, nj) || blk(ni, nj)) continue; seen.add(k); q.push([ni, nj]); } }
    if (!r.dt.every(([i, j]) => seen.has(j * W + i))) return false;
    // and no clear floor sealed off where a body can't squeeze between pieces (8 px grid, a 13.5 px body, as the game moves you)
    const G = 8, BR = 14, bx0 = X0(r), by0 = Y0(r), nx = (X1(r) - bx0) / G, ny = (Y1(r) - by0) / G;
    const hv = placed.filter(([x, y, w, h, c]) => !LIGHT_PROPS.has(c) && x < X1(r) + BR && x + w > bx0 - BR && y < Y1(r) + BR && y + h > by0 - BR);
    const free = (px, py) => { for (let j = Math.floor((py - BR) / T); j <= Math.floor((py + BR) / T); j++) for (let i = Math.floor((px - BR) / T); i <= Math.floor((px + BR) / T); i++) if (S[j][i] !== '.') return false;
      for (const [x, y, w, h] of hv) if (px > x - BR && px < x + w + BR && py > y - BR && py < y + h + BR) return false; return true; };
    const ok = new Uint8Array(nx * ny), got = new Uint8Array(nx * ny), q2 = [];
    for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) ok[b * nx + a] = free(bx0 + (a + 0.5) * G, by0 + (b + 0.5) * G) ? 1 : 0;
    for (const [i, j] of r.dt) { const a = Math.max(0, Math.min(nx - 1, Math.floor(((i + 0.5) * T - bx0) / G))), b = Math.max(0, Math.min(ny - 1, Math.floor(((j + 0.5) * T - by0) / G)));
      for (let b2 = Math.max(0, b - 4); b2 <= Math.min(ny - 1, b + 4); b2++) for (let a2 = Math.max(0, a - 4); a2 <= Math.min(nx - 1, a + 4); a2++) if (ok[b2 * nx + a2] && !got[b2 * nx + a2]) { got[b2 * nx + a2] = 1; q2.push(b2 * nx + a2); } }
    if (!q2.length) return true;
    while (q2.length) { const c = q2.pop(), a = c % nx, b = (c / nx) | 0; for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = a + da, b2 = b + db, n = b2 * nx + a2; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= ny || got[n] || !ok[n]) continue; got[n] = 1; q2.push(n); } }
    let lost = 0; for (let n = 0; n < nx * ny; n++) if (ok[n] && !got[n]) lost++;
    return lost < 30;
  };
  const fixRoom = (r, n0) => { while (props.length > n0 && !roomOK(r)) unput(props.length - 1); };
  const X0 = r => r.x0 * T, X1 = r => (r.x1 + 1) * T, Y0 = r => r.y0 * T, Y1 = r => (r.y1 + 1) * T;
  // walls of a room: 0 top, 1 right, 2 bottom, 3 left. `at` is a point `a` along the wall, `o` in from it.
  const wlen = (r, sd) => sd % 2 ? Y1(r) - Y0(r) : X1(r) - X0(r), wdep = (r, sd) => sd % 2 ? X1(r) - X0(r) : Y1(r) - Y0(r);
  const at = (r, sd, a, o) => sd === 0 ? [X0(r) + a, Y0(r) + o] : sd === 2 ? [X0(r) + a, Y1(r) - o] : sd === 1 ? [X1(r) - o, Y0(r) + a] : [X0(r) + o, Y0(r) + a];
  const turn = (sd, dx, dy) => { for (let k = 0; k < sd; k++) [dx, dy] = [-dy, dx]; return [dx, dy]; };   // a local offset (x along, y out from the wall) into the world
  const wallInfo = (r, sd) => {                                          // how many doorway and window tiles are on that wall
    let d = 0, wnd = 0;
    const L = sd % 2 ? [r.y0, r.y1] : [r.x0, r.x1], line = sd === 0 ? r.y0 - 1 : sd === 2 ? r.y1 + 1 : sd === 1 ? r.x1 + 1 : r.x0 - 1;
    for (let k = L[0]; k <= L[1]; k++) { const [i, j] = sd % 2 ? [line, k] : [k, line]; if (S[j][i] === '.') d++; else if (S[j][i] === 'G') wnd++; }
    return { d, wnd };
  };
  const wallSc = (r, sd, noWin) => { const w = wallInfo(r, sd); return wlen(r, sd) - w.d * 400 - (noWin ? w.wnd * 60 : 0); };
  const bestWalls = (r, noWin) => [0, 1, 2, 3].map(sd => ({ sd, sc: wallSc(r, sd, noWin) + R() * 20 })).sort((a, b) => b.sc - a.sc).map(o => o.sd);
  /* Tall pieces and the TV don't stand in front of a window (nobody blocks their window with a wardrobe): `winBehind` looks at the wall right behind a piece's back. */
  const NOWIN = new Set(['ward', 'shelf', 'cab', 'fridge', 'tv', 'boxes']); let anyWin = false;
  const winBehind = (r, sd, x, y, w, h) => {
    const line = sd === 0 ? r.y0 - 1 : sd === 2 ? r.y1 + 1 : sd === 1 ? r.x1 + 1 : r.x0 - 1, lo = sd % 2 ? y - h / 2 : x - w / 2, hi = sd % 2 ? y + h / 2 : x + w / 2;
    for (let q = Math.floor((lo + 2) / T); q <= Math.floor((hi - 2) / T); q++) { const c = sd % 2 ? S[q] && S[q][line] : S[line] && S[line][q]; if (c === 'G' || c === 'g') return true; }
    return false;
  };
  /* Stand a piece against wall sd: real size `dim` [along, deep] in cm, at a point along it (tries spots if a is null). */
  const against = (c, r, sd, dim, a, o, ex, face) => {
    const cw = cm(dim[0]), ch = cm(dim[1]), L = wlen(r, sd), w = sd % 2 ? ch : cw, h = sd % 2 ? cw : ch;
    const tryA = aa => { const [x, y] = at(r, sd, aa, (o || 0) + ch / 2); if (NOWIN.has(c) && !anyWin && (o || 0) < 12 && winBehind(r, sd, x, y, w, h)) return null;
      return put(c, x, y, w, h, Object.assign(face === null ? {} : { face: face === undefined ? sd : face }, ex || {})) ? { x, y, a: aa, q: placed[placed.length - 1] } : null; };
    if (a !== null && a !== undefined) return a >= cw / 2 && a <= L - cw / 2 ? tryA(a) : null;   // only along this room's own wall (past its end is the next room)
    const as = []; for (let aa = cw / 2 + 3; aa <= L - cw / 2 - 3; aa += 6) as.push(aa);
    for (let n = as.length - 1; n > 0; n--) { const m = Math.floor(R() * (n + 1)); [as[n], as[m]] = [as[m], as[n]]; }
    for (const aa of as) { const p = tryA(aa); if (p) return p; }
    return null;
  };
  const anyWall = (c, r, dim, ex, walls, o, face) => { for (const sd of walls || bestWalls(r)) { const p = against(c, r, sd, dim, null, o, ex, face); if (p) return Object.assign(p, { sd }); } return null; };
  const lamp = (r, k) => ({ light: { r, col: [255, 206, 150], k } });
  // this house's own colours, and the small things lying about (on furniture: `top`; on the floor: `clutter`)
  const SOFA = ['#86495b', '#4a5a6a', '#6a6a5a', '#3e5a4a', '#8a7a64', '#2e3a4e', '#7a4a3a', '#5a5e66'], DUVET = ['#3e4c6a', '#8a3a3a', '#e2dccf', '#4a6a5a', '#6a5a7a', '#c8a24a', '#5a6a7a', '#3a3a40'];
  const RUGS = [['#3e4a3a', '#a8a07a'], ['#4a3e34', '#c8a87a'], ['#3a4450', '#9ab0c0'], ['#6a3a3a', '#d8c090'], ['#2e3a4e', '#c8c0a8'], ['#5a5a5a', '#e8e0d0'], ['#7a6a4a', '#3a2e22']];
  const PATS = ['plain', 'medal', 'stripe', 'round'], CLOTH = ['#3a5a8a', '#a83a32', '#e8e4dc', '#2a2a30', '#5a8a5a', '#c8a24a', '#7a4a8a', '#6e7076'];
  const sofaCol = pick(SOFA), pet = chance(0.35), kids = nb >= 2 && chance(0.45), top = [], clutter = [];
  const on = (t, x, y, a, col) => top.push([t, x, y, a === undefined ? (R() - 0.5) * 0.9 : a, col]);
  const onP = (p, sd, dx, dy, t, a, col) => { const [ox, oy] = turn(sd, dx, dy); on(t, p.x + ox, p.y + oy, a === undefined ? undefined : a + sd * Math.PI / 2, col); };   // on a piece, at a local offset
  const floorFree = (x, y, rad) => { const i = Math.floor(x / T), j = Math.floor(y / T); if (!S[j] || S[j][i] !== '.') return false; return !placed.some(([qx, qy, qw, qh]) => x > qx - rad && x < qx + qw + rad && y > qy - rad && y < qy + qh + rad); };
  const drop = (t, rad, r, col) => { for (let n = 0; n < 14; n++) { const x = X0(r) + rad + R() * (X1(r) - X0(r) - rad * 2), y = Y0(r) + rad + R() * (Y1(r) - Y0(r) - rad * 2); if (floorFree(x, y, rad)) { clutter.push([t, x, y, R() * 6.28, col]); return true; } } return false; };
  const rugAt = (x, y, w, h, pat) => { const [b, e] = pick(RUGS); decals.push([x - w / 2, y - h / 2, w, h, b, e, pat || pick(PATS)]); };
  const fixture = (kind, r, sd, a, len, dep, rad, col, k) => {           // a light on a wall (hood, mirror bar)
    const [x, y] = at(r, sd, a, 3), [lx, ly] = at(r, sd, a, 0.6 * T), [w, h] = sd % 2 ? [dep, len] : [len, dep];
    fixtures.push([kind, x, y, w, h, lx, ly, rad, col, k, 2]);
  };
  let eatIn = false;
  /* Chairs pulled up to a table: `n` a side along its long sides (and one at each end if `ends`), backs against its edge. Returns how many fit. */
  const CH = cm(REAL.chair[0]);
  const seat = (x, y, w, h, n, ends) => {
    const tq = placed[placed.length - 1], along = w >= h, L = along ? w : h, D = (along ? h : w) / 2 + CH / 2 + 1, step = n > 1 ? Math.min(cm(60), (L - CH) / (n - 1)) : 0;
    let got = 0;
    for (const s of [-1, 1]) {
      for (let q = 0; q < n; q++) { const u = (q - (n - 1) / 2) * step; got += (along ? put('chair', x + u, y + s * D, CH, CH, { rot: s < 0 ? Math.PI / 2 : -Math.PI / 2 }, tq) : put('chair', x + s * D, y + u, CH, CH, { rot: s < 0 ? 0 : Math.PI }, tq)) ? 1 : 0; }
      if (ends) { const E = (along ? w : h) / 2 + CH / 2 + 1; got += (along ? put('chair', x + s * E, y, CH, CH, { rot: s < 0 ? 0 : Math.PI }, tq) : put('chair', x, y + s * E, CH, CH, { rot: s < 0 ? Math.PI / 2 : -Math.PI / 2 }, tq)) ? 1 : 0; }
    }
    return got;
  };
  const table4 = r => {                                                    // a table for four with its chairs, somewhere clear in the room (a table no one can sit at is put back)
    const tw = cm(REAL.dine4[0]), th = cm(REAL.dine4[1]);
    for (let n = 0; n < 30; n++) { const x = X0(r) + tw / 2 + 50 + R() * (X1(r) - X0(r) - tw - 100), y = Y0(r) + th / 2 + 50 + R() * (Y1(r) - Y0(r) - th - 100), n0 = props.length;
      if (put('t', x, y, tw, th, { kind: 'dining' })) { if (seat(x, y, tw, th, 2) >= 3) return true; unput(n0); } }
    return false;
  };
  const deskAt = (r, dim, walls, ex) => {                                  // a desk against a wall with its chair pushed in (a spot with no room for the chair is passed over)
    for (let n = 0; n < 6; n++) { const n0 = props.length, dk = anyWall('D', r, dim, ex || { kind: 'desk' }, walls); if (!dk) return null;
      const [ox, oy] = turn(dk.sd, 0, cm(dim[1]) / 2 + cm(26) + 1);
      if (put('ochair', dk.x + ox, dk.y + oy, cm(52), cm(52), { rot: dk.sd * Math.PI / 2 - Math.PI / 2 }, dk.q) || n === 5) return dk;
      unput(n0); }
    return null;
  };
  /* The safe house's mission PC: a desk with a PC on it and its chair, with room to stand behind the chair (see MISSION PC). */
  const pcDesk = (r, walls) => {
    for (let n = 0; n < 8; n++) {
      const n0 = props.length, dk = deskAt(r, [130, 65], walls, { kind: 'pc', light: { r: 80, col: [120, 170, 255], k: 0.3 } });
      if (!dk) return null;
      const [ox, oy] = turn(dk.sd, 0, cm(65) / 2 + 30 + 13.5);
      if (floorFree(dk.x + ox, dk.y + oy, 14)) return dk;
      unput(n0);
    }
    return null;
  };
  /* The safe house's armory, in the garage: ammo crates against a wall with the RESTOCK spot in front, the workbench on the back wall
     (away from the roller door; you stand in front of it, facing it), the gear locker on a wall with its doors to the room, a rifle rack
     on a side wall, a cabinet. Every spot you stand at has to be clear floor. */
  let armory = null;
  const armoryFit = r => {
    const A = {}, inKeep = (x, y, w, h) => keep.some(([kx, ky, kw, kh]) => x < kx + kw && x + w > kx && y < ky + kh && y + h > ky);
    for (const [sd, i0, j0, di, dj] of [[3, r.x0, r.y0 + 1, 0, 1], [1, r.x1, r.y0 + 1, 0, 1], [3, r.x0, r.y1 - 2, 0, 1], [1, r.x1, r.y1 - 2, 0, 1]]) {   // two crates side by side
      const tl = [[i0, j0], [i0 + di, j0 + dj]];
      if (tl.some(([i, j]) => S[j][i] !== '.' || inKeep(i * T, j * T, T, T))) continue;
      for (const [i, j] of tl) S[j][i] = 'X';
      const nx = sd === 3 ? 1 : -1; A.restock = [i0 + 0.5 + nx * 1.15, j0 + 1];
      break;
    }
    if (!A.restock) return null;
    const wb = against('D', r, 0, [180, 75], null, 0, { kind: 'workbench' }, null);
    if (!wb) return null;
    A.bench = [wb.x / T, (wb.y + cm(75) / 2 + 13.5 + 12) / T];
    for (const sd of [1, 3, 0]) {                                          // the locker: its doors (its front, +y in its frame) toward the room
      const rot = sd === 1 ? Math.PI / 2 : sd === 3 ? -Math.PI / 2 : 0, lk = against('locker', r, sd, [94, 45], null, 0, { rot }, null);
      if (!lk) continue;
      const fx = -Math.sin(rot), fy = Math.cos(rot), d = 12 + 13.5 + 12;
      if (!floorFree(lk.x + fx * d, lk.y + fy * d, 14)) { unput(props.length - 1); continue; }
      A.locker = [(lk.x + fx * d) / T, (lk.y + fy * d) / T]; break;
    }
    if (!A.locker) return null;
    anyWall('rack', r, [157, 34], null, [1, 3], 0, null);
    anyWall('cab', r, [56, 37], null, [1, 3, 0], 0, null);
    for (const q of [A.bench, A.restock]) if (!floorFree(q[0] * T, q[1] * T, 12)) return null;
    return A;
  };
  let prevR = null, prevN = 0;
  for (const r of rooms) {
    if (prevR) fixRoom(prevR, prevN); prevR = r; prevN = props.length;
    const k = r.kind, area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    if (k === 'master' || k === 'bed') {
      const big = k === 'master', kid = !big && kids && chance(0.6), bd2 = big ? REAL.queen : kid ? REAL.single : pick([REAL.double, REAL.double, REAL.single]);
      /* The bed's head to a wall with a bedside table each side (one for a single), as people set a bedroom up: every spot along every wall is
         scored by the wall (no doorway, not under the window if there's a choice), how many bedside tables fit beside it, and how near the wall's middle it is. */
      const bw = cm(bd2[0]), ns = cm(REAL.nstand[0]), nOff = bw / 2 + ns / 2 + 6, single = bd2 === REAL.single;
      const fitA = (sd, a, dim) => { const cw = cm(dim[0]), ch = cm(dim[1]); if (a < cw / 2 || a > wlen(r, sd) - cw / 2) return false; const [x, y] = at(r, sd, a, ch / 2); return fits(x, y, sd % 2 ? ch : cw, sd % 2 ? cw : ch); };
      let bs = null;
      for (const sd of [0, 1, 2, 3]) { const L = wlen(r, sd), wsc = wallSc(r, sd, true);
        for (let a = bw / 2 + 3; a <= L - bw / 2 - 3; a += 6) { if (!fitA(sd, a, bd2)) continue;
          const sides = [-1, 1].filter(s => fitA(sd, a + s * nOff, REAL.nstand)), sc = wsc + Math.min(sides.length, single ? 1 : 2) * 260 - Math.abs(a - L / 2) * (single ? 0.1 : 0.6) + R() * 25;
          if (!bs || sc > bs.sc) bs = { sd, a, sc, sides }; } }
      const bed = bs && against('bed', r, bs.sd, bd2, bs.a, 0, { col: kid ? pick(['#3a8ae8', '#e85a6a', '#5ac87a', '#e8c83a']) : pick(DUVET) });
      if (bed) {
        bed.sd = bs.sd;
        const sides = single ? (bs.sides.length ? [pick(bs.sides)] : []) : bs.sides, lampSide = sides.length ? pick(sides) : 1;
        for (const s of sides) {
          const ns2 = against('nstand', r, bed.sd, REAL.nstand, bed.a + s * nOff, 0, s === lampSide && chance(0.7) ? lamp(95, 0.45) : null);
          if (ns2 && s !== lampSide) onP(ns2, bed.sd, 0, 0, pick(['clock', 'phone', 'book', 'glass']));
        }
        const [rx, ry] = at(r, bed.sd, bed.a, cm(bd2[1]) * 0.7); rugAt(rx, ry, bed.sd % 2 ? 90 : bw + 50, bed.sd % 2 ? bw + 50 : 90);
        if (big) { if (chance(0.45)) against('chest', r, bed.sd, REAL.chest, bed.a, cm(bd2[1]) + 6); else if (chance(0.6)) against('otto', r, bed.sd, [120, 40], bed.a, cm(bd2[1]) + 6, { col: pick(SOFA) }, null); }   // a blanket chest or a bench at the foot of the bed
        if (chance(0.5)) { const [sx, sy] = at(r, bed.sd, bed.a + (chance(0.5) ? -1 : 1) * (bw / 2 + 14), cm(bd2[1]) * 0.55); clutter.push(['slippers', sx, sy, bed.sd * Math.PI / 2, pick(CLOTH)]); }
      }
      const others = bestWalls(r).filter(sd => !bed || sd !== bed.sd);
      const dz = anyWall('dresser', r, big ? REAL.dresser : [100, 45], null, others);
      if (dz) { onP(dz, dz.sd, -cm(35), cm(4), pick(['perfume', 'jbox', 'books'])); onP(dz, dz.sd, 0, cm(2), 'frame', 0, pick(CLOTH)); if (chance(0.6)) onP(dz, dz.sd, cm(35), cm(4), pick(['laptop', 'mag', 'keys', 'candle'])); }
      anyWall(chance(0.6) ? 'ward' : 'shelf', r, chance(0.6) ? REAL.ward : REAL.shelf, null, others);
      if (safe && big) { if (!pcDesk(r, others)) return null; }        // the safe house: the mission PC
      else if (kid || (area >= 24 && chance(0.6))) { const dk = deskAt(r, [110, 55], others); if (dk) { onP(dk, dk.sd, -cm(20), 0, pick(['laptop', 'books', 'papers']), 0); onP(dk, dk.sd, cm(35), 0, pick(['mug', 'phone', 'candle']), 0, pick(CLOTH)); } }
      if (big && area >= 24) { const rc = anyWall('armch', r, REAL.armch, { col: pick(SOFA) }, others); if (rc) against('stbl', r, rc.sd, REAL.stbl, rc.a + (chance(0.5) ? 1 : -1) * cm(78), 0, Object.assign({ round: true }, lamp(95, 0.45)), null); }   // a reading corner in a big master
      if (chance(0.5)) anyWall('laundry', r, REAL.laundry, null, others);
      if (chance(0.5)) anyWall('plant', r, REAL.plant, null, others, 2, null);
      for (let n = ri(1, 3); n > 0; n--) drop(pick(['clothes', 'jeans', 'socks', 'shoes', 'sneakers', 'backpack', 'books', kid ? 'teddy' : 'mag', kid ? 'toys' : 'yoga', kid ? 'ball' : 'dumbbell', 'guitar']), 12, r, pick(CLOTH));
    } else if (k === 'living' || k === 'family') {
      const tvL = { light: { r: 120, col: [130, 160, 255], k: 0.35 } }, bw0 = bestWalls(r, true), deep = bw0.filter(sd => wdep(r, sd) > cm(300)), tvWs = deep.length ? deep : bw0;   // the TV on a wall the sofa can face from across the room, never in front of a window if it can help it
      let tvW = tvWs[0], tv = null;
      for (const sd of tvWs) if ((tv = against('tv', r, sd, REAL.tv, null, 0, tvL))) { tvW = sd; break; }
      if (!tv) { anyWin = true; tv = against('tv', r, tvW, REAL.tv, null, 0, tvL); anyWin = false; }
      if (tv) {
        const D = wdep(r, tvW), sz = wlen(r, tvW) > cm(280) ? REAL.sofa : REAL.loveseat; let sofaO = Math.min(D - cm(REAL.sofa[1]) - 6, cm(45) + cm(250)), sofa = null, sofaW = sz;
        for (const [dO, dA] of [[0, 0], [0, cm(45)], [0, -cm(45)], [-cm(30), 0], [0, cm(90)], [0, -cm(90)], [-cm(30), cm(90)], [-cm(30), -cm(90)], [-cm(60), 0], [0, cm(135)], [0, -cm(135)], [-cm(60), cm(90)], [-cm(60), -cm(90)]]) {   // doorways in the way: a little nearer, or along
          if (sofaO + dO <= cm(150)) continue;
          if ((sofa = against('S', r, tvW, sz, tv.a + dA, sofaO + dO, { col: sofaCol }, (tvW + 2) % 4))) { sofaO += dO; break; }
          if (sz === REAL.sofa && (sofa = against('S', r, tvW, REAL.loveseat, tv.a + dA, sofaO + dO, { col: sofaCol }, (tvW + 2) % 4))) { sofaO += dO; sofaW = REAL.loveseat; break; }
        }
        if (!sofa && D > cm(250)) for (const s2 of [REAL.sofa, REAL.loveseat]) { const op = (tvW + 2) % 4; if ((sofa = against('S', r, op, s2, null, 0, { col: sofaCol }))) { sofaO = D - cm(s2[1]); sofaW = s2; break; } }   // else back to the wall facing the TV
        if (sofa) {
          const mid = Math.max(cm(45) + cm(45), sofaO - cm(75)), ctw = tvW % 2 ? cm(REAL.coffee[1]) : cm(REAL.coffee[0]), cth = tvW % 2 ? cm(REAL.coffee[0]) : cm(REAL.coffee[1]);
          let ca = sofa.a, [cx2, cy2] = at(r, tvW, ca, mid);                  // the coffee table in front of the sofa (or between it and the TV if a doorway's in the way)
          if (!put('t', cx2, cy2, ctw, cth, { kind: 'coffee' })) { ca = (sofa.a + tv.a) / 2; [cx2, cy2] = at(r, tvW, ca, mid); if (!put('t', cx2, cy2, ctw, cth, { kind: 'coffee' })) { ca = tv.a; [cx2, cy2] = at(r, tvW, ca, mid); put('t', cx2, cy2, ctw, cth, { kind: 'coffee' }) || (ca = sofa.a); } }
          if (props[props.length - 1][0] === 't') on('remote', cx2 + (tvW % 2 ? 0 : 20), cy2 + (tvW % 2 ? 20 : 0));
          { const [rx2, ry2] = at(r, tvW, (sofa.a + tv.a) / 2, mid); rugAt(rx2, ry2, tvW % 2 ? sofaO - 10 : cm(300), tvW % 2 ? cm(300) : sofaO - 10); }
          const sw = cm(sofaW[0]) / 2 + cm(REAL.stbl[0]) / 2 + 6, lampSide = chance(0.5) ? 1 : -1;   // an end table each side of the sofa, a lamp on one
          for (const s of [-1, 1]) { const st = against('stbl', r, tvW, REAL.stbl, sofa.a + s * sw, sofaO + cm(20), Object.assign({ round: chance(0.5) }, s === lampSide ? lamp(120, 0.5) : {}), null); if (st && s !== lampSide) onP(st, 0, 0, 0, pick(['mug', 'book', 'phone', 'glass', 'candle']), undefined, pick(CLOTH)); }
          const ac = { col: pick(SOFA) }, side = chance(0.5) ? 1 : -1;                                // an armchair at the end of the coffee table, facing in
          const [ax2, ay2] = at(r, tvW, ca + side * (cm(REAL.coffee[0]) / 2 + cm(80)), mid);
          if (put('armch', ax2, ay2, cm(85), cm(85), Object.assign({ face: side > 0 ? (tvW % 2 ? 2 : 1) : (tvW % 2 ? 0 : 3) }, ac)) && chance(0.5)) { const [ox, oy] = turn(tvW, side * cm(60), cm(70)); put('otto', ax2 + ox, ay2 + oy, cm(60), cm(45), { col: ac.col }); }
        }
      }
      if (!props.some(p => p[0] === 'S' && p[1] > X0(r) && p[1] < X1(r) && p[2] > Y0(r) && p[2] < Y1(r))) anyWall('S', r, REAL.loveseat, { col: sofaCol }, tv ? bestWalls(r).filter(sd => sd !== tvW) : null);   // a living room always has somewhere to sit
      const rest = bestWalls(r).filter(sd => !tv || (sd !== tvW && sd !== (tvW + 2) % 4));
      anyWall('shelf', r, REAL.shelf, null, rest.concat(tv ? [(tvW + 2) % 4] : []));
      anyWall('lamp', r, REAL.lamp, lamp(130, 0.5), rest, 4, null);
      if (chance(0.8)) anyWall('plant', r, REAL.plant, null, null, 4, null);
      if (area >= 34) { const rc = anyWall('armch', r, REAL.armch, { col: pick(SOFA) }, rest); if (rc) { against('stbl', r, rc.sd, REAL.stbl, rc.a + (chance(0.5) ? 1 : -1) * cm(78), 0, { round: true }, null); } }
      // a big room isn't left bare: the family's table if the kitchen has none, a desk corner, another bookcase, a sideboard
      if (area >= 40 && !eatIn && !rooms.some(q => q.kind === 'dining')) table4(r);
      if (area >= 44 && chance(0.7)) { const dk = deskAt(r, REAL.desk, rest); if (dk) { onP(dk, dk.sd, 0, 0, pick(['laptop', 'papers', 'books'])); } }
      if (area >= 36) anyWall(chance(0.5) ? 'shelf' : 'side', r, chance(0.5) ? REAL.shelf : REAL.side, { col: '#6a4a30' }, null);
      if (area >= 50 && chance(0.6)) anyWall('plant', r, REAL.plant, null, null, 4, null);
      if (pet) drop('dogbed', 16, r, pick(['#8a6a4a', '#5a6a7a', '#7a4a4a']));
      for (let n = ri(1, 3); n > 0; n--) drop(pick(['news', 'mag', 'shoes', 'sneakers', 'backpack', 'cable', kids ? 'toys' : 'books', kids ? 'ball' : 'mug', kids ? 'teddy' : 'guitar', 'yoga']), 12, r, pick(CLOTH));
    } else if (k === 'kitchen') {
      // worktop along the best wall (and round a corner in a big kitchen): a hob under the hood, a sink, appliances; the fridge at an end
      const walls = bestWalls(r, false), runs = [];
      for (const sd of walls) {
        if (runs.length >= (area >= 20 ? 2 : 1)) break;
        const line = sd === 0 ? r.y0 : sd === 2 ? r.y1 : sd === 1 ? r.x1 : r.x0, L = sd % 2 ? [r.y0, r.y1] : [r.x0, r.x1], tiles = [];
        for (let q = L[0]; q <= L[1]; q++) { const [i, j] = sd % 2 ? [line, q] : [q, line], cx2 = (i + 0.5) * T, cy2 = (j + 0.5) * T;
          if (S[j][i] !== '.' || keep.some(([kx, ky, kw, kh]) => cx2 > kx && cx2 < kx + kw && cy2 > ky && cy2 < ky + kh)) { if (tiles.length >= 2) break; tiles.length = 0; continue; }   // keep a run of 2+ (a 2-tile counter is the least we lay)
          tiles.push([i, j, q]); if (tiles.length >= 7) break; }
        if (tiles.length >= 2) { for (const [i, j] of tiles) S[j][i] = 'K'; runs.push({ sd, tiles }); }
      }
      if (runs.length) {
        const m = runs[0], hob = m.tiles[Math.floor(m.tiles.length / 2)], a = (hob[2] - (m.sd % 2 ? r.y0 : r.x0) + 0.5) * T;
        const P = (t, dd) => at(r, m.sd, (t[2] - (m.sd % 2 ? r.y0 : r.x0) + 0.5) * T, dd);
        fixture('hood', r, m.sd, a, 40, 12, 150, [255, 236, 200], 0.45);
        { const [x, y] = P(hob, 16); on('hob', x, y, m.sd * Math.PI / 2); if (chance(0.5)) on('pan', x, y + 3); }
        const sk = m.tiles[Math.floor(m.tiles.length / 2) + 2] || m.tiles[Math.floor(m.tiles.length / 2) - 2];
        if (sk) { const [x, y] = P(sk, 17); on('ksink', x, y, m.sd * Math.PI / 2); const [mx, my] = P(sk, T + 12); clutter.push(['mat', mx, my, m.sd * Math.PI / 2, pick(['#5a5a5a', '#6a4a3a', '#3a4a5a'])]); }
        const stuff = ['mwave', 'kettle', 'toaster', 'board', 'coffee', 'dishes', 'bowl', 'bottle'].sort(() => R() - 0.5);
        for (const rn of runs) for (const t of rn.tiles) if (t !== hob && t !== sk && chance(0.65) && stuff.length) { const [x, y] = at(r, rn.sd, (t[2] - (rn.sd % 2 ? r.y0 : r.x0) + 0.5) * T, 16); on(stuff.pop(), x, y, rn.sd * Math.PI / 2 + (R() - 0.5) * 0.3, pick(['#c83a2a', '#e8e4dc', '#2a2b2e', '#3a6a8a'])); }
        const end = m.tiles[m.tiles.length - 1], beg = m.tiles[0], q0 = m.sd % 2 ? r.y0 : r.x0;
        (() => { for (const rn of runs.slice().sort((a2, b2) => b2.tiles.length - a2.tiles.length)) for (const end2 of [1, 0]) {   // in place of a counter at either end of a run (it takes no more floor than the counter did)
            if (rn.tiles.length < 3) continue; const q1 = rn.sd % 2 ? r.y0 : r.x0, t = end2 ? rn.tiles[rn.tiles.length - 1] : rn.tiles[0], [fx, fy] = at(r, rn.sd, (t[2] - q1 + 0.5) * T, cm(REAL.fridge[1]) / 2), fw = rn.sd % 2 ? cm(REAL.fridge[1]) : cm(REAL.fridge[0]), fh = rn.sd % 2 ? cm(REAL.fridge[0]) : cm(REAL.fridge[1]);
            if (placed.some(([qx, qy, qw, qh]) => fx - fw / 2 < qx + qw && fx + fw / 2 > qx && fy - fh / 2 < qy + qh && fy + fh / 2 > qy)) continue;
            S[t[1]][t[0]] = '.'; placed.push([fx - fw / 2, fy - fh / 2, fw, fh, 'fridge', top.length]); props.push(['fridge', fx, fy, fw, fh, { face: rn.sd }]); end2 ? rn.tiles.pop() : rn.tiles.shift(); return true;
          } return false; })()    // every kitchen has a fridge: in place of a counter at a run's end (no new floor taken), else just past a run's end, else any wall
          || against('fridge', r, m.sd, REAL.fridge, (end[2] - q0 + 1) * T + cm(40), 0) || against('fridge', r, m.sd, REAL.fridge, (beg[2] - q0) * T - cm(40), 0) || anyWall('fridge', r, REAL.fridge);
      }
      const W2 = r.x1 - r.x0 + 1, H2 = r.y1 - r.y0 + 1;
      if (W2 >= 6 && H2 >= 5 && runs.length) {                              // an island with stools
        const ci = Math.floor((r.x0 + r.x1) / 2) - 1, cj = Math.floor((r.y0 + r.y1) / 2);
        if (S[cj][ci] === '.' && S[cj][ci + 1] === '.' && fits((ci + 1) * T, (cj + 0.5) * T, 2 * T, T)) {
          S[cj][ci] = S[cj][ci + 1] = 'K'; on('bowl', (ci + 0.6) * T, (cj + 0.5) * T, 0, '#e8e4dc'); if (chance(0.6)) on(pick(['mag', 'laptop', 'mug', 'board']), (ci + 1.5) * T, (cj + 0.5) * T, undefined, '#3a6a8a');
          for (const dx of [0.6, 1.4]) put('stool', (ci + dx) * T, (cj + 1) * T + 14, cm(35), cm(35));
        }
      }
      if (!rooms.some(q => q.kind === 'dining')) eatIn = table4(r);         // eat-in kitchen: a table for four
      anyWall('bin', r, [30, 30], null, null, 2, null);
      if (pet) drop('petbowl', 12, r);
      if (chance(0.4)) drop(pick(['news', 'backpack', 'shoes', 'mag']), 12, r, pick(CLOTH));
    } else if (k === 'dining') {
      /* The table in the middle along the room, seating six; a doorway in the way moves it a little, then a table for four, then wherever one fits with what chairs fit. */
      const x = (X0(r) + X1(r)) / 2, y = (Y0(r) + Y1(r)) / 2, along = X1(r) - X0(r) >= Y1(r) - Y0(r), n0 = props.length, sh = [[0, 0], [T / 2, 0], [-T / 2, 0], [0, T / 2], [0, -T / 2], [T, 0], [-T, 0], [0, T], [0, -T]];
      const tryT = (dim, nn, need) => { for (const [dx, dy] of sh) { const w = cm(dim[along ? 0 : 1]), h = cm(dim[along ? 1 : 0]);
        if (put('t', x + dx, y + dy, w, h, { kind: 'dining' }) && seat(x + dx, y + dy, w, h, nn) >= need) { rugAt(x + dx, y + dy, w + 110, h + 110, 'plain'); return true; } unput(n0); } return false; };
      tryT(REAL.dine6, 3, 4) || tryT(REAL.dine4, 2, 3) || table4(r) || tryT(REAL.dine4, 2, 1);
      const sb = anyWall('side', r, REAL.side, { col: '#6a4a30' });
      if (sb) { onP(sb, sb.sd, -cm(45), 0, 'vase', 0, pick(['#3a6a8a', '#c8a24a', '#e8e4dc'])); onP(sb, sb.sd, cm(40), 0, pick(['bowl', 'books', 'frame', 'candle']), undefined, pick(CLOTH)); }
      if (chance(0.7)) anyWall('plant', r, REAL.plant, null, null, 4, null);
    } else if (k === 'powder') {                                             // a half bath: a small basin and a toilet
      const walls = bestWalls(r, false), va = anyWall('sink', r, [55, 40], null, walls);
      if (va) { fixture('mirror', r, va.sd, va.a, 20, 4, 90, [220, 240, 255], 0.4); onP(va, va.sd, 0, -cm(4), 'soap'); }
      for (const sd of walls.filter(sd => !va || sd !== va.sd)) { if (against('toilet', r, sd, REAL.toilet, null, 0, { rot: (sd + 1) * Math.PI / 2 }, null)) break; }
      anyWall('bin', r, [25, 25], null, null, 2, null);
    } else if (k === 'bath' || k === 'ens') {
      const bw2 = r.x1 - r.x0 + 1, bh2 = r.y1 - r.y0 + 1, narrow = Math.min(bw2, bh2) <= 2 && Math.max(bw2, bh2) >= 4;
      let endTub = null;                                                    // a narrow bath (the classic 5x8): the tub across the far end, toilet and basin along the long wall
      if (narrow && (k === 'bath' || chance(0.5))) {
        const ends = bw2 <= 2 ? [0, 2] : [1, 3], d0 = r.dt[0] || [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], far = ends.map(sd => { const [ex, ey] = at(r, sd, wlen(r, sd) / 2, 0); return [sd, Math.hypot(ex - (d0[0] + 0.5) * T, ey - (d0[1] + 0.5) * T)]; }).sort((a2, b2) => b2[1] - a2[1])[0][0];
        endTub = against('tub', r, far, REAL.tub, wlen(r, far) / 2, 0); if (endTub) endTub.sd = far;
      }
      const walls = bestWalls(r, false).filter(sd => !endTub || sd !== endTub.sd), dbl = k === 'ens' && area >= 12, va = anyWall('sink', r, dbl ? [150, 55] : k === 'ens' ? [70, 48] : REAL.vanity, null, walls);   // a big master bath has a double vanity
      if (va) { fixture('mirror', r, va.sd, va.a, 26, 4, 110, [220, 240, 255], 0.4); onP(va, va.sd, -cm(28), -cm(4), 'tooth', 0); onP(va, va.sd, cm(28), -cm(4), 'soap'); }
      const rest = walls.filter(sd => !va || sd !== va.sd);
      for (const sd of rest) { if (against('toilet', r, sd, REAL.toilet, null, 0, { rot: (sd + 1) * Math.PI / 2 }, null)) break; }
      const tb = endTub || ((k === 'bath' && chance(0.75)) || (k === 'ens' && area >= 12 && chance(0.7)) ? anyWall('tub', r, REAL.tub, null, rest) : null);
      if (tb) { onP(tb, tb.sd, cm(55), cm(10), 'towel', Math.PI / 2, pick(CLOTH)); const [mx, my] = at(r, tb.sd, tb.a, cm(75) + 14); clutter.push(['mat', mx, my, tb.sd * Math.PI / 2, pick(['#5a7a8a', '#d8d0c0', '#8a5a6a', '#6a8a6a'])]); }
      if (!tb || (k === 'ens' && area >= 12)) anyWall('shower', r, REAL.shower, null, rest);   // the master bath: a tub and a walk-in shower
      if (k === 'bath' && !rooms.some(q => q.kind === 'laundry') && chance(0.6)) anyWall('washer', r, REAL.washer, null, rest);
      anyWall('bin', r, [25, 25], null, null, 2, null);
      if (chance(0.5)) drop(pick(['towel', 'slippers', 'clothes']), 10, r, pick(CLOTH));
    } else if (k === 'office') {
      const dk = deskAt(r, REAL.desk, bestWalls(r, false));
      if (dk) { onP(dk, dk.sd, -cm(25), 0, 'laptop', 0); onP(dk, dk.sd, cm(35), 0, 'papers'); onP(dk, dk.sd, cm(52), cm(10), pick(['mug', 'glass', 'phone']), 0, pick(CLOTH)); }
      anyWall('shelf', r, REAL.shelf); anyWall('cab', r, [60, 45]);
      if (chance(0.5)) anyWall('boxes', r, REAL.boxes);
      if (chance(0.6)) anyWall('plant', r, REAL.plant, null, null, 4, null);
      for (let n = ri(1, 2); n > 0; n--) drop(pick(['papers', 'cable', 'books', 'backpack', 'mag']), 12, r, pick(CLOTH));
    } else if (k === 'laundry') {
      const w1 = anyWall('washer', r, REAL.washer, null, bestWalls(r, false));
      if (w1) against('washer', r, w1.sd, REAL.washer, w1.a + cm(65), 0);
      anyWall('laundry', r, REAL.laundry); if (chance(0.6)) anyWall('shelf', r, REAL.shelf);
      if (area >= 9) anyWall('side', r, [120, 60], { col: '#d8d4cc' });                     // a folding counter in a full laundry room
      drop(pick(['clothes', 'socks', 'towel']), 10, r, pick(CLOTH));
    } else if (k === 'nook') {                                             // a breakfast nook: a table for four and a sideboard
      table4(r); if (chance(0.6)) anyWall('side', r, [120, 45], { col: '#6a4a30' }); if (chance(0.5)) anyWall('plant', r, REAL.plant, null, null, 2, null);
    } else if (k === 'pantry') {                                             // a walk-in pantry: shelving round the walls, a few boxes and bins
      for (const sd of bestWalls(r)) against('shelf', r, sd, [120, 40], null, 0) || against('shelf', r, sd, [60, 30], null, 0);   // a reach-in pantry takes a narrow one
      if (chance(0.6)) anyWall('boxes', r, REAL.boxes); if (chance(0.5)) anyWall('bin', r, [30, 30], null, null, 2, null);
    } else if (k === 'closet') {                                             // a walk-in closet: hanging rails and shelves, a hamper, clothes about
      for (const sd of bestWalls(r)) against(chance(0.5) ? 'ward' : 'shelf', r, sd, chance(0.5) ? REAL.ward : REAL.shelf, null, 0);
      if (chance(0.6)) anyWall('laundry', r, REAL.laundry);
      for (let n = ri(1, 3); n > 0; n--) drop(pick(['clothes', 'jeans', 'shoes', 'sneakers', 'socks', 'backpack']), 10, r, pick(CLOTH));
    } else if (k === 'entry') {                                              // a foyer: a console, shoes by the door
      const cs = anyWall('side', r, [120, 35], { col: '#5a3e28' }); if (cs) onP(cs, cs.sd, 0, 0, pick(['keys', 'vase', 'frame']), 0, pick(['#3a6a8a', '#c8a24a']));
      if (chance(0.6)) anyWall('plant', r, REAL.plant, null, null, 2, null);
      for (let n = ri(1, 2); n > 0; n--) drop(pick(['shoes', 'sneakers', 'backpack']), 10, r, pick(CLOTH));
    } else if (k === 'hall') {
      const vert = r.y1 - r.y0 > r.x1 - r.x0, [rb, re] = pick(RUGS);
      decals.push(vert ? [(X0(r) + X1(r)) / 2 - 26, Y0(r) + 20, 52, Y1(r) - Y0(r) - 40, rb, re, 'runner'] : [X0(r) + 20, (Y0(r) + Y1(r)) / 2 - 26, X1(r) - X0(r) - 40, 52, rb, re, 'runner']);
      const cs = Math.min(r.x1 - r.x0, r.y1 - r.y0) < 1 ? null : anyWall('side', r, [140, 35], { col: '#5a3e28' }, vert ? [1, 3] : [0, 2]);
      if (cs) { onP(cs, cs.sd, -cm(40), 0, 'keys'); onP(cs, cs.sd, cm(40), 0, pick(['vase', 'frame', 'candle']), 0, pick(['#3a6a8a', '#c8a24a'])); }
      if (chance(0.5)) anyWall('plant', r, REAL.plant, null, null, 2, null);
      if (chance(0.6)) drop(pick(['shoes', 'sneakers', 'backpack']), 10, r, pick(CLOTH));
    } else if (k === 'storage') {                                            // a box room: shelves, boxes, the things people keep
      for (const sd of bestWalls(r)) { against('shelf', r, sd, [120, 40], null, 0); }
      for (let n = ri(1, 3); n > 0; n--) anyWall('boxes', r, REAL.boxes);
      if (chance(0.5)) anyWall(chance(0.5) ? 'bike' : 'laundry', r, chance(0.5) ? [175, 60] : REAL.laundry, null, null, 0, null);
      drop(pick(['toys', 'ball', 'news', 'cable', 'yoga']), 10, r, pick(CLOTH));
    } else if (k === 'garage' && safe) {                                    // the safe house: the armory
      if (!(armory = armoryFit(r))) return null;
    } else if (k === 'garage') {
      const back = 0;                                                         // the wall away from the garage door
      against('side', r, back, [200, 60], null, 0, { col: '#5a5048' }) && on('toolbox', (X0(r) + X1(r)) / 2, Y0(r) + 18, 0);
      anyWall('cab', r, [90, 45], null, [1, 3, 0]); if (chance(0.7)) anyWall('boxes', r, REAL.boxes, null, [1, 3, 0]);
      if (chance(0.5)) anyWall('bike', r, [175, 60], { col: pick(['#c83a2a', '#3a8ae8', '#2a2b2e']) }, [1, 3], 0, null);
      anyWall('fridge', r, [70, 70], null, [1, 3]); anyWall('tcan', r, [40, 40], null, [1, 3], 2, null);
      clutter.push(['oil', (X0(r) + X1(r)) / 2 + (R() - 0.5) * 40, (Y0(r) + Y1(r)) / 2 + 20, R() * 6]);
    }
  }
  if (prevR) fixRoom(prevR, prevN);
  // ---- the yards and the street: lamps, bins, a mailbox, hedges and flower beds, a fence, a patio; your car at the kerb
  put('slamp', clamp((fd + 4.5) * T, 2 * T, 34 * T), 23.6 * T, 10, 10, { light: { r: 300, col: [255, 196, 120], k: 0.85 } });
  put('slamp', clamp((fd - 9.5) * T, 2 * T, 34 * T), 23.6 * T, 10, 10, { light: { r: 300, col: [255, 196, 120], k: 0.85 } });
  put('tcan', clamp((fd + 2.5) * T, 2 * T, 34 * T), 22.4 * T, 16, 16);
  if (chance(0.6)) put('tcan', clamp((fd + 3.1) * T, 2 * T, 34 * T), 22.4 * T, 16, 16);
  put('mailbox', (fd - 1.2) * T, 22.55 * T, 12, 18);
  const GREENS = ['#3f7a4a', '#4a6a3a', '#3a6a52', '#557a3e'], BLOOM = [null, '#e85a6a', '#f0d040', '#e8e0f0', '#c86ae8'];
  for (let i = 1; i < W - 1; i++) {                                        // along the front walls of the house: hedges and flower beds, clear of doors
    let j = 22; while (j > 1 && !inH[j][i]) j--;
    if (!inH[j][i] || j >= 22 || Math.abs(i - fd) <= 2 || (i + j) % 2 || F[j + 1][i] === 's') continue;
    const x = (i + 0.5) * T, y = (j + 1) * T + 17;
    if (chance(0.55)) put('shrub', x, y, 34, 28, { col: pick(GREENS), bloom: pick(BLOOM) }); else clutter.push(['flowerbed', x, y - 2, 0]);
  }
  for (const [x, y] of [[2.3 * T, 2.3 * T], [33.7 * T, 2.3 * T], [2.3 * T, 20.6 * T], [33.7 * T, 20.6 * T]]) if (chance(0.6)) put('shrub', x, y, 52, 50, { col: pick(GREENS) });
  { const sideX = chance(0.5) ? hx1 + 1 : hx0 - 1, aj = ri(hy0 + 2, hy1 - 2); if (S[aj][sideX] === '.' && !inH[aj][sideX]) put('ac', (sideX + (sideX > hx1 ? 0.35 : 0.65)) * T, (aj + 0.5) * T, 26, 26); }
  clutter.push(['mat', (fd + 0.5) * T, (fy + 1) * T + 12, 0, '#6a5a44'], ['mat', (fd + 0.5) * T, fy * T - 12, 0, pick(['#5a4a3a', '#3a4a5a', '#6a3a3a'])]);
  if (backDoor) {
    const by = backDoor[1];
    clutter.push(['mat', (bd + 0.5) * T, by * T - 12, 0, '#6a5a44']);
    if (by >= 4) {                                                          // the back yard: a patio, a table under an umbrella, toys, a hose
      clutter.push(['patio', (bd + 0.5) * T, (by - 1.3) * T, 0]);
      const ptx = (bd + (chance(0.5) ? -3 : 4)) * T;
      if (put('ptable', ptx, (by - 1.7) * T, 34, 34, { col: pick(['#3a6a8a', '#a83a32', '#3a7a5a', '#c8a24a']) })) { const tq = placed[placed.length - 1]; for (const [dx, dy] of [[-27, 0], [27, 0], [0, -27]]) put('chair', ptx + dx, (by - 1.7) * T + dy, 18, 18, { rot: Math.atan2(-dy, -dx) }, tq); }
      if (by >= 5) { put('grill', clamp((bd + 2) * T, 2 * T, 34 * T), (by - 2.6) * T, 30, 30); if (chance(0.6)) put('bench', clamp((bd - 5) * T, 3 * T, 33 * T), (by - 1.6) * T, 72, 22); }
      if (kids) { put('bike', (bd + 6.5) * T, (by - 2.4) * T, 56, 26, { col: pick(['#c83a2a', '#3a8ae8', '#e8c83a']) }); clutter.push(['ball', (bd - 6) * T, (by - 2.5) * T, 0, pick(['#e84a3a', '#3a8ae8', '#e8e6e0'])]); }
      clutter.push(['hose', hx0 * T + (chance(0.5) ? 18 : (hx1 - hx0) * T - 4), (hy0 - 0.6) * T, 0]);
      if (chance(0.5)) clutter.push(['leaves', (bd + ri(-8, 8)) * T, (by - 2.8) * T, 0]);
    }
  }
  for (let x = 1.5 * T; x < (W - 1.5) * T; x += T) clutter.push(['fence', x, 1.15 * T, 0]);                // a low fence round the lot
  for (let y = 1.6 * T; y < 22.5 * T; y += T) { clutter.push(['fence', 1.15 * T, y, Math.PI / 2]); clutter.push(['fence', (W - 1.15) * T, y, Math.PI / 2]); }
  for (let j = 1; j <= 22; j++) for (let i = 1; i < W - 1; i++) if (F[j][i] === 'v' && S[j][i] === '.') { if (i % 2 === 0) clutter.unshift(['mow', (i + 0.5) * T, (j + 0.5) * T, 0]); if (chance(0.12)) clutter.push(['tuft', (i + R()) * T, (j + R()) * T, R() * 6]); }
  const carX = clamp((fd + 0.5) * T + (chance(0.5) ? -1 : 1) * ri(3, 6) * T, 4 * T, 32 * T);   // a car is 232 px long: kept clear of the map's edge walls
  props.push(['c', carX, 26.05 * T, 232, 92, { tint: ri(0, 3), veh: 'mine' }]);
  if (chance(0.7)) props.push(['c', clamp(W * T - carX + (R() - 0.5) * 4 * T, 4 * T, 32 * T), 27.95 * T, 230, 92, { tint: ri(0, 3) }]);
  fixtures.push(['tube', (fd + 0.5) * T, (fy + 1.06) * T, 16, 4, (fd + 0.5) * T, (fy + 1.5) * T, 160, [255, 220, 170], 0.5, 1]);   // porch light
  /* Ceiling lights: every room and hallway has one (two or three along a long room or a hallway), the garage a tube.
     It's night: each is on or switched off by how likely that room is to be in use (CEIL.on). */
  for (const r of rooms) {
    const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1, long = Math.max(w, h), n = r.kind === 'hall' ? Math.max(1, Math.round(long / 5)) : long >= 8 ? 2 : 1;
    const unlit = !safe && !chance(CEIL.on[r.kind] === undefined ? 0.4 : CEIL.on[r.kind]), rad = clamp(Math.max(w, h) * T * (n > 1 ? 0.55 : 0.8), 140, 320);   // (the safe house: all on)
    for (let q = 0; q < n; q++) {
      const fx2 = w >= h ? (r.x0 + (q + 0.5) * w / n) * T : (r.x0 + w / 2) * T, fy2 = w >= h ? (r.y0 + h / 2) * T : (r.y0 + (q + 0.5) * h / n) * T;
      if (r.kind === 'garage') fixtures.push(['tube', fx2, fy2, 34, 5, fx2, fy2, 220, [225, 238, 255], 0.55, 1, 0, unlit]);
      else fixtures.push(['ceil', fx2, fy2, 14, 14, fx2, fy2, rad, [255, 214, 160], r.kind === 'bath' || r.kind === 'ens' ? 0.5 : 0.45, 1, 0, unlit]);
    }
  }
  // ---- can everything be walked to from the street? (tiles; heavy furniture blocks)
  const block = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (S[j][i] !== '.') block[j * W + i] = 1;
  for (const [c, x, y2, w, h] of props) if (!LIGHT_PROPS.has(c)) for (let j = Math.floor((y2 - h / 2 + 4) / T); j <= Math.floor((y2 + h / 2 - 4) / T); j++) for (let i = Math.floor((x - w / 2 + 4) / T); i <= Math.floor((x + w / 2 - 4) / T); i++) if (i >= 0 && j >= 0 && i < W && j < H) block[j * W + i] = 1;
  const spawn = [fd + 0.5, 22.4], seen = new Uint8Array(W * H), q = [22 * W + fd];
  seen[q[0]] = 1;
  while (q.length) { const c = q.pop(), i = c % W, j = (c / W) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (j + b) * W + i + a; if (i + a < 0 || j + b < 0 || i + a >= W || j + b >= H || seen[n] || block[n]) continue; seen[n] = 1; q.push(n); } }
  // ---- where people are: free spots in each room, away from furniture
  const freeSpot = (r, away) => { for (let n = 0; n < 40; n++) { const i = ri(r.x0, r.x1), j = ri(r.y0, r.y1); if (S[j][i] !== '.' || !seen[j * W + i]) continue; const x = (i + 0.5) * T, y2 = (j + 0.5) * T; if (placed.some(([qx, qy, qw, qh]) => x > qx - 15 && x < qx + qw + 15 && y2 > qy - 15 && y2 < qy + qh + 15)) continue; if (spots.some(([a, b]) => a === i && b === j)) continue; if (away && away.some(([a, b]) => Math.hypot(a - i, b - j) < 4)) continue; spots.push([i, j]); return [i, j]; } return null; };
  const inside = rooms.slice().sort(() => R() - 0.5);
  const bots = [], nbots = safe ? 0 : ri(Z.bots[0], Z.bots[1]), order2 = inside.filter(r => r.kind !== 'living').concat(inside.filter(r => r.kind === 'living'));
  for (let pass = 0; pass < 3 && bots.length < nbots; pass++) for (const r of order2) { if (bots.length >= nbots) break; const s = freeSpot(r); if (s) bots.push(s); }
  const civs = [], nc = safe ? 0 : ri(Z.civs[0], Z.civs[1]), who = () => Math.floor(R() * 1e9);
  for (let pass = 0; pass < 2 && civs.length < nc; pass++) for (const r of inside.filter(r => /bed|master|living|kitchen|office|dining/.test(r.kind))) { if (civs.length >= nc) break; const s = freeSpot(r, bots); if (s) civs.push([s[0], s[1], who()]); }
  for (let pass = 0; pass < 2 && civs.length < nc; pass++) for (const r of inside) { if (civs.length >= nc) break; const s = freeSpot(r); if (s) civs.push([s[0], s[1], who()]); }   // too tight to keep them apart: anywhere
  const mustSee = doors.map(d => [d[0], d[1]]).concat(bots, civs, [[Math.floor(carX / T), 24]]);
  const roomSeen = r => { for (let j = r.y0; j <= r.y1; j++) for (let i = r.x0; i <= r.x1; i++) if (seen[j * W + i]) return true; return false; };
  const hasWindow = r => { for (let i = r.x0 - 1; i <= r.x1 + 1; i++) for (const j of [r.y0 - 1, r.y1 + 1]) if (S[j][i] === 'G') return true; for (let j = r.y0; j <= r.y1; j++) for (const i of [r.x0 - 1, r.x1 + 1]) if (S[j][i] === 'G') return true; return false; };
  const hasBed = r => props.some(p => p[0] === 'bed' && p[1] > X0(r) && p[1] < X1(r) && p[2] > Y0(r) && p[2] < Y1(r));
  if (rooms.some(r => (r.kind === 'bed' || r.kind === 'master') && (!hasWindow(r) || !hasBed(r)))) return null;   // and a bed   // every bedroom has a window to escape by (IRC R310), as real homes must
  if ((!safe && bots.length < Z.bots[0]) || mustSee.some(([i, j]) => !seen[j * W + i]) || !rooms.every(roomSeen)) return null;
  // ---- no living space, bedroom or bath reached only through someone's bedroom, a bath or a box room (walls only: furniture moves)
  const prv = new Uint8Array(W * H), ps = new Uint8Array(W * H), q3 = [22 * W + fd];
  for (const r of rooms) if (!/^(family|nook|vest|hall|entry|living|dining|kitchen|laundry|garage)$/.test(r.kind)) for (let j = r.y0; j <= r.y1; j++) for (let i = r.x0; i <= r.x1; i++) prv[j * W + i] = 1;
  ps[q3[0]] = 1;
  while (q3.length) { const c = q3.pop(), i = c % W, j = (c / W) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (j + b) * W + i + a; if (i + a < 0 || j + b < 0 || i + a >= W || j + b >= H || ps[n] || S[j + b][i + a] !== '.') continue; ps[n] = 1; if (!prv[n]) q3.push(n); } }
  const pubOK = r => { for (let j = r.y0; j <= r.y1; j++) for (let i = r.x0; i <= r.x1; i++) if (ps[j * W + i]) return true; return false; };
  if (rooms.some(r => /^(bed|master|bath|office|kitchen|living|dining|powder|hall|entry)$/.test(r.kind) && !pubOK(r))) return null;
  let officer = null;                                                     // the safe house: where the officer waits, out back near the back door
  if (safe) {
    if (!backDoor || backDoor[1] < 5) return null;
    for (const dy of [2.5, 3.2, 2]) for (const dx of [3, -3, 4, -4, 5, -5, 2, -2, 6, -6]) {
      const x = bd + 0.5 + dx, y = backDoor[1] - dy;
      if (!officer && x > 2 && x < W - 3 && floorFree(x * T, y * T, 24)) officer = [x, y];
    }
    if (!officer) return null;
  }
  const out = { id: 'home', gen: true, hostages: true, seed, size: Z.name, plan: plan + (garage ? '+garage' : ''), hallW: hwd, rooms: rooms.map(r => r.kind), rects: rooms.map(r => [r.x0, r.y0, r.x1, r.y1]), top, clutter, solid: S.map(r => r.join('')), floor: F.map(r => r.join('')), spawn, doors, bots, civs, loot: {}, props, decals,
    fixtures, exit: { veh: 'mine', door: 'FL', x: carX / T, y: 24.6, r: 28, hold: 1.2, to: 'house', needClear: true, label: 'CAR', title: 'AREA CLEAR', sub: 'Get back in your car' } };
  if (!safe) return out;
  if (!['pc', 'workbench'].every(k => props.some(q => q[5] && q[5].kind === k)) || !props.some(q => q[0] === 'locker')) return null;   // (a room put back together may have lost one)
  return Object.assign(out, { id: 'house', gen: false, safe: true, hostages: false, bench: { x: armory.bench[0], y: armory.bench[1] }, locker: { x: armory.locker[0], y: armory.locker[1] },
    restock: { x: armory.restock[0], y: armory.restock[1] }, officer, away: [officer[0], 1.45],   // the gate in the back fence behind him
    exit: { veh: 'mine', door: 'FL', x: carX / T, y: 24.6, r: 28, hold: 1.2, to: 'mission', needClear: false, label: 'CAR', title: 'SAFE HOUSE', sub: 'Get in your car to deploy' } });
}
const usedSeeds = new Set();                             // every house this session is a new one
function homeMap(seed) {                                 // a valid layout: the first seed from here that passes genHome's checks
  let s = seed === undefined ? 1 + Math.floor(Math.random() * 2147483000) : seed;
  for (let n = 0; n < 60; n++, s++) { if (seed === undefined && usedSeeds.has(s)) continue; const m = genHome(s); if (m) { usedSeeds.add(s); return m; } }
  return null;
}
const MISSIONS = ['home'];                               // where your car takes you: a new generated home every time (the hotel is parked for now)
let missionN = 0;
MAPS.home = homeMap();                                   // replaced by a fresh one on every deploy and every restart
/* The safe house: the first seed from SAFE_SEED that builds a home in safe mode (see genHome), so it's always the same house. */
const SAFE_SEED = 1;
function safeHouse() { for (let s = SAFE_SEED; s < SAFE_SEED + 500; s++) { const m = genHome(s, true); if (m) return m; } return null; }
MAPS.house = safeHouse();
let MAP = MAPS.house;                                    // you start at the safe house
function applyMap() {
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = MAP.solid[j][i], k = j * W + i;
    BASE_SOLID[k] = c; floorAt[k] = MAP.floor[j][i];
    BASE_GRID[k] = c !== '.' ? 1 : 0;
    BASE_OPQ[k] = c === '#' || c === 'E' || c === 'C' || c === 'X' ? 1 : 0;
  }
  grid.set(BASE_GRID); opq.set(BASE_OPQ); for (let k = 0; k < W * H; k++) solidAt[k] = BASE_SOLID[k];
  SPAWN.x = MAP.spawn[0] * T; SPAWN.y = MAP.spawn[1] * T;
  DOOR_DEFS.length = 0; SELF_CLOSING.length = 0;
  for (const [x0, y0, x1, y1, cl] of MAP.doors) { DOOR_DEFS.push([x0, y0, x1, y1]); SELF_CLOSING.push(cl); }
}

const wall = (i, j) => i < 0 || j < 0 || i >= W || j >= H || grid[j * W + i] === 1;
const opaque = (i, j) => i < 0 || j < 0 || i >= W || j >= H || opq[j * W + i] === 1;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/* ---------- materials ---------- */
const FLOOR_TEX = { m: ['marble', 0.8], M: ['carpet', 0.7], e: ['stone', 0.5], w: ['wood', 0.8], k: ['ceramic', 0.5], u: ['ceramic', 0.5], o: ['carpet', 0.6], r: ['carpet', 0.6], z: ['concrete', 0.5], s: ['concrete', 0.5], R: ['carpet', 0.6], a: ['asphalt', 0.7] , l: ['wood', 0.8], b: ['carpet', 0.6], n: ['ceramic', 0.5], v: ['carpet', 0.45] };   // floor material texture and strength
const FLOOR_COL = {   // brighter, distinct per room: lit areas read clearly, dark ones stay dark
  m: ['#6a6052', '#72685a'], M: ['#3a3128'], e: ['#5b5650', '#625d56'], w: ['#6b4a32'], k: ['#5d6870'],
  u: ['#526763'], o: ['#4a5068'], r: ['#5f2e36'], z: ['#585654'], s: ['#66676a'], R: ['#7a2a33'], a: ['#38393e'],
  l: ['#7d6448'], b: ['#5e5a54'], n: ['#6f7478'], v: ['#34452e']   // generated homes: light oak, bedroom carpet, bathroom tile, lawn
};
/* Movable furniture and props: hp, chance a passing bullet hits it, weight, the bits it sheds, its wreck colours.
   fixed: bolted down (toilets, cabinets, vending machine, street lamps, the hydrant). */
const FURN = {
  S: { mat: 'soft', hp: 140, chance: 0.35, mass: 1.2, bits: ['#9a6a7a', '#7a4a5c', '#e8dfd2'], shape: 'fluff', wreck: ['#6e3b4a', '#86495b', '#4a2532'] },
  t: { mat: 'wood', hp: 70, chance: 0.30, mass: 1.0, bits: ['#8a6440', '#e8e2d6'], shape: 'splinter', wreck: ['#7d5838', '#5e4028', '#e8e2d6'] },
  P: { mat: 'ceramic', hp: 60, chance: 0.45, mass: 1.6, bits: ['#4a3a2a', '#4b8f57', '#6a7068'], shape: 'chip', wreck: ['#5a6058', '#3f7a4a', '#4a3a2a'] },
  L: { mat: 'thin', hp: 60, chance: 0.35, mass: 1.0, bits: ['#c8a64a', '#8a3a3a', '#3a6a8a'], shape: 'chip', wreck: ['#a88a3c', '#8a3a3a', '#3a6a8a'] },
  D: { mat: 'wood', hp: 140, chance: 0.40, mass: 1.6, bits: ['#8a6440', '#5e4028'], shape: 'splinter', wreck: ['#6b4a2e', '#7d5838', '#4a321e'] },
  B: { mat: 'wood', hp: 1e6, chance: 0.35, mass: 99, fixed: true, bits: ['#6a4030', '#4e2f22', '#c8a24a'], shape: 'splinter', wreck: ['#4e2f22', '#6a4030'] },   // bar and back bar
  K: { mat: 'metal', hp: 1e6, chance: 0.35, mass: 99, fixed: true, noBite: true, bits: ['#8a949e', '#6f7882'], shape: 'chip', wreck: ['#6f7882', '#8a949e'] },   // kitchen counters, stove island
  chair:  { mat: 'wood', hp: 30, chance: 0.12, mass: 0.35, bits: ['#8a6440', '#5e4028'], shape: 'splinter', wreck: ['#7a5636', '#5e4028'] },
  stool:  { mat: 'thin', hp: 30, chance: 0.12, mass: 0.35, bits: ['#8a8f98', '#5e4028'], shape: 'chip', wreck: ['#6a6f78', '#4a321e'] },
  ochair: { mat: 'soft', hp: 40, chance: 0.15, mass: 0.45, bits: ['#2c2e34', '#5a5d66'], shape: 'chip', wreck: ['#2c2e34', '#46484f'] },
  toilet: { mat: 'ceramic', hp: 70, chance: 0.45, mass: 99, fixed: true, bits: ['#eef0f2', '#cfd4d9'], shape: 'shard', wreck: ['#e2e5e8', '#c2c7cc', '#9aa0a6'] },
  urinal: { mat: 'ceramic', hp: 60, chance: 0.40, mass: 99, fixed: true, bits: ['#eef0f2', '#cfd4d9'], shape: 'shard', wreck: ['#e2e5e8', '#c2c7cc'] },
  stall:  { mat: 'thin', hp: 90, chance: 0.60, mass: 99, fixed: true, bits: ['#8c9aa4', '#6f7c86'], shape: 'chip', wreck: ['#7d8a94', '#5f6b74'] },
  cab:    { mat: 'metal', hp: 140, chance: 0.55, mass: 99, fixed: true, bits: ['#8a9098', '#e8e4d8'], shape: 'chip', wreck: ['#6f757d', '#e8e4d8'] },
  bin:    { mat: 'thin', hp: 25, chance: 0.25, mass: 0.5, bits: ['#4a4e56', '#d8d0b8'], shape: 'chip', wreck: ['#3a3e46', '#d8d0b8'] },
  lamp:   { mat: 'soft', hp: 20, chance: 0.18, mass: 0.4, bits: ['#f0e6c8', '#3a3a3a'], shape: 'shard', wreck: ['#d8ccae', '#2e2e2e'] },
  vend:   { mat: 'metal', hp: 160, chance: 0.65, mass: 99, fixed: true, bits: ['#3a5a9a', '#d0d6de', '#e85a3a'], shape: 'shard', wreck: ['#2a4a7a', '#9aa4b0'] },
  slamp:  { mat: 'metal', hp: 200, chance: 0.5, mass: 99, fixed: true, bits: ['#6a6e76', '#f0e0b0'], shape: 'shard', wreck: ['#4a4e56', '#f0e0b0'] },
  tcan:   { mat: 'thin', hp: 60, chance: 0.4, mass: 1.2, bits: ['#4a5a44', '#7a7a6a'], shape: 'chip', wreck: ['#3a4a36', '#6a6a5a'] },
  hydr:   { mat: 'metal', hp: 300, chance: 0.6, mass: 99, fixed: true, bits: ['#c8382e', '#8a241e'], shape: 'chip', wreck: ['#b8322a', '#8a241e'] },
  ccart:  { mat: 'soft', hp: 60, chance: 0.35, mass: 0.8, bits: ['#e0c63a', '#3a6aa8'], shape: 'chip', wreck: ['#c8b032', '#2e5a92'] },
  // the safe house: a lived-in home
  // vehicles: objects, not tiles. Bolted down (they don't get shoved), far too tough to wreck: rounds leave holes, sparks
  // and broken glass but take no chunks out (noBite). Mostly steel, so most rounds stop in them.
  c:      { mat: 'metal', hp: 1e6, chance: 0.85, mass: 99, fixed: true, noBite: true, rico: true, finish: 'paint', bits: ['#6a6e76', '#a8c8e0', '#2b2c30'], shape: 'shard', wreck: ['#4a4e56', '#2b2c30'] },
  y:      { mat: 'metal', hp: 1e6, chance: 0.85, mass: 99, fixed: true, noBite: true, rico: true, finish: 'paint', bits: ['#c9a227', '#a8c8e0', '#2b2c30'], shape: 'shard', wreck: ['#a8861f', '#2b2c30'] },
  bed:    { mat: 'soft', hp: 160, chance: 0.4, mass: 99, fixed: true, bits: ['#e8e2d6', '#4a5a7a', '#6a4a30'], shape: 'fluff', wreck: ['#d8d0c0', '#3a4a6a'] },
  nstand: { mat: 'wood', hp: 40, chance: 0.3, mass: 0.8, bits: ['#7a5a3c', '#f0e2c0'], shape: 'splinter', wreck: ['#6a4a2e', '#4a321e'] },
  ward:   { mat: 'wood', hp: 120, chance: 0.5, mass: 99, fixed: true, bits: ['#6a4a30', '#8a6440'], shape: 'splinter', wreck: ['#5a3e28', '#7a5838'] },
  shelf:  { mat: 'wood', hp: 100, chance: 0.5, mass: 99, fixed: true, bits: ['#6a4a30', '#a83a32', '#3a5a8a', '#d8c890'], shape: 'splinter', wreck: ['#5a3e28', '#a83a32', '#3a5a8a'] },
  sink:   { mat: 'ceramic', hp: 70, chance: 0.4, mass: 99, fixed: true, bits: ['#eef0f2', '#6a5a48'], shape: 'shard', wreck: ['#e2e5e8', '#5a4a38'] },
  tub:    { mat: 'ceramic', hp: 140, chance: 0.5, mass: 99, fixed: true, bits: ['#eef0f2', '#cfd4d9'], shape: 'shard', wreck: ['#e2e5e8', '#c2c7cc'] },
  locker: { mat: 'metal', hp: 220, chance: 0.6, mass: 99, fixed: true, bits: ['#4a4f45', '#2b2e28', '#6a705f'], shape: 'chip', wreck: ['#3a3e36', '#24261f'] },
  rack:   { mat: 'metal', hp: 160, chance: 0.5, mass: 99, fixed: true, bits: ['#4a4c50', '#2b2c30', '#7a5a3a'], shape: 'chip', wreck: ['#3a3c40', '#222327'] },
  tv:     { mat: 'thin', hp: 50, chance: 0.45, mass: 99, fixed: true, bits: ['#1a1b1e', '#6a8ab8'], shape: 'shard', wreck: ['#141518', '#2a2b2e'] },
  armch:  { mat: 'soft', hp: 80, chance: 0.35, mass: 1.1, bits: ['#7a5a4a', '#e8dfd2'], shape: 'fluff', wreck: ['#5e4236', '#7a5a4a'] },
  fridge: { mat: 'metal', hp: 160, chance: 0.6, mass: 99, fixed: true, bits: ['#d8dadc', '#9aa0a6'], shape: 'chip', wreck: ['#c2c6ca', '#8a9096'] },
  plant:  { mat: 'ceramic', hp: 30, chance: 0.3, mass: 0.6, bits: ['#8a4a32', '#4b8f57'], shape: 'chip', wreck: ['#7a3e28', '#3f7a4a'] },
  grill:  { mat: 'metal', hp: 120, chance: 0.5, mass: 1.4, bits: ['#2b2c30', '#6a6e76'], shape: 'chip', wreck: ['#222327', '#4a4e56'] },
  bench:  { mat: 'wood', hp: 70, chance: 0.3, mass: 1.2, bits: ['#8a6440', '#5e4028'], shape: 'splinter', wreck: ['#7a5636', '#5e4028'] },
  // generated homes: the rest of a lived-in house
  stbl:    { mat: 'wood', hp: 35, chance: 0.25, mass: 0.6, bits: ['#7a5a3c', '#f0e2c0'], shape: 'splinter', wreck: ['#6a4a2e', '#4a321e'] },     // side table
  dresser: { mat: 'wood', hp: 110, chance: 0.5, mass: 99, fixed: true, bits: ['#6a4a30', '#8a6440'], shape: 'splinter', wreck: ['#5a3e28', '#7a5838'] },
  chest:   { mat: 'wood', hp: 80, chance: 0.4, mass: 1.4, bits: ['#6a4a30', '#c8a24a'], shape: 'splinter', wreck: ['#5a3e28', '#7a5838'] },       // blanket chest
  side:    { mat: 'wood', hp: 100, chance: 0.5, mass: 99, fixed: true, bits: ['#5a3e28', '#8a6440'], shape: 'splinter', wreck: ['#4a321e', '#7a5838'] },   // sideboard / console
  washer:  { mat: 'metal', hp: 140, chance: 0.6, mass: 99, fixed: true, bits: ['#e8eaec', '#9aa0a6'], shape: 'chip', wreck: ['#d2d6da', '#8a9096'] },
  shower:  { mat: 'ceramic', hp: 120, chance: 0.5, mass: 99, fixed: true, bits: ['#eef0f2', '#a8c8e0'], shape: 'shard', wreck: ['#e2e5e8', '#a8c8e0'] },
  shrub:   { mat: 'soft', hp: 90, chance: 0.4, mass: 99, fixed: true, bits: ['#3f7a4a', '#5a9a5c', '#4a3524'], shape: 'fluff', wreck: ['#3f6a3a', '#4a3524'] },
  ptable:  { mat: 'thin', hp: 60, chance: 0.3, mass: 1.0, bits: ['#d8d6d0', '#4a4e56'], shape: 'chip', wreck: ['#c8c6c0', '#3a3e46'] },          // patio table with an umbrella
  mailbox: { mat: 'metal', hp: 80, chance: 0.4, mass: 99, fixed: true, bits: ['#2a2b2e', '#c8382e'], shape: 'chip', wreck: ['#222327', '#8a241e'] },
  ac:      { mat: 'metal', hp: 200, chance: 0.6, mass: 99, fixed: true, rico: true, bits: ['#c8ccd0', '#6a6e76'], shape: 'chip', wreck: ['#a8acb0', '#4a4e56'] },   // AC condenser
  bike:    { mat: 'thin', hp: 40, chance: 0.15, mass: 0.6, bits: ['#c83a2a', '#2a2b2e'], shape: 'chip', wreck: ['#a83228', '#1d1e21'] },
  boxes:   { mat: 'soft', hp: 50, chance: 0.4, mass: 1.0, bits: ['#b8905a', '#d8c090'], shape: 'chip', wreck: ['#9a7848', '#c8b080'] },          // moving boxes
  laundry: { mat: 'soft', hp: 25, chance: 0.2, mass: 0.4, bits: ['#d8d0b8', '#3a5a8a'], shape: 'fluff', wreck: ['#c8c0a8', '#3a5a8a'] },
  otto:    { mat: 'soft', hp: 40, chance: 0.25, mass: 0.6, bits: ['#7a5a4a', '#e8dfd2'], shape: 'fluff', wreck: ['#5e4236', '#7a5a4a'] }           // ottoman / footstool
};
const VEH = { tyreHp: 20, lampHp: 6, glassHp: 14, mirrorHp: 8, signHp: 10, doorOpen: 1.1, beam: 300, beamHalf: 0.42 };   // vehicle parts (see VEHICLES)
const FIXED_CHANCE = { c: 0.35, y: 0.35, B: 0.3, K: 0.3, D: 0.3, S: 0.35 };   // built-ins: hit chance per tile a bullet crosses
const WALL_BITS = ['#6a6a70', '#55555c', '#7e7e86'], WOOD_BITS = ['#8a6440', '#5e4028', '#9a7450'], GLASS_BITS = ['#a8c8e0', '#c8dcec', '#6a7078'];
const CRATE_NOTCH = ['#3a2c1c', '#24190f'];   // a bite out of a crate's slats
const CRATE_HP = 110, DOOR_HP = 90, DOOR_MUL = 3;
const GLASS_NOISE = 320;   // shattering glass is loud
/* Doors are hinged slabs: walk into one and you shove it open (they swing both ways). Fire, restroom, kitchen and
   street doors have closers that pull them shut; office-type doors stay wherever they were left. */
const DOOR = { thick: 4, push: 1.15, damp: 2.0, closer: 4, max: 1.75, noise: 240, pull: 3.2, pullT: 0.8, oneWay: false };   // oneWay: home doors only swing into rooms (off: bots get caught in the pocket behind them)   // pull: how fast (rad/s) a door swings when pulled open the other way; pullT: how long it keeps going
const SELF_CLOSING = [];   // per DOOR_DEFS entry (from MAP.doors)   // opens when someone is this close; stays open this long; creak reach
const SCRAPE_NOISE = 200;                                        // dragging furniture makes noise too
const PUSH_POWER = 1.0;                                          // heavier furniture moves slower when pushed
/* Doorways that get doors (inclusive tile ranges), filled from MAP.doors. The wide arches and the main entrance stay open. */
const DOOR_DEFS = [];
applyMap();

let EDGES = null, FLOOR_ART = null, artG = null;
let pieces = [], doors = [];
const doorAt = new Int16Array(W * H).fill(-1);
const occ = new Uint8Array(W * H);      // tiles taken by movable furniture (for route planning)
let occDirty = false, occT = 0;
const crateHp = new Map();
const coverComp = new Int32Array(W * H);   // which piece of built-in low cover each tile belongs to (-1 = none)
/* Wall materials (by wallMat): the colour a bullet mark shows, the chips it throws, whether rounds glance off. */
const MAT = [null,
  { name: 'drywall',  rico: false, exposed: '#d6cfbf', bits: ['#e2dccf', '#c9c2b2', '#b8b0a0'] },
  { name: 'concrete', rico: true,  exposed: '#56565d', bits: ['#6a6a70', '#55555c', '#7e7e86'] },
  { name: 'metal',    rico: true,  exposed: '#6c7078', bits: ['#9aa0a8', '#6c7078'] }];
const wallMat = new Uint8Array(W * H);
function classifyWalls() {                                 // street-facing walls are concrete, columns too, elevators metal, the rest drywall
  for (let k = 0; k < W * H; k++) {
    const c = solidAt[k], i = k % W, j = (k / W) | 0;
    if (c === 'E') { wallMat[k] = 3; continue; }
    if (c === 'C') { wallMat[k] = 2; continue; }
    if (c !== '#') { wallMat[k] = 0; continue; }
    let out = i === 0 || j === 0 || i === W - 1 || j === H - 1;
    for (let b = -1; b <= 1 && !out; b++) for (let a = -1; a <= 1; a++) { const ni = i + a, nj = j + b; if (ni >= 0 && nj >= 0 && ni < W && nj < H && 'saRv'.includes(floorAt[nj * W + ni]) && solidAt[nj * W + ni] !== '#') out = true; }
    wallMat[k] = out ? 2 : 1;
  }
}
const glassSeg = new Map();             // window tile -> which of its glass strips are still in (see shatterWindow)
const debris = [];                      // bits in flight; once they stop they're painted into the floor for good
const mists = [];                       // red mist at fresh wounds (see BLOOD FX)
let civs = [];                          // innocent bystanders (see CIVILIANS)
const alarms = [];                      // recent gunshots civilians react to
let simT = 0;                           // game clock
let benchPiece = null, lockerPiece = null, tvPiece = null, pcPiece = null;                  // the safe house workbench piece (found in buildProps, see WORKBENCH)
let carried = [], handedOver = 0;       // civilians you've secured and are bringing out (look keys); how many the Army has taken off your hands (see RESCUE)
