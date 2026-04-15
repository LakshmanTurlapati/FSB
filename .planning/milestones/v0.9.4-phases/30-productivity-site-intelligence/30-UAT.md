---
status: testing
phase: 30-productivity-site-intelligence
source: [30-01-SUMMARY.md, 30-02-SUMMARY.md, 30-03-SUMMARY.md, 30-04-SUMMARY.md]
started: 2026-03-16T09:30:00Z
updated: 2026-03-16T09:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: fsbElements injection on non-Sheets app
expected: |
  Navigate to any of the 7 new apps (e.g., keep.google.com). Start a task. In the DOM snapshot sent to the AI, you should see fsbElements injected as backtick element refs with fsbRole labels (e.g., `e12: toolbar-button "Bold" [hint:bold]`). Check the console for a health check log line showing which selectors matched per element.
awaiting: user response

## Tests

### 1. fsbElements injection on non-Sheets app
expected: Navigate to any of the 7 new apps (e.g., keep.google.com). Start a task. The DOM snapshot should contain fsbElements injected with fsbRole labels. Console shows health check log with selector match info per element.
result: [pending]

### 2. Google subdomain disambiguation
expected: Navigate to keep.google.com — FSB loads Google Keep guide (not Sheets). Navigate to calendar.google.com — FSB loads Google Calendar guide. Navigate to docs.google.com/spreadsheets — FSB loads Google Sheets guide. Each loads a different guide with different fsbElements and guidance.
result: [pending]

### 3. Keyword matching loads correct guide
expected: Start a task like "create a note in Google Keep" — the Keep site guide loads automatically. Start "add a card to Trello" — Trello guide loads. The AI receives app-specific guidance and workflows without the user configuring anything.
result: [pending]

### 4. Google Keep workflows
expected: On keep.google.com, ask FSB to create a new note. The AI should use keyboard shortcuts (press C to create), type content, and verify via the note appearing in the grid. Ask FSB to create a checklist — it should use slash-L or the checklist button. Workflows should include verification steps and stuck recovery.
result: [pending]

### 5. Todoist Quick Add
expected: On todoist.com, ask FSB to create a task "Buy milk tomorrow p1 #Shopping @errands". The AI should open Quick Add (press Q), type the full natural language string, and press Enter. The task should appear with priority 1, due tomorrow, in Shopping project, with errands label.
result: [pending]

### 6. Todoist single-key shortcut safety
expected: When FSB types into a Todoist input field, it should not trigger single-key shortcuts (Q opens Quick Add, M opens sidebar, etc.). The guide warns the AI to always verify input focus before typing. No accidental sidebar/menu opening during text entry.
result: [pending]

### 7. Trello card management
expected: On trello.com, ask FSB to create a new card on a board. The AI should use keyboard shortcuts (N for new card) or click the Add button. For moving a card between lists, the AI should use the Move button (not drag-and-drop) to select the target list via the dropdown.
result: [pending]

### 8. Google Calendar event creation
expected: On calendar.google.com, the first thing the guide should do is enable keyboard shortcuts (Settings > General > Keyboard shortcuts). Then ask FSB to create an event — it should use C shortcut, fill in title/time/details, and save. Date navigation via J/K shortcuts.
result: [pending]

### 9. Notion slash commands
expected: On notion.so, ask FSB to create a new page and add content blocks. The AI should use slash commands (/heading, /todo, /table, /code) as the primary block creation method. It should click-then-type for contenteditable blocks. Slash command reference should be prominent in guidance.
result: [pending]

### 10. Jira issue creation
expected: On a Jira Cloud instance, ask FSB to create an issue. The AI should fill all common fields: summary, type, description, priority, assignee, sprint, labels, story points. The guide should document field-by-field interaction for the create issue modal.
result: [pending]

### 11. Airtable field-type interaction
expected: On airtable.com, ask FSB to edit records in a grid view. The AI should handle different field types correctly: click+type for text, click+pick for select/dropdown, click+picker for date, click for checkbox, click+search for linked records. Read-only fields (formula, rollup) should NOT be attempted.
result: [pending]

### 12. dragdrop tool
expected: The `dragdrop` CLI command is available. When invoked as `dragdrop e5 e12`, it attempts to drag element e5 to element e12 using a 3-method fallback (HTML5 DragEvent, PointerEvent, MouseEvent). Test on Trello (move card) or Calendar (resize event) to see if the drag succeeds.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]
