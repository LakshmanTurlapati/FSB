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
    if (node.discovered) {
      // Discovered (uncrawled) pages are smaller
      return detailLevel === 'full'
        ? { w: 110, h: 30, rx: 10, fontSize: 9, maxChars: 14 }
        : { w: 96, h: 24, rx: 12, fontSize: 8, maxChars: 12 };
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
        discovered: info.discovered || false,
        size: info.discovered ? 7 : 10
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

    // ---- Element nodes from pageElements (preferred) or keySelectors (fallback) ----
    var totalElNodes = 0;
    var pageCount = entries.length;
    var crawledPageCount = entries.filter(function(e) { return !e[1].discovered; }).length;
    var maxElPerPage = crawledPageCount > 20 ? 5 : crawledPageCount > 10 ? 8 : 12;
    var pageElements = sitePattern.pageElements || {};

    for (var idx2 = 0; idx2 < entries.length; idx2++) {
      var ePath = entries[idx2][0];
      var eParentId = 'page:' + ePath;
      if (!nodeIdSet.has(eParentId)) continue;
      // Skip discovered (uncrawled) pages -- they have no element data
      if (entries[idx2][1].discovered) continue;

      var richElements = pageElements[ePath];
      var fallbackSelectors = keySelectors[ePath];

      if (richElements && Array.isArray(richElements) && richElements.length > 0) {
        // Use rich interactive element data
        var limit = Math.min(richElements.length, maxElPerPage);
        for (var k = 0; k < limit; k++) {
          var el = richElements[k];
          var elNodeId = 'el:' + ePath + ':' + k;
          if (nodeIdSet.has(elNodeId)) continue;
          nodeIdSet.add(elNodeId);

          var elLabel = el.text || el.id || el.type || 'element';
          var elTypeStr = el.type || 'el';
          // Map tag names to shorter type labels
          if (elTypeStr === 'button') elTypeStr = 'btn';
          else if (elTypeStr === 'a') elTypeStr = 'link';
          else if (elTypeStr === 'input' || elTypeStr === 'textarea') elTypeStr = 'input';
          else if (elTypeStr === 'select') elTypeStr = 'select';
          else if (elTypeStr === 'img') elTypeStr = 'img';

          nodes.push({
            id: elNodeId,
            type: 'element',
            label: elLabel,
            selector: el.selector || '',
            elType: elTypeStr,
            parentPage: ePath,
            size: 5
          });
          links.push({ source: eParentId, target: elNodeId, type: 'element' });
          totalElNodes++;
        }
      } else if (fallbackSelectors && Array.isArray(fallbackSelectors) && fallbackSelectors.length > 0) {
        // Fallback to keySelectors -- fix object/string handling
        var limit = Math.min(fallbackSelectors.length, maxElPerPage);
        for (var k = 0; k < limit; k++) {
          var rawSel = fallbackSelectors[k];
          // keySelectors may be objects {selector, elementType, ...} or plain strings
          var selStr = typeof rawSel === 'string' ? rawSel : (rawSel && rawSel.selector ? rawSel.selector : '');
          var selElType = typeof rawSel === 'object' && rawSel ? (rawSel.elementType || '') : '';
          if (!selStr) continue;

          var elNodeId = 'el:' + ePath + ':' + k;
          if (nodeIdSet.has(elNodeId)) continue;
          nodeIdSet.add(elNodeId);

          nodes.push({
            id: elNodeId,
            type: 'element',
            label: parseSelector(selStr),
            selector: selStr,
            elType: selElType ? selectorType(selElType) : selectorType(selStr),
            parentPage: ePath,
            size: 5
          });
          links.push({ source: eParentId, target: elNodeId, type: 'element' });
          totalElNodes++;
        }
      }
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

    // Build tree using URL path hierarchy for page nodes (gives deeper, more natural trees)
    // instead of BFS which flattens everything to depth 1 when homepage links to all pages
    var parentMap = new Map();
    var childrenMap = new Map();
    for (var i = 0; i < nodes.length; i++) childrenMap.set(nodes[i].id, []);

    var pageNodeSet = new Set();
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'page') pageNodeSet.add(nodes[i].id);
    }

    parentMap.set(rootId, null);

    // Step 1: Assign page nodes to parents using URL path segments
    // /about/team -> parent is /about (if exists) -> otherwise /
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.id === rootId) continue;
      if (node.type !== 'page') continue;

      var path = node.path || '';
      var segments = path.split('/').filter(Boolean);
      var foundParent = null;

      // Walk up the path segments to find closest ancestor
      for (var len = segments.length - 1; len > 0; len--) {
        var ancestorPath = '/' + segments.slice(0, len).join('/');
        var ancestorId = 'page:' + ancestorPath;
        if (pageNodeSet.has(ancestorId) && ancestorId !== node.id) {
          foundParent = ancestorId;
          break;
        }
      }

      if (!foundParent) foundParent = rootId;
      if (foundParent === node.id) foundParent = rootId;

      parentMap.set(node.id, foundParent);
      childrenMap.get(foundParent).push(node.id);
    }

    // Step 2: Attach form and element nodes to their parent page
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.type !== 'form' && node.type !== 'element') continue;
      if (parentMap.has(node.id)) continue;

      var pPageId = 'page:' + (node.parentPage || '/');
      if (!childrenMap.has(pPageId)) pPageId = rootId;

      parentMap.set(node.id, pPageId);
      childrenMap.get(pPageId).push(node.id);
    }

    // Step 3: Attach any remaining unassigned nodes to root
    for (var i = 0; i < nodes.length; i++) {
      if (!parentMap.has(nodes[i].id)) {
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

    // Count nodes per depth level for overlap prevention
    var nodesAtDepth = {};
    treeDepth.forEach(function(d, nid) {
      if (!nodesAtDepth[d]) nodesAtDepth[d] = 0;
      nodesAtDepth[d]++;
    });

    // Calculate minimum ring radius per depth to prevent overlapping
    // Uses estimated pill widths to ensure nodes have enough circumference space
    var baseRingSpacing = 155;
    var maxRadius = Math.min(width, height) / 2 - 80;
    var defaultSpacing = maxDepth > 0 ? Math.min(baseRingSpacing, maxRadius / maxDepth) : baseRingSpacing;

    var ringRadii = new Map();
    ringRadii.set(0, 0);

    var prevRadius = 0;
    for (var d = 1; d <= maxDepth; d++) {
      var count = nodesAtDepth[d] || 0;
      // Estimate average pill width per node type at this depth
      var avgPillWidth = 130; // conservative average
      var padding = 25;
      var totalCircumference = count * (avgPillWidth + padding);
      var minRadius = totalCircumference / (2 * Math.PI);

      // Ensure radius increases monotonically and respects minimum spacing
      var idealRadius = defaultSpacing * d;
      var effectiveRadius = Math.max(idealRadius, minRadius, prevRadius + 80);
      ringRadii.set(d, effectiveRadius);
      prevRadius = effectiveRadius;
    }

    // Recalculate effective ring spacing for viewBox sizing
    var effectiveMaxRadius = ringRadii.get(maxDepth) || defaultSpacing * maxDepth;

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

    // Recursive angular sector layout with dynamic ring radii
    function layoutSubtree(nid, startAngle, endAngle) {
      var node = nodeById.get(nid);
      if (!node) return;

      var depth = treeDepth.get(nid) || 0;
      var angle = (startAngle + endAngle) / 2;

      if (depth === 0) {
        node.x = cx;
        node.y = cy;
      } else {
        var r = ringRadii.get(depth) || defaultSpacing * depth;
        node.x = cx + r * Math.cos(angle);
        node.y = cy + r * Math.sin(angle);
      }
      node._angle = angle;
      node._branchColor = BRANCH_COLORS[branchColorMap.get(nid) !== undefined ? branchColorMap.get(nid) : 0] || BRANCH_COLORS[0];

      var children = childrenMap.get(nid) || [];
      if (children.length === 0) return;

      var totalWeight = 0;
      for (var i = 0; i < children.length; i++) totalWeight += subtreeSize.get(children[i]) || 1;

      // Angular gaps scale with number of children to prevent crowding
      var gapAngle = children.length > 1 ? Math.min(0.08, (endAngle - startAngle) * 0.05) : 0;
      var usableSpan = endAngle - startAngle - gapAngle * (children.length - 1);

      // Enforce minimum angular span per child based on pill width at this depth
      var childDepth = (treeDepth.get(nid) || 0) + 1;
      var childRadius = ringRadii.get(childDepth) || defaultSpacing * childDepth;
      var minSpanPerChild = childRadius > 0 ? 100 / childRadius : 0.1; // ~100px minimum arc

      var currentAngle = startAngle;
      for (var i = 0; i < children.length; i++) {
        var childWeight = subtreeSize.get(children[i]) || 1;
        var childSpan = usableSpan * (childWeight / totalWeight);
        childSpan = Math.max(childSpan, minSpanPerChild);
        layoutSubtree(children[i], currentAngle, currentAngle + childSpan);
        currentAngle += childSpan + gapAngle;
      }
    }

    layoutSubtree(rootId, -Math.PI, Math.PI);

    return {
      maxDepth: maxDepth,
      ringSpacing: defaultSpacing,
      ringRadii: ringRadii,
      effectiveMaxRadius: effectiveMaxRadius,
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

    // Simple mode: show only page nodes for a clean site hierarchy overview
    if (detailLevel === 'simple') {
      var pageNodeIds = new Set();
      nodes = nodes.filter(function(n) {
        if (n.type === 'page') { pageNodeIds.add(n.id); return true; }
        return false;
      });
      links = links.filter(function(l) {
        var srcId = typeof l.source === 'string' ? l.source : l.source.id;
        var tgtId = typeof l.target === 'string' ? l.target : l.target.id;
        return pageNodeIds.has(srcId) && pageNodeIds.has(tgtId);
      });
    }

    destroy(container);

    // Compute viewBox -- scale based on node count for proper spacing
    var totalNodes = nodes.length;
    var scale = totalNodes > 60 ? 2.8 : totalNodes > 40 ? 2.3 : totalNodes > 25 ? 1.8 : totalNodes > 12 ? 1.5 : 1.3;
    var vbW = Math.round(opts.width * scale);
    var vbH = Math.round(opts.height * scale);

    // Compute layout
    var layout = computeRadialLayout(nodes, links, vbW, vbH);

    // If overlap prevention expanded rings beyond default viewBox, adjust
    if (layout.effectiveMaxRadius) {
      var neededSize = (layout.effectiveMaxRadius + 120) * 2;
      if (neededSize > vbW || neededSize > vbH) {
        vbW = Math.max(vbW, Math.round(neededSize));
        vbH = Math.max(vbH, Math.round(neededSize));
        // Recompute layout with adjusted dimensions
        layout = computeRadialLayout(nodes, links, vbW, vbH);
      }
    }

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
        var radius = (layout.ringRadii && layout.ringRadii.get(d)) || layout.ringSpacing * d;
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
      } else if (node.discovered) {
        // Discovered but uncrawled page: dashed outline, very faint fill
        rect.setAttribute('fill', nodeColor);
        rect.setAttribute('fill-opacity', '0.05');
        rect.setAttribute('stroke', nodeColor);
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('stroke-dasharray', '4,3');
        rect.setAttribute('stroke-opacity', '0.5');
        rect.setAttribute('class', 'node-pill node-pill-discovered');
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
        pageText.setAttribute('font-weight', node.discovered ? '400' : '600');
        pageText.setAttribute('pointer-events', 'none');
        pageText.setAttribute('class', 'node-pill-text');
        if (node.discovered) pageText.setAttribute('opacity', '0.6');

        if (detailLevel === 'full' && !node.discovered) {
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
      if (nw < viewState.origW * 0.08 || nw > viewState.origW * 10) return;
      if (nh < viewState.origH * 0.08 || nh > viewState.origH * 10) return;
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
            html = '<strong>' + escapeHtml(d.title || d.path || '') + '</strong>';
            if (d.discovered) html += ' <span style="opacity:0.5;font-size:10px">(discovered)</span>';
            html += '<br>';
            html += '<span style="opacity:0.7">Path: ' + escapeHtml(d.path || '') + '</span><br>';
            if (d.discovered) {
              html += '<em style="opacity:0.6">Not crawled - linked from other pages</em>';
            } else {
              html += 'Depth: ' + (d.depth || 0) + ' &middot; Elements: ' + (d.elementCount || 0) + '<br>';
              html += 'Forms: ' + (d.formCount || 0) + ' &middot; Links: ' + (d.linkCount || 0);
            }
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

  // ---------------------------------------------------------------
  // transformGuideData(guide) -> { nodes, links }
  // Converts a site guide (selectors, workflows, warnings) into
  // the same {nodes, links} format used by sitePattern mind maps.
  // ---------------------------------------------------------------
  function transformGuideData(guide) {
    if (!guide) return { nodes: [], links: [] };

    var nodes = [];
    var links = [];
    var siteName = guide.site || guide.name || 'Site Guide';

    // Root node = site name
    var rootId = 'root';
    nodes.push({
      id: rootId, type: 'page', label: siteName,
      path: '/', title: siteName, depth: 0,
      elementCount: 0, formCount: 0, linkCount: 0,
      purpose: guide.category || '', discovered: false, size: 12
    });

    // Selectors branch
    var selectors = guide.selectors || {};
    var selEntries = Object.entries(selectors);
    if (selEntries.length > 0) {
      var selGroupId = 'group:selectors';
      nodes.push({
        id: selGroupId, type: 'page', label: 'Selectors (' + selEntries.length + ')',
        path: '/selectors', title: 'Selectors', depth: 1,
        elementCount: selEntries.length, formCount: 0, linkCount: 0,
        purpose: '', discovered: false, size: 9
      });
      links.push({ source: rootId, target: selGroupId, type: 'navigation' });

      var selLimit = Math.min(selEntries.length, 12);
      for (var i = 0; i < selLimit; i++) {
        var elId = 'el:sel:' + i;
        nodes.push({
          id: elId, type: 'element',
          label: selEntries[i][0],
          selector: selEntries[i][1],
          elType: selectorType(selEntries[i][1]),
          parentPage: '/selectors', depth: 2, size: 5
        });
        links.push({ source: selGroupId, target: elId, type: 'element' });
      }
    }

    // Workflows branch
    var workflows = guide.workflows || {};
    var wfEntries = Object.entries(workflows);
    if (wfEntries.length > 0) {
      var wfGroupId = 'group:workflows';
      nodes.push({
        id: wfGroupId, type: 'page', label: 'Workflows (' + wfEntries.length + ')',
        path: '/workflows', title: 'Workflows', depth: 1,
        elementCount: 0, formCount: wfEntries.length, linkCount: 0,
        purpose: '', discovered: false, size: 9
      });
      links.push({ source: rootId, target: wfGroupId, type: 'navigation' });

      for (var i = 0; i < wfEntries.length; i++) {
        var wfId = 'form:wf:' + i;
        var steps = wfEntries[i][1];
        var stepCount = Array.isArray(steps) ? steps.length : 0;
        nodes.push({
          id: wfId, type: 'form',
          label: wfEntries[i][0],
          fields: Array.isArray(steps) ? steps.slice(0, 3) : [],
          action: stepCount + ' steps',
          parentPage: '/workflows', depth: 2, size: 7
        });
        links.push({ source: wfGroupId, target: wfId, type: 'form' });
      }
    }

    // Warnings branch
    var warnings = guide.warnings || [];
    if (warnings.length > 0) {
      var warnGroupId = 'group:warnings';
      nodes.push({
        id: warnGroupId, type: 'page', label: 'Warnings (' + warnings.length + ')',
        path: '/warnings', title: 'Warnings', depth: 1,
        elementCount: 0, formCount: 0, linkCount: 0,
        purpose: '', discovered: false, size: 9
      });
      links.push({ source: rootId, target: warnGroupId, type: 'navigation' });

      var warnLimit = Math.min(warnings.length, 8);
      for (var i = 0; i < warnLimit; i++) {
        var wId = 'el:warn:' + i;
        var warnText = warnings[i].length > 40 ? warnings[i].substring(0, 39) + '\u2026' : warnings[i];
        nodes.push({
          id: wId, type: 'element',
          label: warnText, selector: '',
          elType: 'el', parentPage: '/warnings', depth: 2, size: 5
        });
        links.push({ source: warnGroupId, target: wId, type: 'element' });
      }
    }

    return { nodes: nodes, links: links };
  }

  // ---------------------------------------------------------------
  // transformTaskData(taskMemory) -- Task Memory timeline to graph
  // ---------------------------------------------------------------
  function transformTaskData(taskMemory) {
    if (!taskMemory || !taskMemory.typeData) return { nodes: [], links: [] };

    var sess = taskMemory.typeData.session || {};
    var learned = taskMemory.typeData.learned || {};
    var timeline = sess.timeline || [];

    var nodes = [];
    var links = [];
    var nodeIdSet = {};

    // Extract domain for center node
    var domain = sess.domain || (taskMemory.metadata && taskMemory.metadata.domain) || 'site';

    // Center node = domain
    var rootId = 'domain:' + domain;
    nodes.push({
      id: rootId, type: 'page', label: domain,
      path: '/', title: domain, depth: 0,
      elementCount: 0, formCount: 0, linkCount: 0,
      purpose: '', discovered: false, size: 12
    });
    nodeIdSet[rootId] = true;

    // Extract unique pages from timeline URLs and finalUrl
    var pageNodes = {}; // path -> nodeId
    var urlsInOrder = [];

    // Collect URLs from timeline targets that look like URLs
    for (var i = 0; i < timeline.length; i++) {
      var target = timeline[i].target || '';
      if (target.match(/^https?:\/\//)) {
        urlsInOrder.push(target);
      }
    }
    // Also use finalUrl
    if (sess.finalUrl) urlsInOrder.push(sess.finalUrl);

    // Create page nodes from discovered URLs
    var prevPageId = null;
    for (var u = 0; u < urlsInOrder.length; u++) {
      var pagePath = '/';
      try {
        var parsed = new URL(urlsInOrder[u]);
        pagePath = parsed.pathname || '/';
      } catch (e) {
        pagePath = urlsInOrder[u];
      }

      var pageId = 'page:' + pagePath;
      if (!nodeIdSet[pageId]) {
        nodes.push({
          id: pageId, type: 'page', label: pagePath === '/' ? 'Home' : pagePath.replace(/^\//, '').replace(/\//g, ' / '),
          path: pagePath, title: pagePath, depth: 1,
          elementCount: 0, formCount: 0, linkCount: 0,
          purpose: '', discovered: false, size: 8
        });
        nodeIdSet[pageId] = true;
        pageNodes[pagePath] = pageId;
        links.push({ source: rootId, target: pageId, type: 'nav' });
      }

      // Navigation links between consecutive pages
      if (prevPageId && pageId !== prevPageId) {
        var linkExists = false;
        for (var li = 0; li < links.length; li++) {
          if (links[li].source === prevPageId && links[li].target === pageId) {
            linkExists = true;
            break;
          }
        }
        if (!linkExists) {
          links.push({ source: prevPageId, target: pageId, type: 'workflow' });
        }
      }
      prevPageId = pageId;
    }

    // Add interacted elements from timeline (always, even without URL context)
    var elDedup = {};
    for (var t = 0; t < timeline.length; t++) {
      var entry = timeline[t];
      if (!entry.target) continue;

      // Deduplicate by action + target
      var elKey = (entry.action || '') + ':' + entry.target;
      if (elDedup[elKey]) continue;
      elDedup[elKey] = true;

      var elId = 'el:' + t + ':' + entry.target;
      var elLabel = (entry.action || '') + ' ' + (entry.target || '');
      if (elLabel.length > 35) elLabel = elLabel.substring(0, 34) + '\u2026';

      nodes.push({
        id: elId, type: 'element', label: elLabel,
        selector: entry.target, elType: 'el',
        parentPage: '/', depth: 2, size: 5
      });
      nodeIdSet[elId] = true;
      // Link to root domain (since timeline entries lack per-step URL)
      links.push({ source: rootId, target: elId, type: 'element' });
    }

    // Add discovered selectors from learned.selectors
    var selectors = learned.selectors || [];
    for (var s = 0; s < selectors.length; s++) {
      var sel = selectors[s];
      var selName = typeof sel === 'string' ? sel : (sel.name || sel.selector || String(sel));
      var selId = 'sel:' + s + ':' + selName;
      if (nodeIdSet[selId]) continue;

      var selLabel = selName;
      if (selLabel.length > 35) selLabel = selLabel.substring(0, 34) + '\u2026';

      nodes.push({
        id: selId, type: 'element', label: selLabel,
        selector: typeof sel === 'string' ? sel : (sel.selector || ''),
        elType: 'selector', parentPage: '/', depth: 2, size: 4
      });
      nodeIdSet[selId] = true;
      links.push({ source: rootId, target: selId, type: 'element' });
    }

    // Add site structure entries from learned.siteStructure (array of strings or objects)
    var structure = learned.siteStructure || [];
    if (Array.isArray(structure)) {
      for (var d = 0; d < structure.length; d++) {
        var structEntry = structure[d];
        var structLabel = typeof structEntry === 'string' ? structEntry : (structEntry.title || structEntry.path || String(structEntry));
        var structId = 'struct:' + d;
        if (nodeIdSet[structId]) continue;

        if (structLabel.length > 35) structLabel = structLabel.substring(0, 34) + '\u2026';
        nodes.push({
          id: structId, type: 'page', label: structLabel,
          path: structLabel, title: structLabel, depth: 1,
          elementCount: 0, formCount: 0, linkCount: 0,
          purpose: '', discovered: true, size: 7
        });
        nodeIdSet[structId] = true;
        links.push({ source: rootId, target: structId, type: 'nav' });
      }
    } else if (structure && typeof structure === 'object' && structure.pages) {
      // Legacy object format: { pages: { path: { title } } }
      var dpKeys = Object.keys(structure.pages);
      for (var dp = 0; dp < dpKeys.length; dp++) {
        var dpPath = dpKeys[dp];
        var dpId = 'page:' + dpPath;
        if (nodeIdSet[dpId]) continue;

        var dpTitle = structure.pages[dpPath].title || dpPath;
        nodes.push({
          id: dpId, type: 'page', label: dpTitle,
          path: dpPath, title: dpTitle, depth: 1,
          elementCount: 0, formCount: 0, linkCount: 0,
          purpose: '', discovered: true, size: 7
        });
        nodeIdSet[dpId] = true;
        links.push({ source: rootId, target: dpId, type: 'nav' });
      }
    }

    return { nodes: nodes, links: links };
  }

  return {
    transformData: transformData,
    transformGuideData: transformGuideData,
    transformTaskData: transformTaskData,
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
