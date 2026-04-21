import { TILE, COLS, ROWS, isWalkable } from '../world/map.js';
import { randomName } from './names.js';
import { randomTraits, POSITIVE_TRAITS, NEGATIVE_TRAITS } from './traits.js';
import { events, EV } from '../engine/events.js';
import { getZone, ZONE, getZoneTiles } from '../world/zones.js';
import { placedBuildings } from '../buildings/placement.js';

export const citizens = [];

const BASE_SPEED   = 60; // px/s
const WANDER_DIST  = 6;  // tiles within settlement zone

// ── Home assignment helpers ───────────────────────────────────
// Each cottage can house up to citizenCap citizens (default 2)
// We track which citizen lives in which cottage key "tx,ty"
const _homeMap = new Map(); // citizenId → cottageKey

function _getCottages() {
  const seen = new Set();
  const out  = [];
  for (const b of placedBuildings.values()) {
    if (b.type === 'cottage' && !seen.has(b.id)) {
      seen.add(b.id);
      out.push(b);
    }
  }
  return out;
}

function _cottageOccupancy(key) {
  let count = 0;
  for (const hk of _homeMap.values()) if (hk === key) count++;
  return count;
}

function _findAvailableCottage() {
  for (const b of _getCottages()) {
    const key = `${b.tx},${b.ty}`;
    const cap = 2; // citizenCap
    if (_cottageOccupancy(key) < cap) return b;
  }
  return null;
}

function _homeWorld(b) {
  // Random offset around cottage centre for natural clustering
  const jx = (Math.random() - 0.5) * TILE * 1.5;
  const jy = (Math.random() - 0.5) * TILE * 1.5;
  return {
    x: b.tx * TILE + TILE / 2 + jx,
    y: b.ty * TILE + TILE / 2 + jy,
  };
}

// ── Settlement zone wander helpers ────────────────────────────
function _settlementTiles() {
  return getZoneTiles(ZONE.SETTLEMENT);
}

function _pickSettlementWander(cx, cy) {
  // Try tiles near current pos that are in settlement zone
  for (let attempt = 0; attempt < 20; attempt++) {
    const tx = cx + Math.floor((Math.random() * 2 - 1) * WANDER_DIST);
    const ty = cy + Math.floor((Math.random() * 2 - 1) * WANDER_DIST);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) continue;
    if (!isWalkable(tx, ty)) continue;
    if (getZone(tx, ty) !== ZONE.SETTLEMENT) continue;
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }
  return null;
}

function _pickAnyWander(cx, cy) {
  // Fallback: wander anywhere walkable
  for (let attempt = 0; attempt < 12; attempt++) {
    const tx = cx + Math.floor((Math.random() * 2 - 1) * WANDER_DIST);
    const ty = cy + Math.floor((Math.random() * 2 - 1) * WANDER_DIST);
    if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && isWalkable(tx, ty)) {
      return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
    }
  }
  return null;
}

// ── Citizen class ─────────────────────────────────────────────
class Citizen {
  constructor(x, y) {
    this.id     = `cit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.name   = randomName();
    this.x      = x;
    this.y      = y;
    this.hp     = 30;
    this.maxHp  = 30;
    this.morale = 80;

    const t = randomTraits();
    this.positiveTrait = t.positive;
    this.negativeTrait = t.negative;

    this._target       = null; // { x, y } world pos
    this._idleTimer    = Math.random() * 3; // stagger startup
    this._fleeing      = false;
    this._homeKey      = null; // cottage key this citizen lives in
    this._homeTimer    = 0;   // how long until we try going home again
    this._homeCooldown = 0;   // prevent re-path spam

    const posDef = POSITIVE_TRAITS[this.positiveTrait];
    const negDef = NEGATIVE_TRAITS[this.negativeTrait];

    this.speed      = BASE_SPEED * (posDef.speedMult ?? 1.0) * (negDef.speedMult ?? 1.0);
    this.buildMult  = (posDef.buildSpeedMult ?? 1.0) * (negDef.buildSpeedMult ?? 1.0);
    this.damageMult = negDef.damageMult ?? 1.0;
    this.foodMult   = negDef.foodMult   ?? 1.0;
    this.flees      = negDef.flees      ?? false;
    this.fleeEarly  = negDef.fleeEarly  ?? false;
    this.moraleAura = (posDef.moraleAura ?? 0) + (negDef.moraleAura ?? 0);
  }

  update(dt, phase) {
    this._idleTimer    = Math.max(0, this._idleTimer - dt);
    this._homeCooldown = Math.max(0, this._homeCooldown - dt);

    if (phase === 'wave') {
      if (this.flees && !this._fleeing) this._startFlee();
    } else {
      this._fleeing = false;

      // Validate home cottage still exists
      if (this._homeKey && !placedBuildings.has(this._homeKey)) {
        _homeMap.delete(this.id);
        this._homeKey = null;
      }

      // Try to claim a home if homeless
      if (!this._homeKey && this._homeCooldown <= 0) {
        const cottage = _findAvailableCottage();
        if (cottage) {
          this._homeKey = `${cottage.tx},${cottage.ty}`;
          _homeMap.set(this.id, this._homeKey);
          this._homeTimer = 8 + Math.random() * 8; // go home every ~8-16s
        }
        this._homeCooldown = 5; // don't re-check for 5s
      }
    }

    if (this._target) {
      this._moveToward(this._target, dt);
      const dx = this._target.x - this.x;
      const dy = this._target.y - this.y;
      if (dx*dx + dy*dy < 16) this._target = null;
    } else if (this._idleTimer <= 0) {
      this._pickNext(phase);
    }
  }

  _pickNext(phase) {
    if (phase === 'wave') {
      this._pickAnyWander();
      return;
    }

    // Periodically path home (WorldBox village feel)
    this._homeTimer = Math.max(0, this._homeTimer - 1);
    if (this._homeKey && this._homeTimer <= 0 && placedBuildings.has(this._homeKey)) {
      const b = placedBuildings.get(this._homeKey);
      this._target    = _homeWorld(b);
      this._idleTimer = 6 + Math.random() * 8; // linger near home
      this._homeTimer = 10 + Math.random() * 10;
      return;
    }

    // Otherwise wander within settlement zone (or anywhere if no zone painted)
    const cx = Math.floor(this.x / TILE);
    const cy = Math.floor(this.y / TILE);

    // Check if settlement zone exists at all
    const inSettlement = getZone(cx, cy) === ZONE.SETTLEMENT;
    const settlementExists = _settlementTiles().length > 0;

    let target = null;
    if (settlementExists) {
      target = _pickSettlementWander(cx, cy);
      // If citizen is outside settlement zone, nudge them back in
      if (!target) {
        const tiles = _settlementTiles();
        if (tiles.length > 0) {
          const t = tiles[Math.floor(Math.random() * tiles.length)];
          target = { x: t.tx * TILE + TILE / 2, y: t.ty * TILE + TILE / 2 };
        }
      }
    }

    if (!target) target = _pickAnyWander(cx, cy);
    if (target)  this._target = target;

    this._idleTimer = 2 + Math.random() * 4;
  }

  _pickAnyWander() {
    const cx = Math.floor(this.x / TILE);
    const cy = Math.floor(this.y / TILE);
    const t  = _pickAnyWander(cx, cy);
    if (t) this._target = t;
    this._idleTimer = 2 + Math.random() * 3;
  }

  _moveToward(target, dt) {
    const dx   = target.x - this.x;
    const dy   = target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 1) return;
    const spd = this.speed * dt;
    this.x += (dx / dist) * Math.min(spd, dist);
    this.y += (dy / dist) * Math.min(spd, dist);
  }

  _startFlee() {
    this._fleeing = true;
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
    _homeMap.delete(this.id);
    events.emit(EV.CITIZEN_DIED, { name: this.name });
  }
}

// ── Module-level ──────────────────────────────────────────────
let _phase = 'planning';
events.on(EV.PHASE_CHANGED, d => { _phase = d.phase; });

// When a building is destroyed, evict residents
events.on(EV.BUILDING_DESTROYED, b => {
  const key = `${b.tx},${b.ty}`;
  for (const c of citizens) {
    if (c._homeKey === key) {
      c._homeKey = null;
      _homeMap.delete(c.id);
    }
  }
});

export function initCitizens() {
  // Spawn 10 starter citizens near map centre
  const cx = Math.floor(COLS / 2) * TILE;
  const cy = Math.floor(ROWS / 2) * TILE;
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const r     = TILE * 3;
    citizens.push(new Citizen(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
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
  const sorted = [...citizens].sort((a, b) => a.y - b.y);
  for (const c of sorted) _drawCitizen(ctx, c);
}

// WorldBox-style tiny humanoid
function _drawCitizen(ctx, c) {
  const x = Math.round(c.x);
  const y = Math.round(c.y);

  const walkBob  = Math.sin(Date.now() * 0.008 + c.x * 0.1) * 1.5;
  const legSwing = Math.sin(Date.now() * 0.008 + c.x * 0.1);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(x - 3, y + 2 + Math.round(legSwing * 2),  2, 5);
  ctx.fillRect(x + 1, y + 2 + Math.round(-legSwing * 2), 2, 5);

  // Boots
  ctx.fillStyle = '#3A2000';
  ctx.fillRect(x - 4, y + 5 + Math.round(legSwing * 2),  3, 2);
  ctx.fillRect(x + 1, y + 5 + Math.round(-legSwing * 2), 3, 2);

  // Body
  const bodyColour = c.morale < 40 ? '#8899CC' : '#E8C87A';
  ctx.fillStyle = bodyColour;
  ctx.fillRect(x - 3, y - 4, 7, 7);

  // Belt
  ctx.fillStyle = '#6B3A0A';
  ctx.fillRect(x - 3, y + 2, 7, 1);

  // Shirt detail
  ctx.fillStyle = c.morale < 40 ? '#6677AA' : '#D4A050';
  ctx.fillRect(x - 1, y - 4, 3, 2);

  // Neck
  ctx.fillStyle = '#FDBCB4';
  ctx.fillRect(x - 1, y - 6, 3, 2);

  // Head
  ctx.fillStyle = '#FDBCB4';
  ctx.beginPath();
  ctx.arc(x + 0.5, y - 9 + walkBob * 0.3, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  const hairColours = ['#3A2000', '#8B5A00', '#D4A050', '#1A1A1A', '#CC4444'];
  const hairIdx = Math.abs(c.id.charCodeAt(4) ?? 0) % hairColours.length;
  ctx.fillStyle = hairColours[hairIdx];
  ctx.beginPath();
  ctx.arc(x + 0.5, y - 10.5 + walkBob * 0.3, 4, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 4, y - 12 + walkBob * 0.3, 2, 4);
  ctx.fillRect(x + 3, y - 12 + walkBob * 0.3, 2, 4);

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 2, y - 10, 1, 1);
  ctx.fillRect(x + 2, y - 10, 1, 1);

  // Expression
  if (c.morale >= 60) {
    ctx.fillStyle = '#FF9080';
    ctx.fillRect(x - 1, y - 8, 3, 1);
  } else if (c.morale < 30) {
    ctx.fillStyle = '#8899AA';
    ctx.fillRect(x - 1, y - 7, 3, 1);
  }

  // Home indicator — tiny heart above head if has a home
  if (c._homeKey) {
    ctx.fillStyle = 'rgba(255,100,100,0.7)';
    ctx.font = '6px sans-serif';
    ctx.fillText('♥', x - 2, y - 16 + walkBob * 0.3);
  }

  // Tool
  const toolIdx = Math.abs((c.id.charCodeAt(5) ?? 0)) % 3;
  if (toolIdx === 0) {
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 4, y - 3); ctx.lineTo(x + 4, y + 3); ctx.stroke();
    ctx.fillStyle = '#AAA';
    ctx.fillRect(x + 3, y - 4, 4, 3);
  } else if (toolIdx === 1) {
    ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x + 6, y + 3); ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 3, y - 5, 5, 2);
  } else {
    ctx.fillStyle = '#C8963C';
    ctx.fillRect(x + 4, y - 1, 4, 4);
    ctx.fillStyle = '#A07020';
    ctx.fillRect(x + 5, y - 2, 2, 1);
  }

  // HP bar (only when hurt)
  if (c.hp < c.maxHp) {
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(x - 6, y - 17, 12, 3);
    ctx.fillStyle = '#2ECC71';
    ctx.fillRect(x - 6, y - 17, 12 * (c.hp / c.maxHp), 3);
  }
}
