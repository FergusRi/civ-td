// ============================================================
// settlement.js — Flag placement & leader target
// The flag is where the leader stands; enemies pathfind to it.
// ============================================================
import { TILE, COLS, ROWS } from './map.js';
import { events, EV } from '../engine/events.js';

let _flagTX = -1;
let _flagTY = -1;

export function setFlag(tx, ty) {
  _flagTX = Math.max(0, Math.min(COLS - 1, tx));
  _flagTY = Math.max(0, Math.min(ROWS - 1, ty));
  events.emit(EV.FLAG_PLACED, { tx: _flagTX, ty: _flagTY });
}

export function getFlagTX() { return _flagTX; }
export function getFlagTY() { return _flagTY; }
export function hasFlag()   { return _flagTX >= 0; }

// World-pixel centre of the flag tile
export function getFlagPX() { return _flagTX * TILE + TILE / 2; }
export function getFlagPY() { return _flagTY * TILE + TILE / 2; }

// ── Renderer ─────────────────────────────────────────────────
const FLAG_COLORS = {
  pole:   '#8B5E3C',
  banner: '#FFD700',
  shadow: 'rgba(0,0,0,0.25)',
};

export function renderFlag(ctx) {
  if (_flagTX < 0) return;

  const px = _flagTX * TILE + TILE / 2;
  const py = _flagTY * TILE + TILE;

  // Shadow
  ctx.fillStyle = FLAG_COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pole
  ctx.strokeStyle = FLAG_COLORS.pole;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - 22);
  ctx.stroke();

  // Banner
  ctx.fillStyle = FLAG_COLORS.banner;
  ctx.beginPath();
  ctx.moveTo(px,    py - 22);
  ctx.lineTo(px+10, py - 17);
  ctx.lineTo(px,    py - 12);
  ctx.closePath();
  ctx.fill();

  // Tile highlight ring
  ctx.strokeStyle = 'rgba(255,215,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(_flagTX * TILE + 1, _flagTY * TILE + 1, TILE - 2, TILE - 2);
}
