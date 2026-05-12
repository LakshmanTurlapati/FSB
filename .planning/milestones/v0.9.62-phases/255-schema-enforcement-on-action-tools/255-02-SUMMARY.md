---
phase: 255-schema-enforcement-on-action-tools
plan: 02
subsystem: mcp-errors
tags: [v0.9.62, visual-session, typed-errors, errors-registry, mcp]
requires: [254-01, 255-01]
provides:
  - VISUAL_FIELDS_REQUIRED registered in mcp/src/errors.ts CODE_ONLY_ERROR_KEYS Set
  - BADGE_NOT_ALLOWED registered in mcp/src/errors.ts CODE_ONLY_ERROR_KEYS Set
  - buildLayeredDetail() switch arm for VISUAL_FIELDS_REQUIRED returning Detected / Why / Next-action body
  - buildLayeredDetail() switch arm for BADGE_NOT_ALLOWED returning Detected / Why / Next-action body
  - Both new errors route through the existing mapFSBError() layered-detail path instead of falling back to the generic action_rejected branch
affects:
  - mcp/src/errors.ts (added 2 entries to CODE_ONLY_ERROR_KEYS at lines 63-65; added 2 case arms inside buildLayeredDetail() at lines 300-317)
tech_stack:
  added: []
  patterns:
    - typed-error-registry-entry (SCREAMING_SNAKE_CASE name added to CODE_ONLY_ERROR_KEYS Set; mirrors v0.9.60 TAB_NOT_OWNED / AGENT_CAP_REACHED precedent)
    - layered-detail-switch-arm (LAYER_LABELS.visualSession + Detected / Why / Next-action body; mirrors existing invalid_client_label arm)
key_files:
  created:
    - .planning/phases/255-schema-enforcement-on-action-tools/255-02-SUMMARY.md
  modified:
    - mcp/src/errors.ts
decisions:
  - Inserted the two new switch arms immediately AFTER the existing 'invalid_client_label' arm so all visual-session-related branches cluster together under LAYER_LABELS.visualSession. This keeps related arms readable as a group and matches the way existing tab-ownership arms (TAB_NOT_OWNED / TAB_INCOGNITO_NOT_SUPPORTED / TAB_OUT_OF_SCOPE) cluster together.
  - Reused the existing LAYER_LABELS.visualSession label (already declared at line 50) -- no new label added. Both VISUAL_FIELDS_REQUIRED and BADGE_NOT_ALLOWED are visual-session-contract-layer rejections by definition.
  - Reused the existing fsbResult.tool field (already destructured into a local 'tool' variable at line 153) for the VISUAL_FIELDS_REQUIRED why-text. No new fsbResult fields introduced.
  - Reused the existing fsbResult.clientLabel + fsbResult.allowedClients fields (already destructured at lines 161-162) for the BADGE_NOT_ALLOWED arm. The arm degrades gracefully when these fields are absent (mirrors the existing invalid_client_label arm behaviour exactly).
  - TOOL_REMOVED intentionally NOT added. The contract document and CONTEXT.md both scope TOOL_REMOVED to Phase 258. Adding it here would land an unused error code on the trunk.
  - Single commit (no checkpoints) -- the plan has one task and the edits are tightly coupled (Set membership without the switch arms would only produce the generic raw-error fallback body).
metrics:
  duration: ~12 minutes
  completed_date: 2026-05-11
  files_modified: 1
  commits: 1
  tasks_completed: 1
---

# Phase 255 Plan 02: VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED Typed Errors Summary

## One-liner

Registered `VISUAL_FIELDS_REQUIRED` and `BADGE_NOT_ALLOWED` as first-class typed-error codes in `mcp/src/errors.ts` (CODE_ONLY_ERROR_KEYS Set + `buildLayeredDetail` switch arms returning structured Detected / Why / Next-action copy) so Plan 03's dispatch validator can raise them and receive bespoke layered messaging instead of the generic `action_rejected` fallback.

## What was wired

This plan is the error-name declaration step for Phase 255. After this commit lands, `mapFSBError()` recognises two new typed-error codes end-to-end:

1. `VISUAL_FIELDS_REQUIRED` -- emitted when an action tool call omits `visual_reason` or `client` (Plan 03 raises it).
2. `BADGE_NOT_ALLOWED` -- emitted when an action tool call supplies a `client` value not on the shared v0.9.36 allowlist (Plan 03 raises it).

The wiring is purely declarative. No validator runs here, no dispatcher behaviour changes. Calls that today fail with the generic `action_rejected` branch are still unchanged today; only AFTER Plan 03 wires the dispatch chokepoint will real callers observe these codes on the wire.

`TOOL_REMOVED` is intentionally absent from this plan -- it is scoped to Phase 258, when the explicit `start_visual_session` / `end_visual_session` tools are removed.

## Exact edits

### Edit A: CODE_ONLY_ERROR_KEYS extension (mcp/src/errors.ts lines 54-66)

Before (lines 54-63):

```typescript
const CODE_ONLY_ERROR_KEYS = new Set([
  'NO_OWNED_TAB',
  'AMBIGUOUS_TAB',
  'AGENT_NOT_REGISTERED',
  'TAB_NOT_OWNED',
  'TAB_INCOGNITO_NOT_SUPPORTED',
  'TAB_OUT_OF_SCOPE',
  'AGENT_CAP_REACHED',
  'AGENT_REGISTRY_UNAVAILABLE',
]);
```

After (lines 54-66):

```typescript
const CODE_ONLY_ERROR_KEYS = new Set([
  'NO_OWNED_TAB',
  'AMBIGUOUS_TAB',
  'AGENT_NOT_REGISTERED',
  'TAB_NOT_OWNED',
  'TAB_INCOGNITO_NOT_SUPPORTED',
  'TAB_OUT_OF_SCOPE',
  'AGENT_CAP_REACHED',
  'AGENT_REGISTRY_UNAVAILABLE',
  // v0.9.62 implicit visual session contract (Phase 255 Plan 02)
  'VISUAL_FIELDS_REQUIRED',
  'BADGE_NOT_ALLOWED',
]);
```

Effect: `resolveErrorKey()` (lines 95-104) now returns `'VISUAL_FIELDS_REQUIRED'` or `'BADGE_NOT_ALLOWED'` verbatim when an FSB result carries `errorCode` or `code` equal to either string, instead of falling through to the heuristic substring matcher and ending at the generic `action_rejected` branch.

### Edit B: Two new switch arms inside buildLayeredDetail (mcp/src/errors.ts lines 300-317)

Inserted immediately AFTER the existing `'invalid_client_label'` arm (line 290) and BEFORE the `'visual_session_not_found'` arm (line 318) so all four visual-session-related branches cluster together:

```typescript
    case 'VISUAL_FIELDS_REQUIRED':
      return {
        detected: LAYER_LABELS.visualSession,
        why: tool
          ? `Action tool ${tool} was called without the required visual-session field bundle (visual_reason and client).`
          : 'An action tool was called without the required visual-session field bundle (visual_reason and client).',
        nextAction: 'Resend the call with visual_reason (short human-readable string) and client (allowlisted label). See .planning/v0.9.62-CONTRACT.md Field Bundle section.',
      };
    case 'BADGE_NOT_ALLOWED':
      return {
        detected: LAYER_LABELS.visualSession,
        why: clientLabel
          ? `Client label "${clientLabel}" is not on the trusted v0.9.36 badge allowlist.`
          : 'The client label is not on the trusted v0.9.36 badge allowlist.',
        nextAction: allowedClients.length > 0
          ? `Retry with one of the approved client labels: ${allowedClients.join(', ')}.`
          : 'Retry with one of the approved client labels enumerated by getAllowedMcpVisualClientLabels() in mcp/src/tools/visual-session.ts.',
      };
```

Both arms use existing destructured locals at the top of `buildLayeredDetail()` (`tool` line 153, `clientLabel` line 162, `allowedClients` line 161 via the `getAllowedClientLabels` helper). No new helpers or new fsbResult fields are introduced.

## Verbatim Detected / Why / Next-action text (for Plan 03 / Plan 04 assertions)

Downstream plans MUST assert against this exact text when testing the dispatch-validator wiring and the end-to-end MCP error response.

### VISUAL_FIELDS_REQUIRED -- with tool field present

```
Detected: Visual session contract
Why: Action tool <tool> was called without the required visual-session field bundle (visual_reason and client).
Next action: Resend the call with visual_reason (short human-readable string) and client (allowlisted label). See .planning/v0.9.62-CONTRACT.md Field Bundle section.
```

Example with `tool: 'click'`:

```
Detected: Visual session contract
Why: Action tool click was called without the required visual-session field bundle (visual_reason and client).
Next action: Resend the call with visual_reason (short human-readable string) and client (allowlisted label). See .planning/v0.9.62-CONTRACT.md Field Bundle section.
```

### VISUAL_FIELDS_REQUIRED -- with tool field absent

```
Detected: Visual session contract
Why: An action tool was called without the required visual-session field bundle (visual_reason and client).
Next action: Resend the call with visual_reason (short human-readable string) and client (allowlisted label). See .planning/v0.9.62-CONTRACT.md Field Bundle section.
```

### BADGE_NOT_ALLOWED -- with clientLabel + allowedClients present

```
Detected: Visual session contract
Why: Client label "<clientLabel>" is not on the trusted v0.9.36 badge allowlist.
Next action: Retry with one of the approved client labels: <comma-joined allowedClients>.
```

Example with `clientLabel: 'NotARealClient'`, `allowedClients: ['Claude', 'Codex', 'Grok']`:

```
Detected: Visual session contract
Why: Client label "NotARealClient" is not on the trusted v0.9.36 badge allowlist.
Next action: Retry with one of the approved client labels: Claude, Codex, Grok.
```

### BADGE_NOT_ALLOWED -- with clientLabel absent and allowedClients empty

```
Detected: Visual session contract
Why: The client label is not on the trusted v0.9.36 badge allowlist.
Next action: Retry with one of the approved client labels enumerated by getAllowedMcpVisualClientLabels() in mcp/src/tools/visual-session.ts.
```

## Verification (passed)

1. `cd mcp && npm run build` exited 0. No TypeScript errors. `mcp/build/errors.js` regenerated.
2. The plan's inline Node verification script ran successfully and printed `OK: VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED resolved correctly through mapFSBError`. It checked:
   - `mapFSBError({ success: false, errorCode: 'VISUAL_FIELDS_REQUIRED', tool: 'click' })` sets `isError: true` and the body mentions `visual_reason` and/or `visual-session`.
   - `mapFSBError({ success: false, errorCode: 'BADGE_NOT_ALLOWED', clientLabel: 'NotARealClient', allowedClients: ['Claude', 'Codex', 'Grok'] })` sets `isError: true`, echoes `NotARealClient`, and enumerates `Claude` + `Codex`.
3. `node tests/mcp-recovery-messaging.test.js` -- 63 passed, 0 failed. The pre-existing typed-error fixtures (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `NO_OWNED_TAB`, `AMBIGUOUS_TAB`, `session_not_found`, and the layer-attribution fixtures) all still hold. No regression on prior arms.
4. Grep audits:
   - `grep -n "VISUAL_FIELDS_REQUIRED" mcp/src/errors.ts` -> 2 matches (line 64 in Set; line 300 case arm).
   - `grep -n "BADGE_NOT_ALLOWED" mcp/src/errors.ts` -> 2 matches (line 65 in Set; line 308 case arm).
   - `grep -E "case 'VISUAL_FIELDS_REQUIRED':" mcp/src/errors.ts` -> exactly 1 match.
   - `grep -E "case 'BADGE_NOT_ALLOWED':" mcp/src/errors.ts` -> exactly 1 match.
   - `grep -n "TOOL_REMOVED" mcp/src/errors.ts` -> 0 matches (correctly out of scope; Phase 258 owns it).
5. `wc -l mcp/src/errors.ts` -> 392 lines (>= 380 floor from must_haves.artifacts.min_lines).

## Body intent provenance

The Why / Next-action text for each new arm is sourced from `.planning/v0.9.62-CONTRACT.md` Typed Errors section (lines 110-114). Mapping:

| Error name | Contract body intent (lines 112-113) | Implemented Why text (verbatim) |
|------------|--------------------------------------|---------------------------------|
| VISUAL_FIELDS_REQUIRED | "The visual-session field bundle is required on action tools. Supply `visual_reason` (string) and `client` (allowlisted label). See the v0.9.62 contract recipe." | `Action tool <tool> was called without the required visual-session field bundle (visual_reason and client).` -- with `Next action` directing the caller to `visual_reason (short human-readable string) and client (allowlisted label). See .planning/v0.9.62-CONTRACT.md Field Bundle section.` |
| BADGE_NOT_ALLOWED | "The `client` value is not on the trusted v0.9.36 badge allowlist. Allowed values: <enumerated from `getAllowedMcpVisualClientLabels()`>." | `Client label "<clientLabel>" is not on the trusted v0.9.36 badge allowlist.` -- with `Next action` directing the caller to one of the enumerated labels (uses the live `allowedClients` array supplied by the dispatcher; falls back to a pointer at `getAllowedMcpVisualClientLabels()` in `mcp/src/tools/visual-session.ts` when the field is absent). |

The contract's "v0.9.62 contract recipe" pointer is rendered as the concrete file pointer `.planning/v0.9.62-CONTRACT.md Field Bundle section` (the contract section name) so callers can navigate to it directly.

## TOOL_REMOVED is intentionally absent

Per the locked dependency graph in `.planning/v0.9.62-CONTRACT.md` Typed Errors row 3 and `.planning/phases/255-schema-enforcement-on-action-tools/255-CONTEXT.md` "Typed-error wiring" subsection, `TOOL_REMOVED` is owned by Phase 258 (the phase that removes the explicit `start_visual_session` / `end_visual_session` tools). It is NOT declared in this plan. Grepping `mcp/src/errors.ts` for `TOOL_REMOVED` returns zero matches after this commit, as required.

Adding it here would mean the trunk briefly carries a typed-error name with no corresponding dispatch path or removal-layer wiring; that is exactly the "declare a code without the gate that raises it" hazard the phase split is designed to avoid.

## Pointer to Plan 03 (dispatch validator)

Plan 03 (`.planning/phases/255-schema-enforcement-on-action-tools/255-03-PLAN.md`) wires the validator at the MCP dispatch chokepoint (`mcp/src/tools/manual.ts` or whichever file the live dispatcher lives in). It is what actually raises `errorCode: 'VISUAL_FIELDS_REQUIRED'` and `errorCode: 'BADGE_NOT_ALLOWED'` on tool calls that fail the contract. Once Plan 03 lands, the registry entries declared here become observable on the wire; callers receive the layered Detected / Why / Next-action body from this plan's switch arms.

The validator does NOT need to import anything new from `mcp/src/errors.ts` -- it only needs to produce FSB results whose `errorCode` or `code` field equals the string `'VISUAL_FIELDS_REQUIRED'` or `'BADGE_NOT_ALLOWED'`. Once that happens, `resolveErrorKey()` (which reads `CODE_ONLY_ERROR_KEYS`) routes through the new switch arms automatically. This is the same pattern v0.9.60 established for `TAB_NOT_OWNED` and `AGENT_CAP_REACHED`.

## Commit

```
ad27736 feat(255): VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED typed errors
```

On branch `refinements`. One file modified (`mcp/src/errors.ts`), 21 insertions.

## Self-Check: PASSED

- `mcp/src/errors.ts` exists and contains both new strings (verified by grep).
- Commit `ad27736` exists on `refinements` and is the most recent HEAD commit (verified by `git log --oneline -3`).
- TypeScript build is green and the regenerated `mcp/build/errors.js` resolves both new errors through `mapFSBError` correctly (verified by inline Node script).
- The pre-existing typed-error end-to-end test (`tests/mcp-recovery-messaging.test.js`) still passes 63/63 (no regression on `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, or any other prior arm).
- `TOOL_REMOVED` is intentionally absent (verified by grep returning zero matches).
- Per the executor's task scope, `STATE.md` and `ROADMAP.md` were NOT touched in this plan.
