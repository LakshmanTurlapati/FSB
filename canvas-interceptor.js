(() => {
  // Guard against double-installation
  if (window.__canvasCallLog) return;

  // Initialize globals
  window.__canvasCallLog = [];
  window.__canvasCallCount = 0;
  window.__canvasInterceptorInstalled = true;

  const MAX_LOG = 5000;

  const proto = CanvasRenderingContext2D.prototype;

  // Methods that capture style state
  const styleMethods = new Set([
    'fillRect', 'strokeRect', 'fillText', 'strokeText', 'fill', 'stroke'
  ]);

  // All methods to wrap
  const methods = [
    'fillRect', 'strokeRect', 'clearRect',
    'fillText', 'strokeText',
    'beginPath', 'closePath', 'moveTo', 'lineTo',
    'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'arcTo', 'ellipse', 'rect',
    'fill', 'stroke',
    'drawImage',
    'setTransform', 'save', 'restore'
  ];

  for (const name of methods) {
    const original = proto[name];
    if (!original) continue;
    proto[name] = function () {
      window.__canvasCallCount++;
      if (window.__canvasCallLog.length < MAX_LOG) {
        const args = [];
        for (let i = 0; i < arguments.length; i++) {
          args.push(typeof arguments[i] === 'object' ? '[object]' : arguments[i]);
        }
        const entry = { m: name, a: args };
        if (styleMethods.has(name)) {
          entry.fs = this.fillStyle;
          entry.ss = this.strokeStyle;
          entry.f = this.font;
          entry.lw = this.lineWidth;
        }
        window.__canvasCallLog.push(entry);
      }
      return original.apply(this, arguments);
    };
  }

  window.getCanvasScene = function () {
    const log = window.__canvasCallLog || [];
    if (log.length === 0) return { texts: [], shapes: [], totalCalls: 0, summary: 'Canvas is empty' };

    // Get canvas dimensions for background filter
    const canvas = document.querySelector('canvas');
    const cw = canvas ? canvas.width : 1920;
    const ch = canvas ? canvas.height : 1080;

    const rawTexts = [];
    const rawRects = [];
    const rawPaths = [];
    let currentPath = null;

    for (const entry of log) {
      switch (entry.m) {
        case 'fillText':
        case 'strokeText':
          rawTexts.push({
            text: String(entry.a[0]),
            x: Math.round(entry.a[1]),
            y: Math.round(entry.a[2]),
            font: entry.f || '',
            color: entry.m === 'fillText' ? (entry.fs || '') : (entry.ss || '')
          });
          break;
        case 'fillRect':
        case 'strokeRect':
          rawRects.push({
            type: entry.m,
            x: Math.round(entry.a[0]),
            y: Math.round(entry.a[1]),
            w: Math.round(entry.a[2]),
            h: Math.round(entry.a[3]),
            fill: entry.fs || '',
            stroke: entry.ss || ''
          });
          break;
        case 'beginPath':
          currentPath = { points: [], fill: null, stroke: null };
          break;
        case 'moveTo':
          if (currentPath) currentPath.points.push({ x: Math.round(entry.a[0]), y: Math.round(entry.a[1]) });
          break;
        case 'lineTo':
          if (currentPath) currentPath.points.push({ x: Math.round(entry.a[0]), y: Math.round(entry.a[1]) });
          break;
        case 'bezierCurveTo':
          if (currentPath) currentPath.points.push({ x: Math.round(entry.a[4]), y: Math.round(entry.a[5]) });
          break;
        case 'quadraticCurveTo':
          if (currentPath) currentPath.points.push({ x: Math.round(entry.a[2]), y: Math.round(entry.a[3]) });
          break;
        case 'arc':
          if (currentPath) currentPath.points.push({ cx: Math.round(entry.a[0]), cy: Math.round(entry.a[1]), r: Math.round(entry.a[2]), isArc: true });
          break;
        case 'ellipse':
          if (currentPath) currentPath.points.push({ cx: Math.round(entry.a[0]), cy: Math.round(entry.a[1]), rx: Math.round(entry.a[2]), ry: Math.round(entry.a[3]), isEllipse: true });
          break;
        case 'fill':
          if (currentPath && currentPath.points.length > 0) {
            currentPath.fill = entry.fs || null;
            rawPaths.push(currentPath);
          }
          currentPath = null;
          break;
        case 'stroke':
          if (currentPath && currentPath.points.length > 0) {
            currentPath.stroke = entry.ss || null;
            rawPaths.push(currentPath);
          }
          currentPath = null;
          break;
      }
    }

    // --- FILTERING ---

    const isWhiteish = (c) => {
      if (!c) return false;
      const f = c.toLowerCase();
      return f === '#ffffff' || f === '#fff' || f === 'white' ||
        f === 'rgba(255,255,255,1)' || f === 'rgb(255,255,255)' ||
        f === 'rgba(0, 0, 0, 0)' || f === 'transparent';
    };

    // Filter background clears (fillRect covering >50% canvas area with white fill)
    const rects = rawRects.filter(r => {
      if (r.type === 'fillRect' && r.w * r.h >= cw * ch * 0.5 && isWhiteish(r.fill)) return false;
      if (r.w < 5 || r.h < 5) return false; // skip tiny artifacts
      return true;
    });

    // Filter white-fill-only paths
    const contentPaths = rawPaths.filter(p => !(isWhiteish(p.fill) && !p.stroke));

    // Deduplicate texts (same text at ~same position within 5px)
    const seenTexts = new Set();
    const texts = rawTexts.filter(t => {
      const k = `${t.text}@${Math.round(t.x / 5) * 5},${Math.round(t.y / 5) * 5}`;
      if (seenTexts.has(k)) return false;
      seenTexts.add(k);
      return true;
    });

    // Deduplicate rects (same position+size within 2px tolerance)
    const seenRects = new Set();
    const uniqueRects = rects.filter(r => {
      const k = `${Math.round(r.x / 2) * 2},${Math.round(r.y / 2) * 2},${Math.round(r.w / 2) * 2},${Math.round(r.h / 2) * 2}`;
      if (seenRects.has(k)) return false;
      seenRects.add(k);
      return true;
    });

    // --- SHAPE DETECTION ---

    function pathBBox(p) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of p.points) {
        const px = pt.x !== undefined ? pt.x : pt.cx;
        const py = pt.y !== undefined ? pt.y : pt.cy;
        if (px !== undefined) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); }
        if (py !== undefined) { minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
      }
      return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    }

    function bboxOverlap(a, b, margin) {
      return a.minX - margin <= b.maxX && a.maxX + margin >= b.minX &&
             a.minY - margin <= b.maxY && a.maxY + margin >= b.minY;
    }

    // Cluster paths whose bounding boxes overlap (within 15px margin)
    const clusters = [];
    const used = new Set();
    for (let i = 0; i < contentPaths.length; i++) {
      if (used.has(i)) continue;
      const cluster = [i];
      used.add(i);
      const bbox = pathBBox(contentPaths[i]);
      if (!isFinite(bbox.minX)) continue; // skip degenerate paths
      let merged = { ...bbox };
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < contentPaths.length; j++) {
          if (used.has(j)) continue;
          const jBox = pathBBox(contentPaths[j]);
          if (!isFinite(jBox.minX)) continue;
          if (bboxOverlap(merged, jBox, 15)) {
            cluster.push(j);
            used.add(j);
            merged.minX = Math.min(merged.minX, jBox.minX);
            merged.minY = Math.min(merged.minY, jBox.minY);
            merged.maxX = Math.max(merged.maxX, jBox.maxX);
            merged.maxY = Math.max(merged.maxY, jBox.maxY);
            changed = true;
          }
        }
      }
      const w = merged.maxX - merged.minX;
      const h = merged.maxY - merged.minY;
      if (w < 5 && h < 5) continue; // skip tiny clusters

      const clusterPaths = cluster.map(idx => contentPaths[idx]);
      const colors = new Set();
      clusterPaths.forEach(p => {
        if (p.stroke && !isWhiteish(p.stroke)) colors.add(p.stroke);
        if (p.fill && !isWhiteish(p.fill)) colors.add(p.fill);
      });
      const hasArc = clusterPaths.some(p => p.points.some(pt => pt.isArc || pt.isEllipse));

      // Classify shape type from geometry
      let shapeType = 'shape';
      const aspectRatio = w > 0 ? h / w : 1;
      if (hasArc && aspectRatio > 0.7 && aspectRatio < 1.3) shapeType = 'circle';
      else if (hasArc) shapeType = 'ellipse';
      else if (w > h * 4 || h > w * 4) shapeType = 'line';
      else if (w > 20 && h > 20 && aspectRatio > 0.3 && aspectRatio < 3) shapeType = 'rectangle';
      else if (w > 10 || h > 10) shapeType = 'shape';
      else continue; // too small to be meaningful

      // Find text labels inside or near this shape
      const nearTexts = texts.filter(t =>
        t.x >= merged.minX - 20 && t.x <= merged.maxX + 20 &&
        t.y >= merged.minY - 20 && t.y <= merged.maxY + 20
      );

      clusters.push({
        type: shapeType,
        x: Math.round(merged.minX),
        y: Math.round(merged.minY),
        w: Math.round(w),
        h: Math.round(h),
        color: [...colors].slice(0, 2).join(', ') || 'black',
        pathCount: cluster.length,
        label: nearTexts.map(t => t.text).join(' ').substring(0, 80) || null
      });
    }

    // Add standalone rects (non-roughjs apps use fillRect/strokeRect directly)
    for (const r of uniqueRects) {
      if (r.w > cw * 0.8 && r.h > ch * 0.8) continue; // skip full-canvas rects
      const nearTexts = texts.filter(t =>
        t.x >= r.x - 10 && t.x <= r.x + r.w + 10 &&
        t.y >= r.y - 10 && t.y <= r.y + r.h + 10
      );
      clusters.push({
        type: 'rectangle',
        x: r.x, y: r.y, w: r.w, h: r.h,
        color: !isWhiteish(r.fill) ? r.fill : r.stroke || 'black',
        pathCount: 1,
        label: nearTexts.map(t => t.text).join(' ').substring(0, 80) || null
      });
    }

    // Sort by position, deduplicate overlapping shapes
    clusters.sort((a, b) => a.y - b.y || a.x - b.x);
    const seenShapes = new Set();
    const uniqueShapes = clusters.filter(s => {
      const k = `${Math.round(s.x / 10) * 10},${Math.round(s.y / 10) * 10},${Math.round(s.w / 10) * 10},${Math.round(s.h / 10) * 10}`;
      if (seenShapes.has(k)) return false;
      seenShapes.add(k);
      return true;
    });

    // Cap output to prevent bloating the AI prompt
    const MAX_SHAPES = 15;
    const MAX_TEXTS = 20;
    const cappedShapes = uniqueShapes.slice(0, MAX_SHAPES);
    const cappedTexts = texts.slice(0, MAX_TEXTS);

    // Build summary
    const shapeCount = uniqueShapes.length;
    const textCount = texts.length;
    const labeledCount = uniqueShapes.filter(s => s.label).length;
    let summary = `${shapeCount} shape${shapeCount !== 1 ? 's' : ''}`;
    if (textCount > 0) summary += `, ${textCount} text label${textCount !== 1 ? 's' : ''}`;
    if (labeledCount > 0) summary += ` (${labeledCount} labeled)`;
    if (shapeCount > MAX_SHAPES) summary += ` (showing first ${MAX_SHAPES})`;
    if (textCount > MAX_TEXTS) summary += ` (showing first ${MAX_TEXTS} texts)`;
    if (shapeCount === 0 && textCount === 0) summary = 'Canvas appears empty (no drawn content detected)';

    return {
      texts: cappedTexts,
      shapes: cappedShapes,
      totalCalls: window.__canvasCallCount,
      logSize: log.length,
      capped: log.length >= MAX_LOG,
      summary: summary
    };
  };

  window.triggerCanvasRerender = function () {
    window.__canvasCallLog = [];
    window.__canvasCallCount = 0;
    window.dispatchEvent(new Event('resize'));
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve({
            callCount: window.__canvasCallCount,
            logSize: window.__canvasCallLog.length
          });
        });
      });
    });
  };
})();
