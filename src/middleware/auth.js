const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_energy_key';

/**
 * authenticate - Express middleware that verifies a Bearer JWT token.
 *
 * Usage: apply to any protected route.
 *   router.get('/protected', authenticate, (req, res) => { ... });
 *
 * On success, attaches the decoded payload to `req.user` and calls next().
 * On failure, responds with 401 or 403.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authorization header missing or malformed. Expected: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = decoded;
    next();
  });
};

module.exports = { authenticate };
