// =============================================
//  TOTAL ANNIHILATION: REBORN — Player
// =============================================
import { RESOURCE_CAP_BASE, RESOURCE_START } from './constants.js';

export class Player {
  constructor(id, faction, isHuman) {
    this.id       = id;
    this.faction  = faction;
    this.isHuman  = isHuman;

    this.metal       = RESOURCE_START.metal;
    this.energy      = RESOURCE_START.energy;
    this.metalCap    = RESOURCE_CAP_BASE;
    this.energyCap   = RESOURCE_CAP_BASE;
    this.metalRate   = 0;   // net per second
    this.energyRate  = 0;   // net per second

    // Accumulated production/consumption (recalculated each frame)
    this._metalProd  = 0;
    this._metalCons  = 0;
    this._energyProd = 0;
    this._energyCons = 0;

    this.defeated    = false;
    this.commander   = null;  // reference to commander unit
  }

  /** Recalculate resource rates from buildings */
  recalcRates(buildings) {
    this._metalProd  = 0;
    this._metalCons  = 0;
    this._energyProd = 0;
    this._energyCons = 0;

    for (const b of buildings) {
      if (b.playerId !== this.id || !b.built || b.dead) continue;
      this._metalProd  += b.metalProduction   ?? 0;
      this._energyProd += b.energyProduction  ?? 0;
      this._energyCons += b.energyConsumption ?? 0;
    }

    // Base income
    this._metalProd  += 0.5;   // passive metal trickle
    this._energyProd += 5;     // passive energy trickle

    this.metalRate  = this._metalProd  - this._metalCons;
    this.energyRate = this._energyProd - this._energyCons;
  }

  /** Called each frame to accumulate resources */
  tick(dt) {
    if (this.defeated) return;

    this.metal  = Math.min(this.metalCap,  Math.max(0, this.metal  + this.metalRate  * dt));
    this.energy = Math.min(this.energyCap, Math.max(0, this.energy + this.energyRate * dt));
  }

  canAfford(metal, energy) {
    return this.metal >= metal && this.energy >= energy;
  }

  spend(metal, energy) {
    this.metal  = Math.max(0, this.metal  - metal);
    this.energy = Math.max(0, this.energy - energy);
  }

  /** Attempt to spend resources for a full purchase. Returns true on success. */
  purchase(metalCost, energyCost) {
    if (!this.canAfford(metalCost, energyCost)) return false;
    this.spend(metalCost, energyCost);
    return true;
  }

  /** Recalc storage caps from storage buildings (simplified: count buildings) */
  recalcCaps(buildings) {
    let extraMetal  = 0;
    let extraEnergy = 0;
    // For now all buildings contribute no extra cap; future: add storage buildings
    this.metalCap  = RESOURCE_CAP_BASE + extraMetal;
    this.energyCap = RESOURCE_CAP_BASE + extraEnergy;
  }
}
