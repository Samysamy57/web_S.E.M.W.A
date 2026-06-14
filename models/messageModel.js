// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\models\messageModel.js
import pool from '../config/db.js';

const Message = {
  // sentBy = vrai auteur admin (optionnel, pour le panel admin)
async create({ conversationId, senderId, content, messageType = 'text', sentBy = null }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, message_type, sent_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [conversationId, senderId, content, messageType, sentBy]
  );
  return rows[0];
},

  async getByConversationId(conversationId) {
    const { rows } = await pool.query(
      `SELECT m.*,
              u.first_name, u.last_name, u.role,
              a.first_name AS sent_by_first_name,
              a.last_name  AS sent_by_last_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN users a ON a.id = m.sent_by
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );
    return rows;
  }
};

export default Message;