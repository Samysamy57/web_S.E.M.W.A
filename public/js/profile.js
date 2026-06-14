// public/js/profile.js
// Dynamise la page profil : récupère l'utilisateur et ses billets via l'API.

document.addEventListener('DOMContentLoaded', async () => {

  // ── Déconnexion ──────────────────────────────────────────
  const logoutHandler = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };
  document.getElementById('btn-logout')?.addEventListener('click', logoutHandler);
  document.getElementById('btn-logout-card')?.addEventListener('click', logoutHandler);

  // ── 1. Récupère les données de l'utilisateur connecté ────
  let user;
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return window.location.href = '/';
    user = await res.json();
  } catch (e) {
    console.error('[profile] /api/auth/me:', e);
    return;
  }

  // ── 2. Hydrate la carte identité ─────────────────────────
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';

  document.getElementById('profile-name').textContent = fullName;

  // Avatar : image ou initiales
  const avatarEl = document.getElementById('profile-avatar');
  if (user.avatar_url) {
    avatarEl.innerHTML = `<img src="${user.avatar_url}" style="width:80px;height:80px;border-radius:12px;object-fit:cover">`;
  } else {
    avatarEl.textContent = initials;
  }

  // Rôle affiché joliment
  const roleLabel = user.role === 'organizer' ? '🎤 Organizer' : '🎟 Participant';
  document.getElementById('meta-role').textContent  = roleLabel;
  document.getElementById('info-role').textContent  = roleLabel;
  document.getElementById('info-email').textContent = user.email;

  // Date d'inscription
  if (user.created_at) {
    const since = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('meta-since').textContent  = `📅 Member since ${since}`;
    document.getElementById('info-since').textContent  = since;
  }

  document.getElementById('meta-email').textContent = `✉️ ${user.email}`;

  // Bio (si le champ existe en BDD, sinon on laisse vide)
  if (user.bio) {
    document.getElementById('profile-bio').textContent = user.bio;
  }

  // ── 3. Câble le bouton Edit profile ──────────────────────
  document.getElementById('btn-edit-profile')?.addEventListener('click', () => openEditModal(user));

  // Stats organisateur (section cachée pour les participants)
  if (user.role === 'organizer') {
    document.getElementById('stat-row').style.display = 'grid';
    loadOrganizerStats();
  }

  // ── 3. Récupère et affiche les billets à venir ───────────
  await loadUpcomingTickets();
});

// ── Modale édition profil ────────────────────────────────────

function openEditModal(user) {
  // Pré-remplit les champs avec les valeurs actuelles
  document.getElementById('edit-first-name').value = user.first_name || '';
  document.getElementById('edit-last-name').value  = user.last_name  || '';
  document.getElementById('edit-bio').value        = user.bio        || '';
  document.getElementById('edit-avatar-url').value = user.avatar_url || '';
  refreshAvatarPreview(user.avatar_url, user.first_name, user.last_name);

  document.getElementById('modal-edit-profile').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('modal-edit-profile').style.display = 'none';
}

// Aperçu de l'avatar en temps réel
function refreshAvatarPreview(url, firstName, lastName) {
  const preview = document.getElementById('edit-avatar-preview');
  if (url) {
    preview.innerHTML = `<img src="${url}" style="width:56px;height:56px;object-fit:cover">`;
  } else {
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
    preview.textContent = initials;
    preview.style.background = 'var(--blue)';
  }
}

document.getElementById('btn-close-edit-profile')?.addEventListener('click', closeEditModal);
document.getElementById('btn-cancel-edit-profile')?.addEventListener('click', closeEditModal);

// Mise à jour de l'aperçu quand l'URL change
document.getElementById('edit-avatar-url')?.addEventListener('input', (e) => {
  const fn = document.getElementById('edit-first-name').value;
  const ln = document.getElementById('edit-last-name').value;
  refreshAvatarPreview(e.target.value, fn, ln);
});

// Soumission du formulaire
document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
  const firstName = document.getElementById('edit-first-name').value.trim();
  const lastName  = document.getElementById('edit-last-name').value.trim();
  const avatarUrl = document.getElementById('edit-avatar-url').value.trim() || null;
  const bio       = document.getElementById('edit-bio').value.trim() || null;

  if (!firstName || !lastName) {
    showToast('First name and last name are required.');
    return;
  }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, avatarUrl, bio }),
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Update failed.');
      return;
    }

    const updated = await res.json();

    // Rafraîchit la page sans rechargement
    document.getElementById('profile-name').textContent = `${updated.first_name} ${updated.last_name}`.trim();
    document.getElementById('profile-bio').textContent  = updated.bio || '';

    const avatarEl = document.getElementById('profile-avatar');
    if (updated.avatar_url) {
      avatarEl.innerHTML = `<img src="${updated.avatar_url}" style="width:80px;height:80px;border-radius:12px;object-fit:cover">`;
    } else {
      avatarEl.textContent = `${updated.first_name?.[0] || ''}${updated.last_name?.[0] || ''}`.toUpperCase() || '?';
    }

    // Met aussi à jour l'avatar dans le header (injecté par global-notifications.js)
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) {
      navAvatar.innerHTML = updated.avatar_url
        ? `<img src="${updated.avatar_url}" style="width:34px;height:34px;border-radius:9px;object-fit:cover">`
        : `${updated.first_name?.[0] || ''}${updated.last_name?.[0] || ''}`.toUpperCase() || '?';
    }
    const navUsername = document.getElementById('nav-username');
    if (navUsername) navUsername.textContent = updated.first_name || updated.email;

    closeEditModal();
    showToast('Profile updated successfully!');

  } catch (e) {
    console.error('[profile] updateProfile:', e);
    showToast('An error occurred. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
});

// Charge les billets et filtre ceux dont l'événement est futur et le statut actif
async function loadUpcomingTickets() {
  const container = document.getElementById('upcoming-tickets-list');

  try {
    const res = await fetch('/api/tickets', { credentials: 'include' });
    if (!res.ok) throw new Error('tickets fetch failed');
    const tickets = await res.json();

    const now = new Date();

    // Garde uniquement les billets "registered" dont l'événement n'est pas encore passé
    const upcoming = tickets.filter(t => {
      const isActive  = t.status === 'registered';
      const isFuture  = t.event_date ? new Date(t.event_date) > now : true;
      return isActive && isFuture;
    });

    if (upcoming.length === 0) {
      container.innerHTML = `<div class="card-empty">No upcoming events.<br><a href="/acceuil" style="color:var(--blue);font-weight:600">Browse events →</a></div>`;
      return;
    }

    // Génère une ligne par billet (max 4 pour ne pas saturer la card)
    container.innerHTML = '';
    upcoming.slice(0, 4).forEach(t => {
      const dateStr = t.event_date
        ? new Date(t.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      const location = t.event_location || 'Location TBA';
      const ticketType = t.ticket_type_name || 'Standard';

      const row = document.createElement('div');
      row.className = 'ticket-row';
      row.innerHTML = `
        <div class="ticket-thumb" style="background:var(--blue-l)">🎟</div>
        <div style="flex:1">
          <div style="font-size:.84rem;font-weight:700">${escHtml(t.event_title || 'Event')}</div>
          <div style="font-size:.75rem;color:var(--slate3)">${dateStr} · ${escHtml(location)} · ${escHtml(ticketType)}</div>
        </div>
        <span class="status-badge" style="background:#DCFCE7;color:#16A34A">Confirmed</span>
      `;

      // Clic → page de détail de l'événement
      row.addEventListener('click', () => {
        if (t.event_id) window.location.href = `/event-detail?id=${t.event_id}`;
      });

      container.appendChild(row);
    });

  } catch (e) {
    console.error('[profile] tickets:', e);
    container.innerHTML = `<div class="card-empty">Could not load tickets.</div>`;
  }
}

// Charge des statistiques basiques pour les organisateurs via l'API dashboard
async function loadOrganizerStats() {
  try {
    const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
    if (!res.ok) return;
    const stats = await res.json();

    if (stats.total_events   != null) document.getElementById('stat-events').textContent  = stats.total_events;
    if (stats.tickets_sold   != null) document.getElementById('stat-tickets').textContent = stats.tickets_sold;
    if (stats.total_revenue  != null) {
      const rev = parseFloat(stats.total_revenue);
      document.getElementById('stat-revenue').textContent = `€${rev.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}`;
    }
  } catch (e) {
    // Stats non critiques : on ignore silencieusement
  }
}

// Échappe le HTML pour éviter les injections XSS
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Toast léger (sans dépendre de global-notifications)
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}