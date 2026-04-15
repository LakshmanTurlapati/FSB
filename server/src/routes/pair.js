const crypto = require('crypto');
const express = require('express');

function createPairRouter(queries, authMiddleware) {
  const router = express.Router();

  // POST /api/pair/generate - Generate a one-time pairing token
  // Requires X-FSB-Hash-Key header (authenticated)
  router.post('/generate', authMiddleware, (req, res) => {
    try {
      const hashKey = req.hashKey;

      // Clean expired tokens opportunistically
      queries.cleanExpiredPairingTokens();

      // Invalidate existing unused tokens for this hash key
      queries.invalidatePairingTokens(hashKey);

      // Generate new one-time token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60 seconds

      queries.createPairingToken(token, hashKey, expiresAt);

      res.json({ token, expiresAt });
    } catch (error) {
      console.error('Failed to generate pairing token:', error.message);
      res.status(500).json({ error: 'Failed to generate pairing token' });
    }
  });

  // POST /api/pair/exchange - Exchange pairing token for session token
  // No auth header needed - the token IS the auth
  router.post('/exchange', (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token required' });

      const record = queries.getPairingToken(token);
      if (!record) return res.status(404).json({ error: 'Invalid or expired token' });

      if (record.used) return res.status(410).json({ error: 'Token already used' });

      const now = new Date();
      if (new Date(record.expires_at) < now) {
        return res.status(410).json({ error: 'Token expired' });
      }

      // Mark token as used, generate session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

      queries.consumePairingToken(token, sessionToken, sessionExpiresAt);

      res.json({
        hashKey: record.hash_key,
        sessionToken,
        expiresAt: sessionExpiresAt
      });
    } catch (error) {
      console.error('Failed to exchange pairing token:', error.message);
      res.status(500).json({ error: 'Failed to exchange token' });
    }
  });

  // GET /api/pair/validate - Validate a session token
  router.get('/validate', (req, res) => {
    const sessionToken = req.headers['x-fsb-session-token'];
    if (!sessionToken) return res.json({ valid: false });

    const record = queries.getSessionByToken(sessionToken);
    if (!record) return res.json({ valid: false });

    // Check session expiry
    if (record.session_expires_at && new Date(record.session_expires_at) < new Date()) {
      return res.json({ valid: false, reason: 'expired' });
    }

    res.json({
      valid: true,
      hashKey: record.hash_key,
      expiresAt: record.session_expires_at
    });
  });

  // POST /api/pair/revoke - Revoke a session
  router.post('/revoke', (req, res) => {
    const sessionToken = req.headers['x-fsb-session-token'];
    if (!sessionToken) return res.status(400).json({ error: 'Session token required' });

    queries.revokeSession(sessionToken);
    res.json({ revoked: true });
  });

  return router;
}

module.exports = createPairRouter;
