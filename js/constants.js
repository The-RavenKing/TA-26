// =============================================
//  TOTAL ANNIHILATION: REBORN — Constants
// =============================================

export const TILE_SIZE = 40;
export const MAP_W     = 80;
export const MAP_H     = 60;

// ---- Terrain ----
export const TERRAIN = {
  GRASS      : 0,
  ROCK       : 1,
  WATER      : 2,
  METAL      : 3,
  SAND       : 4,
  GEOTHERMAL : 5,
};

export const TERRAIN_COLOR = {
  0: '#2d4a1e',
  1: '#3d3d3d',
  2: '#1a3a5c',
  3: '#2d4a1e',
  4: '#5a4a2a',
  5: '#2d1a0a',
};

export const TERRAIN_WALKABLE = {
  0: true,   // GRASS
  1: false,  // ROCK
  2: false,  // WATER (ground only)
  3: true,   // METAL
  4: true,   // SAND
  5: true,   // GEOTHERMAL
};

export const TERRAIN_BUILDABLE = {
  0: true,
  1: false,
  2: false,
  3: true,
  4: true,
  5: true,
};

// ---- Factions ----
export const FACTION = { ARM: 'ARM', CORE: 'CORE' };

export const FACTION_COLOR  = { ARM: '#4499ff', CORE: '#ff4444' };
export const FACTION_DARK   = { ARM: '#1155aa', CORE: '#aa1111' };
export const FACTION_ACCENT = { ARM: '#88ddff', CORE: '#ffaa88' };

// ---- Unit Definitions ----
export const UNIT_DEF = {
  // ── Tier 0 — Commander ──────────────────────────────────────
  COMMANDER: {
    id: 'COMMANDER', tier: 0,
    name: 'Commander', armName: 'ARM Commander', coreName: 'CORE Commander',
    maxHp: 2500, armor: 4, speed: 55,
    damage: 150, attackRange: 210, attackRate: 1.2,
    sight: 380, radius: 16,
    buildPower: 30, buildRange: 220,
    metalCost: 0, energyCost: 0, buildTime: 0,
    canBuild: [
      'METAL_EXTRACTOR','SOLAR_COLLECTOR','KBOT_LAB',
      'VEHICLE_PLANT','LASER_TOWER','RADAR','FUSION_REACTOR',
      'METAL_STORAGE','ENERGY_STORAGE','MISSILE_TOWER',
      'ADVANCED_LAB','REPAIR_PAD','GEOTHERMAL',
    ],
    desc: 'Supreme commander. If it falls, you lose.',
  },

  // ── Tier 1 ──────────────────────────────────────────────────
  KBOT: {
    id: 'KBOT', tier: 1,
    name: 'Kbot', armName: 'AK', coreName: 'Peewee',
    maxHp: 165, armor: 1, speed: 85,
    damage: 28, attackRange: 175, attackRate: 2.2,
    sight: 270, radius: 8,
    buildPower: 0,
    metalCost: 52, energyCost: 104, buildTime: 12,
    desc: 'Fast light infantry. Cheap and numerous.',
  },

  TANK: {
    id: 'TANK', tier: 1,
    name: 'Tank', armName: 'Stumpy', coreName: 'Reaper',
    maxHp: 400, armor: 5, speed: 52,
    damage: 70, attackRange: 220, attackRate: 0.9,
    sight: 290, radius: 11,
    buildPower: 0,
    metalCost: 145, energyCost: 290, buildTime: 28,
    desc: 'Reliable medium tank with good all-round stats.',
  },

  HOVER_TANK: {
    id: 'HOVER_TANK', tier: 1,
    name: 'Hover Tank', armName: 'Skimmer', coreName: 'Comet',
    maxHp: 260, armor: 2, speed: 105,
    damage: 48, attackRange: 195, attackRate: 1.6,
    sight: 310, radius: 10,
    buildPower: 0,
    metalCost: 115, energyCost: 230, buildTime: 20,
    isHover: true,
    desc: 'Amphibious hover vehicle. Crosses water at full speed.',
  },

  CONSTRUCTOR: {
    id: 'CONSTRUCTOR', tier: 1,
    name: 'Constructor', armName: 'ARM Con', coreName: 'CORE Con',
    maxHp: 120, armor: 0, speed: 60,
    damage: 0, attackRange: 0, attackRate: 0,
    sight: 250, radius: 9,
    buildPower: 18, buildRange: 200,
    metalCost: 105, energyCost: 210, buildTime: 22,
    canBuild: [
      'METAL_EXTRACTOR','SOLAR_COLLECTOR','KBOT_LAB',
      'VEHICLE_PLANT','LASER_TOWER','RADAR',
      'METAL_STORAGE','ENERGY_STORAGE','MISSILE_TOWER',
      'REPAIR_PAD','GEOTHERMAL',
    ],
    desc: 'Dedicated builder. Cannot fight but constructs quickly.',
  },

  ARTILLERY: {
    id: 'ARTILLERY', tier: 1,
    name: 'Artillery', armName: 'Morty', coreName: 'Slasher',
    maxHp: 130, armor: 1, speed: 40,
    damage: 300, attackRange: 560, attackRate: 0.25,
    sight: 300, radius: 9,
    buildPower: 0,
    metalCost: 185, energyCost: 370, buildTime: 42,
    minRange: 80, splash: 65,
    desc: 'Long-range siege. Devastating splash damage.',
  },

  FIGHTER: {
    id: 'FIGHTER', tier: 1,
    name: 'Fighter', armName: 'Freedom Fighter', coreName: 'Viper',
    maxHp: 210, armor: 2, speed: 160,
    damage: 50, attackRange: 200, attackRate: 1.5,
    sight: 420, radius: 8,
    buildPower: 0,
    metalCost: 155, energyCost: 310, buildTime: 25,
    isAir: true,
    desc: 'Air superiority fighter.',
  },

  // ── Tier 2 ──────────────────────────────────────────────────
  HEAVY_BOT: {
    id: 'HEAVY_BOT', tier: 2,
    name: 'Heavy Bot', armName: 'Goliath', coreName: 'Juggernaut',
    maxHp: 1000, armor: 10, speed: 28,
    damage: 220, attackRange: 260, attackRate: 0.55,
    sight: 300, radius: 14,
    buildPower: 0,
    metalCost: 480, energyCost: 960, buildTime: 85,
    desc: 'Tier-2 walking fortress. Slow but near-unstoppable.',
  },

  BOMBER: {
    id: 'BOMBER', tier: 2,
    name: 'Bomber', armName: 'Brawler', coreName: 'Shadow',
    maxHp: 320, armor: 2, speed: 115,
    damage: 650, attackRange: 290, attackRate: 0.17,
    sight: 380, radius: 11,
    buildPower: 0,
    metalCost: 360, energyCost: 720, buildTime: 58,
    isAir: true, splash: 90,
    desc: 'Heavy bomber. Massive splash damage on ground targets.',
  },

  SNIPER: {
    id: 'SNIPER', tier: 2,
    name: 'Sniper', armName: 'Marksman', coreName: 'Pillager',
    maxHp: 185, armor: 1, speed: 45,
    damage: 550, attackRange: 720, attackRate: 0.11,
    sight: 620, radius: 9,
    buildPower: 0,
    metalCost: 310, energyCost: 620, buildTime: 62,
    minRange: 150,
    desc: 'Extreme range precision unit. One-shots most light units.',
  },
};

// ---- Building Definitions ----
export const BUILDING_DEF = {
  // ── Economy ──────────────────────────────────────────────────
  METAL_EXTRACTOR: {
    id: 'METAL_EXTRACTOR', tier: 1,
    name: 'Metal Extractor',
    maxHp: 360, tileW: 2, tileH: 2,
    metalProduction: 2.2, energyConsumption: 0,
    metalCost: 50, energyCost: 500, buildTime: 45,
    requiresMetal: true,
    icon: '⛏', desc: 'Extracts metal from deposits.',
  },
  SOLAR_COLLECTOR: {
    id: 'SOLAR_COLLECTOR', tier: 1,
    name: 'Solar Collector',
    maxHp: 290, tileW: 2, tileH: 2,
    energyProduction: 22,
    metalCost: 155, energyCost: 0, buildTime: 35,
    icon: '☀', desc: 'Produces 22 energy/s.',
  },
  FUSION_REACTOR: {
    id: 'FUSION_REACTOR', tier: 2,
    name: 'Fusion Reactor',
    maxHp: 900, tileW: 3, tileH: 3,
    energyProduction: 250,
    metalCost: 900, energyCost: 3000, buildTime: 200,
    icon: '⚡', desc: 'Produces 250 energy/s.',
  },
  GEOTHERMAL: {
    id: 'GEOTHERMAL', tier: 2,
    name: 'Geothermal Plant',
    maxHp: 650, tileW: 2, tileH: 2,
    energyProduction: 160,
    metalCost: 420, energyCost: 0, buildTime: 90,
    requiresGeo: true,
    icon: '🌋', desc: 'Taps geothermal vents for 160 energy/s.',
  },
  METAL_STORAGE: {
    id: 'METAL_STORAGE', tier: 1,
    name: 'Metal Storage',
    maxHp: 420, tileW: 2, tileH: 2,
    metalCapBonus: 500,
    metalCost: 120, energyCost: 500, buildTime: 40,
    icon: '🗄', desc: '+500 metal storage capacity.',
  },
  ENERGY_STORAGE: {
    id: 'ENERGY_STORAGE', tier: 1,
    name: 'Energy Storage',
    maxHp: 420, tileW: 2, tileH: 2,
    energyCapBonus: 1000,
    metalCost: 90, energyCost: 0, buildTime: 35,
    icon: '🔋', desc: '+1000 energy storage capacity.',
  },

  // ── Production ───────────────────────────────────────────────
  KBOT_LAB: {
    id: 'KBOT_LAB', tier: 1,
    name: 'Kbot Lab',
    maxHp: 950, tileW: 4, tileH: 4,
    metalCost: 520, energyCost: 6500, buildTime: 125,
    canProduce: ['KBOT', 'CONSTRUCTOR', 'ARTILLERY'],
    icon: '🤖', desc: 'Produces infantry, constructors, artillery.',
  },
  VEHICLE_PLANT: {
    id: 'VEHICLE_PLANT', tier: 1,
    name: 'Vehicle Plant',
    maxHp: 950, tileW: 5, tileH: 4,
    metalCost: 850, energyCost: 8500, buildTime: 160,
    canProduce: ['TANK', 'HOVER_TANK', 'FIGHTER'],
    icon: '🏭', desc: 'Produces tanks, hover tanks, fighters.',
  },
  ADVANCED_LAB: {
    id: 'ADVANCED_LAB', tier: 2,
    name: 'Advanced Lab',
    maxHp: 1300, tileW: 5, tileH: 5,
    metalCost: 2200, energyCost: 22000, buildTime: 320,
    canProduce: ['HEAVY_BOT', 'BOMBER', 'SNIPER'],
    icon: '🔬', desc: 'Tier-2: heavy bots, bombers, snipers.',
  },

  // ── Defense ──────────────────────────────────────────────────
  LASER_TOWER: {
    id: 'LASER_TOWER', tier: 1,
    name: 'Laser Tower', armName: 'Guardian', coreName: 'HLT',
    maxHp: 600, tileW: 2, tileH: 2,
    damage: 60, attackRange: 280, attackRate: 2.5,
    metalCost: 145, energyCost: 3200, buildTime: 55,
    icon: '🗼', desc: 'Medium-range laser defense.',
  },
  MISSILE_TOWER: {
    id: 'MISSILE_TOWER', tier: 1,
    name: 'Missile Tower', armName: 'Defender', coreName: 'Pulsar',
    maxHp: 520, tileW: 2, tileH: 2,
    damage: 130, attackRange: 460, attackRate: 0.8,
    metalCost: 230, energyCost: 4200, buildTime: 68,
    isAntiAir: true,
    icon: '🚀', desc: 'Long-range missiles. Effective vs. all unit types.',
  },
  REPAIR_PAD: {
    id: 'REPAIR_PAD', tier: 1,
    name: 'Repair Pad',
    maxHp: 320, tileW: 3, tileH: 3,
    repairRate: 15, repairRange: 190,
    metalCost: 210, energyCost: 2200, buildTime: 55,
    icon: '🔧', desc: 'Heals nearby friendly units at 15 HP/s.',
  },

  // ── Intel ─────────────────────────────────────────────────────
  RADAR: {
    id: 'RADAR', tier: 1,
    name: 'Radar Tower',
    maxHp: 290, tileW: 2, tileH: 2,
    radarRange: 950,
    metalCost: 85, energyCost: 1600, buildTime: 42,
    icon: '📡', desc: 'Reveals enemy positions over a wide area.',
  },
};

// ---- Misc ----
export const RESOURCE_CAP_BASE = 500;
export const RESOURCE_START    = { metal: 200, energy: 400 };
export const SELECTION_COLOR   = '#00ffcc';
export const DAMAGE_FLASH_MS   = 180;

export function hpColor(pct) {
  if (pct > 0.6) return '#22cc44';
  if (pct > 0.3) return '#ddcc22';
  return '#cc2222';
}
