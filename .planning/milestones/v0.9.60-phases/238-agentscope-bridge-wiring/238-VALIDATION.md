---
phase: 238
slug: agentscope-bridge-wiring
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-05
revised: 2026-05-05
---

# Phase 238 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node `assert` style (custom `assert(cond, msg)` + `assertDeepEqual` helpers; matches existing repo convention seen in mcp-tool-smoke.test.js, agent-registry.test.js, mcp-visual-session-contract.test.js). Server-side TS modules are loaded via `loadBuildModule()` from `mcp/build/`. |
| **Config file** | None - tests are standalone Node files. `package.json` `test` script chains them via `&&`. `mcp/package.json` `build` script invokes `tsc` for the server bundle that tests then `require()`. |
| **Quick run command** | `node tests/agent-scope.test.js` (Plan 01) / `node tests/agent-bridge-routes.test.js` (Plan 02) / `node tests/agent-id-threading.test.js` (Plan 03). Each <1s; the build-then-test wrapper for server tests is `npm --prefix mcp run build && node tests/agent-scope.test.js`. |
| **Full suite command** | `npm test` (chains the full test list including the three new Phase 238 files); `npm run test:mcp-smoke:tools` runs `npm --prefix mcp run build` first then `node tests/mcp-tool-smoke.test.js`. |
| **Estimated runtime** | Quick filter: <60s. Full `npm test` chain: ~120s (RESEARCH §Validation Architecture cites ~30-60s for the existing chain pre-P238; the three new files add <5s combined; the `npm --prefix mcp run build` step on a cold cache is the dominant cost at ~10-15s). |

---

## Sampling Rate

- **After every task commit:** Run quick filter for the touched module (`node tests/agent-scope.test.js` for Plan 01, `node tests/agent-bridge-routes.test.js` for Plan 02, `node tests/agent-id-threading.test.js` + `node tests/mcp-tool-smoke.test.js` for Plan 03). Each completes in <60s including the optional `npm --prefix mcp run build` for server-side tasks.
- **After every plan wave:** Run full server suite + full extension suite: `npm --prefix mcp run build && node tests/agent-scope.test.js && node tests/agent-bridge-routes.test.js && node tests/agent-id-threading.test.js && node tests/mcp-tool-smoke.test.js && node tests/mcp-tool-routing-contract.test.js && node tests/mcp-visual-session-contract.test.js && node tests/mcp-recovery-messaging.test.js`.
- **Before `/gsd-verify-work`:** Both suites green; `mcp-tool-smoke.test.js` (12 assertDeepEqual sites STRENGTHENED to assert agentId presence) and `mcp-visual-session-contract.test.js` (byte-for-byte unchanged per D-16 + Pitfall 3) must both pass with the new payload shape.
- **Max feedback latency:** <60s for the quick filter, ~120s for the full chain.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Sampling Membership | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|---------------------|--------|
| 01-T1 | 238-01 | 1 | AGENT-04 | T-238-03 | Wave 0 test scaffold for AgentScope (5 named cases: lazy mint, race, throw-on-failure, current/reset, response shape validation) | unit (TDD red) | `node tests/agent-scope.test.js` | tests/agent-scope.test.js (Wave 0 - created by this task; skip-passes until 01-T2 lands) | per-task-commit + plan-wave + phase-gate | green |
| 01-T2 | 238-01 | 1 | AGENT-04 | T-238-01, T-238-02, T-238-03 | AgentScope class + MCPMessageType union widening (D-01..D-04, D-12 type side) | unit + build | `npm --prefix mcp run build && node tests/agent-scope.test.js` | mcp/src/agent-scope.ts + mcp/src/types.ts (existing, additive) | per-task-commit + plan-wave + phase-gate | green |
| 02-T1 | 238-02 | 1 | AGENT-04 | T-238-06, T-238-09 | Wave 0 test scaffold for the three bridge routes (6 named cases: register attacker-id, register registry-unavailable, release happy/missing-id, status caller-self-only/missing-id) | unit (TDD red) | `node tests/agent-bridge-routes.test.js` | tests/agent-bridge-routes.test.js (Wave 0 - created by this task; skip-passes until 02-T2 lands) | per-task-commit + plan-wave + phase-gate | green |
| 02-T2 | 238-02 | 1 | AGENT-04 | T-238-06, T-238-09, T-238-10 | Three new agent:* handlers + route table entries + module exports (D-09, D-10, D-12) | unit + regression | `node tests/agent-bridge-routes.test.js && node tests/mcp-tool-routing-contract.test.js` | extension/ws/mcp-tool-dispatcher.js (modified) | per-task-commit + plan-wave + phase-gate | green |
| 02-T3 | 238-02 | 1 | AGENT-04 | T-238-11 | D-14 read-but-don't-act destructure across 15 dispatcher handlers (incl. B2-widened handleExecuteJsRoute and handleGetStatusRoute) + 2 bridge-client helpers; D-16 byte-for-byte preservation of mcp-visual-session.js | regression | `node tests/mcp-tool-routing-contract.test.js && node tests/mcp-visual-session-contract.test.js && node tests/mcp-recovery-messaging.test.js` | extension/ws/mcp-tool-dispatcher.js + extension/ws/mcp-bridge-client.js (modified) | per-task-commit + plan-wave + phase-gate | green |
| 03-T1 | 238-03 | 2 | AGENT-04 | T-238-13, T-238-14 | AgentScope plumbed through createRuntime + 4th-arg signature parity across all 7 register*Tools (D-11); agents.ts gains TODO Phase 242 marker (D-08) | build + structural-DI smoke | `npm --prefix mcp run build && node -e "const { createRuntime } = require('./mcp/build/runtime.js'); const r = createRuntime({ bridge: { isConnected: false, sendAndWait: async () => ({}) } }); if (typeof r.agentScope.ensure !== 'function') { process.exit(1); } console.log('runtime smoke ok');"` (W7: explicit mock bridge - no live WebSocket connection attempted) | mcp/src/runtime.ts + 7 mcp/src/tools/*.ts files (modified) | per-task-commit + plan-wave + phase-gate | green |
| 03-T2 | 238-03 | 2 | AGENT-04 | T-238-13, T-238-14, T-238-17 | Inject `await agentScope.ensure(bridge)` at every D-06 sendAndWait site (autopilot 3, manual 1 funnel, visual-session 2); zero ensures in observability/read-only/vault/agents (D-06 scope discipline) | build + grep-gate | `npm --prefix mcp run build && bash -c 'A=$(grep -c "agentScope.ensure" mcp/src/tools/autopilot.ts); M=$(grep -c "agentScope.ensure" mcp/src/tools/manual.ts); V=$(grep -c "agentScope.ensure" mcp/src/tools/visual-session.ts); O=$(grep -c "agentScope.ensure" mcp/src/tools/observability.ts); R=$(grep -c "agentScope.ensure" mcp/src/tools/read-only.ts); X=$(grep -c "agentScope.ensure" mcp/src/tools/vault.ts); G=$(grep -c "agentScope.ensure" mcp/src/tools/agents.ts); [ "$A" = "3" ] && [ "$M" = "1" ] && [ "$V" = "2" ] && [ "$O" = "0" ] && [ "$R" = "0" ] && [ "$X" = "0" ] && [ "$G" = "0" ]'` | mcp/src/tools/{autopilot,manual,visual-session}.ts (modified) | per-task-commit + plan-wave + phase-gate | green |
| 03-T3 | 238-03 | 2 | AGENT-04 | T-238-15, T-238-16, T-238-17 | Smoke harness mints deterministic `agent_test_smoke`; mcp-tool-smoke.test.js STRENGTHENED at all 12 assertDeepEqual sites (W6 - >=12 floor, NOT loosened); new agent-id-threading.test.js asserts 1 register + N execute-action share one agentId across N=5 parallel invocations (D-13.4); mcp-visual-session-contract.test.js byte-for-byte unchanged (Pitfall 3, D-16) | unit + integration + regression | `npm --prefix mcp run build && node tests/agent-scope.test.js && node tests/agent-bridge-routes.test.js && node tests/agent-id-threading.test.js && node tests/mcp-tool-smoke.test.js && node tests/mcp-visual-session-contract.test.js && node tests/mcp-tool-routing-contract.test.js` | tests/mcp-smoke-harness.js (modified) + tests/mcp-tool-smoke.test.js (modified) + tests/agent-id-threading.test.js (new) | per-task-commit + plan-wave + phase-gate | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `tests/agent-scope.test.js` - Plan 01 Task 1 creates this with 5 named test cases (Wave 0 scaffold; skip-passes before Task 2 lands the implementation)
- [x] `tests/agent-bridge-routes.test.js` - Plan 02 Task 1 creates this with 6 named test cases (Wave 0 scaffold; skip-passes before Task 2 lands the handlers)
- [x] `tests/agent-id-threading.test.js` - Plan 03 Task 3 creates this as integration test for D-13.4 (N=5 parallel invocations -> exactly 1 agent:register + N execute-action share one agentId)
- [x] `tests/mcp-tool-smoke.test.js` - existing; Plan 03 Task 3 STRENGTHENS the 12 assertDeepEqual sites to assert `agentId: 'agent_test_smoke'` presence (NOT loosened to ignore the field) - W6 floor `>= 12`
- [x] `tests/mcp-smoke-harness.js` - existing; Plan 03 Task 3 extends to instantiate AgentScope, pass it as the 4th arg to register*Tools, and respond to type==='agent:register' with deterministic `{ success: true, agentId: 'agent_test_smoke', agentIdShort: 'agent_test' }`
- [x] `mcp/src/agent-scope.ts` - new module (test stubs in Wave 0 via skip-pass gate, implementation in Plan 01 Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing single-agent autopilot run unchanged end-to-end (no observable behavior delta) | AGENT-04 | Real Chrome + real MCP stdio session not in CI | Load extension, run any autopilot task; confirm no errors, no UI change, no perf regression |
| v0.9.36 visual-session re-entry still works | AGENT-04 | Multi-tab interactive scenario | Launch visual session, drive a tool, confirm same-agent re-entry semantics intact |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every one of the 8 tasks above has a concrete automated command)
- [x] Wave 0 covers all MISSING references (agent-scope.test.js, agent-bridge-routes.test.js, agent-id-threading.test.js, mcp-tool-smoke.test.js strengthening, mcp-smoke-harness.js extension)
- [x] No watch-mode flags
- [x] Feedback latency under target (<60s quick filter, ~120s full chain)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
