// ARRANGE: placing, moving and selling furniture (at night or in the morning).
//
// The whole restaurant is shown with every slot marked: green "+" for an empty
// place, the thing's picture where something stands. Tapping a slot opens a
// panel (screens.js, #arrange) to put something there from the storeroom, put
// the thing back in the storeroom, or sell it for half its price.
// Changes are kept aside until DONE; then the restaurant is rebuilt to show them.

const Arrange = {
  start(sim) {
    this.sim = sim;
    this.world = sim.scene;
    this.ui = this.world.scene.get('UI');
    this.placed = JSON.parse(JSON.stringify(sim.placed));
    this.store = JSON.parse(JSON.stringify(sim.store));
    this.money = 0;        // from things sold here
    this.changed = false;
    this.wasCloseUp = this.world.closeUp;
    // the whole restaurant at once, a little smaller, so nothing hides under the bar at the top
    const cam = this.world.cameras.main, W = LAYOUT.width * LAYOUT.tileSize, H = LAYOUT.height * LAYOUT.tileSize;
    cam.removeBounds();
    cam.setZoom(Math.min(cam.width / W, cam.height / (H * 1.12)));
    cam.centerOn(W / 2, H / 2 - H * 0.05);
    this.world.closeUp = false;
    this.ui.cameras.main.setVisible(false);       // no joystick or buttons in the way
    this.layer = this.world.add.container(0, 0).setDepth(DEPTH.ui + 50);
    this.slot = null;
    this.draw();
    Screens.root.querySelector('#arrange .picker').classList.remove('open');
    Screens.show('arrange');
  },

  // Where a slot's marker goes on the map, in px: { x, y, w, h }.
  markerBox(slot) {
    const T = LAYOUT.tileSize;
    if (slot.px !== undefined) return { x: slot.px - 9, y: slot.py - 9, w: 18, h: 18 };        // a chair or table-top place
    if (slot.kind === 'backWall') return { x: slot.x * T - 16, y: slot.y * T - 16, w: 32, h: 32 };
    if (slot.kind === 'hanging') {
      const p = slot.light.pendant;
      return { x: (p.x || slot.light.x) * T - 14, y: p.bottom * T - 26, w: 28, h: 26 };
    }
    if (slot.kind === 'garland') return { x: 14.5 * T, y: 2.4 * T, w: 5.6 * T, h: 0.8 * T };
    return { x: slot.x * T, y: slot.y * T, w: slot.w * T, h: slot.h * T };
  },

  // Slots that can be used now: a table's chair and table-top places only while a table stands there.
  usableSlots() {
    return Furniture.slots(LAYOUT).filter(s => !s.table || this.placed[s.table]);
  },

  draw() {
    this.layer.removeAll(true);
    // once something has changed, the old picture of the room is dimmed: the markers show how it will be
    if (this.changed) this.layer.add(this.world.add.rectangle(0, 0, LAYOUT.width * LAYOUT.tileSize, LAYOUT.height * LAYOUT.tileSize, 0x000000, 0.45).setOrigin(0));
    for (const slot of this.usableSlots()) {
      const entry = this.placed[slot.id], box = this.markerBox(slot);
      const small = slot.px !== undefined;
      const g = this.world.add.graphics();
      const color = entry ? 0xffd166 : 0x7bc74d, chosen = this.slot && this.slot.id === slot.id;
      g.fillStyle(chosen ? 0xffffff : color, entry ? 0.18 : 0.32).fillRoundedRect(box.x, box.y, box.w, box.h, small ? 9 : 6);
      g.lineStyle(chosen ? 3 : 2, chosen ? 0xffffff : color, 0.95).strokeRoundedRect(box.x, box.y, box.w, box.h, small ? 9 : 6);
      this.layer.add(g);
      if (!entry) {
        this.layer.add(this.world.add.text(box.x + box.w / 2, box.y + box.h / 2, '+', {
          fontFamily: 'Arial, sans-serif', fontSize: small ? '14px' : '20px', fontStyle: 'bold', color: '#ffffff',
          stroke: '#1c4d12', strokeThickness: 3, resolution: 3,
        }).setOrigin(0.5));
      } else if (this.changed || small) {
        // what stands here (as it will be after DONE)
        this.layer.add(this.thumb(entry, box));
      }
      const zone = this.world.add.zone(box.x, box.y, Math.max(box.w, 20), Math.max(box.h, 20)).setOrigin(0).setInteractive();
      zone.on('pointerup', () => this.choose(slot));
      this.layer.add(zone);
    }
    this.bar();
  },

  // A small picture (or emoji) of a thing, fitted into a marker.
  thumb(entry, box) {
    const key = Furniture.picture(entry), item = FURNITURE_BY_ID[entry.id];
    if (key && this.world.textures.exists(key)) {
      const img = this.world.add.image(box.x + box.w / 2, box.y + box.h / 2, key);
      return img.setScale(Math.min((box.w - 4) / img.width, (box.h - 4) / img.height));
    }
    return this.world.add.text(box.x + box.w / 2, box.y + box.h / 2, item.emoji || '📦', { fontSize: `${Math.min(box.w, box.h) * 0.7}px` })
      .setOrigin(0.5);
  },

  // ---------- the panel for one slot ----------

  choose(slot) {
    Screens.click();
    this.slot = slot;
    this.draw();
    this.drawPicker();
  },

  closePicker() {
    this.slot = null;
    Screens.root.querySelector('#arrange .picker').classList.remove('open');
    this.draw();
  },

  drawPicker() {
    const slot = this.slot, entry = this.placed[slot.id];
    const panel = Screens.root.querySelector('#arrange .picker');
    panel.querySelector('h2').textContent = slot.name;
    const box = panel.querySelector('.paper');
    box.innerHTML = '';
    if (entry) {
      box.append(Screens.el('<h3>HERE NOW</h3>'));
      const row = Screens.itemRow(Furniture.picture(entry) || FURNITURE_BY_ID[entry.id].icon, Furniture.label(entry), '', FURNITURE_BY_ID[entry.id].emoji);
      const actions = Screens.el(`<div class="levels"><button class="btn plain">PUT AWAY</button>
        <button class="btn plain">SELL $${Furniture.sellPrice(entry)}</button></div>`);
      const [away, sell] = actions.querySelectorAll('button');
      away.addEventListener('click', () => { Screens.click(); this.takeAway(slot, false); });
      sell.addEventListener('click', () => { Screens.click('coin'); this.takeAway(slot, true); });
      row.append(actions);
      box.append(row);
    }
    // the storeroom's things that fit here (the same things shown once, with how many)
    const fitting = [];
    this.store.forEach(e => {
      if (!Furniture.fits(e, slot)) return;
      const same = fitting.find(f => Furniture.same(f.entry, e));
      if (same) same.count++; else fitting.push({ entry: e, count: 1 });
    });
    box.append(Screens.el(`<h3>${entry ? 'SWAP FOR' : 'PUT HERE'}</h3>`));
    if (!fitting.length) {
      box.append(Screens.el(`<p class="note">Nothing in the storeroom fits here. Buy it in the SHOP${slot.kind === 'chair' ? ' (DINING: chairs)' : ''}.</p>`));
    }
    for (const { entry: e, count } of fitting) {
      const item = FURNITURE_BY_ID[e.id];
      const row = Screens.itemRow(Furniture.picture(e) || item.icon, `${Furniture.label(e)}${count > 1 ? ` (×${count})` : ''}`, item.text, item.emoji);
      const b = Screens.el('<button class="btn">PLACE</button>');
      b.addEventListener('click', () => { Screens.click('putdown'); this.put(slot, e); });
      row.append(b);
      box.append(row);
    }
    panel.classList.add('open');
  },

  // Puts a stored thing in a slot (whatever was there goes back to the storeroom).
  put(slot, entry) {
    this.slot = slot;
    if (this.placed[slot.id]) this.store.push(this.placed[slot.id]);
    this.store.splice(this.store.findIndex(e => Furniture.same(e, entry)), 1);
    this.placed[slot.id] = { ...entry };
    this.changed = true;
    this.draw();
    this.drawPicker();
  },

  // Takes a thing out of a slot: into the storeroom, or sold. Taking a table
  // away also puts its chairs and what is on it back in the storeroom.
  takeAway(slot, sell) {
    this.slot = slot;
    const entry = this.placed[slot.id];
    delete this.placed[slot.id];
    if (sell) this.money += Furniture.sellPrice(entry); else this.store.push(entry);
    for (const id of Object.keys(this.placed)) {
      if (id.startsWith(`${slot.id}.`)) { this.store.push(this.placed[id]); delete this.placed[id]; }
    }
    this.changed = true;
    this.draw();
    this.drawPicker();
  },

  // ---------- finishing ----------

  bar() {
    const sold = this.money ? `  ·  sold for $${this.money}` : '';
    Screens.root.querySelector('#arrange .arrange-bar span').textContent =
      `ARRANGE: tap a place  ·  storeroom: ${this.store.length}${sold}`;
  },

  // DONE (keep = true): keep the changes and rebuild the restaurant. CANCEL: forget them.
  finish(keep) {
    this.layer.destroy();
    if (keep && this.changed) {
      this.sim.arrange(this.placed, this.store, this.money);
      Screens.rebuild(false);
      return;
    }
    this.ui.cameras.main.setVisible(true);
    this.world.cameras.main.setBounds(0, 0, LAYOUT.width * LAYOUT.tileSize, LAYOUT.height * LAYOUT.tileSize);
    this.world.setCloseUp(this.wasCloseUp);
    Screens.backToHub();
  },
};
