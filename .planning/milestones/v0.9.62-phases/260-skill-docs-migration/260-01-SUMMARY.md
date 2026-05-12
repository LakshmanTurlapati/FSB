---
phase: 260
plan: 01
subsystem: skill-docs
tags: [v0.9.62, skill-docs, implicit-contract, openclaw, documentation]
milestone: v0.9.62
branch: refinements
dependency-graph:
  requires:
    - .planning/v0.9.62-CONTRACT.md (canonical 36 + 15 + 3 typed-error names; Phase 254)
    - mcp/CHANGELOG.md v0.9.0 entry (Phase 258)
    - mcp/README.md visual-session-lifecycle section (Phase 258)
    - tests/skill-fsb-spec.test.js (Phase 251 skill spec test; must still pass)
  provides:
    - skills/FSB Skill/USAGE.md (v0.9.0 banner + 2 worked examples)
    - skills/FSB Skill/references/visual-session-lifecycle.md (implicit-contract rewrite)
    - skills/FSB Skill/references/tool-decision-tree.md (field-bundle reminders on action-tool branches)
    - skills/FSB Skill/SKILL.md (v0.9.62 contract section linking to canonical artifact)
  affects:
    - tests/skill-fsb-spec.test.js (nonToolAllowlist extended for new field-bundle keys)
tech-stack:
  added: []
  patterns:
    - Reference linking: SKILL.md body points to .planning/v0.9.62-CONTRACT.md instead of inlining 36 + 15 lists (avoids drift on future contract evolutions)
    - Field-bundle reminder block: tool-decision-tree.md gets a top-level section enumerating all 36 action tools that require visual_reason + client + optional is_final
    - Read-tool exemption: every doc explicitly lists the 15 read-only tools as bundle-exempt
key-files:
  created:
    - .planning/phases/260-skill-docs-migration/260-01-SUMMARY.md
  modified:
    - skills/FSB Skill/USAGE.md (DOCS-01)
    - skills/FSB Skill/references/visual-session-lifecycle.md (DOCS-02)
    - skills/FSB Skill/references/tool-decision-tree.md (DOCS-03)
    - skills/FSB Skill/SKILL.md (DOCS-04)
    - tests/skill-fsb-spec.test.js (Rule 3 fix: allowlist visual_reason + is_final)
decisions:
  - SKILL.md links to .planning/v0.9.62-CONTRACT.md as the single source of truth; canonical 36 + 15 lists NOT inlined
  - Allowlisted client values in worked examples use "OpenClaw" (this skill ships as part of OpenClaw)
  - USAGE.md banner uses the literal substring "v0.9.0 breaking change" (per verifier predicate)
  - Field-bundle key documentation enumerates v0.9.36 allowlist labels by name (stable per Phase 254 pinning)
metrics:
  duration: "~5 minutes (4 atomic doc edits + 1 test allowlist fix)"
  completed-date: 2026-05-11
  tasks: 4
  files: 5
  commits: 5
---

# Phase 260 Plan 01: Skill Docs Migration Summary

Migrated the four FSB Skill documentation surfaces (USAGE.md, references/visual-session-lifecycle.md, references/tool-decision-tree.md, SKILL.md) to reflect the v0.9.62 implicit visual-session contract -- replacing the v0.8.0 explicit `start_visual_session` / `end_visual_session` pairing with the new field-bundle pattern (`visual_reason` + `client` + optional `is_final`) on every MCP action tool call.

## Objective

Phase 260 closes milestone v0.9.62 by aligning the user-facing FSB Skill (OpenClaw) docs with the contract pinned in Phase 254 and implemented across Phases 255-259:

- Phase 255 (schema): action tools require the field bundle
- Phase 256 (lifecycle): sliding 60s window + per-tab implicit sessions
- Phase 257 (is_final): immediate clear signal
- Phase 258 (removal): explicit start/end tools removed; TOOL_REMOVED typed error
- Phase 259 (tests): mcp-visual-tick contract test + CI lock
- Phase 260 (this): skill-level documentation surfaces

Phase 258 already updated the package-level docs (`mcp/CHANGELOG.md` v0.9.0 + `mcp/README.md` banner). Phase 260 owns the skill-level docs.

## Tasks completed

### DOCS-01: USAGE.md banner + worked examples (commit 40ae4eb)

- Added top-of-file v0.9.0 breaking-change banner with literal substring "v0.9.0 breaking change" (satisfies verifier predicate).
- Banner links to `mcp/CHANGELOG.md#v0.9.0` and `mcp/README.md#visual-session-lifecycle`.
- Replaced "Visual session handling" section (try/finally start_visual_session pattern) with "v0.9.62 visual-session contract" section documenting the field bundle, three typed errors, and read-tool exemption.
- Added Example 1 -- action call with bundle (`click({selector: "#submit", visual_reason: "Completing checkout", client: "OpenClaw"})`).
- Added Example 2 -- final action with `is_final: true` (`click({selector: "#confirm-order", visual_reason: "Confirming order", client: "OpenClaw", is_final: true})`).
- Enumerated v0.9.36 allowlist labels; named OpenClaw as the canonical `client` for this skill.
- Removed all instructions to call explicit start/end tools (replaced by autopilot exception note).

### DOCS-02: visual-session-lifecycle.md full rewrite (commit fccc282)

- Replaced the entire file (78 lines) with the implicit-lifecycle explanation.
- Documents the field bundle table (visual_reason / client / is_final) with required/optional markings.
- Sliding 60-second window with per-call re-arm; 60s silence auto-clear.
- `is_final: true` immediate clear semantics.
- Concrete contrast example (action call WITH bundle vs read call WITHOUT) showing the read-tool exemption.
- Bootstrap path: NO_OWNED_TAB -> open_tab -> retry action call.
- Typed-error catalogue (VISUAL_FIELDS_REQUIRED, BADGE_NOT_ALLOWED, TOOL_REMOVED) with recovery actions.
- MV3 service-worker eviction note (chrome.storage.session persistence pattern).
- Pointer to `.planning/v0.9.62-CONTRACT.md` for canonical lists.
- Autopilot exception preserved.

### DOCS-03: tool-decision-tree.md field-bundle reminders (commit bf48073)

- Added new top-level "v0.9.62 field bundle (action tools only)" section enumerating all 36 action tools that require the bundle.
- Listed the 15 read-only tools exempted from the bundle (preserves read-first guidance unchanged from v0.9.61).
- Explicit note: removed tools (`start_visual_session` / `end_visual_session`) are not in the decision tree.
- Added new "Action-tool bundle reminder" section after the quick-reference table reinforcing the rule.
- Updated "When to escalate to autopilot" with autopilot exception note.
- Added `references/visual-session-lifecycle.md` and `.planning/v0.9.62-CONTRACT.md` to See also.
- Read-first guidance (read_page > get_dom_snapshot > get_page_snapshot > get_site_guide) and execute_js-vs-typed-tools sections preserved unchanged.

### DOCS-04: SKILL.md v0.9.62 contract section (commit 16d3059)

- Replaced "Visual session wrapping" section with "v0.9.62 visual-session contract" section.
- Documents the field bundle, sliding window, is_final semantics, read-tool exemption, NO_OWNED_TAB bootstrap.
- Names the three typed errors verbatim (VISUAL_FIELDS_REQUIRED, BADGE_NOT_ALLOWED, TOOL_REMOVED).
- Links to `.planning/v0.9.62-CONTRACT.md` as the single source of truth for the 36 + 15 lists; lists NOT inlined per the contract artifact policy.
- Added `references/visual-session-lifecycle.md` and `.planning/v0.9.62-CONTRACT.md` to References section.
- Frontmatter (version 0.9.61, requires.bins [node, npx], requires.env [], metadata.openclaw) UNCHANGED -- preserves all 16 frontmatter assertions in skill-fsb-spec.test.js.

## Verification

`npm test` exits 0 (full test chain). `tests/skill-fsb-spec.test.js` -- 48 passed / 0 failed.

Test coverage matrix (skill-fsb-spec.test.js):

| Test section | Result | Notes |
|--------------|--------|-------|
| TEST-02 (frontmatter) | 16 PASS | SKILL.md frontmatter untouched |
| TEST-03 (stdio parity) | 7 PASS | print-stdio.mjs and install.ts untouched |
| TEST-04 (references) | 13 PASS | All 6 reference files exist; typed-error names present in multi-agent-contract.md; tool token cross-reference clean |
| TEST-05 (USAGE.md links) | 3 PASS | Chrome Web Store URL and GitHub Releases fallback preserved |
| ASCII-only enforcement | 9 PASS | All 9 skill artifacts ASCII-only (no emojis, no em-dashes between sentences -- all uses `--`) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test allowlist needed v0.9.62 field-bundle keys**
- **Found during:** Test verification after DOCS-01..04 commits
- **Issue:** `tests/skill-fsb-spec.test.js` uses a backtick-wrapped token cross-reference heuristic that flags unknown snake_case tokens as candidate undefined tools. The new field-bundle keys `visual_reason` and `is_final` appear as backtick-wrapped tokens in tool-decision-tree.md (DOCS-03) and tripped the heuristic.
- **Fix:** Extended the existing `nonToolAllowlist` in `tests/skill-fsb-spec.test.js` to declare `visual_reason` and `is_final` as known non-tool tokens, matching the existing precedent (`agent_id`, `session_token`, `client`, `reason` already allowlisted). The allowlist comment block already documented this as the contract for "tokens that look like tool names but are inputs / fields / non-tool words."
- **Files modified:** tests/skill-fsb-spec.test.js
- **Commit:** 4e27756

### Structural constraints observed (not deviations)

- **SKILL.md frontmatter is locked.** skill-fsb-spec.test.js TEST-02 asserts: `name === "FSB"`, `version === "0.9.61"`, `requires.bins === [node, npx]`, `requires.env === []`, `metadata.openclaw.install[0].kind === "node"`, `metadata.openclaw.install[0].package === "fsb-mcp-server"`, no `priority:` key, no `must-use:` key. The DOCS-04 update preserved all of these.
- **USAGE.md must contain literal Chrome Web Store URL** (`https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk`) and a GitHub Releases link matching `/github\.com\/[^/\s]+\/FSB\/releases/`. The DOCS-01 update preserved both.
- **All 6 reference files must exist** under `skills/FSB Skill/references/`. The DOCS-02 update rewrote visual-session-lifecycle.md in place; the other 5 references were not modified.
- **multi-agent-contract.md must mention TAB_NOT_OWNED, AGENT_CAP_REACHED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE, and the `back` tool.** Phase 260 prompt explicitly scoped multi-agent-contract.md OUT (only the 4 listed files in scope), so this file was untouched.
- **All skill artifacts must be ASCII-only.** Verified via the test's per-file byte scan. No emojis, no em-dashes between sentences (used `--` as the project convention dictates).

## Out-of-scope discoveries (deferred / informational)

None. The skill docs surfaces edited in Phase 260 are the four explicitly named files; multi-agent-contract.md still has a single in-passing reference to `start_visual_session` (NO_OWNED_TAB recovery example, line 29), but Phase 260's scope was explicitly limited to the 4 listed files, and the reference is contextual rather than instructional. Updating multi-agent-contract.md is a candidate for a future v0.9.63 cleanup pass.

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| DOCS-01 | 40ae4eb | skills/FSB Skill/USAGE.md | Rewrite USAGE.md visual-session section for v0.9.62 implicit contract |
| DOCS-02 | fccc282 | skills/FSB Skill/references/visual-session-lifecycle.md | Rewrite visual-session-lifecycle.md for v0.9.62 implicit contract |
| DOCS-03 | bf48073 | skills/FSB Skill/references/tool-decision-tree.md | Add v0.9.62 field-bundle reminders to tool-decision-tree.md |
| DOCS-04 | 16d3059 | skills/FSB Skill/SKILL.md | Add v0.9.62 contract section to SKILL.md linking to canonical artifact |
| TEST-FIX | 4e27756 | tests/skill-fsb-spec.test.js | Allowlist v0.9.62 field-bundle keys in skill-fsb-spec token check (Rule 3) |

## Success criteria

- [x] USAGE.md has the v0.9.0 breaking-change banner + 2 worked examples (bundle + is_final).
- [x] visual-session-lifecycle.md rewritten for the implicit contract.
- [x] tool-decision-tree.md updated for the new bundle requirement.
- [x] SKILL.md links to `.planning/v0.9.62-CONTRACT.md` for canonical lists.
- [x] `npm test` exits 0 (skill-fsb-spec.test.js: 48 passed / 0 failed).
- [x] 4 atomic commits on `refinements` (5 total including Rule 3 test fix).
- [x] `.planning/phases/260-skill-docs-migration/260-01-SUMMARY.md` created.

## Known Stubs

None. All edited surfaces are wired to real data sources (the field bundle is fully defined in `.planning/v0.9.62-CONTRACT.md`, the typed-error names are pinned, the allowlist labels are stable per v0.9.36, and the test fix exercises real backtick-token cross-referencing).

## Next steps

Phase 260 is the final implementation phase of milestone v0.9.62. After this plan:

- User-gated `npm publish fsb-mcp-server@0.9.0` (per v0.9.60 / v0.9.61 precedent; autonomous mode does not run npm publish).
- User-gated v0.9.62 milestone closeout (ROADMAP / STATE / MILESTONES updates owned by the user per the Phase 260 prompt instruction "Do NOT touch STATE.md or ROADMAP.md").
- Future v0.9.63 cleanup candidate: update multi-agent-contract.md NO_OWNED_TAB recovery example to drop the in-passing `start_visual_session` reference (low-priority documentation polish; not blocking).

## Self-Check: PASSED

Verified after writing the SUMMARY:

- All 5 modified files exist on disk at their stated paths.
- All 5 commit hashes (40ae4eb, fccc282, bf48073, 16d3059, 4e27756) are present in `git log --all`.
- USAGE.md contains the literal substring "v0.9.0 breaking change" (verifier predicate satisfied).
- SKILL.md links to `.planning/v0.9.62-CONTRACT.md` (canonical artifact pointer present; lists NOT inlined).
- `node tests/skill-fsb-spec.test.js` exit 0 -- 48 passed / 0 failed.
- `npm test` (full chain) exit 0.
