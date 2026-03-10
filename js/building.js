// =============================================
//  TOTAL ANNIHILATION: REBORN — Buildings
// =============================================
import { Entity } from './entity.js';
import { TILE_SIZE, FACTION_COLOR, FACTION_DARK, FACTION_ACCENT, SELECTION_COLOR } from './constants.js';
import { dist, angle } from './utils.js';
import { Projectile } from './projectile.js';

export class Building extends Entity {
  constructor(tx, ty, def, playerId, faction) {
    const pw = def.tileW * TILE_SIZE;
    const ph = def.tileH * TILE_SIZE;
    const cx = tx * TILE_SIZE + pw / 2;
    const cy = ty * TILE_SIZE + ph / 2;
    super(cx, cy, def, playerId, faction);

    this.tx    = tx;
    this.ty    = ty;
    this.tileW = def.tileW;
    this.tileH = def.tileH;
    this.pw    = pw;
    this.ph    = ph;
    this.radius = Math.min(pw, ph) / 2;

    // Construction
    this.buildProgress   = 0;
    this.built           = false;
    this.buildTimeNeeded = def.buildTime;

    // Production
    this.queue           = [];
    this.queueMax        = 8;
    this.productionTimer = 0;
    this.canProduce      = def.canProduce ?? [];
    this.rallyPoint      = null;

    // Defense
    this.attackCooldown  = 0;
    this.damage          = def.damage          ?? 0;
    this.attackRange     = def.attackRange      ?? 0;
    this.attackRate      = def.attackRate       ?? 1;
    this.isAntiAir       = def.isAntiAir        ?? false;

    // Resources
    this.metalProduction   = def.metalProduction   ?? 0;
    this.energyProduction  = def.energyProduction  ?? 0;
    this.energyConsumption = def.energyConsumption ?? 0;
    this.radarRange        = def.radarRange         ?? 0;
    this.metalCapBonus     = def.metalCapBonus      ?? 0;
    this.energyCapBonus    = def.energyCapBonus     ?? 0;

    // Repair
    this.repairRate  = def.repairRate  ?? 0;
    this.repairRange = def.repairRange ?? 0;

    this.selected = false;
    this._angle   = 0;
    this._pulse   = Math.random() * Math.PI * 2;
    this._scanAngle = 0;
  }

  // ---- Construction ----
  applyBuild(buildPower, game) {
    this.buildProgress += buildPower / this.buildTimeNeeded;
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

  updateProduction(dt, player, game) {
    if (!this.built || !this.queue.length) return;
    const defId = this.queue[0];
    const def   = game.getUnitDef(defId);
    if (!def) { this.queue.shift(); return; }

    const rate     = 1 / def.buildTime;
    const mNeeded  = def.metalCost  * rate * dt;
    const eNeeded  = def.energyCost * rate * dt;
    if (!player.canAfford(mNeeded, eNeeded)) return;

    player.spend(mNeeded, eNeeded);
    this.productionTimer += dt;

    if (this.productionTimer >= def.buildTime) {
      this.productionTimer = 0;
      this.queue.shift();
      const sp = this._spawnPoint();
      const u  = game.spawnUnit(defId, sp.x, sp.y, this.playerId, this.faction);
      if (u && this.rallyPoint) u.commandMove(this.rallyPoint.x, this.rallyPoint.y);
      game.notify(`${def.name} complete!`, this.playerId);
    }
  }

  _spawnPoint() {
    return { x: this.x + this.pw/2 + TILE_SIZE, y: this.y };
  }

  // ---- Defense ----
  updateDefense(dt, game) {
    if (!this.built || this.damage <= 0) return;
    if (this.attackCooldown > 0) { this.attackCooldown -= dt; return; }

    const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.attackRange, this.isAntiAir);
    if (!enemy) return;
    if (dist(this.x, this.y, enemy.x, enemy.y) > this.attackRange) return;

    this._angle = angle(this.x, this.y, enemy.x, enemy.y);
    const color = this.def.id === 'MISSILE_TOWER' ? '#ffaa44'
                : this.faction === 'ARM' ? '#44ff44' : '#ff4444';
    game.projectiles.push(new Projectile(
      this.x, this.y, enemy.x, enemy.y,
      this.damage, this.def.id === 'MISSILE_TOWER' ? 320 : 450,
      this.id, this.faction, 0, color
    ));
    this.attackCooldown = 1 / this.attackRate;
  }

  // ---- Repair ----
  updateRepair(dt, player, game) {
    if (!this.built || this.repairRate <= 0) return;
    if (!player.canAfford(0, this.repairRate * dt * 2)) return;

    let repaired = false;
    for (const u of game.units) {
      if (u.playerId !== this.playerId || u.dead) continue;
      if (u.hp >= u.maxHp) continue;
      if (dist(this.x, this.y, u.x, u.y) > this.repairRange) continue;
      u.heal(this.repairRate * dt);
      repaired = true;
    }
    if (repaired) player.spend(0, this.repairRate * dt * 2);
  }

  // ---- Update ----
  update(dt, game) {
    super.update(dt);
    if (this.dead) return;
    this._pulse += dt * 2;
    this._scanAngle += dt * 1.5;

    const player = game.getPlayer(this.playerId);
    if (!player) return;

    this.updateProduction(dt, player, game);
    this.updateDefense(dt, game);
    this.updateRepair(dt, player, game);
  }

  // ---- Draw ----
  draw(ctx, camX, camY) {
    const sx   = this.x - this.pw/2 - camX;
    const sy   = this.y - this.ph/2 - camY;
    const col  = FACTION_COLOR[this.faction];
    const dark = FACTION_DARK[this.faction];
    const acc  = FACTION_ACCENT[this.faction];

    if (!this.built) ctx.globalAlpha = 0.35 + this.buildProgress * 0.65;

    this._drawBase(ctx, sx, sy, col, dark, acc);

    // Build progress
    if (!this.built) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(80,180,255,0.2)';
      ctx.fillRect(sx, sy, this.pw, this.ph * this.buildProgress);
      ctx.fillStyle = 'rgba(80,180,255,0.9)';
      ctx.fillRect(sx, sy + this.ph * this.buildProgress - 1, this.pw, 2);
    }

    // HP bar
    this.drawHealthBar(ctx, this.x - camX, this.y - camY, Math.min(this.pw, this.ph)/2);

    // Selection outline
    if (this.selected) {
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sx - 2, sy - 2, this.pw + 4, this.ph + 4);
      ctx.setLineDash([]);

      // Corner brackets
      const corners = [[sx,sy],[sx+this.pw,sy],[sx,sy+this.ph],[sx+this.pw,sy+this.ph]];
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      for (const [cx2,cy2] of corners) {
        const dx = cx2 < this.x - camX ? 8 : -8;
        const dy = cy2 < this.y - camY ? 8 : -8;
        ctx.beginPath();
        ctx.moveTo(cx2 + dx, cy2);
        ctx.lineTo(cx2, cy2);
        ctx.lineTo(cx2, cy2 + dy);
        ctx.stroke();
      }
    }

    // Rally point line
    if (this.rallyPoint && this.selected && this.canProduce.length > 0) {
      const cx2 = this.x - camX, cy2 = this.y - camY;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(this.rallyPoint.x - camX, this.rallyPoint.y - camY);
      ctx.strokeStyle = 'rgba(255,200,50,0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(this.rallyPoint.x - camX, this.rallyPoint.y - camY, 4, 0, Math.PI*2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
    }

    // Production progress bar
    if (this.built && this.queue.length > 0) {
      const def  = { buildTime: 1 };
      const prog = this.productionTimer / (this.queue[0] ? 30 : 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx, sy + this.ph + 3, this.pw, 5);
      ctx.fillStyle = col;
      ctx.fillRect(sx, sy + this.ph + 3, this.pw * Math.min(prog, 1), 5);
    }

    ctx.globalAlpha = 1;
  }

  _drawBase(ctx, sx, sy, col, dark, acc) {
    const id = this.def.id;
    const w = this.pw, h = this.ph;
    const t = performance.now() / 1000;

    switch (id) {
      case 'METAL_EXTRACTOR':  this._drawMetalExtractor(ctx, sx, sy, w, h, col, dark); break;
      case 'SOLAR_COLLECTOR':  this._drawSolarCollector(ctx, sx, sy, w, h, col, dark, t); break;
      case 'FUSION_REACTOR':   this._drawFusionReactor(ctx, sx, sy, w, h, col, dark, t); break;
      case 'GEOTHERMAL':       this._drawGeothermal(ctx, sx, sy, w, h, col, dark, t); break;
      case 'METAL_STORAGE':    this._drawMetalStorage(ctx, sx, sy, w, h, col, dark); break;
      case 'ENERGY_STORAGE':   this._drawEnergyStorage(ctx, sx, sy, w, h, col, dark, t); break;
      case 'KBOT_LAB':         this._drawFactory(ctx, sx, sy, w, h, col, dark, acc, '🤖'); break;
      case 'VEHICLE_PLANT':    this._drawFactory(ctx, sx, sy, w, h, col, dark, acc, '🏭'); break;
      case 'ADVANCED_LAB':     this._drawAdvancedLab(ctx, sx, sy, w, h, col, dark, acc, t); break;
      case 'LASER_TOWER':      this._drawLaserTower(ctx, sx, sy, w, h, col, dark, t); break;
      case 'MISSILE_TOWER':    this._drawMissileTower(ctx, sx, sy, w, h, col, dark); break;
      case 'REPAIR_PAD':       this._drawRepairPad(ctx, sx, sy, w, h, col, dark, acc, t); break;
      case 'RADAR':            this._drawRadar(ctx, sx, sy, w, h, col, dark, t); break;
      default:
        ctx.fillStyle = col; ctx.fillRect(sx, sy, w, h);
    }
  }

  _drawMetalExtractor(ctx, sx, sy, w, h, col, dark) {
    ctx.fillStyle = '#111520';
    ctx.fillRect(sx, sy, w, h);
    const cx = sx+w/2, cy = sy+h/2;
    // Drill pipe
    ctx.fillStyle = '#333';
    ctx.fillRect(cx - 3, sy + 4, 6, h - 8);
    // Outer ring
    ctx.beginPath(); ctx.arc(cx, cy, w*0.42, 0, Math.PI*2);
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // Inner rotating disc
    const a = this._scanAngle;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = col + '88';
    ctx.beginPath();
    ctx.arc(0, 0, w*0.28, 0, Math.PI*1.5);
    ctx.lineTo(0,0); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Center core
    ctx.beginPath(); ctx.arc(cx, cy, w*0.15, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, w*0.08, 0, Math.PI*2);
    ctx.fillStyle = '#c8d8e8'; ctx.fill();
    // Corner bolts
    for (const [ox,oy] of [[sx+4,sy+4],[sx+w-4,sy+4],[sx+4,sy+h-4],[sx+w-4,sy+h-4]]) {
      ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI*2);
      ctx.fillStyle = '#556'; ctx.fill();
    }
  }

  _drawSolarCollector(ctx, sx, sy, w, h, col, dark, t) {
    ctx.fillStyle = '#080c14';
    ctx.fillRect(sx, sy, w, h);
    // 4 panels
    const pad = 4, half = w/2 - pad - 1;
    const panels = [[sx+pad,sy+pad],[sx+w/2+1,sy+pad],[sx+pad,sy+h/2+1],[sx+w/2+1,sy+h/2+1]];
    const shine = 0.12 + 0.06 * Math.sin(t * 0.8);
    for (const [px,py] of panels) {
      ctx.fillStyle = '#0d2a44';
      ctx.fillRect(px, py, half, half);
      // Panel segments
      ctx.strokeStyle = '#143050';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(px + half*i/3, py); ctx.lineTo(px + half*i/3, py+half); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py + half*i/3); ctx.lineTo(px+half, py + half*i/3); ctx.stroke();
      }
      ctx.fillStyle = `rgba(100,200,255,${shine})`;
      ctx.fillRect(px, py, half, half);
    }
    // Center hub
    const cx = sx+w/2, cy = sy+h/2;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2);
    ctx.fillStyle = '#ffdd00'; ctx.fill();
    // Glimmer
    ctx.beginPath(); ctx.arc(cx - half*0.4, sy + pad + half*0.4, 2, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4*Math.sin(t*2)})`;
    ctx.fill();
  }

  _drawFusionReactor(ctx, sx, sy, w, h, col, dark, t) {
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(sx, sy, w, h);
    const cx = sx+w/2, cy = sy+h/2;
    const r  = Math.min(w,h)*0.38;

    // Outer containment rings
    for (let i = 2; i >= 0; i--) {
      const alpha = 0.15 + i*0.1;
      ctx.beginPath(); ctx.arc(cx, cy, r*(1 + i*0.18), 0, Math.PI*2);
      ctx.strokeStyle = col + Math.round(alpha*255).toString(16).padStart(2,'0');
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Plasma core
    const pulse = 0.7 + 0.3*Math.sin(t*5);
    const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*pulse);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, '#aaddff');
    grad.addColorStop(0.6, '#2255cc');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(cx, cy, r*pulse, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();

    // Spinning field lines
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t*1.5);
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI/2;
      ctx.beginPath();
      ctx.arc(0, 0, r*0.6, a, a + 1.2);
      ctx.stroke();
    }
    ctx.restore();

    // Pipes
    const pipes = [[sx, cy],[sx+w, cy],[cx, sy],[cx, sy+h]];
    for (let i = 0; i < pipes.length; i++) {
      const [px,py] = pipes[i];
      ctx.fillStyle = '#334455';
      const isH = i < 2;
      if (isH) ctx.fillRect(px, py-4, 14, 8);
      else     ctx.fillRect(px-4, py, 8, 14);
    }

    // Status lights
    for (let i = 0; i < 4; i++) {
      const a = i*Math.PI/2 + Math.PI/4;
      const lx = cx + (r+14)*Math.cos(a);
      const ly = cy + (r+14)*Math.sin(a);
      const on = Math.sin(t*3 + i*1.5) > 0;
      ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI*2);
      ctx.fillStyle = on ? '#00ff88' : '#004422';
      ctx.fill();
    }
  }

  _drawGeothermal(ctx, sx, sy, w, h, col, dark, t) {
    ctx.fillStyle = '#1a0800';
    ctx.fillRect(sx, sy, w, h);
    const cx = sx+w/2, cy = sy+h/2;

    // Lava glow
    const pulse = 0.5 + 0.5*Math.abs(Math.sin(t*1.2));
    const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, w*0.5);
    grad.addColorStop(0, `rgba(255,200,50,${pulse*0.8})`);
    grad.addColorStop(0.4, `rgba(255,80,0,${pulse*0.5})`);
    grad.addColorStop(1, 'rgba(50,10,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, w*0.5, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();

    // Pipe framework
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(sx+8, sy+8); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+w-8, sy+8); ctx.lineTo(cx, cy); ctx.stroke();

    // Steam vents
    for (const [ox, oy] of [[sx+6,sy+h-6],[sx+w-6,sy+h-6]]) {
      ctx.fillStyle = '#667788';
      ctx.fillRect(ox-3, oy-8, 6, 8);
      // Steam puff
      const a = 0.3 + 0.3*Math.sin(t*4 + ox);
      ctx.beginPath(); ctx.arc(ox, oy - 10 - 5*Math.sin(t*3+ox), 5, 0, Math.PI*2);
      ctx.fillStyle = `rgba(200,220,230,${a})`;
      ctx.fill();
    }

    // Central drill
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI*2);
    ctx.fill();
  }

  _drawMetalStorage(ctx, sx, sy, w, h, col, dark) {
    ctx.fillStyle = '#111418';
    ctx.fillRect(sx, sy, w, h);

    // Tank shape
    ctx.fillStyle = '#2a2e36';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(sx+4, sy+4, w-8, h-8, 4)
                  : ctx.rect(sx+4, sy+4, w-8, h-8);
    ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();

    // Horizontal bands (tank segments)
    ctx.strokeStyle = '#333a44'; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(sx+6, sy + h*i/3);
      ctx.lineTo(sx+w-6, sy + h*i/3);
      ctx.stroke();
    }

    // Metal symbol (M)
    ctx.fillStyle = col + 'cc';
    ctx.font = `bold ${Math.min(w,h)*0.55}px "Courier New"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('M', sx+w/2, sy+h/2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Fill indicator
    ctx.fillStyle = dark + '88';
    ctx.fillRect(sx+3, sy+h-7, w-6, 4);
    ctx.fillStyle = col;
    ctx.fillRect(sx+3, sy+h-7, (w-6)*0.7, 4);
  }

  _drawEnergyStorage(ctx, sx, sy, w, h, col, dark, t) {
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(sx, sy, w, h);

    // Hexagonal battery cells
    ctx.strokeStyle = dark; ctx.lineWidth = 1;
    ctx.strokeRect(sx+3, sy+3, w-6, h-6);

    // Energy bars
    const bars = 4;
    const pulse = 0.5 + 0.5*Math.sin(t * 2);
    for (let i = 0; i < bars; i++) {
      const by = sy + 5 + (h-10)/bars * i;
      const bh = (h-10)/bars - 2;
      const filled = i < Math.floor(bars * pulse) + 1;
      ctx.fillStyle = filled ? (i < 2 ? '#ffaa00' : '#ffdd00') : '#111';
      ctx.fillRect(sx+5, by, w-10, bh);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.5;
      ctx.strokeRect(sx+5, by, w-10, bh);
    }

    // Lightning bolt
    ctx.fillStyle = `rgba(255,220,50,${0.7 + 0.3*Math.sin(t*5)})`;
    const lx = sx+w/2, ly = sy+h/2;
    ctx.beginPath();
    ctx.moveTo(lx+4, ly-10); ctx.lineTo(lx-2, ly+2);
    ctx.lineTo(lx+2, ly+2);  ctx.lineTo(lx-4, ly+10);
    ctx.lineTo(lx+2, ly+0);  ctx.lineTo(lx-2, ly+0);
    ctx.closePath(); ctx.fill();
  }

  _drawFactory(ctx, sx, sy, w, h, col, dark, acc, icon) {
    ctx.fillStyle = '#141820';
    ctx.fillRect(sx, sy, w, h);

    // Outer wall panels
    ctx.fillStyle = '#1c2230';
    ctx.fillRect(sx+2, sy+2, w-4, h-4);

    // Door
    const dw = w*0.45, dh = h*0.52;
    const dx = sx + (w-dw)/2, dy = sy + (h-dh)/2 + h*0.05;
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeStyle = col + '66';
    ctx.lineWidth = 1; ctx.strokeRect(dx, dy, dw, dh);

    // Door tracks
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx, dy+dh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx+dw, dy); ctx.lineTo(dx+dw, dy+dh); ctx.stroke();

    // Status light row
    const lights = [col, '#ff4400', '#ffcc00'];
    for (let i = 0; i < lights.length; i++) {
      ctx.beginPath(); ctx.arc(sx + 8 + i*10, sy+8, 3, 0, Math.PI*2);
      ctx.fillStyle = lights[i]; ctx.fill();
    }

    // Production sparks (if building)
    const t = performance.now()/1000;
    if (this.queue.length > 0) {
      const sparks = 3;
      for (let i = 0; i < sparks; i++) {
        const a  = t * 5 + i * Math.PI*2/sparks;
        const pr = dw * 0.3;
        const px = dx + dw/2 + Math.cos(a)*pr;
        const py = dy + dh/2 + Math.sin(a)*pr;
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2);
        ctx.fillStyle = '#ffcc0099'; ctx.fill();
      }
    }

    // Corner brackets
    for (const [cx2,cy2] of [[sx,sy],[sx+w,sy],[sx,sy+h],[sx+w,sy+h]]) {
      const bx = cx2 < sx+w/2 ? 8 : -8;
      const by = cy2 < sy+h/2 ? 8 : -8;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx2+bx, cy2); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2+by);
      ctx.stroke();
    }

    // Icon
    ctx.font = `${Math.min(w,h)*0.28}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.35;
    ctx.fillText(icon, sx+w/2, sy+h*0.2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _drawAdvancedLab(ctx, sx, sy, w, h, col, dark, acc, t) {
    // Call factory base
    this._drawFactory(ctx, sx, sy, w, h, col, dark, acc, '🔬');

    // Additional: glowing tech ring around center
    const cx = sx+w/2, cy = sy+h/2;
    const pulse = 0.6 + 0.4*Math.sin(t*3);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w,h)*0.38, 0, Math.PI*2);
    ctx.strokeStyle = `${col}${Math.round(pulse*120).toString(16).padStart(2,'0')}`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6,8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // TIER 2 label
    ctx.fillStyle = acc + 'bb';
    ctx.font = `bold 9px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText('TIER 2', cx, sy + 16);
    ctx.textAlign = 'left';
  }

  _drawLaserTower(ctx, sx, sy, w, h, col, dark, t) {
    ctx.fillStyle = '#111520';
    ctx.fillRect(sx, sy, w, h);
    const cx = sx+w/2, cy = sy+h/2;
    const r  = w*0.42;

    // Octagonal base
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i*Math.PI/4 - Math.PI/8;
      i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
            : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = dark; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();

    // Turret ring
    ctx.beginPath(); ctx.arc(cx, cy, r*0.52, 0, Math.PI*2);
    ctx.fillStyle = '#1a1a2a'; ctx.fill();
    ctx.strokeStyle = col + '88'; ctx.lineWidth = 1; ctx.stroke();

    // Barrel
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this._angle);
    ctx.fillStyle = '#888';
    ctx.fillRect(-3, -r*0.95, 6, r*0.82);
    // Barrel tip
    ctx.fillStyle = '#aaa';
    ctx.fillRect(-4, -r*0.98, 8, 6);
    // Laser charge glow
    const charge = 1 - (this.attackCooldown / (1/this.attackRate || 1));
    if (charge > 0.6) {
      ctx.beginPath(); ctx.arc(0, -r*0.85, 5*charge, 0, Math.PI*2);
      ctx.fillStyle = col + Math.round(charge * 200).toString(16).padStart(2,'0');
      ctx.fill();
    }
    ctx.restore();

    // Sensor eye
    ctx.beginPath(); ctx.arc(cx, cy, r*0.18, 0, Math.PI*2);
    ctx.fillStyle = '#ff0000'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r*0.09, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,50,50,${0.5+0.5*Math.sin(t*8)})`; ctx.fill();

    // Energy conduits
    ctx.strokeStyle = col + '44'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = i*Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a)*r*0.52, cy + Math.sin(a)*r*0.52);
      ctx.lineTo(cx + Math.cos(a)*r*0.38, cy + Math.sin(a)*r*0.38);
      ctx.stroke();
    }
  }

  _drawMissileTower(ctx, sx, sy, w, h, col, dark) {
    ctx.fillStyle = '#101520';
    ctx.fillRect(sx, sy, w, h);
    const cx = sx+w/2, cy = sy+h/2;

    // Base platform
    ctx.fillStyle = dark;
    ctx.fillRect(sx+4, sy+h*0.5, w-8, h*0.45);
    ctx.strokeStyle = col + '66'; ctx.lineWidth = 1;
    ctx.strokeRect(sx+4, sy+h*0.5, w-8, h*0.45);

    // Launcher arm
    ctx.save(); ctx.translate(cx, cy - h*0.15); ctx.rotate(this._angle + Math.PI/2);

    // Launcher tube x2
    ctx.fillStyle = '#446';
    ctx.fillRect(-8, -h*0.35, 7, h*0.35);
    ctx.fillRect( 1, -h*0.35, 7, h*0.35);

    // Missiles in tubes
    for (const ox of [-5, 3]) {
      ctx.beginPath();
      ctx.moveTo(ox+3, -h*0.34);
      ctx.lineTo(ox, -h*0.22);
      ctx.lineTo(ox+6, -h*0.22);
      ctx.closePath();
      ctx.fillStyle = '#ffaa44'; ctx.fill();
    }
    ctx.restore();

    // Rotating radar dish
    ctx.save(); ctx.translate(cx, sy+10); ctx.rotate(this._scanAngle);
    ctx.strokeStyle = col + '88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 6, -Math.PI/2, Math.PI/2);
    ctx.strokeStyle = col; ctx.stroke();
    ctx.restore();
  }

  _drawRepairPad(ctx, sx, sy, w, h, col, dark, acc, t) {
    ctx.fillStyle = '#0a1218';
    ctx.fillRect(sx, sy, w, h);

    // Pad surface
    ctx.fillStyle = '#141e28';
    ctx.fillRect(sx+3, sy+3, w-6, h-6);

    // Plus symbol / cross
    ctx.fillStyle = col + '55';
    ctx.fillRect(sx + w*0.4, sy+4, w*0.2, h-8);
    ctx.fillRect(sx+4, sy + h*0.4, w-8, h*0.2);

    // Animated repair ring
    const ringR = Math.min(w,h)*0.35;
    const cx = sx+w/2, cy = sy+h/2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, t*2, t*2 + Math.PI*1.5);
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();

    // Inner circle
    ctx.beginPath(); ctx.arc(cx, cy, ringR*0.45, 0, Math.PI*2);
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, ringR*0.2, 0, Math.PI*2);
    ctx.fillStyle = acc + '88'; ctx.fill();

    // Repair beams (animated)
    const pulse = 0.5 + 0.5*Math.sin(t*6);
    for (let i = 0; i < 3; i++) {
      const a = t*3 + i*Math.PI*2/3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a)*ringR*0.9, cy + Math.sin(a)*ringR*0.9);
      ctx.strokeStyle = `rgba(100,220,255,${pulse * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Corner markers
    for (const [ox,oy] of [[sx+3,sy+3],[sx+w-3,sy+3],[sx+3,sy+h-3],[sx+w-3,sy+h-3]]) {
      ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
    }
  }

  _drawRadar(ctx, sx, sy, w, h, col, dark, t) {
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(sx, sy, w, h);
    const cx = sx+w/2, cy = sy+h/2;
    const r  = w*0.42;

    // Dish base
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = dark; ctx.fill();
    ctx.strokeStyle = col + '66'; ctx.lineWidth = 1; ctx.stroke();

    // Radar sweep
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r*0.92, this._scanAngle, this._scanAngle + 0.8);
    ctx.closePath();
    ctx.fillStyle = col + '33'; ctx.fill();
    ctx.restore();

    // Cross-hairs
    ctx.strokeStyle = dark + 'aa'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx-r, cy); ctx.lineTo(cx+r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy-r); ctx.lineTo(cx, cy+r); ctx.stroke();
    for (const rr of [r*0.33, r*0.66]) {
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2);
      ctx.stroke();
    }

    // Mast
    ctx.fillStyle = '#334';
    ctx.fillRect(cx-2, cy-r*0.6, 4, r*0.6);
    // Dish
    ctx.fillStyle = '#778';
    ctx.beginPath();
    ctx.moveTo(cx - r*0.5, cy - r*0.55);
    ctx.lineTo(cx,       cy - r*0.7);
    ctx.lineTo(cx + r*0.5, cy - r*0.55);
    ctx.closePath(); ctx.fill();

    // Blip dots
    const blips = [[0.6, 0.3],[0.3, -0.5],[-0.4, 0.6]];
    for (const [bx,by] of blips) {
      const pulse = (Math.sin(t*3 + bx*5)) * 0.5 + 0.5;
      ctx.beginPath(); ctx.arc(cx + bx*r*0.8, cy + by*r*0.8, 2.5, 0, Math.PI*2);
      ctx.fillStyle = `rgba(100,255,100,${pulse * 0.8})`;
      ctx.fill();
    }

    // Center post
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI*2);
    ctx.fillStyle = '#44ff44'; ctx.fill();
  }
}
