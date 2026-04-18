# Agent Loop Subsystem Findings

## Summary

13 findings across 20+ functions audited. The dominant regression is that the v0.9.24 modular agent loop (`ai/agent-loop.js`) is completely orphaned: `background.js` no longer imports or calls `runAgentLoop`, instead using the pre-v0.9.24 monolithic `startAutomationLoop` embedded in background.js itself. This means the v0.9.24 architecture -- typed sessions, hook pipeline, CostTracker, ActionHistory, safety breakers, prompt engineering, and provider-agnostic tool_use protocol -- is dead code. The old background.js loop handles everything inline with its own parallel implementations.

## Findings

### AL-01: agent-loop.js is completely orphaned -- not imported or called from background.js

- **File:** background.js (entire file, lines 1-10443)
- **Function:** handleStartAutomation() at line 4651, startAutomationLoop() at line 7399
- **Expected (v0.9.24):** background.js imported `agent-loop.js` via `importScripts`, and `handleStartAutomation` called `runAgentLoop(sessionId, { activeSessions, persistSession, sendSessionStatus, broadcastDashboardProgress, endSessionOverlays, cleanupSession, startKeepAlive, executeCDPToolDirect, handleDataTool, resolveAuthWall, hooks, emitter })` -- wiring the modular agent loop into background.js callbacks.
- **Actual (current):** background.js does NOT import `agent-loop.js` (no `importScripts('ai/agent-loop.js')` anywhere). `handleStartAutomation` at line 5001 calls `startAutomationLoop(sessionId)` -- a monolithic 1000+ line function at line 7399 that does its own DOM fetching, AI calling, action execution, and stuck detection all inline within background.js. `runAgentLoop` is never called.
- **Impact:** The entire v0.9.24 modular architecture is dead code. All improvements to agent-loop.js (safety breakers, cost tracking, hook pipeline, provider-agnostic tool_use protocol, structured prompt engineering, completion detection via complete_task/partial_task/fail_task tools) are not reachable. The system runs on the pre-v0.9.24 legacy loop.
- **Proposed Fix:** Re-wire background.js to import agent-loop.js and call `runAgentLoop` with the required options object, or merge the post-v0.9.24 improvements from the orphaned agent-loop.js into the active startAutomationLoop. The former preserves modularity; the latter is a pragmatic but messier approach.

### AL-02: createSessionHooks() removed -- HookPipeline never instantiated for sessions

- **File:** background.js
- **Function:** createSessionHooks() (was ~line 246 in v0.9.24)
- **Expected (v0.9.24):** `createSessionHooks()` created a `HookPipeline` with safety breaker hooks, permission hooks, and progress hooks. Called before every `runAgentLoop()` invocation. The hooks provided lifecycle events (beforeIteration, afterIteration, onToolCall, etc.) that enforced safety limits, tracked progress, and emitted events to UI consumers.
- **Actual (current):** Function does not exist. No `HookPipeline` is created. The `ai/hook-pipeline.js` module (still present in the codebase) is never used.
- **Impact:** No lifecycle hook system for automation sessions. Safety breaker hooks, permission pre-checks, and structured progress reporting from hooks are all inactive. The hook-based architecture from v0.9.24/P158 is orphaned.
- **Proposed Fix:** Restore `createSessionHooks()` or integrate the hook pipeline into whichever loop (startAutomationLoop or runAgentLoop) is made the canonical path.

### AL-03: CostTracker not used in active code path

- **File:** background.js (startAutomationLoop at line 7399) vs ai/agent-loop.js line 646
- **Function:** hydrateCostTracker() in agent-loop.js, cost tracking in startAutomationLoop
- **Expected (v0.9.24):** `hydrateCostTracker(session)` instantiated a `CostTracker` per session, which was checked by `checkSafetyBreakers()` each iteration. Cost breaker would stop the session when spending exceeded the $2 limit.
- **Actual (current):** The active `startAutomationLoop` in background.js has no CostTracker instantiation. Session has `totalCost`, `totalInputTokens`, `totalOutputTokens` fields (set at line 4838-4840) but they are never updated by any code in the active execution path. The CostTracker hydration code exists only in the orphaned agent-loop.js.
- **Impact:** No cost-based safety breaker. Sessions can accumulate unlimited API costs without being stopped. The $2 cost limit from engine-config.js is not enforced.
- **Proposed Fix:** Wire CostTracker into the active automation path, or re-enable the agent-loop.js path which already has this.

### AL-04: maxIterations raised to 500 in engine-config.js but legacy loop uses separate cap

- **File:** ai/engine-config.js line 36, background.js line 7433
- **Function:** SESSION_DEFAULTS.maxIterations, startAutomationLoop iteration cap
- **Expected (v0.9.24):** `SESSION_DEFAULTS.maxIterations = 20` applied to all modes. The agent loop used `checkSafetyBreakers()` which read this value.
- **Actual (current):** `SESSION_DEFAULTS.maxIterations` raised to 500 (all modes: autopilot, mcp-agent, dashboard-remote). However, the active `startAutomationLoop` at line 7433 uses `session.maxIterations || 20` as its cap. The user settings read at line 4789 default to 20. So the 500 in engine-config is unreachable from the active path, but the intent to allow 500 iterations exists.
- **Impact:** Dual iteration limits create confusion. agent-loop.js `checkSafetyBreakers` reads from SESSION_DEFAULTS (500), while background.js startAutomationLoop reads from session.maxIterations (defaults to 20 from user settings). If agent-loop.js were re-enabled, sessions could run 500 iterations with the $2 cost breaker as the only safety net.
- **Proposed Fix:** Establish a single authoritative source for maxIterations. The 500 value with the cost breaker is the intended design; ensure both code paths use the same config.

### AL-05: Background.js loop has 5-minute time limit vs agent-loop.js 10-minute limit

- **File:** background.js line 7434, ai/engine-config.js line 34
- **Function:** startAutomationLoop MAX_SESSION_DURATION, SESSION_DEFAULTS.timeLimit
- **Expected (v0.9.24):** Session time limit was 600000ms (10 minutes) from `SESSION_DEFAULTS.timeLimit`, checked by `checkSafetyBreakers()` in agent-loop.js.
- **Actual (current):** The active `startAutomationLoop` hardcodes `MAX_SESSION_DURATION = 5 * 60 * 1000` (5 minutes) at line 7434. The `SESSION_DEFAULTS.timeLimit` is still 600000 (10 minutes) but is unreachable from the active path.
- **Impact:** Sessions time out at 5 minutes instead of 10, halving the available time for complex multi-step tasks. This contradicts the 500-iteration intent.
- **Proposed Fix:** Use the engine-config value (10 minutes) in the active loop, or reconcile both values.

### AL-06: Iteration circuit breaker added to agent-loop.js but unreachable

- **File:** ai/agent-loop.js line 133-145
- **Function:** checkSafetyBreakers() -- iteration limit enforcement
- **Expected (v0.9.24):** checkSafetyBreakers checked cost and time limits only. Iteration limit was enforced in background.js.
- **Actual (current):** A new iteration circuit breaker was added to checkSafetyBreakers in agent-loop.js (reading session.maxIterations, falling back to SESSION_DEFAULTS). This was a post-v0.9.24 improvement. But since agent-loop.js is orphaned, this code is dead.
- **Impact:** The improvement is not active. The intent was to enforce iteration limits inside the agent loop to prevent hallucination loops running 96+ iterations. Only the background.js iteration cap (which defaults to 20) provides protection.
- **Proposed Fix:** Part of the broader agent-loop.js re-enablement (see AL-01).

### AL-07: Enhanced stuck detection (fingerprint-based) in agent-loop.js is dead code

- **File:** ai/agent-loop.js lines 193-290
- **Function:** detectStuck()
- **Expected (v0.9.24):** detectStuck used consecutiveNoChangeCount >= 3 threshold with a simple hint message.
- **Actual (current):** detectStuck was significantly enhanced post-v0.9.24: added action fingerprint tracking, read-only tool filtering, 60% repetition threshold over a sliding window of 10, escalating severity (WARNING/CRITICAL), and shouldForceStop after 5 stuck warnings. Also added force-stop handling at lines 1839-1851 in runAgentIteration. All of this is dead code because the active loop uses its own stuck detection (stuckCounter in background.js lines 7935-7993).
- **Impact:** The active loop has its own stuck detection (DOM hash comparison + typing sequence analysis) but lacks: action fingerprint tracking, read-only tool filtering, escalating warnings, force-stop capability. The background.js stuck detection has no escalation path -- it increments stuckCounter but the recovery is just generating recovery strategies that may not work.
- **Proposed Fix:** Port the fingerprint-based detection and escalation from agent-loop.js into the active path, or re-enable agent-loop.js.

### AL-08: CDP message handlers removed -- cdpMouseClick, cdpMouseDrag, cdpMouseWheel, etc.

- **File:** background.js (message listener around line 3984)
- **Function:** case handlers for cdpMouseClick, cdpMouseClickAndHold, cdpMouseDrag, cdpMouseDragVariableSpeed, cdpMouseWheel
- **Expected (v0.9.24):** Message listener had handlers for all CDP mouse tool messages sent from content/actions.js. These routed to handleCDPMouseClick(), handleCDPMouseDrag(), etc.
- **Actual (current):** All 5 CDP mouse message handlers are removed from the switch statement. The functions handleCDPMouseClick, handleCDPMouseClickAndHold, handleCDPMouseDrag, handleCDPMouseDragVariableSpeed, handleCDPMouseWheel do not exist.
- **Impact:** content/actions.js still sends these messages (lines 164, 1972, 5524, 5567, 5588, 5611, 5635, 5656). When these messages arrive at background.js, they fall through to the `default: sendResponse({ error: 'Unknown action' })` handler. All CDP mouse actions silently fail. This breaks: canvas interactions, drag-and-drop, scroll-at-coordinate, click-and-hold, and variable-speed drag operations. All 7 CDP tools documented in v0.9.8/P97 are non-functional.
- **Proposed Fix:** Restore the CDP message handlers in background.js message listener, pointing to either restored or newly implemented handler functions.

### AL-09: Session hook infrastructure removed -- uiSurface, historySessionId, agentResumeState tracking

- **File:** background.js handleStartAutomation (line 4651)
- **Function:** Session creation and conversation tracking
- **Expected (v0.9.24):** handleStartAutomation extracted `uiSurface`, `requestedHistorySessionId`, `selectedConversationId` from the request. Called `inferUiSurface()`, `resolveRequestedConversationThread()`, set session fields `conversationId`, `uiSurface`, `historySessionId`, `followUpContext`, `agentResumeState`, `resumeSummary`. Called `upsertConversationThread()` for thread persistence. Called `serializeAgentResumeState()` for warm resumption.
- **Actual (current):** Simplified to extract only `task`, `tabId`, `conversationId`. All helper functions removed. Session reactivation injects follow-up via `ai.injectFollowUpContext(task)` using `sessionAIInstances` map (a mechanism not present in v0.9.24). No UI surface tracking, no history session ID, no agent resume state serialization, no conversation thread persistence.
- **Impact:** Multi-surface session tracking lost (popup vs sidepanel vs MCP sessions not distinguished). Warm session resumption after service worker restart may not preserve full context. Follow-up commands use a different injection mechanism than v0.9.24's designed approach.
- **Proposed Fix:** Evaluate which session tracking fields are needed for current functionality. If warm resumption across service worker restarts is required, restore the resume state serialization.

### AL-10: STT (Speech-to-Text) message handlers removed

- **File:** background.js (message listener)
- **Function:** case handlers for 'stt-start', 'stt-stop'
- **Expected (v0.9.24):** Message listener handled STT start/stop, including offscreen document creation for restricted pages and content script injection for regular pages.
- **Actual (current):** Both `stt-start` and `stt-stop` handlers removed. Speech-to-text functionality will fail silently.
- **Impact:** Voice input feature broken if any UI surface tries to use it. Not core to automation pipeline but is a removed capability.
- **Proposed Fix:** Restore STT handlers if voice input is a supported feature, or document as intentionally removed.

### AL-11: DOM stream handlers removed -- domStreamReady, domStreamSnapshot, domStreamMutations, etc.

- **File:** background.js (message listener)
- **Function:** case handlers for domStreamReady, domStreamSnapshot, domStreamMutations, domStreamScroll, domStreamOverlay, domStreamDialog
- **Expected (v0.9.24):** These handlers forwarded DOM state from content script to the dashboard via WebSocket (fsbWebSocket.send). They enabled live page preview on the remote dashboard.
- **Actual (current):** All 6 DOM stream handlers removed. Dashboard live preview is non-functional.
- **Impact:** Remote dashboard cannot receive DOM snapshots, mutations, scroll positions, overlay states, or dialog events. The live preview feature from v0.9.6/v0.9.9.1 is broken.
- **Proposed Fix:** Restore if dashboard streaming is a supported feature, or document as intentionally removed.

### AL-12: System prompt enhancements in agent-loop.js are dead code but contain valuable improvements

- **File:** ai/agent-loop.js lines 501-502
- **Function:** buildSystemPrompt() -- CRITICAL RULES section
- **Expected (v0.9.24):** System prompt had basic critical rules about not stopping after navigation, not ending turns with text, and handling auth walls.
- **Actual (current):** Two important rules were added post-v0.9.24: (1) `report_progress is NARRATION ONLY` rule explicitly telling the model that report_progress does not perform actions and must be paired with real action tools, (2) `execute_js escape hatch` rule for obscured/zero-dimension element failures. Both additions are in agent-loop.js which is orphaned. The active background.js loop uses its own AI prompting which may or may not include equivalent guidance.
- **Impact:** Without the narration-only rule, models may call only report_progress in a turn, believing they have taken action, leading to wasted iterations. Without the execute_js escape hatch, click/type failures on obscured elements have no recovery path guidance.
- **Proposed Fix:** Port these prompt rules to the active AI calling path in background.js, or re-enable agent-loop.js.

### AL-13: callProviderWithTools max_tokens fix is dead code

- **File:** ai/agent-loop.js lines 815-832
- **Function:** callProviderWithTools() -- default provider case
- **Expected (v0.9.24):** The default case (OpenAI/xAI/OpenRouter) sent `{ model, messages, tools, temperature: 0 }` without max_tokens.
- **Actual (current):** Post-v0.9.24 added `max_tokens: 4096` to prevent xAI from defaulting to a tight internal limit (~87 tokens/iter) that caused model truncation after report_progress, never emitting click tools. Also added a note about intentionally omitting tool_choice for xAI compatibility. This fix is in agent-loop.js which is orphaned.
- **Impact:** The active background.js loop's AI calling code may still hit the xAI token truncation issue if it does not set max_tokens. Models may produce incomplete responses where action tools are cut off.
- **Proposed Fix:** Apply the max_tokens fix to the active AI calling path.

## Functions Audited

### agent-loop.js

| Function | Verdict | Notes |
|----------|---------|-------|
| checkSafetyBreakers() | NEW (iteration breaker) + ORPHANED | Good improvement but dead code |
| detectStuck() | CHANGED-OK + ORPHANED | Significantly improved with fingerprints, escalation, force-stop. Dead code. |
| buildSystemPrompt() | CHANGED-OK + ORPHANED | Critical rules added. Dead code. |
| hydrateAgentRunState() | CHANGED-OK + ORPHANED | CostTracker extracted to separate function. Dead code. |
| hydrateCostTracker() | NEW + ORPHANED | Extracted from hydrateAgentRunState. Dead code. |
| convertToGeminiMessages() | OK + ORPHANED | No changes, but dead code. |
| callProviderWithTools() | CHANGED-OK + ORPHANED | max_tokens fix, tool_choice omission. Dead code. |
| runAgentLoop() | CHANGED-OK + ORPHANED | Reordered init (safety config before hydration). Dead code. |
| runAgentIteration() | CHANGED-OK + ORPHANED | Added diagnostic logging, force-stop on stuck. Dead code. |

### background.js (automation-related only)

| Function | Verdict | Notes |
|----------|---------|-------|
| handleStartAutomation() | REGRESSION | Simplified: lost UI surface tracking, hook wiring, resume state. Uses legacy startAutomationLoop instead of runAgentLoop. |
| handleStopAutomation() | OK | Largely unchanged -- cleanup and session persistence logic intact. |
| startAutomationLoop() | ACTIVE BUT LEGACY | Pre-v0.9.24 monolithic loop. Active code path. Lacks cost tracking, hook pipeline, structured safety breakers. |
| createSessionHooks() | DELETED | Hook pipeline factory removed entirely. |
| inferUiSurface() | DELETED | UI surface detection removed. |
| resolveRequestedConversationThread() | DELETED | Thread resolution removed. |
| serializeAgentResumeState() | DELETED | Warm resume state serialization removed. |
| upsertConversationThread() | DELETED | Thread persistence removed. |
| buildSessionsBySurface() | DELETED | Per-surface session indexing removed. |
| cleanupSession() | OK | Minor changes only, core logic intact. |
| reactivateSession() | CHANGED | Simplified: removed uiSurface normalization and some tracking fields. |
| idleSession() | OK | Minor changes only. |
| restoreConversationSessions() | OK | Minor changes only. |
| activeSessions Map | OK | Still in use, no structural changes. |
| sendSessionStatus() | REGRESSION (minor) | sessionsBySurface removed from getStatus response. |
| CDP mouse message handlers (5) | DELETED | cdpMouseClick, cdpMouseClickAndHold, cdpMouseDrag, cdpMouseDragVariableSpeed, cdpMouseWheel all removed. |
| STT message handlers (2) | DELETED | stt-start, stt-stop removed. |
| DOM stream message handlers (6) | DELETED | domStreamReady, domStreamSnapshot, domStreamMutations, domStreamScroll, domStreamOverlay, domStreamDialog removed. |

### ai/engine-config.js

| Function | Verdict | Notes |
|----------|---------|-------|
| SESSION_DEFAULTS | CHANGED | maxIterations 20->500 for all modes. mcp-agent timeLimit 240s->600s. |
| EXECUTION_MODES | CHANGED | All modes maxIterations raised to 500, mcp-agent/dashboard-remote timeLimit raised to 600s. |

### ai/cost-tracker.js

| Function | Verdict | Notes |
|----------|---------|-------|
| estimateCost() | CHANGED-OK | Added optional `provider` param, returns 0 for lmstudio. |
| CostTracker.record() | CHANGED-OK | Passes `provider` through to estimateCost. |

### ai/session-schema.js

| Function | Verdict | Notes |
|----------|---------|-------|
| (all) | OK | No changes since v0.9.24. |

### ai/hook-pipeline.js

| Function | Verdict | Notes |
|----------|---------|-------|
| (all) | OK + ORPHANED | No changes since v0.9.24, but never instantiated. |
