// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\models\User.js
import pool from '../config/db.js';

const SAFE_FIELDS = 'id, username, first_name, last_name, email, role, avatar_url, bio, is_active, created_at';

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

async create({ firstName, lastName, email, passwordHash, username, role = 'attendee' }) {
    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, username, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SAFE_FIELDS}`,
      [firstName, lastName, email.toLowerCase(), passwordHash, username, role]
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

  // Retourne tous les users (sans hash)
  async getAllUsers({ search, role, sort } = {}) {
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    if (role && ['attendee', 'organizer', 'admin'].includes(role)) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }

    const sortMap = {
      name_asc:  'first_name ASC',
      name_desc: 'first_name DESC',
      date_asc:  'created_at ASC',
      date_desc: 'created_at DESC',
    };
    const orderBy = sortMap[sort] ?? 'created_at DESC';

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users ${where} ORDER BY ${orderBy}`,
      params
    );
    return rows;
  },

  // Active ou désactive un compte user
  async updateUserStatus(userId, isActive) {
    const { rows } = await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING ${SAFE_FIELDS}`,
      [isActive, userId]
    );
    return rows[0] ?? null;
  },

  // Change le rôle d'un user (ex: 'attendee' → 'admin')
  async updateUserRole(userId, newRole) {
    const { rows } = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING ${SAFE_FIELDS}`,
      [newRole, userId]
    );
    return rows[0] ?? null;
  },

  // Met à jour le profil de l'utilisateur (prénom, nom, avatar, bio)
  async updateUserProfile(userId, { firstName, lastName, avatarUrl, bio }) {
    const { rows } = await pool.query(
      `UPDATE users
       SET first_name = $1, last_name = $2, avatar_url = $3, bio = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING ${SAFE_FIELDS}`,
      [firstName, lastName, avatarUrl ?? null, bio ?? null, userId]
    );
    return rows[0] ?? null;
  },

  // Met à jour la date de dernière lecture des notifications à maintenant
  async updateLastReadNotifications(userId) {
    await pool.query(
      `UPDATE users SET last_read_notifications_at = NOW() WHERE id = $1`,
      [userId]
    );
  },
};

export default User;