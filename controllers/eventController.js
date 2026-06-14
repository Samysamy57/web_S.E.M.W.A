// Fichier : controllers/eventController.js
import Event from '../models/eventModel.js';
import Review from '../models/ReviewModel.js';

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

export async function getEventById(req, res) {
  try {
    const event = await Event.getEventDetailsById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const rating = await Review.getEventAverageRating(req.params.id);
    res.json({ ...event, avg_rating: rating.avg_rating, review_count: rating.review_count });
  } catch (err) {
    console.error('[getEventById]', err);
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
export async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const {
      title, description, category,
      cover_image_url, start_date, end_date,
      location, capacity, tickets,
    } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'title and start_date are required.' });
    }

    const isAdmin = req.user.role === 'admin';

    const updated = await Event.updateEventWithTickets(
      id,
      { title, description, category, cover_image_url, start_date, end_date, location, capacity },
      Array.isArray(tickets) ? tickets : [],
      req.user.id,
      isAdmin
    );

    if (!updated) {
      return res.status(403).json({ error: 'Access denied or event not found.' });
    }

    res.status(200).json({ message: 'Event updated successfully.', event: updated });
  } catch (err) {
    console.error('[updateEvent]', err);
    res.status(500).json({ error: 'Server error.' });
  }
}

export async function reserveSpot(req, res) {
  try {
    const { eventId, ticketTypeId, tickets } = req.body;
    if (!eventId || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: 'eventId and tickets[] are required.' });
    }

    // Récupère le type de ticket pour connaître le prix
    const ticketType = await Event.getTicketTypeById(ticketTypeId);

    // ── CAS GRATUIT ──────────────────────────────────────────────
    if (!ticketType || parseFloat(ticketType.price) === 0) {
      const created = await Event.createBulkTickets(eventId, req.user.id,
        tickets.map(t => ({ ...t, ticket_type_id: ticketTypeId || null }))
      );
      return res.status(201).json({ type: 'free', tickets: created });
    }

    // ── CAS PAYANT — Stripe Checkout ─────────────────────────────
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const unitAmount = Math.round(parseFloat(ticketType.price) * 100); // centimes
    const baseUrl    = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: ticketType.name },
          unit_amount: unitAmount,
        },
        quantity: tickets.length,
      }],
      // Stocke les infos nominatives dans les metadata (max 500 chars par champ)
      metadata: {
        eventId,
        userId: req.user.id,
        ticketTypeId,
        tickets: JSON.stringify(tickets),
      },
      success_url: `${baseUrl}/api/events/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/acceuil?booking=cancelled`,
    });

    return res.json({ type: 'paid', stripeUrl: session.url });

  } catch (err) {
    if (['Event not found.', 'Not enough seats available.'].includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[reserveSpot]', err);
    res.status(500).json({ error: 'Server error.' });
  }
}

// GET /api/events/:id/announcements
export async function getAnnouncements(req, res) {
  try {
    const { id: eventId } = req.params;

    let userId      = null;
    let isOrganizer = false;

    if (req.user) {
      userId = req.user.id;
      if (req.user.role === 'organizer' || req.user.role === 'admin') {
        const { rows: [ev] } = await pool.query(
          `SELECT 1 FROM events WHERE id = $1 AND created_by = $2`,
          [eventId, userId]
        );
        isOrganizer = !!ev;
      }
    }

    const announcements = await Event.getAnnouncementsForEvent(eventId, userId, isOrganizer);
    res.json(announcements);
  } catch (err) {
    console.error('[getAnnouncements]', err);
    res.status(500).json({ error: 'Server error.' });
  }
}

// GET /api/events/stripe-success — appelé par Stripe après paiement
export async function confirmStripeBooking(req, res) {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.redirect('/acceuil?booking=error');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Vérifie que le paiement est bien validé
    if (session.payment_status !== 'paid') {
      return res.redirect('/acceuil?booking=error');
    }

    const { eventId, userId, ticketTypeId, tickets: ticketsJson } = session.metadata;
    const tickets = JSON.parse(ticketsJson);

    await Event.createBulkTickets(eventId, userId,
      tickets.map(t => ({
        ...t,
        ticket_type_id:    ticketTypeId,
        stripe_payment_id: session.payment_intent,
      }))
    );

    return res.redirect('/my-tickets?booking=success');
  } catch (err) {
    console.error('[confirmStripeBooking]', err);
    return res.redirect('/acceuil?booking=error');
  }
}