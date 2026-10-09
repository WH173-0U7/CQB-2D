/* ================= SOUND =================
   Every sound is a real recording (CC0, freesound.org; sources in CLAUDE.md, Sound), trimmed, loudness-matched and
   embedded as base64 mono MP3s (`SFX_MP3`), so the game stays one offline page. They're decoded once audio starts
   (`sndLoad` into `sndBufs`). Each play is a random take (never the same one twice running), re-pitched, with a random
   tilt of bass, treble and level (`SND.vary`), a bass shelf per kind (`SND.bass`) and the tone of its space; impacts
   sometimes get a second take under them (`SND.layer`), and gunshots a slowed, lowpassed copy for weight (`SND.boom`).
   Gunshots use indoor or outdoor recordings by where they're fired (`ak_in`/`ak_out`, `glock_in`/`glock_out`).
   Placed in the world relative to you (`sndAt`): quieter and duller with distance, muffled when a wall is between,
   panned by where it is relative to the way you face (screen left/right), late by the sound's travel time.
   Spaces (`envAt`): outdoors, small rooms, tiled rooms (restrooms, kitchen) and big rooms (lobby, lounge, restaurant)
   each have a real recorded impulse response (`IR_MP3` into the `sndVerbs` convolvers) and their own character
   (`SND.room`): how loud the dry sound is there and how much the space rings. A sound rings in the space it happens in,
   more of it the further off it is, and also in the space you're in if that's a different one.
   Audio starts on the first tap or key (browsers require it); M or the speaker button mutes (remembered in localStorage).
   `SND.maxVoices` caps how many sounds play at once.
   Sounds: gunshots (AK and Glock, `sfxShot`), impacts by material (`sfxHit`, from `impactFx`; flesh from `bleedHit`),
   ricochets (`sfxRico`), footsteps by floor (`sfxStep`: carpet, hard tile/marble, wood, concrete/street),
   reloads and mags hitting the floor (`sfxReload`, `sfxMagDrop`), casings (`sfxCase`), doors (`sfxDoor`), near misses (`sfxWhiz`). */
const SND = { vol: 0.8, maxVoices: 32, maxShots: 56,   // gunshots have their own budget: a busy firefight never drops shots for casings and footsteps
  ref: 120, gunReach: 2600, hitReach: 750,
  c: 18000,                     // speed of sound in px/s (343 m/s at ~53 px a metre): far shots arrive a beat late
  around: { k: 1.6, add: 160, cut: 2400, g: 0.75 },   // a path round through a doorway this much longer than straight: heard round the corner
  room: {                       // per space: dry level, how much it rings (times the sound's own `verb`), and the cut on that ringing
    // ...and its tone: lo/hi shelf dB on every sound there (`lo` at SND.eq.lo Hz, `hi` at SND.eq.hi Hz)
    // `ir`: which recorded impulse it rings with (default its own name), `rt`: its tail cut down to about this many s; `shot`: gunshot takes, 'in' (recorded indoors) or 'out' (dry, the room added here)
    out:    { dry: 0.85, verb: 0.16, cut: 9000, lo: 1, hi: 1.5, shot: 'out' },                 // outdoors: nothing to build the sound up, crisp, a few slaps off the facades
    small:  { dry: 1.15, verb: 0.30, cut: 6000, lo: 4, hi: -2, shot: 'in' },                   // offices, corridors, hallways: loud, short, boxy and boomy
    tile:   { dry: 1.2,  verb: 0.42, cut: 10000, lo: 2, hi: 3, shot: 'in' },                   // bathrooms, laundry, kitchens: hard and bright, rings
    hall:   { dry: 1.0,  verb: 0.45, cut: 7000, lo: 3, hi: -1, shot: 'in' },                   // lobby, lounge, restaurant: warm, a long tail
    soft:   { dry: 1.1,  verb: 0.35, cut: 4200, lo: 3, hi: -3, ir: 'small', rt: 0.35, shot: 'out' },   // bedrooms, home office, storage: carpet, bed, curtains soak it up: short and dull
    living: { dry: 1.1,  verb: 0.45, cut: 5500, lo: 3, hi: -1.5, ir: 'small', rt: 0.55, shot: 'out' }, // living and dining: wood floor, sofa, rug: a short warm room
    garage: { dry: 1.2,  verb: 0.5,  cut: 8500, lo: 2, hi: 2, ir: 'hall', rt: 1.1, shot: 'in' } },    // garage: bare concrete, rings hard
  here: 0.45,
  wall: { g: 0.33, door: 0.6, cut: 700, doorCut: 1600, verb: 1.8, boom: 1.6 },   // each wall between: this much quieter and duller (a shut door less so); the room's ring and a shot's low thump get through better
  echo: { g: 0.28, t: [0.12, 0.35], cut: 2600 },
  supp: { g: 0.5, reach: 0.45, verb: 0.5, boom: 0.35 },   // a suppressed AK (your rifle with the can on, `aks` takes): quieter, carries less far, rings less, less thump   // outdoors a shot also slaps back off the houses around                   // how much a sound also rings in the space you're in, when that's another one
  lv: {},                       // level per sound kind (filled below), on top of sndAt's loudness
  pitch: 0.05,                  // random re-pitch either way
  even: 5,                      // takes within a set are levelled toward each other by up to this many dB (sndEvenUp)
  evenShot: 9,                  // ...and gunshot takes by their crack, by up to this much, so one shot isn't much louder than the next
  ownStep: 0.85,                // your own footsteps relative to someone else's at the same spot
  vary: { lo: 2, hi: 2.5, g: 1.5 },   // and random tone (shelf dB) and level (dB) either way, so no two plays sound alike
  eq: { lo: 160, hi: 3200 },
  bass: { shot: 6, far: 5, spark: 2, helmet: 3, plate: 4, drywall: 5, concrete: 5, wood: 5, soft: 4, glass: 0, flesh: 5, rico: 0, st: 4 },   // low shelf dB per kind
  boom: { cut: 150, rate: 0.55, out: 0.55, in: 0.9 },   // gunshots: the same take slowed and lowpassed underneath for weight (more indoors)
  layer: { p: 0.35, g: 0.4, keys: 'drywall concrete wood plate glass flesh soft' },   // chance an impact gets a second take under it (debris, a different crack)
  reload: { ak: [[0.12, 'r_out'], [0.72, 'r_in'], [0.85, 'r_rack']], glock: [[0.15, 'p_out'], [0.8, 'p_in'], [0.92, 'p_slide']],   // sounds along each reload (fraction of it)
    loud: 0.45, reach: 380, drop: 0.28 },   // the old mag hits the floor this long after it's let go
  cases: { reach: 420, gap: 0.03, hops: 3 },   // casings: heard this far, at most one every `gap` s, only their first few bounces
  door: { reach: 600, shutAt: 0.3, creakW: 2.5 },     // a door that had swung past shutAt rad and comes back shut bangs, by how fast it came; a creak is at full level from creakW rad/s
  whiz: { r: 120, loud: 0.9 },           // rounds passing within r px of you whiz (supersonic AK) or flutter (9 mm) by
  inVerb: 0.55, inMix: 0.6,          // inMix: share of AK shots in bare rooms played from the dry takes with the room added (only two indoor AK recordings exist)
  refl: { reach: 1400, g: [0.12, 0.3], cut: [1800, 6500] },   // early reflections: level and lowpass from carpet to tile
                  // indoor shot takes carry their own room: they send this much less into the reverb
  far: { from: 500, full: 1500 } };   // gunshots crossfade into the distant take over this range (px)
Object.assign(SND.lv, {   // levels measured in the browser with the game paused (nothing else playing): impacts match the old synthesized mix;
  // footsteps sit about 14 dB under an AK at the same spot (tile/marble > wood > street > carpet)
  r_out: 0.5, r_in: 0.6, r_rack: 0.5, p_out: 0.45, p_in: 0.5, p_slide: 0.5, magdrop: 0.4, case_hard: 0.3, case_wood: 0.3,
  door_creak: 0.4, door_latch: 0.4, door_shut: 0.6, door_squeak: 0.35, whiz: 0.9, whiz_sub: 0.7,
  ak_out: 0.9, aks: 0.8, ak_in: 0.55, glock_out: 0.9, glock_in: 0.6, far: 1.1, rico: 0.89,
  spark: 0.3, helmet: 0.4, plate: 0.69, drywall: 0.16, concrete: 0.13, wood: 0.2, soft: 0.066, glass: 0.26, flesh: 0.36,
  st_soft: 0.28, st_wood: 0.51, st_grit: 0.65, st_hard: 0.94, st_glass: 0.75, st_grass: 0.45,
  g_velcro: 0.45, g_buckle: 0.5, g_cloth: 0.4, g_mag: 0.5, g_helmet: 0.45,
  vp_us: 0.8, vp_ir: 0.8, vd_us: 0.9, vd_ir: 0.9, vg_us: 0.6, vg_ir: 0.6, vl: 0.45, vk_p: 0.8, vk_a: 0.8, vk_ir0: 0.75, vk_ir1: 0.75, cd_f: 0.85, cd_m: 0.85, cg_f: 0.6 });   // spoken hurt lines (vh_*) come back when there are real recordings
SND.gear = { loud: 0.4, reach: 300,                 // gear going on (fraction of EQUIP[kind].T), [f, key, only if an old piece comes off]
  mag: [[0.55, 'g_mag'], [0.85, 'g_velcro']],                                                     // into a chest pouch, flap shut
  helmet: [[0.25, 'g_buckle', 1], [0.38, 'g_helmet', 1], [0.6, 'g_helmet'], [0.88, 'g_buckle']],  // unclip, old one off, new one on, chin strap
  plate: [[0.08, 'g_velcro'], [0.32, 'g_cloth', 1], [0.55, 'g_cloth'], [0.74, 'soft'], [0.92, 'g_velcro']] };   // flap open, old plate out, new one slid in and seated, flap shut
const VOX = { hurt: { p: 0.7, cd: 1.3, spoken: 0,   // spoken: share of hits that get a line (vh_*) instead of a grunt; 0 until real recordings
  loud: 0.8, reach: 900 }, die: { loud: 0.95, reach: 1100 },
  kill: { p: 0.5, cd: 4,   // p: chance of a line after killing an enemy soldier (vk_p you, vk_a your teammate, vk_ir the enemy: a laugh, no Persian recordings yet)
  delay: [0.5, 1.1], loud: 0.75, reach: 800 },
  groan: { loud: 0.55, reach: 650, first: [1.0, 1.8], gap: [0.8, 1.7], weak: 1.2, quiet: 0.35, lp: 1400 },   // bleeding out: a groan every gap s, the gaps up to (1 + weak) times longer and the groans down to `quiet` and duller (lp Hz) near the end
  last: { loud: 0.5, reach: 500 },   // the last breath when a downed body dies
  civ: { loud: 0.95, reach: 1100 } };   // a civilian shot: a woman's or a man's scream (cd_f / cd_m)
//@@SOUNDS@@
let sndBufs = null, sndLast = {};
let AC = null, sndOut = null, sndVoices = 0, sndMuted = false, sndVerbs = null, sndRoutes = new Map(), sndRouteT = 0;
try { sndMuted = localStorage.getItem('ds_mute') === '1'; } catch (_) {}
let sndDeafLP = null, sndComp = null;
function sndInit() {
  if (AC) { if (AC.state !== 'running' && AC.state !== 'closed' && AC.resume) AC.resume().catch(() => {}); return; }   // suspended, or iOS 'interrupted' after a call or Siri
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try { AC = new C(); } catch (_) { AC = null; return; }
  const comp = AC.createDynamicsCompressor();                 // keeps a firefight from clipping
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.25;
  sndOut = AC.createGain(); sndOut.gain.value = sndMuted ? 0 : SND.vol * sets.vol;
  sndDeafLP = AC.createBiquadFilter(); sndDeafLP.type = 'lowpass'; sndDeafLP.frequency.value = 20000; sndDeafLP.Q.value = 0.5;   // deafened by a blast: everything muffled (see GRENADES)
  sndOut.connect(sndDeafLP); sndDeafLP.connect(comp); comp.connect(AC.destination); sndComp = comp;
  sndVerbs = {};
  for (const k in SND.room) {                                 // each space: its ringing, dulled a little, into the mix (silent until its impulse decodes)
    const cv = AC.createConvolver(), lp = AC.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = SND.room[k].cut; lp.Q.value = 0.5;
    cv.connect(lp); lp.connect(sndOut); sndVerbs[k] = cv;
  }
  sndLoad();
  if (AC.state === 'suspended' && AC.resume) AC.resume().catch(() => {});
}
function irShape(buf, rt) {                                       // a recorded room's tail cut down to about rt s (60 dB), for smaller, softer rooms
  if (!rt) return buf;
  const n = Math.min(buf.length, Math.ceil(rt * 1.2 * buf.sampleRate)), out = AC.createBuffer(buf.numberOfChannels, n, buf.sampleRate), k = -6.9 / (rt * buf.sampleRate);
  let pk = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const a = buf.getChannelData(c), o = out.getChannelData(c); for (let i = 0; i < n; i++) { o[i] = a[i] * Math.exp(k * i); pk = Math.max(pk, Math.abs(o[i])); } }
  const sc = pk ? 0.5 / pk : 1;
  for (let c = 0; c < out.numberOfChannels; c++) { const o = out.getChannelData(c); for (let i = 0; i < n; i++) o[i] *= sc; }
  return out;
}
function sndDecode(b64, ok) {                                    // base64 MP3 -> AudioBuffer (callback form too, for older Safari)
  try {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const good = buf => { if (buf) ok(buf); }, bad = () => {};
    const pr = AC.decodeAudioData(u.buffer, good, bad);
    if (pr && pr.catch) pr.catch(bad);
  } catch (_) {}
}
const sndTakeG = new Map();                                      // per take: a nudge toward the rest of its set's level
function sndEvenUp(k) {                                          // once a set has decoded: bring each take up to +-SND.even dB of the set's median energy (every 4th sample is plenty)
  const shot = /^(ak|glock|far)/.test(k), dB = shot ? SND.evenShot : SND.even;   // gunshots: matched by the crack (the first 80 ms), not the tail, so indoor takes keep their longer ring
  const E = sndBufs[k].map(b => { let e = 0; const n = shot ? Math.min(b.length, b.sampleRate * 0.08 | 0) : b.length; for (let c = 0; c < b.numberOfChannels; c++) { const a = b.getChannelData(c); for (let i = 0; i < n; i += 4) e += a[i] * a[i]; } return e / b.numberOfChannels; });
  const med = E.slice().sort((a, b) => a - b)[E.length >> 1];
  sndBufs[k].forEach((b, i) => sndTakeG.set(b, clamp(Math.sqrt(med / (E[i] || med)), Math.pow(10, -dB / 20), Math.pow(10, dB / 20))));
}
function sndLoad() {                                             // unpacked a few at a time (a few ms per slice) so the first tap doesn't hitch; gunshots first
  sndBufs = {};
  const q = [];
  for (const k in SFX_MP3) { sndBufs[k] = []; for (const b64 of SFX_MP3[k]) q.push(() => sndDecode(b64, buf => { sndBufs[k].push(buf); if (sndBufs[k].length === SFX_MP3[k].length) sndEvenUp(k); })); }
  for (const k in IR_MP3) q.push(() => sndDecode(IR_MP3[k], buf => { for (const r in SND.room) if ((SND.room[r].ir || r) === k) sndVerbs[r].buffer = irShape(buf, SND.room[r].rt); }));
  const slice = () => { const t0 = performance.now(); while (q.length && performance.now() - t0 < 4) q.shift()(); if (q.length) setTimeout(slice, 16); };
  slice();
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, sndInit, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && AC) sndInit(); });   // back from another app: pick the sound back up
function sndMute(m) {
  sndMuted = m;
  if (sndOut) sndOut.gain.setTargetAtTime(m ? 0 : SND.vol * sets.vol, AC.currentTime, 0.03);
  try { localStorage.setItem('ds_mute', m ? '1' : '0'); } catch (_) {}
}
/* Sound is something you listen for: rings for noises, and edge markers for gunfire you only heard, show only while the
   game is muted (M or the speaker button), as a visual-sound mode for playing without sound. */
const soundVis = () => sndMuted;
const muteBtn = () => ({ x: VW - 30, y: 28, r: 17 });
/* What kind of place a spot is, for its acoustics: outdoors (sidewalk, red carpet, street, yards), or indoors small or
   large by how far 16 rays reach before a wall. Cached per tile for the current map. */
let envMap = null, envTiles = null;
function envAt(x, y) {
  if (envMap !== MAP) { envMap = MAP; envTiles = new Array(W * H); }
  const i = clamp(Math.floor(x / T), 0, W - 1), j = clamp(Math.floor(y / T), 0, H - 1), k = j * W + i;
  if (envTiles[k]) return envTiles[k];
  let e = 'hall';
  if (OUTDOOR.includes(floorAt[k])) e = 'out';
  else if (MAP.gen && 'bolnzkw'.includes(floorAt[k])) e = { b: 'soft', o: 'soft', l: 'living', n: 'tile', k: 'tile', w: 'small', z: 'garage' }[floorAt[k]];   // a home's rooms by what they are
  else { const cx = (i + 0.5) * T, cy = (j + 0.5) * T; let sum = 0; for (let n = 0; n < 16; n++) { const a = n / 16 * Math.PI * 2; sum += lightCast(cx, cy, Math.cos(a), Math.sin(a), 500); } e = sum / 16 < 125 ? ('ukn'.includes(floorAt[k]) ? 'tile' : 'small') : 'hall'; }
  return (envTiles[k] = e);
}
/* Walls (n) and shut doors or windows (d) on the straight line between two points: each run of blocking tiles counts once. */
function wallsBetween(x0, y0, x1, y1) {
  const L = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(L / 8);
  let n = 0, d = 0, prev = -1;
  for (let i = 1; i < steps; i++) {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps, k = Math.floor(y / T) * W + Math.floor(x / T);
    if (k === prev) continue;
    const on = opq[k] === 1 || solidAt[k] === 'G';
    if (on && !(prev >= 0 && (opq[prev] === 1 || solidAt[prev] === 'G'))) { if (doorAt[k] >= 0 || solidAt[k] === 'G') d++; else n++; }
    prev = k;
  }
  return { n: Math.min(n, 4), d: Math.min(d, 3) };
}
/* How a sound gets from (x, y) to you when a wall is in the way: round a doorway along the floor (a little muffled,
   coming from the opening) if that path isn't much longer than straight through, otherwise through the wall (dull).
   Cached per pair of tiles for half a second. */
function sndRoute(x, y, d) {
  if (AC.currentTime - sndRouteT > 0.5) { sndRoutes.clear(); sndRouteT = AC.currentTime; }
  const key = (Math.floor(y / T) * W + Math.floor(x / T)) * 4096 + Math.floor(p.y / T) * W + Math.floor(p.x / T);
  let r = sndRoutes.get(key);
  if (r) return r;
  r = { via: null, L: d };
  const path = findPath(p.x, p.y, x, y);
  if (path.length) {
    let L = 0, px0 = p.x, py0 = p.y; for (const q of path) { L += Math.hypot(q.x - px0, q.y - py0); px0 = q.x; py0 = q.y; }
    L += Math.hypot(x - px0, y - py0);
    if (L < d * SND.around.k + SND.around.add) {
      let vis = path[0]; for (const q of path) { if (!losClear(p.x, p.y, q.x, q.y)) break; vis = q; }
      r = { via: vis, L };
    }
  }
  sndRoutes.set(key, r);
  return r;
}
/* A voice at world (x, y): a gain/filter/pan chain into the mix with the right room's acoustics, or null if it can't be
   heard (or too much is playing). `t` already includes the travel time of the sound. */
const sndShotQ = [];                                              // live gunshot voices, oldest first: { gn, end } (end on the audio clock)
function sndAt(x, y, loud, reach, dur, verb, shot) {
  if (!AC || sndMuted || AC.state !== 'running' || (!shot && sndVoices >= SND.maxVoices)) return null;
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
  if (d >= reach) return null;
  let L = d, ax = x, ay = y, g = 1, cut = 18000, thru = 0;
  if (d > 24 && !losClear(p.x, p.y, x, y)) {
    const r = sndRoute(x, y, d);
    if (r.via) { L = r.L; ax = r.via.x; ay = r.via.y; g = SND.around.g; cut = SND.around.cut; }   // round the corner: from the opening
    else { const w = wallsBetween(p.x, p.y, x, y); thru = w.n + w.d || 1; g = Math.pow(SND.wall.g, w.n) * Math.pow(SND.wall.door, w.d) * (w.n + w.d ? 1 : SND.wall.g); cut = w.n ? SND.wall.cut / (1 + 0.5 * (w.n - 1)) : SND.wall.doorCut; }   // straight through: each wall (or shut door) quieter and duller
  }
  if (L >= reach) return null;
  const env = envAt(x, y), here = envAt(p.x, p.y);
  g *= loud * SND.room[env].dry * Math.pow(1 - L / reach, 1.5) / (1 + L / SND.ref);
  cut = Math.min(cut, 22000 / (1 + L / 160));
  if (g < 0.004) return null;
  const t = AC.currentTime + 0.005 + L / SND.c, gn = AC.createGain(), lp = AC.createBiquadFilter(), pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
  gn.gain.value = g; lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.5;
  if (thru) { const l2 = AC.createBiquadFilter(); l2.type = 'lowpass'; l2.frequency.value = cut * 1.4; l2.Q.value = 0.6; gn.connect(l2); l2.connect(lp); }   // a wall cuts the top off steeply
  else gn.connect(lp);
  const adx = ax - p.x, ady = ay - p.y;
  if (pn) { pn.pan.value = clamp(Math.sin(angDiff(Math.atan2(ady, adx), p.aim)) * Math.min(1, Math.hypot(adx, ady) / 80), -0.9, 0.9); lp.connect(pn); pn.connect(sndOut); }
  else lp.connect(sndOut);
  if (verb && sndVerbs) {                                        // the space it happens in rings, more of it further off; so does yours, if that's another
    const vg = AC.createGain();
    vg.gain.value = SND.room[env].verb * verb * (0.55 + 1.1 * L / reach) * (thru ? SND.wall.verb : 1); lp.connect(vg); vg.connect(sndVerbs[env]);
    if (here !== env) { const hg = AC.createGain(); hg.gain.value = SND.here * SND.room[here].verb * verb; lp.connect(hg); hg.connect(sndVerbs[here]); }
  }
  if (shot) {                                                    // gunshots are never refused: with the budget full, the oldest shot's tail fades out to make room
    const now = AC.currentTime; while (sndShotQ.length && sndShotQ[0].end < now) sndShotQ.shift();
    if (sndShotQ.length >= SND.maxShots) sndShotQ.shift().gn.gain.setTargetAtTime(0, now, 0.015);
    sndShotQ.push({ gn, end: t + dur + 0.1 });
  } else { sndVoices++; setTimeout(() => sndVoices--, (dur + 0.1 + L / SND.c) * 1000); }
  return { o: gn, t, env, d: L, thru };
}
const rv = (k = 0.12) => 1 - k + Math.random() * k * 2;       // a little variation every time
/* One take of `key` into voice `v` (from sndAt) at level g: a random recording (not the last one played), re-pitched,
   with a random tilt of tone and level, the bass shelf for its kind and the tone of the space it's in. `lp` lowpasses it
   (the boom layer). */
function sndPlay(v, key, g, rate = rv(SND.pitch), dt = 0, lp = 0, lite = false) {   // lite: no tone shelves (the boom, reflections and echo under a shot: fewer nodes)
  const set = sndBufs && sndBufs[key];
  if (!set || !set.length || g < 0.005) return;
  let i = Math.floor(Math.random() * set.length);
  if (set.length > 1 && i === sndLast[key]) i = (i + 1) % set.length;
  sndLast[key] = i;
  const V = SND.vary, rm = SND.room[v.env], kind = key.startsWith('st_') ? 'st' : key.split('_')[0];
  const src = AC.createBufferSource(), lo = lite ? null : AC.createBiquadFilter(), hi = lite ? null : AC.createBiquadFilter(), gn = AC.createGain();
  src.buffer = set[i]; src.playbackRate.value = rate * Math.max(0.5, Math.sqrt(timeK));   // slower and deeper in slow motion
  if (!lite) { lo.type = 'lowshelf'; lo.frequency.value = SND.eq.lo; lo.gain.value = (SND.bass[kind === 'ak' || kind === 'aks' || kind === 'glock' ? 'shot' : kind] || 0) + rm.lo + (Math.random() * 2 - 1) * V.lo;
  hi.type = 'highshelf'; hi.frequency.value = SND.eq.hi; hi.gain.value = rm.hi + (Math.random() * 2 - 1) * V.hi; }
  gn.gain.value = g * (SND.lv[key] || 1) * (sndTakeG.get(set[i]) || 1) * Math.pow(10, (Math.random() * 2 - 1) * V.g / 20) * (lite ? Math.pow(10, ((SND.bass[kind === 'ak' || kind === 'aks' || kind === 'glock' ? 'shot' : kind] || 0) + rm.lo) / 40) : 1);   // lite: half the shelf's lift, flat
  const head = lite ? src : hi;
  if (!lite) { src.connect(lo); lo.connect(hi); }
  if (lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.7; head.connect(f); f.connect(gn); }
  else head.connect(gn);
  gn.connect(v.o); src.start(v.t + dt);
  return { src, gn };
}
/* How big the space round a spot is (average reach of 16 rays, px) and how hard its floor is (0 carpet .. 1 tile),
   cached per tile per map: a shot's early reflections come back after the round trip to the walls, brighter and louder
   off hard floors and walls, duller off carpet. */
let roomMap = null, roomCache = null;
const HARD_FLOOR = { k: 1, n: 1, u: 1, m: 1, z: 0.9, e: 0.9, w: 0.75, l: 0.75, s: 0.8, a: 0.8, R: 0.4, M: 0.35, o: 0.25, r: 0.25, b: 0.15, v: 0.3 };
function roomAt(x, y) {
  if (roomMap !== MAP) { roomMap = MAP; roomCache = new Array(W * H); }
  const i = clamp(Math.floor(x / T), 0, W - 1), j = clamp(Math.floor(y / T), 0, H - 1), k = j * W + i;
  if (roomCache[k]) return roomCache[k];
  const cx = (i + 0.5) * T, cy = (j + 0.5) * T; let sum = 0, mx = 0;
  for (let n = 0; n < 16; n++) { const a = n / 16 * Math.PI * 2, d = lightCast(cx, cy, Math.cos(a), Math.sin(a), 700); sum += d; mx = Math.max(mx, d); }
  return (roomCache[k] = { size: sum / 16, far: mx, hard: HARD_FLOOR[floorAt[k]] !== undefined ? HARD_FLOOR[floorAt[k]] : 0.6 });
}
function sfxShot(x, y, kind) {                                    // a recorded shot (indoor or outdoor takes by where it's fired), a slowed boom under it; far off it crossfades into the distant take
  const sup = kind === 'aks', ak = kind !== 'glock', env = envAt(x, y), out = env === 'out';
  const dryTake = SND.room[env].shot === 'out' || (ak && !sup && Math.random() < SND.inMix);   // furnished rooms (and, for variety, many shots in bare ones) use the dry AK takes and ring with their own room
  const S = SND.supp, v = sndAt(x, y, (ak ? 1 : 0.8) * (sup ? S.g : 1), SND.gunReach * (sup ? S.reach : 1), 1.8, (dryTake ? 1 : SND.inVerb) * (sup ? S.verb : 1), true);
  if (!v) return;
  const far = sup ? 0 : clamp((v.d - SND.far.from) / (SND.far.full - SND.far.from), 0, 1), key = (ak ? 'ak' : 'glock') + (dryTake ? '_out' : '_in'), r = rv(SND.pitch);
  const wk = v.thru ? 0.7 : 1;                                     // through a wall: less crack, more thump
  sndPlay(v, sup ? 'aks' : key, Math.sqrt(1 - far) * wk, r);       // suppressed: the AK takes with the blast cut to a thump, the supersonic crack kept
  sndPlay(v, sup ? 'aks' : key, (out ? SND.boom.out : SND.boom.in) * (ak ? 1 : 0.7) * (v.thru ? SND.wall.boom : 1) * (sup ? S.boom : 1), r * SND.boom.rate, 0, SND.boom.cut);
  if (far > 0) sndPlay(v, 'far', (ak ? 1 : 0.75) * Math.sqrt(far), rv(SND.pitch) * (ak ? 1 : 1.15));
  if (!out && v.d < SND.refl.reach) {                                       // indoors: the first reflections off the walls, timed by the room's size, coloured by its floor
    const R = roomAt(x, y), Rf = SND.refl, cut = Rf.cut[0] + (Rf.cut[1] - Rf.cut[0]) * R.hard;
    const g0 = (Rf.g[0] + (Rf.g[1] - Rf.g[0]) * R.hard) * (sup ? S.verb : 1) * (ak ? 1 : 0.8) * (v.thru ? 0.6 : 1);
    sndPlay(v, sup ? 'aks' : key, g0, r * 0.98, 2 * R.size / SND.c, cut, true);
    sndPlay(v, sup ? 'aks' : key, g0 * 0.6, r * 0.96, 2 * R.far / SND.c + 0.004, cut * 0.8, true);
  }
  if (!sup && (out || envAt(p.x, p.y) === 'out')) {                         // outside, it slaps back off the houses around a beat later
    const E = SND.echo;
    sndPlay(v, 'far', E.g * (ak ? 1 : 0.7), rv(SND.pitch) * (ak ? 1 : 1.15), E.t[0] + Math.random() * (E.t[1] - E.t[0]), E.cut, true);
  }
}
function sfxHit(kind, x, y) {                                     // a round striking something, by material (`impactFx` kinds, or 'flesh'), sometimes with a second take under it
  const v = sndAt(x, y, 0.75, SND.hitReach, kind === 'glass' ? 1 : 0.6, 0.4);
  if (!v) return;
  const k = SFX_MP3[kind] ? kind : 'concrete';
  sndPlay(v, k, 1);
  if (SND.layer.keys.includes(k) && Math.random() < SND.layer.p) sndPlay(v, k, SND.layer.g, rv(0.15) * 0.85, 0.008 + Math.random() * 0.03);
}
function sfxRico(x, y) {                                          // a round skipping off and whining away
  const v = sndAt(x, y, 0.4, SND.hitReach, 1.1, 0.5);
  if (v) sndPlay(v, 'rico', 1, rv(0.12));
}
function sfxReload(c, gun, f0, f1) {                             // the sounds of a reload between progress f0 and f1 (AK or Glock)
  for (const [f, key] of SND.reload[gun]) if (f0 < f && f1 >= f) {
    const v = sndAt(c.x, c.y, SND.reload.loud, SND.reload.reach, 0.6, 0.25);
    if (v) sndPlay(v, key, 1);
  }
}
function sfxMagDrop(x, y, pistol) {                               // an empty mag clattering on the floor, a beat after it's let go
  const v = sndAt(x, y, SND.reload.loud, SND.reload.reach, 0.7, 0.3);
  if (v) sndPlay(v, 'magdrop', 1, rv(0.08) * (pistol ? 1.25 : 1), SND.reload.drop);
}
/* Gear: sounds along a pickup or a piece going on (fraction of EQUIP[kind].T), like a reload. `old`: only when a piece
   comes off first. Grabbing loot off the floor rustles; a mag going into a pouch clacks. */
function sfxGear(c, kind, f0, f1, hadOld) {
  for (const [f, key, old] of SND.gear[kind]) if (f0 < f && f1 >= f && (!old || hadOld)) {
    const v = sndAt(c.x, c.y, SND.gear.loud, SND.gear.reach, 0.5, 0.2);
    if (v) sndPlay(v, key, 1);
  }
}
function sfxGrab(c, kind) { const v = sndAt(c.x, c.y, SND.gear.loud, SND.gear.reach, 0.5, 0.2); if (v) sndPlay(v, kind === 'mag' ? 'g_mag' : kind === 'helmet' ? 'g_helmet' : 'g_cloth', 0.8); }
/* Voices (VOX): soldiers grunt when a round hits their armour, scream when they go down or die, and now and then throw a
   short line after killing an enemy soldier. Americans (you, the ally) and Iranians (the enemy) have their own voices
   and lines (`c.vox`: side, which Persian voice, a pitch of their own). Bystanders have no voice yet. */
function voxOf(c) {
  if (!c.vox) { const us = c === p || !!c.ally, fem = !!(c.civ && c.look && (c.look.fem || c.look.kind === 'dress'));
    c.vox = { us, fem, n: Math.random() < 0.5 ? 0 : 1, pitch: c === p ? 1 : us ? 0.92 : 0.94 + Math.random() * 0.12, t: -9 }; }
  return c.vox;
}
function sayAt(c, key, V, dt = 0) {
  const v = sndAt(c.x, c.y, V.loud, V.reach, 1.2, 0.5);
  if (v) sndPlay(v, key, 1, voxOf(c).pitch * rv(0.03), dt);
}
function sfxVoice(c, kind) {
  if (!c || c.officer) return;
  const o = voxOf(c), side = o.us ? 'us' : 'ir';
  if (c.civ) { if (kind === 'die' || simT - o.t > 1.5) { o.t = simT; sayAt(c, o.fem ? 'cd_f' : 'cd_m', VOX.civ); } return; }   // a civilian shot screams, a woman or a man
  if (kind === 'hurt') {
    if (simT - o.t < VOX.hurt.cd || Math.random() > VOX.hurt.p) return;
    o.t = simT; sayAt(c, Math.random() < VOX.hurt.spoken ? 'vh_' + side + (o.us ? '' : o.n) : 'vp_' + side, VOX.hurt);
  } else if (kind === 'die') { o.t = simT; sayAt(c, 'vd_' + side, VOX.die); }
}
/* Bleeding out: a downed soldier groans and moans the whole time, weaker, duller and further apart as the life drains
   out (`life` 1 -> 0), from where the body lies; none right on top of a scream. The last breath when it dies. */
function sfxGroan(rg, life) {
  const c = rg.c; if (!c || c.officer) return;
  const o = voxOf(c), V = VOX.groan, h = rg.pts[0];
  if (simT - o.t < 1.2) return;
  const v = sndAt(h.x, h.y, V.loud * (V.quiet + (1 - V.quiet) * life), V.reach, 2.5, 0.5);
  if (v) sndPlay(v, o.fem ? 'cg_f' : o.us || c.civ ? 'vg_us' : 'vg_ir', 1, o.pitch * rv(0.04), 0, life < 0.5 ? V.lp + life * 2 * 4000 : 0);   // a civilian man groans in the American voice, at his own pitch
}
function sfxLastBreath(rg) {
  const c = rg.c; if (!c || c.officer) return;
  const o = voxOf(c), h = rg.pts[0], v = sndAt(h.x, h.y, VOX.last.loud, VOX.last.reach, 1.2, 0.4);
  if (v) { if (o.fem) sndPlay(v, 'cg_f', 0.45, o.pitch * rv(0.04), 0, 900); else sndPlay(v, 'vl', 1, o.pitch * rv(0.04)); }   // a woman's last breath: her own voice, faint
}
const voxQ = [];                                                   // lines waiting to be said (game time), dropped if the speaker's gone
function voxKill(killer, victim) {
  if (!killer || killer.civ || !victim || victim.civ) return;
  const a = voxOf(killer), b = voxOf(victim);
  if (a.us === b.us || Math.random() > VOX.kill.p || simT - (a.k || -9) < VOX.kill.cd) return;   // only enemies, not every time
  a.k = simT; voxQ.push({ c: killer, t: simT + rnd(VOX.kill.delay) });
}
function voxStep() {
  for (let i = voxQ.length - 1; i >= 0; i--) {
    const q = voxQ[i]; if (simT < q.t) continue;
    voxQ.splice(i, 1);
    const c = q.c, alive = c === p ? state === 'play' : !c.dead;
    if (alive && sets.taunts) { const o = voxOf(c); sayAt(c, c === p ? 'vk_p' : o.us ? 'vk_a' : 'vk_ir' + o.n, VOX.kill); }
  }
}
let sndCaseT = 0;
function sfxCase(d, g, wall) {                                    // brass bouncing: rings on tile and concrete, knocks on wood, dull on carpet
  if (!AC || d.hops > SND.cases.hops || AC.currentTime - sndCaseT < SND.cases.gap) return;
  const v = sndAt(d.x, d.y, 0.5 * g, SND.cases.reach, 0.3, 0.2);
  if (!v) return;
  sndCaseT = AC.currentTime;
  const sf = d.z > 0.5 ? 'wood' : STEP_SURF[floorAt[Math.floor(d.y / T) * W + Math.floor(d.x / T)]] || 'hard';
  const r = rv(0.1) * (d.size < 1 ? 1.2 : 1);                     // 9 mm brass is smaller and higher
  if (wall || sf === 'hard' || sf === 'grit') sndPlay(v, 'case_hard', 1, r);
  else { const sft = sf === 'soft' || sf === 'grass'; sndPlay(v, 'case_wood', sft ? 0.5 : 1, r, 0, sft ? 1800 : 0); }
}
function sfxDoor(x, y, key, g) {                                  // a door: the latch giving, a creak as it swings, or banging shut
  const v = sndAt(x, y, g, SND.door.reach, key === 'door_creak' || key === 'door_squeak' ? 1.3 : 0.7, 0.5);
  return v ? sndPlay(v, key, 1, rv(0.06)) : null;
}
/* A creak or squeak lasts only as long as the leaf swings: its level follows the leaf's speed, and it fades out and stops once the leaf stops or bangs. */
function creakStep(l, dt) {
  const c = l.cv;
  if (!c) return;
  if (!AC || !c.gn) { l.cv = null; return; }
  const k = clamp(Math.abs(l.w) / SND.door.creakW, 0, 1);
  c.still = k < 0.12 ? c.still + dt : 0;
  if (c.still > 0.08 || simT - c.t0 > 1.4) { creakStop(l); return; }
  c.gn.gain.setTargetAtTime(c.g0 * (0.25 + 0.75 * k), AC.currentTime, 0.04);
}
function creakStop(l) {
  const c = l.cv;
  l.cv = null;
  if (!c || !AC) return;
  try { c.gn.gain.cancelScheduledValues(AC.currentTime); c.gn.gain.setTargetAtTime(0, AC.currentTime, 0.03); c.src.stop(AC.currentTime + 0.15); } catch (e) {}
}
function sfxWhiz(x, y, k, pistol) {                               // a round passing close: the crack and whiz of a supersonic AK round, or a 9 mm's flutter
  const v = sndAt(x, y, SND.whiz.loud * k, SND.whiz.r * 2, 0.5, 0.1);
  if (v) sndPlay(v, pistol ? 'whiz_sub' : 'whiz', 1, rv(0.12));
}
const STEP_SURF = { o: 'soft', r: 'soft', R: 'soft', M: 'soft', b: 'soft', v: 'grass', w: 'wood', l: 'wood', z: 'grit', s: 'grit', a: 'grit' };
function sfxStep(x, y, amt, reach, own) {                         // a boot on this floor (and a crunch where glass lies)
  const v = sndAt(x, y, (0.16 + 0.24 * amt) * (own ? SND.ownStep : 1), reach, 0.3, 0.15);
  if (!v) return;
  const sf = STEP_SURF[floorAt[Math.floor(y / T) * W + Math.floor(x / T)]] || 'hard';
  sndPlay(v, 'st_' + sf, 1, rv(0.08));
  const gl = glassAt(x, y, 10);                                    // glass on the floor here: it crunches
  if (gl) sndPlay(v, 'st_glass', Math.min(1, 0.4 + gl * 0.15), rv(0.08), Math.random() * 0.012);
}

