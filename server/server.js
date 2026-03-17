const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { URL } = require('url');
const Database = require('better-sqlite3');
const { WebSocketServer } = require('ws');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initializeDatabase } = require('./src/db/schema');
const Queries = require('./src/db/queries');
const authMiddleware = require('./src/middleware/auth');
const createAuthRouter = require('./src/routes/auth');
const createAgentsRouter = require('./src/routes/agents');
const { setupWSHandler } = require('./src/ws/handler');

// Configuration
const PORT = parseInt(process.env.PORT) || 3847;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'fsb-data.db');

// Initialize database
const db = new Database(DB_PATH);
initializeDatabase(db);
const queries = new Queries(db);

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
    if (!req.path.startsWith('/assets')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Routes - auth (no middleware required for register)
app.use('/api/auth', createAuthRouter(queries));

// Routes - protected (require hash key)
const auth = authMiddleware(queries);
app.use('/api/agents', auth, createAgentsRouter(queries));
app.use('/api/stats', auth, (req, res) => {
  try {
    const stats = queries.getAgentStats(req.hashKey);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve showcase static files with cache headers
// In Docker: showcase is copied to /app/public
// Local dev: fall back to ../showcase relative to server/
const publicPath = path.join(__dirname, 'public');
const showcasePath = path.join(__dirname, '..', 'showcase');
const staticPath = require('fs').existsSync(publicPath) ? publicPath : showcasePath;

app.use(express.static(staticPath, {
  maxAge: '1d',
  etag: true
}));

// SPA fallback - serve index.html for dashboard routes
app.get('/dashboard*', (req, res) => {
  const indexPath = path.join(staticPath, 'dashboard.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(staticPath, 'index.html'));
  }
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

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Set up WS message handling
setupWSHandler(wss);

// WebSocket upgrade handler - authenticate via query params
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    // Only accept upgrades on /ws path
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const hashKey = url.searchParams.get('key');
    const role = url.searchParams.get('role') || 'dashboard';

    if (!hashKey) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Validate hash key
    const keyRecord = queries.validateHashKey(hashKey);
    if (!keyRecord) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Upgrade the connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { hashKey, role });
    });
  } catch (err) {
    console.error('WebSocket upgrade error:', err.message);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`[FSB Server] Running on http://localhost:${PORT}`);
  console.log(`[FSB Server] Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`[FSB Server] WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`[FSB Server] Database: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[FSB Server] Shutting down...');
  wss.close();
  server.close();
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  wss.close();
  server.close();
  db.close();
  process.exit(0);
});
