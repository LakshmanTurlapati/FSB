# Phase 203: MCP Visual Session Contract - Context

**Gathered:** 2026-04-23T21:05:01-0500
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 203 adds an explicit MCP lifecycle for the visible browser-automation surface so an external MCP client can start the glow/overlay, keep it updated, and end it without invoking `run_task`.

This phase does not render the client badge in the overlay UI, mirror the badge into dashboard/DOM-stream surfaces, persist client identity across navigation/reinjection, or add disconnect/watchdog cleanup. Those concerns belong to Phase 204. Phase 203 also does not create a second FSB planning/execution engine; it only exposes the visible lifecycle.

</domain>

<decisions>
## Implementation Decisions

### Public MCP Contract
- **D-01:** [auto] Add dedicated MCP tools `start_visual_session` and `end_visual_session`. Do not overload `run_task` for this feature.
- **D-02:** [auto] Keep `report_progress`, `complete_task`, `partial_task`, and `fail_task` as the progress/finalization path for client-owned visual sessions when the caller provides the issued `session_token`.
- **D-03:** [auto] Calls to `report_progress`, `complete_task`, `partial_task`, and `fail_task` without a visual-session token must preserve their current no-effect/autopilot behavior so the agent loop and stuck-detection assumptions remain intact.
- **D-04:** [auto] `start_visual_session` should return an extension-issued `sessionToken`, the canonical client label, and the active target tab ID. Follow-up calls must use that token.
- **D-05:** [auto] The Phase 203 contract targets the active normal webpage only. Starting a visual session on restricted/browser-internal pages must fail with the same navigation-only recovery posture Phase 199 established.

### Trusted Client Identity
- **D-06:** [auto] Trusted client identity comes from a fixed allowlist and normalizes caller input to canonical labels before storage or rendering.
- **D-07:** [auto] The initial canonical allowlist is `Claude`, `Codex`, `ChatGPT`, `Perplexity`, `Windsurf`, `Cursor`, `Antigravity`, `OpenCode`, `OpenClaw`, `Grok`, and `Gemini`.
- **D-08:** [auto] Arbitrary caller-supplied badge text must be rejected both server-side and extension-side. A bypassed or stale client should not be able to inject untrusted brand text into overlay state.
- **D-09:** [auto] Phase 203 should carry the canonical client label through session/overlay payloads now so Phase 204 can render the badge without reshaping the protocol.

### Session Ownership And Lifecycle
- **D-10:** [auto] Client-owned visual sessions are separate from FSB autopilot sessions. Starting a visual session claims only the visible feedback surface; it must not create or mutate an `activeSessions` AI run.
- **D-11:** [auto] One client-owned visual session may own the active tab surface at a time. A newer start on that tab invalidates any older client-owned token, and stale follow-up calls must be ignored rather than clearing the newer session.
- **D-12:** [auto] Client-owned visual sessions must not compete with a real FSB autopilot run on the same tab. If `run_task` already owns the tab, `start_visual_session` should fail with a structured busy error instead of showing competing glows.
- **D-13:** [auto] Success, partial, and failure outcomes should freeze the overlay briefly as a final state and then clear it deterministically. Explicit end/cancel should clear immediately.
- **D-14:** [auto] Reuse the existing `sessionToken` / `version` stale-message guards in `utils/overlay-state.js` instead of inventing a second suppression mechanism.

### Phase Boundary
- **D-15:** [auto] Watchdog/disconnect cleanup, same-session navigation persistence, content-script reinjection behavior, and mirrored dashboard badge presentation remain Phase 204 work.
- **D-16:** [auto] Phase 203 may plumb client-label metadata through overlay state, but it must avoid visible badge DOM work in `content/visual-feedback.js`. Rendering belongs to Phase 204.

### the agent's Discretion
- Exact helper/module names for the allowlist and visual-session store.
- Whether token invalidation is implemented as "latest start wins" or a small same-tab replace helper, as long as stale tokens cannot clear newer sessions.
- Exact payload field names beyond the required public MCP tool names and canonical client label set.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Milestone Intent
- `.planning/ROADMAP.md` - Phase 203 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` - `LIFE-01`, `LIFE-02`, `LIFE-03`, and `BADGE-01`.
- `.planning/PROJECT.md` - Current milestone goal and approved client-label examples.
- `.planning/STATE.md` - Current project focus and milestone readiness state.

### Prior Phase Constraints
- `.planning/phases/199-mcp-tool-routing-contract/199-CONTEXT.md` - Explicit route-contract rules, restricted-tab recovery posture, and shared dispatcher expectations.
- `.planning/phases/200-doctor-status-watch-recovery-messaging/200-CONTEXT.md` - Existing layered-error vocabulary and diagnostics posture to preserve when adding new session errors.

### MCP Tool And Bridge Surface
- `mcp-server/src/runtime.ts` - MCP tool registration order.
- `mcp-server/src/tools/autopilot.ts` - Existing `run_task`/`stop_task`/`get_task_status` contract and progress notifications.
- `mcp-server/src/tools/manual.ts` - Existing registration path for `report_progress`, `complete_task`, `partial_task`, and `fail_task`.
- `mcp-server/src/types.ts` - MCP bridge message type definitions.
- `mcp-server/src/errors.ts` - Current user-facing MCP error mapping surface.
- `ai/tool-definitions.js` - Shared schema/description source for background-routed task-status tools.

### Extension Runtime Surface
- `ws/mcp-tool-dispatcher.js` - Shared direct route table and current placeholder task-status handlers.
- `ws/mcp-bridge-client.js` - WebSocket message routing and current `run_task` lifecycle handling.
- `background.js` - `sendSessionStatus`, autopilot session ownership, and active-tab lifecycle behavior.
- `utils/overlay-state.js` - Overlay normalization plus existing `sessionToken` / `version` stale-state guard.
- `content/messaging.js` - Overlay watchdog and sessionStatus consumption.
- `content/visual-feedback.js` - Current overlay rendering and final/fade behavior to preserve while badge DOM work stays out of scope.

### Tests To Extend
- `tests/mcp-tool-routing-contract.test.js` - Route-contract coverage for public MCP surface.
- `tests/mcp-bridge-client-lifecycle.test.js` - Bridge message routing and lifecycle harness pattern.
- `tests/test-overlay-state.js` - Overlay normalization and stale-message suppression coverage.
- `tests/tool-executor-readonly.test.js` - Existing narration/read-only assumptions for `report_progress`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `utils/overlay-state.js` already supports stale-message suppression via `sessionToken` and `version`, but `buildOverlayState()` does not currently populate those fields.
- `background.js` already owns the canonical `sendSessionStatus()` path that turns lifecycle data into overlay messages; client-owned visual sessions should reuse that surface instead of inventing a parallel content-script message.
- `ws/mcp-tool-dispatcher.js` already centralizes direct MCP route handling and placeholder task-status verbs; this is the right place to turn client-owned progress/final calls into explicit overlay lifecycle work.
- `ws/mcp-bridge-client.js` already carries custom MCP message types like `mcp:start-automation` and is the natural place for new start/end visual-session message types.
- `content/messaging.js` already destroys/finalizes overlays based on normalized `overlayState.lifecycle`; Phase 203 should feed it better lifecycle data rather than add another renderer path.

### Established Patterns
- Shared cross-runtime helpers live in plain JavaScript files that work in extension, Node test, and `require()` contexts.
- Focused regression coverage uses plain Node assertion scripts and VM harnesses instead of a heavyweight framework.
- Public MCP tool names stay snake_case, while bridge message types stay `mcp:*`.
- New MCP server tools are typically registered in focused modules under `mcp-server/src/tools/` and composed in `mcp-server/src/runtime.ts`.

### Integration Points
- New dedicated server tools will register beside `autopilot.ts` and use `WebSocketBridge.sendAndWait()` rather than piggybacking on the manual-tool registry.
- Existing task-status tools still flow through `mcp:execute-action` and the dispatcher, so token-aware visual-session follow-up work should plug into that path without disturbing agent-loop callers that omit the token.
- Client-owned overlay lifecycle must coexist with `run_task`, but should not reuse `activeSessions` or `runAgentLoop`.

</code_context>

<specifics>
## Specific Ideas

- The user specifically wants a visible "little animation"/glow that can be started by an MCP call and stopped by an MCP call, without starting autopilot.
- The user also wants a small trusted client badge chosen from a fixed list such as Claude, Codex, ChatGPT, Perplexity, Windsurf, Cursor, Antigravity, OpenCode, Grok, and Gemini.
- Phase 203 should therefore focus on the explicit start/progress/end contract and trusted client-label plumbing, while leaving actual badge rendering to Phase 204.

</specifics>

<deferred>
## Deferred Ideas

- Overlay badge DOM rendering and styling.
- Dashboard / DOM-stream badge mirroring.
- Watchdog cleanup for disconnected or forgotten client sessions.
- Same-session navigation persistence and reinjection recovery.

</deferred>

---

*Phase: 203-mcp-visual-session-contract*
*Context gathered: 2026-04-23*
