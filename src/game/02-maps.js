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
  // house: the safe house, built by the home generator in its safe mode (MAPS.house = safeHouse(), see GENERATED MISSIONS)
};
