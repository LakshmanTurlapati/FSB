# Phase 30: Productivity Site Intelligence - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Generalize the fsbElements injection pipeline (Stage 1b) from Sheets-only to any site guide, then create full site guides with fsbElements, multi-strategy selectors, keyboard-first guidance, step-by-step workflows, and stuck recovery for 7 productivity apps: Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, and Jira. Also investigate and build a drag-and-drop mechanical tool for apps that rely on drag operations (Trello card moves, Calendar event resize, etc.).

</domain>

<decisions>
## Implementation Decisions

### Workflow depth
- Match Google Sheets depth: every app gets 5-8 detailed workflows with exact keyboard sequences and fallback patterns (~300-400 lines per guide)
- Document exact keystroke-by-keystroke sequences (e.g., "press Q to open Quick Add → type task text → press Enter"), not intent-based descriptions
- Every workflow ends with a verification step telling the AI how to confirm the action worked (e.g., "verify by checking [specific element/state]")
- Every workflow includes stuck recovery patterns with fallback path if the primary approach fails

### Interaction strategy
- Always keyboard-first for ALL apps — keyboard is primary, click instructions only as fallback
- For apps requiring opt-in keyboard shortcuts (Google Calendar), guide's first workflow step is "Enable keyboard shortcuts in Settings"
- For contenteditable editors (Notion, Jira): always click-then-type — click the target block/field first to establish focus, then type
- Drag-and-drop: investigate and build a mechanical drag-and-drop tool using Input.dispatchMouseEvent (mousedown → mousemove → mouseup sequences at exact coordinates) or native DragEvent injection. Do NOT simply document keyboard alternatives — solve the drag problem

### App-specific features
- Todoist Quick Add is THE primary create method — document full natural language syntax (#project @label pN date)
- Notion slash commands are the primary block creation method — document all common slash commands with exact syntax
- Jira: full form coverage — guide documents how to fill every common field in the create issue modal (dropdowns, user pickers, rich text description, story points, sprint, labels)
- Airtable: per-field-type interaction guidance — document how to interact with each field type (text click+type, select click+pick, date click+picker, checkbox click, linked record click+search, attachment, formula)

### Selector philosophy
- Match Sheets density: 15-25 fsbElements per app covering toolbar, navigation, create buttons, modals, and view controls
- Always 5 strategies per fsbElement (id, class, aria, role, context) — consistent across all apps
- aria/role-first strategy ordering for React apps with hashed CSS (Notion, Airtable). data-testid first for Atlassian apps (Trello, Jira)
- Reuse Sheets diagnostic pattern: health check on first page load logs which selector matched per fsbElement

### Claude's Discretion
- Exact selector values per fsbElement (discovered during live DevTools inspection)
- Specific block of 5-8 workflows chosen per app (based on most common user tasks from research)
- Internal structure of the drag-and-drop tool (CDP approach vs native DragEvent injection — whichever proves reliable)
- How to handle Airtable's exotic field types (formula, rollup) if they can't be edited directly

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants drag-and-drop to WORK, not be avoided. Build a tool for it. If it proves infeasible with CDP, explore page-level script injection as last resort.
- Every guide should feel as comprehensive as Google Sheets — the user considers Sheets the gold standard for site intelligence
- Todoist Quick Add natural language and Notion slash commands are the most important differentiators — these should be documented thoroughly
- All 7 apps need the full treatment: fsbElements, guidance, workflows, warnings, verification, recovery

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `findElementByStrategies()` in dom-analysis.js: multi-strategy selector lookup — already generic, works for any fsbElements definition
- Stage 1b injection in dom-analysis.js (lines 1764-1803): injects fsbElements with data-fsbRole — needs URL gate generalized from Sheets-only
- `registerSiteGuide()` in site-guides/index.js: URL pattern registration — works for any new site guide
- `google-sheets.js` (400+ lines): reference implementation for fsbElements, guidance, workflows, warnings structure
- Health check logging pattern: `logger.logDOMOperation(FSB.sessionId, 'sheets_injection', {...})` — reusable for all apps
- CDP keyboard via `Input.dispatchMouseEvent` in keyboard-emulator.js — potential basis for drag-and-drop tool

### Established Patterns
- fsbRole elements bypass ALL visibility checks (Stage 2 in dom-analysis.js)
- Site guide flow: getGuideForUrl() → detectTaskType() → _buildTaskGuidance() → system prompt
- Multi-strategy selectors: 5 strategies per element ordered by stability (id → class → aria → role → context)
- importScripts() in background.js for service worker loading; script tags in options.html for UI loading
- Mechanical tools in content/actions.js return { success: boolean, ...data }

### Integration Points
- dom-analysis.js Stage 1b: must replace `/spreadsheets\/d\//` URL gate with `guideSelectors?.fsbElements` presence check
- site-guides/index.js: categoryKeywords needs 7 new app entries for task-based routing
- background.js: 7 new importScripts() lines for guide files
- options.html: 7 new script tags for guide loading in UI
- content/actions.js: new drag/dragdrop tool if built
- site-guides/productivity/_shared.js: must be rewritten to cover non-canvas app paradigms (block editors, card layouts, calendar grids)

</code_context>

<deferred>
## Deferred Ideas

- Airtable fillairtable mechanical tool for bulk data entry — if grid is canvas-rendered (unresolved from research)
- Notion database bulk entry tool — future phase
- Cross-app workflows (Jira issues to Airtable, Calendar events from Todoist) — separate milestone
- Per-site guide unit tests with mock DOM fragments — consider after v0.9.2

</deferred>

---

*Phase: 30-productivity-site-intelligence*
*Context gathered: 2026-03-16*
