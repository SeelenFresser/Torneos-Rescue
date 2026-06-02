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
  if (isAdmin) {
    roleEl.style.display = '';
    document.getElementById('btn-new-tournament').style.display = '';
  } else {
    roleEl.style.display = 'none';
    document.getElementById('btn-new-tournament').style.display = 'none';
  }

  showScreen('screen-dashboard');
  loadDashboard();
}

async function initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) {
    await onAuthSuccess(session.user);
  } else {
    showScreen('screen-auth');
  }
}
