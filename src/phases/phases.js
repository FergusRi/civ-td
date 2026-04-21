import { events, EV } from '../engine/events.js';
import { updateCamera, getCamera } from '../engine/camera.js';
import { updateCitizens, citizens } from '../citizens/citizen.js';
import { updateEnemies, enemies, spawnWave, FACTIONS } from '../combat/enemies.js';
import { updateTowers } from '../combat/towers.js';
import { updateProjectiles } from '../combat/projectiles.js';
import { placedBuildings, getBuilding } from '../buildings/placement.js';
import { BUILDINGS } from '../buildings/registry.js';
import { addResources, getResources } from '../resources.js';
import { getCanvas } from '../engine/renderer.js';
import { fluctuatePrices } from '../ui/trade_panel.js';

let _phase      = 'planning'; // 'planning' | 'wave' | 'gameover'
let _wave       = 0;
let _waveTimer  = 0;
let _nextFactions = [];
let _hasIntel   = false;  // watchtower built?

export function getPhase()      { return _phase; }
export function getWaveNumber() { return _wave; }
export function getNextFactions(){ return _nextFactions; }
export function hasIntel()      { return _hasIntel; }

export function initPhases() {
  _setPhase('planning');
  _prepareNextWave();

  events.on(EV.BUILDING_PLACED, () => {
    _hasIntel = [...placedBuildings.values()].some(b => b.type === 'watchtower');
  });
  events.on(EV.BUILDING_DESTROYED, () => {
    _hasIntel = [...placedBuildings.values()].some(b => b.type === 'watchtower');
  });
}

function _setPhase(p) {
  _phase = p;
  events.emit(EV.PHASE_CHANGED, { phase: p });
}

// Called from UI "Start Wave" button
export function startWave() {
  if (_phase !== 'planning') return;
  _wave++;
  _setPhase('wave');
  events.emit(EV.WAVE_START, { wave: _wave, factions: _nextFactions });
  _spawnCurrentWave();
}

function _spawnCurrentWave() {
  const config = _buildWaveConfig(_wave, _nextFactions);
  config._wave = _wave;
  spawnWave(config);
}

function _buildWaveConfig(wave, factionKeys) {
  // Each faction gets more units as wave increases
  const baseCount = 5 + Math.floor(wave * 1.5);
  return factionKeys.map(fk => ({
    faction: fk,
    count:   baseCount + Math.floor(Math.random() * 3),
  }));
}

function _prepareNextWave() {
  _nextFactions = _pickFactions(_wave + 1);
}

function _pickFactions(wave) {
  const allFactions = Object.keys(FACTIONS);

  if (wave <= 3) {
    // Single light faction early game
    const light = ['goblin', 'darkelf'];
    return [light[Math.floor(Math.random() * light.length)]];
  }
  if (wave <= 7) {
    // Two factions
    return _sample(allFactions.filter(f => f !== 'giant' && f !== 'shadow'), 2);
  }
  if (wave <= 14) {
    // Include heavies
    return _sample(allFactions.filter(f => f !== 'shadow'), 2 + (wave > 10 ? 1 : 0));
  }
  // Wave 15+ — Shadow Cult joins, any combination
  return _sample(allFactions, Math.min(allFactions.length, 3));
}

function _sample(arr, n) {
  const a = [...arr].sort(() => Math.random() - 0.5);
  return a.slice(0, n);
}

// ── Production tick (per wave end) ───────────────────────────────────────────
function _doProduction() {
  const gain = {};
  const spend = {};
  const seen  = new Set();
  const res   = getResources();

  for (const b of placedBuildings.values()) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    const def = BUILDINGS[b.type];
    if (!def) continue;

    // Standard producers (farms, mines, etc.)
    if (def.produces) {
      for (const [r, amt] of Object.entries(def.produces)) {
        gain[r] = (gain[r] ?? 0) + amt;
      }
    }

    // Processing buildings: consume input → produce output
    if (def.isProcessor) {
      const inputRes  = def.input;
      const outputRes = def.output;
      const ratio     = def.ratio ?? 1;   // input units needed per 1 output
      const available = (res[inputRes] ?? 0) + (gain[inputRes] ?? 0) - (spend[inputRes] ?? 0);
      const batches   = Math.floor(available / ratio);
      if (batches > 0) {
        spend[inputRes]  = (spend[inputRes]  ?? 0) + batches * ratio;
        gain[outputRes]  = (gain[outputRes]  ?? 0) + batches;
      }

      // Forge needs a second input (planks)
      if (def.inputExtra && batches > 0) {
        const extraAvail = (res[def.inputExtra] ?? 0) + (gain[def.inputExtra] ?? 0) - (spend[def.inputExtra] ?? 0);
        const extraBatches = Math.min(batches, extraAvail);
        if (extraBatches < batches) {
          // Roll back — not enough extra input
          spend[inputRes]  -= (batches - extraBatches) * ratio;
          gain[outputRes]  -= (batches - extraBatches);
          spend[def.inputExtra] = (spend[def.inputExtra] ?? 0) + extraBatches;
        } else {
          spend[def.inputExtra] = (spend[def.inputExtra] ?? 0) + batches;
        }
      }
    }
  }

  // Apply spending (processors consumed inputs)
  for (const [r, amt] of Object.entries(spend)) {
    gain[r] = (gain[r] ?? 0) - amt;
  }

  // Food upkeep: bread feeds 2 citizens, raw food feeds 1
  const breadAvail  = Math.min(res.bread ?? 0, Math.ceil(citizens.length / 2));
  const fedByBread  = breadAvail * 2;
  const stillHungry = Math.max(0, citizens.length - fedByBread);
  gain.bread = (gain.bread ?? 0) - breadAvail;
  gain.food  = (gain.food  ?? 0) - stillHungry;

  addResources(gain);
}

// ── Loss check ────────────────────────────────────────────────────────────────
function _checkLoss() {
  // Settlement destroyed
  const hasSettlement = [...placedBuildings.values()].some(b => b.type === 'settlement');
  if (!hasSettlement) {
    _triggerGameOver('settlement_destroyed');
    return true;
  }
  // All citizens dead
  if (citizens.length === 0) {
    _triggerGameOver('no_citizens');
    return true;
  }
  return false;
}

function _triggerGameOver(reason) {
  _setPhase('gameover');
  events.emit(EV.GAME_OVER, { wave: _wave, reason });
}

// ── Main update ───────────────────────────────────────────────────────────────
export function update(dt) {
  const canvas = getCanvas();
  updateCamera(dt, canvas.width, canvas.height);
  updateCitizens(dt);

  if (_phase === 'wave') {
    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);

    if (_checkLoss()) return;

    // Wave ends when all enemies are dead
    if (enemies.length === 0) {
      _endWave();
    }
  }
}

function _endWave() {
  _setPhase('planning');
  _doProduction();
  _prepareNextWave();
  fluctuatePrices();
  events.emit(EV.WAVE_ENDED, { wave: _wave });
}
