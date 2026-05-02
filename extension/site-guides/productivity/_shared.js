/**
 * Shared Category Guidance: Productivity Tools
 * Category-level guidance that applies to all productivity tool sites.
 * Covers all interaction paradigms: canvas, block editors, card/board, form, grid, calendar.
 */

registerCategoryGuidance({
  category: 'Productivity Tools',
  icon: 'fa-list-check',
  guidance: `PRODUCTIVITY TOOLS INTELLIGENCE:

INTERACTION PARADIGMS:
- Canvas-based apps (Google Sheets, Docs): Use tool-specific navigation (Name Box, keyboard shortcuts)
- Block editors (Notion): Click to place cursor in block, use slash commands for new blocks
- Card/board layouts (Trello, Jira): Use keyboard shortcuts for navigation, Enter to open cards
- Form-based apps (Todoist, Jira create): Tab between fields, use dropdowns via keyboard
- Grid apps (Airtable): Arrow keys to navigate cells, Enter to edit, Escape to exit
- Calendar apps (Google Calendar): Opt-in keyboard shortcuts, date navigation with arrows

KEYBOARD-FIRST APPROACH:
- Always attempt keyboard shortcuts before clicking
- Most productivity apps have comprehensive shortcut coverage
- If shortcuts require opt-in (Google Calendar), enable them first
- Verify input focus before typing -- lost focus causes shortcut interception

MODAL/POPOVER TIMING:
- All apps use animated overlays (100-400ms render time)
- After triggering a modal, use waitForElement targeting [role="dialog"] or [role="menu"]
- Do NOT type into modals immediately -- wait for the animation to complete

CONTENTEDITABLE EDITORS:
- Notion, Jira, Airtable rich text fields use contenteditable
- Always click the target field first to establish focus
- Then type content -- keystrokes go to the focused element
- Press Escape to exit edit mode

AUTO-SAVE:
- Most productivity apps auto-save (Google suite, Notion, Airtable)
- Todoist and Trello save on action (Enter, click Save)
- Jira requires explicit Save/Update button clicks`,
  warnings: [
    'KEYBOARD FIRST: Always try keyboard shortcuts before clicking. Most productivity apps have comprehensive shortcut coverage.',
    'FOCUS VERIFICATION: Before typing, verify the correct input/field has focus. Lost focus causes keyboard shortcuts to fire instead of text input.',
    'MODAL TIMING: After opening a modal or popover, wait 200-400ms for animation to complete before interacting.',
    'CONTENTEDITABLE: For rich text editors (Notion, Jira), click the field first to focus, then type.',
    'AUTO-SAVE: Google suite and Notion auto-save. Todoist/Trello save on action. Jira requires explicit save.',
    'VIEW-ONLY: Check for edit/view mode toggles before attempting modifications.'
  ]
});
