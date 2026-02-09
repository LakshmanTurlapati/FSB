const crypto = require('crypto');

/**
 * Generate an HMAC-SHA256 hash key
 * @param {string} secret - Server secret
 * @returns {string} Hash key
 */
function generateHashKey(secret) {
  const data = crypto.randomBytes(32).toString('hex') + Date.now().toString(36);
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Validate a hash key format (64-char hex string)
 * @param {string} key
 * @returns {boolean}
 */
function isValidHashKeyFormat(key) {
  return typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
}

module.exports = { generateHashKey, isValidHashKeyFormat };
