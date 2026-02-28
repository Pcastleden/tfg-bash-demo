/**
 * Simple Bearer token auth middleware for admin routes.
 * Checks Authorization header against ADMIN_SECRET env var.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
  }

  if (token !== secret) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
}

module.exports = { requireAuth };
