// ============================================================
// zone_toolbar.js — Prison Architect-style zone painting UI
// Click+drag rectangle to paint SETTLEMENT or DEFENCE zones.
// Also handles flag placement mode.
// ============================================================
import { TILE, COLS, ROWS } from '../world/map.js';
import { ZONE, paintZoneRect } from '../world/zones.js';
import { setFlag, hasFlag } from '../world/settlement.js';
import { screenToWorld } from '../engine/camera.js';
import { getPhase } from '../phases/phases.js';

// ── State ─────────────────────────────────────────────────────
let _activeZone = ZONE.NONE;   // which zone type is being painted
let _placingFlag = false;       // flag placement mode
let _dragging = false;
let _dragStart = null;          // { tx, ty }
let _dragCurrent = null;        // { tx, ty } live cursor

export function getActiveZone()  { return _activeZone; }
export function isPlacingFlag()  { return _placingFlag; }
export function getDragPreview() {
  if (!_dragging || !_dragStart || !_dragCurrent) return null;
  return { start: _dragStart, end: _dragCurrent };
}

export function setActiveZone(z) {
  _activeZone  = z;
  _placingFlag = false;
  _updateActiveBtn();
}
export function setPlacingFlag() {
  _placingFlag = true;
  _activeZone  = ZONE.NONE;
  _updateActiveBtn();
}
export function cancelZoneTool() {
  _activeZone  = ZONE.NONE;
  _placingFlag = false;
  _dragging    = false;
  _dragStart   = null;
  _dragCurrent = null;
  _updateActiveBtn();
}

// ── Canvas mouse wiring (called from input.js) ────────────────
export function handleZoneMouseDown(canvas, e) {
  if (getPhase() !== 'planning') return false;

  const r  = canvas.getBoundingClientRect();
  const w  = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  const tx = Math.floor(w.x / TILE);
  const ty = Math.floor(w.y / TILE);

  if (_placingFlag) {
    setFlag(tx, ty);
    _placingFlag = false;
    _refreshFlagBtn();
    return true;
  }

  if (_activeZone !== ZONE.NONE) {
    _dragging    = true;
    _dragStart   = { tx, ty };
    _dragCurrent = { tx, ty };
    return true;
  }

  return false;
}

export function handleZoneMouseMove(canvas, e) {
  if (!_dragging) return;
  const r  = canvas.getBoundingClientRect();
  const w  = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  _dragCurrent = {
    tx: Math.max(0, Math.min(COLS - 1, Math.floor(w.x / TILE))),
    ty: Math.max(0, Math.min(ROWS - 1, Math.floor(w.y / TILE))),
  };
}

export function handleZoneMouseUp(canvas, e) {
  if (!_dragging) return;
  const r  = canvas.getBoundingClientRect();
  const w  = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  const tx = Math.max(0, Math.min(COLS - 1, Math.floor(w.x / TILE)));
  const ty = Math.max(0, Math.min(ROWS - 1, Math.floor(w.y / TILE)));
  paintZoneRect(_dragStart.tx, _dragStart.ty, tx, ty, _activeZone);
  _dragging    = false;
  _dragStart   = null;
  _dragCurrent = null;
}

// ── Drag preview renderer (world-space, called from renderer) ─
import { ZONE_COLOR, ZONE_BORDER } from '../world/zones.js';

export function renderZoneDragPreview(ctx) {
  const preview = getDragPreview();
  if (!preview) return;

  const { start, end } = preview;
  const minX = Math.min(start.tx, end.tx);
  const maxX = Math.max(start.tx, end.tx);
  const minY = Math.min(start.ty, end.ty);
  const maxY = Math.max(start.ty, end.ty);
  const px   = minX * TILE;
  const py   = minY * TILE;
  const pw   = (maxX - minX + 1) * TILE;
  const ph   = (maxY - minY + 1) * TILE;

  ctx.fillStyle   = ZONE_COLOR[_activeZone]   ?? 'rgba(255,255,255,0.15)';
  ctx.strokeStyle = ZONE_BORDER[_activeZone]  ?? 'rgba(255,255,255,0.6)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeRect(px, py, pw, ph);
  ctx.setLineDash([]);
}

// ── DOM toolbar (injected into #ui-root by initZoneToolbar) ───
let _toolbar;
let _flagBtn;

export function initZoneToolbar(uiRoot) {
  _toolbar = document.createElement('div');
  _toolbar.className = 'zone-toolbar';
  _toolbar.innerHTML = `
    <span class="zone-toolbar-label">Zones</span>
    <button class="zone-btn" id="zb-settlement" title="Paint Settlement Zone">🏡 Settlement</button>
    <button class="zone-btn" id="zb-defence"    title="Paint Defence Zone">🛡 Defence</button>
    <button class="zone-btn" id="zb-erase"      title="Erase Zone">🧹 Erase</button>
    <button class="zone-btn" id="zb-flag"       title="Place Flag (leader target)">🚩 Flag</button>
  `;
  uiRoot.appendChild(_toolbar);

  document.getElementById('zb-settlement').addEventListener('click', () => setActiveZone(ZONE.SETTLEMENT));
  document.getElementById('zb-defence').addEventListener('click',    () => setActiveZone(ZONE.DEFENCE));
  document.getElementById('zb-erase').addEventListener('click',      () => setActiveZone(ZONE.NONE));  // erase = paint NONE
  _flagBtn = document.getElementById('zb-flag');
  _flagBtn.addEventListener('click', () => setPlacingFlag());

  // Erase actually paints NONE — repurpose so user can drag-erase
  document.getElementById('zb-erase').addEventListener('click', () => {
    _activeZone = ZONE.NONE;
    _placingFlag = false;
  });
}

function _refreshFlagBtn() {
  if (_flagBtn && hasFlag()) {
    _flagBtn.textContent = '🚩 Move Flag';
  }
}

// ── Active button highlight ───────────────────────────────────
function _updateActiveBtn() {
  if (!_toolbar) return;
  _toolbar.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
  if (_placingFlag) {
    document.getElementById('zb-flag')?.classList.add('active');
  } else if (_activeZone === ZONE.SETTLEMENT) {
    document.getElementById('zb-settlement')?.classList.add('active');
  } else if (_activeZone === ZONE.DEFENCE) {
    document.getElementById('zb-defence')?.classList.add('active');
  }
}
