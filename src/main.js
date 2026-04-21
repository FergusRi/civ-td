import { initEngine, startLoop } from './engine/renderer.js';
import { initCamera } from './engine/camera.js';
import { initInput } from './engine/input.js';
import { initWorld, preloadMapSprites, preloadTileImages } from './world/map.js';
import { initBuildings } from './buildings/placement.js';
import { preloadBuildingImages, preloadWallTilesets } from './buildings/sprites.js';
import { preloadUnitImages } from './combat/enemies.js';
import { initCitizens } from './citizens/citizen.js';
import { initCombat } from './combat/towers.js';
import { initPhases } from './phases/phases.js';
import { initUI } from './ui/hud.js';
import { initResources } from './resources.js';
import { showRegionSelect } from './screens/region_select.js';
import { initZones } from './world/zones.js';
import { initZoneToolbar } from './ui/zone_toolbar.js';

const canvas = document.getElementById('game-canvas');

async function boot(regionId) {
  initEngine(canvas);
  initCamera(canvas);
  initInput(canvas);
  initWorld(regionId);
  await Promise.all([
    preloadMapSprites(),
    preloadTileImages(),
    preloadBuildingImages(),
    preloadWallTilesets(),
    preloadUnitImages(),
  ]);
  initResources();
  initZones();              // must come before toolbar
  initBuildings();
  initCitizens();
  initCombat();
  initPhases();
  initUI();
  initZoneToolbar(document.getElementById('ui-root'));  // inject zone toolbar
  startLoop();
}

showRegionSelect((regionId) => {
  boot(regionId);
});
