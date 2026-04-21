// ============================================================
// zones.js — Prison Architect-style zone painting
// Zone types: 0=NONE, 1=SETTLEMENT, 2=DEFENCE
// Stored as a flat Uint8Array indexed by ty*COLS+tx
// ============================================================
import { COLS, ROWS } from './map.js';

export const ZONE = { NONE: 0, SETTLEMENT: 1, DEFENCE: 2 };

// Colours (semi-transparent fill)
export const ZONE_COLOR = {
  [ZONE.SETTLEMENT]: 'rgba(255, 215, 0, 0.22)',   // gold
  [ZONE.DEFENCE]:    'rgba(200, 40,  40, 0.22)',   // red
};
export const ZONE_BORDER = {
  [ZONE.SETTLEMENT]: 'rgba(255, 215, 0, 0.7)',
  [ZONE.DEFENCE]:    'rgba(220, 60,  60, 0.7)',
};

let _zones = null;

export function initZones() {
  _zones = new Uint8Array(COLS * ROWS); // all NONE
}

export function getZone(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return ZONE.NONE;
  return _zones[ty * COLS + tx];
}

export function setZone(tx, ty, zoneType) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  _zones[ty * COLS + tx] = zoneType;
}

// Paint a rectangle of tiles
export function paintZoneRect(tx0, ty0, tx1, ty1, zoneType) {
  const minX = Math.min(tx0, tx1);
  const maxX = Math.max(tx0, tx1);
  const minY = Math.min(ty0, ty1);
  const maxY = Math.max(ty0, ty1);
  for (let ty = minY; ty <= maxY; ty++)
    for (let tx = minX; tx <= maxX; tx++)
      setZone(tx, ty, zoneType);
}

// Get all tile coords for a zone type
export function getZoneTiles(zoneType) {
  const tiles = [];
  for (let i = 0; i < _zones.length; i++) {
    if (_zones[i] === zoneType) {
      tiles.push({ tx: i % COLS, ty: Math.floor(i / COLS) });
    }
  }
  return tiles;
}

// ── Renderer (called from renderer.js after world, before sprites) ──────────
import { TILE } from './map.js';

export function renderZones(ctx, cam) {
  if (!_zones) return;

  // Viewport culling
  const startTX = Math.max(0, Math.floor(cam.x / TILE));
  const startTY = Math.max(0, Math.floor(cam.y / TILE));
  const endTX   = Math.min(COLS - 1, Math.ceil((cam.x + cam.w) / TILE));
  const endTY   = Math.min(ROWS - 1, Math.ceil((cam.y + cam.h) / TILE));

  for (let ty = startTY; ty <= endTY; ty++) {
    for (let tx = startTX; tx <= endTX; tx++) {
      const z = _zones[ty * COLS + tx];
      if (z === ZONE.NONE) continue;

      const px = tx * TILE;
      const py = ty * TILE;

      // Fill
      ctx.fillStyle = ZONE_COLOR[z];
      ctx.fillRect(px, py, TILE, TILE);

      // Border only on edges bordering a different zone
      ctx.strokeStyle = ZONE_BORDER[z];
      ctx.lineWidth = 1.5;

      // Draw border edges where neighbour differs
      const top    = ty > 0          ? _zones[(ty-1)*COLS+tx] : -1;
      const bottom = ty < ROWS-1     ? _zones[(ty+1)*COLS+tx] : -1;
      const left   = tx > 0          ? _zones[ty*COLS+(tx-1)] : -1;
      const right  = tx < COLS-1     ? _zones[ty*COLS+(tx+1)] : -1;

      ctx.beginPath();
      if (top    !== z) { ctx.moveTo(px,        py);        ctx.lineTo(px+TILE, py); }
      if (bottom !== z) { ctx.moveTo(px,        py+TILE);   ctx.lineTo(px+TILE, py+TILE); }
      if (left   !== z) { ctx.moveTo(px,        py);        ctx.lineTo(px,      py+TILE); }
      if (right  !== z) { ctx.moveTo(px+TILE,   py);        ctx.lineTo(px+TILE, py+TILE); }
      ctx.stroke();
    }
  }
}
