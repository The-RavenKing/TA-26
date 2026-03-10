// =============================================
//  TOTAL ANNIHILATION: REBORN — AI Player
// =============================================
import { TILE_SIZE } from './constants.js';
import { dist, worldToTile } from './utils.js';

const AIState = {
  BUILD_BASE   : 'build_base',
  EXPAND       : 'expand',
  PRODUCE_UNITS: 'produce_units',
  ATTACK       : 'attack',
  DEFEND       : 'defend',
};

const AI_THINK_INTERVAL = 3.0; // seconds between AI decisions

export class AIController {
  constructor(player, game) {
    this.player    = player;
    this.game      = game;
    this.state     = AIState.BUILD_BASE;
    this._timer    = Math.random() * AI_THINK_INTERVAL;
    this._phase    = 0;   // build order phase

    // Track ongoing build orders
    this._buildingInProgress = null;
    this._attackFormed       = false;
    this._lastAttackTime     = 0;
  }

  // Called each game tick
  update(dt) {
    if (this.player.defeated) return;

    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = AI_THINK_INTERVAL + (Math.random() - 0.5);

    this._think();
  }

  _think() {
    const game   = this.game;
    const player = this.player;
    const cmd    = player.commander;

    // If commander is dead, we've already lost or are very weak
    if (!cmd || cmd.dead) return;

    const myBuildings = game.buildings.filter(b => b.playerId === player.id && !b.dead);
    const myUnits     = game.units    .filter(u => u.playerId === player.id && !u.dead);
    const myMilitary  = myUnits.filter(u => u.def.id !== 'COMMANDER');

    // Decide state
    const hasSolar   = myBuildings.some(b => b.def.id === 'SOLAR_COLLECTOR' && b.built);
    const hasMex     = myBuildings.some(b => b.def.id === 'METAL_EXTRACTOR' && b.built);
    const hasKbotLab = myBuildings.some(b => b.def.id === 'KBOT_LAB'        && b.built);
    const hasVehicle = myBuildings.some(b => b.def.id === 'VEHICLE_PLANT'   && b.built);

    // Build order priority
    if (!hasSolar  && !this._isBuildingType('SOLAR_COLLECTOR'))  { this._buildNear(cmd, 'SOLAR_COLLECTOR'); return; }
    if (!hasMex    && !this._isBuildingType('METAL_EXTRACTOR'))  { this._buildMetal(cmd);                    return; }
    if (!hasKbotLab && !this._isBuildingType('KBOT_LAB') && player.canAfford(500, 6000)) {
      this._buildNear(cmd, 'KBOT_LAB'); return;
    }

    // Queue units in factories
    for (const b of myBuildings) {
      if (!b.built || b.canProduce.length === 0) continue;
      if (b.queue.length < 3) {
        const unitType = b.canProduce[0];
        b.enqueue(unitType);
      }
    }

    // Build more solar if energy is low
    if (player.energyRate < 10 && !this._isBuildingType('SOLAR_COLLECTOR')) {
      this._buildNear(cmd, 'SOLAR_COLLECTOR');
      return;
    }

    // Build more mex if metal is low
    if (player.metalRate < 2 && !this._isBuildingType('METAL_EXTRACTOR')) {
      this._buildMetal(cmd);
      return;
    }

    // Build vehicle plant if we have resources
    if (!hasVehicle && !this._isBuildingType('VEHICLE_PLANT') && player.canAfford(800, 8000)) {
      this._buildNear(cmd, 'VEHICLE_PLANT');
      return;
    }

    // Build defense
    const laserCount = myBuildings.filter(b => b.def.id === 'LASER_TOWER' && b.built).length;
    if (laserCount < 3 && !this._isBuildingType('LASER_TOWER') && player.canAfford(140, 3000)) {
      this._buildNear(cmd, 'LASER_TOWER');
      return;
    }

    // Attack with accumulated force
    const now = this.game.time;
    if (myMilitary.length >= 8 && now - this._lastAttackTime > 60) {
      this._launchAttack(myMilitary);
      this._lastAttackTime = now;
    }
  }

  _isBuildingType(defId) {
    return this.game.buildings.some(
      b => b.playerId === this.player.id && b.def.id === defId && !b.dead && !b.built
    );
  }

  _buildNear(commander, defId) {
    const def = this.game.getBuildingDef(defId);
    if (!def) return;
    if (!this.player.canAfford(def.metalCost, def.energyCost)) return;

    // Find a valid placement near the commander
    const cx = Math.floor(commander.x / TILE_SIZE);
    const cy = Math.floor(commander.y / TILE_SIZE);

    for (let r = 2; r <= 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (this.game.map.canPlace(tx, ty, def.tileW, def.tileH, def.requiresMetal ?? false)
              && !this.game.isTileOccupied(tx, ty, def.tileW, def.tileH)) {
            this.game.placeBuilding(defId, tx, ty, this.player.id, this.player.faction);
            const building = this.game.buildings[this.game.buildings.length - 1];
            commander.commandBuild(building);
            return;
          }
        }
      }
    }
  }

  _buildMetal(commander) {
    // Find nearest unoccupied metal deposit
    const deposits = this.game.map.metalDeposits.filter(d => {
      return !this.game.buildings.some(
        b => !b.dead && b.tx <= d.tx && d.tx < b.tx + b.tileW
                     && b.ty <= d.ty && d.ty < b.ty + b.tileH
      );
    });
    if (!deposits.length) return;

    // Nearest
    deposits.sort((a, b) => dist(commander.x, commander.y, a.px, a.py)
                          - dist(commander.x, commander.y, b.px, b.py));
    const d = deposits[0];
    const def = this.game.getBuildingDef('METAL_EXTRACTOR');
    if (!def) return;
    if (!this.player.canAfford(def.metalCost, def.energyCost)) return;

    // Try to place on or around the deposit
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = d.tx + dx;
        const ty = d.ty + dy;
        if (this.game.map.canPlace(tx, ty, def.tileW, def.tileH, true)
            && !this.game.isTileOccupied(tx, ty, def.tileW, def.tileH)) {
          this.game.placeBuilding('METAL_EXTRACTOR', tx, ty, this.player.id, this.player.faction);
          const building = this.game.buildings[this.game.buildings.length - 1];
          commander.commandBuild(building);
          return;
        }
      }
    }
  }

  _launchAttack(military) {
    // Find the human player's commander
    const humanPlayer = this.game.players.find(p => p.isHuman);
    if (!humanPlayer) return;

    const humanCmd = humanPlayer.commander;
    let target = humanCmd && !humanCmd.dead ? humanCmd : null;

    // Fallback: attack any human unit
    if (!target) {
      const humanUnits = this.game.units.filter(u => u.playerId === humanPlayer.id && !u.dead);
      if (humanUnits.length) target = humanUnits[0];
    }

    if (!target) return;

    for (const unit of military) {
      unit.commandAttack(target);
    }
  }
}
