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

KEYBOARD-FIRST NAVIGATION (MOST RELIABLE):
  # For sequential data entry, keyboard navigation is more reliable than clicking:
  key "Escape"              # exit any edit mode
  click e5                  # click Name Box (reliable with toolbar bypass)
  type e5 "A1"              # type starting cell reference
  key "Enter"               # navigate to cell A1
  type "Header 1"           # type into active cell (no ref needed)
  key "Tab"                 # move to next column (B1)
  type "Header 2"           # type into B1
  key "Tab"                 # move to C1
  type "Header 3"           # type into C1
  key "Enter"               # move to next row (A2)
  type "Data 1"             # type into A2
  key "Tab"                 # move to B2
  type "Data 2"             # type into B2

  IMPORTANT: After navigating to a cell via Name Box, you do NOT need to click
  the cell. Just type -- keystrokes go to the active cell automatically.
  For sequential data entry: type value, Tab (next column), type value, Tab, ..., Enter (next row).
  The key and type commands use the CDP keyboard API which bypasses all DOM readiness checks.

FEEDBACK LOOP AWARENESS:
  The cell grid is CANVAS-RENDERED -- after typing data into a cell, the DOM snapshot will NOT show
  the typed text in the grid. The ONLY way to verify cell content is via the formula bar.
  DO NOT assume typing failed just because the grid looks unchanged in the snapshot.

  For bulk data entry, TRUST your type+Tab/Enter sequences:
  1. Navigate to starting cell via Name Box
  2. Type all values using type + Tab (columns) + Enter (rows) pattern
  3. Do NOT stop to verify each cell after typing -- continue the sequence
  4. After completing all data entry, verify a SAMPLE cell (navigate via Name Box, read formula bar)
  5. If the formula bar shows the expected value for the sample cell, the sequence worked

  The formula bar element shows the content of the currently selected cell.
  After navigating to a cell, the formula bar ref in the snapshot shows its value
  as = "value" (e.g., \`e8: toolbar-input "Formula bar" [hint:formulaBar] = "Revenue"\`).
  Check this FIRST before using getText. If the snapshot shows = "" or no value,
  use getText on the formula bar ref as a fallback.

COMMON PATTERNS:
  # Name Box click pattern (also reliable with toolbar bypass):
  # navigate to cell and enter data
  key "Escape"          # exit edit mode first
  click e5              # Name Box
  type e5 "A1"
  enter                 # navigate to A1
  type e10 "cell value" # type into active cell
  key "Tab"             # move to next column
  # read cell value
  click e5              # Name Box
  type e5 "B2"
  enter
  gettext e8            # formula bar content

CRITICAL WARNING -- CELL NAVIGATION VS DATA ENTRY:
These are TWO SEPARATE STEPS using the "type" tool with DIFFERENT TARGETS:
  Step 1 (NAVIGATE): Click the Name Box (#t-name-box), type the cell reference (e.g., "B1"), press Enter.
    This MOVES the cursor to that cell. The cell reference is a NAVIGATION COMMAND, not data.
  Step 2 (ENTER DATA): Now type the actual data value. Keystrokes go into the active cell (no ref needed).
    The data value is what you want stored in the cell. Do NOT include the cell reference in the data.
NEVER DO THIS: Never type "b1" or any cell reference directly into a cell as if it were data.
  If you want to put data in cell B1: FIRST navigate to B1 via the Name Box, THEN type the actual data.
The "type" tool is used for BOTH steps but the TARGET differs: Step 1 targets #t-name-box, Step 2 targets the spreadsheet grid (NOT the Name Box). NEVER type data values into the Name Box.

CANVAS-BASED GRID:
- Google Sheets uses a CANVAS-BASED GRID for cell rendering. Individual cells are NOT standard DOM elements.
- You CANNOT click directly on cells in the grid -- the canvas intercepts clicks.
- The primary navigation method is the NAME BOX (cell reference input at top-left, showing "A1", "B2", etc.).

NAME BOX NAVIGATION (PRIMARY METHOD):
0. Press Escape to exit cell edit mode (CRITICAL -- if in edit mode, the reference will go into the active cell instead of the Name Box)
1. Click the Name Box element (#t-name-box) showing current cell reference like "A1"
2. The Name Box text will be selected/highlighted
3. Type the target cell reference (e.g., "A1", "B3", "D10")
4. Press Enter to navigate to that cell
5. The cell is now selected and ready for input -- focus has returned to the grid
6. Type the cell value (do NOT target the Name Box -- it is ONLY for cell references). Keystrokes go to the active cell.
  KEYBOARD ALTERNATIVE: If click on Name Box fails, use Ctrl+Home to go to A1 as a starting point,
  then use Tab/Enter to navigate to the target cell sequentially.

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
- The formula bar appears in the snapshot as a toolbar-input ref with the cell's value (= "value")
- FIRST check the formula bar ref in the snapshot for the cell value (passive -- no action needed)
- If the snapshot shows no value or = "", use getText on the formula bar ref as a fallback
- Navigate to a cell via Name Box, then check the snapshot or use getText on the formula bar
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
      'Press Escape to exit any cell edit mode',
      'Click the Name Box (#t-name-box)',
      'Type "A1" and press Enter to navigate to cell A1',
      'Type the first header text (e.g., "Company")',
      'Press Tab to move to B1',
      'Type the second header (e.g., "Role")',
      'Press Tab and continue for remaining headers',
      'Press Enter after the last header to move to row 2'
    ],
    enterRowData: [
      'Press Escape to exit any cell edit mode',
      'Click the Name Box (#t-name-box)',
      'Type the target cell reference (e.g., "A2") and press Enter',
      'Type the first field value',
      'Press Tab to move to next column',
      'Type the next field value',
      'Continue Tab + type for all fields in the row',
      'Press Enter to move to the start of the next row'
    ],
    navigateToCell: [
      'Press Escape to exit any cell edit mode',
      'Click the Name Box (#t-name-box) to select it',
      'Type the cell reference (e.g., "C5")',
      'Press Enter to navigate to that cell',
      'The cell is now selected and ready for input or reading'
    ],
    dataEntrySequential: [
      'Press Escape to exit any cell edit mode',
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
      'Press Escape to exit any cell edit mode',
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
      'Press Escape to exit any cell edit mode, then navigate to the target cell via Name Box (click Name Box, type cell ref, press Enter)',
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
      'Press Escape to exit any cell edit mode',
      'Click the Name Box, type "A1", press Enter to go to the top',
      'Read the formula bar to check if A1 has a header value',
      'Press Tab to move through columns, reading each header from the formula bar',
      'Note the column mapping (which header is in which column)',
      'Press Ctrl+End to jump to the last cell with data',
      'Read the Name Box to see the last cell reference (e.g., "F25")',
      'The next empty row is one below -- navigate there via Name Box',
      'Begin data entry matching the existing column order'
    ],
    formatHeaderRow: [
      'Press Escape to exit any cell edit mode',
      'Click the Name Box (#t-name-box), type "A1", press Enter to navigate to row 1',
      'Press Shift+Space to select the entire row 1',
      'Press Ctrl+B (or Cmd+B on Mac) to bold the header row',
      'Press Ctrl+Shift+E (or Cmd+Shift+E on Mac) to center-align the header text',
      'Press Shift+Alt+3 (bottom border shortcut) to add a thin bottom border below the header'
    ],
    freezeHeaderRow: [
      'Click the View menu (#docs-view-menu)',
      'Click "Freeze" in the dropdown menu',
      'Click "1 row" to freeze the header row',
      'A thick horizontal line should appear below row 1',
      'Alternative: press Alt+/ (Option+/ on Mac) to open the tool finder, type "Freeze", select "1 row"'
    ],
    applyAlternatingColors: [
      'Press Escape to exit any cell edit mode',
      'Click the Name Box, type the full data range (e.g., "A1:F26"), press Enter to select the range',
      'Click the Format menu (#docs-format-menu)',
      'Click "Alternating colors" to open the sidebar panel',
      'In the sidebar: ensure the "Header" checkbox is checked',
      'Set Header color to dark charcoal (#333333)',
      'Set Color 1 to white (#FFFFFF)',
      'Set Color 2 to light gray (#F3F3F3)',
      'Click "Done" to apply the alternating colors',
      'Fallback: if custom colors are hard to set, select the closest dark preset theme from the default styles'
    ],
    autoSizeColumns: [
      'Click the cell/row/column selector button (top-left corner of the grid, intersection of row and column headers) to select all cells',
      'Right-click on any column header letter to open the context menu',
      'Click "Resize columns" (or similar text like "Resize columns A-F")',
      'Select "Fit to data" option in the resize dialog',
      'Click "OK" to apply',
      'Alternative: double-click the border between column headers to auto-fit individual columns'
    ],
    applyLinkColumnBlueText: [
      'Press Escape to exit any cell edit mode',
      'Click the Name Box, type the Apply Link column data range (e.g., "F2:F26"), press Enter to select',
      'Apply blue text color (#1155CC) to signal clickability',
      'Use the text color toolbar button or Alt+/ tool finder typing "Text color"'
    ]
  },
  warnings: [
    'KEYBOARD NAVIGATION IS MOST RELIABLE: The key and type (without ref) commands use the Chrome DevTools Protocol keyboard API, bypassing all DOM readiness checks. When click actions fail or time out, switch to keyboard-only navigation: Escape (exit edit mode), Ctrl+Home (go to A1), Tab (next column), Enter (next row). For sequential data entry, prefer type + Tab + type + Tab + Enter over clicking individual cells.',
    'CANVAS FEEDBACK: The cell grid is canvas-rendered and invisible to DOM snapshots. After typing data, the grid will look unchanged. This is NORMAL. Trust your type+Tab sequences and verify via the formula bar only. Do NOT retry typing just because the grid snapshot looks empty.',
    'Google Sheets cells are rendered on a CANVAS -- you CANNOT click individual cells via DOM selectors. Always use the Name Box for cell navigation.',
    'CRITICAL: Press Escape before clicking the Name Box to exit cell edit mode. If you type a cell reference while still in edit mode, the reference will be appended to the current cell\'s content instead of navigating.',
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
    'To rename the spreadsheet, you must first exit cell edit mode by pressing Escape. Then click the title element at the top of the page.',
    'FORMATTING: Always press Escape before applying formatting shortcuts to ensure you are not in cell edit mode. Shortcuts like Ctrl+B do not work correctly in edit mode.',
    'FORMATTING: Use Shift+Space to select an entire row (must NOT be in cell edit mode). Click the row number on the left margin as an alternative.',
    'FORMATTING: The Alt+/ (Option+/ on Mac) tool finder searches all menu items by name. Use it when you cannot find a menu item or when toolbar button selectors are unreliable.',
    'FORMATTING: For alternating colors, select the data range FIRST, then open Format > Alternating colors. If the range is wrong, close the sidebar, reselect, and try again.',
    'FORMATTING: Column auto-size via right-click > Resize > "Fit to data" works on all selected columns at once. Select all columns first for best results.',
    'CRITICAL: Do NOT type cell references (A1, B2, C3, etc.) as cell VALUES. Cell references are ONLY for Name Box navigation. To put data in cell B1: click Name Box -> type "B1" -> press Enter -> THEN type your actual data value.'
  ],
  toolPreferences: ['navigate', 'click', 'rightClick', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable', 'openNewTab', 'switchToTab', 'listTabs']
});
