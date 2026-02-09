const path = require('path');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initializeDatabase } = require('./src/db/schema');
const Queries = require('./src/db/queries');
const authMiddleware = require('./src/middleware/auth');
const createAuthRouter = require('./src/routes/auth');
const createAgentsRouter = require('./src/routes/agents');
const createSSERouter = require('./src/routes/sse');

// Configuration
const PORT = parseInt(process.env.PORT) || 3847;
const SERVER_SECRET = process.env.FSB_SERVER_SECRET || 'fsb-default-secret-change-me';
const DB_PATH = path.join(__dirname, 'fsb-data.db');

// Initialize database
const db = new Database(DB_PATH);
initializeDatabase(db);
const queries = new Queries(db);

// SSE client tracking
const sseClients = new Map(); // hashKey -> [res, res, ...]

// Express app
const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['X-FSB-Hash-Key']
}));
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/sse' && !req.path.startsWith('/assets')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Routes - auth (no middleware required for register)
app.use('/api/auth', createAuthRouter(queries, SERVER_SECRET));

// Routes - protected (require hash key)
const auth = authMiddleware(queries);
app.use('/api/agents', auth, createAgentsRouter(queries, sseClients));
app.use('/api/stats', auth, (req, res) => {
  try {
    const stats = queries.getAgentStats(req.hashKey);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.use('/api/sse', createSSERouter(sseClients));

// Serve dashboard static files
const dashboardPath = path.join(__dirname, 'dashboard', 'dist');
app.use(express.static(dashboardPath));

// SPA fallback - serve index.html for dashboard routes
app.get('/dashboard*', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// Root redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[FSB Server] Running on http://localhost:${PORT}`);
  console.log(`[FSB Server] Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`[FSB Server] Database: ${DB_PATH}`);
  if (SERVER_SECRET === 'fsb-default-secret-change-me') {
    console.log('[FSB Server] WARNING: Using default secret. Set FSB_SERVER_SECRET in .env for production.');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[FSB Server] Shutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});
