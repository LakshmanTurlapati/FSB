---
phase: 139-dead-code-removal-polish
plan: 01
title: "Rewire executeAutomationTask to runAgentLoop"
subsystem: background-automation
tags: [dead-code, refactor, agent-loop]
dependency_graph:
  requires: [137-agent-loop-core-safety-mechanisms]
  provides: [startAutomationLoop-zero-external-callers]
  affects: [background.js]
tech_stack:
  added: []
  patterns: [agent-loop-routing]
key_files:
  created: []
  modified: [background.js]
decisions:
  - "Copy exact same runAgentLoop options object from handleStartAutomation for consistency"
metrics:
  duration: "74s"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
  completed: "2026-04-01T10:48:06Z"
---

# Phase 139 Plan 01: Rewire executeAutomationTask to runAgentLoop Summary

Replaced the last external call to startAutomationLoop in executeAutomationTask (line 6642) with runAgentLoop using the identical options object already used by handleStartAutomation.

## What Changed

### Task 1: Rewire executeAutomationTask to call runAgentLoop
**Commit:** 3563821

1. **Replaced call site (line 6642):** Changed `startAutomationLoop(sessionId)` to `runAgentLoop(sessionId, { activeSessions, persistSession, sendSessionStatus, broadcastDashboardProgress, endSessionOverlays, startKeepAlive, executeCDPToolDirect, handleDataTool })` -- the exact same options object used at line 6481 in handleStartAutomation.

2. **Updated stale comment (line 6465):** Changed `"Results consumed in startAutomationLoop to set dynamic thresholds"` to `"Results consumed by agent loop to set dynamic thresholds"`.

3. **Updated inline comment (line 6641):** New comment reads `"Start the agent loop (replaces startAutomationLoop -- all entry points now use runAgentLoop)"`.

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `runAgentLoop(sessionId` call count | 3 | 3 | PASS |
| Call sites | lines 6150, 6481, 6642 | lines 6150, 6481, 6642 | PASS |
| `startAutomationLoop` in executeAutomationTask | 0 | 0 | PASS |
| Remaining `startAutomationLoop` calls | Self-referential only (inside function body) | Lines 8597, 9062, 9153, 9433, 10291, 10351, 10558, 11810 | PASS |

## Entry Point Routing (After This Plan)

| Entry Point | Function | Calls | Line |
|-------------|----------|-------|------|
| Follow-up reactivation | handleStartAutomation | runAgentLoop | 6150 |
| New automation start | handleStartAutomation | runAgentLoop | 6481 |
| MCP/dashboard/agent tasks | executeAutomationTask | runAgentLoop | 6642 |
| startAutomationLoop (internal) | Self-referential | startAutomationLoop | 8597+ |

All external entry points now route to runAgentLoop. startAutomationLoop is 100% dead code (only called from within itself), ready for deletion in plan 02.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: 139-01-SUMMARY.md
- FOUND: commit 3563821
