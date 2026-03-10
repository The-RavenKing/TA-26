// =============================================
//  TOTAL ANNIHILATION: REBORN — Renderer
// =============================================
import { TILE_SIZE, MAP_W, MAP_H, FACTION_COLOR, SELECTION_COLOR, TERRAIN } from './constants.js';
import { dist } from './utils.js';

const MINIMAP_W = 200;
const MINIMAP_H = 150;

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.mmCanvas= minimapCanvas;
    this.mmCtx   = minimapCanvas.getContext('2d');

    this.viewW   = 0;
    this.viewH   = 0;
    this.camX    = 0;
    this.camY    = 0;

    this._resize();
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight - 44 - 160; // minus top bar and bottom panel
    this.canvas.width  = w;
    this.canvas.height = h;
    this.viewW = w;
    this.viewH = h;
  }

  onResize() { this._resize(); }

  // ---- Camera ----
  clampCamera(map) {
    const maxX = map.width  * TILE_SIZE - this.viewW;
    const maxY = map.height * TILE_SIZE - this.viewH;
    this.camX = Math.max(0, Math.min(this.camX, maxX));
    this.camY = Math.max(0, Math.min(this.camY, maxY));
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.camX, y: sy + this.camY };
  }

  worldToScreen(wx, wy) {
    return { x: wx - this.camX, y: wy - this.camY };
  }

  // ---- Main render ----
  render(game, ui) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // Map
    game.map.draw(ctx, this.camX, this.camY, this.viewW, this.viewH);

    // Grid overlay (subtle)
    this._drawGrid(ctx, game.map);

    // Radar circles
    this._drawRadarRings(ctx, game);

    // Ghost building placement
    if (ui.placingBuilding) {
      this._drawGhostBuilding(ctx, ui, game);
    }

    // Buildings
    for (const b of game.buildings) {
      if (b.dead) continue;
      if (!this._inView(b.x - b.pw/2, b.y - b.ph/2, b.pw, b.ph)) continue;
      b.draw(ctx, this.camX, this.camY);
    }

    // Units
    for (const u of game.units) {
      if (u.dead) continue;
      if (!this._inView(u.x - u.radius, u.y - u.radius, u.radius*2, u.radius*2)) continue;
      u.draw(ctx, this.camX, this.camY);
    }

    // Projectiles
    for (const p of game.projectiles) {
      if (!p.dead) p.draw(ctx, this.camX, this.camY);
    }

    // Explosions
    for (const e of game.explosions) {
      if (!e.dead) e.draw(ctx, this.camX, this.camY);
    }

    // Selection box
    if (ui.selBox) {
      const b = ui.selBox;
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      ctx.fillStyle = 'rgba(0,255,200,0.05)';
      ctx.fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      ctx.setLineDash([]);
    }

    // Range indicator for selected buildings
    this._drawRangeIndicators(ctx, game);

    this._renderMinimap(game, ui);
  }

  _inView(wx, wy, ww, wh) {
    return wx < this.camX + this.viewW + 50 && wx + ww > this.camX - 50
        && wy < this.camY + this.viewH + 50 && wy + wh > this.camY - 50;
  }

  _drawGrid(ctx, map) {
    // Only draw grid when zoomed in (always on for now, subtle)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;

    const startX = Math.floor(this.camX / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor(this.camY / TILE_SIZE) * TILE_SIZE;
    const endX   = this.camX + this.viewW + TILE_SIZE;
    const endY   = this.camY + this.viewH + TILE_SIZE;

    ctx.beginPath();
    for (let wx = startX; wx <= endX; wx += TILE_SIZE) {
      ctx.moveTo(wx - this.camX, 0);
      ctx.lineTo(wx - this.camX, this.viewH);
    }
    for (let wy = startY; wy <= endY; wy += TILE_SIZE) {
      ctx.moveTo(0, wy - this.camY);
      ctx.lineTo(this.viewW, wy - this.camY);
    }
    ctx.stroke();
  }

  _drawRadarRings(ctx, game) {
    for (const b of game.buildings) {
      if (!b.built || b.dead || !b.radarRange) continue;
      const sx = b.x - this.camX;
      const sy = b.y - this.camY;
      ctx.beginPath();
      ctx.arc(sx, sy, b.radarRange, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,255,100,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawRangeIndicators(ctx, game) {
    for (const b of game.buildings) {
      if (!b.selected || !b.built || !b.attackRange) continue;
      const sx = b.x - this.camX;
      const sy = b.y - this.camY;
      ctx.beginPath();
      ctx.arc(sx, sy, b.attackRange, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,80,80,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawGhostBuilding(ctx, ui, game) {
    const def = ui.placingBuildingDef;
    if (!def) return;

    const { tx, ty } = ui.ghostTile;
    const sx = tx * TILE_SIZE - this.camX;
    const sy = ty * TILE_SIZE - this.camY;
    const pw = def.tileW * TILE_SIZE;
    const ph = def.tileH * TILE_SIZE;

    const canPlace = game.map.canPlace(tx, ty, def.tileW, def.tileH, def.requiresMetal ?? false)
                  && !game.isTileOccupied(tx, ty, def.tileW, def.tileH);

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = canPlace ? 'rgba(50,200,100,0.3)' : 'rgba(200,50,50,0.3)';
    ctx.fillRect(sx, sy, pw, ph);

    ctx.strokeStyle = canPlace ? '#44ff88' : '#ff4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, pw, ph);

    // Grid tiles
    for (let dy = 0; dy < def.tileH; dy++) {
      for (let dx = 0; dx < def.tileW; dx++) {
        const tileBuildable = game.map.isBuildable(tx + dx, ty + dy);
        const hasMetal      = game.map.hasMetal(tx + dx, ty + dy);
        if (!tileBuildable) {
          ctx.fillStyle = 'rgba(255,0,0,0.3)';
          ctx.fillRect(sx + dx * TILE_SIZE, sy + dy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        if (hasMetal && def.requiresMetal) {
          ctx.fillStyle = 'rgba(200,200,50,0.4)';
          ctx.fillRect(sx + dx * TILE_SIZE, sy + dy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    ctx.globalAlpha = 1;

    // Label
    ctx.font = '11px "Courier New"';
    ctx.fillStyle = canPlace ? '#88ff88' : '#ff8888';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, sx + pw/2, sy - 5);
    ctx.textAlign = 'left';
  }

  // ---- Minimap ----
  _renderMinimap(game, ui) {
    const ctx  = this.mmCtx;
    const w    = MINIMAP_W;
    const h    = MINIMAP_H;
    const mapW = game.map.width  * TILE_SIZE;
    const mapH = game.map.height * TILE_SIZE;

    ctx.clearRect(0, 0, w, h);

    // Draw map terrain at minimap scale
    game.map.drawMini(ctx, w, h);

    // Draw buildings
    for (const b of game.buildings) {
      if (b.dead) continue;
      const mx = (b.x - b.pw/2) / mapW * w;
      const my = (b.y - b.ph/2) / mapH * h;
      const mw = b.pw / mapW * w;
      const mh = b.ph / mapH * h;
      ctx.fillStyle = FACTION_COLOR[b.faction];
      ctx.fillRect(mx, my, Math.max(2, mw), Math.max(2, mh));
    }

    // Draw units
    for (const u of game.units) {
      if (u.dead) continue;
      const mx = u.x / mapW * w;
      const my = u.y / mapH * h;
      ctx.beginPath();
      ctx.arc(mx, my, u.def.id === 'COMMANDER' ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = FACTION_COLOR[u.faction];
      ctx.fill();
    }

    // Viewport rectangle
    const vx = this.camX / mapW * w;
    const vy = this.camY / mapH * h;
    const vw = this.viewW / mapW * w;
    const vh = this.viewH / mapH * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
  }

  /** Convert minimap click to world coords */
  minimapToWorld(mmX, mmY) {
    const mapW = MAP_W * TILE_SIZE;
    const mapH = MAP_H * TILE_SIZE;
    return {
      x: mmX / MINIMAP_W * mapW,
      y: mmY / MINIMAP_H * mapH,
    };
  }
}
