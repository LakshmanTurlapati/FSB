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
const createPairRouter = require('./src/routes/pair');
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
app.use('/api/pair', createPairRouter(queries, auth));
app.use('/api/stats', auth, (req, res) => {
  try {
    const stats = queries.getAgentStats(req.hashKey);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve showcase static files with cache headers
// In Docker: Angular dist is copied to /app/public
// Local dev: serve Angular dist output directly from showcase/dist/.
// The legacy vanilla showcase has been archived under showcase/legacy/ and is
// no longer served. If neither path exists, run `npm --prefix showcase/angular run build`.
const publicPath = path.join(__dirname, 'public');
const angularDistPath = path.join(__dirname, '..', 'showcase', 'dist', 'showcase-angular', 'browser');
const fs = require('fs');
const staticPath = fs.existsSync(publicPath)
  ? publicPath
  : fs.existsSync(angularDistPath)
    ? angularDistPath
    : null;
if (!staticPath) {
  console.warn('[server] No showcase build found at', publicPath, 'or', angularDistPath, '- run `npm --prefix showcase/angular run build` first.');
}

// Legacy .html redirects (per D-05)
const htmlRedirects = {
  '/index.html': '/',
  '/about.html': '/about',
  '/dashboard.html': '/dashboard',
  '/privacy.html': '/privacy',
  '/support.html': '/support',
};
app.get(Object.keys(htmlRedirects), (req, res) => {
  res.redirect(301, htmlRedirects[req.path]);
});

if (staticPath) {
  app.use(express.static(staticPath, {
    maxAge: 0,
    etag: true,
    setHeaders: function(res, filePath) {
      // Phase 216 SRV-03 / D-11: crawler files cache for 1 hour at the edge.
      // The .txt/.xml branch must come first and short-circuit so a future stray
      // filename (e.g. foo.html.txt) does not double-fire and pick up the no-cache header.
      if (filePath.endsWith('.txt') || filePath.endsWith('.xml')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return;
      }
      // Existing policy: prevent stale JS/CSS/HTML -- dashboard updates must take effect immediately.
      if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    }
  }));
}

// SPA fallback -- serve Angular index.html for all showcase routes (per D-04)
app.get(['/', '/about', '/dashboard', '/privacy', '/support'], (req, res) => {
  if (!staticPath) {
    res.status(503).type('text/plain').send('Showcase build not found. Run `npm --prefix showcase/angular run build` first.');
    return;
  }
  res.sendFile(path.join(staticPath, 'index.html'));
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
