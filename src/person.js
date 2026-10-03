// A person drawn from shapes, split into parts so they can animate:
// legs step, arms swing (or hold food out), the body bobs and the eyes blink.
// Position (x, y) is where the feet touch the floor; depth follows y so
// people are drawn behind/in front of furniture correctly.
//
// Looks: outfit (casual, waiter, chef, cashier, greeter, cleaner), colours,
// hairStyle (short, long, bun, spiky, curly, bald) and glasses.

const PERSON_DEFAULTS = {
  outfit: 'casual',
  shirt: 0x4ea8de,
  pants: 0x2b2d42,
  skin: 0xf1c27d,
  hair: 0x3b2314,
  hairStyle: 'short',
  glasses: false,
  marker: null,  // colour of a "this is you" arrow above the head
  facing: 'down',
};

// Fixed colours for staff uniforms.
const OUTFITS = {
  casual:  { longSleeves: false },
  waiter:  { shirt: 0xf8f9fa, vest: 0x22252b, pants: 0x22252b, longSleeves: true },
  chef:    { shirt: 0xfdfdfd, pants: 0x495057, longSleeves: true },
  cashier: { shirt: 0x40916c, pants: 0x2b2d42, cap: 0x2d6a4f, longSleeves: false },
  greeter: { shirt: 0xe76f9a, pants: 0x2b2d42, longSleeves: true },
  cleaner: { shirt: 0x9d7cd8, pants: 0x3d5a80, overalls: 0x3d5a80, gloves: 0xffd43b, longSleeves: true },
};

const SPRITE_HEIGHT = 64; // px, the basic height pixel-art people are shown at
// How tall each person is shown: adult men taller, the teenager shorter.
// A picture with something tall on top (the chef's hat, a hair bun, big
// curls) needs extra height so the body underneath comes out the right size.
const SPRITE_HEIGHTS = {
  waiter: 74, chef: 90, cashier: 66, greeter: 70, cleaner: 70,
  waiterRed: 74, waiterBlue: 74, waiterGreen: 74, waiterPurple: 74,
  customer1: 62,  // teenage boy
  customer2: 68,  // blonde woman
  customer3: 70,  // old man
  customer4: 68,  // woman in red (hair bun)
  customer5: 74,  // man in yellow
  customer6: 66,  // ginger-haired woman
};
const SITTING_SHOWN = 0.62; // share of a standing picture shown above the seat (when no sitting picture)
const SIT_HEIGHT = 54;      // px, how tall a sitting-pose picture is shown
const SIT_BODY_Y = -9;      // lifts a sitting-pose picture so the hips rest on the stool
const CROPPED_BODY_Y = -4;  // same for a cut-off standing picture (no sitting picture yet)
const HEAD_Y = -51;   // centre of the head, relative to the feet
const HEAD_R = 13;
const LINE = 1.5;     // outline thickness

class Person {
  // x, y are in tiles.
  constructor(scene, tileSize, opts = {}) {
    this.scene = scene;
    this.T = tileSize;
    this.look = { ...PERSON_DEFAULTS, ...opts };
    const uniform = OUTFITS[this.look.outfit];
    for (const key of ['shirt', 'pants']) if (uniform[key] && !(key in opts)) this.look[key] = uniform[key];
    this.uniform = uniform;

    this.walking = false;
    this.sitting = false;
    this.working = false; // small busy arm movement (cooking, scrubbing, ...)
    this.phase = 0;
    this.seed = Math.random() * 10;
    this.blinking = false;
    this.nextBlink = 0;
    this.held = [];        // ids of the dishes being carried (the waiter: up to two)
    this.heldDishes = [];  // their pictures

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.22).fillEllipse(0, 0, 28, 9);
    this.legL = scene.add.graphics();
    this.legR = scene.add.graphics();
    this.torso = scene.add.graphics();
    this.face = scene.add.graphics();
    this.hairGfx = scene.add.graphics();
    this.armL = scene.add.graphics();
    this.armR = scene.add.graphics();
    this.markerGfx = scene.add.graphics();
    this.body = scene.add.container(0, 0,
      [this.torso, this.face, this.hairGfx, this.armL, this.armR, this.markerGfx]);
    this.root = scene.add.container(opts.x * tileSize, opts.y * tileSize,
      [this.shadow, this.legL, this.legR, this.body]);

    // Pixel-art pictures (assets/people/<name>_front/back/side.png) replace the
    // drawn body when they exist. Staff use their outfit name.
    const name = opts.sprite || (this.look.outfit !== 'casual' ? this.look.outfit : null);
    this.sprite = name && scene.textures.exists(`${name}_front`) ? name : null;
    if (this.sprite) {
      this.spriteHeight = SPRITE_HEIGHTS[this.sprite] || SPRITE_HEIGHT;
      this.sizeFactor = this.spriteHeight / SPRITE_HEIGHT; // 1 = basic height
      this.spriteImg = scene.add.image(0, 0, `${this.sprite}_front`).setOrigin(0.5, 1);
      this.body.addAt(this.spriteImg, 0);
    }

    this.bubble = scene.add.text(0, 0, '', {
      fontFamily: 'system-ui, Roboto, Arial, sans-serif', fontSize: '15px', color: '#222222',
      backgroundColor: '#ffffff', padding: { x: 6, y: 3 }, resolution: 3,
    }).setOrigin(0.5, 1).setDepth(DEPTH.ui - 1).setVisible(false);

    this.drawMarker();
    this.setFacing(this.look.facing);
    scene.events.on('update', this.update, this);
  }

  get side() {
    return this.facing === 'left' || this.facing === 'right';
  }

  // Height of the top of the head (or hat), for placing bubbles above it.
  get topY() {
    if (this.sitting && this.sprite && !this.sitCropped) return -SIT_HEIGHT * this.sizeFactor - 4;
    if (this.sprite) return -this.spriteHeight - 4;
    if (this.look.outfit === 'chef') return -82;
    if (this.look.hairStyle === 'bun') return -72;
    return -66;
  }

  // True if this person has sitting-pose pictures (<name>_sit_front/back/side).
  get hasSitArt() {
    return !!this.sprite && this.scene.textures.exists(`${this.sprite}_sit_front`);
  }

  setFacing(dir) {
    this.facing = dir;
    this.root.scaleX = dir === 'left' ? -1 : 1; // left = mirrored right
    if (this.sprite) {
      const view = dir === 'up' ? 'back' : dir === 'down' ? 'front' : 'side';
      const pose = this.sitting && this.hasSitArt ? 'sit_' : this.carryPose;
      // reading the menu: its own pictures (<name>_menu_front/side) if they exist
      // (from behind the menu is hidden, so the normal sitting picture is used)
      const menuPose = this.sitting && this.reading && view !== 'back' && this.scene.textures.exists(`${this.sprite}_menu_front`);
      this.menuPictured = menuPose;
      // A view that isn't made yet. Sitting: seen from behind, the standing
      // back picture cut off at the seat works (the legs are hidden anyway);
      // otherwise the front sitting picture. Carrying: the plain view.
      const tries = menuPose ? [`${this.sprite}_menu_${view}`, `${this.sprite}_menu_front`] : pose === 'sit_'
        ? [`${this.sprite}_sit_${view}`, view === 'back' ? `${this.sprite}_back` : '', `${this.sprite}_sit_front`]
        : [`${this.sprite}_${pose}${view}`, `${this.sprite}_${view}`, `${this.sprite}_${pose}front`, `${this.sprite}_front`];
      const key = tries.find(k => this.scene.textures.exists(k));
      const sittingPicture = key.includes('_sit_') || key.includes('_menu_');
      const img = this.spriteImg.setTexture(key).setCrop();
      img.setScale((sittingPicture ? SIT_HEIGHT * this.sizeFactor : this.spriteHeight) / img.height);
      this.sitCropped = this.sitting && !sittingPicture; // a standing picture cut off at the seat
      if (this.sitCropped) this.cropForSitting();
      this.placeMenu();
      this.placeHeld();
      return;
    }
    this.drawLegs();
    this.drawTorso();
    this.drawFace();
    this.drawHair();
    this.drawArms();
    this.placeHeld();
  }

  // ---------- Drawing ----------

  drawLegs() {
    const { pants } = this.look;
    const [lx, rx] = this.side ? [-5, -1] : [-8, 1];
    for (const [g, x, color] of [[this.legL, lx, shade(pants, 0.85)], [this.legR, rx, pants]]) {
      g.clear();
      g.fillStyle(color).fillRoundedRect(x, -18, 7, 16, 2);
      g.lineStyle(LINE, shade(pants, 0.55)).strokeRoundedRect(x, -18, 7, 16, 2);
      g.fillStyle(0x2b2b2b).fillEllipse(x + 3.5 + (this.side ? 2 : 0), -2, this.side ? 11 : 9, 5);
    }
  }

  drawTorso() {
    const g = this.torso, L = this.look, U = this.uniform;
    const back = this.facing === 'up', side = this.side;
    const bw = side ? 18 : 24, top = -39, h = 26;
    g.clear();

    // neck
    g.fillStyle(shade(L.skin, 0.88)).fillRect(-3.5, top - 3, 7, 6);

    // torso with a darker lower half for shading
    g.fillStyle(L.shirt).fillRoundedRect(-bw / 2, top, bw, h, 8);
    g.fillStyle(shade(L.shirt, 0.88)).fillRoundedRect(-bw / 2, top + h * 0.55, bw, h * 0.45, { tl: 0, tr: 0, bl: 8, br: 8 });

    switch (L.outfit) {
      case 'waiter': {
        g.fillStyle(U.vest);
        if (back) g.fillRoundedRect(-bw / 2, top, bw, h - 4, 8);
        else if (side) g.fillRoundedRect(-bw / 2, top + 2, bw - 4, h - 6, 6);
        else {
          g.fillRoundedRect(-bw / 2, top + 2, bw / 2 - 2.5, h - 6, { tl: 6, tr: 0, bl: 4, br: 0 });
          g.fillRoundedRect(2.5, top + 2, bw / 2 - 2.5, h - 6, { tl: 0, tr: 6, bl: 0, br: 4 });
          g.fillStyle(0xd4a017).fillCircle(-4, top + 12, 1.2).fillCircle(-4, top + 17, 1.2);
          g.fillStyle(0xc1121f).fillTriangle(0, top + 2, -5, top - 1, -5, top + 5);
          g.fillTriangle(0, top + 2, 5, top - 1, 5, top + 5);
        }
        // long black apron from the waist
        g.fillStyle(0x16181d).fillRoundedRect(-bw / 2 + 1, top + h - 7, bw - 2, 15, 3);
        g.fillStyle(0xffffff, 0.08).fillRect(-bw / 2 + 3, top + h - 5, bw - 6, 2);
        break;
      }
      case 'chef': {
        if (!back) {
          g.lineStyle(1, 0xced4da).lineBetween(side ? 4 : 3, top + 3, side ? 4 : 3, top + h - 2);
          g.fillStyle(0x868e96);
          for (let i = 0; i < 3; i++) {
            if (!side) g.fillCircle(-3, top + 8 + i * 6, 1.3);
            g.fillCircle(side ? 6 : 7, top + 8 + i * 6, 1.3);
          }
          g.fillStyle(0xe63946).fillTriangle(-6, top, 6, top, 0, top + 7);
        }
        break;
      }
      case 'cashier': {
        if (!back && !side) {
          g.fillStyle(0xffffff).fillTriangle(-6, top, 0, top + 7, -1, top);
          g.fillTriangle(6, top, 0, top + 7, 1, top);
          g.fillStyle(0xffffff).fillRoundedRect(-9, top + 9, 6, 4, 1);
        }
        break;
      }
      case 'greeter': {
        if (!back) {
          g.fillStyle(0xffffff).fillTriangle(side ? 2 : -4, top, side ? 8 : 4, top, side ? 5 : 0, top + 12);
          g.fillStyle(shade(L.shirt, 0.75));
          if (!side) {
            g.fillTriangle(-4, top, -1, top + 13, -8, top + 6);
            g.fillTriangle(4, top, 1, top + 13, 8, top + 6);
            g.fillStyle(0xffd166).fillRoundedRect(3.5, top + 13, 7, 3.5, 1);
          }
        }
        break;
      }
      case 'cleaner': {
        g.fillStyle(U.overalls);
        if (back) g.fillRect(-bw / 2 + 3, top + 10, bw - 6, h - 10);
        else {
          g.fillRoundedRect(side ? -6 : -8, top + 8, side ? 12 : 16, h - 8, 3);
          g.lineStyle(2.5, U.overalls);
          if (!side) { g.lineBetween(-6, top + 9, -7, top + 1); g.lineBetween(6, top + 9, 7, top + 1); }
          g.fillStyle(0xffd43b).fillCircle(side ? 3 : -5, top + 10, 1.2);
          if (!side) g.fillCircle(5, top + 10, 1.2);
        }
        break;
      }
      default: {
        if (!back) {
          g.fillStyle(L.skin).fillEllipse(side ? 3 : 0, top + 1, side ? 6 : 10, 5);
          g.fillStyle(shade(L.shirt, 1.25), 0.6).fillCircle(side ? 3 : 0, top + 13, 3.5);
        }
      }
    }
    g.lineStyle(LINE, shade(L.shirt, 0.55)).strokeRoundedRect(-bw / 2, top, bw, h, 8);

    // head and ears
    const skinLine = shade(L.skin, 0.65);
    g.fillStyle(L.skin);
    if (!side) {
      g.fillCircle(-HEAD_R + 0.5, HEAD_Y + 1, 3.5).fillCircle(HEAD_R - 0.5, HEAD_Y + 1, 3.5);
    }
    g.fillCircle(0, HEAD_Y, HEAD_R);
    g.lineStyle(LINE, skinLine).strokeCircle(0, HEAD_Y, HEAD_R);
    if (side) {
      g.fillStyle(L.skin).fillCircle(-3, HEAD_Y + 1, 3.5);
      g.lineStyle(1, skinLine).strokeCircle(-3, HEAD_Y + 1, 3.5);
    }
  }

  drawFace() {
    const g = this.face, L = this.look;
    g.clear();
    if (this.facing === 'up') return;
    const y = HEAD_Y + 1;
    const eye = (x) => {
      if (this.blinking) {
        g.lineStyle(1.6, 0x2b2118).lineBetween(x - 2.2, y + 0.5, x + 2.2, y + 0.5);
        return;
      }
      g.fillStyle(0xffffff).fillEllipse(x, y, 5, 6);
      g.fillStyle(0x2b2118).fillCircle(x + (this.side ? 0.8 : 0), y + 0.6, 1.9);
      g.fillStyle(0xffffff).fillCircle(x + 0.7, y - 0.4, 0.6);
    };
    const brow = shade(L.hair === 0x111111 ? 0x333333 : L.hair, 0.8);

    if (this.side) {
      eye(6);
      g.lineStyle(1.4, brow).lineBetween(3.5, y - 4.5, 8, y - 4.8);
      g.fillStyle(shade(L.skin, 0.9)).fillCircle(12.6, y + 2, 2);
      g.fillStyle(0xff8fa3, 0.35).fillCircle(6.5, y + 5, 2.4);
      g.lineStyle(1.3, 0x7a3b2e).lineBetween(8.5, y + 6.5, 11, y + 6);
      if (L.glasses) {
        g.lineStyle(1.3, 0x222222).strokeCircle(6, y, 3.8);
        g.lineBetween(2.2, y - 1, -2, y - 1);
      }
      return;
    }

    eye(-4.5);
    eye(4.5);
    g.lineStyle(1.4, brow);
    g.lineBetween(-6.8, y - 4.4, -2.6, y - 4.9);
    g.lineBetween(2.6, y - 4.9, 6.8, y - 4.4);
    g.fillStyle(0xff8fa3, 0.35).fillCircle(-7.5, y + 4.5, 2.4).fillCircle(7.5, y + 4.5, 2.4);
    g.lineStyle(1.4, 0x7a3b2e);
    g.beginPath();
    g.arc(0, y + 3.8, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
    g.strokePath();
    if (L.glasses) {
      g.lineStyle(1.3, 0x222222).strokeCircle(-4.5, y, 3.8).strokeCircle(4.5, y, 3.8);
      g.lineBetween(-0.7, y, 0.7, y);
    }
  }

  drawHair() {
    const g = this.hairGfx, L = this.look, style = L.hairStyle;
    const back = this.facing === 'up', side = this.side;
    const y = HEAD_Y, c = L.hair, line = shade(c, 0.6);
    g.clear();

    if (style !== 'bald') {
      g.fillStyle(c);
      if (style === 'long') {
        if (back) g.fillRoundedRect(-14, y - 10, 28, 30, 8);
        else if (side) g.fillRoundedRect(-14, y - 6, 12, 24, 5);
        else { g.fillRoundedRect(-15, y - 6, 6, 22, 3); g.fillRoundedRect(9, y - 6, 6, 22, 3); }
      }
      if (style === 'curly') {
        const n = back ? 11 : 8;
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (back ? 0.95 + (i / (n - 1)) * 1.1 : 1.05 + (i / (n - 1)) * 0.9);
          g.fillCircle(Math.cos(a) * 11 + (side ? -2 : 0), y + Math.sin(a) * 11, 5.5);
        }
        if (back) g.fillCircle(0, y, 12);
      } else if (back) {
        g.fillCircle(0, y - 1, HEAD_R + 0.5);
      } else if (side) {
        g.fillEllipse(-1, y - 7, 27, 15);
        g.fillCircle(-5, y - 2, 9.5);
      } else {
        g.fillEllipse(0, y - 7, 28, 16);
        g.fillRect(-13.5, y - 8, 4, 9);
        g.fillRect(9.5, y - 8, 4, 9);
      }
      if (style === 'spiky') {
        for (let i = -2; i <= 2; i++) g.fillTriangle(i * 5.5 - 4, y - 10, i * 5.5 + 4, y - 10, i * 5.5 + (side ? -2 : 0), y - 20);
      }
      if (style === 'bun') g.fillCircle(side ? -7 : 0, y - 15, 6.5);
      if (!back && !side && style !== 'curly') {
        g.fillTriangle(-9, y - 7, -1, y - 7, -6, y - 2);
        g.fillTriangle(0, y - 7, 8, y - 7, 4, y - 3);
      }
      if (!back && style !== 'curly') {
        g.lineStyle(1, line, 0.8);
        if (side) g.strokeEllipse(-1, y - 7, 27, 15);
        else g.strokeEllipse(0, y - 7, 28, 16);
      }
      g.fillStyle(0xffffff, 0.15).fillEllipse(-4, y - 10, 9, 3.5); // shine
    } else {
      g.fillStyle(0xffffff, 0.25).fillEllipse(-4, y - 8, 7, 3);
    }

    // hats
    if (L.outfit === 'chef') {
      g.fillStyle(0xffffff);
      g.fillCircle(-6, y - 21, 7).fillCircle(6, y - 21, 7).fillCircle(0, y - 25, 8);
      g.fillRoundedRect(-10, y - 18, 20, 8, 2);
      g.lineStyle(1, 0xced4da).strokeRoundedRect(-10, y - 18, 20, 8, 2);
    } else if (L.outfit === 'cashier') {
      const cap = this.uniform.cap;
      g.fillStyle(cap).fillEllipse(0, y - 7, 28, 15);
      g.fillStyle(shade(cap, 0.75));
      if (side) g.fillEllipse(11, y - 5, 15, 5);
      else if (!back) g.fillEllipse(0, y - 1, 24, 6);
      g.fillStyle(0xffffff).fillCircle(0, y - 12, 1.5);
    }
  }

  drawArms() {
    const L = this.look, U = this.uniform;
    const sleeve = L.shirt;
    const hand = U.gloves || L.skin;
    const draw = (g) => {
      g.clear();
      g.fillStyle(sleeve).fillRoundedRect(-3, -1, 6, U.longSleeves ? 14 : 8, 3);
      if (!U.longSleeves) g.fillStyle(L.skin).fillRoundedRect(-2.5, 6, 5, 8, 2);
      g.lineStyle(1.2, shade(sleeve, 0.55)).strokeRoundedRect(-3, -1, 6, U.longSleeves ? 14 : 8, 3);
      g.fillStyle(hand).fillCircle(0, 15, 3.4);
      g.lineStyle(1, shade(hand, 0.65)).strokeCircle(0, 15, 3.4);
    };
    draw(this.armL);
    draw(this.armR);
    if (this.side) {
      this.armL.setVisible(false);
      this.armR.setPosition(1, -35);
    } else {
      this.armL.setVisible(true).setPosition(-14, -36);
      this.armR.setPosition(14, -36);
    }
  }

  drawMarker() {
    const g = this.markerGfx;
    g.clear();
    if (this.look.marker === null) return;
    const top = this.topY - 16;
    g.fillStyle(0x000000, 0.25).fillTriangle(-7, top + 2, 9, top + 2, 1, top + 12);
    g.fillStyle(this.look.marker).fillTriangle(-8, top, 8, top, 0, top + 10);
    g.lineStyle(2, 0xffffff).strokeTriangle(-8, top, 8, top, 0, top + 10);
  }

  // ---------- Carrying ----------

  // Reading the menu (customers do this before ordering).
  setReading(on) {
    this.reading = on;
    this.setFacing(this.facing);
    this.placeMenu();
  }

  // Without menu-reading pictures, a small menu card is simply held in front.
  placeMenu() {
    const show = !!this.reading && !this.menuPictured && this.facing !== 'up';
    if (show && !this.menuCard) {
      this.menuCard = makeMenuCard(this.scene, 0, 0, 13);
      this.body.add(this.menuCard);
    }
    if (!this.menuCard) return;
    const f = this.sizeFactor || 1;
    this.menuCard.setVisible(show).setPosition((this.side ? 9 : 0) * f, (this.sprite ? -26 : -22) * f);
  }

  // Change into another outfit: a different set of pictures (same poses).
  wear(name) {
    if (!this.scene.textures.exists(`${name}_front`)) return;
    this.sprite = name;
    this.setFacing(this.facing);
  }

  // Carry dishes: a list of menu item ids (an empty list, or null, empties the hands).
  hold(items) {
    this.held = !items ? [] : Array.isArray(items) ? items : [items];
    for (const dish of this.heldDishes) dish.destroy();
    // smaller on a carrying picture's tray, so the dishes don't hide the face
    const size = this.sprite && this.scene.textures.exists(`${this.sprite}_carry_front`) ? 0.5 : 0.62;
    this.heldDishes = this.held.map(id => makeFood(this.scene, id, 0, 0, size));
    this.body.add(this.heldDishes);
    this.setFacing(this.facing); // switch to/from the carrying picture, and place the dishes
  }

  // Which carrying picture set to use for what's in the hands ('' = none):
  // <name>_carry2_* for two dishes, else <name>_carry_* (a tray).
  get carryPose() {
    if (!this.sprite || !this.held.length) return '';
    const has = pose => this.scene.textures.exists(`${this.sprite}_${pose}front`);
    if (this.held.length > 1 && has('carry2_')) return 'carry2_';
    return has('carry_') ? 'carry_' : '';
  }

  // Where the dishes sit: on the tray / plates of a carrying picture, or
  // simply in front of the chest otherwise.
  placeHeld() {
    const n = this.heldDishes.length, pose = this.carryPose;
    this.heldDishes.forEach((dish, i) => {
      const k = n === 1 ? 0 : (i % 2 ? 1 : -1); // left / right; a single dish sits in the middle
      const up = Math.floor(i / 2);              // a third and fourth dish ride above the first two
      let x, y;
      if (pose === 'carry2_') {
        // one dish on each plate: out to the sides (front/back), or the two
        // plates held one above the other in front (side view)
        [x, y] = this.side ? (k < 0 ? [11, -44 - up * 22] : [9, -33 - up * 22]) : [k * 19, -47 - up * 12];
      } else if (pose === 'carry_') {
        [x, y] = this.side ? [13 + k * 4, -37 - k * 2 - up * 10] : [k * 7, -35 - up * 10];
      } else {
        [x, y] = this.side ? [11 + k * 5, -26 - k * 2 - up * 10] : [k * 9, -24 - up * 10];
      }
      // the hands of a taller or shorter person are further from / nearer to the feet
      if (pose) { x *= this.sizeFactor; y *= this.sizeFactor; }
      // from behind, dishes are hidden by the body - except on plates held out to the sides
      dish.setPosition(x, y).setVisible(this.facing !== 'up' || pose === 'carry2_');
    });
  }

  // ---------- Animation ----------

  update(time, delta) {
    if (!this.sprite && time > this.nextBlink) {
      this.blinking = !this.blinking;
      this.nextBlink = time + (this.blinking ? 130 : 2500 + Math.random() * 3000);
      this.drawFace();
    }

    const carrying = this.held.length > 0;
    let swing = 0;
    if (this.walking) {
      this.phase += delta * 0.016;
      const s = Math.sin(this.phase);
      this.legL.y = -Math.max(0, s) * 4;
      this.legR.y = -Math.max(0, -s) * 4;
      this.body.y = -Math.abs(s) * 2;
      swing = s * 0.45;
    } else if (!this.sitting) {
      this.legL.y = this.legR.y = 0;
      this.body.y = Math.sin(time * 0.003 + this.seed) * 0.8; // idle breathing
    }
    if (this.working && !this.walking) swing = Math.sin(time * 0.02 + this.seed) * 0.35;

    if (this.sprite) {
      // pictures can't swing their arms, so the whole body sways a little instead
      this.spriteImg.rotation = this.walking ? swing * 0.15 : this.working ? swing * 0.12 : 0;
    } else if (carrying) {
      // arms held out in front, holding the food
      if (this.side) this.armR.rotation = -1.25;
      else { this.armL.rotation = -0.75; this.armR.rotation = 0.75; }
    } else if (this.side) {
      this.armR.rotation = swing;
    } else {
      this.armL.rotation = swing;
      this.armR.rotation = -swing;
    }

    this.root.setDepth(this.root.y);
    this.bubble.setPosition(this.root.x, this.root.y + this.body.y + this.topY - 4);
  }

  // Walk through a list of [x, y] tile points. Returns a promise.
  async walk(path, speed = 110) {
    this.stand();
    this.walking = true;
    for (const [tx, ty] of path) {
      const x = tx * this.T, y = ty * this.T;
      const dx = x - this.root.x, dy = y - this.root.y;
      const dist = Math.hypot(dx, dy);
      if (!dist) continue;
      this.setFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      await new Promise(done => this.scene.tweens.add({
        targets: this.root, x, y, duration: (dist / speed) * 1000, onComplete: done,
      }));
    }
    this.walking = false;
  }

  // Sit down facing a direction. `bodyY` moves the body up (negative) or down
  // so the person sits on top of a taller or lower seat.
  sit(facing, bodyY = 5) {
    this.sitting = true;
    this.setFacing(facing);
    this.legL.setVisible(false);
    this.legR.setVisible(false);
    // no sitting picture: the cut-off standing picture rests on the seat instead of floating above it
    this.body.y = !this.sprite ? bodyY : this.sitCropped ? CROPPED_BODY_Y : SIT_BODY_Y;
  }

  // A seated pixel-art person only shows from the head down to the seat.
  cropForSitting() {
    const img = this.spriteImg;
    img.setCrop(0, 0, img.width, img.height * SITTING_SHOWN);
  }

  stand() {
    this.sitting = false;
    this.legL.setVisible(true);
    this.legR.setVisible(true);
    if (this.sprite) this.setFacing(this.facing); // back to the standing picture
  }

  // Show a speech bubble above the head for `ms` milliseconds.
  say(text, ms) {
    this.bubble.setText(text).setVisible(true);
    return wait(this.scene, ms).then(() => this.bubble.setVisible(false));
  }

  destroy() {
    this.scene.events.off('update', this.update, this);
    this.root.destroy();
    this.bubble.destroy();
  }
}

function wait(scene, ms) {
  return new Promise(done => scene.time.delayedCall(ms, done));
}
