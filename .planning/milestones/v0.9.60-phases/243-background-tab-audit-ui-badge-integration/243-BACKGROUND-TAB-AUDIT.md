# Phase 243 Background-Tab Audit (BG-01 / BG-02 / BG-03)

**Generated:** 2026-05-05
**Plan:** 243-01
**Scope:** Foreground-steal audit across MCP / autopilot tool routes; setTimeout audit for chrome.alarms migration eligibility.

---

## Section 1: Foreground side-effect audit (BG-01)

Audited 25+ MCP/autopilot tools for `chrome.tabs.update({ active: true })` and `chrome.windows.update({ focused: true })` call sites. The grep regex used was `chrome\.tabs\.update\s*\([^)]*active\s*:\s*true` (and the analogous `chrome.windows.update` regex).

### Per-call-site classification

| # | File | Line | Context | MCP tool? | Verdict |
|---|------|------|---------|-----------|---------|
| 1 | `extension/ws/mcp-tool-dispatcher.js` | 376 (post-fix) | `handleSwitchTabRoute` body | YES — `switch_tab` | Gated behind `_forceForeground === true` from `_mcp_getToolByName('switch_tab')`. switch_tab opts in (D-01). |
| 2 | `extension/ws/mcp-tool-dispatcher.js` | 381 (post-fix) | `handleSwitchTabRoute` window-focus follow-up | YES — `switch_tab` | Same gate as #1. |
| 3 | `extension/ai/tool-executor.js` | 274 (post-fix) | `case 'switch_tab'` autopilot dispatch | YES — `switch_tab` (autopilot path) | Gated behind `_forceForeground === true` from `_te_getToolByName('switch_tab')`. |
| 4 | `extension/ai/tool-executor.js` | 279 (post-fix) | `case 'switch_tab'` window-focus follow-up | YES — `switch_tab` (autopilot path) | Same gate as #3. |
| 5 | `extension/background.js` | 2700 | `FAILURE_TYPES.BF_CACHE` recovery — wakes a BFCached tab | NO — recovery code, not a tool handler | Out of scope for BG-01; BFCache wake is an internal recovery primitive, not an MCP tool. Documented for awareness. |
| 6 | `extension/background.js` | 3587 | BFCache wake retry inside action verification | NO — verification code | Out of scope. |
| 7 | `extension/background.js` | 6380 | `decision.action === 'switch'` smart-tab routing inside `handleStartAutomation` | NO — autopilot startup, not a tool handler | Out of scope (autopilot's own session-start path). |
| 8 | `extension/background.js` | 7988 | `handleSwitchTab` request handler (popup/sidepanel UI message route) | NO — UI surface | Out of scope (legacy UI surface, not an MCP tool). |
| 9 | `extension/background.js` | 11467 | `handleSwitchToTab` (separate UI handler) | NO — UI surface | Out of scope. |
| 10 | `extension/utils/site-explorer.js` | 754 | `switchBackToCallerTab` for the Site Map Generator UI | NO — separate UI utility | Out of scope. |
| 11 | `extension/background.js` | 11471 | `chrome.windows.update({ focused: true })` after `handleSwitchToTab` | NO — UI surface | Out of scope. |

### Per-tool verdict block

- **switch_tab is the only tool with `_forceForeground: true` (D-01).** All other 49 tools default `_forceForeground: false`. Source of truth: `extension/ai/tool-definitions.js` (`grep -c "_forceForeground:" extension/ai/tool-definitions.js` → 50; `grep -c "_forceForeground:\s*true" extension/ai/tool-definitions.js` → 1).
- **open_tab is already background-safe.** It honors `params.active !== false` per `tool-executor.js`; the MCP-route open_tab does not call `chrome.tabs.update({ active: true })` after creation. `_forceForeground` stays `false`. The `params.active=true` per-call override remains the way callers request foreground for new tabs.
- **Out-of-scope sites (rows 5-11 above):** BFCache recovery, smart-tab routing inside `handleStartAutomation`, and legacy popup/sidepanel UI handlers. These are NOT MCP tool routes and do not impact background-agent foreground stability. They are documented here so future audits can re-classify if they ever migrate into a tool route.

### Tool-route invariants (post-fix)

- `mcp-tool-dispatcher.js`: every `chrome.tabs.update(... active: true)` site sits inside an `if (forceForeground)` block whose predicate is read from `_mcp_getToolByName('switch_tab')._forceForeground`.
- `tool-executor.js`: every `chrome.tabs.update(... active: true)` site sits inside an `if (forceForeground)` block whose predicate is read from `_te_getToolByName('switch_tab')._forceForeground`.
- `tests/foreground-audit.test.js` enforces both invariants via line-window grep (any unguarded `active:true` line that lacks a `_forceForeground` reference within the prior 30 lines fails the test).

### BG-01 verdict

**CLOSED.** 100% of the 25+ tools were audited. Only `switch_tab` opts into `_forceForeground: true`. Every chrome.tabs.update({active:true}) call site reachable from an MCP / autopilot tool route is gated behind the per-tool flag.

---

## Section 2: setTimeout audit (BG-03)

Audited setTimeout call sites in `extension/ws/mcp-tool-dispatcher.js`, `extension/ai/agent-loop.js`, `extension/background.js`, and `extension/content/lifecycle.js` via the regex `setTimeout\([^,]+,\s*[0-9]+`.

### Verdict (canonical phrase)

**ZERO setTimeout >= 30s exist across the audited files.** Per CONTEXT D-02 (chrome.alarms 30s floor in Chrome 120+), this phase performs no chrome.alarms migrations. The longest setTimeout in the audited surface is 10000ms (10s) — a navigation watchdog at `background.js:6404`.

### Full table

| File | Line | Delay | Purpose | Band | Phase 244 follow-up? |
|------|------|-------|---------|------|----------------------|
| `extension/ws/mcp-tool-dispatcher.js` | 547 | `innerTimeoutMs` (>= 2500ms) | `pageshow` injected listener inner timeout (Phase 242 `back` settle) | 1-30s | yes |
| `extension/ws/mcp-tool-dispatcher.js` | 570 | `timeoutMs` (default 2000ms) | `back` outer hard cap | 1-30s | yes |
| `extension/ai/agent-loop.js` | 1357 | param `ms` | `sleep(ms)` helper (call sites pass small values) | varies (leaf helper) | no (leaf primitive) |
| `extension/ai/agent-loop.js` | 1826 | 100ms | Next iteration scheduling | <1s | no |
| `extension/ai/agent-loop.js` | 2421 | 100ms | Next iteration scheduling | <1s | no |
| `extension/ai/agent-loop.js` | 2493 | 5000ms | Rate-limit (HTTP 429) retry | 1-30s | yes |
| `extension/ai/agent-loop.js` | 2503 | 2000ms | Network error retry | 1-30s | yes |
| `extension/background.js` | 1658 | 1000ms | Health-check timeout | 1s boundary | yes |
| `extension/background.js` | 1710 | 100ms | Generic wait | <1s | no |
| `extension/background.js` | 1782 | 5000ms | Race deadline | 1-30s | yes |
| `extension/background.js` | 2786 | 1000ms | "Wait 1 second" | 1s boundary | yes |
| `extension/background.js` | 2842 | 500ms | Generic wait | <1s | no |
| `extension/background.js` | 3047 | 1500ms | Generic wait | 1-30s | yes |
| `extension/background.js` | 3137 | exponential (1s × 2^attempt) | Retry backoff (peak in 1-30s band) | 1-30s peak | yes |
| `extension/background.js` | 3325 | 200ms | Generic wait | <1s | no |
| `extension/background.js` | 6404 | **10000ms** | Navigation watchdog (LONGEST in repo) | 1-30s | yes |
| `extension/background.js` | 7221 | 200ms | Generic wait | <1s | no |
| `extension/background.js` | 7255 | 100ms | Generic wait | <1s | no |
| `extension/background.js` | 7293 | 100ms | Generic wait | <1s | no |
| `extension/background.js` | 8494 | 500ms | Start-loop scheduler | <1s | no |
| `extension/background.js` | 8956 | 500ms | Start-loop scheduler | <1s | no |
| `extension/background.js` | 9045 | 500ms | Start-loop scheduler | <1s | no |
| `extension/background.js` | 9844 | 2000ms | Generic wait | 1-30s | yes |
| `extension/background.js` | 9861 | 500ms | Start-loop scheduler | <1s | no |
| `extension/background.js` | 9907 | 2000ms | Generic wait | 1-30s | yes |
| `extension/background.js` | 9923 | 500ms | Start-loop scheduler | <1s | no |
| `extension/background.js` | 11605 | 200ms | Generic wait | <1s | no |
| `extension/background.js` | 11628 | 200ms | Generic wait | <1s | no |
| `extension/background.js` | 12352 | 200ms | Generic wait | <1s | no |
| `extension/background.js` | 12361 | 200ms | Generic wait | <1s | no |
| `extension/content/lifecycle.js` | 314 | 200ms | Generic wait | <1s | no |
| `extension/content/lifecycle.js` | 395 | variable | Significant-change debouncer | typically <1s | no |
| `extension/content/lifecycle.js` | 443 | 100ms | Observer start retry | <1s | no |
| `extension/content/lifecycle.js` | 580 | small | Generic wait | <1s | no |
| `extension/content/lifecycle.js` | 682 | 50ms | Generic wait | <1s | no |
| `extension/content/lifecycle.js` | 692 | exponential (100ms × 2^attempt) | Retry backoff (peak <1s) | <1s peak | no |

### Migration verdict per BG-03 + CONTEXT D-02

ZERO waits >= 30s exist anywhere in the audited surface. Per D-02, only waits >= 30s migrate to `chrome.alarms` in this phase. Therefore no `chrome.alarms` migrations occur in Phase 243.

The 1-30s band (12 entries; tracked verbatim in Section 3) is documented as Phase 244 follow-up work. setTimeout in this band is acceptable in foreground but is throttled (non-fatal) when the service worker is backgrounded. Phase 244 hardening will revisit if real-world testing surfaces issues.

### BG-03 verdict

**CLOSED.** Audit is exhaustive across the four files. No migrations needed this phase. The 12 1-30s entries are explicitly handed off to Phase 244.

---

## Section 3: Phase 244 follow-up list

The 12 entries in the 1-30s setTimeout band, listed by file:line + delay + brief reason. Phase 244 hardening should re-examine each in light of MV3 background-throttle behavior:

1. `extension/ws/mcp-tool-dispatcher.js:547` (>= 2500ms) — Phase 242 `back` pageshow inner timeout. Phase 244 follow-up: consider chrome.alarms only if real-world testing shows SW eviction during back-settle.
2. `extension/ws/mcp-tool-dispatcher.js:570` (2000ms default) — `back` outer hard cap. Phase 244 follow-up: same as #1.
3. `extension/ai/agent-loop.js:2493` (5000ms) — HTTP 429 rate-limit retry. Phase 244 follow-up: throttling acceptable; chrome.alarms only if backgrounded retries observed missing.
4. `extension/ai/agent-loop.js:2503` (2000ms) — Network error retry. Phase 244 follow-up: same as #3.
5. `extension/background.js:1658` (1000ms) — Health-check timeout. Phase 244 follow-up: 1s boundary; convert to deterministic event if SW eviction proves problematic.
6. `extension/background.js:1782` (5000ms) — Race deadline. Phase 244 follow-up: candidate for chrome.alarms only if races outlive the SW.
7. `extension/background.js:2786` (1000ms) — "Wait 1 second" pause. Phase 244 follow-up: replace with event-driven wait if practical.
8. `extension/background.js:3047` (1500ms) — Generic wait. Phase 244 follow-up: low priority.
9. `extension/background.js:3137` (exponential 1s × 2^attempt) — Retry backoff peak in band. Phase 244 follow-up: cap with chrome.alarms only on highest-attempt branch.
10. `extension/background.js:6404` (10000ms) — **Navigation watchdog (LONGEST in repo).** Phase 244 follow-up: highest-priority candidate; closest to the 30s floor and most likely to miss SW eviction.
11. `extension/background.js:9844` (2000ms) — Generic wait. Phase 244 follow-up: low priority.
12. `extension/background.js:9907` (2000ms) — Generic wait. Phase 244 follow-up: low priority.

These entries are tagged **Phase 244 follow-up** (canonical phrase) for tooling that scans for this audit doc.

---

## Section 4: Verdict

- **BG-01 closed:** 100% of the 25+ tools audited; only `switch_tab` opts into `_forceForeground`. All chrome.tabs.update({active:true}) sites in MCP / autopilot tool routes are gated. Out-of-scope sites (BFCache recovery, smart-tab routing, legacy popup/sidepanel UI handlers) are documented for awareness.
- **BG-02 closed:** per-tool flag wired in `tool-definitions.js` (50 occurrences; switch_tab=true; 49 false). Both `mcp-tool-dispatcher.js` `handleSwitchTabRoute` and `tool-executor.js` `case 'switch_tab'` honor the flag.
- **BG-03 closed:** ZERO setTimeout >= 30s; no chrome.alarms migrations needed this phase. The 12 1-30s entries are tracked as Phase 244 follow-ups (Section 3).

---

*End of Phase 243 background-tab audit.*
