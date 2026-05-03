/**
 * Regression checks for CostTracker initialization ordering.
 * Run: node tests/cost-tracker-ordering.test.js
 */

const fs = require('fs');
const path = require('path');
const { EXECUTION_MODES } = require('../extension/ai/engine-config.js');

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

const agentLoopPath = path.join(__dirname, '..', 'extension', 'ai', 'agent-loop.js');
const agentLoopSource = fs.readFileSync(agentLoopPath, 'utf8');

console.log('\n--- execution mode cost-limit tests ---');

const autopilotCostLimit = EXECUTION_MODES.autopilot?.safetyLimits?.costLimit;
const manualCostLimit = EXECUTION_MODES['mcp-manual']?.safetyLimits?.costLimit;

assert(typeof autopilotCostLimit === 'number', 'autopilot mode exposes a numeric cost limit');
assert(typeof manualCostLimit === 'number', 'mcp-manual mode exposes a numeric cost limit');
assert(manualCostLimit < autopilotCostLimit, 'mcp-manual cost limit remains tighter than autopilot');

console.log('\n--- agent-loop ordering tests ---');

const loadConfigIndex = agentLoopSource.indexOf("var sessionConfig = await _al_loadSessionConfig(session.mode || 'autopilot');");
const hydrateStateIndex = agentLoopSource.indexOf('hydrateAgentRunState(session, systemPrompt);');
const hydrateTrackerIndex = agentLoopSource.indexOf('hydrateCostTracker(session);');
const hydrateTrackerHelperIndex = agentLoopSource.indexOf('function hydrateCostTracker(session) {');
const newTrackerIndex = agentLoopSource.indexOf('session._costTracker = new _al_CostTracker(costLimit);');

assert(loadConfigIndex !== -1, 'agent-loop still resolves final session config through loadSessionConfig');
assert(hydrateStateIndex !== -1, 'agent-loop still hydrates session state before running');
assert(hydrateTrackerIndex !== -1, 'agent-loop now has an explicit CostTracker hydration step');
assert(hydrateTrackerHelperIndex !== -1, 'agent-loop defines a dedicated CostTracker hydration helper');
assert(newTrackerIndex !== -1, 'agent-loop still constructs _al_CostTracker');
assert(loadConfigIndex < hydrateStateIndex, 'loadSessionConfig happens before hydrateAgentRunState');
assert(loadConfigIndex < hydrateTrackerIndex, 'loadSessionConfig happens before hydrateCostTracker');
assert(hydrateStateIndex < hydrateTrackerIndex, 'CostTracker hydration happens after session state hydration');
assert(hydrateTrackerHelperIndex < newTrackerIndex, 'hydrateCostTracker owns the tracker construction path');

console.log('\n--- agent-loop hydration and breaker tests ---');

assert(agentLoopSource.includes('session._costTracker.totalCost = session.totalCost || 0;'), 'CostTracker hydration preserves totalCost');
assert(agentLoopSource.includes('session._costTracker.totalInputTokens = session.totalInputTokens || 0;'), 'CostTracker hydration preserves totalInputTokens');
assert(agentLoopSource.includes('session._costTracker.totalOutputTokens = session.totalOutputTokens || 0;'), 'CostTracker hydration preserves totalOutputTokens');
// Phase 231: cost circuit breaker REMOVED from checkSafetyBreakers — only iteration + time limits gate sessions now.
assert(!agentLoopSource.includes('var budget = session._costTracker.checkBudget();'), 'Phase 231: checkSafetyBreakers no longer calls CostTracker.checkBudget (cost limit removed)');
assert(agentLoopSource.includes('Cost circuit breaker REMOVED in Phase 231'), 'Phase 231: removal is documented in agent-loop.js');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
