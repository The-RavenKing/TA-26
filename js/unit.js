// =============================================
//  TOTAL ANNIHILATION: REBORN — Units
// =============================================
import { Entity } from './entity.js';
import { TILE_SIZE, FACTION_COLOR, FACTION_DARK, SELECTION_COLOR } from './constants.js';
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

    this.state      = UnitState.IDLE;
    this.angle      = 0;
    this.speed      = def.speed;
    this.radius     = def.radius;
    this.isAir      = def.isAir ?? false;

    // Movement
    this.waypoints  = [];   // [{x,y}] world-space waypoints
    this.moveTarget = null; // final destination

    // Combat
    this.attackTarget  = null;   // entity
    this.attackCooldown= 0;
    this.damage        = def.damage;
    this.attackRange   = def.attackRange;
    this.attackRate    = def.attackRate;  // attacks/sec
    this.minRange      = def.minRange ?? 0;
    this.splash        = def.splash ?? 0;
    this.sight         = def.sight;
    this.selected      = false;

    // Building (for commander)
    this.buildTarget   = null;   // building being constructed
    this.buildPower    = def.buildPower ?? 0;
    this.buildRange    = def.buildRange ?? 200;

    // Rally / patrol
    this.patrolA       = null;
    this.patrolB       = null;

    // Visual
    this._drawAngle    = 0;
    this.spawnEffect   = 1.0;  // scale up from 0 on spawn
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
    this.patrolA = a;
    this.patrolB = b;
    this.state   = UnitState.PATROL;
    this.waypoints = [{ ...b }];
  }

  // ---- Update ----
  update(dt, game) {
    super.update(dt);
    if (this.dead) return;

    // Spawn scale-in animation
    if (this.spawnEffect > 0) {
      this.spawnEffect = Math.max(0, this.spawnEffect - dt * 3);
    }

    // Cool down attack
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    switch (this.state) {
      case UnitState.IDLE:      this._updateIdle(dt, game);      break;
      case UnitState.MOVING:    this._updateMove(dt, game);      break;
      case UnitState.ATTACKING: this._updateAttack(dt, game);    break;
      case UnitState.BUILDING:  this._updateBuild(dt, game);     break;
      case UnitState.PATROL:    this._updatePatrol(dt, game);    break;
    }

    // Smooth visual angle
    this._drawAngle = this.angle;
    // Unit separation
    this._separate(game.units);
  }

  _updateIdle(dt, game) {
    // Auto-acquire enemies in sight range
    const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.sight);
    if (enemy && this.damage > 0) {
      this.attackTarget = enemy;
      this.state = UnitState.ATTACKING;
    }
  }

  _updateMove(dt, game) {
    if (!this.waypoints.length) {
      this.state = UnitState.IDLE;
      return;
    }
    const wp = this.waypoints[0];
    const d  = dist(this.x, this.y, wp.x, wp.y);

    if (d < 4) {
      this.waypoints.shift();
      if (!this.waypoints.length) {
        this.state = UnitState.IDLE;
      }
      return;
    }

    const spd = this.speed * dt;
    const ang = angle(this.x, this.y, wp.x, wp.y);
    this.x += Math.cos(ang) * spd;
    this.y += Math.sin(ang) * spd;
    this.angle = ang;

    // Attack-move: check for enemies while moving
    if (this.damage > 0) {
      const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.sight);
      if (enemy) {
        // Save current destination as patrol-return
        this.attackTarget = enemy;
        this.state = UnitState.ATTACKING;
      }
    }
  }

  _updateAttack(dt, game) {
    const t = this.attackTarget;
    if (!t || t.dead) {
      this.attackTarget = null;
      this.state = UnitState.IDLE;
      return;
    }

    const d = dist(this.x, this.y, t.x, t.y);

    // If we have a minimum range (artillery) and target too close, back up
    if (this.minRange > 0 && d < this.minRange) {
      const backAng = angle(t.x, t.y, this.x, this.y);
      this.x += Math.cos(backAng) * this.speed * dt;
      this.y += Math.sin(backAng) * this.speed * dt;
      this.angle = backAng;
      return;
    }

    // Move towards target if out of range
    if (d > this.attackRange * 0.9) {
      const ang = angle(this.x, this.y, t.x, t.y);
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
      this.angle = ang;
    }

    // Face target
    this.angle = angle(this.x, this.y, t.x, t.y);

    // Fire
    if (d <= this.attackRange && this.attackCooldown <= 0) {
      this._fireAt(t, game);
      this.attackCooldown = 1 / this.attackRate;
    }
  }

  _updateBuild(dt, game) {
    const b = this.buildTarget;
    if (!b || b.dead) {
      this.buildTarget = null;
      this.state = UnitState.IDLE;
      return;
    }

    const d = dist(this.x, this.y, b.x, b.y);
    if (d > this.buildRange) {
      // Move closer
      const ang = angle(this.x, this.y, b.x, b.y);
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
      this.angle = ang;
    } else {
      // Contribute build power
      this.angle = angle(this.x, this.y, b.x, b.y);
      b.applyBuild(this.buildPower * dt, game);
      if (b.built) {
        this.buildTarget = null;
        this.state = UnitState.IDLE;
      }
    }
  }

  _updatePatrol(dt, game) {
    const target = this.waypoints[0] || this.patrolB;
    if (!target) { this.state = UnitState.IDLE; return; }

    // Check for enemies
    const enemy = game.nearestEnemy(this.x, this.y, this.playerId, this.sight);
    if (enemy && this.damage > 0) {
      this.attackTarget = enemy;
      this.state = UnitState.ATTACKING;
      return;
    }

    const d = dist(this.x, this.y, target.x, target.y);
    if (d < 8) {
      // Reached waypoint, bounce between A and B
      if (!this.waypoints.length || this.waypoints[0] === this.patrolB) {
        this.waypoints = this.patrolA ? [{ ...this.patrolA }] : [];
      } else {
        this.waypoints = [{ ...this.patrolB }];
      }
      return;
    }

    const ang = angle(this.x, this.y, target.x, target.y);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    this.angle = ang;
  }

  _fireAt(target, game) {
    const projectileColor = this.faction === 'ARM' ? '#66ccff' : '#ff6644';
    const speed = 350;
    const proj = new Projectile(
      this.x, this.y,
      target.x, target.y,
      this.damage, speed,
      this.id, this.faction,
      this.splash, projectileColor
    );
    game.projectiles.push(proj);
  }

  /** Soft separation: push away from nearby units */
  _separate(units) {
    for (const u of units) {
      if (u === this || u.dead) continue;
      const dx = this.x - u.x;
      const dy = this.y - u.y;
      const d2 = dx * dx + dy * dy;
      const minD = this.radius + u.radius + 2;
      if (d2 < minD * minD && d2 > 0) {
        const d   = Math.sqrt(d2);
        const force = (minD - d) / d * 0.5;
        this.x += dx * force;
        this.y += dy * force;
      }
    }
  }

  // ---- Draw ----
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const r  = this.radius;
    const scale = 1 - this.spawnEffect * 0.7;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this._drawAngle + Math.PI / 2);
    ctx.scale(scale, scale);

    const col  = FACTION_COLOR[this.faction];
    const dark = FACTION_DARK[this.faction];

    // Damage flash
    const flash = this.damageFlash > 0;

    this._drawBody(ctx, r, col, dark, flash);

    ctx.restore();

    // Health bar
    this.drawHealthBar(ctx, sx, sy, r);

    // Selection ring
    if (this.selected) {
      ctx.beginPath();
      ctx.arc(sx, sy, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Build progress beam
    if (this.state === UnitState.BUILDING && this.buildTarget && !this.buildTarget.built) {
      const bx = this.buildTarget.x - camX;
      const by = this.buildTarget.y - camY;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = 'rgba(100,200,255,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawBody(ctx, r, col, dark, flash) {
    const defId = this.def.id;

    if (defId === 'COMMANDER') {
      this._drawCommander(ctx, r, col, dark, flash);
    } else if (defId === 'KBOT') {
      this._drawKbot(ctx, r, col, dark, flash);
    } else if (defId === 'TANK') {
      this._drawTank(ctx, r, col, dark, flash);
    } else if (defId === 'ARTILLERY') {
      this._drawArtillery(ctx, r, col, dark, flash);
    } else if (defId === 'FIGHTER') {
      this._drawFighter(ctx, r, col, dark, flash);
    } else {
      // Generic fallback
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = flash ? '#fff' : col;
      ctx.fill();
    }
  }

  _drawCommander(ctx, r, col, dark, flash) {
    // Body
    ctx.fillStyle = flash ? '#fff' : col;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.65, r * 0.5);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(-r * 0.65, r * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Glow ring (commander aura)
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = col + '66';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arms
    ctx.fillStyle = dark;
    ctx.fillRect(-r * 0.9, -r * 0.1, r * 0.3, r * 0.4);
    ctx.fillRect( r * 0.6, -r * 0.1, r * 0.3, r * 0.4);
  }

  _drawKbot(ctx, r, col, dark, flash) {
    // Legs
    ctx.fillStyle = dark;
    ctx.fillRect(-r * 0.4, r * 0.2, r * 0.3, r * 0.6);
    ctx.fillRect( r * 0.1, r * 0.2, r * 0.3, r * 0.6);

    // Body
    ctx.fillStyle = flash ? '#fff' : col;
    ctx.fillRect(-r * 0.5, -r * 0.5, r, r * 0.8);

    // Head
    ctx.fillStyle = dark;
    ctx.fillRect(-r * 0.3, -r * 0.8, r * 0.6, r * 0.4);

    // Gun
    ctx.fillStyle = '#888';
    ctx.fillRect(0, -r * 1.1, r * 0.15, r * 0.5);
  }

  _drawTank(ctx, r, col, dark, flash) {
    // Hull
    ctx.fillStyle = flash ? '#fff' : col;
    ctx.fillRect(-r, -r * 0.5, r * 2, r);

    // Treads
    ctx.fillStyle = dark;
    ctx.fillRect(-r, -r * 0.65, r * 2, r * 0.2);
    ctx.fillRect(-r, r * 0.45,  r * 2, r * 0.2);

    // Turret
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();

    // Barrel
    ctx.fillStyle = '#666';
    ctx.fillRect(-r * 0.08, -r * 1.1, r * 0.16, r * 0.7);
  }

  _drawArtillery(ctx, r, col, dark, flash) {
    // Hull (long)
    ctx.fillStyle = flash ? '#fff' : col;
    ctx.fillRect(-r * 0.7, -r * 0.4, r * 1.4, r * 0.8);

    // Treads
    ctx.fillStyle = dark;
    ctx.fillRect(-r * 0.7, -r * 0.55, r * 1.4, r * 0.18);
    ctx.fillRect(-r * 0.7,  r * 0.37, r * 1.4, r * 0.18);

    // Long barrel
    ctx.fillStyle = '#555';
    ctx.fillRect(-r * 0.07, -r * 1.5, r * 0.14, r);
  }

  _drawFighter(ctx, r, col, dark, flash) {
    // Wings
    ctx.fillStyle = flash ? '#fff' : col;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(-r * 1.5, r * 0.3);
    ctx.lineTo(0, 0);
    ctx.lineTo(r * 1.5, r * 0.3);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.25, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
