import { screenToWorld } from './camera.js';
import { tryPlaceBuilding, getSelectedType, cancelPlacement } from '../buildings/placement.js';
import { getPhase } from '../phases/phases.js';

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
  });

  canvas.addEventListener('click', e => {
    if (getPhase() !== 'planning') return;
    if (!getSelectedType()) return;

    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const w = screenToWorld(sx, sy);
    tryPlaceBuilding(w.x, w.y);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') cancelPlacement();
  });
}

export function getMouse() { return mouse; }
