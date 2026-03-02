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
- [ ] **TEST-02**: Token reduction is measured per provider comparing CLI vs previous JSON format on identical tasks
- [x] **TEST-03**: Edge cases are tested: special characters in typed text, URLs as arguments, multi-line reasoning, Google Sheets workflows, career search workflows

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
| TEST-02 | Phase 19 | Pending |
| TEST-03 | Phase 19 | Complete |

**Coverage:**
- v10.0 requirements: 26 total
- Mapped: 26/26 (100%)
- Future requirements: 3 (deferred)
- Unmapped: 0

---
*Defined: 2026-02-27 for milestone v10.0 CLI Architecture*
