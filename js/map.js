// =============================================
//  TOTAL ANNIHILATION: REBORN — Map
// =============================================
import { TILE_SIZE, MAP_W, MAP_H, TERRAIN, TERRAIN_COLOR, TERRAIN_WALKABLE, TERRAIN_BUILDABLE } from './constants.js';
import { RNG, generateNoiseMap } from './utils.js';

export class GameMap {
  constructor(seed = 42) {
    this.width  = MAP_W;
    this.height = MAP_H;
    this.tiles  = new Uint8Array(MAP_W * MAP_H);
    this._metalDeposits = new Set();
    this._geoVents      = new Set();
    this._generate(seed);
    this._buildCanvas();
  }

  // ---- Index helpers ----
  idx(tx, ty)     { return ty * this.width + tx; }
  inBounds(tx,ty) { return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height; }

  tileAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return TERRAIN.ROCK;
    return this.tiles[this.idx(tx, ty)];
  }

  setTile(tx, ty, t) {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[this.idx(tx, ty)] = t;
    this._dirty = true;
  }

  isWalkable(tx, ty, isHover = false) {
    const t = this.tileAt(tx, ty);
    if (isHover && t === TERRAIN.WATER) return true;
    return TERRAIN_WALKABLE[t] ?? false;
  }
  isBuildable(tx, ty) { return TERRAIN_BUILDABLE[this.tileAt(tx, ty)] ?? false; }
  hasMetal(tx, ty)    { return this._metalDeposits.has(this.idx(tx, ty)); }
  hasGeo(tx, ty)      { return this._geoVents.has(this.idx(tx, ty)); }

  canPlace(tx, ty, tw, th, requiresMetal = false, requiresGeo = false) {
    for (let dy = 0; dy < th; dy++) {
      for (let dx = 0; dx < tw; dx++) {
        if (!this.isBuildable(tx + dx, ty + dy)) return false;
      }
    }
    if (requiresMetal) {
      for (let dy = 0; dy < th; dy++)
        for (let dx = 0; dx < tw; dx++)
          if (this.hasMetal(tx + dx, ty + dy)) return true;
      return false;
    }
    if (requiresGeo) {
      for (let dy = 0; dy < th; dy++)
        for (let dx = 0; dx < tw; dx++)
          if (this.hasGeo(tx + dx, ty + dy)) return true;
      return false;
    }
    return true;
  }

  // ---- Map Generation ----
  _generate(seed) {
    const rng       = new RNG(seed);
    const elevation = generateNoiseMap(this.width, this.height, rng, 0.7);
    const moisture  = generateNoiseMap(this.width, this.height, new RNG(seed ^ 0xdeadbeef), 0.5);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const e = elevation[y * this.width + x];
        const m = moisture [y * this.width + x];
        let tile;
        if      (e < 0.28)              tile = TERRAIN.WATER;
        else if (e < 0.38)              tile = TERRAIN.SAND;
        else if (e > 0.75 && m < 0.4)  tile = TERRAIN.ROCK;
        else                            tile = TERRAIN.GRASS;
        this.tiles[this.idx(x, y)] = tile;
      }
    }

    // Metal deposits
    const metalCount = 26 + rng.int(0, 8);
    for (let attempt = 0; attempt < metalCount * 25 && this._metalDeposits.size < metalCount; attempt++) {
      const tx = rng.int(3, this.width  - 4);
      const ty = rng.int(3, this.height - 4);
      if (this.tileAt(tx, ty) === TERRAIN.GRASS) {
        this.tiles[this.idx(tx, ty)] = TERRAIN.METAL;
        this._metalDeposits.add(this.idx(tx, ty));
        if (rng.next() < 0.5) {
          for (const [dx,dy] of [[ 1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = tx+dx, ny = ty+dy;
            if (this.inBounds(nx,ny) && this.tileAt(nx,ny) === TERRAIN.GRASS) {
              this.tiles[this.idx(nx,ny)] = TERRAIN.METAL;
              this._metalDeposits.add(this.idx(nx,ny));
              break;
            }
          }
        }
      }
    }

    // Geothermal vents (scattered, fewer)
    const geoCount = 6 + rng.int(0, 4);
    for (let attempt = 0; attempt < geoCount * 30 && this._geoVents.size < geoCount; attempt++) {
      const tx = rng.int(5, this.width  - 6);
      const ty = rng.int(5, this.height - 6);
      if (this.tileAt(tx, ty) === TERRAIN.GRASS || this.tileAt(tx, ty) === TERRAIN.SAND) {
        // Don't place near metal or other geo vents
        let tooClose = false;
        for (const g of this._geoVents) {
          const gx = g % this.width, gy = Math.floor(g / this.width);
          if (Math.abs(gx - tx) < 8 && Math.abs(gy - ty) < 8) { tooClose = true; break; }
        }
        if (!tooClose) {
          this.tiles[this.idx(tx, ty)] = TERRAIN.GEOTHERMAL;
          this._geoVents.add(this.idx(tx, ty));
        }
      }
    }

    // Clear starting areas (top-left and bottom-right corners)
    const starts = [
      { cx: 5,  cy: 5  },
      { cx: this.width - 6,  cy: this.height - 6 },
    ];
    for (const { cx, cy } of starts) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const tx = cx + dx, ty = cy + dy;
          if (this.inBounds(tx, ty)) {
            const t = this.tiles[this.idx(tx, ty)];
            if (t !== TERRAIN.METAL && t !== TERRAIN.GEOTHERMAL)
              this.tiles[this.idx(tx, ty)] = TERRAIN.GRASS;
          }
        }
      }
    }
  }

  tileCenterPx(tx, ty) {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }

  nearestMetal(wx, wy) {
    let best = null, bestD = Infinity;
    for (const flat of this._metalDeposits) {
      const tx = flat % this.width, ty = Math.floor(flat / this.width);
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;
      const d  = (px - wx) ** 2 + (py - wy) ** 2;
      if (d < bestD) { bestD = d; best = { tx, ty, px, py }; }
    }
    return best;
  }

  get metalDeposits() {
    return [...this._metalDeposits].map(flat => {
      const tx = flat % this.width, ty = Math.floor(flat / this.width);
      return { tx, ty, px: tx*TILE_SIZE+TILE_SIZE/2, py: ty*TILE_SIZE+TILE_SIZE/2 };
    });
  }

  get geoVents() {
    return [...this._geoVents].map(flat => {
      const tx = flat % this.width, ty = Math.floor(flat / this.width);
      return { tx, ty, px: tx*TILE_SIZE+TILE_SIZE/2, py: ty*TILE_SIZE+TILE_SIZE/2 };
    });
  }

  // ---- Offscreen Canvas Cache ----
  _buildCanvas() {
    this._canvas = document.createElement('canvas');
    this._canvas.width  = this.width  * TILE_SIZE;
    this._canvas.height = this.height * TILE_SIZE;
    this._ctx   = this._canvas.getContext('2d');
    this._dirty = true;
    this._redraw();
  }

  _redraw() {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t  = this.tiles[this.idx(x, y)];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        ctx.fillStyle = TERRAIN_COLOR[t];
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        if (t === TERRAIN.GRASS) {
          // Subtle grid line
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(px, py, 1, TILE_SIZE);
          ctx.fillRect(px, py, TILE_SIZE, 1);
          // Grass tufts
          const h = ((x * 7 + y * 13) % 5);
          if (h < 2) {
            ctx.fillStyle = 'rgba(50,80,30,0.3)';
            ctx.fillRect(px + (x*3%24)+4, py + (y*5%24)+4, 2, 3);
          }
        } else if (t === TERRAIN.ROCK) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE-4, TILE_SIZE-4);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(px, py, 2, 2);
          ctx.fillRect(px + TILE_SIZE-2, py + TILE_SIZE-2, 2, 2);
        } else if (t === TERRAIN.WATER) {
          // Wave pattern
          ctx.fillStyle = 'rgba(100,200,255,0.06)';
          const wx = (x + y) % 3;
          ctx.fillRect(px + wx*8, py + TILE_SIZE/2 - 1, TILE_SIZE/3, 2);
        } else if (t === TERRAIN.SAND) {
          ctx.fillStyle = 'rgba(200,180,100,0.12)';
          ctx.fillRect(px, py, TILE_SIZE/2, TILE_SIZE/2);
        } else if (t === TERRAIN.METAL) {
          // Metal deposit — concentric circles
          const cx = px + TILE_SIZE/2, cy = py + TILE_SIZE/2;
          ctx.strokeStyle = 'rgba(140,160,180,0.6)';
          ctx.lineWidth = 1;
          for (const r of [TILE_SIZE*0.35, TILE_SIZE*0.22, TILE_SIZE*0.1]) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI*2);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(140,160,180,0.2)';
          ctx.beginPath();
          ctx.arc(cx, cy, TILE_SIZE*0.35, 0, Math.PI*2);
          ctx.fill();
        } else if (t === TERRAIN.GEOTHERMAL) {
          // Geothermal vent — glowing orange crack
          const cx = px + TILE_SIZE/2, cy = py + TILE_SIZE/2;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE_SIZE*0.45);
          grad.addColorStop(0, 'rgba(255,120,20,0.5)');
          grad.addColorStop(0.5, 'rgba(180,60,0,0.3)');
          grad.addColorStop(1, 'rgba(50,20,0,0)');
          ctx.beginPath();
          ctx.arc(cx, cy, TILE_SIZE*0.45, 0, Math.PI*2);
          ctx.fillStyle = grad;
          ctx.fill();
          // Cracks
          ctx.strokeStyle = 'rgba(255,150,50,0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy - TILE_SIZE*0.3);
          ctx.lineTo(cx + TILE_SIZE*0.1, cy);
          ctx.lineTo(cx - TILE_SIZE*0.15, cy + TILE_SIZE*0.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + TILE_SIZE*0.2, cy - TILE_SIZE*0.1);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + TILE_SIZE*0.1, cy + TILE_SIZE*0.25);
          ctx.stroke();
        }
      }
    }
    this._dirty = false;
  }

  draw(ctx, camX, camY) {
    if (this._dirty) this._redraw();
    ctx.drawImage(this._canvas, -camX, -camY);
  }

  drawMini(ctx, w, h) {
    ctx.drawImage(this._canvas, 0, 0, w, h);
  }
}
