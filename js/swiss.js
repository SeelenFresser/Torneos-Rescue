// =============================================
// SWISS — Standard Bo3 / Beyblade Bo3
// Rondas automáticas: máx 4, deja 1-4 invictos
// =============================================

// Calcula rondas necesarias: ceil(log2(n)), máx 4
function calcTotalRounds(n) {
  if (n <= 1) return 1;
  return Math.min(4, Math.ceil(Math.log2(n)));
}

function renderSwissView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();
  const isBey = t.type === 'beyblade';
  const color = isBey ? 'var(--bey)' : 'var(--std)';
  const icon = isBey ? '🌀' : '🃏';
  const totalRounds = calcTotalRounds(players.length);
  const roundsDone = t.current_round;
  const roundsLeft = Math.max(0, totalRounds - roundsDone);
  const myPlayer = tournamentPlayers.find(p => p.user_id === currentUser?.id);

  document.getElementById('tournament-content').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:${color}">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${roundsDone}/${totalRounds}</div><div class="stat-lbl">Rondas</div></div>
      <div class="stat-box"><div class="stat-val">${players.filter(p=>(p.losses||0)===0).length}</div><div class="stat-lbl">Invictos</div></div>
    </div>

    ${renderJoinButton()}
    ${renderTournamentControls()}

    <!-- Players -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">${icon} Jugadores (${players.length})</span>
        ${owner && t.status !== 'finished' ? `
          <div style="display:flex;gap:6px">
            ${roundsDone === 0 ? `<button class="btn btn-primary btn-sm" onclick="startSwiss()">▶ Iniciar torneo</button>` :
              roundsLeft > 0 ? `<button class="btn btn-sm" onclick="generateSwissRound()">▶ Ronda ${roundsDone+1}</button>` :
              `<button class="btn btn-sm btn-cream" onclick="finalizarSwiss()">🏆 Ver campeón</button>`}
          </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status === 'upcoming' ? `
          <div class="add-row" style="margin-bottom:10px">
            ${isBey ? `
              <input class="input" id="swiss-pname" type="text" placeholder="Nombre" onkeydown="if(event.key==='Enter')addPlayer('swiss-pname','swiss-bey')">
              <input class="input" id="swiss-bey" type="text" placeholder="Beyblade (opcional)">
              <button class="btn" onclick="addPlayer('swiss-pname','swiss-bey')">+</button>
            ` : `
              <input class="input" id="swiss-pname" type="text" placeholder="Agregar jugador manualmente" onkeydown="if(event.key==='Enter')addPlayer('swiss-pname')">
              <button class="btn" onclick="addPlayer('swiss-pname')">+</button>
            `}
          </div>` : ''}
        <div class="chips">
          ${players.map(p => `
            <div class="chip">
              ${p.user_id ? '👤' : '🤖'} ${escHtml(p.name)}
              ${p.bey_name ? ` <span style="color:var(--muted)">(${escHtml(p.bey_name)})</span>` : ''}
              ${(p.losses||0) === 0 && roundsDone > 0 ? '<span style="color:var(--green);font-size:10px">●</span>' : ''}
              ${owner && t.status === 'upcoming' ? `<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>` : ''}
            </div>`).join('')}
          ${players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores aún</span>' : ''}
        </div>
        ${players.length > 0 && roundsDone === 0 ? `
          <p style="font-size:12px;color:var(--muted);margin-top:6px">
            📊 Con ${players.length} jugadores → <strong style="color:${color}">${totalRounds} rondas</strong> en formato Swiss Bo3
          </p>` : ''}
      </div>
    </div>

    <!-- Rounds -->
    <div class="section">
      <div class="section-head"><span class="section-title">📋 Rondas</span></div>
      <div class="section-body" id="swiss-rounds-body">
        <div class="empty-state" style="padding:16px">Cargando...</div>
      </div>
    </div>

    <!-- Standings -->
    <div class="section">
      <div class="section-head"><span class="section-title">🏆 Clasificación</span></div>
      <div class="section-body" id="swiss-standings-body">
        ${renderSwissStandings(players)}
      </div>
    </div>
  `;

  loadSwissRounds();
}

async function startSwiss() {
  if (tournamentPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }
  await setTournamentStatus('active');
  await generateSwissRound();
}

async function finalizarSwiss() {
  await setTournamentStatus('finished');
  renderSwissView();
}

async function loadSwissRounds() {
  const { data: matches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'swiss')
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });

  const body = document.getElementById('swiss-rounds-body');
  if (!body) return;

  if (!matches || !matches.length) {
    body.innerHTML = `<div class="empty-state" style="padding:16px">
      ${isOwner() ? 'Presiona <strong>▶ Iniciar torneo</strong> para generar la primera ronda' : 'El torneo aún no ha iniciado'}
    </div>`;
    return;
  }

  const rounds = {};
  matches.forEach(m => { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });

  body.innerHTML = Object.keys(rounds).sort((a,b) => b-a).map(rn => {
    const roundMatches = rounds[rn];
    const allDone = roundMatches.every(m => m.is_complete);
    return `<div class="bracket-round">
      <div class="bracket-round-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Ronda ${rn}</span>
        <span style="font-size:11px;color:${allDone ? 'var(--green)' : 'var(--muted)'}">${allDone ? '✓ Completa' : 'En curso'}</span>
      </div>
      ${roundMatches.map(m => renderSwissMatch(m, parseInt(rn))).join('')}
    </div>`;
  }).join('');
}

function renderSwissMatch(m, round) {
  const p1 = tournamentPlayers.find(p => p.id === m.player1_id);
  const p2 = tournamentPlayers.find(p => p.id === m.player2_id);
  const p1name = p1?.name || m.player1_name || '?';
  const p2name = p2 ? p2.name : 'BYE';
  const owner = isOwner();
  const active = currentTournament.status === 'active';
  const isCurrent = round === currentTournament.current_round;

  let w1 = '', w2 = '';
  if (m.is_complete) {
    if (m.winner_id === m.player1_id) { w1 = 'winner'; w2 = 'loser'; }
    else if (m.winner_id === m.player2_id) { w1 = 'loser'; w2 = 'winner'; }
  }

  const isBye = !m.player2_id;

  return `<div class="match-card" id="match-${m.id}">
    <div class="match-player ${w1}">${escHtml(p1name)}</div>
    <div class="match-vs">vs</div>
    ${isBye ? `
      <div class="match-player" style="color:var(--muted2)">BYE</div>
      <div class="match-actions"><span class="pill pill-w">Auto ✓</span></div>
    ` : `
      <div class="match-player ${w2}">${escHtml(p2name)}</div>
      <div class="match-actions">
        ${m.is_complete
          ? `<span class="pill pill-w">${m.score_p1}–${m.score_p2}</span>`
          : owner && active && isCurrent
          ? `<div class="score-wrap">
               <input class="score-in" id="m${m.id}-s1" type="number" min="0" max="2" placeholder="0" onchange="autoSaveSwissScore('${m.id}')">
               <span class="score-sep">–</span>
               <input class="score-in" id="m${m.id}-s2" type="number" min="0" max="2" placeholder="0" onchange="autoSaveSwissScore('${m.id}')">
               <button class="result-btn result-btn-confirm" onclick="confirmSwissMatch('${m.id}')">✓</button>
             </div>`
          : `<span style="color:var(--muted);font-size:12px">Pendiente</span>`}
      </div>
    `}
  </div>`;
}

async function generateSwissRound() {
  const players = tournamentPlayers;
  if (players.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }

  const totalRounds = calcTotalRounds(players.length);

  // Bloquear si ya se jugaron todas las rondas
  if (currentTournament.current_round >= totalRounds) {
    showToast(`Ya se jugaron las ${totalRounds} rondas del torneo`); return;
  }

  // Verificar que la ronda actual esté completa
  if (currentTournament.current_round > 0) {
    const { data: pending } = await _supabase
      .from('matches').select('id')
      .eq('tournament_id', currentTournament.id)
      .eq('round', currentTournament.current_round)
      .eq('is_complete', false);
    if (pending && pending.length > 0) {
      showToast(`Faltan ${pending.length} resultado(s) en la ronda actual`); return;
    }
  }

  const newRound = (currentTournament.current_round || 0) + 1;

  // Obtener partidos anteriores para evitar rematches
  const { data: prevMatches } = await _supabase
    .from('matches').select('player1_id,player2_id')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'swiss');

  const prevPairs = new Set((prevMatches || []).map(m => [m.player1_id, m.player2_id].sort().join('|')));

  // Ordenar por puntos desc, luego aleatorio para desempate
  const sorted = [...players].sort((a, b) => (b.points - a.points) || (Math.random() - 0.5));

  const pairings = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    const p1 = sorted[i];
    let p2 = null;

    // Buscar oponente sin rematch primero
    for (let j = i + 1; j < sorted.length; j++) {
      if (!used.has(sorted[j].id)) {
        const key = [p1.id, sorted[j].id].sort().join('|');
        if (!prevPairs.has(key)) { p2 = sorted[j]; break; }
      }
    }
    // Si no hay oponente fresco, tomar el siguiente disponible
    if (!p2) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (!used.has(sorted[j].id)) { p2 = sorted[j]; break; }
      }
    }

    if (p2) {
      pairings.push({ p1, p2 });
      used.add(p1.id); used.add(p2.id);
    } else {
      pairings.push({ p1, p2: null }); // BYE
      used.add(p1.id);
    }
  }

  const inserts = pairings.map((pair, idx) => ({
    tournament_id: currentTournament.id,
    round: newRound,
    match_number: idx + 1,
    match_type: 'swiss',
    player1_id: pair.p1.id,
    player1_name: pair.p1.name,
    player2_id: pair.p2?.id || null,
    player2_name: pair.p2?.name || null,
    is_complete: !pair.p2,
    winner_id: !pair.p2 ? pair.p1.id : null,
    score_p1: !pair.p2 ? 2 : null,
    score_p2: !pair.p2 ? 0 : null
  }));

  const { error } = await _supabase.from('matches').insert(inserts);
  if (error) { showToast('Error: ' + error.message); return; }

  // Dar puntos por BYE
  for (const pair of pairings) {
    if (!pair.p2) {
      await _supabase.from('players').update({
        wins: (pair.p1.wins || 0) + 1,
        points: (pair.p1.points || 0) + 3,
        game_wins: (pair.p1.game_wins || 0) + 2
      }).eq('id', pair.p1.id);
    }
  }

  await _supabase.from('tournaments').update({ current_round: newRound }).eq('id', currentTournament.id);
  currentTournament.current_round = newRound;

  await loadPlayers();
  renderSwissView();

  const roundsLeft = Math.max(0, totalRounds - newRound);
  showToast(`Ronda ${newRound}/${totalRounds} generada${roundsLeft === 0 ? ' · ¡Última ronda!' : ''}`);
}

async function autoSaveSwissScore(matchId) {
  const s1 = parseInt(document.getElementById(`m${matchId}-s1`)?.value);
  const s2 = parseInt(document.getElementById(`m${matchId}-s2`)?.value);
  if (!isNaN(s1) && !isNaN(s2) && (s1 === 2 || s2 === 2) && s1 + s2 >= 2 && s1 + s2 <= 3) {
    await _confirmSwissMatchById(matchId, s1, s2);
  }
}

async function confirmSwissMatch(matchId) {
  const s1 = parseInt(document.getElementById(`m${matchId}-s1`)?.value) || 0;
  const s2 = parseInt(document.getElementById(`m${matchId}-s2`)?.value) || 0;
  if (s1 + s2 < 2) { showToast('Mínimo 2 juegos (ej: 2-0 o 2-1)'); return; }
  if (s1 > 2 || s2 > 2) { showToast('Máximo 2 victorias en Bo3'); return; }
  if (s1 !== 2 && s2 !== 2) { showToast('Alguien debe llegar a 2 victorias'); return; }
  await _confirmSwissMatchById(matchId, s1, s2);
}

async function _confirmSwissMatchById(matchId, s1, s2) {
  const { data: match } = await _supabase.from('matches').select('*').eq('id', matchId).single();
  if (!match || match.is_complete) return;

  const winnerId = s1 > s2 ? match.player1_id : match.player2_id;

  await _supabase.from('matches').update({
    score_p1: s1, score_p2: s2, winner_id: winnerId, is_complete: true
  }).eq('id', matchId);

  const p1 = tournamentPlayers.find(p => p.id === match.player1_id);
  const p2 = tournamentPlayers.find(p => p.id === match.player2_id);

  if (p1) await _supabase.from('players').update({
    wins:        (p1.wins   || 0) + (s1 > s2 ? 1 : 0),
    losses:      (p1.losses || 0) + (s1 < s2 ? 1 : 0),
    points:      (p1.points || 0) + (s1 > s2 ? 3 : 0),
    game_wins:   (p1.game_wins   || 0) + s1,
    game_losses: (p1.game_losses || 0) + s2
  }).eq('id', p1.id);

  if (p2) await _supabase.from('players').update({
    wins:        (p2.wins   || 0) + (s2 > s1 ? 1 : 0),
    losses:      (p2.losses || 0) + (s2 < s1 ? 1 : 0),
    points:      (p2.points || 0) + (s2 > s1 ? 3 : 0),
    game_wins:   (p2.game_wins   || 0) + s2,
    game_losses: (p2.game_losses || 0) + s1
  }).eq('id', p2.id);

  await loadPlayers();
  await loadSwissRounds();
  const sb = document.getElementById('swiss-standings-body');
  if (sb) sb.innerHTML = renderSwissStandings(tournamentPlayers);

  // Auto-generar siguiente ronda si todos los partidos están completos
  const totalRounds = calcTotalRounds(tournamentPlayers.length);
  const { data: pending } = await _supabase
    .from('matches').select('id')
    .eq('tournament_id', currentTournament.id)
    .eq('round', currentTournament.current_round)
    .eq('is_complete', false);

  if ((!pending || pending.length === 0) && currentTournament.current_round < totalRounds) {
    setTimeout(() => {
      showToast('✓ Ronda completa — generando siguiente...');
      setTimeout(() => generateSwissRound(), 1200);
    }, 400);
  } else if (!pending || pending.length === 0) {
    showToast('🏆 ¡Todas las rondas completadas!');
    renderSwissView();
  } else {
    showToast('Resultado guardado ✓');
  }
}

function renderSwissStandings(players) {
  if (!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';

  const sorted = [...players].sort((a, b) => {
    const ptsDiff = (b.points || 0) - (a.points || 0);
    if (ptsDiff !== 0) return ptsDiff;
    return ((b.game_wins||0) - (b.game_losses||0)) - ((a.game_wins||0) - (a.game_losses||0));
  });

  const rankIcon = ['👑', '🥈', '🥉'];
  const isBey = currentTournament?.type === 'beyblade';
  const totalRounds = calcTotalRounds(players.length);

  return `<table class="t-table">
    <thead><tr>
      <th>#</th><th>Jugador</th>${isBey ? '<th>Beyblade</th>' : ''}<th>V</th><th>D</th><th>GD</th><th>Pts</th>
    </tr></thead>
    <tbody>
      ${sorted.map((p, i) => {
        const gd = (p.game_wins||0) - (p.game_losses||0);
        const invicto = (p.losses||0) === 0 && currentTournament.current_round > 0;
        const color = isBey ? 'var(--bey)' : 'var(--std)';
        return `<tr class="${i===0?'rank-1':''}">
          <td>${rankIcon[i] || (i+1)}</td>
          <td>${escHtml(p.name)} ${invicto ? '<span style="color:var(--green);font-size:10px">● invicto</span>' : ''}</td>
          ${isBey ? `<td style="color:var(--muted);font-size:12px">${p.bey_name ? escHtml(p.bey_name) : '—'}</td>` : ''}
          <td><span class="pill pill-w">${p.wins||0}</span></td>
          <td><span class="pill pill-l">${p.losses||0}</span></td>
          <td style="color:${gd>=0?'var(--std)':'var(--red)'}">${gd>0?'+':''}${gd}</td>
          <td><strong style="color:${color}">${p.points||0}</strong></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <p style="font-size:11px;color:var(--muted);margin-top:8px">V=3pts · GD=diferencia de juegos · ● invicto</p>`;
}
