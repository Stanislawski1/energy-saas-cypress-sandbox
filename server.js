const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const port = 3000;
const SECRET_KEY = 'super_secret_energy_key';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    company TEXT
  )`);

  db.run(`CREATE TABLE billing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    status TEXT,
    date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Insert 2 fake users
  const stmtUsers = db.prepare("INSERT INTO users (username, password, company) VALUES (?, ?, ?)");
  stmtUsers.run("admin", "password123", "Acme Energy Corp");
  stmtUsers.run("demo", "demo", "Global Power Inc");
  stmtUsers.finalize();

  // Insert billing records
  const stmtBilling = db.prepare("INSERT INTO billing (user_id, amount, status, date) VALUES (?, ?, ?, ?)");
  stmtBilling.run(1, 1500.50, "Paid", "2026-05-01");
  stmtBilling.run(1, 1620.00, "Pending", "2026-06-01");
  stmtBilling.run(2, 850.75, "Paid", "2026-05-15");
  stmtBilling.finalize();
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header missing' });
  }
};

// --- API Endpoints ---

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      const token = jwt.sign({ id: row.id, username: row.username, company: row.company }, SECRET_KEY, { expiresIn: '1h' });
      res.json({ token, user: { username: row.username, company: row.company } });
    } else {
      res.status(401).json({ error: 'Invalid credentials. Try admin/password123 or demo/demo' });
    }
  });
});

// GET /api/telemetry
app.get('/api/telemetry', authenticate, (req, res) => {
  // Generate fake telemetry data
  const data = Array.from({ length: 24 }, (_, i) => ({
    time: `${i.toString().padStart(2, '0')}:00`,
    consumption_kwh: Math.floor(Math.random() * 50) + 10,
    peak_demand_kw: Math.floor(Math.random() * 20) + 5
  }));
  
  res.json({
    company: req.user.company,
    date: new Date().toISOString().split('T')[0],
    data
  });
});

// POST /api/billing/generate
app.post('/api/billing/generate', authenticate, (req, res) => {
  res.json({ 
    message: 'Invoice generation started successfully.', 
    status: 'processing',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for SPA behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`B2B Energy SaaS platform running at http://localhost:${port}`);
});
