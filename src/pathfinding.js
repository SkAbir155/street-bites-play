// Finds walking routes around furniture. The floor is split into small
// square cells; A* search finds a chain of open cells, which is then
// straightened so people walk in natural lines instead of zig-zags.

class PathFinder {
  constructor(canStand, width, height, cell = 10) {
    this.canStand = canStand;
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.open = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.open[r * this.cols + c] = canStand(c * cell + cell / 2, r * cell + cell / 2) ? 1 : 0;
      }
    }
  }

  // Closes off every open cell that can't be walked to from `home` (px), such
  // as a small gap boxed in by furniture. Routes then never aim for a spot
  // nobody can get to.
  keepReachableFrom(home) {
    const cols = this.cols, reached = new Uint8Array(this.open.length);
    const [hc, hr] = this.nearestOpen(...this.cellOf(home));
    const todo = [[hc, hr]];
    reached[hr * cols + hc] = 1;
    while (todo.length) {
      const [c, r] = todo.pop();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc, nr = r + dr;
          if ((!dc && !dr) || !this.walkable(nc, nr) || reached[nr * cols + nc]) continue;
          if (dc && dr && (!this.walkable(c + dc, r) || !this.walkable(c, r + dr))) continue; // no cutting corners
          reached[nr * cols + nc] = 1;
          todo.push([nc, nr]);
        }
      }
    }
    this.open = reached;
  }

  walkable(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.open[r * this.cols + c] === 1;
  }

  cellOf([x, y]) {
    return [Math.floor(x / this.cell), Math.floor(y / this.cell)];
  }

  center(c, r) {
    return [c * this.cell + this.cell / 2, r * this.cell + this.cell / 2];
  }

  // Closest open cell to (c, r), searching outwards in rings.
  nearestOpen(c, r) {
    if (this.walkable(c, r)) return [c, r];
    for (let d = 1; d < 24; d++) {
      let best = null, bestDist = Infinity;
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== d || !this.walkable(c + dc, r + dr)) continue;
          const dist = dc * dc + dr * dr;
          if (dist < bestDist) { best = [c + dc, r + dr]; bestDist = dist; }
        }
      }
      if (best) return best;
    }
    return [c, r];
  }

  // True if a person can walk straight from a to b without their feet
  // touching anything (checked every few pixels, not just per grid cell, so
  // a shortcut never clips the corner of a table or stool).
  lineClear(a, b) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      if (!this.canStand(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
    }
    return true;
  }

  // Returns a list of [x, y] px points to walk through, ending exactly at `to`.
  find(from, to) {
    const [sc, sr] = this.nearestOpen(...this.cellOf(from));
    const [gc, gr] = this.nearestOpen(...this.cellOf(to));
    const cells = this.search(sc, sr, gc, gr);
    if (!cells) return [to];

    // Straighten: from each point, jump to the farthest point in plain sight.
    const pts = [from, ...cells.map(([c, r]) => this.center(c, r)), to];
    const out = [];
    for (let i = 0; i < pts.length - 1;) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineClear(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  // A* search over the grid (8 directions, no cutting corners).
  search(sc, sr, gc, gr) {
    const cols = this.cols, n = cols * this.rows;
    const g = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const start = sr * cols + sc, goal = gr * cols + gc;
    const h = (c, r) => {
      const dx = Math.abs(c - gc), dy = Math.abs(r - gr);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    g[start] = 0;
    const open = [[start, h(sc, sr)]];

    while (open.length) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i][1] < open[best][1]) best = i;
      const [cur] = open.splice(best, 1)[0];
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const c = cur % cols, r = (cur - c) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = c + dc, nr = r + dr;
          if (!this.walkable(nc, nr)) continue;
          if (dc && dr && (!this.walkable(c + dc, r) || !this.walkable(c, r + dr))) continue;
          const next = nr * cols + nc;
          const cost = g[cur] + (dc && dr ? 1.414 : 1);
          if (cost < g[next]) {
            g[next] = cost;
            came[next] = cur;
            open.push([next, cost + h(nc, nr)]);
          }
        }
      }
    }

    if (start !== goal && came[goal] < 0) return null;
    const cells = [];
    for (let cur = goal; cur !== start; cur = came[cur]) cells.push([cur % cols, Math.floor(cur / cols)]);
    return cells.reverse();
  }
}
