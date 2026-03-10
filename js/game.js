// =============================================
//  TOTAL ANNIHILATION: REBORN — Game Logic
// =============================================
import { TILE_SIZE, UNIT_DEF, BUILDING_DEF, FACTION } from './constants.js';
import { dist, dist2 } from './utils.js';
import { GameMap } from './map.js';
import { Pathfinder } from './pathfinding.js';
import { Unit } from './unit.js';
import { Building } from './building.js';
import { Player } from './player.js';
import { AIController } from './ai.js';
import { Explosion } from './projectile.js';

export class Game {
  constructor(humanFaction) {
    this.humanFaction = humanFaction;
    this.aiFaction    = humanFaction === FACTION.ARM ? FACTION.CORE : FACTION.ARM;

    // World objects
    this.map          = new GameMap(Date.now() & 0xFFFFFF);
    this.pathfinder   = new Pathfinder(this.map);
    this.units        = [];
    this.buildings    = [];
    this.projectiles  = [];
    this.explosions   = [];

    // Players
    this.players = [
      new Player(0, humanFaction, true),
      new Player(1, this.aiFaction, false),
    ];
    this.ai = new AIController(this.players[1], this);

    // State
    this.time     = 0;
    this.gameOver = false;
    this.winner   = null;

    // Notifications queue (relayed to UI)
    this._notifQueue    = [];
    this._newExplosions = [];  // populated each frame for screen shake

    this._initGame();
  }

  _initGame() {
    const map = this.map;

    // Starting positions: corners of the map
    const humanStart = { tx: 5,  ty: 5  };
    const aiStart    = { tx: map.width - 8,  ty: map.height - 8 };

    // Spawn commanders
    const hcPx = (humanStart.tx + 1) * TILE_SIZE;
    const hcPy = (humanStart.ty + 1) * TILE_SIZE;
    const acPx = (aiStart.tx + 1) * TILE_SIZE;
    const acPy = (aiStart.ty + 1) * TILE_SIZE;

    const humanCmd = this._spawnUnit('COMMANDER', hcPx, hcPy, 0, this.humanFaction);
    const aiCmd    = this._spawnUnit('COMMANDER', acPx, acPy, 1, this.aiFaction);

    this.players[0].commander = humanCmd;
    this.players[1].commander = aiCmd;

    // Give AI a head start: pre-build a solar collector
    const aiSolar = this.placeBuilding('SOLAR_COLLECTOR', aiStart.tx + 3, aiStart.ty, 1, this.aiFaction);
    aiSolar.buildProgress = 1;
    aiSolar.built = true;
    aiSolar.hp = aiSolar.maxHp;
  }

  // ---- Spawning ----
  _spawnUnit(defId, x, y, playerId, faction) {
    const def  = UNIT_DEF[defId];
    if (!def) return null;
    const unit = new Unit(x, y, def, playerId, faction);
    this.units.push(unit);
    return unit;
  }

  spawnUnit(defId, x, y, playerId, faction) {
    return this._spawnUnit(defId, x, y, playerId, faction);
  }

  placeBuilding(defId, tx, ty, playerId, faction) {
    const def = BUILDING_DEF[defId];
    if (!def) return null;
    const b = new Building(tx, ty, def, playerId, faction);
    this.buildings.push(b);
    return b;
  }

  // ---- Query helpers ----
  getUnitDef(id)     { return UNIT_DEF[id];     }
  getBuildingDef(id) { return BUILDING_DEF[id]; }
  getPlayer(id)      { return this.players[id];  }

  nearestEnemy(wx, wy, playerId, range, preferAir = false) {
    let best = null, bestD = range * range;

    for (const u of this.units) {
      if (u.playerId === playerId || u.dead) continue;
      if (preferAir && !u.isAir) continue;  // anti-air targets air first
      const d = dist2(wx, wy, u.x, u.y);
      if (d < bestD) { bestD = d; best = u; }
    }

    // If anti-air found nothing, fall back to any enemy
    if (preferAir && !best) {
      for (const u of this.units) {
        if (u.playerId === playerId || u.dead) continue;
        const d = dist2(wx, wy, u.x, u.y);
        if (d < bestD) { bestD = d; best = u; }
      }
    }

    if (!preferAir) {
      for (const b of this.buildings) {
        if (b.playerId === playerId || b.dead || !b.built) continue;
        const d = dist2(wx, wy, b.x, b.y);
        if (d < bestD) { bestD = d; best = b; }
      }
    }

    return best;
  }

  entityAt(wx, wy, playerId, enemyOnly) {
    // Check units (prefer own unless enemyOnly)
    const hitRadius = 20;

    for (const u of this.units) {
      if (u.dead) continue;
      if (enemyOnly && u.playerId === playerId) continue;
      if (dist(wx, wy, u.x, u.y) < u.radius + hitRadius) return u;
    }

    for (const b of this.buildings) {
      if (b.dead) continue;
      if (enemyOnly && b.playerId === playerId) continue;
      const bx1 = b.x - b.pw / 2, by1 = b.y - b.ph / 2;
      if (wx >= bx1 && wx <= bx1 + b.pw && wy >= by1 && wy <= by1 + b.ph) return b;
    }

    return null;
  }

  getSelected(playerId) {
    const out = [];
    for (const u of this.units)     { if (!u.dead && u.playerId === playerId && u.selected) out.push(u); }
    for (const b of this.buildings) { if (!b.dead && b.playerId === playerId && b.selected) out.push(b); }
    return out;
  }

  deselectAll(playerId) {
    for (const u of this.units)     { if (u.playerId === playerId) u.selected = false; }
    for (const b of this.buildings) { if (b.playerId === playerId) b.selected = false; }
  }

  isTileOccupied(tx, ty, tw, th) {
    for (const b of this.buildings) {
      if (b.dead) continue;
      // Check overlap
      if (tx < b.tx + b.tileW && tx + tw > b.tx
       && ty < b.ty + b.tileH && ty + th > b.ty) return true;
    }
    return false;
  }

  notify(msg, playerId) {
    this._notifQueue.push({ msg, playerId });
  }

  // ---- Main Update ----
  update(dt) {
    if (this.gameOver) return;

    this.time += dt;

    // Recalculate resource rates
    for (const p of this.players) {
      p.recalcRates(this.buildings);
      p.tick(dt);
    }

    // Update units
    for (const u of this.units) {
      if (!u.dead) u.update(dt, this);
    }

    // Update buildings
    for (const b of this.buildings) {
      if (!b.dead) b.update(dt, this);
    }

    // Update projectiles — call hit handler immediately when a projectile dies
    for (const p of this.projectiles) {
      if (!p.dead) {
        p.update(dt);
        if (p.dead) this._onProjectileHit(p);
      }
    }

    // Update explosions
    for (const e of this.explosions) {
      if (!e.dead) e.update(dt);
    }

    // Update AI
    this.ai.update(dt);

    // Flush dead objects
    this._cleanup();

    // Check win/lose conditions
    this._checkVictory();
  }

  _onProjectileHit(proj) {
    if (proj._processed) return;
    proj._processed = true;

    const targets = [...this.units, ...this.buildings];

    for (const t of targets) {
      if (t.dead) continue;
      if (t.id === proj.owner) continue;
      // Don't damage friendlies
      if (t.faction === proj.faction) continue;

      const d = dist(proj.tx, proj.ty, t.x, t.y);
      const hitR = (t.radius ?? (t.pw / 2)) + 8;

      if (proj.splash > 0) {
        // Splash damage
        if (d < proj.splash) {
          const falloff = 1 - d / proj.splash;
          t.takeDamage(proj.damage * falloff);
        }
      } else if (d < hitR) {
        t.takeDamage(proj.damage);
      }
    }

    // Spawn explosion
    const radius = proj.splash > 0 ? proj.splash * 0.5 : 20;
    const ex = new Explosion(proj.tx, proj.ty, radius);
    this.explosions.push(ex);
    this._newExplosions.push(ex);
  }

  _cleanup() {
    // Purge dead units
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.dead) {
        const ex = new Explosion(u.x, u.y, u.radius * 2.5, '#ff6622');
        this.explosions.push(ex);
        this._newExplosions.push(ex);
        this.units.splice(i, 1);
      }
    }

    // Purge dead buildings
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b.dead) {
        this.explosions.push(new Explosion(b.x, b.y, Math.min(b.pw, b.ph), '#ff4400'));
        this.buildings.splice(i, 1);
      }
    }

    // Purge processed projectiles
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // Purge old explosions
    this.explosions = this.explosions.filter(e => !e.dead);
  }

  _checkVictory() {
    for (const p of this.players) {
      const cmd = p.commander;
      // Commander destroyed = defeat for that player
      if (!cmd || cmd.dead || !this.units.includes(cmd)) {
        p.defeated = true;
        p.commander = null;
      }
    }

    const defeated = this.players.find(p => p.defeated);
    if (defeated) {
      this.gameOver = true;
      const humanPlayer = this.players.find(p => p.isHuman);
      this.winner = humanPlayer.defeated ? null : humanPlayer;
    }
  }
}
