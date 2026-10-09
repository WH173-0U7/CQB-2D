/* ================= TUNING ================= */
const CONE_HALF = 0.5;     // half-angle of flashlight (rad)
const CONE_R    = 300;        // flashlight range (and everyone's sight)
const AWARE_R   = 45;      // close enough to sense someone right beside you, even in the dark
/* Cone of fire: tightens when you stand still, widens when you move or keep firing. */
const STILL_HALF  = 0.08;   // half-angle (rad) just after you stop
const STEADY_HALF = 0.05;   // half-angle once fully steadied
const MOVE_HALF   = 0.17;   // half-angle at full walking speed
const MAX_HALF    = 0.34;   // widest it can ever get
const BLOOM = { add: 0.03, decay: 0.15, max: 0.18 };   // extra width per shot, recovery per second, cap
/* The cone also drifts and kicks: wobble grows with instability, each shot kicks it sideways. */
/* Arms hold the gun on a spring. Turning drags the gun behind and it swings past when you stop,
   footsteps rock it, shots kick it, standing still braces the arms so it settles. The red cone is
   wherever the gun actually points, and a swinging gun is a less accurate gun. */
const ARMS = {
  k: 60, kSteady: 170,      // spring stiffness: how hard the arms pull the gun back onto your aim (braced when steady)
  c: 6, cSteady: 14,        // damping: low = swings past and back, high = settles cleanly
  lag: 0.35,                // share of each turn the gun's weight drags behind the body
  step: 1.5,                // sideways rock per footstep at full speed (rad/s)
  recoil: [1.0, 2.2],       // sideways kick per shot (rad/s)
  tremor: 0.15,             // unbraced hands shake a little
  velWiden: 0.045,          // the faster the gun is swinging, the wider the cone (rad per rad/s)
  maxSway: 0.45,            // the arms can't swing further than this (rad)
  bodyFollow: 0.35          // shoulders turn this much with the gun; the arms take the rest
};
/* Cover: everyone feels for walls beside them, low cover or a corner edge in front.
   - Hug a wall and you lean into it and settle against it; your shoulder braces on it.
   - Rest the rifle on a corner, counter, car, sofa or window sill: the support hand plants on it and the gun barely moves.
   - The rifle goes on the shoulder away from the cover (cover on your right -> left shoulder), like real CQB,
     so less of you sticks out. Switching takes a moment and you can't fire mid-switch.
   - The steadying only counts once you've stopped, and fully only on the right shoulder. */
const COVER = { side: 12, front: 30, edge: 40, mountK: 1.3, mountRecoil: 0.55, mountCone: 0.35, switchTime: 0.35, hold: 0.4,
  contact: 7, duck: 0.8, duckSpeed: 0.65 };
const CROUCH = { k: 110, c: 13, dip: 1.12, hunch: 3.4, blade: 0.12, round: 0.09 };   // duck spring (stiffness, damping, how far past full it dips); the look: hunch forward, turn toward the rifle side, round the shoulders   // touching within 7px = in cover; how low they duck; how fast they creep while ducked
/* Peeking: standing still with the view blocked close ahead (within `block` px) but open from a point `dist` px to one side
   (by at least `gain` px more) → the upper body leans out past the edge while the boots stay planted. The lean is real:
   eyes, muzzle and hitbox move with it. `speed` px/s; `still` = most movement that still counts as standing. */
const PEEK = { dist: 11, block: 46, gain: 60, speed: 45, still: 0.15 };
const P_STRIDE = 56;        // px you walk per footstep
const STEP_LEN = 32;        // px per boot step in the walk cycle
/* Recoil is physical: each shot shoves the rifle back into the shoulder on a stiff spring (the arms visibly absorb it),
   kicks it sideways on the arm spring (ARMS.recoil), and punches the view back a few pixels. */
const RECOIL = { push: 320, k: 900, c: 42, cam: 70, camK: 500, camC: 40 };
/* Damped spring, integrated in small sub-steps so a slow frame can't make it explode. */
function springStep(o, x, v, k, c, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.006)), h = dt / n;
  for (let i = 0; i < n; i++) { o[v] += (-k * o[x] - c * o[v]) * h; o[x] += o[v] * h; }
}
const BRACE_TURN = 2.5;     // turning this fast (rad/s) fully breaks your brace, even standing still
const STEADY_TIME  = 0.9;   // seconds standing still to become fully steady
const STEADY_RANGE = 0.15;  // steady = +15% flashlight and weapon range
const STEADY_ZOOM  = 0.86;   // camera pulls back this far when steady, so you can see the extra range
/* Sound: moving makes noise, gunfire is loud, walls soak sound up. */
const SOUND_RAYS = 96;
const WALK_NOISE_MIN = 40, WALK_NOISE_MAX = 180;   // footstep reach (px) at a crawl / full speed (~3.5 m running)
const GUN_NOISE = 480;                              // gunshot reach (px)
const HEAR = { loud: 0.4, maxGo: 2, zone: 600 };    // how loud a sound must be to come check it out; at most 2 bots busy with you within 600px
const STRIDE = 32;                                  // px a character walks between footprints
const WALL_MUL  = 6;
const FURN_MUL  = 1.6;                               // furniture only muffles a little                                // every pixel of wall costs this much sound
const RED_R     = 280;     // distance at which the red cone locks on (and bots open fire)
const CHAR_SCALE = 0.85;   // how big characters are drawn (1 tile = 0.9 m; shoulders ~0.46 m, AK ~0.88 m)
const BODY_R = 13.5;         // personal space: characters bump into each other at about their drawn shoulder width
const ANCHOR_Y  = 0.84;    // player sits this far down the screen
const LOOK = { fwd: 0.05, far: 0.08, side: 0.12, ease: 2.5, margin: 30 };   // aiming drifts the camera a little with the drag: forward while held, a bit more when dragging up, sideways with the drag (fractions of the screen); you always stay `margin` world px inside the screen
const INSPECT = { zoom: 1.7, delay: 0.8, in: 1.4, out: 6, anchor: 0.6 };   // standing calm (still, not aiming, no enemy seen, not under fire): after `delay` s the camera eases in on you (zoom) and centres you (`anchor` down the screen) so you can read your plates and helmet
const TURN_SENS = 4.0;     // radians turned per screen-height of swipe
const BLOOD = ['#7a0a12', '#600810', '#8e1019'];
const PLATE_HP = 52, HELMET_HP = 35;   // a plate stops ~3 rifle rounds, the helmet ~2
const PICK_TIME = { mag: 0.25, helmet: 0.3, plate: 0.35 };  // seconds to scoop loot up as you pass it; once started it's in your hand, walk on
/* Then it goes on you: a mag is stowed in a pouch; a helmet or plate is swapped (old one off and dropped at `off`,
   new one in at `on`, then strapped / closed). While gear goes on the rifle is down: no shooting, no reloading. */
const EQUIP = { mag: { T: 0.45 }, helmet: { T: 1.4, off: 0.35, on: 0.65 }, plate: { T: 2.1, off: 0.4, on: 0.75 } };
const PICKUP_R  = 34;                    // walk this close to grab loot
const PICKUP = { calm: 2.5, supp: 0.12, tun: 0.15 };   // nobody stoops for loot within `calm` s of a fight (shooting, being shot at or hit, an enemy in sight), unless their rifle and vest are empty (then mags only)
const MAG_VEST = 3;                      // spare magazines a vest holds (plus one in the rifle = 4)

/* Assault rifle */
const AR = {
  mag: 30,
  rate: 0.11,        // seconds between shots
  dmg: 20,
  spread: 0.045,     // radians of random scatter
  speed: 3200,       // bullet speed (px/s): it crosses the screen in about a tenth of a second
  range: 560,        // bullet travel distance
  reload: 1.7        // seconds
};
/* Your sidearm: a Glock 17 (9x19 mm, 17-round magazine, polymer frame). Only comes out once the rifle is bone dry (no
   rounds in it, none in the vest); goes back in the holster as soon as the rifle has a magazine again. Spare magazines
   are unlimited: an empty one drops out and a fresh 17 goes in. See SIDEARM. */
// 9 mm: armor = share of its damage a plate or helmet soaks up (it barely chips them), pen = how much less often it gets through cover
const PISTOL = { mag: 17, armor: 0.3, pen: 0.45, rate: 0.2, dmg: 13, spread: 0.035, speed: 2700, reload: 1.5, draw: 0.6, len: 44, lat: 1.0 };
const HOL = { k: 120, c: 6.5, acc: 0.0016, step: 0.9, max: 0.75, busy: 2.2 };   // holster jiggle: spring stiffness, damping, how hard body acceleration / steps / busy hands shake it
const freshSide = () => ({ ammo: PISTOL.mag, out: false, sw: null, reload: 0, dropped: false, cd: 0 });

/* Bots */
const BOT = {
  sight: CONE_R, half: CONE_HALF, aware: AWARE_R,   // same eyes as you: flashlight range and width, plus the close-up bubble
  fireRange: RED_R,                    // same reach as your red cone
  dmg: 20, speed: 3200, range: 600,
  refSpeed: 140,                       // their running speed: moving this fast = widest cone
  aimNoise: 0.045,                     // how far their aim wanders off you (rad); their arms add the rest
  burst: 4, burstRate: 0.16, burstPause: 0.9,
  react: 0.5,                          // seconds before they start shooting after spotting you
  mag: 30, reload: 2.0,                // magazine size and reload time (a window to push them)
  patrolSpeed: 70, searchSpeed: 120, advanceSpeed: 85, strafeSpeed: 60
};

