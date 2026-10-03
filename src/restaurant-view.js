// Draws a restaurant layout (from src/layouts/) in a 3/4 top-down view:
// floors are seen from above, while furniture shows its front face and
// sticks up above its floor spot. Everything is drawn with shapes; textures
// (bricks, planks, stones) use a fixed random seed so they look the same
// every time.
//
// Draw order: anything lower on the screen is drawn on top (depth = the y of
// its bottom edge). People use the same rule, so they walk behind and in front
// of furniture correctly.
//
// Later, real art can replace any object: load an image whose key matches the
// object's `art` (or `type`). It is placed with its bottom edge on the object's
// floor spot.

const ROLE_COLORS = {
  chef:    0xf4a261,
  waiter:  0x4ea8de,
  cashier: 0x52b788,
  cleaner: 0x9d7cd8,
  greeter: 0xe76f9a,
};

const LIGHT_COLORS = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2];

// How far (px) each box-shaped object sticks up above its floor spot,
// and how tall its front face is.
const HEIGHTS = {
  counter:      { rise: 20, front: 24 },
  prep:         { rise: 10, front: 20 },
  stove:        { rise: 10, front: 20 },
  grill:        { rise: 10, front: 20 },
  sink:         { rise: 10, front: 20 },
  dishRack:     { rise: 10, front: 20 },
  fridge:       { rise: 40, front: 70 },
  hostStand:    { rise: 18, front: 24 },
  bench:        { rise: 4,  front: 12 },
  table:        { rise: 6,  front: 14 },
  dishBin:      { rise: 8,  front: 16 },
  pickupWindow: { rise: 20, front: 24 },
  partition:    { rise: 34, front: 38 },
  frontWall:    { rise: 12, front: 22 },
  planter:      { rise: 6,  front: 14 },
};

// Pictures from assets/ (made with tools/process_art.py). Any object whose
// picture is listed here is shown with it; the rest are still drawn in code.
// Each area's folder under assets/ and the pictures in it.
const ART_FOLDERS = {
  // (<name>_1 and <name>_2 are the cheaper levels of furniture that is upgraded in the shop)
  kitchen: ['prep', 'grill', 'hood', 'shelf', 'stove', 'fridge', 'sink', 'dishRack', 'pickupWindow',
    ...['prep', 'hood', 'stove', 'fridge', 'sink'].flatMap(name => [`${name}_1`, `${name}_2`])],
  dining: ['table_4seat', 'table_2seat', 'stool', 'plant', 'planter',
    ...['table_4seat', 'table_2seat', 'stool'].flatMap(name => [`${name}_1`, `${name}_2`])],
  'stall-front': ['counterSection', 'awning', 'sign', 'menuBoard', 'entrance', 'bench', 'dishBin', 'dishBin_empty', 'dishBin_full',
    'cashRegister', 'cashRegister_1', 'cashRegister_2', 'hostStand', 'ropePost'],
  street: ['parkingSign', 'trash', 'tree', 'lampPost', 'car_sedan', 'car_hatch', 'car_van'],
  // every person has <name>_front, _back and _side
  people: ['waiter', 'cashier', 'chef', 'greeter', 'cleaner',
    'customer1', 'customer2', 'customer3', 'customer4', 'customer5', 'customer6']
    .flatMap(name => ['front', 'back', 'side'].map(view => `${name}_${view}`))
    // sitting poses made so far
    // every customer's sitting poses
    .concat(['customer1', 'customer2', 'customer3', 'customer4', 'customer5', 'customer6']
      .flatMap(name => ['front', 'back', 'side'].map(view => `${name}_sit_${view}`)))
    // every customer reading the menu (from behind the sitting picture is used)
    .concat(['customer1', 'customer2', 'customer3', 'customer4', 'customer5', 'customer6']
      .flatMap(name => ['front', 'side'].map(view => `${name}_menu_${view}`)))
    // the waiter carrying one dish on a tray, or two plates
    .concat(['carry', 'carry2'].flatMap(pose => ['front', 'back', 'side'].map(view => `waiter_${pose}_${view}`)))
    // the waiter's other outfits from the shop (made by tools/make_outfits.py)
    .concat(['waiterRed', 'waiterBlue', 'waiterGreen', 'waiterPurple'].flatMap(name =>
      ['', 'carry_', 'carry2_'].flatMap(pose => ['front', 'back', 'side'].map(view => `${name}_${pose}${view}`)))),
  food: ['burger', 'pizza', 'ramen', 'sushi', 'tacos', 'biryani', 'kebab', 'momo', 'fuchka', 'sundae', 'bubbleTea', 'mangoLassi']
    .map(id => `food_${id}`).concat(['menuCard']),
  lights: ['lamp_classic', 'lamp_bistro', 'lamp_dome', 'lamp_oil', 'lamp_tiffany', 'lamp_bottle', 'lamp_lantern',
    'lamp_modern', 'lamp_candle', 'floorLamp', 'pendantLamp', 'wallLamp'],
  floors: ['tex_kitchenFloor', 'tex_kitchenWall', 'tex_deck', 'tex_brick', 'tex_pavement', 'tex_sidewalk', 'tex_road', 'tex_grass'],
};
// picture name -> its file, e.g. prep -> assets/kitchen/prep.png
const ART_FILES = Object.fromEntries(Object.entries(ART_FOLDERS)
  .flatMap(([folder, keys]) => keys.map(key => [key, `assets/${folder}/${key}.png`])));
// Picture width as a share of the object's floor spot (default: all of it).
// Pictures fitted by height instead: how far (px) they rise above their floor spot.
const ART_RISE = { pickupWindow: 16 };
const TABLE_LAMP_HEIGHT = 32; // px
const ART_WIDTH = { floorLamp: 0.62, plant: 0.8, planter: 0.9, stove: 0.85, trash: 0.8, tree: 1.4, fridge: 0.7, lampPost: 0.55 };
const STOOL_WIDTH = 24; // px
// The cheaper furniture pictures are not all drawn at the size of the ones
// they stand in for: how much wider (or narrower) to show each.
const LEVEL_SCALE = {
  fridge_1: 0.9, fridge_2: 0.9, stove_2: 0.8, sink_1: 1.25, sink_2: 1.25,
  table_4seat_1: 0.92, table_4seat_2: 0.85, stool_1: 1.15, stool_2: 1.35, cashRegister_1: 0.62,
};
const CANDLE_HEIGHT = 20; // px
// Repeating floor and wall pictures: how big (px) one copy of the picture is
// shown, chosen so tiles, planks and bricks come out a sensible size.
const TEXTURE_SIZE = {
  tex_kitchenFloor: 120, tex_kitchenWall: 128, tex_deck: 170, tex_brick: 200,
  tex_pavement: 112, tex_sidewalk: 270, tex_road: 400, tex_grass: 200,
};
// Counter picture: how tall it is shown (px) and what share of it is the top surface.
const COUNTER_ART = { height: 60, top: 0.22 };

// Flat things painted on the floor or the back wall.
const DECALS = new Set(['stallWalls', 'sideWall', 'entrance', 'menuBoard', 'sign', 'awning', 'shelf', 'hood', 'parkingSign', 'picture']);
// Things that sit on top of the counter.
const ON_COUNTER = new Set(['register']);

const DEPTH = { ground: -1000, decal: -500, overhead: 7000, zones: 8000, ui: 9000 };

// Darken (f < 1) or lighten (f > 1) a colour.
function shade(color, f = 0.8) {
  const ch = (v) => Math.max(0, Math.min(255, Math.floor(v * f)));
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255);
}

// Small repeatable random number generator (same seed → same textures).
function makeRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pixel positions of the stools around a table.
function tableSeats(o, T) {
  const x = o.x * T, y = o.y * T, w = o.w * T, h = o.h * T;
  const cx = x + w / 2, cy = y + h / 2;
  const gap = T * 0.45;
  // topSeatY: set when a table picture has a shallower top than the drawn table
  const top = o.topSeatY !== undefined ? o.topSeatY : y - gap + 6;
  return o.seats === 4
    ? [[cx, top], [cx, y + h + gap], [x - gap, cy], [x + w + gap, cy]]
    : [[x - gap, cy], [x + w + gap, cy]];
}

// The solid pieces of a stall's right wall between its openings, as [top, bottom] px.
function rightWallSegments(o, T) {
  const segments = [];
  let y = o.y;
  for (const gap of [...o.gaps].sort((a, b) => a.y - b.y)) {
    if (gap.y > y) segments.push([y * T, gap.y * T]);
    y = gap.y + gap.h;
  }
  if (y < o.y + o.h) segments.push([y * T, (o.y + o.h) * T]);
  return segments;
}

class RestaurantView {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.T = layout.tileSize;
    this.depth = 0; // depth of the object currently being drawn
    this.objectImages = {}; // picture objects by type, for ones that change (e.g. the dish bin)
    this.rand = makeRandom(7);
  }

  // Convert a tile-based item to a pixel rectangle.
  rect(o) {
    return { x: o.x * this.T, y: o.y * this.T, w: o.w * this.T, h: o.h * this.T };
  }

  text(x, y, str, style = {}) {
    const t = this.scene.add.text(x, y, str, {
      fontFamily: 'system-ui, Roboto, Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      resolution: 3,
      ...style,
    }).setDepth(this.depth + 0.5);
    if (this.baking) this.baking.push(t);
    return t;
  }

  // A colour with a little random variation, for natural-looking textures.
  vary(color, amount) {
    return shade(color, 1 + (this.rand() - 0.5) * amount);
  }

  depthOf(o, r) {
    if (DECALS.has(o.type)) return DEPTH.decal;
    // String lights sit at the height of their lowest bulb, so anyone standing
    // in front of them is drawn over them instead of the lights crossing the screen.
    if (o.type === 'stringLights') return Math.max(...o.points.map(p => p[1])) * this.T + 10;
    if (o.points) return Math.max(...o.points.map(p => p[1])) * this.T;
    if (ON_COUNTER.has(o.type)) return r.y + r.h + 1;
    return r.y + r.h;
  }

  draw() {
    const scene = this.scene;

    // Floors, walls and wall signs never change, so they are drawn once into
    // a single picture instead of redrawing every brick and plank each frame.
    this.groundGfx = scene.add.graphics();
    this.baking = [this.groundGfx];
    for (const item of this.layout.ground) this['ground_' + item.type](this.groundGfx, this.rect(item), item);
    // Wall things that have a picture are placed as pictures afterwards
    // instead, so they stay crisp pixel art.
    const pictured = [];
    for (const o of this.layout.objects) {
      if (!DECALS.has(o.type)) continue;
      if (this.has(o.art || o.type)) pictured.push(o);
      else this['draw_' + o.type](this.groundGfx, o, o.w ? this.rect(o) : null);
    }
    this.bake(this.baking);
    this.baking = null;
    this.depth = DEPTH.decal;
    for (const o of pictured) this['draw_' + o.type](scene.add.graphics().setDepth(DEPTH.decal), o, this.rect(o));

    for (const o of this.layout.objects) {
      if (DECALS.has(o.type)) continue;
      const r = o.w ? this.rect(o) : null;
      this.depth = this.depthOf(o, r);
      const key = o.art || o.type;
      if (r && scene.textures.exists(key) && key in ART_RISE) {
        this.imageByHeight(key, r.x + r.w / 2, r.y + r.h, r.h + ART_RISE[key]);
      } else if (r && scene.textures.exists(key)) {
        this.objectImages[key] = this.levelImage(key, r.x + r.w / 2, r.y + r.h, r.w * (ART_WIDTH[key] || 1), this.depth);
      } else {
        const fn = this['draw_' + o.type];
        if (fn) fn.call(this, scene.add.graphics().setDepth(this.depth), o, r);
      }
    }

    this.drawPendants();
    this.zoneLayer = this.drawZones();
  }

  has(key) {
    return this.scene.textures.exists(key);
  }

  // The picture to show for a piece of furniture: the one for the level it
  // has been upgraded to in the shop (level 3 is the plain name).
  // (`level` is given for things that have a level of their own, like tables and chairs)
  levelled(key, level = (this.layout.levels || {})[PICTURE_CHAIN[key]] || 3) {
    const cheaper = `${key}_${level}`;
    return level < 3 && this.has(cheaper) ? cheaper : key;
  }

  // The same picture placed with image(): at its level's own size.
  levelImage(key, x, y, width, depth, level) {
    const art = this.levelled(key, level);
    return this.image(art, x, y, width * (LEVEL_SCALE[art] || 1), depth);
  }

  // Places a picture from assets/ standing on (x, y), scaled to `width` px.
  image(key, x, y, width, depth) {
    const img = this.scene.add.image(x, y, key).setOrigin(0.5, 1);
    return img.setScale(width / img.width).setDepth(depth);
  }

  // Same, but scaled to a height instead.
  imageByHeight(key, x, y, height, depth = this.depth) {
    const img = this.scene.add.image(x, y, key).setOrigin(0.5, 1);
    return img.setScale(height / img.height).setDepth(depth);
  }

  // A picture stretched to any size without stretching its border: the
  // corners stay as they are and only the plain middle stretches.
  // `edges` are [left, right, top, bottom] in picture pixels.
  stretched(key, x, y, width, height, scale, edges) {
    return this.scene.add.nineslice(x, y, key, undefined, width / scale, height / scale, ...edges)
      .setOrigin(0, 0).setScale(scale).setDepth(this.depth);
  }

  // Fills a floor or wall area with a repeating picture (while baking), then
  // returns a fresh drawing layer on top of it for any details.
  tile(key, r) {
    const src = this.scene.textures.get(key).getSourceImage();
    const s = TEXTURE_SIZE[key] / src.width;
    const pattern = this.scene.add.tileSprite(r.x, r.y, r.w, r.h, key).setOrigin(0, 0)
      .setTileScale(s).setTilePosition(r.x / s, r.y / s); // line the pattern up across areas
    this.groundGfx = this.scene.add.graphics();
    this.baking.push(pattern, this.groundGfx);
    return this.groundGfx;
  }

  // Draws the given shapes and texts once into a picture (at up to double
  // resolution, so it stays sharp when zoomed in) and removes the originals.
  bake(objects) {
    const w = this.layout.width * this.T, h = this.layout.height * this.T;
    const s = Math.min(2, 4096 / w);
    const picture = this.scene.add.renderTexture(0, 0, w * s, h * s)
      .setOrigin(0, 0).setScale(1 / s).setDepth(DEPTH.ground);
    if (this.has('tex_pavement')) picture.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const obj of objects) {
      obj.setPosition(obj.x * s, obj.y * s).setScale(obj.scaleX * s, obj.scaleY * s);
      picture.draw(obj);
      obj.destroy();
    }
  }

  // Draws a box with a lighter top face and a darker front face, a soft
  // shadow on the floor and a highlight along the top edge.
  // Returns the top face rectangle so details can be drawn on it.
  box(g, r, type, topColor, frontColor, edgeColor) {
    const { rise, front } = HEIGHTS[type];
    const x = r.x + 1, w = r.w - 2;
    const top = { x, y: r.y - rise, w, h: r.h + rise - front };
    const frontY = r.y + r.h - front;
    g.fillStyle(0x000000, 0.16).fillRoundedRect(x + 2, r.y + r.h - 4, w + 2, 9, 4);
    g.fillStyle(frontColor).fillRect(x, frontY, w, front);
    g.fillStyle(shade(frontColor, 0.85)).fillRect(x, r.y + r.h - 4, w, 4);
    g.fillStyle(topColor).fillRect(top.x, top.y, top.w, top.h);
    g.fillStyle(0xffffff, 0.22).fillRect(x, top.y, w, 2);
    g.fillStyle(0x000000, 0.12).fillRect(x, frontY, w, 2);
    g.lineStyle(1.5, edgeColor);
    g.strokeRect(x, top.y, w, r.h + rise);
    g.lineBetween(x, frontY, x + w, frontY);
    return top;
  }

  steelBox(g, r, type) {
    const top = this.box(g, r, type, 0xcfd6dd, 0x9aa4ad, 0x6c757d);
    g.fillStyle(0xffffff, 0.18);
    for (let x = top.x + 10; x < top.x + top.w - 6; x += 22) g.fillRect(x, top.y + 2, 6, top.h - 4);
    return top;
  }

  // ---------- Ground ----------

  ground_wall(g, r) {
    if (this.has('tex_brick')) {
      g = this.tile('tex_brick', r);
      g.fillStyle(0x3d2019).fillRect(r.x, r.y + r.h - 6, r.w, 6);
      g.fillStyle(0x000000, 0.18).fillRect(r.x, r.y + r.h, r.w, 5);
      return;
    }
    g.fillStyle(0x6b3a2e).fillRect(r.x, r.y, r.w, r.h);
    const bh = 16, bw = 40;
    for (let row = 0, y = r.y; y < r.y + r.h; row++, y += bh) {
      for (let x = r.x - (row % 2 ? bw / 2 : 0); x < r.x + r.w; x += bw) {
        const c = this.vary(0x9c4f3c, 0.22);
        g.fillStyle(c).fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        g.fillStyle(0xffffff, 0.1).fillRect(x + 1.5, y + 1.5, bw - 3, 2);
      }
    }
    g.fillStyle(0x3d2019).fillRect(r.x, r.y + r.h - 6, r.w, 6);
    g.fillStyle(0x000000, 0.18).fillRect(r.x, r.y + r.h, r.w, 5);
  }

  ground_backsplash(g, r) {
    if (this.has('tex_kitchenWall')) {
      g = this.tile('tex_kitchenWall', r);
      g.fillStyle(0x9aa4ad).fillRect(r.x, r.y + r.h - 5, r.w, 5);
      return;
    }
    g.fillStyle(0xd6cfc0).fillRect(r.x, r.y, r.w, r.h);
    const s = 20;
    for (let y = r.y; y < r.y + r.h; y += s) {
      for (let x = r.x; x < r.x + r.w; x += s) {
        g.fillStyle(this.vary(0xf4f1ea, 0.05)).fillRect(x + 1, y + 1, s - 2, s - 2);
        g.fillStyle(0xffffff, 0.35).fillRect(x + 2, y + 2, s - 8, 2);
      }
    }
    g.fillStyle(0x9aa4ad).fillRect(r.x, r.y + r.h - 5, r.w, 5);
  }

  ground_pavement(g, r) {
    if (this.has('tex_pavement')) {
      this.tile('tex_pavement', r);
      return;
    }
    const T = this.T;
    g.fillStyle(0xbfb3a2).fillRect(r.x, r.y, r.w, r.h);
    for (let y = r.y; y < r.y + r.h; y += T) {
      for (let x = r.x; x < r.x + r.w; x += T) {
        g.fillStyle(this.vary(0xd9cfbf, 0.09)).fillRect(x + 1, y + 1, T - 2, T - 2);
        if (this.rand() < 0.3) {
          g.fillStyle(0x000000, 0.06).fillCircle(x + 6 + this.rand() * 28, y + 6 + this.rand() * 28, 1.5 + this.rand() * 2);
        }
      }
    }
  }

  ground_stallFloor(g, r, item) {
    if (this.has('tex_kitchenFloor')) {
      g = this.tile('tex_kitchenFloor', r);
      g.fillStyle(0x000000, 0.12).fillRect(r.x, r.y, r.w, 6); // shade under the back counters
      return;
    }
    const T = this.T;
    for (let ty = 0; ty < item.h; ty++) {
      for (let tx = 0; tx < item.w; tx++) {
        const x = r.x + tx * T, y = r.y + ty * T;
        g.fillStyle((tx + ty) % 2 ? 0xd9cfbe : 0xf3eee4).fillRect(x, y, T, T);
        g.fillStyle(0xffffff, 0.12).fillTriangle(x, y, x + T * 0.6, y, x, y + T * 0.6);
      }
    }
    g.lineStyle(1, 0xbfb3a2, 0.6);
    for (let x = r.x; x <= r.x + r.w; x += T) g.lineBetween(x, r.y, x, r.y + r.h);
    for (let y = r.y; y <= r.y + r.h; y += T) g.lineBetween(r.x, y, r.x + r.w, y);
    g.fillStyle(0x000000, 0.12).fillRect(r.x, r.y, r.w, 6); // shade under the back counters
  }

  // Wooden floor for the cashier area, lobby and dining room.
  ground_woodFloor(g, r) {
    if (this.has('tex_deck')) {
      g = this.tile('tex_deck', r);
    } else {
      g.fillStyle(0xb98555).fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(1, 0x8a5a33, 0.6);
      for (let y = r.y + 20; y < r.y + r.h; y += 20) g.lineBetween(r.x, y, r.x + r.w, y);
    }
    g.fillStyle(0x000000, 0.14).fillRect(r.x, r.y, r.w, 8); // shade below the kitchen wall
  }

  ground_deck(g, r) {
    if (this.has('tex_deck')) {
      g = this.tile('tex_deck', r);
      g.lineStyle(3, 0x4a2e17).strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
      return;
    }
    const ph = 20;
    g.fillStyle(0x6b4423).fillRect(r.x, r.y, r.w, r.h);
    for (let y = r.y; y < r.y + r.h; y += ph) {
      let x = r.x;
      while (x < r.x + r.w) {
        const len = Math.min(80 + Math.floor(this.rand() * 90), r.x + r.w - x);
        g.fillStyle(this.vary(0xb98555, 0.14)).fillRect(x + 1, y + 1, len - 2, ph - 2);
        g.fillStyle(0x000000, 0.08).fillRect(x + 1 + len * 0.3, y + 7, len * 0.4, 1);
        g.fillStyle(0xffffff, 0.08).fillRect(x + 1, y + 1, len - 2, 2);
        g.fillStyle(0x4a2e17, 0.5).fillCircle(x + 4, y + ph / 2, 1).fillCircle(x + len - 5, y + ph / 2, 1);
        x += len;
      }
    }
    g.lineStyle(3, 0x4a2e17).strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  }

  ground_sidewalk(g, r) {
    if (this.has('tex_sidewalk')) {
      g = this.tile('tex_sidewalk', { ...r, h: r.h - 9 });
      g.fillStyle(0xd6d6d1).fillRect(r.x, r.y + r.h - 9, r.w, 3); // curb top
      g.fillStyle(0x7c7c77).fillRect(r.x, r.y + r.h - 6, r.w, 6);  // curb face
      return;
    }
    g.fillStyle(0x9a9a95).fillRect(r.x, r.y, r.w, r.h);
    for (let x = r.x; x < r.x + r.w; x += 80) {
      for (let y = r.y; y < r.y + r.h - 8; y += 36) {
        g.fillStyle(this.vary(0xc4c4bf, 0.07)).fillRect(x + 1, y + 1, 78, Math.min(34, r.y + r.h - 9 - y));
      }
    }
    g.fillStyle(0xd6d6d1).fillRect(r.x, r.y + r.h - 9, r.w, 3); // curb top
    g.fillStyle(0x7c7c77).fillRect(r.x, r.y + r.h - 6, r.w, 6);  // curb face
  }

  ground_road(g, r) {
    if (this.has('tex_road')) {
      g = this.tile('tex_road', r);
    } else {
      g.fillStyle(0x3a3d44).fillRect(r.x, r.y, r.w, r.h);
      for (let i = 0; i < 90; i++) {
        g.fillStyle(this.rand() < 0.5 ? 0x000000 : 0xffffff, 0.08);
        g.fillRect(r.x + this.rand() * r.w, r.y + this.rand() * r.h, 2 + this.rand() * 3, 2);
      }
    }
    g.fillStyle(0xe9c46a);
    const cy = r.y + r.h / 2 - 2;
    for (let x = r.x + 10; x < r.x + r.w; x += 70) g.fillRect(x, cy, 34, 4);
    g.fillStyle(0x000000, 0.25).fillRect(r.x, r.y, r.w, 5);
  }

  ground_parking(g, r, item) {
    const T = this.T, P = this.layout.parking;
    g.fillStyle(0x4a4e57).fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(this.rand() < 0.5 ? 0x000000 : 0xffffff, 0.07);
      g.fillRect(r.x + this.rand() * r.w, r.y + this.rand() * r.h, 2 + this.rand() * 3, 2);
    }
    // painted bays: dividing lines for each row, and a line along the aisle
    g.fillStyle(0xf1f1ec, 0.85);
    // (only the rows that have spaces)
    const bayW = 2.2 * T, left = P.spots[0].x * T - bayW / 2;
    const rows = new Set(P.spots.map(s => s.row));
    const bays = { 1: [2.4 * T, 5.3 * T, 5.3 * T], 2: [7.9 * T, 10.8 * T, 7.9 * T] };
    for (const row of rows) {
      const [top, bottom, edge] = bays[row];
      const n = P.spots.filter(s => s.row === row).length;
      for (let i = 0; i <= n; i++) g.fillRect(left + i * bayW - 1.5, top, 3, bottom - top);
      g.fillRect(left, edge - 1.5, bayW * n, 3);
    }
    // arrows showing the way in and out
    g.fillStyle(0xf1f1ec, 0.55);
    const arrow = (x, y, dir) => {
      const s = dir === 'up' ? -1 : 1;
      g.fillRect(x - 3, y - 10 * s, 6, 14 * s);
      g.fillTriangle(x - 9, y + 4 * s, x + 9, y + 4 * s, x, y + 14 * s);
    };
    arrow(P.laneX * T - 10, 12 * T, 'up');
    arrow(P.laneX * T + 12, 9 * T, 'down');
    g.fillStyle(0xffd166).fillRect(r.x, r.y, 4, r.h); // kerb edge
  }

  ground_grass(g, r) {
    if (this.has('tex_grass')) {
      g = this.tile('tex_grass', r);
      g.lineStyle(3, 0xadb5bd).strokeRect(r.x, r.y, r.w, r.h); // kerb around the lawn
      return;
    }
    g.fillStyle(0x6a994e).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
    for (let i = 0; i < 60; i++) {
      g.fillStyle(this.rand() < 0.5 ? 0x7fb069 : 0x588b3f).fillRect(r.x + 4 + this.rand() * (r.w - 8), r.y + 4 + this.rand() * (r.h - 8), 2, 4);
    }
    g.lineStyle(3, 0xadb5bd).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
  }

  ground_driveway(g, r) {
    g.fillStyle(0x4a4e57).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(0x6c6f78).fillRect(r.x, r.y + r.h - 9, r.w, 9); // lowered kerb
    g.fillStyle(0xffd166).fillRect(r.x, r.y, 3, r.h).fillRect(r.x + r.w - 3, r.y, 3, r.h);
  }

  ground_crosswalk(g, r) {
    g.fillStyle(0x3a3d44).fillRect(r.x, r.y, r.w, r.h); // cover the lane dashes
    g.fillStyle(0xf1f1ec, 0.9);
    for (let x = r.x + 4; x < r.x + r.w - 6; x += 22) g.fillRect(x, r.y, 12, r.h);
  }

  // ---------- Wall & floor decals ----------

  draw_stallWalls(g, o, r) {
    const T = this.T;
    const right = r.x + r.w;
    const wall = (x1, y1, x2, y2) => {
      g.lineStyle(9, 0x4a2c17).lineBetween(x1, y1, x2, y2);
      g.lineStyle(3, 0x8b5e3c).lineBetween(x1 - 1, y1, x2 - 1, y2);
    };
    wall(r.x, r.y, r.x, r.y + r.h);
    for (const [top, bottom] of rightWallSegments(o, T)) wall(right, top, right, bottom);

    // closed staff door with a "STAFF ONLY" plate beside it
    const door = o.gaps.find(gap => gap.kind === 'door');
    if (door) {
      const top = door.y * T, bottom = (door.y + door.h) * T;
      g.lineStyle(7, 0xa47148).lineBetween(right, top + 2, right, bottom - 2);
      g.lineStyle(2, 0x5e3a20).lineBetween(right + 2, top + 2, right + 2, bottom - 2);
      g.fillStyle(0xd4a017).fillCircle(right + 3, top + door.h * T * 0.55, 2);
      g.fillStyle(0x000000, 0.2).fillRoundedRect(right + 7, top + 5, 38, 15, 3);
      g.fillStyle(0xc1121f).fillRoundedRect(right + 5, top + 3, 38, 15, 3);
      this.text(right + 24, top + 10.5, 'STAFF\nONLY', {
        fontSize: '6.5px', fontStyle: 'bold', color: '#ffffff', align: 'center', lineSpacing: -2,
      }).setOrigin(0.5);
    }
  }

  draw_awning(g, o, r) {
    if (this.has('awning')) {
      // repeat the awning picture along the whole stall, in front of the hood and shelf
      // shown at a size where each stripe is about 10px wide; only its bottom
      // part (with the scalloped edge) fits above the stall
      const H = 32, src = this.scene.textures.get('awning').getSourceImage();
      const s = 0.45;
      this.scene.add.tileSprite(r.x, r.y, r.w, H, 'awning').setOrigin(0, 0).setTileScale(s)
        .setTilePosition(0, src.height - H / s).setDepth(DEPTH.decal + 2);
      return;
    }
    const stripe = 20;
    g.fillStyle(0x000000, 0.2).fillRect(r.x, r.y + r.h, r.w, 6);
    for (let i = 0, x = r.x; x < r.x + r.w; i++, x += stripe) {
      const w = Math.min(stripe, r.x + r.w - x);
      g.fillStyle(i % 2 ? 0xfdfdfd : 0xd62828).fillRect(x, r.y, w, r.h);
      g.fillStyle(i % 2 ? 0xfdfdfd : 0xd62828).fillCircle(x + w / 2, r.y + r.h, w / 2);
    }
    g.fillStyle(0x000000, 0.1).fillRect(r.x, r.y + r.h - 5, r.w, 5);
    g.fillStyle(0x8d0801).fillRect(r.x, r.y, r.w, 3);
  }

  draw_shelf(g, o, r) {
    if (this.has('shelf')) {
      this.imageByHeight('shelf', r.x + r.w / 2, 78, 50);
      return;
    }
    g.fillStyle(0x000000, 0.15).fillRect(r.x + 2, r.y + r.h + 1, r.w, 4);
    g.fillStyle(0x8b5e3c).fillRect(r.x, r.y + r.h - 5, r.w, 5);
    const jars = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x8ecae6, 0x6a994e, 0xbc6c25];
    let x = r.x + 6;
    for (const c of jars) {
      const h = 10 + this.rand() * 6, w = 11;
      g.fillStyle(0xffffff, 0.55).fillRoundedRect(x, r.y + r.h - 5 - h, w, h, 2);
      g.fillStyle(c).fillRoundedRect(x + 1, r.y + r.h - 5 - h * 0.7, w - 2, h * 0.7 - 1, 2);
      g.fillStyle(shade(c, 0.7)).fillRect(x - 0.5, r.y + r.h - 7 - h, w + 1, 3);
      x += w + 12;
    }
    // hanging utensils under the shelf
    g.lineStyle(2, 0x6c757d);
    for (let i = 0; i < 4; i++) {
      const ux = r.x + 18 + i * 42;
      g.lineBetween(ux, r.y + r.h, ux, r.y + r.h + 14);
      g.fillStyle(0x868e96).fillEllipse(ux, r.y + r.h + 17, i % 2 ? 7 : 10, i % 2 ? 9 : 6);
    }
  }

  draw_hood(g, o, r) {
    if (this.has('hood')) {
      // above the grill and clear of it, with the chimney running up the wall
      this.imageByHeight(this.levelled('hood'), r.x + r.w / 2, 64, 60);
      return;
    }
    g.fillStyle(0x000000, 0.18).fillRect(r.x + 6, r.y + r.h, r.w - 8, 5);
    g.fillStyle(0xadb5bd).fillPoints([
      { x: r.x + r.w * 0.3, y: r.y }, { x: r.x + r.w * 0.7, y: r.y },
      { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
    ], true);
    g.fillStyle(0xdee2e6).fillRect(r.x + r.w * 0.3, r.y, r.w * 0.4, 6);
    g.fillStyle(0x6c757d).fillRect(r.x, r.y + r.h - 8, r.w, 8);
    g.lineStyle(1.5, 0x495057);
    for (let x = r.x + 16; x < r.x + r.w - 10; x += 12) g.lineBetween(x, r.y + r.h - 6, x, r.y + r.h - 2);
    g.fillStyle(0xffe8a3, 0.9).fillCircle(r.x + 30, r.y + r.h - 1, 3).fillCircle(r.x + r.w - 30, r.y + r.h - 1, 3);
  }

  draw_menuBoard(g, o, r) {
    if (this.has('menuBoard')) {
      this.stretched('menuBoard', r.x - 6, r.y - 6, r.w + 12, r.h + 12, 0.5, [14, 14, 14, 14]);
    } else {
      g.fillStyle(0x000000, 0.25).fillRoundedRect(r.x - 2, r.y + 2, r.w + 8, r.h + 8, 6);
      g.fillStyle(0x8b5a2b).fillRoundedRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 6);
      g.fillStyle(0xa47148).fillRect(r.x - 5, r.y - 5, r.w + 10, 3);
      g.fillStyle(0x2b3a2f).fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(0xffffff, 0.04).fillRect(r.x + 10, r.y + 8, r.w - 30, r.h - 20);
    }
    const chalk = { fontFamily: '"Comic Sans MS", "Chalkboard SE", system-ui, sans-serif', color: '#f8f4e3' };
    this.text(r.x + r.w / 2, r.y + 4, 'MENU', { ...chalk, fontSize: '13px', fontStyle: 'bold', color: '#ffd166' }).setOrigin(0.5, 0);
    // two columns for a short menu, three smaller ones for a long menu
    const menu = this.layout.menu || MENU; // only the dishes the restaurant sells so far
    const cols = menu.length > 6 ? 3 : 2, colW = r.w / cols;
    const size = cols === 3 ? '8px' : '9px', rowH = cols === 3 ? 11.5 : 13, top = cols === 3 ? 19 : 22;
    menu.forEach((item, i) => {
      const x = r.x + 8 + (i % cols) * colW, y = r.y + top + Math.floor(i / cols) * rowH;
      this.text(x, y, item.name, { ...chalk, fontSize: size });
      this.text(x + colW - 14, y, `$${item.price}`, { ...chalk, fontSize: size, color: '#ffd166' }).setOrigin(1, 0);
    });
  }

  draw_sign(g, o, r) {
    if (this.has('sign')) {
      // the picture keeps its own shape, so the name goes on two lines
      const cx = r.x + r.w / 2, img = this.imageByHeight('sign', cx, 78, 74);
      const cy = 78 - img.displayHeight / 2, name = o.text.replace(' ', '\n');
      const style = { fontSize: '17px', fontStyle: 'bold', align: 'center', lineSpacing: -3 };
      this.text(cx + 1, cy + 1, name, { ...style, color: '#ffffff' }).setOrigin(0.5).setAlpha(0.5);
      this.text(cx, cy, name, { ...style, color: '#4a1c10' }).setOrigin(0.5);
      return;
    }
    g.fillStyle(0x000000, 0.25).fillRoundedRect(r.x + 3, r.y + 4, r.w, r.h, 10);
    g.fillStyle(0x2b2118).fillRoundedRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 12);
    g.fillStyle(0xf4d35e).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(r.x + 4, r.y + 3, r.w - 8, r.h * 0.35, 8);
    for (let x = r.x + 10; x < r.x + r.w - 5; x += 18) {
      for (const y of [r.y - 1, r.y + r.h + 1]) {
        g.fillStyle(0xfff3b0, 0.4).fillCircle(x, y, 4);
        g.fillStyle(0xfffbe6).fillCircle(x, y, 2);
      }
    }
    this.text(r.x + r.w / 2 + 2, r.y + r.h / 2 + 2, o.text, {
      fontSize: '30px', fontStyle: 'bold', color: '#a4161a',
    }).setOrigin(0.5).setAlpha(0.35);
    this.text(r.x + r.w / 2, r.y + r.h / 2, o.text, {
      fontSize: '30px', fontStyle: 'bold', color: '#4a1c10',
    }).setOrigin(0.5);
  }

  draw_entrance(g, o, r) {
    const cx = r.x + r.w / 2;
    // welcome mat in front of the greeting area
    if (this.has('entrance')) {
      const mat = this.image('entrance', cx, r.y - 4, 96, this.depth);
      this.text(cx, r.y - 4 - mat.displayHeight / 2, 'WELCOME', { fontSize: '10px', fontStyle: 'bold', color: '#f1e3c4' }).setOrigin(0.5);
    } else {
      g.fillStyle(0x000000, 0.2).fillRoundedRect(cx - 42, r.y - 30, 86, 24, 4);
      g.fillStyle(0x9c2c2c).fillRoundedRect(cx - 44, r.y - 32, 88, 24, 4);
      g.lineStyle(2, 0xe9c46a).strokeRoundedRect(cx - 40, r.y - 28, 80, 16, 3);
      this.text(cx, r.y - 20, 'WELCOME', { fontSize: '10px', fontStyle: 'bold', color: '#f1e3c4' }).setOrigin(0.5);
    }
    // faint arrow on the sidewalk
    g.fillStyle(0xffffff, 0.35);
    g.fillTriangle(cx, r.y + 10, cx - 16, r.y + 28, cx + 16, r.y + 28);
    g.fillRect(cx - 6, r.y + 28, 12, 14);
  }

  // ---------- Kitchen ----------

  draw_prep(g, o, r) {
    const top = this.steelBox(g, r, 'prep');
    // cutting board with a tomato, lettuce and a knife
    g.fillStyle(0x000000, 0.15).fillRoundedRect(top.x + 9, top.y + 6, 50, top.h - 9, 3);
    g.fillStyle(0xd9a066).fillRoundedRect(top.x + 7, top.y + 4, 50, top.h - 9, 3);
    g.fillStyle(0xe63946).fillCircle(top.x + 20, top.y + top.h / 2, 5);
    g.fillStyle(0xffffff, 0.5).fillCircle(top.x + 18, top.y + top.h / 2 - 2, 1.5);
    g.fillStyle(0xe63946).fillEllipse(top.x + 31, top.y + top.h / 2, 5, 8).fillEllipse(top.x + 37, top.y + top.h / 2, 5, 8);
    g.fillStyle(0xdee2e6).fillRect(top.x + 42, top.y + 6, 3, top.h - 14);
    g.fillStyle(0x3d2019).fillRect(top.x + 41.5, top.y + top.h - 9, 4, 6);
    g.fillStyle(0x52b788).fillCircle(top.x + 80, top.y + top.h / 2, 7);
    g.fillStyle(0x74c69d).fillCircle(top.x + 84, top.y + top.h / 2 - 3, 5).fillCircle(top.x + 76, top.y + top.h / 2 - 2, 4);
    g.fillStyle(0xf8f9fa).fillEllipse(top.x + 102, top.y + top.h / 2, 18, 12);
    g.lineStyle(1, 0xadb5bd).strokeEllipse(top.x + 102, top.y + top.h / 2, 18, 12);
  }

  draw_stove(g, o, r) {
    const top = this.box(g, r, 'stove', 0x3d3d3d, 0x2a2a2a, 0x151515);
    const cy = top.y + top.h / 2;
    const lx = top.x + top.w * 0.28, rx = top.x + top.w * 0.72;
    for (const cx of [lx, rx]) {
      g.lineStyle(2, 0x6c6c6c).strokeEllipse(cx, cy, 26, 15);
      g.fillStyle(0xff6b00, 0.5).fillEllipse(cx, cy, 16, 9);
      g.fillStyle(0xbbbbbb).fillCircle(cx, r.y + r.h - 10, 3);
    }
    // pot on the left burner with steam
    g.fillStyle(0x6c757d).fillRect(lx - 10, cy - 12, 20, 12);
    g.fillStyle(0xadb5bd).fillEllipse(lx, cy, 20, 8);
    g.fillStyle(0xced4da).fillEllipse(lx, cy - 12, 20, 8);
    g.fillStyle(0x495057).fillCircle(lx, cy - 13, 2);
    g.fillStyle(0xffffff, 0.35).fillCircle(lx - 3, cy - 20, 4).fillCircle(lx + 3, cy - 26, 5).fillCircle(lx - 1, cy - 33, 4);
    // frying pan with an egg on the right burner
    g.fillStyle(0x1b1b1b).fillEllipse(rx, cy, 22, 13);
    g.fillStyle(0x1b1b1b).fillRect(rx + 9, cy - 1.5, 14, 3);
    g.fillStyle(0xffffff).fillEllipse(rx - 1, cy, 12, 7);
    g.fillStyle(0xffb703).fillCircle(rx - 1, cy - 0.5, 2.5);
  }

  draw_grill(g, o, r) {
    const top = this.box(g, r, 'grill', 0x2a2a2a, 0x1a1a1a, 0x0d0d0d);
    g.fillStyle(0xff6b00, 0.35).fillRect(top.x + 4, top.y + 4, top.w - 8, top.h - 8);
    g.fillStyle(0xffb703, 0.25).fillEllipse(top.x + top.w / 2, top.y + top.h / 2, top.w * 0.6, top.h * 0.6);
    g.lineStyle(2, 0x5a5a5a);
    for (let x = top.x + 8; x < top.x + top.w - 4; x += 8) g.lineBetween(x, top.y + 4, x, top.y + top.h - 4);
    // two patties with grill marks
    for (const px of [top.x + 30, top.x + 62]) {
      g.fillStyle(0x6f4518).fillEllipse(px, top.y + top.h / 2, 22, 13);
      g.fillStyle(0x8b5a2b).fillEllipse(px - 2, top.y + top.h / 2 - 2, 14, 6);
      g.lineStyle(1.5, 0x3d2019);
      g.lineBetween(px - 6, top.y + top.h / 2 - 5, px - 2, top.y + top.h / 2 + 5);
      g.lineBetween(px + 1, top.y + top.h / 2 - 5, px + 5, top.y + top.h / 2 + 5);
    }
    // spatula
    g.fillStyle(0xadb5bd).fillRect(top.x + 88, top.y + 5, 12, 9);
    g.fillStyle(0x3d2019).fillRect(top.x + 92, top.y + 13, 4, 12);
    g.fillStyle(0xbbbbbb);
    for (let i = 1; i <= 3; i++) g.fillCircle(r.x + (r.w * i) / 4, r.y + r.h - 10, 3);
  }

  draw_fridge(g, o, r) {
    this.box(g, r, 'fridge', 0xdfe7ee, 0xf4f7fa, 0x8795a1);
    const frontY = r.y + r.h - HEIGHTS.fridge.front;
    const mid = r.x + r.w / 2;
    g.fillStyle(0xe9eef3).fillRect(r.x + 1, frontY, r.w / 2 - 1, HEIGHTS.fridge.front - 4);
    g.lineStyle(2, 0x8795a1).lineBetween(mid, frontY, mid, r.y + r.h - 4);
    g.fillStyle(0xadb5bd).fillRoundedRect(mid - 9, frontY + 12, 4, 24, 2).fillRoundedRect(mid + 5, frontY + 12, 4, 24, 2);
    g.fillStyle(0xffffff, 0.6).fillRect(mid - 8, frontY + 13, 1.5, 22).fillRect(mid + 6, frontY + 13, 1.5, 22);
    // magnets and a note
    g.fillStyle(0xe63946).fillCircle(r.x + 14, frontY + 14, 3);
    g.fillStyle(0x2a9d8f).fillCircle(r.x + 24, frontY + 26, 3);
    g.fillStyle(0xfff3b0).fillRect(r.x + 58, frontY + 20, 12, 14);
    g.fillStyle(0xe9c46a).fillCircle(r.x + 64, frontY + 20, 2.5);
    g.lineStyle(1, 0xadb5bd);
    for (let i = 0; i < 3; i++) g.lineBetween(r.x + 60, frontY + 25 + i * 3, r.x + 68, frontY + 25 + i * 3);
  }

  draw_sink(g, o, r) {
    const top = this.steelBox(g, r, 'sink');
    g.fillStyle(0x8a98a6).fillRoundedRect(top.x + 5, top.y + 6, top.w - 10, top.h - 12, 6);
    g.fillStyle(0x8ecae6, 0.85).fillRoundedRect(top.x + 7, top.y + 12, top.w - 14, top.h - 20, 5);
    g.fillStyle(0xffffff, 0.5).fillEllipse(top.x + top.w / 2 - 3, top.y + 18, 8, 3);
    g.fillStyle(0xced4da).fillRect(top.x + top.w / 2 - 2, top.y - 10, 4, 14);
    g.fillStyle(0xadb5bd).fillRect(top.x + top.w / 2 - 2, top.y - 10, 10, 4);
    g.fillStyle(0x52b788).fillRoundedRect(top.x + top.w - 10, top.y - 6, 6, 10, 2);
  }

  draw_dishRack(g, o, r) {
    const top = this.steelBox(g, r, 'dishRack');
    for (let i = 0; i < 4; i++) {
      const y = top.y + 10 + i * (top.h - 20) / 3;
      g.fillStyle(0xffffff).fillEllipse(top.x + top.w / 2, y, 26, 9);
      g.lineStyle(1, 0xadb5bd).strokeEllipse(top.x + top.w / 2, y, 26, 9).strokeEllipse(top.x + top.w / 2, y, 16, 5);
    }
  }

  draw_pickupWindow(g, o, r) {
    const top = this.box(g, r, 'pickupWindow', 0xf6e7b0, 0xc9a227, 0x8a6d1f);
    g.fillStyle(0xffffff, 0.25).fillRect(top.x + 3, top.y + 3, 4, top.h - 6);
    g.fillStyle(0xe63946).fillRect(r.x + 1, r.y + r.h - 14, r.w - 2, 3);
    g.fillStyle(0x7a5a12).fillRoundedRect(top.x + top.w / 2 - 8, top.y + 12, 16, 3, 1);
    g.fillStyle(0xd4a017).fillEllipse(top.x + top.w / 2, top.y + 10, 13, 9);
    g.fillStyle(0xfff3c4).fillCircle(top.x + top.w / 2 - 2, top.y + 8, 1.5);
  }

  // ---------- Front counter ----------

  // Top face of the counter row that an object sits on.
  counterTop(r) {
    const { rise, front } = HEIGHTS.counter;
    if (this.has('counterSection')) return { y: r.y - rise, h: COUNTER_ART.height * COUNTER_ART.top };
    return { y: r.y - rise, h: r.h + rise - front };
  }

  // Wall between the kitchen and the cashier area: a cream wall with a wooden
  // top and skirting, and a door frame around the gap.
  draw_partition(g, o, r) {
    const T = this.T, doorL = o.doorX * T, doorR = (o.doorX + o.doorW) * T;
    for (const [x1, x2] of [[r.x, doorL], [doorR, r.x + r.w]]) {
      const seg = { x: x1, y: r.y, w: x2 - x1, h: r.h };
      this.box(g, seg, 'partition', 0x8b5e3c, 0xefe4d2, 0x5e3a20);
      const frontY = r.y + r.h - HEIGHTS.partition.front;
      g.fillStyle(0x8b5e3c).fillRect(seg.x + 1, r.y + r.h - 6, seg.w - 2, 6);           // skirting
      g.fillStyle(0xffffff, 0.25).fillRect(seg.x + 1, frontY + 2, seg.w - 2, 2);          // light edge
      g.fillStyle(0x000000, 0.06);
      for (let x = seg.x + 20; x < seg.x + seg.w - 4; x += 20) g.fillRect(x, frontY + 4, 1, HEIGHTS.partition.front - 10);
    }
    // door frame posts
    const postTop = r.y - HEIGHTS.partition.rise;
    g.fillStyle(0x5e3a20).fillRect(doorL - 3, postTop, 5, r.y + r.h - postTop).fillRect(doorR - 2, postTop, 5, r.y + r.h - postTop);
    g.fillStyle(0x5e3a20).fillRect(doorL - 3, postTop - 3, doorR - doorL + 6, 4);
  }

  // A plain wall running up the screen (like the kitchen walls).
  draw_sideWall(g, o) {
    const x = o.x * this.T, top = o.y * this.T, bottom = (o.y + o.h) * this.T;
    g.lineStyle(9, 0x4a2c17).lineBetween(x, top, x, bottom);
    g.lineStyle(3, 0x8b5e3c).lineBetween(x - 1, top, x - 1, bottom);
  }

  // The building's low front wall: brick with windows, and a door gap.
  draw_frontWall(g, o, r) {
    const T = this.T, doorL = o.doorX * T, doorR = (o.doorX + o.doorW) * T;
    const { rise, front } = HEIGHTS.frontWall;
    const frontY = r.y + r.h - front;
    for (const [x1, x2] of [[r.x, doorL], [doorR, r.x + r.w]]) {
      const seg = { x: x1, y: r.y, w: x2 - x1, h: r.h };
      this.box(g, seg, 'frontWall', 0xe9dcc9, 0xa0523d, 0x4a2418);
      // brick lines
      g.lineStyle(1, 0x7a3b2e, 0.7);
      for (let y = frontY + 7; y < r.y + r.h - 2; y += 7) g.lineBetween(seg.x + 1, y, seg.x + seg.w - 1, y);
      // windows: glass panes set into the wall, spread along each piece
      const panes = Math.floor(seg.w / (2.2 * T));
      for (let i = 0; i < panes; i++) {
        const cx = seg.x + (seg.w / panes) * (i + 0.5), w = 1.4 * T;
        g.fillStyle(0xf4f1ea).fillRect(cx - w / 2 - 2, r.y - rise + 1, w + 4, front + rise - 6);
        g.fillStyle(0x9ed2f0).fillRect(cx - w / 2, r.y - rise + 3, w, front + rise - 10);
        g.fillStyle(0xffffff, 0.55).fillTriangle(cx - w / 2 + 3, r.y - rise + 4, cx - w / 2 + 14, r.y - rise + 4, cx - w / 2 + 3, r.y + 4);
        g.lineStyle(1.5, 0xf4f1ea).lineBetween(cx, r.y - rise + 3, cx, frontY + front - 7);
      }
    }
    // door frame
    g.fillStyle(0x5e3a20).fillRect(doorL - 3, r.y - rise - 6, 5, front + rise + 6).fillRect(doorR - 2, r.y - rise - 6, 5, front + rise + 6);
  }

  draw_counter(g, o, r) {
    if (this.has('counterSection')) {
      // repeat the counter picture along the whole counter
      const { height: H } = COUNTER_ART, src = this.scene.textures.get('counterSection').getSourceImage();
      g.fillStyle(0x000000, 0.16).fillRoundedRect(r.x + 3, r.y + r.h - 4, r.w, 9, 4);
      this.scene.add.tileSprite(r.x, r.y + r.h - H, r.w, H, 'counterSection').setOrigin(0, 0)
        .setTileScale(H / src.height).setDepth(this.depth);
      return;
    }
    const top = this.box(g, r, 'counter', 0xc08552, 0x8a5a33, 0x4a2c17);
    g.lineStyle(1, 0x8a5a33, 0.35);
    for (let y = top.y + 9; y < top.y + top.h; y += 9) g.lineBetween(top.x, y, top.x + top.w, y);
    const frontY = r.y + r.h - HEIGHTS.counter.front;
    for (let x = r.x + 20; x < r.x + r.w; x += 20) {
      g.lineStyle(1, 0x5e3a20).lineBetween(x, frontY + 2, x, r.y + r.h - 4);
      g.lineStyle(1, 0xa47148, 0.6).lineBetween(x + 1.5, frontY + 2, x + 1.5, r.y + r.h - 4);
    }
    // a little cactus and a tip jar
    const cy = top.y + top.h / 2 + 2;
    g.fillStyle(0xbc6c25).fillRect(r.x + 24, cy - 2, 12, 9);
    g.fillStyle(0x52b788).fillRoundedRect(r.x + 27, cy - 14, 6, 13, 3).fillRoundedRect(r.x + 23, cy - 10, 4, 6, 2);
    const jx = r.x + r.w - 20;
    g.fillStyle(0xffffff, 0.5).fillRoundedRect(jx - 7, cy - 12, 14, 16, 3);
    g.fillStyle(0xe9c46a).fillEllipse(jx, cy, 10, 5).fillEllipse(jx + 1, cy - 3, 8, 4);
    g.lineStyle(1, 0xffffff, 0.8).strokeRoundedRect(jx - 7, cy - 12, 14, 16, 3);
  }

  draw_register(g, o, r) {
    const top = this.counterTop(r);
    const baseY = top.y + top.h - 3;
    if (this.has('cashRegister')) {
      this.levelImage('cashRegister', r.x + r.w / 2 + 12, baseY + 2, 46, this.depth); // beside the cashier, not in front of her
      return;
    }
    g.fillStyle(0x000000, 0.2).fillRect(r.x + 12, baseY - 2, r.w - 22, 4);
    g.fillStyle(0x1f2a30).fillRect(r.x + 12, baseY - 12, r.w - 24, 12);
    g.fillStyle(0x2f3e46).fillRect(r.x + 12, baseY - 26, r.w - 24, 14);
    g.fillStyle(0xadb5bd);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(r.x + 44 + i * 5, baseY - 24 + j * 5, 3, 3);
    g.fillStyle(0x495057).fillRect(r.x + 16, baseY - 40, 26, 15);
    g.fillStyle(0x80ed99).fillRect(r.x + 18, baseY - 38, 22, 11);
    g.fillStyle(0x1b4332).fillRect(r.x + 21, baseY - 35, 10, 2).fillRect(r.x + 21, baseY - 31, 14, 2);
    g.fillStyle(0xffffff).fillRect(r.x + 58, baseY - 32, 6, 8);
  }

  // ---------- Outside ----------

  draw_rope(g, o) {
    const pts = o.points.map(([x, y]) => [x * this.T, y * this.T]);
    const pictured = this.has('ropePost');
    const poleH = pictured ? 28 : 26;
    for (const [x, y] of pts) {
      if (pictured) {
        // the nearer post goes in front of the rope, the farther one behind
        g.fillStyle(0x000000, 0.22).fillEllipse(x + 2, y + 1, 18, 6);
        this.imageByHeight('ropePost', x, y + 2, 34, y + 0.1);
        continue;
      }
      g.fillStyle(0x000000, 0.22).fillEllipse(x + 2, y + 1, 18, 6);
      g.fillStyle(0x9c7a13).fillEllipse(x, y, 14, 6);
      g.fillStyle(0xc9a227).fillRect(x - 2.5, y - poleH, 5, poleH);
      g.fillStyle(0xfff3b0, 0.7).fillRect(x - 1.5, y - poleH, 1.5, poleH);
      g.fillStyle(0xd4a017).fillCircle(x, y - poleH - 2, 5);
      g.fillStyle(0xfff3b0).fillCircle(x - 1.5, y - poleH - 3.5, 1.5);
    }
    const [[x1, y1], [x2, y2]] = pts;
    const sag = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - poleH + 2 + Math.sin(t * Math.PI) * 8];
    for (const [width, color, off] of [[5, 0x7a0c1e, 0], [2, 0xe5383b, -1]]) {
      g.lineStyle(width, color);
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const [x, y] = sag(i / 12);
        i === 0 ? g.moveTo(x + off, y + off) : g.lineTo(x + off, y + off);
      }
      g.strokePath();
    }
  }

  draw_dishBin(g, o, r) {
    const top = this.box(g, r, 'dishBin', 0x6c757d, 0x495057, 0x343a40);
    g.fillStyle(0x5c7c99).fillRoundedRect(top.x + 4, top.y + 3, top.w - 8, top.h - 6, 4);
    g.fillStyle(0xffffff).fillEllipse(top.x + 22, top.y + top.h / 2, 20, 10).fillEllipse(top.x + 44, top.y + top.h / 2 + 1, 20, 10);
    g.fillStyle(0x8b5a2b, 0.6).fillCircle(top.x + 20, top.y + top.h / 2, 2.5).fillCircle(top.x + 46, top.y + top.h / 2 + 2, 2);
    g.fillStyle(0xe63946).fillRoundedRect(top.x + 58, top.y + 2, 9, 12, 2);
  }

  draw_trash(g, o, r) {
    const cx = r.x + r.w / 2;
    const bottom = r.y + r.h - 4;
    const topY = bottom - 30;
    g.fillStyle(0x000000, 0.2).fillEllipse(cx + 2, bottom, 34, 10);
    g.fillStyle(0x2d6a4f).fillRect(cx - 14, topY, 28, 30);
    g.fillStyle(0x1b4332);
    for (let x = cx - 10; x < cx + 12; x += 7) g.fillRect(x, topY + 5, 2, 22);
    g.fillStyle(0xffffff, 0.15).fillRect(cx - 12, topY + 2, 4, 26);
    g.fillStyle(0x52b788).fillEllipse(cx, topY, 30, 12);
    g.fillStyle(0x40916c).fillEllipse(cx, topY - 1, 22, 7);
    g.fillStyle(0x1b4332).fillRoundedRect(cx - 5, topY - 5, 10, 4, 2);
  }

  draw_hostStand(g, o, r) {
    const top = this.box(g, r, 'hostStand', 0x8a5a33, 0x6f4428, 0x3d2019);
    const frontY = r.y + r.h - HEIGHTS.hostStand.front;
    g.lineStyle(1, 0xa47148).strokeRect(r.x + 7, frontY + 4, r.w - 14, HEIGHTS.hostStand.front - 10);
    // open booking book
    g.fillStyle(0xffffff).fillRect(top.x + 5, top.y + 4, top.w / 2 - 5, top.h - 8).fillRect(top.x + top.w / 2, top.y + 4, top.w / 2 - 5, top.h - 8);
    g.lineStyle(1, 0xadb5bd);
    for (let i = 0; i < 3; i++) {
      g.lineBetween(top.x + 8, top.y + 9 + i * 5, top.x + top.w / 2 - 3, top.y + 9 + i * 5);
      g.lineBetween(top.x + top.w / 2 + 3, top.y + 9 + i * 5, top.x + top.w - 8, top.y + 9 + i * 5);
    }
  }

  draw_bench(g, o, r) {
    const { rise, front } = HEIGHTS.bench;
    g.fillStyle(0x000000, 0.18).fillRoundedRect(r.x + 4, r.y + r.h - 6, r.w - 4, 9, 4);
    g.fillStyle(0x343a40).fillRect(r.x + 6, r.y + r.h - front, 4, front).fillRect(r.x + r.w - 10, r.y + r.h - front, 4, front);
    const top = r.y - rise, h = r.h + rise - front;
    for (let i = 0; i < 3; i++) {
      g.fillStyle(this.vary(0xa9784a, 0.1)).fillRoundedRect(r.x + 2, top + i * (h / 3) + 1, r.w - 4, h / 3 - 2, 2);
    }
    g.lineStyle(1, 0x5e3f24).strokeRoundedRect(r.x + 2, top + 1, r.w - 4, h - 2, 2);
  }

  draw_planter(g, o, r) {
    const top = this.box(g, r, 'planter', 0x5e3f24, 0x8b5e3c, 0x3d2019);
    const frontY = r.y + r.h - HEIGHTS.planter.front;
    for (let x = r.x + 16; x < r.x + r.w; x += 16) g.lineStyle(1, 0x6b4423).lineBetween(x, frontY + 2, x, r.y + r.h - 4);
    const flowers = [0xff4d6d, 0xffd166, 0xffffff, 0xc77dff];
    for (let x = top.x + 6; x < top.x + top.w - 4; x += 9) {
      const y = top.y + top.h / 2 - 4 + (this.rand() - 0.5) * 6;
      g.fillStyle(this.rand() < 0.5 ? 0x40916c : 0x52b788).fillCircle(x, y, 7);
      if (this.rand() < 0.6) {
        const c = flowers[Math.floor(this.rand() * flowers.length)];
        g.fillStyle(c).fillCircle(x + 2, y - 3, 3);
        g.fillStyle(0xffd166).fillCircle(x + 2, y - 3, 1);
      }
    }
  }

  // ---------- Dining ----------

  draw_table(g, o, r) {
    const cx = r.x + r.w / 2;
    const art = o.seats === 4 ? 'table_4seat' : 'table_2seat';
    if (this.scene.textures.exists(art)) {
      // the back stool tucks in just behind the pictured table top
      const own = this.levelled(art, o.level), t = this.scene.textures.get(own).getSourceImage();
      o.topSeatY = r.y + r.h - (t.height * r.w * (LEVEL_SCALE[own] || 1)) / t.width + 4;
    }
    // a stool wherever a chair has been placed
    tableSeats(o, this.T).forEach(([sx, sy], i) => { if (!o.chairs || o.chairs[i]) this.drawStool(sx, sy, (o.chairs || [])[i]); });

    let my; // middle of the table top, where the lamp and the menu go
    if (this.scene.textures.exists(art)) {
      g.fillStyle(0x000000, 0.18).fillEllipse(cx + 3, r.y + r.h - 2, r.w + 4, 12);
      const img = this.levelImage(art, cx, r.y + r.h, r.w, this.depth - 0.1, o.level);
      my = r.y + r.h - img.displayHeight * 0.68;
    } else {
      const { rise, front } = HEIGHTS.table;
      const topY = r.y - rise, topH = r.h + rise - front;
      g.fillStyle(0x000000, 0.18).fillRoundedRect(r.x + 4, r.y + r.h - 7, r.w - 2, 10, 4);
      g.fillStyle(0x4a2c17);
      g.fillRect(r.x + 6, topY + topH, 5, front).fillRect(r.x + r.w - 11, topY + topH, 5, front);
      g.fillStyle(0x8a5a33).fillRect(r.x, topY + topH, r.w, 5);
      g.fillStyle(0xc68b59).fillRoundedRect(r.x, topY, r.w, topH, 6);
      g.lineStyle(1, 0xa47148, 0.7);
      for (let y = topY + topH / 3; y < topY + topH - 2; y += topH / 3) g.lineBetween(r.x + 3, y, r.x + r.w - 3, y);
      g.fillStyle(0xffffff, 0.2).fillRoundedRect(r.x + 3, topY + 2, r.w - 6, 3, 1);
      g.lineStyle(2, 0x6b4423).strokeRoundedRect(r.x, topY, r.w, topH, 6);
      my = topY + topH / 2;
    }

    // what stands on the table: a candle, a lamp, a vase... (left and right)
    // Lamps and candles light the table at night (`r`: how far their light reaches).
    o.lanterns = [];
    (o.top || []).forEach((id, i) => {
      if (id) this.drawTableTop(g, FURNITURE_BY_ID[id], cx + [-27, 25][i], my, o.lanterns);
    });

    // where the table's one menu card lies (the simulation puts it there)
    o.menuSpot = { x: cx - 1, y: my - 3 };
  }

  drawTableTop(g, item, lx, my, lanterns) {
    if (item.light) lanterns.push({ x: lx, y: my - 6, r: item.light });
    if (item.id === 'vase' && !this.has('vase')) {
      // a little glass vase of tulips
      g.fillStyle(0x000000, 0.18).fillEllipse(lx + 1, my + 4, 12, 4);
      g.fillStyle(0x7ec8e3, 0.85).fillRoundedRect(lx - 3.5, my - 8, 7, 11, 2);
      g.fillStyle(0x2d6a4f).fillRect(lx - 2, my - 14, 1.2, 7).fillRect(lx + 1, my - 13, 1.2, 6);
      g.fillStyle(0xe63946).fillEllipse(lx - 1.5, my - 15, 4, 5);
      g.fillStyle(0xffb703).fillEllipse(lx + 1.8, my - 14, 4, 5);
      return;
    }
    const lamp = item.icon, lampLevel = item.id === 'candle' ? 1 : 3;
    if (item.id === 'candle' && !this.has(lamp)) {
      // a stub of candle stuck on a saucer
      const ly = my + 3;
      g.fillStyle(0x000000, 0.18).fillEllipse(lx + 1, ly + 1, 13, 4);
      g.fillStyle(0x8d99ae).fillEllipse(lx, ly, 12, 4);                    // saucer
      g.fillStyle(0xd9d2c3).fillRect(lx - 2, ly - 8, 4, 8);                // wax
      g.fillStyle(0xf1ede4).fillRect(lx - 2, ly - 8, 1.5, 8);
      g.fillStyle(0x3b2a12).fillRect(lx - 0.5, ly - 10, 1, 2);             // wick
      g.fillStyle(0xffb703).fillEllipse(lx, ly - 12, 3.5, 5.5);            // flame
      g.fillStyle(0xfff3b0).fillEllipse(lx, ly - 11.5, 1.6, 3);
    } else if (this.has(lamp)) {
      g.fillStyle(0x000000, 0.18).fillEllipse(lx + 1, my + 5, 18, 5);
      this.imageByHeight(lamp, lx, my + 5, lampLevel === 1 ? CANDLE_HEIGHT : item.id === 'vase' ? 22 : TABLE_LAMP_HEIGHT, this.depth + 0.2);
    } else {
      const ly = my;
      g.fillStyle(0x000000, 0.18).fillEllipse(lx + 1, ly + 3, 11, 4);
      g.fillStyle(0x3b2a12).fillRect(lx - 4, ly, 8, 3);                    // base
      g.fillStyle(0xffe9a8).fillRect(lx - 3, ly - 9, 6, 9);                // glass
      g.fillStyle(0xffb703).fillRect(lx - 1, ly - 7, 2, 5);                // flame
      g.fillStyle(0xffffff, 0.7).fillRect(lx - 3, ly - 9, 1.5, 9);
      g.fillStyle(0x3b2a12).fillRect(lx - 4, ly - 11, 8, 2).fillRect(lx - 1, ly - 13, 2, 2); // cap
    }
  }

  // Stools are drawn just behind whoever sits on them. (`level`: the chair's level)
  drawStool(sx, sy, level) {
    if (this.scene.textures.exists('stool')) {
      const g = this.scene.add.graphics().setDepth(sy - 1.1);
      g.fillStyle(0x000000, 0.2).fillEllipse(sx + 2, sy, 24, 8);
      this.levelImage('stool', sx, sy + 1, STOOL_WIDTH, sy - 1, level);
      return;
    }
    const g = this.scene.add.graphics().setDepth(sy - 1);
    g.fillStyle(0x000000, 0.2).fillEllipse(sx + 2, sy, 26, 9);
    g.fillStyle(0x868e96).fillEllipse(sx, sy - 1, 16, 5);
    g.fillStyle(0xadb5bd).fillRect(sx - 2, sy - 11, 4, 10);
    g.fillStyle(0x9d0208).fillEllipse(sx, sy - 9, 26, 12);
    g.fillStyle(0xd62828).fillEllipse(sx, sy - 12, 26, 12);
    g.fillStyle(0xffffff, 0.3).fillEllipse(sx - 5, sy - 14, 9, 3);
  }

  // ---------- Decoration ----------

  draw_plant(g, o, r) {
    const cx = r.x + r.w / 2;
    const bottom = r.y + r.h - 4;
    g.fillStyle(0x000000, 0.2).fillEllipse(cx + 2, bottom, 30, 9);
    g.fillStyle(0xbc6c25).fillPoints([
      { x: cx - 11, y: bottom - 18 }, { x: cx + 11, y: bottom - 18 }, { x: cx + 8, y: bottom }, { x: cx - 8, y: bottom },
    ], true);
    g.fillStyle(0xdda15e).fillRect(cx - 12, bottom - 21, 24, 4);
    const leaves = [[-9, -30, 8], [9, -30, 8], [0, -36, 9], [-6, -41, 7], [6, -41, 7], [0, -27, 8]];
    for (const [dx, dy, s] of leaves) {
      g.fillStyle(0x2d6a4f).fillCircle(cx + dx + 1, bottom + dy + 1, s);
      g.fillStyle(0x40916c).fillCircle(cx + dx, bottom + dy, s);
    }
    g.fillStyle(0x74c69d).fillCircle(cx - 3, bottom - 38, 3).fillCircle(cx + 5, bottom - 32, 2.5);
  }

  // A clipped hedge running down the edge of the car park.
  draw_hedge(g, o, r) {
    g.fillStyle(0x000000, 0.18).fillRoundedRect(r.x + 3, r.y + 4, r.w + 4, r.h, 6);
    g.fillStyle(0x2d6a4f).fillRoundedRect(r.x - 3, r.y - 8, r.w + 6, r.h + 8, 7);
    for (let y = r.y - 4; y < r.y + r.h - 4; y += 9) {
      g.fillStyle(this.rand() < 0.5 ? 0x40916c : 0x52b788).fillCircle(r.x + r.w / 2 + (this.rand() - 0.5) * 4, y + 4, 7);
    }
    g.fillStyle(0x1b4332).fillRect(r.x - 3, r.y + r.h - 6, r.w + 6, 6);
  }

  draw_tree(g, o, r) {
    const cx = r.x + r.w / 2, bottom = r.y + r.h;
    g.fillStyle(0x000000, 0.22).fillEllipse(cx + 6, bottom - 4, r.w * 1.1, 16);
    g.fillStyle(0x6f4518).fillRect(cx - 5, bottom - 34, 10, 30);
    g.fillStyle(0x8b5a2b).fillRect(cx - 5, bottom - 34, 3, 30);
    const blobs = [[0, -62, 30], [-20, -50, 22], [20, -50, 22], [-10, -76, 20], [12, -74, 20], [0, -44, 22]];
    for (const [dx, dy, s] of blobs) {
      g.fillStyle(0x1b4332).fillCircle(cx + dx + 3, bottom + dy + 4, s);
    }
    for (const [dx, dy, s] of blobs) {
      g.fillStyle(0x40916c).fillCircle(cx + dx, bottom + dy, s);
    }
    g.fillStyle(0x74c69d, 0.8).fillCircle(cx - 10, bottom - 80, 8).fillCircle(cx + 8, bottom - 66, 6);
  }

  draw_parkingSign(g, o, r) {
    if (this.has('parkingSign')) {
      // stretch the plain blue part; the "P" square on the left stays as drawn
      const s = r.h / this.scene.textures.get('parkingSign').getSourceImage().height;
      this.stretched('parkingSign', r.x, r.y, r.w, r.h, s, [34, 5, 5, 5]);
      this.text(r.x + 56, r.y + r.h / 2, 'PARKING', { fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5);
      return;
    }
    g.fillStyle(0x000000, 0.25).fillRoundedRect(r.x + 3, r.y + 4, r.w, r.h, 8);
    g.fillStyle(0x1d4ed8).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
    g.lineStyle(3, 0xffffff).strokeRoundedRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 6);
    g.fillStyle(0xffffff).fillRoundedRect(r.x + 12, r.y + 10, 34, r.h - 20, 5);
    this.text(r.x + 29, r.y + r.h / 2, 'P', { fontSize: '26px', fontStyle: 'bold', color: '#1d4ed8' }).setOrigin(0.5);
    this.text(r.x + 56, r.y + r.h / 2, 'PARKING', { fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5);
  }

  // A lamp on a side wall, pointing into the room (the picture faces right,
  // so it is flipped on the right-hand wall).
  draw_wallLamp(g, o, r) {
    if (!this.has('wallLamp')) return;
    const onRightWall = o.x > this.layout.indoors.x + this.layout.indoors.w / 2;
    this.imageByHeight('wallLamp', r.x + r.w / 2, r.y + r.h, 28, r.y + r.h).setFlipX(onRightWall);
  }

  // Lamps hanging from the ceiling over the spots listed in the layout's `lights`.
  drawPendants() {
    if (!this.has('pendantLamp')) return;
    for (const l of this.layout.lights || []) {
      const p = l.pendant;
      if (p) this.imageByHeight('pendantLamp', (p.x || l.x) * this.T, p.bottom * this.T, 28, p.floor * this.T);
    }
  }

  // A flower stand: a pot of flowers on a little wooden stand (until there is a picture).
  draw_flowerStand(g, o, r) {
    if (this.has('flowerStand')) return this.imageByHeight('flowerStand', r.x + r.w / 2, r.y + r.h, 34);
    const cx = r.x + r.w / 2, b = r.y + r.h - 2;
    g.fillStyle(0x000000, 0.2).fillEllipse(cx + 2, b, 22, 7);
    g.fillStyle(0x6f4428).fillRect(cx - 7, b - 12, 2, 12).fillRect(cx + 5, b - 12, 2, 12);
    g.fillStyle(0x8a5a33).fillRect(cx - 9, b - 14, 18, 3);
    g.fillStyle(0xc0603a).fillRoundedRect(cx - 7, b - 24, 14, 10, 2);
    g.fillStyle(0x2d6a4f).fillCircle(cx - 4, b - 27, 4).fillCircle(cx + 4, b - 27, 4).fillCircle(cx, b - 30, 4);
    g.fillStyle(0xe63946).fillCircle(cx - 5, b - 30, 2.5);
    g.fillStyle(0xffd166).fillCircle(cx + 4, b - 31, 2.5);
    g.fillStyle(0xf15bb5).fillCircle(cx, b - 34, 2.5);
  }

  // A picture frame on the back wall (until there is a picture of one).
  draw_picture(g, o, r) {
    if (this.has('picture')) return this.imageByHeight('picture', r.x + r.w / 2, r.y + r.h, r.h);
    g.fillStyle(0x000000, 0.25).fillRect(r.x + 2, r.y + 3, r.w, r.h);
    g.fillStyle(0x7a4a1e).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(0x9fd3e6).fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
    g.fillStyle(0x6ab04c).fillTriangle(r.x + 4, r.y + r.h - 4, r.x + r.w / 2, r.y + r.h / 2, r.x + r.w - 4, r.y + r.h - 4);
    g.fillStyle(0xffd166).fillCircle(r.x + r.w - 10, r.y + 10, 3);
  }

  // A standing lamp with a fabric shade (lights the lobby at night).
  draw_floorLamp(g, o, r) {
    const cx = r.x + r.w / 2, bottom = r.y + r.h - 3;
    g.fillStyle(0x000000, 0.22).fillEllipse(cx + 2, bottom, 20, 7);
    g.fillStyle(0x3b2a12).fillEllipse(cx, bottom - 1, 15, 5);
    g.fillStyle(0x5e3a20).fillRect(cx - 1.5, bottom - 44, 3, 43);
    g.fillStyle(0xf6d58a).fillPoints([
      { x: cx - 7, y: bottom - 58 }, { x: cx + 7, y: bottom - 58 }, { x: cx + 11, y: bottom - 42 }, { x: cx - 11, y: bottom - 42 },
    ], true);
    g.fillStyle(0xffffff, 0.35).fillRect(cx - 5, bottom - 57, 3, 13);
    g.lineStyle(1.5, 0x8a6d1f).strokePoints([
      { x: cx - 7, y: bottom - 58 }, { x: cx + 7, y: bottom - 58 }, { x: cx + 11, y: bottom - 42 }, { x: cx - 11, y: bottom - 42 },
    ], true);
  }

  draw_lampPost(g, o, r) {
    const cx = r.x + r.w / 2;
    const bottom = r.y + r.h - 6;
    const headY = bottom - 100;
    g.fillStyle(0xfff3b0, 0.08).fillCircle(cx, headY, 64);
    g.fillStyle(0xfff3b0, 0.12).fillCircle(cx, headY, 40);
    g.fillStyle(0x000000, 0.25).fillEllipse(cx + 2, bottom, 24, 8);
    g.fillStyle(0x1b2a2a).fillRoundedRect(cx - 7, bottom - 10, 14, 10, 2);
    g.fillStyle(0x2d3a3a).fillRect(cx - 3, headY, 6, bottom - headY - 8);
    g.fillStyle(0x495c5c).fillRect(cx - 1.5, headY, 1.5, bottom - headY - 8);
    g.fillStyle(0x1b2a2a).fillRect(cx - 5, bottom - 40, 10, 4);
    // lantern
    g.fillStyle(0x1b2a2a).fillTriangle(cx - 10, headY - 12, cx + 10, headY - 12, cx, headY - 20);
    g.fillStyle(0xffe8a3).fillRect(cx - 8, headY - 12, 16, 14);
    g.fillStyle(0xffffff, 0.7).fillRect(cx - 5, headY - 10, 3, 10);
    g.lineStyle(2, 0x1b2a2a).strokeRect(cx - 8, headY - 12, 16, 14);
    g.fillStyle(0x1b2a2a).fillRect(cx - 9, headY + 2, 18, 3);
  }

  draw_stringLights(g, o) {
    const pts = o.points.map(([x, y]) => [x * this.T, y * this.T]);
    // wires sag a little between their fixing points
    const curve = [];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      const steps = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 34);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        curve.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * 10]);
      }
    }
    curve.push(pts[pts.length - 1]);
    g.lineStyle(2, 0x2b2b2b, 0.85);
    g.beginPath();
    curve.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.strokePath();
    curve.forEach(([x, y], i) => {
      const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
      g.fillStyle(color, 0.18).fillCircle(x, y + 4, 12);
      g.fillStyle(color, 0.35).fillCircle(x, y + 4, 7);
      g.fillStyle(0x2b2b2b).fillRect(x - 1.5, y, 3, 3);
      g.fillStyle(color).fillEllipse(x, y + 5, 7, 9);
      g.fillStyle(0xffffff, 0.8).fillCircle(x - 1, y + 3.5, 1.3);
    });
  }

  // ---------- Role zones ----------

  drawZones() {
    const layer = this.scene.add.container(0, 0).setDepth(DEPTH.zones);
    const g = this.scene.add.graphics();
    layer.add(g);
    for (const z of this.layout.zones) {
      const r = this.rect(z);
      const color = ROLE_COLORS[z.role];
      g.fillStyle(color, 0.16).fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(2, color, 0.9).strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      const hex = '#' + color.toString(16).padStart(6, '0');
      const label = this.text(r.x + 4, r.y + 4, `${z.role.toUpperCase()}\n${z.label}`, {
        fontSize: '11px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: hex, padding: { x: 4, y: 2 },
      });
      layer.add(label);
    }
    return layer;
  }
}
