// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\routes\authRoutes.js
import { Router } from 'express';
import { register, login, logout, registerAdminRequest, me, updateProfile } from '../controllers/authController.js';
import { asyncWrap } from '../middlewares/asyncWrap.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register',       asyncWrap(register));
router.post('/login',          asyncWrap(login));
router.get('/logout',          logout);
router.post('/register-admin', asyncWrap(registerAdminRequest));
router.get('/me',              requireAuth, me);
router.put('/profile',         requireAuth, asyncWrap(updateProfile));

export default router;