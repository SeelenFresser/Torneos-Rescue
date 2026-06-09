// =============================================
// PERFIL DE JUGADOR
// Historial completo de torneos y partidas
// =============================================

async function openProfileScreen() {
  if (!currentUser) { showToast('Inicia sesión para ver tu perfil'); return; }
  AudioFX.tap();

  document.getElementById('game-title').textContent = '👤 Mi Perfil';
  document.getElementById('game-player-name').textContent = '';
  showScreen('screen-game');

  const content = document.getElementById('game-content');
  content.style.padding = '12px';
  content.innerHTML = `<div style="text-align:center;padding:20px"><div class="spinner"></div><p style="color:var(--muted);font-size:13px;margin-top:8px">Cargando historial...</p></div>`;

  // Obtener todos los players vinculados a este usuario
  const { data: myPlayers } = await _supabase
    .from('players').select('*, tournaments(id,name,type,format,status,tournament_date)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (!myPlayers || !myPlayers.length) {
    content.innerHTML = `
      <div style="text-align:center;padding:40px 20px">
        <div style="font-size:48px;margin-bottom:12px">🃏</div>
        <h3 style="color:var(--text);margin-bottom:8px">Sin historial aún</h3>
        <p style="color:var(--muted);font-size:13px">Inscríbete en un torneo para ver tu historial aquí</p>
      </div>`;
    return;
  }

  // Calcular estadísticas globales
  const totalTourneys = new Set(myPlayers.map(p=>p.tournament_id)).size;
  const totalWins   = myPlayers.reduce((s,p)=>s+(p.wins||0),0);
  const totalLosses = myPlayers.reduce((s,p)=>s+(p.losses||0),0);
  const totalPts    = myPlayers.reduce((s,p)=>s+(p.points||0),0);
  const winRate     = totalWins+totalLosses > 0 ? Math.round(totalWins/(totalWins+totalLosses)*100) : 0;
  const bestResult  = myPlayers.reduce((best,p) => {
    const pos = getPlayerPosition(p, myPlayers.filter(x=>x.tournament_id===p.tournament_id));
    return pos < best ? pos : best;
  }, 999);

  // Obtener partidas individuales
  const tourneyIds = myPlayers.map(p=>p.tournament_id);
  const { data: myMatches } = await _supabase
    .from('matches').select('*')
    .in('tournament_id', tourneyIds)
    .or(`player1_id.in.(${myPlayers.map(p=>p.id).join(',')}),player2_id.in.(${myPlayers.map(p=>p.id).join(',')})`)
    .eq('is_complete', true)
    .order('created_at', { ascending: false });

  const typeIcons = { commander:'🧙', standard:'🃏', beyblade:'🌀', league:'🏅' };

  content.innerHTML = `
    <!-- HEADER PERFIL -->
    <div style="text-align:center;padding:16px 0 20px">
      <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--magic));
        display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 10px">
        🧙
      </div>
      <h2 style="font-size:18px;font-weight:700;margin-bottom:2px">
        ${escHtml(myPlayers[0]?.name || currentUser.email?.split('@')[0] || 'Jugador')}
      </h2>
      <p style="font-size:12px;color:var(--muted)">${escHtml(currentUser.email||'')}</p>
    </div>

    <!-- STATS GLOBALES -->
    <div class="stats-row" style="margin-bottom:16px">
      <div class="stat-box"><div class="stat-val" style="color:var(--std)">${totalTourneys}</div><div class="stat-lbl">Torneos</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--green)">${totalWins}</div><div class="stat-lbl">Victorias</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--magic)">${totalPts}</div><div class="stat-lbl">Puntos</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--cream)">${winRate}%</div><div class="stat-lbl">Win rate</div></div>
    </div>

    ${bestResult < 999 ? `
    <div style="text-align:center;padding:8px;background:rgba(245,208,96,0.1);border:1px solid var(--gold);
      border-radius:var(--radius);margin-bottom:16px;font-size:13px;color:var(--gold)">
      🏆 Mejor resultado: ${['👑 Campeón','🥈 2° lugar','🥉 3° lugar'][bestResult-1]||bestResult+'° lugar'}
    </div>` : ''}

    <!-- HISTORIAL POR TORNEO -->
    <div class="section-title" style="margin-bottom:10px">📋 Historial de torneos</div>
    ${myPlayers.map(p => {
      const t = p.tournaments;
      if (!t) return '';
      const icon = typeIcons[t.type]||'🏆';
      const tourneyMatches = (myMatches||[]).filter(m=>m.tournament_id===t.id);
      const myMatcesInTourney = tourneyMatches.filter(m=>
        myPlayers.find(mp=>mp.id===m.player1_id||mp.id===m.player2_id)
      );
      const myPlayerInTourney = myPlayers.find(mp=>mp.tournament_id===t.id);
      const gd = (myPlayerInTourney?.game_wins||0)-(myPlayerInTourney?.game_losses||0);

      return `<div class="section" style="margin-bottom:10px">
        <div class="section-head" style="cursor:pointer" onclick="toggleTourneyHistory('th-${t.id}')">
          <span class="section-title">${icon} ${escHtml(t.name)}</span>
          <span style="font-size:11px;color:var(--muted)">
            ${t.status==='finished'?'✓ Finalizado':t.status==='active'?'En curso':'Próximo'}
            ${t.tournament_date?'· '+new Date(t.tournament_date).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}):''}
          </span>
        </div>
        <div class="section-body">
          <div style="display:flex;gap:16px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:13px"><strong style="color:var(--green)">${myPlayerInTourney?.wins||0}V</strong> <span style="color:var(--muted)">-</span> <strong style="color:var(--red)">${myPlayerInTourney?.losses||0}D</strong></span>
            <span style="font-size:13px;color:var(--magic)">${myPlayerInTourney?.points||0} pts</span>
            <span style="font-size:13px;color:${gd>=0?'var(--std)':'var(--red)'}">${gd>0?'+':''}${gd} GD</span>
          </div>
          <div id="th-${t.id}" style="display:none">
            ${myMatcesInTourney.length ? `
              <table class="t-table" style="font-size:12px">
                <thead><tr><th>vs</th><th>Resultado</th><th>Ronda</th></tr></thead>
                <tbody>
                  ${myMatcesInTourney.map(m => {
                    const iAmP1 = myPlayers.some(mp=>mp.id===m.player1_id);
                    const oppName = iAmP1 ? m.player2_name : m.player1_name;
                    const myScore = iAmP1 ? m.score_p1 : m.score_p2;
                    const oppScore = iAmP1 ? m.score_p2 : m.score_p1;
                    const myPlayerId = myPlayers.find(mp=>mp.tournament_id===m.tournament_id)?.id;
                    const won = m.winner_id === myPlayerId;
                    return `<tr>
                      <td>${escHtml(oppName||'?')}</td>
                      <td style="color:${won?'var(--green)':'var(--red)'};font-weight:700">
                        ${won?'✓':'✗'} ${myScore??'?'}–${oppScore??'?'}
                      </td>
                      <td style="color:var(--muted)">R${m.round}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>` : '<span style="color:var(--muted);font-size:12px">Sin partidas registradas</span>'}
          </div>
          <button class="btn btn-xs btn-ghost" style="margin-top:6px" onclick="toggleTourneyHistory('th-${t.id}')">
            Ver partidas ▾
          </button>
        </div>
      </div>`;
    }).join('')}
  `;
}

function toggleTourneyHistory(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getPlayerPosition(player, allPlayersInTourney) {
  const sorted = [...allPlayersInTourney].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  return sorted.findIndex(p=>p.id===player.id)+1;
}
