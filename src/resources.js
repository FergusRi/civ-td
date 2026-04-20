import { events, EV } from './engine/events.js';

// Current stockpile
const _res = {
  wood:  50,
  stone: 30,
  food:  40,
  gold:  10,
};

export function getResources() { return { ..._res }; }

export function hasResources(cost) {
  for (const [k, v] of Object.entries(cost)) {
    if ((_res[k] ?? 0) < v) return false;
  }
  return true;
}

export function spendResources(cost) {
  for (const [k, v] of Object.entries(cost)) {
    _res[k] = (_res[k] ?? 0) - v;
  }
  events.emit(EV.RESOURCES_CHANGED, getResources());
}

export function addResources(gain) {
  for (const [k, v] of Object.entries(gain)) {
    _res[k] = (_res[k] ?? 0) + v;
  }
  events.emit(EV.RESOURCES_CHANGED, getResources());
}

export function initResources() {
  // Trigger initial UI paint
  events.emit(EV.RESOURCES_CHANGED, getResources());

  // Each wave end: production buildings yield their output
  events.on(EV.WAVE_ENDED, () => {
    // Handled in buildings/registry.js tick — just emit update here
    events.emit(EV.RESOURCES_CHANGED, getResources());
  });
}
