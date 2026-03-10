// =============================================
//  TOTAL ANNIHILATION: REBORN — Input Handler
// =============================================
import { TILE_SIZE } from './constants.js';
import { dist, worldToTile } from './utils.js';

const SCROLL_MARGIN = 40;
const SCROLL_SPEED  = 350; // pixels/sec

export class InputHandler {
  constructor(canvas, renderer, game, ui) {
    this.canvas   = canvas;
    this.renderer = renderer;
    this.game     = game;
    this.ui       = ui;

    this._dragStart    = null;
    this._isDragging   = false;
    this._mousePos     = { x: 0, y: 0 };
    this._mouseButtons = new Set();
    this._keys         = new Set();
    this._scrollDir    = { x: 0, y: 0 };

    this._bind();
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('mousedown',  e => this._onMouseDown(e));
    c.addEventListener('mousemove',  e => this._onMouseMove(e));
    c.addEventListener('mouseup',    e => this._onMouseUp(e));
    c.addEventListener('contextmenu',e => { e.preventDefault(); this._onRightClick(e); });

    window.addEventListener('keydown', e => this._onKeyDown(e));
    window.addEventListener('keyup',   e => this._onKeyUp(e));

    // Minimap clicks
    document.getElementById('minimap-canvas')?.addEventListener('click', e => this._onMinimapClick(e));

    window.addEventListener('resize', () => this.renderer.onResize());
  }

  /** Called each frame to scroll by keyboard/edge */
  updateScroll(dt) {
    const r  = this.renderer;
    let dx = 0, dy = 0;

    // Keyboard
    if (this._keys.has('ArrowLeft')  || this._keys.has('a')) dx -= 1;
    if (this._keys.has('ArrowRight') || this._keys.has('d')) dx += 1;
    if (this._keys.has('ArrowUp')    || this._keys.has('w')) dy -= 1;
    if (this._keys.has('ArrowDown')  || this._keys.has('s')) dy += 1;

    // Edge scrolling
    const m = this._mousePos;
    if (m.x < SCROLL_MARGIN)                    dx -= 1;
    if (m.x > r.viewW - SCROLL_MARGIN)          dx += 1;
    if (m.y < SCROLL_MARGIN)                    dy -= 1;
    if (m.y > r.viewH - SCROLL_MARGIN)          dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      r.camX += (dx / len) * SCROLL_SPEED * dt;
      r.camY += (dy / len) * SCROLL_SPEED * dt;
      r.clampCamera(this.game.map);
    }
  }

  _canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onMouseDown(e) {
    const pos = this._canvasPos(e);
    this._mouseButtons.add(e.button);

    if (e.button === 0) {
      // Left click
      if (this.ui.placingBuilding) {
        // Confirm placement
        this.ui.confirmPlacement(this.renderer, this.game);
        return;
      }
      this._dragStart  = pos;
      this._isDragging = false;
    }
  }

  _onMouseMove(e) {
    const pos = this._canvasPos(e);
    this._mousePos = pos;

    if (this._dragStart) {
      const dx = pos.x - this._dragStart.x;
      const dy = pos.y - this._dragStart.y;
      if (!this._isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        this._isDragging = true;
      }
      if (this._isDragging) {
        // Update selection box
        this.ui.selBox = {
          x1: Math.min(this._dragStart.x, pos.x),
          y1: Math.min(this._dragStart.y, pos.y),
          x2: Math.max(this._dragStart.x, pos.x),
          y2: Math.max(this._dragStart.y, pos.y),
        };
      }
    }

    if (this.ui.placingBuilding) {
      // Update ghost tile
      const wp = this.renderer.screenToWorld(pos.x, pos.y);
      const { tx, ty } = worldToTile(wp.x, wp.y, TILE_SIZE);
      this.ui.ghostTile = { tx, ty };
    }
  }

  _onMouseUp(e) {
    if (e.button !== 0) return;
    const pos = this._canvasPos(e);

    if (this._isDragging && this.ui.selBox) {
      // Box select
      this._boxSelect(this.ui.selBox, e.shiftKey);
    } else if (this._dragStart) {
      // Single click
      if (!this.ui.placingBuilding) {
        this._singleClick(pos, e.shiftKey);
      }
    }

    this._dragStart  = null;
    this._isDragging = false;
    this.ui.selBox   = null;
    this._mouseButtons.delete(0);
  }

  _onRightClick(e) {
    const pos = this._canvasPos(e);
    const wp  = this.renderer.screenToWorld(pos.x, pos.y);

    // Cancel building placement
    if (this.ui.placingBuilding) {
      this.ui.cancelPlacement();
      return;
    }

    const humanPlayer = this.game.players.find(p => p.isHuman);
    if (!humanPlayer) return;

    // Check if right-clicking on an enemy (attack command)
    const target = this.game.entityAt(wp.x, wp.y, humanPlayer.id, true);
    const selected = this.game.getSelected(humanPlayer.id);

    if (target) {
      // Attack command
      for (const sel of selected) {
        if (sel.damage > 0) sel.commandAttack(target);
      }
    } else {
      // Move command
      const { tx, ty } = worldToTile(wp.x, wp.y, TILE_SIZE);
      this._issueMove(selected, wp.x, wp.y, tx, ty);
    }
  }

  _singleClick(pos, additive) {
    const wp = this.renderer.screenToWorld(pos.x, pos.y);
    const humanPlayer = this.game.players.find(p => p.isHuman);
    if (!humanPlayer) return;

    // Try to click on an entity
    const entity = this.game.entityAt(wp.x, wp.y, humanPlayer.id, false);

    if (!additive) this.game.deselectAll(humanPlayer.id);

    if (entity) {
      entity.selected = !entity.selected || additive ? true : false;
      if (!additive) {
        this.game.deselectAll(humanPlayer.id);
        entity.selected = true;
      }
    }

    this.ui.updateSelectionPanel(this.game, humanPlayer);
  }

  _boxSelect(box, additive) {
    const humanPlayer = this.game.players.find(p => p.isHuman);
    if (!humanPlayer) return;

    if (!additive) this.game.deselectAll(humanPlayer.id);

    const r = this.renderer;
    const x1 = box.x1 + r.camX, y1 = box.y1 + r.camY;
    const x2 = box.x2 + r.camX, y2 = box.y2 + r.camY;

    for (const u of this.game.units) {
      if (u.playerId !== humanPlayer.id || u.dead) continue;
      if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) {
        u.selected = true;
      }
    }

    this.ui.updateSelectionPanel(this.game, humanPlayer);
  }

  _issueMove(selected, wx, wy, tx, ty) {
    const units = selected.filter(s => s.constructor.name === 'Unit');
    if (!units.length) return;

    // Spread units around the target point
    const spread = Math.ceil(Math.sqrt(units.length));
    units.forEach((u, i) => {
      const row = Math.floor(i / spread);
      const col = i % spread;
      const ox  = (col - (spread - 1) / 2) * (u.radius * 3);
      const oy  = (row - (spread - 1) / 2) * (u.radius * 3);
      const destX = wx + ox;
      const destY = wy + oy;

      // A* path
      const { tx: stx, ty: sty } = worldToTile(u.x, u.y, TILE_SIZE);
      const { tx: etx, ty: ety } = worldToTile(destX, destY, TILE_SIZE);
      const rawPath = this.game.pathfinder.findPath(stx, sty, etx, ety);

      if (rawPath) {
        const waypoints = rawPath.map(({ tx, ty }) => ({
          x: tx * TILE_SIZE + TILE_SIZE / 2,
          y: ty * TILE_SIZE + TILE_SIZE / 2,
        }));
        u.commandMove(destX, destY, waypoints);
      } else {
        // No path found, try direct movement
        u.commandMove(destX, destY, [{ x: destX, y: destY }]);
      }
    });
  }

  _onMinimapClick(e) {
    const rect = document.getElementById('minimap-canvas').getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = this.renderer.minimapToWorld(mx, my);
    // Center camera on clicked point
    this.renderer.camX = world.x - this.renderer.viewW / 2;
    this.renderer.camY = world.y - this.renderer.viewH / 2;
    this.renderer.clampCamera(this.game.map);
  }

  _onKeyDown(e) {
    this._keys.add(e.key);

    switch (e.key) {
      case 'Escape':
        if (this.ui.placingBuilding) { this.ui.cancelPlacement(); }
        else { this.game.deselectAll(this.game.players.find(p=>p.isHuman)?.id); }
        break;
      case 's': case 'S':
        if (!this._keys.has('Control')) {
          // Stop selected units
          const hp = this.game.players.find(p => p.isHuman);
          if (hp) this.game.getSelected(hp.id).forEach(u => u.commandStop?.());
        }
        break;
      case 'Delete':
        // Self-destruct selected (not implemented, just stop)
        break;
    }
  }

  _onKeyUp(e) {
    this._keys.delete(e.key);
  }
}
