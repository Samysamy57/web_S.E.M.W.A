import Conversation from './models/ConversationModel.js';
import Message from './models/messageModel.js';
import pool from './config/db.js';

// Récupère tous les event_ids actifs d'un utilisateur (inscrit ou présent)
async function getRegisteredEventIds(userId) {
  const { rows } = await pool.query(
    `SELECT event_id FROM event_participants
     WHERE user_id = $1 AND status IN ('registered', 'attended')`,
    [userId]
  );
  return rows.map(r => r.event_id);
}

async function savePrivateMessage(senderId, receiverId, content) {
  const conversation = await Conversation.getOrCreatePrivateConversation(
    senderId,
    receiverId
  );

  const message = await Message.create({
    conversationId: conversation.id,
    senderId,
    content,
    messageType: 'text'
  });

  return {
    conversationId: conversation.id,
    message
  };
}

export default function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Le client envoie son userId pour rejoindre son salon privé
    socket.on('register user', async (userId) => {
      if (!userId) return;
      socket.join(userId);
      console.log(`Socket ${socket.id} registered in private room: ${userId}`);

      // Rejoint automatiquement les rooms de chaque event auquel l'utilisateur est inscrit
      try {
        const eventIds = await getRegisteredEventIds(userId);
        eventIds.forEach(eventId => {
          socket.join('event_' + eventId);
        });
        console.log(`Socket ${socket.id} joined ${eventIds.length} event room(s)`);
      } catch (err) {
        console.error('[socket] getRegisteredEventIds:', err);
      }
    });

    // Permet à un utilisateur de rejoindre manuellement une room (ex: juste après inscription)
    socket.on('join event room', (eventId) => {
      if (eventId) {
        socket.join('event_' + eventId);
        console.log(`Socket ${socket.id} manually joined event room: event_${eventId}`);
      }
    });

    socket.on('join conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('private message', async (data) => {
  try {
    const { senderId, receiverId, content, useSupport } = data;

    if (!senderId || !receiverId || !content) {
      socket.emit('message error', { error: 'senderId, receiverId et content sont requis' });
      return;
    }

    // Si l'admin envoie via le support, on substitue l'expéditeur
    const effectiveSenderId = (useSupport && global.supportUserId)
      ? global.supportUserId
      : senderId;

    const result = await savePrivateMessage(effectiveSenderId, receiverId, content);

    // Enrichit le message avec sent_by AVANT d'émettre
    const outMessage = { ...result.message, sender_id: effectiveSenderId };

    if (useSupport && global.supportUserId) {
      await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [result.conversationId, global.supportUserId]
      );
      await pool.query(
        `UPDATE messages SET sent_by = $1 WHERE id = $2`,
        [senderId, result.message.id]
      );
      // sent_by = vrai auteur admin, disponible immédiatement dans le payload
      // Récupère le vrai nom de l'admin auteur pour l'affichage côté autres admins
      const { rows: authorRows } = await pool.query(
        `SELECT first_name, last_name FROM users WHERE id = $1`,
        [senderId]
      );
      outMessage.sent_by           = senderId;
      outMessage.sent_by_first_name = authorRows[0]?.first_name ?? '';
      outMessage.sent_by_last_name  = authorRows[0]?.last_name  ?? '';
    }

    socket.join(result.conversationId);

    io.to(result.conversationId).emit('private message', {
      conversationId: result.conversationId,
      message: outMessage
    });

    io.to(receiverId).emit('new message notification', {
      conversationId: result.conversationId,
      message: outMessage,
      senderId: effectiveSenderId
    });

  } catch (err) {
    console.error('Erreur private message:', err);
    socket.emit('message error', { error: "Impossible d'envoyer le message" });
  }
});

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}