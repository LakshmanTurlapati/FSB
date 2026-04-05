# Phase 115: Canvas Vision - Research

**Researched:** 2026-03-24
**Domain:** HTML5 Canvas element content extraction in Chrome Extension context
**Confidence:** HIGH

## Summary

HTML5 canvas elements are opaque pixel buffers -- FSB's DOM analysis sees a single `<canvas>` element with no children. When a user draws shapes, text, and arrows on Excalidraw (or any canvas-based app), FSB is blind to the content. This research exhaustively catalogs every possible approach to extract structured information from canvas elements, evaluated against Chrome Extension constraints (isolated world, no server-side processing, existing CDP infrastructure).

The research identified **19 distinct approaches** across four categories: application-state extraction (reading the app's own data structures), visual capture (screenshots/pixels sent to AI), API interception (monkey-patching drawing calls), and indirect inference (accessibility trees, clipboard, DOM proxies). The approaches range from trivially simple (localStorage read) to deeply complex (canvas API interception via injected script).

**Primary recommendation:** Implement a **tiered strategy** combining three approaches for maximum coverage:

1. **Tier 1 (Excalidraw-specific, HIGH value):** Read localStorage key `"excalidraw"` from content script -- zero-cost, instant, returns full element JSON with positions/types/text/colors. Works today with no new code beyond `JSON.parse(localStorage.getItem('excalidraw'))`.

2. **Tier 2 (Excalidraw-specific, MEDIUM value):** CDP `Runtime.evaluate` to call `document.querySelector('.excalidraw').__reactFiber$...` fiber traversal or `chrome.scripting.executeScript({world: "MAIN"})` to access React component state for real-time scene data (not debounced like localStorage).

3. **Tier 3 (Universal fallback):** CDP `Page.captureScreenshot` with `clip` parameter to capture the canvas region, convert to base64 PNG, and include in AI prompt as a vision input. Works for ANY canvas app. Token cost ~765-1105 tokens per screenshot.

---

## Approach Catalog: All 19 Approaches

### Approach A: CDP Runtime.evaluate (Page Context JavaScript Execution)

**How it works:** The background service worker uses `chrome.debugger.sendCommand(tabId, 'Runtime.evaluate', { expression: '...' })` to execute arbitrary JavaScript in the PAGE context (not the isolated world). This bypasses the content script isolation entirely. The expression runs with full access to `window`, all page variables, the React tree, localStorage, IndexedDB, and every page-level API.

**Feasibility in Chrome Extension:** YES -- HIGH. FSB already uses `chrome.debugger` extensively (see `executeCDPToolDirect` in background.js). Adding `Runtime.evaluate` calls follows the same attach/sendCommand/detach pattern. No new permissions needed beyond the existing `debugger` permission.

**Performance:** Fast -- single CDP round-trip, ~5-20ms for simple expressions. Returns serialized JSON. No screenshot overhead, no AI vision tokens.

**What it can extract:**
- Any JavaScript expression result from the page context
- `localStorage.getItem('excalidraw')` -- full scene elements as JSON
- React fiber tree traversal for real-time state
- `document.querySelector('canvas').toDataURL()` -- canvas as base64 PNG
- Any page-level API the site exposes

**Which apps it works with:** Universal -- works on any page. The expression itself determines app-specificity.

**Code complexity:** LOW. ~15 lines added to background.js following existing CDP patterns.

**Limitations:**
- Requires debugger attachment (shows "Extension is debugging this tab" banner unless user dismisses)
- Expression must be a string (no closures, no extension-local variable access)
- Return value must be JSON-serializable
- If the page has CSP restrictions, some operations may be blocked (but Runtime.evaluate bypasses CSP for script execution)

**Confidence:** HIGH -- CDP Runtime.evaluate is a well-documented, stable protocol method.

---

### Approach B: Excalidraw-Specific API via Runtime.evaluate

**How it works:** Execute `Runtime.evaluate` with an expression that accesses Excalidraw's internal state. The production excalidraw.com does NOT expose `window.excalidrawAPI` as a global variable (verified: the API is stored in React component state via `useExcalidrawAPI()` hook, never assigned to `window`). However, the React fiber tree IS accessible from any DOM element.

**Access path:** `document.querySelector('.excalidraw').__reactFiber$<hash>.return.return...memoizedState` -- traversing the fiber tree from a known DOM element to find the component that holds the scene state.

**Feasibility:** MEDIUM. The fiber traversal works but the property name includes a hash suffix (`__reactFiber$abc123`) that changes per build. Need to discover it dynamically: `Object.keys(element).find(k => k.startsWith('__reactFiber$'))`.

**Performance:** Fast -- ~10-30ms. Returns structured JSON.

**What it can extract:**
- `getSceneElements()` equivalent: array of all elements with type, x, y, width, height, text, strokeColor, backgroundColor, points (for arrows/lines), boundElements, groupIds
- `getAppState()`: current tool, selected elements, zoom level, scroll position
- Real-time state (not debounced like localStorage)

**Data format (verified from Excalidraw JSON schema docs):**
```json
{
  "id": "abc123",
  "type": "rectangle",
  "x": 200, "y": 300,
  "width": 150, "height": 80,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "opacity": 100,
  "angle": 0,
  "text": "",
  "boundElements": [{"id": "arrow1", "type": "arrow"}],
  "groupIds": []
}
```

**Which apps:** Excalidraw only (excalidraw.com, self-hosted instances, Obsidian Excalidraw plugin).

**Code complexity:** MEDIUM. Need dynamic fiber key discovery and careful tree traversal.

**Limitations:**
- React fiber structure is internal and not guaranteed stable across React versions
- Hash suffix in `__reactFiber$` changes per build/deploy
- Fiber tree depth to scene state may vary between Excalidraw versions
- Slower to maintain than localStorage approach

**Confidence:** MEDIUM -- React fiber access is a known technique but fragile.

---

### Approach C: Canvas toDataURL via Runtime.evaluate

**How it works:** Execute `Runtime.evaluate({ expression: "document.querySelector('canvas.interactive').toDataURL('image/png')" })` to get the canvas pixel content as a base64-encoded PNG data URL.

**Feasibility:** YES -- HIGH. `toDataURL()` is a standard Canvas API. Works from Runtime.evaluate in page context.

**Performance:**
- Execution: ~20-100ms depending on canvas size
- Data size: A 1920x1080 canvas produces ~200KB-2MB base64 string
- Token cost if sent to vision AI: ~765-1105 tokens (high detail mode)
- Dollar cost: ~$0.002-0.01 per screenshot at GPT-4o rates

**What it can extract:** Raw pixel image -- shapes, text, colors, arrows are ALL visible but only as pixels. No structured data (no element types, no coordinates, no text content as strings). Requires multimodal AI to interpret.

**Which apps:** Universal -- works on ANY canvas element on ANY page.

**Code complexity:** LOW -- single CDP call returns base64 string.

**Limitations:**
- CORS: If the canvas has drawn cross-origin images without CORS, `toDataURL()` throws a SecurityError ("tainted canvas"). This does NOT apply to Excalidraw (all drawing is local).
- No structured data -- AI must interpret pixels, which is lossy and expensive
- Cannot extract precise coordinates, connection relationships, or hidden properties
- Large canvases produce large base64 strings that bloat CDP message size

**Confidence:** HIGH -- standard API, well-tested.

---

### Approach D: CDP Page.captureScreenshot with Clip

**How it works:** Use `chrome.debugger.sendCommand(tabId, 'Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 } })` to capture a specific rectangular region of the page. The clip coordinates can target the canvas element's bounding rect.

**Feasibility:** YES -- HIGH. FSB already has debugger permission. Page.captureScreenshot is a stable CDP method.

**Performance:**
- Execution: ~50-200ms (viewport capture + PNG encoding)
- Data size: Similar to toDataURL, ~200KB-2MB base64
- Token cost: Same as Approach C (~765-1105 vision tokens)

**What it can extract:** Same as Approach C -- pixel-level visual representation. Advantage over toDataURL: works even if the canvas is "tainted" by cross-origin content, because the screenshot is taken at the compositor level, not the canvas API level.

**Which apps:** Universal -- works on ANY visual content, not just canvas. Could capture SVG-based drawing apps, PDF viewers, WebGL content, anything visible on screen.

**Code complexity:** LOW-MEDIUM. Need to determine canvas bounding rect first (via `DOM.getBoxModel` or content script measurement), then issue screenshot.

**Limitations:**
- Canvas must be in viewport (or use `captureBeyondViewport: true`)
- Only captures what is currently visible (scrolled/panned content may be cut off)
- No structured data -- same AI interpretation requirement as Approach C
- Screenshot includes any overlapping UI elements (toolbars, menus) unless clipped precisely

**Confidence:** HIGH -- well-documented CDP method.

---

### Approach E: Canvas getImageData via Runtime.evaluate

**How it works:** Execute `Runtime.evaluate` with expression: `document.querySelector('canvas').getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data`. Returns raw RGBA pixel array.

**Feasibility:** YES technically, but IMPRACTICAL. A 1920x1080 canvas produces 8,294,400 bytes (1920 * 1080 * 4 RGBA channels). This is too large to return via CDP as a JSON-serialized array.

**Performance:** POOR. Serializing millions of integers is extremely slow (seconds). Memory cost is enormous.

**What it can extract:** Raw pixel data -- could theoretically do local edge detection, color analysis, or OCR with tesseract.js. But the data volume makes this impractical for real-time use.

**Which apps:** Universal (same CORS restriction as toDataURL).

**Code complexity:** HIGH -- need to process raw pixels, implement image analysis algorithms.

**Limitations:**
- Massive data transfer overhead
- Raw pixels are useless without image processing
- Local OCR (tesseract.js) adds ~2MB dependency and 2-10 seconds processing time
- Edge detection requires custom computer vision code
- Far inferior to sending a PNG to vision AI

**Confidence:** HIGH that it technically works, LOW that it's practical.

---

### Approach F: Accessibility Layer (ARIA / Screen Reader)

**How it works:** Check if canvas-based apps expose ARIA attributes, aria-label, or offscreen accessible elements for screen readers. Use CDP `Accessibility.getFullAXTree` to get the accessibility tree.

**Feasibility for Excalidraw:** POOR. A Deque accessibility audit (GitHub issue #7492) found that Excalidraw elements "lack inner text visible to screen readers" and have "aria-label attributes that don't exist or are empty." Excalidraw's canvas content is NOT represented in the accessibility tree.

**Performance:** Fast (~50-100ms for `Accessibility.getFullAXTree`).

**What it can extract:** Toolbar buttons, menu items, dialog text -- but NOT canvas-drawn shapes, text, or connections. The drawn content is invisible to the accessibility tree.

**Which apps:** Only apps that implement canvas accessibility (rare). AG Grid uses proxy HTML elements over canvas for accessibility. Most drawing apps (Excalidraw, Figma, draw.io) do NOT.

**Code complexity:** LOW to query, but useless for the primary goal.

**Limitations:**
- Excalidraw does not expose canvas content to accessibility tree
- Most canvas drawing apps have the same gap
- Accessibility tree shows UI chrome, not canvas content

**Confidence:** HIGH that it does NOT work for canvas content extraction.

---

### Approach G: Canvas Hit Testing via CDP Mouse Probing

**How it works:** Systematically dispatch CDP mouse events at grid positions across the canvas and observe changes in cursor style, hover state, or DOM mutations to detect where elements exist. Excalidraw changes cursor to 'move' when hovering over a shape.

**Feasibility:** POSSIBLE but extremely slow and imprecise.

**Performance:** TERRIBLE. To probe a 1920x1080 canvas at 10px intervals: 192 * 108 = 20,736 CDP mouse events. At ~5ms each = ~100 seconds. Even at 50px intervals: ~2,000 events = ~10 seconds.

**What it can extract:** Element boundaries (approximate), but NOT element types, text content, colors, or connections. Only detects "something is here" vs "nothing is here."

**Which apps:** Only apps that change cursor on hover. Universal in principle, but practically useless.

**Code complexity:** HIGH -- need grid scanning, cursor detection, boundary reconstruction.

**Limitations:**
- Extremely slow
- Cannot extract text, colors, types, or connections
- Only detects element presence, not properties
- Overlapping elements confuse detection
- Cursor change detection requires additional CDP calls per probe point

**Confidence:** HIGH that it technically works, but NOT recommended.

---

### Approach H: Application State from localStorage

**How it works:** Content scripts share the same origin as the host page and CAN directly access `window.localStorage`. Excalidraw stores its scene data in localStorage under two keys:
- `"excalidraw"`: JSON array of all element objects (shapes, text, arrows, lines)
- `"excalidraw-state"`: JSON object with appState (selected tool, zoom, scroll position)

The content script simply calls `JSON.parse(localStorage.getItem('excalidraw'))` to get the full scene.

**Feasibility:** YES -- HIGH. This is the simplest possible approach. Content scripts CAN read localStorage because they share the host page's origin. Verified: Chrome documentation confirms content scripts share storage with the host page. Note: may not work if "Block third-party cookies and data" is enabled in Chrome settings.

**Performance:** EXCELLENT. ~1-2ms to read and parse. Zero network calls, zero CDP overhead, zero AI tokens.

**What it can extract:** EVERYTHING that Excalidraw knows about its scene:
- Element types (rectangle, ellipse, diamond, line, arrow, text, freedraw, frame)
- Positions (x, y, width, height) for each element
- Text content (on text elements and bound text)
- Colors (strokeColor, backgroundColor)
- Styles (strokeWidth, strokeStyle, fillStyle, opacity, roughness)
- Connections (boundElements array linking arrows to shapes)
- Groups (groupIds)
- Layer ordering (implicit from array order)
- Font properties (fontSize, fontFamily, textAlign)
- Arrow points (array of [x, y] pairs for multi-point arrows)
- Locked/deleted status

**Data format example (from Excalidraw JSON schema):**
```json
[
  {
    "id": "rect1",
    "type": "rectangle",
    "x": 200, "y": 200,
    "width": 150, "height": 80,
    "strokeColor": "#1e1e1e",
    "backgroundColor": "#a5d8ff",
    "boundElements": [{"id": "arrow1", "type": "arrow"}],
    "text": ""
  },
  {
    "id": "text1",
    "type": "text",
    "x": 220, "y": 225,
    "text": "Start",
    "fontSize": 20,
    "fontFamily": 1,
    "containerId": "rect1"
  },
  {
    "id": "arrow1",
    "type": "arrow",
    "x": 275, "y": 280,
    "points": [[0, 0], [0, 100]],
    "startBinding": {"elementId": "rect1"},
    "endBinding": {"elementId": "rect2"}
  }
]
```

**Which apps:** Excalidraw only. Other canvas apps store state differently:
- **draw.io/diagrams.net:** Uses XML format, stores in localStorage or URL hash
- **Figma:** Server-side state, not in localStorage
- **Canva:** Server-side
- **TLDraw:** Uses localStorage with different key names

**Code complexity:** TRIVIAL. ~5 lines of code in content script.

**Limitations:**
- localStorage is updated on a 500ms debounce (not truly real-time)
- May not work with "Block third-party cookies" Chrome setting
- Excalidraw-specific (different apps use different storage keys/formats)
- localStorage has a ~5-10MB quota; very large drawings may cause storage errors
- Deleted elements may still be in localStorage briefly

**Confidence:** HIGH -- verified from Excalidraw source code and documentation.

---

### Approach I: React Fiber Tree Traversal via Runtime.evaluate

**How it works:** Use CDP `Runtime.evaluate` to access React's internal fiber tree. Every React-rendered DOM element has a `__reactFiber$<hash>` property pointing to its fiber node. Traverse from a known DOM element (like `.excalidraw`) up/down the fiber tree to find the component that holds scene state.

**Expression pattern:**
```javascript
(() => {
  const el = document.querySelector('.excalidraw');
  const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
  let fiber = el[fiberKey];
  // Walk up to find App component with scene data
  while (fiber) {
    if (fiber.memoizedState?.memoizedState?.elements) {
      return JSON.stringify(fiber.memoizedState.memoizedState.elements);
    }
    fiber = fiber.return;
  }
  return null;
})()
```

**Feasibility:** MEDIUM. React fiber traversal is a known technique used by React DevTools. The challenge is that the exact tree structure varies between Excalidraw versions and React versions.

**Performance:** Fast -- ~10-50ms. Returns real-time state (not debounced like localStorage).

**What it can extract:** Same as localStorage approach, but with real-time data including currently-being-edited elements.

**Which apps:** React-based canvas apps only (Excalidraw, TLDraw, some others).

**Code complexity:** MEDIUM-HIGH. Fragile fiber traversal code that needs maintenance.

**Limitations:**
- `__reactFiber$` hash suffix changes per React build
- Fiber tree structure is React-internal and not guaranteed stable
- State location in fiber tree varies between Excalidraw versions
- Higher maintenance burden than localStorage approach
- Only works for React-based apps

**Confidence:** MEDIUM -- technically works but fragile.

---

### Approach J: MutationObserver on Non-Canvas DOM Layers

**How it works:** Some canvas apps render an SVG overlay, a hidden text layer, or DOM elements alongside the canvas. Monitor these with MutationObserver for changes.

**Feasibility for Excalidraw:** LIMITED. Excalidraw has a `.layer-ui__wrapper` div containing toolbar, color picker, and properties panel. The properties panel shows selected element info (stroke color, fill, width) but only for the CURRENTLY SELECTED element. No comprehensive scene data is in the DOM layer.

**Performance:** Near-zero CPU cost (event-driven via MutationObserver).

**What it can extract:**
- Selected element properties (from properties panel DOM)
- Active tool (from toolbar active class)
- Color picker state
- But NOT full scene data

**Which apps:** Apps with DOM overlays: draw.io (uses SVG), some charting libraries. Not useful for canvas-only renderers.

**Code complexity:** LOW for MutationObserver setup, but USELESS for full scene extraction.

**Limitations:**
- Only sees UI chrome, not canvas content
- Properties panel only reflects selected element
- No way to enumerate all elements via DOM observation alone

**Confidence:** HIGH that the approach works, LOW that it provides useful canvas content data.

---

### Approach K: Canvas API Interception (Monkey-Patching)

**How it works:** Inject a script into the MAIN world (via `chrome.scripting.executeScript({world: "MAIN"})` or CDP `Runtime.evaluate`) that wraps `CanvasRenderingContext2D.prototype` methods:

```javascript
const orig = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
  window.__canvasLog = window.__canvasLog || [];
  window.__canvasLog.push({ op: 'fillText', text, x, y });
  return orig.call(this, text, x, y, maxWidth);
};
// Similarly for strokeRect, fillRect, beginPath, lineTo, arc, etc.
```

This logs every drawing operation with parameters, creating a structured record of what was drawn.

**Feasibility:** YES for NEW drawings, NO for existing content. The monkey-patch must be installed BEFORE drawing operations occur. It cannot retroactively capture operations that already happened. On page load, Excalidraw re-renders the entire scene from its internal state, so the intercept would capture the initial render if injected early enough.

**Critical timing requirement:** The patch must execute before Excalidraw's first render. This requires either:
- Manifest V3 `content_scripts` with `"world": "MAIN"` and `"run_at": "document_start"`
- Or a `chrome.scripting.executeScript` call that races the page load

**Performance:** Minimal overhead per draw call (~microseconds for logging). But Excalidraw may issue thousands of draw calls per frame (each shape = multiple path/fill/stroke calls). Log size grows rapidly.

**What it can extract:**
- All canvas drawing operations with exact parameters
- Text content via fillText/strokeText interception
- Shape boundaries via rect/arc/path interception
- Colors via fillStyle/strokeStyle property interception
- Transform matrix state

**Which apps:** Universal -- works for ANY canvas app (Excalidraw, Figma, draw.io, charting libraries, games).

**Code complexity:** HIGH.
- Need to wrap 20+ Canvas2D methods
- Need to reconstruct semantic shapes from low-level draw calls (fillRect + fillText does not obviously equal "a labeled rectangle")
- Need to handle transform matrix to get world coordinates
- Need to manage log memory (thousands of calls per frame)
- Need to inject before page scripts run

**Limitations:**
- Cannot capture already-rendered content unless page re-renders
- Low-level draw calls are hard to reconstruct into semantic shapes
- Excalidraw uses roughjs which generates many path segments per shape (making reconstruction harder)
- Memory pressure from logging thousands of operations
- Must inject before first render (timing-sensitive)
- Breaks if app uses OffscreenCanvas or WebGL (different rendering path)

**Confidence:** MEDIUM -- technically sound but extremely complex to make useful.

---

### Approach L: WebGL State Inspection via CDP

**How it works:** For WebGL-based canvas apps, use CDP to inspect WebGL state, read framebuffer pixels, or intercept WebGL shader/draw calls.

**Feasibility for Excalidraw:** NOT APPLICABLE. Excalidraw uses Canvas 2D API, not WebGL. Excalidraw renders via `roughjs` which uses CanvasRenderingContext2D.

**Which apps:** Only WebGL-based apps (some 3D viewers, some chart libraries, Three.js apps). NOT Excalidraw, NOT draw.io.

**Code complexity:** VERY HIGH -- WebGL state is extremely complex.

**Limitations:** Not applicable to the primary use case.

**Confidence:** HIGH that it's inapplicable to Excalidraw.

---

### Approach M: Clipboard Interception

**How it works:** Trigger a "copy" operation on Excalidraw (Ctrl+C after selecting elements), then read the clipboard data. Excalidraw copies selected elements as JSON with type `"excalidraw/clipboard"`.

**Clipboard format (verified from Excalidraw issue #8700 and clipboard.ts source):**
```json
{
  "type": "excalidraw/clipboard",
  "elements": [...],  // Full element data for selected elements
  "files": {...}       // Image data if any
}
```

**Feasibility:** YES, with caveats. Reading clipboard requires either:
- `navigator.clipboard.readText()` (needs user gesture and clipboard-read permission)
- `document.addEventListener('copy', e => e.clipboardData.getData('text'))` (works in content script)
- CDP approach: dispatch Ctrl+A then Ctrl+C via keyboard events, then `Runtime.evaluate` with `navigator.clipboard.readText()`

**Performance:** ~100-300ms (select all + copy + clipboard read).

**What it can extract:** Full element data for ALL selected elements (same as localStorage), including positions, types, text, colors, connections.

**Which apps:** Excalidraw (JSON), draw.io (XML), TLDraw (JSON). App-specific clipboard formats.

**Code complexity:** MEDIUM. Need to handle clipboard permissions, timing, and format parsing.

**Limitations:**
- Requires Ctrl+A to select all (may interfere with user's selection)
- Side effect: modifies clipboard contents (may overwrite user's clipboard)
- Needs clipboard-read permission or user gesture
- Visible side effect (elements become selected, blue selection box appears)
- App-specific clipboard format parsing

**Confidence:** MEDIUM -- works but has UX side effects.

---

### Approach N: Export Function Triggering

**How it works:** Trigger Excalidraw's "Save as JSON" export function programmatically, intercept the file download, and parse the resulting .excalidraw JSON file.

**Feasibility:** DIFFICULT. Triggering export requires navigating the menu UI (Ctrl+Shift+S or hamburger menu > Export > JSON). Intercepting the file download requires either:
- CDP `Page.setDownloadBehavior` to redirect downloads to a known location
- Or CDP `Browser.setDownloadBehavior` + `Browser.downloadWillBegin` event

**Performance:** ~1-3 seconds (menu navigation + export + file write + file read).

**What it can extract:** Complete .excalidraw JSON file with all elements, appState, and embedded files.

**Which apps:** Excalidraw only (specific export flow).

**Code complexity:** HIGH -- complex multi-step UI automation + download interception.

**Limitations:**
- Visible UI side effects (menu opens, export dialog appears)
- Slow (seconds of UI interaction)
- Download interception is complex
- Far more complex than localStorage read for identical data
- User sees the export happening

**Confidence:** HIGH technically, but NOT recommended when simpler approaches exist.

---

### Approach O: chrome.scripting.executeScript with world: "MAIN"

**How it works:** Manifest V3 supports injecting scripts directly into the page's main world (not the isolated world) via `chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: () => { ... } })`. This gives full access to page JavaScript variables, React state, and any page-level API.

**Feasibility:** YES -- HIGH. Requires `"scripting"` permission + host permissions. FSB already has host permissions via `"<all_urls>"`. This is the official, supported Manifest V3 way to access page context.

**Key advantage over CDP Runtime.evaluate:** Does not require debugger attachment (no "debugging this tab" banner). The function executes in page context and returns results via `InjectionResult`.

**Performance:** Fast -- ~5-20ms. Same as Runtime.evaluate.

**What it can extract:** Anything accessible from page JavaScript:
- localStorage, sessionStorage, IndexedDB
- React fiber tree
- Any window.* variables
- canvas.toDataURL()
- DOM APIs

**Which apps:** Universal access mechanism.

**Code complexity:** LOW -- cleaner API than CDP Runtime.evaluate.

**Limitations:**
- Requires `"scripting"` permission in manifest.json (FSB may need to add this)
- Function passed to `func` is serialized (cannot access extension-local closures)
- Arguments must be passed via `args` parameter (JSON-serializable only)
- Return value must be JSON-serializable

**Confidence:** HIGH -- official Chrome API, well-documented.

---

### Approach P: IndexedDB Reading via Runtime.evaluate

**How it works:** Excalidraw stores binary files (images) and library data in IndexedDB using the `idb-keyval` library. Access via Runtime.evaluate or chrome.scripting with main world.

**Feasibility:** YES but limited value. IndexedDB stores binary assets (images embedded in drawings), not element/shape data. Scene elements live in localStorage, not IndexedDB.

**What it can extract:** Embedded images and library shapes (reusable element templates).

**Which apps:** Excalidraw specifically.

**Code complexity:** MEDIUM -- IndexedDB API is async and requires promise handling.

**Limitations:**
- Does NOT contain shape/text/arrow data (that's in localStorage)
- Only useful if the drawing contains embedded images
- Async API adds complexity

**Confidence:** HIGH technically, LOW value for canvas content extraction.

---

### Approach Q: Excalidraw URL Hash / Shareable Link Data

**How it works:** When users share Excalidraw drawings, the scene data can be encoded in the URL fragment or a collaboration room ID. Parse `window.location.hash` or collaboration room data to extract scene information.

**Feasibility:** LIMITED. Only works for shared/collaborative drawings. Local drawings on excalidraw.com use localStorage, not URL data.

**What it can extract:** Scene data if present in URL.

**Which apps:** Excalidraw only.

**Code complexity:** LOW.

**Limitations:**
- Only works for shared drawings (rare in automation context)
- Most drawings are local (no URL data)
- Collaboration data requires decryption

**Confidence:** LOW value -- edge case.

---

### Approach R: Canvas captureStream + MediaRecorder

**How it works:** Use `canvas.captureStream()` to get a MediaStream from the canvas, then use MediaRecorder to capture frames. Could capture real-time drawing activity.

**Feasibility:** TECHNICALLY POSSIBLE via Runtime.evaluate, but impractical.

**Performance:** Heavy -- continuous video encoding overhead.

**What it can extract:** Video frames of canvas content (still requires AI vision to interpret).

**Which apps:** Universal (any canvas element).

**Code complexity:** HIGH -- need to manage MediaRecorder, extract frames, process video.

**Limitations:**
- Extremely overkill for static scene extraction
- Continuous processing overhead
- Video frames still need AI vision interpretation
- No structured data

**Confidence:** HIGH technically, NOT recommended.

---

### Approach S: DOM Snapshot + Element Measurement via CDP

**How it works:** Use CDP `DOMSnapshot.captureSnapshot` to get a comprehensive DOM tree with computed styles, layout information, and text content. While this cannot see INSIDE the canvas, it can capture:
- Canvas element position and size
- Overlay elements (toolbar, properties panel)
- Any DOM elements rendered alongside the canvas
- Text content in non-canvas UI elements

**Feasibility:** YES but low value for canvas content specifically.

**Performance:** Fast -- ~50-100ms.

**What it can extract:** Full DOM tree with layout, NOT canvas content.

**Which apps:** Universal DOM inspection, but useless for canvas interior.

**Code complexity:** LOW.

**Limitations:**
- Cannot see inside canvas -- the fundamental problem remains
- Only useful as supplementary data (what tools are active, what's in the properties panel)

**Confidence:** HIGH that it works, but does not solve the core problem.

---

## Comparison Table

| # | Approach | Feasibility | Performance | Structured Data? | Universal? | Complexity | Recommended? |
|---|----------|-------------|-------------|------------------|------------|------------|-------------|
| A | CDP Runtime.evaluate | HIGH | Fast (5-20ms) | Depends on expression | Universal mechanism | LOW | YES (mechanism) |
| B | Excalidraw API via fiber | MEDIUM | Fast (10-30ms) | YES - full scene | Excalidraw only | MEDIUM-HIGH | BACKUP |
| C | Canvas toDataURL | HIGH | Medium (20-100ms) | NO - pixels only | Universal | LOW | YES (universal fallback) |
| D | CDP Page.captureScreenshot | HIGH | Medium (50-200ms) | NO - pixels only | Universal | LOW-MEDIUM | YES (universal fallback) |
| E | Canvas getImageData | HIGH (impractical) | POOR (seconds) | NO - raw pixels | Universal | HIGH | NO |
| F | Accessibility layer | POOR (Excalidraw) | Fast | NO (not exposed) | Rare | LOW | NO |
| G | Canvas hit testing | POSSIBLE | TERRIBLE (100s) | MINIMAL | Universal | HIGH | NO |
| **H** | **localStorage** | **HIGH** | **EXCELLENT (1-2ms)** | **YES - EVERYTHING** | **Excalidraw only** | **TRIVIAL** | **YES - PRIMARY** |
| I | React fiber traversal | MEDIUM | Fast (10-50ms) | YES - full scene | React apps | MEDIUM-HIGH | BACKUP |
| J | MutationObserver on DOM | LIMITED | Near-zero | MINIMAL | Some apps | LOW | NO |
| K | Canvas API interception | MEDIUM | Medium | YES (low-level) | Universal | VERY HIGH | MAYBE (future) |
| L | WebGL inspection | N/A (Excalidraw) | N/A | N/A | WebGL apps | VERY HIGH | NO |
| M | Clipboard interception | YES (with caveats) | Medium (100-300ms) | YES - full scene | App-specific | MEDIUM | NO (UX side effects) |
| N | Export triggering | YES (complex) | POOR (1-3s) | YES - full file | Excalidraw | HIGH | NO |
| O | scripting.executeScript MAIN | HIGH | Fast (5-20ms) | Depends on code | Universal mechanism | LOW | YES (mechanism) |
| P | IndexedDB reading | YES | Medium | NO (binary only) | Excalidraw | MEDIUM | NO |
| Q | URL hash data | LIMITED | Fast | Partial | Excalidraw | LOW | NO |
| R | captureStream | POSSIBLE | Heavy | NO - video frames | Universal | HIGH | NO |
| S | DOMSnapshot | YES | Fast | NO (DOM only) | Universal | LOW | NO (supplementary) |

---

## Recommended Strategy

### Tier 1: localStorage Read (Excalidraw -- implement first)

**Why:** Trivially simple, instant, returns EVERYTHING, zero side effects. This single approach solves 90% of the canvas vision problem for Excalidraw.

**Implementation:**
```javascript
// In content script (content/canvas-vision.js or similar)
function getExcalidrawScene() {
  if (!window.location.hostname.includes('excalidraw')) return null;
  try {
    const elements = JSON.parse(localStorage.getItem('excalidraw') || '[]');
    const appState = JSON.parse(localStorage.getItem('excalidraw-state') || '{}');
    return { elements: elements.filter(e => !e.isDeleted), appState };
  } catch (e) {
    return null;
  }
}
```

**What the AI sees:** A structured description like:
```
CANVAS SCENE (Excalidraw):
- Rectangle "Start" at (200,200) 150x80, blue fill, connected to arrow_1
- Rectangle "Process" at (200,400) 150x80, green fill, connected from arrow_1, connected to arrow_2
- Arrow arrow_1 from Start to Process, black stroke
- Text "Begin here" at (100, 100), font 20px
Total: 5 elements (2 rectangles, 2 arrows, 1 text)
```

**Token cost:** ~50-200 tokens for a typical diagram (vs 765-1105 for a screenshot). Vastly cheaper and more precise.

**Caveat:** localStorage is debounced (500ms). For real-time mid-draw state, use Tier 2.

### Tier 2: CDP Runtime.evaluate or scripting.executeScript MAIN (Excalidraw real-time)

**When to use:** When localStorage is stale (mid-drawing), or when you need appState details (current zoom, scroll, selected elements).

**Implementation (two options):**

Option A -- CDP Runtime.evaluate (uses existing debugger infrastructure):
```javascript
// In background.js
async function getExcalidrawSceneViaRuntimeEval(tabId) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `JSON.stringify({
        elements: JSON.parse(localStorage.getItem('excalidraw') || '[]'),
        appState: JSON.parse(localStorage.getItem('excalidraw-state') || '{}')
      })`,
      returnByValue: true
    });
    return JSON.parse(result.result.value);
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}
```

Option B -- chrome.scripting.executeScript (no debugger banner):
```javascript
// In background.js
async function getExcalidrawSceneViaScripting(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => ({
      elements: JSON.parse(localStorage.getItem('excalidraw') || '[]'),
      appState: JSON.parse(localStorage.getItem('excalidraw-state') || '{}')
    })
  });
  return results[0]?.result;
}
```

**Note:** Option B requires adding `"scripting"` to manifest.json permissions. Option A uses existing debugger permission. For FSB, Option A is lower-friction since the debugger is already attached during automation sessions.

### Tier 3: Screenshot + Vision AI (Universal fallback)

**When to use:** For non-Excalidraw canvas apps where no structured state is available. Also as a verification mechanism ("does the canvas actually look right?").

**Implementation:**
```javascript
// In background.js
async function captureCanvasScreenshot(tabId, clipRect) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    const result = await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
      format: 'png',
      clip: { x: clipRect.x, y: clipRect.y, width: clipRect.width, height: clipRect.height, scale: 1 }
    });
    return result.data; // base64 PNG
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}
```

**Token cost per use:** ~765-1105 tokens at high detail, ~85 at low detail.
**Dollar cost per use:** ~$0.002-0.01 at GPT-4o rates.

### Future Tier: Canvas API Interception (Universal structured data)

**Not recommended for v0.9.9 scope.** But for a future milestone targeting universal canvas support, monkey-patching Canvas2D prototype methods would provide structured drawing operation logs for ANY canvas app. The complexity is very high (reconstructing semantic shapes from low-level draw calls, especially with roughjs's procedural path generation), but it is the only truly universal structured-data approach.

---

## Excalidraw Element Types and Properties Reference

Based on the Excalidraw JSON schema documentation, here are the element types FSB needs to understand:

| Type | Key Properties | Bound Text? | Points Array? |
|------|---------------|-------------|---------------|
| rectangle | x, y, width, height, roundness | YES | NO |
| ellipse | x, y, width, height | YES | NO |
| diamond | x, y, width, height | YES | NO |
| text | x, y, text, fontSize, fontFamily, textAlign, containerId | N/A | NO |
| arrow | x, y, points[], startBinding, endBinding | YES (label) | YES |
| line | x, y, points[] | NO | YES |
| freedraw | x, y, points[] | NO | YES |
| frame | x, y, width, height, name | NO | NO |
| image | x, y, width, height, fileId | YES | NO |

**Connection model:** Arrows have `startBinding: { elementId }` and `endBinding: { elementId }` linking them to shapes. Shapes have `boundElements: [{ id, type: 'arrow' }]` back-references. Text inside shapes has `containerId` pointing to the shape.

---

## Common Pitfalls

### Pitfall 1: Assuming Content Scripts Cannot Access localStorage
**What goes wrong:** Developer assumes isolated world blocks localStorage and builds a complex CDP workaround.
**Reality:** Content scripts share the host page's origin and CAN access `window.localStorage` directly. The isolated world only blocks JavaScript variables and functions -- not Web APIs like Storage, DOM, or Fetch.
**Exception:** If the user has "Block third-party cookies and data" enabled, localStorage may be blocked for content scripts. Handle this gracefully with a try/catch and fall back to CDP Runtime.evaluate.

### Pitfall 2: Trying to Access excalidrawAPI Directly
**What goes wrong:** Developer tries `window.excalidrawAPI.getSceneElements()` via Runtime.evaluate.
**Reality:** Production excalidraw.com does NOT expose excalidrawAPI on `window`. It is stored as React component state via `useExcalidrawAPI()` hook. Access requires fiber tree traversal, which is fragile.
**Better approach:** Read localStorage instead -- same data, simpler access.

### Pitfall 3: Using getImageData Instead of toDataURL
**What goes wrong:** Developer tries to extract raw pixel data via getImageData, gets a massive array that crashes CDP.
**Reality:** getImageData returns width * height * 4 bytes as a flat array. For a 1920x1080 canvas, that is 8.3 million numbers. This cannot be efficiently transferred via CDP JSON serialization.
**Better approach:** Use toDataURL('image/png') which returns a compact base64 string, or use Page.captureScreenshot.

### Pitfall 4: Not Handling the 500ms localStorage Debounce
**What goes wrong:** Read localStorage immediately after drawing and get stale data.
**Reality:** Excalidraw's `saveDataStateToLocalStorage()` is debounced at 500ms. After any drawing operation, the latest state takes up to 500ms to appear in localStorage.
**Mitigation:** Add a 600ms delay before reading localStorage after an FSB-initiated drawing action. Or use CDP Runtime.evaluate to access React state directly for real-time data.

### Pitfall 5: Screenshot Token Cost Accumulation
**What goes wrong:** Taking a screenshot every iteration for verification, each costing ~765-1105 tokens.
**Reality:** Over a 10-iteration session, that is 7,650-11,050 additional tokens just for canvas verification. At $2.50/million input tokens, that is ~$0.02-0.03 per session.
**Mitigation:** Use screenshots sparingly (once at end for verification). Use localStorage data for iteration-by-iteration state awareness.

---

## Architecture Patterns

### Pattern: Scene Description Serializer
**What:** Convert Excalidraw JSON elements into a compact text description for AI context.
**Why:** Raw JSON is verbose (~200-500 tokens per element). A summarized format fits in ~50-100 tokens per element.

```javascript
function serializeSceneForAI(elements) {
  const nonDeleted = elements.filter(e => !e.isDeleted);
  const lines = [`CANVAS SCENE: ${nonDeleted.length} elements`];
  for (const el of nonDeleted) {
    switch (el.type) {
      case 'rectangle':
      case 'ellipse':
      case 'diamond':
        const boundText = nonDeleted.find(t => t.containerId === el.id);
        const label = boundText ? ` "${boundText.text}"` : '';
        lines.push(`- ${el.type}${label} at (${el.x},${el.y}) ${el.width}x${el.height} fill:${el.backgroundColor}`);
        break;
      case 'text':
        if (!el.containerId) { // standalone text only
          lines.push(`- text "${el.text}" at (${el.x},${el.y}) size:${el.fontSize}`);
        }
        break;
      case 'arrow':
        const from = el.startBinding?.elementId || 'none';
        const to = el.endBinding?.elementId || 'none';
        lines.push(`- arrow from:${from} to:${to} at (${el.x},${el.y})`);
        break;
      case 'line':
        lines.push(`- line at (${el.x},${el.y}) ${el.points.length} points`);
        break;
    }
  }
  return lines.join('\n');
}
```

### Pattern: Canvas Detection Router
**What:** Detect which canvas app is active and dispatch the appropriate extraction method.

```javascript
function getCanvasVisionStrategy(url) {
  if (/excalidraw\.com|\.excalidraw\./.test(url)) return 'excalidraw-localstorage';
  if (/diagrams\.net|draw\.io/.test(url)) return 'drawio-localstorage'; // different key
  if (/tldraw\.com/.test(url)) return 'tldraw-localstorage';
  // Default: screenshot + vision AI
  return 'screenshot-vision';
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas pixel analysis | Custom edge detection/shape recognition from getImageData | Screenshot + multimodal AI (GPT-4o/Grok vision) | AI vision is better at shape/text recognition than any custom algorithm |
| OCR on canvas text | Tesseract.js WASM integration (~2MB, 2-10s processing) | localStorage read (Excalidraw) or AI vision (universal) | LocalStorage gives exact text instantly; AI vision handles OCR implicitly |
| Canvas-to-DOM reconstruction | Custom pixel-to-SVG converter | Read app state directly (localStorage/API) | App state IS the structured data; pixel reconstruction is lossy |
| Universal canvas interception | Full Canvas2D proxy with shape reconstruction | App-specific localStorage + universal screenshot fallback | 80/20: specific apps covered cheaply, universal via screenshot |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pixel analysis (getImageData + OCR) | App state extraction (localStorage/API) + multimodal AI vision | 2023-2024 (multimodal AI maturity) | Eliminates need for custom CV code |
| content_scripts isolated world (can't access page JS) | chrome.scripting world: "MAIN" + CDP Runtime.evaluate | Chrome 111 (MV3 MAIN world support, 2023) | Direct page JS access without hacks |
| Screenshot requires server-side processing | Client-side multimodal AI API calls | 2023 (GPT-4V, Gemini Vision) | Vision analysis without server infrastructure |

---

## Open Questions

1. **localStorage access reliability:**
   - What we know: Content scripts share host page origin and CAN access localStorage in standard Chrome configuration
   - What's unclear: How many users have "Block third-party cookies and data" enabled, which may block content script localStorage access
   - Recommendation: Implement localStorage as primary, CDP Runtime.evaluate as automatic fallback

2. **Excalidraw localStorage debounce timing:**
   - What we know: Save is debounced at 500ms default
   - What's unclear: Whether this is configurable by the user or environment
   - Recommendation: Use 600ms safety margin; verify via testing

3. **draw.io/diagrams.net state format:**
   - What we know: draw.io uses XML format and may store in localStorage
   - What's unclear: Exact localStorage key names and XML structure
   - Recommendation: Research in a future phase when expanding beyond Excalidraw

4. **chrome.scripting permission addition:**
   - What we know: Adding "scripting" to manifest.json enables world: "MAIN" injection
   - What's unclear: Whether this triggers a new permission prompt for existing users
   - Recommendation: Use CDP Runtime.evaluate (existing debugger permission) for now; add scripting permission when other features need it

---

## Sources

### Primary (HIGH confidence)
- [Chrome DevTools Protocol: Runtime domain](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/) -- Runtime.evaluate specification
- [Chrome DevTools Protocol: Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/) -- Page.captureScreenshot specification
- [Chrome DevTools Protocol: Accessibility domain](https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/) -- Accessibility.getFullAXTree
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) -- executeScript with world: "MAIN"
- [Chrome content scripts documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- isolated world behavior
- [Excalidraw JSON Schema](https://docs.excalidraw.com/docs/codebase/json-schema) -- element data format
- [Excalidraw API docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api) -- getSceneElements, getAppState
- [Excalidraw clipboard.ts source](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts) -- clipboard format
- [Excalidraw LocalData.ts source](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/LocalData.ts) -- localStorage keys
- [Excalidraw App.tsx source](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/App.tsx) -- excalidrawAPI not on window
- FSB codebase: background.js executeCDPToolDirect (lines 12265-12403), content/messaging.js isCanvasBasedEditor (line 217)

### Secondary (MEDIUM confidence)
- [Excalidraw accessibility audit issue #7492](https://github.com/excalidraw/excalidraw/issues/7492) -- canvas elements not in AX tree
- [Excalidraw state management article](https://dev.to/karataev/excalidraw-state-management-1842) -- React state architecture
- [canvas-interceptor library](https://github.com/Rob--W/canvas-interceptor) -- Canvas2D monkey-patching technique
- [OpenAI vision token cost guide](https://developers.openai.com/api/docs/guides/images-vision) -- image token calculation
- [tesseract-wasm](https://github.com/robertknight/tesseract-wasm) -- WASM OCR performance characteristics
- [Chrome Manifest V3 content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- world: "MAIN" support

### Tertiary (LOW confidence)
- [Excalidraw clipboard copy JSON issue #8700](https://github.com/excalidraw/excalidraw/issues/8700) -- clipboard format details (from bug report, not docs)
- [Chrome extension localStorage access Gist](https://gist.github.com/mohamedmansour/803631) -- content script localStorage pattern (old, MV2 era)

---

## Metadata

**Confidence breakdown:**
- localStorage approach: HIGH -- verified from Excalidraw source and Chrome docs
- CDP Runtime.evaluate: HIGH -- well-documented CDP method, FSB already uses debugger
- Screenshot + Vision: HIGH -- standard CDP method + standard AI API
- React fiber traversal: MEDIUM -- works but fragile across versions
- Canvas API interception: MEDIUM -- technically sound but extreme complexity
- Accessibility approach: HIGH confidence it does NOT work for canvas content

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable technologies, 30-day validity)
