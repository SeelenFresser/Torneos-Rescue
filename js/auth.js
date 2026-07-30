// =============================================
// AUTH — con soporte de roles admin/user
// =============================================
let currentUser = null;
let isAdmin = false;

function switchAuthTab(tab) {
  document.getElementById('auth-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? '' : 'none';
  document.querySelectorAll('#auth-tabs .tab').forEach((b, i) => {
    b.classList.toggle('active', (i === 0) === (tab === 'login'));
  });
  document.getElementById('auth-error').textContent = '';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  setAuthError('');
  if (!email || !pass) { setAuthError('Completa todos los campos'); return; }
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: pass });
  if (error) { setAuthError('Correo o contraseña incorrectos'); return; }
  await onAuthSuccess(data.user);
}

async function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  setAuthError('');
  if (!name || !email || !pass) { setAuthError('Completa todos los campos'); return; }
  if (pass.length < 6) { setAuthError('Mínimo 6 caracteres'); return; }
  const { data, error } = await _supabase.auth.signUp({
    email, password: pass,
    options: { data: { display_name: name } }
  });
  if (error) { setAuthError(error.message); return; }
  // Enviar email de bienvenida (silencioso)
  fetch('/api/send-welcome', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email, username: name, admin_secret: 'rescuetcg_admin_2026' })
  }).catch(() => {});
  await onAuthSuccess(data.user);
}

async function doLogout() {
  await _supabase.auth.signOut();
  currentUser = null; isAdmin = false;
  showScreen('screen-auth');
}

function setAuthError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

async function checkAdminRole(userId) {
  const { data } = await _supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  // Si no tiene perfil aun, crearlo como user
  if (!data) {
    await _supabase.from('profiles').insert({ id: userId, role: 'user' });
    return false;
  }
  return data.role === 'admin';
}

async function onAuthSuccess(user) {
  currentUser = user;
  isAdmin = await checkAdminRole(user.id);

  const name = user.user_metadata?.display_name || user.email.split('@')[0];
  document.getElementById('nav-username').textContent = name;

  const roleEl = document.getElementById('nav-role');
  const btnTournament = document.getElementById('btn-new-tournament');
  const btnAnnounce   = document.getElementById('btn-announce');
  const btnTimer = document.getElementById('btn-timer');
  if (isAdmin) {
    roleEl.style.display = '';
    if (btnTournament) btnTournament.style.display = '';
    if (btnAnnounce)   btnAnnounce.style.display   = '';
    if (btnTimer)      btnTimer.style.display       = '';
  } else {
    roleEl.style.display = 'none';
    if (btnTournament) btnTournament.style.display = 'none';
    if (btnAnnounce)   btnAnnounce.style.display   = 'none';
    if (btnTimer)      btnTimer.style.display       = 'none';
  }

  // Init notifications UI and global channel
  setTimeout(() => {
    renderNotifButton();
    if (Notification.permission === 'granted') subscribeGlobalNotifications();
  }, 500);

  showScreen('screen-dashboard');
  loadDashboard();

  // Deep link: si la URL trae ?torneo=ID o ?t2v2=ID, abrir ese torneo directamente
  handleTournamentDeepLink();
}

function handleTournamentDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get('torneo');
  const t2v2Id = params.get('t2v2');

  if (tournamentId) {
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      if (typeof openTournament === 'function') openTournament(tournamentId);
    }, 300);
  } else if (t2v2Id) {
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      if (typeof open2v2Detail === 'function') open2v2Detail(t2v2Id);
    }, 300);
  }
}

async function initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) {
    await onAuthSuccess(session.user);
  } else {
    showScreen('screen-auth');
  }
}

// ── RECUPERACIÓN DE CONTRASEÑA ────────────────────────────
function showForgotPassword() {
  document.getElementById('auth-login').innerHTML = `
    <h3 style="color:var(--text);font-size:16px;font-weight:700;margin-bottom:12px">Recuperar contraseña</h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:12px">
      Ingresa tu correo y te enviaremos un enlace.
    </p>
    <input class="input" id="reset-email" type="email" placeholder="Correo electrónico"
      onkeydown="if(event.key==='Enter')requestPasswordReset()">
    <button class="btn btn-primary w-full" onclick="requestPasswordReset()">📧 Enviar enlace</button>
    <p id="reset-status" style="text-align:center;font-size:13px;min-height:20px;margin-top:8px;color:var(--green)"></p>
    <p style="text-align:center;margin-top:8px;font-size:13px">
      <a style="color:var(--muted);cursor:pointer" onclick="location.reload()">← Volver al login</a>
    </p>
  `;
}

async function requestPasswordReset() {
  const email = document.getElementById('reset-email')?.value?.trim();
  const statusEl = document.getElementById('reset-status');
  if (!email) { showToast('Ingresa tu correo'); return; }
  statusEl.textContent = 'Enviando...';
  statusEl.style.color = 'var(--muted)';
  try {
    const res = await fetch('/api/reset-password-request', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email })
    });
    // Antes esto no revisaba res.ok — un 500 del servidor (Gmail caído,
    // perfil sin fila, etc.) se mostraba igual como "✓ enviado".
    if (!res.ok) {
      let msg = 'Error del servidor';
      try { const data = await res.json(); msg = data.error || msg; } catch(_) {}
      console.error('reset-password-request falló:', res.status, msg);
      statusEl.textContent = `Error: ${msg}. Intenta de nuevo o contacta al admin.`;
      statusEl.style.color = 'var(--red)';
      return;
    }
    statusEl.textContent = '✓ Si el correo existe, recibirás un enlace en breve.';
    statusEl.style.color = 'var(--green)';
  } catch(e) {
    statusEl.textContent = 'Error de conexión. Intenta de nuevo.';
    statusEl.style.color = 'var(--red)';
  }
}

async function handleResetToken(token) {
  showScreen('screen-auth');
  document.getElementById('auth-login').innerHTML = `
    <h3 style="color:var(--text);font-size:16px;font-weight:700;margin-bottom:12px">Nueva contraseña</h3>
    <input class="input" id="new-pass" type="password" placeholder="Nueva contraseña (mín. 6 caracteres)">
    <input class="input" id="new-pass-confirm" type="password" placeholder="Confirmar contraseña">
    <button class="btn btn-primary w-full" onclick="confirmPasswordReset('${token}')">🔐 Cambiar contraseña</button>
    <p id="new-pass-status" style="text-align:center;font-size:13px;min-height:20px;margin-top:8px"></p>
  `;
}

async function confirmPasswordReset(token) {
  const newPass  = document.getElementById('new-pass')?.value;
  const confirm  = document.getElementById('new-pass-confirm')?.value;
  const statusEl = document.getElementById('new-pass-status');
  if (!newPass || newPass.length < 6) { showToast('Mínimo 6 caracteres'); return; }
  if (newPass !== confirm) { showToast('Las contraseñas no coinciden'); return; }
  statusEl.textContent = 'Actualizando...';
  statusEl.style.color = 'var(--muted)';
  try {
    const res = await fetch('/api/reset-password-confirm', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ token, new_password: newPass })
    });
    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = '✓ Contraseña actualizada. Ya puedes iniciar sesión.';
      statusEl.style.color = 'var(--green)';
      setTimeout(() => location.reload(), 2000);
    } else {
      statusEl.textContent = data.error || 'Error';
      statusEl.style.color = 'var(--red)';
    }
  } catch(e) {
    statusEl.textContent = 'Error de conexión';
    statusEl.style.color = 'var(--red)';
  }
}

// Check reset token on load
(function() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset_token');
  if (token) {
    window.history.replaceState({}, document.title, '/');
    window.addEventListener('load', () => handleResetToken(token));
  }
})();
