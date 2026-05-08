---
phase: 239
slug: mcp-run-task-return-on-completion-phase-236-reborn
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 239 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain-Node `assert` harness (matches Phase 238 convention; `tests/agent-scope.test.js`, `tests/agent-bridge-routes.test.js` for shape reference) |
| **Config file** | None — standalone Node files chained via `package.json` `test` script |
| **Quick run command** | `node tests/run-task-cleanup-paths.test.js`, `node tests/run-task-resolve-discipline.test.js`, `node tests/run-task-heartbeat.test.js`, `node tests/mcp-task-store.test.js` (each <1s) |
| **Full suite command** | `npm test` (chains all) plus `npm --prefix mcp run build && node tests/mcp-tool-smoke.test.js` for regression |
| **Estimated runtime** | Quick filter: <60s. Full chain: ~120s. |

---

## Sampling Rate

- **After every task commit:** Run quick filter for the touched module.
- **After every plan wave:** Run full server + extension chain.
- **Before `/gsd-verify-work`:** Both suites green; existing single-agent autopilot, manual MCP, and v0.9.36 visual-session contract tests pass UNCHANGED.
- **Max feedback latency:** <60s for the quick filter, ~120s for the full chain.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Sampling Membership | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|---------------------|--------|
| 01-T0 | 01 | 0 | MCP-03 | T-239-03 | test fixtures harness | wave-0 scaffold | `node tests/run-task-cleanup-paths.test.js` (RED) | created | per-task-commit | green |
| 01-T1 | 01 | 1 | MCP-03 | T-239-01 | lifecycle bus dispatch from notifySidepanel | unit + grep | `node tests/run-task-cleanup-paths.test.js` | exists | per-task-commit + plan-wave | green |
| 01-T2 | 01 | 1 | MCP-03 | T-239-02 | lifecycle bus dispatch in handleStopAutomation | unit | `node tests/run-task-cleanup-paths.test.js` + `node tests/mcp-bridge-client-lifecycle.test.js` | exists | per-task-commit + plan-wave | green |
| 01-T3 | 01 | 1 | MCP-03 | (doc) | audit doc shipped | doc-presence | `test -f .planning/phases/239-*/239-CLEANUP-AUDIT.md` | exists | phase-gate | green |
| 02-T0 | 02 | 0 | MCP-05, MCP-06 | T-239-06 | test fixtures shape | wave-0 scaffold | `node tests/mcp-task-store.test.js && node tests/run-task-heartbeat.test.js` (RED) | created | per-task-commit | green |
| 02-T1 | 02 | 1 | MCP-06 | T-239-06 | versioned envelope, single-task DoS guard | unit | `node tests/mcp-task-store.test.js` | exists | per-task-commit + plan-wave | green |
| 02-T2 | 02 | 1 | MCP-05, MCP-06 | T-239-07, T-239-08 | heartbeat ticker, paired clearInterval, no leak | unit + integration | `node tests/run-task-heartbeat.test.js && node tests/mcp-bridge-client-lifecycle.test.js` | exists | per-task-commit + plan-wave | green |
| 02-T3 | 02 | 1 | MCP-05 | T-239-07 | _meta vendor-extension slot, additive-only | regression | `npm --prefix mcp run build && node tests/mcp-tool-smoke.test.js` | exists | per-task-commit + plan-wave | green |
| 03-T0 | 03 | 0 | MCP-03, MCP-04 | T-239-08 | resolve-discipline tests scaffold | wave-0 scaffold | `node tests/run-task-resolve-discipline.test.js` (RED) | created | per-task-commit | green |
| 03-T1 | 03 | 2 | MCP-04 | T-239-08 | 600s ceiling raise + partial_outcome | unit + integration | `npm --prefix mcp run build && node tests/run-task-resolve-discipline.test.js && node tests/mcp-tool-smoke.test.js` | exists | per-task-commit + plan-wave | green |
| 03-T2 | 03 | 2 | MCP-03 | T-239-08 | sw_evicted server-side catch + bridge route | integration | `npm --prefix mcp run build && node tests/run-task-resolve-discipline.test.js && node tests/mcp-tool-smoke.test.js` | exists | per-task-commit + plan-wave | green |
| 03-T3 | 03 | 2 | MCP-03..06 | (all) | full-phase regression | gate | full-suite below | n/a | phase-gate | green |

*Status: pending / green / red / flaky*

*Planner: each task in PLAN.md gets one row above. The 5 cleanup-path regression tests (D-08) get individual rows. The corrected line numbers from RESEARCH.md (notifySidepanel at agent-loop.js:1281-1306, handleStopAutomation at background.js:6790-6848) are authoritative — supersede the line numbers in CONTEXT.md D-08.*

---

## Wave 0 Requirements

- [x] `tests/fixtures/run-task-harness.js` — shared mock bridge + fake chrome.storage.session for the 4 new test files
- [x] `tests/run-task-cleanup-paths.test.js` — Wave 0 scaffold; one named test per D-08 cleanup path (5 paths)
- [x] `tests/run-task-resolve-discipline.test.js` — Wave 0 scaffold; lifecycle event fires before 600s; 600s fires only when lifecycle event missing; sw_evicted on SW-wake mid-task
- [x] `tests/run-task-heartbeat.test.js` — Wave 0 scaffold; 30s ticker fires; cleared on resolve/reject; no leak across invocations
- [x] `tests/mcp-task-store.test.js` — Wave 0 scaffold; write-through, hydrate, reconcile-on-wake; envelope shape `{v:1, records:{...}}`
- [x] `extension/utils/mcp-task-store.js` — new helper module (test stubs in Wave 0; implementation in Wave 1)

---

## Manual-Only Verifications (UAT)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 5 long-task UAT runs (>5 min each) return on actual completion (not at 600s ceiling) with progress observed at each 30s heartbeat boundary | MCP-03, MCP-04, MCP-05 (SC#5) | Real Chrome + real MCP stdio session not in CI; >5min runtime not feasible in unit tests | Load extension, start a long-running run_task (e.g., complex multi-step browse). Observe `notifications/progress` ticks every 30s in MCP host log. Confirm call returns when automation actually completes (success report). Repeat 5x with varied task complexity. |
| SW eviction during long task settles MCP call with sw_evicted: true + partial_state | MCP-06 (D-05) | Requires forcing SW eviction (chrome://serviceworker-internals -> Stop, OR 5min idle). Not feasible in CI. | Start long run_task. Force-stop the SW. Confirm MCP call settles with sw_evicted: true and partial_state populated from chrome.storage.session snapshot. |
| 600s safety net firing produces partial_outcome: 'timeout' with hint (not hard reject) | MCP-04 (D-06) | Requires inducing a missed lifecycle event — needs pathological setup. | Comment out the lifecycle event dispatch from one cleanup path locally. Run a task. Confirm MCP call resolves at 600s with partial_outcome: 'timeout' rather than a hard reject. |

---

## Phase Regression Run (recorded post-Plan-03)

Command:

```
npm --prefix mcp run build && \
node tests/run-task-cleanup-paths.test.js && \
node tests/mcp-task-store.test.js && \
node tests/run-task-heartbeat.test.js && \
node tests/run-task-resolve-discipline.test.js && \
node tests/mcp-bridge-client-lifecycle.test.js && \
node tests/mcp-tool-smoke.test.js && \
node tests/mcp-visual-session-contract.test.js
```

Result: all exit 0 (green)

Per-suite results (recorded 2026-05-06 post-Plan-03):

| Suite | Result |
|-------|--------|
| `npm --prefix mcp run build` | exit 0 |
| `tests/run-task-cleanup-paths.test.js` | 6/6 passed |
| `tests/mcp-task-store.test.js` | 10/10 passed |
| `tests/run-task-heartbeat.test.js` | 17/17 passed |
| `tests/run-task-resolve-discipline.test.js` | 22/22 passed (6 named cases) |
| `tests/mcp-bridge-client-lifecycle.test.js` | 55/55 passed |
| `tests/mcp-tool-smoke.test.js` | 67/67 passed (D-07 success-path UNCHANGED) |
| `tests/mcp-visual-session-contract.test.js` | 93/93 passed (D-07 UNCHANGED) |

Manual UAT (per Manual-Only Verifications row above): pending — 5 long-task runs to be conducted by the user before phase verify-work.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner populates per-task map above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test references (4 new test files + harness + mcp-task-store.js stubs)
- [x] No watch-mode flags
- [x] Feedback latency under target (<60s quick, ~120s full)
- [x] `nyquist_compliant: true` set in frontmatter after planner fills the per-task verification map
- [ ] 5 UAT runs documented in 239-CLEANUP-AUDIT.md (or sibling artifact) with observed completion-time and heartbeat-cadence per run

**Approval:** automated suites green; UAT pending.
