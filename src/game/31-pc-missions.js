/* ================= MISSION PC =================
   A desktop PC on the bedroom desk at the safe house (`pcPiece`, set in buildProps): walk into its MISSIONS ring and it
   opens like the workbench (`openBench('pc')`: you walk up to the desk and face the screen). Pick the time (night or day)
   and the job (hostage rescue or bomb threat); the pick is saved (`prog.op`) and the next house your car takes you to is
   that mission (`opMap`, applied in `travel` and kept on a restart). Co-op is started here too (its CO-OP row opens the
   co-op screen, `coopOpen`). */
const OPS = {
  time: [{ id: 'night', name: 'NIGHT', txt: 'After dark: some rooms have their lights on, the rest is black. Night vision helps.' },
    { id: 'day', name: 'DAY', txt: 'Broad daylight: rooms with windows are bright, hallways and closets dim, and everyone sees further.' }],
  job: [{ id: 'rescue', name: 'HOSTAGE RESCUE', txt: 'Gunmen are holding a family in their home. Clear the house, then zip-tie the residents: they come out when you drive off.' },
    { id: 'bomb', name: 'BOMB THREAT', txt: 'Gunmen have planted a bomb in a family home, on a timer. Find it and defuse it before it goes off.' }] };
const opNow = () => { const o = Object.assign({ time: 'night', job: 'rescue' }, prog.op);
  for (const k in OPS) if (!OPS[k].some(q => q.id === o[k] && !q.soon)) o[k] = OPS[k][0].id;   // not built yet: the default
  return o; };
const opTitle = o => OPS.time.find(q => q.id === o.time).name + ' · ' + OPS.job.find(q => q.id === o.job).name;
const opMap = o => ({ op: o, day: o.time === 'day', bomb: o.job === 'bomb' });
let pcIn = false;
function pcFrame() {                                             // the desk: its centre, the way to the wall behind it (b) and its depth
  const f = pcPiece, a = (f.face || 0) * Math.PI / 2;
  return { cx: f.x + f.w / 2, cy: f.y + f.h / 2, bx: Math.sin(a), by: -Math.cos(a), d: (f.face || 0) % 2 ? f.w : f.h };
}
const PC_CHAIR = 30;                                             // the desk chair's depth in front of it: you stand behind the chair
const pcStand = () => { const F = pcFrame(), r = F.d / 2 + PC_CHAIR + BODY_R; return { x: F.cx - F.bx * r, y: F.cy - F.by * r }; };
const pcRing = () => { if (MAP.id !== 'house' || !pcPiece || pcPiece.broken) return null; const F = pcFrame(), r = F.d / 2 + PC_CHAIR + BODY_R + 8; return { x: F.cx - F.bx * r, y: F.cy - F.by * r }; };
const pcFace = () => { const F = pcFrame(); return Math.atan2(F.by, F.bx); };
/* The screen, glowing over the dark (brighter while you're at it). */
function drawPcScreen(t) {
  const f = pcPiece;
  if (MAP.id !== 'house' || !f || f.broken || !onView(f.x + f.w / 2, f.y + f.h / 2, 60)) return;
  const fc = f.face || 0, ch = fc % 2 ? f.w : f.h, k = bench && bench.kind === 'pc' ? 0.8 : 0.45 + 0.05 * Math.sin(t * 2.3);
  ctx.save(); ctx.translate(f.x + f.w / 2, f.y + f.h / 2); ctx.rotate(fc * Math.PI / 2); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(110,170,255,' + k.toFixed(2) + ')'; ctx.fillRect(-22, -ch / 2 + 5.6, 32, 1.4);   // the panel's face (see drawHomePiece's pc)
  ctx.restore();
}
/* The menu: a panel on the right, like the workbench's. */
function drawPc(t) {
  const B = bench, o = opNow();
  B.hits = [];
  const hit = (x, y, ww, hh, fn) => B.hits.push({ x, y, w: ww, h: hh, fn });
  const pad = 10, X0 = Math.round(VW * 0.47), PW = VW - X0 - pad;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const sh = ctx.createLinearGradient(X0 - 40, 0, X0 + 10, 0); sh.addColorStop(0, 'rgba(9,11,14,0)'); sh.addColorStop(1, 'rgba(9,11,14,0.94)');
  ctx.fillStyle = sh; ctx.fillRect(X0 - 40, 0, 50, VH); ctx.fillStyle = 'rgba(9,11,14,0.94)'; ctx.fillRect(X0 + 10, 0, VW - X0, VH);
  ctx.fillStyle = '#e6edf5'; ctx.font = '700 17px ' + FONT; ctx.fillText('MISSIONS', X0, pad + 12);
  ctx.textAlign = 'right'; ctx.font = '700 15px ' + FONT; ctx.fillStyle = '#f0c75a'; ctx.fillText('★ ' + prog.medals, VW - 50, pad + 12);
  ctx.strokeStyle = 'rgba(230,237,245,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(VW - 24, pad + 12, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VW - 29, pad + 7); ctx.lineTo(VW - 19, pad + 17); ctx.moveTo(VW - 19, pad + 7); ctx.lineTo(VW - 29, pad + 17); ctx.stroke();
  hit(VW - 44, 0, 44, pad + 30, () => closeBench());
  const ty = pad + 28;
  ctx.textAlign = 'left'; ctx.font = '600 11px ' + FONT; ctx.fillStyle = 'rgba(200,215,230,0.8)'; ctx.fillText('MISSIONS COMPLETED  ' + (prog.missions || 0), X0, ty + 10);
  ctx.textAlign = 'right'; ctx.fillText('CIVILIANS RESCUED  ' + handedOver, X0 + PW, ty + 10);
  let y = ty + 26;
  const rh = Math.min(30, (VH - y - pad - 24) / 6);
  for (const k of ['time', 'job']) {                             // a row of choices each: when, and what
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(170,200,230,0.85)'; ctx.font = '700 10px ' + FONT; ctx.fillText(k === 'time' ? 'TIME' : 'JOB', X0, y + rh / 2);
    const bx0 = X0 + 40, bw = (PW - 40 - 6) / OPS[k].length;
    OPS[k].forEach((q, i) => {
      const x = bx0 + i * bw, on = o[k] === q.id;
      ctx.fillStyle = q.soon ? 'rgba(90,95,105,0.4)' : on ? 'rgba(70,140,200,0.9)' : 'rgba(120,125,135,0.5)'; rrPath(x, y, bw - 6, rh, 5); ctx.fill();
      if (on) { ctx.strokeStyle = 'rgba(190,225,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.fillStyle = q.soon ? 'rgba(220,228,238,0.45)' : '#fff'; ctx.font = '700 11px ' + FONT;
      ctx.fillText(q.name + (q.soon ? '  (SOON)' : ''), x + (bw - 6) / 2, y + rh / 2 + 1);
      if (!q.soon) hit(x, y, bw - 6, rh, () => { prog.op = Object.assign(opNow(), { [k]: q.id }); saveProg(); });
    });
    y += rh + 8;
  }
  {                                                              // co-op: play with a friend on another phone (see CO-OP)
    const on = coopLinked(), lost = !on && coop && coop.ui === 'error', bx = X0 + 40, bw = PW - 40 - 12;
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(170,200,230,0.85)'; ctx.font = '700 10px ' + FONT; ctx.fillText('CO-OP', X0, y + rh / 2);
    ctx.fillStyle = on ? 'rgba(70,160,110,0.9)' : lost ? 'rgba(150,90,60,0.85)' : 'rgba(120,125,135,0.5)'; rrPath(bx, y, bw, rh, 5); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 11px ' + FONT;
    ctx.fillText(on ? 'PARTNER LINKED  ·  MANAGE' : lost ? 'LINK LOST  ·  SEE WHY' : 'PLAY WITH A FRIEND  ·  HOST OR JOIN', bx + bw / 2, y + rh / 2 + 1);
    hit(bx, y, bw, rh, () => coopOpen());
    y += rh + 8;
  }
  const by = y + 4, bh = VH - pad - 26 - by;                     // the briefing, on the "screen"
  ctx.fillStyle = '#0e1a2a'; rrPath(X0, by, PW, bh, 6); ctx.fill();
  ctx.save(); rrPath(X0, by, PW, bh, 6); ctx.clip();
  ctx.fillStyle = 'rgba(120,170,255,0.05)'; for (let q = by; q < by + bh; q += 3) ctx.fillRect(X0, q, PW, 1);   // scanlines
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fd0ff'; ctx.font = '700 12px ' + FONT; ctx.fillText('BRIEFING: ' + opTitle(o), X0 + 10, by + 14);
  ctx.fillStyle = 'rgba(200,225,250,0.9)'; ctx.font = '600 11px ' + FONT;
  let ly = by + 32;
  for (const s of [OPS.job.find(q => q.id === o.job).txt, OPS.time.find(q => q.id === o.time).txt]) {
    let line = '';
    for (const wd of s.split(' ')) { const tl = line ? line + ' ' + wd : wd; if (ctx.measureText(tl).width > PW - 20 && line) { ctx.fillText(line, X0 + 10, ly); ly += 14; line = wd; } else line = tl; }
    if (line) { ctx.fillText(line, X0 + 10, ly); ly += 20; }
  }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(215,228,240,0.9)'; ctx.font = '600 11px ' + FONT;
  ctx.fillText('NEXT: ' + opTitle(o) + '  ·  GET IN YOUR CAR TO DEPLOY', X0 + PW / 2, VH - pad - 8);
  ctx.restore();
}
