---
status: diagnosed
phase: 24-google-sheets-workflow-recovery
source: [24-01-SUMMARY.md, 24-02-SUMMARY.md, 24-03-SUMMARY.md, 24-04-SUMMARY.md, 24-05-SUMMARY.md]
started: 2026-03-07T22:00:00Z
updated: 2026-03-09T10:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Strong keyword triggers Sheets guide
expected: Submit a task like "open my google sheet" (singular). The Sheets guide activates despite "google sheet" not exactly matching "google sheets". Debug logs show guide activation.
result: pass

### 2. URL in task text triggers Sheets guide
expected: Submit a task containing a Sheets URL, e.g. "fill in this sheet: https://docs.google.com/spreadsheets/d/abc123/edit". The Sheets guide loads on the first iteration via URL extraction, even if the browser is on a different page. Debug logs show guide detected via URL.
result: pass

### 3. Weak keyword alone does NOT trigger guide
expected: Submit a task with only a weak keyword like "download this sheet" (no "google" prefix, no URL). The Sheets guide should NOT activate, since "sheet" alone (weight 1) doesn't meet the threshold of 2. The AI gets the generic prompt instead.
result: skipped
reason: Negative test — not triggered in session, structurally verified in code

### 4. Generic prompt includes exploration guidance
expected: Start a task on an unfamiliar page (not matching any site guide). The AI's system prompt includes an EXPLORATION STRATEGY section mentioning keyboard shortcuts (Tab, Enter, Escape, arrow keys) and advising against opening new tabs.
result: pass

### 5. Canvas-aware stuck recovery
expected: When the AI gets stuck on a Google Sheets/Docs/Slides URL, the recovery hints suggest keyboard-based interaction (Escape to exit edit mode, Tab/Enter to navigate) instead of "open a new tab" or "navigate to a different page".
result: pass

### 6. Guide activation logging
expected: When a site guide activates mid-session, an info-level log entry appears showing the guide name and detection method (URL or keyword). Visible in extension debug logs (Debug Mode enabled in settings).
result: pass

### 7. AI can fill data into Google Sheets cells (re-test after fix)
expected: Submit "open a google sheet, fill in random data". The AI navigates to Sheets, clicks into cells or uses Name Box/keyboard, types data, and data appears in cells. The AI should now be able to see formula bar content in snapshots and trust its typing sequences without per-cell visual verification.
result: issue
reported: "same old same old, i see no improvement. AI still blind to sheet content, no data filled."
severity: blocker

### 8. Toolbar click bypass works on Sheets elements
expected: During a Sheets task, the AI clicks on Name Box or toolbar elements. The click completes immediately without a 10-second timeout. In debug logs, you should NOT see "ensureElementReady" timeout errors for toolbar elements.
result: skipped
reason: Downstream of test 7 blocker — still unresolved

### 9. Batch keystrokes preserved in sequence
expected: During a Sheets data-filling task, the AI sends sequential type+Tab or type+Enter actions. All keystrokes arrive in order — no dropped Tab/Enter keys between typed values. Cells fill left-to-right (Tab) or top-to-bottom (Enter) without skipping.
result: skipped
reason: Downstream of test 7 blocker — still unresolved

### 10. AI prefers keyboard-first navigation in Sheets
expected: When the Sheets guide is active, observe the AI's approach. It should prefer keyboard shortcuts (Ctrl+G or F5 for Go To, Tab/Enter for cell navigation, type for data entry) over clicking individual cells. The system prompt guidance section should mention "KEYBOARD-FIRST NAVIGATION" when inspected.
result: skipped
reason: Downstream of test 7 blocker — still unresolved

## Summary

total: 10
passed: 5
issues: 1
pending: 0
skipped: 4

## Gaps

- truth: "AI can click and type into Google Sheets elements (Name Box, cells)"
  status: resolved
  reason: "Fixed in plans 24-03 (toolbar click bypass) and 24-04 (keyboard-first guide)"
  severity: blocker
  test: 7
  root_cause: "Resolved — canvas editor toolbar bypass and inter-action delay deployed"
  artifacts: []
  missing: []
  debug_session: ""

- truth: "AI can fill data into Google Sheets cells and see the result"
  status: failed
  reason: "User reported: same old same old, no improvement. AI still blind to sheet content despite plan 24-05 fix. Also requests enhanced logging to see what's happening."
  severity: blocker
  test: 7
  root_cause: "Plan 24-05 contenteditable fix is structurally unreachable. Three compounding issues: (1) Stage 1b canvas injection only has Google Docs selectors, zero Sheets selectors — formula bar elements never get data-fsbRole bypass. (2) Formula bar has dual-state DOM — in view mode (when snapshots are taken) the contenteditable div is hidden, content lives in separate display element. (3) Triple exclusion gates (aria-hidden, isVisibleForSnapshot dimension check, Stage 2 filter) kill the formula bar element before formatInlineRef ever runs."
  artifacts:
    - path: "content/dom-analysis.js"
      issue: "Stage 1b canvas injection (lines 1764-1778) has zero Sheets selectors — no #t-formula-bar-input, .cell-input, or #t-name-box"
    - path: "content/dom-analysis.js"
      issue: "formatInlineRef contenteditable capture (lines 2061-2068) is correct but element never reaches it due to upstream filters"
    - path: "site-guides/productivity/google-sheets.js"
      issue: "Guide promises formula bar values as = 'value' but pipeline cannot deliver them"
  missing:
    - "Add Sheets-specific element injection in Stage 1b (mirror Docs pattern) for #t-formula-bar-input, .cell-input, #t-name-box with data-fsbRole bypass"
    - "Read formula bar content from display layer (not just contenteditable innerText) since it shows content in a non-contenteditable sibling in view mode"
    - "Enhanced logging: log when site-guide-referenced selectors are found in DOM but filtered out by visibility checks"
    - "Enhanced logging: log snapshot content summary so user can see what AI actually receives"
  debug_session: ".planning/debug/sheets-blindness-post-fix.md"
