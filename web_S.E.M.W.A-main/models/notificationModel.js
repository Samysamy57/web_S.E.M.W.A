// models/notificationModel.js
import pool from '../config/db.js';

const Notification = {
  // Créer une notification simple
  async create({
    userId,
    type = 'system',
    title,
    content = null,
    link = null,
    conversationId = null,
    messageId = null,
    eventId = null
  }) {
    const { rows } = await pool.query(
      `
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        link,
        conversation_id,
        message_id,
        event_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        userId,
        type,
        title,
        content,
        link,
        conversationId,
        messageId,
        eventId
      ]
    );

    return rows[0];
  },

  // Récupérer toutes les notifications d'un utilisateur
  async getAllByUserId(userId) {
    const { rows } = await pool.query(
      `
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.title,
        n.content,
        n.link,
        n.is_read,
        n.read_at,
        n.conversation_id,
        n.message_id,
        n.event_id,
        n.created_at,
        n.updated_at
      FROM notifications n
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      `,
      [userId]
    );

    return rows;
  },

  // Compter les notifications non lues
  async countUnreadByUserId(userId) {
    const { rows } = await pool.query(
      `
      SELECT COUNT(*)::int AS unread_count
      FROM notifications
      WHERE user_id = $1
        AND is_read = FALSE
      `,
      [userId]
    );

    return rows[0].unread_count;
  },

  // Marquer une notification comme lue
  async markAsRead(notificationId, userId) {
    const { rows } = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING *
      `,
      [notificationId, userId]
    );

    return rows[0];
  },

  // Marquer toutes les notifications comme lues
  async markAllAsRead(userId) {
    const { rows } = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = NOW()
      WHERE user_id = $1
        AND is_read = FALSE
      RETURNING *
      `,
      [userId]
    );

    return rows;
  },

  // Supprimer une notification
  async delete(notificationId, userId) {
    const { rows } = await pool.query(
      `
      DELETE FROM notifications
      WHERE id = $1
        AND user_id = $2
      RETURNING *
      `,
      [notificationId, userId]
    );

    return rows[0];
  }
};

export default Notification;