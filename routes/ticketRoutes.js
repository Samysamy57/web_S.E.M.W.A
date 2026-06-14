// Fichier : routes/ticketRoutes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import ticketController from '../controllers/ticketController.js';

const router = Router();

router.get('/',              requireAuth, ticketController.getMyTickets);
router.patch('/:id/cancel',  requireAuth, ticketController.cancelMyTicket);

export default router;