/* ================= MAPS =================
   Every location is its own map of the same size: layout, spawn, doors, light fixtures, loot, enemies and its way out.
   `travel(name)` swaps the map and rebuilds the world. Map-specific furniture and floor decals live in buildProps /
   buildFloorArt under MAP.id. */
const MAPS = {
  hotel: { id: 'hotel', solid: MAP_SOLID, floor: MAP_FLOOR, spawn: [15.5, 23.5],   // out on the street, facing the hotel entrance
    doors: [
      [4, 10, 5, 10, true],    // kitchen swing doors
      [11, 10, 11, 10, true],  // men's restroom
      [20, 10, 20, 10, true],  // women's restroom
      [4, 3, 4, 3, true],      // kitchen -> back corridor
      [16, 3, 16, 3, true],    // stairwell (between the elevators)
      [25, 3, 25, 3, false],   // office -> back corridor
      [32, 3, 32, 3, false],   // meeting room -> back corridor
      [26, 10, 26, 10, false], // office -> lounge
      [29, 10, 29, 10, false], // meeting room -> lounge
      [5, 21, 5, 21, true],    // restaurant street door
      [33, 21, 33, 21, true]], // lounge fire exit
    bots: [[4, 9], [16, 1], [25, 8], [26, 14], [3, 11]], loot: {},   // no loot lying about: everything comes off the enemy
    exit: { veh: 'taxi', door: 'RL', x: 10.5, y: 23.6, r: 28, hold: 1.5, to: 'house', needClear: true, label: 'TAXI', title: 'AREA CLEAR', sub: 'Get in the taxi' } },   // at the taxi's rear door
  house: { id: 'house', solid: HOUSE_SOLID, floor: HOUSE_FLOOR, spawn: [12.5, 18.4],   // just inside the front door
    doors: [[12, 20, 12, 20, true], [11, 11, 11, 11, false], [18, 11, 18, 11, false], [25, 11, 25, 11, false], [25, 3, 25, 3, true]],   // ...and the back door out of the armory
    bots: [], loot: {},
    fixtures: [
      ['exit', 12.5, 19.92, 16, 6, 12.5, 19.5, 100, [90, 255, 140], 0.35, 1],       // over the front door
      ['hood', 25, 19.5, 40, 12, 25, 19, 150, [255, 236, 200], 0.45, 2],            // kitchen hood over the counter (south wall)
      ['mirror', 18.5, 4.06, 26, 4, 18.5, 4.6, 110, [220, 240, 255], 0.4, 2],        // bathroom mirror
      ['tube', 25.5, 4.06, 34, 4, 25.5, 5, 200, [215, 235, 255], 0.6, 1],           // armory work light
      ['tube', 12.5, 21.06, 16, 4, 12.5, 21.5, 160, [255, 220, 170], 0.5, 1],          // porch light
      ['ceil', 11, 8.5, 14, 14, 11, 8.5, 230, [255, 214, 160], 0.45, 1],             // ceiling lights: bedroom, bathroom, armory, living room (two), kitchen
      ['ceil', 18.5, 8, 14, 14, 18.5, 8, 170, [255, 220, 175], 0.5, 1],
      ['ceil', 25.5, 8.5, 14, 14, 25.5, 8.5, 210, [255, 214, 160], 0.45, 1],
      ['ceil', 10.5, 16.5, 14, 14, 10.5, 16.5, 230, [255, 214, 160], 0.45, 1],
      ['ceil', 16.5, 16.5, 14, 14, 16.5, 16.5, 230, [255, 214, 160], 0.45, 1],
      ['ceil', 25, 16.5, 14, 14, 25, 16.5, 220, [255, 214, 160], 0.45, 1]].map(r => [r[0], r[1] * T, r[2] * T, r[3], r[4], r[5] * T, r[6] * T, ...r.slice(7)]),   // ...in world px
    restock: { x: 26.9, y: 6.5 },                                           // in front of the armory gear crates
    bench: { x: 24, y: 6.7 },
    locker: { x: 27.75, y: 9.9 },                                            // in front of the gear locker on the east wall (see GEAR LOCKER)                                                // in front of the armory workbench (see WORKBENCH); sy: where you stand to work at it
    exit: { veh: 'mine', door: 'FL', x: 16, y: 24.6, r: 28, hold: 1.2, to: 'mission', needClear: false, label: 'CAR', title: 'SAFE HOUSE', sub: 'Get in your car to deploy' } }   // at your car's driver door
};
