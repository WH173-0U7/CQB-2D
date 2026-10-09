/* ================= MELEE =================
   An enemy right in front of you (within MELEE.range, inside MELEE.cone, nothing in between) gets the knife, on its
   own, like the auto-fire. It takes time: the rifle swings aside on its sling and the support hand draws the knife from
   the chest (draw), a step in and a thrust into the chest (lunge), the body hangs on the blade, pinned at the chest
   while its limbs go limp (hold: the ragdoll's chest is held to the blade, `rg.pin`), the knife is wrenched free and
   the body drops away (pull), and the knife goes back in its sheath and the hand back on the rifle (stow). You can't
   fire meanwhile. A target that gets away before the thrust lands is missed. */
const MELEE = { carry: 0.35, carryTurn: 0.45, range: 30, cone: 0.75, draw: 0.24, lunge: 0.16, hold: 1.4, pull: 0.2, stow: 0.32, step: 10, cd: 0.5, blade: 11, react: 0.3, pinMax: 3 };
const faceOf = c => c === p ? p.aim : c.ang;
/* Who `c` could knife right now: you go for enemies; a bot goes for you (only while you're up and fighting). */
function meleeTarget(c) {
  const list = c === p || c.ally ? bots : (state === 'play' ? [p] : []).concat(allies), face = faceOf(c);
  let best = null, bd = 1e9;
  for (const o of list) {
    if (o.dead) continue;
    const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
    if (d < MELEE.range + (o.r || BODY_R) && d < bd && Math.abs(angDiff(Math.atan2(dy, dx), face)) < MELEE.cone && losClear(c.x, c.y, o.x, o.y)) { best = o; bd = d; }
  }
  return best;
}
function startMelee(c, o) { c.melee = { ph: 'draw', t: 0, b: o, rg: null, tip: null, hit: false }; }
function endMelee(c) { const M = c && c.melee; if (!M) return; if (M.rg) M.rg.pin = null; c.melee = null; }   // killed mid-attack: whoever was on the blade drops
function meleeKill(c, o, ux, uy, tip) {
  bleedHit(o, tip.x, tip.y, ux, uy); sfxVoice(o, 'die'); voxKill(c, o);
  if (o === p) { endMelee(p); state = 'dead'; stateT = 0; hitFlash = 0.6; startRagdoll(p, p.aim, PLAYER_LOOK, 0.3, ux * 0.2, uy * 0.2); }
  else { o.lastHit = [ux * 0.2, uy * 0.2]; killBot(o, false); }
  return rags.find(q => q.c === o);
}
function stepMelee(c, dt) {
  const M = c.melee, o = M.b; M.t += dt;
  const up = () => o === p ? state === 'play' : !o.dead;
  if (c !== p && up() && (M.ph === 'draw' || M.ph === 'lunge')) { const m = 8 * dt; c.ang += clamp(angDiff(Math.atan2(o.y - c.y, o.x - c.x), c.ang), -m, m); }   // a bot keeps turning onto you
  const ang = faceOf(c), fwdX = Math.cos(ang), fwdY = Math.sin(ang);
  if (c === p && slingOn() && (M.ph === 'draw' || M.ph === 'stow')) M.t += dt * (1 / SLING.melee - 1);   // with a sling the rifle drops out of the way at once
  if (M.ph === 'draw') { if (M.t >= MELEE.draw) { M.ph = 'lunge'; M.t = 0; } }
  else if (M.ph === 'lunge') {
    if (up()) {                                                             // step in behind the thrust
      const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy) || 1, s = Math.min(MELEE.step * dt / MELEE.lunge, Math.max(0, d - (BODY_R * 2 - 4)));
      moveChar(c, dx / d * s, dy / d * s);
      M.tip = { x: o.x - dx / d * 4, y: o.y - dy / d * 4 };
    }
    if (M.t >= MELEE.lunge) {
      M.t = 0;
      if (up() && M.tip && Math.hypot(o.x - c.x, o.y - c.y) < MELEE.range + (o.r || BODY_R) + 8) {   // in: blood, the body hangs on the blade
        const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy) || 1;
        const rg = meleeKill(c, o, dx / d, dy / d, M.tip);
        if (rg) { for (const q of rg.pts) { q.px = q.x - (q.x - q.px) * 0.1; q.py = q.y - (q.y - q.py) * 0.1; } rg.pin = { x: M.tip.x, y: M.tip.y }; rg.pinT = 0; M.rg = rg; }
        M.hit = true; M.ph = 'hold'; M.from = { x: M.tip.x, y: M.tip.y };
        if (c === p) makeNoise(c.x, c.y, 90); else if (c.ally) allyNoise(c, 90, 'walk'); else emitHeard(c.x, c.y, 90, 'ewalk', 0.6);
      } else M.ph = 'stow';                                                 // they got away: missed
    }
  } else if (M.ph === 'hold') {                                             // the body sags on the knife, out in front and off to the knife side
    const f = clamp(M.t / MELEE.hold, 0, 1), e = f * f * (3 - 2 * f), sg = c.cov && c.cov.sh < 0 ? -1 : 1;
    const to = { x: c.x + fwdX * 25 - fwdY * -sg * 9, y: c.y + fwdY * 25 + fwdX * -sg * 9 };
    M.tip = { x: M.from.x + (to.x - M.from.x) * e, y: M.from.y + (to.y - M.from.y) * e };
    if (M.rg && M.rg.pin) { M.rg.pin.x = M.tip.x; M.rg.pin.y = M.tip.y; if (Math.random() < dt * 6) spray(M.tip.x, M.tip.y, fwdX, fwdY, 1, BLOOD, 'blood', 40, 2.2, 1.5); }
    if (M.t >= MELEE.hold) { M.ph = 'pull'; M.t = 0; }
  } else if (M.ph === 'pull') {
    if (M.rg && M.rg.pin) {                                                 // wrenched free: a gout of blood, the body drops away
      M.rg.pin = null;
      for (const q of M.rg.pts) { q.px -= fwdX * 1.6; q.py -= fwdY * 1.6; }
      spray(M.tip.x, M.tip.y, fwdX, fwdY, 6, BLOOD, 'blood', 110, 2.8, 1.2);
      M.rg.t = Math.max(M.rg.t, RAG.airT);
    }
    if (M.t >= MELEE.pull) { M.ph = 'stow'; M.t = 0; }
  } else if (M.ph === 'stow') { if (M.t >= MELEE.stow) { c.melee = null; c.meleeCd = MELEE.cd; } }
}
/* The knife for drawChar: phase, how far through it, and where the tip is in the body's own frame. */
function knifePose(c, bodyAng) {
  const M = c.melee, k = Math.cos(-bodyAng), sn = Math.sin(-bodyAng), lean = (c.cov && c.cov.lean) || 0;
  const tl = w => w ? [((w.x - c.x) * k - (w.y - c.y) * sn) / CHAR_SCALE, ((w.x - c.x) * sn + (w.y - c.y) * k) / CHAR_SCALE - lean] : null;
  return { ph: M.ph, f: clamp(M.t / MELEE[M.ph], 0, 1), tip: tl(M.tip), bloody: M.hit };
}
/* The knife in your hand's frame: grip at the origin, blade along +x. */
function drawKnife(bloody) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrPath(-4.6, -1.3, 15.6, 2.8, 1); ctx.fill();
  ctx.fillStyle = '#18191b'; rrPath(-4.2, -1.1, 4.6, 2.2, 0.9); ctx.fill();                       // grip
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.3; for (const x of [-3.2, -2, -0.8]) { ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x, 1); ctx.stroke(); }
  ctx.fillStyle = '#3a3c40'; ctx.fillRect(0.4, -1.7, 0.9, 3.4);                                    // guard
  const g = ctx.createLinearGradient(0, -1, 0, 1); g.addColorStop(0, '#d9dde2'); g.addColorStop(0.5, '#8d939b'); g.addColorStop(1, '#5c6168');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1.3, -1); ctx.lineTo(8.4, -1); ctx.lineTo(10.6, 0.2); ctx.lineTo(9, 1); ctx.lineTo(1.3, 1); ctx.closePath(); ctx.fill();   // clip-point blade
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(1.5, 0.75); ctx.lineTo(9, 0.75); ctx.stroke();   // the edge catching light
  if (bloody) { ctx.fillStyle = 'rgba(110,8,16,0.85)'; ctx.beginPath(); ctx.moveTo(4.5, -1); ctx.lineTo(10.6, 0.2); ctx.lineTo(9, 1); ctx.lineTo(5.5, 1); ctx.closePath(); ctx.fill(); }
}

