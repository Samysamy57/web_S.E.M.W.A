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
      SELECT id, conversation_id, sender_id, content, message_type, created_at, updated_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      `,
      [conversationId]
    );

    return rows;
  }
};

export default Message;