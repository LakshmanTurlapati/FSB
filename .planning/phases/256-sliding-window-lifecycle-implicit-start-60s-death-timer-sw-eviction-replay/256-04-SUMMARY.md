---
phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay
plan: 04
subsystem: testing
tags: [chrome-extension, mv3, chrome-alarms, chrome-storage-session, mcp, lifecycle, unit-tests, ci-gate, npm-test-chain]

# Dependency graph
requires:
  - phase: 256-01
    provides: extension/utils/mcp-visual-session-lifecycle.js (recordVisualSessionTick, clearVisualSession, handleVisualSessionLifecycleAlarm, handleVisualSessionLifecycleTabRemoved, restoreVisualSessionLifecyclesFromStorage; MCP_VISUAL_LIFECYCLE_STORAGE_KEY_PREFIX, MCP_VISUAL_LIFECYCLE_ALARM_PREFIX, MCP_VISUAL_LIFECYCLE_DEATH_MS)
  - phase: 256-02
    provides: bridge payload visualSession sidecar { visualReason, client, isFinal } -- referenced indirectly via the helper signatures the tests exercise
  - phase: 256-03
    provides: SW-side integration sites (chrome.alarms.onAlarm, chrome.tabs.onRemoved, SW-boot restore) that the lifecycle module's surface is now wired into; unit tests here lock the helper-level guarantees those integration sites depend on
  - phase: 255-04
    provides: tests/visual-session-schema-lock.test.js precedent + slot in the npm test chain; the lifecycle test slots immediately after to keep the visual-session test family adjacent
provides:
  - tests/mcp-visual-tick-lifecycle.test.js: unit-level CI lock for every TIMEOUT REQ-ID (01-05) plus two defense-in-depth duals (client allowlist re-check, agent-mismatch belt-and-suspenders) and one structural shape assertion (no read-tool surface)
  - package.json scripts.test chain wired so npm test runs the lifecycle test on every PR
  - 62 grep-verifiable assertions across 9 cases (A through I) covering implicit start, sliding re-arm, agent-mismatch rejection, auto-clear on deadline, reschedule on early fire, SW-eviction replay with deadline preservation, tab-close cleanup, allowlist defense-in-depth, and module surface shape
affects:
  - phase-257 (is_final runtime semantics will plug into the same recordVisualSessionTick path; the case-set here grandfathers in the entry-shape it observes)
  - phase-258 (explicit start_visual_session removal relies on the implicit lifecycle being trustworthy; CI lock catches any drift before removal lands)
  - phase-259 (e2e contract test will exercise live overlay timing; unit tests here free the e2e test to focus on rendering, animation, and real chrome.alarms precision)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createChromeMock + createStorageArea pattern (in-memory chrome.storage.session + chrome.alarms fakes) copied verbatim from tests/mcp-bridge-client-lifecycle.test.js lines 118-146"
    - "Lifecycle module re-import per case via delete require.cache[LIFECYCLE_MODULE_PATH] so the IIFE rebinds against a fresh global.chrome + fresh global.sendSessionStatus, giving each case full isolation"
    - "Fake sendSessionStatus capture buffer (capturedStatusBroadcasts) installed on the Node global; lets cases assert on broadcast count, target tabId, and statusData.clientLabel / statusData.phase"
    - "Per-case explicit reset of broadcast buffer between sub-asserts (e.g., Case D resets after the create-broadcast so the clear-broadcast count is unambiguous)"

key-files:
  created:
    - "tests/mcp-visual-tick-lifecycle.test.js (411 lines, 62 assertions, ASCII-only, Node stdlib only)"
  modified:
    - "package.json (one-line edit: inserted `node tests/mcp-visual-tick-lifecycle.test.js &&` between visual-session-schema-lock.test.js and agent-id-threading.test.js in scripts.test)"

key-decisions:
  - "Harness isolation via require.cache eviction: each setupHarness() call deletes require.cache[LIFECYCLE_MODULE_PATH] and reassigns global.chrome + global.sendSessionStatus + global.MCPVisualSessionUtils before re-requiring. The lifecycle module's IIFE captures the global at evaluation time -- without cache eviction, Case B would inherit Case A's stale chrome mock and the alarm assertions would fail spuriously."
  - "Case F seeds three storage entries (live, elapsed, malformed) to lock all three branches of restoreVisualSessionLifecyclesFromStorage in a single pass; the malformed entry omits agentId so the helper's `typeof entry.agentId !== 'string'` branch fires and increments counters.dropped."
  - "Case D forces the deadline into the past by direct storage mutation (entry.deadlineAt = Date.now() - 1000) rather than waiting 60 seconds; this is deterministic and keeps the test fast. The plan recommended this approach."
  - "Case I asserts both presence (8 expected exports) and absence (3 forbidden read-tool surface names) so the module's contract is structurally locked against accidental drift. Adding any of recordReadOnlyTick / handleReadOnlyTool / readToolNoOp to the lifecycle module would fail the CI gate immediately."
  - "Slot the new test BEFORE agent-id-threading.test.js (not appended to the chain end) so the visual-session test family stays contiguous: visual-session-schema-lock -> mcp-visual-tick-lifecycle -> agent-id-threading. Mirrors the Phase 255 Plan 04 precedent."

patterns-established:
  - "Helper-level CI lock for lifecycle modules: a Node-runnable unit test that exercises every public export, every documented branch, every threat-model mitigation, AND every named REQ-ID as a separately grep-verifiable assertion is the established gate against drift between PLAN intent and live source."
  - "Cases A-I taxonomy: each lifecycle helper gets at least one explicit case; defense-in-depth duals (Case C agent-mismatch, Case H client-not-allowed) get their own cases distinct from the happy-path cases; module surface shape (Case I) is a structural guard."
  - "Test file is grep-friendly: every REQ-ID appears verbatim (TIMEOUT-01 ... TIMEOUT-05), every error reason appears verbatim (agent_mismatch, client_not_allowed), every case header carries a single-line summary so `grep -E '^---' tests/mcp-visual-tick-lifecycle.test.js` enumerates the case set."

requirements-completed: [TIMEOUT-01, TIMEOUT-02, TIMEOUT-03, TIMEOUT-04, TIMEOUT-05]

# Metrics
duration: ~3min
completed: 2026-05-11
---

# Phase 256 Plan 04: Lifecycle Unit Tests Summary

**Helper-layer CI lock for every TIMEOUT REQ-ID (01-05) is live: 62 assertions across 9 cases cover implicit start, sliding re-arm, auto-clear, SW-eviction replay, ownership-gate defense-in-depth, allowlist defense-in-depth, tab-close cleanup, and module surface shape -- all running on every PR via the root npm test chain.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-11T18:57:17Z
- **Completed:** 2026-05-11T19:00:24Z
- **Tasks:** 3 (Tasks 1 and 2 produced commits; Task 3 is verification-only)
- **Files modified:** 2 (one created, one one-line edit)

## Accomplishments

- New `tests/mcp-visual-tick-lifecycle.test.js` (411 lines, 62 assertions, all green) covers every TIMEOUT REQ-ID at the helper level with grep-verifiable case names and explicit REQ-ID citations in each case header.
- The test exercises every public export of `extension/utils/mcp-visual-session-lifecycle.js` (recordVisualSessionTick happy + 2 rejection branches; handleVisualSessionLifecycleAlarm at-or-after-deadline + before-deadline; handleVisualSessionLifecycleTabRemoved; restoreVisualSessionLifecyclesFromStorage with live + elapsed + malformed entries) using only Node stdlib + an in-memory chrome.storage.session + chrome.alarms fake.
- `package.json scripts.test` chains the new test between `visual-session-schema-lock.test.js` and `agent-id-threading.test.js`, keeping the visual-session test family adjacent in the chain. `npm test` exits 0 from the repo root.
- Module surface shape is now structurally locked (Case I): the lifecycle module exports exactly 5 functions + 3 constants and exposes NO read-tool surface (no recordReadOnlyTick, no handleReadOnlyTool, no readToolNoOp). Adding any of those would fail CI immediately.

## Task Commits

Each task was committed atomically on the refinements branch:

1. **Task 1: author tests/mcp-visual-tick-lifecycle.test.js (cases A through I)** -- `83704b2` (test)
2. **Task 2: wire the test into package.json scripts.test** -- `3333395` (chore)
3. **Task 3: verify `npm test` exits 0** -- verification-only (no commit; verified locally)

_Note: Per the plan, Task 3 is intentionally verification-only -- it has no `<files>` element; the source edits that produced the locked behaviour are Plans 01-03._

## Files Created/Modified

- `tests/mcp-visual-tick-lifecycle.test.js` (created, 411 lines) -- Node-runnable unit test. Header docblock cites `.planning/v0.9.62-CONTRACT.md` and all 5 TIMEOUT REQ-IDs. Harness uses createChromeMock + createStorageArea (verbatim copy from tests/mcp-bridge-client-lifecycle.test.js lines 118-146 with an added `_keys()` helper). Each `setupHarness()` call evicts the lifecycle module from require.cache and reassigns `global.chrome` + `global.MCPVisualSessionUtils` + `global.sendSessionStatus` so the IIFE rebinds against fresh globals. ASCII-only.
- `package.json` (modified, +1/-1 line) -- inserted `node tests/mcp-visual-tick-lifecycle.test.js &&` into the `scripts.test` chain between `node tests/visual-session-schema-lock.test.js && ` and ` node tests/agent-id-threading.test.js &&`. Net diff is exactly one inserted substring.

## Decisions Made

See key-decisions in the frontmatter. The plan's `<action>` blocks specified the case shapes verbatim; the executor's discretion was limited to:

1. **The malformed-entry shape in Case F**: chose to omit `agentId` (a required field per the restore helper's well-formedness check) to deterministically trigger the dropped branch. Plans's bullet F is satisfied either way; this picks the cleanest signal.
2. **Adding Case I.3-I.5 constant assertions**: the plan's Case I block ended at the I.1 + I.2 export presence/absence checks; the executor extended with three trivial constant-value assertions (storage prefix, alarm prefix, death TTL) to lock the contract values too. These are zero-cost and increase the gate's drift resistance.

## Deviations from Plan

None -- plan executed exactly as written.

The plan's Task 1 verification (grep-verifiable presence of cases A-I) ran clean against the emitted source on the first invocation. All 62 assertions passed on the first standalone run. `npm test` from the repo root exited 0 with no pre-existing regressions.

## Issues Encountered

None.

## Verification Results

All plan-level verification gates pass:

- `node tests/mcp-visual-tick-lifecycle.test.js` standalone: 62 passed, 0 failed, exit 0.
- Task 1 grep-verifier: all 9 cases (A through I) present and grep-verifiable in the test source (REQ-IDs TIMEOUT-01..05, error reasons agent_mismatch + client_not_allowed, action descriptors rescheduled + tab close, structural-precluded note for read-tool surface).
- Task 2 verifier: lifecycle test slotted between schema-lock and agent-id-threading in `package.json scripts.test`, exactly one occurrence.
- Task 3 verifier: `npm test` exits 0 from repo root; the lifecycle test's `=== Results: 62 passed, 0 failed ===` line appears in the full-chain stdout.
- ASCII-only enforcement: 0 non-ASCII bytes in the test file (verified via codepoint scan).

## Self-Check: PASSED

- File `tests/mcp-visual-tick-lifecycle.test.js` exists at the planned path.
- File `package.json` contains exactly one occurrence of `node tests/mcp-visual-tick-lifecycle.test.js` in the test chain.
- Commit `83704b2` exists (Task 1 -- test file authored).
- Commit `3333395` exists (Task 2 -- npm test chain wire-in).
- Full `npm test` exits 0; lifecycle test's results line appears in stdout.

## Threat Flags

None -- Plan 04 introduces no new runtime surface. The test file uses Node stdlib only (no new dependencies, no network calls, no file writes outside `/tmp`), and the package.json edit is one chained-command insertion with no environment or permission changes. All four plan-level threat dispositions are honoured:

- T-256-04-01 (test-fixture-data-drifting-from-Plan-01-storage-shape): mitigated by Cases A.2-A.10 asserting on every field of the documented entry shape (tabId, agentId, client, visualReason, startedAt, lastTickAt, deadlineAt, isFinal) and the alarm-name + when arithmetic.
- T-256-04-02 (lifecycle-module-growing-a-forbidden-read-tool-surface): mitigated by Case I.2 explicitly enumerating the forbidden export names and asserting absence.
- T-256-04-03 (test-logs-leaking-caller-supplied-visualReason-text): accepted -- fixtures use harmless strings (Logging in, Step 1, etc.).
- T-256-04-04 (test-hangs-on-async-pending-promise): mitigated -- every async call awaits explicitly; the outer IIFE has no infinite loops; standard `process.exit(failed > 0 ? 1 : 0)` at the end.

## Next Phase Readiness

The CI gate for Phase 256 helper-level guarantees is live. Phase 257 (is_final runtime semantics) can extend `recordVisualSessionTick` and `clearVisualSession` confident that any regression in the existing TIMEOUT-01..05 invariants surfaces immediately as a failing CI assertion. Phase 258 (explicit start_visual_session removal) can rely on the implicit lifecycle being trustworthy; CI catches any drift before the removal lands. Phase 259 (end-to-end overlay contract test) is unblocked at the helper layer -- the e2e plan can focus on live rendering, animation timing, and real chrome.alarms precision without re-litigating the helper-level invariants this test now owns.

Phase 256 is now feature-complete at the helper + integration + test layers. STATE.md and ROADMAP.md updates are explicitly OUT OF SCOPE for this plan per the orchestrator's instructions.

## Self-Check: PASSED (post-write verification)

- FOUND: tests/mcp-visual-tick-lifecycle.test.js (planned path)
- FOUND: .planning/phases/256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay/256-04-SUMMARY.md (this file)
- FOUND: commit 83704b2 (Task 1 -- test authored)
- FOUND: commit 3333395 (Task 2 -- npm test chain wire-in)
- SUMMARY is ASCII-only (0 non-ASCII bytes; 147 lines)

---
*Phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay*
*Completed: 2026-05-11*
