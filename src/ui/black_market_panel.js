// Black Market Panel — two tabs: Industry / Defence
// Click a Black Market building to open.

import { RESEARCH, canResearch, isUnlocked, research } from '../research/research_tree.js';
import { getResources, spendResources, hasResources } from '../resources.js';

let _panel   = null;
let _open    = false;
let _activeTab = 'industry';

export function openBlackMarket() {
  if (_open) return;
  _open = true;
  _panel.style.display = 'flex';
  _render();
}

export function closeBlackMarket() {
  if (!_open) return;
  _open = false;
  _panel.style.display = 'none';
}

export function isBlackMarketOpen() { return _open; }

// ── Init ──────────────────────────────────────────────────────
export function initBlackMarketPanel(uiRoot) {
  _panel = document.createElement('div');
  _panel.id = 'bm-panel';
  _panel.style.display = 'none';
  _panel.innerHTML = `
    <div class="bm-header">
      <span>🕵️ Black Market</span>
      <button id="bm-close">✕</button>
    </div>
    <p class="bm-sub">Spend gold to unlock blueprints. Some require earlier research.</p>
    <div class="bm-tabs">
      <button class="bm-tab active" data-tab="industry">⚙️ Industry</button>
      <button class="bm-tab" data-tab="defence">🏹 Defence</button>
    </div>
    <div id="bm-body"></div>
  `;
  uiRoot.appendChild(_panel);

  document.getElementById('bm-close').addEventListener('click', closeBlackMarket);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && _open) closeBlackMarket(); });

  _panel.querySelectorAll('.bm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      _panel.querySelectorAll('.bm-tab').forEach(b => b.classList.toggle('active', b === btn));
      _render();
    });
  });
}

// ── Render ────────────────────────────────────────────────────
function _render() {
  const body = document.getElementById('bm-body');
  if (!body) return;

  const nodes = Object.values(RESEARCH).filter(n => n.tab === _activeTab);
  const gold  = getResources().gold ?? 0;

  // Group by era
  const eras = [1, 2, 3];
  const eraLabels = { 1: 'Era I — Village', 2: 'Era II — Industry', 3: 'Era III — Engineering' };

  body.innerHTML = eras.map(era => {
    const eraNodes = nodes.filter(n => n.era === era);
    if (!eraNodes.length) return '';

    const cards = eraNodes.map(n => {
      const unlocked  = isUnlocked(n.id);
      const available = canResearch(n.id);
      const canAfford = gold >= n.cost;
      const blocked   = !available && !unlocked;

      let statusClass = '';
      if (unlocked)        statusClass = 'bm-done';
      else if (blocked)    statusClass = 'bm-locked';
      else if (!canAfford) statusClass = 'bm-poor';

      const reqText = n.requires.length
        ? `<span class="bm-req">Requires: ${n.requires.map(r => RESEARCH[r]?.label ?? r).join(', ')}</span>`
        : '';

      const unlockText = n.unlocks.length
        ? `<span class="bm-unlocks">Unlocks: ${n.unlocks.join(', ')}</span>`
        : '';

      const effectText = n.effect
        ? `<span class="bm-effect">Effect: ${_effectLabel(n.effect)}</span>`
        : '';

      const btn = unlocked
        ? `<button class="bm-buy done" disabled>✓ Researched</button>`
        : blocked
          ? `<button class="bm-buy locked" disabled>🔒 Locked</button>`
          : `<button class="bm-buy ${canAfford ? '' : 'poor'}" data-id="${n.id}" ${canAfford ? '' : 'disabled'}>
               Buy — ${n.cost}g
             </button>`;

      return `
        <div class="bm-card ${statusClass}">
          <div class="bm-card-title">${n.label}</div>
          <div class="bm-card-desc">${n.desc}</div>
          <div class="bm-card-meta">${reqText}${unlockText}${effectText}</div>
          ${btn}
        </div>
      `;
    }).join('');

    return `
      <div class="bm-era">
        <div class="bm-era-label">${eraLabels[era]}</div>
        <div class="bm-era-cards">${cards}</div>
      </div>
    `;
  }).join('');

  // Wire buy buttons
  body.querySelectorAll('.bm-buy[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ok = research(id, spendResources, hasResources);
      if (ok) _render();
    });
  });
}

function _effectLabel(effect) {
  const map = {
    cottage_cap_2:   'Cottages house 2 citizens',
    cottage_cap_4:   'Cottages house 4 citizens',
    stone_wall_hp:   'Stone walls +50% HP',
    archer_firerate: 'Archers fire 30% faster',
    cannon_range:    'Cannon range +20%',
    mage_damage:     'Mage damage +40%',
    lightning_chain: 'Lightning chains to 5 enemies',
    all_wall_hp:     'All walls +25% HP',
    mage_chain:      'Mage chains to 2 enemies',
  };
  return map[effect] ?? effect;
}
