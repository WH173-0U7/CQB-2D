/* ================= MATERIALS =================
   Grey, semi-transparent 64px textures laid over flat colours (source-atop) so surfaces read as wood, fabric, metal,
   stone, carpet, concrete or asphalt instead of flat paint. FINISH also lights every piece from one side, mutes its
   colour a touch and bakes in a soft drop shadow. Movable pieces are rendered once into a cached image (pieceSprite). */
const FINISH = { tex: 0.55, mute: 0.12, light: 0.16, shade: 0.3, shadow: 0.5, blur: 6, res: 3 };
const ART_RES = 2;     // the floor art (floors, built-ins, wall tops, every mark) is painted at this many pixels per world px
function makeTex(kind) {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  let st = kind.length * 7919 + 17; const rn = () => (st = (st * 16807) % 2147483647) / 2147483647;
  const dot = (x, y, s, a, light) => { g.fillStyle = light ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')'; g.fillRect(x, y, s, s); };
  const wrap = fn => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); };
  if (kind === 'wood') {                                    // grain lines, a couple of knots
    for (let y = 0; y < N; y += 1 + rn() * 1.5) {
      const a = 0.04 + rn() * 0.16, light = rn() < 0.35, ph = rn() * 6;
      g.strokeStyle = light ? 'rgba(255,240,215,' + a + ')' : 'rgba(30,15,5,' + a + ')'; g.lineWidth = 0.6 + rn() * 0.8;
      g.beginPath(); for (let x = 0; x <= N; x += 4) { const yy = y + Math.sin(x / N * Math.PI * 2 + ph) * 1.2; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
    }
    for (let q = 0; q < 2; q++) { const x = rn() * N, y = rn() * N; wrap((ox, oy) => { g.fillStyle = 'rgba(30,15,5,0.25)'; g.beginPath(); g.ellipse(x + ox, y + oy, 3, 1.4, 0, 0, Math.PI * 2); g.fill(); }); }
  } else if (kind === 'soft' || kind === 'carpet') {        // fibres: fine noise, a faint weave
    for (let q = 0; q < (kind === 'carpet' ? 1400 : 900); q++) dot(rn() * N, rn() * N, 1, (0.06 + rn() * 0.2).toFixed(3), rn() < 0.4);
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let q = 0; q < N; q += 2) g.fillRect(0, q, N, 1);
    if (kind === 'carpet') { g.fillStyle = 'rgba(255,255,255,0.04)'; for (let q = 0; q < N; q += 3) g.fillRect(q, 0, 1, N); }
  } else if (kind === 'metal' || kind === 'thin') {         // brushed streaks and a few specks
    for (let q = 0; q < 140; q++) { const x = rn() * N, y = rn() * N, l = 8 + rn() * 34, light = rn() < 0.5; g.fillStyle = light ? 'rgba(255,255,255,' + (0.04 + rn() * 0.12) + ')' : 'rgba(0,0,0,' + (0.04 + rn() * 0.14) + ')'; wrap((ox) => g.fillRect(x + ox, y, l, 0.7)); }
    for (let q = 0; q < 50; q++) dot(rn() * N, rn() * N, 1, 0.25, rn() < 0.5);
  } else if (kind === 'marble') {                           // pale veins wandering through, a fine speckle
    for (let q = 0; q < 5; q++) {
      let x = rn() * N, y = rn() * N, a = rn() * 6.28; const pts = [[x, y]];
      for (let k = 0; k < 14; k++) { a += (rn() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; pts.push([x, y]); }
      const light = q % 2 === 0;
      wrap((ox, oy) => { g.strokeStyle = light ? 'rgba(255,250,235,0.22)' : 'rgba(40,30,20,0.18)'; g.lineWidth = 0.6 + (q % 3) * 0.4; g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)); g.stroke(); });
    }
    for (let q = 0; q < 300; q++) dot(rn() * N, rn() * N, 1, 0.08, rn() < 0.5);
  } else {                                                  // ceramic / stone / concrete / asphalt: mottling and grain
    const blobs = kind === 'ceramic' ? 8 : 18, dots = kind === 'asphalt' ? 1600 : kind === 'concrete' ? 700 : kind === 'stone' ? 500 : 150;
    for (let q = 0; q < blobs; q++) { const x = rn() * N, y = rn() * N, rr = 4 + rn() * 10, a = kind === 'ceramic' ? 0.03 : 0.05, light = rn() < 0.5;
      wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, light ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); }); }
    for (let q = 0; q < dots; q++) dot(rn() * N, rn() * N, kind === 'asphalt' && rn() < 0.3 ? 2 : 1, (0.08 + rn() * (kind === 'asphalt' ? 0.3 : 0.16)).toFixed(3), rn() < 0.45);
  }
  return ctx.createPattern(c, 'repeat');
}
const TEX = {};
for (const k of ['wood', 'soft', 'carpet', 'metal', 'thin', 'marble', 'ceramic', 'stone', 'concrete', 'asphalt']) TEX[k] = makeTex(k);
const BUILTIN_MAT = { B: 'wood', K: 'metal', D: 'wood', S: 'soft', c: 'ceramic', y: 'ceramic', C: 'stone', E: 'metal', X: 'wood', t: 'wood', P: 'ceramic', L: 'thin' };
/* Light, texture and mute whatever is drawn on canvas cv (only where it's drawn). */
function finishCanvas(cv, mat, across) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
  if (mat && TEX[mat]) {
    g.globalAlpha = FINISH.tex; g.fillStyle = TEX[mat];
    g.save(); g.translate(w / 2, h / 2); if (!across) g.rotate(Math.PI / 2); g.scale(FINISH.res / 2 + 0.5, FINISH.res / 2 + 0.5); g.fillRect(-w * 2, -h * 2, w * 4, h * 4); g.restore();
  }
  g.globalAlpha = FINISH.mute; g.fillStyle = '#77726a'; g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  const lg = g.createLinearGradient(0, 0, w, h);
  lg.addColorStop(0, 'rgba(255,246,230,' + FINISH.light + ')'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,' + FINISH.shade + ')');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  g.restore();
}
/* Render drawFurniture's output for an area into a finished, shadowed image. Returns { cv, x, y, s } (s = pixels per world px). */
function finishedImage(c, x, y, w, h, n, f, room, mat, res) {
  const M = 14, cw = Math.ceil((w + M * 2) * res), ch = Math.ceil((h + M * 2) * res);
  const A = document.createElement('canvas'); A.width = cw; A.height = ch;
  const ga = A.getContext('2d'); ga.setTransform(res, 0, 0, res, (M - x) * res, (M - y) * res);
  drawFurniture(ga, c, x, y, w, h, n, f, room);
  if (c !== 'G') finishCanvas(A, mat, w >= h);
  const B = document.createElement('canvas'); B.width = cw; B.height = ch;
  const gb = B.getContext('2d');
  gb.shadowColor = 'rgba(0,0,0,' + FINISH.shadow + ')'; gb.shadowBlur = FINISH.blur * res; gb.shadowOffsetX = 2 * res; gb.shadowOffsetY = 3 * res;
  gb.drawImage(A, 0, 0);
  return { cv: B, x: x - M, y: y - M, s: res };
}
function pieceSprite(f, pd) {                               // cached per piece; drawn at its current position
  if (!f.spr) { const im = finishedImage(f.c, f.x - pd, f.y - pd, f.w + pd * 2, f.h + pd * 2, 0, f, null, (FURN[f.c] && (FURN[f.c].finish || FURN[f.c].mat)) || BUILTIN_MAT[f.c], FINISH.res); f.spr = { cv: im.cv, dx: im.x - f.x, dy: im.y - f.y, s: im.s }; }
  return f.spr;
}
function buildFloorArt() {
  const cvs = document.createElement('canvas');
  cvs.width = W * T * ART_RES; cvs.height = H * T * ART_RES;
  const g = cvs.getContext('2d');
  g.setTransform(ART_RES, 0, 0, ART_RES, 0, 0);                     // everything below draws in world px
  const hash = (i, j) => ((i * 73856093) ^ (j * 19349663)) >>> 0;
  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const rr = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };

  // 1) floors, with quiet textures
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, c = solidAt[k];
    if (c === '#' || c === 'E') continue;
    const fl = floorAt[k], cols = FLOOR_COL[fl] || FLOOR_COL.a, x = i * T, y = j * T;
    g.fillStyle = fl === 'm' ? cols[((i >> 1) + (j >> 1)) & 1] : fl === 'e' ? cols[(i + j) & 1] : cols[0];
    g.fillRect(x, y, T, T);
    g.lineWidth = 1;
    if (fl === 'w') {                                            // oak planks
      g.strokeStyle = '#5a3d29';
      for (let r = 0; r < 4; r++) {
        line(x, y + r * 12, x + T, y + r * 12);
        const jx = x + (hash(i, j * 4 + r) % T);
        line(jx, y + r * 12, jx, y + r * 12 + 12);
        g.fillStyle = (hash(i + r, j) & 3) ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'; g.fillRect(x, y + r * 12 + 1, T, 11);
      }
    } else if (fl === 'k' || fl === 'u') {                       // tiles
      const step = fl === 'k' ? 24 : 16;
      g.strokeStyle = fl === 'k' ? '#515b62' : '#456262';
      for (let q = 0; q < T; q += step) { line(x + q, y, x + q, y + T); line(x, y + q, x + T, y + q); }
    } else if (fl === 'o') {                                     // carpet tiles
      g.strokeStyle = '#434c66'; g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      g.fillStyle = 'rgba(255,255,255,0.025)'; if ((i + j) & 1) g.fillRect(x + 1, y + 1, T - 2, T - 2);
    } else if (fl === 's') {                                     // paving slabs
      g.strokeStyle = '#5c5d61'; g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    } else if (fl === 'r') {                                     // wine carpet with a diamond weave
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.moveTo(x, y + T / 2); g.lineTo(x + T / 2, y); g.lineTo(x + T, y + T / 2); g.lineTo(x + T / 2, y + T); g.closePath(); g.stroke();
    } else if (fl === 'm' && !(i & 1) && !(j & 1)) {             // marble grout every two tiles
      g.strokeStyle = '#5c5346'; g.strokeRect(x + 0.5, y + 0.5, T * 2 - 1, T * 2 - 1);
      g.strokeStyle = 'rgba(255,255,255,0.05)'; line(x + 10, y + 70, x + 60, y + 20);   // a vein in the stone
    }
    const ft = FLOOR_TEX[fl];                                      // the material itself: grain, veins, fibre, aggregate
    if (ft) { g.save(); g.globalAlpha = ft[1]; g.fillStyle = TEX[ft[0]]; g.fillRect(x, y, T, T); g.restore(); }
    const tv = (hash(i * 3, j * 5) % 100) / 100;                   // no two tiles quite the same, but evenly kept
    g.fillStyle = tv < 0.5 ? 'rgba(0,0,0,' + (0.03 * (0.5 - tv)).toFixed(3) + ')' : 'rgba(255,255,255,' + (0.03 * (tv - 0.5)).toFixed(3) + ')'; g.fillRect(x, y, T, T);
  }
  // soft shadow where floor meets wall (ambient occlusion), so rooms have depth
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (wall(i, j) || doorAt[k] >= 0) continue;
    const x = i * T, y = j * T, A = 16;
    for (const [a, b, gx0, gy0, gx1, gy1] of [[0, -1, x, y, x, y + A], [0, 1, x, y + T, x, y + T - A], [-1, 0, x, y, x + A, y], [1, 0, x + T, y, x + T - A, y]]) {
      if (!wall(i + a, j + b)) continue;
      const gr = g.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x, y, T, T);
    }
  }

  // 2) details on the floor
  const rug = (x, y, w, h, base, border, pat) => {
    if (pat === 'round') {                                              // round rug: rings
      g.fillStyle = base; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = border; g.lineWidth = 3; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 6, h / 2 - 6, 0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 4, h / 4, 0, 0, Math.PI * 2); g.stroke(); return;
    }
    g.fillStyle = base; rr(x, y, w, h, 4); g.fill();
    if (pat === 'stripe') { g.fillStyle = border; for (let q = x + 8; q < x + w - 8; q += 16) g.fillRect(q, y + 4, 6, h - 8); return; }
    if (pat === 'runner') { g.strokeStyle = border; g.lineWidth = 2; rr(x + 4, y + 4, w - 8, h - 8, 2); g.stroke(); g.globalAlpha = 0.45; g.fillStyle = border; for (let q = (w > h ? x : y) + 16; q < (w > h ? x + w : y + h) - 16; q += 26) { g.save(); g.translate(w > h ? q : x + w / 2, w > h ? y + h / 2 : q); g.rotate(Math.PI / 4); g.fillRect(-2.5, -2.5, 5, 5); g.restore(); } g.globalAlpha = 1; return; }
    g.strokeStyle = border; g.lineWidth = 3; rr(x + 5, y + 5, w - 10, h - 10, 3); g.stroke();
    if (pat === 'medal') { g.fillStyle = border; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w * 0.18, h * 0.22, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = base; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w * 0.1, h * 0.12, 0, 0, Math.PI * 2); g.fill(); return; }
    g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.15)'; for (let q = x + 12; q < x + w - 12; q += 10) line(q, y + 10, q, y + h - 10);
  };
  if (MAP.id === 'house') {                                          // the safe house: rugs, the kerb and a lane line out front
    rug(7.3 * T, 13.1 * T, 3.4 * T, 3.2 * T, '#3e4a3a', '#a8a07a', 'medal');   // living room, under the coffee table and the sofa's front
    rug(9.3 * T, 5.1 * T, 3.4 * T, 2.9 * T, '#4a3a4e', '#b49a6a', 'stripe');  // bedroom, under the bed's foot
    rug(14.2 * T, 14.85 * T, 4.4 * T, 2.9 * T, '#6a3a2e', '#c8a46a', 'plain'); // under the dining table
    rug(19.4 * T, 5.4 * T, 0.7 * T, 1.7 * T, '#5a7a8a', '#d8d0c0', 'plain');   // bath mat by the tub
    drawDecor(g, 'slippers', 10 * T + 4, 7.15 * T, 0, '#a83a32');
    g.fillStyle = '#7a7c80'; g.fillRect(24.4 * T, 2.4 * T, 1.2 * T, 0.6 * T);  // back step
    g.fillStyle = '#4a3a2a'; g.fillRect(35 * T - 8, 0.9 * T, 10, 1.3 * T); g.strokeStyle = '#2a1e14'; g.lineWidth = 2;   // the back gate in the fence
    for (let q = 0.95 * T; q < 2.2 * T; q += 10) line(35 * T - 8, q, 35 * T + 2, q);
    g.strokeStyle = '#8a8b90'; g.lineWidth = 4; line(T, 24 * T, (W - 1) * T, 24 * T);
    g.strokeStyle = '#c8b04a'; g.setLineDash([40, 32]); line(T, 27 * T, (W - 1) * T, 27 * T); g.setLineDash([]);
  } else if (MAP.gen) {                                              // a generated map: its rugs, the kerb and the lane line
    for (const [x, y, w, h, base, border, pat] of MAP.decals || []) rug(x, y, w, h, base, border, pat);
    for (const [t, x, y, a, col] of MAP.clutter || []) drawDecor(g, t, x, y, a, col);   // shoes, clothes, toys, mats, flower beds, the patio
    g.strokeStyle = '#8a8b90'; g.lineWidth = 4; line(T, 24 * T, (W - 1) * T, 24 * T);
    g.strokeStyle = '#c8b04a'; g.setLineDash([40, 32]); line(T, 27 * T, (W - 1) * T, 27 * T); g.setLineDash([]);
  } else {
    // street: curb, lane line, crosswalk, manholes, storm drains
    g.strokeStyle = '#8a8b90'; g.lineWidth = 4; line(T, 25 * T, (W - 1) * T, 25 * T);
    g.strokeStyle = '#c8b04a'; g.lineWidth = 4; g.setLineDash([40, 32]); line(T, 27 * T, (W - 1) * T, 27 * T); g.setLineDash([]);
    g.fillStyle = 'rgba(235,235,240,0.32)';
    for (let y = 25 * T + 10; y < 29 * T - 12; y += 26) g.fillRect(14 * T + 6, y, 3 * T - 12, 13);
    for (const [mx, my] of [[7 * T, 27.6 * T], [31 * T, 27.8 * T]]) {
      g.fillStyle = '#2a2b2f'; g.beginPath(); g.arc(mx, my, 15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a4b50'; g.lineWidth = 2; for (let r = 5; r < 15; r += 4) { g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.stroke(); }
    }
    for (const dx of [7, 18, 32]) { g.fillStyle = '#26272b'; g.fillRect(dx * T, 25 * T + 2, 26, 9); g.strokeStyle = '#4a4b50'; g.lineWidth = 1; for (let q = 3; q < 26; q += 4) line(dx * T + q, 25 * T + 3, dx * T + q, 25 * T + 10); }
    // red carpet trim and the lobby medallion
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3;
    line(14 * T + 5, 21 * T, 14 * T + 5, 25 * T); line(17 * T - 5, 21 * T, 17 * T - 5, 25 * T);
    const MX = 15.5 * T, MY = 15.5 * T;
    g.strokeStyle = '#8f8270'; g.lineWidth = 3;
    g.beginPath(); g.arc(MX, MY, 2.3 * T, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(MX, MY, 1.5 * T, 0, Math.PI * 2); g.stroke();
    for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4; line(MX + Math.cos(a) * 1.5 * T, MY + Math.sin(a) * 1.5 * T, MX + Math.cos(a) * 2.3 * T, MY + Math.sin(a) * 2.3 * T); }
    g.fillStyle = '#b8a26a'; g.beginPath(); g.arc(MX, MY, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a08a5a'; g.font = '700 22px "Arial Narrow","Roboto Condensed",Impact,sans-serif';
    g.textAlign = 'center'; g.fillText('WELCOME', 15.5 * T, 20 * T + 32);
    // rugs under the seating
    rug(10.2 * T, 17.3 * T, 3.6 * T, 3.2 * T, '#5a3a4a', '#c9a46a');           // lobby sofa corner
    rug(22.3 * T, 15.2 * T, 5.4 * T, 2.6 * T, '#4a2a2a', '#b88a4a');           // lounge tables
    rug(13.6 * T, 7.0 * T, 5.0 * T, 1.6 * T, '#3a4a5a', '#8a9aaa');            // runner in the elevator hall
    // drains in the kitchen and restrooms
    for (const [dx, dy] of [[4.5 * T, 9.2 * T], [10.6 * T, 8.9 * T], [21.3 * T, 9.3 * T]]) {
      g.fillStyle = '#3a4045'; g.beginPath(); g.arc(dx, dy, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6a737a'; g.lineWidth = 1; for (let q = -5; q <= 5; q += 2.5) line(dx + q, dy - 5, dx + q, dy + 5);
    }

  }

  // 3) built-in furniture and fixtures (movable pieces are drawn live)
  const seen = new Uint8Array(W * H);
  let carN = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = solidAt[j * W + i];
    if (c === '.' || c === '#' || seen[j * W + i]) continue;
    let w = 1; while (i + w < W && solidAt[j * W + i + w] === c && !seen[j * W + i + w]) w++;
    let h = 1;
    grow: while (j + h < H) { for (let q = 0; q < w; q++) if (solidAt[(j + h) * W + i + q] !== c || seen[(j + h) * W + i + q]) break grow; h++; }
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) seen[(j + yy) * W + i + xx] = 1;
    const room = floorAt[(j + (h >> 1)) * W + i + (w >> 1)];
    const im = finishedImage(c, i * T, j * T, w * T, h * T, c === 'c' ? carN++ : 0, null, room, BUILTIN_MAT[c], ART_RES);
    g.drawImage(im.cv, im.x, im.y, im.cv.width / ART_RES, im.cv.height / ART_RES);
  }
  // 4) wall tops: the material seen from above, a lit bevel along every edge that meets a room, dark outline
  const wallish = (i, j) => i < 0 || j < 0 || i >= W || j >= H || '#EC'.includes(solidAt[j * W + i]);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (solidAt[j * W + i] !== '#') continue;
    const x = i * T, y = j * T, m = wallMat[j * W + i], tone = (hash(i * 5, j * 3) % 100) / 100;
    g.fillStyle = WALL_TOP[m] || WALL_TOP[1]; g.fillRect(x, y, T, T);
    g.save(); g.globalAlpha = m === 2 ? 0.5 : 0.3; g.fillStyle = TEX[m === 2 ? 'concrete' : 'stone']; g.fillRect(x, y, T, T); g.restore();
    g.fillStyle = 'rgba(255,255,255,' + (0.02 * tone).toFixed(3) + ')'; g.fillRect(x, y, T, T);
    for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (wallish(i + a, j + b)) continue;
      const ex = a > 0 ? x + T : x, ey = b > 0 ? y + T : y;
      const bw = 4, bx = a ? (a > 0 ? x + T - bw : x) : x, by = b ? (b > 0 ? y + T - bw : y) : y, bwid = a ? bw : T, bhei = b ? bw : T;
      g.fillStyle = 'rgba(255,248,235,0.11)'; g.fillRect(bx, by, bwid, bhei);                         // the cap's lit edge
      g.fillStyle = 'rgba(0,0,0,0.55)'; if (a) g.fillRect(ex - (a > 0 ? 1 : 0), y, 1, T); else g.fillRect(x, ey - (b > 0 ? 1 : 0), T, 1);   // the edge itself
    }
  }
  return cvs;
}
const WALL_TOP = [null, '#4d4a46', '#414247', '#50545c'];   // drywall, concrete, metal (by wallMat)
const WALL_SHADE = 0.52;                                     // wall tops are shown over the darkness, this much dimmed
let WALL_PATH = null;
function buildWallPath() {
  WALL_PATH = new Path2D();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if ('#EC'.includes(solidAt[j * W + i])) WALL_PATH.rect(i * T, j * T, T, T);
}

/* Draw one piece of furniture, fixture or prop into any canvas context (the floor art or the live view).
   f is the live piece (for movable things and props), room is the floor type it sits on. */
/* Lived-in detail: small things drawn top-down, in world px, centred on (x, y), turned by a, in colour col where it
   matters. Used on furniture tops (`f.top`, baked into the piece's image, so they go when it breaks) and as floor clutter
   (`MAP.clutter`, painted into the floor art). */
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
function drawDecor(g, t, x, y, a, col) {
  const C = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
  const Rr = (rx, ry, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(rx, ry, w, h, r) : g.rect(rx, ry, w, h); g.fill(); };
  const L = (x0, y0, x1, y1, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const E = (cx, cy, rx, ry, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, r, 0, Math.PI * 2); g.fill(); };
  col = col || '#8a3a3a';
  g.save(); g.translate(x, y); g.rotate(a || 0); g.lineCap = 'round';
  switch (t) {
    case 'mug': C(1.5, 0, 1.2, shade(col, 0.8)); C(0, 0, 2.6, col); C(0, 0, 1.7, '#3a2418'); break;
    case 'glass': C(0, 0, 2.2, 'rgba(200,225,240,0.65)'); C(0, 0, 1.3, 'rgba(240,250,255,0.5)'); break;
    case 'plate': C(0, 0, 5, '#f4f2ec'); C(0, 0, 3.4, '#e6e2d8'); C(0.8, -0.5, 1.6, col); break;
    case 'bowl': C(0, 0, 6, shade(col, 0.7)); C(0, 0, 5, col); C(-1.8, -1, 1.8, '#d8402c'); C(1.6, 0.6, 1.8, '#e8b030'); C(-0.4, 2, 1.7, '#7ab040'); break;
    case 'book': Rr(-4.5, -6, 9, 12, 1, col); L(-3.6, -5.4, -3.6, 5.4, shade(col, 0.6), 1); break;
    case 'books': for (let i = 0; i < 3; i++) { g.save(); g.rotate((i - 1) * 0.18); Rr(-5 + i, -6.5 + i * 0.8, 10, 13, 1, ['#8a3a3a', '#3a5a8a', '#c8a24a', '#3a7a5a'][(i + (col.length)) % 4]); g.restore(); } break;
    case 'mag': Rr(-5, -6.5, 10, 13, 0.5, '#ece6da'); Rr(-4, -5.5, 8, 5, 0.5, col); L(-4, 1.5, 3, 1.5, '#9a968c', 0.8); L(-4, 3.5, 2, 3.5, '#9a968c', 0.8); break;
    case 'laptop': Rr(-8, -5.5, 16, 11, 1.2, '#2a2c30'); Rr(-7, -1, 14, 5.5, 0.8, '#3a3d42'); L(-7.5, -1.8, 7.5, -1.8, '#6a8ab8', 1); break;
    case 'phone': Rr(-2, -3.5, 4, 7, 1, '#141518'); L(-1, -2, 0.8, 1.5, 'rgba(140,170,220,0.6)', 0.6); break;
    case 'remote': Rr(-1.6, -4.5, 3.2, 9, 1, '#1d1e21'); C(0, -2.8, 0.7, '#c83a2a'); C(0, 0, 0.5, '#6a6e76'); C(0, 1.6, 0.5, '#6a6e76'); break;
    case 'papers': for (let i = 0; i < 3; i++) { g.save(); g.rotate((i - 1) * 0.25); Rr(-5, -6.5, 10, 13, 0.3, '#f2f0ea'); L(-3.5, -3, 3, -3, '#b0aca4', 0.6); L(-3.5, -1, 3.5, -1, '#b0aca4', 0.6); g.restore(); } break;
    case 'vase': C(0, 0, 3.2, col); for (let i = 0; i < 5; i++) C(Math.cos(i * 1.26) * 3, Math.sin(i * 1.26) * 3, 1.3, ['#e85a6a', '#f0d040', '#e8e0f0'][i % 3]); C(0, 0, 1.2, '#3f7a4a'); break;
    case 'candle': C(0, 0, 2.2, '#f0e6c8'); C(0, 0, 0.8, '#ffb050'); break;
    case 'bottle': C(0, 0, 2.4, col); C(0, 0, 1, shade(col, 1.4)); break;
    case 'keys': g.strokeStyle = '#b8b0a0'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 1.8, 0, 7); g.stroke(); L(1.4, 1, 4, 3.5, '#c8c0b0', 1); L(-1, 1.6, -1.5, 5, '#a8a090', 1); break;
    case 'clock': C(0, 0, 3.2, '#2a2b2e'); C(0, 0, 2.5, '#e8e4dc'); L(0, 0, 0, -1.8, '#2a2b2e', 0.6); L(0, 0, 1.3, 0.5, '#2a2b2e', 0.6); break;
    case 'frame': Rr(-3.5, -4.5, 7, 9, 0.5, '#5a4030'); Rr(-2.5, -3.5, 5, 7, 0.3, col); break;
    case 'perfume': C(-2, 0, 1.8, 'rgba(220,180,200,0.85)'); C(1.5, -1, 1.4, 'rgba(180,200,230,0.85)'); C(1.2, 2, 1.2, '#d8c890'); break;
    case 'jbox': Rr(-4, -3, 8, 6, 1, '#6a3a4a'); L(-4, 0, 4, 0, '#c8a24a', 0.6); break;
    case 'tooth': C(0, 0, 2.4, '#e8eef2'); L(0, 0, -1.5, -4, '#3a8ae8', 0.8); L(0, 0, 1.5, -4, '#e84a6a', 0.8); break;
    case 'soap': Rr(-2.5, -1.6, 5, 3.2, 1.2, '#f0d8e0'); break;
    case 'towel': Rr(-6, -4, 12, 8, 1, col); L(-6, -2.5, 6, -2.5, shade(col, 1.3), 1); L(-6, 2.5, 6, 2.5, shade(col, 1.3), 1); break;
    case 'hob': Rr(-12, -11, 24, 22, 2, '#1d1e21'); for (const [i, j, r] of [[-6, -5, 4], [6, -5, 3.2], [-6, 5, 3.2], [6, 5, 4]]) { g.strokeStyle = '#4a4c52'; g.lineWidth = 1; g.beginPath(); g.arc(i, j, r, 0, 7); g.stroke(); C(i, j, 1, '#3a3c42'); } C(9.5, -9, 0.8, '#c83a2a'); break;
    case 'pan': C(0, 0, 4.6, '#2a2b2e'); C(0, 0, 3.6, '#3a3c40'); L(4.4, 0, 10, 0, '#1d1e21', 1.8); break;
    case 'ksink': Rr(-11, -8, 22, 16, 2, '#b8bec4'); Rr(-9.5, -6.5, 8.5, 12, 1.5, '#8a9096'); Rr(1, -6.5, 8.5, 12, 1.5, '#8a9096'); C(-5, 0, 0.9, '#4a4e56'); C(5, 0, 0.9, '#4a4e56'); L(0, -8, 0, -4, '#d8dce0', 1.6); break;
    case 'mwave': Rr(-10, -7, 20, 14, 1.5, '#d8dadc'); Rr(-8, -5, 12, 10, 1, '#1d1e21'); C(6.5, -2, 1, '#6a6e76'); C(6.5, 1.5, 1, '#6a6e76'); break;
    case 'kettle': C(0, 0, 4.2, col); C(0, 0, 2.6, shade(col, 1.25)); L(3.6, -1, 6.5, -2.5, col, 1.6); break;
    case 'toaster': Rr(-5, -3.5, 10, 7, 1.5, '#c8ccd0'); Rr(-3.5, -2.2, 7, 1.4, 0.5, '#2a2b2e'); Rr(-3.5, 0.8, 7, 1.4, 0.5, '#2a2b2e'); break;
    case 'board': Rr(-7.5, -5, 15, 10, 1.5, '#b8905a'); L(-3, 1.5, 7, -1.5, '#c8ccd0', 1.2); C(-4, -1, 1.6, '#d8402c'); break;
    case 'coffee': Rr(-4.5, -5, 9, 10, 1.5, '#1d1e21'); C(0, 1.5, 2.6, 'rgba(60,40,30,0.9)'); break;
    case 'dishes': Rr(-8, -5.5, 16, 11, 1, '#9aa0a6'); for (let i = -6; i <= 6; i += 3) L(i, -4.5, i, 4.5, '#f2f0ea', 1.6); break;
    case 'shoes': E(-2.6, 0, 2.2, 5, 0.12, col); E(2.6, 0.6, 2.2, 5, -0.1, col); E(-2.6, 2.6, 1.6, 2, 0.12, shade(col, 0.6)); E(2.6, 3.2, 1.6, 2, -0.1, shade(col, 0.6)); break;
    case 'sneakers': E(-2.8, 0, 2.4, 5.2, 0.2, '#e8e6e0'); E(2.8, 0.8, 2.4, 5.2, -0.3, '#e8e6e0'); E(-2.8, 0, 1.6, 4.2, 0.2, col); E(2.8, 0.8, 1.6, 4.2, -0.3, col); break;
    case 'slippers': E(-2.6, 0, 2.2, 4.4, 0.1, col); E(3, 1, 2.2, 4.4, -0.2, col); E(-2.6, -1.5, 1.4, 1.8, 0.1, shade(col, 1.25)); E(3, -0.5, 1.4, 1.8, -0.2, shade(col, 1.25)); break;
    case 'clothes': { g.fillStyle = col; g.beginPath(); g.moveTo(-9, -3); g.quadraticCurveTo(-4, -9, 3, -6); g.quadraticCurveTo(10, -4, 8, 3); g.quadraticCurveTo(5, 9, -3, 7); g.quadraticCurveTo(-11, 5, -9, -3); g.fill(); g.strokeStyle = shade(col, 0.7); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-5, -2); g.quadraticCurveTo(0, 1, 5, -1); g.moveTo(-4, 3); g.quadraticCurveTo(1, 5, 4, 3); g.stroke(); break; }
    case 'jeans': g.fillStyle = col; g.beginPath(); g.moveTo(-5, -9); g.lineTo(5, -9); g.lineTo(6, 8); g.lineTo(1.5, 9); g.lineTo(0, -1); g.lineTo(-1.5, 9); g.lineTo(-6, 8); g.closePath(); g.fill(); L(-5, -7.5, 5, -7.5, shade(col, 0.7), 1); break;
    case 'socks': E(-2, 0, 1.6, 4, 0.4, col); E(2.5, 1, 1.6, 4, -0.6, col); break;
    case 'backpack': Rr(-7, -8, 14, 16, 4, col); Rr(-5, 1, 10, 6, 2, shade(col, 0.75)); L(-4, -7, 4, -7, shade(col, 0.6), 1.4); break;
    case 'toys': for (let i = 0; i < 5; i++) { g.save(); g.translate(Math.cos(i * 2.4) * 5, Math.sin(i * 2.4) * 4); g.rotate(i); Rr(-2, -2, 4, 4, 0.6, ['#e84a3a', '#3a8ae8', '#e8c83a', '#3ac87a', '#a85ae8'][i]); g.restore(); } break;
    case 'ball': C(0, 0, 5, col); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.arc(-2, 0, 4, -1, 1); g.stroke(); break;
    case 'teddy': C(0, 3, 5, '#8a5a32'); C(0, -3, 3.6, '#9a6a3e'); C(-3, -5.6, 1.5, '#8a5a32'); C(3, -5.6, 1.5, '#8a5a32'); C(0, -2.5, 1.2, '#c8a07a'); break;
    case 'news': Rr(-9, -6.5, 18, 13, 0.3, '#dcd8cc'); for (let i = -4; i <= 4; i += 2) L(-7, i, 7, i, '#9a968c', 0.6); Rr(-7, -5.5, 6, 4, 0.2, '#6a6862'); break;
    case 'petbowl': C(-4, 0, 3.6, '#9aa0a6'); C(-4, 0, 2.6, '#7a5030'); C(4, 0, 3.6, '#9aa0a6'); C(4, 0, 2.6, 'rgba(140,190,230,0.8)'); break;
    case 'dogbed': C(0, 0, 14, shade(col, 0.75)); C(0, 0, 10.5, col); C(-2, 1, 5, shade(col, 1.15)); break;
    case 'yoga': Rr(-6, -18, 12, 36, 2, col); L(-6, -14, 6, -14, shade(col, 0.8), 0.6); break;
    case 'cable': g.strokeStyle = '#1d1e21'; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, 2); g.bezierCurveTo(-4, -8, 2, 8, 10, -2); g.stroke(); Rr(8.5, -3.5, 3, 3, 0.5, '#e8e6e0'); break;
    case 'dumbbell': for (const o of [-5, 5]) Rr(o - 1.8, -3, 3.6, 6, 0.8, '#2a2b2e'); L(-4, 0, 4, 0, '#6a6e76', 1.4); break;
    case 'guitar': C(0, 5, 5.5, '#a8662e'); C(0, -1, 4.2, '#a8662e'); C(0, 3, 1.6, '#2a1a10'); L(0, -4, 0, -15, '#3a2414', 1.8); break;
    case 'skate': Rr(-3.5, -12, 7, 24, 3.5, col); C(0, -8, 1, '#e8e6e0'); C(0, 8, 1, '#e8e6e0'); break;
    case 'hose': g.strokeStyle = '#3a8a4a'; g.lineWidth = 1.6; for (const r of [3, 5.5, 8]) { g.beginPath(); g.arc(0, 0, r, 0, 6.1); g.stroke(); } break;
    case 'mat': Rr(-12, -7, 24, 14, 1.5, col); g.strokeStyle = shade(col, 0.75); g.lineWidth = 1; g.strokeRect(-10, -5, 20, 10); break;
    case 'flowerbed': Rr(-22, -9, 44, 18, 4, '#4a3524'); for (let i = 0; i < 11; i++) { const fx = -18 + i * 3.6, fy = Math.sin(i * 2.1) * 4.5; C(fx, fy, 2.4, '#3f7a4a'); C(fx + 0.6, fy - 0.6, 1.2, ['#e85a6a', '#f0d040', '#e8e0f0', '#c86ae8'][i % 4]); } break;
    case 'patio': for (let i = -2; i < 2; i++) for (let j = -1; j < 2; j++) Rr(i * 24 + 1, j * 24 - 11, 22, 22, 1.5, (i + j) % 2 ? '#8a8478' : '#7e786c'); break;
    case 'fence': L(-24, -2, 24, -2, '#8a6a48', 2); L(-24, 2, 24, 2, '#8a6a48', 2); for (let i = -22; i <= 22; i += 11) Rr(i - 2, -4, 4, 8, 0.8, '#a88a62'); break;
    case 'tuft': for (let i = 0; i < 6; i++) E(Math.cos(i * 1.7) * 4, Math.sin(i * 2.3) * 3, 2.6, 1, i * 0.9, i % 2 ? '#3e6a34' : '#5a8a46'); break;
    case 'mow': g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(-24, -24, 48, 48); break;
    case 'toolbox': Rr(-9, -5, 18, 10, 1.5, '#c83a2a'); Rr(-4, -6.5, 8, 2.5, 1, '#2a2b2e'); L(-9, 0, 9, 0, '#8a241e', 0.8); L(-14, 3, -11, -4, '#9aa0a6', 1.2); L(12, -4, 16, 3, '#e8c040', 1.4); break;
    case 'oil': E(0, 0, 16, 11, 0.3, 'rgba(20,18,16,0.35)'); E(4, 2, 7, 5, 0.6, 'rgba(10,9,8,0.3)'); break;
    case 'leaves': for (let i = 0; i < 9; i++) E(Math.cos(i * 2.7) * 9, Math.sin(i * 1.9) * 7, 2, 1, i, ['#a8662e', '#c8902e', '#8a4a22'][i % 3]); break;
  }
  g.restore();
}
/* Home furniture from above at real proportions (drawn upright: back to the wall at the top, front toward +y). */
function drawHomePiece(g, c, x, y, w, h, f, rr, line, circ) {
  const cx = x + w / 2, cy = y + h / 2, u = w / 100, col = f.col;
  const R = i => { const v = Math.sin(f.seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  switch (c) {
    case 'bed': {                                     // frame and headboard, mattress, pillows (one on a single), duvet folded back over the sheet, quilting, a throw at the foot
      const single = w < 70, duv = col || '#3e4c6a';
      g.fillStyle = '#4a3424'; rr(x, y, w, h, 3); g.fill();
      g.fillStyle = '#6a4a32'; rr(x - 1, y - 1, w + 2, 7, 2); g.fill();                                   // headboard
      g.fillStyle = '#ece8de'; rr(x + 2.5, y + 6, w - 5, h - 8.5, 3); g.fill();                         // sheet
      const pw = single ? w - 16 : (w - 18) / 2;
      for (let q = 0; q < (single ? 1 : 2); q++) { const px = x + 7 + q * (pw + 4); g.fillStyle = '#d8d2c6'; rr(px + 0.6, y + 9.6, pw, 13, 5); g.fill(); g.fillStyle = '#f8f5ee'; rr(px, y + 9, pw, 13, 5); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 0.8; line(px + pw / 2, y + 11, px + pw / 2, y + 20); }
      const dy = y + h * 0.3;
      g.fillStyle = shade(duv, 0.8); rr(x - 1, dy, w + 2, y + h - dy + 1, 4); g.fill();                  // the duvet hangs over the sides
      g.fillStyle = duv; rr(x + 1, dy + 1, w - 2, y + h - dy - 2, 4); g.fill();
      g.fillStyle = shade(duv, 1.25); rr(x + 1, dy, w - 2, 7, 3); g.fill();                              // folded-back top edge
      g.strokeStyle = shade(duv, 0.85); g.lineWidth = 0.7;
      for (let q = dy + 14; q < y + h - 4; q += 10) line(x + 4, q + (R(q) - 0.5) * 2, x + w - 4, q + (R(q + 1) - 0.5) * 2);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w * 0.2, dy + 10); g.quadraticCurveTo(cx, dy + 18 + R(3) * 6, x + w * 0.8, dy + 12); g.stroke();   // a fold
      if (!single && R(7) < 0.6) { g.fillStyle = shade(duv, R(8) < 0.5 ? 0.6 : 1.5); rr(x - 1, y + h - 22, w + 2, 12, 2); g.fill(); }   // a throw across the foot
      return true;
    }
    case 'S': {                                       // sofa: deep back cushions, two arms, a seat cushion per seat, throw pillows in the corners
      const sc = col || '#86495b', arm = 9, back = 11, seats = w > 95 ? 3 : 2;
      g.fillStyle = shade(sc, 0.6); rr(x, y, w, h, 6); g.fill();
      g.fillStyle = shade(sc, 0.8); rr(x + 1, y + 1, w - 2, back + 1, 5); g.fill();                     // back
      g.fillStyle = shade(sc, 0.85); rr(x + 1, y + 1, arm, h - 2, 4); g.fill(); rr(x + w - arm - 1, y + 1, arm, h - 2, 4); g.fill();   // arms
      const sw = (w - arm * 2 - 2) / seats;
      for (let q = 0; q < seats; q++) { g.fillStyle = sc; rr(x + arm + 1 + q * sw + 0.5, y + back + 1, sw - 1, h - back - 4, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,0.08)'; rr(x + arm + 2 + q * sw, y + back + 2, sw - 3, 4, 2); g.fill(); }
      const pc = R(2) < 0.5 ? '#c9a46a' : R(3) < 0.5 ? '#e8e2d6' : shade(sc, 1.5);
      for (const s of [0, 1]) { g.save(); g.translate(s ? x + w - arm - 9 : x + arm + 9, y + back + 6); g.rotate(s ? -0.35 : 0.35); g.fillStyle = pc; rr(-7, -6, 14, 12, 3); g.fill(); g.restore(); }
      return true;
    }
    case 'armch': {
      const ac = col || '#7a5a4a';
      g.fillStyle = shade(ac, 0.6); rr(x, y, w, h, 7); g.fill();
      g.fillStyle = shade(ac, 0.8); rr(x + 1, y + 1, w - 2, 10, 6); g.fill();
      g.fillStyle = shade(ac, 0.88); rr(x + 1, y + 2, 8, h - 3, 5); g.fill(); rr(x + w - 9, y + 2, 8, h - 3, 5); g.fill();
      g.fillStyle = ac; rr(x + 9, y + 11, w - 18, h - 14, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,0.08)'; rr(x + 10, y + 12, w - 20, 4, 2); g.fill();
      return true;
    }
    case 'tv': {                                      // media console with a flat-screen on its stand, a soundbar, a box
      g.fillStyle = '#3a2a1e'; rr(x, y + 2, w, h - 2, 2); g.fill(); g.fillStyle = '#5a4230'; rr(x + 1.5, y + 3.5, w - 3, h - 5, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.8; for (let q = 1; q < 3; q++) line(x + w * q / 3, y + 4, x + w * q / 3, y + h - 2);
      g.fillStyle = '#18191c'; rr(cx - w * 0.38, y + 3, w * 0.76, 3.2, 1); g.fill();                  // the panel, edge on
      g.fillStyle = 'rgba(120,160,255,0.45)'; g.fillRect(cx - w * 0.36, y + 5.4, w * 0.72, 0.8);
      g.fillStyle = '#2a2b2e'; rr(cx - 8, y + 6, 16, 6, 1.5); g.fill();                                 // its stand
      g.fillStyle = '#1d1e21'; rr(cx - w * 0.22, y + h - 7, w * 0.44, 3.4, 1.5); g.fill();              // soundbar
      g.fillStyle = '#222326'; rr(x + 6, y + h - 10, 12, 6, 1); g.fill(); circ(x + 16, y + h - 7, 0.7, '#3ac87a');
      return true;
    }
    case 'D': {                                       // desk: worktop, a monitor on its foot, keyboard, mouse, a lamp
      if (f.kind !== 'desk' && f.kind !== 'pc') return false;
      g.fillStyle = '#4a3424'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#7a5a3c'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 2); g.fill();
      if (f.kind === 'pc') {                          // the mission PC: a wide monitor, the tower at one end, keyboard, mouse, headphones
        const mx = cx - 6;
        g.fillStyle = '#18191c'; rr(mx - 17, y + 3.4, 34, 3.6, 1); g.fill(); g.fillStyle = '#2a2b2e'; rr(mx - 4, y + 7, 8, 4, 1); g.fill();
        g.fillStyle = 'rgba(120,170,255,0.4)'; g.fillRect(mx - 16, y + 5.6, 32, 1.4);              // the panel (lit live: drawPcScreen)
        g.fillStyle = '#141518'; rr(x + w - 15, y + 4, 12, h - 8, 1.5); g.fill(); g.fillStyle = '#2b2d33'; rr(x + w - 14, y + 5, 10, h - 10, 1); g.fill();   // the tower
        g.fillStyle = 'rgba(0,0,0,0.45)'; for (let q = 0; q < 5; q++) g.fillRect(x + w - 12.5, y + 8 + q * 2, 7, 0.8);   // its vents
        circ(x + w - 9, y + h - 8, 1, '#5ad1ff');                                                 // power light
        g.fillStyle = '#26272b'; rr(mx - 13, y + h - 14, 26, 7, 1); g.fill(); g.fillStyle = '#3a3c42'; for (let q = 0; q < 4; q++) g.fillRect(mx - 12, y + h - 13 + q * 1.6, 24, 0.7);
        g.fillStyle = '#26272b'; rr(mx + 16, y + h - 13, 3.6, 5.6, 1.7); g.fill();
        g.strokeStyle = '#1e1f23'; g.lineWidth = 1.6; g.beginPath(); g.arc(x + 8, y + h - 10, 4.5, Math.PI * 0.9, Math.PI * 2.1); g.stroke();   // headphones
        circ(x + 3.8, y + h - 9, 1.8, '#1e1f23'); circ(x + 12.2, y + h - 9, 1.8, '#1e1f23');
        return true;
      }
      g.fillStyle = '#18191c'; rr(cx - 14, y + 4, 28, 3, 1); g.fill(); g.fillStyle = '#2a2b2e'; rr(cx - 4, y + 7, 8, 4, 1); g.fill();
      g.fillStyle = 'rgba(120,170,255,0.4)'; g.fillRect(cx - 13, y + 6.2, 26, 0.7);
      g.fillStyle = '#d8dadc'; rr(cx - 11, y + h - 13, 22, 6, 1); g.fill(); g.fillStyle = '#b8bcc0'; for (let q = 0; q < 3; q++) g.fillRect(cx - 10, y + h - 12 + q * 1.8, 20, 0.6);
      g.fillStyle = '#d8dadc'; rr(cx + 15, y + h - 12, 3.5, 5, 1.6); g.fill();
      circ(x + 7, y + 7, 3.4, '#2a2b2e'); circ(x + 7, y + 7, 1.8, '#e8dcc0');
      return true;
    }
    case 'tub': {                                     // bathtub: wide rim, rounded basin, the taps and drain at one end
      g.fillStyle = '#c8ccd0'; rr(x, y, w, h, 5); g.fill(); g.fillStyle = '#f2f3f4'; rr(x + 1, y + 1, w - 2, h - 2, 5); g.fill();
      g.fillStyle = '#dfe3e6'; rr(x + 5, y + 5, w - 10, h - 10, h / 2 - 5); g.fill();
      g.fillStyle = 'rgba(160,195,220,0.35)'; rr(x + 7, y + 7, w - 14, h - 14, h / 2 - 7); g.fill();
      circ(x + 11, cy, 1.6, '#8a9096'); g.fillStyle = '#b8bec4'; rr(x + 2.5, cy - 4, 4, 8, 1); g.fill(); circ(x + 4.5, cy - 6, 1.3, '#a8aeb4'); circ(x + 4.5, cy + 6, 1.3, '#a8aeb4');
      return true;
    }
    case 'sink': {                                    // vanity: cabinet, worktop, an oval basin, a mixer tap at the back
      g.fillStyle = '#4a3a2c'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#e6e3dc'; rr(x + 1, y + 1, w - 2, h - 2, 2); g.fill();
      g.fillStyle = '#c8ccd0'; g.beginPath(); g.ellipse(cx, cy + 1.5, w * 0.24, h * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#eef0f2'; g.beginPath(); g.ellipse(cx, cy + 1.5, w * 0.2, h * 0.24, 0, 0, Math.PI * 2); g.fill();
      circ(cx, cy + 2.5, 0.9, '#8a9096'); g.fillStyle = '#a8aeb4'; rr(cx - 1.2, y + 2, 2.4, 5, 1); g.fill(); circ(cx, y + 2.6, 1.6, '#b8bec4');
      return true;
    }
  }
  return false;
}
/* A piece can stand against any wall: `f.face` (0 top, 1 right, 2 bottom, 3 left) is the side its back is against. Every
   piece is drawn upright (back at the top) and turned to suit; the things on top are drawn after, in the world's frame. */
function drawFurniture(g, c, x, y, w, h, n, f, room) {
  const fc = f && f.face;
  if (fc) {
    const odd = fc % 2, cw = odd ? h : w, ch = odd ? w : h;
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(fc * Math.PI / 2); drawFurniture0(g, c, -cw / 2, -ch / 2, cw, ch, n, f, room); g.restore();
  } else drawFurniture0(g, c, x, y, w, h, n, f, room);
  if (f && f.top) for (const [t, rx, ry, a, col] of f.top) drawDecor(g, t, f.x + rx, f.y + ry, a, col);   // things left on top of it
}
function drawFurniture0(g, c, x, y, w, h, n, f, room) {
  const rr = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const circ = (cx, cy, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
  const seed = f ? f.seed : (x * 0.137 + y * 0.311);
  const R = i => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  const across = w >= h, cx = x + w / 2, cy = y + h / 2;
  room = room || (f && f.room);
  if (f && f.face !== undefined && drawHomePiece(g, c, x, y, w, h, f, rr, line, circ)) return;   // a home's furniture, drawn from real pieces
  const near = (dx, dy) => wall(Math.floor((cx + dx) / T), Math.floor((cy + dy) / T));
  // draw a prop that has a facing (rot) in its own frame: long axis along x
  const turned = fn => {
    const a = (f && f.rot) || 0, along = Math.abs(Math.cos(a)) > 0.5 ? w : h, wide = along === w ? h : w;
    g.save(); g.translate(cx, cy); g.rotate(a); fn(along, wide); g.restore();
  };
  switch (c) {
    case 'E':
      g.fillStyle = '#8a92a2'; g.fillRect(x + 2, y + 8, w - 4, h - 8);
      g.fillStyle = '#6f7786'; g.fillRect(x + 6, y + 12, w - 12, h - 14);
      g.strokeStyle = '#2a2e36'; g.lineWidth = 2; line(x + w / 2, y + 12, x + w / 2, y + h - 2);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; for (let q = x + 9; q < x + w - 6; q += 5) line(q, y + 13, q, y + h - 3);
      break;
    case 'C':
      g.fillStyle = '#545866'; rr(x + 3, y + 3, w - 6, h - 6, 6); g.fill();
      g.fillStyle = '#626777'; rr(x + 11, y + 11, w - 22, h - 22, 4); g.fill();
      g.strokeStyle = '#7a8090'; g.lineWidth = 2; rr(x + 7, y + 7, w - 14, h - 14, 5); g.stroke();
      break;
    case 'S': {
      // sofa / bench / banquette: frame, seat cushions, back against the nearest wall, a couple of throw pillows
      const back = f && f.face !== undefined ? 'top' : across ? (near(0, -h / 2 - 8) ? 'top' : 'bottom') : (near(-w / 2 - 8, 0) ? 'left' : 'right');
      const sc = (f && f.col) || '#86495b';
      g.fillStyle = shade(sc, 0.67); rr(x + 3, y + 3, w - 6, h - 6, 9); g.fill();
      g.fillStyle = sc; rr(x + 7, y + 7, w - 14, h - 14, 7); g.fill();
      g.fillStyle = shade(sc, 0.82);
      if (back === 'top') rr(x + 4, y + 4, w - 8, 9, 4); else if (back === 'bottom') rr(x + 4, y + h - 13, w - 8, 9, 4);
      else if (back === 'left') rr(x + 4, y + 4, 9, h - 8, 4); else rr(x + w - 13, y + 4, 9, h - 8, 4);
      g.fill();
      g.strokeStyle = shade(sc, 0.67); g.lineWidth = 2;
      if (across) for (let q = T; q < w - 4; q += T) line(x + q, y + 8, x + q, y + h - 8);
      else for (let q = T; q < h - 4; q += T) line(x + 8, y + q, x + w - 8, y + q);
      g.fillStyle = '#c9a46a';
      if (across) { rr(x + 12, y + h / 2 - 5, 10, 10, 2); g.fill(); rr(x + w - 22, y + h / 2 - 5, 10, 10, 2); g.fill(); }
      else { rr(x + w / 2 - 5, y + 12, 10, 10, 2); g.fill(); rr(x + w / 2 - 5, y + h - 22, 10, 10, 2); g.fill(); }
      break;
    }
    case 'D': {
      if (f && f.kind === 'piano') {                              // grand piano: black lacquer, lid, keyboard
        g.fillStyle = '#141418'; rr(x + 3, y + 3, w - 6, h - 6, 10); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5; rr(x + 8, y + 8, w - 16, h - 22, 8); g.stroke();
        g.fillStyle = '#f2f0ea'; g.fillRect(x + 6, y + h - 13, w - 12, 8);
        g.fillStyle = '#141418'; for (let q = x + 9; q < x + w - 8; q += 5.5) g.fillRect(q, y + h - 13, 2.2, 5);
        break;
      }
      if (f ? f.kind === 'meeting' : w >= 4 * T) {               // meeting table: laptops, papers, water
        g.fillStyle = '#5e4028'; rr(x + 4, y + 4, w - 8, h - 8, 10); g.fill();
        g.fillStyle = '#7a5636'; rr(x + 8, y + 8, w - 16, h - 16, 8); g.fill();
        for (let q = 0; q < Math.round(w / T); q++) {
          const px = x + T * (q + 0.5);
          for (const top of [true, false]) {
            const py = top ? y + 14 : y + h - 26;
            if (R(q * 2 + (top ? 1 : 0)) < 0.55) { g.fillStyle = '#2a2c32'; g.fillRect(px - 9, py, 18, 12); g.fillStyle = '#5a8ac8'; g.fillRect(px - 7, py + (top ? 1 : 7), 14, 4); }
            else { g.fillStyle = '#ece8dc'; g.save(); g.translate(px, py + 6); g.rotate(R(q + 9) - 0.5); g.fillRect(-6, -8, 12, 16); g.restore(); }
            circ(px + 13, py + 6, 2.6, 'rgba(140,190,230,0.9)');
          }
        }
        break;
      }
      if (f ? f.kind === 'reception' : h >= 5 * T) {             // reception desk: stone top, monitors, bell, papers, phone
        g.fillStyle = '#5e4028'; rr(x + 3, y + 3, w - 6, h - 6, 5); g.fill();
        g.fillStyle = '#cfc6b6'; rr(x + 7, y + 6, w - 14, h - 12, 4); g.fill();
        for (const my of [y + 40, y + h - 70]) {
          g.fillStyle = '#1e2026'; g.fillRect(x + w - 16, my, 7, 26); g.fillStyle = '#4a86d8'; g.fillRect(x + w - 14, my + 2, 2, 22);
          g.fillStyle = '#3a3d44'; g.fillRect(x + 10, my + 4, 8, 18);
        }
        circ(x + w / 2, y + h / 2, 4, '#d8b04a'); circ(x + w / 2, y + h / 2, 1.5, '#8a6a2a');
        g.fillStyle = '#f0ece0'; g.fillRect(x + 10, y + h / 2 + 30, 14, 18);
        g.fillStyle = '#2a2c32'; rr(x + 10, y + 16, 14, 10, 2); g.fill();
        break;
      }
      // office desk: monitor, keyboard, mouse, papers, a mug
      g.fillStyle = '#6b4a2e'; rr(x + 4, y + 4, w - 8, h - 8, 5); g.fill();
      g.fillStyle = '#7d5838'; rr(x + 8, y + 8, w - 16, h - 16, 4); g.fill();
      if (f && f.room === 'o') {
        g.fillStyle = '#1e2026'; g.fillRect(cx - 14, y + 8, 28, 6); g.fillStyle = '#6aa8ff'; g.fillRect(cx - 12, y + 12, 24, 1.5);
        g.fillStyle = '#3a3d44'; g.fillRect(cx - 11, y + h - 18, 22, 7);
        circ(cx + 17, y + h - 14, 2.5, '#2a2c32');
        g.fillStyle = '#ece8dc'; g.save(); g.translate(x + 16, cy); g.rotate(R(3) - 0.5); g.fillRect(-6, -8, 12, 16); g.restore();
        circ(x + w - 14, y + 16, 4, '#e8e0d0'); circ(x + w - 14, y + 16, 2.5, '#5a3a2a');
      }
      break;
    }
    case 'B': {
      // bar: dark wood with a brass rail, bottles, glasses, beer taps; the back bar is shelves of bottles
      const backBar = f ? f.kind === 'backbar' : !across && w < T * 0.9 + 6 && near(w / 2 + 8, 0);
      g.fillStyle = '#4e2f22'; rr(x + 3, y + 3, w - 6, h - 6, 4); g.fill();
      g.fillStyle = '#6a4030'; rr(x + 8, y + 8, w - 16, h - 16, 3); g.fill();
      const cols = ['#4f8a5c', '#9a7a3a', '#7a4a8a', '#8a3a3a', '#3a6a8a', '#c8b060'];
      const len = across ? w : h, step = backBar ? 9 : 18;
      for (let q = 12, k = 0; q < len - 10; q += step, k++) {
        const bx = across ? x + q : cx + (backBar ? (k % 2 ? -6 : 6) : 4), by = across ? cy + 4 : y + q;
        circ(bx, by, backBar ? 3.2 : 3.5, cols[(k + (seed | 0)) % cols.length]);
        if (!backBar && k % 2 === 0) circ(across ? bx + 6 : bx - 10, across ? by - 10 : by + 6, 2.6, 'rgba(225,235,245,0.8)');   // glass
      }
      if (!backBar) {
        g.strokeStyle = '#c8a24a'; g.lineWidth = 2;
        if (across) line(x + 6, y + h - 6, x + w - 6, y + h - 6); else line(x + 6, y + 6, x + 6, y + h - 6);
        for (let q = 0; q < 3; q++) circ(across ? x + 30 + q * 10 : cx + 8, across ? y + 10 : y + 30 + q * 10, 2.2, '#c9ced6');   // taps
      }
      break;
    }
    case 'K': {
      if (room === 'u') {                                         // restroom vanity: white top, basins, mirror on the wall
        g.fillStyle = '#c8ccd0'; rr(x + 3, y + 3, w - 6, h - 6, 4); g.fill();
        g.fillStyle = '#e6e9ec'; rr(x + 6, y + 6, w - 12, h - 12, 3); g.fill();
        g.fillStyle = 'rgba(170,215,240,0.55)'; g.fillRect(x - 3, y + 6, 3, h - 12);
        for (let q = y + 24; q < y + h - 10; q += 46) {
          g.fillStyle = '#b8bec4'; g.beginPath(); g.ellipse(cx + 2, q, 9, 12, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#d0d5da'; g.beginPath(); g.ellipse(cx + 2, q, 6.5, 9, 0, 0, Math.PI * 2); g.fill();
          circ(cx - 9, q, 2, '#9aa2aa');
        }
        break;
      }
      if (room === 'k' && w === 2 * T && h === 2 * T) {          // walk-in fridge
        g.fillStyle = '#9aa3ad'; rr(x + 3, y + 3, w - 6, h - 6, 4); g.fill();
        g.strokeStyle = '#6a737c'; g.lineWidth = 2; line(cx, y + 6, cx, y + h - 6);
        g.fillStyle = '#d0d6dc'; g.fillRect(cx - 5, cy - 14, 2.5, 28); g.fillRect(cx + 2.5, cy - 14, 2.5, 28);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 6, y + 6, w - 12, 4);
        break;
      }
      if ((MAP.gen || MAP.id === 'house') && room !== 'u') {      // a home kitchen: cabinets under a stone worktop; what's on it comes from f.top
        g.fillStyle = '#4a3a2c'; rr(x + 1, y + 1, w - 2, h - 2, 3); g.fill();
        g.fillStyle = '#d4cec4'; rr(x + 2.5, y + 2.5, w - 5, h - 5, 2.5); g.fill();
        g.fillStyle = 'rgba(120,110,100,0.18)'; for (let q = 0; q < w * h / 400; q++) g.fillRect(x + 3 + R(q) * (w - 6), y + 3 + R(q + 50) * (h - 6), 1.4, 1.4);
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.8; for (let q = x + T; q < x + w - 4; q += T) line(q, y + 3, q, y + h - 3);
        break;
      }
      g.fillStyle = '#6f7882'; rr(x + 3, y + 3, w - 6, h - 6, 4); g.fill();
      g.fillStyle = '#8a949e'; rr(x + 7, y + 7, w - 14, h - 14, 3); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1; line(x + 8, y + 8, x + w - 8, y + 8);
      if (room === 'k' && across && cy < 8 * T) {                // stove island: burners, a pot, a pan
        for (let q = 0; q < 4; q++) for (let r = 0; r < 2; r++) {
          const bx = x + 22 + q * ((w - 44) / 3), by = y + 22 + r * (h - 44);
          circ(bx, by, 11, '#2a2c30'); g.strokeStyle = '#555a60'; g.lineWidth = 1.5; g.beginPath(); g.arc(bx, by, 7, 0, Math.PI * 2); g.stroke();
        }
        circ(x + 22, y + 22, 9, '#9aa2aa'); circ(x + 22, y + 22, 6.5, '#c0c6cc');
        circ(x + w - 22, y + h - 22, 8, '#3a3a3e'); g.strokeStyle = '#3a3a3e'; g.lineWidth = 3; line(x + w - 22, y + h - 22, x + w - 6, y + h - 32);
      } else if (room === 'k' && across) {                       // prep island: boards, knives, bowls
        for (let q = 0; q < 3; q++) {
          const bx = x + 20 + q * ((w - 40) / 2);
          g.fillStyle = '#b8864e'; rr(bx - 12, cy - 9, 24, 18, 3); g.fill();
          g.strokeStyle = '#d8dde2'; g.lineWidth = 1.5; line(bx - 6, cy - 3, bx + 8, cy + 3);
        }
        circ(x + w - 18, y + 14, 7, '#e8e4dc'); circ(x + 18, y + h - 14, 6, '#d8b060');
      } else if (room === 'k') {                                  // wall counter: microwave, sink, coffee machine
        g.fillStyle = '#2c2e34'; g.fillRect(x + 6, y + 30, w - 12, 30); g.fillStyle = '#4a5260'; g.fillRect(x + 9, y + 34, w - 24, 22);
        g.fillStyle = '#c8ccd0'; g.fillRect(x + w - 13, y + 36, 4, 18);
        g.fillStyle = '#5e666e'; rr(x + 8, cy - 22, w - 16, 44, 5); g.fill(); g.fillStyle = '#4a5158'; rr(x + 11, cy - 19, w - 22, 38, 4); g.fill();
        circ(x + w - 12, cy, 2.5, '#c8ccd0');
        g.fillStyle = '#1e1e22'; g.fillRect(x + 8, y + h - 70, w - 16, 24); circ(cx, y + h - 58, 4, '#5a3a2a');
      } else if (room === 'w') {                                  // restaurant buffet: chafing dishes and plates
        for (let q = x + 26; q < x + w - 16; q += 48) {
          g.fillStyle = '#b8c0c8'; rr(q - 16, cy - 9, 32, 18, 6); g.fill();
          g.fillStyle = '#d8dee4'; rr(q - 12, cy - 6, 24, 12, 5); g.fill();
        }
        circ(x + 12, cy, 7, '#f0ece4'); circ(x + 12, cy, 4.5, '#e2ddd2');
      }
      break;
    }
    case 't': {
      const kind = f && f.kind;
      if (kind === 'coffee') {                                    // low coffee table: books, a magazine, a cup
        g.fillStyle = '#4a321e'; rr(x + 2, y + 2, w - 4, h - 4, 4); g.fill();
        g.fillStyle = '#5e4028'; rr(x + 5, y + 5, w - 10, h - 10, 3); g.fill();
        const bc = ['#8a3a3a', '#3a5a8a', '#c8a24a', '#3a7a5a'];
        for (let q = 0; q < 3; q++) { g.fillStyle = bc[(q + (seed | 0)) % 4]; g.save(); g.translate(cx - 4, cy - 2 + q * 2.5); g.rotate((R(q) - 0.5) * 0.5); g.fillRect(-7, -5, 14, 10); g.restore(); }
        g.fillStyle = '#e8e0cc'; g.save(); g.translate(cx + 7, cy + 6); g.rotate(0.5); g.fillRect(-5, -7, 10, 14); g.restore();
        circ(x + w - 8, y + 8, 3, '#e8e4dc');
      } else if (kind === 'bar') {                                // lounge table: dark wood, a candle, two drinks
        g.fillStyle = '#3e2a1e'; g.beginPath(); g.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4e3424'; g.beginPath(); g.arc(cx, cy, w / 2 - 5, 0, Math.PI * 2); g.fill();
        circ(cx, cy, 3, '#f0e6c8'); circ(cx, cy, 1.4, '#ffb050');
        circ(cx - 8, cy + 5, 2.6, 'rgba(225,235,245,0.85)'); circ(cx + 7, cy - 6, 2.6, 'rgba(200,150,80,0.9)');
      } else if (MAP.gen || MAP.id === 'house') {                // a home's dining table: bare wood, placemats, a bowl in the middle
        g.fillStyle = '#4a3424'; rr(x, y, w, h, 3); g.fill(); g.fillStyle = '#7a5a3c'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 3); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.6; for (let q = y + 5; q < y + h - 3; q += 5) line(x + 3, q, x + w - 3, q);
        const n = Math.max(1, Math.round((across ? w : h) / 30));
        for (let q = 0; q < n; q++) for (const s of [-1, 1]) {
          const px = across ? x + (q + 0.5) * w / n : cx + s * (w / 2 - 9), py = across ? cy + s * (h / 2 - 9) : y + (q + 0.5) * h / n;
          g.fillStyle = 'rgba(232,226,212,0.9)'; rr(px - 7, py - 5.5, 14, 11, 1); g.fill(); circ(px, py, 3.6, '#f6f4ee'); circ(px, py, 2.4, '#e8e4da');
        }
        circ(cx, cy, 5, '#c8b08a'); circ(cx - 1.5, cy - 1, 1.5, '#d8402c'); circ(cx + 1.6, cy + 0.5, 1.5, '#e8b030');
      } else {                                                    // dining table: cloth, plates, glasses, cutlery, flowers
        g.fillStyle = '#d8d2c4'; rr(x + 1, y + 1, w - 2, h - 2, 4); g.fill();
        g.fillStyle = '#ece7dc'; rr(x + 3, y + 3, w - 6, h - 6, 3); g.fill();
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          if (R(dx * 3 + dy + 5) < 0.2) continue;
          const px = cx + dx * (w / 2 - 8), py = cy + dy * (h / 2 - 8);
          circ(px, py, 5, '#ffffff'); circ(px, py, 3.2, '#eeeae2');
          g.strokeStyle = '#a0a6ae'; g.lineWidth = 1; line(px - dy * 7 - dx * 2, py + dx * 7 - dy * 2, px - dy * 7 + dx * 3, py + dx * 7 + dy * 3);
          circ(px + dy * 6 + dx * 4, py - dx * 6 + dy * 4, 1.8, 'rgba(180,215,240,0.9)');
        }
        circ(cx, cy, 3, '#3f7a4a'); circ(cx + 1.5, cy - 1, 1.6, '#d84a6a');
      }
      break;
    }
    case 'P':
      g.fillStyle = '#5a6058'; rr(x + 6, y + 6, w - 12, h - 12, 7); g.fill();
      g.fillStyle = '#3a2e22'; rr(x + 9, y + 9, w - 18, h - 18, 5); g.fill();
      for (const [ox, oy, r, col] of [[-7, -5, 10, '#376b40'], [7, -3, 10, '#4b8f57'], [0, 7, 10, '#3f7a4a'], [-4, 2, 7, '#5aa066'], [5, 6, 6, '#4b8f57']]) circ(cx + ox, cy + oy, r, col);
      break;
    case 'L':
      g.strokeStyle = '#c8a64a'; g.lineWidth = 3; rr(x + 5, y + 5, w - 10, h - 10, 4); g.stroke();
      g.fillStyle = '#8a3a3a'; rr(x + 10, y + 10, 13, 19, 2); g.fill();
      g.fillStyle = '#3a6a8a'; rr(x + 24, y + 14, 13, 20, 2); g.fill();
      g.fillStyle = '#6a5a3a'; rr(x + 12, y + 30, 22, 8, 2); g.fill();
      g.strokeStyle = '#e8d8a8'; g.lineWidth = 1.5; line(x + 13, y + 16, x + 20, y + 16);
      break;
    case 'X':
      g.fillStyle = '#7a6240'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      g.strokeStyle = '#5a4630'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
      for (let q = y + 12; q < y + h - 6; q += 9) line(x + 5, q, x + w - 5, q);
      g.fillStyle = 'rgba(30,20,10,0.45)'; g.font = '700 9px sans-serif'; g.textAlign = 'center'; g.fillText('FRAGILE', cx, cy + 3);
      break;
    case 'G':
      g.strokeStyle = '#8a929e'; g.lineWidth = 2;
      if (across) {
        g.fillStyle = 'rgba(150,200,235,0.38)'; g.fillRect(x, y + h / 2 - 5, w, 10);
        line(x, y + h / 2 - 6, x + w, y + h / 2 - 6); line(x, y + h / 2 + 6, x + w, y + h / 2 + 6);
        for (let q = 0; q <= w; q += T) line(x + q, y + h / 2 - 6, x + q, y + h / 2 + 6);
        g.strokeStyle = 'rgba(230,245,255,0.45)'; line(x + 6, y + h / 2 - 2, x + w - 6, y + h / 2 - 2);
      } else {
        g.fillStyle = 'rgba(150,200,235,0.38)'; g.fillRect(x + w / 2 - 5, y, 10, h);
        line(x + w / 2 - 6, y, x + w / 2 - 6, y + h); line(x + w / 2 + 6, y, x + w / 2 + 6, y + h);
        for (let q = 0; q <= h; q += T) line(x + w / 2 - 6, y + q, x + w / 2 + 6, y + q);
        g.strokeStyle = 'rgba(230,245,255,0.45)'; line(x + w / 2 - 2, y + 6, x + w / 2 - 2, y + h - 6);
      }
      break;
    case 'c': case 'y': {
      const taxi = c === 'y';
      const body = taxi ? '#c9a227' : ['#7a2a32', '#2e4a78', '#5e6066', '#2e6a52'][(f && f.tint !== undefined ? f.tint : n) % 4];
      const parts = f && f.parts;                      // a vehicle with separate parts: the sprite is just the body; tyres, glass, lights, mirrors and doors are drawn live
      if (!parts) { g.fillStyle = '#16171a'; for (const [wx, wy] of [[x + w * 0.2, y + 6], [x + w * 0.2, y + h - 10], [x + w * 0.74, y + 6], [x + w * 0.74, y + h - 10]]) g.fillRect(wx - 9, wy, 18, 4); }   // tyres
      g.fillStyle = body; rr(x + 4, y + 8, w - 8, h - 16, 18); g.fill();
      if (parts) {                                     // panel lines where the doors are
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
        for (const q of [0.24, 0.42, 0.62]) { line(x + w * q, y + 8, x + w * q, y + 15); line(x + w * q, y + h - 8, x + w * q, y + h - 15); }
        g.fillStyle = 'rgba(255,255,255,0.12)'; rr(x + 10, y + 10, w - 20, 6, 3); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.22)'; rr(x + w * 0.3, y + 16, w * 0.4, h - 32, 8); g.fill();       // roof
        break;
      }
      g.fillStyle = 'rgba(255,255,255,0.12)'; rr(x + 10, y + 10, w - 20, 6, 3); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.22)'; rr(x + w * 0.3, y + 16, w * 0.4, h - 32, 8); g.fill();       // roof
      g.fillStyle = '#2a3440'; rr(x + w * 0.66, y + 18, 14, h - 36, 4); g.fill(); rr(x + w * 0.24, y + 18, 11, h - 36, 4); g.fill();   // glass
      g.fillStyle = 'rgba(160,190,220,0.35)'; g.fillRect(x + w * 0.66 + 3, y + 20, 3, h - 40);
      g.fillStyle = '#f4f0d0'; g.fillRect(x + w - 9, y + 13, 4, 9); g.fillRect(x + w - 9, y + h - 22, 4, 9);   // headlights
      g.fillStyle = '#c8282e'; g.fillRect(x + 5, y + 13, 3, 9); g.fillRect(x + 5, y + h - 22, 3, 9);            // tail lights
      g.fillStyle = body; g.fillRect(x + w * 0.62, y + 3, 6, 6); g.fillRect(x + w * 0.62, y + h - 9, 6, 6);  // mirrors
      if (taxi) { g.fillStyle = '#f0e070'; rr(x + w * 0.45, cy - 6, 16, 12, 2); g.fill(); g.fillStyle = '#2a2a2a'; g.fillRect(x + w * 0.45 + 3, cy - 2, 10, 4); }
      break;
    }
    // ---------------- props ----------------
    case 'chair':
      turned((L, Wd) => {
        g.fillStyle = '#5e4028'; rr(-L / 2, -Wd / 2, L, Wd, 3); g.fill();
        g.fillStyle = '#8a6440'; rr(-L / 2 + 2, -Wd / 2 + 2, L - 4, Wd - 4, 2); g.fill();
        g.fillStyle = '#4a321e'; g.fillRect(-L / 2, -Wd / 2, 3.5, Wd);            // backrest (away from the table)
      });
      break;
    case 'stool':
      circ(cx, cy, w / 2, '#5e4028'); circ(cx, cy, w / 2 - 2.5, '#8a8f98'); circ(cx - 1.5, cy - 1.5, 2, 'rgba(255,255,255,0.25)');
      break;
    case 'ochair':
      turned((L, Wd) => {
        g.strokeStyle = '#1c1d22'; g.lineWidth = 2;
        for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2; line(0, 0, Math.cos(a) * (L / 2 + 1), Math.sin(a) * (Wd / 2 + 1)); }
        g.fillStyle = '#2c2e34'; rr(-L / 2 + 2, -Wd / 2 + 2, L - 4, Wd - 4, 5); g.fill();
        g.fillStyle = '#44474f'; rr(-L / 2, -Wd / 2 + 1, 5, Wd - 2, 2); g.fill();  // backrest
      });
      break;
    case 'toilet':
      turned((L, Wd) => {
        g.fillStyle = '#c8cdd2'; rr(-L / 2, -Wd / 2, 7, Wd, 2); g.fill();           // tank against the wall
        g.fillStyle = '#eef0f2'; g.beginPath(); g.ellipse(2.5, 0, L / 2 - 2.5, Wd / 2 - 1, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#b8c4cc'; g.beginPath(); g.ellipse(3.5, 0, L / 2 - 6, Wd / 2 - 4, 0, 0, Math.PI * 2); g.fill();
        circ(-L / 2 + 3.5, 0, 1.4, '#9aa2aa');
      });
      break;
    case 'urinal':
      g.fillStyle = '#eef0f2'; rr(x, y, w, h, 5); g.fill();
      g.fillStyle = '#c8d0d6'; rr(x + 3, y + 3, w - 6, h - 5, 4); g.fill(); circ(cx, cy + 1, 1.5, '#8a929a');
      break;
    case 'stall':
      g.fillStyle = '#8c9aa4'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x, y, 1, h);
      break;
    case 'bed': {                                    // double bed: wooden frame, two pillows at the head, the duvet folded back
      g.fillStyle = '#5a3e28'; rr(x, y, w, h, 4); g.fill();
      g.fillStyle = '#6e4e32'; rr(x, y, w, 9, 3); g.fill();                                  // headboard
      g.fillStyle = '#ece6da'; rr(x + 4, y + 8, w - 8, h - 12, 4); g.fill();                  // sheet
      g.fillStyle = '#f6f2ea'; rr(x + 8, y + 12, w / 2 - 12, 18, 6); g.fill(); rr(x + w / 2 + 4, y + 12, w / 2 - 12, 18, 6); g.fill();   // pillows
      g.fillStyle = (f && f.col) || '#3e4c6a'; rr(x + 4, y + 38, w - 8, h - 42, 4); g.fill();                 // duvet
      g.fillStyle = f && f.col ? shade(f.col, 1.3) : '#56668a'; rr(x + 4, y + 38, w - 8, 8, 3); g.fill();     // its folded-back edge
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let q = y + 52; q < y + h - 8; q += 14) line(x + 8, q + R(q) * 3, x + w - 8, q + 2 + R(q + 1) * 3);
      break;
    }
    case 'nstand':                                   // bedside table: drawer front, a small lamp on top
      g.fillStyle = '#6e5034'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#86623f'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 2); g.fill();
      if (f && f.light) { circ(cx + 2, cy - 1, 4.6, '#e8dcc0'); circ(cx + 2, cy - 1, 2.6, '#fff4d8'); } else { g.fillStyle = '#d8c890'; g.fillRect(cx - 4, cy - 2, 7, 4); }
      break;
    case 'ward':                                     // wardrobe: two doors, handles
      g.fillStyle = '#563c26'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#6e4e32'; rr(x + 2, y + 2, w - 4, h - 4, 2); g.fill();
      g.strokeStyle = '#3e2a1a'; g.lineWidth = 1; across ? line(cx, y + 2, cx, y + h - 2) : line(x + 2, cy, x + w - 2, cy);
      g.fillStyle = '#c8b070'; across ? (g.fillRect(cx - 3, cy - 1, 2, 2), g.fillRect(cx + 1, cy - 1, 2, 2)) : (g.fillRect(cx - 1, cy - 3, 2, 2), g.fillRect(cx - 1, cy + 1, 2, 2));
      break;
    case 'shelf': {                                  // bookshelf: rows of coloured spines
      g.fillStyle = '#5a3e28'; rr(x, y, w, h, 2); g.fill();
      const cols = ['#a83a32', '#3a5a8a', '#d8c890', '#4a7a4a', '#7a4a8a', '#c87a3a', '#2a2a2e'];
      let q = x + 2; for (let i = 0; q < x + w - 3; i++) { const bw = 2 + R(i) * 3; g.fillStyle = cols[(R(i + 9) * cols.length) | 0]; g.fillRect(q, y + 2 + R(i + 3) * 2, bw, h - 4 - R(i + 3) * 2); q += bw + 0.6; }
      break;
    }
    case 'sink':                                     // vanity: counter, basin, tap
      g.fillStyle = '#6a5a48'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#e8eaec'; rr(x + 2, y + 2, w - 4, h - 4, 2); g.fill();
      g.fillStyle = '#cfd4d9'; g.beginPath(); g.ellipse(cx, cy + 1, w * 0.25, h * 0.3, 0, 0, Math.PI * 2); g.fill();
      circ(cx, y + 3.5, 1.6, '#9aa0a6');
      break;
    case 'tub':                                      // bathtub: rim, basin, taps at one end
      g.fillStyle = '#d4d8dc'; rr(x, y, w, h, 6); g.fill(); g.fillStyle = '#eef0f2'; rr(x + 3, y + 3, w - 6, h - 6, 8); g.fill();
      g.fillStyle = 'rgba(150,190,220,0.25)'; rr(x + 5, y + 5, w - 10, h - 10, 7); g.fill();
      circ(cx, y + 6, 1.8, '#9aa0a6'); circ(cx, y + h - 8, 1.6, '#8a9096');
      break;
    case 'locker':                                   // gear locker: steel, olive drab, seen from above: the top with its rim and vents, the doors' edge along the front (+y in its frame)
      turned((L, D) => {
        g.fillStyle = '#2b2e28'; rr(-L / 2, -D / 2, L, D, 2); g.fill();
        g.fillStyle = '#4a4f43'; rr(-L / 2 + 1.2, -D / 2 + 1.2, L - 2.4, D - 2.4, 1.5); g.fill();
        const tg = g.createLinearGradient(0, -D / 2, 0, D / 2); tg.addColorStop(0, 'rgba(255,255,255,0.1)'); tg.addColorStop(1, 'rgba(0,0,0,0.18)');
        g.fillStyle = tg; rr(-L / 2 + 1.2, -D / 2 + 1.2, L - 2.4, D - 2.4, 1.5); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.6; for (let q = -L / 2 + 6; q < L / 2 - 5; q += 3) line(q, -D / 2 + 3, q, -D / 2 + 6);   // vents at the back
        g.fillStyle = '#23251f'; g.fillRect(-L / 2 + 1, D / 2 - 3, L - 2, 2);                                     // the doors' top edge
        g.strokeStyle = '#151612'; g.lineWidth = 0.8; line(0, D / 2 - 3, 0, D / 2 - 1);                             // where the two doors meet
        g.fillStyle = '#9a9a8a'; g.fillRect(-1.6, D / 2 - 1.4, 3.2, 1.4);                                          // the handle
        g.fillStyle = 'rgba(220,214,180,0.55)'; g.font = '700 4.5px sans-serif'; g.textAlign = 'center'; g.fillText('GEAR', 0, 2);   // stencil on the top
        g.fillStyle = '#5a5e4e'; rr(-L / 2 + 5, -2, 9, 6, 1); g.fill(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-L / 2 + 6, -1, 7, 1);   // a spare pouch left on top
      });
      break;
    case 'rack': {                                   // gun rack: rifles stood in a frame
      g.fillStyle = '#2b2c30'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#3a3c40'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 2); g.fill();
      for (let q = y + 5; q < y + h - 4; q += 9) { g.fillStyle = '#1d1e21'; g.fillRect(x + 2, q, w - 4, 3); g.fillStyle = '#6a4a30'; g.fillRect(x + w - 5, q - 0.5, 3, 4); }
      break;
    }
    case 'tv':                                       // TV on a low stand, its screen glowing
      g.fillStyle = '#3a2c20'; rr(x, y, w, h, 2); g.fill();
      g.fillStyle = '#111215'; rr(x + 6, y + 3, w - 12, 5, 1); g.fill(); g.fillStyle = 'rgba(120,160,255,0.55)'; g.fillRect(x + 7, y + 6.5, w - 14, 1.2);
      g.fillStyle = '#2a2b2e'; g.fillRect(x + 4, y + 9, 10, 4); g.fillRect(x + w - 14, y + 9, 10, 4);
      break;
    case 'armch':                                    // armchair: back, arms, cushion
      { const ac = (f && f.col) || '#7a5a4a';
      g.fillStyle = shade(ac, 0.77); rr(x, y, w, h, 6); g.fill(); g.fillStyle = ac; rr(x + 3, y + 3, w - 6, h - 6, 5); g.fill();
      g.fillStyle = shade(ac, 1.16); rr(x + 5, y + 7, w - 10, h - 11, 4); g.fill(); }
      break;
    case 'fridge':                                   // fridge: two doors and a handle
      g.fillStyle = '#b8bcc0'; rr(x, y, w, h, 3); g.fill(); g.fillStyle = '#e2e4e6'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 3); g.fill();
      g.strokeStyle = '#9aa0a6'; g.lineWidth = 1; line(x + 2, y + h * 0.38, x + w - 2, y + h * 0.38); g.fillStyle = '#8a9096'; g.fillRect(x + w - 5, y + 4, 2, h - 8);
      break;
    case 'plant': {                                  // potted plant: pot rim and leaves
      circ(cx, cy, w / 2, '#7a3e28'); circ(cx, cy, w / 2 - 2, '#3a2a1e');
      for (let q = 0; q < 7; q++) { const a = q / 7 * Math.PI * 2 + R(q), l = w * (0.35 + R(q + 4) * 0.2); g.fillStyle = q % 2 ? '#3f7a4a' : '#5a9a5c'; g.beginPath(); g.ellipse(cx + Math.cos(a) * l * 0.6, cy + Math.sin(a) * l * 0.6, l * 0.55, l * 0.22, a, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'grill':                                    // kettle grill: lid with a handle and vents
      circ(cx, cy, w / 2, '#1d1e21'); circ(cx, cy, w / 2 - 2, '#2e2f33'); g.fillStyle = '#6a6e76'; g.fillRect(cx - 5, cy - 1.5, 10, 3); circ(cx, cy - 6, 1.4, '#4a4e56'); circ(cx, cy + 6, 1.4, '#4a4e56');
      break;
    case 'bench':                                    // garden bench: slats
      g.fillStyle = '#5e4028'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#8a6440';
      for (let q = y + 2; q < y + h - 2; q += 4) g.fillRect(x + 2, q, w - 4, 2.6);
      break;
    case 'cab':
      g.fillStyle = '#7a8088'; rr(x, y, w, h, 2); g.fill();
      g.fillStyle = '#8f959d'; rr(x + 2, y + 2, w - 4, h - 4, 2); g.fill();
      g.strokeStyle = '#5e646c'; g.lineWidth = 1; for (let q = x + w / 3; q < x + w - 2; q += w / 3) line(q, y + 2, q, y + h - 2);
      g.fillStyle = '#c8ccd0'; for (let q = 0; q < 3; q++) g.fillRect(x + w / 6 + q * w / 3 - 3, y + h - 6, 6, 2);
      break;
    case 'bin':
      circ(cx, cy, w / 2, '#3a3e46'); circ(cx, cy, w / 2 - 2, '#22252a');
      g.fillStyle = '#d8d0b8'; g.save(); g.translate(cx, cy); g.rotate(R(1) * 3); g.fillRect(-3, -2, 6, 4); g.restore();
      break;
    case 'lamp':
      circ(cx, cy, w / 2 + 2, 'rgba(0,0,0,0.25)');
      circ(cx, cy, w / 2, '#e8dcc0'); circ(cx, cy, w / 2 - 3, '#fff4d8'); circ(cx, cy, 2, '#7a6a4a');
      break;
    case 'vend':
      g.fillStyle = '#1e3a6a'; rr(x, y, w, h, 3); g.fill();
      g.fillStyle = '#9ad0ff'; g.fillRect(x + 3, y + h - 8, w - 12, 5);
      const can = ['#e84a3a', '#3a8ae8', '#e8c83a', '#3ac87a'];
      for (let q = 0; q < 4; q++) for (let r = 0; r < 2; r++) circ(x + 6 + q * ((w - 16) / 3), y + 6 + r * 7, 2.2, can[(q + r) % 4]);
      g.fillStyle = '#c8ccd0'; g.fillRect(x + w - 7, y + 6, 3, 8);
      break;
    case 'slamp':
      circ(cx, cy, w / 2 + 1, '#3a3d44'); circ(cx, cy, w / 2 - 1.5, '#6a6e76');
      g.strokeStyle = '#4a4e56'; g.lineWidth = 3; line(cx, cy, cx, cy - 26);
      circ(cx, cy - 28, 6, '#f8e8c0'); circ(cx, cy - 28, 3, '#fffbe8');
      break;
    case 'tcan':
      circ(cx, cy, w / 2, '#4a5a44'); circ(cx, cy, w / 2 - 2.5, '#3a4a36'); circ(cx, cy, 2.5, '#2a3426');
      break;
    case 'hydr':
      circ(cx, cy, w / 2 + 1, '#8a241e'); circ(cx, cy, w / 2 - 1, '#c8382e'); circ(cx, cy, 2, '#e8c040');
      g.fillStyle = '#c8382e'; g.fillRect(cx - w / 2 - 3, cy - 2, 3, 4); g.fillRect(cx + w / 2, cy - 2, 3, 4);
      break;
    case 'stbl':                                     // side table, round or square
      if (f && f.round) { circ(cx, cy, w / 2, '#5e4028'); circ(cx, cy, w / 2 - 2, '#7a5636'); } else { g.fillStyle = '#5e4028'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#7a5636'; rr(x + 2, y + 2, w - 4, h - 4, 2); g.fill(); }
      if (f && f.light) { circ(cx, cy, 6, '#e8dcc0'); circ(cx, cy, 3.8, '#fff4d8'); circ(cx, cy, 1.2, '#7a6a4a'); }
      break;
    case 'dresser':                                  // chest of drawers: drawer lines and knobs
      g.fillStyle = '#563c26'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#7a5838'; rr(x + 2, y + 2, w - 4, h - 4, 2); g.fill();
      g.strokeStyle = '#4a321e'; g.lineWidth = 1;
      if (across) { for (let q = x + w / 3; q < x + w - 3; q += w / 3) line(q, y + 2, q, y + h - 2); for (let q = 0; q < 3; q++) circ(x + w / 6 + q * w / 3, y + h - 5, 1.3, '#c8b070'); }
      else { for (let q = y + h / 3; q < y + h - 3; q += h / 3) line(x + 2, q, x + w - 2, q); for (let q = 0; q < 3; q++) circ(x + w - 5, y + h / 6 + q * h / 3, 1.3, '#c8b070'); }
      break;
    case 'chest':                                    // blanket chest: lid with a brass hasp
      g.fillStyle = '#5a3e28'; rr(x, y, w, h, 3); g.fill(); g.fillStyle = '#7a5636'; rr(x + 2, y + 2, w - 4, h - 4, 3); g.fill();
      g.fillStyle = '#4a321e'; g.fillRect(x + 2, cy - 1, w - 4, 2); g.fillStyle = '#c8a24a'; g.fillRect(cx - 2, y + h - 5, 4, 3);
      break;
    case 'side': {                                   // sideboard / console table: long, low, a few things on top
      g.fillStyle = '#4a321e'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = (f && f.col) || '#6a4a30'; rr(x + 2, y + 2, w - 4, h - 4, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; if (across) line(x + 3, cy, x + w - 3, cy); else line(cx, y + 3, cx, y + h - 3);
      break;
    }
    case 'washer':                                   // washing machine from above: the lid and its round door, the control strip
      g.fillStyle = '#c8ccd0'; rr(x, y, w, h, 3); g.fill(); g.fillStyle = '#eceef0'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 3); g.fill();
      g.fillStyle = '#d8dcdf'; g.fillRect(x + 2, y + 2, w - 4, 6); circ(x + w - 7, y + 5, 1.6, '#6a6e76'); circ(cx, cy + 3, w * 0.3, '#b8c4cc'); circ(cx, cy + 3, w * 0.22, '#8a9aa6');
      break;
    case 'shower': {                                 // shower tray: tiles, drain, glass screen
      g.fillStyle = '#d4d8dc'; rr(x, y, w, h, 3); g.fill(); g.fillStyle = '#eef0f2'; rr(x + 2, y + 2, w - 4, h - 4, 3); g.fill();
      g.strokeStyle = 'rgba(150,160,170,0.35)'; g.lineWidth = 0.6; for (let q = x + 8; q < x + w - 2; q += 8) line(q, y + 2, q, y + h - 2); for (let q = y + 8; q < y + h - 2; q += 8) line(x + 2, q, x + w - 2, q);
      circ(cx, cy, 2.4, '#9aa0a6'); circ(cx, cy, 1.2, '#5a6066');
      g.strokeStyle = 'rgba(180,215,240,0.85)'; g.lineWidth = 2; line(x + 1, y + h - 1, x + w - 1, y + h - 1); line(x + w - 1, y + 1, x + w - 1, y + h - 1);
      circ(x + 6, y + 6, 2.6, '#c8ccd0');
      break;
    }
    case 'shrub': {                                  // a bush: lumpy canopy, darker underneath, a few highlights
      const base = (f && f.col) || '#3f7a4a';
      circ(cx + 2, cy + 3, w / 2, shade(base, 0.55));
      for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2 + R(q), r = w * (0.22 + R(q + 3) * 0.12); circ(cx + Math.cos(a) * w * 0.24, cy + Math.sin(a) * h * 0.24, r, q % 2 ? base : shade(base, 1.18)); }
      circ(cx, cy, w * 0.26, shade(base, 1.08));
      for (let q = 0; q < 6; q++) circ(cx + (R(q + 20) - 0.5) * w * 0.7, cy + (R(q + 30) - 0.5) * h * 0.7, 1.2, f && f.bloom ? f.bloom : shade(base, 1.45));
      break;
    }
    case 'ptable':                                   // round patio table under a striped umbrella
      circ(cx, cy, w / 2, '#c8c6c0'); circ(cx, cy, w / 2 - 2, '#dedcd6');
      for (let q = 0; q < 8; q++) { g.fillStyle = q % 2 ? '#e8e2d0' : ((f && f.col) || '#3a6a8a'); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, w / 2 + 6, q / 8 * Math.PI * 2, (q + 1) / 8 * Math.PI * 2); g.closePath(); g.fill(); }
      circ(cx, cy, 2, '#4a4e56');
      break;
    case 'mailbox':                                  // a post box on a post
      g.fillStyle = '#2a2b2e'; rr(x, y, w, h, 3); g.fill(); g.fillStyle = '#3a3c40'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 3); g.fill();
      g.fillStyle = '#c8382e'; g.fillRect(x + w - 3, y + 1, 2, 6);
      break;
    case 'ac':                                       // AC condenser: housing, round fan grille
      g.fillStyle = '#a8acb0'; rr(x, y, w, h, 2); g.fill(); g.fillStyle = '#c8ccd0'; rr(x + 1.5, y + 1.5, w - 3, h - 3, 2); g.fill();
      circ(cx, cy, Math.min(w, h) * 0.38, '#2a2b2e'); g.strokeStyle = '#6a6e76'; g.lineWidth = 0.7; for (let q = 3; q < Math.min(w, h) * 0.38; q += 2.5) { g.beginPath(); g.arc(cx, cy, q, 0, 7); g.stroke(); }
      circ(cx, cy, 2.4, '#4a4e56');
      break;
    case 'bike': {                                   // bicycle lying on its side
      const c0 = (f && f.col) || '#c83a2a', ax = across;
      const P = (u, v) => ax ? [x + u * w, y + v * h] : [x + v * w, y + u * h];
      g.strokeStyle = '#1d1e21'; g.lineWidth = 2; for (const u of [0.2, 0.8]) { const [px, py] = P(u, 0.5); g.beginPath(); g.arc(px, py, Math.min(w, h) * 0.42, 0, 7); g.stroke(); }
      g.strokeStyle = c0; g.lineWidth = 2; g.beginPath(); g.moveTo(...P(0.2, 0.5)); g.lineTo(...P(0.45, 0.35)); g.lineTo(...P(0.8, 0.5)); g.lineTo(...P(0.55, 0.5)); g.lineTo(...P(0.2, 0.5)); g.stroke();
      g.strokeStyle = '#2a2b2e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(0.72, 0.3)); g.lineTo(...P(0.72, 0.7)); g.stroke();
      break;
    }
    case 'boxes': {                                  // cardboard boxes, taped
      const bx = [[0, 0, 0.6, 0.6], [0.45, 0.35, 0.55, 0.65]];
      for (const [u, v, a, b] of bx) { g.fillStyle = '#9a7848'; rr(x + u * w, y + v * h, a * w, b * h, 1); g.fill(); g.fillStyle = '#b8905a'; rr(x + u * w + 1, y + v * h + 1, a * w - 2, b * h - 2, 1); g.fill(); g.fillStyle = 'rgba(220,210,180,0.7)'; g.fillRect(x + (u + a / 2) * w - 1.5, y + v * h + 1, 3, b * h - 2); }
      break;
    }
    case 'laundry':                                  // laundry basket, clothes heaped in it
      g.fillStyle = '#d8d0b8'; rr(x, y, w, h, 4); g.fill(); g.fillStyle = '#b8b098'; rr(x + 2, y + 2, w - 4, h - 4, 3); g.fill();
      circ(cx - 3, cy - 1, 4.5, '#3a5a8a'); circ(cx + 3, cy + 2, 4, '#e8e4dc'); circ(cx + 2, cy - 3, 3, '#a83a32');
      break;
    case 'otto':                                     // ottoman: a tufted cushion
      g.fillStyle = shade((f && f.col) || '#7a5a4a', 0.75); rr(x, y, w, h, 5); g.fill(); g.fillStyle = (f && f.col) || '#7a5a4a'; rr(x + 2, y + 2, w - 4, h - 4, 4); g.fill();
      circ(cx, cy, 1, 'rgba(0,0,0,0.3)');
      break;
    case 'ccart':
      g.fillStyle = '#c8b032'; rr(x, y, w, h, 3); g.fill();
      circ(x + 8, cy, 6.5, '#2e5a92'); circ(x + 8, cy, 4, '#7ab0e0');
      g.strokeStyle = '#d8d0b0'; g.lineWidth = 2; line(x + w - 10, y + 3, x + w - 4, y + h - 3);
      g.fillStyle = '#3a8a5a'; g.fillRect(x + 17, y + 4, 6, 8); g.fillStyle = '#e8e8e8'; g.fillRect(x + 17, y + h - 10, 8, 6);
      break;
  }
}

/* ---------- props: chairs, stools, restroom fixtures, office and street furniture ----------
   Chairs are their own objects now (pushed around, knocked over by bullets), set around the tables. */
function buildProps() {
  benchPiece = null; lockerPiece = null; tvPiece = null; pcPiece = null;
  const free = (x, y, w, h) => {
    const i0 = Math.floor(x / T), i1 = Math.floor((x + w - 0.01) / T), j0 = Math.floor(y / T), j1 = Math.floor((y + h - 0.01) / T);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (wall(i, j) || doorAt[j * W + i] >= 0) return false;
    for (const o of pieces) if (x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y) return false;
    return true;
  };
  const add = (c, cx, cy, w, h, extra) => {
    const x = cx - w / 2, y = cy - h / 2;
    if (!free(x, y, w, h)) return null;
    const F = FURN[c];
    const f = Object.assign({ c, x, y, w, h, pad: 0, hp: F.hp, maxHp: F.hp, mass: F.mass, fixed: !!F.fixed, rot: 0, holes: [],
      seed: Math.random() * 1000, scrape: 0, broken: false, pusher: null, room: floorAt[Math.floor(cy / T) * W + Math.floor(cx / T)] }, extra || {});
    pieces.push(f);
    if (c === 'c' || c === 'y') vehParts(f);
    return f;
  };
  const LAMP = { r: 120, col: [255, 214, 160], k: 0.5 };
  // tables: dining tables get chairs all round, lounge tables two, coffee tables by the sofas none
  for (const tb of pieces.filter(f => f.c === 't')) {
    const cx = tb.x + tb.w / 2, cy = tb.y + tb.h / 2;
    if (pieces.some(o => o.c === 'S' && !o.builtin && Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < 2.4 * T)) { tb.kind = 'coffee'; continue; }
    tb.kind = tb.room === 'r' ? 'bar' : 'dining';
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (tb.kind === 'bar' && n >= 2) break;
      if (add('chair', cx + dx * 27, cy + dy * 27, 16, 16, { rot: Math.atan2(-dy, -dx) })) n++;
    }
  }
  // desks: an office chair at each, the piano in the lounge
  for (const dk of pieces.filter(f => f.c === 'D' && !f.builtin)) {
    if (dk.room === 'r') { dk.kind = 'piano'; continue; }
    if (MAP.bench && Math.abs(dk.x + dk.w / 2 - MAP.bench.x * T) < T && Math.abs(dk.y + dk.h / 2 - MAP.bench.y * T) < 2 * T) { dk.kind = 'workbench'; benchPiece = dk; continue; }   // the armory workbench: no chair, you stand at it
    dk.kind = 'desk';
    add('ochair', dk.x + dk.w / 2, dk.y + dk.h + 12, 18, 18, { rot: -Math.PI / 2 });
  }
  if (MAP.props) {                                                    // a generated map brings its own
    for (const [c, x, y, w, h, ex] of MAP.props) add(c, x, y, w, h, ex ? Object.assign({}, ex) : null);
    for (const [t, x, y, a, col] of MAP.top || []) {                   // things on tables, counters and dressers ride on that piece
      let best = null;
      for (const f of pieces) if (!f.rot && x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h && (!best || f.w * f.h < best.w * best.h)) best = f;
      if (best) (best.top || (best.top = [])).push([t, x - best.x, y - best.y, a, col]);
    }
    return;
  }
  if (MAP.id === 'house') {                                         // the safe house, furnished like the generated homes: real sizes, backs to the walls (`face`)
    const cm = v => v * T / 90, R2 = (c, cx, cy, dim, face, ex) => add(c, cx, cy, face % 2 ? cm(dim[1]) : cm(dim[0]), face % 2 ? cm(dim[0]) : cm(dim[1]), Object.assign(face === null ? {} : { face }, ex || {}));
    const ON = (f, t, rx, ry, a, col) => f && (f.top || (f.top = [])).push([t, rx, ry, a || 0, col]);
    // bedroom (x 7-14, y 4-10, door south at 11): the bed centred on the north wall between its bedside tables, a bench at its foot,
    // the wardrobe and a bookcase on the west wall, a dresser by the door, a desk on the east wall and a reading chair in the corner
    const bx = 11 * T, bh = cm(210);
    R2('bed', bx, 4 * T + bh / 2, [160, 210], 0, { col: '#3e4c6a' });
    const ns1 = R2('nstand', bx - cm(80) - cm(25) - 6, 4 * T + cm(20), [50, 40], 0, { light: { r: 95, col: [255, 200, 140], k: 0.45 } }), ns2 = R2('nstand', bx + cm(80) + cm(25) + 6, 4 * T + cm(20), [50, 40], 0);
    ON(ns2, 'clock', ns2 && ns2.w / 2, 9); ON(ns1, 'book', ns1 && ns1.w / 2 + 3, 12, 0.3, '#3a5a8a');
    R2('otto', bx, 4 * T + bh + 6 + cm(20), [120, 40], null, { col: '#6a5a4a' });
    R2('ward', 7 * T + cm(30), 6.6 * T, [150, 60], 3); R2('shelf', 7 * T + cm(17.5), 9.1 * T, [90, 35], 3);
    const dz = R2('dresser', 8.9 * T, 11 * T - cm(25), [140, 50], 2); ON(dz, 'frame', dz && dz.w / 2, 8, 0, '#3a5a8a'); ON(dz, 'jbox', dz && dz.w / 2 - 22, 9);
    const dk = pcPiece = R2('D', 15 * T - cm(32.5), 6.2 * T, [130, 65], 1, { kind: 'pc', light: { r: 80, col: [120, 170, 255], k: 0.3 } });   // the mission PC (see MISSION PC)
    if (dk) add('ochair', dk.x - cm(26) - 1, dk.y + dk.h / 2, cm(52), cm(52), { rot: 0 });
    R2('armch', 15 * T - cm(42.5), 9.3 * T, [85, 85], 1, { col: '#6a5a4a' }); R2('stbl', 15 * T - cm(25), 8.25 * T, [50, 50], null, { round: true });
    R2('plant', 14.55 * T, 4.45 * T, [40, 40], null);
    // bathroom (x 16-20, y 4-10, door south at 18): a double vanity under the mirror, the tub along the east wall, the toilet on the west wall, a shower in the corner
    const va = R2('sink', 18.5 * T, 4 * T + cm(27.5), [150, 55], 0); ON(va, 'tooth', va && va.w / 2 - 15, 6); ON(va, 'soap', va && va.w / 2 + 15, 6);
    const tb = R2('tub', 21 * T - cm(37.5), 6.3 * T, [170, 75], 1); ON(tb, 'towel', tb && tb.w / 2, tb && tb.h - 14, Math.PI / 2, '#d8d0c0');
    add('toilet', 16 * T + cm(35), 6.6 * T, cm(70), cm(38), { rot: 0 });
    R2('shower', 16 * T + cm(45), 11 * T - cm(45), [90, 90], 3); R2('laundry', 21 * T - cm(18), 9.4 * T, [50, 36], 1);
    add('bin', 16 * T + 12, 7.7 * T, 13, 13);
    // armory: weapon racks on the west wall, the gear locker on the east wall, a cabinet
    add('cab', 22.6 * T, 10 * T - 11, 30, 20);
    add('rack', 22.28 * T, 7.2 * T, 18, 84);
    lockerPiece = add('locker', 29 * T - 13, 9.9 * T, 24, 50, { rot: Math.PI / 2 });   // the gear locker: steel, against the east wall, doors facing into the room
    // living room (x 7-19, y 12-19): the TV on the north wall, the sofa facing it across a coffee table with an end table each side,
    // an armchair at the table's end, bookcases between the doors; the dining table by the kitchen with a sideboard behind it
    const lx = 9 * T;
    tvPiece = R2('tv', lx, 12 * T + cm(22.5), [170, 45], 0, { light: { r: 140, col: [130, 160, 255], k: 0.35 } });
    const sofaY = 12 * T + cm(45) + cm(240) + cm(46);
    R2('S', lx, sofaY, [215, 92], 2, { col: '#4a5a6a' });
    const ct = R2('t', lx, sofaY - cm(46) - cm(40) - cm(30), [115, 60], null, { kind: 'coffee' }); ON(ct, 'remote', ct && ct.w / 2 + 14, ct && ct.h / 2); ON(ct, 'mag', ct && ct.w / 2 - 12, ct && ct.h / 2, 0.4, '#a83a32');
    const e1 = R2('stbl', lx - cm(107.5) - cm(25) - 6, sofaY, [50, 50], null, { light: { r: 120, col: [255, 206, 150], k: 0.5 } }), e2 = R2('stbl', lx + cm(107.5) + cm(25) + 6, sofaY, [50, 50], null, { round: true });
    ON(e2, 'mug', e2 && e2.w / 2, e2 && e2.h / 2, 0, '#e8e4dc');
    R2('armch', lx + cm(57.5) + cm(42.5) + cm(40), sofaY - cm(46) - cm(40) - cm(30), [85, 85], 1, { col: '#7a4a3a' });
    R2('shelf', 14.5 * T, 12 * T + cm(17.5), [90, 35], 0); R2('shelf', 15.6 * T, 12 * T + cm(17.5), [90, 35], 0);
    const dx = 16.4 * T, dy = 16.3 * T, dt = R2('t', dx, dy, [180, 95], null, { kind: 'dining' });
    if (dt) for (const q of [-1, 0, 1]) for (const sd of [-1, 1]) add('chair', dx + q * cm(60), dy + sd * (dt.h / 2 + cm(22.5) + 1), cm(45), cm(45), { rot: sd < 0 ? Math.PI / 2 : -Math.PI / 2 });
    const sb = R2('side', dx, 20 * T - cm(22.5), [150, 45], 2, { col: '#6a4a30' }); ON(sb, 'vase', sb && 18, sb && sb.h / 2, 0, '#3a6a8a'); ON(sb, 'bowl', sb && sb.w - 22, sb && sb.h / 2, 0, '#c8a24a');
    const cs = R2('side', 9.2 * T, 20 * T - cm(17.5), [120, 35], 2, { col: '#5a3e28' }); ON(cs, 'keys', cs && cs.w - 16, cs && cs.h / 2);   // a console by the front door
    R2('plant', 7 * T + 12, 12 * T + 12, [40, 40], null); R2('plant', 20 * T - 12, 20 * T - 12, [40, 40], null); R2('plant', 7 * T + 12, 20 * T - 12, [40, 40], null);
    // kitchen (x 21-28, y 12-19): the worktop on the south wall (a hob under the hood, a sink), the fridge at its end, an island with stools, a hutch
    const wk = pieces.find(f => f.c === 'K' && f.y > 18 * T), isl = pieces.find(f => f.c === 'K' && f.y > 16 * T && f.y < 18 * T && f.x < 27 * T), ek = pieces.find(f => f.c === 'K' && f.x > 27.5 * T);
    if (ek) { const rx = ek.w - 16; ON(ek, 'coffee', rx, 15.5 * T - ek.y, Math.PI / 2, '#2a2b2e'); ON(ek, 'toaster', rx, 16.4 * T - ek.y, Math.PI / 2, '#c83a2a'); ON(ek, 'dishes', rx, 17.6 * T - ek.y, Math.PI / 2); }
    if (wk) { const ry = wk.h - 16; ON(wk, 'hob', 25 * T - wk.x, ry, Math.PI); ON(wk, 'pan', 25 * T - wk.x, ry + 3); ON(wk, 'ksink', 23 * T - wk.x, ry + 1, Math.PI); ON(wk, 'kettle', 26.6 * T - wk.x, ry, Math.PI, '#e8e4dc'); ON(wk, 'board', 24 * T - wk.x, ry, Math.PI); ON(wk, 'mwave', 22.4 * T - wk.x, ry, Math.PI, '#2a2b2e'); }
    if (isl) { ON(isl, 'bowl', isl.w * 0.3, isl.h / 2, 0, '#e8e4dc'); ON(isl, 'mag', isl.w * 0.72, isl.h / 2, 0.3, '#3a6a8a'); for (const sx of [0.3, 0.7]) add('stool', isl.x + isl.w * sx, isl.y - cm(17.5) - 5, cm(35), cm(35)); }
    R2('fridge', 29 * T - cm(38), 20 * T - cm(37), [76, 74], 2);
    const hu = R2('side', 22.6 * T, 12 * T + cm(22.5), [120, 45], 0, { col: '#6a4a30' }); ON(hu, 'dishes', hu && hu.w / 2, hu && hu.h / 2);
    add('bin', 21 * T + 12, 20 * T - 14, 14, 14);
    // out back: a grill, a bench, plants
    add('grill', 8.2 * T, 1.5 * T, 30, 30); add('bench', 12.5 * T, 1.3 * T, 72, 22); add('plant', 22.5 * T, 1.4 * T, 24, 24); add('plant', 27.6 * T, 1.4 * T, 24, 24);
    add('slamp', 21.5 * T, 23.7 * T, 10, 10, { light: { r: 300, col: [255, 196, 120], k: 0.85 } });
    add('c', 16.62 * T, 26.05 * T, 232, 92, { tint: 1, veh: 'mine' });   // your car, by the kerb (deploying = getting in it)
    add('tcan', 9.5 * T, 21.6 * T, 16, 16);
    return;
  }
  // parked out front: two cars nose to tail along the kerb, the taxi waiting by the entrance, one across the street
  add('c', 3.55 * T, 26.08 * T, 232, 92, { tint: 0 }); add('y', 10.45 * T, 25.95 * T, 236, 94, { veh: 'taxi', lightsOn: true });   // waiting, engine running, lights on
  add('c', 28.4 * T, 26.1 * T, 228, 90, { tint: 2 }); add('c', 21.7 * T, 27.98 * T, 230, 92, { tint: 3 });
  for (let q = 0; q < 4; q++) {                                    // meeting room chairs round the table
    add('ochair', (30.5 + q) * T, 5.62 * T, 18, 18, { rot: Math.PI / 2 });
    add('ochair', (30.5 + q) * T, 8.38 * T, 18, 18, { rot: -Math.PI / 2 });
  }
  add('ochair', 20.45 * T, 14.5 * T, 18, 18, { rot: Math.PI });   // behind reception
  for (let q = 12; q <= 17; q++) add('stool', 30 * T - 6, (q + 0.5) * T, 14, 14);   // bar stools along the counter
  // restrooms: urinals and two stalls in the men's, three stalls in the women's
  add('urinal', 9.6 * T, 4 * T + 6, 16, 11); add('urinal', 10.8 * T, 4 * T + 6, 16, 11);
  add('toilet', 9.4 * T, 6.6 * T, 22, 16); add('toilet', 9.4 * T, 8.6 * T, 22, 16);
  for (const sy of [5.65, 7.6]) add('stall', 9.6 * T, sy * T, 30, 3);
  for (const ty of [4.8, 6.75, 8.7]) add('toilet', 22.6 * T, ty * T, 22, 16, { rot: Math.PI });
  for (const sy of [5.75, 7.7]) add('stall', 22.4 * T, sy * T, 30, 3);
  add('bin', 11.6 * T, 4.4 * T, 12, 12); add('bin', 20.4 * T, 4.4 * T, 12, 12);
  // lobby, elevator hall, office, lounge
  add('lamp', 13.5 * T, 20.5 * T, 12, 12, { light: LAMP }); add('lamp', 27.5 * T, 20.5 * T, 12, 12, { light: LAMP });
  add('lamp', 22.4 * T, 11.4 * T, 12, 12, { light: LAMP });
  add('vend', 13.55 * T, 7.6 * T, 26, 40, { light: { r: 130, col: [150, 200, 255], k: 0.45 } });
  add('bin', 18.6 * T, 9.6 * T, 12, 12); add('bin', 10.5 * T, 15.5 * T, 12, 12);
  add('cab', 27.3 * T, 4 * T + 11, 30, 20); add('cab', 24.6 * T, 10 * T - 11, 30, 20);
  add('bin', 33.6 * T, 4.5 * T, 12, 12);
  add('ccart', 10 * T, 1.6 * T, 34, 20); add('bin', 26 * T, 1.4 * T, 14, 14);
  // street
  for (const lx of [4.5, 12.5, 19.5, 28.5]) add('slamp', lx * T, 24.6 * T, 10, 10, { light: { r: 300, col: [255, 196, 120], k: 0.9 } });
  add('tcan', 10.5 * T, 22.4 * T, 16, 16); add('tcan', 27.5 * T, 22.4 * T, 16, 16);
  add('hydr', 20.7 * T, 24.6 * T, 10, 10);
}

