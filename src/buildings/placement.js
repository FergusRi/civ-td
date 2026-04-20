import { TILE, COLS, ROWS } from '../world/map.js';
import { BUILDINGS } from './registry.js';
import { hasResources, spendResources } from '../resources.js';
import { events, EV } from '../engine/events.js';
import { drawBuildingSprite } from './sprites.js';
import { getMouse } from '../engine/input.js';
import { getCamera } from '../engine/camera.js';
import { getPhase } from '../phases/phases.js';

// key: "tx,ty" → building object
export const placedBuildings = new Map();

let _selectedType = null;

// ── Selection ────────────────────────────────────────────────────────────────
export function selectBuildingType(type) { _selectedType = type; }
export function cancelPlacement()        { _selectedType = null; }
export function getSelectedType()        { return _selectedType; }

// ── Placement ─────────────────────────────────────────────────────────────────
export function tryPlaceBuilding(wx, wy) {
  if (!_selectedType) return;
  const def = BUILDINGS[_selectedType];
  if (!def) return;

  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  const size = def.size ?? 1;

  if (!_canPlace(tx, ty, size)) return;
  if (!hasResources(def.cost))  return;

  spendResources(def.cost);
  _placeAt(tx, ty, _selectedType, def);
  _selectedType = null;
}

function _canPlace(tx, ty, size) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const key = `${tx+dx},${ty+dy}`;
      if (tx+dx < 0 || ty+dy < 0 || tx+dx >= COLS || ty+dy >= ROWS) return false;
      if (placedBuildings.has(key)) return false;
    }
  }
  return true;
}

function _placeAt(tx, ty, type, def) {
  const size = def.size ?? 1;
  const b = {
    id:       `${type}_${tx}_${ty}_${Date.now()}`,
    type,
    tx, ty,
    size,
    hp:       def.hp,
    maxHp:    def.hp,
    state:    'complete',   // instant placement for now
    _aimAngle: 0,
  };

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      placedBuildings.set(`${tx+dx},${ty+dy}`, b);
    }
  }

  events.emit(EV.BUILDING_PLACED, b);
  return b;
}

export function placeInitialSettlement() {
  const cx = Math.floor(COLS / 2) - 1;
  const cy = Math.floor(ROWS / 2) - 1;
  _placeAt(cx, cy, 'settlement', BUILDINGS.settlement);
}

export function getBuilding(tx, ty) {
  return placedBuildings.get(`${tx},${ty}`) ?? null;
}

export function damageBuilding(b, amount) {
  b.hp -= amount;
  if (b.hp <= 0) destroyBuilding(b);
}

export function destroyBuilding(b) {
  for (let dy = 0; dy < b.size; dy++) {
    for (let dx = 0; dx < b.size; dx++) {
      placedBuildings.delete(`${b.tx+dx},${b.ty+dy}`);
    }
  }
  events.emit(EV.BUILDING_DESTROYED, b);
}

// ── Wall adjacency mask (4-bit NESW) ─────────────────────────────────────────
function _wallMask(b) {
  const dirs = [
    [0, -1], // N
    [1,  0], // E
    [0,  1], // S
    [-1, 0], // W
  ];
  let mask = 0;
  dirs.forEach(([dx, dy], i) => {
    const nb = getBuilding(b.tx + dx, b.ty + dy);
    if (nb && nb.type === b.type) mask |= (1 << i);
  });
  return mask;
}

// ── Render ───────────────────────────────────────────────────────────────────
export function initBuildings() {
  placeInitialSettlement();
}

export function renderBuildings(ctx, _cam) {
  const drawn = new Set();

  for (const b of placedBuildings.values()) {
    if (drawn.has(b.id)) continue;
    drawn.add(b.id);

    const def = BUILDINGS[b.type];
    const px  = b.tx * TILE;
    const py  = b.ty * TILE;
    const sz  = (b.size ?? 1) * TILE;
    const adj = def?.isWall ? _wallMask(b) : 0;

    drawBuildingSprite(ctx, b.type, b.state, px, py, sz, sz, b._aimAngle, adj);

    // HP bar (only if damaged)
    if (b.hp < b.maxHp) {
      const bw = sz - 4;
      const bh = 4;
      const bx = px + 2;
      const by = py - 6;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = b.hp / b.maxHp > 0.5 ? '#4CAF50' : '#F44336';
      ctx.fillRect(bx, by, bw * (b.hp / b.maxHp), bh);
    }
  }

  // Ghost / placement preview
  if (_selectedType && getPhase() === 'planning') {
    const mouse = getMouse();
    const cam   = getCamera();
    const tx = Math.floor(mouse.wx / TILE);
    const ty = Math.floor(mouse.wy / TILE);
    const def = BUILDINGS[_selectedType];
    if (!def) return;
    const size = def.size ?? 1;
    const px = tx * TILE;
    const py = ty * TILE;
    const ok = _canPlace(tx, ty, size) && hasResources(def.cost);

    ctx.globalAlpha = 0.55;
    drawBuildingSprite(ctx, _selectedType, 'complete', px, py, size * TILE, size * TILE, 0, 0);
    ctx.globalAlpha = 1;

    // Tint red if invalid
    if (!ok) {
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      ctx.fillRect(px, py, size * TILE, size * TILE);
    }
    void cam;
  }
}
