import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import Conversation from '../models/ConversationModel.js';
import Message from '../models/messageModel.js';
import Notification from '../models/notificationModel.js';


const router = express.Router();

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

    const conversation = await Conversation.getOrCreatePrivateConversation(userId, receiverId);
    res.json({ conversationId: conversation.id });
  } catch (err) {
    console.error('[POST /create]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/notification', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(400).json({ error: 'User ID manquant' });

    const notifications = await Notification.getAllByUserId(userId);
    const unreadCount = await Notification.countUnreadByUserId(userId);

    res.json({ unreadCount, notifications });
  } catch (err) {
    console.error('[GET /notification]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/notification/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.markAsRead(req.params.id, req.user.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    console.error('[PATCH /notification/:id/read]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/notification/read-all', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read', notifications });
  } catch (err) {
    console.error('[PATCH /notification/read-all]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
