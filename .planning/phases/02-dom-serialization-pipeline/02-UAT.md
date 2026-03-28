---
status: testing
phase: 02-dom-serialization-pipeline
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md
started: 2026-03-06T00:00:00Z
updated: 2026-03-06T00:00:00Z
---

## Current Test

[testing stopped - debugging in progress]

## Tests

### 1. AI Visibility on Complex Pages
expected: On a content-heavy page (e.g. LinkedIn feed, messaging, or a long form), the AI should receive enough page content to understand the full layout. The AI should reference elements that were previously invisible — compose areas, message lists, form fields further down the page.
result: issue
reported: "failed check logs"
severity: major

### 2. Element Text Distinguishes Similar Items
expected: On a page with repeated similar items (e.g. LinkedIn connection list with "First Last - Title at Company" entries), the AI should distinguish between them by name/title. List items get 150 chars of text (enough for full name + title), buttons/links get 80 chars. The AI should not confuse similar-looking items.
result: issue
reported: "failed check logs"
severity: major

### 3. No Mid-Element Truncation Artifacts
expected: When the AI describes page elements, each element should be complete — never cut off mid-field (e.g. no truncated selectors or half descriptions). Elements are either fully included or excluded entirely. If some are excluded, the AI should note how many were omitted rather than showing garbled partial elements.
result: issue
reported: "failed check logs"
severity: major

### 4. Form Task Prioritization
expected: When performing a form/email task (e.g. composing a message, filling out a form), the AI should focus on input fields, textareas, and submit buttons rather than navigation links or unrelated text. The AI's actions should target the relevant form elements first.
result: skipped
reason: Testing stopped by user for early debugging

### 5. Navigation Task Prioritization
expected: When performing a navigation task (e.g. "go to settings", "find the jobs page"), the AI should focus on links and navigation elements rather than form inputs. It should identify and click the correct navigation link without getting distracted by input fields.
result: skipped
reason: Testing stopped by user for early debugging

### 6. Dynamic Scaling on Simple vs Complex Pages
expected: On a simple page with few elements (e.g. a login page with ~10 elements), the AI should see all elements with full detail. On a complex page with many elements (e.g. 60+ interactive elements), the AI should still function — showing more elements with compressed detail rather than cutting off at a fixed limit of 25.
result: skipped
reason: Testing stopped by user for early debugging

## Summary

total: 6
passed: 0
issues: 3
pending: 0
skipped: 3

## Gaps

- truth: "AI receives enough page content to understand complex page layouts (15K cap)"
  status: failed
  reason: "User reported: failed check logs"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Element text distinguishes similar items with per-type adaptive limits (150/80/100 chars)"
  status: failed
  reason: "User reported: failed check logs"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Elements are included whole or excluded entirely, never truncated mid-field"
  status: failed
  reason: "User reported: failed check logs"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
