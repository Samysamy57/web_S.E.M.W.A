// Fichier : models/ReviewModel.js
import pool from '../config/db.js';

const ReviewModel = {

  // Moyenne des notes pour tous les events d'un organisateur
  async getOrganizerRating(userId) {
    const { rows } = await pool.query(
      `SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating
       FROM event_reviews r
       JOIN events e ON e.id = r.event_id
       WHERE e.created_by = $1`,
      [userId]
    );
    return rows[0]?.avg_rating ?? null;
  },

  // Les 3 derniers avis reçus sur les events de l'organisateur
  async getRecentReviews(userId) {
    const { rows } = await pool.query(
      `SELECT r.rating, r.comment, r.created_at,
              u.first_name, u.last_name,
              e.title AS event_title
       FROM event_reviews r
       JOIN events e ON e.id = r.event_id
       JOIN users u  ON u.id = r.user_id
       WHERE e.created_by = $1
       ORDER BY r.created_at DESC
       LIMIT 3`,
      [userId]
    );
    return rows;
  },
};

export default ReviewModel;