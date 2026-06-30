// =============================================
// DASHBOARD
// =============================================
let selectedType = 'commander';
let joiningTournamentId = null;
let editingTournamentId = null;

function selectType(type) {
  if (type === 'commander2v2') {
    // Commander 2vs2 tiene su propio sistema de gestión — redirigir directamente
    closeModal('modal-new-tournament');
    setTimeout(() => {
      open2v2Screen();
      // Re-seleccionar 'commander' para la próxima vez que se abra el modal normal
      document.querySelector('.type-card[data-type="commander"]')?.classList.add('active');
      document.querySelector('.type-card[data-type="commander2v2"]')?.classList.remove('active');
    }, 150);
    return;
  }

  selectedType = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  document.getElementById('nt-format-row').style.display    = (type !== 'commander' && type !== 'league') ? '' : 'none';
  document.getElementById('nt-commander-row').style.display = type === 'commander' ? '' : 'none';

  // Round Robin solo disponible para Beyblade
  const rrLabel = document.getElementById('nt-format-rr-label');
  if (rrLabel) rrLabel.style.display = type === 'beyblade' ? '' : 'none';
  // Si se cambia de Beyblade a otro tipo mientras RR estaba seleccionado, volver a swiss
  if (type !== 'beyblade') {
    const rrRadio = document.querySelector('input[name="nt-format"][value="roundrobin"]');
    if (rrRadio?.checked) document.querySelector('input[name="nt-format"][value="swiss"]').checked = true;
  }
}

function openNewTournamentModal() {
  editingTournamentId = null;
  selectedType = 'commander';
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === 'commander'));
  document.getElementById('nt-format-row').style.display = 'none';
  document.getElementById('nt-commander-row').style.display = '';
  ['nt-name','nt-desc','nt-date','nt-time'].forEach(id => document.getElementById(id).value = '');
  document.querySelector('input[name="nt-format"][value="swiss"]').checked = true;
  document.querySelector('#modal-new-tournament .modal-header h3').textContent = 'Nuevo Torneo';
  document.getElementById('nt-type-selector').style.pointerEvents = '';
  openModal('modal-new-tournament');
}

function openEditTournamentModal(id, event) {
  event.stopPropagation();
  const t = window._tournamentsCache?.find(t => t.id === id);
  if (!t) return;
  editingTournamentId = id;
  selectedType = t.type;

  document.querySelector('#modal-new-tournament .modal-header h3').textContent = 'Editar Torneo';
  document.getElementById('nt-name').value = t.name;
  document.getElementById('nt-desc').value = t.description || '';

  if (t.tournament_date) {
    const d = new Date(t.tournament_date);
    const yyyy=d.getFullYear(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); document.getElementById('nt-date').value = yyyy+'-'+mm+'-'+dd;
    const hh=String(d.getHours()).padStart(2,'0'),min=String(d.getMinutes()).padStart(2,'0'); document.getElementById('nt-time').value = hh+':'+min;
  }

  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === t.type));
  document.getElementById('nt-format-row').style.display = t.type !== 'commander' ? '' : 'none';
  document.getElementById('nt-type-selector').style.pointerEvents = 'none'; // no cambiar tipo al editar
  openModal('modal-new-tournament');
}

async function createTournament() {
  const name = document.getElementById('nt-name').value.trim();
  if (!name) { showToast('Ponle un nombre al torneo'); return; }
  const date = document.getElementById('nt-date').value;
  const time = document.getElementById('nt-time').value;
  if (!date) { showToast('Pon la fecha del torneo'); return; }

  // Build date preserving local timezone (avoid UTC shift)
  const tournament_date = (() => {
    const base = time ? `${date}T${time}:00` : `${date}T00:00:00`;
    const d = new Date(base);
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(off)/60)).padStart(2,'0');
    const mm = String(Math.abs(off)%60).padStart(2,'0');
    return base + sign + hh + ':' + mm;
  })();
  const description = document.getElementById('nt-desc').value.trim();

  if (editingTournamentId) {
    // EDITAR
    const { error } = await _supabase.from('tournaments').update({
      name, description, tournament_date
    }).eq('id', editingTournamentId);
    if (error) { showToast('Error: ' + error.message); return; }
    closeModal('modal-new-tournament');
    showToast('Torneo actualizado ✓');
  } else {
    // CREAR
    const format = selectedType === 'commander'
      ? 'pods'
      : selectedType === 'league'
      ? 'league'
      : document.querySelector('input[name="nt-format"]:checked').value;

    const total_rounds   = selectedType === 'commander' ? parseInt(document.getElementById('nt-rounds').value) : null;
    const points_system  = selectedType === 'commander' ? document.getElementById('nt-points').value : null;

    const { error } = await _supabase.from('tournaments').insert({
      name, type: selectedType, format, description,
      owner_id: currentUser.id,
      status: 'upcoming',
      current_round: 0,
      tournament_date,
      total_rounds,
      points_system
    });
    if (error) { showToast('Error: ' + error.message); return; }
    closeModal('modal-new-tournament');
    showToast('¡Torneo creado!');
  }
  loadDashboard();
}

async function deleteTournament(id, event) {
  event.stopPropagation();
  if (!confirm('¿Eliminar este torneo? Se borrarán todos los jugadores y partidos.')) return;

  // Desvincular de temporadas de Liga Beyblade si existe referencia
  await _supabase.from('beyblade_season_rounds')
    .update({ tournament_id: null }).eq('tournament_id', id);

  // Borrar en orden por las foreign keys
  await _supabase.from('pod_sessions').delete().eq('tournament_id', id);
  await _supabase.from('matches').delete().eq('tournament_id', id);
  await _supabase.from('players').delete().eq('tournament_id', id);
  const { error } = await _supabase.from('tournaments').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message); return; }
  showToast('Torneo eliminado');
  loadDashboard();
}

async function loadDashboard() {
  // Render quick tools (done here so onclick fns are defined)
  const qt = document.getElementById('quick-tools');
  if (qt) qt.innerHTML = `
    <button class="btn" onclick="openRoomsScreen()"
      style="border-color:var(--magic);color:var(--magic);font-weight:700">
      🧙 Commander en vivo
    </button>
    <button class="btn" onclick="openSeasonScreen()"
      style="border-color:var(--gold);color:var(--gold);font-weight:700">
      🌀 Liga Beyblade
    </button>
  `;

  const el = document.getElementById('tournament-list');
  el.innerHTML = '<div class="empty-state">Cargando...</div>';

  // Cargar torneos 2vs2 en paralelo (tabla separada) para mostrarlos en el dashboard
  loadAndRender2v2InDashboard();

  const { data, error } = await _supabase
    .from('tournaments')
    .select('*')
    .order('tournament_date', { ascending: true });

  if (error) { el.innerHTML = '<div class="empty-state">Error cargando torneos</div>'; return; }

  window._tournamentsCache = data;

  // Cargar Hall of Fame siempre, independientemente de si hay torneos
  loadHallOfFame();

  if (!data.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏆</div>
      <p>No hay torneos programados aún.</p>
    </div>`;
    return;
  }

  const icons  = { commander:'img/magic-bunny-icon.png', standard:'img/magic-bunny-icon.png', beyblade:'img/beyblade-bunny-icon.png', league:'img/magic-bunny-icon.png' };
  const labels = { commander:'Commander · Pods', standard:'Standard · Bo3', beyblade:'Beyblade · Bo3', league:'Liga Semanal · MTG' };
  const fmtLbl = { swiss:'Swiss', elimination:'Eliminación directa', pods:'', league:'', roundrobin:'Round Robin' };

  el.innerHTML = data.map(t => {
    const dateStr = formatTournamentDate(t.tournament_date);
    const statusClass = { upcoming:'status-upcoming', active:'status-active', finished:'status-finished' }[t.status] || '';
    const statusLabel = { upcoming:'Próximo', active:'En curso', finished:'Finalizado' }[t.status] || t.status;

    const adminBtns = isAdmin ? `
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-ghost" onclick="openEditTournamentModal('${t.id}', event)">✏️ Editar</button>
        ${t.status === 'active' ? `
        <button class="btn btn-sm" style="border-color:var(--gold);color:var(--gold)"
          onclick="finalizarTorneoDesdeInicio('${t.id}', event)">🏆 Finalizar</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteTournament('${t.id}', event)">🗑 Eliminar</button>
      </div>` : '';

    return `<div class="t-card ${t.type}" onclick="openTournament('${t.id}')">
      <div class="t-card-header">
        <div class="t-card-icon"><img src="${icons[t.type]||'img/magic-bunny-icon.png'}" style="width:28px;height:28px;object-fit:contain"></div>
        <div class="t-card-info">
          <div class="t-card-name">${escHtml(t.name)}</div>
          <div class="t-card-type">${labels[t.type]}${t.format !== 'pods' ? ' · ' + fmtLbl[t.format] : ''}</div>
        </div>
      </div>
      ${dateStr ? `<div class="t-card-date">📅 ${dateStr}</div>` : ''}
      ${t.description ? `<div class="t-card-desc">${escHtml(t.description)}</div>` : ''}
      <div class="t-card-footer">
        <span style="font-size:12px"><span class="status-dot ${statusClass}"></span>${statusLabel}</span>
      </div>
      ${adminBtns}
    </div>`;
  }).join('');
}

function openJoinModal(tournamentId, tournamentName, type) {
  joiningTournamentId = tournamentId;
  document.getElementById('join-title').textContent = 'Unirse: ' + tournamentName;
  document.getElementById('join-name').value = currentUser?.user_metadata?.display_name || '';
  document.getElementById('join-bey-row').style.display = type === 'beyblade' ? '' : 'none';
  document.getElementById('join-bey').value = '';
  openModal('modal-join');
}

async function joinTournament() {
  const name = document.getElementById('join-name').value.trim();
  if (!name) { showToast('Pon tu nombre'); return; }

  const { data: existing } = await _supabase
    .from('players').select('id')
    .eq('tournament_id', joiningTournamentId)
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (existing) { showToast('Ya estás inscrito'); closeModal('modal-join'); return; }

  const bey = document.getElementById('join-bey').value.trim();
  const { error } = await _supabase.from('players').insert({
    tournament_id: joiningTournamentId,
    user_id: currentUser.id,
    name, bey_name: bey || null,
    wins:0, losses:0, draws:0, points:0, game_wins:0, game_losses:0
  });

  if (error) { showToast('Error: ' + error.message); return; }
  closeModal('modal-join');
  showToast('¡Inscripción confirmada! 🎉');
  loadDashboard();
}

function goToDashboard() {
  stopRealtimeSubscription();
  clearInterval(window._swissPollTimer);
  if (typeof stopTimerSubscription === 'function') stopTimerSubscription();
  if (typeof stopC1v1Tracker === 'function') stopC1v1Tracker();
  showScreen('screen-dashboard');
  loadDashboard();
}

function formatTournamentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('es-MX', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const hasTime = iso.includes('T') && !iso.endsWith('T00:00:00') && !iso.endsWith('T00:00:00+00:00');
  const timeStr = hasTime ? String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') : '';
  return dateStr + (timeStr ? ' · ' + timeStr : '');
}

// ── HALL OF FAME ──────────────────────────────────────────
async function loadHallOfFame() {
  const el = document.getElementById('hall-of-fame');
  if (!el) return;

  const { data, error } = await _supabase
    .from('hall_of_fame')
    .select('*')
    .order('tournament_date', { ascending: false })
    .limit(20);

  if (error || !data || !data.length) {
    el.innerHTML = '<div class="empty-state" style="padding:12px;font-size:12px">Sin ganadores registrados aún</div>';
    return;
  }

  const icons = { commander:'img/magic-bunny-icon.png', standard:'img/magic-bunny-icon.png', beyblade:'img/beyblade-bunny-icon.png', league:'img/magic-bunny-icon.png' };
  el.innerHTML = `<table class="t-table" style="font-size:12px">
    <thead><tr><th>Torneo</th><th>Tipo</th><th>Campeón</th><th>Fecha</th></tr></thead>
    <tbody>
      ${data.map(r => `<tr>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.tournament_name)}</td>
        <td><img src="${icons[r.tournament_type]||'img/magic-bunny-icon.png'}" style="width:20px;height:20px;object-fit:contain"></td>
        <td style="color:var(--gold);font-weight:700">👑 ${escHtml(r.winner_name)}</td>
        <td style="color:var(--muted)">${r.tournament_date ? new Date(r.tournament_date).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function registerHallOfFame(tournamentId) {
  const { data: t } = await _supabase
    .from('tournaments').select('*').eq('id', tournamentId).single();
  if (!t) return;

  const { data: players } = await _supabase
    .from('players').select('*').eq('tournament_id', tournamentId);
  if (!players || !players.length) return;

  const sorted = [...players].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  const winner = sorted[0];

  await _supabase.from('hall_of_fame').insert({
    tournament_id:     tournamentId,
    tournament_name:   t.name,
    tournament_type:   t.type,
    tournament_format: t.format,
    winner_name:       winner.name,
    winner_id:         winner.user_id || null,
    winner_points:     winner.points || 0,
    winner_wins:       winner.wins   || 0,
    tournament_date:   t.tournament_date || new Date().toISOString(),
    player_count:      players.length
  });
}

async function finalizarTorneoDesdeInicio(tournamentId, event) {
  event.stopPropagation();
  if (!confirm('¿Finalizar este torneo y registrar al ganador en el Hall of Fame?')) return;

  const { data: players } = await _supabase
    .from('players').select('*').eq('tournament_id', tournamentId);

  await _supabase.from('tournaments').update({ status: 'finished' }).eq('id', tournamentId);

  if (players && players.length) {
    await registerHallOfFame(tournamentId);
  }

  AudioFX.victory();
  showToast('🏆 Torneo finalizado y registrado en el Hall of Fame');
  loadDashboard();
}

// ── COMMANDER 2vs2 EN EL DASHBOARD PRINCIPAL ─────────────────
async function loadAndRender2v2InDashboard() {
  const el = document.getElementById('tournament-list-2v2');
  if (!el) return;

  const { data: tournaments, error } = await _supabase
    .from('commander_2v2_tournaments')
    .select('*')
    .in('status', ['upcoming', 'active'])
    .order('created_at', { ascending: false });

  if (error || !tournaments?.length) {
    el.innerHTML = '';
    document.getElementById('section-2v2-dashboard')?.style.setProperty('display', 'none');
    return;
  }

  document.getElementById('section-2v2-dashboard')?.style.setProperty('display', '');

  // Para cada torneo, saber si el usuario actual ya está inscrito
  const myId = currentUser?.id;
  const cards = await Promise.all(tournaments.map(async (t) => {
    let amIRegistered = false;
    if (myId) {
      const { data: existing } = await _supabase
        .from('commander_2v2_players').select('id')
        .eq('tournament_id', t.id).eq('user_id', myId).maybeSingle();
      amIRegistered = !!existing;
    }
    return render2v2DashboardCard(t, amIRegistered);
  }));

  el.innerHTML = cards.join('');
}

function render2v2DashboardCard(t, amIRegistered) {
  const statusLabel = t.status === 'active' ? '⚡ En curso' : '📅 Próximo — inscripciones abiertas';
  const statusColor = t.status === 'active' ? 'var(--magic)' : 'var(--std)';

  return `<div class="t-card commander" style="cursor:pointer" onclick="open2v2Detail('${t.id}')">
    <div class="t-card-header">
      <div class="t-card-icon"><img src="img/magic-bunny-icon.png" style="width:28px;height:28px;object-fit:contain"></div>
      <div class="t-card-info">
        <div class="t-card-name">${escHtml(t.name)}</div>
        <div class="t-card-type">Commander 2vs2 · ${t.format === 'roundrobin' ? 'Round Robin' : 'Swiss'}</div>
      </div>
    </div>
    <div class="t-card-footer">
      <span style="font-size:12px;color:${statusColor}">${statusLabel}</span>
      <span style="font-size:12px;color:var(--muted)">👥 ${t.team_count||0} equipos</span>
    </div>
    ${t.status === 'upcoming' ? `
    <div style="margin-top:10px" onclick="event.stopPropagation()">
      ${amIRegistered ? `
        <span style="font-size:12px;color:var(--green);font-weight:700">✓ Ya estás inscrito</span>
      ` : `
        <button class="btn btn-primary btn-sm w-full" onclick="open2v2RegisterModal('${t.id}')">
          ✋ Inscribirme
        </button>
      `}
    </div>` : `
    <div style="margin-top:10px" onclick="event.stopPropagation()">
      <button class="btn btn-sm w-full" style="border-color:var(--magic);color:var(--magic)"
        onclick="open2v2Detail('${t.id}')">
        Ver torneo →
      </button>
    </div>`}
  </div>`;
}
