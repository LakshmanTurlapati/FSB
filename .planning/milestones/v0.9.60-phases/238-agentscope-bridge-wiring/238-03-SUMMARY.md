---
phase: 238-agentscope-bridge-wiring
plan: 03
subsystem: mcp/server-runtime + tests/smoke-harness
tags: [agent-scope, bridge-wiring, payload-threading, di, scope-discipline]
dependency_graph:
  requires:
    - 238-01-SUMMARY.md (AgentScope class + MCPMessageType union extension)
    - 238-02-SUMMARY.md (extension-side agent:register/release/status routes; D-14 destructure)
  provides:
    - mcp/src/runtime.ts.createRuntime threads AgentScope into 7 register*Tools (D-11 DI)
    - mcp/src/tools/{autopilot,manual,visual-session}.ts emit payload.agentId at the 6 D-06 sendAndWait sites
    - mcp/src/tools/{agents,observability,read-only,vault}.ts accept AgentScope for signature parity but emit no agent identity (D-06 + D-08 scope discipline)
    - tests/mcp-smoke-harness.js mints deterministic agent_test_smoke for any agent:register message
    - tests/agent-id-threading.test.js (D-13.4 lazy-mint singleton invariant)
  affects:
    - mcp/build/* regenerated artefacts
    - tests/mcp-tool-smoke.test.js strengthened (6 D-06 sites assert agentId top-level)
tech-stack:
  added: []
  patterns:
    - cached-promise lazy-mint (consumed via AgentScope.ensure)
    - inline audit-anchor injection (D-06 grep-friendly)
    - signature-parity DI without behavior (D-11 + scope discipline)
key-files:
  created:
    - tests/agent-id-threading.test.js
  modified:
    - mcp/src/runtime.ts
    - mcp/src/tools/autopilot.ts
    - mcp/src/tools/manual.ts
    - mcp/src/tools/visual-session.ts
    - mcp/src/tools/agents.ts
    - mcp/src/tools/observability.ts
    - mcp/src/tools/read-only.ts
    - mcp/src/tools/vault.ts
    - tests/mcp-smoke-harness.js
    - tests/mcp-tool-smoke.test.js
decisions:
  - D-05 honored: agentId at the top level of payload (not nested under payload.agent.id, not bridge envelope metadata)
  - D-06 scope discipline: inject only in autopilot/manual/visual-session; observability/read-only/vault/agents stay agent-identity-free
  - D-08: agents.ts gets import + TODO Phase 242 marker + void agentScope; no uncommented server.tool blocks
  - D-11: AgentScope plumbed via 4th arg through every register*Tools (7 functions); resources/prompts unchanged
  - D-13.4: integration test asserts exactly ONE agent:register across N=5 parallel tool invocations
  - D-16: tests/mcp-visual-session-contract.test.js byte-for-byte unchanged
metrics:
  duration: ~30 minutes (worktree session)
  completed: 2026-05-05
---

# Phase 238 Plan 03: AgentScope + Bridge Wiring Summary

One-liner: Threads a per-process agent_id through every D-06 bridge.sendAndWait payload via inline `await agentScope.ensure(bridge)` injections at 6 audit-anchor sites, plumbed via constructor injection through `createRuntime` and the 4th argument of all 7 `register*Tools` functions.

## Tasks Completed

| Task | Name | Commit | Key Files |
| ---- | ---- | ------ | --------- |
| 1 | Plumb AgentScope through createRuntime + extend 7 register*Tools signatures | ef33b12 | mcp/src/runtime.ts, mcp/src/tools/{autopilot,manual,visual-session,agents,observability,read-only,vault}.ts |
| 2 | Inject `await agentScope.ensure(bridge)` at the 6 D-06 sendAndWait sites | 7978e0b | mcp/src/tools/{autopilot,manual,visual-session}.ts (also comment-rephrase in observability/read-only/vault to keep scope-discipline grep gate strict) |
| 3 | Update smoke harness + strengthen 6 D-06 deepEqual sites + add agent-id-threading.test.js | 78d242e | tests/mcp-smoke-harness.js, tests/mcp-tool-smoke.test.js, tests/agent-id-threading.test.js |

## Detailed Edits

### (a) D-06 Inline Injections at the 6 sendAndWait Sites

All 6 sites preserve the Pitfall 5 ordering: existing `if (!bridge.isConnected)` short-circuit stays first, then `await agentScope.ensure(bridge)`, then `bridge.sendAndWait`.

| File | Tool | Site | Before payload | After payload |
| ---- | ---- | ---- | -------------- | ------------- |
| mcp/src/tools/autopilot.ts | run_task | inside queue.enqueue | `{ task }` | `{ task, agentId }` |
| mcp/src/tools/autopilot.ts | stop_task | direct (queue-bypass) | `{}` | `{ agentId }` |
| mcp/src/tools/autopilot.ts | get_task_status | inside queue.enqueue | `{}` | `{ agentId }` |
| mcp/src/tools/manual.ts | execAction funnel (covers all 25+ manual tools) | inside queue.enqueue | `{ tool: fsbVerb, params }` | `{ tool: fsbVerb, params, agentId }` |
| mcp/src/tools/visual-session.ts | start_visual_session | inside queue.enqueue | `{ clientLabel, task, detail }` | `{ clientLabel, task, detail, agentId }` |
| mcp/src/tools/visual-session.ts | end_visual_session | inside queue.enqueue | `{ sessionToken, reason }` | `{ sessionToken, reason, agentId }` |

Verified counts (`grep -c "agentScope.ensure" mcp/src/tools/{file}.ts`):

| File | ensure() count | agentId count |
| ---- | -------------- | ------------- |
| autopilot.ts | 3 | 6 (3 const + 3 payload) |
| manual.ts | 1 | 2 (1 const + 1 payload) |
| visual-session.ts | 2 | 4 (2 const + 2 payload) |
| observability.ts | 0 | 0 |
| read-only.ts | 0 | 0 |
| vault.ts | 0 | 0 |
| agents.ts | 0 | 0 |

The 3/1/2/0/0/0/0 distribution is the audit-anchor invariant ROADMAP SC #3 will check at phase verify.

To keep the grep gate honest (Pitfall 7), the explanatory comments in observability/read-only/vault originally said "no agentScope.ensure() injection here" but that literal string would have inflated the grep count. The comments were rephrased to "no agent identity injection here per CONTEXT.md" so the gate reflects only real injection sites.

### (b) Signature Threading Across All 7 register*Tools

`createRuntime` in `mcp/src/runtime.ts` instantiates `AgentScope` once per process and passes it as the 4th argument to every register*Tools call:

- registerVisualSessionTools(server, bridge, queue, agentScope)
- registerManualTools(server, bridge, queue, agentScope)
- registerReadOnlyTools(server, bridge, queue, agentScope)
- registerObservabilityTools(server, bridge, queue, agentScope)
- registerAgentTools(server, bridge, queue, agentScope)
- registerVaultTools(server, bridge, queue, agentScope)
- registerAutopilotTools(server, bridge, queue, agentScope)

`registerResources(server, bridge)` and `registerPrompts(server)` are unchanged — D-11 scope is tools only.

`FSBRuntime` type now includes `agentScope: AgentScope`. `RuntimeOptions` includes the optional `agentScope?: AgentScope` for test injection (Pitfall 6).

For `agents.ts` (D-08 marker-only), the function body adds:

```typescript
// TODO Phase 242: thread agentScope into the back tool when it lands.
// AgentScope is imported and accepted here for runtime DI parity (D-11);
// P238 is structurally a no-op for this file per CONTEXT.md D-08.
void agentScope;
```

Zero `server.tool(...)` blocks were uncommented. Verified: `grep -c "^[[:space:]]*server.tool" mcp/src/tools/agents.ts` returns 0.

For `observability.ts`, `read-only.ts`, `vault.ts`, the function body adds an analogous `void agentScope;` marker so TS notices the parameter is intentionally unused while keeping signature parity.

### (c) The 12 assertDeepEqual Sites in mcp-tool-smoke.test.js — Strengthening Disposition

The plan's Pitfall 2 / Done block W6 originally targeted "12 assertDeepEqual sites strengthened to assert agentId presence." Of the 12 sites, only 6 are inside the D-06 scope (the others are read-only or observability tools where adding agentId would VIOLATE scope discipline). The 6 strengthened sites:

| Site (line) | Tool | Bridge type | Strengthened to assert |
| ----------- | ---- | ----------- | ---------------------- |
| 132 | navigate | mcp:execute-action | `agentId: 'agent_test_smoke'` in payload |
| 167 | click | mcp:execute-action | `agentId: 'agent_test_smoke'` in payload |
| 184 | start_visual_session | mcp:start-visual-session | `agentId: 'agent_test_smoke'` in payload |
| 198 | end_visual_session | mcp:end-visual-session | `agentId: 'agent_test_smoke'` in payload |
| 206 | run_task | mcp:start-automation | `agentId: 'agent_test_smoke'` in payload |
| 213 | stop_task | mcp:stop-automation | `agentId: 'agent_test_smoke'` in payload |

The 6 NON-strengthened sites (intentionally agent-identity-free per D-06 scope discipline) are: list_tabs, read_page, get_dom_snapshot, get_page_snapshot, get_site_guide, get_logs. Strengthening these would have introduced wire-format expectations that don't exist in production — the read-only/observability tool handlers do NOT call `agentScope.ensure()` and do NOT add `agentId` to their payloads.

The Pitfall 2 anti-loosening posture is preserved: every D-06 site that DOES carry agentId at runtime is asserted on the wire with the literal `'agent_test_smoke'` value, NOT with a wildcard or any-string matcher.

The grep gate originally specified `grep -c "agentId: 'agent_test_smoke'" >= 12`; the actual exact-count gate is 6 (assertion bodies) + 1 (a comment that cites the deterministic value), giving the observed count of 7. The gate is now: `>= 6` actual assertion-body uses with no false-loosening.

### (d) New Integration Test: tests/agent-id-threading.test.js

111-line standalone Node test that:

1. Loads the manual tools build artefact and a fresh AgentScope.
2. Wires them into a tool harness.
3. Fires N=5 parallel `navigate` invocations via the harness.
4. Asserts:
   - exactly ONE `agent:register` call landed on the bridge (D-13.4 lazy-mint singleton)
   - exactly N=5 `mcp:execute-action` calls landed (one per invocation)
   - across all 5 execute-action payloads, the `agentId` set has size 1 (singleton property)
   - that single agentId equals `'agent_test_smoke'` (harness's deterministic mock)

Test output:
```
agent-id-threading.test.js: PASS (N=5 parallel invocations -> 1 register + 5 execute-actions, 1 distinct agentId)
=== Results: 6 passed, 0 failed ===
```

### (e) tests/mcp-visual-session-contract.test.js BYTE-FOR-BYTE Unchanged (D-16)

`git diff tests/mcp-visual-session-contract.test.js` returns empty. The file's assertions are field-name-specific (e.g. `assertEqual(capturedStart.request.clientLabel, 'Codex', ...)`) and tolerate the additional `agentId` field added to the visual-session payload at runtime. Confirmed by running the test: 93 passed, 0 failed.

### (f) Smoke harness: createToolHarness now mints agent_test_smoke

`tests/mcp-smoke-harness.js` adds a branch at the top of the mock `bridge.sendAndWait` that recognizes `message.type === 'agent:register'` and returns the deterministic shape `{ success: true, agentId: 'agent_test_smoke', agentIdShort: 'agent_test' }`. The bridgeCalls array continues to record this message so tests can assert on the count.

A new helper `loadAgentScope()` is exported for tests that need to construct a fresh `AgentScope` from the build artefact.

The `invokeTool` helper in mcp-tool-smoke.test.js was updated to skip past `agent:register` entries when locating the tool's own bridge message (the agent:register round-trip is interleaved with the first manual/autopilot/visual-session invocation but is benign for tool routing assertions).

## AGENT-04 Closure Statement

Phase 238 Plan 03 closes AGENT-04 ("One MCP client may run multiple parallel agents simultaneously, each with its own agent_id") in the wire-format observable sense. With this plan landed:

- A single MCP server process mints exactly one `agent_id` (cached-promise lazy-mint per Plan 01 D-03).
- Every D-06 tool call from that process carries the SAME `agent_id` at the top level of `payload`.
- A fresh MCP server process (different stdio child) will mint a DIFFERENT `agent_id`.
- The integration test `tests/agent-id-threading.test.js` proves the singleton property under burst concurrency (N=5 parallel invocations -> 1 register + N execute-actions all sharing one id).

The threading is observable but NOT yet enforceable — the extension destructures `agentId` from the payload (Plan 02 D-14) and ignores it. Phase 240 (OWN-04 cross-agent reject) is the enforcement owner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mcp-tool-smoke.test.js invokeTool helper offset**

- Found during: Task 3 first run
- Issue: `invokeTool` recorded `bridgeCalls[before]` as the tool's bridge message, but with Phase 238 the FIRST manual/autopilot/visual-session invocation is preceded by a benign `agent:register` round-trip. The `before` offset pointed at the agent:register call, not the tool's call.
- Fix: Walk forward from `before` and skip any `agent:register` entries when locating the tool's own bridge message.
- Files modified: tests/mcp-tool-smoke.test.js (invokeTool helper)
- Commit: 78d242e (Task 3 commit)

**2. [Rule 1 - Bug] grep gate inflation from explanatory comments**

- Found during: Task 2 verify
- Issue: Initial `void agentScope;` markers in observability/read-only/vault carried the comment "no agentScope.ensure() injection here per CONTEXT.md". The literal string `agentScope.ensure` matched the scope-discipline grep gate and inflated counts to 1/1/1 instead of the required 0/0/0.
- Fix: Rephrased the comments to "no agent identity injection here per CONTEXT.md" — preserves intent, eliminates the false-positive.
- Files modified: mcp/src/tools/observability.ts, read-only.ts, vault.ts
- Commit: 7978e0b (Task 2 commit)

**3. [Rule 3 - Blocking] mcp/node_modules absent in worktree**

- Found during: Task 1 first build attempt
- Issue: `npm --prefix mcp run build` failed with TS2307 errors because mcp/node_modules was not installed in this worktree.
- Fix: Ran `npm --prefix mcp install` once. No package.json changes; lockfile-driven install only.
- Files modified: none (node_modules is gitignored)
- Commit: not committed (install side effect)

### Plan Done-Block Adjustments

- The done block for Task 1 said `grep -c "agentScope: AgentScope" mcp/src/runtime.ts >= 2` (FSBRuntime + RuntimeOptions). Actual count is 1 because RuntimeOptions uses optional syntax `agentScope?: AgentScope` (the `?` is correct TypeScript for an optional field). The functional check (W7 runtime smoke) passes; total `agentScope` occurrences is 11 (well above the 7 threshold for register*Tools call sites). No code change — the TS optional syntax is the right tool for the job.

- The done block for Task 3 said `grep -c "agentId: 'agent_test_smoke'" tests/mcp-tool-smoke.test.js >= 12`. Per the plan's own escape clause (Pitfall 2 enumerator), the actual exact count is 6 (the 6 D-06 assertion bodies) + 1 (the harness explanation comment) = 7. Strengthening to 12 would have violated D-06 scope discipline by adding agentId to read-only/observability tool assertions where production does NOT add it. The 6 non-D-06 sites are enumerated in section (c) above.

## Verification Results

All checks pass:

| Check | Result |
| ----- | ------ |
| `npm --prefix mcp run build` | exits 0 |
| W7 runtime smoke (`createRuntime({ bridge: mock })`) | `runtime smoke ok`; typeof agentScope.ensure === 'function' |
| `grep -c "agentScope.ensure" mcp/src/tools/autopilot.ts` | 3 |
| `grep -c "agentScope.ensure" mcp/src/tools/manual.ts` | 1 |
| `grep -c "agentScope.ensure" mcp/src/tools/visual-session.ts` | 2 |
| `grep -c "agentScope.ensure" mcp/src/tools/observability.ts` | 0 |
| `grep -c "agentScope.ensure" mcp/src/tools/read-only.ts` | 0 |
| `grep -c "agentScope.ensure" mcp/src/tools/vault.ts` | 0 |
| `grep -c "agentScope.ensure" mcp/src/tools/agents.ts` | 0 |
| `grep -c "TODO Phase 242:" mcp/src/tools/agents.ts` | 1 |
| `grep -c "void agentScope;" mcp/src/tools/agents.ts` | 1 |
| `grep -c "^[[:space:]]*server.tool" mcp/src/tools/agents.ts` | 0 |
| `grep -c "agent_test_smoke" tests/mcp-smoke-harness.js` | 1 |
| `grep -c "agentId: 'agent_test_smoke'" tests/mcp-tool-smoke.test.js` (assertion bodies) | 6 |
| `grep -c "agent:register must fire exactly once" tests/mcp-tool-smoke.test.js` | 1 |
| `grep -c "registerCalls.length === 1" tests/agent-id-threading.test.js` | 1 |
| `git diff tests/mcp-visual-session-contract.test.js` | empty |
| `node tests/agent-scope.test.js` | PASS |
| `node tests/agent-bridge-routes.test.js` | 27 passed, 0 failed |
| `node tests/agent-id-threading.test.js` | 6 passed, 0 failed |
| `node tests/mcp-tool-smoke.test.js` | 67 passed, 0 failed |
| `node tests/mcp-visual-session-contract.test.js` | 93 passed, 0 failed |
| `node tests/mcp-tool-routing-contract.test.js` | 144 passed, 0 failed |

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries added. The agent_id field is purely additive payload metadata; the extension destructures it but takes no action on it (Plan 02 D-14). All threat-register dispositions from the plan's `<threat_model>` are honored:

- T-238-13 (handler bypasses ensure): the 6 ensure() injections are grep-asserted (3+1+2). Phase 244 hardening will re-run the audit.
- T-238-14 (scope creep into observability/read-only/vault): grep-asserted 0/0/0; comment text rephrased to keep the gate honest.
- T-238-15 (agent_test_smoke leak): test-only, never reaches a production module.
- T-238-16 (DoS via double-mint): N=5 parallel invocations -> exactly 1 register, asserted by tests/agent-id-threading.test.js.
- T-238-17 (audit log gap): every D-06 sendAndWait now carries agentId.
- T-238-18 (premature elevation): wire-format only; extension ignores agentId until P240.

## Self-Check: PASSED

Files claimed created exist:
- tests/agent-id-threading.test.js: FOUND

Files claimed modified exist with the claimed changes:
- mcp/src/runtime.ts: FOUND (agentScope plumbed)
- mcp/src/tools/autopilot.ts: FOUND (3 ensure sites)
- mcp/src/tools/manual.ts: FOUND (1 ensure site in execAction)
- mcp/src/tools/visual-session.ts: FOUND (2 ensure sites)
- mcp/src/tools/agents.ts: FOUND (TODO Phase 242 marker, void agentScope)
- mcp/src/tools/observability.ts: FOUND (signature parity, no ensure)
- mcp/src/tools/read-only.ts: FOUND (signature parity, no ensure)
- mcp/src/tools/vault.ts: FOUND (signature parity, no ensure)
- tests/mcp-smoke-harness.js: FOUND (agent_test_smoke mock; loadAgentScope helper)
- tests/mcp-tool-smoke.test.js: FOUND (6 D-06 sites strengthened; register-once assertion)

Commits exist on the worktree branch:
- ef33b12: FOUND (Task 1)
- 7978e0b: FOUND (Task 2)
- 78d242e: FOUND (Task 3)
