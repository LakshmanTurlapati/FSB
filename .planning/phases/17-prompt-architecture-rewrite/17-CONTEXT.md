# Phase 17: Prompt Architecture Rewrite - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite every prompt the AI receives -- system prompt, task-type prompts, continuation prompts, stuck recovery prompts, and site guide examples -- to speak CLI command grammar exclusively (verb + ref + args). Eliminate all JSON tool-call format remnants. The CLI syntax itself (Phase 15) and snapshot format (Phase 16) are already finalized upstream.

</domain>

<decisions>
## Implementation Decisions

### System prompt design
- Compact table format for the CLI command reference -- scannable, dense, minimal tokens
- Commands grouped by category (Navigation, Element Interaction, Text Input, Information, etc.)
- Per-command example column in the table (e.g., `click e5`, `type e12 "hello"`)
- `done` command gets both a row in the command table AND a dedicated "Task Completion" section with rules (verify before done, include result summary, etc.)

### Site guide examples
- One-liner per action style -- each example is a single CLI command, not multi-step sequences
- Include a "common patterns" section in each guide showing typical multi-step workflows for that site
- Manual per-file migration of all 43+ site guide files from JSON to CLI format to ensure quality
- Ref style in examples: Claude's discretion -- pick whichever format (semantic placeholders vs numeric refs) the AI model responds to better

### Continuation & context tiers
- Brief reminder line for CLI syntax reinforcement in iteration 2+ prompts (e.g., "Respond with CLI commands only (verb ref args)")
- Full context triggered by URL change; minimal context (changes only) when staying on same page
- Include action history showing last N actions taken so the AI has context on what it already tried
- Show iteration number (e.g., "Iteration 3") so the AI knows how far along it is

### Stuck recovery prompts
- Contextual suggestions based on what the AI is stuck on, not a generic ordered fallback list
- AI can use a `help` command (like a real CLI) to look up available commands or get details on specific commands when stuck
- Include anti-patterns: explicitly list common stuck behaviors to avoid (e.g., "do not repeat the same click", "do not search again if results are visible")
- Escalation intensity across multiple stuck detections: Claude's discretion on whether to escalate progressively or keep consistent

### Claude's Discretion
- Exact escalation strategy for stuck recovery (progressive vs consistent intensity)
- Ref format in site guide examples (semantic placeholders vs numeric refs)
- `help` command implementation details (full list vs contextual subset)

</decisions>

<specifics>
## Specific Ideas

- User wants the AI to be able to call `help` like a real CLI to check available commands or get the full command list when stuck -- treating the command set as a self-documenting system
- Manual per-file migration preferred over bulk scripting to catch edge cases in the 43 site guides
- The `done` command must replace the `taskComplete` JSON field entirely -- it should be the only way to signal task completion

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 17-prompt-architecture-rewrite*
*Context gathered: 2026-03-01*
