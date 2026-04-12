# Feature Landscape: Progress Overlay Refinement

**Domain:** Browser automation progress feedback UX
**Researched:** 2026-04-11
**Context:** FSB v0.9.26 -- refining existing progress overlay to show clean, user-facing information instead of developer debug noise

## Table Stakes

Features users expect from any tool that performs multi-step automation on their behalf. Missing any of these makes the overlay feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Current action in plain English** | Every shipping automation tool (Operator, Mariner, ChatGPT Agent) shows what the agent is doing right now in human-readable text. Users need to know the system is not frozen. | Low | FSB already has `display.detail` from `buildOverlayDisplay`. The issue is that some messages still leak developer-facing language. Ensure all statusText values are user-readable sentences like "Clicking the search button" not "click [ref=42]". |
| **Animated activity indicator** | Users need visual proof the system is actively working, not hung. NN/g research: users tolerate 3x longer waits when animated feedback is present. | Low | FSB already has the indeterminate progress bar sweep animation and the viewport glow. Both are implemented and working. No change needed beyond switching the progress fill to `scaleX` transform for GPU compositing. |
| **Task name / what was asked** | Users need a reminder of what they asked for, especially on tasks that take 30+ seconds. Operator, Mariner, and ChatGPT Agent all show the original request prominently. | Low | FSB already shows `display.title` with the task name. Keep this. |
| **Phase/state label** | A single word or short phrase indicating the current phase: "Planning", "Acting", "Writing", "Recovering". Every automation tool uses some form of state badge. Operator uses "Watch mode" / "Takeover mode". Mariner shows "Active" / "Paused". | Low | FSB already has `humanizeOverlayPhase()` producing clean labels. The 300ms debounce prevents flicker. Keep as-is. |
| **Elapsed time display** | How long the task has been running. For tasks taking 10+ seconds (which is most FSB tasks), this sets expectations and provides a sense of progress. ChatGPT Deep Research shows a timer. Users universally understand time, unlike tokens or iterations. | Low | Not currently shown in the overlay. Add via `performance.now()` or `Date.now()` delta from `session.startTime`. Display as "12s" or "1m 30s" in the meta row. Use `font-variant-numeric: tabular-nums` to prevent layout jitter as digits change. Update only when displayed second changes. |
| **Clean completion state** | Clear visual signal when the task finishes -- success, failure, or stopped. Users should not have to guess whether automation is still running. | Low | FSB already handles this with `lifecycle: 'final'` and `result: 'success'/'error'/'stopped'`. Add final elapsed time freeze and action count to the completion display. |

## Differentiators

Features that set FSB apart from competitors. Not strictly expected, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Actions completed counter** | Shows tangible progress as a number. More concrete than a phase label. "7 actions" tells users the system has been productive, not spinning its wheels. Playwright UI Mode uses a similar step counter. Format: "7 actions" not "Actions: 7". | Low | Count completed tool calls from `session.actionHistory` or a simple counter incremented per tool execution. Display with `tabular-nums` in the meta row next to elapsed time. |
| **Determinate progress bar for structured tasks** | Multi-site search (3/5 companies) and Sheets writing (12/20 rows) already have determinate progress. This is a genuine differentiator -- most AI browser agents only show indeterminate spinners. | Low | Already implemented via `computeMultiSiteProgress` and `computeSheetsProgress` in overlay-state.js. Keep and polish. Switch from `width` to `scaleX(n)` with `transform-origin: left` for GPU-composited animation. |
| **Contextual progress bands** | Phase-weighted bands (navigation 0-30%, extraction 30-70%, writing 70-100%) provide more meaningful progress than linear iteration counting. Users see the bar move in proportion to actual task advancement. | Low | Already implemented in FSB v0.9.5. Keep -- this is a genuine differentiator over indeterminate-only competitors. |
| **AI-generated action summaries** | Instead of "click [ref=42]", show "Clicking the Add to Cart button". Natural language descriptions of what the agent is doing feel transparent and trustworthy, similar to ChatGPT Agent's line-by-line narration. | Low | Already implemented via fire-and-forget `generateActionSummary` with 2.5s timeout and cache. The mechanism exists but needs enforcement: ensure every overlay update uses the summarized text, never raw tool call syntax. |
| **Recovery state visibility** | When the agent gets stuck and recovers, showing "Recovering -- trying alternative approach" instead of silently retrying builds trust. Users know the system is intelligent, not blindly repeating. | Low | Already implemented -- `humanizeOverlayPhase('recovering')` returns "Recovering". Ensure the detail text explains the recovery strategy in plain English. |
| **Smooth progress transitions** | Progress bar glides between values with easing instead of jumping. Feels responsive and alive. | Low | CSS `transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)` on the scaleX property. Already partially present via `transition: width 0.3s ease-out` but should move to transforms. |
| **Reduced motion respect** | Users with vestibular disorders get static indicators instead of animations. | Low | Partially implemented via `@media (prefers-reduced-motion)`. Extend to cover all new transitions including elapsed time updates. |

## Anti-Features

Features to explicitly NOT show in the user-facing progress overlay. These are the core of the v0.9.26 cleanup.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Iteration count (e.g., "Iteration 3/20")** | Meaningless to end users. "Iteration" is a developer concept. Users do not know or care that the agent loop runs in numbered iterations. Showing "3/20" creates false expectations about completion timing (iteration 3 is not 15% done). | Show action count ("7 actions") or phase-weighted progress bar. |
| **Token counts (input/output/total)** | Pure developer/cost debugging metric. No end user knows what "12,847 tokens" means or why they should care. Adds visual noise and anxiety. Research shows token metrics are exclusively a developer/ops concern. | Remove entirely from overlay. Keep in options dashboard analytics for power users who want cost tracking. |
| **Cost information ($0.0043)** | Showing cost per interaction creates anxiety and cheapens the experience. Users already paid for the API key -- showing micro-costs per action is like a taxi meter that makes every second feel expensive. | Remove entirely from overlay. Surface in session history and analytics dashboard only. |
| **Max iterations** | The denominator in "3/20" is an internal safety limit, not a task progress measure. Showing it implies the task will take exactly 20 steps, which is almost never true. | Remove. Use phase-weighted progress or action count instead. |
| **Model name / provider** | Users do not care that "grok-4-1-fast" is processing their request. This is configuration noise. | Remove from overlay. Visible in options/settings only. |
| **DOM hash / technical state** | Internal stuck detection data has zero user value. | Never expose in overlay (already not shown, but ensure it stays that way). |
| **Raw tool call syntax** | "click [ref=42]" or "type [ref=17] 'hello'" is developer debug output. | Always use AI-generated summaries or at minimum human-readable descriptions: "Clicking the search button", "Typing 'hello' in the text field". |
| **Error stack traces** | Technical error details belong in logs, not user-facing UI. | Show "Something went wrong -- retrying" or "Task stopped due to an error". Full error details in the automation logger for debugging. |
| **ETA countdown** | AI automation step duration is fundamentally unpredictable. "Estimated: 47 seconds remaining" that jumps to "2 minutes" destroys trust faster than no ETA. NN/g research: "Provide general time estimates rather than precise ones. Pleasant surprises (finishing early) maintain trust better than disappointing delays." | Show elapsed time only. Let users form their own expectations. If ETA is ever re-added, use ranges ("about 30 seconds") or qualitative labels ("almost done"), never precise seconds. |
| **Cancel button in overlay** | Would require pointer-events, click handlers, and message passing from content script to background. Increases overlay surface area and risk of accidental interaction interfering with automation. | Cancel is already available in the popup and sidepanel UIs. The overlay is read-only by design. |
| **Action history scroll** | Showing a scrollable list of past actions in the overlay adds complexity and visual noise. The overlay is a status display, not a log viewer. | Show only the most recent action. History is in the sidepanel chat. |
| **Expandable detail panel** | Adding click-to-expand sections makes the overlay interactive, which conflicts with `pointer-events: none` and the non-blocking design principle. | Keep the overlay read-only and minimal. Detailed logs belong in the sidepanel or dashboard. |

## Feature Dependencies

```
Shadow DOM isolation (existing) --> all overlay features
  |
  +--> scaleX progress bar (CSS-only, no dependency)
  |
  +--> Elapsed timer (requires session.startTime from agent loop)
  |
  +--> Action counter (requires action count from agent loop)
  |
  +--> AI summaries (existing) --> clean detail text
  |
  +--> Phase-weighted progress (existing) --> determinate bar
  |
  +--> Completion state freeze --> lifecycle === 'final' detection (existing)

Strip developer noise --> Clean action summaries (summaries depend on knowing what noise was removed)
```

Key: No feature in this plan requires new infrastructure. Everything builds on the existing overlay-state.js + visual-feedback.js + agent-loop.js pipeline.

## Information Hierarchy (What the Overlay Should Show)

Based on research across Project Mariner, OpenAI Operator, ChatGPT Agent, SAP Fiori AI guidelines, and NN/g progress indicator research, the optimal information hierarchy for FSB's overlay:

### Always visible (the overlay surface)
1. **FSB branding** -- logo + "FSB Automating" (establishes identity, already present)
2. **Task name** -- what the user asked for (primary text, `display.title`)
3. **Current action in plain English** -- what the agent is doing right now (secondary text, `display.detail`, updates frequently)
4. **Phase badge** -- "Planning" / "Acting" / "Writing" / "Recovering" (small pill, `humanizeOverlayPhase`)
5. **Progress bar** -- determinate when phase-calculable, indeterminate sweep otherwise
6. **Meta row** -- elapsed time (left) + action count (right)

### Never visible in overlay
- Iteration counts, token counts, cost, model name, max iterations, DOM hash, raw tool syntax, error stack traces

### Visible elsewhere (options dashboard, session history)
- Token usage, cost per session, model used, iteration breakdown, full error logs, ETA experiments

## Design Patterns from Best-in-Class Products

### Pattern 1: Narrated Action Stream (ChatGPT Agent, Operator)
Both ChatGPT Agent and OpenAI Operator show a line-by-line narration of what the agent is doing. ChatGPT Agent displays this in an "activity panel" with scrolling text showing which pages are being opened and what actions are being taken. Operator shows numbered steps (001, 002, 003...) with action descriptions. Users can "watch as the agent browses autonomously and monitor its progress in the activity panel."

**FSB adaptation:** The overlay is compact (320px floating card), not a full panel, so a scrolling log is inappropriate. Instead, show only the LATEST action as the detail line, updating it each time a new tool executes. The action count in the meta row provides the cumulative narrative.

### Pattern 2: Phase State Machine (Project Mariner, SAP Fiori)
Mariner uses discrete states: Active, Paused, Take Over, Completed. SAP Fiori AI progress indicator uses an AI icon with looped animation, text message with status, animated gradient bar, and a stop button. Users see a clear state label plus an animated indicator appropriate to the state.

**FSB adaptation:** Already implemented with `humanizeOverlayPhase()`. The existing states (Planning, Analyzing, Acting, Writing, Recovering, Complete, Error) map well. No change needed.

### Pattern 3: Progressive Disclosure (Vercel AI SDK Task Component)
The Task component uses collapsible sections: a summary trigger header with visual icons for pending/in-progress/completed/error states. Expandable content reveals individual task items. Counter displays completed tasks relative to total.

**FSB adaptation:** The overlay is already compact and non-expandable by design (it floats over the user's page). Progressive disclosure is handled by keeping detailed metrics in the sidepanel/dashboard, not the overlay. The overlay IS the collapsed view.

### Pattern 4: Background Operation Pattern (Smart Interface Design Patterns)
"For long processes, collapse the task into a background state so the user isn't blocked from using the rest of the application." The overlay should not demand attention -- it should be glanceable.

**FSB adaptation:** The overlay is already non-blocking (pointer-events: none, positioned in top-right corner). It competes with page content minimally. The 320px width and dark theme with low opacity borders keep it unobtrusive.

### Pattern 5: Pacing Strategy (NN/g Research)
"Start progress animation slowly, accelerating toward completion -- this prevents setting faster expectations than the system can maintain." Also: animated progress bars make users willing to wait 3x longer than no indicator.

**FSB adaptation:** The phase-weighted bands already implement a form of pacing (navigation is 0-30%, extraction 30-70%, writing 70-100%). The scaleX transition with cubic-bezier easing will make bar movement feel smooth and natural.

## MVP Recommendation for v0.9.26

### Must ship (table stakes fixes):
1. **Strip developer noise** -- remove iteration count, token count, cost, max iterations from overlay payload and rendering
2. **Fix progress bar animation** -- switch from `width` to `scaleX` for GPU compositing, add proper easing
3. **Add elapsed time** -- `tabular-nums` in meta row, freeze on completion
4. **Add actions completed counter** -- "N actions" in meta row, `tabular-nums`
5. **Ensure all action text is human-readable** -- no raw tool call syntax ever reaches the overlay

### Should ship (differentiators that are low-cost):
6. **Verify AI summary pipeline** -- ensure `generateActionSummary` output is actually used for every overlay update
7. **Clean completion state** -- freeze elapsed time and show final action count on task end
8. **Extend reduced motion support** -- cover all new transitions in `@media (prefers-reduced-motion)`

### Defer to future milestone:
- ETA display (accuracy issues; elapsed time is strictly better for now)
- Cancel/stop button in overlay (available in popup/sidepanel; adding to overlay increases interaction surface complexity)
- Expandable overlay or action history scroll (adds complexity, low value -- detailed info belongs in sidepanel)
- Overlay position customization (top-right works universally)
- Sound notification on completion (preference-dependent, needs settings UI)
- Theming/color customization (not needed until user requests emerge)

## Sources

- [NN/g: Progress Indicators Make a Slow System Less Insufferable](https://www.nngroup.com/articles/progress-indicators/) -- HIGH confidence, authoritative UX research. Key finding: users wait 3x longer with animated progress bars, percent-done indicators are most informative for 10+ second operations.
- [Smart Interface Design Patterns: Designing Better Loading and Progress UX](https://smart-interface-design-patterns.com/articles/designing-better-loading-progress-ux/) -- HIGH confidence. Key finding: use background operation patterns for long tasks, start progress slowly and accelerate.
- [SAP Fiori AI Progress Indicator](https://www.sap.com/design-system/fiori-design-web/v1-136/ui-elements/ai-progress-indicator/usage) -- HIGH confidence, enterprise design system. Key components: AI icon with looped animation, text message for status, animated gradient bar, stop generating button.
- [OpenAI: Introducing Operator](https://openai.com/index/introducing-operator/) -- MEDIUM confidence. Key pattern: numbered step display, pause/stop/takeover controls, Watch mode and Takeover mode states.
- [Google Project Mariner](https://support.google.com/labs/answer/16270604) -- MEDIUM confidence. Key pattern: Chrome sidebar with live view, playback of steps, user can intervene or take over.
- [ChatGPT Agent](https://help.openai.com/en/articles/11752874-chatgpt-agent) -- MEDIUM confidence. Key pattern: activity panel with line-by-line narration, real-time visibility into pages visited and actions taken, mobile notification on completion.
- [Vercel AI SDK Task Component](https://elements.ai-sdk.dev/components/task) -- MEDIUM confidence. Key pattern: collapsible trigger header, status icons (pending/in-progress/completed/error), progress counter.
- [Mobbin: Progress Indicator UI Design](https://mobbin.com/glossary/progress-indicator) -- MEDIUM confidence, design pattern reference.

---
*Feature landscape for: FSB v0.9.26 Progress Overlay Refinement*
*Researched: 2026-04-11*
