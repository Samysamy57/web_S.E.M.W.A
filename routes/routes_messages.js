
import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import Conversation from '../models/ConversationModel.js';
import Message from '../models/messageModel.js';

const router = express.Router();
console.log('routes_messages chargé');

// user connecté
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.userId;
    console.log('User connecté:', userId);

    res.json({ userId });
  } catch (err) {
    console.error('[GET /]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// liste des conversations
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID manquant' });
    }

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

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID manquant' });
    }

    const messages = await Message.getByConversationId(conversationId);

    res.json(messages);
  } catch (err) {
    console.error('[GET /conversation/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { receiverId } = req.body;

    console.log('User ID:', userId);
    console.log('Receiver ID:', receiverId);

    if (!userId || !receiverId) {
      return res.status(400).json({ error: 'userId ou receiverId manquant' });
    }

    const conversation = await Conversation.getOrCreatePrivateConversation(
      userId,
      receiverId
    );

    res.json({ conversationId: conversation.id });
  } catch (err) {
    console.error('[POST /create]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;