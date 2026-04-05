# Phase 15: CLI Parser Module - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A standalone parser module that converts line-based CLI text (e.g., `click e5`, `type e12 "hello"`) into the `{tool, params}` action objects the content script already dispatches on. Handles reasoning lines (#), error isolation across lines, and full compatibility with the existing 28+ tool dispatch format. The prompt architecture rewrite (Phase 17) and snapshot format (Phase 16) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Command vocabulary
- Accept both original camelCase tool names (selectOption, keyPress, goBack) AND shorter CLI-friendly aliases
- Aliases always map to canonical tool names internally; original names always work
- Claude has discretion on choosing the most natural short alias for each command (e.g., `select` vs `select-option`)
- All 28+ existing tools get CLI verb equivalents from day one -- full parity, no staged rollout
- Two signal commands beyond existing tools: `done` (task complete) and `fail` (task cannot be completed)

### Multi-arg syntax
- Positional arguments: parser knows arg order per verb (e.g., `type e12 "hello"` = ref first, text second)
- Optional arguments use double-dash flags: `scroll down --amount 500`, `click e5 --force`
- Boolean flags supported without values: `--force` means true, absence means false
- Quoted strings support both backslash escaping (`"He said \"hello\""`) and alternate quote types (`'He said "hello"'`)
- URLs must always be quoted: `navigate "https://example.com/path?q=test"`
- Element targeting accepts both refs (e5) and quoted CSS selectors ("#submit-btn") -- parser distinguishes by format

### Ref-less commands
- Claude's discretion on whether ref-less commands use direct args or a placeholder convention
- Scroll uses shorthand verb-direction commands (scrollDown, scrollUp, etc.) rather than `scroll down`
- Tab management uses individual flat verbs (openTab, switchTab, closeTab, listTabs) not grouped sub-commands
- Signal commands (done, fail) take an optional quoted message: `done "task complete"` or bare `done`

### Parser tolerance
- Case-insensitive for command verbs: CLICK, Click, click all normalize to `click`
- Empty lines and whitespace-only lines silently skipped -- no errors, no logging
- Unknown verbs: skip with warning logged, continue parsing remaining lines
- Strict parsing only: no auto-correction of malformed input (missing quotes, extra punctuation). If it doesn't match the grammar, it's a parse error for that line
- Per CLI-06: parse errors on individual lines are isolated -- valid commands before and after still execute

### Claude's Discretion
- Exact short alias names for each tool (single-word shortened vs hyphenated vs other)
- How ref-less commands handle their direct arguments (no placeholder vs placeholder convention)
- Internal parser architecture and data structures
- Error message formatting and warning log format

</decisions>

<specifics>
## Specific Ideas

- Grammar is `verb [ref] [positional-args] [--flag value] [--bool-flag]`
- Refs follow the eN pattern (e5, e12) established for Phase 16's snapshot format
- CSS selectors are distinguished from refs by being quoted strings that don't match the eN pattern
- The parser must produce output identical to what `FSB.tools[tool](params)` expects in content/messaging.js
- Reasoning lines (# prefix) are captured separately for logging/debugging, not dispatched

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 15-cli-parser-module*
*Context gathered: 2026-02-27*
