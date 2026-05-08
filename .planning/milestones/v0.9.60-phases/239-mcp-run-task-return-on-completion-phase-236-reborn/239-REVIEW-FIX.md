---
phase: 239-mcp-run-task-return-on-completion-phase-236-reborn
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/239-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 239: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** .planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/239-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical: 0, Warning: 2; Info: 4 out of scope under critical_warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Two terminal-event call sites in agent-loop.js still use raw `chrome.runtime.sendMessage` instead of `fsbBroadcastAutomationLifecycle`

**Files modified:** `extension/ai/agent-loop.js`
**Commit:** 2f72e75
**Applied fix:** Replaced both raw `chrome.runtime.sendMessage(...)` call sites in `runAgentIteration` (the `session_not_found` guard at line 1399-1424 and the `session_not_running` guard at line 1428-1454) with the `fsbBroadcastAutomationLifecycle(msg)` helper resolved off `globalThis`. Pattern matches the existing `notifySidepanel` implementation (line 1314-1320): a `helperHost` reference, a typeof check, a captured promise with `.catch` for delivery-failure logging, and an explicit warn-fallback when the helper is absent. This ensures the in-SW MCP bridge client receives the terminal event via the lifecycle bus so its `_handleStartAutomation` promise resolves immediately rather than waiting for the 600s safety net.

### WR-02: Heartbeat-vs-settle storage write race can leave snapshot stuck at `in_progress` after terminal settle

**Files modified:** `extension/ws/mcp-bridge-client.js`
**Commit:** 2c49882
**Applied fix:** Added a `if (settled) return;` re-check inside `fireHeartbeat`, placed immediately AFTER the `_sendProgress(mcpMsgId, payload)` call and BEFORE the `await store.writeSnapshot(...)` block. This closes the race window where settle() could fire (writing the terminal snapshot) between the top-of-function `settled` guard and the awaited storage write, preventing the heartbeat's `in_progress` write from race-overwriting the terminal `complete` write. Comment block above the re-check documents why both guards are needed (synchronous `_sendProgress` plus implicit microtask boundary). The simpler alternative recommended by the reviewer was chosen over restructuring `settle`'s terminal write to be awaitable.

## Skipped Issues

None. All in-scope findings were fixed.

Note on Info findings (out of scope under `critical_warning`):
- IN-01 (parameter shadowing in heartbeat closure) -- cosmetic rename, no correctness impact.
- IN-02 (reconciler advisory mark on every reconnect) -- documented as best-effort per CONTEXT D-05; reviewer also acknowledges it is mostly self-correcting.
- IN-03 (defensive `agentId` type guard in `_handleGetTaskSnapshot`) -- store already silently no-ops for non-string input; pure defensive layering.
- IN-04 (widen grep gate to cover full `runAgentIteration` body) -- test-coverage hardening that is naturally addressed once the WR-01 fix lands; the existing gate continues to pass.

These can be revisited in a follow-up iteration with `fix_scope: all` if desired.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
