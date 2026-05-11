---
phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay
plan: 01
subsystem: extension
tags: [mcp, visual-session, lifecycle, mv3, chrome-storage-session, chrome-alarms, v0.9.62]

# Dependency graph
requires:
  - phase: 255-schema-enforcement-on-action-tools
    provides: VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED at the MCP server schema layer; the lifecycle helpers can assume the bridge payload was schema-validated and re-validate as defense-in-depth.
  - phase: 254-contract-foundation
    provides: pinned field-bundle keys (visual_reason, client, is_final) and the badge-allowlist citation; the lifecycle module honours these key spellings verbatim.
provides:
  - extension/utils/mcp-visual-session-lifecycle.js (pure-helper module owning the per-tab sliding-window state machine)
  - recordVisualSessionTick / clearVisualSession / handleVisualSessionLifecycleTabRemoved / handleVisualSessionLifecycleAlarm / restoreVisualSessionLifecyclesFromStorage helpers
  - MCP_VISUAL_LIFECYCLE_STORAGE_KEY_PREFIX ('mcpVisualSession:') + MCP_VISUAL_LIFECYCLE_ALARM_PREFIX ('mcpVisualDeath:') + MCP_VISUAL_LIFECYCLE_DEATH_MS (60000) namespace constants
  - importScripts wiring so the helpers are available on the SW global namespace as MCPVisualSessionLifecycleUtils
affects: [256-02-mcp-sidecar-forwarding, 256-03-dispatcher-integration, 256-04-tests, 257-is-final-runtime-semantics, 258-explicit-tool-removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-tab chrome.storage.session keyed by '<feature>:<tabId>' (mirrors v0.9.36 + v0.9.60 precedent)"
    - "chrome.alarms wake-up with name '<feature>:<tabId>' for MV3 SW-survivable timers (mirrors v0.9.60 reconnect-grace pattern)"
    - "IIFE module pattern with dual export (globalThis namespace for SW + module.exports for Node tests) mirroring extension/utils/mcp-visual-session.js"
    - "Defense-in-depth: re-validate caller-supplied client labels at the extension SW even though the MCP server schema layer already gated them"

key-files:
  created:
    - extension/utils/mcp-visual-session-lifecycle.js
  modified:
    - extension/background.js

key-decisions:
  - "Storage namespace pinned to per-tab keys 'mcpVisualSession:<tabId>' (NOT the v0.9.36 single-key 'fsbMcpVisualSessions' map). Collision avoidance was verified by grep before implementation."
  - "Alarm namespace pinned to 'mcpVisualDeath:<tabId>' (no collision with 'fsb-mcp-bridge-reconnect' or 'fsb-domstream-watchdog'). Verified by grep."
  - "Sliding-window TTL is 60000 ms, matching v0.9.36's MCP_VISUAL_SESSION_DEGRADE_AFTER_MS, exported as a named constant for testability."
  - "Module is loaded via importScripts immediately after utils/mcp-visual-session.js so MCPVisualSessionUtils is on globalThis at IIFE evaluation time; module is pure (no SW listeners wired in this plan)."
  - "Overlay payload reuses v0.9.36 buildMcpVisualSessionStatus / buildMcpVisualSessionClearStatus by composing a synthetic v0.9.36 session shape; the visible overlay state is byte-compatible with explicit start_visual_session."
  - "Defense-in-depth: re-normalize caller client via normalizeMcpVisualClientLabel and reject same-tab cross-agent ticks with agent_mismatch even though primary gates run upstream (T-256-01-01, T-256-01-04)."
  - "Clock-skew defense: handleVisualSessionLifecycleAlarm reschedules when Date.now() < entry.deadlineAt rather than clearing prematurely (T-256-01-06)."

patterns-established:
  - "Pure-helper lifecycle modules export named constants AND functions on a single global namespace; SW listeners are wired separately in a later plan, never co-located."
  - "Every chrome.storage.session and chrome.alarms call goes through a tiny single-purpose helper inside the module (readStorageEntry, writeStorageEntry, deleteStorageEntry, clearAlarm, createAlarm); no raw chrome.storage.session.set scattered."

requirements-completed: [TIMEOUT-01, TIMEOUT-02, TIMEOUT-03, TIMEOUT-04]

# Metrics
duration: ~22min
completed: 2026-05-11
---

# Phase 256 Plan 01: Lifecycle Module + Per-Tab State Shape Summary

**Per-tab sliding-window lifecycle helpers landed as a pure module wired into the SW import chain. No caller-facing behaviour yet -- Plan 03 turns them on.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-11 (pre-execution context load)
- **Completed:** 2026-05-11
- **Tasks:** 3
- **Files modified:** 2 (1 created + 1 edited)

## Accomplishments

- New module `extension/utils/mcp-visual-session-lifecycle.js` (641 lines, ASCII-only) owns the v0.9.62 sliding-window state machine: per-tab persistence under `mcpVisualSession:<tabId>` in `chrome.storage.session`, MV3 SW-survivable death timers via `chrome.alarms` named `mcpVisualDeath:<tabId>`, auto-clear / re-arm / restore-after-SW-eviction / tab-close-cleanup paths.
- All 5 helpers (`recordVisualSessionTick`, `clearVisualSession`, `handleVisualSessionLifecycleTabRemoved`, `handleVisualSessionLifecycleAlarm`, `restoreVisualSessionLifecyclesFromStorage`) plus the 3 namespace constants are exported on `globalThis.MCPVisualSessionLifecycleUtils` AND via `module.exports` for Node tests.
- Overlay payload uses the v0.9.36 `buildMcpVisualSessionStatus` / `buildMcpVisualSessionClearStatus` builders so the visible overlay state is byte-compatible with what the existing content-script renderer already accepts on the `case 'sessionStatus':` path in `extension/content/messaging.js:1106`.
- `extension/background.js` `importScripts(...)` chain now loads the new module on line 11, immediately after `utils/mcp-visual-session.js` on line 10 and before `utils/agent-registry.js` on line 12.
- `npm test` continues to exit 0; no existing test affected by this plan.

## Task Commits

Each task was committed atomically on the `refinements` branch:

1. **Task 1: Create lifecycle module with state-shape constants + recordVisualSessionTick + clearVisualSession + handleVisualSessionLifecycleTabRemoved** -- `42de569` (feat)
2. **Task 2: Add restoreVisualSessionLifecyclesFromStorage + handleVisualSessionLifecycleAlarm to the same module** -- `f77a478` (feat)
3. **Task 3: Wire the new module into the SW importScripts chain** -- `fb88f58` (chore)

**Plan metadata commit:** intentionally omitted per executor instructions (STATE.md and ROADMAP.md are NOT touched in this plan).

## Files Created/Modified

- `extension/utils/mcp-visual-session-lifecycle.js` (created) -- v0.9.62 sliding-window lifecycle helpers (pure module; 5 named functions + 3 named constants; IIFE-with-globalThis-export pattern mirroring `extension/utils/mcp-visual-session.js`).
- `extension/background.js` (modified) -- single-line insertion at line 11: `importScripts('utils/mcp-visual-session-lifecycle.js');`. No other edits.

## Decisions Made

- **Storage and alarm namespaces** -- pinned per-tab to avoid collision with the v0.9.36 single-key `fsbMcpVisualSessions` map and the existing `fsb-mcp-bridge-reconnect` / `fsb-domstream-watchdog` alarms. Collision avoidance was verified with grep before authoring.
- **Synthetic v0.9.36 session shape for overlay broadcast** -- rather than introducing a new payload format, the lifecycle module composes a v0.9.36-compatible session object (`sessionToken: 'lifecycle:<tabId>'`, `clientLabel`, `tabId`, `task`, `phase: 'planning'`, `lifecycle: 'running'`, `animatedHighlights: true`) and passes it through the existing `buildMcpVisualSessionStatus` / `buildMcpVisualSessionClearStatus` builders. The content-script renderer needs zero changes.
- **Clock-skew defense in `handleVisualSessionLifecycleAlarm`** -- when `Date.now() < entry.deadlineAt`, reschedule with the original deadline rather than clearing prematurely. Documented inline as T-256-01-06.
- **Defense-in-depth `agent_mismatch` and `client_not_allowed` rejections** -- belt-and-suspenders to the v0.9.60 ownership gate and Phase 255 BADGE_NOT_ALLOWED. The lifecycle module MUST NOT trust the bridge payload blindly even though both gates exist upstream.

## Deviations from Plan

None -- plan executed exactly as written. Tasks 1, 2, and 3 each landed verbatim with no auto-fixes required.

The single observation worth recording: `npm test`'s ASCII enforcement is scoped to skill markdown files, not the source tree. Pre-existing `°F`/`°C` characters at `extension/background.js:4510` produced a non-ASCII byte hit when I ran a project-wide byte scan, but they predate this plan and are out of scope (they live in unmodified code). The two files touched by this plan are themselves ASCII-clean.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Plan 02 (parallel, no overlap with Plan 01) can proceed against this surface immediately. Plan 03 (Wave 2, depends on Plan 01) integrates these helpers at the chokepoint in `mcp/src/tools/manual.ts` and wires the SW listeners (`chrome.alarms.onAlarm`, `chrome.tabs.onRemoved`, SW-startup `restoreVisualSessionLifecyclesFromStorage` call).

The helpers are intentionally pure and side-effect-free at module load time; Plan 03's integration path is the first runtime consumer.

## Self-Check: PASSED

Verification commands run against the committed state:

- `node -e "global.MCPVisualSessionUtils = require('.../mcp-visual-session.js'); const lc = require('.../mcp-visual-session-lifecycle.js'); ..."` -- all 5 named functions are typeof 'function'; all 3 named constants match the pinned values (`mcpVisualSession:`, `mcpVisualDeath:`, `60000`).
- `grep -c "importScripts('utils/mcp-visual-session-lifecycle.js')" extension/background.js` returns `1`.
- `grep -c "importScripts('utils/mcp-visual-session.js')" extension/background.js` returns `1` (unchanged).
- Lifecycle module is ASCII-clean (26876 bytes, zero non-ASCII).
- No forbidden exports (`start_visual_session`, `end_visual_session`, `visualSession`) on the lifecycle module's exports object.
- `npm test` exits 0.
- All 3 commits exist on `refinements`: `42de569`, `f77a478`, `fb88f58`.

---
*Phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay*
*Plan: 01*
*Completed: 2026-05-11*
