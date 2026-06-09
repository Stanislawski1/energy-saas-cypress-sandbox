const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/billing
 * Protected: requires a valid Bearer JWT.
 * Returns all invoices for the authenticated user.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
    });

    res.json({ invoices });
  } catch (err) {
    console.error('[billing] Error fetching invoices:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/billing/generate
 * Protected: requires a valid Bearer JWT.
 * Creates a new pending invoice for the authenticated user.
 * Body: { amount: number } (optional, defaults to 0)
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const amount = req.body?.amount ?? 0;

    const invoice = await prisma.invoice.create({
      data: {
        userId: req.user.id,
        amount,
        status: 'Pending',
        date: new Date().toISOString().split('T')[0],
      },
    });

    res.json({
      message: 'Invoice generation started successfully.',
      status: 'processing',
      invoiceId: invoice.id,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[billing] Error generating invoice:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
