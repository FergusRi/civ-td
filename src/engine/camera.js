import { MAP_PX } from '../world/map.js';

const cam = { x: 0, y: 0, zoom: 1.5 };

const PAN_SPEED   = 400; // px/s at zoom=1
const ZOOM_MIN    = 0.75;
const ZOOM_MAX    = 3.0;
const ZOOM_STEP   = 0.15;

const _keys = {};

export function getCamera() { return cam; }

export function initCamera(canvas) {
  window.addEventListener('keydown', e => { _keys[e.key] = true; });
  window.addEventListener('keyup',   e => { _keys[e.key] = false; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom + delta));
  }, { passive: false });
}

export function updateCamera(dt, canvasW, canvasH) {
  const speed = PAN_SPEED / cam.zoom;

  if (_keys['ArrowLeft']  || _keys['a']) cam.x -= speed * dt;
  if (_keys['ArrowRight'] || _keys['d']) cam.x += speed * dt;
  if (_keys['ArrowUp']    || _keys['w']) cam.y -= speed * dt;
  if (_keys['ArrowDown']  || _keys['s']) cam.y += speed * dt;

  // Clamp so the map never scrolls fully off screen
  const viewW = canvasW / cam.zoom;
  const viewH = canvasH / cam.zoom;
  cam.x = Math.max(0, Math.min(MAP_PX - viewW, cam.x));
  cam.y = Math.max(0, Math.min(MAP_PX - viewH, cam.y));
}

export function screenToWorld(sx, sy, canvasH) {
  void canvasH;
  return {
    x: sx / cam.zoom + cam.x,
    y: sy / cam.zoom + cam.y,
  };
}
