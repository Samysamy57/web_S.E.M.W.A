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

  // Bouton book → ouvre la modale de réservation
  document.getElementById('btn-book-ticket').onclick = () => openDetailBookModal(event);
}

// ─── INIT ─────────────────────────────────────────────
async function loadAnnouncements(eventId) {
  try {
    const res  = await fetch(`/api/events/${eventId}/announcements`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();

    if (!data.length) return;

    document.getElementById('event-announcements-section').style.display = 'block';
    document.getElementById('announcements-list').innerHTML = data.map(a => {
      const date = new Date(a.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      return `
        <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;padding:14px 16px">
          <p style="font-size:.88rem;color:#1E293B;line-height:1.6;margin-bottom:8px">${a.content}</p>
          <time style="font-size:.72rem;color:#92400E;font-weight:600">${date}</time>
          ${a.notify_future ? '<span style="margin-left:10px;font-size:.7rem;background:#FEF9C3;color:#B45309;padding:2px 8px;border-radius:99px;font-weight:700">📌 Pinned</span>' : ''}
        </div>`;
    }).join('');
  } catch (err) {
    console.error('[announcements]', err);
  }
}

async function init() {
  await loadEdUser();
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
    await loadAnnouncements(eventId); // charge les annonces après la page
  } catch (err) {
    document.querySelector('.detail-wrap').innerHTML =
      `<p style="color:red">⚠️ ${err.message}</p><button class="back-btn" onclick="history.back()">← Back</button>`;
  }
}

// ─── LOGIQUE MODALE RÉSERVATION (event_detail) ────────
let edCurrentUser   = null;
let edCurrentEvent  = null;

async function loadEdUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) edCurrentUser = await res.json();
  } catch (_) {}
}

function buildEdHolderForm(index) {
  const u         = edCurrentUser;
  const isFirst   = index === 0;
  const firstName = isFirst && u ? u.first_name : '';
  const lastName  = isFirst && u ? u.last_name  : '';
  const email     = isFirst && u ? u.email      : '';

  return `
    <div style="border:1.5px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:.78rem;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">
        Ticket ${index + 1}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px">
        <div>
          <label style="display:block;font-size:.8rem;font-weight:600;color:#334155;margin-bottom:6px">First name *</label>
          <input type="text" class="ed-holder-firstname" value="${firstName}"
                 style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:'Plus Jakarta Sans',sans-serif;font-size:.88rem;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:.8rem;font-weight:600;color:#334155;margin-bottom:6px">Last name *</label>
          <input type="text" class="ed-holder-lastname" value="${lastName}"
                 style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:'Plus Jakarta Sans',sans-serif;font-size:.88rem;outline:none">
        </div>
      </div>
      <label style="display:block;font-size:.8rem;font-weight:600;color:#334155;margin-bottom:6px">Email *</label>
      <input type="email" class="ed-holder-email" value="${email}"
             style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:'Plus Jakarta Sans',sans-serif;font-size:.88rem;outline:none">
    </div>`;
}

function updateEdHolderForms() {
  const qty       = parseInt(document.getElementById('ed-ticket-qty').value) || 1;
  const container = document.getElementById('ed-holders-container');
  container.innerHTML = '';
  for (let i = 0; i < qty; i++) container.innerHTML += buildEdHolderForm(i);
}

function openDetailBookModal(event) {
  edCurrentEvent = event;
  document.getElementById('ed-step-1').style.display = 'block';
  document.getElementById('ed-step-2').style.display = 'none';
  document.getElementById('ed-modal-title').textContent = event.title;
  document.getElementById('ed-ticket-qty').value = 1;

  // Affiche les types de tickets
  const tickets   = Array.isArray(event.ticket_types) ? event.ticket_types : [];
  const container = document.getElementById('ed-ticket-types');
  container.innerHTML = tickets.map((t, i) => `
    <div style="border:1.5px solid ${i === 0 ? '#1B4FD8' : '#E2E8F0'};border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:.2s;${i === 0 ? 'background:#EEF3FF' : ''}"
         class="ed-ticket-type ${i === 0 ? 'selected' : ''}"
         data-ticket-id="${t.id}" data-price="${t.price}"
         onclick="document.querySelectorAll('.ed-ticket-type').forEach(x=>{x.classList.remove('selected');x.style.borderColor='#E2E8F0';x.style.background=''});this.classList.add('selected');this.style.borderColor='#1B4FD8';this.style.background='#EEF3FF'">
      <div>
        <div style="font-weight:700;font-size:.88rem">${t.name}</div>
        ${t.description ? `<div style="font-size:.76rem;color:#64748B;margin-top:2px">${t.description}</div>` : ''}
      </div>
      <div style="font-family:'Fraunces',serif;font-size:1.2rem;font-weight:700;color:#1B4FD8">
        ${parseFloat(t.price) === 0 ? 'Free' : '€' + parseFloat(t.price).toFixed(0)}
      </div>
    </div>`).join('') || '<p style="color:#64748B;font-size:.85rem">No ticket types available.</p>';

  updateEdHolderForms();

  const btn = document.getElementById('ed-btn-confirm');
  btn.disabled    = false;
  btn.textContent = 'Confirm booking →';

  document.getElementById('modal-book').style.display = 'flex';
}

// Écoute la quantité
document.getElementById('ed-ticket-qty')?.addEventListener('input', updateEdHolderForms);

// Confirmation de la réservation
document.getElementById('ed-btn-confirm')?.addEventListener('click', async () => {
  const selectedEl   = document.querySelector('.ed-ticket-type.selected');
  const ticketTypeId = selectedEl?.dataset.ticketId || null;

  const firstNames = [...document.querySelectorAll('.ed-holder-firstname')].map(i => i.value.trim());
  const lastNames  = [...document.querySelectorAll('.ed-holder-lastname')].map(i => i.value.trim());
  const emails     = [...document.querySelectorAll('.ed-holder-email')].map(i => i.value.trim());

  if (firstNames.some(v => !v) || lastNames.some(v => !v) || emails.some(v => !v)) {
    alert('Please fill in all attendee fields.');
    return;
  }

  const tickets = firstNames.map((fn, i) => ({
    holder_first_name: fn,
    holder_last_name:  lastNames[i],
    holder_email:      emails[i],
  }));

  const btn = document.getElementById('ed-btn-confirm');
  btn.disabled    = true;
  btn.textContent = 'Processing…';

  try {
    const eventId = new URLSearchParams(window.location.search).get('id');
    const res     = await fetch('/api/events/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, ticketTypeId, tickets }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed.');

    if (data.type === 'paid') {
      window.location.href = data.stripeUrl;
    } else {
      // Affiche les QR codes
      document.getElementById('ed-step-1').style.display = 'none';
      document.getElementById('ed-step-2').style.display = 'block';

      document.getElementById('ed-success-zone').innerHTML = data.tickets.map(t => `
        <div style="border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:12px;text-align:center">
          <div style="font-weight:700;font-size:.9rem;margin-bottom:4px">${t.holder_first_name} ${t.holder_last_name}</div>
          <div style="font-size:.75rem;color:#64748B;margin-bottom:12px">${t.holder_email}</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${t.qr_code_secret}"
               alt="QR Code" style="border-radius:8px">
          <div style="font-size:.7rem;color:#94A3B8;margin-top:8px">Ticket ID: ${t.id}</div>
        </div>`).join('');
    }
  } catch (err) {
    alert(err.message);
    btn.disabled    = false;
    btn.textContent = 'Confirm booking →';
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

init();