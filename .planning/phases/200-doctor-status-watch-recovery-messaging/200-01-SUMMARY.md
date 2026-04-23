---
phase: 200-doctor-status-watch-recovery-messaging
plan: "01"
subsystem: diagnostics
tags: [mcp, diagnostics, doctor, status-watch, bridge]

requires:
  - phase: 198-mcp-bridge-lifecycle-reconnect-state
    provides: Hub/relay topology, heartbeat, and extension attach diagnostics
  - phase: 199-mcp-tool-routing-contract
    provides: Shared dispatcher and structured MCP route errors
provides:
  - Layered MCP diagnostics snapshot with package/config/bridge/extension/content-script/tool-routing classification
  - Internal extension diagnostics probe for active-tab, content-script, and bridge-client state
  - `status --watch` and doctor/status/watch render helpers backed by one snapshot shape
  - Regression coverage for doctor classification and watch/doctor output labels
affects: [phase-200, mcp-diagnostics, doctor, status-watch, recovery-copy]

tech-stack:
  added: []
  patterns:
    - Shared classified snapshot consumed by status, status --watch, and doctor
    - Internal MCP diagnostics route that stays inside the bridge instead of becoming a public tool

key-files:
  created:
    - tests/mcp-diagnostics-status.test.js
  modified:
    - background.js
    - mcp-server/build/index.js
    - mcp-server/src/diagnostics.ts
    - mcp-server/src/index.ts
    - ws/mcp-bridge-client.js
    - ws/mcp-tool-dispatcher.js

key-decisions:
  - "The extension exposes `mcp:get-diagnostics` as an internal message route rather than a public MCP tool."
  - "Doctor classification is deterministic and ordered: package, config, bridge, extension, content script, tool routing, healthy."
  - "Status, status --watch, and doctor all render from the same normalized snapshot so copy and field selection cannot drift."

patterns-established:
  - "Extension config is normalized to `modelProvider` and `modelName` even when storage still uses `selectedProvider` and `selectedModel`."
  - "Probe failures are preserved as structured diagnostic notes instead of collapsing the snapshot into one generic error string."

requirements-completed: [DIAG-01, DIAG-02]

duration: 9min
completed: 2026-04-23
---

# Phase 200 Plan 01: Layered Diagnostics and Status Watch Summary

**Layer-aware MCP diagnostics now identify the failing runtime layer and stream a live watch view from the same normalized snapshot.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-23T18:04:24Z
- **Completed:** 2026-04-23T18:13:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added an internal `mcp:get-diagnostics` bridge route that returns bounded active-tab, content-script, and bridge-client state from the extension service worker.
- Rebuilt `mcp-server/src/diagnostics.ts` around a normalized snapshot with version parity checks, probe notes, and deterministic doctor-layer classification.
- Added `status --watch`, compact status field rendering, and doctor output that always starts with `Detected:`, `Why:`, and `Next action:`.
- Added `tests/mcp-diagnostics-status.test.js` to lock the classification order and watch/doctor label contract.

## Task Commits

Implementation work was shipped in one atomic commit because the probe, classifier, renderers, and tests all share the same snapshot surface:

1. **Implement the diagnostics probe, layer classifier, status watch, and regression coverage** - `99ce6ea` (feat)

## Files Created/Modified

- `background.js` - Adds the bounded diagnostics helper built from the existing content-script readiness maps and session bridge state.
- `ws/mcp-tool-dispatcher.js` - Declares the internal `mcp:get-diagnostics` route and forwards it to the background helper.
- `ws/mcp-bridge-client.js` - Sends `mcp:get-diagnostics` through the dispatcher route table.
- `mcp-server/src/diagnostics.ts` - Introduces the normalized diagnostic snapshot, ordered classifier, guidance text, and watch polling helper.
- `mcp-server/src/index.ts` - Adds `status --watch`, shared status/watch/doctor render helpers, and direct-import safety for tests.
- `mcp-server/build/index.js` - Updates the tracked MCP package entry artifact for the new CLI behavior.
- `tests/mcp-diagnostics-status.test.js` - Verifies all supported doctor layers and the required watch/doctor text contract.

## Decisions Made

- The snapshot always carries `diagnosticLayer`, `diagnosticWhy`, and `nextAction` so later recovery-message work can reuse the same vocabulary.
- Content-script diagnosis only triggers for unrestricted active pages, preventing blank/internal tabs from being misclassified as content-script failures.
- `doctor` now exits non-zero whenever the primary diagnosed layer is not `healthy`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 6 - Tight coupling] Combined the plan's two code tasks into one implementation commit**
- **Found during:** Plan execution
- **Issue:** The internal probe, snapshot classification, CLI renderers, and tests all changed the same diagnostic surface, so splitting them would have left one commit in a half-wired state.
- **Fix:** Implemented the full slice together, then verified the shared surface with the new regression test and adjacent MCP contract tests.
- **Files modified:** `background.js`, `ws/mcp-tool-dispatcher.js`, `ws/mcp-bridge-client.js`, `mcp-server/src/diagnostics.ts`, `mcp-server/src/index.ts`, `mcp-server/build/index.js`, `tests/mcp-diagnostics-status.test.js`
- **Verification:** `npm --prefix mcp-server run build`; `node tests/mcp-diagnostics-status.test.js`
- **Committed in:** `99ce6ea`

**2. [Rule 1 - Bug] Restored unrelated generated package drift after rebuilding**
- **Found during:** Verification build
- **Issue:** `npm --prefix mcp-server run build` regenerated unrelated tracked artifacts (`mcp-server/ai/tool-definitions.cjs`, `mcp-server/build/version.*`) outside this plan's scope.
- **Fix:** Kept the tracked `mcp-server/build/index.js` entry artifact that changed for this plan and restored the unrelated generated drift.
- **Files modified:** `mcp-server/build/index.js`
- **Verification:** `git diff --stat`
- **Committed in:** `99ce6ea`

---

**Total deviations:** 2 auto-fixed (1 tight-coupling, 1 bug)
**Impact on plan:** No scope creep. The plan outcome is unchanged and the snapshot/render surface stayed coherent.

## Issues Encountered

- A generic snapshot without the config probe would have looked misconfigured. The classifier was tightened so the config layer only participates when the config probe actually ran or explicitly failed.

## Verification

- `node --check background.js`
- `node --check ws/mcp-tool-dispatcher.js`
- `node --check ws/mcp-bridge-client.js`
- `npm --prefix mcp-server run build`
- `node tests/mcp-diagnostics-status.test.js`
- `node tests/mcp-tool-routing-contract.test.js`
- `node tests/mcp-restricted-tab.test.js`
- `node tests/mcp-bridge-client-lifecycle.test.js`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 200-03 and Plan 200-02. The shared diagnostic vocabulary is now stable enough for version-parity cleanup and layer-aware MCP recovery copy to build on top of it.

---
*Phase: 200-doctor-status-watch-recovery-messaging*
*Completed: 2026-04-23*
