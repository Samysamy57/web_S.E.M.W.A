import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Vérifie le JWT puis contrôle que le compte est toujours actif en base
export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  // Vérification en base : compte existant ET is_active = true
  const user = await User.findById(req.user.sub);
  if (!user) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expirée ou compte désactivé.' });
  }

  req.user = user;
  next();
}

// Vérifie le rôle après requireAuth (inchangé)
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    next();
  };
}