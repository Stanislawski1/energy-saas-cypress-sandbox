const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/telemetry
 * Protected: requires a valid Bearer JWT.
 * Returns: 24 hourly telemetry data points for the authenticated user's company.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Generate fresh hourly telemetry data for the response
    const data = Array.from({ length: 24 }, (_, i) => ({
      time: `${i.toString().padStart(2, '0')}:00`,
      consumption_kwh: Math.floor(Math.random() * 50) + 10,
      peak_demand_kw: Math.floor(Math.random() * 20) + 5,
    }));

    // Persist this telemetry snapshot to the DB for audit/history
    await prisma.telemetryData.createMany({
      data: data.map((d) => ({
        userId: req.user.id,
        time: d.time,
        consumptionKwh: d.consumption_kwh,
        peakDemandKw: d.peak_demand_kw,
      })),
    });

    res.json({
      company: req.user.company,
      date: new Date().toISOString().split('T')[0],
      data,
    });
  } catch (err) {
    console.error('[telemetry] Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
