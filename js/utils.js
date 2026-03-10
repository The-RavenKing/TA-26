// =============================================
//  TOTAL ANNIHILATION: REBORN — Utilities
// =============================================

/** Euclidean distance between two points */
export function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Squared distance (faster, no sqrt) */
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

/** Angle from a→b in radians */
export function angle(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Clamp value between lo and hi */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolation */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Random integer in [lo, hi] inclusive */
export function randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Random float in [lo, hi) */
export function randFloat(lo, hi) {
  return Math.random() * (hi - lo) + lo;
}

/** Convert world coords to tile coords */
export function worldToTile(wx, wy, tileSize) {
  return {
    tx: Math.floor(wx / tileSize),
    ty: Math.floor(wy / tileSize),
  };
}

/** Center of a tile in world coords */
export function tileCenter(tx, ty, tileSize) {
  return {
    x: tx * tileSize + tileSize / 2,
    y: ty * tileSize + tileSize / 2,
  };
}

/** Simple seeded LCG pseudo-random number generator */
export class RNG {
  constructor(seed) {
    this.s = seed | 0;
  }
  next() {
    this.s = (Math.imul(1664525, this.s) + 1013904223) | 0;
    return (this.s >>> 0) / 0x100000000;
  }
  int(lo, hi) {
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }
  float(lo, hi) {
    return this.next() * (hi - lo) + lo;
  }
}

/** Generate simple noise map using midpoint displacement */
export function generateNoiseMap(w, h, rng, roughness = 0.6) {
  const size = Math.max(w, h);
  let step = 1;
  while (step < size) step *= 2;
  step++;

  const buf = new Float32Array((step) * (step));
  const idx = (x, y) => y * step + x;

  // Seed corners
  buf[idx(0,      0     )] = rng.float(0, 1);
  buf[idx(step-1, 0     )] = rng.float(0, 1);
  buf[idx(0,      step-1)] = rng.float(0, 1);
  buf[idx(step-1, step-1)] = rng.float(0, 1);

  let scale = roughness;
  for (let sz = step - 1; sz > 1; sz = Math.floor(sz / 2)) {
    const half = Math.floor(sz / 2);

    // Diamond step
    for (let y = 0; y < step - 1; y += sz) {
      for (let x = 0; x < step - 1; x += sz) {
        const avg = (
          buf[idx(x, y)] + buf[idx(x + sz, y)] +
          buf[idx(x, y + sz)] + buf[idx(x + sz, y + sz)]
        ) / 4;
        buf[idx(x + half, y + half)] = clamp(avg + rng.float(-scale, scale), 0, 1);
      }
    }

    // Square step
    for (let y = 0; y < step; y += half) {
      for (let x = (y + half) % sz; x < step; x += sz) {
        let sum = 0, cnt = 0;
        if (x - half >= 0)    { sum += buf[idx(x - half, y)]; cnt++; }
        if (x + half < step)  { sum += buf[idx(x + half, y)]; cnt++; }
        if (y - half >= 0)    { sum += buf[idx(x, y - half)]; cnt++; }
        if (y + half < step)  { sum += buf[idx(x, y + half)]; cnt++; }
        buf[idx(x, y)] = clamp(sum / cnt + rng.float(-scale, scale), 0, 1);
      }
    }
    scale *= 0.5;
  }

  // Sample to output size
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x * (step - 1) / (w - 1));
      const sy = Math.floor(y * (step - 1) / (h - 1));
      out[y * w + x] = buf[idx(sx, sy)];
    }
  }
  return out;
}

/** Format seconds as MM:SS */
export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/** Simple object pool */
export class Pool {
  constructor(create) {
    this._create = create;
    this._pool   = [];
  }
  get(...args) {
    const obj = this._pool.length ? this._pool.pop() : this._create();
    obj.init?.(...args);
    return obj;
  }
  release(obj) {
    this._pool.push(obj);
  }
}

/** Event emitter (mini) */
export class EventEmitter {
  constructor() { this._listeners = {}; }
  on(ev, fn) {
    (this._listeners[ev] ??= []).push(fn);
    return this;
  }
  off(ev, fn) {
    if (this._listeners[ev])
      this._listeners[ev] = this._listeners[ev].filter(f => f !== fn);
  }
  emit(ev, ...args) {
    (this._listeners[ev] || []).forEach(f => f(...args));
  }
}
