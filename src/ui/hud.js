import { getResources } from '../resources.js';
import { citizens } from '../citizens/citizen.js';
import { getPhase, getWaveNumber, startWave, getNextFactions, hasIntel } from '../phases/phases.js';
import { FACTIONS } from '../combat/enemies.js';
import { events, EV } from '../engine/events.js';
import { BUILDING_CATEGORIES, BUILDINGS } from '../buildings/registry.js';
import { selectBuildingType, getSelectedType, cancelPlacement } from '../buildings/placement.js';
import { hasResources } from '../resources.js';
import { initZoneToolbar, setZoneTabActive, cancelZoneTool } from './zone_toolbar.js';
import { isBuildingUnlocked } from '../research/research_tree.js';

// ── DOM build panel ──────────────────────────────────────────────────────────
let _root;
let _resBar;
let _waveBtn;
let _waveLabel;
let _intelPanel;
let _selectedTab = 0;

export function initUI() {
  _root = document.getElementById('ui-root');
  _root.innerHTML = '';

  // Resource bar (top)
  _resBar = _el('div', 'res-bar');
  _root.appendChild(_resBar);

  // Wave info (top right)
  const waveInfo = _el('div', 'wave-info');
  _waveLabel = _el('span', 'wave-label');
  _waveLabel.textContent = 'Wave 0';
  _intelPanel = _el('div', 'intel-panel');
  waveInfo.appendChild(_waveLabel);
  waveInfo.appendChild(_intelPanel);
  _root.appendChild(waveInfo);

  // Start wave button
  _waveBtn = _el('button', 'wave-btn');
  _waveBtn.textContent = '⚔ Start Wave';
  _waveBtn.addEventListener('click', () => {
    if (getPhase() === 'planning') startWave();
  });
  _root.appendChild(_waveBtn);

  // Build panel (bottom)
  const panel = _el('div', 'build-panel');
  _buildTabs(panel);
  _root.appendChild(panel);

  // Citizen count (bottom left)
  const citBar = _el('div', 'cit-bar');
  citBar.id = 'cit-bar';
  _root.appendChild(citBar);

  // Game over screen (hidden)
  const go = _el('div', 'gameover-screen hidden');
  go.id = 'gameover-screen';
  _root.appendChild(go);

  // Subscribe to events
  events.on(EV.RESOURCES_CHANGED, _updateResBar);
  events.on(EV.WAVE_START,        _onWaveStart);
  events.on(EV.WAVE_ENDED,        _onWaveEnd);
  events.on(EV.PHASE_CHANGED,     _onPhaseChanged);
  events.on(EV.GAME_OVER,         _onGameOver);
  events.on(EV.CITIZEN_DIED,      _updateCitBar);
  events.on(EV.ENEMY_DIED,        _onEnemyKill);

  _updateResBar(getResources());
  _updateCitBar();
  _updateIntel();
}

const ZONE_TAB_IDX = BUILDING_CATEGORIES.length; // last tab index

function _buildTabs(panel) {
  const tabRow  = _el('div', 'tab-row');
  const tabBody = _el('div', 'tab-body');
  panel.appendChild(tabRow);
  panel.appendChild(tabBody);

  const allTabs = [...BUILDING_CATEGORIES, { label: '🗺 Zones', types: null }];

  allTabs.forEach((cat, i) => {
    const tab = _el('button', 'tab-btn' + (i === 0 ? ' active' : ''));
    tab.textContent = cat.label;
    tab.addEventListener('click', () => {
      _selectedTab = i;
      document.querySelectorAll('.tab-btn').forEach((t, j) =>
        t.classList.toggle('active', j === i));

      const isZone = i === ZONE_TAB_IDX;
      setZoneTabActive(isZone);
      if (isZone) {
        _renderZoneTabBody(tabBody);
      } else {
        cancelZoneTool();
        _renderTabBody(tabBody, cat.types);
      }
    });
    tabRow.appendChild(tab);
  });

  _renderTabBody(tabBody, BUILDING_CATEGORIES[0].types);
}

function _renderZoneTabBody(body) {
  body.innerHTML = '';
  // Let zone_toolbar inject its buttons into the tab body
  initZoneToolbar(body);
}

function _renderTabBody(body, types) {
  body.innerHTML = '';
  const res = getResources();

  types.forEach(type => {
    const def = BUILDINGS[type];
    if (!def) return;

    const unlocked  = isBuildingUnlocked(type);
    const btn       = _el('button', 'build-btn');
    const canAfford = unlocked && hasResources(def.cost);

    if (!unlocked)   btn.classList.add('locked');
    if (!canAfford && unlocked) btn.classList.add('cant-afford');
    if (getSelectedType() === type) btn.classList.add('selected');
    if (!unlocked) btn.disabled = true;

    const costStr = Object.entries(def.cost)
      .map(([k, v]) => `${_resIcon(k)}${v}`)
      .join(' ') || 'Free';

    btn.innerHTML = unlocked
      ? `<span class="btn-label">${def.label}</span><span class="btn-cost">${costStr}</span>`
      : `<span class="btn-label">🔒 ${def.label}</span><span class="btn-cost">Research required</span>`;

    btn.title = def.desc ?? '';

    btn.addEventListener('click', () => {
      if (!unlocked) return;
      if (getSelectedType() === type) {
        cancelPlacement();
      } else {
        selectBuildingType(type);
      }
      _renderTabBody(body, types);
    });

    body.appendChild(btn);
  });
}

// ── Canvas HUD (drawn each frame) ─────────────────────────────────────────────
export function renderUI(ctx, W, H) {
  // Citizen bar text update each frame (cheap)
  const citEl = document.getElementById('cit-bar');
  if (citEl) citEl.textContent = `👥 ${citizens.length} citizens`;
}

// ── Event handlers ─────────────────────────────────────────────────────────────
function _updateResBar(res) {
  if (!_resBar) return;
  const base = `🪵<b>${res.wood??0}</b> 🪨<b>${res.stone??0}</b> 🌾<b>${res.food??0}</b> 🪙<b>${res.gold??0}</b>`;
  const processed = [
    res.iron   > 0 ? `⛏<b>${res.iron}</b>`    : '',
    res.planks > 0 ? `🪵→<b>${res.planks}pl</b>` : '',
    res.bricks > 0 ? `🧱<b>${res.bricks}</b>`  : '',
    res.flour  > 0 ? `🌾→<b>${res.flour}fl</b>` : '',
    res.bread  > 0 ? `🍞<b>${res.bread}</b>`   : '',
    res.steel  > 0 ? `⚙<b>${res.steel}</b>`   : '',
  ].filter(Boolean).join(' ');
  _resBar.innerHTML = base + (processed ? `&nbsp;&nbsp;│&nbsp;&nbsp;${processed}` : '');
}

function _updateCitBar() {
  const el = document.getElementById('cit-bar');
  if (el) el.textContent = `👥 ${citizens.length} citizens`;
}

let _gold = 0;
function _onEnemyKill({ reward }) {
  _gold += reward;
}

function _onWaveStart({ wave }) {
  _waveLabel.textContent = `Wave ${wave}`;
  _waveBtn.disabled = true;
  _waveBtn.textContent = '⚔ Wave in progress…';
}

function _onWaveEnd({ wave }) {
  _waveLabel.textContent = `Wave ${wave} complete!`;
  _waveBtn.disabled = false;
  _waveBtn.textContent = '⚔ Start Wave';
  _updateIntel();
  // Refresh build panel costs
  const body = document.querySelector('.tab-body');
  if (body) _renderTabBody(body, BUILDING_CATEGORIES[_selectedTab].types);
}

function _onPhaseChanged({ phase }) {
  _waveBtn.style.display = phase === 'gameover' ? 'none' : 'block';
}

function _updateIntel() {
  if (!_intelPanel) return;
  const intel = hasIntel();
  const next  = getNextFactions();
  if (intel && next.length > 0) {
    const names = next.map(f => FACTIONS[f]?.label ?? f).join(', ');
    _intelPanel.textContent = `🔭 Next: ${names}`;
    _intelPanel.className = 'intel-panel visible';
  } else {
    _intelPanel.textContent = '';
    _intelPanel.className = 'intel-panel';
  }
}

function _onGameOver({ wave, reason }) {
  const el = document.getElementById('gameover-screen');
  if (!el) return;
  el.classList.remove('hidden');

  const reasons = {
    settlement_destroyed: 'Your Settlement Hall was destroyed.',
    no_citizens:          'All citizens have perished.',
  };

  el.innerHTML = `
    <div class="go-card">
      <h1>💀 Colony Lost</h1>
      <p>Survived <b>${wave}</b> wave${wave !== 1 ? 's' : ''}.</p>
      <p class="go-reason">${reasons[reason] ?? reason}</p>
      <button onclick="location.reload()">↩ Play Again</button>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function _resIcon(key) {
  return { wood: '🪵', stone: '🪨', food: '🌾', gold: '🪙' }[key] ?? '';
}
