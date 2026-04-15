/**
 * Site Guide: Todoist
 * Per-site guide for Todoist task management application.
 */

registerSiteGuide({
  site: 'Todoist',
  category: 'Productivity Tools',
  patterns: [
    /app\.todoist\.com/i,
    /todoist\.com\/app/i
  ],
  guidance: `TODOIST-SPECIFIC INTELLIGENCE:

QUICK ADD -- THE PRIMARY TASK CREATION METHOD:
  # Press Q to open Quick Add modal (THE fastest way to create tasks)
  key "q"                       # opens Quick Add modal
  waitForElement "[role='dialog']"  # wait for modal to render
  # Type the FULL task with natural language syntax:
  type "Buy groceries #Personal @errands p2 tomorrow at 5pm"
  key "Enter"                   # create the task
  # The task is created with ALL attributes parsed from the text

QUICK ADD NATURAL LANGUAGE SYNTAX:
  Full syntax: "Task name #ProjectName @label1 @label2 p1 tomorrow at 3pm"

  #ProjectName  - assigns to project (case-insensitive, partial match works)
  #My Project   - project names with spaces: use quotes or type as-is after #
  @label        - adds a label (label must already exist)
  @label1 @label2 - multiple labels supported
  p1            - URGENT (red) -- highest priority
  p2            - HIGH (orange)
  p3            - MEDIUM (blue)
  p4            - NO PRIORITY (default, no color) -- this is the reverse of some systems!

  Date phrases (natural language):
    "today"            - due today
    "tomorrow"         - due tomorrow
    "next Monday"      - due next Monday
    "every weekday"    - recurring, Monday through Friday
    "every month"      - recurring monthly
    "Jan 15"           - specific date
    "in 3 days"        - relative date
    "next week"        - due next week (Monday)
  Time phrases:
    "at 3pm"           - specific time
    "at 14:00"         - 24-hour format
  Duration:
    "for 30min"        - task duration 30 minutes
    "for 2h"           - task duration 2 hours

  IMPORTANT: Natural language parsing is LEFT TO RIGHT.
  Put the task name FIRST, then project, labels, priority, and date modifiers.
  Example: "Review PR #Engineering @code-review p1 tomorrow at 10am for 1h"

SINGLE TASK CREATION (alternative to Quick Add):
  key "a"                       # add task below current selection (inline)
  waitForElement "[role='textbox']"  # wait for inline editor
  type "Task text"              # type task name
  key "Enter"                   # create the task
  key "Escape"                  # close inline editor

KEYBOARD SHORTCUTS (CRITICAL -- READ WARNINGS BELOW):
  # Task creation
  Q: Open Quick Add modal (PRIMARY creation method)
  A: Add task below current selection (inline)

  # Navigation
  J: Move selection down to next task
  K: Move selection up to previous task
  G then I: Go to Inbox view (press G, release, press I)
  G then T: Go to Today view
  G then U: Go to Upcoming view

  # Task actions
  Enter: Open selected task detail view
  E: Open task editor for selected task
  X: Toggle task selection (for bulk actions)
  #: Complete the selected task (marks it done)
  C: Add comment to selected task
  Shift+D: Open due date picker for selected task
  1/2/3/4: Set priority when task editor is open (1=p1 urgent, 4=p4 none)

  # Search
  /: Open search (Ctrl+K also works)

CRITICAL -- TODOIST SHORTCUT HAZARD:
  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  Todoist uses 20+ UNMODIFIED SINGLE-KEY shortcuts (Q, A, E, C, X,
  J, K, G, #, 1, 2, 3, 4, /, etc.).
  If the AI types text WITHOUT focus on an input field, letters will
  trigger shortcuts instead of text entry.
  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  EVERY workflow that involves typing MUST include a focus verification step:
  1. Verify cursor is in an input/textarea/contenteditable element
  2. If NOT, click the target input field first to establish focus
  3. THEN type the content
  4. If typing triggers unexpected behavior, press Ctrl+Z immediately to undo

TASK COMPLETION:
  # Using keyboard (preferred)
  key "j"                       # navigate to target task (repeat as needed)
  key "#"                       # complete the task (disappears from active view)
  # Using click
  click e{N}                    # click the checkbox circle to the left of the task
  # Undo immediately with Ctrl+Z if completed by accident

VIEW NAVIGATION:
  # Keyboard (two-key sequences: press G first, then the view key)
  G then I: Inbox (all tasks without a project)
  G then T: Today (tasks due today)
  G then U: Upcoming (tasks due in the future, calendar view)
  # Click navigation via sidebar
  click e{N}                    # click Inbox/Today/Upcoming in the left sidebar

PROJECT ORGANIZATION:
  # Assign during creation via Quick Add:
  key "q"
  type "Task name #ProjectName"
  key "Enter"
  # Or move existing task: open task (Enter or E), change project field

DUE DATE SETTING:
  # During creation via Quick Add:
  key "q"
  type "Task name tomorrow at 3pm"
  key "Enter"
  # On existing task:
  key "j"                       # navigate to task
  key "Shift+d"                 # open date picker
  # Type a date or click in the calendar picker
  key "Enter"                   # confirm date`,

  fsbElements: {
    'quick-add-button': {
      label: 'Quick Add trigger button (+)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Quick Add Task"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Quick Add" i]' },
        { strategy: 'class', selector: '.plus_add_button' },
        { strategy: 'context', selector: 'header [aria-label*="Add" i][role="button"]' },
        { strategy: 'id', selector: '#quick_add_task_holder' }
      ]
    },
    'quick-add-input': {
      label: 'Quick Add task input field (modal open)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Task name"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="textbox"]' },
        { strategy: 'class', selector: '.task_editor__input_field [contenteditable="true"]' },
        { strategy: 'context', selector: '[role="dialog"] [contenteditable="true"]' },
        { strategy: 'id', selector: '#todoist-quick-add-input' }
      ]
    },
    'quick-add-submit': {
      label: 'Add task submit button in Quick Add',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add task"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="button"][aria-label*="Add task" i]' },
        { strategy: 'class', selector: '.reactist_button--primary' },
        { strategy: 'context', selector: '[role="dialog"] button[type="submit"]' },
        { strategy: 'id', selector: '#todoist-quick-add-submit' }
      ]
    },
    'task-list': {
      label: 'Main task list container',
      selectors: [
        { strategy: 'role', selector: '[role="list"][aria-label*="tasks" i]' },
        { strategy: 'aria', selector: '[aria-label="Tasks"]' },
        { strategy: 'class', selector: '.task_list_item__list' },
        { strategy: 'context', selector: 'main [role="list"]' },
        { strategy: 'id', selector: '#todoist-task-list' }
      ]
    },
    'sidebar-projects': {
      label: 'Projects section in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Projects"]' },
        { strategy: 'role', selector: 'nav [role="tree"][aria-label*="Projects" i]' },
        { strategy: 'class', selector: '.left_menu__projects' },
        { strategy: 'context', selector: 'nav [aria-label*="Projects" i]' },
        { strategy: 'id', selector: '#todoist-sidebar-projects' }
      ]
    },
    'sidebar-labels': {
      label: 'Labels section in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Labels"]' },
        { strategy: 'role', selector: 'nav [role="tree"][aria-label*="Labels" i]' },
        { strategy: 'class', selector: '.left_menu__labels' },
        { strategy: 'context', selector: 'nav [aria-label*="Labels" i]' },
        { strategy: 'id', selector: '#todoist-sidebar-labels' }
      ]
    },
    'sidebar-filters': {
      label: 'Filters section in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Filters"]' },
        { strategy: 'role', selector: 'nav [role="tree"][aria-label*="Filters" i]' },
        { strategy: 'class', selector: '.left_menu__filters' },
        { strategy: 'context', selector: 'nav [aria-label*="Filters" i]' },
        { strategy: 'id', selector: '#todoist-sidebar-filters' }
      ]
    },
    'inbox-link': {
      label: 'Inbox navigation link',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Inbox"]' },
        { strategy: 'role', selector: 'nav [role="treeitem"][aria-label*="Inbox" i]' },
        { strategy: 'class', selector: '.left_menu__inbox' },
        { strategy: 'context', selector: 'nav a[href*="inbox" i]' },
        { strategy: 'id', selector: '#filter_inbox' }
      ]
    },
    'today-link': {
      label: 'Today view navigation link',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Today"]' },
        { strategy: 'role', selector: 'nav [role="treeitem"][aria-label*="Today" i]' },
        { strategy: 'class', selector: '.left_menu__today' },
        { strategy: 'context', selector: 'nav a[href*="today" i]' },
        { strategy: 'id', selector: '#filter_today' }
      ]
    },
    'upcoming-link': {
      label: 'Upcoming view navigation link',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Upcoming"]' },
        { strategy: 'role', selector: 'nav [role="treeitem"][aria-label*="Upcoming" i]' },
        { strategy: 'class', selector: '.left_menu__upcoming' },
        { strategy: 'context', selector: 'nav a[href*="upcoming" i]' },
        { strategy: 'id', selector: '#filter_upcoming' }
      ]
    },
    'search-bar': {
      label: 'Search input',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'role', selector: '[role="searchbox"]' },
        { strategy: 'class', selector: '.top_bar__search' },
        { strategy: 'context', selector: 'header [role="search"] input' },
        { strategy: 'id', selector: '#todoist-search-bar' }
      ]
    },
    'project-add': {
      label: 'Add project button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add project"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Add project" i]' },
        { strategy: 'class', selector: '.left_menu__project_add' },
        { strategy: 'context', selector: 'nav [aria-label*="Projects" i] + [role="button"]' },
        { strategy: 'id', selector: '#todoist-add-project' }
      ]
    },
    'task-checkbox': {
      label: 'Task complete checkbox (first visible)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Complete task"]' },
        { strategy: 'role', selector: '[role="checkbox"][aria-label*="Complete" i]' },
        { strategy: 'class', selector: '.task_checkbox' },
        { strategy: 'context', selector: '[role="listitem"] [role="checkbox"]:first-of-type' },
        { strategy: 'id', selector: '#todoist-task-checkbox' }
      ]
    },
    'task-editor': {
      label: 'Inline task editor when editing',
      selectors: [
        { strategy: 'role', selector: '[role="textbox"][aria-label*="Task" i]' },
        { strategy: 'aria', selector: '[aria-label="Task name"]' },
        { strategy: 'class', selector: '.task_editor__input_field' },
        { strategy: 'context', selector: '.task_editor [contenteditable="true"]' },
        { strategy: 'id', selector: '#todoist-task-editor' }
      ]
    },
    'priority-picker': {
      label: 'Priority selector in task editor',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Set priority"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Priority" i]' },
        { strategy: 'class', selector: '.task_editor__priority_picker' },
        { strategy: 'context', selector: '.task_editor [aria-label*="priority" i]' },
        { strategy: 'id', selector: '#todoist-priority-picker' }
      ]
    },
    'date-picker': {
      label: 'Due date picker in task editor',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Set due date"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="due date" i]' },
        { strategy: 'class', selector: '.task_editor__date_picker' },
        { strategy: 'context', selector: '.task_editor [aria-label*="date" i]' },
        { strategy: 'id', selector: '#todoist-date-picker' }
      ]
    },
    'label-picker': {
      label: 'Label picker in task editor',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Set labels"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="label" i]' },
        { strategy: 'class', selector: '.task_editor__label_picker' },
        { strategy: 'context', selector: '.task_editor [aria-label*="label" i]' },
        { strategy: 'id', selector: '#todoist-label-picker' }
      ]
    },
    'project-picker': {
      label: 'Project picker in task editor',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Select a project"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="project" i]' },
        { strategy: 'class', selector: '.task_editor__project_picker' },
        { strategy: 'context', selector: '.task_editor [aria-label*="project" i]' },
        { strategy: 'id', selector: '#todoist-project-picker' }
      ]
    }
  },
  selectors: {
    quickAddButton: '[aria-label="Quick Add Task"]',
    quickAddInput: '[role="dialog"] [role="textbox"]',
    quickAddSubmit: '[role="dialog"] button[type="submit"]',
    taskList: '[role="list"][aria-label*="tasks" i]',
    sidebarProjects: '[aria-label="Projects"]',
    sidebarLabels: '[aria-label="Labels"]',
    sidebarFilters: '[aria-label="Filters"]',
    inboxLink: '[aria-label="Inbox"]',
    todayLink: '[aria-label="Today"]',
    upcomingLink: '[aria-label="Upcoming"]',
    searchBar: '[aria-label="Search"]',
    projectAdd: '[aria-label="Add project"]',
    taskCheckbox: '[aria-label="Complete task"]',
    taskEditor: '.task_editor__input_field',
    priorityPicker: '[aria-label="Set priority"]',
    datePicker: '[aria-label="Set due date"]',
    labelPicker: '[aria-label="Set labels"]',
    projectPicker: '[aria-label="Select a project"]'
  },
  workflows: {
    quickAddTask: [
      'Navigate to app.todoist.com and wait for the page to load',
      'Verify no input field has focus (press Escape to ensure clean state)',
      'Press Q to open the Quick Add modal',
      'Wait for the Quick Add dialog to render (look for [role="dialog"])',
      'FOCUS CHECK: Verify the task input field is focused (cursor should be blinking in the input)',
      'If not focused, click the task input field in the Quick Add modal',
      'Type the full task with natural language syntax, e.g.: "Review quarterly report #Work @urgent p1 tomorrow at 10am"',
      'The parser processes left-to-right: task name first, then #project @label priority date',
      'Press Enter to create the task (or click the "Add task" button)',
      'The modal closes and the task appears in the appropriate project/view',
      'VERIFY: Navigate to the target project or Today view (G+T) and confirm the task appears with correct project, labels, priority color, and due date',
      'STUCK: If Q does not open Quick Add, click the "+" button in the header directly. If natural language parsing fails (project/label not assigned), check spelling -- project names are case-insensitive but must match an existing project. Labels must already exist.'
    ],
    completeTask: [
      'Navigate to the view containing the target task (G+I for Inbox, G+T for Today)',
      'Press J/K to navigate to the target task (J moves down, K moves up)',
      'The selected task will have a visible highlight',
      'Press # to complete the task (marks it as done)',
      'The task disappears from the active view with a brief animation',
      'Alternative: click the circle checkbox to the left of the task text',
      'To undo immediately, press Ctrl+Z (a toast notification also appears with an Undo link)',
      'VERIFY: The task should no longer appear in the active task list. Check the "Completed" section at the bottom of the project to confirm.',
      'STUCK: If # does not complete the task, ensure a task is selected (has highlight from J/K). If clicking the checkbox does not work, try clicking the exact center of the circle. If the task reappears, it may be a recurring task -- check the date field.'
    ],
    editTask: [
      'Navigate to the view containing the target task',
      'Press J/K to navigate to the target task',
      'Press E to open the inline task editor (or click the task text directly)',
      'FOCUS CHECK: Verify the cursor is in the task name input field',
      'If not focused, click the task name field to place the cursor',
      'Edit the task name, description, or other fields',
      'Use the toolbar buttons to change project, labels, priority, or due date',
      'Press Escape to save and close the editor',
      'Alternative: press Enter on a selected task to open the full task detail view',
      'VERIFY: The updated task text/attributes should be visible in the task list after closing the editor',
      'STUCK: If E does not open the editor, try clicking the task text directly. If changes do not save, press Enter before Escape. Todoist does NOT auto-save inline edits -- you must confirm with Enter or Escape.'
    ],
    organizeByProject: [
      'Method 1 -- Quick Add with project (PREFERRED):',
      'Press Q to open Quick Add',
      'Type: "Task name #ProjectName" (use # followed by the project name)',
      'Press Enter to create the task directly in the target project',
      'Method 2 -- Move existing task:',
      'Navigate to the task with J/K and press E to edit',
      'Click the project picker button (shows current project name)',
      'Type to filter projects in the dropdown',
      'Click the target project to move the task',
      'Press Escape to close the editor',
      'VERIFY: Navigate to the target project in the sidebar and confirm the task appears there',
      'STUCK: If #ProjectName does not match, ensure the project exists. Todoist matches project names case-insensitively and supports partial matches. For projects with spaces, type the full name after #.'
    ],
    setPriority: [
      'Method 1 -- Quick Add with priority (PREFERRED):',
      'Press Q and type: "Task name p1" (p1=urgent red, p2=high orange, p3=medium blue, p4=default none)',
      'Press Enter to create the task with the specified priority',
      'Method 2 -- Edit existing task:',
      'Navigate to the task with J/K and press E to edit',
      'Press 1, 2, 3, or 4 to set priority (ONLY works when task editor is open)',
      'Alternative: click the priority flag icon in the editor toolbar',
      'Press Escape to save and close',
      'VERIFY: The task should display a colored flag/indicator matching the priority (red=p1, orange=p2, blue=p3, none=p4)',
      'STUCK: If pressing 1-4 types numbers instead of setting priority, ensure the task editor is in "edit mode" (E shortcut), not the task name input. The number shortcuts only work when the task editor panel is active, not when typing in the task name field.'
    ],
    setDueDate: [
      'Method 1 -- Quick Add with date (PREFERRED):',
      'Press Q and type: "Task name tomorrow at 3pm" or "Task name next Monday"',
      'Todoist parses natural language dates: "today", "tomorrow", "next week", "Jan 15", "every weekday"',
      'Press Enter to create the task with the parsed date',
      'Method 2 -- Edit existing task:',
      'Navigate to the task with J/K',
      'Press Shift+D to open the date picker',
      'Type a natural language date in the input field (e.g., "tomorrow")',
      'Or click a date in the calendar widget',
      'Press Enter to confirm the date',
      'Press Escape to close the editor',
      'VERIFY: The task should display the due date text (e.g., "Tomorrow", "Mon Jan 15") next to the task name',
      'STUCK: If Shift+D does not open the date picker, ensure a task is selected. Try clicking the due date area on the task directly. If natural language date is not parsed correctly, try a more explicit format like "Jan 15 2026".'
    ],
    searchTasks: [
      'Press / to open the search bar (or Ctrl+K)',
      'The search overlay appears with a text input focused',
      'FOCUS CHECK: Verify the cursor is in the search input',
      'Type your search query (searches task names, descriptions, comments, labels, and project names)',
      'Results appear below the input as you type',
      'Click a result to navigate to that task',
      'Press Escape to close search',
      'VERIFY: Search results should show tasks matching the query text. Each result shows the task name, project, and due date.',
      'STUCK: If / does not open search, ensure no task editor is open (press Escape first). Try Ctrl+K as an alternative. If search returns no results, try broader search terms.'
    ],
    navigateViews: [
      'Press Escape to ensure no editor or modal is open',
      'Two-key sequences: press G first, then the view key within 1 second',
      'G then I: Navigate to Inbox (tasks not assigned to a project)',
      'G then T: Navigate to Today view (tasks due today)',
      'G then U: Navigate to Upcoming view (future tasks in calendar layout)',
      'Wait for the view to load and the task list to render',
      'Alternative: click Inbox, Today, or Upcoming in the left sidebar',
      'VERIFY: The page header should show the view name (Inbox, Today, or Upcoming). The task list updates to show the appropriate tasks.',
      'STUCK: If the G+key sequence does not navigate, ensure you press G first, release it, then press the second key within about 1 second. If the sidebar is collapsed (narrow viewport), click the hamburger menu icon to expand it first.'
    ]
  },
  warnings: [
    'CRITICAL: Todoist uses 20+ unmodified single-key shortcuts (Q, A, E, C, X, J, K, G, #, 1-4, /, etc.). Typing text without input focus triggers commands instead of text entry. ALWAYS verify input focus before typing content.',
    'Quick Add (Q) is the fastest and most reliable way to create tasks with all attributes at once. Use it as the PRIMARY creation method over inline task adding.',
    'Quick Add natural language parsing is LEFT TO RIGHT -- put the task name first, then modifiers (#project @label p1-p4 date). Putting modifiers before the task name may cause parsing errors.',
    'p1 in Quick Add means URGENT (red flag), p4 means NO PRIORITY (no color) -- this is the reverse of some prioritization systems where 1 is lowest. Remember: p1 = most important.',
    'Date parsing accepts natural language ("tomorrow", "next week", "Jan 15") but does NOT support relative hour math ("in 2 hours"). Use "at 3pm" for specific times instead.',
    'Project names with spaces in Quick Add use # followed by the name: "#My Project". Todoist matches case-insensitively and supports partial matches.',
    'Labels use the @ prefix: "@urgent @work". Labels must already exist in Todoist -- Quick Add will NOT auto-create labels. Unknown @labels are ignored silently.',
    'Completing a task (# shortcut or checkbox click) immediately moves it to Completed. Press Ctrl+Z immediately to undo if completed by accident. The undo window is brief.',
    'Todoist does NOT auto-save inline edits. When editing a task (E shortcut), press Enter or Escape to save changes. Clicking away may discard unsaved changes.',
    'The sidebar collapses on narrow viewports (< 750px) -- look for a hamburger menu icon to expand it. If the sidebar is missing, check the viewport width.',
    'Filters view uses Todoist filter query syntax which is DIFFERENT from the search syntax. Filter queries use operators like "assigned to: me" and "due before: tomorrow". Search is plain text.',
    'Sub-tasks are created by pressing Ctrl+Right Arrow on a task to indent it under the task above. Ctrl+Left Arrow promotes a sub-task back to a top-level task.',
    'The G+key navigation shortcuts (G+I, G+T, G+U) are two-key sequences -- press G first, release, then press the second key within about 1 second. They do NOT work if held simultaneously.',
    'When the Quick Add modal is open, the task input field should be auto-focused. If typing goes to the wrong place, click directly on the task name input within the modal before typing.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
