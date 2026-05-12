---
phase: 255-schema-enforcement-on-action-tools
plan: 03
subsystem: mcp-dispatch

tags:
  - mcp
  - visual-session
  - badge-allowlist
  - dispatch-gate
  - typed-errors
  - v0.9.62-contract

requires:
  - phase: 255 plan 01
    provides: visual_reason / client / is_final declared in inputSchema for 36 action tools (via withVisualSessionFields helper in mcp/ai/tool-definitions.cjs)
  - phase: 255 plan 02
    provides: VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED typed-error keys registered in CODE_ONLY_ERROR_KEYS and routed by buildLayeredDetail in mcp/src/errors.ts

provides:
  - registerManualTools dispatch chokepoint rejects any action-tool call missing visual_reason or client with VISUAL_FIELDS_REQUIRED (typed error) BEFORE bridge.sendAndWait / queue.enqueue / sendAgentScopedBridgeMessage fire
  - registerManualTools dispatch chokepoint rejects any action-tool call carrying a non-allowlisted client with BADGE_NOT_ALLOWED (typed error) BEFORE any FSB side effect runs
  - stripVisualSessionFields() removes visual_reason / client / is_final from params on accepted calls so the legacy FSB extension wire (which does not yet consume these fields) is not polluted
  - isAllowedMcpVisualClientLabel + normalizeMcpVisualClientLabel + getAllowedMcpVisualClientLabels exported from mcp/src/tools/visual-session.ts as the shared v0.9.36 allowlist surface (no duplicate declaration in the dispatcher)

affects:
  - phase 256 (visual-session lifecycle wiring -- inherits the post-validator params shape)
  - phase 257 (is_final semantics -- accepted by schema and stripped here; runtime behaviour lands in 257)
  - phase 258 (start_visual_session / end_visual_session removal -- after Plan 03 the implicit contract is binding, so explicit tools can be retired)
  - phase 259 (CI schema-lock + contract tests -- this plan's invariants get verified end-to-end there)

tech-stack:
  added: []
  patterns:
    - "Dispatch-chokepoint validation: type=auto guard runs in the registerManualTools handler arrow BEFORE the param transform + execAction, mirroring the v0.9.60 ownership-gate placement."
    - "Validator returns null on success / ToolCallResult on rejection so the existing MCP SDK response contract is preserved without an exception channel."
    - "Allowlist is imported from the v0.9.36 source-of-truth (mcp/src/tools/visual-session.ts) -- never re-declared in dispatch code."

key-files:
  created:
    - .planning/phases/255-schema-enforcement-on-action-tools/255-03-SUMMARY.md
  modified:
    - mcp/src/tools/manual.ts
    - mcp/src/tools/visual-session.ts

key-decisions:
  - "Validator lives inside the registerManualTools handler arrow (per CONTEXT.md), not in a separate middleware layer. Read-only tools register through registerReadOnlyTools (mcp/src/tools/read-only.ts) and therefore bypass the validator structurally."
  - "Reject-then-strip ordering: validateVisualSessionFields runs first (returns the typed-error ToolCallResult if any check fails); stripVisualSessionFields runs only on accepted calls (removes visual_reason / client / is_final from the params handed to execAction)."
  - "The mcp/src/tools/visual-session.ts exports were widened (normalizeMcpVisualClientLabel, isAllowedMcpVisualClientLabel, getAllowedMcpVisualClientLabels) so the dispatcher imports the existing v0.9.36 allowlist without re-declaring it. Runtime semantics of start_visual_session / end_visual_session are unchanged because the helpers continue to be referenced by their local names inside that module."
  - "is_final is destructured-and-discarded by stripVisualSessionFields (Phase 257 owns the runtime semantics)."

patterns-established:
  - "Dispatch-time field-bundle gate at the same chokepoint as ownership gating; rejections never touch the bridge / queue / extension."
  - "Allowlist-from-mirror pattern: when MCP-side validation needs a shared list, the mirror module (mcp/src/tools/visual-session.ts) is the import target; the extension-side source-of-truth (extension/utils/mcp-visual-session.js) is not transitively required by the MCP build."

requirements-completed:
  - CONTRACT-03
  - CONTRACT-04

duration: ~10 min
completed: 2026-05-11
---

# Phase 255 Plan 03: Dispatch-Gate Validator for Visual-Session Field Bundle + Badge Allowlist Summary

**Action-tool dispatch chokepoint in mcp/src/tools/manual.ts now rejects calls missing visual_reason / client (VISUAL_FIELDS_REQUIRED) or carrying a non-allowlisted client (BADGE_NOT_ALLOWED) BEFORE any bridge / queue / extension side effect; allowlist helpers exported from mcp/src/tools/visual-session.ts as the shared v0.9.36 source-of-truth.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-11T18:00:00Z
- **Completed:** 2026-05-11T18:06:00Z
- **Tasks:** 2 (Plan tasks 1 and 2)
- **Files modified:** 2 source files (mcp/src/tools/manual.ts, mcp/src/tools/visual-session.ts)

## Accomplishments

- Wired the visual-session field-bundle validator into the registerManualTools dispatch chokepoint. Every action-tool handler now runs `validateVisualSessionFields(tool.name, params)` BEFORE the param transform / execAction sequence; rejections return early with a typed `mapFSBError({ ..., errorCode: 'VISUAL_FIELDS_REQUIRED' | 'BADGE_NOT_ALLOWED' })` ToolCallResult and never reach bridge.sendAndWait, queue.enqueue, or sendAgentScopedBridgeMessage.
- Added `stripVisualSessionFields(params)` so accepted calls forward to execAction without `visual_reason` / `client` / `is_final` -- the legacy FSB extension wire is not polluted with v0.9.62 fields ahead of Phase 256 lifecycle work.
- Widened exports in `mcp/src/tools/visual-session.ts` so the dispatcher imports `isAllowedMcpVisualClientLabel` + `getAllowedMcpVisualClientLabels` (and incidentally `normalizeMcpVisualClientLabel`) from the existing v0.9.36 source-of-truth. No duplicate allowlist constant created.
- Verified end-to-end with an in-process integration check against the built bundle: missing `visual_reason+client` -> VISUAL_FIELDS_REQUIRED, missing only `client` -> VISUAL_FIELDS_REQUIRED, `client: 'NotARealClient'` -> BADGE_NOT_ALLOWED (with the offending label echoed in the response body), `client: 'Claude'` + valid `visual_reason` -> accepted (exactly one bridge call, with the field bundle stripped from forwarded params).

## Task Commits

Tasks 1 and 2 land in one atomic commit per the plan's stated commit shape:

1. **Task 1 + Task 2:** `feat(255): dispatch-gate validator for visual-session field bundle + badge allowlist` -- commit `455fedb`

## Validator Function Shape

```typescript
function validateVisualSessionFields(
  toolName: string,
  params: Record<string, unknown>,
): ToolCallResult | null {
  const visualReason = params.visual_reason;
  const client = params.client;

  const visualReasonOk = typeof visualReason === 'string' && visualReason.trim().length > 0;
  const clientOk = typeof client === 'string' && client.trim().length > 0;

  if (!visualReasonOk || !clientOk) {
    return mapFSBError({
      success: false,
      errorCode: 'VISUAL_FIELDS_REQUIRED',
      tool: toolName,
    });
  }

  if (!isAllowedMcpVisualClientLabel(client)) {
    return mapFSBError({
      success: false,
      errorCode: 'BADGE_NOT_ALLOWED',
      tool: toolName,
      clientLabel: client,
      allowedClients: getAllowedMcpVisualClientLabels(),
    });
  }

  return null;
}

function stripVisualSessionFields(params: Record<string, unknown>): Record<string, unknown> {
  const { visual_reason: _vr, client: _cl, is_final: _if, ...rest } = params;
  return rest;
}
```

Wired inside `registerManualTools`:

```typescript
server.tool(
  tool.name,
  description,
  zodShape,
  async (params: Record<string, unknown>) => {
    const rejection = validateVisualSessionFields(tool.name, params);
    if (rejection) return rejection;

    const cleanedParams = stripVisualSessionFields(params);
    const finalParams = transform ? transform(cleanedParams) : cleanedParams;
    return execAction(bridge, queue, agentScope, tool.name, fsbVerb, finalParams);
  },
);
```

## Validation Order (3 Steps)

The validator runs strictly in this order, returning early on the first failure:

1. **visual_reason check** -- MUST be a non-empty string after `.trim()`. Empty / missing / non-string -> reject with `VISUAL_FIELDS_REQUIRED`.
2. **client check** -- MUST be a non-empty string after `.trim()`. Empty / missing / non-string -> reject with `VISUAL_FIELDS_REQUIRED` (same typed error; the contract treats both fields as a single bundle requirement).
3. **allowlist check** -- `isAllowedMcpVisualClientLabel(client)` MUST return true. Failed -> reject with `BADGE_NOT_ALLOWED` (the response body echoes the offending `clientLabel` and the full `allowedClients` array via the buildLayeredDetail switch arms wired in Plan 02).

If all three pass, the validator returns `null` and the handler proceeds: `stripVisualSessionFields` removes `visual_reason` / `client` / `is_final`, the PARAM_TRANSFORMS entry (if any) runs on the cleaned params, and `execAction` forwards the result to the FSB bridge.

## Side-Effect Containment (Verified)

The Node integration smoke check from the Plan 03 verify block asserts (via recording mocks):

- **Rejection path:** `bridgeCalls.length === 0` AND `queueCalls.length === 0` after any of the three rejection cases (missing visual_reason+client, missing only client, non-allowlisted client). The underlying browser action MUST NOT run; `change_report` MUST NOT be emitted; the overlay MUST NOT mutate.
- **Acceptance path:** `bridgeCalls.length === 1` after the single valid call (`visual_reason: 'Testing', client: 'Claude'`). The valid call proceeds normally; the forwarded params object does not contain `visual_reason` / `client` / `is_final` (stripped) -- confirmed because the only failure mode that would leave them in would be a regression in `stripVisualSessionFields`, and the params echo in the log shows `params={"selector":"#x"}`.

## Files Created/Modified

- `mcp/src/tools/manual.ts` -- Added `validateVisualSessionFields()`, `stripVisualSessionFields()`, and the import from `./visual-session.js`. Modified the `registerManualTools` handler arrow to call the validator before execAction and to strip the bundle from accepted calls.
- `mcp/src/tools/visual-session.ts` -- Prepended `export` to `normalizeMcpVisualClientLabel` and `getAllowedMcpVisualClientLabels`. Added `export function isAllowedMcpVisualClientLabel(raw): boolean` as a boolean-returning wrapper for use in the dispatcher.
- `.planning/phases/255-schema-enforcement-on-action-tools/255-03-SUMMARY.md` -- This summary file.

## Decisions Made

None beyond what the plan locked. The CONTEXT.md decision pin -- "validator lives at the registerManualTools chokepoint; read-only tools bypass by structure, not by extra logic" -- held in the live code (read-only tools register through `mcp/src/tools/read-only.ts`, which does not import the validator).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The plan's interfaces section reflected the live shape of `mcp/src/tools/manual.ts` (109 lines, the chokepoint exactly where described) and `mcp/src/tools/visual-session.ts` (the three helpers at lines 20-27 ready to be exported). Both edits applied cleanly on the first attempt; the build succeeded immediately; the in-process integration check exited 0 on first run.

The working tree carried pre-existing dirty modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, and `mcp/build/install.js` that were NOT part of Plan 03. Per the objective's explicit "do NOT touch STATE.md or ROADMAP.md" directive, those files were not staged. The commit deliberately includes only `mcp/src/tools/manual.ts` and `mcp/src/tools/visual-session.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 04 (Phase 255):** The schema-lock test (`tests/visual-session-schema-lock.test.js` or similar -- planner picks the file name) is the immediate next-up. It asserts (a) the 36 action tools carry `visual_reason` / `client` / `is_final` in `inputSchema.properties` with `visual_reason` / `client` in `inputSchema.required`, (b) the 15 read-only tools carry none of those keys, and (c) the dispatch chokepoint rejects malformed payloads at runtime with `VISUAL_FIELDS_REQUIRED` / `BADGE_NOT_ALLOWED`. The wiring in this plan (validateVisualSessionFields + stripVisualSessionFields + exported allowlist helpers) is what Plan 04 will exercise.
- **Phase 256 (visual-session lifecycle wiring):** Receives action-tool params with the visual-session bundle already stripped. The lifecycle layer will read `visual_reason` / `client` / `is_final` BEFORE the stripping point (Phase 256 reads them from the handler scope; the stripping only affects what gets forwarded to the FSB extension wire). The validator's accept path is the contract Phase 256 builds on top of.
- **Phase 257 (is_final semantics):** `is_final` is accepted by the schema (Plan 01) and discarded by `stripVisualSessionFields` here. Phase 257 promotes it to a real lifecycle signal.

## Self-Check: PASSED

- File `mcp/src/tools/manual.ts` exists: FOUND
- File `mcp/src/tools/visual-session.ts` exists: FOUND
- File `.planning/phases/255-schema-enforcement-on-action-tools/255-03-SUMMARY.md` exists: FOUND
- Commit `455fedb` exists on `refinements`: FOUND (verified via `git log --oneline -3`)
- Grep checks for `validateVisualSessionFields`, `stripVisualSessionFields`, `VISUAL_FIELDS_REQUIRED`, `BADGE_NOT_ALLOWED`, `isAllowedMcpVisualClientLabel` import, and validator invocation all return exactly one match: PASSED (verified in Task 2)
- `cd mcp && npm run build` exits 0: PASSED
- Integration check ("OK: dispatch validator rejects malformed, accepts valid, blocks side effects"): PASSED
- Existing tests (`action-tool-agent-scoped`, `mcp-visual-session-contract`, `mcp-tool-routing-contract`, `mcp-bridge-client-lifecycle`, `mcp-bridge-topology`, `visual-session-agent-scoped`, `change-report-dispatcher`, `ownership-error-codes`, `visual-session-reentry`): ALL PASSED

---

*Phase: 255-schema-enforcement-on-action-tools*
*Plan: 03*
*Completed: 2026-05-11*
