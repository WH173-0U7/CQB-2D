/* ================= INPUT ================= */
const keys = {};
const STICK_R = 56;
/* Settings (the gear button top right): sensitivities, volume and kill taunts, saved in the browser (ds_set). The game
   pauses while the screen is open. Each slider row: [key, label, min, max, how the value reads]. */
const SET0 = { aim: 1, mouse: 1, keys: 1, stick: 1, vol: 1, res: 1, taunts: true };
const SET_ROWS = [['aim', 'AIM SENSITIVITY (TOUCH)', 0.25, 3, 'x'], ['mouse', 'MOUSE SENSITIVITY', 0.25, 3, 'x'], ['keys', 'TURN SPEED (Q / E, ARROW KEYS)', 0.25, 3, 'x'],
  ['stick', 'MOVE STICK SENSITIVITY', 0.5, 2, 'x'], ['vol', 'VOLUME', 0, 1, '%'], ['res', 'RESOLUTION (LOWER IT IF THE GAME LAGS)', 0.5, 1, '%'], ['taunts', 'KILL TAUNTS']];
const loadSets = () => { try { return Object.assign({}, SET0, JSON.parse(localStorage.getItem('ds_set')) || {}); } catch (_) { return Object.assign({}, SET0); } };
const saveSets = () => { try { localStorage.setItem('ds_set', JSON.stringify(sets)); } catch (_) {} };
let sets = loadSets(), setOpen = null;                    // setOpen: { drag: { id, k } } while the settings screen is up
const moveR = () => STICK_R / sets.stick;                // more sensitive: full speed with a shorter drag
const sticks = {
  move: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  aim:  { id: null, ox: 0, oy: 0, x: 0, y: 0 }     // swipe-to-turn
};
let DPR = 1, VW = 0, VH = 0, S = 1;
let rotated = false, rotDir = 1, lockTried = false;

/* Ask the browser for real landscape (works on most Android browsers once the
   page may go fullscreen; iPhones ignore it, so we also rotate the picture
   ourselves when the phone is held upright). */
async function tryLock() {
  if (lockTried) return; lockTried = true;
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
  } catch (_) {}
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (_) {}
}

function localXY(e) {
  if (!rotated) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const b = document.body.getBoundingClientRect();
  const bx = e.clientX - b.left, by = e.clientY - b.top;
  return rotDir === 1 ? [by, b.width - bx] : [b.height - by, bx];
}
const reloadBtn = () => ({ x: VW * 0.9, y: VH * 0.86, r: 44 });
/* Weapon swap: hold the reload button (or R) and the weapon you'd switch to shows up beside it while the game slows
   right down (SWAP.k). Drag onto it and let go to switch (rifle ↔ Glock); let go anywhere else to cancel. A quick tap
   still reloads. On a keyboard: hold R, point the mouse at it and let go of R; X switches straight away. `p.side.want`
   is the hand's choice: 'pistol' keeps the Glock out even with rifle ammo left; back to the rifle it comes up and
   finishes whatever it was doing (an emptied rifle reloads itself). */
const SWAP = { hold: 0.2, k: 0.25, ease: 10, r: 42 };
let swap = null, swapK = 1, ptrX = 0, ptrY = 0;
const swapIcon = () => { const b = reloadBtn(); return { x: b.x - 128, y: b.y - 18, r: SWAP.r }; };
const swapTo = () => (p.side.out || (p.side.sw && p.side.sw.to === 'pistol')) ? 'rifle' : 'pistol';
const swapCan = to => to === 'pistol' || ammo > 0 || mags.length > 0;          // no rifle ammo at all: the rifle can't come back
const isNade = k => k === 'm84' || k === 'mk3';
const NADE_NAME = { m84: 'M84', mk3: 'Mk3A2' };
function swapOpts() {                                                            // what the picker offers: the other gun(s) and any grenade you carry, in an arc by the button
  const cur = nadeHeld() ? p.nade.id : (p.side.out || (p.side.sw && p.side.sw.to === 'pistol')) ? 'pistol' : 'rifle', b = reloadBtn();
  return ['rifle', 'pistol', 'm84', 'mk3'].filter(k => k !== cur && (!isNade(k) || p.nades[k] > 0)).map((k, i) => { const a = Math.PI + i * 0.58; return { k, x: b.x + Math.cos(a) * 128, y: b.y - 18 + Math.sin(a) * 128, r: SWAP.r }; });
}
let nadePtr = null, nadeX = 0;   // the finger on THROW: hold for power, slide it sideways to turn (one thumb aims and throws)
const putBtn = () => ({ x: Math.max(70, VW * 0.1), y: VH * 0.86, r: 26 });   // on the left, by the move stick
function doSwap(to) {
  if (state !== 'play' || !swapCan(to) || p.melee) return;
  if (isNade(to)) { startNade(to); return; }
  if (p.nade) nadeCancel();
  if (to === 'pistol') { if (reloading > 0) reloading = 0; if (equip || (pickItem && pickT > 0)) cancelPickup(); p.side.want = 'pistol'; }
  else p.side.want = null;
}
function swapStart(id, x, y) { swap = { id, t: 0, open: false, x, y }; }
function swapEnd() {
  const sw = swap; swap = null;
  if (!sw) return;
  if (!sw.open) { reloadPressed(); return; }                                    // a tap: reload, as ever
  for (const o of swapOpts()) if (Math.hypot(sw.x - o.x, sw.y - o.y) < o.r + 14) { doSwap(o.k); return; }
}
function swapStep(rdt) {                                                         // real time: the hold opens the picker even while the game is slowed
  if (swap) { swap.t += rdt; if (state !== 'play') swap.open = false; else if (!swap.open && swap.t >= SWAP.hold) swap.open = true; if (swap.id === 'key') { swap.x = ptrX; swap.y = ptrY; } }
  const want = swap && swap.open ? SWAP.k : 1;
  swapK += (want - swapK) * Math.min(1, rdt * SWAP.ease);
  return swapK;
}

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const [x, y] = localXY(e);
  if (coop && coop.open) { coopTap(x, y); return; }                            // the co-op screen takes every tap
  if (setOpen) { setTap(e.pointerId, x, y); return; }                         // the settings screen takes every tap
  if (credits) { if (Math.hypot(x - (VW - 24), y - 24) < 22) credits = null; else credits.drag = { id: e.pointerId, y, s: credits.scroll }; return; }   // the credits: X closes, drag scrolls
  if (bench) { benchTap(x, y); return; }                                       // the workbench menu takes every tap
  { const cb = creditsBtn(); if (Math.hypot(x - cb.x, y - cb.y) < cb.r + 8) { credits = { scroll: 0, drag: null }; return; } }
  { const sb = setBtn(); if (Math.hypot(x - sb.x, y - sb.y) < sb.r + 8) { setOpen = { drag: null }; return; } }
  const mb = muteBtn();
  if (Math.hypot(x - mb.x, y - mb.y) < mb.r + 8) { sndInit(); sndMute(!sndMuted); return; }
  { const cb = coopBtn(); if (coopBtnShown() && Math.hypot(x - cb.x, y - cb.y) < cb.r + 8) { coopOpen(); return; } }
  { const nb = nvgBtn(); if (nvgBtnShown() && Math.hypot(x - nb.x, y - nb.y) < nb.r + 8) { p.nvgUp = !p.nvgUp; return; } }
  if (state !== 'play' && state !== 'downed') { if (restartOK()) restart(); return; }
  const mouse = e.pointerType === 'mouse';
  if (!mouse) { touchSeen = true; tryLock(); }
  const rb = reloadBtn();
  if (bomb && bomb.near && bomb.state === 'armed' && defPtr === null) { const db = defuseBtn(); if (Math.hypot(x - db.x, y - db.y) < db.r + 8) { defPtr = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {} return; } }   // next to the bomb: hold DEFUSE
  if (nadeHeld() && state === 'play') {                                          // a grenade in hand: the button throws (press and hold for power), PUT AWAY stows it
    const pb = putBtn(); if (Math.hypot(x - pb.x, y - pb.y) < pb.r + 8) { nadeCancel(); return; }
    if (Math.hypot(x - rb.x, y - rb.y) < rb.r + 10) { if (p.nade.ph === 'ready' && nadePtr === null) { nadePress(); nadePtr = e.pointerId; nadeX = x; try { cv.setPointerCapture(e.pointerId); } catch (_) {} } return; }
  }
  if (Math.hypot(x - rb.x, y - rb.y) < rb.r + 10) { if (!swap) { swapStart(e.pointerId, x, y); try { cv.setPointerCapture(e.pointerId); } catch (_) {} } return; }
  const st = mouse ? sticks.aim : (x < VW / 2 ? sticks.move : sticks.aim);
  if (st.id !== null) return;
  st.id = e.pointerId; st.ox = st.x = x; st.oy = st.y = y;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  const [x, y] = localXY(e);
  ptrX = x; ptrY = y;
  if (setOpen) { if (setOpen.drag && setOpen.drag.id === e.pointerId) setSlide(setOpen.drag.k, x); return; }
  if (credits && credits.drag && credits.drag.id === e.pointerId) { credits.scroll = credits.drag.s - (y - credits.drag.y); return; }
  if (swap && swap.id === e.pointerId) { swap.x = x; swap.y = y; }
  if (nadePtr === e.pointerId) { turnAccum += (x - nadeX) * (e.pointerType === 'mouse' ? sets.mouse : sets.aim); nadeX = x; }   // aiming the throw with the same thumb
  for (const st of [sticks.move, sticks.aim]) if (st.id === e.pointerId) {
    if (st === sticks.aim) turnAccum += (x - st.x) * (e.pointerType === 'mouse' ? sets.mouse : sets.aim);
    st.x = x; st.y = y;
  }
});
const release = e => { if (defPtr === e.pointerId) { defPtr = null; return; } if (setOpen) { if (setOpen.drag) { saveSets(); if (setOpen.drag.k === 'res') resize(); } setOpen.drag = null; return; } if (credits) { credits.drag = null; return; } if (nadePtr === e.pointerId) { nadePtr = null; nadeRelease(); return; } if (swap && swap.id === e.pointerId) { swapEnd(); return; } for (const st of [sticks.move, sticks.aim]) if (st.id === e.pointerId) st.id = null; };
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (coop && coop.open) { if (e.code === 'Escape') coopClose(); return; }
  if (setOpen) { if (e.code === 'Escape') setOpen = null; return; }
  if (credits) { if (e.code === 'Escape') credits = null; else if (e.code === 'ArrowDown') credits.scroll += 40; else if (e.code === 'ArrowUp') credits.scroll -= 40; return; }
  if (bench) { if (e.code === 'Escape') closeBench(); else if (e.code === 'Tab' && bench.kind === 'bench') { e.preventDefault(); benchTab(bench.w === 'ak' ? 'glock' : 'ak'); } return; }
  keys[e.code] = true;
  if (e.code === 'KeyR' && !e.repeat && nadeHeld()) { nadeCancel(); return; }
  if (e.code === 'KeyG' && !e.repeat && p.nade && p.nade.ph === 'ready') nadePress();
  if (e.code === 'KeyR' && !e.repeat && !swap) swapStart('key', ptrX, ptrY);
  if (e.code === 'KeyN' && !e.repeat && nvgBtnShown()) p.nvgUp = !p.nvgUp;
  if (e.code === 'KeyX' && !e.repeat) doSwap(swapTo());
  if (e.code === 'KeyM') sndMute(!sndMuted);
  if ((e.code === 'Enter' || e.code === 'Space') && state !== 'play' && state !== 'downed' && restartOK()) restart();
});
cv.addEventListener('wheel', e => { if (credits) { e.preventDefault(); credits.scroll += e.deltaY; } }, { passive: false });
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyR' && swap && swap.id === 'key') swapEnd(); if (e.code === 'KeyG') nadeRelease(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; defPtr = null; });

function stickVec(st) {
  if (st.id === null) return { x: 0, y: 0 };
  const dx = st.x - st.ox, dy = st.y - st.oy, l = Math.hypot(dx, dy);
  if (l < 6) return { x: 0, y: 0 };
  const m = Math.min(1, l / moveR());
  return { x: dx / l * m, y: dy / l * m };
}

function resize() {
  DPR = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 2.5) * sets.res);   // the Settings resolution scales the canvas (fewer pixels to fill on a slow phone)
  const b = document.body.getBoundingClientRect();
  const bw = b.width, bh = b.height;
  rotated = bh > bw;
  if (rotated) {
    // Portrait screen: draw the game sideways so it reads as landscape.
    cv.style.position = 'absolute';
    cv.style.width = bh + 'px'; cv.style.height = bw + 'px';
    cv.style.transformOrigin = '0 0';
    if (rotDir === 1) { cv.style.left = bw + 'px'; cv.style.top = '0px'; cv.style.transform = 'rotate(90deg)'; }
    else { cv.style.left = '0px'; cv.style.top = bh + 'px'; cv.style.transform = 'rotate(-90deg)'; }
    VW = bh; VH = bw;
  } else {
    cv.style.position = ''; cv.style.left = ''; cv.style.top = ''; cv.style.transform = '';
    cv.style.width = '100%'; cv.style.height = '100%';
    VW = bw; VH = bh;
  }
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  S = Math.min(VH / 345, VW / 600);      // the view ahead (~290px moving, ~337 steady) reaches past anyone's firing range (RED_R 280, ~322 braced)
}
new ResizeObserver(resize).observe(document.body);
addEventListener('resize', resize);
resize();

