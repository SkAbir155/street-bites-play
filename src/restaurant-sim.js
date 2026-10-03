// Runs the restaurant: customers arrive, sit down, wait for the waiter to take
// their order, wait for their food, eat, pay at the register and leave.
// The waiter is the player; the chef, greeter, cashier and cleaner are simple
// bots for now.

const SIM = {
  maxCustomers: 6,
  // A day: the restaurant opens and closes at these hours (24h clock); one
  // game hour lasts this many real seconds. Day 1 brings `customers[0]`
  // customers, and each later day `customers[1]` more.
  day: { open: 8, close: 22, secondsPerHour: 18, customers: [12, 2] },
  // The waiter's own money. A customer tips this share of their bill, but only
  // if every dish reached them while at least `tipBar` of their patience bar was left.
  tipShare: 0.2,
  tipBar: 0.75,
  cleanTip: 1,                // when a new customer sits at a table the waiter cleaned
  menuTime: [4000, 7000],     // how long a customer reads the menu before they are ready to order (ms)
  messPatience: 0.6,          // a customer at a table with dirty plates waits only this share as long
  binSize: 4,                 // stacks of dirty plates the dish bin holds before the cleaner must empty it
  cleaner: { sink: [2.3, 4.4], bin: [9.55, 7.7], speed: 80, washTime: 2500 },
  wasteCharge: 0.5,           // share of a dish's price charged for throwing away food someone wanted
  orderPatience: 30000,       // how long a seated customer waits for the waiter
  foodPatience: 60000,        // how long they then wait for their food
  eatTime: 5000,
  eatTimePerExtraDish: 2000,
  payTime: 1500,
  walkSpeed: 90,
  reach: 1.3,                 // how close (tiles) the waiter must be to use something
  pickup: {                   // the window in the kitchen's right wall
    standX: 10.4,             // where the waiter stands, just outside it
    plateX: 9.5,              // where plates sit on the shelf
    slotsY: [4.3, 4.95, 5.6],
  },
  sidewalkY: 13.2,
  greetSpot: [12.3, 11.2],    // just inside the front door, next to the greeter
  greetFacing: 'right',
  queue: { x: 7.2, y: 9.7, gap: 0.7 },
  register: [7.3, 7.4],
};

const STAFF = {
  chef:    { x: 6,    y: 3.6, facing: 'up',   outfit: 'chef',    hair: 0x2b2118, hairStyle: 'short', skin: 0xe0ac69 },
  cleaner: { x: 2.3,  y: 4.4, facing: 'left', outfit: 'cleaner', hair: 0x6f1d1b, hairStyle: 'bun' },
  cashier: { x: 6.5,  y: 7.9, facing: 'down', outfit: 'cashier', hair: 0xa47148, hairStyle: 'long', skin: 0xffdbac },
  greeter: { x: 13.6, y: 10.5, facing: 'left', outfit: 'greeter', hair: 0x111111, hairStyle: 'curly', skin: 0x8d5524 },
};

const CUSTOMER_LOOKS = {
  shirt:     [0xf77f00, 0x6a4c93, 0x2a9d8f, 0xd62828, 0x3a86ff, 0x8ac926, 0xff595e, 0x1982c4, 0xffca3a, 0xf15bb5],
  pants:     [0x3d5a80, 0x2b2d42, 0xa68a64, 0x6c757d, 0x1d3557],
  skin:      [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524],
  hair:      [0x2b2118, 0x111111, 0x5a3825, 0xd4a017, 0xa0522d, 0x7b7b7b, 0xc1440e],
  hairStyle: ['short', 'short', 'long', 'bun', 'spiky', 'curly', 'bald'],
};

const CUSTOMER_SPRITES = ['customer1', 'customer2', 'customer3', 'customer4', 'customer5', 'customer6'];

function randomLook() {
  const pick = Phaser.Utils.Array.GetRandom, L = CUSTOMER_LOOKS;
  return {
    outfit: 'casual', shirt: pick(L.shirt), pants: pick(L.pants), skin: pick(L.skin),
    hair: pick(L.hair), hairStyle: pick(L.hairStyle), glasses: Math.random() < 0.2,
  };
}

// Every stool in the layout, with the direction a seated customer faces.
function buildSeats(layout) {
  const T = layout.tileSize;
  const seats = [];
  for (const o of layout.objects) {
    if (o.type !== 'table') continue;
    const cx = (o.x + o.w / 2) * T, cy = (o.y + o.h / 2) * T;
    // The part of the table top where dishes can sit without hanging over an
    // edge. A 4-seat table shows a deep top; a 2-seat table only a thin strip.
    const left = o.x * T + 18, right = (o.x + o.w) * T - 18;
    const surface = o.seats === 4
      ? { left, right, top: o.y * T + 20, bottom: o.y * T + 40, cx, cy: o.y * T + 30, deep: true }
      : { left, right, top: o.y * T + 1, bottom: o.y * T + 1, cx, cy: o.y * T + 1, deep: false };
    tableSeats(o, T).forEach(([x, y], i) => {
      if (o.chairs && !o.chairs[i]) return; // no chair here: nobody can sit
      const dx = cx - x, dy = cy - y;
      const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      seats.push({
        x, y, facing, surface, table: o.number, tableX: cx, tableY: cy, tableBottom: (o.y + o.h) * T, taken: null,
        level: o.level || 1, chair: (o.chairs || [])[i] || 1, tops: (o.top || []).filter(Boolean).length,
      });
    });
  }
  return seats;
}

class RestaurantSim {
  constructor(scene, layout, player) {
    this.scene = scene;
    this.T = layout.tileSize;
    this.W = layout.width; // in tiles
    this.player = player;
    this.money = 0;      // the restaurant's money (all days)
    this.wallet = 0;     // the waiter's own money: tips kept from earlier days
    this.day = 1;
    const saved = SaveGame.current(); // carry on from the morning after the last finished day
    this.day = saved.day;
    this.wallet = saved.wallet || 0;
    this.money = saved.money || 0;
    this.owned = new Set(saved.owned);   // ids of everything bought in the shop
    this.outfit = player.sprite;         // which outfit the waiter is wearing
    this.binSize = Perks.binSize(this.owned);
    this.hands = Perks.hands(this.owned); // how many dishes the waiter can carry
    this.stock = { ...(saved.stock || {}) }; // how many of each dish the kitchen has ingredients for
    this.placed = JSON.parse(JSON.stringify(saved.placed || {})); // furniture standing in the restaurant
    this.store = JSON.parse(JSON.stringify(saved.store || []));   // furniture bought but not placed
    this.history = [...(saved.history || [])]; // one line of statistics per finished day (see endDay)
    // the roles' pay (set by the manager) and the manager's own wallet (`wallet` is the waiter's)
    this.pay = JSON.parse(JSON.stringify(saved.pay || ECONOMY.playerPay));
    this.managerWallet = saved.managerWallet || 0;
    this.reviews = [...(saved.reviews || [])]; // the last customers' stars (the reputation)
    this.name = saved.name;
    this.ingredientsBought = saved.ingredientsBought || 0; // spent on ingredients since the last report (that night, or this morning)
    // ms the restaurant has been running: it stands still while the game is
    // paused, so customers' patience does too
    this.now = 0;
    // 'stats' when anything in the HUD changes, 'dayEnd' (with the day's report), 'dayStart'
    this.events = new Phaser.Events.EventEmitter();

    this.customers = [];
    this.tickets = [];                                  // orders the waiter has taken but not sent
    this.kitchenQueue = [];                             // item ids waiting to be cooked
    this.cooking = null;                                // item id on the stove right now
    this.cookingCancelled = false;
    this.plates = SIM.pickup.slotsY.map(() => null);    // what sits on the pickup window
    this.payQueue = [];
    this.seats = buildSeats(layout);
    // tables are numbered as they appear: top row first, left to right (T1, T2 ...)
    const tables = [...new Set(this.seats.map(s => s.table))]
      .map(n => layout.objects.find(o => o.type === 'table' && o.number === n))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (const s of this.seats) s.label = tables.findIndex(o => o.number === s.table) + 1;
    const bin = layout.objects.find(o => o.type === 'trash'); // where unwanted food goes
    this.trashCan = bin && { x: (bin.x + bin.w / 2) * this.T, y: (bin.y + bin.h) * this.T };
    const tub = layout.objects.find(o => o.type === 'dishBin');  // where dirty plates go
    this.dishBin = tub && { x: (tub.x + tub.w / 2) * this.T, y: (tub.y + tub.h) * this.T };
    this.paths = new PathFinder(makeCanStand(layout, 'customer'), layout.width * this.T, layout.height * this.T);
    this.paths.keepReachableFrom([SIM.greetSpot[0] * this.T, SIM.greetSpot[1] * this.T]);

    this.staff = {};
    for (const [role, look] of Object.entries(STAFF)) {
      if (role === 'greeter' && !this.owned.has('greeter')) continue; // not hired yet
      this.staff[role] = new Person(scene, this.T, look);
    }
    this.staff.cleaner.working = true; // always scrubbing at the sink

    this.action = null; // what the smart button would do right now
    this.highlight = scene.add.graphics().setDepth(DEPTH.overhead - 1);
    this.staffPaths = new PathFinder(makeCanStand(layout, 'cleaner'), layout.width * this.T, layout.height * this.T);
    this.staffPaths.keepReachableFrom(SIM.cleaner.sink.map(v => v * this.T));
    this.setBin(0);
    scene.events.on('update', this.update, this);

    this.createMenuCards(layout);
    this.startDay();
    this.createTipTag();
    this.runKitchen();
    this.runCleaner();
  }

  // ---------- Days ----------

  startDay() {
    this.clock = SIM.day.open;  // time of day in hours, e.g. 13.5 = 1:30 PM
    // 'morning' (buying ingredients, the clock stands still) -> 'open' -> 'closing'
    // (no new customers) -> 'closed' (report shown)
    this.phase = 'morning';
    this.served = 0;
    this.lost = 0;
    this.soldOut = 0;           // customers who found nothing left to eat
    this.sales = 0;             // money taken today
    this.tips = 0;              // the waiter's tips today (before the restaurant's share)
    this.kitchenLog = {};       // every dish the kitchen made today: id -> { made, served, wasted, unclaimed }
    this.dishSales = {};        // what each dish brought in today: id -> [how many, $]
    this.happy = 0;             // customers who stayed happy until they left
    this.todayReviews = [];     // the stars customers gave today
    // when today's customers arrive: spread over the day, each a little early or late.
    // How many depends on how good the restaurant is.
    const count = this.customersToday = this.expectedCustomers();
    const first = SIM.day.open + 0.3, last = SIM.day.close - 1.5, gap = (last - first) / Math.max(1, count - 1);
    this.arrivals = Array.from({ length: count }, (_, i) => first + gap * (i + (Math.random() - 0.5) * 0.6))
      .sort((a, b) => a - b);
    if (this.tipTag) this.drawTipTag();
    this.emitStats();
    this.events.emit('dayStart', this);
  }

  // How many customers come in a day, the way the restaurant is now.
  expectedCustomers() {
    return Economy.customersPerDay(this.owned, this.placed, this.seats.length, this.reputation());
  }

  // The restaurant's reputation: the average stars of its last reviews.
  reputation() {
    return this.reviews.length ? this.reviews.reduce((a, b) => a + b, 0) / this.reviews.length : ECONOMY.reviews.start;
  }

  // ---------- Roles' pay (STAFF & PAY) ----------

  // Changes a player role's pay: `role` 'manager' or 'waiter', `key` 'salary',
  // 'tipShare' or 'profitShare'. Kept within the limits, and the tips shared
  // out can never be more than all of them.
  setPay(role, key, value) {
    const [lo, hi] = ECONOMY.payLimits[key];
    let v = Math.min(hi, Math.max(lo, value));
    if (key === 'tipShare') {
      const other = this.pay[role === 'manager' ? 'waiter' : 'manager'].tipShare || 0;
      v = Math.min(v, 1 - other);
    }
    this.pay[role][key] = Math.round(v * 100) / 100;
    this.save();
    this.drawTipTag();
  }

  // The tips each side gets today: the manager's and waiter's shares, the rest to the restaurant.
  managerTips() {
    return Math.round(this.tips * (this.pay.manager.tipShare || 0));
  }

  // How much longer than usual a customer waits at this seat: a better chair,
  // and things on the table.
  seatPatience(seat) {
    return 1 + ECONOMY.chairPatience * (seat.chair - 1) + ECONOMY.tableTopPatience * seat.tops;
  }

  // ---------- Furniture ----------

  // Buys a piece of furniture into the storeroom ({ id, level }). Returns false if there isn't enough money.
  buyFurniture(entry) {
    const price = Furniture.price(entry);
    if (this.money < price) return false;
    this.money -= price;
    this.store.push({ ...entry });
    this.save();
    this.emitStats();
    return true;
  }

  // Sells one thing from the storeroom (its place in the list) for half its price.
  sellStored(index) {
    const [entry] = this.store.splice(index, 1);
    if (!entry) return;
    this.money += Furniture.sellPrice(entry);
    this.save();
    this.emitStats();
  }

  // Keeps a new arrangement of the furniture (from ARRANGE): `money` is what
  // selling things there brought in. The restaurant is rebuilt to show it.
  arrange(placed, store, money) {
    this.placed = placed;
    this.store = store;
    this.money += money;
    this.save();
  }

  // The ingredients are bought: open the doors.
  openDay() {
    this.phase = 'open';
    this.emitStats();
  }

  // Buys ingredients: `packs` is { dish id: number of packs }. Returns the cost.
  buyIngredients(packs) {
    let cost = 0;
    for (const [id, n] of Object.entries(packs)) {
      if (!(n > 0)) continue;
      cost += n * Economy.packPrice(MENU_BY_ID[id]);
      this.stock[id] = (this.stock[id] || 0) + n * ECONOMY.packSize;
    }
    this.money -= cost;
    this.ingredientsBought += cost;
    this.save();
    this.emitStats();
    return cost;
  }

  // How many more of a dish can still be ordered today: the ingredients in
  // stock, less what customers have ordered but the kitchen hasn't cooked yet.
  available(id) {
    const count = (list) => list.filter(x => x === id).length;
    const ordered = this.customers.reduce((n, c) => n + count(c.remaining), 0);
    const madeAlready = this.plates.filter(p => p && p.item === id).length + count(this.player.held)
      + (this.cooking === id && !this.cookingCancelled ? 1 : 0);
    return (this.stock[id] || 0) - Math.max(0, ordered - madeAlready);
  }

  // What a customer's dishes cost them: more at better tables.
  billOf(c) {
    const bonus = ECONOMY.tablePriceBonus[(c.seat.level || 1) - 1];
    return Math.round(c.items.reduce((sum, item) => sum + item.price, 0) * bonus);
  }

  // The tips the waiter keeps today, once the restaurant has had its share.
  tipsKept() {
    return Math.round(this.tips * this.pay.waiter.tipShare);
  }

  // The day is over: add up the waiter's pay and hand the report to the screen.
  endDay() {
    this.phase = 'closed';
    const kitchen = MENU.filter(m => this.kitchenLog[m.id])
      .map(m => ({ name: m.name, price: m.price, ...this.kitchenLog[m.id] }));
    const wastedDishes = kitchen.reduce((n, k) => n + k.wasted, 0);
    const deduction = kitchen.reduce((sum, k) => sum + k.wasted * Math.max(1, Math.round(k.price * SIM.wasteCharge)), 0);
    const walletBefore = this.wallet;

    // the restaurant's day: sales came in and ingredients went out during the
    // day; now its share of the tips, and the bills
    const E = ECONOMY, F = E.fixedWages, P = this.pay;
    const tipShare = this.tips - this.tipsKept() - this.managerTips(); // what the restaurant keeps of the tips
    const wages = { Chef: F.chef, Cashier: F.cashier, Cleaner: F.cleaner };
    if (this.staff.greeter) wages.Greeter = F.greeter;
    wages.Manager = P.manager.salary;
    wages.Waiter = P.waiter.salary;
    const wageTotal = Object.values(wages).reduce((a, b) => a + b, 0);
    const fixed = E.rent + E.otherFixedCosts;
    const made = kitchen.reduce((n, k) => n + k.made, 0);
    const tables = new Set(this.seats.map(s => s.table)).size;
    const electricity = Math.round(E.electricity.base + E.electricity.perLamp * Economy.lamps(this.placed)
      + E.electricity.perDish * made);
    const beforeManager = this.sales + tipShare - this.ingredientsBought - fixed - electricity - wageTotal;
    const manager = Math.max(0, Math.round(beforeManager * P.manager.profitShare)); // the manager's profit share
    this.money += tipShare - fixed - electricity - wageTotal - manager;
    const managerBefore = this.managerWallet;
    this.managerWallet += P.manager.salary + manager + this.managerTips();
    const rated = this.todayReviews.length;
    const stars = rated ? this.todayReviews.reduce((a, b) => a + b, 0) / rated : null;

    // a line for the statistics (the last 365 days are kept)
    this.history.push({
      day: this.day, sales: this.sales, profit: beforeManager - manager, served: this.served, lost: this.lost, soldOut: this.soldOut,
      tips: this.tips, ingredients: this.ingredientsBought, wages: wageTotal, bills: fixed + electricity + manager,
      happy: this.happy, stars: stars && Math.round(stars * 10) / 10, reviews: rated,
      dishes: Object.fromEntries(Object.entries(this.dishSales).map(([id, [n, money]]) => [id, [n, Math.round(money)]])),
    });
    this.history = this.history.slice(-365);

    // the waiter's day
    this.wallet = Math.max(0, this.wallet + this.tipsKept() + P.waiter.salary - deduction);
    this.save();
    this.emitStats();
    this.events.emit('dayEnd', {
      day: this.day, served: this.served, lost: this.lost, soldOut: this.soldOut, expected: this.customersToday,
      sales: this.sales, tipShare, ingredients: this.ingredientsBought, rent: E.rent, otherFixed: E.otherFixedCosts,
      electricity, wages, manager, profit: beforeManager - manager, money: this.money,
      rating: Economy.rating(this.owned, this.placed), kitchen, tips: this.tips, tipsKept: this.tipsKept(), pay: P.waiter.salary,
      wastedDishes, deduction, walletBefore, wallet: this.wallet,
      managerPay: { salary: P.manager.salary, share: manager, tips: this.managerTips(), before: managerBefore, wallet: this.managerWallet },
      happy: this.happy, stars, reviews: rated, reputation: this.reputation(), nextCustomers: this.expectedCustomers(),
    });
    this.ingredientsBought = 0; // anything bought from now on counts in tomorrow's report
    this.save();
  }

  // Writes the game to its save slot. Once the day is over, the save is for
  // the next morning.
  save() {
    SaveGame.store({
      v: 5, day: this.phase === 'closed' ? this.day + 1 : this.day,
      wallet: this.wallet, money: this.money, owned: [...this.owned], outfit: this.outfit, stock: this.stock,
      placed: this.placed, store: this.store, ingredientsBought: this.ingredientsBought, history: this.history, name: this.name,
      pay: this.pay, managerWallet: this.managerWallet, reviews: this.reviews,
    });
  }

  // ---------- Shop ----------

  // Buys a shop item with the restaurant's money (`purse` 'restaurant') or the
  // waiter's wallet ('waiter'). Returns false if there isn't enough money.
  buy(item, purse) {
    const key = purse === 'restaurant' ? 'money' : 'wallet';
    if (this.owned.has(item.id) || this[key] < item.price) return false;
    this[key] -= item.price;
    this.owned.add(item.id);
    this.binSize = Perks.binSize(this.owned);
    this.hands = Perks.hands(this.owned);
    this.scene.controller.speed = WAITER_SPEED * Perks.walkSpeed(this.owned);
    this.save();
    this.drawTipTag();
    this.emitStats();
    return true;
  }

  // Puts the waiter in an outfit that has been bought.
  wear(outfit) {
    this.outfit = outfit;
    this.player.wear(outfit);
    this.save();
  }

  // Next morning: the cleaner has tidied up overnight.
  nextDay() {
    for (const seat of this.seats) {
      if (seat.dirty) seat.dirty.forEach(plate => plate.destroy());
      seat.dirty = null;
      seat.cleaned = false; // the cleaner did it, not the waiter: no tip
    }
    this.setBin(0);
    for (const plate of this.plates) if (plate) this.removePlate(plate);
    this.kitchenQueue = [];
    this.tickets = [];
    this.player.hold([]);
    this.day++;
    this.startDay();
  }

  logDish(id, what) {
    const row = this.kitchenLog[id] || (this.kitchenLog[id] = { made: 0, served: 0, wasted: 0, unclaimed: 0 });
    row[what]++;
  }

  // Sent orders that are still waiting for this dish, oldest first.
  customersWanting(id) {
    return this.customers.filter(c => c.orderTaken && !this.tickets.some(t => t.customer === c) && c.remaining.includes(id));
  }

  // A tip for the waiter: it pops up over their head and adds to the little
  // counter that floats above them.
  giveTip(amount) {
    if (amount <= 0) return;
    this.tips += amount;
    this.sfx('tip');
    const p = this.player;
    this.floatText(p.root.x, p.root.y + p.topY - 44, `+$${amount}`, '#7CFC8A');
    this.drawTipTag();
    this.scene.tweens.add({ targets: this.tipTag, scale: 1.25, duration: 110, yoyo: true });
  }

  // The floating counter above the waiter: all their tips (earlier days + today).
  createTipTag() {
    this.tipTagBg = this.scene.add.graphics();
    this.tipTagText = this.scene.add.text(6, 0, '', {
      fontFamily: '"Courier New", Consolas, monospace', fontSize: '11px', fontStyle: 'bold', color: '#fff6dc', resolution: 3,
    }).setOrigin(0, 0.5);
    this.tipTag = this.scene.add.container(0, 0, [this.tipTagBg, this.tipTagText]).setDepth(DEPTH.ui - 1);
    this.drawTipTag();
  }

  drawTipTag() {
    const text = this.tipTagText.setText(`$${this.wallet + this.tipsKept()}`), w = text.width + 22, g = this.tipTagBg;
    text.setX(-w / 2 + 16);
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 1, -7, w, 16, 8);
    g.fillStyle(0x3b1f0c).fillRoundedRect(-w / 2, -9, w, 16, 8);
    g.fillStyle(0x7a4a1e).fillRoundedRect(-w / 2 + 1, -8, w - 2, 14, 7);
    g.fillStyle(0xb7811a).fillCircle(-w / 2 + 9, -1, 5.5);   // a little coin
    g.fillStyle(0xf6c945).fillCircle(-w / 2 + 9, -1.5, 4.5);
  }

  // Share of a customer's patience that is left (1 = just started waiting).
  patienceLeft(c) {
    return Phaser.Math.Clamp(1 - (this.now - c.waitStart) / c.patience, 0, 1);
  }

  emitStats() {
    this.events.emit('stats', this);
  }

  wait(ms) {
    return wait(this.scene, ms);
  }

  // Walk a person to a tile position, going around furniture.
  goTo(person, [tx, ty]) {
    const T = this.T;
    const pts = this.paths.find([person.root.x, person.root.y], [tx * T, ty * T]);
    return person.walk(pts.map(([x, y]) => [x / T, y / T]), SIM.walkSpeed);
  }

  // ---------- Customers ----------

  async runCustomer(seat) {
    const T = this.T;
    const fromLeft = Math.random() < 0.5;
    const person = new Person(this.scene, T,
      { x: fromLeft ? -1 : this.W + 1, y: SIM.sidewalkY, ...randomLook(), sprite: this.pickCustomerSprite() });
    const c = { person, seat, items: this.pickOrder(), state: 'arriving' };
    c.remaining = c.items.map(item => item.id); // dishes not brought yet
    c.onTable = [];                             // pictures of the dishes already on the table
    seat.taken = c;
    this.customers.push(c);

    // arrive, and get greeted if a greeter has been hired
    await person.walk([[SIM.greetSpot[0], SIM.sidewalkY]], SIM.walkSpeed);
    await this.goTo(person, SIM.greetSpot);
    this.sfx('door');
    if (this.staff.greeter) {
      person.setFacing(SIM.greetFacing);
      this.staff.greeter.say('👋', 800);
      await person.say('👋', 800);
    }

    // sit down
    await this.goTo(person, [seat.x / T, seat.y / T]);
    person.sit(seat.facing, this.scene.textures.exists('stool') ? -11 : 5); // up onto the taller pictured stool
    if (seat.cleaned) {            // they found a table the waiter had cleaned: a small tip
      seat.cleaned = false;
      this.giveTip(SIM.cleanTip);
    }
    // Dirty plates left on their table put them off: they wait less and don't tip.
    c.messy = this.tableIsMessy(seat.table);
    c.happy = !c.messy; // stays true while they never get unhappy
    const patience = (c.messy ? SIM.messPatience : 1) * Perks.patience(this.owned, this.placed) * this.seatPatience(seat);
    if (c.messy) await person.say('😖', 1300);

    // read the menu, then wait for the waiter to take the order, then for all the food
    c.state = 'reading';
    person.setReading(true);
    person.bubble.setText('📖').setVisible(true);
    await this.wait(Phaser.Math.Between(...SIM.menuTime));
    person.bubble.setVisible(false);
    person.setReading(false);
    if (!c.items.length) {      // everything on the menu has run out today
      this.soldOut++;
      seat.taken = null;
      this.emitStats();
      this.review(c, 2);
      await person.say('😞 Sold out', 1500);
      await this.leave(c, fromLeft);
      return;
    }
    const ordered = await this.waitFor(c, 'readyToOrder', SIM.orderPatience * patience);
    const fed = ordered && await this.waitFor(c, 'waitingFood', SIM.foodPatience * patience);

    if (!fed) {
      this.lost++;
      this.emitStats();
      this.cancelOrder(c);
      this.clearTable(c);
      seat.taken = null;
      this.sfx('angry');
      this.review(c, 1);
      await person.say('😠', 1200);
      await this.leave(c, fromLeft);
      return;
    }

    // eat (longer for more dishes), pay, leave
    c.state = 'eating';
    await person.say('😋', SIM.eatTime + SIM.eatTimePerExtraDish * (c.items.length - 1));
    this.leaveDirtyPlates(c); // the seat can't be used again until the waiter clears it
    seat.taken = null;
    c.state = 'paying';
    await this.payBill(c);
    this.review(c, this.starsFor(c));
    await this.leave(c, fromLeft);
  }

  // How many stars a customer who was served gives: 3, plus one for staying
  // happy and one for a nice table; minus one for food that came too slowly
  // and one for a messy table.
  starsFor(c) {
    const s = c.seat, nice = s.level >= 2 || (s.chair >= 2 && s.tops >= 1);
    return Math.max(1, Math.min(5, 3 + (c.happy ? 1 : 0) + (nice ? 1 : 0) - (c.servedLate ? 1 : 0) - (c.messy ? 1 : 0)));
  }

  // A customer leaves their review: their stars float up, and count for the reputation.
  review(c, stars) {
    this.todayReviews.push(stars);
    this.reviews = [...this.reviews, stars].slice(-ECONOMY.reviews.remember);
    if (c.happy && stars > 2) this.happy++; // (an angry or sold-out customer was not happy)
    const p = c.person.root;
    this.floatText(p.x, p.y + c.person.topY - 16, '★'.repeat(stars) + '☆'.repeat(5 - stars), stars >= 4 ? '#ffd166' : stars >= 3 ? '#ffe9b8' : '#ff9b8a');
  }

  // What a customer orders: usually one or two dishes, sometimes three
  // (never the same dish twice).
  pickOrder() {
    const menu = Perks.dishes(this.owned).filter(m => this.available(m.id) > 0); // on the menu, and not sold out
    const r = Math.random(), count = r < 0.45 ? 1 : r < 0.85 ? 2 : 3;
    return Phaser.Utils.Array.Shuffle(menu).slice(0, count);
  }

  // Shows a bubble with a patience bar and waits until the waiter helps
  // (resolves true) or patience runs out (resolves false).
  async waitFor(c, state, patience) {
    c.state = state;
    c.waitStart = this.now;
    c.patience = patience;
    this.showBubble(c);
    const helped = await new Promise(done => { c.finishWaiting = done; });
    c.bubble.destroy();
    return helped;
  }

  // One of the pixel-art customers, preferring ones not already here.
  pickCustomerSprite() {
    const made = CUSTOMER_SPRITES.filter(name => this.scene.textures.exists(`${name}_front`));
    const here = new Set(this.customers.map(c => c.person.sprite));
    const free = made.filter(name => !here.has(name));
    return Phaser.Utils.Array.GetRandom(free.length ? free : made) || null;
  }

  showBubble(c) {
    const box = this.scene.add.container(0, 0).setDepth(DEPTH.ui - 2);
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff).fillRoundedRect(-55, -42, 110, 38, 8);
    g.fillTriangle(-6, -5, 6, -5, 0, 3);
    g.lineStyle(1.5, 0x333333, 0.35).strokeRoundedRect(-55, -42, 110, 38, 8);
    const style = {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#222222', resolution: 3,
    };
    // how they feel: a face at the bubble's left edge, kept up to date in update()
    c.mood = this.scene.add.text(-64, -34, '😊', { fontSize: '16px', resolution: 3 }).setOrigin(0.5);
    const parts = [g, c.mood];
    if (c.state === 'readyToOrder') {
      parts.push(this.scene.add.text(0, -25, '✋ Ready to order', style).setOrigin(0.5));
    } else if (!this.owned.has('memory')) {
      // the waiter has to remember who ordered what
      parts.push(this.scene.add.text(0, -25, '⏳ Waiting for food', style).setOrigin(0.5));
    } else if (c.remaining.length === 1) {
      // one dish left: its picture and name
      const item = MENU_BY_ID[c.remaining[0]];
      parts.push(makeFood(this.scene, item.id, -36, -25, 0.75));
      parts.push(this.scene.add.text(-20, -25, item.name, style).setOrigin(0, 0.5));
    } else {
      // several dishes left: their pictures side by side
      c.remaining.forEach((id, i) => {
        parts.push(makeFood(this.scene, id, (i - (c.remaining.length - 1) / 2) * 33, -26, 0.75));
      });
    }
    c.bar = this.scene.add.graphics();
    parts.push(c.bar);
    box.add(parts);
    c.bubble = box;
  }

  drawPatience(bar, left) {
    const color = left > 0.5 ? 0x2ecc71 : left > 0.25 ? 0xf1c40f : 0xe74c3c;
    bar.clear();
    bar.fillStyle(0xdddddd).fillRect(-48, -11, 96, 4);
    bar.fillStyle(color).fillRect(-48, -11, 96 * left, 4);
  }

  // Puts a dish on the table top in front of the customer, in a neat row with
  // any already there: along the table edge they sit at (or, on a thin 2-seat
  // table, in a line from their end towards the middle).
  putOnTable(c, itemId) {
    const seat = c.seat, s = seat.surface, k = c.onTable.length, gap = 13;
    const along = (k - (c.items.length - 1) / 2) * gap;
    let x, y;
    if (seat.facing === 'down') [x, y] = [s.cx + along, s.top];
    else if (seat.facing === 'up') [x, y] = [s.cx + along, s.bottom];
    else if (s.deep) [x, y] = [seat.facing === 'right' ? s.left : s.right, s.cy + along];
    else [x, y] = [seat.facing === 'right' ? s.left + k * gap : s.right - k * gap, s.cy];
    c.onTable.push(makeFood(this.scene, itemId, x, y, 0.5).setDepth(seat.tableBottom + 1 + k * 0.01));
  }

  // True if any seat at this table still has dirty plates on it.
  tableIsMessy(table) {
    return this.seats.some(s => s.table === table && s.dirty);
  }

  // Where the first thing in front of a seat goes on the table top.
  placeAtSeat(seat) {
    const s = seat.surface;
    if (seat.facing === 'down') return [s.cx, s.top];
    if (seat.facing === 'up') return [s.cx, s.bottom];
    return [seat.facing === 'right' ? s.left : s.right, s.cy];
  }

  // One menu card lies in the middle of every table, for whoever sits down next.
  createMenuCards(layout) {
    this.menuCards = layout.objects.filter(o => o.type === 'table' && o.menuSpot).map(o => {
      const card = makeMenuCard(this.scene, o.menuSpot.x, o.menuSpot.y, 16).setDepth((o.y + o.h) * this.T + 0.5);
      return { table: o.number, card };
    });
  }

  // The customer has finished: each dish becomes a dirty plate left at their place.
  leaveDirtyPlates(c) {
    c.seat.dirty = c.onTable.map(dish =>
      makeFood(this.scene, DIRTY, dish.x, dish.y, 0.45).setDepth(c.seat.tableBottom + 1));

    this.clearTable(c);
  }

  sfx(name) {
    this.scene.game.sfx.play(name);
  }

  clearTable(c) {
    for (const dish of c.onTable) dish.destroy();
    c.onTable = [];
  }

  // A customer left angry: drop whatever is still on its way to them.
  cancelOrder(c) {
    const ticket = this.tickets.findIndex(t => t.customer === c);
    if (ticket >= 0) this.tickets.splice(ticket, 1);
    c.remaining = [];
    this.emitStats();
    this.matchKitchenToOrders();
  }

  // Keeps the kitchen cooking exactly what customers are still waiting for:
  // nothing extra (after a customer leaves) and nothing missing (after the
  // waiter throws a dish away). Dishes already in the waiter's hands stay there.
  matchKitchenToOrders() {
    const count = (list, id) => list.filter(x => x === id).length;
    const wanted = this.customers
      .filter(c => c.orderTaken && !this.tickets.some(t => t.customer === c))
      .flatMap(c => c.remaining);
    for (const { id } of MENU) {
      const onWindow = this.plates.filter(p => p && p.item === id);
      const cooking = this.cooking === id && !this.cookingCancelled ? 1 : 0;
      let extra = count(this.kitchenQueue, id) + cooking + onWindow.length + count(this.player.held, id) - count(wanted, id);
      for (; extra < 0; extra++) this.kitchenQueue.push(id);            // cook a replacement
      while (extra > 0 && this.kitchenQueue.includes(id)) {              // not started yet: don't cook it
        this.kitchenQueue.splice(this.kitchenQueue.lastIndexOf(id), 1);
        extra--;
      }
      if (extra > 0 && cooking) { this.cookingCancelled = true; extra--; } // on the stove: stop
      while (extra > 0 && onWindow.length) {                               // made, but nobody is left to eat it
        this.removePlate(onWindow.pop());
        this.logDish(id, 'unclaimed');
        extra--;
      }
    }
  }

  async payBill(c) {
    const { x, y, gap } = SIM.queue;
    this.payQueue.push(c);
    let spot = -1;
    for (;;) {
      const i = this.payQueue.indexOf(c);
      if (i !== spot) {            // move up the line
        spot = i;
        await this.goTo(c.person, [x, y + i * gap]);
        c.person.setFacing('up');
        continue;
      }
      if (i === 0) break;
      await this.wait(300);
    }
    await c.person.say('💵', SIM.payTime * Perks.paySpeed(this.owned));
    const bill = this.billOf(c);
    // each dish's share of the bill, for the statistics
    const bonus = bill / Math.max(1, c.items.reduce((sum, item) => sum + item.price, 0));
    for (const item of c.items) {
      const row = this.dishSales[item.id] || (this.dishSales[item.id] = [0, 0]);
      row[0]++;
      row[1] += item.price * bonus;
    }
    this.money += bill;
    this.sales += bill;
    this.sfx('coin');
    this.emitStats();
    this.floatText(SIM.register[0] * this.T, SIM.register[1] * this.T, `+$${bill}`, '#ffd166');
    this.payQueue.shift();
  }

  async leave(c, toLeft) {
    await this.goTo(c.person, [toLeft ? 0.6 : this.W - 0.6, SIM.sidewalkY]);
    await c.person.walk([[toLeft ? -1 : this.W + 1, SIM.sidewalkY]], SIM.walkSpeed);
    c.person.destroy();
    Phaser.Utils.Array.Remove(this.customers, c);
  }

  floatText(x, y, text, color) {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 4, resolution: 2,
    }).setOrigin(0.5).setDepth(DEPTH.ui);
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  // ---------- Kitchen (chef bot) ----------

  async runKitchen() {
    const chef = this.staff.chef;
    for (;;) {
      if (!this.kitchenQueue.length || !this.plates.includes(null)) {
        await this.wait(300);
        continue;
      }
      const item = MENU_BY_ID[this.kitchenQueue.shift()];
      if (!(this.stock[item.id] > 0)) { this.outOf(item.id); continue; }
      this.stock[item.id]--;
      this.cooking = item.id;
      this.cookingCancelled = false;
      chef.working = true;
      chef.bubble.setText(`🍳 ${item.name}`).setVisible(true);
      this.sfx('sizzle');
      // cook, but stop early if nobody wants the dish any more
      const cookTime = item.cookTime * Perks.cookSpeed(this.owned);
      for (let t = 0; t < cookTime && !this.cookingCancelled; t += 200) await this.wait(200);
      chef.bubble.setVisible(false);
      chef.working = false;
      this.cooking = null;
      if (this.cookingCancelled) continue;
      const slot = this.plates.indexOf(null);
      if (slot < 0) this.kitchenQueue.unshift(item.id);
      else { this.addPlate(item.id, slot); this.logDish(item.id, 'made'); this.sfx('ready'); }
    }
  }

  // No ingredients left for a dish someone is waiting for (a thrown-away dish
  // had to be made again): the first customer waiting for it goes without.
  outOf(id) {
    this.floatText(SIM.pickup.plateX * this.T, SIM.pickup.slotsY[0] * this.T - 20, `Out of ${MENU_BY_ID[id].name}!`, '#ff9b8a');
    const c = this.customersWanting(id)[0];
    if (!c) return;
    c.remaining.splice(c.remaining.indexOf(id), 1);
    c.items.splice(c.items.findIndex(item => item.id === id), 1);
    c.servedLate = true; // no tip
    if (c.state !== 'waitingFood') return;
    if (c.remaining.length) {
      c.bubble.destroy();
      this.showBubble(c);
    } else if (c.items.length) {           // everything else has arrived: eat that
      this.served++;
      c.state = 'served';
      c.finishWaiting(true);
    } else {
      c.finishWaiting(false);              // nothing at all: they leave
    }
  }

  addPlate(itemId, slot) {
    const T = this.T;
    const x = SIM.pickup.plateX * T, y = SIM.pickup.slotsY[slot] * T;
    const depth = 6 * T + 4; // just in front of the window shelf
    const g = makeFood(this.scene, itemId, x, y, 0.8).setDepth(depth);
    // the label says which table the dish is for
    const sameDish = this.plates.filter(p => p && p.item === itemId).length + this.player.held.filter(id => id === itemId).length;
    const wanting = this.customersWanting(itemId), who = wanting[sameDish] || wanting[0];
    const text = MENU_BY_ID[itemId].name + (who ? ` · T${who.seat.label}` : '');
    const label = this.scene.add.text((SIM.pickup.plateX - 0.5) * T - 4, y, text, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 }, resolution: 3,
    }).setOrigin(1, 0.5).setDepth(depth + 1);
    this.plates[slot] = { item: itemId, slot, g, label };
  }

  removePlate(plate) {
    plate.g.destroy();
    plate.label.destroy();
    this.plates[plate.slot] = null;
  }

  // ---------- The waiter's smart button ----------

  findAction() {
    const p = this.player.root, hands = this.player.held, T = this.T;
    const food = hands.filter(id => id !== DIRTY); // dishes (not dirty plates) in the waiter's hands
    const reach = SIM.reach * Perks.reach(this.owned) * T;
    const near = (x, y) => Phaser.Math.Distance.Between(p.x, p.y, x, y) <= reach;
    const { standX, plateX, slotsY } = SIM.pickup;

    // Taken orders go to the kitchen first, whenever the waiter is at the window.
    const midY = slotsY[1] * T;
    // Each action: kind (for the button's picture), label, optional food item,
    // what it does, and where to draw the glow (hx, hy).
    if (this.tickets.length && near(standX * T, midY)) {
      const n = this.tickets.length;
      return { kind: 'send', label: `Send ${n} order${n > 1 ? 's' : ''}`, run: () => this.sendOrders(), hx: plateX * T, hy: midY };
    }

    let best = null;
    const consider = (x, y, action) => {
      const dist = Phaser.Math.Distance.Between(p.x, p.y, x, y);
      if (dist <= reach && (!best || dist < best.dist)) best = { hx: x, hy: y, ...action, dist };
    };

    slotsY.forEach((sy, i) => {
      const plate = this.plates[i];
      const x = standX * T, y = sy * T;
      if (plate && hands.length < this.hands) {
        consider(x, y, { kind: 'pickup', label: 'Pick up', item: plate.item, run: () => this.pickUp(plate), hx: plateX * T, hy: y });
      }
      if (!plate && food.length) {
        consider(x, y, { kind: 'putdown', label: 'Put down', run: () => this.putDown(i), hx: plateX * T, hy: y });
      }
    });

    for (const c of this.customers) {
      const { x, y } = c.person.root;
      if (c.state === 'readyToOrder') {
        // without a notepad the waiter holds one order at a time
        const full = this.tickets.length >= Perks.notepad(this.owned);
        consider(x, y, full
          ? { kind: 'take', label: 'Send first!', run: () => this.floatText(x, y - 70, 'Send your order to the kitchen first', '#ffd166') }
          : { kind: 'take', label: 'Take order', run: () => this.takeOrder(c) });
      }
      if (c.state === 'waitingFood') {
        // every dish in the waiter's hands that this customer is still waiting for
        const need = [...c.remaining], give = [];
        for (const id of hands) {
          const i = need.indexOf(id);
          if (i >= 0) { need.splice(i, 1); give.push(id); }
        }
        if (give.length) {
          consider(x, y, { kind: 'serve', label: give.length > 2 ? 'Serve all' : give.length > 1 ? 'Serve both' : 'Serve', item: give[0], run: () => this.serve(c, give) });
        }
      }
    }

    // Dirty plates left by customers: clear them (one seat's plates per free hand)...
    if (hands.length < this.hands) {
      for (const seat of this.seats) {
        if (seat.dirty) consider(seat.x, seat.y, { kind: 'clear', label: 'Clear table', run: () => this.clearSeat(seat) });
      }
    }
    // ...and drop them in the dish bin.
    if (hands.includes(DIRTY) && this.dishBin) {
      const { x, y } = this.dishBin, full = this.binCount >= this.binSize;
      consider(x, y, { kind: 'dishes', label: full ? 'Bin is full' : 'Drop dishes', run: () => this.dropDishes() });
    }

    // Food nobody wants any more (the customer left) goes in the trash can.
    if (food.length && this.trashCan) {
      const { x, y } = this.trashCan;
      consider(x, y, { kind: 'trash', label: 'Throw away', run: () => this.throwAway() });
    }
    return best;
  }

  doAction() {
    if (this.action) this.action.run();
  }

  takeOrder(c) {
    this.tickets.push({ items: [...c.remaining], customer: c });
    this.sfx('note');
    this.emitStats();
    c.orderTaken = true;
    c.state = 'ordered';
    c.finishWaiting(true);
    // without a good memory there are no order pictures later: say it once now
    if (!this.owned.has('memory')) {
      const { x, y } = c.person.root;
      this.floatText(x, y - 70, c.remaining.map(id => MENU_BY_ID[id].name).join(' + '), '#ffffff');
    }
    if (this.owned.has('walkie')) this.sendOrders(); // radioed straight to the kitchen
  }

  sendOrders() {
    for (const t of this.tickets) this.kitchenQueue.push(...t.items);
    const count = this.tickets.length;
    this.tickets = [];
    this.sfx('bell');
    this.emitStats();
    this.matchKitchenToOrders(); // e.g. don't cook a dish the waiter is already holding
    this.floatText(SIM.pickup.plateX * this.T, SIM.pickup.slotsY[0] * this.T - 20,
      `${count} order${count > 1 ? 's' : ''} sent!`, '#ffffff');
  }

  pickUp(plate) {
    this.removePlate(plate);
    this.player.hold([...this.player.held, plate.item]);
    this.sfx('pickup');
  }

  // Takes the dish picked up last (never the dirty plates) out of the hands.
  takeLastDish() {
    const hands = [...this.player.held];
    const i = hands.map(id => id !== DIRTY).lastIndexOf(true);
    const [id] = hands.splice(i, 1);
    this.player.hold(hands);
    return id;
  }

  // Puts the dish picked up last back on the window.
  putDown(slot) {
    this.addPlate(this.takeLastDish(), slot);
    this.sfx('putdown');
  }

  // Picks up the dirty plates at a seat; they take one hand.
  clearSeat(seat) {
    for (const plate of seat.dirty) plate.destroy();
    seat.dirty = null;
    this.player.hold([...this.player.held, DIRTY]);
    this.sfx('clink');
    seat.cleaned = true; // the next customer to sit here tips for the clean table
  }

  // Drops every stack of dirty plates the waiter is carrying into the dish bin.
  // (as many as the bin still has room for).
  dropDishes() {
    const hands = [...this.player.held];
    let dropped = 0;
    while (hands.includes(DIRTY) && this.binCount + dropped < this.binSize) {
      hands.splice(hands.indexOf(DIRTY), 1);
      dropped++;
    }
    if (!dropped) {
      this.floatText(this.dishBin.x, this.dishBin.y - 40, 'Bin is full - the cleaner is coming', '#ffd166');
      return;
    }
    this.player.hold(hands);
    this.setBin(this.binCount + dropped);
    this.sfx('clatter');
  }

  // How many stacks of dirty plates are in the dish bin; its picture shows
  // whether it is empty, has plates in it, or is piled full.
  setBin(count) {
    this.binCount = count;
    const img = this.scene.view.objectImages.dishBin;
    if (img && this.scene.textures.exists('dishBin_empty')) img.setTexture(!count ? 'dishBin_empty' : count >= this.binSize && this.scene.textures.exists('dishBin_full') ? 'dishBin_full' : 'dishBin');
  }

  // The cleaner: when plates pile up in the dish bin, walks over from the sink
  // (through the staff door), takes them all, carries them back and washes them.
  async runCleaner() {
    const cleaner = this.staff.cleaner, C = SIM.cleaner;
    const go = (to) => {
      const T = this.T, pts = this.staffPaths.find([cleaner.root.x, cleaner.root.y], [to[0] * T, to[1] * T]);
      return cleaner.walk(pts.map(([x, y]) => [x / T, y / T]), C.speed);
    };
    for (;;) {
      // wait for plates: goes at once for two stacks, or after a while for one
      for (let waited = 0; !(this.binCount >= 2 || (this.binCount && waited > 12000)); waited += 500) await this.wait(500);
      cleaner.working = false;
      await go(C.bin);
      cleaner.setFacing('right');
      await this.wait(600);
      const stacks = this.binCount;
      if (stacks) {
        this.setBin(0);
        this.sfx('clink');
        cleaner.hold([DIRTY]);
      }
      await go(C.sink);
      cleaner.setFacing('left');
      cleaner.hold([]);
      cleaner.working = true; // washing up
      await this.wait(C.washTime * Perks.washSpeed(this.owned) * Math.max(1, stacks));
    }
  }

  // Throws away the dish picked up last.
  throwAway() {
    const id = this.takeLastDish(), name = MENU_BY_ID[id].name;
    // Thrown away although a customer still wanted it: the waiter's waste.
    // Otherwise its customer had already left.
    this.logDish(id, this.customersWanting(id).length ? 'wasted' : 'unclaimed');
    this.sfx('trash');
    this.floatText(this.trashCan.x, this.trashCan.y - 40, `🗑 ${name} thrown away`, '#ffffff');
    this.matchKitchenToOrders(); // if a customer still wants that dish, the chef makes it again
  }

  // Gives the customer the dishes in `give`. They start eating once everything
  // they ordered has arrived; until then their patience starts over.
  serve(c, give) {
    const hands = [...this.player.held];
    if (this.patienceLeft(c) < SIM.tipBar) c.servedLate = true; // a dish came too slowly: no tip
    for (const id of give) {
      hands.splice(hands.indexOf(id), 1);
      c.remaining.splice(c.remaining.indexOf(id), 1);
      this.putOnTable(c, id);
      this.logDish(id, 'served');
    }
    this.player.hold(hands);
    this.sfx('serve');
    if (c.remaining.length) {
      c.waitStart = this.now;
      c.bubble.destroy();
      this.showBubble(c);
      return;
    }
    this.served++;
    this.emitStats();
    // the tip: only if every dish arrived quickly
    if (!c.servedLate && !c.messy) {
      const bill = this.billOf(c);
      this.giveTip(Math.max(1, Math.round(bill * SIM.tipShare * Perks.tips(this.owned))));
    }
    c.state = 'served';
    c.finishWaiting(true);
  }

  // ---------- Every frame ----------

  // Moves the clock on, lets today's customers in when their time comes, and
  // closes the day once the last customer has gone.
  runClock(delta) {
    if (this.phase === 'closed' || this.phase === 'morning') return;
    this.clock = Math.min(23.99, this.clock + delta / 1000 / SIM.day.secondsPerHour);
    if (this.phase === 'open') {
      while (this.arrivals.length && this.clock >= this.arrivals[0]) {
        const free = this.seats.filter(s => !s.taken && !s.dirty); // not at a seat with dirty plates
        if (!free.length || this.customers.length >= SIM.maxCustomers) break; // waits outside for a seat
        this.arrivals.shift();
        // they pick a table with no dirty plates on it if there is one
        const tidy = free.filter(s => !this.tableIsMessy(s.table));
        this.runCustomer(this.pickSeat(tidy.length ? tidy : free));
      }
      if (this.clock >= SIM.day.close) {
        this.phase = 'closing';
        this.arrivals = []; // anyone who didn't get a seat goes home
      }
    }
    if (this.phase === 'closing' && !this.customers.length) this.endDay();
  }

  // A customer picks a seat: better tables and chairs, and tables with a lamp
  // or flowers on them, are chosen more often.
  pickSeat(seats) {
    const weight = s => s.level * s.level + (s.chair - 1) + s.tops;
    let r = Math.random() * seats.reduce((n, s) => n + weight(s), 0);
    for (const s of seats) if ((r -= weight(s)) <= 0) return s;
    return seats[seats.length - 1];
  }

  update(time, delta) {
    this.now += Math.min(delta, 100); // (only runs while the game isn't paused)
    this.runClock(delta);
    for (const c of this.customers) {
      if (c.state !== 'readyToOrder' && c.state !== 'waitingFood') continue;
      const left = this.patienceLeft(c);
      if (left < ECONOMY.happyAbove) c.happy = false;
      if (c.mood) c.mood.setText(c.happy && !c.messy ? '😊' : left > 0.25 ? '😐' : '😠');
      const p = c.person; // just above the head, whatever the person's height
      c.bubble.setPosition(p.root.x, p.root.y + p.body.y + p.topY + 2);
      this.drawPatience(c.bar, left);
      if (left === 0) {
        c.state = 'angry';
        c.finishWaiting(false);
      }
    }

    // the menu is off the table while someone sitting there is reading it
    for (const { table, card } of this.menuCards) {
      card.setVisible(!this.customers.some(c => c.state === 'reading' && c.seat && c.seat.table === table));
    }
    const w = this.player;
    this.tipTag.setPosition(w.root.x, w.root.y + w.body.y + w.topY - 26);

    this.action = this.findAction();
    const g = this.highlight;
    g.clear();
    if (this.action) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
      g.lineStyle(3, 0xffd166, 0.5 + 0.5 * pulse);
      g.strokeEllipse(this.action.hx, this.action.hy, 46 + pulse * 6, 18 + pulse * 3);
    }
  }
}
