---
phase: 180-pipeline-audit-regression-inventory
plan: "01"
subsystem: agent-loop, tool-execution
tags: [audit, regression, v0.9.24-baseline, agent-loop, tool-executor, background-js]
dependency_graph:
  requires: []
  provides:
    - 180-agent-loop-findings.md
    - 180-tool-execution-findings.md
  affects:
    - ai/agent-loop.js (orphaned, needs re-wiring or merge)
    - ai/tool-executor.js (orphaned, needs re-wiring or merge)
    - background.js (active automation loop, needs CDP handlers restored)
tech_stack:
  added: []
  patterns:
    - git diff v0.9.24..HEAD for baseline comparison
    - Function-level static analysis of critical paths
key_files:
  created:
    - .planning/phases/180-pipeline-audit-regression-inventory/180-agent-loop-findings.md
    - .planning/phases/180-pipeline-audit-regression-inventory/180-tool-execution-findings.md
  modified: []
decisions:
  - "Used v0.9.24 tag as the baseline reference for all diffs (D-05)"
  - "Focused background.js audit on automation-related paths only, skipping dashboard/MCP/UI code (~5000 lines excluded)"
  - "Classified findings as REGRESSION (broken behavior) vs CHANGED-OK (intentional improvement) vs ORPHANED (good code that is dead)"
metrics:
  duration: "9 min"
  completed: "2026-04-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  findings_total: 20
---

# Phase 180 Plan 01: Agent Loop + Tool Execution Audit Summary

Read-only audit of the Agent Loop and Tool Execution subsystems by diffing against v0.9.24 baseline. The dominant finding is that the entire v0.9.24 modular architecture (agent-loop.js, tool-executor.js, hook-pipeline.js, cost-tracker.js in the execution path) is orphaned -- background.js no longer imports or calls any of it, instead running a pre-v0.9.24 monolithic startAutomationLoop that handles DOM fetching, AI calling, and action dispatch inline.

## What Was Done

### Task 1: Agent Loop Subsystem Audit

Executed `git diff v0.9.24..HEAD` for agent-loop.js, background.js, session-schema.js, hook-pipeline.js, cost-tracker.js, and engine-config.js. Read the current code at function level. Produced 13 findings:

- **AL-01 (Critical):** agent-loop.js not imported in background.js. The v0.9.24 `runAgentLoop` is never called. All code in the 2000-line module is dead.
- **AL-02:** createSessionHooks() deleted. HookPipeline never instantiated.
- **AL-03:** CostTracker not used in active path. $2 cost breaker is not enforced.
- **AL-04:** maxIterations raised to 500 in engine-config but legacy loop defaults to 20.
- **AL-05:** Active loop has 5-min time limit vs engine-config's 10-min.
- **AL-06:** Iteration circuit breaker added to agent-loop.js but unreachable.
- **AL-07:** Enhanced stuck detection (fingerprints, escalation, force-stop) is dead code.
- **AL-08 (Critical):** 5 CDP mouse message handlers removed from background.js. Content scripts send cdpMouseClick/Drag/Wheel messages that fall through to "Unknown action" error.
- **AL-09:** Session hook infrastructure removed (uiSurface, historySessionId, agentResumeState).
- **AL-10:** STT message handlers removed.
- **AL-11:** DOM stream message handlers removed.
- **AL-12:** System prompt narration-only rule and execute_js escape hatch are dead code.
- **AL-13:** callProviderWithTools max_tokens fix for xAI is dead code.

### Task 2: Tool Execution Subsystem Audit

Executed `git diff v0.9.24..HEAD` for tool-executor.js, tool-definitions.js, content/actions.js, and content/selectors.js. Read the current code at function level. Produced 7 findings:

- **TE-01:** tool-executor.js is orphaned (not imported by background.js).
- **TE-02:** Read-only hadEffect fix exists in orphaned tool-executor.js.
- **TE-03 (Positive):** execute_js tool correctly available in both paths.
- **TE-04 (Positive):** click text-based targeting is reachable via active path.
- **TE-05 (Positive):** Angular Material combobox detection is reachable.
- **TE-06 (Positive):** data-fsb-id selector fallback is reachable.
- **TE-07 (Positive):** report_progress narration-only description update is reachable.

## Key Architecture Finding

The codebase has TWO parallel automation pipelines:

**Active path (legacy):** background.js `startAutomationLoop()` -> `callAIAPI()` -> `AIIntegration.getAutomationActions()` -> text-parsed JSON actions -> direct `sendMessageWithRetry({ action: 'executeAction' })` to content script.

**Orphaned path (v0.9.24):** background.js `handleStartAutomation()` -> `runAgentLoop()` -> `callProviderWithTools()` -> native tool_use protocol -> `executeTool()` via tool-executor.js -> route-based dispatch (content/CDP/background).

The orphaned path has better: safety breakers, cost tracking, stuck detection, prompt engineering, and structured results. The active path has better: DOM prefetching, stop-signal racing, login detection, multi-signal change detection, typing-sequence stuck analysis.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| v0.9.24 tag as baseline | Last milestone where modular architecture was explicitly designed and validated |
| Automation-only scope for background.js | 10443-line file; dashboard/MCP/UI code excluded to maintain focus |
| Classify findings by reachability | ORPHANED vs REGRESSION vs CHANGED-OK distinguishes dead-code improvements from active regressions |

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED

- [x] 180-agent-loop-findings.md exists (13 AL-NN findings)
- [x] 180-tool-execution-findings.md exists (7 TE-NN findings)
- [x] Both files have all 6 required fields per finding
- [x] Both files have Functions Audited sections
- [x] Git diff v0.9.24..HEAD executed for all required files
- [x] Commit 86f7d70: agent loop findings
- [x] Commit a3b0c49: tool execution findings
