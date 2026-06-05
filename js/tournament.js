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
  nameEl.value = ''; if (beyEl) beyEl.value = '';
  await loadPlayers();
  refreshCurrentView();
  showToast(`${name} agregado ✓`);
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

function refreshCurrentView() {
  if (!currentTournament) return;
  if (currentTournament.type === 'commander') renderCommanderView();
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
