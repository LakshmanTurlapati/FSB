/**
 * Shared Category Guidance: Coding Platforms
 * Category-level guidance that applies to all coding/development sites.
 */

registerCategoryGuidance({
  category: 'Coding Platforms',
  icon: 'fa-code',
  guidance: `CODING PLATFORM INTELLIGENCE:

CODE EDITORS:
- Most coding platforms use rich editors (Monaco, ACE, CodeMirror) rather than plain textareas.
- CLEAR BEFORE TYPING: Click the editor to focus, then press Ctrl+A (Cmd+A on Mac) to select all existing code.
- TYPE COMPLETE CODE: Send the full solution in a single type action with proper newlines and space indentation.
- VERIFY AFTER TYPING: Use getEditorContent to read back the editor content and confirm correctness.
- Code editors load asynchronously -- always wait for the editor element before interacting.

PROBLEM SOLVING WORKFLOW:
1. Read the problem description carefully
2. Select the correct programming language from the dropdown
3. Clear existing code and type the complete solution
4. Run the code against sample test cases first
5. Check the output for correctness
6. If tests pass, submit for final evaluation
7. Wait for and report the verdict

ERROR HANDLING:
- Wrong Answer: Read expected vs actual output, analyze logic error, fix and re-run
- Runtime Error: Read the error message, fix the bug, re-type and re-run
- Time Limit Exceeded: Algorithm is too slow, consider more efficient approach
- Compilation Error: Fix syntax errors and re-run
- ALWAYS run before submitting to catch errors early`,
  warnings: [
    'Code editors load asynchronously -- always wait for the editor element before typing',
    'After typing code, ALWAYS verify with getEditorContent before running -- indentation errors cause silent failures',
    'Do NOT rely on Tailwind CSS or hashed class names as selectors -- they are unstable',
    'Premium/paid features may be gated behind subscriptions'
  ]
});
