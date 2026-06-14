// Fichier : models/AdminRequestModel.js
import pool from '../config/db.js';
import User from './User.js';

const AdminRequest = {

  // Crée une demande 'pending' pour un user
  async create(userId) {
    // Supprime toute demande déjà traitée (approved/rejected) pour ce user
    // afin de permettre une nouvelle demande
    await pool.query(
      `DELETE FROM admin_requests
       WHERE user_id = $1 AND status IN ('approved', 'rejected')`,
      [userId]
    );

    // Insère la nouvelle demande (lèvera 23505 si une 'pending' existe déjà)
    const { rows } = await pool.query(
      `INSERT INTO admin_requests (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
    return rows[0];
  },

  // Récupère toutes les demandes en attente avec les infos du user
  async getPendingRequests() {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.created_at, ar.status,
              u.id AS user_id, u.first_name, u.last_name, u.email
       FROM admin_requests ar
       JOIN users u ON u.id = ar.user_id
       WHERE ar.status = 'pending'
       ORDER BY ar.created_at ASC`
    );
    return rows;
  },

  // Approuve : met à jour la demande ET passe le user en 'admin'
  async approveRequest(requestId) {
    const { rows } = await pool.query(
      `UPDATE admin_requests SET status = 'approved'
       WHERE id = $1 RETURNING *`,
      [requestId]
    );
    const request = rows[0];
    if (!request) return null;

    await User.updateUserRole(request.user_id, 'admin');
    return request;
  },

  // Rejette simplement la demande
  async rejectRequest(requestId) {
    const { rows } = await pool.query(
      `UPDATE admin_requests SET status = 'rejected'
       WHERE id = $1 RETURNING *`,
      [requestId]
    );
    return rows[0] ?? null;
  },
};

export default AdminRequest;