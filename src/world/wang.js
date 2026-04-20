// ============================================================
// wang.js — Wang/blob tileset lookup for terrain transitions
// RD-Tile tileset_advanced output: 4 cols × 5 rows = 20 tiles
//
// Bitmask: neighbours of the SAME type (cardinal only)
//   N=1, E=2, S=4, W=8  (0=none, 15=all four)
//
// RD-Tile "simple wang" layout (row, col):
//   The tileset encodes all 2^4=16 cardinal combinations
//   plus 4 diagonal-only corner tiles = 20 total.
//
// Layout determined from RD-Tile format diagram:
//   Row0: col0=isolated(0), col1=N(1), col2=S(4), col3=NS(5)
//   Row1: col0=E(2), col1=NE(3), col2=SE(6), col3=NSE(7)
//   Row2: col0=W(8), col1=NW(9), col2=SW(12), col3=NSW(13)
//   Row3: col0=EW(10), col1=NEW(11), col2=SEW(14), col3=NSEW(15)
//   Row4: col0=NE_inner, col1=SE_inner, col2=SW_inner, col3=NW_inner
// ============================================================

// Map bitmask (0-15) → [row, col] in the tileset
const WANG_MAP = {
   0: [0,0],  // isolated
   1: [0,1],  // N only
   4: [0,2],  // S only
   5: [0,3],  // N+S (vertical strip)
   2: [1,0],  // E only
   3: [1,1],  // N+E
   6: [1,2],  // S+E
   7: [1,3],  // N+S+E
   8: [2,0],  // W only
   9: [2,1],  // N+W
  12: [2,2],  // S+W
  13: [2,3],  // N+S+W
  10: [3,0],  // E+W (horizontal strip)
  11: [3,1],  // N+E+W
  14: [3,2],  // S+E+W
  15: [3,3],  // all (fully surrounded = base tile)
};

// Preloaded tileset images keyed by "typeA_typeB"
const _tilesets = {};
const _tilesetCanvases = {}; // offscreen canvas per tileset

export function loadWangTileset(key, src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      _tilesets[key] = img;
      // Pre-extract all 20 tiles into an offscreen canvas for fast drawImage
      const oc = document.createElement('canvas');
      oc.width = img.width; oc.height = img.height;
      oc.getContext('2d').drawImage(img, 0, 0);
      _tilesetCanvases[key] = oc;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

// Draw a Wang tile: key='grass_water', tileType=T.GRASS or T.WATER,
// neighbours = {n,e,s,w} booleans (true = same biome)
export function drawWangTile(ctx, key, sameN, sameE, sameS, sameW, dx, dy, tileSize) {
  const oc = _tilesetCanvases[key];
  if (!oc) return false;
  const mask = (sameN?1:0) | (sameE?2:0) | (sameS?4:0) | (sameW?8:0);
  const pos = WANG_MAP[mask] || [3,3];
  const [row, col] = pos;
  ctx.drawImage(oc,
    col * 32, row * 32, 32, 32,
    dx, dy, tileSize, tileSize
  );
  return true;
}

export function hasWangTileset(key) {
  return !!_tilesetCanvases[key];
}
