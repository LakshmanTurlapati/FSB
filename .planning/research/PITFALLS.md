# Domain Pitfalls: Productivity Site Intelligence for 7 Web Apps

**Domain:** Adding custom site intelligence (fsbElements, multi-strategy selectors, keyboard-first guidance, workflows) to Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, and Jira
**Researched:** 2026-03-16
**Confidence:** HIGH for integration pitfalls (based on codebase analysis); MEDIUM for per-app DOM characteristics (based on web research + known architectural patterns; exact selectors need validation via browser DevTools inspection)

---

## Selector Fragility Risk Ranking

Before diving into pitfalls, this ranking drives which apps need the most selector strategies and which can rely on fewer fallbacks.

| App | Fragility | Why | Recommended Strategies |
|-----|-----------|-----|----------------------|
| **Notion** | CRITICAL | React + CSS Modules produces hashed class names (e.g., `notion-scroller`, `notion-page-content` survive, but component-level classes like `r-acJ79b` change on every deploy). No stable IDs. `data-block-id` is per-block but UUIDs change per page. | 5 strategies: `data-block-id` patterns, `[contenteditable]` + structural position, `[role]` + aria, `[placeholder]` text, DOM tree depth |
| **Airtable** | CRITICAL | React + virtual scrolling grid. Only visible rows exist in DOM. Class names are hashed CSS Modules. Cell elements are created/destroyed on scroll. Expanded record modal is a separate React tree. | 5 strategies: `[data-columnid]`/`[data-rowid]` attributes, `[role="gridcell"]` + position, aria-label text, modal `[role="dialog"]`, structural selectors |
| **Jira** | HIGH | Atlassian Design System (AtlasKit) uses compiled CSS with hashed names. Jira is actively pushing a "new UI" in 2025-2026 that changes layout across releases. `data-testid` attributes exist but are not guaranteed stable across versions. | 5 strategies: `data-testid` patterns, `[aria-label]` text, `[role]` attributes, structural context, `[data-ds--*]` design system attributes |
| **Todoist** | HIGH | React + CSS Modules with obfuscated IDs. The "new task view" uses particularly opaque class names. Single-key shortcuts (Q, E, A, etc.) make keyboard automation conflict-prone. | 4-5 strategies: `[data-testid]` if present, `[aria-label]`, `[role]` + structural position, `[contenteditable]` targeting, text content matching |
| **Trello** | MODERATE | Atlassian-owned but uses older React patterns. `data-testid` attributes are present on cards, lists, and modals. Aria labels are reasonably stable. Card modals use URL-based routing (card IDs in URL). | 4 strategies: `data-testid`, `[aria-label]`, `[role]`, DOM structure. Skip class-based selectors. |
| **Google Calendar** | MODERATE | Google Workspace app with stable `data-eventid` attributes on events. Time grid uses `[data-datekey]` attributes. Popovers have `[role="dialog"]`. More Google-DOM-stable than Sheets. | 4 strategies: `data-*` attributes, `[aria-label]`, `[role]`, structural context |
| **Google Keep** | LOW-MODERATE | Simple card-based layout. Google DOM conventions apply. Notes have stable-ish class patterns (`.IZ65Hb-YPqjbf` style, hashed but consistent within versions). Fewer interactive elements than other apps. | 3-4 strategies: `[aria-label]`, `[role]`, structural position, class pattern fallback |

---

## Critical Pitfalls

Mistakes that cause the fsbElements system to silently fail, break existing Google Sheets functionality, or require architectural rework.

---

### Pitfall 1: fsbElements Injection is Hardcoded to Google Sheets URLs

**What goes wrong:**
The entire fsbElements multi-strategy selector system in `content/dom-analysis.js` (lines 1810-1870) is gated behind a Sheets-only URL check: `if (/spreadsheets\/d\//.test(window.location.pathname))`. Adding fsbElements to Notion, Trello, etc. guide files will have ZERO EFFECT because the injection code never runs for those URLs. The fsbElements data will sit in the guide object, passed via `guideSelectors.fsbElements`, but the content script will never iterate over it.

**Why it happens:**
The fsbElements system was built specifically for Google Sheets in v10.0. The URL check was a reasonable scope guard at the time. When adding new apps, the natural mistake is to add fsbElements to the site guide JS file and assume the system will pick them up -- because the `background.js` code at line 8483 already passes `fsbElements` from ANY matched guide: `iterationGuideSelectors = { ...guide.selectors, fsbElements: guide.fsbElements }`. The background side is generic; the content script side is not.

**Consequences:**
- All fsbElements for 7 new apps are silently ignored
- No error messages (the code path is simply never entered)
- Selectors in the `selectors:` object still work for `[hint:]` annotations, but the multi-strategy resilience system does not engage
- Testing may appear to work for simple tasks (standard DOM selectors suffice) but fails on fragile elements

**Prevention:**
Refactor the fsbElements injection in `dom-analysis.js` Stage 1b to be URL-agnostic. Replace the `/spreadsheets\/d\//` check with a generic check: `if (guideSelectors?.fsbElements)`. The existing `findElementByStrategies()` function is already generic. The logging and health-check sections also need generalization (they currently log Sheets-specific messages like `sheets_injection` and `sheets_selector_match`).

**Detection:**
Add a health check assertion: if a site guide has `fsbElements` but the snapshot contains zero elements with `data-fsbRole`, log a warning. This catches the "silently ignored" failure mode.

**Phase/Task:** Must be addressed in Phase 1 (infrastructure) before any app-specific guide work begins. This is a prerequisite for all 7 guides.

---

### Pitfall 2: isCanvasBasedEditor() Only Detects Google Products

**What goes wrong:**
The `isCanvasBasedEditor()` function in `messaging.js` (line 217) only checks for `docs.google.com` hostname and Google-specific CSS classes (`.kix-appview-editor`, `.waffle-*`). This function gates three critical behaviors:
1. **Skip readiness checks** in `actions.js` (line 1105-1107) -- without this, clicks on overlay/popover elements may hang waiting for stability
2. **Skip obscuration checks** in `accessibility.js` (line 642) -- without this, elements behind popovers/modals will be flagged as "obscured" and rejected
3. **Canvas editor fallback typing** in `actions.js` (line 2438) -- when all selectors fail, CDP keyboard emulation is used as last resort

Airtable uses a canvas-rendered grid view. Notion uses complex layered contenteditable blocks with overlays. These apps will hit readiness check timeouts and false obscuration failures if the bypass does not apply.

**Why it happens:**
The function was correctly scoped for v10.0 which only had Google Sheets/Docs. The name "canvas-based editor" is misleading -- the real need is "complex layered UI where standard readiness/obscuration heuristics fail."

**Consequences:**
- Airtable grid clicks timeout waiting for "DOM stability" that never arrives (virtual scroll constantly mutates)
- Notion block editor clicks fail obscuration checks when slash command popover is open
- Google Calendar event popover clicks fail because the popover overlays the grid
- Actions.js enters slow retry loops instead of fast CDP fallback

**Prevention:**
Either rename and generalize `isCanvasBasedEditor()` to `isComplexLayeredUI()` that checks against a list of hostnames/URL patterns from the matched site guide, or add a `skipReadinessChecks: true` flag to site guides that need it. The second approach is cleaner -- each guide declares its own needs.

**Phase/Task:** Must be addressed in Phase 1 (infrastructure) alongside Pitfall 1. Add a `flags` or `behaviors` object to the site guide schema.

---

### Pitfall 3: Sheets-Specific Health Check and Logging Pollute Generic System

**What goes wrong:**
The Sheets health check at `dom-analysis.js` line 2558 (`if (!FSB._sheetsHealthCheckDone)`) and multiple `spreadsheets\/d\/` URL checks in the snapshot builder (lines 2540, 2558) assume only one app uses fsbElements. When 7 apps use fsbElements, these checks either never fire (wrong URL) or fire incorrectly.

The logging uses Sheets-specific event names: `sheets_injection`, `sheets_selector_match`. When Notion triggers fsbElement injection, the logs will say "sheets_injection" -- misleading and confusing for debugging.

**Why it happens:**
Natural consequence of single-app scope in v10.0.

**Consequences:**
- Health checks don't run for new apps, so broken selector configurations go undetected
- Debug logs are misleading
- `FSB._sheetsHealthCheckDone` flag means only ONE app per page load gets health-checked

**Prevention:**
Replace `_sheetsHealthCheckDone` with `_fsbHealthCheckDone` (or per-guide tracking). Generalize log event names to `fsb_element_injection`, `fsb_selector_match`. Make the health check trigger for ANY page with fsbElements, keyed by the matched guide's `site` name.

**Phase/Task:** Phase 1 infrastructure refactor, same PR as Pitfalls 1 and 2.

---

### Pitfall 4: Adding 7 Guide Files Increases options.html Script Tag Count to ~60

**What goes wrong:**
The project already has a known tech debt item: "53 script tags for per-site guide files in options.html." Adding 7 more productivity guide files pushes this to 60. Each guide is loaded via a separate `<script>` tag in options.html AND via `importScripts()` in the service worker. This creates:
1. Slower options page load
2. Larger service worker startup time (importScripts is synchronous)
3. Manifest V3 service worker can be killed and restarted -- each restart re-imports all 60 scripts

**Why it happens:**
The "no build system" constraint means no bundling. Each file is loaded individually.

**Consequences:**
- Service worker restart latency increases (each importScripts call is a file read)
- First-message-after-wake delays increase noticeably
- May hit Chrome's service worker startup timeout on slower machines

**Prevention:**
This is NOT a blocker -- 60 files is still manageable. But consider two mitigations:
1. **Lazy loading for options page**: Only load guides when the Site Guides Viewer tab is opened
2. **Category bundling for service worker**: Combine all productivity guides into one file (`productivity-bundle.js`) that self-registers each guide. This reduces importScripts calls from 60 to ~15.

**Phase/Task:** Optional optimization, can be deferred. Flag it if service worker restart becomes noticeably slow during testing.

---

### Pitfall 5: Keyword Matching in getGuideForTask() Does Not Cover New Apps

**What goes wrong:**
The `categoryKeywords` object in `site-guides/index.js` (line 193) only has `strong` keywords for Google Sheets and Google Docs. When a user says "create a task in Todoist" or "add a card to Trello", the keyword matcher will not find a match because "todoist", "trello", "notion", etc. are not in the keyword list. The URL-based match (`getGuideForUrl`) WILL work when the user is already on the app. But for tasks initiated from a different page (e.g., "go to Notion and create a new page"), the keyword fallback fails.

**Why it happens:**
The keyword system was designed for Google Workspace only. The new apps have distinct enough names that strong keyword matching should work well.

**Consequences:**
- Site guide not loaded when task is started from a non-matching URL
- AI operates without site-specific guidance, leading to generic (and often wrong) element targeting
- No fsbElements injected, no workflows available

**Prevention:**
Add each app's name and common aliases to the `categoryKeywords['Productivity Tools']` strong/weak lists:
- Strong: `notion`, `google calendar`, `trello`, `google keep`, `todoist`, `airtable`, `jira`
- Weak: `kanban`, `board`, `sprint`, `calendar event`, `note`, `todo`, `task board`, `database view`

**Phase/Task:** Phase 1, alongside guide registration. Small change, high impact.

---

## App-Specific Critical Pitfalls

---

### Pitfall 6: Notion -- Slash Commands and Contenteditable Block Boundaries

**What goes wrong:**
Notion's block editor uses individual `[contenteditable="true"]` divs for each block (paragraph, heading, list item, etc.). When FSB's `type` action targets a contenteditable element:
1. **Cursor position is unpredictable** -- clicking a Notion block places the cursor at the click coordinates within that block, not at the end. If the AI says `type e5 "new text"`, the text may be inserted mid-word.
2. **Typing "/" triggers the slash command menu** -- if the AI types a forward slash as part of data entry (e.g., "03/16/2026"), Notion intercepts it and opens a block type picker overlay, consuming the remaining keystrokes.
3. **Block boundaries break sequential typing** -- pressing Enter in a Notion block creates a NEW block (new contenteditable div), not a newline within the block. The DOM reference the AI was targeting (e.g., `e5`) is now stale. The new block is a different element.
4. **@ triggers mention popup** -- typing `@` opens the mention picker. The AI must dismiss it (Escape) before continuing to type.

**Why it happens:**
Notion's editor is designed for human interaction where "/" and "@" are intentional triggers. Automated typing that includes these characters is not anticipated.

**Consequences:**
- Data containing "/" or "@" characters causes the editor to enter an unexpected menu state
- Multi-line content entry fails because each Enter creates a new block with a new element ref
- Cursor positioning errors cause text to appear in the wrong place within a block

**Prevention:**
1. **Keyboard-first approach**: Use Cmd+Enter for new blocks, Shift+Enter for newlines within a block. Document this distinction in the guide's guidance text.
2. **Character escaping**: For data entry containing `/` or `@`, guide the AI to use Shift+/ (which types `/` without triggering slash commands in most Notion contexts) or to type the full text via clipboard paste (`Cmd+V` with text in clipboard).
3. **Block navigation warnings**: Add explicit warnings that Enter changes the active element ref, and the AI should re-request the DOM snapshot after creating new blocks.
4. **End-of-block cursor**: Instruct AI to press End key before typing to ensure cursor is at the end of the block content.

**Phase/Task:** Notion guide implementation phase. These must be in the `warnings` array and `guidance` text.

---

### Pitfall 7: Notion -- Hashed CSS Classes and Selector Strategy

**What goes wrong:**
Notion uses CSS Modules (or a similar hashing mechanism) for component-level styles. Classes like `notion-page-content`, `notion-scroller`, `notion-frame` are stable (they are semantic, developer-chosen names). But many interactive elements have classes like `focusable-within` and layout elements have classes like `whenContentEditable` that may change. The sidebar, page list, and database views use dynamically generated class names.

**Why it happens:**
React + CSS Modules is standard practice for large SPAs. Notion does not provide `data-testid` attributes -- they are not a test-automation-friendly app.

**Consequences:**
- Selectors based on class names break on Notion deploys (Notion deploys continuously)
- Multi-strategy selectors need to avoid class-based strategies entirely for volatile elements
- The stable patterns are: `[contenteditable]`, `[role]`, `[placeholder]` text, `[data-block-id]` (per-block UUID), and structural selectors (`.notion-page-content [contenteditable]:first-child`)

**Prevention:**
For Notion fsbElements, prioritize in this order:
1. `role` + `aria-label` (e.g., `[role="button"][aria-label="New page"]`)
2. `placeholder` text (e.g., `[placeholder="Untitled"]`, `[placeholder="Type '/' for commands"]`)
3. Structural/positional (e.g., `.notion-sidebar [role="treeitem"]`)
4. `data-block-id` patterns for block-level targeting (UUIDs are page-specific but structurally reliable)
5. Class-based as last resort, only for `.notion-*` prefixed classes which are historically stable

**Phase/Task:** Notion guide implementation. Each fsbElement needs 4-5 strategies tested against the live DOM.

---

### Pitfall 8: Google Calendar -- Time Grid is NOT Canvas but Has Its Own DOM Complexity

**What goes wrong:**
Unlike Google Sheets, Google Calendar does NOT use canvas rendering for the calendar grid. The time grid is DOM-based but uses complex absolute positioning with `[data-datekey]` and `[data-eventid]` attributes. However, the event creation flow is problematic:
1. **Quick-add popover** appears when clicking an empty time slot -- it is a floating dialog with no stable class selector, identified by `[role="dialog"]`.
2. **Event detail popover** appears when clicking an existing event -- it is a DIFFERENT dialog type from the creation popover.
3. **Full event editor** opens when clicking "More options" -- this navigates to a separate URL (`/calendar/r/eventedit`), which is a different SPA route.
4. **Date/time pickers** are Google's Material Design custom components, not native inputs. They use nested `[role="listbox"]` and `[role="option"]` patterns.
5. **Drag-to-create** and **drag-to-resize** events use mouse event sequences that cannot be reliably automated via CDP keyboard/click emulation.

**Why it happens:**
Google Calendar's UI was designed for mouse-centric interaction. The SPA routing between views (day/week/month/year) changes the DOM structure entirely.

**Consequences:**
- Trying to create events by clicking time slots produces timing-sensitive popovers that may close before the AI can fill in details
- The full event editor URL is a different route pattern that needs its own URL pattern match
- Date/time selection requires navigating custom pickers, not typing into inputs

**Prevention:**
1. **Keyboard-first event creation**: Use the shortcut `c` to open the new event dialog directly (bypasses time slot click timing issues). Fill in fields sequentially.
2. **URL patterns**: Register multiple URL patterns: `/calendar/`, `/calendar/r/eventedit`, `/calendar/r/day`, `/calendar/r/week`, etc.
3. **Popover timing**: Add explicit `waitForElement` with `[role="dialog"]` before attempting to fill in event details.
4. **Date/time entry**: Type dates as text into the date input field (Google Calendar accepts typed dates in locale format) rather than using the picker widget.
5. **Avoid drag operations**: Never attempt drag-to-create or drag-to-resize. Always use keyboard/form-based creation and editing.

**Phase/Task:** Google Calendar guide implementation. Document the keyboard-centric workflow prominently.

---

### Pitfall 9: Trello -- Card Modal Overlays and Back-Navigation State

**What goes wrong:**
Trello uses a distinctive URL-routed card modal pattern:
1. Opening a card changes the URL to `/c/[cardId]/[card-name]` but does NOT navigate to a new page -- it overlays a modal on the board view.
2. Closing the modal (clicking outside, pressing Escape, or clicking the X) returns to the board URL.
3. The FSB URL pattern matcher will see the card URL and may try to match a different guide pattern.
4. The board DOM remains in the background behind the modal but is not interactive.
5. The card modal uses `data-testid` attributes on many elements (e.g., `data-testid="card-back-name"` for the card title).

**Why it happens:**
Trello's modal-as-route pattern is a common SPA idiom but unusual for FSB which expects URL changes to mean page navigation.

**Consequences:**
- URL pattern matching may produce false transitions (board -> card URL looks like a navigation)
- The AI may try to interact with board elements that are behind the modal overlay and fail obscuration checks
- Pressing Escape to "exit" (a common FSB recovery action) closes the card modal unexpectedly

**Prevention:**
1. **URL patterns**: Use a broad pattern that matches both board and card URLs: `/trello\.com\/b\//` (board base) covers both states since card URLs are `/b/[boardId]/[board-name]/c/[cardId]`.
2. **Modal awareness**: Add guidance that when a card modal is open, only interact with elements inside `[data-testid="card-back"]` or the modal container. The AI should NOT try to interact with the board behind the modal.
3. **Escape key warning**: Add a prominent warning that Escape closes the current card modal. Use it only intentionally for modal dismissal, not as a general "reset" action.
4. **Data-testid selectors**: Trello's `data-testid` attributes are the most reliable selectors. Build fsbElements around them.

**Phase/Task:** Trello guide implementation. The URL pattern design is critical to get right.

---

### Pitfall 10: Airtable -- Virtual Scrolling Grid Destroys DOM Elements

**What goes wrong:**
Airtable's grid view uses React virtualized scrolling (historically `react-virtualized`, now likely a custom implementation). This means:
1. **Only visible rows/cells exist in the DOM** -- scrolling creates new DOM elements and destroys out-of-viewport ones.
2. **Element refs become stale instantly** -- the AI requests a snapshot showing `e5` as row 3, column B. By the time the AI responds with `click e5`, the user may have scrolled and `e5`'s underlying DOM element has been destroyed and replaced.
3. **Cell editing opens an expanded overlay** -- clicking a cell does not make it editable in-place (unlike Sheets). It may open a popover or modal depending on field type (long text, attachments, linked records all have different expansion patterns).
4. **Field type diversity** -- each Airtable field type (single select, multi-select, date, checkbox, rating, etc.) has a completely different editing UI. A "type" action works for text fields but not for select fields (which need click interactions with dropdown options).

**Why it happens:**
Airtable manages thousands of rows with dozens of field types. Virtual scrolling is necessary for performance but hostile to DOM-based automation.

**Consequences:**
- Stale element references are the #1 failure mode
- A single "navigate to cell and type" workflow does not work -- each field type needs its own interaction pattern
- The AI cannot "see" rows that are scrolled out of view

**Prevention:**
1. **Keyboard navigation**: Use Tab and arrow keys to navigate between cells rather than clicking specific element refs. Airtable supports keyboard navigation within the grid.
2. **Expanded record modal**: For complex field types, guide the AI to click the row expander to open the expanded record view, which renders ALL fields in a stable modal form.
3. **Field type dispatch**: The guide's `guidance` text must explain that different field types require different actions (type for text, click+select for dropdowns, click for checkboxes, etc.).
4. **Limit grid interactions**: Prefer expanded record editing over in-grid editing for any field type beyond plain text.
5. **Fresh snapshot per action**: Warn the AI that element refs in the grid are volatile -- request a fresh snapshot between sequential grid interactions.

**Phase/Task:** Airtable guide implementation. The field type dispatch table is the most complex guidance of all 7 apps.

---

### Pitfall 11: Jira -- New UI Rollout Creates a Moving Target

**What goes wrong:**
Atlassian is actively rolling out a "new UI" for Jira Cloud throughout 2025-2026. This means:
1. **Two versions coexist** -- some organizations see the old UI, others the new. Some views are new UI while others remain old.
2. **Selector sets differ between versions** -- the old UI uses AtlasKit v11 components, the new uses updated AtlasKit with different compiled CSS class names.
3. **Issue creation modal changed** -- the old modal had a simple form, the new has a multi-step wizard with different field layouts.
4. **Board view drag-and-drop** -- the implementation details change between old and new UI.
5. **Sprint planning views** -- new UI reorganized the backlog/sprint panel layout.

**Why it happens:**
Jira is a massive product undergoing a multi-year UI migration. Atlassian does not maintain backward compatibility for DOM selectors during transitions.

**Consequences:**
- A guide built against the new UI may fail for organizations still on the old UI
- Selectors that work today may break in weeks as Atlassian continues the rollout
- `data-testid` attributes are present in both UIs but the values may differ

**Prevention:**
1. **Target new UI only**: Build the guide for the current (2026) new UI. The old UI is being deprecated -- do not waste effort supporting both.
2. **Use `data-testid` as primary strategy**: Atlassian uses `data-testid` extensively in their design system. These are the most stable selectors.
3. **Fallback to aria-label**: `[aria-label="Create issue"]`, `[aria-label="Board"]`, etc. are consistent across UI versions.
4. **Version detection**: Add a detection function in the guide that checks for new UI markers (e.g., `[data-ds--page-layout--container]` is new design system) and adjusts guidance accordingly.
5. **Accept shorter shelf life**: Jira guides will need maintenance updates more frequently than other apps. Plan for quarterly selector validation.

**Phase/Task:** Jira guide implementation. Selector validation against live Jira instance is mandatory before shipping.

---

### Pitfall 12: Todoist -- Extensive Single-Key Shortcuts Conflict with FSB

**What goes wrong:**
Todoist uses 20+ single-key shortcuts without modifiers: Q (Quick Add), E (complete task), A (add task), M (sidebar), H (home), T (set date), Y (priority), C (comment), L (label), V (move), S (section), D/P/N/R (sort), F or / (search). When FSB sends keystrokes via CDP's `Input.dispatchKeyEvent`, these keypresses are intercepted by Todoist's keyboard handler BEFORE reaching any focused input element.

**Why it happens:**
Todoist attaches a global `keydown` listener to the document that checks if an input/textarea is focused. If not, single keys trigger app actions. When FSB dispatches keys via CDP, the event fires on the document first.

**Consequences:**
- Typing text into a task field may trigger sidebar toggle (M), search (/), or other actions if the input loses focus for even one frame
- The AI types "Monday" and the M opens the sidebar, "onday" goes into the now-hidden search field
- Quick Add (Q) may fire unexpectedly during text entry

**Prevention:**
1. **Always ensure focus before typing**: The guide must instruct the AI to click the target input element and verify it has focus BEFORE typing. Never type without an element ref.
2. **Use `type` with element ref, not bare `key` commands**: FSB's `type e5 "text"` focuses the element first. Bare `key "m"` would trigger the shortcut.
3. **Escape sequence awareness**: Pressing Escape in Todoist dismisses modals/panels and returns focus to the task list -- where single-key shortcuts become active again. The guide must warn about this.
4. **Quick Add pattern**: Use the keyboard shortcut Q to open Quick Add, then type into the focused input. Do NOT try to find and click the Quick Add button.

**Phase/Task:** Todoist guide implementation. The warnings section must prominently cover the shortcut conflict risk.

---

### Pitfall 13: Google Keep -- Deceptively Simple but Card Focus is Tricky

**What goes wrong:**
Google Keep appears simple (card grid, note editing) but has subtle interaction patterns:
1. **Card grid is not a standard grid** -- cards are positioned via CSS grid/masonry layout. Clicking a card opens it as an expanded modal overlay, not inline editing.
2. **The expanded note overlay** captures all keyboard input. Pressing Escape closes it. There is no "save" button -- changes are auto-saved.
3. **Checkbox lists** in Keep have their own interaction model -- checking a box moves the item to a "completed" section within the note, changing the DOM structure.
4. **Color picker and labels** use popovers that appear at the bottom of the note overlay. They are transient and close on outside click.
5. **Note creation** is done by clicking the "Take a note..." input at the top, which expands into a multi-field form (title + body). The expansion animation means the body field is not immediately available after clicking.

**Why it happens:**
Keep is optimized for quick capture, not structured data entry. The UI is intentionally minimal with implicit save behavior.

**Consequences:**
- Attempting to type into a card directly (without opening it) fails -- the click opens the overlay instead
- Rapid interaction after opening a note may fail because the expansion animation has not completed
- Checkbox interactions change DOM order, invalidating element refs

**Prevention:**
1. **Open-then-edit pattern**: Click card to open -> wait for overlay -> interact with elements inside overlay. Never try to edit cards in the grid view.
2. **Animation delay**: After clicking "Take a note..." or opening a card, add a brief wait (300-500ms) or `waitForElement` for the note body input.
3. **Checkbox warning**: Document that checking a checkbox moves the item DOM node. The AI should re-request the snapshot after checkbox operations.
4. **Auto-save reliance**: Instruct the AI that there is no save action needed. Just click outside the note or press Escape to close and save.

**Phase/Task:** Google Keep guide implementation. Keep is the simplest of the 7 apps, suitable for early implementation as a confidence builder.

---

## Moderate Pitfalls

---

### Pitfall 14: SPA Routing Breaks URL Pattern Matching Across Views

**What goes wrong:**
All 7 apps are SPAs that change URLs without full page navigation:
- **Notion**: `/[workspace-id]/[page-id]` -- each page is a different UUID path
- **Google Calendar**: `/calendar/r/week`, `/calendar/r/day`, `/calendar/r/month` -- view changes are URL changes
- **Trello**: `/b/[boardId]/...`, `/c/[cardId]/...` -- board vs card modal
- **Todoist**: `/app/project/[id]`, `/app/today`, `/app/inbox` -- view-based routing
- **Airtable**: `/[baseId]/[tableId]/[viewId]` -- base/table/view hierarchy
- **Jira**: `/jira/software/projects/[key]/boards/[id]`, `/browse/[issue-key]` -- project/board/issue routing

The `getGuideForUrl()` function tests URL patterns once when the session starts. If the user navigates within the SPA (e.g., from Notion page A to page B), the URL changes but no new page load occurs. The guide remains matched (good), but if the URL changes to a fundamentally different view (e.g., Jira board -> Jira issue), the guide context may need updating.

**Prevention:**
1. **Broad URL patterns**: Use domain-level patterns, not path-specific. E.g., `/notion\.so/` not `/notion\.so\/[a-f0-9-]+/`.
2. **Per-iteration guide lookup**: The `background.js` already re-resolves the guide on each iteration (line 8478). This handles SPA navigation correctly as long as patterns are broad enough.
3. **View-specific guidance within single guide**: Rather than separate guides for "Jira Board" and "Jira Issue", use one Jira guide with view-detection logic in the guidance text.

**Phase/Task:** URL pattern design for each guide. Test with multiple views per app.

---

### Pitfall 15: Modal/Popover Timing -- Acting Before the UI Stabilizes

**What goes wrong:**
All 7 apps use animated modals, popovers, and dropdown menus that take 100-400ms to fully render:
- **Notion**: Slash command menu, @ mention picker, link picker, database filter popover
- **Google Calendar**: Event creation popover, date picker, time picker, guest suggestion dropdown
- **Trello**: Card modal opening, label picker, member picker, due date picker
- **Todoist**: Quick Add expansion, date picker, label picker, priority picker
- **Airtable**: Cell expansion modal, field config modal, dropdown options
- **Jira**: Create issue modal (particularly slow -- loads field schemas dynamically), sprint scope picker
- **Google Keep**: Note expansion overlay, color picker, label picker

If the AI tries to interact with elements inside these containers before they finish rendering, clicks miss their targets or type actions go to the wrong element.

**Why it happens:**
FSB's outcome-based dynamic delays work well for page-level transitions but may not detect modal/popover appearance within an already-loaded page.

**Consequences:**
- Clicks on not-yet-rendered popover elements fail silently
- Type actions go to the element behind the popover (the one that had focus before the popover appeared)
- The AI retries, the popover has now fully rendered, the retry succeeds -- but at the cost of wasted iterations

**Prevention:**
1. **`waitForElement` in workflows**: Every workflow step that triggers a modal/popover should include a `waitForElement` step targeting the container (e.g., `[role="dialog"]`, `[role="menu"]`, `[role="listbox"]`).
2. **Guidance text**: Explicitly tell the AI to wait for specific elements after triggering popovers. E.g., "After pressing /, wait for the block type menu to appear before typing the block type name."
3. **Popover fsbElements**: Define fsbElements for common popover containers with role-based selectors that the AI can use as "readiness signals."

**Phase/Task:** Each app's guide implementation. Include waitForElement steps in all workflows that trigger popovers.

---

### Pitfall 16: Drag-and-Drop Cannot Be Reliably Automated

**What goes wrong:**
Several apps rely heavily on drag-and-drop:
- **Trello**: Card reordering, moving cards between lists
- **Jira**: Sprint board card movement, backlog prioritization
- **Google Calendar**: Event rescheduling (drag to different time/day), event resizing
- **Airtable**: Row reordering, kanban card movement
- **Notion**: Block reordering, database row reordering

FSB's CDP-based automation can dispatch mouse events (mousedown, mousemove, mouseup) but drag-and-drop requires:
1. Precise coordinate sequences (start point, intermediate points, end point)
2. HTML5 Drag and Drop API events (dragstart, drag, dragover, dragenter, drop, dragend) OR pointer event sequences
3. Framework-specific drag libraries (react-beautiful-dnd, react-dnd, @hello-pangea/dnd) that listen for specific event sequences and may reject synthetic events

**Why it happens:**
Drag-and-drop libraries are designed to work with real user gesture sequences. Synthetic events dispatched by CDP may not carry the correct `dataTransfer` objects or may fire in the wrong sequence.

**Consequences:**
- Attempting to drag a Trello card between lists via automation will fail silently -- the card snaps back to its original position
- Jira sprint board card movement fails
- Google Calendar event rescheduling fails

**Prevention:**
1. **Provide keyboard alternatives for EVERY drag operation** in the guide:
   - Trello: Use card's "Move" action (accessible via card back menu) instead of drag
   - Jira: Use the "Move to Sprint" action from the issue context menu
   - Google Calendar: Edit the event and change the date/time fields instead of drag-resizing
   - Airtable: Use sort/filter instead of manual row reordering
   - Notion: Use Cmd+Shift+Up/Down to move blocks instead of drag handles
2. **Anti-feature documentation**: Explicitly state in each guide: "Do NOT attempt drag-and-drop. Use keyboard/menu alternatives."
3. **Workflow alternatives**: Every workflow that a user might accomplish via drag should have a keyboard/menu equivalent documented.

**Phase/Task:** All 7 guide implementations. This is a design decision, not a bug to fix.

---

### Pitfall 17: Contenteditable Diversity Across Apps

**What goes wrong:**
Four of the 7 apps use `contenteditable` elements, but each behaves differently:

| App | Contenteditable Pattern | Gotcha |
|-----|------------------------|--------|
| **Notion** | One `[contenteditable]` per block. Enter creates new block (new element). | Element ref invalidation on Enter |
| **Todoist** | Task title/description are contenteditable. Markdown-like formatting. | Typing `/` or `@` may trigger autocomplete in newer versions |
| **Airtable** | Long text fields use contenteditable in expanded record modal. Rich text fields support markdown. | Different behavior in grid cell vs expanded record |
| **Jira** | Description field uses Atlassian Editor (ProseMirror-based). Rich text with / command palette. | ProseMirror manages its own cursor state; fill() may not work |

The FSB `type` action handles contenteditable elements by focusing and using `document.execCommand('insertText')` or CDP `Input.insertText`. Both approaches work differently with each app's custom contenteditable handlers.

**Why it happens:**
Each app wraps contenteditable with its own event handlers, custom input processing, and state management. There is no standard behavior.

**Consequences:**
- `type` action may produce duplicated text (Playwright bug #36715 documents this for custom contenteditable handlers)
- Formatting characters may be interpreted as commands
- Cursor position after type may not be where expected

**Prevention:**
1. **Test each app's contenteditable behavior**: Verify that FSB's type action works correctly with each app's specific implementation. Document which input method works (insertText vs dispatchKeyEvent vs execCommand).
2. **Fallback to CDP key-by-key**: If `Input.insertText` fails, fall back to `Input.dispatchKeyEvent` for each character. This is slower but more compatible with custom handlers.
3. **App-specific type guidance**: In each guide's warnings, document how contenteditable behaves and what the AI should expect after typing.

**Phase/Task:** Each app's guide implementation. Test contenteditable behavior early.

---

### Pitfall 18: Rate Limiting and Anti-Automation Detection

**What goes wrong:**
Some apps may detect or throttle automated interactions:

| App | Risk | Details |
|-----|------|---------|
| **Jira Cloud** | HIGH | Explicit API rate limiting (100 req/sec GET, 50 req/sec PUT). Browser automation triggers XHR requests that count against these limits. Fast sequential operations (bulk issue creation) may hit 429s. |
| **Notion** | MODERATE | Uses Cloudflare. Aggressive rapid page switching may trigger bot detection challenges. |
| **Airtable** | MODERATE | API rate limit of 5 requests/second per base. Browser operations that trigger API calls (saving records) are subject to this. |
| **Trello** | LOW | API rate limit of 100 requests per 10 seconds per token. Browser automation rarely hits this. |
| **Google Calendar** | LOW | Google Workspace apps have internal rate limiting but it is generous for single-user browser interaction. |
| **Google Keep** | LOW | Minimal API calls for note operations. |
| **Todoist** | LOW | API rate limit exists but browser interactions are well below threshold. |

**Prevention:**
1. **Pace operations**: For Jira bulk operations, add 200ms delays between issue creation/update operations.
2. **Monitor for 429 responses**: If the page shows an error banner or the AI sees "rate limit" or "too many requests" text, pause and retry.
3. **Avoid rapid navigation**: Do not cycle through multiple Notion pages in quick succession.
4. **Jira-specific**: Add guidance about rate limiting in the Jira guide warnings. The AI should not attempt bulk issue creation without pacing.

**Phase/Task:** Jira and Airtable guides specifically. Add rate-limit warnings to those guides.

---

## Minor Pitfalls

---

### Pitfall 19: Shared Category Guidance Needs Updating

**What goes wrong:**
The current `_shared.js` for Productivity Tools (at `site-guides/productivity/_shared.js`) only mentions Google Sheets and Google Docs canvas-based rendering. Adding 7 non-canvas apps to the same category means the shared guidance about "canvas-based rendering" and "Name Box navigation" is misleading for Notion, Trello, etc.

**Prevention:**
Rewrite `_shared.js` to only include truly universal productivity tool guidance (keyboard shortcuts, auto-save patterns, modal interaction patterns). Move canvas-specific guidance to the Google Sheets and Google Docs guides.

**Phase/Task:** Phase 1, alongside guide infrastructure. Small refactor.

---

### Pitfall 20: Element Budget (50 elements) May Be Tight for Complex Apps

**What goes wrong:**
FSB caps the DOM snapshot at 50 interactive elements. Jira's issue view, Airtable's grid with multiple field types, and Notion's block-heavy pages may have 100+ interactive elements. The scoring algorithm filters to the most relevant 50, but fsbElements may not all survive the cut if many page elements score higher.

**Prevention:**
fsbElements injected in Stage 1b are added to the candidate array before scoring. They should be given priority in the scoring stage. Verify that the scoring algorithm does not filter out fsbElements. If needed, add a score boost for elements with `data-fsbRole` set.

**Phase/Task:** Test during each guide's implementation. If fsbElements are being filtered out, adjust scoring in dom-analysis.js.

---

### Pitfall 21: Notion and Todoist Dark Mode Changes Selector Attributes

**What goes wrong:**
Both Notion and Todoist support dark mode. Some CSS selectors may include theme-specific attributes or classes that change between light and dark mode. If fsbElements are tested only in light mode, they may fail in dark mode.

**Prevention:**
Test all fsbElements in both light and dark mode. Use attribute selectors that are theme-independent (role, aria-label, data-testid, structural position).

**Phase/Task:** QA step for each guide. Low effort, easy to miss.

---

### Pitfall 22: Multiple Guides for Same Domain (Google Calendar + Google Keep under google.com)

**What goes wrong:**
Google Calendar lives at `calendar.google.com` and Google Keep at `keep.google.com`. The `extractDomain()` function in `index.js` handles subdomains but the URL pattern matching needs to be precise enough to distinguish them. Both are Google products on `google.com` subdomains.

**Prevention:**
Use hostname-specific patterns:
- Google Calendar: `/calendar\.google\.com/` (primary) and `/calendar\.google\.com\/calendar/` (specific views)
- Google Keep: `/keep\.google\.com/`

The existing `extractDomain()` function handles known subdomains (finance, mail, drive, docs, maps) but `calendar` and `keep` are not in the list (line 89). Add them.

**Phase/Task:** Phase 1 infrastructure, when registering new guide URL patterns. Test that Google Sheets, Google Docs, Google Calendar, and Google Keep all resolve to the correct guide.

---

## Phase-Specific Warnings

| Phase/Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 1: Infrastructure refactor** | Pitfalls 1, 2, 3 -- fsbElements injection, isCanvasBasedEditor, health check generalization | Must be completed BEFORE any app guide work. Test with Google Sheets to verify no regression. |
| **Phase 1: URL patterns** | Pitfall 14, 22 -- SPA routing, multi-Google-domain conflicts | Design all 7 URL patterns together to avoid overlap. Test with getGuideForUrl() against example URLs. |
| **Phase 1: Keyword matching** | Pitfall 5 -- missing keywords | Add all app names/aliases in one commit. |
| **App guides: Notion** | Pitfalls 6, 7, 17 -- slash commands, hashed classes, contenteditable | Highest complexity. Needs thorough DevTools inspection. |
| **App guides: Airtable** | Pitfalls 10, 17 -- virtual scrolling, field type diversity | Second highest complexity. Expanded record modal is the safe editing path. |
| **App guides: Jira** | Pitfalls 11, 18 -- moving target UI, rate limiting | Build for new UI only. Accept need for maintenance updates. |
| **App guides: Google Calendar** | Pitfall 8, 16 -- time grid complexity, drag operations | Keyboard-first event creation. Avoid drag entirely. |
| **App guides: Trello** | Pitfall 9, 16 -- card modal routing, drag | data-testid is your friend. Move action replaces drag. |
| **App guides: Todoist** | Pitfall 12, 17 -- single-key shortcuts, contenteditable | Always verify input focus before typing. |
| **App guides: Google Keep** | Pitfall 13 -- card expansion timing | Simplest app. Good starting point for testing the generalized infrastructure. |
| **All guides: Drag-and-drop** | Pitfall 16 -- not automatable reliably | Document keyboard/menu alternatives for every drag operation. |
| **All guides: Popovers** | Pitfall 15 -- timing | waitForElement in every workflow that triggers a popover. |
| **All guides: Contenteditable** | Pitfall 17 -- diverse behavior | Test type action per app. Document quirks in warnings. |

---

## Integration Testing Checklist

After the infrastructure refactor (Pitfalls 1-3) and before shipping any new guide:

- [ ] Google Sheets still works exactly as before (regression check)
- [ ] Google Docs still works (it uses isCanvasBasedEditor, must not break)
- [ ] fsbElements injection fires for new app URLs (verify via console logs)
- [ ] Health check reports correctly per app
- [ ] Scoring does not filter out fsbElements
- [ ] getGuideForUrl() returns correct guide for all 7 app URLs
- [ ] getGuideForUrl() still returns Google Sheets guide for sheets.google.com
- [ ] Keyword matching resolves "create a page in Notion" to the Notion guide
- [ ] No Google domain confusion (Calendar vs Keep vs Sheets vs Docs)
- [ ] _shared.js category guidance is not misleading for non-canvas apps

---

## Sources

**Codebase analysis (HIGH confidence):**
- `content/dom-analysis.js` lines 1758-1870: fsbElements injection, findElementByStrategies
- `content/messaging.js` line 217: isCanvasBasedEditor() function
- `content/actions.js` lines 1105, 2438: canvas editor bypasses
- `content/accessibility.js` line 642: obscuration check bypass
- `background.js` line 8478-8483: guide selector resolution
- `site-guides/index.js` line 193: categoryKeywords for Productivity Tools
- `site-guides/productivity/google-sheets.js`: fsbElements pattern reference

**Web research (MEDIUM confidence):**
- [Notion keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts) -- slash commands and @ mentions
- [Todoist keyboard shortcuts](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2) -- 20+ single-key shortcuts
- [Jira Cloud rate limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/) -- 100 req/sec burst, points-based hourly
- [Jira 2025 UI evolution](https://community.atlassian.com/forums/Jira-articles/Jira-s-ever-evolving-UI-2025-Edition/ba-p/2966105) -- ongoing UI migration
- [Notion Boost slash command conflicts](https://github.com/GorvGoyl/Notion-Boost-browser-extension/issues/88) -- extension + slash command interference
- [Playwright contenteditable bug #36715](https://github.com/microsoft/playwright/issues/36715) -- fill() duplicates text in custom contenteditable
- [CSS Modules selector fragility](https://github.com/css-modules/css-modules/issues/194) -- hashed class names break automation
- [notion-enhancer CSS tweaks](https://github.com/notion-enhancer/tweaks) -- data-block-id usage patterns
- [Airtable React adoption](https://medium.com/@matt_bush/how-airtable-uses-react-5e37066a87d4) -- virtual DOM and performance optimization
- [Browser extension keyboard shortcut conflicts](https://www.mathiaspolligkeit.com/two-common-pitfalls-for-keyboard-shortcuts-in-web-applications/) -- event.preventDefault patterns

**App-specific DOM patterns (LOW confidence -- needs validation via DevTools inspection):**
- Notion: `data-block-id`, `.notion-page-content`, `[placeholder]` attributes
- Airtable: `[data-columnid]`, `[data-rowid]`, `[role="gridcell"]`
- Jira: `data-testid` attributes, `[data-ds--*]` design system attributes
- Trello: `data-testid` attributes on cards and modals
- Google Calendar: `[data-datekey]`, `[data-eventid]`, `[role="dialog"]`
- Google Keep: `[aria-label]` patterns on note cards
- Todoist: `[data-testid]` if present, `[aria-label]` patterns
