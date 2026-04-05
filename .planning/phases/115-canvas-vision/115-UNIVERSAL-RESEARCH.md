# Phase 115: Canvas Vision - Universal Text Representation Research

**Researched:** 2026-03-24
**Domain:** Converting HTML5 canvas pixel content to text representations AI models can understand
**Confidence:** HIGH (approaches verified), MEDIUM (AI comprehension assessments based on published benchmarks)

## Summary

This research exhaustively catalogs 15 approaches for converting HTML5 canvas pixel data into text that an AI model can reason about. The fundamental constraint: canvas elements are opaque pixel buffers. FSB can execute `canvas.getContext('2d').getImageData()` via CDP `Runtime.evaluate` to get raw RGBA pixel arrays, but the question is what to DO with those pixels.

The research draws on ASCIIBench (December 2025), a benchmark of 5,315 ASCII art images evaluating LLM comprehension. Key finding: GPT-4o achieves 80.23% macro accuracy on text-only ASCII art classification -- meaning models CAN understand ASCII art, but imperfectly. Text-only understanding trails vision-only by ~2-5 percentage points.

**Primary recommendation:** Implement a **two-tier approach**:
1. **Draw Call Interception** (Approach 8) for structured semantic data -- the only universal approach that gives you shapes, text, and coordinates rather than pixels. Inject early via `content_scripts` with `"world": "MAIN"` and `"run_at": "document_start"`.
2. **Dominant Color Grid + Region Description** (Approach 13 hybrid) as the pixel-based fallback for canvases where interception missed the initial render.

Screenshot-to-vision-AI (already documented in 115-RESEARCH.md) remains the simplest universal fallback at ~765-1105 tokens per image.

---

## Approach 1: ASCII Art from Canvas Pixels

### Concept
Sample canvas pixels at regular grid intervals using `getImageData()`. Map each pixel's brightness to an ASCII character from a density ramp (e.g., ` .:-=+*#%@` from light to dark).

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Configurable resolution: cols x rows of ASCII characters
  const cols = 120, rows = 40;
  const cellW = Math.floor(w / cols), cellH = Math.floor(h / rows);

  const ramp = ' .,:;i1tfLCG08@';
  const rampLen = ramp.length;

  let ascii = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * cellW, py = row * cellH;
      // Sample center pixel of each cell
      const data = ctx.getImageData(px + Math.floor(cellW/2), py + Math.floor(cellH/2), 1, 1).data;
      const brightness = (data[0] * 0.299 + data[1] * 0.587 + data[2] * 0.114) / 255;
      // Invert: dark pixels = dense characters (typical for dark-on-light canvas)
      const charIdx = Math.floor((1 - brightness) * (rampLen - 1));
      ascii += ramp[charIdx];
    }
    ascii += '\n';
  }
  return ascii;
})()
```

### Example Output (Flowchart: 3 boxes, 2 arrows, labels)

```


           @@@@@@@@@@@@@@@@@@@@@@@@
           @                    @
           @     Start          @
           @                    @
           @@@@@@@@@@@@@@@@@@@@@@@@
                    :
                    :
                    :
                    ;
           @@@@@@@@@@@@@@@@@@@@@@@@
           @                    @
           @     Process        @
           @                    @
           @@@@@@@@@@@@@@@@@@@@@@@@
                    :
                    :
                    ;
           @@@@@@@@@@@@@@@@@@@@@@@@
           @                    @
           @     End            @
           @                    @
           @@@@@@@@@@@@@@@@@@@@@@@@
```

### Token Cost
- 120x40 grid = 4,800 characters + 40 newlines = ~1,500-2,000 tokens
- 80x25 grid = 2,000 characters = ~700-900 tokens
- 60x20 grid = 1,200 characters = ~400-600 tokens

### AI Comprehension
**MEDIUM.** ASCIIBench (Dec 2025) shows GPT-4o achieves 80.23% macro accuracy on ASCII art classification (text-only). Claude 3.5 Sonnet achieves 56.98%. Models can recognize shapes and broad structure but struggle with fine details, labels inside shapes, and precise spatial relationships.

**Evidence:** The SkyPilot blog (2025) tested five multimodal LLMs on ASCII art tasks and found "all but one attempts failed to fully understand the spatial structure." GPT-4o "cheated by generating code" rather than reasoning spatially.

**Verdict:** Models can tell "there are rectangular shapes arranged vertically with lines connecting them" but may misread text labels, miss arrow directions, or confuse spatial relationships. Useful for rough layout understanding, NOT for precise element identification.

### Performance
- Single getImageData per cell: ~200-500ms for 120x40 grid (4,800 individual calls)
- Batch getImageData (full canvas once, sample from array): ~50-100ms
- Recommendation: Get full ImageData once, then sample from the array

### Batch-optimized version:

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cols = 80, rows = 30;
  const cellW = w / cols, cellH = h / rows;
  const ramp = ' .,:;i1tfLCG08@';
  const data = ctx.getImageData(0, 0, w, h).data;
  let ascii = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(col * cellW + cellW / 2);
      const py = Math.floor(row * cellH + cellH / 2);
      const idx = (py * w + px) * 4;
      const brightness = (data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114) / 255;
      const charIdx = Math.floor((1 - brightness) * (ramp.length - 1));
      ascii += ramp[charIdx];
    }
    ascii += '\n';
  }
  return ascii;
})()
```

### Universal Coverage
Works on ALL canvas apps. Fails only if canvas has CORS taint (cross-origin images drawn without CORS headers -- `getImageData` throws SecurityError).

---

## Approach 2: Block Character Art (Unicode Blocks)

### Concept
Use Unicode block characters for higher visual density: full block, dark shade, medium shade, light shade, space. These characters fill more of their cell than ASCII characters, creating a denser visual representation.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cols = 80, rows = 30;
  const cellW = w / cols, cellH = h / rows;
  // Unicode blocks: space, light shade, medium shade, dark shade, full block
  const blocks = ' \u2591\u2592\u2593\u2588';
  const data = ctx.getImageData(0, 0, w, h).data;
  let result = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(col * cellW + cellW / 2);
      const py = Math.floor(row * cellH + cellH / 2);
      const idx = (py * w + px) * 4;
      const brightness = (data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114) / 255;
      const blockIdx = Math.floor((1 - brightness) * (blocks.length - 1));
      result += blocks[blockIdx];
    }
    result += '\n';
  }
  return result;
})()
```

### Example Output

```


          xxxxxxxxxxxxxxxxxxxxxxxx
          x                      x
          x      Start           x
          x                      x
          xxxxxxxxxxxxxxxxxxxxxxxx
                   xx
                   xx
          xxxxxxxxxxxxxxxxxxxxxxxx
          x                      x
          x      Process         x
          x                      x
          xxxxxxxxxxxxxxxxxxxxxxxx
                   xx
                   xx
          xxxxxxxxxxxxxxxxxxxxxxxx
          x                      x
          x      End             x
          x                      x
          xxxxxxxxxxxxxxxxxxxxxxxx
```

(Note: x stands in for the Unicode full block character in this document since markdown rendering varies.)

### Token Cost
Similar to ASCII art: ~700-2,000 tokens depending on resolution. Unicode block characters may tokenize differently -- some tokenizers treat them as multi-byte, potentially increasing token count by 20-50%.

### AI Comprehension
**LOW-MEDIUM.** Models are LESS familiar with Unicode block art than ASCII art. Training data contains vastly more ASCII art than block art. The block characters provide less visual variety (5 levels vs 15 in ASCII ramp), making it harder for models to distinguish features.

### Performance
Same as Approach 1 (~50-100ms with batch getImageData).

### Universal Coverage
Same as Approach 1 -- works on all canvas apps except CORS-tainted ones.

---

## Approach 3: Pixel Sampling with Spatial Description

### Concept
Instead of trying to DRAW the canvas in text, DESCRIBE what is at each region. Divide the canvas into a grid (e.g., 8x6 regions) and for each region, report the dominant colors and any detected features.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const gridCols = 8, gridRows = 6;
  const cellW = Math.floor(w / gridCols), cellH = Math.floor(h / gridRows);
  const sampleSize = 10; // sample 10x10 pixels per region

  function colorName(r, g, b) {
    if (r > 200 && g > 200 && b > 200) return 'white';
    if (r < 50 && g < 50 && b < 50) return 'black';
    if (r > 150 && g < 100 && b < 100) return 'red';
    if (r < 100 && g > 150 && b < 100) return 'green';
    if (r < 100 && g < 100 && b > 150) return 'blue';
    if (r > 150 && g > 150 && b < 100) return 'yellow';
    if (r > 150 && g < 100 && b > 150) return 'purple';
    if (r > 150 && g > 100 && b < 80) return 'orange';
    if (r > 100 && g > 100 && b > 100) return 'gray';
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  const regions = [];
  const rowLabels = ['top', 'upper-mid', 'mid', 'lower-mid', 'bottom', 'very-bottom'];
  const colLabels = ['far-left', 'left', 'center-left', 'center', 'center-right', 'right', 'far-right', 'edge-right'];

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const x0 = col * cellW, y0 = row * cellH;
      const data = ctx.getImageData(x0, y0, cellW, cellH).data;
      const colorCounts = {};
      const step = Math.max(1, Math.floor(cellW * cellH / (sampleSize * sampleSize)));
      for (let i = 0; i < data.length; i += step * 4) {
        const name = colorName(data[i], data[i+1], data[i+2]);
        colorCounts[name] = (colorCounts[name] || 0) + 1;
      }
      const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
      const dominant = sorted[0][0];
      const secondary = sorted.length > 1 ? sorted[1][0] : null;
      const totalSamples = sorted.reduce((s, e) => s + e[1], 0);
      const dominantPct = Math.round(sorted[0][1] / totalSamples * 100);

      if (dominant !== 'white' || dominantPct < 90) {
        let desc = rowLabels[row] + ' ' + colLabels[col] + ': ';
        desc += dominantPct + '% ' + dominant;
        if (secondary && sorted[1][1] / totalSamples > 0.05) {
          desc += ', ' + Math.round(sorted[1][1] / totalSamples * 100) + '% ' + secondary;
        }
        regions.push(desc);
      }
    }
  }

  return 'CANVAS REGIONS (' + w + 'x' + h + ', ' + gridCols + 'x' + gridRows + ' grid):\n' +
    (regions.length === 0 ? 'Canvas appears blank (all white)' : regions.join('\n'));
})()
```

### Example Output

```
CANVAS REGIONS (1920x1080, 8x6 grid):
top center-left: 85% white, 12% black
top center: 78% white, 18% black
upper-mid center-left: 72% blue, 25% white
upper-mid center: 65% white, 20% black
mid center-left: 82% white, 15% black
mid center: 70% green, 25% white
lower-mid center-left: 82% white, 12% black
lower-mid center: 68% white, 28% black
bottom center-left: 75% red, 20% white
bottom center: 80% white, 15% black
```

### Token Cost
**Very low:** ~100-300 tokens for a typical diagram. Only non-empty regions are reported. A simple flowchart might produce 10-15 region descriptions.

### AI Comprehension
**MEDIUM.** Models are very good at understanding spatial descriptions in natural language. "Blue region in upper-mid center-left" is semantically clear. However, the description lacks shape information -- the model cannot distinguish a rectangle from a circle from a triangle, only that "something blue is there."

### Performance
~50-200ms (one getImageData per region, or one full canvas read).

### Universal Coverage
Works on all canvas apps. Same CORS restriction as other pixel approaches.

---

## Approach 4: Edge Detection to Line Drawing

### Concept
Sample pixels, detect brightness changes between neighboring pixels (Sobel-like edge detection), and convert edges to line characters: `|`, `-`, `/`, `\`, `+`. Creates a wireframe text representation that is more useful than brightness-based ASCII for diagrams.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cols = 100, rows = 35;
  const cellW = w / cols, cellH = h / rows;
  const data = ctx.getImageData(0, 0, w, h).data;

  function brightness(px, py) {
    const x = Math.min(Math.max(Math.floor(px), 0), w - 1);
    const y = Math.min(Math.max(Math.floor(py), 0), h - 1);
    const idx = (y * w + x) * 4;
    return (data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114) / 255;
  }

  const threshold = 0.15;
  let result = '';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const b = brightness(cx, cy);

      // Sobel-like gradient
      const gx = brightness(cx + cellW, cy) - brightness(cx - cellW, cy);
      const gy = brightness(cx, cy + cellH) - brightness(cx, cy - cellH);
      const mag = Math.sqrt(gx * gx + gy * gy);

      if (mag < threshold) {
        result += ' ';
      } else {
        // Determine edge direction
        const angle = Math.atan2(gy, gx) * 180 / Math.PI;
        if (angle >= -22.5 && angle < 22.5) result += '|';
        else if (angle >= 22.5 && angle < 67.5) result += '/';
        else if (angle >= 67.5 && angle < 112.5) result += '-';
        else if (angle >= 112.5 && angle < 157.5) result += '\\';
        else if (angle >= -67.5 && angle < -22.5) result += '\\';
        else if (angle >= -112.5 && angle < -67.5) result += '-';
        else if (angle >= -157.5 && angle < -112.5) result += '/';
        else result += '|';
      }
    }
    result += '\n';
  }
  return result;
})()
```

### Example Output

```

          --------------------------------
          |                              |
          |                              |
          |                              |
          --------------------------------
                       |
                       |
                       |
          --------------------------------
          |                              |
          |                              |
          |                              |
          --------------------------------
                       |
                       |
                       |
          --------------------------------
          |                              |
          |                              |
          |                              |
          --------------------------------
```

### Token Cost
100x35 = 3,500 characters = ~1,000-1,400 tokens. Typically sparser than brightness ASCII (more spaces), so actual token count may be lower.

### AI Comprehension
**MEDIUM-HIGH for diagrams.** Edge detection produces output that looks like hand-drawn ASCII diagrams, which LLMs have extensive training data for. Models are better at understanding line drawings than shaded ASCII art. However, text labels INSIDE shapes will not be preserved -- only the edges of the shapes are detected.

### Performance
~50-100ms (one full getImageData + array traversal).

### Universal Coverage
Works on all canvas apps. Best results on high-contrast diagrams (dark lines on light background). Poor results on photographs, gradients, or low-contrast content.

---

## Approach 5: Color Clustering / Region Detection

### Concept
Sample pixels, find contiguous clusters of same-color pixels, and report them as bounding boxes. Like a poor man's computer vision.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // Downsample for performance
  const scale = Math.max(1, Math.floor(Math.max(w, h) / 200));
  const sw = Math.floor(w / scale), sh = Math.floor(h / scale);
  const data = ctx.getImageData(0, 0, w, h).data;

  function colorName(r, g, b) {
    if (r > 220 && g > 220 && b > 220) return 'white';
    if (r < 40 && g < 40 && b < 40) return 'black';
    if (r > 150 && g < 80 && b < 80) return 'red';
    if (r < 80 && g > 150 && b < 80) return 'green';
    if (r < 80 && g < 80 && b > 150) return 'blue';
    if (r > 150 && g > 150 && b < 80) return 'yellow';
    if (r > 100 && g > 150 && b > 200) return 'light-blue';
    if (r > 150 && g > 100 && b < 80) return 'orange';
    if (r > 120 && g > 120 && b > 120) return 'gray';
    return 'color(' + r + ',' + g + ',' + b + ')';
  }

  // Build a simplified color map
  const colorRegions = {};
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const srcX = x * scale, srcY = y * scale;
      const idx = (srcY * w + srcX) * 4;
      const name = colorName(data[idx], data[idx+1], data[idx+2]);
      if (name === 'white') continue; // skip background
      if (!colorRegions[name]) colorRegions[name] = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0, count: 0 };
      const r = colorRegions[name];
      r.minX = Math.min(r.minX, srcX);
      r.minY = Math.min(r.minY, srcY);
      r.maxX = Math.max(r.maxX, srcX);
      r.maxY = Math.max(r.maxY, srcY);
      r.count++;
    }
  }

  const lines = ['CANVAS COLOR REGIONS (' + w + 'x' + h + '):'];
  for (const [color, r] of Object.entries(colorRegions)) {
    const area = (r.maxX - r.minX) * (r.maxY - r.minY);
    const density = Math.round(r.count * scale * scale / area * 100);
    lines.push(color + ': bbox(' + r.minX + ',' + r.minY + ' to ' + r.maxX + ',' + r.maxY +
      ') size ' + (r.maxX - r.minX) + 'x' + (r.maxY - r.minY) +
      ' density ' + density + '%');
  }
  return lines.join('\n');
})()
```

### Example Output

```
CANVAS COLOR REGIONS (1920x1080):
black: bbox(250,150 to 680,850) size 430x700 density 8%
light-blue: bbox(260,160 to 410,240) size 150x80 density 85%
green: bbox(260,360 to 410,440) size 150x80 density 85%
red: bbox(260,560 to 410,640) size 150x80 density 85%
```

### Token Cost
**Very low:** ~50-150 tokens. Just a few lines per color cluster.

### AI Comprehension
**MEDIUM.** The structured bounding box format is clear, but it lacks semantic information. The model sees "light-blue region at (260,160) 150x80" but does not know it is a "rectangle labeled Start." Combined with text extraction (Approach 9), this becomes much more useful.

### Performance
~100-300ms depending on canvas size and downsampling factor.

### Universal Coverage
Works on all canvas apps. Struggles with gradient-heavy content or many similar colors.

---

## Approach 6: Run-Length Encoding Description

### Concept
Scan rows of pixels and describe color runs. "200px white, 150px blue, 80px white, ..." Compact representation of where colored regions are on each row.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const sampleRows = 20; // sample 20 evenly-spaced rows
  const rowStep = Math.floor(h / sampleRows);

  function colorName(r, g, b) {
    if (r > 220 && g > 220 && b > 220) return 'bg';
    if (r < 40 && g < 40 && b < 40) return 'BLK';
    if (r > 150 && g < 80 && b < 80) return 'RED';
    if (r < 80 && g > 150 && b < 80) return 'GRN';
    if (r < 80 && g < 80 && b > 150) return 'BLU';
    if (r > 100 && g > 150 && b > 200) return 'LBL';
    if (r > 120 && g > 120 && b > 120) return 'GRY';
    return 'OTH';
  }

  const lines = ['RLE SCAN (' + w + 'x' + h + ', ' + sampleRows + ' rows):'];
  for (let rowIdx = 0; rowIdx < sampleRows; rowIdx++) {
    const y = rowIdx * rowStep;
    let runs = [];
    let currentColor = null, runStart = 0;
    for (let x = 0; x < w; x += 4) { // sample every 4th pixel
      const idx = (y * w + x) * 4;
      const c = colorName(data[idx], data[idx+1], data[idx+2]);
      if (c !== currentColor) {
        if (currentColor && currentColor !== 'bg') {
          runs.push(currentColor + '@' + runStart + '-' + x);
        }
        currentColor = c;
        runStart = x;
      }
    }
    if (currentColor && currentColor !== 'bg') {
      runs.push(currentColor + '@' + runStart + '-' + w);
    }
    if (runs.length > 0) {
      lines.push('y' + y + ': ' + runs.join(' '));
    }
  }
  return lines.join('\n');
})()
```

### Example Output

```
RLE SCAN (1920x1080, 20 rows):
y162: BLK@248-252 LBL@252-408 BLK@408-412
y216: BLK@248-412
y270: BLK@248-252 BLK@330-334 BLK@408-412
y324: BLK@248-252 BLK@330-334 BLK@408-412
y378: BLK@248-412
y432: BLK@248-252 GRN@252-408 BLK@408-412
y486: BLK@248-412
y540: BLK@248-252 BLK@330-334 BLK@408-412
y594: BLK@248-252 BLK@330-334 BLK@408-412
y648: BLK@248-412
y702: BLK@248-252 RED@252-408 BLK@408-412
y756: BLK@248-412
```

### Token Cost
**Low:** ~100-400 tokens. Rows with no non-background content are skipped.

### AI Comprehension
**LOW.** The RLE format is compact but extremely hard for humans or AI to mentally reconstruct into a visual layout. "BLK@248-252 LBL@252-408 BLK@408-412" does not evoke "blue rectangle with black border" without significant cognitive effort.

### Performance
~50-100ms with downsampled row scanning.

### Universal Coverage
Works on all canvas apps. Same CORS restriction.

---

## Approach 7: Quadtree Decomposition

### Concept
Recursively divide the canvas into quadrants. Stop subdividing when a quadrant is uniform (all pixels roughly the same color). Report only non-uniform leaf nodes. This efficiently skips empty/background areas and focuses detail on interesting regions.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  const MIN_SIZE = 40; // minimum quadrant size in pixels
  const MAX_DEPTH = 6;
  const VARIANCE_THRESHOLD = 20; // color variance threshold

  function colorName(r, g, b) {
    if (r > 220 && g > 220 && b > 220) return 'white';
    if (r < 40 && g < 40 && b < 40) return 'black';
    if (r > 150 && g < 80 && b < 80) return 'red';
    if (r < 80 && g > 150 && b < 80) return 'green';
    if (r < 80 && g < 80 && b > 150) return 'blue';
    if (r > 100 && g > 150 && b > 200) return 'light-blue';
    if (r > 120 && g > 120 && b > 120) return 'gray';
    return 'mixed';
  }

  function analyzeRegion(x, y, rw, rh) {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    let minR = 255, maxR = 0;
    const step = Math.max(1, Math.floor(Math.min(rw, rh) / 8));
    for (let py = y; py < y + rh; py += step) {
      for (let px = x; px < x + rw; px += step) {
        const idx = (Math.min(py, h-1) * w + Math.min(px, w-1)) * 4;
        sumR += data[idx]; sumG += data[idx+1]; sumB += data[idx+2];
        minR = Math.min(minR, data[idx]); maxR = Math.max(maxR, data[idx]);
        count++;
      }
    }
    const avgR = Math.round(sumR/count), avgG = Math.round(sumG/count), avgB = Math.round(sumB/count);
    const variance = maxR - minR; // simplified variance
    return { avgR, avgG, avgB, variance, color: colorName(avgR, avgG, avgB) };
  }

  const leaves = [];

  function subdivide(x, y, rw, rh, depth) {
    const analysis = analyzeRegion(x, y, rw, rh);
    if (analysis.variance < VARIANCE_THRESHOLD || rw < MIN_SIZE || rh < MIN_SIZE || depth >= MAX_DEPTH) {
      if (analysis.color !== 'white') {
        leaves.push({ x, y, w: rw, h: rh, color: analysis.color, depth });
      }
      return;
    }
    const hw = Math.floor(rw / 2), hh = Math.floor(rh / 2);
    subdivide(x, y, hw, hh, depth + 1);
    subdivide(x + hw, y, rw - hw, hh, depth + 1);
    subdivide(x, y + hh, hw, rh - hh, depth + 1);
    subdivide(x + hw, y + hh, rw - hw, rh - hh, depth + 1);
  }

  subdivide(0, 0, w, h, 0);
  leaves.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines = ['QUADTREE (' + w + 'x' + h + ', ' + leaves.length + ' non-bg regions):'];
  for (const l of leaves) {
    lines.push(l.color + ' at (' + l.x + ',' + l.y + ') ' + l.w + 'x' + l.h + ' depth=' + l.depth);
  }
  return lines.join('\n');
})()
```

### Example Output

```
QUADTREE (1920x1080, 14 non-bg regions):
black at (240,150) 40x10 depth=5
light-blue at (240,160) 180x80 depth=4
black at (240,160) 10x80 depth=5
black at (410,160) 10x80 depth=5
black at (240,240) 180x10 depth=5
black at (320,250) 10x100 depth=5
black at (240,350) 40x10 depth=5
green at (240,360) 180x80 depth=4
black at (240,440) 180x10 depth=5
black at (320,450) 10x100 depth=5
red at (240,560) 180x80 depth=4
black at (240,640) 180x10 depth=5
```

### Token Cost
**Low-Medium:** ~100-500 tokens depending on canvas complexity. Simple diagrams produce few leaves; complex illustrations produce many.

### AI Comprehension
**MEDIUM.** The hierarchical decomposition gives the AI bounding boxes and colors, which is useful for understanding layout. Like Approach 5, it lacks semantic labels. The AI can infer "three colored rectangles arranged vertically with connecting lines" from the coordinates and colors.

### Performance
~100-300ms depending on canvas complexity and depth limit.

### Universal Coverage
Works on all canvas apps. Efficient on sparse canvases (lots of whitespace), which is common for diagrams.

---

## Approach 8: Canvas Draw Call Interception (Proxy Pattern)

### Concept
Before the page renders, inject a proxy that wraps `CanvasRenderingContext2D.prototype` methods. Log every `fillRect`, `strokeRect`, `fillText`, `arc`, `lineTo`, `moveTo` call. Reconstruct semantic shapes from the draw call log. This is the ONLY approach that gives structured data universally.

### Runtime.evaluate JavaScript (Injection Script)

This must be injected BEFORE the page scripts run. Two injection methods:

**Method A: manifest.json content_scripts (recommended for always-on)**
```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["canvas-interceptor.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }]
}
```

**Method B: CDP Runtime.evaluate with force re-render**
```javascript
// Step 1: Install the interceptor
(() => {
  if (window.__canvasCallLog) return 'ALREADY_INSTALLED';
  window.__canvasCallLog = [];
  window.__canvasCallCount = 0;
  const MAX_LOG = 5000;

  const proto = CanvasRenderingContext2D.prototype;
  const tracked = [
    'fillRect', 'strokeRect', 'clearRect',
    'fillText', 'strokeText',
    'beginPath', 'closePath', 'moveTo', 'lineTo',
    'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'arcTo', 'ellipse', 'rect',
    'fill', 'stroke',
    'drawImage', 'putImageData'
  ];

  tracked.forEach(method => {
    const original = proto[method];
    proto[method] = function(...args) {
      window.__canvasCallCount++;
      if (window.__canvasCallLog.length < MAX_LOG) {
        const entry = { m: method, a: args.map(a =>
          typeof a === 'object' ? '[object]' : a
        )};
        // Capture current styles for drawing operations
        if (['fillRect','strokeRect','fillText','strokeText','fill','stroke'].includes(method)) {
          entry.fs = this.fillStyle;
          entry.ss = this.strokeStyle;
          entry.f = this.font;
          entry.lw = this.lineWidth;
        }
        window.__canvasCallLog.push(entry);
      }
      return original.apply(this, args);
    };
  });

  // Also intercept property setters for transform tracking
  const origSetTransform = proto.setTransform;
  proto.setTransform = function(...args) {
    window.__canvasCallLog.push({ m: 'setTransform', a: args });
    return origSetTransform.apply(this, args);
  };

  return 'INTERCEPTOR_INSTALLED';
})()
```

**Step 2: Force re-render and read log**
```javascript
// After interceptor is installed, force a re-render
// Many apps re-render on resize event:
(() => {
  window.dispatchEvent(new Event('resize'));
  // Wait a frame for render to complete
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Extract semantic summary
        const log = window.__canvasCallLog || [];
        const texts = log.filter(e => e.m === 'fillText' || e.m === 'strokeText')
          .map(e => ({ text: e.a[0], x: Math.round(e.a[1]), y: Math.round(e.a[2]), font: e.f, color: e.fs }));
        const rects = log.filter(e => e.m === 'fillRect' || e.m === 'strokeRect')
          .map(e => ({ type: e.m, x: e.a[0], y: e.a[1], w: e.a[2], h: e.a[3], fill: e.fs, stroke: e.ss }));
        const paths = [];
        let currentPath = null;
        for (const entry of log) {
          if (entry.m === 'beginPath') { currentPath = { points: [], fill: null, stroke: null }; }
          else if (entry.m === 'moveTo' && currentPath) { currentPath.points.push({ op: 'M', x: entry.a[0], y: entry.a[1] }); }
          else if (entry.m === 'lineTo' && currentPath) { currentPath.points.push({ op: 'L', x: entry.a[0], y: entry.a[1] }); }
          else if (entry.m === 'arc' && currentPath) { currentPath.points.push({ op: 'arc', cx: entry.a[0], cy: entry.a[1], r: entry.a[2] }); }
          else if ((entry.m === 'fill' || entry.m === 'stroke') && currentPath) {
            currentPath[entry.m === 'fill' ? 'fill' : 'stroke'] = entry.m === 'fill' ? entry.fs : entry.ss;
            paths.push(currentPath);
            currentPath = null;
          }
        }
        resolve(JSON.stringify({ texts, rects, paths: paths.slice(0, 100) }, null, 0));
      });
    });
  });
})()
```

### Example Output

```json
{
  "texts": [
    {"text": "Start", "x": 275, "y": 225, "font": "20px Virgil", "color": "#1e1e1e"},
    {"text": "Process", "x": 265, "y": 425, "font": "20px Virgil", "color": "#1e1e1e"},
    {"text": "End", "x": 285, "y": 625, "font": "20px Virgil", "color": "#1e1e1e"}
  ],
  "rects": [
    {"type": "fillRect", "x": 200, "y": 180, "w": 150, "h": 80, "fill": "#a5d8ff"},
    {"type": "strokeRect", "x": 200, "y": 180, "w": 150, "h": 80, "stroke": "#1e1e1e"},
    {"type": "fillRect", "x": 200, "y": 380, "w": 150, "h": 80, "fill": "#b2f2bb"},
    {"type": "strokeRect", "x": 200, "y": 380, "w": 150, "h": 80, "stroke": "#1e1e1e"},
    {"type": "fillRect", "x": 200, "y": 580, "w": 150, "h": 80, "fill": "#ffc9c9"},
    {"type": "strokeRect", "x": 200, "y": 580, "w": 150, "h": 80, "stroke": "#1e1e1e"}
  ],
  "paths": [
    {"points": [{"op": "M", "x": 275, "y": 260}, {"op": "L", "x": 275, "y": 380}], "stroke": "#1e1e1e"},
    {"points": [{"op": "M", "x": 275, "y": 460}, {"op": "L", "x": 275, "y": 580}], "stroke": "#1e1e1e"}
  ]
}
```

### Token Cost
**Low:** ~200-500 tokens for a typical diagram (just the structured summary). Raw log would be enormous (thousands of entries) so the extraction step is critical.

### AI Comprehension
**HIGH.** This is structured data with text, coordinates, colors, and geometry. An AI model can perfectly reconstruct what is on the canvas:
- "Three rectangles at (200,180), (200,380), (200,580) with labels Start, Process, End"
- "Two connecting lines from (275,260) to (275,380) and (275,460) to (275,580)"

This is the BEST format for AI understanding because it is essentially the same as DOM data -- structured, semantic, unambiguous.

### Performance
- Interceptor installation: <1ms
- Re-render via resize event: depends on app (typically 16-100ms)
- Log extraction: <10ms
- **Total: ~20-120ms**

### Critical Question: Can we inject EARLY enough?

**YES, with `"world": "MAIN"` + `"run_at": "document_start"` in manifest.json.** This injects before ANY page scripts run. The interception is in place before any canvas context is created. The prototype wrapping will catch every single draw call.

**For pages already loaded:** Fire a `resize` event or trigger `requestAnimationFrame` -- most canvas apps re-render on resize. Excalidraw re-renders the entire scene. If this does not work, the canvas can be invalidated by briefly resizing it programmatically.

### Can we force a re-render after injection?

**YES.** Multiple strategies:
1. `window.dispatchEvent(new Event('resize'))` -- most responsive/canvas apps listen for this
2. Briefly modify `canvas.width` (this clears the canvas and forces apps to redraw)
3. `canvas.style.display = 'none'; requestAnimationFrame(() => { canvas.style.display = ''; })` -- hide/show forces reflow
4. For React apps: trigger a state update via React DevTools protocol
5. For Excalidraw specifically: `localStorage` modification triggers a re-render

### Universal Coverage
**HIGH.** Works on ANY canvas app that uses Canvas 2D API. Does NOT work for:
- WebGL-based apps (Figma uses WebGL for rendering)
- OffscreenCanvas in Web Workers
- Apps that cache draw calls and never re-render

### Limitations
- Excalidraw uses `roughjs` which generates many procedural path segments per shape -- a single "rectangle" becomes 20+ path operations with randomized points. Reconstructing the semantic shape from roughjs paths requires heuristics.
- The log grows large on complex canvases (thousands of entries per frame)
- Must handle transforms (translate, scale, rotate) to get world coordinates
- Re-render trigger is not guaranteed to work on all apps

---

## Approach 9: OCR via getImageData (Lightweight Text Detection)

### Concept
Instead of full OCR (which requires heavy libraries like Tesseract), detect text-like regions by looking for horizontal runs of dark pixels on light background. Report approximate text locations without trying to read the actual characters.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const scale = 2; // downsample 2x for speed
  const sw = Math.floor(w / scale), sh = Math.floor(h / scale);

  // Find horizontal runs of dark pixels (potential text)
  const textRegions = [];
  for (let y = 0; y < sh; y++) {
    let runStart = -1, runLen = 0;
    for (let x = 0; x < sw; x++) {
      const srcIdx = ((y * scale) * w + (x * scale)) * 4;
      const brightness = (data[srcIdx] * 0.299 + data[srcIdx+1] * 0.587 + data[srcIdx+2] * 0.114) / 255;
      const isDark = brightness < 0.4;
      if (isDark) {
        if (runStart === -1) runStart = x;
        runLen++;
      } else {
        if (runLen > 5 && runLen < 200) { // text-like run length
          textRegions.push({
            x: runStart * scale,
            y: y * scale,
            w: runLen * scale,
            h: scale * 2
          });
        }
        runStart = -1;
        runLen = 0;
      }
    }
  }

  // Merge nearby text regions into text blocks
  const merged = [];
  const used = new Set();
  for (let i = 0; i < textRegions.length; i++) {
    if (used.has(i)) continue;
    const block = { ...textRegions[i] };
    used.add(i);
    for (let j = i + 1; j < textRegions.length; j++) {
      if (used.has(j)) continue;
      const r = textRegions[j];
      if (Math.abs(r.y - block.y) < 20 && Math.abs(r.x - block.x) < 50) {
        block.x = Math.min(block.x, r.x);
        block.y = Math.min(block.y, r.y);
        block.w = Math.max(block.x + block.w, r.x + r.w) - block.x;
        block.h = Math.max(block.y + block.h, r.y + r.h) - block.y;
        used.add(j);
      }
    }
    if (block.w > 10 && block.h > 5) merged.push(block);
  }

  const lines = ['TEXT REGIONS DETECTED (' + merged.length + '):'];
  for (const b of merged) {
    lines.push('  text-like at (' + b.x + ',' + b.y + ') ' + b.w + 'x' + b.h);
  }
  return lines.join('\n');
})()
```

### Example Output

```
TEXT REGIONS DETECTED (3):
  text-like at (250,210) 60x18
  text-like at (240,410) 80x18
  text-like at (270,610) 40x18
```

### Token Cost
**Very low:** ~30-100 tokens.

### AI Comprehension
**LOW.** Reports WHERE text might be but not WHAT the text says. Only useful combined with other approaches (e.g., combine with Approach 5 to annotate colored regions with "text present here"). For actual text reading, Approach 8 (draw call interception capturing `fillText`) is far superior.

### Performance
~100-200ms (full pixel scan with downsampling).

### Universal Coverage
Works on all canvas apps. Cannot read the actual text -- only detects text-like pixel patterns.

---

## Approach 10: Dominant Color Grid

### Concept
Sample the canvas at an NxN grid and report the dominant color name at each point. Create a color grid that the AI can mentally reconstruct.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cols = 40, rows = 20;
  const data = ctx.getImageData(0, 0, w, h).data;

  function cn(r, g, b) {
    if (r > 220 && g > 220 && b > 220) return '.';  // white/background
    if (r < 40 && g < 40 && b < 40) return '#';      // black
    if (r > 150 && g < 80 && b < 80) return 'R';      // red
    if (r < 80 && g > 150 && b < 80) return 'G';      // green
    if (r < 80 && g < 80 && b > 150) return 'B';      // blue
    if (r > 100 && g > 150 && b > 200) return 'b';    // light blue
    if (r > 150 && g > 150 && b < 80) return 'Y';     // yellow
    if (r > 120 && g > 120 && b > 120) return '-';     // gray
    return '?';
  }

  let grid = 'COLOR GRID (' + cols + 'x' + rows + ', legend: .=bg #=black R=red G=green B=blue b=lblue Y=yellow -=gray):\n';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(col * w / cols + w / cols / 2);
      const py = Math.floor(row * h / rows + h / rows / 2);
      const idx = (py * w + px) * 4;
      grid += cn(data[idx], data[idx+1], data[idx+2]);
    }
    grid += '\n';
  }
  return grid;
})()
```

### Example Output

```
COLOR GRID (40x20, legend: .=bg #=black R=red G=green B=blue b=lblue Y=yellow -=gray):
........................................
........................................
........................................
......#bbbbbbb#.........................
......#bbbbbbb#.........................
......##########........................
..........#.............................
..........#.............................
......#GGGGGGG#.........................
......#GGGGGGG#.........................
......##########........................
..........#.............................
..........#.............................
......#RRRRRRR#.........................
......#RRRRRRR#.........................
......##########........................
........................................
........................................
........................................
........................................
```

### Token Cost
**Low-Medium:** 40x20 = 800 characters + 20 newlines = ~300-400 tokens. Highly compressed but still visual.

### AI Comprehension
**MEDIUM-HIGH.** This is essentially a simplified pixel art that preserves color information. Models can see "three colored blocks (blue, green, red) arranged vertically with black borders and black connecting lines." The color legend makes it self-documenting. Better than monochrome ASCII art because color carries semantic meaning.

### Performance
~30-50ms (one getImageData, simple array indexing).

### Universal Coverage
Works on all canvas apps. Good for any content with distinct colors. Poor for monochrome content (everything becomes `#` or `.`).

---

## Approach 11: Canvas Fingerprinting / Hash-Based Change Detection

### Concept
Not full vision, but hash the canvas pixels to detect whether something changed. Useful for verifying FSB's own actions ("did the canvas update after I clicked the rectangle tool and drew?").

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';

  // Fast hash using canvas.toDataURL (the URL itself serves as a fingerprint)
  const dataUrl = canvas.toDataURL('image/png');
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < Math.min(dataUrl.length, 10000); i++) {
    hash = ((hash << 5) - hash + dataUrl.charCodeAt(i)) | 0;
  }

  // Also capture basic stats
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // Sample a few points to detect non-empty canvas
  let nonWhitePixels = 0;
  const sampleData = ctx.getImageData(0, 0, w, h).data;
  const step = Math.floor(sampleData.length / 1000) * 4; // ~1000 samples
  for (let i = 0; i < sampleData.length; i += step) {
    if (sampleData[i] < 220 || sampleData[i+1] < 220 || sampleData[i+2] < 220) {
      nonWhitePixels++;
    }
  }

  return JSON.stringify({
    hash: hash.toString(16),
    dimensions: w + 'x' + h,
    nonWhitePixelPct: Math.round(nonWhitePixels / 1000 * 100),
    dataUrlLength: dataUrl.length
  });
})()
```

### Example Output

```json
{
  "hash": "a3f7c2b1",
  "dimensions": "1920x1080",
  "nonWhitePixelPct": 12,
  "dataUrlLength": 458293
}
```

### Token Cost
**Minimal:** ~20 tokens.

### AI Comprehension
**N/A.** This is not a visual representation -- it is a change detection mechanism. Useful for verification: "hash before action was a3f7c2b1, hash after is b8d9e4f2, therefore the canvas changed."

### Performance
~50-200ms (toDataURL is the bottleneck).

### Universal Coverage
Works on all canvas apps (same CORS restriction for toDataURL).

---

## Approach 12: SVG Trace from Pixels (ImageTracerJS)

### Concept
Use a JavaScript tracing algorithm (like ImageTracerJS) to convert the raster canvas into vector paths described as text. Report paths as "path from (x1,y1) to (x2,y2) to (x3,y3) closed." This gives structured geometric data from ANY canvas.

### Runtime.evaluate JavaScript

ImageTracerJS is a ~40KB library. It cannot be loaded inside a single Runtime.evaluate expression. Instead, we use a simplified tracing approach that detects contours:

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Downsample to manageable size
  const scale = Math.max(1, Math.floor(Math.max(w, h) / 300));
  const sw = Math.floor(w / scale), sh = Math.floor(h / scale);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Create binary edge map
  const edges = [];
  const threshold = 0.2;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const idx = ((y * scale) * w + (x * scale)) * 4;
      const c = (data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114) / 255;
      const idxR = ((y * scale) * w + ((x+1) * scale)) * 4;
      const cR = (data[idxR] * 0.299 + data[idxR+1] * 0.587 + data[idxR+2] * 0.114) / 255;
      const idxD = (((y+1) * scale) * w + (x * scale)) * 4;
      const cD = (data[idxD] * 0.299 + data[idxD+1] * 0.587 + data[idxD+2] * 0.114) / 255;
      if (Math.abs(c - cR) > threshold || Math.abs(c - cD) > threshold) {
        edges.push({ x: x * scale, y: y * scale });
      }
    }
  }

  // Cluster nearby edge points into shapes
  const clusters = [];
  const visited = new Set();
  for (let i = 0; i < edges.length; i++) {
    if (visited.has(i)) continue;
    const cluster = [edges[i]];
    visited.add(i);
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < edges.length; j++) {
        if (visited.has(j)) continue;
        for (const p of cluster) {
          if (Math.abs(edges[j].x - p.x) <= scale * 2 && Math.abs(edges[j].y - p.y) <= scale * 2) {
            cluster.push(edges[j]);
            visited.add(j);
            changed = true;
            break;
          }
        }
      }
      if (cluster.length > 500) break; // prevent runaway
    }
    if (cluster.length >= 4) {
      const xs = cluster.map(p => p.x), ys = cluster.map(p => p.y);
      clusters.push({
        minX: Math.min(...xs), minY: Math.min(...ys),
        maxX: Math.max(...xs), maxY: Math.max(...ys),
        pointCount: cluster.length
      });
    }
  }

  const lines = ['SVG-LIKE TRACE (' + clusters.length + ' shapes detected):'];
  for (const c of clusters) {
    lines.push('  shape at (' + c.minX + ',' + c.minY + ') to (' + c.maxX + ',' + c.maxY +
      ') size ' + (c.maxX - c.minX) + 'x' + (c.maxY - c.minY) + ' (' + c.pointCount + ' edge points)');
  }
  return lines.join('\n');
})()
```

### Example Output

```
SVG-LIKE TRACE (5 shapes detected):
  shape at (200,180) to (350,260) size 150x80 (42 edge points)
  shape at (270,260) to (280,380) size 10x120 (18 edge points)
  shape at (200,380) to (350,460) size 150x80 (42 edge points)
  shape at (270,460) to (280,580) size 10x120 (18 edge points)
  shape at (200,580) to (350,660) size 150x80 (42 edge points)
```

### Full ImageTracerJS Approach (requires library injection)

For production use, inject ImageTracerJS via CDP:
```javascript
// Step 1: Inject the library
const libUrl = 'https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js';
// Use Runtime.evaluate to dynamically add a script tag
(() => {
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js';
    s.onload = () => resolve('LOADED');
    document.head.appendChild(s);
  });
})()

// Step 2: Trace the canvas
(() => {
  const canvas = document.querySelector('canvas');
  const imgd = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const svgStr = ImageTracer.imagedataToSVG(imgd, { ltres: 1, qtres: 1, pathomit: 8 });
  // Parse SVG paths -- extract just the path data
  const paths = svgStr.match(/d="([^"]+)"/g) || [];
  return 'SVG PATHS (' + paths.length + '):\n' + paths.slice(0, 50).join('\n');
})()
```

### Token Cost
**Low-Medium:** Simplified trace: ~100-300 tokens. Full SVG paths: ~500-2000 tokens depending on complexity.

### AI Comprehension
**MEDIUM.** Bounding boxes are understandable. Full SVG path data (`M 200 180 L 350 180 L 350 260 L 200 260 Z`) is technically precise but models may struggle to mentally reconstruct shapes from raw path commands.

### Performance
- Simplified trace: ~200-500ms
- Full ImageTracerJS: ~500-2000ms (depends on canvas size and complexity)
- Library loading: ~200-500ms first time (cached after)

### Universal Coverage
Works on all canvas apps. Same CORS restriction. ImageTracerJS works best on high-contrast images with clear shapes. Poor results on photographs or gradients.

---

## Approach 13: Hybrid - Dominant Features + Targeted Detail

### Concept
Two-pass approach:
1. First pass: Use color clustering (Approach 5) to identify major colored regions
2. Second pass: For each region, sample at higher resolution to detect edges and features
This avoids wasting tokens on empty whitespace.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  function cn(r, g, b) {
    if (r > 220 && g > 220 && b > 220) return 'white';
    if (r < 40 && g < 40 && b < 40) return 'black';
    if (r > 150 && g < 80 && b < 80) return 'red';
    if (r < 80 && g > 150 && b < 80) return 'green';
    if (r < 80 && g < 80 && b > 150) return 'blue';
    if (r > 100 && g > 150 && b > 200) return 'light-blue';
    if (r > 120 && g > 120 && b > 120) return 'gray';
    return 'other';
  }

  // Pass 1: Find bounding box of all non-white content
  let minX = w, minY = h, maxX = 0, maxY = 0;
  const step = 4;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      if (data[idx] < 220 || data[idx+1] < 220 || data[idx+2] < 220) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX >= maxX) return 'CANVAS_APPEARS_EMPTY';

  // Pass 2: Generate color grid of ONLY the content region
  const contentW = maxX - minX, contentH = maxY - minY;
  const cols = 60, rows = Math.max(10, Math.round(60 * contentH / contentW));
  const cellW = contentW / cols, cellH = contentH / rows;

  let grid = '';
  const legend = { '.': 'bg', '#': 'black', 'R': 'red', 'G': 'green', 'B': 'blue', 'b': 'lblue', '-': 'gray' };
  const charMap = { white: '.', black: '#', red: 'R', green: 'G', blue: 'B', 'light-blue': 'b', gray: '-', other: '?' };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(minX + col * cellW + cellW / 2);
      const py = Math.floor(minY + row * cellH + cellH / 2);
      const idx = (py * w + px) * 4;
      const color = cn(data[idx], data[idx+1], data[idx+2]);
      grid += charMap[color] || '?';
    }
    grid += '\n';
  }

  return 'CANVAS CONTENT (' + w + 'x' + h + ', content at ' + minX + ',' + minY + ' to ' + maxX + ',' + maxY + '):\n' +
    'Legend: .=bg #=black R=red G=green B=blue b=lblue -=gray\n' + grid;
})()
```

### Example Output

```
CANVAS CONTENT (1920x1080, content at 198,148 to 412,662):
Legend: .=bg #=black R=red G=green B=blue b=lblue -=gray
............................................................
..####################################..........................
..#bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb#..........................
..#bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb#..........................
..#bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb#..........................
..####################################..........................
...................#............................................
...................#............................................
...................#............................................
...................#............................................
..####################################..........................
..#GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG#..........................
..#GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG#..........................
..#GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG#..........................
..####################################..........................
...................#............................................
...................#............................................
...................#............................................
...................#............................................
..####################################..........................
..#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#..........................
..#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#..........................
..#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#..........................
..####################################..........................
............................................................
```

### Token Cost
**Low-Medium:** ~400-800 tokens. Focused on content area only, no wasted tokens on empty space.

### AI Comprehension
**MEDIUM-HIGH.** The cropped color grid clearly shows three rectangles (blue, green, red) with black borders connected by vertical black lines. The color legend is self-documenting. The AI can infer the diagram structure. Missing: text labels (would need Approach 8 or Approach 9 to capture those).

### Performance
~100-200ms (two passes over pixel data).

### Universal Coverage
Works on all canvas apps. Efficient for sparse canvases (diagrams with lots of whitespace).

---

## Approach 14: Canvas State Serialization via Context Methods

### Concept
Use the Canvas 2D context's built-in methods for state inspection:
- `ctx.getTransform()` -- current transform matrix
- `ctx.isPointInPath(x, y)` -- hit-test at specific coordinates
- `ctx.isPointInStroke(x, y)` -- stroke hit-test
Systematically probe the canvas at grid points to discover shapes.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // isPointInPath/isPointInStroke only work for the CURRENT path
  // After the app has finished rendering, there is no "current path"
  // These methods are useless for post-render inspection

  // getTransform returns the current transform matrix
  const transform = ctx.getTransform();

  // The only useful post-render inspection is pixel-based
  // This approach is fundamentally flawed for post-render analysis

  return JSON.stringify({
    approach: 'CANVAS_STATE_SERIALIZATION',
    verdict: 'NOT_VIABLE_FOR_POST_RENDER',
    reason: 'isPointInPath and isPointInStroke only test against the CURRENT path. After rendering is complete, there is no current path. These methods cannot retroactively discover shapes that have already been drawn.',
    currentTransform: {
      a: transform.a, b: transform.b,
      c: transform.c, d: transform.d,
      e: transform.e, f: transform.f
    },
    alternative: 'Use draw call interception (Approach 8) to capture paths DURING rendering, then use isPointInPath on reconstructed paths'
  });
})()
```

### Example Output

```json
{
  "approach": "CANVAS_STATE_SERIALIZATION",
  "verdict": "NOT_VIABLE_FOR_POST_RENDER",
  "reason": "isPointInPath and isPointInStroke only test against the CURRENT path. After rendering is complete, there is no current path. These methods cannot retroactively discover shapes that have already been drawn.",
  "currentTransform": { "a": 1, "b": 0, "c": 0, "d": 1, "e": 0, "f": 0 },
  "alternative": "Use draw call interception (Approach 8) to capture paths DURING rendering, then use isPointInPath on reconstructed paths"
}
```

### Token Cost
N/A -- this approach does not produce useful visual representation.

### AI Comprehension
N/A.

### Performance
N/A.

### Verdict
**NOT VIABLE.** The Canvas 2D API's `isPointInPath()` and `isPointInStroke()` methods only test against the CURRENT path being constructed (between `beginPath()` and `fill()`/`stroke()`). After rendering is complete, there is no current path. These methods cannot retroactively discover shapes already drawn to the canvas.

The transform matrix (`getTransform()`) only reflects the CURRENT transform state, not transforms used during previous draw calls.

**This approach is a dead end for post-render canvas inspection.** It could be combined with Approach 8 (draw call interception) to replay captured paths and then test them, but that adds complexity for minimal benefit.

### Universal Coverage
N/A -- does not work.

---

## Approach 15: Web Worker + OffscreenCanvas for Background Processing

### Concept
Transfer canvas content to an OffscreenCanvas in a Web Worker. Process pixels without blocking the main thread. Return a text description.

### Runtime.evaluate JavaScript

```javascript
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS_FOUND';
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Get ImageData from the canvas
  const imageData = ctx.getImageData(0, 0, w, h);

  // Create a worker blob
  const workerCode = `
    self.onmessage = function(e) {
      const { data, width, height, cols, rows } = e.data;
      const cellW = width / cols, cellH = height / rows;
      const ramp = ' .,:;i1tfLCG08@';

      let ascii = '';
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = Math.floor(col * cellW + cellW / 2);
          const py = Math.floor(row * cellH + cellH / 2);
          const idx = (py * width + px) * 4;
          const brightness = (data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114) / 255;
          const charIdx = Math.floor((1 - brightness) * (ramp.length - 1));
          ascii += ramp[charIdx];
        }
        ascii += '\\n';
      }
      self.postMessage(ascii);
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);

  return new Promise(resolve => {
    const worker = new Worker(workerUrl);
    worker.onmessage = (e) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve(e.data);
    };
    // Transfer the pixel data array buffer
    const buffer = imageData.data.buffer.slice(0);
    worker.postMessage({
      data: new Uint8ClampedArray(buffer),
      width: w, height: h,
      cols: 80, rows: 30
    }, [buffer]);
  });
})()
```

### Example Output
Same as Approach 1 (ASCII art) -- the Worker is just a performance optimization for WHERE the processing happens.

### Token Cost
Same as whichever algorithm runs inside the worker.

### AI Comprehension
Same as the underlying algorithm.

### Performance
**BENEFIT:** Does not block the main thread. The page remains interactive during processing.
**COST:** Worker creation overhead (~5-10ms), message passing overhead (~5-20ms for large ImageData).
**NET:** Slightly SLOWER for small canvases due to overhead. BETTER for large canvases (4K+) where main-thread processing would cause jank.

### Universal Coverage
Works on all canvas apps. Worker creation via Blob URL may be blocked by some CSP policies.

### Verdict
**USEFUL OPTIMIZATION, NOT A DISTINCT APPROACH.** The Web Worker is a performance pattern, not a new analysis algorithm. Use it to wrap any of the other pixel-processing approaches when main-thread responsiveness matters.

---

## AI Comprehension Assessment

### Published Benchmark Data (ASCIIBench, December 2025)

| Model | Text-Only Micro Accuracy | Text-Only Macro Accuracy |
|-------|-------------------------|-------------------------|
| GPT-4o | 75.44% | 80.23% |
| GPT-4o-mini | 73.61% | 77.60% |
| Claude 3.5 Sonnet | 59.55% | 56.98% |
| GPT-3.5 | ~40% (poor) | ~35% (poor) |
| LLaMA 3-8B | ~30% (poor) | ~25% (poor) |

Source: arxiv.org/abs/2512.04125

### Key Findings About LLM ASCII Art Understanding

1. **Models CAN understand ASCII art, but imperfectly.** GPT-4o achieves ~80% accuracy on classification tasks. This is "good enough" for diagram layout understanding but NOT reliable for precise element identification.

2. **Vision-only outperforms text-only by 2-5%.** Sending a PNG screenshot to a vision model gives slightly better results than sending ASCII art to a text model. However, ASCII art uses far fewer tokens.

3. **Adding text + vision together does NOT help.** Multimodal fusion for ASCII art actually degrades performance in some cases. Do not send both an ASCII representation AND a screenshot -- pick one.

4. **Spatial reasoning remains the bottleneck.** Models struggle with precise spatial relationships (which box is to the left of which). They can identify individual shapes but have difficulty with relative positioning.

5. **Text-like ASCII (e.g., hand-drawn box diagrams) is better understood than pixel-art ASCII.** Models have more training data on text diagrams like:
   ```
   +-------+     +--------+
   | Start |---->| Process|
   +-------+     +--------+
   ```
   than on brightness-mapped pixel art.

6. **Resolution matters.** Very high resolution ASCII art (200+ columns) confuses models -- too many characters to process. Very low resolution (20 columns) loses too much detail. The sweet spot is **60-100 columns**.

### Practical Comprehension Ranking by Approach

| Rank | Approach | AI Understanding | Why |
|------|----------|-----------------|-----|
| 1 | Draw Call Interception (8) | EXCELLENT | Structured data: text, coordinates, colors. Same format as DOM. |
| 2 | Screenshot to Vision AI | HIGH | Native image understanding, already proven |
| 3 | Dominant Color Grid (10) | MEDIUM-HIGH | Color-coded spatial layout, self-documenting |
| 4 | Hybrid (13) | MEDIUM-HIGH | Focused color grid with context |
| 5 | Edge Detection (4) | MEDIUM | Looks like hand-drawn diagrams |
| 6 | ASCII Art (1) | MEDIUM | Well-known format but spatial reasoning is weak |
| 7 | Spatial Description (3) | MEDIUM | Natural language, but lacks shape info |
| 8 | Quadtree (7) | MEDIUM | Structured coordinates, but abstract |
| 9 | Color Clustering (5) | MEDIUM | Bounding boxes are clear |
| 10 | Block Art (2) | LOW-MEDIUM | Less training data than ASCII |
| 11 | SVG Trace (12) | MEDIUM | Path data is precise but hard to visualize |
| 12 | RLE (6) | LOW | Hard to mentally reconstruct |
| 13 | OCR (9) | LOW | Only detects text locations, not content |
| 14 | Canvas State (14) | N/A | Does not work post-render |
| 15 | Hash (11) | N/A | Not a visual representation |

---

## Performance Comparison

| Approach | Execution Time | Data Size | Token Cost |
|----------|---------------|-----------|------------|
| 1. ASCII Art | 50-100ms | 2-5KB | 700-2000 |
| 2. Block Art | 50-100ms | 2-5KB | 900-2500 |
| 3. Spatial Description | 50-200ms | 0.3-1KB | 100-300 |
| 4. Edge Detection | 50-100ms | 3-5KB | 1000-1400 |
| 5. Color Clustering | 100-300ms | 0.2-0.5KB | 50-150 |
| 6. RLE | 50-100ms | 0.3-1KB | 100-400 |
| 7. Quadtree | 100-300ms | 0.3-1KB | 100-500 |
| 8. Draw Call Intercept | 20-120ms | 0.5-2KB | 200-500 |
| 9. OCR Detection | 100-200ms | 0.1-0.3KB | 30-100 |
| 10. Color Grid | 30-50ms | 1-2KB | 300-400 |
| 11. Hash/Fingerprint | 50-200ms | 0.1KB | 20 |
| 12. SVG Trace | 200-2000ms | 1-5KB | 500-2000 |
| 13. Hybrid | 100-200ms | 2-3KB | 400-800 |
| 14. Context Methods | N/A | N/A | N/A |
| 15. Web Worker | +10-20ms overhead | same | same |
| (Baseline) Screenshot + Vision | 50-200ms | 200KB-2MB | 765-1105 |

---

## Universal Coverage Assessment

| Approach | Standard Canvas 2D | WebGL | OffscreenCanvas | CORS-Tainted | Games | Charts | Drawing Apps | Text Editors |
|----------|-------------------|-------|-----------------|-------------|-------|--------|-------------|-------------|
| 1. ASCII Art | YES | NO* | NO | NO | YES | YES | YES | YES |
| 2. Block Art | YES | NO* | NO | NO | YES | YES | YES | YES |
| 3. Spatial Desc | YES | NO* | NO | NO | YES | YES | YES | YES |
| 4. Edge Detection | YES | NO* | NO | NO | YES | YES | YES | YES |
| 5. Color Cluster | YES | NO* | NO | NO | YES | YES | YES | YES |
| 6. RLE | YES | NO* | NO | NO | YES | YES | YES | YES |
| 7. Quadtree | YES | NO* | NO | NO | YES | YES | YES | YES |
| 8. Draw Call Intercept | YES | NO | NO | YES** | YES | YES | YES | YES |
| 9. OCR | YES | NO* | NO | NO | YES | YES | YES | YES |
| 10. Color Grid | YES | NO* | NO | NO | YES | YES | YES | YES |
| 11. Hash | YES | NO* | NO | NO | YES | YES | YES | YES |
| 12. SVG Trace | YES | NO* | NO | NO | POOR | YES | YES | YES |
| 13. Hybrid | YES | NO* | NO | NO | YES | YES | YES | YES |
| 14. Context Methods | NO | NO | NO | NO | NO | NO | NO | NO |
| 15. Web Worker | YES | NO* | NO | NO | YES | YES | YES | YES |
| (Screenshot) | YES | YES | YES | YES | YES | YES | YES | YES |

*WebGL: Pixel-based approaches work if `preserveDrawingBuffer: true` was set. Otherwise `getImageData` returns blank.
**Draw Call Intercept: Bypasses CORS because it captures calls, not pixels.

### Apps That Use Canvas:
- **Canvas 2D:** Excalidraw, TLDraw, draw.io (partial), Chart.js, D3.js, Konva.js, Fabric.js, Google Sheets, Google Docs, PDF.js
- **WebGL:** Figma, Google Maps, Three.js, Babylon.js, PixiJS, MapboxGL
- **Mixed:** Some apps use Canvas 2D for overlays + WebGL for main content

---

## Recommendation

### Tier 1: Draw Call Interception (IMPLEMENT FIRST)

**Why:** The only approach that gives structured semantic data universally for Canvas 2D apps. It captures text content, shape coordinates, colors, and geometry -- exactly what an AI needs to understand a canvas.

**Implementation plan:**
1. Create `canvas-interceptor.js` (content script, world: MAIN, run_at: document_start)
2. Wrap 20 Canvas2D prototype methods with logging
3. Cap log at 5,000 entries (enough for complex diagrams, prevents memory issues)
4. Add a CDP-callable function to extract a semantic summary (texts, rects, paths)
5. Trigger re-render via `resize` event for already-loaded pages

**Estimated effort:** 1-2 days for basic implementation, 1 week for robust shape reconstruction from roughjs paths.

### Tier 2: Hybrid Color Grid (FALLBACK)

**Why:** When interception misses the initial render and re-render trigger fails, fall back to pixel analysis. The hybrid approach (Approach 13) gives the best balance of token cost and AI comprehension for pixel-based methods.

**Implementation plan:**
1. Get full ImageData once
2. Find content bounding box (skip whitespace)
3. Generate focused color grid at 60x30 resolution
4. Combine with text region detection (Approach 9) for text location hints

**Estimated effort:** 0.5 days.

### Tier 3: Screenshot + Vision AI (ALREADY AVAILABLE)

**Why:** Already documented in 115-RESEARCH.md (Approaches C and D). Works for ANY content including WebGL. Use when pixel-based text approaches are insufficient.

**When to use which:**
- Canvas 2D app, draw calls intercepted: **Tier 1** (structured data, ~200-500 tokens)
- Canvas 2D app, interception missed: **Tier 2** (color grid, ~400-800 tokens)
- WebGL app or CORS-tainted: **Tier 3** (screenshot, ~765-1105 tokens)
- Verification that drawing looks correct: **Tier 3** (visual confirmation)

### What NOT to implement

- **RLE (6):** Too hard for AI to understand, no benefit over color grid
- **Block Art (2):** Less training data than ASCII, no advantage
- **Canvas State Serialization (14):** Does not work post-render
- **Full SVG Trace (12):** Too slow, path data is hard for AI to interpret
- **Web Worker (15):** Optimization pattern, not needed unless processing causes visible jank

---

## Sources

### Primary (HIGH confidence)
- ASCIIBench paper (arxiv.org/abs/2512.04125) - LLM ASCII art comprehension benchmarks
- MDN CanvasRenderingContext2D documentation - API verification
- Canvas Interceptor (github.com/Rob--W/canvas-interceptor) - interception patterns
- ImageTracerJS (github.com/jankovicsandras/imagetracerjs) - SVG tracing in browser

### Secondary (MEDIUM confidence)
- SkyPilot blog on multimodal LLM ASCII art understanding
- Sobel edge detection JavaScript implementations (github.com/miguelmota/sobel)
- Quadtree image decomposition patterns (Wikipedia, MATLAB docs)

### Tertiary (LOW confidence)
- Token cost estimates based on general tokenizer behavior -- actual costs vary by model/provider
- Performance estimates based on typical canvas sizes and hardware -- vary significantly
