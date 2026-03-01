/**
 * Site Guide: GitHub
 * Per-site guide for GitHub code hosting and collaboration platform.
 */

registerSiteGuide({
  site: 'GitHub',
  category: 'Coding Platforms',
  patterns: [
    /github\.com/i
  ],
  guidance: `GITHUB-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a repository
  click e5    # search box
  type e5 "react state management"
  enter
  click e10   # repository result
  # create an issue
  click e15   # Issues tab
  click e18   # New Issue button
  type e20 "Bug: form validation fails"
  type e22 "Steps to reproduce..."
  click e25   # Submit new issue

GLOBAL SEARCH:
- Search bar: [aria-label="Search or jump to..."] (keyboard shortcut: / opens it)
- Repository filter on dashboard: #dashboard-repos-filter-left or [aria-label="Find a repository..."]
- Code search: use the search bar with qualifiers (repo:, path:, language:)

COPILOT CHAT (integrated into dashboard):
- Chat input: #copilot-chat-textarea or [aria-label="Ask anything"]
- Submit prompt: [data-testid="submit-prompt"]
- Repository context selector: [aria-label="Select repositories to attach to conversation"]
- New chat button: [aria-label="New chat"]
- Starter topics: [data-testid="starter-write-code-group"], [data-testid="starter-git-group"], [data-testid="starter-pull-requests-group"]

ISSUE/PR FILTERING:
- Filter by author: [data-testid="authors-anchor-button"]
- Filter by label: [data-testid="labels-anchor-button"]
- Filter by milestone: [data-testid="milestones-anchor-button"]
- Filter by assignee: [data-testid="assignees-anchor-button"]
- Filter by project: [data-testid="projects-anchor-button"]

ISSUE/PR COUNTERS & TITLES:
- Issue count: [data-testid="issue-count"]
- PR count: [data-testid="pull-request-count"]
- Issue/PR title links: [data-testid="issue-pr-title-link"]

REPOSITORY ACTIONS:
- Star repo: [aria-label="Star this repository (N)"] (dynamic count in label)
- Watch repo: [aria-label="Watch: Participating in REPO"] (dynamic repo name)
- Go to file: [aria-label="Go to file"]
- Add file: [aria-label="Add file"]
- Commit details toggle: [data-testid="latest-commit-details-toggle"]
- CI/CD status badge: [data-testid="checks-status-badge-icon"]

UI LAYOUT:
- Sidebar collapse: [aria-label="Collapse sidebar"]
- Cookie management: look for "Manage cookies" text button

REPOSITORY NAVIGATION:
- Use the file tree or breadcrumb links for navigation
- For PRs: find the "Files changed" tab to review diffs
- For Issues: the comment box is at the bottom of the page`,
  selectors: {
    searchBox: '#query-builder-test',
    repoName: '[itemprop="name"] a',
    fileTree: '.js-navigation-open',
    codeContent: '.blob-code-inner',
    issueTitle: '.js-issue-title',
    commentBox: '#new_comment_field',
    submitComment: '.btn-primary[type="submit"]',
    prFilesChanged: '#files_tab_counter',
    createPR: '.btn-primary:has-text("Create pull request")',
    globalSearch: '[aria-label="Search or jump to..."]',
    repoFilter: '#dashboard-repos-filter-left',
    copilotChat: '#copilot-chat-textarea',
    copilotSubmit: '[data-testid="submit-prompt"]',
    copilotRepoContext: '[aria-label="Select repositories to attach to conversation"]',
    copilotNewChat: '[aria-label="New chat"]',
    goToFile: '[aria-label="Go to file"]',
    addFile: '[aria-label="Add file"]',
    filterAuthors: '[data-testid="authors-anchor-button"]',
    filterLabels: '[data-testid="labels-anchor-button"]',
    filterMilestones: '[data-testid="milestones-anchor-button"]',
    filterAssignees: '[data-testid="assignees-anchor-button"]',
    filterProjects: '[data-testid="projects-anchor-button"]',
    issueCount: '[data-testid="issue-count"]',
    prCount: '[data-testid="pull-request-count"]',
    issuePrTitle: '[data-testid="issue-pr-title-link"]',
    latestCommit: '[data-testid="latest-commit-details-toggle"]',
    checksStatus: '[data-testid="checks-status-badge-icon"]',
    collapseSidebar: '[aria-label="Collapse sidebar"]'
  },
  workflows: {
    reviewPR: [
      'Navigate to the pull request page',
      'Click Files Changed tab to see the diff',
      'Scroll through changed files',
      'Extract key changes and their purpose',
      'Report findings'
    ],
    createIssue: [
      'Navigate to the repository',
      'Click Issues tab',
      'Click New Issue button',
      'Fill in title and description',
      'Add labels if applicable',
      'Click Submit new issue',
      'Report the created issue URL'
    ],
    searchCode: [
      'Click search bar [aria-label="Search or jump to..."] or press /',
      'Type search query with qualifiers (repo:, path:, language:)',
      'Browse results and click on matching files',
      'Extract relevant code content'
    ]
  },
  warnings: [
    'GitHub may require authentication for private repositories',
    'GitHub now has Copilot chat integrated into the dashboard -- use #copilot-chat-textarea for AI queries',
    'GitHub uses hashed CSS module class names (prc-Button-ButtonBase-9n-Xk, etc.) -- never use them as selectors',
    'GitHub filter anchor buttons (authors, labels, milestones, etc.) use stable data-testid attributes',
    'Star/Watch buttons have dynamic aria-labels containing counts -- use pattern matching',
    'Keyboard shortcut / opens the GitHub global search -- can use keyPress as alternative to clicking search'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
});
