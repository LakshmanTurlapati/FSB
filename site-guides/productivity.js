/**
 * Site Guide: Productivity Tools
 * Covers Google Sheets, Google Docs, and related Google Workspace applications.
 * Provides guidance for spreadsheet navigation, data entry, and document editing.
 */

const PRODUCTIVITY_GUIDE = {
  name: 'Productivity Tools',

  patterns: [
    /docs\.google\.com\/spreadsheets/i,
    /sheets\.google\.com/i,
    /docs\.google\.com\/document/i
  ],

  guidance: `PRODUCTIVITY TOOLS -- GOOGLE SHEETS & DOCS INTELLIGENCE:

GOOGLE SHEETS ARCHITECTURE:
- Google Sheets uses a CANVAS-BASED GRID for cell rendering. Individual cells are NOT standard DOM elements.
- You CANNOT click directly on cells in the grid -- the canvas intercepts clicks and the DOM selectors will not match visible cell content.
- The primary navigation method is the NAME BOX (cell reference input at top-left, showing "A1", "B2", etc.).

NAME BOX NAVIGATION (PRIMARY METHOD):
1. Click the Name Box element (shows current cell reference like "A1")
   - Selector: #t-name-box or input.jfk-textinput (the cell reference input at top-left)
2. The Name Box text will be selected/highlighted
3. Type the target cell reference (e.g., "A1", "B3", "D10")
4. Press Enter to navigate to that cell
5. The cell is now selected and ready for input
6. Type the cell value -- it will go into the formula bar and cell

DATA ENTRY WORKFLOW:
- After typing a cell value, press TAB to move to the next column (right)
- Press ENTER to move to the next row (down) and back to column A
- For sequential row entry: type value, Tab, type value, Tab, ... Enter (moves to next row)
- This Tab/Enter pattern is the most reliable way to fill rows

CREATING A NEW GOOGLE SHEET:
1. Navigate to https://sheets.google.com
2. Click "Blank" or the "+" button to create a new spreadsheet
3. Wait for the sheet to load (the grid and Name Box should appear)
4. The sheet is ready for data entry

OPENING AN EXISTING SHEET:
1. Navigate to the sheet URL provided by the user
2. Wait for the sheet to load completely
3. Verify the Name Box is visible and interactive

HEADER ROW SETUP:
1. Navigate to cell A1 using Name Box
2. Type the first header (e.g., "Company")
3. Press Tab to move to B1
4. Type the next header (e.g., "Role")
5. Continue Tab + type for all headers
6. Press Enter after the last header to move to row 2
7. Headers are now set up

ENTERING ROW DATA:
1. Navigate to the starting cell using Name Box (e.g., "A2" for first data row)
2. Type the first field value
3. Press Tab to move to next column
4. Type the next field value
5. Continue Tab + type for all fields in the row
6. Press Enter to move to the next row
7. Repeat for each data row

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

GOOGLE DOCS ARCHITECTURE:
- Google Docs uses a CANVAS-BASED RENDERER for text display (similar to Sheets).
- The visible text on screen is drawn on a canvas -- it is NOT standard DOM text you can click or select directly.
- The actual editable surface is a hidden contenteditable div that receives keystrokes.
- To position the cursor, click approximately where you want on the canvas area (.kix-page-column), then type.
- The document title (.docs-title-input) IS a normal input field and can be clicked/typed into directly.

DOCUMENT NAVIGATION:
- Click on the document canvas (.kix-page-column) to place cursor and begin editing
- Use Ctrl+Home / Cmd+Home to jump to the beginning of the document
- Use Ctrl+End / Cmd+End to jump to the end of the document
- Use Ctrl+F / Cmd+F to open Find & Replace dialog
- Use the Outline sidebar (View > Show outline, or Ctrl+Alt+H / Cmd+Option+H) to jump between headings
- Page Up / Page Down to scroll through long documents

TYPING AND EDITING:
- Click the document body to focus it, then type to insert text at cursor position
- Press Enter to create a new paragraph
- Press Shift+Enter for a line break within a paragraph
- Use Backspace/Delete to remove text
- Select text by click-dragging or Shift+Arrow keys, then type to replace
- Ctrl+A / Cmd+A to select all document content

FORMATTING (KEYBOARD SHORTCUTS):
- Ctrl+B / Cmd+B: Bold
- Ctrl+I / Cmd+I: Italic
- Ctrl+U / Cmd+U: Underline
- Ctrl+Shift+X / Cmd+Shift+X: Strikethrough
- Ctrl+\\ / Cmd+\\: Clear formatting
- Ctrl+Shift+7 / Cmd+Shift+7: Numbered list
- Ctrl+Shift+8 / Cmd+Shift+8: Bulleted list

HEADING STYLES:
- Ctrl+Alt+1 / Cmd+Option+1: Heading 1
- Ctrl+Alt+2 / Cmd+Option+2: Heading 2
- Ctrl+Alt+3 / Cmd+Option+3: Heading 3
- Ctrl+Alt+0 / Cmd+Option+0: Normal text
- Or use the styles dropdown in the toolbar (.docs-toolbar)

CREATING A NEW DOCUMENT:
1. Navigate to https://docs.google.com
2. Click "Blank" or the "+" button to create a new document
3. Wait for the document editor to load (toolbar and title input should appear)
4. Click the title field (.docs-title-input) to rename the document
5. Click the document body to begin typing

INSERTING ELEMENTS:
- Tables: Insert menu > Table, or Ctrl+Alt+T (opens table size picker)
- Links: Ctrl+K / Cmd+K to insert a hyperlink
- Images: Insert menu > Image, or drag-and-drop
- Horizontal line: Insert menu > Horizontal line
- Page break: Insert menu > Break > Page break, or Ctrl+Enter / Cmd+Enter
- Comments: Ctrl+Alt+M / Cmd+Option+M to add a comment on selected text

SHARE AND COLLABORATE:
- Share button is in the top-right corner of the document
- Click Share to open the sharing dialog
- Type email addresses to share with specific people
- Change permissions (Viewer, Commenter, Editor) via the dropdown
- "Copy link" button gets a shareable URL

READING/EXTRACTING CONTENT:
- Use getText on .kix-page-column to extract visible text content
- For specific paragraphs, use getText on .kix-paragraphrenderer elements
- The document title can be read from .docs-title-input
- Use scroll to load more content in long documents (Docs renders lazily)`,

  selectors: {
    googleSheets: {
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
    googleDocs: {
      // Document body
      pageContent: '.kix-page-column',
      page: '.kix-page',
      paragraph: '.kix-paragraphrenderer',
      lineView: '.kix-lineview',
      title: '.docs-title-input',
      documentBody: '.kix-appview-editor',

      // Toolbar
      toolbar: '#docs-toolbar',
      stylesDropdown: '#docs-toolbar .goog-toolbar-combo-button, .docs-font-size-button-toolbar',
      boldButton: '#boldButton, [aria-label="Bold (Ctrl+B)"]',
      italicButton: '#italicButton, [aria-label="Italic (Ctrl+I)"]',
      underlineButton: '#underlineButton, [aria-label="Underline (Ctrl+U)"]',
      fontSizeInput: '.docs-font-size-input, .jfk-textinput',
      fontSelector: '#docs-font-family, .docs-font-family',
      textColorButton: '#textColorButton',
      highlightColorButton: '#highlightColorButton',
      alignLeftButton: '#docs-align-left',
      alignCenterButton: '#docs-align-center',
      alignRightButton: '#docs-align-right',
      insertLinkButton: '#insertLinkButton',
      insertCommentButton: '#insertCommentButton',
      insertImageButton: '#insertImageButton',
      numberedListButton: '.docs-toolbar [aria-label*="Numbered list"]',
      bulletedListButton: '.docs-toolbar [aria-label*="Bulleted list"]',
      indentButton: '#indentButton',
      outdentButton: '#outdentButton',
      undoButton: '#undoButton, [aria-label*="Undo"]',
      redoButton: '#redoButton, [aria-label*="Redo"]',

      // Menus
      menuFile: '#docs-file-menu',
      menuEdit: '#docs-edit-menu',
      menuView: '#docs-view-menu',
      menuInsert: '#docs-insert-menu',
      menuFormat: '#docs-format-menu',
      menuTools: '#docs-tools-menu',
      menuExtensions: '#docs-extensions-menu',
      menuHelp: '#docs-help-menu',

      // Share and collaboration
      shareButton: '.docs-titlebar-share-client-plugin, [aria-label="Share. Private to only me."], [aria-label*="Share"]',
      shareDialog: '.docs-share-dialog',
      shareEmailInput: '.docs-share-dialog input[type="email"], [aria-label="Add people, groups, and calendar events"]',

      // Find and Replace
      findReplaceDialog: '.docs-findinput-container',
      findInput: '.docs-findinput-input input',
      replaceInput: '.docs-replaceinput-input input',
      findNextButton: '.docs-findinput-button-find-next',
      findPrevButton: '.docs-findinput-button-find-prev',
      replaceButton: '.docs-replaceinput-button-replace',
      replaceAllButton: '.docs-replaceinput-button-replace-all',

      // Outline and sidebar
      outlinePanel: '.docs-side-panel-container',
      outlineToggle: '[aria-label="Show document outline"]',

      // Comments
      commentBox: '.docs-docos-replyview-input',
      commentResolve: '[aria-label="Resolve"]',
      commentReply: '.docs-docos-replyview-input',

      // Blank template on docs.google.com homepage
      blankTemplate: '.docs-homescreen-templates-templateview-preview[aria-label*="Blank"]',
      newDoc: '.docs-homescreen-templates-templateview-preview'
    }
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
    createNewDoc: [
      'Navigate to https://docs.google.com',
      'Wait for the page to load fully',
      'Click on "Blank" template or "+" to create a new document',
      'Wait for the document editor to load (toolbar and title input should appear)',
      'Click the title field (.docs-title-input) to name the document',
      'Type the document title and press Enter or Tab',
      'Click the document body (.kix-page-column) to begin typing'
    ],
    navigateToExistingDoc: [
      'Navigate to the provided Google Docs URL',
      'Wait for the document to load completely (toolbar visible)',
      'Click the document body (.kix-page-column) to place cursor',
      'The document is ready for editing'
    ],
    writeDocumentContent: [
      'Click the document body (.kix-page-column) to focus',
      'Use Ctrl+End / Cmd+End to jump to end of existing content (if appending)',
      'Type the content -- Enter creates new paragraphs',
      'Use Ctrl+Alt+1-3 / Cmd+Option+1-3 for heading styles',
      'Use Ctrl+B / Cmd+B for bold, Ctrl+I / Cmd+I for italic as needed',
      'Use Ctrl+Shift+7/8 / Cmd+Shift+7/8 for numbered/bulleted lists',
      'Content auto-saves as you type'
    ],
    insertTable: [
      'Click Insert menu (#docs-insert-menu)',
      'Click "Table" option in the dropdown',
      'Select the table dimensions from the grid picker (e.g., 3x4)',
      'The table is inserted at the cursor position',
      'Tab between cells to enter data, Enter to move to next row'
    ],
    addComment: [
      'Select the text to comment on (click and drag or Shift+Arrow keys)',
      'Use Ctrl+Alt+M / Cmd+Option+M to open comment dialog',
      'Type the comment text in the comment box',
      'Click "Comment" button to post',
      'The comment appears in the right margin'
    ],
    shareDocument: [
      'Click the Share button in the top-right corner',
      'Wait for the share dialog to open',
      'Type email addresses in the "Add people" input field',
      'Select permission level (Viewer, Commenter, Editor) from dropdown',
      'Optionally add a message',
      'Click "Send" to share',
      'Or click "Copy link" to get a shareable URL'
    ],
    findAndReplace: [
      'Press Ctrl+H / Cmd+Shift+H to open Find and Replace',
      'Type the search term in the Find input',
      'Type the replacement text in the Replace input',
      'Click "Replace" for single replacement or "Replace all" for all occurrences',
      'Close the dialog when done'
    ],
    readDocumentContent: [
      'Click the document body to focus it',
      'Use getText on .kix-page-column to extract visible text',
      'Scroll down to load more content if the document is long',
      'Repeat getText + scroll until all content is extracted',
      'The document title can be read from .docs-title-input'
    ]
  },

  warnings: [
    'Google Sheets cells are rendered on a CANVAS -- you CANNOT click individual cells via DOM selectors. Always use the Name Box for cell navigation.',
    'The Name Box is the ONLY reliable way to navigate to specific cells. It is located at the top-left of the sheet, showing the current cell reference.',
    'Google Sheets auto-saves continuously -- there is no explicit save needed, but Ctrl+S can force a save.',
    'If the sheet is in VIEW-ONLY mode, data entry will not work. Check for an "Edit" or "Request access" button.',
    'After typing in a cell, you MUST press Tab or Enter to confirm the value. Without confirming, the value may be lost.',
    'Google Sheets may show a loading spinner when first opened -- wait for the Name Box to appear before attempting any actions.',
    'Copy-pasting large amounts of data may trigger a clipboard permission dialog.',
    'Google Sheets formulas start with "=" -- if entering data that starts with "=", the sheet will interpret it as a formula.',
    'Sheet tab names appear at the bottom of the screen. The default first tab is "Sheet1".',
    'If the spreadsheet has existing data, scroll or use Name Box to find empty rows before entering new data.',
    'Google Docs uses CANVAS-BASED TEXT RENDERING -- visible text is NOT in the DOM. Use getText on .kix-page-column to read content, not direct element text.',
    'Clicking on Google Docs canvas places the cursor approximately where you click -- precision is limited, so prefer keyboard navigation (Ctrl+Home, Ctrl+End, arrow keys).',
    'Google Docs auto-saves continuously -- no explicit save required.',
    'If the document is in VIEW-ONLY or SUGGESTING mode, typing will not insert text normally. Check for an "Editing" / "Suggesting" / "Viewing" mode toggle in the toolbar.',
    'Google Docs renders content lazily for long documents -- scroll down to trigger rendering of content below the fold before trying to read or extract it.',
    'The Find & Replace dialog (Ctrl+H) is the most reliable way to locate specific text in a document.',
    'The document title (.docs-title-input) is a standard input field and CAN be directly clicked and typed into, unlike the canvas body.',
    'Comments and suggestions appear in the right margin -- they may overlap with document content in narrow viewports.',
    'Share dialog requires the user to be signed into a Google account with edit permissions.'
  ],

  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute']
};

registerSiteGuide(PRODUCTIVITY_GUIDE);
