// =============================================
// DASHBOARD
// =============================================
let selectedType = 'commander';
let joiningTournamentId = null;

function selectType(type) {
  selectedType = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  document.getElementById('nt-format-row').style.display = type !== 'commander' ? '' : 'none';
}

function openNewTournamentModal() {
  selectedType = 'commander';
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === 'commander'));
  document.getElementById('nt-format-row').style.display = 'none';
  ['nt-name','nt-desc','nt-date','nt-time'].forEach(id => document.getElementById(id).value = '');
  document.querySelector('input[name="nt-format"][value="swiss"]').checked = true;
  openModal('modal-new-tournament');
}

async function createTournament() {
  const name = document.getElementById('nt-name').value.trim();
  if (!name) { showToast('Ponle un nombre al torneo'); return; }
  const date = document.getElementById('nt-date').value;
  const time = document.getElementById('nt-time').value;
  if (!date) { showToast('Pon la fecha del torneo'); return; }

  const format = selectedType === 'commander'
    ? 'pods'
    : document.querySelector('input[name="nt-format"]:checked').value;

  const tournament_date = time ? `${date}T${time}:00` : `${date}T00:00:00`;

  const { error } = await _supabase.from('tournaments').insert({
    name, type: selectedType, format,
    description: document.getElementById('nt-desc').value.trim(),
    owner_id: currentUser.id,
    status: 'upcoming',
    current_round: 0,
    tournament_date
  });

  if (error) { showToast('Error: ' + error.message); return; }
  closeModal('modal-new-tournament');
  showToast('¡Torneo creado!');
  loadDashboard();
}

async function loadDashboard() {
  const el = document.getElementById('tournament-list');
  el.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await _supabase
    .from('tournaments')
    .select('*')
    .order('tournament_date', { ascending: true });

  if (error) { el.innerHTML = '<div class="empty-state">Error cargando torneos</div>'; return; }

  if (!data.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏆</div>
      <p>No hay torneos programados aún.</p>
    </div>`;
    return;
  }

  const icons  = { commander:'🧙', standard:'🃏', beyblade:'🌀' };
  const labels = { commander:'Commander · Pods', standard:'Standard · Bo3', beyblade:'Beyblade · Bo3' };
  const fmtLbl = { swiss:'Swiss', elimination:'Eliminación directa', pods:'' };

  el.innerHTML = data.map(t => {
    const playerCount = t.player_count ?? 0;
    const dateStr = formatTournamentDate(t.tournament_date);
    const statusClass = { upcoming:'status-upcoming', active:'status-active', finished:'status-finished' }[t.status] || '';
    const statusLabel = { upcoming:'Próximo', active:'En curso', finished:'Finalizado' }[t.status] || t.status;

    return `<div class="t-card ${t.type}" onclick="openTournament('${t.id}')">
      <div class="t-card-header">
        <div class="t-card-icon">${icons[t.type] || '🏆'}</div>
        <div class="t-card-info">
          <div class="t-card-name">${escHtml(t.name)}</div>
          <div class="t-card-type">${labels[t.type]}${t.format !== 'pods' ? ' · ' + fmtLbl[t.format] : ''}</div>
        </div>
      </div>
      ${dateStr ? `<div class="t-card-date">📅 ${dateStr}</div>` : ''}
      ${t.description ? `<div class="t-card-desc">${escHtml(t.description)}</div>` : ''}
      <div class="t-card-footer">
        <span style="font-size:12px"><span class="status-dot ${statusClass}"></span>${statusLabel}</span>
        <span class="player-count">👥 ${playerCount} inscritos</span>
      </div>
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
    .from('players')
    .select('id')
    .eq('tournament_id', joiningTournamentId)
    .eq('user_id', currentUser.id)
    .single();

  if (existing) { showToast('Ya estás inscrito en este torneo'); closeModal('modal-join'); return; }

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
  showScreen('screen-dashboard');
  loadDashboard();
}

function formatTournamentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
    + (iso.includes('T') && !iso.endsWith('T00:00:00') ? ' · ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) : '');
}
