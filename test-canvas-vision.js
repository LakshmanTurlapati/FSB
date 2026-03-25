#!/usr/bin/env node
/**
 * Canvas Vision Structural Validation Script
 * Validates that all canvas vision pipeline components are present and correct.
 * Exit 0 = all pass, Exit 1 = any fail.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let passed = 0;
let failed = 0;
const results = [];

function check(label, ok) {
  if (ok) {
    passed++;
    results.push(`[PASS] ${label}`);
  } else {
    failed++;
    results.push(`[FAIL] ${label}`);
  }
}

// -------------------------------------------------------
// 1. canvas-interceptor.js integrity
// -------------------------------------------------------
const interceptorPath = path.join(ROOT, 'canvas-interceptor.js');
const interceptorExists = fs.existsSync(interceptorPath);
let interceptorSrc = '';
if (interceptorExists) {
  interceptorSrc = fs.readFileSync(interceptorPath, 'utf8');
}
const interceptorSize = interceptorExists ? fs.statSync(interceptorPath).size : 0;

check(`canvas-interceptor.js exists (${interceptorSize} bytes)`, interceptorExists);

// Syntax check via Function constructor
let syntaxOk = false;
if (interceptorExists) {
  try {
    new Function(interceptorSrc);
    syntaxOk = true;
  } catch (e) {
    // syntax error
  }
}
check('canvas-interceptor.js is syntactically valid JS', syntaxOk);

// All 20 tracked method names
const trackedMethods = [
  'fillRect', 'strokeRect', 'clearRect',
  'fillText', 'strokeText',
  'beginPath', 'closePath', 'moveTo', 'lineTo',
  'bezierCurveTo', 'quadraticCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect',
  'fill', 'stroke',
  'drawImage',
  'setTransform', 'save', 'restore'
];
// Note: the plan says 20 methods but the actual list has 21.
// We check all of them regardless.
const missingMethods = trackedMethods.filter(m => !interceptorSrc.includes(`'${m}'`));
check(
  `Interceptor has all ${trackedMethods.length} method wrappers${missingMethods.length ? ' (missing: ' + missingMethods.join(', ') + ')' : ''}`,
  missingMethods.length === 0
);

check('Interceptor has __canvasCallLog initialization', interceptorSrc.includes('__canvasCallLog'));
check('Interceptor has getCanvasScene function', interceptorSrc.includes('getCanvasScene'));
check('Interceptor has triggerCanvasRerender function', interceptorSrc.includes('triggerCanvasRerender'));
check('Interceptor file size under 5KB', interceptorSize > 0 && interceptorSize < 5120);

// -------------------------------------------------------
// 2. manifest.json content_scripts
// -------------------------------------------------------
const manifestPath = path.join(ROOT, 'manifest.json');
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  // parse error
}

const contentScripts = manifest.content_scripts || [];
const mainWorldEntry = contentScripts.find(
  cs => cs.world === 'MAIN' && cs.run_at === 'document_start' && (cs.js || []).includes('canvas-interceptor.js')
);
check('manifest.json has MAIN world content_script for canvas-interceptor.js', !!mainWorldEntry);

// -------------------------------------------------------
// 3. background.js integration
// -------------------------------------------------------
const bgPath = path.join(ROOT, 'background.js');
const bgExists = fs.existsSync(bgPath);
let bgSrc = '';
if (bgExists) {
  bgSrc = fs.readFileSync(bgPath, 'utf8');
}

check('background.js has fetchCanvasScene function', bgSrc.includes('function fetchCanvasScene'));
check('background.js has formatCanvasSceneMarkdown function', bgSrc.includes('function formatCanvasSceneMarkdown'));
check('background.js has CANVAS SCENE header string', bgSrc.includes('CANVAS SCENE'));
check('background.js references __canvasCallLog', bgSrc.includes('__canvasCallLog'));
check('background.js has pixel-fallback source string', bgSrc.includes('pixel-fallback'));
check('background.js has interceptor source string', bgSrc.includes("'interceptor'") || bgSrc.includes('"interceptor"'));

// -------------------------------------------------------
// 4. content/dom-analysis.js pixel fallback
// -------------------------------------------------------
const domAnalysisPath = path.join(ROOT, 'content', 'dom-analysis.js');
const domExists = fs.existsSync(domAnalysisPath);
let domSrc = '';
if (domExists) {
  domSrc = fs.readFileSync(domAnalysisPath, 'utf8');
}

check('dom-analysis.js has getCanvasPixelFallback function', domSrc.includes('function getCanvasPixelFallback'));
check('dom-analysis.js has FSB.getCanvasPixelFallback export', domSrc.includes('FSB.getCanvasPixelFallback'));

// -------------------------------------------------------
// 5. content/messaging.js handler
// -------------------------------------------------------
const messagingPath = path.join(ROOT, 'content', 'messaging.js');
const msgExists = fs.existsSync(messagingPath);
let msgSrc = '';
if (msgExists) {
  msgSrc = fs.readFileSync(messagingPath, 'utf8');
}

check('messaging.js has getCanvasPixelFallback handler', msgSrc.includes('getCanvasPixelFallback'));

// -------------------------------------------------------
// Summary
// -------------------------------------------------------
const total = passed + failed;
console.log('');
console.log('Canvas Vision Validation');
console.log('========================');
for (const r of results) {
  console.log(r);
}
console.log('========================');
console.log(`${passed}/${total} checks passed`);
console.log('');

process.exit(failed > 0 ? 1 : 0);
