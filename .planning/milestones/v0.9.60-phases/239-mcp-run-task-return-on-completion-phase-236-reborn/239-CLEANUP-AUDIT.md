---
phase: 239
artifact: cleanup-audit
authored: 2026-05-06
supersedes: 239-CONTEXT.md D-08 line numbers (which were approximate)
---

# Phase 239 -- Cleanup-Path Audit

## Audit Methodology

Read every `cleanupSession` caller in `extension/background.js` and
`extension/ai/agent-loop.js`. For each caller, record `file:line`, whether the
lifecycle bus is dispatched on that path (before/inside the path), the Phase 239
fix needed (or "already healthy"), and the regression test name that locks the
behavior in. Line numbers below come from the live `Refinements` branch checkout
that Phase 239 Plan 01 executes against (RESEARCH.md re-derivation), and they
supersede the approximate line numbers from CONTEXT.md D-08 which were drafted
during `/gsd-discuss-phase` before the codebase was re-scanned.

## Per-Path Audit Table

| # | Path | File:Line | Dispatches lifecycle bus today | Phase 239 fix? | Regression test (file::case) |
|---|------|-----------|--------------------------------|----------------|------------------------------|
| 1 | Normal completion | extension/ai/agent-loop.js:1955 (via finalizeSession) | NO (raw sendMessage in notifySidepanel:1277-1306) | YES -- Task 1 (notifySidepanel rewrite covers this fan-in) | tests/run-task-cleanup-paths.test.js::normal_completion |
| 2 | Stuck-detection terminal exit | extension/ai/agent-loop.js:2309 + extension/background.js:10918 | partial (bg.js healthy; agent-loop broken) | YES -- Task 1 covers agent-loop side; bg.js path already healthy | tests/run-task-cleanup-paths.test.js::stuck_detection_terminal |
| 3 | Safety breaker | extension/ai/agent-loop.js:1520, 1537, 2276 | NO | YES -- Task 1 covers all 3 sites via the notifySidepanel fan-in | tests/run-task-cleanup-paths.test.js::safety_breaker |
| 4 | Tab close | extension/background.js:2495 | YES (already calls fsbBroadcastAutomationLifecycle) | NO -- already healthy | tests/run-task-cleanup-paths.test.js::tab_close |
| 5 | handleStopAutomation | extension/background.js:6790-6848 | NO (no helper call in function body before this plan) | YES -- Task 2 (insert bus dispatch between await cleanupSession and sendResponse) | tests/run-task-cleanup-paths.test.js::handle_stop |
| 6 (bonus) | SW restart with running session | extension/background.js:2258 | YES | NO -- collision point with Plan 03 D-05 sw_evicted handler | covered indirectly via tests/run-task-resolve-discipline.test.js::sw_wake_settles_with_sw_evicted (Plan 03) |
| 7 (bonus) | Health-check failure | extension/background.js:9263, 6546 | YES | NO | optional; out of scope for this phase |
| 8 (bonus) | API/auth/bad-request errors | extension/ai/agent-loop.js:2397, 2411, 2440 + extension/background.js:10116 | partial (agent-loop broken, bg.js healthy) | YES -- Task 1 covers agent-loop side via the notifySidepanel fan-in | covered transitively via tests/run-task-cleanup-paths.test.js::stuck_detection_terminal (the assertion accepts automationError) |

## Net code change summary

- `extension/ai/agent-loop.js`: 1 function body rewrite (`notifySidepanel`,
  lines 1277-1306). Covers paths 1, 2, 3, 8. The replacement uses
  `globalThis.fsbBroadcastAutomationLifecycle(message)` so the in-SW lifecycle
  bus is fed in addition to the existing cross-context `chrome.runtime.sendMessage`
  dispatch. The two non-terminal-exit guard `chrome.runtime.sendMessage` calls
  at lines 1379 and 1409 are preserved untouched.
- `extension/background.js`: 1 dispatch call inserted in `handleStopAutomation`
  between `await cleanupSession(sessionId)` and `sendResponse({...})`. Covers
  path 5. Field set mirrors the tab_close dispatch at background.js:2495 verbatim
  (no new top-level fields introduced, so the bridge-client subscription stays
  unchanged).
- All other paths (4, 6, 7) were already healthy in the pre-Phase-239 codebase.

## Why CONTEXT.md D-08 line numbers were wrong

CONTEXT.md D-08 listed the cleanup paths at approximate lines `~1945`, `~3378`,
and `~6542`. Those approximations were drafted during `/gsd-discuss-phase`
before the live codebase was scanned end-to-end. The corrected mapping from
RESEARCH.md is:

- `~1945` was assumed to be normal completion. The real line at
  `extension/background.js:1945` is `idleSession()`'s 10-minute deferred-cleanup
  timer (a timer-driven cleanup, not normal completion). True normal completion
  flows through `extension/ai/agent-loop.js:1955` (`finalizeSession`'s success
  path).
- `~3378` was assumed to be stuck-detection terminal exit. The real line at
  `extension/background.js:3378` is the replay path's stuck handling -- not the
  live AI loop's stuck-detection terminal exit. The live path is
  `extension/ai/agent-loop.js:2309`, with the legacy/replay companion at
  `extension/background.js:10918`.
- `~6542` was assumed to be `handleStopAutomation`. The real line at
  `extension/background.js:6542` is `handleStartAutomation`'s
  content-script-not-ready failure path (a different function entirely). True
  `handleStopAutomation` lives at `extension/background.js:6790-6848`.

The audit table above uses the verified line numbers from RESEARCH.md.

## UAT verification (5 long-task runs)

The 5 long-task UAT runs (>5 min each) per ROADMAP SC#5 are documented in
`239-VALIDATION.md` under "Manual-Only Verifications". Results are recorded
there post-execution; this audit document references that row rather than
duplicating the protocol. The placeholder table below is filled by the user
during UAT.

| Run | Task description | Started at | Completion path | Heartbeat ticks observed | Settled at | Outcome | Notes |
|-----|------------------|------------|-----------------|--------------------------|------------|---------|-------|
| 1 | (fill during UAT) | | | | | | |
| 2 | (fill during UAT) | | | | | | |
| 3 | (fill during UAT) | | | | | | |
| 4 | (fill during UAT) | | | | | | |
| 5 | (fill during UAT) | | | | | | |

## Sign-off checklist

- [ ] **SC#1** -- `run_task` resolves on actual lifecycle event before the 600s
  safety net. Proof: `tests/run-task-resolve-discipline.test.js::lifecycle_wins_race`
  (Plan 03).
- [ ] **SC#2** -- All 5 cleanup-exit paths emit `automationComplete` or
  `automationError` and call `cleanupSession`. Proof: all 6 cases in
  `tests/run-task-cleanup-paths.test.js` PASS (Plan 01, this plan).
- [ ] **SC#3** -- 30s heartbeat ticks fire via `_sendProgress` /
  `notifications/progress` and clear cleanly on settle. Proof:
  `tests/run-task-heartbeat.test.js` (Plan 03).
- [ ] **SC#4** -- Task lifecycle persisted in `chrome.storage.session` keyed by
  `task_id` with the documented envelope shape. Proof:
  `tests/mcp-task-store.test.js` (Plan 02).
- [ ] **SC#5** -- 5 long-task UAT runs (>5 min each) return on actual completion
  rather than at the 600s safety net, with progress observed at each 30s
  heartbeat boundary. Proof: the placeholder table above filled in with 5
  recorded runs.
