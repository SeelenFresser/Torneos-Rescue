// =============================================
// TIMER DE RONDA — Supabase Realtime
// Admin controla · Todos ven en tiempo real
// =============================================

let _timerInterval = null;
let _timerChannel  = null;
let _timerState    = { running: false, endsAt: null, totalSeconds: 0, label: '' };

// ── ABRIR TIMER (admin) ───────────────────────────────────
function openTimerModal() {
  AudioFX.tap();
  openModal('modal-timer');
  // Mostrar estado actual
  const s = _timerState;
  document.getElementById('timer-minutes').value = Math.ceil((s.totalSeconds||50*60)/60) || 50;
  document.getElementById('timer-label').value   = s.label || 'Ronda';
  updateTimerPreview();
}

function updateTimerPreview() {
  const mins = parseInt(document.getElementById('timer-minutes')?.value)||50;
  document.getElementById('timer-preview').textContent = formatTimerTime(mins*60);
}

async function startTimerFromModal() {
  const mins  = parseInt(document.getElementById('timer-minutes')?.value)||50;
  const label = document.getElementById('timer-label')?.value?.trim() || 'Ronda';
  const totalSecs = mins * 60;
  const endsAt = new Date(Date.now() + totalSecs * 1000).toISOString();

  await broadcastTimerState({ running: true, endsAt, totalSeconds: totalSecs, label });
  closeModal('modal-timer');
  showToast(`⏱ Timer iniciado: ${mins} minutos`);
}

async function pauseTimer() {
  const remaining = _timerState.endsAt
    ? Math.max(0, Math.round((new Date(_timerState.endsAt)-Date.now())/1000))
    : 0;
  await broadcastTimerState({ running: false, endsAt: null, totalSeconds: remaining, label: _timerState.label });
  AudioFX.tap();
}

async function resetTimer() {
  await broadcastTimerState({ running: false, endsAt: null, totalSeconds: 0, label: '' });
  AudioFX.tap();
  showToast('Timer reiniciado');
}

// ── BROADCAST ────────────────────────────────────────────
async function broadcastTimerState(state) {
  if (!currentTournament?.id) return;
  _timerState = state;
  applyTimerState(state);

  // Guardar en DB para que nuevos usuarios lo vean
  await _supabase.from('tournaments').update({
    timer_state: JSON.stringify(state)
  }).eq('id', currentTournament.id);
}

// ── SUSCRIBIRSE AL TIMER ──────────────────────────────────
function subscribeTimer(tournamentId) {
  if (_timerChannel) { _supabase.removeChannel(_timerChannel); }

  _timerChannel = _supabase
    .channel(`timer-${tournamentId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public',
      table: 'tournaments', filter: `id=eq.${tournamentId}`
    }, (payload) => {
      if (!payload.new?.timer_state) return;
      try {
        const state = JSON.parse(payload.new.timer_state);
        if (JSON.stringify(state) !== JSON.stringify(_timerState)) {
          _timerState = state;
          applyTimerState(state);
        }
      } catch(e) {}
    })
    .subscribe();
}

function stopTimerSubscription() {
  if (_timerChannel) { _supabase.removeChannel(_timerChannel); _timerChannel = null; }
  clearInterval(_timerInterval); _timerInterval = null;
}

// ── RENDERIZAR TIMER ──────────────────────────────────────
function applyTimerState(state) {
  clearInterval(_timerInterval);

  const bar = document.getElementById('round-timer-bar');
  if (!bar) return;

  if (!state.running && !state.totalSeconds) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';

  if (state.running && state.endsAt) {
    // Timer corriendo — actualizar cada segundo
    _timerInterval = setInterval(() => tickTimer(state), 1000);
    tickTimer(state);
  } else {
    // Pausado — mostrar tiempo restante fijo
    renderTimerBar(state.totalSeconds, state.totalSeconds, state.label, false);
  }
}

function tickTimer(state) {
  const remaining = Math.max(0, Math.round((new Date(state.endsAt)-Date.now())/1000));
  renderTimerBar(remaining, state.totalSeconds, state.label, true);

  if (remaining <= 0) {
    clearInterval(_timerInterval);
    AudioFX.danger();
    showToast('⏰ ¡Tiempo de ronda terminado!');
    _timerState = { ..._timerState, running: false };
  } else if (remaining === 60) {
    showToast('⏱ 1 minuto restante');
  }
}

function renderTimerBar(remaining, total, label, running) {
  const bar = document.getElementById('round-timer-bar');
  if (!bar) return;

  const pct = total > 0 ? Math.max(0, remaining/total) : 0;
  const danger = remaining < 60;
  const warn   = remaining < 300;
  const color  = danger ? 'var(--red)' : warn ? 'var(--bey)' : 'var(--std)';
  const owner  = isOwner();

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;width:100%">
      <div style="font-size:12px;font-weight:700;color:${color};min-width:44px;text-align:right">
        ${formatTimerTime(remaining)}
      </div>
      <div style="flex:1;height:6px;background:var(--dark3);border-radius:3px;overflow:hidden">
        <div style="width:${pct*100}%;height:100%;background:${color};
          transition:width 1s linear;border-radius:3px"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);min-width:50px">${escHtml(label||'Ronda')}</div>
      ${owner ? `
        <div style="display:flex;gap:4px">
          ${running
            ? `<button class="btn btn-xs btn-ghost" onclick="pauseTimer()" title="Pausar">⏸</button>`
            : `<button class="btn btn-xs btn-ghost" onclick="openTimerModal()" title="Iniciar">▶</button>`}
          <button class="btn btn-xs btn-ghost" onclick="resetTimer()" title="Reiniciar">↺</button>
        </div>` : ''}
    </div>`;
}

function formatTimerTime(secs) {
  const m = Math.floor(secs/60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Cargar estado inicial del timer al entrar a un torneo
async function loadTimerState(tournamentId) {
  const { data } = await _supabase
    .from('tournaments').select('timer_state').eq('id', tournamentId).single();
  if (data?.timer_state) {
    try {
      _timerState = JSON.parse(data.timer_state);
      applyTimerState(_timerState);
    } catch(e) {}
  }
  subscribeTimer(tournamentId);
}
