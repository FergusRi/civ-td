import { placedBuildings } from '../buildings/placement.js';
import { BUILDINGS } from '../buildings/registry.js';
import { enemies, getDamageMultiplier } from './enemies.js';
import { fireProjectile } from './projectiles.js';
import { TILE } from '../world/map.js';

// Per-building fire cooldown state
const _cooldowns = new Map(); // buildingId → time remaining

export function initCombat() {
  // Nothing to init — stateless except cooldown map
}

export function updateTowers(dt) {
  const seen = new Set();

  for (const b of placedBuildings.values()) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);

    const def = BUILDINGS[b.type];
    if (!def?.isTower) continue;

    // Decrement cooldown
    const cd = (_cooldowns.get(b.id) ?? 0) - dt;
    _cooldowns.set(b.id, cd);
    if (cd > 0) continue;

    // Find nearest enemy in range
    const cx  = b.tx * TILE + TILE / 2;
    const cy  = b.ty * TILE + TILE / 2;
    const rng = def.range;

    let target = null;
    let bestDist = Infinity;

    for (const e of enemies) {
      const dx = e.x - cx;
      const dy = e.y - cy;
      const d  = dx*dx + dy*dy;
      if (d <= rng * rng && d < bestDist) {
        bestDist = d;
        target = e;
      }
    }

    if (!target) continue;

    // Aim angle for sprite rotation
    b._aimAngle = Math.atan2(target.y - cy, target.x - cx);

    // Effectiveness multiplier
    const effectMult = getDamageMultiplier(b.type, target.faction);

    // Fire
    fireProjectile({
      x:           cx,
      y:           cy,
      targetEnemy: target,
      type:        def.projectile,
      damage:      def.damage,
      aoe:         def.aoe    ?? 0,
      slow:        def.slow   ?? 0,
      chain:       def.chain  ?? 0,
      effectMult,
    });

    // Reset cooldown (fireRate = shots/sec)
    _cooldowns.set(b.id, 1 / def.fireRate);
  }
}
