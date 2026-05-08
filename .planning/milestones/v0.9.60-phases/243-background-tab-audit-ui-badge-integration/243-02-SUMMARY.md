---
phase: 243-background-tab-audit-ui-badge-integration
plan: 02
subsystem: background-service-worker
tags: [webNavigation, agent-registry, log-04, observability, multi-agent]

requires:
  - phase: 240-multi-agent-tab-ownership
    provides: agent-registry findAgentByTabId / getTabMetadata / formatAgentIdForDisplay; legacy:* synthesized owners
  - phase: 242-back-tool-dispatch
    provides: chrome.tabs.goBack route under D-08 background-tab posture (transitionType auto_bookmark false-positive driver)

provides:
  - BG-04 webNavigation.onCommitted user-initiated nav diagnostic emission for agent-owned tabs
  - 500ms agent-nav suppression window keyed on _tabMetadata.lastAgentNavigationAt
  - stampAgentNavigation(tabId) registry helper as SSOT for the suppression timestamp
  - extension/utils/agent-nav-emission.js pure helper exporting _maybeEmitUserNavigation + USER_INITIATED_TRANSITIONS

affects: [243-03 dashboard-mirror (consumer of LOG-04 ring), 244-pause-resume (downstream signal adoption), future loop adoption]

tech-stack:
  added: []
  patterns:
    - "Pure helper in extension/utils/ exported via globalThis + module.exports for SW + Node test parity"
    - "Listener extension via guarded helper call (try/catch) preserving event-driven posture (no setTimeout)"
    - "Per-tab suppression-stamp pattern: stamp BEFORE chrome.tabs.* programmatic nav, listener reads via getTabMetadata"

key-files:
  created:
    - extension/utils/agent-nav-emission.js
    - tests/agent-tab-user-navigation.test.js
  modified:
    - extension/utils/agent-registry.js
    - extension/background.js

key-decisions:
  - "Helper extraction over inline listener body: a pure module (extension/utils/agent-nav-emission.js) exposes _maybeEmitUserNavigation as a testable function. background.js loads it via importScripts adjacent to agent-registry.js and the existing webNavigation.onCommitted listener calls it with (details, registry, now). Tests stub registry + rateLimitedWarn directly without booting a SW harness."
  - "500ms suppression boundary is inclusive-suppress: (now - lastAgentNav) <= 500 suppresses, > 500 emits. Test 4(e) boundary (exact 500ms suppress / 501ms emit) locks the contract."
  - "stampAgentNavigation auto-creates a metadata bucket when the tab has no entry yet. The BG-04 false-positive guard cares ONLY about the timestamp; the full Phase 240 metadata block (ownershipToken, incognito, windowId, boundAt, forced) is populated lazily by bindTab when the agent claims the tab. Decoupling means the stamp is reachable even on tabs that have not yet been bound at the moment of the programmatic chrome.tabs.update call."
  - "EMISSION-only this phase: no session.status mutation, no pause/resume primitive (CONTEXT specifics line 67-68). The receiving infra (agent-loop.js adoption) is deferred. The signal lives in the LOG-04 ring buffer for downstream consumers."
  - "Stamping scope: background.js handleStartAutomation smart-tab navigation (2 sites). Dispatcher and tool-executor sites are owned by Plan 01's files_modified set; cross-plan stamp coverage tracked under deferred-items."

patterns-established:
  - "Pattern: pre-call stamp + post-event suppression -- programmatic API call sites stamp the registry's per-tab metadata; webNavigation listeners read the stamp synchronously before deciding to emit a diagnostic. Avoids transitionQualifier dependence."
  - "Pattern: pure helper module in extension/utils/ for behavior that needs Node-testable extraction from background.js"

requirements-completed: [BG-03, BG-04]

duration: 6 min
completed: 2026-05-06
---

# Phase 243 Plan 02: BG-04 webNavigation User-Initiated Pause Emission + 500ms Agent-Nav Suppression Summary

**LOG-04 'agent-tab-user-navigation' diagnostic on user-initiated webNavigation commits of non-legacy agent-owned tabs, with 500ms registry-stamped suppression to filter Phase 242 back-tool transitionType auto_bookmark false-positives.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-06T10:52:18Z
- **Completed:** 2026-05-06T10:57:59Z
- **Tasks:** 3 of 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- BG-04 closed: `chrome.webNavigation.onCommitted` listener (background.js:2469) now emits a LOG-04 `agent-tab-user-navigation` event when the user (transitionType in `{typed, auto_bookmark, reload, link}`) navigates an agent-owned tab. Subframes (`frameId !== 0`), legacy:* owners (popup/sidepanel/autopilot), and excluded transitionTypes (`form_submit / auto_subframe / manual_subframe / generated / start_page / keyword / keyword_generated`) are silently filtered.
- BG-03 closed (audit-side): the listener stays event-driven; no `setTimeout` is introduced. Confirmed by source review and the listener's helper-only call inside the existing onCommitted body.
- 500ms agent-nav suppression: `_tabMetadata.lastAgentNavigationAt` is the canonical per-tab stamp, written by `AgentRegistry.prototype.stampAgentNavigation(tabId)` and read inside `_maybeEmitUserNavigation` via `getTabMetadata`. Boundary tests lock the contract (`<= 500` suppress, `> 500` emit).
- New pure helper `extension/utils/agent-nav-emission.js` exports `_maybeEmitUserNavigation` + `USER_INITIATED_TRANSITIONS` for testability without booting the SW.
- `tests/agent-tab-user-navigation.test.js` covers 9 cases: stamp write, idempotent re-stamp, never-stamped suppression-check correctness, emit-on-user-nav, legacy:* suppression, subframe suppression, excluded transitionTypes (7 sub-cases), 500ms boundary cases (3 sub-cases), missing owner, helper exposure on registry instances. All GREEN.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1: stampAgentNavigation registry helper + lastAgentNavigationAt metadata** -- `e8b8748` (feat)
2. **Task 2: webNavigation.onCommitted listener emission + agent-nav-emission.js pure helper** -- `77eb506` (feat). NOTE: the background.js listener edit was absorbed into commit `2bdea1a` (243-03) due to a parallel-execution merge during the same session window; functionally equivalent, all wiring is at HEAD.
3. **Task 3: stamp lastAgentNavigationAt at programmatic-nav call sites in background.js handleStartAutomation** -- `ef25c75` (feat)

_Note: TDD-style flow used for Task 1 (RED test first, then GREEN registry helper, partial RED on Tests 4 deferred to Task 2 helper module)._

## Files Created/Modified

- **Created:** `extension/utils/agent-nav-emission.js` -- pure helper module; exports `_maybeEmitUserNavigation(details, registry, now, opts)` + `USER_INITIATED_TRANSITIONS` (Set) + `AGENT_NAV_SUPPRESSION_MS` (500). Loads under both globalThis (SW) and module.exports (Node test).
- **Created:** `tests/agent-tab-user-navigation.test.js` -- plain-Node `assert` style mirroring `tests/agent-cap-ui.test.js`. Tests 1-3 + 5 exercise the registry helper; Tests 4(a)-(f) exercise the pure emission helper with stubbed registry + capture-callback for rateLimitedWarn.
- **Modified:** `extension/utils/agent-registry.js` -- added `stampAgentNavigation(tabId)` method; extended `getTabMetadata` shallow clone to surface `lastAgentNavigationAt` (defaults to 0 when absent so the suppression check evaluates correctly).
- **Modified:** `extension/background.js` -- (a) `importScripts('utils/agent-nav-emission.js')` adjacent to `agent-registry.js` (line ~12); (b) inside the existing `chrome.webNavigation.onCommitted` listener body, a guarded `FsbAgentNavEmission._maybeEmitUserNavigation(details, globalThis.fsbAgentRegistryInstance, Date.now())` call placed after the port / state-clearing block and before `automationLogger.logComm`; (c) two `stampAgentNavigation(targetTabId)` calls in `handleStartAutomation`'s smart-tab navigation block (one for the switch-fallback chrome.tabs.update, one for the restricted-URL-navigate chrome.tabs.update).

## Decisions Made

- **Helper extraction for testability.** The original plan considered putting the function inline at the top of background.js with a `globalThis.__fsb_test_maybeEmitUserNavigation` test-export hook. Switched to a pure module under `extension/utils/agent-nav-emission.js` because:
  1. Node tests can `require()` the module directly without a SW harness.
  2. The listener body in background.js stays minimal -- a single guarded call.
  3. The export shape parallels the rest of `extension/utils/*` (agent-registry, mcp-visual-session) for consistency.
- **Auto-create metadata bucket on stamp.** `stampAgentNavigation(tabId)` does NOT require a prior `bindTab`. This decouples the suppression stamp from the Phase 240 token-bearing metadata block. Programmatic nav can happen on tabs that the agent will only bind AFTER the navigation commits (e.g., `handleNavigateRoute` calls `chrome.tabs.update` then `bindTab`); without auto-create, the stamp would be a no-op for that ordering.
- **500ms boundary inclusive-suppress.** `(now - lastAgentNav) <= 500` suppresses; `> 500` emits. Picked inclusive-suppress to be conservative against clock skew at the boundary; programmatic nav routes generally commit within 100-300ms so a hard 500ms cutoff has plenty of headroom.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 01 has not yet wired `stampAgentNavigation` at the dispatcher / tool-executor MCP-route programmatic-nav sites.**
- **Found during:** Task 3 cross-check
- **Issue:** The plan's Task 3 Option A says "stamp at background.js sites; dispatcher / tool-executor are owned by Plan 01." Verified `git log --oneline -- extension/ws/mcp-tool-dispatcher.js extension/ai/tool-executor.js | grep stamp`: no stamp calls present. Without dispatcher coverage, BG-04 false-positive suppression for MCP `back` / `navigate` / `go_back` / `go_forward` / `reload` is dead code on the most important call paths.
- **Fix:** Per the plan's Option A explicit constraint ("Avoid Option B unless background.js has zero programmatic-nav sites"), did NOT modify dispatcher / tool-executor. Background.js DOES have programmatic-nav sites (handleStartAutomation smart-tab routing, 2 stamps added). Documented call-site contract in `stampAgentNavigation` JSDoc enumerating every site that must stamp. Cross-plan integration is tracked under deferred-items for Plan 01 follow-up.
- **Files modified:** `extension/utils/agent-registry.js` (JSDoc only); `extension/background.js` (2 new stamp call sites)
- **Verification:** Tests still GREEN; greps confirm `stampAgentNavigation` x2 in background.js and the JSDoc lists all required sites.
- **Committed in:** `e8b8748` (Task 1 JSDoc) + `ef25c75` (Task 3 background.js)

---

**Total deviations:** 1 auto-fixed (1 blocking with documented cross-plan handoff)
**Impact on plan:** Cross-plan coupling intentionally avoided. The 500ms suppression window is fully wired from the registry side (helper + persistence + read path) and partially exercised by the autopilot path. Plan 01 follow-up needs to add `agentRegistry.stampAgentNavigation(targetTabId)` at the 5 dispatcher / tool-executor sites before MCP-driven navigations cleanly suppress BG-04 emissions.

## Issues Encountered

- **Pre-existing test failure in `tests/agent-cap-ui.test.js` Test 8** caused by Plan 04 commit `ad096c0` (`feat(243-04): UI-03 wire cap counter + validation toggle in options.js`). The `parseInt(elements.fsbAgentCap...)` source pattern was renamed during Plan 04's options.js refactor and the agent-cap-ui test was not updated to match. Out of scope for Plan 02 -- logged for Plan 04 follow-up. All other regression tests (`agent-registry`, `back-tool-ownership`, `agent-pooling`, `agent-tab-user-navigation`) GREEN.

## Deferred Items

The following items are tracked for Plan 01 follow-up to fully realize BG-04 suppression coverage:

- `extension/ws/mcp-tool-dispatcher.js handleNavigateRoute` (chrome.tabs.update line ~386): add `stampAgentNavigation(targetTabId)` immediately before the chrome.tabs.update call.
- `extension/ws/mcp-tool-dispatcher.js handleNavigationHistoryRoute` (chrome.tabs.goBack / goForward / reload lines ~429-433): add stamp before each of the three branches.
- `extension/ws/mcp-tool-dispatcher.js handleBackRoute` (chrome.tabs.goBack line ~784): add stamp before the goBack.
- `extension/ai/tool-executor.js navigate case` (chrome.tabs.update line ~207): add stamp.
- `extension/ai/tool-executor.js go_back case` (chrome.tabs.goBack line ~219): add stamp.

A standalone deferred-items file is recommended for Phase 243 to track these cross-plan items if not already created.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BG-04 LOG-04 ring buffer signal is observable in production for downstream consumers (dashboard mirror, future agent-loop pause adoption).
- BG-03 audit closed (listener-side): confirmed no setTimeout introduced.
- The `stampAgentNavigation` helper is in place as the canonical SSOT for the suppression timestamp. Plan 01 follow-up has a clean 5-line wiring task documented in JSDoc + this summary.
- Plan 02 ships ahead of dispatcher coverage; the autopilot path (handleStartAutomation) is fully wired today.

## Self-Check: PASSED

- `extension/utils/agent-nav-emission.js`: FOUND
- `tests/agent-tab-user-navigation.test.js`: FOUND
- Modified `extension/utils/agent-registry.js`: contains `stampAgentNavigation` (1) and `lastAgentNavigationAt` (5)
- Modified `extension/background.js`: contains `FsbAgentNavEmission` wiring (importScripts + listener call) and `stampAgentNavigation` x2
- Commits in git log:
  - `e8b8748` (Task 1): FOUND
  - `77eb506` (Task 2): FOUND (helper module). background.js wiring at HEAD via 2bdea1a parallel-merge -- functionally complete.
  - `ef25c75` (Task 3): FOUND
- Test run: `node tests/agent-tab-user-navigation.test.js` -- 9 tests, all GREEN (last line: "All tests passed.")
- Regression: `agent-registry.test.js`, `back-tool-ownership.test.js`, `agent-pooling.test.js` GREEN. Pre-existing `agent-cap-ui.test.js` failure attributed to Plan 04 commit `ad096c0` (out of scope).

---
*Phase: 243-background-tab-audit-ui-badge-integration*
*Completed: 2026-05-06*
