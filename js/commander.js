// =============================================
// COMMANDER — PODS (2–32 jugadores)
// Rondas fijas · Emparejamiento por puntos
// =============================================

// Sistemas de puntos
const POINTS_SYSTEMS = {
  A: { 1:10, 2:6,  3:3,  4:1  },
  B: { 1:7,  2:4,  3:2,  4:1  },
  C: { 1:4,  2:2,  3:1,  4:0  },
  D: { 1:1,  2:0,  3:0,  4:0  }
};
const POINTS_LABELS = {
  A: '1°=10 · 2°=6 · 3°=3 · 4°=1',
  B: '1°=7 · 2°=4 · 3°=2 · 4°=1',
  C: '1°=4 · 2°=2 · 3°=1 · 4°=0',
  D: 'Solo victoria (1°=1pt)'
};

function getPtsMap(system, podSize) {
  const base = POINTS_SYSTEMS[system] || POINTS_SYSTEMS.A;
  if (podSize === 2) return { 1: base[1], 2: base[4] };
  if (podSize === 3) return { 1: base[1], 2: Math.round((base[1]+base[2])/2), 3: base[4] };
  return base;
}

function renderCommanderView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();
  const totalRounds = t.total_rounds || 3;
  const roundsDone  = t.current_round || 0;
  const roundsLeft  = totalRounds - roundsDone;
  const ptsSystem   = t.points_system || 'A';
  const podCount    = Math.ceil(players.length / 4);

  const content = document.getElementById('tournament-content');
  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--magic)">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${roundsDone}/${totalRounds}</div><div class="stat-lbl">Rondas</div></div>
      <div class="stat-box"><div class="stat-val">${podCount}</div><div class="stat-lbl">Pods</div></div>
    </div>

    <!-- Players Section -->
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
          <input class="input" id="cmdr-player-name" type="text" placeholder="Nombre del jugador (2–32)"
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
            📊 ${players.length} jugadores · ${podCount} pod(s) · ${totalRounds} rondas · Pts: <strong style="color:var(--magic)">${POINTS_LABELS[ptsSystem]}</strong>
          </p>` : ''}
      </div>
    </div>

    <!-- Pods Section -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🎯 Pods — Ronda ${roundsDone > 0 ? roundsDone : '—'}</span>
        ${owner && t.status === 'active' && roundsLeft > 0 ? `<button class="btn btn-sm" onclick="saveCommanderResults()">💾 Guardar ronda</button>` : ''}
      </div>
      <div class="section-body" id="cmdr-pods-body">
        <div class="empty-state" style="padding:20px">
          <div class="empty-icon">🎲</div>
          <p>${t.status === 'upcoming' ? 'Inicia el torneo para generar los pods' : roundsLeft <= 0 ? '¡Todas las rondas completadas!' : 'Presiona "🔀 Ronda" para generar los pods'}</p>
        </div>
      </div>
    </div>

    <!-- Standings -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🏆 Tabla de posiciones</span>
      </div>
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
  await generateCommanderPods();
}

function generateCommanderPods() {
  const players = tournamentPlayers;
  if (players.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }

  // Ordenar por puntos desc (mejores juntos), luego aleatorio para desempate
  const sorted = [...players].sort((a, b) => (b.points - a.points) || (Math.random() - 0.5));

  const pods = [];
  const podSize = 4;

  for (let i = 0; i < sorted.length; i += podSize) {
    const chunk = sorted.slice(i, Math.min(i + podSize, sorted.length));
    // Si el último chunk tiene 1 jugador, unirlo al anterior
    if (pods.length > 0 && chunk.length === 1) {
      pods[pods.length - 1].push(...chunk);
    } else {
      pods.push(chunk);
    }
  }

  window._cmdrCurrentPods = pods;
  renderCommanderPodsFromArrays(pods);
}

function renderCommanderPodsFromArrays(pods) {
  const body = document.getElementById('cmdr-pods-body');
  if (!body) return;
  const owner = isOwner();
  const active = currentTournament.status === 'active';
  const ptsSystem = currentTournament.points_system || 'A';

  body.innerHTML = `<div class="pod-grid">
    ${pods.map((pod, pi) => `
      <div class="pod-box">
        <div class="pod-name">Pod ${pi + 1} · ${pod.length} jugadores</div>
        ${pod.map((p, si) => `
          <div class="pod-player-row">
            <div class="seat-num">${si + 1}</div>
            <div class="pod-pname">${escHtml(p.name)}</div>
            ${owner && active ? `
            <select class="place-sel" id="cmdr-pod${pi}-seat${si}">
              <option value="">—</option>
              ${pod.map((_, i) => `<option value="${i+1}">${i+1}°</option>`).join('')}
            </select>` : ''}
          </div>
        `).join('')}
        ${owner && active ? `
        <div style="margin-top:8px;font-size:11px;color:var(--muted)">
          Pts: ${getPtsLabels(ptsSystem, pod.length)}
        </div>` : ''}
      </div>
    `).join('')}
  </div>`;
}

function getPtsLabels(system, size) {
  const map = getPtsMap(system, size);
  return Object.entries(map).map(([place, pts]) => `${place}°=${pts}`).join(' · ');
}

async function loadCommanderPods() {
  if (!currentTournament.current_round) return;
  const { data } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'commander')
    .eq('round', currentTournament.current_round);

  if (!data || !data.length) return;

  // Reconstruir pods desde la DB
  const pods = [];
  const sorted = [...data].sort((a, b) => (a.pod_number || 0) - (b.pod_number || 0));
  sorted.forEach(m => {
    if (!m.players_data) return;
    const ids = JSON.parse(m.players_data);
    const players = ids.map(id => tournamentPlayers.find(p => p.id === id)).filter(Boolean);
    pods.push(players);
  });

  if (pods.length) {
    window._cmdrCurrentPods = pods;
    renderCommanderPodsFromArrays(pods);

    // Restaurar resultados guardados
    sorted.forEach((m, pi) => {
      if (m.result_data) {
        const results = JSON.parse(m.result_data);
        const pod = pods[pi];
        if (!pod) return;
        pod.forEach((p, si) => {
          const sel = document.getElementById(`cmdr-pod${pi}-seat${si}`);
          if (sel && results[p.id]) sel.value = results[p.id];
        });
      }
    });
  }
}

async function saveCommanderResults() {
  const pods = window._cmdrCurrentPods;
  if (!pods || !pods.length) { showToast('Genera los pods primero'); return; }

  const ptsSystem = currentTournament.points_system || 'A';

  // Validar todos los lugares asignados y únicos por pod
  for (let pi = 0; pi < pods.length; pi++) {
    const pod = pods[pi];
    const places = pod.map((_, si) => parseInt(document.getElementById(`cmdr-pod${pi}-seat${si}`)?.value) || 0);
    if (places.some(v => v === 0)) { showToast(`Pod ${pi + 1}: asigna todos los lugares`); return; }
    if (new Set(places).size !== pod.length) { showToast(`Pod ${pi + 1}: lugares duplicados`); return; }
  }

  const newRound = (currentTournament.current_round || 0) + 1;

  for (let pi = 0; pi < pods.length; pi++) {
    const pod = pods[pi];
    const places = pod.map((_, si) => parseInt(document.getElementById(`cmdr-pod${pi}-seat${si}`)?.value));
    const ptsMap = getPtsMap(ptsSystem, pod.length);

    const resultData = {};
    pod.forEach((p, si) => { resultData[p.id] = places[si]; });

    await _supabase.from('matches').upsert({
      tournament_id: currentTournament.id,
      round: newRound,
      pod_number: pi + 1,
      match_type: 'commander',
      players_data: JSON.stringify(pod.map(p => p.id)),
      result_data: JSON.stringify(resultData),
      is_complete: true
    }, { onConflict: 'tournament_id,round,pod_number' });

    // Actualizar puntos de cada jugador
    for (let si = 0; si < pod.length; si++) {
      const p = pod[si];
      const place = places[si];
      const pts = ptsMap[place] || 0;
      const isWin = place === 1;
      await _supabase.from('players').update({
        points: (p.points || 0) + pts,
        wins:   (p.wins   || 0) + (isWin ? 1 : 0)
      }).eq('id', p.id);
    }
  }

  await _supabase.from('tournaments').update({ current_round: newRound }).eq('id', currentTournament.id);
  currentTournament.current_round = newRound;

  await loadPlayers();
  renderCommanderView();

  const totalRounds = currentTournament.total_rounds || 3;
  const roundsLeft = totalRounds - newRound;
  if (roundsLeft <= 0) {
    showToast(`✅ Ronda ${newRound} guardada — ¡Torneo completo!`);
  } else {
    showToast(`✅ Ronda ${newRound}/${totalRounds} guardada · Quedan ${roundsLeft} ronda(s)`);
  }
}

function renderCommanderStandings(players) {
  if (!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';

  const sorted = [...players].sort((a, b) => (b.points - a.points) || (b.wins - a.wins));
  const rankIcon = ['👑', '🥈', '🥉'];
  const ptsSystem = currentTournament?.points_system || 'A';

  return `<table class="t-table">
    <thead><tr>
      <th>#</th><th>Jugador</th><th>Pods ganados</th><th>Puntos</th>
    </tr></thead>
    <tbody>
      ${sorted.map((p, i) => `
        <tr class="${i === 0 ? 'rank-1' : ''}">
          <td>${rankIcon[i] || (i + 1)}</td>
          <td>${escHtml(p.name)}</td>
          <td><span class="pill pill-w">${p.wins || 0}</span></td>
          <td><strong style="color:var(--magic)">${p.points || 0}</strong></td>
        </tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:11px;color:var(--muted);margin-top:8px">Sistema ${ptsSystem}: ${POINTS_LABELS[ptsSystem]}</p>`;
}

async function finishTournament() {
  await setTournamentStatus('finished');
}
