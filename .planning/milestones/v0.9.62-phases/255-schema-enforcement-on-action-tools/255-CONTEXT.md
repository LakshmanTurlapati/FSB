# Phase 255: Schema Enforcement on Action Tools - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart-discuss (decisions locked at milestone level; this CONTEXT locks the implementation-shape decisions)
**Authoritative reference:** `.planning/v0.9.62-CONTRACT.md` (pinned by Phase 254). Plans MUST cite this artifact verbatim for field names, tool list, typed-error names, and the read-only schema-lock list.

<domain>
## Phase Boundary

Phase 255 wires the v0.9.62 visual-session field bundle into the MCP server's input-schema layer. The contract document was pinned by Phase 254; Phase 255 makes it executable end-to-end:

1. Every action tool in the canonical 36-name list (see `.planning/v0.9.62-CONTRACT.md` Action Tools section) declares `visual_reason` (required string), `client` (required, allowlisted string), and `is_final` (optional boolean) in its MCP input schema. Discoverable via the MCP server's `tools/list` response.
2. Calls to any action tool that omit `visual_reason` or `client` are rejected before the underlying action executes (no DOM mutation, no `change_report`, no overlay state change) with a typed `VISUAL_FIELDS_REQUIRED` error.
3. Calls with a `client` value not on the v0.9.36 shared allowlist are rejected with a typed `BADGE_NOT_ALLOWED` error.
4. The two `wait_for_*` tools (`wait_for_element`, `wait_for_stable`) have their registry `_readOnly` flag flipped from `false` to `true` in `mcp/ai/tool-definitions.cjs`, completing the milestone-level reclassification from Phase 254.
5. All 15 read-only MCP tools (see `.planning/v0.9.62-CONTRACT.md` Read-Only Tools section) retain byte-for-byte unchanged input schemas; an automated check in the test harness asserts this invariant.

The lifecycle (sliding 60s window, implicit start, MV3 SW-eviction replay) is OUT OF SCOPE for Phase 255; lifecycle work lands in Phase 256. The `is_final` semantics is OUT OF SCOPE for Phase 255 (Phase 257). Removal of the old explicit tools is OUT OF SCOPE for Phase 255 (Phase 258). Phase 255 is strictly the schema layer + the typed-error rejection path.

</domain>

<decisions>
## Implementation Decisions

### Schema declaration shape (shared fragment, not copy-paste)

The field bundle is declared exactly ONCE as an exported fragment from `mcp/ai/tool-definitions.cjs`. Each action tool merges the fragment into its `inputSchema.properties` + `inputSchema.required` arrays via a small helper. This avoids copy-pasting the bundle across 36 tool definitions and keeps the contract surface auditable from a single source.

Concretely:

```javascript
// mcp/ai/tool-definitions.cjs
const VISUAL_SESSION_FIELDS = {
  visual_reason: { type: 'string', description: 'Short human-readable reason shown in the overlay. Required.' },
  client: { type: 'string', description: 'Allowlisted client label (validated against the shared v0.9.36 server/extension allowlist). Required.' },
  is_final: { type: 'boolean', description: 'When true, the visual session clears immediately after this tool resolves. Optional (default false).' },
};
const VISUAL_SESSION_REQUIRED = ['visual_reason', 'client'];

function withVisualSessionFields(tool) {
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: { ...tool.inputSchema.properties, ...VISUAL_SESSION_FIELDS },
      required: Array.from(new Set([...(tool.inputSchema.required || []), ...VISUAL_SESSION_REQUIRED])),
    },
  };
}
```

The planner is free to refine the helper name and placement, but the SHAPE is locked: one fragment, one merge helper, applied to every action tool in the canonical list.

### Validator location: dispatch chokepoint (NOT per-tool)

The required-field + allowlist validation runs at the SAME chokepoint that v0.9.60 ownership gating uses (`dispatchMcpToolRoute` or its current equivalent in `mcp/src/index.ts` / `mcp/src/dispatch.ts`). This guarantees:

- A single source of truth for "did this call satisfy the contract?"
- Validation runs in the same microtask as dispatch -- no TOCTOU window between gate and execution (mirrors v0.9.60 D-16 closure)
- Read-only tool calls skip the validator entirely (the chokepoint inspects `_readOnly` from `TOOL_REGISTRY` and routes accordingly)

Validation order at the chokepoint (apply in this order on every action-tool call):
1. Tool exists in the registry (existing behaviour, unchanged).
2. Tool is `_readOnly: false` (action tool). If `_readOnly: true`, skip steps 3-4.
3. `visual_reason` AND `client` are present and non-empty in the call's arguments. If either missing -> reject with `VISUAL_FIELDS_REQUIRED`.
4. `client` value passes `isAllowedMcpVisualClientLabel(raw)` (imported from `extension/utils/mcp-visual-session.js` mirror or `mcp/src/tools/visual-session.ts` whichever the server-side already uses). If not allowed -> reject with `BADGE_NOT_ALLOWED`.
5. Existing v0.9.60 ownership / agent registration gate (unchanged).
6. Action executes.

The validator returns the typed-error object using the same `mcp/src/errors.ts` machinery that produces `TAB_NOT_OWNED` / `AGENT_CAP_REACHED` today.

### Typed-error wiring: extend mcp/src/errors.ts

Add the two new error codes to the existing `CODE_ONLY_ERROR_KEYS` set (or its equivalent registry of typed errors) in `mcp/src/errors.ts`:

- `VISUAL_FIELDS_REQUIRED`
- `BADGE_NOT_ALLOWED`

(`TOOL_REMOVED` is added by Phase 258, not Phase 255.)

The error bodies are short, ASCII-only, and follow the v0.9.60 typed-error body conventions. See `.planning/v0.9.62-CONTRACT.md` -> Typed Errors section for the exact body intent text.

### Badge allowlist: import from existing source-of-truth, do NOT re-declare

Server-side validation imports `isAllowedMcpVisualClientLabel` (or the equivalent normalised checker) from whichever module already declares `MCP_VISUAL_CLIENT_LABELS` on the server side. Per `.planning/v0.9.62-CONTRACT.md`:

- Canonical source: `extension/utils/mcp-visual-session.js`
- MCP-side mirror: `mcp/src/tools/visual-session.ts` (lines 10-27)

If the server-side mirror lives in `visual-session.ts` and the dispatcher is in `dispatch.ts` or `index.ts`, the planner adds an import from the visual-session module into the dispatcher. NO new allowlist constant is created. NO per-tool duplication.

### Read-only `_readOnly` flag flips for wait_for_*

Edit `mcp/ai/tool-definitions.cjs` to flip the two ToolDefinition entries:

- `wait_for_element`: `_readOnly: false` -> `_readOnly: true`
- `wait_for_stable`: `_readOnly: false` -> `_readOnly: true`

This is the milestone-level reclassification recorded in Phase 254. After the flip, the live registry agrees with `.planning/v0.9.62-CONTRACT.md` Read-Only Tools section (15 read-only tools total).

### Read-only schema lock assertion

A small test (placed in `tests/`, wired into `npm test`) reads `TOOL_REGISTRY` and asserts:

- Every tool with `_readOnly: true` has an `inputSchema.properties` that does NOT contain `visual_reason`, `client`, or `is_final`.
- Every tool whose name appears in `.planning/v0.9.62-CONTRACT.md` Read-Only Tools section has `_readOnly: true`.

This is the implementation-time enforcement of CONTRACT-05; Phase 259 owns the CI lock layer of the same invariant (TEST-04).

### Claude's Discretion

- Exact helper name (`withVisualSessionFields` vs `addVisualSessionFields` vs other).
- Exact dispatcher file path (planner discovers the live name during planning).
- Exact location of the schema-lock test file (suggest `tests/visual-session-schema-lock.test.js` or similar; planner decides).
- Whether the validator emits structured logs on rejection for diagnostics (allowed but not required).
- Whether the schema declaration uses TypeScript types via JSDoc or stays plain CJS (codebase convention is plain CJS in `tool-definitions.cjs`; planner respects).
- Comment style and JSDoc placement on the new exported helper.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `mcp/ai/tool-definitions.cjs` -- canonical `TOOL_REGISTRY` (51 ToolDefinition entries as of 2026-05-11). Phase 255 modifies this file: adds the field-bundle fragment + merge helper, applies the helper to the 36 action tools, and flips `_readOnly` on `wait_for_element` and `wait_for_stable`.
- `mcp/src/tools/schema-bridge.ts` (lines 39-57) -- defines the `ToolDefinition` TypeScript interface. If the new helper changes the runtime shape (it does not, just adds optional keys), this file is unchanged.
- `mcp/src/tools/visual-session.ts` (lines 10-27) -- MCP-side mirror of `MCP_VISUAL_CLIENT_LABELS`. Phase 255 imports `isAllowedMcpVisualClientLabel` (or equivalent normalised checker) from this module into the dispatcher.
- `extension/utils/mcp-visual-session.js` (lines 4-46) -- canonical badge-allowlist source-of-truth. Phase 255 does NOT touch this file (existing v0.9.36 behaviour is preserved).
- `mcp/src/errors.ts` (lines 54-63) -- existing `CODE_ONLY_ERROR_KEYS` typed-error registry. Phase 255 adds two entries: `VISUAL_FIELDS_REQUIRED` and `BADGE_NOT_ALLOWED`, following the SCREAMING_SNAKE_CASE convention precedent (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, etc.).
- The v0.9.60 dispatch-gate pattern (`dispatchMcpToolRoute` or its current equivalent) -- the chokepoint where ownership rejection happens. Phase 255 adds the visual-fields validator at the SAME chokepoint, BEFORE the ownership gate so missing-fields rejection happens first regardless of tab ownership.

### Established Patterns

- Typed errors follow `mcp/src/errors.ts` precedent: SCREAMING_SNAKE_CASE name, structured error body, registered in the code-only error key set.
- Tool registration uses the CJS pattern (`mcp/ai/tool-definitions.cjs` exports `TOOL_REGISTRY` as a single array, consumed by `server.tool(...)` registrations).
- Dispatch validators run inline in the dispatch function (no separate middleware pipeline) -- ownership gating sets this precedent in v0.9.60.
- Schema fragments are kept inline in `tool-definitions.cjs`; the file is the single source-of-truth for tool surface.
- Tests live in `tests/` at repo root; `npm test` discovers them automatically; CI runs `npm test` as part of `ci / all-green`.

### Integration Points

- `mcp/src/index.ts` (or wherever `server.tool(...)` registrations call into `TOOL_REGISTRY`) -- consumes the modified registry; no edits needed if registrations iterate `TOOL_REGISTRY` already.
- The dispatcher (`dispatchMcpToolRoute` equivalent) -- gains the visual-fields validator step before the ownership gate.
- `tests/` -- gains the new schema-lock test file.
- `package.json` `npm test` script -- already runs `*.test.js` in `tests/`; the new test file auto-picks up.
- `ci / all-green` GitHub Actions check -- already runs `npm test`; the new test is gated by it automatically.

</code_context>

<specifics>
## Specific Ideas

### Atomic commit shape

The plan commits in this order so each commit is independently revertable:

1. `feat(255): add visual-session field bundle + withVisualSessionFields helper to tool-definitions.cjs` -- the helper + the fragment, without applying it yet (tool schemas unchanged at this commit; only new exports).
2. `feat(255): apply visual-session bundle to 36 canonical action tools` -- the helper is applied to every action tool in the canonical list; `tools/list` output now declares the new fields on those tools.
3. `feat(255): flip _readOnly flag on wait_for_element / wait_for_stable` -- registry classification matches `.planning/v0.9.62-CONTRACT.md`.
4. `feat(255): VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED typed errors` -- extends `mcp/src/errors.ts`.
5. `feat(255): dispatch-gate validator for visual-session fields + badge allowlist` -- wires the validator into the dispatch chokepoint; calls now reject with the typed errors.
6. `test(255): schema-lock invariants for read-only tools and action-tool field bundle` -- the new test file + `npm test` wiring.

Six commits keeps each step independently revertable and reviewable. The planner can collapse 1+2 if the helper is only useful once it's applied; the planner can collapse 4+5 if errors and the validator land naturally together. Six is the maximum; three is the minimum.

### Test scope

The Phase 255 schema-lock test asserts:

1. Every action tool in the canonical 36-name list has `visual_reason` and `client` in `inputSchema.required`.
2. Every action tool has `visual_reason` (type: string), `client` (type: string), `is_final` (type: boolean) in `inputSchema.properties`.
3. Every read-only tool in the 15-name list has none of `visual_reason` / `client` / `is_final` in `inputSchema.properties` and `inputSchema.required` is unchanged from pre-v0.9.62 (record the pre-v0.9.62 required set per tool inline or in a fixture).
4. `wait_for_element` and `wait_for_stable` have `_readOnly: true`.
5. Calling an action tool with missing `visual_reason` returns `VISUAL_FIELDS_REQUIRED` (integration-style via the dispatch chokepoint mock).
6. Calling an action tool with an unknown `client` returns `BADGE_NOT_ALLOWED`.

This is Phase 255's local test surface. Phase 259 owns the broader CI lock with end-to-end coverage.

### What Phase 255 does NOT do

- No lifecycle code (no death timer, no `chrome.storage.session` replay, no implicit start). Phase 256.
- No `is_final` semantics (Phase 257; the schema accepts the field but the runtime does nothing with it yet).
- No removal of explicit `visual_session` tools (Phase 258; old tools still work as the new schema lands).
- No CHANGELOG entry (Phase 258).
- No skill USAGE.md changes (Phase 260).
- No tests beyond the schema-lock + typed-error rejection (Phase 259 owns the broader contract test).

</specifics>

<deferred>
## Deferred Ideas

None for Phase 255. All lifecycle / completion / removal / docs work is explicitly scoped to downstream phases per the locked ROADMAP dependency graph.

</deferred>

---

*Phase: 255-schema-enforcement-on-action-tools*
*Context gathered: 2026-05-11 via smart-discuss (decisions locked at milestone level)*
