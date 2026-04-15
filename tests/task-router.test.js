/**
 * Tests for AI task start routing helpers.
 * Run: node tests/task-router.test.js
 */

const {
  buildSearchRoute,
  sanitizeRouteDecision,
  resolveTaskStartRoute
} = require('../utils/task-router.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

console.log('\n--- buildSearchRoute tests ---');

const searchRoute = buildSearchRoute('compare flights to Austin');
assert(searchRoute.mode === 'search_url', 'buildSearchRoute returns search_url mode');
assert(searchRoute.url.includes('google.com/search'), 'buildSearchRoute returns Google search URL');
assert(searchRoute.searchQuery === 'compare flights to Austin', 'buildSearchRoute preserves search query');

console.log('\n--- sanitizeRouteDecision tests ---');

const directRoute = sanitizeRouteDecision({
  mode: 'direct_url',
  url: 'mail.google.com/mail/u/0/#inbox',
  siteLabel: 'Gmail',
  confidence: 0.92,
  reason: 'Inbox task'
}, 'check my gmail inbox');

assert(directRoute.mode === 'direct_url', 'sanitizeRouteDecision keeps valid direct_url');
assert(directRoute.url.startsWith('https://mail.google.com/'), 'sanitizeRouteDecision adds https to bare host');
assert(directRoute.siteLabel === 'Gmail', 'sanitizeRouteDecision preserves site label');

const invalidRoute = sanitizeRouteDecision({
  mode: 'direct_url',
  url: 'chrome://settings',
  confidence: 0.9
}, 'open browser settings');

assert(invalidRoute.mode === 'search_url', 'invalid restricted URL falls back to search');
assert(invalidRoute.url.includes('google.com/search'), 'restricted URL fallback uses search');

console.log('\n--- resolveTaskStartRoute tests ---');

async function runResolveTests() {
  globalThis.UniversalProvider = class {
    constructor() {}
    async buildRequest() {
      return { messages: [], max_tokens: 100 };
    }
    async sendRequest() {
      return {
        choices: [{
          message: {
            content: '{"mode":"direct_url","url":"https://www.linkedin.com/jobs/","siteLabel":"LinkedIn Jobs","confidence":0.88,"reason":"Jobs task"}'
          }
        }]
      };
    }
  };

  const aiDirectRoute = await resolveTaskStartRoute('find React jobs on LinkedIn', {
    settings: { modelProvider: 'openai', modelName: 'gpt-4o-mini' },
    triggerSource: 'extension'
  });

  assert(aiDirectRoute.mode === 'direct_url', 'resolveTaskStartRoute accepts valid AI direct route');
  assert(aiDirectRoute.url === 'https://www.linkedin.com/jobs/', 'resolveTaskStartRoute keeps AI URL');

  globalThis.UniversalProvider = class {
    constructor() {}
    async buildRequest() {
      return { messages: [], max_tokens: 100 };
    }
    async sendRequest() {
      return {
        choices: [{
          message: {
            content: '{"mode":"direct_url","url":"chrome://newtab","confidence":0.75,"reason":"bad route"}'
          }
        }]
      };
    }
  };

  const aiFallbackRoute = await resolveTaskStartRoute('compare the best noise cancelling headphones', {
    settings: { modelProvider: 'openai', modelName: 'gpt-4o-mini' },
    triggerSource: 'dashboard'
  });

  assert(aiFallbackRoute.mode === 'search_url', 'resolveTaskStartRoute falls back when AI returns restricted URL');
  assert(aiFallbackRoute.searchQuery.includes('noise cancelling headphones'), 'fallback keeps the task as search query');

  delete globalThis.UniversalProvider;

  const unavailableRoute = await resolveTaskStartRoute('research mechanical keyboards', {
    settings: null,
    triggerSource: 'mcp'
  });

  assert(unavailableRoute.mode === 'search_url', 'resolveTaskStartRoute falls back when provider is unavailable');

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

runResolveTests().catch((error) => {
  console.error('Test harness failed:', error);
  process.exit(1);
});
