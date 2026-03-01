/**
 * Site Guide: Google Docs
 * Per-site guide for Google Docs document editor.
 */

registerSiteGuide({
  site: 'Google Docs',
  category: 'Productivity Tools',
  patterns: [
    /docs\.google\.com\/document/i
  ],
  guidance: `GOOGLE DOCS-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # edit document
  click e5    # document body area
  type e5 "text content"
  key "b" --ctrl   # bold selected text
  key "s" --ctrl   # save
  # navigate and find
  key "f" --ctrl   # open Find dialog
  type e10 "search term"
  enter

CANVAS-BASED RENDERER:
- Google Docs uses a CANVAS-BASED RENDERER for text display.
- The visible text on screen is drawn on a canvas -- it is NOT standard DOM text.
- The actual editable surface is a hidden contenteditable div that receives keystrokes.
- To position the cursor, click approximately where you want on the canvas area (.kix-page-column), then type.
- The document title (.docs-title-input) IS a normal input field and can be clicked/typed into directly.

DOCUMENT NAVIGATION:
- Click on the document canvas (.kix-page-column) to place cursor and begin editing
- Use Ctrl+Home / Cmd+Home to jump to the beginning of the document
- Use Ctrl+End / Cmd+End to jump to the end of the document
- Use Ctrl+F / Cmd+F to open Find dialog
- Use the Outline sidebar (View > Show outline) to jump between headings
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
- Ctrl+Shift+7 / Cmd+Shift+7: Numbered list
- Ctrl+Shift+8 / Cmd+Shift+8: Bulleted list

HEADING STYLES:
- Ctrl+Alt+1 / Cmd+Option+1: Heading 1
- Ctrl+Alt+2 / Cmd+Option+2: Heading 2
- Ctrl+Alt+3 / Cmd+Option+3: Heading 3
- Ctrl+Alt+0 / Cmd+Option+0: Normal text

INSERTING ELEMENTS:
- Links: Ctrl+K / Cmd+K to insert a hyperlink
- Comments: Ctrl+Alt+M / Cmd+Option+M to add a comment on selected text
- Page break: Ctrl+Enter / Cmd+Enter

SHARE AND COLLABORATE:
- Share button is in the top-right corner of the document
- Click Share to open the sharing dialog
- Type email addresses to share with specific people
- Change permissions (Viewer, Commenter, Editor) via the dropdown`,
  selectors: {
    pageContent: '.kix-page-column',
    page: '.kix-page',
    paragraph: '.kix-paragraphrenderer',
    lineView: '.kix-lineview',
    title: '.docs-title-input',
    documentBody: '.kix-appview-editor',
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
    menuFile: '#docs-file-menu',
    menuEdit: '#docs-edit-menu',
    menuView: '#docs-view-menu',
    menuInsert: '#docs-insert-menu',
    menuFormat: '#docs-format-menu',
    menuTools: '#docs-tools-menu',
    menuExtensions: '#docs-extensions-menu',
    menuHelp: '#docs-help-menu',
    shareButton: '.docs-titlebar-share-client-plugin, [aria-label="Share. Private to only me."], [aria-label*="Share"]',
    shareDialog: '.docs-share-dialog',
    shareEmailInput: '.docs-share-dialog input[type="email"], [aria-label="Add people, groups, and calendar events"]',
    findReplaceDialog: '.docs-findinput-container',
    findInput: '.docs-findinput-input input',
    replaceInput: '.docs-replaceinput-input input',
    findNextButton: '.docs-findinput-button-find-next',
    findPrevButton: '.docs-findinput-button-find-prev',
    replaceButton: '.docs-replaceinput-button-replace',
    replaceAllButton: '.docs-replaceinput-button-replace-all',
    outlinePanel: '.docs-side-panel-container',
    outlineToggle: '[aria-label="Show document outline"]',
    commentBox: '.docs-docos-replyview-input',
    commentResolve: '[aria-label="Resolve"]',
    commentReply: '.docs-docos-replyview-input',
    blankTemplate: '.docs-homescreen-templates-templateview-preview[aria-label*="Blank"]',
    newDoc: '.docs-homescreen-templates-templateview-preview'
  },
  workflows: {
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
    'Google Docs uses CANVAS-BASED TEXT RENDERING -- visible text is NOT in the DOM. Use getText on .kix-page-column to read content.',
    'Clicking on Google Docs canvas places the cursor approximately where you click -- precision is limited, so prefer keyboard navigation.',
    'Google Docs auto-saves continuously -- no explicit save required.',
    'If the document is in VIEW-ONLY or SUGGESTING mode, typing will not insert text normally. Check the mode toggle in the toolbar.',
    'Google Docs renders content lazily for long documents -- scroll down to trigger rendering of content below the fold.',
    'The Find & Replace dialog (Ctrl+H) is the most reliable way to locate specific text in a document.',
    'The document title (.docs-title-input) is a standard input field and CAN be directly clicked and typed into, unlike the canvas body.',
    'Comments and suggestions appear in the right margin -- they may overlap with document content in narrow viewports.',
    'Share dialog requires the user to be signed into a Google account with edit permissions.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute']
});
