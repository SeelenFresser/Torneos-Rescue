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

  const badgeClass = { commander: 'badge-magic', standard: 'badge-std', beyblade: 'badge-bey' };
  const badgeLabel = { commander: '🧙 Commander', standard: '🃏 Standard', beyblade: '🌀 Beyblade' };
  const badge = document.getElementById('t-type-badge');
  badge.textContent = badgeLabel[t.type] || t.type;
  badge.className = 'badge ' + (badgeClass[t.type] || '');

  await loadPlayers();

  if (t.type === 'commander') {
    renderCommanderView();
  } else {
    if (t.format === 'swiss') renderSwissView();
    else renderEliminationView();
  }

  startRealtimeSubscription(id);
}

async function loadPlayers() {
  const { data } = await _supabase
    .from('players')
    .select('*')
    .eq('tournament_id', currentTournament.id)
    .order('created_at', { ascending: true });
  tournamentPlayers = data || [];
}

async function addPlayer(nameInputId, beyInputId) {
  const nameEl = document.getElementById(nameInputId);
  const name = nameEl.value.trim();
  if (!name) return;

  const beyEl = beyInputId ? document.getElementById(beyInputId) : null;
  const bey_name = beyEl ? beyEl.value.trim() : null;

  const exists = tournamentPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (exists) { showToast('Ese jugador ya está registrado'); return; }

  if (currentTournament.type === 'commander' && tournamentPlayers.length >= 32) {
    showToast('Máximo 32 jugadores'); return;
  }

  const { error } = await _supabase.from('players').insert({
    tournament_id: currentTournament.id,
    name,
    bey_name: bey_name || null,
    wins: 0, losses: 0, draws: 0, points: 0, game_wins: 0, game_losses: 0
  });

  if (error) { showToast('Error: ' + error.message); return; }
  nameEl.value = '';
  if (beyEl) beyEl.value = '';
  await loadPlayers();
  refreshCurrentView();
}

async function removePlayer(playerId) {
  if (!confirm('¿Quitar este jugador?')) return;
  await _supabase.from('players').delete().eq('id', playerId);
  await loadPlayers();
  refreshCurrentView();
}

async function finishTournament() {
  if (!confirm('¿Marcar este torneo como finalizado?')) return;
  await _supabase.from('tournaments').update({ status: 'finished' }).eq('id', currentTournament.id);
  currentTournament.status = 'finished';
  refreshCurrentView();
  showToast('Torneo finalizado');
}

function refreshCurrentView() {
  if (!currentTournament) return;
  if (currentTournament.type === 'commander') renderCommanderView();
  else if (currentTournament.format === 'swiss') renderSwissView();
  else renderEliminationView();
}

function isOwner() {
  return currentUser && currentTournament && currentTournament.owner_id === currentUser.id;
}
