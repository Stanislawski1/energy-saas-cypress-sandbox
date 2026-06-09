const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_energy_key';

/**
 * POST /api/login
 * Body: { username: string, password: string }
 * Returns: { token: string, user: { username, company } }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { username, password },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials. Try admin/password123 or demo/demo',
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, company: user.company },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: { username: user.username, company: user.company },
    });
  } catch (err) {
    console.error('[auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
