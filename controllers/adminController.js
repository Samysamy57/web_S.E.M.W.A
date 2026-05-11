// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\controllers\adminController.js
import User from '../models/User.js';
import AdminRequest from '../models/AdminRequestModel.js';
import Event from '../models/EventModel.js';
import Conversation from '../models/ConversationModel.js';
import Message from '../models/messageModel.js';
// GET /api/admin/users
export async function getUsers(req, res) {
  const { search, role, sort } = req.query;
  const users = await User.getAllUsers({ search, role, sort });
  return res.status(200).json({ users });
}

// PATCH /api/admin/users/:id/status
export async function toggleUserStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive (boolean) is required.' });
  }

  const user = await User.updateUserStatus(id, isActive);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  return res.status(200).json({ user });
}

// PATCH /api/admin/users/:id/role
export async function changeUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  const ALLOWED_ROLES = ['attendee', 'organizer', 'admin'];
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}.` });
  }

  const user = await User.updateUserRole(id, role);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  return res.status(200).json({ user });
}

// GET /api/admin/requests
export async function getAdminRequests(req, res) {
  const requests = await AdminRequest.getPendingRequests();
  return res.status(200).json({ requests });
}

export async function getEvents(req, res) {
  const events = await Event.getAllForAdmin();
  return res.status(200).json({ events });
}

// PATCH /api/admin/events/:id/status — body: { status: 'approved' | 'rejected' | 'pending' }
export async function moderateEvent(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const ALLOWED = ['pending', 'approved', 'rejected'];
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ALLOWED.join(', ')}.` });
  }

  const event = await Event.updateStatus(id, status);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  return res.status(200).json({ event });
}


export async function handleAdminRequest(req, res) {
  const { id } = req.params;
  const { action } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject.' });
  }

  const result = action === 'approve'
    ? await AdminRequest.approveRequest(id)
    : await AdminRequest.rejectRequest(id);

  if (!result) return res.status(404).json({ error: 'Request not found.' });

  return res.status(200).json({ message: `Request ${action}d.`, result });
}

// POST /api/admin/messages/support/:userId — ouvre ou crée le ticket support
export async function openSupportConversation(req, res) {
  const { userId } = req.params;
  const conversation = await Conversation.getOrCreateSupportConversation(userId);
  return res.status(200).json({ conversationId: conversation.id });
}

// POST /api/admin/messages/send
export async function sendAdminMessage(req, res) {
  const { conversationId, content } = req.body;
  const senderId = req.user.id;

  if (!conversationId || !content) {
    return res.status(400).json({ error: 'conversationId and content are required.' });
  }

  const message = await Message.create({ conversationId, senderId, content, messageType: 'text' });
  return res.status(201).json({ message });
}

// GET /api/admin/messages/conversations
export async function getAllMessagesConversations(_req, res) {
  const conversations = await Conversation.getAllConversationsAdmin();
  return res.status(200).json({ conversations });
}

// GET /api/admin/messages/conversation/:id
export async function getConversationMessagesById(req, res) {
  const { id } = req.params;
  const messages = await Message.getByConversationId(id);
  return res.status(200).json({ messages });
}