# Phase 115: Canvas Vision - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Give FSB the ability to "see" what is drawn on HTML5 canvas elements. Two-tier approach: (1) Draw call interception via Canvas2D prototype proxy for structured semantic data, (2) Pixel-based fallback via getImageData for color grid + edge detection. Canvas scene text injected into every DOM snapshot so the AI sees canvas content on every iteration.

</domain>

<decisions>
## Implementation Decisions

### Tier 1: Draw Call Interception (Primary)
- Inject `canvas-interceptor.js` as content script with `world: "MAIN"` and `run_at: "document_start"` in manifest.json
- Wrap ~20 CanvasRenderingContext2D.prototype methods (fillRect, strokeRect, fillText, strokeText, beginPath, closePath, moveTo, lineTo, bezierCurveTo, quadraticCurveTo, arc, arcTo, ellipse, rect, fill, stroke, drawImage, setTransform, save, restore)
- Cap log at 5,000 entries to prevent memory issues
- Capture fillStyle, strokeStyle, font, lineWidth on drawing operations
- Store log in window.__canvasCallLog (page context, accessible via Runtime.evaluate)
- For already-loaded pages: trigger re-render via window.dispatchEvent(new Event('resize'))
- Extract semantic summary: texts array, rects array, paths array with coordinates and colors

### Tier 2: Pixel Fallback (When interception unavailable)
- Use CDP Runtime.evaluate to call canvas.getContext('2d').getImageData()
- Downsample to manageable resolution
- Color grid: detect dominant colors at grid positions, report non-white regions with bounding boxes
- Edge detection: Sobel operator on downsampled pixels, convert to line characters (|, -, /, \)
- Combine color regions + edge outlines for spatial description

### DOM Snapshot Integration
- Add a CANVAS SCENE section to the unified markdown DOM snapshot
- Triggered automatically when canvas elements are detected on the page
- Content includes: element count, text labels, shape descriptions, connection descriptions
- Target: 200-500 tokens for typical diagrams

### Re-render Strategy
- Primary: window.dispatchEvent(new Event('resize')) -- most canvas apps re-render on resize
- Fallback: briefly set canvas.width = canvas.width (clears and triggers redraw)
- Fallback: canvas.style.display toggle (hide/show forces reflow)

### roughjs Handling (Excalidraw-specific concern)
- Excalidraw uses roughjs which generates 20+ randomized path segments per "rectangle"
- Need heuristics to cluster nearby paths and identify semantic shapes
- For Tier 1: group paths by proximity and color, detect bounding boxes, match text to nearest shape
- This is the hardest part of the implementation

### Claude's Discretion
- Exact heuristics for shape reconstruction from roughjs paths
- Pixel fallback resolution and color name mapping
- How to present canvas data in markdown (table vs list vs description)
- Whether to include path details or just summary counts
- Performance optimization strategies for large canvases

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- background.js executeCDPToolDirect -- existing CDP direct routing with Runtime.evaluate pattern
- content/dom-analyzer.js -- DOM snapshot generation, needs canvas scene injection point
- ai-integration.js buildDOMSnapshot -- markdown generation, needs CANVAS SCENE section
- manifest.json -- needs new content_scripts entry for canvas-interceptor.js

### Established Patterns
- Content scripts use window.FSB namespace for module communication
- CDP tools use chrome.debugger.sendCommand with attach/detach pattern
- DOM snapshots use unified markdown format with element refs
- Site guides inject intelligence via guidance strings

### Integration Points
- manifest.json: add canvas-interceptor.js content script (world: MAIN, document_start)
- content/dom-analyzer.js: add getCanvasScene() call during DOM analysis
- background.js: add Runtime.evaluate path for reading __canvasCallLog
- ai-integration.js: add CANVAS SCENE section to markdown snapshot builder

</code_context>

<specifics>
## Specific Ideas

The user wants a UNIVERSAL solution, not app-specific. Draw call interception is the primary approach because it works on any Canvas 2D app. The pixel fallback covers WebGL and CORS cases.

Research identified that AI models understand structured text (coordinates, types, colors) far better than ASCII art (80% vs 57% accuracy). The output format should be structured text, not visual representation.

The canvas-interceptor.js must be injected into EVERY page at document_start because we don't know which pages will have canvas elements. The interceptor should be lightweight (~2KB) and no-op on pages without canvas.

</specifics>

<deferred>
## Deferred Ideas

- WebGL interception (different rendering pipeline, much more complex)
- Screenshot + vision AI integration (Tier 3, can be added later)
- Canvas API interception for OffscreenCanvas in Web Workers
- Per-app state extractors (localStorage for Excalidraw, XML for draw.io)

</deferred>
