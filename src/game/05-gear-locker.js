/* ================= GEAR LOCKER =================
   Tactical kit in a steel locker in the armory (MAP.locker, `lockerPiece`), opened like the workbench (walk into its ring).
   Gear unlocks after enough missions completed (`prog.missions`: a cleared home you drove back from), then costs medals.
   Night vision is worn (prog.wear) and flips down on missions (N or the NVG button flips it up); grenades are bought once
   (prog.gear) and then carried, `n` of each, topped up at the locker or the armory restock (see GRENADES). */
const GEAR = [
  { id: 'nvg', kind: 'wear', name: 'NIGHT VISION', real: 'L3Harris AN/PVS-14 monocular, white phosphor, on a Wilcox L4 G24 mount', price: 30, missions: 6, fx: 'See further in the dark through one tube (N flips it up)' },
  { id: 'm84', kind: 'nade', n: 2, name: 'STUN GRENADES', real: 'M84 stun grenade: two in a pouch on your carrier', price: 5, missions: 1, fx: 'A blinding flash and a deafening bang: stuns whoever sees and hears it' },
  { id: 'mk3', kind: 'nade', n: 2, name: 'CONCUSSION GRENADES', real: 'Mk3A2 offensive hand grenade: two in a pouch', price: 8, missions: 3, fx: 'A blast that kills close up and stuns further out. Plates don\'t stop it' }];
// night vision: how far you make out people in the dark, how far and how well the view shows, the darkness left over everything, flip time (s), flash blindness multiplier, film grain
const NVG = { see: 330, view: 360, k: 0.6, flat: 0.72, flip: 0.35, blind: 1.8, grain: 0.05, half: 0.5, soft: 0.08 };   // half: the monocular's field either side of where you face (rad, ~57° in all); soft: its edge fades over this much
const nvgOn = () => (p.nvgK || 0) > 0.6 && (state === 'play' || state === 'downed');
const pDarkR = off => nvgOn() && Math.abs(off) < NVG.half ? NVG.see : SEE.dark;   // how far you make out a person in the dark at `off` rad from where you face: further only inside the tube's field
function loadProg() { try { const s = JSON.parse(localStorage.getItem('ds_prog')); if (s && s.kills && s.fit && s.owned) return Object.assign(newProg(), s); } catch (_) {} return newProg(); }
function saveProg() { try { localStorage.setItem('ds_prog', JSON.stringify(prog)); } catch (_) {} }
let prog = loadProg();
carried = prog.carried || []; handedOver = prog.handed || 0;   // the civilians still with you and the running total are saved too
const fitSet = w => { const o = {}; for (const id of Object.values(prog.fit[w])) o[id] = true; return o; };
const pWeapon = () => p.side && p.side.out ? 'glock' : 'ak';
const attOn = id => bench ? !!benchShown(pWeapon())[id] : Object.values(prog.fit[pWeapon()]).includes(id);   // fitted to the gun in your hands (at the bench: once it's actually on)
const laserOn = () => attOn('laser') || (attOn('ir') && nvgOn());   // the IR laser only exists for you through the night vision
const rags = [];                        // ragdolls of the dead, until they're painted into the floor (see RAGDOLLS)
const BITE_MAX = 16;                    // chunks shot out of one piece of furniture (each costs a clip when drawing)
const BLOOD_CELL = 12, BMW = Math.ceil(W * T / BLOOD_CELL), BMH = Math.ceil(H * T / BLOOD_CELL);
const bloodMap = new Uint8Array(BMW * BMH);   // how much blood is on each 12px patch of floor
const glassMap = new Uint8Array(BMW * BMH);   // how many glass pieces have settled on each patch (they crunch underfoot)
const GLASS_PIECE = new Set(['#a8c8e0', '#c8dcec', '#a8cbe4']), GLASS_STEP = 1.5;   // glass debris colours; a step on glass carries this much further
const addGlass = d => { if (!GLASS_PIECE.has(d.col)) return; const i = Math.floor(d.x / BLOOD_CELL), j = Math.floor(d.y / BLOOD_CELL); if (i >= 0 && j >= 0 && i < BMW && j < BMH) glassMap[j * BMW + i] = Math.min(255, glassMap[j * BMW + i] + 1); };
function glassAt(x, y, r) {                    // glass pieces lying within r px of a spot
  let n = 0;
  for (let j = Math.max(0, Math.floor((y - r) / BLOOD_CELL)); j <= Math.min(BMH - 1, Math.floor((y + r) / BLOOD_CELL)); j++)
    for (let i = Math.max(0, Math.floor((x - r) / BLOOD_CELL)); i <= Math.min(BMW - 1, Math.floor((x + r) / BLOOD_CELL)); i++) n += glassMap[j * BMW + i];
  return n;
}

/* Rebuild the whole world: walls, furniture, doors, floor art. Called at start and on restart. */
function initWorld() {
  grid.set(BASE_GRID); opq.set(BASE_OPQ);
  for (let k = 0; k < W * H; k++) solidAt[k] = BASE_SOLID[k];
  pieces = buildPieces();
  doors = buildDoors();
  buildProps();
  crateHp.clear(); glassSeg.clear(); classifyWalls();
  rebuildEdges(); rebuildOcc(); occDirty = false;
  buildCoverComps();
  debris.length = 0; bloodMap.fill(0); glassMap.fill(0); rags.length = 0; mists.length = 0;
  FLOOR_ART = buildFloorArt(); artG = FLOOR_ART.getContext('2d'); buildWallPath();
  for (const f of pieces) pieceSprite(f, f.pad === undefined ? 3 : f.pad);   // made now, with the map, rather than mid-fight when a piece first comes into view
  setFixtures(MAP.fixtures);
}

/* Group built-in low cover (counters, bar, banquette, big desks, cars, window sills) into whole objects. */
function buildCoverComps() {
  const cls = c => (c === 'G' || c === 'g') ? 'W' : 'BKDScy'.includes(c) && c !== '.' ? c : null;
  coverComp.fill(-1);
  let id = 0;
  for (let k = 0; k < W * H; k++) {
    if (coverComp[k] >= 0) continue;
    const c0 = cls(solidAt[k]);
    if (!c0) continue;
    const stack = [k]; coverComp[k] = id;
    while (stack.length) {
      const q = stack.pop(), qi = q % W, qj = (q / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = qi + dx, nj = qj + dy, n = nj * W + ni;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H || coverComp[n] >= 0 || cls(solidAt[n]) !== c0) continue;
        coverComp[n] = id; stack.push(n);
      }
    }
    id++;
  }
}
/* Built-in furniture (the bar, counters, the banquette, reception desk, meeting table) is a bolted-down object of its real
   depth, not a block of tiles: a 1-tile-deep run sits against the wall it backs onto (or stands centred if free), at
   BUILT_DEPTH px deep; ends that meet more of the same (the bar's L) reach in to join it; bigger blocks are inset a little. */
const BUILT_DEPTH = { B: 34, K: 32, S: 36, D: 38, backbar: 22 };
function builtIn(c, i, j, w, h, room) {
  const across = w >= h, thin = across ? h === 1 : w === 1, wallAt = (a, b) => a < 0 || b < 0 || a >= W || b >= H || '#ECGgX'.includes(BASE_SOLID[b * W + a]);   // the original map: runs already turned into objects are '.' by now
  let x = i * T, y = j * T, pw = w * T, ph = h * T, kind = null;
  if (c === 'D') kind = w >= 4 ? 'meeting' : h >= 5 ? 'reception' : null;
  if (thin) {
    const back = across ? (wallAt(i, j - 1) ? -1 : wallAt(i, j + 1) ? 1 : 0) : (wallAt(i - 1, j) ? -1 : wallAt(i + w, j) ? 1 : 0);
    if (c === 'B' && !across && back === 1) kind = 'backbar';
    const dep = BUILT_DEPTH[kind === 'backbar' ? 'backbar' : c] || 36, off = back < 0 ? 0 : back > 0 ? T - dep : (T - dep) / 2;
    if (across) { y += off; ph = dep; } else { x += off; pw = dep; }
    const same = (a, b) => a >= 0 && b >= 0 && a < W && b < H && BASE_SOLID[b * W + a] === c;
    if (across) { if (same(i - 1, j)) { x -= T / 2; pw += T / 2; } if (same(i + w, j)) pw += T / 2; }
    else { if (same(i, j - 1)) { y -= T / 2; ph += T / 2; } if (same(i, j + h)) ph += T / 2; }
  } else { const ins = c === 'D' ? 8 : 4; x += ins; y += ins; pw -= ins * 2; ph -= ins * 2; }
  const F = FURN[c];
  return { c, x, y, w: pw, h: ph, pad: 2, hp: 1e6, maxHp: 1e6, mass: 99, fixed: true, builtin: true, kind, noBite: !!F.noBite,
    holes: [], seed: Math.random() * 1000, scrape: 0, broken: false, pusher: null, room };
}
function buildPieces() {
  const out = [], seen = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, c = solidAt[k];
    if (!FURN[c] || seen[k] || !'StPLDBK'.includes(c)) continue;
    let w = 1; while (i + w < W && solidAt[k + w] === c && !seen[k + w]) w++;
    let h = 1;
    grow: while (j + h < H) { for (let q = 0; q < w; q++) if (solidAt[(j + h) * W + i + q] !== c || seen[(j + h) * W + i + q]) break grow; h++; }
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) seen[(j + yy) * W + i + xx] = 1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const kk = (j + yy) * W + i + xx; solidAt[kk] = '.'; grid[kk] = 0; }
    const area = w * h, F = FURN[c], room = floorAt[(j + (h >> 1)) * W + i + (w >> 1)];
    if (area > 4 || 'BK'.includes(c)) { out.push(builtIn(c, i, j, w, h, room)); continue; }
    const inset = c === 't' ? 9 : 3, hp = F.hp * Math.sqrt(area);
    const pw = w * T - inset * 2, ph = h * T - inset * 2, jit = () => (Math.random() - 0.5) * 2 * (inset - 1);   // not dead on the grid: a little off-centre
    out.push({ c, x: i * T + inset + jit(), y: j * T + inset + jit(), w: pw, h: ph, pad: 3,
      hp, maxHp: hp, mass: F.mass * area, holes: [], seed: Math.random() * 1000, scrape: 0, broken: false, pusher: null, room });
  }
  return out;
}

function buildDoors() {
  doorAt.fill(-1);
  return DOOR_DEFS.map(([x0, y0, x1, y1], idx) => {
    const axis = y0 === y1 && (x0 !== x1 || (wall(x0 - 1, y0) && wall(x1 + 1, y0))) ? 'h' : 'v';
    const tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * W + x; tiles.push(k); doorAt[k] = idx; }
    const side = axis === 'h' ? (wall(x0, y0 + 1) ? -1 : 1) : (wall(x0 + 1, y0) ? -1 : 1);   // swing into the open side
    const n = axis === 'h' ? x1 - x0 + 1 : y1 - y0 + 1, leaves = [];
    if (axis === 'h') {
      const yc = (y0 + 0.5) * T;
      if (n === 1) leaves.push({ hx: x0 * T, hy: yc, base: 0, L: T });
      else { leaves.push({ hx: x0 * T, hy: yc, base: 0, L: n * T / 2 }); leaves.push({ hx: (x1 + 1) * T, hy: yc, base: Math.PI, L: n * T / 2 }); }
    } else {
      const xc = (x0 + 0.5) * T;
      if (n === 1) leaves.push({ hx: xc, hy: y0 * T, base: Math.PI / 2, L: T });
      else { leaves.push({ hx: xc, hy: y0 * T, base: Math.PI / 2, L: n * T / 2 }); leaves.push({ hx: xc, hy: (y1 + 1) * T, base: -Math.PI / 2, L: n * T / 2 }); }
    }
    for (const l of leaves) {
      l.th = 0; l.w = 0; creakStop(l); l.creak = false; l.wasOpen = false; l.hi = leafLimit(l, 1); l.lo = -leafLimit(l, -1);
      if (MAP.gen && DOOR.oneWay) {                                 // a home's doors swing one way, like real ones: into the room, never out into the hallway, and inward from outside
        const side = dir => { const a = l.base + dir * 1.2, f = floorAt[Math.floor((l.hy + Math.sin(a) * l.L * 0.6) / T) * W + Math.floor((l.hx + Math.cos(a) * l.L * 0.6) / T)] || ''; return OUTDOOR.includes(f) ? 2 : f === 'w' ? 1 : 0; };
        const sp = side(1), sn = side(-1);
        if (sp > sn) l.hi = 0.04; else if (sn > sp) l.lo = -0.04;
      }
    }
    const d = { axis, tiles, rx0: x0 * T, ry0: y0 * T, rx1: (x1 + 1) * T, ry1: (y1 + 1) * T, n, side, leaves,
      closer: SELF_CLOSING[idx], hp: DOOR_HP, broken: false, closed: false };
    setDoorSolid(d, true);
    return d;
  });
}
/* How far a leaf can swing each way (rad, up to DOOR.max) before any part of it, slab thickness included, would enter
   a wall, window, column or crate: it stops there instead of swinging into the wall beside it. */
function leafLimit(l, dir) {
  const hit = (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); if (i < 0 || j < 0 || i >= W || j >= H) return true; const k = j * W + i; return doorAt[k] < 0 && '#EGgCX'.includes(solidAt[k]); };
  let ok = 0;
  for (let a = 0.04; a <= DOOR.max + 1e-6; a += 0.02) {
    const ang = l.base + dir * a, c = Math.cos(ang), s = Math.sin(ang), h = 1;   // the slab's corner at the hinge turns about the jamb: only the leaf beyond it counts
    for (let q = 8; q <= l.L; q += 3) for (const o of [-h, h]) if (hit(l.hx + c * q - s * o, l.hy + s * q + c * o)) return Math.max(0.3, ok);
    ok = a;
  }
  return DOOR.max;
}
function setDoorSolid(d, closed) {   // the slab itself blocks bodies and bullets; the doorway just stops light while it's shut
  d.closed = closed;
  for (const k of d.tiles) { grid[k] = 0; opq[k] = closed ? 1 : 0; }
}

/* Outlines of walls/columns/crates (what light can catch). */
let edgesDirty = false;                                     // set when the walls change; the outline is rebuilt once at the next render
let edgeVer = 0;
function rebuildEdges() {
  edgeVer++;
  lightCorners = null;                                   // walls changed: the corner list for shadows is rebuilt on demand
  EDGES = new Path2D();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!opq[j * W + i] || doorAt[j * W + i] >= 0) continue;
    const px = i * T, py = j * T;
    const o = (a, b) => opaque(a, b) && (a < 0 || b < 0 || a >= W || b >= H || doorAt[b * W + a] < 0);
    if (!o(i, j - 1)) { EDGES.moveTo(px, py); EDGES.lineTo(px + T, py); }
    if (!o(i, j + 1)) { EDGES.moveTo(px, py + T); EDGES.lineTo(px + T, py + T); }
    if (!o(i - 1, j)) { EDGES.moveTo(px, py); EDGES.lineTo(px, py + T); }
    if (!o(i + 1, j)) { EDGES.moveTo(px + T, py); EDGES.lineTo(px + T, py + T); }
  }
}
function rebuildOcc() {
  occ.fill(0);
  for (const f of pieces) {
    if (f.broken || (!f.fixed && f.mass < 1)) continue;   // chairs, stools, bins: bots just shove them aside
    const i0 = Math.floor((f.x + 6) / T), i1 = Math.floor((f.x + f.w - 6) / T);
    const j0 = Math.floor((f.y + 6) / T), j1 = Math.floor((f.y + f.h - 6) / T);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (i >= 0 && j >= 0 && i < W && j < H) occ[j * W + i] = 1;
  }
}

/* Does a straight line enter this box? Returns the distance where it enters (0 if it starts inside), or -1. */
function segBox(ox, oy, ux, uy, maxD, x, y, w, h) {
  let t0 = 0, t1 = maxD;
  if (Math.abs(ux) < 1e-9) { if (ox < x || ox > x + w) return -1; }
  else { let a = (x - ox) / ux, c = (x + w - ox) / ux; if (a > c) { const s = a; a = c; c = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1; }
  if (Math.abs(uy) < 1e-9) { if (oy < y || oy > y + h) return -1; }
  else { let a = (y - oy) / uy, c = (y + h - oy) / uy; if (a > c) { const s = a; a = c; c = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1; }
  return t0;
}

/* Floors, built-in furniture and street details are painted once into an offscreen image.
   Debris, casings, bullet holes, blood and wrecks are painted into it later and stay there. */
