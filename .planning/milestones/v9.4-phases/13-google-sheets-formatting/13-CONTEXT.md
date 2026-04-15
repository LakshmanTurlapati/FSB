# Phase 13: Google Sheets Formatting - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply professional formatting to a completed Google Sheet -- bold colored header row, frozen header, auto-sized columns, and visual polish. Formatting runs as a separate pass after Phase 12 data entry. This phase does NOT add new data capabilities or modify the data entry flow.

</domain>

<decisions>
## Implementation Decisions

### Header styling
- Dark charcoal/black background with white bold text -- maximum contrast
- Center-aligned header text (data rows remain left-aligned)
- Thin bottom border below the header row for visual separation
- Freeze row 1 only (not column A) so header stays visible when scrolling

### Color scheme / row styling
- Alternating row colors: white and light gray (zebra striping) for scannability
- Apply link column gets blue text color to signal clickability
- ADAPTIVE: If the sheet already has data and an existing formatting pattern, detect and follow that pattern rather than overriding with defaults. The dark header / alternating gray / blue links scheme is the default for fresh sheets only.

### Column sizing
- Auto-fit columns with sensible max widths -- cap description at ~300px, links at ~250px to prevent excessively wide columns
- Text wrap enabled but balanced -- rows should stay at 2-3 lines max, not become excessively tall
- Apply link column: convert raw URLs to clickable hyperlinks displaying "Apply" as the link text -- keeps column narrow and clean

### Formatting sequence
- Formatting runs as a separate pass AFTER all data entry completes
- Auto-triggers when data entry finishes -- seamless end-to-end workflow, no separate user command needed
- Keyboard shortcuts first (Ctrl+B for bold, etc.) -- use toolbar menus only when no shortcut exists (fill color, freeze)
- If sheet already has formatting: detect and adapt rather than overriding

### Claude's Discretion
- Exact hex values for dark charcoal header and light gray alternating rows
- How to detect existing formatting patterns (read cell styles vs heuristic)
- Order of formatting operations (select all data first, or format section by section)
- Hyperlink conversion mechanics (HYPERLINK formula insertion approach)
- How to handle edge cases (empty sheets, single-row data, very wide datasets)

</decisions>

<specifics>
## Specific Ideas

- User wants the formatting to be adaptive, not a fixed regime -- if the sheet has an existing pattern, follow it
- "Apply" hyperlinks should be blue and compact, replacing raw URLs
- The overall look should be professional and scannable -- dark header, clean alternating rows, no excessive whitespace

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 13-google-sheets-formatting*
*Context gathered: 2026-02-23*
