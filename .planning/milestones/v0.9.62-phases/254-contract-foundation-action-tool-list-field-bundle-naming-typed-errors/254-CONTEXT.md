# Phase 254: Contract Foundation - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart-discuss (infrastructure path -- all names already locked at milestone level)

<domain>
## Phase Boundary

Phase 254 produces a single-source-of-truth artifact under `.planning/` (filename: `.planning/v0.9.62-CONTRACT.md`) that pins five decisions every downstream phase will reference verbatim:

1. The canonical list of MCP action tools (~31 tools) carrying the new visual-session field bundle.
2. The field-bundle key names: `visual_reason` (required string), `client` (required, allowlisted), `is_final` (optional boolean).
3. The badge-allowlist reuse decision (source of truth is the existing v0.9.36 shared server/extension validator -- no per-tool duplication).
4. The three typed-error names: `VISUAL_FIELDS_REQUIRED`, `BADGE_NOT_ALLOWED`, `TOOL_REMOVED`.
5. The list of read-only MCP tools whose schemas MUST remain byte-for-byte unchanged (the "do not touch" allowlist Phase 255 will assert against).

The artifact is closed with an explicit "contract pinned -- 2026-05-11" sign-off line so downstream phases can cite it without re-deriving names. Phase 254 writes no code, runs no tests; it produces exactly one Markdown file plus the commit that publishes it.

</domain>

<decisions>
## Implementation Decisions

### Naming (already locked at milestone level)

- Field-bundle key names: `visual_reason` / `client` / `is_final` (snake_case, matching existing MCP tool argument conventions).
- Typed-error names: `VISUAL_FIELDS_REQUIRED` / `BADGE_NOT_ALLOWED` / `TOOL_REMOVED` (SCREAMING_SNAKE, matching existing v0.9.60 typed errors like `TAB_NOT_OWNED` / `AGENT_CAP_REACHED`).
- Artifact path: `.planning/v0.9.62-CONTRACT.md` (parallels prior milestone artifacts such as `.planning/v0.9.61-OPENCLAW-SPEC.md` / `.planning/v0.9.61-CLAWHUB-PUBLISH-QA.md`).

### Action-tool list (already enumerated in REQUIREMENTS.md CONTRACT-01)

Verbatim from REQUIREMENTS.md, 31 tools: `click`, `type_text`, `navigate`, `scroll`, `drag`, `select_option`, `press_key`, `press_enter`, `drag_drop`, `hover`, `focus`, `clear_input`, `check_box`, `drop_file`, `click_and_hold`, `double_click`, `right_click`, `click_at`, `scroll_at`, `double_click_at`, `drag_variable_speed`, `set_attribute`, `insert_text`, `search`, `refresh`, `go_back`, `go_forward`, `open_tab`, `close_tab`, `switch_tab`, `back`.

The plan phase verifies this list against the live MCP server tool registry (`mcp/src/index.ts` and/or `mcp/ai/tool-definitions.cjs`) before pinning -- if the live registry has changed since REQUIREMENTS.md was written, the contract artifact records the discrepancy and the plan phase asks the user before proceeding.

### Read-only "do not touch" list (to be enumerated)

REQUIREMENTS.md CONTRACT-05 names a starting set: `get_text`, `read_page`, `list_tabs`, `get_dom_snapshot`, `get_page_snapshot`, `get_attribute`, `get_logs`, `get_task_status`, `search_memory`, `wait_for_element`, `wait_for_stable`. The plan phase enumerates the **complete** read-only set by inspecting the live tool registry (any MCP tool whose handler is read-only, i.e. does not mutate DOM / page state) so Phase 255 / Phase 259 have an exhaustive "do not touch" allowlist to assert against. The contract artifact records the complete list.

### Sign-off line format

Final line of `.planning/v0.9.62-CONTRACT.md`:

```
Contract pinned: 2026-05-11 -- v0.9.62 Implicit Visual Session Contract -- LakshmanTurlapati
```

Anchors a stable, citable marker. Downstream phases cite by path + sign-off line.

### Claude's Discretion

Document layout, table styling, and section ordering inside the artifact are at Claude's discretion -- the only contract is that the five locked decisions (names, action-tool list, read-only list, allowlist source, error names) are present, unambiguous, and citable.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `.planning/v0.9.61-OPENCLAW-SPEC.md` -- precedent for milestone-pinned spec artifact under `.planning/`; matches the shape we want for v0.9.62-CONTRACT.md.
- `.planning/MILESTONES.md` -- index of past milestone artifacts; v0.9.62-CONTRACT.md should be linkable from here at milestone close.
- `mcp/src/index.ts` and `mcp/ai/tool-definitions.cjs` -- canonical sources for the live MCP tool registry; plan phase reads these to validate the action-tool list and to derive the complete read-only list.
- v0.9.36 shared badge-allowlist validator -- source of truth for `client` validation; the contract artifact cites the validator location (path + symbol) without duplicating its allowlist values.
- v0.9.60 typed-error precedents (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`) -- naming convention model for the three new typed errors.

### Established Patterns

- Milestone-pinned artifacts live at `.planning/v{X.Y}-{NAME}.md` and are NOT inside the per-phase directory (they survive past the closing phase and are linkable from CHANGELOG / MILESTONES.md).
- ASCII-only diagnostics and docs (no emojis); plain status markers (`[OK]` / `[FAIL]` / `[WARN]` if needed) per repo convention.
- Markdown tables for tool / error / decision enumerations (precedent: `.planning/v0.9.61-OPENCLAW-SPEC.md`).
- Sign-off lines at the bottom of pinned artifacts (precedent: requirements / spec docs from v0.9.60 / v0.9.61).

### Integration Points

- `.planning/MILESTONES.md` index updated at milestone close (Phase 260 / lifecycle) -- not in Phase 254.
- CHANGELOG migration recipe (Phase 258) cites this artifact for stable name authority.
- `TOOL_REMOVED` error body (Phase 258) cites this artifact for the migration recipe pointer.
- All downstream phases (255-260) reference this artifact by path + sign-off line when their plans / tests / docs use the locked names.

</code_context>

<specifics>
## Specific Ideas

- Artifact filename is `.planning/v0.9.62-CONTRACT.md` -- not `.planning/phases/254-.../CONTRACT.md`, because the artifact is referenced from milestone-level CHANGELOG, mcp/README, and skill docs that should not encode a per-phase directory path.
- Contract artifact contains a "Tool list verification status" subsection that records the result of cross-checking REQUIREMENTS.md CONTRACT-01 against the live tool registry: either "verified -- list matches" or a structured diff with user follow-up notes.
- Contract artifact contains a "Read-only schema lock list" enumerating every read-only MCP tool whose schema MUST remain unchanged. Phase 255 implementation tests and Phase 259 CI tests assert against this list verbatim.
- No code edits in Phase 254. No tests in Phase 254. Just the artifact, plus a git commit publishing it.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. Field-bundle JSON-schema declaration, the actual schema enforcement, the lifecycle code, the removal, the migration error body, and the doc rewrites all live in their downstream phases per the locked roadmap dependency graph.

</deferred>
