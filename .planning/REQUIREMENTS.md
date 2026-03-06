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

- [ ] **P22-01**: AI receives page context as a unified markdown document with page text and interactive element refs interwoven, replacing the YAML element-only listing
- [ ] **P22-02**: Interactive elements use backtick inline notation (`` `e5: button "Submit"` ``) with attributes, site guide hints, form values, and checked/selected state
- [ ] **P22-03**: Page regions map to markdown heading hierarchy (`## Header`, `## Main Content`, `## Sidebar`, `## Footer`)
- [ ] **P22-04**: Page metadata appears as H1 page title + blockquote with URL, scroll position, and viewport dimensions
- [ ] **P22-05**: Snapshot respects ~12K character budget (~3K tokens) with line-boundary truncation and `[...content continues below -- scroll down and observe]` marker
- [ ] **P22-06**: `readpage` CLI command returns full untruncated page text with markdown-lite formatting and no element refs
- [ ] **P22-07**: `readpage --full` flag extracts entire `<body>` text; default (no flag) extracts viewport-visible text only

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
| P22-01 | Phase 22 | Planned |
| P22-02 | Phase 22 | Planned |
| P22-03 | Phase 22 | Planned |
| P22-04 | Phase 22 | Planned |
| P22-05 | Phase 22 | Planned |
| P22-06 | Phase 22 | Planned |
| P22-07 | Phase 22 | Planned |

**Coverage:**
- v10.0 requirements: 38 total
- Mapped: 38/38 (100%)
- Future requirements: 3 (deferred)
- Unmapped: 0

---
*Defined: 2026-02-27 for milestone v10.0 CLI Architecture*
