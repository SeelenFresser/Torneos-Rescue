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
  gameState = { tournament:null, players:[], myPlayer:null, lifePoints:{}, commanderDmg:{}, activeGame:'life', freeMode:false };
  if (gameState.freeMode || !currentTournament) showScreen('screen-dashboard');
  else showScreen('screen-tournament');
  showScreen('screen-dashboard');
}

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

// ===== LIFE COUNTER — COMPACT NO SCROLL =====
function renderFreeLifeTab(el) {
  const players = gameState.freePlayers || [];
  const startLife = gameState.startLife || 20;
  const count = players.length;
  // Grid responsive: 2 cols si <=4, 3 cols si 5-6
  const cols = count <= 4 ? 2 : 3;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:12px;color:var(--muted)">${count} jugadores</span>
      <div style="display:flex;gap:6px">
        ${count < 6 ? `<button class="btn btn-xs" onclick="addFreePlayer()">+ Jugador</button>` : ''}
        ${count > 2 ? `<button class="btn btn-xs btn-danger" onclick="removeFreePlayerLast()">− Quitar</button>` : ''}
        <button class="btn btn-xs btn-ghost" onclick="resetAllLife()">🔄 Reset</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px">
      ${players.map(p => renderCompactLifeCard(p, startLife)).join('')}
    </div>
  `;
}

function renderCompactLifeCard(p, startLife) {
  const life = gameState.lifePoints[p.id] ?? startLife;
  const dangerClass = life <= 5 ? 'critical' : life <= 10 ? 'danger' : '';
  return `
    <div class="life-counter" style="padding:10px 8px">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;justify-content:center">
        <input style="background:transparent;border:none;border-bottom:1px solid var(--border2);
          color:var(--pink-light);font-size:12px;font-weight:700;text-align:center;width:80px;outline:none"
          value="${escHtml(p.name)}" onchange="renameFreePlayer('${p.id}',this.value)">
      </div>
      <div class="life-num ${dangerClass}" id="life-${p.id}" style="font-size:52px">${life}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px">
        <button class="life-btn minus" style="width:100%;height:36px;border-radius:8px;font-size:16px"
          onclick="changeFreeLife('${p.id}',-1)">−1</button>
        <button class="life-btn plus" style="width:100%;height:36px;border-radius:8px;font-size:16px"
          onclick="changeFreeLife('${p.id}',+1)">+1</button>
        <button class="life-btn minus" style="width:100%;height:32px;border-radius:8px;font-size:13px"
          onclick="changeFreeLife('${p.id}',-5)">−5</button>
        <button class="life-btn plus" style="width:100%;height:32px;border-radius:8px;font-size:13px"
          onclick="changeFreeLife('${p.id}',+5)">+5</button>
      </div>
      <div style="display:flex;gap:4px;margin-top:6px">
        <input class="life-in" id="lc-${p.id}" type="number" placeholder="±"
          style="flex:1;font-size:13px;padding:4px"
          onkeydown="if(event.key==='Enter')applyCustomFreeLife('${p.id}')">
        <button class="btn btn-xs" onclick="applyCustomFreeLife('${p.id}')">OK</button>
        <button class="btn btn-xs btn-ghost" onclick="resetOneLife('${p.id}')">↺</button>
      </div>
    </div>`;
}

function changeFreeLife(playerId, delta) {
  const start = gameState.startLife || 20;
  gameState.lifePoints[playerId] = (gameState.lifePoints[playerId] ?? start) + delta;
  const life = gameState.lifePoints[playerId];
  const el = document.getElementById('life-' + playerId);
  if (el) {
    el.textContent = life;
    el.className = 'life-num ' + (life<=5?'critical':life<=10?'danger':'');
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

// ===== BEYBLADE IN TOURNAMENT =====
function renderBeyGameApp(content) {
  content.innerHTML = `
    <div class="section">
      <div class="section-head"><span class="section-title">🌀 Beyblade Bo3</span></div>
      <div class="section-body">
        <div class="bey-score-wrap">
          <div class="bey-score-player">
            <div class="bey-score-name text-pink">${escHtml(gameState.myPlayer?.name||'J1')}</div>
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
        </div>
      </div>
    </div>
    <div class="section" style="margin-top:12px">
      <div class="section-head"><span class="section-title">🎲 ¿Quién lanza primero?</span></div>
      <div class="section-body">
        <div class="spinner-wrap">
          <div id="spin-icon" style="font-size:36px">🌀</div>
          <div class="spinner-name" id="spin-name">Presiona para decidir</div>
          <button class="btn btn-primary" style="margin-top:8px" onclick="doBeyLaunchSpin()">🎰 Girar</button>
        </div>
      </div>
    </div>`;
  gameState.beyScoreMe = 0; gameState.beyScoreOpp = 0;
}

function changeBeyScore(who, delta) {
  if (who==='me') { gameState.beyScoreMe = Math.max(0,(gameState.beyScoreMe||0)+delta); document.getElementById('bey-my-score').textContent = gameState.beyScoreMe; }
  else { gameState.beyScoreOpp = Math.max(0,(gameState.beyScoreOpp||0)+delta); document.getElementById('bey-opp-score').textContent = gameState.beyScoreOpp; }
  delta > 0 ? AudioFX.plus() : AudioFX.minus();
  const me=gameState.beyScoreMe||0, opp=gameState.beyScoreOpp||0;
  const resEl = document.getElementById('bey-match-result');
  if (resEl) {
    if (me>=2) { resEl.innerHTML='<span style="color:var(--green)">🏆 ¡Ganaste!</span>'; AudioFX.victory(); }
    else if (opp>=2) { resEl.innerHTML='<span style="color:var(--red)">💀 Perdiste</span>'; AudioFX.danger(); }
    else resEl.innerHTML='';
  }
}

function resetBeyScore() {
  AudioFX.tap();
  gameState.beyScoreMe=0; gameState.beyScoreOpp=0;
  document.getElementById('bey-my-score').textContent='0';
  document.getElementById('bey-opp-score').textContent='0';
  const r=document.getElementById('bey-match-result'); if(r) r.innerHTML='';
}

function doBeyLaunchSpin() {
  AudioFX.roundStart();
  const players = gameState.players?.map(p=>p.name)||['J1','J2'];
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
