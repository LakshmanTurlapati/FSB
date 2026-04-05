---
status: complete
phase: 08-site-guides-viewer
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md
started: 2026-02-21T12:00:00Z
updated: 2026-02-21T12:30:00Z
---

## Current Test

[testing complete - halted early due to fundamental design issue]

## Tests

### 1. Extension Loads Without Errors
expected: Open the extension options page and check the browser console. No errors related to site guide files, registry, or viewer should appear.
result: pass

### 2. Site Guides Section Visible in Memory Tab
expected: On the options page, navigate to the Memory tab. A "Site Guides" section should be visible between the memory list and the Site Explorer section. It should show a header with a count of total sites (43 sites).
result: issue
reported: "Major misconception of what was requested. Site guides should be displayed the same way memories are displayed -- with mind maps and the simple list format -- not a custom accordion with detailed sub-sections for selectors, workflows, warnings, etc. The whole viewer is overengineered."
severity: blocker

### 3. All 9 Categories Displayed with Icons
expected: In the Site Guides section, all 9 categories should be listed with FontAwesome icons.
result: skipped
reason: Blocked by Test 2 blocker -- viewer design fundamentally wrong

### 4. Sites Listed Under Categories
expected: Each category shows its individual sites.
result: skipped
reason: Blocked by Test 2 blocker

### 5. Accordion Site Detail Panel
expected: Click on any site name to expand detail panel with accordion behavior.
result: skipped
reason: Blocked by Test 2 blocker -- accordion approach is wrong, should use memory-style display

### 6. Detail Panel Sub-Sections
expected: Expanded site shows collapsible sub-sections.
result: skipped
reason: Blocked by Test 2 blocker -- sub-sections approach is wrong

### 7. Search Filters Site Guides
expected: Type in the memory search box to filter site guides.
result: skipped
reason: Blocked by Test 2 blocker

### 8. Dark Theme Support
expected: Dark theme renders correctly for site guides viewer.
result: skipped
reason: Blocked by Test 2 blocker

## Summary

total: 8
passed: 1
issues: 1
pending: 0
skipped: 6

## Gaps

- truth: "Site guides displayed in the same style as memories (list items with mind map/graph detail view)"
  status: failed
  reason: "User reported: Major misconception -- site guides should display like memories with mind maps, not a custom accordion with sub-sections for selectors/workflows/warnings"
  severity: blocker
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
