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
} from '../controllers/adminController.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/users',              asyncWrap(getUsers));
router.patch('/users/:id/status', asyncWrap(toggleUserStatus));
router.patch('/users/:id/role',   asyncWrap(changeUserRole));
router.get('/requests',                asyncWrap(getAdminRequests));
router.patch('/requests/:id',          asyncWrap(handleAdminRequest));
router.get('/events',                  asyncWrap(getEvents));
router.patch('/events/:id/status',     asyncWrap(moderateEvent));

export default router;