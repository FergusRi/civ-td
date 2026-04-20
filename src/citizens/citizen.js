import { TILE, COLS, ROWS, isWalkable } from '../world/map.js';
import { randomName } from './names.js';
import { randomTraits, POSITIVE_TRAITS, NEGATIVE_TRAITS } from './traits.js';
import { events, EV } from '../engine/events.js';

export const citizens = [];

const BASE_SPEED  = 60; // px/s
const WANDER_DIST = 5;  // tiles

// ── Citizen class ─────────────────────────────────────────────────────────────
class Citizen {
  constructor(x, y) {
    this.id     = `cit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.name   = randomName();
    this.x      = x;
    this.y      = y;
    this.hp     = 30;
    this.maxHp  = 30;
    this.morale = 80; // 0–100

    const t = randomTraits();
    this.positiveTrait = t.positive;
    this.negativeTrait = t.negative;

    this._target    = null; // { x, y } world pos
    this._idleTimer = 0;
    this._fleeing   = false;

    const posDef = POSITIVE_TRAITS[this.positiveTrait];
    const negDef = NEGATIVE_TRAITS[this.negativeTrait];

    this.speed       = BASE_SPEED
      * (posDef.speedMult ?? 1.0)
      * (negDef.speedMult ?? 1.0);   // (negative traits don't touch speed unless defined)
    this.buildMult   = (posDef.buildSpeedMult ?? 1.0) * (negDef.buildSpeedMult ?? 1.0);
    this.damageMult  = negDef.damageMult ?? 1.0;
    this.foodMult    = negDef.foodMult   ?? 1.0;
    this.flees       = negDef.flees      ?? false;
    this.fleeEarly   = negDef.fleeEarly  ?? false;
    this.moraleAura  = (posDef.moraleAura ?? 0) + (negDef.moraleAura ?? 0);
  }

  update(dt, phase) {
    this._idleTimer = Math.max(0, this._idleTimer - dt);

    if (phase === 'wave') {
      if (this.flees && !this._fleeing) this._startFlee();
    } else {
      this._fleeing = false;
    }

    if (this._target) {
      this._moveToward(this._target, dt);
      const dx = this._target.x - this.x;
      const dy = this._target.y - this.y;
      if (dx*dx + dy*dy < 16) this._target = null;
    } else if (this._idleTimer <= 0) {
      this._pickWander();
    }
  }

  _moveToward(target, dt) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 1) return;
    const spd = this.speed * dt;
    this.x += (dx / dist) * Math.min(spd, dist);
    this.y += (dy / dist) * Math.min(spd, dist);
  }

  _pickWander() {
    const cx = Math.floor(this.x / TILE);
    const cy = Math.floor(this.y / TILE);
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = cx + Math.floor((Math.random() * 2 - 1) * WANDER_DIST);
      const ty = cy + Math.floor((Math.random() * 2 - 1) * WANDER_DIST);
      if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && isWalkable(tx, ty)) {
        this._target   = { x: tx * TILE + TILE/2, y: ty * TILE + TILE/2 };
        this._idleTimer = 2 + Math.random() * 3;
        return;
      }
    }
    this._idleTimer = 1;
  }

  _startFlee() {
    this._fleeing = true;
    // Run to centre of map
    const cx = (COLS / 2) * TILE;
    const cy = (ROWS / 2) * TILE;
    this._target = { x: cx, y: cy };
  }

  takeDamage(amount) {
    this.hp -= amount * this.damageMult;
    if (this.hp <= 0) this._die();
  }

  _die() {
    const idx = citizens.indexOf(this);
    if (idx !== -1) citizens.splice(idx, 1);
    events.emit(EV.CITIZEN_DIED, { name: this.name });
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────
let _phase = 'planning';
events.on(EV.PHASE_CHANGED, d => { _phase = d.phase; });

export function initCitizens() {
  // Spawn 3 starter citizens near the settlement
  const cx = (Math.floor(COLS / 2)) * TILE;
  const cy = (Math.floor(ROWS / 2)) * TILE;
  for (let i = 0; i < 3; i++) {
    citizens.push(new Citizen(
      cx + (i - 1) * TILE * 2,
      cy + TILE
    ));
  }
}

export function spawnCitizen(x, y) {
  citizens.push(new Citizen(x, y));
}

export function updateCitizens(dt) {
  for (const c of citizens) c.update(dt, _phase);
}

export function renderCitizens(ctx) {
  for (const c of citizens) {
    _drawCitizen(ctx, c);
  }
}

// WorldBox-style tiny humanoid sprite (~16×16px)
function _drawCitizen(ctx, c) {
  const x = Math.round(c.x);
  const y = Math.round(c.y);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(x - 3, y + 1, 2, 5);
  ctx.fillRect(x + 1, y + 1, 2, 5);

  // Body
  ctx.fillStyle = '#E8D5A0';
  ctx.fillRect(x - 3, y - 5, 6, 7);

  // Head
  ctx.fillStyle = '#FDBCB4';
  ctx.beginPath();
  ctx.arc(x, y - 8, 4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 2, y - 9, 1, 1);
  ctx.fillRect(x + 1, y - 9, 1, 1);

  // Morale colour tint on body (low morale = blue-ish)
  if (c.morale < 40) {
    ctx.fillStyle = 'rgba(100,100,200,0.3)';
    ctx.fillRect(x - 3, y - 5, 6, 7);
  }

  // HP bar
  if (c.hp < c.maxHp) {
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 5, y - 14, 10, 2);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x - 5, y - 14, 10 * (c.hp / c.maxHp), 2);
  }
}
