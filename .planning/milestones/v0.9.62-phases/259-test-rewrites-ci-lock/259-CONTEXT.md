# Phase 259: Test Rewrites & CI Lock - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart-discuss
**Authoritative reference:** `.planning/v0.9.62-CONTRACT.md`

<domain>
## Phase Boundary

Phase 259 finalises the v0.9.62 contract behind CI by:

1. Rewriting `tests/mcp-visual-session-contract.test.js` (the v0.9.0 / v0.9.36 / v0.9.60 contract test, 690 lines, 4 cases) END-TO-END for the new implicit contract. The pre-v0.9.62 cases covering the EXPLICIT `start_visual_session` / `end_visual_session` flow are obsolete (those tools are now TOOL_REMOVED stubs). The allowlist + persistence cases that test the underlying module surface stay valid where they don't depend on the explicit start/end flow.

2. Adding a TOOL_REMOVED contract test that calls the removed tool names through the dispatch path and asserts the typed `TOOL_REMOVED` error is returned with the migration recipe pointer (CHANGELOG.md#v0.9.0 + mcp/README.md visual-session anchor).

3. Confirming TEST-03 (required-field validation across every action tool in the canonical 36-name list) is fully covered. Phase 255's `tests/visual-session-schema-lock.test.js` already enumerates all 36 tools; this phase confirms the coverage and adds enumeration-style assertions if any tools were missed.

4. Confirming TEST-04 (read-tool no-op) is fully covered. Phase 255's schema-lock test already asserts the 15 read-only tools' schemas don't grow. This phase verifies the assertion is exhaustive.

5. Confirming TEST-05 (CI wiring) is in place. `npm test` already runs the new test files (`visual-session-schema-lock.test.js`, `mcp-visual-tick-lifecycle.test.js`) per Phase 255 / 256 / 257 wiring. Phase 259 adds the rewritten contract test to the same chain.

OUT OF SCOPE:
- Skill USAGE.md / references rewrites (Phase 260).
- Adding new badge labels (governed by v0.9.36 policy).
- New runtime behaviour (Phase 259 is test-only; runtime is locked from Phase 258).

</domain>

<decisions>
## Implementation Decisions

### Rewriting the contract test in place

`tests/mcp-visual-session-contract.test.js` is rewritten in place (not deleted, not renamed). Reasons:

1. **Stable filename for CI history** -- the test file lives at the same path so historical CI runs cross-reference cleanly.
2. **Existing `createChromeMock` + assertion harness reused** -- the rewrite preserves the test scaffolding that other tests in the chain depend on (or inline-imports).
3. **Discoverable** -- callers looking at the visual-session test surface find one file with the new contract assertions front-and-center.

The rewrite swaps:
- The "dispatcher validation" case (270-561) -- pre-v0.9.62 explicit-start_session validation. REPLACED with an implicit-contract validation case that asserts: action call without field bundle is rejected (VISUAL_FIELDS_REQUIRED); action call with non-allowlisted client is rejected (BADGE_NOT_ALLOWED); valid action call passes through to the dispatcher.
- The "Phase 240 ownership-aware start_session" case (562-end) -- explicit start_session lifecycle. REPLACED with an implicit-contract ownership case that asserts: cross-agent action on owned tab is rejected by v0.9.60 BEFORE the lifecycle hook fires (TIMEOUT-05 precedence).

The rewrite KEEPS:
- The "allowlist normalization and manager lifecycle" case (40-153) -- tests the allowlist module which is still valid (v0.9.36 source-of-truth, reused).
- The "persistence replay" case (154-269) -- tests `chrome.storage.session` replay which is the SAME pattern Phase 256 reused. Verify the assertions still pass against the Phase 256 lifecycle (or update them to match the new key namespace `mcpVisualSession:<tabId>` instead of v0.9.36's `fsbMcpVisualSessions`).

### TOOL_REMOVED contract test

ADD a new case at the end of the rewritten contract test (or in a new dedicated file `tests/mcp-visual-tool-removed-contract.test.js` if the planner prefers separation). The case:

1. Constructs a recording-mock MCP server.
2. Invokes the dispatcher with tool name `'start_visual_session'` and any arguments.
3. Asserts the response is a typed error with `code === 'TOOL_REMOVED'`, `removed_tool === 'start_visual_session'`, `removed_in_version === '0.9.0'`, and `references` contains the CHANGELOG anchor + README anchor.
4. Repeats for tool name `'end_visual_session'`.
5. Asserts NO bridge call / queue.enqueue is invoked (the stub short-circuits synchronously).

### TEST-03 coverage confirmation (required-field across every action tool)

Phase 255 already covers this in `tests/visual-session-schema-lock.test.js` (314 assertions; iterates the canonical 36 names). Phase 259 confirms:

1. The schema-lock test enumerates ALL 36 names from `.planning/v0.9.62-CONTRACT.md` Action Tools section. If any name is missing, add it.
2. For each of the 36 tools, there is a static-shape assertion AND a runtime-rejection assertion (the runtime portion may currently be sampled across a few tools -- Phase 259 expands to ALL 36 if the existing sampled coverage is insufficient).

### TEST-04 coverage confirmation (read-tool no-op)

Phase 255 already asserts read-only tool schemas don't grow. Phase 259 confirms:

1. The schema-lock test enumerates ALL 15 read-only tools from `.planning/v0.9.62-CONTRACT.md` Read-Only Tools section.
2. For each, the schema does NOT contain `visual_reason` / `client` / `is_final`.

### CI wiring (TEST-05)

`package.json` `scripts.test` already runs `tests/visual-session-schema-lock.test.js` and `tests/mcp-visual-tick-lifecycle.test.js`. The rewritten `tests/mcp-visual-session-contract.test.js` is already in the chain (legacy file location). After the rewrite, confirm `npm test` exits 0.

### Claude's Discretion

- Whether to keep `tests/mcp-visual-session-contract.test.js` as the rewritten file OR rename it to reflect the new contract (recommended: keep the name; the v0.9.62 contract is a refinement of the v0.9.0/v0.9.36 contract, not a different concept).
- Whether to add the TOOL_REMOVED assertions in the rewritten contract test OR a separate file (single file is cleaner; planner refines).
- Whether the per-tool runtime-rejection assertion in TEST-03 needs to cover all 36 tools individually OR sampling is sufficient (planner judges -- full enumeration is safer; sampling is faster).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/mcp-visual-session-contract.test.js` -- 690-line existing v0.9.0/v0.9.36/v0.9.60 contract test. Phase 259 rewrites in place.
- `tests/visual-session-schema-lock.test.js` -- Phase 255's 314-assertion schema test. Already covers TEST-03 + TEST-04 substantially.
- `tests/mcp-visual-tick-lifecycle.test.js` -- Phase 256's 79-assertion lifecycle test (includes is_final cases from Phase 257). Already covers TIMEOUT-01..05 + COMPLETE-01..03.
- `createChromeMock` pattern in `tests/mcp-bridge-client-lifecycle.test.js` and similar -- reused for the rewritten contract test.

### Established Patterns

- Tests are plain Node test files (no Jest / Vitest).
- Assertions use the in-file `assert` / `assertEqual` / `assertDeepEqual` helpers.
- Test files exit 0 on full PASS; non-zero on any FAIL.
- `npm test` runs files sequentially per the chain in `package.json` `scripts.test`.

### Integration Points

- `package.json` `scripts.test` -- already has the test chain.
- `tests/mcp-visual-session-contract.test.js` -- the file being rewritten.

</code_context>

<specifics>
## Specific Ideas

### Plan shape (2 plans recommended)

- **259-01 Rewrite contract test in place** -- swap the dispatcher-validation + Phase 240 ownership cases for new implicit-contract cases; add TOOL_REMOVED case; keep allowlist + persistence cases (update persistence to the new key namespace if needed).
- **259-02 Coverage confirmation + tightening** -- audit `tests/visual-session-schema-lock.test.js` against the canonical 36 / 15 lists; if any tools are sampled instead of enumerated, expand to full enumeration; confirm TEST-03 + TEST-04 are exhaustive.

Single-plan alternative: collapse to one plan with two tasks if the planner judges the audit-and-tightening as minor.

### What Phase 259 does NOT do

- No skill USAGE.md / references rewrites (Phase 260).
- No new lifecycle code (Phase 256/257 already landed).
- No new typed errors (Phase 258 already added TOOL_REMOVED).
- No version bump (Phase 258 already at 0.9.0).

</specifics>

<deferred>
## Deferred Ideas

None new.

</deferred>

---

*Phase: 259-test-rewrites-ci-lock*
*Context gathered: 2026-05-11 via smart-discuss*
