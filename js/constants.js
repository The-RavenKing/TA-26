// =============================================
//  TOTAL ANNIHILATION: REBORN — Constants
// =============================================

export const TILE_SIZE = 40;
export const MAP_W     = 80;
export const MAP_H     = 60;

// ---- Terrain ----
export const TERRAIN = {
  GRASS : 0,
  ROCK  : 1,
  WATER : 2,
  METAL : 3,   // buildable, has metal deposit
  SAND  : 4,
};

export const TERRAIN_COLOR = {
  [TERRAIN.GRASS]: '#2d4a1e',
  [TERRAIN.ROCK ]: '#3d3d3d',
  [TERRAIN.WATER]: '#1a3a5c',
  [TERRAIN.METAL]: '#2d4a1e',
  [TERRAIN.SAND ]: '#5a4a2a',
};

export const TERRAIN_WALKABLE = {
  [TERRAIN.GRASS]: true,
  [TERRAIN.ROCK ]: false,
  [TERRAIN.WATER]: false,
  [TERRAIN.METAL]: true,
  [TERRAIN.SAND ]: true,
};

export const TERRAIN_BUILDABLE = {
  [TERRAIN.GRASS]: true,
  [TERRAIN.ROCK ]: false,
  [TERRAIN.WATER]: false,
  [TERRAIN.METAL]: true,
  [TERRAIN.SAND ]: true,
};

// ---- Factions ----
export const FACTION = {
  ARM : 'ARM',
  CORE: 'CORE',
};

export const FACTION_COLOR = {
  [FACTION.ARM ]: '#4499ff',
  [FACTION.CORE]: '#ff4444',
};

export const FACTION_DARK = {
  [FACTION.ARM ]: '#1155aa',
  [FACTION.CORE]: '#aa1111',
};

// ---- Unit Definitions ----
export const UNIT_DEF = {
  COMMANDER: {
    id         : 'COMMANDER',
    name       : 'Commander',
    armName    : 'ARM Commander',
    coreName   : 'CORE Commander',
    maxHp      : 2000,
    armor      : 3,
    speed      : 55,
    damage     : 120,
    attackRange: 200,
    attackRate : 1.0,
    sight      : 350,
    radius     : 15,
    buildPower : 25,
    buildRange : 200,
    metalCost  : 0,
    energyCost : 0,
    buildTime  : 0,
    canBuild   : [
      'METAL_EXTRACTOR','SOLAR_COLLECTOR','KBOT_LAB',
      'VEHICLE_PLANT','LASER_TOWER','RADAR','FUSION_REACTOR',
    ],
  },
  KBOT: {
    id         : 'KBOT',
    name       : 'Kbot',
    armName    : 'AK',
    coreName   : 'Peewee',
    maxHp      : 165,
    armor      : 1,
    speed      : 80,
    damage     : 28,
    attackRange: 170,
    attackRate : 2.0,
    sight      : 260,
    radius     : 8,
    buildPower : 0,
    metalCost  : 52,
    energyCost : 104,
    buildTime  : 14,
  },
  TANK: {
    id         : 'TANK',
    name       : 'Tank',
    armName    : 'Stumpy',
    coreName   : 'Reaper',
    maxHp      : 380,
    armor      : 4,
    speed      : 50,
    damage     : 65,
    attackRange: 210,
    attackRate : 0.9,
    sight      : 280,
    radius     : 11,
    buildPower : 0,
    metalCost  : 140,
    energyCost : 280,
    buildTime  : 28,
  },
  ARTILLERY: {
    id         : 'ARTILLERY',
    name       : 'Artillery',
    armName    : 'Morty',
    coreName   : 'Slasher',
    maxHp      : 130,
    armor      : 1,
    speed      : 40,
    damage     : 300,
    attackRange: 550,
    attackRate : 0.25,
    sight      : 300,
    radius     : 9,
    buildPower : 0,
    metalCost  : 180,
    energyCost : 360,
    buildTime  : 40,
    minRange   : 80,
    splash     : 60,
  },
  FIGHTER: {
    id         : 'FIGHTER',
    name       : 'Fighter',
    armName    : 'Freedom Fighter',
    coreName   : 'Viper',
    maxHp      : 200,
    armor      : 2,
    speed      : 150,
    damage     : 50,
    attackRange: 200,
    attackRate : 1.5,
    sight      : 400,
    radius     : 8,
    buildPower : 0,
    metalCost  : 150,
    energyCost : 300,
    buildTime  : 25,
    isAir      : true,
  },
};

// ---- Building Definitions ----
export const BUILDING_DEF = {
  METAL_EXTRACTOR: {
    id                : 'METAL_EXTRACTOR',
    name              : 'Metal Extractor',
    armName           : 'Metal Extractor',
    coreName          : 'Metal Extractor',
    maxHp             : 350,
    tileW             : 2,
    tileH             : 2,
    metalProduction   : 2.0,
    energyConsumption : 0,
    metalCost         : 50,
    energyCost        : 500,
    buildTime         : 45,
    requiresMetal     : true,
    icon              : '⛏',
  },
  SOLAR_COLLECTOR: {
    id                : 'SOLAR_COLLECTOR',
    name              : 'Solar Collector',
    armName           : 'Solar Collector',
    coreName          : 'Solar Collector',
    maxHp             : 280,
    tileW             : 2,
    tileH             : 2,
    metalProduction   : 0,
    energyProduction  : 20,
    metalCost         : 155,
    energyCost        : 0,
    buildTime         : 35,
    icon              : '☀',
  },
  FUSION_REACTOR: {
    id               : 'FUSION_REACTOR',
    name             : 'Fusion Reactor',
    armName          : 'Fusion Reactor',
    coreName         : 'Fusion Reactor',
    maxHp            : 800,
    tileW            : 3,
    tileH            : 3,
    energyProduction : 200,
    metalCost        : 700,
    energyCost       : 2000,
    buildTime        : 180,
    icon             : '⚡',
  },
  KBOT_LAB: {
    id         : 'KBOT_LAB',
    name       : 'Kbot Lab',
    armName    : 'Kbot Lab',
    coreName   : 'Kbot Lab',
    maxHp      : 900,
    tileW      : 4,
    tileH      : 4,
    metalCost  : 500,
    energyCost : 6000,
    buildTime  : 120,
    canProduce : ['KBOT'],
    icon       : '🤖',
  },
  VEHICLE_PLANT: {
    id         : 'VEHICLE_PLANT',
    name       : 'Vehicle Plant',
    armName    : 'Vehicle Plant',
    coreName   : 'Vehicle Plant',
    maxHp      : 900,
    tileW      : 5,
    tileH      : 4,
    metalCost  : 800,
    energyCost : 8000,
    buildTime  : 150,
    canProduce : ['TANK', 'ARTILLERY'],
    icon       : '🏭',
  },
  LASER_TOWER: {
    id         : 'LASER_TOWER',
    name       : 'Laser Tower',
    armName    : 'Guardian',
    coreName   : 'HLT',
    maxHp      : 550,
    tileW      : 2,
    tileH      : 2,
    damage     : 55,
    attackRange: 270,
    attackRate : 2.5,
    metalCost  : 140,
    energyCost : 3000,
    buildTime  : 55,
    icon       : '🗼',
  },
  RADAR: {
    id         : 'RADAR',
    name       : 'Radar Tower',
    armName    : 'Radar Tower',
    coreName   : 'Radar Tower',
    maxHp      : 280,
    tileW      : 2,
    tileH      : 2,
    radarRange : 900,
    metalCost  : 80,
    energyCost : 1500,
    buildTime  : 40,
    icon       : '📡',
  },
};

// ---- Misc ----
export const RESOURCE_CAP_BASE = 500;  // base cap before storage buildings
export const RESOURCE_START    = { metal: 200, energy: 400 };
export const SELECTION_COLOR   = '#00ffcc';
export const DAMAGE_FLASH_MS   = 180;
export const RALLY_COLOR       = '#ffcc00';

// Colors for health bar ranges
export function hpColor(pct) {
  if (pct > 0.6) return '#22cc44';
  if (pct > 0.3) return '#cccc22';
  return '#cc2222';
}
