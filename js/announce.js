// =============================================
// ANUNCIOS — Envío de correos a usuarios
// =============================================

// URL de la Edge Function (se actualiza con tu project ID)
const ANNOUNCE_FN_URL = 'https://yumtuojuktcuqeajslrn.supabase.co/functions/v1/send-announcement';

async function openAnnounceModal() {
  AudioFX.tap();
  document.getElementById('ann-subject').value  = '';
  document.getElementById('ann-message').value  = '';
  document.getElementById('ann-status').textContent = '';
  document.getElementById('ann-status').style.color = '';
  document.getElementById('ann-preview').style.display = 'none';

  // Cargar torneos activos/próximos en el select
  const sel = document.getElementById('ann-tournament');
  sel.innerHTML = '<option value="">— Sin torneo específico —</option>';

  const { data } = await _supabase
    .from('tournaments')
    .select('id,name,type,tournament_date,status,description')
    .in('status', ['upcoming','active'])
    .order('tournament_date', { ascending: true });

  const icons = { commander:'🧙', standard:'🃏', beyblade:'🌀' };
  (data || []).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    const date = t.tournament_date
      ? new Date(t.tournament_date).toLocaleDateString('es-MX', { day:'2-digit', month:'short' })
      : '';
    opt.textContent = `${icons[t.type]||'🏆'} ${t.name}${date ? ' · ' + date : ''}`;
    opt._data = t;
    sel.appendChild(opt);
  });

  sel.onchange = () => {
    const selected = [...sel.options].find(o => o.value === sel.value);
    const preview = document.getElementById('ann-preview');
    if (selected && selected._data) {
      const t = selected._data;
      const typeLabel = {commander:'Commander',standard:'Standard Bo3',beyblade:'Beyblade Bo3'}[t.type]||t.type;
      const dateStr = t.tournament_date
        ? new Date(t.tournament_date).toLocaleString('es-MX',{weekday:'long',day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit',hour12:false})
        : '';
      preview.style.display = '';
      preview.innerHTML = `
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">${escHtml(t.name)}</div>
        <div style="color:var(--muted)">${typeLabel}${dateStr ? ' · ' + dateStr : ''}</div>
        ${t.description ? `<div style="color:var(--muted);font-style:italic;margin-top:2px">${escHtml(t.description)}</div>` : ''}
      `;
    } else {
      preview.style.display = 'none';
    }
  };

  openModal('modal-announce');
}

async function sendAnnouncement() {
  const subject     = document.getElementById('ann-subject').value.trim();
  const message     = document.getElementById('ann-message').value.trim();
  const tournamentId = document.getElementById('ann-tournament').value || null;
  const statusEl    = document.getElementById('ann-status');
  const btn         = document.getElementById('btn-send-announce');

  if (!subject) { showToast('Escribe un asunto'); return; }
  if (!message) { showToast('Escribe un mensaje'); return; }

  // Confirmar
  const count = await getUserCount();
  if (!confirm(`¿Enviar correo a ${count} usuario(s) registrado(s)?`)) return;

  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';
  statusEl.textContent = 'Enviando correos...';
  statusEl.style.color = 'var(--muted)';

  try {
    // Obtener token del usuario actual
    const { data: { session } } = await _supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { showToast('Sesión expirada — recarga la página'); return; }

    const res = await fetch(ANNOUNCE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ subject, message, tournament_id: tournamentId })
    });

    const result = await res.json();

    if (res.ok) {
      AudioFX.victory();
      statusEl.textContent = `✅ Enviado a ${result.sent} de ${result.total} usuarios`;
      statusEl.style.color = 'var(--green)';
      showToast(`📧 Correos enviados: ${result.sent}`);
      setTimeout(() => closeModal('modal-announce'), 2000);
    } else {
      throw new Error(result.error || 'Error desconocido');
    }
  } catch (err) {
    statusEl.textContent = '❌ Error: ' + err.message;
    statusEl.style.color = 'var(--red)';
    showToast('Error enviando correos');
  } finally {
    btn.disabled = false;
    btn.textContent = '📧 Enviar correo';
  }
}

async function getUserCount() {
  const { count } = await _supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('email', 'is', null);
  return count || 0;
}
