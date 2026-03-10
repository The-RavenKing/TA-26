// =============================================
//  TOTAL ANNIHILATION: REBORN — A* Pathfinding
// =============================================

/**
 * Binary Min-Heap for priority queue performance.
 */
class MinHeap {
  constructor() { this._data = []; }
  push(item, priority) { this._data.push({ item, priority }); this._bubbleUp(this._data.length - 1); }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) { this._data[0] = last; this._sinkDown(0); }
    return top?.item;
  }
  get size() { return this._data.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._data[p].priority <= this._data[i].priority) break;
      [this._data[p], this._data[i]] = [this._data[i], this._data[p]];
      i = p;
    }
  }

  _sinkDown(i) {
    const n = this._data.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._data[l].priority < this._data[smallest].priority) smallest = l;
      if (r < n && this._data[r].priority < this._data[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this._data[smallest], this._data[i]] = [this._data[i], this._data[smallest]];
      i = smallest;
    }
  }
}

/**
 * A* Pathfinder operating on a tile grid.
 * Uses diagonal movement (8-directional) with appropriate costs.
 */
export class Pathfinder {
  constructor(map) {
    this.map = map;
    this.w   = map.width;
    this.h   = map.height;
  }

  /** Find path from tile (sx,sy) to tile (ex,ey).
   *  Returns array of {tx,ty} from start to end, or null if no path. */
  findPath(sx, sy, ex, ey) {
    if (!this.map.inBounds(sx, sy) || !this.map.inBounds(ex, ey)) return null;
    if (!this.map.isWalkable(sx, sy) || !this.map.isWalkable(ex, ey)) return null;
    if (sx === ex && sy === ey) return [{ tx: sx, ty: sy }];

    const idx   = (x, y) => y * this.w + x;
    const size  = this.w * this.h;
    const gCost = new Float32Array(size).fill(Infinity);
    const fCost = new Float32Array(size).fill(Infinity);
    const came  = new Int32Array(size).fill(-1);
    const open  = new MinHeap();

    const startIdx = idx(sx, sy);
    gCost[startIdx] = 0;
    fCost[startIdx] = this._h(sx, sy, ex, ey);
    open.push(startIdx, fCost[startIdx]);

    const endIdx = idx(ex, ey);

    while (open.size > 0) {
      const curr = open.pop();
      if (curr === endIdx) return this._reconstruct(came, endIdx);

      const cx = curr % this.w;
      const cy = Math.floor(curr / this.w);

      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.map.inBounds(nx, ny)) continue;
        if (!this.map.isWalkable(nx, ny)) continue;
        // Diagonal movement: check both orthogonal tiles to avoid corner-cutting
        if (dx !== 0 && dy !== 0) {
          if (!this.map.isWalkable(cx + dx, cy) || !this.map.isWalkable(cx, cy + dy)) continue;
        }
        const ni = idx(nx, ny);
        const ng = gCost[curr] + cost;
        if (ng < gCost[ni]) {
          gCost[ni] = ng;
          fCost[ni] = ng + this._h(nx, ny, ex, ey);
          came[ni]  = curr;
          open.push(ni, fCost[ni]);
        }
      }
    }
    return null; // No path found
  }

  /** Find nearest walkable tile to (tx,ty) */
  nearestWalkable(tx, ty, maxSearch = 5) {
    if (this.map.isWalkable(tx, ty)) return { tx, ty };
    for (let r = 1; r <= maxSearch; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = tx + dx, ny = ty + dy;
          if (this.map.isWalkable(nx, ny)) return { tx: nx, ty: ny };
        }
      }
    }
    return null;
  }

  _h(ax, ay, bx, by) {
    // Octile heuristic
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  _reconstruct(came, endIdx) {
    const path = [];
    let curr = endIdx;
    while (curr !== -1) {
      path.push({ tx: curr % this.w, ty: Math.floor(curr / this.w) });
      curr = came[curr];
    }
    return path.reverse();
  }
}

// 8 movement directions with costs (diagonal = sqrt(2))
const DIRS = [
  [-1,  0, 1], [ 1,  0, 1], [ 0, -1, 1], [ 0,  1, 1],
  [-1, -1, Math.SQRT2], [ 1, -1, Math.SQRT2],
  [-1,  1, Math.SQRT2], [ 1,  1, Math.SQRT2],
];

/**
 * Smooth a tile path into world-space waypoints by removing redundant
 * collinear tiles (string-pulling).
 */
export function smoothPath(tilePath, tileSize) {
  if (!tilePath || tilePath.length === 0) return [];
  const pts = tilePath.map(({ tx, ty }) => ({
    x: tx * tileSize + tileSize / 2,
    y: ty * tileSize + tileSize / 2,
  }));
  if (pts.length <= 2) return pts;

  const result = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    // Cross product: skip curr if prev→next is same direction
    const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > 0.5) result.push(curr);
  }
  result.push(pts[pts.length - 1]);
  return result;
}
