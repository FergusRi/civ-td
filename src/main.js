import { initEngine, startLoop } from './engine/renderer.js';
import { initCamera } from './engine/camera.js';
import { initInput } from './engine/input.js';
import { initWorld, preloadMapSprites } from './world/map.js';
import { initBuildings } from './buildings/placement.js';
import { initCitizens } from './citizens/citizen.js';
import { initCombat } from './combat/towers.js';
import { initPhases } from './phases/phases.js';
import { initUI } from './ui/hud.js';
import { initResources } from './resources.js';

const canvas = document.getElementById('game-canvas');

async function boot() {
  initEngine(canvas);
  initCamera(canvas);
  initInput(canvas);
  initWorld();
  await preloadMapSprites();
  initResources();
  initBuildings();
  initCitizens();
  initCombat();
  initPhases();
  initUI();
  startLoop();
}

boot();
