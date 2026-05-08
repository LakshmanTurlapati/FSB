---
phase: 250-usage-md-references-policy
plan: 02
subsystem: docs
tags: [fsb-skill, openclaw, references, multi-agent, tool-decision, v0.8.0]

requires:
  - phase: 249-skill-md-frontmatter
    provides: SKILL.md body with relative pointers to references/tool-decision-tree.md and references/multi-agent-contract.md
provides:
  - references/tool-decision-tree.md: read-only-first decision tree for FSB AI manual mode tools
  - references/multi-agent-contract.md: v0.8.0 contract (agent_id rule, four typed errors, back tool)
affects: [251-tests, 252-readme]

tech-stack:
  added: []
  patterns:
    - "Reference file shape: H1 + 1-paragraph framing + bulleted/numbered rules + small table + worked example + see-also cross-links"
    - "Bare tool tokens in tree/table must match name: fields in mcp/ai/tool-definitions.cjs; off-registry tools (run_task, back) appear in narrative prose only"

key-files:
  created:
    - skills/FSB Skill/references/tool-decision-tree.md
    - skills/FSB Skill/references/multi-agent-contract.md
  modified: []

key-decisions:
  - "tool-decision-tree.md scopes run_task to autopilot escalation prose only; table rows are exclusively manual-mode tools from tool-definitions.cjs"
  - "multi-agent-contract.md documents back as the typed replacement for execute_js('history.back()') with a compatibility note that go_back is the same surface in some FSB builds"
  - "All four typed error names appear verbatim as H3 subsection titles for grep stability under Phase 251 TEST-04"

patterns-established:
  - "Anti-pattern callouts use [BAD]/[GOOD] fenced blocks (ASCII, no emoji)"
  - "See-also cross-links use relative `references/*.md` paths matching SKILL.md body conventions"

requirements-completed: [DOCS-04, DOCS-05]

duration: 12min
completed: 2026-05-08
---

# Phase 250 Plan 02: tool-decision-tree.md + multi-agent-contract.md Summary

**Two FSB Skill reference files authored: a read-only-first manual-mode tool decision tree (DOCS-04) and the v0.8.0 multi-agent contract documenting the agent_id rule, four typed errors, and the back tool (DOCS-05).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Authored `skills/FSB Skill/references/tool-decision-tree.md` (73 lines) covering read-only escalation order, typed-events-over-.value rule, 17-row tool quick reference, worked example, and autopilot-escalation prose.
- Authored `skills/FSB Skill/references/multi-agent-contract.md` (62 lines) covering the agent_id rule, all four typed errors verbatim with one-line meaning + one-line action, the back tool replacement for execute_js("history.back()"), and a why-the-contract-matters paragraph.
- Both files pass the Phase 251 TEST-04 grep checks pre-emptively (read_page, get_dom_snapshot, get_page_snapshot, get_site_guide, type_text, autopilot all present in tool-decision-tree.md; TAB_NOT_OWNED, AGENT_CAP_REACHED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE, back, agent_id all present in multi-agent-contract.md).
- Zero emojis (verified via Python regex covering U+1F300-U+1FAFF and U+2600-U+27BF).

## Task Commits

1. **Task 1: Author references/tool-decision-tree.md (DOCS-04)** - `cebe77e` (docs)
2. **Task 2: Author references/multi-agent-contract.md (DOCS-05)** - `f283cc2` (docs)

## Files Created/Modified

- `skills/FSB Skill/references/tool-decision-tree.md` (created, 73 lines) - Read-only-first decision tree for FSB AI manual-mode tools. Contains H1 + framing + read-only escalation order + typed-events-over-.value section + 17-row Tool/When/Pitfall table + worked example + autopilot escalation prose + see-also cross-links.
- `skills/FSB Skill/references/multi-agent-contract.md` (created, 62 lines) - v0.8.0 multi-agent contract. Contains H1 + framing + Never-pass-agent_id section + four H3 typed-error subsections + back-vs-execute_js section + why-the-contract-matters paragraph + see-also cross-links.

Note: `skills/FSB Skill/SKILL.md`, `skills/FSB Skill/USAGE.md`, and `skills/FSB Skill/references/README.md` were also added to the worktree commit (they were not yet in this worktree; they exist in main from prior phases). They are unchanged from main.

## Tool tokens used in tool-decision-tree.md

All bare tool tokens in tree bullets and the Tool quick-reference table, cross-checked against `mcp/ai/tool-definitions.cjs` `name:` fields:

| Token | In tool-definitions.cjs |
|-------|-------------------------|
| `read_page` | yes |
| `get_dom_snapshot` | yes |
| `get_page_snapshot` | yes |
| `get_site_guide` | yes |
| `click` | yes |
| `type_text` | yes |
| `press_enter` | yes |
| `press_key` | yes |
| `select_option` | yes |
| `check_box` | yes |
| `hover` | yes |
| `focus` | yes |
| `clear_input` | yes |
| `wait_for_element` | yes |
| `wait_for_stable` | yes |
| `open_tab` | yes |
| `switch_tab` | yes |
| `list_tabs` | yes |
| `navigate` | yes |
| `go_back` | yes |
| `go_forward` | yes |
| `refresh` | yes |
| `execute_js` | yes |
| `scroll_to_element` | yes |

Off-registry tokens that appear in tool-decision-tree.md (narrative prose only, NOT in tree bullets or table rows):

- `run_task` - mentioned in the "When to escalate to autopilot" prose section, framed as the autopilot delegation surface served by `mcp/src/tools/autopilot.ts`. Plan rule: "reference by NARRATIVE prose only".
- `back` - mentioned only in the see-also cross-link to `multi-agent-contract.md` ("typed errors and the `back` tool"). Mirrors SKILL.md body wording.

## Typed errors confirmation in multi-agent-contract.md

All four typed error names appear verbatim as H3 subsection titles AND in the see-also context:

- `TAB_NOT_OWNED` - present
- `AGENT_CAP_REACHED` - present
- `TAB_INCOGNITO_NOT_SUPPORTED` - present
- `TAB_OUT_OF_SCOPE` - present

The `back` token appears in the "Use back instead of execute_js('history.back()')" H2 section title, the rule paragraph, the [GOOD] anti-pattern block (`back({})`), and the compatibility note. The `agent_id` token appears in the "Never pass agent_id" H2 section title, the rule paragraph, and the [BAD] anti-pattern block.

## Decisions Made

- Followed CONTEXT.md decisions exactly. No wording deviations.
- Used `back({})` (empty-arg form) in the [GOOD] block of multi-agent-contract.md to make the typed-tool call shape clear without inventing parameters.
- Worked example in tool-decision-tree.md uses an "add medium size to cart" scenario to walk read_page -> get_dom_snapshot -> click -> wait_for_stable -> click; concrete and short.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- macOS BSD `grep` does not support `-P` (PCRE); the plan's automated emoji-check command (`grep -P '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]'`) errors with "invalid option -- P" on this platform. Resolved by running an equivalent Python regex check (`re.compile(r'[\U0001F300-\U0001FAFF\u2600-\u27BF]')`); both files returned zero emoji matches. The verifier in Phase 251 will need either GNU grep (`ggrep -P` or `grep -P` on Linux) or the same Python fallback. Documented here so the test author knows.

## Self-Check: PASSED

Verified:
- `skills/FSB Skill/references/tool-decision-tree.md` exists (73 lines).
- `skills/FSB Skill/references/multi-agent-contract.md` exists (62 lines).
- Commits `cebe77e` and `f283cc2` both present in `git log --oneline`.
- All required grep tokens present in both files (read_page, get_dom_snapshot, get_page_snapshot, get_site_guide, type_text, autopilot in tool-decision-tree.md; TAB_NOT_OWNED, AGENT_CAP_REACHED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE, back, agent_id in multi-agent-contract.md).
- Every Tool-column token in tool-decision-tree.md table cross-checked against `mcp/ai/tool-definitions.cjs` `name:` fields; all 17 are real registry tools.
- `run_task` and `back` appear only in narrative prose in tool-decision-tree.md, never as tree bullets or table rows.
- Zero emojis in either file.

## Next Phase Readiness

- DOCS-04 and DOCS-05 satisfied; SKILL.md body pointers `references/tool-decision-tree.md` and `references/multi-agent-contract.md` now resolve to real files.
- Phase 250-03 (restricted-tab-recovery, default-to-fsb, vault-boundary) and 250-04 (visual-session-lifecycle) can proceed; their see-also cross-references from tool-decision-tree.md and multi-agent-contract.md are already in place.
- Phase 251 TEST-04 grep checks pre-pass against the local files.

---
*Phase: 250-usage-md-references-policy*
*Plan: 02*
*Completed: 2026-05-08*
