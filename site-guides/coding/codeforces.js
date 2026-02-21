/**
 * Site Guide: Codeforces
 * Per-site guide for Codeforces competitive programming platform.
 */

registerSiteGuide({
  site: 'Codeforces',
  category: 'Coding Platforms',
  patterns: [
    /codeforces\.com/i
  ],
  guidance: `CODEFORCES-SPECIFIC INTELLIGENCE:

CODE EDITOR:
- Editor: #sourceCodeTextarea or .ace_editor textarea
- Codeforces may use a plain textarea or ACE editor depending on the page
- CLEAR BEFORE TYPING: Select all existing code (Ctrl+A) before typing
- TYPE COMPLETE CODE: Send the full solution in a single type action

LANGUAGE SELECTION:
- Language dropdown: select[name="programTypeId"]
- This is a native <select> element -- use selectOption tool

SUBMITTING:
- Submit button: .submit input[type="submit"]
- Problem statement: .problem-statement
- Verdict: .verdict-accepted or .verdict-wrong-answer

PROBLEM NAVIGATION:
- Problems at /problemset/problem/contestId/index (e.g., /problemset/problem/1/A)
- Contest problems at /contest/contestId/problem/index
- Problem statement is in .problem-statement div`,
  selectors: {
    editor: '#sourceCodeTextarea, .ace_editor textarea',
    languageSelector: 'select[name="programTypeId"]',
    submitButton: '.submit input[type="submit"]',
    problemStatement: '.problem-statement',
    verdict: '.verdict-accepted, .verdict-wrong-answer'
  },
  workflows: {
    solveProblem: [
      'Navigate to the problem page',
      'Read the problem statement (.problem-statement)',
      'Select programming language from dropdown',
      'Clear editor and type complete solution',
      'Click Submit button',
      'Wait for verdict to appear',
      'Report result (Accepted, Wrong Answer, etc.)'
    ]
  },
  warnings: [
    'CodeForces editor may be a plain textarea, not a rich editor',
    'Code editors load asynchronously -- always wait for the editor element before typing',
    'After typing code, verify content before submitting',
    'Contest submissions have time limits -- be aware of remaining contest time'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
});
