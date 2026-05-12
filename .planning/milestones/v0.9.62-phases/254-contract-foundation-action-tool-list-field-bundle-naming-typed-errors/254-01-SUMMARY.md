---
phase: 254
plan: 01
status: complete
date: 2026-05-11
requirements_addressed:
  - CONTRACT-01
files_created:
  - .planning/v0.9.62-CONTRACT.md
files_modified:
  - .planning/REQUIREMENTS.md
---

# Phase 254 / Plan 01 -- Summary

## What landed

Pinned `.planning/v0.9.62-CONTRACT.md` -- the single-source-of-truth artifact for the v0.9.62 milestone contract. Downstream phases 255-260 reference this artifact by stable path + sign-off line and do not re-derive any locked name.

Five decisions are pinned:

1. **Canonical action-tool list (36 tools).** Every action tool in this list carries the new field bundle in its MCP input schema as of Phase 255. Source: live `TOOL_REGISTRY` (`mcp/ai/tool-definitions.cjs`) filtered to `_readOnly: false`, minus the two `wait_for_*` tools reclassified to read-only.
2. **Field-bundle key names.** `visual_reason` (string, required), `client` (string, required, allowlisted), `is_final` (boolean, optional). Snake-case, matching existing MCP argument conventions.
3. **Badge-allowlist reuse citation.** `extension/utils/mcp-visual-session.js` -- constant `MCP_VISUAL_CLIENT_LABELS`, helpers `normalizeMcpVisualClientLabel` / `isAllowedMcpVisualClientLabel` / `getAllowedMcpVisualClientLabels`. MCP-side mirror at `mcp/src/tools/visual-session.ts`. Allowlist values are NOT duplicated in the contract artifact.
4. **Typed-error names.** `VISUAL_FIELDS_REQUIRED` (Phase 255), `BADGE_NOT_ALLOWED` (Phase 255), `TOOL_REMOVED` (Phase 258). SCREAMING_SNAKE_CASE, matching v0.9.60 precedent (`mcp/src/errors.ts:54-63`).
5. **Read-only schema-lock list (15 tools).** Input schemas remain byte-for-byte unchanged through this milestone. Phase 255 / Phase 259 tests assert against this list verbatim.

Total v0.9.62 contract surface: 36 action tools + 15 read-only tools = 51 MCP tools.

## Resolutions applied during Phase 254

Before pinning the artifact, four real discrepancies between the milestone-discuss draft (REQUIREMENTS.md as of 2026-05-11 morning) and the live `TOOL_REGISTRY` were surfaced by the planner agent and resolved at the milestone level:

| # | Discrepancy | Resolution |
|---|-------------|-----------|
| 1 | REQUIREMENTS draft contained both `back` and `go_back`; registry has only `go_back`. | Dropped `back` (transcription duplicate). |
| 2 | ROADMAP Hard Constraint listed `wait_for_element` / `wait_for_stable` as read-only; registry had them as action tools. | Classified as read-only for this milestone; Phase 255 flips their registry `_readOnly` flag. |
| 3 | Registry carried 6 action tools (`execute_js`, `select_text_range`, `scroll_to_top`, `scroll_to_bottom`, `scroll_to_element`, `fill_sheet`) not in REQUIREMENTS draft. | Included all 6 in the canonical action-tool list. |
| 4 | CONTRACT-05 starting set named `get_logs` and `get_task_status`; neither in registry. | Dropped both (transcription artifacts). |

REQUIREMENTS.md was updated and committed (`0f3c82b`) before the contract artifact was pinned, so REQUIREMENTS.md and the contract artifact are byte-aligned on the resolved scope.

## Commits

| Hash | Subject |
|------|---------|
| `0f3c82b` | docs: resolve v0.9.62 CONTRACT-01 / CONTRACT-05 vs live registry (drop back / get_logs / get_task_status; add 6 actions; wait_for_* -> read-only) |
| (next) | docs(254): pin v0.9.62 contract artifact (action-tool list, field-bundle keys, badge-allowlist citation, typed-error names, read-only schema-lock list) |

## Verification

- [x] `.planning/v0.9.62-CONTRACT.md` exists at the milestone-level path.
- [x] All eight required `##` section headers present (`Scope and intent`, `Action Tools (canonical list)`, `Field Bundle`, `Badge Allowlist (citation)`, `Typed Errors`, `Read-Only Tools (Schema Lock List)`, `Resolutions applied`, `Sign-Off`).
- [x] 36 verbatim action-tool names enumerated in a fenced code block, one per line.
- [x] Field-bundle keys `visual_reason` / `client` / `is_final` recorded with types in a Markdown table.
- [x] Badge-allowlist citation names the file path, the constant, and all three helper symbols. Allowlist values NOT duplicated.
- [x] Three typed-error names recorded verbatim with phase / surface / body intent.
- [x] 15 read-only schema-lock tools enumerated in a fenced code block.
- [x] Resolutions applied section records the four discrepancies and their resolutions verbatim.
- [x] Sign-off line is the last non-blank line of the file, exactly: `Contract pinned: 2026-05-11 -- v0.9.62 Implicit Visual Session Contract -- LakshmanTurlapati`.
- [x] ASCII-only, no emojis, no em-dashes between sentences.

## Phase status

**COMPLETE -- hard gate cleared.**

Phases 255-260 are unblocked. All milestone-level resolutions are locked in REQUIREMENTS.md and the contract artifact; downstream phases reference 36 action tools + 15 read-only tools with no ambiguity.

## Next

`/gsd-execute-phase 255` -- Schema Enforcement on Action Tools (applies the required field bundle to all 36 action tools in the canonical list, enforces `VISUAL_FIELDS_REQUIRED` / `BADGE_NOT_ALLOWED` typed errors, flips `_readOnly` flag on `wait_for_element` / `wait_for_stable`).
