let activeRole = 'attendee';

// ── Tab switching ──
function switchTab(tab) {
  const isRegister = tab === 'register';

  document.getElementById('form-login').style.display     = isRegister ? 'none' : 'block';
  document.getElementById('form-register').style.display  = isRegister ? 'block' : 'none';
  document.getElementById('role-picker-wrap').style.display = isRegister ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active', !isRegister);
  document.getElementById('tab-register').classList.toggle('active', isRegister);

  document.querySelector('.form-title').textContent    = isRegister ? 'Create account' : 'Welcome back';
  document.querySelector('.form-subtitle').textContent = isRegister
    ? "Join S.E.M.W.A — it's free"
    : 'Sign in to your S.E.M.W.A account';

  clearAlert();
}

// ── Role picker ──
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    activeRole = this.dataset.role;
  });
});

// ── Alert ──
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alert');
  el.textContent = msg;
  el.className = `alert ${type}`;
}

function clearAlert() {
  const el = document.getElementById('alert');
  el.className = 'alert';
  el.textContent = '';
}

// ── API helper ──
async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'An error occurred.');
  return data;
}

// ── Login ──
async function handleLogin() {
  clearAlert();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showAlert('Please fill in all fields.');
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const { user } = await post('/api/auth/login', { email, password });
    showAlert(`Welcome back, ${user.first_name}! Redirecting…`, 'success');
    let dest;
    if (user.role === 'admin') dest = '/admin';
    else if (user.role === 'organizer') dest = '/dashboard';
    else dest = '/acceuil';
    setTimeout(() => { window.location.href = dest; }, 1200);
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// ── Register ──
async function handleRegister() {
  clearAlert();

  const firstName = document.getElementById('reg-first').value.trim();
  const lastName  = document.getElementById('reg-last').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const password  = document.getElementById('reg-password').value;

  if (!firstName || !lastName || !email || !password) {
    showAlert('Please fill in all fields.');
    return;
  }
  if (password.length < 8) {
    showAlert('Password must be at least 8 characters.');
    return;
  }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const { user } = await post('/api/auth/register', {
      firstName, lastName, email, password, role: activeRole,
    });
    showAlert(`Account created! Welcome, ${user.first_name}! Redirecting…`, 'success');
    let dest;
    if (user.role === 'admin') dest = '/admin';
    else if (user.role === 'organizer') dest = '/dashboard';
    else dest = '/acceuil';
    setTimeout(() => { window.location.href = dest; }, 1200);
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// ── Forgot password ──
function forgotPassword() {
  showAlert('Password reset — coming soon.', 'error');
}