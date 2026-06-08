// =============================================
// TOURNAMENT VIEW
// =============================================
let currentTournament = null;
let tournamentPlayers = [];

async function openTournament(id) {
  showScreen('screen-tournament');
  document.getElementById('tournament-content').innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data: t, error } = await _supabase.from('tournaments').select('*').eq('id', id).single();
  if (error) { showToast('Error cargando torneo'); return; }

  currentTournament = t;
  document.getElementById('t-name-nav').textContent = t.name;
  const badgeMap = { commander:'badge-magic 🧙 Commander', standard:'badge-std 🃏 Standard', beyblade:'badge-bey 🌀 Beyblade' };
  const [cls, ...lbl] = (badgeMap[t.type] || 'badge-admin Torneo').split(' ');
  const badge = document.getElementById('t-type-badge');
  badge.textContent = lbl.join(' ');
  badge.className = 'badge ' + cls;

  await loadPlayers();

  if (t.type === 'commander') renderCommanderView();
  else if (t.format === 'league') renderLeagueView();
  else if (t.format === 'swiss') renderSwissView();
  else renderEliminationView();

  startRealtimeSubscription(id);
}

async function loadPlayers() {
  const { data } = await _supabase
    .from('players').select('*')
    .eq('tournament_id', currentTournament.id)
    .order('created_at', { ascending: true });
  tournamentPlayers = data || [];
}

// Admin agrega jugador manualmente (sin cuenta)
async function addPlayer(nameInputId, beyInputId) {
  const nameEl = document.getElementById(nameInputId);
  const name = nameEl.value.trim();
  if (!name) return;
  const beyEl = beyInputId ? document.getElementById(beyInputId) : null;
  const bey_name = beyEl ? beyEl.value.trim() : null;
  if (tournamentPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) { showToast('Jugador ya registrado'); return; }

  const { error } = await _supabase.from('players').insert({
    tournament_id: currentTournament.id,
    user_id: null, // sin cuenta — jugador manual
    name, bey_name: bey_name || null,
    wins:0, losses:0, draws:0, points:0, game_wins:0, game_losses:0
  });
  if (error) { showToast('Error: ' + error.message); return; }
  nameEl.value = '';
  if (beyEl) beyEl.value = '';
  await loadPlayers();

  // Para la liga: actualizar solo los chips sin destruir el input
  if (currentTournament.format === 'league') {
    updateLeaguePlayerChips();
  } else {
    refreshCurrentView();
  }
  showToast(`${name} agregado ✓`);
  // Devolver foco al input para agregar otro jugador rápidamente
  setTimeout(() => nameEl.focus(), 50);
}

async function removePlayer(playerId) {
  if (!confirm('¿Quitar este jugador?')) return;
  await _supabase.from('players').delete().eq('id', playerId);
  await loadPlayers();
  refreshCurrentView();
}

async function setTournamentStatus(status) {
  await _supabase.from('tournaments').update({ status }).eq('id', currentTournament.id);
  currentTournament.status = status;
  refreshCurrentView();
  showToast(status === 'active' ? '¡Torneo iniciado!' : 'Torneo finalizado');
}

function updateLeaguePlayerChips() {
  const players = tournamentPlayers;
  const owner = isOwner();
  const n = players.length;
  const totalWeeks = n % 2 === 0 ? n - 1 : n;

  // Actualizar chips
  const chipsEl = document.querySelector('#tournament-content .chips');
  if (chipsEl) {
    chipsEl.innerHTML = players.map(p => `
      <div class="chip">
        ${p.user_id ? '👤' : '🤖'} ${escHtml(p.name)}
        ${owner && currentTournament.status === 'upcoming'
          ? `<button class="chip-remove" onclick="removePlayer('${p.id}')">×</button>` : ''}
      </div>`).join('') +
      (players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores</span>' : '');
  }

  // Actualizar el texto de semanas
  const infoEl = document.querySelector('#tournament-content .chips + p');
  if (infoEl && n >= 2) {
    infoEl.innerHTML = `📊 ${n} jugadores → <strong style="color:var(--std)">${totalWeeks} semanas</strong> de liga`;
  }

  // Actualizar stat box de jugadores
  const statVals = document.querySelectorAll('#tournament-content .stat-val');
  if (statVals[0]) statVals[0].textContent = n;
}

// ── MODAL EDITAR RESULTADO (Admin) ───────────────────────
function openEditMatchModal(matchId, p1Id, p2Id, p1Name, p2Name, s1, s2, matchType) {
  const modal = document.getElementById('modal-edit-match');
  if (!modal) return;

  document.getElementById('edit-match-title').textContent = `${p1Name} vs ${p2Name}`;
  document.getElementById('edit-match-p1-name').textContent = p1Name;
  document.getElementById('edit-match-p2-name').textContent = p2Name;
  document.getElementById('edit-match-s1').value = s1 ?? '';
  document.getElementById('edit-match-s2').value = s2 ?? '';
  document.getElementById('edit-match-id').value = matchId;
  document.getElementById('edit-match-p1-id').value = p1Id;
  document.getElementById('edit-match-p2-id').value = p2Id;
  document.getElementById('edit-match-type').value = matchType;

  openModal('modal-edit-match');
}

async function saveEditMatch() {
  const matchId = document.getElementById('edit-match-id').value;
  const p1Id    = document.getElementById('edit-match-p1-id').value;
  const p2Id    = document.getElementById('edit-match-p2-id').value;
  const s1      = parseInt(document.getElementById('edit-match-s1').value);
  const s2      = parseInt(document.getElementById('edit-match-s2').value);
  const mType   = document.getElementById('edit-match-type').value;

  if (isNaN(s1)||isNaN(s2)) { showToast('Ingresa ambos scores'); return; }
  if (s1===s2)               { showToast('No puede haber empate'); return; }

  const winnerId = s1>s2 ? p1Id : p2Id;
  const loserId  = s1>s2 ? p2Id : p1Id;

  // Obtener match anterior para revertir puntos
  const { data: oldMatch } = await _supabase.from('matches').select('*').eq('id', matchId).single();
  if (!oldMatch) { showToast('Match no encontrado'); return; }

  const oldWinnerId = oldMatch.winner_id;
  const oldLoserId  = oldMatch.player1_id===oldWinnerId ? oldMatch.player2_id : oldMatch.player1_id;
  const oldS1 = oldMatch.score_p1||0;
  const oldS2 = oldMatch.score_p2||0;

  // Actualizar match
  await _supabase.from('matches').update({
    score_p1: s1, score_p2: s2,
    winner_id: winnerId,
    is_complete: true
  }).eq('id', matchId);

  // Revertir y re-aplicar puntos según formato
  if (mType === 'swiss') {
    // Revertir ganador anterior
    const oldW = tournamentPlayers.find(p=>p.id===oldWinnerId);
    const oldL = tournamentPlayers.find(p=>p.id===oldLoserId);
    if (oldW) await _supabase.from('players').update({
      points: Math.max(0,(oldW.points||0)-3),
      wins:   Math.max(0,(oldW.wins||0)-1),
      game_wins:   Math.max(0,(oldW.game_wins||0)-(oldMatch.player1_id===oldWinnerId?oldS1:oldS2)),
      game_losses: Math.max(0,(oldW.game_losses||0)-(oldMatch.player1_id===oldWinnerId?oldS2:oldS1))
    }).eq('id',oldW.id);
    if (oldL) await _supabase.from('players').update({
      losses: Math.max(0,(oldL.losses||0)-1),
      game_wins:   Math.max(0,(oldL.game_wins||0)-(oldMatch.player1_id===oldLoserId?oldS1:oldS2)),
      game_losses: Math.max(0,(oldL.game_losses||0)-(oldMatch.player1_id===oldLoserId?oldS2:oldS1))
    }).eq('id',oldL.id);

    // Aplicar nuevo resultado
    const newW = tournamentPlayers.find(p=>p.id===winnerId);
    const newL = tournamentPlayers.find(p=>p.id===loserId);
    if (newW) await _supabase.from('players').update({
      points: (newW.points||0)+3,
      wins:   (newW.wins||0)+1,
      game_wins:   (newW.game_wins||0)+(winnerId===p1Id?s1:s2),
      game_losses: (newW.game_losses||0)+(winnerId===p1Id?s2:s1)
    }).eq('id',newW.id);
    if (newL) await _supabase.from('players').update({
      losses: (newL.losses||0)+1,
      game_wins:   (newL.game_wins||0)+(loserId===p1Id?s1:s2),
      game_losses: (newL.game_losses||0)+(loserId===p1Id?s2:s1)
    }).eq('id',newL.id);

  } else if (mType === 'league') {
    // Liga: revertir 1pt asistencia + 3pt victoria, re-aplicar
    const oldW = tournamentPlayers.find(p=>p.id===oldWinnerId);
    const oldL = tournamentPlayers.find(p=>p.id===oldLoserId);
    if (oldW) await _supabase.from('players').update({
      points: Math.max(0,(oldW.points||0)-3),
      wins:   Math.max(0,(oldW.wins||0)-1)
    }).eq('id',oldW.id);
    if (oldL) await _supabase.from('players').update({
      losses: Math.max(0,(oldL.losses||0)-1)
    }).eq('id',oldL.id);

    const newW = tournamentPlayers.find(p=>p.id===winnerId);
    const newL = tournamentPlayers.find(p=>p.id===loserId);
    if (newW) await _supabase.from('players').update({
      points: (newW.points||0)+3,
      wins:   (newW.wins||0)+1
    }).eq('id',newW.id);
    if (newL) await _supabase.from('players').update({
      losses: (newL.losses||0)+1
    }).eq('id',newL.id);
  }
  // Playoff: solo actualiza el resultado, no puntos

  closeModal('modal-edit-match');
  AudioFX.tap();
  showToast('Resultado actualizado ✓');
  await loadPlayers();
  refreshCurrentView();
}

// ── HALL OF FAME ─────────────────────────────────────────
async function registerHallOfFame(tournamentId) {
  const { data: t } = await _supabase
    .from('tournaments').select('*').eq('id', tournamentId).single();
  if (!t) return;

  const { data: players } = await _supabase
    .from('players').select('*').eq('tournament_id', tournamentId);
  if (!players || !players.length) return;

  const sorted = [...players].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  const winner = sorted[0];

  const { error } = await _supabase.from('hall_of_fame').insert({
    tournament_id:    tournamentId,
    tournament_name:  t.name,
    tournament_type:  t.type,
    tournament_format: t.format,
    winner_name:      winner.name,
    winner_id:        winner.user_id || null,
    winner_points:    winner.points || 0,
    winner_wins:      winner.wins   || 0,
    tournament_date:  t.tournament_date || new Date().toISOString(),
    player_count:     players.length
  });
  if (error) console.error('Hall of Fame error:', error.message);
}

// ── EDITAR POD COMMANDER (desconfirmar para re-editar) ────
async function openEditPodModal(podIdx) {
  const sessions = window._cmdrSessions;
  if (!sessions||!sessions[podIdx]) return;
  if (!confirm('¿Editar este pod? Se revertirán los puntos asignados.')) return;

  const s = sessions[podIdx];
  const playerIds = JSON.parse(s.player_ids||'[]');
  const resultData = s.result_data ? JSON.parse(s.result_data) : {};

  // Revertir puntos
  const ptsSystem = currentTournament.points_system||'standard';
  const isCEDH = ptsSystem==='cedh';
  const podSize = playerIds.length;

  for (const pid of playerIds) {
    const r = resultData[pid]||{};
    const pts = isCEDH ? (r.kills||0)+(r.place===1?1:0) : getPts(ptsSystem,r.place||99,podSize);
    const dbPlayer = tournamentPlayers.find(p=>p.id===pid);
    if (dbPlayer && pts>0) {
      await _supabase.from('players').update({
        points: Math.max(0,(dbPlayer.points||0)-pts),
        wins:   Math.max(0,(dbPlayer.wins||0)-(r.place===1?1:0))
      }).eq('id',pid);
    }
  }

  // Desconfirmar pod
  await _supabase.from('pod_sessions').update({
    is_confirmed: false,
    result_data: null
  }).eq('id',s.id);

  AudioFX.tap();
  showToast('Pod desbloqueado para edición');
  await loadPlayers();
  await loadAndShowCurrentPods();
  const sb=document.getElementById('cmdr-standings-body');
  if(sb) sb.innerHTML=renderCommanderStandings(tournamentPlayers);
}

function refreshCurrentView() {
  if (!currentTournament) return;
  if (currentTournament.type === 'commander') renderCommanderView();
  else if (currentTournament.format === 'league') renderLeagueView();
  else if (currentTournament.format === 'swiss') renderSwissView();
  else renderEliminationView();
}

function isOwner() {
  return currentUser && currentTournament && (currentTournament.owner_id === currentUser.id || isAdmin);
}

async function enterGameApp(tournamentId) {
  const myPlayer = tournamentPlayers.find(p => p.user_id === currentUser?.id);
  if (!myPlayer && !isAdmin) { showToast('No estás inscrito en este torneo'); return; }

  if (currentTournament.type === 'commander') {
    openPlayerPodSession(tournamentId);
    return;
  }

  // Para Beyblade y Standard: buscar el match actual del jugador
  // para pasar solo los 2 jugadores del enfrentamiento
  if (currentTournament.current_round > 0) {
    const matchType = currentTournament.format === 'swiss' ? 'swiss' : 'elimination';
    const { data: matches } = await _supabase
      .from('matches').select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentTournament.current_round)
      .eq('match_type', matchType)
      .eq('is_complete', false);

    if (matches && myPlayer) {
      const myMatch = matches.find(m =>
        m.player1_id === myPlayer.id || m.player2_id === myPlayer.id
      );
      if (myMatch) {
        // Solo pasar los 2 jugadores de este enfrentamiento
        const p1 = tournamentPlayers.find(p => p.id === myMatch.player1_id);
        const p2 = tournamentPlayers.find(p => p.id === myMatch.player2_id);
        const matchPlayers = [p1, p2].filter(Boolean);
        startGameApp(currentTournament, matchPlayers, myPlayer);
        return;
      }
    }
  }

  // Fallback: todos los jugadores
  startGameApp(currentTournament, tournamentPlayers, myPlayer || tournamentPlayers[0]);
}

// Admin panel controls
function renderTournamentControls() {
  if (!isOwner()) return '';
  const t = currentTournament;
  const statusBtns = t.status === 'upcoming'
    ? `<button class="btn btn-cream btn-sm" onclick="setTournamentStatus('active')">▶ Iniciar torneo</button>`
    : t.status === 'active'
    ? `<button class="btn btn-danger btn-sm" onclick="setTournamentStatus('finished')">■ Finalizar</button>`
    : `<span style="color:var(--muted);font-size:12px">✓ Finalizado</span>`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
    ${statusBtns}
    <button class="btn btn-sm" onclick="enterGameApp('${t.id}')">🎮 Entrar como jugador</button>
  </div>`;
}

// Player join/enter button for non-admins
function renderJoinButton() {
  if (isAdmin) return '';
  const t = currentTournament;
  const myPlayer = tournamentPlayers.find(p => p.user_id === currentUser?.id);

  if (myPlayer) {
    if (t.status === 'active') {
      const label = t.type === 'commander' ? '🎯 Entrar a mi mesa' : '🎮 Entrar a la partida';
      return `<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" onclick="enterGameApp('${t.id}')">${label}</button>
        <span style="color:var(--green);font-size:12px">✓ <strong>${escHtml(myPlayer.name)}</strong></span>
      </div>`;
    }
    return `<div style="margin-bottom:12px;padding:10px 14px;background:var(--dark3);border:1px solid var(--border);border-radius:var(--radius);display:flex;align-items:center;gap:8px">
      <span style="color:var(--green);font-size:13px">✓ Inscrito</span>
      <span style="color:var(--text);font-size:13px;font-weight:600">${escHtml(myPlayer.name)}</span>
      <span style="color:var(--muted);font-size:12px">— El torneo comenzará pronto</span>
    </div>`;
  }

  if (t.status === 'upcoming') {
    return `<div style="margin-bottom:12px;padding:12px 14px;background:var(--dark3);border:1px solid var(--border2);border-radius:var(--radius)">
      <p style="font-size:13px;color:var(--muted);margin-bottom:8px">¿Quieres participar en este torneo?</p>
      <button class="btn btn-primary" onclick="openJoinModal('${t.id}','${escHtml(t.name)}','${t.type}')">+ Inscribirme</button>
    </div>`;
  }

  if (t.status === 'active') {
    return `<div style="margin-bottom:12px;padding:10px 14px;background:var(--dark3);border:1px solid var(--border);border-radius:var(--radius)">
      <span style="color:var(--muted);font-size:12px">El torneo ya inició — inscripción cerrada</span>
    </div>`;
  }

  return '';
}

// Admin: render add player row (manual, sin cuenta)
function renderAddPlayerRow(nameId, beyId) {
  if (!isOwner()) return '';
  const isBey = currentTournament?.type === 'beyblade';
  return `<div class="add-row" style="margin-bottom:10px">
    <input class="input" id="${nameId}" type="text" placeholder="Nombre del jugador" onkeydown="if(event.key==='Enter')addPlayer('${nameId}'${beyId ? `,'${beyId}'` : ''})">
    ${isBey && beyId ? `<input class="input" id="${beyId}" type="text" placeholder="Beyblade (opcional)">` : ''}
    <button class="btn" onclick="addPlayer('${nameId}'${beyId ? `,'${beyId}'` : ''})">+ Agregar</button>
  </div>`;
}
