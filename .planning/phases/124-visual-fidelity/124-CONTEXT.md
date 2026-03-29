# Phase 124: Visual Fidelity - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The cloned preview renders with high fidelity -- images load from CDN, embedded iframes (YouTube, Vimeo, etc.) play live, CSS animations preserved, and mutations arrive smoothly via rAF batching. The core insight: we stream DOM text, the dashboard's iframe fetches all resources from the web directly.

</domain>

<decisions>
## Implementation Decisions

### Resource loading strategy
- **We stream text, dashboard renders everything** -- images, videos, stylesheets, fonts all load from their original CDN URLs in the dashboard iframe. No pixel streaming needed.
- Images: already handled by `absolutifyUrl()` on src/srcset attributes
- Videos: `<video>` elements with src/source tags already absolutified
- Fonts: loaded via external stylesheets (already collected) and inline @font-face rules (captured in 123.1)

### Iframe embeds
- **Render ALL embedded iframes** -- instead of replacing with gray placeholders, pass through the iframe with its absolute src URL. YouTube, Vimeo, Spotify, Google Maps, etc. all render live in the preview.
- Remove the `createIframePlaceholder` replacement logic in `serializeDOM()`
- Keep `sandbox="allow-same-origin"` on the outer preview iframe -- embedded iframes inside it inherit sandboxing but can still load content
- Security: the preview iframe already has `pointer-events: none` so users can't interact with embedded content

### CSS animations
- **Preserved via inline style tags** -- Phase 123.1 already collects `<style>` tags from document.head which contain @keyframes and transition rules
- No additional work needed for CSS animations -- they play automatically in the clone
- Class-change-triggered animations (e.g., `.active` toggle) are handled by mutation streaming which adds/removes classes

### Mutation batching
- **Switch from 150ms setTimeout to requestAnimationFrame** -- smoother display-matched updates
- In `content/dom-stream.js` `startMutationStream()`, replace `setTimeout(flushMutations, 150)` with `requestAnimationFrame(flushMutations)`
- This syncs mutation delivery to the browser's paint cycle for jank-free updates

### Claude's Discretion
- Whether to add `loading="lazy"` to images in the clone (performance vs fidelity tradeoff)
- How to handle iframes that fail to load (leave broken or show fallback)
- Whether to limit embedded iframe count (e.g., max 5 live iframes) for performance

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DOM serializer
- `content/dom-stream.js` -- `serializeDOM()` (line 168): clone body, URL absolutification, computed style capture, iframe placeholder logic (lines 224-230 -- REMOVE THIS), stylesheet collection, inline style collection
- `content/dom-stream.js` -- `startMutationStream()` (line ~500): MutationObserver with 150ms setTimeout debounce -- change to rAF
- `content/dom-stream.js` -- `captureComputedStyles()` (line 118): now captures ALL elements with 48+ CSS properties

### Dashboard renderer
- `showcase/js/dashboard.js` -- `handleDOMSnapshot()` (line 1640): builds iframe HTML with stylesheets + inline styles
- `showcase/dashboard.html` -- Preview iframe has `sandbox="allow-same-origin"` (line 214)

</canonical_refs>

<code_context>
## Existing Code Insights

### Key change: iframe handling
Current code (dom-stream.js lines 224-230):
```javascript
if (tag === 'iframe') {
  var placeholder = createIframePlaceholder(clone.ownerDocument || document);
  if (cl.parentNode) {
    cl.parentNode.replaceChild(placeholder, cl);
  }
  continue;
}
```
This needs to change to: absolutify the iframe src and keep it, instead of replacing with placeholder.

### Key change: mutation batching
Current code uses `setTimeout(flushMutations, 150)` in the MutationObserver callback. Replace with `requestAnimationFrame(flushMutations)`.

</code_context>

<specifics>
## Specific Ideas

- The preview should feel like watching a screen recording -- videos play, images load, animations run
- The "low bandwidth, high fidelity" principle: stream minimal text data, let the browser do the heavy lifting

</specifics>

<deferred>
## Deferred Ideas

- Native dialog interception (alert/confirm/prompt) -- complex, requires page script injection
- Shadow DOM content serialization -- out of scope for now
- Canvas element mirroring via toDataURL periodic snapshots -- Phase 115 handles this differently

</deferred>

---

*Phase: 124-visual-fidelity*
*Context gathered: 2026-03-29*
