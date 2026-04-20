// Continent / region selector — shown before the game starts
// Player picks where on Earth to settle, then the game boots with that region centred.

import { getEarthRegions, setEarthRegion } from '../world/map.js';

// Region emoji flags / icons
const REGION_ICONS = {
  north_america: '🌎',
  south_america: '🌎',
  europe:        '🌍',
  africa:        '🌍',
  asia:          '🌏',
  oceania:       '🌏',
};

const REGION_DESC = {
  north_america: 'Vast forests & plains. Goblin hordes from the north.',
  south_america: 'Dense jungle terrain. Dark Elf raiders from the east.',
  europe:        'Rolling hills & stone. Undead rise from the south.',
  africa:        'Arid savanna & sand. Stone Giants from the northwest.',
  asia:          'Mountains & rivers. Orc warbands from the west.',
  oceania:       'Island coasts & scrub. Shadow Cult from any direction.',
};

let _onSelect = null;

export function showRegionSelect(onSelect) {
  _onSelect = onSelect;

  // Overlay container
  const overlay = document.createElement('div');
  overlay.id = 'region-select-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: linear-gradient(160deg, #0a1520 0%, #1a2a3a 50%, #0d1a10 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Georgia', serif; color: #E8D8A0;
    overflow: hidden;
  `;

  // Starfield canvas
  const stars = document.createElement('canvas');
  stars.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0.4;';
  overlay.appendChild(stars);
  _drawStars(stars);

  // Title
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 2.4rem; font-weight: bold; letter-spacing: 4px;
    text-shadow: 0 0 20px rgba(200,160,40,0.8); margin-bottom: 8px;
    position: relative;
  `;
  title.textContent = '⚔ CIV-TD';
  overlay.appendChild(title);

  const sub = document.createElement('div');
  sub.style.cssText = `
    font-size: 1rem; color: #A09060; letter-spacing: 2px;
    margin-bottom: 40px; position: relative;
  `;
  sub.textContent = 'CHOOSE YOUR HOMELAND';
  overlay.appendChild(sub);

  // Mini Earth preview canvas
  const earthWrap = document.createElement('div');
  earthWrap.style.cssText = 'position:relative;margin-bottom:36px;';
  const earthCanvas = document.createElement('canvas');
  earthCanvas.width  = 500;
  earthCanvas.height = 250;
  earthCanvas.style.cssText = `
    border: 2px solid rgba(200,160,40,0.4);
    border-radius: 4px;
    box-shadow: 0 0 30px rgba(0,80,160,0.5);
  `;
  earthWrap.appendChild(earthCanvas);
  overlay.appendChild(earthWrap);

  // Region cards grid
  const grid = document.createElement('div');
  grid.style.cssText = `
    display: flex; flex-wrap: wrap; gap: 14px;
    justify-content: center; max-width: 700px;
    position: relative;
  `;

  const regions = getEarthRegions();
  let hoveredCanvas = null;

  regions.forEach(region => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(10,20,30,0.7);
      border: 2px solid rgba(180,140,30,0.3);
      border-radius: 8px; padding: 14px 20px;
      cursor: pointer; transition: all 0.15s;
      min-width: 180px; text-align: center;
      backdrop-filter: blur(4px);
    `;

    card.innerHTML = `
      <div style="font-size:2rem;margin-bottom:6px">${REGION_ICONS[region.id] ?? '🌐'}</div>
      <div style="font-size:1rem;font-weight:bold;color:#E8D890;margin-bottom:4px">${region.label}</div>
      <div style="font-size:0.72rem;color:#7A8A6A;line-height:1.4">${REGION_DESC[region.id] ?? ''}</div>
    `;

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'rgba(255,200,60,0.9)';
      card.style.background  = 'rgba(30,50,20,0.8)';
      card.style.transform   = 'scale(1.04)';
      _highlightRegion(earthCanvas, regions, region);
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'rgba(180,140,30,0.3)';
      card.style.background  = 'rgba(10,20,30,0.7)';
      card.style.transform   = 'scale(1)';
      _drawEarthPreview(earthCanvas, regions, null);
    });
    card.addEventListener('click', () => {
      _selectRegion(overlay, region.id);
    });

    grid.appendChild(card);
  });

  overlay.appendChild(grid);

  // Classic mode button
  const classic = document.createElement('div');
  classic.style.cssText = `
    margin-top: 28px; font-size: 0.85rem; color: #607060;
    cursor: pointer; text-decoration: underline; position: relative;
  `;
  classic.textContent = 'Or play on a classic noise-generated map';
  classic.addEventListener('click', () => _selectRegion(overlay, null));
  overlay.appendChild(classic);

  document.body.appendChild(overlay);

  // Draw initial earth preview
  _drawEarthPreview(earthCanvas, regions, null);
}

function _selectRegion(overlay, regionId) {
  setEarthRegion(regionId);
  // Fade out
  overlay.style.transition = 'opacity 0.4s';
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.remove();
    if (_onSelect) _onSelect(regionId);
  }, 420);
}

// Draw a tiny Earth pixel map on the canvas
function _drawEarthPreview(canvas, regions, highlight) {
  import('../world/earth_mask.js').then(({ getEarthMask, EARTH_MASK_W, EARTH_MASK_H }) => {
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Ocean background
    ctx.fillStyle = '#1A3A5A';
    ctx.fillRect(0, 0, cw, ch);

    const mask = getEarthMask();
    const pw = cw / EARTH_MASK_W;
    const ph = ch / EARTH_MASK_H;

    // Land
    for (let ty = 0; ty < EARTH_MASK_H; ty++) {
      for (let tx = 0; tx < EARTH_MASK_W; tx++) {
        if (mask[ty * EARTH_MASK_W + tx]) {
          ctx.fillStyle = highlight ? '#3A5A2A' : '#4A6A3A';
          ctx.fillRect(tx * pw, ty * ph, pw, ph);
        }
      }
    }

    // Draw region dots
    for (const r of regions) {
      const rx = r.tx * pw + pw / 2;
      const ry = r.ty * ph + ph / 2;
      const isHl = highlight && r.id === highlight.id;

      ctx.fillStyle = isHl ? '#FFD700' : 'rgba(255,200,60,0.6)';
      ctx.beginPath();
      ctx.arc(rx, ry, isHl ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (isHl) {
        // Pulse ring
        ctx.strokeStyle = 'rgba(255,220,80,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#FFE060';
        ctx.font = 'bold 11px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(r.label, rx, ry - 11);
      }
    }
  });
}

function _highlightRegion(canvas, regions, region) {
  _drawEarthPreview(canvas, regions, region);
}

function _drawStars(canvas) {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFF';
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = Math.random() * 1.5;
    ctx.globalAlpha = 0.3 + Math.random() * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
