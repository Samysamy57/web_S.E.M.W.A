// public/js/global-notifications.js
// Script global de notifications — inclus dans toutes les pages authentifiées.

(async function () {

  // ── 1. Récupère l'utilisateur connecté ──────────────────
  let currentUserId = null;
  let userRole = null;
  let user = null; // Déclaré ici pour être accessible dans toute l'IIFE

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return;
    user = await res.json(); // Assignation sans 'const' → portée correcte
    currentUserId = user.id;
    userRole = user.role;
  } catch (e) {
    return;
  }

  // Sécurité : si user est toujours null (erreur silencieuse), on stoppe
  if (!user) return;

  const nav = document.querySelector('.nav-bar');
  if (!nav) return;

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
  const avatarContent = user.avatar_url
    ? `<img src="${user.avatar_url}" style="width:34px;height:34px;border-radius:9px;object-fit:cover">`
    : initials;

  const profileHTML = `
    <div id="nav-user-container" style="display:flex;align-items:center;gap:10px;font-size:.85rem;color:var(--slate3);cursor:pointer;user-select:none;">
      <span id="nav-username">${user.first_name || user.email}</span>
      <div class="user-avatar" id="nav-avatar" style="width:34px;height:34px;border-radius:9px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;color:#fff;">
        ${avatarContent}
      </div>
    </div>
  `;

  const bellHTML = `
    <div class="notif-bell-wrapper" id="notif-bell-wrapper">
      <button class="notif-bell-btn" id="notif-bell-btn" title="Notifications">🔔</button>
      <span class="notif-badge" id="notif-badge">0</span>
      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-dropdown-header">Notifications</div>
        <div id="notif-list"><div class="notif-empty">Aucun nouveau message</div></div>
      </div>
    </div>
  `;

  // Injecte dans .nav-right si présent, sinon fallback dans la nav
  const navRight = nav.querySelector('.nav-right');
  const target   = navRight ?? nav;

  // Ancre = bouton Sign out → cloche + profil s'insèrent juste avant lui
  const anchor = target.querySelector('#btn-logout') || target.lastElementChild;

  // Ordre final : [My Tickets] [Cloche] [Profil] [Sign out]
  target.insertBefore(
    document.createRange().createContextualFragment(bellHTML),
    anchor
  );
  target.insertBefore(
    document.createRange().createContextualFragment(profileHTML),
    anchor
  );

  // Redirige vers /profile au clic sur le bloc profil
  document.getElementById('nav-user-container').addEventListener('click', () => {
    window.location.href = '/profile';
  });

  // Rend le logo cliquable et redirige selon le rôle
  const brand = document.querySelector('.nav-brand');
  if (brand) {
    brand.style.cursor = 'pointer';
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      if      (userRole === 'admin')     window.location.href = '/admin';
      else if (userRole === 'organizer') window.location.href = '/dashboard';
      else                               window.location.href = '/acceuil';
    });
  }

  const bellBtn    = document.getElementById('notif-bell-btn');
  const dropdown   = document.getElementById('notif-dropdown');
  const badge      = document.getElementById('notif-badge');
  const notifList  = document.getElementById('notif-list');

  // ── 3. Ouvre / ferme le dropdown ────────────────────────
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Ferme si clic ailleurs
  document.addEventListener('click', () => dropdown.classList.remove('open'));

  // ── 4. Met à jour le badge ───────────────────────────────
  let unreadCount = 0;

  function updateBadge(count) {
    unreadCount = count;
    badge.textContent = count;
    count > 0 ? badge.classList.add('visible') : badge.classList.remove('visible');
  }

  // ── 5. Construit un item de notification ─────────────────
  function buildNotifItem(notif) {
    const senderName = `${notif.sender_first_name || ''} ${notif.sender_last_name || ''}`.trim() || 'Quelqu\'un';
    const preview    = notif.last_message || notif.message?.content || '…';
    const convoId    = notif.conversation_id;

    const div = document.createElement('div');
    div.className = 'notif-item-row';
    div.innerHTML = `
      <div class="notif-item-sender">✉️ ${senderName}</div>
      <div class="notif-item-preview">${preview}</div>
    `;

    div.addEventListener('click', async () => {
      // Marque comme lu
      try {
        await fetch(`/api/messages/conversation/${convoId}/read`, {
          method: 'POST', credentials: 'include'
        });
      } catch (_) {}

      // Décrémente le badge
      updateBadge(Math.max(0, unreadCount - 1));
      div.remove();
      if (!notifList.querySelector('.notif-item-row')) {
        notifList.innerHTML = '<div class="notif-empty">Aucun nouveau message</div>';
      }

      // Redirige vers la messagerie avec l'ID de conversation
      if (userRole === 'organizer') {
        window.location.href = `/dashboard?section=messages&convoId=${convoId}`;
      } else {
        window.location.href = `/conversation?convoId=${convoId}`;
      }
    });

    return div;
  }

  // ── 6. Charge les notifications initiales ────────────────
  async function loadUnread() {
    try {
      const res  = await fetch('/api/messages/unread', { credentials: 'include' });
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) return;

      notifList.innerHTML = '';
      data.forEach(n => notifList.appendChild(buildNotifItem(n)));
      updateBadge(data.length);
    } catch (e) {
      console.error('[notifications] loadUnread:', e);
    }
  }

  await loadUnread();

  // ── 7. Socket.io — salon privé + temps réel ──────────────
  // Socket.io est chargé par la page hôte (ou on le charge ici en fallback)
  function initRealtimeNotifications() {
    const s = io();

    // Rejoint le salon privé de l'utilisateur
    s.emit('register user', currentUserId);

    // Écoute les annonces d'événements en temps réel
    s.on('event announcement', (data) => {
      // Toast visible sur toutes les pages
      const toastEl = document.getElementById('toast');
      if (toastEl) {
        document.getElementById('toast-msg').textContent =
          `📢 ${data.eventTitle}: ${data.content}`;
        const ico = toastEl.querySelector('.toast-icon');
        if (ico) { ico.textContent = '📢'; ico.style.background = '#D97706'; }
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 5000);
      } else {
        // Fallback si la page n'a pas de toast (ex: event_detail)
        alert(`📢 Announcement for "${data.eventTitle}": ${data.content}`);
      }
    });

    // Reçoit une notification en temps réel
    s.on('new message notification', (data) => {
      // Évite les doublons si on est déjà sur la page de messagerie avec cette convo ouverte
      const currentConvoParam = new URLSearchParams(window.location.search).get('convoId');
      if (currentConvoParam === data.conversationId) return;

      // Ajoute l'item en tête de liste
      const notif = {
        conversation_id:    data.conversationId,
        last_message:       data.message?.content,
        sender_first_name:  data.message?.sender_first_name || '',
        sender_last_name:   data.message?.sender_last_name  || '',
      };

      if (notifList.querySelector('.notif-empty')) notifList.innerHTML = '';
      notifList.prepend(buildNotifItem(notif));
      updateBadge(unreadCount + 1);
    });
  }

  // Socket.io est disponible si la page a chargé /socket.io/socket.io.js
  if (typeof io !== 'undefined') {
    initRealtimeNotifications();
  }

})();