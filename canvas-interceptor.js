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

    // Filter out background clears (fillRect covering >80% of canvas with white/near-white fill)
    const isBackground = (r) => {
      if (r.type !== 'fillRect') return false;
      if (r.w * r.h < cw * ch * 0.5) return false;
      const f = (r.fill || '').toLowerCase();
      return f === '#ffffff' || f === '#fff' || f === 'white' || f === 'rgba(255,255,255,1)' || f === 'rgb(255,255,255)';
    };
    const rects = rawRects.filter(r => !isBackground(r));

    // Filter out white-fill-only paths (canvas clear paths)
    const isWhiteFill = (p) => {
      if (!p.fill) return false;
      const f = p.fill.toLowerCase();
      return (f === '#ffffff' || f === '#fff' || f === 'white') && !p.stroke;
    };
    const contentPaths = rawPaths.filter(p => !isWhiteFill(p));

    // Deduplicate texts (same text at same position)
    const textKey = (t) => `${t.text}@${t.x},${t.y}`;
    const seenTexts = new Set();
    const texts = rawTexts.filter(t => {
      const k = textKey(t);
      if (seenTexts.has(k)) return false;
      seenTexts.add(k);
      return true;
    });

    // --- SHAPE DETECTION ---
    // Group nearby paths by bounding box proximity and color into "shapes"
    // roughjs draws each shape as multiple path segments with randomized jitter

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

    // Cluster paths: merge paths whose bounding boxes overlap (within 20px margin)
    const clusters = [];
    const used = new Set();
    for (let i = 0; i < contentPaths.length; i++) {
      if (used.has(i)) continue;
      const cluster = [i];
      used.add(i);
      const bbox = pathBBox(contentPaths[i]);
      let merged = { ...bbox };
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < contentPaths.length; j++) {
          if (used.has(j)) continue;
          const jBox = pathBBox(contentPaths[j]);
          if (bboxOverlap(merged, jBox, 20)) {
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
      const clusterPaths = cluster.map(idx => contentPaths[idx]);
      const colors = new Set();
      clusterPaths.forEach(p => { if (p.stroke) colors.add(p.stroke); if (p.fill && p.fill !== '#ffffff') colors.add(p.fill); });
      const hasArc = clusterPaths.some(p => p.points.some(pt => pt.isArc || pt.isEllipse));
      const w = merged.maxX - merged.minX;
      const h = merged.maxY - merged.minY;

      // Guess shape type from geometry
      let shapeType = 'shape';
      if (hasArc && Math.abs(w - h) < 30) shapeType = 'circle';
      else if (hasArc) shapeType = 'ellipse';
      else if (w > h * 3 || h > w * 3) shapeType = 'line';
      else if (w > 30 && h > 30) shapeType = 'rectangle';

      // Find text labels near this shape
      const nearTexts = texts.filter(t =>
        t.x >= merged.minX - 30 && t.x <= merged.maxX + 30 &&
        t.y >= merged.minY - 30 && t.y <= merged.maxY + 30
      );

      clusters.push({
        type: shapeType,
        x: Math.round(merged.minX),
        y: Math.round(merged.minY),
        w: Math.round(w),
        h: Math.round(h),
        color: [...colors].join(', ') || 'black',
        pathCount: cluster.length,
        label: nearTexts.map(t => t.text).join(' ') || null
      });
    }

    // Also add standalone rects as shapes (non-roughjs apps use fillRect/strokeRect directly)
    for (const r of rects) {
      // Skip tiny rects (UI artifacts) and very large rects (panels)
      if (r.w < 10 || r.h < 10) continue;
      if (r.w > cw * 0.8 && r.h > ch * 0.8) continue;
      const nearTexts = texts.filter(t =>
        t.x >= r.x - 10 && t.x <= r.x + r.w + 10 &&
        t.y >= r.y - 10 && t.y <= r.y + r.h + 10
      );
      clusters.push({
        type: 'rectangle',
        x: r.x, y: r.y, w: r.w, h: r.h,
        color: r.fill !== '#ffffff' && r.fill !== 'white' ? r.fill : r.stroke || 'black',
        pathCount: 1,
        label: nearTexts.map(t => t.text).join(' ') || null
      });
    }

    // Sort shapes by position (top to bottom, left to right)
    clusters.sort((a, b) => a.y - b.y || a.x - b.x);

    // Build summary
    const shapeCount = clusters.length;
    const textCount = texts.length;
    const labeledCount = clusters.filter(s => s.label).length;
    let summary = `${shapeCount} shape${shapeCount !== 1 ? 's' : ''}`;
    if (textCount > 0) summary += `, ${textCount} text label${textCount !== 1 ? 's' : ''}`;
    if (labeledCount > 0) summary += ` (${labeledCount} labeled)`;
    if (shapeCount === 0 && textCount === 0) summary = 'Canvas appears empty (no drawn content detected)';

    return {
      texts: texts,
      shapes: clusters,
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
