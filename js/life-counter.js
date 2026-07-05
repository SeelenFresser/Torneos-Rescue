// ═══════════════════════════════════════════════════════════════════
// MTG LIFE COUNTER — Rescue TCG
// Pantalla completa integrada en la app principal
// Soporta 1-8 jugadores, vida configurable, rotación por posición
// ═══════════════════════════════════════════════════════════════════

const LC_COLORS = [
  { bg:'#1A0020', accent:'#C060FF', text:'#E8C8FF' },
  { bg:'#001A20', accent:'#20D8FF', text:'#B0F0FF' },
  { bg:'#200800', accent:'#FF7020', text:'#FFD0A0' },
  { bg:'#001A08', accent:'#30E870', text:'#A0FFB8' },
  { bg:'#1A1000', accent:'#FFD020', text:'#FFF0A0' },
  { bg:'#1A0008', accent:'#FF3070', text:'#FFB0C8' },
  { bg:'#000E1A', accent:'#3090FF', text:'#A8D0FF' },
  { bg:'#0E001A', accent:'#FF60D0', text:'#FFB8F0' },
];

// Rotación de cada panel según posición (en grados)
const LC_ROTATIONS = {
  1:[0], 2:[180,0], 3:[180,0,0],
  4:[180,180,0,0], 5:[180,180,180,0,0],
  6:[180,180,180,0,0,0],
  7:[180,180,180,180,0,0,0],
  8:[180,180,180,180,0,0,0,0],
};

// Estado del contador
let lcState = {
  screen: 'setup',   // 'setup' | 'game'
  playerCount: 4,
  startLife: 40,
  players: [],
  editingIdx: -1,
  history: [],
  future: [],
  rollResult: null,
  isRolling: false,
};

let lcHoldTimers = {};
let lcDeltaValues = {};
let lcDeltaTimers = {};
let lcWakeLock = null;

// ── CICLO DE VIDA ─────────────────────────────────────────────────

function openLifeCounter() {
  AudioFX && AudioFX.tap && AudioFX.tap();
  showScreen('screen-life-counter');
  lcRenderSetup();
  // Mantener pantalla encendida
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen')
      .then(lock => { lcWakeLock = lock; })
      .catch(() => {});
  }
}

function closeLifeCounter() {
  if (lcWakeLock) { lcWakeLock.release(); lcWakeLock = null; }
  Object.values(lcHoldTimers).forEach(clearTimeout);
  goToDashboard();
}

// ── SETUP ─────────────────────────────────────────────────────────

function lcRenderSetup() {
  const el = document.getElementById('lc-content');
  if (!el) return;

  const playerNums = [1,2,3,4,5,6,7,8];
  const livesOpts = [20,30,40];

  el.innerHTML = `
    <div class="lc-setup">
      <div class="lc-setup-header">
        <div class="lc-logo-text">Rescue TCG</div>
        <div class="lc-title">Contador de Vida</div>
        <div class="lc-subtitle">Magic: The Gathering</div>
      </div>

      <div class="lc-section">
        <div class="lc-label">Número de jugadores</div>
        <div class="lc-btn-grid lc-players-grid">
          ${playerNums.map(n => `
            <button class="lc-opt-btn ${lcState.playerCount===n?'lc-active':''}"
              onclick="lcState.playerCount=${n};lcRenderSetup()">
              ${n}
            </button>`).join('')}
        </div>
      </div>

      <div class="lc-section">
        <div class="lc-label">Vida inicial</div>
        <div class="lc-btn-grid lc-lives-grid">
          ${livesOpts.map(l => `
            <button class="lc-opt-btn ${lcState.startLife===l?'lc-active':''}"
              onclick="lcState.startLife=${l};lcRenderSetup()">
              ${l}
            </button>`).join('')}
        </div>
      </div>

      <div class="lc-section">
        <button class="lc-random-btn" onclick="lcRollRandom()"
          ${lcState.isRolling?'disabled':''}>
          🎲 Elegir jugador inicial
        </button>
        ${lcState.rollResult ? `
          <div class="lc-roll-result">${lcState.rollResult}</div>` : ''}
      </div>

      <button class="lc-start-btn" onclick="lcStartGame()">
        ▶ Iniciar partida
      </button>
    </div>
  `;
}

function lcRollRandom() {
  lcState.isRolling = true;
  lcState.rollResult = null;
  lcRenderSetup();

  let count = 0;
  const total = 18;
  let last = 1;
  const timer = setInterval(() => {
    last = Math.floor(Math.random() * lcState.playerCount) + 1;
    lcState.rollResult = `🎲 Jugador ${last}`;
    const el = document.querySelector('.lc-roll-result');
    if (el) el.textContent = lcState.rollResult;
    count++;
    if (count >= total) {
      clearInterval(timer);
      lcState.isRolling = false;
      lcState.rollResult = `⚡ ¡Comienza Jugador ${last}!`;
      lcRenderSetup();
    }
  }, 80);
}

// ── INICIAR PARTIDA ───────────────────────────────────────────────

function lcStartGame() {
  lcState.players = Array.from({length: lcState.playerCount}, (_, i) => ({
    id: i,
    name: `Jugador ${i+1}`,
    life: lcState.startLife,
    eliminated: false,
  }));
  lcState.history = [];
  lcState.future = [];
  lcState.editingIdx = -1;
  lcDeltaValues = {};
  lcState.screen = 'game';

  // Intentar modo landscape
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }

  lcRenderGame();
}

// ── RENDER GAME ───────────────────────────────────────────────────

function lcRenderGame() {
  const el = document.getElementById('lc-content');
  if (!el) return;

  const n = lcState.players.length;
  const rots = LC_ROTATIONS[n] || LC_ROTATIONS[4];

  const panels = lcState.players.map((p, i) => {
    const rot = rots[i] || 0;
    const c = LC_COLORS[i % LC_COLORS.length];
    const lifeColor = p.life <= 5 ? '#FF3D3D'
                    : p.life <= 10 ? '#FF8020'
                    : c.accent;

    return `
      <div class="lc-panel ${p.eliminated?'lc-eliminated':''} lc-p${n}"
           style="background:${c.bg};border-color:${c.accent}22">
        <div class="lc-panel-inner" style="transform:rotate(${rot}deg)">
          <div class="lc-name-row">
            <span class="lc-name" style="color:${c.text}">${escHtml(p.name)}</span>
            <button class="lc-edit-btn" onclick="lcOpenEdit(${i})" style="color:${c.accent}">✏️</button>
          </div>

          <div class="lc-life-wrap">
            <div class="lc-life" id="lc-life-${i}" style="color:${lifeColor}">${p.life}</div>
            <div class="lc-delta" id="lc-delta-${i}"></div>
          </div>

          ${p.eliminated ? `<div class="lc-elim-badge">ELIMINADO</div>` : ''}

          <div class="lc-btns">
            <button class="lc-life-btn lc-minus" style="color:${c.accent};border-color:${c.accent}"
              onclick="lcChange(${i},-1)"
              onpointerdown="lcStartHold(${i},-1)"
              onpointerup="lcStopHold(${i})"
              onpointerleave="lcStopHold(${i})">−</button>
            <button class="lc-life-btn lc-plus" style="color:${c.accent};border-color:${c.accent}"
              onclick="lcChange(${i},+1)"
              onpointerdown="lcStartHold(${i},+1)"
              onpointerup="lcStopHold(${i})"
              onpointerleave="lcStopHold(${i})">+</button>
          </div>
        </div>
      </div>`;
  }).join('');

  const editModal = lcState.editingIdx >= 0 ? lcEditModal() : '';

  el.innerHTML = `
    <div class="lc-topbar">
      <button class="lc-top-btn" onclick="lcUndo()">↩</button>
      <button class="lc-top-btn" onclick="lcRedo()">↪</button>
      <span class="lc-top-title">⚔️ MTG</span>
      <button class="lc-top-btn" onclick="lcReset()">↺ Reiniciar</button>
      <button class="lc-top-btn" onclick="lcBackToSetup()">⚙</button>
    </div>
    <div class="lc-grid lc-grid-${n}">${panels}</div>
    ${editModal}
  `;
}

// ── CAMBIO DE VIDA ────────────────────────────────────────────────

function lcSaveHistory() {
  lcState.history.push(JSON.parse(JSON.stringify(lcState.players)));
  if (lcState.history.length > 60) lcState.history.shift();
  lcState.future = [];
}

function lcChange(idx, delta) {
  lcSaveHistory();
  const p = lcState.players[idx];
  p.life += delta;
  p.eliminated = p.life <= 0;

  // Actualizar solo el número (sin re-render completo → sin parpadeo)
  const lifeEl = document.getElementById('lc-life-' + idx);
  const c = LC_COLORS[idx % LC_COLORS.length];
  if (lifeEl) {
    const lifeColor = p.life <= 5 ? '#FF3D3D' : p.life <= 10 ? '#FF8020' : c.accent;
    lifeEl.textContent = p.life;
    lifeEl.style.color = lifeColor;
    lifeEl.classList.remove('lc-bump-up', 'lc-bump-down');
    void lifeEl.offsetWidth;
    lifeEl.classList.add(delta > 0 ? 'lc-bump-up' : 'lc-bump-down');
  }

  // Delta flotante
  lcDeltaValues[idx] = (lcDeltaValues[idx] || 0) + delta;
  clearTimeout(lcDeltaTimers[idx]);
  lcDeltaTimers[idx] = setTimeout(() => { lcDeltaValues[idx] = 0; }, 1500);
  const deltaEl = document.getElementById('lc-delta-' + idx);
  if (deltaEl) {
    const v = lcDeltaValues[idx];
    deltaEl.textContent = (v > 0 ? '+' : '') + v;
    deltaEl.style.color = delta > 0 ? '#30E870' : '#FF4040';
    deltaEl.classList.remove('lc-delta-anim');
    void deltaEl.offsetWidth;
    deltaEl.classList.add('lc-delta-anim');
  }

  // Panel eliminado
  const panel = document.querySelector(`.lc-panel:nth-child(${idx+1})`);
  if (panel) panel.classList.toggle('lc-eliminated', p.eliminated);

  if (navigator.vibrate) navigator.vibrate(delta > 0 ? 15 : 35);
}

function lcStartHold(idx, delta) {
  let speed = 400, count = 0;
  function tick() {
    lcChange(idx, delta);
    count++;
    speed = count > 8 ? 80 : count > 3 ? 180 : 350;
    lcHoldTimers[idx] = setTimeout(tick, speed);
  }
  lcHoldTimers[idx] = setTimeout(tick, 600);
}

function lcStopHold(idx) { clearTimeout(lcHoldTimers[idx]); }

function lcUndo() {
  if (!lcState.history.length) return;
  lcState.future.push(JSON.parse(JSON.stringify(lcState.players)));
  lcState.players = lcState.history.pop();
  lcRenderGame();
}

function lcRedo() {
  if (!lcState.future.length) return;
  lcState.history.push(JSON.parse(JSON.stringify(lcState.players)));
  lcState.players = lcState.future.pop();
  lcRenderGame();
}

function lcReset() {
  if (!confirm('¿Reiniciar la partida?')) return;
  lcState.players = lcState.players.map((p, i) => ({
    ...p, life: lcState.startLife, eliminated: false
  }));
  lcState.history = [];
  lcState.future = [];
  lcDeltaValues = {};
  lcRenderGame();
}

function lcBackToSetup() {
  lcState.screen = 'setup';
  lcRenderSetup();
}

// ── EDITAR NOMBRE ─────────────────────────────────────────────────

function lcOpenEdit(idx) {
  lcState.editingIdx = idx;
  lcRenderGame();
  setTimeout(() => {
    const inp = document.getElementById('lc-name-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 60);
}

function lcCloseEdit() { lcState.editingIdx = -1; lcRenderGame(); }

function lcConfirmEdit() {
  const inp = document.getElementById('lc-name-input');
  if (inp) {
    const val = inp.value.trim();
    if (val) lcState.players[lcState.editingIdx].name = val;
  }
  lcCloseEdit();
}

function lcEditModal() {
  const p = lcState.players[lcState.editingIdx];
  return `
    <div class="lc-overlay" onclick="lcCloseEdit()">
      <div class="lc-modal" onclick="event.stopPropagation()">
        <div class="lc-modal-title">Editar nombre</div>
        <input class="lc-modal-input" id="lc-name-input" type="text" maxlength="20"
          value="${escHtml(p?.name || '')}" placeholder="Nombre del jugador"
          onkeydown="if(event.key==='Enter')lcConfirmEdit()">
        <div class="lc-modal-btns">
          <button class="lc-modal-btn lc-cancel" onclick="lcCloseEdit()">Cancelar</button>
          <button class="lc-modal-btn lc-confirm" onclick="lcConfirmEdit()">Guardar</button>
        </div>
      </div>
    </div>`;
}
