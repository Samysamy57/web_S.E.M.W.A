// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\routes\adminRoutes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { asyncWrap } from '../middlewares/asyncWrap.js';
import {
  getUsers,
  toggleUserStatus,
  changeUserRole,
  getAdminRequests,
  handleAdminRequest,
  getEvents,
  moderateEvent,
  getAllMessagesConversations,
  getConversationMessagesById,
  openSupportConversation,
  sendAdminMessage,
} from '../controllers/adminController.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/users',              asyncWrap(getUsers));
router.patch('/users/:id/status', asyncWrap(toggleUserStatus));
router.patch('/users/:id/role',   asyncWrap(changeUserRole));
router.get('/requests',                asyncWrap(getAdminRequests));
router.patch('/requests/:id',          asyncWrap(handleAdminRequest));
router.get('/events',                        asyncWrap(getEvents));
router.patch('/events/:id/status',           asyncWrap(moderateEvent));
router.post('/messages/support/:userId',     asyncWrap(openSupportConversation));
router.post('/messages/send',                asyncWrap(sendAdminMessage));
router.get('/messages/conversations',        asyncWrap(getAllMessagesConversations));
router.get('/messages/conversation/:id',     asyncWrap(getConversationMessagesById));

export default router;