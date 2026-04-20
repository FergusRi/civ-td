// Tile-based world map
export const TILE   = 32;
export const COLS   = 250;
export const ROWS   = 250;
export const MAP_PX = COLS * TILE; // 8000px

// Tile types
export const T = {
  GRASS: 0,
  DIRT:  1,
  STONE: 2,
  SAND:  3,
};

const GRASS_COL  = '#5A8A3C';
const GRASS_BDR  = '#4A7A2C';
const DIRT_COL   = '#9B7240';
const DIRT_BDR   = '#7A5230';
const STONE_COL  = '#7A7A7A';
const STONE_BDR  = '#5A5A5A';
const SAND_COL   = '#C8A85A';
const SAND_BDR   = '#A8883A';

// ── Sprite objects scattered on terrain ──────────────────────────────────────
// Each entry: { tx, ty, kind, size }
// kind: 'tree_oak' | 'tree_pine' | 'tree_large' | 'stone_small' | 'stone_large'
export const mapSprites = [];

// Dirt path layer
export const pathTiles = new Set();

// Grid
let _grid = [];

// ── Seeded RNG ────────────────────────────────────────────────────────────────
function _rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Per-tile hash (deterministic, no RNG state) ───────────────────────────────
function _hash(tx, ty) {
  let h = ((tx * 2246822519) ^ (ty * 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// ── Terrain generation ────────────────────────────────────────────────────────
export function initWorld() {
  _grid = new Uint8Array(COLS * ROWS); // all 0 = GRASS
  mapSprites.length = 0;
  pathTiles.clear();
  _generateTerrain();
}

function _generateTerrain() {
  const rand = _rng(Date.now());
  const cx   = Math.floor(COLS / 2);
  const cy   = Math.floor(ROWS / 2);

  // ── 1. Dirt paths + central plaza ─────────────────────────────────────────
  // 5-tile radius dirt plaza around settlement
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      if (dx * dx + dy * dy > 36) continue;
      const tx = cx + dx, ty = cy + dy;
      if (_inBounds(tx, ty)) {
        _grid[ty * COLS + tx] = T.DIRT;
        pathTiles.add(`${tx},${ty}`);
      }
    }
  }

  // 4 roads radiating out
  const roadDirs = [[0,-1],[0,1],[1,0],[-1,0]];
  for (const [ddx, ddy] of roadDirs) {
    let tx = cx + ddx * 7, ty = cy + ddy * 7;
    let len = 18 + Math.floor(rand() * 12);
    for (let i = 0; i < len; i++) {
      if (!_inBounds(tx, ty)) break;
      _grid[ty * COLS + tx] = T.DIRT;
      pathTiles.add(`${tx},${ty}`);
      // 1-tile wide road sides
      const sx = tx + ddy, sy = ty + ddx;
      const sx2 = tx - ddy, sy2 = ty - ddx;
      if (_inBounds(sx, sy) && rand() < 0.6) { _grid[sy * COLS + sx] = T.DIRT; pathTiles.add(`${sx},${sy}`); }
      if (_inBounds(sx2, sy2) && rand() < 0.6) { _grid[sy2 * COLS + sx2] = T.DIRT; pathTiles.add(`${sx2},${sy2}`); }
      tx += ddx; ty += ddy;
    }
  }

  // ── 2. Stone patches (near edges — NW rocky territory) ────────────────────
  const stoneCentres = [
    [Math.floor(COLS * 0.12), Math.floor(ROWS * 0.12)],
    [Math.floor(COLS * 0.08), Math.floor(ROWS * 0.20)],
    [Math.floor(COLS * 0.88), Math.floor(ROWS * 0.85)],
    [Math.floor(COLS * 0.80), Math.floor(ROWS * 0.10)],
  ];
  for (const [scx, scy] of stoneCentres) {
    const r = 8 + Math.floor(rand() * 8);
    _blobTile(scx, scy, r, T.STONE, rand);
  }

  // ── 3. Sand patches (dry river beds / open areas) ─────────────────────────
  for (let i = 0; i < 6; i++) {
    const scx = 10 + Math.floor(rand() * (COLS - 20));
    const scy = 10 + Math.floor(rand() * (ROWS - 20));
    const r   = 4 + Math.floor(rand() * 6);
    // skip if too close to centre clearing
    const ddx = scx - cx, ddy = scy - cy;
    if (ddx*ddx + ddy*ddy < 35*35) continue;
    _blobTile(scx, scy, r, T.SAND, rand);
  }

  // ── 4. Force clearing around settlement (GRASS + no sprites) ──────────────
  const clearR = 10;
  for (let dy = -clearR; dy <= clearR; dy++) {
    for (let dx = -clearR; dx <= clearR; dx++) {
      if (dx*dx + dy*dy > clearR*clearR) continue;
      const tx = cx + dx, ty = cy + dy;
      if (_inBounds(tx, ty)) _grid[ty * COLS + tx] = T.GRASS;
    }
  }
  // Re-apply dirt paths on top of clearing reset
  for (const key of pathTiles) {
    const [ptx, pty] = key.split(',').map(Number);
    if (_inBounds(ptx, pty)) _grid[pty * COLS + ptx] = T.DIRT;
  }

  // ── 5. Scatter sprites (trees + stones) ───────────────────────────────────
  _scatterSprites(rand, cx, cy);
}

function _blobTile(cx, cy, r, type, rand) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const tx = cx + dx, ty = cy + dy;
      if (!_inBounds(tx, ty)) continue;
      const jitter = 0.65 + 0.35 * (_hash(tx, ty) / 0xFFFFFFFF);
      if (Math.sqrt(dx*dx + dy*dy) < r * jitter) {
        _grid[ty * COLS + tx] = type;
      }
    }
  }
}

function _scatterSprites(rand, cx, cy) {
  const CLEAR_R2 = 13 * 13; // no sprites within 13 tiles of centre

  // ── Forest clusters near enemy attack edges ───────────────────────────────
  const forestCentres = [
    // North — Goblins
    [Math.floor(COLS * 0.3 + rand() * COLS * 0.4), Math.floor(ROWS * 0.05)],
    [Math.floor(COLS * 0.2 + rand() * COLS * 0.2), Math.floor(ROWS * 0.10)],
    [Math.floor(COLS * 0.6 + rand() * COLS * 0.2), Math.floor(ROWS * 0.08)],
    // East — Dark Elves
    [Math.floor(COLS * 0.92), Math.floor(ROWS * 0.3 + rand() * ROWS * 0.4)],
    [Math.floor(COLS * 0.87), Math.floor(ROWS * 0.2 + rand() * ROWS * 0.3)],
    // South — Undead
    [Math.floor(COLS * 0.4 + rand() * COLS * 0.2), Math.floor(ROWS * 0.93)],
    [Math.floor(COLS * 0.25 + rand() * COLS * 0.5), Math.floor(ROWS * 0.88)],
    // West — Orcs
    [Math.floor(COLS * 0.05), Math.floor(ROWS * 0.4 + rand() * ROWS * 0.2)],
    // Mid-map smaller clusters
    [Math.floor(COLS * 0.25 + rand() * COLS * 0.5), Math.floor(ROWS * 0.2 + rand() * ROWS * 0.6)],
    [Math.floor(COLS * 0.15 + rand() * COLS * 0.7), Math.floor(ROWS * 0.15 + rand() * ROWS * 0.7)],
    [Math.floor(COLS * 0.1  + rand() * COLS * 0.8), Math.floor(ROWS * 0.1  + rand() * ROWS * 0.8)],
  ];

  const TREE_KINDS = ['tree_oak', 'tree_pine', 'tree_large'];
  const TREE_SIZES = { tree_oak: [18,22,26], tree_pine: [16,20,24], tree_large: [28,34,40] };

  for (const [fcx, fcy] of forestCentres) {
    const clusterR = 12 + Math.floor(rand() * 18);
    const count    = 18 + Math.floor(rand() * 30);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist  = rand() * clusterR;
      const tx    = Math.round(fcx + Math.cos(angle) * dist);
      const ty    = Math.round(fcy + Math.sin(angle) * dist);
      if (!_inBounds(tx, ty)) continue;
      const ddx = tx - cx, ddy = ty - cy;
      if (ddx*ddx + ddy*ddy < CLEAR_R2) continue;
      const kind  = TREE_KINDS[Math.floor(rand() * TREE_KINDS.length)];
      const sizes = TREE_SIZES[kind];
      const size  = sizes[Math.floor(rand() * sizes.length)];
      mapSprites.push({ tx, ty, kind, size });
    }
  }

  // ── Sparse individual trees across the map ────────────────────────────────
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ddx = tx - cx, ddy = ty - cy;
      if (ddx*ddx + ddy*ddy < CLEAR_R2) continue;
      const h = _hash(tx, ty);
      if (h % 100 < 3) { // 3% sparse coverage
        const kind  = TREE_KINDS[h % TREE_KINDS.length];
        const sizes = TREE_SIZES[kind];
        const size  = sizes[h % sizes.length];
        mapSprites.push({ tx, ty, kind, size });
      }
    }
  }

  // ── Stone boulder sprites on stone tiles ──────────────────────────────────
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (_grid[ty * COLS + tx] !== T.STONE) continue;
      const ddx = tx - cx, ddy = ty - cy;
      if (ddx*ddx + ddy*ddy < CLEAR_R2) continue;
      const h = _hash(tx + 7, ty + 3);
      if (h % 10 < 4) { // 40% of stone tiles get a boulder sprite
        const kind = h % 3 === 0 ? 'stone_large' : 'stone_small';
        const size = kind === 'stone_large' ? 20 + (h % 8) : 12 + (h % 6);
        mapSprites.push({ tx, ty, kind, size });
      }
    }
  }

  // Sort sprites by ty for Y-sort painter's algorithm
  mapSprites.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
}

function _inBounds(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
}

// ── Accessors ─────────────────────────────────────────────────────────────────
export function getTile(tx, ty) {
  if (!_inBounds(tx, ty)) return T.GRASS;
  return _grid[ty * COLS + tx];
}

export function setTile(tx, ty, type) {
  if (!_inBounds(tx, ty)) return;
  _grid[ty * COLS + tx] = type;
}

export function isWalkable(tx, ty) {
  return _inBounds(tx, ty); // all tiles walkable — no water
}

// ── Render ────────────────────────────────────────────────────────────────────
export function renderWorld(ctx, cam) {
  const tx0 = Math.max(0, Math.floor(cam.x / TILE));
  const ty0 = Math.max(0, Math.floor(cam.y / TILE));
  const tx1 = Math.min(COLS - 1, Math.ceil((cam.x + window.innerWidth  / cam.zoom) / TILE));
  const ty1 = Math.min(ROWS - 1, Math.ceil((cam.y + window.innerHeight / cam.zoom) / TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t  = _grid[ty * COLS + tx];
      const px = tx * TILE;
      const py = ty * TILE;

      // Base tile colour
      switch (t) {
        case T.GRASS: ctx.fillStyle = GRASS_COL;  break;
        case T.DIRT:  ctx.fillStyle = DIRT_COL;   break;
        case T.STONE: ctx.fillStyle = STONE_COL;  break;
        case T.SAND:  ctx.fillStyle = SAND_COL;   break;
        default:      ctx.fillStyle = GRASS_COL;
      }
      ctx.fillRect(px, py, TILE, TILE);

      // Grid border
      switch (t) {
        case T.GRASS: ctx.strokeStyle = GRASS_BDR; break;
        case T.DIRT:  ctx.strokeStyle = DIRT_BDR;  break;
        case T.STONE: ctx.strokeStyle = STONE_BDR; break;
        case T.SAND:  ctx.strokeStyle = SAND_BDR;  break;
        default:      ctx.strokeStyle = GRASS_BDR;
      }
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.25, py + 0.25, TILE - 0.5, TILE - 0.5);
    }
  }
}

// Sprite render pass (called after buildings, before citizens — Y-sorted)
export function renderMapSprites(ctx, cam) {
  const vpLeft   = cam.x - TILE * 2;
  const vpTop    = cam.y - TILE * 2;
  const vpRight  = cam.x + window.innerWidth  / cam.zoom + TILE * 2;
  const vpBottom = cam.y + window.innerHeight / cam.zoom + TILE * 2;

  for (const s of mapSprites) {
    const wx = s.tx * TILE + TILE / 2;
    const wy = s.ty * TILE + TILE;
    if (wx < vpLeft || wx > vpRight || wy < vpTop || wy > vpBottom) continue;
    _drawMapSprite(ctx, s, wx, wy);
  }
}

function _drawMapSprite(ctx, s, wx, wy) {
  const r = s.size / 2;

  switch (s.kind) {
    case 'tree_oak': {
      // Trunk
      ctx.fillStyle = '#5A3A0A';
      ctx.fillRect(wx - 2, wy - r * 0.4, 4, r * 0.5);
      // Shadow ellipse
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(wx, wy, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dark base canopy
      ctx.fillStyle = '#1E5218';
      ctx.beginPath();
      ctx.arc(wx, wy - r * 0.55, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Mid canopy
      ctx.fillStyle = '#2D7A28';
      ctx.beginPath();
      ctx.arc(wx - r * 0.15, wy - r * 0.7, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = '#48A040';
      ctx.beginPath();
      ctx.arc(wx - r * 0.25, wy - r * 0.85, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'tree_pine': {
      // Trunk
      ctx.fillStyle = '#6B4020';
      ctx.fillRect(wx - 2, wy - r * 0.3, 4, r * 0.4);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(wx, wy, r * 0.5, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Three layered triangles (pine silhouette)
      const layers = [
        { yOff: 0,       w: r * 0.9, col: '#1A4A18' },
        { yOff: -r * 0.4, w: r * 0.7, col: '#256020' },
        { yOff: -r * 0.7, w: r * 0.5, col: '#307828' },
      ];
      for (const l of layers) {
        ctx.fillStyle = l.col;
        ctx.beginPath();
        ctx.moveTo(wx, wy - r * 1.1 + l.yOff);
        ctx.lineTo(wx - l.w, wy - r * 0.2 + l.yOff);
        ctx.lineTo(wx + l.w, wy - r * 0.2 + l.yOff);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'tree_large': {
      // Trunk — wider
      ctx.fillStyle = '#4A2A08';
      ctx.fillRect(wx - 3, wy - r * 0.35, 6, r * 0.45);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(wx, wy, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      // Large dark base
      ctx.fillStyle = '#163A14';
      ctx.beginPath();
      ctx.arc(wx, wy - r * 0.5, r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      // Secondary blob offset
      ctx.fillStyle = '#246020';
      ctx.beginPath();
      ctx.arc(wx + r * 0.3, wy - r * 0.6, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      // Third blob
      ctx.fillStyle = '#2D7A28';
      ctx.beginPath();
      ctx.arc(wx - r * 0.2, wy - r * 0.8, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
      // Top highlight
      ctx.fillStyle = '#50B048';
      ctx.beginPath();
      ctx.arc(wx - r * 0.3, wy - r * 1.0, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stone_small': {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(wx, wy, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      // Boulder body
      ctx.fillStyle = '#7A7A7A';
      ctx.beginPath();
      ctx.ellipse(wx, wy - r * 0.4, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = '#AAAAAA';
      ctx.beginPath();
      ctx.ellipse(wx - r * 0.25, wy - r * 0.65, r * 0.4, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dark base
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(wx, wy - r * 0.2, r * 0.75, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stone_large': {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(wx, wy, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Main rock — irregular polygon feel using two overlapping ellipses
      ctx.fillStyle = '#6E6E6E';
      ctx.beginPath();
      ctx.ellipse(wx - r * 0.1, wy - r * 0.45, r * 1.0, r * 0.75, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7E7E7E';
      ctx.beginPath();
      ctx.ellipse(wx + r * 0.15, wy - r * 0.5, r * 0.8, r * 0.6, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = '#B0B0B0';
      ctx.beginPath();
      ctx.ellipse(wx - r * 0.3, wy - r * 0.75, r * 0.45, r * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Crack line
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx + r * 0.1, wy - r * 0.3);
      ctx.lineTo(wx - r * 0.1, wy - r * 0.7);
      ctx.stroke();
      break;
    }
  }
}

// No-op shim — path rendering is embedded in renderWorld tile loop
export function renderPaths(ctx, cam) { void ctx; void cam; }
