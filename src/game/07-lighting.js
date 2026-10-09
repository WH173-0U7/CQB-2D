/* ================= LIGHTING =================
   The hotel is dark. Light comes from every muzzle flash and the building's own fixtures (and weapon lights, once fitted):
   street lamps, green EXIT signs, the bar's backlight, a vending machine, elevator floor indicators, desk
   lamps, monitors, and one failing tube in the back corridor. Shoot a lamp out and its light is gone. */
const LIGHT = { ambient: 0.82, tint: 0.2, res: 0.5 };   // res: the darkness map is built at this share of screen resolution
/* Every light in the building is a real fixture you can see and shoot out: [kind, fixture centre x, y, w, h (px), light x, y, radius, colour, strength, hp].
   (Street lamps, floor lamps, the vending machine and desk monitors are furniture pieces with a `light`.) */
const HOTEL_FIXTURES = [
  ['exit', 15.5 * T, 20.92 * T, 16, 6, 15.5 * T, 20.5 * T, 110, [90, 255, 140], 0.35, 1],    // EXIT signs over the doors
  ['exit', 5.5 * T, 20.92 * T, 16, 6, 5.5 * T, 20.5 * T, 100, [90, 255, 140], 0.35, 1],
  ['exit', 33.5 * T, 20.92 * T, 16, 6, 33.5 * T, 20.5 * T, 100, [90, 255, 140], 0.35, 1],
  ['exit', 16.5 * T, 4.08 * T, 16, 6, 16.5 * T, 4.5 * T, 100, [90, 255, 140], 0.35, 1],
  ['strip', 34.95 * T, 14.5 * T, 3, 5.6 * T, 34.6 * T, 14.5 * T, 160, [255, 170, 80], 0.5, 3],   // LED strip along the back bar
  ['indicator', 14 * T, 4.06 * T, 14, 4, 14 * T, 4.3 * T, 55, [255, 170, 60], 0.3, 1],   // elevator floor indicators
  ['indicator', 18 * T, 4.06 * T, 14, 4, 18 * T, 4.3 * T, 55, [255, 170, 60], 0.3, 1],
  ['tube', 17 * T, 1.06 * T, 34, 4, 17 * T, 1.5 * T, 190, [205, 230, 255], 0.55, 1, true],   // the failing tube in the back corridor
  ['lamp', 19.5 * T, 14.6 * T, 12, 12, 19.5 * T, 14.6 * T, 110, [255, 210, 150], 0.45, 1],   // reception desk lamp
  ['hood', 4.5 * T, 7 * T, 40, 12, 4.5 * T, 7 * T, 140, [255, 236, 200], 0.35, 2],   // lamps under the kitchen range hood
  ['mirror', 10.5 * T, 4.06 * T, 26, 4, 10.5 * T, 4.6 * T, 90, [220, 240, 255], 0.3, 2],   // light bars over the restroom mirrors
  ['mirror', 21.5 * T, 4.06 * T, 26, 4, 21.5 * T, 4.6 * T, 90, [220, 240, 255], 0.3, 2]
];
MAPS.hotel.fixtures = HOTEL_FIXTURES;
const FIXTURES = [];
function setFixtures(rows) {
  FIXTURES.length = 0;
  for (const [kind, hx, hy, w, h, x, y, r, col, k, hp, flicker, unlit] of rows || []) FIXTURES.push({ kind, hx, hy, w, h, x, y, r, col, k, hp, hp0: hp, flicker: !!flicker, unlit: !!unlit, off: false, die: 0 });   // unlit: switched off (still there, still breakable)
}
/* A round through a fixture: it takes the hit (rounds pass on through), and at 0 hp it's dead: sparks, glass, a last sputter. */
function hitFixtures(b, maxD) {
  for (const f of FIXTURES) {
    if (f.off) continue;
    const te = segBox(b.x, b.y, b.ux, b.uy, maxD, f.hx - f.w / 2 - 1, f.hy - f.h / 2 - 1, f.w + 2, f.h + 2);
    if (te < 0) continue;
    const x = b.x + b.ux * te, y = b.y + b.uy * te;
    burst(x, y, 5, 'rgba(255,240,200,0.9)', 120);
    for (let n = 0; n < 4; n++) { const a = Math.random() * 6.28, v = 40 + Math.random() * 90;
      debris.push({ x, y, vx: Math.cos(a) * v + b.ux * 60, vy: Math.sin(a) * v + b.uy * 60, rot: a, vr: (Math.random() - 0.5) * 20, col: 'rgba(225,235,245,0.75)', shape: 'shard', size: 1.6 + Math.random(), fric: 5, t: 0 }); }
    if (--f.hp <= 0) { f.off = true; f.die = f.unlit ? 0 : 0.35; if (!f.unlit) burst(x, y, 10, 'rgba(255,255,230,1)', 200); }
  }
}
function stepFixtures(dt) { for (const f of FIXTURES) if (f.die > 0) f.die -= dt; }
/* The fixtures themselves. `lit` = the glowing part, drawn again over the darkness so a working light shows its source. */
function drawFixtures(lit, t) {
  for (const f of FIXTURES) {
    if (lit && ((f.off && f.die <= 0) || (f.unlit && !f.off))) continue;
    const on = !f.off || f.die > 0, c = f.col, x = f.hx - f.w / 2, y = f.hy - f.h / 2;
    let k = 1;
    if (f.flicker) k = Math.sin(t * 9.1) * Math.sin(t * 3.7) > 0.55 ? 0.15 : 1;
    if (f.off) k = Math.random() < 0.5 ? 0.1 : 0.7;
    const glow = 'rgba(' + c.map(v => Math.min(255, v + 40)).join(',') + ',' + (0.95 * k).toFixed(2) + ')';
    ctx.save();
    if (!lit) {                                                      // housing (and broken bits)
      ctx.fillStyle = f.kind === 'lamp' ? '#3a3226' : '#2a2c30'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
      if (f.kind === 'lamp') { ctx.beginPath(); ctx.arc(f.hx, f.hy, f.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else if (f.kind === 'ceil') {                                     // a flush ceiling light: white trim, a frosted dome (grey when it's switched off)
        ctx.fillStyle = '#d6d2ca'; ctx.beginPath(); ctx.arc(f.hx, f.hy, f.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = f.unlit ? '#a8acb0' : '#e8e6e0'; ctx.beginPath(); ctx.arc(f.hx, f.hy, f.w / 2 - 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(f.hx - f.w * 0.12, f.hy - f.w * 0.12, f.w * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      else if (f.kind === 'hood') { ctx.strokeStyle = 'rgba(150,155,160,0.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 10, y - 8, f.w + 20, f.h + 16); ctx.fillRect(x, y, f.w, f.h); }
      else { ctx.fillRect(x - 1, y - 1, f.w + 2, f.h + 2); ctx.strokeRect(x - 1, y - 1, f.w + 2, f.h + 2); }
      if (f.off && f.die <= 0) {                                       // dead: dark glass, cracked
        ctx.fillStyle = 'rgba(20,22,26,0.9)'; if (f.kind === 'lamp' || f.kind === 'ceil') { ctx.beginPath(); ctx.arc(f.hx, f.hy, f.w / 2 - 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(x, y, f.w, f.h);
        ctx.strokeStyle = 'rgba(200,210,220,0.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(f.hx - f.w * 0.3, f.hy - f.h * 0.3); ctx.lineTo(f.hx + f.w * 0.1, f.hy + f.h * 0.2); ctx.lineTo(f.hx + f.w * 0.35, f.hy - f.h * 0.1); ctx.stroke();
      }
    } else if (on) {                                                 // the lit face
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow;
      if (f.kind === 'lamp' || f.kind === 'ceil') { ctx.beginPath(); ctx.arc(f.hx, f.hy, f.w / 2 - 2, 0, Math.PI * 2); ctx.fill(); }
      else if (f.kind === 'hood') { for (const q of [0.25, 0.75]) { ctx.beginPath(); ctx.arc(x + f.w * q, f.hy, 3, 0, Math.PI * 2); ctx.fill(); } }
      else if (f.kind === 'mirror') { for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(x + 3 + q * (f.w - 6) / 3, f.hy, 1.6, 0, Math.PI * 2); ctx.fill(); } }
      else ctx.fillRect(x, y, f.w, f.h);
      if (f.kind === 'exit' && k > 0.5) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(10,40,20,0.9)'; ctx.font = '700 4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXIT', f.hx, f.hy + 0.3); }
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(f.hx, f.hy, 0, f.hx, f.hy, Math.max(f.w, f.h) * 0.9 + 6);
      gg.addColorStop(0, 'rgba(' + c.join(',') + ',' + (0.35 * k).toFixed(2) + ')'); gg.addColorStop(1, 'rgba(' + c.join(',') + ',0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(f.hx, f.hy, Math.max(f.w, f.h) * 0.9 + 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
const flashes = [];
/* Shots from someone you can't see (off-screen or in the dark): a red marker at the screen edge points to where they came from. */
const threats = [], THREAT_T = 1.4;
let threatXf = null;   // the world-to-screen transform from the last render   // muzzle flashes, lighting the room for an instant
let lightCv = null, lightG = null, postLv = null;   // postLv: the half / quarter / eighth size canvases the suppression blur is built in
/* Light ignores doorway tiles and stops at the door slabs themselves, wherever they've swung to (refreshed each render). */
const lightBlock = (i, j) => opaque(i, j) && (i < 0 || j < 0 || i >= W || j >= H || doorAt[j * W + i] < 0);
let doorSegs = [];
function refreshDoorSegs() {
  doorSegs = [];
  for (const d of doors) if (!d.broken) doorLeaves(d, (hx, hy, a, L) => doorSegs.push([hx, hy, Math.cos(a) * L, Math.sin(a) * L]));
}
const FACE_LIT = 3;   // light reaches this far into a wall face, so marks on it show where it's lit
function lightCast(x, y, c, s, r) {
  let d = cast(x, y, c, s, r, lightBlock);
  if (d < r) d = Math.min(r, d + FACE_LIT);
  for (const [ax, ay, ex, ey] of doorSegs) {
    const det = ex * s - c * ey;
    if (Math.abs(det) < 1e-9) continue;
    const t = (ex * (ay - y) - ey * (ax - x)) / det, u = (c * (ay - y) - s * (ax - x)) / det;
    if (t > 0 && t < d && u >= 0 && u <= 1) d = t + 1.5;                       // a little past the centre line: the near face shows lit
  }
  return d;
}
/* Shadows that don't shimmer: besides an even fan of rays, cast a pair just either side of every wall corner and door
   edge in range, so shadow edges land exactly on the corners instead of jumping between rays as things move. */
let lightCorners = null;
function buildLightCorners() {
  const out = [];
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
    const n = (lightBlock(i - 1, j - 1) ? 1 : 0) + (lightBlock(i, j - 1) ? 1 : 0) + (lightBlock(i - 1, j) ? 1 : 0) + (lightBlock(i, j) ? 1 : 0);
    if (n > 0 && n < 4) out.push(i * T, j * T);
  }
  lightCorners = new Float32Array(out);
}
function visPoly(x, y, r, a0, a1, n) {
  const full = a0 === undefined, A0 = full ? -Math.PI : a0, A1 = full ? Math.PI : a1, span = A1 - A0, angs = [], r2 = r * r * 1.1, E = 2e-4;
  for (let i = 0; i <= n; i++) angs.push(A0 + span * i / n);
  const add = (px, py) => {
    const dx = px - x, dy = py - y, d2 = dx * dx + dy * dy;
    if (d2 > r2 || d2 < 1) return;
    let a = Math.atan2(dy, dx) - A0; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (a > E && a < span - E) angs.push(A0 + a - E, A0 + a + E);
  };
  if (!lightCorners) buildLightCorners();
  const C = lightCorners;
  for (let q = 0; q < C.length; q += 2) add(C[q], C[q + 1]);
  for (const [ax, ay, ex, ey] of doorSegs) { add(ax, ay); add(ax + ex, ay + ey); }
  angs.sort((u, v) => u - v);
  const pts = [[x, y]];
  for (const a of angs) { const c = Math.cos(a), s = Math.sin(a), d = lightCast(x, y, c, s, r); pts.push([x + c * d, y + s * d]); }
  return pts;
}
function lightPoly(x, y, r) { return visPoly(x, y, r, undefined, undefined, Math.round(28 + r / 8)); }
function gatherLights(t) {
  const out = [], reach = Math.hypot(VW, VH) / (S * zoom);
  const near = (x, y, r) => Math.hypot(x - p.x, y - p.y) < reach + r;
  for (const L of FIXTURES) {
    if ((L.off && L.die <= 0) || (L.unlit && !L.off)) continue;
    let k = L.k;
    if (L.flicker) k *= (Math.sin(t * 9.1) * Math.sin(t * 3.7) > 0.55 ? 0.12 : 1) * (0.92 + 0.08 * Math.sin(t * 120));
    if (L.off) k *= Math.random() < 0.5 ? 0.15 : 0.8;                 // shot out: sputters for a moment
    if (near(L.x, L.y, L.r)) out.push({ x: L.x, y: L.y, r: L.r, col: L.col, k, fix: L });
  }
  for (const f of pieces) {
    if (f.broken) continue;
    const fx = f.x + f.w / 2, fy = f.y + f.h / 2;
    if (f.light && near(fx, fy, f.light.r)) out.push({ x: fx, y: fy, r: f.light.r, col: f.light.col, k: f.light.k });
    if (f.parts && f.lightsOn && near(fx, fy, VEH.beam)) vehLights(f, out);
    else if (f.kind === 'desk' && near(fx, f.y, 70)) out.push({ x: fx, y: f.y + 9, r: 70, col: [140, 190, 255], k: 0.3 });
  }
  for (const fl of flashes) if (near(fl.x, fl.y, fl.r || 240)) out.push({ x: fl.x, y: fl.y, r: fl.r || 240, col: fl.col || [255, 190, 110], k: (fl.k || 0.95) * clamp(fl.t / (fl.t0 || 0.06), 0, 1), flash: true });
  for (const L of out) {
    if (L.fix) {                                                 // a fixed light keeps its shape until a door near it moves (or the walls change)
      const F = L.fix;
      if (!F.near) F.near = doors.filter(d => d.rx1 > F.x - F.r && d.rx0 < F.x + F.r && d.ry1 > F.y - F.r && d.ry0 < F.y + F.r);
      let key = edgeVer + ':'; for (const d of F.near) for (const l of d.leaves) key += d.broken ? 'b' : Math.round(l.th * 40) + ',';
      if (F.polyKey !== key) { F.polyKey = key; F.poly = lightPoly(L.x, L.y, L.r); }
      L.poly = F.poly;
    } else L.poly = L.cone ? visPoly(L.x, L.y, L.r, L.cone[0], L.cone[1], 24) : lightPoly(L.x, L.y, L.r);
  }
  return out;
}
function polyOn(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
function carve(g, pts, x, y, r, k, mid) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(0,0,0,' + k.toFixed(3) + ')');
  gr.addColorStop(mid || 0.5, 'rgba(0,0,0,' + (k * 0.55).toFixed(3) + ')');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; polyOn(g, pts); g.fill();
}
/* Darkness over the whole view, with every light carving it away, then laid over the scene. */
function drawLightMap(WM, lights, beam) {
  if (!lightCv) { lightCv = document.createElement('canvas'); lightG = lightCv.getContext('2d'); }
  const lw = Math.ceil(cv.width * LIGHT.res), lh = Math.ceil(cv.height * LIGHT.res);   // soft gradients: built at a fraction of the screen, scaled up
  if (lightCv.width !== lw || lightCv.height !== lh) { lightCv.width = lw; lightCv.height = lh; }
  const g = lightG;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, lightCv.width, lightCv.height);
  g.fillStyle = 'rgba(2,3,8,' + LIGHT.ambient + ')'; g.fillRect(0, 0, lightCv.width, lightCv.height);
  g.setTransform(new DOMMatrix().scale(lw / cv.width, lh / cv.height).multiply(WM));
  g.globalCompositeOperation = 'destination-out';
  for (const L of lights) carve(g, L.poly, L.x, L.y, L.r, L.k);
  if (hasLight(p)) {
    carve(g, beam.halo, p.x, p.y, viewR * 0.45, 0.35, 0.4);         // weapon light: faint halo,
    carve(g, beam.spill, p.x, p.y, viewR, 0.62, 0.6);               // a soft spill,
    carve(g, beam.core, p.x, p.y, viewR * 1.05, 0.92, 0.7);         // and a bright hot core
  } else {                                                          // no light: eyes used to the dark. An even dim view all round (walls still block it), fading only at its edge: no halo around you
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, SEE.darkView);
    gr.addColorStop(0, 'rgba(0,0,0,' + SEE.darkK + ')'); gr.addColorStop(SEE.darkFlat, 'rgba(0,0,0,' + SEE.darkK + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; polyOn(g, beam.eyes); g.fill();
    if (beam.nvg) {                                                 // through the night vision's tube: much further and brighter, but only in its narrow field ahead (soft at the edges)
      const ng = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, NVG.view);
      ng.addColorStop(0, 'rgba(0,0,0,' + NVG.k + ')'); ng.addColorStop(NVG.flat, 'rgba(0,0,0,' + NVG.k + ')'); ng.addColorStop(1, 'rgba(0,0,0,0)');
      for (const [h, a] of [[NVG.half + NVG.soft, 0.35], [NVG.half, 0.55], [NVG.half - NVG.soft, 0.6]]) {
        g.save(); g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, NVG.view + 10, p.aim - h, p.aim + h); g.closePath(); g.clip();
        g.globalAlpha = a; g.fillStyle = ng; polyOn(g, beam.nvg); g.fill(); g.restore();
      }
      g.globalAlpha = 1;
    }
  }
  if (beam.others.length) {                                          // their lights, clipped to what you can see
    g.save(); polyOn(g, beam.view); g.clip();
    for (const o of beam.others) { carve(g, o.spill, o.b.x, o.b.y, o.bb.r, 0.5, 0.6); carve(g, o.core, o.b.x, o.b.y, o.bb.r * 1.05, 0.75, 0.7); }
    g.restore();
  }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fill(WALL_PATH);   // wall tops read as structure, not black holes: the floor art shows
  g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(4,6,10,' + WALL_SHADE + ')'; g.fill(WALL_PATH);   // through them, dimmed by WALL_SHADE (no second draw of the art)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0, cv.width, cv.height); ctx.restore();
}
/* Coloured light adds a tint where it falls (EXIT green, sodium street lamps, the amber bar, muzzle flashes). */
function glowLights(lights, beam) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const a = L.k * (L.flash ? 0.45 : LIGHT.tint);
    const gr = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    gr.addColorStop(0, 'rgba(' + L.col[0] + ',' + L.col[1] + ',' + L.col[2] + ',' + a.toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + L.col[0] + ',' + L.col[1] + ',' + L.col[2] + ',0)');
    ctx.fillStyle = gr; polyOn(ctx, L.poly); ctx.fill();
  }
  if (hasLight(p)) {
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, viewR);
    gr.addColorStop(0, 'rgba(255,236,205,0.10)'); gr.addColorStop(1, 'rgba(255,236,205,0)');
    ctx.fillStyle = gr; polyOn(ctx, beam.core); ctx.fill();
  }
  for (const o of beam.others) {                                     // a bot's light pointed at you: the glare gives it away
    const bb = o.bb, dx = p.x - bb.x, dy = p.y - bb.y, d = Math.hypot(dx, dy), off = Math.abs(angDiff(Math.atan2(dy, dx), bb.a));
    if (state !== 'play' || d > bb.r * 1.3 || off > CONE_HALF * SEE.glare || !losClear(bb.x, bb.y, p.x, p.y)) continue;
    const k = (1 - off / (CONE_HALF * SEE.glare)) * (1 - d / (bb.r * 1.3)), lx = bb.x + Math.cos(bb.a) * 26 * CHAR_SCALE, ly = bb.y + Math.sin(bb.a) * 26 * CHAR_SCALE;
    const gg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 10 + 22 * k);
    gg.addColorStop(0, 'rgba(255,250,232,' + (0.4 + 0.55 * k).toFixed(3) + ')'); gg.addColorStop(0.35, 'rgba(255,236,200,' + (0.25 * k).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(lx, ly, 10 + 22 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

