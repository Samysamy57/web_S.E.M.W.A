import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import Conversation from '../models/ConversationModel.js';
import Message from '../models/messageModel.js';
import { getUnreadNotifications, markConversationAsRead } from '../controllers/messageController.js';

const router = express.Router();

// Notifications : messages non lus
router.get('/unread', requireAuth, getUnreadNotifications);

// Marquer une conversation comme lue
router.post('/conversation/:id/read', requireAuth, markConversationAsRead);

// user connecté
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    res.json({ userId });
  } catch (err) {
    console.error('[GET /]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// liste des conversations
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(400).json({ error: 'User ID manquant' });

    const conversations = await Conversation.getUserConversations(userId);
    res.json(conversations);
  } catch (err) {
    console.error('[GET /conversations]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// messages d'une conversation précise
router.get('/conversation/:id', requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID manquant' });

    const messages = await Message.getByConversationId(conversationId);
    res.json(messages);
  } catch (err) {
    console.error('[GET /conversation/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// créer ou récupérer une conversation privée
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { receiverId } = req.body;

    if (!userId || !receiverId) {
      return res.status(400).json({ error: 'userId ou receiverId manquant' });
    }

    // Empêche de créer une conversation avec soi-même
    if (userId === receiverId) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself.' });
    }

    const conversation = await Conversation.getOrCreatePrivateConversation(userId, receiverId);
    res.json({ conversationId: conversation.id });
  } catch (err) {
    console.error('[POST /create]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;