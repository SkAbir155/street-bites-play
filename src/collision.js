// Builds the rectangles (in px) that people can't walk through,
// from a restaurant layout.

const FEET = { w: 20, h: 8 }; // the part of a person that bumps into things

// Returns a function telling whether a person's feet fit at (x, y) px.
// `role` (waiter, customer, chef, ...) also keeps them out of the layout's
// restricted areas they aren't allowed in, like the kitchen or the car park.
function makeCanStand(layout, role) {
  const T = layout.tileSize, a = layout.walkArea;
  const blockers = buildBlockers(layout);
  for (const area of layout.restricted || []) {
    if (!area.allow.includes(role)) blockers.push(new Phaser.Geom.Rectangle(area.x * T, area.y * T, area.w * T, area.h * T));
  }
  const bounds = new Phaser.Geom.Rectangle(a.x * T, a.y * T, a.w * T, a.h * T);
  const feet = new Phaser.Geom.Rectangle();
  return (x, y) => {
    feet.setTo(x - FEET.w / 2, y - FEET.h + 2, FEET.w, FEET.h);
    if (!Phaser.Geom.Rectangle.ContainsRect(bounds, feet)) return false;
    return !blockers.some(b => Phaser.Geom.Intersects.RectangleToRectangle(b, feet));
  };
}

const SOLID = new Set([
  'prep', 'stove', 'grill', 'fridge', 'sink', 'dishRack', 'counter',
  'dishBin', 'trash', 'hostStand', 'bench', 'table', 'plant', 'pickupWindow', 'planter', 'hedge', 'floorLamp', 'flowerStand',
]);

function buildBlockers(layout) {
  const T = layout.tileSize;
  const rects = [];
  const add = (x, y, w, h) => rects.push(new Phaser.Geom.Rectangle(x, y, w, h));

  for (const o of layout.objects) {
    if (SOLID.has(o.type)) add(o.x * T, o.y * T, o.w * T, o.h * T);

    if (o.type === 'table') {
      for (const [sx, sy] of tableSeats(o, T)) add(sx - 12, sy - 6, 24, 10);
    }
    if (o.type === 'lampPost') {
      add((o.x + o.w / 2) * T - 8, (o.y + o.h) * T - 12, 16, 10);
    }
    if (o.type === 'rope') {
      const [[x1, y1], [x2, y2]] = o.points;
      add(Math.min(x1, x2) * T - 4, Math.min(y1, y2) * T - 4,
        Math.abs(x2 - x1) * T + 8, Math.abs(y2 - y1) * T + 8);
    }
    if (o.type === 'sideWall') add(o.x * T - 6, o.y * T, 12, o.h * T);
    if (o.type === 'partition' || o.type === 'frontWall') {
      // two wall pieces with the door gap between them
      add(o.x * T, o.y * T, (o.doorX - o.x) * T, o.h * T + 4);
      add((o.doorX + o.doorW) * T, o.y * T, (o.x + o.w - o.doorX - o.doorW) * T, o.h * T + 4);
    }
    if (o.type === 'stallWalls') {
      const left = o.x * T, right = (o.x + o.w) * T;
      add(left - 6, o.y * T, 12, o.h * T);
      for (const [top, bottom] of rightWallSegments(o, T)) add(right - 6, top, 12, bottom - top);
    }
  }
  return rects;
}
