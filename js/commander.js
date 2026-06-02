// =============================================
// COMMANDER — PODS (2–32 jugadores)
// =============================================

function renderCommanderView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();

  const content = document.getElementById('tournament-content');

  // Stats
  const podCount = Math.ceil(players.length / 4);
  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--magic)">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${podCount}</div><div class="stat-lbl">Pods</div></div>
      <div class="stat-box"><div class="stat-val">${t.current_round}</div><div class="stat-lbl">Rondas</div></div>
    </div>

    <!-- Players Section -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🧙 Jugadores (${players.length})</span>
        ${owner && t.status === 'active' ? `<div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="generateCommanderPods()">🔀 Generar pods</button>
          <button class="btn btn-sm btn-danger" onclick="finishTournament()">Finalizar</button>
        </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status === 'active' ? `
        <div class="add-row" style="margin-bottom:10px">
          <input class="input" id="cmdr-player-name" type="text" placeholder="Nombre del jugador (2–32)" onkeydown="if(event.key==='Enter')addPlayer('cmdr-player-name')">
          <button class="btn" onclick="addPlayer('cmdr-player-name')">+ Agregar</button>
        </div>` : ''}
        <div class="chips">
          ${players.map(p => `
            <div class="chip">${escHtml(p.name)}
              ${owner && t.status === 'active' ? `<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>` : ''}
            </div>`).join('')}
          ${players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores aún</span>' : ''}
        </div>
      </div>
    </div>

    <!-- Pods Section -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🎯 Pods</span>
        ${owner && t.status === 'active' ? `<button class="btn btn-sm" onclick="saveCommanderResults()">💾 Guardar resultados</button>` : ''}
      </div>
      <div class="section-body" id="cmdr-pods-body">
        <div class="empty-state" style="padding:20px">
          <div class="empty-icon">🎲</div>
          <p>Genera los pods para empezar la ronda</p>
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

  // Load existing pods for current round
  loadCommanderPods();
}

async function loadCommanderPods() {
  if (!currentTournament.current_round) return;
  const { data } = await _supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('round', currentTournament.current_round);

  if (!data || !data.length) return;

  // Group by pod
  const pods = {};
  data.forEach(m => {
    const pod = m.pod_number || 1;
    if (!pods[pod]) pods[pod] = [];
    pods[pod].push(m);
  });

  renderCommanderPodsUI(pods, data);
}

function generateCommanderPods() {
  const players = tournamentPlayers;
  if (players.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }

  const shuffled = shuffle([...players]);
  const pods = [];
  const podSize = 4;

  for (let i = 0; i < shuffled.length; i += podSize) {
    const chunk = shuffled.slice(i, Math.min(i + podSize, shuffled.length));
    // If last chunk is 1 person, merge with previous
    if (pods.length > 0 && chunk.length === 1) {
      pods[pods.length - 1].push(...chunk);
    } else {
      pods.push(chunk);
    }
  }

  renderCommanderPodsFromArrays(pods);
}

function renderCommanderPodsFromArrays(pods) {
  // Build a pods display — store in state for saving
  window._cmdrCurrentPods = pods;

  const body = document.getElementById('cmdr-pods-body');
  if (!body) return;

  body.innerHTML = `<div class="pod-grid">
    ${pods.map((pod, pi) => `
      <div class="pod-box">
        <div class="pod-name">Pod ${pi + 1} · ${pod.length} jugadores</div>
        ${pod.map((p, si) => `
          <div class="pod-player-row">
            <div class="seat-num">${si + 1}</div>
            <div class="pod-pname">${escHtml(p.name)}</div>
            <select class="place-sel" id="cmdr-pod${pi}-seat${si}" ${currentTournament.status !== 'active' || !isOwner() ? 'disabled' : ''}>
              <option value="">—</option>
              ${pod.map((_, i) => `<option value="${i + 1}">${i + 1}°</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>
  <p style="font-size:11px;color:var(--muted);margin-top:10px">Puntos: 1° = 10 · 2° = 6 · 3° = 3 · 4° = 1 (pod de 3: 7/4/1 · pod de 2: 5/1)</p>`;
}

function renderCommanderPodsUI(pods, matches) {
  // Reconstruct pod arrays from match data
  const podArrays = [];
  Object.keys(pods).sort((a,b) => a-b).forEach(podNum => {
    const playerIds = pods[podNum][0].players_data
      ? JSON.parse(pods[podNum][0].players_data)
      : [];
    const players = playerIds.map(id => tournamentPlayers.find(p => p.id === id)).filter(Boolean);
    podArrays.push(players);
  });

  if (podArrays.length) {
    window._cmdrCurrentPods = podArrays;
    renderCommanderPodsFromArrays(podArrays);

    // Restore saved results
    matches.forEach((m, idx) => {
      if (m.players_data) {
        const playerIds = JSON.parse(m.players_data);
        const podIdx = Object.keys(pods).sort((a,b)=>a-b).indexOf(String(m.pod_number));
        const pod = podArrays[podIdx];
        if (pod && m.result_data) {
          const results = JSON.parse(m.result_data);
          pod.forEach((p, si) => {
            const sel = document.getElementById(`cmdr-pod${podIdx}-seat${si}`);
            if (sel && results[p.id]) sel.value = results[p.id];
          });
        }
      }
    });
  }
}

async function saveCommanderResults() {
  const pods = window._cmdrCurrentPods;
  if (!pods || !pods.length) { showToast('Genera los pods primero'); return; }

  // Validate all places assigned and unique per pod
  for (let pi = 0; pi < pods.length; pi++) {
    const pod = pods[pi];
    const places = pod.map((_, si) => {
      const sel = document.getElementById(`cmdr-pod${pi}-seat${si}`);
      return sel ? parseInt(sel.value) || 0 : 0;
    });
    if (places.some(v => v === 0)) { showToast(`Pod ${pi + 1}: asigna todos los lugares`); return; }
    if (new Set(places).size !== pod.length) { showToast(`Pod ${pi + 1}: lugares duplicados`); return; }
  }

  // Calculate points
  const ptMap = { 1: 10, 2: 6, 3: 3, 4: 1 };
  const ptMap3 = { 1: 7, 2: 4, 3: 1 };
  const ptMap2 = { 1: 5, 2: 1 };

  const newRound = (currentTournament.current_round || 0) + 1;

  // Save matches
  for (let pi = 0; pi < pods.length; pi++) {
    const pod = pods[pi];
    const places = pod.map((_, si) => {
      const sel = document.getElementById(`cmdr-pod${pi}-seat${si}`);
      return parseInt(sel.value);
    });

    const resultData = {};
    pod.forEach((p, si) => { resultData[p.id] = places[si]; });

    // Upsert match record
    await _supabase.from('matches').upsert({
      tournament_id: currentTournament.id,
      round: newRound,
      pod_number: pi + 1,
      match_type: 'commander',
      players_data: JSON.stringify(pod.map(p => p.id)),
      result_data: JSON.stringify(resultData),
      is_complete: true
    }, { onConflict: 'tournament_id,round,pod_number' });

    // Update player points
    for (let si = 0; si < pod.length; si++) {
      const p = pod[si];
      const place = places[si];
      const pts = pod.length === 2 ? (ptMap2[place] || 0) : pod.length === 3 ? (ptMap3[place] || 0) : (ptMap[place] || 0);
      const isWin = place === 1;

      await _supabase.from('players').update({
        points: (p.points || 0) + pts,
        wins: (p.wins || 0) + (isWin ? 1 : 0)
      }).eq('id', p.id);
    }
  }

  // Advance round
  await _supabase.from('tournaments').update({ current_round: newRound }).eq('id', currentTournament.id);
  currentTournament.current_round = newRound;

  await loadPlayers();
  renderCommanderView();
  showToast(`Ronda ${newRound} guardada ✓`);
}

function renderCommanderStandings(players) {
  if (!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';

  const sorted = [...players].sort((a, b) => (b.points - a.points) || (b.wins - a.wins));
  const rankIcon = ['👑', '🥈', '🥉'];

  return `<table class="t-table">
    <thead><tr>
      <th>#</th><th>Jugador</th><th>Victorias</th><th>Puntos</th>
    </tr></thead>
    <tbody>
      ${sorted.map((p, i) => `
        <tr class="${i === 0 ? 'rank-1' : ''}">
          <td>${rankIcon[i] || (i + 1)}</td>
          <td>${escHtml(p.name)}</td>
          <td>${p.wins || 0}</td>
          <td><strong style="color:var(--magic)">${p.points || 0}</strong></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}
