# Phase 13: Google Sheets Formatting - Research

**Researched:** 2026-02-23
**Domain:** Google Sheets formatting automation via Chrome Extension (keyboard shortcuts, toolbar menus, menu navigation)
**Confidence:** HIGH (formatting operations verified against Google official docs and codebase patterns)

## Summary

Phase 13 applies professional formatting to a Google Sheet after Phase 12 data entry completes. The formatting operations fall into three categories by implementation difficulty: (1) keyboard shortcut operations (bold, alignment, borders -- reliable, well-documented), (2) menu navigation operations (freeze rows, alternating colors -- requires clicking menus or using the tool finder), and (3) toolbar button operations (fill color, text color -- requires clicking toolbar buttons and color pickers with dynamically-generated DOM selectors). The codebase already has all the mechanical tools needed: `keyPress` with debugger API, `click` with selector cascading, `type` for text entry, and the Google Sheets site guide with menu/toolbar selectors.

The primary challenge is that Google Sheets toolbar buttons (fill color, text color, borders) have DOM selectors that change across product updates. The STATE.md blocker explicitly calls this out: "Google Sheets toolbar aria-labels must be inspected live during Phase 13 (color formatting selectors change with product updates)." The recommended approach is to use a two-tier strategy: keyboard shortcuts first for operations that support them, and the Alt+/ tool finder (search-the-menus) for operations that require toolbar/menu interaction. The tool finder is a text-based search that opens a menu item by name -- it avoids brittle aria-label selectors entirely.

The implementation pattern follows Phase 12's orchestrator model: intercept the Sheets data entry completion, launch a new "formatting pass" session with formatting-specific AI prompt directives, and let the AI execute formatting actions through the existing automation loop.

**Primary recommendation:** Build a Sheets formatting orchestrator that auto-triggers after data entry completion (intercept at the `session.sheetsData` completion handler). Use keyboard shortcuts for bold (Ctrl+B), center alignment (Ctrl+Shift+E), and borders (Shift+Alt+3). Use the Format > Alternating Colors menu (via Alt+/ tool finder typing "Alternating colors") for zebra striping with custom colors. Use View > Freeze > 1 row (via menu clicks or Alt+/ tool finder typing "Freeze"). Use right-click > "Resize columns" > "Fit to data" for column auto-sizing. All operations are AI-driven through the existing automation loop with formatting-specific prompt injection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Header styling
- Dark charcoal/black background with white bold text -- maximum contrast
- Center-aligned header text (data rows remain left-aligned)
- Thin bottom border below the header row for visual separation
- Freeze row 1 only (not column A) so header stays visible when scrolling

#### Color scheme / row styling
- Alternating row colors: white and light gray (zebra striping) for scannability
- Apply link column gets blue text color to signal clickability
- ADAPTIVE: If the sheet already has data and an existing formatting pattern, detect and follow that pattern rather than overriding with defaults. The dark header / alternating gray / blue links scheme is the default for fresh sheets only.

#### Column sizing
- Auto-fit columns with sensible max widths -- cap description at ~300px, links at ~250px to prevent excessively wide columns
- Text wrap enabled but balanced -- rows should stay at 2-3 lines max, not become excessively tall
- Apply link column: convert raw URLs to clickable hyperlinks displaying "Apply" as the link text -- keeps column narrow and clean

#### Formatting sequence
- Formatting runs as a separate pass AFTER all data entry completes
- Auto-triggers when data entry finishes -- seamless end-to-end workflow, no separate user command needed
- Keyboard shortcuts first (Ctrl+B for bold, etc.) -- use toolbar menus only when no shortcut exists (fill color, freeze)
- If sheet already has formatting: detect and adapt rather than overriding

### Claude's Discretion
- Exact hex values for dark charcoal header and light gray alternating rows
- How to detect existing formatting patterns (read cell styles vs heuristic)
- Order of formatting operations (select all data first, or format section by section)
- Hyperlink conversion mechanics (HYPERLINK formula insertion approach)
- How to handle edge cases (empty sheets, single-row data, very wide datasets)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

This phase uses NO external libraries. Everything is built with existing FSB infrastructure plus Google Sheets native keyboard shortcuts and menu navigation.

### Core (Existing Infrastructure)
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| KeyboardEmulator | `utils/keyboard-emulator.js` | CDP-based keystroke delivery for Ctrl+B, Ctrl+Shift+E, etc. | Already handles pressKey with modifiers, used extensively in Phase 12 |
| Google Sheets site guide | `site-guides/productivity/google-sheets.js` | Menu selectors, Name Box, toolbar identifiers | Already registered; needs formatting workflow additions |
| keyPress tool | `content/actions.js:3134` | Keyboard shortcut execution with debugger API fallback | Supports ctrlKey, shiftKey, altKey, metaKey modifiers |
| click tool | `content/actions.js:1033` | Toolbar/menu button clicks with selector cascade | Supports coordinate fallback for dynamic selectors |
| type tool | `content/actions.js` | Text input for tool finder search, hex codes, menu items | CDP path for canvas editors |
| Automation loop | `background.js:startAutomationLoop()` | AI-driven iteration with DOM analysis | Reused for formatting pass (same pattern as data entry session) |
| Session management | `background.js:session.sheetsData` | Sheets context tracking through session lifecycle | Needs extension for formatting state |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `sendSessionStatus()` | Push overlay updates ("Formatting sheet...") | Progress updates during formatting pass |
| `persistSession()` | Save state to survive SW restarts | Between formatting operations |
| `detectTaskType()` | Task type detection for tool selection | Already returns 'multitab' for Sheets tasks |
| isMac detection | `content/actions.js:1627` | Platform-aware keyboard shortcuts (Ctrl vs Cmd) | Must use Cmd on macOS, Ctrl on Windows/ChromeOS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI-driven formatting via automation loop | Google Sheets API (batchUpdate) | Sheets API requires OAuth + server -- massively out of scope |
| Alt+/ tool finder for menu items | Direct menu DOM clicks (#docs-format-menu) | Menu selectors are stable but sub-menu items have dynamic IDs -- tool finder avoids this |
| Format > Alternating Colors | Manual per-row fill color via toolbar | Alternating Colors is one operation for entire sheet; manual fill is N operations |
| Right-click column header > Resize > Fit to data | Apps Script autoResizeColumns | Apps Script requires script injection, separate execution context -- not feasible from extension |

## Architecture Patterns

### Recommended Changes (by file)
```
background.js                              # Formatting orchestrator: startSheetsFormatting(), formatting completion handler
ai/ai-integration.js                       # Formatting-specific prompt directive injection (sheetsFormatting context)
site-guides/productivity/google-sheets.js   # New formatting workflows, updated guidance with formatting shortcuts
```

### Pattern 1: Formatting as a Chained Automation Session (Same as Phase 12 Data Entry)
**What:** After Phase 12 Sheets data entry completes (detected at the `session.sheetsData` completion handler at line 9197), instead of immediately marking the session complete, launch a formatting pass by rewriting the task and resetting iteration state. This is the exact same orchestration pattern used when Phase 12 chains after Phase 11.
**When to use:** Always -- this is the primary flow.
**Why:** Reuses the entire automation loop. The AI already knows how to interact with Google Sheets from the site guide. We just need to give it formatting-specific instructions.

**Implementation hook point:**
```javascript
// background.js ~line 9197-9209 (current Sheets data entry completion handler)
// BEFORE: Marks session complete after data entry
// AFTER: Detect if formatting is needed, launch formatting pass

if (session.sheetsData && !session.sheetsData.formattingComplete) {
  // Data entry just finished -- launch formatting pass
  await startSheetsFormatting(sessionId, session);
  return; // Don't mark complete yet
}
```

**Flow:**
```
1. Phase 12 data entry completes (AI says taskComplete: true)
2. Completion handler detects session.sheetsData exists
3. Check session.sheetsData.formattingComplete -- if false, start formatting
4. startSheetsFormatting() rewrites task, resets iterations, injects formatting directive
5. AI executes formatting actions (bold, colors, freeze, resize)
6. Formatting completes -- session.sheetsData.formattingComplete = true
7. Normal completion flow runs
```

### Pattern 2: Keyboard Shortcuts for Direct Formatting Operations
**What:** Use `keyPress` with modifier keys to apply formatting that has native shortcuts. This is the most reliable approach because it avoids DOM selector brittleness entirely.
**When to use:** Bold, center alignment, borders, and any other formatting with a known shortcut.

**Available keyboard shortcuts (verified):**
| Operation | Windows/ChromeOS | macOS | Reliability |
|-----------|-----------------|-------|-------------|
| Bold | Ctrl+B | Cmd+B | HIGH -- universal shortcut |
| Center align | Ctrl+Shift+E | Cmd+Shift+E | HIGH -- standard shortcut |
| Left align | Ctrl+Shift+L | Cmd+Shift+L | HIGH -- standard shortcut |
| Bottom border | Shift+Alt+3 | Shift+Option+3 | MEDIUM -- may need compatible shortcuts enabled |
| Select entire row | Shift+Space | Shift+Space | HIGH -- standard shortcut |
| Select all | Ctrl+A | Cmd+A | HIGH -- universal shortcut |
| Undo | Ctrl+Z | Cmd+Z | HIGH -- universal shortcut |
| Text wrap toggle | Ctrl+Alt+O | Cmd+Option+O | MEDIUM -- toggles between wrap/overflow |

### Pattern 3: Alt+/ Tool Finder for Menu-Dependent Operations
**What:** Press Alt+/ (Option+/ on Mac) to open the Google Sheets Tool Finder (search-the-menus), type the menu item name, and press Enter to activate it. This avoids navigating through menu hierarchies and avoids brittle sub-menu DOM selectors.
**When to use:** Freeze rows, alternating colors, and any operation that requires menu navigation.
**Why:** The tool finder is a text input that searches all menu items by name. It works regardless of menu DOM structure changes. It is the most future-proof approach for menu-dependent operations.

**Example sequences:**
```
Freeze row 1:
1. Press Alt+/ (opens tool finder)
2. Type "Freeze" (search results appear)
3. The "1 row" option should appear under View > Freeze
4. Navigate to and select "1 row"
-- OR --
1. Click View menu (#docs-view-menu)
2. Click "Freeze" submenu item
3. Click "1 row" option

Alternating colors:
1. Press Alt+/ (opens tool finder)
2. Type "Alternating colors"
3. Press Enter to activate
4. The alternating colors sidebar opens
5. Configure header color, Color 1, Color 2
```

### Pattern 4: Format > Alternating Colors for Zebra Striping
**What:** Use Google Sheets' built-in "Alternating Colors" feature (Format > Alternating colors) instead of manually setting fill colors row by row. This feature opens a sidebar panel where you can set Header color, Color 1, and Color 2 with custom hex values. It automatically applies the pattern to the selected data range.
**When to use:** For the zebra striping requirement (alternating white/light gray rows with dark header).
**Why:** One operation replaces N per-row operations. It handles future rows added to the range. It supports custom hex codes for header and alternating colors.

**Configuration values (discretion recommendation):**
- Header: #333333 (dark charcoal) with white text -- provides maximum contrast
- Color 1: #FFFFFF (white) -- clean, standard
- Color 2: #F3F3F3 (very light gray) -- subtle differentiation without harshness
- Header checkbox: enabled (applies header-specific color)
- Footer checkbox: disabled (no footer styling needed)

**Sidebar interaction sequence:**
```
1. Select the data range (Ctrl+A or click top-left cell, Shift+Ctrl+End)
2. Open Format > Alternating colors (via menu or Alt+/ tool finder)
3. Sidebar opens on the right
4. Check the "Header" checkbox if not already checked
5. Click the header color picker, enter custom hex code
6. Click Color 1 picker, enter white hex
7. Click Color 2 picker, enter light gray hex
8. Click "Done" button at bottom of sidebar
```

### Pattern 5: Column Auto-Sizing via Right-Click Context Menu
**What:** Select all columns, right-click a column header, choose "Resize columns [range]", and select "Fit to data." This auto-sizes all selected columns to fit their content.
**When to use:** After all data and formatting is applied, as the final formatting step.
**Why:** Google Sheets has no keyboard shortcut for column auto-sizing. The right-click menu is the most direct approach. The "Fit to data" option handles all columns at once when they are all selected.

**Column sizing sequence:**
```
1. Click the column/row selector (top-left corner cell) to select all cells
2. Right-click on any column header letter
3. Click "Resize columns A-[last]"
4. Select "Fit to data" radio button
5. Click "OK"
6. For description column: may need manual cap at ~300px to prevent excessive width
```

**Alternative for max-width capping:**
After auto-fit, if Description column is too wide, right-click its header, choose "Resize column [X]", enter a pixel width (e.g., 300), and click OK.

### Pattern 6: Header Row Selection and Formatting
**What:** Navigate to row 1, select the entire row (Shift+Space or click row number "1"), then apply formatting shortcuts.
**When to use:** Bold, center alignment, and text color for the header row.

**Header formatting sequence:**
```
1. Click Name Box, type "A1", press Enter (navigate to row 1)
2. Press Shift+Space to select entire row 1
3. Press Ctrl+B (bold the header)
4. Press Ctrl+Shift+E (center-align the header)
5. Apply header background color (via alternating colors or fill color toolbar)
6. Apply bottom border: Shift+Alt+3 (thin bottom border)
```

### Anti-Patterns to Avoid
- **Hardcoding toolbar button aria-labels:** Google Sheets toolbar button aria-labels change across product updates. Use the Alt+/ tool finder or keyboard shortcuts instead of targeting specific toolbar button selectors.
- **Applying formatting cell-by-cell:** Always select a range (row, column, or all cells) before applying formatting. Never iterate through cells one at a time.
- **Using conditional formatting for static styling:** Conditional formatting is for dynamic rules. Use direct formatting or Alternating Colors for static visual styling.
- **Formatting before data entry is complete:** Always format AFTER all data is written and verified. Formatting during data entry can interfere with cell selection and Tab/Enter navigation.
- **Overriding existing formatting without detection:** The user explicitly wants adaptive behavior. Check for existing formatting before applying defaults.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zebra striping | Manual per-row fill color (N click operations) | Format > Alternating Colors (1 menu operation) | Built-in feature handles the pattern, supports custom colors, handles future rows |
| Column sizing | Pixel-by-pixel width calculation | Right-click > Resize > "Fit to data" | Built-in auto-fit, works on all columns at once |
| Menu navigation | Parsing menu DOM tree for sub-items | Alt+/ tool finder (type name, press Enter) | Text-based search avoids all DOM brittleness |
| Platform detection | Manual OS checks in prompt | Existing `isMac` detection in content/actions.js | Already handles Ctrl vs Cmd routing |
| Formatting orchestration | New session management system | Extend existing Phase 12 sheetsData orchestrator | Session chaining pattern already proven in Phase 11->12 transition |

**Key insight:** The biggest risk in this phase is DOM selector brittleness for toolbar buttons. The mitigation is to maximize use of keyboard shortcuts and the Alt+/ tool finder, minimizing direct toolbar interaction. Only use toolbar clicks for operations where no shortcut or menu path exists.

## Common Pitfalls

### Pitfall 1: Toolbar Button Selectors Are Unstable
**What goes wrong:** Clicking the fill color toolbar button by selector fails because Google updated the aria-label or restructured the toolbar DOM.
**Why it happens:** Google Sheets is a continuously-deployed web app. Toolbar button IDs, classes, and aria-labels change without notice. The STATE.md blocker explicitly warns about this.
**How to avoid:** Use the Alt+/ tool finder for any operation that would otherwise require toolbar interaction. For fill color specifically, use Format > Alternating Colors instead of the toolbar fill button. If toolbar clicks are absolutely needed, use coordinate-based fallback after finding the element visually (the AI can identify buttons by their position in the toolbar).
**Warning signs:** Click actions failing with "Element not found", formatting not being applied despite correct action sequence.

### Pitfall 2: Alternating Colors Sidebar Interaction Complexity
**What goes wrong:** The Alternating Colors sidebar opens but the AI fails to interact with the color pickers, hex input fields, or the Done button because the sidebar DOM is complex and dynamically generated.
**Why it happens:** The sidebar has nested color picker widgets with custom hex input fields that may not be standard HTML inputs. Clicking a color swatch opens a secondary popup with hex entry.
**How to avoid:** The AI prompt should provide explicit step-by-step instructions for sidebar interaction. Include fallback: if custom colors cannot be set, select the closest default style (grayscale theme) from the preset options. The default presets include light/dark themes that approximate the desired look.
**Warning signs:** Color picker popup not opening, hex codes not being entered, sidebar stuck without the "Done" button being clicked.

### Pitfall 3: Select All Does Not Select Entire Data Range
**What goes wrong:** Pressing Ctrl+A selects the entire sheet (all 1000+ rows) instead of just the data range. Formatting then applies to empty rows.
**Why it happens:** Ctrl+A in Google Sheets selects all cells. If the cursor is in a data region, it first selects the contiguous data range, then on second press selects the entire sheet.
**How to avoid:** For data-range-specific operations, manually select from A1 to the last data cell using Shift+Ctrl+End (selects from current cell to last cell with data). Or navigate to A1 first, then use Name Box to type the range (e.g., "A1:F25") and press Enter.
**Warning signs:** Alternating colors applying to hundreds of empty rows, slow performance.

### Pitfall 4: Formatting Pass Conflicts with Cell Edit Mode
**What goes wrong:** Keyboard shortcuts for formatting (Ctrl+B, etc.) don't work because a cell is in edit mode (blinking cursor in formula bar).
**Why it happens:** If the previous data entry session left the cursor in a cell's edit mode (formula bar active), formatting shortcuts may be intercepted by the cell editor instead of applying to the selection.
**How to avoid:** Press Escape at the start of the formatting pass to exit any edit mode. The formatting prompt should instruct: "Press Escape first to ensure you are not in cell edit mode."
**Warning signs:** Bold not being applied, center alignment not working, unexpected characters appearing in cells.

### Pitfall 5: Row Selection with Shift+Space When Cell Has Content
**What goes wrong:** Pressing Shift+Space to select the entire row does not work if the cell is in edit mode -- it inserts a space character instead.
**Why it happens:** When the cell is being edited (cursor in formula bar), Shift+Space inserts a space character in the cell content rather than selecting the row.
**How to avoid:** Always press Escape first to exit edit mode, THEN press Shift+Space to select the row. Or click the row number "1" on the left margin to select row 1 directly.
**Warning signs:** Space characters appearing in cell content after formatting attempt.

### Pitfall 6: Freeze Row Not Applied Because Row Not Selected
**What goes wrong:** The "Freeze 1 row" option freezes the wrong row or does nothing.
**Why it happens:** The freeze behavior depends on the current cell selection. "Freeze 1 row" always freezes row 1 regardless of selection, but "Up to current row" depends on which cell is selected.
**How to avoid:** Navigate to cell A1 first, then use View > Freeze > 1 row. The "1 row" option is idempotent and always freezes row 1, making it safe to call regardless of current selection.
**Warning signs:** Frozen row line not appearing, scrolling behavior not changing.

### Pitfall 7: Service Worker Restart During Formatting
**What goes wrong:** Chrome terminates the service worker during the formatting pass, losing state.
**Why it happens:** Same as Phase 12 -- MV3 service workers have idle timeouts.
**How to avoid:** Persist session state between major formatting operations using `persistSession()`. Track formatting progress in `session.sheetsData.formattingStep` so recovery can resume from where it left off.
**Warning signs:** Overlay disappears, formatting stops mid-sheet.

### Pitfall 8: Apply Link Column Already Has HYPERLINKs from Phase 12
**What goes wrong:** Phase 13 tries to convert "Apply Link" column values to HYPERLINK formulas, but Phase 12 already wrote them as `=HYPERLINK("url","Apply")` formulas.
**Why it happens:** The CONTEXT.md decision says "convert raw URLs to clickable hyperlinks displaying Apply." But Phase 12 already writes HYPERLINK formulas.
**How to avoid:** Phase 13 should verify whether Apply Link cells already contain HYPERLINK formulas (read formula bar -- if it starts with `=HYPERLINK`, it is already a formula). Only convert raw URLs that are NOT already formulas. The blue text color decision applies regardless -- hyperlinks should be styled blue.
**Warning signs:** Double-wrapped HYPERLINK formulas, formula errors.

## Code Examples

### Example 1: Formatting Session Trigger (Background Orchestrator)
```javascript
// Source: Extending background.js Sheets completion handler (~line 9197)
// Pattern: Same chaining as Phase 11 -> Phase 12

// In the Sheets data entry completion handler:
if (session.sheetsData && !session.sheetsData.formattingComplete) {
  automationLogger.info('Sheets data entry done, starting formatting pass', { sessionId });
  await startSheetsFormatting(sessionId, session);
  return; // Don't mark session complete yet
}
```

### Example 2: startSheetsFormatting Orchestrator
```javascript
// Source: New function in background.js, follows startSheetsDataEntry pattern
async function startSheetsFormatting(sessionId, session) {
  automationLogger.info('Starting Sheets formatting pass', { sessionId });

  const sd = session.sheetsData;
  const totalRows = sd.totalRows;
  const columns = sd.columns;
  const lastCol = String.fromCharCode(64 + columns.length); // A=65, so columns.length columns

  // Rewrite task for formatting
  session.task = `Format the Google Sheet with professional styling. The sheet has ${totalRows} data rows plus 1 header row, columns A through ${lastCol}. Apply formatting: bold header, dark background, center alignment, freeze row 1, alternating row colors, auto-size columns.`;

  // Reset iteration state
  session.iterationCount = 0;
  session.stuckCounter = 0;
  session.consecutiveNoProgressCount = 0;
  session.actionHistory = [];
  session.stateHistory = [];
  session.lastDOMHash = null;
  session.status = 'running';

  // Set iteration cap (formatting is fewer iterations than data entry)
  session.maxIterations = 25;

  // Track formatting state
  sd.formattingPhase = true;
  sd.formattingStep = 'starting';

  // Update overlay
  session.taskSummary = 'Formatting sheet...';
  sendSessionStatus(session.tabId, {
    phase: 'sheets-formatting',
    step: 'Applying professional formatting',
    status: 'Formatting sheet...',
    taskName: session.task,
    iteration: 0,
    maxIterations: session.maxIterations
  });

  persistSession(sessionId, session);
  setTimeout(() => startAutomationLoop(sessionId), 500);
}
```

### Example 3: Formatting Prompt Directive Injection
```javascript
// Source: Extension to ai-integration.js sheetsData prompt injection
// Injected when context.sheetsData.formattingPhase is true

const formattingDirective = `
GOOGLE SHEETS FORMATTING SESSION:
You are applying professional formatting to a completed Google Sheet.
The sheet has ${sd.totalRows} data rows plus 1 header row in row 1.
Columns: ${sd.columns.join(' | ')} (A through ${lastCol}).
Data range: A1:${lastCol}${sd.totalRows + 1}

STEP 0 -- EXIT EDIT MODE:
Press Escape to ensure you are not in cell edit mode.

STEP 1 -- SELECT HEADER ROW:
Click the Name Box (#t-name-box), type "A1", press Enter.
Press Shift+Space to select the entire row 1.

STEP 2 -- BOLD HEADER:
Press Ctrl+B (or Cmd+B on Mac) to bold the header row.

STEP 3 -- CENTER ALIGN HEADER:
Press Ctrl+Shift+E (or Cmd+Shift+E on Mac) to center-align the header text.

STEP 4 -- BOTTOM BORDER ON HEADER:
With row 1 still selected, press Shift+Alt+3 to apply a bottom border.

STEP 5 -- FREEZE ROW 1:
Click the View menu (#docs-view-menu).
Click "Freeze" in the dropdown.
Click "1 row" to freeze the header row.
(Alternative: use Alt+/ tool finder, type "Freeze", select "1 row")

STEP 6 -- ALTERNATING COLORS:
Click the Name Box, type "A1:${lastCol}${sd.totalRows + 1}", press Enter to select the data range.
Click the Format menu (#docs-format-menu).
Click "Alternating colors" to open the sidebar.
In the sidebar: check Header checkbox, set Header color to dark charcoal (#333333).
Set Color 1 to white (#FFFFFF), Color 2 to light gray (#F3F3F3).
Click "Done" to apply.
(Alternative: select a dark preset theme from the default styles if custom hex entry is difficult)

STEP 7 -- HEADER TEXT COLOR:
Click the Name Box, type "1:1", press Enter to select row 1.
The header text should be white for contrast against the dark background.
(This may be handled automatically by the Alternating Colors feature's header style)

STEP 8 -- AUTO-SIZE COLUMNS:
Click the cell/row/column selector button (top-left corner of the grid, above row 1 and left of column A) to select all cells.
Right-click on any column header letter.
Click "Resize columns A-${lastCol}" (or similar text).
Select "Fit to data".
Click "OK".

STEP 9 -- APPLY LINK COLUMN BLUE TEXT:
Click the Name Box, type "${lastCol}2:${lastCol}${sd.totalRows + 1}", press Enter.
This selects the Apply Link column data (not header).
Apply blue text color to signal clickability.
(Use toolbar text color button or Format > Text color via Alt+/ tool finder)

STEP 10 -- VERIFY:
Scroll up to row 1. Confirm:
- Header row is bold with dark background and white text
- Row 1 is frozen (thick line below it when scrolling)
- Alternating row colors visible (white/light gray)
- Columns are sized appropriately

COMPLETION: Mark taskComplete: true after all formatting is applied and verified.

FALLBACK STRATEGIES:
- If Alternating Colors sidebar is hard to interact with: select a default grayscale preset style instead of custom colors.
- If tool finder (Alt+/) does not work: navigate menus directly (View > Freeze, Format > Alternating colors).
- If text color toolbar button is not findable: skip blue text color for Apply Link column (low priority).
- If column resize dialog is hard to interact with: double-click column header borders to auto-fit.
`;
```

### Example 4: Header Row Selection and Bold
```javascript
// AI action sequence for formatting the header row:
[
  { "tool": "keyPress", "params": { "key": "Escape" } },
  { "tool": "click", "params": { "selector": "#t-name-box" } },
  { "tool": "type", "params": { "text": "A1", "pressEnter": true } },
  { "tool": "keyPress", "params": { "key": " ", "shiftKey": true } },  // Shift+Space = select row
  { "tool": "keyPress", "params": { "key": "b", "ctrlKey": true } },   // Ctrl+B = bold
  { "tool": "keyPress", "params": { "key": "e", "ctrlKey": true, "shiftKey": true } },  // Ctrl+Shift+E = center
  { "tool": "keyPress", "params": { "key": "3", "shiftKey": true, "altKey": true } }    // Shift+Alt+3 = bottom border
]
```

### Example 5: Freeze Row via Menu
```javascript
// AI action sequence for freezing row 1:
[
  { "tool": "click", "params": { "selector": "#docs-view-menu" } },  // Click View menu
  // Wait for dropdown to appear
  { "tool": "waitForDOMStable", "params": {} },
  // Click "Freeze" submenu item (text-based matching)
  { "tool": "click", "params": { "selector": "[aria-label='Freeze']" } },
  // Wait for submenu
  { "tool": "waitForDOMStable", "params": {} },
  // Click "1 row"
  { "tool": "click", "params": { "selector": ":contains('1 row')" } }
]

// Alternative via tool finder:
[
  { "tool": "keyPress", "params": { "key": "/", "altKey": true } },  // Alt+/ opens tool finder
  { "tool": "type", "params": { "text": "Freeze 1 row" } },
  { "tool": "keyPress", "params": { "key": "Enter" } }
]
```

### Example 6: Column Auto-Sizing via Right-Click
```javascript
// AI action sequence for auto-sizing all columns:
[
  // Click the "Select All" button (top-left corner cell intersection)
  { "tool": "click", "params": { "selector": ".column-headers-container .row-header-wrapper" } },
  // Right-click on any column header
  { "tool": "rightClick", "params": { "selector": ".column-header-text" } },
  // Click "Resize columns A-F" in context menu
  { "tool": "click", "params": { "selector": ":contains('Resize column')" } },
  // Select "Fit to data" radio button
  { "tool": "click", "params": { "selector": ":contains('Fit to data')" } },
  // Click OK
  { "tool": "click", "params": { "selector": ":contains('OK')" } }
]
```

## Discretion Recommendations

### Hex Values for Colors
**Recommendation:**
- Header background: #333333 (dark charcoal -- not pure black, slightly softer)
- Header text: #FFFFFF (white)
- Alternating Color 1: #FFFFFF (white)
- Alternating Color 2: #F3F3F3 (very light gray -- subtle but noticeable)
- Apply Link text: #1155CC (Google's default hyperlink blue -- consistent with Sheets' own link styling)

**Rationale:** #333333 provides maximum contrast against white text without the harshness of pure black (#000000). #F3F3F3 is the lightest discernible gray that provides alternating row distinction without making the sheet look busy. #1155CC is Google's own hyperlink blue used in Sheets/Docs, making the Apply links look like native hyperlinks.

### Existing Formatting Detection: Heuristic Approach
**Recommendation:** Use a simple heuristic rather than attempting to read cell styles programmatically. The heuristic:
1. Navigate to A1 via Name Box
2. Read the formula bar -- if it has a header value, the sheet has data
3. Check if the header row already has formatting by looking at visual cues in the AI's DOM analysis (the AI can see toolbar state like bold button being pressed)
4. If the sheet was just created by Phase 12 (session.sheetsData exists and was fresh creation), assume no existing formatting -- apply defaults
5. If the sheet was an existing sheet that Phase 12 appended to, the AI should describe what formatting it sees and adapt

**Rationale:** Reading individual cell styles programmatically is not possible through the canvas-based grid. The formula bar shows content but not styling. The simplest reliable approach is to use the session context: if `session.sheetsData.sheetTarget.type === 'new'`, apply full defaults. If `type === 'existing'`, instruct the AI to observe and adapt. This avoids complex style detection entirely.

### Order of Formatting Operations
**Recommendation:** Top-down, most-impactful-first:
1. Escape (exit edit mode)
2. Select header row and apply bold + center align + border (keyboard shortcuts -- fast, reliable)
3. Freeze row 1 (View > Freeze menu -- one operation)
4. Apply alternating colors (Format > Alternating colors -- one operation for entire sheet)
5. Blue text for Apply Link column (text color -- optional, lower priority)
6. Auto-size columns (right-click resize -- final step, needs all content/formatting in place first)

**Rationale:** Keyboard shortcut operations go first because they are fastest and most reliable. Alternating colors should come before column sizing because alternating colors may affect header styling (header checkbox). Column sizing is last because it needs to account for the final formatted text widths.

### Hyperlink Conversion: Phase 12 Already Handles This
**Recommendation:** Phase 12 already writes `=HYPERLINK("url","Apply")` formulas in the Apply Link column. Phase 13 should NOT re-convert URLs. Instead, Phase 13 should:
1. Verify that Apply Link cells contain HYPERLINK formulas (read formula bar on a sample cell)
2. If they do: only apply blue text color for visual consistency
3. If raw URLs exist (edge case: some cells may have plain URLs): convert them to HYPERLINK formulas

**Rationale:** Avoids double-wrapping HYPERLINK formulas. Phase 12 and Phase 13 are designed as a sequential pipeline where Phase 12 handles data entry (including formulas) and Phase 13 handles visual formatting.

### Edge Cases
**Recommendation:**
- **Empty sheets (no data):** Skip formatting entirely. If `session.sheetsData.totalRows === 0`, mark formatting complete immediately.
- **Single-row data (1 job):** Apply all formatting normally. The alternating colors will only have one data row but the header styling and freeze still add value.
- **Very wide datasets (>8 columns):** Column auto-fit handles this automatically. The ~300px cap on Description is enforced by the AI checking the column width after auto-fit and manually resizing if needed.
- **Mac vs Windows:** The AI prompt should include platform-aware shortcuts. The content script's `isMac` detection already handles Ctrl vs Cmd routing in the keyPress tool. The prompt should mention both variants.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Toolbar button clicks by aria-label | Alt+/ tool finder (search menus by name) | Google added tool finder 2023+ | Avoids brittle aria-label selectors |
| Manual per-row color formatting | Format > Alternating Colors | Built-in feature, stable | One operation replaces N; supports custom hex; handles future rows |
| Fixed column widths | Right-click > Resize > Fit to data | Built-in feature, stable | Auto-sizes to content |
| Hardcoded menu DOM paths | AI-driven menu navigation | FSB design pattern | AI adapts to menu layout changes |

**Deprecated/outdated:**
- Using toolbar button aria-labels for fill/text color: These are known to change. Use Alternating Colors feature or tool finder instead.
- Manual cell-by-cell formatting: Always use range selection + single formatting operation.

## Open Questions

### 1. Tool Finder (Alt+/) Reliability on Google Sheets
**What we know:** The tool finder opens a text input that searches all menu items. It is accessible via Alt+/ (Windows) or Option+/ (Mac). It is documented in Google's official help pages.
**What's unclear:** How the tool finder input element appears in the DOM, whether it is a standard text input, and whether typing + Enter reliably activates the matching menu item. The exact DOM selector for the tool finder input is unknown.
**Recommendation:** The AI prompt should instruct: "Press Alt+/ to open the tool finder. A text input appears at the top of the screen. Type the menu item name and press Enter." If this fails, fall back to direct menu navigation (click View menu > click Freeze > click 1 row). Both paths should be in the prompt as primary and fallback.

### 2. Alternating Colors Sidebar Custom Color Entry
**What we know:** The sidebar has header color, Color 1, Color 2 pickers with hex input fields. There are default preset themes including grayscale options.
**What's unclear:** The exact interaction pattern for entering custom hex codes in the color picker popup. Whether the hex input field is directly accessible or requires multiple clicks to reach.
**Recommendation:** Primary: try entering custom hex codes following the sidebar's UI flow. Fallback: select the closest default preset theme (a dark header + light alternating theme exists in the defaults). The fallback produces a professional result even if custom colors cannot be set.

### 3. Right-Click Column Resize Dialog
**What we know:** Right-clicking a column header shows "Resize column [X]..." or "Resize columns A-F..." when multiple columns are selected. A dialog appears with "Fit to data" option.
**What's unclear:** The exact DOM structure of the right-click context menu and resize dialog. Whether "Fit to data" is a radio button, checkbox, or link.
**Recommendation:** The AI sees the DOM and can identify the dialog elements dynamically. The prompt should provide the conceptual flow (select all > right-click header > resize > fit to data > OK), and the AI navigates the actual UI. Alternative: double-click the column header border to auto-fit (simpler, no dialog).

### 4. Header Text Color with Alternating Colors Feature
**What we know:** The Alternating Colors feature's "Header" checkbox option applies a distinct color to the header row background. It may also set the header text color automatically based on contrast.
**What's unclear:** Whether the Alternating Colors feature automatically sets white text on dark backgrounds, or if text color must be set separately.
**Recommendation:** Apply Alternating Colors first with dark header. Then check if the header text is already white. If not, select row 1 and apply white text color. The AI can visually observe whether the header text is readable.

## Sources

### Primary (HIGH confidence)
- `background.js:9197-9209` -- Sheets data entry completion handler (hook point for formatting trigger)
- `background.js:7034-7145` -- startSheetsDataEntry orchestrator (pattern to follow for formatting session)
- `ai/ai-integration.js:2265-2347` -- Sheets data entry directive injection (pattern for formatting directive)
- `site-guides/productivity/google-sheets.js` -- Full Google Sheets site guide with selectors and workflows
- `content/actions.js:3133-3174` -- keyPress tool with modifier support (bold, alignment, borders)
- `content/actions.js:1033-1175` -- click tool with selector cascade and coordinate fallback
- [Google Docs Editors Help - Keyboard Shortcuts](https://support.google.com/docs/answer/181110) -- Official shortcuts reference
- [Google Docs Editors Help - Freeze rows and columns](https://support.google.com/docs/answer/9060449) -- Official freeze documentation
- [Google Docs Editors Help - HYPERLINK function](https://support.google.com/docs/answer/3093313) -- Official HYPERLINK formula docs
- [Google Docs Editors Help - Tool Finder](https://support.google.com/docs/answer/13466905) -- Official tool finder docs

### Secondary (MEDIUM confidence)
- [Ben Collins - How to Alternate Colors in Google Sheets](https://www.benlcollins.com/spreadsheets/how-to-alternate-colors-in-google-sheets/) -- Alternating colors sidebar details
- [Spreadsheet Class - Auto Resize Columns](https://www.spreadsheetclass.com/automatically-resize-columns-in-google-sheets-with-fit-to-data/) -- Fit to data steps
- [ShortTutorials - Center Align Shortcut](https://www.shorttutorials.com/google-sheets-shortcuts/center-align.html) -- Ctrl+Shift+E confirmed
- [ShortTutorials - Bottom Border Shortcut](https://www.shorttutorials.com/google-sheets-shortcuts/apply-bottom-border.html) -- Shift+Alt+3 confirmed
- [SheetWhiz - Fill Color](https://www.sheetwhiz.com/post/master-the-google-sheets-fill-color-shortcut-fast) -- No native fill color shortcut confirmed

### Tertiary (LOW confidence)
- Tool Finder DOM structure and interaction model -- not verified via live inspection, behavior inferred from documentation
- Alternating Colors sidebar custom hex entry workflow -- exact interaction steps not verified live
- Right-click context menu "Resize columns" dialog structure -- not verified via live DOM inspection
- Column header selectors for right-click (`.column-header-text` etc.) -- inferred, may differ in live Sheets

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components verified in codebase, no new libraries
- Architecture (orchestrator pattern): HIGH -- follows proven Phase 11->12 chaining pattern
- Keyboard shortcuts: HIGH -- verified against multiple official and community sources
- Menu navigation (freeze, alternating colors): MEDIUM -- menu paths verified, but live DOM interaction untested
- Toolbar interaction (fill/text color): LOW -- aria-labels are known to change, tool finder approach recommended
- Column sizing: MEDIUM -- right-click method documented, but dialog DOM untested

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable -- keyboard shortcuts and menu paths rarely change)
