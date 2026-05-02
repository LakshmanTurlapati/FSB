/**
 * Phase 212-01 regression tests
 *
 * Verifies the preservation invariants of the background-agents sunset:
 *   - AGENTS-02: every agent code path carries the canonical deprecation annotation;
 *                MCP registerAgentTools shell preserved with zero registered tools.
 *   - AGENTS-05: chrome.storage.local['bgAgents'] is NOT proactively cleaned by Phase 212.
 *   - AGENTS-06: chrome.alarms.onAlarm listener preserves the MCP_RECONNECT_ALARM early-return
 *                BYTE-FOR-BYTE, and the Phase 211-02 dom-stream watchdog branch is untouched.
 *
 * Plain Node + assert. No jsdom, no chrome stubs. Static-analysis on source files.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const ANNOTATION = '// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function countSubstring(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

let failures = 0;
function pass(label) { console.log('PASS - ' + label); }
function fail(label, detail) {
  failures += 1;
  console.log('FAIL - ' + label);
  if (detail) console.log('       ' + detail);
}

// ---- Section 1: AGENTS-02 canonical annotation present in every modified back-end file ----

const annotationFiles = [
  'agents/agent-manager.js',
  'agents/agent-scheduler.js',
  'agents/agent-executor.js',
  'agents/server-sync.js',
  'mcp-server/src/tools/agents.ts',
  'background.js',
  'ws/ws-client.js',
];

for (const f of annotationFiles) {
  const src = read(f);
  const n = countSubstring(src, ANNOTATION);
  if (n >= 1) pass('AGENTS-02 annotation present in ' + f + ' (count=' + n + ')');
  else fail('AGENTS-02 annotation MISSING in ' + f);
}

// ---- Section 2: AGENTS-02 zero LIVE server.tool() calls in mcp-server/src/tools/agents.ts ----

{
  const src = read('mcp-server/src/tools/agents.ts');
  const lines = src.split('\n');
  const liveServerTool = lines.filter(line => /^[\s]*server\.tool\(/.test(line));
  if (liveServerTool.length === 0) pass('AGENTS-02 zero LIVE server.tool() calls in agents.ts');
  else fail('AGENTS-02 found ' + liveServerTool.length + ' LIVE server.tool() calls in agents.ts', JSON.stringify(liveServerTool.slice(0, 3)));
}

// ---- Section 3: AGENTS-02 registerAgentTools function shell preserved in runtime.ts (D-16) ----

{
  const src = read('mcp-server/src/runtime.ts');
  const hasImport = /^\s*import\s*\{\s*registerAgentTools\s*\}\s*from\s*['"]\.\/tools\/agents\.js['"]/m.test(src);
  const hasCall = /^\s*registerAgentTools\(server,\s*bridge,\s*queue\)\s*;/m.test(src);
  if (hasImport && hasCall) pass('AGENTS-02 registerAgentTools import + call preserved in runtime.ts');
  else fail('AGENTS-02 registerAgentTools shell broken (import=' + hasImport + ', call=' + hasCall + ')');
}

// ---- Section 4: AGENTS-06 MCP_RECONNECT_ALARM early-return preserved BYTE-FOR-BYTE ----

{
  const src = read('background.js');
  // The exact byte-for-byte substring (matches lines 12579-12582 indentation in current file)
  const expected = '  if (isMcpReconnectAlarm) {\n    armMcpBridge(\'alarm:\' + MCP_RECONNECT_ALARM);\n    return;\n  }';
  if (src.indexOf(expected) !== -1) pass('AGENTS-06 MCP_RECONNECT_ALARM early-return byte-for-byte preserved');
  else fail('AGENTS-06 MCP_RECONNECT_ALARM early-return path mutated or missing', 'Expected substring not found');
}

// ---- Section 5: AGENTS-06 Phase 211-02 dom-stream watchdog branch preserved on a LIVE line ----

{
  const src = read('background.js');
  const lines = src.split('\n');
  const hits = lines.filter(line => /if\s*\(alarm\.name\s*===\s*'fsb-domstream-watchdog'\)/.test(line));
  const liveHits = hits.filter(line => !/^\s*\/\//.test(line));
  if (liveHits.length === 1) pass('AGENTS-06 Phase 211-02 dom-stream watchdog branch is LIVE (and unique)');
  else fail('AGENTS-06 expected exactly 1 LIVE dom-stream watchdog hit, found ' + liveHits.length);
}

// ---- Section 6: AGENTS-05 no chrome.storage cleanup of bgAgents in modified files ----

const cleanupTargets = [
  'background.js',
  'agents/agent-manager.js',
  'agents/agent-scheduler.js',
  'agents/agent-executor.js',
  'agents/server-sync.js',
  'ws/ws-client.js',
];

{
  let violations = [];
  for (const f of cleanupTargets) {
    const src = read(f);
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\/\//.test(line)) continue; // skip commented lines

      if (/chrome\.storage\.local\.remove\([^)]*bgAgents/.test(line)) {
        violations.push(f + ':' + (i + 1) + ' chrome.storage.local.remove(bgAgents)');
      }
      if (/chrome\.storage\.local\.set\(\s*\{[^}]*bgAgents\s*:/.test(line)) {
        violations.push(f + ':' + (i + 1) + ' chrome.storage.local.set({ bgAgents: ... })');
      }
      if (/chrome\.alarms\.clear\([^)]*['"]fsb_agent_/.test(line)) {
        violations.push(f + ':' + (i + 1) + ' chrome.alarms.clear with fsb_agent_ prefix');
      }
    }
  }
  if (violations.length === 0) pass('AGENTS-05 no LIVE bgAgents cleanup or fsb_agent_ alarm clear in modified files');
  else fail('AGENTS-05 found ' + violations.length + ' violation(s)', violations.slice(0, 5).join('; '));
}

// ---- Result ----

assert.strictEqual(typeof failures, 'number');

if (failures === 0) {
  console.log('');
  console.log('All Phase 212-01 regression checks PASSED');
  process.exit(0);
} else {
  console.log('');
  console.log(failures + ' check(s) FAILED');
  process.exit(1);
}
