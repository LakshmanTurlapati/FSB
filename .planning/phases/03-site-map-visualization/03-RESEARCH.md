# Phase 3: Site Map Visualization - Research

**Researched:** 2026-02-18
**Domain:** Graph visualization in Chrome Extension (Manifest V3) options page
**Confidence:** HIGH

## Summary

Phase 3 adds interactive force-directed graph visualization to site map memories in the FSB options page Memory tab. The core challenge is rendering an interactive node-link diagram inside a Chrome Extension with Manifest V3 CSP constraints (no eval, no inline scripts, no CDN -- all code must be bundled locally).

The research found that **d3-force** (physics engine only, ~12KB total with dependencies) combined with **vanilla SVG rendering** is the optimal approach. d3-force is purely a data computation library -- it calculates node positions without touching the DOM. This means we can use it for force-directed layout calculations and render results using standard `document.createElementNS` SVG calls, keeping the implementation lightweight and CSP-compliant.

The site map data structure from Phase 2 (pages, navigation, forms, workflows) maps cleanly to a graph model: pages become nodes, navigation links become edges, and forms/workflows become annotated nodes with distinct visual styling.

**Primary recommendation:** Bundle d3-force + d3-quadtree + d3-dispatch + d3-timer (~12KB minified total) as local files, build a custom SVG renderer with vanilla JS for graph rendering, implement zoom/pan/drag without additional libraries using SVG viewBox transforms.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3-force | 3.0.0 | Force-directed layout physics | Industry standard for force-directed graphs. Pure data computation -- no DOM dependency. ~6.5KB minified |
| d3-quadtree | 3.0.1 | Spatial indexing for many-body force | Required dependency of d3-force for efficient n-body simulation. ~3.2KB minified |
| d3-dispatch | 3.0.1 | Event dispatching | Required dependency of d3-force for tick events. ~1.2KB minified |
| d3-timer | 3.0.1 | Animation frame scheduling | Required dependency of d3-force for simulation loop. ~1.2KB minified |

**Total bundle size: ~12KB minified** (negligible compared to existing Chart.js at 200KB or mermaid.min.js at 2.7MB already in lib/)

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | SVG rendering | Vanilla JS with createElementNS -- no library needed |
| (none) | - | Zoom/pan/drag | Vanilla JS mouse/wheel event handlers on SVG viewBox -- no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-force + vanilla SVG | Cytoscape.js | Full-featured graph library (365KB min / 112KB gzip) but 30x larger than d3-force alone. Overkill for this use case -- we only visualize small site maps (5-50 nodes). |
| d3-force + vanilla SVG | force-graph (vasturiano) | Canvas-based, 50KB, built-in interactions. But Canvas makes per-node interactivity harder (no DOM events per node), and the library is opinionated about rendering. |
| d3-force + vanilla SVG | vis-network | Full network visualization, but very large (100KB+), depends on hammer.js and moment.js. Way too heavy. |
| d3-force + vanilla SVG | Custom physics (no library) | Could implement Verlet integration manually, but d3-force is only 12KB and battle-tested for edge cases (numerical stability, convergence). Not worth hand-rolling. |
| SVG rendering | Canvas rendering | Canvas is faster for 1000+ nodes but loses DOM events per element. Site maps have 5-50 nodes max -- SVG is ideal because each node is a DOM element with native click/hover events. |

**Installation:** No npm. Download minified UMD files from CDN and save to `lib/visualization/`:
```
lib/visualization/d3-force.min.js    (~6.5KB)
lib/visualization/d3-quadtree.min.js (~3.2KB)
lib/visualization/d3-dispatch.min.js (~1.2KB)
lib/visualization/d3-timer.min.js    (~1.2KB)
```

All four files use UMD pattern and export to global `d3` namespace. They must be loaded via `<script>` tags in options.html in dependency order: dispatch, timer, quadtree, force.

## Architecture Patterns

### Recommended Project Structure
```
lib/visualization/
  d3-force.min.js       # Physics engine (from CDN, bundled locally)
  d3-quadtree.min.js    # Spatial indexing dependency
  d3-dispatch.min.js    # Event dispatch dependency
  d3-timer.min.js       # Timer dependency
  site-graph.js         # NEW: Graph data transformer + SVG renderer
ui/
  options.html          # MODIFIED: Add script tags for d3 modules + site-graph.js
  options.js            # MODIFIED: Add click-to-expand toggle on memory items
  options.css           # MODIFIED: Add graph container + node/edge styles
manifest.json           # MODIFIED: No changes needed (no new permissions)
```

### Pattern 1: Data-Computation-Then-Render Separation
**What:** d3-force computes node/link positions as pure data. A separate render function maps computed data to SVG DOM elements.
**When to use:** Always. This pattern keeps physics decoupled from rendering.
**Why:** The simulation runs on plain JS objects (`{x, y, vx, vy}`). The renderer reads `node.x` and `node.y` to position SVG elements. This means we can swap renderers (SVG vs Canvas) or run the simulation headless for testing.

**Example:**
```javascript
// Source: d3js.org/d3-force documentation pattern
const nodes = [
  { id: 'home', label: 'Home', type: 'page', size: 10 },
  { id: 'login', label: 'Login', type: 'form', size: 5 }
];
const links = [
  { source: 'home', target: 'login', type: 'navigation' }
];

// Physics only -- no DOM
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(d => d.id).distance(80))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(d => d.size + 5));

// Render on each tick -- vanilla SVG
simulation.on('tick', () => {
  nodes.forEach(node => {
    const el = svgNodeMap.get(node.id);
    el.setAttribute('cx', node.x);
    el.setAttribute('cy', node.y);
  });
  links.forEach(link => {
    const el = svgLinkMap.get(link.index);
    el.setAttribute('x1', link.source.x);
    el.setAttribute('y1', link.source.y);
    el.setAttribute('x2', link.target.x);
    el.setAttribute('y2', link.target.y);
  });
});
```

### Pattern 2: SitePattern-to-Graph Data Transformer
**What:** A function that converts the Phase 2 `sitePattern` object into `{nodes, links}` arrays suitable for d3-force.
**When to use:** When a user clicks "Show Graph" on a site map memory.

**Data mapping:**
| sitePattern field | Graph element | Node type | Visual encoding |
|-------------------|---------------|-----------|-----------------|
| `pages[path]` | Node | `page` | Circle sized by elementCount + formCount |
| `forms[i]` | Node | `form` | Diamond/square, colored differently |
| `navigation[i]` | Edge from source to target | - | Solid arrow line |
| `workflows[i]` (string) | Parsed into sequence of edges | - | Dashed line with workflow color |
| `pagePurposes[path]` (AI-refined) | Tooltip / label text | - | Color coding by purpose category |

### Pattern 3: Inline Expand/Collapse in Memory List
**What:** Clicking a site map memory item toggles an inline graph container below it, similar to the existing session detail expand pattern.
**When to use:** For the click-to-expand UX.
**Why:** The options page already uses this expand/collapse pattern for session history items (`session-detail-wrapper`, `slideDown` animation). Reusing the same pattern ensures visual consistency.

**Example interaction flow:**
1. User sees site map memory item with "AI Enhanced" badge
2. User clicks the memory item (or a "Show Graph" button)
3. A container slides down below the item (reuse `.session-detail-wrapper` pattern)
4. d3-force simulation runs, SVG graph animates into position
5. User can click a different memory -- previous graph collapses, new one expands
6. User clicks same memory again to collapse

### Pattern 4: SVG Zoom/Pan via viewBox Transform
**What:** Implement zoom (wheel) and pan (click-drag on background) by manipulating the SVG viewBox attribute.
**When to use:** For interactive graph exploration.
**Why:** This avoids needing a zoom library. The SVG viewBox acts as a camera -- changing it zooms/pans the entire graph.

**Example:**
```javascript
// Vanilla JS zoom/pan on SVG
let viewBox = { x: 0, y: 0, w: 600, h: 400 };

svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const scale = e.deltaY > 0 ? 1.1 : 0.9;
  // Zoom toward cursor position
  const point = svgPoint(svg, e.clientX, e.clientY);
  viewBox.x = point.x - (point.x - viewBox.x) * scale;
  viewBox.y = point.y - (point.y - viewBox.y) * scale;
  viewBox.w *= scale;
  viewBox.h *= scale;
  svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
});
```

### Anti-Patterns to Avoid
- **Loading full D3 library:** The complete d3.v7.min.js is ~270KB. We only need d3-force and its three dependencies (~12KB). Never load the full D3 bundle.
- **Using d3-selection for DOM manipulation:** d3-selection adds 10KB+ and introduces a different programming model. Vanilla `createElementNS` is sufficient for our ~50 node graphs.
- **Rendering on Canvas for small graphs:** Canvas loses per-node DOM events. For 5-50 node graphs, SVG is simpler and more interactive.
- **Running simulation until fully converged before rendering:** The animation of nodes settling is part of the UX appeal. Render on every tick.
- **Creating a new simulation on every expand:** Cache the simulation state per memory ID so re-expanding the same graph shows the settled layout instantly.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-directed layout physics | Custom Verlet integration | d3-force (~12KB) | Numerical stability, convergence handling, many-body optimization via Barnes-Hut (d3-quadtree) are non-trivial |
| Node overlap prevention | Manual position adjustments | d3.forceCollide() | Collision detection with variable radii is handled correctly |
| Link length optimization | Fixed positions | d3.forceLink().distance() | Spring-based link forces with configurable rest length |
| Many-body repulsion | O(n^2) pairwise forces | d3.forceManyBody() | Uses Barnes-Hut approximation (O(n log n)) via quadtree |

**Key insight:** The physics simulation is the hardest part. d3-force solves it in 12KB. Everything else (SVG rendering, zoom/pan, data transformation) is straightforward vanilla JS for graphs of this scale.

## Common Pitfalls

### Pitfall 1: SVG Namespace for createElement
**What goes wrong:** Using `document.createElement('circle')` creates an HTML element, not an SVG element. It renders nothing.
**Why it happens:** SVG elements must be created in the SVG namespace.
**How to avoid:** Always use `document.createElementNS('http://www.w3.org/2000/svg', tagName)`.
**Warning signs:** Elements appear in DOM inspector but are invisible.

### Pitfall 2: d3-force Mutates Node Objects
**What goes wrong:** d3-force adds `x`, `y`, `vx`, `vy`, `index` properties directly to node objects. If you pass the original sitePattern data, it gets mutated.
**Why it happens:** d3-force works by mutating the input data array for performance.
**How to avoid:** Deep-clone or create new node objects when converting sitePattern to graph data. Never pass the raw memory data directly to the simulation.
**Warning signs:** Site map memory data suddenly has `x`, `y`, `vx`, `vy` properties after visualization.

### Pitfall 3: Simulation Stale References After Re-render
**What goes wrong:** If you destroy and recreate the SVG but keep the old simulation, tick events update removed DOM elements.
**Why it happens:** The simulation keeps references to old SVG elements.
**How to avoid:** Either stop the old simulation before re-creating, or maintain a mapping from node IDs to current SVG elements that gets updated on re-render.
**Warning signs:** Console errors about null elements, visual glitches.

### Pitfall 4: Force Layout Explodes With Bad Initial Positions
**What goes wrong:** Nodes fly to Infinity or NaN positions.
**Why it happens:** If all nodes start at (0,0), the repulsion force has no direction. Or if link distances are too small relative to charge strength.
**How to avoid:** Give nodes random initial positions within the viewport. Use `forceCenter()` to keep the graph centered. Tune charge strength (-200 to -400 for small graphs) and link distance (60-120px).
**Warning signs:** Nodes disappear off-screen or the simulation never settles.

### Pitfall 5: CSP Blocks Inline SVG Event Handlers
**What goes wrong:** Using `onclick="..."` attributes on SVG elements fails silently in Manifest V3 extensions.
**Why it happens:** Chrome Extension CSP blocks all inline scripts and event handlers.
**How to avoid:** Always use `element.addEventListener()` in JavaScript. Never set event handlers as HTML attributes.
**Warning signs:** Click handlers silently don't work. No console error (CSP violations are silent in some cases).

### Pitfall 6: Graph Container Size When Collapsed
**What goes wrong:** The graph container has 0 width/height when initially created (before expand animation completes), causing the force simulation to center at (0,0).
**Why it happens:** CSS animations or `display: none` means the container has no dimensions during setup.
**How to avoid:** Start the simulation only after the container is visible and has dimensions. Use `requestAnimationFrame` or a transition-end event to delay simulation start.
**Warning signs:** All nodes pile up in the top-left corner.

### Pitfall 7: Memory Leak from Uncleaned Simulations
**What goes wrong:** Each expand creates a new d3-force simulation with a timer that runs indefinitely.
**Why it happens:** `simulation.stop()` is not called when collapsing the graph.
**How to avoid:** Call `simulation.stop()` when the graph container is collapsed/removed. Store simulation references and clean them up.
**Warning signs:** Increasing CPU usage after repeatedly expanding/collapsing graphs.

## Code Examples

Verified patterns from official sources:

### Creating SVG Elements (Vanilla JS)
```javascript
// Source: MDN Web Docs - createElementNS
const SVG_NS = 'http://www.w3.org/2000/svg';

function createSVG(container, width, height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.border = '1px solid var(--border-color)';
  svg.style.borderRadius = 'var(--radius-md)';
  svg.style.background = 'var(--bg-secondary)';
  container.appendChild(svg);
  return svg;
}

function createCircle(svg, cx, cy, r, fill) {
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', r);
  circle.setAttribute('fill', fill);
  svg.appendChild(circle);
  return circle;
}

function createLine(svg, x1, y1, x2, y2, stroke) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', stroke);
  line.setAttribute('stroke-width', '1.5');
  svg.appendChild(line);
  return line;
}
```

### Converting sitePattern to Graph Data
```javascript
// Source: Custom pattern based on Phase 2 sitePattern schema
function sitePatternToGraph(sitePattern) {
  const nodes = [];
  const links = [];
  const nodeIdMap = new Map();

  // Pages become nodes
  if (sitePattern.pages) {
    for (const [path, info] of Object.entries(sitePattern.pages)) {
      const nodeId = `page:${path}`;
      const purpose = sitePattern.pagePurposes?.[path] || '';
      nodes.push({
        id: nodeId,
        label: info.title || path,
        path,
        type: 'page',
        size: Math.max(8, Math.min(25, 8 + (info.elementCount || 0) / 10 + (info.formCount || 0) * 3)),
        purpose,
        formCount: info.formCount || 0,
        elementCount: info.elementCount || 0,
        linkCount: info.linkCount || 0
      });
      nodeIdMap.set(path, nodeId);
    }
  }

  // Navigation items become edges
  if (sitePattern.navigation) {
    for (const nav of sitePattern.navigation) {
      const targetId = nodeIdMap.get(nav.path);
      // Connect navigation items to root or to their parent
      // For simplicity, connect from root page to target
      const rootId = nodeIdMap.get('/') || nodes[0]?.id;
      if (targetId && rootId && targetId !== rootId) {
        links.push({
          source: rootId,
          target: targetId,
          type: 'navigation',
          label: nav.label
        });
      }
    }
  }

  // Forms become annotated links/nodes
  if (sitePattern.forms) {
    for (const form of sitePattern.forms) {
      const pageId = nodeIdMap.get(form.page);
      if (pageId) {
        const formId = `form:${form.page}:${form.fields.join(',')}`;
        nodes.push({
          id: formId,
          label: `Form: ${form.fields.slice(0, 3).join(', ')}`,
          type: 'form',
          size: 10,
          fields: form.fields,
          action: form.action
        });
        links.push({
          source: pageId,
          target: formId,
          type: 'form'
        });
      }
    }
  }

  return { nodes, links };
}
```

### d3-force Simulation Setup
```javascript
// Source: d3js.org/d3-force/simulation
function createSimulation(nodes, links, width, height) {
  return d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => d.type === 'form' ? 50 : 80))
    .force('charge', d3.forceManyBody()
      .strength(d => d.type === 'form' ? -100 : -250))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => d.size + 5))
    .alphaDecay(0.02);  // Slower decay = smoother animation
}
```

### Node Drag with d3-force (Vanilla JS)
```javascript
// Source: d3js.org/d3-force pattern adapted for vanilla JS
function enableNodeDrag(nodeEl, simulation, node) {
  let dragStartX, dragStartY;

  nodeEl.addEventListener('mousedown', (e) => {
    e.stopPropagation();  // Prevent pan
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    node.fx = node.x;
    node.fy = node.y;
    simulation.alphaTarget(0.3).restart();  // Reheat simulation

    const onMove = (e) => {
      // Convert screen delta to SVG coordinates
      const dx = (e.clientX - dragStartX) * (viewBox.w / svg.clientWidth);
      const dy = (e.clientY - dragStartY) * (viewBox.h / svg.clientHeight);
      node.fx = node.x + dx;
      node.fy = node.y + dy;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    };

    const onUp = () => {
      node.fx = null;
      node.fy = null;
      simulation.alphaTarget(0);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  nodeEl.style.cursor = 'grab';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full D3 library (d3.v5/v6/v7) for any graph | Modular d3-force standalone | D3 v4 (2016) | 95% size reduction for force-layout-only use cases |
| SVG for large graphs (1000+ nodes) | Canvas/WebGL for large, SVG for small | ~2020 | For our 5-50 node scale, SVG remains ideal |
| jQuery-based interactions | Vanilla JS with addEventListener | Industry standard | No jQuery dependency needed |
| Inline event handlers on SVG | addEventListener in separate scripts | Manifest V3 requirement | Chrome Extension CSP enforces this |

**Deprecated/outdated:**
- d3.layout.force (v3 API): Replaced by d3.forceSimulation in v4+
- Loading D3 from CDN in extensions: Manifest V3 requires local bundling
- eval-based template rendering: Blocked by CSP

## Open Questions

Things that couldn't be fully resolved:

1. **Workflow visualization parsing**
   - What we know: Workflows are stored as free-text strings like "Job search: /jobs -> use search form -> click result -> /jobs/view/{id}"
   - What's unclear: How reliably can these strings be parsed into structured graph edges? The format varies by AI model.
   - Recommendation: Parse the `->` pattern for basic workflow edges, but fall back to a text tooltip if parsing fails. Do not over-engineer the parser.

2. **Optimal graph dimensions within the options panel**
   - What we know: The options page content area is max-width 1200px. The sidebar is 280px. The memory list items use `session-item` styling.
   - What's unclear: Exact available width varies by screen size. Graph height should be fixed or responsive?
   - Recommendation: Use `width: 100%` on the SVG container, set a fixed height of 350-400px. Use viewBox for internal coordinate system independent of container size. The graph always fills available width.

3. **Tooltip content and positioning**
   - What we know: Nodes should show details on hover (page title, element count, form fields, purpose).
   - What's unclear: Should tooltips be native browser title attributes, or custom positioned divs?
   - Recommendation: Use a single shared tooltip `<div>` positioned absolutely relative to the graph container. Show on mouseenter, hide on mouseleave. This gives more control than title attributes and matches the dashboard's design system.

## Sources

### Primary (HIGH confidence)
- [d3js.org/d3-force](https://d3js.org/d3-force) - Force simulation API, module structure, dependencies
- [d3js.org/getting-started](https://d3js.org/getting-started) - Module loading patterns (UMD, ESM, CDN)
- [developer.chrome.com/docs/extensions/reference/manifest/content-security-policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) - Manifest V3 CSP: no eval, no inline scripts, no remote code
- CDN file size verification via jsdelivr/unpkg: d3-force.min.js (~6.5KB), d3-quadtree.min.js (~3.2KB), d3-dispatch.min.js (~1.2KB), d3-timer.min.js (~1.2KB)
- Existing codebase analysis: manifest.json, options.html, options.js, options.css, sitemap-converter.js, sitemap-refiner.js, memory-schemas.js

### Secondary (MEDIUM confidence)
- [js.cytoscape.org](https://js.cytoscape.org) - Alternative library evaluation: 365KB min, no external deps, built-in layouts
- [github.com/cytoscape/cytoscape.js .size-snapshot.json](https://github.com/cytoscape/cytoscape.js/blob/unstable/.size-snapshot.json) - Cytoscape.js size: 365KB min / 112KB gzip UMD
- [github.com/vasturiano/force-graph](https://github.com/vasturiano/force-graph) - force-graph alternative: ~50KB, Canvas-based

### Tertiary (LOW confidence)
- WebSearch results on SVG zoom/pan patterns - multiple approaches confirmed but specific code patterns not verified against official docs
- Bundle size estimates from WebFetch of CDN files - file sizes are approximate from content analysis, not exact byte counts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - d3-force v3.0.0 UMD files verified via CDN, sizes confirmed, API documented
- Architecture: HIGH - Pattern of d3-force for physics + vanilla SVG for rendering is well-established and documented
- Pitfalls: HIGH - CSP constraints verified via Chrome official docs, d3-force mutation behavior verified via d3-force docs
- Data model: HIGH - sitePattern schema inspected directly from codebase (sitemap-converter.js, sitemap-refiner.js, memory-schemas.js)
- Interactions (zoom/pan/drag): MEDIUM - Approach is standard but specific vanilla JS implementation needs validation during development

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain, d3-force v3 is mature)
