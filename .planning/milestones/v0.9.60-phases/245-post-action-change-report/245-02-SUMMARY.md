---
phase: 245
plan: 02
subsystem: extension/ws + extension/ui + mcp/src/tools
tags: [change-report, mcp-dispatcher, settings-ui, mutation-observer]
requires:
  - extension/utils/action-verification.js#startMutationHarvest
  - extension/utils/action-verification.js#stopMutationHarvest
  - extension/utils/action-verification.js#buildChangeReport
  - extension/utils/action-verification.js#applyChangeReportSizeCap
provides:
  - extension/ws/mcp-tool-dispatcher.js#wrapWithChangeReport
  - extension/ws/mcp-tool-dispatcher.js#fsbChangeReportsEnabled (module-scope)
  - extension/ui/control_panel.html#fsbChangeReportsEnabled (settings card)
  - extension/ui/options.js#fsbChangeReportsEnabled (5 extension points)
  - mcp/src/tools/manual.ts#CHANGE_REPORT_DESCRIPTION_SUFFIX (description suffix)
  - mcp/src/tools/schema-bridge.ts#ToolDefinition._emitChangeReport (typed field)
affects:
  - extension/ai/tool-definitions.js
  - extension/ws/mcp-bridge-client.js
  - extension/background.js
  - mcp/src/tools/agents.ts
  - mcp/src/tools/autopilot.ts
  - tests/change-report-dispatcher.test.js
  - tests/change-report-read-tools-excluded.test.js
  - tests/change-report-toggle.test.js
  - tests/change-report-settings-ui.test.js
  - package.json
tech-stack:
  added: []
  patterns:
    - chrome.scripting.executeScript injection (page-context harvest)
    - Promise.race vs setTimeout safety net (500ms hard cap)
    - chrome.storage.onChanged live cache invalidation (Phase 241 pattern)
    - Plain-Node assert tests (no jest/mocha)
key-files:
  created:
    - tests/change-report-dispatcher.test.js
    - tests/change-report-read-tools-excluded.test.js
    - tests/change-report-toggle.test.js
    - tests/change-report-settings-ui.test.js
  modified:
    - extension/ai/tool-definitions.js
    - extension/ws/mcp-tool-dispatcher.js
    - extension/ws/mcp-bridge-client.js
    - extension/background.js
    - extension/ui/control_panel.html
    - extension/ui/options.js
    - mcp/src/tools/agents.ts
    - mcp/src/tools/manual.ts
    - mcp/src/tools/autopilot.ts
    - mcp/src/tools/schema-bridge.ts
    - mcp/ai/tool-definitions.cjs
    - package.json
decisions:
  - D-05 implemented: 30 action tools annotated _emitChangeReport=true
  - D-06 implemented: 4 opt-out tools (scroll, scroll_at, hover, focus) annotated false
  - D-05 EXCLUDE list (16 read/info/wait/lifecycle tools in registry) annotated false explicitly for deterministic mapping
  - D-07 implemented: fsbChangeReportsEnabled module-scope toggle, hydrated from chrome.storage.local + onChanged listener
  - D-09 implemented: Promise.race vs 500ms setTimeout safety net; partial:true on safety hit
  - D-08 inherited: cross-origin transition skips DOM inspection, emits URL-only report with cross_origin:true
  - Single chokepoint: wrapWithChangeReport called from mcp-bridge-client.js _handleExecuteAction (the actual chokepoint for all action tool dispatch); helper itself lives in mcp-tool-dispatcher.js per plan
metrics:
  duration: under 90 minutes
  tasks: 5
  files: 16
  completed: 2026-05-06
---

# Phase 245 Plan 02: Dispatcher Wiring + Settings UI + Tool Descriptions Summary

Wired the change_report harvest end-to-end. Action tools now return a compact `change_report` field describing what they mutated, gated by per-tool `_emitChangeReport` flag and the global `fsbChangeReportsEnabled` toggle. Read tools and D-06 opt-outs revert to byte-identical pre-Phase-245 response shape with zero observer overhead. Closes CHANGE-01, CHANGE-03 (full), and CHANGE-05.

## What was built

### Tool-definitions annotations (Task 1)

Added `_emitChangeReport: <bool>` to 50 of the 51 tool definitions in `extension/ai/tool-definitions.js`:

| Group | Count | Flag |
|---|---|---|
| D-05 INCLUDE list (action tools) | 30 | `true` |
| D-06 opt-outs (scroll, scroll_at, hover, focus) | 4 | `false` |
| D-05 EXCLUDE list (read/info/wait) | 12 | `false` (explicit) |
| Lifecycle (complete_task, partial_task, fail_task, search) | 4 | `false` (explicit) |

Spot-check: `click`, `type_text`, `navigate`, `refresh`, `execute_js`, `drag_drop`, `set_attribute`, `select_option`, `check_box` all carry `_emitChangeReport: true`. `read_page`, `get_text`, `get_dom_snapshot`, `list_tabs`, `hover`, `scroll`, `scroll_at`, `focus`, `wait_for_element` all carry `_emitChangeReport: false`.

D-05 INCLUDE entries `back` and `fill_credential` are intentionally not in this registry (`back` is a message-route alias `mcp:go-back`; `fill_credential` lives in `mcp/src/tools/vault.ts`).

Verification: `node --check extension/ai/tool-definitions.js` passes; `grep -c "_emitChangeReport: true"` returns 30; `grep -c "_emitChangeReport: false"` returns 20.

### Dispatcher wiring (Task 2)

`extension/ws/mcp-tool-dispatcher.js` (lines 1-39 added at top, lines 1797-2058 added before exports):

- **Module-scope toggle cache** (lines 11-39): `fsbChangeReportsEnabled` defaults true, hydrated from `chrome.storage.local`, refreshed via `chrome.storage.onChanged` listener. Test-only accessors `_getChangeReportsEnabled()` and `_setChangeReportsEnabledForTest(v)`.
- **Page-context harvest functions** (lines ~1820-2010): `_fsbHarvestStartInPage(targetSelector)`, `_fsbHarvestStopInPage()`, `_fsbWaitStableInPage()`. Self-contained (no closures over SW scope) so they survive `chrome.scripting.executeScript` serialization. Capture beforeState/afterState, run scoped MutationObserver per D-02, serialize MutationRecords back to plain objects with synthesized `getAttribute` shims so the SW-side `buildChangeReport` reads them like real DOM nodes.
- **wrapWithChangeReport(ctx)** (lines ~2030-2055): single entry point that:
    1. Returns `execute()` unmodified if `_emitChangeReport` flag is false OR global toggle is off (zero overhead path)
    2. Captures `beforeUrl` via `chrome.tabs.get`, injects harvest start
    3. Awaits `execute()`
    4. Races `_fsbWaitStableInPage` vs 500ms setTimeout safety net; sets `partial:true` on safety hit (D-09)
    5. Detects cross-origin transition by comparing `beforeOrigin` vs `afterOrigin`; on cross-origin, skips DOM inspection (D-08)
    6. Calls `buildChangeReport` + `applyChangeReportSizeCap` from the SW-loaded `action-verification.js`; attaches `change_report` and (when truncated) `change_report_hint`
    7. Try/catches every step so action result is never blocked on report failure
- Exposed on `globalThis.wrapWithChangeReport` for the bridge-client to reach without a circular import.

`extension/ws/mcp-bridge-client.js#_handleExecuteAction` (lines 561-590): wraps the existing dispatch (background route OR content-script sendMessage) in `wrapWithChangeReport`. Short-circuits when wrapper unavailable so older builds keep working.

`extension/background.js` (lines 16-21): added `importScripts('utils/action-verification.js')` before the dispatcher import so `buildChangeReport` and `applyChangeReportSizeCap` are SW-global. DOM-bound functions (`capturePageState`, `startMutationHarvest`) live in the same file but are never invoked from SW.

Verification: `node --check` passes on dispatcher, bridge-client, and background.

### Settings UI (Task 3)

`extension/ui/control_panel.html` (lines 449-474, between Concurrency Cap card and Performance Optimizations card): new "Action Change Reports" card with modern-toggle checkbox `id="fsbChangeReportsEnabled"` checked-by-default, plus D-07 helper text.

`extension/ui/options.js` extended at the 5 Phase 241 cap-toggle pattern points:

| Function | Line range (approx) | Change |
|---|---|---|
| `defaultSettings` | 32-37 | added `fsbChangeReportsEnabled: true` |
| `cacheElements` | 159-160 | wires `elements.fsbChangeReportsEnabled` |
| `setupEventListeners` | 343-352 | change handler -> `markUnsavedChanges()` |
| `loadSettings` | 884-888 | reads `settings.fsbChangeReportsEnabled ?? true` into `.checked` |
| `saveSettings` | 1000-1003 | persists `elements.fsbChangeReportsEnabled?.checked ?? true` |

Verification: `node --check extension/ui/options.js` passes.

### MCP tool descriptions (Task 4)

- `mcp/src/tools/schema-bridge.ts`: extended `ToolDefinition` interface with optional `_emitChangeReport?: boolean` and `_forceForeground?: boolean` so manual.ts can read the flag without an `as any` cast.
- `mcp/src/tools/manual.ts`: added `CHANGE_REPORT_DESCRIPTION_SUFFIX` module constant; `registerManualTools` now appends the suffix to descriptions of tools whose `_emitChangeReport` flag is true. Read-only and D-06 opt-out tools keep their original descriptions.
- `mcp/src/tools/agents.ts`: module-level JSDoc + suffix appended to the `back` tool description (action tool registered here).
- `mcp/src/tools/autopilot.ts`: module-level JSDoc clarifying that run_task / stop_task / get_task_status are task-lifecycle tools and do NOT carry `change_report` on response.
- `mcp/ai/tool-definitions.cjs` re-copied via `npm --prefix mcp run build` so the MCP server sees the new flags.

Verification: `cd mcp && npx tsc --noEmit` passes cleanly.

### Tests (Task 5)

| File | Assertions | Coverage |
|---|---|---|
| `tests/change-report-dispatcher.test.js` | 22 | CHANGE-01: dialog-open mutation produces populated `dialogs_opened`; all 11 D-04 keys present; URL/title delta reflected; original response preserved |
| `tests/change-report-read-tools-excluded.test.js` | 30 | CHANGE-03: 6 read/opt-out tools (read_page, get_text, get_dom_snapshot, list_tabs, hover, scroll) all return without `change_report` and with zero `chrome.scripting` calls |
| `tests/change-report-toggle.test.js` | 10 | CHANGE-05: toggle off -> no harvest, no field; toggle on -> harvest runs, field attached |
| `tests/change-report-settings-ui.test.js` | 10 | Source-text scan: 5 Phase 241 extension points + control_panel.html card with checked-by-default checkbox + D-07 helper text |

All four pass standalone: 72 assertions green. Combined Plan 01 + Plan 02 = 7 test files, 96 assertions, all green.

`package.json` "test" script extended to include the four new files after the Plan 01 tests.

## Decisions implemented

| Decision | Status | Implementation |
|---|---|---|
| D-01 (wrap timing) | inherited from Plan 01 | dispatcher harvest runs before `execute()`, harvests after waitStable race |
| D-02 (diff scope) | inherited from Plan 01 | scope walk done in `_fsbHarvestStartInPage` |
| D-03 (filter rules) | inherited from Plan 01 | `isNoiseMutation` runs in SW-side `buildChangeReport` |
| D-04 (output shape) | inherited from Plan 01 | `wrapWithChangeReport` attaches `change_report` + optional `change_report_hint` |
| D-05 (coverage list) | **closed** | 30 INCLUDE tools flagged true; 12 EXCLUDE tools flagged false; 8 lifecycle/D-06 tools flagged false |
| D-06 (per-tool opt-out) | **closed** | scroll, scroll_at, hover, focus all `_emitChangeReport: false` |
| D-07 (global toggle) | **closed** | `fsbChangeReportsEnabled` cache + storage listener + Settings UI card |
| D-08 (cross-origin) | **closed** | `wrapWithChangeReport` compares before/after origins; cross-origin path emits URL-only report |
| D-09 (perf budget + partial flag) | **closed** | 500ms safety net via `Promise.race`; `partial:true` on hit |
| D-10 (reuse don't reinvent) | inherited from Plan 01 | dispatcher wraps but does not re-implement; calls Plan 01 builder |

## Acceptance criteria closure

| ID | Status | Evidence |
|---|---|---|
| CHANGE-01 | **closed** (Plan 02) | `tests/change-report-dispatcher.test.js`: dialog-open mutation produces `dialogs_opened` with selector + text |
| CHANGE-02 | inherited from Plan 01 | `tests/change-report-builder.test.js` covers `inputs_changed.email = {before, after}` |
| CHANGE-03 | **closed** (Plan 02) | `tests/change-report-read-tools-excluded.test.js`: read_page / get_text / get_dom_snapshot / list_tabs / hover / scroll all return without `change_report` |
| CHANGE-04 | inherited from Plan 01 | `tests/change-report-size-cap.test.js`: 50/30/40 noisy fixture truncates to 5/5/8 with `truncated:true` and JSON < 2500 bytes |
| CHANGE-05 | **closed** (Plan 02) | `tests/change-report-toggle.test.js`: `fsbChangeReportsEnabled=false` suppresses change_report on action tools |

## Atomic commits (Refinements branch)

```
39f8061 feat(245-02): annotate tool-definitions with _emitChangeReport flags per D-05/D-06
b21368c feat(245-02): wire change_report harvest into mcp-tool-dispatcher with global toggle and 500ms safety net
ecd4846 feat(245-02): add Action Change Reports settings card with checkbox toggle
96d0c16 docs(245-02): document change_report contract in MCP tool descriptions
ac7f2c9 test(245-02): add dispatcher / toggle / read-exclusion / settings-UI integration tests
```

5 atomic commits matching the plan's commit-message lines verbatim. Branch locked: no push, no PR.

## Deviations from plan

### Single-chokepoint location

The plan instructed wiring inside `extension/ws/mcp-tool-dispatcher.js#dispatchMcpToolRoute`. Architectural reality: that dispatcher only handles ~20 tools (navigation, observability, agent identity); the actual chokepoint for ALL action tools (click, type_text, drag_drop, etc.) is `mcp-bridge-client.js#_handleExecuteAction`. The `wrapWithChangeReport` helper itself lives in `mcp-tool-dispatcher.js` (per plan); it's invoked from `_handleExecuteAction` so every action tool flows through it.

This was an architectural clarification, not a divergence from intent. The plan's `<key_links>` block already names `mcp-tool-dispatcher.js` as the file owning the wrapper logic, which is honored.

### Extra type extension

Added `_forceForeground?: boolean` to `mcp/src/tools/schema-bridge.ts#ToolDefinition` alongside the new `_emitChangeReport?: boolean`. The Phase 243 BG-02 flag was already present on the JS objects but missing from the TypeScript interface; adding `_emitChangeReport` triggered the same gap for `_forceForeground`. Documented as Rule 2 (auto-add missing critical functionality -- type completeness).

## Self-Check: PASSED

- `extension/ai/tool-definitions.js`: 30 `_emitChangeReport: true` + 20 `_emitChangeReport: false` (verified by grep on the committed file)
- `extension/ws/mcp-tool-dispatcher.js`: `wrapWithChangeReport`, `_fsbHarvestStartInPage`, `_fsbHarvestStopInPage`, `_fsbWaitStableInPage` all present in the committed file (commit `b21368c` shows `+481` insertions)
- `extension/ws/mcp-bridge-client.js`: `_handleExecuteAction` calls `wrapWithChangeReport` (commit `b21368c`)
- `extension/background.js`: `importScripts('utils/action-verification.js')` present (commit `b21368c`)
- `extension/ui/control_panel.html`: `id="fsbChangeReportsEnabled"` present (commit `ecd4846`)
- `extension/ui/options.js`: 5 cap-toggle-pattern points all populated (verified by `tests/change-report-settings-ui.test.js`)
- `mcp/src/tools/manual.ts`: `CHANGE_REPORT_DESCRIPTION_SUFFIX` constant present, `registerManualTools` appends suffix conditionally (commit `96d0c16`)
- `mcp/src/tools/agents.ts`: `back` tool description ends with the change_report contract paragraph (commit `96d0c16`)
- `mcp/src/tools/autopilot.ts`: module-level JSDoc explains autopilot tools do NOT carry change_report (commit `96d0c16`)
- `mcp/src/tools/schema-bridge.ts`: `ToolDefinition._emitChangeReport?: boolean` typed (commit `96d0c16`)
- 4 new test files exist and pass standalone: 72/72 assertions
- All 5 commits present on `Refinements` branch (`git log --oneline -7` shows them)
- `cd mcp && npx tsc --noEmit` exits 0
- `node --check` passes on dispatcher, bridge-client, background, options.js, tool-definitions

## Phase 245 closure recommendation

Plan 245-01 + Plan 245-02 together close all five acceptance criteria:
- CHANGE-01: dialog detection (Plan 02 dispatcher test)
- CHANGE-02: inputs_changed delta (Plan 01 builder test)
- CHANGE-03: read tools excluded (Plan 02 dispatcher test + Plan 01 unit test)
- CHANGE-04: size cap truncation (Plan 01 size-cap test)
- CHANGE-05: global toggle suppresses (Plan 02 toggle test)

Phase 245 is ready for `/gsd-verify-phase 245` and `/gsd-uat-phase 245`. Manual UAT scope (out of autonomous execution): clicking a button that opens a modal in a real browser tab returns `change_report.dialogs_opened` populated; `read_page` response has no `change_report` field; toggling Advanced Settings off suppresses the field on the next action.

Pre-existing baseline: `tests/mcp-version-parity.test.js` short-circuits the `npm test` chain with 6 FAILs from the v0.9.60 milestone version bump (canonical hard-coded as 0.7.4 vs current 0.8.0). Documented in 245-01-SUMMARY.md; out of scope for this plan; needs a separate version-parity update plan.
