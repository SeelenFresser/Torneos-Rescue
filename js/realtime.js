// =============================================
// REALTIME — Live updates via Supabase
// =============================================
let realtimeChannel = null;

function startRealtimeSubscription(tournamentId) {
  stopRealtimeSubscription();

  realtimeChannel = _supabase
    .channel(`tournament-${tournamentId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, async (payload) => {
      // Reload data and refresh view silently
      await loadPlayers();
      if (currentTournament?.type === 'commander') {
        await loadCommanderPods();
        const sb = document.getElementById('cmdr-standings-body');
        if (sb) sb.innerHTML = renderCommanderStandings(tournamentPlayers);
      } else if (currentTournament?.format === 'swiss') {
        await loadSwissRounds();
        const sb = document.getElementById('swiss-standings-body');
        if (sb) sb.innerHTML = renderSwissStandings(tournamentPlayers);
      } else if (currentTournament?.format === 'elimination') {
        await loadElimBracket();
        const sb = document.getElementById('elim-standings-body');
        if (sb) sb.innerHTML = renderElimStandings(tournamentPlayers);
      }
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'players',
      filter: `tournament_id=eq.${tournamentId}`
    }, async (payload) => {
      await loadPlayers();
      // Update standings without full re-render to preserve score inputs
      if (currentTournament?.type === 'commander') {
        const sb = document.getElementById('cmdr-standings-body');
        if (sb) sb.innerHTML = renderCommanderStandings(tournamentPlayers);
      } else if (currentTournament?.format === 'swiss') {
        const sb = document.getElementById('swiss-standings-body');
        if (sb) sb.innerHTML = renderSwissStandings(tournamentPlayers);
      } else {
        const sb = document.getElementById('elim-standings-body');
        if (sb) sb.innerHTML = renderElimStandings(tournamentPlayers);
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tournaments',
      filter: `id=eq.${tournamentId}`
    }, async (payload) => {
      if (payload.new) {
        const prevRound = currentTournament.current_round;
        currentTournament = { ...currentTournament, ...payload.new };
        // If round advanced by someone else, re-render fully
        if (payload.new.current_round !== prevRound) {
          await loadPlayers();
          refreshCurrentView();
        }
        if (payload.new.status === 'finished') {
          document.getElementById('t-type-badge').textContent += ' · Finalizado';
        }
      }
    })
    .subscribe();
}

function stopRealtimeSubscription() {
  if (realtimeChannel) {
    _supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
