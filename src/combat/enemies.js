import { TILE, COLS, ROWS } from '../world/map.js';
import { placedBuildings, damageBuilding, getBuilding } from '../buildings/placement.js';
import { events, EV } from '../engine/events.js';
import { EFFECTIVENESS } from '../buildings/registry.js';

// ── Unit sprite images ────────────────────────────────────────────────────────
const _unitImgs = {};
const _UNIT_IMG_SRCS = {
  goblin:  '/units/goblin.png',
  orc:     '/units/orc.png',
  undead:  '/units/undead.png',
  darkelf: '/units/darkelf.png',
  giant:   '/units/giant.png',
  shadow:  '/units/shadow.png',
};
export function preloadUnitImages() {
  return Promise.all(Object.entries(_UNIT_IMG_SRCS).map(([key, src]) =>
    new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { _unitImgs[key] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    })
  ));
}

export const enemies = [];

// ── Faction definitions ───────────────────────────────────────────────────────
export const FACTIONS = {
  goblin: {
    label:       '🐗 Goblin Horde',
    spawnEdge:   'north',
    colour:      '#6ABF4B',
    border:      '#3A7A1A',
    headColour:  '#C8F080',
    skinColour:  '#8AE050',
    clothColour: '#8B4513',
    speed:       90,
    hp:          30,
    damage:      5,
    reward:      2,
    size:        8,
  },
  orc: {
    label:       '🪓 Orc Warband',
    spawnEdge:   'west',
    colour:      '#4A6B2A',
    border:      '#2A4A10',
    headColour:  '#6A9A3A',
    skinColour:  '#5A8A2A',
    clothColour: '#8B6914',
    speed:       45,
    hp:          120,
    damage:      18,
    reward:      6,
    size:        11,
  },
  undead: {
    label:       '💀 Undead Legion',
    spawnEdge:   'south',
    colour:      '#C0C0D0',
    border:      '#505060',
    headColour:  '#E8E8F8',
    skinColour:  '#B0B0C8',
    clothColour: '#3A3A4A',
    speed:       40,
    hp:          80,
    damage:      12,
    reward:      5,
    size:        9,
  },
  darkelf: {
    label:       '🏹 Dark Elf Raiders',
    spawnEdge:   'east',
    colour:      '#4A2060',
    border:      '#200040',
    headColour:  '#9A70C0',
    skinColour:  '#7A50A0',
    clothColour: '#1A0030',
    speed:       70,
    hp:          50,
    damage:      10,
    reward:      4,
    ranged:      true,
    attackRange: 120,
    size:        8,
  },
  giant: {
    label:       '🗿 Stone Giant',
    spawnEdge:   'northwest',
    colour:      '#808070',
    border:      '#404040',
    headColour:  '#A0A090',
    skinColour:  '#909080',
    clothColour: '#505040',
    speed:       25,
    hp:          400,
    damage:      40,
    reward:      15,
    size:        16,
  },
  shadow: {
    label:       '🌑 Shadow Cult',
    spawnEdge:   'any',
    colour:      '#1A1A2A',
    border:      '#000010',
    headColour:  '#4A3A5A',
    skinColour:  '#2A1A3A',
    clothColour: '#0A000A',
    speed:       65,
    hp:          60,
    damage:      15,
    reward:      8,
    canTeleport: true,
    teleportCd:  8,
    size:        8,
  },
};

// ── Spawn position per edge ───────────────────────────────────────────────────
function _spawnPos(edge) {
  const mapW = COLS * TILE;
  const mapH = ROWS * TILE;
  const rnd  = () => Math.random();
  switch (edge) {
    case 'north':     return { x: rnd() * mapW,        y: -TILE };
    case 'south':     return { x: rnd() * mapW,        y: mapH + TILE };
    case 'east':      return { x: mapW + TILE,          y: rnd() * mapH };
    case 'west':      return { x: -TILE,                y: rnd() * mapH };
    case 'northwest': return { x: rnd() * mapW * 0.3,  y: rnd() * mapH * 0.3 };
    default: {
      const edges = ['north','south','east','west'];
      return _spawnPos(edges[Math.floor(Math.random() * edges.length)]);
    }
  }
}

// ── Enemy class ───────────────────────────────────────────────────────────────
class Enemy {
  constructor(factionKey, wave) {
    this.faction    = factionKey;
    const def       = FACTIONS[factionKey];
    const scale     = 1 + (wave - 1) * 0.12;

    const edge      = def.spawnEdge === 'any'
      ? ['north','south','east','west'][Math.floor(Math.random() * 4)]
      : def.spawnEdge;

    const pos       = _spawnPos(edge);
    this.x          = pos.x;
    this.y          = pos.y;
    this.hp         = def.hp  * scale;
    this.maxHp      = this.hp;
    this.speed      = def.speed;
    this.damage     = def.damage * scale;
    this.reward     = def.reward;
    this.ranged     = def.ranged     ?? false;
    this.attackRange= def.attackRange ?? 20;
    this.canTeleport= def.canTeleport ?? false;
    this._teleportCd= def.teleportCd  ?? 999;
    this._teleportT = def.teleportCd  ?? 999;
    this._slowMult  = 1.0;
    this._slowTimer = 0;
    this._attackCd  = 0;
    this.dead       = false;
    this._def       = def;
    // walk animation
    this._walkT     = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (this.dead) return;
    this._walkT += dt * 8;

    if (this._slowTimer > 0) {
      this._slowTimer -= dt;
      if (this._slowTimer <= 0) this._slowMult = 1.0;
    }

    if (this.canTeleport) {
      this._teleportT -= dt;
      if (this._teleportT <= 0) {
        this._doTeleport();
        this._teleportT = this._teleportCd;
      }
    }

    this._attackCd = Math.max(0, this._attackCd - dt);

    const target = this._nearestBuilding();
    if (!target) return;

    const dx   = target.wx - this.x;
    const dy   = target.wy - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const atkRange = this.ranged ? this.attackRange : 20;

    if (dist > atkRange) {
      const spd = this.speed * this._slowMult * dt;
      this.x += (dx / dist) * Math.min(spd, dist);
      this.y += (dy / dist) * Math.min(spd, dist);
    } else if (this._attackCd <= 0) {
      damageBuilding(target.building, this.damage);
      this._attackCd = 1.2;
    }
  }

  _nearestBuilding() {
    let best = null, bestDist = Infinity;
    const seen = new Set();
    for (const b of placedBuildings.values()) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const wx  = b.tx * TILE + TILE / 2;
      const wy  = b.ty * TILE + TILE / 2;
      const dx  = wx - this.x;
      const dy  = wy - this.y;
      const d   = dx*dx + dy*dy;
      if (d < bestDist) { bestDist = d; best = { building: b, wx, wy }; }
    }
    return best;
  }

  _doTeleport() {
    const cx = (COLS / 2) * TILE + (Math.random() * 6 - 3) * TILE;
    const cy = (ROWS / 2) * TILE + (Math.random() * 6 - 3) * TILE;
    this.x = cx;
    this.y = cy;
  }

  applySlow(mult, duration) {
    this._slowMult  = mult;
    this._slowTimer = duration;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.dead = true;
    const idx = enemies.indexOf(this);
    if (idx !== -1) enemies.splice(idx, 1);
    events.emit(EV.ENEMY_DIED, { faction: this.faction, reward: this.reward });
  }
}

// ── Spawning ──────────────────────────────────────────────────────────────────
export function spawnWave(waveConfig) {
  for (const { faction, count } of waveConfig) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        enemies.push(new Enemy(faction, waveConfig._wave ?? 1));
      }, i * 300 + Math.random() * 200);
    }
  }
}

export function updateEnemies(dt) {
  for (const e of [...enemies]) e.update(dt);
}

// ── Render ─────────────────────────────────────────────────────────────────────
export function renderUnits(ctx) {
  // Y-sort so units behind appear behind
  const sorted = [...enemies].sort((a, b) => a.y - b.y);
  for (const e of sorted) _drawEnemy(ctx, e);
}

function _drawEnemy(ctx, e) {
  const def  = e._def;
  const x    = Math.round(e.x);
  const y    = Math.round(e.y);

  const img = _unitImgs[e.faction];
  if (img) {
    const sz = e.faction === 'giant' ? def.size * 2.5 : def.size * 2;
    ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
  } else if (e.faction === 'giant') {
    _drawGiant(ctx, e, x, y, def);
  } else {
    _drawHumanoid(ctx, e, x, y, def);
  }

  // Slow shimmer
  if (e._slowTimer > 0) {
    ctx.fillStyle = 'rgba(100,200,255,0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 4, def.size + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // HP bar (only when damaged)
  if (e.hp < e.maxHp) {
    const bw = 14;
    const bx = x - bw / 2;
    const by = y - def.size - 14;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 3);
  }
}

function _drawHumanoid(ctx, e, x, y, def) {
  const walk = Math.sin(e._walkT);
  const legL = Math.round(walk * 2);
  const legR = -legL;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Left leg
  ctx.fillStyle = def.clothColour;
  ctx.fillRect(x - 3, y + 2 + legL, 2, 5);
  // Right leg
  ctx.fillRect(x + 1, y + 2 + legR, 2, 5);

  // Body / torso
  ctx.fillStyle = def.colour;
  ctx.fillRect(x - 4, y - 3, 8, 6);

  // Faction-specific body detail
  _bodyDetail(ctx, e.faction, x, y, def);

  // Neck
  ctx.fillStyle = def.skinColour;
  ctx.fillRect(x - 1, y - 5, 2, 2);

  // Head
  ctx.fillStyle = def.headColour;
  ctx.beginPath();
  ctx.arc(x, y - 8, 4, 0, Math.PI * 2);
  ctx.fill();

  // Outline on head
  ctx.strokeStyle = def.border;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Eyes
  _drawEyes(ctx, e.faction, x, y);

  // Faction weapon/hat
  _drawAccessory(ctx, e.faction, x, y, def);
}

function _bodyDetail(ctx, faction, x, y, def) {
  switch (faction) {
    case 'orc':
      // Armour plate
      ctx.fillStyle = '#888';
      ctx.fillRect(x - 3, y - 3, 6, 4);
      break;
    case 'undead':
      // Tattered robe
      ctx.fillStyle = '#2A2A3A';
      ctx.fillRect(x - 3, y - 2, 6, 5);
      break;
    case 'darkelf':
      // Dark cloak
      ctx.fillStyle = '#1A0030';
      ctx.fillRect(x - 4, y - 3, 8, 6);
      ctx.fillStyle = '#5A3080';
      ctx.fillRect(x - 2, y - 3, 4, 3);
      break;
    case 'shadow':
      // Smoky aura flicker
      ctx.fillStyle = `rgba(80,0,120,${0.4 + Math.sin(Date.now() * 0.005) * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y - 1, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function _drawEyes(ctx, faction, x, y) {
  switch (faction) {
    case 'undead':
      // Glowing purple eyes
      ctx.fillStyle = '#CC88FF';
      ctx.fillRect(x - 2, y - 9, 1, 1);
      ctx.fillRect(x + 1, y - 9, 1, 1);
      break;
    case 'darkelf':
      // Red eyes
      ctx.fillStyle = '#FF2020';
      ctx.fillRect(x - 2, y - 9, 1, 1);
      ctx.fillRect(x + 1, y - 9, 1, 1);
      break;
    case 'shadow':
      // White glowing eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 2, y - 9, 1, 1);
      ctx.fillRect(x + 1, y - 9, 1, 1);
      break;
    default:
      // Black eyes
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 2, y - 9, 1, 1);
      ctx.fillRect(x + 1, y - 9, 1, 1);
  }
}

function _drawAccessory(ctx, faction, x, y, def) {
  switch (faction) {
    case 'goblin':
      // Little rusty sword
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 5);
      ctx.lineTo(x + 8, y - 1);
      ctx.stroke();
      ctx.strokeStyle = '#8B6914';
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 3);
      ctx.lineTo(x + 7, y - 3);
      ctx.stroke();
      break;
    case 'orc':
      // Axe
      ctx.fillStyle = '#AAA';
      ctx.fillRect(x + 4, y - 6, 4, 8);
      ctx.fillStyle = '#888';
      ctx.fillRect(x + 6, y - 8, 4, 5);
      break;
    case 'undead':
      // Bone weapon — staff
      ctx.strokeStyle = '#DDD';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 10);
      ctx.lineTo(x + 5, y + 5);
      ctx.stroke();
      ctx.fillStyle = '#EEE';
      ctx.beginPath();
      ctx.arc(x + 5, y - 10, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'darkelf':
      // Bow
      ctx.strokeStyle = '#8A60A0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 6, y - 4, 5, -Math.PI * 0.7, Math.PI * 0.7);
      ctx.stroke();
      ctx.strokeStyle = '#DDD';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.stroke();
      break;
    case 'shadow':
      // Swirling dark orb
      ctx.fillStyle = `rgba(150,0,255,${0.5 + Math.sin(Date.now() * 0.008) * 0.3})`;
      ctx.beginPath();
      ctx.arc(x + 5, y - 6, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function _drawGiant(ctx, e, x, y, def) {
  const r = def.size;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + r + 2, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thick legs
  ctx.fillStyle = def.clothColour;
  ctx.fillRect(x - r + 2, y + r / 2, r - 2, r);
  ctx.fillRect(x + 2, y + r / 2, r - 2, r);

  // Body (stone/rock textured block)
  ctx.fillStyle = def.colour;
  ctx.fillRect(x - r, y - r / 2, r * 2, r + 4);

  // Stone crack lines
  ctx.strokeStyle = def.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - r / 2 + 2);
  ctx.lineTo(x - 1, y);
  ctx.lineTo(x + 3, y - 2);
  ctx.stroke();

  // Arms
  ctx.fillStyle = def.skinColour;
  ctx.fillRect(x - r - 4, y - r / 2 + 2, 5, r);
  ctx.fillRect(x + r - 1, y - r / 2 + 2, 5, r);

  // Fists
  ctx.fillRect(x - r - 5, y + r / 4, 6, 6);
  ctx.fillRect(x + r, y + r / 4, 6, 6);

  // Head — large boulder
  ctx.fillStyle = def.headColour;
  ctx.beginPath();
  ctx.arc(x, y - r - 2, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = def.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Angry eyes
  ctx.fillStyle = '#FF4400';
  ctx.fillRect(x - 5, y - r - 4, 3, 3);
  ctx.fillRect(x + 2, y - r - 4, 3, 3);

  // Brow furrow
  ctx.strokeStyle = '#602000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - r - 5);
  ctx.lineTo(x - 3, y - r - 3);
  ctx.moveTo(x + 6, y - r - 5);
  ctx.lineTo(x + 3, y - r - 3);
  ctx.stroke();
}

export function getDamageMultiplier(towerType, factionKey) {
  return EFFECTIVENESS[towerType]?.[factionKey] ?? 1.0;
}
