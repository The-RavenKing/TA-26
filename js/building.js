// =============================================
//  TOTAL ANNIHILATION: REBORN — Buildings
// =============================================
import { Entity } from './entity.js';
import { TILE_SIZE, FACTION_COLOR, FACTION_DARK, SELECTION_COLOR } from './constants.js';
import { dist, angle } from './utils.js';
import { Projectile } from './projectile.js';

export class Building extends Entity {
  constructor(tx, ty, def, playerId, faction) {
    const pw = def.tileW * TILE_SIZE;
    const ph = def.tileH * TILE_SIZE;
    const cx = tx * TILE_SIZE + pw / 2;
    const cy = ty * TILE_SIZE + ph / 2;
    super(cx, cy, def, playerId, faction);

    this.tx      = tx;
    this.ty      = ty;
    this.tileW   = def.tileW;
    this.tileH   = def.tileH;
    this.pw      = pw;
    this.ph      = ph;
    this.radius  = Math.min(pw, ph) / 2;

    // Construction
    this.buildProgress   = 0;   // 0..1
    this.built           = false;
    this.buildTimeNeeded = def.buildTime;

    // Production queue (for factories)
    this.queue           = [];   // array of unitDefId
    this.queueMax        = 8;
    this.productionTimer = 0;
    this.canProduce      = def.canProduce ?? [];
    this.rallyPoint      = null; // {x,y}

    // Defense
    this.attackCooldown  = 0;
    this.damage          = def.damage ?? 0;
    this.attackRange     = def.attackRange ?? 0;
    this.attackRate      = def.attackRate ?? 1;

    // Resources
    this.metalProduction  = def.metalProduction   ?? 0;
    this.energyProduction = def.energyProduction  ?? 0;
    this.energyConsumption= def.energyConsumption ?? 0;
    this.radarRange       = def.radarRange ?? 0;

    this.selected = false;
    this._angle   = 0;
  }

  // ---- Construction ----
  applyBuild(buildPower, game) {
    const cost = 1 / this.buildTimeNeeded;
    this.buildProgress += buildPower * cost;
    this.hp = Math.min(this.maxHp, this.maxHp * this.buildProgress);
    if (this.buildProgress >= 1) {
      this.buildProgress = 1;
      this.built = true;
    }
  }

  // ---- Production ----
  enqueue(unitDefId) {
    if (this.queue.length < this.queueMax && this.canProduce.includes(unitDefId)) {
      this.queue.push(unitDefId);
      return true;
    }
    return false;
  }

  dequeue() {
    return this.queue.shift();
  }

  updateProduction(dt, player, game) {
    if (!this.built || this.queue.length === 0) return;

    const defId = this.queue[0];
    const def   = game.getUnitDef(defId);
    if (!def) { this.queue.shift(); return; }

    // Drain resources over time proportional to buildTime
    const rate = 1 / def.buildTime;
    const mNeeded = def.metalCost  * rate * dt;
    const eNeeded = def.energyCost * rate * dt;

    if (!player.canAfford(mNeeded, eNeeded)) {
      // Stall production
      return;
    }
    player.spend(mNeeded, eNeeded);
    this.productionTimer += dt;

    if (this.productionTimer >= def.buildTime) {
      this.productionTimer = 0;
      this.queue.shift();

      // Spawn unit near exit
      const spawnPt = this._spawnPoint();
      game.spawnUnit(defId, spawnPt.x, spawnPt.y, this.playerId, this.faction);
      game.notify(`${def.name} complete!`, this.playerId);
    }
  }

  _spawnPoint() {
    return {
      x: this.x + this.pw / 2 + TILE_SIZE,
      y: this.y,
    };
  }

  // ---- Combat ----
  updateDefense(dt, game) {
    if (!this.built || this.damage <= 0) return;
    if (this.attackCooldown > 0) { this.attackCooldown -= dt; return; }

    const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.attackRange);
    if (!enemy) return;

    const d = dist(this.x, this.y, enemy.x, enemy.y);
    if (d > this.attackRange) return;

    this._angle = angle(this.x, this.y, enemy.x, enemy.y);

    const color = this.faction === 'ARM' ? '#66ff44' : '#ff4444';
    game.projectiles.push(new Projectile(
      this.x, this.y, enemy.x, enemy.y,
      this.damage, 400, this.id, this.faction, 0, color
    ));
    this.attackCooldown = 1 / this.attackRate;
  }

  // ---- Update ----
  update(dt, game) {
    super.update(dt);
    if (this.dead) return;

    const player = game.getPlayer(this.playerId);
    if (!player) return;

    this.updateProduction(dt, player, game);
    this.updateDefense(dt, game);
  }

  // ---- Draw ----
  draw(ctx, camX, camY) {
    const sx = this.x - this.pw / 2 - camX;
    const sy = this.y - this.ph / 2 - camY;
    const col  = FACTION_COLOR[this.faction];
    const dark = FACTION_DARK[this.faction];

    // Under-construction ghost effect
    if (!this.built) {
      ctx.globalAlpha = 0.35 + this.buildProgress * 0.65;
    }

    this._drawBase(ctx, sx, sy, col, dark);

    // Build progress overlay
    if (!this.built) {
      ctx.globalAlpha = 1;
      // Scanning line
      const lineY = sy + this.ph * this.buildProgress;
      ctx.fillStyle = 'rgba(100,200,255,0.25)';
      ctx.fillRect(sx, sy, this.pw, this.ph * this.buildProgress);

      ctx.fillStyle = 'rgba(100,200,255,0.8)';
      ctx.fillRect(sx, lineY - 1, this.pw, 2);
    }

    // HP bar
    this.drawHealthBar(ctx, this.x - camX, this.y - camY, Math.min(this.pw, this.ph) / 2);

    // Selection outline
    if (this.selected) {
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sx - 2, sy - 2, this.pw + 4, this.ph + 4);
      ctx.setLineDash([]);
    }

    // Rally point line
    if (this.rallyPoint && this.selected && this.canProduce.length > 0) {
      const cx = this.x - camX;
      const cy = this.y - camY;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(this.rallyPoint.x - camX, this.rallyPoint.y - camY);
      ctx.strokeStyle = 'rgba(255,200,50,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rally flag
      const rx = this.rallyPoint.x - camX;
      const ry = this.rallyPoint.y - camY;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
    }

    // Production bar
    if (this.built && this.queue.length > 0) {
      const barW = this.pw;
      const prog = this.productionTimer / (this._currentBuildTime(game) || 1);
      const bx   = sx;
      const by   = sy + this.ph + 3;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, barW, 5);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(bx, by, barW * prog, 5);
    }

    ctx.globalAlpha = 1;
  }

  _currentBuildTime(game) {
    if (!this.queue.length) return 1;
    const def = game?.getUnitDef?.(this.queue[0]);
    return def?.buildTime ?? 1;
  }

  _drawBase(ctx, sx, sy, col, dark) {
    const w = this.pw, h = this.ph;
    const id = this.def.id;

    if (id === 'METAL_EXTRACTOR') {
      this._drawMetalExtractor(ctx, sx, sy, w, h, col, dark);
    } else if (id === 'SOLAR_COLLECTOR') {
      this._drawSolarCollector(ctx, sx, sy, w, h, col, dark);
    } else if (id === 'FUSION_REACTOR') {
      this._drawFusionReactor(ctx, sx, sy, w, h, col, dark);
    } else if (id === 'KBOT_LAB') {
      this._drawFactory(ctx, sx, sy, w, h, col, dark, '🤖');
    } else if (id === 'VEHICLE_PLANT') {
      this._drawFactory(ctx, sx, sy, w, h, col, dark, '🏭');
    } else if (id === 'LASER_TOWER') {
      this._drawLaserTower(ctx, sx, sy, w, h, col, dark);
    } else if (id === 'RADAR') {
      this._drawRadar(ctx, sx, sy, w, h, col, dark);
    } else {
      ctx.fillStyle = col;
      ctx.fillRect(sx, sy, w, h);
    }
  }

  _drawMetalExtractor(ctx, sx, sy, w, h, col, dark) {
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(sx, sy, w, h);

    // Drill hole
    ctx.beginPath();
    ctx.arc(sx + w/2, sy + h/2, w * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();

    // Rotating indicator (shimmer)
    ctx.beginPath();
    ctx.arc(sx + w/2, sy + h/2, w * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();

    // Metal pattern
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
  }

  _drawSolarCollector(ctx, sx, sy, w, h, col, dark) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(sx, sy, w, h);

    // Solar panels
    const pad = 3;
    ctx.fillStyle = '#115588';
    ctx.fillRect(sx + pad, sy + pad, w/2 - pad - 1, h/2 - pad - 1);
    ctx.fillRect(sx + w/2 + 1, sy + pad, w/2 - pad - 1, h/2 - pad - 1);
    ctx.fillRect(sx + pad, sy + h/2 + 1, w/2 - pad - 1, h/2 - pad - 1);
    ctx.fillRect(sx + w/2 + 1, sy + h/2 + 1, w/2 - pad - 1, h/2 - pad - 1);

    // Reflective sheen
    ctx.fillStyle = 'rgba(100,200,255,0.15)';
    ctx.fillRect(sx + pad, sy + pad, w - pad * 2, h - pad * 2);

    // Center
    ctx.beginPath();
    ctx.arc(sx + w/2, sy + h/2, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc00';
    ctx.fill();
  }

  _drawFusionReactor(ctx, sx, sy, w, h, col, dark) {
    // Outer shell
    ctx.fillStyle = '#111122';
    ctx.fillRect(sx, sy, w, h);

    const cx = sx + w/2, cy = sy + h/2;
    const r = Math.min(w, h) * 0.4;

    // Reactor core glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#88ccff');
    grad.addColorStop(0.7, '#2244aa');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Containment ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pipes
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx + 10, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + w, cy); ctx.lineTo(sx + w - 10, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, sy); ctx.lineTo(cx, sy + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, sy + h); ctx.lineTo(cx, sy + h - 10); ctx.stroke();
  }

  _drawFactory(ctx, sx, sy, w, h, col, dark, icon) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sx, sy, w, h);

    // Structural panels
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);

    // Door
    const doorW = w * 0.5;
    const doorH = h * 0.5;
    ctx.fillStyle = '#111';
    ctx.fillRect(sx + (w - doorW)/2, sy + (h - doorH)/2, doorW, doorH);

    ctx.strokeStyle = col + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + (w - doorW)/2, sy + (h - doorH)/2, doorW, doorH);

    // Corner brackets
    for (const [cx, cy] of [[sx, sy],[sx+w, sy],[sx, sy+h],[sx+w, sy+h]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + Math.sign(sy + h/2 - cy) * 6);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + Math.sign(sx + w/2 - cx) * 6, cy);
      ctx.stroke();
    }

    // Icon
    ctx.font = `${Math.min(w, h) * 0.3}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(icon, sx + w/2, sy + h * 0.25);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawLaserTower(ctx, sx, sy, w, h, col, dark) {
    // Base
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(sx, sy, w, h);

    // Octagonal base
    const cx = sx + w/2, cy = sy + h/2;
    const r = w * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 8;
      i === 0 ? ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
               : ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Barrel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._angle);
    ctx.fillStyle = '#888';
    ctx.fillRect(-2, -r * 0.9, 4, r * 0.8);
    ctx.restore();

    // Sensor lens
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2222';
    ctx.fill();
  }

  _drawRadar(ctx, sx, sy, w, h, col, dark) {
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(sx, sy, w, h);

    const cx = sx + w/2, cy = sy + h/2;

    // Dish
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rotating sweep indicator (time-based)
    const sweep = (Date.now() / 1200) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, w * 0.38, sweep, sweep + 0.5);
    ctx.closePath();
    ctx.fillStyle = col + '44';
    ctx.fill();

    // Center
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#44ff44';
    ctx.fill();
  }
}
