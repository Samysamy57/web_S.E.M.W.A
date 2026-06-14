// Fichier : routes/eventRoutes.js
import express from 'express';
import { getAllEvents, reserveSpot, createEvent, getEventById } from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Récupère tous les events (public)
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// Réservation — utilisateur connecté obligatoire
router.post('/book', requireAuth, reserveSpot);
router.post('/', requireAuth, requireRole('organizer', 'admin'), createEvent);
export default router;