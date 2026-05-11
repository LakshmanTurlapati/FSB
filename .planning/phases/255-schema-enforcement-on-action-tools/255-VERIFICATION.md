---
phase: 255-schema-enforcement-on-action-tools
verified: 2026-05-11T22:00:00Z
status: passed
score: 25/25 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 255: Schema Enforcement on Action Tools -- Verification Report

**Phase Goal:** Every action tool in the canonical list accepts and requires the new field bundle in its MCP input schema; missing or invalid fields fail loud with the pinned typed errors before the underlying action executes; read-only tools stay byte-for-byte unchanged.

**Verified:** 2026-05-11T22:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification.

## Goal Achievement

Phase goal achieved end-to-end. The MCP server's `tools/list` advertises `visual_reason` (required string) + `client` (required string) + `is_final` (optional boolean) on all 36 canonical action tools; the dispatch chokepoint rejects malformed payloads with `VISUAL_FIELDS_REQUIRED` / `BADGE_NOT_ALLOWED` typed errors BEFORE any bridge / queue / extension side effect runs; all 15 read-only tools retain byte-for-byte unchanged input schemas; `wait_for_element` and `wait_for_stable` are reclassified `_readOnly: true`; the byte-identity invariant between `mcp/ai/tool-definitions.cjs` and `extension/ai/tool-definitions.js` is preserved.

### Observable Truths (merged from ROADMAP success criteria + 4 plan frontmatters)

| #   | Truth                                                                                                            | Status     | Evidence |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | Every action tool in the Phase 254 canonical list declares `visual_reason` (required string) and `client` (required, allowlisted) in its MCP input schema, plus optional `is_final` (boolean); discoverable via the MCP server `tools/list` response. | VERIFIED | Node smoke check across all 36 canonical action tool names confirmed every one has `inputSchema.properties.visual_reason / client / is_final` with correct types and `inputSchema.required` contains `visual_reason` and `client`. |
| 2   | Calling any action tool without `visual_reason` or without `client` returns a typed `VISUAL_FIELDS_REQUIRED` error and the underlying browser action does not execute (no DOM mutation, no `change_report`, no overlay state change). | VERIFIED | Live dispatch run against `mcp/build/tools/manual.js` with a recording mock bridge: rejected calls produce `isError: true` with `Detected: Visual session contract / Why: Action tool click was called without the required visual-session field bundle (visual_reason and client).`. `bridgeCalls.length === 0` and `queueCalls.length === 0` on rejection. |
| 3   | Calling any action tool with a `client` value not present in the v0.9.36 shared allowlist returns a typed `BADGE_NOT_ALLOWED` error and the underlying action does not execute; the validator shares the v0.9.36 source-of-truth (not a per-tool duplicate). | VERIFIED | Live dispatch with `client: 'NotARealClient'` returned `isError: true`, body `Detected: Visual session contract / Why: Client label "NotARealClient" is not on the trusted v0.9.36 badge allowlist.` plus enumerated allowlist. `mcp/src/tools/manual.ts` imports `isAllowedMcpVisualClientLabel` + `getAllowedMcpVisualClientLabels` from `./visual-session.js` (no duplicate constant). |
| 4   | Every read-only MCP tool listed in Phase 254 retains a byte-for-byte unchanged input schema (no `visual_reason` / `client` / `is_final` injected); pre-v0.9.62 argument shape continues to work. | VERIFIED | Node smoke check across all 15 canonical read-only tool names confirmed `_readOnly: true` and absence of bundle keys from `inputSchema.properties`. `getReadOnlyTools().length === 15`. |
| 5   | `mcp/ai/tool-definitions.cjs` exports `VISUAL_SESSION_FIELDS`, `VISUAL_SESSION_REQUIRED`, and `withVisualSessionFields(tool)` helper. | VERIFIED | `require('mcp/ai/tool-definitions.cjs')` returns all three; `VISUAL_SESSION_FIELDS` is a 3-key object with correct types; `VISUAL_SESSION_REQUIRED` is `['visual_reason', 'client']`; `withVisualSessionFields` is a function. |
| 6   | `extension/ai/tool-definitions.js` is byte-identical to `mcp/ai/tool-definitions.cjs`. | VERIFIED | `diff -q` produces no output (exit 0); both files 1262 lines. |
| 7   | `wait_for_element` and `wait_for_stable` both have `_readOnly: true` (flipped from `false`). | VERIFIED | Direct registry inspection: both entries report `_readOnly: true` via `getToolByName`; in the test file's 15-name read-only loop both pass the `_readOnly === true` assertion. |
| 8   | `mcp/src/errors.ts` declares `VISUAL_FIELDS_REQUIRED` in `CODE_ONLY_ERROR_KEYS` Set so `resolveErrorKey()` returns it verbatim. | VERIFIED | Line 64 of `mcp/src/errors.ts`; `mapFSBError({errorCode: 'VISUAL_FIELDS_REQUIRED'})` routes to the dedicated switch arm. |
| 9   | `mcp/src/errors.ts` declares `BADGE_NOT_ALLOWED` in `CODE_ONLY_ERROR_KEYS` Set so `resolveErrorKey()` returns it verbatim. | VERIFIED | Line 65 of `mcp/src/errors.ts`; `mapFSBError({errorCode: 'BADGE_NOT_ALLOWED'})` routes to the dedicated switch arm. |
| 10  | `buildLayeredDetail()` has explicit case branches for `VISUAL_FIELDS_REQUIRED` and `BADGE_NOT_ALLOWED` producing Detected/Why/Next-action body. | VERIFIED | Cases at lines 300-307 (VISUAL_FIELDS_REQUIRED) and 308-317 (BADGE_NOT_ALLOWED) of `mcp/src/errors.ts`; both use `LAYER_LABELS.visualSession`; both contain plan-pinned body intent text. |
| 11  | `TOOL_REMOVED` is NOT added in Phase 255 (reserved for Phase 258). | VERIFIED | `grep -c "TOOL_REMOVED" mcp/src/errors.ts` returns 0. |
| 12  | Every server.tool() handler registered by `registerManualTools()` runs `validateVisualSessionFields(tool.name, params)` BEFORE the param transform / execAction sequence. | VERIFIED | Lines 170-180 of `mcp/src/tools/manual.ts` show validator-then-strip-then-transform-then-execAction order. The 36 registered handlers all reject empty-params calls in the live test. |
| 13  | The dispatch validator strips `visual_reason / client / is_final` from `params` before calling `execAction` so the FSB extension protocol is not polluted. | VERIFIED | `stripVisualSessionFields()` defined at lines 90-93 of `mcp/src/tools/manual.ts`; invoked unconditionally after the validator passes (line 178). Live test confirms `params={"selector":"#x"}` reaches the bridge log when the caller sent `visual_reason` + `client`. |
| 14  | Read-only tools (registered via `registerReadOnlyTools` in `mcp/src/tools/read-only.ts`) are NOT touched by the validator -- they bypass it structurally. | VERIFIED | `mcp/src/tools/manual.ts` filters `TOOL_REGISTRY` to `!t._readOnly` at line 152; the validator is wired only inside that loop. Read-only tools register through a separate file that does not import `validateVisualSessionFields`. |
| 15  | When the validator rejects, `bridge.sendAndWait`, `queue.enqueue`, and `sendAgentScopedBridgeMessage` are NOT invoked. | VERIFIED | Schema-lock test recording mocks confirm `bridgeCalls.length === 0` AND `queueCalls.length === 0` on all 3 rejection paths (missing both, missing only client, non-allowlisted client). |
| 16  | `tests/visual-session-schema-lock.test.js` exists and is Node-runnable. | VERIFIED | File exists at 308 lines; `node tests/visual-session-schema-lock.test.js` exits 0 with `=== Results: 314 passed, 0 failed ===`. |
| 17  | The test asserts every action tool has the bundle in properties and required. | VERIFIED | Per-action-tool loop at lines covering all 36 names, 7 assertions per tool (252 sub-assertions). |
| 18  | The test asserts every read-only tool has NO bundle keys (schema-lock invariant). | VERIFIED | Per-read-only-tool loop covering all 15 names, 4 assertions per tool (60 sub-assertions). |
| 19  | The test asserts `wait_for_element` and `wait_for_stable` have `_readOnly: true`. | VERIFIED | Explicit reclassification checks at lines covering both names pass. |
| 20  | The test asserts dispatcher rejects missing visual_reason with VISUAL_FIELDS_REQUIRED + bridge NEVER invoked. | VERIFIED | Cases A, B, C in the test file all pass with `bridgeCalls.length === 0` after rejection. |
| 21  | The test asserts dispatcher rejects bad client with BADGE_NOT_ALLOWED + bridge NEVER invoked + offending label echoed. | VERIFIED | Case D in the test file: `isError === true`, `bridgeCalls.length === 0`, body contains `NotARealClient`. |
| 22  | `package.json scripts.test` chain includes `node tests/visual-session-schema-lock.test.js` so the file runs as part of `npm test`. | VERIFIED | `package.json` line 16 contains `&& node tests/tool-definitions-parity.test.js && node tests/visual-session-schema-lock.test.js && node tests/agent-id-threading.test.js &&` (exact chain position). |
| 23  | `npm test` exits 0 from repo root (the new test passes; no pre-existing test regresses). | VERIFIED | Full `npm test` chain ran to completion with `Failed: 0` in the final summary; no `FAIL:` lines anywhere; chain terminates with the last test's `--- Summary --- Passed: 15 Failed: 0`. |
| 24  | `isAllowedMcpVisualClientLabel`, `normalizeMcpVisualClientLabel`, and `getAllowedMcpVisualClientLabels` exported from `mcp/src/tools/visual-session.ts`. | VERIFIED | `grep` confirms all three carry `export` keyword (lines 20, 30, 34); the built `mcp/build/tools/visual-session.js` exports them; the dispatcher imports them. |
| 25  | Total tool count in TOOL_REGISTRY is 51 (36 action + 15 read-only). | VERIFIED | `m.TOOL_REGISTRY.length === 51`; `m.getReadOnlyTools().length === 15`. |

**Score:** 25/25 truths verified

### Required Artifacts

| Artifact                                  | Expected                                                                              | Status     | Details |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ---------- | ------- |
| `mcp/ai/tool-definitions.cjs`             | TOOL_REGISTRY with fragment + helper + 36 wraps + 2 reclassifications; min_lines 1200 | VERIFIED   | 1262 lines; all required patterns present; helper applied 36 times in array literal (38 total occurrences incl. declaration + export reference). |
| `extension/ai/tool-definitions.js`        | Byte-identical mirror of mcp/ai/tool-definitions.cjs; min_lines 1200                  | VERIFIED   | 1262 lines; `diff -q` exits 0 (byte-identical). |
| `mcp/src/errors.ts`                       | Extended typed-error registry with both error codes; min_lines 380                    | VERIFIED   | 392 lines; both error codes in `CODE_ONLY_ERROR_KEYS` Set; both switch arms in `buildLayeredDetail` with `LAYER_LABELS.visualSession`. |
| `mcp/src/tools/manual.ts`                 | `registerManualTools` with validator wired before execAction; min_lines 130           | VERIFIED   | 184 lines; `validateVisualSessionFields`, `stripVisualSessionFields`, and the import from `./visual-session.js` all present; validator invoked at line 175. |
| `tests/visual-session-schema-lock.test.js` | Schema-lock invariants test; min_lines 150                                            | VERIFIED   | 308 lines; runs 314 PASS / 0 FAIL. |
| `package.json`                            | Updated `scripts.test` chain that includes the new test                               | VERIFIED   | Line 16 contains the new test invocation between `tool-definitions-parity.test.js` and `agent-id-threading.test.js`. |

### Key Link Verification

| From                                                  | To                                                | Via                                                                                                                                                | Status   | Details |
| ----------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `mcp/ai/tool-definitions.cjs`                         | `.planning/v0.9.62-CONTRACT.md`                   | JSDoc citation on `VISUAL_SESSION_FIELDS` naming the contract document as the source-of-truth                                                      | WIRED    | Line 21 of `mcp/ai/tool-definitions.cjs`: `// Source-of-truth: .planning/v0.9.62-CONTRACT.md (Field Bundle section).` Line 57 also references contract. |
| `extension/ai/tool-definitions.js`                    | `mcp/ai/tool-definitions.cjs`                     | Byte-identity invariant asserted by `tests/tool-definitions-parity.test.js`                                                                        | WIRED    | `diff -q` exits 0; parity test passes 142/142. |
| `mcp/src/errors.ts CODE_ONLY_ERROR_KEYS` Set          | `Plan 03 dispatch validator in mcp/src/tools/manual.ts` | Plan 03 raises `errorCode: 'VISUAL_FIELDS_REQUIRED'` or `'BADGE_NOT_ALLOWED'` and `mapFSBError` reads `CODE_ONLY_ERROR_KEYS` to route to switch arms | WIRED    | Live test shows both error codes resolve through `mapFSBError` to the dedicated switch arms with the contract body intent text. |
| `mcp/src/errors.ts buildLayeredDetail()`              | `.planning/v0.9.62-CONTRACT.md` Typed Errors section | Why / Next-action text sourced verbatim from the contract document's Body intent column                                                            | WIRED    | Both switch arms reference visual-session field bundle copy; BADGE_NOT_ALLOWED next-action enumerates allowlist; matches contract lines 110-114. |
| `mcp/src/tools/manual.ts`                             | `mcp/src/tools/visual-session.ts`                 | Plan 03 imports `isAllowedMcpVisualClientLabel` + `getAllowedMcpVisualClientLabels`                                                                | WIRED    | Line 13 of `manual.ts`: `import { isAllowedMcpVisualClientLabel, getAllowedMcpVisualClientLabels } from './visual-session.js';` |
| `mcp/src/tools/manual.ts validator`                   | `mcp/src/errors.ts`                               | Validator rejection returns `mapFSBError({success: false, errorCode: 'VISUAL_FIELDS_REQUIRED' \| 'BADGE_NOT_ALLOWED', ...})`                       | WIRED    | Lines 63-79 of `manual.ts` construct exactly these payloads. |
| `tests/visual-session-schema-lock.test.js`            | `mcp/ai/tool-definitions.cjs` (Plan 01 artifact)  | `require()` loads TOOL_REGISTRY and walks each canonical-list name                                                                                 | WIRED    | Test loads and exercises both static (schema shape) and runtime (dispatcher rejection) invariants. |
| `tests/visual-session-schema-lock.test.js`            | `mcp/build/tools/manual.js` (Plan 03 build artifact) | Dynamic import + recording mock bridge to assert runtime rejection blocks bridge calls                                                             | WIRED    | Test imports the built module, registers handlers against a recording mock, and asserts `bridgeCalls.length === 0` on rejection. |
| `package.json scripts.test`                           | `tests/visual-session-schema-lock.test.js`        | Append-only edit to the test script chain                                                                                                          | WIRED    | Exact regex `tool-definitions-parity\.test\.js && node tests/visual-session-schema-lock\.test\.js` matches; `npm test` runs the new test. |

### Data-Flow Trace (Level 4)

Phase 255 modifies registry data, error registration, dispatch wiring, and tests. The artifacts are not user-rendering components consuming dynamic data, so the Level 4 trace reduces to a single check: does live caller data flow through the validator and reach the bridge as expected?

| Artifact                                  | Data Variable                | Source                                                                              | Produces Real Data | Status   |
| ----------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | ------------------ | -------- |
| `mcp/src/tools/manual.ts` validator       | `params` from caller         | MCP SDK caller -> server.tool handler arrow                                          | Yes                | FLOWING  |
| `mcp/src/tools/manual.ts` stripper        | `cleanedParams` to execAction | `params - {visual_reason, client, is_final}`                                         | Yes (confirmed via bridge log `params={"selector":"#x"}`) | FLOWING  |
| `mcp/src/errors.ts` switch arms           | `clientLabel`, `allowedClients`, `tool` from `fsbResult` | Validator-supplied FSB-shaped object: `mapFSBError({errorCode, tool, clientLabel, allowedClients})` | Yes (echoes label, enumerates allowlist) | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                                                                       | Command                                                                                                                                                       | Result                                                              | Status   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| `mcp/ai/tool-definitions.cjs` byte-identical to `extension/ai/tool-definitions.js`                              | `diff -q mcp/ai/tool-definitions.cjs extension/ai/tool-definitions.js`                                                                                       | exit 0, no output                                                   | PASS     |
| `withVisualSessionFields(` count in `mcp/ai/tool-definitions.cjs` is 38 (1 decl + 1 export + 36 application sites) | `grep -c "withVisualSessionFields(" mcp/ai/tool-definitions.cjs`                                                                                              | 38                                                                  | PASS     |
| `_readOnly: true,` count is 15; `_readOnly: false,` count is 36                                                  | `grep -c "_readOnly: true," mcp/ai/tool-definitions.cjs && grep -c "_readOnly: false," mcp/ai/tool-definitions.cjs`                                          | 15 / 36                                                             | PASS     |
| All 36 action tools carry bundle; all 15 read-only tools do not                                                  | Custom Node smoke (full registry walk)                                                                                                                       | "OK: all schema invariants pass"                                    | PASS     |
| Live dispatcher rejects empty-params call without invoking bridge                                                | Custom Node integration (registerManualTools + recording mock)                                                                                                | A) missing both -> isError: true / bridge: 0                        | PASS     |
| Live dispatcher rejects non-allowlisted `client` with BADGE_NOT_ALLOWED, echoes label                            | Same harness                                                                                                                                                  | B) bad client -> isError: true / echoes NotARealClient              | PASS     |
| Live dispatcher accepts `client: 'Claude'` and forwards to bridge with bundle stripped                           | Same harness                                                                                                                                                  | C) valid -> isError: false / bridge called once / params={"selector":"#x"} | PASS     |
| `mapFSBError({errorCode: 'VISUAL_FIELDS_REQUIRED', tool: 'click'})` routes through dedicated switch arm          | Direct call against `mcp/build/errors.js`                                                                                                                    | body contains `Detected: Visual session contract / Why: Action tool click was called without...`  | PASS     |
| `mapFSBError({errorCode: 'BADGE_NOT_ALLOWED', clientLabel, allowedClients})` routes through dedicated switch arm | Direct call against `mcp/build/errors.js`                                                                                                                    | body contains `Detected: Visual session contract / Why: Client label "NotARealClient" is not on the trusted v0.9.36 badge allowlist.` plus enumerated allowlist | PASS     |
| `node tests/visual-session-schema-lock.test.js` exits 0                                                          | Direct run                                                                                                                                                    | === Results: 314 passed, 0 failed ===                               | PASS     |
| `npm test` exits 0 with full chain green                                                                         | Full chain                                                                                                                                                    | terminates with `Failed: 0`; no `FAIL:` lines anywhere              | PASS     |
| `TOOL_REMOVED` is NOT registered in errors.ts (reserved for Phase 258)                                           | `grep -c "TOOL_REMOVED" mcp/src/errors.ts`                                                                                                                   | 0                                                                   | PASS     |

### Requirements Coverage

| Requirement   | Source Plan(s)                               | Description                                                                                                                                                                            | Status     | Evidence |
| ------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| CONTRACT-02   | 255-01 (declares + applies), 255-04 (asserts) | Every action tool in the canonical list requires the field bundle in its MCP input schema: `visual_reason` (required), `client` (required), `is_final` (optional).                     | SATISFIED  | All 36 action tools verified via Node smoke + 252 sub-assertions in the schema-lock test; helper applied via `withVisualSessionFields()` wrap, `inputSchema.properties` and `inputSchema.required` populated correctly. |
| CONTRACT-03   | 255-02 (registers error), 255-03 (raises in dispatcher), 255-04 (asserts) | Calling an action tool with `visual_reason` or `client` missing produces typed `VISUAL_FIELDS_REQUIRED` and underlying action does not execute.                                        | SATISFIED  | `VISUAL_FIELDS_REQUIRED` registered in `CODE_ONLY_ERROR_KEYS` and has dedicated `buildLayeredDetail` switch arm; dispatcher raises it via `mapFSBError`; live test confirms `bridgeCalls.length === 0` on rejection. |
| CONTRACT-04   | 255-02 (registers error), 255-03 (raises in dispatcher), 255-04 (asserts) | `client` validated against shared v0.9.36 allowlist; invalid value yields typed `BADGE_NOT_ALLOWED`.                                                                                  | SATISFIED  | `BADGE_NOT_ALLOWED` registered with dedicated switch arm; dispatcher imports `isAllowedMcpVisualClientLabel` + `getAllowedMcpVisualClientLabels` from the v0.9.36 source-of-truth; live test echoes offending label and lists allowed values. |
| CONTRACT-05   | 255-01 (locks read-only registry shape), 255-04 (asserts) | Complete read-only MCP tool list (15 tools) does not carry the new fields; input schemas remain byte-for-byte unchanged; `wait_for_element` and `wait_for_stable` reclassified to read-only. | SATISFIED  | All 15 read-only tools verified via Node smoke + 60 sub-assertions in the schema-lock test; both `wait_for_*` tools now report `_readOnly: true`; `getReadOnlyTools().length === 15`. |

No orphaned requirements: REQUIREMENTS.md maps CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05 to Phase 255 only; every requirement is claimed in at least one plan's `requirements` frontmatter field; no requirement is expected here but missing from all plans.

### Anti-Patterns Found

No anti-patterns. `grep` searches for `TODO|FIXME|XXX|HACK|PLACEHOLDER|not yet implemented` returned zero matches across `mcp/src/tools/manual.ts`, `mcp/src/errors.ts`, and `tests/visual-session-schema-lock.test.js`. The `TOOL_REMOVED` absence is intentional (Phase 258 owns it) and the `is_final` accept-and-discard behaviour is intentional (Phase 257 promotes the runtime semantics). No emojis, no stub implementations, no placeholder copy.

### Human Verification Required

None. Every truth, artifact, key link, and requirement can be verified deterministically by:
- File-system grep / line-count checks on the four edited source files.
- A Node smoke that walks `TOOL_REGISTRY` and confirms shape invariants.
- A live in-process dispatcher run against the built artifact with a recording mock bridge.
- Running `node tests/visual-session-schema-lock.test.js` and `npm test`.

All four checks executed during this verification and all passed. The phase produces no user-visible UI, no real-time behaviour, and no external service integration -- there is nothing for a human to test that a programmatic check could not.

### Gaps Summary

No gaps. Phase 255 delivers the schema-enforcement contract end-to-end across four atomic commits, the full repo test chain stays green, and the goal stated in ROADMAP is met without deviation.

Minor non-blocking note: ROADMAP success criterion #1 says "all 31 tools" while the canonical list is 36. This discrepancy is documented as Resolution 3 in `.planning/v0.9.62-CONTRACT.md` (lines 160-161): the live registry carried 6 action tools the draft had omitted, so the canonical list was expanded to 36 in Phase 254 before Phase 255 started. The 36-name list in v0.9.62-CONTRACT.md and in REQUIREMENTS.md CONTRACT-01 is the binding contract; the "31" figure in the ROADMAP success criteria text is stale verbiage from before the resolution. All 36 tools are verified.

---

*Verified: 2026-05-11T22:00:00Z*
*Verifier: Claude (gsd-verifier)*
