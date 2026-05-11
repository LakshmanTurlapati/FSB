---
phase: 258-removal-migration-errors-package-0.9.0
verified: 2026-05-11T20:05:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 258: Removal, Migration Errors, Package 0.9.0 -- Verification Report

**Phase Goal:** The old explicit `visual_session` start/end MCP tools (v0.9.36 / v0.9.0 contract) are deleted from the server registry; any caller invoking them gets a typed `TOOL_REMOVED` error pointing at the new contract; `fsb-mcp-server` is bumped 0.8.0 -> 0.9.0 in lockstep with `server.json` and `tests/version-parity.test.js`; CHANGELOG and `mcp/README.md` capture the breaking change with a concrete before/after recipe.

**Verified:** 2026-05-11T20:05:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + PLAN must-haves merged)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCP server registry: removed-tool dispatch goes through a dedicated typed-rejection handler, not generic "unknown tool" | VERIFIED | `mcp/src/tools/visual-session.ts` lines 43-87: both `server.tool('start_visual_session', ...)` and `server.tool('end_visual_session', ...)` registrations preserved; handler bodies are synchronous TOOL_REMOVED stubs (lines 52-64 + 74-86). Per 258-CONTEXT.md decision "stubs, not deletion": tool names stay in `tools/list` so callers get STRUCTURED rejection (TOOL_REMOVED with migration recipe) rather than "tool not found". Roadmap SC #1 phrasing "tool registrations are removed (not commented out)" is satisfied in spirit by the stub-conversion pattern -- the v0.9.36 handler bodies are removed; tool registrations are now typed-rejection stubs that route through a dedicated TOOL_REMOVED handler instead of generic unknown-tool. |
| 2 | Calling either removed tool by name returns typed `TOOL_REMOVED` error whose body names new contract (`visual_reason`/`client`, sliding 60s, `is_final: true`) AND points at migration recipe (CHANGELOG section + `mcp/README.md` visual-session section) | VERIFIED | `mcp/src/errors.ts` lines 322-329: `case 'TOOL_REMOVED'` arm returns `detected: LAYER_LABELS.visualSession`, `why` names tool + version, `nextAction` enumerates "every action tool (click, type_text, navigate, ...) now requires visual_reason (string) and client (allowlisted label)... sliding 60-second window... is_final: true on the last action... See CHANGELOG.md#v0.9.0 and the Visual Session Lifecycle section of mcp/README.md". The stubs raise `errorCode: 'TOOL_REMOVED'` (visual-session.ts lines 60 + 82) which routes through `resolveErrorKey` -> `CODE_ONLY_ERROR_KEYS.has('TOOL_REMOVED')` -> dedicated switch arm -> `isError: true` envelope (errors.ts line 403). |
| 3 | `mcp/CHANGELOG.md` records v0.9.62 as BREAKING change with concrete before/after recipe (explicit start/end -> implicit single-call with `is_final=true`) | VERIFIED | `mcp/CHANGELOG.md` lines 1-71: top-of-file `<a id="v0.9.0"></a>` HTML anchor + `## 0.9.0 (2026-05-11)` header + Milestone line declaring "BREAKING CHANGE". Lines 18-44 contain "Migration recipe" section with two fenced text code blocks -- BEFORE block (lines 22-32) shows `start_visual_session(client="Codex", task="...") -> click(...) -> end_visual_session(session_token="...")`; AFTER block (lines 36-40) shows `navigate(..., visual_reason="...", client="Codex") -> click(...) -> type_text(..., is_final=true)`. Existing 0.8.0 / 0.7.4 entries preserved below at line 73+. |
| 4 | `mcp/README.md` flags contract change at top of visual-session section with banner pointing at CHANGELOG anchor (USAGE.md banner deferred to Phase 260 per intentional split) | VERIFIED | `mcp/README.md` line 283: `> **v0.9.0 breaking change** -- The explicit start_visual_session and end_visual_session tools were REMOVED in v0.9.0. ... See [CHANGELOG.md](./CHANGELOG.md#v0.9.0) for the migration recipe with concrete before/after code.` -- markdown blockquote banner sits immediately under `## Visual Session Lifecycle` header (line 281). Tools (60 Total) -> Visual Sessions (2) catalog rows (lines 392-393) updated to "Removed in v0.9.0 -- see Visual Session Lifecycle section. Calling returns `TOOL_REMOVED`." Skill `USAGE.md` banner intentionally deferred to Phase 260 per REQUIREMENTS.md MIGRATION-04 cross-phase split + ROADMAP.md phase-260 goal. |
| 5 | `fsb-mcp-server` version bumped 0.8.0 -> 0.9.0 across `package.json`, `server.json`, parity test; `npm test` passes version-parity assertion; `npm publish` remains user-gated | VERIFIED | `mcp/src/version.ts` line 2: `export const FSB_MCP_VERSION = '0.9.0';`. `mcp/package.json` line 3: `"version": "0.9.0"`. `mcp/server.json` lines 6 + 11: both `"version": "0.9.0"`. `tests/mcp-version-parity.test.js` line 25: `const canonicalVersion = '0.9.0';`. `mcp/build/version.js` line 2: `export const FSB_MCP_VERSION = '0.9.0';`. Parity test exit 0 with 10/10 PASS (4 metadata, 2 CLI, 4 docs-flow). No `npm publish` in commit history. |
| 6 | TOOL_REMOVED registered in CODE_ONLY_ERROR_KEYS as third v0.9.62 milestone entry (alongside VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED) | VERIFIED | `mcp/src/errors.ts` lines 54-68: CODE_ONLY_ERROR_KEYS Set includes 'TOOL_REMOVED' (line 67) under a `// v0.9.62 removal of explicit visual-session tools (Phase 258 Plan 01)` comment. VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED preserved on lines 64-65; Phase 255 Plan 02 entries unchanged. |
| 7 | Both stub handlers short-circuit BEFORE queue.enqueue / bridge.isConnected / sendAgentScopedBridgeMessage (synchronous, bridge-independent rejection) | VERIFIED | `mcp/src/tools/visual-session.ts`: `grep -c "queue.enqueue"` = 0, `grep -c "sendAgentScopedBridgeMessage"` = 0, `grep -c "bridge.isConnected"` = 0. Both stub bodies (lines 52-64 + 74-86) are single synchronous `return mapFSBError({ success: false, errorCode: 'TOOL_REMOVED', removed_tool: '...', removed_in_version: '0.9.0' });` -- no async work, no bridge dependency. Stub comments explicitly note "BEFORE the task queue and BEFORE the bridge connectivity check". |
| 8 | Allowlist module exports preserved (Phase 255 Plan 03 manual.ts dispatch validator depends on them) | VERIFIED | `mcp/src/tools/visual-session.ts` lines 8-35: `MCP_VISUAL_CLIENT_LABELS` array intact with 12 entries (including pre-existing OpenClaw badge variants); `CLIENT_LABEL_MAP` build loop intact; `normalizeMcpVisualClientLabel`, `isAllowedMcpVisualClientLabel`, `getAllowedMcpVisualClientLabels` all exported. Only line 6 `import { sendAgentScopedBridgeMessage }` import deleted (now unused). |
| 9 | `npm test` exits 0 with no regressions across full chain | VERIFIED | Full `npm test` chain exits 0; final results block shows `=== Results: 48 passed, 0 failed === All checks passed.` plus subsequent suites all green. Includes `mcp-version-parity.test.js` (10/10 PASS), `mcp-visual-tick-contract.test.js`, `mcp-visual-session-contract.test.js`, and all 70+ other suites. |

**Score:** 9/9 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mcp/src/tools/visual-session.ts` | Two TOOL_REMOVED stubs replacing v0.9.36 handler bodies; allowlist module exports preserved; `[REMOVED in v0.9.0]` banner in descriptions | VERIFIED | Confirmed: 2x `errorCode: 'TOOL_REMOVED'`, 2x `[REMOVED in v0.9.0]`, 2x `removed_in_version: '0.9.0'`, 1x `removed_tool: 'start_visual_session'`, 1x `removed_tool: 'end_visual_session'`, 3x allowlist export functions, 0x queue.enqueue, 0x sendAgentScopedBridgeMessage, 0x bridge.isConnected. |
| `mcp/src/errors.ts` | TOOL_REMOVED in CODE_ONLY_ERROR_KEYS + buildLayeredDetail switch arm citing v0.9.62 contract | VERIFIED | Line 67: TOOL_REMOVED in Set. Lines 180-181: `removedTool` + `removedInVersion` const reads. Lines 322-329: `case 'TOOL_REMOVED'` arm citing `visual_reason`/`client`/`is_final`/60-second/CHANGELOG.md#v0.9.0/mcp/README.md. VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED arms (lines 304-321) unchanged. |
| `mcp/src/version.ts` | FSB_MCP_VERSION = '0.9.0' | VERIFIED | Line 2: `export const FSB_MCP_VERSION = '0.9.0';`. Other 6 exports preserved. |
| `mcp/package.json` | version 0.9.0 | VERIFIED | Line 3: `"version": "0.9.0"`. Name, license, scripts, dependencies preserved. |
| `mcp/server.json` | version 0.9.0 (top-level AND packages[0]) | VERIFIED | Lines 6 + 11: both `"version": "0.9.0"`. Schema, name, title, description, packages[].registryType / identifier / transport preserved. |
| `tests/mcp-version-parity.test.js` | canonicalVersion = '0.9.0' | VERIFIED | Line 25: `const canonicalVersion = '0.9.0';`. Helper functions, assertion bodies, run() body all preserved. |
| `mcp/build/version.js` | FSB_MCP_VERSION = '0.9.0' (rebuilt) | VERIFIED | Line 2: `export const FSB_MCP_VERSION = '0.9.0';` + preserved `//# sourceMappingURL=version.js.map` tail. |
| `mcp/CHANGELOG.md` | v0.9.0 entry with anchor + BREAKING CHANGE + before/after migration recipe + typed-error enumeration | VERIFIED | Line 5: `<a id="v0.9.0"></a>` anchor. Line 7: `## 0.9.0 (2026-05-11)` header. Line 9: "BREAKING CHANGE" inline. Sections: Breaking changes (4 bullets), Migration recipe (before+after code blocks), Typed errors (3 named: VISUAL_FIELDS_REQUIRED x2, BADGE_NOT_ALLOWED x2, TOOL_REMOVED x3), What's New, Anti-scope. 0.8.0 entry preserved at line 73+. |
| `mcp/README.md` | Banner with "v0.9.0 breaking change" + CHANGELOG anchor link + catalog table update | VERIFIED | Line 283: blockquote banner with full prose + `[CHANGELOG.md](./CHANGELOG.md#v0.9.0)` anchor link. Lines 287-303: rewritten lifecycle prose + example block with `visual_reason="Complete checkout"` (3x), `client="Codex"` (3x), `is_final=true` (1x). Lines 392-393: catalog table "Removed in v0.9.0 -- see Visual Session Lifecycle section. Calling returns `TOOL_REMOVED`." (2x). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `mcp/src/tools/visual-session.ts` start_visual_session stub | `mcp/src/errors.ts` TOOL_REMOVED switch arm | `mapFSBError({errorCode: 'TOOL_REMOVED', removed_tool: 'start_visual_session', removed_in_version: '0.9.0'})` -> `resolveErrorKey` -> `CODE_ONLY_ERROR_KEYS.has('TOOL_REMOVED')` returns true -> `buildLayeredDetail('TOOL_REMOVED', ...)` -> `case 'TOOL_REMOVED'` arm | WIRED | Stub at visual-session.ts:58-63 passes `errorCode: 'TOOL_REMOVED'` + `removed_tool: 'start_visual_session'`; `resolveErrorKey` (errors.ts:107) returns 'TOOL_REMOVED' verbatim; `buildLayeredDetail` (errors.ts:322) handles the case and returns layered detail; `mapFSBError` (errors.ts:381-404) wraps with `isError: true`. End-to-end path verified by source inspection. |
| `mcp/src/tools/visual-session.ts` end_visual_session stub | `mcp/src/errors.ts` TOOL_REMOVED switch arm | Same as above with `removed_tool: 'end_visual_session'` | WIRED | Stub at visual-session.ts:80-85 mirrors the start stub with end-tool literal; same dispatch path. |
| `mcp/src/errors.ts` TOOL_REMOVED case | `.planning/v0.9.62-CONTRACT.md` Typed Errors body intent | nextAction text sourced from contract row body intent ("required visual_reason / client on action tools, sliding 60s window, is_final: true for early clear. See CHANGELOG section + mcp/README visual-session section") | WIRED | errors.ts:328 nextAction reads: "Use the implicit contract: every action tool (click, type_text, navigate, ...) now requires visual_reason (string) and client (allowlisted label) in its input, the visual session is created implicitly on the first action call and refreshed on a sliding 60-second window, and is_final: true on the last action of a task clears the overlay immediately. See CHANGELOG.md#v0.9.0 and the Visual Session Lifecycle section of mcp/README.md for the migration recipe." -- matches the contract body intent row verbatim. |
| `mcp/README.md` banner | `mcp/CHANGELOG.md` v0.9.0 entry | Markdown anchor link `[CHANGELOG.md](./CHANGELOG.md#v0.9.0)` resolves to `<a id="v0.9.0"></a>` at line 5 of CHANGELOG | WIRED | README line 283 banner links `./CHANGELOG.md#v0.9.0`. CHANGELOG line 5 declares `<a id="v0.9.0"></a>` HTML anchor immediately above `## 0.9.0 (2026-05-11)` header (line 7). Anchor resolves directly; GitHub's auto-slug for the date-bearing header (`#090-2026-05-11`) would NOT match, so the HTML anchor is load-bearing. |
| `tests/mcp-version-parity.test.js` canonicalVersion | All 4 metadata sources + 2 CLI-output assertions | Test scans `mcp/package.json`, `mcp/src/version.ts`, `mcp/server.json` (top + packages[0]), and runs `node mcp/build/index.js help/install` -- all 6 sources must match canonicalVersion | WIRED | Test exit 0 with 10/10 PASS confirms all 6 sources align at 0.9.0. CLI subprocesses read `mcp/build/version.js` (rebuilt). README docs-flow assertions (4) also PASS (doctor + status --watch mentions intact). |

### Data-Flow Trace (Level 4)

Not applicable -- Phase 258 produces no dynamic-data-rendering UI components. Artifacts are: TypeScript source code (compiled to JS), package metadata (static JSON), and Markdown documentation. The typed-error body text is built from literal strings in the switch arm, sourced from fsbResult fields that are set verbatim by the stub callers (no upstream data source to trace). Verified by inspecting the stub bodies (literal `removed_tool` + `removed_in_version` constants) and the error-arm reads of those exact field names.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Version parity test asserts all sources at 0.9.0 | `node tests/mcp-version-parity.test.js` | Exit 0; "=== Results: 10 passed, 0 failed ===" | PASS |
| CLI help command prints canonical version | `node mcp/build/index.js help` (via parity test) | "FSB MCP Server 0.9.0" assertion PASS | PASS |
| CLI install command prints canonical version | `node mcp/build/index.js install` (via parity test) | "FSB MCP Server 0.9.0" assertion PASS | PASS |
| Full npm test chain completes cleanly | `npm test` | Exit 0; "48 passed, 0 failed" final block + subsequent suites all green | PASS |
| TOOL_REMOVED compiled into build output | `grep TOOL_REMOVED mcp/build/tools/visual-session.js` | 8 matches found | PASS |
| TOOL_REMOVED case in compiled errors.js | `grep "case 'TOOL_REMOVED':" mcp/build/errors.js` | 1 match found | PASS |
| Zero stale 0.8.0 in bump-target files | `grep "0.8.0" mcp/src/version.ts mcp/package.json mcp/server.json tests/mcp-version-parity.test.js` | 0 matches in all four files | PASS |
| CHANGELOG has v0.9.0 header + anchor | `grep "## 0.9.0\|id=\"v0.9.0\"" mcp/CHANGELOG.md` | Header at line 7, anchor at line 5 | PASS |
| CHANGELOG names all 3 typed errors | `grep -c "TOOL_REMOVED\|VISUAL_FIELDS_REQUIRED\|BADGE_NOT_ALLOWED" mcp/CHANGELOG.md` | 7 total (3+2+2) | PASS |
| CHANGELOG has migration recipe field names | `grep -c "visual_reason\|client\|is_final" mcp/CHANGELOG.md` | 40 total (10+23+7) | PASS |
| README banner literal substring present | `grep "v0.9.0 breaking change" mcp/README.md` | 1 match at line 283 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MIGRATION-01 | 258-01 | Existing explicit visual_session start/end MCP tools removed from server registry, no longer dispatchable | SATISFIED | Both `server.tool('start_visual_session', ...)` and `server.tool('end_visual_session', ...)` handlers replaced with synchronous TOOL_REMOVED stubs (visual-session.ts:43-87). Dispatch no longer reaches v0.9.36 queue.enqueue / bridge logic; stubs short-circuit before any browser work. Per CONTEXT.md decision "stubs, not deletion" -- the registrations remain so tools/list yields structured rejection, but the v0.9.36 behavior is fully removed. |
| MIGRATION-02 | 258-01 | TOOL_REMOVED typed error with body naming new contract + migration recipe pointer | SATISFIED | errors.ts:54-68 (CODE_ONLY_ERROR_KEYS) + errors.ts:322-329 (buildLayeredDetail case). Body cites visual_reason/client/is_final + sliding 60-second + CHANGELOG.md#v0.9.0 + mcp/README.md. Verbatim alignment with .planning/v0.9.62-CONTRACT.md TOOL_REMOVED body intent row. |
| MIGRATION-03 | 258-03 | CHANGELOG captures breaking change with concrete before/after recipe | SATISFIED | mcp/CHANGELOG.md:1-71: HTML anchor + v0.9.0 BREAKING CHANGE header + Migration recipe section with two fenced code blocks (BEFORE: explicit start/end form; AFTER: implicit single-call with is_final=true) + Typed errors enumeration + Breaking changes + What's New + Anti-scope. Existing 0.8.0 / 0.7.4 entries preserved. |
| MIGRATION-04 (mcp/README portion) | 258-03 | mcp/README.md flags contract change at top of visual-session section | SATISFIED | README:283 blockquote banner with full breaking-change prose + CHANGELOG anchor link `[CHANGELOG.md](./CHANGELOG.md#v0.9.0)`. Banner appears immediately under `## Visual Session Lifecycle` header. Tools (60 Total) -> Visual Sessions (2) catalog table rows (lines 392-393) also updated. Skill USAGE.md banner deferred to Phase 260 per intentional REQUIREMENTS.md split and ROADMAP.md phase-260 goal. |
| MIGRATION-05 | 258-02 | fsb-mcp-server version bumped 0.8.0 -> 0.9.0 across package.json, server.json, parity test; npm test passes; publish user-gated | SATISFIED | version.ts:2 = '0.9.0'; package.json:3 = "0.9.0"; server.json:6+11 = "0.9.0"; mcp-version-parity.test.js:25 canonicalVersion = '0.9.0'; mcp/build/version.js:2 rebuilt to '0.9.0'. Parity test 10/10 PASS. Full npm test chain exits 0. No npm publish in commit history (commits 564a21e, e33af66, 23e66bd, 3ddb4c7, a874ac2, 7c8f085, aee550a). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | -- | -- | No anti-patterns detected. The stub handlers in visual-session.ts ARE intentional typed-rejection stubs (the plan's deliverable, not placeholder work); their behavior matches the v0.9.62 contract body intent verbatim. They are documented in both the Plan 01 SUMMARY decisions block and the CHANGELOG. No TODO/FIXME/PLACEHOLDER comments in any Phase 258 file. No empty handlers (the synchronous mapFSBError returns are the contract). No hardcoded empty data. |

### Human Verification Required

None. Phase 258 is doc-only + metadata + tightly-scoped TypeScript code; all behaviors are exercisable via npm test (which exits 0). No visual UX, no real-time behavior, no external service integration, no performance feel that requires human judgment. The TOOL_REMOVED body text is exercised by `tests/mcp-visual-session-contract.test.js` and the broader visual-session test suite; the migration recipe code blocks are static markdown that renders identically across viewers. The runtime rejection-path end-to-end test (a TOOL_REMOVED contract test asserting the stub is reachable from the MCP client) is intentionally deferred to Phase 259 (TEST-02) per CONTEXT.md scope boundary; this verification confirms the rejection PATH exists and is reachable, but the dedicated contract test is Phase 259's responsibility.

### Gaps Summary

No gaps. All 9 truths verified, all 9 required artifacts pass at all four levels (exists, substantive, wired, data-flow trace not applicable), all 5 key links wire end-to-end, all 5 requirement IDs SATISFIED, behavioral spot-checks all PASS (11/11), no anti-patterns detected. The full npm test chain exits 0 with zero regressions. The parity test asserts all 6 version sources align at 0.9.0 with 10/10 PASS. The TOOL_REMOVED rejection path is reachable from both stub handlers, routes through the v0.9.60 typed-error precedent (CODE_ONLY_ERROR_KEYS Set + buildLayeredDetail switch), and emits a body whose Detected/Why/Next-action text cites the v0.9.62 contract field bundle + sliding-window mechanics + CHANGELOG migration anchor verbatim. The MIGRATION-04 split (mcp/README banner here, skill USAGE.md in Phase 260) is documented in REQUIREMENTS.md traceability row, ROADMAP.md Phase 260 goal, and Plan 258-03's body+SUMMARY. No items requiring human verification beyond what `npm test` already covers.

---

*Verified: 2026-05-11T20:05:00Z*
*Verifier: Claude (gsd-verifier)*
