/**
 * Authentication middleware - validates X-FSB-Hash-Key header
 */

function authMiddleware(queries) {
  return (req, res, next) => {
    const hashKey = req.headers['x-fsb-hash-key'];

    if (!hashKey) {
      return res.status(401).json({ error: 'Missing X-FSB-Hash-Key header' });
    }

    const keyRecord = queries.validateHashKey(hashKey);
    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid hash key' });
    }

    req.hashKey = hashKey;
    next();
  };
}

module.exports = authMiddleware;
