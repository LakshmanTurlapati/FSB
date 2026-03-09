# Roadmap: FSB v10.0 CLI Architecture

## Overview

v10.0 replaces FSB's AI-to-extension communication protocol from JSON tool calls to line-based CLI commands. The milestone follows a strict dependency chain: the CLI parser must exist before prompts can document its syntax, prompts must define the format before the AI integration layer can wire them in, YAML snapshots must be formalized before prompts reference their element refs, and all components must be assembled before cross-provider testing is meaningful. The result is dramatically improved LLM accuracy, approximately 40-60% token reduction, and elimination of JSON parsing failures.

## Milestones

<details>
<summary>v9.4 Career Search Automation (Phases 9-14.3) - SHIPPED 2026-02-27</summary>

See `.planning/milestones/v9.4-ROADMAP.md` for full details.
9 phases (6 main + 3 hotfix), 18 plans, 21 requirements (100% satisfied).

</details>

### v10.0 CLI Architecture (In Progress)

**Milestone Goal:** Replace JSON tool-call interface with CLI-style command protocol, redesign DOM snapshots as compact YAML with element refs, and fully rewrite prompt architecture -- all to improve LLM accuracy, reduce token costs ~3x, and eliminate JSON parsing failures.

## Phases

- [x] **Phase 15: CLI Parser Module** - Build the line-based command parser that converts AI text output into executable {tool, params} objects (completed 2026-02-28)
- [x] **Phase 16: YAML DOM Snapshot** - Formalize compact element-ref snapshot format with interactive filtering, page metadata, and site-aware annotations (completed 2026-03-01)
- [x] **Phase 17: Prompt Architecture Rewrite** - Redesign system prompt, task prompts, stuck recovery, and all 43+ site guides for CLI command grammar (completed 2026-03-01)
- [x] **Phase 18: AI Integration Wiring** - Wire CLI parser and prompts into ai-integration.js as the sole response path with conversation history adaptation (completed 2026-03-01)
- [x] **Phase 19: Cross-Provider Validation** - Validate CLI compliance, measure token reduction, and test edge cases across all four AI providers (completed 2026-03-02)
- [x] **Phase 20: Completion Validator Overhaul** - Fix over-aggressive completion validation that blocks legitimate task completion for media, extraction, and navigation tasks (completed 2026-03-06)
- [x] **Phase 23: Markdown Snapshot Cleanup** - Remove legacy YAML/compact snapshot code, eliminate redundant HTML context, improve continuation prompt reconnaissance (completed 2026-03-06)

## Phase Details

### Phase 15: CLI Parser Module
**Goal**: A standalone parser module exists that converts line-based CLI text (click e5, type e12 "hello", done "task complete") into the same {tool, params} action objects the content script already expects
**Depends on**: Nothing (first phase of v10.0, zero dependencies on existing code)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
**Success Criteria** (what must be TRUE):
  1. A single AI response containing lines like `click e5` and `type e12 "hello world"` is parsed into an array of {tool, params} objects where tool="click", params={ref:"e5"} and tool="type", params={ref:"e12", text:"hello world"}
  2. Quoted strings with escaped quotes, URLs containing special characters (?, &, =, #), and multi-word values are parsed without corruption or truncation
  3. Lines starting with # are captured as reasoning text and not dispatched as actions -- the reasoning is preserved for logging/debugging
  4. A malformed line in the middle of a response does not prevent valid lines before and after it from being parsed and executed
  5. The parser output for every supported command (click, type, navigate, scroll, done, etc.) matches the exact {tool, params} shape that content/messaging.js already dispatches on
**Plans**: 2 plans
Plans:
- [ ] 15-01-PLAN.md -- Core parsing engine: tokenizer, COMMAND_REGISTRY, command mapper
- [ ] 15-02-PLAN.md -- Response parser orchestration: preprocessor, parseCliResponse, module exports

### Phase 16: YAML DOM Snapshot
**Goal**: The AI receives page context as a compact, structured text format with element refs (e1, e2, ...) that is at least 40% smaller than the current JSON snapshot while preserving all information needed for accurate action decisions
**Depends on**: Phase 15 (parser must define the ref syntax e.g. "e5" that snapshots will use)
**Requirements**: YAML-01, YAML-02, YAML-03, YAML-04, YAML-05
**Success Criteria** (what must be TRUE):
  1. The AI sees elements formatted as compact lines like `e5: button "Submit Form" .btn-primary [disabled]` instead of nested JSON objects with redundant field names
  2. The snapshot contains only interactive elements (buttons, inputs, links, selects) by default, and a full-page mode is available when the AI needs broader context
  3. Page metadata (URL, title, scroll position, viewport size) appears as a compact header block before the element list, not buried in a JSON wrapper
  4. When a matching site guide exists for the current URL, elements are annotated inline (e.g., `e12: input "Search" [hint:searchBox]`) so the AI knows which element to target without reasoning from scratch
  5. Token count for an equivalent page snapshot is at least 40% lower than the current JSON format as measured by tiktoken or equivalent tokenizer
**Plans**: 2 plans
Plans:
- [ ] 16-01-PLAN.md -- Core YAML snapshot engine: metadata header, element line formatter, region grouping, duplicate collapse, filter footer
- [ ] 16-02-PLAN.md -- Integration wiring: messaging handler, site guide annotation matching, self-test validation

### Phase 17: Prompt Architecture Rewrite
**Goal**: Every prompt the AI receives -- system prompt, task-type prompts, continuation prompts, stuck recovery prompts, and site guide examples -- speaks CLI command grammar exclusively, with no remnants of JSON tool-call format
**Depends on**: Phase 15 (CLI syntax must be finalized), Phase 16 (snapshot format must be finalized so prompts can reference element refs)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06, PROMPT-07
**Success Criteria** (what must be TRUE):
  1. The system prompt contains a concise CLI command reference (verb + ref + args grammar) replacing the ~400-line JSON tool documentation, and an AI reading it knows how to output valid CLI commands
  2. Continuation prompts (iteration 2+) reinforce CLI syntax so the AI does not revert to JSON mid-task, and full vs minimal context tiers are preserved
  3. Stuck recovery prompts guide the AI to try alternative CLI commands (different ref, different verb, scroll to reveal more elements) instead of the current JSON recovery format
  4. All 43+ site guide files contain CLI command examples (e.g., `click e5` instead of `{"tool":"click","params":{"ref":"e5"}}`) with zero remaining JSON format examples
  5. The `done "result summary"` command is documented in the system prompt and replaces the taskComplete JSON field for signaling task completion
**Plans**: 2 plans
Plans:
- [ ] 17-01-PLAN.md -- Core prompt rewrites: system prompt CLI command table, continuation prompt, stuck recovery, task-type prompts, batch instructions, tool documentation, help command
- [ ] 17-02-PLAN.md -- Site guide enrichment: CLI COMMON PATTERNS sections for all 84 per-site guide files

### Phase 18: AI Integration Wiring
**Goal**: ai-integration.js uses the CLI parser as the sole response parser and stores CLI-format exchanges in conversation history, completing the end-to-end protocol swap from JSON to CLI
**Depends on**: Phase 15 (parser), Phase 16 (snapshot), Phase 17 (prompts)
**Requirements**: INTEG-01, INTEG-02, INTEG-03, INTEG-04, INTEG-05
**Success Criteria** (what must be TRUE):
  1. An AI response is processed exclusively through the CLI parser -- the existing 4-strategy JSON parsing pipeline is removed or bypassed, and no JSON fallback exists
  2. Conversation history stores the AI's raw CLI command output (not converted to/from JSON) so subsequent turns see CLI format and pattern-match accordingly
  3. When conversation history is compacted (summarized for token budget), the compacted summary preserves CLI format examples so the AI maintains format compliance
  4. Provider-specific response cleaning (Gemini markdown wrapping, Grok conversational prefixes) correctly extracts CLI command lines from each provider's output quirks
  5. The storeJobData and fillSheetData tools accept structured data payloads via a CLI-compatible encoding that the parser handles correctly
**Plans**: 2 plans
Plans:
- [ ] 18-01-PLAN.md -- Response parsing swap: gut UniversalProvider JSON pipeline, wire parseCliResponse as sole parser, security sanitization, CLI reformat retry
- [ ] 18-02-PLAN.md -- Conversation history + data encoding: CLI-format history storage, compaction CLI preservation, YAML block parsing for storeJobData

### Phase 19: Cross-Provider Validation
**Goal**: CLI command compliance is empirically validated across all four supported AI providers, with measured token reduction and edge case coverage
**Depends on**: Phase 18 (full integration must be assembled before provider testing is meaningful)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. xAI Grok, OpenAI GPT-4o, Anthropic Claude, and Google Gemini each successfully complete at least 3 different task types (navigation, form fill, data extraction) using CLI commands without reverting to JSON
  2. Token usage is measured per provider on identical tasks comparing CLI format vs the previous JSON format, and the reduction is at least 40% on average
  3. Edge cases are tested and passing: special characters in typed text (quotes, angle brackets), URLs as arguments (with ?, &, =), multi-line AI reasoning with # comments, Google Sheets workflows (Name Box, formatting), and career search workflows (multi-site, storeJobData)
**Plans**: 3 plans
Plans:
- [ ] 19-01-PLAN.md -- Core test infrastructure: CLIValidator module, MockDOM execution, golden responses (4 providers x 6 task types), DOM snapshots, edge case test data
- [ ] 19-02-PLAN.md -- Token measurement: gpt-tokenizer bundle, TokenComparator module, JSON baseline reconstruction, 6 JSON baseline files
- [ ] 19-03-PLAN.md -- UI panel + integration: options page CLI Validation section, live mode service worker handler, edge case wiring, human verification

### Phase 20: Completion Validator Overhaul
**Goal**: The completion validator correctly accepts legitimate task completions on the first `done` signal for common task types (media playback, data extraction, navigation) instead of forcing unnecessary extra iterations
**Depends on**: Phase 18 (CLI integration must be in place)
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05
**Success Criteria** (what must be TRUE):
  1. "play sunflower on youtube" completes within 1 iteration of the AI issuing `done` -- the validator accepts completion when the video is playing (YouTube watch URL + AI done signal)
  2. "check the price of X" completes when the AI reports the price via `done "price is $599"` without requiring an explicit `getText` action -- DOM snapshot data visibility counts as extraction evidence
  3. Task classifier correctly distinguishes media tasks ("play X on youtube/spotify") from gaming tasks -- no false gaming classification for media playback
  4. When the AI issues `done` for 3+ consecutive iterations, an escape hatch overrides the score threshold and accepts completion -- eliminates infinite stuck loops
  5. Completion score for AI self-report + no-remaining-actions reaches at least 0.50 (currently maxes at 0.35-0.45, always below threshold)
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md -- Scoring foundation: media classification, score weight rebalance, task-type URL patterns, extraction validator fix
- [ ] 20-02-PLAN.md -- Validators + escape hatch: mediaValidator, validateCompletion rewiring, consecutive-done escape hatch

**Issues identified from UAT session logs:**

| Issue | Location | Impact |
|-------|----------|--------|
| AI self-report weight too low (0.20 + 0.15 = 0.35 max) | `computeCompletionScore` ~L3683 | Completion NEVER accepted on AI signal alone |
| No consecutive-done escape hatch | `validateCompletion` ~L3919 | 8 wasted iterations on YouTube task |
| "play X on youtube" classified as "gaming" | `classifyTask` ~L3393 | Wrong action chain expectations |
| Extraction requires getText action | `checkActionChainComplete` ~L3608 | Blocks when AI reads price from DOM snapshot |
| URL patterns miss YouTube, Amazon, etc. | `detectUrlCompletionPattern` ~L3550 | No URL signal for common sites |
| DOM snapshot format mismatch in iteration 1 | DOM serialization | AI uses wrong ref format on first turn |

### Phase 21: Google Sheets CLI Engine Refinement
**Goal**: The CLI engine works reliably on Google Sheets -- compact refs preserved across all iterations, ref-optional commands (type without ref, enter without ref) target the focused element, stuck recovery preserves CLI context instead of destroying it, and action count is capped to prevent hallucination bursts
**Depends on**: Phase 20
**Requirements**: P21-01, P21-02, P21-03, P21-04, P21-05
**Success Criteria** (what must be TRUE):
  1. Compact element refs (e1, e2, e3) appear in AI prompts on iterations 2+ -- the legacy full element ID format is never used
  2. `type "data"` with no ref targets the currently focused element (canvas-based Sheets cells)
  3. `enter` with no ref dispatches Enter keypress on the focused element instead of failing with "selector: undefined"
  4. Stuck recovery trims conversation history to system prompt + last 2 exchanges instead of full reset, preserving CLI format context
  5. AI responses for Sheets tasks are capped at 8-10 commands per response to prevent token-wasting hallucination bursts
**Plans**: 2 plans
Plans:
- [ ] 21-01-PLAN.md -- Parser + content script fixes: type ref-optional, enter focused-element fallback, compact snapshot guard
- [ ] 21-02-PLAN.md -- Stuck recovery trim + action count cap: conservative history trim, format reminder, Sheets action cap

### Phase 23: Markdown Snapshot Cleanup
**Goal**: Remove all legacy YAML/compact snapshot code, eliminate redundant HTML context from AI prompts when markdown snapshot is present, and improve AI reconnaissance on continuation turns -- resulting in ~800 fewer lines of dead code and ~20% prompt token savings
**Depends on**: Phase 22
**Requirements**: P23-01, P23-02, P23-03, P23-04, P23-05, P23-06
**Success Criteria** (what must be TRUE):
  1. `buildYAMLSnapshot`, `generateCompactSnapshot`, `_runYAMLSnapshotSelfTest`, and all YAML-only helpers are deleted from dom-analysis.js -- no function with "YAML" or "compact" in its name exists (except shared helpers like getRegion, buildGuideAnnotations)
  2. No message handler for `getYAMLSnapshot` or `getCompactDOM` exists in messaging.js, and no `includeCompactSnapshot` property is sent from background.js
  3. `formatCompactElements()` and both compact fallback synthesizer blocks are removed from ai-integration.js -- `_compactSnapshot` is never referenced
  4. When `_markdownSnapshot` is present in domState, the AI prompt does NOT include `formatHTMLContext()` output (page title, URL, forms, headings, navigation are already in the markdown)
  5. The continuation prompt (iteration 2+) includes a brief description explaining the backtick-ref format (e.g., `` `e5: button "Submit"` ``) so the AI understands the page context format across turns
  6. No comments in the codebase reference "YAML snapshot" or "compact snapshot" as current/active features (references in changelogs or historical notes are fine)
**Plans**: 2 plans
Plans:
- [ ] 23-01-PLAN.md -- Dead code removal: YAML/compact functions from dom-analysis.js, handlers from messaging.js, includeCompactSnapshot from background.js
- [ ] 23-02-PLAN.md -- AI integration cleanup: compact fallbacks removal, HTML context skip when markdown present, continuation prompt improvement

## Progress

**Execution Order:**
Phases execute in numeric order: 15 -> 16 -> 17 -> 18 -> 19

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 15. CLI Parser Module | 2/2 | Complete    | 2026-02-28 |
| 16. YAML DOM Snapshot | 2/2 | Complete    | 2026-03-01 |
| 17. Prompt Architecture Rewrite | 1/2 | Complete    | 2026-03-01 |
| 18. AI Integration Wiring | 2/2 | Complete    | 2026-03-01 |
| 19. Cross-Provider Validation | 3/3 | Complete    | 2026-03-02 |
| 20. Completion Validator Overhaul | 2/2 | Complete    | 2026-03-06 |
| 21. Google Sheets CLI Engine Refinement | 2/2 | Complete    | 2026-03-06 |
| 23. Markdown Snapshot Cleanup | 2/2 | Complete    | 2026-03-06 |

### Phase 22: Page text extraction for reading tasks

**Goal:** Replace the YAML DOM snapshot with a unified markdown representation where page text and interactive element refs are interwoven, and add a `readpage` CLI command for full untruncated page text extraction
**Requirements**: P22-01, P22-02, P22-03, P22-04, P22-05, P22-06, P22-07
**Depends on:** Phase 21
**Success Criteria** (what must be TRUE):
  1. AI receives page context as a markdown document with page text and backtick-wrapped element refs interwoven -- not a separate element listing
  2. Page regions appear as `## Header`, `## Main Content`, `## Sidebar`, `## Footer` headings
  3. Element refs use backtick inline notation: `` `e5: button "Submit"` `` with attributes, hints, form values, checked state
  4. Page metadata is H1 title + blockquote with URL/scroll/viewport
  5. Snapshot respects ~12K char budget with line-boundary truncation and scroll hint
  6. `readpage` CLI command returns full page text with markdown-lite formatting, no element refs
  7. `readpage --full` extracts entire body text; default is viewport-only
**Plans:** 2/2 plans complete

Plans:
- [x] 22-01-PLAN.md -- Markdown snapshot engine: buildMarkdownSnapshot, DOM walker, extractPageText, message handlers
- [ ] 22-02-PLAN.md -- CLI + Integration wiring: readpage command, action handler, markdown snapshot in AI prompts, CLI command table

### Phase 24: Google Sheets Workflow Recovery

**Goal:** Fix broken Google Sheets automation by repairing keyword matching so the Sheets guide loads reliably, adding URL extraction from task text for instant matches, enhancing the generic prompt with canvas-page exploration guidance, adding canvas-aware stuck recovery to prevent new-tab loops, and fixing the interaction layer so click/type/batch actions work on Sheets toolbar elements
**Requirements**: P24-01, P24-02, P24-03, P24-04, P24-05, P24-06
**Depends on:** Phase 23
**Success Criteria** (what must be TRUE):
  1. "open my google sheet" triggers the Productivity Tools site guide via weighted keyword matching (strong keyword "google sheet" scores 2, meeting threshold alone)
  2. "fill in this sheet: https://docs.google.com/spreadsheets/d/xxx" triggers the Sheets guide via URL extraction from task text
  3. When no site guide loads, the AI receives exploration guidance mentioning keyboard shortcuts (Tab, Enter, Escape, arrow keys) for canvas-heavy pages
  4. When stuck on a Google Sheets URL, recovery hints suggest keyboard-based interaction instead of opening new tabs or refreshing
  5. Site guide activation is logged with detection method (URL vs keyword) for debugging
  6. Click actions on Google Sheets toolbar elements (Name Box, formula bar, menus) succeed without readiness timeout
  7. Batch type+Tab+type sequences fill multiple Sheets cells instead of being suppressed
  8. Site guide emphasizes keyboard-first navigation patterns as the most reliable interaction method
**Plans:** 5 plans

Plans:
- [x] 24-01-PLAN.md -- Detection fixes: weighted keyword matching, URL extraction from task text in getGuideForTask()
- [x] 24-02-PLAN.md -- Safety net: enhanced generic prompt, guide activation logging, canvas-aware stuck recovery
- [x] 24-03-PLAN.md -- Interaction layer: canvas editor toolbar click bypass, batch suppression replacement with inter-action delay
- [x] 24-04-PLAN.md -- Site guide update: keyboard-first navigation patterns, reliability warnings
- [x] 24-05-PLAN.md -- Gap closure: contenteditable innerText capture in snapshot, fire-and-forget typing guidance

---
*Created: 2026-02-27 for milestone v10.0 CLI Architecture*
