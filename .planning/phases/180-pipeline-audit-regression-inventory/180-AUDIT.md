# Phase 180: Pipeline Audit and Regression Inventory

**Baseline:** v0.9.24 (commit b223f99) -- Claude Code Architecture Adaptation
**Current HEAD:** v0.9.31 (commit aba559f)
**Audit Date:** 2026-04-18
**Method:** Git diff + function-level reading per D-01/D-02

---

## Executive Summary

**Total findings:** 36 (13 Agent Loop + 7 Tool Execution + 11 AI Communication + 5 DOM Analysis)
**Cross-subsystem regressions:** 6 identified (XS-01 through XS-06)
**Severity distribution:**
- Critical: 5 (AL-01, AL-08, AC-01, AC-02, XS-02)
- High: 6 (AL-02, AL-03, AL-05, AL-13, AC-03, TE-01)
- Medium: 10 (AL-04, AL-06, AL-07, AL-09, AL-12, AC-04, AC-06, AC-10, AC-11, TE-02)
- Low: 7 (AL-10, AL-11, AC-05, AC-07, AC-08, TE-07, XS-05)
- Positive (no fix needed): 8 (TE-03, TE-04, TE-05, TE-06, AC-09, DA-01, DA-02, DA-03, DA-04, DA-05)

**Most impacted subsystem:** Agent Loop -- 13 findings including the root-cause regression (AL-01: entire modular architecture orphaned).

**Key patterns observed:**
1. The v0.9.24 modular architecture (agent-loop.js, tool-executor.js, hook-pipeline.js, cost-tracker.js in execution path) is completely orphaned. background.js runs a pre-v0.9.24 monolithic loop.
2. Phase 139.1 cleanup incorrectly deleted the CLI autopilot pipeline as "dead code," causing total autopilot failure. Restored in 23c0ad1 but introduced response-parsing regressions.
3. DOM Analysis is the most stable subsystem -- zero regressions, all changes additive.
4. The codebase has two parallel automation pipelines (legacy CLI-parsed and orphaned tool_use) with different strengths. Reconciliation is the primary repair challenge.

---

## Triage Priority

Ordered by impact on end-to-end automation reliability:

1. **AL-01 / TE-01 / XS-01 (Critical):** Re-enable the modular agent loop or merge its improvements into the active path. This is the root cause of most orphaned-code findings. Every safety breaker, cost tracker, stuck detection improvement, and structured result normalization depends on this.

2. **AL-08 / XS-02 (Critical):** Restore CDP message handlers in background.js. 7 CDP tools (canvas interactions, drag-and-drop, scroll-at-coordinate, click-and-hold, variable-speed drag) silently fail because content/actions.js sends messages that background.js no longer handles.

3. **AC-02 / AC-03 (Critical, already fixed):** UniversalProvider response parsing has been fixed across 3 commits (8a7a8cf, 1ff5b52, 7ba62d9). Verify fixes hold. Delete dead cleanResponse/parseJSONSafely code (AC-11) to prevent re-enablement.

4. **AL-03 / AL-05 (High):** Cost breaker ($2 limit) and time limit (10 min vs 5 min) are not enforced in the active path. Sessions can accumulate unlimited API costs.

5. **AL-13 / XS-06 (High):** max_tokens fix for xAI provider not applied in active path. Models may produce truncated responses where action tools are cut off.

6. **AL-02 (High):** Hook pipeline never instantiated. Safety breaker hooks, permission pre-checks, and structured progress reporting are inactive.

7. **AL-07 / AL-12 (Medium):** Enhanced stuck detection (fingerprints, escalation, force-stop) and system prompt improvements (narration-only rule, execute_js escape hatch) should be ported to the active path.

8. **AC-04 (Medium):** Dual tool documentation (CLI_COMMAND_TABLE vs TOOL_REGISTRY) may diverge. Assess whether CLI path is retained or all automation moves to tool_use.

9. **AL-09 / AL-10 / AL-11 (Low):** Session hook infrastructure, STT handlers, DOM stream handlers removed. Evaluate which are still needed features.

---

## 1. Agent Loop

**Repair Phase:** Phase 181 (Agent Loop Repair)
**Findings:** 13 (AL-01 through AL-13)
**Source:** 180-agent-loop-findings.md

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

---

## 2. Tool Execution

**Repair Phase:** Phase 182 (Tool Execution Repair)
**Findings:** 7 (TE-01 through TE-07)
**Source:** 180-tool-execution-findings.md

### TE-01: tool-executor.js is orphaned -- not imported or called from background.js

- **File:** ai/tool-executor.js (entire module), background.js
- **Function:** executeTool() at tool-executor.js line 387
- **Expected (v0.9.24):** `executeTool(name, params, tabId, options)` was the single dispatch function routing all 42+ tools to content, CDP, or background handlers based on `_route` metadata. Called from `runAgentLoop` -> `runAgentIteration` in the agent loop.
- **Actual (current):** `tool-executor.js` is not imported by background.js (no `importScripts('ai/tool-executor.js')` found). The active `startAutomationLoop` dispatches tools by: (a) checking `handleBackgroundAction()` for background-route tools, (b) sending `{ action: 'executeAction', tool, params }` messages to the content script for content-route tools. This bypasses the unified executor entirely.
- **Impact:** The structured result format (`{ success, hadEffect, error, navigationTriggered, result }`) from tool-executor.js is not applied to the active path's results. The read-only `hadEffect=false` fix (TE-02) exists in tool-executor.js but the active path does not use it (hadEffect semantics come from content/actions.js directly in the active path). CDP tool routing via `options.cdpHandler` is never invoked.
- **Proposed Fix:** Either re-enable tool-executor.js as part of the agent-loop.js re-wiring (AL-01), or merge its read-only hadEffect logic and structured result normalization into the active background.js path.

### TE-02: Read-only hadEffect fix in tool-executor.js is partially unreachable

- **File:** ai/tool-executor.js lines 97-102, 166-167
- **Function:** executeContentTool(), executeCdpTool()
- **Expected (v0.9.24):** All successful content/CDP tools reported `hadEffect: true`.
- **Actual (current):** Post-v0.9.24 fix added `hadEffect = success && tool._readOnly !== true` so read-only tools (read_page, get_text, get_attribute, read_sheet) report `hadEffect: false`, preventing infinite read/narrate loops from resetting stuck detection. This fix is in tool-executor.js which is orphaned. However, the content/actions.js handlers for these tools may or may not set their own hadEffect -- the active path relies on whatever the content script returns.
- **Impact:** The hadEffect semantics are inconsistent between the two paths. The orphaned agent-loop.js detectStuck() checks hadEffect from tool-executor results; the active background.js stuckCounter checks DOM hash changes (a different mechanism). The fix partially works because read-only content tools do not change the DOM, so DOM-hash-based stuck detection still catches the pattern -- but it is an indirect rather than explicit signal.
- **Proposed Fix:** Verify that content script handlers for read-only tools do not return `hadEffect: true`. If they do, the active stuck detection may be undermined.

### TE-03: execute_js tool added post-v0.9.24 -- available in both paths

- **File:** ai/tool-definitions.js lines 808-828, ai/tool-executor.js lines 295-321
- **Function:** execute_js tool definition and background handler
- **Expected (v0.9.24):** This tool did not exist. 48 tools in registry.
- **Actual (current):** `execute_js` added as tool 49 in the registry with `_route: 'background'`. Handler in tool-executor.js runs code via `chrome.scripting.executeScript` in MAIN world. The active background.js path also has `execute_js` handling in its `handleBackgroundAction` function. The tool definition has proper description telling the AI to use it as a last resort when standard tools fail.
- **Impact:** Positive change -- available in both paths. However, `execute_js` with MAIN world eval is a security-sensitive escape hatch. The description correctly marks it as last-resort.
- **Proposed Fix:** No fix needed. Document that this is a new capability with security implications (arbitrary JS execution in page context).

### TE-04: click tool text-based targeting added post-v0.9.24 -- reachable via active path

- **File:** content/actions.js lines 1580-1680, ai/tool-definitions.js lines 117-132
- **Function:** tools.click() text-based element finding
- **Expected (v0.9.24):** Click tool required a CSS selector. `selector` parameter was required.
- **Actual (current):** Click tool now accepts optional `text` parameter for text-based element finding using TreeWalker traversal. `selector` is no longer required (required array is empty). The text search uses case-insensitive substring matching, prefers deepest visible match, and falls back to first visible match. The tool definition description documents the feature.
- **Impact:** Positive change -- fully reachable because the content script handles it directly. Enables clicking elements on dynamic apps (LinkedIn/Ember, Facebook/React) where CSS selectors are unstable. The empty `required` array means the AI can call click with only `text` or only `selector`.
- **Proposed Fix:** No fix needed. Verify that calling click with neither `text` nor `selector` produces a clear error (not a silent no-op).

### TE-05: Angular Material combobox hadEffect detection added -- reachable via active path

- **File:** content/actions.js lines 1878-1902
- **Function:** tools.click() verification logic
- **Expected (v0.9.24):** Click verification checked `verification.verified` or loading detection for standard elements, with special cases for canvas and checkable/anchor elements.
- **Actual (current):** Added Angular Material combobox detection (`mat-select`, `mat-mdc-select`, `mat-mdc-autocomplete-trigger`, `role=combobox` with MAT- prefix). These elements report hadEffect via aria-expanded change, class change, or overlay element count change rather than standard verification.
- **Impact:** Positive change -- directly reachable. Prevents false negatives on Angular Material sites where clicks open CDK overlays.
- **Proposed Fix:** No fix needed.

### TE-06: data-fsb-id selector fallback added to selectors.js -- reachable via active path

- **File:** content/selectors.js lines 573-586
- **Function:** Selector resolution fallback chain
- **Expected (v0.9.24):** Selector resolution tried: element cache, exact CSS, ID, data attributes, querySelector. No data-fsb-id fallback.
- **Actual (current):** Added fallback that checks `[data-fsb-id="sanitized"]` when the selector looks like an FSB semantic elementId (lowercase alphanumeric with underscores/hyphens). This stamps elements during get_dom_snapshot and allows subsequent tool calls to reference them by FSB ID.
- **Impact:** Positive change -- directly reachable. Improves selector resilience for dynamic apps where DOM IDs change but FSB-stamped IDs persist within a session.
- **Proposed Fix:** No fix needed.

### TE-07: report_progress description updated to explicitly mark as narration-only

- **File:** ai/tool-definitions.js lines 832-833
- **Function:** report_progress tool definition
- **Expected (v0.9.24):** Description: "Update the progress overlay with a status message visible to the user."
- **Actual (current):** Description updated to: "Display a status message in the overlay. THIS TOOL DOES NOT PERFORM ANY ACTION -- it is narration only and never clicks, types, navigates, submits, or changes the page. Do NOT describe clicks, typing, or submissions in the message unless you have already called the corresponding action tool..." This matches the system prompt rule in agent-loop.js (AL-12).
- **Impact:** Positive change. The tool definition itself now carries the narration-only warning, which is visible to the AI regardless of which loop path is active (both paths present the tool registry to the AI). This partially compensates for the orphaned system prompt rule in agent-loop.js.
- **Proposed Fix:** No fix needed for the tool definition. The system prompt rule should still be ported to the active AI calling path for reinforcement.

---

## 3. AI Communication

**Repair Phase:** Phase 183 (AI Communication Repair)
**Findings:** 11 (AC-01 through AC-11)
**Source:** 180-ai-communication-findings.md

### AC-01: Phase 139.1 deleted entire CLI autopilot pipeline as "dead code"

- **File:** ai/ai-integration.js (throughout)
- **Function:** getAutomationActions, processQueue, buildPrompt, decomposeTask, buildMinimalUpdate, _buildTaskGuidance, getToolsDocumentation, TASK_PROMPTS, CLI_COMMAND_TABLE, HYBRID_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS, buildSheetsFormattingDirective, PROMPT_CHAR_LIMIT
- **Expected (v0.9.24):** These functions would be present and callable by background.js. They constituted the entire prompt construction, task processing, and response parsing pipeline for the CLI-format autopilot.
- **Actual (current):** v0.9.24 shipped with ALL of them replaced by "Dead code removed: ..." comments (7 separate deletion blocks). Commit 23c0ad1 restored them. The current code has the full pipeline back.
- **Impact:** Total autopilot failure at v0.9.24. background.js called getAutomationActions which no longer existed, causing TypeError and "AI service error" for all providers. The agent loop was completely non-functional.
- **Proposed Fix:** Already fixed by commit 23c0ad1. No further action needed on the deletion itself. However, the restoration was a bulk paste from a pre-v0.9.24 state, which means the restored code may contain stale references or miss v0.9.24-era improvements that were made to callers but not to the deleted code. Verify that all restored functions align with current caller expectations.

### AC-02: UniversalProvider.parseJSONSafely destroyed CLI-format responses

- **File:** ai/universal-provider.js:627-688
- **Function:** parseJSONSafely (called by cleanResponse)
- **Expected (v0.9.24):** Raw AI response text (CLI format: `# reasoning\nclick e5\ntype e12 "hello"`) would pass through to parseCliResponse for correct interpretation.
- **Actual (current):** parseJSONSafely was stripping everything before the first `{` (line 653), then running fixTruncatedJSON, fixCommonMalformations, fixJSONStructure on the CLI text, mangling it beyond recognition. When JSON.parse failed on the mangled CLI text, it returned `'{"success":false,"error":"JSON parsing failed"}'` -- a fake JSON error object that parseCliResponse could not interpret.
- **Impact:** All AI responses destroyed before reaching the CLI parser. The agent produced no actions and reported "AI service error" to the user. Affected all providers.
- **Proposed Fix:** Fixed across 3 commits (8a7a8cf, 1ff5b52, 7ba62d9). parseResponse now returns raw text directly (line 604-613) with a comment: "Do NOT call cleanResponse/parseJSONSafely." The dead cleanResponse/parseJSONSafely methods remain in the file as unreachable code. Consider deleting them to prevent future accidental re-enablement.

### AC-03: UniversalProvider.parseResponse returned objects instead of strings

- **File:** ai/universal-provider.js (parseResponse method)
- **Function:** parseResponse
- **Expected (v0.9.24):** parseResponse returns raw text string that callAPI (ai-integration.js:4324) passes to parseCliResponse.
- **Actual (current):** Before fix 1ff5b52, parseResponse returned parsed objects. callAPI at ai-integration.js:4324 expected strings -- `String(obj)` produced `"[object Object]"` which killed all action parsing.
- **Impact:** Complete action parsing failure. The agent could not execute any actions.
- **Proposed Fix:** Fixed in commit 1ff5b52. parseResponse now returns `{ content: rawTextString, usage, model }`. callAPI extracts `parsed.content` as a string. No further action needed.

### AC-04: Duplicate CLI_COMMAND_TABLE between ai-integration.js and agent-loop.js prompt construction

- **File:** ai/ai-integration.js:15-151
- **Function:** CLI_COMMAND_TABLE constant
- **Expected (v0.9.24):** This was deleted as dead code. The agent-loop.js tool_use pipeline did not need CLI command tables.
- **Actual (current):** Restored as part of 23c0ad1. The CLI_COMMAND_TABLE is a 134-line constant injected into the system prompt via getToolsDocumentation(). It documents every CLI command with examples. This is the CLI autopilot's tool documentation -- essential for the AI to produce valid commands.
- **Impact:** No regression in current state (functional). However, this represents a dual pipeline: agent-loop.js uses native tool_use JSON format with TOOL_REGISTRY from tool-definitions.js, while the CLI autopilot pipeline uses CLI_COMMAND_TABLE text format. The two tool documentation sources may diverge over time.
- **Proposed Fix:** Assess whether the CLI autopilot path is still needed or if all automation should use the native tool_use pipeline through agent-loop.js. If CLI path is retained, ensure CLI_COMMAND_TABLE stays in sync with tool-definitions.js TOOL_REGISTRY.

### AC-05: TASK_PROMPTS restoration contains navigator.userAgent references that fail in service worker

- **File:** ai/ai-integration.js:259-266 (email task prompt)
- **Function:** TASK_PROMPTS.email
- **Expected (v0.9.24):** This constant was deleted. When active, it contained `navigator.userAgent?.includes('Macintosh')` for platform-specific keyboard shortcut detection.
- **Actual (current):** Restored. The template literal evaluates `navigator.userAgent?.includes('Macintosh')` at module load time. In a Chrome Extension Manifest V3 service worker, `navigator` is available but `navigator.userAgent` may not reflect the active tab's platform if the extension is used across devices.
- **Impact:** Low severity. The email task prompt injects the correct Cmd vs Ctrl modifier for Gmail Send shortcut. In practice this works because the extension runs on the user's own machine, so the service worker's navigator.userAgent matches. The concern is architectural -- runtime platform detection at module load time.
- **Proposed Fix:** Replace with a static check or pass platform info from the context object instead of evaluating at module load time.

### AC-06: processQueue CLI parse recovery chain relies on callAPI which may mask errors

- **File:** ai/ai-integration.js:2250-2449 (processQueue method)
- **Function:** processQueue
- **Expected (v0.9.24):** This method was deleted. The agent-loop.js pipeline handled its own response parsing.
- **Actual (current):** Restored processQueue contains a two-stage CLI parse failure recovery (ROBUST-04). Stage 1 sends a "simplified hint" retry. Stage 2 sends a "full reformat" retry. Both call callAPI again. The recovery chain can consume up to 3 additional API calls per failed parse.
- **Impact:** No regression -- this is the intended behavior for CLI parse robustness. However, the recovery stages use `request.prompt.messages` which may be undefined when the prompt uses `systemPrompt`/`userPrompt` format instead of `messages` format. The fallback (lines 2299-2302) constructs a messages array from systemPrompt/userPrompt but loses conversation history context.
- **Proposed Fix:** Ensure the recovery prompt always has full conversation context. Test that Stage 1 and Stage 2 retries work with both prompt formats (messages array vs systemPrompt/userPrompt object).

### AC-07: Conversation history stores _rawCliText which may grow unbounded

- **File:** ai/ai-integration.js:1137-1205 (updateConversationHistory)
- **Function:** updateConversationHistory
- **Expected (v0.9.24):** This method was deleted. The agent-loop.js pipeline managed its own history.
- **Actual (current):** Restored. Stores `response._rawCliText` as the assistant's content in conversation history. The trimConversationHistory method (line 1088) uses compaction and sliding window to manage growth. However, `_rawCliText` can be large (AI responses with extensive reasoning), and the rawTurnsToKeep=3 setting means 6 large messages are always preserved.
- **Impact:** Low severity. The trimming mechanism works. However, combined with the 200K PROMPT_CHAR_LIMIT and the system prompt size (~5-10K), the effective context budget for conversation history is healthy. No regression.
- **Proposed Fix:** No immediate fix needed. Monitor for token budget overruns on complex multi-site tasks where AI responses are verbose.

### AC-08: buildPrompt progressive prompt trimming restored with PROMPT_CHAR_LIMIT=200000

- **File:** ai/ai-integration.js:3471-3543 (progressive trim logic)
- **Function:** buildPrompt (prompt trimming section)
- **Expected (v0.9.24):** PROMPT_CHAR_LIMIT was deleted. No progressive trimming existed.
- **Actual (current):** Restored with PROMPT_CHAR_LIMIT=200000 chars. Three-stage progressive trimming: (1) strip example blocks, (2) reduce element count, (3) strip memory blocks. This is a correctness improvement -- prevents prompt truncation by the API.
- **Impact:** Positive change. No regression -- this is new functionality that prevents API errors from oversized prompts.
- **Proposed Fix:** None needed. This is correctly implemented.

### AC-09: isToolCallResponse fallback for mixed text+tools responses

- **File:** ai/tool-use-adapter.js:226-237
- **Function:** isToolCallResponse (default case for OpenAI/xAI/OpenRouter)
- **Expected (v0.9.24):** Only checked `finish_reason === 'tool_calls'`. If the provider returned `finish_reason: "stop"` with tool_calls in the message body, tool calls were silently dropped.
- **Actual (current):** Added fallback: also checks `response.choices[0].message.tool_calls` array existence when finish_reason is not 'tool_calls'. This catches mixed text+tools responses and truncated responses.
- **Impact:** Positive bugfix. Without this fallback, the agent loop exited at the isToolCallResponse gate (agent-loop.js:1250) whenever a provider returned tool calls with a non-standard finish_reason.
- **Proposed Fix:** None needed. This is a correct improvement. The change is backwards-compatible.

### AC-10: callAPI passes attempt count for progressive timeout but processQueue does not coordinate

- **File:** ai/ai-integration.js:4288-4334 (callAPI), 2250-2449 (processQueue)
- **Function:** callAPI, processQueue
- **Expected (v0.9.24):** callAPI was the direct API call path. processQueue was deleted.
- **Actual (current):** Two paths exist. callAPI is called directly by processQueue with `{ attempt: request.attempt || 0 }`. The `attempt` field is used by UniversalProvider.sendRequest for progressive timeout increase. However, processQueue's own recovery retries (Stage 1, Stage 2) increment attempt by 1 each time, independent of getAutomationActions' retry loop (which has its own attempt counter 0-2).
- **Impact:** Low severity. The attempt counters are independent but serve the same purpose (progressive timeout). In the worst case, a single failed response could trigger: getAutomationActions retry loop (3 attempts) * processQueue recovery (2 stages) = 6 API calls, each with incrementing attempt/timeout. This is acceptable but worth documenting.
- **Proposed Fix:** Document the retry budget clearly. Consider passing a shared attempt counter from getAutomationActions through to processQueue recovery stages to avoid double-counting.

### AC-11: Dead cleanResponse/parseJSONSafely code remains in universal-provider.js

- **File:** ai/universal-provider.js:619-688
- **Function:** cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure, extractJSONFallback
- **Expected (v0.9.24):** These methods were part of the response parsing pipeline. cleanResponse was called by parseResponse.
- **Actual (current):** parseResponse bypasses cleanResponse entirely (line 604-608 comment). The methods remain in the file as unreachable dead code (~70 lines).
- **Impact:** No runtime impact -- the code is never called. However, it is a maintenance hazard. A future developer might re-enable cleanResponse thinking it is needed, which would reintroduce the CLI-mangling regression.
- **Proposed Fix:** Delete cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure, and extractJSONFallback from universal-provider.js. Add a comment at the deletion site explaining why they were removed (CLI format incompatibility).

---

## 4. DOM Analysis

**Repair Phase:** Phase 184 (DOM Analysis Repair)
**Findings:** 5 (DA-01 through DA-05)
**Source:** 180-dom-analysis-findings.md

### DA-01: Payment field detection expanded with autocomplete attribute awareness

- **File:** content/dom-analysis.js:271,275 (inferElementPurpose function)
- **Function:** inferElementPurpose()
- **Expected (v0.9.24):** Single broad regex `/card|credit|debit|payment|cvv|cvc|ccv|expir|billing/` matched all payment-related fields and returned `{ role: 'payment-input', intent: 'payment', sensitive: true }`.
- **Actual (current):** Expanded to 14 specific payment intent matchers using HTML5 `autocomplete` attribute values (cc-number, cc-csc, cc-exp-month, cc-exp-year, cc-exp, cc-name) plus refined regex patterns for billing address sub-fields (address-line1/2, city, region, country, postal-code). Falls back to the original broad regex for unrecognized payment fields.
- **Impact:** No regression. This is a correctness improvement. The AI now receives granular `intent` values (e.g., 'cc-number', 'cc-csc', 'billing-address-line1') instead of a generic 'payment' intent, enabling more precise form-filling. The `sensitive` flag is correctly set to `true` only for cc-number and cc-csc fields.
- **Proposed Fix:** None needed. The change is backwards-compatible -- callers that only check `role: 'payment-input'` still work. Callers that read `intent` get richer information.

### DA-02: data-fsb-id attribute stamped on DOM elements during snapshot

- **File:** content/dom-analysis.js:3065-3066 (getStructuredDOM, main element loop)
- **Function:** getStructuredDOM()
- **Expected (v0.9.24):** Elements were assigned semantic IDs (via generateSemanticElementId) but the ID was only stored in the snapshot data structure, not on the DOM element itself.
- **Actual (current):** Each processed element gets `node.setAttribute('data-fsb-id', semanticId)` stamped directly onto the DOM node. This creates a bridge between the snapshot's `elementId` and the live DOM.
- **Impact:** No regression. This is a new capability that enables the data-fsb-id selector fallback in selectors.js (DA-03). However, it modifies the page DOM, which could theoretically conflict with page scripts that react to attribute changes (MutationObserver watchers). The `try/catch` wrapper prevents errors from propagating.
- **Proposed Fix:** Monitor for sites where attribute stamping causes issues. Consider using a less common attribute name (e.g., `data-__fsb-id`) to reduce collision risk. The current implementation is acceptable.

### DA-03: data-fsb-id selector fallback added to selector resolution chain

- **File:** content/selectors.js:576-588 (querySelectorWithShadow function)
- **Function:** querySelectorWithShadow()
- **Expected (v0.9.24):** Selector resolution fallback chain: sanitize -> cache check -> XPath check -> shadow DOM pierce -> regular querySelector -> unicode-normalized aria-label fallback -> cache + return.
- **Actual (current):** New fallback added after aria-label: if the selector looks like an FSB semantic elementId (`/^[a-z][a-z0-9_-]+$/`), try `document.querySelector('[data-fsb-id="' + sanitized + '"]')`. This allows tools to resolve elements by their snapshot ID even if the original CSS selector has gone stale.
- **Impact:** No regression. This adds a new fallback tier to the selector chain. The regex guard ensures only FSB-style IDs trigger this path (no false positives on CSS selectors containing `#`, `.`, `[`, or `:` characters). The fallback is positioned after all standard selectors, so it never interferes with normal resolution.
- **Proposed Fix:** None needed. This is a well-guarded improvement that addresses a real problem: when DOM mutations cause CSS selectors to go stale, the data-fsb-id attribute provides a stable alternate lookup path.

### DA-04: CDK overlay container scanning for Angular Material components

- **File:** content/dom-analysis.js:3224-3264 (getStructuredDOM, after main element loop)
- **Function:** getStructuredDOM() (CDK overlay scan block)
- **Expected (v0.9.24):** Only elements in the main DOM tree were captured. Angular Material `mat-option` elements rendered in the `cdk-overlay-container` (appended to `<body>`, outside the component tree) were invisible to the snapshot.
- **Actual (current):** After the main element traversal, a new block scans `.cdk-overlay-container` for `mat-option`, `[role="option"]`, `[role="listbox"]`, `.mat-select-panel *`, and `.mat-autocomplete-panel *` elements. Found elements are added to `viewportElements` with `_fromOverlay: true` flag, and get the same `data-fsb-id` stamping and selector generation as regular elements.
- **Impact:** No regression. This is a targeted fix for Angular Material apps. Without it, `get_dom_snapshot` returned no options after a `mat-select` opened, making dropdown selection impossible via automation. The `_fromOverlay` flag allows callers to distinguish overlay elements if needed.
- **Proposed Fix:** None needed. The implementation is defensive (try/catch wrapped, skips zero-size elements). Consider extending the pattern for other framework overlay containers (e.g., React portals, Vue teleport) if similar issues arise.

### DA-05: autocomplete attribute added to captured attribute list

- **File:** content/dom-analysis.js:3174 (getStructuredDOM, attribute capture)
- **Function:** getStructuredDOM() (attribute capture block)
- **Expected (v0.9.24):** Default attribute capture list: `['data-testid', 'aria-label', 'name', 'role', 'type', 'value', 'placeholder', 'title', 'alt']` (9 attributes).
- **Actual (current):** `'autocomplete'` added as 10th captured attribute. This feeds the granular payment field detection in inferElementPurpose (DA-01).
- **Impact:** No regression. The snapshot now includes the `autocomplete` attribute for each element when present. This is a small increase in snapshot payload size (one additional key-value pair per element with an autocomplete attribute). The AI benefits from seeing autocomplete hints directly in the element data.
- **Proposed Fix:** None needed. Standard HTML5 attribute, commonly present on form fields.

---

## 5. Cross-Subsystem Regressions

Findings that span two or more subsystems. Each regression indicates a contract break between modules that requires coordinated repair.

### XS-01: Agent loop orphaning severs the agent-loop.js <-> tool-executor.js contract

- **Subsystems:** Agent Loop (AL-01) + Tool Execution (TE-01)
- **Contract (v0.9.24):** `runAgentLoop()` called `executeTool()` from tool-executor.js, which routed tools to content, CDP, or background handlers via `_route` metadata. Tool results were normalized to `{ success, hadEffect, error, navigationTriggered, result }` format.
- **Break (current):** background.js does not import agent-loop.js or tool-executor.js. The active `startAutomationLoop` dispatches tools directly to the content script, bypassing the unified executor. The structured result normalization and read-only hadEffect semantics from tool-executor.js are not applied.
- **Fix Ownership:** Phase 181 (Agent Loop Repair) -- primary. Phase 182 (Tool Execution Repair) -- secondary. The decision of which loop to make canonical drives how tool-executor.js is reconnected.

### XS-02: CDP message handler removal severs background.js <-> content/actions.js contract

- **Subsystems:** Agent Loop (AL-08) + Tool Execution (TE-01 cross-ref)
- **Contract (v0.9.24):** content/actions.js sent `chrome.runtime.sendMessage({ action: 'cdpMouseClick', ... })` to background.js, which handled it via dedicated case handlers and routed to CDP protocol via `chrome.debugger.sendCommand`.
- **Break (current):** All 5 CDP mouse message handlers removed from background.js switch statement. content/actions.js still sends these messages (7 call sites). Messages fall through to default handler returning `{ error: 'Unknown action' }`. All CDP mouse tools silently fail.
- **Fix Ownership:** Phase 181 (Agent Loop Repair) -- primary. The handlers were in background.js message listener, which is agent loop infrastructure.

### XS-03: Phase 139.1 pipeline deletion severed ai-integration.js <-> background.js contract

- **Subsystems:** AI Communication (AC-01) + Agent Loop (active background.js loop)
- **Contract (v0.9.24):** background.js `startAutomationLoop` called `ai.getAutomationActions(prompt)` which internally called processQueue -> buildPrompt -> callAPI -> parseCliResponse. The entire prompt construction and response parsing pipeline resided in ai-integration.js.
- **Break (current):** Phase 139.1 deleted the entire pipeline as "dead code," causing TypeError on every automation call. Restored in commit 23c0ad1 but the restoration introduced the response-parsing regressions (AC-02, AC-03) that were subsequently fixed across 3 commits.
- **Fix Ownership:** Phase 183 (AI Communication Repair) -- primary (pipeline code lives in ai-integration.js). Phase 181 (Agent Loop Repair) -- secondary (caller expectations in background.js).

### XS-04: UniversalProvider response format change broke ai-integration.js CLI parsing contract

- **Subsystems:** AI Communication (AC-02, AC-03) -- between universal-provider.js and ai-integration.js
- **Contract (v0.9.24):** `UniversalProvider.sendRequest()` returned a response that `parseResponse()` converted to a raw text string. `callAPI()` in ai-integration.js passed this string to `parseCliResponse()`.
- **Break (current):** parseJSONSafely (called by cleanResponse, called by parseResponse) mangled CLI-format text into fake JSON errors. Additionally, parseResponse returned objects instead of strings, causing `"[object Object]"` when stringified. Both layers broke the string contract that callAPI expected.
- **Fix Ownership:** Phase 183 (AI Communication Repair). Both files are in the AI Communication subsystem. Fixed in commits 8a7a8cf, 1ff5b52, 7ba62d9.

### XS-05: Dual tool documentation sources may diverge

- **Subsystems:** AI Communication (AC-04) + Tool Execution (tool-definitions.js)
- **Contract (v0.9.24):** agent-loop.js presented TOOL_REGISTRY (from tool-definitions.js) in native tool_use format. There was no CLI_COMMAND_TABLE since the CLI pipeline was deleted.
- **Break (current):** Both exist: CLI_COMMAND_TABLE in ai-integration.js (134 lines, text format with examples) and TOOL_REGISTRY in tool-definitions.js (49 tools, structured JSON format). The CLI_COMMAND_TABLE was restored from pre-v0.9.24 code and may not include the execute_js tool (tool 49, added post-v0.9.24) or the click text parameter update. Divergence between the two documentation sources means the AI receives different tool capabilities depending on which pipeline is active.
- **Fix Ownership:** Phase 183 (AI Communication Repair) -- primary. Requires deciding whether CLI pipeline is retained or deprecated.

### XS-06: max_tokens fix in agent-loop.js needed by active AI calling path

- **Subsystems:** Agent Loop (AL-13) + AI Communication (callAPI in ai-integration.js)
- **Contract (v0.9.24):** Provider API calls were made without max_tokens. xAI's internal default was sufficient at the time.
- **Break (current):** xAI changed their default max_tokens to a tight internal limit (~87 tokens/iter). The fix (max_tokens: 4096) was applied in agent-loop.js callProviderWithTools but agent-loop.js is orphaned. The active path calls providers through ai-integration.js callAPI -> UniversalProvider.sendRequest which may or may not set max_tokens.
- **Fix Ownership:** Phase 183 (AI Communication Repair) -- primary (the fix needs to be in the provider calling code). Phase 181 (Agent Loop Repair) -- secondary (re-enabling agent-loop.js would also solve this).

---

## 6. Repair Phase Mapping

| Finding | Severity | Repair Phase | Requirement IDs |
|---------|----------|-------------|-----------------|
| AL-01 | Critical | Phase 181 | LOOP-01, LOOP-02 |
| AL-02 | High | Phase 181 | LOOP-02 |
| AL-03 | High | Phase 181 | LOOP-05 |
| AL-04 | Medium | Phase 181 | LOOP-05 |
| AL-05 | High | Phase 181 | LOOP-05 |
| AL-06 | Medium | Phase 181 | LOOP-05 |
| AL-07 | Medium | Phase 181 | LOOP-04 |
| AL-08 | Critical | Phase 181 | TOOL-01 |
| AL-09 | Medium | Phase 181 | LOOP-03 |
| AL-10 | Low | Phase 181 | -- (non-core) |
| AL-11 | Low | Phase 181 | -- (non-core) |
| AL-12 | Medium | Phase 181 | AICOM-01 |
| AL-13 | High | Phase 181 + 183 | AICOM-02, AICOM-03 |
| TE-01 | High | Phase 182 | TOOL-01, TOOL-03 |
| TE-02 | Medium | Phase 182 | TOOL-03, LOOP-04 |
| TE-03 | Positive | -- | -- (no fix needed) |
| TE-04 | Positive | -- | -- (no fix needed) |
| TE-05 | Positive | -- | -- (no fix needed) |
| TE-06 | Positive | -- | -- (no fix needed) |
| TE-07 | Positive | -- | -- (no fix needed) |
| AC-01 | Critical (fixed) | Phase 183 | AICOM-01, AICOM-05 |
| AC-02 | Critical (fixed) | Phase 183 | AICOM-03 |
| AC-03 | Critical (fixed) | Phase 183 | AICOM-03 |
| AC-04 | Medium | Phase 183 | AICOM-01 |
| AC-05 | Low | Phase 183 | AICOM-01 |
| AC-06 | Medium | Phase 183 | AICOM-03 |
| AC-07 | Low | Phase 183 | AICOM-04 |
| AC-08 | Low (positive) | Phase 183 | AICOM-04 |
| AC-09 | Positive | -- | -- (no fix needed) |
| AC-10 | Medium | Phase 183 | AICOM-03 |
| AC-11 | Medium | Phase 183 | AICOM-03 |
| DA-01 | Positive | -- | -- (no fix needed) |
| DA-02 | Positive | -- | -- (no fix needed) |
| DA-03 | Positive | -- | -- (no fix needed) |
| DA-04 | Positive | -- | -- (no fix needed) |
| DA-05 | Positive | -- | -- (no fix needed) |
| XS-01 | Critical | Phase 181 + 182 | LOOP-02, TOOL-01, TOOL-03 |
| XS-02 | Critical | Phase 181 | TOOL-01 |
| XS-03 | Critical (fixed) | Phase 183 + 181 | AICOM-01, LOOP-02 |
| XS-04 | Critical (fixed) | Phase 183 | AICOM-03 |
| XS-05 | Low | Phase 183 | AICOM-01 |
| XS-06 | High | Phase 183 + 181 | AICOM-02, AICOM-03 |

### Findings Per Repair Phase

| Repair Phase | Total | Critical | High | Medium | Low | Positive |
|-------------|-------|----------|------|--------|-----|----------|
| Phase 181 (Agent Loop) | 19 | 4 (AL-01, AL-08, XS-01, XS-02) | 5 (AL-02, AL-03, AL-05, AL-13, XS-06) | 6 (AL-04, AL-06, AL-07, AL-09, AL-12, XS-03) | 2 (AL-10, AL-11) | 0 |
| Phase 182 (Tool Execution) | 3 | 1 (XS-01) | 1 (TE-01) | 1 (TE-02) | 0 | 0 |
| Phase 183 (AI Communication) | 14 | 3 (AC-01, AC-02, XS-04) | 2 (AC-03, XS-06) | 5 (AC-04, AC-06, AC-10, AC-11, XS-05) | 3 (AC-05, AC-07, XS-03) | 1 (AC-08) |
| Phase 184 (DOM Analysis) | 0 | 0 | 0 | 0 | 0 | 0 |
| No fix needed | 10 | 0 | 0 | 0 | 0 | 10 |

**Note:** Phase 184 (DOM Analysis) has zero regression findings. All 5 DOM Analysis findings (DA-01 through DA-05) are positive changes requiring no repair. Phase 184 may focus on validation/verification rather than repair.

---

## 7. Functions Audited (Complete List)

### ai/agent-loop.js

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

### ai/tool-executor.js

| Function | Verdict | Notes |
|----------|---------|-------|
| makeResult() | OK + ORPHANED | Structured result factory, no changes. Dead code in active path. |
| executeContentTool() | CHANGED-OK + ORPHANED | hadEffect read-only fix added. Dead code. |
| executeCdpTool() | CHANGED-OK + ORPHANED | hadEffect read-only fix mirrored. Dead code. |
| executeBackgroundTool() | CHANGED-OK + ORPHANED | execute_js case added. Dead code. |
| executeTool() | OK + ORPHANED | Dispatch function unchanged. Dead code. |
| isReadOnly() | OK + ORPHANED | Utility function unchanged. Dead code. |

### ai/tool-definitions.js

| Function | Verdict | Notes |
|----------|---------|-------|
| TOOL_REGISTRY | CHANGED-OK | +1 tool (execute_js), click text param, report_progress description. All reachable. |
| getToolByName() | OK | No changes. |

### ai/tool-use-adapter.js

| Function | Verdict | Notes |
|----------|---------|-------|
| formatToolsForProvider() | OK | No changes since v0.9.24. All 3 adapter paths (Anthropic, Gemini, default) intact. |
| parseToolCalls() | OK | No changes since v0.9.24. JSON.parse pitfall handling intact. |
| formatToolResult() | OK | No changes since v0.9.24. Role mapping (user vs tool) intact. |
| isToolCallResponse() | CHANGED-OK | Added fallback for mixed text+tools (AC-09). Improvement, not regression. |
| formatAssistantMessage() | OK | No changes since v0.9.24. |
| extractUsage() | OK | No changes since v0.9.24. |

### ai/ai-integration.js

| Function | Verdict | Notes |
|----------|---------|-------|
| PROMPT_CHAR_LIMIT | RESTORED | Was deleted in v0.9.24, restored in 23c0ad1. Functional. |
| CLI_COMMAND_TABLE | RESTORED | Was deleted in v0.9.24, restored in 23c0ad1. Functional but dual-pipeline concern (AC-04). |
| formatSiteKnowledge() | OK | Unchanged since v0.9.24. |
| sanitizeActions() | OK | Unchanged since v0.9.24. Security filter still blocks dangerous navigate/type actions. |
| TASK_PROMPTS | RESTORED | Was deleted, restored. Contains navigator.userAgent concern (AC-05). |
| HYBRID_CONTINUATION_PROMPT | RESTORED | Was deleted, restored. Functional. |
| BATCH_ACTION_INSTRUCTIONS | RESTORED | Was deleted, restored. Functional. |
| buildSheetsFormattingDirective() | RESTORED | Was deleted, restored. Functional. |
| AIIntegration constructor | OK | Unchanged architecture. Provider creation, queue init, cache init all intact. |
| migrateSettings() | CHANGED-OK | Updated legacy model list to include grok-4-fast. Correct migration. |
| createProvider() | OK | Unchanged since v0.9.24. |
| clearConversationHistory() | OK | Unchanged since v0.9.24. |
| injectFollowUpContext() | OK | Unchanged since v0.9.24. |
| formatChangeInfo() | OK | Unchanged since v0.9.24. |
| buildMinimalUpdate() | RESTORED | Was deleted, restored. Large method (~180 lines). Handles DOM snapshot formatting. Functional. |
| trimConversationHistory() | OK | Compaction logic unchanged. |
| updateConversationHistory() | OK | Stores _rawCliText, manages multi-turn state. Functional. |
| updateSessionMemory() | OK | Structured fact extraction from turns. Unchanged. |
| describeAction() | OK | Action description helper. Unchanged. |
| triggerCompaction() | OK | AI-powered conversation compression. Unchanged. |
| buildMemoryContext() | OK | Memory injection for prompt. Unchanged. |
| _fetchLongTermMemories() | OK | Async memory fetch. Unchanged. |
| _fetchSiteMap() | OK | Async site map fetch. Unchanged. |
| getAutomationActions() | RESTORED | Was deleted, restored. Main entry point. Functional with retry loop. |
| processQueue() | RESTORED | Was deleted, restored. CLI parse recovery chain functional (AC-06). |
| decomposeTask() | RESTORED | Was deleted, restored. Task decomposition. Functional. |
| buildPrompt() | RESTORED | Was deleted, restored. Large method (~500 lines). Functional. |
| callAPI() | OK | Provider delegation unchanged. Timing tracking added. |
| legacyCallAPI() | OK | Legacy xAI fallback unchanged. |
| extractContent() | OK | Legacy response extraction unchanged. |
| isValidTool() | OK | Tool validation list. Unchanged architecture. |
| _buildTaskGuidance() | RESTORED | Was deleted, restored. Career/site guide guidance. Functional. |
| detectTaskType() | OK | Task type classifier. Unchanged architecture. |
| getToolsDocumentation() | RESTORED | Was deleted, restored. CLI command table injection. Functional. |
| getContentMode() | OK | Content mode selector. Unchanged. |
| formatSemanticContext() | OK | Semantic page context. Unchanged. |
| formatPageContent() | OK | Page content formatter. Unchanged. |
| formatActionHistory() | OK | Action history formatter. Unchanged. |

### ai/universal-provider.js (response path only)

| Function | Verdict | Notes |
|----------|---------|-------|
| parseResponse() | CHANGED-OK | Now returns raw text (fixed in 1ff5b52, 7ba62d9). Critical fix. |
| cleanResponse() | DEAD CODE | Bypassed. Should be deleted (AC-11). |
| parseJSONSafely() | DEAD CODE | Bypassed. Should be deleted (AC-11). |
| fixTruncatedJSON() | DEAD CODE | Bypassed. Should be deleted. |
| fixCommonMalformations() | DEAD CODE | Bypassed. Should be deleted. |
| fixJSONStructure() | DEAD CODE | Bypassed. Should be deleted. |
| extractJSONFallback() | DEAD CODE | Bypassed. Should be deleted. |

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
| handleBackgroundAction() | OK | Handles background-route tools including execute_js. Active path. |
| CDP mouse message handlers (5) | DELETED | cdpMouseClick, cdpMouseClickAndHold, cdpMouseDrag, cdpMouseDragVariableSpeed, cdpMouseWheel all removed. |
| STT message handlers (2) | DELETED | stt-start, stt-stop removed. |
| DOM stream message handlers (6) | DELETED | domStreamReady, domStreamSnapshot, domStreamMutations, domStreamScroll, domStreamOverlay, domStreamDialog removed. |

### content/actions.js

| Function | Verdict | Notes |
|----------|---------|-------|
| tools.click() | CHANGED-OK | Text-based targeting via TreeWalker added. Angular Material combobox detection added. Reachable. |
| tools.type() | OK | No changes since v0.9.24. |
| tools.navigate() | OK | No changes since v0.9.24. |
| tools.scroll() | OK | No changes since v0.9.24. |
| CDP tool message senders | REGRESSION (via AL-08) | Send cdpMouseClick/Drag/Wheel to background which no longer handles them. |

### content/dom-analysis.js

| Function | Verdict | Notes |
|----------|---------|-------|
| hashElement() | OK | Element hashing for diffing. Unchanged. |
| isInViewport() | OK | Viewport detection. Unchanged. |
| isElementInViewport() | OK | Rect-based viewport check. Unchanged. |
| slugify() | OK | Text slug generation for semantic IDs. Unchanged. |
| generateSemanticElementId() | OK | Semantic ID generation (tag_text_index pattern). Unchanged. |
| inferElementPurpose() | CHANGED-OK | Payment field detection expanded with autocomplete (DA-01). Improvement. |
| getRelationshipContext() | OK | Element relationship detection. Unchanged. |
| generateElementDescription() | OK | Human-readable element descriptions. Unchanged. |
| getColorName() | OK | RGB color naming helper. Unchanged. |
| getElementCluster() | OK | UI region clustering. Unchanged. |
| getVisualProperties() | OK | Computed style extraction. Unchanged. |
| getShadowPath() | OK | Shadow DOM path computation. Unchanged. |
| prioritizeElements() | OK | Element priority scoring. Unchanged. |
| diffDOM() | OK | Incremental DOM diffing. Unchanged. |
| extractRelevantHTML() | OK | Raw HTML extraction. Unchanged. |
| detectPageContext() | OK | Page type detection (search, login, form, etc.). Unchanged. |
| detectSearchNoResults() | OK | Search results absence detection. Unchanged. |
| extractErrorMessages() | OK | Error message extraction. Unchanged. |
| isElementVisible() | OK | Computed style visibility check. Unchanged. |
| detectCompletionSignals() | OK | Task completion signal detection. Unchanged. |
| inferPageIntent() | OK | Page intent classification. Unchanged. |
| extractEcommerceProducts() | OK | Product card extraction. Unchanged. |
| calculateElementScore() | OK | Element relevance scoring. Unchanged. |
| findElementByStrategies() | OK | Multi-strategy element lookup. Unchanged. |
| getFilteredElements() | OK | 3-stage element filtering pipeline. Unchanged. |
| getRegion() | OK | DOM region classification. Unchanged. |
| inferActionForElement() | OK | Action inference for elements. Unchanged. |
| buildGuideAnnotations() | OK | Site guide annotation injection. Unchanged. |
| isBlockElement() | OK | Block element detection. Unchanged. |
| isVisibleForSnapshot() | OK | Snapshot visibility filter. Unchanged. |
| formatInlineRef() | OK | Inline ref formatting for markdown. Unchanged. |
| walkDOMToMarkdown() | OK | DOM-to-markdown walker. Unchanged. |
| buildMarkdownSnapshot() | OK | Markdown snapshot builder. Unchanged. |
| findMainContentRoot() | OK | Main content detection. Unchanged. |
| extractPageText() | OK | Page text extraction for readpage. Unchanged. |
| getStructuredDOM() | CHANGED-OK | data-fsb-id stamping (DA-02), autocomplete capture (DA-05), CDK overlay scan (DA-04). All additive. |
| getCanvasPixelFallback() | OK | Canvas pixel sampling. Unchanged. |

### content/selectors.js

| Function | Verdict | Notes |
|----------|---------|-------|
| generateSelectors() | OK | Multi-strategy selector generation. Unchanged. |
| sanitizeSelector() | OK | jQuery pseudo-selector removal. Unchanged. |
| querySelectorWithShadow() | CHANGED-OK | data-fsb-id fallback added (DA-03). Improvement. |
| resolveRef() | OK | Compact ref resolution via RefMap. Unchanged. |
| querySelectorAllWithShadow() | OK | Multi-element query with shadow DOM. Unchanged. |
| computeAccessibleName() | OK | ARIA accessible name computation. Unchanged. |
| getImplicitRole() | OK | HTML5 implicit ARIA role mapping. Unchanged. |
| getARIARelationships() | OK | ARIA relationship extraction. Unchanged. |
| isElementActionable() | OK | Actionability assessment. Unchanged. |

### content/messaging.js

| Function | Verdict | Notes |
|----------|---------|-------|
| executeAction handler | OK | Dispatches to tools object. No regression. |
