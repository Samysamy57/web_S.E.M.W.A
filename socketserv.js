import Conversation from './models/ConversationModel.js';
import Message from './models/messageModel.js';

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

    socket.on('join conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('private message', async (data) => {
      try {
        const { senderId, receiverId, content } = data;

        if (!senderId || !receiverId || !content) {
          socket.emit('message error', {
            error: 'senderId, receiverId et content sont requis'
          });
          return;
        }

        const result = await savePrivateMessage(senderId, receiverId, content);

        socket.join(result.conversationId);

        io.to(result.conversationId).emit('private message', {
          conversationId: result.conversationId,
          message: result.message
        });
      } catch (err) {
        console.error('Erreur private message:', err);
        socket.emit('message error', {
          error: 'Impossible d’envoyer le message'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}