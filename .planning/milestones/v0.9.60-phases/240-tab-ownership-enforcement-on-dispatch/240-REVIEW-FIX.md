---
phase: 240-tab-ownership-enforcement-on-dispatch
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/240-tab-ownership-enforcement-on-dispatch/240-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 240: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** .planning/phases/240-tab-ownership-enforcement-on-dispatch/240-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Critical 0 + Warning 3)
- Fixed: 3
- Skipped: 0
- Info findings (IN-01..IN-04): out of scope, untouched

## Fixed Issues

### WR-01: start_visual_session cross-agent reject branch never fires in production dispatch

**Files modified:** `extension/ws/mcp-tool-dispatcher.js`, `extension/background.js`
**Commit:** ef56728
**Applied fix:**
- Removed the `void agentId;` drop in `handleStartVisualSessionRoute` and replaced the comment with a Phase 240 D-09 note explaining why agentId must be threaded.
- Added `agentId: typeof agentId === 'string' && agentId ? agentId : null` to the `callCallbackHandler('handleStartMcpVisualSession', ...)` envelope.
- Added a matching `agentId: typeof request?.agentId === 'string' && request.agentId ? request.agentId : null` to the `manager.startSession({...})` call inside `handleStartMcpVisualSession` in background.js.
- Result: `McpVisualSessionManager.startSession` now sees the caller agentId on production dispatch, so the D-09 cross-agent reject and D-03 same-agent resume branches fire (not just on direct unit-test invocations).

### WR-02: Resume branch retains stale lifecycle: 'final' and finalClearAt from prior session

**Files modified:** `extension/utils/mcp-visual-session.js`
**Commit:** 34d065a
**Applied fix:**
- Inside the same-agent resume branch (post `version` bump, pre re-store), added a guard `if (existingSession.lifecycle === 'final')` that resets terminal-state fields back to running:
  - `lifecycle = 'running'`
  - `phase = 'planning'`
  - `finalClearAt = null`
  - `finalClearReason = ''`
  - `result = ''`
  - `reason = ''`
  - `statusText = existingSession.detail || 'Ready to begin'`
- This prevents `overlayStateUtils.buildOverlayState` from rendering the completed final card under the new task title when an agent calls `start_visual_session` again on a tab whose prior session had transitioned to terminal lifecycle.
- Note: the reviewer recommended adding a test asserting the resumed lifecycle is 'running'. Test addition was not part of this fix pass; recommend tracking as a follow-up alongside the existing `tests/visual-session-reentry.test.js` suite.

### WR-03: Autopilot inline tool calls bypass the ownership gate entirely

**Files modified:** `extension/ai/agent-loop.js`
**Commit:** f05324c
**Applied fix:** Documentation-only (Option A from REVIEW.md).
- Extended the existing Phase 240 D-02 NOTE block above `runAgentLoop` with an explicit "Phase 240 WR-03 CARVE-OUT" subsection.
- The new comment block states:
  - Inline autopilot tool actions execute via direct content-script messaging and CDP, NOT via `dispatchMcpToolRoute`, so they bypass `checkOwnershipGate`.
  - The "single chokepoint" claim in CONTEXT.md D-06 only holds for MCP-bridge-originated tools.
  - Mitigation at session start (handleStartAutomation bindTab) is acknowledged.
  - The mid-session force-rebind failure mode (external MCP open_tab from another agent rebinds the tab while autopilot continues acting) is documented as a known gap.
  - Phase 244 hardening is identified as the right scope: add a sync `isOwnedBy` check at iteration setup using `sessionData.agentId` + `sessionData.ownershipToken`, abort with `tab_owned_by_other_agent`.
- Rationale for deferral: wiring per-iteration ownership checks into `runAgentLoop` requires session.ownershipToken plumbing, error code wiring, and per-tool gating semantics. Per the user's instruction ("If non-trivial, document the gap and defer to Phase 244 hardening"), Option A was selected over Option B.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
