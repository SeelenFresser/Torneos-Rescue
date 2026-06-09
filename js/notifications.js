// =============================================
// NOTIFICACIONES PUSH — Web Push API
// Admin dispara · Jugadores reciben
// =============================================

let _notifChannel = null;

// ── PEDIR PERMISO ────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Tu navegador no soporta notificaciones');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    showToast('Notificaciones bloqueadas — actívalas en ajustes del navegador');
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ── ENVIAR NOTIFICACIÓN LOCAL ─────────────────────────────
function sendLocalNotification(title, body, icon = '/img/logo.png') {
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon,
      badge: '/img/logo.png',
      tag: 'rescue-tcg',
      renotify: true
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch(e) {}
}

// ── SUSCRIBIRSE A NOTIFICACIONES DEL TORNEO ──────────────
function subscribeNotifications(tournamentId) {
  if (_notifChannel) { _supabase.removeChannel(_notifChannel); }

  // Escuchar cambios en matches (cuando admin confirma tu resultado)
  _notifChannel = _supabase
    .channel(`notif-${tournamentId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public',
      table: 'matches', filter: `tournament_id=eq.${tournamentId}`
    }, async (payload) => {
      const m = payload.new;
      if (!m.is_complete) return;
      const myPlayer = tournamentPlayers.find(p=>p.user_id===currentUser?.id);
      if (!myPlayer) return;

      const isMyMatch = m.player1_id===myPlayer.id || m.player2_id===myPlayer.id;
      if (!isMyMatch) return;

      const won = m.winner_id === myPlayer.id;
      const oppName = m.player1_id===myPlayer.id ? m.player2_name : m.player1_name;
      const myScore = m.player1_id===myPlayer.id ? m.score_p1 : m.score_p2;
      const oppScore = m.player1_id===myPlayer.id ? m.score_p2 : m.score_p1;

      sendLocalNotification(
        won ? '🏆 ¡Ganaste!' : '❌ Resultado registrado',
        `${won?'Victoria':'Derrota'} vs ${oppName||'?'}: ${myScore}-${oppScore}`,
      );
    })
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public',
      table: 'tournaments', filter: `id=eq.${tournamentId}`
    }, (payload) => {
      const prev = currentTournament?.current_round;
      const next = payload.new?.current_round;
      if (next > prev) {
        sendLocalNotification(
          '📅 Nueva ronda',
          `¡La ronda ${next} ha comenzado! Revisa tu emparejamiento.`
        );
      }
    })
    .subscribe();
}

function stopNotifications() {
  if (_notifChannel) { _supabase.removeChannel(_notifChannel); _notifChannel = null; }
}

// ── NOTIFICACIÓN ADMIN → TODOS ────────────────────────────
// Se hace via Supabase Realtime broadcast (canal global)
async function broadcastPushNotif(title, body) {
  const ch = _supabase.channel('global-notif');
  await ch.send({
    type: 'broadcast',
    event: 'push_notif',
    payload: { title, body }
  });
}

function subscribeGlobalNotifications() {
  _supabase.channel('global-notif')
    .on('broadcast', { event: 'push_notif' }, (payload) => {
      sendLocalNotification(payload.payload.title, payload.payload.body);
      showToast(`📣 ${payload.payload.title}`);
    })
    .subscribe();
}

// ── BOTÓN EN NAVBAR ───────────────────────────────────────
function renderNotifButton() {
  const btn = document.getElementById('btn-notif');
  if (!btn) return;
  const granted = Notification.permission === 'granted';
  btn.innerHTML = granted ? '🔔' : '🔕';
  btn.title = granted ? 'Notificaciones activas' : 'Activar notificaciones';
  btn.style.opacity = granted ? '1' : '0.5';
}

async function toggleNotifications() {
  const granted = await requestNotificationPermission();
  renderNotifButton();
  if (granted) {
    showToast('🔔 Notificaciones activadas');
    subscribeGlobalNotifications();
  }
}
