// =============================================
// REALTIME — con debounce para evitar 429
// =============================================
let realtimeChannel = null;
let _realtimeDebounceTimer = null;

function _debouncedRefresh(delay = 800) {
  clearTimeout(_realtimeDebounceTimer);
  _realtimeDebounceTimer = setTimeout(async () => {
    await loadPlayers();
    refreshCurrentView();
    // Si hay rondas de swiss, recargar explícitamente
    if (currentTournament?.format === 'swiss' || currentTournament?.format === 'elimination') {
      const body = document.getElementById('swiss-rounds-body');
      if (body) await loadSwissRounds();
    }
  }, delay);
}

function startRealtimeSubscription(tournamentId) {
  stopRealtimeSubscription();
  realtimeChannel = _supabase
    .channel(`tournament-${tournamentId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, () => _debouncedRefresh())
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'players',
      filter: `tournament_id=eq.${tournamentId}`
    }, () => _debouncedRefresh())
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'tournaments',
      filter: `id=eq.${tournamentId}`
    }, (payload) => {
      if (payload.new) {
        currentTournament = { ...currentTournament, ...payload.new };
        _debouncedRefresh();
      }
    })
    .subscribe();
}

function stopRealtimeSubscription() {
  clearTimeout(_realtimeDebounceTimer);
  if (realtimeChannel) {
    _supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
