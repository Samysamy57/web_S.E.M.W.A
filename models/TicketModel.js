// Fichier : models/TicketModel.js
import pool from '../config/db.js';

const TicketModel = {

  // Récupère tous les tickets de l'utilisateur connecté
  async getUserTickets(userId) {
    const { rows } = await pool.query(
      `SELECT
         ep.id,
         ep.status,
         ep.registered_at,
         ep.qr_code_secret,
         ep.holder_first_name,
         ep.holder_last_name,
         ep.cancellation_reason,
         e.title,
         e.start_date,
         e.location,
         e.city,
         e.cover_image_url,
         COALESCE(ett.name,  'Standard') AS ticket_name,
         COALESCE(ett.price, 0)          AS price
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       LEFT JOIN event_ticket_types ett ON ett.id = ep.ticket_type_id
       WHERE ep.user_id = $1
       ORDER BY e.start_date ASC`,
      [userId]
    );
    return rows;
  },

  // Annule un ticket — vérifie que le ticket appartient bien à l'utilisateur
  async cancelTicket(ticketId, userId, reason) {
    const { rows } = await pool.query(
      `UPDATE event_participants
       SET status = 'cancelled',
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2
         AND user_id = $3
         AND status = 'registered'
       RETURNING id`,
      [reason || null, ticketId, userId]
    );
    // null = ticket introuvable, déjà annulé, ou pas le bon user
    return rows[0] ?? null;
  },
};

export default TicketModel;