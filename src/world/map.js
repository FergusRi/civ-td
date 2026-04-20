import { isMaskLand, EARTH_REGIONS, EARTH_MASK_W, EARTH_MASK_H } from './earth_mask.js';
import { loadWangTileset, drawWangTile, hasWangTileset } from './wang.js';
// ============================================================
// map.js — 250×250 tile map with Whittaker-style noise biomes
// Decoration pass: trees + rocks as Y-sorted sprites (no images needed)
// Civ-TD tile types: GRASS / DIRT / STONE / SAND
// ============================================================

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
  WATER: 4,
};

// Tile colours (fallback when images not loaded)
const COL = {
  [T.GRASS]: { fill: '#5A8A3C', border: '#4A7A2C' },
  [T.DIRT]:  { fill: '#9B7240', border: '#7A5230' },
  [T.STONE]: { fill: '#7A7A7A', border: '#5A5A5A' },
  [T.SAND]:  { fill: '#C8A85A', border: '#A8883A' },
  [T.WATER]: { fill: '#2A6A9A', border: '#1A4A7A' },
};

// Pixel-art tile images (loaded once)
const TILE_IMGS = {};
const TILE_IMG_SRCS = {
  [T.GRASS]: '/tiles/grass.png',
  [T.DIRT]:  '/tiles/dirt.png',
  [T.STONE]: '/tiles/stone.png',
  [T.SAND]:  '/tiles/sand.png',
  [T.WATER]: '/tiles/water.png',
};
export function preloadTileImages() {
  const tileLoads = Object.entries(TILE_IMG_SRCS).map(([t, src]) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { TILE_IMGS[t] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    });
  });
  const wangLoads = [
    loadWangTileset('grass_water', '/tiles/grass_water.png'),
  ];
  return Promise.all([...tileLoads, ...wangLoads]);
}

// ── Preloaded sprite images ───────────────────────────────────
const _imgs = {};
const _IMG_PATHS = {
  tree_oak:   'assets/trees/tree_oak.png',
  tree_pine:  'assets/trees/tree_pine_grass.png',
  tree_large: 'assets/trees/tree_acacia.png',
  rock_small: 'assets/decor/rock_grass.png',
  rock_large: 'assets/decor/rock_grass2.png',
};

export function preloadMapSprites() {
  return Promise.all(Object.entries(_IMG_PATHS).map(([key, src]) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { _imgs[key] = img; resolve(); };
      img.onerror = () => { console.warn(`[map] failed to load ${src}`); resolve(); };
      img.src = src;
    });
  }));
}

// ── Sprite objects scattered on terrain ──────────────────────
// Each entry: { tx, ty, kind, size }
export const mapSprites = [];

// Dirt path overlay keys ("tx,ty") — for any future path rendering
export const pathTiles = new Set();

// Flat tile array
let _grid = new Uint8Array(COLS * ROWS);

// Seeded RNG state
export let MAP_SEED = 0;

// Currently selected Earth region (set before initWorld)
let _activeRegion = null; // null = classic noise map
export function setEarthRegion(regionId) {
  _activeRegion = EARTH_REGIONS.find(r => r.id === regionId) ?? null;
}
export function getEarthRegions() { return EARTH_REGIONS; }
export function getActiveRegion()  { return _activeRegion; }

// ── Seeded RNG (mulberry32) ───────────────────────────────────
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Per-tile hash (no RNG state) ──────────────────────────────
function _hash(seed, tx, ty) {
  let h = (seed ^ (tx * 2246822519) ^ (ty * 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// ── Cosine-interpolated value noise ──────────────────────────
function cosInterp(t) { return (1 - Math.cos(t * Math.PI)) * 0.5; }

function buildNoiseMap(size, layers, rng) {
  const out = new Float32Array(size * size);
  for (const { scale, amp } of layers) {
    const gs   = Math.ceil(size * scale) + 2;
    const grid = new Float32Array(gs * gs);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const fx = tx * scale, fy = ty * scale;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const cx = cosInterp(fx - ix), cy = cosInterp(fy - iy);
        const gx0 = ix % gs, gx1 = (ix + 1) % gs;
        const gy0 = iy % gs, gy1 = (iy + 1) % gs;
        const top    = grid[gy0*gs+gx0] + cx*(grid[gy0*gs+gx1]-grid[gy0*gs+gx0]);
        const bottom = grid[gy1*gs+gx0] + cx*(grid[gy1*gs+gx1]-grid[gy1*gs+gx0]);
        out[ty*size+tx] += (top + cy*(bottom-top)) * amp;
      }
    }
  }
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < out.length; i++) { if (out[i]<mn) mn=out[i]; if (out[i]>mx) mx=out[i]; }
  const r = mx - mn || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i]-mn)/r;
  return out;
}

// ── Whittaker-style biome classifier ─────────────────────────
// Maps elevation + moisture → civ-td tile types
// No water — elevation floor keeps everything land
function whittaker(e, m) {
  if (e > 0.78) return T.STONE;   // high ground = rocky
  if (e < 0.38) {
    if (m > 0.55) return T.GRASS; // low wet = lush grass
    return T.SAND;                 // low dry = sandy flats
  }
  if (m > 0.65) return T.GRASS;   // mid wet = grass
  if (m < 0.28) return T.SAND;    // mid dry = sandy
  return T.GRASS;                  // default: grass
}

// ── Terrain generation ────────────────────────────────────────
export function initWorld(regionId = null) {
  if (regionId !== null) setEarthRegion(regionId);
  MAP_SEED = Date.now();
  _grid = new Uint8Array(COLS * ROWS);
  mapSprites.length = 0;
  pathTiles.clear();
  _generateTerrain();
}

function _generateTerrain() {
  const rng = mulberry32(MAP_SEED);
  const useEarth = _activeRegion !== null;
  // Use region start tile as settlement centre when Earth mode is active
  const cx = _activeRegion ? _activeRegion.tx : Math.floor(COLS / 2);
  const cy = _activeRegion ? _activeRegion.ty : Math.floor(ROWS / 2);

  // ── Pass 1: Noise-based biome tiles ──────────────────────
  const elevMap  = buildNoiseMap(COLS, [
    { scale: 0.006, amp: 1.00 },
    { scale: 0.015, amp: 0.50 },
    { scale: 0.040, amp: 0.25 },
    { scale: 0.090, amp: 0.12 },
  ], rng);

  const moistMap = buildNoiseMap(COLS, [
    { scale: 0.008, amp: 1.00 },
    { scale: 0.022, amp: 0.50 },
    { scale: 0.055, amp: 0.25 },
  ], rng);

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const i = ty * COLS + tx;
      if (useEarth && !isMaskLand(tx, ty)) {
        _grid[i] = T.WATER;
      } else {
        _grid[i] = whittaker(elevMap[i], moistMap[i]);
      }
    }
  }

  // ── Pass 2: Dirt plaza + 4 roads from settlement centre ──
  // Central dirt plaza (r=6)
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      if (dx*dx + dy*dy > 36) continue;
      const tx = cx+dx, ty = cy+dy;
      if (_inBounds(tx,ty)) { _grid[ty*COLS+tx] = T.DIRT; pathTiles.add(`${tx},${ty}`); }
    }
  }

  // 4 roads radiating outward
  const roadDirs = [[0,-1],[0,1],[1,0],[-1,0]];
  for (const [ddx, ddy] of roadDirs) {
    let tx = cx + ddx*7, ty = cy + ddy*7;
    const len = 20 + Math.floor(rng() * 15);
    for (let i = 0; i < len; i++) {
      if (!_inBounds(tx, ty)) break;
      _grid[ty*COLS+tx] = T.DIRT; pathTiles.add(`${tx},${ty}`);
      // Road sides (1 tile wide)
      const sx = tx+ddy, sy = ty+ddx;
      const sx2 = tx-ddy, sy2 = ty-ddx;
      if (_inBounds(sx,sy)  && rng()<0.6) { _grid[sy*COLS+sx]  = T.DIRT; pathTiles.add(`${sx},${sy}`); }
      if (_inBounds(sx2,sy2)&& rng()<0.6) { _grid[sy2*COLS+sx2]= T.DIRT; pathTiles.add(`${sx2},${sy2}`); }
      tx += ddx; ty += ddy;
    }
  }

  // ── Pass 3: Force grass clearing around settlement ────────
  const CLEAR_R = 11;
  for (let dy = -CLEAR_R; dy <= CLEAR_R; dy++) {
    for (let dx = -CLEAR_R; dx <= CLEAR_R; dx++) {
      if (dx*dx + dy*dy > CLEAR_R*CLEAR_R) continue;
      const tx = cx+dx, ty = cy+dy;
      if (_inBounds(tx,ty) && _grid[ty*COLS+tx] !== T.WATER) _grid[ty*COLS+tx] = T.GRASS;
    }
  }
  // Re-stamp dirt paths over clearing
  for (const key of pathTiles) {
    const [ptx, pty] = key.split(',').map(Number);
    if (_inBounds(ptx, pty)) _grid[pty*COLS+ptx] = T.DIRT;
  }

  // ── Pass 4: Scatter decoration sprites ───────────────────
  _scatterSprites(rng, cx, cy);
}

function _scatterSprites(rng, cx, cy) {
  const CLEAR_R2 = 14 * 14;
  const TREE_KINDS = ['tree_oak', 'tree_pine', 'tree_large'];
  const TREE_SIZES = { tree_oak: [26,32,38], tree_pine: [16,20,24], tree_large: [28,34,40] };

  // Forest clusters near faction attack edges
  // N=Goblins, E=DarkElves, S=Undead, W=Orcs, NW=Giants
  const forestCentres = [
    // North
    [Math.floor(COLS*0.25 + rng()*COLS*0.5), Math.floor(ROWS*0.05)],
    [Math.floor(COLS*0.15 + rng()*COLS*0.25), Math.floor(ROWS*0.10)],
    [Math.floor(COLS*0.60 + rng()*COLS*0.20), Math.floor(ROWS*0.08)],
    // East
    [Math.floor(COLS*0.93), Math.floor(ROWS*0.25 + rng()*ROWS*0.5)],
    [Math.floor(COLS*0.88), Math.floor(ROWS*0.15 + rng()*ROWS*0.35)],
    // South
    [Math.floor(COLS*0.35 + rng()*COLS*0.3), Math.floor(ROWS*0.93)],
    [Math.floor(COLS*0.20 + rng()*COLS*0.6), Math.floor(ROWS*0.88)],
    // West
    [Math.floor(COLS*0.04), Math.floor(ROWS*0.35 + rng()*ROWS*0.3)],
    [Math.floor(COLS*0.08), Math.floor(ROWS*0.20 + rng()*ROWS*0.4)],
    // Mid-map clusters
    [Math.floor(COLS*0.20 + rng()*COLS*0.6), Math.floor(ROWS*0.20 + rng()*ROWS*0.6)],
    [Math.floor(COLS*0.15 + rng()*COLS*0.7), Math.floor(ROWS*0.15 + rng()*ROWS*0.7)],
    [Math.floor(COLS*0.10 + rng()*COLS*0.8), Math.floor(ROWS*0.10 + rng()*ROWS*0.8)],
  ];

  for (const [fcx, fcy] of forestCentres) {
    const clusterR = 12 + Math.floor(rng() * 18);
    const count    = 20 + Math.floor(rng() * 30);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist  = rng() * clusterR;
      const tx    = Math.round(fcx + Math.cos(angle) * dist);
      const ty    = Math.round(fcy + Math.sin(angle) * dist);
      if (!_inBounds(tx, ty)) continue;
      const ddx = tx-cx, ddy = ty-cy;
      if (ddx*ddx + ddy*ddy < CLEAR_R2) continue;
      if (_grid[ty*COLS+tx] === T.DIRT || _grid[ty*COLS+tx] === T.WATER) continue; // no trees on roads/water
      const kind  = TREE_KINDS[Math.floor(rng() * TREE_KINDS.length)];
      const sizes = TREE_SIZES[kind];
      const size  = sizes[Math.floor(rng() * sizes.length)];
      mapSprites.push({ tx, ty, kind, size });
    }
  }

  // Sparse individual trees across the map (3% hash-based)
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ddx = tx-cx, ddy = ty-cy;
      if (ddx*ddx + ddy*ddy < CLEAR_R2) continue;
      if (_grid[ty*COLS+tx] === T.DIRT || _grid[ty*COLS+tx] === T.WATER) continue;
      const h = _hash(MAP_SEED, tx, ty);
      if (h % 100 < 3) {
        const kind  = TREE_KINDS[h % TREE_KINDS.length];
        const sizes = TREE_SIZES[kind];
        const size  = sizes[h % sizes.length];
        mapSprites.push({ tx, ty, kind, size });
      }
    }
  }

  // Stone boulder sprites on STONE tiles (40% coverage)
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (_grid[ty*COLS+tx] !== T.STONE) continue;
      const ddx = tx-cx, ddy = ty-cy;
      if (ddx*ddx + ddy*ddy < CLEAR_R2) continue;
      const h = _hash(MAP_SEED+7, tx, ty);
      if (h % 10 < 4) {
        const kind = h % 3 === 0 ? 'stone_large' : 'stone_small';
        const size = kind === 'stone_large' ? 20 + (h%8) : 12 + (h%6);
        mapSprites.push({ tx, ty, kind, size });
      }
    }
  }

  // Y-sort sprites
  mapSprites.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  console.log(`[map] ${COLS}×${ROWS} seed=${MAP_SEED} sprites=${mapSprites.length}`);
}

function _inBounds(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
}

// ── Accessors ─────────────────────────────────────────────────
export function getTile(tx, ty) {
  if (!_inBounds(tx, ty)) return T.GRASS;
  return _grid[ty * COLS + tx];
}
export function setTile(tx, ty, type) {
  if (!_inBounds(tx, ty)) return;
  _grid[ty * COLS + tx] = type;
}
export function isWalkable(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  const t = _grid[ty * COLS + tx];
  return t !== T.STONE && t !== T.WATER;
}

// ── Ground tile render ────────────────────────────────────────
export function renderWorld(ctx, cam) {
  const tx0 = Math.max(0,      Math.floor(cam.x / TILE));
  const ty0 = Math.max(0,      Math.floor(cam.y / TILE));
  const tx1 = Math.min(COLS-1, Math.ceil((cam.x + window.innerWidth  / cam.zoom) / TILE));
  const ty1 = Math.min(ROWS-1, Math.ceil((cam.y + window.innerHeight / cam.zoom) / TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t  = _grid[ty * COLS + tx];
      const px = tx * TILE, py = ty * TILE;

      // Wang transition tiles for grass↔water borders
      const isGrassOrWater = (t === T.GRASS || t === T.WATER);
      if (isGrassOrWater && hasWangTileset('grass_water')) {
        // For Wang lookup: grass=base, water=alt
        // We draw from grass's perspective: neighbour is "same" if also grass
        const tN = ty > 0        ? _grid[(ty-1)*COLS+tx]     : t;
        const tE = tx < COLS-1   ? _grid[ty*COLS+(tx+1)]     : t;
        const tS = ty < ROWS-1   ? _grid[(ty+1)*COLS+tx]     : t;
        const tW = tx > 0        ? _grid[ty*COLS+(tx-1)]     : t;
        const sameN = tN === t, sameE = tE === t, sameS = tS === t, sameW = tW === t;
        const drawnByWang = drawWangTile(ctx, 'grass_water', sameN, sameE, sameS, sameW, px, py, TILE);
        if (t === T.WATER && drawnByWang) {
          const shimmer = Math.sin(Date.now() * 0.002 + tx * 0.4 + ty * 0.4);
          ctx.fillStyle = `rgba(255,255,255,${0.03 + shimmer * 0.03})`;
          ctx.fillRect(px, py, TILE, TILE);
        }
      } else {
        const img = TILE_IMGS[t];
        if (img) {
          ctx.drawImage(img, px, py, TILE, TILE);
          if (t === T.WATER) {
            const shimmer = Math.sin(Date.now() * 0.002 + tx * 0.4 + ty * 0.4);
            ctx.fillStyle = `rgba(255,255,255,${0.04 + shimmer * 0.04})`;
            ctx.fillRect(px, py, TILE, TILE);
          }
        } else {
          const c = COL[t] || COL[T.GRASS];
          ctx.fillStyle = c.fill;
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }
  }
}

// ── Sprite render pass (Y-sorted, viewport-culled) ───────────
export function renderMapSprites(ctx, cam) {
  const vpL = cam.x - TILE*2;
  const vpT = cam.y - TILE*2;
  const vpR = cam.x + window.innerWidth  / cam.zoom + TILE*2;
  const vpB = cam.y + window.innerHeight / cam.zoom + TILE*2;

  for (const s of mapSprites) {
    const wx = s.tx * TILE + TILE/2;
    const wy = s.ty * TILE + TILE;
    if (wx < vpL || wx > vpR || wy < vpT || wy > vpB) continue;
    _drawSprite(ctx, s, wx, wy);
  }
}

function _drawSprite(ctx, s, wx, wy) {
  const r   = s.size / 2;
  const isTree = s.kind.startsWith('tree');

  // Map sprite kind → image key
  const imgKey = s.kind === 'tree_oak'   ? 'tree_oak'
               : s.kind === 'tree_pine'  ? 'tree_pine'
               : s.kind === 'tree_large' ? 'tree_large'
               : s.kind === 'stone_small'? 'rock_small'
               : s.kind === 'stone_large'? 'rock_large'
               : null;

  const img = imgKey ? _imgs[imgKey] : null;

  if (img) {
    // Draw as image — anchor bottom-centre at (wx, wy)
    const drawH = isTree ? s.size * 2 : s.size * 1.2;
    const drawW = isTree ? s.size * 1.6 : s.size * 1.4;
    ctx.drawImage(img, wx - drawW/2, wy - drawH, drawW, drawH);
    return;
  }

  // ── Procedural fallback (if image failed to load) ─────────
  switch (s.kind) {
    case 'tree_oak': {
      ctx.fillStyle = '#5A3A0A';
      ctx.fillRect(wx-2, wy-r*0.4, 4, r*0.5);
      ctx.fillStyle = '#1E5218';
      ctx.beginPath(); ctx.arc(wx, wy-r*0.55, r*0.85, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2D7A28';
      ctx.beginPath(); ctx.arc(wx-r*0.15, wy-r*0.7, r*0.7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#48A040';
      ctx.beginPath(); ctx.arc(wx-r*0.25, wy-r*0.85, r*0.4, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'tree_pine': {
      ctx.fillStyle = '#6B4020';
      ctx.fillRect(wx-2, wy-r*0.3, 4, r*0.4);
      for (const [yo, w, col] of [[0,r*0.9,'#1A4A18'],[-r*0.4,r*0.7,'#256020'],[-r*0.7,r*0.5,'#307828']]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(wx, wy-r*1.1+yo); ctx.lineTo(wx-w, wy-r*0.2+yo); ctx.lineTo(wx+w, wy-r*0.2+yo);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'tree_large': {
      ctx.fillStyle = '#4A2A08';
      ctx.fillRect(wx-3, wy-r*0.35, 6, r*0.45);
      ctx.fillStyle = '#163A14';
      ctx.beginPath(); ctx.arc(wx, wy-r*0.5, r*0.95, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2D7A28';
      ctx.beginPath(); ctx.arc(wx-r*0.2, wy-r*0.8, r*0.65, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#50B048';
      ctx.beginPath(); ctx.arc(wx-r*0.3, wy-r*1.0, r*0.38, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'stone_small': {
      ctx.fillStyle = '#7A7A7A';
      ctx.beginPath(); ctx.ellipse(wx, wy-r*0.4, r, r*0.7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#AAAAAA';
      ctx.beginPath(); ctx.ellipse(wx-r*0.25, wy-r*0.65, r*0.4, r*0.28, 0, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'stone_large': {
      ctx.fillStyle = '#6E6E6E';
      ctx.beginPath(); ctx.ellipse(wx-r*0.1, wy-r*0.45, r*1.0, r*0.75, -0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#B0B0B0';
      ctx.beginPath(); ctx.ellipse(wx-r*0.3, wy-r*0.75, r*0.45, r*0.3, -0.3, 0, Math.PI*2); ctx.fill();
      break;
    }
  }
}

// No-op shim — paths embedded in renderWorld
export function renderPaths(ctx, cam) { void ctx; void cam; }
