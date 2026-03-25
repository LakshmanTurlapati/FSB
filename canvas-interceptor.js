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
    if (log.length === 0) return { texts: [], rects: [], paths: [], totalCalls: 0 };

    const texts = [];
    const rects = [];
    const paths = [];
    let currentPath = null;

    for (const entry of log) {
      switch (entry.m) {
        case 'fillText':
        case 'strokeText':
          texts.push({
            text: String(entry.a[0]),
            x: Math.round(entry.a[1]),
            y: Math.round(entry.a[2]),
            font: entry.f || '',
            color: entry.m === 'fillText' ? (entry.fs || '') : (entry.ss || ''),
            method: entry.m
          });
          break;
        case 'fillRect':
        case 'strokeRect':
          rects.push({
            type: entry.m,
            x: Math.round(entry.a[0]),
            y: Math.round(entry.a[1]),
            w: Math.round(entry.a[2]),
            h: Math.round(entry.a[3]),
            fill: entry.fs || '',
            stroke: entry.ss || '',
            lineWidth: entry.lw || 1
          });
          break;
        case 'beginPath':
          currentPath = { points: [], fill: null, stroke: null, lineWidth: 1 };
          break;
        case 'moveTo':
          if (currentPath) currentPath.points.push({ op: 'M', x: Math.round(entry.a[0]), y: Math.round(entry.a[1]) });
          break;
        case 'lineTo':
          if (currentPath) currentPath.points.push({ op: 'L', x: Math.round(entry.a[0]), y: Math.round(entry.a[1]) });
          break;
        case 'arc':
          if (currentPath) currentPath.points.push({ op: 'arc', cx: Math.round(entry.a[0]), cy: Math.round(entry.a[1]), r: Math.round(entry.a[2]) });
          break;
        case 'bezierCurveTo':
          if (currentPath) currentPath.points.push({ op: 'C', x: Math.round(entry.a[4]), y: Math.round(entry.a[5]) });
          break;
        case 'quadraticCurveTo':
          if (currentPath) currentPath.points.push({ op: 'Q', x: Math.round(entry.a[2]), y: Math.round(entry.a[3]) });
          break;
        case 'ellipse':
          if (currentPath) currentPath.points.push({ op: 'ellipse', cx: Math.round(entry.a[0]), cy: Math.round(entry.a[1]), rx: Math.round(entry.a[2]), ry: Math.round(entry.a[3]) });
          break;
        case 'fill':
          if (currentPath) {
            currentPath.fill = entry.fs || null;
            currentPath.lineWidth = entry.lw || 1;
            paths.push(currentPath);
            currentPath = null;
          }
          break;
        case 'stroke':
          if (currentPath) {
            currentPath.stroke = entry.ss || null;
            currentPath.lineWidth = entry.lw || 1;
            paths.push(currentPath);
            currentPath = null;
          }
          break;
      }
    }

    return {
      texts: texts,
      rects: rects,
      paths: paths.slice(0, 200),
      totalCalls: window.__canvasCallCount,
      logSize: log.length,
      capped: log.length >= 5000
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
