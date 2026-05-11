import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  // Charge l'utilisateur complet depuis la DB → req.user.id sera disponible
  const user = await User.findById(req.user.sub);
  if (!user || !user.is_active) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expirée ou compte désactivé.' });
  }
  // On attache l'objet complet — req.user.id, req.user.role, etc. sont disponibles
  req.user = user;
    next();
  }

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}