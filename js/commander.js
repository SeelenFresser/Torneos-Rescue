// =============================================
// COMMANDER — PODS (2–32 jugadores)
// Sistema de puntos estándar de tienda
// =============================================

const POINTS_SYSTEMS = {
  standard:  { label:'Estándar (tienda)',  desc:'1°=3pts · 2°=1pt · 3°=0 · 4°=0',   fn: (place, pod) => place===1?3:place===2?1:0 },
  placement: { label:'Placement completo', desc:'1°=10 · 2°=6 · 3°=3 · 4°=1',       fn: (place, pod) => ({1:10,2:6,3:3,4:1}[place]||0) },
  cedh:      { label:'cEDH (eliminaciones)',desc:'1pt/eliminación + 1pt ganar mesa',  fn: null }, // handled separately
  winner:    { label:'Solo victoria',      desc:'1°=1pt · resto=0',                  fn: (place, pod) => place===1?1:0 }
};

function getPts(system, place, podSize) {
  const s = POINTS_SYSTEMS[system] || POINTS_SYSTEMS.standard;
  if (!s.fn) return 0; // cEDH handled separately
  // Adjust for smaller pods
  if (system === 'standard') return place===1?3:place===2&&podSize>=3?1:0;
  if (system === 'placement') {
    if (podSize === 2) return place===1?5:1;
    if (podSize === 3) return {1:10,2:4,3:1}[place]||0;
    return {1:10,2:6,3:3,4:1}[place]||0;
  }
  return s.fn(place, podSize);
}

function renderCommanderView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();
  const totalRounds = t.total_rounds || 3;
  const roundsDone  = t.current_round || 0;
  const roundsLeft  = totalRounds - roundsDone;
  const ptsSystem   = t.points_system || 'standard';
  const podCount    = Math.ceil(players.length / 4);
  const sys         = POINTS_SYSTEMS[ptsSystem] || POINTS_SYSTEMS.standard;

  document.getElementById('tournament-content').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--magic)">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${roundsDone}/${totalRounds}</div><div class="stat-lbl">Rondas</div></div>
      <div class="stat-box"><div class="stat-val">${podCount}</div><div class="stat-lbl">Pods</div></div>
    </div>

    <!-- Players -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🧙 Jugadores (${players.length})</span>
        ${owner && t.status !== 'finished' ? `<div style="display:flex;gap:6px">
          ${t.status === 'upcoming'
            ? `<button class="btn btn-primary btn-sm" onclick="startCommander()">▶ Iniciar</button>`
            : roundsLeft > 0
            ? `<button class="btn btn-sm" onclick="generateCommanderPods()">🔀 Ronda ${roundsDone+1}</button>`
            : `<button class="btn btn-sm btn-cream" onclick="setTournamentStatus('finished')">🏆 Finalizar</button>`}
        </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status !== 'finished' ? `
        <div class="add-row" style="margin-bottom:10px">
          <input class="input" id="cmdr-player-name" type="text" placeholder="Agregar jugador manualmente"
            onkeydown="if(event.key==='Enter')addPlayer('cmdr-player-name')">
          <button class="btn" onclick="addPlayer('cmdr-player-name')">+ Agregar</button>
        </div>` : ''}
        ${renderJoinButton()}
        <div class="chips">
          ${players.map(p => `
            <div class="chip">
              ${p.user_id ? '👤' : '🤖'} ${escHtml(p.name)}
              ${owner && t.status !== 'finished' ? `<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>` : ''}
            </div>`).join('')}
          ${players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores aún</span>' : ''}
        </div>
        ${players.length > 0 ? `
        <p style="font-size:12px;color:var(--muted);margin-top:6px">
          ${podCount} pod(s) · ${totalRounds} rondas · <strong style="color:var(--magic)">${sys.desc}</strong>
        </p>` : ''}
      </div>
    </div>

    <!-- Pods -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🎯 Pods — Ronda ${roundsDone > 0 ? roundsDone : '—'}</span>
        ${owner && t.status === 'active' && roundsLeft > 0
          ? `<button class="btn btn-sm" onclick="saveCommanderResults()">💾 Guardar ronda</button>` : ''}
      </div>
      <div class="section-body" id="cmdr-pods-body">
        <div class="empty-state" style="padding:20px">
          <div class="empty-icon">🎲</div>
          <p>${t.status === 'upcoming' ? 'Inicia el torneo para generar pods'
              : roundsLeft <= 0 ? '¡Todas las rondas completadas!'
              : 'Presiona el botón de ronda para generar pods'}</p>
        </div>
      </div>
    </div>

    <!-- Standings -->
    <div class="section">
      <div class="section-head"><span class="section-title">🏆 Clasificación</span></div>
      <div class="section-body" id="cmdr-standings-body">
        ${renderCommanderStandings(players)}
      </div>
    </div>
  `;

  loadCommanderPods();
}

async function startCommander() {
  if (tournamentPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }
  await setTournamentStatus('active');
  AudioFX.roundStart();
  await generateCommanderPods();
}

function generateCommanderPods() {
  const players = tournamentPlayers;
  if (players.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }

  // Ordenar por puntos desc, desempate por wins, luego aleatorio
  const sorted = [...players].sort((a, b) =>
    (b.points - a.points) || (b.wins - a.wins) || (Math.random() - 0.5)
  );

  const pods = [];
  for (let i = 0; i < sorted.length; i += 4) {
    const chunk = sorted.slice(i, Math.min(i + 4, sorted.length));
    if (pods.length > 0 && chunk.length === 1) {
      pods[pods.length - 1].push(chunk[0]);
    } else {
      pods.push(chunk);
    }
  }

  window._cmdrCurrentPods = pods;
  renderCommanderPodsUI(pods);
}

function renderCommanderPodsUI(pods) {
  const body = document.getElementById('cmdr-pods-body');
  if (!body) return;
  const owner = isOwner();
  const active = currentTournament.status === 'active';
  const ptsSystem = currentTournament.points_system || 'standard';
  const isCEDH = ptsSystem === 'cedh';

  body.innerHTML = `<div class="pod-grid">
    ${pods.map((pod, pi) => `
      <div class="pod-box">
        <div class="pod-name">Pod ${pi+1} · ${pod.length} jugadores</div>
        ${pod.map((p, si) => `
          <div class="pod-player-row">
            <div class="seat-num">${si+1}</div>
            <div class="pod-pname">${escHtml(p.name)}</div>
            ${owner && active ? isCEDH
              ? `<input class="score-in" id="cmdr-pod${pi}-elim${si}" type="number" min="0" max="3"
                  placeholder="elim" style="width:48px;font-size:12px" title="Eliminaciones realizadas">`
              : `<select class="place-sel" id="cmdr-pod${pi}-seat${si}">
                  <option value="">lugar</option>
                  ${pod.map((_, i) => `<option value="${i+1}">${i+1}°</option>`).join('')}
                </select>`
            : ''}
          </div>
        `).join('')}
        <div style="margin-top:8px;font-size:11px;color:var(--muted)">
          ${isCEDH
            ? '1pt por eliminación + 1pt por ganar'
            : pod.map((_, i) => `${i+1}°=${getPts(ptsSystem,i+1,pod.length)}pts`).join(' · ')}
        </div>
      </div>
    `).join('')}
  </div>`;
}

async function loadCommanderPods() {
  if (!currentTournament.current_round) return;
  const { data } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'commander')
    .eq('round', currentTournament.current_round);
  if (!data || !data.length) return;

  const sorted = [...data].sort((a,b) => (a.pod_number||0) - (b.pod_number||0));
  const pods = sorted.map(m => {
    if (!m.players_data) return [];
    return JSON.parse(m.players_data).map(id => tournamentPlayers.find(p => p.id === id)).filter(Boolean);
  }).filter(p => p.length);

  if (!pods.length) return;
  window._cmdrCurrentPods = pods;
  renderCommanderPodsUI(pods);

  // Restaurar resultados guardados
  const ptsSystem = currentTournament.points_system || 'standard';
  const isCEDH = ptsSystem === 'cedh';
  sorted.forEach((m, pi) => {
    if (!m.result_data) return;
    const results = JSON.parse(m.result_data);
    const pod = pods[pi];
    if (!pod) return;
    pod.forEach((p, si) => {
      if (isCEDH) {
        const el = document.getElementById(`cmdr-pod${pi}-elim${si}`);
        if (el && results[p.id] !== undefined) el.value = results[p.id];
      } else {
        const sel = document.getElementById(`cmdr-pod${pi}-seat${si}`);
        if (sel && results[p.id]) sel.value = results[p.id];
      }
    });
  });
}

async function saveCommanderResults() {
  const pods = window._cmdrCurrentPods;
  if (!pods || !pods.length) { showToast('Genera los pods primero'); return; }

  const ptsSystem = currentTournament.points_system || 'standard';
  const isCEDH = ptsSystem === 'cedh';
  const newRound = (currentTournament.current_round || 0) + 1;

  if (isCEDH) {
    await saveCEDHResults(pods, newRound);
  } else {
    await savePlacementResults(pods, newRound, ptsSystem);
  }

  await _supabase.from('tournaments').update({ current_round: newRound }).eq('id', currentTournament.id);
  currentTournament.current_round = newRound;
  await loadPlayers();
  renderCommanderView();

  const totalRounds = currentTournament.total_rounds || 3;
  const roundsLeft = totalRounds - newRound;
  if (roundsLeft <= 0) {
    AudioFX.victory();
    showToast('✅ ¡Torneo completo!');
    setTimeout(() => showWinnerPopup(tournamentPlayers), 600);
  } else {
    AudioFX.roundEnd();
    showToast(`✅ Ronda ${newRound}/${totalRounds} · Quedan ${roundsLeft}`);
  }
}

async function savePlacementResults(pods, newRound, ptsSystem) {
  for (let pi = 0; pi < pods.length; pi++) {
    const pod = pods[pi];
    const places = pod.map((_, si) => parseInt(document.getElementById(`cmdr-pod${pi}-seat${si}`)?.value) || 0);

    if (places.some(v => v === 0)) { showToast(`Pod ${pi+1}: asigna todos los lugares`); return; }
    if (new Set(places).size !== pod.length) { showToast(`Pod ${pi+1}: hay lugares duplicados`); return; }

    const resultData = {};
    pod.forEach((p, si) => { resultData[p.id] = places[si]; });

    await _supabase.from('matches').upsert({
      tournament_id: currentTournament.id,
      round: newRound, pod_number: pi+1,
      match_type: 'commander',
      players_data: JSON.stringify(pod.map(p => p.id)),
      result_data: JSON.stringify(resultData),
      is_complete: true
    }, { onConflict: 'tournament_id,round,pod_number' });

    for (let si = 0; si < pod.length; si++) {
      const p = pod[si];
      const place = places[si];
      const pts = getPts(ptsSystem, place, pod.length);
      await _supabase.from('players').update({
        points: (p.points||0) + pts,
        wins:   (p.wins||0) + (place===1 ? 1 : 0)
      }).eq('id', p.id);
    }
  }
}

async function saveCEDHResults(pods, newRound) {
  for (let pi = 0; pi < pods.length; pi++) {
    const pod = pods[pi];
    const elims = pod.map((_, si) => parseInt(document.getElementById(`cmdr-pod${pi}-elim${si}`)?.value) || 0);
    const maxElims = Math.max(...elims);
    const winnerId = pod[elims.indexOf(maxElims)]?.id;
    const resultData = {};
    pod.forEach((p, si) => { resultData[p.id] = elims[si]; });

    await _supabase.from('matches').upsert({
      tournament_id: currentTournament.id,
      round: newRound, pod_number: pi+1,
      match_type: 'commander',
      players_data: JSON.stringify(pod.map(p => p.id)),
      result_data: JSON.stringify(resultData),
      is_complete: true
    }, { onConflict: 'tournament_id,round,pod_number' });

    for (let si = 0; si < pod.length; si++) {
      const p = pod[si];
      const elimPts = elims[si];
      const winPt   = p.id === winnerId ? 1 : 0;
      await _supabase.from('players').update({
        points: (p.points||0) + elimPts + winPt,
        wins:   (p.wins||0) + winPt
      }).eq('id', p.id);
    }
  }
}

function renderCommanderStandings(players) {
  if (!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';
  const sorted = [...players].sort((a,b) => (b.points-a.points)||(b.wins-a.wins));
  const rankIcon = ['👑','🥈','🥉'];
  const sys = POINTS_SYSTEMS[currentTournament?.points_system] || POINTS_SYSTEMS.standard;

  return `<table class="t-table">
    <thead><tr><th>#</th><th>Jugador</th><th>Victorias</th><th>Puntos</th></tr></thead>
    <tbody>
      ${sorted.map((p,i) => `
        <tr class="${i===0?'rank-1':''}">
          <td>${rankIcon[i]||i+1}</td>
          <td>${escHtml(p.name)}</td>
          <td><span class="pill pill-w">${p.wins||0}</span></td>
          <td><strong style="color:var(--magic)">${p.points||0}</strong></td>
        </tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:11px;color:var(--muted);margin-top:8px">${sys.label}: ${sys.desc} · Desempate por win% de oponentes</p>`;
}
