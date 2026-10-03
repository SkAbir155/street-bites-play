// Saved games, kept on this device (in the browser's or the app's own storage).
// There are three slots. A save holds which day you are on, the waiter's
// wallet, the restaurant's money, and everything bought in the shop. It is
// written at the end of every day and after every purchase.

const SAVE_KEY = 'streetBites.saves.v2';
const OLD_SAVE_KEY = 'streetBites.save.v1'; // the single save from before there were slots
const SAVE_SLOTS = 3;

const SaveGame = {
  slot: 1, // the slot being played

  // A brand-new game.
  fresh(name = 'My Restaurant') {
    return { v: 5, name, day: 1, wallet: 0, money: ECONOMY.startingMoney, owned: [], outfit: 'waiter', stock: {},
      placed: Furniture.starting(), store: [], history: [] };
  },

  // What kind of device this is, so a save can say where it was made.
  device() {
    const ua = navigator.userAgent;
    if (window.Capacitor) return 'Android app';
    if (/Electron/.test(ua)) return 'Windows app';
    if (/iPad|Macintosh/.test(ua) && 'ontouchend' in document) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android browser';
    return 'computer browser';
  },

  // Everything stored: { last: slot played most recently, slots: { 1: save, ... } }.
  all() {
    let all = null;
    try { all = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* unreadable: start empty */ }
    if (!all || !all.slots) all = { last: null, slots: {} };
    try {
      // an old single save moves into slot 1 (it had every table from the start)
      const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
      if (old && old.day >= 1 && !all.slots[1]) {
        all.slots[1] = { ...this.fresh(), ...old, v: 1, owned: [] };
        all.last = all.last || 1;
        localStorage.removeItem(OLD_SAVE_KEY);
        this.write(all);
      }
    } catch (e) { /* no old save */ }
    return all;
  },

  write(all) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); } catch (e) { /* storage full or off: play on unsaved */ }
  },

  // The save in a slot, or null if the slot is empty (or deleted).
  get(slot) {
    const data = this.all().slots[slot];
    if (!data || data.deleted || !(data.day >= 1)) return null;
    if (data.v === 5) return { ...this.fresh(), ...data };
    // Older saves keep what they had: version 3 had Burger on the menu from
    // the start; before the waiter's skills were sold (version 2) the waiter
    // already had two hands, a notepad and order pictures; before the
    // restaurant started bare (older still) it had everything. Up to version 4
    // furniture wasn't placed: what it had bought is put in its old places.
    const keep = data.v === 4 ? [] : data.v === 3 ? OLD_STARTING_DISHES
      : data.v === 2 ? [...OLD_STARTING_DISHES, ...OLD_WAITER_SKILLS]
        : [...OLD_STARTING_DISHES, ...OLD_WAITER_SKILLS, ...ALL_RESTAURANT_ITEMS];
    const owned = new Set([...(data.owned || []), ...keep]);
    const placed = Furniture.fromOldSave(owned);
    for (const id of OLD_FURNITURE_ITEMS) owned.delete(id);
    return { ...this.fresh(), ...data, v: 5, stock: data.stock || {}, owned: [...owned], placed, store: [] };
  },

  // The slot played most recently, or null if nothing has been saved yet.
  last() {
    const all = this.all();
    return this.get(all.last) ? all.last : null;
  },

  // A name for display: the slot's own name, or "Slot 2".
  nameOf(slot) {
    const save = this.get(slot);
    return (save && save.name) || `Slot ${slot}`;
  },

  // The save being played right now.
  current() {
    return this.get(this.slot) || this.fresh();
  },

  // Choose the slot to play; `isNew` wipes it and starts from day 1 (with `name`).
  // Only a new game is saved here: opening a game must not make it look newer
  // than it is (that would make cloud sync prefer it over real progress elsewhere).
  begin(slot, isNew, name) {
    this.slot = slot;
    if (isNew || !this.get(slot)) return this.store(this.fresh(name));
    const all = this.all();
    all.last = slot;
    this.write(all);
  },

  store(data) {
    const all = this.all();
    all.slots[this.slot] = { ...data, savedAt: Date.now(), device: this.device() };
    all.last = this.slot;
    this.write(all);
  },

  rename(slot, name) {
    const save = this.get(slot);
    if (!save) return;
    const all = this.all();
    all.slots[slot] = { ...all.slots[slot], name, savedAt: Date.now(), device: this.device() };
    this.write(all);
  },

  // Deletes a slot. (It stays marked as deleted, so syncing deletes it on other devices too.)
  remove(slot) {
    const all = this.all();
    all.slots[slot] = { deleted: true, savedAt: Date.now(), device: this.device() };
    if (all.last === slot) all.last = null;
    this.write(all);
  },
};
