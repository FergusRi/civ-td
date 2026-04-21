// Simple event bus
const _listeners = {};

export const EV = {
  // Phases
  PHASE_CHANGED:   'phase_changed',
  WAVE_START:      'wave_start',
  WAVE_ENDED:      'wave_ended',
  GAME_OVER:       'game_over',
  // Buildings
  BUILDING_PLACED: 'building_placed',
  BUILDING_BUILT:  'building_built',
  BUILDING_DESTROYED: 'building_destroyed',
  // Citizens
  CITIZEN_DIED:    'citizen_died',
  // Combat
  ENEMY_SPAWNED:   'enemy_spawned',
  ENEMY_DIED:      'enemy_died',
  ENEMY_REACHED_BASE: 'enemy_reached_base',
  // Resources
  RESOURCES_CHANGED: 'resources_changed',
  FLAG_PLACED:       'flag_placed',
};

export const events = {
  on(event, fn) {
    (_listeners[event] ??= []).push(fn);
  },
  off(event, fn) {
    _listeners[event] = (_listeners[event] ?? []).filter(f => f !== fn);
  },
  emit(event, data) {
    for (const fn of (_listeners[event] ?? [])) fn(data);
  },
};
