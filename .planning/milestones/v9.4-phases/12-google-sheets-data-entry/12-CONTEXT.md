# Phase 12: Google Sheets Data Entry - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Write accumulated career search job data into a Google Sheet with correct cell positioning. The AI navigates Sheets using the Name Box pattern (no canvas grid clicking), writes header and data rows, verifies correctness, and produces a clean spreadsheet of job listings. Formatting (bold headers, colors, frozen rows) is Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Sheet setup flow
- Default: create a new sheet via direct URL (docs.google.com/spreadsheets/create) -- no homepage navigation
- If user says "I have a Sheets tab open": switch to the open tab, matched by URL pattern (docs.google.com/spreadsheets)
- If user provides a URL: open that URL in a new tab
- If no matching Sheets tab found when user claims one is open: fall back to creating a new sheet
- If multiple Sheets tabs open: AI picks the best match (most recent/first found)
- Auto-name the sheet from task context (e.g., "Job Search - SWE Internships - Feb 2026")
- Rename timing is flexible -- before or after data entry, no strict rule
- Stay on the Sheets tab after data entry is complete (don't switch back)
- Wait for DOM signals (toolbar visible, grid rendered) before starting data entry -- no fixed delays
- If Google login wall is detected: use FSB's existing login handling flow

### Column layout and ordering
- Default columns (in order): Title, Company, Location, Date, Description, Apply Link
- All 6 columns appear by default unless user explicitly requests different columns
- When adapting to existing sheet: read existing headers and AI fuzzy-matches fields (e.g., "Role" maps to Title, "Firm" maps to Company)
- When adapting to existing sheet: append below existing data, matching the existing format
- Short header labels: Title, Company, Location, Date, Description, Apply Link
- Apply Link column uses clickable HYPERLINK formula (not raw URL text)
- Missing data shows "N/A" placeholder (not blank cells)
- Description column contains high-quality condensed summary: preserves all key info (requirements, skills, level, team) without filler text, single paragraph, no newlines

### Cell navigation pattern
- Dynamic strategy: Name Box + Tab for blank sheets (fast sequential fill), Name Box per cell for editing existing sheets (precision)
- AI decides input method based on context: type directly for values, formula bar for calculations/formulas
- Cell values are clean single-line text (summaries are already condensed paragraphs)
- Two-pass verification: verify each row after writing it, plus final full-sheet validation once all rows complete

### Error handling and progress
- Per-cell retry on verification failure: re-navigate to the specific wrong cell and retype (not whole row)
- If retry fails twice for same cell: skip it, continue with other rows, report skipped cells at the end
- Final validation finds misalignment: fix in-place (self-healing) rather than reporting to user
- Batch progress updates shown in the visual overlay only (e.g., "Written 10/25 rows...") -- no per-row chat messages

### Claude's Discretion
- Exact batch update frequency (every 5 or 10 rows)
- Sheet rename timing (before or after data entry)
- Tab vs Name Box switching threshold for existing sheets
- HYPERLINK formula format details

</decisions>

<specifics>
## Specific Ideas

- Name Box + Tab pattern avoids clicking the canvas grid, which is unreliable due to coordinate-based targeting
- Condensed descriptions should read like a recruiter's summary: key requirements, tech stack, team context, level -- no fluff
- The "adapt to existing sheet" mode should feel intelligent -- not rigid column matching but understanding what each header means

</specifics>

<deferred>
## Deferred Ideas

- "Pause automation and ask follow-up questions" capability: user wants the AI to be able to pause mid-workflow, ask a clarifying question, and resume based on the answer. This is an architectural feature that would need a settings toggle. Captured for future phase.

</deferred>

---

*Phase: 12-google-sheets-data-entry*
*Context gathered: 2026-02-23*
