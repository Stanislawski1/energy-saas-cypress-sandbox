/**
 * server.js - Main application entry point.
 *
 * Architecture:
 *   - Express Routers are split into /src/routes/
 *   - JWT auth middleware lives in /src/middleware/auth.js
 *   - Database access is via Prisma ORM (/prisma/schema.prisma)
 */

const express = require('express');
const path = require('path');

// Route modules
const authRoutes = require('./src/routes/auth.routes');
const telemetryRoutes = require('./src/routes/telemetry.routes');
const billingRoutes = require('./src/routes/billing.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────────────────────
// Auth routes  →  POST /api/login
app.use('/api', authRoutes);

// Telemetry routes  →  GET /api/telemetry  (protected)
app.use('/api/telemetry', telemetryRoutes);

// Billing routes  →  GET /api/billing, POST /api/billing/generate  (protected)
app.use('/api/billing', billingRoutes);

// ── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ B2B Energy SaaS platform running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
