// =============================================
// ELIMINACIÓN DIRECTA — Standard Bo3 / Beyblade Bo3
// =============================================

function renderEliminationView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();
  const isBey = t.type === 'beyblade';
  const color = isBey ? 'var(--bey)' : 'var(--std)';
  const icon = isBey ? '🌀' : '🃏';

  document.getElementById('tournament-content').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:${color}">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${t.current_round}</div><div class="stat-lbl">Ronda</div></div>
      <div class="stat-box"><div class="stat-val">${players.filter(p => !p.eliminated).length}</div><div class="stat-lbl">En pie</div></div>
    </div>

    <!-- Players -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">${icon} Participantes (${players.length})</span>
        ${owner && t.status === 'active' ? `<div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="generateElimRound()">🔀 Generar ronda</button>
          <button class="btn btn-sm btn-danger" onclick="finalizarElimination()">Finalizar</button>
        </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status === 'active' ? `
          <div class="add-row" style="margin-bottom:10px">
            ${isBey ? `
              <input class="input" id="elim-pname" type="text" placeholder="Nombre" onkeydown="if(event.key==='Enter')addPlayer('elim-pname','elim-bey')">
              <input class="input" id="elim-bey" type="text" placeholder="Beyblade (opcional)" onkeydown="if(event.key==='Enter')addPlayer('elim-pname','elim-bey')">
              <button class="btn" onclick="addPlayer('elim-pname','elim-bey')">+</button>
            ` : `
              <input class="input" id="elim-pname" type="text" placeholder="Nombre del jugador" onkeydown="if(event.key==='Enter')addPlayer('elim-pname')">
              <button class="btn" onclick="addPlayer('elim-pname')">+ Agregar</button>
            `}
          </div>` : ''}
        <div class="chips">
          ${players.map(p => `
            <div class="chip" style="${p.eliminated ? 'opacity:0.4;text-decoration:line-through' : ''}">
              ${escHtml(p.name)}${p.bey_name ? ` <span style="color:var(--muted)">(${escHtml(p.bey_name)})</span>` : ''}
              ${!p.eliminated && owner && t.status === 'active' && t.current_round === 0 ? `<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>` : ''}
            </div>`).join('')}
          ${players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores aún</span>' : ''}
        </div>
      </div>
    </div>

    <!-- Bracket -->
    <div class="section">
      <div class="section-head"><span class="section-title">🏅 Bracket</span></div>
      <div class="section-body" id="elim-bracket-body">
        <div class="empty-state" style="padding:16px">Cargando...</div>
      </div>
    </div>

    <!-- Standings -->
    <div class="section">
      <div class="section-head"><span class="section-title">🏆 Clasificación final</span></div>
      <div class="section-body" id="elim-standings-body">
        ${renderElimStandings(players)}
      </div>
    </div>
  `;

  loadElimBracket();
}

async function loadElimBracket() {
  const { data: matches } = await _supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'elimination')
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });

  const body = document.getElementById('elim-bracket-body');
  if (!body) return;

  if (!matches || !matches.length) {
    body.innerHTML = `<div class="empty-state" style="padding:16px">
      <p>Agrega jugadores y presiona <strong>🔀 Generar ronda</strong></p>
    </div>`;
    return;
  }

  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const roundNames = ['Final', 'Semifinal', 'Cuartos', 'Octavos', 'Ronda de 16', 'Ronda de 32'];

  body.innerHTML = Object.keys(rounds).sort((a,b) => b-a).map(rn => {
    const roundMatches = rounds[rn];
    const total = Object.keys(rounds).length;
    const rLabel = roundNames[total - parseInt(rn)] || `Ronda ${rn}`;
    return `<div class="bracket-round">
      <div class="bracket-round-title">${rLabel}</div>
      ${roundMatches.map(m => renderElimMatch(m)).join('')}
    </div>`;
  }).join('');
}

function renderElimMatch(m) {
  const p1 = tournamentPlayers.find(p => p.id === m.player1_id);
  const p2 = tournamentPlayers.find(p => p.id === m.player2_id);
  const p1name = p1?.name || m.player1_name || '?';
  const p2name = p2 ? (p2.name || m.player2_name) : 'BYE';
  const owner = isOwner();
  const active = currentTournament.status === 'active';
  const isCurrent = m.round === currentTournament.current_round;

  let w1class = '', w2class = '';
  if (m.is_complete) {
    if (m.winner_id === m.player1_id) { w1class = 'winner'; w2class = 'loser'; }
    else if (m.winner_id === m.player2_id) { w1class = 'loser'; w2class = 'winner'; }
  }

  const isBye = !m.player2_id;

  return `<div class="match-card" id="ematch-${m.id}">
    <div class="match-player ${w1class}">${escHtml(p1name)}</div>
    <div class="match-vs">vs</div>
    ${isBye ? `
      <div class="match-player" style="color:var(--muted2)">BYE</div>
      <div class="match-actions"><span class="pill pill-w">Auto ✓</span></div>
    ` : `
      <div class="match-player ${w2class}">${escHtml(p2name)}</div>
      <div class="match-actions">
        ${m.is_complete ? `
          <span class="pill pill-w" style="font-size:12px">${m.score_p1}–${m.score_p2}</span>
        ` : owner && active && isCurrent ? `
          <div class="score-wrap">
            <input class="score-in" id="em${m.id}-s1" type="number" min="0" max="2" placeholder="0" onchange="autoSaveElimScore('${m.id}')">
            <span class="score-sep">–</span>
            <input class="score-in" id="em${m.id}-s2" type="number" min="0" max="2" placeholder="0" onchange="autoSaveElimScore('${m.id}')">
            <button class="result-btn result-btn-confirm" onclick="confirmElimMatch('${m.id}','${m.player1_id}','${m.player2_id}')">✓</button>
          </div>
        ` : '<span style="color:var(--muted);font-size:12px">Pendiente</span>'}
      </div>
    `}
  </div>`;
}

async function generateElimRound() {
  const players = tournamentPlayers;
  if (players.length < 2) { showToast('Necesitas al menos 2 participantes'); return; }

  // Check pending matches
  if (currentTournament.current_round > 0) {
    const { data: pending } = await _supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', currentTournament.id)
      .eq('match_type', 'elimination')
      .eq('round', currentTournament.current_round)
      .eq('is_complete', false);

    if (pending && pending.length > 0) {
      showToast(`Completa los ${pending.length} partidos pendientes`);
      return;
    }

    // Check if only 1 player left
    const { data: lastRound } = await _supabase
      .from('matches')
      .select('winner_id')
      .eq('tournament_id', currentTournament.id)
      .eq('match_type', 'elimination')
      .eq('round', currentTournament.current_round);

    const winners = [...new Set(lastRound.map(m => m.winner_id).filter(Boolean))];
    if (winners.length <= 1) {
      showToast('¡Torneo finalizado! Ya hay un campeón'); return;
    }
  }

  const newRound = (currentTournament.current_round || 0) + 1;

  // Determine who plays
  let participants = [];
  if (currentTournament.current_round === 0) {
    participants = shuffle([...players]);
  } else {
    // Winners from last round
    const { data: lastRound } = await _supabase
      .from('matches')
      .select('winner_id')
      .eq('tournament_id', currentTournament.id)
      .eq('match_type', 'elimination')
      .eq('round', currentTournament.current_round);

    const winnerIds = lastRound.map(m => m.winner_id).filter(Boolean);
    participants = shuffle(players.filter(p => winnerIds.includes(p.id)));
  }

  // Build pairings
  const pairings = [];
  for (let i = 0; i < participants.length; i += 2) {
    const p1 = participants[i];
    const p2 = participants[i + 1] || null;
    pairings.push({ p1, p2 });
  }

  // Save to DB
  const inserts = pairings.map((pair, idx) => ({
    tournament_id: currentTournament.id,
    round: newRound,
    match_number: idx + 1,
    match_type: 'elimination',
    player1_id: pair.p1.id,
    player1_name: pair.p1.name,
    player2_id: pair.p2?.id || null,
    player2_name: pair.p2?.name || null,
    is_complete: !pair.p2,
    winner_id: !pair.p2 ? pair.p1.id : null,
    score_p1: !pair.p2 ? 2 : null,
    score_p2: !pair.p2 ? 0 : null
  }));

  await _supabase.from('matches').insert(inserts);
  await _supabase.from('tournaments').update({ current_round: newRound }).eq('id', currentTournament.id);
  currentTournament.current_round = newRound;

  await loadPlayers();
  renderEliminationView();
  showToast(`Ronda ${newRound} generada`);
}

async function autoSaveElimScore(matchId) {
  const s1 = parseInt(document.getElementById(`em${matchId}-s1`)?.value);
  const s2 = parseInt(document.getElementById(`em${matchId}-s2`)?.value);
  if (!isNaN(s1) && !isNaN(s2) && (s1 === 2 || s2 === 2) && s1 + s2 >= 2 && s1 + s2 <= 3) {
    await _confirmElimMatchById(matchId, s1, s2);
  }
}

async function confirmElimMatch(matchId, p1Id, p2Id) {
  const s1 = parseInt(document.getElementById(`em${matchId}-s1`)?.value) || 0;
  const s2 = parseInt(document.getElementById(`em${matchId}-s2`)?.value) || 0;
  if (s1 + s2 < 2) { showToast('Bo3: mínimo 2 juegos'); return; }
  if (s1 > 2 || s2 > 2) { showToast('Máximo 2 victorias'); return; }
  if (s1 !== 2 && s2 !== 2) { showToast('Alguien debe ganar 2'); return; }
  await _confirmElimMatchById(matchId, s1, s2);
}

async function _confirmElimMatchById(matchId, s1, s2) {
  const { data: match } = await _supabase.from('matches').select('*').eq('id', matchId).single();
  if (!match || match.is_complete) return;

  const winnerId = s1 >= s2 ? match.player1_id : match.player2_id;
  const loserId  = winnerId === match.player1_id ? match.player2_id : match.player1_id;

  await _supabase.from('matches').update({
    score_p1: s1, score_p2: s2, winner_id: winnerId, is_complete: true
  }).eq('id', matchId);

  // Leer datos FRESCOS de la DB — no confiar en tournamentPlayers que puede estar desfasado
  const { data: freshPlayers } = await _supabase
    .from('players').select('id, wins, losses, points, game_wins, game_losses')
    .in('id', [winnerId, loserId]);

  const winner = freshPlayers?.find(p => p.id === winnerId);
  const loser  = freshPlayers?.find(p => p.id === loserId);

  if (winner) await _supabase.from('players').update({
    wins:       (winner.wins  || 0) + 1,
    points:     (winner.points|| 0) + 3,
    game_wins:  (winner.game_wins  || 0) + (s1 > s2 ? s1 : s2),
    game_losses:(winner.game_losses|| 0) + (s1 > s2 ? s2 : s1)
  }).eq('id', winner.id);
  else console.error('_confirmElimMatchById: no se encontró al ganador en DB', winnerId);

  if (loser) await _supabase.from('players').update({
    losses:     (loser.losses || 0) + 1,
    eliminated: true,
    game_wins:  (loser.game_wins  || 0) + (s1 < s2 ? s1 : s2),
    game_losses:(loser.game_losses|| 0) + (s1 < s2 ? s2 : s1)
  }).eq('id', loser.id);
  else console.error('_confirmElimMatchById: no se encontró al perdedor en DB', loserId);

  await loadPlayers();
  await loadElimBracket();
  const sb = document.getElementById('elim-standings-body');
  if (sb) sb.innerHTML = renderElimStandings(tournamentPlayers);
  showToast('Resultado guardado ✓');
}

function renderElimStandings(players) {
  if (!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';
  const sorted = [...players].sort((a, b) => (b.wins || 0) - (a.wins || 0));
  const rankIcon = ['👑', '🥈', '🥉'];
  const isBey = currentTournament?.type === 'beyblade';

  return `<table class="t-table">
    <thead><tr>
      <th>#</th><th>Jugador</th>${isBey ? '<th>Beyblade</th>' : ''}<th>V</th><th>D</th><th>Estado</th>
    </tr></thead>
    <tbody>
      ${sorted.map((p, i) => `
        <tr class="${i === 0 ? 'rank-1' : ''}">
          <td>${rankIcon[i] || (i + 1)}</td>
          <td>${escHtml(p.name)}</td>
          ${isBey ? `<td style="color:var(--muted);font-size:12px">${p.bey_name ? escHtml(p.bey_name) : '—'}</td>` : ''}
          <td><span class="pill pill-w">${p.wins || 0}</span></td>
          <td><span class="pill pill-l">${p.losses || 0}</span></td>
          <td>${p.eliminated ? '<span style="color:var(--muted);font-size:12px">Eliminado</span>' : '<span style="color:var(--std);font-size:12px">● En juego</span>'}</td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}


// ── FINALIZAR TORNEO DE ELIMINACIÓN ───────────────────────
async function finalizarElimination() {
  await setTournamentStatus('finished');
  await registerHallOfFame(currentTournament.id);
  renderEliminationView();
  setTimeout(() => showWinnerPopup(tournamentPlayers), 600);
}
