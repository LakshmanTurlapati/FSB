---
phase: 139-dead-code-removal-polish
verified: 2026-04-01T11:09:30Z
status: gaps_found
score: 5/10 must-haves verified
gaps:
  - truth: "cli-validator.js file no longer exists on disk"
    status: failed
    reason: "File still exists at utils/cli-validator.js (1,233 lines). Plan 01 required deletion but it was never executed."
    artifacts:
      - path: "utils/cli-validator.js"
        issue: "File still exists (1,233 lines) -- should have been deleted"
    missing:
      - "Delete utils/cli-validator.js"
      - "Remove CLIValidator, parseCliResponse, runEdgeCaseTests references from ui/options.js"
  - truth: "No code references CLI_COMMAND_TABLE or TASK_PROMPTS"
    status: failed
    reason: "CLI_COMMAND_TABLE (line 18) and TASK_PROMPTS (line 257) still exist as top-level constants in ai-integration.js with multiple internal references. They are dead code (unreachable since callAIAPI was deleted from background.js) but were explicitly listed for removal in Plan 01."
    artifacts:
      - path: "ai/ai-integration.js"
        issue: "CLI_COMMAND_TABLE at line 18, TASK_PROMPTS at line 257, plus internal references at lines 4890, 4907, 4935, 4481, 4516, 4517"
    missing:
      - "Delete CLI_COMMAND_TABLE constant (lines 18-156)"
      - "Delete TASK_PROMPTS object (lines 257-475)"
      - "Delete all getToolDocumentation and getGuidance code paths that reference these constants"
  - truth: "No code references buildPrompt or buildMinimalUpdate"
    status: failed
    reason: "buildPrompt (line 2496) and buildMinimalUpdate (line 822) still exist as methods on AIIntegration class in ai-integration.js, plus HYBRID_CONTINUATION_PROMPT (line 476), BATCH_ACTION_INSTRUCTIONS (line 507), PROMPT_CHAR_LIMIT (line 13), and buildSheetsFormattingDirective (line 522)."
    artifacts:
      - path: "ai/ai-integration.js"
        issue: "buildPrompt method at line 2496, buildMinimalUpdate method at line 822, plus constants HYBRID_CONTINUATION_PROMPT (476), BATCH_ACTION_INSTRUCTIONS (507), PROMPT_CHAR_LIMIT (13), buildSheetsFormattingDirective function (522)"
    missing:
      - "Delete buildPrompt method from AIIntegration class"
      - "Delete buildMinimalUpdate method from AIIntegration class"
      - "Delete PROMPT_CHAR_LIMIT, HYBRID_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS constants"
      - "Delete buildSheetsFormattingDirective function"
      - "Remove the buildPrompt/buildMinimalUpdate code paths inside getAutomationActions (lines 2060, 2075)"
  - truth: "No code references parseCliResponse, tokenizeLine, mapCommand, or COMMAND_REGISTRY"
    status: failed
    reason: "parseCliResponse is called 3 times in ai-integration.js getAutomationActions (lines 2275, 2310, 2356). COMMAND_REGISTRY referenced in comments (line 16, 1536). cli-parser.js is deleted so these are runtime errors waiting to happen."
    artifacts:
      - path: "ai/ai-integration.js"
        issue: "parseCliResponse calls at lines 2275, 2310, 2356 reference a function from deleted cli-parser.js. COMMAND_REGISTRY comment references at lines 16, 1536."
    missing:
      - "Remove parseCliResponse calls from getAutomationActions or replace with new parsing"
      - "Clean up COMMAND_REGISTRY comment references"
  - truth: "CLI_VALIDATION handlers removed from background.js"
    status: failed
    reason: "CLI_VALIDATION_LIVE_TEST (line 4534) and CLI_VALIDATION_GET_PROMPT (line 4569) message handlers still exist in background.js. The GET_PROMPT handler calls ai.buildPrompt which is the dead code path."
    artifacts:
      - path: "background.js"
        issue: "CLI_VALIDATION_LIVE_TEST handler at line 4534, CLI_VALIDATION_GET_PROMPT handler at line 4569, _cliValidationLastCall variable at line 4680"
    missing:
      - "Delete case 'CLI_VALIDATION_LIVE_TEST' block (lines 4534-4567)"
      - "Delete case 'CLI_VALIDATION_GET_PROMPT' block (lines 4569+)"
      - "Delete _cliValidationLastCall variable (line 4680)"
---

# Phase 139: Dead Code Removal & Polish Verification Report

**Phase Goal:** All legacy autopilot infrastructure is removed after the new agent loop is proven stable, leaving a cleaner codebase with ~3,100 fewer lines
**Verified:** 2026-04-01T11:09:30Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | cli-parser.js file no longer exists on disk | VERIFIED | `ls ai/cli-parser.js` returns "No such file" (deleted in commit c586a70, 953 lines) |
| 2 | cli-validator.js file no longer exists on disk | FAILED | File still exists at utils/cli-validator.js (1,233 lines) |
| 3 | No code references CLI_COMMAND_TABLE or TASK_PROMPTS | FAILED | Both constants still exist in ai-integration.js (lines 18, 257) with multiple internal references |
| 4 | No code references buildPrompt or buildMinimalUpdate | FAILED | Both methods still exist in AIIntegration class (lines 2496, 822) plus supporting constants |
| 5 | No code references HYBRID_CONTINUATION_PROMPT or BATCH_ACTION_INSTRUCTIONS | FAILED | Both constants still exist in ai-integration.js (lines 476, 507) |
| 6 | startAutomationLoop function no longer exists in background.js | VERIFIED | `grep startAutomationLoop background.js` returns 0 matches |
| 7 | Multi-signal completion validator functions no longer exist in background.js | VERIFIED | `grep validateCompletion background.js` returns 0 matches, all 23 validators gone |
| 8 | prefetchDOM function no longer exists in background.js | VERIFIED | `grep prefetchDOM background.js` returns 0 matches |
| 9 | All callers that previously called startAutomationLoop now call runAgentLoop instead | VERIFIED | 7 runAgentLoop call sites confirmed at lines 4874, 5038 (comment), 5205, 5366, 6557, 7031, 7131 |
| 10 | The agent loop (runAgentLoop) is the sole autopilot entry point | VERIFIED | 0 startAutomationLoop refs, 0 callAIAPI refs, runAgentLoop is the only loop invocation |

**Score:** 5/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ai/cli-parser.js` | DELETED | VERIFIED | File does not exist on disk (deleted in c586a70) |
| `utils/cli-validator.js` | DELETED | FAILED | File still exists, 1,233 lines |
| `ai/ai-integration.js` | Legacy prompt infrastructure removed | FAILED | CLI_COMMAND_TABLE, TASK_PROMPTS, buildPrompt, buildMinimalUpdate, HYBRID_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS, PROMPT_CHAR_LIMIT, buildSheetsFormattingDirective all remain |
| `background.js` | No startAutomationLoop, no completion validators, no prefetchDOM, callers rewired to runAgentLoop | PARTIAL | startAutomationLoop/validators/prefetchDOM/callAIAPI deleted. But CLI_VALIDATION handlers (lines 4534, 4569) and _cliValidationLastCall (line 4680) remain |
| `ui/options.js` | No parseCliResponse or CLIValidator references | FAILED | runEdgeCaseTests (line 5699), parseCliResponse (lines 5702, 5773), CLIValidator (lines 5445, 5450) all remain |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| background.js handleStartAutomation | ai/agent-loop.js runAgentLoop | runAgentLoop(sessionId, options) | WIRED | Lines 4874, 5205 confirmed with full options object |
| background.js executeAutomationTask | ai/agent-loop.js runAgentLoop | runAgentLoop(sessionId, options) | WIRED | Line 5366 confirmed with full options object |
| background.js launchNextCompanySearch | ai/agent-loop.js runAgentLoop | setTimeout -> runAgentLoop | WIRED | Line 6557 confirmed with 500ms delay and full options |
| background.js startSheetsDataEntry | ai/agent-loop.js runAgentLoop | setTimeout -> runAgentLoop | WIRED | Line 7031 confirmed with 500ms delay and full options |
| background.js startSheetsFormatting | ai/agent-loop.js runAgentLoop | setTimeout -> runAgentLoop | WIRED | Line 7131 confirmed with 500ms delay and full options |
| ai/agent-loop.js | ai/tool-definitions.js | TOOL_REGISTRY | WIRED | Line 26 imports, line 49 assigns _TOOL_REGISTRY, line 355 maps tools |
| background.js | ai/ai-integration.js | new AIIntegration | WIRED | Lines 4557, 4573, 5625 instantiate for testConnection/callAPI |

### Data-Flow Trace (Level 4)

Not applicable -- this phase is pure code deletion, no dynamic data rendering artifacts.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| background.js syntax valid | `node -c background.js` | SYNTAX_OK | PASS |
| ai-integration.js syntax valid | `node -c ai-integration.js` | SYNTAX_OK | PASS |
| startAutomationLoop fully removed | `grep -c startAutomationLoop background.js` | 0 | PASS |
| runAgentLoop is sole entry point | `grep -c runAgentLoop background.js` | 7 (includes 1 comment) | PASS |
| background.js line count reduced | `wc -l background.js` | 9,700 (from 14,229) | PASS -- 4,529 lines removed |
| cli-parser.js deleted | `ls ai/cli-parser.js` | No such file | PASS |
| cli-validator.js should be deleted | `ls utils/cli-validator.js` | File exists (1,233 lines) | FAIL |
| CLI dead code in ai-integration.js | `grep CLI_COMMAND_TABLE ai/ai-integration.js` | 4 matches | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLN-01 | 139-01 | cli-parser.js and CLI_COMMAND_TABLE removed | PARTIAL | cli-parser.js deleted, but CLI_COMMAND_TABLE still in ai-integration.js. cli-validator.js not deleted. |
| CLN-02 | 139-01 | Old TASK_PROMPTS and buildPrompt templates removed | FAILED | TASK_PROMPTS, buildPrompt, buildMinimalUpdate, HYBRID_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS, PROMPT_CHAR_LIMIT, buildSheetsFormattingDirective all still present in ai-integration.js |
| CLN-03 | 139-02 | Multi-signal completion validator removed | SATISFIED | All 23 validator functions deleted from background.js (0 grep matches) |
| CLN-04 | 139-02 | Per-iteration automatic DOM fetching removed | SATISFIED | prefetchDOM deleted from background.js (0 grep matches) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ai/ai-integration.js | 2275, 2310, 2356 | parseCliResponse() calls to deleted cli-parser.js | BLOCKER | Runtime error -- getAutomationActions calls function from deleted file. Dead code path (no callers from background.js) but latent crash if anything invokes getAutomationActions. |
| background.js | 4575 | ai.buildPrompt() call in CLI_VALIDATION_GET_PROMPT handler | Warning | Calls method that Plan 01 intended to delete. Dead handler but still executes if message received. |
| ui/options.js | 5702 | parseCliResponse reference | Warning | References function from deleted cli-parser.js. Would crash if runEdgeCaseTests is invoked. |
| ui/options.js | 5445-5450 | CLIValidator / cli-validator references | Warning | References file that Plan 01 intended to delete. |

### Human Verification Required

### 1. Extension Load Test

**Test:** Load the extension in Chrome, open a new tab, and trigger an automation task.
**Expected:** The agent loop starts via runAgentLoop. No errors about missing startAutomationLoop, prefetchDOM, or callAIAPI.
**Why human:** Cannot verify Chrome extension runtime behavior programmatically without a browser instance.

### 2. Options Page CLI Section

**Test:** Open the options page and check if any CLI validation UI elements are visible.
**Expected:** CLI validation UI should either be hidden/removed or not crash. The runEdgeCaseTests button (if visible) would crash since parseCliResponse is from deleted cli-parser.js.
**Why human:** Need to verify UI state in actual browser.

## Gaps Summary

Plan 02 (CLN-03, CLN-04) was executed completely and successfully. All startAutomationLoop infrastructure, completion validators, prefetchDOM, and callAIAPI were deleted from background.js. The 4,529 net lines removed from background.js alone exceeds the phase's ~3,100 line target.

Plan 01 (CLN-01, CLN-02) was NOT executed as written. The PLAN specifies deleting cli-validator.js, CLI_COMMAND_TABLE, TASK_PROMPTS, buildPrompt, buildMinimalUpdate, and related constants from ai-integration.js. The corresponding SUMMARY instead documents only rewiring executeAutomationTask to runAgentLoop (a preparatory step from Plan 02). The only Plan 01 artifact that was completed was cli-parser.js deletion (done in commit c586a70 during Plan 02 execution).

**Root cause:** Plan 01's SUMMARY (139-01-SUMMARY.md) documents the wrong work. It covers "Rewire executeAutomationTask to runAgentLoop" which was actually a Task 1 step in Plan 02. The actual Plan 01 scope (CLN-01/CLN-02 ai-integration.js cleanup) was never executed.

**Net impact on phase goal:**
- The primary goal ("all autopilot entry points now use runAgentLoop, old iteration loop is gone") IS achieved
- The secondary goal ("~3,100 fewer lines") IS exceeded for background.js alone (4,529 lines removed + 953 cli-parser.js = 5,482 total)
- CLN-01 is partially satisfied (cli-parser.js deleted, but CLI_COMMAND_TABLE and cli-validator.js remain)
- CLN-02 is not satisfied (all prompt template code still in ai-integration.js)
- Dead code in ai-integration.js is unreachable but still present (~2,400 lines of dead prompt infrastructure)
- Dead code in ui/options.js referencing deleted cli-parser.js creates latent crash risk

---

_Verified: 2026-04-01T11:09:30Z_
_Verifier: Claude (gsd-verifier)_
