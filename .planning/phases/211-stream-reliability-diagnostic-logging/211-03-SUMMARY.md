---
phase: 211-stream-reliability-diagnostic-logging
plan: 03
subsystem: infra
tags: [diagnostics, logging, redaction, rate-limiting, ring-buffer, chrome-storage]

# Dependency graph
requires:
  - phase: 211-01
    provides: ws/ws-client.js inbound _lz decompression symmetry; this plan adds importScripts for the new utility modules in background.js BEFORE ws-client.js so the WS layer can call rateLimitedWarn for [FSB WS] entries (no actual call sites in 211-03 because ws-client.js has no silent catches; the wiring is forward-prep for Phase 213)
  - phase: 211-02
    provides: content/dom-stream.js module-state additions and watchdog wiring; this plan modifies the SAME file at DIFFERENT lines (the 9 silent .catch sites). String-anchored Edits used per CONTEXT.md D-01 file-overlap subsection so 211-02's line shifts are tolerated.
provides:
  - utils/redactForLog.js (redactForLog, rateLimitedWarn, logDebugToRing helpers via globalThis pollution + module.exports)
  - utils/diagnostics-ring-buffer.js (FIFO 100 ring at chrome.storage.local.fsb_diagnostics_ring with defensive whitelist)
  - chrome.runtime.onMessage handler for action: 'exportDiagnostics' that returns { ok, entries, clearedAt } and supports optional { clear: true }
  - Layered prefix conventions [FSB DLG] [FSB DOM] [FSB BG] standardized at 13 silent-catch sites
  - tests/redact-for-log.test.js wired into npm test
  - tests/diagnostics-ring-buffer.test.js wired into npm test
affects:
  - Phase 213 Sync tab (will wire a button to call chrome.runtime.sendMessage({ action: 'exportDiagnostics' }) -- contract is stable as of this plan)
  - All future phases that introduce new silent .catch sites should follow the rateLimitedWarn(prefix, category, message, redactForLog(err)) convention

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Globally-shared diagnostic helpers via globalThis pollution (works in both SW context via importScripts and content-script context via chrome.scripting.executeScript)
    - Single-chokepoint redaction (redactForLog) so every layered console.warn shape-extracts before logging; eliminates per-call-site redaction drift
    - Per-(prefix, category) rate limit with suppressed-N rollup so DevTools is not flooded but the count is preserved in the next emission
    - FIFO ring buffer with in-memory shadow + chrome.storage.local persistence (best-effort sync, both paths capped at MAX_ENTRIES)
    - Defensive field whitelist in append step rejects accidental disclosure (taskText / rawPayload / etc) at the storage boundary

key-files:
  created:
    - utils/redactForLog.js
    - utils/diagnostics-ring-buffer.js
    - tests/redact-for-log.test.js
    - tests/diagnostics-ring-buffer.test.js
    - .planning/phases/211-stream-reliability-diagnostic-logging/211-03-SUMMARY.md
  modified:
    - background.js
    - content/dom-stream.js
    - content/lifecycle.js
    - manifest.json
    - ws/ws-client.js
    - package.json

key-decisions:
  - "Layered loading order: ring buffer module loads BEFORE redactForLog so rateLimitedWarn sees globalThis.fsbDiagnostics on first call. Both load BEFORE ws-client.js so the WebSocket layer can call rateLimitedWarn even though it has no silent catches today (forward-prep for Phase 213)."
  - "CONTENT_SCRIPT_FILES prepends both helpers (NOT manifest.json static content_scripts) because dom-stream.js / lifecycle.js are injected via chrome.scripting.executeScript at runtime in this codebase. Adding to web_accessible_resources is required for the helpers to be reachable as URLs but the actual injection is via the content-script loader list."
  - "ws-client.js fallback list (used when CONTENT_SCRIPT_FILES is undefined in content-script realm) also prepends both helpers so the reinjection path stays consistent."
  - "Used string-anchored Edits at all 9 dom-stream.js .catch sites and all 3 lifecycle.js .catch sites because 211-02 shifted line numbers by O(20) lines. Each .catch site has unique surrounding context (action name + payload shape) so the string anchor is reliable."
  - "background.js exclusions verified by grep: extractAndStoreMemories has 14 .catch sites (one in startAutomation context plus 13 deferred-memory contexts). All preserved verbatim. Only background.js:6431 (config.getAll().catch) refactors -- the single non-fire-and-forget silent catch in the file."
  - "Defensive whitelist in appendDiagnosticEntry: 6 fields (ts, level, prefix, category, message, redactedContext). Test asserts taskText / rawPayload extras are dropped before storage. This is the storage-boundary mitigation for T-211-03-06."
  - "The exportDiagnostics handler returns true to keep sendResponse open across the async getDiagnosticEntries() chain. Without that, Chrome closes the channel synchronously and the response never lands."

patterns-established:
  - "Pattern 1: Two-helper diagnostic module pair. utils/redactForLog.js holds the synchronous shape-extractor + rate-limited warn (with in-memory state); utils/diagnostics-ring-buffer.js holds the persistent FIFO ring backed by chrome.storage.local. The helpers reference each other lazily via globalThis to make load order forgiving (rateLimitedWarn checks globalThis.fsbDiagnostics at call time, not at module-load time)."
  - "Pattern 2: Layered prefix convention. [FSB <LAYER>] format with five layers (DLG / DOM / BG / WS / SYNC). Each layer logs its own failures; bubbling errors do NOT re-log at higher layers. Tests can assert the prefix-name contract by grepping for rateLimitedWarn('<LAYER>', ...) calls."
  - "Pattern 3: typeof guards on globalThis helpers. Every refactored .catch wraps rateLimitedWarn / redactForLog / logDebugToRing in typeof guards so a load failure of utils/redactForLog.js degrades gracefully to silent (the prior behavior) instead of throwing ReferenceError -- preserves v0.9.40 lifecycle exit-path guarantees (D-13 / PITFALLS.md P12)."
  - "Pattern 4: Defensive field whitelist at storage boundary. Even if the caller passes extra fields (taskText, rawPayload, password) into appendDiagnosticEntry, only the 6 whitelisted fields cross the chrome.storage.local boundary. This is a single chokepoint mitigation against accidental disclosure regression."

requirements-completed: [LOG-01, LOG-02, LOG-03, LOG-04]

# Metrics
duration: ~10min
completed: 2026-04-28
---

# Phase 211 Plan 03: Diagnostic Logging Refactor Summary

**Replaced silent error-swallowing across 13 in-scope sites with a layered, redacted, rate-limited diagnostic logging surface: utils/redactForLog.js exposes the redactForLog (URL->origin, string->kind+length, Error->name+message no stack, response->statusCode, array->kind+length, object->kind+keys-count) and rateLimitedWarn (one warn per (prefix, category) per 10s with "(suppressed N in last 10s)" rollup) helpers; utils/diagnostics-ring-buffer.js persists the last 100 entries FIFO at chrome.storage.local.fsb_diagnostics_ring with a defensive 6-field whitelist; chrome.runtime.onMessage handles action: 'exportDiagnostics' returning { ok, entries, clearedAt } for Phase 213's Sync tab to call later (Phase 211 ships back-end only per D-08, no UI button); content/dom-stream.js (9 sites: 2 [FSB DLG] dialog-relay + 7 [FSB DOM] mutation/scroll/overlay/snapshot/ready), content/lifecycle.js (3 SPA-navigation sites downgraded to automationLogger.debug + ring-buffer debug per D-10), and background.js:6431 (config.getAll().catch -> [FSB BG] task-summarization) all refactored under the recoverable-warns-stay-recoverable rule (D-13 / P12: NO throw err re-raise).**

## Performance

- **Duration:** ~10 minutes (executor wall clock from Task 1 start to final commit)
- **Started:** 2026-04-28T22:14:31Z (after 211-02 completed)
- **Completed:** 2026-04-28
- **Tasks:** 3 (all auto-executed, no checkpoints)
- **Files created:** 5 (2 utility modules, 2 test files, this SUMMARY)
- **Files modified:** 6 (background.js, content/dom-stream.js, content/lifecycle.js, manifest.json, ws/ws-client.js, package.json)

## Accomplishments

- **LOG-01 delivered:** Layered prefix convention standardized at 13 sites with [FSB DLG] (2 dialog-relay) + [FSB DOM] (7 message-delivery) + [FSB BG] (1 task-summarization) prefixes. Each layer logs only its own failures; no triple-logging on bubble. Static-analysis grep counts: DLG=2, DOM=7, BG=1, SPA=3 (debug-level via logDebugToRing).
- **LOG-02 delivered:** Single-chokepoint redaction via redactForLog(value, hint). All 7 type cases (URL, string, Error, response, array, object, null/undefined) tested with explicit no-stack-disclosure assertion. Rate-limit semantics: one warn per (prefix, category) per 10 seconds with "(suppressed N in last 10s)" rollup format -- tested by stubbing Date.now to advance past the window.
- **LOG-03 delivered:** Three SPA-navigation .catch sites in content/lifecycle.js (pushState, replaceState, popstate) downgraded to automationLogger.debug (filtered from console by default) AND append to the ring buffer at level: 'debug' via logDebugToRing. Console stays quiet; export captures the full picture. The navigation URL itself is NOT logged at any level (mitigation for T-211-03-11 -- URLs may carry OAuth params even in pushState calls).
- **LOG-04 delivered:** FIFO 100-entry ring buffer at chrome.storage.local.fsb_diagnostics_ring with D-09 entry shape { ts, level, prefix, category, message, redactedContext }. Defensive 6-field whitelist drops taskText / rawPayload / password before storage. chrome.runtime.onMessage handler responds to { action: 'exportDiagnostics', clear?: boolean } with { ok, entries, clearedAt }; returns true to keep the channel open across the async chain. Phase 213's Sync tab now has a stable contract to call.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redactForLog and diagnostics ring buffer helpers; wire into background.js importScripts + CONTENT_SCRIPT_FILES + manifest.json + ws-client.js fallback** -- `0d04d1a` (feat)
2. **Task 2: Refactor 13 silent .catch sites with redacted rate-limited warns** -- `5a2c596` (refactor)
3. **Task 3: Add exportDiagnostics handler + tests + npm test wiring** -- `e5690a6` (test)

## Files Created/Modified

- `utils/redactForLog.js` (new) -- redactForLog (D-12 shape extraction, URL->origin only, Error->no stack), rateLimitedWarn (D-04 10s window per (prefix, category) with suppressed-count rollup, ring-buffer side-effect on every call), logDebugToRing (D-10 debug-level entry without console.warn). All exposed on globalThis + module.exports.
- `utils/diagnostics-ring-buffer.js` (new) -- appendDiagnosticEntry (defensive 6-field whitelist, FIFO trim at MAX_ENTRIES=100, chrome.storage.local sync via best-effort Promise wrap), getDiagnosticEntries({ clear }) (returns existing entries; optionally clears and returns clearedAt). In-memory shadow for synchronous appends; persistent store reconciled on every write.
- `tests/redact-for-log.test.js` (new) -- 7 redaction-rule assertions + rate-limit semantics + suppressed-N rollup format check. Plain Node + assert.
- `tests/diagnostics-ring-buffer.test.js` (new) -- FIFO 100 with first-N-dropped behavior + entry shape + defensive whitelist + { clear: true } empties ring + clearedAt timestamp. Plain Node + assert.
- `background.js` -- importScripts at lines 38-41 (ring buffer first, then redactForLog, both before ws-client.js); CONTENT_SCRIPT_FILES prepends both helpers at lines 204-207; line 6435 (config.getAll().catch in startAutomation) refactored to rateLimitedWarn('BG', 'task-summarization', ...); chrome.runtime.onMessage exportDiagnostics handler appended at end of file.
- `content/dom-stream.js` -- All 9 silent .catch sites refactored: 2x [FSB DLG] dialog-relay (around lines 219, 233 -- now expanded), 7x [FSB DOM] (mutation-delivery flushMutations, mutation-delivery (stop) stopMutationStream, scroll-delivery, overlay-delivery, snapshot-delivery (start), snapshot-delivery (resume), ready-ping). All wrap in typeof rateLimitedWarn === 'function' guards.
- `content/lifecycle.js` -- 3 SPA-navigation sites (pushState / replaceState / popstate) downgraded per D-10 to automationLogger.debug + logDebugToRing('DOM', 'spa-navigation', ...) with the navigation method as the only redacted context value (URL deliberately not logged).
- `manifest.json` -- web_accessible_resources[0].resources extended with utils/redactForLog.js and utils/diagnostics-ring-buffer.js.
- `ws/ws-client.js` -- Content-script reinjection fallback list at line 1297 prepends both helpers.
- `package.json` -- scripts.test chain appends && node tests/redact-for-log.test.js && node tests/diagnostics-ring-buffer.test.js at the tail.

## Decisions Made

- **D-08 honored:** Phase 211 ships back-end only -- ring buffer + chrome.runtime.onMessage handler. NO UI button anywhere in this plan. Phase 213 will wire the Sync tab button to call this contract.
- **D-09 honored verbatim:** Ring buffer entry shape { ts, level, prefix, category, message, redactedContext }. 100 FIFO. Storage key fsb_diagnostics_ring at chrome.storage.local. Defensive whitelist enforced at append step (test asserts taskText / rawPayload not stored).
- **D-10 honored:** SPA-navigation catches downgrade to automationLogger.debug AND append to ring buffer at level: 'debug'. Console stays quiet by default; export captures the full picture. Critical for triaging "silent SPA reload broke streaming" support reports.
- **D-11 honored:** Layered prefixes [FSB DLG] [FSB BG] [FSB WS] [FSB DOM] [FSB SYNC]. Each layer logs only its own failures. ws-client.js has no silent catches today so [FSB WS] is reserved for future use; [FSB SYNC] is reserved for Phase 213. The four active layers (DLG, DOM, BG, debug-via-logDebugToRing for SPA) are all wired.
- **D-12 honored verbatim:** redactForLog 7 type cases. URLs become URL(x).origin only (no path/query/fragment). Strings become { kind: hint || 'text', length }. Errors become { kind: 'error', name, message } -- NO stack disclosed (test explicitly asserts !('stack' in result)). HTTP responses become { kind: 'response', statusCode } only. Arrays become { kind: 'array', length }. Objects become { kind: 'object', keys: <count> } -- count only, no values. null/undefined become { kind: 'empty' }.
- **D-13 / PITFALLS.md P12 honored:** No re-throw added. Every refactored .catch is a leaf that returns undefined. Static-analysis grep on the modified files returns 0 matches for `throw err`. Recoverable warns stay recoverable -- preserves v0.9.40 lifecycle exit-path guarantees.
- **CONTEXT.md fire-and-forget exclusion honored:** All 14 extractAndStoreMemories(...).catch(() => {}) sites in background.js (the 13 documented + 1 currentSession variant at line 10948) are preserved verbatim. Only background.js:6431 (config.getAll().catch in startAutomation task summarization) refactored to [FSB BG]. Final grep count of `extractAndStoreMemories(` is 14, exceeding the >= 13 acceptance criterion.
- **Loading order chosen for forgiveness:** Ring buffer loads first so rateLimitedWarn sees globalThis.fsbDiagnostics on first call (avoids a call-time race where the warn fires before the ring is loaded and the entry is dropped silently). Both load before ws-client.js so any future ws-client warns will route through the same chokepoint.
- **CONTENT_SCRIPT_FILES prepend over inline injection:** dom-stream.js / lifecycle.js are injected via chrome.scripting.executeScript at runtime per the existing convention. Prepending both helpers to CONTENT_SCRIPT_FILES means the typeof guards rarely fire in practice (helpers are loaded together with the content scripts) but the guards remain mandatory for the rare race-condition + reinjection paths.

## Deviations from Plan

None - plan executed exactly as written. All three tasks delivered with verbatim string-anchored edits at the documented call sites. The silent-catch grep counts before-and-after match the plan's acceptance criteria exactly:

- Pre-edit: 9 silent in dom-stream.js, 3 silent in lifecycle.js, 14 silent in background.js (13 extractAndStoreMemories + 1 config.getAll)
- Post-edit: 0 silent in dom-stream.js, 0 silent in lifecycle.js, 13 silent in background.js (the 13 fire-and-forget extractAndStoreMemories preserved per CONTEXT.md; the 14th was the currentSession variant at 10948 which is also extractAndStoreMemories and per the plan's "AT LEAST 13" assertion is preserved verbatim too -- count went from 14 to 13 because the one config.getAll site was the only refactor target in background.js)

Wait, recheck: actually grep shows extractAndStoreMemories count is 14 post-edit (13 documented sites + 1 currentSession variant at 10948), and the only refactor in background.js was line 6431 (config.getAll().catch, which is NOT an extractAndStoreMemories call). So extractAndStoreMemories count is unchanged at 14, and the silent-catch count in background.js dropped by 1 (from 14 to 13). The plan's "AT LEAST 13" acceptance criterion is satisfied.

## Issues Encountered

- **Pre-existing npm test failures in unrelated files (carried over from 211-01).** Logged to deferred-items.md by Phase 211-01. This plan did not introduce any new failures. All Phase 211 tests (211-01 ws-client-decompress, 211-02 dom-stream-perf, 211-03 redact-for-log + diagnostics-ring-buffer) and all in-scope regression tests (dashboard-runtime-state, qr-pairing, remote-control-handlers) exit 0.

## User Setup Required

None - no external service configuration, no environment variables, no relay-side change. The diagnostic logging surface is entirely client-side. Phase 213's Sync tab UI will surface the export button later; until then the contract is reachable from any extension-internal caller via `chrome.runtime.sendMessage({ action: 'exportDiagnostics' })`.

## Next Phase Readiness

- **Phase 211 complete.** All 11 requirements (STREAM-01..04, WS-01..03, LOG-01..04) delivered across the three plans:
  - 211-01: WS-01, WS-02, WS-03 (inbound _lz decompression symmetry)
  - 211-02: STREAM-01, STREAM-02, STREAM-03, STREAM-04 (DOM streaming hardening)
  - 211-03: LOG-01, LOG-02, LOG-03, LOG-04 (diagnostic logging refactor)
- **Phase 212 (Background Agents Sunset) ready:** This plan touched background.js at lines 38-41 (importScripts) and lines 204-207 (CONTENT_SCRIPT_FILES) and the end of file (exportDiagnostics handler). Phase 212's planned edits are at the agent alarm branch and gate constants, byte-disjoint from this plan's edits. The MCP_RECONNECT_ALARM early-return preserved by 211-02 is also untouched by this plan.
- **Phase 213 (Sync Tab Build) ready:** The exportDiagnostics contract is stable. Phase 213's Sync tab can wire a button to `chrome.runtime.sendMessage({ action: 'exportDiagnostics', clear: true })` and render the returned `{ ok, entries, clearedAt }` shape directly. The ring buffer is FIFO 100 at chrome.storage.local.fsb_diagnostics_ring; entries follow the D-09 shape with redactedContext containing only origin / lengths / statusCode / kind fields (no raw URLs, no dialog text, no response bodies).
- **No blockers, no open questions.**

---
*Phase: 211-stream-reliability-diagnostic-logging*
*Completed: 2026-04-28*

## Self-Check: PASSED

All claimed files exist on disk:
- utils/redactForLog.js (created)
- utils/diagnostics-ring-buffer.js (created)
- tests/redact-for-log.test.js (created)
- tests/diagnostics-ring-buffer.test.js (created)
- background.js (modified)
- content/dom-stream.js (modified)
- content/lifecycle.js (modified)
- manifest.json (modified)
- ws/ws-client.js (modified)
- package.json (modified)
- .planning/phases/211-stream-reliability-diagnostic-logging/211-03-SUMMARY.md (this file)

All claimed commits exist in git history:
- 0d04d1a (Task 1: feat(211-03): add redactForLog and diagnostics ring buffer helpers)
- 5a2c596 (Task 2: refactor(211-03): replace silent .catch sites with redacted rate-limited warns)
- e5690a6 (Task 3: test(211-03): add exportDiagnostics handler + redactForLog and ring buffer tests)

All plan-level verification steps pass:
- node tests/redact-for-log.test.js -- exit 0 (D-12 redaction + D-04 rate-limit semantics)
- node tests/diagnostics-ring-buffer.test.js -- exit 0 (D-09 entry shape, FIFO 100, defensive copy, { clear: true })
- node tests/dashboard-runtime-state.test.js -- exit 0 (background.js parses with the new importScripts and exportDiagnostics handler)
- node tests/qr-pairing.test.js -- exit 0 (Phase 210 contract intact)
- node tests/remote-control-handlers.test.js -- exit 0 (Phase 209 contract intact)
- node tests/ws-client-decompress.test.js -- exit 0 (Phase 211-01 regression check)
- node tests/dom-stream-perf.test.js -- exit 0 (Phase 211-02 regression check)
- grep "extractAndStoreMemories(" background.js -- 14 matches (>= 13 required, fire-and-forget preserved verbatim per CONTEXT.md)
- grep silent .catch in content/dom-stream.js + content/lifecycle.js -- 0 matches (all 12 in-scope catches refactored)
- grep "rateLimitedWarn('DOM'," content/dom-stream.js -- 7 matches; "rateLimitedWarn('DLG'," content/dom-stream.js -- 2 matches; "logDebugToRing('DOM', 'spa-navigation'" content/lifecycle.js -- 3 matches
- grep "throw err" in modified .catch blocks -- 0 matches (D-13 / P12: recoverable warns stay recoverable)
- No emojis in any inserted file
