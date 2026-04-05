# Phase 19: Cross-Provider Validation - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Empirically validate that the CLI command format works correctly across all four supported AI providers (xAI Grok, OpenAI GPT-4o, Anthropic Claude, Google Gemini). Measure token reduction vs the previous JSON format and verify edge case coverage. This phase tests and validates the work from Phases 15-18 -- it does not add new features or change the CLI format itself.

</domain>

<decisions>
## Implementation Decisions

### Test execution approach
- Automated test harness built inside the extension (hidden debug/validation panel)
- Both live API mode and saved golden response mode -- a --live flag (or toggle) switches between them
- Saved snapshots for repeatable regression; live mode for initial validation and periodic smoke tests
- All task types tested per provider: navigation, form fill, data extraction, search+click, and Google Sheets workflows
- Each provider must be tested against all task types, not just 3

### Token measurement method
- Use a local tokenizer library (like tiktoken) to count tokens in prompt and response strings
- Compare CLI-format prompts vs reconstructed JSON-format equivalents on the same DOM data (Claude's discretion on best comparison approach)
- 40% average token reduction target across all providers as stated in success criteria
- Display token comparison results during test runs only -- leverage existing analytics module for persistent tracking in production
- No separate persistent report file needed for test runs

### Edge case test design
- Special characters in typed text must roundtrip exactly -- character-for-character identical at the input field, no escaping or mangling
- URL handling in CLI arguments: Claude's discretion based on existing parser implementation
- Multi-line AI reasoning with # comments: Claude's discretion on whether comments are stripped, preserved in logs, or both
- Google Sheets and career search workflows: saved DOM snapshots for regression, live pages as optional smoke test
- Test both parsing AND execution -- full execution validation against mock DOM, not just parse checking

### Results reporting
- Detailed reporting with diffs: show expected vs actual CLI output for failures, full command breakdown per test
- Failure categorization: Claude's discretion on the most useful failure types (e.g., returned JSON, plain text, syntax errors, partial CLI)
- Full execution validation: parse provider responses into action objects AND execute against mock DOM to verify end-to-end correctness
- Test panel is power-user accessible via settings toggle or hidden keyboard shortcut -- not developer-only, but not prominently visible

### Claude's Discretion
- Best approach for CLI vs JSON token comparison baseline (synthetic reconstruction vs historical data)
- URL argument handling strategy in CLI parser (quoting rules vs auto-detection)
- Comment line handling in multi-line responses (strip, preserve in logs, or both)
- Failure categorization taxonomy for non-compliant provider responses
- Exact tokenizer library choice
- Test panel UI design and access mechanism (settings toggle vs keyboard shortcut)

</decisions>

<specifics>
## Specific Ideas

- The extension already has analytics tracking (analytics.js) -- token measurement should be aware of this existing infrastructure rather than building separate tracking
- Live tests require real API keys for all 4 providers to be configured
- Career search workflows include multi-site navigation and storeJobData commands
- Google Sheets workflows include Name Box navigation, cell editing, and formatting commands

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 19-cross-provider-validation*
*Context gathered: 2026-03-01*
