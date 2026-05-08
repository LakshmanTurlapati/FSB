'use strict';

/**
 * Phase 241 plan 03 task 2 -- LOCK-04 negative invariant
 * (D-13: NO idle timeout exists for agents).
 *
 * This test codifies the negative: no setInterval, no chrome.alarms, and
 * no idle-keyword scheduling lives in the agent registry. The only
 * setTimeout call sites permitted are the connection_id-keyed grace
 * window (stage + hydrate-recovery) introduced in Plan 01.
 *
 * Behavioral check (Test 4) proves an agent persists across a quiet
 * period -- no background timer kicks in to release it.
 *
 * Run: node tests/agent-no-idle.test.js
 *
 * If a future change re-introduces idle reaping (D-13 violation), this
 * test breaks the build with a clear, grep-level failure.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.resolve(__dirname, '..', 'extension', 'utils', 'agent-registry.js');
const REGISTRY_MODULE_PATH = require.resolve('../extension/utils/agent-registry.js');

function freshRequireRegistry() {
  delete require.cache[REGISTRY_MODULE_PATH];
  return require(REGISTRY_MODULE_PATH);
}

function readRegistrySource() {
  return fs.readFileSync(REGISTRY_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// Strip comments + string literals from JS source so grep-level negatives
// only fire on actual code, not on documentation that mentions the forbidden
// API names. Conservative impl: line-comments, block-comments, and double /
// single quoted string literals.
// ---------------------------------------------------------------------------
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    // Line comment
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String literal: ', ", `
    if (c === '\'' || c === '"' || c === '`') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

(async () => {
  const rawSrc = readRegistrySource();
  const codeOnly = stripCommentsAndStrings(rawSrc);

  // -------------------------------------------------------------------------
  // Test 1: registry source has zero setInterval call sites.
  // -------------------------------------------------------------------------
  console.log('--- Test 1: agent-registry.js contains NO setInterval (LOCK-04) ---');
  {
    const matches = codeOnly.match(/\bsetInterval\s*\(/g) || [];
    assert.strictEqual(matches.length, 0,
      'agent-registry.js must not contain setInterval (D-13: no idle reaper). Found: ' + matches.length);
  }
  console.log('  PASS: no setInterval in registry');

  // -------------------------------------------------------------------------
  // Test 2: registry source has zero chrome.alarms references.
  //
  // RESEARCH Pitfall 1: chrome.alarms.create has a 30s minimum which would
  // BLOCK the 10s RECONNECT_GRACE_MS. The registry must use setTimeout for
  // grace, never chrome.alarms.
  // -------------------------------------------------------------------------
  console.log('--- Test 2: agent-registry.js contains NO chrome.alarms (LOCK-04 + RESEARCH Pitfall 1) ---');
  {
    const matches = codeOnly.match(/chrome\.alarms/g) || [];
    assert.strictEqual(matches.length, 0,
      'agent-registry.js must not reference chrome.alarms (30s floor blocks 10s grace). Found: ' + matches.length);
  }
  console.log('  PASS: no chrome.alarms in registry');

  // -------------------------------------------------------------------------
  // Test 3: registry source contains no idle-keyword scheduling identifiers.
  //
  // CONTEXT.md deferred-ideas list explicitly forbids idleTimeout / idleReaper
  // / reapIdle. A future drift adding these keywords (in CODE, not in docs)
  // breaks the test.
  // -------------------------------------------------------------------------
  console.log('--- Test 3: agent-registry.js contains NO idle-keyword scheduling identifiers ---');
  {
    const forbidden = ['idleTimeout', 'idleReaper', 'reapIdle'];
    forbidden.forEach((id) => {
      const re = new RegExp('\\b' + id + '\\b', 'i');
      assert.ok(!re.test(codeOnly),
        'agent-registry.js code must not contain identifier "' + id + '" (D-13)');
    });
  }
  console.log('  PASS: no idle-scheduling identifiers in registry');

  // -------------------------------------------------------------------------
  // Test 4: behavioral -- agent persists across simulated quiet period.
  // -------------------------------------------------------------------------
  console.log('--- Test 4: agent persists across 200ms quiet period (LOCK-04 behavioral) ---');
  {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const A = (await reg.registerAgent()).agentId;
    await reg.bindTab(A, 100);

    await new Promise((r) => setTimeout(r, 200));

    assert.ok(reg._agents.has(A),
      'agent A still present in _agents after 200ms quiet period (no idle reaper)');
    assert.ok(reg._tabsByAgent.has(A) && reg._tabsByAgent.get(A).has(100),
      'agent A still owns tab 100 after quiet period');
  }
  console.log('  PASS: agent persists across quiet period');

  // -------------------------------------------------------------------------
  // Test 5: only RECONNECT_GRACE_MS scheduling exists -- bounded setTimeout
  //         call sites in the registry.
  //
  // Plan 01 introduced 3 setTimeout call sites in registry code:
  //   1. stageReleaseByConnectionId  -- the grace timer itself
  //   2. hydrate (already-expired)   -- 0ms reschedule of fire after lock
  //   3. hydrate (remaining)         -- reschedule with deadline - now
  //
  // All three are connection_id-keyed (not idle-keyed). We allow up to 4
  // call sites to leave headroom for a future small refactor (e.g. helper
  // extraction); any more than 4 should trigger a review.
  // -------------------------------------------------------------------------
  console.log('--- Test 5: setTimeout call sites in registry are bounded to grace-window scheduling ---');
  {
    const matches = codeOnly.match(/\bsetTimeout\s*\(/g) || [];
    assert.ok(matches.length <= 4,
      'expected <= 4 setTimeout call sites in agent-registry.js (grace-window only); found ' + matches.length);
    // And at least 1 (the staged release timer must exist post-Plan 01).
    assert.ok(matches.length >= 1,
      'expected >= 1 setTimeout call site (staged release timer from Plan 01); found 0');
  }
  console.log('  PASS: setTimeout sites bounded to grace-window scheduling');

  console.log('');
  console.log('PASS no-idle (LOCK-04 / D-13)');
})().catch((err) => {
  console.error('FAIL:', err && err.stack || err);
  process.exit(1);
});
