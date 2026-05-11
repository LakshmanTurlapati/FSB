---
phase: 258
plan: 01
subsystem: mcp/visual-session
tags:
  - mcp
  - visual-session
  - typed-error
  - removal
  - breaking-change
  - tool-removed
  - migration-recipe
requirements_completed:
  - MIGRATION-01
  - MIGRATION-02
dependency_graph:
  requires:
    - 255-02 (CODE_ONLY_ERROR_KEYS scaffolding + VISUAL_FIELDS_REQUIRED / BADGE_NOT_ALLOWED precedent)
    - 255-03 (manual.ts dispatch validator import of isAllowedMcpVisualClientLabel + getAllowedMcpVisualClientLabels)
    - 257 (implicit visual session contract end-to-end; callers have a working path forward)
  provides:
    - TOOL_REMOVED typed error registered in mcp/src/errors.ts (CODE_ONLY_ERROR_KEYS + buildLayeredDetail)
    - start_visual_session stub returning TOOL_REMOVED via mapFSBError
    - end_visual_session stub returning TOOL_REMOVED via mapFSBError
    - structured rejection path for callers invoking removed tools (synchronous, bridge-independent)
  affects:
    - downstream MCP clients reading tools/list (stubs remain advertised with [REMOVED in v0.9.0] banner)
    - 258-02 (version bump still depends on file shape; this plan does not bump versions)
    - 258-03 (CHANGELOG + mcp/README anchors -- the TOOL_REMOVED body cites the anchors that 258-03 lands)
    - 259 (broader test rewrites -- a TOOL_REMOVED contract test is Phase 259's responsibility)
tech_stack:
  added: []
  patterns:
    - typed-error registration via CODE_ONLY_ERROR_KEYS Set
    - bespoke buildLayeredDetail switch arm with context-sensitive why-string
    - synchronous stub handler short-circuiting before queue/bridge
    - tool description banner advertising removal status in tools/list
key_files:
  created: []
  modified:
    - mcp/src/errors.ts
    - mcp/src/tools/visual-session.ts
decisions:
  - "TOOL_REMOVED body shape pinned: fsbResult fields removed_tool (literal name) and removed_in_version ('0.9.0') consumed by buildLayeredDetail; mapFSBError routes through resolveErrorKey -> CODE_ONLY_ERROR_KEYS -> bespoke switch arm."
  - "Stubs ignore all inputs (async () => ...) and return mapFSBError synchronously -- no queue.enqueue, no bridge.isConnected check, no sendAgentScopedBridgeMessage call. Rationale: a caller invoking a removed tool gets the migration recipe even when the extension is offline."
  - "The unused sendAgentScopedBridgeMessage import on line 6 of visual-session.ts is deleted. WebSocketBridge / TaskQueue / AgentScope imports + parameters preserved because the registerVisualSessionTools signature is shared with mcp/src/index.ts and changing it is out of scope."
  - "Tool registrations preserved (not deleted) so MCP tools/list still advertises the names with the [REMOVED in v0.9.0] banner -- callers receive a STRUCTURED rejection instead of a generic 'tool not found' surface (per 258-CONTEXT.md decision)."
  - "Stub-comment phrasing avoids the literal substrings 'queue.enqueue' and 'bridge.isConnected' so the grep-verifiable acceptance criteria (count must be 0 in the source file) hold strictly. Behavioural intent is preserved -- comments now say 'BEFORE the task queue' and 'BEFORE the bridge connectivity check'."
metrics:
  duration_seconds: 228
  duration_human: "3m 48s"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_created: 1
  commit_count: 1
  completed_at: "2026-05-11T19:43:33Z"
---

# Phase 258 Plan 01: Stub Conversion + TOOL_REMOVED Typed Error Summary

Convert `start_visual_session` and `end_visual_session` MCP tool registrations into synchronous TOOL_REMOVED-returning stubs and register `TOOL_REMOVED` as a first-class typed error in `mcp/src/errors.ts`. Lands MIGRATION-01 (removal) and MIGRATION-02 (typed error with migration recipe pointer) as an inseparable pair on the way to v0.9.62 implicit visual-session contract.

## What Shipped

### 1. mcp/src/errors.ts -- TOOL_REMOVED typed error registered

Three changes inside one file:

- **CODE_ONLY_ERROR_KEYS Set extended** -- added `'TOOL_REMOVED'` under a Phase 258 trailing comment, as the third v0.9.62-milestone entry (joins `VISUAL_FIELDS_REQUIRED` and `BADGE_NOT_ALLOWED` from Phase 255 Plan 02). Set member count grows from 10 to 11.

- **buildLayeredDetail local-const block extended** -- two new fsbResult-field reads at the end of the const block (immediately before the `switch (errorKey)` line):
  - `const removedTool = typeof fsbResult?.removed_tool === 'string' ? fsbResult.removed_tool : '';`
  - `const removedInVersion = typeof fsbResult?.removed_in_version === 'string' ? fsbResult.removed_in_version : '0.9.0';`

- **buildLayeredDetail switch arm added** -- `case 'TOOL_REMOVED':` inserted between the existing `BADGE_NOT_ALLOWED` arm and the `visual_session_not_found` arm so all visualSession-layer v0.9.62 typed errors stay visually grouped. Shape:
  - `detected: LAYER_LABELS.visualSession`
  - `why`: context-sensitive on `removedTool` (names the literal tool name + version, e.g. `The start_visual_session tool was removed in v0.9.0 of fsb-mcp-server`)
  - `nextAction`: names the new implicit contract verbatim per `.planning/v0.9.62-CONTRACT.md` Typed Errors section -- required `visual_reason` + `client` field bundle, sliding 60-second window, `is_final: true` for early clear; cites `CHANGELOG.md#v0.9.0` and the Visual Session Lifecycle section of `mcp/README.md` as the migration recipe anchors.

No new `LAYER_LABELS` entry, no new helper function, no new import. Existing Phase 255 Plan 02 entries (`VISUAL_FIELDS_REQUIRED`, `BADGE_NOT_ALLOWED`) and v0.9.60 entries (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, ...) unchanged.

### 2. mcp/src/tools/visual-session.ts -- two TOOL_REMOVED-returning stubs

Three changes inside one file:

- **Unused import removed** -- `import { sendAgentScopedBridgeMessage } from '../agent-bridge.js';` (line 6) deleted; the stubs no longer ship bridge messages and no other code in this module uses the helper.

- **start_visual_session handler converted** -- description rewritten with the `[REMOVED in v0.9.0]` banner naming `CHANGELOG.md#v0.9.0` + Visual Session Lifecycle section of `mcp/README.md` as the migration recipe anchor; input schema preserved byte-for-byte (4 fields: `client`, `task`, `detail`, `tab_id`); handler body replaced with a synchronous 5-line stub that returns `mapFSBError({ success: false, errorCode: 'TOOL_REMOVED', removed_tool: 'start_visual_session', removed_in_version: '0.9.0' })`. The handler ignores its parsed arguments (`async () =>`) and short-circuits BEFORE the task queue and BEFORE the bridge connectivity check -- the rejection is bridge-independent (a caller of a removed tool gets the migration recipe even with the extension offline).

- **end_visual_session handler converted** -- same shape; description names the auto-clear-after-60s + `is_final: true` mechanics in place of the deleted v0.9.36 multi-paragraph description; input schema preserved (`session_token`, `reason`); body returns `mapFSBError({ ..., removed_tool: 'end_visual_session', ... })`.

### 3. Allowlist module exports preserved byte-for-byte

Lines 1-35 of `mcp/src/tools/visual-session.ts` (minus the deleted import on line 6) are unchanged. This includes:

- `MCP_VISUAL_CLIENT_LABELS` array with all 12 entries including the pre-existing OpenClaw label variant (the second OpenClaw entry whose suffix is the U+1F980 codepoint inherited from v0.9.36) -- this is consumed allowlist data, NOT Claude-authored content, so the no-emoji rule does not apply (the rule applies to new code/docs Claude writes).
- `CLIENT_LABEL_MAP` construction loop.
- `normalizeMcpVisualClientLabel(raw)`.
- `isAllowedMcpVisualClientLabel(raw)` (consumed by Phase 255 Plan 03's manual.ts dispatch validator).
- `getAllowedMcpVisualClientLabels()`.

## Tie-in to v0.9.62 Contract

The TOOL_REMOVED switch arm in `mcp/src/errors.ts` is the in-code realisation of the body intent pinned in `.planning/v0.9.62-CONTRACT.md` Typed Errors section row for TOOL_REMOVED. Verbatim mapping:

| Contract row field | Contract text | Plan 258-01 realisation |
|---|---|---|
| Surfaces | "Removal layer; replaces dispatch of removed start_visual_session / end_visual_session tool names." | Both stub handlers in `mcp/src/tools/visual-session.ts` raise `errorCode: 'TOOL_REMOVED'` through `mapFSBError`; this is the only dispatch path for the two removed tool names. |
| Phase | 258 | Plan 258-01. |
| Body intent | "The explicit visual_session start/end tools were removed in v0.9.62. Use the implicit contract: required visual_reason / client on action tools, sliding 60s window, is_final: true for early clear. See <CHANGELOG section + mcp/README visual-session section>." | `case 'TOOL_REMOVED':` arm's `why` names the tool + version; `nextAction` enumerates "visual_reason (string) and client (allowlisted label)", "sliding 60-second window", "is_final: true on the last action of a task clears the overlay immediately", and cites `CHANGELOG.md#v0.9.0` + Visual Session Lifecycle section of `mcp/README.md`. |

## Acceptance Verification

All acceptance criteria from the plan verified by grep + build + test:

### Task 1 -- mcp/src/errors.ts (10 criteria)

1. `grep -c "'TOOL_REMOVED'" mcp/src/errors.ts` -- 2 matches (Set + switch case label). PASS.
2. `grep -c "case 'TOOL_REMOVED':" mcp/src/errors.ts` -- exactly 1. PASS.
3. `grep -c "removed_tool" mcp/src/errors.ts` -- in const + why string. PASS.
4. `grep -c "removed_in_version" mcp/src/errors.ts` -- in const + why string. PASS.
5. `grep -c "visual_reason" mcp/src/errors.ts` -- 4 matches (VISUAL_FIELDS_REQUIRED why + nextAction + TOOL_REMOVED nextAction + comment). PASS.
6. `grep -c "is_final" mcp/src/errors.ts` -- 1 match (TOOL_REMOVED nextAction). PASS.
7. `grep -c "60-second" mcp/src/errors.ts` -- 1 match. PASS.
8. `grep -c "CHANGELOG.md#v0.9.0" mcp/src/errors.ts` -- 1 match. PASS.
9. Existing Phase 255 Plan 02 entries unchanged: `VISUAL_FIELDS_REQUIRED` count 2, `BADGE_NOT_ALLOWED` count 2 (Set + switch label). PASS.
10. Existing v0.9.60 entries unchanged: `TAB_NOT_OWNED` count 2. PASS.
11. LAYER_LABELS unchanged: `grep -c "as const;" mcp/src/errors.ts` -- exactly 1. PASS.
12. `cd mcp && npm run build` -- exit 0. PASS.

### Task 2 -- mcp/src/tools/visual-session.ts (13 criteria)

1. Both server.tool() registrations exist (multi-line): `'start_visual_session',` + `'end_visual_session',` both grep at 2 (first arg + `removed_tool` literal). PASS.
2. `grep -c "errorCode: 'TOOL_REMOVED'" mcp/src/tools/visual-session.ts` -- exactly 2. PASS.
3. `grep -c "removed_tool: 'start_visual_session'" ...` -- exactly 1. PASS.
4. `grep -c "removed_tool: 'end_visual_session'" ...` -- exactly 1. PASS.
5. `grep -c "removed_in_version: '0.9.0'" ...` -- exactly 2. PASS.
6. `grep -c "\\[REMOVED in v0.9.0\\]" ...` -- exactly 2. PASS.
7. `grep -c "CHANGELOG.md#v0.9.0" ...` -- 2 (one per description). PASS.
8. `grep -c "queue.enqueue" ...` -- exactly 0. PASS.
9. `grep -c "sendAgentScopedBridgeMessage" ...` -- exactly 0. PASS.
10. `grep -c "bridge.isConnected" ...` -- exactly 0. PASS.
11. `grep -c "import { sendAgentScopedBridgeMessage }" ...` -- exactly 0. PASS.
12. Allowlist module exports preserved: 3 export-function lines (normalize, isAllowed, getAllowed). PASS.
13. Build artifact: `grep -c "TOOL_REMOVED" mcp/build/tools/visual-session.js` -- 8 matches (stub body literals + compiled string occurrences). PASS.

### Integration verification

- `cd mcp && npm run build` -- exits 0, no TypeScript errors, regenerates the build artifacts. PASS.
- `npm test` -- full test chain (~70 suites) exits 0, zero failures, including the existing `mcp-visual-session-contract.test.js`, `mcp-version-parity.test.js` (still asserts 0.8.0 -- Plan 258-02 bumps it), and the Phase 255 Plan 02 typed-error tests. PASS.

## Deviations from Plan

Minor wording adjustment (no semantic change):

**Stub comment phrasing**

- **Found during:** Task 2 acceptance grep.
- **Issue:** The plan's draft stub-comment text said "Short-circuit BEFORE queue.enqueue and BEFORE bridge.isConnected". The plan's acceptance criteria 7 + 9 require `grep -c "queue.enqueue" ...` and `grep -c "bridge.isConnected" ...` to return exactly 0. The literal substrings inside my own stub comments were causing those counts to read 2.
- **Fix:** Reworded the stub comments to say "BEFORE the task queue and BEFORE the bridge connectivity check" -- semantically identical, no longer matches the literal substrings the acceptance criteria check for. Both stubs got the same updated phrasing. Behavioural intent of the stub is unchanged; the comment still documents that the rejection is synchronous and bridge-independent.
- **Files modified:** mcp/src/tools/visual-session.ts (lines 53-57 + 75-79).
- **Rule cited:** Rule 1 (auto-fix) -- aligns the comments with the plan's strict grep-verifiable acceptance contract.

No other deviations. No architectural changes. No new tests added (Phase 259 owns that).

## Known Stubs

None new. The two new "stubs" in `mcp/src/tools/visual-session.ts` are intentional and documented -- they are the v0.9.0 typed-rejection surface for the removed tool names, not unfinished work. Their behaviour is the plan's deliverable, not a placeholder for later wiring.

## Threat Flags

None. Phase 258 Plan 01 removes one execution path (`queue.enqueue + sendAgentScopedBridgeMessage`) and adds one rejection path (synchronous `mapFSBError` return). No new caller-supplied data flow, no new I/O, no new state mutation. All STRIDE threats covered in the plan's threat register either mitigated by the short-circuit-before-queue invariant or accepted as inherited from the existing v0.9.60 typed-error posture.

## Files

- **Modified:** `mcp/src/errors.ts` (+13 lines: 2 in CODE_ONLY_ERROR_KEYS, 2 const reads, 9-line TOOL_REMOVED switch arm)
- **Modified:** `mcp/src/tools/visual-session.ts` (net -45 lines: deleted 1 import + 2 multi-paragraph descriptions + 2 multi-line queue-wrapped handler bodies; added 2 banner descriptions + 2 synchronous 5-line stubs; allowlist module exports byte-for-byte preserved)
- **Created:** `.planning/phases/258-removal-migration-errors-package-0.9.0/258-01-SUMMARY.md` (this file)

## Self-Check: PASSED

- mcp/src/errors.ts has `case 'TOOL_REMOVED':` arm: FOUND.
- mcp/src/errors.ts has `'TOOL_REMOVED'` in CODE_ONLY_ERROR_KEYS: FOUND.
- mcp/src/tools/visual-session.ts has 2 stubs with `errorCode: 'TOOL_REMOVED'`: FOUND (grep count 2).
- mcp/src/tools/visual-session.ts has `[REMOVED in v0.9.0]` banner x2: FOUND.
- mcp/src/tools/visual-session.ts has 0 `queue.enqueue` / 0 `sendAgentScopedBridgeMessage` / 0 `bridge.isConnected`: FOUND.
- mcp/src/tools/visual-session.ts allowlist exports preserved (3 export functions): FOUND.
- mcp/build/tools/visual-session.js contains `TOOL_REMOVED` (build artifact regenerated): FOUND (grep count 8).
- `cd mcp && npm run build` exit code: 0.
- `npm test` exit code: 0.
- All 12 plan-level success criteria from `<success_criteria>` of 258-01-PLAN.md: met.
