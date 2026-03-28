---
status: testing
phase: 25-google-sheets-snapshot-pipeline-fix
source: [25-01-SUMMARY.md]
started: 2026-03-09T17:15:00Z
updated: 2026-03-09T17:15:00Z
---

## Current Test

number: 1
name: Formula Bar Visible in Snapshot
expected: |
  On a Google Sheets page with a cell selected, open the sidepanel and trigger a snapshot (or run any automation step that generates a DOM snapshot). The markdown snapshot output should contain a ref line for the formula bar element showing the cell's content value (e.g., `e5: div "Formula bar" [hint:formulaBar] = "cell value"`). Check the sidepanel debug log or console for the `sheets_walker_postinject` log entry confirming post-injection occurred.
awaiting: user response

## Tests

### 1. Formula Bar Visible in Snapshot
expected: On a Google Sheets page with a cell selected, trigger a DOM snapshot. The markdown snapshot should contain a formula bar ref line with the selected cell's content value. The `sheets_walker_postinject` debug log should show `postInjected >= 1` for the formula-bar role.
result: issue
reported: "No progress - formula bar not appearing in snapshot"
severity: blocker

### 2. Name Box Visible in Snapshot
expected: On the same Google Sheets page, the markdown snapshot should also contain a name box ref line showing the selected cell reference (e.g., "A1", "B3"). The `sheets_walker_postinject` log should list both `formula-bar` and `name-box` in the roles array.
result: [pending]

### 3. No Duplicate Elements When Already Visible
expected: If the formula bar's parent container happens to NOT have aria-hidden (e.g., when actively editing a cell), the post-injection should detect that the element was already emitted during the main walk and skip it. The `sheets_walker_postinject` log should show `alreadyEmitted >= 1` and `postInjected: 0` in that scenario. No duplicate ref lines for the same element should appear in the snapshot.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
