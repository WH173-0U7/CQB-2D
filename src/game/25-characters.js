/* ================= CHARACTERS ================= */
/* Top-down soldiers: boots that stride in the direction of travel, a jacket with a plate carrier,
   shoulders that counter-rotate with each step and rise with each breath, two-jointed arms that
   actually hold the rifle (elbows solved so the hands stay on the gun), and a head on top.
   The rifle is a physical object: it swings on the arm spring and slides back into the shoulder on recoil. */
function rrPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/* Two-bone arm: given shoulder and hand, find the elbow (bending outward). If the hand is out of reach, the arm straightens. */
/* How the support hand takes the rifle, by what's fitted (more styles as attachments are added: an angled grip, a hand-stop...).
   kind: the hand's drawing; elbow: how far the elbow tucks in toward the shoulder-hand line (down under the gun). */
function holdStyle(P) {
  if (P.att && P.att.grip) return { kind: 'vgrip', elbow: 0.45 };   // a vertical grip: a fist round it, elbow tucked down
  return { kind: 'guard', elbow: 0 };                                // bare handguard: the palm cups it, elbow out
}
function footfall(A) {                                 // a boot comes down: once every half walk cycle, at the stride's widest point (sin(phase) = ±1), so the sound lands with the animation
  const k = Math.floor((A.phase - Math.PI / 2) / Math.PI), hit = A.fk !== undefined && k !== A.fk;
  A.fk = k; return hit;
}
function armIK(sx, sy, hx, hy, seg, bend) {
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 0.001;
  const max = seg * 2 - 0.01;
  if (d > max) { hx = sx + dx / d * max; hy = sy + dy / d * max; d = max; }
  const a = Math.acos(clamp(d / (2 * seg), -1, 1));
  const base = Math.atan2(hy - sy, hx - sx) + bend * a;
  return [sx + Math.cos(base) * seg, sy + Math.sin(base) * seg, hx, hy];
}
/* AK-47, seen from above: butt at x=0, muzzle at x~56 (0.88 m once scaled). Wooden stock and handguard,
   stamped steel receiver with the ejection port and charging handle on the right, curved magazine,
   gas tube over the barrel, front sight, slant muzzle brake. */
/* The AK seen from above, in the rifle's frame (x along the bore, butt at 0, muzzle at ~56; +y is the right side).
   Round parts get a light-to-dark gradient across them so they read as solid; small details: rivets, dust-cover ribs,
   selector lever, rear sight leaf, handguard grain and vents, gas tube, front sight ears, slant brake ports. */
function drawRifle(L, magIn, A) {                              // A: attachments fitted (see ATTACHMENTS), drawn at their real size (a unit is ~16 mm)
  A = A || {};
  const across = (y0, y1, c0, c1, c2) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(0.45, c1); g.addColorStop(1, c2); return g; };
  const ln = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  // stock: tapered, lit along the top edge, grain, butt plate, sling swivel
  ctx.fillStyle = across(-2.8, 2.8, L.woodLight, L.wood, L.woodDark);
  ctx.beginPath(); ctx.moveTo(0, -2.8); ctx.lineTo(15, -2.1); ctx.lineTo(15, 2.1); ctx.lineTo(0, 2.8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.35; ln(2, -1.2, 14, -0.9); ln(2.5, 0.6, 14, 0.5);
  ctx.fillStyle = L.steelDark; ctx.fillRect(0, -2.8, 1.2, 5.6); ctx.fillRect(9, 2.1, 1.4, 0.8);
  // magazine: curved, ribbed
  if (magIn) {
    ctx.fillStyle = L.mag; ctx.beginPath(); ctx.moveTo(21.5, 2.4); ctx.quadraticCurveTo(25.5, 6, 29.5, 9.4);
    ctx.lineTo(26, 10.4); ctx.quadraticCurveTo(22.4, 6.8, 18.8, 2.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.4; ln(21, 3.4, 27.6, 9.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; for (const q of [0.3, 0.55, 0.8]) ln(19.5 + q * 7, 3 + q * 6.8, 22.2 + q * 7, 2.6 + q * 6.6);
  }
  // receiver and dust cover: rounded, ribbed, rivets
  ctx.fillStyle = across(-2.9, 2.9, '#9aa0a8', L.steel, L.steelDark); rrPath(14.5, -2.9, 17.5, 5.8, 1.2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.45;
  if (!L.ak47) {                                             // the AKM's stamped receiver: ribbed dust cover, rivets (the AK-47's is milled and smooth)
    for (const x of [18.5, 20, 21.5, 23, 24.5]) ln(x, -1.9, x, 1.9);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; for (const [x, y] of [[15.6, -2.2], [15.6, 2.2], [29.8, -2.2], [29.8, 2.2]]) { ctx.beginPath(); ctx.arc(x, y, 0.35, 0, Math.PI * 2); ctx.fill(); }
  } else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(16, 2.3, 9, 0.5); }   // the milled lightening cut along the side
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(21.5, 2.1, 4.5, 0.9);                          // ejection port (right side)
  ctx.fillStyle = L.steelDark; ctx.beginPath(); ctx.moveTo(17, 2.9); ctx.lineTo(25, 3.4); ctx.lineTo(25, 3.9); ctx.lineTo(17, 3.4); ctx.closePath(); ctx.fill();   // selector lever
  ctx.fillStyle = L.steel; ctx.fillRect(26.4, 2.6, 1.7, 2.6); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(26.4, 2.6, 1.7, 0.5);   // charging handle
  // rear sight block and leaf
  ctx.fillStyle = L.steelDark; ctx.fillRect(31, -2.2, 2.4, 4.4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(31.2, -0.4, 2.8, 0.8);
  if (A.grip || A.laser || A.ir) {                          // an aluminium M-LOK handguard in place of the wood: top rail, slots down the sides
    ctx.fillStyle = across(-2.7, 2.7, '#4a4c52', '#26272b', '#141518'); rrPath(32.8, -2.7, 11.6, 5.4, 0.9); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; for (const x of [34.2, 37, 39.8]) { rrPath(x, -2.35, 2, 0.5, 0.25); ctx.fill(); rrPath(x, 1.85, 2, 0.5, 0.25); ctx.fill(); }
    ctx.fillStyle = '#1a1b1e'; ctx.fillRect(33, -1.05, 11.2, 2.1);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; for (let x = 33.3; x < 44; x += 0.62) ctx.fillRect(x, -1.05, 0.3, 2.1);   // picatinny teeth
    if (A.grip) { ctx.fillStyle = '#18191c'; rrPath(37.4, 2.5, 3, 1.1, 0.5); ctx.fill(); }   // the grip's foot, just showing under the right side
  } else {
  // handguard: lower wood, upper wood over the gas tube, vents, grain
  ctx.fillStyle = across(-2.8, 2.8, L.woodLight, L.wood, L.woodDark); rrPath(33, -2.8, 10.2, 5.6, 1.4); ctx.fill();
  ctx.fillStyle = across(-1.2, 1.2, L.woodLight, L.wood, L.woodDark); rrPath(33.4, -1.2, 11, 2.4, 1); ctx.fill();
  if (!L.ak47) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (const x of [35.5, 38, 40.5]) ctx.fillRect(x, -2.3, 1.1, 0.5); }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.3; ln(34, 1.8, 42.5, 1.6);
  }
  // gas block, barrel, front sight with protective ears, slant brake with ports
  ctx.fillStyle = L.steelDark; ctx.fillRect(43.2, -1.7, 2.6, 3.4);
  ctx.fillStyle = across(-0.9, 0.9, '#8a9098', L.steelDark, '#16181c'); ctx.fillRect(45, -0.9, 9, 1.8);
  ctx.fillStyle = L.steelDark; ctx.fillRect(50, -1.7, 2, 3.4); ctx.fillRect(50.3, -2.3, 0.6, 0.8); ctx.fillRect(50.3, 1.5, 0.6, 0.8);
  if (A.supp) {                                              // the can in place of the slant brake: 180 mm, 45 mm across, wrench flats at the back
    ctx.fillStyle = across(-1.45, 1.45, '#5a5c62', '#26272b', '#111214'); rrPath(52.2, -1.45, 11.3, 2.9, 1); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(52.9, -1.45, 0.35, 2.9); ctx.fillRect(53.7, -1.45, 0.35, 2.9); ctx.fillRect(62.6, -1.45, 0.3, 2.9);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(54.5, -1.1, 7.8, 0.35);
  } else if (L.ak47) {                                       // the AK-47's muzzle nut over the thread
    ctx.fillStyle = across(-1.1, 1.1, '#6a6e76', L.steelDark, '#111214'); rrPath(53.4, -1.1, 2.2, 2.2, 0.5); ctx.fill();
  } else {
  ctx.beginPath(); ctx.moveTo(53.5, -1.5); ctx.lineTo(56, -1.5); ctx.lineTo(55.2, 1.6); ctx.lineTo(53.5, 1.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(54.2, 0.7, 1, 0.6); ctx.fillRect(54.2, -0.2, 1, 0.5);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(15, -2.9, 16, 0.8); ctx.fillRect(45, -0.9, 9, 0.35);   // light running down the steel
  if (A.dot) {                                               // Aimpoint Micro T-2 (68 x 41 mm) over the receiver on a side mount clamped to the left rail
    ctx.fillStyle = '#1d1e21'; ctx.fillRect(20.2, -4.1, 6.4, 1.4); ctx.fillRect(21.6, -3, 3.6, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(20.2, -4.1, 6.4, 0.35);
    ctx.fillStyle = across(-1.3, 1.3, '#4c4e54', '#232428', '#111214'); rrPath(21.3, -1.3, 4.3, 2.6, 1); ctx.fill();
    ctx.fillStyle = '#2c2d31'; ctx.beginPath(); ctx.arc(23.4, 0, 0.75, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(23, 1.2, 0.8, 0.8);   // elevation and windage turrets
    ctx.fillStyle = 'rgba(120,150,190,0.55)'; ctx.fillRect(25.4, -0.95, 0.25, 1.9); ctx.fillStyle = 'rgba(255,70,60,0.5)'; ctx.fillRect(21.3, -0.95, 0.22, 1.9);   // the lenses, front tinted, the dot behind
  }
  if (A.laser || A.ir) {                                     // on the top rail, up front: LS321 (black, red window) or AN/PEQ-15 (tan, two apertures)
    const ir = A.ir, x0 = ir ? 36.6 : 38.3, len = ir ? 7.3 : 5.5, w = ir ? 2.6 : 2.4;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrPath(x0 + 0.3, -w / 2 + 0.4, len, w, 0.5); ctx.fill();
    ctx.fillStyle = ir ? across(-w / 2, w / 2, '#b8a37c', '#9a8460', '#6f5f43') : across(-w / 2, w / 2, '#46484e', '#232428', '#111214'); rrPath(x0, -w / 2, len, w, 0.5); ctx.fill();
    ctx.fillStyle = ir ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(x0 + len * 0.3, -0.5, len * 0.35, 1);   // switch panel
    if (ir) { ctx.fillStyle = '#1b1c1f'; ctx.fillRect(x0 + len - 0.5, -1.05, 0.5, 0.8); ctx.fillRect(x0 + len - 0.5, 0.3, 0.5, 0.8); }
    else { ctx.fillStyle = '#c0281e'; ctx.fillRect(x0 + len - 0.35, -0.6, 0.35, 1.2); }
  }
}

/* Camouflage as a repeating pattern (48 units square, wraps seamlessly), used for shirts, trousers and helmet covers.
   blobs: [colour, count, size]. Organic blotches (OCP-style) or blocky clusters (digital). */
function makeCamo(base, blobs, digital, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'), N = 48;
  let st = seed; const rn = () => (st = (st * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (const [col, n, size] of blobs) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = rn() * N, y = rn() * N;
      if (digital) {                                         // clusters of little squares
        const cells = [];
        for (let q = 0; q < 7; q++) cells.push([Math.floor((x + (rn() - 0.5) * size * 2) / 2) * 2, Math.floor((y + (rn() - 0.5) * size) / 2) * 2]);
        for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]]) for (const [px, py] of cells) g.fillRect(px + ox, py + oy, 2, 2);
      } else {                                               // soft-edged blotches, wider than tall
        const k = 8, pts = [];
        for (let q = 0; q < k; q++) { const a = q / k * Math.PI * 2, rr = size * (0.55 + rn() * 0.6); pts.push([Math.cos(a) * rr * 1.4, Math.sin(a) * rr]); }
        for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]]) {
          g.beginPath(); pts.forEach(([px, py], q) => q ? g.lineTo(x + ox + px, y + oy + py) : g.moveTo(x + ox + px, y + oy + py)); g.closePath(); g.fill();
        }
      }
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let q = 0; q < N; q += 2) g.fillRect(0, q, N, 1);   // a faint fabric weave
  return ctx.createPattern(c, 'repeat');
}
/* Subdued flag patches: US flag in OCP tones; Iranian tricolour, muted. */
function drawFlag(kind, x, y, w, h) {
  if (kind === 'us') {
    ctx.fillStyle = '#9d9274'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#6a5f47'; for (let q = 0; q < 7; q += 2) ctx.fillRect(x, y + q * h / 7, w, h / 7);
    ctx.fillStyle = '#4d4534'; ctx.fillRect(x, y, w * 0.45, h * 0.55);
  } else {
    ctx.fillStyle = '#466a3e'; ctx.fillRect(x, y, w, h / 3);
    ctx.fillStyle = '#c9c4b2'; ctx.fillRect(x, y + h / 3, w, h / 3);
    ctx.fillStyle = '#8c3a30'; ctx.fillRect(x, y + h * 2 / 3, w, h / 3);
    ctx.fillStyle = '#8c3a30'; ctx.fillRect(x + w * 0.42, y + h * 0.42, w * 0.16, h * 0.16);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.3; ctx.strokeRect(x, y, w, h);
}
/* OCP (Scorpion W2), the US Army's pattern. Its seven official shades (MIL-DTL-44436B: Cream 524 ground, Tan 525, Pale Green
   526, Olive 527, Dark Green 528, Brown 529, Dark Brown 530), measured off a US Army photo of the uniform (public domain,
   army.mil, 2015). Built like the real thing: soft brushed shapes of tan and brown over the cream, small greens among them,
   and short dark brown flecks over the top. US kit is Coyote 498 (boots, gloves, carrier, helmet) with Tan 499 webbing. */
const OCP_C = { cream: '#b8a888', tan: '#9c8a6a', pale: '#a8a68e', olive: '#6d6f56', dkgreen: '#3f4032', brown: '#6e5d47', dkbrown: '#44382c' };
const COYOTE = '#796852', COYOTE_DK = '#5c4f3d', TAN499 = '#847a65';
function makeOCP(seed) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'), N = 48, C = OCP_C;
  let st = seed; const rn = () => (st = (st * 16807) % 2147483647) / 2147483647;
  const wrap = fn => { for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]]) fn(ox, oy); };
  g.fillStyle = C.cream; g.fillRect(0, 0, N, N);
  const blob = (col, n, size, stretch) => {                       // soft, ragged, brushed shapes, wider than tall
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = rn() * N, y = rn() * N, k = 10 + Math.floor(rn() * 5), pts = [];
      for (let q = 0; q < k; q++) { const a = q / k * Math.PI * 2, rr = size * (0.4 + rn() * 0.85); pts.push([Math.cos(a) * rr * stretch, Math.sin(a) * rr]); }
      wrap((ox, oy) => { g.beginPath(); pts.forEach(([px, py], q) => q ? g.lineTo(x + ox + px, y + oy + py) : g.moveTo(x + ox + px, y + oy + py)); g.closePath(); g.fill(); });
    }
  };
  blob(C.tan, 9, 5.6, 1.5); blob(C.pale, 5, 3, 1.3); blob(C.brown, 8, 4.2, 1.6); blob(C.olive, 6, 2.8, 1.3); blob(C.dkgreen, 5, 1.8, 1.25);
  g.strokeStyle = C.dkbrown; g.lineCap = 'round';                  // dark brown flecks, short broken strokes
  for (let i = 0; i < 18; i++) {
    const x = rn() * N, y = rn() * N, L = 1.4 + rn() * 3, a = (rn() - 0.5) * 1.1, w = 0.7 + rn() * 0.8;
    g.lineWidth = w; wrap((ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); g.stroke(); });
  }
  g.fillStyle = 'rgba(0,0,0,0.05)'; for (let q = 0; q < N; q += 2) g.fillRect(0, q, N, 1);   // a faint ripstop weave
  return ctx.createPattern(c, 'repeat');
}
const OCP = makeOCP(1337);
/* Iran (from Camopedia's survey of Iranian camouflage): the IRGC's desert digital (2009), three browns in pixel clusters on a
   mustard-tan ground, much like MARPAT; and the regular Army's arid DPM, soft blotches on khaki. */
const IR_DIGI = makeCamo('#b29d68', [['#94784d', 10, 4], ['#6f5a3b', 9, 3.5], ['#4b3a27', 7, 2.5]], true, 4242);
const IR_DPM = makeCamo('#c0aa7e', [['#9b7a4d', 9, 5], ['#6c6844', 7, 4], ['#4a3826', 6, 2.5]], false, 777);
// US Army: OCP uniform, Coyote 498 carrier, boots, gloves and helmet, ACH with NVG mount; a stock wood-furniture AK-47
const PLAYER_LOOK = {
  rim: '#2f3324', shirt: OCP, shirtDark: '#6b5f48', pants: OCP, boot: COYOTE, bootDark: COYOTE_DK,
  carrier: COYOTE, carrierDark: COYOTE_DK, plate: '#8f8877', helmet: COYOTE, helmetCover: OCP, helmetDark: COYOTE_DK, flag: 'us', nvg: true,
  hair: '#4a3626', hairHi: '#6a5038', skin: '#d6b18c', glove: COYOTE, webbing: TAN499,
  flagSide: 1, unitPatch: '#4a4434', elbowPad: '#6f6046', tq: true, band: true, canteen: false, headset: true, hydro: true,   // US: flag right sleeve, unit patch left, elbow pads, tourniquet, cat-eye band + strobe
  wood: '#5e3a22', woodDark: '#3b2314', woodLight: '#7d5132', steel: '#3d4046', steelDark: '#24262a', mag: '#2e2f33', ak47: true   // a stock AK-47: milled receiver, wood furniture, muzzle nut
};
// Iranian (IRGC): desert digital camo, a khaki chest rig, an olive-tan helmet, black boots, wood-furniture AKM
const ALLY_LOOK = Object.assign({}, PLAYER_LOOK);           // your teammate: same unit, same kit
const BOT_LOOK = {
  rim: '#2a2219', shirt: IR_DIGI, shirtDark: '#7a6a48', pants: IR_DIGI, boot: '#1d1b18', bootDark: '#121110',
  carrier: '#8c7d58', carrierDark: '#665a3f', plate: '#76776a', helmet: '#7d7454', helmetCover: null, helmetDark: '#57503a', flag: 'ir', nvg: false,
  hair: '#1f1a16', hairHi: '#3a2f26', skin: '#b98d6a', glove: '#2b2a24',
  flagSide: -1, unitPatch: null, elbowPad: null, tq: false, band: false, canteen: true,   // Iranian: flag left sleeve, canteen on the hip
  wood: '#6a4122', woodDark: '#432612', woodLight: '#82552f', steel: '#34363c', steelDark: '#1e1f24', mag: '#2a2622'
};
/* Each enemy his own man (rolled from his seed, once, the first time he's drawn): skin, a beard or stubble, a shemagh
   round some necks, bare hands or rolled sleeves on others, a digital-camo cover on some helmets, and rifles in plain or
   laminated wood or black polymer. Kit, carrier and camo stay the unit's. */
function enemyLook(b) {
  if (b.look) return b.look;
  const R = rng32(Math.floor((b.seed || 1) * 7919) + 13), pk = a => a[Math.floor(R() * a.length)];
  const skin = pk(['#b98d6a', '#a87a55', '#c99a74', '#8d5d3b', '#d4a785']), bare = R() < 0.25;
  const wood = R() < 0.22 ? { wood: '#2b2c30', woodDark: '#1b1c1f', woodLight: '#36383d' } : R() < 0.5 ? { wood: '#7a3f2a', woodDark: '#4e2618', woodLight: '#93553a' } : {};
  return (b.look = Object.assign({}, BOT_LOOK, wood, { skin, hair: pk(['#1f1a16', '#2a2119', '#3b2a1c', '#141210']), hairHi: '#4a3c30',
    beard: R() < 0.6 ? (R() < 0.5 ? 'full' : 'stubble') : null, scarf: R() < 0.35 ? pk(['#c9c4b2', '#6a6450', '#2b2a26', '#8a7a5a']) : null,
    glove: bare ? skin : pk([BOT_LOOK.glove, '#3a3a30', '#1e1d1a']), rolled: !bare && R() < 0.3, ...(() => {   // IRGC desert digital, or the Army's arid DPM
      const camo = R() < 0.7 ? IR_DIGI : IR_DPM;
      return { shirt: camo, pants: camo, shirtDark: camo === IR_DPM ? '#86724e' : '#7a6a48', helmetCover: R() < 0.4 ? camo : null };
    })(), carrier: pk(['#8c7d58', '#7a7050', '#5e5c40']), carrierDark: '#5a5038' }));
}
const NO_POSE = { reload: -1, crouch: 0, reach: null, t: 0, phase: 0, walk: 0, mvRel: 0, rx: 0, sh: 1, lean: 0, flash: false, doorHand: null, mountHand: null, prot: null, peekL: null, peekW: null, peekK: 0 };

/* AK muzzle flash, different every shot: a glow, ragged flame petals out of the bore, jets from the slant brake's
   ports to the right, and a white-hot core. Drawn in the rifle's frame at the muzzle (x0). */
function drawMuzzleFlash(x0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const len = 10 + Math.random() * 10;
  const gl = ctx.createRadialGradient(x0 + 5, 0, 0, x0 + 5, 0, len * 1.3);
  gl.addColorStop(0, 'rgba(255,190,110,0.5)'); gl.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x0 + 5, 0, len * 1.3, 0, Math.PI * 2); ctx.fill();
  const petal = (a, l, w, c0) => {
    ctx.save(); ctx.translate(x0, 0); ctx.rotate(a);
    const fg = ctx.createLinearGradient(0, 0, l, 0); fg.addColorStop(0, c0); fg.addColorStop(0.5, 'rgba(255,170,60,0.6)'); fg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(0, -w); ctx.quadraticCurveTo(l * 0.45, -w * 1.5, l, (Math.random() - 0.5) * w); ctx.quadraticCurveTo(l * 0.45, w * 1.5, 0, w); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) petal((Math.random() - 0.5) * 0.6, len * (0.55 + Math.random() * 0.5), 1.4 + Math.random() * 1.6, 'rgba(255,245,200,0.95)');
  for (let i = 0; i < 2; i++) petal(1.0 + Math.random() * 0.35, 4 + Math.random() * 5, 1 + Math.random(), 'rgba(255,230,170,0.85)');   // brake ports
  if (Math.random() < 0.5) petal(-1.1 - Math.random() * 0.3, 3 + Math.random() * 3, 0.8, 'rgba(255,220,160,0.6)');
  ctx.fillStyle = 'rgba(255,255,235,0.95)'; ctx.beginPath(); ctx.ellipse(x0 + 1.5, 0, 3 + Math.random(), 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/* One key light for all characters, fixed in the world (toward the light, from the north-west), so shading stays put as
   people turn. charKey is it in the body's frame, set by drawChar. */
const KEY = { x: -0.55, y: -0.83 }, charKey = { x: 0, y: 0 };
/* You're drawn above the darkness, so you'd always look fully lit. Instead you're rendered into a small canvas, then
   darkened by how dark your spot is (the same light map maths: ambient, your eyes, every light that reaches you) and
   tinted by the lights' colours, and laid on top. */
let charCv = null, charG = null;
function lightAt(x, y) {
  let keep = (hasLight(p) ? 0.4 : 1 - SEE.darkK) * (outLit(x, y) ? 1 - DAY.out : 1), r = 0, g = 0, b = 0, w = 0;
  for (const L of frameLights) {
    const d = Math.hypot(x - L.x, y - L.y);
    if (d >= L.r || !inPoly(x, y, L.poly)) continue;
    const u = d / L.r, a = u < 0.5 ? L.k * (1 - 0.9 * u) : L.k * 0.55 * (1 - (u - 0.5) / 0.5);
    keep *= 1 - a; r += L.col[0] * a; g += L.col[1] * a; b += L.col[2] * a; w += a;
  }
  return { dark: LIGHT.ambient * keep, col: w ? [r / w | 0, g / w | 0, b / w | 0] : null, tint: Math.min(0.22, w * 0.18) };
}
function drawCharLit(x, y, bodyAng, gunAng, L, pose, flash) {
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), N = Math.ceil(140 * sc);   // rifle + flash reach ~65 px from the centre
  if (!charCv) { charCv = document.createElement('canvas'); charG = charCv.getContext('2d'); }
  if (charCv.width < N) charCv.width = charCv.height = N;
  charG.setTransform(1, 0, 0, 1, 0, 0); charG.globalCompositeOperation = 'source-over'; charG.clearRect(0, 0, N, N);
  const px = m.a * x + m.c * y, py = m.b * x + m.d * y;
  charG.setTransform(m.a, m.b, m.c, m.d, N / 2 - px, N / 2 - py);
  const keep = ctx; ctx = charG; try { drawChar(x, y, bodyAng, gunAng, L, pose); } finally { ctx = keep; }
  const li = lightAt(x, y), dark = li.dark * (flash ? 0.3 : 1);
  charG.setTransform(1, 0, 0, 1, 0, 0); charG.globalCompositeOperation = 'source-atop';
  if (li.col && li.tint > 0.01) { charG.fillStyle = 'rgba(' + li.col.join(',') + ',' + li.tint.toFixed(3) + ')'; charG.fillRect(0, 0, N, N); }
  if (dark > 0.01) { charG.fillStyle = 'rgba(2,3,8,' + dark.toFixed(3) + ')'; charG.fillRect(0, 0, N, N); }
  charG.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(charCv, 0, 0, N, N, px + m.e - N / 2, py + m.f - N / 2, N, N); ctx.restore();
}
/* The soft shadow right under a body (between body and boots when leaning). Drawn on the floor in the scene pass,
   under the darkness, so it's lit like the floor around it. */
function contactShadow(x, y, cr, pkW) {
  const sR = (13 - 2 * cr) * CHAR_SCALE, sx0 = x - pkW[0] * 0.5, sy0 = y - pkW[1] * 0.5;
  const sg = ctx.createRadialGradient(sx0, sy0, 1, sx0, sy0, sR);
  sg.addColorStop(0, 'rgba(0,0,0,' + (0.32 + 0.15 * cr) + ')'); sg.addColorStop(0.6, 'rgba(0,0,0,' + (0.16 + 0.08 * cr) + ')'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx0, sy0, sR, 0, Math.PI * 2); ctx.fill();
}
/* Camo is a shared CanvasPattern, laid in whatever frame it's filled in. Pin it to the part being drawn (a limb's root
   and direction) so the print moves with the cloth instead of the limb sliding through a fixed print. */
const CAMO_SCALE = 0.6;   // the print's size on the uniform: finer reads as camo, not as stains
function pinCamo(pat, x, y, a) { if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().translate(x || 0, y || 0).rotate((a || 0) * 180 / Math.PI).scale(CAMO_SCALE)); }
const smooth01 = q => { q = clamp(q, 0, 1); return q * q * (3 - 2 * q); };
/* Something in a hand (or tucked against the body), in the character's frame: a magazine (brass showing if loaded), a helmet, a plate. */
function drawHeld(k, x, y, L) {
  ctx.save(); ctx.translate(x, y);
  if (k.startsWith('att:')) { const [, w, id] = k.split(':'); ctx.translate(2.2, 0); drawAttPart(w, id, true); ctx.restore(); return; }   // held just ahead of the fingers
  if (k === 'nods') { ctx.rotate(-0.4); ctx.translate(1.6, 0); drawNods(1); ctx.restore(); return; }        // the NVG, carried by its mount
  if (k.startsWith('nade:')) { const [, id, np] = k.split(':'); ctx.translate(2, 0); drawNade(id, 0, 0.85, np !== 'nopin'); ctx.restore(); return; }
  if (k === 'ring') { ctx.strokeStyle = '#c9ccc2'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(2, 0, 1, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(5, 0.4); ctx.stroke(); ctx.restore(); return; }   // the pulled pin on its ring
  if (k === 'pmag') { ctx.fillStyle = '#141517'; rrPath(-1.4, -2.6, 2.8, 5.2, 0.8); ctx.fill(); ctx.fillStyle = '#b8913c'; ctx.fillRect(-0.7, -3.1, 1.4, 0.8); ctx.restore(); return; }
  if (k === 'mag' || k === 'magOld') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrPath(-2.2, -3, 5.4, 7.6, 1.2); ctx.fill();
    ctx.fillStyle = L.mag; rrPath(-2.6, -3.6, 5.2, 7.4, 1.1); ctx.fill();
    if (k === 'mag') { ctx.fillStyle = '#b8913c'; ctx.fillRect(-1.2, -4.2, 2.4, 1.3); }
  } else if (k === 'helmet' || k === 'helmetOld') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0.8, 1, 6, 5.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(0.85, 0.85); drawHelmet(L, null);                                // the same helmet as on a head
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(-2.4, -5.4, 6, 12, 1.6); ctx.fill();
    ctx.fillStyle = L.carrier; rrPath(-3, -6, 6, 12, 1.6); ctx.fill();
    ctx.fillStyle = L.plate; rrPath(-2.2, -5.2, 4.4, 10.4, 1.2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  ctx.restore();
}
/* bodyAng: where the torso faces. gunAng: where the rifle points (the arms carry the difference).
   pose: reload 0..1, crouch, reach, phase/walk/mvRel (stride), rx (recoil slide), sh (rifle shoulder), lean,
   flash, doorHand / mountHand, prot (front plate, back plate, helmet, and where they've been hit). */
function drawChar(x, y, bodyAng, gunAng, L, pose) {
  const P = pose || NO_POSE, cr = P.crouch || 0, walk = clamp(P.walk || 0, 0, 1), ph = P.phase || 0, t = P.t || 0;
  const shv = P.sh === undefined ? 1 : P.sh, sgn = shv >= 0 ? 1 : -1, pr = P.prot;
  const ln = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const pkW = P.peekW || [0, 0], pkL = P.peekL || [0, 0], pkK = P.peekK || 0;
  ctx.save(); ctx.translate(x, y);
  // soft contact shadow: low and crouched it pulls in tight and dark; leaning out, it stays between body and boots
  const kc = Math.cos(bodyAng), ks = Math.sin(bodyAng);
  charKey.x = KEY.x * kc + KEY.y * ks; charKey.y = -KEY.x * ks + KEY.y * kc;      // the key light, in the body's own frame
  if (!P.noShadow) contactShadow(0, 0, cr, pkW);
  ctx.rotate(bodyAng);
  ctx.scale(CHAR_SCALE, CHAR_SCALE);                                              // same size crouched or standing: the pose shows it
  ctx.translate(0, P.lean || 0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const EQ = P.equip, GR = P.grab, KN = P.knife, gear = (EQ && EQ.kind !== 'mag') || (GR && GR.kind !== 'mag') || !!KN || !!(P.locker && P.locker.id !== 'mag');   // (gear at the locker too)
  const rel = angDiff(gunAng, bodyAng) + (gear ? 0.55 * sgn : 0) + (P.gunSw || 0) + CROUCH.blade * cr * sgn, rx = P.rx || 0;   // (undoes the crouch's bladed turn, so the rifle still points where the rounds go)   // gear going on: rifle hangs off to the side; up against something: swung clear
  let gunY = 4.2 * shv + (P.breath || 0);                                        // breath: a slow sway of the rifle while you stand still
  let tilt = 0, back = (gear ? 3 : 0) + (P.gunIn || 0), magIn = true;                 // ...and pulled in
  const AT = P.attach;
  if (AT && AT.w === 'ak') {                                                       // at the bench: the rifle drawn in close and canted to work on (closer still for the muzzle)
    const f = AT.f, k = f < 0.15 ? smooth01(f / 0.15) : f > 0.88 ? smooth01((1 - f) / 0.12) : 1;
    tilt = 0.22 * k * sgn; back = (AT.id === 'supp' ? 18 : 7) * k;
  }
  if (P.reload >= 0) {                                                             // cant the rifle in, strip, fetch, seat, rack
    const r = P.reload, k = r < 0.1 ? smooth01(r / 0.1) : r > 0.88 ? smooth01((1 - r) / 0.12) : 1;
    tilt = (0.45 * k + (r > 0.7 && r < 0.78 ? 0.12 * Math.sin((r - 0.7) / 0.08 * Math.PI) : 0)) * sgn; back = 5 * k; magIn = r < 0.14 || r >= 0.72;
    if (r > 0.72 && r < 0.77) gunY += 0.9 * Math.sin((r - 0.72) / 0.05 * Math.PI) * sgn;     // the new mag seats: the rifle bumps with it
    if (r > 0.86 && r < 0.92) back += 1.6 * Math.sin((r - 0.86) / 0.06 * Math.PI);          // the charging handle racked and let go: a jolt
  }
  const cr_ = Math.cos(rel), sr_ = Math.sin(rel), ct = Math.cos(tilt), st = Math.sin(tilt);
  const onGun = (gx, gy) => {
    const tx = (gx - 20) * ct - gy * st + 20, ty = (gx - 20) * st + gy * ct;
    const x1 = tx - 1 - back + rx, y1 = ty + gunY;
    return [(x1 - 4) * cr_ - y1 * sr_ + 4, (x1 - 4) * sr_ + y1 * cr_];
  };
  // support hand: a list of [time, point] keys eased between; `held` is what's in it, `parked` gear tucked against the body
  let hand = null, held = null, heldL = L, parked = null, parkAt = null, helmShow, bagEmpty = null;
  const keys = (r, ks) => {
    for (let i = 1; i < ks.length; i++) if (r < ks[i][0]) { const a = ks[i - 1][1], b = ks[i][1], q = smooth01((r - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])); return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; }
    return ks[ks.length - 1][1].slice();
  };
  const foreAt = () => P.att && P.att.grip ? onGun(39, 2.4) : onGun(37, 0);      // the support hand: on the vertical grip if there is one, else the handguard
  const fore0 = foreAt(), lift = [9, -12 * sgn], jig = a => [Math.sin(t * 23) * a, Math.cos(t * 17) * a];
  if (P.reload >= 0) {
    const r = P.reload, mp = onGun(24, 6), out = onGun(29, 17), pouch = [12, -0.3], ch = onGun(27, 4.5), rack = onGun(21, 5.5);
    hand = keys(r, [[0, fore0], [0.1, mp], [0.14, mp], [0.2, out], [0.4, pouch], [0.47, pouch], [0.65, mp], [0.74, mp], [0.82, ch], [0.87, rack], [0.91, ch], [1, fore0]]);
    if (r >= 0.4 && r < 0.47) { const j = jig(0.8); hand[0] += j[0]; hand[1] += j[1]; }   // digging the next mag out of the pouch
    held = r >= 0.14 && r < 0.2 ? 'magOld' : r >= 0.46 && r < 0.72 ? 'mag' : null;
  }
  const benchAt = AT && AT.at ? AT.at : [32, -6 * sgn];                            // the part's spot on the bench                                                  // where the parts lie on the bench, ahead and to the support side
  const workKeys = (f, off, slot, start) => off ? keys(f, [[0, start], [0.25, slot], [0.45, slot], [0.75, benchAt], [0.85, benchAt], [1, start]])
    : keys(f, [[0, start], [0.22, benchAt], [0.3, benchAt], [0.55, slot], [0.85, slot], [1, start]]);
  const workJig = (f, off, twist) => {                                             // picking it up / setting it down, clamping it on, or turning the can home
    const atSlot = off ? f >= 0.25 && f < 0.45 : f >= 0.55 && f < 0.85, atBench = off ? f >= 0.75 && f < 0.85 : f >= 0.22 && f < 0.3;
    if (atSlot && twist) { const a = t * 10; return [Math.cos(a) * 1.3, Math.sin(a) * 1.3]; }
    return atSlot ? jig(0.6) : atBench ? jig(0.4) : [0, 0];
  };
  const workHeld = (f, off) => off ? f >= 0.45 && f < 0.8 : f >= 0.26 && f < 0.6;
  if (AT && AT.w === 'ak') {
    const slot = { dot: onGun(23.4, -1.5), laser: onGun(40.5, -1.5), ir: onGun(40, -1.5), grip: onGun(39, 3.5), supp: onGun(57.5, 0) }[AT.id] || fore0;
    hand = workKeys(AT.f, AT.off, slot, fore0); const j = workJig(AT.f, AT.off, AT.id === 'supp'); hand[0] += j[0]; hand[1] += j[1];
    if (workHeld(AT.f, AT.off)) held = 'att:ak:' + AT.id;
  }
  const LK = P.locker;
  if (LK) {                                                                        // at the gear locker: into it, out with the kit, onto the helmet's mount or into a pouch
    const inside = [17, 2.5], f = LK.f;
    const tgt = { nvg: [7.4, 0.4], helmet: [3, 0.5], mag: [12, -0.3], plate: LK.side === 'back' ? [-3.5, -9] : [9, -2.5] }[LK.id] || [6, -9.5];   // the helmet's crown, the chest pouch, the front plate bag (the back one over the shoulder), the grenade pouch
    hand = LK.off ? keys(f, [[0, fore0], [0.18, tgt], [0.32, tgt], [0.6, inside], [0.7, inside], [1, fore0]])
      : keys(f, [[0, fore0], [0.24, inside], [0.32, inside], [0.66, tgt], [0.78, tgt], [1, fore0]]);
    const busyAt = LK.off ? (f >= 0.18 && f < 0.32) || (f >= 0.6 && f < 0.7) : (f >= 0.24 && f < 0.32) || (f >= 0.66 && f < 0.78);
    if (busyAt) { const j = jig(0.5); hand[0] += j[0]; hand[1] += j[1]; }
    if (LK.off ? f >= 0.32 && f < 0.62 : f >= 0.3 && f < 0.7) held = LK.id === 'nvg' ? 'nods' : LK.id === 'helmet' ? 'helmet' : LK.id === 'plate' ? 'plate' : LK.id === 'mag' ? 'mag' : 'nade:' + LK.id;
  }
  if (GR) {                                                                        // stoop, reach, close the hand on it, lift
    const r0 = P.reach || lift, rp = [Math.max(4, r0[0]), clamp(r0[1], -18, 18)], g = GR.f;   // never reach back behind you for it
    hand = g < 0.7 ? keys(g / 0.7, [[0, fore0], [1, rp]]) : keys((g - 0.7) / 0.3, [[0, rp], [1, [(rp[0] + lift[0]) / 2, (rp[1] + lift[1]) / 2]]]);
    if (g >= 0.7) { held = GR.kind; heldL = GR.L || L; }
  }
  if (EQ) {
    const f = EQ.f, nl = EQ.L || L; heldL = nl;
    if (EQ.kind === 'mag') {                                                       // into a chest pouch
      hand = keys(f, [[0, lift], [0.7, [12, -0.3]], [0.78, [12, -0.3]], [1, fore0]]); held = f < 0.72 ? 'mag' : null;
    } else if (EQ.kind === 'helmet') {                                             // new one tucked against the chest, old one off and dropped, new one on, chin strap
      const head = [2.5, 0], chest = [10, -5.5 * sgn], drop = [5, -21 * sgn], chin = [5.5, 2.6 * sgn];
      hand = keys(f, [[0, lift], [0.12, chest], [0.2, head], [0.35, drop], [0.45, chest], [0.62, head], [0.68, chin], [1, chin]]);
      if (f >= 0.68) { const j = jig(0.7); hand[0] += j[0]; hand[1] += j[1]; }
      if (f < 0.12 || (f >= 0.45 && f < 0.62)) held = 'helmet';
      else if (f >= 0.2 && f < 0.35 && EQ.hadOld) { held = 'helmetOld'; heldL = L; }
      if (f >= 0.12 && f < 0.45) { parked = 'helmet'; parkAt = chest; }
      if (f >= 0.2 && f < 0.62) helmShow = false; else if (f >= 0.62) helmShow = true;
    } else {                                                                       // plate: new one under the arm, open the bag, slide the old out and drop it, slide the new in, close the flap
      const cx = EQ.side === 'front' ? 8 : -8, edge = [cx, -11 * sgn], out = [cx + (EQ.side === 'front' ? 5 : -3), -22 * sgn], tuck = [1, -14.5 * sgn];
      hand = keys(f, [[0, lift], [0.12, tuck], [0.18, edge], [0.4, out], [0.47, tuck], [0.6, out], [0.75, edge], [1, edge]]);
      if (f >= 0.75) { const j = jig(0.9); hand[0] += j[0]; hand[1] += j[1]; }
      if (f < 0.12 || (f >= 0.47 && f < 0.75)) held = 'plate';
      else if (f >= 0.2 && f < 0.4 && EQ.hadOld) { held = 'plateOld'; heldL = L; }
      if (f >= 0.12 && f < 0.47) { parked = 'plate'; parkAt = tuck; }
      if (f >= 0.18 && f < 0.75) bagEmpty = EQ.side;
    }
  }

  // legs: hip -> knee -> boot. Standing, the stride carries them past the body. Crouched, they kneel on the rifle-side
  // knee (that boot dug in behind, sole up) with the other knee forward, knee pads showing. Peeking, the boots stay
  // planted where the lean started and the legs angle out to the body.
  // stride sized so a planted boot stays put: the phase advances per STEP_LEN * walk of travel (see the stride update),
  // so a half cycle carries each boot 2 * sw = STEP_LEN * walk px. Moving while crouched, the legs come up into a duck-walk.
  const crL = cr * (1 - clamp(walk * 1.6, 0, 1));
  const sw = Math.sin(ph) * (STEP_LEN / (2 * CHAR_SCALE)) * walk, mc = Math.cos(P.mvRel || 0), ms = Math.sin(P.mvRel || 0);
  const mix = (a, b) => a + (b - a) * crL, fo0 = -pkL[0], fo1 = -pkL[1];
  for (const side of [-1, 1]) {
    const trail = side === sgn;
    const sfx = -2 + side * sw * mc, sfy = side * 5.2 + side * sw * ms;
    const H = [-1 + fo0 * 0.45, side * (4.4 - 0.6 * crL) + fo1 * 0.45];
    const F = P.sit ? [15.5, side * (6.5 + (side > 0 ? 1.2 : 0))] : [mix(sfx, trail ? -19 : 8.5) + fo0, mix(sfy, side * (trail ? 7.5 : 12.5)) + fo1];   // sitting: thighs forward along the seat, boots on the floor in front
    const K = P.sit ? [10, side * 5.6] : [mix((sfx - 2.5) / 2, trail ? -2 : 12) + fo0 * 0.75, mix((sfy + side * 4.4) / 2, side * (trail ? 9.5 : 14)) + fo1 * 0.75];   // kneeling: back knee down with the shin trailing behind, front knee splayed out past the arm
    ctx.save(); ctx.translate(F[0], F[1]);
    if (trail && crL > 0.5) {                                                       // toe dug in, sole and heel up
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; rrPath(-5.2, -3.3, 10, 6.6, 3); ctx.fill();
      ctx.fillStyle = L.boot; rrPath(-4.4, -2.5, 8.4, 5, 2.4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.6; for (const q of [-2.8, -0.9, 1]) ln(q, -1.8, q, 1.8);   // tread
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(-4.4, -2.1, 2.2, 4.2, 1); ctx.fill();                                        // heel
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; rrPath(-5.6, -3.4, 11.4, 6.8, 3.2); ctx.fill();
      ctx.fillStyle = L.boot; rrPath(-4.8, -2.6, 9.8, 5.2, 2.6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; rrPath(0.6, -1.7, 3.6, 3.4, 1.4); ctx.fill();      // toe cap
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ln(-3, -1.4, -3, 1.4); ln(-1.6, -1.4, -1.6, 1.4);   // laces
    }
    ctx.restore();
    const kl = Math.hypot(K[0] - F[0], K[1] - F[1]) || 1;
    pinCamo(L.pants, H[0], H[1], Math.atan2(K[1] - H[1], K[0] - H[0]));        // the print rides on the thigh
    ctx.strokeStyle = L.pants; ctx.lineWidth = 5.4;
    ctx.beginPath(); ctx.moveTo(H[0], H[1]); ctx.lineTo(K[0], K[1]); ctx.lineTo(F[0] + (K[0] - F[0]) / kl * 2.5, F[1] + (K[1] - F[1]) / kl * 2.5); ctx.stroke();
    if (crL > 0.05) {                                                               // knee pad
      ctx.globalAlpha = Math.min(1, crL * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(K[0], K[1], 3.7, 3.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.carrierDark; ctx.beginPath(); ctx.ellipse(K[0], K[1], 3.1, 2.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.ellipse(K[0] + 0.7, K[1] - 0.6, 1.4, 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.translate(CROUCH.hunch * cr, 0); ctx.rotate(-CROUCH.blade * cr * sgn);       // crouched: upper body hunches forward over the knees, bladed toward the rifle side

  // torso: combat shirt, then the plate carrier (cummerbund, shoulder straps, front and back plate bags)
  const tw = Math.sin(ph) * 0.08 * walk, breath = 1 + Math.sin(t * 1.9) * 0.014 * (1 - walk);
  ctx.save(); ctx.rotate(tw); ctx.scale(1, breath * (1 - 0.06 * pkK - CROUCH.round * cr));   // rolled into a lean / hunched: shoulders round in
  ctx.fillStyle = L.rim; ctx.beginPath(); ctx.ellipse(0, 0, 8.3, 15.5, 0, 0, Math.PI * 2); ctx.fill();
  pinCamo(L.shirt);
  ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 7.4, 14.6, 0, 0, Math.PI * 2); ctx.fill();
  const shg = ctx.createLinearGradient(charKey.x * 15, charKey.y * 15, -charKey.x * 15, -charKey.y * 15);   // lit toward the key light, shaded away
  shg.addColorStop(0, 'rgba(255,250,240,0.16)'); shg.addColorStop(0.5, 'rgba(0,0,0,0.04)'); shg.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = shg; ctx.fill();
  ctx.fillStyle = L.carrierDark; rrPath(-6, -13.2, 12, 3, 1.4); ctx.fill(); rrPath(-6, 10.2, 12, 3, 1.4); ctx.fill();   // cummerbund
  ctx.fillStyle = L.carrier; rrPath(-9.6, -8.6, 19.2, 2.6, 1); ctx.fill(); rrPath(-9.6, 6, 19.2, 2.6, 1); ctx.fill();   // shoulder straps
  // plate bags sit on the outside of the chest and back (clear of the head, so you can read them from above)
  const plate = (x0, f, chips, bare) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrPath(x0 - 0.5, -10.6, 5.8, 21.2, 2.2); ctx.fill();
    ctx.fillStyle = L.carrier; rrPath(x0, -10.1, 4.8, 20.2, 1.8); ctx.fill();
    if (f > 0) {
      ctx.fillStyle = L.plate; rrPath(x0 + 0.7, -9.3, 3.4, 18.6, 1.3); ctx.fill();             // the plate inside
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5; ctx.stroke();
      if (chips) for (const c of chips) {                                                          // chunks knocked out, cracks
        const cy = c.y * 8, dx = x0 + 0.7 + c.d * 0.5;
        ctx.fillStyle = 'rgba(10,10,8,0.9)';
        ctx.beginPath(); ctx.moveTo(dx, cy - 1.8); ctx.lineTo(dx + 2, cy); ctx.lineTo(dx, cy + 1.8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,18,14,0.85)'; ctx.lineWidth = 0.5; ln(x0 + 2.4, cy, x0 + 2.4 + c.cx * 0.4, cy + c.cy);
      }
    } else if (bare) {                                                                             // left at home: a flat, empty bag
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrPath(x0 + 0.9, -9.1, 3, 18.2, 1.2); ctx.fill();
    } else {                                                                                       // shot away: an empty, torn bag
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; rrPath(x0 + 0.7, -9.3, 3.4, 18.6, 1.3); ctx.fill();
      ctx.strokeStyle = L.carrierDark; ctx.lineWidth = 0.6;
      for (let q = -8; q <= 8; q += 3) ln(x0 + 0.8, q, x0 + 4, q + 1.3);
    }
  };
  plate(-10.4, bagEmpty === 'back' ? 0 : pr ? pr.back / PLATE_HP : 1, pr && pr.chipsB, pr && pr.bareB);
  plate(5.6, bagEmpty === 'front' ? 0 : pr ? pr.front / PLATE_HP : 1, pr && pr.chipsF, pr && pr.bareF);
  ctx.strokeStyle = L.carrierDark; ctx.lineWidth = 0.55;                                               // MOLLE webbing showing at the bag edges
  for (const bx of [-10.4, 5.6]) for (let q = -8.5; q <= 8.5; q += 2.4) { ln(bx + 0.1, q, bx + 0.7, q); ln(bx + 4.1, q, bx + 4.7, q); }
  for (const my of [-6.6, -2.2, 2.2]) {                                                                 // triple rifle-mag pouch on the chest, mag tops showing
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(10.2, my - 0.2, 3.4, 4.2, 0.8); ctx.fill();
    ctx.fillStyle = L.carrier; rrPath(10.2, my, 3, 3.8, 0.8); ctx.fill();
    ctx.fillStyle = L.mag; ctx.fillRect(11.2, my + 0.6, 1.3, 2.6);
    ctx.strokeStyle = L.carrierDark; ctx.lineWidth = 0.4; ln(10.4, my + 3.4, 13, my + 3.4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(10.2, 2.6 + 2.6, 2.8, 3.2, 0.8); ctx.fill();               // admin / medical pouch
  ctx.fillStyle = L.carrierDark; rrPath(10.2, 2.6 + 2.4, 2.6, 3, 0.8); ctx.fill();
  ctx.fillStyle = L.carrier; rrPath(-13.4, 4.6, 3.2, 4.2, 0.8); ctx.fill();                           // radio pouch on the back
  ctx.strokeStyle = L.carrierDark; ctx.lineWidth = 0.4; ctx.strokeRect(-13.4, 4.6, 3.2, 4.2);
  ctx.fillStyle = L.carrierDark;
  for (const py of [-13.6, 11]) for (const px of [-3, 0.6]) { rrPath(px, py, 3, 2.6, 0.7); ctx.fill(); }   // mag pouches on the cummerbund
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (const py of [-13.6, 11]) for (const px of [-3, 0.6]) ctx.fillRect(px, py, 3, 0.7);
  ctx.fillStyle = L.carrierDark; rrPath(-11.6, -1.6, 1.6, 3.2, 0.6); ctx.fill();                       // drag handle on the back
  ctx.strokeStyle = '#111'; ctx.lineWidth = 0.7; ln(-9.6, 6.6, -13.6, 9.2);                                // radio antenna
  drawFlag(L.flag, -9.6, -7.6, 3.2, 2.2);                                                               // flag patch on the back plate bag
  if (L.tq) {                                                                                           // tourniquet on the front shoulder strap
    ctx.fillStyle = '#1c1c1e'; rrPath(1.6, -9.3, 3.8, 3.8, 0.8); ctx.fill(); ctx.fillStyle = '#b8302a'; ctx.fillRect(4.6, -8.2, 1.2, 1.6);
  }
  if (L.hydro) {                                                                                        // US: hydration tube over the shoulder to a bite valve, chem lights on the strap, IFAK on the back
    ctx.strokeStyle = '#2e2b22'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-10.5, 7.6); ctx.quadraticCurveTo(-1, 10.4, 8.8, 6.6); ctx.stroke();
    ctx.fillStyle = '#1b1a16'; ctx.beginPath(); ctx.arc(9.2, 6.4, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(130,210,110,0.75)'; ctx.fillRect(-3.4, -8.3, 2.6, 0.7); ctx.fillStyle = 'rgba(205,205,195,0.6)'; ctx.fillRect(-3.4, -7.4, 2.6, 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrPath(-13.6, -7.6, 3.4, 4.6, 0.8); ctx.fill();
    ctx.fillStyle = L.carrier; rrPath(-13.4, -7.8, 3.2, 4.4, 0.8); ctx.fill(); ctx.fillStyle = '#8a2a24'; ctx.fillRect(-13.9, -6.4, 0.8, 1.6);
  }
  if (P.nades && P.nades.max) {                                                                         // grenade pouches on the left side: M84s up front, Mk3A2s further back; the fuze shows while one's in
    const at = { m84: [[7.4, -11.2], [4.6, -12.6]], mk3: [[-6.4, -13.1], [-9, -11.4]] };
    for (const id of ['m84', 'mk3']) for (let q = 0; q < P.nades.max[id]; q++) {
      const [x0, y0] = at[id][q]; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x0 + 0.3, y0 + 0.3, 1.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.carrierDark; ctx.beginPath(); ctx.arc(x0, y0, 1.6, 0, Math.PI * 2); ctx.fill();
      if (q < (P.nades[id] || 0)) { ctx.fillStyle = id === 'm84' ? '#6a6f60' : '#55585a'; ctx.beginPath(); ctx.arc(x0, y0, 0.85, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#b9bcb2'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(x0 + 0.6, y0 - 0.5, 0.55, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x0, y0, 0.9, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  if (L.canteen) {                                                                                      // canteen pouch on the left hip
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(-4.4, -14.6, 3, 2.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.carrierDark; ctx.beginPath(); ctx.ellipse(-4.6, -14.9, 2.7, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26281b'; ctx.fillRect(-5.1, -13.3, 1, 0.8);
  }
  if (pkK > 0.05) {                                                                // leaning: the dipped shoulder falls into shade
    const sd = pkL[1] >= 0 ? 1 : -1, lg = ctx.createLinearGradient(0, -15 * sd, 0, 15 * sd);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.45, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,' + (0.38 * pkK) + ')');
    ctx.fillStyle = lg; rrPath(-11.6, -15.6, 23.2, 31.2, 8); ctx.fill();
  }
  ctx.restore();
  const shH = 10 - 1.2 * cr;                                                       // hunched shoulders sit a little narrower
  const shR = [Math.sin(-tw) * shH, Math.cos(tw) * shH], shL = [-Math.sin(-tw) * shH, -Math.cos(tw) * shH];

  // the sidearm: how far the rifle is slung (sl), how far the Glock is up (ge), where the hands go
  const SD = P.side;
  let slung = 0, ge = 0, inHolster = true;
  if (SD) {
    const f = SD.sw ? SD.sw.f : 0;
    if (SD.sw && SD.sw.to === 'pistol') { slung = smooth01(f / 0.5); ge = f < 0.5 ? 0 : smooth01((f - 0.5) / 0.5); inHolster = f < 0.5; }
    else if (SD.sw) { slung = f < 0.5 ? 1 : 1 - smooth01((f - 0.5) / 0.5); ge = f < 0.5 ? 1 - smooth01(f / 0.5) : 0; inHolster = f >= 0.5; }
    else if (SD.out) { slung = 1; ge = 1; inHolster = false; }
    drawHolster(L, 1, SD.hol || 0, SD.bob || 0, inHolster);   // always on the right hip
  }
  if (P.relax) slung = 1;                                                          // off duty: the rifle on its sling at the side
  const NZ = P.nade;                                                               // a grenade in hand: the rifle drops onto its sling for it
  if (NZ) slung = Math.max(slung, NZ.ph === 'draw' ? smooth01(Math.min(1, NZ.f / 0.5)) : NZ.ph === 'stow' ? 1 - smooth01(Math.max(0, (NZ.f - 0.35) / 0.65)) : 1);
  // sling from the stock to the carrier, then the rifle (slung at the side while the Glock is out)
  const sl = onGun(3, -2.6 * sgn);
  if (P.att && P.att.sling && P.slingSt) {                                         // VCAS: a padded strap from the stock round the back, over the support shoulder, its slack down to the front swivel
    const R = rel + (1.95 * sgn - rel) * slung, Sx = 1 - 0.38 * slung, cR = Math.cos(R), sR = Math.sin(R);
    const rifleAt = (gx, gy) => { const tx = (gx - 20) * ct - gy * st + 20, ty = (gx - 20) * st + gy * ct, x1 = (tx - 1 - back + rx - 4) * Sx, y1 = ty + gunY; return [x1 * cR - y1 * sR + 4, x1 * sR + y1 * cR]; };
    drawVcas(P.slingSt, x, y, bodyAng, P.lean || 0, rifleAt(3, -2.6 * sgn), [-5, -7 * sgn], [-1.5, -10.5 * sgn], rifleAt(43, -2.2 * sgn), sgn, t);
  } else { ctx.strokeStyle = L.webbing || L.carrierDark; ctx.lineWidth = 0.9; ln(sl[0], sl[1], -5, -7 * sgn); }
  ctx.save();
  ctx.translate(4, 0); ctx.rotate(rel + (1.95 * sgn - rel) * slung); ctx.scale(1 - 0.38 * slung, 1); ctx.translate(-4, 0);
  ctx.translate(-1 - back + rx, gunY); ctx.translate(20, 0); ctx.rotate(tilt); ctx.translate(-20, 0);
  ctx.scale(1, 1 - 0.22 * pkK);                                                    // canted over in a lean
  drawRifle(L, magIn, P.att);
  if (P.flash && slung < 0.5 && !(P.att && P.att.supp)) drawMuzzleFlash(55);   // the can swallows the flash
  ctx.restore();

  // arms: shirt sleeves with an elbow, gloved hands
  const arm = (sx, sy, hx, hy, bend, holding, seg, knife, hold) => {   // hold: how the support hand takes the rifle (holdStyle)
    let [ex, ey, hx2, hy2] = armIK(sx, sy, hx, hy, seg, bend);
    if (hold && hold.elbow) { const k = hold.elbow; ex += ((sx + hx2) / 2 - ex) * k; ey += ((sy + hy2) / 2 - ey) * k; }   // elbow tucked down under the gun: seen from above it sits nearer the line
    if (knife) { ctx.save(); ctx.translate(hx2, hy2); ctx.rotate(knife.ang); if (knife.glock) drawGlock(knife.flash, P.attG); else drawKnife(knife.bloody); ctx.restore(); }
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx2, hy2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5.8; ctx.stroke();
    pinCamo(L.shirt, sx, sy, Math.atan2(ey - sy, ex - sx));                      // the print rides on the upper arm
    ctx.strokeStyle = L.shirt; ctx.lineWidth = 3.9; ctx.stroke();
    ctx.strokeStyle = L.shirtDark; ctx.lineWidth = 1.2; ln(ex, ey, hx2, hy2);
    ctx.strokeStyle = 'rgba(255,250,235,0.14)'; ctx.lineWidth = 1.1;                 // the sleeve's lit edge
    ctx.beginPath(); ctx.moveTo(sx + charKey.x * 1.3, sy + charKey.y * 1.3); ctx.lineTo(ex + charKey.x * 1.3, ey + charKey.y * 1.3); ctx.lineTo(hx2 + charKey.x * 1.1, hy2 + charKey.y * 1.1); ctx.stroke();
    if (L.elbowPad) { ctx.fillStyle = L.elbowPad; ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.stroke(); }   // elbow pad
    else { ctx.fillStyle = L.shirtDark; ctx.beginPath(); ctx.arc(ex, ey, 2.1, 0, Math.PI * 2); ctx.fill(); }   // elbow
    if (L.rolled) {                                                                // sleeves rolled up: bare forearms, the roll at the elbow
      const rx0 = ex + (hx2 - ex) * 0.22, ry0 = ey + (hy2 - ey) * 0.22;
      ctx.strokeStyle = L.skin; ctx.lineWidth = 3; ln(rx0, ry0, hx2, hy2);
      ctx.fillStyle = L.shirtDark; ctx.beginPath(); ctx.arc(rx0, ry0, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    if (holding) drawHeld(holding, hx2, hy2, heldL);
    if (hold) { drawHold(hold, hx2, hy2); return; }
    ctx.beginPath(); ctx.arc(hx2, hy2, 2.8, 0, Math.PI * 2); ctx.fillStyle = L.glove; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(hx2 - 0.8, hy2 - 0.8, 1, 0, Math.PI * 2); ctx.fill();
  };
  const drawHold = (hold, hx, hy) => {                 // the support hand on the rifle, drawn by how it holds it
    const g0 = onGun(0, 0), g1 = onGun(10, 0), ga = Math.atan2(g1[1] - g0[1], g1[0] - g0[0]), side = -sgn;   // the gun's axis; the hand comes from the support side
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ga); ctx.fillStyle = L.glove; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    if (hold.kind === 'vgrip') {                     // a fist round the vertical grip: knuckles across the bore, the thumb over the top
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-1.7, -3.1, 3.6, 6.2, 1.5); else ctx.rect(-1.7, -3.1, 3.6, 6.2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.7; ln(1.3, -2.6, 1.3, 2.6);   // the knuckle ridge across the bore
      ctx.lineWidth = 0.45; for (const y of [-1.3, 0, 1.3]) ln(0.2, y, 1.3, y);           // the fingers between
      ctx.fillStyle = L.glove; ctx.beginPath(); ctx.ellipse(-0.6, -2.6 * side, 1.9, 0.9, 0.3 * side, 0, Math.PI * 2); ctx.fill();   // thumb wrapped over
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-1.2, -2.4, 2.4, 1);
    } else {                                         // cupping the handguard: palm under it, fingers wrapped over the far side, the hand laid along the bore
      ctx.beginPath(); ctx.ellipse(0, 0.6 * side, 4.3, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5;
      for (const x of [-1.6, 0, 1.6]) ln(x, -1.5 * side, x + 0.3, -0.4 * side);   // fingertips over the far side
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(-0.8, 0.2 * side, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  const trigS = sgn > 0 ? shR : shL, SUP = 19.5;
  let supS = sgn > 0 ? shL : shR, supSg = -sgn;                                    // the Glock is always right-handed (see below)
  let knifeAt = null;
  if (KN) {                                                                        // draw it from the chest, thrust, hold, wrench free, sheathe
    const fore = foreAt(), sheath = [8, -5.5 * sgn], ready = [13, -8 * sgn], f = KN.f, B = MELEE.blade * 0.9;
    const tipHand = KN.tip ? (() => { const dx = KN.tip[0] - supS[0], dy = KN.tip[1] - supS[1], d = Math.hypot(dx, dy) || 1; return [KN.tip[0] - dx / d * B, KN.tip[1] - dy / d * B]; })() : ready;
    const keysK = (r, ks) => { for (let i = 1; i < ks.length; i++) if (r < ks[i][0]) { const a = ks[i - 1][1], b = ks[i][1], q = smooth01((r - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])); return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; } return ks[ks.length - 1][1].slice(); };
    let show = true, ang = 0.25 * -sgn;
    if (KN.ph === 'draw') { hand = keysK(f, [[0, fore], [0.45, sheath], [1, ready]]); show = f > 0.45; }
    else if (KN.ph === 'lunge') hand = keysK(f, [[0, ready], [1, tipHand]]);
    else if (KN.ph === 'hold') hand = tipHand;
    else if (KN.ph === 'pull') hand = keysK(f, [[0, tipHand], [1, ready]]);
    else { hand = keysK(f, [[0, ready], [0.5, sheath], [1, fore]]); show = f < 0.5; }
    if (KN.tip && (KN.ph === 'lunge' || KN.ph === 'hold')) ang = Math.atan2(KN.tip[1] - hand[1], KN.tip[0] - hand[0]);
    held = null; if (show) knifeAt = { ang, bloody: KN.bloody && KN.ph !== 'draw' };
  }
  if (parked) drawHeld(parked, parkAt[0], parkAt[1], EQ.L || L);
  // shoulder caps: the flag on its sleeve (US right, Iranian left), a subdued unit patch on the other
  pinCamo(L.shirt);
  ctx.fillStyle = L.shirt; for (const s of [shR, shL]) { ctx.beginPath(); ctx.arc(s[0], s[1], 3.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (const s of [shR, shL]) { ctx.beginPath(); ctx.arc(s[0] - 0.6, s[1], 3.4, 0.6, 2.6); ctx.fill(); }
  sleevePatches(L, shR, shL);
  const grip = onGun(20, 0.5);
  if (P.relax && !NZ) {                                                            // relaxing: hands resting on the thighs
    supS = shL; supSg = -1;
    arm(shR[0], shR[1], 8.5, 4.5, 1, false, 11.5); hand = [8.5, -4.5]; held = null;
  } else if (NZ) {                                                                 // the grenade in the right hand: out of the pouch, the pin pulled by the left, cocked back by how hard you'll throw, thrown overhand
    supS = shL; supSg = -1;
    const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const pouch = [5.5, -9.5], ready = [12, 6], cock = lerp2(ready, [-6, 15], smooth01(NZ.pow)), rl = [21, 3], fol = [13, -5], chest = [9, -5], reach = [17, -6], f = NZ.f;
    let rh, lh, inHand = true, ring = false;
    if (NZ.ph === 'draw') { rh = f < 0.45 ? lerp2(grip, pouch, smooth01(f / 0.45)) : lerp2(pouch, ready, smooth01((f - 0.45) / 0.55)); inHand = f >= 0.42; lh = lerp2(foreAt(), chest, smooth01(f)); }
    else if (NZ.ph === 'ready') { rh = ready; lh = chest; }
    else if (NZ.ph === 'wind') { rh = cock; lh = NZ.wt < 0.12 ? lerp2(chest, ready, smooth01(NZ.wt / 0.12)) : lerp2(ready, reach, smooth01((NZ.wt - 0.12) / 0.3)); ring = NZ.wt >= 0.12; }   // the left hand pulls the ring and points the way
    else if (NZ.ph === 'throw') { const r = NADE.rel; rh = f < r ? lerp2(cock, rl, smooth01(f / r)) : lerp2(rl, fol, smooth01((f - r) / (1 - r))); inHand = f < r; lh = lerp2(reach, chest, smooth01(f)); }
    else { rh = NZ.thrown ? lerp2(fol, grip, smooth01(f)) : f < 0.45 ? lerp2(ready, pouch, smooth01(f / 0.45)) : lerp2(pouch, grip, smooth01((f - 0.45) / 0.55)); inHand = !NZ.thrown && f < 0.45; lh = lerp2(chest, foreAt(), smooth01(f)); }   // back to the rifle (the grenade back in its pouch if you didn't throw it)
    arm(shR[0], shR[1], rh[0], rh[1], 1, inHand ? 'nade:' + NZ.id + (NZ.pin ? '' : ':nopin') : false, clamp(Math.hypot(rh[0] - shR[0], rh[1] - shR[1]) * 0.5 + 5, 11, 19.5));
    hand = lh; held = ring ? 'ring' : null;
  } else if (SD && (slung > 0 || ge > 0)) {                                               // the Glock: drawn from the hip, held out two-handed
    const pg = (gx, gy) => { const x1 = gx - 1 - back + rx, y1 = gy + PISTOL.lat * shv; return [(x1 - 4) * cr_ - y1 * sr_ + 4, (x1 - 4) * sr_ + y1 * cr_]; };
    // the Glock lives on the right hip whichever shoulder the rifle is on: the right hand draws and holds it, the left supports
    supS = shL; supSg = -1;
    const aimG = pg(34.5, 0), hol = [-4.5, 13.2], chest = [9, -6], rifleG = grip;
    const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    let trig, gAng, showG = ge > 0 || (SD.sw && !inHolster);
    if (SD.sw && SD.sw.to === 'pistol' && SD.sw.f < 0.5) trig = lerp2(rifleG, hol, smooth01(SD.sw.f / 0.5));          // hand off the rifle, down to the holster
    else if (SD.sw && SD.sw.to === 'rifle' && SD.sw.f >= 0.5) trig = lerp2(hol, rifleG, smooth01((SD.sw.f - 0.5) / 0.5));   // back up onto the rifle
    else trig = lerp2(hol, aimG, ge);
    gAng = (rel) * ge + (Math.PI * 0.55) * (1 - ge);                       // muzzle down at the holster, swinging up onto the target
    if (SD.rl >= 0) gAng += 0.3 * Math.sin(Math.min(1, SD.rl * 1.2) * Math.PI);   // canted in for the mag change
    const fold = (S0, h, max) => clamp(Math.hypot(h[0] - S0[0], h[1] - S0[1]) * 0.5 + 5, 11, max);   // a hand in close folds the arm, it doesn't fling the elbow out
    arm(shR[0], shR[1], trig[0], trig[1], 1, false, fold(shR, trig, 18.5), showG ? { glock: true, ang: gAng, flash: P.flash && ge > 0.9 } : null);
    if (!hand && AT && AT.w === 'glock' && ge > 0.9) {                             // at the bench: the part from the bench onto the Glock
      const gp = (gx, gy) => [trig[0] + Math.cos(gAng) * gx - Math.sin(gAng) * gy, trig[1] + Math.sin(gAng) * gx + Math.cos(gAng) * gy];
      const slot = { dot: gp(0.2, -1.4), light: gp(7.6, 1.6), laser: gp(8.4, 1.6) }[AT.id], cup = pg(34, -1.8);
      hand = workKeys(AT.f, AT.off, slot, cup); const j = workJig(AT.f, AT.off, false); hand[0] += j[0]; hand[1] += j[1];
      if (workHeld(AT.f, AT.off)) held = 'att:glock:' + AT.id;
    }
    if (!hand) {                                                                   // support hand: cups the grip, or swaps the mag
      const cup = pg(34, -1.8), well = pg(32.5, 0.2), pouch = [0, -10.5];
      if (SD.rl >= 0) { hand = keys(SD.rl, [[0, cup], [0.12, well], [0.24, lerp2(well, chest, 0.4)], [0.45, pouch], [0.55, pouch], [0.78, well], [0.86, well], [1, cup]]); held = SD.rl >= 0.5 && SD.rl < 0.8 ? 'pmag' : null; }
      else hand = ge > 0.6 ? lerp2(chest, cup, smooth01((ge - 0.6) / 0.4)) : (slung > 0.5 ? chest : null);
    }
  } else arm(trigS[0], trigS[1], grip[0], grip[1], sgn, false, 11);
  if (P.stun && !hand) { hand = [6.5, -1.6 * sgn]; held = null; }                  // stunned: a hand over the eyes
  const reachable = h => h && h[0] > 1 && Math.hypot(h[0] - supS[0], h[1] - supS[1]) < SUP * 2 - 1;   // in reach and in front: no reaching back behind the body
  if (hand) arm(supS[0], supS[1], hand[0], hand[1], supSg, held, SD && (slung > 0 || ge > 0) && !knifeAt ? clamp(Math.hypot(hand[0] - supS[0], hand[1] - supS[1]) * 0.5 + 5, 11, SUP) : SUP, knifeAt);
  else if (reachable(P.doorHand)) arm(supS[0], supS[1], P.doorHand[0], P.doorHand[1], supSg, false, SUP);
  else if (reachable(P.mountHand)) arm(supS[0], supS[1], P.mountHand[0], P.mountHand[1], supSg, false, SUP);
  else { const fore = foreAt(); arm(supS[0], supS[1], fore[0], fore[1], supSg, false, SUP, null, holdStyle(P)); }

  if (L.scarf) {                                                                   // a shemagh wound round the neck: a fringe of it shows round the helmet
    ctx.save(); ctx.translate(1 + 3.5 * cr, pkL[1] * 0.3);
    ctx.fillStyle = L.scarf; ctx.beginPath(); ctx.ellipse(0.4, 0, 8.2, 8.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let a = 0; a < 6.28; a += 0.5) { ctx.beginPath(); ctx.arc(0.4 + Math.cos(a) * 7.5, Math.sin(a) * 8.1, 0.55, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // head: helmet (shell, side rails, night-vision mount, patch) or, once it's been shot off, bare head and hair
  ctx.save(); ctx.translate(1 + 3.5 * cr, pkL[1] * 0.3); ctx.rotate(tw * 0.5);   // head ducks low over the knees, or leads the lean
  drawHead(L, helmShow !== undefined ? helmShow : !pr || pr.helmet > 0, pr && pr.chipsH);
  ctx.restore();
  ctx.restore();
}
function drawHead(L, helmetOn, chips) {
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(3.6, 0, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();   // face, peeking out front
  if (L.beard) { ctx.fillStyle = L.hair; ctx.globalAlpha = L.beard === 'stubble' ? 0.4 : 0.9; ctx.beginPath(); ctx.ellipse(4.3, 0, 1.9, 3.3, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (helmetOn) drawHelmet(L, chips);
  else {
    ctx.fillStyle = L.skin;
    ctx.beginPath(); ctx.ellipse(0, -5.6, 1.3, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 5.6, 1.3, 2, 0, 0, Math.PI * 2); ctx.fill();   // ears
    ctx.beginPath(); ctx.ellipse(-0.4, 0, 5.8, 5.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(-1.3, 0, 5.4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.hairHi; ctx.beginPath(); ctx.ellipse(-2.8, -1.8, 2.6, 1.4, -0.4, 0, Math.PI * 2); ctx.fill();
  }
}
/* The helmet seen from above (front = +x), the same wherever it shows: on a head, in a hand, tucked against the chest.
   US ACH: camo cover, rails, NVG shroud and counterweight, cat-eye band and IR strobe. Iranian: plain green shell, edge band. */
function drawHelmet(L, chips) {
  drawHelmet0(L, chips);
  if (L.headset) {                                                // US: electronic ear defenders (headset) on the rails, the PTT cable down the back
    for (const sd of [-1, 1]) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0.8, sd * 7.1, 2.6, 1.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4a4636'; ctx.beginPath(); ctx.ellipse(0.6, sd * 6.8, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-0.6, sd * 6.8 - 0.4, 2, 0.5); }
    ctx.strokeStyle = '#1c1b17'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-0.8, 7.6); ctx.quadraticCurveTo(-4, 9, -6.5, 8); ctx.stroke();
  }
}
function drawHelmet0(L, chips) {
  const ln = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  ctx.fillStyle = L.rim; ctx.beginPath(); ctx.ellipse(-0.4, 0, 7.5, 6.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.ellipse(-0.4, 0, 6.7, 6.2, 0, 0, Math.PI * 2); ctx.fill();
  if (L.helmetCover) { pinCamo(L.helmetCover); ctx.save(); ctx.globalAlpha *= 0.7; ctx.fillStyle = L.helmetCover; ctx.beginPath(); ctx.ellipse(-0.4, 0, 6.4, 5.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }   // camo cover
  const hg = ctx.createRadialGradient(-0.4 + charKey.x * 3.4, charKey.y * 3.2, 0.4, -0.4, 0, 6.8);   // specular toward the key light
  hg.addColorStop(0, 'rgba(255,252,240,0.3)'); hg.addColorStop(0.35, 'rgba(255,255,255,0.06)'); hg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(-0.4, 0, 6.7, 6.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = L.helmetDark; ctx.lineWidth = 0.9; ln(-4, -5.4, 3, -5.4); ln(-4, 5.4, 3, 5.4);   // side rails
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.4; for (const q of [-3, -1, 1]) { ln(q, -5.9, q, -4.9); ln(q, 4.9, q, 5.9); }   // rail slots
  if (L.band) { ctx.strokeStyle = 'rgba(20,20,18,0.85)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(-0.4, 0, 5.9, 5.4, 0, 2.2, 4.08); ctx.stroke(); }   // cat-eye band round the back
  if (L.nvg) {                                                                                       // NVG shroud, counterweight pouch, IR strobe on top
    ctx.fillStyle = L.helmetDark; ctx.fillRect(4.2, -1.6, 2.4, 3.2); ctx.fillStyle = '#2a2a26'; ctx.fillRect(5.6, -0.9, 1.1, 1.8);
    ctx.fillStyle = L.carrierDark || L.helmetDark; rrPath(-7.4, -2.2, 2.2, 4.4, 0.8); ctx.fill();
    ctx.fillStyle = '#1e1f1c'; rrPath(-2.6, -1, 1.8, 2, 0.4); ctx.fill(); ctx.fillStyle = 'rgba(160,190,255,0.35)'; ctx.fillRect(-2.2, -0.4, 1, 0.8);
  } else {                                                                                           // a plain shell: an edge band
    ctx.strokeStyle = L.helmetDark; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(-0.4, 0, 6.1, 5.6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  drawFlag(L.flag || 'us', -4.6, -1.4, 3.4, 2.4);                                                 // flag patch on the back of the helmet
  if (L.nods >= 0) drawNods(L.nods);
  if (chips) for (const c of chips) {                                                                // dents and cracks
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(c.x, c.y, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.45; ln(c.x, c.y, c.x + c.cx, c.y + c.cy);
  }
}
/* A grenade from above, lying along x with the fuze at +x (units: px in the world, ~2 cm in a hand). tb: its tumble in
   flight (end over end foreshortens it). pin: the pull ring still in; spoon: the lever still on. */
function drawNade(id, tb, s, pin = true, spoon = true) {
  const fs = 0.4 + 0.6 * Math.abs(Math.cos(tb || 0)), L = 6.6 * fs, d = id === 'mk3' ? 2.7 : 2.25, fz = 1.7 * fs;
  ctx.save(); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrPath(-L / 2 + 0.3, -d / 2 + 0.4, L, d, d / 2.4); ctx.fill();
  const g = ctx.createLinearGradient(0, -d / 2, 0, d / 2);
  if (id === 'mk3') { g.addColorStop(0, '#4a4b48'); g.addColorStop(0.45, '#1e1f1d'); g.addColorStop(1, '#0c0c0b'); }
  else { g.addColorStop(0, '#7a8268'); g.addColorStop(0.45, '#4b5340'); g.addColorStop(1, '#2a2f22'); }
  ctx.fillStyle = g; rrPath(-L / 2, -d / 2, L - fz, d, d / 3); ctx.fill();
  if (id === 'mk3') { ctx.fillStyle = '#6a6d70'; ctx.fillRect(-L / 2, -d / 2, 0.45 * fs, d); ctx.fillRect(L / 2 - fz - 0.45 * fs, -d / 2, 0.45 * fs, d); }   // the end caps
  else { ctx.fillStyle = 'rgba(10,12,8,0.85)'; for (let q = -L / 2 + 0.9 * fs; q < L / 2 - fz - 0.4; q += 1.1 * fs) { ctx.beginPath(); ctx.arc(q, -0.35, 0.28, 0, Math.PI * 2); ctx.arc(q + 0.5 * fs, 0.45, 0.28, 0, Math.PI * 2); ctx.fill(); } }   // the M84's holes
  ctx.fillStyle = '#6a6e62'; rrPath(L / 2 - fz, -d * 0.32, fz, d * 0.64, 0.4); ctx.fill();          // the fuze
  if (spoon) { ctx.fillStyle = '#8b8f80'; ctx.fillRect(L / 2 - fz - 3 * fs, -d / 2 - 0.15, 3.2 * fs, 0.5); }   // the spoon along the body
  if (pin) { ctx.strokeStyle = '#c9ccc2'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(L / 2 + 0.3, d * 0.2, 0.7, 0, Math.PI * 2); ctx.stroke(); }   // the pull ring
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-L / 2 + 0.6, -d / 2 + 0.35, L - fz - 1.2, 0.3);  // a highlight
  ctx.restore();
}
/* The VCAS sling (see SLING): the rear strap runs from the stock's swivel round your back (rear, sh: over the support
   shoulder), and the slack front loop hangs from the shoulder to the front swivel as a rope (st.p, verlet in world space,
   so it swings when you move and turn and falls away from the body), then is drawn back in the body's frame: padded
   coyote webbing, the quick-adjust pull tab at the shoulder and the QD swivel at the front. */
function drawVcas(st, x, y, bodyAng, lean, stock, rear, sh, front, sgn, t) {
  const K = CHAR_SCALE, c = Math.cos(bodyAng), s = Math.sin(bodyAng);
  const W = q => [x + K * (q[0] * c - (q[1] + lean) * s), y + K * (q[0] * s + (q[1] + lean) * c)];
  const Lc = q => { const dx = (q[0] - x) / K, dy = (q[1] - y) / K; return [dx * c + dy * s, -dx * s + dy * c - lean]; };
  const A = W(sh), B = W(front), N = SLING.pts, d = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (!st.p) { st.L = d * SLING.slack; st.p = []; for (let i = 0; i < N; i++) { const q = [A[0] + (B[0] - A[0]) * i / (N - 1), A[1] + (B[1] - A[1]) * i / (N - 1)]; st.p.push({ x: q[0], y: q[1], px: q[0], py: q[1] }); } }
  const dt = clamp(t - (st.t || t), 0, 1 / 30); st.t = t;
  const L = Math.max(st.L, d * 1.02), seg = L / (N - 1), out = W([-2, -16 * sgn]), ox = out[0] - x, oy = out[1] - y, ol = Math.hypot(ox, oy) || 1;
  const fx = ox / ol * SLING.fall * dt * dt * 60, fy = oy / ol * SLING.fall * dt * dt * 60;   // the slack hangs off the body, away from it
  if (dt > 0) for (let i = 1; i < N - 1; i++) { const q = st.p[i], vx = (q.x - q.px) * SLING.damp, vy = (q.y - q.py) * SLING.damp; q.px = q.x; q.py = q.y; q.x += vx + fx; q.y += vy + fy; }
  const P0 = st.p[0], PN = st.p[N - 1]; P0.x = P0.px = A[0]; P0.y = P0.py = A[1]; PN.x = PN.px = B[0]; PN.y = PN.py = B[1];
  for (let it = 0; it < 6; it++) for (let i = 0; i < N - 1; i++) {                 // a strap: it can't stretch
    const a = st.p[i], b = st.p[i + 1], dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1;
    if (dd <= seg) continue;
    const k = (dd - seg) / dd * 0.5, wa = i === 0 ? 0 : 1, wb = i + 1 === N - 1 ? 0 : 1, sw = wa + wb || 1;
    a.x += dx * k * 2 * wa / sw; a.y += dy * k * 2 * wa / sw; b.x -= dx * k * 2 * wb / sw; b.y -= dy * k * 2 * wb / sw;
  }
  const pts = st.p.map(q => Lc([q.x, q.y]));
  const strap = (path, w) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = w + 0.7; path(); ctx.stroke();
    ctx.strokeStyle = COYOTE; ctx.lineWidth = w; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,0.18)'; ctx.lineWidth = w * 0.3; path(); ctx.stroke();
  };
  strap(() => { ctx.beginPath(); ctx.moveTo(stock[0], stock[1]); ctx.quadraticCurveTo(rear[0] - 4, rear[1] + 2 * sgn, rear[0], rear[1]); ctx.quadraticCurveTo(sh[0] - 3, sh[1], sh[0], sh[1]); }, 1.5);   // round the back
  strap(() => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < N - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } ctx.lineTo(pts[N - 1][0], pts[N - 1][1]); }, 1.6);   // the slack front loop
  const tb = pts[1];                                                               // the quick-adjust buckle and its pull tab, by the shoulder
  ctx.fillStyle = '#1d1e1c'; ctx.save(); ctx.translate(tb[0], tb[1]); ctx.rotate(Math.atan2(pts[2][1] - pts[0][1], pts[2][0] - pts[0][0])); ctx.fillRect(-0.9, -1.1, 1.8, 2.2);
  ctx.fillStyle = '#4a4636'; ctx.fillRect(0.4, 1, 1.4, 1.6 * sgn); ctx.restore();
  ctx.fillStyle = '#8a8c90'; ctx.beginPath(); ctx.arc(front[0], front[1], 0.75, 0, Math.PI * 2); ctx.fill();   // QD swivel
  ctx.fillStyle = '#8a8c90'; ctx.beginPath(); ctx.arc(stock[0], stock[1], 0.65, 0, Math.PI * 2); ctx.fill();
}
/* The AN/PVS-14 from above on its mount: flipped down (k = 1) its one tube sits in front of the right eye, lens
   forward; flipped up (k = 0) it folds back over the shroud. */
function drawNods(k) {                                            // AN/PVS-14 on a Wilcox L4 G24: the mount on the shroud, the J-arm out to the right eye, the tube (k: 1 down in front of the eye, 0 flipped up over the helmet)
  const kk = clamp(k, 0, 1), y0 = 2.5, len = 2.6 + 3.4 * kk, d = 2.7, x0 = 6 + 1.6 * kk;    // flipped up it's seen end-on over the brow, so short
  const rim = 'rgba(0,0,0,0.65)', ln = (ax, ay, bx, by) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
  ctx.fillStyle = '#2b2c2e'; rrPath(4.9, -1.35, 2.3, 2.7, 0.6); ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 0.35; ctx.stroke();   // the mount body on the shroud
  ctx.fillStyle = '#4a4b4f'; ctx.beginPath(); ctx.arc(6.05, -0.55, 0.42, 0, Math.PI * 2); ctx.fill();                                  // its release button
  ctx.fillStyle = '#232426'; ctx.fillRect(6.2, -0.3, 0.9, y0 + 0.3); ctx.fillRect(6.2, y0 - 0.55, x0 - 5.9, 1.1);                       // the J-arm across to the eye, the dovetail under the tube
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrPath(x0 - 0.2, y0 - d / 2 + 0.55, len + 0.6, d, 1.1); ctx.fill();                             // its shadow on the face / helmet
  ctx.fillStyle = '#121314'; rrPath(x0 - 0.75, y0 - d / 2 - 0.15, 1.2, d + 0.3, 0.6); ctx.fill();                                    // the rubber eyecup
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.25; for (const q of [-0.45, -0.05]) ln(x0 + q, y0 - d / 2, x0 + q, y0 + d / 2);   // its folds
  const g = ctx.createLinearGradient(0, y0 - d / 2, 0, y0 + d / 2);                                                                     // the body: a cylinder lit from the top
  g.addColorStop(0, '#5a5c61'); g.addColorStop(0.35, '#3a3c40'); g.addColorStop(1, '#17181a');
  ctx.fillStyle = g; rrPath(x0 + 0.3, y0 - d / 2, len - 0.9, d, 1); ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 0.35; ctx.stroke();
  if (kk > 0.4) {                                                                                                                      // the battery cap on the inboard side, the gain knob on top
    ctx.fillStyle = '#2e2f33'; rrPath(x0 + len * 0.32, y0 - d / 2 - 0.75, 1.2, 0.85, 0.3); ctx.fill(); ctx.strokeStyle = rim; ctx.stroke();
    ctx.fillStyle = '#26272a'; ctx.beginPath(); ctx.arc(x0 + len * 0.55, y0 - 0.2, 0.45, 0, Math.PI * 2); ctx.fill();
  }
  const fr = x0 + len - 1.55;                                                                                                          // the objective's knurled focus ring
  ctx.fillStyle = '#26272b'; rrPath(fr, y0 - d / 2 - 0.2, 1.2, d + 0.4, 0.4); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.2; for (let q = 0.15; q < 1.2; q += 0.27) ln(fr + q, y0 - d / 2 - 0.1, fr + q, y0 + d / 2 + 0.1);
  ctx.fillStyle = '#0c0d0e'; rrPath(x0 + len - 0.4, y0 - d / 2 + 0.15, 0.6, d - 0.3, 0.3); ctx.fill();                               // the objective lens, end on
  ctx.fillStyle = 'rgba(150,120,255,0.35)'; ctx.fillRect(x0 + len - 0.2, y0 - 0.9, 0.22, 0.75);                                        // its coating catching the light
  ctx.fillStyle = 'rgba(120,230,170,0.3)'; ctx.fillRect(x0 + len - 0.2, y0 + 0.05, 0.22, 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + 0.5, y0 - d / 2 + 0.3, len - 1.6, 0.35);                                // the lit edge along the tube
}
/* Sleeve patches at the shoulder points (R = right): the flag on its side, a subdued unit patch on the other. */
function sleevePatches(L, shR, shL) {
  const fs = L.flagSide > 0 ? shR : shL, os = L.flagSide > 0 ? shL : shR;
  drawFlag(L.flag || 'us', fs[0] - 1.6, fs[1] - 1.1, 3.2, 2.2);
  if (L.unitPatch) { ctx.fillStyle = L.unitPatch; rrPath(os[0] - 1.4, os[1] - 1.3, 2.8, 2.6, 0.6); ctx.fill(); ctx.fillStyle = 'rgba(20,18,12,0.7)'; ctx.fillRect(os[0] - 0.4, os[1] - 0.8, 0.8, 1.6); }
}

/* A downed body: flat on its back, arms flung out, rifle dropped beside it; whatever armour it still had stays on. */
