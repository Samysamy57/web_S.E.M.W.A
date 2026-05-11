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