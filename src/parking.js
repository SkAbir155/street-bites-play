// The car park on the right of the map. Cars are decoration: every so often
// one drives in from the road and parks, or a parked one backs out and drives
// away. Only one car moves at a time, so they never bump into each other.
// Nobody can walk here (see `restricted` in the layout).

const CAR_STYLES = [
  { name: 'sedan', length: 100, width: 50, roof: 30 },
  { name: 'hatch', length: 86,  width: 48, roof: 34 },
  { name: 'van',   length: 112, width: 54, roof: 58 },
];
const CAR_COLORS = [0xe63946, 0x1d3557, 0xf4a261, 0x2a9d8f, 0xf1faee, 0x6c757d, 0xffd166, 0x9b5de5, 0x222222, 0x3a86ff];
const CAR_SPEED = 110;     // px per second
const CAR_TURN_TIME = 420; // ms for a 90° turn

// Draws a car seen from above, pointing up, centred on (0, 0).
function drawCar(g, style, color) {
  const hl = style.length / 2, hw = style.width / 2, W = style.width;
  g.fillStyle(0x000000, 0.28).fillRoundedRect(-hw + 4, -hl + 7, W, style.length, 12);
  g.fillStyle(0x1b1b1b);
  for (const y of [-hl + 14, hl - 30]) {
    g.fillRoundedRect(-hw - 3, y, 7, 17, 3);
    g.fillRoundedRect(hw - 4, y, 7, 17, 3);
  }
  g.fillStyle(shade(color, 0.75)).fillRoundedRect(-hw, -hl, W, style.length, 12);
  g.fillStyle(color).fillRoundedRect(-hw + 2, -hl + 1, W - 4, style.length - 4, 11);
  g.fillStyle(0xffffff, 0.2).fillRoundedRect(-hw + 5, -hl + 6, 5, style.length - 16, 2);

  const front = -hl + (style.name === 'van' ? 14 : 22);
  g.fillStyle(0x2b3a4a).fillPoints([
    { x: -hw + 9, y: front }, { x: hw - 9, y: front }, { x: hw - 6, y: front + 14 }, { x: -hw + 6, y: front + 14 },
  ], true);
  g.fillStyle(0x8ecae6, 0.35).fillTriangle(-hw + 10, front + 12, -hw + 16, front + 2, -hw + 20, front + 2);
  g.fillStyle(shade(color, 1.1)).fillRoundedRect(-hw + 7, front + 15, W - 14, style.roof, 6);
  g.fillStyle(0x2b3a4a).fillRoundedRect(-hw + 8, front + 16 + style.roof, W - 16, 10, 3);
  g.fillStyle(shade(color, 0.75)).fillRoundedRect(-hw - 4, front + 11, 5, 5, 2).fillRoundedRect(hw - 1, front + 11, 5, 5, 2);
  g.fillStyle(0xfff3b0).fillRoundedRect(-hw + 5, -hl + 2, 10, 5, 2).fillRoundedRect(hw - 15, -hl + 2, 10, 5, 2);
  g.fillStyle(0xd00000).fillRoundedRect(-hw + 5, hl - 7, 9, 4, 2).fillRoundedRect(hw - 14, hl - 7, 9, 4, 2);
}

class ParkingLot {
  constructor(scene, layout) {
    this.scene = scene;
    this.T = layout.tileSize;
    this.W = layout.width;
    this.P = layout.parking;
    this.spots = this.P.spots.map(s => ({ ...s, car: null }));
    this.cars = [];

    for (const spot of this.spots) {
      if (Math.random() < 0.65) spot.car = this.makeCar(spot.x, spot.y, spot.row === 1 ? 0 : 180);
    }
    scene.events.on('update', this.update, this);
    this.run();
  }

  makeCar(tx, ty, angle) {
    const pick = Phaser.Utils.Array.GetRandom;
    const style = pick(CAR_STYLES), color = pick(CAR_COLORS), key = `car_${style.name}`;
    let body;
    if (this.scene.textures.exists(key)) {
      // the picture is a white car; tinting it gives it this car's colour
      const shadow = this.scene.add.graphics();
      shadow.fillStyle(0x000000, 0.28).fillRoundedRect(-style.width / 2 + 4, -style.length / 2 + 7, style.width, style.length, 12);
      const img = this.scene.add.image(0, 0, key).setTint(color);
      img.setScale(style.length / img.height);
      body = [shadow, img];
    } else {
      const g = this.scene.add.graphics();
      drawCar(g, style, color);
      body = [g];
    }
    const car = this.scene.add.container(tx * this.T, ty * this.T, body).setAngle(angle);
    car.halfLength = style.length / 2;
    this.cars.push(car);
    return car;
  }

  // Every few seconds, one car leaves or a new one arrives.
  async run() {
    const pick = Phaser.Utils.Array.GetRandom;
    for (;;) {
      await wait(this.scene, Phaser.Math.Between(6000, 12000));
      const parked = this.spots.filter(s => s.car), free = this.spots.filter(s => !s.car);
      if (parked.length && (!free.length || Math.random() < 0.5)) await this.depart(pick(parked));
      else if (free.length) await this.arrive(pick(free));
    }
  }

  drive(car, tx, ty, speed = CAR_SPEED) {
    const x = tx * this.T, y = ty * this.T;
    const dist = Math.hypot(x - car.x, y - car.y);
    return new Promise(done => this.scene.tweens.add({
      targets: car, x, y, duration: (dist / speed) * 1000, ease: 'Sine.easeInOut', onComplete: done,
    }));
  }

  // Turn to face a direction in degrees (0 up, 90 right, 180 down, -90 left),
  // the short way round.
  turn(car, angle) {
    const end = car.angle + Phaser.Math.Angle.ShortestBetween(car.angle, angle);
    return new Promise(done => this.scene.tweens.add({
      targets: car, angle: end, duration: CAR_TURN_TIME, ease: 'Sine.easeInOut', onComplete: done,
    }));
  }

  async arrive(spot) {
    const P = this.P;
    const car = this.makeCar(this.W + 2, P.roadInY, -90);
    spot.car = car;
    await this.drive(car, P.laneX, P.roadInY);
    await this.turn(car, 0);
    await this.drive(car, P.laneX, P.aisleY);
    await this.turn(car, -90);
    await this.drive(car, spot.x, P.aisleY);
    await this.turn(car, spot.row === 1 ? 0 : 180);
    await this.drive(car, spot.x, spot.y, CAR_SPEED * 0.6);
  }

  async depart(spot) {
    const P = this.P, car = spot.car;
    spot.car = null;
    await this.drive(car, spot.x, P.aisleY, CAR_SPEED * 0.5); // reverse out
    await this.turn(car, 90);
    await this.drive(car, P.laneX, P.aisleY);
    await this.turn(car, 180);
    await this.drive(car, P.laneX, P.roadOutY);
    await this.turn(car, 90);
    await this.drive(car, this.W + 2, P.roadOutY);
    Phaser.Utils.Array.Remove(this.cars, car);
    car.destroy();
  }

  // Cars are drawn in front of things above their front/back bumper.
  update() {
    for (const car of this.cars) {
      car.setDepth(car.y + Math.abs(Math.cos(car.rotation)) * car.halfLength + 8);
    }
  }
}
