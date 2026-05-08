# Phase 239: MCP `run_task` Return-on-Completion (Phase 236 reborn) - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make long-running `run_task` MCP calls settle when the underlying automation actually completes -- driven by the existing `fsbAutomationLifecycleBus.dispatch('automationComplete')` event rather than the current 300s arbitrary ceiling. Belt-and-suspenders coverage:

- 300s ceiling at `mcp/src/tools/autopilot.ts:61` and `extension/ws/mcp-bridge-client.js:678-680` raised to a 600s safety net (kept until cleanup-path audit confirms zero dropped lifecycle events).
- 30s heartbeat ticks via `_sendProgress` / `notifications/progress` so MCP host clients (Claude Code, Cursor, Codex, OpenClaw) do not hit per-tool timeouts.
- Task lifecycle persisted in `chrome.storage.session` keyed by `task_id` so SW eviction during a long task can settle the originating MCP call cleanly.
- Audit + regression tests for every `cleanupSession` exit path (normal completion, stuck-detection terminal exit, safety breaker, tab close, `handleStopAutomation`).
- 5 long-task UAT runs (>5 min each) returning on actual completion rather than at the 600s safety net.

**Independent of Phases 237 / 238 / 240+** -- ships in parallel. Closes the deferred Phase 236 work so `fsb-mcp-server@0.8.0` carries the fix.

</domain>

<decisions>
## Implementation Decisions

### Heartbeat (MCP-05)

- **D-01 Payload is progress-rich.** Every 30s tick carries `{timestamp, sessionId, taskId, alive: true, step, elapsed_ms, current_url, ai_cycles, last_action}`. MCP hosts get real-time visibility into what the agent is doing on long tasks. FSB already exposes these fields via `_sendProgress`, so no new extension surface is needed.
- **D-02 Wire shape uses MCP `_meta` escape hatch.** The notification is `notifications/progress` with `{progress, total, progressToken, _meta: {step, elapsed_ms, current_url, ai_cycles, last_action, alive: true}}`. `_meta` is the spec's standard vendor-extension slot. Spec-clean; no parallel notification stream.

### Persistence (MCP-06)

- **D-03 Rich snapshot stored per `task_id`.** Shape mirrors the v0.9.36 visual-session pattern (see `extension/utils/mcp-visual-session.js`):
  ```
  {
    task_id,
    status: 'in_progress' | 'complete' | 'error' | 'stopped' | 'partial',
    started_at,
    last_heartbeat_at,
    originating_mcp_call_id,
    target_tab_id,
    current_step,
    ai_cycle_count,
    last_dom_hash,
    final_result?  // populated only on terminal events
  }
  ```
  Enables resume-and-decide on SW wake; downstream phases (240+) can read this same shape if needed.
- **D-04 Write cadence: every heartbeat tick AND every state transition.** Steady-state write rate ~2/min plus terminal events. SW wake always finds a snapshot at most 30s stale. The chrome.storage.session quota is far more than enough at this rate (Phase 237 agent-registry uses the same approach).

### Lifecycle-bus-driven completion (MCP-03)

- **D-05 SW-wake resume semantics: explicit `sw_evicted` outcome.** When the SW wakes mid-task and finds a persisted in-flight task with no terminal event, the originating `run_task` MCP call settles with:
  ```
  {
    success: true | false,  // best inference from partial_state
    sw_evicted: true,
    partial_state: { ...rich snapshot fields },
    last_heartbeat_at
  }
  ```
  Host knows the gap happened; can re-queue or accept. No ghost continuations -- attempting to keep the automation running across SW eviction is deliberately out of scope (deferred to a future phase if user demand surfaces).

### 600s safety-net firing (MCP-04)

- **D-06 Resolve with `partial_outcome: 'timeout'`.** When the 600s ceiling actually fires (lifecycle event never came), the MCP call resolves with:
  ```
  {
    success: true,
    partial_outcome: 'timeout',
    partial_state: { ...rich snapshot fields },
    hint: 'lifecycle event missing -- audit cleanup paths'
  }
  ```
  Hosts salvage gathered progress; the `hint` makes the failure mode loud enough to surface as a real bug rather than a silent timeout. The 600s safety net stays in place until the cleanup-path audit (D-08) proves zero dropped events under the 5 UAT runs (SC#5).

### v0.8.0 compatibility

- **D-07 Additive only.** Existing `run_task` callers see no diff in success-path responses. The new fields (`sw_evicted`, `partial_outcome`, `partial_state`, `hint`) appear only when the corresponding edge case fires. Documented in the v0.8.0 changelog as new fields, not as a breaking change. No `response_version` bump, no opt-in flag. The existing single-agent autopilot, manual MCP, and v0.9.36 visual-session contract tests must pass unchanged on the success path.

### Cleanup-path audit (SC#2)

- **D-08 Written audit table + per-path regression tests.** Ship `239-CLEANUP-AUDIT.md` in the phase directory with one row per cleanup exit path:

  | Path | File:Line | Lifecycle event emitted | Regression test |
  |------|-----------|-------------------------|-----------------|
  | Normal completion | extension/background.js:~1945 | `automationComplete` | `tests/run-task-cleanup-paths.test.js::normal_completion` |
  | Stuck-detection terminal exit | extension/background.js:~3378 | `automationComplete` or `automationError` | ...stuck_detection_terminal |
  | Safety breaker | extension/background.js | `automationError` | ...safety_breaker |
  | Tab close | extension/background.js:~2496 | `automationComplete` (with tabClosed reason) | ...tab_close |
  | `handleStopAutomation` | extension/background.js:~6542 | `automationComplete` (with stopped reason) | ...handle_stop |

  Plus `tests/run-task-cleanup-paths.test.js` with one named test per row asserting the lifecycle event actually fires and that `cleanupSession` was invoked. Pre-commit grep gate is over-engineering for one function (deferred to Phase 244 hardening if churn proves it warranted).

### Claude's Discretion

- TypeScript shape declarations for the persisted snapshot (D-03) -- the planner picks a single canonical type and exports it.
- Exact module placement of the sw_evicted/partial_outcome decision logic -- options are extending `mcp/src/tools/autopilot.ts`, adding a new `mcp/src/run-task-resolver.ts`, or extending the bridge client; planner decides based on dependency direction.
- Test framework: use the existing plain-Node `assert` harness (see Phase 238 convention) for the cleanup-path regression tests.
- Whether the persistence layer reads/writes through a new `mcp-task-store.js` helper or inlines `chrome.storage.session` calls. Recommended for the planner: a thin helper module mirroring `extension/utils/mcp-visual-session.js`'s shape, but acceptable to inline if total LoC < ~30.
- Whether to add a separate `tasks/239-RESEARCH.md` section probing whether any callers OTHER than the named four (autopilot, manual, visual-session, agents) issue `run_task` -- Phase 238 RESEARCH already enumerated bridge.sendAndWait sites; planner can reuse that mapping.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 239 contract sources

- `.planning/ROADMAP.md` (Phase 239 section -- 5 success criteria + parallelizable note)
- `.planning/REQUIREMENTS.md` -- MCP-03 (lifecycle-driven completion), MCP-04 (300->600s safety net), MCP-05 (30s heartbeat), MCP-06 (chrome.storage.session persistence)

### Existing call sites this phase modifies

- `mcp/src/tools/autopilot.ts:61` -- the `timeout: 300_000` site that becomes the 600s safety net
- `extension/ws/mcp-bridge-client.js:678-680` -- the second 300s ceiling site
- `extension/ws/mcp-bridge-client.js:653-742` -- existing `fsbAutomationLifecycleBus` subscription wiring this phase extends (already subscribes to `automationComplete`)
- `extension/background.js:1757` -- `cleanupSession()` definition
- `extension/background.js:1945, 2259, 2496, 3378, 6542` -- the 5 cleanup exit paths and their existing `automationComplete` / `automationError` dispatches (verify all five are covered by D-08 audit)

### Pattern parity references

- `extension/utils/mcp-visual-session.js` -- the v0.9.36 chrome.storage.session pattern that D-03 mirrors
- `extension/utils/agent-registry.js` (Phase 237) -- a more recent chrome.storage.session write-through example with reconciliation on SW wake; D-04 cadence borrows from this
- Phase 238 SUMMARYs -- enumerate every `bridge.sendAndWait` call site; planner can cross-reference to confirm the four threading targets are the only callers issuing `run_task`-equivalent payloads

### MCP spec

- MCP `notifications/progress` spec: progress/total/progressToken fields are spec; `_meta` is the standard vendor-extension slot used in D-02. (Spec text not in repo; planner consults the live spec via Context7 or upstream MCP docs.)

### Codebase architecture

- `.planning/codebase/ARCHITECTURE.md` -- MCP server <-> extension bridge wiring overview
- `.planning/codebase/CONVENTIONS.md` -- node:test plain-assert harness pattern used for D-08 regression tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `globalThis.fsbAutomationLifecycleBus` (extension/background.js) -- already dispatches `automationComplete` and `automationError` on every terminal path. Phase 239's job is to verify all 5 paths actually emit, not to add the bus.
- `_sendProgress` / `notifications/progress` (mcp/src/tools/autopilot.ts) -- the progress notification mechanism is already wired; needs a 30s ticker added (D-01, D-02).
- `chrome.storage.session` write-through helper pattern -- proven by `mcp-visual-session.js` and `agent-registry.js` (Phase 237). D-03 + D-04 follow the same shape.
- Plain-Node test harness (used in Phase 238: `tests/agent-scope.test.js`, `tests/agent-bridge-routes.test.js`, `tests/agent-id-threading.test.js`) -- D-08 regression tests use the same pattern.

### Established Patterns

- All `chrome.storage.session.*` calls in FSB use a versioned envelope `{v: 1, payload}` (see Phase 237 agent-registry). The persisted task snapshot (D-03) should use the same envelope shape so a future schema bump can migrate cleanly.
- `_sendProgress` already accepts arbitrary fields; the `_meta` block (D-02) is set on the inner `params` object that becomes the JSON-RPC notification payload.
- Lifecycle-bus listeners on the bridge client side (mcp-bridge-client.js:653-742) attach AND detach in the same scope -- so D-05 (sw_evicted) and D-06 (600s timeout) handlers must follow the same paired-cleanup discipline to avoid leaks across many tasks.

### Integration Points

- `mcp/src/tools/autopilot.ts:run_task` -- the registered tool function whose return shape this phase extends additively (D-07).
- `extension/ws/mcp-bridge-client.js:_handleRunTask` (or equivalent) -- the bridge-client side that dispatches to `chrome.runtime.sendMessage({action: 'startAutomation', ...})` and awaits `automationComplete` -- where the lifecycle subscription + 600s safety net + persistence read live.
- The new persistence helper (or inline calls) -- writes from `extension/background.js` cleanup paths (terminal events) AND from a heartbeat ticker that runs while a task is active.

</code_context>

<specifics>
## Specific Ideas

- **"Phase 236 reborn"** -- this is the deferred Phase 236 work folded into v0.9.60. The original Phase 236 was carried over from the v0.9.50 milestone (see PROJECT.md "Last shipped" line). The fix must land in `fsb-mcp-server@0.8.0` per the v0.9.60 milestone goal.
- **Parallel-shippable** -- ROADMAP explicitly states this phase is independent of Phases 237 / 238 / 240+. No cross-phase merge dependencies.
- **5 UAT runs (>5min each) per SC#5** -- these are the human verification items. Each run must demonstrate (a) MCP call returned on actual completion, not at 600s safety net; (b) progress observed at each 30s heartbeat boundary; (c) no SW eviction or, if eviction occurred, the call settled with `sw_evicted: true`.
- **The 600s safety net is provisional** -- it stays in place until the audit (D-08) plus 5 UAT runs prove zero dropped lifecycle events. A follow-up phase (likely Phase 244 hardening) can remove it if the data supports doing so.

</specifics>

<deferred>
## Deferred Ideas

- **Attempt-to-keep-running on SW wake** (the rejected Option B from D-05) -- continuing the automation loop from `current_step` after SW eviction. Introduces a whole new resume code path; high regression risk for the v0.8.0 release. Belongs in a follow-up phase if user demand surfaces after v0.8.0 ships.
- **Probe-then-decide on 600s fire** (the rejected Option C from D-06) -- one final read of `chrome.storage.session` for the task_id with a 5s race-window check before settling. Defers `partial_outcome` decisions across an extra round-trip. Reconsider only if D-08 audit reveals a tight-but-recoverable race window.
- **Append-only event log** for the persisted snapshot (the rejected option from D-03) -- richer forensics; overkill for the SW-wake recovery problem this phase actually solves.
- **`response_version: 2` schema bump** for the run_task return shape (the rejected option from D-07) -- only if a real breaking change surfaces post-release.
- **Pre-commit grep gate** for new `cleanupSession`-equivalent paths emitting lifecycle events (the rejected option from D-08) -- candidate for Phase 244 hardening if churn proves it warranted.
- **Removing the 600s safety net entirely** -- conditional on D-08 audit + 5 UAT runs proving zero dropped events. Phase 244 hardening item.

</deferred>

---

*Phase: 239-mcp-run-task-return-on-completion-phase-236-reborn*
*Context gathered: 2026-05-06*
