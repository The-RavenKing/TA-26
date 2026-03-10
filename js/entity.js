// =============================================
//  TOTAL ANNIHILATION: REBORN — Base Entity
// =============================================
import { hpColor } from './constants.js';

let _nextId = 1;
export function nextId() { return _nextId++; }

export class Entity {
  constructor(x, y, def, playerId, faction) {
    this.id       = nextId();
    this.x        = x;      // world x (center)
    this.y        = y;      // world y (center)
    this.def      = def;
    this.playerId = playerId;
    this.faction  = faction;

    this.hp     = def.maxHp;
    this.maxHp  = def.maxHp;
    this.dead   = false;

    this.damageFlash = 0;   // ms remaining of damage flash
  }

  get hpPct() { return this.hp / this.maxHp; }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 180;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt) {
    if (this.damageFlash > 0) this.damageFlash -= dt * 1000;
  }

  /** Draw a health bar centered at (cx, cy - radius - gap) */
  drawHealthBar(ctx, cx, cy, radius) {
    const bw = Math.max(radius * 2.2, 20);
    const bh = 4;
    const bx = cx - bw / 2;
    const by = cy - radius - 8;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);

    ctx.fillStyle = hpColor(this.hpPct);
    ctx.fillRect(bx, by, bw * this.hpPct, bh);
  }
}
