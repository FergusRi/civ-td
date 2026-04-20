// Building definitions — place it, it works. No micromanagement.
// cost: what it takes to place
// produces: resources added each wave end (if complete)
// hp: hit points before destruction
// size: tiles (all 1×1 for now, towers 1×1)

export const BUILDINGS = {
  // === PRODUCTION ===
  lumberyard: {
    label:    'Lumberyard',
    category: 'production',
    cost:     { wood: 10 },
    produces: { wood: 8 },
    hp:       60,
    size:     1,
    desc:     'Produces 8 wood each wave.',
  },
  farm: {
    label:    'Farm',
    category: 'production',
    cost:     { wood: 15 },
    produces: { food: 10 },
    hp:       50,
    size:     1,
    desc:     'Produces 10 food each wave.',
  },
  mine: {
    label:    'Mine',
    category: 'production',
    cost:     { wood: 20 },
    produces: { stone: 6 },
    hp:       70,
    size:     1,
    desc:     'Produces 6 stone each wave.',
  },
  market: {
    label:    'Market',
    category: 'production',
    cost:     { wood: 20, stone: 10 },
    produces: { gold: 5 },
    hp:       55,
    size:     1,
    desc:     'Produces 5 gold each wave.',
  },

  // === HOUSING ===
  cottage: {
    label:    'Cottage',
    category: 'housing',
    cost:     { wood: 25 },
    produces: {},
    hp:       80,
    size:     1,
    citizenCap: 2,          // +2 max citizens
    desc:     'Houses 2 citizens. Required for population growth.',
  },

  // === DEFENCE — WALLS ===
  wall_wood: {
    label:    'Wood Wall',
    category: 'defence',
    cost:     { wood: 5 },
    produces: {},
    hp:       40,
    size:     1,
    isWall:   true,
    desc:     'Cheap barrier. Burns easily.',
  },
  wall_stone: {
    label:    'Stone Wall',
    category: 'defence',
    cost:     { stone: 8 },
    produces: {},
    hp:       120,
    size:     1,
    isWall:   true,
    desc:     'Solid wall. Resists most damage.',
  },
  wall_metal: {
    label:    'Metal Wall',
    category: 'defence',
    cost:     { stone: 12, gold: 5 },
    produces: {},
    hp:       220,
    size:     1,
    isWall:   true,
    desc:     'Best-in-class wall. Tough to breach.',
  },

  // === DEFENCE — TOWERS ===
  tower_archer: {
    label:    'Archer Tower',
    category: 'defence',
    cost:     { wood: 30 },
    produces: {},
    hp:       90,
    size:     1,
    isTower:  true,
    range:    220,
    fireRate: 1.2,          // shots/sec
    damage:   12,
    projectile: 'arrow',
    // Effective vs: Goblins (fast, light), Dark Elves
    // Weak vs: Stone Giants (armoured)
    desc:     'Fast-firing. Great vs light enemies.',
  },
  tower_ballista: {
    label:    'Ballista',
    category: 'defence',
    cost:     { wood: 40, stone: 10 },
    produces: {},
    hp:       100,
    size:     1,
    isTower:  true,
    range:    300,
    fireRate: 0.5,
    damage:   45,
    projectile: 'bolt',
    // Effective vs: Orcs, Stone Giants (piercing)
    // Weak vs: Undead (needs magic)
    desc:     'Slow but high-damage. Pierces armour.',
  },
  tower_cannon: {
    label:    'Cannon',
    category: 'defence',
    cost:     { stone: 30, gold: 10 },
    produces: {},
    hp:       120,
    size:     1,
    isTower:  true,
    range:    200,
    fireRate: 0.3,
    damage:   80,
    aoe:      60,           // splash radius px
    projectile: 'cannonball',
    // Effective vs: Goblin swarms (AoE), Orc blobs
    // Weak vs: Dark Elves (ranged, spread out)
    desc:     'AoE splash. Wrecks tightly packed enemies.',
  },
  tower_mage: {
    label:    'Mage Tower',
    category: 'defence',
    cost:     { stone: 25, gold: 15 },
    produces: {},
    hp:       80,
    size:     1,
    isTower:  true,
    range:    250,
    fireRate: 0.7,
    damage:   35,
    projectile: 'magic_bolt',
    // Effective vs: Undead (magic), Shadow Cult
    // Weak vs: Stone Giants (too tanky)
    desc:     'Magic damage. Only thing that hurts Undead.',
  },
  tower_frost: {
    label:    'Frost Tower',
    category: 'defence',
    cost:     { stone: 20, gold: 20 },
    produces: {},
    hp:       80,
    size:     1,
    isTower:  true,
    range:    180,
    fireRate: 1.0,
    damage:   8,
    slow:     0.4,          // slow multiplier applied to hit enemies
    projectile: 'ice_shard',
    // Effective vs: ALL (utility — slows every faction)
    // Weak vs: Shadow Cult (teleports, ignores slow)
    desc:     'Slows enemies. Pairs with any other tower.',
  },
  tower_lightning: {
    label:    'Lightning Rod',
    category: 'defence',
    cost:     { stone: 15, gold: 25 },
    produces: {},
    hp:       75,
    size:     1,
    isTower:  true,
    range:    200,
    fireRate: 0.8,
    damage:   20,
    chain:    3,            // chains to N nearby enemies
    projectile: 'lightning',
    // Effective vs: Dark Elf Raiders (bunched at treeline)
    // Weak vs: Stone Giants (single target, low dps per hit)
    desc:     'Chains to 3 nearby enemies. Punishes clusters.',
  },
  tower_catapult: {
    label:    'Catapult',
    category: 'defence',
    cost:     { wood: 50, stone: 20 },
    produces: {},
    hp:       110,
    size:     1,
    isTower:  true,
    range:    350,
    fireRate: 0.2,
    damage:   100,
    aoe:      90,
    projectile: 'boulder',
    // Effective vs: Stone Giants (heavy siege), Orc walls
    // Weak vs: fast Goblins (hard to hit)
    desc:     'Longest range, huge AoE. Struggles vs fast units.',
  },

  // === UTILITY ===
  watchtower: {
    label:    'Watchtower',
    category: 'utility',
    cost:     { wood: 20, stone: 10 },
    produces: {},
    hp:       60,
    size:     1,
    intel:    true,         // reveals next wave faction
    desc:     'Reveals which faction attacks next wave.',
  },
  settlement: {
    label:    'Settlement Hall',
    category: 'utility',
    cost:     {},           // free — placed at game start
    produces: {},
    hp:       200,
    size:     2,            // 2×2
    isCore:   true,
    desc:     'Your colony\'s heart. If destroyed, it\'s over.',
  },
};

// Tab categories for the build panel
export const BUILDING_CATEGORIES = [
  { label: '⚒ Production', types: ['lumberyard', 'farm', 'mine', 'market'] },
  { label: '🏠 Housing',   types: ['cottage'] },
  { label: '🧱 Walls',     types: ['wall_wood', 'wall_stone', 'wall_metal'] },
  { label: '🏹 Towers',    types: ['tower_archer', 'tower_ballista', 'tower_cannon', 'tower_mage', 'tower_frost', 'tower_lightning', 'tower_catapult'] },
  { label: '🔭 Utility',   types: ['watchtower'] },
];

// Tower × Faction effectiveness (multiplier on damage dealt)
// 1.0 = normal, 1.5 = effective, 0.5 = weak
export const EFFECTIVENESS = {
  //                     goblin  orc   undead  darkelf  giant  shadow
  tower_archer:    { goblin:1.5, orc:1.0, undead:0.5, darkelf:1.5, giant:0.5, shadow:1.0 },
  tower_ballista:  { goblin:1.0, orc:1.5, undead:0.5, darkelf:1.0, giant:1.5, shadow:1.0 },
  tower_cannon:    { goblin:1.5, orc:1.5, undead:1.0, darkelf:0.5, giant:1.0, shadow:1.0 },
  tower_mage:      { goblin:1.0, orc:1.0, undead:1.5, darkelf:1.0, giant:0.5, shadow:1.5 },
  tower_frost:     { goblin:1.0, orc:1.0, undead:1.0, darkelf:1.0, giant:1.0, shadow:0.5 },
  tower_lightning: { goblin:1.0, orc:1.0, undead:1.0, darkelf:1.5, giant:0.5, shadow:1.0 },
  tower_catapult:  { goblin:0.5, orc:1.5, undead:1.0, darkelf:1.0, giant:1.5, shadow:1.0 },
};
