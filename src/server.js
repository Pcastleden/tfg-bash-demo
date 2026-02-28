require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialise database on startup
const db = getDb();
console.log('[NOX] Database initialised');

// Auto-seed if database is empty (self-initialising for Railway deploys)
const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;
if (configCount === 0) {
  console.log('[NOX] Empty database detected — running seed...');
  const { runSeed } = require('../scripts/seed');
  runSeed(db);
  console.log('[NOX] Seed complete — database ready');
}

// Static files — widget
const widgetDir = path.resolve(__dirname, '..', 'widget');
app.get('/widget', (req, res) => {
  res.sendFile(path.join(widgetDir, 'index.html'));
});
app.use('/widget', express.static(widgetDir));

// Static files — admin build (served after Phase 6 build)
const adminDir = path.resolve(__dirname, '..', 'admin', 'dist');
app.use('/admin', express.static(adminDir));

// Routes
const chatRoutes = require('./routes/chat');
app.use('/api/chat', chatRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'nox-chatbot' });
});

// Admin SPA fallback — serve index.html for all /admin/* routes that aren't static files
const adminIndex = path.join(adminDir, 'index.html');
app.get('/admin/{*path}', (req, res) => {
  res.sendFile(adminIndex);
});

// Start
app.listen(PORT, () => {
  console.log(`[NOX] Server running on http://localhost:${PORT}`);
  console.log(`[NOX] Widget: http://localhost:${PORT}/widget`);
  console.log(`[NOX] Admin:  http://localhost:${PORT}/admin`);
});
