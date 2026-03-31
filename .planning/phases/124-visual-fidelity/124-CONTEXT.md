# Phase 124: Visual Fidelity - Context

**Gathered:** 2026-03-29
**Updated:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

The cloned preview is a pixel-accurate mirror of the real browser -- dialogs (including native alert/confirm/prompt), CSS animations, computed styles, and embedded iframes all render correctly. DOM mutations arrive smoothly via rAF batching. The preview captures ALL computed style properties for maximum fidelity.

</domain>

<decisions>
## Implementation Decisions

### Dialog/modal mirroring (FIDELITY-01)
- **D-01:** Full interception -- intercept window.alert, window.confirm, window.prompt via content script page injection. Relay dialog type + message text to dashboard via WS message (e.g., `ext:dom-dialog`). Dashboard renders as styled card overlay on the preview.
- **D-02:** CSS-based modal overlays (Bootstrap, Material, custom) already work automatically via mutation streaming + computed style capture. No additional work needed for those.
- **D-03:** Implementation approach for native dialog interception: inject a page-level script (via `<script>` element from content script) that monkey-patches `window.alert`, `window.confirm`, `window.prompt`. The patch calls the original function but also fires a `CustomEvent` that the content script listens for and relays via `chrome.runtime.sendMessage`.

### Iframe embed strategy
- **D-04:** Render ALL embedded iframes live -- remove `createIframePlaceholder` replacement logic in `serializeDOM()`. Absolutify iframe src URL and let iframes load live in preview. YouTube, Vimeo, Spotify, Google Maps etc. all render.
- **D-05:** Security maintained: preview iframe has `pointer-events: none` so users can't interact with embedded content.

### Mutation batching (FIDELITY-03)
- **D-06:** Switch from 150ms setTimeout to requestAnimationFrame -- replace `setTimeout(flushMutations, 150)` with `requestAnimationFrame(flushMutations)` in `startMutationStream()`. Syncs mutation delivery to browser paint cycle for jank-free updates.

### Computed styles (FIDELITY-04)
- **D-07:** Capture ALL computed style properties -- instead of a curated list of 66 properties, use `getComputedStyle(element)` and iterate all properties. Maximum fidelity, accepting larger payloads.
- **D-08:** Optimization: still skip properties that match browser defaults (the existing STYLE_DEFAULTS pattern) to reduce payload. Only include properties with non-default values.
- Phase 123.1 already removed the skip guard so ALL visible elements get styles. This builds on that.

### Claude's Discretion
- Whether to add `loading="lazy"` to images in the clone (performance vs fidelity tradeoff)
- How to handle iframes that fail to load (leave broken or show fallback)
- Whether to limit embedded iframe count (e.g., max 5 live iframes) for performance
- Dialog card styling in dashboard (color, positioning, animation)
- Whether to batch all computed properties in a single inline style string or use a more compact diff format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DOM serializer
- `content/dom-stream.js` -- `serializeDOM()` (line ~168): clone body, URL absolutification, computed style capture, iframe placeholder logic (lines 243-248 -- REMOVE THIS), stylesheet/inline-style collection
- `content/dom-stream.js` -- `startMutationStream()` (line ~490): MutationObserver with `setTimeout(flushMutations, 150)` at line 534 -- change to rAF
- `content/dom-stream.js` -- `captureComputedStyles()` (line ~140): currently captures 66 CSS properties with STYLE_PROPS/STYLE_PROP_CSS arrays -- replace with full computed style iteration
- `content/dom-stream.js` -- `STYLE_PROPS` (line 22) and `STYLE_PROP_CSS` (line 58) and `STYLE_DEFAULTS` (line 94) -- may be refactored or expanded

### Dashboard renderer
- `showcase/js/dashboard.js` -- `handleDOMSnapshot()` (line ~1640): builds iframe HTML with stylesheets + inline styles
- `showcase/js/dashboard.js` -- `handleDOMMutations()` (line ~1725): applies nid-based mutations
- `showcase/dashboard.html` -- Preview iframe has `sandbox="allow-same-origin"` (line ~214)

### WS message protocol
- `background.js` lines 5833-5851 -- DOM stream message forwarding (domStreamSnapshot/Mutations/Scroll/Overlay -> ext:dom-*)
- `ws/ws-client.js` -- `_handleMessage` switch for `dash:dom-stream-*` messages

### Prior phase context
- `.planning/phases/123.1-stream-fidelity-fix/123.1-01-SUMMARY.md` -- skip guard removal, 66 CSS properties, inline style tag collection
- `.planning/phases/122-connection-auto-start/122-CONTEXT.md` -- WS message protocol, stream lifecycle

</canonical_refs>

<code_context>
## Existing Code Insights

### Key change: iframe handling
Current code (dom-stream.js lines 243-248):
```javascript
if (tag === 'iframe') {
  var placeholder = createIframePlaceholder(clone.ownerDocument || document);
  if (cl.parentNode) {
    cl.parentNode.replaceChild(placeholder, cl);
  }
  continue;
}
```
Remove this block and instead absolutify the iframe src. Also remove `createIframePlaceholder` function (lines 165-178).

### Key change: mutation batching
Current code line 534: `batchTimer = setTimeout(flushMutations, 150);`
Replace with: `batchTimer = requestAnimationFrame(flushMutations);`
Also update the clear call from `clearTimeout(batchTimer)` to `cancelAnimationFrame(batchTimer)`.

### Key change: computed styles
Current approach: curated STYLE_PROPS array (66 entries) with matching STYLE_PROP_CSS kebab-case array.
New approach: iterate `getComputedStyle(element)` for all properties, skip defaults via STYLE_DEFAULTS comparison.

### New: dialog interception
No existing code for this. Needs:
1. Page-level script injection from content script
2. Monkey-patch window.alert/confirm/prompt
3. CustomEvent bridge from page context to content script
4. Content script relays to background.js via chrome.runtime.sendMessage
5. Background.js forwards as `ext:dom-dialog` WS message
6. Dashboard renders dialog card on preview

</code_context>

<specifics>
## Specific Ideas

- The preview should feel like watching a screen recording -- videos play, images load, animations run, dialogs pop up
- The "low bandwidth, high fidelity" principle: stream minimal text data, let the browser do the heavy lifting
- ALL computed styles means the payload grows significantly -- but the user chose maximum fidelity over optimization
- Dialog interception via monkey-patching is the standard Chrome extension technique for this

</specifics>

<deferred>
## Deferred Ideas

- Shadow DOM content serialization -- out of scope for now
- Canvas element mirroring via toDataURL periodic snapshots -- Phase 115 handles this differently
- Dialog button interaction from dashboard (clicking OK/Cancel on mirrored dialog) -- belongs in Phase 125 Remote Control

</deferred>

---

*Phase: 124-visual-fidelity*
*Context gathered: 2026-03-29, updated: 2026-03-30*
