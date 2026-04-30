import { Router } from 'express';
import { register, login, logout } from '../controllers/authController.js';
import { asyncWrap } from '../middlewares/asyncWrap.js';

const router = Router();

router.post('/register', asyncWrap(register));
router.post('/login',    asyncWrap(login));
router.get('/logout',    logout);

export default router;