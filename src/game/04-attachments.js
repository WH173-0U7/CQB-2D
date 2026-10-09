/* ================= ATTACHMENTS =================
   Fitted only at the safe house workbench (see WORKBENCH). Each one is bought with medals (MEDALS.perCiv for every civilian
   handed over) once that gun has enough kills of its own. One per slot (the two AK lasers share the top rail, the Glock's
   light and laser share its rail). Modelled on real kit; sizes in `drawRifle` / `drawGlock` and the workbench drawings
   follow the real thing (AKM 880 mm, 415 mm barrel; Glock 17 202 mm, 114 mm barrel).
   Progress (medals, kills per gun, what's owned and fitted) is kept in localStorage (`ds_prog`). */
const ATT = {
  ak: [
    { id: 'grip', slot: 'under', name: 'VERTICAL GRIP', real: 'Magpul RVG on an M-LOK handguard', price: 3, kills: 5, fx: 'Much steadier firing on the move, less recoil' },
    { id: 'laser', slot: 'rail', name: 'LASER', real: 'Holosun LS321, visible red', price: 3, kills: 8, fx: 'Tighter fire on the move. They can see the beam' },
    { id: 'dot', slot: 'optic', name: 'RED DOT', real: 'Aimpoint Micro T-2 on a side mount', price: 5, kills: 12, fx: 'Locks on further out, the view pulls back a little' },
    { id: 'ir', slot: 'rail', name: 'IR LASER', real: 'AN/PEQ-15, infrared (NVG only)', price: 7, kills: 25, fx: 'Seen only through night vision: tighter fire on the move, invisible to them' },
    { id: 'supp', slot: 'muzzle', name: 'SUPPRESSOR', real: '7.62 mm can, 180 mm, on the muzzle thread', price: 8, kills: 30, fx: 'Quieter, heard less far, hard to place, no flash' },
    { id: 'sling', slot: 'sling', name: 'SLING', real: 'Blue Force Gear VCAS, padded two-point, quick adjust', price: 2, kills: 3, fx: 'Faster swaps to the Glock and back, faster knife draw and stow' }],
  glock: [
    { id: 'laser', slot: 'rail', name: 'LASER', real: 'Crimson Trace CMR-201 Rail Master', price: 2, kills: 3, fx: 'Tighter fire on the move. They can see the beam' },
    { id: 'light', slot: 'rail', name: 'WEAPON LIGHT', real: 'SureFire X300U-A, 1000 lm', price: 3, kills: 5, fx: 'Lights up the dark, and lights you up' },
    { id: 'dot', slot: 'optic', name: 'RED DOT', real: 'Trijicon RMR Type 2, slide cut for it', price: 4, kills: 8, fx: 'Locks on further out, the view pulls back a little' }]
};
// dot: lock range up by this share per gun, view pulled back by `zoom`; grip/laser: share of the moving spread left, grip recoil;
// supp: share of the shot's reach for hearing, how far off a listener's guess lands (px), extra barrel length (rifle units)
const SLING = { swap: 0.6, melee: 0.65, slack: 1.1, pts: 7, damp: 0.86, fall: 26 };   // VCAS: swap and knife draw/stow times x this; its strap: slack, rope points, damping, how hard the slack hangs off the body (px/s²)
const slingOn = () => !!(bench ? benchShown('ak') : fitSet('ak')).sling;
const ATTFX = { dot: { ak: 0.12, glock: 0.08, zoom: 0.05 }, grip: { move: 0.55, recoil: 0.6 }, laser: { move: 0.78, reach: 700 }, supp: { noise: 0.35, jitter: 220, len: 11 } };
const MEDALS = { perCiv: 1 };
const newProg = () => ({ medals: 0, kills: { ak: 0, glock: 0 }, owned: { ak: {}, glock: {} }, fit: { ak: {}, glock: {} }, missions: 0, gear: {}, wear: {} });
