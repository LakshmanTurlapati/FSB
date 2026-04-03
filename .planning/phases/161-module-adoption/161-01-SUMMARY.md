---
phase: 161-module-adoption
plan: 01
title: "createSession Adoption and Mode Routing"
status: complete
completed: "2026-04-03"
duration: "5min"
tasks_completed: 1
tasks_total: 1
subsystem: session-management
tags: [session-schema, mode-routing, factory-adoption, background-js]
dependency_graph:
  requires: [ai/session-schema.js, ai/engine-config.js]
  provides: [typed-session-construction, explicit-mode-routing]
  affects: [background.js, ai/session-schema.js]
tech_stack:
  patterns: [factory-pattern, warm-tier-persistence, mode-routing-ternary]
key_files:
  modified:
    - background.js
    - ai/session-schema.js
decisions:
  - "mode field added as warm-tier to SESSION_FIELDS -- persisted across SW kills"
  - "Replay sessions (line 3976) left as inline literal -- different object shape, out of scope"
metrics:
  duration: "5min"
  completed: "2026-04-03"
  tasks: 1
  files: 2
---

# Phase 161 Plan 01: createSession Adoption and Mode Routing Summary

Replaced all 3 inline session object literals in background.js with createSession(overrides) calls and added explicit mode routing at every session construction site.

## What Changed

### ai/session-schema.js
- Added `mode` field to SESSION_FIELDS as warm-tier with default `'autopilot'` and type string enum (autopilot|mcp-manual|mcp-agent|dashboard-remote)
- This ensures mode is persisted via getWarmFields and restored on service worker kill

### background.js -- handleStartAutomation (~line 6125)
- Replaced 68-line inline object literal with `createSession({ ... 20 overrides })` call
- Removed 37 fields that match SESSION_FIELDS defaults (actionHistory, stateHistory, failedAttempts, failedActionDetails, lastDOMHash, stuckCounter, etc.)
- Set `mode: 'autopilot'` explicitly

### background.js -- executeAutomationTask (~line 6395)
- Replaced 41-line inline object literal with `createSession({ ... 17 overrides })` call
- Added mode routing ternary: `isDashboardTask ? 'dashboard-remote' : (isBackgroundAgent ? 'mcp-agent' : 'autopilot')`
- Hot-tier operational fields (isBackgroundAgent, agentId, _isDashboardTask, _dashboardTaskRunId, _completionCallback) passed as overrides -- applied via Object.assign in createSession

### background.js -- restoreSessionsFromStorage (~lines 2864, 2914)
- Wrapped both running-session and idle-session restoration blocks in `createSession()` calls
- Pattern: `applyContinuityToSession(createSession({ ...persistedSession, ... }), continuity)`
- Preserved mode from persisted state (warm-tier field survives SW kill)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all changes are functional wiring, no placeholder data.

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "createSession({"` background.js | 4 (handleStartAutomation + executeAutomationTask + 2x restoreSessionsFromStorage) |
| mode field in SESSION_FIELDS | default: 'autopilot', tier: 'warm' |
| `mode: 'autopilot'` in handleStartAutomation | Present |
| `mode: sessionMode` in executeAutomationTask | Present |
| dashboard-remote ternary | `isDashboardTask ? 'dashboard-remote' : (isBackgroundAgent ? 'mcp-agent' : 'autopilot')` present |
| No inline actionHistory/stateHistory/failedAttempts in construction sites | Confirmed (only replay session at line 3976 retains inline literal -- different object shape, out of scope) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 5e722bf | feat(161-01): adopt createSession at all 3 background.js construction sites and add mode field |

## Self-Check: PASSED

- FOUND: background.js
- FOUND: ai/session-schema.js
- FOUND: .planning/phases/161-module-adoption/161-01-SUMMARY.md
- FOUND: commit 5e722bf
