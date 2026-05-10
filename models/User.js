import pool from '../config/db.js';

const SAFE_FIELDS = 'id, first_name, last_name, email, role, avatar_url, is_active, created_at';

const User = {
  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS}, password_hash FROM users WHERE email = $1 AND is_active = TRUE`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users WHERE id = $1 AND is_active = TRUE`,
      [id]
    );
    return rows[0] ?? null;
  },

  async create({ firstName, lastName, email, passwordHash, role = 'attendee' }) {
    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SAFE_FIELDS}`,
      [firstName, lastName, email.toLowerCase(), passwordHash, role]
    );
    return rows[0];
  },

  async emailExists(email) {
    const { rows } = await pool.query(
      'SELECT 1 FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return rows.length > 0;
  },
};

export default User;