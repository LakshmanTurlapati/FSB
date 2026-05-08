# Phase 243: Background-Tab Audit + UI/Badge Integration - Research

**Researched:** 2026-05-05
**Domain:** Chrome MV3 background-tab execution audit + multi-agent UI/badge integration
**Confidence:** HIGH (codebase audits are direct file reads; verified against the dispatcher, registry, badge renderer, and Phase 241 cap UI)

## Summary

Phase 243 is a low-risk audit + UI polish phase landing on top of the structural work already completed in Phases 237-242. The dispatch chokepoint, the registry surface, the cap input, and the trusted-client badge renderer all exist and are stable; this phase wires them together and removes the few remaining `chrome.tabs.update({active:true})` foreground-stealing call sites in MCP code paths.

The codebase audit confirms:

1. **Foreground-steal sites are concentrated.** Across the dispatcher, agent-loop, background.js, and tool-executor, there are exactly 8 `chrome.tabs.update({active:true})` call sites and 3 `chrome.windows.update({focused:true})` call sites. Of those, only the `switch_tab` MCP tool path (`mcp-tool-dispatcher.js:890,895` and `tool-executor.js:264,269`) is reachable via an MCP tool handler today. The remaining 6 live in BFCache recovery / smart-navigation / popup-tab-switch paths that are NOT MCP tool handlers and do not steal focus from another agent's tab.
2. **No setTimeout calls ≥ 30s exist** in tool implementations across `mcp-tool-dispatcher.js`, `agent-loop.js`, `background.js`, or `content/lifecycle.js`. The longest is 10s (a navigation watchdog at `background.js:6404`). Per CONTEXT D-02, this phase migrates only ≥ 30s timeouts to `chrome.alarms` — so the audit produces a list with **zero** migrations and **several entries flagged for Phase 244** if real-world testing reveals issues.
3. **`webNavigation.onCommitted` already has one extension-wide listener** at `background.js:2464`. It already inspects `details.transitionType` and runs only on the main frame. The new BG-04 listener can either extend this existing one or live alongside it — both are viable.
4. **The trusted-client badge renderer is at `content/visual-feedback.js:697-702`.** It reads `overlayState.clientLabel` and writes `clientBadgeEl.textContent = clientLabel`. The agent-id suffix is added at the producer (`overlay-state.js:331-353` `buildOverlayState`) by either appending to `clientLabel` upstream or by adding an `agentIdShort` overlay-state field and rendering `clientLabel + ' / ' + agentIdShort` in the badge.
5. **The cap input already exists** at `control_panel.html:418-435` with `min=1 max=64 step=1 value=8`, a setting-hint div, a reset button, and a `setting-value-display` span. This phase adds a current-active counter element and an inline validation message; the helper text is already partially present (line 432) and only needs trade-off-language refinement.

**Primary recommendation:** Execute the phase as 3-4 narrow plans: (1) audit doc + force_foreground flag wiring + per-tool `force_foreground:true` annotations on `switch_tab` and `open_tab`; (2) BG-04 webNavigation pause-signal listener; (3) badge agentIdShort suffix at overlay-state.js + visual-feedback.js + dashboard mirror; (4) UI polish — current-active counter and inline validation in `options.js`. All four can ship in parallel; only the BG-04 + audit pair share a file.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Background-tab audit (BG-01, BG-02)**

- **D-01 force_foreground flag in tool-definitions.cjs.** Per-tool boolean, default false. Tools that legitimately need focus (e.g., file pickers, OAuth windows) opt in. The audit pass identifies all chrome.tabs.update({active:true}) call sites and either:
  - removes the call (default, most tools should NOT need focus)
  - moves it behind `if (toolDef.force_foreground)` — the per-tool definition is the single source of truth
- **D-02 setTimeout > 1s migrated to chrome.alarms.** chrome.alarms minimum is 30s in Chrome 120+ but THIS phase only migrates waits >= 30s to chrome.alarms; waits between 1s and 30s use setTimeout (acceptable in foreground; throttled in background but non-fatal — flag for Phase 244 hardening if real-world testing shows issues). Document the threshold rationale in the audit doc.
- **D-03 webNavigation.onCommitted user-initiated pause signal.** Listener detects user-initiated navigation (transition_type 'typed' / 'auto_bookmark' / 'reload' / 'link' triggered without programmatic navigate) on agent-owned tabs; emits `agent-tab-user-navigation` LOG-04 event AND posts a pause signal to the active automation session (existing pause/resume infra; verify in research).

**Badge integration (UI-01, UI-02)**

- **D-04 v0.9.36 overlay badge + dashboard mirror.** The existing trusted-client badge renderer (find via grep on 'badge' in extension/) gets a short agentId suffix: `<clientLabel> / <agentId.slice(0, 8)>` (e.g., "Claude / agent_a3f1"). Mirrors on the dashboard if the dashboard already shows the badge.
- **D-05 popup + sidepanel "owned by Agent X" read-only chip.** When the popup/sidepanel detects a tab is owned by a different agent (via existing tab metadata bridge), display a small chip "owned by Agent X" with no enforcement — informational only. Option 3 from architecture research per ROADMAP. The legacy:popup / legacy:sidepanel surfaces from Phase 240 do NOT show this chip when they own the tab themselves.

**Concurrency cap UI polish (UI-03)**

- **D-06 Helper text + current-active counter.** Phase 241 shipped the numeric input + reset; this phase adds:
  - Helper text below the input explaining the trade-off (lower = predictable resource use; higher = more parallel agents)
  - Current-active counter (e.g., "3 of 8 active") that updates in real-time via a lightweight listener on chrome.storage.session changes to the registry's active count
  - Inline validation message when the user enters out-of-range values (red text "Must be between 1 and 64")
- **D-07 No new chrome.storage.local key.** The existing `fsbAgentCap` from Phase 241 stays. This phase only adds UI polish around it.

### Claude's Discretion

- Where to render "owned by Agent X" chip — in existing popup/sidepanel header vs as a tab strip annotation
- Badge format options: "Claude / agent_a3f1" vs "Claude (a3f1)" — recommend the slash form for parity with Phase 238's agentIdShort pattern
- The audit doc artifact: 243-BACKGROUND-TAB-AUDIT.md (per-tool table: tool_name, file:line, current force_foreground need, after-fix state)
- Whether to add a per-tool annotation in tool-definitions.cjs JSDoc explaining force_foreground reason — recommend yes for the 1-2 tools that opt in

### Deferred Ideas (OUT OF SCOPE)

- Migrating setTimeout 1s-30s waits to chrome.alarms — out of scope (chrome.alarms 30s floor); Phase 244 hardening if real-world testing shows issues.
- Cross-agent badge "click to switch" — UI hint says read-only; defer to future user-demand phase.
- Badge color coding by agent — too far for v0.9.60 polish.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BG-01 | All existing 25+ MCP/autopilot tools audited for `chrome.tabs.update({active: true})` side effects | Section "Audit: chrome.tabs.update({active:true}) call sites" enumerates all 8 call sites with file:line + handler context |
| BG-02 | Per-tool `force_foreground` flag in `tool-definitions.cjs` (default false); only foreground-required tools opt in | Section "tool-definitions.js shape" identifies the existing `_route`/`_readOnly`/`_contentVerb`/`_cdpVerb` properties and proposes `_forceForeground` as the parallel naming convention |
| BG-03 | Long `setTimeout`-based waits >1s swapped to `chrome.alarms` for background-tab throttle resilience | Section "Audit: setTimeout > 1s call sites" shows zero ≥30s waits exist; per D-02, no migrations occur this phase |
| BG-04 | `webNavigation.onCommitted` detects user-initiated navigation on agent-owned tabs and emits a pause signal | Section "webNavigation.onCommitted listener" identifies the existing listener at `background.js:2464`, the transitionType discriminator, and the LOG-04 emission path via `rateLimitedWarn` |
| UI-01 | v0.9.36 trusted-client badge renderer extended to append short `agent_id` (e.g., "Claude / agent_a3f1") | Section "Badge renderer location" pinpoints `content/visual-feedback.js:697-702` and `utils/overlay-state.js:331-353` as the producer/consumer pair |
| UI-02 | Sidepanel and popup show read-only "owned by Agent X" badge on owned tabs | Section "Popup/sidepanel owner-chip integration" identifies `popup.js:248` and `sidepanel.js:423,1093,1208` as the active-tab-query points where chip data can be fetched |
| UI-03 | "Concurrency Cap" control rendered in `options.html` Advanced Settings panel with helper text + current-active counter | Section "Cap UI polish" shows the existing input at `control_panel.html:418-435` and the existing `options.js` event wiring at lines 297-313, 807-816 |

## Standard Stack

### Core (already shipped, used as-is)

| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| `agent-registry.js` | `extension/utils/agent-registry.js` | Source of truth for `(agent_id, tab_id, ownership_token)` and active count [VERIFIED: file read] | Phase 237/240/241 keystone; exposes `getOwner`, `findAgentByTabId`, `listAgents`, `getCap`, `getTabMetadata`, `formatAgentIdForDisplay` |
| `tool-definitions.js` | `extension/ai/tool-definitions.js` | Single canonical tool registry with `_route`/`_readOnly`/`_contentVerb`/`_cdpVerb` [VERIFIED: file read] | Already shared between autopilot (`tool-executor.js`) and MCP (`mcp-tool-dispatcher.js`); per-tool flag fits naturally |
| `mcp-tool-dispatcher.js` | `extension/ws/mcp-tool-dispatcher.js` | The chokepoint where MCP tool handlers live; the audit target [VERIFIED: file read] | 1751 LOC; 25+ handlers; only `handleSwitchTabRoute` calls `chrome.tabs.update({active:true})` directly |
| `visual-feedback.js` | `extension/content/visual-feedback.js` | The DOM badge renderer; reads `overlayState.clientLabel` [VERIFIED: file read] | The v0.9.36 trusted-client badge renders here at line 697-702 |
| `overlay-state.js` | `extension/utils/overlay-state.js` | Producer of `overlayState`; threads `clientLabel` from session into the overlay envelope [VERIFIED: file read] | Add `agentIdShort` here for the badge to consume |
| `control_panel.html` | `extension/ui/control_panel.html` | Hosts the Phase 241 cap input at line 418-435 [VERIFIED: file read] | Add counter span + inline-validation div alongside existing setting-hint |
| `options.js` | `extension/ui/options.js` | Wires the cap input (lines 297-313 input handler, 807-816 load, 881+ save) [VERIFIED: file read] | Extend with subscribe-to-storage-onChanged for live counter |

### Supporting (used in narrow contexts)

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `automation-logger.js` | `extension/utils/automation-logger.js` | Diagnostics ring buffer; LOG-04 events flow through `rateLimitedWarn` | BG-04 emission of `agent-tab-user-navigation` |
| `mcp-visual-session.js` | `extension/utils/mcp-visual-session.js` | Already threads `clientLabel` into session records (lines 91, 162, 251, 339, 368) | The badge already reads this; the agentId suffix is purely additive |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Add `_forceForeground` field on each tool def | Hardcode the allowlist in `mcp-tool-dispatcher.js` | Allowlist is invisible to autopilot; per-tool flag is the documented contract per D-01 |
| Concatenate `clientLabel + ' / ' + agentIdShort` upstream in `overlay-state.js` | Add a separate `agentIdShort` field and render `<span class="fsb-client-badge">${clientLabel} / ${agentIdShort}</span>` | Concatenating upstream is simpler but couples display formatting to the producer; separate field gives the dashboard mirror flexibility. **Recommend: separate field.** |
| Extend the existing `webNavigation.onCommitted` listener at `background.js:2464` | Add a second listener | Single listener is cheaper and the existing one already filters main-frame; **recommend: extend, not duplicate.** |

**Installation:** No new dependencies. Phase 243 is purely additive code.

**Version verification:** No external packages added; nothing to verify.

## Architecture Patterns

### Pattern 1: Per-tool `_forceForeground` flag (BG-02)

**What:** Add a fourth boolean discriminator alongside `_readOnly` on each entry in `TOOL_REGISTRY`.

**When to use:** Every tool that today calls `chrome.tabs.update({active:true})` and has a defensible "I genuinely need focus to work" justification.

**Audit-confirmed candidates:**
- `switch_tab` — semantic intent IS to bring a tab forward; per D-01 this is the canonical opt-in. **Set `_forceForeground: true`.**
- `open_tab` — current implementation honors `params?.active !== false` (tool-executor.js:251); the registered MCP route does NOT call `chrome.tabs.update({active:true})` after creation. **Already background-safe; default `_forceForeground: false`.**

**Example (tool-definitions.js style match):**

```javascript
// Source: extension/ai/tool-definitions.js:484-513 (pre-Phase-243)
{
  name: 'switch_tab',
  description: '...',
  inputSchema: { /* ... */ },
  _route: 'background',
  _readOnly: false,
  _contentVerb: null,
  _cdpVerb: null,
  // Phase 243 BG-02: switch_tab's semantic intent IS focus transfer.
  // Every other tool defaults to _forceForeground:false.
  _forceForeground: true
},
```

**Dispatcher gate (the conditional that consumes the flag):**

```javascript
// Source: pattern derived from mcp-tool-dispatcher.js:890-895 (current)
async function handleSwitchTabRoute({ params }) {
  // ... validation ...
  const toolDef = _mcp_getToolByName('switch_tab');
  let tab = await chrome.tabs.get(params.tabId);
  if (toolDef && toolDef._forceForeground === true) {
    tab = await chrome.tabs.update(params.tabId, { active: true });
    if (chrome.windows?.update && tab?.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  }
  // ... return ...
}
```

### Pattern 2: webNavigation.onCommitted user-navigation pause emission (BG-04)

**What:** Extend the existing main-frame listener with an agent-ownership branch.

**When to use:** Whenever a user types a URL, clicks a bookmark, hits reload, or follows a link in a tab that an agent currently owns.

**transitionType filter (per D-03):** `typed`, `auto_bookmark`, `reload`, `link`. Skip `auto_subframe`, `manual_subframe`, `generated`, `start_page`, `keyword`, `keyword_generated`, `form_submit`. (`form_submit` is excluded because agent code that submits forms triggers form_submit transitions.)

**Example:**

```javascript
// Source: pattern adjacent to background.js:2464 (existing listener)
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // Main frame only
  // ... existing state-clearing code (lines 2469-2487) ...

  // Phase 243 BG-04: user-initiated navigation on agent-owned tab → emit pause signal.
  const userInitiatedTransitions = new Set(['typed', 'auto_bookmark', 'reload', 'link']);
  if (userInitiatedTransitions.has(details.transitionType)) {
    const reg = globalThis.fsbAgentRegistryInstance;
    if (reg && typeof reg.findAgentByTabId === 'function') {
      const agentId = reg.findAgentByTabId(details.tabId);
      if (agentId && !agentId.startsWith('legacy:')) {
        // Note: legacy:* agents are popup/sidepanel/autopilot — they don't pause on user nav.
        try {
          if (typeof globalThis.rateLimitedWarn === 'function') {
            globalThis.rateLimitedWarn(
              'AGT',
              'agent-tab-user-navigation',
              'user-initiated navigation on agent-owned tab',
              {
                agentIdShort: typeof formatAgentIdForDisplay === 'function'
                  ? formatAgentIdForDisplay(agentId) : agentId,
                tabId: details.tabId,
                transitionType: details.transitionType,
                url: details.url
              }
            );
          }
        } catch (_e) { /* swallow */ }
        // Pause-signal emission: there is NO existing pause/resume infra in
        // agent-loop.js (verified — no occurrences of session.status === 'paused').
        // Per CONTEXT specifics line 67-68 ("the user-navigation pause signal is
        // an EMISSION — it doesn't actively pause"), this phase emits the LOG-04
        // event ONLY. The receiving automation loop adoption is deferred — the
        // signal is observable in diagnostics for downstream consumers (dashboard,
        // future loop adoption).
      }
    }
  }
});
```

### Pattern 3: agentIdShort threading from session → overlay-state → badge (UI-01)

**What:** Add a third field next to `clientLabel` in the overlayState envelope.

**Producer side** (`utils/overlay-state.js:331-353` `buildOverlayState`): pluck `agentIdShort` from `session.agentId` via `formatAgentIdForDisplay(session.agentId)` and include in the spread.

**Consumer side** (`content/visual-feedback.js:697-702`): read both fields and render `${clientLabel}${agentIdShort ? ' / ' + agentIdShort : ''}`.

**Example (consumer):**

```javascript
// Source: extension/content/visual-feedback.js:697-702 (modified)
var clientLabel = overlayState.clientLabel ? String(overlayState.clientLabel).trim() : '';
var agentIdShort = overlayState.agentIdShort ? String(overlayState.agentIdShort).trim() : '';
var clientBadgeEl = this.container.querySelector('.fsb-client-badge');

if (clientBadgeEl) {
  var combined = agentIdShort ? clientLabel + ' / ' + agentIdShort : clientLabel;
  clientBadgeEl.textContent = combined;
  clientBadgeEl.style.display = combined ? 'inline-flex' : 'none';
}
```

### Pattern 4: Owned-by chip in popup/sidepanel (UI-02)

**What:** Query the registry for the owner of the active tab; render a chip ONLY when the surface (legacy:popup or legacy:sidepanel) is NOT the owner.

**Bridge:** A new `getActiveTabOwner` action handled in `background.js` that returns `{ ownerAgentId, ownerAgentIdShort, ownerLabel }` from `fsbAgentRegistryInstance.getOwner(tabId)` + a label lookup.

**Render condition (read-only — no enforcement):**

```javascript
// Pseudocode for popup.js / sidepanel.js
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const owner = await chrome.runtime.sendMessage({ action: 'getActiveTabOwner', tabId: tab.id });
const mySurface = 'legacy:popup'; // or 'legacy:sidepanel'
if (owner && owner.ownerAgentId && owner.ownerAgentId !== mySurface) {
  // Render chip "owned by <ownerAgentIdShort>"
  document.getElementById('fsb-owner-chip').textContent =
    'owned by ' + owner.ownerAgentIdShort;
  document.getElementById('fsb-owner-chip').style.display = 'inline-flex';
}
```

### Pattern 5: Live current-active counter via storage subscription (UI-03)

**What:** Subscribe to `chrome.storage.session.onChanged` for the registry envelope key (the same key the registry persists to). When it fires, count the live agent records and update the counter span.

**Why storage.session, not local:** The registry persists agent records to `chrome.storage.session` under `fsbAgentRegistry` (per Phase 237 D-03). The cap value persists to `chrome.storage.local` under `fsbAgentCap`. The COUNTER displays the active count — that lives in session.

**Example:**

```javascript
// Source: pattern for options.js
function refreshActiveAgentCount() {
  chrome.storage.session.get('fsbAgentRegistry', (result) => {
    const env = result && result.fsbAgentRegistry;
    const records = env && env.records ? env.records : {};
    const activeCount = Object.keys(records).filter(id => !id.startsWith('legacy:')).length;
    const cap = parseInt(elements.fsbAgentCap?.value, 10) || 8;
    const counterEl = document.getElementById('fsbAgentCapCurrentActive');
    if (counterEl) counterEl.textContent = `${activeCount} of ${cap} active`;
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.fsbAgentRegistry) refreshActiveAgentCount();
  if (area === 'local' && changes.fsbAgentCap) refreshActiveAgentCount();
});
refreshActiveAgentCount(); // Initial load.
```

### Anti-Patterns to Avoid

- **Hand-rolling pause/resume in agent-loop.** No existing pause primitive exists; do NOT introduce one in this phase. BG-04 is an emission, not an actuation. Adding a `session.status = 'paused'` branch needs its own phase to design resume semantics, persistence, and UI affordance.
- **Concatenating display text in overlay-state.** Keep `clientLabel` and `agentIdShort` as separate fields in the overlayState envelope; the badge renderer concatenates. This preserves data shape for the dashboard mirror, log redaction, and any future split rendering.
- **Counting `legacy:*` agents in the active counter.** Legacy synthesized agents (popup/sidepanel/autopilot) live forever once any FSB UI surface opens. They MUST be filtered out of the user-facing counter — only `agent_<uuid>` records count. Use `!id.startsWith('legacy:')` as the filter (verified naming convention: `agent-registry.js:367-369`).
- **Forgetting `formatAgentIdForDisplay` is the canonical helper.** It returns 6 hex chars (e.g., `agent_a3f1ab`), not 4. CONTEXT D-04's example "agent_a3f1" is illustrative; the actual helper produces 6 hex chars (constant `FSB_AGENT_DISPLAY_HEX_LENGTH = 6` at `agent-registry.js:42`). Always call the helper, never slice locally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Short agent-id display | `agentId.slice(6, 10)` ad-hoc | `agentRegistry.formatAgentIdForDisplay(agentId)` | Single source of truth at `agent-registry.js:184`; comment block at line 180-183 explicitly says "UI / log call sites MUST use this helper" |
| Owner lookup for chip | Loop `listAgents()` + check tabIds | `agentRegistry.findAgentByTabId(tabId)` | Sync read of `_tabOwners` reverse map at `agent-registry.js:576-579`; O(1) |
| Pause/resume primitive | Introduce `session.status = 'paused'` | Emit LOG-04 only this phase | No existing infra; designing resume semantics is a separate phase |
| Per-tool focus exception list | Maintain a Set in dispatcher | `_forceForeground: true` on the tool def | Per D-01, the tool def is the SSOT |
| Active-agent counter | Poll registry every N seconds | `chrome.storage.onChanged` listener on `fsbAgentRegistry` | Phase 237 already write-throughs every mutation; the listener fires for free |

**Key insight:** Every primitive Phase 243 needs already exists in the codebase from Phases 237-241. The phase is plumbing-only.

## Audit: chrome.tabs.update({active:true}) call sites

**Audit method:** Grep for `chrome\.tabs\.update\s*\([^)]*active\s*:\s*true` across `extension/`. Each match is classified by whether it sits inside an MCP tool route handler.

| # | File | Line | Context | MCP tool? | Action |
|---|------|------|---------|-----------|--------|
| 1 | `extension/ws/mcp-tool-dispatcher.js` | 890 | `handleSwitchTabRoute` body | YES — `switch_tab` | Move behind `if (toolDef._forceForeground === true)`; set `_forceForeground:true` on `switch_tab` def |
| 2 | `extension/ws/mcp-tool-dispatcher.js` | 895 | `handleSwitchTabRoute` body, `chrome.windows.update({focused:true})` | YES — `switch_tab` | Same conditional as #1 |
| 3 | `extension/ai/tool-executor.js` | 264 | `case 'switch_tab'` in autopilot tool dispatch | YES — `switch_tab` (autopilot path) | Same: gate on `_forceForeground` from tool def |
| 4 | `extension/ai/tool-executor.js` | 269 | `case 'switch_tab'` window-focus follow-up | YES — `switch_tab` (autopilot path) | Same gate |
| 5 | `extension/background.js` | 2700 | `FAILURE_TYPES.BF_CACHE` recovery — wakes a BFCached tab | NO — recovery code, not a tool handler | Out of scope; documented for awareness |
| 6 | `extension/background.js` | 3587 | BFCache wake retry inside action verification | NO — verification code | Out of scope |
| 7 | `extension/background.js` | 6380 | `decision.action === 'switch'` smart-tab routing inside `handleStartAutomation` | NO — autopilot startup, not a tool handler | Out of scope (this is the autopilot's own session-start path) |
| 8 | `extension/background.js` | 7988 | `handleSwitchTab` request handler (popup/sidepanel UI message route) | NO — UI surface | Out of scope (legacy UI surface, not an MCP tool) |
| 9 | `extension/background.js` | 11467 | `handleSwitchToTab` (separate UI handler) | NO — UI surface | Out of scope |
| 10 | `extension/utils/site-explorer.js` | 754 | `switchBackToCallerTab` for the Site Map Generator UI | NO — separate UI utility | Out of scope |
| 11 | `extension/background.js` | 11471 | `chrome.windows.update({focused:true})` after `handleSwitchToTab` | NO — UI surface | Out of scope |

**Foreground-side-effect tools (the "1-2 that legitimately do" per CONTEXT specifics):**
- `switch_tab` — opt in (`_forceForeground: true`). The tool's stated purpose is to bring a tab forward.
- All other 50 tools default to `_forceForeground: false`. None have a defensible focus-required justification.

**Verification step for the plan:** After modifying `tool-definitions.js`, run `grep -n 'name:' extension/ai/tool-definitions.js | wc -l` (should still report 50) and `grep -n '_forceForeground:\s*true' extension/ai/tool-definitions.js | wc -l` (should report exactly 1, for `switch_tab`).

[VERIFIED: codebase grep + line-by-line read of each call site]

## Audit: setTimeout > 1s call sites

**Audit method:** Grep for `setTimeout` across the four files in scope, classify by delay.

### `extension/ws/mcp-tool-dispatcher.js`

| Line | Delay | Purpose | Classification |
|------|-------|---------|----------------|
| 547 | `innerTimeoutMs` (≥ 2500ms) | `pageshow` injected listener inner timeout (Phase 242 `back` settle) | 1-30s — **flag for Phase 244** |
| 570 | `timeoutMs` (default 2000ms) | `back` outer hard cap | 1-30s — **flag for Phase 244** |

### `extension/ai/agent-loop.js`

| Line | Delay | Purpose | Classification |
|------|-------|---------|----------------|
| 1357 | param `ms` | `sleep(ms)` helper (call sites pass small values) | varies — leaf helper, no migration |
| 1826 | 100ms | Next iteration scheduling | < 1s — no action |
| 2421 | 100ms | Next iteration scheduling | < 1s — no action |
| 2493 | 5000ms | Rate-limit (HTTP 429) retry | 1-30s — **flag for Phase 244** |
| 2503 | 2000ms | Network error retry | 1-30s — **flag for Phase 244** |

### `extension/background.js`

| Line | Delay | Purpose | Classification |
|------|-------|---------|----------------|
| 1658 | 1000ms | Health-check timeout | == 1s boundary — flag for Phase 244 |
| 1710 | 100ms | Generic wait | < 1s |
| 1782 | 5000ms | Race deadline | 1-30s — flag for Phase 244 |
| 2786 | 1000ms | "Wait 1 second" | == 1s — flag for Phase 244 |
| 2842 | 500ms | Generic wait | < 1s |
| 3047 | 1500ms | Generic wait | 1-30s — flag for Phase 244 |
| 3137 | exponential (1s × 2^attempt) | Retry backoff | 1-30s peak — flag for Phase 244 |
| 3325 | 200ms | Generic wait | < 1s |
| 6404 | **10000ms** | Navigation watchdog (LONGEST in repo) | 1-30s — **flag for Phase 244** |
| 7221 | 200ms | Generic wait | < 1s |
| 7255 | 100ms | Generic wait | < 1s |
| 7293 | 100ms | Generic wait | < 1s |
| 8494 | 500ms | Start-loop scheduler | < 1s |
| 8956 | 500ms | Start-loop scheduler | < 1s |
| 9045 | 500ms | Start-loop scheduler | < 1s |
| 9844 | 2000ms | Generic wait | 1-30s — flag for Phase 244 |
| 9861 | 500ms | Start-loop scheduler | < 1s |
| 9907 | 2000ms | Generic wait | 1-30s — flag for Phase 244 |
| 9923 | 500ms | Start-loop scheduler | < 1s |
| 11605 | 200ms | Generic wait | < 1s |
| 11628 | 200ms | Generic wait | < 1s |
| 12352 | 200ms | Generic wait | < 1s |
| 12361 | 200ms | Generic wait | < 1s |

### `extension/content/lifecycle.js`

| Line | Delay | Purpose | Classification |
|------|-------|---------|----------------|
| 314 | 200ms | Generic wait | < 1s |
| 395 | (variable) | Significant-change debouncer | typically < 1s |
| 443 | 100ms | Observer start retry | < 1s |
| 580 | (small) | Generic wait | < 1s |
| 682 | 50ms | Generic wait | < 1s |
| 692 | exponential (100ms × 2^attempt) | Retry backoff | < 1s peak |

### Migration verdict per BG-03 + CONTEXT D-02

**Zero waits ≥ 30s exist.** Per D-02, only ≥ 30s migrate to `chrome.alarms` in this phase. Therefore: **no `chrome.alarms` migrations occur in Phase 243.**

The audit doc artifact `243-BACKGROUND-TAB-AUDIT.md` (per CONTEXT discretion) will document the full table above with the explicit verdict and the Phase 244 follow-up list (the 12 entries flagged "1-30s — flag for Phase 244").

[VERIFIED: codebase grep with delay-extraction regex `setTimeout\([^,]+,\s*[0-9]+`]

## webNavigation.onCommitted listener

**Existing listener:** `extension/background.js:2464-2491` (verified). Already filters `frameId !== 0` and accesses `details.transitionType`. Calls `armMcpBridge` and clears content-script port state.

**Recommended approach:** Extend the existing listener with the BG-04 branch (don't add a second listener — saves one event-loop microtask per main-frame navigation).

**transitionType discriminator (per D-03):**

| Value | User-initiated? | Include in BG-04 filter? |
|-------|-----------------|-------------------------|
| `link` | YES (user clicked a link) | YES |
| `typed` | YES (user typed in address bar) | YES |
| `auto_bookmark` | YES (user clicked a bookmark or back/forward) | YES |
| `reload` | YES (user reloaded) | YES |
| `auto_subframe` | NO (programmatic frame navigation) | NO |
| `manual_subframe` | NO (rare, frame-only) | NO |
| `generated` | NO (omnibox suggestion auto-fill) | NO |
| `start_page` | NO (browser startup) | NO |
| `keyword` | NO (omnibox keyword search) | NO |
| `keyword_generated` | NO (auto-completed keyword) | NO |
| `form_submit` | NO (excluded — agent-driven form submits trigger this) | NO |

**Note:** Phase 242 `back` calls `chrome.tabs.goBack` which produces `transitionType: 'auto_bookmark'`. This is a known false-positive: agent-initiated `back` will trigger the BG-04 emission. Mitigation in plan: gate the emission on a per-tab "agent-initiated navigation" timestamp set by `handleNavigateRoute` / `handleBackRoute` immediately before calling chrome.tabs APIs. If the navigation commits within ~500ms of an agent action, suppress the pause emission. **This is a plan-time refinement; the research records the false-positive risk.**

[VERIFIED: file read; CITED: Chrome `webNavigation.TransitionType` enum at developer.chrome.com/docs/extensions/reference/api/webNavigation]

## Badge renderer location

**Producer:** `extension/utils/overlay-state.js:331-353` `buildOverlayState(statusData, session)` — extracts `statusData.clientLabel` and spreads into envelope. Add `agentIdShort` extraction here.

**Consumer:** `extension/content/visual-feedback.js:697-702` — reads `overlayState.clientLabel`, writes `clientBadgeEl.textContent`. Modify to render `clientLabel + ' / ' + agentIdShort` when both present.

**CSS:** `extension/content/visual-feedback.js:444-450` `.fsb-client-badge` style block (inline-flex, padded). No CSS changes needed — text just gets longer.

**Dashboard mirror:** Search for the dashboard's badge equivalent. The dashboard is hosted in a separate code path (control_panel.html or external dashboard). Check whether the dashboard already shows the badge — if yes, mirror the same text. If no dashboard badge exists today, the "mirror" is a no-op for this phase. (Recommendation: confirm dashboard badge presence during plan review.)

[VERIFIED: file read of visual-feedback.js + overlay-state.js]

## Popup/sidepanel owner-chip integration

**Active-tab query points (where chip data is fetched):**

| File | Line | Context |
|------|------|---------|
| `extension/ui/popup.js` | 248 | `chrome.tabs.query({active: true, currentWindow: true})` before sending `startAutomation` |
| `extension/ui/sidepanel.js` | 423 | Active-tab fetch in chat send handler |
| `extension/ui/sidepanel.js` | 1093 | Active-tab fetch (secondary path) |
| `extension/ui/sidepanel.js` | 1208 | Active-tab fetch (tertiary path) |

**Recommended chip render location:**

For both popup and sidepanel, the chip lives in the existing header — adjacent to the status indicator. Both surfaces already display tab/state info; the chip is one extra DOM element.

**New bridge action (`getActiveTabOwner`):** Add a handler in `background.js` that takes `{tabId}`, calls `fsbAgentRegistryInstance.getOwner(tabId)`, looks up the owner's display label (via `formatAgentIdForDisplay` or a richer `listAgents()` lookup if a friendly name exists), and returns `{ownerAgentId, ownerAgentIdShort}`.

**Render condition (per D-05):**

```
const mySurface = 'legacy:popup'; // or 'legacy:sidepanel'
if (owner.ownerAgentId && owner.ownerAgentId !== mySurface) {
  // Show chip "owned by <ownerAgentIdShort>"
}
```

The legacy surface name is established in Phase 240 D-02 (`agent-registry.js:367-369`).

[VERIFIED: file reads; cross-referenced legacy surface naming]

## Cap UI polish (UI-03)

**Existing input** (`extension/ui/control_panel.html:418-435`):
- `<span id="fsbAgentCapDisplay">8</span>` — value display
- `<input id="fsbAgentCap" min="1" max="64" step="1" value="8">` — numeric input
- `<button id="fsbAgentCapReset">` — reset to default
- `<div class="setting-hint">` — already has trade-off-adjacent text (line 432). Refine to mention "lower = predictable resource use; higher = more parallel agents."

**New elements to add:**

```html
<!-- Phase 243 UI-03 additions, alongside existing setting-hint at line 431-433 -->
<div class="setting-hint" id="fsbAgentCapValidation"
     style="color: #ff6b6b; display: none; margin-top: 4px;">
  Must be between 1 and 64
</div>
<div class="setting-hint" id="fsbAgentCapCurrentActive" style="margin-top: 4px;">
  0 of 8 active
</div>
```

**options.js wiring:**
- Cache the new elements in `cacheElements()` (line 153-155 area).
- Add a `chrome.storage.onChanged` listener for `fsbAgentRegistry` (session) and `fsbAgentCap` (local) that recomputes the counter.
- On the existing `input` event handler at line 297-308, show/hide the validation message based on `raw < 1 || raw > 64`.
- Call `refreshActiveAgentCount()` once at `loadSettings` end (line 807-816 area).

[VERIFIED: file reads of both control_panel.html and options.js]

## Common Pitfalls

### Pitfall 1: `legacy:*` agents inflate the active counter

**What goes wrong:** Popup/sidepanel/autopilot synthesize `legacy:popup`, `legacy:sidepanel`, `legacy:autopilot` records that live forever once any FSB UI surface opens. Counting them shows "5 of 8 active" when zero MCP agents are running.

**Why it happens:** Phase 240 D-02 needed stable IDs for cleanup-on-reload; legacy surfaces never `releaseAgent` themselves.

**How to avoid:** Filter `Object.keys(records).filter(id => !id.startsWith('legacy:'))` in the counter computation. Verified naming at `agent-registry.js:367-369`.

**Warning signs:** Counter shows ≥ 1 even when no MCP server is connected; "active" count exceeds visible MCP sessions.

### Pitfall 2: BG-04 false-positive on agent `back` / `navigate`

**What goes wrong:** Phase 242 `back` and any `navigate` call commit with `transitionType` matching the user-initiated set (`link` for navigate, `auto_bookmark` for back). The BG-04 listener treats them as user-driven and emits a spurious pause signal.

**Why it happens:** webNavigation can't distinguish programmatic from user-driven navigation by transitionType alone for these values.

**How to avoid:** Stamp a `lastAgentNavigationAt` timestamp on the registry's per-tab metadata at every `handleNavigateRoute` / `handleBackRoute` invocation, then suppress BG-04 emissions within 500ms of that stamp. (Plan-time decision: where to store the stamp — propose extending `_tabMetadata` shape.)

**Warning signs:** LOG-04 ring buffer flooded with `agent-tab-user-navigation` events during a normal autopilot run.

### Pitfall 3: Forgetting `details.frameId !== 0` filter on the new BG-04 branch

**What goes wrong:** Subframe navigations fire the listener; agent-owned tabs get spurious pause signals every time an iframe inside them changes.

**Why it happens:** webNavigation fires for every frame.

**How to avoid:** The existing listener already has the `if (details.frameId !== 0) return;` guard at line 2465. The BG-04 branch must live INSIDE that early-return block, not above it.

**Warning signs:** Pause signals fire on iframe-heavy sites (Google search results, embedded YouTube).

### Pitfall 4: Counter listener thrashes on every registry write

**What goes wrong:** The registry persists to `fsbAgentRegistry` on every `bindTab`, `releaseTab`, `stampConnectionId`, etc. With 8 agents each binding 1-3 tabs, that's 8-24 storage writes during ramp-up. The counter listener fires for each.

**Why it happens:** `chrome.storage.onChanged` is fine-grained.

**How to avoid:** Debounce the counter refresh by 100ms. Trivial; just wrap `refreshActiveAgentCount` in a debounce helper.

**Warning signs:** Options page jank when many agents claim simultaneously.

### Pitfall 5: Chip stale-data flicker

**What goes wrong:** Active tab changes (user switches tab) — popup/sidepanel still display the old owner chip until the next event triggers a refetch.

**Why it happens:** The chip is fetched once per active-tab-query; tab activation events aren't subscribed.

**How to avoid:** Subscribe `chrome.tabs.onActivated` in popup.js / sidepanel.js and refetch the owner chip on each activation. (Out of scope for the chip's first version — recommend documenting as a Phase 244 follow-up if user reports staleness.)

## Code Examples

### Example 1: Per-tool `_forceForeground` consumption in dispatcher

```javascript
// Source: pattern derived from extension/ws/mcp-tool-dispatcher.js:878-902
async function handleSwitchTabRoute({ params }) {
  const { agentId } = params || {};
  void agentId; // Phase 240 already validates upstream
  if (!Number.isFinite(params?.tabId)) {
    return createMcpInvalidParamsError('switch_tab', 'switch_tab requires numeric tabId');
  }

  try {
    getChromeTabsApi();
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const previousTabId = currentTab ? currentTab.id : null;

    // Phase 243 BG-02: read the per-tool flag from the registry.
    const toolDef = _mcp_getToolByName('switch_tab');
    const forceForeground = !!(toolDef && toolDef._forceForeground);

    let tab = await chrome.tabs.get(params.tabId);
    if (forceForeground) {
      tab = await chrome.tabs.update(params.tabId, { active: true });
      if (typeof chrome !== 'undefined' && chrome.windows?.update && tab?.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    }

    return sanitizeSingleTab('switch_tab', tab, { tabId: params.tabId, previousTabId });
  } catch (error) {
    return createMcpRouteError('switch_tab', 'browser', MCP_ROUTE_RECOVERY_HINT, {
      error: error.message || String(error),
      tabId: params.tabId
    });
  }
}
```

### Example 2: BG-04 pause-signal emission

```javascript
// Source: extension to extension/background.js:2464-2491 (existing listener body)
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;

  armMcpBridge('webNavigation.onCommitted');
  const tabId = details.tabId;

  contentScriptReadyStatus.delete(tabId);
  contentScriptHealth.delete(tabId);

  const portInfo = contentScriptPorts.get(tabId);
  if (portInfo) {
    try { portInfo.port.disconnect(); } catch (e) {}
    contentScriptPorts.delete(tabId);
  }

  // Phase 243 BG-04: agent-owned-tab user-navigation pause signal.
  const USER_INITIATED = new Set(['typed', 'auto_bookmark', 'reload', 'link']);
  if (USER_INITIATED.has(details.transitionType)) {
    const reg = globalThis.fsbAgentRegistryInstance;
    const ownerAgentId = reg && typeof reg.findAgentByTabId === 'function'
      ? reg.findAgentByTabId(tabId)
      : null;
    if (ownerAgentId && !ownerAgentId.startsWith('legacy:')) {
      // Pitfall 2: suppress within 500ms of the last agent-initiated nav on this tab.
      const meta = reg.getTabMetadata ? reg.getTabMetadata(tabId) : null;
      const lastAgentNav = (meta && meta.lastAgentNavigationAt) || 0;
      if (Date.now() - lastAgentNav > 500) {
        try {
          if (typeof globalThis.rateLimitedWarn === 'function') {
            globalThis.rateLimitedWarn('AGT', 'agent-tab-user-navigation',
              'user-initiated navigation on agent-owned tab',
              {
                agentIdShort: typeof formatAgentIdForDisplay === 'function'
                  ? formatAgentIdForDisplay(ownerAgentId) : ownerAgentId,
                tabId,
                transitionType: details.transitionType,
                url: details.url
              });
          }
        } catch (_e) { /* swallow */ }
      }
    }
  }

  automationLogger.logComm(null, 'nav', 'state_cleared', true, {
    tabId, transitionType: details.transitionType
  });
});
```

### Example 3: Owned-by-chip bridge handler

```javascript
// Source: pattern adjacent to existing message routes in background.js
case 'getActiveTabOwner': {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.getOwner !== 'function') {
    sendResponse({ ownerAgentId: null });
    return true;
  }
  const ownerAgentId = reg.getOwner(request.tabId);
  if (!ownerAgentId) {
    sendResponse({ ownerAgentId: null });
    return true;
  }
  sendResponse({
    ownerAgentId,
    ownerAgentIdShort: ownerAgentId.startsWith('legacy:')
      ? ownerAgentId
      : (typeof formatAgentIdForDisplay === 'function'
          ? formatAgentIdForDisplay(ownerAgentId) : ownerAgentId)
  });
  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tools call `chrome.tabs.update({active:true})` directly | Per-tool `_forceForeground` flag in tool registry | Phase 243 (this) | Background-tab agents no longer fight for focus |
| `setTimeout` for all delays | `chrome.alarms` for ≥ 30s waits, `setTimeout` otherwise | Phase 243 (audit only — no migrations needed because no ≥30s waits exist) | Future-proofs against MV3 SW-eviction throttling |
| Trusted-client badge shows only `clientLabel` | Badge shows `clientLabel / agentIdShort` | Phase 243 (this) | User can identify which of N concurrent agents owns the overlay |
| Cap input shows raw number | Cap input shows raw number + "X of Y active" counter + inline validation | Phase 243 (this) | User can tune cap without spelunking diagnostics |
| Popup/sidepanel show no ownership info | Popup/sidepanel show "owned by Agent X" chip on cross-agent tabs | Phase 243 (this) | User can see when a tab is being driven by an MCP agent vs the legacy UI |

**Deprecated/outdated:**
- Hand-rolled focus exception lists in dispatcher — use the per-tool flag instead.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (verified by Phase 237/240/241 plans using `tests/agent-cap-ui.test.js`, `tests/agent-no-idle.test.js`, etc.) |
| Config file | `package.json` `scripts.test` and per-test imports (no central config) |
| Quick run command | `node --test tests/<specific-file>.test.js` |
| Full suite command | `node --test tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BG-01 | All 8 enumerated `chrome.tabs.update({active:true})` sites are documented in audit doc and 2 of 4 (the `switch_tab` MCP route) are gated by `_forceForeground` | unit | `node --test tests/tool-force-foreground.test.js` | ❌ Wave 0 |
| BG-02 | `tool-definitions.js` has `_forceForeground` field on every tool def; only `switch_tab` is `true`; default false | unit | `node --test tests/tool-definitions-shape.test.js` | ❌ Wave 0 (or extend existing tool-definitions tests) |
| BG-02 | `handleSwitchTabRoute` reads the flag and skips `chrome.tabs.update` when false | unit (with chrome stub) | `node --test tests/dispatcher-switch-tab-bg.test.js` | ❌ Wave 0 |
| BG-03 | No ≥30s setTimeouts exist; audit doc records all 1-30s entries with Phase 244 flag | doc-as-test | `node --test tests/setTimeout-audit-doc.test.js` (greps the audit doc for the no-≥30s claim) | ❌ Wave 0 |
| BG-04 | webNavigation.onCommitted listener emits `agent-tab-user-navigation` LOG-04 with correct context fields when transitionType is user-initiated AND tab is agent-owned (non-legacy) AND no recent agent nav | unit (with webNavigation + registry stubs) | `node --test tests/webnav-pause-signal.test.js` | ❌ Wave 0 |
| BG-04 | Listener does NOT emit for `legacy:*` owners | unit | (same file) | ❌ Wave 0 |
| BG-04 | Listener does NOT emit within 500ms of agent-initiated navigation | unit | (same file) | ❌ Wave 0 |
| UI-01 | overlay-state.js threads `agentIdShort` from `session.agentId` via `formatAgentIdForDisplay` | unit | `node --test tests/overlay-state-agent-id.test.js` | ❌ Wave 0 |
| UI-01 | visual-feedback.js renders `clientLabel + ' / ' + agentIdShort` when both present | unit (DOM stub) | `node --test tests/visual-feedback-badge.test.js` | ❌ Wave 0 (or extend existing badge test if any) |
| UI-02 | `getActiveTabOwner` bridge returns ownerAgentId/Short for active tab | unit | `node --test tests/owner-chip-bridge.test.js` | ❌ Wave 0 |
| UI-02 | popup chip renders only when surface !== owner | unit (DOM stub) | (same file) | ❌ Wave 0 |
| UI-03 | options.js cap input shows inline validation when value out of range | unit (DOM stub) | `node --test tests/agent-cap-ui-counter.test.js` (extend existing `tests/agent-cap-ui.test.js`) | extend existing |
| UI-03 | Active counter computes from `fsbAgentRegistry.records`, filters `legacy:*`, displays "N of M active" | unit | (same file) | extend existing |
| UI-03 | Counter refreshes via `chrome.storage.onChanged` | unit | (same file) | extend existing |

### Sampling Rate
- **Per task commit:** `node --test tests/<file-touched-by-task>.test.js`
- **Per wave merge:** `node --test tests/`
- **Phase gate:** Full `node --test tests/` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/tool-force-foreground.test.js` — covers BG-01, BG-02 (consumer-side)
- [ ] `tests/tool-definitions-shape.test.js` — covers BG-02 (registry-side)
- [ ] `tests/dispatcher-switch-tab-bg.test.js` — covers BG-02 dispatcher gate
- [ ] `tests/setTimeout-audit-doc.test.js` — covers BG-03 doc-as-test invariant
- [ ] `tests/webnav-pause-signal.test.js` — covers BG-04 (3 sub-tests)
- [ ] `tests/overlay-state-agent-id.test.js` — covers UI-01 producer
- [ ] `tests/visual-feedback-badge.test.js` — covers UI-01 consumer (or extend existing if present)
- [ ] `tests/owner-chip-bridge.test.js` — covers UI-02
- [ ] `tests/agent-cap-ui-counter.test.js` — extends existing `tests/agent-cap-ui.test.js` for UI-03
- [ ] No new framework or fixtures needed; chrome stubs already exist in Phase 237/241 tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (no auth surface in this phase — registry already enforces) |
| V3 Session Management | no | (Phase 240 dispatch gate already enforces) |
| V4 Access Control | yes | Phase 243 must NOT introduce a code path that bypasses Phase 240's `agentRegistry.isOwnedBy(tabId, agentId, ownershipToken)` gate. The new `getActiveTabOwner` bridge action is read-only and exposes only the short-id; it does not bypass enforcement. |
| V5 Input Validation | yes | The cap-input inline validation already clamps to [1, 64]; the new validation message is purely display. The `getActiveTabOwner` request takes a `tabId` param — must be validated as a finite integer before calling `getOwner(tabId)`. |
| V6 Cryptography | no | No crypto in this phase. |

### Known Threat Patterns for Chrome MV3 Multi-Agent Extension

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via owner-chip render | Elevation | The chip is read-only (D-05). It does NOT add an action button. Plan must preserve this — no "click chip to switch to that agent" interactions. |
| Information disclosure via badge / chip | Information Disclosure | Use `formatAgentIdForDisplay` (6 hex chars) — never expose full UUID. Phase 240 SSOT comment at `agent-registry.js:180-183` reinforces this. |
| BG-04 LOG-04 emission floods diagnostics ring | Denial of Service | Phase 211 LOG-04 helper (`rateLimitedWarn`) is rate-limited per-category by design. Pitfall 2's 500ms suppression further reduces flood risk. |
| Tampering via tool-def `_forceForeground` flip | Tampering | Tool registry is source-controlled JS; no runtime mutation path exists. The flag is read at dispatch time but never written. |
| webNavigation listener consumes background-only data | Information Disclosure | webNavigation already fires extension-wide; this phase only adds a registry lookup using existing data. |

[VERIFIED: codebase architecture matches]

## Sources

### Primary (HIGH confidence)
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/phases/243-background-tab-audit-ui-badge-integration/243-CONTEXT.md` — locked decisions D-01..D-07
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/REQUIREMENTS.md` — BG-01..04, UI-01..03 contract
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/ROADMAP.md` — Phase 243 SC and dependency context
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ai/tool-definitions.js` (lines 40-513) — registry shape
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ws/mcp-tool-dispatcher.js` (lines 1-120, 540-572, 860-940) — dispatcher chokepoint and switch_tab handler
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ai/agent-loop.js` (lines 1350-1360, 2480-2515, 1820-2425) — autopilot loop scheduler
- `/Users/lakshmanturlapati/Desktop/FSB/extension/background.js` (lines 1370-1395, 2455-2491, 2680-2720, 6360-6404, 6885-6960, 11450-11475) — webNavigation listener, BFCache recovery, tab switch handlers
- `/Users/lakshmanturlapati/Desktop/FSB/extension/utils/agent-registry.js` (lines 41-50, 180-220, 275-415, 554-580, 768-825, 875-935) — registry surface
- `/Users/lakshmanturlapati/Desktop/FSB/extension/content/visual-feedback.js` (lines 444-450, 585-605, 680-730) — badge renderer
- `/Users/lakshmanturlapati/Desktop/FSB/extension/utils/overlay-state.js` (lines 325-355) — overlay state builder
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ui/control_panel.html` (lines 418-435) — cap input
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ui/options.js` (lines 30-35, 150-160, 295-315, 805-885) — cap UI wiring
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ui/popup.js` (lines 240-280) — active-tab query
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ui/sidepanel.js` (lines 423, 1093, 1208) — active-tab query (3 sites)
- `/Users/lakshmanturlapati/Desktop/FSB/extension/ai/tool-executor.js` (lines 240-280) — autopilot tool dispatch (parallel switch_tab handler)

### Secondary (MEDIUM confidence)
- Chrome `webNavigation.TransitionType` enum semantics — based on Chrome docs, training data; transitionType filter set per CONTEXT D-03 explicit list

### Tertiary (LOW confidence)
- None — this research is grounded in direct codebase reads.

## Project Constraints (from CLAUDE.md)

- **No emojis** in any markdown files, terminal output, or anywhere unless explicitly requested. This research file complies.
- **Never run applications automatically.** Plans should not trigger Chrome auto-launch or test runs without user instruction.
- **Code quality:** ES2021+ JavaScript; comprehensive JSDoc; security-first; performance-aware.
- **Branch-locked to `Refinements`** (per ROADMAP). No git push, no PRs.
- **No new manifest permissions** (per ROADMAP constraint). webNavigation already in manifest (verified by existing listener at `background.js:2464`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dashboard's badge mirror is either non-existent or trivially the same renderer; if a separate dashboard renderer exists, plan needs an additional task | Badge renderer location | LOW — discoverable at plan time via grep on dashboard files |
| A2 | The transitionType `auto_bookmark` is what fires for `chrome.tabs.goBack()` | webNavigation listener | LOW — Pitfall 2 already mitigates with the 500ms suppression regardless of which transitionType fires |
| A3 | `formatAgentIdForDisplay` returning 6 hex chars (e.g., `agent_a3f1ab`) is the right SSOT despite CONTEXT D-04's example using 4 chars | Don't Hand-Roll | LOW — the helper is the canonical and the CONTEXT example is illustrative |
| A4 | Filtering `legacy:*` from the active counter matches user expectations (UI shows MCP-driven count, not internal sentinels) | Pitfall 1 | LOW — naming convention `legacy:popup`/`legacy:sidepanel`/`legacy:autopilot` is explicit by Phase 240 design |

## Open Questions

1. **Dashboard badge mirror existence**
   - What we know: CONTEXT D-04 says "Mirrors on the dashboard if the dashboard already shows the badge."
   - What's unclear: Whether a separate dashboard renderer exists or if the dashboard reuses `visual-feedback.js`.
   - Recommendation: Plan-time grep for `client-badge` / `dashboard.html` / `dashboard.js`. If a separate path exists, add a parallel modification task. If not, A1 holds and dashboard "mirror" is no-op.

2. **`open_tab` tool — should it expose `_forceForeground`?**
   - What we know: `open_tab` calls `chrome.tabs.create({url, active})` honoring `params?.active !== false` (tool-executor.js:251).
   - What's unclear: Whether the MCP `params.active` becomes equivalent to or supersedes `_forceForeground`.
   - Recommendation: Default `_forceForeground:false` for `open_tab`; preserve the existing `params.active` semantic. Document in tool def JSDoc that `params.active=true` is the per-call override; `_forceForeground` is the per-tool default.

3. **BG-04 false-positive suppression — where is `lastAgentNavigationAt` stamped?**
   - What we know: The registry's `_tabMetadata` is the natural store (already mutated at `bindTab`).
   - What's unclear: Whether to extend `_tabMetadata` with a `lastAgentNavigationAt` field or maintain a parallel Map.
   - Recommendation: Extend `_tabMetadata`. The `getTabMetadata` helper at `agent-registry.js:875-887` already returns a shallow clone; add the field there. The stamper is a new tiny helper `stampAgentNavigation(tabId)` called from `handleNavigateRoute` / `handleBackRoute` / `handleStartAutomation`.

4. **Owner-chip stale-data refresh**
   - What we know: First version fetches once on active-tab query.
   - What's unclear: Whether to subscribe `chrome.tabs.onActivated` for live refresh.
   - Recommendation: Defer subscription; document Pitfall 5. Most users don't switch tabs while the popup is open. If real-world feedback shows staleness, add subscription as Phase 244 polish.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module is already in the codebase and verified by direct read
- Architecture: HIGH — patterns mirror existing Phase 240/241 idioms
- Pitfalls: HIGH — derived from explicit code patterns (Pitfall 1's `legacy:*` filter is verifiable; Pitfall 2's transitionType ambiguity is documented Chrome behavior)
- BG-04 false-positive analysis: MEDIUM — the 500ms heuristic is a reasonable starting threshold; plan time may refine

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days; codebase is stable post-Phase-241)

## RESEARCH COMPLETE
