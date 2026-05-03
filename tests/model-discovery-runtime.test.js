'use strict';

/**
 * Phase 228 / Plan 03 — Runtime wiring tests.
 *
 * Verifies that:
 *   1. validateAndCorrectModel consults the discovery cache before applying
 *      the legacy hardcoded xaiCorrections rewrites.
 *   2. Legacy xaiCorrections still apply for explicit known-bad ids.
 *   3. getDiscoveredModelIds returns a read-only view of the cache.
 *   4. Empty/missing modelName still returns the per-provider default.
 *   5. lmstudio/custom providers still pass through unchanged.
 *
 * GUARD-02: No network IO; cache primed via discoverModels with mocked fetch.
 */

const {
  discoverModels,
  clearDiscoveryCache,
  getDiscoveredModelIds
} = require('../extension/ai/model-discovery.js');
const { Config } = require('../extension/config/config.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}
function assertEqual(actual, expected, msg) {
  assert(actual === expected, msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
}

// --- fetch mock ---------------------------------------------------------------
const realFetch = globalThis.fetch;
function setFetch(fn) { globalThis.fetch = fn; }
function restoreFetch() { globalThis.fetch = realFetch; }
function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  });
}

async function primeAnthropicCache(ids) {
  clearDiscoveryCache();
  const data = ids.map((id, i) => ({
    id,
    type: 'model',
    display_name: id,
    created_at: new Date(2026, 0, i + 1).toISOString()
  }));
  setFetch(() => jsonResponse(200, { data }));
  const result = await discoverModels('anthropic', 'sk-ant-test-runtime');
  restoreFetch();
  return result;
}

async function primeXaiCache(ids) {
  clearDiscoveryCache();
  const data = ids.map(id => ({ id, created: 1700000000 }));
  setFetch(() => jsonResponse(200, { data }));
  const result = await discoverModels('xai', 'sk-xai-test-runtime');
  restoreFetch();
  return result;
}

async function main() {
  console.log('\n--- getDiscoveredModelIds (empty cache) ---');
  clearDiscoveryCache();
  assert(typeof getDiscoveredModelIds === 'function', 'getDiscoveredModelIds exported');
  const empty = getDiscoveredModelIds('anthropic');
  assert(Array.isArray(empty) && empty.length === 0, 'returns [] when cache empty');
  assertEqual(getDiscoveredModelIds('').length, 0, 'returns [] for falsy provider');

  console.log('\n--- getDiscoveredModelIds (populated cache) ---');
  await primeAnthropicCache(['claude-some-brand-new-model', 'claude-sonnet-4-6']);
  const ids = getDiscoveredModelIds('anthropic');
  assert(ids.includes('claude-some-brand-new-model'), 'includes brand new id');
  assert(ids.includes('claude-sonnet-4-6'), 'includes existing id');
  assertEqual(getDiscoveredModelIds('xai').length, 0, 'isolated by provider');

  console.log('\n--- validateAndCorrectModel + discovery cache ---');
  // Cache from above is still primed for anthropic
  assert(typeof globalThis.getDiscoveredModelIds === 'function', 'getDiscoveredModelIds attached to globalThis');
  const cfg = new Config();
  assertEqual(
    cfg.validateAndCorrectModel('claude-some-brand-new-model', 'anthropic'),
    'claude-some-brand-new-model',
    'discovered id preserved unchanged'
  );

  console.log('\n--- validateAndCorrectModel empty cache, unknown id ---');
  clearDiscoveryCache();
  assertEqual(
    cfg.validateAndCorrectModel('claude-some-brand-new-model', 'anthropic'),
    'claude-some-brand-new-model',
    'unknown anthropic id preserved with empty cache (not silently rewritten)'
  );

  console.log('\n--- validateAndCorrectModel legacy xaiCorrections ---');
  clearDiscoveryCache();
  assertEqual(
    cfg.validateAndCorrectModel('grok-3-fast', 'xai'),
    'grok-4-1-fast',
    'legacy xaiCorrections still applies (grok-3-fast -> grok-4-1-fast)'
  );
  assertEqual(
    cfg.validateAndCorrectModel('grok-beta', 'xai'),
    'grok-3',
    'legacy xaiCorrections still applies (grok-beta -> grok-3)'
  );

  console.log('\n--- validateAndCorrectModel known xai id, empty cache ---');
  clearDiscoveryCache();
  assertEqual(
    cfg.validateAndCorrectModel('grok-4-1-fast', 'xai'),
    'grok-4-1-fast',
    'FALLBACK_MODELS xai id preserved with empty cache'
  );

  console.log('\n--- validateAndCorrectModel empty modelName ---');
  clearDiscoveryCache();
  assertEqual(
    cfg.validateAndCorrectModel('', 'openai'),
    'gpt-4o',
    'empty openai modelName falls back to default'
  );
  assertEqual(
    cfg.validateAndCorrectModel(undefined, 'gemini'),
    'gemini-2.5-flash',
    'undefined gemini modelName falls back to default'
  );

  console.log('\n--- validateAndCorrectModel lmstudio/custom passthrough ---');
  assertEqual(
    cfg.validateAndCorrectModel('arbitrary/local-model', 'lmstudio'),
    'arbitrary/local-model',
    'lmstudio passes arbitrary id'
  );
  assertEqual(
    cfg.validateAndCorrectModel('vendor/custom-thing', 'custom'),
    'vendor/custom-thing',
    'custom passes arbitrary id'
  );

  console.log('\n--- validateAndCorrectModel xai brand-new discovered id ---');
  await primeXaiCache(['grok-5-future']);
  assertEqual(
    cfg.validateAndCorrectModel('grok-5-future', 'xai'),
    'grok-5-future',
    'discovered brand-new xai id preserved (not rewritten by xaiCorrections fallback)'
  );

  // grok-3-fast still corrected even when other xai ids are in cache
  // (not in cache, but matches legacy correction map)
  assertEqual(
    cfg.validateAndCorrectModel('grok-3-fast', 'xai'),
    'grok-4-1-fast',
    'legacy xaiCorrections still applies even with non-empty xai cache'
  );

  clearDiscoveryCache();

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
