// Fichier : routes/eventRoutes.js
import express from 'express';
import { getAllEvents, reserveSpot } from '../controllers/eventController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Récupère tous les events (public)
router.get('/', getAllEvents);

// Réservation — utilisateur connecté obligatoire
router.post('/book', requireAuth, reserveSpot);

export default router;