---
status: testing
phase: 42-remote-task-control
source: [42-01-SUMMARY.md, 42-02-SUMMARY.md]
started: 2026-03-18T01:20:00Z
updated: 2026-03-18T01:20:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. Run `node server/server.js` from repo root. Server boots without errors. Dashboard loads at http://localhost:3847/dashboard.html.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Run `node server/server.js` from repo root. Server boots without errors. Dashboard loads at http://localhost:3847/dashboard.html.
result: [pending]

### 2. Task Input Bar Visible When Paired
expected: After pairing (QR or paste key), the dashboard shows a task input bar at the top of the content area (above agent stats). Text input with placeholder "What should FSB do?" and an arrow submit button to the right. Input should be enabled when extension is online.
result: [pending]

### 3. Submit a Task from Dashboard
expected: Type a task (e.g., "Go to google.com and search for weather") in the input bar and click the arrow or press Enter. The input area transitions to a progress view showing the task text as a title, a thin accent-colored progress bar, and metadata (phase label, ETA, elapsed time). The extension starts executing the task in your browser.
result: [pending]

### 4. Real-Time Progress Updates
expected: While the task runs, the progress bar fills, percentage updates, phase label changes (e.g., "Navigating" → "Reading" → "Clicking"), ETA counts down, and elapsed time counts up. Updates arrive roughly every second.
result: [pending]

### 5. Action Summary Line
expected: Below the progress metadata, a single line prefixed with ">" shows what FSB is currently doing (e.g., "> Clicking search button"). This line updates in place as FSB works through steps.
result: [pending]

### 6. Task Completion — Success
expected: When the task finishes successfully, the progress bar fills to 100% and turns green. Status shows "✓ Complete" with total elapsed time. A result summary line appears describing what was accomplished. The task input reappears below for the next task.
result: [pending]

### 7. Task Completion — Failure
expected: If a task fails (e.g., element not found, navigation error), the progress bar turns red. Status shows "✗ Failed" with an error description. A "Retry Task" button appears. The task input also reappears to try something different.
result: [pending]

### 8. One Task at a Time
expected: While a task is running, the input field is disabled/grayed out. Trying to submit another task is not possible until the current one finishes.
result: [pending]

### 9. Extension Offline State
expected: If the extension disconnects while on the dashboard, the task input should be disabled with an indication that the extension is offline. Reconnecting should re-enable it.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
