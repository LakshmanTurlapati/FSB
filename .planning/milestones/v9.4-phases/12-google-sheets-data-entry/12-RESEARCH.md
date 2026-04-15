# Phase 12: Google Sheets Data Entry - Research

**Researched:** 2026-02-23
**Domain:** Google Sheets canvas-based data entry via Chrome Extension automation
**Confidence:** HIGH (all critical paths verified against codebase)

## Summary

Phase 12 writes accumulated job data from the Phase 11 multi-site search into a Google Sheet. The data already exists in `chrome.storage.local` under the key `fsbJobAccumulator` and contains per-company job arrays with fields: title, location, applyLink, datePosted, description, company, extractedAt. The codebase already has a Google Sheets site guide with Name Box selectors, canvas-based editor detection, and CDP/keyboard-emulator typing paths. The implementation requires: (1) a Sheets data entry orchestrator in background.js that reads accumulated data and drives a new automation session, (2) prompt engineering telling the AI exactly what data to write and how (Name Box + Tab/Enter pattern), (3) a verification mechanism using the formula bar DOM element to read cell contents, and (4) progress overlay updates via the existing sendSessionStatus mechanism.

The main technical challenge is that Google Sheets is a canvas-based application where individual cells are not DOM elements. All data entry must go through the Name Box (`#t-name-box`) for navigation and CDP/keyboard-emulator for typing. Verification must read cell values from the formula bar (`#t-formula-bar-input`), which shows the content of the currently selected cell.

**Primary recommendation:** Build a "Sheets data entry session" that the multi-site orchestrator launches after finalizeMultiSiteSearch. The session uses getStoredJobs to retrieve accumulated data, injects it into the AI prompt as structured context, and lets the AI drive the Name Box + Tab/Enter workflow using existing tools. Verification reads the formula bar DOM text after navigating to each cell.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sheet setup flow
- Default: create a new sheet via direct URL (docs.google.com/spreadsheets/create) -- no homepage navigation
- If user says "I have a Sheets tab open": switch to the open tab, matched by URL pattern (docs.google.com/spreadsheets)
- If user provides a URL: open that URL in a new tab
- If no matching Sheets tab found when user claims one is open: fall back to creating a new sheet
- If multiple Sheets tabs open: AI picks the best match (most recent/first found)
- Auto-name the sheet from task context (e.g., "Job Search - SWE Internships - Feb 2026")
- Rename timing is flexible -- before or after data entry, no strict rule
- Stay on the Sheets tab after data entry is complete (don't switch back)
- Wait for DOM signals (toolbar visible, grid rendered) before starting data entry -- no fixed delays
- If Google login wall is detected: use FSB's existing login handling flow

#### Column layout and ordering
- Default columns (in order): Title, Company, Location, Date, Description, Apply Link
- All 6 columns appear by default unless user explicitly requests different columns
- When adapting to existing sheet: read existing headers and AI fuzzy-matches fields (e.g., "Role" maps to Title, "Firm" maps to Company)
- When adapting to existing sheet: append below existing data, matching the existing format
- Short header labels: Title, Company, Location, Date, Description, Apply Link
- Apply Link column uses clickable HYPERLINK formula (not raw URL text)
- Missing data shows "N/A" placeholder (not blank cells)
- Description column contains high-quality condensed summary: preserves all key info (requirements, skills, level, team) without filler text, single paragraph, no newlines

#### Cell navigation pattern
- Dynamic strategy: Name Box + Tab for blank sheets (fast sequential fill), Name Box per cell for editing existing sheets (precision)
- AI decides input method based on context: type directly for values, formula bar for calculations/formulas
- Cell values are clean single-line text (summaries are already condensed paragraphs)
- Two-pass verification: verify each row after writing it, plus final full-sheet validation once all rows complete

#### Error handling and progress
- Per-cell retry on verification failure: re-navigate to the specific wrong cell and retype (not whole row)
- If retry fails twice for same cell: skip it, continue with other rows, report skipped cells at the end
- Final validation finds misalignment: fix in-place (self-healing) rather than reporting to user
- Batch progress updates shown in the visual overlay only (e.g., "Written 10/25 rows...") -- no per-row chat messages

### Claude's Discretion
- Exact batch update frequency (every 5 or 10 rows)
- Sheet rename timing (before or after data entry)
- Tab vs Name Box switching threshold for existing sheets
- HYPERLINK formula format details

### Deferred Ideas (OUT OF SCOPE)
- "Pause automation and ask follow-up questions" capability: user wants the AI to be able to pause mid-workflow, ask a clarifying question, and resume based on the answer. This is an architectural feature that would need a settings toggle. Captured for future phase.
</user_constraints>

## Standard Stack

This phase uses NO external libraries. Everything is built with existing FSB infrastructure.

### Core (Existing Infrastructure)
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| KeyboardEmulator | `utils/keyboard-emulator.js` | CDP-based keystroke delivery via `chrome.debugger` | Already handles typeText, pressKey, sendSpecialKey for all keys including Tab/Enter |
| Google Sheets site guide | `site-guides/productivity/google-sheets.js` | Name Box selectors, workflows, canvas warnings | Already registered with patterns, selectors, workflows, warnings |
| Canvas editor detection | `content/messaging.js:217` | `isCanvasBasedEditor()` detects `docs.google.com` hostname | Already triggers CDP typing path in `type` tool |
| CDP text insertion | `background.js:handleCDPInsertText()` | Debugger-based text input for canvas editors | Already handles clearFirst, Select All, Backspace patterns |
| Multi-tab actions | `background.js:handleMultiTabAction()` | openNewTab, switchToTab, listTabs, waitForTabLoad | Already background-handled, needed for sheet tab management |
| Background data tools | `background.js:handleBackgroundAction()` | storeJobData, getStoredJobs from `chrome.storage.local` | Job data retrieval for Sheets entry |
| Visual overlay | `content/visual-feedback.js:ProgressOverlay` | Shadow DOM overlay with phase/step/status display | Already supports progress updates via sendSessionStatus |
| Automation loop | `background.js:startAutomationLoop()` | AI-driven iteration with DOM analysis and action execution | Core automation engine, reused for Sheets data entry |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `sendSessionStatus()` | Push overlay updates to content script | Batch progress: "Written 10/25 rows..." |
| `persistSession()` | Save session state to survive SW restarts | Between row batches for crash recovery |
| Site guide registry | Pattern-matched guidance injection | Google Sheets guide auto-loads when URL matches |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI-driven data entry | Programmatic Sheets API | Sheets API requires OAuth and server -- massively out of scope |
| CDP typeText | DOM input events | DOM events fail on canvas editors (Google Sheets, Docs) -- CDP is the only reliable path |
| Formula bar verification | Visual screenshot comparison | Screenshot analysis requires vision model -- adds latency and cost |

## Architecture Patterns

### Recommended Changes (by file)
```
background.js          # Sheets data entry orchestrator, new background tool writeToSheet
ai/ai-integration.js   # Sheets-specific prompt injection with structured job data
site-guides/productivity/google-sheets.js  # Enhanced with data entry workflow details
```

### Pattern 1: Sheets Data Entry as a New Automation Session
**What:** After multi-site search finishes (or when user explicitly triggers Sheets entry), launch a new automation session with the task "Write job data to Google Sheets" and inject the accumulated job data into the AI prompt context.
**When to use:** Always -- this is the primary flow.
**Why:** Reuses the existing automation loop (AI decides actions, DOM analysis, action execution, iteration). The AI already knows how to use Name Box + Tab + type tools from the Google Sheets site guide. We just need to give it the data and explicit instructions.

**Example flow:**
```
1. User's original multi-site task completes
2. finalizeMultiSiteSearch sets session.multiSiteResult
3. New code: detect that accumulated data exists + user task implies Sheets write
4. Launch new session: task="Write accumulated job data to Google Sheet"
5. AI receives: system prompt with Sheets guidance + injected job data array
6. AI actions: navigate to sheets.new -> wait for load -> Name Box A1 -> type headers -> Tab/Enter pattern for data rows
7. Each row verified by navigating to A[N] and reading formula bar
8. Session completes when all rows written and validated
```

### Pattern 2: Structured Data Injection into AI Prompt
**What:** Retrieve job data from `fsbJobAccumulator` in chrome.storage.local, serialize as a compact but complete table, and inject into the system prompt so the AI has all values available without needing to call getStoredJobs.
**When to use:** First iteration of the Sheets data entry session.
**Why:** Eliminates a round-trip tool call. The AI has the data immediately and can plan the full write sequence. The data is already structured with all required fields.

**Data format for prompt injection:**
```javascript
// Retrieved from chrome.storage.local fsbJobAccumulator
const accumulated = await chrome.storage.local.get('fsbJobAccumulator');
const jobs = Object.values(accumulated.companies).flatMap(c => c.jobs || []);

// Compact table format for prompt
const jobTable = jobs.map((j, i) =>
  `${i+1}. Title: ${j.title || 'N/A'} | Company: ${j.company || 'N/A'} | Location: ${j.location || 'N/A'} | Date: ${j.datePosted || 'N/A'} | Description: ${(j.description || 'N/A').substring(0, 200)} | ApplyLink: ${j.applyLink || 'N/A'}`
).join('\n');
```

### Pattern 3: Two-Phase Verification via Formula Bar DOM Read
**What:** After writing each row, navigate back to the first cell of that row using the Name Box, then read the formula bar's text content to verify the value. Use getText on `#t-formula-bar-input` or `.cell-input`.
**When to use:** After each row (per-row verification) and after all rows (final validation).
**Why:** Google Sheets canvas cells are not DOM elements, but the formula bar IS a real DOM element that shows the currently selected cell's content. Navigating to a cell via Name Box and reading the formula bar is the only reliable DOM-based verification path.

**Verification sequence:**
```
1. Navigate to cell A[row] via Name Box
2. Read formula bar text (getText on #t-formula-bar-input)
3. Compare with expected value
4. If mismatch: re-type the correct value
5. Move to next cell (Tab) and repeat
6. After all cells in row verified, move to next row
```

### Pattern 4: HYPERLINK Formula Entry via Formula Bar
**What:** For the Apply Link column, type the HYPERLINK formula (e.g., `=HYPERLINK("https://...", "Apply")`) into the formula bar rather than directly into the cell. This ensures Sheets interprets it as a formula.
**When to use:** Apply Link column for every row.
**Why:** Typing `=HYPERLINK(...)` directly into a cell via CDP works -- Sheets processes formulas starting with `=`. The AI should type the formula as cell content and press Tab to confirm. The formula bar approach is an option if direct entry doesn't work, but direct entry should be tried first.

**Formula format:**
```
=HYPERLINK("https://careers.example.com/apply/123", "Apply")
```
- URL in double quotes
- Display text "Apply" (short, consistent)
- The formula bar will show the formula; the cell will show "Apply" as a clickable link

### Pattern 5: Sheet Creation via Direct URL
**What:** Navigate to `https://docs.google.com/spreadsheets/create` to create a new blank sheet directly, bypassing the Sheets home page.
**When to use:** Default flow when no existing sheet is specified.
**Why:** Avoids the Sheets home page which requires clicking a template. The `/create` URL opens a new blank sheet immediately. Alternative: `sheets.new` redirects to the same endpoint.

**Readiness detection:**
```
Wait for: #t-name-box visible AND #docs-toolbar visible
These DOM elements appear only after the sheet is fully loaded and ready for interaction.
```

### Anti-Patterns to Avoid
- **Clicking the canvas grid:** Individual cells are rendered on a canvas element. Coordinate-based clicking is unreliable due to zoom levels, scroll position, and column/row resizing. ALWAYS use Name Box navigation.
- **Fixed delays for Sheets load:** Google Sheets load time varies. Use `waitForElement` on `#t-name-box` and `#docs-toolbar` instead of fixed timeouts.
- **Sending data line-by-line to AI:** Inject ALL job data in the first prompt. Do not make the AI call getStoredJobs -- provide data upfront to save iterations.
- **DOM-based cell value reading:** Do not try to find cell content in the DOM tree. The grid is canvas-rendered. Use formula bar text extraction only.
- **Typing formulas without escaping:** If a cell value accidentally starts with `=`, Sheets will interpret it as a formula. Prefix with a single quote `'` to force text mode (not needed for most job data, but important for edge cases).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keystroke delivery | Custom DOM events for Sheets | Existing KeyboardEmulator via `keyboardDebuggerAction` message | CDP keystrokes are the only reliable input method for canvas-based editors |
| Sheet creation | Homepage navigation + template click | Direct URL `docs.google.com/spreadsheets/create` | Single navigation action, no template selection needed |
| Cell navigation | Arrow key sequences or coordinate clicks | Name Box (`#t-name-box`) + type cell ref + Enter | Name Box is the only reliable cell navigation for canvas apps |
| Tab/Enter key presses | DOM KeyboardEvent dispatch | `keyPress` tool with `useDebuggerAPI: true` | Content script keyPress already routes to background KeyboardEmulator |
| Progress overlay | Custom DOM injection | Existing `sendSessionStatus()` + ProgressOverlay | Shadow DOM overlay already handles all display logic |
| Job data retrieval | New API or message | `chrome.storage.local.get('fsbJobAccumulator')` | Data is already there from Phase 11 |

**Key insight:** Every mechanical component (keyboard input, tab management, DOM waiting, progress display) already exists in the codebase. Phase 12 is primarily an orchestration and prompt engineering task, not a new infrastructure task.

## Common Pitfalls

### Pitfall 1: Name Box Click Does Not Select Text
**What goes wrong:** Clicking the Name Box (`#t-name-box`) does not always select the existing text (e.g., "A1"). If the click doesn't select, typing a new cell reference appends to the existing text instead of replacing it.
**Why it happens:** The Name Box is an `<input>` element, but Google Sheets may handle focus/selection events differently depending on whether the sheet is in edit mode or navigation mode.
**How to avoid:** After clicking the Name Box, send a Select All keystroke (`Ctrl+A`) to select all text, THEN type the new cell reference. Alternatively, triple-click to select all text in the input.
**Warning signs:** Cell navigation lands on wrong cell.

### Pitfall 2: Tab Key Not Advancing to Next Column
**What goes wrong:** After typing a value, pressing Tab does not move to the next cell. The value stays in the current cell or the Tab key gets captured by another element.
**Why it happens:** If the cell is still in "edit mode" (formula bar active, cursor blinking in cell), Tab may insert a tab character. The cell needs to be "confirmed" first.
**How to avoid:** After typing the cell value, press Enter first to confirm the value, THEN press Tab to move. Or rely on the default behavior where Tab confirms AND moves right.
**Warning signs:** Tab characters appearing in cell content; cursor not moving.

### Pitfall 3: HYPERLINK Formula Treated as Text
**What goes wrong:** The `=HYPERLINK(...)` formula is displayed as literal text instead of being interpreted as a formula.
**Why it happens:** If the cell is in a specific edit state or if the leading `=` is not the first character typed into the cell, Sheets may not interpret it as a formula.
**How to avoid:** Ensure the cell is empty before typing the formula. Use Name Box to navigate to the cell, then type the formula starting with `=`. Press Tab or Enter to confirm. The cell should display "Apply" as a clickable link.
**Warning signs:** Cell shows the raw formula text; formula bar shows the text with a leading `'` (text prefix).

### Pitfall 4: Description Text with Special Characters
**What goes wrong:** Descriptions containing quotes, commas, or formula-triggering characters (`=`, `+`, `-`) cause unexpected behavior when typed into cells.
**Why it happens:** Google Sheets interprets `=` as formula start, `+` and `-` as numeric or formula. Quotes can break CDP text insertion.
**How to avoid:** Sanitize description text before typing: escape or remove leading `=`, `+`, `-`, `@` characters by prefixing with a space or single quote. The AI prompt should instruct this explicitly.
**Warning signs:** #ERROR! in cells, formula parse errors, truncated text.

### Pitfall 5: Sheets Readiness Detection Fails
**What goes wrong:** The automation starts typing before Google Sheets is fully loaded, causing keystrokes to be lost.
**Why it happens:** Sheets loads progressively -- the toolbar may appear before the grid is interactive. `#t-name-box` may exist in DOM before it's functional.
**How to avoid:** Wait for both `#t-name-box` AND `#docs-toolbar` to be visible and enabled. Additionally, try clicking the Name Box and checking if it responds (text becomes selected) before proceeding.
**Warning signs:** Typed text appearing in the address bar or nowhere; Name Box showing stale reference.

### Pitfall 6: Service Worker Restart Mid-Entry
**What goes wrong:** Chrome terminates the background service worker during data entry. Session state is lost.
**Why it happens:** MV3 service workers have a 5-minute idle timeout. During Sheets entry, there might be long pauses between AI iterations.
**How to avoid:** Call `persistSession()` after each row batch. Store progress in session state (current row index). On restart, resume from the last persisted row.
**Warning signs:** Overlay disappears, automation stops mid-sheet.

### Pitfall 7: Sheet Rename After Data Entry Fails
**What goes wrong:** The sheet title click/rename does not work after data entry because the cursor is in a cell.
**Why it happens:** Google Docs/Sheets title elements have specific activation patterns. The title bar may not respond to clicks if an in-cell edit is active.
**How to avoid:** Press Escape to exit any cell edit mode before attempting to rename. Then click the title element. The title element selector should be the input at the top of the page (Google Docs title bar).
**Warning signs:** Title stays as "Untitled spreadsheet" after rename attempt.

### Pitfall 8: Multiple Debugger Attachment Conflicts
**What goes wrong:** CDP operations fail because another debugger is already attached.
**Why it happens:** The KeyboardEmulator attaches the debugger, but cdpInsertText also needs to attach. If one doesn't detach properly, the other fails.
**How to avoid:** The existing `handleCDPInsertText` already handles "Another debugger is already attached" by force-detaching. The `handleKeyboardDebuggerAction` detaches after each operation (line 9694). Ensure typeText and pressKey alternate cleanly.
**Warning signs:** CDP errors in console, "Another debugger is already attached" messages.

## Code Examples

### Example 1: Reading Accumulated Job Data in Background Script
```javascript
// Source: background.js handleBackgroundAction, verified in codebase
async function getAccumulatedJobData() {
  const stored = await chrome.storage.local.get('fsbJobAccumulator');
  const accumulator = stored.fsbJobAccumulator;

  if (!accumulator || !accumulator.companies) {
    return { jobs: [], totalJobs: 0, searchQuery: '' };
  }

  const allJobs = Object.values(accumulator.companies)
    .filter(entry => entry.status === 'completed' && Array.isArray(entry.jobs))
    .flatMap(entry => entry.jobs);

  return {
    jobs: allJobs,
    totalJobs: allJobs.length,
    searchQuery: accumulator.searchQuery || '',
    companies: Object.keys(accumulator.companies)
  };
}
```

### Example 2: Job Data Object Schema (from storeJobData)
```javascript
// Source: ai-integration.js TOOL_DOCUMENTATION.data.storeJobData, verified
// Each job object in the accumulator has these fields:
{
  title: "Software Engineer Intern",      // from AI extraction
  location: "Seattle, WA",               // from AI extraction
  applyLink: "https://careers.example.com/apply/123",  // from AI extraction
  datePosted: "2026-02-15",              // from AI extraction
  description: "Design and implement...", // from AI extraction (condensed summary)
  company: "Microsoft",                  // injected by handleBackgroundAction
  extractedAt: 1708900000000             // injected by handleBackgroundAction (Date.now())
}
```

### Example 3: Name Box Navigation Sequence (Existing Tools)
```javascript
// AI action sequence for navigating to cell B5:
[
  { "tool": "click", "params": { "ref": "e1" } },  // e1 = Name Box element
  { "tool": "type", "params": { "ref": "e1", "text": "B5", "pressEnter": true } },
  // Cell B5 is now selected, ready for input
  { "tool": "type", "params": { "ref": "e1", "text": "Cell content here" } },
  { "tool": "keyPress", "params": { "key": "Tab" } }  // Move to C5
]
```

### Example 4: HYPERLINK Formula Entry
```javascript
// AI types this into the Apply Link column cell:
{ "tool": "type", "params": {
    "ref": "e1",  // Name Box or formula bar
    "text": "=HYPERLINK(\"https://careers.microsoft.com/apply/123\", \"Apply\")"
  }
}
// Press Tab to confirm and move to next cell
{ "tool": "keyPress", "params": { "key": "Tab" } }
```

### Example 5: Verification via Formula Bar Read
```javascript
// Navigate to cell A2 and verify content:
{ "tool": "click", "params": { "ref": "e1" } },  // Click Name Box
{ "tool": "type", "params": { "ref": "e1", "text": "A2", "pressEnter": true } },
// Now read the formula bar to see what's in A2:
{ "tool": "getText", "params": { "ref": "e2" } }  // e2 = formula bar input
// Compare returned text with expected value
```

### Example 6: Sheet Creation URL (Direct)
```javascript
// Navigate to create a new blank sheet
{ "tool": "navigate", "params": { "url": "https://docs.google.com/spreadsheets/create" } }
// Alternative: sheets.new
// Wait for sheet to be ready
{ "tool": "waitForElement", "params": { "selector": "#t-name-box", "timeout": 15000 } }
```

### Example 7: Prompt Injection Format for Job Data
```javascript
// Injected into system prompt when Sheets data entry session starts:
const sheetsDirective = `
SHEETS DATA ENTRY TASK:
You have ${jobs.length} job listings to write into Google Sheets.
Column order: Title | Company | Location | Date | Description | Apply Link

DATA TO WRITE:
Row 2: Title: "SWE Intern" | Company: "Microsoft" | Location: "Redmond, WA" | Date: "2026-02-15" | Description: "Design and implement cloud services..." | ApplyLink: =HYPERLINK("https://careers.microsoft.com/123","Apply")
Row 3: Title: "DevOps Engineer" | Company: "Google" | Location: "Mountain View, CA" | Date: "2026-02-10" | Description: "Build CI/CD pipelines..." | ApplyLink: =HYPERLINK("https://careers.google.com/456","Apply")
...

PROCEDURE:
1. Navigate to Name Box, type "A1", press Enter
2. Type "Title", press Tab
3. Type "Company", press Tab
4. Type "Location", press Tab
5. Type "Date", press Tab
6. Type "Description", press Tab
7. Type "Apply Link", press Enter (moves to row 2, col A)
8. For each data row: type value, Tab, type value, Tab, ..., Enter
9. For Apply Link column: type the HYPERLINK formula
10. After every row, verify by navigating back to the first cell and reading formula bar
`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Sheets API (OAuth + server) | CDP keyboard emulation via browser extension | Always (FSB design) | No OAuth needed, no server, works with user's existing Google session |
| Clicking individual cells | Name Box + Tab/Enter navigation | Google Sheets canvas migration (2020+) | Canvas grid makes DOM clicks impossible; Name Box is the only reliable path |
| Fixed delays between keystrokes | `waitForElement` + `waitForDOMStable` | FSB v0.1.2 (Jan 2025) | 50-70% faster, adaptive to actual page state |
| Single-shot text insertion | CDP `Input.dispatchKeyEvent` per character | FSB v9.0.2 | Reliable keystroke delivery even in canvas editors |

## Discretion Recommendations

### Batch Update Frequency: Every 5 Rows
**Recommendation:** Update the progress overlay every 5 rows (e.g., "Written 5/25 rows...", "Written 10/25 rows...").
**Rationale:** 5 rows is frequent enough to show progress without being noisy. With 6 columns per row, 5 rows = 30 cells = roughly 30-60 seconds of typing. Updates less frequent than every 5 rows would make the overlay feel stale.

### Sheet Rename Timing: After Data Entry
**Recommendation:** Rename the sheet AFTER data entry is complete, as the final step before marking the task complete.
**Rationale:** Renaming first requires navigating to the title element, typing, pressing Enter, then navigating back to the grid. Doing this after data entry avoids interrupting the typing flow. If data entry fails partway, the sheet still has a default name ("Untitled spreadsheet") which is acceptable.

### Tab vs Name Box Threshold: Use Tab for Sequential, Name Box for Random Access
**Recommendation:** When entering data into a blank sheet, use Tab to advance columns and Enter to advance rows (sequential fill). Only use Name Box navigation when: (a) fixing a verification error in a specific cell, (b) appending to an existing sheet where the starting row is not row 1, or (c) jumping to a non-adjacent cell.
**Rationale:** Tab/Enter is faster (one keystroke vs. click + type ref + Enter) and more reliable for sequential entry. Name Box navigation is 3 actions per cell jump.

### HYPERLINK Formula Format
**Recommendation:** Use `=HYPERLINK("url","Apply")` with the display text "Apply" for all rows. This keeps the column width manageable and provides a consistent clickable label.
**Rationale:** Using the full URL as display text would create very wide columns. Using the job title would be redundant with the Title column. "Apply" is short, descriptive, and consistent.

## Open Questions

### 1. How to Trigger the Sheets Session
**What we know:** After `finalizeMultiSiteSearch`, the session completes with `session.multiSiteResult` containing a text summary. The existing flow ends the session at that point.
**What's unclear:** Should the Sheets entry be: (a) a continuation of the same session (reset iterations, change task), (b) a new separate session, or (c) triggered by the user sending a follow-up message?
**Recommendation:** Option (a) -- extend the multi-site orchestrator to detect that Sheets entry is needed and rewrite the task for a Sheets entry phase, similar to how it rewrites tasks for each company. This avoids requiring user interaction. The user's original task ("find SWE internships at Microsoft, Google, Amazon") implicitly includes writing results to a sheet. Add a flag like `session.multiSite.sheetsEntryPending = true` that triggers after finalization. However, the planner should decide the exact trigger mechanism. If the user doesn't want Sheets, their task won't include Sheets-related keywords.

### 2. Existing Sheet Detection for Append Mode
**What we know:** The user may say "I have a Sheets tab open." The AI can use `listTabs` to find Sheets tabs.
**What's unclear:** How does the AI read existing headers from a sheet? It would need to navigate to A1 and read each header cell via formula bar, then determine the first empty row.
**Recommendation:** When appending to an existing sheet, the AI should: (1) Navigate to A1 via Name Box, (2) Read formula bar text, (3) Tab to B1, read, (4) Continue until empty cell or known headers matched, (5) Navigate to first empty row via Name Box (e.g., A[N] where N is detected by scrolling or using Ctrl+End). This is a multi-iteration AI task that fits naturally in the automation loop.

### 3. Large Job Counts and Token Limits
**What we know:** The AI prompt has context limits. With 25 jobs at ~150 chars each for the compact table, that's ~3750 chars. With 100 jobs, that's ~15000 chars.
**What's unclear:** At what job count does the injected data exceed practical prompt limits?
**Recommendation:** For jobs <= 50, inject all data into the prompt. For jobs > 50, split into batches and use multiple sessions or inject the first 50 with a note that more data is available via getStoredJobs. The typical multi-site career search yields 15-50 jobs, so this edge case is unlikely but should be handled.

## Sources

### Primary (HIGH confidence)
- `background.js:6861-6939` -- handleBackgroundAction with storeJobData/getStoredJobs implementation
- `background.js:6764-6851` -- finalizeMultiSiteSearch with dedup and summary
- `site-guides/productivity/google-sheets.js` -- Full Google Sheets site guide with selectors and workflows
- `content/messaging.js:217-225` -- isCanvasBasedEditor detection
- `content/actions.js:1538-2354` -- type tool with canvas editor CDP path
- `content/actions.js:3134-3174` -- keyPress tool with debugger API
- `utils/keyboard-emulator.js` -- Full KeyboardEmulator class with typeText, pressKey, pressKeySequence
- `background.js:9649-9722` -- handleKeyboardDebuggerAction handler
- `ai/ai-integration.js:15-100` -- TOOL_DOCUMENTATION with all tool schemas
- `ai/ai-integration.js:230-234` -- Existing "WRITING TO GOOGLE SHEETS" prompt guidance

### Secondary (MEDIUM confidence)
- Google Sheets direct create URL: `docs.google.com/spreadsheets/create` and `sheets.new` -- verified via web search ([dirask.com](https://dirask.com/posts/Google-Sheets-create-new-sheet-by-URL-pzomaj), [qz.com](https://qz.com/work/1441913))
- HYPERLINK formula syntax: `=HYPERLINK(url, label)` -- verified via [Google support docs](https://support.google.com/docs/answer/3093313)
- Google Sheets URL tricks for direct creation -- verified via [benlcollins.com](https://www.benlcollins.com/spreadsheets/url-tricks-for-google-sheets/)

### Tertiary (LOW confidence)
- Formula bar DOM element `#t-formula-bar-input` for reading cell values -- selector from site guide, behavior inferred from Google Sheets architecture (canvas grid + DOM toolbar). Live validation recommended.
- Sheet title element for rename -- not yet identified in DOM. The Google Docs title pattern (aria-label "Rename" or value "Untitled document") may apply but needs live inspection for Sheets.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components verified in codebase, no new libraries needed
- Architecture: HIGH -- orchestration follows established multi-site pattern, prompt injection follows career augmentation pattern
- Pitfalls: HIGH -- canvas-based editing pitfalls well-documented in site guide and codebase comments
- Verification: MEDIUM -- formula bar reading approach is logical but needs live testing
- Sheet rename: LOW -- exact DOM selector for Sheets title not yet identified

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable -- no external dependencies to version-track)
