/**
 * Phase 280 VIEWPORT regression: dashboard preview pane must hold 16:10
 * on desktop, unset on mobile, unset in Maximized mode, and 16:10 in PiP.
 *
 * Run: node tests/dashboard-preview-aspect-ratio.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCSS_PATH = path.join(
  __dirname,
  '..',
  'showcase',
  'angular',
  'src',
  'app',
  'pages',
  'dashboard',
  'dashboard-page.component.scss'
);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

const scss = fs.readFileSync(SCSS_PATH, 'utf8');

function extractBlock(selectorRegex) {
  const match = scss.match(selectorRegex);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < scss.length && depth > 0) {
    if (scss[i] === '{') depth++;
    else if (scss[i] === '}') depth--;
    i++;
  }
  return depth === 0 ? scss.slice(start, i - 1) : null;
}

const desktopBlock = extractBlock(/\.dash-preview\s*\{/);
assert(desktopBlock !== null, 'desktop .dash-preview block exists');
assert(
  desktopBlock && /aspect-ratio:\s*16\s*\/\s*10\b/.test(desktopBlock),
  'desktop .dash-preview declares aspect-ratio: 16 / 10'
);
assert(
  desktopBlock && /width:\s*100%/.test(desktopBlock),
  'desktop .dash-preview keeps width: 100%'
);

function collectMediaBlocks(maxWidthPx) {
  const re = new RegExp(
    '@media\\s*\\(\\s*max-width:\\s*' + maxWidthPx + 'px\\s*\\)\\s*\\{',
    'g'
  );
  const blocks = [];
  let m;
  while ((m = re.exec(scss)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < scss.length && depth > 0) {
      if (scss[i] === '{') depth++;
      else if (scss[i] === '}') depth--;
      i++;
    }
    if (depth === 0) blocks.push(scss.slice(start, i - 1));
  }
  return blocks;
}

function mediaBlockHasPreviewOverride(blockBody) {
  const previewBlockRe = /\.dash-preview\s*\{([^{}]*)\}/g;
  let m;
  while ((m = previewBlockRe.exec(blockBody)) !== null) {
    if (/aspect-ratio:\s*auto/.test(m[1])) return true;
  }
  return false;
}

const mobile768Blocks = collectMediaBlocks(768);
assert(mobile768Blocks.length > 0, 'at least one @media (max-width: 768px) block exists');
assert(
  mobile768Blocks.some(mediaBlockHasPreviewOverride),
  'mobile <=768px override sets aspect-ratio: auto on .dash-preview'
);

const mobile480Blocks = collectMediaBlocks(480);
assert(mobile480Blocks.length > 0, 'at least one @media (max-width: 480px) block exists');
assert(
  mobile480Blocks.some(mediaBlockHasPreviewOverride),
  'mobile <=480px override sets aspect-ratio: auto on .dash-preview'
);

const maximizedBlock = extractBlock(/\.dash-preview-maximized\s*\{/);
assert(maximizedBlock !== null, '.dash-preview-maximized block exists');
assert(
  maximizedBlock && /aspect-ratio:\s*auto\s*!important/.test(maximizedBlock),
  'Maximized layout overrides aspect-ratio: auto !important (so 100vh fills the screen)'
);

const pipBlock = extractBlock(/\.dash-preview-pip\s*\{/);
assert(pipBlock !== null, '.dash-preview-pip block exists');
assert(
  pipBlock && /aspect-ratio:\s*16\s*\/\s*10\s*!important/.test(pipBlock),
  'PiP layout pins aspect-ratio: 16 / 10 !important'
);

console.log('\nResults:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
