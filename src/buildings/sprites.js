// Building sprites — WorldBox-style top-down pixel art
// Tiny, charming, chunky — like Worldbox's civilisation buildings
// All draw functions receive (ctx, x, y, w, h)

// ── Wang tilesets for walls (seamless connected segments) ─────────────────────
import { loadWangTileset, drawWangTile, hasWangTileset } from '../world/wang.js';

const _WALL_WANG_SRCS = {
  wall_wood:  '/buildings/wall_wood.png',
  wall_stone: '/buildings/wall_stone.png',
  wall_metal: '/buildings/wall_metal.png',
};

export function preloadWallTilesets() {
  return Promise.all(
    Object.entries(_WALL_WANG_SRCS).map(([key, src]) => loadWangTileset(key, src))
  );
}

export function drawWallSprite(ctx, type, adjMask, x, y, w) {
  if (!hasWangTileset(type)) return false;
  const sameN = !!(adjMask & 1);
  const sameE = !!(adjMask & 2);
  const sameS = !!(adjMask & 4);
  const sameW = !!(adjMask & 8);
  return drawWangTile(ctx, type, sameN, sameE, sameS, sameW, x, y, w);
}

// ── Pixel-art building images (loaded once, fallback to procedural) ────────────
const _bldImgs = {};
const _BLD_IMG_SRCS = {
  cottage:         '/buildings/house.png',
  barracks:        '/buildings/barracks.png',
  market:          '/buildings/market.png',
  watchtower:      '/buildings/watchtower.png',
  tower_archer:    '/buildings/tower_archer.png',
  tower_ballista:  '/buildings/tower_ballista.png',
  tower_cannon:    '/buildings/tower_cannon.png',
  tower_mage:      '/buildings/tower_mage.png',
  tower_frost:     '/buildings/tower_frost.png',
  tower_lightning: '/buildings/tower_lightning.png',
  tower_catapult:  '/buildings/tower_catapult.png',
  farm:            '/buildings/farm.png',
  mine:            '/buildings/mine.png',
  lumberyard:      '/buildings/lumberyard.png',
  settlement:      '/buildings/settlement.png',
};

export function preloadBuildingImages() {
  return Promise.all(Object.entries(_BLD_IMG_SRCS).map(([key, src]) =>
    new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { _bldImgs[key] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    })
  ));
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function _shadow(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 3, y + h - 3, w, 5);
}

function _outline(ctx, x, y, w, h, col = '#2A1A00') {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Chunky pixel roof (triangle, top-down perspective = trapezoid top strip)
function _roof(ctx, x, y, w, col, darkCol) {
  // Roof ridge strip at top of tile
  ctx.fillStyle = col;
  ctx.fillRect(x + 2, y + 2, w - 4, Math.round(w * 0.35));
  // Darker ridge line
  ctx.fillStyle = darkCol;
  ctx.fillRect(x + w/2 - 1, y + 2, 2, Math.round(w * 0.35));
  // Side shadow under roof
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x + 2, y + 2 + Math.round(w * 0.35) - 1, w - 4, 2);
}

function _window(ctx, x, y) {
  // Tiny WorldBox-style window: white square, blue tint
  ctx.fillStyle = '#D4EEFF';
  ctx.fillRect(x, y, 4, 4);
  ctx.fillStyle = 'rgba(0,80,160,0.3)';
  ctx.fillRect(x, y, 4, 4);
  ctx.fillStyle = '#FFF';
  ctx.fillRect(x, y, 2, 2); // highlight
  ctx.strokeStyle = '#4A3010';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y, 4, 4);
}

function _door(ctx, x, y, col = '#5A2A00') {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, 5, 7);
  ctx.fillStyle = '#8B5A20';
  ctx.fillRect(x + 1, y + 1, 3, 5);
  // Door handle
  ctx.fillStyle = '#D4A830';
  ctx.fillRect(x + 3, y + 4, 1, 1);
}

// ── Walls ─────────────────────────────────────────────────────────────────────

function _drawWallWood(ctx, x, y, w, h, _a, adjMask) {
  _shadow(ctx, x, y, w, h);
  // Main plank body
  ctx.fillStyle = '#C8873A';
  ctx.fillRect(x, y, w, h);
  // Horizontal plank lines
  ctx.fillStyle = '#A06020';
  for (let i = 1; i < 4; i++) {
    ctx.fillRect(x + 1, y + Math.round(h * i / 4), w - 2, 1);
  }
  // Knot holes
  ctx.fillStyle = '#7A4010';
  ctx.fillRect(x + 5, y + 6, 2, 2);
  ctx.fillRect(x + w - 8, y + h - 8, 2, 2);
  // Corner posts
  ctx.fillStyle = '#7A4010';
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);
  // Gaps where adjacent walls connect
  if (adjMask & 0b0001) ctx.fillStyle = '#C8873A', ctx.fillRect(x, y, w, 3);
  if (adjMask & 0b0100) ctx.fillStyle = '#C8873A', ctx.fillRect(x, y + h - 3, w, 3);
  if (adjMask & 0b1000) ctx.fillStyle = '#C8873A', ctx.fillRect(x, y, 3, h);
  if (adjMask & 0b0010) ctx.fillStyle = '#C8873A', ctx.fillRect(x + w - 3, y, 3, h);
  _outline(ctx, x, y, w, h, '#5A2A00');
}

function _drawWallStone(ctx, x, y, w, h, _a, adjMask) {
  _shadow(ctx, x, y, w, h);
  ctx.fillStyle = '#8A8878';
  ctx.fillRect(x, y, w, h);
  // Stone brick pattern
  const brickH = Math.round(h / 3);
  for (let row = 0; row < 3; row++) {
    const offset = row % 2 === 0 ? 0 : Math.round(w / 3);
    ctx.fillStyle = row % 2 === 0 ? '#9A9888' : '#808070';
    for (let col = 0; col < 3; col++) {
      const bx = x + (col * Math.round(w / 3) + offset) % w;
      ctx.fillRect(bx, y + row * brickH + 1, Math.round(w / 3) - 1, brickH - 1);
    }
  }
  // Mortar lines
  ctx.fillStyle = '#6A6858';
  for (let i = 1; i < 3; i++) ctx.fillRect(x + 1, y + Math.round(h * i / 3), w - 2, 1);
  ctx.fillRect(x + Math.round(w / 2), y + 1, 1, h - 2);
  if (adjMask & 0b0001) ctx.fillStyle = '#8A8878', ctx.fillRect(x, y, w, 3);
  if (adjMask & 0b0100) ctx.fillStyle = '#8A8878', ctx.fillRect(x, y + h - 3, w, 3);
  if (adjMask & 0b1000) ctx.fillStyle = '#8A8878', ctx.fillRect(x, y, 3, h);
  if (adjMask & 0b0010) ctx.fillStyle = '#8A8878', ctx.fillRect(x + w - 3, y, 3, h);
  _outline(ctx, x, y, w, h, '#3A3828');
}

function _drawWallMetal(ctx, x, y, w, h, _a, adjMask) {
  _shadow(ctx, x, y, w, h);
  ctx.fillStyle = '#7A8A9A';
  ctx.fillRect(x, y, w, h);
  // Metal panel sheen
  ctx.fillStyle = '#9AAABB';
  ctx.fillRect(x + 2, y + 2, w - 4, Math.round(h * 0.4));
  // Panel lines
  ctx.fillStyle = '#5A6A7A';
  ctx.fillRect(x + 1, y + Math.round(h / 2), w - 2, 1);
  ctx.fillRect(x + Math.round(w / 2), y + 1, 1, h - 2);
  // Rivets
  ctx.fillStyle = '#445566';
  [[4,4],[w-6,4],[4,h-6],[w-6,h-6]].forEach(([ox,oy]) => {
    ctx.beginPath(); ctx.arc(x+ox, y+oy, 1.5, 0, Math.PI*2); ctx.fill();
  });
  if (adjMask & 0b0001) ctx.fillStyle = '#7A8A9A', ctx.fillRect(x, y, w, 3);
  if (adjMask & 0b0100) ctx.fillStyle = '#7A8A9A', ctx.fillRect(x, y + h - 3, w, 3);
  if (adjMask & 0b1000) ctx.fillStyle = '#7A8A9A', ctx.fillRect(x, y, 3, h);
  if (adjMask & 0b0010) ctx.fillStyle = '#7A8A9A', ctx.fillRect(x + w - 3, y, 3, h);
  _outline(ctx, x, y, w, h, '#2A3A4A');
}

// ── Production buildings ──────────────────────────────────────────────────────

function _drawLumberyard(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Ground / yard
  ctx.fillStyle = '#8B6530';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Wooden shed (top half)
  ctx.fillStyle = '#C8873A';
  ctx.fillRect(x + 3, y + 3, w - 6, Math.round(h * 0.45));
  _roof(ctx, x + 3, y + 3, w - 6, '#8B4513', '#5A2A00');
  // Log pile (bottom half) — 3 stacked logs
  const logY = y + Math.round(h * 0.55);
  [0,1,2].forEach(i => {
    ctx.fillStyle = i % 2 === 0 ? '#C8873A' : '#A86020';
    ctx.fillRect(x + 4, logY + i * 4, w - 8, 4);
    // Log end circles
    ctx.fillStyle = '#7A4010';
    ctx.beginPath(); ctx.arc(x + 5, logY + i * 4 + 2, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 5, logY + i * 4 + 2, 2, 0, Math.PI*2); ctx.fill();
  });
  // Axe leaning against shed
  ctx.strokeStyle = '#6A3A10'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + w - 7, y + 6); ctx.lineTo(x + w - 7, y + 18); ctx.stroke();
  ctx.fillStyle = '#AAA';
  ctx.fillRect(x + w - 10, y + 5, 6, 4);
  _outline(ctx, x, y, w, h, '#5A2A00');
}

function _drawFarm(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Tilled soil background
  ctx.fillStyle = '#7A5228';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Soil furrow rows
  ctx.fillStyle = '#5A3818';
  for (let row = 0; row < 5; row++) {
    ctx.fillRect(x + 2, y + 4 + row * Math.round((h - 8) / 5), w - 4, 1);
  }
  // Crop plants — tiny green tufts
  const cropColours = ['#3A8A28','#4AA030','#5AB038','#2A7A20'];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = cropColours[(row + col) % cropColours.length];
      const cx2 = x + 5 + col * Math.round((w - 8) / 4);
      const cy2 = y + 6 + row * Math.round((h - 10) / 4);
      // Tiny plant: stem + leaves
      ctx.fillRect(cx2, cy2 + 1, 2, 3);
      ctx.fillRect(cx2 - 1, cy2, 4, 2);
    }
  }
  // Small fence posts at corners
  ctx.fillStyle = '#A07840';
  ctx.fillRect(x + 1, y + 1, 2, h - 2);
  ctx.fillRect(x + w - 3, y + 1, 2, h - 2);
  _outline(ctx, x, y, w, h, '#4A2810');
}

function _drawMine(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Rocky ground
  ctx.fillStyle = '#6A6050';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Mine entrance (dark arch)
  ctx.fillStyle = '#2A2018';
  const mw = Math.round(w * 0.55), mh = Math.round(h * 0.5);
  const mx2 = x + Math.round((w - mw) / 2), my2 = y + Math.round(h * 0.35);
  ctx.fillRect(mx2, my2, mw, mh);
  // Arch top
  ctx.beginPath();
  ctx.arc(mx2 + mw/2, my2, mw/2, Math.PI, 0);
  ctx.fill();
  // Timber frame around entrance
  ctx.strokeStyle = '#8B5A20'; ctx.lineWidth = 2;
  ctx.strokeRect(mx2 - 1, my2 - Math.round(mw/2), mw + 2, mh + Math.round(mw/2));
  // Support beam at top
  ctx.fillStyle = '#8B5A20';
  ctx.fillRect(mx2, my2 - Math.round(mw/2) - 1, mw, 3);
  // Stone chunks scattered on ground
  ctx.fillStyle = '#9A9080';
  [[x+3,y+5],[x+w-7,y+4],[x+4,y+h-8]].forEach(([rx,ry]) => {
    ctx.fillRect(rx, ry, 5, 4);
    ctx.fillRect(rx+1, ry-1, 3, 2);
  });
  // Pickaxe icon (top left)
  ctx.strokeStyle = '#CCC'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x+4, y+4); ctx.lineTo(x+10, y+10); ctx.stroke();
  ctx.fillStyle = '#BBB';
  ctx.fillRect(x+3, y+3, 5, 3);
  _outline(ctx, x, y, w, h, '#2A1808');
}

function _drawMarket(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Stall base
  ctx.fillStyle = '#D4A84B';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Striped awning (top third)
  const awningH = Math.round(h * 0.38);
  const stripeW = Math.round(w / 5);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#C0392B' : '#E74C3C';
    ctx.fillRect(x + i * stripeW, y + 1, stripeW, awningH);
  }
  // Awning fringe (tiny triangles via rects)
  ctx.fillStyle = '#E74C3C';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x + 1 + i * Math.round((w-2)/6), y + awningH, Math.round((w-2)/6) - 1, 3);
  }
  // Goods on display
  // Apple (red circle)
  ctx.fillStyle = '#CC2020';
  ctx.beginPath(); ctx.arc(x + 8, y + awningH + 8, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#3A8A10'; ctx.fillRect(x + 8, y + awningH + 4, 1, 3);
  // Bread loaf (brown oval)
  ctx.fillStyle = '#C8883A';
  ctx.beginPath(); ctx.ellipse(x + w - 10, y + awningH + 8, 5, 3, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#A06020'; ctx.fillRect(x + w - 13, y + awningH + 7, 6, 1);
  // Gold coin stack
  ctx.fillStyle = '#E8C020';
  [0,1,2].forEach(i => {
    ctx.beginPath(); ctx.ellipse(x + w/2, y + h - 7 - i*2, 5, 2, 0, 0, Math.PI*2); ctx.fill();
  });
  _outline(ctx, x, y, w, h, '#7A3010');
}

function _drawCottage(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Stone foundation
  ctx.fillStyle = '#9A9080';
  ctx.fillRect(x + 1, y + Math.round(h*0.45), w - 2, Math.round(h*0.55));
  // Wall (cream/tan)
  ctx.fillStyle = '#EAD8A8';
  ctx.fillRect(x + 3, y + Math.round(h*0.48), w - 6, Math.round(h*0.48));
  // Thatched / tiled roof (top portion)
  const roofH = Math.round(h * 0.48);
  ctx.fillStyle = '#8B4513'; // brown tile
  ctx.fillRect(x + 1, y + 1, w - 2, roofH);
  // Roof tiles pattern
  ctx.fillStyle = '#6B2A00';
  for (let row = 0; row < 3; row++) {
    const tileH2 = Math.round(roofH / 3);
    for (let col = 0; col <= 3; col++) {
      const offset = row % 2 === 0 ? 0 : Math.round(w/6);
      ctx.fillRect(x + 1 + col * Math.round((w-2)/3) + offset, y + 1 + row * tileH2, Math.round((w-2)/3) - 1, tileH2 - 1);
    }
  }
  // Ridge cap
  ctx.fillStyle = '#3A1000';
  ctx.fillRect(x + 2, y + 1, w - 4, 2);
  // Windows (two small ones)
  _window(ctx, x + 5, y + Math.round(h*0.55));
  _window(ctx, x + w - 10, y + Math.round(h*0.55));
  // Door (centred, bottom)
  _door(ctx, x + Math.round(w/2) - 3, y + h - 8);
  // Chimney (top left)
  ctx.fillStyle = '#7A7060';
  ctx.fillRect(x + 6, y - 3, 5, 10);
  ctx.fillStyle = '#444';
  ctx.fillRect(x + 5, y - 4, 7, 3);
  // Smoke puff
  ctx.fillStyle = 'rgba(200,200,200,0.5)';
  ctx.beginPath(); ctx.arc(x + 9, y - 7, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 12, y - 10, 2, 0, Math.PI*2); ctx.fill();
  _outline(ctx, x, y, w, h, '#3A1A00');
}

// ── Towers ────────────────────────────────────────────────────────────────────

function _towerBase(ctx, x, y, w, h, wallCol, battleCol, accentCol) {
  _shadow(ctx, x, y, w, h);
  // Stone base
  ctx.fillStyle = wallCol;
  ctx.fillRect(x + 1, y + Math.round(h*0.3), w - 2, Math.round(h*0.72));
  // Stone texture
  ctx.fillStyle = accentCol;
  ctx.fillRect(x + 3, y + Math.round(h*0.35), Math.round(w*0.4), Math.round(h*0.28));
  ctx.fillRect(x + Math.round(w*0.5), y + Math.round(h*0.6), Math.round(w*0.35), Math.round(h*0.2));
  // Battlements (top)
  const bw2 = Math.round((w-2) / 3);
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = battleCol;
    ctx.fillRect(x + 2 + i * (bw2 + 2), y + Math.round(h*0.18), bw2, Math.round(h*0.2));
  }
  // Platform floor
  ctx.fillStyle = accentCol;
  ctx.fillRect(x + 1, y + Math.round(h*0.28), w - 2, 3);
}

function _drawTowerArcher(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#8A7858', '#6A5838', '#9A8868');
  // Archer on platform
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.22));
  ctx.rotate(aimAngle);
  // Tiny archer body
  ctx.fillStyle = '#6B4A12'; ctx.fillRect(-2, -3, 4, 5);
  ctx.fillStyle = '#FDBCB4'; ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI*2); ctx.fill();
  // Bow
  ctx.strokeStyle = '#C8963C'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(4, 0, 5, -Math.PI*0.6, Math.PI*0.6); ctx.stroke();
  // Arrow
  ctx.strokeStyle = '#AAA'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(6, 0); ctx.stroke();
  ctx.restore();
  _outline(ctx, x, y, w, h, '#3A2808');
}

function _drawTowerBallista(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#707068', '#505048', '#808078');
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.22));
  ctx.rotate(aimAngle);
  // Ballista frame
  ctx.fillStyle = '#8B6914'; ctx.fillRect(-8, -2, 16, 5);
  // Arms
  ctx.strokeStyle = '#7A5A10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-12, -8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-12, 9); ctx.stroke();
  // Bolt
  ctx.fillStyle = '#CCC'; ctx.fillRect(-6, -1, 14, 2);
  ctx.fillStyle = '#888'; ctx.fillRect(7, -2, 3, 4);
  ctx.restore();
  _outline(ctx, x, y, w, h, '#202018');
}

function _drawTowerCannon(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#555548', '#353530', '#656558');
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.22));
  ctx.rotate(aimAngle);
  // Wheel
  ctx.strokeStyle = '#8B5A20'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-6, 2, 6, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = '#6A3A10'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6,-4); ctx.lineTo(-6,8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12,2); ctx.lineTo(0,2); ctx.stroke();
  // Barrel
  ctx.fillStyle = '#2A2A28'; ctx.fillRect(0, -3, 14, 6);
  ctx.fillStyle = '#444440'; ctx.fillRect(0, -2, 12, 4);
  // Muzzle ring
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(13, 0, 3, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  _outline(ctx, x, y, w, h, '#151510');
}

function _drawTowerMage(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#4A3880', '#2A1850', '#6A58A0');
  // Magic glow effect around tower
  const t = Date.now() * 0.002;
  ctx.fillStyle = `rgba(150,80,255,${0.08 + Math.sin(t)*0.05})`;
  ctx.beginPath(); ctx.arc(x + w/2, y + h/2, w*0.6, 0, Math.PI*2); ctx.fill();
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.2));
  ctx.rotate(aimAngle);
  // Floating orb
  ctx.fillStyle = `rgba(160,80,255,${0.7 + Math.sin(t*1.5)*0.3})`;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(220,180,255,0.8)';
  ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI*2); ctx.fill();
  // Orbiting sparkles
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + i * Math.PI * 2/3;
    ctx.fillStyle = '#CC99FF';
    ctx.beginPath(); ctx.arc(Math.cos(a)*9, Math.sin(a)*5, 1.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
  _outline(ctx, x, y, w, h, '#1A0840');
}

function _drawTowerFrost(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#3A6898', '#1A3868', '#5A88B8');
  // Ice crystal effect
  const t = Date.now() * 0.001;
  ctx.fillStyle = `rgba(180,220,255,${0.1 + Math.sin(t)*0.05})`;
  ctx.fillRect(x+1, y+1, w-2, h-2);
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.2));
  ctx.rotate(aimAngle);
  // Snowflake
  ctx.strokeStyle = '#C8E8FF'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 3);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 8); ctx.stroke();
    // Side branches
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(-3, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(3, 3); ctx.stroke();
    ctx.restore();
  }
  // Centre diamond
  ctx.fillStyle = '#E8F8FF';
  ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
  _outline(ctx, x, y, w, h, '#0A1838');
}

function _drawTowerLightning(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#6A5A10', '#4A3A00', '#8A7A30');
  // Lightning glow
  const t = Date.now() * 0.004;
  if (Math.sin(t * 3) > 0.7) {
    ctx.fillStyle = 'rgba(255,240,80,0.2)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.2));
  ctx.rotate(aimAngle);
  // Lightning bolt
  ctx.fillStyle = `rgba(255,220,50,${0.7 + Math.sin(t)*0.3})`;
  ctx.beginPath();
  ctx.moveTo(2, -8); ctx.lineTo(-2, -1); ctx.lineTo(1, -1);
  ctx.lineTo(-3, 8); ctx.lineTo(4, 0); ctx.lineTo(1, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#FFF8C0'; ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
  _outline(ctx, x, y, w, h, '#1A1500');
}

function _drawTowerCatapult(ctx, x, y, w, h, aimAngle) {
  _towerBase(ctx, x, y, w, h, '#6A4A20', '#3A2A10', '#8A6A40');
  ctx.save();
  ctx.translate(x + w/2, y + Math.round(h*0.22));
  ctx.rotate(aimAngle);
  // Catapult frame
  ctx.fillStyle = '#7A5A20'; ctx.fillRect(-8, 0, 16, 4);
  // Main arm
  ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(10, -10); ctx.stroke();
  // Counterweight
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(-6, 6, 5, 0, Math.PI*2); ctx.fill();
  // Sling cup with boulder
  ctx.fillStyle = '#AAA';
  ctx.beginPath(); ctx.arc(10, -10, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(10, -10, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  _outline(ctx, x, y, w, h, '#2A1408');
}

function _drawWatchtower(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Narrow stone column
  ctx.fillStyle = '#8A8878';
  ctx.fillRect(x + Math.round(w*0.2), y + Math.round(h*0.3), Math.round(w*0.6), Math.round(h*0.72));
  // Stone texture
  ctx.fillStyle = '#7A7868';
  ctx.fillRect(x + Math.round(w*0.25), y + Math.round(h*0.38), Math.round(w*0.25), Math.round(h*0.15));
  ctx.fillRect(x + Math.round(w*0.55), y + Math.round(h*0.55), Math.round(w*0.2), Math.round(h*0.15));
  // Wooden platform top
  ctx.fillStyle = '#A07840';
  ctx.fillRect(x + Math.round(w*0.1), y + Math.round(h*0.25), Math.round(w*0.8), Math.round(h*0.1));
  // Planks
  ctx.fillStyle = '#8A5A20';
  ctx.fillRect(x + Math.round(w*0.15), y + Math.round(h*0.27), Math.round(w*0.7), 2);
  // Watchman (tiny figure on top)
  ctx.fillStyle = '#4A3A0A';
  ctx.fillRect(x + Math.round(w*0.4), y + Math.round(h*0.12), 5, 8);
  ctx.fillStyle = '#FDBCB4';
  ctx.beginPath(); ctx.arc(x + Math.round(w*0.42), y + Math.round(h*0.1), 3, 0, Math.PI*2); ctx.fill();
  // Flag
  ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + Math.round(w*0.62), y + 2); ctx.lineTo(x + Math.round(w*0.62), y + 14); ctx.stroke();
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(x + Math.round(w*0.62), y + 2, 8, 5);
  _outline(ctx, x, y, w, h, '#3A2808');
}

function _drawSettlement(ctx, x, y, w, h) {
  _shadow(ctx, x, y, w, h);
  // Ground / courtyard
  ctx.fillStyle = '#9A8058';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Cobblestone courtyard
  ctx.fillStyle = '#8A7048';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2 === 0) {
        ctx.fillRect(x + 3 + col * Math.round((w-6)/4), y + 3 + row * Math.round((h-6)/4),
          Math.round((w-6)/4) - 1, Math.round((h-6)/4) - 1);
      }
    }
  }
  // Main hall body (left 2/3)
  const hallW = Math.round(w * 0.62);
  ctx.fillStyle = '#D4A858';
  ctx.fillRect(x + 2, y + Math.round(h*0.38), hallW, Math.round(h*0.58));
  // Hall roof (tiled)
  ctx.fillStyle = '#7A3A10';
  ctx.fillRect(x + 2, y + 2, hallW, Math.round(h*0.4));
  ctx.fillStyle = '#5A2000';
  ctx.fillRect(x + 3, y + 2, hallW - 2, 2); // ridge
  // Hall window
  _window(ctx, x + 6, y + Math.round(h*0.5));
  // Hall door
  _door(ctx, x + Math.round(hallW*0.4), y + h - 9, '#4A2000');
  // Tower (right side)
  const tx2 = x + hallW + 2;
  const towerW = w - hallW - 4;
  ctx.fillStyle = '#9A9080';
  ctx.fillRect(tx2, y + Math.round(h*0.2), towerW, Math.round(h*0.78));
  // Tower battlements
  ctx.fillStyle = '#7A7060';
  const bsz = Math.round(towerW / 3);
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(tx2 + i * (bsz+1), y + Math.round(h*0.18), bsz, Math.round(h*0.1));
  }
  // Tower window
  _window(ctx, tx2 + Math.round(towerW*0.2), y + Math.round(h*0.4));
  // Banner pole on hall roof
  ctx.strokeStyle = '#5A3A10'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + Math.round(hallW/2), y + 2);
  ctx.lineTo(x + Math.round(hallW/2), y - 8);
  ctx.stroke();
  // Banner flag
  ctx.fillStyle = '#C0392B';
  ctx.fillRect(x + Math.round(hallW/2), y - 8, 10, 7);
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(x + Math.round(hallW/2) + 2, y - 7, 6, 4);
  _outline(ctx, x, y, w, h, '#3A2000');
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
  // Wang tileset for walls (seamless connections)
  if (type === 'wall_wood' || type === 'wall_stone' || type === 'wall_metal') {
    if (drawWallSprite(ctx, type, adjMask, x, y, w)) return;
  }
  // Use pixel-art tile image if loaded
  const img = _bldImgs[type];
  if (img) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  // Fallback: procedural drawing
  const fn = DRAW_FNS[type];
  if (fn) {
    fn(ctx, x, y, w, h, aimAngle, adjMask);
  } else {
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#FFF';
    ctx.font = '8px monospace';
    ctx.fillText(type.slice(0, 4), x + 3, y + h/2);
  }
}
