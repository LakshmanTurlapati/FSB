/**
 * Site Guide: HackerRank
 * Per-site guide for HackerRank coding challenge platform.
 */

registerSiteGuide({
  site: 'HackerRank',
  category: 'Coding Platforms',
  patterns: [
    /hackerrank\.com/i
  ],
  guidance: `HACKERRANK-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # solve a challenge
  click e5    # editor area
  key "a" --ctrl   # select all existing code
  type e5 "solution code here"
  click e10   # Run button
  gettext e12   # test result
  click e15   # Submit button

CODE EDITOR:
- HackerRank uses Monaco editor via ".monaco-editor textarea"
- CLEAR BEFORE TYPING: Click the editor to focus, then press Ctrl+A to select all existing code.
- TYPE COMPLETE CODE: Send the full solution in a single type action.
- VERIFY AFTER TYPING: Read back editor content to confirm correctness.

LANGUAGE SELECTION:
- Language dropdown: .select-language select
- This is a native <select> element -- use selectOption tool

RUNNING & SUBMITTING:
- Run button: .hr-monaco-submit .btn:first-child (runs against sample test cases)
- Submit button: .hr-monaco-submit .btn:last-child (submits for full evaluation)
- ALWAYS run first before submitting
- Test results appear in .challenge-response

PROBLEM NAVIGATION:
- Challenges at /challenges/challenge-slug/
- Problem title: .challenge-page-label-wrapper h2`,
  selectors: {
    editor: '.monaco-editor textarea',
    languageSelector: '.select-language select',
    runButton: '.hr-monaco-submit .btn:first-child',
    submitButton: '.hr-monaco-submit .btn:last-child',
    testResult: '.challenge-response',
    problemTitle: '.challenge-page-label-wrapper h2'
  },
  workflows: {
    solveProblem: [
      'Navigate to the challenge page (/challenges/[slug]/)',
      'Read the problem description',
      'Select the programming language from the dropdown',
      'Clear the editor with Ctrl+A then type complete solution',
      'Click Run to test sample cases',
      'Check test output for correctness',
      'If tests pass, click Submit for full evaluation',
      'Wait for verdict and report result'
    ]
  },
  warnings: [
    'HackerRank has separate Run and Submit buttons -- Run only tests sample cases',
    'Code editors load asynchronously -- always wait for the editor element before typing',
    'After typing code, verify with getEditorContent before running',
    'Some challenges require specific input/output formatting'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
});
