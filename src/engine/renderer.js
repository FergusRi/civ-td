import { update } from '../phases/phases.js';
import { renderWorld, renderMapSprites } from '../world/map.js';
import { renderBuildings } from '../buildings/placement.js';
import { renderUnits } from '../combat/enemies.js';
import { renderCitizens } from '../citizens/citizen.js';
import { renderProjectiles } from '../combat/projectiles.js';
import { renderUI } from '../ui/hud.js';
import { getCamera } from './camera.js';

let _canvas, _ctx;
let _lastTime = 0;

export function initEngine(canvas) {
  _canvas = canvas;
  _ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  _canvas.width  = window.innerWidth;
  _canvas.height = window.innerHeight;
}

export function startLoop() {
  requestAnimationFrame(loop);
}

function loop(ts) {
  const dt = Math.min((ts - _lastTime) / 1000, 0.1); // cap at 100ms
  _lastTime = ts;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function draw() {
  const cam = getCamera();
  const W = _canvas.width;
  const H = _canvas.height;

  _ctx.clearRect(0, 0, W, H);

  // World-space transform
  _ctx.save();
  _ctx.scale(cam.zoom, cam.zoom);
  _ctx.translate(-cam.x, -cam.y);

  renderWorld(_ctx, cam);
  renderBuildings(_ctx, cam);
  renderMapSprites(_ctx, cam);
  renderCitizens(_ctx);
  renderUnits(_ctx);
  renderProjectiles(_ctx);

  _ctx.restore();

  // Screen-space UI (no camera transform)
  renderUI(_ctx, W, H);
}

export function getCtx() { return _ctx; }
export function getCanvas() { return _canvas; }
