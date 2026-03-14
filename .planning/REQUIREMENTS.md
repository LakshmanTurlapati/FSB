# Requirements: v10.0 CLI Architecture

**Defined:** 2026-02-27
**Core Value:** Reliable single-attempt execution

## v10.0 Requirements

### CLI Parser

- [x] **CLI-01**: AI outputs line-based CLI commands (one command per line) instead of JSON tool calls, and the parser extracts verb, ref, and arguments from each line
- [x] **CLI-02**: Quoted string arguments are parsed correctly including escaped quotes, URLs with special characters, and multi-word values
- [x] **CLI-03**: Multiple command lines in a single AI response are treated as a batch and executed sequentially with DOM stability checks between each
- [x] **CLI-04**: Comment lines (prefixed with #) are captured as AI reasoning/analysis without being executed as actions
- [x] **CLI-05**: The parser produces {tool, params} objects identical to the current action dispatch format so content script execution is unchanged
- [x] **CLI-06**: Parse failures on individual lines are isolated -- valid commands before and after a malformed line still execute

### YAML DOM Snapshot

- [x] **YAML-01**: DOM snapshots sent to the AI use a compact text format with element refs (e1, e2, ...), element type, text content, and key attributes -- replacing the current verbose JSON structure
- [x] **YAML-02**: Interactive-only filtering reduces snapshot to actionable elements (buttons, inputs, links, selects) by default, with full-page mode available
- [x] **YAML-03**: Page metadata (URL, title, scroll position, viewport) is included as a compact header before the element list
- [x] **YAML-04**: Site-aware annotations from site guides (e.g., [hint:searchBox], [hint:nameBox]) are embedded inline with elements when a matching site guide exists
- [x] **YAML-05**: Snapshot token count is at least 40% lower than the current JSON format for equivalent page content

### Prompt Architecture

- [x] **PROMPT-01**: System prompt is redesigned around CLI command grammar with a concise command reference replacing the current JSON tool documentation (~400 lines)
- [x] **PROMPT-02**: Context tiers (full prompt vs minimal continuation) are preserved but adapted for CLI format -- continuation prompts reinforce CLI syntax
- [x] **PROMPT-03**: Stuck recovery prompts use CLI format and guide the AI to try alternative CLI commands
- [x] **PROMPT-04**: All 43+ site guide files are swept for JSON format examples and updated to use CLI command examples
- [x] **PROMPT-05**: Task-type prompts (search, form, extraction, navigation, career, sheets) are rewritten for CLI output format
- [x] **PROMPT-06**: Batch action instructions reference multi-line CLI commands instead of the batchActions JSON array
- [x] **PROMPT-07**: The done command replaces the taskComplete JSON field -- AI outputs `done "result summary"` to signal completion

### AI Integration

- [x] **INTEG-01**: ai-integration.js uses the CLI parser as the sole response parser -- no JSON fallback (CLI-only mode)
- [x] **INTEG-02**: Conversation history stores CLI command exchanges (not JSON) so models don't pattern-match back to JSON
- [x] **INTEG-03**: Conversation compaction preserves CLI format when summarizing older turns
- [x] **INTEG-04**: Provider-specific response cleaning (Gemini markdown wrapping, Grok conversational text) is adapted for CLI output extraction
- [x] **INTEG-05**: The storeJobData and fillSheetData tools accept structured data via a CLI-compatible encoding (inline JSON payload or heredoc-style block)

### Cross-Provider Testing

- [x] **TEST-01**: CLI command compliance is validated across xAI Grok, OpenAI GPT-4o, Anthropic Claude, and Google Gemini with at least 3 task types per provider
- [x] **TEST-02**: Token reduction is measured per provider comparing CLI vs previous JSON format on identical tasks
- [x] **TEST-03**: Edge cases are tested: special characters in typed text, URLs as arguments, multi-line reasoning, Google Sheets workflows, career search workflows

### Completion Validator

- [x] **CMP-01**: Media tasks (play video/music) complete on first `done` signal when URL matches streaming platform
- [x] **CMP-02**: Extraction tasks complete when AI reports data via `done` without requiring explicit `getText` action
- [x] **CMP-03**: Task classifier distinguishes media from gaming tasks correctly
- [x] **CMP-04**: Escape hatch accepts completion after 3+ consecutive `done` signals
- [x] **CMP-05**: AI self-report + no-remaining-actions score reaches at least 0.50

### Google Sheets CLI Engine

- [x] **P21-01**: Compact element refs (e1, e2) are preserved across all iterations -- the legacy full element ID format is never used in AI prompts on iteration 2+
- [x] **P21-02**: `type "data"` with no ref targets the currently focused element, enabling typing into canvas-based Sheets cells
- [x] **P21-03**: `enter` with no ref dispatches Enter keypress on the focused element instead of failing with "selector: undefined"
- [x] **P21-04**: Stuck recovery trims conversation history to system prompt + last 2 exchanges instead of full reset, preserving CLI format context and injecting a format reminder
- [x] **P21-05**: AI responses for Sheets tasks are capped at 8-10 commands per response in both prompt instruction and parsed output to prevent hallucination bursts

### Page Text Extraction

- [x] **P22-01**: AI receives page context as a unified markdown document with page text and interactive element refs interwoven, replacing the YAML element-only listing
- [x] **P22-02**: Interactive elements use backtick inline notation (`` `e5: button "Submit"` ``) with attributes, site guide hints, form values, and checked/selected state
- [x] **P22-03**: Page regions map to markdown heading hierarchy (`## Header`, `## Main Content`, `## Sidebar`, `## Footer`)
- [x] **P22-04**: Page metadata appears as H1 page title + blockquote with URL, scroll position, and viewport dimensions
- [x] **P22-05**: Snapshot respects ~12K character budget (~3K tokens) with line-boundary truncation and `[...content continues below -- scroll down and observe]` marker
- [x] **P22-06**: `readpage` CLI command returns full untruncated page text with markdown-lite formatting and no element refs
- [x] **P22-07**: `readpage --full` flag extracts entire `<body>` text; default (no flag) extracts viewport-visible text only

### Markdown Snapshot Cleanup

- [x] **P23-01**: All YAML snapshot code (buildYAMLSnapshot, buildMetadataHeader, buildElementLine, getElementFingerprint, buildFilterFooter, buildSelectOptions, _runYAMLSnapshotSelfTest) and compact snapshot code (generateCompactSnapshot) are removed from dom-analysis.js with no remaining callers
- [x] **P23-02**: All YAML/compact message handlers (getYAMLSnapshot, getCompactDOM, includeCompactSnapshot paths) are removed from messaging.js and background.js
- [x] **P23-03**: Compact snapshot fallback paths in ai-integration.js (formatCompactElements, _compactSnapshot synthesizers) are removed -- markdown snapshot is the sole page context format
- [x] **P23-04**: When markdown snapshot is present, formatHTMLContext() output is eliminated from AI prompts to avoid duplicate page info (title, URL, forms, headings, navigation already in markdown)
- [x] **P23-05**: Continuation prompts (iteration 2+) include a brief description of the markdown/backtick-ref format so the AI maintains context across turns
- [x] **P23-06**: Outdated comments referencing "YAML snapshot" or "compact snapshot" are updated throughout the codebase

### Google Sheets Workflow Recovery

- [x] **P24-01**: URLs extracted from task text are matched against site guides via getGuideForUrl() -- "fill in this sheet: docs.google.com/spreadsheets/d/xxx" instantly triggers the Sheets guide
- [x] **P24-02**: Weighted keyword matching replaces the flat 2-match threshold -- strong signals like "google sheet" (weight 2) trigger a match alone, weak signals like "sheet" (weight 1) require corroboration
- [x] **P24-03**: Productivity Tools keyword list includes singular forms ("google sheet", "google doc") and compound phrases as strong keywords, scoped to Productivity Tools only
- [x] **P24-04**: Generic task prompt includes exploration guidance for unfamiliar pages: keyboard shortcuts (Tab, Enter, Escape, arrow keys), canvas-app awareness, "do not open new tabs"
- [x] **P24-05**: Canvas-aware stuck recovery detects Google Sheets/Docs/Slides URLs and suggests keyboard-based interaction (Escape, Tab, Enter, arrows) instead of "navigate to different page" or "open new tab"
- [x] **P24-06**: Site guide activation is logged at info level with detection method (URL vs keyword) and guide name for debugging

### Google Sheets Snapshot Diagnostic & Selector Resilience

- [x] **P26-01**: Each fsbRole element (Name Box, Formula Bar) is found using multi-strategy selector lookup -- an ordered array of 4-5 selectors per element tried in priority order (ID -> class -> aria-label -> role+context), first match wins
- [x] **P26-02**: All Sheets-specific selector definitions live in the google-sheets.js site guide (fsbElements property), not hardcoded in dom-analysis.js -- dom-analysis.js receives and iterates selector config generically
- [x] **P26-03**: Diagnostic logging shows which selector in the priority chain matched for each element (e.g., "#t-name-box [1/5]"), and when all selectors fail a warning is logged with no heuristic fallback
- [x] **P26-04**: Empty formula bar and empty Name Box display = "" in the snapshot so the AI knows the elements exist and can interact with them
- [x] **P26-05**: Name Box values are validated against an extended cell reference regex (handles Sheet2!A1, 'Sheet Name'!A1:B10 patterns); invalid values are still shown but flagged in diagnostic log
- [x] **P26-06**: First Sheets snapshot per session triggers a one-time health check that verifies element presence in markdown output AND content format validity, emitting a pass/fail summary to console and full pipeline diagnostic dump on failure

### Google Sheets Snapshot Pipeline Fix

- [x] **P25-WALKER-FIX**: Post-walk injection catches fsbRole elements missed by the DOM walker due to aria-hidden parents, deduplicates against already-walked elements, and logs diagnostic counts

### Site Explorer Snapshot

- [x] **P27-01**: Site Explorer's collectPageData() fetches getMarkdownSnapshot after getDOM and stores it as pageData.markdownSnapshot in crawl results
- [x] **P27-02**: Research detail view in options page renders the markdown snapshot in a collapsible pre block per crawled page with stats line (character count, element count) and guide name badge
- [x] **P27-03**: Crawling a Google Sheets URL produces a markdown snapshot showing formula bar, name box, and toolbar elements with their values
- [x] **P27-04**: Downloaded research JSON includes the markdownSnapshot field for each crawled page

### Google Sheets Guide Enrichment

- [x] **P28-01**: Toolbar formatting buttons (bold, italic, text-color, fill-color, borders, merge, h-align, font-family, font-size, num-fmt-currency, num-fmt-percent, num-fmt-other, filter-toggle, functions, insert-chart) are defined as fsbElements with 5-strategy multi-selector chains in google-sheets.js
- [x] **P28-02**: Menu bar items (file, edit, view, insert, format, data) are defined as fsbElements with 5-strategy selectors, with data menu using aria-label as primary strategy due to dynamic Closure Library ID
- [x] **P28-03**: Sheet management elements (add-sheet, sheet-tab, spreadsheet-title) are defined as fsbElements with aria/class-first strategies for elements with dynamic IDs
- [x] **P28-04**: Selectors map is expanded with annotation keys for all new toolbar and sheet management elements so buildGuideAnnotations() produces [hint:] tags
- [x] **P28-05**: Input-type fsbElements (font-size) are added to the hasFsbValueHandler guard in dom-analysis.js to prevent duplicate value display in snapshots
- [x] **P28-06**: Health check validates minimum fsbElement count (>= 5) and injection logging reports total matched/failed counts generically instead of hardcoding name-box and formula-bar

## Future Requirements (Deferred)

- [ ] **FUT-01**: Progressive snapshot depth (full/focused/delta) for further token reduction in mid-task iterations
- [ ] **FUT-02**: TOON-style tabular formatting for list data in snapshots (job listings, search results)
- [ ] **FUT-03**: AI reasoning quality comparison between CLI comments and structured JSON fields

## Out of Scope

| Feature | Reason |
|---------|--------|
| JSON fallback parser | Full commitment to CLI -- no dual parser. Models must comply or get degraded experience. |
| New browser action tools | v10.0 only changes the protocol, not the action capabilities. Existing 30+ tools unchanged. |
| Content script refactoring | Action execution layer (actions.js, selectors.js, dom-state.js) is untouched -- CLI parser produces same {tool, params} shape. |
| Build system or bundling | Vanilla JS with importScripts pattern is preserved. No webpack, rollup, or transpilation. |
| UI changes | Popup, sidepanel, options page unchanged -- protocol change is invisible to user. |
| Google Docs support | Similar canvas issues but different interaction model -- deferred from Phase 21. |
| Generic canvas-app detection | Framework for detecting canvas-based apps -- deferred from Phase 21. |
| Smart content extraction (Reader Mode) | Future `readpage --smart` flag -- deferred from Phase 22. |
| Token comparator YAML conversion | CLI validator and token comparator test data still uses YAML format -- convert or drop separately. |
| Delta path markdown integration | Delta DOM updates don't include markdown snapshot -- investigate separately. |
| Audit all 9 keyword categories | Only Productivity Tools keywords are in scope for Phase 24 -- full audit deferred. |
| Generic canvas-app site guide template | Template for canvas-heavy apps (Figma, Google Slides, etc.) -- deferred. |
| Generic canvas-app selector resilience | Extend multi-strategy pattern to Google Docs, Slides, Figma -- deferred from Phase 26. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 15 | Complete |
| CLI-02 | Phase 15 | Complete |
| CLI-03 | Phase 15 | Complete |
| CLI-04 | Phase 15 | Complete |
| CLI-05 | Phase 15 | Complete |
| CLI-06 | Phase 15 | Complete |
| YAML-01 | Phase 16 | Complete |
| YAML-02 | Phase 16 | Complete |
| YAML-03 | Phase 16 | Complete |
| YAML-04 | Phase 16 | Complete |
| YAML-05 | Phase 16 | Complete |
| PROMPT-01 | Phase 17 | Complete |
| PROMPT-02 | Phase 17 | Complete |
| PROMPT-03 | Phase 17 | Complete |
| PROMPT-04 | Phase 17 | Complete |
| PROMPT-05 | Phase 17 | Complete |
| PROMPT-06 | Phase 17 | Complete |
| PROMPT-07 | Phase 17 | Complete |
| INTEG-01 | Phase 18 | Complete |
| INTEG-02 | Phase 18 | Complete |
| INTEG-03 | Phase 18 | Complete |
| INTEG-04 | Phase 18 | Complete |
| INTEG-05 | Phase 18 | Complete |
| TEST-01 | Phase 19 | Complete |
| TEST-02 | Phase 19 | Complete |
| TEST-03 | Phase 19 | Complete |
| CMP-01 | Phase 20 | Complete |
| CMP-02 | Phase 20 | Complete |
| CMP-03 | Phase 20 | Complete |
| CMP-04 | Phase 20 | Complete |
| CMP-05 | Phase 20 | Complete |
| P21-01 | Phase 21 | Complete |
| P21-02 | Phase 21 | Complete |
| P21-03 | Phase 21 | Complete |
| P21-04 | Phase 21 | Complete |
| P21-05 | Phase 21 | Complete |
| P22-01 | Phase 22 | Complete |
| P22-02 | Phase 22 | Complete |
| P22-03 | Phase 22 | Complete |
| P22-04 | Phase 22 | Complete |
| P22-05 | Phase 22 | Complete |
| P22-06 | Phase 22 | Complete |
| P22-07 | Phase 22 | Complete |
| P23-01 | Phase 23 | Complete |
| P23-02 | Phase 23 | Complete |
| P23-03 | Phase 23 | Complete |
| P23-04 | Phase 23 | Complete |
| P23-05 | Phase 23 | Complete |
| P23-06 | Phase 23 | Complete |
| P24-01 | Phase 24 | Complete |
| P24-02 | Phase 24 | Complete |
| P24-03 | Phase 24 | Complete |
| P24-04 | Phase 24 | Complete |
| P24-05 | Phase 24 | Complete |
| P24-06 | Phase 24 | Complete |
| P26-01 | Phase 26 | Complete |
| P26-02 | Phase 26 | Complete |
| P26-03 | Phase 26 | Complete |
| P26-04 | Phase 26 | Complete |
| P26-05 | Phase 26 | Complete |
| P26-06 | Phase 26 | Complete |
| P25-WALKER-FIX | Phase 25 | Complete |
| P27-01 | Phase 27 | Complete |
| P27-02 | Phase 27 | Complete |
| P27-03 | Phase 27 | Complete |
| P27-04 | Phase 27 | Complete |
| P28-01 | Phase 28 | Complete |
| P28-02 | Phase 28 | Complete |
| P28-03 | Phase 28 | Complete |
| P28-04 | Phase 28 | Complete |
| P28-05 | Phase 28 | Complete |
| P28-06 | Phase 28 | Complete |

**Coverage:**
- v10.0 requirements: 67 total
- Mapped: 67/67 (100%)
- Future requirements: 5 (deferred)
- Unmapped: 0

---
*Defined: 2026-02-27 for milestone v10.0 CLI Architecture*
