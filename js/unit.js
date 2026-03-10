// =============================================
//  TOTAL ANNIHILATION: REBORN — Units
// =============================================
import { Entity } from './entity.js';
import { TILE_SIZE, FACTION_COLOR, FACTION_DARK, FACTION_ACCENT, SELECTION_COLOR } from './constants.js';
import { dist, angle } from './utils.js';
import { Projectile } from './projectile.js';

export const UnitState = {
  IDLE      : 'idle',
  MOVING    : 'moving',
  ATTACKING : 'attacking',
  BUILDING  : 'building',
  PATROL    : 'patrol',
  GUARD     : 'guard',
};

export class Unit extends Entity {
  constructor(x, y, def, playerId, faction) {
    super(x, y, def, playerId, faction);

    this.state    = UnitState.IDLE;
    this.angle    = 0;
    this.speed    = def.speed;
    this.radius   = def.radius;
    this.isAir    = def.isAir   ?? false;
    this.isHover  = def.isHover ?? false;

    // Movement
    this.waypoints  = [];
    this.moveTarget = null;

    // Combat
    this.attackTarget   = null;
    this.attackCooldown = 0;
    this.damage         = def.damage;
    this.attackRange    = def.attackRange;
    this.attackRate     = def.attackRate;
    this.minRange       = def.minRange ?? 0;
    this.splash         = def.splash   ?? 0;
    this.sight          = def.sight;
    this.selected       = false;

    // Building (commanders / constructors)
    this.buildTarget = null;
    this.buildPower  = def.buildPower ?? 0;
    this.buildRange  = def.buildRange ?? 200;

    // Patrol
    this.patrolA = null;
    this.patrolB = null;

    // Visual
    this._drawAngle  = 0;
    this.spawnEffect = 1.0;
    this._pulse      = Math.random() * Math.PI * 2;  // for glow animations
  }

  // ---- Commands ----
  commandMove(x, y, waypoints) {
    this.state       = UnitState.MOVING;
    this.waypoints   = waypoints ? [...waypoints] : [{ x, y }];
    this.moveTarget  = { x, y };
    this.attackTarget= null;
    this.buildTarget = null;
  }

  commandAttack(target) {
    this.attackTarget= target;
    this.buildTarget = null;
    this.state       = UnitState.ATTACKING;
  }

  commandStop() {
    this.state       = UnitState.IDLE;
    this.waypoints   = [];
    this.moveTarget  = null;
    this.attackTarget= null;
    this.buildTarget = null;
  }

  commandBuild(building) {
    this.buildTarget = building;
    this.state       = UnitState.BUILDING;
    this.attackTarget= null;
  }

  commandPatrol(a, b) {
    this.patrolA   = a;
    this.patrolB   = b;
    this.state     = UnitState.PATROL;
    this.waypoints = [{ ...b }];
  }

  // ---- Update ----
  update(dt, game) {
    super.update(dt);
    if (this.dead) return;

    this._pulse += dt * 3;
    if (this.spawnEffect > 0) this.spawnEffect = Math.max(0, this.spawnEffect - dt * 3);
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    switch (this.state) {
      case UnitState.IDLE:      this._updateIdle(dt, game);    break;
      case UnitState.MOVING:    this._updateMove(dt, game);    break;
      case UnitState.ATTACKING: this._updateAttack(dt, game);  break;
      case UnitState.BUILDING:  this._updateBuild(dt, game);   break;
      case UnitState.PATROL:    this._updatePatrol(dt, game);  break;
    }

    this._drawAngle = this.angle;
    this._separate(game.units);
  }

  _updateIdle(dt, game) {
    if (this.damage <= 0) return;
    const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.sight, this.isAir);
    if (enemy) { this.attackTarget = enemy; this.state = UnitState.ATTACKING; }
  }

  _updateMove(dt, game) {
    if (!this.waypoints.length) { this.state = UnitState.IDLE; return; }
    const wp = this.waypoints[0];
    const d  = dist(this.x, this.y, wp.x, wp.y);

    if (d < 5) {
      this.waypoints.shift();
      if (!this.waypoints.length) this.state = UnitState.IDLE;
      return;
    }

    const spd = this.speed * dt;
    const ang = angle(this.x, this.y, wp.x, wp.y);
    this.x += Math.cos(ang) * spd;
    this.y += Math.sin(ang) * spd;
    this.angle = ang;

    if (this.damage > 0) {
      const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.sight, this.isAir);
      if (enemy) { this.attackTarget = enemy; this.state = UnitState.ATTACKING; }
    }
  }

  _updateAttack(dt, game) {
    const t = this.attackTarget;
    if (!t || t.dead) { this.attackTarget = null; this.state = UnitState.IDLE; return; }

    const d = dist(this.x, this.y, t.x, t.y);

    if (this.minRange > 0 && d < this.minRange) {
      const backAng = angle(t.x, t.y, this.x, this.y);
      this.x += Math.cos(backAng) * this.speed * dt;
      this.y += Math.sin(backAng) * this.speed * dt;
      this.angle = backAng;
      return;
    }

    if (d > this.attackRange * 0.9) {
      const ang = angle(this.x, this.y, t.x, t.y);
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
      this.angle = ang;
    }

    this.angle = angle(this.x, this.y, t.x, t.y);

    if (d <= this.attackRange && this.attackCooldown <= 0) {
      this._fireAt(t, game);
      this.attackCooldown = 1 / this.attackRate;
    }
  }

  _updateBuild(dt, game) {
    const b = this.buildTarget;
    if (!b || b.dead) { this.buildTarget = null; this.state = UnitState.IDLE; return; }

    const d = dist(this.x, this.y, b.x, b.y);
    if (d > this.buildRange) {
      const ang = angle(this.x, this.y, b.x, b.y);
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
      this.angle = ang;
    } else {
      this.angle = angle(this.x, this.y, b.x, b.y);
      b.applyBuild(this.buildPower * dt, game);
      if (b.built) { this.buildTarget = null; this.state = UnitState.IDLE; }
    }
  }

  _updatePatrol(dt, game) {
    const target = this.waypoints[0] || this.patrolB;
    if (!target) { this.state = UnitState.IDLE; return; }

    if (this.damage > 0) {
      const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.sight, this.isAir);
      if (enemy) { this.attackTarget = enemy; this.state = UnitState.ATTACKING; return; }
    }

    const d = dist(this.x, this.y, target.x, target.y);
    if (d < 10) {
      this.waypoints = this.patrolA && this.waypoints[0] !== this.patrolA
        ? [{ ...this.patrolA }]
        : [{ ...this.patrolB }];
      return;
    }

    const ang = angle(this.x, this.y, target.x, target.y);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    this.angle = ang;
  }

  _fireAt(target, game) {
    const color = this.faction === 'ARM' ? '#66ccff' : '#ff6644';
    const speed = this.def.id === 'SNIPER' ? 600
                : this.def.id === 'ARTILLERY' || this.def.id === 'BOMBER' ? 280
                : 360;
    game.projectiles.push(new Projectile(
      this.x, this.y, target.x, target.y,
      this.damage, speed, this.id, this.faction,
      this.splash, color
    ));
  }

  _separate(units) {
    for (const u of units) {
      if (u === this || u.dead) continue;
      if (u.isAir !== this.isAir) continue; // air and ground don't collide
      const dx = this.x - u.x, dy = this.y - u.y;
      const d2 = dx*dx + dy*dy;
      const minD = this.radius + u.radius + 2;
      if (d2 < minD*minD && d2 > 0) {
        const d = Math.sqrt(d2);
        const f = (minD - d) / d * 0.5;
        this.x += dx * f;
        this.y += dy * f;
      }
    }
  }

  // ---- Drawing ----
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const r  = this.radius;
    const scale = 1 - this.spawnEffect * 0.7;

    const col    = FACTION_COLOR[this.faction];
    const dark   = FACTION_DARK[this.faction];
    const accent = FACTION_ACCENT[this.faction];
    const flash  = this.damageFlash > 0;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this._drawAngle + Math.PI / 2);
    ctx.scale(scale, scale);

    // Air shadow
    if (this.isAir) {
      ctx.save();
      ctx.resetTransform();
      ctx.beginPath();
      ctx.ellipse(sx + 4, sy + 6, r * 0.9, r * 0.4, 0, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this._drawAngle + Math.PI / 2);
      ctx.scale(scale, scale);
    }

    this._drawBody(ctx, r, col, dark, accent, flash);

    ctx.restore();

    // Selection ring
    if (this.selected) {
      ctx.save();
      const t = performance.now() / 1000;
      const a = 0.7 + 0.3 * Math.sin(t * 4);
      ctx.beginPath();
      ctx.arc(sx, sy, r + 5, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(0,255,200,${a})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Corner dashes
      for (let i = 0; i < 4; i++) {
        const ang = i * Math.PI/2 + Math.PI/4;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 9, ang - 0.25, ang + 0.25);
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Health bar
    this.drawHealthBar(ctx, sx, sy, r);

    // Tier-2 glow
    if (this.def.tier >= 2) {
      const glow = 0.15 + 0.1 * Math.sin(this._pulse);
      ctx.beginPath();
      ctx.arc(sx, sy, r + 8, 0, Math.PI*2);
      ctx.fillStyle = col + Math.round(glow * 255).toString(16).padStart(2,'0');
      ctx.fill();
    }

    // Build beam
    if (this.state === UnitState.BUILDING && this.buildTarget && !this.buildTarget.built) {
      const bx = this.buildTarget.x - camX;
      const by = this.buildTarget.y - camY;
      const t  = performance.now() / 1000;
      const a  = 0.4 + 0.3 * Math.sin(t * 8);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = `rgba(100,200,255,${a})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Spark at building end
      ctx.beginPath();
      ctx.arc(bx, by, 4 + 2*Math.sin(t*12), 0, Math.PI*2);
      ctx.fillStyle = `rgba(150,230,255,${a})`;
      ctx.fill();
    }
  }

  _drawBody(ctx, r, col, dark, accent, flash) {
    const id = this.def.id;
    const fc = flash ? '#ffffff' : col;
    const fd = flash ? '#cccccc' : dark;

    switch (id) {
      case 'COMMANDER':   this._drawCommander(ctx, r, fc, fd, accent, flash); break;
      case 'KBOT':        this._drawKbot(ctx, r, fc, fd, flash);              break;
      case 'TANK':        this._drawTank(ctx, r, fc, fd, flash);              break;
      case 'HOVER_TANK':  this._drawHoverTank(ctx, r, fc, fd, flash);         break;
      case 'CONSTRUCTOR': this._drawConstructor(ctx, r, fc, fd, flash);       break;
      case 'ARTILLERY':   this._drawArtillery(ctx, r, fc, fd, flash);         break;
      case 'FIGHTER':     this._drawFighter(ctx, r, fc, fd, flash);           break;
      case 'HEAVY_BOT':   this._drawHeavyBot(ctx, r, fc, fd, accent, flash);  break;
      case 'BOMBER':      this._drawBomber(ctx, r, fc, fd, flash);            break;
      case 'SNIPER':      this._drawSniper(ctx, r, fc, fd, flash);            break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = fc; ctx.fill();
    }
  }

  _drawCommander(ctx, r, col, dark, accent, flash) {
    // Glow ring
    const g = ctx.createRadialGradient(0,0,r*0.5, 0,0,r*1.8);
    g.addColorStop(0, col + '44');
    g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(0, 0, r*1.8, 0, Math.PI*2);
    ctx.fillStyle = g; ctx.fill();

    // Body — hexagonal
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI/3 - Math.PI/6;
      i === 0 ? ctx.moveTo(r*Math.cos(a), r*Math.sin(a))
              : ctx.lineTo(r*Math.cos(a), r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.stroke();

    // Core
    ctx.beginPath(); ctx.arc(0, 0, r*0.35, 0, Math.PI*2);
    ctx.fillStyle = dark; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r*0.18, 0, Math.PI*2);
    ctx.fillStyle = accent; ctx.fill();

    // Forward chevron
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, -r*0.85);
    ctx.lineTo(-r*0.2, -r*0.5);
    ctx.lineTo(0, -r*0.6);
    ctx.lineTo(r*0.2, -r*0.5);
    ctx.closePath(); ctx.fill();

    // Shoulder pads
    ctx.fillStyle = dark;
    for (const sx of [-r*0.75, r*0.45]) {
      ctx.fillRect(sx, -r*0.2, r*0.3, r*0.5);
    }
  }

  _drawKbot(ctx, r, col, dark, flash) {
    // Legs
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.45, r*0.15, r*0.32, r*0.65);
    ctx.fillRect( r*0.13, r*0.15, r*0.32, r*0.65);
    // Feet
    ctx.fillRect(-r*0.55, r*0.65, r*0.38, r*0.2);
    ctx.fillRect( r*0.17, r*0.65, r*0.38, r*0.2);

    // Body
    ctx.fillStyle = col;
    ctx.fillRect(-r*0.55, -r*0.55, r*1.1, r*0.8);

    // Head
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.35, -r*0.9, r*0.7, r*0.45);
    // Visor
    ctx.fillStyle = '#00ccff';
    ctx.fillRect(-r*0.25, -r*0.8, r*0.5, r*0.2);

    // Gun arm
    ctx.fillStyle = '#777';
    ctx.fillRect( r*0.55, -r*0.4, r*0.25, r*0.35);
    ctx.fillRect( r*0.6,  -r*0.85, r*0.15, r*0.5);
  }

  _drawTank(ctx, r, col, dark, flash) {
    // Treads
    ctx.fillStyle = '#333';
    ctx.fillRect(-r, -r*0.7, r*2, r*0.22);
    ctx.fillRect(-r,  r*0.48, r*2, r*0.22);
    // Tread details
    ctx.fillStyle = '#222';
    for (let i = -r; i < r; i += r*0.4) {
      ctx.fillRect(i, -r*0.7, r*0.12, r*0.22);
      ctx.fillRect(i, r*0.48, r*0.12, r*0.22);
    }

    // Hull
    ctx.fillStyle = col;
    ctx.fillRect(-r*0.85, -r*0.48, r*1.7, r*0.96);
    // Hull chamfer
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-r*0.85, -r*0.48); ctx.lineTo(-r*0.65, -r*0.68);
    ctx.lineTo( r*0.65, -r*0.68); ctx.lineTo( r*0.85, -r*0.48);
    ctx.closePath(); ctx.fill();

    // Turret
    ctx.beginPath(); ctx.arc(0, 0, r*0.52, 0, Math.PI*2);
    ctx.fillStyle = dark; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r*0.35, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();

    // Barrel
    ctx.fillStyle = '#555';
    ctx.fillRect(-r*0.09, -r*1.12, r*0.18, r*0.7);
    ctx.fillRect(-r*0.12, -r*0.55, r*0.24, r*0.18);
  }

  _drawHoverTank(ctx, r, col, dark, flash) {
    // Hover skirt (ellipse)
    ctx.beginPath();
    ctx.ellipse(0, r*0.2, r*1.05, r*0.4, 0, 0, Math.PI*2);
    ctx.fillStyle = '#334';
    ctx.fill();
    ctx.strokeStyle = col + '88';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hover fans
    for (const ox of [-r*0.6, r*0.6]) {
      ctx.beginPath();
      ctx.arc(ox, r*0.2, r*0.22, 0, Math.PI*2);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.fillStyle = col + '66';
      ctx.fill();
    }

    // Streamlined hull
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -r*0.85);
    ctx.lineTo( r*0.8, r*0.1);
    ctx.lineTo( r*0.7, r*0.4);
    ctx.lineTo(-r*0.7, r*0.4);
    ctx.lineTo(-r*0.8, r*0.1);
    ctx.closePath();
    ctx.fill();

    // Turret
    ctx.beginPath(); ctx.arc(0, -r*0.1, r*0.35, 0, Math.PI*2);
    ctx.fillStyle = dark; ctx.fill();

    // Barrel (shorter, twin)
    ctx.fillStyle = '#666';
    ctx.fillRect(-r*0.17, -r*1.0, r*0.12, r*0.65);
    ctx.fillRect( r*0.05,  -r*1.0, r*0.12, r*0.65);
  }

  _drawConstructor(ctx, r, col, dark, flash) {
    // Wheeled base
    ctx.fillStyle = dark;
    for (const [ox, oy] of [[-r*0.55,-r*0.2],[ r*0.35,-r*0.2],[-r*0.55, r*0.3],[ r*0.35, r*0.3]]) {
      ctx.beginPath(); ctx.arc(ox + r*0.1, oy + r*0.1, r*0.2, 0, Math.PI*2);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = col;
    ctx.fillRect(-r*0.6, -r*0.45, r*1.2, r*0.9);

    // Crane arm
    ctx.fillStyle = '#888';
    ctx.fillRect(r*0.3, -r*1.1, r*0.12, r*0.7);
    // Crane horizontal
    ctx.fillRect(-r*0.1, -r*1.05, r*0.5, r*0.12);

    // Magnet / tool
    ctx.beginPath(); ctx.arc(r*0.4, -r*1.0, r*0.18, 0, Math.PI);
    ctx.fillStyle = dark; ctx.fill();

    // Hazard stripes
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(-r*0.6, r*0.15, r*0.3, r*0.3);
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.6, r*0.15, r*0.1, r*0.1);
    ctx.fillRect(-r*0.4, r*0.35, r*0.1, r*0.1);
  }

  _drawArtillery(ctx, r, col, dark, flash) {
    // Treads (long)
    ctx.fillStyle = '#333';
    ctx.fillRect(-r*0.75, -r*0.55, r*1.5, r*0.2);
    ctx.fillRect(-r*0.75,  r*0.35, r*1.5, r*0.2);

    // Hull
    ctx.fillStyle = col;
    ctx.fillRect(-r*0.65, -r*0.35, r*1.3, r*0.7);

    // Base box (elevated)
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.35, -r*0.6, r*0.7, r*0.35);

    // Long barrel with detail
    ctx.fillStyle = '#555';
    ctx.fillRect(-r*0.09, -r*1.6, r*0.18, r*1.1);
    // Barrel bands
    ctx.fillStyle = '#444';
    for (const y of [-r*1.5, -r*1.2, -r*0.9]) {
      ctx.fillRect(-r*0.13, y, r*0.26, r*0.08);
    }
    // Muzzle break
    ctx.fillRect(-r*0.16, -r*1.65, r*0.32, r*0.12);
  }

  _drawFighter(ctx, r, col, dark, flash) {
    // Wings
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -r*0.9);
    ctx.lineTo(-r*1.6, r*0.5);
    ctx.lineTo(-r*0.5, r*0.15);
    ctx.lineTo(0, r*0.2);
    ctx.lineTo(r*0.5, r*0.15);
    ctx.lineTo(r*1.6, r*0.5);
    ctx.closePath(); ctx.fill();

    // Tail fins
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-r*0.3, r*0.3); ctx.lineTo(-r*0.7, r*0.85); ctx.lineTo(-r*0.3, r*0.7);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r*0.3, r*0.3); ctx.lineTo(r*0.7, r*0.85); ctx.lineTo(r*0.3, r*0.7);
    ctx.closePath(); ctx.fill();

    // Fuselage
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.22, r*0.85, 0, 0, Math.PI*2);
    ctx.fillStyle = dark; ctx.fill();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -r*0.4, r*0.14, r*0.25, 0, 0, Math.PI*2);
    ctx.fillStyle = '#88eeff88'; ctx.fill();

    // Engine glow
    ctx.beginPath(); ctx.arc(0, r*0.75, r*0.14, 0, Math.PI*2);
    ctx.fillStyle = '#ff6600cc'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, r*0.75, r*0.07, 0, Math.PI*2);
    ctx.fillStyle = '#ffeeaacc'; ctx.fill();
  }

  _drawHeavyBot(ctx, r, col, dark, accent, flash) {
    // Feet
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.85, r*0.55, r*0.6, r*0.45);
    ctx.fillRect( r*0.25, r*0.55, r*0.6, r*0.45);

    // Leg joints
    ctx.beginPath(); ctx.arc(-r*0.55, r*0.45, r*0.2, 0, Math.PI*2);
    ctx.fillStyle = '#444'; ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.55, r*0.45, r*0.2, 0, Math.PI*2);
    ctx.fill();

    // Legs
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.65, r*0.0, r*0.3, r*0.55);
    ctx.fillRect( r*0.35, r*0.0, r*0.3, r*0.55);

    // Torso
    ctx.fillStyle = col;
    ctx.fillRect(-r*0.8, -r*0.65, r*1.6, r*0.85);
    // Torso armor plating
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.75, -r*0.6, r*0.35, r*0.75);
    ctx.fillRect( r*0.4, -r*0.6, r*0.35, r*0.75);
    ctx.fillRect(-r*0.15, -r*0.6, r*0.3, r*0.3);

    // Shoulders
    ctx.fillStyle = dark;
    ctx.fillRect(-r*1.05, -r*0.7, r*0.35, r*0.55);
    ctx.fillRect( r*0.7, -r*0.7, r*0.35, r*0.55);

    // Head
    ctx.fillStyle = col;
    ctx.fillRect(-r*0.45, -r*1.1, r*0.9, r*0.55);
    ctx.fillStyle = accent;
    ctx.fillRect(-r*0.35, -r*1.0, r*0.7, r*0.2);

    // Dual cannons
    ctx.fillStyle = '#555';
    ctx.fillRect(-r*0.25, -r*1.6, r*0.18, r*0.6);
    ctx.fillRect( r*0.07, -r*1.6, r*0.18, r*0.6);
  }

  _drawBomber(ctx, r, col, dark, flash) {
    // Huge swept wings
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -r*1.0);
    ctx.lineTo(-r*1.9, r*0.3);
    ctx.lineTo(-r*1.2, r*0.6);
    ctx.lineTo(0, r*0.3);
    ctx.lineTo(r*1.2, r*0.6);
    ctx.lineTo(r*1.9, r*0.3);
    ctx.closePath(); ctx.fill();

    // Fuselage (wide)
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.35, r*1.0, 0, 0, Math.PI*2);
    ctx.fillStyle = dark; ctx.fill();

    // Bomb bay door
    ctx.fillStyle = '#111';
    ctx.fillRect(-r*0.22, r*0.2, r*0.44, r*0.45);

    // Bomb visible
    ctx.beginPath();
    ctx.ellipse(0, r*0.42, r*0.14, r*0.22, 0, 0, Math.PI*2);
    ctx.fillStyle = '#888'; ctx.fill();
    ctx.fillStyle = '#f80';
    ctx.fillRect(-r*0.04, r*0.55, r*0.08, r*0.12);

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -r*0.6, r*0.18, r*0.28, 0, 0, Math.PI*2);
    ctx.fillStyle = '#88eeff66'; ctx.fill();

    // Engines (2x)
    for (const ox of [-r*0.6, r*0.6]) {
      ctx.beginPath(); ctx.arc(ox, r*0.5, r*0.18, 0, Math.PI*2);
      ctx.fillStyle = '#ff550099'; ctx.fill();
      ctx.beginPath(); ctx.arc(ox, r*0.5, r*0.09, 0, Math.PI*2);
      ctx.fillStyle = '#ffcc00cc'; ctx.fill();
    }
  }

  _drawSniper(ctx, r, col, dark, flash) {
    // Camo base
    ctx.fillStyle = dark;
    ctx.fillRect(-r*0.4, -r*0.35, r*0.8, r*0.7);

    // Ghillie suit
    const bumps = [[-r*0.3,-r*0.2],[r*0.2,-r*0.3],[-r*0.35,r*0.1],[r*0.3,r*0.15],
                   [0,-r*0.35],[-r*0.1,r*0.25],[r*0.1,-r*0.1]];
    ctx.fillStyle = col + 'aa';
    for (const [bx,by] of bumps) {
      ctx.beginPath(); ctx.arc(bx, by, r*0.2, 0, Math.PI*2);
      ctx.fill();
    }

    // Bipod legs
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r*0.15, r*0.35); ctx.lineTo(-r*0.4, r*0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.15, r*0.35); ctx.lineTo( r*0.4, r*0.7); ctx.stroke();

    // Ultra-long barrel
    ctx.fillStyle = '#555';
    ctx.fillRect(-r*0.07, -r*1.9, r*0.14, r*1.6);
    // Scope
    ctx.fillStyle = '#333';
    ctx.fillRect(-r*0.13, -r*1.5, r*0.26, r*0.2);
    ctx.beginPath(); ctx.arc(r*0.15, -r*1.4, r*0.14, 0, Math.PI*2);
    ctx.fillStyle = '#224'; ctx.fill();
    ctx.fillStyle = '#00aaff66';
    ctx.fill();
    // Muzzle
    ctx.fillStyle = '#333';
    ctx.fillRect(-r*0.12, -r*2.0, r*0.24, r*0.16);
    ctx.fillRect(-r*0.16, -r*1.95, r*0.32, r*0.1);
  }
}
