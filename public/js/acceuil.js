// Fichier : public/js/participant.js

// 2 events mis en avant (par index une fois chargés)
const FEATURED_COUNT = 2;

// Couleurs et emojis par catégorie pour les cartes
const CATEGORY_STYLE = {
  tech:        { gradient: 'linear-gradient(135deg,#1B4FD8,#0D9488)', emoji: '💻', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  music:       { gradient: 'linear-gradient(135deg,#7C3AED,#EC4899)', emoji: '🎵', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  workshops:   { gradient: 'linear-gradient(135deg,#0D9488,#059669)', emoji: '📚', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  conferences: { gradient: 'linear-gradient(135deg,#F59E0B,#EF4444)', emoji: '🎤', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  arts:        { gradient: 'linear-gradient(135deg,#EC4899,#8B5CF6)', emoji: '🎨', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  sports:      { gradient: 'linear-gradient(135deg,#16A34A,#0D9488)', emoji: '🏃', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  food:        { gradient: 'linear-gradient(135deg,#D97706,#EF4444)', emoji: '🍽', bg: 'rgba(255,255,255,.2)', color: '#fff' },
  default:     { gradient: 'linear-gradient(135deg,#334155,#1E293B)', emoji: '📅', bg: 'rgba(255,255,255,.2)', color: '#fff' },
};

// Filtre actif en cours
let currentFilter = { keyword: '', city: '', date: '', category: 'all' };

// ID de l'event sélectionné pour la modale
let selectedEventId = null;

// ─── TOAST ───────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  document.getElementById('toast-msg').textContent = msg;
  icon.textContent = isError ? '✕' : '✓';
  icon.className = 'toast-icon' + (isError ? ' error' : '');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── FORMATAGE DATE ───────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── GÉNÉRATION DU HTML D'UNE CARTE ──────────────────
function buildEventCard(event) {
  const cat   = (event.category || 'default').toLowerCase();
  const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE.default;
  const registered = parseInt(event.registered_count) || 0;
  const max        = event.max_participants;
  const isFull     = max && registered >= max;
  const spotsLeft  = max ? `${registered} / ${max} inscrits` : `${registered} inscrits`;
  const priceLabel = (!event.price || parseFloat(event.price) === 0)
    ? '<span class="price free">Gratuit</span>'
    : `<span class="price">€${parseFloat(event.price).toFixed(0)}</span>`;

  const card = document.createElement('div');
  card.className = 'event-card';
  card.dataset.eventId    = event.id;
  card.dataset.eventTitle = event.title;

  const detailUrl = `/event-detail?id=${event.id}`;

  card.innerHTML = `
    <div class="card-img" style="background:${style.gradient};cursor:pointer" onclick="window.location.href='${detailUrl}'">
      <div class="card-img-bg">${style.emoji}</div>
      <span class="card-cat" style="background:${style.bg};color:${style.color}">
        ${event.category || 'Event'}
      </span>
    </div>
    <div class="card-body">
      <h3 style="cursor:pointer" onclick="window.location.href='${detailUrl}'">${event.title}</h3>
      <div class="card-meta">
        <span>📅 ${formatDate(event.start_date)}</span>
        ${event.city ? `<span>📍 ${event.city}</span>` : ''}
        <span>👥 ${spotsLeft}</span>
      </div>
      <div class="card-footer">
        ${priceLabel}
        <button class="btn-sm btn-book" data-event-id="${event.id}" data-event-title="${event.title}"
          ${isFull ? 'disabled title="Event is full"' : ''}>
          ${isFull ? 'Full' : 'Book now'}
        </button>
      </div>
    </div>`;

  return card;
}

// ─── CARTE FEATURED ──────────────────────────────────
function buildFeaturedCard(event) {
  const cat   = (event.category || 'default').toLowerCase();
  const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE.default;
  const isFree = !event.price || parseFloat(event.price) === 0;
  const max    = event.max_participants;

  const card = document.createElement('div');
  card.className = 'featured-card';
  // Couleur de bordure gauche selon catégorie
  const borderColor = cat === 'tech' ? 'var(--blue)' : 'var(--teal)';
  card.style.borderLeft = `4px solid ${borderColor}`;
  card.dataset.eventId    = event.id;
  card.dataset.eventTitle = event.title;

  card.innerHTML = `
    <div class="featured-img" style="background:${style.gradient.replace('linear-gradient(135deg,','').split(',')[0].replace('linear-gradient(135deg','').replace(')','')}1a)">
      ${style.emoji}
    </div>
    <div class="featured-body">
      <div class="tag-row" style="margin-bottom:8px">
        <span class="tag" style="background:var(--blue-l);color:var(--blue)">${event.category || 'Événement'}</span>
        <span class="tag" style="background:${isFree ? '#F0FDF4' : '#FEF9C3'};color:${isFree ? '#16A34A' : '#B45309'}">
          ${isFree ? 'Entrée gratuite' : 'VIP disponible'}
        </span>
      </div>
      <h3>${event.title}</h3>
      <p>${(event.description || '').substring(0, 90)}…</p>
      <div style="font-size:.75rem;color:var(--slate3)">
        📅 ${formatDate(event.start_date)}
        ${event.location ? `&nbsp; 📍 ${event.location}` : ''}
        ${max ? `&nbsp; 👥 ${max} places` : ''}
      </div>
    </div>`;

  card.addEventListener('click', () => {
    window.location.href = `/event-detail?id=${event.id}`;
  });
  return card;
}

// ─── AFFICHAGE DES EVENTS ─────────────────────────────
function renderEvents(events) {
  const grid = document.getElementById('events-grid');
  const count = document.getElementById('events-count');
  grid.innerHTML = '';

  // Featured : les 2 premiers événements
  const featuredGrid = document.getElementById('featured-grid');
  featuredGrid.innerHTML = '';
  const featured = events.slice(0, FEATURED_COUNT);
  featured.forEach(event => featuredGrid.appendChild(buildFeaturedCard(event)));

  if (!events || events.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div style="font-size:2rem">🔍</div>
        <p>Aucun événement trouvé. Essayez d'autres filtres.</p>
      </div>`;
    count.textContent = '';
    return;
  }

  count.textContent = `${events.length} événement${events.length > 1 ? 's' : ''} trouvé${events.length > 1 ? 's' : ''}`;
  events.forEach(event => grid.appendChild(buildEventCard(event)));

  // Attache les listeners sur les boutons "Book now"
  grid.querySelectorAll('.btn-book').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      openBookModal(btn.dataset.eventId, btn.dataset.eventTitle);
    });
  });
}

// ─── APPEL API RECHERCHE ──────────────────────────────
async function fetchEvents() {
  document.getElementById('events-grid').innerHTML =
    `<div class="empty-state"><div class="spinner"></div><p>Loading…</p></div>`;

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(currentFilter),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    renderEvents(data);
  } catch (err) {
    document.getElementById('events-grid').innerHTML =
      `<div class="empty-state"><p>⚠️ ${err.message}</p></div>`;
  }
}

// ─── VARIABLES D'ÉTAT MODAL ───────────────────────────
let currentEventData  = null; // données de l'event sélectionné
let currentUser       = null; // données de l'utilisateur connecté

// Charge les infos de l'utilisateur une seule fois au démarrage
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) currentUser = await res.json();
  } catch (_) {}
}

// Génère un bloc formulaire nominatif pour un ticket
function buildHolderForm(index, user) {
  const isFirst   = index === 0;
  const firstName = isFirst && user ? user.first_name : '';
  const lastName  = isFirst && user ? user.last_name  : '';
  const email     = isFirst && user ? user.email      : '';

  return `
    <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:.78rem;font-weight:700;color:var(--slate3);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">
        Ticket ${index + 1}
      </div>
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-group" style="margin-bottom:0">
          <label>First name *</label>
          <input type="text" class="holder-firstname" value="${firstName}" required>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Last name *</label>
          <input type="text" class="holder-lastname" value="${lastName}" required>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Email *</label>
        <input type="email" class="holder-email" value="${email}" required>
      </div>
    </div>`;
}

// Met à jour les formulaires selon la quantité choisie
function updateHolderForms() {
  const qty       = parseInt(document.getElementById('ticket-qty').value) || 1;
  const container = document.getElementById('ticket-holders-container');
  container.innerHTML = '';
  for (let i = 0; i < qty; i++) {
    container.innerHTML += buildHolderForm(i, currentUser);
  }
}

// ─── MODAL RÉSERVATION ────────────────────────────────
async function openBookModal(eventId, eventTitle) {
  selectedEventId = eventId;

  // Reset des étapes
  document.getElementById('booking-step-1').style.display = 'block';
  document.getElementById('booking-step-2').style.display = 'none';
  document.getElementById('modal-event-title').textContent = eventTitle;
  document.getElementById('ticket-qty').value = 1;

  // Charge les types de tickets de cet event
  try {
    const res  = await fetch(`/api/events/${eventId}`, { credentials: 'include' });
    const data = await res.json();
    currentEventData = data;

    const container = document.getElementById('ticket-types-booking');
    const tickets   = Array.isArray(data.ticket_types) ? data.ticket_types : [];
    container.innerHTML = tickets.map((t, i) => `
      <div class="ticket-type ${i === 0 ? 'selected' : ''}"
           data-ticket-id="${t.id}" data-price="${t.price}"
           onclick="document.querySelectorAll('#ticket-types-booking .ticket-type').forEach(x=>x.classList.remove('selected'));this.classList.add('selected')">
        <div>
          <div class="ticket-name">${t.name}</div>
          ${t.description ? `<div class="ticket-desc">${t.description}</div>` : ''}
        </div>
        <div class="ticket-price">${parseFloat(t.price) === 0 ? 'Free' : '€' + parseFloat(t.price).toFixed(0)}</div>
      </div>`).join('') || '<p style="color:var(--slate3);font-size:.85rem">No ticket types available.</p>';

  } catch (_) { currentEventData = null; }

  // Génère le 1er formulaire pré-rempli
  updateHolderForms();

  const btn = document.getElementById('btn-confirm-book');
  btn.disabled    = false;
  btn.textContent = 'Confirm booking →';

  document.getElementById('modal-book').classList.add('open');
}

function closeBookModal() {
  document.getElementById('modal-book').classList.remove('open');
  selectedEventId  = null;
  currentEventData = null;
}

// Envoi de la réservation à l'API
async function confirmBooking() {
  if (!selectedEventId) return;

  // Collecte le ticket type sélectionné
  const selectedTicketEl = document.querySelector('#ticket-types-booking .ticket-type.selected');
  const ticketTypeId     = selectedTicketEl?.dataset.ticketId || null;

  // Collecte les données nominatives
  const firstNames = [...document.querySelectorAll('.holder-firstname')].map(i => i.value.trim());
  const lastNames  = [...document.querySelectorAll('.holder-lastname')].map(i => i.value.trim());
  const emails     = [...document.querySelectorAll('.holder-email')].map(i => i.value.trim());

  // Validation simple
  if (firstNames.some(v => !v) || lastNames.some(v => !v) || emails.some(v => !v)) {
    showToast('Please fill in all attendee fields.', true);
    return;
  }

  const tickets = firstNames.map((fn, i) => ({
    holder_first_name: fn,
    holder_last_name:  lastNames[i],
    holder_email:      emails[i],
  }));

  const btn = document.getElementById('btn-confirm-book');
  btn.disabled    = true;
  btn.textContent = 'Processing…';

  try {
    const res = await fetch('/api/events/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId: selectedEventId, ticketTypeId, tickets }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed.');

    if (data.type === 'paid') {
      // Redirige vers Stripe Checkout
      window.location.href = data.stripeUrl;
    } else {
      // Gratuit : affiche les QR codes directement
      document.getElementById('booking-step-1').style.display = 'none';
      document.getElementById('booking-step-2').style.display = 'block';

      const zone = document.getElementById('booking-success-zone');
      zone.innerHTML = data.tickets.map(t => `
        <div style="border:1.5px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;text-align:center">
          <div style="font-weight:700;font-size:.9rem;margin-bottom:4px">
            ${t.holder_first_name} ${t.holder_last_name}
          </div>
          <div style="font-size:.75rem;color:var(--slate3);margin-bottom:12px">${t.holder_email}</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${t.qr_code_secret}"
               alt="QR Code" style="border-radius:8px">
          <div style="font-size:.7rem;color:var(--slate4);margin-top:8px">Ticket ID: ${t.id}</div>
        </div>`).join('');

      showToast('Tickets booked successfully!');
      fetchEvents(); // met à jour les compteurs
    }
  } catch (err) {
    showToast(err.message, true);
    btn.disabled    = false;
    btn.textContent = 'Confirm booking →';
  }
}

// ─── LISTENERS ───────────────────────────────────────
document.getElementById('btn-search').addEventListener('click', () => {
  currentFilter.keyword = document.getElementById('search-keyword').value.trim();
  currentFilter.city    = document.getElementById('search-city').value.trim();
  currentFilter.date    = document.getElementById('search-date').value;
  fetchEvents();
});

// Recherche au Enter
document.getElementById('search-keyword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-search').click();
});

// Filtrage par chip
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function () {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    currentFilter.category = this.dataset.category === 'all' ? null : this.dataset.category;
    fetchEvents();
  });
});

// Fermeture modale
document.getElementById('modal-close-btn').addEventListener('click', closeBookModal);
document.getElementById('ticket-qty')?.addEventListener('input', updateHolderForms);
document.getElementById('modal-book').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeBookModal();
});
document.getElementById('btn-confirm-book').addEventListener('click', confirmBooking);

// Déconnexion
document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

// ─── INIT ─────────────────────────────────────────────
loadCurrentUser();
fetchEvents();

// Gestion du retour depuis Stripe (booking=success ou booking=cancelled)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('booking') === 'cancelled') {
  showToast('Payment cancelled. No charge was made.', true);
}