/**
 * Site Guide: Google Keep
 * Per-site guide for Google Keep note-taking application.
 */

registerSiteGuide({
  site: 'Google Keep',
  category: 'Productivity Tools',
  patterns: [
    /keep\.google\.com/i
  ],
  guidance: `GOOGLE KEEP-SPECIFIC INTELLIGENCE:

CREATE NOTE (keyboard-first):
  # Press C to create a new note (when not editing any note)
  key "c"                    # opens a new note card
  type "My note title"       # type the title
  key "Enter"                # move cursor to note body
  type "Note body content"   # type the body text
  key "Escape"               # close and auto-save the note
  # Alternative: click the "Take a note..." input area, then type title + Enter + body + Escape

CHECKLIST CREATION:
  # Method 1: Use the "New list" button next to "Take a note"
  click e{N}                 # click "New list" icon (checklist icon next to Take a note)
  type "Checklist title"     # type the checklist title
  key "Enter"                # move to first checklist item
  type "Item 1"              # type first item
  key "Enter"                # create next item line
  type "Item 2"              # type second item
  key "Escape"               # close and auto-save
  # Method 2: Create a regular note, then click the checklist button to convert it

NOTE NAVIGATION (keyboard):
  J: Move to the next note in the grid
  K: Move to the previous note in the grid
  # Notes are highlighted with a visible outline when selected via J/K
  # Press Enter on a selected note to open it for editing

SEARCH:
  / : Focus the search bar (when not editing a note)
  type "search query"        # type your search terms
  key "Enter"                # filter notes by query
  # Search filters notes in real-time as you type
  # Press Escape to clear search and return to all notes

ACTIONS ON SELECTED NOTE (use J/K to select first):
  E: Archive the selected note
  #: Delete the selected note (moves to Trash)
  L: Open label picker for the selected note
  # These shortcuts only work when a note is selected (highlighted) but NOT open for editing

NOTE EDITING:
  # Click a note or press Enter on a selected note to open it
  # Edit title or body text directly
  # All changes auto-save on every keystroke -- no save button exists
  key "Escape"               # close the note (changes already saved)

NOTE COLORS:
  # Open a note for editing, then click the palette/color icon at the bottom
  # Or right-click on a note in the grid to access color options
  # Colors are applied immediately and auto-saved

LABEL MANAGEMENT:
  # Press L on a selected note to open the label picker
  # Type to filter existing labels
  # Click a label to toggle it on/off for this note
  # Labels are GLOBAL -- creating a label makes it available on all notes

KEYBOARD SHORTCUTS SUMMARY:
  C: Create new note (when not in edit mode)
  J/K: Navigate between notes (next/previous)
  /: Focus search bar
  E: Archive selected note
  #: Delete selected note
  L: Add/change labels on selected note
  Enter: Open selected note for editing
  Escape: Close current note / exit edit mode / clear search
  Ctrl+Shift+9: Convert note to checklist (while editing)

CRITICAL WARNINGS:
  - J/K navigation ONLY works when no note is open for editing. Press Escape first.
  - The / shortcut focuses search -- pressing / while editing types a literal slash character.
  - C shortcut creates a new note -- pressing C while editing types a literal "c".
  - Keep auto-saves everything instantly. There is NO undo for deleted notes after 7 days.
  - Archive is NOT delete. Archived notes remain searchable. Deleted notes go to Trash.`,

  fsbElements: {
    'new-note-input': {
      label: 'Take a note input area',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Take a note"]' },
        { strategy: 'role', selector: '[role="textbox"][aria-label*="note" i]' },
        { strategy: 'class', selector: '.IZ65Hb-YPqjbf' },
        { strategy: 'context', selector: '.IZ65Hb-r4nke [contenteditable="true"]' },
        { strategy: 'id', selector: '#gkeep-input-bar' }
      ]
    },
    'new-note-title': {
      label: 'Note title field when editing',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Title"]' },
        { strategy: 'role', selector: '[role="textbox"][aria-label="Title"]' },
        { strategy: 'class', selector: '.IZ65Hb-YPqjbf.IZ65Hb-YPqjbf-purZT' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [contenteditable="true"]:first-child' },
        { strategy: 'id', selector: '#gkeep-note-title' }
      ]
    },
    'new-note-body': {
      label: 'Note body field when editing',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Note"]' },
        { strategy: 'role', selector: '[role="textbox"][aria-label="Note"]' },
        { strategy: 'class', selector: '.IZ65Hb-YPqjbf.IZ65Hb-YPqjbf-qnnXGd' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [contenteditable="true"]:nth-child(2)' },
        { strategy: 'id', selector: '#gkeep-note-body' }
      ]
    },
    'search-bar': {
      label: 'Search/filter notes input',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'role', selector: 'input[role="combobox"][aria-label*="Search" i]' },
        { strategy: 'class', selector: '.gb_cf' },
        { strategy: 'context', selector: 'header input[type="text"][aria-label*="Search" i]' },
        { strategy: 'id', selector: '#yDmH0d input[aria-label="Search"]' }
      ]
    },
    'pin-button': {
      label: 'Pin note button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Pin note"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Pin" i]' },
        { strategy: 'class', selector: '.hKLBOc' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label*="Pin" i]' },
        { strategy: 'id', selector: '#gkeep-pin-btn' }
      ]
    },
    'archive-button': {
      label: 'Archive note button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Archive"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Archive"]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label="Archive"]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label="Archive"]' },
        { strategy: 'id', selector: '#gkeep-archive-btn' }
      ]
    },
    'delete-button': {
      label: 'Delete note button (in more menu)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Delete note"]' },
        { strategy: 'role', selector: '[role="menuitem"][aria-label*="Delete" i]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label*="Delete"]' },
        { strategy: 'context', selector: '[role="menu"] [aria-label*="Delete" i]' },
        { strategy: 'id', selector: '#gkeep-delete-btn' }
      ]
    },
    'label-button': {
      label: 'Add/change labels button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add label"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="label" i]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label*="label" i]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label*="label" i]' },
        { strategy: 'id', selector: '#gkeep-label-btn' }
      ]
    },
    'color-button': {
      label: 'Change note color button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Background options"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="ackground" i]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label*="ackground"]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label*="ackground" i]' },
        { strategy: 'id', selector: '#gkeep-color-btn' }
      ]
    },
    'checklist-button': {
      label: 'Show checkboxes / convert to checklist',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Show checkboxes"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="checkbox" i]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label*="checkbox"]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label*="checkbox" i]' },
        { strategy: 'id', selector: '#gkeep-checklist-btn' }
      ]
    },
    'reminder-button': {
      label: 'Add reminder button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Remind me"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Remind" i]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label*="Remind"]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label*="Remind" i]' },
        { strategy: 'id', selector: '#gkeep-reminder-btn' }
      ]
    },
    'collaborator-button': {
      label: 'Add collaborator button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Collaborator"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Collaborator" i]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label*="ollaborator"]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label*="ollaborator" i]' },
        { strategy: 'id', selector: '#gkeep-collab-btn' }
      ]
    },
    'more-menu': {
      label: 'Three-dot more options menu',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="More"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="More"]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label="More"]' },
        { strategy: 'context', selector: '.IZ65Hb-n0tTWc [aria-label="More"]' },
        { strategy: 'id', selector: '#gkeep-more-menu' }
      ]
    },
    'note-list': {
      label: 'Main note list/grid container',
      selectors: [
        { strategy: 'role', selector: '[role="main"]' },
        { strategy: 'aria', selector: '[aria-label="Notes"]' },
        { strategy: 'class', selector: '.gkA7Yd-sKfxWe' },
        { strategy: 'context', selector: 'main .IZ65Hb-TBnTCe' },
        { strategy: 'id', selector: '#gkeep-note-list' }
      ]
    },
    'sidebar-labels': {
      label: 'Labels section in sidebar',
      selectors: [
        { strategy: 'aria', selector: 'nav [aria-label="Labels"]' },
        { strategy: 'role', selector: '[role="navigation"] [aria-label*="label" i]' },
        { strategy: 'class', selector: '.HlqNPb' },
        { strategy: 'context', selector: 'nav .aApbdd' },
        { strategy: 'id', selector: '#gkeep-sidebar-labels' }
      ]
    },
    'settings-gear': {
      label: 'Settings gear icon',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Settings"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Settings"]' },
        { strategy: 'class', selector: '.Q0hgme-LgbsSe[aria-label="Settings"]' },
        { strategy: 'context', selector: 'header [aria-label="Settings"]' },
        { strategy: 'id', selector: '#gkeep-settings' }
      ]
    }
  },
  selectors: {
    newNoteInput: '[aria-label="Take a note"]',
    noteTitle: '[aria-label="Title"]',
    noteBody: '[aria-label="Note"]',
    searchBar: '[aria-label="Search"]',
    pinButton: '[aria-label="Pin note"]',
    archiveButton: '[aria-label="Archive"]',
    deleteButton: '[aria-label="Delete note"]',
    labelButton: '[aria-label="Add label"]',
    colorButton: '[aria-label="Background options"]',
    checklistButton: '[aria-label="Show checkboxes"]',
    reminderButton: '[aria-label="Remind me"]',
    collaboratorButton: '[aria-label="Collaborator"]',
    moreMenu: '[aria-label="More"]',
    noteList: '[role="main"]',
    sidebarLabels: 'nav [aria-label="Labels"]',
    settingsGear: '[aria-label="Settings"]'
  },
  workflows: {
    createNote: [
      'Navigate to https://keep.google.com',
      'Wait for the page to load fully (note grid should be visible)',
      'Press C to create a new note (cursor must NOT be in any input field)',
      'A new note card opens with the title field focused',
      'Type the note title text',
      'Press Enter to move the cursor to the note body field',
      'Type the note body content',
      'Press Escape to close the note and auto-save it',
      'VERIFY: The new note should appear at the top of the note grid with the title and body text visible',
      'STUCK: If pressing C does not open a new note, click the "Take a note..." input area directly. If the input area is not visible, scroll to the top of the page and look for the fixed input bar.'
    ],
    createChecklist: [
      'Navigate to https://keep.google.com',
      'Click the "New list" icon (checklist icon next to "Take a note..." bar)',
      'A new checklist card opens with the title field focused',
      'Type the checklist title and press Enter',
      'Type the first checklist item text',
      'Press Enter to create a new checklist item line',
      'Type the next item, repeat Enter for more items',
      'Press Escape to close and auto-save the checklist',
      'Alternative: create a regular note, then click the checklist button (Show checkboxes) to convert it',
      'VERIFY: The note should display with checkbox icons next to each item in the grid view',
      'STUCK: If the "New list" icon is not visible, create a regular note first (press C), then click the checklist/checkbox icon at the bottom of the note editor to convert it. Or use Ctrl+Shift+9 while editing a note.'
    ],
    pinNote: [
      'Navigate to the note list on keep.google.com',
      'Use J/K keys to navigate to the target note (J moves to next, K moves to previous)',
      'The selected note will have a visible highlight/outline',
      'Press Enter to open the note for editing',
      'Click the pin icon at the top-right of the note editor',
      'Press Escape to close the note',
      'VERIFY: The note should now appear in the "Pinned" section at the top of the note grid, separated from unpinned notes',
      'STUCK: If the pin icon is not visible, look for a thumbtack/pin icon in the top-right corner of the open note. If J/K navigation does not work, ensure you are not in a note edit mode -- press Escape first.'
    ],
    archiveNote: [
      'Navigate to the note list on keep.google.com',
      'Use J/K keys to select the target note',
      'Press E to archive the selected note (shortcut works on selected note)',
      'The note will disappear from the main view and move to the Archive',
      'Alternative: open the note (Enter) and click the Archive icon at the bottom toolbar',
      'VERIFY: The note should no longer appear in the main note grid. Navigate to Archive (sidebar) to confirm it is there.',
      'STUCK: If E shortcut does not work, ensure a note is selected (has visible outline from J/K navigation). If still not working, open the note and click the archive icon directly. Archive is accessible from the left sidebar navigation.'
    ],
    deleteNote: [
      'Navigate to the note list on keep.google.com',
      'Use J/K keys to select the target note',
      'Press # to delete the selected note (moves to Trash)',
      'Alternative: open the note > click More (three-dot menu) > click "Delete note"',
      'The note moves to Trash where it stays for 7 days before permanent deletion',
      'VERIFY: The note should disappear from the main grid. Check Trash in the sidebar to confirm.',
      'STUCK: If # shortcut does not work, open the note by pressing Enter, then click the three-dot More menu at the bottom, then click "Delete note". If the More menu is hard to find, look for three vertical dots at the bottom-right of the note editor.'
    ],
    addLabel: [
      'Navigate to the note list on keep.google.com',
      'Use J/K keys to select the target note',
      'Press L to open the label picker for the selected note',
      'A dropdown appears showing all existing labels with checkboxes',
      'Type to filter labels by name (the filter input is auto-focused)',
      'Click a label checkbox to toggle it on/off for this note',
      'To create a new label, type the name and click "Create [name]" at the bottom of the list',
      'Click outside the label picker or press Escape to close it',
      'VERIFY: The label name should appear as a chip/tag at the bottom of the note in the grid view',
      'STUCK: If L shortcut does not work, open the note (Enter), then click the three-dot More menu > "Add label". Or click the label icon directly at the bottom toolbar of the open note.'
    ],
    searchNotes: [
      'Navigate to keep.google.com',
      'Press / to focus the search bar at the top of the page',
      'Type your search query (searches note titles, body text, and labels)',
      'Notes filter in real-time as you type',
      'Press Enter to confirm the search',
      'The grid shows only notes matching the query',
      'Press Escape or click the X in the search bar to clear the search and return to all notes',
      'VERIFY: Only notes containing the search term should be visible in the grid. The search bar should show the query text.',
      'STUCK: If / does not focus the search bar, click the search icon/bar directly at the top of the page. If search returns no results, try broader terms or check the spelling. Archived notes are also searchable.'
    ],
    editNote: [
      'Navigate to keep.google.com',
      'Use J/K to select the target note, then press Enter to open it',
      'Alternative: click directly on the note card in the grid',
      'The note opens in an overlay/modal with title and body editable',
      'Click in the title field to edit the title, or click in the body to edit the body',
      'Make your changes -- every keystroke auto-saves immediately',
      'Press Escape to close the note editor and return to the grid view',
      'VERIFY: The updated text should be visible on the note card in the grid immediately after closing',
      'STUCK: If the note does not open on click, try double-clicking. If edits do not appear to save, refresh the page -- Keep auto-saves, so the data should persist. If the note opens in read-only mode, check if it is a shared note with restricted permissions.'
    ]
  },
  warnings: [
    'Keep auto-saves on every keystroke -- there is NO save button. All changes persist immediately. There is no "unsaved changes" state.',
    'J/K navigation only works when no note is open for editing. Press Escape to close any open note before using J/K to navigate.',
    'The "Take a note" bar requires a click to open -- there is no keyboard shortcut to open it from empty state. Use the C shortcut instead to create a new note.',
    'Checklist items use Enter to create new items, NOT Tab. Tab will move focus out of the checklist.',
    'Labels are global -- creating a label on one note makes it available to all notes. Deleting a label removes it from all notes.',
    'The color picker is a popover -- wait for it to fully render before clicking a color swatch. Clicking too early may miss the target.',
    'Archive is NOT delete. Archived notes are still fully searchable and can be restored. Use delete (# or More > Delete) to move to Trash.',
    'Deleted notes go to Trash for 7 days before permanent deletion. Trash can be manually emptied.',
    'Pinned notes always appear at the top of the note list in a separate "Pinned" section regardless of creation date or sort order.',
    'Search (/) focuses the search bar. Pressing / while editing a note types a literal slash character. Always press Escape to exit editing before using / for search.',
    'Keep uses a responsive grid layout -- note card positions may shift when the window is resized. Do not rely on absolute positions.',
    'When typing in the note body, Enter creates a new line. To create a new checklist item (in checklist mode), Enter creates a new item line.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
