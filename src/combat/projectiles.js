import { enemies } from './enemies.js';

export const projectiles = [];

// Projectile colours by type
const PROJ_STYLE = {
  arrow:       { colour: '#8B6914', radius: 2, speed: 300 },
  bolt:        { colour: '#AAA',    radius: 3, speed: 350 },
  cannonball:  { colour: '#333',    radius: 5, speed: 250 },
  magic_bolt:  { colour: '#9B59B6', radius: 4, speed: 280 },
  ice_shard:   { colour: '#AEF',    radius: 3, speed: 260 },
  lightning:   { colour: '#F1C40F', radius: 2, speed: 500 },
  boulder:     { colour: '#777',    radius: 7, speed: 180 },
};

class Projectile {
  constructor({ x, y, targetEnemy, type, damage, aoe, slow, chain, effectMult }) {
    this.x          = x;
    this.y          = y;
    this.target     = targetEnemy;
    this.type       = type;
    this.damage     = damage * (effectMult ?? 1.0);
    this.aoe        = aoe   ?? 0;
    this.slow       = slow  ?? 0;
    this.chain      = chain ?? 0;
    this.dead       = false;
    const s         = PROJ_STYLE[type] ?? PROJ_STYLE.arrow;
    this.speed      = s.speed;
    this._style     = s;
  }

  update(dt) {
    if (this.dead || !this.target || this.target.dead) {
      this.dead = true;
      return;
    }
    const dx   = this.target.x - this.x;
    const dy   = this.target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const step = this.speed * dt;

    if (dist <= step) {
      this._hit();
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  _hit() {
    this.dead = true;

    if (this.aoe > 0) {
      // Splash damage
      for (const e of enemies) {
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        if (dx*dx + dy*dy <= this.aoe * this.aoe) {
          e.takeDamage(this.damage);
          if (this.slow) e.applySlow(this.slow, 3);
        }
      }
    } else {
      this.target.takeDamage(this.damage);
      if (this.slow) this.target.applySlow(this.slow, 3);

      // Chain lightning
      if (this.chain > 0) {
        const hit = new Set([this.target]);
        let last = this.target;
        for (let c = 0; c < this.chain; c++) {
          let nearest = null, nd = Infinity;
          for (const e of enemies) {
            if (hit.has(e)) continue;
            const ddx = e.x - last.x, ddy = e.y - last.y;
            const dd = ddx*ddx + ddy*ddy;
            if (dd < nd) { nd = dd; nearest = e; }
          }
          if (!nearest) break;
          nearest.takeDamage(this.damage * 0.7);
          hit.add(nearest);
          last = nearest;
        }
      }
    }
  }
}

export function fireProjectile(opts) {
  projectiles.push(new Projectile(opts));
}

export function updateProjectiles(dt) {
  for (const p of [...projectiles]) {
    p.update(dt);
  }
  // Clean up dead
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (projectiles[i].dead) projectiles.splice(i, 1);
  }
}

export function renderProjectiles(ctx) {
  for (const p of projectiles) {
    const s = p._style;
    ctx.fillStyle = s.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius, 0, Math.PI * 2);
    ctx.fill();

    // Lightning gets a glow
    if (p.type === 'lightning') {
      ctx.strokeStyle = 'rgba(255,240,100,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
