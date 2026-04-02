/**
 * Tests for BackgroundAgentManager start-mode handling.
 * Run: node tests/agent-manager-start-mode.test.js
 */

const fs = require('fs');
const vm = require('vm');

const storage = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') {
          return { [key]: storage[key] };
        }
        return {};
      },
      async set(update) {
        Object.assign(storage, update);
      }
    }
  }
};

const src = fs.readFileSync('agents/agent-manager.js', 'utf8');
vm.runInThisContext(src);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

(async () => {
  console.log('\n--- createAgent tests ---');

  const pinnedAgent = await agentManager.createAgent({
    name: 'Pinned Agent',
    task: 'Check the inbox',
    startMode: 'pinned',
    targetUrl: 'https://mail.google.com',
    schedule: { type: 'interval', intervalMinutes: 30 }
  });

  assert(pinnedAgent.startMode === 'pinned', 'createAgent stores pinned start mode');
  assert(pinnedAgent.targetUrl === 'https://mail.google.com/', 'createAgent normalizes pinned URL');

  const aiRoutedAgent = await agentManager.createAgent({
    name: 'AI Routed Agent',
    task: 'Compare the best flight options to Austin',
    startMode: 'ai_routed',
    schedule: { type: 'daily', dailyTime: '09:00' }
  });

  assert(aiRoutedAgent.startMode === 'ai_routed', 'createAgent stores ai_routed start mode');
  assert(aiRoutedAgent.targetUrl === '', 'ai_routed agent clears targetUrl');

  let pinnedError = null;
  try {
    await agentManager.createAgent({
      name: 'Broken Agent',
      task: 'This should fail',
      startMode: 'pinned',
      schedule: { type: 'once' }
    });
  } catch (error) {
    pinnedError = error;
  }
  assert(!!pinnedError, 'createAgent rejects pinned agents without targetUrl');

  console.log('\n--- updateAgent tests ---');

  const updated = await agentManager.updateAgent(pinnedAgent.agentId, {
    startMode: 'ai_routed'
  });

  assert(updated.startMode === 'ai_routed', 'updateAgent switches start mode to ai_routed');
  assert(updated.targetUrl === '', 'updateAgent clears targetUrl when switching to ai_routed');

  const normalizedAgents = await agentManager.listAgents();
  const reloadedPinned = normalizedAgents.find(agent => agent.agentId === pinnedAgent.agentId);
  assert(reloadedPinned && reloadedPinned.startMode === 'ai_routed', 'listAgents returns normalized startMode');

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
})().catch((error) => {
  console.error('Test harness failed:', error);
  process.exit(1);
});
