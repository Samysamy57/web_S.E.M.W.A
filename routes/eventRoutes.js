// Fichier : routes/eventRoutes.js
import express from 'express';
import { getAllEvents, reserveSpot, createEvent } from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Récupère tous les events (public)
router.get('/', getAllEvents);

// Réservation — utilisateur connecté obligatoire
router.post('/book', requireAuth, reserveSpot);
router.post('/', requireAuth, requireRole('organizer', 'admin'), createEvent);
export default router;