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
- [ ] **Phase 18: AI Integration Wiring** - Wire CLI parser and prompts into ai-integration.js as the sole response path with conversation history adaptation
- [ ] **Phase 19: Cross-Provider Validation** - Validate CLI compliance, measure token reduction, and test edge cases across all four AI providers

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
**Plans**: TBD

### Phase 19: Cross-Provider Validation
**Goal**: CLI command compliance is empirically validated across all four supported AI providers, with measured token reduction and edge case coverage
**Depends on**: Phase 18 (full integration must be assembled before provider testing is meaningful)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. xAI Grok, OpenAI GPT-4o, Anthropic Claude, and Google Gemini each successfully complete at least 3 different task types (navigation, form fill, data extraction) using CLI commands without reverting to JSON
  2. Token usage is measured per provider on identical tasks comparing CLI format vs the previous JSON format, and the reduction is at least 40% on average
  3. Edge cases are tested and passing: special characters in typed text (quotes, angle brackets), URLs as arguments (with ?, &, =), multi-line AI reasoning with # comments, Google Sheets workflows (Name Box, formatting), and career search workflows (multi-site, storeJobData)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 15 -> 16 -> 17 -> 18 -> 19

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 15. CLI Parser Module | 2/2 | Complete    | 2026-02-28 |
| 16. YAML DOM Snapshot | 2/2 | Complete    | 2026-03-01 |
| 17. Prompt Architecture Rewrite | 1/2 | In Progress | - |
| 18. AI Integration Wiring | 0/TBD | Not started | - |
| 19. Cross-Provider Validation | 0/TBD | Not started | - |

---
*Created: 2026-02-27 for milestone v10.0 CLI Architecture*
