/**
 * Site Guide: Observable
 * Per-site guide for Observable (observablehq.com) computational notebooks.
 *
 * Observable notebooks contain reactive cells with JavaScript code and
 * visualizations. Cells use CodeMirror editors and outputs render below
 * or beside the code. Modifying one cell can trigger reactive updates in
 * downstream cells that depend on its exported values.
 *
 * Key challenge: editing a specific cell (cell 3) without altering other
 * cells (cell 1) requires capturing cell content before editing and
 * verifying it remains unchanged after the edit completes.
 *
 * Primary target: observablehq.com public notebooks.
 * Created for Phase 78, CONTEXT-02 edge case validation.
 * Target: fork Observable notebook, modify cell 3 data without altering cell 1.
 */

registerSiteGuide({
  site: 'Observable',
  category: 'Coding Platforms',
  patterns: [
    /observablehq\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CONTEXT-02):
- [context] Wait for client-side rendering -- cells are NOT in server HTML
- [context] Use getText for targeted cell reads, not full read_page (~25-100x savings)
- [context] Identify cells by content type, not just position number
- [context] Wait 2-3s after cell edit for reactive runtime to propagate
- [context] Use tinker mode (click to edit) as skip-auth fallback for fork

OBSERVABLE NOTEBOOK EDITING (CONTEXT-02):

OBSERVABLE NOTEBOOK DOM STRUCTURE:
- Observable notebooks are web pages at observablehq.com/@username/notebook-name
- Each notebook contains an ordered list of cells, rendered top-to-bottom
- Cell containers are div elements, typically with class containing "cell" or data attributes identifying cell position
- Each cell has two parts: a code editor (CodeMirror instance) and an output area (rendered result)
- CodeMirror editors: div elements with class "cm-editor" containing "cm-content" for editable code
- Cell outputs render below the code as HTML, SVG, or canvas elements depending on the cell's return value
- Cells are numbered implicitly by position (1st cell = cell 1, 3rd cell = cell 3)
- Observable uses a reactive runtime: if cell 3 defines a variable used by cell 5, editing cell 3 triggers cell 5 to re-run
- Cell 1 will NOT be affected by editing cell 3 UNLESS cell 1 explicitly references a variable defined in cell 3
- Notebook toolbar at top contains: title, author, fork button, publish button, share button
- The fork button creates a personal copy of the notebook (requires authentication)

CELL IDENTIFICATION:
- Cells do not have visible numbers in the UI -- they are identified by position in the DOM
- To find "cell 3": locate all cell containers in the notebook, select the 3rd one (0-indexed: index 2)
- Cell containers are typically direct children of a notebook body/content wrapper
- Observable uses class names like "observablehq--cell" or attributes like data-cell-id
- Alternative identification: by the variable name defined in the cell (e.g., "data = [...]")
- Pinned cells may appear at top of notebook regardless of definition order -- check for pinned indicators

CODEMIRROR EDITOR INTERACTION:
- Observable cells use CodeMirror 6 editors (same as noted in Coding Platforms shared guidance)
- To edit a cell: click on the cell to reveal the editor, then click inside the cm-content area to focus
- Select all existing code: Ctrl+A (Cmd+A on Mac) to select all text in the editor
- Type new code: the type_text tool replaces selected text in focused CodeMirror editor
- After editing: the cell automatically re-evaluates (reactive runtime triggers)
- Wait for the cell output to update before verifying -- use wait_for_stable or a short delay
- CodeMirror does NOT use standard textarea -- do not try to set .value directly

FORKING VS TINKER MODE:
- Fork button: creates a personal copy of the notebook under your account (REQUIRES AUTH)
- If not logged in: Observable shows a sign-in prompt when clicking Fork
- Tinker mode: Observable allows anonymous "tinker" editing on public notebooks without forking
- In tinker mode: click on any cell to open the editor, make changes, see results -- but changes are NOT saved
- For CONTEXT-02: tinker mode is sufficient to demonstrate cell editing capability
- If fork requires auth: document as SKIP-AUTH for the fork portion, but PASS/PARTIAL for cell editing via tinker

DATA ARRAY MODIFICATION:
- "Modify data array in cell 3" means: find the 3rd cell, locate its data definition (e.g., data = [1, 2, 3, 4, 5]), and change the array values
- Common patterns: data = [1, 2, 3, 4, 5] -> data = [10, 20, 30, 40, 50]
- After modification: downstream cells that reference "data" will reactively update
- The modification should be a clear, verifiable change (not subtle)

CELL CONTENT VERIFICATION (BEFORE/AFTER):
- Before editing cell 3: capture cell 1's visible output text using read_page or getText
- After editing cell 3: re-capture cell 1's visible output text
- Compare: if cell 1 output text is identical before and after, cell 1 was NOT altered
- Also verify cell 3's output changed (confirms the edit took effect)
- If cell 1's output DID change: it means cell 1 depends on cell 3's exported variable -- this is expected reactive behavior, not a bug
- For a clean test: choose a notebook where cell 1 does NOT depend on cell 3

CONTEXT MANAGEMENT:
- Multi-step workflow accumulates context: navigate, fork/tinker, identify cells, capture baselines, edit, verify
- Each read_page of a notebook page can be 50-200KB depending on cell complexity
- Minimize context by: reading only specific cell content (not full page), using getText for targeted extraction
- Do NOT re-read the full notebook DOM after each edit -- only read the cells being verified`,
  selectors: {
    // Notebook structure
    notebookBody: 'div.observablehq-body, main[class*="notebook"], div[class*="notebook-body"]',
    cellContainer: 'div.observablehq--cell, div[class*="cell-container"], div[data-cell-id], div.observablehq--block',
    cellEditor: 'div.cm-editor, div[class*="cell-editor"], div.CodeMirror',
    cellContent: 'div.cm-content, div[class*="cm-line"], div.CodeMirror-code',
    cellOutput: 'div.observablehq--value, div[class*="cell-output"], div.observablehq--inspect, figure',
    cellName: 'span.observablehq--cellname, span[class*="cell-name"], div[class*="variable-name"]',
    // Notebook toolbar
    forkButton: 'button[class*="fork"], a[href*="/fork"], button[aria-label*="Fork"], button[title*="Fork"]',
    notebookTitle: 'h1[class*="title"], a[class*="notebook-title"], h1.observablehq--title',
    publishButton: 'button[class*="publish"], button[aria-label*="Publish"]',
    shareButton: 'button[class*="share"], button[aria-label*="Share"]',
    // Cell interaction
    runButton: 'button[class*="run"], button[aria-label*="Run"], button[title*="Run cell"]',
    addCellButton: 'button[class*="add-cell"], button[aria-label*="Add cell"], button[title*="Insert cell"]',
    cellMenuButton: 'button[class*="cell-menu"], button[aria-label*="Cell menu"], button[class*="more"]',
    // Auth-related
    signInButton: 'a[href*="/signin"], button[class*="sign-in"], a[class*="sign-in"]',
    signInModal: 'div[class*="modal"][class*="sign"], div[class*="auth-modal"], div[role="dialog"]',
    // Editor state
    editorFocused: 'div.cm-editor.cm-focused, div.cm-editor:focus-within',
    editorLine: 'div.cm-line, div.cm-activeLine'
  },
  workflows: {
    forkAndEditCell: [
      'Navigate to a public Observable notebook using navigate tool (e.g., observablehq.com/@observablehq/five-minute-introduction or another public notebook with data arrays)',
      'Wait for notebook to fully load via wait_for_stable -- verify cell containers are visible in the DOM',
      'Dismiss any cookie consent banners or notification prompts if present',
      'COUNT CELLS: Use get_dom_snapshot to find all cell containers (div.observablehq--cell or similar). Count them to confirm at least 3 cells exist. Identify cell 1 (first container) and cell 3 (third container)',
      'CAPTURE CELL 1 BASELINE: Use read_page or getText to capture cell 1 visible output text. Store this text as the "before" state for later comparison',
      'CAPTURE CELL 3 BASELINE: Read cell 3 current content (both code and output). Identify the data array or value to modify',
      'ATTEMPT FORK: Click the fork button to create a personal copy. If a sign-in modal appears, document as SKIP-AUTH for forking and proceed with tinker mode instead',
      'TINKER MODE (if fork requires auth): Click directly on cell 3 to open its CodeMirror editor. The editor should appear inline allowing code changes without saving',
      'EDIT CELL 3: Click inside the cm-content area of cell 3 editor to focus. Select all existing code with Ctrl+A. Type the modified data array (e.g., change [1, 2, 3] to [10, 20, 30])',
      'WAIT FOR REACTIVE UPDATE: After typing, wait 2-3 seconds or use wait_for_stable for the reactive runtime to re-evaluate cell 3 and any dependent cells',
      'VERIFY CELL 3 CHANGED: Read cell 3 output -- confirm it reflects the new data values',
      'VERIFY CELL 1 UNCHANGED: Use read_page or getText to capture cell 1 visible output text. Compare against the "before" baseline captured in step 5',
      'If cell 1 output is identical to baseline: PASS for cell isolation',
      'If cell 1 output changed: document whether cell 1 depends on cell 3 variable (expected reactive behavior) vs an unintended side effect',
      'Record all outcomes: fork status (succeeded/skip-auth), cell 3 edit status (succeeded/failed), cell 1 verification (unchanged/changed/could not verify)'
    ],
    verifyCellUnchanged: [
      'Identify the target cell to verify (e.g., cell 1) by its position in the cell container list',
      'Use getText or read_page to extract the visible output text of the target cell',
      'Compare the extracted text against the previously stored baseline text',
      'If texts match exactly: cell is unchanged -- verification PASSES',
      'If texts differ: check whether the difference is due to reactive dependency on the edited cell or an unintended side effect'
    ]
  },
  warnings: [
    'Observable requires authentication (GitHub or Google login) to fork notebooks -- clicking Fork without auth triggers a sign-in modal',
    'Observable allows anonymous "tinker" editing on public notebooks -- changes are visible but NOT saved, which is sufficient for CONTEXT-02 demonstration',
    'Observable cells use CodeMirror 6 editors -- do NOT try to set textarea.value or use input events; use click to focus + Ctrl+A to select + type_text to replace',
    'Observable cells are reactive: editing cell 3 may trigger re-evaluation of cells that reference cell 3 exported variables -- this is expected behavior, not a bug',
    'Cell numbering is by DOM position (1st child = cell 1), not by any visible number in the UI -- pinned cells may disrupt expected ordering',
    'Observable notebooks can be very large (50+ cells) -- read only the specific cells needed (cell 1 and cell 3), not the entire notebook DOM',
    'After editing a cell, wait for the reactive runtime to complete before verifying other cells -- outputs may take 1-3 seconds to update',
    'Some Observable notebooks use imported libraries or fetch external data -- cell outputs may vary between page loads even without editing',
    'Observable may show an "unsaved changes" banner in tinker mode -- this does not prevent cell editing',
    'Context bloat risk: each read_page of a notebook page can be 50-200KB -- use targeted getText for cell content instead of full page reads'
  ],
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'getText', 'click', 'type_text', 'waitForElement', 'wait_for_stable', 'scroll']
});
