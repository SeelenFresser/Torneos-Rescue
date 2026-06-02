// =============================================
// GAME APP — Sub-aplicación para jugadores
// =============================================
let gameState = {
  tournament: null,
  players: [],
  myPlayer: null,
  lifePoints: {},      // playerId → life
  commanderDmg: {},    // attackerId → {victimId → damage}
  beyScore: {},        // matchId → {p1:0, p2:0}
  activeGame: 'life',  // current tab
};

function startGameApp(tournament, players, myPlayer) {
  gameState.tournament = tournament;
  gameState.players = players;
  gameState.myPlayer = myPlayer;

  // Init life points (Magic: 40 Commander / 20 Standard)
  const startLife = tournament.type === 'commander' ? 40 : 20;
  players.forEach(p => {
    if (!gameState.lifePoints[p.id]) gameState.lifePoints[p.id] = startLife;
  });

  document.getElementById('game-title').textContent = tournament.name;
  document.getElementById('game-player-name').textContent = myPlayer?.name || '';
  showScreen('screen-game');
  renderGameApp();
}

function leaveGame() {
  showScreen('screen-tournament');
}

function renderGameApp() {
  const t = gameState.tournament;
  const content = document.getElementById('game-content');

  if (t.type === 'beyblade') {
    renderBeyGameApp(content);
    return;
  }

  // Magic tabs: vida / ruleta / daño comandante
  const tabs = t.type === 'commander'
    ? [['life','❤️ Vida'],['spin','🎲 Turno'],['cmdr','⚔️ Comandante']]
    : [['life','❤️ Vida'],['spin','🎲 Turno']];

  content.innerHTML = `
    <div class="game-tabs">
      ${tabs.map(([id,label]) =>
        `<button class="game-tab ${gameState.activeGame===id?'active':''}" onclick="switchGameTab('${id}')">${label}</button>`
      ).join('')}
    </div>
    <div id="game-tab-content"></div>
  `;

  renderGameTab(gameState.activeGame);
}

function switchGameTab(tab) {
  gameState.activeGame = tab;
  document.querySelectorAll('.game-tab').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(
      tab === 'life' ? '❤️' : tab === 'spin' ? '🎲' : '⚔️'
    ));
  });
  renderGameTab(tab);
}

function renderGameTab(tab) {
  const el = document.getElementById('game-tab-content');
  if (!el) return;
  if (tab === 'life') renderLifeTab(el);
  else if (tab === 'spin') renderSpinTab(el);
  else if (tab === 'cmdr') renderCommanderDamageTab(el);
}

/* ===== VIDA ===== */
function renderLifeTab(el) {
  const players = gameState.players;
  const myId = gameState.myPlayer?.id;

  el.innerHTML = `
    <div style="display:grid;gap:12px">
      ${players.map(p => {
        const life = gameState.lifePoints[p.id] ?? (gameState.tournament.type === 'commander' ? 40 : 20);
        const isMine = p.id === myId;
        const dangerClass = life <= 5 ? 'critical' : life <= 10 ? 'danger' : '';

        return `<div class="life-counter ${isMine ? 'glow-pink' : ''}">
          <div class="life-player">${escHtml(p.name)}${isMine ? ' (tú)' : ''}</div>
          <div class="life-num ${dangerClass}" id="life-${p.id}">${life}</div>
          ${isMine ? `
          <div class="life-controls">
            <button class="life-btn minus" onclick="changeLife('${p.id}',-5)">−5</button>
            <button class="life-btn minus" onclick="changeLife('${p.id}',-1)">−1</button>
            <button class="life-btn plus"  onclick="changeLife('${p.id}',+1)">+1</button>
            <button class="life-btn plus"  onclick="changeLife('${p.id}',+5)">+5</button>
          </div>
          <div class="life-input-row">
            <input class="life-in" id="life-custom-${p.id}" type="number" placeholder="±" onkeydown="if(event.key==='Enter')applyCustomLife('${p.id}')">
            <button class="btn btn-sm" onclick="applyCustomLife('${p.id}')">Aplicar</button>
            <button class="btn btn-sm btn-ghost" onclick="resetLife('${p.id}')">Reset</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function changeLife(playerId, delta) {
  const start = gameState.tournament.type === 'commander' ? 40 : 20;
  gameState.lifePoints[playerId] = (gameState.lifePoints[playerId] ?? start) + delta;
  const el = document.getElementById('life-' + playerId);
  if (el) {
    const life = gameState.lifePoints[playerId];
    el.textContent = life;
    el.className = 'life-num ' + (life <= 5 ? 'critical' : life <= 10 ? 'danger' : '');
  }
  broadcastGameState();
}

function applyCustomLife(playerId) {
  const el = document.getElementById('life-custom-' + playerId);
  const val = parseInt(el.value);
  if (isNaN(val)) return;
  changeLife(playerId, val);
  el.value = '';
}

function resetLife(playerId) {
  const start = gameState.tournament.type === 'commander' ? 40 : 20;
  gameState.lifePoints[playerId] = start;
  const el = document.getElementById('life-' + playerId);
  if (el) { el.textContent = start; el.className = 'life-num'; }
  broadcastGameState();
}

/* ===== RULETA DE TURNO ===== */
let spinInterval = null;

function renderSpinTab(el) {
  const players = gameState.players.map(p => p.name);
  el.innerHTML = `
    <div class="section">
      <div class="section-head"><span class="section-title">🎲 ¿Quién empieza?</span></div>
      <div class="section-body">
        <div class="spinner-wrap">
          <div class="spinner-result" id="spin-icon">🎲</div>
          <div class="spinner-name" id="spin-name">Presiona para girar</div>
          <div class="spinner-sub" id="spin-sub">Decide quién va primero</div>
          <button class="btn btn-primary" style="margin-top:8px" onclick="doSpin()">🎰 Girar</button>
        </div>
        <hr>
        <div style="text-align:center">
          <p style="font-size:12px;color:var(--muted);margin-bottom:10px">O tira un dado</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
            ${[4,6,8,10,12,20].map(n =>
              `<button class="btn btn-sm" onclick="rollDice(${n})">d${n}</button>`
            ).join('')}
          </div>
          <div style="font-size:48px;font-weight:900;color:var(--cream);margin-top:12px;min-height:60px" id="dice-result"></div>
        </div>
      </div>
    </div>
  `;
}

function doSpin() {
  const players = gameState.players.map(p => p.name);
  if (!players.length) { showToast('Sin jugadores'); return; }
  const nameEl = document.getElementById('spin-name');
  const iconEl = document.getElementById('spin-icon');
  const subEl  = document.getElementById('spin-sub');
  const emojis = ['🐇','⚡','🌀','🔥','✨','💥','🎯','⚔️'];
  let count = 0;
  const total = 20 + Math.floor(Math.random() * 10);
  clearInterval(spinInterval);
  spinInterval = setInterval(() => {
    nameEl.textContent = players[Math.floor(Math.random() * players.length)];
    iconEl.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    count++;
    if (count >= total) {
      clearInterval(spinInterval);
      const winner = players[Math.floor(Math.random() * players.length)];
      nameEl.textContent = winner;
      iconEl.textContent = '👑';
      subEl.textContent = '¡' + winner + ' empieza!';
    }
  }, 80);
}

function rollDice(sides) {
  const result = Math.floor(Math.random() * sides) + 1;
  const el = document.getElementById('dice-result');
  if (el) el.textContent = result;
}

/* ===== DAÑO DE COMANDANTE ===== */
function renderCommanderDamageTab(el) {
  const players = gameState.players;
  const myId = gameState.myPlayer?.id;

  // Init damage structure
  players.forEach(attacker => {
    if (!gameState.commanderDmg[attacker.id]) gameState.commanderDmg[attacker.id] = {};
    players.forEach(victim => {
      if (attacker.id !== victim.id && !gameState.commanderDmg[attacker.id][victim.id]) {
        gameState.commanderDmg[attacker.id][victim.id] = 0;
      }
    });
  });

  el.innerHTML = `
    <div class="section">
      <div class="section-head"><span class="section-title">⚔️ Daño de Comandante</span></div>
      <div class="section-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Registra el daño que <strong>tu comandante</strong> ha hecho a cada oponente. A 21 = eliminado.</p>
        <div class="cmdr-damage-grid" id="cmdr-dmg-grid">
          ${renderCmdrDmgRows(myId)}
        </div>
      </div>
    </div>
    <div class="section" style="margin-top:12px">
      <div class="section-head"><span class="section-title">📊 Daño recibido de comandantes</span></div>
      <div class="section-body">
        ${renderCmdrDmgReceived(myId)}
      </div>
    </div>
  `;
}

function renderCmdrDmgRows(myId) {
  const victims = gameState.players.filter(p => p.id !== myId);
  return victims.map(victim => {
    const dmg = gameState.commanderDmg[myId]?.[victim.id] || 0;
    const isDanger = dmg >= 16;
    const isDead   = dmg >= 21;
    return `<div class="cmdr-dmg-row">
      <div class="cmdr-dmg-name">${escHtml(victim.name)}</div>
      <div class="cmdr-dmg-val ${isDanger ? 'danger' : ''}" id="cdmg-${myId}-${victim.id}">${dmg}</div>
      <div class="cmdr-dmg-btns">
        <button class="dmg-btn minus" onclick="changeCmdrDmg('${myId}','${victim.id}',-1)">−</button>
        <button class="dmg-btn plus"  onclick="changeCmdrDmg('${myId}','${victim.id}',+1)">+</button>
        <button class="dmg-btn plus"  onclick="changeCmdrDmg('${myId}','${victim.id}',+2)">+2</button>
      </div>
      ${isDead ? '<span style="color:var(--red);font-size:11px;font-weight:700">💀 ELIMINADO</span>' : ''}
    </div>`;
  }).join('');
}

function renderCmdrDmgReceived(myId) {
  const attackers = gameState.players.filter(p => p.id !== myId);
  return `<div class="cmdr-damage-grid">
    ${attackers.map(att => {
      const dmg = gameState.commanderDmg[att.id]?.[myId] || 0;
      const isDanger = dmg >= 16;
      return `<div class="cmdr-dmg-row">
        <div class="cmdr-dmg-name">De ${escHtml(att.name)}</div>
        <div class="cmdr-dmg-val ${isDanger ? 'danger' : ''}">${dmg}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function changeCmdrDmg(attackerId, victimId, delta) {
  if (!gameState.commanderDmg[attackerId]) gameState.commanderDmg[attackerId] = {};
  const cur = gameState.commanderDmg[attackerId][victimId] || 0;
  gameState.commanderDmg[attackerId][victimId] = Math.max(0, cur + delta);

  const el = document.getElementById(`cdmg-${attackerId}-${victimId}`);
  if (el) {
    const val = gameState.commanderDmg[attackerId][victimId];
    el.textContent = val;
    el.className = 'cmdr-dmg-val' + (val >= 16 ? ' danger' : '');
  }
  broadcastGameState();
}

/* ===== BEYBLADE GAME APP ===== */
function renderBeyGameApp(content) {
  // Find my current match
  const myId = gameState.myPlayer?.id;
  content.innerHTML = `
    <div class="section">
      <div class="section-head"><span class="section-title">🌀 Beyblade Bo3</span></div>
      <div class="section-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Registra el resultado de cada batalla. Primero en ganar 2 gana el match.</p>
        <div class="bey-score-wrap">
          <div class="bey-score-player">
            <div class="bey-score-name text-pink">${escHtml(gameState.myPlayer?.name || 'Jugador 1')}</div>
            <div class="bey-score-num text-pink" id="bey-my-score">0</div>
            <div class="bey-score-controls">
              <button class="life-btn minus" onclick="changeBeyScore('me',-1)">−</button>
              <button class="life-btn plus"  onclick="changeBeyScore('me',+1)">+1</button>
            </div>
          </div>
          <div class="bey-score-vs">VS</div>
          <div class="bey-score-player">
            <div class="bey-score-name">Oponente</div>
            <div class="bey-score-num" id="bey-opp-score">0</div>
            <div class="bey-score-controls">
              <button class="life-btn minus" onclick="changeBeyScore('opp',-1)">−</button>
              <button class="life-btn plus"  onclick="changeBeyScore('opp',+1)">+1</button>
            </div>
          </div>
        </div>
        <div id="bey-match-result" style="text-align:center;font-size:20px;font-weight:700;min-height:32px;margin-top:8px"></div>
        <div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center">
          <button class="btn btn-sm" onclick="resetBeyScore()">🔄 Reset batalla</button>
          <button class="btn btn-primary btn-sm" onclick="sendBeyResult()">📤 Enviar resultado</button>
        </div>
      </div>
    </div>
    <hr>
    <div class="section">
      <div class="section-head"><span class="section-title">🎲 Decide quién lanza primero</span></div>
      <div class="section-body">
        <div class="spinner-wrap">
          <div class="spinner-result" id="bey-spin-icon">🌀</div>
          <div class="spinner-name" id="bey-spin-name">Presiona para decidir</div>
          <button class="btn btn-primary" style="margin-top:8px" onclick="doBeyLaunchSpin()">🎰 Girar</button>
        </div>
      </div>
    </div>
  `;
  gameState.beyScoreMe = 0;
  gameState.beyScoreOpp = 0;
}

function changeBeyScore(who, delta) {
  if (who === 'me') {
    gameState.beyScoreMe = Math.max(0, (gameState.beyScoreMe || 0) + delta);
    const el = document.getElementById('bey-my-score');
    if (el) el.textContent = gameState.beyScoreMe;
  } else {
    gameState.beyScoreOpp = Math.max(0, (gameState.beyScoreOpp || 0) + delta);
    const el = document.getElementById('bey-opp-score');
    if (el) el.textContent = gameState.beyScoreOpp;
  }
  const resEl = document.getElementById('bey-match-result');
  if (resEl) {
    const me = gameState.beyScoreMe || 0;
    const opp = gameState.beyScoreOpp || 0;
    if (me >= 2) resEl.innerHTML = '<span style="color:var(--green)">🏆 ¡Ganaste el match!</span>';
    else if (opp >= 2) resEl.innerHTML = '<span style="color:var(--red)">💀 Perdiste el match</span>';
    else resEl.innerHTML = '';
  }
}

function resetBeyScore() {
  gameState.beyScoreMe = 0; gameState.beyScoreOpp = 0;
  const me = document.getElementById('bey-my-score');
  const opp = document.getElementById('bey-opp-score');
  if (me) me.textContent = '0';
  if (opp) opp.textContent = '0';
  const res = document.getElementById('bey-match-result');
  if (res) res.innerHTML = '';
}

async function sendBeyResult() {
  showToast('Resultado registrado ✓');
}

function doBeyLaunchSpin() {
  const players = gameState.players.map(p => p.name);
  const nameEl = document.getElementById('bey-spin-name');
  const iconEl = document.getElementById('bey-spin-icon');
  let count = 0; const total = 15 + Math.floor(Math.random() * 8);
  clearInterval(spinInterval);
  spinInterval = setInterval(() => {
    nameEl.textContent = players[Math.floor(Math.random() * players.length)];
    iconEl.textContent = '🌀';
    count++;
    if (count >= total) {
      clearInterval(spinInterval);
      const winner = players[Math.floor(Math.random() * players.length)];
      nameEl.textContent = winner + ' lanza primero';
      iconEl.textContent = '🎯';
    }
  }, 80);
}

/* ===== BROADCAST game state via Supabase Realtime broadcast ===== */
async function broadcastGameState() {
  if (!gameState.tournament) return;
  // Use Supabase broadcast channel for ephemeral real-time sync
  const ch = _supabase.channel(`game-${gameState.tournament.id}`);
  ch.send({
    type: 'broadcast',
    event: 'game_state',
    payload: {
      lifePoints: gameState.lifePoints,
      commanderDmg: gameState.commanderDmg,
      senderId: currentUser?.id
    }
  });
}

// Subscribe to game state updates from other players
function subscribeGameBroadcast(tournamentId) {
  _supabase.channel(`game-${tournamentId}`)
    .on('broadcast', { event: 'game_state' }, (payload) => {
      if (payload.payload.senderId === currentUser?.id) return;
      // Merge received life points (don't overwrite mine)
      const myId = gameState.myPlayer?.id;
      Object.entries(payload.payload.lifePoints || {}).forEach(([pid, life]) => {
        if (pid !== myId) gameState.lifePoints[pid] = life;
      });
      // Merge commander damage received
      Object.entries(payload.payload.commanderDmg || {}).forEach(([att, victims]) => {
        if (att !== myId) gameState.commanderDmg[att] = victims;
      });
      // Re-render without re-creating structure
      if (gameState.activeGame === 'life') {
        gameState.players.forEach(p => {
          const el = document.getElementById('life-' + p.id);
          if (el && p.id !== myId) el.textContent = gameState.lifePoints[p.id] ?? '?';
        });
      } else if (gameState.activeGame === 'cmdr') {
        const grid = document.getElementById('cmdr-dmg-grid');
        if (grid) grid.innerHTML = renderCmdrDmgRows(myId);
      }
    })
    .subscribe();
}

// =============================================
// MODO LIBRE — Sin torneo, desde el dashboard
// =============================================

function openFreeLifeCounter(mode) {
  // mode = 'commander' (40 PV) o 'standard' (20 PV)
  const startLife = mode === 'commander' ? 40 : 20;
  const label = mode === 'commander' ? '🧙 Commander' : '🃏 Standard';

  document.getElementById('game-title').textContent = label;
  document.getElementById('game-player-name').textContent = 'Modo libre';
  showScreen('screen-game');

  // Estado libre: jugadores configurables
  gameState = {
    tournament: { type: mode === 'commander' ? 'commander' : 'standard', id: null },
    players: [],
    myPlayer: null,
    lifePoints: {},
    commanderDmg: {},
    activeGame: 'life',
    freeMode: true,
    startLife
  };

  renderFreeLifeCounter(startLife, mode);
}

function openFreeSpinner() {
  document.getElementById('game-title').textContent = '🎲 Dados & Ruleta';
  document.getElementById('game-player-name').textContent = 'Modo libre';
  showScreen('screen-game');
  gameState = { freeMode: true, tournament: null, players: [], activeGame: 'spin' };

  const content = document.getElementById('game-content');
  renderSpinTab(content);
}

function renderFreeLifeCounter(startLife, mode) {
  const content = document.getElementById('game-content');

  // Leer jugadores configurados, default 2
  const players = gameState.freePlayers || [
    { id: 'p1', name: 'Jugador 1' },
    { id: 'p2', name: 'Jugador 2' }
  ];
  if (!gameState.freePlayers) gameState.freePlayers = players;

  // Init life
  players.forEach(p => {
    if (gameState.lifePoints[p.id] === undefined) gameState.lifePoints[p.id] = startLife;
  });

  const isCommander = mode === 'commander';

  const tabs = isCommander
    ? [['life','❤️ Vida'],['spin','🎲 Dados'],['cmdr','⚔️ Comandante']]
    : [['life','❤️ Vida'],['spin','🎲 Dados']];

  content.innerHTML = `
    <!-- Config jugadores -->
    <div class="section" style="margin-bottom:12px">
      <div class="section-head">
        <span class="section-title">👥 Jugadores</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="addFreePlayer(${startLife})">+ Jugador</button>
          <button class="btn btn-sm btn-danger" onclick="resetFreeLife(${startLife})">🔄 Reset</button>
        </div>
      </div>
      <div class="section-body" style="padding:10px 16px">
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="free-player-chips">
          ${players.map((p,i) => `
            <div class="chip">
              <input style="background:transparent;border:none;color:var(--text);width:80px;font-size:12px;outline:none"
                value="${escHtml(p.name)}" onchange="renameFreePlayer('${p.id}',this.value)">
              ${players.length > 2 ? `<button class="chip-remove" onclick="removeFreePlayer('${p.id}',${startLife})">×</button>` : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="game-tabs">
      ${tabs.map(([id,label]) =>
        `<button class="game-tab ${gameState.activeGame===id?'active':''}"
          onclick="switchFreeTab('${id}',${startLife},'${mode}')">${label}</button>`
      ).join('')}
    </div>
    <div id="game-tab-content"></div>
  `;

  renderFreeTab(gameState.activeGame, startLife, mode);
}

function switchFreeTab(tab, startLife, mode) {
  gameState.activeGame = tab;
  document.querySelectorAll('.game-tab').forEach(b => {
    b.classList.toggle('active',
      (tab==='life'&&b.textContent.includes('❤️'))||
      (tab==='spin'&&b.textContent.includes('🎲'))||
      (tab==='cmdr'&&b.textContent.includes('⚔️'))
    );
  });
  renderFreeTab(tab, startLife, mode);
}

function renderFreeTab(tab, startLife, mode) {
  const el = document.getElementById('game-tab-content');
  if (!el) return;
  if (tab === 'life') renderFreeLifeTab(el, startLife);
  else if (tab === 'spin') renderSpinTab(el);
  else if (tab === 'cmdr') renderFreeCommanderDmgTab(el);
}

function renderFreeLifeTab(el, startLife) {
  const players = gameState.freePlayers || [];
  el.innerHTML = `<div style="display:grid;gap:12px">
    ${players.map(p => {
      const life = gameState.lifePoints[p.id] ?? startLife;
      const dangerClass = life <= 5 ? 'critical' : life <= 10 ? 'danger' : '';
      return `<div class="life-counter">
        <div class="life-player">${escHtml(p.name)}</div>
        <div class="life-num ${dangerClass}" id="life-${p.id}">${life}</div>
        <div class="life-controls">
          <button class="life-btn minus" onclick="changeFreeLife('${p.id}',-5,${startLife})">−5</button>
          <button class="life-btn minus" onclick="changeFreeLife('${p.id}',-1,${startLife})">−1</button>
          <button class="life-btn plus"  onclick="changeFreeLife('${p.id}',+1,${startLife})">+1</button>
          <button class="life-btn plus"  onclick="changeFreeLife('${p.id}',+5,${startLife})">+5</button>
        </div>
        <div class="life-input-row">
          <input class="life-in" id="life-custom-${p.id}" type="number" placeholder="±"
            onkeydown="if(event.key==='Enter')applyFreeCustomLife('${p.id}',${startLife})">
          <button class="btn btn-sm" onclick="applyFreeCustomLife('${p.id}',${startLife})">Aplicar</button>
          <button class="btn btn-sm btn-ghost" onclick="changeFreeLife('${p.id}',0,${startLife},true)">Reset</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function changeFreeLife(playerId, delta, startLife, reset = false) {
  gameState.lifePoints[playerId] = reset ? startLife : (gameState.lifePoints[playerId] ?? startLife) + delta;
  const el = document.getElementById('life-' + playerId);
  if (el) {
    const life = gameState.lifePoints[playerId];
    el.textContent = life;
    el.className = 'life-num ' + (life<=5?'critical':life<=10?'danger':'');
  }
}

function applyFreeCustomLife(playerId, startLife) {
  const el = document.getElementById('life-custom-' + playerId);
  const val = parseInt(el?.value);
  if (!isNaN(val)) { changeFreeLife(playerId, val, startLife); el.value = ''; }
}

function addFreePlayer(startLife) {
  if (!gameState.freePlayers) gameState.freePlayers = [];
  if (gameState.freePlayers.length >= 8) { showToast('Máximo 8 jugadores'); return; }
  const id = 'p' + Date.now();
  const num = gameState.freePlayers.length + 1;
  gameState.freePlayers.push({ id, name: `Jugador ${num}` });
  gameState.lifePoints[id] = startLife;
  const mode = gameState.tournament?.type || 'standard';
  renderFreeLifeCounter(startLife, mode);
}

function removeFreePlayer(playerId, startLife) {
  gameState.freePlayers = (gameState.freePlayers||[]).filter(p => p.id !== playerId);
  delete gameState.lifePoints[playerId];
  const mode = gameState.tournament?.type || 'standard';
  renderFreeLifeCounter(startLife, mode);
}

function renameFreePlayer(playerId, newName) {
  const p = (gameState.freePlayers||[]).find(p => p.id === playerId);
  if (p) p.name = newName;
}

function resetFreeLife(startLife) {
  (gameState.freePlayers||[]).forEach(p => { gameState.lifePoints[p.id] = startLife; });
  document.querySelectorAll('[id^="life-p"]').forEach(el => {
    el.textContent = startLife;
    el.className = 'life-num';
  });
}

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

  el.innerHTML = `<div style="display:grid;gap:16px">
    ${players.map(att => `
      <div class="section">
        <div class="section-head"><span class="section-title">⚔️ ${escHtml(att.name)} hace daño a:</span></div>
        <div class="section-body">
          <div class="cmdr-damage-grid">
            ${players.filter(v => v.id !== att.id).map(vic => {
              const dmg = gameState.commanderDmg[att.id]?.[vic.id] || 0;
              return `<div class="cmdr-dmg-row">
                <div class="cmdr-dmg-name">${escHtml(vic.name)}</div>
                <div class="cmdr-dmg-val ${dmg>=16?'danger':''}" id="cdmg-free-${att.id}-${vic.id}">${dmg}</div>
                <div class="cmdr-dmg-btns">
                  <button class="dmg-btn minus" onclick="changeFreeCommanderDmg('${att.id}','${vic.id}',-1)">−</button>
                  <button class="dmg-btn plus"  onclick="changeFreeCommanderDmg('${att.id}','${vic.id}',+1)">+</button>
                  <button class="dmg-btn plus"  onclick="changeFreeCommanderDmg('${att.id}','${vic.id}',+2)">+2</button>
                </div>
                ${dmg>=21?'<span style="color:var(--red);font-size:11px;font-weight:700">💀 21!</span>':''}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function changeFreeCommanderDmg(attId, vicId, delta) {
  if (!gameState.commanderDmg[attId]) gameState.commanderDmg[attId] = {};
  gameState.commanderDmg[attId][vicId] = Math.max(0, (gameState.commanderDmg[attId][vicId]||0) + delta);
  const el = document.getElementById(`cdmg-free-${attId}-${vicId}`);
  if (el) {
    const val = gameState.commanderDmg[attId][vicId];
    el.textContent = val;
    el.className = 'cmdr-dmg-val' + (val>=16?' danger':'');
  }
}

function leaveGame() {
  if (gameState.freeMode) {
    gameState = { tournament:null, players:[], myPlayer:null, lifePoints:{}, commanderDmg:{}, activeGame:'life' };
    showScreen('screen-dashboard');
  } else {
    showScreen('screen-tournament');
  }
}
