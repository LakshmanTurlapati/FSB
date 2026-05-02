/**
 * Site Guide: Airtable
 * Per-site guide for Airtable database/spreadsheet application.
 * Selector strategy: aria/role-first (Airtable uses React with hashed CSS -- class names change on every deploy)
 */

registerSiteGuide({
  site: 'Airtable',
  category: 'Productivity Tools',
  patterns: [
    /airtable\.com\/app/i,
    /airtable\.com\/tbl/i,
    /airtable\.com\/shr/i
  ],
  guidance: `AIRTABLE-SPECIFIC INTELLIGENCE:

GRID NAVIGATION (PRIMARY INTERACTION MODE):
  Arrow keys:      Navigate between cells in the grid
  Enter:           Start editing the selected cell (opens edit mode)
  Escape:          Stop editing, return to navigation mode (saves value)
  Tab:             Move to next field (right)
  Shift+Tab:       Move to previous field (left)
  Shift+Enter:     Add a new record (row) below the current one
  Space:           Expand selected record to detail view (full record modal)
  Ctrl+Shift+K:    Toggle the field list sidebar
  Ctrl+F:          Open search/find
  Ctrl+Z:          Undo
  Ctrl+Shift+Z:    Redo

PER-FIELD-TYPE INTERACTION (THE critical reference):

  TEXT / SINGLE LINE TEXT:
    - Select cell > Enter to start editing > type content > Escape to save
    - Single line text is the simplest field type -- just type and save.

  LONG TEXT / RICH TEXT:
    - Select cell > Enter to open an expanded multi-line editor overlay
    - Type content with multiple lines (Enter for new line INSIDE the editor)
    - Supports markdown-like formatting in rich text fields
    - Escape to close the expanded editor and save

  SINGLE SELECT:
    - Select cell > Enter to open dropdown > type to filter options > Enter to select
    - Options are searchable -- type first few letters to narrow down
    - Only one option can be selected (replaces current)
    - To clear: open dropdown > click the selected option to deselect, or press Backspace

  MULTI SELECT:
    - Select cell > Enter to open dropdown > type to filter > Enter to add
    - Repeat typing + Enter to add multiple selections
    - Click an already-selected tag/pill to remove it
    - Each Enter ADDS to the selection (does not replace)
    - Escape to close the dropdown when done

  DATE:
    - Select cell > Enter to open date picker calendar
    - Type date directly in MM/DD/YYYY format (overrides calendar click)
    - Or click a date on the calendar to select it
    - Tab to time field if time is enabled for this date field
    - Type time in HH:MM AM/PM format if applicable
    - Escape to close and save

  CHECKBOX:
    - Select cell > Space to toggle the checkbox (checked/unchecked)
    - Do NOT press Enter -- Space is the toggle action for checkboxes
    - No dropdown or editor opens -- it is a single toggle action

  NUMBER / CURRENCY / PERCENT:
    - Select cell > Enter to start editing > type the numeric value
    - For currency: type just the number (currency symbol is automatic)
    - For percent: type just the number (% symbol is automatic)
    - Escape to save, or Tab to move to next field and save

  LINKED RECORD:
    - Select cell > Enter to open the linked record picker dialog
    - Type to search for existing records in the linked table
    - Enter to select and link a record
    - Can link multiple records (each Enter adds one more link)
    - Click the "x" on a linked record pill to unlink it
    - Escape to close the picker when done

  ATTACHMENT:
    - Select cell > Enter to open the attachment dialog
    - Upload files or paste a URL
    - CANNOT be fully automated via keyboard -- requires file picker interaction
    - For URL-based attachments, the URL input field can be typed into

  EMAIL / URL / PHONE:
    - Select cell > Enter to start editing > type the value
    - Airtable validates format (e.g., email must have @, URL must have protocol)
    - Escape to save

  FORMULA / ROLLUP / LOOKUP / COUNT / AUTO-NUMBER:
    - These are READ-ONLY computed fields. They CANNOT be edited directly.
    - Clicking Enter on these fields does nothing or shows a read-only value.
    - Guide the user: "This field is computed and cannot be edited. Modify the source fields instead."

  CREATED TIME / LAST MODIFIED TIME / CREATED BY / LAST MODIFIED BY:
    - These are automatic system fields. They are READ-ONLY.
    - They update automatically based on record creation/modification events.

VIEW SWITCHING:
  - Click view tabs at the top of the table (Grid, Kanban, Calendar, Gallery, Form)
  - Each view shows the same data in a different layout
  - Grid is the default and most keyboard-friendly view
  - Kanban groups records by a single select field into columns
  - Calendar shows records on a date grid based on a date field
  - Gallery shows records as large cards with a cover image
  - Form view creates a fillable form for record creation

TOOLBAR OPERATIONS:
  - Filter: Click Filter button > add conditions (field, operator, value) > Apply
  - Sort: Click Sort button > select field > choose direction (A-Z, Z-A) > Apply
  - Group: Click Group button > select grouping field > records cluster by value
  - Hide Fields: Click Hide Fields > toggle visibility of specific fields
  - Search: Ctrl+F or click Search icon > type query > matching records highlight/filter

IMPORTANT: Always check field type before attempting to edit. Read-only fields
(formula, rollup, lookup, count, auto-number, system fields) cannot be modified.
Use the field header or expanded record view to identify field types.`,
  fsbElements: {
    'grid-container': {
      label: 'Main grid/table container',
      selectors: [
        { strategy: 'role', selector: '[role="grid"]' },
        { strategy: 'aria', selector: '[aria-label="Grid view"]' },
        { strategy: 'context', selector: '.ReactVirtualized__Grid [role="grid"]' },
        { strategy: 'id', selector: '[data-testid="grid-view"]' },
        { strategy: 'class', selector: '.gridView [role="grid"]' }
      ]
    },
    'cell-active': {
      label: 'Currently active/selected cell',
      selectors: [
        { strategy: 'role', selector: '[role="gridcell"][aria-selected="true"]' },
        { strategy: 'aria', selector: '[role="gridcell"][tabindex="0"]' },
        { strategy: 'context', selector: '[role="grid"] [role="gridcell"][aria-selected]' },
        { strategy: 'id', selector: '[data-testid="cell-active"]' },
        { strategy: 'class', selector: '.cell.active, [role="gridcell"].focused' }
      ]
    },
    'row-add-button': {
      label: 'Add row / new record button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add a record"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="record" i]' },
        { strategy: 'context', selector: '[role="grid"] [role="button"][aria-label*="Add"]' },
        { strategy: 'id', selector: '[data-testid="add-row-button"]' },
        { strategy: 'class', selector: '.addRowButton, button[aria-label*="record"]' }
      ]
    },
    'field-add-button': {
      label: 'Add field button at end of header row',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add a field"]' },
        { strategy: 'role', selector: '[role="columnheader"] [role="button"][aria-label*="field" i]' },
        { strategy: 'context', selector: '[role="grid"] [role="columnheader"]:last-child [role="button"]' },
        { strategy: 'id', selector: '[data-testid="add-field-button"]' },
        { strategy: 'class', selector: '.addColumnButton, [role="columnheader"] button:last-child' }
      ]
    },
    'view-switcher': {
      label: 'View tabs (Grid, Kanban, Calendar, Gallery, Form)',
      selectors: [
        { strategy: 'role', selector: '[role="tablist"]' },
        { strategy: 'aria', selector: '[aria-label="Views"]' },
        { strategy: 'context', selector: '.viewBar [role="tablist"]' },
        { strategy: 'id', selector: '[data-testid="view-switcher"]' },
        { strategy: 'class', selector: '.viewSwitcher [role="tablist"]' }
      ]
    },
    'toolbar-filter': {
      label: 'Filter button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Filter"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Filter"]' },
        { strategy: 'context', selector: '.toolbar [role="button"][aria-label*="Filter"]' },
        { strategy: 'id', selector: '[data-testid="toolbar-filter"]' },
        { strategy: 'class', selector: '.filterButton, button[aria-label="Filter"]' }
      ]
    },
    'toolbar-sort': {
      label: 'Sort button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Sort"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Sort"]' },
        { strategy: 'context', selector: '.toolbar [role="button"][aria-label*="Sort"]' },
        { strategy: 'id', selector: '[data-testid="toolbar-sort"]' },
        { strategy: 'class', selector: '.sortButton, button[aria-label="Sort"]' }
      ]
    },
    'toolbar-group': {
      label: 'Group button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Group"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Group"]' },
        { strategy: 'context', selector: '.toolbar [role="button"][aria-label*="Group"]' },
        { strategy: 'id', selector: '[data-testid="toolbar-group"]' },
        { strategy: 'class', selector: '.groupButton, button[aria-label="Group"]' }
      ]
    },
    'toolbar-hide-fields': {
      label: 'Hide fields button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Hide fields"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Hide" i]' },
        { strategy: 'context', selector: '.toolbar [role="button"][aria-label*="fields"]' },
        { strategy: 'id', selector: '[data-testid="toolbar-hide-fields"]' },
        { strategy: 'class', selector: '.hideFieldsButton, button[aria-label*="Hide"]' }
      ]
    },
    'toolbar-search': {
      label: 'Search button/input',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'role', selector: '[role="search"], [role="searchbox"]' },
        { strategy: 'context', selector: '.toolbar [role="button"][aria-label*="Search"]' },
        { strategy: 'id', selector: '[data-testid="toolbar-search"]' },
        { strategy: 'class', selector: '.searchButton, input[aria-label="Search"]' }
      ]
    },
    'sidebar-tables': {
      label: 'Tables list in sidebar',
      selectors: [
        { strategy: 'role', selector: '[role="tablist"][aria-label*="Table" i]' },
        { strategy: 'aria', selector: '[aria-label="Tables"]' },
        { strategy: 'context', selector: '.tableTabs [role="tablist"]' },
        { strategy: 'id', selector: '[data-testid="table-tabs"]' },
        { strategy: 'class', selector: '.tableTabBar [role="tablist"]' }
      ]
    },
    'record-expand-button': {
      label: 'Expand record button (opens detail view)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Expand record"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Expand" i]' },
        { strategy: 'context', selector: '[role="row"] [role="button"][aria-label*="xpand"]' },
        { strategy: 'id', selector: '[data-testid="expand-record"]' },
        { strategy: 'class', selector: '.expandRecordButton' }
      ]
    },
    'cell-text': {
      label: 'Text cell (when in edit mode)',
      selectors: [
        { strategy: 'role', selector: '[role="gridcell"] input[type="text"]' },
        { strategy: 'aria', selector: '[role="gridcell"] [contenteditable="true"]' },
        { strategy: 'context', selector: '[role="grid"] [role="gridcell"] input' },
        { strategy: 'id', selector: '[data-testid="cell-editor-text"]' },
        { strategy: 'class', selector: '.cellEditor input, .cellInput' }
      ]
    },
    'cell-select': {
      label: 'Single/multi select dropdown',
      selectors: [
        { strategy: 'role', selector: '[role="listbox"]' },
        { strategy: 'aria', selector: '[aria-label="Select an option"]' },
        { strategy: 'context', selector: '.selectCellEditor [role="listbox"]' },
        { strategy: 'id', selector: '[data-testid="select-dropdown"]' },
        { strategy: 'class', selector: '.selectEditor [role="listbox"]' }
      ]
    },
    'cell-date': {
      label: 'Date picker cell',
      selectors: [
        { strategy: 'role', selector: '[role="dialog"][aria-label*="date" i]' },
        { strategy: 'aria', selector: '[aria-label="Date picker"]' },
        { strategy: 'context', selector: '.datePicker [role="grid"]' },
        { strategy: 'id', selector: '[data-testid="date-picker"]' },
        { strategy: 'class', selector: '.datePickerContainer' }
      ]
    },
    'cell-checkbox': {
      label: 'Checkbox cell',
      selectors: [
        { strategy: 'role', selector: '[role="gridcell"] [role="checkbox"]' },
        { strategy: 'aria', selector: '[role="gridcell"] input[type="checkbox"]' },
        { strategy: 'context', selector: '[role="grid"] [role="gridcell"] [role="checkbox"]' },
        { strategy: 'id', selector: '[data-testid="cell-checkbox"]' },
        { strategy: 'class', selector: '.checkboxCell [role="checkbox"]' }
      ]
    },
    'cell-linked-record': {
      label: 'Linked record cell picker',
      selectors: [
        { strategy: 'role', selector: '[role="dialog"][aria-label*="record" i]' },
        { strategy: 'aria', selector: '[aria-label="Linked records"]' },
        { strategy: 'context', selector: '.linkedRecordPicker [role="listbox"]' },
        { strategy: 'id', selector: '[data-testid="linked-record-picker"]' },
        { strategy: 'class', selector: '.linkedRecordPickerDialog' }
      ]
    },
    'cell-attachment': {
      label: 'Attachment cell dialog',
      selectors: [
        { strategy: 'role', selector: '[role="dialog"][aria-label*="attachment" i]' },
        { strategy: 'aria', selector: '[aria-label="Attachments"]' },
        { strategy: 'context', selector: '.attachmentDialog [role="dialog"]' },
        { strategy: 'id', selector: '[data-testid="attachment-dialog"]' },
        { strategy: 'class', selector: '.attachmentPickerDialog' }
      ]
    },
    'record-detail-modal': {
      label: 'Expanded record detail modal',
      selectors: [
        { strategy: 'role', selector: '[role="dialog"][aria-label*="record" i]' },
        { strategy: 'aria', selector: '[aria-label="Record detail"]' },
        { strategy: 'context', selector: '.expandedRecordModal [role="dialog"]' },
        { strategy: 'id', selector: '[data-testid="record-detail-modal"]' },
        { strategy: 'class', selector: '.expandedRecordModal' }
      ]
    }
  },
  selectors: {
    gridContainer: '[role="grid"]',
    activeCell: '[role="gridcell"][aria-selected="true"], [role="gridcell"][tabindex="0"]',
    addRowButton: '[aria-label="Add a record"]',
    addFieldButton: '[aria-label="Add a field"]',
    viewSwitcher: '[role="tablist"]',
    filterButton: '[aria-label="Filter"]',
    sortButton: '[aria-label="Sort"]',
    groupButton: '[aria-label="Group"]',
    hideFieldsButton: '[aria-label="Hide fields"]',
    searchButton: '[aria-label="Search"]',
    tableTabs: '[role="tablist"][aria-label*="Table" i]',
    expandRecord: '[aria-label="Expand record"]',
    recordDetailModal: '.expandedRecordModal, [role="dialog"][aria-label*="record"]'
  },
  workflows: {
    navigateGrid: [
      'Click any cell in the grid to select it (or use Tab to reach the grid from the toolbar)',
      'Use Arrow keys to move between cells (Up, Down, Left, Right)',
      'Press Enter to start editing the selected cell',
      'Press Escape to stop editing and return to navigation mode (value is saved)',
      'Press Tab to move to the next field (right), Shift+Tab for previous (left)',
      'Continue navigating with arrow keys to reach the target cell',
      'VERIFY: Selected cell shows a blue border/highlight. Arrow keys move the selection indicator.',
      'STUCK: If arrow keys do not move between cells, you may be in edit mode -- press Escape first. If the grid is not focused, click any cell to establish focus.'
    ],
    editCellByType: [
      'Navigate to the target cell using Arrow keys or click',
      'Identify the field type from the column header (icon indicates type: A for text, # for number, checkbox icon, etc.)',
      'Press Enter to start editing (or Space for checkboxes)',
      'For TEXT: type the value directly > Escape to save',
      'For SINGLE SELECT: type to filter options > Enter to select one',
      'For MULTI SELECT: type to filter > Enter to add > repeat > Escape when done',
      'For DATE: type MM/DD/YYYY or click calendar date > Escape',
      'For CHECKBOX: press Space to toggle (do NOT press Enter)',
      'For NUMBER: type digits > Escape to save',
      'For LINKED RECORD: type to search > Enter to select > Escape when done',
      'For FORMULA/ROLLUP/LOOKUP: this is READ-ONLY -- skip this cell',
      'VERIFY: Cell shows updated value after Escape/Tab. For selects, pill/tag appears.',
      'STUCK: If edit mode does not activate, the field may be read-only (formula, lookup, etc.). Check field type. If dropdown does not appear for select fields, click the cell directly rather than using Enter.'
    ],
    createRecord: [
      'Press Shift+Enter to add a new record below the current selection',
      'Alternative: click the "+" button at the bottom of the grid',
      'The new row appears and first editable cell is selected',
      'Type the value for the first field',
      'Press Tab to move to the next field',
      'Fill each field according to its type (see editCellByType workflow)',
      'Continue pressing Tab until all fields are filled',
      'VERIFY: New row appears at the bottom of the grid with all entered values visible.',
      'STUCK: If Shift+Enter does not create a row, click the "+" or "Add a record" button below the last row. If the button is not visible, scroll down to find it.'
    ],
    switchViews: [
      'Click the view tabs at the top of the table (Grid, Kanban, Calendar, Gallery, Form)',
      'Wait for the view to render -- layout changes based on view type',
      'Grid: spreadsheet-like rows and columns (most keyboard-friendly)',
      'Kanban: cards grouped into columns by a single select field',
      'Calendar: records placed on dates based on a date field',
      'Gallery: large cards showing cover image and field previews',
      'VERIFY: Layout changes visually to match the selected view type. Data remains the same.',
      'STUCK: If view tabs are not visible, they may be scrolled horizontally -- look for a right arrow to reveal more tabs. Or click the "Views" button in the sidebar.'
    ],
    sortFilter: [
      'Click the Sort button in the toolbar',
      'In the Sort dialog: click "Pick a field" > select the field to sort by',
      'Choose direction: A-Z (ascending) or Z-A (descending)',
      'Click outside the dialog or press Escape to apply',
      'For Filter: click the Filter button in the toolbar',
      'Click "Add a filter" > select field > select operator (is, is not, contains, etc.) > enter value',
      'Add multiple filter conditions as needed',
      'Click outside or Escape to apply',
      'VERIFY: Records reorder (for sort) or hide (for filter). Active sort/filter shows indicator on the toolbar button.',
      'STUCK: If sort/filter does not apply, check that the field type supports the chosen operator. For filters on linked records, the operator compares against the linked record primary field.'
    ],
    expandRecord: [
      'Select the record row by clicking any cell in that row',
      'Press Space to expand the record into a detail modal (or click the expand icon at row start)',
      'The modal shows ALL fields for this record, including hidden fields',
      'Edit fields directly in the modal -- each field shows its type and value',
      'Click on a field value to edit it (same interaction patterns as grid cells)',
      'Press Escape to close the detail modal and return to the grid',
      'VERIFY: Modal opens showing all fields with current values. Changes made in modal reflect in the grid after closing.',
      'STUCK: If Space does not expand, the grid may not have focus -- click a cell first. If the expand icon is not visible, hover over the row number area on the left side.'
    ],
    searchRecords: [
      'Press Ctrl+F (or click the Search icon in the toolbar)',
      'A search bar appears at the top of the grid',
      'Type your search query -- matching records highlight and non-matching records may hide',
      'Use Enter or arrow buttons to navigate between matches',
      'Search matches across all visible fields in the current view',
      'Clear the search text or click "X" to reset',
      'VERIFY: Matching cells/records are highlighted in the grid. Match count appears in the search bar.',
      'STUCK: If Ctrl+F opens browser search instead of Airtable search, click the Search icon in the Airtable toolbar directly. If no results found, check for typos or try searching with fewer characters.'
    ],
    addField: [
      'Click the "+" button at the end of the column headers (rightmost position)',
      'A field configuration dialog appears',
      'Type the field name in the name input',
      'Click the field type selector to choose type (Single line text, Number, Single select, Date, etc.)',
      'Configure type-specific options (e.g., select options for single/multi select, date format for date)',
      'Click "Create field" or press Enter to add the field',
      'The new column appears at the end of the grid',
      'VERIFY: New column header shows the field name and type icon. Cells in the new column are empty and editable.',
      'STUCK: If the "+" button is not visible, scroll right in the grid to find it. It is always the last column header element. If field type options are not showing, click the type selector dropdown.'
    ]
  },
  warnings: [
    'Airtable uses React with hashed CSS -- class selectors BREAK on every deploy. Use aria/role attributes and [role="gridcell"] with aria-colindex/data-rowindex as primary selectors.',
    'Grid cells use [role="gridcell"] with aria-colindex and data-rowindex attributes. These are the most STABLE selectors for cell identification.',
    'Formula, rollup, lookup, count, and auto-number fields are READ-ONLY. Do NOT attempt to edit them. Identify field type from column header icons before editing.',
    'Checkbox fields use SPACE (not Enter) to toggle. Enter does nothing on checkbox cells. This is different from all other field types.',
    'Single select and multi select use DIFFERENT interaction patterns. Single select REPLACES the value; multi select APPENDS. Do not confuse them.',
    'Date fields may have time enabled. After selecting a date, Tab to check if a time input appears. Type time in HH:MM AM/PM format.',
    'Linked record fields open a search dialog. You MUST type to search for the record, then select from results. You cannot type a raw value -- it must match an existing record in the linked table.',
    'Attachment fields require a file picker dialog. Cannot fully automate file uploads via keyboard alone. URL-based attachments can be typed into the URL input.',
    'Airtable MAY use virtualized rendering for large tables. Rows below the viewport may NOT be in the DOM until scrolled to. Scroll down to load more rows before trying to interact with them.',
    'Expanding a record with Space opens a modal showing ALL fields including hidden ones. This is useful for seeing computed field values and editing fields not visible in the current grid view.',
    'Sort and filter controls are sticky buttons in the toolbar row. Active filters/sorts show a colored indicator or count badge on the button.',
    'Long text fields open an expanded editor overlay on the grid. The overlay is a separate contenteditable region. Press Escape to close and save.',
    'View tabs scroll horizontally if there are many views. Look for left/right arrow buttons to navigate between view tabs.',
    'Created Time, Last Modified Time, Created By, and Last Modified By are system fields that update automatically. They are always read-only.',
    'When using the record detail modal, changes save automatically as you tab between fields. There is no explicit save button in the modal.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
