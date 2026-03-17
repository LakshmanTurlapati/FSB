const express = require('express');
const { generateHashKey } = require('../utils/hash');

function createAuthRouter(queries) {
  const router = express.Router();

  // POST /api/auth/register - Generate a new hash key
  router.post('/register', (req, res) => {
    try {
      const hashKey = generateHashKey();
      queries.createHashKey(hashKey);
      res.json({ hashKey, message: 'Hash key created. Save this key - it cannot be recovered.' });
    } catch (error) {
      console.error('Failed to create hash key:', error.message);
      res.status(500).json({ error: 'Failed to generate hash key' });
    }
  });

  // GET /api/auth/validate - Validate a hash key (requires auth header)
  router.get('/validate', (req, res) => {
    const hashKey = req.headers['x-fsb-hash-key'];
    if (!hashKey) {
      return res.json({ valid: false, error: 'No hash key provided' });
    }

    const keyRecord = queries.validateHashKey(hashKey);
    res.json({
      valid: !!keyRecord,
      createdAt: keyRecord?.created_at || null
    });
  });

  return router;
}

module.exports = createAuthRouter;
