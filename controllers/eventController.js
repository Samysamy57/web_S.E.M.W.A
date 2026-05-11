// Fichier : controllers/eventController.js
import Event from '../models/eventModel.js';

// GET /participant-home — récupère tous les events publiés
export async function createEvent(req, res) {
  try {
    const {
      title, description, category, format,
      cover_image_url, start_date, end_date,
      location, capacity, tickets,
    } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'title and start_date are required.' });
    }

    const event = await Event.createEventWithTickets(
      {
        title,
        description,
        category,
        cover_image_url: cover_image_url || null,
        start_date,
        end_date,
        location,
        capacity,
        created_by: req.user.id,
      },
      Array.isArray(tickets) ? tickets : []
    );

    res.status(201).json({ message: 'Event created as draft.', event });
  } catch (err) {
    console.error('[createEvent]', err);
    res.status(500).json({ error: 'Server error.' });
  }
}

export async function getAllEvents(req, res) {
  try {
    const events = await Event.findEvent({});
    res.json(events);
  } catch (err) {
    console.error('[getAllEvents]', err);
    res.status(500).json({ error: 'Server error.' });
  }
}

// POST /api/events/book — réservation (requiert auth)
export async function reserveSpot(req, res) {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

    const registration = await Event.bookEvent(eventId, req.user.id);
    res.status(201).json({ message: 'Booking confirmed!', registration });
  } catch (err) {
    // Erreurs métier lisibles (event full, déjà inscrit)
    if (['Event is full.', 'Already registered for this event.', 'Event not found.'].includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[reserveSpot]', err);
    res.status(500).json({ error: 'Server error.' });
  }
}