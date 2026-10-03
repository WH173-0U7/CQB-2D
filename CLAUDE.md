# Dark Sector — project guide for Claude Code

Top-down tactical shooter (inspired by Bullet Echo) set on the ground floor of a dark hotel at night.
The whole game is **one self-contained, offline HTML file** (`index.html`).

## Ground rules
- Keep it a single file that runs offline by double-clicking it: no network requests, no external assets, no build step.
- Pure HTML + JS + Canvas 2D inside one IIFE. No frameworks.
- Mobile landscape is the main target (touch sticks), desktop keyboard/mouse also works. Watch per-frame cost: lighting and blur run every frame.
- Tuning lives in named constants near the top of the script. Prefer changing constants over rewriting systems.
- After any change, check: no console errors, bots still walk the map without getting stuck, fights still resolve.

## Working preferences
- Keep replies short. Ask before expensive steps: reading the whole game file, long visual tests (screenshots), or spawning agents. Prefer targeted greps and text checks.
- Commit and push changes straight to `main`; no PRs.
- Headless testing: Playwright with `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`; open `index.html` via `file://`, watch console/page errors.

## Controls
- Touch: left half = move stick, right half = aim stick. The rifle fires automatically when the red cone locks onto a visible enemy. Reload button bottom-right.
- Keyboard/mouse: WASD move, mouse aims, R reload.
- Standing still "braces": tighter cone, +15% sight/range, camera eases out slightly.

## Camera and balance
- 60fps rAF loop: `update(dt, t)` then `render(t)`; dt is clamped to 0..0.05.
- Player sits at `ANCHOR_Y = 0.84` down the screen; the world rotates so the player's facing is always up.
- Scale `S = min(VH/300, VW/520)`; `STEADY_ZOOM = 0.86`.
- **Sight range equals what fits on screen, for everyone**: `CONE_R = 245` (≈252px visible ahead), `STEADY_RANGE = 0.15`. Bots use the same sight rule. `RED_R = 210` (lock range) and `BOT.fireRange = RED_R`. If the camera changes, re-match these.

## Map
- 56×44 tiles, `T = 48` px (~0.9 m per tile). Two layers: `MAP_SOLID` and `MAP_FLOOR` (char grids).
- Solid chars: `.` open, `#` wall (destructible, border is not), `E` elevator, `C` column, `X` crate, `G`/`g` window / broken window, `S` sofa, `D` desk, `B` bar, `K` counter, `t` table, `P` planter, `L` luggage cart, `c`/`y` car/taxi.
- Floor codes: `m` lobby marble, `M` mat, `e` elevator hall, `w` restaurant oak, `k` kitchen tile, `u` restroom tile, `o` office carpet, `r` lounge carpet, `z` back-of-house concrete, `s` sidewalk, `R` red carpet, `a` asphalt. Colours in `FLOOR_COL`.
- Rooms: lobby, elevator hall, restaurant, kitchen, men's/women's restrooms, meeting room, office, lounge bar, back corridor, street outside the entrance.
- Spawn on the street at tile (27.5, 40.5) facing north. 7 bots.
- `buildFloorArt()` paints floors, details and built-in furniture once into an offscreen canvas (`FLOOR_ART` / `artG`). Every permanent mark (debris, holes, blood, wrecks) is stamped into it later.
- `drawFurniture(g, c, x, y, w, h, n, f, room)` draws every furniture/prop type, with detail chosen by `room` and the piece's `kind`.

## Furniture and props
- `FURN` table: hp, bullet hit chance, mass, debris colours, wreck colours; `fixed: true` = bolted down (never moves).
- `buildPieces()` makes movable map furniture (tables shrink to leave room for chairs). `buildProps()` adds chairs around tables, office chairs, bar stools, toilets, urinals, stall partitions, filing cabinets, bins, lamps, vending machine, street lamps, trash cans, hydrant, cleaning cart.
- Piece fields: `c` type, `x,y,w,h` AABB, `pad` draw inset, `room`, `kind` (`dining`/`bar`/`coffee` tables, `desk`, `piano`), `light` (props that emit light), `fixed`.
- Bot navigation: `rebuildOcc()` marks tiles under heavy or fixed pieces only; light ones (chairs, stools, bins; mass < 1) are just shoved aside.

## Doors
13 doorways with physics hinge leaves, pushed by bodies with torque. Restroom, kitchen, fire-exit and street doors self-close; office and meeting-room doors stay where left. Bullets can swing or destroy them. Creak noise when a latch opens.

## Lighting (render order matters)
1. Scene pass: floor art, pieces, doors, items, debris, pools, corpses, visible bots, gun smoke.
2. Light map: a screen-size canvas filled with darkness (`LIGHT.ambient = 0.82`), carved out with `destination-out` by every light's wall-occluded polygon (`lightPoly`, `carve`), then laid over the scene.
3. Glow/info pass: coloured additive tints (`glowLights`), wall edges caught by the beam, red aiming cone, footprints and sound rings, bot labels, tracers and sparks, then the player (always drawn after the darkness).
4. Suppression post-effect, then the HUD.
- Light sources: the weapon light (core/spill/halo polygons following the rifle angle `redAng`), muzzle flashes (`flashes[]`, ~0.06s, also reveal the shooter), `STATIC_LIGHTS` (EXIT signs, bar backlight, elevator indicators, a flickering corridor tube, reception lamp, kitchen hood, restroom mirrors), prop lights (street lamps, floor lamps, vending machine; shooting them out turns them off) and desk monitors.

## Characters
- `drawChar(x, y, bodyAng, gunAng, L, pose)`: boots and trousers that stride, combat shirt, plate carrier (front and back plate bags sit outside the chest/back so they read from above), side mag pouches, drag handle, antenna, sling, AK-47, two-jointed arms (`armIK`), gloves, `drawHead` (helmet with rails/NVG mount/patch, or bare head and hair once the helmet is gone).
- `drawCorpse(...)` keeps whatever armour was left. Looks: `PLAYER_LOOK`, `BOT_LOOK`, `BOT_LOOK_HIT`.
- `CHAR_SCALE = 0.85`, `BODY_R = 13.5`. `pose.sh` = rifle shoulder (switches with cover side).

## Protection (there is no health bar)
- Everyone starts with `newProt()`: front plate, back plate (`PLATE_HP = 52`, ~3 rifle hits each) and a helmet (`HELMET_HP = 35`, ~2 hits).
- `takeHit(c, dmg, hx, hy, ux, uy)`: a round from the front half hits the front plate, from behind the back plate. A plate chips (`chipsF`/`chipsB`), throws ceramic fragments and finally shatters, leaving an empty bag. With that side's plate gone, the helmet takes hits, cracks, and is knocked off as floor debris. The next unprotected hit kills.
- Loot items: `mag` (`rounds`), `plate` and `helmet` (`hp`, `chips`). The dead drop their rifle mag, vest mags, any plate still above 0 and their helmet if it's still on. You only pick up upgrades (`canTake`): a plate goes into your weaker side, and whatever is swapped out is dropped on the floor. `p.hp` and bleeding remain in the code but are inactive (`BLEED.chance = 0`).

## Magazines
- Everyone carries 4 mags: 1 in the rifle (`ammo` / `b.ammo`) and `MAG_VEST = 3` in the vest (`mags` / `b.mags`, rounds per mag). There's no loose ammo pool.
- Reloading takes the fullest vest mag (`pullMag`). The old mag is dropped (`ejectMag`): empty ones become clutter, one with rounds left becomes a `mag` item anyone can pick up.
- With a full vest you can still swap in a fuller mag, dropping your emptiest. Bots scoop up mags they walk over, but not the one they just dropped. The map's loose mags sit at `LOOT_SPOTS.mag`.

## Movement, aim and cover
- Momentum movement: `MOVE = { accel, decel, fwd: 1.0, side: 0.72, back: 0.5 }`.
- Arms are a spring (`ARMS`, `armsStep`); `sway` is the rifle's offset from aim, `redAng = p.aim + sway`. Recoil slides the rifle back and kicks the camera (`RECOIL`, `springStep`).
- Cover (`COVER`, `senseCover`): wall hugging, mounting the rifle on corners and sills (stiffer, less recoil), switching shoulders away from cover (can't fire mid-switch), ducking behind objects. Your own shots clear the cover you're touching; cover always stops shots at someone sheltering behind it.

## Bullets, destruction, sound
- `makeBullet` / `stepBullet`: velocity with drag, ricochets off walls, metal and cars (`BUL`, `RICO`), glass shatters and slows rounds, furniture and doors take damage.
- Walls take ~36 rifle hits to breach; crates ~110 HP; furniture HP varies by type.
- Sound: 96-ray extent per source, walls/doors/furniture muffle it. Up to 2 bots investigate a loud sound; faint ones just make them look. Enemy sounds only show if they reach you; audible enemy footsteps leave prints.

## Gun smoke
`gunSmoke` emits a muzzle blast, slant-brake puff and ejection-port wisp per shot. Each shot adds barrel `heat`; a hot barrel trails wisps (`barrelWisps`). Smoke stops at walls and is lit by the light map.

## Suppression
- `SUPP` constants; `c.supp` from 0 to 1. Built up by near misses (`whiz` in `stepBullet`, within 55px), impacts nearby (`suppressAt`), hits and cover jolts. It decays, faster in cover (`easeSupp`).
- Effects: shakier arms, wider cone. Bots also flinch instead of firing and stop advancing when pinned. The player's view blurs (`ctx.filter`, with a ghosting fallback) and tunnels in with a heartbeat vignette.

## Bots
States patrol → search → attack. BFS pathfinding with occupancy, stuck recovery, hearing. They follow the same rules as the player: arms, cover, shoulder switching, magazines (30 rounds, 2s reload, see Magazines), suppression, protection.

## Not built yet (ideas)
Squad teammates, a shrinking zone, more weapons and weapon switching, menus and character select, saved progress, bots deliberately seeking cover and flanking, real audio, an on-screen indicator for protection if needed, app packaging for forced landscape on iOS.
