/**
 * Shared Category Guidance: Productivity Tools
 * Category-level guidance that applies to all productivity tool sites.
 */

registerCategoryGuidance({
  category: 'Productivity Tools',
  icon: 'fa-list-check',
  guidance: `PRODUCTIVITY TOOLS INTELLIGENCE:

CANVAS-BASED APPLICATIONS:
- Google Sheets and Google Docs use CANVAS-BASED RENDERING.
- Individual cells (Sheets) and text (Docs) are NOT standard DOM elements.
- You CANNOT click directly on cells or text in the canvas -- use navigation tools instead.
- The primary navigation method varies by tool (Name Box for Sheets, keyboard shortcuts for Docs).

DATA ENTRY WORKFLOW (Spreadsheets):
- After typing a value, press TAB to move to the next column (right)
- Press ENTER to move to the next row (down)
- For sequential row entry: type value, Tab, type value, Tab, ... Enter (moves to next row)
- This Tab/Enter pattern is the most reliable way to fill data

DOCUMENT EDITING WORKFLOW:
- Click the document body to focus it, then type to insert text at cursor position
- Press Enter to create a new paragraph
- Use keyboard shortcuts for formatting (Ctrl+B for bold, etc.)
- Content auto-saves as you type

KEYBOARD SHORTCUTS (Common):
- Ctrl+S / Cmd+S: Force save (though auto-save is continuous)
- Ctrl+Z / Cmd+Z: Undo last action
- Ctrl+Home / Cmd+Home: Go to beginning
- Ctrl+End / Cmd+End: Go to end
- Ctrl+F / Cmd+F: Find
- Ctrl+H / Cmd+H: Find and Replace`,
  warnings: [
    'Canvas-based rendering means cells/text are NOT in the DOM -- use tool-specific navigation methods',
    'VIEW-ONLY mode prevents editing -- check for an "Edit" or "Request access" button',
    'Auto-save is continuous but Ctrl+S can force a save',
    'Long documents/sheets render lazily -- scroll to trigger loading of content below the fold'
  ]
});
