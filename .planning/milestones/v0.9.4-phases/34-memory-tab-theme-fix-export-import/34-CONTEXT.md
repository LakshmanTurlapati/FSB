# Phase 34: Memory Tab Theme Fix & Export/Import - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all theme mismatches in the Memory tab so elements respect `[data-theme="dark"]` / light mode, and add memory export/import (download JSON + import with duplicate detection).

</domain>

<decisions>
## Implementation Decisions

### Theme Fix
- Theme system uses `[data-theme="dark"]` on `<html>` with CSS custom properties (--bg-primary, --text-primary, --border-color, etc.)
- All new Phase 33 elements (outcome badges, collapsible sections, recon report detail, graph containers) must use CSS variables, not hardcoded colors
- Known hardcoded issues to fix:
  - `--surface-color` used but never defined in :root or dark mode
  - Guide name labels hardcoded `#4fc3f7` (cyan)
  - Snapshot unavailable `#ffb74d` (amber)
  - Markdown code block hardcoded `background: #1a1a2e; color: #e0e0e0`
  - Site graph legend using hardcoded `#4285f4` instead of CSS vars
  - Phase 33 outcome-badge, recon-section, task-graph-container styles may have hardcoded values

### Export/Import
- Export already exists as `exportMemories()` in options.js — downloads all memories as JSON blob
- Need to add Import: file input, parse JSON, validate, merge with duplicate detection (match by id)
- Import button goes in the overflow menu (three-dot) next to existing Export
- Import shows a confirmation with count: "Import X memories? (Y duplicates will be skipped)"

### Claude's Discretion
- Exact CSS variable values for elements that currently use hardcoded colors
- Import validation strategy (schema check depth)
- Whether to support partial import (select which memories to import) or all-or-nothing

</decisions>

<code_context>
## Existing Code Insights

### Theme Variables (options.css)
- Light: --bg-primary: #ffffff, --text-primary: #171717, --border-color: #e5e5e5
- Dark: --bg-primary: #262626, --text-primary: #f5f5f5, --border-color: #404040
- Status: --success-color, --error-color, --warning-color, --info-color
- MISSING: --surface-color (used 2x, never defined)

### Export (options.js ~line 5044)
- `exportMemories()` already works — fetches all from memoryManager.getAll(), creates JSON blob, downloads via anchor click
- File naming: `fsb-memories-YYYY-MM-DD.json`
- Toast notification on success/failure

### Integration Points
- Overflow menu in Memory tab has Consolidate, Export, Clear All — add Import here
- `memoryStorage.add()` for importing individual memories
- `validateMemory()` for validating imported memory objects

</code_context>

<deferred>
## Deferred Ideas

- Selective import (pick which memories) — all-or-nothing is fine for v1
- Export as PDF/markdown report — different feature entirely

</deferred>

---

*Phase: 34-memory-tab-theme-fix-export-import*
*Context gathered: 2026-03-16*
