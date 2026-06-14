const socket = io();

let currentConversationId = null;
let currentUserId = null;
let currentReceiverId = null;

// ── Helpers UI ──────────────────────────────────────────

function getInitials(firstName, email) {
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return (email || '?').slice(0, 2).toUpperCase();
}

// Couleurs d'avatar déterministes selon l'ID
const COLORS = ['#7C3AED','#0D9488','#D97706','#1B4FD8','#DC2626','#059669'];
function avatarColor(id) {
  if (!id) return '#64748B';
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[hash % COLORS.length];
}

function showChatZone(show) {
  document.getElementById('msg-header').style.display         = show ? 'flex'  : 'none';
  document.getElementById('msg-body').style.display           = show ? 'flex'  : 'none';
  document.getElementById('msg-input-row').style.display      = show ? 'flex'  : 'none';
  document.getElementById('no-convo-placeholder').style.display = show ? 'none' : 'flex';
}

// ── Chargement user connecté ─────────────────────────────

async function loadCurrentUser() {
  const res  = await fetch('/api/messages', { credentials: 'include' });
  const data = await res.json();
  currentUserId = data.userId;
}

function updateThreadPreview(conversationId, content) {
  const card = document.querySelector(`.msg-thread[data-id="${conversationId}"]`);
  if (!card) return;
  const preview = card.querySelector('.thread-preview');
  const time    = card.querySelector('.thread-time');
  if (preview) preview.textContent = content;
  if (time)    time.textContent    = now();
  // Remonte la conversation en tête de liste
  const list = document.getElementById('conversation-list');
  list.prepend(card);
}

async function loadConversations() {
  const container = document.getElementById('conversation-list');
  const res  = await fetch('/api/messages/conversations', { credentials: 'include' });
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p style="padding:16px;font-size:.8rem;color:var(--slate3)">Aucune conversation.</p>';
    return;
  }

  container.innerHTML = data.map(conv => {
    const isSupport = conv.title === 'SUPPORT';
    const name      = isSupport ? 'Support Équipe' : (conv.first_name ? `${conv.first_name} ${conv.last_name || ''}`.trim() : (conv.email || 'Utilisateur'));
    const initials  = isSupport ? '🎧' : getInitials(conv.first_name, conv.email);
    const color     = isSupport ? '#64748B' : avatarColor(conv.other_user_id);
    const preview  = conv.last_message || '';

    const timeStr = conv.last_message_created_at ? formatTime(conv.last_message_created_at) : '';

    return `
      <div class="msg-thread"
           data-id="${conv.conversation_id}"
           data-other-user-id="${conv.other_user_id || ''}">
        <div class="thread-avatar" style="background:${color}">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
            <div class="thread-name">${name}</div>
            <div class="thread-time">${timeStr}</div>
          </div>
          <div class="thread-preview">${preview}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.msg-thread').forEach(card => {
    card.addEventListener('click', () => {
      selectConversation(card.dataset.id, card.dataset.otherUserId);
    });
  });
}

// ── Sélection d'une conversation ─────────────────────────

function selectConversation(conversationId, receiverId) {
  currentConversationId = conversationId;
  currentReceiverId     = receiverId;

  // Mise à jour visuelle sidebar
  document.querySelectorAll('.msg-thread').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.msg-thread[data-id="${conversationId}"]`);
  if (card) {
    card.classList.add('active');
    const name    = card.querySelector('.thread-name')?.textContent || '—';
    const initials = card.querySelector('.thread-avatar')?.textContent || '?';
    const color    = card.querySelector('.thread-avatar')?.style.background || 'var(--blue)';
    document.getElementById('chat-avatar').textContent         = initials;
    document.getElementById('chat-avatar').style.background   = color;
    document.getElementById('chat-name').textContent           = name;
    document.getElementById('chat-sub').textContent            = '';
    card.querySelector('.thread-unread')?.remove();
  }

  document.getElementById('send-btn').disabled = false;
  showChatZone(true);

  socket.emit('join conversation', conversationId);
  loadMessages(conversationId);
}

// ── Chargement des messages ──────────────────────────────

async function loadMessages(conversationId) {
  const res      = await fetch(`/api/messages/conversation/${conversationId}`, { credentials: 'include' });
  const messages = await res.json();
  const container = document.getElementById('msg-body');

  container.innerHTML = messages.map(msg =>
    buildBubble(msg.content, msg.sender_id === currentUserId, formatTime(msg.created_at), msg)
  ).join('');
  container.scrollTop = container.scrollHeight;
}

// ── Construction d'une bulle ─────────────────────────────

function buildBubble(content, isOwn, timeStr, msg) {
  const wrapClass   = isOwn ? 'bubble-wrap own' : 'bubble-wrap';
  const bubbleClass = isOwn ? 'bubble own'       : 'bubble other';
  const time        = timeStr || now();

  // Anonymise les admins côté utilisateur : affiche "🎧 Support"
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
        <div class="bubble-time ${isOwn ? '' : 'other'}">${time}</div>
      </div>
    </div>
  `;
}

// ── Envoi message ────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(isoString) {
  if (!isoString) return now();
  const d = new Date(isoString);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const sendBtn = document.getElementById('send-btn');
sendBtn.disabled = true;

function sendMessage() {
  const input   = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !currentConversationId || !currentReceiverId) return;

  socket.emit('private message', {
    senderId:   currentUserId,
    receiverId: currentReceiverId,
    content
  });

  updateThreadPreview(currentConversationId, content);
  input.value = '';
}

sendBtn.addEventListener('click', sendMessage);

document.getElementById('msg-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// ── Réception message socket ─────────────────────────────

socket.on('private message', (data) => {
  if (data.conversationId !== currentConversationId) return;

  const container = document.getElementById('msg-body');
  const senderId  = data.message?.sender_id || data.message?.senderId;
  const isOwn     = senderId === currentUserId;

  container.insertAdjacentHTML('beforeend', buildBubble(data.message.content, isOwn, now(), data.message));
  updateThreadPreview(data.conversationId, data.message.content);
  container.scrollTop = container.scrollHeight;
});

// ── Créer une nouvelle conversation ─────────────────────

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

// ── Init ─────────────────────────────────────────────────

async function init() {
  showChatZone(false);
  await loadCurrentUser();
  await loadConversations();

  // Si redirigé depuis la cloche, ouvre directement la conversation ciblée
  const params = new URLSearchParams(window.location.search);
  const targetConvoId = params.get('convoId');
  if (targetConvoId) {
    // Cherche le card dans la liste et l'ouvre
    const card = document.querySelector(`.msg-thread[data-id="${targetConvoId}"]`);
    if (card) {
      selectConversation(targetConvoId, card.dataset.otherUserId);
    }
  }
}

init();