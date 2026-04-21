// ============================================================
// citizen.js — WorldBox-style autonomous citizens
//
// States:
//   IDLE      → wander in settlement zone
//   BUILDING  → path to build site, build cottage
//   WORKING   → path to resource node, harvest, return to building
//   FLEEING   → wave phase + flees trait
// ============================================================
import { TILE, COLS, ROWS, isWalkable } from '../world/map.js';
import { randomName } from './names.js';
import { randomTraits, POSITIVE_TRAITS, NEGATIVE_TRAITS } from './traits.js';
import { events, EV } from '../engine/events.js';
import { getZone, ZONE, getZoneTiles } from '../world/zones.js';
import { placedBuildings } from '../buildings/placement.js';
import { BUILDINGS } from '../buildings/registry.js';
import { hasResources, spendResources, addResources } from '../resources.js';
import { findNearestNode, reserveNode, releaseNode, harvestNode, getNode, NODE } from '../world/resources_map.js';

export const citizens = [];

const BASE_SPEED     = 60;   // px/s
const WANDER_DIST    = 6;    // tiles
const COTTAGE_COST   = {}; // free — limited by citizen count
const COTTAGE_BUILD_TIME = 8; // seconds per cottage
const HARVEST_TIME   = 1.5;  // seconds per strike at node
const MAX_CARRY      = 3;    // strikes before returning

// ── Home / occupancy tracking ─────────────────────────────────
const _homeMap = new Map(); // citizenId → cottageKey

function _getCottages() {
  const seen = new Set(), out = [];
  for (const b of placedBuildings.values())
    if (b.type === 'cottage' && !seen.has(b.id)) { seen.add(b.id); out.push(b); }
  return out;
}
function _cottageOccupancy(key) {
  let n = 0;
  for (const hk of _homeMap.values()) if (hk === key) n++;
  return n;
}
function _findAvailableCottage() {
  for (const b of _getCottages()) {
    const key = `${b.tx},${b.ty}`;
    if (_cottageOccupancy(key) < 2) return b;
  }
  return null;
}
function _homeWorld(b) {
  const jx = (Math.random() - 0.5) * TILE * 1.2;
  const jy = (Math.random() - 0.5) * TILE * 1.2;
  return { x: b.tx * TILE + TILE/2 + jx, y: b.ty * TILE + TILE/2 + jy };
}

// ── Worker building tracking ──────────────────────────────────
// key "tx,ty" → array of citizen ids assigned as workers
const _workerMap = new Map();

function _workersAt(key) {
  return (_workerMap.get(key) ?? []).length;
}
function _assignWorker(key, citizenId) {
  if (!_workerMap.has(key)) _workerMap.set(key, []);
  _workerMap.get(key).push(citizenId);
}
function _unassignWorker(key, citizenId) {
  const arr = _workerMap.get(key);
  if (!arr) return;
  const i = arr.indexOf(citizenId);
  if (i !== -1) arr.splice(i, 1);
}
function _findOpenWorkplace() {
  for (const b of placedBuildings.values()) {
    const def = BUILDINGS[b.type];
    if (!def?.workerKind) continue; // not a workplace
    const key = `${b.tx},${b.ty}`;
    if (_workersAt(key) < (def.maxWorkers ?? 1)) return b;
  }
  return null;
}

// ── Settlement zone helpers ───────────────────────────────────
function _settlementTiles() { return getZoneTiles(ZONE.SETTLEMENT); }

function _pickSettlementWander(cx, cy) {
  for (let i = 0; i < 20; i++) {
    const tx = cx + Math.floor((Math.random()*2-1)*WANDER_DIST);
    const ty = cy + Math.floor((Math.random()*2-1)*WANDER_DIST);
    if (tx<0||ty<0||tx>=COLS||ty>=ROWS) continue;
    if (!isWalkable(tx,ty)) continue;
    if (getZone(tx,ty) !== ZONE.SETTLEMENT) continue;
    return { x: tx*TILE+TILE/2, y: ty*TILE+TILE/2 };
  }
  return null;
}
function _pickAnyWander(cx, cy) {
  for (let i = 0; i < 12; i++) {
    const tx = cx + Math.floor((Math.random()*2-1)*WANDER_DIST);
    const ty = cy + Math.floor((Math.random()*2-1)*WANDER_DIST);
    if (tx>=0&&ty>=0&&tx<COLS&&ty<ROWS&&isWalkable(tx,ty))
      return { x: tx*TILE+TILE/2, y: ty*TILE+TILE/2 };
  }
  return null;
}

// ── Find a free tile inside settlement zone for a new cottage ─
function _findCottageSpot() {
  const tiles = _settlementTiles().filter(t => {
    if (!isWalkable(t.tx, t.ty)) return false;
    if (placedBuildings.has(`${t.tx},${t.ty}`)) return false;
    return true;
  });
  if (!tiles.length) return null;
  return tiles[Math.floor(Math.random() * tiles.length)];
}

// ── Citizen class ─────────────────────────────────────────────
class Citizen {
  constructor(x, y) {
    this.id    = `cit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.name  = randomName();
    this.x     = x;
    this.y     = y;
    this.hp    = 30; this.maxHp = 30;
    this.morale = 80;

    const t = randomTraits();
    this.positiveTrait = t.positive;
    this.negativeTrait = t.negative;

    this._state        = 'IDLE';
    this._target       = null;
    this._idleTimer    = Math.random() * 3;
    this._fleeing      = false;

    // Home
    this._homeKey      = null;
    this._homeCooldown = Math.random() * 5;
    this._homeTimer    = 8 + Math.random() * 8;

    // Building
    this._buildSite    = null; // { tx, ty }
    this._buildTimer   = 0;
    this._buildCooldown = 10 + Math.random() * 20; // don't try immediately

    // Working
    this._workplaceKey = null;
    this._nodeId       = null;
    this._harvestTimer = 0;
    this._carry        = 0; // resource strikes carried
    this._workCooldown = 5 + Math.random() * 10;

    const posDef = POSITIVE_TRAITS[this.positiveTrait];
    const negDef = NEGATIVE_TRAITS[this.negativeTrait];
    this.speed      = BASE_SPEED * (posDef.speedMult ?? 1) * (negDef.speedMult ?? 1);
    this.buildMult  = (posDef.buildSpeedMult ?? 1) * (negDef.buildSpeedMult ?? 1);
    this.damageMult = negDef.damageMult ?? 1;
    this.foodMult   = negDef.foodMult   ?? 1;
    this.flees      = negDef.flees      ?? false;
  }

  update(dt, phase) {
    this._idleTimer     = Math.max(0, this._idleTimer - dt);
    this._buildCooldown = Math.max(0, this._buildCooldown - dt);
    this._homeCooldown  = Math.max(0, this._homeCooldown - dt);
    this._workCooldown  = Math.max(0, this._workCooldown - dt);

    if (phase === 'wave') {
      if (this.flees && !this._fleeing) this._startFlee();
      if (this._target) this._moveToward(this._target, dt);
      return;
    }
    this._fleeing = false;

    // ── Validate home ──
    if (this._homeKey && !placedBuildings.has(this._homeKey)) {
      _homeMap.delete(this.id);
      this._homeKey = null;
    }
    if (!this._homeKey && this._homeCooldown <= 0) {
      const c = _findAvailableCottage();
      if (c) { this._homeKey = `${c.tx},${c.ty}`; _homeMap.set(this.id, this._homeKey); }
      this._homeCooldown = 5;
    }

    // ── Validate workplace ──
    if (this._workplaceKey && !placedBuildings.has(this._workplaceKey)) {
      _unassignWorker(this._workplaceKey, this.id);
      this._workplaceKey = null;
      this._state = 'IDLE';
    }

    // ── State machine ──
    switch (this._state) {
      case 'IDLE':    this._updateIdle(dt); break;
      case 'BUILDING': this._updateBuilding(dt); break;
      case 'WORKING': this._updateWorking(dt); break;
    }
  }

  // ── IDLE ──────────────────────────────────────────────────
  _updateIdle(dt) {
    // Try to become a worker
    if (this._workCooldown <= 0 && !this._workplaceKey) {
      const wb = _findOpenWorkplace();
      if (wb) {
        this._workplaceKey = `${wb.tx},${wb.ty}`;
        _assignWorker(this._workplaceKey, this.id);
        this._state = 'WORKING';
        this._target = null;
        return;
      }
      this._workCooldown = 8;
    }

    // Try to start building a cottage
    if (this._buildCooldown <= 0 && !this._buildSite) {
      this._tryStartBuild();
    }

    // Move toward target / wander
    if (this._target) {
      this._moveToward(this._target, dt);
      const dx = this._target.x - this.x, dy = this._target.y - this.y;
      if (dx*dx + dy*dy < 16) this._target = null;
    } else if (this._idleTimer <= 0) {
      this._pickIdleTarget();
    }
  }

  _pickIdleTarget() {
    // Occasionally go home
    this._homeTimer = Math.max(0, this._homeTimer - 1);
    if (this._homeKey && this._homeTimer <= 0 && placedBuildings.has(this._homeKey)) {
      const b = placedBuildings.get(this._homeKey);
      this._target    = _homeWorld(b);
      this._idleTimer = 5 + Math.random() * 8;
      this._homeTimer = 10 + Math.random() * 10;
      return;
    }
    const cx = Math.floor(this.x/TILE), cy = Math.floor(this.y/TILE);
    const tiles = _settlementTiles();
    let t = tiles.length > 0 ? _pickSettlementWander(cx, cy) : null;
    if (!t) {
      // nudge back into settlement
      if (tiles.length > 0) {
        const pick = tiles[Math.floor(Math.random()*tiles.length)];
        t = { x: pick.tx*TILE+TILE/2, y: pick.ty*TILE+TILE/2 };
      } else {
        t = _pickAnyWander(cx, cy);
      }
    }
    if (t) this._target = t;
    this._idleTimer = 2 + Math.random() * 4;
  }

  _tryStartBuild() {
    // Cap: 1 cottage per citizen (each cottage holds 1 citizen until upgraded)
    const current    = _getCottages().length;
    const maxCottages = citizens.length; // 1:1 citizen → cottage
    if (current >= maxCottages) { this._buildCooldown = 20; return; }

    // Also cap by available settlement space
    const homeTiles = _settlementTiles().length;
    if (current >= Math.floor(homeTiles / 6)) { this._buildCooldown = 20; return; }

    const spot = _findCottageSpot();
    if (!spot) { this._buildCooldown = 10; return; }

    // Reserve the spot immediately
    this._buildSite = spot;
    this._state     = 'BUILDING';
    this._target    = { x: spot.tx*TILE+TILE/2, y: spot.ty*TILE+TILE/2 };
    this._buildTimer = COTTAGE_BUILD_TIME / this.buildMult;
  }

  // ── BUILDING ──────────────────────────────────────────────
  _updateBuilding(dt) {
    if (!this._buildSite) { this._state = 'IDLE'; return; }

    if (this._target) {
      this._moveToward(this._target, dt);
      const dx = this._target.x - this.x, dy = this._target.y - this.y;
      if (dx*dx + dy*dy < (TILE*0.8)**2) this._target = null; // arrived
      return;
    }

    // At the site — count down build timer
    this._buildTimer -= dt;
    if (this._buildTimer <= 0) {
      this._completeBuild();
    }
  }

  _completeBuild() {
    const { tx, ty } = this._buildSite;
    const key = `${tx},${ty}`;
    if (!placedBuildings.has(key)) {
      // Place the cottage
      const def = BUILDINGS['cottage'];
      const b = {
        id: `cottage_${tx}_${ty}_${Date.now()}`,
        type: 'cottage', tx, ty, size: 1,
        hp: def.hp, maxHp: def.hp,
        state: 'complete', _aimAngle: 0,
      };
      placedBuildings.set(key, b);
      events.emit(EV.BUILDING_PLACED, b);
    }
    this._buildSite    = null;
    this._buildCooldown = 30 + Math.random() * 30;
    this._state        = 'IDLE';
  }

  // ── WORKING ───────────────────────────────────────────────
  _updateWorking(dt) {
    if (!this._workplaceKey) { this._state = 'IDLE'; return; }

    const wpb = placedBuildings.get(this._workplaceKey);
    if (!wpb) { this._state = 'IDLE'; this._workplaceKey = null; return; }

    const def      = BUILDINGS[wpb.type];
    const nodeKind = def?.workerKind; // NODE.WOOD or NODE.STONE

    // Carrying full — return to workplace and deposit
    if (this._carry >= MAX_CARRY) {
      const wpx = wpb.tx*TILE+TILE/2, wpy = wpb.ty*TILE+TILE/2;
      if (this._target === null) this._target = { x: wpx, y: wpy };
      this._moveToward(this._target, dt);
      const dx = this._target.x - this.x, dy = this._target.y - this.y;
      if (dx*dx + dy*dy < (TILE*0.6)**2) {
        // Deposit
        addResources({ [nodeKind]: this._carry });
        this._carry  = 0;
        this._target = null;
        if (this._nodeId) { releaseNode(this._nodeId); this._nodeId = null; }
      }
      return;
    }

    // Need a node
    if (!this._nodeId) {
      const n = findNearestNode(this.x, this.y, nodeKind);
      if (!n) { this._workCooldown = 5; this._target = null; return; }
      this._nodeId = n.id;
      reserveNode(n.id, this.id);
      this._target = { x: n.tx*TILE+TILE/2, y: n.ty*TILE+TILE/2 };
      this._harvestTimer = HARVEST_TIME;
    }

    // Walk to node
    const n = getNode(this._nodeId);
    if (!n) { this._nodeId = null; return; } // node depleted by someone else

    if (this._target) {
      this._moveToward(this._target, dt);
      const dx = this._target.x - this.x, dy = this._target.y - this.y;
      if (dx*dx + dy*dy < (TILE*0.6)**2) this._target = null; // at node
      return;
    }

    // At node — harvest tick
    this._harvestTimer -= dt;
    if (this._harvestTimer <= 0) {
      const res = harvestNode(this._nodeId);
      if (res) {
        this._carry++;
        if (!getNode(this._nodeId)) this._nodeId = null; // depleted
      } else {
        this._nodeId = null;
      }
      this._harvestTimer = HARVEST_TIME;
    }
  }

  // ── Shared helpers ────────────────────────────────────────
  _moveToward(target, dt) {
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 1) return;
    const spd = this.speed * dt;
    this.x += (dx/dist) * Math.min(spd, dist);
    this.y += (dy/dist) * Math.min(spd, dist);
  }

  _startFlee() {
    this._fleeing = true;
    this._target  = { x: (COLS/2)*TILE, y: (ROWS/2)*TILE };
  }

  takeDamage(amount) {
    this.hp -= amount * this.damageMult;
    if (this.hp <= 0) this._die();
  }

  _die() {
    const idx = citizens.indexOf(this);
    if (idx !== -1) citizens.splice(idx, 1);
    _homeMap.delete(this.id);
    if (this._workplaceKey) _unassignWorker(this._workplaceKey, this.id);
    if (this._nodeId) releaseNode(this._nodeId);
    events.emit(EV.CITIZEN_DIED, { name: this.name });
  }
}

// ── Module-level ──────────────────────────────────────────────
let _phase = 'planning';
events.on(EV.PHASE_CHANGED, d => { _phase = d.phase; });
events.on(EV.BUILDING_DESTROYED, b => {
  const key = `${b.tx},${b.ty}`;
  for (const c of citizens) {
    if (c._homeKey === key) { c._homeKey = null; _homeMap.delete(c.id); }
    if (c._workplaceKey === key) {
      _unassignWorker(key, c.id);
      c._workplaceKey = null;
      c._state = 'IDLE';
    }
  }
  _workerMap.delete(key);
});

export function initCitizens() {
  citizens.length = 0;
  const cx = Math.floor(COLS/2) * TILE;
  const cy = Math.floor(ROWS/2) * TILE;
  for (let i = 0; i < 10; i++) {
    const angle = (i/10) * Math.PI * 2;
    const r     = TILE * 3;
    citizens.push(new Citizen(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r));
  }
}

export function spawnCitizen(x, y) { citizens.push(new Citizen(x, y)); }

export function updateCitizens(dt) {
  for (const c of citizens) c.update(dt, _phase);
}

export function renderCitizens(ctx) {
  const sorted = [...citizens].sort((a,b) => a.y - b.y);
  for (const c of sorted) _drawCitizen(ctx, c);
}

function _drawCitizen(ctx, c) {
  const x = Math.round(c.x), y = Math.round(c.y);
  const walkBob  = Math.sin(Date.now()*0.008 + c.x*0.1) * 1.5;
  const legSwing = Math.sin(Date.now()*0.008 + c.x*0.1);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(x, y+7, 5, 2, 0, 0, Math.PI*2); ctx.fill();

  // Legs + boots
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(x-3, y+2+Math.round(legSwing*2),  2, 5);
  ctx.fillRect(x+1, y+2+Math.round(-legSwing*2), 2, 5);
  ctx.fillStyle = '#3A2000';
  ctx.fillRect(x-4, y+5+Math.round(legSwing*2),  3, 2);
  ctx.fillRect(x+1, y+5+Math.round(-legSwing*2), 3, 2);

  // Body
  ctx.fillStyle = c.morale < 40 ? '#8899CC' : '#E8C87A';
  ctx.fillRect(x-3, y-4, 7, 7);
  ctx.fillStyle = '#6B3A0A'; ctx.fillRect(x-3, y+2, 7, 1);
  ctx.fillStyle = c.morale < 40 ? '#6677AA' : '#D4A050';
  ctx.fillRect(x-1, y-4, 3, 2);

  // Neck + head
  ctx.fillStyle = '#FDBCB4'; ctx.fillRect(x-1, y-6, 3, 2);
  ctx.beginPath(); ctx.arc(x+0.5, y-9+walkBob*0.3, 4.5, 0, Math.PI*2); ctx.fill();

  // Hair
  const hair = ['#3A2000','#8B5A00','#D4A050','#1A1A1A','#CC4444'];
  ctx.fillStyle = hair[Math.abs(c.id.charCodeAt(4)??0) % hair.length];
  ctx.beginPath(); ctx.arc(x+0.5, y-10.5+walkBob*0.3, 4, Math.PI, 0); ctx.fill();
  ctx.fillRect(x-4, y-12+walkBob*0.3, 2, 4);
  ctx.fillRect(x+3, y-12+walkBob*0.3, 2, 4);

  // Eyes + expression
  ctx.fillStyle = '#222';
  ctx.fillRect(x-2, y-10, 1, 1); ctx.fillRect(x+2, y-10, 1, 1);
  if (c.morale >= 60) { ctx.fillStyle='#FF9080'; ctx.fillRect(x-1, y-8, 3, 1); }
  else if (c.morale < 30) { ctx.fillStyle='#8899AA'; ctx.fillRect(x-1, y-7, 3, 1); }

  // State indicators
  if (c._homeKey) {
    ctx.fillStyle = 'rgba(255,100,100,0.75)';
    ctx.font = '6px sans-serif'; ctx.fillText('♥', x-2, y-16+walkBob*0.3);
  }
  if (c._state === 'BUILDING') {
    ctx.fillStyle = 'rgba(255,200,50,0.9)';
    ctx.font = '7px sans-serif'; ctx.fillText('🔨', x-3, y-16+walkBob*0.3);
  }
  if (c._carry > 0) {
    ctx.fillStyle = 'rgba(180,255,100,0.9)';
    ctx.font = '6px sans-serif'; ctx.fillText(`+${c._carry}`, x-3, y-16+walkBob*0.3);
  }

  // Tool
  const toolIdx = Math.abs((c.id.charCodeAt(5)??0)) % 3;
  if (toolIdx === 0) {
    ctx.strokeStyle='#888'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x+4,y-3); ctx.lineTo(x+4,y+3); ctx.stroke();
    ctx.fillStyle='#AAA'; ctx.fillRect(x+3,y-4,4,3);
  } else if (toolIdx === 1) {
    ctx.strokeStyle='#8B6914'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x+4,y-4); ctx.lineTo(x+6,y+3); ctx.stroke();
    ctx.fillStyle='#888'; ctx.fillRect(x+3,y-5,5,2);
  } else {
    ctx.fillStyle='#C8963C'; ctx.fillRect(x+4,y-1,4,4);
    ctx.fillStyle='#A07020'; ctx.fillRect(x+5,y-2,2,1);
  }

  // HP bar
  if (c.hp < c.maxHp) {
    ctx.fillStyle='#1A1A1A'; ctx.fillRect(x-6,y-17,12,3);
    ctx.fillStyle='#2ECC71'; ctx.fillRect(x-6,y-17,12*(c.hp/c.maxHp),3);
  }
}
