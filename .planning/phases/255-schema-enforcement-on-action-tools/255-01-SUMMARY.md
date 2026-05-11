---
phase: 255-schema-enforcement-on-action-tools
plan: 01
subsystem: mcp-tool-registry
tags: [v0.9.62, visual-session, schema, tool-definitions, parity]
requires: [254-01]
provides:
  - VISUAL_SESSION_FIELDS fragment exported from mcp/ai/tool-definitions.cjs
  - VISUAL_SESSION_REQUIRED array exported from mcp/ai/tool-definitions.cjs
  - withVisualSessionFields(tool) merge helper exported from mcp/ai/tool-definitions.cjs
  - 36 action tools carry visual_reason / client / is_final in inputSchema.properties
  - 36 action tools require visual_reason and client in inputSchema.required
  - wait_for_element reclassified to _readOnly: true
  - wait_for_stable reclassified to _readOnly: true
  - extension/ai/tool-definitions.js byte-identical mirror of mcp/ai/tool-definitions.cjs
affects:
  - mcp/ai/tool-definitions.cjs (added 60-line export block at file head; wrapped 36 entries; flipped 2 _readOnly flags; expanded module.exports)
  - extension/ai/tool-definitions.js (copied verbatim from CJS to preserve byte-identity invariant)
tech_stack:
  added: []
  patterns:
    - shared-fragment-and-merge-helper (one declaration; per-entry wrap via withVisualSessionFields)
    - byte-identity-mirror (extension/ai/tool-definitions.js == mcp/ai/tool-definitions.cjs)
key_files:
  created: []
  modified:
    - mcp/ai/tool-definitions.cjs
    - extension/ai/tool-definitions.js
decisions:
  - Used the helper name withVisualSessionFields (matches CONTEXT.md preferred name; not addVisualSessionFields).
  - Declared the fragment ABOVE the JSDoc typedef so the TOOL_REGISTRY literal that follows can reference the helper inline.
  - Mirrored CJS to JS via a verbatim cp (preserves trailing newline and every byte) rather than an Edit-by-Edit replay; the parity test asserts Buffer.compare === 0.
  - Combined all three plan tasks into a single commit because the plan explicitly states "single commit covering Tasks 1-3" -- the wrapped registry references the helper, and the parity mirror references the wrapped registry.
metrics:
  duration: ~25 minutes
  completed_date: 2026-05-11
  files_modified: 2
  commits: 1
  tasks_completed: 3
---

# Phase 255 Plan 01: Schema Enforcement on Action Tools Summary

## One-liner

Declared the v0.9.62 visual-session field bundle as a shared CJS fragment + `withVisualSessionFields` merge helper, applied it to all 36 canonical action tools, flipped `_readOnly` to `true` on `wait_for_element` and `wait_for_stable`, and kept the extension/MCP tool-definitions files byte-identical.

## What was wired

This plan is the schema-layer foundation of Phase 255. After this plan lands the MCP server's `tools/list` output advertises `visual_reason` (required string), `client` (required string), and `is_final` (optional boolean) on every action tool. Read-only tools' input schemas remain byte-for-byte unchanged. No validator is wired yet (Plan 03 owns the dispatch chokepoint) and no typed-error names are declared yet (Plan 02 owns `VISUAL_FIELDS_REQUIRED` / `BADGE_NOT_ALLOWED`); this plan is strictly the registry shape.

### Concrete changes

1. **Fragment + helper declaration (mcp/ai/tool-definitions.cjs, lines 18-77).** A 60-line block was inserted between `'use strict';` and the `ToolDefinition` JSDoc typedef. It declares:
   - `VISUAL_SESSION_FIELDS` -- a three-key object: `visual_reason` (string), `client` (string), `is_final` (boolean). Citation to `.planning/v0.9.62-CONTRACT.md` appears in the leading comment.
   - `VISUAL_SESSION_REQUIRED` -- the array `['visual_reason', 'client']`.
   - `withVisualSessionFields(tool)` -- returns a new `ToolDefinition` whose `inputSchema.properties` is `{ ...existing, ...VISUAL_SESSION_FIELDS }` and whose `inputSchema.required` is `Array.from(new Set([...existing, ...VISUAL_SESSION_REQUIRED]))` (deduplicated).

2. **Helper applied to all 36 action tools (mcp/ai/tool-definitions.cjs).** Each of the 36 canonical action tool object literals in `TOOL_REGISTRY` was wrapped: `{ name: 'X', ... }` became `withVisualSessionFields({ name: 'X', ... })`. The wraps were applied via a one-shot Node migration script (cleaned up after use) that walked the brace structure of the array, identified top-level entries by `name: '<X>'`, and only wrapped entries whose name appears in the 36-name list. The script verified all 51 registry entries were accounted for (36 action + 15 read-only) before writing.

3. **wait_for_* reclassified (mcp/ai/tool-definitions.cjs).** `wait_for_element` (entry at lines 586-603 after edits) and `wait_for_stable` (entry at lines 605-621 after edits) both have `_readOnly: true` now (flipped from `false`). They are NOT wrapped with `withVisualSessionFields`. This reclassification matches `.planning/v0.9.62-CONTRACT.md` Resolutions applied entry 2.

4. **module.exports expanded (mcp/ai/tool-definitions.cjs, lines 1251-1261).** The exports block now includes `VISUAL_SESSION_FIELDS`, `VISUAL_SESSION_REQUIRED`, and `withVisualSessionFields` alongside the existing `TOOL_REGISTRY`, `getToolByName`, `getReadOnlyTools`, `getToolsByRoute`.

5. **Byte-identity mirror (extension/ai/tool-definitions.js).** The entire CJS file was copied verbatim over the JS mirror via `cp`. Both files are now 80233 bytes and pass `diff -q` with no differences. The existing parity invariant in `tests/tool-definitions-parity.test.js` (Buffer.compare === 0) keeps passing.

## Concrete grep / node-smoke commands to verify the schema layer

Future plans (or anyone debugging) can rerun these to confirm the schema layer is intact:

```sh
# Fragment + helper declared and exported
grep -nE "^const VISUAL_SESSION_FIELDS = \{" mcp/ai/tool-definitions.cjs
grep -nE "^const VISUAL_SESSION_REQUIRED = \['visual_reason', 'client'\];" mcp/ai/tool-definitions.cjs
grep -nE "^function withVisualSessionFields\(tool\) \{" mcp/ai/tool-definitions.cjs

# Helper applied 36 times in the array literal (plus 1 declaration + 1 export reference = 38 total)
grep -c "withVisualSessionFields(" mcp/ai/tool-definitions.cjs

# _readOnly counts -- 15 read-only entries + 36 action entries
grep -c "_readOnly: true," mcp/ai/tool-definitions.cjs
grep -c "_readOnly: false," mcp/ai/tool-definitions.cjs

# Byte-identity mirror
diff -q mcp/ai/tool-definitions.cjs extension/ai/tool-definitions.js

# Parity test
node tests/tool-definitions-parity.test.js
```

### Node smoke: every action tool carries the bundle; every read-only tool does not

```sh
node -e "
const m = require('./mcp/ai/tool-definitions.cjs');
const ACTION_TOOLS = ['click','type_text','navigate','scroll','drag','select_option','press_key','press_enter','drag_drop','hover','focus','clear_input','check_box','drop_file','click_and_hold','double_click','right_click','click_at','scroll_at','double_click_at','drag_variable_speed','set_attribute','insert_text','search','refresh','go_back','go_forward','open_tab','close_tab','switch_tab','execute_js','select_text_range','scroll_to_top','scroll_to_bottom','scroll_to_element','fill_sheet'];
const READ_ONLY = ['read_sheet','read_page','get_text','get_attribute','get_dom_snapshot','list_tabs','get_page_snapshot','get_site_guide','search_memory','report_progress','complete_task','partial_task','fail_task','wait_for_element','wait_for_stable'];
let fails = 0;
for (const name of ACTION_TOOLS) {
  const t = m.getToolByName(name);
  if (!t) { console.error('MISSING: ' + name); fails++; continue; }
  const p = t.inputSchema.properties;
  if (!p.visual_reason || !p.client || !p.is_final) { console.error(name + ' missing bundle'); fails++; }
  const r = t.inputSchema.required || [];
  if (r.indexOf('visual_reason') < 0 || r.indexOf('client') < 0) { console.error(name + ' missing required'); fails++; }
}
for (const name of READ_ONLY) {
  const t = m.getToolByName(name);
  if (!t) { console.error('MISSING: ' + name); fails++; continue; }
  if (!t._readOnly) { console.error(name + ' should be read-only'); fails++; }
  const p = t.inputSchema.properties;
  if (p.visual_reason || p.client || p.is_final) { console.error(name + ' has bundle (should not)'); fails++; }
}
if (fails > 0) process.exit(1);
console.log('OK: 36 action tools carry bundle + 15 read-only tools do not');
"
```

Expected output: `OK: 36 action tools carry bundle + 15 read-only tools do not`.

## Where Plan 02 and Plan 03 pick up

- **Plan 02 (typed-error declarations)** extends `mcp/src/errors.ts` with two new SCREAMING_SNAKE_CASE entries: `VISUAL_FIELDS_REQUIRED` (schema-layer rejection for missing bundle fields) and `BADGE_NOT_ALLOWED` (allowlist rejection for unrecognized `client` values). `TOOL_REMOVED` is added by Phase 258, not Plan 02. See `.planning/v0.9.62-CONTRACT.md` Typed Errors section for body intent text.

- **Plan 03 (dispatch-chokepoint validator)** wires the validator into the SAME dispatch chokepoint that v0.9.60 ownership gating uses (likely `mcp/src/tools/manual.ts` per CONTEXT.md, or the current `dispatchMcpToolRoute` equivalent). Validation order on every action-tool call: (1) tool exists in registry, (2) tool is `_readOnly: false` (else skip steps 3-4), (3) `visual_reason` AND `client` are present and non-empty (else `VISUAL_FIELDS_REQUIRED`), (4) `client` passes `isAllowedMcpVisualClientLabel(raw)` from `mcp/src/tools/visual-session.ts` (else `BADGE_NOT_ALLOWED`), (5) existing v0.9.60 ownership / agent registration gate, (6) action executes. Read-only tool calls skip the validator entirely (the chokepoint inspects `_readOnly` from `TOOL_REGISTRY` and routes accordingly).

- **Plan 04 (read-only schema lock test)** asserts at the test layer that the 15 read-only tools have NOT acquired `visual_reason` / `client` / `is_final` in their input schemas, plus an integration-style check that an action-tool call missing the bundle returns `VISUAL_FIELDS_REQUIRED` and that an action-tool call with an unrecognized `client` returns `BADGE_NOT_ALLOWED`.

## Action Tools list this plan applied (verbatim from .planning/v0.9.62-CONTRACT.md Action Tools section)

```
click
type_text
navigate
scroll
drag
select_option
press_key
press_enter
drag_drop
hover
focus
clear_input
check_box
drop_file
click_and_hold
double_click
right_click
click_at
scroll_at
double_click_at
drag_variable_speed
set_attribute
insert_text
search
refresh
go_back
go_forward
open_tab
close_tab
switch_tab
execute_js
select_text_range
scroll_to_top
scroll_to_bottom
scroll_to_element
fill_sheet
```

Count: 36. Every entry above now has `visual_reason`, `client`, `is_final` in `inputSchema.properties` and `visual_reason`, `client` in `inputSchema.required`.

## Read-Only Tools list this plan locked (verbatim from .planning/v0.9.62-CONTRACT.md Read-Only Tools section)

```
read_sheet
read_page
get_text
get_attribute
get_dom_snapshot
list_tabs
get_page_snapshot
get_site_guide
search_memory
report_progress
complete_task
partial_task
fail_task
wait_for_element
wait_for_stable
```

Count: 15. Every entry above has `_readOnly: true` and an `inputSchema` that does NOT contain `visual_reason`, `client`, or `is_final`.

## Deviations from plan

None. Plan executed exactly as written.

The plan explicitly directed combining Tasks 1, 2, and 3 into a single commit (Plan Task 3 action block, lines 405-417). That guidance was followed: one commit, `feat(255-01): apply visual-session field bundle to 36 action tools and reclassify wait_for_*`, hash `336f3a9`.

## Commits

| Commit  | Subject                                                                                                | Files modified                                                | Tasks |
| ------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----- |
| 336f3a9 | feat(255-01): apply visual-session field bundle to 36 action tools and reclassify wait_for_*           | mcp/ai/tool-definitions.cjs, extension/ai/tool-definitions.js | 1+2+3 |

## Verification status

| Check                                                                                                           | Result                                                       |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `node -c mcp/ai/tool-definitions.cjs`                                                                           | SYNTAX OK                                                    |
| `node -c extension/ai/tool-definitions.js`                                                                      | SYNTAX OK                                                    |
| `diff -q mcp/ai/tool-definitions.cjs extension/ai/tool-definitions.js`                                          | no output (byte-identical, 80233 bytes each)                 |
| `node tests/tool-definitions-parity.test.js`                                                                    | 142 passed, 0 failed                                         |
| `node tests/tool-executor-readonly.test.js`                                                                     | 35 passed, 0 failed (read-only hadEffect semantics preserved)|
| Task 1 smoke (`m.VISUAL_SESSION_FIELDS` / `m.withVisualSessionFields` exported, helper merges correctly)        | OK                                                           |
| Task 2 smoke (36 action tools carry bundle, 15 read-only tools do not, wait_for_* both `_readOnly: true`)       | OK: 36 action tools carry bundle + 15 read-only tools do not |
| Total tool count                                                                                                | 51 (36 action + 15 read-only)                                |
| `getReadOnlyTools().length`                                                                                     | 15                                                           |
| `withVisualSessionFields(` occurrences in mcp/ai/tool-definitions.cjs                                           | 38 (1 declaration + 1 export ref + 36 application sites)     |
| `_readOnly: true,` occurrences                                                                                  | 15                                                           |
| `_readOnly: false,` occurrences                                                                                 | 36                                                           |

## Self-Check: PASSED

- mcp/ai/tool-definitions.cjs: FOUND (modified, syntax-valid, 80233 bytes)
- extension/ai/tool-definitions.js: FOUND (modified, syntax-valid, 80233 bytes, byte-identical mirror)
- Commit 336f3a9: FOUND (`git log --oneline | grep 336f3a9` -> present on `refinements` branch)
- Tests passing: tool-definitions-parity (142/142), tool-executor-readonly (35/35)
- Contract truths: all 7 truths in plan frontmatter `must_haves.truths` are satisfied (verified via Task 2 smoke command)
- Contract artifacts: both file paths match `must_haves.artifacts` patterns; both `> 1200 lines` (1263 lines each)
- Contract key_links: `v0\.9\.62-CONTRACT\.md` cited in the leading comment of the VISUAL_SESSION_FIELDS block; byte-identity invariant preserved
