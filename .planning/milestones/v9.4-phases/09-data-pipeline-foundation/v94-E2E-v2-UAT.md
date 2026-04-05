---
status: testing
phase: v9.4-full-pipeline-v2
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 12-01-SUMMARY.md, 12-02-SUMMARY.md, 13-01-SUMMARY.md, 13-02-SUMMARY.md
started: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 2
name: Launch Full Pipeline Task (post-fix retest)
expected: |
  Reload the extension, then re-run the full pipeline task. Text should now appear in Google Sheets cells.
awaiting: fix applied, ready for retest

## Tests

### 1. Extension Loads Clean
expected: Reload the FSB extension in Chrome. Open the service worker console. No errors about missing files, failed importScripts, or undefined functions should appear.
result: pass

### 2. Launch Full Pipeline Task
expected: Open the FSB side panel and type: "Find software engineer internship jobs at Microsoft and Amazon and put them in a Google Sheet". The extension should accept the task, begin automation, and show the progress overlay.
result: issue
reported: "Pipeline ran through career search and reached Google Sheets. AI was navigating cells in a pattern (Tab/Enter movements) but no text was actually entered -- all cells remained empty. Had to manually increase iteration limit in options to prevent timeout. The AI was trying hard but could not write any data into the sheet."
severity: blocker

### 3. First Company Search (Microsoft)
expected: FSB navigates to Microsoft's career site (careers.microsoft.com), searches for software engineer internships, and extracts job listings. The progress overlay should show something like "Job search: 1/2 companies" or similar progress indicator.
result: [pending]

### 4. Company Transition (Microsoft to Amazon)
expected: After finishing Microsoft, FSB automatically transitions to Amazon WITHOUT you doing anything. The key fix: the AI should NOT remain confused about Microsoft -- it should clearly navigate to Amazon's career site (amazon.jobs) with fresh context. No stale Microsoft references should carry over.
result: [pending]

### 5. Second Company Search (Amazon)
expected: FSB searches Amazon's career site for software engineer internships and extracts job listings. The progress overlay should update to "Job search: 2/2 companies" or similar. After extraction, a summary of total jobs found across both companies should appear.
result: [pending]

### 6. Auto-Trigger Sheets Entry
expected: After the multi-site search completes, FSB should automatically open a new Google Sheet tab and begin writing job data WITHOUT requiring a second command from you. The transition should be seamless with no wasted iterations from stale career context.
result: [pending]

### 7. Data Written to Sheet
expected: Job listings appear in the Google Sheet with columns: Company, Title, Date, Location, Description, Apply Link. The Apply Link column should contain clickable HYPERLINK formulas (not raw URLs). All rows from both companies should be present with no missing entries or misaligned columns.
result: [pending]

### 8. Sheet Named Correctly
expected: The Google Sheet tab should have a context-aware name derived from the search (e.g., "Job Search - SWE Internships - Feb 2026"), not "Sheet1" or a generic name.
result: [pending]

### 9. Auto-Trigger Formatting
expected: After all data rows are written, a formatting pass should start automatically WITHOUT a second command. The side panel or overlay should indicate formatting is in progress.
result: [pending]

### 10. Header Formatting and Freeze
expected: The header row (row 1) should be bold with a dark background color and white text. The header row should be frozen (stays visible when you scroll down through the job listings).
result: [pending]

### 11. Final Formatted Sheet
expected: The finished sheet should have: alternating row colors (white and light gray), auto-sized columns (no truncated text), and blue colored text in the Apply Link column. The overall appearance should look professional and readable.
result: [pending]

## Summary

total: 11
passed: 1
issues: 1
pending: 9
skipped: 0

## Gaps

- truth: "AI can type text into Google Sheets cells during data entry"
  status: failed
  reason: "User reported: AI was navigating cells in a pattern (Tab/Enter movements) but no text was actually entered -- all cells remained empty."
  severity: blocker
  test: 2
  root_cause: "CDP Input.insertText does not work in Google Sheets. The type tool uses cdpInsertText for canvas-based editors, which sends Input.insertText via Chrome Debugger API. This bypasses the keyboard event pipeline -- Google Sheets requires keyDown events to enter cell edit mode before accepting text. Input.insertText silently succeeds but text has nowhere to go. Meanwhile keyPress (Tab/Enter) uses Input.dispatchKeyEvent which fires proper keyboard events that Sheets processes."
  artifacts:
    - path: "content/actions.js"
      issue: "Canvas editor bypass (line ~1600) routes all docs.google.com pages to CDP Input.insertText, which does not enter cell edit mode in Google Sheets"
    - path: "content/actions.js"
      issue: "Canvas editor fallback (line ~2387) has same Input.insertText problem for selector-less typing"
  missing:
    - "Google Sheets detection in canvas editor bypass to use typeWithKeys (Input.dispatchKeyEvent per character) instead of cdpInsertText"
    - "Google Sheets detection in canvas editor fallback with same typeWithKeys approach"
  debug_session: ""
