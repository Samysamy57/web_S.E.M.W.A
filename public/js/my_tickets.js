// Fichier : public/js/my_tickets.js

// --- ÉTAT GLOBAL ---
let allTickets = [];
let currentTab = 'upcoming';

// Couleurs de bandeau (cycle simple selon l'index)
const BANNER_COLORS = ['#1B4FD8', '#0D9488', '#D97706', '#16A34A', '#DC2626'];

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Gestion des onglets Upcoming / Past
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderTickets();
    });
  });

  // Bouton de déconnexion
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.location.href = '/logout';
    });
  }

  // Boutons des modales d'annulation
  document.getElementById('btn-cancel-step1-continue').addEventListener('click', goToCancelStep2);
  document.getElementById('btn-cancel-confirm-final').addEventListener('click', confirmCancelTicket);

  loadTickets();
}

// --- APPEL API : récupération des tickets ---
async function loadTickets() {
  try {
    const res = await fetch('/api/tickets');

    if (res.status === 401) {
      window.location.href = '/';
      return;
    }

    if (!res.ok) {
      showError('Unable to load your tickets.');
      return;
    }

    allTickets = await res.json();
    renderTickets();
  } catch (err) {
    console.error('[loadTickets]', err);
    showError('Network error while loading your tickets.');
  }
}

// Affiche un message d'erreur dans la grille
function showError(message) {
  const grid = document.getElementById('tickets-grid');
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚠️</div>
      <p>${message}</p>
    </div>`;
}

// --- TRI ET RENDU DYNAMIQUE ---
function renderTickets() {
  const grid = document.getElementById('tickets-grid');
  grid.innerHTML = '';

  const now = new Date();

  // Filtrage selon l'onglet actif
  const filtered = allTickets.filter(ticket => {
    const eventStart = new Date(ticket.start_date);

    if (currentTab === 'upcoming') {
      return eventStart >= now && ticket.status !== 'cancelled';
    } else {
      return eventStart < now || ticket.status === 'cancelled';
    }
  });

  // État vide
  if (filtered.length === 0) {
    const emptyMsg = currentTab === 'upcoming' ? 'No upcoming tickets' : 'No past tickets';
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🎫</div>
        <p>${emptyMsg}</p>
      </div>`;
    return;
  }

  // Génération des cartes
  filtered.forEach((ticket, index) => {
    grid.appendChild(buildTicketCard(ticket, index));
  });
}

// Construit une carte de billet
function buildTicketCard(ticket, index) {
  const card = document.createElement('div');
  card.className = 'ticket-card';

  const bannerColor = BANNER_COLORS[index % BANNER_COLORS.length];

  // Badge de statut
  let statusLabel = 'Registered';
  let statusBg = 'var(--green-l)';
  let statusColor = 'var(--green)';

  if (ticket.status === 'cancelled') {
    statusLabel = 'Cancelled';
    statusBg = 'var(--red-l)';
    statusColor = 'var(--red)';
  }

  const eventDate = formatDate(ticket.start_date);

  card.innerHTML = `
    <div class="ticket-card-banner" style="background:${bannerColor}1A;color:${bannerColor}">🎫</div>
    <div class="ticket-card-body">
      <h3>${ticket.title}</h3>
      <div class="ticket-meta">
        <span>📅 ${eventDate}</span>
        <span>📍 ${ticket.city || ticket.location || ''}</span>
        <span>🎟️ ${ticket.ticket_name} — €${Number(ticket.price).toFixed(2)}</span>
      </div>
      <div class="ticket-card-footer">
        <span class="status-badge" style="background:${statusBg};color:${statusColor}">${statusLabel}</span>
      </div>
    </div>
  `;

  // Ouverture de la modale au clic
  card.addEventListener('click', () => openTicketModal(ticket));

  return card;
}

// Formate une date lisible
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- MODALE DE DÉTAILS + QR CODE ---
let activeTicket = null;

function openTicketModal(ticket) {
  activeTicket = ticket;

  const isUpcoming = new Date(ticket.start_date) >= new Date();
  const canCancel = ticket.status === 'registered' && isUpcoming;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticket.qr_code_secret}`;

  const content = document.getElementById('ticket-modal-content');

  content.innerHTML = `
    <h2 style="font-family:'Fraunces',serif;font-size:1.4rem;margin-bottom:16px">${ticket.title}</h2>

    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;font-size:.85rem;color:var(--slate2)">
      <span>📅 ${formatDate(ticket.start_date)}</span>
      <span>📍 ${ticket.location || ''} ${ticket.city ? '— ' + ticket.city : ''}</span>
      <span>👤 ${ticket.holder_first_name} ${ticket.holder_last_name}</span>
      <span>🎟️ ${ticket.ticket_name} — €${Number(ticket.price).toFixed(2)}</span>
    </div>

    <div style="text-align:center;margin-bottom:20px">
      <img src="${qrUrl}" alt="QR Code" style="border-radius:12px;border:1.5px solid var(--border)">
    </div>

    ${canCancel ? `<button class="btn-danger" id="btn-open-cancel-flow">Cancel Ticket</button>` : ''}

    ${ticket.status === 'cancelled' && ticket.cancellation_reason ? `
      <div style="margin-top:14px;padding:12px;background:var(--red-l);border-radius:9px;font-size:.8rem;color:var(--red)">
        <strong>Cancellation reason:</strong> ${ticket.cancellation_reason}
      </div>
    ` : ''}
  `;

  // Attache l'écouteur du bouton d'annulation (si présent)
  const cancelBtn = document.getElementById('btn-open-cancel-flow');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => openCancelStep1(ticket));
  }

  document.getElementById('ticket-modal').classList.add('open');
}

function closeTicketModal() {
  document.getElementById('ticket-modal').classList.remove('open');
}

// --- DOUBLE CONFIRMATION D'ANNULATION ---

// Étape 1 : motif d'annulation
function openCancelStep1(ticket) {
  document.getElementById('cancel-event-name').textContent =
    `You are about to cancel your ticket for "${ticket.title}".`;
  document.getElementById('cancel-reason').value = '';

  document.getElementById('cancel-step1').classList.add('open');
}

// Passage à l'étape 2 (confirmation finale)
function goToCancelStep2() {
  document.getElementById('cancel-step1').classList.remove('open');
  document.getElementById('cancel-step2').classList.add('open');
}

// Confirmation finale → appel API
async function confirmCancelTicket() {
  if (!activeTicket) return;

  const reasonText = document.getElementById('cancel-reason').value.trim();

  try {
    const res = await fetch(`/api/tickets/${activeTicket.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reasonText || null }),
    });

    if (!res.ok) {
      showToast('Unable to cancel ticket.', false);
      closeCancelFlow();
      return;
    }

    showToast('Ticket cancelled successfully', true);
    closeCancelFlow();
    closeTicketModal();
    loadTickets();
  } catch (err) {
    console.error('[confirmCancelTicket]', err);
    showToast('Network error during cancellation.', false);
    closeCancelFlow();
  }
}

// Ferme tout le flux d'annulation
function closeCancelFlow() {
  document.getElementById('cancel-step1').classList.remove('open');
  document.getElementById('cancel-step2').classList.remove('open');
}

// --- TOAST ---
function showToast(message, success = true) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msg = document.getElementById('toast-msg');

  msg.textContent = message;
  icon.textContent = success ? '✓' : '✕';
  icon.style.background = success ? 'var(--green)' : 'var(--red)';

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}