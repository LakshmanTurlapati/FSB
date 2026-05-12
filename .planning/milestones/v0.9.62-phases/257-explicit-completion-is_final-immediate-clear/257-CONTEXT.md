# Phase 257: Explicit Completion (`is_final` immediate clear) - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart-discuss (locked decisions inherited from Phase 254 contract + Phase 256 lifecycle)
**Authoritative reference:** `.planning/v0.9.62-CONTRACT.md` (Field Bundle section -- `is_final` field is already pinned).

<domain>
## Phase Boundary

Phase 257 wires the runtime behaviour for `is_final: true` on top of the sliding-window lifecycle Phase 256 just landed.

What lands:

1. **`is_final: true` clears immediately** (COMPLETE-01, COMPLETE-02) -- when an action-tool call carries `is_final: true`, the visual session clears immediately AFTER the action's `change_report` resolves. NOT 60 seconds later. The death-timer arithmetic is cancelled (alarm cancelled, storage entry deleted), and the existing v0.9.36 renderer's clear hook is triggered.

2. **Idempotent on no-active-session** (COMPLETE-03) -- calling an action tool with `is_final: true` on a tab that has NO active visual session (e.g. first call of a fresh sequence after a previous auto-clear; or a confused caller) is a no-op for the lifecycle. The action itself still executes normally; the clear path silently short-circuits. No typed error.

OUT OF SCOPE:
- Removal of the v0.9.36 explicit `start_visual_session` / `end_visual_session` MCP tools (Phase 258).
- `TOOL_REMOVED` typed error (Phase 258).
- CHANGELOG / mcp/README breaking-change entries (Phase 258).
- Skill USAGE.md / references rewrites (Phase 260).
- Adding `is_final` to the autopilot `run_task` overlay management (PARITY-FUTURE-01; deferred).

</domain>

<decisions>
## Implementation Decisions

### Where the immediate-clear fires

The clear fires in the SAME chokepoint as the lifecycle tick, but on the OPPOSITE side of the action dispatch: AFTER `change_report` resolves successfully.

Current ordering in `extension/ws/mcp-bridge-client.js::_handleExecuteAction` (post-Phase 256):

1. Visual-fields validator (Phase 255 -- VISUAL_FIELDS_REQUIRED / BADGE_NOT_ALLOWED rejection).
2. Ownership resolver (v0.9.60 -- TAB_NOT_OWNED / AGENT_CAP_REACHED rejection).
3. **(Phase 256)** `_recordVisualSessionTickIfPresent(tabId, agentId, visualSession)` -- creates / refreshes the lifecycle entry; arms the 60s alarm.
4. Underlying browser action executes (e.g. CDP click, CDP type).
5. `change_report` resolves.
6. **(Phase 257 new)** If `visualSession.isFinal === true`, call `_clearVisualSessionIfFinal(tabId, agentId)` which invokes `MCPVisualSessionLifecycle.clearVisualSession(tabId, agentId)`.
7. Bridge response returns to MCP server.

The clear fires AFTER the change_report so the user sees the action's visible result land FIRST, then the overlay vanishes in step with the agent's logical completion.

### Idempotent on no-active-session

`clearVisualSession(tabId, agentId)` already handles the no-entry case (Phase 256 helper). If no `mcpVisualSession:<tabId>` entry exists, the helper short-circuits silently. The new dispatch-side caller therefore just calls the helper unconditionally when `isFinal === true`; the helper handles idempotency.

If an entry exists with a DIFFERENT agent_id, the existing v0.9.60 ownership gate would have rejected the call BEFORE step 3 -- so by the time we reach step 6, the entry (if any) belongs to the calling agent. No additional ownership check needed in the clear path.

### Renderer clear hook reused from v0.9.36

`clearVisualSession` already sends the existing v0.9.36 `mcpVisualSession:clear` / `sessionStatus` (or whatever the planner discovers) message to the content script's renderer. Phase 257 adds NO new renderer code -- it just triggers the existing path earlier than the 60s timeout would.

### Bootstrap branch (open_tab / switch_tab) behaviour

Phase 256 fires the lifecycle tick from the bootstrap branch (the `open_tab` / `switch_tab` post-dispatch arm at lines 664-683 in mcp-bridge-client.js) when `dispatched.success === true && Number.isFinite(dispatched.tabId)`. Phase 257 mirrors the same conditional: if the bootstrap dispatched the underlying tool successfully AND `isFinal === true`, the immediate-clear path fires after the bootstrap dispatch's `change_report` resolves.

### Claude's Discretion

- Exact helper name on `_handleExecuteAction` for the immediate-clear caller (suggest `_clearVisualSessionIfFinalAfterChange`; planner refines).
- Whether to invoke the helper inline in `_handleExecuteAction` OR factor a new method on the dispatcher (allowed; mirror the pre-existing pattern).
- Whether to fire the clear synchronously after change_report resolves OR asynchronously via setTimeout(0) (synchronous is fine; the v0.9.36 renderer clear is fast).
- Whether to emit a telemetry event on immediate-clear (allowed but not required).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extension/utils/mcp-visual-session-lifecycle.js` (Phase 256) -- exports `clearVisualSession(tabId, agentId)`. Phase 257 calls this helper. NO new helpers needed in the lifecycle module.
- `extension/ws/mcp-bridge-client.js::_recordVisualSessionTickIfPresent` (Phase 256) -- companion method on the dispatcher. Phase 257 adds a sibling method that fires after the action's change_report.
- v0.9.36 renderer `mcpVisualSession:clear` / `sessionStatus` content-script message path -- already triggered by `clearVisualSession` per Phase 256. Phase 257 just triggers it earlier.

### Established Patterns

- Lifecycle methods named `_<verb>VisualSession<Suffix>` on the dispatcher class.
- `isFinal` field name is camelCase on the bridge payload (sidecar shape locked by Plan 256-02); the wire field on the MCP schema side is `is_final` (snake_case per v0.9.62 contract; the strip-and-forward in Plan 256-02 already handles the conversion).
- Idempotent state mutations via the lifecycle helpers -- never throw on no-entry; return `{ ok: true, action: 'no_op' }`.

### Integration Points

- `extension/ws/mcp-bridge-client.js` -- adds the immediate-clear hook in `_handleExecuteAction` (both the resolved-tab branch and the bootstrap branch).
- `tests/mcp-visual-tick-lifecycle.test.js` -- gets new test cases for `isFinal: true` behaviour (case J + case K minimum).
- NO new test file required; piggyback on the existing Phase 256 test scaffold.
- NO new module files.

</code_context>

<specifics>
## Specific Ideas

### Plan shape (1-2 plans total recommended)

- **257-01 Immediate-clear hook + tests** -- modify `extension/ws/mcp-bridge-client.js` to fire `clearVisualSession` after change_report resolves when `isFinal === true`. Add 2-3 test cases to `tests/mcp-visual-tick-lifecycle.test.js`. Single atomic commit per task; 2-3 commits total. Single plan, single wave.

This is small enough for a single plan; the planner may decide to keep it as one PLAN.md.

### Test additions

Append to `tests/mcp-visual-tick-lifecycle.test.js`:

- **Case J (COMPLETE-01 / COMPLETE-02)** -- tick with `isFinal: true` followed by `change_report` resolution clears the entry IMMEDIATELY (no 60s wait). Verify:
  - Storage entry deleted right after the simulated change_report resolution.
  - Alarm `mcpVisualDeath:<tabId>` cancelled.
  - `mcpVisualSession:clear` / `sessionStatus` content-script message sent.
- **Case K (COMPLETE-03)** -- tick with `isFinal: true` on a tab with NO existing session is a no-op: no error, no message, no storage / alarm mutation; the action itself proceeds normally.

### What Phase 257 does NOT do

- No new lifecycle module code (Phase 256 helpers cover it).
- No new MCP server code (sidecar already carries `isFinal`).
- No CHANGELOG / docs (Phase 258 / 260).

</specifics>

<deferred>
## Deferred Ideas

None new.

</deferred>

---

*Phase: 257-explicit-completion-is_final-immediate-clear*
*Context gathered: 2026-05-11 via smart-discuss (decisions inherited from Phase 254 + 256)*
