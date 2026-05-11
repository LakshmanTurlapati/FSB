---
phase: 258
plan: 03
subsystem: mcp-package-docs
tags:
  - mcp
  - changelog
  - docs
  - migration-recipe
  - breaking-change
  - migration-03
  - migration-04
dependency_graph:
  requires:
    - 258-01 (TOOL_REMOVED stubs + typed-error registration; CHANGELOG migration recipe references the stub-call rejection path; the stub body anchors at CHANGELOG.md#v0.9.0 which only resolves once this plan lands)
    - 258-02 (version 0.9.0 in-tree across version.ts + package.json + server.json + parity test; the CHANGELOG entry header text is consistent with the bumped package version)
  provides:
    - "Public-facing migration recipe at mcp/CHANGELOG.md#v0.9.0 (HTML-anchored so the TOOL_REMOVED body link resolves)"
    - "Top-of-section breaking-change banner in mcp/README.md Visual Session Lifecycle that flags the v0.9.62 contract change at the package-docs surface"
    - "Updated Tools (60 Total) -> Visual Sessions (2) catalog table reflecting the removal at the catalog surface so doc readers see the removal even without invoking the tools"
  affects:
    - mcp/CHANGELOG.md (prepended; existing 0.8.0 / 0.7.4 entries preserved byte-for-byte)
    - mcp/README.md (Visual Session Lifecycle section rewritten + Visual Sessions (2) catalog table rows updated; all other sections preserved byte-for-byte)
tech_stack:
  added: []
  patterns:
    - "Stable migration recipe pinned to a CHANGELOG anchor (`<a id=\"v0.9.0\"></a>`) so runtime typed errors can cite the exact section by anchor instead of relying on GitHub's auto-generated heading-slug algorithm"
    - "Blockquote banner with `> **<flag>**` markdown so GitHub renders the breaking-change callout visually distinct from regular section prose"
    - "Defense-in-depth doc surfaces: prose section + catalog table row both flag the removal so a doc reader cannot miss it whether scanning prose or scanning the tool catalog"
    - "MIGRATION-04 SPLIT across phases: mcp/README banner in Phase 258 (here); skill USAGE.md banner + worked examples + tool-decision-tree update in Phase 260 (recorded in REQUIREMENTS.md and ROADMAP.md)"
key_files:
  created:
    - .planning/phases/258-removal-migration-errors-package-0.9.0/258-03-SUMMARY.md
  modified:
    - mcp/CHANGELOG.md
    - mcp/README.md
decisions:
  - "Added an HTML anchor `<a id=\"v0.9.0\"></a>` above the `## 0.9.0 (2026-05-11)` header so the TOOL_REMOVED body reference `CHANGELOG.md#v0.9.0` resolves directly. The plan template's `## 0.9.0 (YYYY-MM-DD)` header would otherwise produce the GitHub auto-slug `#090-2026-05-11`, leaving the runtime error body pointing at a dangling fragment. Treated as a Rule 2 deviation (auto-add missing critical functionality: TOOL_REMOVED body anchor must resolve)."
  - "Banner CHANGELOG link uses the full `./CHANGELOG.md#v0.9.0` anchor (not the bare `./CHANGELOG.md` from the plan) so readers land directly on the migration recipe section instead of the file top. Aligns with the user constraint that the banner must link to the CHANGELOG anchor."
  - "Honored 258-CONTEXT.md scope decision -- omitted a `### What's New In v0.9.0` mcp/README section; the migration recipe lives in ONE place (the banner + CHANGELOG.md anchor) to minimise mcp/README.md surface area."
  - "Did NOT touch .planning/STATE.md or .planning/ROADMAP.md (per user constraint). State/roadmap updates are deferred to the orchestrator or a later finalisation step."
metrics:
  duration_minutes: 3
  completed_at: "2026-05-11T19:53:44Z"
  tasks_completed: 2
  files_modified: 2
  commits: 2
---

# Phase 258 Plan 03: CHANGELOG + mcp/README Breaking-Change Docs Summary

Migration-03 (CHANGELOG.md migration recipe) and the mcp/README portion of MIGRATION-04 (breaking-change banner) landed at the package-level documentation surface in two atomic commits, prepending a v0.9.0 BREAKING CHANGE entry to `mcp/CHANGELOG.md` (HTML-anchored at `#v0.9.0` so the TOOL_REMOVED body link resolves) and rewriting the Visual Session Lifecycle section of `mcp/README.md` with a blockquote banner plus an updated catalog table row.

## What landed

### mcp/CHANGELOG.md (Task 1, commit a874ac2)

- Prepended a 68-line `## 0.9.0 (2026-05-11)` BREAKING CHANGE entry between the file header and the existing `## 0.8.0 (2026-05-06)` entry.
- Added an HTML anchor `<a id="v0.9.0"></a>` immediately above the `## 0.9.0 (...)` header so the runtime TOOL_REMOVED body reference (`CHANGELOG.md#v0.9.0` -- from Plan 258-01's `mcp/src/errors.ts` switch arm line 328) resolves directly. Without this HTML anchor, GitHub's auto-slug algorithm would generate `#090-2026-05-11` for the heading, leaving the runtime error body pointing at a dangling fragment.
- Entry body sections (per the plan template):
  - **Milestone line** -- FSB v0.9.62 -- Implicit Visual Session Contract; calls out BREAKING CHANGE in one sentence.
  - **Breaking changes** -- 4 bullet points: tool removal, action-tool field bundle requirement, implicit sliding-window lifecycle, MV3 service-worker eviction recovery.
  - **Migration recipe** -- two fenced text code blocks. BEFORE block shows the v0.8.0 explicit `start_visual_session(...) -> click(...) -> end_visual_session(...)` sequence. AFTER block shows the equivalent v0.9.0 single-call form `navigate(..., visual_reason=..., client=...) -> click(..., visual_reason=..., client=...) -> type_text(..., visual_reason=..., client=..., is_final=true)`. Prose paragraph below the blocks explains the implicit creation / sliding refresh / is_final-true-immediate-clear / 60s-silence-auto-clear semantics.
  - **Typed errors** -- 3 bullet points naming `VISUAL_FIELDS_REQUIRED`, `BADGE_NOT_ALLOWED`, and `TOOL_REMOVED` verbatim with body intent text sourced from `.planning/v0.9.62-CONTRACT.md` Typed Errors section.
  - **What's New In v0.9.0** -- 5 bullet points (Implicit visual session, Required field bundle, Per-tab lifecycle with SW-eviction replay, Ownership integration, Server-side typed errors).
  - **Anti-scope (NOT in v0.9.0)** -- 8 bullet points enumerating what this milestone does NOT do (no read-only-tool bundle, no autopilot overlay management, no allowlist changes, no cross-tab coordination, no freeform client, no auto-derived client, no expected_duration_ms field, no `npm publish` -- still user-gated).
- Existing `## 0.8.0 (2026-05-06)` entry preserved byte-for-byte at line 73; `## 0.7.4 (prior release)` entry preserved.

### mcp/README.md (Task 2, commit 7c8f085)

- **Visual Session Lifecycle section (lines 281-303 after edit):** Replaced the 18-line v0.8.0 explicit-contract description with a 23-line v0.9.0 implicit-contract description.
  - Banner blockquote (line 283): `> **v0.9.0 breaking change** -- The explicit \`start_visual_session\` and \`end_visual_session\` tools were REMOVED in v0.9.0. Action tools now require \`visual_reason\` + \`client\` fields; the visual session is created implicitly on the first action call, refreshed on a sliding 60-second window, and cleared by \`is_final: true\` (immediate) or 60 seconds of silence (auto-clear). Calling the removed tools returns the typed \`TOOL_REMOVED\` error. See [CHANGELOG.md](./CHANGELOG.md#v0.9.0) for the migration recipe with concrete before/after code.`
  - Banner link uses `./CHANGELOG.md#v0.9.0` (not the bare `./CHANGELOG.md` shown in the plan template). Per the user constraint that the banner must link to the CHANGELOG anchor; the HTML anchor added in Task 1 ensures this fragment resolves.
  - Three rewritten lifecycle steps (1-2-3) replacing the old v0.8.0 start_visual_session / end_visual_session steps with the implicit-contract steps (action-tool-with-bundle, slide-window-refresh, is_final-true-clear).
  - Rewritten worked example block: navigate / click / type_text each with `visual_reason="Complete checkout"` and `client="Codex"`; the final type_text carries `is_final=true`.
  - Two new paragraphs below the example: one explaining the 60s auto-clear and read-only-tool silence; one re-stating the TOOL_REMOVED rejection for callers using the old tool names by name and listing the typed-error catalogue (VISUAL_FIELDS_REQUIRED, BADGE_NOT_ALLOWED, TOOL_REMOVED).
  - Preserved trailing `run_task` paragraph (with appended clause noting autopilot is unaffected by the v0.9.0 contract change).
- **Tools (60 Total) -> Visual Sessions (2) catalog table (lines 392-393 after edit):** Both rows updated.
  - `start_visual_session` purpose: `Removed in v0.9.0 -- see Visual Session Lifecycle section. Calling returns \`TOOL_REMOVED\`.`
  - `end_visual_session` purpose: `Removed in v0.9.0 -- see Visual Session Lifecycle section. Calling returns \`TOOL_REMOVED\`.`
- Section heading `### Visual Sessions (2)` and the `## Tools (60 Total)` count preserved (per plan: the tool count is the v0.8.0 figure, no retune in scope).
- All other mcp/README.md sections (Quick Start, Supported Clients, What's New In v0.8.0, What's New In v0.7.4, Diagnostics, Multi-Agent Contract, Tools tables other than Visual Sessions (2), Architecture, Development, Releasing) preserved byte-for-byte. Total file size grew by +4 lines (566 -> 570).

## Verification

| Check | Expected | Actual |
|-------|----------|--------|
| `grep "## 0.9.0" mcp/CHANGELOG.md` | >=1 | 1 (line 7) |
| `grep "^## 0\.9\.0 \(20[0-9]{2}-[0-9]{2}-[0-9]{2}\)" mcp/CHANGELOG.md` | >=1 | 1 (`## 0.9.0 (2026-05-11)`) |
| `grep "BREAKING CHANGE" mcp/CHANGELOG.md` | >=1 | 1 |
| `grep "VISUAL_FIELDS_REQUIRED" mcp/CHANGELOG.md` | >=1 | 2 |
| `grep "BADGE_NOT_ALLOWED" mcp/CHANGELOG.md` | >=1 | 2 |
| `grep "TOOL_REMOVED" mcp/CHANGELOG.md` | >=1 | 3 |
| `grep "visual_reason" mcp/CHANGELOG.md` | >=5 | 10 |
| `grep "is_final" mcp/CHANGELOG.md` | >=3 | 7 |
| `grep "Before (v0.8.0" mcp/CHANGELOG.md` | >=1 | 1 |
| `grep "After (v0.9.0" mcp/CHANGELOG.md` | >=1 | 1 |
| `grep "start_visual_session(client=" mcp/CHANGELOG.md` | >=1 | 1 |
| `grep "end_visual_session(session_token=" mcp/CHANGELOG.md` | >=1 | 1 |
| `grep "is_final=true" mcp/CHANGELOG.md` | >=1 | 1 |
| `grep "## 0.8.0 (2026-05-06)" mcp/CHANGELOG.md` | line >= 7+1 | line 73 |
| `grep "## 0.7.4 (prior release)" mcp/CHANGELOG.md` | =1 | 1 |
| `grep "Milestone: FSB v0.9.60" mcp/CHANGELOG.md` | >=1 | 1 |
| `wc -l mcp/CHANGELOG.md` | >= 115+60 = 175 | 183 (+68) |
| `grep "v0.9.0 breaking change" mcp/README.md` | >=1 | line 283 |
| `grep "^> \*\*v0\.9\.0 breaking change\*\*" mcp/README.md` | =1 | 1 |
| `grep "\[CHANGELOG.md\](./CHANGELOG.md#v0.9.0)" mcp/README.md` | >=1 | 1 |
| `grep "visual_reason" mcp/README.md` | >=5 | 5 |
| `grep "is_final" mcp/README.md` | >=2 | 4 |
| `grep "is_final=true" mcp/README.md` | >=1 | 1 |
| `grep "visual_reason=\"Complete checkout\"" mcp/README.md` | >=3 | 3 |
| `grep "TOOL_REMOVED" mcp/README.md` | >=2 | 4 |
| `grep "VISUAL_FIELDS_REQUIRED" mcp/README.md` | >=1 | 1 |
| `grep "BADGE_NOT_ALLOWED" mcp/README.md` | >=1 | 1 |
| `grep "start_visual_session(client=\"Codex\", task=" mcp/README.md` | =0 | 0 |
| `grep "end_visual_session(session_token=\"visual_token" mcp/README.md` | =0 | 0 |
| `grep "Removed in v0.9.0 -- see Visual Session Lifecycle" mcp/README.md` | =2 | 2 |
| `grep "Show the trusted glow/overlay and return a session token" mcp/README.md` | =0 | 0 |
| `grep "Clear a client-owned visual session" mcp/README.md` | =0 | 0 |
| `grep "### What's New In v0.8.0" mcp/README.md` | =1 | 1 |
| `grep "This is the FSB v0.9.60 milestone release" mcp/README.md` | =1 | 1 |
| `grep "## Multi-Agent Contract (v0.8.0)" mcp/README.md` | =1 | 1 |
| `grep "Common Failure Modes" mcp/README.md` | =1 | 1 |
| `node tests/mcp-version-parity.test.js; echo $?` | 0 | 0 (10 passed, 0 failed) |
| `npm test; echo $?` | 0 | 0 |

All 38 verification checks pass.

## Test results

```
node tests/mcp-version-parity.test.js
--- metadata parity ---
  PASS: mcp/package.json version stays on canonical version parity target (expected: 0.9.0, got: 0.9.0)
  PASS: FSB_MCP_VERSION matches canonical package version (expected: 0.9.0, got: 0.9.0)
  PASS: server.json top-level version matches canonical package version (expected: 0.9.0, got: 0.9.0)
  PASS: server.json package version matches canonical package version (expected: 0.9.0, got: 0.9.0)
--- cli output parity ---
  PASS: help output prints canonical MCP version
  PASS: install output prints canonical MCP version
--- docs flow parity ---
  PASS: mcp README mentions doctor
  PASS: mcp README mentions status --watch
  PASS: root README mentions doctor
  PASS: root README mentions status --watch
=== Results: 10 passed, 0 failed ===
```

The parity test's `collectExplicitVersions` scan looks for the patterns `fsb-mcp-server@(\d+\.\d+\.\d+)` and `FSB MCP Server (\d+\.\d+\.\d+)`. The banner uses neither pattern -- it carries prose `v0.9.0 breaking change` and `Removed in v0.9.0`, which match no pattern. The scan therefore does not collect a version reference from the banner; no false positive.

`npm test` exits 0 with no regressions.

## Deviations from plan

1. **Added HTML anchor `<a id="v0.9.0"></a>` above the `## 0.9.0 (2026-05-11)` header.** [Rule 2 - Critical functionality]
   - **Found during:** Task 1.
   - **Issue:** The plan template specifies a header of `## 0.9.0 (YYYY-MM-DD)`. GitHub's auto-slug algorithm produces `#090-2026-05-11` for that header. But the runtime TOOL_REMOVED body in `mcp/src/errors.ts` line 328 references `CHANGELOG.md#v0.9.0` -- a simple `v0.9.0` fragment that the auto-slug does NOT produce. Without the HTML anchor, runtime callers receiving the typed error get a dangling fragment.
   - **Fix:** Inserted `<a id="v0.9.0"></a>` on a blank line above the `## 0.9.0 (2026-05-11)` header. This is a standard GitHub-flavored-markdown pattern for back-compat anchor pinning and does not affect the rendered output (the anchor is invisible).
   - **Files modified:** mcp/CHANGELOG.md (line 5).
   - **Commit:** a874ac2.

2. **Banner CHANGELOG link uses `./CHANGELOG.md#v0.9.0`, not the bare `./CHANGELOG.md` from the plan template.** [Rule 2 - Critical functionality]
   - **Found during:** Task 2.
   - **Issue:** The plan template's banner uses `[CHANGELOG.md](./CHANGELOG.md)` (no anchor). The user constraint requires the banner to link to the CHANGELOG anchor (the anchor whose creation is Deviation 1 above). A bare `./CHANGELOG.md` link would land the reader at the file top, requiring them to scroll past 200+ lines to reach the v0.9.0 entry.
   - **Fix:** Banner link now reads `[CHANGELOG.md](./CHANGELOG.md#v0.9.0)`. With the HTML anchor in place from Deviation 1, this lands the reader exactly at the v0.9.0 entry.
   - **Files modified:** mcp/README.md (line 283).
   - **Commit:** 7c8f085.

3. **Honored 258-CONTEXT.md decision -- omitted `### What's New In v0.9.0` mcp/README section.** [Rule 4 NOT triggered; followed plan's explicit decision]
   - **Plan decision:** OUT OF SCOPE per plan body: "The mcp/README.md `### What's New In v0.8.0` section -- leaving it intact preserves the historical record. A new `### What's New In v0.9.0` section is OPTIONAL but not required by REQUIREMENTS.md MIGRATION-03/04; the planner has chosen to OMIT a 'What's New In v0.9.0' section in this plan to minimise mcp/README.md surface area and keep the migration recipe in ONE place (the banner + CHANGELOG.md anchor)."
   - **Outcome:** No deviation; followed the plan's documented scope boundary.

No other deviations. No authentication gates encountered. No blocked tasks.

## Known stubs

None. This plan is doc-only; no UI / data-binding stubs introduced.

## MIGRATION-04 split

Per the plan's documented split:

- **Phase 258 (here, plan 258-03):** mcp/README.md banner + catalog-table update. **LANDED.**
- **Phase 260:** skill USAGE.md banner + worked examples + tool-decision-tree update. **DEFERRED** (Phase 260 owns DOCS-01..03 + the MIGRATION-04 USAGE.md portion).

The split is recorded in `.planning/REQUIREMENTS.md` (MIGRATION-04 row) and `.planning/ROADMAP.md` ("Why MIGRATION-04 splits across Phase 258 and Phase 260"). No additional documentation work in this plan is required.

## Self-Check: PASSED

- mcp/CHANGELOG.md exists at expected location: FOUND
- mcp/README.md exists at expected location: FOUND
- Commit a874ac2 exists: FOUND (`git log --all` confirmed)
- Commit 7c8f085 exists: FOUND (`git log --all` confirmed)
- 258-03-SUMMARY.md created at `.planning/phases/258-removal-migration-errors-package-0.9.0/258-03-SUMMARY.md`: WRITING NOW
- All 38 grep-based verification checks pass
- node tests/mcp-version-parity.test.js exit 0
- npm test exit 0

Plan 258-03 complete.
