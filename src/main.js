import { initEngine, startLoop } from './engine/renderer.js';
import { initCamera } from './engine/camera.js';
import { initInput } from './engine/input.js';
import { initWorld, preloadMapSprites, preloadTileImages } from './world/map.js';
import { initBuildings } from './buildings/placement.js';
import { preloadBuildingImages, preloadWallTilesets } from './buildings/sprites.js';
import { initCitizens } from './citizens/citizen.js';
import { initCombat } from './combat/towers.js';
import { initPhases } from './phases/phases.js';
import { initUI } from './ui/hud.js';
import { initResources } from './resources.js';
import { showRegionSelect } from './screens/region_select.js';

const canvas = document.getElementById('game-canvas');

async function boot(regionId) {
  initEngine(canvas);
  initCamera(canvas);
  initInput(canvas);
  initWorld(regionId);          // pass region so centre tiles correctly
  await Promise.all([preloadMapSprites(), preloadTileImages(), preloadBuildingImages(), preloadWallTilesets()]);
  initResources();
  initBuildings();
  initCitizens();
  initCombat();
  initPhases();
  initUI();
  startLoop();
}

// Show continent picker first, then boot with chosen region
showRegionSelect((regionId) => {
  boot(regionId);
});
