const socket = io();

let currentConversationId = null;
let currentUserId = null;
let currentReceiverId = null;

// récupérer user connecté
async function loadCurrentUser() {
  console.log('loadCurrentUser()');

  const res = await fetch('/api/messages', {
    credentials: 'include'
  });

  const data = await res.json();

  currentUserId = data.userId;
  console.log('currentUserId:', currentUserId);
}

// charger conversations
async function loadConversations() {
  console.log('loadConversations()');

  const container = document.getElementById('conversation-list');

  const res = await fetch('/api/messages/conversations', {
    credentials: 'include'
  });

  const data = await res.json();
  console.log('conversations:', data);

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p>Aucune conversation.</p>';
    return;
  }

  container.innerHTML = data.map(conv => `
    <div 
      class="conversation-card"
      data-id="${conv.conversation_id}"
      data-other-user-id="${conv.other_user_id || ''}"
    >
      <strong>${conv.first_name || conv.email || 'Utilisateur'}</strong>
      <p>${conv.last_message || ''}</p>
    </div>
  `).join('');

  const cards = document.querySelectorAll('.conversation-card');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      selectConversation(card.dataset.id, card.dataset.otherUserId);
    });
  });

  // auto sélection première conversation
 
}

// sélection conversation
function selectConversation(conversationId, receiverId) {
  currentConversationId = conversationId;
  currentReceiverId = receiverId;

  console.log('conversation sélectionnée:', {
    currentConversationId,
    currentReceiverId
  });

  // enlever la sélection visuelle des anciennes conversations
  document.querySelectorAll('.conversation-card').forEach(card => {
    card.classList.remove('active');
  });

  // ajouter la sélection visuelle à la conversation cliquée
  const selectedCard = document.querySelector(
    `.conversation-card[data-id="${conversationId}"]`
  );

  if (selectedCard) {
    selectedCard.classList.add('active');
  }

  document.getElementById('send-btn').disabled = false;

  socket.emit('join conversation', currentConversationId);

  loadMessages(currentConversationId);
}

// charger messages
async function loadMessages(conversationId) {
  console.log('loadMessages()', conversationId);

  const res = await fetch(`/api/messages/conversation/${conversationId}`, {
    credentials: 'include'
  });

  const messages = await res.json();
  console.log('messages reçus:', messages);

  const container = document.getElementById('messages');

  container.innerHTML = messages.map(msg => `
    <div class="message ${msg.sender_id === currentUserId ? 'me' : 'other'}">
      ${msg.content}
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

// envoyer message
const sendBtn = document.getElementById('send-btn');
sendBtn.disabled = true;

sendBtn.addEventListener('click', () => {
  console.log('click send');

  const input = document.getElementById('message-input');
  const content = input.value.trim();

  console.log('contenu message:', content);

  if (!content || !currentConversationId) {
    console.error('conversation non sélectionnée');
    return;
  }

  if (!currentReceiverId) {
    console.error('receiverId manquant');
    return;
  }

  console.log('envoi message socket:', {
    senderId: currentUserId,
    receiverId: currentReceiverId,
    content
  });

  socket.emit('private message', {
    senderId: currentUserId,
    receiverId: currentReceiverId,
    content
  });

  input.value = '';
});

// recevoir message socket
socket.on('private message', (data) => {
  console.log('message reçu socket:', data);

  if (data.conversationId !== currentConversationId) return;

  const container = document.getElementById('messages');

  const div = document.createElement('div');
  const senderId = data.message.sender_id || data.message.senderId;

  div.className = `message ${senderId === currentUserId ? 'me' : 'other'}`;
  div.textContent = data.message.content;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
});

// créer conversation
document.getElementById('create-convo-btn').addEventListener('click', async () => {
  console.log('click create conversation');

  const receiverId = document.getElementById('receiver-id').value.trim();

  if (!receiverId) return;

  const res = await fetch('/api/messages/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ receiverId })
  });

  const data = await res.json();
  console.log('conversation créée:', data);

  selectConversation(data.conversationId, receiverId);

  await loadConversations();
});

// init
async function init() {
  console.log('INIT');

  await loadCurrentUser();
  await loadConversations();
}

init();