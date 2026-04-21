// Black Market Research Tree
// Two tabs: INDUSTRY and DEFENCE
// Nodes unlock buildings or upgrades. Requires: parent node(s) unlocked first.

export const RESEARCH = {
  // ══ INDUSTRY ════════════════════════════════════════════════
  carpentry: {
    id:       'carpentry',
    tab:      'industry',
    era:      1,
    label:    '🪚 Carpentry',
    desc:     'Unlocks the Sawmill — turn Wood into Planks.',
    cost:     75,
    unlocks:  ['sawmill'],
    requires: [],
  },
  quarrying: {
    id:       'quarrying',
    tab:      'industry',
    era:      1,
    label:    '⛏ Quarrying',
    desc:     'Unlocks the Mason — turn Stone into Bricks.',
    cost:     75,
    unlocks:  ['mason'],
    requires: [],
  },
  agriculture: {
    id:       'agriculture',
    tab:      'industry',
    era:      1,
    label:    '🌾 Agriculture',
    desc:     'Unlocks the Mill — turn Food into Flour.',
    cost:     60,
    unlocks:  ['mill'],
    requires: [],
  },
  metallurgy: {
    id:       'metallurgy',
    tab:      'industry',
    era:      2,
    label:    '🔩 Metallurgy',
    desc:     'Unlocks the Smelter — turn Iron Ore into Iron Bars.',
    cost:     150,
    unlocks:  ['smelter'],
    requires: ['carpentry'],
  },
  breadmaking: {
    id:       'breadmaking',
    tab:      'industry',
    era:      2,
    label:    '🍞 Breadmaking',
    desc:     'Unlocks the Bakery — Bread feeds 2 citizens instead of 1.',
    cost:     120,
    unlocks:  ['bakery'],
    requires: ['agriculture'],
  },
  dense_housing: {
    id:       'dense_housing',
    tab:      'industry',
    era:      2,
    label:    '🏘 Dense Housing',
    desc:     'Cottages now hold 2 citizens each.',
    cost:     100,
    unlocks:  [],
    requires: ['carpentry'],
    effect:   'cottage_cap_2',
  },
  steelworking: {
    id:       'steelworking',
    tab:      'industry',
    era:      3,
    label:    '⚔ Steelworking',
    desc:     'Unlocks the Forge — combine Iron Bars + Planks into Steel.',
    cost:     350,
    unlocks:  ['forge'],
    requires: ['metallurgy'],
  },
  grand_housing: {
    id:       'grand_housing',
    tab:      'industry',
    era:      3,
    label:    '🏰 Grand Housing',
    desc:     'Cottages now hold 4 citizens each.',
    cost:     400,
    unlocks:  [],
    requires: ['dense_housing'],
    effect:   'cottage_cap_4',
  },

  // ══ DEFENCE ═════════════════════════════════════════════════
  fortification: {
    id:       'fortification',
    tab:      'defence',
    era:      1,
    label:    '🧱 Fortification',
    desc:     'Stone Walls gain +50% HP.',
    cost:     80,
    unlocks:  [],
    requires: [],
    effect:   'stone_wall_hp',
  },
  rapid_fire: {
    id:       'rapid_fire',
    tab:      'defence',
    era:      1,
    label:    '🏹 Rapid Fire',
    desc:     'Archer Tower fire rate +30%.',
    cost:     90,
    unlocks:  [],
    requires: [],
    effect:   'archer_firerate',
  },
  siege_craft: {
    id:       'siege_craft',
    tab:      'defence',
    era:      2,
    label:    '💣 Siege Craft',
    desc:     'Unlocks Catapult. Cannon range +20%.',
    cost:     200,
    unlocks:  ['tower_catapult'],
    requires: ['fortification'],
    effect:   'cannon_range',
  },
  arcane_arts: {
    id:       'arcane_arts',
    tab:      'defence',
    era:      2,
    label:    '🔮 Arcane Arts',
    desc:     'Mage Tower damage +40%. Unlocks Frost Tower.',
    cost:     220,
    unlocks:  ['tower_frost'],
    requires: ['rapid_fire'],
    effect:   'mage_damage',
  },
  chain_lightning: {
    id:       'chain_lightning',
    tab:      'defence',
    era:      2,
    label:    '⚡ Chain Lightning',
    desc:     'Lightning Rod chains to 5 enemies (was 3).',
    cost:     180,
    unlocks:  [],
    requires: ['rapid_fire'],
    effect:   'lightning_chain',
  },
  metal_walls: {
    id:       'metal_walls',
    tab:      'defence',
    era:      3,
    label:    '🛡 Metal Walls',
    desc:     'Unlocks Metal Walls. All wall HP +25%.',
    cost:     300,
    unlocks:  ['wall_metal'],
    requires: ['fortification', 'siege_craft'],
    effect:   'all_wall_hp',
  },
  alchemy: {
    id:       'alchemy',
    tab:      'defence',
    era:      3,
    label:    '⚗️ Alchemy',
    desc:     'Mage Tower chains to 2 nearby enemies.',
    cost:     500,
    unlocks:  [],
    requires: ['arcane_arts'],
    effect:   'mage_chain',
  },
};

// ── Unlocked state ───────────────────────────────────────────
const _unlocked = new Set();
// Applied effects (so towers/walls can query)
const _effects  = new Set();

export function isUnlocked(id)    { return _unlocked.has(id); }
export function hasEffect(effect) { return _effects.has(effect); }
export function getUnlocked()     { return _unlocked; }

export function canResearch(id) {
  const node = RESEARCH[id];
  if (!node) return false;
  if (_unlocked.has(id)) return false;
  return node.requires.every(r => _unlocked.has(r));
}

export function research(id, spendFn, hasFn) {
  const node = RESEARCH[id];
  if (!node || !canResearch(id)) return false;
  if (!hasFn({ gold: node.cost })) return false;
  spendFn({ gold: node.cost });
  _unlocked.add(id);
  if (node.effect) _effects.add(node.effect);
  return true;
}

// Buildings locked behind research (checked by hud.js build panel)
export const LOCKED_BUILDINGS = {
  sawmill:        'carpentry',
  mason:          'quarrying',
  mill:           'agriculture',
  smelter:        'metallurgy',
  bakery:         'breadmaking',
  forge:          'steelworking',
  tower_catapult: 'siege_craft',
  tower_frost:    'arcane_arts',
  wall_metal:     'metal_walls',
};

export function isBuildingUnlocked(type) {
  const req = LOCKED_BUILDINGS[type];
  if (!req) return true; // not locked
  return _unlocked.has(req);
}
