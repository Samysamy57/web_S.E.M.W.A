// Logique complète du panneau d'administration S.E.M.W.A

/* ══════════════════════════════
   ÉTAT GLOBAL
══════════════════════════════ */
let currentUser     = null;
let refreshInterval = null;

/* ══════════════════════════════
   INITIALISATION
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  document.getElementById('filter-role').addEventListener('change', loadUsers);
  document.getElementById('filter-sort').addEventListener('change', loadUsers);
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadUsers, 300);
  });
});

async function checkSession() {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'include' });
    if (res.ok) {
      hideAuthOverlay();
      await initDashboard();
      startAutoRefresh(); // lance le rafraîchissement automatique
    } else {
      showAuthOverlay();
    }
  } catch {
    showAuthOverlay();
  }
}

/* ══════════════════════════════
   AUTO-REFRESH (toutes les 30s)
══════════════════════════════ */
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);

  refreshInterval = setInterval(async () => {
    await loadUsers();
    await loadRequests();
    await loadEvents();
  }, 30_000);
}

/* ══════════════════════════════
   AUTH OVERLAY
══════════════════════════════ */
function showAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'flex';

  // Vide toutes les données sensibles visibles derrière l'overlay
  document.getElementById('kpi-users').textContent    = '—';
  document.getElementById('kpi-requests').textContent = '—';
  document.getElementById('kpi-banned').textContent   = '—';
  document.getElementById('welcome-msg').textContent  = 'Bonjour 👋';
  document.getElementById('sidebar-avatar').textContent = '?';
  document.getElementById('sidebar-name').textContent   = '—';

  document.getElementById('dashboard-users-tbody').innerHTML =
    `<tr><td colspan="4" class="empty-state">—</td></tr>`;
  document.getElementById('users-tbody').innerHTML =
    `<tr><td colspan="5" class="empty-state">—</td></tr>`;
  document.getElementById('requests-tbody').innerHTML =
    `<tr><td colspan="4" class="empty-state">—</td></tr>`;

  // Cache le badge de demandes
  document.getElementById('requests-count').style.display = 'none';
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.add('section-hidden');
  document.getElementById('tab-register').classList.add('section-hidden');
  document.getElementById(`tab-${tab}`).classList.remove('section-hidden');

  const tabs = document.querySelectorAll('.auth-tab');
  tabs[0].classList.toggle('active', tab === 'login');
  tabs[1].classList.toggle('active', tab === 'register');
}

/* ── Login Admin ── */
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'Tous les champs sont requis.';
    return;
  }

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, adminOnly: true }),
    });

    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Erreur de connexion.';
      return;
    }

    currentUser = data.user;
    hideAuthOverlay();
    await initDashboard();
    startAutoRefresh();
  } catch {
    errEl.textContent = 'Erreur réseau.';
  }
}

/* ── Demande de compte Admin ── */
async function doRegisterAdmin() {
  const firstName = document.getElementById('reg-firstname').value.trim();
  const lastName  = document.getElementById('reg-lastname').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const password  = document.getElementById('reg-password').value;
  const errEl     = document.getElementById('reg-error');
  const infoEl    = document.getElementById('reg-info');
  errEl.textContent  = '';
  infoEl.textContent = '';

  if (!firstName || !lastName || !email || !password) {
    errEl.textContent = 'Tous les champs sont requis.';
    return;
  }

  try {
    const res  = await fetch('/api/auth/register-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Erreur lors de la demande.';
      return;
    }

    infoEl.textContent = '✓ Demande envoyée. Un admin la traitera prochainement.';
  } catch {
    errEl.textContent = 'Erreur réseau.';
  }
}

/* ── Déconnexion ── */
async function doLogout() {
  clearInterval(refreshInterval); // stoppe les requêtes en arrière-plan
  refreshInterval = null;

  await fetch('/api/auth/logout', { credentials: 'include' });
  currentUser = null;
  showAuthOverlay();
  toast('Déconnecté.');
}

/* ══════════════════════════════
   INITIALISATION DU DASHBOARD
══════════════════════════════ */
async function initDashboard() {
  await Promise.all([loadUsers(), loadRequests(), loadEvents()]);
  updateSidebarUser();
  showSection('dashboard');
}

function updateSidebarUser() {
  if (!currentUser) return;
  const initials = `${currentUser.first_name?.[0] ?? ''}${currentUser.last_name?.[0] ?? ''}`.toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent   = `${currentUser.first_name} ${currentUser.last_name}`;
  document.getElementById('welcome-msg').textContent    = `Bonjour, ${currentUser.first_name} 👋`;
}

/* ══════════════════════════════
   NAVIGATION
══════════════════════════════ */
function showSection(name) {
  ['dashboard', 'users', 'events', 'requests', 'messages'].forEach(s => {
    document.getElementById(`section-${s}`).classList.add('section-hidden');
    document.getElementById(`nav-${s}`).classList.remove('active');
  });
  document.getElementById(`section-${name}`).classList.remove('section-hidden');
  document.getElementById(`nav-${name}`).classList.add('active');
}

/* ══════════════════════════════
   CHARGEMENT UTILISATEURS
══════════════════════════════ */
let searchDebounce = null;

function resetFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-role').value   = '';
  document.getElementById('filter-sort').value   = 'date_desc';
  loadUsers();
}

async function loadUsers() {
  // Lecture des filtres
  const search = document.getElementById('filter-search')?.value.trim() ?? '';
  const role   = document.getElementById('filter-role')?.value ?? '';
  const sort   = document.getElementById('filter-sort')?.value ?? 'date_desc';

  // Construction de l'URL avec les paramètres
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (role)   params.set('role', role);
  if (sort)   params.set('sort', sort);

  try {
    const res  = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });

    // Session expirée → déconnexion immédiate pour stopper l'auto-refresh
    if (res.status === 401 || res.status === 403) { doLogout(); return; }

    const data = await res.json();
    if (!res.ok) { toast('Erreur chargement utilisateurs.'); return; }

    const users = data.users;

    document.getElementById('kpi-users').textContent  = users.length;
    document.getElementById('kpi-banned').textContent = users.filter(u => !u.is_active).length;

    renderUsersTable(users, 'users-tbody', true);
    renderUsersTable(users.slice(0, 5), 'dashboard-users-tbody', false);
  } catch {
    toast('Erreur réseau.');
  }
}

function renderUsersTable(users, tbodyId, withActions) {
  const tbody = document.getElementById(tbodyId);

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="${withActions ? 5 : 4}" class="empty-state">Aucun utilisateur.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const roleCell = withActions
      ? `<select class="status-badge badge-${u.role}" style="cursor:pointer;border:none;outline:none;" onchange="changeRole('${u.id}', this.value, this)">
           <option value="attendee"  ${u.role === 'attendee'  ? 'selected' : ''}>attendee</option>
           <option value="organizer" ${u.role === 'organizer' ? 'selected' : ''}>organizer</option>
           <option value="admin"     ${u.role === 'admin'     ? 'selected' : ''}>admin</option>
         </select>`
      : `<span class="status-badge badge-${u.role}">${u.role}</span>`;

    const statusBadge = u.is_active
      ? `<span class="status-badge badge-active">Actif</span>`
      : `<span class="status-badge badge-inactive">Banni</span>`;

    const actionBtn = withActions
      ? u.is_active
        ? `<button class="btn btn-ban"   onclick="toggleStatus('${u.id}', false)">Bannir</button>`
        : `<button class="btn btn-unban" onclick="toggleStatus('${u.id}', true)">Réactiver</button>`
      : '';

    return `<tr>
      <td>${u.first_name} ${u.last_name}</td>
      <td style="color:var(--slate3)">${u.email}</td>
      <td>${roleCell}</td>
      <td>${statusBadge}</td>
      ${withActions ? `<td>${actionBtn}</td>` : ''}
    </tr>`;
  }).join('');
}

/* ── Ban / Unban ── */
async function toggleStatus(userId, isActive) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive }),
    });

    if (!res.ok) { toast('Erreur lors de la mise à jour.'); return; }

    toast(isActive ? 'Compte réactivé.' : 'Compte banni.');
    await loadUsers();
  } catch {
    toast('Erreur réseau.');
  }
}

/* ── Changement de rôle ── */
async function changeRole(userId, newRole, selectElement) {
  // Mise à jour visuelle immédiate
  ['badge-admin', 'badge-organizer', 'badge-attendee'].forEach(c => selectElement.classList.remove(c));
  selectElement.classList.add(`badge-${newRole}`);

  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) { toast('Erreur lors du changement de rôle.'); await loadUsers(); return; }

    toast(`Rôle mis à jour : ${newRole}.`);
  } catch {
    toast('Erreur réseau.');
    await loadUsers(); // remet l'état réel si erreur
  }
}

/* ══════════════════════════════
   CHARGEMENT ÉVÉNEMENTS
══════════════════════════════ */
async function loadEvents() {
  try {
    const res = await fetch('/api/admin/events', { credentials: 'include' });
    if (res.status === 401 || res.status === 403) { doLogout(); return; }

    const data = await res.json();
    if (!res.ok) { toast('Erreur chargement événements.'); return; }

    const events = data.events;

    // Badge sidebar : nombre d'événements en attente
    const pendingCount = events.filter(e => e.status === 'pending').length;
    const badge = document.getElementById('events-count');
    if (pendingCount > 0) {
      badge.style.display = 'inline';
      badge.textContent   = pendingCount;
    } else {
      badge.style.display = 'none';
    }

    renderEventsTable(events);
  } catch {
    toast('Erreur réseau.');
  }
}

function renderEventsTable(events) {
  const tbody = document.getElementById('events-tbody');

  if (!events.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Aucun événement.</td></tr>`;
    return;
  }

  // Mapping statut → classe CSS badge
  const badgeClass = {
    pending:  'badge-pending',
    approved: 'badge-active',
    rejected: 'badge-inactive',
  };
  const badgeLabel = {
    pending:  'En attente',
    approved: 'Approuvé',
    rejected: 'Refusé',
  };

  tbody.innerHTML = events.map(e => {
    const date        = e.start_date ? new Date(e.start_date).toLocaleDateString('fr-FR') : '—';
    const organizer   = e.first_name ? `${e.first_name} ${e.last_name}` : '—';
    const badge       = `<span class="status-badge ${badgeClass[e.status] ?? 'badge-pending'}">${badgeLabel[e.status] ?? e.status}</span>`;

    // Boutons : on cache celui qui correspond au statut actuel
    const btnApprove  = e.status !== 'approved'
      ? `<button class="btn btn-approve" onclick="changeEventStatus('${e.id}', 'approved')">✓ Approuver</button>`
      : '';
    const btnReject   = e.status !== 'rejected'
      ? `<button class="btn btn-reject"  onclick="changeEventStatus('${e.id}', 'rejected')">✗ Refuser</button>`
      : '';

    return `<tr>
      <td style="font-weight:600">${e.title}</td>
      <td style="color:var(--slate3)">${organizer}</td>
      <td style="color:var(--slate4)">${date}</td>
      <td>${badge}</td>
      <td><div style="display:flex;gap:8px">${btnApprove}${btnReject}</div></td>
    </tr>`;
  }).join('');
}

async function changeEventStatus(eventId, newStatus) {
  try {
    const res = await fetch(`/api/admin/events/${eventId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) { toast('Erreur lors de la modération.'); return; }

    toast(newStatus === 'approved' ? 'Événement approuvé.' : 'Événement refusé.');
    await loadEvents();
  } catch {
    toast('Erreur réseau.');
  }
}

/* ══════════════════════════════
   CHARGEMENT DEMANDES ADMIN
══════════════════════════════ */
async function loadRequests() {
  try {
    const res  = await fetch('/api/admin/requests', { credentials: 'include' });

    // Session expirée → déconnexion immédiate
    if (res.status === 401 || res.status === 403) { doLogout(); return; }

    const data = await res.json();
    if (!res.ok) { toast('Erreur chargement demandes.'); return; }

    const requests = data.requests;

    document.getElementById('kpi-requests').textContent = requests.length;
    const badge = document.getElementById('requests-count');
    if (requests.length > 0) {
      badge.style.display = 'inline';
      badge.textContent   = requests.length;
    } else {
      badge.style.display = 'none';
    }

    renderRequestsTable(requests);
  } catch {
    toast('Erreur réseau.');
  }
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById('requests-tbody');

  if (!requests.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Aucune demande en attente.</td></tr>`;
    return;
  }

  tbody.innerHTML = requests.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('fr-FR');
    return `<tr>
      <td>${r.first_name} ${r.last_name}</td>
      <td style="color:var(--slate3)">${r.email}</td>
      <td style="color:var(--slate4)">${date}</td>
      <td style="display:flex;gap:8px">
        <button class="btn btn-approve" onclick="handleRequest('${r.id}', 'approve')">✓ Approuver</button>
        <button class="btn btn-reject"  onclick="handleRequest('${r.id}', 'reject')">✗ Refuser</button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Approuver / Refuser ── */
async function handleRequest(requestId, action) {
  try {
    const res = await fetch(`/api/admin/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action }),
    });

    if (!res.ok) { toast('Erreur lors du traitement.'); return; }

    toast(action === 'approve' ? 'Demande approuvée. Le compte est maintenant admin.' : 'Demande refusée.');
    await loadRequests();
    await loadUsers();
  } catch {
    toast('Erreur réseau.');
  }
}

/* ══════════════════════════════
   TOAST
══════════════════════════════ */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}