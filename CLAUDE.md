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
- No PRs. Commit and push to the session's working branch as you go. Fast-forward `main` only when the user says "deploy": every push to `main` is a Netlify production deploy, and the free plan allows about 20 a month (15 of 300 credits each).
- Doc-only pushes to `main` (CLAUDE.md, README) put `[skip netlify]` in the commit message so they don't deploy.
- Live build: https://magical-caramel-1bef55.netlify.app/ (Netlify, auto-deploys from `main`; not reachable from the cloud sandbox, so the user checks it).
- Headless testing: Playwright with `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`; open `index.html` via `file://`, watch console/page errors.

## Controls
- Touch: left half = move stick, right half = aim stick. The rifle fires automatically when the red cone locks onto a visible enemy. Reload button bottom-right.
- Keyboard/mouse: WASD move, mouse aims, R reload.
- Standing still "braces": tighter cone, +15% sight/range, camera eases out slightly.

## Camera and balance
- 60fps rAF loop: `update(dt, t)` then `render(t)`; dt is clamped to 0..0.05.
- Player sits at `ANCHOR_Y = 0.84` down the screen; the world rotates so the player's facing is always up.
- Scale `S = min(VH/300, VW/520)`; `STEADY_ZOOM = 0.86`.
- Look-ahead (`LOOK`, `look`): while the aim pad is held (or Q/E), the camera eases forward and leans toward the drag. In `render`, the lean is clamped so the character always stays `LOOK.margin` inside the screen.
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
1. Scene pass: floor art, pieces, doors, items, debris, pools, ragdolls, visible bots, gun smoke.
2. Light map: a screen-size canvas filled with darkness (`LIGHT.ambient = 0.82`), carved out with `destination-out` by every light's wall-occluded polygon (`lightPoly`, `carve`), then laid over the scene.
3. Glow/info pass: coloured additive tints (`glowLights`), wall edges caught by the beam, red aiming cone, sound rings, bot labels, tracers and sparks, then the player (always drawn after the darkness).
4. Suppression post-effect, then the HUD.
- Everyone's weapon light is on. Bot beams (`botBeam`, carved in `drawLightMap`) only show where you have line of sight (clipped to `beam.view`). A bot's light pointed at you shows a glare at its lamp, even when the bot is dark (`glowLights`).
- Seeing is light-based for everyone (`SEE`, `litByScene`, `inBeam`): you're seen if you're in the viewer's beam, within the close bubble, lit by any other light (`frameLights` = lamps/signs/flashes from the last render, plus everyone else's beam), or shining your light at the viewer. Bots also need you inside their eyes (`SEE.fov`) unless already in a fight (`botSees`). The player sees bots by the same rules (`isLit` and the bot-visibility loop).
- Suspicion (`noticeBeam`, `beamSpots`): a patrolling bot that sees your beam land in front of it but not you goes to search halfway between the lit spot and you, with a cooldown of `SEE.noticeCd` seconds.
- Doors and light: `lightCast` ignores doorway tiles (`lightBlock`) and stops at the actual door slabs (`doorSegs`, refreshed each render), so swung doors cast shadows and shut doors catch the beam on their near face. Sight checks (`isLit`, `botSees`, lock-on) use the same cast. `opq` still marks shut doorways for sound.
- Light sources: the weapon light (core/spill/halo polygons following the rifle angle `redAng`), muzzle flashes (`flashes[]`, ~0.06s, also reveal the shooter), `STATIC_LIGHTS` (EXIT signs, bar backlight, elevator indicators, a flickering corridor tube, reception lamp, kitchen hood, restroom mirrors), prop lights (street lamps, floor lamps, vending machine; shooting them out turns them off) and desk monitors.

## Characters
- `drawChar(x, y, bodyAng, gunAng, L, pose)`: boots and trousers that stride, combat shirt, plate carrier (front and back plate bags sit outside the chest/back so they read from above), side mag pouches, drag handle, antenna, sling, AK-47, two-jointed arms (`armIK`), gloves, `drawHead` (helmet with rails/NVG mount/patch, or bare head and hair once the helmet is gone).
- Deaths are ragdolls (`startRagdoll`, `updateRagdolls`, `drawRagdoll`, `RAG`, `rags`): 15 verlet joints held by sticks (`RAG_STICKS`), shoved by the killing round so the body falls away from the shot, sliding to a stop against walls, while the rifle skids off on its own. Once settled, a blood pool spreads under it. When the pool has soaked in, `stampRagdoll` paints body and rifle into the floor art by briefly pointing `ctx` at `artG` (which is why `ctx` is a `let`). Keeps whatever armour was left. Looks: `PLAYER_LOOK`, `BOT_LOOK`, `BOT_LOOK_HIT`.
- `CHAR_SCALE = 0.85`, `BODY_R = 13.5`. `pose.sh` = rifle shoulder (switches with cover side).

## Protection (there is no health bar)
- Everyone starts with `newProt()`: front plate, back plate (`PLATE_HP = 52`, ~3 rifle hits each) and a helmet (`HELMET_HP = 35`, ~2 hits).
- `takeHit(c, dmg, hx, hy, ux, uy)`: a round from the front half hits the front plate, from behind the back plate. A plate chips (`chipsF`/`chipsB`), throws ceramic fragments and finally shatters, leaving an empty bag. With that side's plate gone, the helmet takes hits, cracks, and is knocked off as floor debris. The next unprotected hit kills.
- Loot items: `mag` (`rounds`), `plate` and `helmet` (`hp`, `chips`). The dead drop their rifle mag, vest mags, any plate still above 0 and their helmet if it's still on. You only pick up upgrades (`canTake`), the biggest upgrade in reach first (`pickGain`): a plate goes into your weaker side, and whatever is swapped out is dropped on the floor. `p.hp` and bleeding remain in the code but are inactive (`BLEED.chance = 0`).

## Magazines
- Everyone carries 4 mags: 1 in the rifle (`ammo` / `b.ammo`) and `MAG_VEST = 3` in the vest (`mags` / `b.mags`, rounds per mag). There's no loose ammo pool.
- Reloading takes the fullest vest mag (`pullMag`). The old mag is dropped (`ejectMag`): empty ones become clutter, one with rounds left becomes a `mag` item anyone can pick up.
- With a full vest you can still swap in a fuller mag, dropping your emptiest. Bots scoop up the fullest mag in reach as they walk, but not the one they just dropped. The map's loose mags sit at `LOOT_SPOTS.mag`.

## Movement, aim and cover
- Momentum movement: `MOVE = { accel, decel, fwd: 1.0, side: 0.72, back: 0.5 }`.
- Arms are a spring (`ARMS`, `armsStep`); `sway` is the rifle's offset from aim, `redAng = p.aim + sway`. Recoil slides the rifle back and kicks the camera (`RECOIL`, `springStep`).
- Cover (`COVER`, `senseCover`): wall hugging, mounting the rifle on corners and sills (stiffer, less recoil), switching shoulders away from cover (can't fire mid-switch), ducking behind objects. Your own shots clear the cover you're touching; cover always stops shots at someone sheltering behind it.
- Crouch look: kneels on the rifle-side knee (that boot sole-up behind), front knee splayed out with a knee pad, upper body hunched forward, drawn smaller, with a tighter, darker shadow.
- Peeking (`PEEK`, in `senseCover`): standing still with the view blocked within `PEEK.block` but open from a point `PEEK.dist` (11px) to one side → the character really shifts out that way (`cov.px/py` = body offset from the planted boots; eyes, muzzle and hitbox move with it). Drawn with boots planted, legs angled out, the dipped shoulder shaded, the head leading and the rifle canted. Bots peek by the same rule.

## Bullets, destruction, sound
- `makeBullet` / `stepBullet`: velocity with drag, ricochets off walls, metal and cars (`BUL`, `RICO`), glass shatters and slows rounds, furniture and doors take damage.
- Walls take ~36 rifle hits to breach; crates ~110 HP; furniture HP varies by type.
- Chunks (`launchChunk`, `chunkPts`, `CHUNK`): broken-off fragments are `poly` debris that pop up (`z`, `vz`), tumble, land, skid and bounce off walls, then settle into the floor art like all debris.
- Furniture: each hit bites a jagged piece out where it struck (edge chip or hole, `f.bites`, cap `BITE_MAX`) and launches it. `drawPieces` clips bites out (one clip per bite) and outlines the raw edges. When destroyed, the rest splits into a grid of chunks.
- Windows break in `GLASS_SEG` strips per tile (`glassSeg`, `glassStrip`, `paintGlassGap`): a round knocks out the strip it crosses (sometimes neighbours) as glass chunks and cracks the rest. Rounds pass freely through missing strips, and the tile turns `g` once all are gone.
- Doors break into planks, crates lose slat bites per hit and fall apart into slats, walls throw concrete chunks at each quarter of damage and collapse into slabs.
- Sound: 96-ray extent per source, walls/doors/furniture muffle it. Up to 2 bots investigate a loud sound; faint ones just make them look. Enemy sounds only show if they reach you. Audible enemy footsteps show as red step rings, at most twice a second per bot (`b.ringT`), like your own.

## Blood
- `splat` (on a wound): lobed splash with a darker rim, spines thrown forward along the shot ending in droplets, and a fan of fine mist (`BLOOD_MIST`).
- Flung drops remember launch speed and direction (`v0`, `a0` from `spray`). `stampBlood` lands them via `bloodDrop`: fast ones stretch into teardrops with a tail and satellite droplet, slow drips land round.
- Pools (`addPool`, `drawPool`) have lobed edges (`q.lobes`), a dark drying rim and a wet sheen until they're stamped (`dry`).

## Gun smoke
`gunSmoke` emits a muzzle blast, slant-brake puff and ejection-port wisp per shot. Each shot adds barrel `heat`; a hot barrel trails wisps (`barrelWisps`). Smoke stops at walls and is lit by the light map.

## Suppression
- `SUPP` constants; `c.supp` from 0 to 1. Built up by near misses (`whiz` in `stepBullet`, within 55px), impacts nearby (`suppressAt`), hits and cover jolts. It decays, faster in cover (`easeSupp`).
- Effects: shakier arms, wider cone. Bots also flinch instead of firing and stop advancing when pinned. The player's view blurs (`ctx.filter`, with a ghosting fallback) and tunnels in with a heartbeat vignette.

## Bots
States patrol → search → attack. BFS pathfinding with occupancy, stuck recovery, hearing. They follow the same rules as the player: arms, cover, shoulder switching, magazines (30 rounds, 2s reload, see Magazines), suppression, protection.
- Out of ammo (rifle and vest empty, `dryBot`, `DRY`): they stop fighting and run for the best magazine on the floor, scoring ones near you lower. With none left, they hide out of your sight (`hideSpot`) and watch the way you'd come. Once rearmed, they head back to where they last saw you.

## Not built yet (ideas)
Squad teammates, a shrinking zone, more weapons and weapon switching, menus and character select, saved progress, bots deliberately seeking cover and flanking, real audio, an on-screen indicator for protection if needed, app packaging for forced landscape on iOS.
