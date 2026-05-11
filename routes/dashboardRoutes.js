// Fichier : routes/dashboardRoutes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import dashboardController from '../controllers/dashboardController.js';

const router = Router();

// Toutes les routes dashboard nécessitent d'être connecté en tant qu'organisateur
router.use(requireAuth, requireRole('organizer', 'admin'));

router.get('/stats',  dashboardController.getStats);
router.get('/events', dashboardController.getEvents);

export default router;