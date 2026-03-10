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
    this._metalDeposits = new Set(); // flat indices of metal tiles
    this._generate(seed);
    this._buildCanvas();
  }

  // ---- Index helpers ----
  idx(tx, ty) { return ty * this.width + tx; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height; }

  tileAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return TERRAIN.ROCK;
    return this.tiles[this.idx(tx, ty)];
  }

  setTile(tx, ty, t) {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[this.idx(tx, ty)] = t;
    this._dirty = true;
  }

  isWalkable(tx, ty)  { return TERRAIN_WALKABLE[this.tileAt(tx, ty)] ?? false; }
  isBuildable(tx, ty) { return TERRAIN_BUILDABLE[this.tileAt(tx, ty)] ?? false; }
  hasMetal(tx, ty)    { return this._metalDeposits.has(this.idx(tx, ty)); }

  /** Check if a rectangular tile region is buildable (and optionally requires metal) */
  canPlace(tx, ty, tw, th, requiresMetal = false) {
    for (let dy = 0; dy < th; dy++) {
      for (let dx = 0; dx < tw; dx++) {
        if (!this.isBuildable(tx + dx, ty + dy)) return false;
      }
    }
    if (requiresMetal) {
      // At least one tile must be a metal deposit
      for (let dy = 0; dy < th; dy++) {
        for (let dx = 0; dx < tw; dx++) {
          if (this.hasMetal(tx + dx, ty + dy)) return true;
        }
      }
      return false;
    }
    return true;
  }

  // ---- Map Generation ----
  _generate(seed) {
    const rng = new RNG(seed);

    // Generate elevation noise map
    const elevation = generateNoiseMap(this.width, this.height, rng, 0.7);
    // Generate moisture noise map (second pass)
    const moisture  = generateNoiseMap(this.width, this.height, new RNG(seed ^ 0xdeadbeef), 0.5);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const e = elevation[y * this.width + x];
        const m = moisture [y * this.width + x];

        let tile;
        if (e < 0.28) {
          tile = TERRAIN.WATER;
        } else if (e < 0.38) {
          tile = TERRAIN.SAND;
        } else if (e > 0.75 && m < 0.4) {
          tile = TERRAIN.ROCK;
        } else {
          tile = TERRAIN.GRASS;
        }
        this.tiles[this.idx(x, y)] = tile;
      }
    }

    // Scatter metal deposits on grass tiles (avoid map edges)
    const metalCount = 24 + rng.int(0, 8);
    for (let attempt = 0; attempt < metalCount * 20 && this._metalDeposits.size < metalCount; attempt++) {
      const tx = rng.int(3, this.width  - 4);
      const ty = rng.int(3, this.height - 4);
      if (this.tileAt(tx, ty) === TERRAIN.GRASS) {
        this.tiles[this.idx(tx, ty)] = TERRAIN.METAL;
        this._metalDeposits.add(this.idx(tx, ty));
        // Optionally add a 2nd adjacent metal tile
        if (rng.next() < 0.5) {
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          const [dx, dy] = dirs[rng.int(0, 3)];
          const nx = tx + dx, ny = ty + dy;
          if (this.inBounds(nx, ny) && this.tileAt(nx, ny) === TERRAIN.GRASS) {
            this.tiles[this.idx(nx, ny)] = TERRAIN.METAL;
            this._metalDeposits.add(this.idx(nx, ny));
          }
        }
      }
    }

    // Ensure starting areas (corners) are clear grassland
    const starts = [
      { cx: 5,  cy: 5  },
      { cx: this.width - 6,  cy: this.height - 6 },
    ];
    for (const { cx, cy } of starts) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const tx = cx + dx, ty = cy + dy;
          if (this.inBounds(tx, ty) && this.tiles[this.idx(tx, ty)] !== TERRAIN.METAL) {
            this.tiles[this.idx(tx, ty)] = TERRAIN.GRASS;
          }
        }
      }
    }
  }

  /** Pixel coordinates of the center of a tile */
  tileCenterPx(tx, ty) {
    return {
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  /** Nearest metal deposit tile to a world position */
  nearestMetal(wx, wy) {
    let best = null, bestD = Infinity;
    for (const flat of this._metalDeposits) {
      const tx = flat % this.width;
      const ty = Math.floor(flat / this.width);
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;
      const d = (px - wx) ** 2 + (py - wy) ** 2;
      if (d < bestD) { bestD = d; best = { tx, ty, px, py }; }
    }
    return best;
  }

  /** Return list of all metal deposits {tx, ty, px, py} */
  get metalDeposits() {
    return [...this._metalDeposits].map(flat => {
      const tx = flat % this.width;
      const ty = Math.floor(flat / this.width);
      return {
        tx, ty,
        px: tx * TILE_SIZE + TILE_SIZE / 2,
        py: ty * TILE_SIZE + TILE_SIZE / 2,
      };
    });
  }

  // ---- Offscreen Canvas Cache ----
  _buildCanvas() {
    this._canvas = document.createElement('canvas');
    this._canvas.width  = this.width  * TILE_SIZE;
    this._canvas.height = this.height * TILE_SIZE;
    this._ctx    = this._canvas.getContext('2d');
    this._dirty  = true;
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

        // Base color
        ctx.fillStyle = TERRAIN_COLOR[t];
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Tile detail / texture
        if (t === TERRAIN.GRASS) {
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(px, py, 1, TILE_SIZE);
          ctx.fillRect(px, py, TILE_SIZE, 1);
        } else if (t === TERRAIN.ROCK) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(px, py, 2, 2);
        } else if (t === TERRAIN.WATER) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(px, py + TILE_SIZE / 2, TILE_SIZE, 1);
        } else if (t === TERRAIN.SAND) {
          ctx.fillStyle = 'rgba(255,220,100,0.08)';
          ctx.fillRect(px, py, TILE_SIZE / 2, TILE_SIZE / 2);
        } else if (t === TERRAIN.METAL) {
          // Metal deposit indicator
          ctx.fillStyle = 'rgba(150,170,190,0.25)';
          ctx.beginPath();
          ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(150,170,190,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    this._dirty = false;
  }

  /** Draw the map (or a region of it) onto a destination canvas context */
  draw(ctx, camX, camY, viewW, viewH) {
    if (this._dirty) this._redraw();
    ctx.drawImage(this._canvas, -camX, -camY);
  }

  /** Draw a minimap version of the map */
  drawMini(ctx, w, h) {
    ctx.drawImage(this._canvas, 0, 0, w, h);
  }
}
