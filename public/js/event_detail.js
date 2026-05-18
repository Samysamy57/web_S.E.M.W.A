// Fichier : public/js/event_detail.js

// Couleurs de bannière par catégorie (cohérent avec acceuil.js)
const CATEGORY_STYLE = {
  tech:        { gradient: 'linear-gradient(135deg,#1B4FD8,#0D9488)', emoji: '💻' },
  music:       { gradient: 'linear-gradient(135deg,#7C3AED,#EC4899)', emoji: '🎵' },
  workshops:   { gradient: 'linear-gradient(135deg,#0D9488,#059669)', emoji: '📚' },
  conferences: { gradient: 'linear-gradient(135deg,#F59E0B,#EF4444)', emoji: '🎤' },
  arts:        { gradient: 'linear-gradient(135deg,#EC4899,#8B5CF6)', emoji: '🎨' },
  sports:      { gradient: 'linear-gradient(135deg,#16A34A,#0D9488)', emoji: '🏃' },
  food:        { gradient: 'linear-gradient(135deg,#D97706,#EF4444)', emoji: '🍽' },
  default:     { gradient: 'linear-gradient(135deg,#334155,#1E293B)', emoji: '📅' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Sélection d'un ticket (highlight)
function selectTicket(el) {
  document.querySelectorAll('.ticket-type').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
}

// Injecte toutes les données dans le DOM
function populatePage(event) {
  const cat   = (event.category || 'default').toLowerCase();
  const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE.default;

  // Bannière
  const banner = document.getElementById('detail-banner');
  if (event.cover_image_url) {
    banner.style.background = `url('${event.cover_image_url}') center/cover no-repeat`;
    document.getElementById('detail-emoji').style.display = 'none';
  } else {
    banner.style.background = style.gradient;
    document.getElementById('detail-emoji').textContent = style.emoji;
  }

  // Tags catégorie
  const catsEl = document.getElementById('detail-cats');
  catsEl.innerHTML = `
    <span class="tag" style="background:var(--blue-l);color:var(--blue);font-size:.75rem;padding:5px 12px">${event.category || 'Event'}</span>
    ${event.status ? `<span class="tag" style="background:#F0FDF4;color:#16A34A;font-size:.75rem;padding:5px 12px">${event.status}</span>` : ''}
  `;

  // Titre & description
  document.getElementById('detail-title').textContent = event.title;
  document.getElementById('detail-description').textContent = event.description || 'No description provided.';

  // Métadonnées
  document.getElementById('meta-date').innerHTML =
    `📅 <strong>${formatDate(event.start_date)}${event.end_date ? ' → ' + formatDate(event.end_date) : ''}</strong>`;
  document.getElementById('meta-location').innerHTML =
    `📍 <strong>${event.location || event.city || '—'}</strong>`;

  const registered = parseInt(event.registered_count) || 0;
  const max = event.max_participants;
  document.getElementById('meta-participants').innerHTML =
    `👥 <strong>${registered}${max ? ' / ' + max : ''} registered</strong>`;

  // Étoiles — masquées si pas de note
  const avgRating = parseFloat(event.avg_rating);
  if (avgRating && avgRating > 0) {
    document.getElementById('meta-rating').style.display = 'flex';
    document.getElementById('rating-text').textContent =
      `${avgRating.toFixed(1)} (${event.review_count} review${event.review_count > 1 ? 's' : ''})`;
  }

  // Tickets dans la sidebar (prix de départ)
  const tickets = Array.isArray(event.ticket_types) ? event.ticket_types : [];
  const prices  = tickets.map(t => parseFloat(t.price)).filter(p => !isNaN(p));
  const minPrice = prices.length ? Math.min(...prices) : null;

  document.getElementById('sidebar-price').textContent =
    minPrice !== null ? (minPrice === 0 ? 'Free' : `€${minPrice.toFixed(0)}`) : '—';

  // Jauge de capacité
  if (max) {
    const pct = Math.min(Math.round((registered / max) * 100), 100);
    document.getElementById('capacity-fill').style.width = pct + '%';
    const left = max - registered;
    document.getElementById('capacity-note').textContent =
      `${registered} of ${max} seats taken${left > 0 ? ` — only ${left} left!` : ' — Full'}`;
  } else {
    document.getElementById('capacity-note').textContent = `${registered} registered`;
  }

  // Tickets dans la section principale
  const container = document.getElementById('ticket-types-container');
  if (tickets.length === 0) {
    container.innerHTML = `<p style="color:var(--slate3);font-size:.85rem">No ticket types defined.</p>`;
  } else {
    container.innerHTML = tickets.map((t, i) => `
      <div class="ticket-type ${i === 0 ? 'selected' : ''}" onclick="selectTicket(this)">
        <div>
          <div class="ticket-name">${t.name}</div>
          ${t.description ? `<div class="ticket-desc">${t.description}</div>` : ''}
        </div>
        <div class="ticket-price">${parseFloat(t.price) === 0 ? 'Free' : '€' + parseFloat(t.price).toFixed(0)}</div>
      </div>
    `).join('');
  }

  // Organisateur
  const initials = `${(event.first_name || '?')[0]}${(event.last_name || '')[0] || ''}`.toUpperCase();
  const avatarEl = document.getElementById('org-avatar');
  if (event.avatar_url) {
    avatarEl.innerHTML = `<img src="${event.avatar_url}" alt="avatar" />`;
  } else {
    avatarEl.textContent = initials;
  }
  document.getElementById('org-name').textContent = `${event.first_name || ''} ${event.last_name || ''}`.trim() || '—';
  document.getElementById('org-meta').textContent = 'Organizer';

  // Lien OpenStreetMap
  const query = encodeURIComponent(event.location || event.city || '');
  document.getElementById('map-link').onclick = () =>
    window.open(`https://www.openstreetmap.org/search?query=${query}`, '_blank');
  document.getElementById('location-text').innerHTML =
    `${event.location || ''}${event.city ? '<br>' + event.city : ''}`;

  // Bouton book → redirige vers acceuil avec modale (ou adapter selon le flow)
  document.getElementById('btn-book-ticket').onclick = () => {
    window.location.href = `/acceuil`;
  };
}

// ─── INIT ─────────────────────────────────────────────
async function init() {
  // Récupère l'ID dans l'URL (?id=xxx)
  const eventId = new URLSearchParams(window.location.search).get('id');
  if (!eventId) {
    document.querySelector('.detail-wrap').innerHTML =
      `<p style="color:var(--slate3)">No event ID provided.</p>`;
    return;
  }

  try {
    const res  = await fetch(`/api/events/${eventId}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Event not found.');
    populatePage(data);
  } catch (err) {
    document.querySelector('.detail-wrap').innerHTML =
      `<p style="color:red">⚠️ ${err.message}</p><button class="back-btn" onclick="history.back()">← Back</button>`;
  }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

init();