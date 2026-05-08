---
phase: 245
title: Post-Action Change Report (Inline Diff Return)
authored: 2026-05-06
mode: locked-recommendations
---

# Phase 245 -- Post-Action Change Report

## One-line summary

After every non-read MCP tool call, the extension returns a compact `change_report` describing what the action mutated, so the agent does not have to follow up with `read_page` / `get_dom_snapshot` to learn the consequence.

## Problem statement

Today an MCP agent calling `click`, `type_text`, `select_option`, etc. receives only `{ success: true, message: "..." }`. To learn what the action actually did (a modal opened, the URL changed, a new error appeared, an input populated, focus shifted), it must call a separate read tool. This produces:

- 2x round-trips per action on average
- Wasted tokens on full-page reads when only a small region changed
- Slower convergence in stuck-detection (the model cannot tell from the response alone whether the click took effect)

## Goal

Wrap every action tool with a `MutationObserver` started just before invocation and harvested after `waitForDOMStable` settles. Serialize the result as a size-capped JSON `change_report` and return it inline alongside the existing tool response.

## Locked design decisions (recommendations accepted)

### D-01: Wrap timing -- start observer before action, harvest after stable

The observer starts immediately before the action handler runs and stops after `waitForDOMStable()` resolves (or a 500ms safety net, whichever first). This catches both synchronous DOM updates (form fills, attribute changes) and async ones (XHR-driven re-renders, route changes).

**Why**: We already use `waitForDOMStable` in `mcp-tool-dispatcher.js` for many handlers; piggybacking on it costs ~0 additional latency. The 500ms safety net protects against pages where mutations never quiesce (chat apps, animation-heavy SPAs).

### D-02: Diff scope -- ancestor-of-target when known, document-wide otherwise

When the action targets a specific element (selector or `elem_*` ID), the MutationObserver is rooted at the nearest stable ancestor (e.g., the closest `<form>`, `<dialog>`, `<main>`, or 3 levels up if none). For document-level actions (`navigate`, `refresh`, `back`, `scroll_to_top`), it observes `document.documentElement`.

**Why**: Scoped observation keeps the diff focused on consequences, not page noise (analytics scripts, ad refreshes, cookie banners reflowing).

### D-03: Filter rules -- drop the noise

The harvest pipeline filters out:
- Style-only changes (`style` attribute mutations on the same element with no other change)
- Animation-class-only changes (mutations whose only change is `class` toggling on a known animation/transition class -- detected via heuristic: the class disappears within 500ms or matches `*-enter*`, `*-leave*`, `*-active`, `*-show*`, `*-hide*`, `animate-*`, `motion-*`)
- Scroll-position events (`scroll` events do not appear as mutations but `scrollTop`/`scrollLeft` changes via attribute mutation are dropped)
- Mutations to elements with `aria-hidden="true"` that remain hidden post-stable
- Text-only changes shorter than 3 characters (typically counter ticks)

### D-04: Output shape

```json
{
  "change_report": {
    "url": { "before": "...", "after": "...", "changed": false },
    "title_changed": false,
    "dialogs_opened": [
      { "selector": "dialog#confirm-modal", "text": "Are you sure?" }
    ],
    "nodes_added": [
      { "tag": "div", "text": "Item added", "selector": ".toast.success" }
    ],
    "nodes_removed": [
      { "tag": "div", "text": "Loading", "selector": ".spinner" }
    ],
    "attrs_changed": [
      { "selector": "button#submit", "attr": "disabled", "before": "true", "after": null }
    ],
    "inputs_changed": {
      "email": { "before": "", "after": "user@example.com" }
    },
    "focus_shift": { "from": "input#email", "to": "input#password" },
    "mutation_count": 14,
    "settle_ms": 320,
    "truncated": false
  }
}
```

When the serialized payload exceeds 2400 bytes (~600 tokens), the report is truncated:
- Arrays are sliced to `top N` (3 dialogs, 5 added, 5 removed, 8 attr changes)
- `truncated: true` is set
- A sibling field `change_report_hint: "truncated; call read_page for full state"` is added

### D-05: Coverage list -- which tools include the field

**INCLUDE** (action tools, return change_report):
`click`, `click_at`, `right_click`, `double_click`, `double_click_at`, `click_and_hold`, `type_text`, `insert_text`, `clear_input`, `select_option`, `check_box`, `press_key`, `press_enter`, `hover`, `focus`, `scroll`, `scroll_at`, `scroll_to_bottom`, `scroll_to_top`, `scroll_to_element`, `drag`, `drag_drop`, `drag_variable_speed`, `drop_file`, `fill_credential`, `fill_sheet`, `set_attribute`, `select_text_range`, `navigate`, `go_back`, `go_forward`, `back`, `refresh`, `open_tab`, `switch_tab`, `execute_js`

**EXCLUDE** (read-only / info / wait tools, do NOT return change_report):
`get_text`, `get_attribute`, `read_page`, `get_dom_snapshot`, `read_sheet`, `list_tabs`, `list_credentials`, `list_payment_methods`, `list_sessions`, `get_session_detail`, `get_logs`, `get_memory_stats`, `get_task_status`, `wait_for_element`, `wait_for_stable`, `search_memory`, `start_visual_session`, `end_visual_session`, `run_task`, `stop_task`, `use_payment_method`, `search`

The split is enforced via a new `_emitChangeReport: true` flag in `tool-definitions.js` (default `false`; explicitly set on the action list above). `mcp-tool-dispatcher.js` checks the flag before instrumenting.

### D-06: Per-tool opt-out

Tools where the diff is reliably noise (`scroll`, `scroll_at`, `hover`, `focus`) start with `_emitChangeReport: false`. The agent loop and stuck detector do not need diffs from passive movements. Easy to flip on per-tool later if user feedback indicates.

### D-07: Global opt-out

A new toggle in `options.html` Advanced Settings: **"Return action change reports (recommended)"** -- default ON, persists to `chrome.storage.local` under `fsbChangeReportsEnabled`. When OFF, the dispatcher skips instrumentation entirely (zero overhead). This is mostly for power users who want to minimize token usage on simple flows.

### D-08: Cross-origin / non-DOM-accessible navigations

When `navigate` / `back` / `go_back` / `go_forward` cross origins, the content script in the new origin may not be ready by the time we harvest. In that case:
- `url.before` and `url.after` are still populated (chrome.tabs API)
- `url.changed: true`
- All other fields default to empty arrays / nulls
- `mutation_count: 0`, `settle_ms: 0`, `truncated: false`
- A field `cross_origin: true` is added so the agent knows DOM-level info is unavailable

### D-09: Performance budget

- Observer overhead: <5ms per action on typical pages (measured in v0.9.36 dom-stream tests at 8-12ms for full-document observation; we are scoped tighter)
- Serialization budget: <10ms (JSON.stringify of bounded arrays)
- Total added latency target: <25ms p95
- If `settle_ms > 500` (safety net hit), `change_report.partial: true` is set so the agent knows the report is best-effort

### D-10: Reuse, don't reinvent

`extension/utils/action-verification.js` already has `capturePageState()` and `comparePageStates()` returning a similar (less rich) shape. Phase 245 enriches that module rather than creating a parallel pipeline. New exports:
- `startMutationHarvest(targetSelector | null) -> harvestHandle`
- `stopMutationHarvest(harvestHandle) -> mutations[]`
- `buildChangeReport(beforeState, afterState, mutations, options) -> changeReport`
- `applyChangeReportSizeCap(report) -> { report, truncated: bool }`

`comparePageStates` stays for backward compatibility (used by stuck detection); `buildChangeReport` is the new richer surface.

## Open questions (none locked open)

All design questions answered with recommendations above. If during planning the planner finds a better approach for D-02 (scope) or D-03 (filters), they may propose -- but D-01, D-04, D-05, D-07, D-08 are locked.

## Out of scope (deferred)

- Visual screenshot diff (could be a future v0.9.70 phase if needed)
- Cross-tab side effects (action in tab A causes tab B to update -- still requires explicit `read_page` on tab B)
- Network-level diff (request/response capture) -- not needed for the agent's reasoning
- Persisting change_reports to disk for replay/debugging -- diagnostics ring buffer already covers this

## Acceptance criteria (numbered, machine-checkable)

1. **CHANGE-01**: Calling `click` on a button that opens a modal returns `change_report.dialogs_opened` containing the modal selector + text.
2. **CHANGE-02**: Calling `type_text` populates `change_report.inputs_changed[fieldKey]` with `{before, after}`.
3. **CHANGE-03**: Calling `read_page` does NOT include `change_report` in the response.
4. **CHANGE-04**: A noisy SPA action that produces >50 mutations returns `change_report.truncated: true` and the payload is under 2500 bytes.
5. **CHANGE-05**: Toggling `fsbChangeReportsEnabled = false` in storage causes all action tool responses to return without `change_report`.

## Test surface (planning hint)

- Unit: `tests/change-report-builder.test.js` -- shape, cap, filters, cross_origin path
- Integration: `tests/change-report-dispatcher.test.js` -- click/type/select/navigate paths produce expected shape; read tools do not
- Storage: `tests/change-report-toggle.test.js` -- global toggle suppresses
- Performance: extend an existing dom-stream perf test to assert <25ms added latency p95 on a 100-mutation fixture

## What this phase does NOT change

- Existing tool response shape: `change_report` is **additive**; `success`, `message`, and tool-specific fields stay byte-identical
- MCP protocol version
- Manifest permissions
- npm dependencies
- `mcp/` server side -- this phase is extension-only; the server passes the field through transparently

## Version posture

Phase 245 ships as part of v0.9.60 (extension-side enhancement, no MCP protocol change). No version bump required since the milestone bump to 0.9.60 already covers it. If user wants this in a separate release line, bump to 0.9.61 in the release-engineering step.

## Risks

- **R1**: Filtering rules drop a real change as "animation noise". Mitigation: filter heuristics conservative; when in doubt, include.
- **R2**: MutationObserver stalls on chat/animation pages and 500ms safety net always trips. Mitigation: `partial: true` flag; agent learns to call `read_page` when it sees the flag.
- **R3**: Global toggle is forgotten ON in tests, masking regressions. Mitigation: tests explicitly set `fsbChangeReportsEnabled` per-suite.

---

*Authored: 2026-05-06 with locked-recommendations mode (no interactive grey-area resolution).*
*Next step: `/gsd-plan-phase 245` to produce 245-01-PLAN.md and 245-02-PLAN.md.*
