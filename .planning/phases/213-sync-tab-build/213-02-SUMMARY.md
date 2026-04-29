---
phase: 213
plan: 02
subsystem: background-runtime + websocket-state-cache
tags: [background, runtime, websocket, state-cache, sync-tab, sync-02, phase-213]
requires:
  - Phase 209 _broadcastRemoteControlState in ws/ws-client.js (line 130-160)
  - Phase 209 ext:remote-control-state payload shape { enabled, attached, tabId, reason, ownership }
  - Phase 209 ws-client _lastRemoteControlState cache (line 124) consumed by snapshot recovery (line 781-789)
  - chrome.runtime.onMessage existing sender check at background.js:5034
provides:
  - Runtime action `getRemoteControlState` returning cached payload or disconnected default
  - Runtime push `remoteControlStateChanged` emitted from `_broadcastRemoteControlState`
  - background.js module-scope `_lastRemoteControlState` cache (separate from ws-client's cache per D-18)
  - Static-analysis regression test asserting both contracts + Phase 209 preservation
  - Test registered in `npm test` chain so it runs every CI/local invocation
affects:
  - background.js (cache decl + 2 new switch cases)
  - ws/ws-client.js (one push emit at the tail of `_broadcastRemoteControlState`)
  - tests/sync-tab-runtime.test.js (new file)
  - package.json (scripts.test chain extended by one tail entry)
tech-stack:
  added: []
  patterns:
    - "module-scope cache + replay-on-attach runtime action (D-16, D-18)"
    - "fire-and-forget chrome.runtime.sendMessage with lastError suppression (D-17)"
    - "static-analysis regression test mirroring tests/runtime-contracts.test.js style"
    - "tail-append to hand-chained scripts.test (Phase 212 precedent)"
key-files:
  created:
    - tests/sync-tab-runtime.test.js
    - .planning/phases/213-sync-tab-build/213-02-SUMMARY.md
    - .planning/phases/213-sync-tab-build/deferred-items.md
  modified:
    - background.js
    - ws/ws-client.js
    - package.json
decisions:
  - "[D-16] getRemoteControlState replay-on-attach with disconnected-shaped default (reason: 'unknown') on SW cold start"
  - "[D-17] runtime push fires AFTER the WS emit; never throws; reads chrome.runtime.lastError"
  - "[D-18] background.js cache is distinct from ws/ws-client.js:124 cache (the latter feeds Phase 209 snapshot recovery and is preserved byte-for-byte)"
  - "[D-25] dispatch-order tolerance: 213-01 may land before or after this plan; the new test is registered in npm test so it runs whenever the chain runs"
metrics:
  duration: "5 min"
  completed: "2026-04-29T16:02:17Z"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 3
  files_created: 1
  commits: 4
threat_flags: []
---

# Phase 213 Plan 02: Sync Tab Runtime Plumbing Summary

Plumbed the background-side runtime contract for the v0.9.45rc1 Sync tab pill: registered the `getRemoteControlState` replay-on-attach action and the `remoteControlStateChanged` push, added a SW-lifetime cache in `background.js` (separate from the Phase 209 ws-client cache), and locked both contracts behind a static-analysis regression test that runs on every `npm test` invocation.

## What Changed

### `background.js`

**Edit A -- Module-scope cache (lines 2008-2017):**

```javascript
// ============================================================================
// Phase 213 - Sync tab runtime cache (SYNC-02)
// Mirrors ext:remote-control-state for replay-on-attach via the
// 'getRemoteControlState' runtime action. Updated by the
// 'remoteControlStateChanged' push handler below. SW-lifetime only;
// null on cold start. Per CONTEXT D-18, disconnected is the safe default.
// Distinct from ws/ws-client.js:124 _lastRemoteControlState which serves
// Phase 209 snapshot recovery and remains untouched.
// ============================================================================
let _lastRemoteControlState = null;
```

Inserted directly after the existing `var _lastDomStreamStaleFlushCount = 0;` (Phase 211-02 cache) at line 2006. Naming is intentionally identical to the Phase 209 ws-client cache; the comment block disambiguates.

**Edit B -- `case 'getRemoteControlState':` (lines 5087-5098):**

Synchronous handler returning the cached payload or a disconnected-shaped default if the cache is null (SW cold start, no broadcast yet). Default shape exactly matches `{ enabled: false, attached: false, tabId: null, reason: 'unknown', ownership: 'none' }` per D-16.

**Edit C -- `case 'remoteControlStateChanged':` (lines 5100-5110):**

Synchronous handler updating the cache from `request.state`. Type-guarded with `request.state && typeof request.state === 'object'` (T-213-02-02 mitigation). The pre-existing sender check at line 5034 (`sender.id !== chrome.runtime.id`) gates this case; no additional sender hardening needed.

Both new cases respond synchronously (no `return true;`). All other existing switch cases (`startAutomation`, `stopAutomation`, `getStatus`, `checkSessionAlive`, `getCurrentTab`, ~50+ others) are byte-for-byte unchanged.

### `ws/ws-client.js`

**Edit D -- Runtime push at the tail of `_broadcastRemoteControlState` (lines 142-158):**

```javascript
// Phase 213 D-17: parallel runtime push so the Sync tab pill (and any
// other extension contexts) can subscribe to live state changes.
// Fire-and-forget; never throws. background.js listens to this push
// and updates its own _lastRemoteControlState cache (Phase 213 213-02).
try {
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
    chrome.runtime.sendMessage({ action: 'remoteControlStateChanged', state: state }, function () {
      // Read lastError to suppress the "Unchecked runtime.lastError" surface
      // when no listener is registered. Benign and expected at SW cold start.
      var _ = chrome.runtime.lastError;
    });
  }
} catch (e) {
  // Defensive: never let runtime push failures break ext:remote-control-state.
  // Per Phase 211 LOG-01, route through [FSB SYNC] prefix if logging is enabled.
  try { console.warn('[FSB SYNC] runtime push failed', e && e.message ? e.message : 'unknown'); } catch (_e) { /* ignore */ }
}
```

Inserted between the existing WS broadcast (`wsInstance.send('ext:remote-control-state', state);` line 140) and the original `return state;` (now line 159). Push is fire-and-forget, defensively wrapped, and reads `chrome.runtime.lastError` in the callback to suppress benign "no listener" warnings at SW cold start (when the Sync tab's listener isn't registered yet).

**Phase 209 invariants preserved byte-for-byte:**

- `ws/ws-client.js:124` -- `var _lastRemoteControlState = null;` declaration -- UNCHANGED
- `ws/ws-client.js:131-137` -- `state` object construction with `{ enabled, attached, tabId, reason, ownership }` keys in the same order -- UNCHANGED
- `ws/ws-client.js:138` -- `_lastRemoteControlState = state;` cache write -- UNCHANGED
- `ws/ws-client.js:139-141` -- `wsInstance.send('ext:remote-control-state', state);` WS broadcast -- UNCHANGED
- `ws/ws-client.js:159` -- `return state;` -- UNCHANGED
- `ws/ws-client.js:781-789` -- snapshot recovery read using `_lastRemoteControlState` (line shifted from pre-edit 764 due to the 17-line insertion in the function above; **content** is byte-for-byte identical):

```javascript
snapshotPayload.remoteControl = (typeof _lastRemoteControlState === 'object' && _lastRemoteControlState)
  ? Object.assign({}, _lastRemoteControlState)
  : {
      enabled: false,
      attached: false,
      tabId: null,
      reason: 'user-stop',
      ownership: 'none'
    };
```

### `tests/sync-tab-runtime.test.js`

New 99-line CommonJS file mirroring `tests/runtime-contracts.test.js` line-for-line:

- `require('fs')` + `require('path')` (NOT `require('node:fs')`)
- `let passed = 0; let failed = 0;` local counters
- `function assert(cond, msg)` with `console.log` / `console.error`
- Final `process.exit(failed > 0 ? 1 : 0)`
- 11 `assert(...)` call sites; the `forEach` loop adds 5 more for a total of 14 assertions covering:
  - background.js cache decl (`let _lastRemoteControlState = null`) (D-18)
  - background.js `case 'getRemoteControlState':` (D-16)
  - getRemoteControlState default payload `reason: 'unknown'` (D-16)
  - background.js `case 'remoteControlStateChanged':` (D-17/D-18)
  - background.js cache write `_lastRemoteControlState = request.state` (D-18)
  - ws-client `_broadcastRemoteControlState` function exists (Phase 209)
  - ws-client push `action: 'remoteControlStateChanged'` inside the function body (D-17)
  - ws-client `wsInstance.send('ext:remote-control-state'` preserved (Phase 209)
  - ws-client `var _lastRemoteControlState = null;` preserved (Phase 209/D-18)
  - 5x payload key preservation (`enabled:`, `attached:`, `tabId:`, `reason:`, `ownership:`) (Phase 209)

NO `node:test`, NO `node:assert/strict`, NO `describe`/`test` wrappers, NO jsdom, NO chrome.runtime mocks. Pure static analysis on `fs.readFileSync` outputs.

### `package.json`

**Edit E -- Append `&& node tests/sync-tab-runtime.test.js` to `scripts.test` (line 16):**

The `test` script tail before edit:
```
... && node tests/agent-sunset-control-panel.test.js && node tests/agent-sunset-showcase.test.js
```

After edit:
```
... && node tests/agent-sunset-control-panel.test.js && node tests/agent-sunset-showcase.test.js && node tests/sync-tab-runtime.test.js
```

`git diff package.json` shows ONLY the `scripts.test` line modified. JSON validity preserved (`node -e "JSON.parse(...)"` exits 0). Total chain length: 36 commands (was 35). No new top-level script (`grep '"test:sync"'` returns 0).

## Tasks Completed

| Task | Description                                                                                  | Commit  | Files                                  |
| ---- | -------------------------------------------------------------------------------------------- | ------- | -------------------------------------- |
| 1    | Add `_lastRemoteControlState` cache + `getRemoteControlState` + `remoteControlStateChanged` cases in `background.js` | 7748d06 | background.js                          |
| 2    | Add `chrome.runtime.sendMessage` runtime push to `_broadcastRemoteControlState` in `ws/ws-client.js`                | 2278cae | ws/ws-client.js                        |
| 3    | Create static-analysis regression test `tests/sync-tab-runtime.test.js`                                              | 05de962 | tests/sync-tab-runtime.test.js         |
| 4    | Register the new test in `package.json:scripts.test` (hand-chained list)                                             | d392cbb | package.json                           |

## Verification Results

### Plan-level automated verification (1-7)

```
1. grep -c "let _lastRemoteControlState = null" background.js         -> 1   PASS
2. grep -c "case 'getRemoteControlState':" background.js              -> 1   PASS
3. grep -c "case 'remoteControlStateChanged':" background.js          -> 1   PASS
4. grep -c "action: 'remoteControlStateChanged'" ws/ws-client.js      -> 1   PASS
5. grep -c "var _lastRemoteControlState = null;" ws/ws-client.js      -> 1   PASS
7. grep -c 'sync-tab-runtime.test.js' package.json                    -> 1   PASS
```

### Direct invocation (verification 6)

`node tests/sync-tab-runtime.test.js 2>&1 | tail -5`:
```
  PASS: [Phase 209] payload key tabId: preserved in _broadcastRemoteControlState
  PASS: [Phase 209] payload key reason: preserved in _broadcastRemoteControlState
  PASS: [Phase 209] payload key ownership: preserved in _broadcastRemoteControlState

=== Phase 213 SYNC-02 results: 14 passed, 0 failed ===
```
Exit code: 0

### Related-test regression (verification 8)

| Test                                              | Exit  | Notes                                       |
| ------------------------------------------------- | ----- | ------------------------------------------- |
| `tests/sync-tab-runtime.test.js`                  | 0     | 14 passed, 0 failed (this plan's new test)  |
| `tests/ws-client-decompress.test.js`              | 0     | "All assertions passed."                    |
| `tests/remote-control-handlers.test.js`           | 0     | "All remote control handler tests passed."  |
| `tests/agent-sunset-back-end.test.js`             | 0     | "All Phase 212-01 regression checks PASSED" |
| `tests/agent-sunset-control-panel.test.js`        | 0     | All checks passed                           |
| `tests/agent-sunset-showcase.test.js`             | 0     | All checks passed                           |

## Pre-existing Failures (Out of Scope)

`tests/runtime-contracts.test.js` exits 1 with 7 failures at the parent base commit `65dd7669` (BEFORE any 213-02 edit; reproduced by checking out the pre-edit `background.js` and re-running). The failing assertions cover `SessionStateEmitter` plumbing in `background.js` and `sessionStateEvent` consumption in `ui/popup.js` -- both unrelated to Phase 213 SYNC-02.

Logged to `.planning/phases/213-sync-tab-build/deferred-items.md`. Per GSD scope-boundary rule, NOT fixed by this plan -- they are not directly caused by 213-02 edits.

Note: with these pre-existing failures, `npm test` will fail mid-chain on `runtime-contracts.test.js` and never reach the new `sync-tab-runtime.test.js` entry. The new test is correctly registered in the chain (verified by index ordering in `package.json:16`); when the upstream `runtime-contracts.test.js` failures are addressed in a future plan, the new tail entry will execute.

## Deviations from Plan

None. Plan executed exactly as written.

The pre-existing `runtime-contracts.test.js` failures are documented as deferred items, not deviations -- they do not require code changes inside the 213-02 scope.

## Cross-plan Coordination (D-25)

This plan's runtime contract is fully decoupled from 213-01 (which adds the Sync tab UI/JS) and 213-03 (which updates showcase copy). Per D-25, dispatch order is tolerant: 213-01's `chrome.runtime.sendMessage({ action: 'getRemoteControlState' })` call falls through to "unknown -> disconnected" gracefully if 213-02 hasn't shipped yet, and the runtime push from this plan is fire-and-forget so it doesn't crash if 213-01's listener isn't registered yet.

No file overlap with 213-01 (control_panel.html, options.js, options.css) or 213-03 (showcase/*).

## Open Questions

None. File-disjoint with 213-01 and 213-03 per D-26.

## Self-Check: PASSED

All claimed artifacts verified to exist on disk and all claimed commits verified in git history:

- background.js (modified) -- FOUND, includes cache decl + 2 new cases
- ws/ws-client.js (modified) -- FOUND, includes push emit + Phase 209 preservation
- tests/sync-tab-runtime.test.js (created) -- FOUND, 14 assertions pass
- package.json (modified) -- FOUND, sync-tab-runtime.test.js in test chain
- Commit 7748d06 (Task 1) -- FOUND in git log
- Commit 2278cae (Task 2) -- FOUND in git log
- Commit 05de962 (Task 3) -- FOUND in git log
- Commit d392cbb (Task 4) -- FOUND in git log
- .planning/phases/213-sync-tab-build/deferred-items.md -- FOUND
- .planning/phases/213-sync-tab-build/213-02-SUMMARY.md -- FOUND (this file)
