import pool from '../config/db.js';

const Event = {
async findEvent(filter) {
  const { keyword, city, date, category } = filter;

  const conditions = [`e.status = 'published'`];
  const values = [];
  let index = 1;

  if (keyword) {
    conditions.push(`(
      e.title ILIKE $${index}
      OR e.description ILIKE $${index}
      OR e.location ILIKE $${index}
      OR e.city ILIKE $${index}
    )`);
    values.push(`%${keyword}%`);
    index++;
  }

  if (city) {
    conditions.push(`e.city ILIKE $${index}`);
    values.push(`%${city}%`);
    index++;
  }

  if (date) {
    conditions.push(`e.start_date::date = $${index}`);
    values.push(date);
    index++;
  }

  // Filtre par catégorie (chip)
  if (category && category !== 'all') {
    conditions.push(`e.category = $${index}::event_category`);
    values.push(category);
    index++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.title,
      e.description,
      e.location,
      e.city,
      e.start_date,
      e.end_date,
      e.status,
      e.category,
      e.price,
      e.max_participants,
      -- Compte le nb de participants confirmés
      COUNT(ep.id) FILTER (WHERE ep.status = 'registered') AS registered_count
    FROM public.events e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id
    ${whereClause}
    GROUP BY e.id
    ORDER BY e.start_date ASC
    `,
    values
  );

  return rows;
},

// Réservation d'une place pour un utilisateur
async bookEvent(eventId, userId) {
  // Vérifie si l'event existe et récupère sa capacité
  const { rows: [event] } = await pool.query(
    `SELECT max_participants,
            COUNT(ep.id) FILTER (WHERE ep.status = 'registered') AS registered_count
     FROM events e
     LEFT JOIN event_participants ep ON ep.event_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [eventId]
  );

  if (!event) throw new Error('Event not found.');

  // Vérifie si l'event est complet
  if (event.max_participants && parseInt(event.registered_count) >= event.max_participants) {
    throw new Error('Event is full.');
  }

  // Insère la participation (ON CONFLICT = déjà inscrit)
  const { rows } = await pool.query(
    `INSERT INTO event_participants (event_id, user_id, status)
     VALUES ($1, $2, 'registered')
     ON CONFLICT (event_id, user_id) DO NOTHING
     RETURNING *`,
    [eventId, userId]
  );

  if (rows.length === 0) throw new Error('Already registered for this event.');
  return rows[0];
},

  // Récupère tous les événements avec le nom du créateur
  // Crée un événement + ses types de tickets en une transaction atomique
  async createEventWithTickets(eventData, tickets = []) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertion de l'événement (statut forcé à 'draft')
      const prices   = (tickets || []).map(t => parseFloat(t.price)).filter(p => !isNaN(p));
      const minPrice = prices.length ? Math.min(...prices) : 0;

      const { rows: [event] } = await client.query(
        `INSERT INTO events
           (title, description, category, cover_image_url, start_date, end_date,
            location, max_participants, status, created_by, price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10)
         RETURNING *`,
        [
          eventData.title,
          eventData.description,
          eventData.category,
          eventData.cover_image_url || null,
          eventData.start_date,
          eventData.end_date || null,
          eventData.location || null,
          eventData.capacity || null,
          eventData.created_by,
          minPrice,
        ]
      );

      // Insertion des types de tickets
      for (const ticket of tickets) {
        await client.query(
          `INSERT INTO event_ticket_types (event_id, name, description, price)
           VALUES ($1, $2, $3, $4)`,
          [event.id, ticket.name, ticket.description || null, ticket.price]
        );
      }

      await client.query('COMMIT');
      return event;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getAllForAdmin() {
    const { rows } = await pool.query(
      `
      SELECT
        e.*,
        u.first_name,
        u.last_name
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      ORDER BY e.created_at DESC
      `
    );
    return rows;
  },

  // Met à jour le statut d'un événement (approved / rejected / pending)
  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE events SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0] ?? null;
  },

 
  async getEventDetailsById(eventId) {
    const { rows } = await pool.query(
      `SELECT
         e.*,
         u.first_name, u.last_name, u.avatar_url,
         COUNT(ep.id) FILTER (WHERE ep.status = 'registered') AS registered_count,
         COALESCE(
           json_agg(
             json_build_object('id', tt.id, 'name', tt.name, 'description', tt.description, 'price', tt.price)
           ) FILTER (WHERE tt.id IS NOT NULL),
           '[]'
         ) AS ticket_types
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN event_participants ep ON ep.event_id = e.id
       LEFT JOIN event_ticket_types tt ON tt.event_id = e.id
       WHERE e.id = $1
       GROUP BY e.id, u.first_name, u.last_name, u.avatar_url`,
      [eventId]
    );
    return rows[0] ?? null;
  },

  async getOrganizerEvents(userId) {
    const { rows } = await pool.query(
      `SELECT
         e.id, e.title, e.status, e.start_date, e.city,
         e.max_participants, e.price,
         COUNT(ep.id) FILTER (WHERE ep.status = 'registered') AS registered_count
       FROM events e
       LEFT JOIN event_participants ep ON ep.event_id = e.id
       WHERE e.created_by = $1
       GROUP BY e.id
       ORDER BY e.start_date DESC`,
      [userId]
    );

    return rows.map(ev => ({
      ...ev,
      fill_pct: ev.max_participants
        ? Math.round((ev.registered_count / ev.max_participants) * 100)
        : null,
    }));
  },

  // Retourne les participants d'un event — SEULEMENT si l'event appartient à organizerId
  async getEventAttendees(eventId, organizerId) {
    const { rows } = await pool.query(
      `SELECT
         u.first_name, u.last_name, u.email,
         ep.status,
         ep.registered_at,
         COALESCE(ett.name, 'Standard') AS ticket_type
       FROM event_participants ep
       JOIN events e   ON e.id  = ep.event_id
       JOIN users  u   ON u.id  = ep.user_id
       LEFT JOIN event_ticket_types ett ON ett.event_id = ep.event_id
       WHERE ep.event_id = $1
         AND e.created_by = $2        -- sécurité : seul le créateur peut voir
         AND ep.status = 'registered'
       ORDER BY ep.registered_at ASC`,
      [eventId, organizerId]
    );
    return rows;
  },

  // Retourne le nb d'inscriptions groupées par jour (pour Chart.js)
  async getEventRegistrationStats(eventId, organizerId) {
    const { rows } = await pool.query(
      `SELECT
         ep.registered_at::date AS day,
         COUNT(*)               AS count
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       WHERE ep.event_id  = $1
         AND e.created_by = $2
         AND ep.status    = 'registered'
       GROUP BY ep.registered_at::date
       ORDER BY day ASC`,
      [eventId, organizerId]
    );
    return rows;
  },

  // Met le statut de l'event à 'cancelled' — SEULEMENT si l'event appartient à organizerId
  async getNotificationsForOrganizer(organizerId) {
    // Requête 1 : inscriptions récentes
    const { rows: registrations } = await pool.query(
      `SELECT
         ep.id,
         'registration'        AS type,
         u.first_name, u.last_name,
         e.id                  AS event_id,
         e.title               AS event_title,
         ep.registered_at      AS created_at
       FROM event_participants ep
       JOIN events e ON e.id  = ep.event_id
       JOIN users  u ON u.id  = ep.user_id
       WHERE e.created_by = $1
       ORDER BY ep.registered_at DESC
       LIMIT 50`,
      [organizerId]
    );

    // Requête 2 : avis récents
    const { rows: reviews } = await pool.query(
      `SELECT
         er.id,
         'review'              AS type,
         u.first_name, u.last_name,
         e.id                  AS event_id,
         e.title               AS event_title,
         er.rating,
         er.created_at
       FROM event_reviews er
       JOIN events e ON e.id  = er.event_id
       JOIN users  u ON u.id  = er.user_id
       WHERE e.created_by = $1
       ORDER BY er.created_at DESC
       LIMIT 50`,
      [organizerId]
    );

    // Fusionne, trie par date décroissante, garde les 15 plus récentes
    const all = [...registrations, ...reviews]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 15);

    return all;
  },

  async updateEventWithTickets(eventId, eventData, tickets = [], userId, isAdmin) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifie existence et propriété de l'événement
      const { rows: [existing] } = await client.query(
        `SELECT id, created_by FROM events WHERE id = $1`,
        [eventId]
      );

      if (!existing || (!isAdmin && existing.created_by !== userId)) {
        await client.query('ROLLBACK');
        return null; // 403/404 géré par le contrôleur
      }

      // Prix min parmi les nouveaux tickets
      const prices   = tickets.map(t => parseFloat(t.price)).filter(p => !isNaN(p));
      const minPrice = prices.length ? Math.min(...prices) : 0;

      // Mise à jour de l'événement
      const { rows: [updated] } = await client.query(
        `UPDATE events
         SET title = $1, description = $2, category = $3, cover_image_url = $4,
             start_date = $5, end_date = $6, location = $7, max_participants = $8,
             price = $9, updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          eventData.title,
          eventData.description || null,
          eventData.category || null,
          eventData.cover_image_url || null,
          eventData.start_date,
          eventData.end_date || null,
          eventData.location || null,
          eventData.capacity || null,
          minPrice,
          eventId,
        ]
      );

      // Supprime les anciens tickets puis insère les nouveaux
      await client.query(`DELETE FROM event_ticket_types WHERE event_id = $1`, [eventId]);
      for (const ticket of tickets) {
        await client.query(
          `INSERT INTO event_ticket_types (event_id, name, description, price)
           VALUES ($1, $2, $3, $4)`,
          [eventId, ticket.name, ticket.description || null, ticket.price]
        );
      }

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Insère plusieurs tickets nominatifs d'un coup (gratuit ou après paiement Stripe)
  async createBulkTickets(eventId, userId, tickets) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifie la capacité de l'event
      const { rows: [event] } = await client.query(
        `SELECT max_participants,
                COUNT(ep.id) FILTER (WHERE ep.status = 'registered') AS registered_count
         FROM events e
         LEFT JOIN event_participants ep ON ep.event_id = e.id
         WHERE e.id = $1
         GROUP BY e.id`,
        [eventId]
      );
      if (!event) throw new Error('Event not found.');
      if (
        event.max_participants &&
        parseInt(event.registered_count) + tickets.length > event.max_participants
      ) {
        throw new Error('Not enough seats available.');
      }

      const inserted = [];
      for (const t of tickets) {
        const { rows: [row] } = await client.query(
          `INSERT INTO event_participants
             (event_id, user_id, ticket_type_id, holder_first_name, holder_last_name,
              holder_email, status, stripe_payment_id)
           VALUES ($1, $2, $3, $4, $5, $6, 'registered', $7)
           RETURNING id, qr_code_secret, holder_first_name, holder_last_name, holder_email`,
          [
            eventId,
            userId,
            t.ticket_type_id || null,
            t.holder_first_name,
            t.holder_last_name,
            t.holder_email,
            t.stripe_payment_id || null,
          ]
        );
        inserted.push(row);
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Récupère les tickets d'un event pour vérification du ticket_type
  async getTicketTypeById(ticketTypeId) {
    const { rows } = await pool.query(
      `SELECT id, name, price FROM event_ticket_types WHERE id = $1`,
      [ticketTypeId]
    );
    return rows[0] ?? null;
  },

  // Récupère les tickets vendus pour le dashboard organisateur
  async getOrganizerTickets(organizerId) {
    const { rows } = await pool.query(
      `SELECT
         ep.id            AS participant_id,
         u.first_name, u.last_name, u.email,
         e.title          AS event_title,
         COALESCE(ett.name, 'Standard') AS ticket_name,
         COALESCE(ett.price, 0)         AS ticket_price,
         ep.registered_at,
         ep.status
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       JOIN users  u ON u.id = ep.user_id
       LEFT JOIN event_ticket_types ett ON ett.id = ep.ticket_type_id
       WHERE e.created_by = $1
       ORDER BY ep.registered_at DESC`,
      [organizerId]
    );
    return rows;
  },

  // Met à jour le statut d'un ticket (check-in ou annulation) — vérifie l'ownership
  async updateParticipantStatus(participantId, status, organizerId) {
    const { rows } = await pool.query(
      `UPDATE event_participants ep
       SET status = $1, updated_at = NOW()
       FROM events e
       WHERE ep.id = $2
         AND ep.event_id = e.id
         AND e.created_by = $3
       RETURNING ep.id`,
      [status, participantId, organizerId]
    );
    return rows[0] ?? null;
  },

  // Enregistre une annonce pour un événement
  async createAnnouncement(eventId, content, notifyFuture) {
    const { rows } = await pool.query(
      `INSERT INTO event_announcements (event_id, content, notify_future)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [eventId, content, notifyFuture]
    );
    return rows[0];
  },

  // Récupère les annonces d'un event selon le profil du visiteur
  async getAnnouncementsForEvent(eventId, userId, isOrganizer) {
    // Vérifie si l'utilisateur est inscrit à cet event
    let isRegistered = false;
    if (userId && !isOrganizer) {
      const { rows } = await pool.query(
        `SELECT 1 FROM event_participants
         WHERE event_id = $1 AND user_id = $2 AND status IN ('registered', 'attended')`,
        [eventId, userId]
      );
      isRegistered = rows.length > 0;
    }

    // Organisateur ou inscrit → toutes les annonces ; visiteur → seulement notify_future
    const whereExtra = (isOrganizer || isRegistered) ? '' : 'AND notify_future = TRUE';

    const { rows } = await pool.query(
      `SELECT * FROM event_announcements
       WHERE event_id = $1 ${whereExtra}
       ORDER BY created_at DESC`,
      [eventId]
    );
    return rows;
  },

  async cancelEvent(eventId, organizerId) {
    const { rows } = await pool.query(
      `UPDATE events
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND created_by = $2
       RETURNING id, title, status`,
      [eventId, organizerId]
    );
    // rows[0] est undefined si l'event n'existe pas ou n'appartient pas à cet organisateur
    return rows[0] ?? null;
  },

  // Liste globale des participants d'un organisateur avec stats agrégées
  async getOrganizerAttendees(organizerId) {
    const { rows } = await pool.query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.avatar_url,
         COUNT(ep.id) AS total_bookings,
         COUNT(ep.id) FILTER (WHERE ep.status = 'attended') AS total_attended,
         COALESCE(SUM(ett.price), 0) AS total_spent,
         MAX(ep.registered_at) AS last_registration
       FROM event_participants ep
       JOIN users u ON u.id = ep.user_id
       JOIN events e ON e.id = ep.event_id
       LEFT JOIN event_ticket_types ett ON ett.id = ep.ticket_type_id
       WHERE e.created_by = $1
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.avatar_url
       ORDER BY last_registration DESC`,
      [organizerId]
    );
    return rows;
  },

  // Historique des billets d'un participant chez cet organisateur
  async getOrganizerAttendeeHistory(userId, organizerId) {
    const { rows } = await pool.query(
      `SELECT
         ep.id, e.title, e.start_date,
         COALESCE(ett.name, 'Standard') AS ticket_name,
         COALESCE(ett.price, 0) AS price,
         ep.status, ep.registered_at
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       LEFT JOIN event_ticket_types ett ON ett.id = ep.ticket_type_id
       WHERE ep.user_id = $1 AND e.created_by = $2
       ORDER BY e.start_date DESC`,
      [userId, organizerId]
    );
    return rows;
  },
};

export default Event;