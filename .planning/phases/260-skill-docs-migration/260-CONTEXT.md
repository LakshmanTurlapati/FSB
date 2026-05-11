# Phase 260: Skill Docs Migration - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart-discuss
**Authoritative reference:** `.planning/v0.9.62-CONTRACT.md`

<domain>
## Phase Boundary

Phase 260 brings the FSB Skill (OpenClaw) documentation surfaces in line with the v0.9.62 implicit contract. Phase 258 already updated the package-level docs (mcp/README.md banner + CHANGELOG); Phase 260 owns the skill-level docs.

Four files updated:

1. **`skills/FSB Skill/USAGE.md`** (DOCS-01) -- top-of-file banner flagging the v0.9.0 / v0.9.62 breaking change, link to CHANGELOG + mcp/README anchors; removed any instructions to call explicit `start_visual_session` / `end_visual_session`; added at least one worked example showing the field bundle (`visual_reason` + `client`) on a sample action-tool call; added a second example showing `is_final: true` on the final action of a task.

2. **`skills/FSB Skill/references/visual-session-lifecycle.md`** (DOCS-02) -- rewritten for the implicit-lifecycle pattern: every action tool requires the field bundle; sliding 60-second window re-arms per call; `is_final: true` clears immediately; read tools do NOT carry the bundle; one concrete contrast example (action-tool call WITH bundle vs read-tool call WITHOUT).

3. **`skills/FSB Skill/references/tool-decision-tree.md`** (DOCS-03) -- updated so any branch that lands on an action tool tells the caller to supply `visual_reason` + `client` (and to consider `is_final: true` on the last action of a task); read-first guidance for `read_page` / `get_dom_snapshot` / `get_page_snapshot` preserved unchanged; the tree no longer references the removed `start_visual_session` / `end_visual_session` tools.

4. **`skills/FSB Skill/SKILL.md`** body OR a new supplementary doc under `references/` (DOCS-04) -- carries the canonical action-tool list (or links to `.planning/v0.9.62-CONTRACT.md` Action Tools section as the source of truth) so a caller can answer "does this tool require the field bundle?" by lookup.

Skill test (`tests/skill-fsb-spec.test.js`) MUST still pass after the doc updates.

OUT OF SCOPE:
- New runtime behaviour (Phases 255-258 already landed).
- New tests (Phase 259 already landed the contract test + CI lock).
- Package republish.
- Backporting docs to skills/FSB Skill/ files outside the four listed above.

</domain>

<decisions>
## Implementation Decisions

### USAGE.md banner format

Top-of-file (after the H1 + intro paragraphs if any), insert a blockquote banner:

```markdown
> **v0.9.0 breaking change** -- The explicit `start_visual_session` / `end_visual_session` tools were REMOVED in fsb-mcp-server v0.9.0. Action tools now require `visual_reason` + `client` fields in every call (validated against the v0.9.36 badge allowlist). See [`mcp/CHANGELOG.md`](../../mcp/CHANGELOG.md#v0.9.0) and [`mcp/README.md`](../../mcp/README.md#visual-session-lifecycle) for the migration recipe.
```

### USAGE.md worked example

Add a section "v0.9.62 visual-session contract" with two examples:

```markdown
### Example 1 -- action call with the implicit visual session

```
mcp> click({ selector: '#submit', visual_reason: 'Completing checkout', client: 'Claude' })
```

The overlay glow appears on the active tab with the supplied reason. Subsequent action calls within 60 seconds re-arm the death timer. After 60 seconds of silence, the overlay clears automatically.

### Example 2 -- final action of a task (is_final clear)

```
mcp> click({ selector: '#confirm-order', visual_reason: 'Confirming order', client: 'Claude', is_final: true })
```

The overlay clears immediately after the underlying click completes -- no 60-second wait.
```

### visual-session-lifecycle.md rewrite

Replace existing content with implicit-lifecycle explanation:

- What the field bundle is (`visual_reason` + `client` + `is_final`).
- Implicit start: first action call creates the session.
- Sliding window: 60 seconds re-armed per action call.
- Auto-clear: prolonged silence (60s without an action call) clears the overlay.
- Explicit completion: `is_final: true` clears immediately after the action's change_report resolves.
- Read tools do NOT carry the bundle (one concrete example contrasting action tool WITH bundle vs read tool WITHOUT).
- Pointer to `.planning/v0.9.62-CONTRACT.md` for the canonical lists.

### tool-decision-tree.md update

Add a "Field bundle required?" check at every action-tool branch. Pseudocode:

```
If choosing an action tool (click, type_text, navigate, scroll, drag, ...):
  -> supply visual_reason (short human-readable reason) AND client (allowlisted: Claude / Codex / ...)
  -> if this is the LAST action of a task, also supply is_final: true to clear the overlay immediately

If choosing a read tool (read_page, get_dom_snapshot, list_tabs, ...):
  -> the field bundle is NOT required (read tools do not carry the bundle)
```

Remove any reference to `start_visual_session` / `end_visual_session` (the tools are removed; the decision tree should not advertise them).

### SKILL.md update / supplementary doc

Add a "v0.9.62 contract surfaces" section to SKILL.md body (or create `skills/FSB Skill/references/v0.9.62-contract.md` and link from SKILL.md) listing:

- The canonical 36 action-tool names (or "see `.planning/v0.9.62-CONTRACT.md` Action Tools section" if the skill is shipped as part of the repo).
- The 15 read-only tool names.
- The three typed-error names (VISUAL_FIELDS_REQUIRED, BADGE_NOT_ALLOWED, TOOL_REMOVED).

For the OpenClaw skill which is shipped externally, the linked artifact may need to be a copy of the contract doc OR a public URL once the repo is public.

### Claude's Discretion

- Exact section heading text.
- Whether SKILL.md gets the canonical list inline OR links to `.planning/v0.9.62-CONTRACT.md` (suggest linking; the contract doc is the single source of truth).
- Whether to mention specific allowlisted client labels in USAGE.md examples (acceptable; the allowlist values are stable per v0.9.36).
- Whether the visual-session-lifecycle.md gets a state-diagram (allowed but not required).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `.planning/v0.9.62-CONTRACT.md` (Phase 254 pinned artifact) -- canonical source for action-tool list / read-only list / typed-error names / field-bundle keys.
- `mcp/CHANGELOG.md` (Phase 258) -- v0.9.0 entry with migration recipe; USAGE.md banner links here.
- `mcp/README.md` (Phase 258) -- visual-session section banner; USAGE.md links here.
- `extension/utils/mcp-visual-session.js` -- allowlist source-of-truth (read-only; not edited by Phase 260).

### Established Patterns

- Skill docs are markdown files under `skills/FSB Skill/`.
- ASCII-only diagnostics; no emojis.
- Cross-doc links use relative paths within the repo (e.g. `../../mcp/CHANGELOG.md`).
- `tests/skill-fsb-spec.test.js` validates skill doc structure / required content -- the rewrites must keep this test green.

### Integration Points

- `skills/FSB Skill/USAGE.md` -- top-of-file banner + new examples.
- `skills/FSB Skill/references/visual-session-lifecycle.md` -- full rewrite.
- `skills/FSB Skill/references/tool-decision-tree.md` -- per-branch updates.
- `skills/FSB Skill/SKILL.md` -- canonical action-tool list pointer (or supplementary doc).
- `tests/skill-fsb-spec.test.js` -- must still pass.

</code_context>

<specifics>
## Specific Ideas

### Plan shape (1 plan recommended)

Single plan `260-01-PLAN.md` with 4 tasks (one per file):

1. USAGE.md banner + worked examples (DOCS-01).
2. visual-session-lifecycle.md rewrite (DOCS-02).
3. tool-decision-tree.md update (DOCS-03).
4. SKILL.md update or supplementary doc creation (DOCS-04).

Or two plans if the planner prefers to separate the rewrite-heavy USAGE.md from the lighter SKILL.md + references updates.

### What Phase 260 does NOT do

- No new runtime code.
- No new tests.
- No CHANGELOG edits (Phase 258 already wrote v0.9.0).
- No mcp/README.md edits (Phase 258 already wrote the banner).

</specifics>

<deferred>
## Deferred Ideas

None new.

</deferred>

---

*Phase: 260-skill-docs-migration*
*Context gathered: 2026-05-11 via smart-discuss*
