---
phase: 118-scheduling-enhancements
plan: "02"
subsystem: agents
tags: [retry, backoff, persistence, sync-queue]
dependency_graph:
  requires: []
  provides: [agent-retry-on-failure, persistent-sync-queue]
  affects: [background.js, agents/agent-manager.js, agents/server-sync.js]
tech_stack:
  added: []
  patterns: [exponential-backoff, chrome-storage-persistence]
key_files:
  created: []
  modified:
    - background.js
    - agents/agent-manager.js
    - agents/server-sync.js
decisions:
  - "Retry alarms use fsb_agent_retry_ prefix to distinguish from scheduled alarms"
  - "Queue capped at 100 with trim to 50 to prevent unbounded storage growth"
metrics:
  duration: 3min
  completed: "2026-03-28"
---

# Phase 118 Plan 02: Retry-on-Failure and Persistent Sync Queue Summary

Exponential backoff retry (1min/5min/15min, 3 attempts) for failed agent runs, with server sync queue persisted to chrome.storage.local surviving service worker restarts.

## What Was Done

### Task 1: Retry-on-failure with exponential backoff (8e299f9)

Added retry tracking fields (`retryCount`, `retryMaxAttempts`, `lastRetryAt`) to the agent object in `agent-manager.js`, plus `incrementRetry()` and `resetRetry()` methods. Modified the alarm handler in `background.js` to detect retry alarms via `fsb_agent_retry_` prefix, schedule retry alarms with `AGENT_RETRY_DELAYS = [1, 5, 15]` minutes on failure, and reset retry state on success or after max attempts exhausted.

### Task 2: Persistent server sync queue (3720a81)

Replaced the in-memory `_queue` array in `server-sync.js` with `chrome.storage.local` persistence under the key `fsb_sync_queue`. Added `_loadQueue()` and `_saveQueue()` methods, made `_queueSync()` async with persistent storage, and updated `processQueue()` to read from and write back to storage. Added `getQueueSize()` for diagnostics. Queue caps at 100 items with trim to 50.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8e299f9 | Add retry-on-failure with exponential backoff to agent alarm handler |
| 2 | 3720a81 | Persist server sync queue to chrome.storage.local |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.
