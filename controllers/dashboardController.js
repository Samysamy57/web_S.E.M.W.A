// Fichier : controllers/dashboardController.js
import pool        from '../config/db.js';
import Event       from '../models/eventModel.js';
import ReviewModel from '../models/ReviewModel.js';
import User        from '../models/User.js';
const dashboardController = {

  // GET /api/dashboard/stats
  async getStats(req, res) {
    try {
      const userId = req.user.id;

      // Nombre d'events actifs (publiés)
      const { rows: [evRow] } = await pool.query(
        `SELECT COUNT(*) AS count FROM events
         WHERE created_by = $1
           AND status = 'published'
           AND COALESCE(end_date, start_date) >= NOW()`,
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
async getNotifications(req, res) {
    try {
      const organizerId = req.user.id;

      // Récupère la date de dernière lecture de l'organisateur
      const { rows: [userRow] } = await pool.query(
        `SELECT last_read_notifications_at FROM users WHERE id = $1`,
        [organizerId]
      );
      const lastRead = userRow?.last_read_notifications_at ?? new Date(0);

      // Récupère les notifications depuis le modèle
      const notifications = await Event.getNotificationsForOrganizer(organizerId);

      // Marque chaque notif comme lue ou non lue
      const result = notifications.map(n => ({
        ...n,
        is_unread: new Date(n.created_at) > new Date(lastRead),
      }));

      const unreadCount = result.filter(n => n.is_unread).length;

      res.json({ notifications: result, unreadCount });
    } catch (err) {
      console.error('[dashboard/notifications]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // POST /api/dashboard/notifications/read-all
  async getTickets(req, res) {
    try {
      const tickets = await Event.getOrganizerTickets(req.user.id);
      res.json(tickets);
    } catch (err) {
      console.error('[dashboard/tickets]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // PATCH /api/dashboard/tickets/:id/status
  async updateTicketStatus(req, res) {
    try {
      const { id }     = req.params;
      const { status } = req.body;

      if (!['attended', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }

      const result = await Event.updateParticipantStatus(id, status, req.user.id);
      if (!result) return res.status(404).json({ error: 'Ticket not found or access denied.' });

      res.json({ message: 'Status updated.' });
    } catch (err) {
      console.error('[dashboard/tickets/status]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  async markNotificationsAsRead(req, res) {
    try {
      await User.updateLastReadNotifications(req.user.id);
      res.json({ message: 'Notifications marked as read.' });
    } catch (err) {
      console.error('[dashboard/notifications/read-all]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // GET /api/dashboard/attendees
  async broadcastAnnouncement(req, res) {
    try {
      const { id: eventId }             = req.params;
      const { content, notifyFuture }   = req.body;
      const organizerId                 = req.user.id;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'content is required.' });
      }

      // Vérifie que l'event appartient à cet organisateur
      const { rows: [event] } = await pool.query(
        `SELECT id, title FROM events WHERE id = $1 AND created_by = $2`,
        [eventId, organizerId]
      );
      if (!event) {
        return res.status(403).json({ error: 'Event not found or access denied.' });
      }

      // Sauvegarde l'annonce en base
      const announcement = await Event.createAnnouncement(eventId, content.trim(), !!notifyFuture);

      // Diffuse en temps réel à tous les participants de la room
      const io = req.app.get('io');
      io.to('event_' + eventId).emit('event announcement', {
        eventTitle: event.title,
        content:    announcement.content,
        createdAt:  announcement.created_at,
      });

      res.status(201).json({ message: 'Announcement broadcasted.', announcement });
    } catch (err) {
      console.error('[dashboard/announce]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  async getGlobalAttendees(req, res) {
    try {
      const attendees = await Event.getOrganizerAttendees(req.user.id);
      res.json(attendees);
    } catch (err) {
      console.error('[dashboard/attendees]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  // GET /api/dashboard/attendees/:userId/history
  async getAttendeeHistory(req, res) {
    try {
      const { userId } = req.params;
      const history = await Event.getOrganizerAttendeeHistory(userId, req.user.id);
      res.json(history);
    } catch (err) {
      console.error('[dashboard/attendees/history]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },
};

export default dashboardController;