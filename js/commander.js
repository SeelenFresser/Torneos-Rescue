// =============================================
// COMMANDER — Sistema completo
// Pods automáticos · Sesiones individuales
// cEDH con kills · Admin confirma
// =============================================

const CMD_PTS = {
  standard:  (place, size) => place===1?3:place===2&&size>=3?1:0,
  placement: (place, size) => size===2?[5,1][place-1]:size===3?[10,4,1][place-1]:[10,6,3,1][place-1]||0,
  cedh:      () => 0, // puntos por kills, calculado aparte
  winner:    (place) => place===1?1:0
};
const CMD_PTS_DESC = {
  standard:  '1°=3pts · 2°=1pt · resto=0',
  placement: '1°=10 · 2°=6 · 3°=3 · 4°=1',
  cedh:      '1pt/eliminación + 1pt ganar mesa',
  winner:    'Solo victoria: 1°=1pt'
};

// ── VISTA ADMIN ───────────────────────────────────────────
function renderCommanderView() {
  const t = currentTournament, players = tournamentPlayers, owner = isOwner();
  const totalRounds = t.total_rounds||3, roundsDone = t.current_round||0;
  const roundsLeft = totalRounds - roundsDone;
  const ptsSystem = t.points_system||'standard';

  document.getElementById('tournament-content').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--magic)">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${roundsDone}/${totalRounds}</div><div class="stat-lbl">Rondas</div></div>
      <div class="stat-box"><div class="stat-val">${players.filter(p=>(p.losses||0)===0&&roundsDone>0).length||'—'}</div><div class="stat-lbl">Invictos</div></div>
    </div>

    <!-- Jugadores -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🧙 Jugadores (${players.length})</span>
        ${owner && t.status!=='finished' ? `<div style="display:flex;gap:6px">
          ${t.status==='upcoming'
            ? `<button class="btn btn-primary btn-sm" onclick="startCommander()">▶ Iniciar torneo</button>`
            : roundsLeft>0
            ? `<button class="btn btn-sm" onclick="generateAndShowPods()">🔀 Ronda ${roundsDone+1}</button>`
            : `<button class="btn btn-cream btn-sm" onclick="closeCommander()">🏆 Finalizar</button>`}
        </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status!=='finished' ? `
          <div class="add-row" style="margin-bottom:10px">
            <input class="input" id="cmdr-pname" type="text" placeholder="Agregar jugador manualmente"
              onkeydown="if(event.key==='Enter')addPlayer('cmdr-pname')">
            <button class="btn" onclick="addPlayer('cmdr-pname')">+ Agregar</button>
          </div>` : ''}
        ${renderJoinButton()}
        <div class="chips">
          ${players.map(p=>`
            <div class="chip">
              ${p.user_id?'👤':'🤖'} ${escHtml(p.name)}
              ${(p.losses||0)===0&&roundsDone>0?'<span style="color:var(--green);font-size:10px">●</span>':''}
              ${owner&&t.status!=='finished'?`<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>`:''}
            </div>`).join('')}
          ${players.length===0?'<span style="color:var(--muted);font-size:13px">Sin jugadores</span>':''}
        </div>
        ${players.length>0?`<p style="font-size:12px;color:var(--muted);margin-top:6px">
          ${Math.ceil(players.length/4)} pod(s) · ${totalRounds} rondas · <strong style="color:var(--magic)">${CMD_PTS_DESC[ptsSystem]}</strong>
        </p>`:''}
      </div>
    </div>

    <!-- Pods de la ronda actual -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🎯 Pods — Ronda ${roundsDone>0?roundsDone:'—'}</span>
        ${owner&&t.status==='active'?`<button class="btn btn-primary btn-sm" onclick="confirmRoundAndAdvance()">✅ Confirmar ronda</button>`:''}
      </div>
      <div class="section-body" id="cmdr-pods-body">
        <div class="empty-state" style="padding:16px">
          ${t.status==='upcoming'?'Inicia el torneo para generar pods':roundsLeft<=0?'Todas las rondas completadas':'Generando pods...'}
        </div>
      </div>
    </div>

    <!-- Clasificación -->
    <div class="section">
      <div class="section-head"><span class="section-title">🏆 Clasificación</span></div>
      <div class="section-body" id="cmdr-standings-body">${renderCommanderStandings(players)}</div>
    </div>
  `;

  if (roundsDone>0) loadAndShowCurrentPods();
}

// ── INICIAR Y GENERAR PODS ────────────────────────────────
async function startCommander() {
  if (tournamentPlayers.length<2) { showToast('Necesitas al menos 2 jugadores'); return; }
  await _supabase.from('tournaments').update({status:'active'}).eq('id',currentTournament.id);
  currentTournament.status='active';
  AudioFX.roundStart();
  await generateAndShowPods();
}

async function generateAndShowPods() {
  const t = currentTournament;
  const totalRounds = t.total_rounds||3;
  if ((t.current_round||0) >= totalRounds) { showToast('Ya se jugaron todas las rondas'); return; }

  // Verificar ronda anterior completa
  if ((t.current_round||0)>0) {
    const {data:pending} = await _supabase.from('pod_sessions').select('id')
      .eq('tournament_id',t.id).eq('round',t.current_round).eq('is_confirmed',false);
    if (pending&&pending.length>0) { showToast(`Faltan ${pending.length} pod(s) por confirmar`); return; }
  }

  // Ordenar por puntos (mejores juntos), desempate aleatorio
  const sorted = [...tournamentPlayers].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins)||(Math.random()-.5));
  const newRound = (t.current_round||0)+1;
  const pods = buildPods(sorted);

  // Guardar pod_sessions en DB
  for (let pi=0; pi<pods.length; pi++) {
    const pod = pods[pi];
    await _supabase.from('pod_sessions').upsert({
      tournament_id: t.id,
      round: newRound,
      pod_number: pi+1,
      player_ids: JSON.stringify(pod.map(p=>p.id)),
      player_names: JSON.stringify(pod.map(p=>p.name)),
      result_data: null,
      is_confirmed: false
    }, {onConflict:'tournament_id,round,pod_number'});
  }

  await _supabase.from('tournaments').update({current_round:newRound}).eq('id',t.id);
  currentTournament.current_round = newRound;

  AudioFX.roundStart();
  showToast(`Ronda ${newRound}/${totalRounds} generada ✓`);
  await loadPlayers();
  renderCommanderView();
}

function buildPods(sorted) {
  const pods = [];
  for (let i=0; i<sorted.length; i+=4) {
    const chunk = sorted.slice(i, Math.min(i+4,sorted.length));
    if (pods.length>0&&chunk.length===1) pods[pods.length-1].push(chunk[0]);
    else pods.push(chunk);
  }
  return pods;
}

// ── CARGAR Y MOSTRAR PODS (todas las rondas) ────────────
async function loadAndShowCurrentPods() {
  // Cargar ronda actual para edición
  const {data:current} = await _supabase.from('pod_sessions').select('*')
    .eq('tournament_id',currentTournament.id)
    .eq('round',currentTournament.current_round)
    .order('pod_number');

  if (!current||!current.length) return;
  window._cmdrSessions = current;

  // Cargar todas las rondas anteriores para historial
  const {data:allSessions} = await _supabase.from('pod_sessions').select('*')
    .eq('tournament_id',currentTournament.id)
    .order('round', {ascending:false})
    .order('pod_number');

  renderAdminPods(current, allSessions||[]);
}

const PLACE_ICONS = ['👑','🥈','🥉','4️⃣'];

function renderAdminPods(sessions, allSessions=[]) {
  const body = document.getElementById('cmdr-pods-body');
  if (!body) return;
  const ptsSystem = currentTournament.points_system||'standard';
  const isCEDH = ptsSystem==='cedh';
  const owner = isOwner();
  const currentRound = currentTournament.current_round||0;

  // Agrupar historial por ronda
  const byRound = {};
  allSessions.forEach(s => {
    if (!byRound[s.round]) byRound[s.round] = [];
    byRound[s.round].push(s);
  });

  let html = '';

  // ── RONDA ACTUAL (editable) ──
  html += `<div style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;color:var(--magic);text-transform:uppercase;
      letter-spacing:0.5px;margin-bottom:8px">Ronda ${currentRound} — En curso</div>
    <div class="pod-grid">
    ${sessions.map((s,pi) => {
      const playerIds = JSON.parse(s.player_ids||'[]');
      const playerNames = JSON.parse(s.player_names||'[]');
      const resultData = s.result_data ? JSON.parse(s.result_data) : {};
      const confirmed = s.is_confirmed;
      const players = playerIds.map((id,i)=>({id,name:playerNames[i]||'?'}));

      // Sort by place for confirmed pods
      const sortedPlayers = confirmed
        ? [...players].sort((a,b)=>(resultData[a.id]?.place||99)-(resultData[b.id]?.place||99))
        : players;

      return `<div class="pod-box" style="border-color:${confirmed?'var(--green)':'var(--border)'}">
        <div class="pod-name" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span>Pod ${s.pod_number} · ${players.length}p</span>
          <span style="font-size:11px;color:${confirmed?'var(--green)':'var(--muted)'}">
            ${confirmed?'✓ Confirmado':'Pendiente'}
          </span>
        </div>

        ${confirmed ? `
          <!-- RESULTADO CONFIRMADO -->
          ${owner ? `<button class="btn btn-xs btn-ghost" style="margin-bottom:6px;font-size:11px"
            onclick="openEditPodModal(${pi})">✏️ Editar resultado</button>` : ''}
          ${sortedPlayers.map((p,si)=>{
            const r = resultData[p.id]||{};
            const place = r.place||si+1;
            const kills = r.kills||0;
            const pts = isCEDH ? (r.kills||0)+(place===1?1:0) : getPts(ptsSystem,place,players.length);
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;
              border-bottom:1px solid var(--border);
              ${place===1?'background:rgba(61,212,160,0.05);border-radius:6px;padding:6px 8px;':''}">
              <span style="font-size:16px">${PLACE_ICONS[place-1]||place+'°'}</span>
              <span style="flex:1;font-size:13px;font-weight:${place===1?'700':'400'};
                color:${place===1?'var(--green)':'var(--text)'}">${escHtml(p.name)}</span>
              ${isCEDH?`<span style="font-size:12px;color:var(--muted)">${kills} 💀</span>`:''}
              <span style="font-size:12px;color:var(--magic);font-weight:600">+${pts}pts</span>
            </div>`;
          }).join('')}
        ` : `
          <!-- ENTRADA DE RESULTADOS -->
          ${isCEDH ? `
            <p style="font-size:11px;color:var(--muted);margin-bottom:8px">
              Selecciona el <strong>orden de eliminación</strong>. 
              El último en pie = 1°, el penúltimo = 2°, etc.
            </p>
            ${players.map((p,si)=>`
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
                <div class="seat-num">${si+1}</div>
                <div style="flex:1;font-size:13px;min-width:80px">${escHtml(p.name)}</div>
                <select class="place-sel" id="admin-pod${pi}-seat${si}" style="flex:1;min-width:120px">
                  <option value="">lugar</option>
                  <option value="1" ${resultData[p.id]?.place===1?'selected':''}>👑 1° Ganador</option>
                  <option value="2" ${resultData[p.id]?.place===2?'selected':''}>🥈 2° Último elim.</option>
                  <option value="3" ${resultData[p.id]?.place===3?'selected':''}>🥉 3° Eliminado</option>
                  ${players.length>=4?`<option value="4" ${resultData[p.id]?.place===4?'selected':''}>4️⃣ 4° Primer elim.</option>`:''}
                </select>
                <div style="display:flex;align-items:center;gap:4px">
                  <span style="font-size:11px;color:var(--muted)">💀</span>
                  <input class="score-in" id="admin-pod${pi}-kills${si}"
                    type="number" min="0" max="${players.length-1}"
                    placeholder="0" style="width:46px"
                    value="${resultData[p.id]?.kills??''}">
                </div>
              </div>`).join('')}
            <p style="font-size:10px;color:var(--muted);margin-top:4px">
              1°=1pt(victoria) · 💀=1pt por kill
            </p>
          ` : `
            ${players.map((p,si)=>`
              <div class="pod-player-row">
                <div class="seat-num">${si+1}</div>
                <div class="pod-pname">${escHtml(p.name)}</div>
                <select class="place-sel" id="admin-pod${pi}-seat${si}">
                  <option value="">lugar</option>
                  ${players.map((_,i)=>`<option value="${i+1}"
                    ${resultData[p.id]?.place===i+1?'selected':''}>${i+1}°</option>`).join('')}
                </select>
              </div>`).join('')}
          `}
          ${owner?`<button class="btn btn-sm w-full" style="margin-top:10px;border-color:var(--green);color:var(--green)"
            onclick="confirmPod(${pi})">✓ Confirmar Pod ${s.pod_number}</button>`:''}
        `}
      </div>`;
    }).join('')}
    </div>
  </div>`;

  // ── HISTORIAL DE RONDAS ANTERIORES ──
  const prevRounds = Object.keys(byRound)
    .map(Number)
    .filter(r => r < currentRound)
    .sort((a,b) => b-a);

  if (prevRounds.length > 0) {
    html += `<hr style="border-color:var(--border);margin:16px 0">
    <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;
      letter-spacing:0.5px;margin-bottom:12px">Historial de rondas</div>`;

    prevRounds.forEach(rn => {
      const roundSessions = byRound[rn].filter(s=>s.is_confirmed);
      if (!roundSessions.length) return;

      html += `<div style="margin-bottom:14px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600">
          Ronda ${rn}
        </div>
        <div class="pod-grid">`;

      roundSessions.forEach(s => {
        const playerIds = JSON.parse(s.player_ids||'[]');
        const playerNames = JSON.parse(s.player_names||'[]');
        const resultData = s.result_data ? JSON.parse(s.result_data) : {};
        const players = playerIds.map((id,i)=>({id,name:playerNames[i]||'?'}));
        const sorted = [...players].sort((a,b)=>(resultData[a.id]?.place||99)-(resultData[b.id]?.place||99));

        html += `<div class="pod-box" style="opacity:0.85;border-color:var(--border)">
          <div class="pod-name" style="margin-bottom:8px">Pod ${s.pod_number}</div>
          ${sorted.map(p=>{
            const r = resultData[p.id]||{};
            const place = r.place||'?';
            const kills = r.kills||0;
            const pts = isCEDH ? kills+(place===1?1:0) : (place!=='?'?getPts(ptsSystem,place,players.length):0);
            return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:14px">${PLACE_ICONS[place-1]||place+'°'}</span>
              <span style="flex:1;font-size:12px">${escHtml(p.name)}</span>
              ${isCEDH?`<span style="font-size:11px;color:var(--muted)">${kills}💀</span>`:''}
              <span style="font-size:11px;color:var(--magic)">+${pts}pts</span>
            </div>`;
          }).join('')}
        </div>`;
      });

      html += `</div></div>`;
    });
  }

  body.innerHTML = html;
}

function saveAdminPlacement(podIdx) {
  // Solo guarda localmente — se confirma con el botón
}

async function saveAdminCEDH(podIdx) {
  // Preview local
}

async function confirmPod(podIdx) {
  const sessions = window._cmdrSessions;
  if (!sessions||!sessions[podIdx]) return;
  const s = sessions[podIdx];
  const ptsSystem = currentTournament.points_system||'standard';
  const isCEDH = ptsSystem==='cedh';
  const playerIds = JSON.parse(s.player_ids||'[]');
  const playerNames = JSON.parse(s.player_names||'[]');
  const players = playerIds.map((id,i)=>({id,name:playerNames[i]}));
  const podSize = players.length;

  let resultData = {};

  if (isCEDH) {
    const places = players.map((_,si)=>parseInt(document.getElementById(`admin-pod${podIdx}-seat${si}`)?.value)||0);
    if (places.some(v=>v===0)) { showToast(`Pod ${s.pod_number}: asigna todos los lugares`); return; }
    if (new Set(places).size!==podSize) { showToast(`Pod ${s.pod_number}: lugares duplicados`); return; }
    // Leer kills del input del admin (o del reporte del jugador si no hay)
    players.forEach((p,si)=>{
      const adminKills = parseInt(document.getElementById(`admin-pod${podIdx}-kills${si}`)?.value);
      const playerKills = s.result_data ? (JSON.parse(s.result_data)[p.id]?.kills||0) : 0;
      resultData[p.id] = {
        place: places[si],
        kills: !isNaN(adminKills) ? adminKills : playerKills
      };
    });
  } else {
    const places = players.map((_,si)=>parseInt(document.getElementById(`admin-pod${podIdx}-seat${si}`)?.value)||0);
    if (places.some(v=>v===0)) { showToast(`Pod ${s.pod_number}: asigna todos los lugares`); return; }
    if (new Set(places).size!==podSize) { showToast(`Pod ${s.pod_number}: lugares duplicados`); return; }
    players.forEach((p,si)=>{ resultData[p.id]={place:places[si],kills:0}; });
  }

  // Guardar en DB
  await _supabase.from('pod_sessions').update({
    result_data: JSON.stringify(resultData),
    is_confirmed: true
  }).eq('id',s.id);

  // Actualizar puntos de jugadores
  for (const p of players) {
    const r = resultData[p.id];
    const dbPlayer = tournamentPlayers.find(tp=>tp.id===p.id);
    if (!dbPlayer) continue;
    let pts = 0;
    if (isCEDH) {
      pts = (r.kills||0) + (r.place===1?1:0);
    } else {
      const fn = CMD_PTS[ptsSystem]||CMD_PTS.standard;
      pts = fn(r.place,podSize);
    }
    await _supabase.from('players').update({
      points: (dbPlayer.points||0)+pts,
      wins:   (dbPlayer.wins||0)+(r.place===1?1:0)
    }).eq('id',p.id);
  }

  AudioFX.tap();
  showToast(`Pod ${s.pod_number} confirmado ✓`);
  await loadPlayers();
  await loadAndShowCurrentPods();

  const sb=document.getElementById('cmdr-standings-body');
  if(sb) sb.innerHTML=renderCommanderStandings(tournamentPlayers);
}

async function confirmRoundAndAdvance() {
  const sessions = window._cmdrSessions||[];
  const pending = sessions.filter(s=>!s.is_confirmed);
  if (pending.length>0) { showToast(`Faltan ${pending.length} pod(s) por confirmar`); return; }

  const totalRounds = currentTournament.total_rounds||3;
  const roundsDone = currentTournament.current_round||0;

  AudioFX.roundEnd();

  if (roundsDone>=totalRounds) {
    await closeCommander();
  } else {
    showToast(`Ronda ${roundsDone} completada — generando siguiente...`);
    setTimeout(()=>generateAndShowPods(), 800);
  }
}

async function closeCommander() {
  await _supabase.from('tournaments').update({status:'finished'}).eq('id',currentTournament.id);
  currentTournament.status='finished';
  AudioFX.victory();
  await loadPlayers();
  await registerHallOfFame(currentTournament.id);
  renderCommanderView();
  setTimeout(()=>showWinnerPopup(tournamentPlayers),600);
}

// ── SESIÓN INDIVIDUAL DEL JUGADOR ────────────────────────
async function openPlayerPodSession(tournamentId) {
  // Buscar el pod del jugador en la ronda actual
  const myPlayer = tournamentPlayers.find(p=>p.user_id===currentUser?.id);
  if (!myPlayer) { showToast('No estás inscrito en este torneo'); return; }

  const {data:sessions} = await _supabase.from('pod_sessions').select('*')
    .eq('tournament_id',tournamentId)
    .eq('round',currentTournament.current_round);

  if (!sessions||!sessions.length) { showToast('No hay ronda activa'); return; }

  // Encontrar mi pod
  const mySession = sessions.find(s=>{
    const ids = JSON.parse(s.player_ids||'[]');
    return ids.includes(myPlayer.id);
  });

  if (!mySession) { showToast('No se encontró tu mesa'); return; }

  // Cargar compañeros de mesa
  const playerIds = JSON.parse(mySession.player_ids||'[]');
  const playerNames = JSON.parse(mySession.player_names||'[]');
  const podPlayers = playerIds.map((id,i)=>({id, name:playerNames[i]||'?'}));

  startPlayerPodSession(currentTournament, mySession, myPlayer, podPlayers);
}

function startPlayerPodSession(tournament, session, myPlayer, podPlayers) {
  const startLife = 40;
  const lifePoints = {};
  podPlayers.forEach(p=>{ lifePoints[p.id]=startLife; });

  gameState = {
    tournament, players: podPlayers, myPlayer, session,
    lifePoints, commanderDmg: {}, kills: {}, eliminatedBy: null,
    activeGame:'life', freeMode:false, startLife,
    ptsSystem: tournament.points_system||'standard'
  };

  // Init commander damage tracking
  podPlayers.forEach(att=>{
    gameState.commanderDmg[att.id]={};
    podPlayers.forEach(vic=>{ if(att.id!==vic.id) gameState.commanderDmg[att.id][vic.id]=0; });
  });

  document.getElementById('game-title').textContent = `Pod ${session.pod_number} · R${session.round}`;
  document.getElementById('game-player-name').textContent = myPlayer.name;
  showScreen('screen-game');
  renderPlayerPodSession();
}

function renderPlayerPodSession() {
  const myId = gameState.myPlayer.id;
  const isCEDH = gameState.ptsSystem==='cedh';
  const content = document.getElementById('game-content');
  content.style.padding = '8px 12px';

  const tabs = isCEDH
    ? [['life','❤️ Vida'],['cmdr','⚔️ Daño Cdr'],['cedh','💀 Kills'],['spin','🎲 Dados']]
    : [['life','❤️ Vida'],['cmdr','⚔️ Daño Cdr'],['spin','🎲 Dados']];

  content.innerHTML = `
    <div class="game-tabs" style="margin-bottom:8px">
      ${tabs.map(([id,label])=>
        `<button class="game-tab ${gameState.activeGame===id?'active':''}"
          onclick="switchPodTab('${id}')">${label}</button>`
      ).join('')}
    </div>
    <div id="pod-tab-body" style="height:calc(100vh-160px);overflow-y:auto"></div>
  `;
  renderPodTab(gameState.activeGame);
}

function switchPodTab(tab) {
  AudioFX.tap();
  gameState.activeGame=tab;
  document.querySelectorAll('.game-tab').forEach(b=>{
    b.classList.toggle('active',b.textContent.includes(
      tab==='life'?'❤️':tab==='cmdr'?'⚔️':tab==='cedh'?'💀':'🎲'
    ));
  });
  renderPodTab(tab);
}

function renderPodTab(tab) {
  const el = document.getElementById('pod-tab-body');
  if (!el) return;
  if (tab==='life') renderMyLifeTab(el);
  else if (tab==='cmdr') renderMyCmdrDmgTab(el);
  else if (tab==='cedh') renderMyCEDHKillsTab(el);
  else if (tab==='spin') renderSpinContent(el);
}

// Mi vida + vida de compañeros (solo ver)
function renderMyLifeTab(el) {
  const myId = gameState.myPlayer.id;
  const players = gameState.players;
  const startLife = gameState.startLife;

  el.innerHTML = `<div style="display:grid;gap:10px">
    ${players.map(p=>{
      const isMine = p.id===myId;
      const life = gameState.lifePoints[p.id]??startLife;
      const dangerClass = life<=5?'critical':life<=10?'danger':'';
      return `<div class="life-counter ${isMine?'glow-pink':''}" style="padding:12px">
        <div class="life-player">${escHtml(p.name)}${isMine?' (tú)':''}</div>
        <div class="life-num ${dangerClass}" id="life-${p.id}" style="font-size:${isMine?'72px':'48px'}">${life}</div>
        ${isMine?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">
          <button class="life-btn minus" style="width:100%;height:40px" onclick="changeMyLife(-5)">−5</button>
          <button class="life-btn minus" style="width:100%;height:40px" onclick="changeMyLife(-1)">−1</button>
          <button class="life-btn plus"  style="width:100%;height:40px" onclick="changeMyLife(+1)">+1</button>
          <button class="life-btn plus"  style="width:100%;height:40px" onclick="changeMyLife(+5)">+5</button>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input class="life-in" id="my-life-custom" type="number" placeholder="±" style="flex:1">
          <button class="btn btn-sm" onclick="applyMyCustomLife()">Aplicar</button>
          <button class="btn btn-sm btn-ghost" onclick="resetMyLife()">↺</button>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

function changeMyLife(delta) {
  const myId = gameState.myPlayer.id;
  gameState.lifePoints[myId]=(gameState.lifePoints[myId]??40)+delta;
  const life=gameState.lifePoints[myId];
  const el=document.getElementById('life-'+myId);
  if(el){el.textContent=life;el.className='life-num'+(life<=5?' critical':life<=10?' danger':'');}
  delta<0?(life<=5?AudioFX.danger():AudioFX.minus()):AudioFX.plus();
  broadcastPodState();
}

function applyMyCustomLife() {
  const val=parseInt(document.getElementById('my-life-custom')?.value);
  if(!isNaN(val)){changeMyLife(val);document.getElementById('my-life-custom').value='';}
}

function resetMyLife() {
  AudioFX.tap();
  const myId=gameState.myPlayer.id;
  gameState.lifePoints[myId]=gameState.startLife;
  const el=document.getElementById('life-'+myId);
  if(el){el.textContent=gameState.startLife;el.className='life-num';}
}

// Daño de comandante que YO he recibido de cada oponente
function renderMyCmdrDmgTab(el) {
  const myId=gameState.myPlayer.id;
  const opponents=gameState.players.filter(p=>p.id!==myId);

  el.innerHTML = `
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Daño de comandante que has recibido. A 21 = eliminado.
    </p>
    <div class="cmdr-damage-grid" style="margin-bottom:16px">
      ${opponents.map(att=>{
        const dmg=gameState.commanderDmg[att.id]?.[myId]||0;
        return `<div class="cmdr-dmg-row">
          <div class="cmdr-dmg-name">De ${escHtml(att.name)}</div>
          <div class="cmdr-dmg-val ${dmg>=16?'danger':''}" id="rcvd-${att.id}">${dmg}</div>
          <div class="cmdr-dmg-btns">
            <button class="dmg-btn minus" onclick="changeDmgReceived('${att.id}',-1)">−</button>
            <button class="dmg-btn plus" onclick="changeDmgReceived('${att.id}',+1)">+</button>
            <button class="dmg-btn plus" onclick="changeDmgReceived('${att.id}',+2)">+2</button>
          </div>
          ${dmg>=21?'<span style="color:var(--red);font-size:11px;font-weight:700">💀 FATAL</span>':''}
        </div>`;
      }).join('')}
    </div>
    <hr>
    <p style="font-size:12px;color:var(--muted);margin:10px 0">Daño que tú has hecho con tu comandante:</p>
    <div class="cmdr-damage-grid">
      ${opponents.map(vic=>{
        const dmg=gameState.commanderDmg[myId]?.[vic.id]||0;
        return `<div class="cmdr-dmg-row">
          <div class="cmdr-dmg-name">A ${escHtml(vic.name)}</div>
          <div class="cmdr-dmg-val ${dmg>=16?'danger':''}" id="sent-${vic.id}">${dmg}</div>
          <div class="cmdr-dmg-btns">
            <button class="dmg-btn minus" onclick="changeDmgSent('${vic.id}',-1)">−</button>
            <button class="dmg-btn plus" onclick="changeDmgSent('${vic.id}',+1)">+</button>
            <button class="dmg-btn plus" onclick="changeDmgSent('${vic.id}',+2)">+2</button>
          </div>
          ${dmg>=21?'<span style="color:var(--std);font-size:11px;font-weight:700">💥 21+</span>':''}
        </div>`;
      }).join('')}
    </div>`;
}

function changeDmgReceived(attId, delta) {
  const myId=gameState.myPlayer.id;
  if(!gameState.commanderDmg[attId]) gameState.commanderDmg[attId]={};
  const next=Math.max(0,(gameState.commanderDmg[attId][myId]||0)+delta);
  gameState.commanderDmg[attId][myId]=next;
  const el=document.getElementById('rcvd-'+attId);
  if(el){el.textContent=next;el.className='cmdr-dmg-val'+(next>=16?' danger':'');}
  if(next>=21){AudioFX.danger();showToast('💀 ¡Daño de comandante fatal!');}
  else delta>0?AudioFX.minus():AudioFX.tap();
  broadcastPodState();
}

function changeDmgSent(vicId, delta) {
  const myId=gameState.myPlayer.id;
  if(!gameState.commanderDmg[myId]) gameState.commanderDmg[myId]={};
  const next=Math.max(0,(gameState.commanderDmg[myId][vicId]||0)+delta);
  gameState.commanderDmg[myId][vicId]=next;
  const el=document.getElementById('sent-'+vicId);
  if(el){el.textContent=next;el.className='cmdr-dmg-val'+(next>=16?' danger':'');}
  delta>0?AudioFX.plus():AudioFX.tap();
  broadcastPodState();
}

// Registro de kills cEDH
function renderMyCEDHKillsTab(el) {
  const myId=gameState.myPlayer.id;
  const opponents=gameState.players.filter(p=>p.id!==myId);
  const myKills=gameState.kills||{};
  const iWon=gameState.iWonThePod||false;

  el.innerHTML=`
    <p style="font-size:13px;color:var(--muted);margin-bottom:12px">
      Marca a quién eliminaste y si ganaste la mesa. Recuerda: 1pt por kill + 1pt por ganar.
    </p>

    <!-- ¿Gané la mesa? -->
    <div style="padding:12px;margin-bottom:12px;
      background:${iWon?'rgba(61,212,160,0.12)':'var(--dark3)'};
      border:2px solid ${iWon?'var(--green)':'var(--border2)'};border-radius:var(--radius)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:700;color:${iWon?'var(--green)':'var(--text)'}">
            ${iWon?'👑 Gané la mesa':'¿Ganaste la mesa?'}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">+1 punto adicional por ganar</div>
        </div>
        ${iWon
          ?`<button class="btn btn-xs btn-ghost" onclick="setIWon(false)">Deshacer</button>`
          :`<button class="btn btn-sm" style="border-color:var(--green);color:var(--green)"
              onclick="setIWon(true)">👑 Sí, gané</button>`}
      </div>
    </div>

    <!-- Kills -->
    <p style="font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600">
      💀 Jugadores que eliminé (1pt c/u):
    </p>
    <div style="display:grid;gap:8px;margin-bottom:14px">
      ${opponents.map(opp=>{
        const killed=myKills[opp.id]||false;
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
          background:${killed?'rgba(224,23,106,0.1)':'var(--dark3)'};
          border:1px solid ${killed?'var(--pink)':'var(--border)'};border-radius:var(--radius)">
          <div style="flex:1;font-size:13px;font-weight:${killed?'700':'400'};
            color:${killed?'var(--pink-light)':'var(--text)'}">${escHtml(opp.name)}</div>
          ${killed
            ?`<span style="color:var(--pink-light);font-size:12px">+1pt 💀</span>
              <button class="btn btn-xs btn-ghost" onclick="toggleKill('${opp.id}',false)">✕</button>`
            :`<button class="btn btn-sm" style="border-color:var(--red);color:var(--red)"
                onclick="toggleKill('${opp.id}',true)">💀 Lo eliminé</button>`}
        </div>`;
      }).join('')}
    </div>

    <!-- Resumen de puntos -->
    <div style="padding:10px 12px;background:var(--dark3);border-radius:var(--radius);margin-bottom:12px;
      border:1px solid var(--border2)">
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Mi puntaje esta ronda:</div>
      <div style="font-size:20px;font-weight:700;color:var(--magic)">
        ${Object.values(myKills).filter(Boolean).length + (iWon?1:0)} pts
        <span style="font-size:12px;color:var(--muted);font-weight:400">
          (${Object.values(myKills).filter(Boolean).length} kills${iWon?' + 1 victoria':''})
        </span>
      </div>
    </div>

    <hr style="margin:12px 0">

    <!-- ¿Quién me eliminó? -->
    <div style="padding:12px;background:var(--dark3);border-radius:var(--radius);margin-bottom:12px">
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px">¿Quién me eliminó a mí?</p>
      ${gameState.eliminatedBy
        ?`<div style="color:var(--red);font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px">
            💀 Fui eliminado por: ${gameState.eliminatedBy==='survived'
              ?'<span style="color:var(--green)">Nadie — sobreviví</span>'
              :escHtml(gameState.players.find(p=>p.id===gameState.eliminatedBy)?.name||'?')}
            <button class="btn btn-xs btn-ghost" onclick="setEliminatedBy(null)">Cambiar</button>
          </div>`
        :`<div style="display:flex;flex-wrap:wrap;gap:6px">
            ${opponents.map(opp=>
              `<button class="btn btn-sm" onclick="setEliminatedBy('${opp.id}')">
                ${escHtml(opp.name)} me eliminó
              </button>`
            ).join('')}
            <button class="btn btn-sm" style="border-color:var(--green);color:var(--green)"
              onclick="setEliminatedBy('survived')">Sobreviví / Gané</button>
          </div>`}
    </div>

    <button class="btn btn-primary w-full" onclick="submitCEDHReport()">
      📤 Enviar reporte al admin
    </button>`;
}

function setIWon(val) {
  AudioFX.tap();
  gameState.iWonThePod = val;
  // Si gané, automáticamente marco que sobreviví
  if (val) gameState.eliminatedBy = 'survived';
  renderPodTab('cedh');
}

function toggleKill(oppId, killed) {
  AudioFX.tap();
  if(!gameState.kills) gameState.kills={};
  gameState.kills[oppId]=killed;
  renderPodTab('cedh');
}

function setEliminatedBy(playerId) {
  AudioFX.tap();
  gameState.eliminatedBy=playerId;
  renderPodTab('cedh');
}

async function submitCEDHReport() {
  const myId=gameState.myPlayer.id;
  const kills=gameState.kills||{};
  const killCount=Object.values(kills).filter(Boolean).length;
  const iWon=gameState.iWonThePod||false;
  const survived=gameState.eliminatedBy==='survived'||gameState.eliminatedBy===null;
  const totalPts=killCount+(iWon?1:0);

  const {data:session}=await _supabase.from('pod_sessions').select('*')
    .eq('id',gameState.session.id).single();

  let reportData=session.result_data?JSON.parse(session.result_data):{};
  reportData[myId]={
    kills: killCount,
    won: iWon,
    pts: totalPts,
    eliminatedBy: gameState.eliminatedBy,
    survived
  };

  await _supabase.from('pod_sessions').update({
    result_data:JSON.stringify(reportData)
  }).eq('id',gameState.session.id);

  AudioFX.roundEnd();
  showToast(`✓ Reporte enviado — ${totalPts}pts esta ronda`);
}

// ── BROADCAST REALTIME ENTRE JUGADORES DEL POD ───────────
async function broadcastPodState() {
  if(!gameState.session) return;
  const ch=_supabase.channel(`pod-${gameState.session.id}`);
  ch.send({type:'broadcast',event:'pod_state',payload:{
    lifePoints:gameState.lifePoints,
    commanderDmg:gameState.commanderDmg,
    senderId:currentUser?.id
  }});
}

function subscribePodBroadcast(sessionId) {
  _supabase.channel(`pod-${sessionId}`)
    .on('broadcast',{event:'pod_state'},(payload)=>{
      if(payload.payload.senderId===currentUser?.id) return;
      const myId=gameState.myPlayer?.id;
      // Actualizar vidas de compañeros
      Object.entries(payload.payload.lifePoints||{}).forEach(([pid,life])=>{
        if(pid!==myId){
          gameState.lifePoints[pid]=life;
          const el=document.getElementById('life-'+pid);
          if(el) el.textContent=life;
        }
      });
      // Actualizar daño de comandante recibido
      Object.entries(payload.payload.commanderDmg||{}).forEach(([att,victims])=>{
        if(att!==myId) gameState.commanderDmg[att]=victims;
        if(gameState.activeGame==='cmdr') renderPodTab('cmdr');
      });
    }).subscribe();
}

// ── STANDINGS ────────────────────────────────────────────
function renderCommanderStandings(players) {
  if(!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';
  const sorted=[...players].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  const rankIcon=['👑','🥈','🥉'];
  const sys=currentTournament?.points_system||'standard';
  return `<table class="t-table">
    <thead><tr><th>#</th><th>Jugador</th><th>Victorias</th><th>Puntos</th></tr></thead>
    <tbody>${sorted.map((p,i)=>`
      <tr class="${i===0?'rank-1':''}">
        <td>${rankIcon[i]||i+1}</td>
        <td>${escHtml(p.name)}${(p.losses||0)===0&&(currentTournament?.current_round||0)>0?
          ' <span style="color:var(--green);font-size:10px">●</span>':''}</td>
        <td><span class="pill pill-w">${p.wins||0}</span></td>
        <td><strong style="color:var(--magic)">${p.points||0}</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:11px;color:var(--muted);margin-top:8px">${CMD_PTS_DESC[sys]}</p>`;
}
