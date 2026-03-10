// =============================================
//  TOTAL ANNIHILATION: REBORN — AI Controller
// =============================================
import { TILE_SIZE } from './constants.js';
import { dist } from './utils.js';

const AI_THINK_INTERVAL = 3.5;

// Build order phases: list of steps to execute in order
const BUILD_ORDER = [
  { type: 'building', id: 'SOLAR_COLLECTOR' },
  { type: 'metal',    id: 'METAL_EXTRACTOR' },
  { type: 'building', id: 'SOLAR_COLLECTOR' },
  { type: 'building', id: 'KBOT_LAB'        },
  { type: 'metal',    id: 'METAL_EXTRACTOR' },
  { type: 'building', id: 'SOLAR_COLLECTOR' },
  { type: 'building', id: 'LASER_TOWER'     },
  { type: 'building', id: 'VEHICLE_PLANT'   },
  { type: 'metal',    id: 'METAL_EXTRACTOR' },
  { type: 'building', id: 'SOLAR_COLLECTOR' },
  { type: 'building', id: 'MISSILE_TOWER'   },
  { type: 'building', id: 'METAL_STORAGE'   },
  { type: 'building', id: 'FUSION_REACTOR'  },
  { type: 'building', id: 'ADVANCED_LAB'    },
  { type: 'building', id: 'REPAIR_PAD'      },
];

export class AIController {
  constructor(player, game) {
    this.player          = player;
    this.game            = game;
    this._timer          = Math.random() * AI_THINK_INTERVAL;
    this._buildPhase     = 0;
    this._lastAttackTime = 0;
    this._attackInterval = 90;  // seconds between attack waves
  }

  update(dt) {
    if (this.player.defeated) return;
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = AI_THINK_INTERVAL + (Math.random() - 0.5) * 1.5;
    this._think();
  }

  _think() {
    const { game, player } = this;
    const cmd = player.commander;
    if (!cmd || cmd.dead) return;

    const myBuildings = game.buildings.filter(b => b.playerId === player.id && !b.dead);
    const myUnits     = game.units    .filter(u => u.playerId === player.id && !u.dead);
    const myMilitary  = myUnits.filter(u => u.def.id !== 'COMMANDER' && u.def.id !== 'CONSTRUCTOR');
    const myIdle      = myMilitary.filter(u => u.state === 'idle' || u.state === 'moving');

    // ── Build order ──────────────────────────────────────────
    this._executeBuildOrder(cmd, myBuildings, player);

    // ── Queue units in factories ──────────────────────────────
    this._queueProduction(myBuildings, player);

    // ── Economy maintenance ───────────────────────────────────
    // Extra energy
    if (player.energyRate < 20 && !this._isBuildingInProgress('SOLAR_COLLECTOR')
        && !this._isBuildingInProgress('FUSION_REACTOR')) {
      this._buildNear(cmd, 'SOLAR_COLLECTOR');
      return;
    }
    // Extra metal
    if (player.metalRate < 3 && !this._isBuildingInProgress('METAL_EXTRACTOR')) {
      this._buildMetal(cmd);
      return;
    }

    // ── Attack wave ───────────────────────────────────────────
    const now = game.time;
    if (myIdle.length >= 6 && now - this._lastAttackTime > this._attackInterval) {
      this._launchAttack(myIdle);
      this._lastAttackTime = now;
      this._attackInterval = Math.max(45, this._attackInterval - 5);
    }

    // ── Guard perimeter with leftover idle units ──────────────
    if (myIdle.length > 0 && myIdle.length < 6) {
      const basePt = { x: cmd.x, y: cmd.y };
      for (const u of myIdle) {
        if (dist(u.x, u.y, basePt.x, basePt.y) > 400) {
          u.commandMove(basePt.x + (Math.random()-0.5)*150, basePt.y + (Math.random()-0.5)*150);
        }
      }
    }
  }

  _executeBuildOrder(cmd, myBuildings, player) {
    if (this._buildPhase >= BUILD_ORDER.length) return;

    const step = BUILD_ORDER[this._buildPhase];

    // Check if this step is already done (building exists and is built)
    if (step.type === 'building') {
      const exists = myBuildings.some(b => b.def.id === step.id && b.built);
      if (exists) { this._buildPhase++; return; }
      if (this._isBuildingInProgress(step.id)) return;

      const def = this.game.getBuildingDef(step.id);
      if (!def || !player.canAfford(def.metalCost, def.energyCost)) return;

      if (this._buildNear(cmd, step.id)) this._buildPhase++;

    } else if (step.type === 'metal') {
      const mexCount = myBuildings.filter(b => b.def.id === 'METAL_EXTRACTOR' && b.built).length;
      const targetMex = BUILD_ORDER.slice(0, this._buildPhase + 1)
                                   .filter(s => s.type === 'metal').length;
      if (mexCount >= targetMex) { this._buildPhase++; return; }
      if (this._isBuildingInProgress('METAL_EXTRACTOR')) return;

      const def = this.game.getBuildingDef('METAL_EXTRACTOR');
      if (!def || !player.canAfford(def.metalCost, def.energyCost)) return;

      if (this._buildMetal(cmd)) this._buildPhase++;
    }
  }

  _queueProduction(myBuildings, player) {
    for (const b of myBuildings) {
      if (!b.built || b.canProduce.length === 0) continue;
      if (b.queue.length >= 4) continue;

      // Pick unit type based on composition
      const myUnits = this.game.units.filter(u => u.playerId === player.id && !u.dead);
      const counts  = {};
      for (const u of myUnits) counts[u.def.id] = (counts[u.def.id] || 0) + 1;

      // Prefer variety
      let best = b.canProduce[0];
      let minCount = Infinity;
      for (const id of b.canProduce) {
        const c = counts[id] || 0;
        if (c < minCount) { minCount = c; best = id; }
      }

      // Check rough resource feasibility
      const def = this.game.getUnitDef(best);
      if (def && player.canAfford(def.metalCost * 0.15, def.energyCost * 0.15)) {
        b.enqueue(best);
      }
    }
  }

  _isBuildingInProgress(defId) {
    return this.game.buildings.some(
      b => b.playerId === this.player.id && b.def.id === defId && !b.dead && !b.built
    );
  }

  _buildNear(commander, defId) {
    const def = this.game.getBuildingDef(defId);
    if (!def) return false;
    if (!this.player.canAfford(def.metalCost, def.energyCost)) return false;

    const cx = Math.floor(commander.x / TILE_SIZE);
    const cy = Math.floor(commander.y / TILE_SIZE);

    for (let r = 2; r <= 14; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx, ty = cy + dy;
          if (this.game.map.canPlace(tx, ty, def.tileW, def.tileH, false)
              && !this.game.isTileOccupied(tx, ty, def.tileW, def.tileH)) {
            this.game.placeBuilding(defId, tx, ty, this.player.id, this.player.faction);
            const building = this.game.buildings[this.game.buildings.length - 1];
            commander.commandBuild(building);
            return true;
          }
        }
      }
    }
    return false;
  }

  _buildMetal(commander) {
    const game = this.game;
    const deposits = game.map.metalDeposits.filter(d =>
      !game.buildings.some(b =>
        !b.dead &&
        b.tx <= d.tx && d.tx < b.tx + b.tileW &&
        b.ty <= d.ty && d.ty < b.ty + b.tileH
      )
    );
    if (!deposits.length) return false;

    deposits.sort((a, b) => dist(commander.x, commander.y, a.px, a.py)
                          - dist(commander.x, commander.y, b.px, b.py));
    const d   = deposits[0];
    const def = game.getBuildingDef('METAL_EXTRACTOR');
    if (!def || !this.player.canAfford(def.metalCost, def.energyCost)) return false;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = d.tx + dx, ty = d.ty + dy;
        if (game.map.canPlace(tx, ty, def.tileW, def.tileH, true)
            && !game.isTileOccupied(tx, ty, def.tileW, def.tileH)) {
          game.placeBuilding('METAL_EXTRACTOR', tx, ty, this.player.id, this.player.faction);
          const building = game.buildings[game.buildings.length - 1];
          commander.commandBuild(building);
          return true;
        }
      }
    }
    return false;
  }

  _launchAttack(military) {
    const humanPlayer = this.game.players.find(p => p.isHuman);
    if (!humanPlayer) return;

    const humanCmd = humanPlayer.commander;
    let target = humanCmd && !humanCmd.dead ? humanCmd : null;

    if (!target) {
      const humanUnits = this.game.units.filter(u => u.playerId === humanPlayer.id && !u.dead);
      if (humanUnits.length) {
        // Attack the nearest human unit to the AI base
        humanUnits.sort((a, b) => {
          const cmdPos = this.player.commander;
          return dist(a.x, a.y, cmdPos?.x || 0, cmdPos?.y || 0)
               - dist(b.x, b.y, cmdPos?.x || 0, cmdPos?.y || 0);
        });
        target = humanUnits[0];
      }
    }

    if (!target) return;
    for (const unit of military) unit.commandAttack(target);
  }
}
