---
phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay
plan: 02
subsystem: mcp-server
tags: [mcp, visual-session, sidecar, bridge-payload, v0.9.62]

# Dependency graph
requires:
  - phase: 255-schema-enforcement-on-action-tools
    provides: validateVisualSessionFields + stripVisualSessionFields chokepoint inside mcp/src/tools/manual.ts; this plan inserts the sidecar builder between them without altering either.
  - phase: 254-contract-foundation
    provides: pinned field-bundle keys (visual_reason, client, is_final) and the badge-allowlist citation; the sidecar uses them verbatim as inputs.
  - plan: 256-01
    provides: extension-side lifecycle helpers under MCPVisualSessionLifecycleUtils that this sidecar will feed in Plan 03.
provides:
  - mcp/src/tools/manual.ts now forwards { visualReason, client, isFinal } as a top-level `visualSession` sidecar on every mcp:execute-action bridge payload (sibling of agentId / ownershipToken / connectionId).
  - buildVisualSessionSidecar(params) helper inside manual.ts that re-normalises the caller-supplied client label to canonical casing as a defense-in-depth tampering mitigation.
  - execAction signature grows a 7th parameter `visualSession: VisualSessionSidecar | null` so the bridge payload base object can carry the sidecar.
affects: [256-03-extension-dispatcher-integration, 256-04-tests, 257-is-final-runtime-semantics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sidecar top-level fields on the bridge payload base object mirror the existing agentId / ownershipToken / connectionId convention from mcp/src/agent-bridge.ts buildAgentPayload."
    - "Wire-side camelCase (visualReason / client / isFinal) vs schema-side snake_case (visual_reason / client / is_final): the boundary helper converts between the two at the chokepoint."
    - "Defense-in-depth canonicalisation: the sidecar re-runs normalizeMcpVisualClientLabel on caller input so the extension-side lifecycle code receives the CANONICAL label, not the caller-supplied string."

key-files:
  created: []
  modified:
    - mcp/src/tools/manual.ts

key-decisions:
  - "Sidecar field name pinned to `visualSession` (camelCase, singular). Matches the existing agent-bridge.ts wire conventions (agentId, ownershipToken, connectionId) and is what Plan 03 will read."
  - "Inner field names pinned to camelCase: visualReason / client / isFinal. The CONTRACT.md keeps the schema-side names in snake_case; the boundary helper does the conversion exactly once at the chokepoint."
  - "Sidecar built from ORIGINAL caller params BEFORE the Phase 255 strip helper runs. The strip helper continues to scrub the same three keys from the action params shipped under `params`; the sidecar carries them as a top-level sibling."
  - "Re-normalise the caller-supplied client label via normalizeMcpVisualClientLabel inside the sidecar builder. This guarantees the extension-side lifecycle code receives the canonical label even though Phase 255's validator already confirmed the label is on the allowlist (T-256-02-01 tampering mitigation)."
  - "Sidecar typed as `VisualSessionSidecar | null` even though the chokepoint always builds a non-null value. The null option preserves a clean signature for any future read-only path that might call execAction (currently none; read-only tools route through read-only.ts)."
  - "Validator-first ordering preserved verbatim: validateVisualSessionFields runs FIRST, rejections short-circuit BEFORE the sidecar builder is ever called and BEFORE execAction is ever invoked. Phase 255 invariants are byte-stable."

patterns-established:
  - "Field-bundle key conversion happens at the boundary helper only. The schema layer keeps snake_case; the wire layer uses camelCase. Future bundles that span both layers should follow the same single-conversion-point pattern."
  - "When growing a payload that already has top-level fields (agentId / ownershipToken / connectionId), new fields go at the same top level (not nested inside `params`). This keeps the bridge wire flat and lets each consumer pick out exactly the fields it needs."

requirements-completed: [TIMEOUT-01, TIMEOUT-05]

# Metrics
duration: ~14min
completed: 2026-05-11
---

# Phase 256 Plan 02: MCP-Side Sidecar Forwarding Summary

**The Phase 255 validate-then-strip chokepoint now also forwards the validated field bundle to the extension as a top-level `visualSession` sidecar on every mcp:execute-action bridge payload, preserving the strip pattern verbatim.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-11 (post Plan 01)
- **Completed:** 2026-05-11
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `mcp/src/tools/manual.ts` grew a new `buildVisualSessionSidecar(params)` helper next to `stripVisualSessionFields`. JSDoc cites `.planning/v0.9.62-CONTRACT.md` lines 70-86 (Field Bundle section) as the source-of-truth for the field names. The helper extracts `visual_reason` / `client` / `is_final` from the ORIGINAL caller params, trims the reason, re-normalises the client label to canonical casing via `normalizeMcpVisualClientLabel`, defaults `isFinal` to `false`, and returns `{ visualReason, client, isFinal }`.
- The existing import from `./visual-session.js` was extended to also pull in `normalizeMcpVisualClientLabel` (already exported per Phase 255 Plan 03).
- `execAction` signature grew a 7th parameter `visualSession: VisualSessionSidecar | null`. Inside `queue.enqueue`, the existing inline object `{ tool: fsbVerb, params }` was lifted to a named `basePayload` local; when `visualSession` is truthy it is attached at the top level (`basePayload.visualSession = visualSession`) so it lands as a sibling of `agentId` / `ownershipToken` / `connectionId` in `agent-bridge.ts:buildAgentPayload`.
- The server.tool chokepoint arrow now: (1) runs `validateVisualSessionFields` first and short-circuits on rejection, (2) builds the sidecar from the ORIGINAL params, (3) runs the Phase 255 `stripVisualSessionFields` helper on `params`, (4) calls `execAction` with the cleaned params AND the sidecar.
- The bridge wire shape for every action-tool call is now:
  ```
  {
    type: 'mcp:execute-action',
    payload: {
      tool: '<fsb-verb>',
      params: { <action params; visual fields stripped> },
      visualSession: { visualReason, client, isFinal },
      agentId: 'agent_<uuid>',
      ownershipToken?: '...',
      connectionId?: '...'
    }
  }
  ```
- All Phase 255 invariants are preserved verbatim: the strip helper still runs, `stripVisualSessionFields` still has 2 occurrences in the file (unchanged from Phase 255), `validateVisualSessionFields` still has 4 occurrences (unchanged), rejections still short-circuit before any bridge invocation.

## Task Commits

Each task was committed atomically on the `refinements` branch:

1. **Task 1: Add buildVisualSessionSidecar helper and thread the sidecar through execAction into the bridge payload** -- `1cf0eb0` (feat)

**Plan metadata commit:** intentionally omitted per executor instructions (STATE.md and ROADMAP.md are NOT touched in this plan).

## Files Created/Modified

- `mcp/src/tools/manual.ts` (modified) -- four scoped edits: import extension on line 13, new `buildVisualSessionSidecar` helper + `VisualSessionSidecar` type after `stripVisualSessionFields`, `execAction` signature grew a 7th param + body lifts `basePayload` and attaches the sidecar, chokepoint arrow inserts the sidecar build between validator and strip. Total diff: 74 insertions, 3 deletions.

## Decisions Made

- **Sidecar name `visualSession` and inner field names `visualReason / client / isFinal`** -- pinned to match the camelCase wire conventions already used at the same top level by `agent-bridge.ts` (`agentId`, `ownershipToken`, `connectionId`). The schema layer keeps `visual_reason / client / is_final` per `.planning/v0.9.62-CONTRACT.md`; the boundary helper converts at the chokepoint exactly once.
- **Capture sidecar from ORIGINAL params, BEFORE the strip helper** -- the strip removes the keys from `params`, so the sidecar MUST be built before that. The chokepoint arrow makes this ordering explicit: validate -> build sidecar -> strip -> dispatch.
- **Re-normalise client inside the sidecar builder** -- even though `validateVisualSessionFields` already gates `client` against the allowlist via `isAllowedMcpVisualClientLabel`, the sidecar builder calls `normalizeMcpVisualClientLabel` again to ship the CANONICAL casing. This mitigates T-256-02-01 (caller-supplied label drift) and is what Plan 03's extension-side lifecycle code will read.
- **Sidecar typed as `VisualSessionSidecar | null` on the execAction signature** -- defensive shape that keeps execAction's signature clean for any future read-only call path. The chokepoint currently always builds a non-null sidecar; the null branch is belt-and-suspenders.
- **No reformatting churn** -- the scoped edits inserted exactly the four blocks called out in the plan. Every other line of the file is byte-identical to Phase 255 Plan 03's checkpoint.

## Deviations from Plan

None -- plan executed exactly as written. The four scoped edits enumerated in the plan's `<action>` block landed verbatim with no auto-fixes required.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Plan 03 (extension-side dispatcher integration) is now unblocked. The bridge payload it will receive on the `mcp:execute-action` listener now carries a top-level `visualSession` object alongside `agentId`. Plan 03 reads `visualSession`, runs the v0.9.60 ownership gate, and feeds the bundle into `MCPVisualSessionLifecycleUtils.recordVisualSessionTick(...)` (from Plan 01).

The wire is end-to-end ready: schema -> validator -> sidecar -> bridge -> (Plan 03 listener) -> lifecycle helpers -> overlay.

## Threat Flags

None -- no new security-relevant surface beyond what the plan's threat register already covered (T-256-02-01 through T-256-02-05). The sidecar lives on the existing local-only ws://localhost:7225 bridge surface and carries already-validated fields.

## Self-Check: PASSED

Verification commands run against the committed state:

- `mcp/src/tools/manual.ts` exists and the four scoped changes landed verbatim. FOUND.
- `npm --prefix mcp run build` exits 0. FOUND.
- `mcp/build/tools/manual.js` contains the `visualSession` reference. FOUND.
- All 8 plan automated-check regexes PASS (buildVisualSessionSidecar function declared, normalizeMcpVisualClientLabel imported, execAction grows visualSession param, basePayload object built, sidecar attached when present, validator still runs first, stripVisualSessionFields still runs after build, execAction call grows 7th arg).
- Order check `awk` output: validator on line 237, buildSidecar on line 247, strip on line 249. Ascending order preserved.
- `grep -c "buildVisualSessionSidecar"` returns 2 (declaration + call site).
- `grep -c "stripVisualSessionFields"` returns 2 (UNCHANGED from Phase 255).
- `grep -c "validateVisualSessionFields"` returns 4 (UNCHANGED from Phase 255).
- `tests/visual-session-schema-lock.test.js`: 314 passed, 0 failed.
- `tests/agent-id-threading.test.js`: 26 passed, 0 failed.
- `tests/tool-definitions-parity.test.js`: 142 passed, 0 failed.
- `npm test`: exits 0 (full chain, no regressions).
- Runtime wire check via mock bridge: valid call produces `{ tool, params (stripped), visualSession: { visualReason: 'Submitting checkout form', client: 'Claude', isFinal: true }, agentId }`; rejection path (missing fields) still short-circuits without invoking the bridge.
- Commit `1cf0eb0` exists on `refinements`. FOUND.

---
*Phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay*
*Plan: 02*
*Completed: 2026-05-11*
