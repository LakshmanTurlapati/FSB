const express = require('express');

function createSSERouter(sseClients) {
  const router = express.Router();

  // GET /api/sse - SSE stream for real-time updates
  router.get('/', (req, res) => {
    const hashKey = req.headers['x-fsb-hash-key'];
    if (!hashKey) {
      return res.status(401).json({ error: 'Missing X-FSB-Hash-Key header' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Register client
    if (!sseClients.has(hashKey)) {
      sseClients.set(hashKey, []);
    }
    sseClients.get(hashKey).push(res);

    // Send keepalive every 30 seconds
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      const clients = sseClients.get(hashKey);
      if (clients) {
        const index = clients.indexOf(res);
        if (index !== -1) clients.splice(index, 1);
        if (clients.length === 0) sseClients.delete(hashKey);
      }
    });
  });

  return router;
}

module.exports = createSSERouter;
