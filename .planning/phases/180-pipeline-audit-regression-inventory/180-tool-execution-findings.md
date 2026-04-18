# Tool Execution Subsystem Findings

## Summary

7 findings across 15+ functions audited. The tool execution subsystem has two parallel paths: (1) the v0.9.24 modular path (`tool-executor.js` dispatching via `_route` metadata from `tool-definitions.js`), and (2) the active legacy path in `background.js` which sends `executeAction` messages directly to the content script via `sendMessageWithRetry` and uses `AIIntegration.getAutomationActions()` for the old text-parsed `{ actions, taskComplete }` response format instead of the native tool_use protocol. The modular path is orphaned (AL-01 from the agent loop audit). Tool-definitions.js and content/actions.js have received genuine improvements post-v0.9.24 that ARE reachable because the legacy loop dispatches directly to content scripts.

## Findings

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

## Tool Registry Comparison

### v0.9.24 vs Current

| Metric | v0.9.24 | Current | Delta |
|--------|---------|---------|-------|
| Total tools | 48 | 49 | +1 |
| Content-route | 28 | 28 | 0 |
| CDP-route | 7 | 7 | 0 |
| Background-route | 13 | 14 | +1 |

### Tool Changes

| Change | Tool | Details |
|--------|------|---------|
| ADDED | execute_js | Background-route, arbitrary JS execution escape hatch |
| MODIFIED | click | Added optional `text` parameter, `selector` no longer required |
| MODIFIED | report_progress | Description updated with explicit narration-only warning |

No tools were removed or renamed. All 48 v0.9.24 tools remain with identical names and routes.

### Registry Parity

Extension `ai/tool-definitions.js` (49 tools) and MCP `mcp-server/ai/tool-definitions.cjs` (49 tools) have identical tool names.

## Functions Audited

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

### content/actions.js

| Function | Verdict | Notes |
|----------|---------|-------|
| tools.click() | CHANGED-OK | Text-based targeting via TreeWalker added. Angular Material combobox detection added. Reachable. |
| tools.type() | OK | No changes since v0.9.24. |
| tools.navigate() | OK | No changes since v0.9.24. |
| tools.scroll() | OK | No changes since v0.9.24. |
| CDP tool message senders | REGRESSION (via AL-08) | Send cdpMouseClick/Drag/Wheel to background which no longer handles them. |

### content/selectors.js

| Function | Verdict | Notes |
|----------|---------|-------|
| resolveSelector() (within querySelectorWithShadow) | CHANGED-OK | data-fsb-id fallback added. Reachable. |
| elementCache | OK | No changes. |
| selector generation | OK | No changes. |

### content/messaging.js

| Function | Verdict | Notes |
|----------|---------|-------|
| executeAction handler | OK | Dispatches to tools object, ref resolution, visual context. No regression. |

### background.js (tool dispatch in active loop)

| Function | Verdict | Notes |
|----------|---------|-------|
| handleBackgroundAction() | OK | Handles background-route tools including execute_js. Active path. |
| Direct executeAction dispatch | ACTIVE BUT BYPASSES EXECUTOR | Sends messages to content script without going through tool-executor.js. Works but misses structured result normalization. |
| callAIAPI() | ACTIVE BUT LEGACY | Uses AIIntegration.getAutomationActions() -- old text-parsed JSON format, not native tool_use protocol. |
