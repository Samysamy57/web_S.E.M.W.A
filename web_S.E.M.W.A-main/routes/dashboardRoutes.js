// Fichier : routes/dashboardRoutes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import dashboardController from '../controllers/dashboardController.js';

const router = Router();

// Toutes les routes dashboard nécessitent d'être connecté en tant qu'organisateur
router.use(requireAuth, requireRole('organizer', 'admin'));

router.get('/stats',  dashboardController.getStats);
router.get('/events', dashboardController.getEvents);

// Participants d'un event spécifique (avec stats pour Chart.js)
router.get('/events/:id/attendees', dashboardController.getEventAttendees);

// Annulation d'un event
router.patch('/events/:id/cancel',  dashboardController.cancelEvent);

export default router;