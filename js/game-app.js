// =============================================
// GAME APP — Contador de vida, dados, comandante
// Con audio y sin scroll
// =============================================

let gameState = {
  tournament: null, players: [], myPlayer: null,
  lifePoints: {}, commanderDmg: {},
  activeGame: 'life', freeMode: false,
  freePlayers: null, startLife: 20
};

// ===== ENTRY POINTS =====
function startGameApp(tournament, players, myPlayer) {
  gameState = { tournament, players, myPlayer, lifePoints: {}, commanderDmg: {}, activeGame: 'life', freeMode: false, startLife: tournament.type==='commander'?40:20 };
  const startLife = gameState.startLife;
  players.forEach(p => { gameState.lifePoints[p.id] = startLife; });
  document.getElementById('game-title').textContent = tournament.name;
  document.getElementById('game-player-name').textContent = myPlayer?.name || '';
  showScreen('screen-game');
  renderGameApp();
}

function openFreeLifeCounter(mode) {
  const startLife = mode === 'commander' ? 40 : 20;
  gameState = {
    tournament: { type: mode }, players: [], myPlayer: null,
    lifePoints: {}, commanderDmg: {}, activeGame: 'life',
    freeMode: true, startLife,
    freePlayers: [
      {id:'fp1',name:'Jugador 1'},{id:'fp2',name:'Jugador 2'},
      {id:'fp3',name:'Jugador 3'},{id:'fp4',name:'Jugador 4'}
    ]
  };
  gameState.freePlayers.forEach(p => { gameState.lifePoints[p.id] = startLife; });
  document.getElementById('game-title').textContent = mode==='commander' ? '🧙 Commander (40)' : '🃏 Standard (20)';
  document.getElementById('game-player-name').textContent = 'Modo libre';
  showScreen('screen-game');
  renderFreeApp();
}

// ===== PARTIDA AMISTOSA BEYBLADE =====
function openFreeBeybladeMatch() {
  AudioFX.tap();
  document.getElementById('game-title').textContent = '🌀 Beyblade';
  document.getElementById('game-player-name').textContent = 'Partida amistosa';
  showScreen('screen-game');

  const content = document.getElementById('game-content');
  content.style.padding = '8px 12px';

  // Pedir nombres antes de iniciar
  gameState = {
    freeMode: true, tournament: { type: 'beyblade' },
    players: [], freePlayers: null,
    lifePoints: {}, commanderDmg: {},
    beyPtsMe: 0, beyPtsOpp: 0,
    beyWinsMe: 0, beyWinsOpp: 0,
    beyBattleLog: [],
    myPlayer: { name: 'Jugador 1' },
    beyOppName: 'Jugador 2',
    activeGame: 'bey'
  };

  content.innerHTML = `
    <div style="max-width:360px;margin:0 auto">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:40px">🌀</div>
        <h2 style="font-size:18px;font-weight:700;margin-top:6px">Partida amistosa</h2>
        <p style="font-size:13px;color:var(--muted);margin-top:4px">Beyblade X · Bo3 · First to 4pts</p>
      </div>
      <div class="section">
        <div class="section-body">
          <label class="label">Tu nombre</label>
          <input class="input" id="bey-p1-name" type="text" placeholder="Jugador 1" value="Jugador 1">
          <label class="label">Oponente</label>
          <input class="input" id="bey-p2-name" type="text" placeholder="Jugador 2" value="Jugador 2">
          <button class="btn btn-primary w-full" onclick="startFreeBeybladeMatch()" style="margin-top:4px">
            🌀 ¡Iniciar partida!
          </button>
        </div>
      </div>
    </div>
  `;
}

function startFreeBeybladeMatch() {
  const p1 = document.getElementById('bey-p1-name')?.value.trim() || 'Jugador 1';
  const p2 = document.getElementById('bey-p2-name')?.value.trim() || 'Jugador 2';
  gameState.myPlayer = { name: p1 };
  gameState.beyOppName = p2;
  gameState.beyPtsMe = 0; gameState.beyPtsOpp = 0;
  gameState.beyWinsMe = 0; gameState.beyWinsOpp = 0;
  gameState.beyBattleLog = [];
  document.getElementById('game-player-name').textContent = p1 + ' vs ' + p2;
  AudioFX.roundStart();
  renderBeyGameApp(document.getElementById('game-content'));
}

function openFreeSpinner() {
  gameState = {
    freeMode: true, tournament: null, activeGame: 'spin',
    lifePoints: {}, commanderDmg: {},
    freePlayers: [
      {id:'fp1',name:'Jugador 1'},{id:'fp2',name:'Jugador 2'},
      {id:'fp3',name:'Jugador 3'},{id:'fp4',name:'Jugador 4'}
    ],
    players: []
  };
  document.getElementById('game-title').textContent = '🎲 Dados & Ruleta';
  document.getElementById('game-player-name').textContent = 'Modo libre';
  showScreen('screen-game');
  const content = document.getElementById('game-content');
  content.style.padding = '8px 12px';

  // Mostrar editor de nombres + spinner
  content.innerHTML = `
    <div class="section" style="margin-bottom:12px">
      <div class="section-head">
        <span class="section-title">👥 Jugadores para la ruleta</span>
      </div>
      <div class="section-body" style="padding:10px 16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px" id="spin-player-names">
          ${gameState.freePlayers.map(p=>`
            <input class="input input-sm" value="${escHtml(p.name)}"
              onchange="updateSpinPlayer('${p.id}',this.value)"
              style="margin-bottom:0">`).join('')}
        </div>
      </div>
    </div>
    <div id="spin-content-area"></div>
  `;
  renderSpinContent(document.getElementById('spin-content-area'));
}

function updateSpinPlayer(id, name) {
  const p = gameState.freePlayers?.find(p=>p.id===id);
  if (p) p.name = name;
}

function leaveGame() {
  const wasFree = gameState.freeMode;
  gameState = { tournament:null, players:[], myPlayer:null, lifePoints:{}, commanderDmg:{}, activeGame:'life', freeMode:false };
  if (wasFree || !currentTournament) showScreen('screen-dashboard');
  else showScreen('screen-tournament');
}


const LIFE_COLORS = [
  { bg: '#1A3A6E', accent: '#4A90D9', text: '#fff', btnMinus: '#1E4D9B', btnPlus: '#2060C0' },  // azul
  { bg: '#6B4A00', accent: '#D4A020', text: '#fff', btnMinus: '#8B6000', btnPlus: '#A07010' },  // dorado
  { bg: '#0D5C3A', accent: '#2ECC71', text: '#fff', btnMinus: '#0A7A4E', btnPlus: '#12A060' },  // verde
  { bg: '#7A1040', accent: '#FF2D8A', text: '#fff', btnMinus: '#A01555', btnPlus: '#C01A65' },  // rosa
  { bg: '#3D0D6B', accent: '#9B30FF', text: '#fff', btnMinus: '#52109A', btnPlus: '#6A20C0' },  // morado
  { bg: '#5C2A00', accent: '#FF7700', text: '#fff', btnMinus: '#7A3800', btnPlus: '#9A4800' },  // naranja
];

// ===== FREE APP LAYOUT =====
function renderFreeApp() {
  const mode = gameState.tournament?.type || 'standard';
  const isCmd = mode === 'commander';
  const content = document.getElementById('game-content');
  content.style.padding = '8px 12px';

  const tabs = isCmd
    ? [['life','❤️ Vida'],['spin','🎲 Dados'],['cmdr','⚔️ Daño Cdr']]
    : [['life','❤️ Vida'],['spin','🎲 Dados']];

  content.innerHTML = `
    <div class="game-tabs" style="margin-bottom:8px">
      ${tabs.map(([id,label]) =>
        `<button class="game-tab ${gameState.activeGame===id?'active':''}"
          onclick="switchFreeTab('${id}')">${label}</button>`
      ).join('')}
    </div>
    <div id="free-tab-body" style="height:calc(100vh - 160px);overflow-y:auto"></div>
  `;
  renderFreeTabContent();
}

function switchFreeTab(tab) {
  AudioFX.tap();
  gameState.activeGame = tab;
  document.querySelectorAll('.game-tab').forEach(b => {
    b.classList.toggle('active',
      (tab==='life'&&b.textContent.includes('❤️'))||
      (tab==='spin'&&b.textContent.includes('🎲'))||
      (tab==='cmdr'&&b.textContent.includes('⚔️'))
    );
  });
  renderFreeTabContent();
}

function renderFreeTabContent() {
  const el = document.getElementById('free-tab-body');
  if (!el) return;
  if (gameState.activeGame === 'life') renderFreeLifeTab(el);
  else if (gameState.activeGame === 'spin') renderSpinContent(el);
  else if (gameState.activeGame === 'cmdr') renderFreeCommanderDmgTab(el);
}

// ===== LIFE COUNTER — NUEVO DISEÑO POR COLORES =====
function renderFreeLifeTab(el) {
  const players = gameState.freePlayers || [];
  const startLife = gameState.startLife || 20;
  const count = players.length;
  const cols = count <= 2 ? 1 : count <= 4 ? 2 : 3;

  // Asignar colores a jugadores
  players.forEach((p, i) => { p._colorIdx = i % LIFE_COLORS.length; });

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
      margin-bottom:8px;padding:0 2px">
      <span style="font-size:11px;color:var(--muted)">${count} jugadores · ${startLife} PV</span>
      <div style="display:flex;gap:5px">
        ${count < 6 ? `<button class="btn btn-xs" onclick="addFreePlayer()">+ Jugador</button>` : ''}
        ${count > 2 ? `<button class="btn btn-xs btn-danger" onclick="removeFreePlayerLast()">−</button>` : ''}
        <button class="btn btn-xs btn-ghost" onclick="resetAllLife()">↺ Reset</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;
      height:calc(100vh - 160px)">
      ${players.map((p,i) => renderColorLifeCard(p, startLife, i)).join('')}
    </div>
  `;
}

function renderColorLifeCard(p, startLife, idx) {
  const life = gameState.lifePoints[p.id] ?? startLife;
  const c = LIFE_COLORS[idx % LIFE_COLORS.length];
  const isDead = life <= 0;
  const isDanger = life <= 5 && life > 0;
  const isWarn = life <= 10 && life > 5;

  // Efecto de pulso en danger
  const cardStyle = `
    background:${c.bg};
    border-radius:16px;
    display:flex;flex-direction:column;
    align-items:center;justify-content:space-between;
    padding:10px 8px 10px;
    position:relative;overflow:hidden;
    opacity:${isDead?'0.5':'1'};
    box-shadow: inset 0 0 40px rgba(0,0,0,0.3);
    border: 2px solid ${isDanger?'#FF4444':isWarn?'#FFA500':c.accent}44;
    min-height:0;
  `;

  return `
    <div style="${cardStyle}" id="card-${p.id}">

      <!-- Glow de fondo -->
      <div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);
        width:120px;height:120px;border-radius:50%;
        background:radial-gradient(circle,${c.accent}30 0%,transparent 70%);
        pointer-events:none"></div>

      <!-- NOMBRE EDITABLE -->
      <input style="background:transparent;border:none;border-bottom:2px solid ${c.accent}60;
        color:${c.accent};font-size:12px;font-weight:800;text-align:center;
        width:90%;outline:none;letter-spacing:0.5px;padding-bottom:2px;
        text-transform:uppercase"
        value="${escHtml(p.name)}"
        onchange="renameFreePlayer('${p.id}',this.value)">

      <!-- BOTÓN + ARRIBA -->
      <button onclick="changeFreeLife('${p.id}',+1)"
        style="width:100%;padding:6px 0;background:${c.btnPlus}88;border:none;
        border-radius:10px;color:#fff;font-size:20px;font-weight:900;
        cursor:pointer;letter-spacing:-1px">+</button>

      <!-- NÚMERO DE VIDA -->
      <div id="life-${p.id}" style="
        font-size:${life >= 100 ? '52px' : life >= 10 ? '64px' : '76px'};
        font-weight:900;color:#fff;line-height:1;
        text-shadow: 0 2px 20px ${c.accent}80;
        transition:font-size 0.1s">
        ${life}
      </div>

      <!-- BOTÓN − ABAJO -->
      <button onclick="changeFreeLife('${p.id}',-1)"
        style="width:100%;padding:6px 0;background:${c.btnMinus}88;border:none;
        border-radius:10px;color:#fff;font-size:20px;font-weight:900;
        cursor:pointer">−</button>

      <!-- CONTROLES EXTRA -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;width:100%;margin-top:4px">
        <button onclick="changeFreeLife('${p.id}',-5)"
          style="padding:5px 0;background:${c.btnMinus}66;border:none;border-radius:8px;
          color:${c.accent};font-size:11px;font-weight:700;cursor:pointer">−5</button>
        <button onclick="changeFreeLife('${p.id}',+5)"
          style="padding:5px 0;background:${c.btnPlus}66;border:none;border-radius:8px;
          color:${c.accent};font-size:11px;font-weight:700;cursor:pointer">+5</button>
      </div>

      <!-- Reset individual -->
      <button onclick="resetOneLife('${p.id}')"
        style="margin-top:4px;padding:3px 10px;background:transparent;border:1px solid ${c.accent}40;
        border-radius:6px;color:${c.accent}80;font-size:10px;cursor:pointer">↺ ${startLife}</button>

      ${isDead ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;border-radius:14px;
        font-size:28px">💀</div>` : ''}
    </div>`;
}

function changeFreeLife(playerId, delta) {
  const start = gameState.startLife || 20;
  gameState.lifePoints[playerId] = (gameState.lifePoints[playerId] ?? start) + delta;
  const life = gameState.lifePoints[playerId];

  // Actualizar número
  const el = document.getElementById('life-' + playerId);
  if (el) {
    el.textContent = life;
    el.style.fontSize = life >= 100 ? '52px' : life >= 10 ? '64px' : '76px';
  }

  // Actualizar borde de la card
  const card = document.getElementById('card-' + playerId);
  if (card) {
    const idx = (gameState.freePlayers||[]).findIndex(p=>p.id===playerId);
    const c = LIFE_COLORS[idx % LIFE_COLORS.length];
    const isDead = life <= 0;
    const isDanger = life <= 5 && life > 0;
    const isWarn = life <= 10 && life > 5;
    card.style.borderColor = (isDanger?'#FF4444':isWarn?'#FFA500':c.accent) + '44';
    card.style.opacity = isDead ? '0.5' : '1';
  }

  if (delta < 0) { life <= 5 ? AudioFX.danger() : AudioFX.minus(); }
  else AudioFX.plus();
}

function applyCustomFreeLife(playerId) {
  const el = document.getElementById('lc-' + playerId);
  const val = parseInt(el?.value);
  if (!isNaN(val)) { changeFreeLife(playerId, val); el.value = ''; }
}

function resetOneLife(playerId) {
  AudioFX.tap();
  gameState.lifePoints[playerId] = gameState.startLife;
  const el = document.getElementById('life-' + playerId);
  if (el) { el.textContent = gameState.startLife; el.className = 'life-num'; }
}

function resetAllLife() {
  AudioFX.roundStart();
  (gameState.freePlayers||[]).forEach(p => {
    gameState.lifePoints[p.id] = gameState.startLife;
    const el = document.getElementById('life-' + p.id);
    if (el) { el.textContent = gameState.startLife; el.className = 'life-num'; }
  });
}

function addFreePlayer() {
  if (!gameState.freePlayers) gameState.freePlayers = [];
  if (gameState.freePlayers.length >= 6) { showToast('Máximo 6 jugadores en una mesa'); return; }
  AudioFX.tap();
  const id = 'fp' + Date.now();
  const num = gameState.freePlayers.length + 1;
  gameState.freePlayers.push({ id, name: `Jugador ${num}` });
  gameState.lifePoints[id] = gameState.startLife;
  if (!gameState.commanderDmg) gameState.commanderDmg = {};
  renderFreeTabContent();
}

function removeFreePlayerLast() {
  if (!gameState.freePlayers || gameState.freePlayers.length <= 2) return;
  AudioFX.tap();
  const last = gameState.freePlayers.pop();
  delete gameState.lifePoints[last.id];
  renderFreeTabContent();
}

function renameFreePlayer(playerId, newName) {
  const p = (gameState.freePlayers||[]).find(p => p.id === playerId);
  if (p) p.name = newName;
}

// ===== SPIN / DADOS =====
let spinInterval = null;

function renderSpinContent(el) {
  const players = gameState.freePlayers?.map(p => p.name) || gameState.players?.map(p => p.name) || ['J1','J2','J3','J4'];
  const isFreeSpinner = !gameState.freePlayers && !gameState.players?.length;
  el.innerHTML = `
    <div class="section" style="margin-bottom:12px">
      <div class="section-head"><span class="section-title">🎲 ¿Quién empieza?</span></div>
      <div class="section-body">
        <div class="spinner-wrap">
          <div class="spinner-result" id="spin-icon" style="font-size:40px">🎲</div>
          <div class="spinner-name" id="spin-name" style="font-size:16px;min-height:24px">Presiona para girar</div>
          <button class="btn btn-primary" style="margin-top:10px" onclick="doSpin()">🎰 Girar</button>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">🎯 Dados</span></div>
      <div class="section-body">
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
          ${[4,6,8,10,12,20].map(n =>
            `<button class="btn" style="min-width:56px" onclick="rollDice(${n})">d${n}</button>`
          ).join('')}
        </div>
        <div style="font-size:56px;font-weight:900;color:var(--cream);text-align:center;margin-top:12px;min-height:68px" id="dice-result"></div>
      </div>
    </div>
  `;
}

function doSpin() {
  AudioFX.roundStart();
  let players = gameState.freePlayers?.map(p=>p.name) || gameState.players?.map(p=>p.name) || [];
  // Si no hay jugadores, usar placeholders
  if (!players.length) players = ['Jugador 1','Jugador 2','Jugador 3','Jugador 4'];
  const nameEl = document.getElementById('spin-name');
  const iconEl = document.getElementById('spin-icon');
  const emojis = ['🐇','⚡','🌀','🔥','✨','💥','🎯','⚔️'];
  let count = 0; const total = 18 + Math.floor(Math.random()*10);
  clearInterval(spinInterval);
  spinInterval = setInterval(() => {
    nameEl.textContent = players[Math.floor(Math.random()*players.length)];
    iconEl.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    count++;
    if (count >= total) {
      clearInterval(spinInterval);
      const winner = players[Math.floor(Math.random()*players.length)];
      nameEl.textContent = '¡' + winner + ' empieza!';
      iconEl.textContent = '👑';
      AudioFX.victory();
    }
  }, 80);
}

function rollDice(sides) {
  AudioFX.tap();
  const result = Math.floor(Math.random()*sides)+1;
  const el = document.getElementById('dice-result');
  if (el) el.textContent = result;
}

// ===== COMMANDER DAMAGE =====
function renderFreeCommanderDmgTab(el) {
  const players = gameState.freePlayers || [];
  if (!gameState.commanderDmg) gameState.commanderDmg = {};
  players.forEach(att => {
    if (!gameState.commanderDmg[att.id]) gameState.commanderDmg[att.id] = {};
    players.forEach(vic => {
      if (att.id !== vic.id && gameState.commanderDmg[att.id][vic.id] === undefined)
        gameState.commanderDmg[att.id][vic.id] = 0;
    });
  });

  el.innerHTML = `<div style="display:grid;gap:10px">
    ${players.map(att => `
      <div class="pod-box">
        <div class="pod-name">⚔️ ${escHtml(att.name)} → (daño a cada oponente)</div>
        ${players.filter(v=>v.id!==att.id).map(vic => {
          const dmg = gameState.commanderDmg[att.id]?.[vic.id]||0;
          const isDead = dmg >= 21;
          return `<div class="cmdr-dmg-row">
            <div class="cmdr-dmg-name">${escHtml(vic.name)}</div>
            <div class="cmdr-dmg-val ${dmg>=16?'danger':''}" id="cdmg-${att.id}-${vic.id}">${dmg}</div>
            <div class="cmdr-dmg-btns">
              <button class="dmg-btn minus" onclick="changeCmdrDmgFree('${att.id}','${vic.id}',-1)">−</button>
              <button class="dmg-btn plus"  onclick="changeCmdrDmgFree('${att.id}','${vic.id}',+1)">+</button>
              <button class="dmg-btn plus"  onclick="changeCmdrDmgFree('${att.id}','${vic.id}',+2)">+2</button>
            </div>
            ${isDead?'<span style="color:var(--red);font-size:11px;font-weight:700">💀 21+</span>':''}
          </div>`;
        }).join('')}
      </div>`).join('')}
  </div>`;
}

function changeCmdrDmgFree(attId, vicId, delta) {
  if (!gameState.commanderDmg[attId]) gameState.commanderDmg[attId] = {};
  const prev = gameState.commanderDmg[attId][vicId]||0;
  const next = Math.max(0, prev + delta);
  gameState.commanderDmg[attId][vicId] = next;
  const el = document.getElementById(`cdmg-${attId}-${vicId}`);
  if (el) { el.textContent = next; el.className = 'cmdr-dmg-val'+(next>=16?' danger':''); }
  if (delta > 0) { next >= 21 ? AudioFX.danger() : AudioFX.minus(); }
  else AudioFX.tap();
  if (next >= 21) showToast('💀 ¡Daño de comandante fatal!');
}

// ===== IN-TOURNAMENT GAME APP =====
function renderGameApp() {
  const t = gameState.tournament;
  const content = document.getElementById('game-content');
  content.style.padding = '8px 12px';
  if (t.type === 'beyblade') { renderBeyGameApp(content); return; }

  const tabs = t.type === 'commander'
    ? [['life','❤️ Vida'],['spin','🎲 Dados'],['cmdr','⚔️ Daño Cdr']]
    : [['life','❤️ Vida'],['spin','🎲 Dados']];

  content.innerHTML = `
    <div class="game-tabs" style="margin-bottom:8px">
      ${tabs.map(([id,label]) =>
        `<button class="game-tab ${gameState.activeGame===id?'active':''}"
          onclick="switchGameTab('${id}')">${label}</button>`
      ).join('')}
    </div>
    <div id="game-tab-content" style="height:calc(100vh - 160px);overflow-y:auto"></div>
  `;
  renderGameTab(gameState.activeGame);
}

function switchGameTab(tab) {
  AudioFX.tap();
  gameState.activeGame = tab;
  document.querySelectorAll('.game-tab').forEach(b => {
    b.classList.toggle('active',
      (tab==='life'&&b.textContent.includes('❤️'))||
      (tab==='spin'&&b.textContent.includes('🎲'))||
      (tab==='cmdr'&&b.textContent.includes('⚔️'))
    );
  });
  renderGameTab(tab);
}

function renderGameTab(tab) {
  const el = document.getElementById('game-tab-content');
  if (!el) return;
  if (tab === 'life') {
    // Use tournament players but same compact layout
    gameState.freePlayers = gameState.players;
    renderFreeLifeTab(el);
  }
  else if (tab === 'spin') renderSpinContent(el);
  else if (tab === 'cmdr') {
    gameState.freePlayers = gameState.players;
    renderFreeCommanderDmgTab(el);
  }
}

// ===== BEYBLADE — Sistema de puntos oficial =====
// Draw=0 · Spin=1 · Burst=2 · Over=2 · Xtreme=3 · primero en 4pts gana la batalla
const BEY_FINISH_TYPES = [
  { key:'draw',    label:'DRAW',    pts:0, color:'#888',    emoji:'🤝' },
  { key:'spin',    label:'SPIN',    pts:1, color:'#2196F3',  emoji:'🌀' },
  { key:'burst',   label:'BURST',   pts:2, color:'#E53935',  emoji:'💥' },
  { key:'over',    label:'OVER',    pts:2, color:'#FF9800',  emoji:'🔥' },
  { key:'xtreme',  label:'XTREME',  pts:3, color:'#9C27B0',  emoji:'⚡' },
];

function renderBeyGameApp(content) {
  gameState.beyPtsMe    = gameState.beyPtsMe    ?? 0;
  gameState.beyPtsOpp   = gameState.beyPtsOpp   ?? 0;
  gameState.beyWinsMe   = gameState.beyWinsMe   ?? 0;
  gameState.beyWinsOpp  = gameState.beyWinsOpp  ?? 0;
  gameState.beyBattleLog = gameState.beyBattleLog ?? [];

  const p1 = escHtml(gameState.myPlayer?.name || 'Jugador 1');
  const p2 = escHtml(gameState.beyOppName || 'Oponente');
  const WIN_PTS = 4;

  content.innerHTML = `
    <!-- MARCADOR PRINCIPAL -->
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:12px">

      <!-- Jugador 1 -->
      <div style="background:linear-gradient(135deg,#0D1B3E,#1565C0);border:2px solid #2196F3;
        border-radius:var(--radius-lg);padding:12px;text-align:center">
        <div style="font-size:12px;font-weight:700;color:#90CAF9;margin-bottom:4px">${p1}</div>
        <div style="font-size:52px;font-weight:900;color:#fff;line-height:1" id="bey-pts-me">${gameState.beyPtsMe}</div>
        <div style="font-size:11px;color:#90CAF9;margin-top:2px">pts esta batalla</div>
        <div style="font-size:18px;font-weight:700;color:#2196F3;margin-top:4px">
          ${'🌀'.repeat(gameState.beyWinsMe)}
          <span style="color:#555">${'○'.repeat(Math.max(0,2-gameState.beyWinsMe))}</span>
        </div>
      </div>

      <!-- VS / Estado -->
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:900;color:var(--muted)">VS</div>
        <div id="bey-battle-status" style="font-size:11px;color:var(--muted);margin-top:4px">
          Batalla ${gameState.beyBattleLog.length + 1}
        </div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">First to ${WIN_PTS}pts</div>
      </div>

      <!-- Oponente -->
      <div style="background:linear-gradient(135deg,#3E0D0D,#C01515);border:2px solid #E53935;
        border-radius:var(--radius-lg);padding:12px;text-align:center">
        <div style="font-size:12px;font-weight:700;color:#FFCDD2;margin-bottom:4px">${p2}</div>
        <div style="font-size:52px;font-weight:900;color:#fff;line-height:1" id="bey-pts-opp">${gameState.beyPtsOpp}</div>
        <div style="font-size:11px;color:#FFCDD2;margin-top:2px">pts esta batalla</div>
        <div style="font-size:18px;font-weight:700;color:#E53935;margin-top:4px">
          ${'🌀'.repeat(gameState.beyWinsOpp)}
          <span style="color:#555">${'○'.repeat(Math.max(0,2-gameState.beyWinsOpp))}</span>
        </div>
      </div>
    </div>

    <!-- RESULTADO BATALLA -->
    <div id="bey-battle-result" style="text-align:center;min-height:28px;margin-bottom:8px;
      font-size:18px;font-weight:700"></div>

    <!-- BOTONES DE FINISH TYPE -->
    <div style="margin-bottom:10px">
      <p style="font-size:11px;color:var(--muted);text-align:center;margin-bottom:8px">
        ¿Cómo terminó la batalla? · Selecciona el tipo de finish
      </p>

      <!-- YO gané con... -->
      <p style="font-size:11px;color:#90CAF9;font-weight:700;margin-bottom:5px">Yo gané con:</p>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px">
        ${BEY_FINISH_TYPES.map(f=>`
          <button onclick="applyBeyFinish('me','${f.key}',${f.pts})"
            style="background:${f.color}22;border:1px solid ${f.color};border-radius:8px;
            padding:6px 2px;cursor:pointer;transition:all 0.15s;font-family:inherit"
            onmouseover="this.style.background='${f.color}44'" onmouseout="this.style.background='${f.color}22'">
            <div style="font-size:14px">${f.emoji}</div>
            <div style="font-size:9px;color:${f.color};font-weight:700">${f.label}</div>
            <div style="font-size:11px;color:#fff;font-weight:700">+${f.pts}</div>
          </button>`).join('')}
      </div>

      <!-- OPONENTE ganó con... -->
      <p style="font-size:11px;color:#FFCDD2;font-weight:700;margin-bottom:5px">Oponente ganó con:</p>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px">
        ${BEY_FINISH_TYPES.map(f=>`
          <button onclick="applyBeyFinish('opp','${f.key}',${f.pts})"
            style="background:${f.color}22;border:1px solid ${f.color};border-radius:8px;
            padding:6px 2px;cursor:pointer;transition:all 0.15s;font-family:inherit"
            onmouseover="this.style.background='${f.color}44'" onmouseout="this.style.background='${f.color}22'">
            <div style="font-size:14px">${f.emoji}</div>
            <div style="font-size:9px;color:${f.color};font-weight:700">${f.label}</div>
            <div style="font-size:11px;color:#fff;font-weight:700">+${f.pts}</div>
          </button>`).join('')}
      </div>
    </div>

    <!-- HISTORIAL -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:11px;color:var(--muted)">Historial de batallas</span>
      <button class="btn btn-xs btn-ghost" onclick="undoBeyFinish()">↩ Deshacer</button>
    </div>
    <div id="bey-log" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
      ${renderBeyLog()}
    </div>

    <!-- RESET -->
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm btn-ghost" style="flex:1" onclick="resetBeyBattle()">🔄 Nueva batalla</button>
      <button class="btn btn-sm btn-danger" style="flex:1" onclick="resetBeyMatch()">✕ Nuevo match</button>
    </div>

    <!-- RULETA -->
    <div class="section" style="margin-top:12px">
      <div class="section-head"><span class="section-title">🎲 ¿Quién lanza primero?</span></div>
      <div class="section-body">
        <div class="spinner-wrap">
          <div id="spin-icon" style="font-size:36px">🌀</div>
          <div class="spinner-name" id="spin-name">Presiona para decidir</div>
          <button class="btn btn-primary" style="margin-top:8px" onclick="doBeyLaunchSpin()">🎰 Girar</button>
        </div>
      </div>
    </div>
  `;
}

function renderBeyLog() {
  if (!gameState.beyBattleLog?.length) return '<span style="color:var(--muted2);font-size:11px">Sin batallas aún</span>';
  return gameState.beyBattleLog.map((b,i) => {
    const f = BEY_FINISH_TYPES.find(f=>f.key===b.finishType);
    const winner = b.winner === 'me' ? '🔵' : '🔴';
    return `<span style="font-size:11px;padding:3px 7px;border-radius:12px;
      background:${f?.color||'#444'}22;border:1px solid ${f?.color||'#444'};color:${f?.color||'#fff'}">
      B${i+1} ${winner} ${f?.emoji||''} ${f?.label||''} +${b.pts}
    </span>`;
  }).join('');
}

function applyBeyFinish(who, finishType, pts) {
  if (pts === 0) {
    // Draw — nadie suma
    gameState.beyBattleLog.push({ winner: 'draw', finishType, pts: 0 });
    AudioFX.tap();
    showToast('🤝 Draw — sin puntos');
    renderBeyGameApp(document.getElementById('game-content'));
    return;
  }

  const WIN_PTS = 4;
  if (who === 'me') {
    gameState.beyPtsMe = (gameState.beyPtsMe || 0) + pts;
  } else {
    gameState.beyPtsOpp = (gameState.beyPtsOpp || 0) + pts;
  }
  gameState.beyBattleLog.push({ winner: who, finishType, pts });

  const f = BEY_FINISH_TYPES.find(f=>f.key===finishType);
  pts > 1 ? AudioFX.danger() : AudioFX.plus();

  // Verificar si alguien ganó la batalla (primero en llegar a WIN_PTS)
  const me = gameState.beyPtsMe || 0;
  const opp = gameState.beyPtsOpp || 0;

  if (me >= WIN_PTS || opp >= WIN_PTS) {
    const battleWinner = me >= WIN_PTS ? 'me' : 'opp';
    if (battleWinner === 'me') {
      gameState.beyWinsMe = (gameState.beyWinsMe || 0) + 1;
    } else {
      gameState.beyWinsOpp = (gameState.beyWinsOpp || 0) + 1;
    }

    AudioFX.roundEnd();

    // Verificar si ganó el match (Bo3 = 2 batallas)
    if (gameState.beyWinsMe >= 2 || gameState.beyWinsOpp >= 2) {
      const iWon = gameState.beyWinsMe >= 2;
      setTimeout(() => {
        if (iWon) { showToast('🏆 ¡Ganaste el match!'); AudioFX.victory(); }
        else { showToast('💀 El oponente ganó el match'); AudioFX.danger(); }
        // Auto-enviar resultado si estamos en torneo
        if (gameState.tournament?.id && !gameState.freeMode) {
          autoSubmitBeyResult(iWon);
        }
      }, 600);
    } else {
      showToast(battleWinner === 'me' ? '🌀 ¡Ganaste la batalla!' : '💀 El oponente ganó la batalla');
    }

    // Reset puntos para la siguiente batalla
    gameState.beyPtsMe = 0;
    gameState.beyPtsOpp = 0;
  }

  renderBeyGameApp(document.getElementById('game-content'));
}

function undoBeyFinish() {
  if (!gameState.beyBattleLog?.length) return;
  AudioFX.tap();
  const last = gameState.beyBattleLog.pop();
  if (last.winner === 'me') gameState.beyPtsMe = Math.max(0, (gameState.beyPtsMe||0) - last.pts);
  else if (last.winner === 'opp') gameState.beyPtsOpp = Math.max(0, (gameState.beyPtsOpp||0) - last.pts);
  renderBeyGameApp(document.getElementById('game-content'));
}

function resetBeyBattle() {
  AudioFX.tap();
  gameState.beyPtsMe = 0;
  gameState.beyPtsOpp = 0;
  renderBeyGameApp(document.getElementById('game-content'));
}

function resetBeyMatch() {
  AudioFX.tap();
  gameState.beyPtsMe = 0; gameState.beyPtsOpp = 0;
  gameState.beyWinsMe = 0; gameState.beyWinsOpp = 0;
  gameState.beyBattleLog = [];
  renderBeyGameApp(document.getElementById('game-content'));
}

function changeBeyScore(who, delta) {} // legacy - ya no se usa
function resetBeyScore() { resetBeyBattle(); }

function doBeyLaunchSpin() {
  AudioFX.roundStart();
  // Usar solo los jugadores del match actual (no todos del torneo)
  const matchPlayers = gameState.players?.length
    ? gameState.players.map(p=>p.name)
    : [gameState.myPlayer?.name||'J1', gameState.beyOppName||'J2'];
  const players = matchPlayers;
  const nameEl=document.getElementById('spin-name'); const iconEl=document.getElementById('spin-icon');
  let count=0; const total=15+Math.floor(Math.random()*8);
  clearInterval(spinInterval);
  spinInterval=setInterval(()=>{
    nameEl.textContent=players[Math.floor(Math.random()*players.length)];
    iconEl.textContent='🌀'; count++;
    if(count>=total){
      clearInterval(spinInterval);
      const w=players[Math.floor(Math.random()*players.length)];
      nameEl.textContent=w+' lanza primero'; iconEl.textContent='🎯';
      AudioFX.tap();
    }
  },80);
}

// ===== AUTO-SUBMIT BEYBLADE RESULT =====
async function autoSubmitBeyResult(iWon) {
  if (!gameState.tournament?.id || !gameState.myPlayer) {
    console.log('autoSubmit: missing tournament or player', gameState.tournament?.id, gameState.myPlayer);
    return;
  }

  const myId     = gameState.myPlayer.id;
  const oppId    = gameState.players?.find(p => p.id !== myId)?.id;
  const winnerId = iWon ? myId : oppId;

  console.log('autoSubmit:', {myId, oppId, winnerId, iWon, tournament: gameState.tournament});

  // Buscar el match — buscar por player_id sin filtrar por ronda/formato
  // para ser más robusto
  const { data: matches, error } = await _supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', gameState.tournament.id)
    .eq('is_complete', false)
    .or(`player1_id.eq.${myId},player2_id.eq.${myId}`);

  console.log('autoSubmit matches:', matches, error);

  if (!matches || !matches.length) {
    showToast('No se encontró el partido activo');
    return;
  }

  const myMatch = matches[0];

  // Calcular score Bo3 correctamente
  const iAmP1 = myMatch.player1_id === myId;
  const s1 = iAmP1 ? gameState.beyWinsMe  : gameState.beyWinsOpp;
  const s2 = iAmP1 ? gameState.beyWinsOpp : gameState.beyWinsMe;

  const { error: updateErr } = await _supabase.from('matches').update({
    score_p1: s1,
    score_p2: s2,
    winner_id: winnerId,
    is_complete: false,
    result_reported: true
  }).eq('id', myMatch.id);

  if (updateErr) {
    console.error('autoSubmit error:', updateErr);
    showToast('Error al enviar resultado: ' + updateErr.message);
    return;
  }

  showToast('📤 Resultado enviado al admin (' + s1 + '–' + s2 + ')');
}

// ===== WINNER POPUP =====
function showWinnerPopup(players) {
  AudioFX.victory();
  const sorted = [...players].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  const top = sorted.filter(p => p.points === sorted[0].points && p.wins === sorted[0].wins);
  const isMultiple = top.length > 1;

  const overlay = document.createElement('div');
  overlay.id = 'winner-popup-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;
    z-index:9999;padding:20px;backdrop-filter:blur(6px)`;
  overlay.innerHTML = `
    <div style="background:var(--dark2);border:2px solid var(--gold);border-radius:20px;
      padding:32px 28px;text-align:center;max-width:400px;width:100%;
      box-shadow:0 0 60px rgba(201,168,76,0.4)">
      <div style="font-size:56px;margin-bottom:8px">${isMultiple ? '🏆🏆' : '👑'}</div>
      <div style="font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
        ${isMultiple ? 'TOP del torneo' : '¡Campeón!'}
      </div>
      ${top.map((p,i) => `
        <div style="font-size:${i===0?'28px':'20px'};font-weight:900;color:${i===0?'var(--gold)':'var(--text)'};margin-bottom:4px">
          ${['👑','🥈','🥉'][i]||'🏅'} ${escHtml(p.name)}
        </div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:8px">${p.wins} victorias · ${p.points} puntos</div>
      `).join('')}
      <hr style="border-color:var(--border);margin:16px 0">
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Clasificación final</div>
      ${sorted.slice(0,5).map((p,i)=>`
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;
          ${i<top.length?'color:var(--gold);font-weight:600':'color:var(--muted)'}">
          <span>${i+1}. ${escHtml(p.name)}</span>
          <span>${p.points}pts</span>
        </div>`).join('')}
      <button class="btn btn-primary w-full" style="margin-top:20px" onclick="document.getElementById('winner-popup-overlay').remove()">
        Cerrar
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

// ===== BROADCAST (realtime entre jugadores) =====
async function broadcastGameState() {
  if (!gameState.tournament?.id) return;
  const ch = _supabase.channel(`game-${gameState.tournament.id}`);
  ch.send({ type:'broadcast', event:'game_state', payload: {
    lifePoints: gameState.lifePoints,
    commanderDmg: gameState.commanderDmg,
    senderId: currentUser?.id
  }});
}

function subscribeGameBroadcast(tournamentId) {
  _supabase.channel(`game-${tournamentId}`)
    .on('broadcast', { event:'game_state' }, (payload) => {
      if (payload.payload.senderId === currentUser?.id) return;
      const myId = gameState.myPlayer?.id;
      Object.entries(payload.payload.lifePoints||{}).forEach(([pid,life]) => {
        if (pid !== myId) gameState.lifePoints[pid] = life;
      });
      Object.entries(payload.payload.commanderDmg||{}).forEach(([att,victims]) => {
        if (att !== myId) gameState.commanderDmg[att] = victims;
      });
      if (gameState.activeGame==='life') {
        gameState.players.forEach(p => {
          const el = document.getElementById('life-'+p.id);
          if (el && p.id !== myId) el.textContent = gameState.lifePoints[p.id]??'?';
        });
      }
    }).subscribe();
}
