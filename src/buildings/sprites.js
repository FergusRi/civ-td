// Building sprites — flat pixel art, RimWorld wall aesthetic
// All draw functions receive (ctx, x, y, w, h)

// ── Walls (RimWorld block style) ──────────────────────────────────────────────
function _wall(ctx, x, y, w, h, fill, border, adjMask) {
  // adjMask bits: 0=N 1=E 2=S 3=W
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Draw open-face indicators where adjacent same wall exists
  ctx.fillStyle = fill;
  if (adjMask & 0b0001) ctx.fillRect(x,         y,         w, 4);  // N open
  if (adjMask & 0b0010) ctx.fillRect(x + w - 4, y,         4, h);  // E open
  if (adjMask & 0b0100) ctx.fillRect(x,         y + h - 4, w, 4);  // S open
  if (adjMask & 0b1000) ctx.fillRect(x,         y,         4, h);  // W open
}

function _drawWallWood(ctx, x, y, w, h, _a, adjMask) {
  _wall(ctx, x, y, w, h, '#C8963C', '#6B4A12', adjMask);
  // Plank lines
  ctx.strokeStyle = '#A87030';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const lx = x + (w / 3) * i;
    ctx.beginPath(); ctx.moveTo(lx, y + 2); ctx.lineTo(lx, y + h - 2); ctx.stroke();
  }
}

function _drawWallStone(ctx, x, y, w, h, _a, adjMask) {
  _wall(ctx, x, y, w, h, '#9A9888', '#5A5848', adjMask);
  // Mortar cross
  ctx.strokeStyle = '#6A6858';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2, y + h - 2);
  ctx.moveTo(x + 2, y + h / 2); ctx.lineTo(x + w - 2, y + h / 2);
  ctx.stroke();
}

function _drawWallMetal(ctx, x, y, w, h, _a, adjMask) {
  _wall(ctx, x, y, w, h, '#7A8A9A', '#3A4A5A', adjMask);
  // Rivet dots
  ctx.fillStyle = '#4A5A6A';
  const offsets = [[4, 4], [w-6, 4], [4, h-6], [w-6, h-6]];
  for (const [ox, oy] of offsets) {
    ctx.beginPath(); ctx.arc(x + ox, y + oy, 2, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Production buildings ───────────────────────────────────────────────────────
function _drawLumberyard(ctx, x, y, w, h) {
  // Brown base
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Log pile
  ctx.fillStyle = '#C8963C';
  ctx.fillRect(x + 4, y + h/2, w - 8, h/2 - 4);
  ctx.fillStyle = '#A87030';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + 6 + i * 8, y + h/2 + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Axe icon
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(x + w/2 - 1, y + 4, 2, 10);
  ctx.fillStyle = '#AAA';
  ctx.fillRect(x + w/2 - 3, y + 4, 6, 5);
  // Border
  ctx.strokeStyle = '#5A3A0A'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function _drawFarm(ctx, x, y, w, h) {
  // Soil
  ctx.fillStyle = '#9B7240';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Crop rows
  ctx.fillStyle = '#5A8A3C';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillRect(x + 4 + col * 6, y + 6 + row * 7, 3, 5);
    }
  }
  ctx.strokeStyle = '#7A5230'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function _drawMine(ctx, x, y, w, h) {
  // Dark cave mouth
  ctx.fillStyle = '#555';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 6, y + 10, w - 12, h - 14);
  // Stone chunks
  ctx.fillStyle = '#999';
  ctx.fillRect(x + 4, y + 4, 6, 5);
  ctx.fillRect(x + w-10, y + 4, 6, 5);
  // Pickaxe
  ctx.fillStyle = '#AAA';
  ctx.fillRect(x + w/2 - 1, y + 6, 2, 10);
  ctx.fillRect(x + w/2 - 4, y + 6, 8, 3);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function _drawMarket(ctx, x, y, w, h) {
  // Stall base
  ctx.fillStyle = '#D4A84B';
  ctx.fillRect(x + 2, y + 8, w - 4, h - 10);
  // Awning
  ctx.fillStyle = '#C0392B';
  ctx.fillRect(x + 2, y + 4, w - 4, 8);
  // Stripe
  ctx.fillStyle = '#E74C3C';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + 4 + i * 7, y + 4, 3, 8);
  }
  // Gold coin
  ctx.fillStyle = '#F1C40F';
  ctx.beginPath(); ctx.arc(x + w/2, y + h/2 + 4, 4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function _drawCottage(ctx, x, y, w, h) {
  // Walls
  ctx.fillStyle = '#E8D5A0';
  ctx.fillRect(x + 2, y + h/2, w - 4, h/2 - 2);
  // Roof
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(x + w/2, y + 2);
  ctx.lineTo(x + 2, y + h/2 + 2);
  ctx.lineTo(x + w - 2, y + h/2 + 2);
  ctx.closePath(); ctx.fill();
  // Door
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(x + w/2 - 3, y + h - 8, 6, 8);
  // Window
  ctx.fillStyle = '#AED6F1';
  ctx.fillRect(x + 5, y + h/2 + 4, 5, 5);
  ctx.strokeStyle = '#5A3A0A'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

// ── Towers ────────────────────────────────────────────────────────────────────
function _towerBase(ctx, x, y, w, h, colour, battlementColor) {
  // Base block
  ctx.fillStyle = colour;
  ctx.fillRect(x + 2, y + 4, w - 4, h - 4);
  // Battlements
  ctx.fillStyle = battlementColor;
  const bw = Math.floor((w - 4) / 4);
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(x + 3 + i * (bw + 3), y + 2, bw, 6);
  }
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

function _drawTowerArcher(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#8B6914', '#6B4A12');
  // Rotating bow
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  ctx.strokeStyle = '#C8963C'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 6, -Math.PI/2, Math.PI/2); ctx.stroke();
  ctx.strokeStyle = '#AAA'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(-1, 6); ctx.stroke();
  ctx.restore();
}

function _drawTowerBallista(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#7A7A7A', '#555');
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  // Ballista body
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(-8, -2, 16, 4);
  // Bolt
  ctx.strokeStyle = '#AAA'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(8, 0); ctx.stroke();
  ctx.restore();
}

function _drawTowerCannon(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#555', '#333');
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  // Barrel
  ctx.fillStyle = '#333';
  ctx.fillRect(0, -3, 12, 6);
  // Wheel
  ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-4, 0, 5, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

function _drawTowerMage(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#4A3080', '#2A1060');
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  // Orb
  ctx.fillStyle = '#9B59B6';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#D7BDE2';
  ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function _drawTowerFrost(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#3A6EA8', '#2A5E98');
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  // Snowflake
  ctx.strokeStyle = '#AEF'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 3);
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function _drawTowerLightning(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#7A6A00', '#5A5000');
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  // Lightning bolt
  ctx.fillStyle = '#F1C40F';
  ctx.beginPath();
  ctx.moveTo(2, -7); ctx.lineTo(-2, -1); ctx.lineTo(1, -1);
  ctx.lineTo(-2, 7); ctx.lineTo(3, 0);  ctx.lineTo(0, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function _drawTowerCatapult(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#6B4A12', '#4A2A00');
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(aimAngle);
  // Arm
  ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(8, -8); ctx.stroke();
  // Sling cup
  ctx.fillStyle = '#555';
  ctx.beginPath(); ctx.arc(8, -8, 3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function _drawWatchtower(ctx, x, y, w, h) {
  // Tall narrow tower
  ctx.fillStyle = '#9A9888';
  ctx.fillRect(x + 4, y + 4, w - 8, h - 4);
  // Lookout platform
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(x + 2, y + 4, w - 4, 6);
  // Eye icon
  ctx.fillStyle = '#FFF';
  ctx.beginPath(); ctx.ellipse(x + w/2, y + 7, 5, 3, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2980B9';
  ctx.beginPath(); ctx.arc(x + w/2, y + 7, 2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 2);
}

function _drawSettlement(ctx, x, y, w, h) {
  // Large hall
  ctx.fillStyle = '#C8963C';
  ctx.fillRect(x + 2, y + h/3, w - 4, h * 2/3 - 2);
  // Roof
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(x + w/2, y + 2);
  ctx.lineTo(x + 2, y + h/3 + 4);
  ctx.lineTo(x + w - 2, y + h/3 + 4);
  ctx.closePath(); ctx.fill();
  // Banner
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(x + w/2 - 1, y + 2, 2, 10);
  ctx.fillRect(x + w/2, y + 2, 8, 6);
  // Door
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(x + w/2 - 4, y + h - 10, 8, 10);
  ctx.strokeStyle = '#5A3A0A'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

// ── Dispatch table ─────────────────────────────────────────────────────────────
const DRAW_FNS = {
  wall_wood:        (ctx, x, y, w, h, a, adj) => _drawWallWood(ctx, x, y, w, h, a, adj),
  wall_stone:       (ctx, x, y, w, h, a, adj) => _drawWallStone(ctx, x, y, w, h, a, adj),
  wall_metal:       (ctx, x, y, w, h, a, adj) => _drawWallMetal(ctx, x, y, w, h, a, adj),
  lumberyard:       (ctx, x, y, w, h)          => _drawLumberyard(ctx, x, y, w, h),
  farm:             (ctx, x, y, w, h)          => _drawFarm(ctx, x, y, w, h),
  mine:             (ctx, x, y, w, h)          => _drawMine(ctx, x, y, w, h),
  market:           (ctx, x, y, w, h)          => _drawMarket(ctx, x, y, w, h),
  cottage:          (ctx, x, y, w, h)          => _drawCottage(ctx, x, y, w, h),
  tower_archer:     (ctx, x, y, w, h, a)       => _drawTowerArcher(ctx, x, y, w, h, a),
  tower_ballista:   (ctx, x, y, w, h, a)       => _drawTowerBallista(ctx, x, y, w, h, a),
  tower_cannon:     (ctx, x, y, w, h, a)       => _drawTowerCannon(ctx, x, y, w, h, a),
  tower_mage:       (ctx, x, y, w, h, a)       => _drawTowerMage(ctx, x, y, w, h, a),
  tower_frost:      (ctx, x, y, w, h, a)       => _drawTowerFrost(ctx, x, y, w, h, a),
  tower_lightning:  (ctx, x, y, w, h, a)       => _drawTowerLightning(ctx, x, y, w, h, a),
  tower_catapult:   (ctx, x, y, w, h, a)       => _drawTowerCatapult(ctx, x, y, w, h, a),
  watchtower:       (ctx, x, y, w, h)          => _drawWatchtower(ctx, x, y, w, h),
  settlement:       (ctx, x, y, w, h)          => _drawSettlement(ctx, x, y, w, h),
};

export function drawBuildingSprite(ctx, type, _state, x, y, w, h, aimAngle = 0, adjMask = 0) {
  const fn = DRAW_FNS[type];
  if (fn) {
    fn(ctx, x, y, w, h, aimAngle, adjMask);
  } else {
    // Fallback: grey box with type label
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#FFF';
    ctx.font = '8px monospace';
    ctx.fillText(type.slice(0, 4), x + 3, y + h/2);
  }
}
