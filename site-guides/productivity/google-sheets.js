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
- Enter: Confirm and move down one cell

FORMULA BAR VERIFICATION:
- The formula bar (#t-formula-bar-input or .cell-input) shows the content of the currently selected cell
- Navigate to a cell via Name Box, then use getText on the formula bar to read the cell's value
- For HYPERLINK cells, the formula bar shows the full formula (e.g., =HYPERLINK("url","Apply"))
- This is the ONLY reliable way to verify cell contents -- do NOT try to read from the canvas grid

DATA ENTRY BEST PRACTICES:
- For bulk sequential entry: use Tab to advance columns, Enter to advance rows
- For targeted cell editing: use Name Box to jump directly to the cell
- Always press Ctrl+A after clicking the Name Box before typing a cell reference
- Sanitize cell values: prefix with space if starting with = + - @
- Use =HYPERLINK("url","label") for clickable links`,
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
    formulaBarInput: '#t-formula-bar-input, .cell-input',
    spreadsheetTitle: '.docs-title-input, input[aria-label*="name"], input[aria-label*="Rename"]',
    gridContainer: '#waffle-grid-container, .grid-container',
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
    ],
    dataEntrySequential: [
      'Click the Name Box (#t-name-box) to select it',
      'Press Ctrl+A to select all text in the Name Box',
      'Type the starting cell reference (e.g., "A1") and press Enter',
      'Type the first cell value',
      'Press Tab to move to the next column',
      'Type the next value, press Tab, repeat for all columns',
      'After the last column, press Enter to move to the start of the next row',
      'Repeat for all data rows'
    ],
    formulaBarVerification: [
      'Click the Name Box (#t-name-box)',
      'Press Ctrl+A to select all existing text',
      'Type the cell reference to verify (e.g., "A2") and press Enter',
      'The formula bar (#t-formula-bar-input) now shows the content of that cell',
      'Use getText on the formula bar element to read the cell value',
      'Compare the read value with the expected value',
      'If mismatch: the cell is already selected -- type the correct value to overwrite',
      'Press Tab or Enter to confirm the correction'
    ],
    enterHyperlinkFormula: [
      'Navigate to the target cell via Name Box',
      'Ensure the cell is empty (if not, press Delete to clear)',
      'Type the formula: =HYPERLINK("url","Apply")',
      'Press Tab or Enter to confirm -- the cell should show "Apply" as a clickable link',
      'If the cell shows the raw formula text, the cell was not empty -- clear and retry'
    ],
    renameSheet: [
      'Press Escape to exit any cell edit mode',
      'Click the spreadsheet title element at the top of the page (usually shows "Untitled spreadsheet")',
      'The title text becomes editable -- select all (Ctrl+A) and type the new name',
      'Press Enter to confirm the rename',
      'The title bar should now show the new name'
    ],
    appendToExistingSheet: [
      'Click the Name Box, type "A1", press Enter to go to the top',
      'Read the formula bar to check if A1 has a header value',
      'Press Tab to move through columns, reading each header from the formula bar',
      'Note the column mapping (which header is in which column)',
      'Press Ctrl+End to jump to the last cell with data',
      'Read the Name Box to see the last cell reference (e.g., "F25")',
      'The next empty row is one below -- navigate there via Name Box',
      'Begin data entry matching the existing column order'
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
    'If the spreadsheet has existing data, scroll or use Name Box to find empty rows before entering new data.',
    'When typing HYPERLINK formulas, ensure the cell is empty first. If the cell already has content, the = character may not trigger formula mode. Clear the cell with Delete before typing the formula.',
    'After clicking the Name Box, ALWAYS press Ctrl+A (Select All) before typing a new cell reference. This ensures the existing reference text is fully replaced, not appended to.',
    'For cell values that start with =, +, -, or @, prefix with a single space to prevent Sheets from interpreting the value as a formula. This is critical for Description fields.',
    'The formula bar (#t-formula-bar-input) shows the raw content of the currently selected cell. For HYPERLINK cells, it shows the formula, not the display text. Use this to verify formulas are correct.',
    'To rename the spreadsheet, you must first exit cell edit mode by pressing Escape. Then click the title element at the top of the page.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable', 'openNewTab', 'switchToTab', 'listTabs']
});
