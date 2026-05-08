---
phase: 240
slug: tab-ownership-enforcement-on-dispatch
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 240 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain-Node `assert` harness (Phase 238/239 convention; tests/agent-bridge-routes.test.js for shape) |
| **Config file** | None — standalone Node files chained via `package.json` `test` script |
| **Quick run command** | `node tests/ownership-gate.test.js`, `node tests/ownership-error-codes.test.js`, `node tests/legacy-agent-synthesis.test.js`, `node tests/visual-session-reentry.test.js` |
| **Full suite command** | `npm test` (chains all) plus `npm --prefix mcp run build && node tests/mcp-tool-smoke.test.js` for regression |
| **Estimated runtime** | Quick filter: <60s. Full chain: ~120s. |

---

## Sampling Rate

- **After every task commit:** Run quick filter for the touched module.
- **After every plan wave:** Run full server + extension chain.
- **Before `/gsd-verify-work`:** Both suites green; existing single-agent autopilot, manual MCP, and v0.9.36 visual-session contract tests pass UNCHANGED. mcp-tool-smoke.test.js's 12 deepEqual sites adapted to include `ownershipToken: 'token_test_smoke'` in payload assertions.
- **Max feedback latency:** <60s for the quick filter, ~120s for the full chain.

---

## Per-Task Verification Map

(Populated by planner. Suggested rows: registry extension; dispatcher gate inline; 3 D-08 bindTab sites in dispatcher; handleStartAutomation D-08 site + visual-session resume/reject; legacy:popup/sidepanel/autopilot synthesis; smoke-test ownershipToken extension.)

---

## Wave 0 Requirements

- [ ] `tests/ownership-gate.test.js` — Wave 0 scaffold; gate trips on every named handler; same-microtask discipline
- [ ] `tests/ownership-error-codes.test.js` — Wave 0 scaffold; TAB_NOT_OWNED / TAB_INCOGNITO_NOT_SUPPORTED / TAB_OUT_OF_SCOPE
- [ ] `tests/legacy-agent-synthesis.test.js` — Wave 0 scaffold; 3 legacy:<surface> agentIds; cross-surface isolation
- [ ] `tests/visual-session-reentry.test.js` — Wave 0 scaffold; same-agent resume + cross-agent reject
- [ ] Update tests/fixtures/run-task-harness.js (or sibling) with `installOwnedTab(agentId, tabId, ownershipToken)` helper for ownership-aware tests
- [ ] mcp-tool-smoke.test.js: extend the 12 deepEqual sites to include `ownershipToken: 'token_test_smoke'` alongside the existing `agentId: 'agent_test_smoke'`

---

## Manual-Only Verifications (UAT — auto-deferred per autonomous run)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-agent rejection on a real tab in real Chrome | OWN-01 | Real Chrome multi-agent setup not in CI | Load extension, register two agents, drive tab via agent A, attempt cross-call from agent B, observe TAB_NOT_OWNED with full ownerAgentId |
| Visual-session same-agent resume preserves prior state | OWN-03 | Real Chrome visual session not in CI | Start visual session, call startSession again from same agent, confirm prior state preserved (no glow flicker, no badge reset) |
| Legacy popup/sidepanel/autopilot continue to drive their own tabs (no v0.9.36/v0.9.50 regression) | OWN-05 | Cross-surface UX validation | Open tab from popup, drive automation, confirm sidepanel cannot intervene |
| Incognito tabs rejected with TAB_INCOGNITO_NOT_SUPPORTED | OWN-04 | Requires opening an incognito window | Try to drive an incognito tab; confirm typed code returned |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner populates per-task map)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test references
- [x] No watch-mode flags
- [x] Feedback latency under target

**Approval:** ready
