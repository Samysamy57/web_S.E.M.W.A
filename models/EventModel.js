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
    conditions.push(`DATE(e.start_date) = $${index}`);
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
      const { rows: [event] } = await client.query(
        `INSERT INTO events
           (title, description, category, cover_image_url, start_date, end_date,
            location, max_participants, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9)
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

  // Events d'un organisateur avec stats de remplissage
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
       ORDER BY e.start_date ASC`,
      [userId]
    );

    // Calcule le pourcentage de remplissage
    return rows.map(ev => ({
      ...ev,
      fill_pct: ev.max_participants
        ? Math.round((ev.registered_count / ev.max_participants) * 100)
        : null,
    }));
  },
};

export default Event;