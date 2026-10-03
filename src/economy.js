// The restaurant's money rules, all in one place so they are easy to tune.
//
// Every day:
//   money in   dish sales (more at better tables) + the restaurant's share of the tips
//   money out  ingredients (bought each morning), rent and fixed costs,
//              electricity (lamps and cooking), everyone's wages, the manager's profit share
// How many customers come depends on the restaurant's level (it rises with
// every upgrade, decoration, table and dish bought) and its reputation (the
// stars customers give it when they leave).
//
// Roles: the player is the Manager and the Waiter. Each has a wallet. The
// manager sets those two roles' pay (STAFF & PAY); the staff the computer
// runs (chef, cashier, cleaner, greeter) have fixed pay that can't be changed.
//
// The numbers are set so a new restaurant makes a small profit (about $20 a
// day) and a well-run, upgraded one a lot more. Change them freely.

const ECONOMY = {
  startingMoney: 80,          // a new restaurant's savings, for its first ingredients
  supplierCredit: 50,         // ingredients may be bought on credit, down to this much below $0


  // Ingredients: bought in packs, each pack enough for `packSize` dishes.
  // A pack costs this share of the dishes' selling price.
  ingredientCost: 0.3,
  packSize: 5,

  rent: 8,                    // per day, fixed
  otherFixedCosts: 2,         // water, licence, cleaning supplies... per day, fixed
  // electricity: a base amount, plus each lamp, plus each dish cooked
  electricity: { base: 2, perLamp: 0.5, perDish: 0.1 },

  // pay per day for the staff the computer runs (the greeter only once hired): fixed by the game
  fixedWages: { chef: 5, cashier: 3, cleaner: 3, greeter: 4 },
  // pay for the roles players play, as a new restaurant starts: the manager can
  // change these in STAFF & PAY, within `payLimits`. Tips not shared out go to the restaurant.
  playerPay: {
    manager: { salary: 0, profitShare: 0.1, tipShare: 0 },
    waiter: { salary: 10, tipShare: 0.7 },
  },
  payLimits: { salary: [0, 40], tipShare: [0, 1], profitShare: [0, 0.3] },

  // customers' reviews (1 to 5 stars when they leave): the reputation is the
  // average of the last `remember` reviews (`start` before there are any)
  reviews: { remember: 40, start: 3 },
  reputationEffect: [0.6, 1.4], // customers per day are multiplied by this: from a 1-star to a 5-star reputation
  happyAbove: 0.5,              // a customer stays happy while more than half of their patience is left

  // customers per day: `base`, plus `perRatingPoint` for every rating point,
  // but never more than `perSeat` for every seat in the restaurant
  customers: { base: 10, perRatingPoint: 1, perSeat: 3 },

  // the restaurant's level by level points (level 1 from 0 points, level 2 from 5 ...)
  starsAt: [0, 5, 11, 18, 26],
  // what earns rating points
  points: { perUpgradeLevel: 1, perDecorPoint: 1, perExtraTable: 2, perTableLevel: 1, perChairLevel: 0.25, greeter: 2, perExtraDish: 0.5 },

  // customers pay more at better tables (table level 1, 2, 3)
  tablePriceBonus: [1, 1.1, 1.2],
  // a seat's own patience bonus: per chair level above 1, and per thing on its table
  chairPatience: 0.08,
  tableTopPatience: 0.03,

  // dishes need a restaurant level to be put on the menu: the dearer the dish, the higher the level
  dishStars: price => (price <= 6 ? 1 : price <= 9 ? 2 : price <= 11 ? 3 : 4),
};

const Economy = {
  // What one pack of a dish's ingredients costs.
  packPrice: dish => Math.max(1, Math.round(dish.price * ECONOMY.packSize * ECONOMY.ingredientCost)),

  // The restaurant's level from what it owns and has placed: { points, stars (the level), nextAt }.
  rating(owned, placed) {
    const P = ECONOMY.points;
    const levels = Object.values(Perks.levels(owned)).reduce((n, level) => n + level - 1, 0);
    const tables = Furniture.tables(placed);
    const tableLevels = tables.reduce((n, [, t]) => n + (t.level || 1) - 1, 0);
    const chairLevels = Object.values(placed).filter(e => e.id === 'chair').reduce((n, c) => n + (c.level || 1) - 1, 0);
    const dishes = Perks.dishes(owned).length - STARTING_DISHES.length;
    const points = Math.floor(levels * P.perUpgradeLevel + Furniture.atmosphere(placed) * P.perDecorPoint
      + Math.max(0, tables.length - 2) * P.perExtraTable + tableLevels * P.perTableLevel + chairLevels * P.perChairLevel
      + (owned.has('greeter') ? P.greeter : 0) + dishes * P.perExtraDish);
    const stars = ECONOMY.starsAt.filter(at => points >= at).length;
    return { points, stars, nextAt: ECONOMY.starsAt[stars] };
  },

  // How many customers come today: more for a better restaurant and a better reputation (stars).
  customersPerDay(owned, placed, seats, reputation = ECONOMY.reviews.start) {
    const C = ECONOMY.customers, [low, high] = ECONOMY.reputationEffect;
    const effect = low + (high - low) * ((reputation - 1) / 4);
    return Math.min(Math.round((C.base + this.rating(owned, placed).points * C.perRatingPoint) * effect), seats * C.perSeat);
  },

  // Lamps that use electricity: the kitchen's own two, plus every lamp placed.
  lamps: placed => 2 + Furniture.lamps(placed),
};
