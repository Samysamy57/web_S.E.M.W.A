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

// Notifications
router.get('/notifications',          dashboardController.getNotifications);
router.post('/notifications/read-all', dashboardController.markNotificationsAsRead);

router.get('/tickets',           dashboardController.getTickets);
router.patch('/tickets/:id/status', dashboardController.updateTicketStatus);

router.post('/events/:id/announce', dashboardController.broadcastAnnouncement);

// Participants globaux de l'organisateur
router.get('/attendees',                dashboardController.getGlobalAttendees);
router.get('/attendees/:userId/history', dashboardController.getAttendeeHistory);

export default router;