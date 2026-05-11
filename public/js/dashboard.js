// Fichier : public/js/dashboard.js

// ── Helpers ──────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
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

// ── Fetch avec gestion d'erreur centralisée ───────────────
async function apiFetch(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401) {
    // Session expirée → retour login
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
    document.getElementById('kpi-revenue').textContent =
      '€' + Number(data.totalRevenue).toLocaleString('fr-FR', { minimumFractionDigits: 0 });
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

      // Date lisible
      const date = ev.start_date
        ? new Date(ev.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : '–';

      // Couleur de la barre de progression selon le remplissage
      const barColor = pct >= 80 ? 'var(--amber)' : pct >= 50 ? 'var(--blue)' : 'var(--teal)';

      return `
        <div class="event-row" onclick="window.location.href='/result?id=${ev.id}'">
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
              ${max ? `
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%;background:${barColor}"></div>
                </div>` : ''}
            </div>
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
    document.getElementById('dash-greeting').textContent  =
      `${getGreeting()}, ${user.first_name} 👋`;
  } catch (err) {
    console.error('[user]', err);
  }
}

// ── Sign out ──────────────────────────────────────────────
document.getElementById('btn-signout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/';
  }
});

// ── Init ──────────────────────────────────────────────────
async function init() {
  // Charge en parallèle pour optimiser le temps de chargement
  await Promise.all([loadUser(), loadStats(), loadEvents()]);
}

document.addEventListener('DOMContentLoaded', init);