// Everything customers can order. Prices are in dollars, cook times in ms.
// Pictures are placeholder shapes; real art can replace them later.

const MENU = [
  { id: 'burger',     name: 'Burger',      price: 9,  cookTime: 6000, plate: true },
  { id: 'pizza',      name: 'Pizza',       price: 11, cookTime: 8000, plate: true },
  { id: 'ramen',      name: 'Ramen',       price: 10,  cookTime: 7000, plate: true },
  { id: 'sushi',      name: 'Sushi',       price: 14, cookTime: 6000, plate: true },
  { id: 'tacos',      name: 'Tacos',       price: 8,  cookTime: 5000, plate: true },
  { id: 'biryani',    name: 'Biryani',     price: 12, cookTime: 8000, plate: true },
  { id: 'kebab',      name: 'Kebab',       price: 10,  cookTime: 7000, plate: true },
  { id: 'momo',       name: 'Momo',        price: 7,  cookTime: 5000, plate: true },
  { id: 'fuchka',     name: 'Fuchka',      price: 5,  cookTime: 3000, plate: true },
  { id: 'sundae',     name: 'Sundae',      price: 6,  cookTime: 3000, plate: false },
  { id: 'bubbleTea',  name: 'Bubble Tea',  price: 5,  cookTime: 2500, plate: false },
  { id: 'mangoLassi', name: 'Mango Lassi', price: 5,  cookTime: 2500, plate: false },
];

const MENU_BY_ID = Object.fromEntries(MENU.map(item => [item.id, item]));

const FOOD_SIZE = 38; // px across (its longer side) at scale 1

// Makes a dish to show at (x, y): its pixel-art picture (assets/food/food_<id>.png)
// if there is one, otherwise the simple drawn version. Returns the game object.
// The id 'dirty' is a stack of dirty plates (not on the menu).
function makeFood(scene, id, x, y, s = 1) {
  const key = `food_${id}`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(x, y, key);
    return img.setScale((FOOD_SIZE * s) / Math.max(img.width, img.height));
  }
  const g = scene.add.graphics().setPosition(x, y);
  if (id === DIRTY) drawDirtyPlates(g, s);
  else drawServing(g, id, 0, 0, s);
  return g;
}

const DIRTY = 'dirty';

// A menu card to show at (x, y): its picture (assets/food/menuCard.png) if
// there is one, otherwise a small drawn card.
function makeMenuCard(scene, x, y, height = 14) {
  if (scene.textures.exists('menuCard')) {
    const img = scene.add.image(x, y, 'menuCard');
    return img.setScale(height / img.height);
  }
  const g = scene.add.graphics().setPosition(x, y), w = height * 0.72, h = height;
  g.fillStyle(0x000000, 0.2).fillRect(-w / 2 + 1, -h / 2 + 1.5, w, h);
  g.fillStyle(0x7a1f1f).fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle(0xf6e7c1).fillRect(-w / 2 + 1.2, -h / 2 + 1.2, w - 2.4, h - 2.4);
  g.fillStyle(0x7a1f1f).fillRect(-w / 2 + 2.4, -h / 2 + 2.6, w - 4.8, 1.4);
  g.fillStyle(0x9a8c6a);
  for (let i = 0; i < 3; i++) g.fillRect(-w / 2 + 2.4, -h / 2 + 5.4 + i * 2.2, w - 4.8, 0.9);
  return g;
}

// A small stack of used plates with crumbs and a fork, centred on (0, 0).
function drawDirtyPlates(g, s) {
  const plate = (y, w) => {
    g.fillStyle(0x6b6b6b).fillEllipse(0, y + 1.5 * s, w * s, w * 0.42 * s);
    g.fillStyle(0xf1ede4).fillEllipse(0, y, w * s, w * 0.42 * s);
    g.fillStyle(0xd9d2c3).fillEllipse(0, y, w * 0.62 * s, w * 0.24 * s);
  };
  plate(7 * s, 34);
  plate(2 * s, 32);
  plate(-3 * s, 30);
  // leftovers: sauce smear and crumbs
  g.fillStyle(0xb5651d).fillEllipse(-4 * s, -3 * s, 9 * s, 4 * s);
  g.fillStyle(0xc0392b).fillCircle(5 * s, -2 * s, 2.2 * s);
  g.fillStyle(0x7a5a12).fillCircle(1 * s, -5 * s, 1.3 * s).fillCircle(8 * s, -5 * s, 1.1 * s);
  // fork
  g.lineStyle(1.6 * s, 0x9aa5b1).lineBetween(-12 * s, -8 * s, 10 * s, -1 * s);
}

// Draws a menu item centred on (x, y). At scale 1 it is about 28px big.
function drawMenuItem(g, id, x, y, s = 1) {
  const P = (dx, dy) => ({ x: x + dx * s, y: y + dy * s });
  switch (id) {
    case 'burger':
      g.fillStyle(0xd4892b).fillEllipse(x, y + 8 * s, 26 * s, 8 * s);   // bottom bun
      g.fillStyle(0x5a3214).fillEllipse(x, y + 4 * s, 28 * s, 7 * s);   // patty
      g.fillStyle(0xf9ca24).fillTriangle(x - 12 * s, y + 1 * s, x + 12 * s, y + 1 * s, x, y + 6 * s); // cheese
      g.fillStyle(0x6ab04c).fillEllipse(x, y + 1 * s, 29 * s, 5 * s);   // lettuce
      g.fillStyle(0xe59e3a).fillEllipse(x, y - 5 * s, 26 * s, 13 * s);  // top bun
      g.fillStyle(0xfff3d6);
      for (const [dx, dy] of [[-6, -7], [0, -9], [6, -7], [-2, -4], [4, -3]]) g.fillCircle(x + dx * s, y + dy * s, 1 * s);
      break;

    case 'pizza':
      g.fillStyle(0xf6c453).fillTriangle(x - 12 * s, y - 9 * s, x + 12 * s, y - 9 * s, x, y + 13 * s);
      g.lineStyle(4 * s, 0xc9822b).lineBetween(x - 13 * s, y - 10 * s, x + 13 * s, y - 10 * s); // crust
      g.fillStyle(0xc0392b);
      for (const [dx, dy] of [[-5, -4], [4, -5], [0, 3]]) g.fillCircle(x + dx * s, y + dy * s, 2.6 * s);
      break;

    case 'fries':
      g.fillStyle(0xf9ca24);
      for (let i = -3; i <= 3; i++) g.fillRect(x + i * 3 * s - 1.2 * s, y - 13 * s + Math.abs(i % 2) * 3 * s, 2.5 * s, 12 * s);
      g.fillStyle(0xd63031).fillPoints([P(-9, -3), P(9, -3), P(7, 12), P(-7, 12)], true);
      g.fillStyle(0xf9ca24).fillCircle(x, y + 4 * s, 2.5 * s);
      break;

    case 'coldDrink':
      g.fillStyle(0x2d3436).fillRect(x + 2 * s, y - 17 * s, 2.5 * s, 9 * s);  // straw
      g.fillStyle(0xe74c3c).fillPoints([P(-8, -8), P(8, -8), P(6, 12), P(-6, 12)], true);
      g.fillStyle(0xffffff).fillRect(x - 7 * s, y + 1 * s, 14 * s, 3 * s);   // stripe
      g.fillStyle(0xecf0f1).fillRect(x - 9 * s, y - 10 * s, 18 * s, 3 * s);  // lid
      break;

    case 'coldCoffee':
      g.fillStyle(0x00b894).fillRect(x + 2 * s, y - 17 * s, 2.5 * s, 10 * s); // straw
      g.fillStyle(0xdfe6e9).fillPoints([P(-8, -9), P(8, -9), P(6, 12), P(-6, 12)], true);
      g.fillStyle(0x9c6644).fillPoints([P(-7.3, -3), P(7.3, -3), P(6, 11), P(-6, 11)], true);
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(x - 5 * s, y - 2 * s, 4 * s, 4 * s);
      g.fillRect(x + 1 * s, y + 3 * s, 4 * s, 4 * s);
      break;

    case 'hotCoffee':
      g.lineStyle(1.5 * s, 0x95a5a6, 0.8);
      for (const dx of [-4, 1]) {
        g.lineBetween(x + dx * s, y - 9 * s, x + (dx + 2) * s, y - 13 * s);
        g.lineBetween(x + (dx + 2) * s, y - 13 * s, x + dx * s, y - 17 * s);
      }
      g.lineStyle(2.5 * s, 0xffffff).strokeCircle(x + 8 * s, y + 2 * s, 4 * s); // handle
      g.fillStyle(0xffffff).fillRoundedRect(x - 9 * s, y - 7 * s, 16 * s, 17 * s, 3 * s);
      g.fillStyle(0x6f4e37).fillEllipse(x - 1 * s, y - 6 * s, 15 * s, 4 * s);
      g.lineStyle(1, 0xbdc3c7).strokeRoundedRect(x - 9 * s, y - 7 * s, 16 * s, 17 * s, 3 * s);
      break;
  }
}

// Draws an item the way it is served: food on a plate, drinks on their own.
function drawServing(g, id, x, y, s = 1) {
  if (MENU_BY_ID[id].plate) {
    g.fillStyle(0xffffff).fillEllipse(x, y + 9 * s, 36 * s, 11 * s);
    g.lineStyle(1, 0xbdc3c7).strokeEllipse(x, y + 9 * s, 36 * s, 11 * s);
  }
  drawMenuItem(g, id, x, y, s);
}
