// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE EMPAREJAMIENTOS SUIZO — v4.0
// Backtracking COMPLETO con heurística de mínimos rematches globales
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula emparejamientos óptimos para una ronda de formato Suizo.
 *
 * ALGORITMO:
 * 1. Asignar BYE si nº impar
 * 2. Buscar mediante backtracking el emparejamiento sin ningún rematch
 * 3. Si es imposible (matemáticamente), buscar el que tenga el MENOR número
 *    de rematches posible
 * 4. Validar el resultado
 */
function buildSwissPairingsV2(players, prevPairs, hadBye) {

  // ── 1. ORDENAR ────────────────────────────────────────────────────────────
  // Si todos tienen 0 puntos (Ronda 1), barajar con Fisher-Yates (shuffle real).
  // Sin esto, el orden de inscripción determina los emparejamientos (1v2, 3v4...).
  const allZero = players.every(p => (p.points || 0) === 0);
  const base = [...players];
  if (allZero) {
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
  }

  const sorted = base.sort((a, b) =>
    (b.points - a.points) ||
    ((b.game_wins - b.game_losses) - (a.game_wins - a.game_losses)) ||
    (b.wins - a.wins)
  );

  // ── 2. BYE ────────────────────────────────────────────────────────────────
  let byePlayer = null;
  let active = sorted;

  if (sorted.length % 2 !== 0) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (!hadBye.has(sorted[i].id)) { byePlayer = sorted[i]; break; }
    }
    if (!byePlayer) byePlayer = sorted[sorted.length - 1];
    active = sorted.filter(p => p.id !== byePlayer.id);
  }

  // ── 3. BACKTRACKING — buscar solución con 0 rematches ────────────────────
  // Si no existe, buscar la de mínimos rematches
  const best = findBestPairing(active, prevPairs);

  // ── 4. VALIDAR ────────────────────────────────────────────────────────────
  try { validate(best, active); }
  catch(e) { console.error('Swiss v4 validación:', e.message); }

  return { pairings: best, bye: byePlayer };
}

/**
 * Encuentra el emparejamiento con el menor número de rematches posible.
 * Primero intenta 0 rematches. Si no hay solución, intenta 1, 2, etc.
 * Esto garantiza que NUNCA se usa un rematch si existe una solución sin él.
 *
 * @param {Array} players   - Jugadores activos (ya ordenados)
 * @param {Set}   prevPairs - Historial
 * @returns {Array}         - Array de { p1, p2 }
 */
function findBestPairing(players, prevPairs) {
  const maxAllowed = players.length / 2; // máximo teórico de rematches

  for (let maxRematches = 0; maxRematches <= maxAllowed; maxRematches++) {
    const result = backtrack(players, prevPairs, [], 0, maxRematches);
    if (result !== null) return result;
  }

  // Fallback absoluto (no debería llegar aquí)
  return greedyFallback(players, prevPairs);
}

/**
 * Backtracking recursivo con límite de rematches permitidos.
 *
 * @param {Array}  remaining     - Jugadores pendientes
 * @param {Set}    prevPairs     - Historial
 * @param {Array}  built         - Emparejamientos construidos
 * @param {number} rematchCount  - Rematches usados hasta ahora
 * @param {number} maxRematches  - Límite de rematches permitidos en esta búsqueda
 * @returns {Array|null}
 */
function backtrack(remaining, prevPairs, built, rematchCount, maxRematches) {
  // Caso base: todos emparejados → solución válida
  if (remaining.length === 0) return built;

  // Poda: si ya usamos demasiados rematches, abandonar esta rama
  if (rematchCount > maxRematches) return null;

  const p1   = remaining[0];
  const rest = remaining.slice(1);

  // Ordenar candidatos: primero los no-rematch, luego los rematch
  // Dentro de cada grupo, mantienen el orden de puntos similares (ya ordenado)
  const noRematch = rest.filter(p => !prevPairs.has([p1.id, p.id].sort().join('|')));
  const rematch   = rest.filter(p =>  prevPairs.has([p1.id, p.id].sort().join('|')));
  const candidates = [...noRematch, ...rematch];

  for (const p2 of candidates) {
    const key = [p1.id, p2.id].sort().join('|');
    const isRematch = prevPairs.has(key);

    // No exceder el límite de rematches
    if (isRematch && rematchCount >= maxRematches) continue;

    const remaining2   = rest.filter(p => p.id !== p2.id);
    const newRematches = rematchCount + (isRematch ? 1 : 0);
    const result       = backtrack(remaining2, prevPairs, [...built, { p1, p2 }], newRematches, maxRematches);

    if (result !== null) return result;
    // Si null → backtrack → probar siguiente candidato
  }

  return null; // ningún candidato llevó a solución con ≤ maxRematches
}

/**
 * Greedy de último recurso.
 */
function greedyFallback(players, prevPairs) {
  const pairings = [];
  const used = new Set();
  for (let i = 0; i < players.length; i++) {
    if (used.has(players[i].id)) continue;
    const p1 = players[i];
    let p2 = null;
    for (let j = i + 1; j < players.length; j++) {
      if (!used.has(players[j].id) && !prevPairs.has([p1.id, players[j].id].sort().join('|'))) {
        p2 = players[j]; break;
      }
    }
    if (!p2) for (let j = i + 1; j < players.length; j++) {
      if (!used.has(players[j].id)) { p2 = players[j]; break; }
    }
    if (p2) { pairings.push({ p1, p2 }); used.add(p1.id); used.add(p2.id); }
  }
  return pairings;
}

/**
 * Valida que cada jugador aparezca exactamente una vez.
 */
function validate(pairings, activePlayers) {
  const seen = new Set();
  for (const { p1, p2 } of pairings) {
    if (seen.has(p1.id)) throw new Error(`Duplicado: ${p1.id}`);
    if (seen.has(p2.id)) throw new Error(`Duplicado: ${p2.id}`);
    seen.add(p1.id); seen.add(p2.id);
  }
  if (seen.size !== activePlayers.length) {
    throw new Error(`${seen.size}/${activePlayers.length} emparejados`);
  }
}



// =============================================
// SWISS — Standard Bo3 / Beyblade Bo3
// Rondas automáticas: máx 4, deja 1-4 invictos
// =============================================

// Calcula rondas necesarias: ceil(log2(n)), máx 4
function calcTotalRounds(n) {
  if (n <= 1) return 1;
  if (n <= 3) return 1; // Con 2-3 jugadores, 1 ronda
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
              ${owner && (t.status === 'upcoming' || t.status === 'active') ? `
                <button class="chip-edit" onclick="openEditPlayerNameModal('${p.id}','${escHtml(p.name).replace(/'/g,"\\'")}')" title="Editar nombre">✏️</button>
                <button class="chip-remove" onclick="removePlayer('${p.id}')" title="Eliminar jugador">×</button>` : ''}
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
  // Poll cada 10s para resultados reportados por jugadores
  if (isOwner() && currentTournament.status === 'active') {
    clearInterval(window._swissPollTimer);
    window._swissPollTimer = setInterval(async () => {
      const body = document.getElementById('swiss-rounds-body');
      if (body) await loadSwissRounds();
    }, 10000);
  }
}

async function startSwiss() {
  if (tournamentPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }
  await setTournamentStatus('active');
  await generateSwissRound();
}

async function finalizarSwiss() {
  await setTournamentStatus('finished');
  await registerHallOfFame(currentTournament.id);
  renderSwissView();
  setTimeout(()=>showWinnerPopup(tournamentPlayers), 600);
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

  // Resultado reportado por jugador pero no confirmado por admin
  const reported = m.result_reported && !m.is_complete;

  return `<div class="match-card" id="match-${m.id}" style="${reported?'border-color:var(--cream)':''}">
    <div class="match-player ${w1}">${escHtml(p1name)}</div>
    <div class="match-vs">vs</div>
    ${isBye ? `
      <div class="match-player" style="color:var(--muted2)">BYE</div>
      <div class="match-actions"><span class="pill pill-w">Auto ✓</span></div>
    ` : `
      <div class="match-player ${w2}">${escHtml(p2name)}</div>
      <div class="match-actions">
        ${m.is_complete
          ? `<div style="display:flex;align-items:center;gap:6px">
               <span class="pill pill-w">${m.score_p1}–${m.score_p2}</span>
               ${owner ? `<button class="btn btn-xs btn-ghost" style="padding:2px 6px;font-size:11px"
                 onclick="openEditMatchModal('${m.id}','${m.player1_id}','${m.player2_id}','${escHtml(p1name)}','${escHtml(p2name)}',${m.score_p1},${m.score_p2},'swiss')">✏️</button>` : ''}
             </div>`
          : reported && owner
          ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
               <span style="font-size:10px;color:var(--cream)">📤 Reportado: ${m.score_p1}–${m.score_p2}</span>
               <div class="score-wrap">
                 <input class="score-in" id="m${m.id}-s1" type="number" min="0" max="2" placeholder="${m.score_p1??0}" value="${m.score_p1??''}" onchange="autoSaveSwissScore('${m.id}')">
                 <span class="score-sep">–</span>
                 <input class="score-in" id="m${m.id}-s2" type="number" min="0" max="2" placeholder="${m.score_p2??0}" value="${m.score_p2??''}" onchange="autoSaveSwissScore('${m.id}')">
                 <button class="result-btn result-btn-confirm" onclick="confirmSwissMatch('${m.id}')">✓</button>
               </div>
             </div>`
          : owner && active && isCurrent
          ? `<div class="score-wrap">
               <input class="score-in" id="m${m.id}-s1" type="number" min="0" max="2" placeholder="0" onchange="autoSaveSwissScore('${m.id}')">
               <span class="score-sep">–</span>
               <input class="score-in" id="m${m.id}-s2" type="number" min="0" max="2" placeholder="0" onchange="autoSaveSwissScore('${m.id}')">
               <button class="result-btn result-btn-confirm" onclick="confirmSwissMatch('${m.id}')">✓</button>
             </div>`
          : reported
          ? `<span style="color:var(--cream);font-size:12px">📤 ${m.score_p1}–${m.score_p2} · esperando admin</span>`
          : `<span style="color:var(--muted);font-size:12px">Pendiente</span>`}
      </div>
    `}
  </div>`;
}

let _generatingRound = false;

async function generateSwissRound() {
  // Evitar doble-click / doble generación
  if (_generatingRound) { showToast('Generando ronda... espera'); return; }
  _generatingRound = true;

  try {
    await _generateSwissRoundInternal();
  } finally {
    _generatingRound = false;
  }
}

async function _generateSwissRoundInternal() {
  // Deduplicar jugadores por ID para evitar el bug de doble carga
  const seen = new Set();
  const players = tournamentPlayers.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
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

  const prevPairs = new Set((prevMatches || [])
    .filter(m => m.player1_id && m.player2_id)
    .map(m => [m.player1_id, m.player2_id].sort().join('|')));

  // Jugadores que ya tuvieron BYE
  const hadBye = new Set((prevMatches || [])
    .filter(m => !m.player2_id)
    .map(m => m.player1_id));

  // ── Motor Suizo v4: backtracking con mínimos rematches ──────────────────
  // Ronda 1: barajar explícitamente para que los emparejamientos sean al azar
  // (sin esto, el orden de inscripción manda: 1v2, 3v4, 5v6...)
  let playersForPairing = [...players];
  if (newRound === 1) {
    for (let i = playersForPairing.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playersForPairing[i], playersForPairing[j]] = [playersForPairing[j], playersForPairing[i]];
    }
  }

  const { pairings: activePairings, bye: byePlayer } =
    buildSwissPairingsV2(playersForPairing, prevPairs, hadBye);

  const pairings = activePairings;
  if (byePlayer) pairings.push({ p1: byePlayer, p2: null });

  // Verificar atómicamente que no existan ya partidos para esta ronda
  // Usar upsert implícito — si ya existe la ronda, el insert fallará por el unique index
  const { data: existingMatches } = await _supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', currentTournament.id)
    .eq('round', newRound)
    .eq('match_type', 'swiss');

  if (existingMatches && existingMatches.length > 0) {
    // Ya fue generada por otra llamada concurrente
    await loadPlayers();
    renderSwissView();
    return;
  }

  // Actualizar current_round ANTES de insertar matches
  // Si dos llamadas llegan aquí, solo una actualizará correctamente
  const { data: updated, error: updateErr } = await _supabase
    .from('tournaments')
    .update({ current_round: newRound })
    .eq('id', currentTournament.id)
    .eq('current_round', newRound - 1) // Solo si sigue en la ronda anterior
    .select('id');

  if (!updated || updated.length === 0) {
    // Otra llamada ya avanzó la ronda
    await loadPlayers();
    renderSwissView();
    return;
  }

  currentTournament.current_round = newRound;

  // Deduplicar jugadores antes de emparejar
  const uniquePlayers = [...new Map(pairings.flatMap(p => [p.p1, p.p2].filter(Boolean)).map(p => [p.id, p])).values()];

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
    score_p2: !pair.p2 ? 0 : null,
    bye_points_given: false
  }));

  const { error } = await _supabase.from('matches').insert(inserts);
  if (error) { showToast('Error: ' + error.message); return; }

  // Los puntos de BYE se dan al CONFIRMAR la ronda, no al generarla
  // (ver confirmSwissRound)

  await loadPlayers();
  renderSwissView();

  const roundsLeft = Math.max(0, totalRounds - newRound);
  AudioFX.roundStart();
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

  // Leer datos FRESCOS de la DB — no confiar en tournamentPlayers que puede estar desfasado
  const { data: freshPlayers } = await _supabase
    .from('players').select('id, wins, losses, points, game_wins, game_losses')
    .in('id', [match.player1_id, match.player2_id]);

  const p1 = freshPlayers?.find(p => p.id === match.player1_id);
  const p2 = freshPlayers?.find(p => p.id === match.player2_id);

  if (p1) await _supabase.from('players').update({
    wins:        (p1.wins   || 0) + (s1 > s2 ? 1 : 0),
    losses:      (p1.losses || 0) + (s1 < s2 ? 1 : 0),
    points:      (p1.points || 0) + (s1 > s2 ? 3 : 0),
    game_wins:   (p1.game_wins   || 0) + s1,
    game_losses: (p1.game_losses || 0) + s2
  }).eq('id', p1.id);
  else console.error('_confirmSwissMatchById: no se encontró player1 en DB', match.player1_id);

  if (p2) await _supabase.from('players').update({
    wins:        (p2.wins   || 0) + (s2 > s1 ? 1 : 0),
    losses:      (p2.losses || 0) + (s2 < s1 ? 1 : 0),
    points:      (p2.points || 0) + (s2 > s1 ? 3 : 0),
    game_wins:   (p2.game_wins   || 0) + s2,
    game_losses: (p2.game_losses || 0) + s1
  }).eq('id', p2.id);
  else console.error('_confirmSwissMatchById: no se encontró player2 en DB', match.player2_id);

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

  if (!pending || pending.length === 0) {
    // Verificar atómicamente que la ronda no cambió mientras procesábamos
    // (evita doble generación si dos admins confirman simultáneamente)
    const { data: freshT } = await _supabase
      .from('tournaments').select('current_round').eq('id', currentTournament.id).single();
    
    if (!freshT || freshT.current_round !== currentTournament.current_round) {
      // Alguien ya avanzó la ronda — no hacer nada
      await loadPlayers();
      renderSwissView();
      return;
    }

    // Dar puntos de BYE ahora que la ronda está completa
    await giveBYEPoints();
    await loadPlayers();

    AudioFX.roundEnd();
    if (currentTournament.current_round < totalRounds) {
      showToast('✅ Ronda completa — presiona ▶ para la siguiente');
      renderSwissView();
    } else {
      showToast('🏆 ¡Todas las rondas completadas!');
      renderSwissView();
      setTimeout(() => showWinnerPopup(tournamentPlayers), 800);
    }
  } else {
    AudioFX.tap();
    showToast('Resultado guardado ✓');
  }
}

async function giveBYEPoints() {
  // Buscar matches BYE de la ronda actual que aún no tienen puntos dados
  const { data: byeMatches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('round', currentTournament.current_round)
    .eq('match_type', 'swiss')
    .is('player2_id', null)
    .eq('bye_points_given', false);

  if (!byeMatches?.length) return;

  // Leer datos FRESCOS de la DB para todos los jugadores con BYE de una sola vez
  const byePlayerIds = byeMatches.map(m => m.player1_id);
  const { data: freshByePlayers } = await _supabase
    .from('players').select('id, wins, points, game_wins').in('id', byePlayerIds);

  for (const m of byeMatches) {
    const p = freshByePlayers?.find(p => p.id === m.player1_id);
    if (!p) { console.error('giveBYEPoints: no se encontró jugador en DB', m.player1_id); continue; }
    await _supabase.from('players').update({
      wins:      (p.wins      || 0) + 1,
      points:    (p.points    || 0) + 3,
      game_wins: (p.game_wins || 0) + 2
    }).eq('id', p.id);
    await _supabase.from('matches').update({ bye_points_given: true }).eq('id', m.id);
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
