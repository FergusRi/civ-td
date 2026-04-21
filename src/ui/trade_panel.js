// Trade Terminal panel — open by clicking the trade_terminal building
// Prices fluctuate ±20% each wave. Sell resources for gold.

import { getResources, spendResources, addResources } from '../resources.js';

const BASE_PRICES = { wood: 2, stone: 3, food: 1, iron: 4 };
let _prices = { ...BASE_PRICES };
let _panel  = null;
let _open   = false;

// ── Price fluctuation (call on wave end) ─────────────────────────────────────
export function fluctuatePrices() {
  for (const res of Object.keys(BASE_PRICES)) {
    const swing = 0.8 + Math.random() * 0.4; // 0.8–1.2
    _prices[res] = Math.max(1, Math.round(BASE_PRICES[res] * swing));
  }
  if (_open) _refreshPanel();
}

export function getPrices() { return { ..._prices }; }

// ── Open / close ──────────────────────────────────────────────────────────────
export function openTradePanel() {
  if (_open) return;
  _open = true;
  _panel.style.display = 'flex';
  _refreshPanel();
}

export function closeTradePanel() {
  if (!_open) return;
  _open = false;
  _panel.style.display = 'none';
}

export function isTradeOpen() { return _open; }

// ── Init ──────────────────────────────────────────────────────────────────────
export function initTradePanel(uiRoot) {
  _panel = document.createElement('div');
  _panel.id = 'trade-panel';
  _panel.innerHTML = `
    <div class="trade-header">
      <span>🏪 Trade Terminal</span>
      <button id="trade-close">✕</button>
    </div>
    <p class="trade-sub">Sell your resources for gold. Prices reset each wave.</p>
    <div id="trade-rows"></div>
  `;
  _panel.style.display = 'none';
  uiRoot.appendChild(_panel);

  document.getElementById('trade-close').addEventListener('click', closeTradePanel);

  // Escape closes panel
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _open) closeTradePanel();
  });
}

// ── Render rows ───────────────────────────────────────────────────────────────
function _refreshPanel() {
  const container = document.getElementById('trade-rows');
  if (!container) return;
  const res = getResources();

  const rows = Object.entries(BASE_PRICES)
    .filter(([r]) => res[r] !== undefined)
    .map(([r]) => {
      const have  = res[r] ?? 0;
      const price = _prices[r] ?? BASE_PRICES[r];
      const icon  = { wood:'🪵', stone:'🪨', food:'🌾', iron:'⚙️' }[r] ?? '📦';
      return `
        <div class="trade-row" data-res="${r}">
          <span class="trade-icon">${icon}</span>
          <span class="trade-name">${_cap(r)}</span>
          <span class="trade-have">x${have}</span>
          <span class="trade-price">= ${price}g each</span>
          <div class="trade-btns">
            <button class="sell-btn" data-res="${r}" data-amt="1"  ${have<1?'disabled':''}>Sell 1</button>
            <button class="sell-btn" data-res="${r}" data-amt="5"  ${have<5?'disabled':''}>Sell 5</button>
            <button class="sell-btn" data-res="${r}" data-amt="all" ${have<1?'disabled':''}>Sell All</button>
          </div>
        </div>
      `;
    }).join('');

  container.innerHTML = rows;

  container.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r   = btn.dataset.res;
      const raw = btn.dataset.amt;
      const have = getResources()[r] ?? 0;
      const amt  = raw === 'all' ? have : parseInt(raw, 10);
      if (amt <= 0 || have < amt) return;
      const gold = amt * (_prices[r] ?? BASE_PRICES[r]);
      spendResources({ [r]: amt });
      addResources({ gold });
      _refreshPanel();
    });
  });
}

function _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
