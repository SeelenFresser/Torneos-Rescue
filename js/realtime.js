// =============================================
// REALTIME
// =============================================
let realtimeChannel = null;

function startRealtimeSubscription(tournamentId) {
  stopRealtimeSubscription();
  realtimeChannel = _supabase
    .channel(`tournament-${tournamentId}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'matches', filter:`tournament_id=eq.${tournamentId}` }, async () => {
      await loadPlayers();
      refreshCurrentView();
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'players', filter:`tournament_id=eq.${tournamentId}` }, async () => {
      await loadPlayers();
      refreshCurrentView();
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'tournaments', filter:`id=eq.${tournamentId}` }, async (payload) => {
      if (payload.new) {
        currentTournament = { ...currentTournament, ...payload.new };
        await loadPlayers();
        refreshCurrentView();
      }
    })
    .subscribe();
}

function stopRealtimeSubscription() {
  if (realtimeChannel) { _supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
}
