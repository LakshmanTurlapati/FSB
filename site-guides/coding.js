/**
 * Site Guide: Coding Platforms
 * Covers LeetCode, HackerRank, GitHub, CodeForces, GeeksforGeeks
 */

const CODING_GUIDE = {
  name: 'Coding Platforms',

  patterns: [
    /leetcode\.com/i,
    /hackerrank\.com/i,
    /github\.com/i,
    /codeforces\.com/i,
    /geeksforgeeks\.org/i,
    /codepen\.io/i,
    /codesandbox\.io/i,
    /replit\.com/i,
    /gitlab\.com/i,
    /stackoverflow\.com/i,
    /codechef\.com/i,
    /atcoder\.jp/i
  ],

  guidance: `CODING PLATFORM INTELLIGENCE:

LEETCODE-SPECIFIC INTELLIGENCE:

CODE EDITOR:
1. LeetCode uses Monaco editor. The editor is [role="textbox"] (contenteditable div).
2. CLEAR BEFORE TYPING: Click the editor to focus, then press Ctrl+A (Cmd+A on Mac) to select all existing code.
3. TYPE COMPLETE CODE: Send the full solution in a single type action with proper \\n newlines and space indentation.
4. VERIFY AFTER TYPING: Use getEditorContent to read back the editor content.
   - Check all lines are present and correctly indented
   - Python code is especially sensitive to indentation errors
   - If content is wrong, select all (Ctrl+A) and re-type
5. WAIT FOR EDITOR: Editor loads async. Use waitForElement on [role="textbox"] before interacting.
6. IF TYPING FAILS: Wait 1-2s with waitForDOMStable, then retry.

LANGUAGE SELECTION:
- The language dropdown is a Radix UI button showing the current language (e.g. "Python3").
- Click the language button, then click the desired language from the dropdown menu.
- The dropdown uses aria-controls for state. Wait for dropdown to appear after clicking.
- After selecting, wait for the editor to reload with the new language template.

RUNNING & SUBMITTING:
- Run button: [aria-label="Run"] -- tests against sample cases only.
- Submit button: [aria-label="Submit"] -- tests against ALL cases, gives final verdict.
- ALWAYS run first before submitting to catch obvious errors.
- After submission, WAIT for results to load (may take several seconds).
- Check for "Accepted", "Wrong Answer", "Time Limit Exceeded", "Runtime Error".

ERROR HANDLING AFTER RUN/SUBMIT:
- After clicking Run, wait for results with waitForDOMStable
- Use getText to read the output/result panel
- If "Wrong Answer": Read expected vs actual output. Analyze the logic error. Fix the code. Select all in editor, re-type corrected code, verify with getEditorContent, then Run again.
- If "Runtime Error": Read the error message (e.g., TypeError, IndexError). Fix the bug. Clear editor, re-type, verify, Run again.
- If "Time Limit Exceeded": The algorithm is too slow. Consider a more efficient approach (e.g., hash map instead of nested loops). Re-type optimized solution, verify, Submit.
- If "Compilation Error": Read the error line/message. Fix syntax. Re-type, verify, Run again.
- ALWAYS Run before Submit to catch errors early.
- After fixing and re-running successfully, then Submit.

PROBLEM PAGE NAVIGATION:
- Problems are at /problems/[slug]/ (e.g. /problems/two-sum/)
- Navigate between problems: [aria-label="Next Question"] and [aria-label="Prev Question"]
- Daily challenge: [aria-label="Daily Question"] in the navbar
- Problem list panel: [aria-label="Expand Panel"]

PAGE LAYOUT:
- LeetCode uses a split-pane layout: problem description on the left, editor on the right.
- The layout can be customized via the Layouts button (#qd-layout-manager-btn).
- Settings gear is at #nav-setting-btn.
- Use [aria-label="Note"] to open the notes panel for the problem.

DEBUGGER (Premium only):
- Step over: [aria-label="Step over"]
- Step in: [aria-label="Step in"]
- Step out: [aria-label="Step out"]
- Restart: [aria-label="Restart"]
- Stop: [aria-label="Stop Debug"]
- If user does not have Premium, debugger shows an upgrade prompt.

CONTEST PAGES:
- Contests at /contest/[contest-name]/ (e.g. /contest/weekly-contest-488/)
- Rankings at /contest/[contest-name]/ranking/
- Join Contest button available in navbar.

UI FRAMEWORK NOTES:
- LeetCode uses Radix UI for dropdowns/menus (aria-controls="radix-:..." pattern).
- Buttons use aria-label for identification -- prefer aria-label selectors over CSS classes.
- Heavy use of Tailwind CSS utility classes which are NOT stable selectors.
- Do NOT rely on Tailwind class names -- they change frequently.

OTHER PLATFORMS:

CODE EDITORS (non-LeetCode):
- HackerRank: Monaco editor via ".monaco-editor textarea"
- CodeForces: Plain textarea or ACE editor via ".ace_editor textarea"
- GeeksforGeeks: ACE editor via ".ace_editor textarea"
- CodeMirror sites: ".CodeMirror textarea" or ".cm-content"

PROBLEM NAVIGATION:
- HackerRank: Challenges at /challenges/challenge-slug/
- CodeForces: Problems at /problemset/problem/contestId/index
- GeeksforGeeks: Problems at /problems/problem-slug/

GITHUB-SPECIFIC INTELLIGENCE:

GLOBAL SEARCH:
- Search bar: [aria-label="Search or jump to..."] (keyboard shortcut: / opens it)
- Repository filter on dashboard: #dashboard-repos-filter-left or [aria-label="Find a repository..."]

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
- Code search: use the search bar with qualifiers (repo:, path:, language:)`,

  selectors: {
    leetcode: {
      editor: '[role="textbox"]',
      runButton: '[aria-label="Run"]',
      submitButton: '[aria-label="Submit"]',
      nextQuestion: '[aria-label="Next Question"]',
      prevQuestion: '[aria-label="Prev Question"]',
      dailyQuestion: '[aria-label="Daily Question"]',
      expandPanel: '[aria-label="Expand Panel"]',
      layoutManager: '#qd-layout-manager-btn',
      settingsNav: '#nav-setting-btn',
      noteButton: '[aria-label="Note"]',
      userMenu: '[aria-label="User Menu"]',
      notification: '[aria-label="notification"]',
      resetButton: '[aria-label="Reset"]',
      stopwatch: '[aria-label="Stopwatch"]',
      // Debugger (Premium)
      stepOver: '[aria-label="Step over"]',
      stepIn: '[aria-label="Step in"]',
      stepOut: '[aria-label="Step out"]',
      restartDebug: '[aria-label="Restart"]',
      stopDebug: '[aria-label="Stop Debug"]'
    },
    hackerrank: {
      editor: '.monaco-editor textarea',
      languageSelector: '.select-language select',
      runButton: '.hr-monaco-submit .btn:first-child',
      submitButton: '.hr-monaco-submit .btn:last-child',
      testResult: '.challenge-response',
      problemTitle: '.challenge-page-label-wrapper h2'
    },
    github: {
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
    codeforces: {
      editor: '#sourceCodeTextarea, .ace_editor textarea',
      languageSelector: 'select[name="programTypeId"]',
      submitButton: '.submit input[type="submit"]',
      problemStatement: '.problem-statement',
      verdict: '.verdict-accepted, .verdict-wrong-answer'
    },
    geeksforgeeks: {
      editor: '.ace_editor textarea',
      languageSelector: '#lang-select',
      runButton: '#runCode',
      submitButton: '#submitCode',
      output: '#output',
      problemTitle: '.problem-tab__name'
    },
    stackoverflow: {
      searchBox: 'input[name="q"]',
      answerEditor: '#wmd-input',
      postAnswer: '#submit-button',
      questionTitle: '#question-header h1 a',
      voteUp: '.js-vote-up-btn',
      voteDown: '.js-vote-down-btn'
    }
  },

  workflows: {
    solveProblem: [
      'Navigate to the problem page (/problems/[slug]/)',
      'Read the problem description on the left panel',
      'Select the programming language from the dropdown',
      'Clear the editor with Ctrl+A then type complete solution',
      'Click Run [aria-label="Run"] to test sample cases',
      'Check test output for correctness',
      'If tests pass, click Submit [aria-label="Submit"]',
      'Wait for verdict and report result'
    ],
    navigateToDaily: [
      'Click Daily Question [aria-label="Daily Question"] in navbar',
      'Wait for problem page to load',
      'Read problem description'
    ],
    browseProblems: [
      'Navigate to /problemset/',
      'Use filters or search to find problems',
      'Click on a problem title to open it'
    ],
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
    ]
  },

  warnings: [
    'LeetCode may show CAPTCHA after multiple rapid submissions',
    'LeetCode premium problems are behind a paywall -- cannot access without subscription',
    'The debugger is premium-only -- will show upgrade prompt for free users',
    'Language selector is a Radix UI dropdown, NOT a native <select> -- click the button then pick from menu',
    'Do NOT rely on Tailwind CSS class names as selectors -- they are unstable. Use aria-label attributes.',
    'Code editors load asynchronously -- always wait for [role="textbox"] before typing',
    'Do NOT click Submit if the typing action failed -- retry typing first',
    'After submission, results may take several seconds to load -- wait for DOM to stabilize',
    'GitHub may require authentication for private repositories',
    'GitHub now has Copilot chat integrated into the dashboard -- use #copilot-chat-textarea for AI queries',
    'GitHub uses hashed CSS module class names (prc-Button-ButtonBase-9n-Xk, etc.) -- never use them as selectors',
    'GitHub filter anchor buttons (authors, labels, milestones, etc.) use stable data-testid attributes',
    'Star/Watch buttons on GitHub have dynamic aria-labels containing counts -- use pattern matching',
    'Keyboard shortcut / opens the GitHub global search -- can use keyPress as alternative to clicking search',
    'HackerRank has separate Run and Submit buttons -- Run only tests sample cases',
    'CodeForces editor may be a plain textarea, not a rich editor',
    'After typing code into Monaco editor, ALWAYS verify with getEditorContent before running -- indentation errors cause silent failures'
  ],

  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
};

registerSiteGuide(CODING_GUIDE);
