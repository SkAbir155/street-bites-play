// Entry point: shows the restaurant and lets you play as the waiter.
// The game always fills the whole screen, whatever the phone's shape, and
// draws at the screen's real resolution (capped at 2x for speed).

const LAYOUT = GameData.layouts.streetStall;
const WORLD_W = LAYOUT.width * LAYOUT.tileSize;
const WORLD_H = LAYOUT.height * LAYOUT.tileSize;
const CLOSE_UP_ZOOM = 2.2; // how much closer than "whole map height fits the screen"
const MAX_PIXEL_RATIO = 2;
const CAMERA_CATCH_UP = 8;  // how quickly the close-up camera catches up with the player
const WAITER_SPEED = 160;   // px per second, before any running shoes

// Real time since the last frame in ms, capped so a pause (screen off,
// app switched) can't make things jump. The cap is high enough that a slow
// phone (down to 10 frames a second) still moves at full speed.
function frameTime(game) {
  return Math.min(game.loop.rawDelta || 16, 100);
}

// Loads every picture while the studio logo is on screen, then hands over to
// the main menu (see screens.js). The restaurant itself starts from the menu.
class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    if (!Screens.root) Screens.init(this.game);
    // (the build number makes a browser fetch fresh pictures after an update)
    const version = window.BUILD && window.BUILD !== 'dev' ? `?v=${window.BUILD}` : '';
    for (const [key, file] of Object.entries(ART_FILES)) this.load.image(key, file + version);
    this.load.on('progress', value => Screens.progress(value));
  }

  create() {
    // Pixel art stays crisp and blocky when zoomed instead of going blurry.
    for (const key of Object.keys(ART_FILES)) {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    Screens.assetsLoaded();
  }
}

class RestaurantScene extends Phaser.Scene {
  constructor() {
    super('Restaurant');
  }

  create() {
    // The saved game decides what the restaurant has: the furniture placed in
    // its slots, the kitchen's upgrades, the waiter's outfit and shoes.
    const save = SaveGame.current(), owned = new Set(save.owned);
    const bought = thing => !thing.buy || owned.has(thing.buy);
    LAYOUT.base = LAYOUT.base || { objects: LAYOUT.objects, lights: LAYOUT.lights };
    const placed = Furniture.build(LAYOUT, save.placed);
    LAYOUT.objects = [...LAYOUT.base.objects.filter(bought), ...placed.objects];
    LAYOUT.lights = [...LAYOUT.base.lights.filter(bought), ...placed.lights];
    LAYOUT.wallClocks = placed.wallClocks;
    LAYOUT.levels = Perks.levels(owned); // how far the kitchen has been upgraded
    LAYOUT.menu = Perks.dishes(owned);   // the dishes written on the menu board
    this.view = new RestaurantView(this, LAYOUT);
    this.view.draw();
    this.view.zoneLayer.setVisible(false);

    this.player = new Person(this, LAYOUT.tileSize, {
      x: 10.9, y: 5.0, facing: 'left', outfit: 'waiter', hair: 0x111111, hairStyle: 'short',
      marker: 0xffd166, sprite: WAITER_OUTFITS.includes(save.outfit) ? save.outfit : 'waiter',
    });
    this.controller = new PlayerController(this, this.player, LAYOUT, WAITER_SPEED * Perks.walkSpeed(owned));
    this.sim = new RestaurantSim(this, LAYOUT, this.player);
    this.parking = new ParkingLot(this, LAYOUT);
    this.daylight = new DayLight(this, LAYOUT, this.sim);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.roundPixels = false; // glide between pixels instead of snapping
    // Opening the page with ?view=map starts on the whole-map view.
    this.closeUp = new URLSearchParams(location.search).get('view') !== 'map';
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.scene.launch('UI');
  }

  setCloseUp(on) {
    this.closeUp = on;
    this.fitCamera();
  }

  // Close-up follows the player; whole map zooms until the screen is filled.
  fitCamera() {
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    cam.setSize(width, height);
    if (this.closeUp) {
      cam.setZoom((height / WORLD_H) * CLOSE_UP_ZOOM);
      this.followPlayer(true);
    } else {
      cam.setZoom(Math.max(width / WORLD_W, height / WORLD_H));
      cam.centerOn(WORLD_W / 2, WORLD_H / 2);
    }
  }

  // Smoothly move the camera towards the player, at the same speed whatever
  // the frame rate. `snap` jumps straight there.
  followPlayer(snap = false) {
    const cam = this.cameras.main, p = this.player.root;
    const targetX = cam.clampX(p.x - cam.width / 2);
    const targetY = cam.clampY(p.y - 24 - cam.height / 2);
    const k = snap ? 1 : 1 - Math.exp((-CAMERA_CATCH_UP * frameTime(this.game)) / 1000);
    cam.setScroll(cam.scrollX + (targetX - cam.scrollX) * k, cam.scrollY + (targetY - cam.scrollY) * k);
  }

  // Runs after the player has moved this frame.
  update() {
    if (this.closeUp) this.followPlayer();
  }
}

function screenSize() {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  return { w: Math.round(window.innerWidth * ratio), h: Math.round(window.innerHeight * ratio), ratio };
}

const startSize = screenSize();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1f24',
  width: startSize.w,
  height: startSize.h,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / startSize.ratio },
  fps: { smoothStep: false },
  scene: [BootScene, RestaurantScene, UIScene], // only the first starts by itself
});
Screens.init(game);

window.addEventListener('resize', () => {
  const s = screenSize();
  game.scale.resize(s.w, s.h);
  game.scale.setZoom(1 / s.ratio);
});

// Shared joystick direction, written by the UI scene and read by the player.
game.controls = { x: 0, y: 0 };

// Sound effects: game.sfx.play('coin')
game.sfx = new Sfx(game);
