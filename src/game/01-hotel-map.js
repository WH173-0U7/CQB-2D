/* ================= MAP: a small boutique hotel, ground floor (36 x 30 tiles, ~0.9 m each) ================= */
/* One character per 48px tile, two layers.
   SOLID  '.' open   '#' wall (can be shot through, slowly)   'E' elevator doors   'C' column   'X' stacked crates
          'G' window: see and shoot through, can't walk through; one bullet shatters it ('g' = broken)
          'S' sofa/bench  'D' desk/counter/piano  'B' bar  'K' steel counter  't' table  'P' planter  'L' luggage cart
          'c' car  'y' taxi
          Sofas, tables, planters, desks, the piano and the luggage cart are movable furniture (pushed around, shot apart).
          Big built-ins (bar, kitchen counters, reception desk, meeting table, the long banquette) and cars stay put.
   FLOOR  'm' lobby marble  'M' entrance mat  'e' elevator hall  'w' restaurant wood  'k' kitchen tile
          'u' restroom tile  'o' office carpet  'r' lounge carpet  'z' back-of-house concrete
          's' sidewalk  'R' red carpet  'a' street */
const MAP_SOLID = [
  '####################################',
  '#XX................................#',
  '#...................X.............X#',
  '####.########EE#.EE######.######.###',
  '#K....KK#...#......#...#....#......#',
  '#K......#...#L.....#...#DD..#......#',
  '#K.KKKK.#...#......#...#....#.DDDD.#',
  '#K.KKKK.#...#......#...#..DD#.DDDD.#',
  '#K......#...#......#...#....#......#',
  '#K......#...#......#...#....#......#',
  '####..#####.##....##.#####.##.######',
  '#........#P..........#........BBBBB#',
  '#S.......#.........D.#.DD.....B...B#',
  '#S.t..t..#..C......D.#.DD.....B...B#',
  '#S.................D.#........B...B#',
  '#S.................D..........B...B#',
  '#S.t..t............D...t..t...B...B#',
  '#S.......#....................B...B#',
  '#S.......#.t.........#...t.........#',
  '#S..t....#...........#.............#',
  '#........#SSS.....P..#..SSS........#',
  '##GG#.GG###GG#...#GG###GGG##GGG##.##',
  '#.......P.............P............#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '####################################'
];
const MAP_FLOOR = [
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'zzzzkzzzzzzzzzzzezzzzzzzzozzzzzzozzz',
  'zkkkkkkkzuuuzeeeeeezuuuzoooozooooooz',
  'zkkkkkkkzuuuzeeeeeezuuuzoooozooooooz',
  'zkkkkkkkzuuuzeeeeeezuuuzoooozooooooz',
  'zkkkkkkkzuuuzeeeeeezuuuzoooozooooooz',
  'zkkkkkkkzuuuzeeeeeezuuuzoooozooooooz',
  'zkkkkkkkzuuuzeeeeeezuuuzoooozooooooz',
  'zzzzkkzzzzzuzzeeeezzuzzzzzozzozzzzzz',
  'zwwwwwwwwzmmmmmmmmmmmzrrrrrrrrrrrrrz',
  'zwwwwwwwwzmmmmmmmmmmmzrrrrrrrrrrrrrz',
  'zwwwwwwwwzmmmmmmmmmmmzrrrrrrrrrrrrrz',
  'zwwwwwwwwmmmmmmmmmmmmzrrrrrrrrrrrrrz',
  'zwwwwwwwwmmmmmmmmmmmmrrrrrrrrrrrrrrz',
  'zwwwwwwwwmmmmmmmmmmmmrrrrrrrrrrrrrrz',
  'zwwwwwwwwzmmmmmmmmmmmrrrrrrrrrrrrrrz',
  'zwwwwwwwwzmmmmmmmmmmmzrrrrrrrrrrrrrz',
  'zwwwwwwwwzmmmmmmmmmmmzrrrrrrrrrrrrrz',
  'zwwwwwwwwzmmmmMMMmmmmzrrrrrrrrrrrrrz',
  'zzzzzwzzzzzzzzMMMzzzzzzzzzzzzzzzzrzz',
  'zsssssssssssssRRRssssssssssssssssssz',
  'zsssssssssssssRRRssssssssssssssssssz',
  'zsssssssssssssRRRssssssssssssssssssz',
  'zaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaz',
  'zaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaz',
  'zaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaz',
  'zaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
];
const HOUSE_SOLID = [
  '####################################',
  '#..................................#',
  '#..................................#',
  '#.....###################.####.....#',
  '#.....#........#.....#.......#.....#',
  '#.....#......D.#.....#.DD...X#.....#',
  '#.....#........#.....#......X#.....#',
  '#.....#........#.....#......X#.....#',
  '#.....#........#.....#......X#.....#',
  '#.....#........#.....#.......#.....#',
  '#.....#........#.....#.......#.....#',
  '#.....#####.######.######.####.....#',
  '#.....#P............#........#.....#',
  '#.....#.............#........#.....#',
  '#.....#......................#.....#',
  '#.....#..tt.............tt...#.....#',
  '#.....#......................#.....#',
  '#.....#.............#........#.....#',
  '#.....#.SSSS........#........#.....#',
  '#.....#............P#.KKKKKK.#.....#',
  '#.....######.#################.....#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '####################################'
];
const HOUSE_FLOOR = [
  'ssssssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssssssss',
  'sssssszzzzzzzzzzzzzzzzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszoooooooozuuuuuzzzzzzzzzssssss',
  'sssssszzzzzozzzzzzuzzzzzzzzzzzssssss',
  'sssssszwwwwwwwwwwwwwzkkkkkkkkzssssss',
  'sssssszwwwwwwwwwwwwwzkkkkkkkkzssssss',
  'sssssszwwwwwwwwwwwwwkkkkkkkkkzssssss',
  'sssssszwwwwwwwwwwwwwkkkkkkkkkzssssss',
  'sssssszwwwwwwwwwwwwwkkkkkkkkkzssssss',
  'sssssszwwwwwwwwwwwwwzkkkkkkkkzssssss',
  'sssssszwwwwwwwwwwwwwzkkkkkkkkzssssss',
  'sssssszwwwwwMwwwwwwwzkkkkkkkkzssssss',
  'sssssszzzzzzwzzzzzzzzzzzzzzzzzssssss',
  'ssssssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssssssss',
  'saaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaas',
  'saaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaas',
  'saaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaas',
  'saaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaas',
  'saaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaas',
  'ssssssssssssssssssssssssssssssssssss'
];
const T = 48, W = MAP_SOLID[0].length, H = MAP_SOLID.length;   // every map is the same size
const grid = new Uint8Array(W * H);     // 1 = blocks movement (walls, built-ins, closed doors, crates)
const opq  = new Uint8Array(W * H);     // 1 = blocks light and sight
const solidAt = new Array(W * H), floorAt = new Array(W * H);
const BASE_GRID = new Uint8Array(W * H), BASE_OPQ = new Uint8Array(W * H), BASE_SOLID = new Array(W * H);
const SPAWN = { x: 0, y: 0 };
