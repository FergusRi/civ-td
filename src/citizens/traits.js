// Each citizen gets 1 positive + 1 negative trait
// Effects are read by citizen.js and resources.js

export const POSITIVE_TRAITS = {
  hardworking: {
    label: 'Hardworking',
    desc:  'Builds and repairs 25% faster.',
    buildSpeedMult: 1.25,
  },
  lucky: {
    label: 'Lucky',
    desc:  'Occasionally finds bonus resources while wandering.',
    bonusResourceChance: 0.15,
  },
  brave: {
    label: 'Brave',
    desc:  'Does not flee during wave — stays near walls.',
    flees: false,
  },
  resourceful: {
    label: 'Resourceful',
    desc:  'Produces +2 of any resource when working a production building.',
    productionBonus: 2,
  },
  inspiring: {
    label: 'Inspiring',
    desc:  '+5 morale to all nearby citizens.',
    moraleAura: 5,
  },
  swift: {
    label: 'Swift',
    desc:  'Moves 30% faster.',
    speedMult: 1.3,
  },
};

export const NEGATIVE_TRAITS = {
  lazy: {
    label: 'Lazy',
    desc:  'Builds and repairs 25% slower.',
    buildSpeedMult: 0.75,
  },
  clumsy: {
    label: 'Clumsy',
    desc:  'Occasionally drops resources (5% production loss).',
    productionLoss: 0.05,
  },
  coward: {
    label: 'Coward',
    desc:  'Flees at the start of every wave.',
    flees: true,
    fleeEarly: true,
  },
  glutton: {
    label: 'Glutton',
    desc:  'Consumes double food per wave.',
    foodMult: 2,
  },
  unlucky: {
    label: 'Unlucky',
    desc:  'Takes double damage from enemy attacks.',
    damageMult: 2,
  },
  grumpy: {
    label: 'Grumpy',
    desc:  '-5 morale to all nearby citizens.',
    moraleAura: -5,
  },
};

const POS_KEYS = Object.keys(POSITIVE_TRAITS);
const NEG_KEYS = Object.keys(NEGATIVE_TRAITS);

export function randomTraits() {
  const pos = POS_KEYS[Math.floor(Math.random() * POS_KEYS.length)];
  const neg = NEG_KEYS[Math.floor(Math.random() * NEG_KEYS.length)];
  return { positive: pos, negative: neg };
}
