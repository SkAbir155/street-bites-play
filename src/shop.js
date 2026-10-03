// What the shop sells (open at night and in the morning). A new restaurant
// starts bare: two tables with candles, an old kitchen, three dishes, no
// greeter and no decorations. Everything else is bought here.
//
// The dining, kitchen, decor and menu tabs are paid for with the restaurant's
// money; the waiter tab with the waiter's own wallet (tips and pay).
// Furniture and decorations (src/furniture.js) go into the storeroom when
// bought, and are then placed in the restaurant with ARRANGE.
//   furniture  a piece of furniture (see FURNITURE)
//   icon    a picture name from assets/ (see ART_FILES), or an emoji
//   needs   another item that must be bought first
//   chain   this item is one level of something that is upgraded step by step
//           (level 1 is what you start with; the shop shows only the next level)
//   rebuild true if the restaurant has to be set up again to show it
//   outfit  the waiter picture set this item wears (assets/people/<outfit>_front.png ...)

// A two-step upgrade: level 2, then level 3 (ids '<chain>2' and '<chain>3').
function upgradeChain(chain, name, icon, prices, texts) {
  return [2, 3].map(level => ({
    id: `${chain}${level}`, chain, level, name: `${name}, level ${level}`, text: texts[level - 2],
    price: prices[level - 2], rebuild: true,
    icon: Array.isArray(icon) ? icon[level - 2] : level === 3 ? icon : `${icon}_${level}`,
    ...(level === 3 ? { needs: `${chain}2` } : {}),
  }));
}

// The three dishes every restaurant can cook from the first day: the cheapest ones.
const STARTING_DISHES = ['fuchka', 'bubbleTea', 'mangoLassi'];

const SHOP = {
  dining: [
    ...FURNITURE.filter(f => DINING_KINDS.some(kind => f.fits.includes(kind))).map(furniture => ({ id: furniture.id, furniture })),
    { id: 'greeter', name: 'Hire a greeter', text: 'Welcomes people at the door: customers wait 10% longer.', price: 180, icon: 'greeter_front', rebuild: true },
  ],
  kitchen: [
    ...upgradeChain('stove', 'Stove', 'stove', [120, 280],
      ['The chef cooks 15% faster.', 'The chef cooks 30% faster.']),
    ...upgradeChain('fridge', 'Fridge', 'fridge', [90, 220],
      ['Ingredients at hand: cooking is 5% faster.', 'A big fridge: cooking is 10% faster.']),
    ...upgradeChain('prep', 'Prep counter', 'prep', [70, 180],
      ['More room to chop: cooking is 5% faster.', 'A full prep station: cooking is 10% faster.']),
    ...upgradeChain('hood', 'Chimney', 'hood', [80, 200],
      ['Less smoke in the room: customers wait 4% longer.', 'Clean air: customers wait 8% longer.']),
    ...upgradeChain('sink', 'Sink', 'sink', [70, 180],
      ['The cleaner washes up 25% faster.', 'The cleaner washes up 50% faster.']),
    ...upgradeChain('register', 'Cash register', 'cashRegister', [60, 160],
      ['Customers pay faster.', 'Customers pay in a moment.']),
    { id: 'bin', name: 'Bigger dish bin', text: 'Holds 6 stacks of dirty plates instead of 4.', price: 60, icon: 'dishBin_full' },
  ],
  // every decoration makes the place nicer: customers wait a little longer (+1.5% per point)
  decor: FURNITURE.filter(f => !DINING_KINDS.some(kind => f.fits.includes(kind))).map(furniture => ({ id: furniture.id, furniture })),
  // new dishes: the dearer the dish, the dearer its recipe, and the better the
  // restaurant's rating must be (`stars`, see ECONOMY.dishStars)
  menu: MENU.filter(m => !STARTING_DISHES.includes(m.id)).sort((a, b) => a.price - b.price).map(m => ({
    id: `dish_${m.id}`, name: m.name, text: `Adds ${m.name} to the menu. Customers pay $${m.price} for it.`,
    price: m.price * 10, icon: `food_${m.id}`, rebuild: true, // (the menu board is rewritten)
    get stars() { return ECONOMY.dishStars(m.price); },
  })),
  waiter: [
    // (a new waiter carries one dish, holds one order and sees no order pictures)
    { id: 'tray2', chain: 'tray', name: 'Small tray', text: 'Carry 2 dishes at once instead of 1.', price: 40, icon: '🍽️' },
    { id: 'tray3', chain: 'tray', name: 'Big tray', text: 'Carry 3 dishes at once.', price: 100, icon: '🍽️', needs: 'tray2' },
    { id: 'tray4', chain: 'tray', name: 'Giant tray', text: 'Carry 4 dishes at once.', price: 180, icon: '🍽️', needs: 'tray3' },
    { id: 'notepad', name: 'Notepad', text: 'Take up to 4 orders before going to the kitchen window, instead of 1.', price: 60, icon: '📝' },
    { id: 'memory', name: 'Good memory', text: "Each customer's bubble shows the dishes they are waiting for.", price: 50, icon: '🧠' },
    { id: 'arms', name: 'Long arms', text: 'Serve, take orders and clear plates from further away.', price: 80, icon: '💪' },
    { id: 'walkie', name: 'Walkie-talkie', text: 'Orders go to the kitchen the moment you take them. No walk to the window.', price: 250, icon: '📻' },
    { id: 'shoes', name: 'Running shoes', text: 'You walk 15% faster.', price: 40, icon: '👟' },
    { id: 'shoes2', name: 'Pro running shoes', text: 'You walk 30% faster.', price: 90, icon: '⚡', needs: 'shoes' },
    { id: 'smile', name: 'Charming smile', text: 'Every tip is a quarter bigger.', price: 70, icon: '😊' },
    { id: 'suitRed', name: 'Red suit', text: 'A smart red outfit.', price: 30, icon: 'waiterRed_front', outfit: 'waiterRed' },
    { id: 'suitBlue', name: 'Blue suit', text: 'A cool blue outfit.', price: 30, icon: 'waiterBlue_front', outfit: 'waiterBlue' },
    { id: 'suitGreen', name: 'Green suit', text: 'A fresh green outfit.', price: 30, icon: 'waiterGreen_front', outfit: 'waiterGreen' },
    { id: 'suitPurple', name: 'Purple suit', text: 'A royal purple outfit.', price: 50, icon: 'waiterPurple_front', outfit: 'waiterPurple' },
  ],
};
const SHOP_TABS = [['dining', 'DINING'], ['decor', 'DECOR'], ['kitchen', 'KITCHEN'], ['menu', 'MENU'], ['waiter', 'WAITER'], ['store', 'STOREROOM']];
// Everything for the restaurant (not the waiter's own things): what a saved
// game from before the shop was rebuilt is given, so nothing it had is lost.
// What the waiter could already do before these skills had to be bought.
const OLD_WAITER_SKILLS = ['tray2', 'notepad', 'memory'];
// Burger was a starting dish until the menu started with the three cheapest.
const OLD_STARTING_DISHES = ['dish_burger'];
const ALL_RESTAURANT_ITEMS = [...['kitchen', 'menu'].flatMap(tab => SHOP[tab].map(item => item.id)), 'greeter', ...OLD_FURNITURE_ITEMS];

const WAITER_OUTFITS = ['waiter', 'waiterRed', 'waiterBlue', 'waiterGreen', 'waiterPurple'];

// Which upgrade chain a furniture picture belongs to.
// (tables and chairs have a level each instead: see Furniture)
const PICTURE_CHAIN = {
  cashRegister: 'register',
  stove: 'stove', fridge: 'fridge', prep: 'prep', hood: 'hood', sink: 'sink',
};

// What the things bought so far change. `owned` is a Set of item ids;
// `placed` is the furniture standing in the restaurant (see Furniture).
const Perks = {
  // 1, 2 or 3: how far an upgrade chain has been bought
  level: (owned, chain) => (owned.has(`${chain}3`) ? 3 : owned.has(`${chain}2`) ? 2 : 1),
  // the levels of every chain, e.g. { chairs: 1, stove: 3, ... }
  levels: owned => Object.fromEntries(['stove', 'fridge', 'prep', 'hood', 'sink', 'register']
    .map(chain => [chain, Perks.level(owned, chain)])),

  // share of the normal cooking time
  cookSpeed: owned => [1, 0.85, 0.7][Perks.level(owned, 'stove') - 1]
    * [1, 0.95, 0.9][Perks.level(owned, 'fridge') - 1] * [1, 0.95, 0.9][Perks.level(owned, 'prep') - 1],
  washSpeed: owned => [1, 0.75, 0.5][Perks.level(owned, 'sink') - 1],   // share of the normal washing-up time
  paySpeed: owned => [1, 0.6, 0.3][Perks.level(owned, 'register') - 1], // share of the normal paying time
  binSize: owned => (owned.has('bin') ? 6 : SIM.binSize),
  // (each seat adds its own: see RestaurantSim.seatPatience)
  patience: (owned, placed) => (1 + 0.04 * (Perks.level(owned, 'hood') - 1)
    + 0.015 * Furniture.atmosphere(placed) + (owned.has('greeter') ? 0.1 : 0)),
  walkSpeed: owned => (owned.has('shoes2') ? 1.3 : owned.has('shoes') ? 1.15 : 1),
  hands: owned => (owned.has('tray4') ? 4 : owned.has('tray3') ? 3 : owned.has('tray2') ? 2 : 1), // dishes carried at once
  notepad: owned => (owned.has('notepad') ? 4 : 1),  // orders held before they must be sent to the kitchen
  reach: owned => (owned.has('arms') ? 1.45 : 1),     // how far the waiter can reach, as a share of normal
  tips: owned => (owned.has('smile') ? 1.25 : 1),
  // the dishes on the menu
  dishes: owned => MENU.filter(m => STARTING_DISHES.includes(m.id) || owned.has(`dish_${m.id}`)),
};
