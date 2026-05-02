/**
 * Site Guide: Jira
 * Per-site guide for Jira project management (Atlassian Cloud, new UI).
 * Selector strategy: data-testid-first (Atlassian Design System pattern -- data-testid attributes are stable across deploys)
 */

registerSiteGuide({
  site: 'Jira',
  category: 'Productivity Tools',
  patterns: [
    /\.atlassian\.net\/jira/i,
    /\.atlassian\.net\/browse/i,
    /\.atlassian\.net\/board/i,
    /\.atlassian\.net\/projects/i
  ],
  guidance: `JIRA-SPECIFIC INTELLIGENCE (NEW UI ONLY):

CREATE ISSUE -- FULL FORM WORKFLOW (THE critical workflow):
  Press C (global shortcut) to open the Create Issue modal.
  Form fields (Tab order):
    1. Project:      Pre-selected from current context. Click dropdown to change.
    2. Issue Type:   Click dropdown > select Bug / Story / Task / Epic / Sub-task.
                     Type first letters to filter (e.g., "Bug").
    3. Summary:      REQUIRED. Type the issue title. This is the only required field.
    4. Description:  Rich text editor (contenteditable). Click to focus, then type.
                     Supports markdown-style: **bold**, *italic*, # heading,
                     - bullet list, 1. numbered list, \`code\`, \`\`\`code block\`\`\`
                     Toolbar buttons also available for formatting.
    5. Assignee:     Click field > start typing name > select from dropdown.
                     Shortcut: type first/last name, results filter live.
    6. Priority:     Click dropdown > select Highest / High / Medium / Low / Lowest.
                     Default is Medium if not changed.
    7. Labels:       Click field > type to search > Enter to select (multi-select).
                     Can add multiple labels. Type and select each one.
    8. Sprint:       Click dropdown > select active sprint or "Backlog".
                     Only appears if project uses Scrum methodology.
    9. Story Points: Click field > type number > Tab away.
                     Only appears if estimation is enabled for the project.
    10. Fix Version: Click dropdown > select version (if configured).
                     Only appears if project has versions configured.

  After filling fields: Tab to "Create" button > Enter, or click "Create".
  For multiple issues: Check "Create another" checkbox before submitting.
  The modal stays open for the next issue with fields partially pre-filled.

KEYBOARD SHORTCUTS (Jira new UI):
  C:               Create issue (opens modal)
  /:               Focus search bar
  G then B:        Go to Board view
  G then K:        Go to Backlog view
  G then D:        Go to Dashboard
  J:               Move to next issue (down in list/board)
  K:               Move to previous issue (up in list/board)
  Enter:           Open selected issue detail
  E:               Edit selected issue
  M:               Assign selected issue to me
  A:               Open assignee picker for selected issue
  I:               Assign issue (opens picker)
  O:               Open link URL for selected issue
  T:               Open status transition dialog
  L:               Edit labels on selected issue
  Esc:             Close modal / go back

CONTENTEDITABLE for Description field:
  The Jira description uses Atlassian Editor (ProseMirror-based):
  - Click the description area first to establish cursor
  - Type plain text or use formatting shortcuts:
    Ctrl+B: Bold
    Ctrl+I: Italic
    Ctrl+Shift+7: Ordered list
    Ctrl+Shift+8: Bullet list
    Ctrl+Shift+S: Strikethrough
  - Markdown shortcuts work: "# " for heading, "- " for bullet, "1. " for numbered
  - Mention users with @username
  - Link issues with #ISSUE-KEY (e.g., #PROJ-123)

JQL (Jira Query Language) for search:
  Basic syntax: field operator value
  Examples:
    project = MYPROJ
    assignee = currentUser()
    status = "In Progress"
    priority in (High, Highest)
    sprint in openSprints()
    created >= -7d
    text ~ "search term"
  Combine with AND, OR: project = MYPROJ AND status != Done

STATUS TRANSITIONS:
  Open issue > click status badge/button (e.g., "To Do", "In Progress")
  Dropdown shows available transitions based on workflow
  Select new status > transition executes
  Some transitions may require additional fields (resolution, comment)`,
  fsbElements: {
    'create-button': {
      label: 'Global create issue button',
      selectors: [
        { strategy: 'id', selector: '[data-testid="global-create-button"]' },
        { strategy: 'aria', selector: '[aria-label="Create"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Create" i]' },
        { strategy: 'context', selector: '[data-testid="navigation-apps"] [role="button"]:first-child' },
        { strategy: 'class', selector: 'button[data-testid="global-create-button"]' }
      ]
    },
    'search-bar': {
      label: 'Search issues input',
      selectors: [
        { strategy: 'id', selector: '[data-testid="search-dialog-input"]' },
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'role', selector: '[role="search"] input, [role="searchbox"]' },
        { strategy: 'context', selector: '[data-testid="navigation-apps"] [role="search"]' },
        { strategy: 'class', selector: 'input[data-testid*="search"]' }
      ]
    },
    'board-view': {
      label: 'Board/kanban view container',
      selectors: [
        { strategy: 'id', selector: '[data-testid="software-board.board"]' },
        { strategy: 'role', selector: '[role="region"][aria-label*="Board" i]' },
        { strategy: 'aria', selector: '[aria-label="Board"]' },
        { strategy: 'context', selector: '[data-testid*="board"] [role="region"]' },
        { strategy: 'class', selector: '[data-testid="software-board.board"]' }
      ]
    },
    'backlog-view': {
      label: 'Backlog view container',
      selectors: [
        { strategy: 'id', selector: '[data-testid="software-backlog"]' },
        { strategy: 'role', selector: '[role="region"][aria-label*="Backlog" i]' },
        { strategy: 'aria', selector: '[aria-label="Backlog"]' },
        { strategy: 'context', selector: '[data-testid*="backlog"] [role="region"]' },
        { strategy: 'class', selector: '[data-testid="software-backlog"]' }
      ]
    },
    'sprint-section': {
      label: 'Sprint section in backlog',
      selectors: [
        { strategy: 'id', selector: '[data-testid="software-backlog.sprint"]' },
        { strategy: 'role', selector: '[role="group"][aria-label*="Sprint" i]' },
        { strategy: 'aria', selector: '[aria-label*="Sprint"]' },
        { strategy: 'context', selector: '[data-testid*="backlog"] [data-testid*="sprint"]' },
        { strategy: 'class', selector: '[data-testid*="sprint-container"]' }
      ]
    },
    'issue-card': {
      label: 'Individual issue card on board',
      selectors: [
        { strategy: 'id', selector: '[data-testid="software-board.card-container"]' },
        { strategy: 'role', selector: '[role="listitem"][draggable]' },
        { strategy: 'aria', selector: '[aria-label*="issue" i][draggable]' },
        { strategy: 'context', selector: '[data-testid*="board"] [draggable="true"]' },
        { strategy: 'class', selector: '[data-testid*="card-container"]' }
      ]
    },
    'column-header': {
      label: 'Board column header (status column)',
      selectors: [
        { strategy: 'id', selector: '[data-testid="software-board.column-header"]' },
        { strategy: 'role', selector: '[role="heading"][aria-level]' },
        { strategy: 'aria', selector: '[aria-label*="column" i]' },
        { strategy: 'context', selector: '[data-testid*="board"] [data-testid*="column-header"]' },
        { strategy: 'class', selector: '[data-testid*="column-header"]' }
      ]
    },
    'sidebar-nav': {
      label: 'Left sidebar navigation',
      selectors: [
        { strategy: 'id', selector: '[data-testid="sidebar-navigation"]' },
        { strategy: 'role', selector: '[role="navigation"][aria-label*="project" i]' },
        { strategy: 'aria', selector: '[aria-label="Project navigation"]' },
        { strategy: 'context', selector: 'nav[data-testid*="sidebar"]' },
        { strategy: 'class', selector: '[data-testid*="sidebar-navigation"]' }
      ]
    },
    'project-selector': {
      label: 'Project selector/switcher',
      selectors: [
        { strategy: 'id', selector: '[data-testid="project-selector"]' },
        { strategy: 'aria', selector: '[aria-label="Project"]' },
        { strategy: 'role', selector: '[role="button"][aria-haspopup="listbox"]' },
        { strategy: 'context', selector: '[data-testid*="sidebar"] [data-testid*="project"]' },
        { strategy: 'class', selector: '[data-testid*="project-selector"]' }
      ]
    },
    'filter-bar': {
      label: 'Filter/JQL bar',
      selectors: [
        { strategy: 'id', selector: '[data-testid="filters-bar"]' },
        { strategy: 'aria', selector: '[aria-label="Filter"]' },
        { strategy: 'role', selector: '[role="toolbar"][aria-label*="filter" i]' },
        { strategy: 'context', selector: '[data-testid*="board"] [data-testid*="filter"]' },
        { strategy: 'class', selector: '[data-testid*="filters"]' }
      ]
    },
    'create-modal-summary': {
      label: 'Issue summary field in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.summary"]' },
        { strategy: 'aria', selector: '[aria-label="Summary"]' },
        { strategy: 'role', selector: '[role="dialog"] input[name="summary"]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] input[aria-label*="Summary"]' },
        { strategy: 'class', selector: 'input[data-testid*="summary"]' }
      ]
    },
    'create-modal-type': {
      label: 'Issue type selector in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.issue-type"]' },
        { strategy: 'aria', selector: '[aria-label="Issue type"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="button"][aria-label*="type" i]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [data-testid*="issue-type"]' },
        { strategy: 'class', selector: '[data-testid*="issue-type"]' }
      ]
    },
    'create-modal-priority': {
      label: 'Priority selector in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.priority"]' },
        { strategy: 'aria', selector: '[aria-label="Priority"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="button"][aria-label*="Priority" i]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [data-testid*="priority"]' },
        { strategy: 'class', selector: '[data-testid*="priority"]' }
      ]
    },
    'create-modal-assignee': {
      label: 'Assignee picker in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.assignee"]' },
        { strategy: 'aria', selector: '[aria-label="Assignee"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="button"][aria-label*="Assignee" i]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [data-testid*="assignee"]' },
        { strategy: 'class', selector: '[data-testid*="assignee"]' }
      ]
    },
    'create-modal-sprint': {
      label: 'Sprint selector in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.sprint"]' },
        { strategy: 'aria', selector: '[aria-label="Sprint"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="button"][aria-label*="Sprint" i]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [data-testid*="sprint"]' },
        { strategy: 'class', selector: '[data-testid*="sprint"]' }
      ]
    },
    'create-modal-labels': {
      label: 'Labels picker in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.labels"]' },
        { strategy: 'aria', selector: '[aria-label="Labels"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="combobox"][aria-label*="Labels" i]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [data-testid*="labels"]' },
        { strategy: 'class', selector: '[data-testid*="labels"]' }
      ]
    },
    'create-modal-description': {
      label: 'Description rich text editor in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.description"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="textbox"][contenteditable]' },
        { strategy: 'aria', selector: '[aria-label="Description"]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [contenteditable="true"]' },
        { strategy: 'class', selector: '[data-testid*="description"] [contenteditable]' }
      ]
    },
    'create-modal-story-points': {
      label: 'Story points field in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.story-points"]' },
        { strategy: 'aria', selector: '[aria-label="Story points"]' },
        { strategy: 'role', selector: '[role="dialog"] input[aria-label*="Story point" i]' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] [data-testid*="story-point"]' },
        { strategy: 'class', selector: 'input[data-testid*="story-point"]' }
      ]
    },
    'create-modal-submit': {
      label: 'Create/Submit button in create modal',
      selectors: [
        { strategy: 'id', selector: '[data-testid="create-issue-dialog.create-button"]' },
        { strategy: 'aria', selector: '[aria-label="Create"]' },
        { strategy: 'role', selector: '[role="dialog"] [role="button"]:last-child' },
        { strategy: 'context', selector: '[data-testid*="create-issue"] button[type="submit"]' },
        { strategy: 'class', selector: 'button[data-testid*="create-button"]' }
      ]
    },
    'issue-detail-status': {
      label: 'Status transition button in issue detail',
      selectors: [
        { strategy: 'id', selector: '[data-testid="issue.views.issue-base.foundation.status.status-field"]' },
        { strategy: 'aria', selector: '[aria-label*="Status" i]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="status" i]' },
        { strategy: 'context', selector: '[data-testid*="issue-detail"] [data-testid*="status"]' },
        { strategy: 'class', selector: '[data-testid*="status-field"]' }
      ]
    }
  },
  selectors: {
    createButton: '[data-testid="global-create-button"], [aria-label="Create"]',
    searchBar: '[data-testid="search-dialog-input"], [aria-label="Search"]',
    boardView: '[data-testid="software-board.board"]',
    backlogView: '[data-testid="software-backlog"]',
    issueCard: '[data-testid="software-board.card-container"]',
    sidebarNav: '[data-testid="sidebar-navigation"]',
    createModalSummary: '[data-testid*="create-issue"] input[aria-label*="Summary"]',
    createModalType: '[data-testid*="create-issue"] [data-testid*="issue-type"]',
    createModalPriority: '[data-testid*="create-issue"] [data-testid*="priority"]',
    createModalAssignee: '[data-testid*="create-issue"] [data-testid*="assignee"]',
    createModalDescription: '[data-testid*="create-issue"] [contenteditable="true"]',
    issueDetailStatus: '[data-testid*="status-field"]',
    filterBar: '[data-testid="filters-bar"]'
  },
  workflows: {
    createIssue: [
      'Press C to open the Create Issue modal (global shortcut)',
      'Wait for the modal to load -- the Summary field should be focused',
      'If Issue Type is not correct: click the Issue Type dropdown > type to filter (e.g., "Bug") > select',
      'Type the issue summary/title in the Summary field',
      'Press Tab to move to the Description field',
      'Click the Description area to focus the rich text editor > type description text',
      'Tab to Assignee field > click > type team member name > select from dropdown',
      'Tab to Priority field > click dropdown > select priority level (High, Medium, etc.)',
      'Tab to Labels field > type label name > Enter to add > repeat for multiple labels',
      'Tab to Sprint field > click dropdown > select active sprint or Backlog',
      'Tab to Story Points field > type number estimate',
      'Tab to the "Create" button and press Enter (or click "Create")',
      'VERIFY: Success banner appears with issue key (e.g., "PROJ-123 created"). Issue appears on board/backlog.',
      'STUCK: If C shortcut does not open modal, click the "+" or "Create" button in the top navigation. If modal fields are missing, the project may use a different issue type scheme -- check with project admin.'
    ],
    transitionStatus: [
      'Open the issue detail view (click the issue card/link, or press Enter on selected issue)',
      'Click the status badge/button (shows current status like "To Do", "In Progress")',
      'A dropdown appears with available status transitions',
      'Click the target status (e.g., "In Progress", "In Review", "Done")',
      'If the transition requires a resolution or comment, fill the required fields and confirm',
      'VERIFY: Status badge updates to show the new status. Issue moves to the corresponding board column.',
      'STUCK: If status dropdown does not show the target status, the workflow may restrict that transition. Check the workflow diagram (Project Settings > Workflows) for valid transition paths.'
    ],
    navigateBoard: [
      'Press G then B to navigate to the Board view (or click "Board" in sidebar)',
      'Wait for the board to load -- columns should be visible with status headers',
      'Press J to move to the next issue card (down/right)',
      'Press K to move to the previous issue card (up/left)',
      'Press Enter to open the selected issue detail panel',
      'Press Escape to close the detail panel and return to board',
      'VERIFY: Board displays columns matching project workflow statuses. Issue cards show summary, assignee avatar, and priority icon.',
      'STUCK: If G+B does not navigate, click "Board" in the left sidebar under the project name. If board is empty, check that the sprint has started and issues are assigned to the active sprint.'
    ],
    searchIssues: [
      'Press / to focus the search bar (or click the search icon in top navigation)',
      'Type search query -- can use plain text or JQL syntax',
      'For JQL: type structured query (e.g., "project = MYPROJ AND status = \'In Progress\'")',
      'Press Enter to execute the search',
      'Use J/K to navigate through search results',
      'Press Enter to open a result',
      'VERIFY: Search results list shows matching issues with key, summary, status, and assignee.',
      'STUCK: If / does not focus search, click the search icon in the top navigation bar. For JQL syntax errors, switch to Basic search mode using the toggle.'
    ],
    addComment: [
      'Open the issue detail view (click issue or press Enter on selected issue)',
      'Scroll down to the Activity/Comments section',
      'Click "Add a comment" placeholder text to focus the comment editor',
      'Type your comment -- rich text formatting is supported (Ctrl+B bold, Ctrl+I italic)',
      'Use @username to mention team members (popover appears for selection)',
      'Press Ctrl+M to save the comment (or click the "Save" button)',
      'VERIFY: Comment appears in the activity feed with your avatar, timestamp, and formatted text.',
      'STUCK: If comment area is not visible, scroll down in the issue detail view. If the "Add a comment" button does not respond, try pressing M (keyboard shortcut for comment on some views).'
    ],
    assignIssue: [
      'Open the issue detail view or select the issue on the board',
      'Press A to open the assignee picker (or click the Assignee field)',
      'Type the team member name -- results filter as you type',
      'Select the person from the dropdown (click or press Enter)',
      'VERIFY: Assignee avatar appears on the issue card/detail. Assignee name shows in the issue details panel.',
      'STUCK: If A shortcut does not work, click the Assignee field directly in the issue detail view. If the person is not found, they may not have access to the project.'
    ],
    manageSprint: [
      'Press G then K to navigate to the Backlog view',
      'Sprint sections appear with their names and issue counts',
      'To add issues to a sprint: select issues (click checkboxes or Shift+click range)',
      'Right-click for context menu > "Move to Sprint" > select target sprint',
      'Alternative: drag issues from Backlog section into a Sprint section',
      'To start a sprint: click "Start Sprint" button at the top of the sprint section',
      'Fill in sprint dates and goal > click "Start"',
      'VERIFY: Issues appear under the target sprint section. Sprint shows start/end dates after starting.',
      'STUCK: If backlog is empty, ensure the correct project and board are selected. "Start Sprint" only appears if there are issues in the sprint and no other active sprint (for Scrum boards).'
    ],
    filterBoard: [
      'On the Board view, click the filter bar at the top (or use quick filter buttons)',
      'For text filter: type issue key or summary text in the search input',
      'For quick filters: click predefined filter buttons (e.g., "Only My Issues", "Recently Updated")',
      'For JQL filter: switch to JQL mode and type a query',
      'Board cards update live to show only matching issues',
      'Click "Clear" or remove filter text to reset',
      'VERIFY: Board shows only matching issues. Filter indicator appears showing active filters.',
      'STUCK: If filter bar is not visible, it may be collapsed -- look for a filter icon in the board toolbar. If JQL mode is not available, the project admin may have disabled it.'
    ]
  },
  warnings: [
    'This guide covers JIRA NEW UI ONLY. The classic/old UI has completely different selectors, layout, and keyboard shortcuts. If the UI looks different, the user may be on an older Jira version.',
    'Create Issue modal fields vary by project configuration. Some fields (Sprint, Story Points, Fix Version) only appear if the project has those features enabled. Do not fail if a field is missing.',
    'data-testid selectors are Jira/Atlassian most STABLE selectors -- always use as primary strategy. Class names change with Atlassian Design System updates.',
    'Description field uses Atlassian Editor (ProseMirror-based rich text). Click to focus FIRST before typing. Without focus, keystrokes may trigger global shortcuts instead.',
    'Sprint field only appears if the project uses Scrum methodology (not Kanban). Kanban projects have no sprints.',
    'Story Points field may not appear if the project does not have estimation enabled. This is a per-project configuration.',
    'Dropdown menus (Issue Type, Priority, Assignee, Sprint) all support search-as-you-type. Type the first few letters to filter options rather than scrolling through long lists.',
    'Status transitions follow workflow rules. Not all transitions are available from all states (e.g., cannot go directly from "To Do" to "Done" if workflow requires "In Progress" first).',
    'JQL (Jira Query Language) in search has specific syntax requirements. Common errors: missing quotes around multi-word values, wrong field names. Use Basic mode toggle as fallback.',
    'Issue cards on the board CAN be dragged between columns, but keyboard-based status transition (opening issue > clicking status) is more reliable for automation.',
    '"Create another" checkbox in the Create modal persists between sessions. Check/uncheck as needed before submitting.',
    'Jira uses Atlassian Design System components. Component class names may change between releases, but data-testid attributes remain stable.',
    'Some issue fields are custom fields added by project administrators. These may not have predictable data-testid values -- use aria-label as fallback.',
    'Board and Backlog views may use virtualized rendering for large backlogs. Issues below the viewport may not be in the DOM. Scroll to load more.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
