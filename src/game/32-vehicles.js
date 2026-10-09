/* ================= VEHICLES =================
   Cars and the taxi are pieces with separate parts (`f.parts`, in the car's own frame: x from the back bumper to the
   front, y from its left side (the kerb side, where the driver's door is) to its right). The cached sprite is only the
   body; the parts are drawn live (`drawVehUnder`: tyres; `drawVehOver`: glass, lights, mirrors, roof sign, doors) and
   each takes its own hits (`vehHit`):
   - tyres: shot flat (a hiss of air, bits of rubber), then drawn squashed;
   - headlights / tail lights: shatter and go dark. Headlights throw real beams (`vehLights`: cones that light people up
     for everyone), tail lights a red glow, the taxi's roof sign a warm one, while `f.lightsOn`;
   - windows (windscreen, rear, both sides): crack, then shatter, and rounds carry on through the empty frame;
   - mirrors: knocked clean off;
   - doors: hinged at the front edge, `ang` swings them out (the one you're getting in by opens as you stand at it).
   Anything else is the body: a hole, sparks, and the bodywork can skip a round (see `rico`). */
function vehParts(f) {
  const w = f.w, h = f.h, P = f.parts = { tyres: [], lamps: [], glass: [], mirrors: [], doors: [], sign: null, glassHit: false };
  for (const [x, s] of [[0.2, -1], [0.2, 1], [0.74, -1], [0.74, 1]]) P.tyres.push({ x, s, hp: VEH.tyreHp, flat: false });
  for (const [x, s, head] of [[1, -1, true], [1, 1, true], [0, -1, false], [0, 1, false]]) P.lamps.push({ x, s, head, hp: VEH.lampHp, broken: false });
  P.glass.push({ id: 'front', x0: 0.66, x1: 0.66 + 14 / w, y0: 18 / h, y1: 1 - 18 / h, hp: VEH.glassHp, cracks: [] });
  P.glass.push({ id: 'rear', x0: 0.24, x1: 0.24 + 11 / w, y0: 18 / h, y1: 1 - 18 / h, hp: VEH.glassHp, cracks: [] });
  P.glass.push({ id: 'left', x0: 0.36, x1: 0.62, y0: 13 / h, y1: 17 / h, hp: VEH.glassHp, cracks: [] });
  P.glass.push({ id: 'right', x0: 0.36, x1: 0.62, y0: 1 - 17 / h, y1: 1 - 13 / h, hp: VEH.glassHp, cracks: [] });
  for (const s of [-1, 1]) P.mirrors.push({ s, hp: VEH.mirrorHp, off: false });
  for (const [id, x0, x1, s] of [['FL', 0.42, 0.62, -1], ['RL', 0.24, 0.42, -1], ['FR', 0.42, 0.62, 1], ['RR', 0.24, 0.42, 1]]) P.doors.push({ id, x0, x1, s, ang: 0 });
  if (f.c === 'y') P.sign = { hp: VEH.signHp, broken: false };
}
const vehY = (f, s) => s < 0 ? 0 : f.h;                  // the side an edge part sits on (left = top of the sprite)
/* Open doors as solid slabs: [hinge x, y, vector to the free end, the car, the door], for collisions and bullets. */
function carDoorSegs() {
  const out = [];
  for (const f of pieces) {
    if (!f.parts || f.broken) continue;
    for (const d of f.parts.doors) {
      if (d.ang < 0.05) continue;
      const len = f.w * (d.x1 - d.x0), A = Math.PI + (d.s < 0 ? d.ang : -d.ang);
      out.push([f.x + f.w * d.x1, f.y + (d.s < 0 ? 9 : f.h - 9), Math.cos(A) * len, Math.sin(A) * len, f, d]);
    }
  }
  return out;
}
function vehHit(f, dmg, hx, hy, ux, uy) {
  const P = f.parts, lx = hx - f.x, ly = hy - f.y, w = f.w, h = f.h, near = (x, y, r) => (lx - x) ** 2 + (ly - y) ** 2 < r * r;
  for (const m of P.mirrors) if (!m.off && near(w * 0.62 + 3, m.s < 0 ? 6 : h - 6, 7)) {
    if ((m.hp -= dmg) <= 0) { m.off = true; launchChunk(hx, hy, ux, uy, 160, chunkPts(3.5, 5), '#2a2b2e'); spray(hx, hy, -ux, -uy, 3, GLASS_BITS, 'shard', 90, 2, 2); impactFx('glass', hx, hy, -ux, -uy); }
    else impactFx('spark', hx, hy, -ux, -uy);
    return true;
  }
  for (const L of P.lamps) if (!L.broken && near(L.head ? w - 7 : 6.5, L.s < 0 ? 17.5 : h - 17.5, 7)) {
    if ((L.hp -= dmg) <= 0) { L.broken = true; spray(hx, hy, -ux, -uy, 6, L.head ? GLASS_BITS : ['#c8282e', '#8a1a1e'], 'shard', 120, 2.2, 2.4); impactFx('glass', hx, hy, -ux, -uy); }
    return true;
  }
  if (P.sign && !P.sign.broken && near(w * 0.45 + 8, h / 2, 10)) {
    if ((P.sign.hp -= dmg) <= 0) { P.sign.broken = true; spray(hx, hy, -ux, -uy, 5, ['#f0e070', '#2a2a2a'], 'shard', 110, 2.4, 2.4); impactFx('spark', hx, hy, -ux, -uy); }
    return true;
  }
  for (const t of P.tyres) if (near(w * t.x, t.s < 0 ? 8 : h - 8, 11)) {
    if (!t.flat && (t.hp -= dmg) <= 0) {                // a hiss of air, bits of rubber, and it goes flat
      t.flat = true;
      for (let q = 0; q < 4; q++) puff(hx, hy, (Math.random() - 0.5) * 60 - ux * 30, (Math.random() - 0.5) * 60 - uy * 30, 5, 18, 0.7, 0.18, 0, 3);
      spray(hx, hy, -ux, -uy, 4, ['#1a1a1c', '#2e2e30'], 'chip', 100, 2.4, 2.6);
    }
    return true;
  }
  for (const G of P.glass) if (lx > w * G.x0 - 3 && lx < w * G.x1 + 3 && ly > h * G.y0 - 3 && ly < h * G.y1 + 3) {
    if (G.hp <= 0) { P.glassHit = true; return true; } // already gone: the round flies on through
    G.hp -= dmg; G.cracks.push([lx, ly]);
    spray(hx - ux * 2, hy - uy * 2, -ux, -uy, 4, GLASS_BITS, 'shard', 100, 2, 2.4); impactFx('glass', hx, hy, -ux, -uy);
    if (G.hp <= 0) { spray(hx, hy, ux, uy, 8, GLASS_BITS, 'shard', 130, 2.2, 1.6); P.glassHit = true; }
    return true;
  }
  return false;                                          // the body (doors included): a hole, as usual
}
function vehLights(f, out) {
  const P = f.parts, a = f.rot || 0, ca = Math.cos(a), sa = Math.sin(a), at = (lx, ly) => [f.x + lx, f.y + ly];
  for (const L of P.lamps) {
    if (L.broken) continue;
    const [x, y] = at(L.head ? f.w - 3 : 3, L.s < 0 ? 17.5 : f.h - 17.5);
    if (L.head) out.push({ x: x + ca * 2, y: y + sa * 2, r: VEH.beam, col: [255, 244, 214], k: 0.7, cone: [a - VEH.beamHalf, a + VEH.beamHalf] });
    else out.push({ x: x - ca * 3, y: y - sa * 3, r: 46, col: [255, 40, 40], k: 0.32 });
  }
  if (P.sign && !P.sign.broken) out.push({ x: f.x + f.w * 0.45 + 8, y: f.y + f.h / 2, r: 60, col: [255, 226, 120], k: 0.28 });
}
function drawVehUnder(f) {                               // tyres, peeking out from under the body (squashed when flat)
  for (const t of f.parts.tyres) {
    const x = f.x + f.w * t.x, y = f.y + (t.s < 0 ? 6 : f.h - 10), fl = t.flat;
    ctx.fillStyle = fl ? '#0e0e10' : '#16171a'; ctx.fillRect(x - (fl ? 11 : 9), y - (fl ? (t.s < 0 ? 1.5 : 0) : 0), fl ? 22 : 18, fl ? 5.5 : 4);
    if (!fl) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let q = -7; q < 9; q += 3) ctx.fillRect(x + q, y + (t.s < 0 ? 0 : 3), 1, 1); }   // tread
  }
}
function drawVehOver(f) {
  const P = f.parts, x0 = f.x, y0 = f.y, w = f.w, h = f.h, taxi = f.c === 'y';
  for (const G of P.glass) {                             // glass: tinted and glinting, cracked from hits, or gone (the dark cabin showing)
    const gx = x0 + w * G.x0, gy = y0 + h * G.y0, gw = w * (G.x1 - G.x0), gh = h * (G.y1 - G.y0);
    if (G.hp <= 0) { ctx.fillStyle = '#0c0d10'; rrPath(gx, gy, gw, gh, 2); ctx.fill(); ctx.fillStyle = 'rgba(160,190,220,0.4)'; for (let q = 0; q < 4; q++) ctx.fillRect(gx + ((q * 37) % gw), gy + (q % 2 ? gh - 2 : 0), 2, 2); continue; }
    ctx.fillStyle = '#2a3440'; rrPath(gx, gy, gw, gh, 3); ctx.fill();
    ctx.fillStyle = 'rgba(160,190,220,0.35)'; ctx.fillRect(gx + 2, gy + 2, Math.max(2, gw * 0.2), gh - 4);
    if (G.cracks.length) {
      ctx.save(); rrPath(gx, gy, gw, gh, 3); ctx.clip(); ctx.strokeStyle = 'rgba(220,235,250,0.75)'; ctx.lineWidth = 0.6;
      for (const [cx, cy] of G.cracks) for (let q = 0; q < 7; q++) { const a = q / 7 * Math.PI * 2 + cx, l = 6 + (q * 13 % 9); ctx.beginPath(); ctx.moveTo(x0 + cx, y0 + cy); ctx.lineTo(x0 + cx + Math.cos(a) * l, y0 + cy + Math.sin(a) * l); ctx.stroke(); }
      ctx.restore();
    }
  }
  for (const L of P.lamps) {                             // headlights (white) and tail lights (red), lit or broken
    const lx = L.head ? x0 + w - 9 : x0 + 5, ly = y0 + (L.s < 0 ? 13 : h - 22), on = f.lightsOn && !L.broken;
    ctx.fillStyle = L.broken ? '#2a2a2c' : L.head ? (on ? '#fffbe8' : '#d8d4bc') : (on ? '#ff3a3a' : '#8a1e22'); ctx.fillRect(lx, ly, L.head ? 4 : 3, 9);
    if (L.broken) { ctx.strokeStyle = 'rgba(200,200,200,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(lx, ly + 2); ctx.lineTo(lx + 4, ly + 7); ctx.stroke(); }
  }
  for (const m of P.mirrors) if (!m.off) { ctx.fillStyle = '#2a2b2e'; ctx.fillRect(x0 + w * 0.62, y0 + (m.s < 0 ? 3 : h - 9), 6, 6); ctx.fillStyle = 'rgba(160,190,220,0.5)'; ctx.fillRect(x0 + w * 0.62 + 1, y0 + (m.s < 0 ? 4 : h - 8), 2, 4); }
  if (P.sign) {                                          // the taxi's roof sign
    ctx.fillStyle = P.sign.broken ? '#4a4228' : f.lightsOn ? '#fff09a' : '#f0e070'; rrPath(x0 + w * 0.45, y0 + h / 2 - 6, 16, 12, 2); ctx.fill();
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x0 + w * 0.45 + 3, y0 + h / 2 - 2, 10, 4);
  }
  for (const d of P.doors) {                             // an open door: the dark gap in the side, the door swung out on its front hinge
    if (d.ang < 0.02) continue;
    const hx = x0 + w * d.x1, hy = y0 + (d.s < 0 ? 9 : h - 9), len = w * (d.x1 - d.x0), a = Math.PI + d.s * -d.ang * -1;
    ctx.fillStyle = '#0c0d10'; ctx.fillRect(x0 + w * d.x0, d.s < 0 ? y0 + 8 : y0 + h - 14, len, 6);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.PI + (d.s < 0 ? d.ang : -d.ang));
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, -1, len, 6);
    ctx.fillStyle = taxi ? '#c9a227' : ['#7a2a32', '#2e4a78', '#5e6066', '#2e6a52'][(f.tint || 0) % 4]; ctx.fillRect(0, -2.5, len, 4.5);
    ctx.fillStyle = '#2a3440'; ctx.fillRect(len * 0.25, d.s < 0 ? 1 : -2.5, len * 0.6, 1.5);
    if (d.holes) { ctx.fillStyle = '#0a0a0c'; for (const [u] of d.holes) { ctx.beginPath(); ctx.arc(u * len, -0.2, 1.1, 0, Math.PI * 2); ctx.fill(); } }   // bullet holes
    ctx.restore();
  }
}

