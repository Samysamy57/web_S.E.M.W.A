// Fichier : routes/eventRoutes.js
import express from 'express';
import { getAllEvents, reserveSpot, createEvent, getEventById, updateEvent, confirmStripeBooking, getAnnouncements } from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getAllEvents);
// IMPORTANT : stripe-success avant /:id pour ne pas être capturé par le param
router.get('/stripe-success', confirmStripeBooking);
router.get('/:id', getEventById);
router.get('/:id/announcements', getAnnouncements);

router.post('/book', requireAuth, reserveSpot);
router.post('/', requireAuth, requireRole('organizer', 'admin'), createEvent);
router.put('/:id', requireAuth, requireRole('organizer', 'admin'), updateEvent);

export default router;