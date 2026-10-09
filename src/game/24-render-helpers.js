/* ================= RENDER ================= */
const FLOOR = ['#262942', '#282b45', '#2a2d47', '#272a44'];
const FONT = '"Arial Narrow","Roboto Condensed",Impact,sans-serif';

function rayPoly(a0, a1, n, maxD, ox, oy) {
  return visPoly(ox === undefined ? p.x : ox, oy === undefined ? p.y : oy, maxD, a0, a1, n);
}
function polyPath(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

