// =============================================
// AUTH
// =============================================
let currentUser = null;

function switchAuthTab(tab) {
  document.getElementById('auth-login').style.display   = tab === 'login'    ? '' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? '' : 'none';
  document.querySelectorAll('#auth-tabs .tab').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('auth-error').textContent = '';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  setAuthError('');
  if (!email || !pass) { setAuthError('Completa todos los campos'); return; }

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: pass });
  if (error) { setAuthError(error.message); return; }
  onAuthSuccess(data.user);
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
  onAuthSuccess(data.user);
}

async function doLogout() {
  await _supabase.auth.signOut();
  currentUser = null;
  showScreen('screen-auth');
}

function setAuthError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

function onAuthSuccess(user) {
  currentUser = user;
  const name = user.user_metadata?.display_name || user.email.split('@')[0];
  document.getElementById('nav-username').textContent = name;
  showScreen('screen-dashboard');
  loadDashboard();
}

// Auto-login on page load
async function initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) {
    onAuthSuccess(session.user);
  } else {
    showScreen('screen-auth');
  }
}
