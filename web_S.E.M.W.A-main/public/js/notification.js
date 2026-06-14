function formatNotificationTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function notificationIcon(type) {
  const icons = {
    new_message: 'MSG',
    event_update: 'EVT',
    admin_request: 'ADM',
    system: 'SYS'
  };

  return icons[type] || 'NEW';
}

function notificationLabel(type) {
  const labels = {
    new_message: 'Nouveau message',
    event_update: 'Evenement',
    admin_request: 'Administration',
    system: 'Systeme'
  };

  return labels[type] || 'Notification';
}

function buildNotification(notification) {
  const unreadClass = notification.is_read ? '' : ' active';
  const content = notification.content || '';
  const time = formatNotificationTime(notification.created_at);
  const link = notification.link || (notification.conversation_id ? `/conversation?id=${notification.conversation_id}` : '');

  return `
    <div class="msg-thread${unreadClass}" data-id="${notification.id}" data-link="${link}">
      <div class="thread-avatar" style="background:${notification.is_read ? '#64748B' : '#1B4FD8'}">${notificationIcon(notification.type)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="thread-name">${notification.title || notificationLabel(notification.type)}</div>
          <div class="thread-time">${time}</div>
        </div>
        <div class="thread-preview">${content}</div>
        <div class="thread-preview" style="font-size:.72rem;color:${notification.is_read ? 'var(--slate3)' : 'var(--blue)'}">
          ${notification.is_read ? 'Lue' : 'Non lue'} - ${notificationLabel(notification.type)}
        </div>
      </div>
    </div>
  `;
}

async function markAsRead(notificationId) {
  await fetch(`/api/messages/notification/${notificationId}/read`, {
    method: 'PATCH',
    credentials: 'include'
  });
}

async function loadNotifications() {
  const container = document.getElementById('notification-list');
  container.innerHTML = '<p style="padding:16px;font-size:.8rem;color:var(--slate3)">Chargement...</p>';

  try {
    const res = await fetch('/api/messages/notification', { credentials: 'include' });

    if (res.status === 401) {
      window.location.href = '/';
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const notifications = data.notifications || [];

    if (!notifications.length) {
      container.innerHTML = '<p style="padding:16px;font-size:.8rem;color:var(--slate3)">Aucune notification.</p>';
      return;
    }

    container.innerHTML = notifications.map(buildNotification).join('');

    container.querySelectorAll('.msg-thread').forEach(card => {
      card.addEventListener('click', async () => {
        await markAsRead(card.dataset.id);
        card.classList.remove('active');
        const link = card.dataset.link;
        if (link) window.location.href = link;
      });
    });
  } catch (err) {
    console.error('[notifications]', err);
    container.innerHTML = '<p style="padding:16px;font-size:.8rem;color:#DC2626">Erreur de chargement des notifications.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadNotifications);
