// Day and night: tints the world by the time of day (sunny morning, orange
// evening, dark night). At night everything is dark, indoors too, and each
// lamp makes its own pool of light: table lanterns, the floor lamp, kitchen
// and counter lights, string lights, street lamps. Also runs the wall clock.

// [hour, colour, strength] - the tint over the world, blended between entries.
const DAYLIGHT = [
  [8,    0xffd9a0, 0.10], // warm early morning
  [10.5, 0xffffff, 0.00], // clear daylight
  [16.5, 0xffffff, 0.00],
  [18.5, 0xff9a4a, 0.18], // orange evening
  [20,   0x3a3270, 0.42], // dusk
  [21.5, 0x0d1230, 0.70], // night
  [24,   0x0d1230, 0.74],
];
const LIGHTS_ON = [18, 20.5];  // lamps fade in between these hours
const INDOOR_SOFTEN = 0.08;    // indoors is this much less dark than outdoors (walls keep some light in)

class DayLight {
  constructor(scene, layout, sim) {
    this.scene = scene;
    this.layout = layout;
    this.sim = sim;
    this.T = layout.tileSize;
    const W = layout.width * this.T, H = layout.height * this.T;

    // a soft round spot used to cut pools of light out of the darkness
    if (!scene.textures.exists('lightSpot')) {
      const tex = scene.textures.createCanvas('lightSpot', 128, 128), ctx = tex.getContext();
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      grad.addColorStop(0.65, 'rgba(255,255,255,0.2)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      tex.refresh();
      const px = scene.textures.createCanvas('lightBlock', 8, 8), pctx = px.getContext();
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, 8, 8);
      px.refresh();
    }
    this.spot = scene.make.image({ key: 'lightSpot', add: false });
    this.block = scene.make.image({ key: 'lightBlock', add: false }).setOrigin(0, 0);

    this.dark = scene.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(DEPTH.overhead + 400);
    this.glow = scene.add.graphics().setDepth(DEPTH.overhead + 410).setBlendMode(Phaser.BlendModes.ADD);
    this.clockFace = scene.add.graphics().setDepth(DEPTH.decal + 3);
    this.lights = this.findLights();
    this.drawn = null; // the time (in drawing steps) currently shown
    scene.events.on('update', this.update, this);
  }

  // Every lamp: { x, y (px), r (radius of its pool of light), power (0..1) }.
  findLights() {
    const T = this.T, L = this.layout, lights = [];
    const add = (x, y, r, power = 1) => lights.push({ x, y, r, power });
    for (const l of L.lights || []) add(l.x * T, l.y * T, l.r, l.power);
    for (const o of L.objects) {
      for (const l of o.lanterns || []) add(l.x, l.y, l.r);                                 // candles or lamps on the tables
      if (o.type === 'floorLamp') add((o.x + o.w / 2) * T, (o.y + o.h) * T - 40, 105);
      if (o.type === 'wallLamp') add((o.x + o.w / 2) * T - 18, (o.y + o.h) * T - 8, 95);
      if (o.type === 'lampPost') add((o.x + o.w / 2) * T, (o.y + o.h) * T - 60, 135);
      if (o.type === 'stringLights') {                                                      // a row of small bulbs
        const [[x1, y1], , [x2, y2]] = o.points;
        for (let i = 0; i <= 8; i++) add((x1 + (x2 - x1) * i / 8) * T, (y1 + (y2 - y1) * i / 8) * T + 12, 40, 0.5);
      }
    }
    return lights;
  }

  // The tint at an hour: { color, alpha }.
  tintAt(hour) {
    let i = 1;
    while (i < DAYLIGHT.length - 1 && hour > DAYLIGHT[i][0]) i++;
    const [h1, c1, a1] = DAYLIGHT[i - 1], [h2, c2, a2] = DAYLIGHT[i];
    const t = Phaser.Math.Clamp((hour - h1) / (h2 - h1), 0, 1);
    const from = Phaser.Display.Color.ValueToColor(c1), to = Phaser.Display.Color.ValueToColor(c2);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t * 100);
    return { color: Phaser.Display.Color.GetColor(c.r, c.g, c.b), alpha: a1 + (a2 - a1) * t };
  }

  update() {
    const hour = this.sim.clock;
    const step = Math.round(hour * 30); // redraw every 2 game minutes, not every frame
    if (step === this.drawn) return;
    this.drawn = step;
    this.drawLight(hour);
    this.drawClock(hour);
  }

  drawLight(hour) {
    const T = this.T, L = this.layout;
    const { color, alpha } = this.tintAt(hour);
    const lit = Phaser.Math.Clamp((hour - LIGHTS_ON[0]) / (LIGHTS_ON[1] - LIGHTS_ON[0]), 0, 1); // 0 = lamps off, 1 = fully on

    const dark = this.dark, glow = this.glow;
    dark.clear();
    glow.clear();
    if (alpha <= 0) return;
    dark.fill(color, alpha);
    if (lit <= 0) return;

    // indoors keeps a little more light than the street
    const b = L.indoors;
    // (when erasing with an object, its own alpha sets how much is erased)
    this.block.setDisplaySize(b.w * T, b.h * T).setAlpha(INDOOR_SOFTEN * lit);
    dark.erase(this.block, b.x * T, b.y * T);

    // every lamp cuts a soft pool of light out of the darkness, with a warm glow
    for (const { x, y, r, power } of this.lights) {
      this.spot.setScale(r / 64).setAlpha(lit * power);
      dark.erase(this.spot, x, y);
      for (let k = r * 0.8; k >= 10; k -= r * 0.16) glow.fillStyle(0xffb85c, 0.022 * lit * power).fillCircle(x, y, k);
    }
  }

  // An analogue clock on the dining room wall.
  drawClock(hour) {
    const g = this.clockFace;
    g.clear();
    for (const c of this.layout.wallClocks || []) this.drawOneClock(g, c, hour);
  }

  drawOneClock(g, c, hour) {
    const x = c.x * this.T, y = c.y * this.T, r = 15;
    g.fillStyle(0x000000, 0.25).fillCircle(x + 2, y + 3, r + 3);
    g.fillStyle(0x5e3a20).fillCircle(x, y, r + 3);
    g.fillStyle(0xfdf6e3).fillCircle(x, y, r);
    g.fillStyle(0x5e3a20);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, len = i % 3 === 0 ? 2.2 : 1.2;
      g.fillCircle(x + Math.sin(a) * (r - 3), y - Math.cos(a) * (r - 3), len / 2 + 0.3);
    }
    const hand = (turn, length, width, color) => {
      const a = turn * Math.PI * 2;
      g.lineStyle(width, color).lineBetween(x, y, x + Math.sin(a) * length, y - Math.cos(a) * length);
    };
    hand((hour % 12) / 12, r * 0.5, 2.5, 0x2b2118);  // hour hand
    hand(hour % 1, r * 0.78, 1.6, 0x2b2118);          // minute hand
    g.fillStyle(0xc1121f).fillCircle(x, y, 1.8);
  }
}
