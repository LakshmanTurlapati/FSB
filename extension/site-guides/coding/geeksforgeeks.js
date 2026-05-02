/**
 * Site Guide: GeeksforGeeks
 * Per-site guide for GeeksforGeeks coding practice platform.
 */

registerSiteGuide({
  site: 'GeeksforGeeks',
  category: 'Coding Platforms',
  patterns: [
    /geeksforgeeks\.org/i
  ],
  guidance: `GEEKSFORGEEKS-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # solve a practice problem
  click e5    # editor area
  key "a" --ctrl   # select all
  type e5 "solution code here"
  click e10   # Run button
  gettext e12   # output
  click e15   # Submit button

CODE EDITOR:
- Editor: .ace_editor textarea (ACE editor)
- CLEAR BEFORE TYPING: Select all existing code (Ctrl+A) before typing
- TYPE COMPLETE CODE: Send the full solution in a single type action
- VERIFY AFTER TYPING: Use getEditorContent to confirm correctness

LANGUAGE SELECTION:
- Language dropdown: #lang-select
- Select the desired language before typing code

RUNNING & SUBMITTING:
- Run button: #runCode (tests against custom input)
- Submit button: #submitCode (submits for full evaluation)
- Output panel: #output
- ALWAYS run first before submitting

PROBLEM NAVIGATION:
- Problems at /problems/problem-slug/
- Problem title: .problem-tab__name`,
  selectors: {
    editor: '.ace_editor textarea',
    languageSelector: '#lang-select',
    runButton: '#runCode',
    submitButton: '#submitCode',
    output: '#output',
    problemTitle: '.problem-tab__name'
  },
  workflows: {
    solveProblem: [
      'Navigate to the problem page (/problems/[slug]/)',
      'Read the problem description',
      'Select programming language from #lang-select dropdown',
      'Clear editor and type complete solution',
      'Click Run (#runCode) to test against sample cases',
      'Check output panel (#output) for correctness',
      'If tests pass, click Submit (#submitCode)',
      'Wait for verdict and report result'
    ]
  },
  warnings: [
    'GeeksforGeeks uses ACE editor -- .ace_editor textarea for interaction',
    'Code editors load asynchronously -- always wait for the editor element before typing',
    'After typing code, verify with getEditorContent before running',
    'Some problems may have editorial solutions available for reference'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
});
