import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const SALT_ROUNDS = 12;
const JWT_EXPIRES = '7d';

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
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
  const user = await User.create({ firstName, lastName, email, passwordHash, role: safeRole });

  const token = signToken(user);
  res.cookie('token', token, cookieOpts);
  return res.status(201).json({ user });
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(safeUser);
  res.cookie('token', token, cookieOpts);
  return res.status(200).json({ user: safeUser });
}

export function logout(_req, res) {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out.' });
}