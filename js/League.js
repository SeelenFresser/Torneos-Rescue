// =============================================
// LIGA — Round Robin + Playoff Champions
// MTG Standard · Bo3 · 20 vidas · Side deck
// =============================================

// ── GENERAR RONDAS ROUND ROBIN ────────────────
// Con n jugadores se necesitan n-1 rondas (si n es par)
// o n rondas (si n es impar) para que todos jueguen contra todos

function generateRoundRobin(players) {
  const n = players.length;
  const rounds = [];
  const ids = players.map(p => p.id);

  // Si n es impar, agregar un BYE
  if (n % 2 !== 0) ids.push('BYE');
  const total = ids.length;
  const numRounds = total - 1;

  for (let r = 0; r < numRounds; r++) {
    const round = [];
    for (let i = 0; i < total / 2; i++) {
      const p1 = ids[i];
      const p2 = ids[total - 1 - i];
      if (p1 !== 'BYE' && p2 !== 'BYE') {
        round.push({ p1, p2 });
      } else {
        // BYE — el jugador que toca BYE recibe punto de asistencia automático
        const realPlayer = p1 === 'BYE' ? p2 : p1;
        round.push({ p1: realPlayer, p2: null }); // null = BYE
      }
    }
    rounds.push(round);
    // Rotar: fijar el primero, rotar el resto
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

// ── VISTA DE LIGA ──────────────────────────────
function renderLeagueView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();
  const currentWeek = t.current_round || 0;
  const totalWeeks = t.total_rounds || (players.length % 2 === 0 ? players.length - 1 : players.length);
  const phase = t.league_phase || 'regular'; // 'regular' | 'playoff' | 'finished'

  document.getElementById('tournament-content').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--std)">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${currentWeek}/${totalWeeks}</div><div class="stat-lbl">Semanas</div></div>
      <div class="stat-box"><div class="stat-val">${phase==='regular'?'Liga':phase==='playoff'?'Playoff':'Final'}</div><div class="stat-lbl">Fase</div></div>
    </div>

    <!-- Jugadores -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🃏 Jugadores (${players.length})</span>
        ${owner && t.status !== 'finished' ? `<div style="display:flex;gap:6px">
          ${t.status === 'upcoming' ? `
            <button class="btn btn-primary btn-sm" onclick="startLeague()">▶ Iniciar liga</button>
          ` : phase === 'regular' && currentWeek < totalWeeks ? `
            <button class="btn btn-sm" onclick="generateNextWeek()">📅 Semana ${currentWeek+1}</button>
          ` : phase === 'regular' && currentWeek >= totalWeeks ? `
            <button class="btn btn-cream btn-sm" onclick="startLeaguePlayoff()">🏆 Iniciar Playoff</button>
          ` : ''}
        </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status === 'upcoming' ? `
          <div class="add-row" style="margin-bottom:10px">
            <input class="input" id="league-pname" type="text" placeholder="Agregar jugador"
              onkeydown="if(event.key==='Enter')addPlayer('league-pname')">
            <button class="btn" onclick="addPlayer('league-pname')">+</button>
          </div>` : ''}
        ${renderJoinButton()}
        <div class="chips">
          ${players.map(p => `
            <div class="chip">
              ${p.user_id ? '👤' : '🤖'} ${escHtml(p.name)}
              ${owner && t.status === 'upcoming' ? `<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>` : ''}
            </div>`).join('')}
          ${players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores</span>' : ''}
        </div>
        ${players.length >= 2 && t.status === 'upcoming' ? `
          <p style="font-size:12px;color:var(--muted);margin-top:6px">
            📊 ${players.length} jugadores → <strong style="color:var(--std)">${players.length%2===0?players.length-1:players.length} semanas</strong> de liga
          </p>` : ''}
      </div>
    </div>

    <!-- Semana actual -->
    ${phase === 'regular' ? `
    <div class="section">
      <div class="section-head">
        <span class="section-title">📅 Semana ${currentWeek} ${currentWeek > 0 ? '' : '— No iniciada'}</span>
      </div>
      <div class="section-body" id="league-week-body">
        <div class="empty-state" style="padding:16px">Cargando...</div>
      </div>
    </div>` : phase === 'playoff' ? renderPlayoffSection(t, players) : ''}

    <!-- Clasificación -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🏆 Clasificación</span>
      </div>
      <div class="section-body" id="league-standings-body">
        ${renderLeagueStandings(players)}
      </div>
    </div>

    <!-- Historial de semanas -->
    ${currentWeek > 0 ? `
    <div class="section">
      <div class="section-head"><span class="section-title">📋 Historial</span></div>
      <div class="section-body" id="league-history-body">
        <div class="empty-state" style="padding:12px">Cargando...</div>
      </div>
    </div>` : ''}
  `;

  if (currentWeek > 0) {
    loadLeagueWeek();
    loadLeagueHistory();
  }
}

async function startLeague() {
  if (tournamentPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }
  // Calcular total de semanas
  const n = tournamentPlayers.length;
  const totalWeeks = n % 2 === 0 ? n - 1 : n;

  await _supabase.from('tournaments').update({
    status: 'active',
    total_rounds: totalWeeks,
    league_phase: 'regular'
  }).eq('id', currentTournament.id);

  currentTournament.status = 'active';
  currentTournament.total_rounds = totalWeeks;
  currentTournament.league_phase = 'regular';

  AudioFX.roundStart();
  await generateNextWeek();
}

async function generateNextWeek() {
  const players = tournamentPlayers;
  const currentWeek = currentTournament.current_round || 0;
  const totalWeeks = currentTournament.total_rounds || players.length - 1;

  if (currentWeek >= totalWeeks) {
    showToast('Todas las semanas completadas — inicia el playoff');
    return;
  }

  // Verificar semana anterior completa
  if (currentWeek > 0) {
    const { data: pending } = await _supabase
      .from('matches').select('id')
      .eq('tournament_id', currentTournament.id)
      .eq('round', currentWeek)
      .eq('match_type', 'league')
      .eq('is_complete', false);
    if (pending && pending.length > 0) {
      showToast(`Faltan ${pending.length} resultado(s) de la semana ${currentWeek}`);
      return;
    }
  }

  // Verificar que no existe ya la siguiente semana
  const newWeek = currentWeek + 1;
  const { data: existing } = await _supabase
    .from('matches').select('id')
    .eq('tournament_id', currentTournament.id)
    .eq('round', newWeek)
    .eq('match_type', 'league');
  if (existing && existing.length > 0) {
    showToast('Esta semana ya fue generada');
    return;
  }

  // Generar todos los rounds y tomar el que corresponde
  const allRounds = generateRoundRobin(players);
  const weekPairings = allRounds[newWeek - 1] || [];

  if (!weekPairings.length) { showToast('Error generando emparejamientos'); return; }

  const inserts = weekPairings.map((pair, idx) => ({
    tournament_id: currentTournament.id,
    round: newWeek,
    match_number: idx + 1,
    match_type: 'league',
    player1_id: pair.p1,
    player1_name: players.find(p => p.id === pair.p1)?.name || '?',
    player2_id: pair.p2,
    player2_name: pair.p2 ? players.find(p => p.id === pair.p2)?.name : null,
    is_complete: !pair.p2, // BYE auto-completa
    winner_id: !pair.p2 ? pair.p1 : null,
    score_p1: !pair.p2 ? 1 : null, // BYE = 1 punto asistencia
    score_p2: !pair.p2 ? 0 : null
  }));

  await _supabase.from('matches').insert(inserts);

  // Dar punto de asistencia + BYE automático
  for (const pair of weekPairings) {
    if (!pair.p2) {
      const p = players.find(p => p.id === pair.p1);
      if (p) await _supabase.from('players').update({
        points: (p.points || 0) + 1 // 1pt asistencia BYE
      }).eq('id', p.id);
    }
  }

  await _supabase.from('tournaments').update({ current_round: newWeek }).eq('id', currentTournament.id);
  currentTournament.current_round = newWeek;

  AudioFX.roundStart();
  showToast(`📅 Semana ${newWeek}/${totalWeeks} generada`);
  await loadPlayers();
  renderLeagueView();
}

async function loadLeagueWeek() {
  const { data: matches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('round', currentTournament.current_round)
    .eq('match_type', 'league')
    .order('match_number');

  const body = document.getElementById('league-week-body');
  if (!body || !matches) return;

  const owner = isOwner();
  const active = currentTournament.status === 'active';

  body.innerHTML = `<table class="t-table">
    <thead><tr><th>Jugador 1</th><th>Bo3</th><th>Jugador 2</th><th>Estado</th></tr></thead>
    <tbody>
      ${matches.map(m => {
        const p1 = tournamentPlayers.find(p => p.id === m.player1_id);
        const p2 = m.player2_id ? tournamentPlayers.find(p => p.id === m.player2_id) : null;
        const reported = m.result_reported && !m.is_complete;

        let statusHtml = '';
        if (m.is_complete) {
          const winner = tournamentPlayers.find(p => p.id === m.winner_id);
          statusHtml = `<span class="pill pill-w">${escHtml(winner?.name||'?')} ✓</span>`;
        } else if (!p2) {
          statusHtml = `<span style="color:var(--muted);font-size:12px">BYE</span>`;
        } else if (reported && owner) {
          statusHtml = `
            <div style="font-size:11px;color:var(--cream);margin-bottom:4px">📤 ${m.score_p1}–${m.score_p2}</div>
            <div style="display:flex;gap:4px">
              <input class="score-in" id="lm${m.id}-s1" type="number" min="0" max="2" value="${m.score_p1??''}" style="width:36px">
              <span class="score-sep">–</span>
              <input class="score-in" id="lm${m.id}-s2" type="number" min="0" max="2" value="${m.score_p2??''}" style="width:36px">
              <button class="result-btn result-btn-confirm" onclick="confirmLeagueMatch('${m.id}','${m.player1_id}','${m.player2_id}')">✓</button>
            </div>`;
        } else if (owner && active) {
          statusHtml = `
            <div style="display:flex;gap:4px;align-items:center">
              <input class="score-in" id="lm${m.id}-s1" type="number" min="0" max="2" placeholder="0" style="width:36px" onchange="autoConfirmLeague('${m.id}')">
              <span class="score-sep">–</span>
              <input class="score-in" id="lm${m.id}-s2" type="number" min="0" max="2" placeholder="0" style="width:36px" onchange="autoConfirmLeague('${m.id}')">
              <button class="result-btn result-btn-confirm" onclick="confirmLeagueMatch('${m.id}','${m.player1_id}','${m.player2_id}')">✓</button>
            </div>`;
        } else {
          statusHtml = reported
            ? `<span style="color:var(--cream);font-size:12px">📤 Pendiente admin</span>`
            : `<span style="color:var(--muted);font-size:12px">Pendiente</span>`;
        }

        return `<tr>
          <td style="font-weight:${m.winner_id===m.player1_id?'700':'400'};color:${m.winner_id===m.player1_id?'var(--green)':'var(--text)'}">${escHtml(p1?.name||'?')}</td>
          <td>vs</td>
          <td style="font-weight:${m.winner_id===m.player2_id?'700':'400'};color:${m.winner_id===m.player2_id?'var(--green)':'var(--text)'}">${p2?escHtml(p2.name):'BYE'}</td>
          <td>${statusHtml}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function autoConfirmLeague(matchId) {
  const s1 = parseInt(document.getElementById(`lm${matchId}-s1`)?.value);
  const s2 = parseInt(document.getElementById(`lm${matchId}-s2`)?.value);
  if (!isNaN(s1) && !isNaN(s2) && (s1===2||s2===2) && s1+s2>=2 && s1+s2<=3) {
    const { data: m } = await _supabase.from('matches').select('player1_id,player2_id').eq('id',matchId).single();
    if (m) await confirmLeagueMatch(matchId, m.player1_id, m.player2_id);
  }
}

async function confirmLeagueMatch(matchId, p1Id, p2Id) {
  const s1 = parseInt(document.getElementById(`lm${matchId}-s1`)?.value) || 0;
  const s2 = parseInt(document.getElementById(`lm${matchId}-s2`)?.value) || 0;

  if (s1+s2 < 2) { showToast('Bo3: mínimo 2 juegos (2-0 o 2-1)'); return; }
  if (s1>2||s2>2) { showToast('Máximo 2 victorias'); return; }
  if (s1!==2&&s2!==2) { showToast('Alguien debe llegar a 2'); return; }

  const winnerId = s1>s2 ? p1Id : p2Id;
  const loserId  = winnerId===p1Id ? p2Id : p1Id;

  await _supabase.from('matches').update({
    score_p1: s1, score_p2: s2, winner_id: winnerId,
    is_complete: true, result_reported: false
  }).eq('id', matchId);

  // Puntos: asistencia (1pt cada uno) + victoria (3pts ganador)
  const p1 = tournamentPlayers.find(p=>p.id===p1Id);
  const p2 = tournamentPlayers.find(p=>p.id===p2Id);

  if (p1) await _supabase.from('players').update({
    points: (p1.points||0) + 1 + (p1Id===winnerId?3:0), // 1pt asistencia + 3pt si gana
    wins:   (p1.wins||0)   + (p1Id===winnerId?1:0),
    losses: (p1.losses||0) + (p1Id===loserId?1:0),
    game_wins:   (p1.game_wins||0)   + s1,
    game_losses: (p1.game_losses||0) + s2
  }).eq('id', p1.id);

  if (p2) await _supabase.from('players').update({
    points: (p2.points||0) + 1 + (p2Id===winnerId?3:0),
    wins:   (p2.wins||0)   + (p2Id===winnerId?1:0),
    losses: (p2.losses||0) + (p2Id===loserId?1:0),
    game_wins:   (p2.game_wins||0)   + s2,
    game_losses: (p2.game_losses||0) + s1
  }).eq('id', p2.id);

  AudioFX.tap();
  showToast('Resultado confirmado ✓');
  await loadPlayers();
  await loadLeagueWeek();

  const sb = document.getElementById('league-standings-body');
  if (sb) sb.innerHTML = renderLeagueStandings(tournamentPlayers);

  // Verificar si la semana está completa para auto-notificar
  const { data: pending } = await _supabase
    .from('matches').select('id')
    .eq('tournament_id', currentTournament.id)
    .eq('round', currentTournament.current_round)
    .eq('match_type', 'league')
    .eq('is_complete', false);

  if (!pending || pending.length === 0) {
    AudioFX.roundEnd();
    showToast(`✅ Semana ${currentTournament.current_round} completada`);
  }
}

async function loadLeagueHistory() {
  const { data: matches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'league')
    .lt('round', currentTournament.current_round)
    .eq('is_complete', true)
    .order('round', { ascending: false });

  const body = document.getElementById('league-history-body');
  if (!body || !matches) return;

  const byWeek = {};
  matches.forEach(m => { if(!byWeek[m.round]) byWeek[m.round]=[]; byWeek[m.round].push(m); });

  body.innerHTML = Object.keys(byWeek).sort((a,b)=>b-a).map(w => `
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px">Semana ${w}</div>
      ${byWeek[w].map(m => {
        const p1 = tournamentPlayers.find(p=>p.id===m.player1_id);
        const p2 = tournamentPlayers.find(p=>p.id===m.player2_id);
        const winner = tournamentPlayers.find(p=>p.id===m.winner_id);
        return `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);display:flex;gap:8px">
          <span style="flex:1;color:${m.winner_id===m.player1_id?'var(--green)':'var(--muted)'}">${escHtml(p1?.name||'?')}</span>
          <span style="color:var(--muted)">${m.score_p1}–${m.score_p2}</span>
          <span style="flex:1;text-align:right;color:${m.winner_id===m.player2_id?'var(--green)':'var(--muted)'}">${p2?escHtml(p2.name):'BYE'}</span>
        </div>`;
      }).join('')}
    </div>`).join('');
}

// ── PLAYOFF ───────────────────────────────────────────────
async function startLeaguePlayoff() {
  const sorted = [...tournamentPlayers].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  const top4 = sorted.slice(0, 4);

  if (top4.length < 4) { showToast('Necesitas al menos 4 jugadores para el playoff'); return; }

  // Semi 1: 1° vs 4°, Semi 2: 2° vs 3°
  const semis = [
    { p1: top4[0], p2: top4[3] }, // 1° vs 4°
    { p1: top4[1], p2: top4[2] }  // 2° vs 3°
  ];

  const newRound = (currentTournament.current_round || 0) + 1;

  await _supabase.from('matches').insert(semis.map((s, i) => ({
    tournament_id: currentTournament.id,
    round: newRound,
    match_number: i + 1,
    match_type: 'league_playoff',
    player1_id: s.p1.id,
    player1_name: s.p1.name,
    player2_id: s.p2.id,
    player2_name: s.p2.name,
    is_complete: false
  })));

  await _supabase.from('tournaments').update({
    current_round: newRound,
    league_phase: 'playoff'
  }).eq('id', currentTournament.id);

  currentTournament.current_round = newRound;
  currentTournament.league_phase = 'playoff';

  AudioFX.roundStart();
  showToast('🏆 ¡Playoff iniciado! Semis: 1° vs 4° y 2° vs 3°');
  await loadPlayers();
  renderLeagueView();
}

function renderPlayoffSection(t, players) {
  return `
    <div class="section">
      <div class="section-head">
        <span class="section-title">🏆 Playoff — Fase Champions</span>
        ${isOwner() ? `<button class="btn btn-sm btn-primary" onclick="loadAndRenderPlayoff()">🔄 Actualizar</button>` : ''}
      </div>
      <div class="section-body" id="playoff-body">
        <div class="empty-state" style="padding:16px">Cargando bracket...</div>
      </div>
    </div>`;
}

async function loadAndRenderPlayoff() {
  const { data: matches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'league_playoff')
    .order('round').order('match_number');

  const body = document.getElementById('playoff-body');
  if (!body || !matches) return;

  const owner = isOwner();
  const active = currentTournament.status === 'active';

  // Agrupar por ronda
  const rounds = {};
  matches.forEach(m => { if(!rounds[m.round]) rounds[m.round]=[]; rounds[m.round].push(m); });

  const roundLabels = {
    [Object.keys(rounds)[0]]: 'Semifinales',
    [Object.keys(rounds)[1]]: 'Final & 3er Lugar'
  };

  body.innerHTML = Object.keys(rounds).sort((a,b)=>a-b).map(rn => `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--std);margin-bottom:8px">
        ${roundLabels[rn] || 'Ronda ' + rn}
      </div>
      ${rounds[rn].map(m => renderPlayoffMatch(m, owner, active)).join('')}
      ${owner && active && rounds[rn].every(m=>m.is_complete) && !rounds[Object.keys(rounds)[1]] ? `
        <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="generateLeagueFinals()">
          ▶ Generar Final & 3er lugar
        </button>` : ''}
    </div>`).join('');
}

function renderPlayoffMatch(m, owner, active) {
  const p1 = tournamentPlayers.find(p=>p.id===m.player1_id);
  const p2 = tournamentPlayers.find(p=>p.id===m.player2_id);
  const w1 = m.winner_id===m.player1_id?'winner':'';
  const w2 = m.winner_id===m.player2_id?'winner':'';

  return `<div class="match-card" style="margin-bottom:8px">
    <div class="match-player ${w1}">${escHtml(p1?.name||'?')}</div>
    <div class="match-vs">vs</div>
    <div class="match-player ${w2}">${escHtml(p2?.name||'?')}</div>
    <div class="match-actions">
      ${m.is_complete
        ? `<span class="pill pill-w">${m.score_p1}–${m.score_p2}</span>`
        : owner && active
        ? `<div class="score-wrap">
             <input class="score-in" id="pm${m.id}-s1" type="number" min="0" max="2" placeholder="0" style="width:36px">
             <span class="score-sep">–</span>
             <input class="score-in" id="pm${m.id}-s2" type="number" min="0" max="2" placeholder="0" style="width:36px">
             <button class="result-btn result-btn-confirm" onclick="confirmPlayoffMatch('${m.id}','${m.player1_id}','${m.player2_id}')">✓</button>
           </div>`
        : '<span style="color:var(--muted);font-size:12px">Pendiente</span>'}
    </div>
  </div>`;
}

async function confirmPlayoffMatch(matchId, p1Id, p2Id) {
  const s1 = parseInt(document.getElementById(`pm${matchId}-s1`)?.value)||0;
  const s2 = parseInt(document.getElementById(`pm${matchId}-s2`)?.value)||0;
  if (s1+s2<2||s1>2||s2>2||(s1!==2&&s2!==2)) { showToast('Bo3: resultado inválido'); return; }

  const winnerId = s1>s2?p1Id:p2Id;
  await _supabase.from('matches').update({
    score_p1:s1, score_p2:s2, winner_id:winnerId, is_complete:true
  }).eq('id', matchId);

  AudioFX.tap();
  showToast('Resultado confirmado ✓');
  await loadAndRenderPlayoff();
}

async function generateLeagueFinals() {
  // Obtener resultados de semis
  const { data: semis } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'league_playoff')
    .eq('is_complete', true)
    .order('match_number');

  if (!semis || semis.length < 2) { showToast('Completa las semis primero'); return; }

  const winners = semis.map(m => m.winner_id);
  const losers  = semis.map(m => m.player1_id===m.winner_id ? m.player2_id : m.player1_id);

  const newRound = (currentTournament.current_round||0)+1;

  // Final: ganador semi1 vs ganador semi2
  // 3er lugar: perdedor semi1 vs perdedor semi2
  await _supabase.from('matches').insert([
    {
      tournament_id: currentTournament.id,
      round: newRound, match_number: 1,
      match_type: 'league_playoff',
      player1_id: winners[0], player1_name: tournamentPlayers.find(p=>p.id===winners[0])?.name,
      player2_id: winners[1], player2_name: tournamentPlayers.find(p=>p.id===winners[1])?.name,
      is_complete: false
    },
    {
      tournament_id: currentTournament.id,
      round: newRound, match_number: 2,
      match_type: 'league_playoff',
      player1_id: losers[0], player1_name: tournamentPlayers.find(p=>p.id===losers[0])?.name,
      player2_id: losers[1], player2_name: tournamentPlayers.find(p=>p.id===losers[1])?.name,
      is_complete: false
    }
  ]);

  await _supabase.from('tournaments').update({ current_round: newRound }).eq('id', currentTournament.id);
  currentTournament.current_round = newRound;

  AudioFX.roundStart();
  showToast('🏆 Final y 3er lugar generados');
  await loadAndRenderPlayoff();
}

// ── CLASIFICACIÓN ─────────────────────────────────────────
function renderLeagueStandings(players) {
  if (!players.length) return '<div class="empty-state" style="padding:16px">Sin datos aún</div>';

  const sorted = [...players].sort((a,b) => {
    const ptsDiff = (b.points||0)-(a.points||0);
    if (ptsDiff!==0) return ptsDiff;
    // Desempate: wins, luego game differential
    const winsDiff = (b.wins||0)-(a.wins||0);
    if (winsDiff!==0) return winsDiff;
    return ((b.game_wins||0)-(b.game_losses||0))-((a.game_wins||0)-(a.game_losses||0));
  });

  const rankIcon = ['👑','🥈','🥉'];

  return `<table class="t-table">
    <thead><tr>
      <th>#</th><th>Jugador</th><th>J</th><th>V</th><th>D</th><th>GD</th><th>Pts</th>
    </tr></thead>
    <tbody>
      ${sorted.map((p,i) => {
        const gd = (p.game_wins||0)-(p.game_losses||0);
        const played = (p.wins||0)+(p.losses||0);
        return `<tr class="${i===0?'rank-1':''}">
          <td>${rankIcon[i]||i+1}</td>
          <td>${escHtml(p.name)}</td>
          <td style="color:var(--muted)">${played}</td>
          <td><span class="pill pill-w">${p.wins||0}</span></td>
          <td><span class="pill pill-l">${p.losses||0}</span></td>
          <td style="color:${gd>=0?'var(--std)':'var(--red)'}">${gd>0?'+':''}${gd}</td>
          <td><strong style="color:var(--std)">${p.points||0}</strong></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <p style="font-size:11px;color:var(--muted);margin-top:8px">
    Asistir=1pt · Ganar=+3pts · GD=diferencia de juegos
  </p>`;
}
