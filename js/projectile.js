// =============================================
//  TOTAL ANNIHILATION: REBORN — Projectiles
// =============================================
import { dist } from './utils.js';

export class Projectile {
  constructor(sx, sy, tx, ty, damage, speed, ownerId, ownerFaction, splash = 0, color = '#ffff44') {
    this.x       = sx;
    this.y       = sy;
    this.tx      = tx;
    this.ty      = ty;
    this.damage  = damage;
    this.speed   = speed;
    this.owner   = ownerId;
    this.faction = ownerFaction;
    this.splash  = splash;    // 0 = no splash
    this.color   = color;
    this.dead    = false;

    const dx = tx - sx, dy = ty - sy;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx  = (dx / d) * speed;
    this.vy  = (dy / d) * speed;

    this.trail   = [{ x: sx, y: sy }];
    this.trailMax = 8;
  }

  update(dt) {
    const prev = { x: this.x, y: this.y };
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.trailMax) this.trail.shift();

    // Check if reached target
    const d = dist(this.x, this.y, this.tx, this.ty);
    if (d < this.speed * dt * 1.5) {
      this.x   = this.tx;
      this.y   = this.ty;
      this.dead = true;
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;

    // Trail
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x - camX, this.trail[0].y - camY);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x - camX, this.trail[i].y - camY);
      }
      ctx.strokeStyle = this.color + '55';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Head
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.color + '44';
    ctx.fill();
  }
}

export class Explosion {
  constructor(x, y, radius, color = '#ff8800') {
    this.x      = x;
    this.y      = y;
    this.radius = radius;
    this.maxR   = radius;
    this.life   = 1.0;   // 0..1
    this.color  = color;
    this.dead   = false;
    this.particles = Array.from({ length: 8 }, () => ({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      r: Math.random() * 3 + 1,
      life: 1.0,
    }));
  }

  update(dt) {
    this.life -= dt * 2.5;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 3;
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const t  = 1 - this.life;

    // Shockwave ring
    const r = this.maxR * t * 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,150,50,${this.life * 0.5})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Core flash
    const cr = this.maxR * (1 - t);
    if (cr > 0) {
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, cr);
      grad.addColorStop(0, `rgba(255,255,200,${this.life})`);
      grad.addColorStop(0.4, `rgba(255,150,50,${this.life * 0.8})`);
      grad.addColorStop(1, 'rgba(200,50,0,0)');
      ctx.beginPath();
      ctx.arc(sx, sy, cr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Particles
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,50,${p.life})`;
      ctx.fill();
    }
  }
}
