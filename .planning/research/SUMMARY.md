# Research Summary: FSB v10.0 CLI Architecture

**Domain:** CLI-based browser automation protocol replacing JSON tool calls
**Researched:** 2026-02-27
**Overall confidence:** HIGH

## Executive Summary

The v10.0 CLI Architecture milestone replaces FSB's AI-to-extension communication format from JSON tool calls to line-based CLI commands. The central finding from codebase analysis is that **the change boundary is extremely narrow**: only the AI response format (what the AI outputs) and the response parser (how background.js interprets it) need to change. The entire content script layer (10 modules, 480KB+), the action dispatch pipeline in background.js, the RefMap/ref resolution system, Chrome message passing, session management, stuck detection, visual feedback -- all of it stays identical.

FSB already has the critical infrastructure built. The `generateCompactSnapshot()` function in `content/dom-analysis.js` already produces `[e1] button "Submit"` format lines -- this IS the "YAML snapshot" the milestone describes. The `RefMap` class in `content/dom-state.js` already maps `e1->element` with WeakRef + CSS selector fallback. The `resolveRef()` function in `content/selectors.js` already resolves refs to DOM elements. The `handleAsyncMessage` in `content/messaging.js` already resolves `params.ref` before calling any tool. The work is: (1) build a CLI command parser (~300 lines), (2) rewrite the system prompt for CLI format, (3) replace the 4-strategy JSON parsing pipeline with a line-based parser, (4) keep JSON as fallback.

Industry evidence strongly validates this direction. Playwright CLI reports 76% token reduction (114K vs 27K tokens). agent-browser uses the same `@e1` ref pattern FSB already has and reports 93% context reduction. webctl demonstrates the CLI-first pattern with ARIA-based queries. The common thread: CLI formats eliminate JSON parsing failures entirely (line-based parsing is deterministic) while dramatically reducing token costs.

The highest-risk area is **prompt engineering**, not code architecture. Getting LLMs to reliably output CLI commands instead of JSON requires careful system prompt design and testing across providers (xAI Grok, GPT-4o, Claude, Gemini). A dual parser (CLI primary, JSON fallback) eliminates the migration risk entirely.

## Key Findings

**Stack:** No new dependencies needed. CLI parser is hand-written vanilla JS. No YAML library. No npm packages. Two new files: `ai/cli-parser.js` (~300 lines), `ai/cli-prompt.js` (~250 lines). One major modification: `ai/ai-integration.js` (~500 lines changed). One minor modification: `background.js` (~20 lines for imports).

**Architecture:** The change is a protocol swap in steps 6-9 of the 21-step automation data flow. Steps 1-5 (DOM fetching, compact snapshot, RefMap) and steps 10-21 (action dispatch, ref resolution, tool execution, session tracking) are completely unchanged. See ARCHITECTURE.md for the complete line-by-line impact assessment.

**Critical pitfall:** LLM output format compliance varies across providers. Grok and GPT-4o handle CLI format instructions well; less capable models may revert to JSON. The dual parser (auto-detect format, parse accordingly) is mandatory, not optional.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **CLI Parser Module** - Zero dependencies on existing code; can be built and tested in complete isolation
   - Addresses: Core parsing infrastructure
   - Avoids: Coupling new code to existing modules before validation

2. **CLI System Prompt** - String constants defining the CLI format for AI communication
   - Addresses: Tool documentation, response format specification
   - Avoids: Prompt changes without a parser to validate against

3. **ai-integration.js Adaptation** - Wire parser and prompts into existing prompt building and response handling
   - Addresses: Dual parser (CLI + JSON fallback), system prompt swap, tool docs format
   - Avoids: Big-bang replacement (dual parser preserves JSON as fallback)

4. **Multi-Turn Conversation Adaptation** - Update conversation history, compaction, and continuation prompts for CLI format
   - Addresses: Multi-iteration workflows, context efficiency
   - Avoids: Breaking conversation continuity during migration

5. **Cross-Provider Testing** - Validate CLI output compliance across xAI, OpenAI, Anthropic, Gemini
   - Addresses: Provider-specific quirks, token reduction measurement
   - Avoids: Assuming all models handle CLI instructions identically

**Phase ordering rationale:**
- Parser before prompts: Must know exact syntax to document in system prompt
- Prompts before integration: System prompt text must be finalized before wiring into buildPrompt()
- Integration before multi-turn: Single-iteration must work before testing conversation history
- Testing last: All components must be assembled before provider validation is meaningful

**Research flags for phases:**
- Phase 3: Needs iterative prompt engineering -- the system prompt wording significantly affects LLM compliance with CLI format
- Phase 5: Provider-specific testing may reveal models that need special handling (Gemini tends to wrap responses in markdown, Anthropic tends to be verbose)
- Phases 1-2: Standard patterns, no additional research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. Verified: no npm, no build system, vanilla JS importScripts pattern. Confirmed by codebase constraint in PROJECT.md. |
| Features | HIGH | Feature set is narrow and well-defined: CLI parser, CLI prompts, dual parser integration. Industry evidence from Playwright CLI, agent-browser, webctl confirms the approach. |
| Architecture | HIGH | Line-by-line codebase analysis of data flow from startAutomationLoop through content script execution. All 21 steps traced. Change boundary precisely identified at steps 6-9. |
| Pitfalls | HIGH | JSON parsing failures (current problem) and LLM format compliance (migration risk) are well-documented in the codebase and industry literature. Dual parser strategy is proven. |

## Gaps to Address

- **Provider-specific CLI compliance:** How well do Grok 4.1 Fast, GPT-4o, Claude Sonnet 4.5, and Gemini 2.5 Flash follow CLI format instructions? Must be tested empirically during Phase 5. Training data may bias models toward JSON output.

- **Reasoning quality in comments vs. JSON fields:** Current JSON format demands structured reasoning (situationAnalysis, goalAssessment, confidence). CLI comments are free-form. Whether this affects decision quality needs empirical validation.

- **Batch action routing:** Current system has explicit `batchActions` field in JSON response. CLI format treats multiple commands as naturally sequential. Need to verify that `executeBatchActions()` routing in background.js still triggers correctly when the CLI parser produces multi-action responses.

- **Token reduction measurement:** Industry reports 60-93% reduction, but FSB's compact snapshot (already in use) means the baseline is already lower than full JSON DOM dumps. Actual FSB-specific reduction likely 40-60% -- must be measured.

---

## Sources

### Primary (HIGH confidence -- direct codebase analysis)
- `background.js` lines 7941-9400, 2367-2466, 10100-10172 -- automation loop, message dispatch, callAIAPI
- `ai/ai-integration.js` lines 554-700, 754-960, 1735-1934, 2129-2418, 3956-4161 -- AI class, prompt building, parsing
- `content/dom-analysis.js` lines 1840-2003 -- generateCompactSnapshot
- `content/dom-state.js` lines 610-776 -- RefMap class
- `content/selectors.js` lines 555-574 -- resolveRef
- `content/messaging.js` lines 764-888 -- executeAction handler with ref resolution

### Secondary (MEDIUM confidence -- industry evidence)
- [Playwright CLI](https://testcollab.com/blog/playwright-cli) -- 76% token reduction benchmarks
- [agent-browser](https://github.com/vercel-labs/agent-browser) -- @e1 ref format, 93% context reduction
- [webctl](https://github.com/cosinusalpha/webctl) -- CLI-first browser automation pattern
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) -- Accessibility tree + refs pattern

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
