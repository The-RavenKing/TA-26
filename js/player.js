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

  /** Recalculate resource rates AND storage caps from buildings */
  recalcRates(buildings) {
    this._metalProd  = 0;
    this._metalCons  = 0;
    this._energyProd = 0;
    this._energyCons = 0;
    let metalCapBonus  = 0;
    let energyCapBonus = 0;

    for (const b of buildings) {
      if (b.playerId !== this.id || !b.built || b.dead) continue;
      this._metalProd  += b.metalProduction   ?? 0;
      this._energyProd += b.energyProduction  ?? 0;
      this._energyCons += b.energyConsumption ?? 0;
      metalCapBonus    += b.metalCapBonus     ?? 0;
      energyCapBonus   += b.energyCapBonus    ?? 0;
    }

    // Base income
    this._metalProd  += 0.5;
    this._energyProd += 5;

    this.metalRate  = this._metalProd  - this._metalCons;
    this.energyRate = this._energyProd - this._energyCons;

    this.metalCap  = RESOURCE_CAP_BASE + metalCapBonus;
    this.energyCap = RESOURCE_CAP_BASE + energyCapBonus;
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

  /** Legacy stub kept for compatibility — logic moved into recalcRates */
  recalcCaps(buildings) {}
}
