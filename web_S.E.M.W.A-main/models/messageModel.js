// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\models\messageModel.js
import pool from '../config/db.js';

const Message = {
  async create({ conversationId, senderId, content, messageType = 'text' }) {
    const { rows } = await pool.query(
      `
      INSERT INTO messages (conversation_id, sender_id, content, message_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [conversationId, senderId, content, messageType]
    );

    return rows[0];
  },

  async getByConversationId(conversationId) {
    const { rows } = await pool.query(
      `
      SELECT
        m.id, m.conversation_id, m.sender_id,
        m.content, m.message_type, m.created_at, m.updated_at,
        u.role, u.first_name, u.last_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      `,
      [conversationId]
    );
    return rows;
  }
};

export default Message;