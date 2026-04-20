import { TILE, COLS, ROWS } from '../world/map.js';
import { placedBuildings, damageBuilding, getBuilding } from '../buildings/placement.js';
import { events, EV } from '../engine/events.js';
import { EFFECTIVENESS } from '../buildings/registry.js';

export const enemies = [];

// ── Faction definitions ───────────────────────────────────────────────────────
// spawnEdge: which map edge this faction attacks from
// colour, borderColour: sprite colours
// speed, hp, damage, reward: base stats (scaled per wave)
export const FACTIONS = {
  goblin: {
    label:       '🐗 Goblin Horde',
    spawnEdge:   'north',
    colour:      '#6ABF4B',
    border:      '#3A8A1A',
    headColour:  '#AEFA7A',
    speed:       90,
    hp:          30,
    damage:      5,
    reward:      2,
    size:        8,   // px radius
  },
  orc: {
    label:       '🪓 Orc Warband',
    spawnEdge:   'west',
    colour:      '#556B2F',
    border:      '#2A4A10',
    headColour:  '#7A9A4A',
    speed:       45,
    hp:          120,
    damage:      18,
    reward:      6,
    size:        11,
  },
  undead: {
    label:       '💀 Undead Legion',
    spawnEdge:   'south',
    colour:      '#B0B0C0',
    border:      '#606070',
    headColour:  '#E0E0F0',
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
    headColour:  '#8A60A0',
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
    speed:       25,
    hp:          400,
    damage:      40,
    reward:      15,
    size:        16,
  },
  shadow: {
    label:       '🌑 Shadow Cult',
    spawnEdge:   'any',   // random edge each spawn
    colour:      '#1A1A2A',
    border:      '#000010',
    headColour:  '#3A2A4A',
    speed:       65,
    hp:          60,
    damage:      15,
    reward:      8,
    canTeleport: true,    // teleports every 8s
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
    const scale     = 1 + (wave - 1) * 0.12; // +12% per wave

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
  }

  update(dt) {
    if (this.dead) return;

    // Slow decay
    if (this._slowTimer > 0) {
      this._slowTimer -= dt;
      if (this._slowTimer <= 0) this._slowMult = 1.0;
    }

    // Shadow teleport
    if (this.canTeleport) {
      this._teleportT -= dt;
      if (this._teleportT <= 0) {
        this._doTeleport();
        this._teleportT = this._teleportCd;
      }
    }

    this._attackCd = Math.max(0, this._attackCd - dt);

    // Find nearest building target
    const target = this._nearestBuilding();
    if (!target) return;

    const dx  = target.wx - this.x;
    const dy  = target.wy - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const atkRange = this.ranged ? this.attackRange : 20;

    if (dist > atkRange) {
      // Move toward target
      const spd = this.speed * this._slowMult * dt;
      this.x += (dx / dist) * Math.min(spd, dist);
      this.y += (dy / dist) * Math.min(spd, dist);
    } else if (this._attackCd <= 0) {
      // Attack
      damageBuilding(target.building, this.damage);
      this._attackCd = 1.2; // attack every 1.2s
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
    // Teleport to a random position near the settlement
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
  // waveConfig: [{ faction, count }]
  for (const { faction, count } of waveConfig) {
    for (let i = 0; i < count; i++) {
      // Stagger spawns slightly
      setTimeout(() => {
        enemies.push(new Enemy(faction, waveConfig._wave ?? 1));
      }, i * 300 + Math.random() * 200);
    }
  }
}

export function updateEnemies(dt) {
  for (const e of [...enemies]) e.update(dt);
}

// ── Render (WorldBox-style tiny sprites) ──────────────────────────────────────
export function renderUnits(ctx) {
  for (const e of enemies) {
    _drawEnemy(ctx, e);
  }
}

function _drawEnemy(ctx, e) {
  const def = e._def;
  const x   = Math.round(e.x);
  const y   = Math.round(e.y);
  const r   = def.size;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + r, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = def.colour;
  ctx.strokeStyle = def.border;
  ctx.lineWidth = 1.5;

  if (e.faction === 'giant') {
    // Giants: big square block
    ctx.fillRect(x - r, y - r, r*2, r*2);
    ctx.strokeRect(x - r, y - r, r*2, r*2);
  } else {
    // Standard: legs + body + head
    // Legs
    ctx.fillStyle = def.border;
    ctx.fillRect(x - 3, y + 2, 2, 5);
    ctx.fillRect(x + 1, y + 2, 2, 5);
    // Body
    ctx.fillStyle = def.colour;
    ctx.fillRect(x - r, y - r/2, r*2, r);
    // Head
    ctx.fillStyle = def.headColour;
    ctx.beginPath();
    ctx.arc(x, y - r - 2, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.border; ctx.lineWidth = 1;
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x - 2, y - r - 3, 1, 1);
    ctx.fillRect(x + 1, y - r - 3, 1, 1);
  }

  // Slow shimmer
  if (e._slowTimer > 0) {
    ctx.fillStyle = 'rgba(100,180,255,0.3)';
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI*2); ctx.fill();
  }

  // HP bar
  const bw = r * 2 + 4;
  const bx = x - r - 2;
  const by = y - r - 12;
  ctx.fillStyle = '#222';
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 3);
}

export function getDamageMultiplier(towerType, factionKey) {
  return EFFECTIVENESS[towerType]?.[factionKey] ?? 1.0;
}
