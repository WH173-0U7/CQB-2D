# CQB-2D

A top-down tactical shooter at night, inspired by Bullet Echo. You clear family homes held by armed men, get the residents out alive, then drive home to rearm and upgrade. Every house is generated from real floor-plan data, and no two are the same.

The whole game is one self-contained, offline HTML file (`index.html`), with no install, no network requests and no build step.

**Play:** https://magical-caramel-1bef55.netlify.app/

**Preview (latest work, not yet deployed):** https://preview--magical-caramel-1bef55.netlify.app/

It plays best on a phone in landscape; keyboard and mouse also work. Netlify redeploys the main link on every push to `main`, and the preview link on every push to `preview`.

## How a run goes

1. **Safe house.** You start at home, with a bedroom, kitchen, living room, armory and backyard. Fit attachments at the workbench, pick gear at the locker and top up at the restock crates.
2. **Deploy.** Get in your car. Every mission is a brand-new house, and dying there builds another one.
3. **Clear the house.** A few gunmen hold the residents hostage. Slow motion kicks in on the last kill.
4. **Rescue.** Walk up to survivors to zip-tie them and they follow you. Drive home with them.
5. **Hand over.** Bring them to the officer out back for medals. Kills you made with each gun count only if you make it home.

## Controls

| | Touch | Keyboard / mouse |
|---|---|---|
| Move | Left half of the screen | WASD |
| Aim | Right half of the screen | Mouse (Q/E look ahead) |
| Fire | Automatic when the red cone locks onto an enemy | Automatic |
| Reload | Reload button | R |
| Weapon / grenade picker | Hold reload, drag onto a choice | Hold R, or X to switch gun |
| Throw grenade | Hold THROW, slide to aim, release | G |
| Night vision up/down | NVG button | N |
| Mute (shows sounds as rings) | Speaker button | M |
| Settings (sensitivity, volume, kill taunts) | Gear button | Gear button |

Standing still braces you, which tightens the cone and adds a little range.

## Features

### Generated homes
- Built from real data:
  - room sizes and how often each room exists, from the NAHB "Spaces in New Homes" survey;
  - house sizes and garages, from the US Census;
  - minimum room and hallway sizes, from the International Residential Code;
  - layout patterns, from published house plans.
- Small, medium and large homes, in five layouts:
  - center hall;
  - cross hall;
  - open plan beside a bedroom hallway;
  - L-shaped wing;
  - split-bedroom ranch.
- Many have an attached garage.
- Real rooms: master suites with en-suite and walk-in closet, family rooms, breakfast nooks, pantries, mudroom laundries, powder rooms, studies and foyers. Hallways are 1 or 2 tiles wide.
- Furniture is real-sized and placed the way people actually furnish rooms. Every bedroom has a bed and an outside window, and no floor is walled off.
- About 1.2 billion playable layouts, each unique down to its furniture.
- It's night: each room's ceiling light is on or off, depending on the room.

### Combat
- **Weapons:**
  - an AK-47 that fires automatically on lock;
  - a Glock 17 sidearm, which comes out on its own when the rifle runs dry;
  - an automatic knife at close range, where the body on the blade becomes a shield.
- **The rifle is a physical object.** Its barrel is pulled in or swung aside at walls, nudges doors open, and won't fire through a teammate or a civilian.
- **Ballistics:**
  - rounds slow down with drag and ricochet off concrete, metal and cars;
  - they punch through soft cover depending on the material;
  - tracers show where each one went;
  - the 9 mm is weaker against armour.
- **Cover:** wall hugging, mounting on corners and sills, switching shoulders, peeking round corners and crouching.
- **Armour instead of a health bar:**
  - front and back plates and a helmet chip, crack and shatter;
  - the next unprotected hit kills or downs you;
  - downed fighters, including you, bleed out and crawl for cover.
- **Magazines are real objects.** You carry four; a reload drops the old one, and you can take fresh ones off the fallen.
- **Grenades:** M84 stun grenades blind and deafen; Mk3A2 concussion grenades blast, shove, break glass and blow doors open. A dotted arc previews each throw.
- **Suppression:** near misses shake your aim, and the view narrows into tunnel vision under fire.

### Darkness and sight
- Without a light you see only a dim area around you. People are made out close up, or at full range when lit by lamps, the TV, muzzle flashes or headlights. Enemies follow the same rules.
- **Night vision** (AN/PVS-14 monocular) brightens a narrow field ahead of you in white phosphor.
- **Weapon light and lasers:**
  - a visible laser gives you away to anyone facing it;
  - an infrared laser shows only through your night vision.
- Walls and swinging doors cast real shadows.

### Enemies
- Each gunman has a personality (veteran, rusher, cautious, green or marksman), his own look and a randomly kitted rifle.
- **Squad tactics:** they suppress, flank, fight from cover and lie in ambush. They avoid open, lit routes and bound from cover to cover.
- They hear footsteps, gunshots, doors and breaking glass.
- **Losing you:** after losing contact they rearm from loot, then sweep the house room by room.
- Some guard a room; others hunt hostages if you take too long.

### Your teammate
- A US Army teammate follows you through doors and watches the flank you aren't covering.
- He fights from cover and pulls back when pinned.
- When downed, he crawls to you.
- At home he sits on the sofa watching TV.

### Civilians and rescue
- Residents wear their own clothes: pyjamas, bathrobes, scrubs, suits, hoodies and more.
- Hostages cower and run when shots go off close by.
- Once the house is clear, secure them with zip ties and bring them home.

### Progression (saved in your browser)
- **Workbench:** attachments on real kit at real sizes, played out by hand as you fit them. Each unlocks by kills with that gun, then costs medals.
  - **AK-47:** vertical grip, visible or infrared laser, red dot, suppressor, padded sling (swinging with rope physics).
  - **Glock:** laser, weapon light, red dot.
- **Gear locker:** night vision, grenades, and your loadout (plates, helmet, spare magazines). Weight changes your speed.

### Destruction and detail
- **Furniture:** chunks come out of it where it's hit, and it breaks apart.
- **Doors and windows:** doors are physics hinges that can be shot apart; windows shatter strip by strip.
- **Walls** keep bullet marks.
- **Blood:** splatter, pools, smears and spray on the walls.
- **Spent casings** bounce and roll.
- **Gun smoke** trails from hot barrels.
- **Bodies** are ragdolls with real joint limits.
- **Cars** have tyres, glass, lights and doors that can each be shot.

### Sound
- **Recordings:** 240+ real recordings embedded in the page, all CC0 or CC-BY.
- **Positional:** sounds are heard by distance with real travel delay, round corners or muffled through walls, with room reverb from recorded spaces.
- **Voices:** grunts when armour is hit, screams on a lethal hit, groans the whole time someone is bleeding out and a last breath when they die, and kill taunts from you, your teammate and the enemy (switchable in Settings).
- **Muted mode:** turns sounds into on-screen rings, for playing without audio.

## Credits

Every sound is CC0 or CC-BY. The full list, with attribution for the CC-BY sources, is in the game under the "i" button. Gun outlines are traced from public-domain US government photos.

## For developers

Pure HTML, JavaScript and Canvas 2D in one file, with no frameworks. `CLAUDE.md` is the detailed developer guide to every system and its tuning constants.
