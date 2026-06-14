// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\models\ConversationModel.js
import pool from '../config/db.js';

const Conversation = {
  async findPrivateConversation(userId1, userId2) {
    const { rows } = await pool.query(
      `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.is_group = FALSE
        AND cp.user_id IN ($1, $2)
      GROUP BY c.id
      HAVING COUNT(DISTINCT cp.user_id) = 2
         AND COUNT(*) = 2
      LIMIT 1
      `,
      [userId1, userId2]
    );

    return rows[0] ?? null;
  },

  async createPrivateConversation(userId1, userId2) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const convoResult = await client.query(
        `
        INSERT INTO conversations (is_group, created_by)
        VALUES (FALSE, $1)
        RETURNING *
        `,
        [userId1]
      );

      const conversation = convoResult.rows[0];

      await client.query(
        `
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
        `,
        [conversation.id, userId1, userId2]
      );

      await client.query('COMMIT');
      return conversation;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getOrCreatePrivateConversation(userId1, userId2) {
    const existing = await this.findPrivateConversation(userId1, userId2);
    if (existing) return existing;

    return await this.createPrivateConversation(userId1, userId2);
  },

// Cherche ou crée la conversation SUPPORT d'un utilisateur
  async getOrCreateSupportConversation(userId) {
    // Cherche une conversation SUPPORT existante pour cet utilisateur
    const { rows } = await pool.query(
      `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.title = 'SUPPORT' AND cp.user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (rows[0]) return rows[0];

    // Crée la conversation + ajoute l'utilisateur comme seul participant
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const convoRes = await client.query(
        `INSERT INTO conversations (title, is_group, created_by)
         VALUES ('SUPPORT', FALSE, $1) RETURNING *`,
        [userId]
      );
      const conversation = convoRes.rows[0];

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2)`,
        [conversation.id, userId]
      );

      await client.query('COMMIT');
      return { id: conversation.id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getAllConversationsAdmin() {
    const { rows } = await pool.query(
      `
      SELECT
        c.id                        AS conversation_id,
        c.is_group,
        c.created_at,
        c.updated_at,

        -- Participant 1
        u1.id                       AS user1_id,
        u1.first_name               AS user1_first_name,
        u1.last_name                AS user1_last_name,
        u1.email                    AS user1_email,

        -- Participant 2
        u2.id                       AS user2_id,
        u2.first_name               AS user2_first_name,
        u2.last_name                AS user2_last_name,
        u2.email                    AS user2_email,

        -- Dernier message
        m.content                   AS last_message,
        m.created_at                AS last_message_at,
        m.sender_id                 AS last_message_sender_id

      FROM conversations c

      -- Les deux participants
      JOIN conversation_participants cp1
        ON cp1.conversation_id = c.id
      JOIN users u1
        ON u1.id = cp1.user_id

      JOIN conversation_participants cp2
        ON cp2.conversation_id = c.id
       AND cp2.user_id > cp1.user_id   -- évite les doublons

      JOIN users u2
        ON u2.id = cp2.user_id

      LEFT JOIN LATERAL (
        SELECT content, created_at, sender_id
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON TRUE

      WHERE c.is_group = FALSE

      ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `
    );
    return rows;
  },

  async getUserConversations(userId) {
    const { rows } = await pool.query(
      `
      SELECT
        c.id AS conversation_id,
        c.is_group,
        c.title,
        c.created_at,
        c.updated_at,

        u.id AS other_user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.avatar_url,

        m.id AS last_message_id,
        m.content AS last_message,
        m.created_at AS last_message_created_at,
        m.sender_id AS last_message_sender_id

      FROM conversations c

      JOIN conversation_participants cp_me
        ON cp_me.conversation_id = c.id
       AND cp_me.user_id = $1

      LEFT JOIN conversation_participants cp_other
        ON cp_other.conversation_id = c.id
       AND cp_other.user_id <> $1

      LEFT JOIN users u
        ON u.id = cp_other.user_id

      LEFT JOIN LATERAL (
        SELECT id, content, created_at, sender_id
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON TRUE

      ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `,
      [userId]
    );

    return rows;
  }
};

export default Conversation;