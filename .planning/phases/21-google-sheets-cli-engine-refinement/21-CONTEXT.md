# Phase 21: Google Sheets CLI Engine Refinement - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning
**Source:** Session log analysis + recon data (fsb-session-2026-03-06, fsb-research-docs.google.com-2026-03-06)

<domain>
## Phase Boundary

Make the CLI engine work reliably on Google Sheets. The current engine fails catastrophically on Sheets due to snapshot format inconsistencies, missing ref-less command support, conversation history reset destroying CLI context, and the AI falling into infinite broken-command loops. This phase fixes the CLI parser, snapshot pipeline, stuck recovery, and prompt architecture specifically for canvas-based apps like Google Sheets.

</domain>

<decisions>
## Implementation Decisions

### Snapshot Format Consistency (CRITICAL)
- Element ref format (e1, e2, e3) MUST be preserved across ALL iterations, not just iteration 1
- The fallback from `_compactSnapshot` to full element IDs (`[input_t_name_box_docs_chrome_text]`) in ai-integration.js ~L871-902 must be eliminated
- Delta/change snapshots must use the same ref format as the initial snapshot
- If `_compactSnapshot` is unavailable in iteration 2+, the system must regenerate it rather than falling back

### CLI Parser: Ref-Optional Commands
- `type` command must support ref-optional mode for typing into the active/focused element (Google Sheets canvas grid)
- When no ref is provided, `type "data"` should target the currently focused element
- `enter` (pressEnter) already has optional ref but the content script fails with "selector: undefined" -- fix the action handler to press Enter on focused element when no ref given
- `key` command already works correctly for Tab, Escape, etc.

### Stuck Recovery Strategy
- Conversation history reset is counterproductive -- it causes the AI to lose CLI format context and revert to malformed JSON
- Instead of full reset: trim history to keep system prompt + last 2 exchanges
- Add a "format reminder" injection when stuck is detected, reinforcing CLI command format
- Cap max actions per response for Sheets workflows (prevent 35-action hallucination bursts)

### Google Sheets Site Guide Enhancement
- The existing site guide (site-guides/productivity/google-sheets.js) has good workflows but the AI doesn't follow them
- Need stronger integration between site guide patterns and the prompt -- possibly inject as "MANDATORY WORKFLOW" not just "COMMON PATTERNS"
- The Name Box workflow (Escape -> click Name Box -> type ref -> Enter -> type data) must be enforced as a strict sequence

### Claude's Discretion
- Implementation approach for snapshot regeneration (rebuild vs cache)
- Specific max-actions-per-response limit (suggest 10-15 for Sheets)
- Whether to add a dedicated `typecell` CLI command vs making `type` smarter
- How to detect "canvas-based app" mode automatically

</decisions>

<specifics>
## Specific Ideas

### From Session Log Analysis
- AI typed into Name Box (e14 = "More formats" button) instead of the actual Name Box input -- element ref mapping was wrong
- AI generated `type({"selector":"[active","text":"cell"})` 15 times in a loop -- parser received malformed JSON instead of CLI
- `pressEnter()` with no params returned "Element not found with selector: undefined"
- API timeouts (35s) occurred twice during the session, causing retry cycles
- The session opened TWO sheets (tabs 707467875 and 707467878) because the AI navigated to sheets.new twice

### From Recon Data (fsb-research-docs.google.com)
- Google Sheets DOM has ~62 interactive elements in the toolbar alone
- Key elements identified: Name Box (#t-name-box), formula bar (.cell-input), grid container
- The cell-input textbox (role="textbox", class="cell-input") is the formula bar, NOT individual cells
- Canvas grid intercepts all clicks -- cells are NOT DOM elements
- Template sidebar appears on new sheets and must be dismissed

### Key File Locations
- CLI parser: ai/cli-parser.js (line 157: type requires ref, line 168: enter optional ref)
- Snapshot format switch: ai/ai-integration.js (lines 871-902: _compactSnapshot fallback)
- Stuck recovery: ai/ai-integration.js (conversation history reset)
- Action handlers: content/actions.js (pressEnter ~L2543, type ~L1538)
- Google Sheets guide: site-guides/productivity/google-sheets.js

</specifics>

<deferred>
## Deferred Ideas

- Google Docs support (similar canvas issues but different interaction model)
- Generic "canvas-based app" detection framework
- Macro recording for repeated Sheets operations
- Google Sheets API integration as alternative to DOM automation

</deferred>

---

*Phase: 21-google-sheets-cli-engine-refinement*
*Context gathered: 2026-03-06 via session log + recon analysis*
