# Dark Sector — project guide for Claude Code

Top-down tactical shooter (inspired by Bullet Echo) set on the ground floor of a small boutique hotel at night.
The whole game is **one self-contained, offline HTML file** (`index.html`).

## Ground rules
- Keep it a single file that runs offline by double-clicking it: no network requests, no external assets, no build step.
- Pure HTML + JS + Canvas 2D inside one IIFE. No frameworks.
- Mobile landscape is the main target (touch sticks), desktop keyboard/mouse also works. Watch per-frame cost: lighting and blur run every frame.
- Tuning lives in named constants near the top of the script. Prefer changing constants over rewriting systems.
- After any change, check: no console errors, bots still walk the map without getting stuck, fights still resolve. After a layout change, also flood-fill a player-sized body from the spawn (furniture included) and make sure every doorway, room, exit and restock spot is reachable.

## Working preferences
- Keep replies short. Ask before expensive steps: reading the whole game file, long visual tests (screenshots), or spawning agents. Prefer targeted greps and text checks.
- No PRs. Commit and push to the session's working branch as you go. Fast-forward `main` only when the user says "deploy": every push to `main` is a Netlify production deploy, and the free plan allows about 20 a month (15 of 300 credits each).
- After every commit, also push to the `preview` branch (`git push origin HEAD:preview`, forcing if needed). Netlify builds it free at https://preview--magical-caramel-1bef55.netlify.app (branch deploys cost no credits) so the user can test before "deploy".
- Doc-only pushes to `main` (CLAUDE.md, README) put `[skip netlify]` in the commit message so they don't deploy.
- Live build: https://magical-caramel-1bef55.netlify.app/ (Netlify, auto-deploys from `main`; not reachable from the cloud sandbox, so the user checks it).
- Stress testing: expose `update`/`render`, stop the rAF loop, and step `update(1/60, t)` in a tight loop with an aimbot for the player (render every 3rd step) to simulate minutes of fights in seconds; count errors and the size of each live object list.
- Headless testing: Playwright with `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`; open `index.html` via `file://`, watch console/page errors.

## Controls
- Touch: left half = move stick, right half = aim stick. The rifle fires automatically when the red cone locks onto a visible enemy. Reload button bottom-right.
- Keyboard/mouse: WASD move, mouse aims, R reload.
- Standing still "braces": tighter cone, +15% sight/range, camera eases out slightly.

## Camera and balance
- 60fps rAF loop: `update(dt, t)` then `render(t)`; dt is clamped to 0..0.05. `frame` queues the next frame first and catches errors (logs the first 5), so one bad frame can't freeze the game.
- Player sits at `ANCHOR_Y = 0.84` down the screen; the world rotates so the player's facing is always up.
- Scale `S = min(VH/345, VW/600)`; `STEADY_ZOOM = 0.86`. The view ahead (~290px moving, ~337 braced) reaches past anyone's firing range.
- Look-ahead (`LOOK`, `look`): while the aim pad is held (or Q/E), the camera drifts a little with the drag: forward while held, a bit more when dragging up, sideways with the drag. In `render` it's clamped so you stay `LOOK.margin` inside the screen.
- Inspect (`INSPECT`, `inspect`): when calm (still/braced, not aiming, no enemy visible, not suppressed, no shot for 1 s) for `INSPECT.delay` s, the camera eases in (`INSPECT.zoom`) and centres you (`INSPECT.anchor`) so you can read your plates and helmet. Anything happening pulls it straight back out.
- **Sight and reach roughly match what's on screen, for everyone**: `CONE_R = 300` (screen shows ≈290px straight ahead, more to the sides and with look-ahead/brace), `STEADY_RANGE = 0.15`. `RED_R = 280` (lock range) and `BOT.fireRange = RED_R`; bots see with `CONE_R` too. The squad distances (`flankR`, `coverDist`, `wideDist`, `findShadow`) are sized to these. If the camera changes, re-match them.

## Run flow and maps
- Maps (`MAPS`, `MAP`, `applyMap`, `travel(name)`): every location is its own map of the same 36×30 size, with:
  - `solid`/`floor` grids, `spawn` (tiles), `doors` (`[x0, y0, x1, y1, selfClosing]`)
  - `fixtures` (light fixture rows in px), `loot` (spots by kind), `bots` (spawn tiles)
  - `exit`: tiles, `r`, `hold`, `to`, `needClear`, `label`, banner `title`/`sub`
- `travel` swaps `MAP` and runs `resetGame(kit)`: the world is rebuilt but your kit comes with you (`kitNow`: plates with their damage, helmet, rifle mag, vest mags). Leaving for a mission saves `deployKit`, and a restart after dying there uses it.
- Armory restock (`MAP.restock`, `restockStep`, `RESTOCK`, `kitFull`): stand in the blue RESTOCK ring at the house's gear crates and fresh kit goes on one piece at a time through the normal equip animations. Order: helmet, plates (weaker side first), vest mags, then a reload. Replaced gear goes back on the rack (`equip.rack`: nothing dropped). The ring reads STOCKED when you're full. Map-specific furniture and floor decals are switched on `MAP.id` in `buildProps` and `buildFloorArt`.
  - `hotel`: the mission. Once it's clear (`cleared`), the "AREA CLEAR / Head to the taxi" banner shows and the exit ring opens by the taxi; it leads to the house.
  - `house`: the safe house. Bedroom, bathroom, armory (crates, workbench), living room, kitchen (counter on the south wall, so the armory door opens onto clear floor), yard and street with your car. No enemies and no headcount in the HUD. The front-door ring (porch) leads back to the hotel. Its own fixtures: porch light, floor lamp, kitchen hood, bathroom mirror, armory tube, desk lamp, EXIT sign. Built to grow features later.
- The exit ring (`EXIT`, `exitOpen`, `drawExtract`) and its edge arrow with distance (`drawExtractHud`) show while it's open. Standing in it for `hold` s travels (`extractT`). The banner shows for `BANNER_T` s.
- States: `play`, `downed` (bleeding out, see Downed), `dead`, `dry` (out of ammo on a mission). `dead`/`dry` show an overlay, and tap/Enter restarts the current map.

## Map
- 36×30 tiles, `T = 48` px (~0.9 m per tile), rooms at real-world sizes. Two layers: `MAP_SOLID` and `MAP_FLOOR` (char grids).
- Solid chars: `.` open, `#` wall (destructible, border is not), `E` elevator, `C` column, `X` crate, `G`/`g` window / broken window, `S` sofa, `D` desk, `B` bar, `K` counter, `t` table, `P` planter, `L` luggage cart, `c`/`y` car/taxi.
- Floor codes: `m` lobby marble, `M` mat, `e` elevator hall, `w` restaurant oak, `k` kitchen tile, `u` restroom tile, `o` office carpet, `r` lounge carpet, `z` back-of-house concrete, `s` sidewalk, `R` red carpet, `a` asphalt. Colours in `FLOOR_COL`.
- Layout (north to south):
  - Back corridor (y 1–2) with crates.
  - North band (y 4–9): kitchen (x 1–7), men's (9–11), elevator hall (13–18, elevators and stair door in the north wall), women's (20–22), office (24–27), meeting room (29–34).
  - South band (y 11–20): restaurant (1–8), lobby (10–20, reception desk, column, sofa corner, medallion), lounge bar (22–34, bar/back bar, piano, tables, sofa).
  - Facade with windows (y 21), sidewalk and red carpet (y 22–24), street with parked cars and a taxi (y 25–28).
  - Arches link the lobby to the restaurant, lounge and elevator hall.
- Hotel: spawn on the red carpet at tile (15.5, 23.5) facing north. 5 bots (`makeBots` from `MAP.bots`).
- Map-specific data to keep in sync when a layout changes: the map's entry in `MAPS` (spawn, doors, bots, exit, fixtures: the hotel's are `HOTEL_FIXTURES`, loot: none on either map; pickups only come from enemies), its floor decals in `buildFloorArt`, and its hard-coded props in `buildProps`.
- Built-ins vs movable: a run of the same furniture char bigger than 4 tiles is built in (drawn into the floor art); smaller ones are movable pieces. A built-in `D` at least 4 tiles wide is the meeting table; one 5 tall is the reception desk.
- `buildFloorArt()` paints floors, details, built-in furniture and wall tops once into an offscreen canvas (`FLOOR_ART` / `artG`) at `ART_RES` (2) pixels per world px. `artG` carries that scale, so everything draws in world px, and the render draws it at `W*T × H*T`.
- Wall tops (`WALL_TOP` by `wallMat`, texture, a lit bevel and a dark outline where they meet a room) are shown over the darkness, clipped to `WALL_PATH` and dimmed by `WALL_SHADE`, so walls (and the bullet marks on them) read as structure instead of black voids. Every permanent mark (debris, bullet marks, blood, wrecks) is stamped into it later.
- `drawFurniture(g, c, x, y, w, h, n, f, room)` draws every furniture/prop type, with detail chosen by `room` and the piece's `kind`.
- Materials (`FINISH`, `makeTex`, `TEX`, `finishCanvas`, `finishedImage`, `pieceSprite`):
  - Grey semi-transparent 64px textures (wood, soft, carpet, metal, thin, marble, ceramic, stone, concrete, asphalt) are laid over flat colours.
  - Every furniture image is textured by material (`FURN[c].mat` or `BUILTIN_MAT`), lit from one side, colour-muted and given a baked soft drop shadow.
  - Built-ins are finished into the floor art. Movable pieces are rendered once into a cached image (`f.spr`, at `FINISH.res` = 3×) and blitted each frame (bites still clip it).
  - Floors get `FLOOR_TEX` per floor code plus faint per-tile tone variation, and soft ambient-occlusion shadows along wall bases.
  - The map starts clean: no litter, stains or cracks are baked in. Dirt comes only from play (casings, debris, bullet marks, blood, bloody boot prints, wrecks, furniture scrapes).

## Furniture and props
- `FURN` table: hp, bullet hit chance, mass, debris colours, wreck colours; `fixed: true` = bolted down (never moves).
- `buildPieces()` makes movable map furniture (tables shrink to leave room for chairs). `buildProps()` adds chairs around tables, office chairs, bar stools, toilets, urinals, stall partitions, filing cabinets, bins, lamps, vending machine, street lamps, trash cans, hydrant, cleaning cart.
- Piece fields: `c` type, `x,y,w,h` AABB, `pad` draw inset, `room`, `kind` (`dining`/`bar`/`coffee` tables, `desk`, `piano`), `light` (props that emit light), `fixed`.
- Bot navigation: `rebuildOcc()` marks tiles under heavy or fixed pieces only; light ones (chairs, stools, bins; mass < 1) are just shoved aside.

## Doors
11 doorways with physics hinge leaves, pushed by bodies with torque. Restroom, kitchen, fire-exit and street doors self-close; office and meeting-room doors stay where left. Bullets can swing or destroy them. Creak noise when a latch opens.

## Lighting (render order matters)
1. Scene pass: floor art (only the on-screen part), pieces, doors, items, debris, pools, ragdolls, visible bots, gun smoke. Everything is culled to `VIEW` (`onView`), the world rect on screen this frame.
2. Light map: a canvas at `LIGHT.res` (0.5) of screen resolution, scaled up when laid over, filled with darkness (`LIGHT.ambient = 0.82`), carved out with `destination-out` by every light's wall-occluded polygon (`lightPoly`, `carve`), then laid over the scene. Light and view polygons (`visPoly`, used by `lightPoly` and `rayPoly`) cast an even fan plus a ray pair either side of every wall corner (`lightCorners`, rebuilt when walls change) and door edge, so shadow edges sit exactly on corners and don't shimmer as you move.
3. Glow/info pass: coloured additive tints (`glowLights`), wall edges caught by the beam, red aiming cone, sound rings, bot labels, tracers and sparks, then the player (always drawn after the darkness).
4. Suppression post-effect, then the HUD.
- Weapon lights are an attachment (`att.light` on `p` and each bot, `hasLight`); nobody has one yet, so the only cone on screen is the red firing cone. Without a light you see an evenly dim, wall-blocked area all round (`beam.eyes`, `SEE.darkView`/`darkK`, flat out to `SEE.darkFlat` of the radius, then fading): no halo around you, and `lightAt` darkens you to the same level as the floor you stand on. A person in front of your eyes (`SEE.fov` either side of where you face, the same eyes bots have; not just the narrow rifle cone) is made out in the dark only within `SEE.dark` px (just inside the dim view, `SEE.darkView`); anyone lit by a lamp, sign or muzzle flash is seen at full range. Nobody gets lit up or noticed by their own light. Everything below about beams applies only to characters with a light. Lasers etc. are planned as further attachments.
- With a light: everyone's weapon light is on. Bot beams (`botBeam`, carved in `drawLightMap`) only show where you have line of sight (clipped to `beam.view`). A bot's light pointed at you shows a glare at its lamp, even when the bot is dark (`glowLights`).
- Seeing is light-based for everyone (`SEE`, `litByScene`, `inBeam`): you're seen if you're in the viewer's beam, within the close bubble, lit by any other light (`frameLights` = lamps/signs/flashes from the last render, plus everyone else's beam), or shining your light at the viewer. Bots also need you inside their eyes (`SEE.fov`) unless already in a fight (`botSees`). The player sees bots by the same rules (`isLit` and the bot-visibility loop). A bot just seen stays visible for 0.35 s while the line is clear (`b.seenT`), so nothing pops in and out at the edge of sight or under a flickering light. Drawing is separate from detection: any bot you have a clear line to (within `viewR * 1.6`) is drawn (`b.vis`), under the darkness layer, so it simply fades with how lit it is and is never cut out. Only walls hide it. Lock-on, labels (`b.know`), threat markers and the inspect calm check use real detection (`b.seen`).
- Suspicion (`noticeBeam`, `beamSpots`): a patrolling bot that sees your beam land in front of it but not you goes to search halfway between the lit spot and you, with a cooldown of `SEE.noticeCd` seconds.
- Doors and light: `lightCast` ignores doorway tiles (`lightBlock`) and stops at the actual door slabs (`doorSegs`, refreshed each render), so swung doors cast shadows and shut doors catch the beam on their near face. Sight checks (`isLit`, `botSees`, lock-on) use the same cast. `opq` still marks shut doorways for sound.
- Light sources: muzzle flashes (`flashes[]`, ~0.06s, also reveal the shooter), and only real, visible, breakable fixtures, no free-floating lights. `FIXTURES`: EXIT signs over doors, the back-bar LED strip, elevator indicators, the flickering corridor tube, reception desk lamp, kitchen hood lamps, restroom mirror light bars. Each has a housing (`drawFixtures(false)`) and a lit face drawn over the darkness (`drawFixtures(true)`), plus hp. Rounds passing through take hp and carry on (`hitFixtures` in `stepBullet`). At 0 it sputters out (`die`), throwing sparks and glass. `resetFixtures` on restart. Furniture lights: street lamps, floor lamps, vending machine (`f.light`, gone when the piece breaks) and desk monitors. Weapon lights only with `att.light`.

## Characters
- `drawRifle`: AK from above with gradient-shaded round parts, rivets, dust-cover ribs, selector, rear sight leaf, handguard vents and grain, gas tube, front sight ears and slant-brake ports.
- `drawChar(x, y, bodyAng, gunAng, L, pose)`: boots and trousers that stride, combat shirt, plate carrier (front and back plate bags sit outside the chest/back so they read from above), side mag pouches, drag handle, antenna, sling, AK-47, two-jointed arms (`armIK`), gloves, `drawHead` (helmet with rails/NVG mount/patch, or bare head and hair once the helmet is gone).
- Deaths are ragdolls (`startRagdoll`, `updateRagdolls`, `drawRagdoll`, `RAG`, `rags`): 15 verlet joints held by sticks (`RAG_STICKS`, including min-distance sticks so legs don't pass through each other) and joint limits (`RAG_LIMITS`, `ragLimit`: thighs, knees, upper arms, elbows and head only bend within real ranges), shoved by the killing round so the body falls away from the shot. The pose is settled (`ragSolve`, pulled out of walls) before the shove is applied, physics runs in fixed 1/60 s steps (`ragStep`), and no joint moves more than `RAG.maxStep` px per step, so nothing gets flung. The body falls, sliding to a stop against walls, while the rifle skids off on its own. Once settled, a blood pool spreads under it. When the pool has soaked in, `stampRagdoll` paints body and rifle into the floor art by briefly pointing `ctx` at `artG` (which is why `ctx` is a `let`). Drawn with realistic proportions: tapered limbs, a torso with waist and shoulders, the carrier lying on it (pouches up front or radio and drag handle on the back), and a contact shadow in the body's own shape. Keeps whatever armour was left. Looks: `PLAYER_LOOK`, `BOT_LOOK`.
- Uniforms: the player is US Army (`PLAYER_LOOK`: OCP camo `OCP`, coyote carrier and boots, ACH with camo cover and NVG mount, subdued US flag patches, black polymer rifle furniture). Enemies are Iranian military (`BOT_LOOK`: green digital camo `IR_DIGI`, olive chest rig, plain green helmet, Iranian flag patches, wood rifle furniture).
  - Camo is a seamless `CanvasPattern` from `makeCamo` used as the fill or stroke style; flag patches come from `drawFlag`. The shared pattern is pinned to whatever part is being drawn (`pinCamo`: thigh, upper arm, torso, ragdoll limb), so the print moves with the cloth instead of the limbs sliding through it. Drawn at `CAMO_SCALE` (0.6) for a fine print.
  - Kit details by look: `flagSide` (US flag right sleeve, Iranian left), `unitPatch` (US subdued patch on the other sleeve), `elbowPad` (US), `tq` (US tourniquet on the shoulder strap), `band` (US cat-eye band + IR strobe on the helmet), `canteen` (Iranian, left hip). Both have their flag patch on the back plate bag and the back of the helmet.
  - One helmet drawing everywhere (`drawHelmet`: on the head, in a hand, tucked against the chest). Sleeve patches via `sleevePatches`. Ragdolls keep sleeve patches and elbow pads. A hit shows as plate dust or sparks, a flinch and a shove, with no colour flash on the uniform.
  - Carriers have MOLLE webbing, triple chest mag pouches, an admin pouch and a back radio pouch. Outlines (`rim`) are dark, natural edges.
- Pickups (`drawIcon(kind, it)`) are drawn as real objects lying at their own angle (`it.rot`) with an occasional glint: a steel AK mag (brass if loaded); a helmet (green if `it.ir`, else coyote with NVG mount; dents from `chips`); a plate in a fabric cover with a label and cracks by lost hp. Enemy armour drops carry `ir: true`.
- Lighting on characters: one world-fixed key light (`KEY`, `charKey` = it in the body frame) shades the torso and carrier, gives the helmet its specular and the sleeves a lit edge,. The contact shadow (`contactShadow`) is a tight patch right under the body. Yours is drawn on the floor in the scene pass, not in your lit canvas (`noShadow`), so it blends with the light on the floor. You're drawn above the darkness, so `drawCharLit` renders you into a small canvas and darkens and tints you by the light at your spot (`lightAt`: ambient, your eyes, every light reaching you; less while your muzzle flashes). Bots get this from the darkness layer.
- Downed (`DOWN`, `goDown`, `downStep`, `endDown`, `smear`, `hitDowned`): a lethal hit downs the target alive with `DOWN.chance` instead of killing outright. The ragdoll falls as usual, then stays alive (`rg.alive`) for `DOWN.life` s, weakening as it goes:
  - It either squirms (random limb kicks, a pool spreads under it) or drags itself away from the shot on its hands (reach, plant, pull; pulls never pass walls; it turns along a wall it can't pass or gives up), leaving a blood smear trail painted into the floor art.
  - It then bleeds out and settles like any death.
  - A downed bot counts as dead for everyone (`b.dead`): no lock-on, no bot targets it, the headcount drops and the area can clear. Its loot drops only when it bleeds out. A stray round that hits a downed body finishes it.
  - You can go down too: state `downed`. Bots stop seeing you (`botSees`), intel and roles are cleared, and the world keeps running (`live`). The move stick drags you, the camera follows your body, there's no cone, and a "BLEEDING OUT" vignette closes in until state turns `dead`.
  - All ragdolls, yours included, are drawn under the darkness.
- `CHAR_SCALE = 0.85`, `BODY_R = 13.5`. `pose.sh` = rifle shoulder (switches with cover side).

## Protection (there is no health bar)
- Everyone starts with `newProt()`: front plate, back plate (`PLATE_HP = 52`, ~3 rifle hits each) and a helmet (`HELMET_HP = 35`, ~2 hits).
- `takeHit(c, dmg, hx, hy, ux, uy)`: a round from the front half hits the front plate, from behind the back plate. A plate chips (`chipsF`/`chipsB`), throws ceramic fragments and finally shatters, leaving an empty bag. With that side's plate gone, the helmet takes hits, cracks, and is knocked off as floor debris. The next unprotected hit kills.
- Loot items: `mag` (`rounds`), `plate` and `helmet` (`hp`, `chips`). The dead drop their rifle mag, vest mags, any plate still above 0 and their helmet if it's still on. You only pick up upgrades (`canTake`), the biggest upgrade in reach first (`pickGain`): a plate goes into your weaker side, and whatever is swapped out is dropped on the floor.
- Picking up (`updatePickup`, `PICK_TIME`, `EQUIP`, `equip`, `stepEquip`): walk over loot and you scoop it up on the move. Once the grab starts it's committed, and the hand carries the item while it's stowed or put on, wherever you walk. A mag is stowed in a chest pouch. A helmet or plate is swapped: the new one is tucked against the body, the old one comes off and is dropped at `EQUIP[k].off` (you're unprotected there until `on`), the new one goes in, then the strap/flap is done. While gear goes on (`gearBusy`) the rifle hangs to the side: no shooting, no reloading. No grabbing anything mid-reload. Reload button / R (`reloadPressed`) cancels what the hands are doing so you can shoot (`cancelPickup`: gear already in place stays, anything in hand drops at your feet, and nearby loot is skipped (`it.skip`) until you step away; a reload is cancelled only before the old mag is out). With the rifle empty it cancels and reloads; with no ammo at all it doesn't cancel. The button shows an X while a tap would cancel. Shared by everyone: `gearStep`, `newEquip`, `gearPose`.
- Bots do the same for plates and helmets (`b.grab`, `b.equip`, `botGear`): they stand still with the rifle down and can't fire or reload. A grab is dropped if the item vanishes or you show up, but once the gear is going on they finish it. A bot killed mid-swap drops the piece it was putting on. Mags still go straight into a pouch (`botTake`).
- Hand animation (`drawChar`): the support hand follows eased `[time, point]` keys; `drawHeld` draws what's in it (mag, helmet, plate). Reload: cant the rifle, strip the old mag and toss it, dig the next from the chest pouch, seat it, rack the charging handle.

## Magazines
- Everyone carries 4 mags: 1 in the rifle (`ammo` / `b.ammo`) and `MAG_VEST = 3` in the vest (`mags` / `b.mags`, rounds per mag). There's no loose ammo pool.
- Reloading takes the fullest vest mag (`pullMag`). The old mag is dropped (`ejectMag`): empty ones become clutter, one with rounds left becomes a `mag` item anyone can pick up.
- With a full vest you can still swap in a fuller mag, dropping your emptiest. Bots scoop up the fullest mag in reach as they walk, but not the one they just dropped. There's no loot lying around the maps: every pickup comes off a fallen enemy.

## Movement, aim and cover
- Weight (`LOAD`, `loadOf`, `loadMul`): plates count 2 each and a helmet 1, only while actually worn (shattered plates and lost helmets don't count). A full kit moves at the base speeds (heaviest); less armour is quicker, none about 14% faster (lightest). It also scales acceleration and stopping (squared, in `accelToward`). Bots follow the same rule (in `followPath`).
- Momentum movement: `MOVE = { accel, decel, fwd: 1.0, side: 0.72, back: 0.5 }`, at a deliberate tactical pace (`p.speed` 140 px/s ≈ 2.6 m/s, bots patrol 70 / search 120).
- Stride: legs swing `STEP_LEN / (2 * CHAR_SCALE) * walk` and the phase advances per `STEP_LEN * walk` of travel, so planted boots don't skate at any speed. Moving while crouched/ducked, the legs come up out of the kneel into a duck-walk (`crL` in `drawChar`).
- Off-screen threats (`threats`, `drawThreats`): a shot from a bot you can't see puts a red marker at the screen edge pointing at it for `THREAT_T` s.
- The support hand only reaches for doors, cover and loot in front of the body (`reachable` needs local x > 1; grab targets are clamped forward).
- Arms are a spring (`ARMS`, `armsStep`); `sway` is the rifle's offset from aim, `redAng = p.aim + sway`.
- The rifle is a physical object (`GUN`, `gunReach`, `barrelReach`, `c.gun`): a barrel `GUN.len` long from the shoulder line, stopped by walls, columns, crates, glass and door slabs. Up close it's pulled in (`gun.in`, up to `maxIn`), then swung clear toward the open side (`gun.sw`/`sd`). Its tip shoves doors (`pushDoors(e, who)`). `gun.ang`/`mx`/`my` is the real barrel: rounds, the red cone (`rayPoly` from the muzzle), the lock check, smoke and flash all start at the muzzle along it. Swung past `noFire` it can't shoot (`gunCanFire`). Friendly fire is on: rounds hit anyone they reach (bots hit bots; `allies` = your squad, empty for now). Nobody shoots through a teammate (`friendInLine`, `FF`: the line from the muzzle widened by the scatter cone): bots hold fire and side-step to open the line (`clearLine`); for you, auto-fire stops and the cone turns blue (`p.blocked`). Recoil: the round's deviation from the bore kicks the barrel the other way (`recoilKick(..., dev)`). Recoil slides the rifle back and kicks the camera (`RECOIL`, `springStep`).
- Cover (`COVER`, `senseCover`): wall hugging, mounting the rifle on corners and sills (stiffer, less recoil), switching shoulders away from cover (can't fire mid-switch), ducking behind objects. Your own shots clear the cover you're touching; cover is hit by shots at someone sheltering behind it, but soft cover can let them through (see Penetration).
- Crouch look: kneels on the rifle-side knee (that boot sole-up behind), front knee splayed out with a knee pad, upper body hunched forward, drawn smaller, with a tighter, darker shadow.
- Peeking (`PEEK`, in `senseCover`): standing still with the view blocked within `PEEK.block` but open from a point `PEEK.dist` (11px) to one side → the character really shifts out that way (`cov.px/py` = body offset from the planted boots; eyes, muzzle and hitbox move with it). Drawn with boots planted, legs angled out, the dipped shoulder shaded, the head leading and the rifle canted. Bots peek by the same rule.

## Bullets, destruction, sound
- `makeBullet` / `stepBullet`: velocity with drag, ricochets off walls, metal and cars (`BUL`, `RICO`), glass shatters and slows rounds, furniture and doors take damage. Rounds fly at 3200 px/s (everyone's rifle), crossing the screen in about 0.1 s. Drag and thresholds (`BUL.vMin`, `RICO.minV`) are scaled so range and damage falloff stay as before.
- Tracers (`TRACER`, `tracers`, `stepTraced`): each frame a round leaves a thin streak from where it was to where it got to (the hit point if it struck something), brighter at the head, fading over `TRACER.life` with a faint glow. Yours are warm white, enemy rounds slightly orange.
- Walls are indestructible (no per-cell wall code anymore) but show damage (`wallHit`, `markWall`): a round leaves a pock-mark crater in the wall's own material (`MAT[wallMat[k]].exposed`; cracks on concrete and metal) just inside the face, painted into the floor art and clipped to the tile, throws chips and dust back out, and stops, or ricochets off concrete and metal (`RICO`). `wallMat` from `classifyWalls`: street-facing `#` and columns `C` concrete, elevators `E` metal, other `#` drywall. Light reaches `FACE_LIT` px into wall faces (`lightCast`), so the marks show where the wall is lit or in view. `MAT` holds each material's mark colour, chip colours and whether it ricochets.
- Penetration (`PEN`, `passThrough`): furniture (`FURN[c].mat`), doors and crates (wood), and built-ins (`FIXED_MAT`) may let a round through, slower: soft ~95%, wood ~85%, ceramic/thin metal ~40-50%, metal ~12%. Cover only protects if it's solid.
- Chunks (`launchChunk`, `chunkPts`, `CHUNK`): broken-off fragments are `poly` debris that pop up (`z`, `vz`), tumble, land, skid and bounce off walls, then settle into the floor art like all debris.
- Furniture: each hit bites a jagged piece out where it struck (edge chip or hole, `f.bites`, cap `BITE_MAX`) and launches it. `drawPieces` clips bites out (one clip per bite) and outlines the raw edges. When destroyed, the rest splits into a grid of chunks.
- Windows break in `GLASS_SEG` strips per tile (`glassSeg`, `glassStrip`, `paintGlassGap`): a round knocks out the strip it crosses (sometimes neighbours) as glass chunks and cracks the rest. Rounds pass freely through missing strips, and the tile turns `g` once all are gone.
- Doors break into planks; crates lose slat bites per hit and fall apart into slats.
- Sound: 96-ray extent per source, walls/doors/furniture muffle it. Footsteps reach `WALK_NOISE_MIN`–`WALK_NOISE_MAX` = 40–180 px (crawl to run), gunshots `GUN_NOISE` = 480. Only bots within `SQUAD.radio` = 450 px of a sighting get called in. Up to 2 bots investigate a loud sound; faint ones just make them look. Enemy sounds only show if they reach you. Enemy footsteps show as red step rings, at most twice a second per bot (`b.ringT`). You pick them out from `RINGS.hear` (1.6×) a step's sound reach; bots' hearing is unchanged. Enemy rings are bolder than yours (`WAVE_STYLE`, thicker `RINGS.width`) with a pulse dot at the source.

## Impact effects
`impactFx(kind, x, y, nx, ny)` (`IMPACT`), all in the sparks list drawn over the darkness:
- `spark` (metal, concrete ricochets, cars, counters, metal furniture): streak sparks plus a brief real flash of light (`flashes` take their own `r`, `k`, `col`, `t0`).
- `drywall` / `concrete`: a dust plume (smoke puffs), concrete with a few sparks.
- `plate` (ceramic plates, ceramic furniture): white powder puff, fragments, a shock ring. `helmet`: sparks, flash and a ring.
- `glass`: twinkling glints (`glint`) and fine dust. `wood` / `soft`: wood dust or fabric fluff.

## Blood
- `splat` (on a wound): lobed splash with a darker rim, spines thrown forward along the shot ending in droplets, and a fan of fine mist (`BLOOD_MIST`).
- Flung drops remember launch speed and direction (`v0`, `a0` from `spray`). `stampBlood` lands them via `bloodDrop`: fast ones stretch into teardrops with a tail and satellite droplet, slow drips land round.
- Pools (`addPool`, `drawPool`) have lobed edges (`q.lobes`), a dark drying rim and a wet sheen until they're stamped (`dry`).

## Gun smoke
`gunSmoke` emits per shot: a blast that jets out along the bore and stalls into a billow (each puff has its own `drag`, easing down to the drift), a slower cloud at the muzzle, a slant-brake puff to the right and an ejection-port wisp. The muzzle flash (`drawMuzzleFlash`, drawn in the rifle's frame) is different every shot: glow, ragged flame petals, brake-port jets, white-hot core.
- Casings (`ejectCasing`, `stepCasing`, `CASE`): fly in a real arc with height (`z`, `vz`), tumbling end over end (`tb`) over a floor shadow. They bounce with a glint (`tink`), ricochet off walls, furniture sides and people (not the shooter as they leave the port), can land on furniture and low built-ins: cars, counters, desks, sofas, sills (`caseFloor`). They bounce off tall things: walls, columns, crates, glass, shut doors (`caseTall`). A casing that starts inside something isn't pinned, and one ejected against a wall starts on the shooter's side, then roll on their side in a curve and get painted in when they stop. Each shot adds barrel `heat`; a hot barrel trails wisps (`barrelWisps`). Smoke stops at walls and is lit by the light map.

## Suppression
- `SUPP` constants; `c.supp` from 0 to 1. Built up by near misses (`whiz` in `stepBullet`, within 55px), impacts nearby (`suppressAt`), hits and cover jolts. It decays, faster in cover (`easeSupp`).
- Effects: shakier arms, wider cone. Bots also flinch instead of firing and stop advancing when pinned. The player's view gets tunnel vision (`SUPP_FX`). A smooth blur is built by halving the frame into `postLv` canvases (1/2, 1/4, 1/8, bilinear), then scaling back up; no `ctx.filter`, so it looks the same on iOS. It's masked to the edges so a spot ahead of you stays sharp, and it shrinks as stress rises. A darkening vignette pulses with a heartbeat. The look's strength follows `sqrt(supp)` and the vignette goes near black at the screen edge (`SUPP_FX.vig`/`vigIn`/`vigOut`), so it still reads on the dark, flashlight-free screen. Camera jitter is small (`SUPP_FX.shake`).

## Bots
States patrol → search → attack. BFS pathfinding with occupancy, stuck recovery, hearing. They follow the same rules as the player: arms, cover, shoulder switching, magazines (30 rounds, 2s reload, see Magazines), suppression, protection.
- Squad tactics (`SQUAD`, `squadThink`, `tactic`): whoever sees you sets `intel`. The nearest `SQUAD.team` bots get pulled in and given roles, re-thought every 0.5 s:
  - `suppress`: holds ground; without sight it keeps bursting into your last spot for `suppressFor` s.
  - `flank`: up to 2 go quietly (`findFlank`: off your side or behind relative to the suppressor, with a line to you, preferring spots outside your aim).
  - `cover`: hide/peek cycle via `findCover` (a hidden tile with a neighbouring peek tile), reloading in cover and ducking back when suppressed.
  - `ambush`: no fresh contact → hide out of your sight with the light off (`b.dark`) and wait.
  A lone bot uses cover. Roles clear when intel is older than `SQUAD.fresh`. Shooting goes through `botTryFire`.
- Staying out of the open:
  - Tactical moves use `safePath`: Dijkstra where tiles you can see from `intel` (`expo`, `computeExposure`) cost `SQUAD.expoPen` extra. Covered routes don't cut corners (`path.safe`).
  - Every engaged role fights through `coverCycle` (the suppressor with longer peeks; flankers switch to cover once they see you or finish waiting).
  - `findCover` accepts walls (hidden tile plus a peek tile) or low cover (`lowCoverToward`: sturdy furniture, counters, cars or sills between them and you; they press up against it and fire over it), then searches wider (`wideR`).
  - With no cover at all, `findShadow` picks a firing spot off to the side of your aim and repositions when your beam finds them.
  - Out of range, they bound cover to cover (`advanceByCover`) instead of walking at you, or hold if there's nowhere better.
- Careful, not careless (anywhere, inside or out):
  - Cover spots must hide the whole body (`bodyHidden`: centre and both shoulders out of your line). No peek lean while in the `hide` phase.
  - Shadow spots must be dark (`litByScene`); flank spots need low cover or darkness.
  - `routeOk` (`ROUTE`): a route crossing more than `maxRun` tiles you can see and that are lit is refused (unless you're pinned, `p.supp >= pinned`); the bot waits and retries.
  - `noCover`: with nowhere to go it fires if it sees you, else backs off to the nearest tile hidden from you. It never just walks at you.
  - Noises and searches in the street (`OUTDOOR` = 's','a','R', `isOut`, `insideNear`) send an indoor bot only to the nearest indoor spot first (`investigate`).
- Lost contact (`SWEEP`, `sweepThink`, `sweepStep`, `sweep`): after `SWEEP.lost` s without seeing you, the team (whoever had a role, or the nearest bot) gets role `sweep`.
  - Rearm: anyone with plates below `needPlate`, no helmet or under `needAmmo` rounds goes for the best loot within `lootR` (`botGain`, `botTake`: same upgrade/swap rules as yours) and tops up the rifle; the team waits up to `rearmT`.
  - Sweep: rooms (`computeRooms`: connected open floor of one floor code, scraps under `minRoom` merged into a neighbour) are cleared starting from the one you vanished in, then outward, up to `SWEEP.rooms`. Per room (`nextRoom`): stack at the doorway nearest the team, enter one after another (`gap`), each takes a far-apart point (farthest-point spread), scans for `hold` s.
  - Any sighting hands back to combat roles. After the last room (or `maxT`) intel is dropped and they patrol.
- Out of ammo (rifle and vest empty, `dryBot`, `DRY`): they stop fighting and run for the best magazine on the floor, scoring ones near you lower. With none left, they hide out of your sight (`hideSpot`) and watch the way you'd come. Once rearmed, they head back to where they last saw you.

## Not built yet (ideas)
Squad teammates for the player, a shrinking zone, more weapons and weapon switching, menus and character select, saved progress, real audio, an on-screen indicator for protection if needed, app packaging for forced landscape on iOS.
