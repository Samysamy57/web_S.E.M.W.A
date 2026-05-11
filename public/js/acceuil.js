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

  card.innerHTML = `
    <div class="card-img" style="background:${style.gradient}">
      <div class="card-img-bg">${style.emoji}</div>
      <span class="card-cat" style="background:${style.bg};color:${style.color}">
        ${event.category || 'Event'}
      </span>
    </div>
    <div class="card-body">
      <h3>${event.title}</h3>
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

  card.addEventListener('click', () => openBookModal(event.id, event.title));
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

// ─── MODAL RÉSERVATION ────────────────────────────────
function openBookModal(eventId, eventTitle) {
  selectedEventId = eventId;
  document.getElementById('modal-event-title').textContent = eventTitle;
  document.getElementById('btn-confirm-book').disabled = false;
  document.getElementById('btn-confirm-book').textContent = 'Confirm booking →';
  document.getElementById('modal-book').classList.add('open');
}

function closeBookModal() {
  document.getElementById('modal-book').classList.remove('open');
  selectedEventId = null;
}

// Envoi de la réservation à l'API
async function confirmBooking() {
  if (!selectedEventId) return;

  const btn = document.getElementById('btn-confirm-book');
  btn.disabled = true;
  btn.textContent = 'Booking…';

  try {
    const res = await fetch('/api/events/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId: selectedEventId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed.');

    closeBookModal();
    showToast('Ticket booked! Confirmation sent.');
    // Rafraîchit la liste pour mettre à jour les compteurs
    fetchEvents();
  } catch (err) {
    showToast(err.message, true);
    btn.disabled = false;
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
fetchEvents();