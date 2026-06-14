import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AdminRequest from '../models/AdminRequestModel.js';

const SALT_ROUNDS  = 12;
const JWT_EXPIRES  = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

const cookieOpts = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   COOKIE_MAX_AGE,
};

export async function register(req, res) {
  const { firstName, lastName, email, password, role } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const ALLOWED_ROLES = ['attendee', 'organizer'];
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'attendee';

  if (await User.emailExists(email)) {
    return res.status(409).json({ error: 'Email already in use.' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const username = email.split('@')[0];
  const user = await User.create({ firstName, lastName, email, passwordHash, username, role: safeRole });

  const token = signToken(user);
  res.cookie('token', token, cookieOpts);
  return res.status(201).json({ user });
}

export async function login(req, res) {
  const { email, password, adminOnly } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await User.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

  if (adminOnly && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to administrators.' });
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(safeUser);
  res.cookie('token', token, cookieOpts);
  return res.status(200).json({ user: safeUser });
}

// Smart Admin Request :
// - Compte existant → vérifie le mot de passe, réutilise l'ID
// - Nouveau compte  → crée avec rôle attendee
// - Gère le doublon de demande (code Postgres 23505)
export async function registerAdminRequest(req, res) {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  let user = await User.findByEmail(email);

  if (user) {
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect pour ce compte existant.' });
    }
  } else {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const username = email.split('@')[0];
    user = await User.create({ firstName, lastName, email, passwordHash, username, role: 'attendee' });
  }

  try {
    await AdminRequest.create(user.id);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Une demande est déjà en cours pour ce compte.' });
    }
    throw err;
  }

  return res.status(201).json({
    message: 'Request submitted. An admin will review your account.',
  });
}

export function logout(_req, res) {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out.' });
}

export function me(req, res) {
  const { id, first_name, last_name, email, role, avatar_url } = req.user;
  return res.status(200).json({ id, first_name, last_name, email, role, avatar_url });
}