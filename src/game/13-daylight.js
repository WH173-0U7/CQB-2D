/* ================= DAYLIGHT =================
   Day missions (MAP.day, picked on the mission PC): bright outside, and the daylight comes in through the windows.
   `dayNight()` (run by resetGame for every map; the first map, at load, is the safe house at night) sets how dark it is and how far you make out a person in the dark: on a
   day map the darkness left indoors is lighter (DAY.ambient) and shapes are made out further off (DAY.see). Outdoors is
   carved bright (`OUT_PATH`, DAY.out, and `outLit` for sight and shading); every run of window tiles gets a sun light just
   inside it (`SUN`, gathered and cached like the fixtures, `DAY.win.in` tiles into the room), so the room fills with light
   that fades away from the glass and walls cast real shadows (spilling through open doors): rooms with windows are bright, hallways, closets and windowless rooms stay dim. Ceiling lights and street
   lamps are off, and the NVG stays up. */
const DAY = { ambient: 0.55, out: 0.9, see: { dark: 250, darkView: 300, darkK: 0.5 }, win: { in: 0.35, r: 6.5 * T, k: 0.75, col: [255, 244, 222] } };
const NIGHT = { ambient: LIGHT.ambient, see: { dark: SEE.dark, darkView: SEE.darkView, darkK: SEE.darkK } };
const SUN = [];
let OUT_PATH = null;
const outLit = (x, y) => !!MAP.day && isOut(x, y) && !wall(Math.floor(x / T), Math.floor(y / T));   // out in broad daylight
function dayNight() {
  const D = MAP.day ? DAY : NIGHT;
  LIGHT.ambient = D.ambient; Object.assign(SEE, D.see);
  SUN.length = 0; OUT_PATH = null;
  if (!MAP.day) return;
  const inside = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
  const outF = (i, j) => inside(i, j) && OUTDOOR.includes(floorAt[j * W + i]) && !wall(i, j);
  const isWin = (i, j) => inside(i, j) && 'Gg'.includes(solidAt[j * W + i]);
  OUT_PATH = new Path2D();
  for (let j = 0; j < H; j++) for (let i = 0; i < W;) {             // the outdoor floor, in runs along each row
    if (!outF(i, j)) { i++; continue; }
    let e = i; while (outF(e, j)) e++;
    OUT_PATH.rect(i * T, j * T, (e - i) * T, T); i = e;
  }
  const done = new Set();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {           // each run of windows: a sun light just inside its middle
    if (!isWin(i, j) || done.has(j * W + i)) continue;
    for (const [nx, ny] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {      // the side that's outdoors
      if (!outF(i + nx, j + ny)) continue;
      const ax = ny ? 1 : 0, ay = nx ? 1 : 0;                       // along the wall
      let n = 0;
      while (isWin(i + ax * n, j + ay * n) && outF(i + ax * n + nx, j + ay * n + ny)) { done.add((j + ay * n) * W + i + ax * n); n++; }
      const cx = (i + 0.5 + ax * (n - 1) / 2) * T, cy = (j + 0.5 + ay * (n - 1) / 2) * T, o = (0.5 + DAY.win.in) * T;
      SUN.push({ x: cx - nx * o, y: cy - ny * o, r: DAY.win.r + (n - 1) * T * 0.4, k: DAY.win.k, col: DAY.win.col });
      break;
    }
  }
}
