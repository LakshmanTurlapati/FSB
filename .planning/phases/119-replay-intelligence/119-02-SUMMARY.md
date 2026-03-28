---
phase: 119-replay-intelligence
plan: "02"
subsystem: agents
tags: [replay, intelligence, success-tracking, re-record]
dependency_graph:
  requires: [119-01]
  provides: [step-success-rates, re-record-trigger]
  affects: [agent-executor, agent-manager]
tech_stack:
  patterns: [per-step-metrics, threshold-based-trigger]
key_files:
  modified:
    - agents/agent-executor.js
    - agents/agent-manager.js
decisions:
  - "4 data points minimum before triggering re-record to avoid premature flags"
  - "50% success rate threshold for unreliable step detection"
  - "stepSuccessRates reset on any fresh AI script save (fallback or initial)"
metrics:
  duration: 2min
  completed: "2026-03-28"
  tasks: 2
  files: 2
---

# Phase 119 Plan 02: Step Success Tracking and Re-Record Trigger Summary

Per-step replay success rates tracked with successes/total counters, unreliable steps (below 50% over 4+ runs) auto-flag needsReRecord for proactive script re-recording.

## Changes Made

### Task 1: Per-step success tracking in replay results (d693a9d)

Modified `_executeReplayScript` in agent-executor.js to collect a `stepResults` array as replay steps execute. Each entry records `stepNumber`, `tool`, `success`, and `attempts`. The array is included in all return paths (success, failure at step, caught exception). The replay SUCCESS path in `execute()` now passes `stepResults` through to the return object. Both AI fallback and AI initial paths clear the `needsReRecord` flag after saving a fresh script.

**Files modified:** agents/agent-executor.js

### Task 2: Step success rate storage and re-record trigger (4910349)

Modified `recordRun` in agent-manager.js to consume `stepResults` from replay runs. Each step's success/total counters are accumulated in `agent.replayStats.stepSuccessRates` (keyed by step number). After updating stats, any step with 4+ data points and below 50% success rate sets `needsReRecord = true`. Both `ai_fallback` and `ai_initial` successful runs reset `stepSuccessRates` to `{}` and clear `needsReRecord`. The `createAgent` method now initializes `stepSuccessRates: {}` and `needsReRecord: false` in the initial `replayStats` object.

**Files modified:** agents/agent-manager.js

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
