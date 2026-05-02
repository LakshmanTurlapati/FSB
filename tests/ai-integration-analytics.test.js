'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  assert(actual === expected, `${msg} (expected: ${expected}, got: ${actual})`);
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function readRepoFile() {
  return fs.readFileSync(path.join(__dirname, '..', ...arguments), 'utf8');
}

function loadAIIntegrationContext() {
  const aiSource = readRepoFile('extension', 'ai', 'ai-integration.js');
  const sendMessages = [];
  const directCalls = [];
  const sessionCostCalls = [];

  const context = {
    console,
    setTimeout,
    clearTimeout,
    self: {},
    window: undefined,
    // ai-integration.js builds prompt strings that reference navigator.userAgent
    // at module-evaluation time (e.g. Gmail Cmd/Ctrl-Enter fallback copy). The
    // service-worker runtime always provides navigator; the vm sandbox does not.
    navigator: { userAgent: 'node-test-harness' },
    importScripts: undefined,
    module: { exports: {} },
    exports: {},
    chrome: {
      runtime: {
        sendMessage(payload) {
          sendMessages.push(payload);
          return Promise.resolve({ success: true });
        }
      }
    },
    automationLogger: {
      debug() {},
      logTokenUsage() {},
      logComm() {},
      error() {},
      warn() {}
    },
    accumulateSessionCost() {
      sessionCostCalls.push(Array.from(arguments));
    }
  };

  vm.runInNewContext(`${aiSource}\nthis.__AIIntegration = AIIntegration;`, context, {
    filename: 'ai-integration.js'
  });

  context.__sendMessages = sendMessages;
  context.__directCalls = directCalls;
  context.__sessionCostCalls = sessionCostCalls;
  context.__setDirectAnalytics = function () {
    // Restored automation pipeline (commit 23c0ad1) uses initializeAnalytics,
    // not the cleaned-up getAnalytics shape. The integration test stub mirrors
    // that runtime contract.
    context.initializeAnalytics = () => ({
      trackUsage() {
        directCalls.push(Array.from(arguments));
        return Promise.resolve();
      }
    });
  };

  return context;
}

async function run() {
  const aiSource = readRepoFile('extension', 'ai', 'ai-integration.js');
  const backgroundSource = readRepoFile('extension', 'background.js');

  console.log('\n--- source-level regression checks ---');
  // Restored automation pipeline (23c0ad1) intentionally re-introduces
  // initializeAnalytics. Lock that contract instead of the older getAnalytics
  // shape that got reverted.
  assert(aiSource.includes("typeof initializeAnalytics !== 'undefined'"), 'AI integration probes initializeAnalytics for background tracking');
  assert(aiSource.includes('initializeAnalytics()'), 'AI integration invokes initializeAnalytics for direct tracking');
  assert(aiSource.includes("source: 'automation'"), 'TRACK_USAGE payload carries automation source explicitly');
  assert(backgroundSource.includes("source || 'automation'"), 'background TRACK_USAGE handler reads source instead of tokenSource');

  console.log('\n--- direct background analytics path ---');
  {
    const context = loadAIIntegrationContext();
    context.__setDirectAnalytics();
    const AIIntegration = context.__AIIntegration;
    const instance = {
      currentSessionId: 'session-direct',
      currentIteration: 3,
      settings: {
        modelProvider: 'openai',
        modelName: 'gpt-4o'
      },
      model: 'gpt-4o',
      lastPrompt: { role: 'user', content: 'hello world' },
      extractContent(response) {
        return response?.choices?.[0]?.message?.content || '';
      }
    };

    AIIntegration.prototype.trackTokenUsage.call(instance, {
      usage: {
        prompt_tokens: 123,
        completion_tokens: 45
      }
    }, true);

    await flushMicrotasks();

    assertEqual(context.__directCalls.length, 1, 'background tracking calls analytics directly once');
    assertEqual(context.__sendMessages.length, 0, 'background tracking does not fall back to runtime messaging');
    assertEqual(context.__directCalls[0][0], 'gpt-4o', 'direct tracking forwards model name');
    assertEqual(context.__directCalls[0][1], 123, 'direct tracking forwards input tokens');
    assertEqual(context.__directCalls[0][2], 45, 'direct tracking forwards output tokens');
    assertEqual(context.__directCalls[0][4], 'automation', 'direct tracking uses automation source');
    assertEqual(context.__directCalls[0][5], 'openai', 'direct tracking forwards provider');
    assertEqual(context.__sessionCostCalls.length, 1, 'background tracking still accumulates session cost');
  }

  console.log('\n--- runtime message fallback path ---');
  {
    const context = loadAIIntegrationContext();
    delete context.getAnalytics;
    const AIIntegration = context.__AIIntegration;
    const instance = {
      currentSessionId: 'session-fallback',
      currentIteration: 1,
      settings: {
        modelProvider: 'xai',
        modelName: 'grok-4-1-fast-reasoning'
      },
      model: 'grok-4-1-fast-reasoning',
      lastPrompt: 'prompt for token estimation',
      extractContent(response) {
        return response?.choices?.[0]?.message?.content || '';
      }
    };

    AIIntegration.prototype.trackTokenUsage.call(instance, {
      choices: [
        {
          message: {
            content: 'estimated completion text'
          }
        }
      ]
    }, true);

    await flushMicrotasks();

    assertEqual(context.__directCalls.length, 0, 'fallback path does not use direct analytics accessor');
    assertEqual(context.__sendMessages.length, 1, 'fallback path sends exactly one TRACK_USAGE message');
    assertEqual(context.__sendMessages[0].action, 'TRACK_USAGE', 'fallback payload uses TRACK_USAGE action');
    assertEqual(context.__sendMessages[0].data.source, 'automation', 'fallback payload keeps analytics source as automation');
    assertEqual(context.__sendMessages[0].data.tokenSource, 'estimated', 'fallback payload preserves tokenSource metadata');
  }

  console.log('\n--- analytics source normalization ---');
  {
    const storage = {
      fsbUsageData: [
        {
          timestamp: Date.now(),
          model: 'gpt-4o',
          inputTokens: 10,
          outputTokens: 5,
          success: true,
          source: 'api',
          cost: 0.1
        }
      ],
      fsbCurrentModel: 'gpt-4o'
    };
    global.chrome = {
      storage: {
        local: {
          async get() {
            return storage;
          },
          async set(update) {
            Object.assign(storage, update);
          }
        }
      }
    };

    const FSBAnalytics = require('../extension/utils/analytics.js');
    const originalStartSessionTimer = FSBAnalytics.prototype.startSessionTimer;
    FSBAnalytics.prototype.startSessionTimer = function () {};

    const analytics = new FSBAnalytics();
    await analytics.initPromise;

    assertEqual(analytics.usageData.length, 1, 'analytics loads stored usage entries');
    assertEqual(analytics.usageData[0].source, 'automation', 'legacy api source is normalized to automation');

    FSBAnalytics.prototype.startSessionTimer = originalStartSessionTimer;
    delete require.cache[require.resolve('../extension/utils/analytics.js')];
    delete global.chrome;
  }

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error('Test harness failed:', error);
  process.exit(1);
});
