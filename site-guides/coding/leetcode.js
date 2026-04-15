/**
 * Site Guide: LeetCode
 * Per-site guide for LeetCode coding challenge platform.
 */

registerSiteGuide({
  site: 'LeetCode',
  category: 'Coding Platforms',
  patterns: [
    /leetcode\.com/i
  ],
  guidance: `LEETCODE-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # solve a problem
  click e5    # editor area
  key "a" --ctrl   # select all existing code
  type e5 "def twoSum(self, nums, target):\\n    seen = {}\\n    ..."
  click e10   # Run button
  gettext e15   # test output
  click e18   # Submit button

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
- Do NOT rely on Tailwind class names -- they change frequently.`,
  selectors: {
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
    stepOver: '[aria-label="Step over"]',
    stepIn: '[aria-label="Step in"]',
    stepOut: '[aria-label="Step out"]',
    restartDebug: '[aria-label="Restart"]',
    stopDebug: '[aria-label="Stop Debug"]'
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
    ]
  },
  warnings: [
    'LeetCode may show CAPTCHA after multiple rapid submissions',
    'LeetCode premium problems are behind a paywall -- cannot access without subscription',
    'The debugger is premium-only -- will show upgrade prompt for free users',
    'Language selector is a Radix UI dropdown, NOT a native <select> -- click the button then pick from menu',
    'Do NOT rely on Tailwind CSS class names as selectors -- they are unstable. Use aria-label attributes.',
    'Code editor loads asynchronously -- always wait for [role="textbox"] before typing',
    'Do NOT click Submit if the typing action failed -- retry typing first',
    'After submission, results may take several seconds to load -- wait for DOM to stabilize'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
});
