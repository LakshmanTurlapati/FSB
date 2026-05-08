---
phase: 241
slug: pooling-configurable-cap-reconnect-grace
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 241 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Plain-Node assert harness (Phase 238/239/240 convention) |
| Quick run | `node tests/agent-cap.test.js && node tests/agent-cap-storage.test.js && node tests/agent-pool-shrink.test.js && node tests/agent-pooling.test.js && node tests/agent-grace.test.js && node tests/agent-cap-ui.test.js` |
| Full | `npm test` + `npm --prefix mcp run build && node tests/mcp-tool-smoke.test.js` |
| Runtime | Quick: <60s. Full: ~120s. |

## Sampling Rate
- After every task commit: quick filter for the touched module
- After every wave: full chain (regression incl. ownership-gate, ownership-error-codes, visual-session-reentry, mcp-tool-smoke, mcp-visual-session-contract)
- Before verify-work: both suites green; existing v0.9.36 / Phase 238/239/240 contracts UNCHANGED

## Per-Task Verification Map
Populated by planner per task. Suggested rows: registry findAgentByTabId; getCap/setCap with onChanged; canAcceptNewAgent under withRegistryLock + 20-concurrent-claim test; agent-release-when-pool-empty in releaseTab; chrome.tabs.onCreated.openerTabId pooling; bridge connection_id mint + stageRelease; settings card UI.

## Wave 0 Requirements
- [x] tests/agent-cap.test.js (cap enforcement scaffold)
- [x] tests/agent-cap-storage.test.js (chrome.storage.local cap persistence)
- [x] tests/agent-pool-shrink.test.js (releaseTab → pool.size===0 → agent release)
- [x] tests/agent-pooling.test.js (forced bind via openerTabId)
- [x] tests/agent-grace.test.js (RECONNECT_GRACE_MS staging + expiry + cancel)
- [x] tests/agent-cap-ui.test.js (control_panel.html numeric input + reset)
- [x] tests/agent-no-idle.test.js (LOCK-04 negative — no idle timeout exists)

## Manual-Only Verifications (UAT — auto-deferred per autonomous run)
- 20-concurrent-claim under load returns exactly N successes (covered by automated test, but real-Chrome run = sanity check)
- Lower-cap-while-active grandfathering observed in real Chrome
- 10s grace observed: bridge close + reconnect within 10s preserves pool; expiry releases
- options.html Advanced Settings cap input: change persists across SW restart

## Validation Sign-Off
- [x] All tasks have automated verify or Wave 0 deps
- [x] Sampling continuity OK
- [x] Wave 0 covers MISSING references
- [x] No watch-mode flags
- [x] Latency within target

Approval: ready
