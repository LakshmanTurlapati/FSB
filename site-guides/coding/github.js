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
- For Issues: the comment box is at the bottom of the page

INFINITE-SCROLL ACTIVITY FEED LOG SEARCH (DATE-BASED):

GITHUB ACTIVITY FEED LOCATIONS:
- Public profile activity: github.com/{username} -- shows contribution activity in timeline format
- Repository activity: github.com/{owner}/{repo}/activity -- shows repo events (commits, issues, PRs)
- Organization audit log: github.com/orgs/{org}/audit-log -- requires org admin (skip if auth required)
- Best public target: a popular user's profile page (e.g., github.com/torvalds, github.com/gaearon)
- Alternative: GitHub public events API page or any public repo's activity feed

ACTIVITY FEED STRUCTURE:
- Profile page shows contribution timeline with dated event groups
- Events are grouped by date headers (e.g., "Mar 18, 2026", "3 days ago")
- Each event shows: action type (committed, opened issue, created PR, starred repo), repository name, timestamp
- Timeline loads more events on scroll (infinite scroll behavior)
- GitHub uses relative timestamps for recent events ("2 hours ago", "3 days ago") and absolute dates for older events
- Activity containers use .TimelineItem or similar timeline component classes
- Date group headers separate events by day

TIMESTAMP PARSING:
- Relative timestamps: "X hours ago", "X days ago", "yesterday", "last week", "last month"
- Absolute timestamps: datetime attribute on <time> or <relative-time> elements (e.g., datetime="2026-03-18T14:30:00Z")
- <relative-time> custom elements render relative text but contain absolute datetime attribute
- Use the datetime attribute for precise date comparison, not the displayed relative text
- Compare datetime attribute value to target date (3 days ago from current date)

DEDUPLICATION FOR SCROLL SNAPSHOTS:
- GitHub does NOT use virtualized DOM for activity feeds (unlike Twitter) -- events persist in DOM as you scroll
- However, use event identifiers (link hrefs, commit SHAs, issue numbers) to track what has been read
- Each event typically contains a link to the specific commit/issue/PR -- use this href as unique ID
- Track a Set of seen event hrefs across scroll iterations to avoid re-processing

METHOD: FIND LOG ENTRY FROM N DAYS AGO IN ACTIVITY FEED:
Steps:
1. Navigate to a public GitHub user profile (e.g., github.com/torvalds or github.com/gaearon)
2. Scroll down to the contribution activity section or navigate to the activity tab if available
3. Use read_page to capture visible activity entries with their timestamps
4. For each visible entry: extract the <relative-time> or <time> element's datetime attribute
5. Compare each entry's date to the target date (current date minus N days)
6. If target date entries are visible: extract the log entry text (event description, repo name, action)
7. If target date is not yet visible (all visible entries are newer): scroll down to load more entries
8. After scrolling, use read_page again to capture newly loaded entries
9. Repeat steps 4-8 until: (a) entry from target date found, (b) entries older than target date visible (overshot), or (c) no more entries load after 3 scroll attempts
10. If found: extract full entry text including action type, repository name, and exact timestamp
11. If overshot (entries jump past target date): report the closest entries before and after target date
12. Verify: extracted entry's datetime is within +/- 24 hours of the target date

SCROLL TIMING FOR ACTIVITY FEED:
- GitHub activity feeds load additional entries when scrolling near the bottom
- Allow 1500ms-2500ms after scrolling for new entries to load
- Use waitForDOMStable after scroll to confirm new content appeared
- If no new entries after scroll + 3 second wait: end of available activity reached
- Typical GitHub profile shows 20-50 events per scroll load
- Reaching 3 days ago may require 2-10 scroll iterations depending on user activity level

TARGET USER SELECTION:
- Choose users with consistent daily activity for reliable 3-day-old entries
- Good targets: torvalds (Linux commits daily), gaearon (React contributor), sindresorhus (prolific open source)
- Avoid inactive users or users with sporadic activity (may not have entries from exactly 3 days ago)
- The profile page (github.com/{username}) is publicly accessible without authentication`,
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
    collapseSidebar: '[aria-label="Collapse sidebar"]',
    // Activity feed log search selectors
    activityFeed: '.js-yearly-contributions, .contribution-activity-listing, [data-testid="activity"]',
    activityEvent: '.TimelineItem, .contribution-activity-listing .Box, [data-testid="activity-item"]',
    activityTimestamp: 'relative-time, time[datetime], .f6.text-muted relative-time',
    activityEventLink: '.TimelineItem a[href*="/commit/"], .TimelineItem a[href*="/issues/"], .TimelineItem a[href*="/pull/"]',
    activityDateGroup: '.contribution-activity-listing h4, .TimelineItem-body .f6',
    activityEventText: '.TimelineItem-body, .contribution-activity-listing .Box-body',
    profileNav: '[aria-label="User profile"] nav, .UnderlineNav',
    activityTab: 'a[href$="?tab=activity"], nav a:has-text("Activity")'
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
    ],
    findLogEntryByDate: [
      'Navigate to a public GitHub user profile (e.g., github.com/torvalds)',
      'Scroll to contribution activity section on the profile page',
      'Use read_page to capture visible activity entries and their timestamps',
      'Parse <relative-time> datetime attributes to get absolute dates for each entry',
      'Compare each entry date to target date (current date minus N days)',
      'If target date entries not visible yet: scroll down to load more activity entries',
      'Wait 1500-2500ms after scroll for new entries to load (waitForDOMStable)',
      'Re-read page to capture newly loaded entries, check dates again',
      'Repeat scroll-read-compare until target date entry found or entries go older than target',
      'Extract found entry: action type, repository name, full text, exact timestamp',
      'Verify: extracted datetime is within 24 hours of target date',
      'Report the log entry text and its exact timestamp'
    ],
    scrollActivityFeed: [
      'Navigate to public user profile activity page',
      'Initialize empty seen-events Set for deduplication',
      'Loop: read_page for entries, extract new events, scroll down, wait for load',
      'Track event hrefs as unique identifiers across scroll snapshots',
      'Continue until target condition met or no more entries load'
    ]
  },
  warnings: [
    'GitHub may require authentication for private repositories',
    'GitHub now has Copilot chat integrated into the dashboard -- use #copilot-chat-textarea for AI queries',
    'GitHub uses hashed CSS module class names (prc-Button-ButtonBase-9n-Xk, etc.) -- never use them as selectors',
    'GitHub filter anchor buttons (authors, labels, milestones, etc.) use stable data-testid attributes',
    'Star/Watch buttons have dynamic aria-labels containing counts -- use pattern matching',
    'Keyboard shortcut / opens the GitHub global search -- can use keyPress as alternative to clicking search',
    'GitHub activity feeds on public profiles load more entries on scroll -- not paginated like search results',
    'Use <relative-time> element datetime attribute for precise date comparison, not the displayed text',
    'GitHub profiles may show different content when logged in vs logged out -- public view may have fewer entries',
    'Activity feed entries persist in DOM as you scroll (not virtualized like Twitter) -- but still deduplicate by event href',
    'Choose active users (torvalds, gaearon, sindresorhus) for reliable 3-day-old entries',
    'If activity tab is not visible, contribution activity is typically in the main profile body below the contribution graph'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption', 'get_dom_snapshot', 'read_page', 'scrollToElement']
});
