import { screenToWorld } from './camera.js';
import { tryPlaceBuilding, getSelectedType, cancelPlacement, getBuilding } from '../buildings/placement.js';
import { getPhase } from '../phases/phases.js';
import {
  handleZoneMouseDown,
  handleZoneMouseMove,
  handleZoneMouseUp,
  cancelZoneTool,
  getActiveZone,
  isPlacingFlag,
} from '../ui/zone_toolbar.js';
import { ZONE } from '../world/zones.js';
import { BUILDINGS } from '../buildings/registry.js';
import { openTradePanel } from '../ui/trade_panel.js';
import { TILE } from '../world/map.js';

let _canvas;
const mouse = { x: 0, y: 0, wx: 0, wy: 0 };

export function initInput(canvas) {
  _canvas = canvas;

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    const w = screenToWorld(mouse.x, mouse.y);
    mouse.wx = w.x;
    mouse.wy = w.y;

    handleZoneMouseMove(canvas, e);
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    // Zone tool takes priority over building placement
    const consumed = handleZoneMouseDown(canvas, e);
    if (consumed) return;

    const r = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);

    // Check for trade terminal click (no placement selected, planning phase)
    if (getPhase() === 'planning' && !getSelectedType()) {
      const tx = Math.floor(w.x / TILE);
      const ty = Math.floor(w.y / TILE);
      const b  = getBuilding(tx, ty);
      if (b) {
        const def = BUILDINGS[b.type];
        if (def?.isTrade) { openTradePanel(); return; }
      }
    }

    // Building placement
    if (getPhase() !== 'planning') return;
    if (!getSelectedType()) return;
    tryPlaceBuilding(w.x, w.y);
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    handleZoneMouseUp(canvas, e);
  });

  // Keep old click handler for building placement compatibility
  canvas.addEventListener('click', e => {
    if (getPhase() !== 'planning') return;
    if (getActiveZone() !== ZONE.NONE || isPlacingFlag()) return; // zone tool active
    if (!getSelectedType()) return;
    const r = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    tryPlaceBuilding(w.x, w.y);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      cancelPlacement();
      cancelZoneTool();
    }
  });
}

export function getMouse() { return mouse; }
