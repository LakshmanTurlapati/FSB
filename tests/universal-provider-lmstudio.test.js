'use strict';

const {
  UniversalProvider,
  normalizeProviderBaseUrl,
  buildProviderModelsEndpoint,
  parseOpenAICompatibleModelList
} = require('../ai/universal-provider.js');

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
  assert(actual === expected, msg + ' (expected: ' + expected + ', got: ' + actual + ')');
}

console.log('\n--- LM Studio endpoint normalization ---');
assertEqual(
  normalizeProviderBaseUrl('lmstudio', 'localhost:1234/v1'),
  'http://localhost:1234',
  'strips /v1 and prepends http://'
);
assertEqual(
  normalizeProviderBaseUrl('lmstudio', 'http://localhost:1234/v1/chat/completions/'),
  'http://localhost:1234',
  'strips chat completions suffix'
);
assertEqual(
  buildProviderModelsEndpoint('lmstudio', 'localhost:1234/v1/chat/completions'),
  'http://localhost:1234/v1/models',
  'builds LM Studio /v1/models discovery endpoint'
);

console.log('\n--- LM Studio model list parsing ---');
const parsedIds = parseOpenAICompatibleModelList({
  data: [
    { id: 'qwen/qwen3-30b-a3b' },
    { id: 'mistral-small-3.1' },
    { id: 'qwen/qwen3-30b-a3b' },
    {}
  ]
});
assertEqual(parsedIds.length, 2, 'deduplicates repeated model ids');
assertEqual(parsedIds[0], 'qwen/qwen3-30b-a3b', 'preserves first discovered model id');
assertEqual(parsedIds[1], 'mistral-small-3.1', 'preserves second discovered model id');

console.log('\n--- LM Studio UniversalProvider behavior ---');
const provider = new UniversalProvider({
  modelProvider: 'lmstudio',
  modelName: 'qwen/qwen3-30b-a3b',
  lmstudioBaseUrl: 'localhost:1234/v1'
});
assertEqual(
  provider.getEndpoint(),
  'http://localhost:1234/v1/chat/completions',
  'LM Studio provider uses normalized local chat completions endpoint'
);
const headers = provider.getHeaders();
assertEqual(headers['Content-Type'], 'application/json', 'LM Studio requests keep JSON content type');
assert(!('Authorization' in headers), 'LM Studio requests omit Authorization header');

const defaultProvider = new UniversalProvider({
  modelProvider: 'lmstudio',
  modelName: 'local-model'
});
assertEqual(
  defaultProvider.getEndpoint(),
  'http://localhost:1234/v1/chat/completions',
  'LM Studio provider defaults to localhost:1234 when no URL is configured'
);

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
