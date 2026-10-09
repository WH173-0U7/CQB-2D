/* ================= BULLET PHYSICS, DESTRUCTION AND DEBRIS ================= */
/* Bullets slow down as they fly (and hit softer), pass over low furniture unless they happen to hit it,
   punch into doors and crates, and can glance off walls, metal counters and cars. */
const BUL = { dragP: 2.2, dragB: 2.2, vMin: 720 };                       // speed lost per px travelled; below vMin they drop
const RICO = { base: 0.04, graze: 0.55, keep: 0.55, max: 2, jitter: 0.12, minV: 1250 };   // ricochet odds rise at shallow angles

function makeBullet(x, y, ux, uy, v, dmg, owner, cal) {
  return { x, y, ux, uy, v, v0: v, dmg, owner, cal: cal || 'rifle', bounces: 0, rolled: new Set() };
}

/* Walk the tiles a bullet crosses this frame and report the first thing it hits. */
function tileEvent(b, maxD) {
  let mx = Math.floor(b.x / T), my = Math.floor(b.y / T);
  const dx = b.ux, dy = b.uy;
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  let stepX, stepY, sideX, sideY;
  if (dx < 0) { stepX = -1; sideX = (b.x / T - mx) * ddx; } else { stepX = 1; sideX = (mx + 1 - b.x / T) * ddx; }
  if (dy < 0) { stepY = -1; sideY = (b.y / T - my) * ddy; } else { stepY = 1; sideY = (my + 1 - b.y / T) * ddy; }
  if (mx >= 0 && my >= 0 && mx < W && my < H && solidAt[my * W + mx] === 'G') {   // fired from inside a window opening (a barrel poked in): the pane ahead still counts
    const k = my * W + mx, tp = paneAt(k, b.x, b.y, b.ux, b.uy);
    if (tp > 0.05 && tp < maxD && paneIntact(k, b.x, b.y, b.ux, b.uy)) return paneEvent(k, tp, b);
  }
  for (let n = 0; n < 64; n++) {
    let t, nx = 0, ny = 0;
    if (sideX < sideY) { t = sideX; sideX += ddx; mx += stepX; nx = -stepX; }
    else { t = sideY; sideY += ddy; my += stepY; ny = -stepY; }
    const d = t * T;
    if (d >= maxD) return null;
    if (mx < 0 || my < 0 || mx >= W || my >= H) return { d, kind: 'hard', nx, ny, k: -1 };
    const k = my * W + mx;
    if (doorAt[k] >= 0) continue;                     // door slabs are checked on their own
    const c = solidAt[k];
    if (c === '.') continue;
    const comp = coverComp[k];
    if (comp >= 0 && !ownCover(b, null, comp)) {        // someone ducked behind this counter / car / sill takes no hits through it
      const who = shelters(null, comp, b.x + b.ux * d, b.y + b.uy * d, b);
      if (who) return (c === 'G' || c === 'g') ? { d, kind: 'sill', nx, ny, k, cover: who } : { d, kind: 'fixed', c, nx, ny, k, cover: who };
    } else if (comp >= 0 && (c !== 'G')) continue;      // your own cover: you're shooting over it
    if (c === 'G') {                                // the round meets the pane on the tile's centre line; a strip that's been shot out lets it straight through
      const tp = paneAt(k, b.x, b.y, b.ux, b.uy);
      if (tp < 0 || !paneIntact(k, b.x, b.y, b.ux, b.uy)) continue;
      return tp < maxD ? paneEvent(k, tp, b) : null;
    }
    if (c === 'g') continue;                      // broken window: straight through
    if (c === '#' || c === 'C' || c === 'E') return { d, kind: 'hard', nx, ny, k };   // walls stop it (see wallHit)
    if (c === 'X') return { d, kind: 'crate', nx, ny, k };
    if (!b.rolled.has(k)) { b.rolled.add(k); if (Math.random() < (FIXED_CHANCE[c] || 0.3)) return { d, kind: 'fixed', c, nx, ny, k }; }
  }
  return null;
}

/* Cover rules for bullets. */
function ownerOf(b) { return b.owner === 'p' ? p : b.owner; }
function ownCover(b, piece, comp) {                 // fired by someone touching this very object: it goes over it
  const o = ownerOf(b);
  if (!o || b.bounces > 0 || !o.cov || !o.cov.inCover) return false;
  return piece ? o.cov.piece === piece : o.cov.comp === comp;
}
function shelters(piece, comp, ex, ey, b) {         // someone touching this object is right behind it, in the bullet's path
  const test = c => {
    if (!c || c.dead || !c.cov || !c.cov.inCover) return false;
    if (b.bounces === 0 && ownerOf(b) === c) return false;
    if (piece ? c.cov.piece !== piece : (comp < 0 || c.cov.comp !== comp)) return false;
    const dx = c.x - ex, dy = c.y - ey, along = dx * b.ux + dy * b.uy;
    return along > 0 && along < 140 && Math.abs(dx * b.uy - dy * b.ux) < c.r + 14;
  };
  if (state === 'play' && test(p)) return p;
  for (const e of bots) if (test(e)) return e;
  return null;
}

/* Move one bullet; returns true when it's finished. */
function stepBullet(b, dt, drag) {
  const travel = b.v * dt;
  let ev = tileEvent(b, travel), best = ev ? ev.d : travel;
  for (const d of doors) {                      // door slabs at their current swing
    if (d.broken) continue;
    for (const l of d.leaves) {
      const a = l.base + l.th, ex = Math.cos(a) * l.L, ey = Math.sin(a) * l.L, den = b.ux * ey - b.uy * ex;
      if (Math.abs(den) < 1e-6) continue;
      const wx = l.hx - b.x, wy = l.hy - b.y, tt = (wx * ey - wy * ex) / den, uu = (wx * b.uy - wy * b.ux) / den;
      if (tt >= 0 && tt < best && uu >= 0 && uu <= 1) { best = tt; ev = { kind: 'door', door: d, leaf: l }; }
    }
  }
  for (const [hx0, hy0, ex, ey, f, d] of carDoorSegs()) {   // open car doors: steel slabs in the way
    const den = b.ux * ey - b.uy * ex;
    if (Math.abs(den) < 1e-6) continue;
    const wx = hx0 - b.x, wy = hy0 - b.y, tt = (wx * ey - wy * ex) / den, uu = (wx * b.uy - wy * b.ux) / den;
    if (tt >= 0 && tt < best && uu >= 0 && uu <= 1) { best = tt; ev = { kind: 'cardoor', f, d, u: uu, ex, ey }; }
  }
  for (const f of pieces) {                     // movable furniture: roll once per piece to see if this bullet clips it
    if (f.broken || b.rolled.has(f)) continue;
    const te = segBox(b.x, b.y, b.ux, b.uy, best, f.x, f.y, f.w, f.h);
    if (te < 0) continue;
    b.rolled.add(f);
    if (ownCover(b, f, -1)) continue;                                  // shooting over the thing you're behind
    const who = shelters(f, -1, b.x + b.ux * te, b.y + b.uy * te, b);  // someone's sheltering behind it: it soaks the shot
    if (who || Math.random() < FURN[f.c].chance) { best = te; ev = { kind: 'piece', f, cover: who }; }
  }
  const tryChar = (c, r) => {
    const s = clamp((c.x - b.x) * b.ux + (c.y - b.y) * b.uy, 0, best);
    const cx = b.x + b.ux * s - c.x, cy = b.y + b.uy * s - c.y;
    if (cx * cx + cy * cy < r * r && s < best) { best = s; ev = { kind: 'char', c }; }
  };
  // a ricochet can hit anyone, including whoever fired it
  if ((b.owner !== 'p' || b.bounces > 0) && state === 'play') tryChar(p, p.r + 2);
  for (const e of bots) if (!e.dead && (e !== b.owner || b.bounces > 0)) tryChar(e, e.r);   // friendly fire: a round hits whoever it reaches
  for (const a of allies) if (!a.dead && a !== b.owner) tryChar(a, a.r);
  for (const cv of civs) if (!cv.dead) tryChar(cv, cv.r);                   // bystanders get hit too
  const dn = rags.length ? hitDowned(b, best) : null;  // a stray round into someone downed finishes them; one into a body on a knife stops in it
  if (dn) { best = dn.s; ev = { kind: dn.rg.pin ? 'shield' : 'downed', rg: dn.rg }; }

  hitFixtures(b, best);                                // light fixtures in the way take the hit; the round carries on
  const hx = b.x + b.ux * best, hy = b.y + b.uy * best;
  const dmg = b.dmg * (0.5 + 0.5 * b.v / b.v0);      // slower bullets hit softer
  const shooter = ownerOf(b);
  const whiz = c => {                                  // a round cracking past someone rattles them
    if (!c || c.dead || (c === shooter && b.bounces === 0) || (ev && ev.c === c)) return;
    if (b.supped && b.supped.has(c)) return;
    const sl = clamp((c.x - b.x) * b.ux + (c.y - b.y) * b.uy, 0, best), qx = b.x + b.ux * sl - c.x, qy = b.y + b.uy * sl - c.y, dd = Math.hypot(qx, qy);
    if (c === p && dd < SND.whiz.r && !b.heard) { b.heard = 1; sfxWhiz(c.x + qx, c.y + qy, 1 - dd / SND.whiz.r, b.cal === 'pistol'); }   // you hear it go past
    if (c === p && dd < TUNNEL.near && bots.includes(shooter) && !(b.tunned)) { b.tunned = 1; tunnelHit(TUNNEL.whiz * (1 - 0.6 * dd / TUNNEL.near)); }   // shot at: the world narrows
    if (dd < SUPP.near) { (b.supped || (b.supped = new Set())).add(c); addSupp(c, SUPP.whiz * (1 - dd / SUPP.near)); }
  };
  if (state === 'play') whiz(p);
  for (const e of bots) whiz(e);
  for (const a of allies) whiz(a);
  b.v -= drag * best;
  b.ex = hx; b.ey = hy;                                // where it got to this frame (for its tracer)
  if (!ev) { b.x = hx; b.y = hy; return b.v < BUL.vMin; }
  if (ev.kind !== 'char') suppressAt(hx, hy, shooter, 70, SUPP.impact);
  if (ev.kind !== 'char' && bots.includes(shooter)) { const dp = Math.hypot(hx - p.x, hy - p.y); if (dp < TUNNEL.near * 0.8) tunnelHit(TUNNEL.impact * (1 - dp / (TUNNEL.near * 0.8))); }   // it smacked into something near them

  switch (ev.kind) {
    case 'char':
      if (takeHit(ev.c, dmg, hx, hy, b.ux, b.uy, b.cal === 'pistol' ? PISTOL.armor : 1) === 'kill') {   // plates, then helmet, then nothing
        voxKill(b.owner === 'p' ? p : b.owner, ev.c);
        if (b.owner === 'p' && ev.c !== p && !ev.c.civ && !ev.c.ally) runKills[b.cal === 'pistol' ? 'glock' : 'ak']++;   // your kill (never the ally's), on that gun's count, banked only if you make it home (see travel)
      }
      return true;
    case 'shield':                                    // the body hanging on the knife soaks it up: the killer behind it is covered
      bleedHit(ev.rg.c, hx, hy, b.ux, b.uy);
      for (const j of [1, 2]) { ev.rg.pts[j].px -= b.ux * 0.6; ev.rg.pts[j].py -= b.uy * 0.6; }   // and it jolts
      return true;
    case 'downed':
      bleedHit(ev.rg.c, hx, hy, b.ux, b.uy); endDown(ev.rg);
      return true;
    case 'piece': {
      const f = ev.f, F = FURN[f.c];
      damagePiece(f, dmg, hx, hy, b.ux, b.uy); coverJolt(ev.cover, f, b);
      if (f.parts && f.parts.glassHit) { f.parts.glassHit = false; b.x = hx + b.ux * 0.5; b.y = hy + b.uy * 0.5; b.v *= 0.85; return false; }   // through the glass
      if (F.rico) {                                    // steel bodywork: a glancing round can skip off it
        const dl = hx - f.x, dr = f.x + f.w - hx, du = hy - f.y, dd = f.y + f.h - hy, m = Math.min(dl, dr, du, dd);
        const nx = m === dl ? -1 : m === dr ? 1 : 0, ny = m === du ? -1 : m === dd ? 1 : 0, cos = Math.abs(b.ux * nx + b.uy * ny);
        if (Math.random() < 0.12 + 0.35 * (1 - cos) && bounceOff(b, hx, hy, nx, ny)) return false;
      }
      return !passThrough(b, hx, hy, F.mat);
    }
    case 'door':  damageDoor(ev.door, dmg, hx, hy, b.ux, b.uy, ev.leaf); return !passThrough(b, hx, hy, 'wood');
    case 'cardoor': {                                  // an open car door: a hole, sparks; it may punch through or skip off
      const d = ev.d, l = Math.hypot(ev.ex, ev.ey) || 1; let nx = -ev.ey / l, ny = ev.ex / l;
      if (nx * b.ux + ny * b.uy > 0) { nx = -nx; ny = -ny; }
      (d.holes || (d.holes = [])).length < 10 && d.holes.push([ev.u, nx * (ev.ex >= 0 ? 1 : -1) > 0 ? 1 : -1]);
      impactFx('spark', hx, hy, nx, ny); spray(hx, hy, nx, ny, 2, ['#6a6e76', '#2b2c30'], 'chip', 100, 2, 2.2);
      const cos = Math.abs(b.ux * nx + b.uy * ny);
      if (Math.random() < 0.12 + 0.35 * (1 - cos) && bounceOff(b, hx, hy, nx, ny)) return false;
      return !passThrough(b, hx, hy, 'metal');
    }
    case 'crate': damageCrate(ev.k, dmg, hx, hy, b.ux, b.uy); return !passThrough(b, hx, hy, 'wood');
    case 'sill':                                   // the wall under the window stops it (glass still breaks)
      if (solidAt[ev.k] === 'G') shatterWindow(ev.k, b, hx, hy);   // breaks the strips around the hit
      impact({ kind: 'hard', nx: ev.nx, ny: ev.ny }, hx, hy);
      coverJolt(ev.cover, null, b);
      return true;
    case 'glass':                                  // shatter it and keep going, a little slower
      shatterWindow(ev.k, b, hx, hy);
      b.x = hx + b.ux * 0.5; b.y = hy + b.uy * 0.5; b.v *= 0.85;
      return false;
    default: {                                         // 'hard' (walls, columns, elevators) or 'fixed' (built-ins, cars)
      if (ev.kind === 'hard' && ev.k >= 0) return wallHit(ev, b, hx, hy, dmg);
      impact(ev, hx, hy);
      coverJolt(ev.cover, null, b);
      if (passThrough(b, hx, hy, FIXED_MAT[ev.c] || 'metal')) return false;
      const cos = Math.abs(b.ux * ev.nx + b.uy * ev.ny);
      const metal = ev.kind === 'hard' || ev.c === 'c' || ev.c === 'y' || ev.c === 'K';
      const chance = !metal ? 0 : ev.kind === 'hard' ? RICO.base + RICO.graze * (1 - cos) : 0.12 + 0.35 * (1 - cos);
      return !(Math.random() < chance && bounceOff(b, hx, hy, ev.nx, ev.ny));
    }
  }
}

/* Soft things don't stop rounds: by material, a chance the round carries on through, slower (and hitting whoever's
   behind). Wood and upholstery mostly let it through; ceramic and thin sheet metal sometimes; solid metal rarely. */
const PEN = { soft: [0.95, 0.12], wood: [0.85, 0.25], ceramic: [0.4, 0.4], thin: [0.5, 0.35], metal: [0.12, 0.5] };   // [chance, share of speed lost]
const FIXED_MAT = { B: 'wood', D: 'wood', S: 'soft', K: 'metal', c: 'metal', y: 'metal' };
function passThrough(b, hx, hy, mat) {
  const pn = PEN[mat] || PEN.metal, pis = b.cal === 'pistol';
  if (Math.random() >= pn[0] * (pis ? PISTOL.pen : 1)) return false;   // a pistol round stops in cover far more often
  b.v *= 1 - Math.min(0.9, pn[1] * (pis ? 1.5 : 1)); b.x = hx + b.ux * 0.6; b.y = hy + b.uy * 0.6;
  return b.v >= BUL.vMin;
}
/* A shot thumps into the cover someone's behind: a movable piece gets knocked back against them, and they flinch. */
function coverJolt(c, f, b) {
  if (!c) return;
  if (f && !f.broken) movePiece(f, b.ux * 1.5, b.uy * 1.5);        // pressed back against them, not through them
  addSupp(c, SUPP.jolt);
  const a = c === p ? arms : c.arms;
  if (a) a.w += (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6);
}
function killBot(b, down) {
  if (b.dead) return;
  endMelee(b);
  b.dead = true; b.locked = false;                   // a downed bot counts as dead for everyone: out of the fight
  spray(b.x, b.y, 1, 0, 10, BLOOD, 'blood', 150, 3, Math.PI * 2);
  startRagdoll(b, b.ang, enemyLook(b), b.seed, b.lastHit && b.lastHit[0], b.lastHit && b.lastHit[1]);
  if (down) goDown(b, b.lastHit ? b.lastHit[0] : -Math.cos(b.ang), b.lastHit ? b.lastHit[1] : -Math.sin(b.ang));   // gear stays on until it bleeds out
  else dropLoot(b);
}
/* You're down: the bots lose interest (nobody shoots a downed body) and you can drag yourself until you bleed out. */
function playerDown(ux, uy) {
  goDown(p, ux, uy);
  intel = null; sweep = null;
  for (const b of bots) if (!b.dead) clearRole(b);
}

/* ---------- blood ---------- */
/* A hit sprays blood out along the bullet's path (and a little back toward the shooter),
   spatters the floor, and may open a wound that bleeds for a few seconds. All of it stays on the floor. */
function bleedHit(c, hx, hy, ux, uy) {
  sfxHit('flesh', hx, hy);
  spray(hx, hy, ux, uy, 7 + ((Math.random() * 5) | 0), BLOOD, 'blood', 230, 3.2, 0.9);
  spray(hx, hy, -ux, -uy, 2, BLOOD, 'blood', 90, 2.6, 1.4);
  splat(hx + ux * 8, hy + uy * 8, 5 + Math.random() * 4, ux, uy);
  exitSpray(hx, hy, ux, uy);
  bloodMist(hx + ux * 4, hy + uy * 4, ux, uy);
}
/* Blood that reads as real spatter: drops that land fast stretch into teardrops pointing the way they flew (with a tail
   and a satellite droplet), edges dry darker than the middle, a fan of fine mist sprays out along the shot, and the
   main splash is a lobed blob with spines thrown forward. */
const BLOOD_MIST = { n: 24, reach: 60, spread: 0.6 };
function bloodDrop(g, x, y, r, a, e, col, alpha) {
  g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = alpha;
  if (e > 1.5) {                                                    // tail and a satellite droplet out ahead
    g.fillStyle = col; g.beginPath(); g.moveTo(r * e * 0.6, -r * 0.35); g.lineTo(r * e * 1.7, 0); g.lineTo(r * e * 0.6, r * 0.35); g.closePath(); g.fill();
    g.beginPath(); g.arc(r * e * 2.1, 0, r * 0.32, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = BLOOD[1]; g.beginPath(); g.ellipse(0, 0, r * e, r / Math.sqrt(e), 0, 0, Math.PI * 2); g.fill();   // dried, darker rim
  g.globalAlpha = alpha * 0.6; g.fillStyle = col; g.beginPath(); g.ellipse(-r * e * 0.1, 0, r * e * 0.68, r / Math.sqrt(e) * 0.62, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}
function splat(x, y, r, ux, uy) {
  markBlood(x, y, r * 1.3, 160);
  const a = Math.atan2(uy, ux), g = artG;
  g.save(); g.translate(x, y); g.rotate(a);
  const n = 11, pts = [];
  for (let q = 0; q < n; q++) { const t = q / n * Math.PI * 2, rr = r * (0.7 + Math.random() * 0.5); pts.push([Math.cos(t) * rr * 1.35, Math.sin(t) * rr]); }
  const blob = k => { g.beginPath(); pts.forEach(([px, py], q) => { const [nx, ny] = pts[(q + 1) % n], mx = (px + nx) / 2 * k, my = (py + ny) / 2 * k; if (!q) g.moveTo(mx, my); else g.quadraticCurveTo(px * k, py * k, mx, my); }); g.quadraticCurveTo(pts[0][0] * k, pts[0][1] * k, (pts[0][0] + pts[1][0]) / 2 * k, (pts[0][1] + pts[1][1]) / 2 * k); g.closePath(); };
  g.globalAlpha = 0.92; g.fillStyle = BLOOD[1]; blob(1); g.fill();
  g.globalAlpha = 0.5; g.fillStyle = BLOOD[2]; blob(0.62); g.fill();
  g.globalAlpha = 0.85; g.fillStyle = BLOOD[0];
  for (let q = 5 + (Math.random() * 4 | 0); q > 0; q--) {           // spines thrown forward, each ending in a droplet
    const sa = (Math.random() - 0.5) * 1.0, L = r * (1.3 + Math.random() * 1.8), w = r * (0.12 + Math.random() * 0.14), c = Math.cos(sa), sn = Math.sin(sa);
    g.beginPath(); g.moveTo(c * r * 0.8 - sn * w, sn * r * 0.8 + c * w); g.lineTo(c * L, sn * L); g.lineTo(c * r * 0.8 + sn * w, sn * r * 0.8 - c * w); g.closePath(); g.fill();
    g.beginPath(); g.arc(c * (L + w * 1.5), sn * (L + w * 1.5), w * 1.1, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  for (let q = 0; q < BLOOD_MIST.n; q++) {                          // fine mist, thinning out with distance
    const ma = a + (Math.random() - 0.5) * 2 * BLOOD_MIST.spread * (0.4 + Math.random() * 0.6), md = r + BLOOD_MIST.reach * Math.pow(Math.random(), 0.7);
    const mx = x + Math.cos(ma) * md, my = y + Math.sin(ma) * md;
    if (wall(Math.floor(mx / T), Math.floor(my / T))) continue;
    g.globalAlpha = 0.35 + 0.45 * (1 - md / (r + BLOOD_MIST.reach)); g.fillStyle = BLOOD[(Math.random() * 3) | 0];
    g.beginPath(); g.arc(mx, my, 0.35 + Math.random() * 0.8, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
