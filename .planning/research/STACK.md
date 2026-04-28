# Stack Research: v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability

**Domain:** Chrome MV3 extension (vanilla JS, no build) + WebSocket relay + Angular 19 showcase
**Researched:** 2026-04-28
**Confidence:** HIGH (most additions are zero-dependency runtime tweaks; one library already present and only needs to be re-applied symmetrically)

## Executive Summary

This milestone is **mechanics, not greenfield**. The right answer for almost every question below is "no new dependency, reuse what is already vendored." The single existing dependency that matters is `lz-string` (already at `lib/lz-string.min.js`, version 1.5.0) -- the WebSocket "compression asymmetry" the milestone calls out is **not** a per-message-deflate problem. It is the extension's inbound `onmessage` handler not running the `_lz` envelope through `LZString.decompressFromBase64()` while the dashboard side already does. The fix is a five-line change in `ws/ws-client.js`, not a new library.

For DOM-streaming hardening, large-DOM truncation, and the mutation-queue watchdog, the constraint is hard: the extension has **no build system** and the service worker context has **no `requestIdleCallback`**. Recommendations stick to platform primitives (TreeWalker, `chrome.alarms`, `setTimeout` watchdogs in content scripts, `requestAnimationFrame` for content-script idle scheduling).

For the deprecation-card UI and the new Sync tab, the existing `<li class="nav-item" data-section="...">` pattern in `ui/control_panel.html` is the canonical extension point. No framework, no templating engine, no router. Vanilla DOM only -- the rest of the control panel is built that way and the milestone explicitly preserves the no-build constraint.

---

## Recommended Stack (Final)

### Runtime additions to the FSB extension

| Technology | Version | Where it lands | Why |
|------------|---------|----------------|-----|
| `lz-string` (already vendored) | 1.5.0 | Re-used at `ws/ws-client.js` `onmessage` for inbound symmetry | Server relay only stamps a `_lz` envelope when the **extension** sends it (server is dumb relay). The dashboard already decompresses; the extension does not. Reusing the same library closes the loop without inventing a second compression path. **No new dependency.** |
| Native `TreeWalker` (`NodeFilter.SHOW_ELEMENT`) | Web Platform | `content/dom-stream.js` truncation hot path replacing `clone.querySelectorAll('[data-fsb-nid]')` + reverse `getBoundingClientRect()` walk | The current truncation calls `getBoundingClientRect()` per off-viewport node which forces synchronous layout per call. A `TreeWalker` skips the layout flush, and a single `Map<nid, rect>` snapshot built **before** mutating the clone removes 50k synchronous reflows on large pages. |
| Native `chrome.alarms` | MV3 built-in | Background-driven watchdog tickle for the per-tab mutation queue | `requestIdleCallback` is unavailable in service workers (W3C #790, MDN); `chrome.alarms` survives SW suspension, fires on a 30s+ minimum interval, and is the only timer Google guarantees won't be killed by SW idle eviction. |
| Native `setTimeout` + monotonic counter | Web Platform | Content-script side of the watchdog (per-tab, per-stream) | Inside the content script, `setTimeout` is not killed by SW eviction. A monotonic "last drain ts" + 5s threshold is enough to detect a stuck queue without taking on a scheduling library. |
| Native `requestAnimationFrame` | Web Platform | Idle batching for mutation flushes inside the content script | `rIC` is fine in content scripts but unreliable in long-running tabs (Chrome may starve it on background tabs). `rAF` is consistent and we only need a single-frame deferral, not true idle. |
| Existing `qrcode-generator` 2.0.4 | already vendored at `ui/lib/qrcode-generator.min.js` | Sync tab QR rendering (relocated from popup) | Phase 210 already validated this. No change. |

### Showcase / Angular dashboard

| Technology | Version | Status | Notes |
|------------|---------|--------|-------|
| `@angular/*` | 19.0.x | **Pin, do not upgrade in this milestone** | Angular 19 enters EOL **2026-05-19** (~3 weeks after this milestone ships). That's a **separate milestone's problem**, not v0.9.45rc1's. The agent-sunset copy mirror on the showcase is a *content* change, not a framework change. |
| `lz-string` | 1.5.0 | Already loaded at `showcase/js/lz-string.min.js` and referenced from `showcase/angular/src/index.html` | Reuse. No change. |

### What is **not** added

| Avoid | Why | Use instead |
|-------|-----|-------------|
| **Any build system / bundler / transpiler** (webpack, vite, rollup, esbuild) | Project constraint -- explicitly stated in CLAUDE.md ("No build system: direct JavaScript execution"). The extension loads vendored libs via `importScripts()` in the service worker and `<script src=...>` in HTML. Adding a bundler would invalidate every `importScripts` line and force the extension into a different deployment shape. | Continue to vendor minified files into `lib/` and load them directly. |
| **React, Vue, Svelte, Lit, Alpine.js** for the Sync tab or deprecation card | The control panel is **vanilla DOM** with `data-section` tab routing already in place. Introducing a framework for one card and one tab creates a hybrid UI nobody can maintain and would require either runtime JSX (slow, fragile) or the build system the project rejects. | Plain `document.createElement` + `template` literals, in line with the existing `ui/options.js` pattern. |
| **`pako`** (zlib in JS) | We already have `lz-string` for the exact use case (text compression of WebSocket envelopes). Adding `pako` would mean two compression libraries on the inbound path, ~45 KB of dead weight, and a new compatibility matrix between extension + dashboard + relay. | Reuse the vendored `lz-string`. |
| **`DecompressionStream("deflate-raw")`** | Available in MV3 service workers (Chrome ≥ 80 / 103 for `deflate-raw`) but **does not** decode lz-string output. lz-string is a custom LZW-based format, not RFC 1951 DEFLATE. Wiring `DecompressionStream` here would require also switching the **outbound** path to native `CompressionStream`, which is a much larger blast radius and breaks compatibility with already-deployed dashboards. | Reuse `LZString.decompressFromBase64`. If we later want to migrate compression formats, that's a separate milestone with a clean cutover. |
| **`ws` / `socket.io-client`** in the extension | The extension already uses the platform-native `WebSocket` constructor in `ws/ws-client.js`. Service workers cannot run Node-targeted libraries. | Native `WebSocket`. |
| **Idle-task scheduler libraries** (`idle-task`, `scheduler-polyfill`, `requestIdleCallback`-shim) | All of them assume `requestIdleCallback` semantics that the SW cannot provide; in the content script we don't need that level of sophistication for a single-flush deferral. | `requestAnimationFrame` (content script) + `chrome.alarms` (service worker). |
| **Mutation observer libraries** (`mutation-summary`, `dom-mutations`, etc.) | Existing `content/dom-stream.js` already runs a hand-rolled `MutationObserver`. The watchdog is a counter + timestamp problem, not an observer-pattern problem. | Plain `MutationObserver` + monotonic counter. |
| **State / pub-sub libraries** (`zustand`, `nanostores`, `mitt`) for the new Sync tab | The control panel uses Chrome's `chrome.runtime.onMessage` + `chrome.storage.onChanged` as the canonical event bus. The Sync tab consumes the existing `ext:remote-control-state` message that other surfaces already wire up. | Existing message bus. |
| **`qrcode`** (the heavy `node-qrcode` package) | Phase 210 deliberately picked `qrcode-generator` (2.0.4, ~12 KB) over `qrcode` (~150 KB w/ canvas). Already shipped. | Keep `qrcode-generator`. |

---

## Domain-by-domain rationale

### (a) WebSocket inbound decompression in the MV3 service worker

**Conclusion: re-use the existing `LZString.decompressFromBase64`. Do not introduce per-message-deflate or `DecompressionStream`.**

**Evidence from the codebase:**
- `ws/ws-client.js:580-593` -- outbound: builds raw JSON, wraps as `{ _lz: true, d: LZString.compressToBase64(raw) }` when raw > 1024 B and the compressed form is smaller.
- `ws/ws-client.js:515-522` -- inbound `onmessage`: `JSON.parse(event.data)` then `_handleMessage(msg)`. **There is no `_lz` branch.** This is the asymmetry. Any `_lz` envelope arriving at the extension is dispatched as a malformed message because `msg.type` is `undefined` (the relay log already calls these `'compressed-envelope'` at `server/src/ws/handler.js:188-190`).
- `showcase/js/dashboard.js:3516-3528` -- the dashboard *correctly* sniffs `envelope._lz` and runs `LZString.decompressFromBase64(envelope.d)`. We are mirroring the dashboard's already-validated logic.
- `background.js:37` -- `lz-string.min.js` is already loaded into the service worker via `importScripts`. **The library is loaded; we simply aren't calling decompress on inbound.**
- `server/src/ws/handler.js:175-203` -- the relay does **not** compress; it forwards `data.toString()` verbatim. So the only producer of `_lz` envelopes that the extension might receive is *another* extension-side actor (the dashboard, or a future MCP-bridged producer). For now, the dashboard does not produce compressed payloads to the extension, but the milestone explicitly calls out that this asymmetry needs fixing for forward compatibility.

**Why not `DecompressionStream("deflate-raw")`** even though it's available in MV3 service workers (Chrome 80+ for the constructor, 103+ for `deflate-raw`):
- lz-string is **not** RFC 1951 DEFLATE. It's a custom LZW variant that emits UTF-16 codepoints (or, in our usage, a base64-encoded bitstream). `DecompressionStream("deflate-raw")` will throw or produce garbage on `_lz` input.
- Switching to native `CompressionStream`/`DecompressionStream` end-to-end means changing the outbound serializer, the dashboard deserializer, and adding a feature-flag handshake so old dashboards keep working. That is a multi-phase migration, not a bugfix, and is out of scope.

**Why not `pako`:** redundant. Already ruled out under "what is not added."

**Integration point:** `ws/ws-client.js`, replace lines 515-522 with:

```javascript
this.ws.onmessage = (event) => {
  try {
    let msg = JSON.parse(event.data);
    if (msg && msg._lz === true && typeof msg.d === 'string' && typeof LZString !== 'undefined') {
      const decoded = LZString.decompressFromBase64(msg.d);
      if (!decoded) {
        console.warn('[FSB WS] Failed to decompress _lz envelope (length=' + msg.d.length + ')');
        recordFSBTransportFailure('inbound-decompress-failed', { len: msg.d.length });
        return;
      }
      msg = JSON.parse(decoded);
    }
    this._handleMessage(msg);
  } catch (err) {
    console.warn('[FSB WS] Failed to parse message:', err.message);
  }
};
```

That's the entire library-side change.

**Confidence:** HIGH. Code path inspected; mirrors the dashboard's already-shipping decoder; no new dependency.

---

### (b) Efficient large-DOM truncation in content scripts

**Conclusion: replace the `clone.querySelectorAll('[data-fsb-nid]')` + per-node `getBoundingClientRect()` reverse loop with a TreeWalker over the **original** document that builds an `nid -> {top, bottom}` rect map in one pass, then mutates the clone using that map.**

**Evidence from the codebase:** `content/dom-stream.js:466-489` -- when `html.length > 2 * 1024 * 1024`, the current code does:

```javascript
var allEls = clone.querySelectorAll('[data-fsb-nid]');
for (var t = allEls.length - 1; t >= 0; t--) {
  var nidVal = allEls[t].getAttribute('data-fsb-nid');
  var origByNid = document.querySelector('[data-fsb-nid="' + nidVal + '"]');  // O(n) per call
  if (origByNid) {
    var elRect = origByNid.getBoundingClientRect();                            // forces layout per node
    if (elRect.top > viewportCutoff) {
      allEls[t].parentNode && allEls[t].parentNode.removeChild(allEls[t]);
    }
  }
}
```

That's O(n²) `querySelector` lookups *and* a forced sync layout per node. On a 50k-node page, that's the slow path the milestone is calling out.

**Recommended pattern (no new library):**

```javascript
// Phase 1: walk the original (live) document ONCE to snapshot positions.
const rectByNid = new Map();
const walker = document.createTreeWalker(
  document.body,
  NodeFilter.SHOW_ELEMENT,
  {
    acceptNode(el) {
      return el.hasAttribute && el.hasAttribute('data-fsb-nid')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    }
  }
);
let n;
while ((n = walker.nextNode())) {
  // getBoundingClientRect is unavoidable, but at least we batch reads
  // BEFORE any writes, so the browser only flushes layout once.
  const r = n.getBoundingClientRect();
  rectByNid.set(n.getAttribute('data-fsb-nid'), r.top);
}

// Phase 2: mutate the clone using the cached map. No more layout flushes.
const cloneEls = clone.querySelectorAll('[data-fsb-nid]');
for (let i = cloneEls.length - 1; i >= 0; i--) {
  const top = rectByNid.get(cloneEls[i].getAttribute('data-fsb-nid'));
  if (top !== undefined && top > viewportCutoff) {
    cloneEls[i].parentNode && cloneEls[i].parentNode.removeChild(cloneEls[i]);
  }
}
```

**Why TreeWalker over `querySelectorAll('[data-fsb-nid]')`:**
- TreeWalker is a streaming API; it doesn't allocate the full NodeList up-front. On 50k+ nodes, the NodeList allocation alone is meaningful.
- The filter callback can short-circuit on subtree boundaries with `FILTER_REJECT` if we ever want to skip whole branches (e.g., `data-fsb-skip` markers).
- Benchmarks vary, but for "iterate everything that matches an attribute" TreeWalker is consistently within 5-20% of querySelectorAll-then-loop and avoids the NodeList allocation.

**Why batch-read-then-write:**
- Modern browsers run "layout invalidation" lazily. If you read `getBoundingClientRect()` *after* a write (any DOM mutation), the browser must flush the pending layout *now*. The current code reads a rect, then conditionally removes a node, then reads the next rect -- forcing a sync layout per iteration. Reading all rects first into the Map collapses 50k layout flushes into 1.
- Critical: read from the **live** `document`, not the clone. The clone has no layout box (it's not in the document tree); `getBoundingClientRect()` on it returns all zeros.

**Why not `DocumentFragment`:**
- A DocumentFragment is helpful for bulk *insertion* (avoids reflow on each appendChild). Here we are *removing*, and we want the rect data from the live document, so a DocumentFragment doesn't help.

**Why not structured cloning:**
- `structuredClone()` is for serialization across realms; it doesn't preserve DOM identity and is roughly the same cost as `cloneNode(true)` for a tree of this size. The existing `cloneNode(true)` on the body subtree is the right primitive.

**Integration point:** `content/dom-stream.js`, the truncation block at line 466-489. Replace as above.

**Confidence:** HIGH on the algorithmic approach (DOM perf folklore is consistent here); MEDIUM on exact magnitude of speedup -- it depends on how many `data-fsb-nid` elements the page has. We should measure on a 50k-node fixture before declaring victory.

---

### (c) Mutation queue watchdog patterns (no `requestIdleCallback` in the SW)

**Conclusion: use a two-tier watchdog -- `chrome.alarms` in the service worker for cross-suspension wake-up, plus a `setTimeout`-based monotonic counter in the content script for in-process stuck detection.**

**Why not `requestIdleCallback`:**
- W3C ServiceWorker issue #790 explicitly notes `requestIdleCallback` is **not** exposed in `ServiceWorkerGlobalScope`. Confirmed by MDN.
- Even if it were, the SW would suspend before the idle callback fires reliably (typical SW suspension is 30s).

**Why not `setTimeout` alone in the SW:**
- Any `setTimeout` longer than ~30s is killed by SW eviction. We can't run a 5-minute "queue stuck" check off `setTimeout` in the worker.

**Recommended primitives:**

| Primitive | Where | Job |
|-----------|-------|-----|
| `MutationObserver` (existing) | content script | Enqueue mutation records into the pending buffer (already done). |
| `lastDrainTs` monotonic counter | content script | Updated every time the queue is flushed to the WS bridge. |
| `setTimeout(checkQueue, 5000)` (recursive) | content script | If `now - lastDrainTs > stuckThreshold` AND queue length > 0, log a `mutation-queue-stuck` diagnostic and force-drain. Self-rescheduling, cancelled on tab teardown. |
| `chrome.alarms.create('fsb-stream-watchdog', { periodInMinutes: 1 })` | background.js | Wakes the SW once a minute and pokes each known streaming tab with a `'sw:watchdog-ping'` message. If the tab fails to ack within 2s, mark the stream as suspect and emit `'ext:stream-state'` with `health: 'degraded'`. |
| `staleMutationCounter` reset on snapshot boundary | content script | The milestone explicitly calls out "stale mutation counter reset" -- a counter that increments on every mutation since last snapshot must be zeroed when the next `ext:snapshot` is sent. Currently it's not reset on the snapshot boundary, only on session teardown. |

**Why this layering:**
- The content script can self-detect a stuck queue in real time (5s granularity) without involving the SW. This catches tab-local hangs (the page is alive but the bridge isn't draining).
- The SW alarm catches the worse case: content script is dead or unloaded but the SW thinks the stream is still healthy. Once a minute is enough -- the alarm is the safety net, the content-script timer is the trip wire.
- Both are pure platform primitives; no dependency.

**Caveat on `chrome.alarms`:** the **minimum** period is 30s as of Chrome 117+ and 1 minute on older Chrome versions. We pick 1 minute for compatibility. Alarms also do not fire if Chrome is fully shut down -- that's fine; we don't need to watchdog a closed browser.

**Integration points:**
- `content/dom-stream.js` -- add `lastDrainTs`, `staleMutationCounter`, and the `setTimeout` watchdog. Reset counter at the same point that emits `ext:snapshot` (the existing snapshot path).
- `background.js` -- register `chrome.alarms.create('fsb-stream-watchdog', ...)` near the existing keepalive setup; wire the alarm handler to ping each entry in the existing `_streamingTabId` registry.

**Confidence:** HIGH on primitive choice (these are the only options MV3 gives us). MEDIUM on exact thresholds -- 5s stuck threshold and 1 minute alarm cadence are reasonable defaults but should be tuned from real-world telemetry.

---

### (d) Deprecation-card UI in the options page (vanilla DOM, no framework)

**Conclusion: a single new `<section data-section="background-agents">` in `ui/control_panel.html` containing a deprecation card composed of plain HTML + CSS, with copy injected by `ui/options.js`. No framework, no template engine.**

**Evidence from the codebase:** `ui/control_panel.html:54-86` already declares the navigation pattern:

```html
<li class="nav-item active" data-section="dashboard">...</li>
<li class="nav-item" data-section="api-config">...</li>
<li class="nav-item" data-section="background-agents">...</li>   <!-- THIS becomes the deprecation card host -->
<li class="nav-item" data-section="passwords">...</li>
...
```

The mechanism is already there: clicking a `nav-item` toggles visibility on the matching `<section data-section="X">`. We do **not** add a router, a state library, or a templating layer -- we simply replace the *content* of the `background-agents` section with a card.

**The new top-level "Sync" tab follows the identical pattern:**

```html
<li class="nav-item" data-section="sync">
  <i class="fas fa-mobile-screen"></i>
  Sync
</li>
```

paired with `<section data-section="sync">` containing the QR pairing UI (relocated from popup) and the remote-control state panel (relocated from wherever Phase 209 placed it).

**Card pattern (vanilla):**

```html
<section data-section="background-agents" class="content-section">
  <div class="deprecation-card">
    <div class="deprecation-card__header">
      <i class="fas fa-flag-checkered"></i>
      <h2>Background agents have left the building</h2>
    </div>
    <p class="deprecation-card__lede">
      We're not reinventing this wheel. <strong>OpenClaw</strong> and
      <strong>Claude Routines</strong> already nail scheduled, headless
      agent runs -- so FSB is bowing out of the agent business and going
      back to what it does best: real-time, in-tab automation you can watch.
    </p>
    <div class="deprecation-card__cta">
      <a class="btn btn-primary" href="https://openclaw.dev" target="_blank" rel="noopener">
        Try OpenClaw
      </a>
      <a class="btn btn-secondary" href="https://claude.ai/routines" target="_blank" rel="noopener">
        Try Claude Routines
      </a>
    </div>
    <details class="deprecation-card__why">
      <summary>What happened to my saved agents?</summary>
      <p>Your agent configs are still on disk and not deleted. If you
      ever need to revive them, the code paths are commented out, not
      removed. Open an issue and we'll point you at the right spot.</p>
    </details>
  </div>
</section>
```

**Styling:** add a `deprecation-card` block to the existing `ui/options.css`. No design tokens to pull in -- the control panel already has dark/light theme tokens via `shared/fsb-ui-core.css`.

**Tone (per milestone): playful/witty.** Sample copy bank:
- Header: "Background agents have left the building"
- Lede: "We're not reinventing this wheel."
- Sub: "FSB is bowing out of the agent business and going back to what it does best."
- Mirror in showcase: same headline, same two CTAs, dark/light parity.

**Why not React / Vue / Lit / Web Components:**
- Adding any framework forces a build system. Project constraint forbids that.
- The card is 30 lines of HTML and ~50 lines of CSS. A framework is two orders of magnitude more setup than the feature.
- Web Components without a framework are technically possible but awkward without a templating helper. The existing UI is `document.createElement` + `innerHTML` (sanitized via `purify.min.js` already in `lib/`); we stay consistent.

**Showcase mirror:** the Angular showcase already has a `pages/about` and `pages/dashboard` component pattern. The deprecation copy lands as a new Angular component (e.g., `pages/agents-sunset/agents-sunset.component.ts`) following the existing component conventions. **No new dependency on the showcase side either** -- Angular 19 standalone components, signals, and the existing router are sufficient.

**Integration points:**
- `ui/control_panel.html` -- (i) add `<li data-section="sync">` to the nav, (ii) replace existing `<section data-section="background-agents">` with deprecation card markup, (iii) add new `<section data-section="sync">` for the consolidated Sync tab.
- `ui/options.js` -- (i) wire the Sync tab activation to call into the existing QR pairing controller (Phase 210) and the remote-control state controller (Phase 209), (ii) remove the QR pairing wiring from its old home (popup), (iii) no JS changes for the deprecation card -- it's static markup.
- `ui/options.css` -- new `.deprecation-card` rules.
- `showcase/angular/src/app/pages/agents-sunset/` -- new component matching existing page conventions; routed via existing `app.routes.ts`.
- `showcase/angular/src/app/pages/dashboard/` -- update copy/nav to point at the new agents-sunset page and at the consolidated Sync surface.

**Confidence:** HIGH. This is exactly how the rest of the control panel is built; we are extending an existing pattern.

---

### (e) Showcase / Angular dashboard

**Conclusion: pin Angular 19.0.x. Do not upgrade in this milestone.**

**Evidence:**
- `showcase/angular/package.json` shows `@angular/* ^19.0.0`, `rxjs ~7.8.0`, `zone.js ~0.15.0`, `typescript ~5.6.0`. Angular 19 went LTS on 2025-05-19 and exits LTS on **2026-05-19** (~3 weeks after this milestone target).
- The milestone scope is **content + nav** changes on the showcase (mirroring agent-sunset messaging, pointing at the new Sync surface). It is **not** an Angular upgrade milestone.
- An Angular 19 -> 20 upgrade involves changes to the build pipeline (`@angular/build` 20), router APIs, and signal-component conventions. That is its own milestone.

**Recommendation:** add `engines` constraint to `showcase/angular/package.json` if not already present, but do not change the dependency line ranges. Schedule "Angular 19 -> 20 migration" as a separate milestone before 2026-05-19 to avoid running on an EOL framework.

**Showcase-only library additions for this milestone:** none. The agent-sunset page and the Sync-surface copy update are pure Angular component + template work using the existing toolchain.

**Confidence:** HIGH on "no upgrade now." MEDIUM on Angular 19's exact EOL date -- the search result was consistent across multiple sources (HeroDevs, endoflife.date, angular.dev) but worth confirming with `https://angular.dev/reference/releases` before tagging release notes.

---

### (f) Silent error swallowing replacement (cross-cutting, not really stack)

This is not a library decision but the milestone explicitly groups it. **No new dependency.** The pattern is the v0.9.40-established replacement of `.catch(() => {})` with `.catch((err) => console.warn('[FSB ...] context:', err && err.message ? err.message : err))`.

Files most likely affected (based on grep): `ui/sidepanel.js`, `background.js`, `mcp-server/src/tools/autopilot.ts`, `ws/mcp-bridge-client.js`, `mcp-server/src/http.ts`, `utils/site-explorer.js`, `mcp-server/src/tools/agents.ts` (likely commented out anyway as part of the agent sunset), `lib/memory/memory-manager.js`, `content/lifecycle.js`, `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts`. The phase scope is "dialog relay and message delivery" -- so the priority targets are the WS/runtime message paths, not memory or autopilot.

**Confidence:** HIGH (mechanical refactor, established pattern from v0.9.40).

---

## Installation / dependency changes

**Extension (`package.json`):** none. `axios` 1.6.x stays. No new `dependencies`. No new `devDependencies`.

**Showcase (`showcase/angular/package.json`):** none. Pin remains at `^19.0.0`.

**Vendored libs in `lib/` and `ui/lib/`:** none. `lz-string.min.js` 1.5.0 stays. `qrcode-generator.min.js` 2.0.4 stays.

```bash
# Nothing to install. The milestone is zero-dependency.
```

---

## Alternatives considered (and why rejected)

| Need | Recommended | Alternative considered | Why we rejected the alternative |
|------|-------------|------------------------|---------------------------------|
| Inbound WS decompression | Existing `LZString.decompressFromBase64` | `DecompressionStream("deflate-raw")` (native, MV3-supported) | lz-string is not RFC 1951; would require swapping outbound to native CompressionStream and a feature-flag handshake. Multi-phase migration. |
| Inbound WS decompression | Existing `LZString.decompressFromBase64` | `pako` (zlib in JS) | Doesn't decode lz-string output. Would mean two compression libs co-existing. |
| Inbound WS decompression | Existing `LZString.decompressFromBase64` | Switch entire transport to per-message-deflate at the ws:// layer | Browser `WebSocket` API does not expose per-message-deflate negotiation; it's transparent if the server negotiates it. Our relay is a passthrough; turning it on would require server changes and would be redundant with our app-layer compression. |
| Large-DOM truncation | TreeWalker + cached rect map | Keep current `querySelectorAll` reverse loop | Already shown to be slow on 50k-node pages -- that's the bug the milestone is fixing. |
| Large-DOM truncation | TreeWalker + cached rect map | `IntersectionObserver` to pre-tag off-viewport nodes | Adds an observer that runs continuously even when no truncation is happening. The truncation path runs on a 2 MB threshold; observer cost would dominate. |
| Mutation queue watchdog | `chrome.alarms` + content-script `setTimeout` | `requestIdleCallback` shim/polyfill | Not available in SW; polyfills in worker contexts are misleading. |
| Mutation queue watchdog | `chrome.alarms` + content-script `setTimeout` | Web Locks API for stuck-detection | Web Locks expire only on tab close, not on a "queue stuck" semantic. Wrong primitive. |
| Deprecation card UI | Vanilla DOM in existing `data-section` pattern | Lit web component | Requires either a build step or a runtime template helper; benefit is zero for a single card. |
| Deprecation card UI | Vanilla DOM in existing `data-section` pattern | `htm` + `preact` (no-build React-alike) | Adds 12 KB and a new mental model; the card has no state or props worth abstracting. |

---

## Version compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| `lz-string@1.5.0` | extension SW (`importScripts`), dashboard (script tag), Angular showcase (script tag in `index.html`) | All three already load this exact version. |
| `qrcode-generator@2.0.4` | options page only | Already loaded at `ui/lib/qrcode-generator.min.js`. |
| `@angular/*@^19.0.0` | `rxjs@~7.8.0`, `zone.js@~0.15.0`, `typescript@~5.6.0` | Locked combo from `showcase/angular/package.json`. **Do not bump in this milestone.** |
| Chrome MV3 service worker | `chrome.alarms` (period >= 30s on Chrome 117+, >= 1m on older), `DecompressionStream` (Chrome 80+, deflate-raw on Chrome 103+), no `requestIdleCallback` | All recommendations stay within these constraints. |

---

## Sources

- `ws/ws-client.js:515-522, 580-593` (FSB repo) -- the asymmetry root cause; HIGH confidence (direct code).
- `showcase/js/dashboard.js:3516-3528` (FSB repo) -- the dashboard's already-validated decompression path; HIGH confidence (direct code).
- `server/src/ws/handler.js:175-203` (FSB repo) -- relay confirmed passthrough, no compression; HIGH confidence.
- `content/dom-stream.js:466-489` (FSB repo) -- the slow truncation block; HIGH confidence.
- `background.js:37` (FSB repo) -- confirms `lz-string.min.js` already loaded into the service worker; HIGH confidence.
- `ui/control_panel.html:50-86` (FSB repo) -- canonical `data-section` nav pattern; HIGH confidence.
- `showcase/angular/package.json` (FSB repo) -- Angular 19 pin; HIGH confidence.
- W3C ServiceWorker issue #790 ("requestIdleCallback (equivalent) for ServiceWorkerGlobalScope") -- HIGH confidence on absence in SW.
- MDN, "Window: requestIdleCallback() method" -- HIGH confidence on Window-only availability.
- MDN, "DecompressionStream" -- HIGH confidence on availability in workers; MEDIUM on whether it's officially listed for `ServiceWorkerGlobalScope` (MDN excerpt mentioned Web Workers explicitly, did not enumerate SW; chromium.org and web.dev cross-confirm SW availability).
- web.dev / Chrome for Developers blog, "Compression and decompression in the browser with the Compression Streams API" -- HIGH confidence on `deflate-raw` Chrome 103+ availability.
- npm registry, `lz-string` page -- HIGH confidence: latest 1.5.0, no churn.
- npm registry, `qrcode-generator` page -- HIGH confidence: latest 2.0.4.
- angular.dev releases page + endoflife.date -- HIGH confidence Angular 19 EOL 2026-05-19.
- MeasureThat.net benchmarks, "TreeWalker vs querySelectorAll" -- MEDIUM confidence (microbenchmarks vary by harness; the *direction* of the performance argument -- batch reads before writes -- is web-perf folklore confirmed across multiple sources).

---

*Stack research for: FSB v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability*
*Researched: 2026-04-28*
