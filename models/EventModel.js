// Fichier : models/EventModel.js

import pool from '../config/db.js';

const Event = {

  // Récupère tous les événements avec le nom de l'organisateur (JOIN users)
  async getAllForAdmin() {
    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.title,
        e.status,
        e.start_date,
        e.created_at,
        u.first_name,
        u.last_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.created_at DESC
    `);
    return rows;
  },

  // Met à jour le statut d'un événement (approved, rejected, pending)
  async updateStatus(eventId, newStatus) {
    const { rows } = await pool.query(
      `UPDATE events
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newStatus, eventId]
    );
    return rows[0] ?? null;
  },
};

export default Event;