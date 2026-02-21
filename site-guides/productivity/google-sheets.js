/**
 * Site Guide: Google Sheets
 * Per-site guide for Google Sheets spreadsheet application.
 */

registerSiteGuide({
  site: 'Google Sheets',
  category: 'Productivity Tools',
  patterns: [
    /docs\.google\.com\/spreadsheets/i,
    /sheets\.google\.com/i
  ],
  guidance: `GOOGLE SHEETS-SPECIFIC INTELLIGENCE:

CANVAS-BASED GRID:
- Google Sheets uses a CANVAS-BASED GRID for cell rendering. Individual cells are NOT standard DOM elements.
- You CANNOT click directly on cells in the grid -- the canvas intercepts clicks.
- The primary navigation method is the NAME BOX (cell reference input at top-left, showing "A1", "B2", etc.).

NAME BOX NAVIGATION (PRIMARY METHOD):
1. Click the Name Box element (#t-name-box) showing current cell reference like "A1"
2. The Name Box text will be selected/highlighted
3. Type the target cell reference (e.g., "A1", "B3", "D10")
4. Press Enter to navigate to that cell
5. The cell is now selected and ready for input
6. Type the cell value -- it will go into the formula bar and cell

DATA ENTRY:
- After typing a cell value, press TAB to move to the next column (right)
- Press ENTER to move to the next row (down) and back to column A
- For sequential row entry: type value, Tab, type value, Tab, ... Enter (moves to next row)
- This Tab/Enter pattern is the most reliable way to fill rows

KEYBOARD SHORTCUTS:
- Ctrl+S / Cmd+S: Force save (though Sheets auto-saves)
- Ctrl+Z / Cmd+Z: Undo last action
- Ctrl+Home / Cmd+Home: Go to cell A1
- Ctrl+End / Cmd+End: Go to last cell with data
- F2: Edit current cell
- Escape: Cancel current edit
- Tab: Move right one cell
- Shift+Tab: Move left one cell
- Enter: Confirm and move down one cell`,
  selectors: {
    nameBox: '#t-name-box',
    cellInput: '.cell-input, #cell-input',
    formulaBar: '#t-formula-bar-input, .cell-input',
    menuFile: '#docs-file-menu',
    menuEdit: '#docs-edit-menu',
    menuView: '#docs-view-menu',
    menuInsert: '#docs-insert-menu',
    menuFormat: '#docs-format-menu',
    menuData: '#docs-data-menu',
    menuTools: '#docs-tools-menu',
    sheetTabs: '.docs-sheet-tab',
    addSheet: '#sheet-button',
    toolbar: '#docs-toolbar',
    blankTemplate: '.docs-homescreen-templates-templateview-preview[aria-label*="Blank"]',
    newSheet: '.docs-homescreen-templates-templateview-preview'
  },
  workflows: {
    createNewSheet: [
      'Navigate to https://sheets.google.com',
      'Wait for the page to load fully',
      'Click on "Blank" template or "+" to create new spreadsheet',
      'Wait for the new sheet to load (Name Box should be visible)',
      'The sheet is ready for data entry'
    ],
    navigateToExistingSheet: [
      'Navigate to the provided Google Sheets URL',
      'Wait for the sheet to load completely',
      'Verify the Name Box (#t-name-box) is visible',
      'The sheet is ready for interaction'
    ],
    setupHeaderRow: [
      'Click the Name Box (#t-name-box)',
      'Type "A1" and press Enter to navigate to cell A1',
      'Type the first header text (e.g., "Company")',
      'Press Tab to move to B1',
      'Type the second header (e.g., "Role")',
      'Press Tab and continue for remaining headers',
      'Press Enter after the last header to move to row 2'
    ],
    enterRowData: [
      'Click the Name Box (#t-name-box)',
      'Type the target cell reference (e.g., "A2") and press Enter',
      'Type the first field value',
      'Press Tab to move to next column',
      'Type the next field value',
      'Continue Tab + type for all fields in the row',
      'Press Enter to move to the start of the next row'
    ],
    navigateToCell: [
      'Click the Name Box (#t-name-box) to select it',
      'Type the cell reference (e.g., "C5")',
      'Press Enter to navigate to that cell',
      'The cell is now selected and ready for input or reading'
    ]
  },
  warnings: [
    'Google Sheets cells are rendered on a CANVAS -- you CANNOT click individual cells via DOM selectors. Always use the Name Box for cell navigation.',
    'The Name Box is the ONLY reliable way to navigate to specific cells. It is located at the top-left of the sheet.',
    'Google Sheets auto-saves continuously -- there is no explicit save needed, but Ctrl+S can force a save.',
    'If the sheet is in VIEW-ONLY mode, data entry will not work. Check for an "Edit" or "Request access" button.',
    'After typing in a cell, you MUST press Tab or Enter to confirm the value. Without confirming, the value may be lost.',
    'Google Sheets may show a loading spinner when first opened -- wait for the Name Box to appear before attempting any actions.',
    'Google Sheets formulas start with "=" -- if entering data that starts with "=", the sheet will interpret it as a formula.',
    'Sheet tab names appear at the bottom of the screen. The default first tab is "Sheet1".',
    'If the spreadsheet has existing data, scroll or use Name Box to find empty rows before entering new data.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute']
});
