// Fichier : public/js/dashboard.js

// ── Helpers ──────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function statusBadge(status) {
  const map = {
    published: { bg: '#DCFCE7', color: '#16A34A', label: 'Live' },
    draft:     { bg: '#FEF9C3', color: '#B45309', label: 'Draft' },
    cancelled: { bg: '#FEF2F2', color: '#DC2626', label: 'Cancelled' },
    completed: { bg: '#F1F5F9', color: '#475569', label: 'Completed' },
  };
  const s = map[status] ?? map.draft;
  return `<span class="status-badge" style="background:${s.bg};color:${s.color}">${s.label}</span>`;
}

const THUMB_COLORS = ['var(--blue-l)', 'var(--teal-l)', '#FDF4FF', '#FFF7ED', '#F0FDF4'];
const THUMB_ICONS  = ['💻', '🌿', '🎨', '🎤', '🎵', '🏃'];

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const t   = document.getElementById('toast');
  const ico = t.querySelector('.toast-icon');
  document.getElementById('toast-msg').textContent = msg;
  ico.style.background = isError ? 'var(--red)' : 'var(--green)';
  ico.textContent       = isError ? '✕' : '✓';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Modal ─────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Ouvre la modale d'annulation en mémorisant l'ID de l'event ciblé
function openCancelModal(eventId) {
  cancelTargetEventId = eventId;
  openModal('modal-cancel');
}

// Fermer la modale en cliquant sur l'overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ── Navigation SPA : affiche une section, masque toutes les autres ────
let messagesLoaded = false; // évite de recharger les conversations à chaque clic

function showSection(sectionId) {
  // Masque toutes les sections
  document.querySelectorAll('.dash-section').forEach(s => s.classList.add('section-hidden'));
  // Affiche la section ciblée
  document.getElementById(sectionId)?.classList.remove('section-hidden');

  // Met à jour l'item actif dans la sidebar
  document.querySelectorAll('.sb-item').forEach(item => item.classList.remove('active'));
  const activeItem = document.querySelector(`.sb-item[onclick="showSection('${sectionId}')"]`);
  if (activeItem) activeItem.classList.add('active');

  // Charge les conversations uniquement au 1er clic sur Messages
  if (sectionId === 'section-messages' && !messagesLoaded) {
    messagesLoaded = true;
    initMessaging();
  }

  // Initialise le graphique My Events au 1er affichage
  if (sectionId === 'section-my-events') {
    initGlobalChart();
  }
}

// Bouton retour → revient à la liste des events
document.getElementById('btn-back-events').addEventListener('click', () => {
  showSection('section-my-events');
});

// ── Fetch centralisé ──────────────────────────────────────
async function apiFetch(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401) {
    window.location.href = '/';
    return null;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── KPI Cards ─────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await apiFetch('/api/dashboard/stats');
    if (!data) return;

    document.getElementById('kpi-events').textContent  = data.activeEventsCount;
    document.getElementById('kpi-tickets').textContent = data.totalTicketsSold;
    document.getElementById('kpi-revenue').textContent = Number(data.totalRevenue).toLocaleString('fr-FR', { minimumFractionDigits: 0 })+'€';
    document.getElementById('kpi-rating').textContent  =
      data.avgRating ? Number(data.avgRating).toFixed(1) : '—';

    document.getElementById('sb-events-count').textContent = data.activeEventsCount;
  } catch (err) {
    console.error('[stats]', err);
    ['kpi-events', 'kpi-tickets', 'kpi-revenue', 'kpi-rating'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }
}

// ── Graphique global (Chart.js) ───────────────────────────
// Données statiques — à brancher sur une API /weekly plus tard
function initGlobalChart() {
  const ctx = document.getElementById('chart-global').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Tickets vendus',
          data: [42, 78, 55, 130, 95, 110],
          backgroundColor: '#C3D2FF',
          borderRadius: 6,
        },
        {
          label: 'Revenus (€)',
          data: [840, 1560, 1100, 2600, 1900, 2200],
          backgroundColor: '#1B4FD8',
          borderRadius: 6,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } } },
      scales: {
        y:  { beginAtZero: true, grid: { color: '#E2E8F0' }, ticks: { font: { size: 10 } } },
        y2: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, callback: v => '€' + v } },
      },
    },
  });
}

// ── Graphique inscriptions d'un event (Chart.js) ──────────
// Données mockées — remplaçables par /api/events/:id/registrations
let attendeesChart = null;

// stats = tableau de { day: '2025-05-01', count: '3' } retourné par l'API
function initAttendeesChart(stats = []) {
  const ctx = document.getElementById('chart-attendees').getContext('2d');

  if (attendeesChart) attendeesChart.destroy();

  // Construit les labels (dates formatées) et les données cumulées
  let cumul = 0;
  const labels = stats.map(s =>
    new Date(s.day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  );
  const data = stats.map(s => {
    cumul += parseInt(s.count);
    return cumul;
  });

  // Fallback visuel si aucune donnée
  const hasData = data.length > 0;

  attendeesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hasData ? labels : ['—'],
      datasets: [{
        label: 'Inscriptions cumulées',
        data:  hasData ? data  : [0],
        borderColor: '#1B4FD8',
        backgroundColor: 'rgba(27,79,216,.08)',
        borderWidth: 2,
        pointBackgroundColor: '#1B4FD8',
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#E2E8F0' }, ticks: { font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  });
}

// ── Vue participants ──────────────────────────────────────
// Mémorise l'ID de l'event ciblé par la modale d'annulation
let cancelTargetEventId = null;

async function viewEventAttendees(eventId, eventTitle) {
  document.getElementById('attendees-title').textContent = `Participants : ${eventTitle}`;

  const tbody = document.getElementById('attendees-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="padding:16px;color:var(--slate3)">Chargement…</td></tr>';

  showSection('section-event-attendees');

  try {
    const data = await apiFetch(`/api/dashboard/events/${eventId}/attendees`);
    if (!data) return;

    const { attendees, stats } = data;

    // Remplit le tableau avec les vraies données
    tbody.innerHTML = attendees.length
      ? attendees.map(a => {
          const date = new Date(a.registered_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric',
          });
          return `
            <tr>
              <td style="font-weight:600">${a.first_name} ${a.last_name}</td>
              <td>${a.email}</td>
              <td>${a.ticket_type}</td>
              <td>${date}</td>
              <td><span class="status-badge" style="background:#DCFCE7;color:#16A34A">Confirmé</span></td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="5" style="padding:16px;color:var(--slate3)">Aucun participant inscrit.</td></tr>';

    // Graphique alimenté par les vraies dates
    initAttendeesChart(stats);

  } catch (err) {
    console.error('[attendees]', err);
    tbody.innerHTML = '<tr><td colspan="5" style="color:#DC2626;padding:16px">Erreur de chargement.</td></tr>';
  }
}

// ── Liste des events ──────────────────────────────────────
async function loadEvents() {
  const container = document.getElementById('events-list');
  try {
    const events = await apiFetch('/api/dashboard/events');
    if (!events) return;

    if (!events.length) {
      container.innerHTML = `
        <p style="font-size:.82rem;color:var(--slate3);padding:12px 0">
          Aucun événement.
          <a href="/create-event" style="color:var(--blue);font-weight:600">Créer le premier →</a>
        </p>`;
      return;
    }

    container.innerHTML = events.map((ev, i) => {
      const registered = parseInt(ev.registered_count) || 0;
      const max        = ev.max_participants;
      const pct        = ev.fill_pct ?? 0;
      const date       = ev.start_date
        ? new Date(ev.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : '–';
      const barColor   = pct >= 80 ? 'var(--amber)' : pct >= 50 ? 'var(--blue)' : 'var(--teal)';

      // Échappe le titre pour usage dans un attribut onclick
      const safeTitleAttr = ev.title.replace(/'/g, "\\'");

      return `
        <div class="event-row">
          <div class="event-thumb" style="background:${THUMB_COLORS[i % THUMB_COLORS.length]}">
            ${THUMB_ICONS[i % THUMB_ICONS.length]}
          </div>
          <div class="event-row-info">
            <h4>${ev.title}</h4>
            <span>${date}${ev.city ? ' · ' + ev.city : ''}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            ${statusBadge(ev.status)}
            <div>
              <div class="sold">${registered}${max ? ' / ' + max : ''}</div>
              ${max ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>` : ''}
            </div>
          </div>
          <!-- 3 boutons d'action -->
          <div class="event-actions">
            <button class="btn-primary"   onclick="viewEventAttendees('${ev.id}', '${safeTitleAttr}')">Voir Participants</button>
            <button class="btn-secondary" onclick="window.location.href='/create-event?edit=${ev.id}'">Modifier</button>
            <button class="btn-danger"    onclick="openCancelModal('${ev.id}')">Annuler</button>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('[events]', err);
    container.innerHTML = '<p style="font-size:.82rem;color:#DC2626">Erreur de chargement des événements.</p>';
  }
}

// ── Infos utilisateur (sidebar) ───────────────────────────
async function loadUser() {
  try {
    const user = await apiFetch('/api/auth/me');
    if (!user) return;

    const initials = (user.first_name[0] + user.last_name[0]).toUpperCase();
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('sidebar-name').textContent   = `${user.first_name} ${user.last_name}`;
    document.getElementById('dash-greeting').textContent  = `${getGreeting()}, ${user.first_name} 👋`;
    document.getElementById('dash-name').innerHTML   = `${user.first_name} ${user.last_name}`+' '+'👤';
  } catch (err) {
    console.error('[user]', err);
  }
}

// ── Sign out ──────────────────────────────────────────────
document.getElementById('btn-signout')?.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/';
  }
});

// ══════════════════════════════════════════════════════════
// ── LOGIQUE MESSAGERIE (intégrée depuis conversations.js) ─
// ══════════════════════════════════════════════════════════

// Variables d'état de la messagerie
let socket = null;
let currentConversationId = null;
let currentUserId         = null;
let currentReceiverId     = null;

// Couleurs d'avatar déterministes selon l'ID utilisateur
const MSG_COLORS = ['#7C3AED','#0D9488','#D97706','#1B4FD8','#DC2626','#059669'];
function avatarColor(id) {
  if (!id) return '#64748B';
  let hash = 0;
  for (const c of String(id)) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return MSG_COLORS[hash % MSG_COLORS.length];
}

function getInitials(firstName, email) {
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return (email || '?').slice(0, 2).toUpperCase();
}

// Affiche ou masque la zone de chat (header + body + input)
function showChatZone(show) {
  document.getElementById('msg-header').style.display            = show ? 'flex' : 'none';
  document.getElementById('msg-body').style.display              = show ? 'flex' : 'none';
  document.getElementById('msg-input-row').style.display         = show ? 'flex' : 'none';
  document.getElementById('no-convo-placeholder').style.display  = show ? 'none' : 'flex';
}

function nowTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatMsgTime(isoString) {
  if (!isoString) return nowTime();
  const d = new Date(isoString);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// Construit une bulle de message
function buildBubble(content, isOwn, timeStr, msg) {
  const wrapClass   = isOwn ? 'bubble-wrap own' : 'bubble-wrap';
  const bubbleClass = isOwn ? 'bubble own'       : 'bubble other';
  const senderIsAdmin = !isOwn && msg?.role === 'admin';

  const avatarHtml = isOwn ? '' : `
    <div class="bubble-avatar" style="background:${senderIsAdmin ? '#64748B' : avatarColor(currentReceiverId)};color:#fff;font-size:${senderIsAdmin ? '.9rem' : '.7rem'}">
      ${senderIsAdmin ? '🎧' : (document.getElementById('chat-avatar')?.textContent || '?')}
    </div>`;

  return `
    <div class="${wrapClass}">
      ${avatarHtml}
      <div>
        <div class="${bubbleClass}">${content}</div>
        <div class="bubble-time ${isOwn ? '' : 'other'}">${timeStr || nowTime()}</div>
      </div>
    </div>`;
}

// Met à jour l'aperçu d'une conversation dans la liste
function updateThreadPreview(conversationId, content) {
  const card = document.querySelector(`.msg-thread[data-id="${conversationId}"]`);
  if (!card) return;
  const preview = card.querySelector('.thread-preview');
  const time    = card.querySelector('.thread-time');
  if (preview) preview.textContent = content;
  if (time)    time.textContent    = nowTime();
  document.getElementById('conversation-list').prepend(card);
}

// Charge la liste des conversations
async function loadConversations() {
  const container = document.getElementById('conversation-list');
  const res  = await fetch('/api/messages/conversations', { credentials: 'include' });
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p style="padding:16px;font-size:.8rem;color:var(--slate3)">No conversations yet.</p>';
    return;
  }

  container.innerHTML = data.map(conv => {
    const isSupport = conv.title === 'SUPPORT';
    const name      = isSupport ? 'Support Team' : (conv.first_name ? `${conv.first_name} ${conv.last_name || ''}`.trim() : (conv.email || 'User'));
    const initials  = isSupport ? '🎧' : getInitials(conv.first_name, conv.email);
    const color     = isSupport ? '#64748B' : avatarColor(conv.other_user_id);
    const timeStr   = conv.last_message_created_at ? formatMsgTime(conv.last_message_created_at) : '';

    return `
      <div class="msg-thread" data-id="${conv.conversation_id}" data-other-user-id="${conv.other_user_id || ''}">
        <div class="thread-avatar" style="background:${color}">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
            <div class="thread-name">${name}</div>
            <div class="thread-time">${timeStr}</div>
          </div>
          <div class="thread-preview">${conv.last_message || ''}</div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.msg-thread').forEach(card => {
    card.addEventListener('click', () => selectConversation(card.dataset.id, card.dataset.otherUserId));
  });
}

// Sélectionne et ouvre une conversation
function selectConversation(conversationId, receiverId) {
  currentConversationId = conversationId;
  currentReceiverId     = receiverId;

  document.querySelectorAll('.msg-thread').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.msg-thread[data-id="${conversationId}"]`);
  if (card) {
    card.classList.add('active');
    document.getElementById('chat-avatar').textContent       = card.querySelector('.thread-avatar')?.textContent || '?';
    document.getElementById('chat-avatar').style.background  = card.querySelector('.thread-avatar')?.style.background || 'var(--blue)';
    document.getElementById('chat-name').textContent         = card.querySelector('.thread-name')?.textContent || '—';
    document.getElementById('chat-sub').textContent          = '';
    card.querySelector('.thread-unread')?.remove();
  }

  document.getElementById('send-btn').disabled = false;
  showChatZone(true);
  socket.emit('join conversation', conversationId);
  loadMessages(conversationId);
}

// Charge les messages d'une conversation
async function loadMessages(conversationId) {
  const res      = await fetch(`/api/messages/conversation/${conversationId}`, { credentials: 'include' });
  const messages = await res.json();
  const container = document.getElementById('msg-body');

  container.innerHTML = messages.map(msg =>
    buildBubble(msg.content, msg.sender_id === currentUserId, formatMsgTime(msg.created_at), msg)
  ).join('');
  container.scrollTop = container.scrollHeight;
}

// Envoie un message
function sendMessage() {
  const input   = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !currentConversationId || !currentReceiverId) return;

  socket.emit('private message', { senderId: currentUserId, receiverId: currentReceiverId, content });
  updateThreadPreview(currentConversationId, content);
  input.value = '';
}

// Initialise tout le système de messagerie (appelé au 1er clic sur "Messages")
async function initMessaging() {
  // Récupère l'ID de l'utilisateur connecté
  const res  = await fetch('/api/messages', { credentials: 'include' });
  const data = await res.json();
  currentUserId = data.userId;

  showChatZone(false);
  await loadConversations();

  // Connecte Socket.io
  socket = io();

  // Réception d'un nouveau message en temps réel
  socket.on('private message', (data) => {
    if (data.conversationId !== currentConversationId) return;
    const container = document.getElementById('msg-body');
    const senderId  = data.message?.sender_id || data.message?.senderId;
    container.insertAdjacentHTML('beforeend', buildBubble(data.message.content, senderId === currentUserId, nowTime(), data.message));
    updateThreadPreview(data.conversationId, data.message.content);
    container.scrollTop = container.scrollHeight;
  });

  // Bouton envoyer
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

  // Bouton nouvelle conversation
  document.getElementById('toggle-new-convo-btn').addEventListener('click', () => {
    const panel = document.getElementById('new-convo-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('create-convo-btn').addEventListener('click', async () => {
    const receiverId = document.getElementById('receiver-id').value.trim();
    if (!receiverId) return;
    const res  = await fetch('/api/messages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ receiverId })
    });
    const data = await res.json();
    document.getElementById('new-convo-panel').style.display = 'none';
    document.getElementById('receiver-id').value = '';
    await loadConversations();
    selectConversation(data.conversationId, receiverId);
  });
}

// ── Init global ───────────────────────────────────────────
async function init() {
  await Promise.all([loadUser(), loadStats(), loadEvents()]);

  // Confirmation annulation : appelle l'API puis recharge la liste
  document.getElementById('btn-confirm-cancel').addEventListener('click', async () => {
    if (!cancelTargetEventId) return;
    try {
      const res = await fetch(`/api/dashboard/events/${cancelTargetEventId}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeModal('modal-cancel');
      showToast('Événement annulé.');
      cancelTargetEventId = null;
      await loadEvents(); // recharge la liste pour refléter le nouveau statut
    } catch (err) {
      console.error('[cancel]', err);
      showToast('Erreur lors de l\'annulation.', true);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);