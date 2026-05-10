import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    console.log('User payload:', req.user);
    console.log('User ID:', req.user.userId);

    next();
  } catch (err) {
    console.error('JWT error:', err.message);

    res.clearCookie('token');
    return res.status(401).json({
      error: 'Session expired. Please log in again.'
    });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions.'
      });
    }

    next();
  };
}