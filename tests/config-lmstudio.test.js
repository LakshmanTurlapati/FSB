'use strict';

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
  assert(actual === expected, msg + ' (expected: ' + expected + ', got: ' + actual + ')');
}

const cfg = new Config();

console.log('\n--- Config defaults ---');
assert('openaiApiKey' in cfg.defaults, 'defaults include openaiApiKey');
assert('anthropicApiKey' in cfg.defaults, 'defaults include anthropicApiKey');
assert('customApiKey' in cfg.defaults, 'defaults include customApiKey');
assert('customEndpoint' in cfg.defaults, 'defaults include customEndpoint');
assertEqual(cfg.defaults.lmstudioBaseUrl, 'http://localhost:1234', 'defaults include LM Studio localhost URL');

console.log('\n--- Model validation ---');
assertEqual(
  cfg.validateAndCorrectModel('qwen/qwen3-30b-a3b', 'lmstudio'),
  'qwen/qwen3-30b-a3b',
  'LM Studio preserves arbitrary discovered model ids'
);
assertEqual(
  cfg.validateAndCorrectModel('', 'lmstudio'),
  '',
  'LM Studio leaves blank model selection blank'
);
assertEqual(
  cfg.validateAndCorrectModel('custom/endpoint-model', 'custom'),
  'custom/endpoint-model',
  'Custom provider preserves arbitrary model ids'
);
assertEqual(
  cfg.validateAndCorrectModel('not-a-real-openrouter-model', 'openrouter'),
  'openai/gpt-4o',
  'OpenRouter still falls back to its built-in default model'
);

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
