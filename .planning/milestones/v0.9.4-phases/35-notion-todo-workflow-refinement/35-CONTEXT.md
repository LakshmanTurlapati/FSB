# Phase 35: AI Perception & Action Quality Refinement - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve how the AI sees web pages (DOM snapshot quality, scroll awareness, element inclusion) and how it executes actions (click diagnostics, verification, stability detection, error recovery). This is a cross-cutting refinement phase that improves reliability across ALL sites, not just Notion. The phase name "Notion Todo Workflow Refinement" is legacy — the actual scope is AI perception and action execution quality.

</domain>

<decisions>
## Implementation Decisions

### Snapshot Awareness
- Add scroll metadata header to every snapshot: scroll position %, content remaining above/below, hasMoreAbove/hasMoreBelow flags
- Reactive scroll policy — show metadata only, let the AI decide when to scroll based on its own reasoning. No proactive scroll prompts
- Viewport-complete element inclusion — include ALL interactive elements visible in the current viewport. No arbitrary element cap (currently 80). If 120 elements are in view, include 120. If 40, include 40
- Budget can be reconsidered given modern model context windows (1M+), but larger snapshots can also increase noise — Claude's discretion on the exact number

### Click Failure Diagnostics
- Diagnose first, report to AI, let AI decide recovery strategy — no blind automatic fallbacks
- Extended 8-point diagnostic check: 1) element visible? 2) disabled/aria-disabled? 3) covered by overlay/modal? 4) needs scroll into view? 5) pointer-events:none? 6) inside collapsed details/accordion? 7) requires hover to become clickable? 8) element removed from DOM between snapshot and click?
- Apply diagnostics to ALL interactive actions (click, type, select, check), not just click
- Claude's discretion on whether to keep CDP click as silent last resort or remove all automatic fallbacks

### Continuation Prompt Quality
- Keep everything critical in continuation prompts: REASONING FRAMEWORK, TOOL PREFERENCES, site guide knowledge, and specific scenarios. Only drop security preamble and locale info
- Flag domain changes explicitly to AI: "DOMAIN CHANGED from [old] to [new]. Previous site assumptions invalid. Re-analyze current page carefully."
- Site-aware tool hints — use site guide's toolPreferences array to highlight preferred tools in continuation prompt
- Improve stuck detection heuristics alongside recovery prompts — current counters/reset conditions are confusing and undocumented

### Adaptive Waiting
- NO hardcoded delays anywhere — replace ALL fixed delays (300ms, 150ms, etc.) with observation-based stability detection
- Use existing `waitForPageStability()` as the base, but improve it: no preset timer thresholds
- UI-ready detection for infinite-fetching sites (Google Docs, Sheets) — detect when interactive elements become enabled/focusable, proceed even if background fetches continue
- Pure observation-based: watch for actual DOM stability and network quiet through real signals

### Action Verification
- Localized + global verification: track changes near the action target (siblings, parent container) AND global state. Report specific observations: "Modal opened near target", "Dropdown expanded"
- Add canvas-aware verification for Google Docs/Sheets: verify via visible text changes, selection movement, URL fragment updates — not DOM-based but still validates
- Always report verification results in action response — every response includes what changed, what didn't, and confidence level
- Track verification accuracy over time: log predictions vs actual outcomes, calibrate confidence scores, feed into memory system

### Selector Resilience
- Context-aware re-resolve when selectors fail: use element's last-known context (nearby text, parent structure, position) to re-find it. "e5 was a button near the search form" → search near form
- Claude's discretion on selector priority order optimization across productivity sites + general web
- Persistent per-domain selector cache: cache successfully-resolved selectors to memory system. Build per-site "known good selectors" map over time
- Require unique selector match — if a selector matches more than 1 element, it's too ambiguous. Fall back to more specific selector or add positional constraint

### Binary State Actions
- Generic pre-check for ALL binary state actions: before any toggle/expand/collapse, check current state via ARIA attributes (aria-expanded, aria-checked, aria-selected, aria-pressed). Skip if already in target state
- Intent-based CLI commands: add check/uncheck as separate commands that enforce target state. Keep toggle for explicit flip. Eliminates ambiguity entirely
- Claude's discretion on response format for "already in state" cases

### Error Reporting & Debug Fallback
- Structured diagnostic on every failure: `reason` (human-readable), `diagnostic` (what was checked), `suggestions` (natural language, what AI could try next)
- Include element state snapshot on failure: visibility, disabled state, ARIA attributes, parent context
- Parallel debug fallback on failure: fire heuristic engine AND AI debugger call concurrently. If heuristic fix works, discard debugger response. If heuristic fails, AI debugger diagnosis is already ready — zero extra latency
- Natural language suggestions (not command suggestions) — AI interprets and generates the right recovery command

### Claude's Discretion
- Exact DOM snapshot budget number (currently 12K, can increase for modern models)
- Selector priority order optimization
- Response format for "already in state" binary action cases
- Whether to keep CDP click as silent last resort or remove all automatic fallbacks
- AI debugger prompt design and context payload
- Heuristic engine pattern library (which known failure modes to detect)
- Verification response structure details

</decisions>

<specifics>
## Specific Ideas

- "Everything in the viewport — that is the point" — element inclusion should be viewport-complete, not capped
- "No hardcoded delays... we use something to see if the page has loaded or not" — pure observation-based stability, no arbitrary timers
- "Run debugger agent as fallback... provide entire context... and it suggests what went wrong" — parallel heuristic + AI debugger on failures
- "AI debugger runs in parallel while heuristic tries fixing it... we return debugger agent's response if heuristic retry fails... hence no latency" — the key insight for the parallel debug architecture
- "We have 1 mil to play around with" — modern model context windows are large enough to reconsider restrictive budgets, but be wise about noise vs signal

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `waitForPageStability()` in actions.js:822-960 — DOM mutation + network request monitoring, can be extended for UI-ready detection
- `verifyActionEffect()` in actions.js:401-465 — pre/post state comparison, needs localization
- `captureActionState()` in actions.js:217-227 — global state capture, needs target-relative variant
- `buildMarkdownSnapshot()` in dom-analysis.js:2463-2649 — snapshot builder with region-based organization, scroll metadata can be added here
- `calculateElementScore()` in dom-analysis.js — relevance scoring, needs viewport-awareness
- `generateSelector()` in selectors.js:176-299 — accessibility-first selector generation, needs context-aware re-resolution
- `MINIMAL_CONTINUATION_PROMPT` in ai-integration.js:420-435 — continuation prompt, needs enrichment
- `findElementByStrategies()` in dom-analysis.js — multi-strategy selector lookup, can house context-aware re-resolve

### Established Patterns
- Action tools return `{ success: boolean, action: string, ...data }` — extend with diagnostic fields
- fsbRole elements bypass visibility checks (Stage 2) — viewport-complete inclusion builds on this
- Site guide `toolPreferences` arrays exist for all 7 productivity apps + Sheets — wire into continuation prompt
- togglecheck idempotency pattern (check pre-state, skip if already checked) — generalize to all binary state actions
- CDP mouse click via `Input.dispatchMouseEvent` — already global fallback, decision pending on whether to keep

### Integration Points
- dom-analysis.js Stage 2-3: element filtering/scoring needs viewport-complete rewrite
- dom-analysis.js:2574-2597: scroll metadata section, extend with hasMore flags and content-remaining estimate
- actions.js click/type/select handlers: add diagnostic layer before action and verification after
- ai-integration.js:420-435: MINIMAL_CONTINUATION_PROMPT replacement with hybrid prompt
- ai-integration.js domain change detection: add explicit flag to AI
- background.js stuck detection: multiple counter heuristics need cleanup
- selectors.js: add context-aware re-resolution and per-domain caching
- memory system: integrate selector success tracking and verification accuracy logging

</code_context>

<deferred>
## Deferred Ideas

- Multi-pass DOM snapshot (critical elements first, on-demand expansion) — architectural change, separate phase
- Segment large pages into scrollable chunks with overlapping viewport windows — complex, separate phase
- Learned selector caching from Task Memory discoveries — depends on memory system maturity
- Security pre-filtering of page content for command-like patterns — separate security phase

</deferred>

---

*Phase: 35-notion-todo-workflow-refinement*
*Context gathered: 2026-03-16*
