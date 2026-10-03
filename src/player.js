// Lets a player control a Person with the on-screen joystick,
// without walking through furniture.

const STRAIGHT_ZONE = Phaser.Math.DegToRad(30); // how far off an axis still counts as straight

// Snaps a joystick direction to one of 8 directions. Straight directions get a
// wide zone, so "left and a tiny bit down" becomes exactly left.
function snapDirection(x, y) {
  const mag = Math.min(1, Math.hypot(x, y));
  const a = Math.atan2(y, x);
  const axis = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  const snapped = Math.abs(Phaser.Math.Angle.Wrap(a - axis)) <= STRAIGHT_ZONE
    ? axis
    : Math.round((a - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
  const clean = v => (Math.abs(v) < 1e-6 ? 0 : v);
  return { x: clean(Math.cos(snapped) * mag), y: clean(Math.sin(snapped) * mag) };
}

class PlayerController {
  constructor(scene, person, layout, speed = 160) {
    this.scene = scene;
    this.person = person;
    this.speed = speed;
    this.canStand = makeCanStand(layout, 'waiter');
    scene.events.on('update', this.update, this);
  }

  update() {
    // Real time since last frame, so the player never walks in slow motion
    // while the phone warms up or after the screen was switched off.
    const delta = frameTime(this.scene.game);
    const joy = this.scene.game.controls; // joystick direction, each axis -1..1
    const p = this.person;
    p.walking = Math.hypot(joy.x, joy.y) > 0.15;
    if (!p.walking) return;

    const { x, y } = snapDirection(joy.x, joy.y);
    const step = (this.speed * delta) / 1000;
    this.move(x * step, y * step);

    const facing = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
    if (facing !== p.facing) p.setFacing(facing);
  }

  move(dx, dy) {
    const r = this.person.root;
    if (this.canStand(r.x + dx, r.y + dy)) {
      r.x += dx;
      r.y += dy;
      return;
    }

    // Diagonal into something: slide along whichever side is free.
    if (dx && dy) {
      if (this.canStand(r.x + dx, r.y)) r.x += dx;
      else if (this.canStand(r.x, r.y + dy)) r.y += dy;
      return;
    }

    // Straight into the corner of something: step sideways around it,
    // but only if a small sidestep (up to 12px) actually frees the way.
    const step = Math.abs(dx || dy);
    for (let k = 2; k <= 12; k += 2) {
      for (const side of [1, -1]) {
        const ox = dy ? side * k : 0, oy = dx ? side * k : 0;
        const sx = Math.sign(ox) * step, sy = Math.sign(oy) * step;
        if (this.canStand(r.x + ox + dx, r.y + oy + dy) && this.canStand(r.x + sx, r.y + sy)) {
          r.x += sx;
          r.y += sy;
          return;
        }
      }
    }
    // Otherwise stay put: never drift in a direction the player didn't push.
  }
}
