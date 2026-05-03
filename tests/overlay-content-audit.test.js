/**
 * Phase 229-02 content-audit + reduced-motion regression tests.
 *
 * Covers:
 *   OVERLAY-05: isThinkingPhase helper, thinking-suppression gate (<1s elapsed),
 *               first-sentence regression guard on legacy state.stepText path.
 *   OVERLAY-06: Strict reduced-motion CSS for ProgressOverlay text surfaces;
 *               green-flash completion preserved under reduced-motion;
 *               ActionGlowOverlay reduced-motion block intact.
 *
 * Approach: same vm-sandbox pattern as overlay-stability-cadence.test.js.
 *
 * Run: node tests/overlay-content-audit.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Load real overlay-state.js into a fresh sandbox to test isThinkingPhase
// ---------------------------------------------------------------------------

function loadOverlayStateModule() {
  const sandbox = {
    module: { exports: {} },
    globalThis: {},
    console
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'extension', 'utils', 'overlay-state.js'),
    'utf8'
  );
  vm.runInContext(src, ctx, { filename: 'overlay-state.js' });
  return sandbox.module.exports;
}

// ---------------------------------------------------------------------------
// DOM/window shim (mirrors overlay-stability-cadence.test.js)
// ---------------------------------------------------------------------------

let nowMs = 1000;
function setNow(v) { nowMs = v; }
function advanceNow(d) { nowMs += d; }

let rafQueue = [];
let rafSeq = 0;
function requestAnimationFrameStub(cb) {
  rafSeq += 1;
  rafQueue.push({ id: rafSeq, cb });
  return rafSeq;
}
function cancelAnimationFrameStub(id) {
  rafQueue = rafQueue.filter(e => e.id !== id);
}

function makeElement(tag, opts) {
  opts = opts || {};
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    parentNode: null,
    classList: {
      _set: new Set(),
      add(...names) { names.forEach(n => this._set.add(n)); },
      remove(...names) { names.forEach(n => this._set.delete(n)); },
      contains(n) { return this._set.has(n); },
      toggle(n, force) {
        if (force === true) { this._set.add(n); return true; }
        if (force === false) { this._set.delete(n); return false; }
        if (this._set.has(n)) { this._set.delete(n); return false; }
        this._set.add(n); return true;
      }
    },
    style: {},
    attributes: {},
    dataset: {},
    _textContent: '',
    _innerHTML: '',
    _isConnected: true,
    get textContent() { return this._textContent; },
    set textContent(v) { this._textContent = String(v); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) {
      this._innerHTML = String(v);
      const childClasses = [
        'fsb-header','fsb-logo','fsb-title','fsb-client-badge',
        'fsb-task','fsb-summary','fsb-step','fsb-step-number','fsb-step-text',
        'fsb-meta','fsb-phase','fsb-eta','fsb-progress-bar','fsb-progress-fill'
      ];
      this.children = childClasses.map(c => {
        const ch = makeElement(c === 'fsb-logo' ? 'img' : 'span');
        ch.classList.add(c);
        ch.parentNode = this;
        return ch;
      });
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter(c => c !== child);
      child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); },
    removeAttribute(k) { delete this.attributes[k]; },
    querySelector(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return findDescendant(this, n => n.classList && n.classList.contains(cls));
      }
      if (sel === 'style') {
        return findDescendant(this, n => n.tagName === 'STYLE');
      }
      return null;
    },
    querySelectorAll(sel) {
      const out = [];
      const cls = sel.startsWith('.') ? sel.slice(1) : null;
      walkAll(this, n => {
        if (cls && n.classList && n.classList.contains(cls)) out.push(n);
      });
      return out;
    },
    attachShadow() {
      this._shadow = makeElement('shadow-root');
      this._shadow.host = this;
      return this._shadow;
    },
    showPopover() {},
    hidePopover() {},
    get isConnected() { return this._isConnected; },
    set isConnected(v) { this._isConnected = v; },
    contains(node) {
      if (!node) return false;
      let cur = node;
      while (cur) { if (cur === this) return true; cur = cur.parentNode; }
      return false;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 100, height: 40, right: 100, bottom: 40 };
    }
  };
  if (opts.id) el.id = opts.id;
  return el;
}

function findDescendant(root, pred) {
  if (pred(root)) return root;
  for (const c of (root.children || [])) {
    const found = findDescendant(c, pred);
    if (found) return found;
  }
  if (root._shadow) {
    const found = findDescendant(root._shadow, pred);
    if (found) return found;
  }
  return null;
}

function walkAll(root, fn) {
  fn(root);
  for (const c of (root.children || [])) walkAll(c, fn);
  if (root._shadow) walkAll(root._shadow, fn);
}

// ---------------------------------------------------------------------------
// Build sandbox with real FSBOverlayStateUtils loaded
// ---------------------------------------------------------------------------

const overlayStateExports = loadOverlayStateModule();

const documentElement = makeElement('html');
const documentBody = makeElement('body');
documentElement.appendChild(documentBody);

const documentStub = {
  documentElement,
  body: documentBody,
  createElement(tag) { return makeElement(tag); },
  addEventListener() {},
  removeEventListener() {}
};

// matchMedia mock -- controllable per-test via setMatchMedia()
let matchMediaResult = false;
function setMatchMedia(v) { matchMediaResult = v; }

const windowListeners = { add: [], remove: [] };
const windowStub = {
  FSB: {
    _modules: {},
    logger: { log(){}, info(){}, warn(){}, error(){}, debug(){} }
  },
  FSBOverlayStateUtils: overlayStateExports,
  addEventListener(type, fn, opts) { windowListeners.add.push({ type, fn, opts }); },
  removeEventListener(type, fn, opts) { windowListeners.remove.push({ type, fn, opts }); },
  matchMedia(q) {
    return {
      matches: matchMediaResult,
      media: q,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}
    };
  },
  __FSB_SKIP_INIT__: false,
  CSS: { supports: () => false }
};

const sandbox = {
  window: windowStub,
  document: documentStub,
  performance: { now() { return nowMs; } },
  requestAnimationFrame: requestAnimationFrameStub,
  cancelAnimationFrame: cancelAnimationFrameStub,
  setTimeout, clearTimeout, setInterval, clearInterval,
  console,
  chrome: { runtime: { getURL: (p) => 'chrome-extension://test/' + p } },
  module: { exports: {} },
  Set, Map, WeakMap, WeakSet, Promise, Date, Math, JSON, String, Number, Boolean, Array, Object, Error, RegExp,
  Symbol, Reflect
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.HTMLElement = function HTMLElement(){};

const ctx = vm.createContext(sandbox);
const vfPath = path.resolve(__dirname, '..', 'extension', 'content', 'visual-feedback.js');
const src = fs.readFileSync(vfPath, 'utf8');
vm.runInContext(src, ctx, { filename: 'visual-feedback.js' });

const { ProgressOverlay, ActionGlowOverlay } = sandbox.module.exports;

// Capture the raw shadow-style source by re-reading the file (simpler than
// trying to execute the create() Popover path inside the stub).
const visualFeedbackSrc = src;

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}
function assertEq(a, b, msg) {
  assert(a === b, msg + ' (expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a) + ')');
}

function buildOverlay() {
  const overlay = new ProgressOverlay();
  overlay.host = makeElement('div');
  overlay.shadow = overlay.host.attachShadow({ mode: 'open' });
  const container = makeElement('div');
  container.classList.add('fsb-overlay');
  container.innerHTML = '<inflate/>';
  overlay.shadow.appendChild(container);
  overlay.container = container;
  return overlay;
}

function makeState(opts) {
  opts = opts || {};
  return {
    lifecycle: opts.lifecycle || 'running',
    phase: opts.phase || 'planning',
    display: {
      title: opts.title != null ? opts.title : 'Task',
      subtitle: opts.subtitle != null ? opts.subtitle : '',
      detail: opts.detail != null ? opts.detail : 'Working'
    },
    progress: opts.progress !== undefined ? opts.progress : {
      mode: 'indeterminate', percent: null, label: 'Working', eta: ''
    },
    actionCount: opts.actionCount,
    clientLabel: '',
    result: opts.result
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {

// ===========================================================================
// describe('isThinkingPhase')
// ===========================================================================
console.log('\n=== describe: isThinkingPhase ===');

assert(typeof overlayStateExports.isThinkingPhase === 'function',
  'isThinkingPhase exported on module.exports');
assertEq(overlayStateExports.isThinkingPhase('planning'), true, "isThinkingPhase('planning') === true");
assertEq(overlayStateExports.isThinkingPhase('thinking'), true, "isThinkingPhase('thinking') === true");
assertEq(overlayStateExports.isThinkingPhase('navigation'), false, "isThinkingPhase('navigation') === false");
assertEq(overlayStateExports.isThinkingPhase('extraction'), false, "isThinkingPhase('extraction') === false");
assertEq(overlayStateExports.isThinkingPhase('click'), false, "isThinkingPhase('click') === false");
assertEq(overlayStateExports.isThinkingPhase('acting'), false, "isThinkingPhase('acting') === false");
assertEq(overlayStateExports.isThinkingPhase(null), false, 'isThinkingPhase(null) === false');
assertEq(overlayStateExports.isThinkingPhase(undefined), false, 'isThinkingPhase(undefined) === false');
assertEq(overlayStateExports.isThinkingPhase(''), false, "isThinkingPhase('') === false");
assertEq(overlayStateExports.isThinkingPhase('PLANNING'), true, "isThinkingPhase('PLANNING') case-insensitive");

// ===========================================================================
// describe('thinking suppression in ProgressOverlay.update()')
// ===========================================================================
console.log('\n=== describe: thinking suppression in ProgressOverlay.update() ===');

console.log('\n--- Test: first update with planning phase + generic detail = suppressed ---');
{
  setNow(10000);
  const o = buildOverlay();
  // detail equals the default phase fallback 'Planning next step' would be set upstream;
  // the gate's "generic" check covers 'Working' and the phaseLabel string. Pass 'Working'
  // to simulate the no-real-status-text condition.
  o.update(makeState({ phase: 'planning', detail: 'Working' }));
  const stepTextEl = o.container.querySelector('.fsb-step-text');
  assertEq(stepTextEl.textContent, '', 'thinking-class + elapsed=0 + generic detail -> empty .fsb-step-text');
  // .fsb-task and .fsb-summary still write
  const taskEl = o.container.querySelector('.fsb-task');
  assertEq(taskEl.textContent, 'Task', '.fsb-task still written normally');
  o.destroy();
}

console.log('\n--- Test: after 1100ms elapsed, planning phase no longer suppressed ---');
{
  setNow(20000);
  const o = buildOverlay();
  o.update(makeState({ phase: 'planning', detail: 'Working' }));
  const stepTextEl = o.container.querySelector('.fsb-step-text');
  assertEq(stepTextEl.textContent, '', 'initial suppressed');
  // Advance mocked time past 1s
  advanceNow(1100);
  o.update(makeState({ phase: 'planning', detail: 'Working' }));
  // Wait for any debounce flush
  await sleep(500);
  assertEq(stepTextEl.textContent, 'Working', 'after >1000ms elapsed, suppression released; "Working" written');
  o.destroy();
}

console.log('\n--- Test: navigation phase NOT suppressed even at elapsed=0 ---');
{
  setNow(30000);
  const o = buildOverlay();
  o.update(makeState({ phase: 'navigation', detail: 'Loading https://example.com' }));
  const stepTextEl = o.container.querySelector('.fsb-step-text');
  assertEq(stepTextEl.textContent, 'Loading https://example.com',
    'concrete action phase writes detail immediately regardless of elapsed');
  o.destroy();
}

console.log('\n--- Test: planning phase + REAL non-generic detail NOT suppressed ---');
{
  setNow(40000);
  const o = buildOverlay();
  o.update(makeState({ phase: 'planning', detail: 'Reviewing search results' }));
  const stepTextEl = o.container.querySelector('.fsb-step-text');
  assertEq(stepTextEl.textContent, 'Reviewing search results',
    'real status detail (not "Working" / phaseLabel) writes through even under thinking phase');
  o.destroy();
}

// ===========================================================================
// describe('first-sentence regression guard')
// ===========================================================================
console.log('\n=== describe: first-sentence regression guard ===');

console.log('\n--- Test: legacy state.stepText path collapses multi-sentence to first sentence ---');
{
  setNow(50000);
  const o = buildOverlay();
  // Legacy non-display.* shape -- triggers the fallback at ~line 620.
  // No display key, just stepText.
  o.update({
    phase: 'navigation',
    stepText: 'Sentence one. Sentence two. Sentence three.',
    taskName: 'Legacy task'
  });
  const stepTextEl = o.container.querySelector('.fsb-step-text');
  assert(stepTextEl.textContent === 'Sentence one.' || stepTextEl.textContent.indexOf('Sentence two') < 0,
    'legacy stepText collapses to first sentence; got: ' + JSON.stringify(stepTextEl.textContent));
  o.destroy();
}

console.log('\n--- Test: display.detail multi-sentence smoke (sanitized upstream) ---');
{
  setNow(60000);
  const o = buildOverlay();
  // In real flow, buildOverlayDisplay() applies firstSentence upstream. Here we
  // simulate the already-sanitized payload arriving at update().
  o.update(makeState({ phase: 'navigation', detail: 'Sentence one.' }));
  const stepTextEl = o.container.querySelector('.fsb-step-text');
  assertEq(stepTextEl.textContent, 'Sentence one.',
    'pre-sanitized display.detail flows through unchanged');
  o.destroy();
}

// ===========================================================================
// describe('reduced-motion strict mode')
// ===========================================================================
console.log('\n=== describe: reduced-motion strict mode ===');

console.log('\n--- Test: ProgressOverlay shadow CSS has reduced-motion block covering text surfaces ---');
{
  // Locate the ProgressOverlay shadow style block (~line 410-560 of visual-feedback.js)
  // and verify the @media block contains text-surface selectors.
  const reducedMotionRegex = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
  const blocks = visualFeedbackSrc.match(reducedMotionRegex) || [];
  assert(blocks.length >= 2,
    'at least 2 @media (prefers-reduced-motion: reduce) blocks present (ProgressOverlay + ActionGlowOverlay); got ' + blocks.length);

  // The first block (ProgressOverlay) must contain ALL five text-surface selectors.
  const textSurfaces = ['.fsb-task', '.fsb-summary', '.fsb-step-text', '.fsb-step-number', '.fsb-eta'];
  const progressBlock = blocks[0] || '';
  textSurfaces.forEach(sel => {
    assert(progressBlock.indexOf(sel) >= 0,
      'ProgressOverlay reduced-motion block contains ' + sel);
  });
  assert(progressBlock.indexOf('transition: none') >= 0,
    'ProgressOverlay reduced-motion block uses transition: none');
}

console.log('\n--- Test: .fsb-progress-fill.complete green-flash state preserved (no transition:none on .complete background) ---');
{
  // The .complete rule (background: #34D399) must remain outside transition:none
  // restriction -- a single state change is allowed.
  const completeRule = visualFeedbackSrc.match(/\.fsb-progress-fill\.complete\s*\{[^}]*background:\s*#34D399/);
  assert(completeRule, '.fsb-progress-fill.complete still sets background: #34D399 (green-flash preserved)');
}

console.log('\n--- Test: green-flash completion under matchMedia(reduced-motion)=true STILL fires ---');
{
  setMatchMedia(true);
  setNow(70000);
  const o = buildOverlay();
  o.update(makeState({
    lifecycle: 'final',
    result: 'success',
    phase: 'complete',
    detail: 'Task completed',
    progress: { mode: 'determinate', percent: 100, label: 'Done' }
  }));
  const fillEl = o.container.querySelector('.fsb-progress-fill');
  assert(fillEl.classList.contains('complete'),
    'fill.complete class still set under reduced-motion');
  assert(o.container.style.boxShadow && o.container.style.boxShadow.indexOf('52, 211, 153') >= 0,
    'green box-shadow still applied under reduced-motion (got: ' + o.container.style.boxShadow + ')');
  o.destroy();
  setMatchMedia(false);
}

console.log('\n--- Test: ActionGlowOverlay reduced-motion block still present (regression guard) ---');
{
  // Find the second @media (prefers-reduced-motion: reduce) block.
  const reducedMotionRegex = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
  const blocks = visualFeedbackSrc.match(reducedMotionRegex) || [];
  // Last block should be ActionGlowOverlay's
  const glowBlock = blocks[blocks.length - 1] || '';
  assert(glowBlock.indexOf('.box-overlay') >= 0,
    'ActionGlowOverlay reduced-motion block contains .box-overlay');
  assert(glowBlock.indexOf('.text-highlight') >= 0,
    'ActionGlowOverlay reduced-motion block contains .text-highlight');
  assert(glowBlock.indexOf('transition: none') >= 0,
    'ActionGlowOverlay reduced-motion block has transition: none');
  assert(glowBlock.indexOf('animation: none') >= 0,
    'ActionGlowOverlay reduced-motion block has animation: none');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n=========================================');
console.log('overlay-content-audit.test.js results');
console.log('  passed:', passed);
console.log('  failed:', failed);
console.log('=========================================');
if (failed > 0) process.exit(1);
})();
