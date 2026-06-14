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
  document.querySelectorAll('.sb-item').forEach(item => item.classList.remove('Activated'));
  const activeItem = document.querySelector(`.sb-item[onclick="showSection('${sectionId}')"]`);
  if (activeItem) activeItem.classList.add('Activated');

  // Charge les ventes de tickets à chaque ouverture de l'onglet Tickets
  if (sectionId === 'section-tickets') {
    loadDashboardTickets();
  }

  // Charge les participants globaux à chaque ouverture de l'onglet Attendees
  if (sectionId === 'section-attendees') {
    loadDashboardAttendees();
  }

  // Charge les conversations uniquement au 1er clic sur Messages
  if (sectionId === 'section-messages' && !messagesLoaded) {
    messagesLoaded = true;
    initMessaging().then(() => {
      // Après chargement, ouvre la conversation ciblée par l'URL si présente
      const params = new URLSearchParams(window.location.search);
      const targetConvoId = params.get('convoId');
      if (targetConvoId) {
        const card = document.querySelector(`.msg-thread[data-id="${targetConvoId}"]`);
        if (card) selectConversation(targetConvoId, card.dataset.otherUserId);
      }
    });
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

let allDashboardTickets = [];
let allDashboardAttendees = [];

// ── État global de la liste des events ───────────────────
let allOrganizerEvents = [];   // tous les events récupérés de l'API
let filteredEvents     = [];   // events après filtre de recherche
let manageAllMode      = false; // true = vue complète avec recherche + pagination
let currentPage        = 1;
const itemsPerPage     = 10;

// Génère le HTML d'une ligne d'event
// Mémorise l'event ciblé par la modale d'annonce
let notifyTargetEventId = null;

// Ouvre la modale d'annonce en mémorisant l'event ciblé
function openNotifyModal(eventId, eventTitle) {
  notifyTargetEventId = eventId;
  document.getElementById('notify-modal-subtitle').textContent =
    `Broadcast a message to all participants of "${eventTitle}".`;
  document.getElementById('announce-content').value        = '';
  document.getElementById('announce-notify-future').checked = false;
  openModal('modal-notify-participants');
}

function buildEventRow(ev, i) {
  const registered    = parseInt(ev.registered_count) || 0;
  const max           = ev.max_participants;
  const pct           = ev.fill_pct ?? 0;
  const date          = ev.start_date
    ? new Date(ev.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : '–';
  const barColor      = pct >= 80 ? 'var(--amber)' : pct >= 50 ? 'var(--blue)' : 'var(--teal)';
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
      <div class="event-actions">
        <button class="btn-primary"   onclick="viewEventAttendees('${ev.id}', '${safeTitleAttr}')">Participant</button>
        <button class="btn-secondary" onclick="window.location.href='/create-event?edit=${ev.id}'">Modify</button>
        <button class="btn-secondary" onclick="openNotifyModal('${ev.id}', '${safeTitleAttr}')">Notify</button>
        <button class="btn-danger"    onclick="openCancelModal('${ev.id}')">Cancel</button>
      </div>
    </div>`;
}

// Bascule entre vue normale (grid) et vue "Manage all" (plein écran)
function toggleManageAllMode(event) {
  event.preventDefault();
  manageAllMode = !manageAllMode;
  currentPage   = 1;

  const normalView = document.getElementById('my-events-normal-view');
  const manageView = document.getElementById('my-events-manage-view');
  // Aussi masquer/montrer le graphique global et le header de section
  const globalChart = document.querySelector('#section-my-events .card:first-of-type');

  if (manageAllMode) {
    // Passe en vue plein écran
    normalView.style.display = 'none';
    if (globalChart) globalChart.style.display = 'none';
    manageView.style.display  = 'block';

    // Réinitialise la recherche
    const input = document.getElementById('manage-all-search-input');
    if (input) input.value = '';
    document.getElementById('search-suggestions').style.display = 'none';
    filteredEvents = [...allOrganizerEvents];
    renderManageView();
  } else {
    // Retour à la vue normale
    manageView.style.display  = 'none';
    normalView.style.display  = 'block';
    if (globalChart) globalChart.style.display = '';
  }
}

// Affiche les events dans la vue normale (10 premiers)
function renderOrganizerEvents() {
  const container = document.getElementById('events-list');
  if (!container) return;

  const slice = allOrganizerEvents.slice(0, 5);
  container.innerHTML = slice.length
    ? slice.map((ev, i) => buildEventRow(ev, i)).join('')
    : '<p style="font-size:.82rem;color:var(--slate3);padding:12px 0">No events yet. <a href="/create-event" style="color:var(--blue);font-weight:600">Create the first →</a></p>';
}

// Affiche les events dans la vue "Manage all" avec pagination
function renderManageView() {
  const container  = document.getElementById('events-list-manage');
  const pagination = document.getElementById('my-events-pagination');
  if (!container) return;

  const total      = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  currentPage      = Math.min(currentPage, totalPages);
  const start      = (currentPage - 1) * itemsPerPage;
  const slice      = filteredEvents.slice(start, start + itemsPerPage);

  container.innerHTML = slice.length
    ? slice.map((ev, i) => buildEventRow(ev, start + i)).join('')
    : '<p style="font-size:.82rem;color:var(--slate3);padding:12px 0">No matching events.</p>';

  pagination.style.display = total > itemsPerPage ? 'flex' : 'none';
  document.getElementById('pagination-info').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('btn-pagination-prev').disabled = currentPage <= 1;
  document.getElementById('btn-pagination-next').disabled = currentPage >= totalPages;
}

// Récupère les events et initialise l'affichage
async function loadEvents() {
  try {
    const events = await apiFetch('/api/dashboard/events');
    if (!events) return;

    allOrganizerEvents = events;
    filteredEvents     = [...events];
    renderOrganizerEvents();
  } catch (err) {
    console.error('[events]', err);
    document.getElementById('events-list').innerHTML =
      '<p style="font-size:.82rem;color:#DC2626">Erreur de chargement des événements.</p>';
  }
}

// ── Recherche et suggestions ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchInput   = document.getElementById('manage-all-search-input');
  const suggestionsEl = document.getElementById('search-suggestions');

  searchInput.addEventListener('input', () => {
    const raw      = searchInput.value.trim().toLowerCase();
    const keywords = raw.split(/\s+/).filter(Boolean);

    if (!keywords.length) {
      filteredEvents = [...allOrganizerEvents];
      suggestionsEl.style.display = 'none';
    } else {
      filteredEvents = allOrganizerEvents.filter(ev => {
        const haystack = `${ev.title} ${ev.city || ''} ${ev.status}`.toLowerCase();
        return keywords.every(kw => haystack.includes(kw));
      });

      if (filteredEvents.length) {
        suggestionsEl.innerHTML = filteredEvents.slice(0, 8).map(ev => `
          <div class="notif-item" data-id="${ev.id}" data-title="${ev.title.replace(/"/g,'&quot;')}"
               style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border)">
            <div class="notif-dot" style="background:var(--blue)"></div>
            <div>
              <p style="font-size:.82rem;font-weight:600">${ev.title}</p>
              <time style="font-size:.72rem;color:var(--slate4)">${ev.city || ''} · ${ev.status}</time>
            </div>
          </div>`).join('');

        suggestionsEl.querySelectorAll('.notif-item').forEach(item => {
          item.addEventListener('click', () => {
            viewEventAttendees(item.dataset.id, item.dataset.title);
            suggestionsEl.style.display = 'none';
            searchInput.value = '';
          });
        });
        suggestionsEl.style.display = 'block';
      } else {
        suggestionsEl.innerHTML = '<p style="padding:12px 16px;font-size:.8rem;color:var(--slate3)">No results.</p>';
        suggestionsEl.style.display = 'block';
      }
    }

    currentPage = 1;
    renderManageView();
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsEl.contains(e.target)) {
      suggestionsEl.style.display = 'none';
    }
  });

  document.getElementById('btn-pagination-prev').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderManageView(); }
  });
  document.getElementById('btn-pagination-next').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
    if (currentPage < totalPages) { currentPage++; renderManageView(); }
  });
});

// ── SECTION TICKETS (gestion des ventes) ──────────────────

// Badge de statut pour un ticket
function ticketStatusBadge(status) {
  const map = {
    registered: { bg: 'var(--blue-l)', color: 'var(--blue)',  label: 'Registered' },
    attended:   { bg: 'var(--green-l)', color: 'var(--green)', label: 'Attended' },
    cancelled:  { bg: 'var(--red-l)',  color: 'var(--red)',   label: 'Cancelled' },
  };
  const s = map[status] ?? map.registered;
  return `<span class="status-badge" style="background:${s.bg};color:${s.color}">${s.label}</span>`;
}

// Récupère les ventes de tickets et met à jour KPI + tableau
async function loadDashboardTickets() {
  try {
    const tickets = await apiFetch('/api/dashboard/tickets');
    if (!tickets) return;

    allDashboardTickets = tickets;

    // Calcul des indicateurs KPI
    const totalSold = tickets.length;
    const checkedIn = tickets.filter(t => t.status === 'attended').length;
    const cancelled = tickets.filter(t => t.status === 'cancelled').length;
    const revenue   = tickets
      .filter(t => t.status !== 'cancelled')
      .reduce((sum, t) => sum + Number(t.ticket_price), 0);

    document.getElementById('kpi-tickets-sold').textContent      = totalSold;
    document.getElementById('kpi-tickets-checkedin').textContent = checkedIn;
    document.getElementById('kpi-tickets-cancelled').textContent = cancelled;
    document.getElementById('kpi-tickets-revenue').textContent   =
      revenue.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + '€';

    populateEventFilter(tickets);
    applyTicketFilters();
  } catch (err) {
    console.error('[dashboard tickets]', err);
    document.getElementById('tickets-tbody').innerHTML =
      '<tr><td colspan="7" style="padding:16px;color:#DC2626">Error loading tickets.</td></tr>';
  }
}

// Remplit le filtre par événement avec la liste unique des titres d'event
function populateEventFilter(tickets) {
  const select = document.getElementById('tickets-event-filter');
  const previousValue = select.value;

  // Liste unique des titres d'événements, triée alphabétiquement
  const eventTitles = [...new Set(tickets.map(t => t.event_title))].sort();

  select.innerHTML = '<option value="all">All events</option>' +
    eventTitles.map(title => `<option value="${title}">${title}</option>`).join('');

  // Conserve la sélection précédente si elle existe toujours
  if (eventTitles.includes(previousValue)) {
    select.value = previousValue;
  }
}

// Applique la recherche + les filtres (statut + événement) sur allDashboardTickets
function applyTicketFilters() {
  const search = document.getElementById('tickets-search-input').value.trim().toLowerCase();
  const status = document.getElementById('tickets-status-filter').value;
  const eventTitle = document.getElementById('tickets-event-filter').value;

  let filtered = allDashboardTickets;

  if (status !== 'all') {
    filtered = filtered.filter(t => t.status === status);
  }

  if (eventTitle !== 'all') {
    filtered = filtered.filter(t => t.event_title === eventTitle);
  }

  if (search) {
    filtered = filtered.filter(t => {
      const haystack = `${t.first_name} ${t.last_name} ${t.email} ${t.event_title}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  renderDashboardTickets(filtered);
}

// Génère le tableau des tickets
function renderDashboardTickets(tickets) {
  const tbody = document.getElementById('tickets-tbody');

  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;color:var(--slate3);text-align:center">No tickets found.</td></tr>';
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const date  = new Date(t.registered_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const price = Number(t.ticket_price).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + '€';

    // Actions disponibles uniquement pour les billets "registered"
    let actions = '<span style="color:var(--slate4);font-size:.75rem">—</span>';
    if (t.status === 'registered') {
      actions = `
        <button class="btn-secondary" style="background:var(--green-l);color:var(--green)" onclick="checkinTicket('${t.participant_id}')">Check-in</button>
        <button class="btn-danger" onclick="cancelDashboardTicket('${t.participant_id}')">Cancel</button>`;
    }

    return `
      <tr>
        <td>
          <div style="font-weight:600">${t.first_name} ${t.last_name}</div>
          <div style="font-size:.72rem;color:var(--slate4)">${t.email}</div>
        </td>
        <td>${t.event_title}</td>
        <td>${t.ticket_name}</td>
        <td>${price}</td>
        <td>${date}</td>
        <td>${ticketStatusBadge(t.status)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">${actions}</td>
      </tr>`;
  }).join('');
}

// Action : valider l'entrée d'un participant
async function checkinTicket(id) {
  try {
    const res = await fetch(`/api/dashboard/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'attended' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    showToast('Attendee checked-in successfully!');
    loadDashboardTickets();
  } catch (err) {
    console.error('[checkin]', err);
    showToast('Error during check-in.', true);
  }
}

// Action : annuler un billet
async function cancelDashboardTicket(id) {
  try {
    const res = await fetch(`/api/dashboard/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    showToast('Ticket cancelled successfully!');
    loadDashboardTickets();
  } catch (err) {
    console.error('[cancel ticket]', err);
    showToast('Error during cancellation.', true);
  }
}

// Recherche et filtre en temps réel (côté client, sans appel API)
document.getElementById('tickets-search-input')?.addEventListener('input', applyTicketFilters);
document.getElementById('tickets-status-filter')?.addEventListener('change', applyTicketFilters);
document.getElementById('tickets-event-filter')?.addEventListener('change', applyTicketFilters);

// ── SECTION ATTENDEES (gestion globale des participants) ──

// Récupère la liste globale des participants de l'organisateur
async function loadDashboardAttendees() {
  try {
    const attendees = await apiFetch('/api/dashboard/attendees');
    if (!attendees) return;

    allDashboardAttendees = attendees;
    renderDashboardAttendees(allDashboardAttendees);
  } catch (err) {
    console.error('[dashboard attendees]', err);
    document.getElementById('attendees-tbody-global').innerHTML =
      '<tr><td colspan="6" style="padding:16px;color:#DC2626">Error loading attendees.</td></tr>';
  }
}

// Génère le tableau des participants
function renderDashboardAttendees(attendees) {
  const tbody = document.getElementById('attendees-tbody-global');

  if (!attendees.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:16px;color:var(--slate3);text-align:center">No attendees found.</td></tr>';
    return;
  }

  tbody.innerHTML = attendees.map(a => {
    const total    = parseInt(a.total_bookings) || 0;
    const attended = parseInt(a.total_attended) || 0;
    const rate     = total > 0 ? Math.round((attended / total) * 100) : 0;
    const spent    = Number(a.total_spent).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + '€';
    const lastReg  = a.last_registration
      ? new Date(a.last_registration).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const fullName = `${a.first_name} ${a.last_name}`.replace(/'/g, "\\'");

    return `
      <tr>
        <td>
          <div style="font-weight:600">${a.first_name} ${a.last_name}</div>
          <div style="font-size:.72rem;color:var(--slate4)">${a.email}</div>
        </td>
        <td>${total}</td>
        <td>${rate}%</td>
        <td>${spent}</td>
        <td>${lastReg}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-secondary" onclick="viewAttendeeHistory('${a.id}', '${fullName}', '${a.email}')">View History</button>
          ${a.id !== currentUserId ? `<button class="btn-primary" onclick="contactAttendee('${a.id}')">Contact</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

// Recherche locale par nom ou email (sans appel API)
document.getElementById('attendees-search-input')?.addEventListener('input', (e) => {
  const search = e.target.value.trim().toLowerCase();

  if (!search) {
    renderDashboardAttendees(allDashboardAttendees);
    return;
  }

  const filtered = allDashboardAttendees.filter(a => {
    const haystack = `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase();
    return haystack.includes(search);
  });
  renderDashboardAttendees(filtered);
});

// Ouvre la modale et charge l'historique d'achat d'un participant
async function viewAttendeeHistory(userId, fullName, email) {
  document.getElementById('attendee-history-title').textContent   = `Attendee History - ${fullName}`;
  document.getElementById('attendee-history-contact').textContent = email;

  const tbody = document.getElementById('attendee-history-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="padding:16px;color:var(--slate3)">Loading…</td></tr>';
  openModal('modal-attendee-history');

  try {
    const history = await apiFetch(`/api/dashboard/attendees/${userId}/history`);
    if (!history) return;

    tbody.innerHTML = history.length
      ? history.map(h => {
          const date  = new Date(h.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
          const price = Number(h.price).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + '€';
          return `
            <tr>
              <td style="font-weight:600">${h.title}</td>
              <td>${h.ticket_name}</td>
              <td>${price}</td>
              <td>${date}</td>
              <td>${ticketStatusBadge(h.status)}</td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="5" style="padding:16px;color:var(--slate3)">No history found.</td></tr>';
  } catch (err) {
    console.error('[attendee history]', err);
    tbody.innerHTML = '<tr><td colspan="5" style="color:#DC2626;padding:16px">Error loading history.</td></tr>';
  }
}

// Crée/récupère la conversation puis bascule sur l'onglet Messages
async function contactAttendee(userId) {
  try {
    const res = await fetch('/api/messages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ receiverId: userId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    closeModal('modal-attendee-history');
    showSection('section-messages');

    // Ouvre directement la conversation ciblée une fois la messagerie prête
    const openConvo = async () => {
      await loadConversations();
      selectConversation(data.conversationId, userId);
    };

    if (messagesLoaded) {
      openConvo();
    } else {
      setTimeout(openConvo, 600);
    }
  } catch (err) {
    console.error('[contact attendee]', err);
    showToast('Error opening conversation.', true);
  }
}


// ──  SECTION REPORTS ───────────────────────────



// ── Infos utilisateur (sidebar) ───────────────────────────
async function loadUser() {
  try {
    const user = await apiFetch('/api/auth/me');
    if (!user) return;

    currentUserId = user.id;
    const initials = (user.first_name[0] + user.last_name[0]).toUpperCase();
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('sidebar-name').textContent   = `${user.first_name}`;
    document.getElementById('dash-greeting').textContent  = `${getGreeting()}, ${user.first_name} 👋`;
    document.getElementById('dash-name').innerHTML   = `${user.first_name}`+'👤';
    document.getElementById('dash-profile').innerHTML   = `${user.first_name}`+' '+' '+`${user.last_name}`;
    document.getElementById('dash-email').innerHTML   = `${user.email}`;

  } catch (err) {
    console.error('[user]', err);
  }
}
// ── Infos utilisateur (sidebar) ───────────────────────────
function upload() {

  const fileUploadInput = document.querySelector('.file-uploader');
  // using index [0] to take the first file from the array
  const image = fileUploadInput.files[0];

  // check if the file selected is not an image file
  if (!image.type.includes('image')) {
    return alert('Only images are allowed!');
  }

  // check if size (in bytes) exceeds 10 MB
  if (image.size > 10_000_000) {
    return alert('Maximum upload size is 10MB!');
  }
   const fileReader = new FileReader();
    fileReader.readAsDataURL(image);

    fileReader.onload = (fileReaderEvent) => {
    const profilePicture = document.querySelector('.profile-picture');
    profilePicture.style.backgroundImage = `url(${fileReaderEvent.target.result})`;
    
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

    // Calcule si la conversation a des messages non lus
    // (dernier message plus récent que last_read_at ET pas envoyé par moi)
    const hasUnread = conv.last_message_created_at
      && conv.last_message_sender_id !== currentUserId
      && (!conv.last_read_at || new Date(conv.last_message_created_at) > new Date(conv.last_read_at));

    const unreadDot = hasUnread
      ? `<span style="width:8px;height:8px;border-radius:50%;background:#EF4444;flex-shrink:0;display:inline-block"></span>`
      : '';

    const nameStyle    = hasUnread ? 'font-weight:700;color:var(--slate)'  : '';
    const previewStyle = hasUnread ? 'font-weight:600;color:var(--slate2)' : '';

    return `
      <div class="msg-thread" data-id="${conv.conversation_id}" data-other-user-id="${conv.other_user_id || ''}">
        <div class="thread-avatar" style="background:${color}">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
            <div class="thread-name" style="${nameStyle}">${name}</div>
            <div style="display:flex;align-items:center;gap:6px">
              ${unreadDot}
              <div class="thread-time">${timeStr}</div>
            </div>
          </div>
          <div class="thread-preview" style="${previewStyle}">${conv.last_message || ''}</div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.msg-thread').forEach(card => {
    card.addEventListener('click', () => selectConversation(card.dataset.id, card.dataset.otherUserId));
  });
}

// Sélectionne et ouvre une conversation
async function selectConversation(conversationId, receiverId) {
  currentConversationId = conversationId;
  currentReceiverId     = receiverId;

  document.querySelectorAll('.msg-thread').forEach(c => c.classList.remove('Activated'));
  const card = document.querySelector(`.msg-thread[data-id="${conversationId}"]`);
  if (card) {
    card.classList.add('active');
    document.getElementById('chat-avatar').textContent       = card.querySelector('.thread-avatar')?.textContent || '?';
    document.getElementById('chat-avatar').style.background  = card.querySelector('.thread-avatar')?.style.background || 'var(--blue)';
    document.getElementById('chat-name').textContent         = card.querySelector('.thread-name')?.textContent || '—';
    document.getElementById('chat-sub').textContent          = '';

    // Supprime la pastille rouge de cette conversation
    card.querySelector('span[style*="EF4444"]')?.remove();
    card.querySelector('.thread-name').style.fontWeight = '';
    card.querySelector('.thread-preview').style.fontWeight = '';
  }

  document.getElementById('send-btn').disabled = false;
  showChatZone(true);
  socket.emit('join conversation', conversationId);
  loadMessages(conversationId);

  // Marque la conversation comme lue côté serveur
  await fetch(`/api/messages/conversation/${conversationId}/read`, {
    method: 'POST',
    credentials: 'include',
  });

  // Recalcule et met à jour le badge sidebar
  const msgRes = await fetch('/api/messages/unread', { credentials: 'include' });
  if (msgRes.ok) {
    const unreadConvos = await msgRes.json();
    const msgBadge = document.getElementById('sb-messages-unread-count');
    if (unreadConvos.length > 0) {
      msgBadge.textContent   = unreadConvos.length;
      msgBadge.style.display = '';
    } else {
      msgBadge.style.display = 'none';
    }
  }
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

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ── Badges sidebar : charge les compteurs non lus ────────
async function loadSidebarBadges() {
  try {
    const data = await apiFetch('/api/dashboard/notifications');
    if (!data) return;

    console.log('[badges] unreadCount =', data.unreadCount);
    console.log('[badges] element =', document.getElementById('sb-notifications-unread-count'));

    // Badge notifications
    const notifBadge = document.getElementById('sb-notifications-unread-count');
    if (data.unreadCount > 0) {
      notifBadge.textContent    = data.unreadCount;
      notifBadge.style.display  = 'inline-block'; // 'inline-block' au lieu de '' pour forcer l'affichage
    }

    // Badge messages non lus via l'endpoint dédié (calcul SQL fiable)
    const msgRes = await fetch('/api/messages/unread', { credentials: 'include' });
    if (msgRes.ok) {
      const unreadConvos = await msgRes.json();
      const msgBadge = document.getElementById('sb-messages-unread-count');
      if (unreadConvos.length > 0) {
        msgBadge.textContent   = unreadConvos.length;
        msgBadge.style.display = '';
      } else {
        msgBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('[badges]', err);
  }
}

// ── Centre de notifications ───────────────────────────────
async function renderNotificationsList() {
  const container = document.getElementById('notifications-list-container');
  try {
    const data = await apiFetch('/api/dashboard/notifications');
    if (!data) return;

    if (!data.notifications.length) {
      container.innerHTML = '<p style="font-size:.82rem;color:var(--slate3)">No notifications yet.</p>';
      return;
    }

    container.innerHTML = data.notifications.map(n => {
      const dotColor = n.type === 'registration' ? 'var(--blue)' : '#10B981';
      const text = n.type === 'registration'
        ? `<strong>${n.first_name} ${n.last_name}</strong> registered for your event <strong>${n.event_title}</strong>`
        : `<strong>${n.first_name} ${n.last_name}</strong> left a review on <strong>${n.event_title}</strong>${n.rating ? ' (' + '⭐'.repeat(n.rating) + ')' : ''}`;
      const unreadStyle = n.is_unread ? 'background:var(--blue-l);border-radius:8px;padding-left:8px;' : '';
      return `
        <div class="notif-item" style="${unreadStyle}"
             data-type="${n.type}"
             data-event-id="${n.event_id}"
             data-event-title="${n.event_title.replace(/"/g, '&quot;')}">
          <div class="notif-dot" style="background:${dotColor}"></div>
          <div>
            <p>${text}</p>
            <time>${timeAgo(n.created_at)}</time>
          </div>
        </div>`;
    }).join('');

    // Câble les clics après injection du HTML
    container.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => {
        handleNotifClick(el.dataset.type, el.dataset.eventId, el.dataset.eventTitle);
      });
    });

  } catch (err) {
    console.error('[notifications]', err);
    container.innerHTML = '<p style="font-size:.82rem;color:#DC2626">Error loading notifications.</p>';
  }
}

// ── Clic sur une notification : redirection intelligente ──
function handleNotifClick(type, eventId, eventTitle) {
  // Retire le fond bleu non-lu de la ligne cliquée
  const clicked = document.querySelector(
    `#notifications-list-container .notif-item[data-event-id="${eventId}"][data-type="${type}"]`
  );
  if (clicked) {
    clicked.style.background   = '';
    clicked.style.borderRadius = '';
    clicked.style.paddingLeft  = '';
  }

  if (type === 'registration') {
    viewEventAttendees(eventId, eventTitle);
  } else {
    showSection('section-my-events');
    showToast('Review received on: ' + eventTitle);
  }
}

// ── Init global ───────────────────────────────────────────
async function init() {
  await Promise.all([loadUser(), loadStats(), loadEvents()]);
  loadSidebarBadges(); // charge les badges en arrière-plan sans bloquer


  // Câble le bouton d'envoi d'annonce
  document.getElementById('btn-send-announcement')?.addEventListener('click', async () => {
    const content      = document.getElementById('announce-content').value.trim();
    const notifyFuture = document.getElementById('announce-notify-future').checked;

    if (!content) {
      showToast('Please write a message before sending.', true);
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/events/${notifyTargetEventId}/announce`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, notifyFuture }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      closeModal('modal-notify-participants');
      document.getElementById('announce-content').value        = '';
      document.getElementById('announce-notify-future').checked = false;
      notifyTargetEventId = null;
      showToast('Announcement broadcasted successfully!');
    } catch (err) {
      console.error('[announce]', err);
      showToast('Error while sending announcement.', true);
    }
  });

  // Câble le bouton "Mark all as read"
  document.getElementById('btn-notifications-read-all')?.addEventListener('click', async () => {
    try {
      await fetch('/api/dashboard/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      // Cache le badge sidebar
      document.getElementById('sb-notifications-unread-count').style.display = 'none';
      // Retire visuellement toutes les pastilles bleues sans refaire un fetch
      document.querySelectorAll('#notifications-list-container .notif-item').forEach(el => {
        el.style.background   = '';
        el.style.borderRadius = '';
        el.style.paddingLeft  = '';
      });
      document.querySelectorAll('#notifications-list-container .notif-dot').forEach(dot => {
        dot.style.background = 'var(--border)'; // pastille grise = lu
      });
      showToast('All notifications marked as read.');
    } catch (err) {
      console.error('[read-all]', err);
      showToast('Error occurred.', true);
    }
  });

  // Charge la liste au clic sur la section Notifications
  document.querySelector('.sb-item[onclick="showSection(\'section-notifications\')"]')
    ?.addEventListener('click', renderNotificationsList);

  // Si redirigé depuis la cloche (ex: /dashboard?section=messages&convoId=xxx)
  const params = new URLSearchParams(window.location.search);
  const targetSection = params.get('section');
  if (targetSection) showSection(`section-${targetSection}`);

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
      showToast('Event cancelled.');
      cancelTargetEventId = null;
      await loadEvents(); // recharge la liste pour refléter le nouveau statut
    } catch (err) {
      console.error('[cancel]', err);
      showToast('Error occurred while cancelling the event.', true);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);