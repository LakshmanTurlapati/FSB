# Phase 160: Bootstrap Pipeline - Research

**Researched:** 2026-04-02
**Domain:** Chrome Extension MV3 service worker startup structuring and deferred initialization
**Confidence:** HIGH

## Summary

Phase 160 restructures background.js's scattered initialization code into a single `swBootstrap()` function with 4 sequential phases (SETTINGS, ENVIRONMENT, TOOLS, SESSIONS), and defers exactly two I/O-bound operations (WebSocket connect and BackgroundAnalytics init) until first user interaction. This is purely internal architecture reorganization -- no new user-facing capabilities.

The critical constraint is Chrome's event listener registration requirement: all `chrome.runtime.onMessage`, `chrome.runtime.onInstalled`, `chrome.runtime.onStartup`, `chrome.alarms.onAlarm`, and other event listeners MUST be registered synchronously at the top level of the service worker script during the first turn of the event loop. The `swBootstrap()` function handles async initialization work (storage reads, side panel config) AFTER all listeners are already registered. The 184 `importScripts()` calls remain synchronous and top-level -- they are not moved into bootstrap phases.

The deferred init boundary is intentionally narrow: only `fsbWebSocket.connect()` (HTTP fetch + WebSocket TCP) and `BackgroundAnalytics` constructor (immediate `chrome.storage.local.get`) are deferred. Everything else stays eager. Debuggability uses the existing `automationLogger.logInit()` method with `Date.now()` deltas -- no new infrastructure needed.

**Primary recommendation:** Structure bootstrap as a single `swBootstrap()` async function called from both `onInstalled` and `onStartup` handlers (with a `_bootstrapDone` guard), keeping all event listener registrations synchronous at the top level. Deferred init triggered by first `onMessage` from UI surface via idempotent `_deferredInitDone` guard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 4-Phase Sequential bootstrap. A single `swBootstrap()` async function replaces the scattered init across top-level code, `onInstalled`, and `onStartup`. Four named phases run in order:
  1. **SETTINGS** -- `chrome.storage.local.get` for debug mode, UI mode, model prefs
  2. **ENVIRONMENT** -- Capability detection, `chrome.sidePanel.setPanelBehavior`, content script file list
  3. **TOOLS** -- Hook pipeline factory registration (`createSessionHooks`), agent scheduler setup
  4. **SESSIONS** -- `restoreSessionsFromStorage()` with auto-resumption (Phase 159 D-03)

  Dependencies flow in order: settings before environment (side panel reads UI mode), environment before tools (hook pipeline needs engine config), tools before sessions (auto-resumption calls `runAgentLoop` which needs the hook factory). A `_bootstrapDone` boolean guard prevents double-init when both `onStartup` and bare-wake fire.

- **D-02:** Defer only the two modules that perform I/O at startup:
  1. **`fsbWebSocket.connect()`** -- HTTP fetch + WebSocket TCP connection on every SW wake
  2. **`BackgroundAnalytics` constructor** -- immediate `chrome.storage.local.get` in constructor

  Everything else stays eager:
  - Site guides (~130 importScripts) -- cheap synchronous registry pushes, no I/O
  - Memory modules (8 files) -- synchronous constructors, lazy storage reads on first method call
  - Tool definitions, AI integration, session schema, hook pipeline -- needed on hot path
  - Agent scheduler `rescheduleAllAgents()` -- stays in TOOLS phase (needs to fire on every wake for scheduled agents)

  Analytics becomes lazy-instantiated via `getAnalytics()` guard pattern. WebSocket connect moves behind `ensureWsConnected()` guard.

- **D-03:** Deferred init triggered by first `chrome.runtime.onMessage` from a UI surface. Both popup.js and sidepanel.js send `getStatus` on DOMContentLoaded -- fires before user types, giving several seconds of warm-up before first task. Implementation: idempotent `_deferredInitDone` boolean guard called at the top of the onMessage handler for UI-originating messages. Secondary trigger inside `handleStartAutomation` covers MCP-initiated sessions. Non-UI wakes (alarms, content-stt broadcasts, MCP bridge traffic) do not trigger deferred init.

- **D-04:** Use existing `automationLogger.logInit(phase, status, { durationMs })` for each of the 4 bootstrap phases. Each phase logs `'start'` and `'complete'` (or `'failed'` on error). `Date.now()` deltas provide wall-clock timing. Explicit `automationLogger.flush()` call at the end of `swBootstrap()` ensures the last phase log is persisted before any potential SW kill. No new infrastructure needed -- `logInit` already routes `'failed'` to `console.error` and persists to `chrome.storage.local`.

### Claude's Discretion
- Exact refactoring of `onInstalled` vs `onStartup` handlers (what stays in each vs moves into `swBootstrap`)
- Whether `swBootstrap()` is called from both handlers or replaces them
- How `getAnalytics()` lazy guard integrates with the 4 existing `initializeAnalytics()` call sites
- Whether `ensureWsConnected()` is called inside the deferred init function or at each WS-needing call site
- Internal structure of the `_deferredInitDone` guard (whether it's a bare boolean or a small module)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOT-01 | Structured service worker startup with explicit ordered phases -- settings prefetch, environment detection, tool registration, session restoration -- enabling debugging of startup failures | 4-phase `swBootstrap()` pattern with `logInit` timing per phase. Chrome's event listener registration constraint dictates that only async init work moves into bootstrap; all listener registrations stay top-level. |
| BOOT-02 | Deferred initialization delays non-essential loading until after first user interaction, preserving eager loading for all tool definitions and core modules | Two-item deferred boundary (WebSocket + Analytics). `getAnalytics()` lazy guard replaces `initializeAnalytics()` at 4 call sites. `ensureWsConnected()` guard replaces direct `fsbWebSocket.connect()` at 3 call sites. Trigger: first `onMessage` from UI surface. |
</phase_requirements>

## Architecture Patterns

### Critical Constraint: Event Listener Registration Timing

Chrome MV3 requires ALL event listeners to be registered synchronously during the first turn of the event loop. This is the single most important constraint for bootstrap pipeline design.

**From official Chrome documentation:**
> "Event handlers in service workers need to be declared in the global scope, meaning they should be at the top level of the script and not be nested inside functions. This ensures that they are registered synchronously on initial script execution, which enables Chrome to dispatch events to the service worker as soon as it starts."

**What this means for Phase 160:**
- The 184 `importScripts()` calls STAY at the top level -- they are synchronous and execute before any event handlers
- All `chrome.runtime.onMessage.addListener`, `chrome.runtime.onInstalled.addListener`, `chrome.runtime.onStartup.addListener`, `chrome.alarms.onAlarm.addListener`, and `chrome.storage.onChanged.addListener` calls STAY at the top level
- `swBootstrap()` only handles async initialization work that currently runs INSIDE the `onInstalled`/`onStartup` callbacks
- The bare-wake `restoreSessionsFromStorage()` call at line 2950 moves into the SESSIONS phase of `swBootstrap()`

**Incorrect pattern (DO NOT USE):**
```javascript
// WRONG: Moving listener registration into an async function
async function swBootstrap() {
  // ...init work...
  chrome.runtime.onMessage.addListener(handler); // WILL MISS EVENTS
}
```

**Correct pattern:**
```javascript
// All importScripts -- synchronous, top-level
importScripts('config/config.js');
// ... 183 more ...

// All event listeners -- synchronous, top-level
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Deferred init trigger at top of handler
  maybeRunDeferredInit(request, sender);
  // ... existing switch/case ...
});
chrome.runtime.onInstalled.addListener(async () => {
  await swBootstrap('installed');
});
chrome.runtime.onStartup.addListener(async () => {
  await swBootstrap('startup');
});

// Bootstrap function -- async work only
async function swBootstrap(trigger) {
  if (_bootstrapDone) return;
  _bootstrapDone = true;
  // Phase 1: SETTINGS
  // Phase 2: ENVIRONMENT
  // Phase 3: TOOLS
  // Phase 4: SESSIONS
}
```

### Pattern 1: 4-Phase Sequential Bootstrap

**What:** A single `swBootstrap()` async function that replaces the scattered init logic currently split across `onInstalled` (line 10103), `onStartup` (line 10135), and bare-wake top-level code (line 2950).

**Phase execution order:**

```
SETTINGS    --> chrome.storage.local.get for debugMode, uiMode, model prefs
                Sets fsbDebugMode global
                Duration: ~5-15ms (single storage read, batchable)

ENVIRONMENT --> chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
                Content script file list verification (optional)
                Duration: ~1-5ms

TOOLS       --> agentScheduler.rescheduleAllAgents()
                createSessionHooks factory verification (already loaded via importScripts)
                Duration: ~5-20ms (reads chrome.alarms)

SESSIONS    --> restoreSessionsFromStorage() with auto-resumption
                restoreConversationSessions()
                Duration: ~10-50ms (reads chrome.storage.session)
```

**Logging contract per phase:**
```javascript
automationLogger.logInit('bootstrap:SETTINGS', 'start', {});
// ... phase work ...
automationLogger.logInit('bootstrap:SETTINGS', 'complete', { durationMs: elapsed });
// OR on error:
automationLogger.logInit('bootstrap:SETTINGS', 'failed', { error: err.message, durationMs: elapsed });
```

### Pattern 2: Double-Init Guard

**What:** A `_bootstrapDone` boolean prevents `swBootstrap()` from running twice when both `onStartup` and bare-wake fire.

**Current problem:** The `onStartup` handler calls `restoreSessionsFromStorage()`, AND the bare-wake top-level code at line 2950 also calls `restoreSessionsFromStorage()`. With `swBootstrap()`, both paths would trigger the same init sequence. The guard ensures only one runs.

```javascript
var _bootstrapDone = false;

async function swBootstrap(trigger) {
  if (_bootstrapDone) return;
  _bootstrapDone = true;

  var bootstrapStart = Date.now();
  automationLogger.logInit('bootstrap', 'start', { trigger: trigger });

  try {
    // Phase 1: SETTINGS
    var t0 = Date.now();
    automationLogger.logInit('bootstrap:SETTINGS', 'start', {});
    await loadDebugMode();
    // ... more settings reads ...
    automationLogger.logInit('bootstrap:SETTINGS', 'complete', { durationMs: Date.now() - t0 });

    // Phase 2: ENVIRONMENT
    // Phase 3: TOOLS
    // Phase 4: SESSIONS
  } catch (err) {
    automationLogger.logInit('bootstrap', 'failed', {
      error: err.message,
      durationMs: Date.now() - bootstrapStart
    });
  }

  automationLogger.logInit('bootstrap', 'complete', { durationMs: Date.now() - bootstrapStart });
  automationLogger.flush();
}
```

### Pattern 3: Deferred Init with Lazy Guards

**What:** Two lazy guard functions replace eager initialization of WebSocket and Analytics.

**`getAnalytics()` lazy guard:**
```javascript
var _analyticsInstance = null;

function getAnalytics() {
  if (!_analyticsInstance) {
    _analyticsInstance = new BackgroundAnalytics();
  }
  return _analyticsInstance;
}
```

This replaces the current `initializeAnalytics()` function and its 4 call sites:
- Line 4470: `const analytics = initializeAnalytics();` (inside task tracking)
- Line 8575: `const analytics = initializeAnalytics();` (inside usage tracking)
- Line 10107: `initializeAnalytics();` (inside onInstalled)
- Line 10137: `initializeAnalytics();` (inside onStartup)

The first two call sites are already lazy (called when needed). The last two are the eager startup calls that move into deferred init.

**`ensureWsConnected()` lazy guard:**
```javascript
var _wsInitDone = false;

function ensureWsConnected() {
  if (_wsInitDone) return;
  _wsInitDone = true;
  fsbWebSocket.connect();
}
```

This replaces direct `fsbWebSocket.connect()` calls at:
- Line 10131: inside onInstalled
- Line 10146: inside onStartup
- Line 10159: inside storage.onChanged listener (when serverSyncEnabled is toggled ON)

The storage.onChanged call at line 10159 should STILL call `fsbWebSocket.connect()` directly (not through ensureWsConnected) because it's a user-initiated toggle. Only the startup-time calls route through the deferred init path.

**Deferred init trigger:**
```javascript
var _deferredInitDone = false;

function maybeRunDeferredInit(request, sender) {
  if (_deferredInitDone) return;
  // Only trigger on UI-originating messages
  if (sender.tab) return;  // Content script messages have sender.tab
  if (request.from === 'content-stt') return;  // STT broadcasts
  _deferredInitDone = true;

  getAnalytics();           // Lazy-instantiate BackgroundAnalytics
  ensureWsConnected();      // Start WebSocket connection
}
```

The key insight: popup.js and sidepanel.js messages arrive WITHOUT `sender.tab` (they are extension pages, not content scripts). Content script messages arrive WITH `sender.tab`. This distinction enables filtering.

### Pattern 4: onInstalled vs onStartup Separation

**What stays in `onInstalled` (runs only on install/update):**
- Setting default `uiMode` to 'sidepanel' if not set (line 10113-10117)
- Extension version logging

**What stays in `onStartup` (runs only on browser launch):**
- Nothing unique -- all onStartup work is absorbed by `swBootstrap()`

**What moves into `swBootstrap()` (runs on every wake):**
- `loadDebugMode()` (SETTINGS phase)
- `chrome.sidePanel.setPanelBehavior()` (ENVIRONMENT phase)
- `agentScheduler.rescheduleAllAgents()` (TOOLS phase)
- `restoreSessionsFromStorage()` (SESSIONS phase)

**What moves into deferred init (runs on first UI interaction):**
- `initializeAnalytics()` -> replaced by `getAnalytics()` lazy guard
- `fsbWebSocket.connect()` -> replaced by `ensureWsConnected()` lazy guard

### Recommended Structure After Refactor

```
background.js (modified)
  |-- Top-level: 184 importScripts (unchanged)
  |-- Top-level: All event listener registrations (unchanged)
  |-- Top-level: swBootstrap() call (replaces scattered init)
  |
  |-- swBootstrap(trigger)
  |     |-- Phase 1: SETTINGS (loadDebugMode, read uiMode, model prefs)
  |     |-- Phase 2: ENVIRONMENT (sidePanel config, capability detection)
  |     |-- Phase 3: TOOLS (rescheduleAllAgents, verify createSessionHooks)
  |     |-- Phase 4: SESSIONS (restoreSessionsFromStorage)
  |
  |-- maybeRunDeferredInit(request, sender)
  |     |-- getAnalytics() -- lazy BackgroundAnalytics
  |     |-- ensureWsConnected() -- lazy WebSocket connect
  |
  |-- onInstalled handler: only install-specific work + swBootstrap('installed')
  |-- onStartup handler: swBootstrap('startup')
  |-- Bare-wake: swBootstrap('wake')
```

### Anti-Patterns to Avoid

- **Moving event listener registration into async functions:** Chrome will miss events dispatched before the async function completes. All `addListener` calls must remain synchronous top-level.
- **Moving importScripts into bootstrap phases:** `importScripts()` is synchronous and must execute at the top level. Moving it into an async function would break the execution model entirely.
- **Over-deferring:** The CONTEXT.md explicitly limits deferred items to WebSocket and Analytics. Do NOT defer site guides, memory modules, tool definitions, or any module on the hot path.
- **Using Promise for bootstrap guard instead of boolean:** The `_bootstrapDone` guard must be a simple boolean set synchronously at the top of `swBootstrap()`. Using a Promise would create a race condition where two callers could both start bootstrap before either resolves.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bootstrap phase logging | Custom logging infrastructure | `automationLogger.logInit(component, status, details)` | Already supports 'start'/'complete'/'failed' status, routes 'failed' to console.error, persists to chrome.storage.local. Flush via `automationLogger.flush()`. |
| Double-init prevention | Complex locking mechanism | Simple `var _bootstrapDone = false` boolean | Service worker is single-threaded. No concurrency. A boolean is sufficient and cannot deadlock. |
| Deferred init trigger detection | Message type enumeration | `sender.tab` presence check | Extension pages (popup, sidepanel, options) always have `sender.tab === undefined`. Content scripts always have `sender.tab` set. This is the simplest discriminator. |
| Analytics lazy loading | Proxy pattern or factory module | `getAnalytics()` guard function | The existing `initializeAnalytics()` already has an `if (!globalAnalytics)` guard. Just rename and remove the eager call sites. |

## Common Pitfalls

### Pitfall 1: Bootstrap Runs After Event Dispatch

**What goes wrong:** `swBootstrap()` is async. If a message arrives before bootstrap completes, the handler runs with uninitialized state (e.g., `fsbDebugMode` still `false`, sessions not restored).

**Why it happens:** `onMessage` fires immediately when the service worker wakes. `swBootstrap()` is still awaiting `chrome.storage.local.get()`.

**How to avoid:** The existing code already handles this implicitly -- `activeSessions` is initialized as an empty Map, `fsbDebugMode` defaults to `false`, and `getStatus` returns `activeSessions.size === 0` until sessions are restored. The bootstrap phases fill in correct state asynchronously. The `getStatus` response may be slightly stale for the first few milliseconds after wake, but the UI re-queries on subsequent interactions.

**Warning signs:** UI shows 0 active sessions for a brief moment after service worker restart, even when sessions exist. This is acceptable and self-corrects within ~50ms.

### Pitfall 2: Bare-Wake Bootstrap Race with onStartup

**What goes wrong:** On browser startup, both `onStartup` and the bare-wake top-level code fire. Without the `_bootstrapDone` guard, `restoreSessionsFromStorage()` runs twice, potentially creating duplicate session entries.

**Why it happens:** Chrome fires `onStartup` for browser launch, but the service worker's top-level code also executes during the same wake cycle.

**How to avoid:** The `_bootstrapDone` boolean guard. Set it synchronously at the TOP of `swBootstrap()` (before any await) so the second caller sees `true` immediately.

```javascript
async function swBootstrap(trigger) {
  if (_bootstrapDone) return;   // Synchronous check
  _bootstrapDone = true;         // Synchronous set -- BEFORE any await
  // ... async work follows ...
}
```

### Pitfall 3: Deferred Init Never Fires on MCP-Only Sessions

**What goes wrong:** MCP (Model Context Protocol) sessions start via `handleStartAutomation` with `_triggerSource: 'mcp'`. If the only interaction is MCP (no popup or sidepanel opens), the `onMessage`-based deferred init trigger never fires because MCP messages may arrive via a different path (external message or internal forwarding).

**Why it happens:** The CONTEXT.md D-03 explicitly addresses this: "Secondary trigger inside `handleStartAutomation` covers MCP-initiated sessions."

**How to avoid:** Call `maybeRunDeferredInit()` at the top of `handleStartAutomation()` as a secondary trigger. The idempotent `_deferredInitDone` guard ensures it only runs once regardless of how many triggers fire.

### Pitfall 4: Analytics Call Before Deferred Init

**What goes wrong:** Analytics tracking is called during automation (line 4470, 8575) which uses `initializeAnalytics()` / `getAnalytics()`. If these fire before deferred init, the lazy guard instantiates BackgroundAnalytics at that point -- which is fine because the guard is idempotent. But the `BackgroundAnalytics` constructor fires `chrome.storage.local.get` which may add latency to the first automation iteration.

**Why it happens:** The first `trackUsage()` call triggers lazy instantiation.

**How to avoid:** This is acceptable. The `BackgroundAnalytics.initPromise` is awaited inside `trackUsage()` (line 4957-4959), so the storage read happens in parallel with other work. The deferred init goal is to avoid this read on EVERY service worker wake -- not to avoid it entirely. When automation starts, the ~15ms storage read is negligible compared to the ~1-3 second AI API call.

### Pitfall 5: onInstalled Default uiMode Write During Update

**What goes wrong:** The `onInstalled` handler at line 10113 only sets `uiMode` if it's not already set. This logic must stay in `onInstalled` (not move to `swBootstrap`) because it should only check on install/update, not on every wake.

**Why it happens:** `onInstalled` fires on install, update, and Chrome update. `onStartup` and bare-wake fire on every browser launch or service worker restart. Moving the default-write logic to `swBootstrap` would cause it to run unnecessarily on every wake.

**How to avoid:** Keep the `uiMode` default-setting logic inside the `onInstalled` listener callback, separate from `swBootstrap()`. Call `swBootstrap('installed')` AFTER the install-specific work completes.

## Code Examples

### Example 1: Complete swBootstrap Function Structure

```javascript
// Source: Adapted from CONTEXT.md D-01, D-04 and existing background.js init code

var _bootstrapDone = false;

async function swBootstrap(trigger) {
  if (_bootstrapDone) return;
  _bootstrapDone = true;

  var bsStart = Date.now();
  automationLogger.logInit('bootstrap', 'start', { trigger: trigger });

  // Phase 1: SETTINGS
  var t0 = Date.now();
  automationLogger.logInit('bootstrap:SETTINGS', 'start', {});
  try {
    await loadDebugMode();
    // Batch-read additional settings if needed
    automationLogger.logInit('bootstrap:SETTINGS', 'complete', { durationMs: Date.now() - t0 });
  } catch (err) {
    automationLogger.logInit('bootstrap:SETTINGS', 'failed', { error: err.message, durationMs: Date.now() - t0 });
  }

  // Phase 2: ENVIRONMENT
  t0 = Date.now();
  automationLogger.logInit('bootstrap:ENVIRONMENT', 'start', {});
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    automationLogger.logInit('bootstrap:ENVIRONMENT', 'complete', { durationMs: Date.now() - t0 });
  } catch (err) {
    // sidePanel API not available in older Chrome -- non-fatal
    automationLogger.logInit('bootstrap:ENVIRONMENT', 'complete', {
      durationMs: Date.now() - t0, sidePanelFallback: true
    });
  }

  // Phase 3: TOOLS
  t0 = Date.now();
  automationLogger.logInit('bootstrap:TOOLS', 'start', {});
  try {
    agentScheduler.rescheduleAllAgents();
    automationLogger.logInit('bootstrap:TOOLS', 'complete', { durationMs: Date.now() - t0 });
  } catch (err) {
    automationLogger.logInit('bootstrap:TOOLS', 'failed', { error: err.message, durationMs: Date.now() - t0 });
  }

  // Phase 4: SESSIONS
  t0 = Date.now();
  automationLogger.logInit('bootstrap:SESSIONS', 'start', {});
  try {
    await restoreSessionsFromStorage();
    automationLogger.logInit('bootstrap:SESSIONS', 'complete', {
      durationMs: Date.now() - t0,
      restoredSessions: activeSessions.size
    });
  } catch (err) {
    automationLogger.logInit('bootstrap:SESSIONS', 'failed', { error: err.message, durationMs: Date.now() - t0 });
  }

  automationLogger.logInit('bootstrap', 'complete', {
    trigger: trigger,
    durationMs: Date.now() - bsStart,
    phases: 4
  });
  automationLogger.flush();
}
```

### Example 2: Deferred Init Trigger in onMessage

```javascript
// Source: CONTEXT.md D-03

var _deferredInitDone = false;

function maybeRunDeferredInit(request, sender) {
  if (_deferredInitDone) return;
  // Only trigger on extension page messages (popup, sidepanel, options)
  // Content scripts always have sender.tab set
  if (sender.tab) return;
  // STT broadcasts are from content scripts but without sender.tab in some cases
  if (request.from === 'content-stt') return;

  _deferredInitDone = true;
  automationLogger.logInit('deferred', 'start', { trigger: request.action || 'unknown' });

  getAnalytics();           // Lazy-instantiate BackgroundAnalytics
  ensureWsConnected();      // Start WebSocket connection

  automationLogger.logInit('deferred', 'complete', { trigger: request.action || 'unknown' });
}
```

### Example 3: getAnalytics() Lazy Guard

```javascript
// Source: Replaces existing initializeAnalytics() at background.js:4990

// Replace: let globalAnalytics = null;
// With:
var _analyticsInstance = null;

function getAnalytics() {
  if (!_analyticsInstance) {
    _analyticsInstance = new BackgroundAnalytics();
    automationLogger.logInit('background_analytics', 'lazy_init', {});
  }
  return _analyticsInstance;
}

// Update all call sites from:
//   const analytics = initializeAnalytics();
// To:
//   const analytics = getAnalytics();
```

### Example 4: ensureWsConnected() Lazy Guard

```javascript
// Source: CONTEXT.md D-02

var _wsInitDone = false;

function ensureWsConnected() {
  if (_wsInitDone) return;
  _wsInitDone = true;
  fsbWebSocket.connect();
}

// The storage.onChanged handler for serverSyncEnabled toggle
// should STILL call fsbWebSocket.connect() directly (not through guard)
// because it's user-initiated reconnection, not startup init
```

### Example 5: Modified onInstalled Handler

```javascript
// Source: Current background.js line 10103-10132

chrome.runtime.onInstalled.addListener(async () => {
  automationLogger.logInit('extension', 'installed', { version: 'v0.9.20' });

  // Install-specific: Set default UI mode if not set
  var stored = await chrome.storage.local.get(['uiMode']);
  if (!stored.uiMode) {
    await chrome.storage.local.set({ uiMode: 'sidepanel' });
    automationLogger.debug('Default UI mode set to sidepanel', {});
  }

  // Run shared bootstrap (SETTINGS, ENVIRONMENT, TOOLS, SESSIONS)
  await swBootstrap('installed');
});
```

### Example 6: Modified onStartup Handler

```javascript
// Source: Current background.js line 10135-10147

chrome.runtime.onStartup.addListener(async () => {
  automationLogger.logServiceWorker('startup', {});
  await swBootstrap('startup');
});
```

### Example 7: Bare-Wake Bootstrap Call

```javascript
// Source: Replaces current line 2950 restoreSessionsFromStorage() call

// Replace the bare-wake restoreSessionsFromStorage() call:
// OLD: restoreSessionsFromStorage().catch(err => { ... });
// NEW:
swBootstrap('wake').catch(function(err) {
  console.warn('FSB: Bootstrap failed on wake:', err);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scattered init in onInstalled + onStartup + bare-wake | Consolidated `swBootstrap()` with named phases | Phase 160 (this phase) | Single point of debugging for all startup issues |
| Eager `initializeAnalytics()` on every SW wake | Lazy `getAnalytics()` on first use | Phase 160 | Saves ~15ms `chrome.storage.local.get` per wake when no automation runs |
| Eager `fsbWebSocket.connect()` on every SW wake | Lazy `ensureWsConnected()` on first UI interaction | Phase 160 | Saves HTTP fetch + WebSocket TCP handshake per wake when no UI opens |
| `restoreSessionsFromStorage()` called twice on browser startup | `_bootstrapDone` guard ensures single execution | Phase 160 | Prevents potential duplicate session restoration |

## Existing Code Inventory

### Current Init Call Sites (to be refactored)

| Code | Location | Current Behavior | Phase 160 Target |
|------|----------|-----------------|------------------|
| `initializeAnalytics()` | line 10107 (onInstalled) | Eager on install | Remove -- replaced by `getAnalytics()` lazy guard |
| `initializeAnalytics()` | line 10137 (onStartup) | Eager on startup | Remove -- replaced by `getAnalytics()` lazy guard |
| `initializeAnalytics()` | line 4470 (trackUsage) | Lazy on first use | Rename to `getAnalytics()` |
| `initializeAnalytics()` | line 8575 (usage tracking) | Lazy on first use | Rename to `getAnalytics()` |
| `loadDebugMode()` | line 10110 (onInstalled) | Eager on install | Move to SETTINGS phase |
| `loadDebugMode()` | line 10139 (onStartup) | Eager on startup | Move to SETTINGS phase |
| `chrome.sidePanel.setPanelBehavior()` | line 10121 (onInstalled) | Eager on install | Move to ENVIRONMENT phase |
| `agentScheduler.rescheduleAllAgents()` | line 10128 (onInstalled) | Eager on install | Move to TOOLS phase |
| `agentScheduler.rescheduleAllAgents()` | line 10143 (onStartup) | Eager on startup | Move to TOOLS phase |
| `restoreSessionsFromStorage()` | line 2950 (bare-wake) | Eager on every wake | Move to SESSIONS phase |
| `restoreSessionsFromStorage()` | line 10141 (onStartup) | Eager on startup | Move to SESSIONS phase (deduplicated by guard) |
| `fsbWebSocket.connect()` | line 10131 (onInstalled) | Eager on install | Move to deferred init |
| `fsbWebSocket.connect()` | line 10146 (onStartup) | Eager on startup | Move to deferred init |

### Variables and Guards Summary

| Variable | Type | Scope | Purpose |
|----------|------|-------|---------|
| `_bootstrapDone` | `var` boolean | background.js global | Prevents double bootstrap execution |
| `_deferredInitDone` | `var` boolean | background.js global | Prevents double deferred init execution |
| `_analyticsInstance` | `var` object/null | background.js global | Replaces `globalAnalytics`, lazy-initialized |
| `_wsInitDone` | `var` boolean | background.js global | Prevents double WebSocket connect |

All use `var` (not `let`/`const`) for `importScripts()` context compatibility per established FSB pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js direct execution (no test framework) |
| Config file | none -- tests are standalone scripts |
| Quick run command | `node tests/test-overlay-state.js` |
| Full suite command | `npm test` |

### Phase Requirements --> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOT-01 | Bootstrap phases execute in order with timing logs | manual | Load extension, check service worker console for `logInit` entries | N/A -- manual Chrome DevTools |
| BOOT-01 | Double-init guard prevents duplicate bootstrap | manual | Kill SW via chrome://serviceworker-internals, verify single bootstrap log sequence | N/A -- manual |
| BOOT-02 | Analytics not initialized until first UI interaction | manual | Load extension without opening popup, verify no `BackgroundAnalytics` log entry | N/A -- manual |
| BOOT-02 | WebSocket not connected until first UI interaction | manual | Load extension without opening popup, verify no `[FSB WS] Connected` in console | N/A -- manual |
| BOOT-02 | getAnalytics() lazy guard works at all 4 call sites | manual | Start automation, verify analytics tracking works normally | N/A -- manual |

### Sampling Rate
- **Per task commit:** Manual verification via chrome://extensions service worker inspector
- **Per wave merge:** Full extension reload + automation test
- **Phase gate:** Verify all 4 bootstrap phases log correctly, deferred items defer, eager items still work

### Wave 0 Gaps
None -- this phase modifies a single existing file (background.js) with internal restructuring. No new test infrastructure needed. Manual verification via Chrome DevTools console is the standard testing approach for service worker lifecycle changes (per CLAUDE.md Testing Strategy).

## Open Questions

1. **Should swBootstrap() be called from bare-wake OR only from onInstalled/onStartup?**
   - What we know: Currently, `restoreSessionsFromStorage()` is called at bare-wake (line 2950) AND inside `onStartup` (line 10141). Both paths need session restoration.
   - What's unclear: Whether `onStartup` always fires before the bare-wake code, or if they can race.
   - Recommendation: Call `swBootstrap('wake')` at the position of current line 2950 (bare-wake). Also call from `onInstalled` and `onStartup`. The `_bootstrapDone` guard makes multiple calls safe. The first to execute wins.

2. **How should SETTINGS phase batch storage reads?**
   - What we know: `loadDebugMode()` reads `debugMode` from `chrome.storage.local`. The `uiMode` check in `onInstalled` also reads from `chrome.storage.local`.
   - What's unclear: Whether batching these into a single `chrome.storage.local.get(['debugMode', 'uiMode', ...])` provides meaningful speedup vs separate reads.
   - Recommendation: Batch into a single read for cleanliness, but don't over-optimize -- the difference is ~2ms. The `uiMode` default-write stays in `onInstalled` only.

## Project Constraints (from CLAUDE.md)

- ES2021+ JavaScript with proper error handling
- Use `var` declarations for shared-scope globals (importScripts context compatibility)
- No build system -- all code must work with `importScripts()` directly
- Manual testing across diverse websites (no automated test framework for service worker lifecycle)
- Chrome 88+ (Manifest V3 support) minimum browser version
- No emojis in logs, documentation, or code comments

## Sources

### Primary (HIGH confidence)
- `background.js` lines 1-238 (importScripts inventory -- 184 calls)
- `background.js` lines 2948-2952 (bare-wake restoreSessionsFromStorage)
- `background.js` lines 10103-10147 (onInstalled + onStartup handlers)
- `background.js` lines 4870-4996 (BackgroundAnalytics class + initializeAnalytics)
- `ws/ws-client.js` lines 128-209 (fsbWebSocket.connect/disconnect)
- `utils/automation-logger.js` lines 466-471 (logInit method)
- `utils/automation-logger.js` lines 514-520 (flush method)
- `.planning/phases/160-bootstrap-pipeline/160-CONTEXT.md` (locked decisions D-01 through D-04)

### Secondary (MEDIUM confidence)
- [Chrome Events in service workers documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events) -- event listener registration must be synchronous at global scope
- [Chrome Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- onInstalled/onStartup firing order
- [Chrome Extension service worker basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) -- importScripts usage

### Tertiary (LOW confidence)
- Bootstrap phase timing estimates (5-50ms per phase) -- based on general chrome.storage.local read performance, not benchmarked against FSB's specific payloads. Actual timings will be captured by logInit during implementation.

## Metadata

**Confidence breakdown:**
- Architecture: HIGH -- All decisions are locked in CONTEXT.md. The implementation patterns follow directly from Chrome MV3 documented constraints and the existing codebase structure.
- Pitfalls: HIGH -- All pitfalls identified from direct code analysis of the existing init paths and Chrome's documented event listener registration requirements.
- Code examples: HIGH -- All examples derived from existing background.js code patterns with minimal transformation.

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- Chrome MV3 service worker model is well-established)
