import Conversation from '../models/ConversationModel.js';

export async function getMyConversations(req, res) {
  try {
    const userId = req.user.userId;
    const conversations = await Conversation.getUserConversations(userId);
    res.json(conversations);
  } catch (err) {
    console.error('[getMyConversations]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Retourne les notifications (messages non lus) de l'utilisateur connecté
export async function getUnreadNotifications(req, res) {
  try {
    const userId = req.user.id;
    const notifications = await Conversation.getUnreadNotifications(userId);
    res.json(notifications);
  } catch (err) {
    console.error('[getUnreadNotifications]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Marque une conversation comme lue pour l'utilisateur connecté
export async function markConversationAsRead(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    await Conversation.markAsRead(conversationId, userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[markConversationAsRead]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}