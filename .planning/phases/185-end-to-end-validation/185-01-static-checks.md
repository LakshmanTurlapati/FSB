# Phase 185-01: Static Integration Check Results

**Run date:** 2026-04-19
**Target:** Main repo (FSB/) at commit ab60279
**Status:** ALL 16 CHECKS PASS

## Result Table

| Check | Description | Expected | Actual | Status |
|-------|-------------|----------|--------|--------|
| CHECK-01 | importScripts('ai/...) count in background.js | 17 | 17 | PASS |
| CHECK-02 | runAgentLoop(sessionId call sites | 3 | 3 | PASS |
| CHECK-03 | createSessionHooks references (1 def + 3 calls) | 4 | 4 | PASS |
| CHECK-04 | async function handleCDPMouse* handlers | 5 | 5 | PASS |
| CHECK-05 | @deprecated on startAutomationLoop | 1 | 1 | PASS |
| CHECK-06 | async function executeCDPToolDirect defined | 1 | 1 | PASS |
| CHECK-07 | executeCDPToolDirect wired (not null) at call sites | 3 | 3 | PASS |
| CHECK-08 | CDP verb cases in executeCDPToolDirect | 7 | 7 | PASS |
| CHECK-09 | Dead code function defs in universal-provider.js | 0 | 0 | PASS |
| CHECK-10 | max_tokens 4096 in agent-loop.js | 1+ | 3 | PASS |
| CHECK-11 | max_tokens 4096 in ai-integration.js | 1+ | 3 | PASS |
| CHECK-12 | site-guides/index.js importScripts | 1 | 1 | PASS |
| CHECK-13 | get_page_snapshot local handler in agent-loop.js | 1+ | 7 | PASS |
| CHECK-14 | maxElements = 50 in dom-analysis.js | 1+ | 2 | PASS |
| CHECK-15 | SESSION_DEFAULTS safety values (cost/time/iter) | 1+ each | 4/4/4 | PASS |
| CHECK-16 | function checkSafetyBreakers in agent-loop.js | 1 | 1 | PASS |

## CHECK-01 Detail: importScripts('ai/...) in background.js

Lines 7-9 (pre-existing):
- cli-parser.js
- ai-integration.js
- tool-definitions.js

Lines 152-165 (Phase 181 additions):
- engine-config.js
- cost-tracker.js
- transcript-store.js
- hook-pipeline.js
- turn-result.js
- action-history.js
- session-schema.js
- permission-context.js
- hooks/safety-hooks.js
- hooks/permission-hook.js
- hooks/progress-hook.js
- tool-use-adapter.js
- tool-executor.js
- agent-loop.js

Total: 3 + 14 = 17. Matches expected.

## CHECK-02 Detail: runAgentLoop call sites

- Line 4778: Reactivation path (handleStartAutomation warm session)
- Line 5093: New session path (handleStartAutomation new session)
- Line 5247: executeAutomationTask (MCP/agent task entry)

## CHECK-05 Note

The original grep pattern `grep "@deprecated" | grep "startAutomationLoop"` expected both on the same line. The actual annotation is on line 7517 (`@deprecated Use runAgentLoop via handleStartAutomation instead.`) immediately above `async function startAutomationLoop` at line 7521. Check passes -- the annotation is present.

## CHECK-07 Detail: executeCDPToolDirect wiring

All 3 runAgentLoop call sites pass the real function reference:
- Line 4786: `executeCDPToolDirect: executeCDPToolDirect,`
- Line 5101: `executeCDPToolDirect: executeCDPToolDirect,`
- Line 5255: `executeCDPToolDirect: executeCDPToolDirect,`

None use `null`. Phase 182 wiring is confirmed.

## CHECK-08 Detail: 7 CDP verbs in executeCDPToolDirect

- cdpClickAt (line 10456)
- cdpClickAndHold (line 10495)
- cdpDrag (line 10534)
- cdpDragVariableSpeed (line 10587)
- cdpScrollAt (line 10640)
- cdpInsertText (line 10676)
- cdpDoubleClickAt (line 10731)

## CHECK-09 Detail: Dead code deletion confirmed

4 remaining references are all comments (not function definitions):
- Line 605: `// Do NOT call cleanResponse/parseJSONSafely: those functions strip text`
- Lines 617-619: `// cleanResponse / parseJSONSafely / fixTruncatedJSON / ... -- DELETED 2026-04-19`

Zero function definitions remain. Phase 183 cleanup confirmed.

## CHECK-15 Detail: Safety breaker values

- costLimit: 2.00 (4 occurrences across SESSION_DEFAULTS and EXECUTION_MODES)
- timeLimit: 600000 (4 occurrences)
- maxIterations: 500 (4 occurrences)

All match expected values from agent-loop.js safety breakers.
