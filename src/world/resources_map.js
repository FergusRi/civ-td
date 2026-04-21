// ============================================================
// resources_map.js — Harvestable resource nodes on the map
// Trees (wood) and stone tiles (stone) that workers walk to,
// harvest, and carry back. Nodes have HP; depleted nodes vanish.
// ============================================================
import { mapSprites, getTile, setTile, T, TILE, COLS, ROWS } from './map.js';

// Node types
export const NODE = { WOOD: 'wood', STONE: 'stone' };

// Live node registry — populated from mapSprites + stone tiles on init
// Each: { id, tx, ty, kind: NODE.*, hp, maxHp, reserved: citizenId|null }
const _nodes = new Map(); // id → node

let _nextId = 1;

export function initResourceNodes() {
  _nodes.clear();
  _nextId = 1;

  // Wood nodes from tree sprites
  for (const s of mapSprites) {
    if (!s.kind.startsWith('tree')) continue;
    const id = `n${_nextId++}`;
    _nodes.set(id, {
      id, tx: s.tx, ty: s.ty,
      kind: NODE.WOOD,
      hp: 3, maxHp: 3,
      reserved: null,
      _sprite: s,
    });
  }

  // Stone nodes from STONE tiles (sample ~25% so not every tile is a node)
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (getTile(tx, ty) !== T.STONE) continue;
      // Hash-based sampling
      const h = ((tx * 2246822519) ^ (ty * 3266489917)) >>> 0;
      if (h % 4 !== 0) continue;
      const id = `n${_nextId++}`;
      _nodes.set(id, {
        id, tx, ty,
        kind: NODE.STONE,
        hp: 4, maxHp: 4,
        reserved: null,
      });
    }
  }

  console.log(`[resource_nodes] ${_nodes.size} harvestable nodes`);
}

// Find nearest unreserved node of given kind to (wx, wy) world pos
export function findNearestNode(wx, wy, kind) {
  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  let best = null, bestD2 = Infinity;
  for (const n of _nodes.values()) {
    if (n.kind !== kind) continue;
    if (n.reserved) continue;
    const dx = n.tx - tx, dy = n.ty - ty;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; best = n; }
  }
  return best;
}

export function reserveNode(nodeId, citizenId) {
  const n = _nodes.get(nodeId);
  if (n) n.reserved = citizenId;
}

export function releaseNode(nodeId) {
  const n = _nodes.get(nodeId);
  if (n) n.reserved = null;
}

// Strike a node — returns resource gained (1 unit) or null if gone
export function harvestNode(nodeId) {
  const n = _nodes.get(nodeId);
  if (!n) return null;
  n.hp--;
  if (n.hp <= 0) {
    // Remove from map
    if (n.kind === NODE.WOOD && n._sprite) {
      const idx = mapSprites.indexOf(n._sprite);
      if (idx !== -1) mapSprites.splice(idx, 1);
    }
    if (n.kind === NODE.STONE) {
      setTile(n.tx, n.ty, T.DIRT); // stump left
    }
    _nodes.delete(nodeId);
    return n.kind; // last harvest
  }
  return n.kind;
}

export function getNode(nodeId) { return _nodes.get(nodeId) ?? null; }
export function getAllNodes()    { return _nodes; }
