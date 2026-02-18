/**
 * SiteGraph -- Interactive force-directed site map visualization
 *
 * Transforms sitePattern data (from sitemap-converter.js / sitemap-refiner.js)
 * into an interactive SVG graph using d3-force physics.
 *
 * Depends on (loaded via script tags before this file):
 *   - d3-dispatch.min.js
 *   - d3-timer.min.js
 *   - d3-quadtree.min.js
 *   - d3-force.min.js
 *
 * Public API:
 *   SiteGraph.transformData(sitePattern) -> {nodes, links}
 *   SiteGraph.render(container, graphData, options) -> void
 *   SiteGraph.destroy(container) -> void
 *   SiteGraph.clearCache(memoryId) -> void
 *   SiteGraph.clearAllCache() -> void
 */

const SiteGraph = (function () {
  'use strict';

  // ---------------------------------------------------------------
  // Cache: memoryId -> { nodes, links, settled }
  // ---------------------------------------------------------------
  const _cache = new Map();

  // Default canvas dimensions
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 400;

  // SVG namespace
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------
  // Utility: deep clone an object (JSON round-trip, sufficient for
  // plain data -- d3-force mutates node objects with x/y/vx/vy)
  // ---------------------------------------------------------------
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ---------------------------------------------------------------
  // Utility: truncate string to maxLen, append ellipsis if needed
  // ---------------------------------------------------------------
  function truncate(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '\u2026';
  }

  // ---------------------------------------------------------------
  // Utility: determine purpose-based color for page nodes
  // ---------------------------------------------------------------
  function purposeColor(purpose) {
    if (!purpose || typeof purpose !== 'string') return 'var(--primary-color, #ff6b35)';
    const lower = purpose.toLowerCase();
    if (lower.includes('login') || lower.includes('auth') || lower.includes('sign in') || lower.includes('register')) {
      return '#8b5cf6'; // purple
    }
    if (lower.includes('search') || lower.includes('find') || lower.includes('query')) {
      return '#06b6d4'; // cyan
    }
    if (lower.includes('dashboard') || lower.includes('admin') || lower.includes('panel')) {
      return '#f59e0b'; // amber
    }
    if (lower.includes('profile') || lower.includes('account') || lower.includes('settings') || lower.includes('user')) {
      return '#ec4899'; // pink
    }
    return 'var(--primary-color, #ff6b35)';
  }

  // ---------------------------------------------------------------
  // transformData(sitePattern) -> { nodes: [], links: [] }
  // ---------------------------------------------------------------
  function transformData(sitePattern) {
    if (!sitePattern) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];
    const nodeIdSet = new Set();
    const pages = sitePattern.pages || {};
    const navigation = sitePattern.navigation || [];
    const forms = sitePattern.forms || [];
    const workflows = sitePattern.workflows || [];
    const pagePurposes = sitePattern.pagePurposes || {};

    // ------ Page nodes ------
    for (const [path, info] of Object.entries(pages)) {
      const nodeId = 'page:' + path;
      if (nodeIdSet.has(nodeId)) continue;
      nodeIdSet.add(nodeId);

      const elementCount = info.elementCount || 0;
      const formCount = info.formCount || 0;
      const size = Math.max(8, Math.min(25, 8 + elementCount / 10 + formCount * 3));

      nodes.push({
        id: nodeId,
        type: 'page',
        label: truncate(info.title || path, 30),
        path: path,
        title: info.title || '',
        elementCount: elementCount,
        formCount: formCount,
        linkCount: info.linkCount || 0,
        purpose: pagePurposes[path] || '',
        size: size,
        // Random initial positions to prevent force explosion
        x: Math.random() * DEFAULT_WIDTH,
        y: Math.random() * DEFAULT_HEIGHT
      });
    }

    // ------ Form nodes ------
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const fields = form.fields || [];
      const formPage = form.page || '/';
      const nodeId = 'form:' + formPage + ':' + fields.join(',');
      if (nodeIdSet.has(nodeId)) continue;
      nodeIdSet.add(nodeId);

      const labelFields = fields.slice(0, 3).join(', ');
      nodes.push({
        id: nodeId,
        type: 'form',
        label: truncate('Form: ' + (labelFields || 'empty'), 30),
        fields: fields,
        action: form.action || 'submit',
        parentPage: formPage,
        size: 10,
        x: Math.random() * DEFAULT_WIDTH,
        y: Math.random() * DEFAULT_HEIGHT
      });

      // Link form to its parent page
      const parentId = 'page:' + formPage;
      if (nodeIdSet.has(parentId)) {
        links.push({
          source: parentId,
          target: nodeId,
          type: 'form'
        });
      }
    }

    // ------ Navigation links ------
    // Find the root or first page to serve as source
    const rootId = nodeIdSet.has('page:/') ? 'page:/' : (nodes.length > 0 ? nodes[0].id : null);

    for (const nav of navigation) {
      const targetId = 'page:' + nav.path;
      if (!rootId || !nodeIdSet.has(targetId)) continue;
      // Skip self-links
      if (rootId === targetId) continue;

      links.push({
        source: rootId,
        target: targetId,
        type: 'navigation',
        label: nav.label || ''
      });
    }

    // ------ Workflow links ------
    for (const wf of workflows) {
      if (typeof wf !== 'string') continue;
      try {
        // Parse "Step A -> Step B -> Step C" into sequential edges
        const steps = wf.split('->').map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < steps.length - 1; i++) {
          const fromStep = steps[i];
          const toStep = steps[i + 1];

          // Try to match steps to page nodes by path substring
          const fromNode = findNodeByLabel(nodes, fromStep);
          const toNode = findNodeByLabel(nodes, toStep);

          if (fromNode && toNode && fromNode.id !== toNode.id) {
            links.push({
              source: fromNode.id,
              target: toNode.id,
              type: 'workflow'
            });
          }
        }
      } catch (e) {
        // Skip malformed workflow strings
      }
    }

    return { nodes: nodes, links: links };
  }

  // Helper: find a node whose path or label partially matches a step string
  function findNodeByLabel(nodes, step) {
    const lower = step.toLowerCase();
    // Try exact path match first (e.g. "/jobs/view")
    for (const n of nodes) {
      if (n.path && lower.includes(n.path.toLowerCase())) return n;
    }
    // Try label match
    for (const n of nodes) {
      if (n.label && lower.includes(n.label.toLowerCase())) return n;
    }
    // Try path-in-step match (step might contain "/path")
    const pathMatch = step.match(/\/[\w\-\/{}]+/);
    if (pathMatch) {
      for (const n of nodes) {
        if (n.path && n.path === pathMatch[0]) return n;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------
  // render(container, graphData, options)
  // ---------------------------------------------------------------
  function render(container, graphData, options) {
    if (!container || !graphData) return;

    const opts = Object.assign({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, options || {});
    const width = opts.width;
    const height = opts.height;

    // Deep-clone data so d3-force mutations do not affect caller
    const nodes = deepClone(graphData.nodes || []);
    const links = deepClone(graphData.links || []);

    if (nodes.length === 0) return;

    // Remove any previous graph in this container
    destroy(container);

    // ---- Create SVG ----
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'site-graph-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.style.cursor = 'grab';
    container.appendChild(svg);

    // Store original viewBox for zoom clamping
    const viewState = {
      x: 0, y: 0, w: width, h: height,
      origW: width, origH: height,
      isPanning: false, panStartX: 0, panStartY: 0,
      panVBX: 0, panVBY: 0,
      dragNode: null
    };

    // ---- Arrow marker defs ----
    const defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);

    function createMarker(id, color) {
      const marker = document.createElementNS(SVG_NS, 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '20');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      path.setAttribute('fill', color);
      marker.appendChild(path);
      defs.appendChild(marker);
    }

    createMarker('arrow-nav', '#0891b2');
    createMarker('arrow-workflow', '#059669');

    // ---- Link group (rendered first = behind nodes) ----
    const linkGroup = document.createElementNS(SVG_NS, 'g');
    linkGroup.setAttribute('class', 'site-graph-links');
    svg.appendChild(linkGroup);

    const linkElements = [];
    for (const link of links) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('stroke-width', '1.5');

      if (link.type === 'navigation') {
        line.setAttribute('stroke', '#0891b2');
        line.setAttribute('marker-end', 'url(#arrow-nav)');
      } else if (link.type === 'form') {
        line.setAttribute('stroke', '#d97706');
      } else if (link.type === 'workflow') {
        line.setAttribute('stroke', '#059669');
        line.setAttribute('stroke-dasharray', '5,3');
        line.setAttribute('marker-end', 'url(#arrow-workflow)');
      } else {
        line.setAttribute('stroke', '#94a3b8');
      }

      line.setAttribute('stroke-opacity', '0.6');
      linkGroup.appendChild(line);
      linkElements.push({ el: line, data: link });
    }

    // ---- Node group (on top) ----
    const nodeGroup = document.createElementNS(SVG_NS, 'g');
    nodeGroup.setAttribute('class', 'site-graph-nodes');
    svg.appendChild(nodeGroup);

    const nodeElements = [];
    for (const node of nodes) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'site-graph-node');
      g.style.cursor = 'pointer';

      if (node.type === 'form') {
        // Diamond shape: rotated rect
        const rect = document.createElementNS(SVG_NS, 'rect');
        const halfSize = node.size * 0.8;
        rect.setAttribute('width', String(halfSize * 2));
        rect.setAttribute('height', String(halfSize * 2));
        rect.setAttribute('x', String(-halfSize));
        rect.setAttribute('y', String(-halfSize));
        rect.setAttribute('transform', 'rotate(45)');
        rect.setAttribute('fill', '#d97706');
        rect.setAttribute('stroke', '#92400e');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('rx', '2');
        g.appendChild(rect);
      } else {
        // Circle for page nodes
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', String(node.size));
        circle.setAttribute('fill', purposeColor(node.purpose));
        circle.setAttribute('stroke', '#1e293b');
        circle.setAttribute('stroke-width', '1.5');
        g.appendChild(circle);
      }

      // Label text below node
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', String(node.size + 14));
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', 'var(--text-secondary, #94a3b8)');
      text.setAttribute('pointer-events', 'none');
      text.textContent = truncate(node.label, 15);
      g.appendChild(text);

      nodeGroup.appendChild(g);
      nodeElements.push({ el: g, data: node });
    }

    // ---- Tooltip ----
    const tooltip = document.createElement('div');
    tooltip.className = 'site-graph-tooltip';
    tooltip.style.cssText = [
      'position: absolute',
      'display: none',
      'background: var(--bg-primary, #0f172a)',
      'border: 1px solid var(--border-color, #334155)',
      'border-radius: 6px',
      'padding: 8px 12px',
      'font-size: 12px',
      'color: var(--text-primary, #f1f5f9)',
      'pointer-events: none',
      'z-index: 1000',
      'max-width: 260px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.4)',
      'line-height: 1.4'
    ].join('; ');
    // Ensure container has relative positioning for tooltip
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.appendChild(tooltip);

    // ---- Build d3-force simulation ----
    // Create index maps for link resolution
    const nodeById = new Map();
    for (const n of nodes) {
      nodeById.set(n.id, n);
    }

    // Resolve link source/target to node objects
    const resolvedLinks = [];
    for (const link of links) {
      const src = nodeById.get(link.source);
      const tgt = nodeById.get(link.target);
      if (src && tgt) {
        resolvedLinks.push({ source: src, target: tgt, type: link.type, label: link.label });
      }
    }

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(resolvedLinks)
        .id(function (d) { return d.id; })
        .distance(function (d) { return d.type === 'form' ? 50 : 80; })
      )
      .force('charge', d3.forceManyBody()
        .strength(function (d) { return d.type === 'form' ? -100 : -250; })
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide()
        .radius(function (d) { return d.size + 5; })
      )
      .alphaDecay(0.02);

    // On each tick, update SVG positions
    simulation.on('tick', function () {
      // Update links
      for (let i = 0; i < linkElements.length; i++) {
        const le = linkElements[i];
        const rl = resolvedLinks[i];
        if (!rl) continue;
        le.el.setAttribute('x1', String(rl.source.x || 0));
        le.el.setAttribute('y1', String(rl.source.y || 0));
        le.el.setAttribute('x2', String(rl.target.x || 0));
        le.el.setAttribute('y2', String(rl.target.y || 0));
      }

      // Update nodes
      for (const ne of nodeElements) {
        const d = ne.data;
        ne.el.setAttribute('transform', 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')');
      }
    });

    // Store simulation reference for cleanup
    container._siteGraphSim = simulation;
    container._siteGraphSVG = svg;
    container._siteGraphTooltip = tooltip;

    // ---- Interaction: Node Drag ----
    for (const ne of nodeElements) {
      ne.el.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        viewState.dragNode = ne.data;
        ne.data.fx = ne.data.x;
        ne.data.fy = ne.data.y;
        simulation.alphaTarget(0.3).restart();
        svg.style.cursor = 'grabbing';
      });
    }

    function svgPoint(clientX, clientY) {
      // Convert screen coords to SVG viewBox coords
      var rect = svg.getBoundingClientRect();
      var scaleX = viewState.w / rect.width;
      var scaleY = viewState.h / rect.height;
      return {
        x: viewState.x + (clientX - rect.left) * scaleX,
        y: viewState.y + (clientY - rect.top) * scaleY
      };
    }

    svg.addEventListener('mousemove', function (e) {
      if (viewState.dragNode) {
        var pt = svgPoint(e.clientX, e.clientY);
        viewState.dragNode.fx = pt.x;
        viewState.dragNode.fy = pt.y;
        return;
      }
      if (viewState.isPanning) {
        var rect = svg.getBoundingClientRect();
        var scaleX = viewState.w / rect.width;
        var scaleY = viewState.h / rect.height;
        var dx = (e.clientX - viewState.panStartX) * scaleX;
        var dy = (e.clientY - viewState.panStartY) * scaleY;
        viewState.x = viewState.panVBX - dx;
        viewState.y = viewState.panVBY - dy;
        svg.setAttribute('viewBox', viewState.x + ' ' + viewState.y + ' ' + viewState.w + ' ' + viewState.h);
      }
    });

    svg.addEventListener('mouseup', function () {
      if (viewState.dragNode) {
        viewState.dragNode.fx = null;
        viewState.dragNode.fy = null;
        viewState.dragNode = null;
        simulation.alphaTarget(0);
        svg.style.cursor = 'grab';
      }
      if (viewState.isPanning) {
        viewState.isPanning = false;
        svg.style.cursor = 'grab';
      }
    });

    svg.addEventListener('mouseleave', function () {
      if (viewState.dragNode) {
        viewState.dragNode.fx = null;
        viewState.dragNode.fy = null;
        viewState.dragNode = null;
        simulation.alphaTarget(0);
      }
      viewState.isPanning = false;
      svg.style.cursor = 'grab';
      tooltip.style.display = 'none';
    });

    // ---- Interaction: Pan (background drag) ----
    svg.addEventListener('mousedown', function (e) {
      // Only pan when clicking background (not a node)
      if (viewState.dragNode) return;
      viewState.isPanning = true;
      viewState.panStartX = e.clientX;
      viewState.panStartY = e.clientY;
      viewState.panVBX = viewState.x;
      viewState.panVBY = viewState.y;
      svg.style.cursor = 'grabbing';
    });

    // ---- Interaction: Zoom (mouse wheel) ----
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
      var newW = viewState.w * scaleFactor;
      var newH = viewState.h * scaleFactor;

      // Clamp zoom between 0.3x and 3x of original dimensions
      if (newW < viewState.origW * 0.33 || newW > viewState.origW * 3) return;
      if (newH < viewState.origH * 0.33 || newH > viewState.origH * 3) return;

      // Zoom toward cursor position
      var pt = svgPoint(e.clientX, e.clientY);
      var ratio = 1 - scaleFactor;
      viewState.x += (pt.x - viewState.x) * ratio;
      viewState.y += (pt.y - viewState.y) * ratio;
      viewState.w = newW;
      viewState.h = newH;

      svg.setAttribute('viewBox', viewState.x + ' ' + viewState.y + ' ' + viewState.w + ' ' + viewState.h);
    }, { passive: false });

    // ---- Interaction: Tooltip ----
    for (const ne of nodeElements) {
      ne.el.addEventListener('mouseenter', function (e) {
        var d = ne.data;
        var html = '';
        if (d.type === 'page') {
          html = '<strong>' + escapeHtml(d.title || d.path || '') + '</strong><br>';
          html += 'Path: ' + escapeHtml(d.path || '') + '<br>';
          html += 'Elements: ' + (d.elementCount || 0) + '<br>';
          html += 'Forms: ' + (d.formCount || 0) + '<br>';
          html += 'Links: ' + (d.linkCount || 0);
          if (d.purpose) {
            html += '<br><em>' + escapeHtml(d.purpose) + '</em>';
          }
        } else if (d.type === 'form') {
          html = '<strong>Form</strong><br>';
          html += 'Fields: ' + escapeHtml((d.fields || []).join(', ')) + '<br>';
          html += 'Action: ' + escapeHtml(d.action || 'submit') + '<br>';
          html += 'Page: ' + escapeHtml(d.parentPage || '');
        }
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        positionTooltip(e);
      });

      ne.el.addEventListener('mousemove', function (e) {
        positionTooltip(e);
      });

      ne.el.addEventListener('mouseleave', function () {
        tooltip.style.display = 'none';
      });
    }

    function positionTooltip(e) {
      var containerRect = container.getBoundingClientRect();
      var x = e.clientX - containerRect.left + 12;
      var y = e.clientY - containerRect.top - 10;
      // Prevent overflow right
      if (x + 260 > containerRect.width) {
        x = e.clientX - containerRect.left - 270;
      }
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
  }

  // ---------------------------------------------------------------
  // Helper: escape HTML for tooltip content
  // ---------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------
  // destroy(container)
  // ---------------------------------------------------------------
  function destroy(container) {
    if (!container) return;

    if (container._siteGraphSim) {
      container._siteGraphSim.stop();
      delete container._siteGraphSim;
    }

    if (container._siteGraphSVG) {
      container._siteGraphSVG.remove();
      delete container._siteGraphSVG;
    }

    if (container._siteGraphTooltip) {
      container._siteGraphTooltip.remove();
      delete container._siteGraphTooltip;
    }
  }

  // ---------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------
  function cacheGet(memoryId) {
    return _cache.get(memoryId) || null;
  }

  function cacheSet(memoryId, graphData) {
    _cache.set(memoryId, {
      nodes: deepClone(graphData.nodes),
      links: deepClone(graphData.links),
      settled: true
    });
  }

  function clearCache(memoryId) {
    _cache.delete(memoryId);
  }

  function clearAllCache() {
    _cache.clear();
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  return {
    transformData: transformData,
    render: render,
    destroy: destroy,
    cache: {
      get: cacheGet,
      set: cacheSet,
      clear: clearCache,
      clearAll: clearAllCache
    },
    clearCache: clearCache,
    clearAllCache: clearAllCache
  };
})();

// Export to global scope for options.js and other consumers
if (typeof self !== 'undefined') {
  self.SiteGraph = SiteGraph;
}
