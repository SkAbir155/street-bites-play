// Layout for the first location: a small indoor restaurant on a street.
// Everything is measured in tiles (1 tile = tileSize pixels).
// To make a new location later, copy this file and change the data.
//
//  ┌ kitchen wall ─┬──── brick wall: sign, menu ────┬─ P ─┐
//  │ KITCHEN       │  [T1]      [T2]      [T3]      │ car │
//  │──wall─door───▐│ pickup    DINING ROOM          │ park│
//  │ CASHIER  ▣    │  [T4]      [T5]      [T6]      │     │
//  │═front counter═│                                │     │
//  │ LOBBY / pay   │ greeter                        │     │
//  └──── front wall with windows ── DOOR ── windows ┘     │
//    sidewalk
//    road

window.GameData = window.GameData || {};
GameData.layouts = GameData.layouts || {};

GameData.layouts.streetStall = {
  id: 'street-stall',
  name: 'Street Bites Restaurant',
  tileSize: 40,
  width: 33,   // tiles → 1320 px
  height: 16,  // tiles → 640 px

  // Where people's feet are allowed to go (keeps them off the back wall and road).
  walkArea: { x: 0, y: 2.3, w: 33, h: 11.6 },

  // The building (with its back wall): lit from inside after dark.
  indoors: { x: 1, y: 0, w: 23, h: 12 },
  // Lights without a lamp of their own to draw (ceiling lights): where their
  // pool of light falls, its radius in px and strength. Table lanterns, the
  // floor lamp, string lights and street lamps add their own.
  lights: [
    // (`pendant` hangs a lamp picture there: `bottom` is how high up the screen
    // the lamp ends, `floor` the floor line it hangs over; both in tiles. They
    // hang over counters, where nobody's face can end up behind them.)
    { x: 5.4, y: 3.6, r: 135 },                             // kitchen, over the cooking row
    { x: 2.4, y: 4.6, r: 85, power: 0.8 },                  // sink
    { x: 6, y: 7.6, r: 95, power: 0.6 },                    // cashier (a bare ceiling bulb)
    { x: 4.8, y: 10.6, r: 85, power: 0.5 },                 // lobby (ceiling light)
    { x: 11.4, y: 12.2, r: 85, power: 0.7 },                // front door
  ],

  // Areas only some roles may enter. Everyone else is kept out.
  restricted: [
    { name: 'Kitchen & cashier (staff only)', x: 1, y: 2, w: 9, h: 7, allow: ['chef', 'cleaner', 'cashier'] },
    { name: 'Parking lot',                    x: 24, y: 2, w: 9, h: 10, allow: [] },
  ],

  // Floors and backgrounds, drawn first.
  ground: [
    { type: 'wall',       x: 0,  y: 0,  w: 33, h: 2 },
    { type: 'backsplash', x: 1,  y: 0,  w: 9,  h: 2 },   // tiled kitchen wall
    { type: 'pavement',   x: 0,  y: 2,  w: 33, h: 10 },
    { type: 'stallFloor', x: 1,  y: 2,  w: 9,  h: 4 },   // kitchen tiles
    { type: 'woodFloor',  x: 1,  y: 6,  w: 9,  h: 3 },   // cashier area
    { type: 'woodFloor',  x: 1,  y: 9,  w: 9,  h: 3 },   // lobby
    { type: 'woodFloor',  x: 10, y: 2,  w: 14, h: 10 },  // dining room
    { type: 'parking',    x: 24.2, y: 2, w: 8.8, h: 10 },
    { type: 'grass',      x: 24.4, y: 8.8, w: 6.6, h: 3 },
    { type: 'sidewalk',   x: 0,  y: 12, w: 33, h: 2 },
    { type: 'driveway',   x: 31.4, y: 12, w: 1.6, h: 2 },
    { type: 'road',       x: 0,  y: 14, w: 33, h: 2 },
    { type: 'crosswalk',  x: 13, y: 14.15, w: 4, h: 1.7 },
  ],

  // Car park: 3 spaces facing the aisle, reached by a lane on the right from
  // the driveway. Cars come and go on their own.
  parking: {
    laneX: 32.2,     // the lane between the aisle and the driveway
    aisleY: 6.8,     // the aisle in front of the spaces
    roadInY: 14.55,  // road lane for cars arriving (driving left)
    roadOutY: 15.45, // road lane for cars leaving (driving right)
    spots: [
      { x: 25.6, y: 3.9, row: 1 }, { x: 27.8, y: 3.9, row: 1 }, { x: 30.0, y: 3.9, row: 1 },
    ],
  },

  // Areas where each role works. Shown as coloured overlays.
  zones: [
    { id: 'kitchen',   label: 'Kitchen',          role: 'chef',    x: 2,  y: 2,   w: 8,  h: 3.8 },
    { id: 'dishwash',  label: 'Dish wash',        role: 'cleaner', x: 1,  y: 2,   w: 1,  h: 3.8 },
    { id: 'pickup',    label: 'Pickup',           role: 'waiter',  x: 10, y: 3.5, w: 1.6, h: 2.8 },
    { id: 'cashier',   label: 'Pay here',         role: 'cashier', x: 5,  y: 6,   w: 5,  h: 5.8 },
    { id: 'bus',       label: 'Trash',            role: 'cleaner', x: 10, y: 6.3, w: 2,  h: 1.8 },
    { id: 'entrance',  label: 'Entrance',         role: 'greeter', x: 10.4, y: 10, w: 4.2, h: 1.8 },
    { id: 'dining',    label: 'Dining room',      role: 'waiter',  x: 11.6, y: 2, w: 12.4, h: 8 },
  ],

  // Furniture and equipment. `name` is shown when you tap/hover.
  objects: [
    // ---------- Building ----------
    // Kitchen + cashier block: left wall, and a right wall with the kitchen's
    // pickup window and a staff door out of the cashier area.
    { type: 'stallWalls', name: 'Kitchen walls', x: 1, y: 2, w: 9, h: 7,
      gaps: [{ y: 4, h: 2, kind: 'window' }, { y: 7, h: 1, kind: 'door' }] },
    // Wall between the kitchen and the cashier area, with a staff door on the left.
    { type: 'partition',  name: 'Kitchen wall', x: 1, y: 5.8, w: 8, h: 0.2, doorX: 2.1, doorW: 1 },
    { type: 'sideWall',   name: 'Lobby wall',   x: 1,  y: 9, h: 3 },
    { type: 'sideWall',   name: 'Side wall',    x: 24, y: 2, h: 10 },
    // Front of the building: windows, and the front door onto the sidewalk.
    { type: 'frontWall',  name: 'Front wall',   x: 1, y: 11.8, w: 23, h: 0.2, doorX: 10.4, doorW: 2 },

    // ---------- On the walls ----------
    { type: 'shelf',      name: 'Shelf',       x: 1.3, y: 0.75, w: 3, h: 0.4 },
    { type: 'hood',       name: 'Cooker hood', x: 6, y: 0.6, w: 2, h: 1.15 },   // over the grill
    { type: 'sign',       name: 'Shop sign',   x: 12, y: 0.3, w: 5, h: 1.4, text: 'STREET BITES' },
    { type: 'menuBoard',  name: 'Menu board',  x: 17.4, y: 0.15, w: 6.2, h: 1.7 },
    { type: 'parkingSign', name: 'Parking sign', x: 25.2, y: 0.3, w: 4.6, h: 1.4 },

    // ---------- Kitchen ----------
    { type: 'sink',     name: 'Sink',         x: 1, y: 2, w: 1, h: 2 },
    { type: 'dishRack', name: 'Drying rack',  x: 1, y: 4, w: 1, h: 1.8 },
    { type: 'prep',     name: 'Prep counter', x: 2, y: 2, w: 2, h: 1 },
    { type: 'stove',    name: 'Stove',        x: 4, y: 2, w: 2, h: 1 },
    { type: 'grill',    name: 'Grill',        x: 6, y: 2, w: 2, h: 1 },
    { type: 'fridge',   name: 'Fridge',       x: 8, y: 2, w: 2, h: 2 },
    // Pickup window in the kitchen's right wall, facing the dining room
    { type: 'pickupWindow', name: 'Pickup window', x: 9, y: 4, w: 1, h: 2 },

    // ---------- Cashier & lobby ----------
    { type: 'counter',   name: 'Front counter', x: 1, y: 8, w: 9, h: 1 },
    { type: 'register',  name: 'Cash register', x: 6, y: 8, w: 2, h: 1 },
    // (short ropes: customers walk into the line from behind)
    { type: 'rope', name: 'Pay line', points: [[6.3, 9.3], [6.3, 10.5]] },
    { type: 'rope', name: 'Pay line', points: [[8.1, 9.3], [8.1, 10.5]] },

    // ---------- Dining room ----------
    // (tables, chairs and decorations are placed by the player: see `slots` below)
    // Trash for unwanted food and the dirty dish bin, right by the pickup window
    { type: 'trash',     name: 'Trash can',      x: 10.1, y: 6.4, w: 1, h: 1 },
    { type: 'dishBin',   name: 'Dirty dish bin', x: 10.3, y: 7.4, w: 1.2, h: 0.9 },
    // Greeter's host stand beside the front door
    // (`buy`: only there once that shop item has been bought)
    { type: 'hostStand', name: 'Host stand',     x: 13.1, y: 10.7, w: 1, h: 1, buy: 'greeter' },

    // ---------- Outside ----------
    { type: 'entrance',  name: 'Welcome mat',   x: 10.4, y: 13.05, w: 2, h: 1 },
    { type: 'lampPost',  name: 'Street lamp',   x: 8.4,  y: 11.9, w: 1, h: 1 },
    { type: 'lampPost',  name: 'Street lamp',   x: 23.4, y: 11.9, w: 1, h: 1 },
    { type: 'tree',      name: 'Tree',          x: 25.2, y: 9.9, w: 1.6, h: 1.6 },
    { type: 'tree',      name: 'Tree',          x: 28.4, y: 10.1, w: 1.6, h: 1.6 },
  ],

  // Places where the player puts tables and decorations (see src/furniture.js).
  // `kind` says what fits: tableBig / tableSmall (tables; each table then has
  // its own chair and table-top places), floor (small things), wide (a bench or
  // a flower box, or small things), sideWall, backWall, hanging, garland.
  slots: [
    { id: 'T1', kind: 'tableBig',   name: 'Big table, top left',      x: 12.1, y: 3.4, w: 2, h: 2 },
    { id: 'T2', kind: 'tableBig',   name: 'Big table, top middle',    x: 16.3, y: 3.4, w: 2, h: 2 },
    { id: 'T3', kind: 'tableBig',   name: 'Big table, top right',     x: 20.5, y: 3.4, w: 2, h: 2 },
    // (no table at the bottom-left: that corner is the service spot by the pickup window)
    { id: 'T4', kind: 'tableSmall', name: 'Small table, bottom middle', x: 16.3, y: 8.4, w: 2, h: 1 },
    { id: 'T5', kind: 'tableSmall', name: 'Small table, bottom right',  x: 20.5, y: 8.4, w: 2, h: 1 },

    { id: 'F1', kind: 'floor', name: 'Lobby corner',                  x: 1.2,  y: 9.3,  w: 0.8, h: 0.8 },
    { id: 'F2', kind: 'floor', name: 'Lobby, by the bench',           x: 4.4,  y: 10.3, w: 1,   h: 1 },
    { id: 'W1', kind: 'wide',  name: 'Lobby, by the wall',            x: 2,    y: 10.4, w: 2,   h: 1 },
    { id: 'F3', kind: 'floor', name: 'Beside the host stand',         x: 14.4, y: 10.8, w: 0.8, h: 0.8 },
    { id: 'F4', kind: 'floor', name: 'Dining room, top right corner', x: 22.9, y: 2.1,  w: 1,   h: 1 },
    { id: 'F5', kind: 'floor', name: 'Dining room, bottom right corner', x: 22.9, y: 10.6, w: 1, h: 1 },

    { id: 'O1', kind: 'wide',  name: 'Outside, under the left windows',   x: 3.2,  y: 12.05, w: 3.6, h: 0.7 },
    { id: 'O2', kind: 'wide',  name: 'Outside, under the middle windows', x: 14.8, y: 12.05, w: 3.6, h: 0.7 },
    { id: 'O3', kind: 'wide',  name: 'Outside, under the right windows',  x: 19.4, y: 12.05, w: 3.6, h: 0.7 },
    { id: 'O4', kind: 'floor', name: 'Outside, left of the door',         x: 7.2,  y: 12.05, w: 0.8, h: 0.8 },
    { id: 'O5', kind: 'floor', name: 'Outside, right of the door',        x: 13,   y: 12.05, w: 0.8, h: 0.8 },

    { id: 'R1', kind: 'sideWall', name: 'Right wall, upper', x: 23.25, y: 6.1, w: 0.7, h: 0.7 },
    { id: 'R2', kind: 'sideWall', name: 'Right wall, lower', x: 23.25, y: 9.9, w: 0.7, h: 0.7 },
    { id: 'B1', kind: 'backWall', name: 'Back wall, by the sign',   x: 16.7, y: 1, w: 0, h: 0 },  // (x, y: the centre)
    { id: 'B2', kind: 'backWall', name: 'Back wall, by the window', x: 11,   y: 1, w: 0, h: 0 },

    // (`light`: where a hanging lamp's light falls, and where its picture hangs)
    { id: 'H1', kind: 'hanging', name: 'Over the counter, left',  light: { x: 3, y: 8.1, r: 100, pendant: { bottom: 7.65, floor: 9.25 } } },
    { id: 'H2', kind: 'hanging', name: 'Over the counter, right', light: { x: 8.8, y: 8.1, r: 100, pendant: { bottom: 7.65, floor: 9.25 } } },
    { id: 'H3', kind: 'hanging', name: 'Over the pickup window',  light: { x: 10.4, y: 5.1, r: 85, pendant: { x: 9.5, bottom: 3.6, floor: 6 } } },
    { id: 'G1', kind: 'garland', name: 'Across the dining room',  points: [[10.6, 2.5], [17.3, 3.0], [23.7, 2.5]] },
  ],
};
