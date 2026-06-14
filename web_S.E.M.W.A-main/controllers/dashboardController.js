// Fichier : controllers/dashboardController.js
import pool        from '../config/db.js';
import Event       from '../models/eventModel.js';
import ReviewModel from '../models/ReviewModel.js';

const dashboardController = {

  // GET /api/dashboard/stats
  async getStats(req, res) {
    try {
      const userId = req.user.id;

      // Nombre d'events actifs (publiés)
      const { rows: [evRow] } = await pool.query(
        `SELECT COUNT(*) AS count FROM events
         WHERE created_by = $1 AND status = 'published'`,
        [userId]
      );

      // Total billets vendus (participants avec status 'registered')
      const { rows: [tkRow] } = await pool.query(
        `SELECT COUNT(ep.id) AS count
         FROM event_participants ep
         JOIN events e ON e.id = ep.event_id
         WHERE e.created_by = $1 AND ep.status = 'registered'`,
        [userId]
      );

      // Revenus : SUM du prix des events pour chaque inscrit
      const { rows: [rvRow] } = await pool.query(
        `SELECT COALESCE(SUM(e.price::numeric), 0)::float AS total
        FROM event_participants ep
        JOIN events e ON e.id = ep.event_id
        WHERE e.created_by = $1 AND ep.status = 'registered'`,
        [userId]
      );

      // Note moyenne via ReviewModel
      const avgRating = await ReviewModel.getOrganizerRating(userId);

      res.json({
        activeEventsCount: parseInt(evRow.count),
        totalTicketsSold:  parseInt(tkRow.count),
        totalRevenue:      parseFloat(rvRow.total),
        avgRating:         avgRating ? parseFloat(avgRating) : null,
      });
    } catch (err) {
      console.error('[dashboard/stats]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // GET /api/dashboard/events
  async getEvents(req, res) {
    try {
      const events = await Event.getOrganizerEvents(req.user.id);
      res.json(events);
    } catch (err) {
      console.error('[dashboard/events]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // GET /api/dashboard/events/:id/attendees
  async getEventAttendees(req, res) {
    try {
      const { id } = req.params;
      const organizerId = req.user.id;

      // Récupère participants + stats en parallèle
      const [attendees, stats] = await Promise.all([
        Event.getEventAttendees(id, organizerId),
        Event.getEventRegistrationStats(id, organizerId),
      ]);

      // Si aucun résultat ET l'event n'existe pas / n'appartient pas à cet organisateur
      // On renvoie quand même un tableau vide (l'event peut juste avoir 0 inscrits)
      res.json({ attendees, stats });
    } catch (err) {
      console.error('[dashboard/attendees]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // PATCH /api/dashboard/events/:id/cancel
  async cancelEvent(req, res) {
    try {
      const { id } = req.params;
      const organizerId = req.user.id;

      const cancelled = await Event.cancelEvent(id, organizerId);

      // null = event introuvable ou pas le bon organisateur
      if (!cancelled) {
        return res.status(404).json({ error: 'Event not found or access denied.' });
      }

      res.json({ message: 'Event cancelled.', event: cancelled });
    } catch (err) {
      console.error('[dashboard/cancel]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },
};

export default dashboardController;