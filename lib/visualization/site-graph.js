/**
 * SiteGraph -- NotebookLM-inspired radial mind map site visualization
 *
 * Transforms sitePattern data (from sitemap-converter.js / sitemap-refiner.js)
 * into an interactive SVG radial mind map with pill-shaped nodes, thick organic
 * branch lines, and element sub-nodes.
 *
 * No external dependencies required.
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

  var _cache = new Map();
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function truncate(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '\u2026';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------
  // Color palette -- Google/NotebookLM inspired
  // ---------------------------------------------------------------
  var BRANCH_COLORS = [
    '#4285f4', '#34a853', '#ea4335', '#fbbc04',
    '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
    '#14b8a6', '#a855f7', '#0891b2', '#d946ef'
  ];

  function purposeColor(purpose) {
    if (!purpose || typeof purpose !== 'string') return null;
    var lower = purpose.toLowerCase();
    if (lower.includes('login') || lower.includes('auth') || lower.includes('sign in') || lower.includes('register')) return '#8b5cf6';
    if (lower.includes('search') || lower.includes('find') || lower.includes('query')) return '#06b6d4';
    if (lower.includes('dashboard') || lower.includes('admin') || lower.includes('panel')) return '#f59e0b';
    if (lower.includes('profile') || lower.includes('account') || lower.includes('settings') || lower.includes('user')) return '#ec4899';
    return null;
  }

  // ---------------------------------------------------------------
  // Parse CSS selector into friendly display name
  // ---------------------------------------------------------------
  function parseSelector(selector) {
    if (!selector || typeof selector !== 'string') return 'element';
    var attrMatch = selector.match(/\[(?:name|data-testid|aria-label|placeholder|id)="([^"]+)"\]/);
    if (attrMatch) return attrMatch[1];
    var idMatch = selector.match(/#([\w-]+)/);
    if (idMatch) return idMatch[1];
    var classMatches = selector.match(/\.([\w-]+)/g);
    if (classMatches && classMatches.length > 0) {
      return classMatches[classMatches.length - 1].substring(1);
    }
    var tagMatch = selector.match(/^(\w+)/);
    if (tagMatch) return tagMatch[1];
    return selector.replace(/[[\]"'=]/g, '').substring(0, 15);
  }

  function selectorType(selector) {
    if (!selector) return 'el';
    var s = selector.toLowerCase();
    if (/^button\b|\.btn/.test(s)) return 'btn';
    if (/^input\b|^textarea\b/.test(s)) return 'input';
    if (/^a\b|\.link|\.nav/.test(s)) return 'link';
    if (/^select\b/.test(s)) return 'select';
    if (/^img\b/.test(s)) return 'img';
    return 'el';
  }

  // ---------------------------------------------------------------
  // Pill dimension lookup
  // ---------------------------------------------------------------
  function getPillDims(node, rootId, detailLevel) {
    var isRoot = node.id === rootId;
    var type = node.type;

    if (isRoot) {
      return detailLevel === 'full'
        ? { w: 170, h: 48, rx: 24, fontSize: 14, maxChars: 20 }
        : { w: 150, h: 36, rx: 18, fontSize: 13, maxChars: 18 };
    }
    if (type === 'page') {
      return detailLevel === 'full'
        ? { w: 140, h: 40, rx: 12, fontSize: 11, maxChars: 18 }
        : { w: 120, h: 28, rx: 14, fontSize: 10, maxChars: 15 };
    }
    if (type === 'form') {
      return detailLevel === 'full'
        ? { w: 120, h: 34, rx: 10, fontSize: 10, maxChars: 16 }
        : { w: 100, h: 24, rx: 12, fontSize: 9, maxChars: 13 };
    }
    // element
    return detailLevel === 'full'
      ? { w: 90, h: 24, rx: 12, fontSize: 9, maxChars: 14 }
      : { w: 76, h: 20, rx: 10, fontSize: 8, maxChars: 11 };
  }

  // ---------------------------------------------------------------
  // BFS depth computation from root using links
  // ---------------------------------------------------------------
  function computeDepthBFS(nodes, links) {
    var nodeById = new Map();
    for (var i = 0; i < nodes.length; i++) nodeById.set(nodes[i].id, nodes[i]);

    var adj = new Map();
    for (var i = 0; i < nodes.length; i++) adj.set(nodes[i].id, []);
    for (var i = 0; i < links.length; i++) {
      var srcId = typeof links[i].source === 'string' ? links[i].source : links[i].source.id;
      var tgtId = typeof links[i].target === 'string' ? links[i].target : links[i].target.id;
      if (adj.has(srcId)) adj.get(srcId).push(tgtId);
      if (adj.has(tgtId)) adj.get(tgtId).push(srcId);
    }

    var rootId = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === 'page:/') { rootId = nodes[i].id; break; }
    }
    if (!rootId && nodes.length > 0) {
      var firstPage = nodes.find(function(n) { return n.type === 'page'; });
      rootId = firstPage ? firstPage.id : nodes[0].id;
    }
    if (!rootId) return;

    var visited = new Set();
    var queue = [{ id: rootId, depth: 0 }];
    visited.add(rootId);

    while (queue.length > 0) {
      var item = queue.shift();
      var node = nodeById.get(item.id);
      if (node) node.depth = item.depth;
      var neighbors = adj.get(item.id) || [];
      for (var j = 0; j < neighbors.length; j++) {
        if (!visited.has(neighbors[j])) {
          visited.add(neighbors[j]);
          queue.push({ id: neighbors[j], depth: item.depth + 1 });
        }
      }
    }

    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].depth === undefined || nodes[i].depth === null) nodes[i].depth = 1;
    }
  }

  // ---------------------------------------------------------------
  // transformData(sitePattern) -> { nodes: [], links: [] }
  // ---------------------------------------------------------------
  function transformData(sitePattern) {
    if (!sitePattern) return { nodes: [], links: [] };

    var nodes = [];
    var links = [];
    var nodeIdSet = new Set();
    var pages = sitePattern.pages || {};
    var navigation = sitePattern.navigation || [];
    var forms = sitePattern.forms || [];
    var workflows = sitePattern.workflows || [];
    var pagePurposes = sitePattern.pagePurposes || {};
    var keySelectors = sitePattern.keySelectors || {};

    // ---- Page nodes ----
    var entries = Object.entries(pages);
    for (var idx = 0; idx < entries.length; idx++) {
      var path = entries[idx][0];
      var info = entries[idx][1];
      var nodeId = 'page:' + path;
      if (nodeIdSet.has(nodeId)) continue;
      nodeIdSet.add(nodeId);

      nodes.push({
        id: nodeId,
        type: 'page',
        label: info.title || path,
        path: path,
        title: info.title || '',
        depth: info.depth || 0,
        elementCount: info.elementCount || 0,
        formCount: info.formCount || 0,
        linkCount: info.linkCount || 0,
        purpose: pagePurposes[path] || '',
        size: 10
      });
    }

    // ---- Form nodes ----
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      var fields = form.fields || [];
      var formPage = form.page || '/';
      var fNodeId = 'form:' + formPage + ':' + fields.join(',');
      if (nodeIdSet.has(fNodeId)) continue;
      nodeIdSet.add(fNodeId);

      nodes.push({
        id: fNodeId,
        type: 'form',
        label: (fields.slice(0, 3).join(', ')) || 'Form',
        fields: fields,
        action: form.action || 'submit',
        parentPage: formPage,
        size: 8
      });

      var parentId = 'page:' + formPage;
      if (nodeIdSet.has(parentId)) {
        links.push({ source: parentId, target: fNodeId, type: 'form' });
      }
    }

    // ---- Element nodes from keySelectors ----
    var totalElNodes = 0;
    var pageCount = entries.length;
    var maxElPerPage = pageCount > 15 ? 2 : pageCount > 8 ? 3 : 5;

    for (var ePath in keySelectors) {
      if (!keySelectors.hasOwnProperty(ePath)) continue;
      var selectors = keySelectors[ePath];
      if (!Array.isArray(selectors) || selectors.length === 0) continue;

      var eParentId = 'page:' + ePath;
      if (!nodeIdSet.has(eParentId)) continue;

      var limit = Math.min(selectors.length, maxElPerPage);
      for (var k = 0; k < limit; k++) {
        if (totalElNodes >= 30) break;
        var sel = selectors[k];
        var elNodeId = 'el:' + ePath + ':' + k;
        if (nodeIdSet.has(elNodeId)) continue;
        nodeIdSet.add(elNodeId);

        nodes.push({
          id: elNodeId,
          type: 'element',
          label: parseSelector(sel),
          selector: sel,
          elType: selectorType(sel),
          parentPage: ePath,
          size: 5
        });
        links.push({ source: eParentId, target: elNodeId, type: 'element' });
        totalElNodes++;
      }
      if (totalElNodes >= 30) break;
    }

    // ---- Page-to-page links ----
    var pageLinks = sitePattern.pageLinks || [];
    if (pageLinks.length > 0) {
      for (var i = 0; i < pageLinks.length; i++) {
        var edge = pageLinks[i];
        var sourceId = 'page:' + edge.from;
        var targetId = 'page:' + edge.to;
        if (!nodeIdSet.has(sourceId) || !nodeIdSet.has(targetId)) continue;
        if (sourceId === targetId) continue;
        links.push({ source: sourceId, target: targetId, type: 'navigation', label: edge.label || '' });
      }
    } else {
      var rootId = nodeIdSet.has('page:/') ? 'page:/' : (nodes.length > 0 ? nodes[0].id : null);
      for (var i = 0; i < navigation.length; i++) {
        var navTargetId = 'page:' + navigation[i].path;
        if (!rootId || !nodeIdSet.has(navTargetId)) continue;
        if (rootId === navTargetId) continue;
        links.push({ source: rootId, target: navTargetId, type: 'navigation', label: navigation[i].label || '' });
      }
    }

    // ---- Workflow links ----
    for (var i = 0; i < workflows.length; i++) {
      var wf = workflows[i];
      if (typeof wf !== 'string') continue;
      try {
        var steps = wf.split('->').map(function(s) { return s.trim(); }).filter(Boolean);
        for (var j = 0; j < steps.length - 1; j++) {
          var fromNode = findNodeByLabel(nodes, steps[j]);
          var toNode = findNodeByLabel(nodes, steps[j + 1]);
          if (fromNode && toNode && fromNode.id !== toNode.id) {
            links.push({ source: fromNode.id, target: toNode.id, type: 'workflow' });
          }
        }
      } catch (e) {}
    }

    // ---- BFS depth fallback ----
    var hasDepth = nodes.some(function(n) { return n.type === 'page' && n.depth > 0; });
    if (!hasDepth) {
      computeDepthBFS(nodes, links);
    }

    // ---- Assign depth to form/element nodes ----
    var nodeById = new Map();
    for (var i = 0; i < nodes.length; i++) nodeById.set(nodes[i].id, nodes[i]);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'form' || nodes[i].type === 'element') {
        var parent = nodeById.get('page:' + nodes[i].parentPage);
        nodes[i].depth = parent ? (parent.depth || 0) + 1 : 2;
      }
    }

    return { nodes: nodes, links: links };
  }

  function findNodeByLabel(nodes, step) {
    var lower = step.toLowerCase();
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].path && lower.includes(nodes[i].path.toLowerCase())) return nodes[i];
    }
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].label && lower.includes(nodes[i].label.toLowerCase())) return nodes[i];
    }
    var pathMatch = step.match(/\/[\w\-\/{}]+/);
    if (pathMatch) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].path && nodes[i].path === pathMatch[0]) return nodes[i];
      }
    }
    return null;
  }

  // ---------------------------------------------------------------
  // Tree-based radial mind map layout
  // ---------------------------------------------------------------
  function computeRadialLayout(nodes, links, width, height) {
    var cx = width / 2;
    var cy = height / 2;

    var nodeById = new Map();
    for (var i = 0; i < nodes.length; i++) nodeById.set(nodes[i].id, nodes[i]);

    // Build undirected adjacency
    var adj = new Map();
    for (var i = 0; i < nodes.length; i++) adj.set(nodes[i].id, []);
    for (var i = 0; i < links.length; i++) {
      var srcId = typeof links[i].source === 'string' ? links[i].source : links[i].source.id;
      var tgtId = typeof links[i].target === 'string' ? links[i].target : links[i].target.id;
      if (adj.has(srcId)) adj.get(srcId).push(tgtId);
      if (adj.has(tgtId)) adj.get(tgtId).push(srcId);
    }

    // Find root
    var rootId = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === 'page:/' && nodes[i].type === 'page') { rootId = nodes[i].id; break; }
    }
    if (!rootId) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].type === 'page' && nodes[i].depth === 0) { rootId = nodes[i].id; break; }
      }
    }
    if (!rootId && nodes.length > 0) {
      var firstPage = nodes.find(function(n) { return n.type === 'page'; });
      rootId = firstPage ? firstPage.id : nodes[0].id;
    }

    // BFS spanning tree
    var parentMap = new Map();
    var childrenMap = new Map();
    for (var i = 0; i < nodes.length; i++) childrenMap.set(nodes[i].id, []);

    var visited = new Set();
    var bfsQueue = [rootId];
    visited.add(rootId);
    parentMap.set(rootId, null);

    while (bfsQueue.length > 0) {
      var current = bfsQueue.shift();
      var neighbors = adj.get(current) || [];
      for (var j = 0; j < neighbors.length; j++) {
        var nid = neighbors[j];
        if (!visited.has(nid)) {
          visited.add(nid);
          parentMap.set(nid, current);
          childrenMap.get(current).push(nid);
          bfsQueue.push(nid);
        }
      }
    }

    // Attach disconnected nodes to root
    for (var i = 0; i < nodes.length; i++) {
      if (!visited.has(nodes[i].id)) {
        visited.add(nodes[i].id);
        parentMap.set(nodes[i].id, rootId);
        childrenMap.get(rootId).push(nodes[i].id);
      }
    }

    // Subtree sizes
    var subtreeSize = new Map();
    function countSubtree(nid) {
      var children = childrenMap.get(nid) || [];
      var total = 1;
      for (var j = 0; j < children.length; j++) total += countSubtree(children[j]);
      subtreeSize.set(nid, total);
      return total;
    }
    countSubtree(rootId);

    // Tree depth
    var treeDepth = new Map();
    function computeTreeDepth(nid, d) {
      treeDepth.set(nid, d);
      var children = childrenMap.get(nid) || [];
      for (var j = 0; j < children.length; j++) computeTreeDepth(children[j], d + 1);
    }
    computeTreeDepth(rootId, 0);

    var maxDepth = 0;
    treeDepth.forEach(function(d) { if (d > maxDepth) maxDepth = d; });

    // Ring spacing -- sized for pill nodes
    var maxRadius = Math.min(width, height) / 2 - 80;
    var ringSpacing = maxDepth > 0 ? Math.min(155, maxRadius / maxDepth) : 155;

    // Branch color assignment -- each depth-1 subtree
    var branchColorMap = new Map();
    var rootChildren = childrenMap.get(rootId) || [];
    for (var i = 0; i < rootChildren.length; i++) {
      var colorIdx = i % BRANCH_COLORS.length;
      var stack = [rootChildren[i]];
      while (stack.length > 0) {
        var nid = stack.pop();
        branchColorMap.set(nid, colorIdx);
        var ch = childrenMap.get(nid) || [];
        for (var j = 0; j < ch.length; j++) stack.push(ch[j]);
      }
    }

    // Recursive angular sector layout
    function layoutSubtree(nid, startAngle, endAngle) {
      var node = nodeById.get(nid);
      if (!node) return;

      var depth = treeDepth.get(nid) || 0;
      var angle = (startAngle + endAngle) / 2;

      if (depth === 0) {
        node.x = cx;
        node.y = cy;
      } else {
        var r = ringSpacing * depth;
        node.x = cx + r * Math.cos(angle);
        node.y = cy + r * Math.sin(angle);
      }
      node._angle = angle;
      node._branchColor = BRANCH_COLORS[branchColorMap.get(nid) !== undefined ? branchColorMap.get(nid) : 0] || BRANCH_COLORS[0];

      var children = childrenMap.get(nid) || [];
      if (children.length === 0) return;

      var totalWeight = 0;
      for (var i = 0; i < children.length; i++) totalWeight += subtreeSize.get(children[i]) || 1;

      // Add small angular gaps between sibling subtrees
      var gapAngle = children.length > 1 ? Math.min(0.05, (endAngle - startAngle) * 0.04) : 0;
      var usableSpan = endAngle - startAngle - gapAngle * (children.length - 1);

      var currentAngle = startAngle;
      for (var i = 0; i < children.length; i++) {
        var childWeight = subtreeSize.get(children[i]) || 1;
        var childSpan = usableSpan * (childWeight / totalWeight);
        layoutSubtree(children[i], currentAngle, currentAngle + childSpan);
        currentAngle += childSpan + gapAngle;
      }
    }

    layoutSubtree(rootId, -Math.PI, Math.PI);

    return {
      maxDepth: maxDepth,
      ringSpacing: ringSpacing,
      cx: cx, cy: cy,
      childrenMap: childrenMap,
      treeDepth: treeDepth,
      rootId: rootId,
      branchColorMap: branchColorMap
    };
  }

  // ---------------------------------------------------------------
  // Pill edge point -- point on ellipse boundary closest to target
  // ---------------------------------------------------------------
  function pillEdge(cx, cy, hw, hh, tx, ty) {
    var dx = tx - cx;
    var dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };
    var angle = Math.atan2(dy, dx);
    return {
      x: cx + hw * Math.cos(angle),
      y: cy + hh * Math.sin(angle)
    };
  }

  // ---------------------------------------------------------------
  // render(container, graphData, options)
  // ---------------------------------------------------------------
  function render(container, graphData, options) {
    if (!container || !graphData) return;

    var opts = Object.assign({
      width: 600,
      height: 450,
      detailLevel: 'simple'
    }, options || {});
    var detailLevel = opts.detailLevel || 'simple';

    var nodes = deepClone(graphData.nodes || []);
    var links = deepClone(graphData.links || []);
    if (nodes.length === 0) return;

    destroy(container);

    // Compute viewBox -- give extra room for pill nodes
    var totalNodes = nodes.length;
    var scale = totalNodes > 25 ? 1.8 : totalNodes > 12 ? 1.5 : 1.3;
    var vbW = Math.round(opts.width * scale);
    var vbH = Math.round(opts.height * scale);

    // Compute layout
    var layout = computeRadialLayout(nodes, links, vbW, vbH);

    var nodeById = new Map();
    for (var i = 0; i < nodes.length; i++) nodeById.set(nodes[i].id, nodes[i]);

    // Compute pill dimensions for each node
    for (var i = 0; i < nodes.length; i++) {
      var pill = getPillDims(nodes[i], layout.rootId, detailLevel);
      nodes[i]._pillW = pill.w;
      nodes[i]._pillH = pill.h;
      nodes[i]._pillHW = pill.w / 2;
      nodes[i]._pillHH = pill.h / 2;
      nodes[i]._pillRX = pill.rx;
      nodes[i]._fontSize = pill.fontSize;
      nodes[i]._maxChars = pill.maxChars;
    }

    // Build tree edges (parent -> child)
    var treeEdges = [];
    layout.childrenMap.forEach(function(children, parentId) {
      var parentNode = nodeById.get(parentId);
      if (!parentNode) return;
      for (var j = 0; j < children.length; j++) {
        var childNode = nodeById.get(children[j]);
        if (childNode) treeEdges.push({ source: parentNode, target: childNode });
      }
    });

    // ---- Create SVG ----
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'site-graph-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(opts.height));
    svg.setAttribute('viewBox', '0 0 ' + vbW + ' ' + vbH);
    svg.style.cursor = 'grab';
    container.appendChild(svg);

    var viewState = {
      x: 0, y: 0, w: vbW, h: vbH,
      origW: vbW, origH: vbH,
      isPanning: false, panStartX: 0, panStartY: 0,
      panVBX: 0, panVBY: 0
    };

    var defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);

    // ---- Ring guides (Full mode) ----
    if (detailLevel === 'full' && layout.maxDepth > 0) {
      var guideGroup = document.createElementNS(SVG_NS, 'g');
      guideGroup.setAttribute('class', 'site-graph-ring-guides');
      svg.appendChild(guideGroup);

      for (var d = 1; d <= layout.maxDepth; d++) {
        var radius = layout.ringSpacing * d;
        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(layout.cx));
        circle.setAttribute('cy', String(layout.cy));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('class', 'ring-guide');
        guideGroup.appendChild(circle);

        var label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', String(layout.cx + radius + 6));
        label.setAttribute('y', String(layout.cy - 6));
        label.setAttribute('class', 'ring-label');
        label.textContent = 'Depth ' + d;
        guideGroup.appendChild(label);
      }
    }

    // ---- Branch lines (tree edges as organic curves) ----
    var branchGroup = document.createElementNS(SVG_NS, 'g');
    branchGroup.setAttribute('class', 'site-graph-branches');
    svg.appendChild(branchGroup);

    for (var i = 0; i < treeEdges.length; i++) {
      var edge = treeEdges[i];
      var src = edge.source;
      var tgt = edge.target;

      // Connect pill edge to pill edge
      var sp = pillEdge(src.x, src.y, src._pillHW, src._pillHH, tgt.x, tgt.y);
      var ep = pillEdge(tgt.x, tgt.y, tgt._pillHW, tgt._pillHH, src.x, src.y);

      // Organic curve: control point biased toward center
      var mx = (sp.x + ep.x) / 2;
      var my = (sp.y + ep.y) / 2;
      var qx = mx + (layout.cx - mx) * 0.18;
      var qy = my + (layout.cy - my) * 0.18;

      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M ' + sp.x + ' ' + sp.y + ' Q ' + qx + ' ' + qy + ' ' + ep.x + ' ' + ep.y);
      path.setAttribute('fill', 'none');

      // Thickness tapers with depth
      var parentDepth = layout.treeDepth.get(src.id) || 0;
      var thickness = Math.max(1.5, 5.5 - parentDepth * 1.2);
      if (detailLevel === 'full') thickness = Math.max(2, thickness + 0.5);
      path.setAttribute('stroke-width', String(thickness));

      var branchColor = tgt._branchColor || '#94a3b8';
      path.setAttribute('stroke', branchColor);
      path.setAttribute('stroke-opacity', '0.55');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('class', 'graph-branch');

      branchGroup.appendChild(path);
    }

    // ---- Workflow overlay links ----
    var extraLinkGroup = document.createElementNS(SVG_NS, 'g');
    extraLinkGroup.setAttribute('class', 'site-graph-extra-links');
    svg.appendChild(extraLinkGroup);

    var treeEdgeSet = new Set();
    for (var i = 0; i < treeEdges.length; i++) {
      treeEdgeSet.add(treeEdges[i].source.id + '->' + treeEdges[i].target.id);
      treeEdgeSet.add(treeEdges[i].target.id + '->' + treeEdges[i].source.id);
    }

    var resolvedLinks = [];
    for (var i = 0; i < links.length; i++) {
      var srcId = typeof links[i].source === 'string' ? links[i].source : links[i].source.id;
      var tgtId = typeof links[i].target === 'string' ? links[i].target : links[i].target.id;
      var s = nodeById.get(srcId);
      var t = nodeById.get(tgtId);
      if (s && t) resolvedLinks.push({ source: s, target: t, type: links[i].type, label: links[i].label });
    }

    for (var i = 0; i < resolvedLinks.length; i++) {
      var rl = resolvedLinks[i];
      var key = rl.source.id + '->' + rl.target.id;
      if (treeEdgeSet.has(key)) continue;
      if (rl.type === 'workflow') {
        var wsp = pillEdge(rl.source.x, rl.source.y, rl.source._pillHW, rl.source._pillHH, rl.target.x, rl.target.y);
        var wep = pillEdge(rl.target.x, rl.target.y, rl.target._pillHW, rl.target._pillHH, rl.source.x, rl.source.y);
        var wmx = (wsp.x + wep.x) / 2;
        var wmy = (wsp.y + wep.y) / 2;
        var wqx = wmx + (layout.cx - wmx) * 0.12;
        var wqy = wmy + (layout.cy - wmy) * 0.12;

        var wPath = document.createElementNS(SVG_NS, 'path');
        wPath.setAttribute('d', 'M ' + wsp.x + ' ' + wsp.y + ' Q ' + wqx + ' ' + wqy + ' ' + wep.x + ' ' + wep.y);
        wPath.setAttribute('fill', 'none');
        wPath.setAttribute('stroke', '#059669');
        wPath.setAttribute('stroke-width', '1.5');
        wPath.setAttribute('stroke-dasharray', '6,4');
        wPath.setAttribute('stroke-opacity', '0.4');
        wPath.setAttribute('class', 'graph-link workflow');
        extraLinkGroup.appendChild(wPath);
      }
    }

    // ---- Node group ----
    var nodeGroup = document.createElementNS(SVG_NS, 'g');
    nodeGroup.setAttribute('class', 'site-graph-nodes');
    svg.appendChild(nodeGroup);

    var nodeElements = [];

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'site-graph-node');
      g.style.cursor = 'pointer';
      g.setAttribute('transform', 'translate(' + (node.x || 0) + ',' + (node.y || 0) + ')');

      var branchColor = node._branchColor || BRANCH_COLORS[0];
      var nodeColor = purposeColor(node.purpose) || branchColor;
      var isRoot = node.id === layout.rootId;
      var hw = node._pillHW;
      var hh = node._pillHH;
      var rx = node._pillRX;
      var fs = node._fontSize;
      var maxChars = node._maxChars;

      // Pill background
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(-hw));
      rect.setAttribute('y', String(-hh));
      rect.setAttribute('width', String(hw * 2));
      rect.setAttribute('height', String(hh * 2));
      rect.setAttribute('rx', String(rx));

      if (isRoot) {
        // Root: solid filled pill
        rect.setAttribute('fill', nodeColor);
        rect.setAttribute('stroke', 'none');
        rect.setAttribute('class', 'node-pill node-pill-root');
      } else if (node.type === 'form') {
        rect.setAttribute('fill', '#d97706');
        rect.setAttribute('fill-opacity', '0.12');
        rect.setAttribute('stroke', '#d97706');
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('class', 'node-pill node-pill-form');
      } else if (node.type === 'element') {
        rect.setAttribute('fill', nodeColor);
        rect.setAttribute('fill-opacity', '0.08');
        rect.setAttribute('stroke', nodeColor);
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('stroke-dasharray', '3,2');
        rect.setAttribute('class', 'node-pill node-pill-element');
      } else {
        // Page node: pastel fill with colored border
        rect.setAttribute('fill', nodeColor);
        rect.setAttribute('fill-opacity', '0.12');
        rect.setAttribute('stroke', nodeColor);
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('class', 'node-pill node-pill-page');
      }
      g.appendChild(rect);

      // ---- Text inside pill ----
      if (isRoot) {
        var rootLabel = truncate(node.title || node.path, maxChars);
        var rootText = document.createElementNS(SVG_NS, 'text');
        rootText.setAttribute('text-anchor', 'middle');
        rootText.setAttribute('font-size', String(fs));
        rootText.setAttribute('font-weight', '700');
        rootText.setAttribute('fill', '#ffffff');
        rootText.setAttribute('pointer-events', 'none');
        rootText.setAttribute('class', 'node-pill-text');

        if (detailLevel === 'full') {
          rootText.setAttribute('dy', '-4');
          rootText.textContent = rootLabel;
          g.appendChild(rootText);

          var rootSub = document.createElementNS(SVG_NS, 'text');
          rootSub.setAttribute('text-anchor', 'middle');
          rootSub.setAttribute('font-size', String(Math.round(fs * 0.7)));
          rootSub.setAttribute('fill', 'rgba(255,255,255,0.7)');
          rootSub.setAttribute('dy', String(Math.round(fs * 0.7) + 4));
          rootSub.setAttribute('pointer-events', 'none');
          rootSub.textContent = truncate(node.path, 22);
          g.appendChild(rootSub);
        } else {
          rootText.setAttribute('dy', '4');
          rootText.textContent = rootLabel;
          g.appendChild(rootText);
        }

      } else if (node.type === 'page') {
        var pageLabel = truncate(node.title || node.path, maxChars);
        var pageText = document.createElementNS(SVG_NS, 'text');
        pageText.setAttribute('text-anchor', 'middle');
        pageText.setAttribute('font-size', String(fs));
        pageText.setAttribute('font-weight', '600');
        pageText.setAttribute('pointer-events', 'none');
        pageText.setAttribute('class', 'node-pill-text');

        if (detailLevel === 'full') {
          pageText.setAttribute('dy', '-3');
          pageText.textContent = pageLabel;
          g.appendChild(pageText);

          // Stats line
          var statsText = document.createElementNS(SVG_NS, 'text');
          statsText.setAttribute('text-anchor', 'middle');
          statsText.setAttribute('font-size', String(Math.round(fs * 0.75)));
          statsText.setAttribute('dy', String(Math.round(fs * 0.75) + 4));
          statsText.setAttribute('pointer-events', 'none');
          statsText.setAttribute('class', 'node-pill-stats');
          statsText.textContent = (node.elementCount || 0) + ' el  ' + (node.formCount || 0) + ' fm  ' + (node.linkCount || 0) + ' lk';
          g.appendChild(statsText);
        } else {
          pageText.setAttribute('dy', '4');
          pageText.textContent = pageLabel;
          g.appendChild(pageText);
        }

      } else if (node.type === 'form') {
        var formLabel = truncate(node.label || 'Form', maxChars);
        var formText = document.createElementNS(SVG_NS, 'text');
        formText.setAttribute('text-anchor', 'middle');
        formText.setAttribute('font-size', String(fs));
        formText.setAttribute('font-weight', '500');
        formText.setAttribute('pointer-events', 'none');
        formText.setAttribute('class', 'node-pill-text node-pill-text-form');

        if (detailLevel === 'full') {
          formText.setAttribute('dy', '-2');
          formText.textContent = formLabel;
          g.appendChild(formText);

          var actionText = document.createElementNS(SVG_NS, 'text');
          actionText.setAttribute('text-anchor', 'middle');
          actionText.setAttribute('font-size', String(Math.round(fs * 0.8)));
          actionText.setAttribute('dy', String(Math.round(fs * 0.8) + 4));
          actionText.setAttribute('pointer-events', 'none');
          actionText.setAttribute('class', 'node-pill-stats');
          actionText.textContent = truncate(node.action || 'submit', 14);
          g.appendChild(actionText);
        } else {
          formText.setAttribute('dy', '3');
          formText.textContent = formLabel;
          g.appendChild(formText);
        }

      } else if (node.type === 'element') {
        var elLabel = truncate(node.label || 'element', maxChars);
        var elText = document.createElementNS(SVG_NS, 'text');
        elText.setAttribute('text-anchor', 'middle');
        elText.setAttribute('dy', '3');
        elText.setAttribute('font-size', String(fs));
        elText.setAttribute('pointer-events', 'none');
        elText.setAttribute('class', 'node-pill-text node-pill-text-el');
        elText.textContent = elLabel;
        g.appendChild(elText);
      }

      nodeGroup.appendChild(g);
      nodeElements.push({ el: g, data: node });
    }

    // ---- Tooltip ----
    var tooltip = document.createElement('div');
    tooltip.className = 'site-graph-tooltip';
    tooltip.style.cssText = [
      'position: absolute',
      'display: none',
      'background: var(--bg-primary, #0f172a)',
      'border: 1px solid var(--border-color, #334155)',
      'border-radius: 8px',
      'padding: 10px 14px',
      'font-size: 12px',
      'color: var(--text-primary, #f1f5f9)',
      'pointer-events: none',
      'z-index: 1000',
      'max-width: 280px',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.3)',
      'line-height: 1.5'
    ].join('; ');
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.appendChild(tooltip);

    container._siteGraphSVG = svg;
    container._siteGraphTooltip = tooltip;

    // ---- Pan ----
    function svgPoint(clientX, clientY) {
      var rect = svg.getBoundingClientRect();
      return {
        x: viewState.x + (clientX - rect.left) * (viewState.w / rect.width),
        y: viewState.y + (clientY - rect.top) * (viewState.h / rect.height)
      };
    }

    svg.addEventListener('mousedown', function (e) {
      viewState.isPanning = true;
      viewState.panStartX = e.clientX;
      viewState.panStartY = e.clientY;
      viewState.panVBX = viewState.x;
      viewState.panVBY = viewState.y;
      svg.style.cursor = 'grabbing';
    });

    svg.addEventListener('mousemove', function (e) {
      if (viewState.isPanning) {
        var rect = svg.getBoundingClientRect();
        var dx = (e.clientX - viewState.panStartX) * (viewState.w / rect.width);
        var dy = (e.clientY - viewState.panStartY) * (viewState.h / rect.height);
        viewState.x = viewState.panVBX - dx;
        viewState.y = viewState.panVBY - dy;
        svg.setAttribute('viewBox', viewState.x + ' ' + viewState.y + ' ' + viewState.w + ' ' + viewState.h);
      }
    });

    svg.addEventListener('mouseup', function () {
      if (viewState.isPanning) { viewState.isPanning = false; svg.style.cursor = 'grab'; }
    });

    svg.addEventListener('mouseleave', function () {
      viewState.isPanning = false;
      svg.style.cursor = 'grab';
      tooltip.style.display = 'none';
    });

    // ---- Zoom ----
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var sf = e.deltaY > 0 ? 1.12 : 0.88;
      var nw = viewState.w * sf;
      var nh = viewState.h * sf;
      if (nw < viewState.origW * 0.25 || nw > viewState.origW * 4) return;
      if (nh < viewState.origH * 0.25 || nh > viewState.origH * 4) return;
      var pt = svgPoint(e.clientX, e.clientY);
      var ratio = 1 - sf;
      viewState.x += (pt.x - viewState.x) * ratio;
      viewState.y += (pt.y - viewState.y) * ratio;
      viewState.w = nw;
      viewState.h = nh;
      svg.setAttribute('viewBox', viewState.x + ' ' + viewState.y + ' ' + viewState.w + ' ' + viewState.h);
    }, { passive: false });

    // ---- Node tooltips ----
    for (var i = 0; i < nodeElements.length; i++) {
      (function(ne) {
        ne.el.addEventListener('mouseenter', function (e) {
          e.stopPropagation();
          var d = ne.data;
          var html = '';
          if (d.type === 'page') {
            html = '<strong>' + escapeHtml(d.title || d.path || '') + '</strong><br>';
            html += '<span style="opacity:0.7">Path: ' + escapeHtml(d.path || '') + '</span><br>';
            html += 'Depth: ' + (d.depth || 0) + ' &middot; Elements: ' + (d.elementCount || 0) + '<br>';
            html += 'Forms: ' + (d.formCount || 0) + ' &middot; Links: ' + (d.linkCount || 0);
            if (d.purpose) html += '<br><em style="opacity:0.8">' + escapeHtml(d.purpose) + '</em>';
          } else if (d.type === 'form') {
            html = '<strong>Form</strong><br>';
            html += 'Fields: ' + escapeHtml((d.fields || []).join(', ')) + '<br>';
            html += 'Action: ' + escapeHtml(d.action || 'submit') + '<br>';
            html += '<span style="opacity:0.7">Page: ' + escapeHtml(d.parentPage || '') + '</span>';
          } else if (d.type === 'element') {
            html = '<strong>' + escapeHtml(d.label || '') + '</strong>';
            html += ' <span style="opacity:0.6">(' + escapeHtml(d.elType || 'el') + ')</span><br>';
            html += '<span style="opacity:0.7;font-family:monospace;font-size:11px">' + escapeHtml(d.selector || '') + '</span><br>';
            html += '<span style="opacity:0.6">Page: ' + escapeHtml(d.parentPage || '') + '</span>';
          }
          tooltip.innerHTML = html;
          tooltip.style.display = 'block';
          positionTooltip(e);
        });
        ne.el.addEventListener('mousemove', function (e) { positionTooltip(e); });
        ne.el.addEventListener('mouseleave', function () { tooltip.style.display = 'none'; });
      })(nodeElements[i]);
    }

    // ---- Click highlight (Full mode) ----
    if (detailLevel === 'full') {
      for (var i = 0; i < nodeElements.length; i++) {
        (function(ne) {
          ne.el.addEventListener('click', function (e) {
            e.stopPropagation();
            // Dim all branches
            var allBranches = branchGroup.querySelectorAll('path');
            for (var p = 0; p < allBranches.length; p++) {
              allBranches[p].setAttribute('stroke-opacity', '0.15');
            }
            // Dim all nodes
            var allNodes = nodeGroup.querySelectorAll('.site-graph-node');
            for (var n = 0; n < allNodes.length; n++) {
              allNodes[n].style.opacity = '0.3';
            }
            // Highlight this node
            ne.el.style.opacity = '1';
            // Highlight connected branches and nodes
            var nodeId = ne.data.id;
            for (var j = 0; j < treeEdges.length; j++) {
              if (treeEdges[j].source.id === nodeId || treeEdges[j].target.id === nodeId) {
                var br = branchGroup.children[j];
                if (br) { br.setAttribute('stroke-opacity', '0.9'); br.setAttribute('stroke-width', '5'); }
                // Highlight connected node
                var connId = treeEdges[j].source.id === nodeId ? treeEdges[j].target.id : treeEdges[j].source.id;
                for (var k = 0; k < nodeElements.length; k++) {
                  if (nodeElements[k].data.id === connId) nodeElements[k].el.style.opacity = '1';
                }
              }
            }
          });
        })(nodeElements[i]);
      }

      svg.addEventListener('click', function () {
        // Reset all
        var allBranches = branchGroup.querySelectorAll('path');
        for (var p = 0; p < allBranches.length; p++) {
          allBranches[p].setAttribute('stroke-opacity', '0.55');
          allBranches[p].removeAttribute('style');
        }
        var allNodes = nodeGroup.querySelectorAll('.site-graph-node');
        for (var n = 0; n < allNodes.length; n++) {
          allNodes[n].style.opacity = '';
        }
      });
    }

    function positionTooltip(e) {
      var cr = container.getBoundingClientRect();
      var x = e.clientX - cr.left + 14;
      var y = e.clientY - cr.top - 12;
      if (x + 280 > cr.width) x = e.clientX - cr.left - 290;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
  }

  // ---------------------------------------------------------------
  // destroy / cache
  // ---------------------------------------------------------------
  function destroy(container) {
    if (!container) return;
    if (container._siteGraphSim) { container._siteGraphSim.stop(); delete container._siteGraphSim; }
    if (container._siteGraphSVG) { container._siteGraphSVG.remove(); delete container._siteGraphSVG; }
    if (container._siteGraphTooltip) { container._siteGraphTooltip.remove(); delete container._siteGraphTooltip; }
  }

  function cacheGet(memoryId) { return _cache.get(memoryId) || null; }
  function cacheSet(memoryId, graphData) {
    _cache.set(memoryId, { nodes: deepClone(graphData.nodes), links: deepClone(graphData.links), settled: true });
  }
  function clearCache(memoryId) { _cache.delete(memoryId); }
  function clearAllCache() { _cache.clear(); }

  return {
    transformData: transformData,
    render: render,
    destroy: destroy,
    cache: { get: cacheGet, set: cacheSet, clear: clearCache, clearAll: clearAllCache },
    clearCache: clearCache,
    clearAllCache: clearAllCache
  };
})();

if (typeof self !== 'undefined') {
  self.SiteGraph = SiteGraph;
}
