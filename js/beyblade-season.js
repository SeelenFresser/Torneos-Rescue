// =============================================
// BEYBLADE SEASON — Liga tipo Fórmula 1
// =============================================

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// ── ESTADO GLOBAL ────────────────────────────
let currentSeason = null;
let seasonStandings = [];
let seasonRounds = [];

// ── ABRIR PANTALLA DE TEMPORADA ───────────────
async function openSeasonScreen() {
  AudioFX.tap();
  showScreen('screen-season');
  document.getElementById('season-content').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';
  await loadSeasonScreen();
}

async function loadSeasonScreen() {
  const { data: seasons } = await _supabase
    .from('beyblade_seasons')
    .select('*')
    .order('created_at', { ascending: false });

  const el = document.getElementById('season-content');
  const isAdmin = isOwner ? isOwner() : (currentUser?.id === '37aa3b75-bcc6-45a8-9b63-1de1285d14f6');

  // Separar activas y finalizadas
  const active = (seasons||[]).filter(s => s.status !== 'finished');
  const finished = (seasons||[]).filter(s => s.status === 'finished');

  el.innerHTML = `
    ${isAdmin ? `
    <button class="btn btn-primary w-full" style="margin-bottom:16px"
      onclick="openCreateSeasonModal()">
      🏎 + Nueva Temporada
    </button>` : ''}

    ${active.length ? `
    <div class="section-title" style="margin-bottom:8px">⚡ Temporadas activas</div>
    ${active.map(s => renderSeasonCard(s, true)).join('')}` : ''}

    ${finished.length ? `
    <div class="section-title" style="margin-top:16px;margin-bottom:8px">🏆 Temporadas finalizadas</div>
    ${finished.map(s => renderSeasonCard(s, false)).join('')}` : ''}

    ${!seasons?.length ? '<div class="empty-state">No hay temporadas aún</div>' : ''}
  `;
}

function renderSeasonCard(s, isActive) {
  const statusColors = { active: 'var(--bey)', playoff: 'var(--gold)', finished: 'var(--muted)', upcoming: 'var(--std)' };
  const statusLabels = { active: '⚡ En curso', playoff: '🏆 Playoff', finished: '✓ Finalizada', upcoming: '📅 Próxima' };

  return `<div class="section" style="margin-bottom:10px;cursor:pointer"
    onclick="openSeasonDetail('${s.id}')">
    <div class="section-body" style="padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:16px;font-weight:800;color:var(--text)">${escHtml(s.name)}</div>
        <span style="font-size:11px;font-weight:700;color:${statusColors[s.status]||'var(--muted)'};
          background:${statusColors[s.status]||'var(--muted)'}22;padding:3px 8px;border-radius:20px">
          ${statusLabels[s.status]||s.status}
        </span>
      </div>
      <div style="display:flex;gap:16px;font-size:12px;color:var(--muted)">
        <span>🗓 ${s.total_weeks} semanas</span>
        <span>📅 Semana ${s.current_week||0}/${s.total_weeks}</span>
        <span>👥 ${s.player_count||0} pilotos</span>
      </div>
    </div>
  </div>`;
}

// ── MODAL CREAR TEMPORADA ─────────────────────
function openCreateSeasonModal() {
  openModal('modal-create-season');
}

async function createSeason() {
  const name = document.getElementById('season-name')?.value?.trim();
  const weeks = parseInt(document.getElementById('season-weeks')?.value)||8;

  if (!name) { showToast('Escribe un nombre para la temporada'); return; }

  const { data, error } = await _supabase.from('beyblade_seasons').insert({
    name, total_weeks: weeks, current_week: 0,
    status: 'upcoming', player_count: 0,
    owner_id: currentUser.id
  }).select().single();

  if (error) { showToast('Error: '+error.message); return; }

  closeModal('modal-create-season');
  AudioFX.roundStart();
  showToast(`🏎 Temporada "${name}" creada`);
  await loadSeasonScreen();
}

// ── DETALLE DE TEMPORADA ──────────────────────
async function openSeasonDetail(seasonId) {
  AudioFX.tap();
  const { data: season } = await _supabase
    .from('beyblade_seasons').select('*').eq('id', seasonId).single();
  if (!season) return;
  currentSeason = season;

  showScreen('screen-season-detail');
  document.getElementById('season-detail-title').textContent = season.name;
  document.getElementById('season-detail-content').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';

  await loadSeasonDetail();
}

async function loadSeasonDetail() {
  if (!currentSeason) return;

  // Cargar standings y rondas en paralelo
  const [{ data: standings }, { data: rounds }] = await Promise.all([
    _supabase.from('beyblade_season_players').select('*')
      .eq('season_id', currentSeason.id)
      .order('season_points', { ascending: false }),
    _supabase.from('beyblade_season_rounds').select('*, tournaments(name,status)')
      .eq('season_id', currentSeason.id)
      .order('week_number', { ascending: true })
  ]);

  seasonStandings = standings || [];
  seasonRounds = rounds || [];

  const isAdmin = isOwner ? isOwner() : (currentUser?.id === '37aa3b75-bcc6-45a8-9b63-1de1285d14f6');
  const s = currentSeason;

  const el = document.getElementById('season-detail-content');

  // Determinar tab activo
  const activeTab = window._seasonTab || 'standings';

  el.innerHTML = `
    <!-- TABS -->
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--dark3);
      border-radius:10px;padding:4px">
      ${[['standings','🏆 Standing'],['rounds','📅 Fechas'],['playoff','⚔️ Playoff']].map(([id,label])=>`
        <button onclick="switchSeasonTab('${id}')"
          class="btn btn-sm ${activeTab===id?'btn-primary':'btn-ghost'}"
          style="flex:1;font-size:12px" id="season-tab-${id}">
          ${label}
        </button>`).join('')}
    </div>

    <!-- CONTENIDO DEL TAB -->
    <div id="season-tab-content"></div>
  `;

  renderSeasonTab(activeTab);
}

function switchSeasonTab(tab) {
  window._seasonTab = tab;
  // Actualizar botones
  ['standings','rounds','playoff'].forEach(t => {
    const btn = document.getElementById(`season-tab-${t}`);
    if (btn) {
      btn.className = `btn btn-sm ${t===tab?'btn-primary':'btn-ghost'}`;
      btn.style.flex = '1'; btn.style.fontSize = '12px';
    }
  });
  renderSeasonTab(tab);
}

function renderSeasonTab(tab) {
  const el = document.getElementById('season-tab-content');
  if (!el) return;
  if (tab === 'standings') renderSeasonStandings(el);
  else if (tab === 'rounds') renderSeasonRounds(el);
  else if (tab === 'playoff') renderSeasonPlayoff(el);
}

// ── STANDING TIPO F1 ──────────────────────────
function renderSeasonStandings(el) {
  const isAdmin = isOwner ? isOwner() : (currentUser?.id === '37aa3b75-bcc6-45a8-9b63-1de1285d14f6');
  const s = currentSeason;

  const posIcons = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
  const medalColors = ['#FFD700','#C0C0C0','#CD7F32'];

  // Calcular top 4 u 8 para playoff
  const playoffSpots = seasonStandings.length >= 12 ? 8 : 4;

  el.innerHTML = `
    <!-- HEADER TEMPORADA -->
    <div style="background:linear-gradient(135deg,#1A0010,#2D0020);border:1px solid var(--bey);
      border-radius:14px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Temporada</div>
          <div style="font-size:18px;font-weight:800;color:var(--bey)">${escHtml(s.name)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:900;color:var(--gold)">${s.current_week||0}</div>
          <div style="font-size:11px;color:var(--muted)">de ${s.total_weeks} fechas</div>
        </div>
      </div>
      <div style="height:6px;background:var(--dark3);border-radius:3px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,var(--bey),var(--gold));
          width:${((s.current_week||0)/s.total_weeks)*100}%;border-radius:3px;
          transition:width 0.5s ease"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--muted)">
        <span>Inicio</span>
        <span>Top ${playoffSpots} → Playoff</span>
        <span>Fin</span>
      </div>
    </div>

    <!-- TABLA DE PILOTOS -->
    ${seasonStandings.length ? `
    <div style="display:grid;gap:6px;margin-bottom:16px">
      ${seasonStandings.map((p, i) => {
        const inPlayoff = i < playoffSpots;
        const c = LIFE_COLORS[i % LIFE_COLORS.length];
        const isLeader = i === 0;
        const gap = i > 0 ? seasonStandings[0].season_points - p.season_points : 0;

        return `<div style="background:${inPlayoff?c.bg:'var(--dark2)'};
          border:2px solid ${inPlayoff?c.accent+'44':'var(--border)'};
          border-radius:12px;padding:10px 14px;
          display:flex;align-items:center;gap:10px;
          position:relative;overflow:hidden">

          ${inPlayoff?`<div style="position:absolute;top:0;right:0;bottom:0;width:3px;
            background:${c.accent}"></div>`:''}

          <!-- POSICIÓN -->
          <div style="font-size:${i<3?'22px':'16px'};min-width:28px;text-align:center">
            ${posIcons[i]||`${i+1}°`}
          </div>

          <!-- NOMBRE + BEY -->
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:${isLeader?'900':'700'};
              color:${isLeader?'var(--gold)':inPlayoff?c.accent:'var(--text)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escHtml(p.player_name)}
              ${isLeader?'<span style="font-size:10px;margin-left:4px">👑 LÍDER</span>':''}
            </div>
            ${p.bey_name?`<div style="font-size:11px;color:var(--muted)">${escHtml(p.bey_name)}</div>`:''}
          </div>

          <!-- PUNTOS -->
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:900;color:${isLeader?'var(--gold)':inPlayoff?c.accent:'var(--text)'}">
              ${p.season_points}
            </div>
            <div style="font-size:10px;color:var(--muted)">
              ${i===0?'pts':'-'+gap+' pts'}
            </div>
          </div>

          <!-- VICTORIAS -->
          <div style="text-align:center;min-width:36px">
            <div style="font-size:14px;font-weight:700;color:var(--green)">${p.wins||0}</div>
            <div style="font-size:10px;color:var(--muted)">V</div>
          </div>

          ${inPlayoff?`<div style="font-size:9px;color:${c.accent};font-weight:700;
            writing-mode:vertical-rl;text-orientation:mixed;padding-left:4px">
            PLAYOFF
          </div>`:''}
        </div>`;
      }).join('')}
    </div>` : `
    <div class="empty-state" style="padding:24px">
      <div style="font-size:32px;margin-bottom:8px">🏎</div>
      <p>Aún no hay pilotos registrados.<br>Completa la primera fecha para ver el standing.</p>
    </div>`}

    <!-- BOTONES ADMIN -->
    ${isAdmin ? `
    <div style="display:grid;gap:8px">
      ${s.status === 'active' && s.current_week >= 1 ? `
      <button class="btn btn-primary" onclick="cutToPlayoff()">
        ⚔️ Cortar al Playoff (Top ${playoffSpots})
      </button>` : ''}
      ${s.status === 'upcoming' ? `
      <button class="btn btn-primary" onclick="startSeason()">
        🏎 Iniciar Temporada
      </button>` : ''}
    </div>` : ''}

    <!-- SISTEMA DE PUNTOS -->
    <div style="margin-top:16px;background:var(--dark2);border-radius:10px;padding:12px 14px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
        letter-spacing:1px;margin-bottom:8px">Sistema de puntos F1</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${F1_POINTS.map((pts,i)=>`
          <div style="background:var(--dark3);border-radius:6px;padding:4px 8px;font-size:11px">
            <span style="color:var(--muted)">${i+1}°</span>
            <span style="color:var(--gold);font-weight:700;margin-left:3px">${pts}pts</span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ── FECHAS (RONDAS) ───────────────────────────
function renderSeasonRounds(el) {
  const isAdmin = isOwner ? isOwner() : (currentUser?.id === '37aa3b75-bcc6-45a8-9b63-1de1285d14f6');
  const s = currentSeason;

  el.innerHTML = `
    ${isAdmin && s.status === 'active' ? `
    <button class="btn btn-primary w-full" style="margin-bottom:14px"
      onclick="openLinkTournamentModal()">
      + Vincular torneo de esta semana
    </button>` : ''}

    ${seasonRounds.length ? `
    <div style="display:grid;gap:8px">
      ${seasonRounds.map(r => {
        const t = r.tournaments;
        const statusColor = t?.status==='finished' ? 'var(--green)' : 'var(--bey)';
        return `<div style="background:var(--dark2);border:1px solid var(--border);
          border-radius:12px;padding:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">
                Fecha ${r.week_number} — ${escHtml(t?.name||'Torneo')}
              </div>
              <div style="font-size:11px;color:${statusColor};margin-top:2px">
                ${t?.status==='finished'?'✓ Completada':'En curso'}
              </div>
            </div>
            ${r.points_distributed ? `
              <span style="font-size:11px;color:var(--green);font-weight:700">
                ✓ Puntos F1 dados
              </span>` : isAdmin && t?.status==='finished' ? `
              <button class="btn btn-sm btn-primary" onclick="distributeF1Points('${r.id}','${r.tournament_id}','${r.week_number}')">
                🏎 Dar puntos F1
              </button>` : ''}
          </div>
          ${r.results_snapshot ? renderRoundSnapshot(r.results_snapshot) : ''}
        </div>`;
      }).join('')}
    </div>` : `
    <div class="empty-state" style="padding:24px">
      <div style="font-size:32px;margin-bottom:8px">📅</div>
      <p>No hay fechas registradas aún.</p>
    </div>`}
  `;
}

function renderRoundSnapshot(snapshotJson) {
  try {
    const results = JSON.parse(snapshotJson);
    return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
      ${results.slice(0,5).map((r,i)=>`
        <div style="font-size:11px;background:var(--dark3);border-radius:6px;padding:3px 8px">
          ${['🥇','🥈','🥉','4°','5°'][i]} ${escHtml(r.name)}
          <span style="color:var(--gold);margin-left:3px">+${F1_POINTS[i]||0}</span>
        </div>`).join('')}
      ${results.length>5?`<div style="font-size:11px;color:var(--muted);padding:3px 8px">+${results.length-5} más</div>`:''}
    </div>`;
  } catch(e) { return ''; }
}

// ── VINCULAR TORNEO ───────────────────────────
async function openLinkTournamentModal() {
  // Buscar torneos Beyblade finalizados o activos sin temporada asignada
  const { data: tournaments } = await _supabase
    .from('tournaments')
    .select('id,name,status,tournament_date')
    .eq('type', 'beyblade')
    .in('status', ['active','finished'])
    .order('created_at', { ascending: false })
    .limit(20);

  // Filtrar los que ya están vinculados a esta temporada
  const linked = new Set(seasonRounds.map(r => r.tournament_id));
  const available = (tournaments||[]).filter(t => !linked.has(t.id));

  const list = document.getElementById('link-tournament-list');
  if (list) {
    list.innerHTML = available.length ? available.map(t => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
        border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${escHtml(t.name)}</div>
          <div style="font-size:11px;color:var(--muted)">${t.status==='finished'?'✓ Finalizado':'En curso'}</div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="linkTournamentToSeason('${t.id}')">
          Vincular
        </button>
      </div>`).join('') :
      '<div class="empty-state" style="padding:12px">No hay torneos disponibles</div>';
  }
  openModal('modal-link-tournament');
}

async function linkTournamentToSeason(tournamentId) {
  const nextWeek = (currentSeason.current_week||0) + 1;

  const { error } = await _supabase.from('beyblade_season_rounds').insert({
    season_id: currentSeason.id,
    tournament_id: tournamentId,
    week_number: nextWeek,
    points_distributed: false
  });

  if (error) { showToast('Error: '+error.message); return; }

  // Actualizar semana actual
  await _supabase.from('beyblade_seasons').update({
    current_week: nextWeek, status: 'active'
  }).eq('id', currentSeason.id);
  currentSeason.current_week = nextWeek;
  currentSeason.status = 'active';

  closeModal('modal-link-tournament');
  AudioFX.tap();
  showToast(`Fecha ${nextWeek} vinculada ✓`);
  await loadSeasonDetail();
  switchSeasonTab('rounds');
}

// ── DISTRIBUIR PUNTOS F1 ──────────────────────
async function distributeF1Points(roundId, tournamentId, weekNumber) {
  if (!confirm(`¿Distribuir puntos F1 para la Fecha ${weekNumber}? Esto no se puede deshacer.`)) return;

  // Obtener jugadores del torneo ordenados por posición final
  const { data: players } = await _supabase
    .from('players').select('*')
    .eq('tournament_id', tournamentId)
    .order('points', { ascending: false });

  if (!players?.length) { showToast('Sin jugadores en el torneo'); return; }

  // Ordenar: puntos desc, luego GD, luego wins
  const sorted = [...players].sort((a,b) =>
    (b.points - a.points) ||
    ((b.game_wins-b.game_losses)-(a.game_wins-a.game_losses)) ||
    (b.wins - a.wins)
  );

  const snapshotData = [];

  // Dar puntos F1 a cada jugador
  for (let i = 0; i < sorted.length; i++) {
    const f1pts = F1_POINTS[i] || 0;
    const p = sorted[i];
    snapshotData.push({ name: p.name, pts: f1pts, tournament_pts: p.points });

    // Buscar si ya existe en season_players
    const { data: existing } = await _supabase
      .from('beyblade_season_players').select('*')
      .eq('season_id', currentSeason.id)
      .eq('player_name', p.name)
      .single();

    if (existing) {
      await _supabase.from('beyblade_season_players').update({
        season_points: (existing.season_points||0) + f1pts,
        wins: i===0 ? (existing.wins||0)+1 : existing.wins,
        participations: (existing.participations||0)+1,
        best_position: Math.min(existing.best_position||99, i+1)
      }).eq('id', existing.id);
    } else {
      await _supabase.from('beyblade_season_players').insert({
        season_id: currentSeason.id,
        player_name: p.name,
        bey_name: p.bey_name || null,
        season_points: f1pts,
        wins: i===0 ? 1 : 0,
        participations: 1,
        best_position: i+1
      });
    }
  }

  // Marcar ronda como distribuida
  await _supabase.from('beyblade_season_rounds').update({
    points_distributed: true,
    results_snapshot: JSON.stringify(snapshotData)
  }).eq('id', roundId);

  // Actualizar conteo de jugadores en la temporada
  const { count } = await _supabase
    .from('beyblade_season_players')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', currentSeason.id);

  await _supabase.from('beyblade_seasons').update({ player_count: count })
    .eq('id', currentSeason.id);

  // Registrar en Hall of Fame el ganador de la fecha
  if (sorted[0]) {
    await _supabase.from('hall_of_fame').insert({
      tournament_id: tournamentId,
      tournament_name: `${currentSeason.name} — Fecha ${weekNumber}`,
      tournament_type: 'beyblade',
      tournament_format: 'season_round',
      winner_name: sorted[0].name,
      winner_points: sorted[0].points,
      winner_wins: sorted[0].wins,
      tournament_date: new Date().toISOString(),
      player_count: sorted.length
    }).on('conflict', 'tournament_id');
  }

  AudioFX.victory();
  showToast('🏎 Puntos F1 distribuidos ✓');
  await loadSeasonDetail();
  switchSeasonTab('standings');
}

// ── INICIAR TEMPORADA ─────────────────────────
async function startSeason() {
  await _supabase.from('beyblade_seasons').update({ status: 'active' })
    .eq('id', currentSeason.id);
  currentSeason.status = 'active';
  AudioFX.roundStart();
  showToast('🏎 ¡Temporada iniciada!');
  await loadSeasonDetail();
}

// ── CORTAR AL PLAYOFF ─────────────────────────
async function cutToPlayoff() {
  const playoffSpots = seasonStandings.length >= 12 ? 8 : 4;
  if (!confirm(`¿Cortar la temporada y generar el Playoff con el Top ${playoffSpots}?`)) return;

  const top = seasonStandings.slice(0, playoffSpots);

  // Crear matches de cuartos o semis
  const matches = [];
  if (playoffSpots === 8) {
    // Cuartos: 1v8, 2v7, 3v6, 4v5
    const pairs = [[0,7],[1,6],[2,5],[3,4]];
    pairs.forEach(([a,b], i) => matches.push({
      season_id: currentSeason.id, round: 1, match_number: i+1,
      player1_name: top[a].player_name, player2_name: top[b].player_name,
      player1_season_id: top[a].id, player2_season_id: top[b].id,
      format: 'bo3', status: 'pending',
      seed1: a+1, seed2: b+1
    }));
  } else {
    // Semis: 1v4, 2v3
    const pairs = [[0,3],[1,2]];
    pairs.forEach(([a,b], i) => matches.push({
      season_id: currentSeason.id, round: 1, match_number: i+1,
      player1_name: top[a].player_name, player2_name: top[b].player_name,
      player1_season_id: top[a].id, player2_season_id: top[b].id,
      format: 'bo3', status: 'pending',
      seed1: a+1, seed2: b+1
    }));
  }

  await _supabase.from('beyblade_playoffs').insert(matches);
  await _supabase.from('beyblade_seasons').update({
    status: 'playoff', playoff_spots: playoffSpots
  }).eq('id', currentSeason.id);
  currentSeason.status = 'playoff';
  currentSeason.playoff_spots = playoffSpots;

  AudioFX.roundStart();
  showToast(`⚔️ Playoff generado — Top ${playoffSpots}`);
  await loadSeasonDetail();
  switchSeasonTab('playoff');
}

// ── PLAYOFF ───────────────────────────────────
async function renderSeasonPlayoff(el) {
  const { data: matches } = await _supabase
    .from('beyblade_playoffs').select('*')
    .eq('season_id', currentSeason.id)
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });

  const isAdmin = isOwner ? isOwner() : (currentUser?.id === '37aa3b75-bcc6-45a8-9b63-1de1285d14f6');
  const s = currentSeason;

  if (!matches?.length || s.status === 'active') {
    el.innerHTML = `<div class="empty-state" style="padding:24px">
      <div style="font-size:32px;margin-bottom:8px">⚔️</div>
      <p>${s.status==='active'?'El playoff se genera cuando cierres la temporada.':'No hay datos de playoff.'}</p>
    </div>`;
    return;
  }

  // Agrupar por ronda
  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const roundKeys = Object.keys(rounds).map(Number).sort((a,b)=>a-b);
  const spots = s.playoff_spots || 4;

  const roundLabels = {
    1: spots===8 ? '⚔️ Cuartos de Final' : '⚔️ Semifinales',
    2: spots===8 ? '⚔️ Semifinales' : '🏆 Final',
    3: spots===8 ? '🏆 Final' : null
  };

  const formatLabels = { bo3: 'Bo3', bo5: 'Bo5', bo7: 'Bo7' };

  el.innerHTML = `
    <div style="display:grid;gap:16px">
      ${roundKeys.map(rn => {
        const roundMatches = rounds[rn];
        const allDone = roundMatches.every(m=>m.status==='complete');
        const label = roundLabels[rn] || `Ronda ${rn}`;

        return `<div>
          <div style="font-size:12px;font-weight:700;color:var(--bey);
            text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;
            display:flex;justify-content:space-between;align-items:center">
            <span>${label}</span>
            <span style="color:${allDone?'var(--green)':'var(--muted)'}">
              ${allDone?'✓ Completa':'En curso'}
            </span>
          </div>
          ${roundMatches.sort((a,b)=>a.match_number-b.match_number).map(m =>
            renderPlayoffMatchCard(m, isAdmin, formatLabels)
          ).join('')}
          ${isAdmin && allDone && roundKeys[roundKeys.indexOf(rn)+1] === undefined ?
            renderNextRoundButton(rn, rounds, spots) : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderPlayoffMatchCard(m, isAdmin, formatLabels) {
  const isComplete = m.status === 'complete';
  const w1 = isComplete && m.winner_name === m.player1_name;
  const w2 = isComplete && m.winner_name === m.player2_name;

  return `<div style="background:var(--dark2);border:1px solid ${isComplete?'var(--border)':'var(--bey)'}44;
    border-radius:12px;padding:12px 14px;margin-bottom:8px">
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">
      ${m.seed1?`#${m.seed1} vs #${m.seed2} · `:''}<span style="color:var(--bey)">${formatLabels[m.format]||m.format}</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <div style="flex:1;font-size:14px;font-weight:${w1?'800':'400'};
        color:${w1?'var(--gold)':w2?'var(--muted)':'var(--text)'}">
        ${escHtml(m.player1_name||'?')}
      </div>
      ${isComplete ? `
        <div style="font-size:18px;font-weight:900;color:var(--text);min-width:60px;text-align:center">
          ${m.score1||0}–${m.score2||0}
        </div>` : `
        <div style="color:var(--muted);font-size:12px">vs</div>`}
      <div style="flex:1;text-align:right;font-size:14px;font-weight:${w2?'800':'400'};
        color:${w2?'var(--gold)':w1?'var(--muted)':'var(--text)'}">
        ${escHtml(m.player2_name||'?')}
      </div>
    </div>
    ${isAdmin && !isComplete ? `
    <div style="margin-top:10px;display:grid;grid-template-columns:1fr auto auto 1fr;
      gap:8px;align-items:center">
      <input class="score-in" id="pm${m.id}-s1" type="number" min="0" max="4"
        placeholder="0" style="text-align:center">
      <span style="color:var(--muted)">–</span>
      <input class="score-in" id="pm${m.id}-s2" type="number" min="0" max="4"
        placeholder="0" style="text-align:center">
      <button class="result-btn result-btn-confirm"
        onclick="confirmPlayoffSeasonMatch('${m.id}','${m.player1_name}','${m.player2_name}','${m.format}')">
        ✓
      </button>
    </div>` : ''}
    ${isComplete && m.winner_name ? `
    <div style="margin-top:6px;font-size:12px;color:var(--green);text-align:center">
      🏆 ${escHtml(m.winner_name)} avanza
    </div>` : ''}
  </div>`;
}

async function confirmPlayoffSeasonMatch(matchId, p1Name, p2Name, format) {
  const s1 = parseInt(document.getElementById(`pm${matchId}-s1`)?.value)||0;
  const s2 = parseInt(document.getElementById(`pm${matchId}-s2`)?.value)||0;

  // Validar según formato
  const maxWins = format==='bo7' ? 4 : format==='bo5' ? 3 : 2;
  if (s1!==maxWins && s2!==maxWins) {
    showToast(`${format.toUpperCase()}: alguien debe ganar ${maxWins}`); return;
  }
  if (s1===s2) { showToast('No puede haber empate'); return; }

  const winnerName = s1>s2 ? p1Name : p2Name;

  const { error } = await _supabase.from('beyblade_playoffs').update({
    score1: s1, score2: s2,
    winner_name: winnerName,
    status: 'complete'
  }).eq('id', matchId);

  if (error) { showToast('Error: '+error.message); return; }

  AudioFX.roundEnd();
  showToast(`✓ ${winnerName} avanza`);
  await renderSeasonPlayoff(document.getElementById('season-tab-content'));
}

function renderNextRoundButton(currentRound, rounds, spots) {
  const isAdmin = isOwner ? isOwner() : (currentUser?.id === '37aa3b75-bcc6-45a8-9b63-1de1285d14f6');
  if (!isAdmin) return '';

  const currentRoundMatches = rounds[currentRound];
  const isFinalRound = (spots===4 && currentRound===1) || (spots===8 && currentRound===2);

  if (isFinalRound) {
    return `<button class="btn btn-primary w-full" style="margin-top:8px"
      onclick="generateSeasonFinal(${currentRound})">
      🏆 Generar Final
    </button>`;
  }

  return `<button class="btn btn-primary w-full" style="margin-top:8px"
    onclick="advancePlayoffRound(${currentRound})">
    ▶ Generar siguiente ronda
  </button>`;
}

async function advancePlayoffRound(currentRound) {
  const { data: currentMatches } = await _supabase
    .from('beyblade_playoffs').select('*')
    .eq('season_id', currentSeason.id)
    .eq('round', currentRound)
    .order('match_number');

  if (!currentMatches?.every(m=>m.status==='complete')) {
    showToast('Completa todos los partidos primero'); return;
  }

  const winners = currentMatches.map(m => ({
    name: m.winner_name,
    seed: m.score1 > m.score2 ? m.seed1 : m.seed2
  }));

  const nextRound = currentRound + 1;
  const isFinalRound = winners.length === 2;

  const nextFormat = isFinalRound ? 'bo5' : 'bo3';

  const newMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    newMatches.push({
      season_id: currentSeason.id,
      round: nextRound,
      match_number: Math.floor(i/2)+1,
      player1_name: winners[i].name,
      player2_name: winners[i+1]?.name || 'BYE',
      format: nextFormat,
      status: 'pending',
      seed1: winners[i].seed,
      seed2: winners[i+1]?.seed
    });
  }

  await _supabase.from('beyblade_playoffs').insert(newMatches);
  AudioFX.roundStart();
  showToast('▶ Siguiente ronda generada');
  await renderSeasonPlayoff(document.getElementById('season-tab-content'));
}

async function generateSeasonFinal(currentRound) {
  const { data: semis } = await _supabase
    .from('beyblade_playoffs').select('*')
    .eq('season_id', currentSeason.id)
    .eq('round', currentRound)
    .order('match_number');

  if (!semis?.every(m=>m.status==='complete')) {
    showToast('Completa las semifinales primero'); return;
  }

  const winners = semis.map(m => m.winner_name);
  const losers = semis.map(m => m.player1_name===m.winner_name ? m.player2_name : m.player1_name);
  const nextRound = currentRound + 1;

  await _supabase.from('beyblade_playoffs').insert([
    {
      season_id: currentSeason.id, round: nextRound, match_number: 1,
      player1_name: winners[0], player2_name: winners[1],
      format: 'bo5', status: 'pending', is_final: true
    },
    {
      season_id: currentSeason.id, round: nextRound, match_number: 2,
      player1_name: losers[0], player2_name: losers[1],
      format: 'bo5', status: 'pending', is_third_place: true
    }
  ]);

  AudioFX.roundStart();
  showToast('🏆 Final y 3er lugar generados');
  await renderSeasonPlayoff(document.getElementById('season-tab-content'));
}
