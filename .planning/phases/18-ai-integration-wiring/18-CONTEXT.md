# Phase 18: AI Integration Wiring - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire ai-integration.js to use the CLI parser as the sole response parser and store CLI-format exchanges in conversation history, completing the end-to-end protocol swap from JSON to CLI. Depends on Phase 15 (parser), Phase 16 (snapshot), Phase 17 (prompts). This phase does NOT add new tools or change the automation loop logic -- it swaps the parsing/history plumbing.

</domain>

<decisions>
## Implementation Decisions

### JSON Removal Strategy
- Delete the existing 4-strategy JSON parsing pipeline entirely -- no dead code, no feature flag
- Clean up all JSON parsing artifacts (imports, helpers, constants) as part of this phase, not deferred
- When CLI parser fails to parse an AI response, retry by sending the response back to the AI with a "reformat as CLI" instruction
- Cutover is method-by-method (incremental): swap response parsing first, then conversation history format, then provider cleaning -- not all at once

### Conversation History Format
- Store the AI's raw CLI command text as-is in conversation history -- no normalization or reformatting
- Both sides change: user/system messages also adopt CLI-consistent format, not just assistant responses
- Multi-command responses stored as one multi-line entry (single assistant turn), not split into separate entries
- When conversation history is compacted (summarized for token budget), the compaction prompt instructs the summarizer to preserve 1-2 CLI command examples so the AI sees the expected format

### Structured Data Encoding
- YAML-style encoding for structured data payloads (not inline JSON, not key=value pairs)
- Per-tool YAML schemas: storeJobData and fillSheetData each define their own YAML structure optimized for their use case
- fillSheetData uses cell references as YAML keys (e.g., A1: Engineer, B1: Acme) for spreadsheet-style addressing
- Claude's Discretion: whether to use indented blocks or delimiter markers for YAML data boundaries

### Provider Cleaning (Model-Agnostic)
- The entire cleaning system MUST be model-agnostic -- no model-specific cleaners or branches
- One universal cleaner with a pipeline of cleaning steps that handles all provider patterns (markdown fencing, conversational preambles, etc.)
- The system should be plug-and-play for any model -- adding a new provider should require zero cleaner changes
- Claude's Discretion: cleaning order (before vs after CLI parser), specific stripping patterns for markdown fencing and conversational preambles

</decisions>

<specifics>
## Specific Ideas

- "Don't do anything model specific -- the model should be plug and play -- the entire system should be model agnostic -- should be convenient for every model"
- The YAML encoding for fillSheetData should use familiar spreadsheet cell references (A1, B2, etc.) that map naturally to how the AI reasons about sheet navigation
- Retry-with-AI on parse failure mirrors the existing retry pattern but sends a CLI format correction prompt instead of retrying the same request

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 18-ai-integration-wiring*
*Context gathered: 2026-03-01*
