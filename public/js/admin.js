// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\public\js\admin.js

/* ══════════════════════════════
ÉTAT GLOBAL
══════════════════════════════ */
let currentUser     = null;
let refreshInterval = null;
const socket        = io();
// Écoute les messages entrants en temps réel
socket.on('private message', (data) => {
  const body = document.getElementById('admin-msg-body');
  if (!body || body.style.display === 'none') return;

  const msg  = data.message ?? data;
  const time = adminFormatTime(new Date().toISOString());

  // isOwnFixed déclaré EN PREMIER — vérifie sent_by (vrai auteur admin) en priorité
  const isOwnFixed    = msg.sent_by === currentUser?.id || msg.sender_id === currentUser?.id;
  const displayName   = isOwnFixed
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : (msg.sender_display_name || `${msg.first_name ?? ''} ${msg.last_name ?? ''}`.trim() || '?');
  const senderIsAdmin = msg.role === 'admin' || (isOwnFixed && currentUser?.role === 'admin');

  const color    = isOwnFixed ? 'var(--blue)' : adminAvatarColor(msg.sender_id);
  const initials = isOwnFixed ? (currentUser.first_name?.[0] ?? 'M').toUpperCase() : (msg.first_name?.[0] ?? '?').toUpperCase();

  const wrapClass   = isOwnFixed ? 'bubble-wrap own' : 'bubble-wrap';
  const bubbleClass = isOwnFixed ? 'bubble own'       : 'bubble other';
  // Pour les messages support, on affiche le vrai auteur (currentUser) pas "Support S.E.M.W.A"
  const adminLabelName = msg.sent_by
    ? (msg.sent_by === currentUser?.id
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : `${msg.sent_by_first_name ?? ''} ${msg.sent_by_last_name ?? ''}`.trim() || displayName)
    : displayName;
  const adminLabel  = senderIsAdmin
    ? `<div style="font-size:.65rem;color:var(--amber);font-weight:600;margin-bottom:2px;${isOwnFixed ? 'text-align:right' : ''}">🛡️ Admin · ${adminLabelName}</div>`
    : '';

  const div = document.createElement('div');
  div.className = wrapClass;
  div.innerHTML = `
    <div class="bubble-avatar" style="background:${color}">${initials}</div>
    <div>
      ${adminLabel}
      <div class="${bubbleClass}">${msg.content}</div>
      <div class="bubble-time ${isOwnFixed ? '' : 'other'}">${time}</div>
    </div>
  `;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
});

/* ══════════════════════════════
   INITIALISATION
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
checkSession();
initAdminSendBar(); // câble la barre d'envoi statique une seule fois
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
      // Récupère le profil de l'admin connecté pour valoriser currentUser
      const meRes  = await fetch('/api/auth/me', { credentials: 'include' });
      const meData = await meRes.json();
      currentUser  = meData.user ?? meData;

      // Enregistre l'admin dans son salon Socket.io privé
      socket.emit('register user', currentUser.id);

      hideAuthOverlay();
      await initDashboard();
      startAutoRefresh();
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
    // Enregistre l'admin dans son salon Socket.io privé
    socket.emit('register user', currentUser.id);
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

  if (name === 'messages') loadAdminConversations();
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

    const name = `${u.first_name} ${u.last_name}`.replace(/'/g, "\\'");
    const actionBtn = withActions
      ? `<div style="display:flex;gap:8px;align-items:center;justify-content:flex-start;">
           ${u.is_active
             ? `<button class="btn btn-ban"   onclick="toggleStatus('${u.id}', false)">Bannir</button>`
             : `<button class="btn btn-unban" onclick="toggleStatus('${u.id}', true)">Réactiver</button>`
           }
           <button class="btn" style="background:var(--blue-l);color:var(--blue);font-weight:700;padding:6px 12px;"
             onclick="openDirectMessage('${u.id}', '${name}')">✉️ Support</button>
         </div>`
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

/* ══════════════════════════════
   BURGER MENU
══════════════════════════════ */
function toggleSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.toggle('open');
  backdrop.classList.toggle('open');
}

// Ferme la sidebar si on clique sur le backdrop
document.addEventListener('DOMContentLoaded', () => {
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.id = 'sidebar-backdrop';
  backdrop.addEventListener('click', toggleSidebar);
  document.body.appendChild(backdrop);
});

/* ══════════════════════════════
   MESSAGERIE ADMIN (lecture seule)
══════════════════════════════ */
let allAdminConvos = [];

// Couleurs d'avatar déterministes
const ADMIN_COLORS = ['#7C3AED','#0D9488','#D97706','#1B4FD8','#DC2626','#059669'];
function adminAvatarColor(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return ADMIN_COLORS[h % ADMIN_COLORS.length];
}

function adminFormatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

async function loadAdminConversations() {
  const list = document.getElementById('admin-conversation-list');
  list.innerHTML = '<p style="padding:16px;font-size:.8rem;color:var(--slate3)">Chargement…</p>';

  try {
    const res  = await fetch('/api/admin/messages/conversations', { credentials: 'include' });
    const data = await res.json();
    allAdminConvos = data.conversations ?? [];
    renderAdminConvos(allAdminConvos);
  } catch {
    list.innerHTML = '<p style="padding:16px;font-size:.8rem;color:#DC2626">Erreur de chargement.</p>';
  }
}

function renderAdminConvos(convos) {
  const list = document.getElementById('admin-conversation-list');

  if (!convos.length) {
    list.innerHTML = '<p style="padding:16px;font-size:.8rem;color:var(--slate3)">Aucune conversation.</p>';
    return;
  }

  list.innerHTML = convos.map(c => {
    const name1   = `${c.user1_first_name} ${c.user1_last_name}`.trim() || c.user1_email;
    const name2   = `${c.user2_first_name} ${c.user2_last_name}`.trim() || c.user2_email;
    const label   = `${name1} — ${name2}`;
    const init1   = (c.user1_first_name?.[0] ?? '?').toUpperCase();
    const init2   = (c.user2_first_name?.[0] ?? '?').toUpperCase();
    const color1  = adminAvatarColor(c.user1_id);
    const color2  = adminAvatarColor(c.user2_id);
    const preview = c.last_message ?? '';
    const time    = adminFormatTime(c.last_message_at);

    return `
      <div class="msg-thread"
           data-id="${c.conversation_id}"
           data-title="${c.title ?? ''}"
           data-user1-id="${c.user1_id}"
           data-user1-name="${name1}"
           data-user2-id="${c.user2_id}"
           data-user2-name="${name2}"
           data-color1="${color1}"
           data-color2="${color2}"
           data-init1="${init1}"
           data-init2="${init2}"
           onclick="selectAdminConvo(this)">

 
        <!-- Double avatar pour montrer les 2 interlocuteurs -->
        <div style="position:relative;width:40px;height:40px;flex-shrink:0">
          <div style="position:absolute;top:0;left:0;width:28px;height:28px;border-radius:8px;background:${color1};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700">${init1}</div>
          <div style="position:absolute;bottom:0;right:0;width:24px;height:24px;border-radius:6px;background:${color2};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;border:2px solid #fff">${init2}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
            <div class="thread-name" style="font-size:.78rem">${label}</div>
            <div class="thread-time">${time}</div>
          </div>
          <div class="thread-preview">${preview}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterAdminConvos(query) {
  const q = query.toLowerCase();
  const filtered = allAdminConvos.filter(c => {
    const name1 = `${c.user1_first_name} ${c.user1_last_name} ${c.user1_email}`.toLowerCase();
    const name2 = `${c.user2_first_name} ${c.user2_last_name} ${c.user2_email}`.toLowerCase();
    return name1.includes(q) || name2.includes(q);
  });
  renderAdminConvos(filtered);
}

async function selectAdminConvo(el) {
document.querySelectorAll('#admin-conversation-list .msg-thread')
.forEach(t => t.classList.remove('active'));
el.classList.add('active');
const convoId   = el.dataset.id;
const convoTitle = el.dataset.title;          // 'SUPPORT' ou vide
const user1Id   = el.dataset.user1Id;
const user1Name = el.dataset.user1Name;
const user2Id   = el.dataset.user2Id;
const user2Name = el.dataset.user2Name;
const color1    = el.dataset.color1;
const color2    = el.dataset.color2;
const init1     = el.dataset.init1;
const init2     = el.dataset.init2;

// MODE SUPPORT : conversation créée par l'admin vers un user (title = 'SUPPORT')
// MODE MODÉRATION : conversation privée entre deux users → lecture seule
const isSupportConvo = convoTitle === 'SUPPORT';

document.getElementById('admin-chat-title').textContent = `${user1Name} — ${user2Name}`;
document.getElementById('admin-chat-sub').textContent   = isSupportConvo
  ? 'Ticket de support'
  : 'Conversation privée · modération';
document.getElementById('admin-msg-header').style.display = 'flex';
document.getElementById('admin-no-convo').style.display   = 'none';
document.getElementById('admin-msg-body').style.display   = 'flex';

// Badge lecture seule : affiché sauf si c'est un ticket support
document.getElementById('admin-readonly-badge').style.display = isSupportConvo ? 'none' : '';
document.getElementById('admin-msg-input-row').style.display  = isSupportConvo ? 'flex' : 'none';

socket.emit('join conversation', convoId);

// Stocke le contexte d'envoi uniquement pour les tickets support
if (isSupportConvo) {
  activeSupportConvoId  = convoId;
  activeSupportReceiver = (currentUser?.id === user1Id) ? user2Id : user1Id;
}
const body = document.getElementById('admin-msg-body');
body.innerHTML = '<p style="color:var(--slate4);font-size:.8rem">Chargement…</p>';
try {
const res      = await fetch(`/api/admin/messages/conversation/${convoId}`, { credentials: 'include' });
const data     = await res.json();
const messages = data.messages ?? [];
if (!messages.length) {
  body.innerHTML = '<p style="color:var(--slate4);font-size:.8rem">Aucun message.</p>';
  return;
}

body.innerHTML = messages.map(msg => {
  // isOwn : soit c'est moi le vrai auteur (sent_by), soit je suis l'expéditeur direct
  const isOwn = msg.sent_by !== null && msg.sent_by !== undefined
    ? true
    : msg.sender_id === currentUser?.id;

  // Nom affiché : vrai auteur si sent_by existe, sinon nom de l'expéditeur (jointure BDD)
  const authorName = msg.sent_by
    ? `${msg.sent_by_first_name ?? ''} ${msg.sent_by_last_name ?? ''}`.trim() || 'Admin'
    : `${msg.first_name ?? ''} ${msg.last_name ?? ''}`.trim() || 'Utilisateur';

  const color    = isOwn ? 'var(--blue)' : adminAvatarColor(msg.sender_id);
  const initials = isOwn
    ? (currentUser.first_name?.[0] ?? 'M').toUpperCase()
    : (msg.sent_by_first_name?.[0] ?? msg.first_name?.[0] ?? '?').toUpperCase();
  const time = adminFormatTime(msg.created_at);

  const wrapClass   = isOwn ? 'bubble-wrap own' : 'bubble-wrap';
  const bubbleClass = isOwn ? 'bubble own'       : 'bubble other';

  // Label admin avec le vrai nom de l'auteur
  const senderIsAdmin = msg.role === 'admin';
  const adminLabel    = senderIsAdmin
    ? `<div style="font-size:.65rem;color:var(--amber);font-weight:600;margin-bottom:2px;${isOwn ? 'text-align:right' : ''}">🛡️ Admin · ${authorName}</div>`
    : '';

  return `
    <div class="${wrapClass}">
      <div class="bubble-avatar" style="background:${color}">${initials}</div>
      <div>
        <div style="font-size:.68rem;color:var(--slate4);margin-bottom:3px;${isOwn ? 'text-align:right' : ''}">${authorName}</div>
        ${adminLabel}
        <div class="${bubbleClass}">${msg.content}</div>
        <div class="bubble-time ${isOwn ? '' : 'other'}">${time}</div>
      </div>
    </div>
  `;
}).join('');

// S'assure que seul #admin-msg-body scrolle, pas la page entière
const bodyEl = document.getElementById('admin-msg-body');
if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
} catch {
const bodyEl = document.getElementById('admin-msg-body');
if (bodyEl) bodyEl.innerHTML = '<p style="color:#DC2626;font-size:.8rem">Erreur de chargement des messages.</p>';
}
}

/* ══════════════════════════════
   SUPPORT HELPDESK (Admin → User)
══════════════════════════════ */
// Stocke la conversation support active pour pouvoir envoyer des messages
let activeSupportConvoId  = null;
let activeSupportReceiver = null; // userId du user concerné

async function openDirectMessage(userId, userName) {
try {
const res  = await fetch(`/api/admin/messages/support/${userId}`, {
method: 'POST',
credentials: 'include',
});
const data = await res.json();
if (!res.ok) { toast('Erreur ouverture conversation support.'); return; }
activeSupportConvoId  = data.conversationId;
activeSupportReceiver = userId;

showSection('messages');

document.getElementById('admin-chat-title').textContent = `Support — ${userName}`;
document.getElementById('admin-chat-sub').textContent   = 'Ticket de support';
// Admin est participant → on cache le badge, on affiche l'input
document.getElementById('admin-readonly-badge').style.display = 'none';
document.getElementById('admin-msg-input-row').style.display  = 'flex';
document.getElementById('admin-msg-header').style.display     = 'flex';
document.getElementById('admin-no-convo').style.display       = 'none';
document.getElementById('admin-msg-body').style.display       = 'flex';

// Rejoindre la room Socket.io
socket.emit('join conversation', data.conversationId);

await loadSupportMessages(data.conversationId);
} catch {
toast('Erreur réseau.');
}
}

async function loadSupportMessages(conversationId) {
const body = document.getElementById('admin-msg-body');
body.innerHTML = '';
try {
const res      = await fetch(`/api/admin/messages/conversation/${conversationId}`, { credentials: 'include' });
const data     = await res.json();
const messages = data.messages ?? [];
if (!messages.length) {
  body.innerHTML = '<p style="color:var(--slate4);font-size:.8rem">Aucun message pour l\'instant.</p>';
  return;
}

body.innerHTML = messages.map(msg => {
  const isOwn = msg.sent_by !== null && msg.sent_by !== undefined
    ? true
    : msg.sender_id === currentUser?.id;
  // Nom du vrai auteur : sent_by_first_name si message support, sinon nom de l'expéditeur
  const authorName = msg.sent_by
    ? `${msg.sent_by_first_name ?? ''} ${msg.sent_by_last_name ?? ''}`.trim() || 'Admin'
    : `${msg.first_name ?? ''} ${msg.last_name ?? ''}`.trim() || 'Utilisateur';
  const name = authorName;
  const color    = isOwn ? 'var(--blue)' : adminAvatarColor(msg.sender_id);
  const initials = isOwn
    ? (currentUser.first_name?.[0] ?? 'M').toUpperCase()
    : (msg.first_name?.[0] ?? '?').toUpperCase();
  const time     = adminFormatTime(msg.created_at);

  const wrapClass   = isOwn ? 'bubble-wrap own' : 'bubble-wrap';
  const bubbleClass = isOwn ? 'bubble own'       : 'bubble other';

  // Label admin : affiche le vrai auteur (sent_by) pas le compte support
  const senderIsAdmin = msg.role === 'admin';
  const adminLabel    = senderIsAdmin
    ? `<div style="font-size:.65rem;color:var(--amber);font-weight:600;margin-bottom:2px;${isOwn ? 'text-align:right' : ''}">🛡️ Admin · ${name}</div>`
    : '';

  return `
    <div class="${wrapClass}">
      <div class="bubble-avatar" style="background:${color}">${initials}</div>
      <div>
        <div style="font-size:.68rem;color:var(--slate4);margin-bottom:3px;${isOwn ? 'text-align:right' : ''}">${name}</div>
        ${adminLabel}
        <div class="${bubbleClass}">${msg.content}</div>
        <div class="bubble-time ${isOwn ? '' : 'other'}">${time}</div>
      </div>
    </div>
  `;
}).join('');

body.scrollTop = body.scrollHeight;
} catch {
body.innerHTML = '<p style="color:#DC2626;font-size:.8rem">Erreur chargement.</p>';
}
}
// Câblage unique de la barre d'envoi (appelé une seule fois au DOMContentLoaded)
function initAdminSendBar() {
const input = document.getElementById('admin-msg-input');
const btn   = document.getElementById('admin-send-btn');
const send = () => {
const content = input.value.trim();
if (!content || !activeSupportReceiver) return;
// Émission Socket.io — même mécanique que conversations.js
socket.emit('private message', {
  senderId:   currentUser.id,
  receiverId: activeSupportReceiver,
  content,
  useSupport: true  // indique au serveur de substituer par le compte support
});

input.value = '';
};
btn.addEventListener('click', send);
input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}