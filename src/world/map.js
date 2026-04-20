// Tile-based world map
export const TILE  = 32;        // px per tile
export const COLS  = 40;        // tiles wide
export const ROWS  = 40;        // tiles tall
export const MAP_PX = COLS * TILE; // 1280px

// Tile types
export const T = {
  GRASS:  0,
  DIRT:   1,
  WATER:  2,
  STONE:  3,
  TREE:   4,
};

// Tile colours (flat pixel style)
const TILE_COLOURS = {
  [T.GRASS]: '#5A8A3C',
  [T.DIRT]:  '#9B7240',
  [T.WATER]: '#3A6EA8',
  [T.STONE]: '#7A7A7A',
  [T.TREE]:  '#2D6A2D',
};

const TILE_BORDER = {
  [T.GRASS]: '#4A7A2C',
  [T.DIRT]:  '#7A5230',
  [T.WATER]: '#2A5E98',
  [T.STONE]: '#5A5A5A',
  [T.TREE]:  '#1D5A1D',
};

// Grid: flat array [row * COLS + col]
let _grid = [];

export function initWorld() {
  _grid = new Array(COLS * ROWS).fill(T.GRASS);
  _generateTerrain();
}

function _generateTerrain() {
  // Seed a few patches of dirt, stone, trees using simple noise-like scatter
  _scatter(T.DIRT,  60, 3);
  _scatter(T.STONE, 30, 2);
  _scatter(T.TREE,  80, 2);
  // Small river-like water strip
  _waterStrip();
}

function _scatter(type, count, radius) {
  for (let i = 0; i < count; i++) {
    const cx = 2 + Math.floor(Math.random() * (COLS - 4));
    const cy = 2 + Math.floor(Math.random() * (ROWS - 4));
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx + dy*dy <= radius*radius) {
          const tx = cx + dx, ty = cy + dy;
          if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) {
            _grid[ty * COLS + tx] = type;
          }
        }
      }
    }
  }
}

function _waterStrip() {
  let y = 8 + Math.floor(Math.random() * 6);
  for (let x = 0; x < COLS; x++) {
    _grid[y * COLS + x] = T.WATER;
    if (Math.random() < 0.3) y += Math.random() < 0.5 ? 1 : -1;
    y = Math.max(4, Math.min(ROWS - 5, y));
  }
}

export function getTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.GRASS;
  return _grid[ty * COLS + tx];
}

export function setTile(tx, ty, type) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  _grid[ty * COLS + tx] = type;
}

export function isWalkable(tx, ty) {
  const t = getTile(tx, ty);
  return t !== T.WATER;
}

export function renderWorld(ctx, cam) {
  // Compute visible tile range
  const tx0 = Math.max(0, Math.floor(cam.x / TILE));
  const ty0 = Math.max(0, Math.floor(cam.y / TILE));
  const tx1 = Math.min(COLS - 1, Math.ceil((cam.x + window.innerWidth  / cam.zoom) / TILE));
  const ty1 = Math.min(ROWS - 1, Math.ceil((cam.y + window.innerHeight / cam.zoom) / TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = _grid[ty * COLS + tx];
      const px = tx * TILE;
      const py = ty * TILE;

      ctx.fillStyle = TILE_COLOURS[t] ?? '#5A8A3C';
      ctx.fillRect(px, py, TILE, TILE);

      // Subtle grid border
      ctx.strokeStyle = TILE_BORDER[t] ?? '#4A7A2C';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.25, py + 0.25, TILE - 0.5, TILE - 0.5);
    }
  }
}
