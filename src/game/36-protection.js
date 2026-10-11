/* ================= PROTECTION =================
   No health bar: you live on your armour. A round from the front hits the front plate, from behind the back
   plate. Each plate takes about three rifle hits, chipping and cracking, then shatters. With that side's plate
   gone, the helmet takes the hits; when the helmet is shot off, the next unprotected hit kills. */
function newProt() { return { front: PLATE_HP, back: PLATE_HP, helmet: HELMET_HP, chipsF: [], chipsB: [], chipsH: [] }; }
const CERAMIC = ['#b9b4a6', '#8a8676', '#5a5848', '#d8d2c0'];
function takeHit(c, dmg, hx, hy, ux, uy, armK = 1) {
  const isP = c === p, L = isP ? PLAYER_LOOK : (c.look || enemyLook(c)), pr = c.prot || (c.prot = newProt());
  c.fightAt = simT;                                      // hit: no stooping for loot for a while
  if (isP) bombHit();                                    // ...and a defuse starts again
  const facing = isP ? p.aim : c.ang;
  const fromFront = Math.abs(angDiff(Math.atan2(-uy, -ux), facing)) < Math.PI / 2;   // which way the round came from
  const a = isP ? arms : c.arms;
  if (a) a.w += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2);            // the impact rocks them
  moveCircle(c, ux * 3, uy * 3);
  addSupp(c, SUPP.hit);
  if (isP) { hitFlash = 0.35; tunnelHit(TUNNEL.hit); } else if (!c.civ && !c.ally && c.state !== 'attack') investigate(c, p.x, p.y);
  const side = fromFront ? 'front' : 'back', chips = fromFront ? pr.chipsF : pr.chipsB;
  if (pr[side] > 0) {                                           // the plate stops it; pieces fly off
    pr[side] -= dmg * armK;                                   // a 9 mm round barely chips a rifle plate
    if (chips.length < 8) chips.push({ y: Math.random() * 2 - 1, d: Math.random() * 2, cx: (Math.random() - 0.5) * 4, cy: (Math.random() - 0.5) * 6 });
    spray(hx - ux * 3, hy - uy * 3, -ux, -uy, 4, CERAMIC, 'chip', 150, 3, 2.4);
    impactFx('plate', hx - ux * 2, hy - uy * 2, -ux, -uy);
    if (pr[side] <= 0) {                                        // plate shatters
      pr[side] = 0;
      spray(c.x, c.y, -ux, -uy, 12, CERAMIC, 'chip', 170, 4, Math.PI * 1.4);
      spray(c.x, c.y, ux, uy, 4, CERAMIC, 'shard', 120, 4, 1.2);
    }
    sfxVoice(c, 'hurt');
    return 'plate';
  }
  if (pr.helmet > 0) {                                          // last piece of protection
    pr.helmet -= dmg * armK;
    if (pr.chipsH.length < 6) pr.chipsH.push({ x: (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 7, cx: (Math.random() - 0.5) * 3, cy: (Math.random() - 0.5) * 3 });
    impactFx('helmet', hx - ux * 2, hy - uy * 2, -ux, -uy);
    spray(c.x, c.y, -ux, -uy, 3, [L.helmet, L.helmetDark], 'chip', 120, 2.5, 2);
    if (pr.helmet <= 0) {                                       // knocked clean off: it clatters across the floor
      pr.helmet = 0;
      const nods = isP && lockShown('nvg') && !p.nvgLost;     // your night vision is on that helmet's mount: it goes with it
      if (nods) { p.nvgLost = true; p.nvgK = 0; PLAYER_LOOK.nods = -1; }
      debris.push({ x: c.x, y: c.y, vx: ux * 140 + (Math.random() - 0.5) * 60, vy: uy * 140 + (Math.random() - 0.5) * 60,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, col: L.helmet, shape: 'helmet', size: 6.6 * CHAR_SCALE, fric: 4, t: 0, nods });
    }
    sfxVoice(c, 'hurt');
    return 'helmet';
  }
  bleedHit(c, hx, hy, ux, uy);                                  // nothing left: that one goes through
  sfxVoice(c, 'die');
  const down = Math.random() < DOWN.chance;                    // sometimes they go down alive and bleed out (see DOWNED)
  if (isP) { if (state === 'play') { endMelee(p); state = down ? 'downed' : 'dead'; stateT = 0; startRagdoll(p, p.aim, PLAYER_LOOK, 0.3, ux, uy); if (down) playerDown(ux, uy); } }
  else { c.lastHit = [ux, uy]; killBot(c, down); }
  return 'kill';
}

