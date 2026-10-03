// Furniture and decorations that are bought, kept in the storeroom, and
// placed in the restaurant's slots (the slots are in the layout file).
//
// A save keeps two things:
//   placed  { slot id: { id, level } }   what stands where
//   store   [ { id, level } ]            bought, but not placed
// Tables have their own places for chairs and for things on the table top:
// slot ids like 'T1.c0' (the first chair of table slot T1) and 'T1.top1'.
//
// Every slot has a kind, and each item says which kinds of slot it fits.

const FURNITURE = [
  // ---------- tables and chairs ----------
  { id: 'tableBig', name: 'Big table', fits: ['tableBig'], levels: [150, 260, 420], icon: 'table_4seat',
    text: 'Room for four chairs. Customers pay more at a better table, and choose it first.' },
  { id: 'tableSmall', name: 'Small table', fits: ['tableSmall'], levels: [100, 170, 280], icon: 'table_2seat',
    text: 'Room for two chairs. Customers pay more at a better table, and choose it first.' },
  { id: 'chair', name: 'Chair', fits: ['chair'], levels: [15, 35, 60], icon: 'stool',
    text: 'A customer can only sit where there is a chair. Better chairs: they wait longer.' },

  // ---------- on the tables ----------
  { id: 'candle', name: 'Candle', fits: ['tableTop'], price: 3, icon: 'lamp_candle', light: 58, points: 0,
    text: 'A little light for the table at night.' },
  { id: 'lamp_lantern', name: 'Lantern', fits: ['tableTop'], price: 25, icon: 'lamp_lantern', light: 80, points: 1,
    text: 'Brighter than a candle.' },
  ...['classic', 'tiffany', 'dome', 'bistro', 'oil', 'bottle', 'modern'].map(design => ({
    id: `lamp_${design}`, name: `${design[0].toUpperCase()}${design.slice(1)} table lamp`, fits: ['tableTop'], price: 40,
    icon: `lamp_${design}`, light: 92, points: 2, text: 'A proper lamp: customers love a well-lit table.',
  })),
  { id: 'vase', name: 'Flower vase', fits: ['tableTop'], price: 20, icon: 'vase', emoji: '🌷', points: 1,
    text: 'Fresh flowers for a table.' },

  // ---------- decorations (inside or outside) ----------
  { id: 'plant', name: 'Potted plant', fits: ['floor', 'wide'], price: 20, icon: 'plant', points: 1,
    obj: { type: 'plant', w: 1, h: 1 }, text: 'Green and fresh.' },
  { id: 'flowerStand', name: 'Flower stand', fits: ['floor', 'wide'], price: 25, icon: 'flowerStand', emoji: '💐', points: 1,
    obj: { type: 'flowerStand', w: 0.8, h: 0.8 }, text: 'A pot of colourful flowers on a stand.' },
  { id: 'floorLamp', name: 'Floor lamp', fits: ['floor', 'wide'], price: 35, icon: 'floorLamp', points: 1, lamp: true,
    obj: { type: 'floorLamp', w: 0.8, h: 0.8 }, text: 'A standing lamp: lights its corner at night.' },
  { id: 'bench', name: 'Bench', fits: ['wide'], price: 45, icon: 'bench', points: 1,
    obj: { type: 'bench', w: 2, h: 1 }, text: 'Somewhere to wait. Needs a wide place.' },
  { id: 'flowerBox', name: 'Flower box', fits: ['wide'], price: 30, icon: 'planter', points: 1,
    obj: { type: 'planter', w: 3.6, h: 0.7 }, text: 'A long box of flowers. Needs a wide place, like under a window.' },
  { id: 'wallLamp', name: 'Wall lamp', fits: ['sideWall'], price: 35, icon: 'wallLamp', points: 1, lamp: true,
    text: 'Lights the room at night. Goes on the right wall.' },
  { id: 'clock', name: 'Wall clock', fits: ['backWall'], price: 35, emoji: '🕒', points: 1,
    text: 'Shows the time. Goes on the back wall.' },
  { id: 'picture', name: 'Picture frame', fits: ['backWall'], price: 30, icon: 'picture', emoji: '🖼️', points: 1,
    text: 'A painting for the back wall.' },
  { id: 'pendantLamp', name: 'Hanging lamp', fits: ['hanging'], price: 30, icon: 'pendantLamp', points: 1, lamp: true,
    text: 'Hangs over the counter or the pickup window.' },
  { id: 'stringLights', name: 'String lights', fits: ['garland'], price: 80, emoji: '💡', points: 3, lamp: true,
    text: 'Colourful bulbs across the dining room.' },
];
const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map(item => [item.id, item]));
// which shop tab each kind of thing is sold in
const DINING_KINDS = ['tableBig', 'tableSmall', 'chair', 'tableTop'];

const SELL_BACK = 0.5; // selling something gives back this share of its price

const Furniture = {
  // ---------- items ----------

  price(entry) {
    const item = FURNITURE_BY_ID[entry.id];
    return item.levels ? item.levels[(entry.level || 1) - 1] : item.price;
  },
  sellPrice: entry => Math.floor(Furniture.price(entry) * SELL_BACK),
  label(entry) {
    const item = FURNITURE_BY_ID[entry.id];
    return item.levels ? `${item.name}, level ${entry.level || 1}` : item.name;
  },
  // its picture name (furniture comes in three levels: <name>_1, <name>_2, <name>)
  picture(entry) {
    const item = FURNITURE_BY_ID[entry.id];
    if (!item.icon) return null;
    const level = entry.level || 3;
    return item.levels && level < 3 ? `${item.icon}_${level}` : item.icon;
  },
  same: (a, b) => a.id === b.id && (a.level || 0) === (b.level || 0),

  // ---------- slots ----------

  // Every slot, including the chair and table-top places of every table slot.
  slots(layout) {
    const T = layout.tileSize, list = [];
    for (const s of layout.slots) {
      list.push(s);
      if (!s.kind.startsWith('table')) continue;
      const seats = s.kind === 'tableBig' ? 4 : 2;
      tableSeats({ ...s, seats }, T).forEach(([x, y], i) => list.push({
        id: `${s.id}.c${i}`, kind: 'chair', table: s.id, name: `${s.name}: chair ${i + 1}`, px: x, py: y,
      }));
      const cx = (s.x + s.w / 2) * T, top = s.kind === 'tableBig' ? (s.y + 0.85) * T : (s.y + 0.15) * T;
      [-27, 25].forEach((dx, i) => list.push({
        id: `${s.id}.top${i}`, kind: 'tableTop', table: s.id, name: `${s.name}: on the table (${i ? 'right' : 'left'})`,
        px: cx + dx, py: top,
      }));
    }
    return list;
  },

  fits: (entry, slot) => FURNITURE_BY_ID[entry.id].fits.includes(slot.kind),

  // ---------- what the placements add up to ----------

  // how nice the place looks: decorations and things on the tables
  atmosphere(placed) {
    return Object.values(placed).reduce((n, e) => n + (FURNITURE_BY_ID[e.id].points || 0), 0);
  },
  tables: placed => Object.entries(placed).filter(([slot]) => /^T\d$/.test(slot)),
  // lamps that use electricity
  lamps: placed => Object.values(placed).filter(e => FURNITURE_BY_ID[e.id].lamp
    || (FURNITURE_BY_ID[e.id].light && e.id !== 'candle')).length,

  // ---------- turning placements into the restaurant's objects ----------

  // Adds the placed things to a copy of the layout: tables (with their chairs and
  // table tops), decorations, wall clocks, hanging lamps.
  build(layout, placed) {
    const objects = [], lights = [], wallClocks = [];
    for (const s of layout.slots) {
      const entry = placed[s.id];
      if (!entry) continue;
      const item = FURNITURE_BY_ID[entry.id];
      if (s.kind === 'tableBig' || s.kind === 'tableSmall') {
        const seats = s.kind === 'tableBig' ? 4 : 2;
        objects.push({
          type: 'table', name: `${item.name} (${s.name})`, number: Number(s.id.slice(1)), seats,
          x: s.x, y: s.y, w: s.w, h: s.h, level: entry.level || 1,
          chairs: Array.from({ length: seats }, (_, i) => (placed[`${s.id}.c${i}`] || {}).level || null),
          top: [0, 1].map(i => (placed[`${s.id}.top${i}`] || {}).id || null),
        });
      } else if (item.obj) {
        const w = Math.min(item.obj.w, s.w), h = Math.min(item.obj.h, Math.max(s.h, item.obj.h));
        objects.push({ type: item.obj.type, name: item.name, x: s.x + (s.w - w) / 2, y: s.y + s.h - h, w, h });
      } else if (s.kind === 'sideWall') {
        objects.push({ type: 'wallLamp', name: item.name, x: s.x, y: s.y, w: s.w, h: s.h });
      } else if (s.kind === 'backWall') {
        if (entry.id === 'clock') wallClocks.push({ x: s.x, y: s.y });
        else objects.push({ type: 'picture', name: item.name, x: s.x - 0.45, y: s.y - 0.4, w: 0.9, h: 0.75 });
      } else if (s.kind === 'hanging') {
        lights.push({ ...s.light });
      } else if (s.kind === 'garland') {
        objects.push({ type: 'stringLights', name: item.name, points: s.points });
      }
    }
    return { objects, lights, wallClocks };
  },

  // ---------- a new restaurant, and older saves ----------

  // One big and one small table, in random slots, with plain chairs and a candle each.
  starting() {
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const placed = {};
    const table = (slot, id, seats) => {
      placed[slot] = { id, level: 1 };
      for (let i = 0; i < seats; i++) placed[`${slot}.c${i}`] = { id: 'chair', level: 1 };
      placed[`${slot}.top0`] = { id: 'candle' };
    };
    table(pick(['T1', 'T2', 'T3']), 'tableBig', 4);
    table(pick(['T4', 'T5']), 'tableSmall', 2);
    return placed;
  },

  // A save from before furniture was placed: what it had bought, put in its old places.
  // (Its one table upgrade goes to a single table, not to all of them.)
  fromOldSave(owned) {
    const level = chain => (owned.has(`${chain}3`) ? 3 : owned.has(`${chain}2`) ? 2 : 1);
    const designs = { T1: 'classic', T2: 'tiffany', T3: 'dome', T4: 'lantern', T5: 'bistro' };
    const lampLevel = level('lamps'), chairs = level('chairs'), placed = {};
    const tables = ['T1', 'T4', ...['table2', 'table3', 'table5'].filter(id => owned.has(id)).map(id => `T${id.slice(-1)}`)].sort();
    tables.forEach((slot, n) => {
      const big = ['T1', 'T2', 'T3'].includes(slot), seats = big ? 4 : 2;
      placed[slot] = { id: big ? 'tableBig' : 'tableSmall', level: n === 0 ? level('tables') : 1 };
      for (let i = 0; i < seats; i++) placed[`${slot}.c${i}`] = { id: 'chair', level: chairs };
      placed[`${slot}.top0`] = { id: lampLevel === 1 ? 'candle' : lampLevel === 2 ? 'lamp_lantern' : `lamp_${designs[slot]}` };
    });
    const put = (id, slots) => { if (owned.has(id)) for (const [slot, item] of slots) placed[slot] = { id: item }; };
    put('plants', [['F2', 'plant'], ['F4', 'plant'], ['F5', 'plant']]);
    put('bench', [['W1', 'bench']]);
    put('floorLamps', [['F1', 'floorLamp'], ['F3', 'floorLamp']]);
    put('wallLamps', [['R1', 'wallLamp'], ['R2', 'wallLamp']]);
    put('clock', [['B1', 'clock']]);
    put('pendants', [['H1', 'pendantLamp'], ['H2', 'pendantLamp'], ['H3', 'pendantLamp']]);
    put('stringLights', [['G1', 'stringLights']]);
    put('flowers', [['O1', 'flowerBox'], ['O2', 'flowerBox'], ['O3', 'flowerBox']]);
    return placed;
  },
};

// Shop items that became furniture (older saves still list them as bought).
const OLD_FURNITURE_ITEMS = ['table2', 'table3', 'table5', 'chairs2', 'chairs3', 'tables2', 'tables3', 'lamps2', 'lamps3',
  'plants', 'bench', 'floorLamps', 'wallLamps', 'clock', 'pendants', 'stringLights', 'flowers'];
