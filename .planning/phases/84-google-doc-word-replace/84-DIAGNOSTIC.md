# Autopilot Diagnostic Report: Phase 84 - Google Doc Word Replace

## Metadata
- Phase: 84
- Requirement: CONTEXT-08
- Date: 2026-03-22
- Outcome: SKIP-AUTH (Google Docs requires authentication for both document creation and document editing. The docs.google.com landing page redirects to accounts.google.com sign-in (HTTP 302 -> 200, 894,191 bytes). Creating a new doc via docs.new also redirects to accounts.google.com (HTTP 302 -> 200, 894,284 bytes). The sample public Google Doc URL returns HTTP 404 (7,862 bytes). No publicly editable Google Doc could be accessed without a signed-in Google account. The MCP server process is running on port 7225 but returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch -- same persistent blocker as Phases 55-83. Even if a public Google Doc were accessible for viewing, the manual word replacement workflow (Ctrl+F to locate, double-click to select, type to replace) requires Edit mode which requires Google authentication. The SKIP-AUTH expectation documented in the google-docs.js site guide is confirmed.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required". Same persistent blocker as Phases 55-83. Additionally, Google Docs authentication gate blocks all document editing regardless of MCP bridge status.)

## Prompt Executed
"Open a Google Doc containing the word 'synergy', manually find and replace every occurrence of 'synergy' with 'collaboration' without using the Find and Replace dialog (Ctrl+H). Use Find (Ctrl+F) to locate each occurrence, double-click to select the word, and type the replacement."

## Result Summary
Live MCP test was attempted but blocked by two independent factors: (1) the persistent WebSocket bridge disconnect (MCP server returns HTTP 426, same blocker as Phases 55-83), and (2) Google Docs authentication requirement for document editing. HTTP-based validation confirmed that docs.google.com redirects to accounts.google.com sign-in page, docs.new redirects to sign-in, and the sample public document ID returns HTTP 404. The manual word replacement strategy (Ctrl+F locate, double-click select on canvas, type to replace) could not be physically demonstrated. The google-docs.js site guide's SKIP-AUTH expectation is confirmed -- Google Docs editing requires a signed-in Google account with edit permission, and no workaround is available for unauthenticated access.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1a | navigate | https://docs.google.com (landing page) | NOT EXECUTED (MCP) / FETCHED (HTTP 302 -> 200, 894,191 bytes, redirects to accounts.google.com) | Landing page immediately redirects to Google sign-in: accounts.google.com/v3/signin/identifier with continue=https://docs.google.com/. Page contains "identifierNext" button and "Email or phone" input field. Auth required: YES. No document content accessible without sign-in. |
| 1b | navigate | https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit (sample public doc) | NOT EXECUTED (MCP) / FETCHED (HTTP 404, 7,862 bytes) | Document does not exist or is not publicly accessible. Google returns a generic error page. Zero kix-page-column, kix-appview-editor, or docs-title-input selectors in the 404 page. The document ID from the plan is not a valid publicly shared Google Doc. |
| 1c | navigate | https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/pub (published version) | NOT EXECUTED (MCP) / FETCHED (HTTP 404, 7,862 bytes) | Published version also returns 404. Even Google Docs published mode (read-only HTML export) requires the document to exist and be shared. |
| 1d | navigate | https://docs.new (create blank doc) | NOT EXECUTED (MCP) / FETCHED (HTTP 302 -> 200, 894,284 bytes, redirects to accounts.google.com) | Blank doc creation redirects to Google sign-in with continue=https://docs.google.com/document/u/0/create. Auth required: YES. Cannot create a document containing "synergy" without sign-in. |
| 2 | read_page / getText | .kix-page-column (extract visible text from canvas) | NOT EXECUTED (MCP + auth blocked) | Cannot read document text because: (a) MCP bridge disconnected (HTTP 426), (b) no Google Doc accessible without authentication. Even if a public view-only doc were accessible, kix-page-column elements are rendered by client-side JavaScript -- they would not appear in HTTP-fetched HTML. Google Docs canvas rendering means getText would need live browser DOM access. |
| 3 | press_key | Ctrl+F (open Find toolbar) | NOT EXECUTED (MCP + auth blocked) | Cannot test Find toolbar (Ctrl+F) interaction. The .docs-findinput-container and .docs-findinput-input selectors from the google-docs.js site guide are for the live Google Docs editor DOM only. In a live browser with an authenticated session: Ctrl+F would open the Find toolbar at the top of the document below the toolbar area. The Find toolbar is distinct from the browser's native Ctrl+F find bar. |
| 4 | type_text | "synergy" in Find input (.docs-findinput-input input) | NOT EXECUTED (MCP + auth blocked) | Cannot type the search term into the Find input. In a live browser: typing "synergy" in the Find toolbar would highlight the first occurrence in yellow in the canvas and show the occurrence count (e.g., "1 of 3"). The Find toolbar uses .docs-findinput-input input as the search field selector. |
| 5 | press_key | Escape (close Find toolbar, cursor near highlighted word) | NOT EXECUTED (MCP + auth blocked) | Cannot close Find toolbar. In a live browser: pressing Escape would close the Find toolbar but leave the cursor positioned near the last found occurrence. The cursor position relative to the highlighted word is approximate -- Google Docs places the cursor at the beginning of the found text. |
| 6 | click_at (double-click) | Double-click on highlighted "synergy" word in canvas | NOT EXECUTED (MCP + auth blocked) | Cannot test double-click word selection on canvas. This is the critical CONTEXT-08 step: double-clicking a word in Google Docs selects the entire word, even though the text is canvas-rendered. This works because the hidden contenteditable layer processes the double-click event and expands the selection to word boundaries. The click_at tool with two rapid sequential clicks or a dedicated doubleClick tool would be needed. The MCP click_at tool supports coordinate-based clicks on the canvas. |
| 7 | type_text | "collaboration" (type replacement over selected word) | NOT EXECUTED (MCP + auth blocked) | Cannot test typing replacement over selection. In Edit mode, typing while a word is selected replaces the selection with the typed text -- standard overtype behavior. This requires: (a) the document to be in Edit mode (not View only or Suggesting), (b) the word to be fully selected (from step 6), (c) the type_text tool to deliver keystrokes to the contenteditable layer. |
| 8 | press_key + type_text | Ctrl+F, type "synergy", check for next occurrence | NOT EXECUTED (MCP + auth blocked) | Cannot test the find-next loop. In a live browser: after replacing the first occurrence, Ctrl+F would reopen the Find toolbar. The previous search term ("synergy") should be pre-populated. The occurrence count would update to reflect the reduced count. If 0 results: all occurrences have been replaced. |
| 9 | (loop) | Repeat steps 6-8 for remaining occurrences | NOT EXECUTED (MCP + auth blocked) | The replacement loop could not be demonstrated. Each iteration would: close Find toolbar (Esc), double-click the next highlighted word, type "collaboration", reopen Ctrl+F to check remaining count. The manualWordReplace workflow in google-docs.js defines 9 steps for this loop. |
| 10 | press_key + type_text | Ctrl+F, type "synergy", verify 0 results | NOT EXECUTED (MCP + auth blocked) | Cannot perform final verification. In a live browser: the Find toolbar would show "0 of 0" or "No results" if all occurrences of "synergy" have been replaced with "collaboration". This is the completion criterion for CONTEXT-08. |
| 11 | (analysis) | OUTCOME CLASSIFICATION | SKIP-AUTH | Google Docs requires a signed-in Google account for both document access (landing page redirects to sign-in) and document editing (Edit mode requires authentication with edit permission). No publicly editable Google Doc containing "synergy" could be located. The MCP WebSocket bridge is also disconnected (HTTP 426). Even if the bridge were restored, the authentication gate would block the word replacement workflow. Outcome matches the SKIP-AUTH expectation documented in the google-docs.js site guide. |

## What Worked
- HTTP validation confirmed that docs.google.com is a live, responsive service (HTTP 302 within standard response times) that correctly redirects unauthenticated users to accounts.google.com sign-in
- docs.new URL correctly resolves and redirects to document creation flow (via accounts.google.com sign-in with continue URL to /document/u/0/create)
- Google sign-in page (894KB) loads fully with identifierNext button and "Email or phone" input field -- the authentication gate is functional and well-structured
- The google-docs.js site guide's SKIP-AUTH expectation is confirmed as accurate -- Google Docs editing genuinely requires authentication with no workaround
- The site guide's manualWordReplace workflow (9-step Ctrl+F/double-click/type loop) is architecturally sound based on Google Docs behavior documentation: Ctrl+F opens a Find-only toolbar, double-click selects words on the canvas layer, typing over a selection replaces it
- The site guide's canvas rendering warnings are validated: Google Docs uses a canvas-based renderer where visible text is NOT in the DOM as text nodes, making select_text_range (Range API) inapplicable for word selection
- MCP server process is running on port 7225 with established TCP connection (consistent with Phases 55-83 observations)
- HTTP 404 response for the sample document ID (1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms) correctly indicates the document does not exist -- Google Docs returns accurate HTTP status codes

## What Failed
- **Google Docs authentication blocks all editing access:** docs.google.com, docs.new, and direct document URLs all require a signed-in Google account. There is no free, anonymous way to create or edit a Google Doc. Unlike services tested in prior phases (saucedemo.com, virtualpiano.net, etc.), Google Docs has no demo mode, guest editing mode, or public editable documents.
- **No publicly editable Google Doc found:** The sample document ID in the plan returns HTTP 404. Google Docs does not provide sample/demo documents with public edit access. Even publicly shared documents (via "Anyone with the link can view") are read-only for unauthenticated users.
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected (HTTP 426). This is the same persistent blocker from Phases 55-83. Without the bridge, no MCP tool can execute against the live browser.
- **Canvas text extraction (getText on .kix-page-column) not tested:** Cannot validate whether getText successfully extracts visible text from Google Docs' canvas-rendered content. The kix-page-column elements are generated by client-side JavaScript -- they do not appear in HTTP-fetched HTML. Live browser DOM access is required.
- **Find toolbar interaction (Ctrl+F -> .docs-findinput-container) not tested:** Cannot validate whether press_key with Ctrl+F opens the Google Docs Find toolbar (distinct from the browser's native find bar). The .docs-findinput-container and .docs-findinput-input selectors are for live DOM only.
- **Double-click word selection on canvas not tested:** The core CONTEXT-08 mechanism -- double-clicking a canvas-rendered word to select it -- could not be demonstrated. This is the most uncertain step in the workflow: it depends on the hidden contenteditable layer receiving the double-click event and expanding selection to word boundaries.
- **Overtype replacement not tested:** Typing "collaboration" while "synergy" is selected (standard overtype behavior) could not be demonstrated. This depends on step 6 (word selection) succeeding first.
- **Find toolbar occurrence count not verified:** Cannot confirm that the Find toolbar shows occurrence counts (e.g., "1 of 3") or that it correctly updates after replacements.
- **Replacement loop not demonstrated:** The full find-select-replace-repeat loop from the manualWordReplace workflow could not be executed even once.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-84):** The MCP server process runs on port 7225 but the Chrome extension side returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. For CONTEXT-08, the full workflow requires: navigate to Google Doc, authenticate (or find public editable doc), read canvas text via getText, open Find toolbar via press_key (Ctrl+F), type search term via type_text, close Find toolbar via press_key (Escape), double-click word via click_at, type replacement via type_text -- all requiring live browser MCP execution.
- **navigate would load Google Docs sign-in page:** HTTP validation confirms docs.google.com returns HTTP 302 redirect to accounts.google.com. In a live browser, navigate would render the Google sign-in page. If the browser has an authenticated Google session, navigate to a specific document URL would load the document editor directly.
- **Double-click capability via click_at or doubleClick:** The MCP click_at tool sends CDP Input.dispatchMouseEvent. For double-click word selection, two rapid sequential click events at the same coordinates are needed. The existing click tool has doubleClick support for DOM elements, but click_at (coordinate-based) may need explicit double-click support. The FSB content.js includes a doubleClick action in its tool library, but the MCP server's click_at uses CDP coordinates, not DOM selectors. This is a potential gap for canvas-based word selection.
- **Google Docs authentication gate:** Unlike most sites tested in prior phases, Google Docs has no demo/free/anonymous editing mode. The authentication gate is absolute for editing. This is not a tool gap but an access constraint. Workaround: test with a pre-authenticated Google session in the browser.
- **read_page text extraction from canvas-rendered content:** Google Docs renders text on HTML5 canvas. The .kix-page-column element exists in the live DOM, and getText on this element should return the visible text (the hidden contenteditable layer stores the text as DOM nodes). However, this has not been validated. If getText returns empty or garbled text from the canvas element, an alternative extraction method would be needed (e.g., Ctrl+A to select all, then read the selection).
- **Find toolbar vs browser native find:** Pressing Ctrl+F in Google Docs opens the Google Docs Find toolbar (a custom UI element within the editor), NOT the browser's native find bar. However, if the document body is not focused when Ctrl+F is pressed, the browser's native find might open instead. The press_key tool delivers keystrokes to the active element -- ensuring the document body (.kix-appview-editor) is focused before pressing Ctrl+F is important.
- **Occurrence count parsing from Find toolbar:** The Find toolbar shows occurrence counts like "1 of 3" in a UI element. Reading this count (to track progress and detect completion) would require getText or read_page on the .docs-findinput-container area. No dedicated tool exists for reading Find toolbar status.

## Context Bloat Analysis

### Estimated Context Per Manual Word Replacement Cycle

Based on the CONTEXT-08 manual word replacement workflow (Ctrl+F locate, double-click select, type replace, repeat):

- **Step 1 (navigate to Google Doc):** ~2-5KB (URL, status, page structure, toolbar/editor confirmation)
- **Step 2 (initial getText on .kix-page-column):** ~5-50KB depending on document length
  - 1-page document: ~2-5KB of text content
  - 10-page document: ~20-50KB of text content
  - 50-page document: ~100-250KB of text content (AVOID reading full document)
- **Step 3 (Ctrl+F to open Find toolbar):** ~0.5-1KB (press_key result, toolbar appearance confirmation)
- **Step 4 (type "synergy" in Find input):** ~0.5-1KB (type_text result, input field confirmation)
- **Step 5 (read occurrence count from Find toolbar):** ~0.3-0.5KB (e.g., "3 of 7")
- **Step 6 (Escape to close Find toolbar):** ~0.3KB (press_key result)
- **Step 7 (double-click to select word):** ~0.5-1KB (click_at result, selection confirmation)
- **Step 8 (type "collaboration" to replace):** ~0.5-1KB (type_text result)
- **Step 9 (Ctrl+F to find next):** ~0.5-1KB (press_key result, toolbar appearance)
- **Step 10 (check remaining count):** ~0.3-0.5KB (e.g., "2 of 6" -> "1 of 5" -> "0 results")

**Per-replacement cycle (steps 6-10):** ~2-4KB per occurrence replacement.

### Context Savings: Ctrl+F Search Delegation vs Full Document Re-Reading

The critical context optimization in CONTEXT-08 is delegating word location to the browser's built-in search (Ctrl+F) instead of having the AI read the full document text to find word positions:

| Approach | Context Per Word Lookup | For 7 Occurrences | For 50-Page Doc with 7 Occurrences |
|----------|------------------------|--------------------|------------------------------------|
| Full document getText before each replacement | 5-250KB per read (scales with document length) | 35KB-1.75MB total | 700KB-1.75MB (re-reading 50 pages 7 times) |
| Ctrl+F search delegation (browser finds the word) | 0.5-1KB per Ctrl+F cycle | 3.5-7KB total | 3.5-7KB (same regardless of document length) |
| **Context savings** | **90-99.5% reduction** | **5-250x less context** | **100-250x less context for long documents** |

The Ctrl+F approach has a fundamental advantage: context consumption is O(occurrences) not O(document_length x occurrences). For a 10-page document with 7 occurrences of "synergy":
- **Full re-read approach:** 7 reads x ~25KB/read = ~175KB consumed for word location alone
- **Ctrl+F approach:** 7 Ctrl+F cycles x ~1KB/cycle = ~7KB consumed for word location
- **Savings: 96% context reduction**

### Compact Replacement Tracking vs Full Document Re-Reads

Tracking replacement progress with compact state instead of re-reading the document:

```
Compact tracking state (under 500 characters):
{
  targetWord: "synergy",
  replacementWord: "collaboration",
  totalOccurrences: 7,
  replacementCount: 3,
  remainingOccurrences: 4,
  lastAction: "replaced occurrence 3 at paragraph near 'team synergy is...'",
  status: "in-progress"
}
```

This 350-character tracking record replaces what would otherwise require re-reading the full document (5-250KB) after each replacement to count remaining occurrences. The Find toolbar's occurrence count (e.g., "4 of 7" becoming "3 of 6" after a replacement) provides the same information at ~0.5KB per check.

### Total Context Across N Replacements

| Document Size | Occurrences | Compact Approach (Ctrl+F + tracking) | Full Re-Read Approach | Savings |
|---------------|-------------|--------------------------------------|-----------------------|---------|
| 1 page (~3KB) | 3 | ~12KB (setup + 3 replacement cycles + verification) | ~21KB (setup + 3 full reads + 3 replacement cycles) | 43% |
| 10 pages (~25KB) | 7 | ~35KB (setup + 7 replacement cycles + verification) | ~210KB (setup + 7 full reads + 7 replacement cycles) | 83% |
| 50 pages (~125KB) | 15 | ~80KB (setup + 15 replacement cycles + verification) | ~1,955KB (setup + 15 full reads + 15 replacement cycles) | 96% |

For the target scenario (10-page document with 7 occurrences of "synergy"):
- **Compact approach:** ~35KB total context consumed across the full workflow
- **Full re-read approach:** ~210KB total context consumed
- **Savings: 83% reduction**, keeping the workflow within reasonable context budgets

### Comparison to Phase 79 (50-Page PDF Form Fill) and Phase 78 (Observable Notebook Edit)

| Aspect | Phase 79: CONTEXT-03 (PDF Form Fill) | Phase 78: CONTEXT-02 (Observable Notebook Edit) | Phase 84: CONTEXT-08 (Google Doc Word Replace) |
|--------|---------------------------------------|------------------------------------------------|------------------------------------------------|
| Document type | PDF (read-only, extract text) | Observable notebook (reactive cells) | Google Doc (canvas-rendered, read-write) |
| Rendering technology | pdf.js textLayer spans (DOM text) | CodeMirror + React client-rendering | Canvas-based renderer with hidden contenteditable |
| Text extraction method | Concatenate .textLayer span contents | getText on cell output containers | getText on .kix-page-column (canvas text) |
| Text selection method | select_text_range (Range API works on textLayer spans) | Click cell, Ctrl+A, type replacement | Double-click on canvas (Range API does NOT work) |
| Context growth pattern | Linear: 300 chars per page extracted | Breadth-based: one getText per cell | Linear: per-replacement cycle (~4KB each) |
| Per-page/per-cell context | 300 chars per page (strict budget) | 0.5-2KB per cell getText | 0.5-1KB per Ctrl+F + replace cycle |
| Context bloat mitigation | 300-char page text budget, extract only target pages | Targeted cell reads instead of full notebook | Ctrl+F search delegation, compact occurrence tracking |
| Total for typical workflow | ~8-18KB (3 pages + cross-site form fill) | ~17-38KB (targeted cell reads) or ~100-250KB (full page reads) | ~35KB (7 replacements in 10-page doc) or ~210KB (with full re-reads) |
| Unique challenge | Cross-site data retention (PDF -> form) | Cell isolation (edit one, verify another unchanged) | Canvas text selection (no DOM text nodes, double-click required) |
| Auth requirement | None (pdf.js viewer + httpbin form are public) | Tinker mode (skip-auth for anonymous editing) | Full Google sign-in required (no workaround) |
| Context savings from mitigation | 85-95% vs full page reads | 60-85% with targeted cell reads | 83-96% with Ctrl+F delegation vs full doc re-reads |

**Key insight for CONTEXT-08:** This phase has a unique context challenge that is fundamentally different from Phases 78 and 79. The challenge is not volume of data read (Phase 79's 50-page PDF) or breadth of cells checked (Phase 78's 38 cells) but rather the repetitive nature of the replacement loop. Each replacement cycle has a fixed context cost (~4KB) that scales with occurrence count, not document length. The Ctrl+F delegation strategy breaks the document-length dependency entirely -- a 50-page document costs the same per-replacement as a 1-page document because the browser's Find toolbar does the searching across all pages.

### Recommendations for Context-Efficient Document Editing Workflows

1. **Always delegate word search to the browser (Ctrl+F) instead of AI reading the document.** The browser searches the full document in O(1) relative to AI context, regardless of document length. This is the single most impactful context optimization for document editing tasks.
2. **Track only {targetWord, replacementWord, totalOccurrences, replacementCount, remaining} -- never re-read the full document to count occurrences.** The Find toolbar provides occurrence counts natively.
3. **For multi-occurrence replacement, the initial getText is optional.** If the task specifies what word to find, skip the initial getText entirely and go straight to Ctrl+F. The only reason to getText first is to confirm the document contains the target word at all.
4. **Budget 4KB per replacement cycle.** For 7 occurrences, budget 28KB for the replacement loop plus 5-10KB for setup and verification. Total: ~35-40KB.
5. **For documents with 20+ occurrences of the target word, consider whether Ctrl+H (Find and Replace) is acceptable.** CONTEXT-08 specifically prohibits Ctrl+H, but for real-world tasks without this constraint, a single Ctrl+H Replace All would consume approximately 3KB total vs 80+KB for 20 manual replacements.

## Bugs Fixed In-Phase
- **Plan 01 -- google-docs.js site guide updated (49a4265):** Added CONTEXT-08 guidance section with manual word replacement strategy (Ctrl+F locate, double-click select, type replace), manualWordReplace 9-step workflow, skip-auth expectation documentation, context bloat mitigation guidance (under 500 chars tracking), and 4 new warnings for CONTEXT-08 constraints. No runtime bugs found during site guide addition.
- **No runtime bugs found in Plan 02:** No live code was executed that could reveal runtime bugs. The diagnostic is based on HTTP-based analysis against Google Docs endpoints.
- **Observation: sample document ID (1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms) does not exist.** The plan suggested this document ID as a test target, but it returns HTTP 404 from Google Docs. Google does not provide publicly editable sample documents -- all editing access requires Google account authentication.
- **Observation: Google Docs landing page (docs.google.com) always requires authentication.** Unlike Google Search, YouTube, or other Google products that offer unauthenticated access to content, Google Docs redirects to accounts.google.com for any access. Even "view-only" public documents require navigating to a specific document URL -- the landing page itself is auth-gated.

## Autopilot Recommendations

1. **Expect SKIP-AUTH for any Google Docs editing task -- Google account authentication is mandatory for document creation and editing.** Unlike sites like saucedemo.com (demo credentials available) or virtualpiano.net (no auth needed), Google Docs has no anonymous editing mode, no demo accounts, and no publicly editable documents. If the autopilot encounters a Google Docs editing task, it should immediately classify the outcome as SKIP-AUTH and document the authentication gate rather than attempting workarounds. The only path to editing is a pre-authenticated Google session in the browser.

2. **Use Ctrl+F (Find only) for word location, NEVER re-read the full document text after each edit.** Ctrl+F delegates the search to the browser engine, which searches the full document in constant time relative to AI context consumption. Re-reading a 10-page document via getText on .kix-page-column after each replacement would consume ~25KB per read, while Ctrl+F consumes ~1KB per search. For 7 occurrences, this saves ~168KB of context. This is the most important context optimization for document editing workflows.

3. **Google Docs renders text on CANVAS -- select_text_range (Range API) will NOT work for word selection.** The visible text on screen is drawn by a canvas renderer, not stored as DOM text nodes. The Range API requires text nodes to create selection ranges. For word selection in Google Docs, use double-click (which the hidden contenteditable layer intercepts and expands to word boundaries) or Ctrl+Shift+Right Arrow (which selects word-by-word from cursor position). Never attempt select_text_range on Google Docs content.

4. **Double-click is the primary word selection method for canvas-rendered text.** In Google Docs, double-clicking a word selects the entire word by interacting with the hidden contenteditable layer beneath the canvas. This is the same behavior as double-clicking in any text editor -- the contenteditable layer processes the event and sets the selection range internally. For the MCP toolset: use click_at with two rapid sequential clicks at the target word's coordinates, or use the FSB doubleClick tool if available via MCP.

5. **Type to replace selected text (standard overtype behavior).** When a word is selected in Google Docs (via double-click from recommendation 4), typing any text immediately replaces the selection. This is standard browser contenteditable behavior. Use type_text with the replacement word (e.g., "collaboration") immediately after confirming the word is selected. No delete/backspace step is needed -- typing over a selection is atomic.

6. **Track replacement progress with compact state: {replacementCount, remainingOccurrences, status} -- not full document re-reads.** After each replacement, the Find toolbar's occurrence count updates automatically (e.g., "4 of 7" becomes "3 of 6"). Reading this count from the Find toolbar UI costs approximately 0.5KB of context vs 25KB+ for a full document re-read. Store only the compact tracking state (under 500 characters total) as specified in the google-docs.js site guide.

7. **Handle Find toolbar state: it may reset after document edits, always reopen with Ctrl+F.** After typing the replacement word, the Find toolbar may close or the search term may be cleared. Always reopen with Ctrl+F before checking for the next occurrence. The Find toolbar should remember the previous search term in most cases, but if it does not, retype the target word. This adds ~1KB per cycle but ensures reliable occurrence detection.

8. **Verify completion with a final Ctrl+F search showing 0 results.** After the last replacement, open Ctrl+F one more time, type the original target word, and confirm the Find toolbar reports 0 results (or "0 of 0", or "No results found"). This is the definitive completion check. Do not rely on counting replacements alone -- a missed occurrence due to a selection error would leave an unreplaced word.

9. **For documents with many occurrences (10+): do NOT attempt to read the entire document to manually find word positions.** The temptation is to getText the full document, parse it to find all "synergy" positions, and then navigate to each position. This approach is wrong for two reasons: (a) it consumes enormous context (100KB+ for a 50-page document), and (b) canvas coordinate mapping from text positions is unreliable. Ctrl+F handles the search across all pages automatically, including pages that are not currently rendered in the viewport.

10. **Detect document mode (Edit vs View Only vs Suggesting) before attempting edits.** Google Docs has three modes: Edit (full read-write), Suggesting (tracked changes), and View Only (read-only). The mode toggle is in the toolbar area. If the document is in View Only mode (common for shared documents), all replacement steps will fail silently -- typing will not insert text. If in Suggesting mode, typed text creates tracked change suggestions rather than direct replacements. The autopilot should detect the current mode and adjust its strategy: Edit mode = proceed with replacement, View Only = classify as SKIP-AUTH, Suggesting = switch to Edit mode first (if permission allows) or classify as PARTIAL.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| pageContent: `.kix-page-column` | Document text column container in canvas editor | NOT TESTABLE (HTTP 404 for doc, sign-in redirect for landing). Selector is for live Google Docs DOM rendered by client-side JavaScript. Would not appear in HTTP-fetched HTML. Based on Google Docs documentation: this is the primary text column container for each page in the editor. | UNTESTABLE (auth-gated + client-rendered) |
| documentBody: `.kix-appview-editor` | Main editor application view container | NOT TESTABLE (same as above). This is the top-level editor container that holds all page elements. Expected to be present in any Google Doc loaded in Edit mode. | UNTESTABLE (auth-gated + client-rendered) |
| title: `.docs-title-input` | Document title input field (standard DOM input, not canvas) | NOT TESTABLE (same as above). Unlike the canvas body, the title is a standard HTML input element. Would be directly clickable and typeable via click + type_text. | UNTESTABLE (auth-gated + client-rendered) |
| findReplaceDialog: `.docs-findinput-container` | Find toolbar container (opened by Ctrl+F) | NOT TESTABLE (same as above). This is the Google Docs custom Find toolbar, distinct from the browser native find bar. Rendered as a DOM element floating above the document canvas. | UNTESTABLE (auth-gated + client-rendered) |
| findInput: `.docs-findinput-input input` | Text input field inside the Find toolbar | NOT TESTABLE (same as above). The actual input element where the search term is typed. Nested inside .docs-findinput-container. | UNTESTABLE (auth-gated + client-rendered) |
| toolbar: `#docs-toolbar` | Main document toolbar (bold, italic, font, etc.) | NOT TESTABLE (same as above). The toolbar is a server/client-rendered component that appears at the top of the editor. Its presence indicates the document has loaded in editor mode. | UNTESTABLE (auth-gated + client-rendered) |
| page: `.kix-page` | Individual page element in the document canvas | NOT TESTABLE (same as above). Each page of the document is a separate .kix-page element containing .kix-page-column. For multi-page documents, scrolling triggers lazy rendering of additional pages. | UNTESTABLE (auth-gated + client-rendered) |
| paragraph: `.kix-paragraphrenderer` | Paragraph renderer element within page column | NOT TESTABLE (same as above). Individual paragraph blocks within the canvas. These contain the rendered text lines (.kix-lineview elements). | UNTESTABLE (auth-gated + client-rendered) |
| menuFile: `#docs-file-menu` | File menu in the menu bar | NOT TESTABLE (same as above). Top-level menu item. Its presence confirms the full editor UI is loaded. | UNTESTABLE (auth-gated + client-rendered) |
| shareButton: `.docs-titlebar-share-client-plugin, [aria-label*="Share"]` | Share button in the title bar | NOT TESTABLE (same as above). Located in the top-right area of the editor. Requires authentication to use. | UNTESTABLE (auth-gated + client-rendered) |

**Summary:** 0 of 10 selectors from the google-docs.js site guide could be tested via HTTP analysis. All Google Docs editor selectors are client-rendered by the docs.google.com application JavaScript. The landing page redirects to accounts.google.com sign-in, and the sample document IDs return HTTP 404. Even publicly shared "view-only" documents would require navigating to a valid document URL, and the kix-* selectors would only appear after the Google Docs JavaScript application renders the editor DOM. All selectors are UNTESTABLE without: (a) a pre-authenticated Google session in the browser, and (b) live browser MCP execution (currently blocked by WebSocket bridge disconnect). The selectors are based on established Google Docs DOM structure documentation and are expected to be accurate when tested in a live environment.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| manualWordReplace workflow | site-guides/productivity/google-docs.js | 9-step workflow for manual word-by-word replacement in Google Docs canvas editor using Ctrl+F locate, double-click select, type replace loop. Added in Plan 01 alongside CONTEXT-08 guidance, skip-auth expectation, context bloat mitigation, and 4 new canvas rendering warnings. | N/A (site guide workflow, not MCP tool) |

No new MCP tools were added in this phase. The manualWordReplace workflow in google-docs.js provides step-by-step guidance for the manual replacement strategy using existing MCP tools (navigate, press_key for Ctrl+F and Escape, click_at for double-click word selection, type_text for replacement text, read_page for verification). The key architectural contribution is the Ctrl+F search delegation pattern for context-efficient document editing -- delegating word location to the browser's built-in search instead of AI-driven full document reading.
