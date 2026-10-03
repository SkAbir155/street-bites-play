// On-screen phone controls, drawn on top of the restaurant and unaffected by
// the camera zoom: a virtual joystick (touch and drag anywhere on the left half
// of the screen), the smart action button, the money panel and the buttons in
// the top-right corner.
//
// Everything is designed for a 1280x720 screen and scaled by `u` to fit the
// real screen, anchored to its corners.

const UI_BASE = { w: 1280, h: 720 };
const JOY_RADIUS = 70;
const ACTION_RADIUS = 80;
const MIN_UI_SCALE = 0.72; // on small screens the controls are never drawn smaller than this

const uiFont = (size, extra = {}) => ({
  fontFamily: 'system-ui, Roboto, "Segoe UI", Arial, sans-serif',
  fontSize: `${size}px`, color: '#ffffff', resolution: 2, ...extra,
});

class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.world = this.scene.get('Restaurant');
    this.input.addPointer(2); // joystick and action button at the same time
    this.hud = this.createHud();
    this.menuButtons = this.createButtons();
    this.joy = this.createJoystick();
    this.keys = this.createKeyboard();
    this.actionButton = this.createActionButton();
    this.hint = this.createHint();
    this.clock = this.createClock();
    this.createSummary();
    this.pausePanel = this.createPause();
    this.layout();
    this.scale.on('resize', this.layout, this);
    Screens.gameReady();
    this.openHub('morning');
  }

  // Before opening and after closing: the shop, arranging furniture, buying
  // ingredients (the game's controls wait meanwhile). `when` is 'morning' or 'night'.
  openHub(when) {
    const sim = this.world.sim;
    this.setSummaryOpen(true);
    Screens.showHub(when, sim, {
      bed: () => { sim.nextDay(); this.openHub('morning'); },
      open: () => { this.setSummaryOpen(false); sim.openDay(); },
    });
  }

  // How big the controls are drawn. On a big screen they keep their designed
  // size; on a phone they are drawn larger than a plain shrink would make
  // them (but never so large that they run into each other), so the text
  // stays readable.
  get u() {
    const ratio = this.scale.width / window.innerWidth; // real pixels per page pixel
    const w = this.scale.width / ratio, h = this.scale.height / ratio;
    return ratio * Math.min(Math.max(h / UI_BASE.h, MIN_UI_SCALE), w / 860);
  }

  // Place everything against the screen edges at the right size.
  layout() {
    const { width: w, height: h } = this.scale;
    const u = this.u;
    this.hud.setPosition(14 * u, 14 * u).setScale(u);
    this.menuButtons.setPosition(w - 14 * u, 14 * u).setScale(u);
    this.joy.home = { x: 160 * u, y: h - 160 * u };
    this.joy.reset();
    this.actionButton.setPosition(w - 140 * u, h - 140 * u).setScale(u);
    if (this.hint.scene) this.hint.setPosition(w / 2, h - 18 * u).setScale(u);
    this.clock.setPosition(w / 2, 12 * u).setScale(u);
    this.pausePanel.setPosition(w / 2, h / 2).setScale(u);
    this.pauseShade.clear().fillStyle(0x000000, 0.55).fillRect(0, 0, w, h);
  }

  // ---------- Money panel (top-left) ----------

  // A Stardew-style wooden money box: the money in cream digit boxes like an
  // odometer, a parchment strip with served / left counts, and a pinned paper
  // note listing orders the waiter still has to send to the kitchen.
  createHud() {
    const sim = this.world.sim;
    const panel = this.add.container(0, 0);
    const W = 284, DIGITS = 6;
    const wood = this.add.graphics();
    drawWoodPanel(wood, 0, 0, W, 112);
    drawCoin(wood, 34, 34, 16);

    // money: one cream box per digit
    const digitBoxes = this.add.graphics();
    const digits = [];
    for (let i = 0; i < DIGITS; i++) {
      const x = 66 + i * 33;
      digitBoxes.fillStyle(0x3b1f0c).fillRect(x, 16, 29, 36);
      digitBoxes.fillStyle(0xf6e7c1).fillRect(x + 2, 18, 25, 32);
      digitBoxes.fillStyle(0xffffff, 0.45).fillRect(x + 2, 18, 25, 4);
      digitBoxes.fillStyle(0xd9c49a).fillRect(x + 2, 46, 25, 4);
      digits.push(this.add.text(x + 14.5, 34, '', hudFont(26, '#5a2d0c')).setOrigin(0.5));
    }

    // served / left strip
    const strip = this.add.graphics();
    strip.fillStyle(0x3b1f0c).fillRect(14, 62, W - 28, 36);
    strip.fillStyle(0xf3e2b3).fillRect(16, 64, W - 32, 32);
    strip.fillStyle(0xe2cc94).fillRect(16, 90, W - 32, 6);
    strip.fillStyle(0x8c4a1c).fillRect(W / 2 - 1, 68, 2, 24);
    drawPlateIcon(strip, 34, 80);
    drawAngryIcon(strip, W / 2 + 18, 80);
    const served = this.add.text(50, 80, '', hudFont(14, '#5a2d0c')).setOrigin(0, 0.5);
    const left = this.add.text(W / 2 + 34, 80, '', hudFont(14, '#5a2d0c')).setOrigin(0, 0.5);

    // pinned note for orders to send
    const note = this.add.container(12, 116);
    const noteBg = this.add.graphics();
    const noteText = this.add.text(12, 12, '', hudFont(13, '#3b1f0c', 'normal'))
      .setWordWrapWidth(W - 44).setLineSpacing(2);
    note.add([noteBg, noteText]);

    panel.add([wood, digitBoxes, ...digits, strip, served, left, note]);

    let lastMoney = sim.money;
    const refresh = () => {
      const text = String(Math.min(sim.money, 10 ** DIGITS - 1)).padStart(DIGITS, ' ');
      digits.forEach((d, i) => d.setText(text[i] === ' ' ? '' : text[i]));
      served.setText(`Served ${sim.served}`);
      left.setText(`Left ${sim.lost}`);

      const orders = sim.tickets.flatMap(t => t.items).map(id => MENU_BY_ID[id].name);
      note.setVisible(orders.length > 0);
      if (orders.length) {
        noteText.setText(`To send: ${orders.join(', ')}`);
        const h = noteText.height + 22;
        noteBg.clear();
        noteBg.fillStyle(0x000000, 0.25).fillRect(4, 5, W - 20, h);
        noteBg.fillStyle(0xfff8dc).fillRect(0, 0, W - 20, h);
        noteBg.fillStyle(0xe8dcb5).fillRect(0, h - 5, W - 20, 5);
        noteBg.lineStyle(1, 0xb9a878).strokeRect(0.5, 0.5, W - 21, h - 1);
        noteBg.fillStyle(0xc1121f).fillCircle((W - 20) / 2, 3, 5);     // red pin
        noteBg.fillStyle(0xffffff, 0.6).fillCircle((W - 20) / 2 - 1.5, 1.5, 1.5);
      }

      if (sim.money !== lastMoney) {
        lastMoney = sim.money;
        this.tweens.add({ targets: digitBoxes, y: -3, duration: 90, yoyo: true });
        this.tweens.add({ targets: digits, y: '-=3', duration: 90, yoyo: true });
      }
    };
    sim.events.on('stats', refresh);
    refresh();
    return panel;
  }

  // ---------- Pill buttons (top-right) ----------

  createButtons() {
    const group = this.add.container(0, 0);
    const zones = this.world.view.zoneLayer;

    const make = (y, onPress) => {
      const bg = this.add.graphics();
      const text = this.add.text(0, y, '', uiFont(17, { fontStyle: 'bold' }))
        .setOrigin(1, 0).setPadding(16, 9, 16, 9).setInteractive();
      text.on('pointerup', onPress);
      text.bg = bg;
      group.add([bg, text]);
      return text;
    };
    const draw = (t) => {
      t.bg.clear();
      t.bg.fillStyle(0x000000, 0.3).fillRoundedRect(-t.width + 2, t.y + 3, t.width, t.height, t.height / 2);
      t.bg.fillStyle(0x23252b, 0.92).fillRoundedRect(-t.width, t.y, t.width, t.height, t.height / 2);
      t.bg.lineStyle(2, 0xffffff, 0.2).strokeRoundedRect(-t.width + 1, t.y + 1, t.width - 2, t.height - 2, t.height / 2);
    };

    const zonesButton = make(0, () => { zones.setVisible(!zones.visible); refresh(); });
    const viewButton = make(50, () => { this.world.setCloseUp(!this.world.closeUp); refresh(); });
    // (the installed app always fills the screen, so it has no full-screen button)
    const inApp = !!window.Capacitor;
    const fullButton = inApp ? null : make(100, () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    });
    const sfx = this.game.sfx;
    const soundButton = make(inApp ? 100 : 150, () => { sfx.setOn(!sfx.on); sfx.play('ready'); refresh(); });
    const pauseButton = make(inApp ? 150 : 200, () => this.setPaused(true));
    pauseButton.setText('⏸ Pause');
    draw(pauseButton);
    const refresh = () => {
      zonesButton.setText(`🗺 Zones: ${zones.visible ? 'ON' : 'OFF'}`);
      viewButton.setText(this.world.closeUp ? '🔍 Close-up' : '🔭 Whole map');
      if (fullButton) fullButton.setText(this.scale.isFullscreen ? '⤡ Exit full screen' : '⛶ Full screen');
      soundButton.setText(sfx.on ? '🔊 Sound: ON' : '🔇 Sound: OFF');
      [zonesButton, viewButton, fullButton, soundButton].filter(Boolean).forEach(draw);
    };
    this.scale.on('enterfullscreen', refresh);
    this.scale.on('leavefullscreen', refresh);
    refresh();
    return group;
  }

  // ---------- Joystick (anywhere on the left half) ----------

  createJoystick() {
    const controls = this.game.controls;
    const base = this.add.graphics();
    base.fillStyle(0xffffff, 0.1).fillCircle(0, 0, JOY_RADIUS);
    base.lineStyle(3, 0xffffff, 0.45).strokeCircle(0, 0, JOY_RADIUS);
    base.lineStyle(2, 0xffffff, 0.15).strokeCircle(0, 0, JOY_RADIUS * 0.58);
    base.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, r = JOY_RADIUS - 12;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const px = -Math.sin(a) * 7, py = Math.cos(a) * 7;
      base.fillTriangle(x + Math.cos(a) * 7, y + Math.sin(a) * 7, x + px, y + py, x - px, y - py);
    }
    const knob = this.add.graphics();
    knob.fillStyle(0x000000, 0.25).fillCircle(2, 4, 32);
    knob.fillStyle(0xe9ecef).fillCircle(0, 0, 32);
    knob.lineStyle(3, 0xffffff).strokeCircle(0, 0, 32);
    knob.fillStyle(0xffffff, 0.8).fillCircle(-10, -11, 8);

    const joy = {
      base, knob, pointerId: null, home: { x: 0, y: 0 },
      reset: () => {
        const u = this.u;
        base.setPosition(joy.home.x, joy.home.y).setScale(u).setAlpha(0.7);
        knob.setPosition(joy.home.x, joy.home.y).setScale(u).setAlpha(0.7);
        controls.x = controls.y = 0;
      },
    };

    const release = (p) => {
      if (p.id !== joy.pointerId) return;
      joy.pointerId = null;
      joy.reset();
    };
    this.input.on('pointerdown', (p) => {
      if (this.summaryOpen || this.paused || joy.pointerId !== null || p.x > this.scale.width / 2) return;
      joy.pointerId = p.id;
      base.setPosition(p.x, p.y).setAlpha(1);
      knob.setPosition(p.x, p.y).setAlpha(1);
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== joy.pointerId) return;
      const radius = JOY_RADIUS * this.u;
      const dx = p.x - base.x, dy = p.y - base.y;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(dist, radius) / dist;
      knob.setPosition(base.x + dx * k, base.y + dy * k);
      controls.x = (dx * k) / radius;
      controls.y = (dy * k) / radius;
    });
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    return joy;
  }

  // ---------- Smart action button (bottom-right) ----------

  createActionButton() {
    const button = this.add.container(0, 0);
    this.actionBg = this.add.graphics();
    this.actionIcon = this.add.graphics();
    this.actionLabel = this.add.text(0, 38, '', uiFont(17, { fontStyle: 'bold', color: '#3b2a12', align: 'center' }))
      .setOrigin(0.5);
    button.add([this.actionBg, this.actionIcon, this.actionLabel]);
    button.setInteractive(new Phaser.Geom.Circle(0, 0, ACTION_RADIUS), Phaser.Geom.Circle.Contains);
    button.on('pointerdown', () => {
      if (this.summaryOpen || this.paused) return;
      this.world.sim.doAction();
      const u = this.u;
      this.tweens.add({ targets: button, scale: u * 0.9, duration: 70, yoyo: true, onComplete: () => button.setScale(this.u) });
    });
    this.actionKey = undefined;
    return button;
  }

  drawActionButton(action) {
    const key = action ? `${action.kind}:${action.label}:${action.item || ''}` : '';
    if (key === this.actionKey) return;
    this.actionKey = key;
    const bg = this.actionBg, icon = this.actionIcon, R = ACTION_RADIUS;
    bg.clear();
    icon.clear();
    if (this.actionFood) this.actionFood.destroy();
    this.actionFood = null;
    bg.fillStyle(0x000000, 0.3).fillCircle(3, 6, R);
    if (!action) {
      bg.fillStyle(0x6c6f78, 0.45).fillCircle(0, 0, R);
      bg.lineStyle(4, 0xffffff, 0.3).strokeCircle(0, 0, R - 2);
      drawActionIcon(icon, 'idle', 0, -8);
      this.actionLabel.setText('');
      return;
    }
    bg.fillStyle(0xf4b942).fillCircle(0, 0, R);
    bg.fillStyle(0xffd166).fillCircle(0, -4, R - 6);
    bg.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, R - 2);
    if (action.item) {
      this.actionFood = makeFood(this, action.item, 0, -14, 1.6);
      this.actionButton.addAt(this.actionFood, 2); // above the button, below its label
    } else drawActionIcon(icon, action.kind, 0, -12);
    this.actionLabel.setText(action.label);
  }

  update() {
    this.drawActionButton(this.world.sim.action);
    this.readKeyboard();
    this.updateClock();
  }

  // ---------- Clock (top-centre) ----------

  // A small wooden plaque: sun or moon, the day number and the time.
  createClock() {
    const plaque = this.add.container(0, 0);
    const wood = this.add.graphics();
    drawWoodPanel(wood, -106, 0, 212, 50);
    this.clockIcon = this.add.graphics();
    this.clockDay = this.add.text(-58, 10, '', hudFont(12, '#ffe9b8'));
    this.clockTime = this.add.text(-58, 23, '', hudFont(20, '#fff6dc'));
    this.clockNote = this.add.text(96, 31, '', hudFont(11, '#ffe9b8')).setOrigin(1, 0.5);
    plaque.add([wood, this.clockIcon, this.clockDay, this.clockTime, this.clockNote]);
    this.clockShown = null;
    return plaque;
  }

  updateClock() {
    const sim = this.world.sim;
    const minutes = Math.floor((sim.clock * 60) / 10) * 10; // shown in 10-minute steps
    const key = `${sim.day}:${minutes}:${sim.phase}`;
    if (key === this.clockShown) return;
    this.clockShown = key;
    const h24 = Math.floor(minutes / 60), m = minutes % 60;
    this.clockDay.setText(`DAY ${sim.day}`);
    this.clockTime.setText(`${((h24 + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`);
    this.clockNote.setText({ morning: 'MORNING', open: 'OPEN', closing: 'CLOSING' }[sim.phase] || 'CLOSED');

    const g = this.clockIcon, x = -82, y = 25;
    g.clear();
    if (h24 >= 6 && sim.clock < 18.5) {          // sun
      g.fillStyle(0xffd166);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillTriangle(x + Math.cos(a) * 17, y + Math.sin(a) * 17,
          x + Math.cos(a + 0.28) * 10, y + Math.sin(a + 0.28) * 10, x + Math.cos(a - 0.28) * 10, y + Math.sin(a - 0.28) * 10);
      }
      g.fillStyle(0xf4b942).fillCircle(x, y, 10);
      g.fillStyle(0xffe08a).fillCircle(x, y, 8);
    } else {                                     // moon and stars
      g.fillStyle(0xf1f5ff).fillCircle(x, y, 11);
      g.fillStyle(0xb86a2e).fillCircle(x + 6, y - 4, 10); // bite out of the moon (panel colour)
      g.fillStyle(0xf1f5ff).fillCircle(x + 9, y + 9, 1.5).fillCircle(x + 13, y - 9, 1.2);
    }
  }

  // ---------- End-of-day report ----------

  // The report and the shop are web-page screens on top of the game (see
  // screens.js); while they are open the game's own controls are switched off.
  createSummary() {
    const sim = this.world.sim;
    sim.events.on('dayEnd', (report) => {
      this.setSummaryOpen(true);
      Screens.showReport(report, sim, () => this.openHub('night'));
    });
  }

  // ---------- Pause ----------

  // Freezes the restaurant (customers, clock, cooking) until Resume is pressed.
  createPause() {
    this.pauseShade = this.add.graphics().setVisible(false);
    this.pauseShade.setInteractive(new Phaser.Geom.Rectangle(0, 0, 10000, 10000), Phaser.Geom.Rectangle.Contains);
    const panel = this.add.container(0, 0).setVisible(false);
    const bg = this.add.graphics();
    drawWoodPanel(bg, -190, -130, 380, 260);
    const title = this.add.text(0, -88, 'PAUSED', hudFont(34, '#fff6dc')).setOrigin(0.5);
    const tip = this.pauseInfo = this.add.text(0, -50, '', hudFont(14, '#ffe9b8', 'normal')).setOrigin(0.5);
    const btn = this.add.graphics();
    const label = this.add.text(0, 6, '▶ Resume', hudFont(22, '#3b2a12')).setOrigin(0.5).setPadding(30, 12, 30, 12);
    const bw = label.width, bh = label.height, bx = -bw / 2, by = 6 - bh / 2;
    // Main menu: leaves the day unfinished. It asks for a second tap first.
    const START_OVER = '☰ Main menu';
    const reset = this.pauseReset = this.add.text(0, 66, START_OVER, hudFont(14, '#4a240a'))
      .setOrigin(0.5).setPadding(12, 8, 12, 8).setInteractive();
    reset.on('pointerup', () => {
      if (reset.text === START_OVER) return reset.setText('Today will start again. Tap to leave').setColor('#8b0000');
      Screens.toMenu();
    });
    reset.restore = () => reset.setText(START_OVER).setColor('#4a240a');
    const version = this.add.text(0, 104, `Saved after every day  ·  build ${window.BUILD || 'dev'}`, hudFont(11, '#5a2d0c', 'normal')).setOrigin(0.5);
    btn.fillStyle(0x3b1f0c).fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 9, 10);
    btn.fillStyle(0xf4b942).fillRoundedRect(bx, by, bw, bh + 3, 8);
    btn.fillStyle(0xffd166).fillRoundedRect(bx, by, bw, bh - 2, 8);
    label.setInteractive().on('pointerup', () => this.setPaused(false));
    panel.add([bg, title, tip, btn, label, reset, version]);
    if (this.input.keyboard) {
      for (const key of ['P', 'ESC']) this.input.keyboard.on(`keydown-${key}`, () => { if (!this.summaryOpen) this.setPaused(!this.paused); });
    }
    return panel;
  }

  setPaused(on) {
    if (this.summaryOpen) return;
    this.paused = on;
    this.pausePanel.setVisible(on);
    this.pauseShade.setVisible(on);
    const sim = this.world.sim;
    this.pauseInfo.setText(`Day ${sim.day}  ·  waiter's wallet: $${sim.wallet + sim.tipsKept()}`);
    this.pauseReset.restore();
    this.game.controls.x = this.game.controls.y = 0;
    if (on) this.scene.pause('Restaurant'); else this.scene.resume('Restaurant');
  }

  setSummaryOpen(open) {
    this.summaryOpen = open;
    if (open) { this.game.controls.x = this.game.controls.y = 0; }
  }

  // ---------- Keyboard (computer): WASD or arrows to move, Space or E to act ----------

  createKeyboard() {
    if (!this.input.keyboard) return null;
    const keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT');
    for (const name of ['SPACE', 'E']) {
      this.input.keyboard.on(`keydown-${name}`, () => { if (!this.summaryOpen && !this.paused) this.world.sim.doAction(); });
    }
    return keys;
  }

  // Keys steer the waiter whenever the touch joystick isn't being used.
  readKeyboard() {
    const k = this.keys;
    if (!k || this.joy.pointerId !== null || this.summaryOpen || this.paused) return;
    const controls = this.game.controls;
    controls.x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    controls.y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
  }

  // ---------- First-time hint (bottom-centre) ----------

  createHint() {
    const hint = this.add.container(0, 0);
    const text = this.add.text(0, 0,
      'Take orders  →  send them at the kitchen window  →  serve the food  →  clear dirty plates to the dish bin',
      uiFont(16)).setOrigin(0.5, 1).setPadding(16, 8, 16, 8);
    const bg = this.add.graphics();
    bg.fillStyle(0x23252b, 0.9).fillRoundedRect(-text.width / 2, -text.height, text.width, text.height, text.height / 2);
    hint.add([bg, text]);
    this.tweens.add({ targets: hint, alpha: 0, delay: 9000, duration: 1000, onComplete: () => hint.destroy() });
    return hint;
  }
}

const hudFont = (size, color, weight = 'bold') => ({
  fontFamily: '"Courier New", Consolas, monospace', fontSize: `${size}px`,
  fontStyle: weight, color, resolution: 2,
});

// Wooden board with planks, a dark outline, a light top edge and corner nails.
function drawWoodPanel(g, x, y, w, h) {
  g.fillStyle(0x000000, 0.3).fillRect(x + 4, y + 5, w, h);
  g.fillStyle(0x3b1f0c).fillRect(x, y, w, h);
  g.fillStyle(0xb86a2e).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle(0x9c5724);
  for (let py = y + 3 + 18; py < y + h - 6; py += 18) g.fillRect(x + 3, py, w - 6, 2);
  g.fillStyle(0xe49a55).fillRect(x + 3, y + 3, w - 6, 3);
  g.fillStyle(0x7a3f16).fillRect(x + 3, y + h - 6, w - 6, 3);
  for (const [nx, ny] of [[x + 8, y + 8], [x + w - 10, y + 8], [x + 8, y + h - 10], [x + w - 10, y + h - 10]]) {
    g.fillStyle(0x3b1f0c).fillRect(nx, ny, 3, 3);
    g.fillStyle(0xd9c49a).fillRect(nx, ny, 2, 2);
  }
}

function drawPlateIcon(g, x, y) {
  g.fillStyle(0x3b1f0c).fillEllipse(x, y + 1, 26, 14);
  g.fillStyle(0xffffff).fillEllipse(x, y, 24, 12);
  g.fillStyle(0xe8e2d4).fillEllipse(x, y, 14, 7);
  g.fillStyle(0x6ab04c).fillCircle(x - 3, y - 1, 2.5);
  g.fillStyle(0xe63946).fillCircle(x + 3, y - 1, 2.5);
}

function drawAngryIcon(g, x, y) {
  g.fillStyle(0x3b1f0c).fillCircle(x, y, 11);
  g.fillStyle(0xe85d3a).fillCircle(x, y, 9.5);
  g.fillStyle(0x3b1f0c);
  g.fillRect(x - 6, y - 5, 4, 2).fillRect(x + 2, y - 5, 4, 2);    // brows
  g.fillRect(x - 5, y - 2, 2, 2).fillRect(x + 3, y - 2, 2, 2);    // eyes
  g.fillRect(x - 4, y + 4, 8, 2);                                 // mouth
}

function drawCoin(g, x, y, r) {
  g.fillStyle(0xb7811a).fillCircle(x, y + 2, r);
  g.fillStyle(0xf6c945).fillCircle(x, y, r);
  g.lineStyle(2, 0xc9951a).strokeCircle(x, y, r * 0.7);
  g.fillStyle(0xffffff, 0.7).fillEllipse(x - r * 0.35, y - r * 0.4, r * 0.5, r * 0.3);
}

// Pictures for smart-button actions that aren't a food item.
function drawActionIcon(g, kind, x, y) {
  switch (kind) {
    case 'take': // notepad and pencil
      g.fillStyle(0x000000, 0.15).fillRoundedRect(x - 17, y - 19, 34, 42, 4);
      g.fillStyle(0xffffff).fillRoundedRect(x - 19, y - 22, 34, 42, 4);
      g.fillStyle(0xe63946).fillRect(x - 19, y - 22, 34, 7);
      g.lineStyle(2, 0x9aa5b1);
      for (let i = 0; i < 4; i++) g.lineBetween(x - 13, y - 7 + i * 7, x + 9, y - 7 + i * 7);
      g.fillStyle(0xf4a261).fillPoints([{ x: x + 10, y: y + 18 }, { x: x + 26, y: y - 6 }, { x: x + 31, y: y - 2 }, { x: x + 15, y: y + 22 }], true);
      g.fillStyle(0x3b2a12).fillTriangle(x + 10, y + 18, x + 15, y + 22, x + 8, y + 25);
      break;
    case 'send': // service bell
      g.fillStyle(0x7a5a12).fillRoundedRect(x - 26, y + 12, 52, 8, 3);
      g.fillStyle(0xd4a017).fillEllipse(x, y + 12, 44, 40);
      g.fillStyle(0xffd166).fillEllipse(x, y + 10, 40, 36);
      g.fillStyle(0xffd166).fillRect(x - 22, y + 10, 44, 3);
      g.fillStyle(0xfff3c4, 0.9).fillEllipse(x - 8, y + 2, 10, 14);
      g.fillStyle(0x7a5a12).fillCircle(x, y - 10, 4);
      break;
    case 'trash': // green trash can with its lid lifted
      g.fillStyle(0x1b4332).fillRoundedRect(x - 15, y - 8, 30, 32, 3);
      g.fillStyle(0x2d6a4f).fillRoundedRect(x - 13, y - 8, 26, 30, 3);
      g.fillStyle(0x1b4332);
      for (let i = -7; i <= 7; i += 7) g.fillRect(x + i - 1, y - 4, 2, 22);
      g.fillStyle(0x40916c).fillEllipse(x - 4, y - 16, 34, 9);
      g.fillStyle(0x1b4332).fillRoundedRect(x - 9, y - 23, 10, 4, 2);
      break;
    case 'clear': // a stack of dirty plates
      g.fillStyle(0x3b2a12, 0.25).fillEllipse(x + 2, y + 16, 56, 16);
      for (const [dy, w] of [[12, 54], [4, 50], [-4, 46]]) {
        g.fillStyle(0x6b6b6b).fillEllipse(x, y + dy + 2, w, w * 0.36);
        g.fillStyle(0xf1ede4).fillEllipse(x, y + dy, w, w * 0.36);
        g.fillStyle(0xd9d2c3).fillEllipse(x, y + dy, w * 0.6, w * 0.2);
      }
      g.fillStyle(0xb5651d).fillEllipse(x - 6, y - 5, 14, 5);
      g.fillStyle(0xc0392b).fillCircle(x + 8, y - 4, 3);
      break;
    case 'dishes': // plates going into the dish bin
      g.fillStyle(0xf1ede4).fillEllipse(x, y - 16, 36, 12);
      g.fillStyle(0xd9d2c3).fillEllipse(x, y - 16, 22, 7);
      g.fillStyle(0x3b2a12).fillTriangle(x - 9, y - 4, x + 9, y - 4, x, y + 6);
      g.fillStyle(0x495057).fillRoundedRect(x - 26, y + 8, 52, 18, 4);
      g.fillStyle(0x8ecae6).fillRoundedRect(x - 22, y + 10, 44, 8, 3);
      break;
    case 'putdown': // arrow down onto a shelf
      g.fillStyle(0x3b2a12).fillTriangle(x - 18, y - 2, x + 18, y - 2, x, y + 16);
      g.fillRect(x - 7, y - 22, 14, 21);
      g.fillStyle(0x7a5a12).fillRoundedRect(x - 26, y + 19, 52, 6, 3);
      break;
    default: // idle: an open hand, faded
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(x - 14, y - 6, 28, 26, 10);
      for (let i = 0; i < 4; i++) g.fillRoundedRect(x - 14 + i * 7.5, y - 22, 6, 20, 3);
      g.fillRoundedRect(x + 10, y - 2, 14, 7, 3);
  }
}
