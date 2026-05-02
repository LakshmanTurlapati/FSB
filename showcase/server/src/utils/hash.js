const crypto = require('crypto');

/**
 * Generate a random 64-char hex hash key
 * @returns {string} Hash key
 */
function generateHashKey() {
  return crypto.randomBytes(32).toString('hex');
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
