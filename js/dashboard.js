// =============================================
// DASHBOARD
// =============================================
let selectedType = 'commander';

function selectType(type) {
  selectedType = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  // Show format selector only for Standard and Beyblade
  document.getElementById('nt-format-row').style.display = (type !== 'commander') ? '' : 'none';
}

function openNewTournamentModal() {
  selectedType = 'commander';
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === 'commander'));
  document.getElementById('nt-format-row').style.display = 'none';
  document.getElementById('nt-name').value = '';
  document.getElementById('nt-desc').value = '';
  document.querySelector('input[name="nt-format"][value="swiss"]').checked = true;
  openModal('modal-new-tournament');
}

async function createTournament() {
  const name = document.getElementById('nt-name').value.trim();
  if (!name) { showToast('Ponle un nombre al torneo'); return; }

  const format = selectedType === 'commander'
    ? 'pods'
    : document.querySelector('input[name="nt-format"]:checked').value;

  const { data, error } = await _supabase.from('tournaments').insert({
    name,
    type: selectedType,
    format,
    description: document.getElementById('nt-desc').value.trim(),
    owner_id: currentUser.id,
    status: 'active',
    current_round: 0
  }).select().single();

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
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = '<div class="empty-state">Error cargando torneos</div>'; return; }

  if (!data.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏆</div>
      <p>Sin torneos aún.<br>¡Crea el primero!</p>
    </div>`;
    return;
  }

  const icons = { commander: '🧙', standard: '🃏', beyblade: '🌀' };
  const labels = { commander: 'Commander · Pods', standard: 'Standard · Bo3', beyblade: 'Beyblade · Bo3' };
  const formatLabel = { swiss: 'Swiss', elimination: 'Eliminación directa', pods: '' };

  el.innerHTML = data.map(t => `
    <div class="t-card ${t.type}" onclick="openTournament('${t.id}')">
      <div class="t-card-icon">${icons[t.type] || '🏆'}</div>
      <div class="t-card-name">${escHtml(t.name)}</div>
      <div class="t-card-sub">${labels[t.type] || t.type}${t.format && t.format !== 'pods' ? ' · ' + formatLabel[t.format] : ''}</div>
      ${t.description ? `<div class="t-card-sub" style="margin-top:4px;font-style:italic">${escHtml(t.description)}</div>` : ''}
      <div class="t-card-meta">
        <span class="t-card-status ${t.status === 'active' ? 'status-active' : 'status-finished'}">
          ${t.status === 'active' ? '● En curso' : '✓ Finalizado'}
        </span>
        <span style="font-size:11px;color:var(--muted2)">${formatDate(t.created_at)}</span>
      </div>
    </div>
  `).join('');
}

function goToDashboard() {
  stopRealtimeSubscription();
  showScreen('screen-dashboard');
  loadDashboard();
}
