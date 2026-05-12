---
phase: 257
plan: 01
subsystem: mcp-visual-session-lifecycle
tags:
  - mcp
  - visual-session
  - lifecycle
  - is_final
  - completion
  - phase-257
requirements_completed:
  - COMPLETE-01
  - COMPLETE-02
  - COMPLETE-03
dependency_graph:
  requires:
    - phase-256-implicit-visual-session-lifecycle (clearVisualSession helper, ownership-gated tick chokepoint)
    - phase-255-mcp-server-sidecar (is_final boolean validation + forwarding)
    - phase-254-v0.9.62-contract (locked field-bundle names)
  provides:
    - _clearVisualSessionIfFinal companion method on MCPBridgeClient
    - immediate-clear post-change_report invocation in BOTH _handleExecuteAction branches
    - Case J / K / L assertions at the lifecycle helper layer
  affects:
    - extension/ws/mcp-bridge-client.js (one new method + two new call sites)
    - tests/mcp-visual-tick-lifecycle.test.js (one new helper field + 3 new case bodies + driver wiring + docblock)
tech-stack:
  added: []
  patterns:
    - non-blocking lifecycle hook with try/catch + console.warn (mirrors Phase 256 _recordVisualSessionTickIfPresent)
    - capture-clear-return sequence around wrapWithChangeReport so the action result lands first, then the overlay vanishes
    - append-only create history on the in-memory chrome.alarms mock (_createHistory) so tests can assert re-arm semantics without breaking the live-state _created() back-compat
key-files:
  created:
    - .planning/phases/257-explicit-completion-is_final-immediate-clear/257-01-SUMMARY.md
  modified:
    - extension/ws/mcp-bridge-client.js
    - tests/mcp-visual-tick-lifecycle.test.js
decisions:
  - reuse Phase 256 clearVisualSession helper (no new lifecycle module code)
  - pass reason=is_final to clearVisualSession so future telemetry can distinguish caller-driven clears from timeout-driven clears
  - non-blocking error handling at the dispatcher hook (lifecycle failures must not break the underlying action)
  - mock _createHistory addition keeps cases A-I untouched while letting case L assert append-only re-arm semantics
metrics:
  duration: ~15 min
  tasks_completed: 2
  files_modified: 2
  new_sub_assertions: 17
  lifecycle_test_total: 79
  full_chain_test_status: exit 0
  completed: 2026-05-11
---

# Phase 257 Plan 01: Explicit Completion (is_final) Immediate-Clear Summary

Wired the runtime behaviour for `is_final: true` on top of Phase 256's sliding-window lifecycle. When the MCP bridge payload carries `visualSession.isFinal === true`, the visual session now clears IMMEDIATELY after the action's `change_report` resolves -- both in the resolved-tab branch and in the bootstrap branch (`open_tab` / `switch_tab`) of `MCPBridgeClient._handleExecuteAction`. Redundant `is_final: true` signals on tabs with no active session remain silent no-ops via Phase 256's pre-existing helper semantics.

## Files Modified

**Exactly 2 files modified.**

| File | Role | Lines added |
|------|------|-------------|
| `extension/ws/mcp-bridge-client.js` | Dispatcher hook | +60 / -2 |
| `tests/mcp-visual-tick-lifecycle.test.js` | Helper-layer tests | +101 / -4 |

No changes to the lifecycle module (`extension/utils/mcp-visual-session-lifecycle.js`), no MCP server changes, no docs, no `package.json`. The Phase 256 helper `clearVisualSession(tabId, options)` was already idempotent on no-entry; this plan only adds the caller.

## New Method Shape: `_clearVisualSessionIfFinal`

`MCPBridgeClient.prototype._clearVisualSessionIfFinal(tabId, agentId, payload)` is a companion to Phase 256's `_recordVisualSessionTickIfPresent`. Both share gating shape (sidecar-presence + numeric tabId + non-empty agentId) but the new method adds a fourth gate: `sidecar.isFinal === true`. On all guard fails the method is a zero-overhead return. On success it invokes:

```javascript
await MCPVisualSessionLifecycleUtils.clearVisualSession(tabId, { reason: 'is_final' });
```

The `reason: 'is_final'` override is purely for future telemetry hygiene -- the underlying helper's behaviour is identical to the default `reason: 'timeout'` path (deletes storage entry, cancels `mcpVisualDeath:<tabId>` alarm, broadcasts the v0.9.36-compatible `phase: 'ended'` payload via `sendSessionStatus`). Errors are swallowed with `console.warn('[FSB MCP] clearVisualSession (is_final) failed (non-blocking):', err && err.message)` so a lifecycle hiccup never breaks the underlying action's return value.

## Call Sites (2 total)

**Bootstrap branch (`open_tab` / `switch_tab`).** Inside the existing `if (dispatched && dispatched.success === true)` gate, immediately after the Phase 256 `_recordVisualSessionTickIfPresent(resolvedTabId, agentId, payload)` call:

```javascript
await this._recordVisualSessionTickIfPresent(resolvedTabId, agentId, payload);
await this._clearVisualSessionIfFinal(resolvedTabId, agentId, payload);
```

The bootstrap dispatch wraps `change_report` internally via `dispatchWithoutResolvedTab` -> `wrapWithChangeReport`, so by the time `dispatched` resolves the change_report has already landed. No additional capture-rewrite was required for this branch.

**Resolved-tab branch (all other action tools).** The pre-Phase-257 code returned the result of `wrapWithChangeReport` or `executeFn()` directly. Phase 257 captures the result first, fires the clear, then returns:

```javascript
let actionResult;
if (typeof wrapWithChangeReport === 'function' && !usesDispatcherSyntheticChangeReport) {
  actionResult = await wrapWithChangeReport({ toolName: payload.tool, tabId, params, execute: executeFn });
} else {
  actionResult = await executeFn();
}

await this._clearVisualSessionIfFinal(tabId, agentId, payload);
return actionResult;
```

For non-`isFinal` callers the new `await` is a single microtask hop into a method that returns immediately on the sidecar gate -- negligible cost.

## New Test Cases (J / K / L)

All three appended to `tests/mcp-visual-tick-lifecycle.test.js` after Case I.

| Case | REQ | Assertions | What it locks |
|------|-----|------------|---------------|
| **J** | COMPLETE-01 + COMPLETE-02 | 8 sub-assertions | `clearVisualSession(88, { reason: 'is_final' })` on an active session returns `{ ok: true, action: 'cleared' }`, deletes `mcpVisualSession:88`, broadcasts exactly one `phase: 'ended'` payload to tab 88, and cancels `mcpVisualDeath:88`. |
| **K** | COMPLETE-03 | 5 sub-assertions | `clearVisualSession(89, { reason: 'is_final' })` on a tab with NO active session returns `{ ok: true, action: 'noop' }`, no storage mutation, no broadcast, no rejection envelope. |
| **L** | COMPLETE-02 reinforcement | 4 sub-assertions | After `clearVisualSession(91)`, `chrome.alarms.getAll()` does NOT contain `mcpVisualDeath:91`, the append-only `_createHistory()` shows exactly one create for that name (no re-arm), and `chrome.alarms.clear` was called for it at least once. |

Test mock change: added `_createHistory()` to `createChromeMock().alarms` to track append-only creation history (the existing `_created()` returns the live `alarms` Map for back-compat with Cases A through I). Case L uses `_createHistory()` so the assertion "no new alarm re-armed after clear" is semantically correct under the mock model.

## REQ-ID Traceability

| REQ-ID | Code site | Test site |
|--------|-----------|-----------|
| **COMPLETE-01** (`is_final` triggers immediate clear) | `extension/ws/mcp-bridge-client.js::_clearVisualSessionIfFinal` gate `sidecar.isFinal !== true` + invocation of `clearVisualSession` | Case J.1 (action=cleared on active session) |
| **COMPLETE-02** (clear fires AFTER change_report resolves; death-timer cancelled) | resolved-tab branch capture-clear-return ordering; bootstrap branch post-tick ordering | Case J.2 / J.6 (storage gone immediately, alarm cancelled) + Case L (death timer not re-armed) |
| **COMPLETE-03** (no-active-session is silent no-op) | delegation to `clearVisualSession` (Phase 256 idempotency) | Case K.1 (action=noop) + K.2 / K.3 / K.4 (no mutation, no broadcast, no rejection) |

## Verification

```bash
node tests/mcp-visual-tick-lifecycle.test.js
# === Results: 79 passed, 0 failed ===
#   62 baseline (cases A-I, Phase 256)
# + 17 new    (case J = 8, case K = 5, case L = 4)
# = 79 total

npm test
# exit 0 (full chain green, no regressions)
```

Static checks (all pass):

```bash
grep -c "_clearVisualSessionIfFinal" extension/ws/mcp-bridge-client.js     # 3 (decl + 2 callsites)
grep -c "reason: 'is_final'" extension/ws/mcp-bridge-client.js              # 1
grep -c "sidecar.isFinal !== true" extension/ws/mcp-bridge-client.js        # 1 (gate)
grep -c "clearVisualSession (is_final) failed" extension/ws/mcp-bridge-client.js  # 1 (warn)
grep -c "recordVisualSessionTick failed (non-blocking)" extension/ws/mcp-bridge-client.js  # 1 (Phase 256 warn unchanged)
grep -n "^async function caseJ\|^async function caseK\|^async function caseL" tests/mcp-visual-tick-lifecycle.test.js  # 3
grep -n "await caseJ()\|await caseK()\|await caseL()" tests/mcp-visual-tick-lifecycle.test.js  # 3 (driver)
grep -c "COMPLETE-0" tests/mcp-visual-tick-lifecycle.test.js                # 11 (>= 4 floor)
```

## Ordering Invariants Preserved

- **v0.9.60 ownership gate** still fires at `_handleExecuteAction` line ~728 BEFORE either the Phase 256 tick or the Phase 257 clear. T-257-01 (Spoofing) and T-257-06 (EoP) mitigated by inheritance.
- **Phase 256 tick** still fires at line ~752 (resolved-tab branch) and line ~723 (bootstrap branch) BEFORE the underlying action. Tick semantics unchanged.
- **Phase 257 clear** fires AFTER `wrapWithChangeReport` / the underlying dispatch returns. The user sees the action's visible effect land first, then the overlay vanishes -- in step with the agent's logical completion.

## Commits

| Hash | Message |
|------|---------|
| `5193d4b` | `feat(257-01): wire _clearVisualSessionIfFinal post-change_report in both _handleExecuteAction branches (COMPLETE-01..03)` |
| `5261f38` | `test(257-01): append Case J / K / L to mcp-visual-tick-lifecycle covering COMPLETE-01..03 (is_final immediate clear)` |

Both committed on branch `refinements`.

## Deviations from Plan

**One small deviation, scoped to the test mock only:**

The plan's Task 2 Step 2.2 (Case L) assertion `L.2 no new alarm re-armed after clear (created count remains at 1 -- the original tick)` used `chromeMock.alarms._created().filter((a) => a.name === 'mcpVisualDeath:91').length === 1`. Under the existing mock (carried over from Phase 256), `_created()` returns the LIVE alarm Map, not an append-only history. After a successful clear, the live count for the cleared name is 0, not 1, so the literal assertion failed when first executed.

**Fix (Rule 1 -- bug):** Added `_createHistory()` to `createChromeMock().alarms` as a new accessor that returns the append-only create-call history. Existing `_created()` was left unchanged for back-compat with Cases A through I (which used it for "currently armed" semantics). Case L now uses `_createHistory()` for the "no re-arm" assertion. The mock change is fully additive; no existing assertion shifted semantics. Lifecycle module under test was NOT touched.

This is the only delta from the planner's verbatim spec. All other instructions, gates, naming, commit messages, and acceptance criteria were honoured as written.

## Self-Check: PASSED

- `extension/ws/mcp-bridge-client.js`: `_clearVisualSessionIfFinal` declared (line 648); call sites at lines 725 (bootstrap) and 801 (resolved-tab). VERIFIED.
- `tests/mcp-visual-tick-lifecycle.test.js`: `caseJ`, `caseK`, `caseL` declared; driver invokes all three after `caseI()`; `_createHistory` accessor added. VERIFIED.
- Commit `5193d4b` exists. VERIFIED.
- Commit `5261f38` exists. VERIFIED.
- `node tests/mcp-visual-tick-lifecycle.test.js` exits 0 with `Results: 79 passed, 0 failed`. VERIFIED.
- `npm test` exits 0. VERIFIED.

All success criteria from the plan satisfied.
