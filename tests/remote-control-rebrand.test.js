/**
 * Phase 223 RBR-01..05 rebrand checks (Wave 0 / TDD-first).
 *
 * Asserts the "Agents" -> "Remote Control" copy rebrand across the extension
 * control panel and the showcase about/support pages. Today (Wave 0) these
 * assertions FAIL by design -- Plan 02 lands the implementation that makes
 * them green.
 *
 * Static-analysis only (no jsdom, no DOM). Plain Node + fs reads + string
 * .includes() / RegExp.test() checks. No external deps. Mirrors the canonical
 * pattern from tests/sync-tab-runtime.test.js.
 *
 * Run: node tests/remote-control-rebrand.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

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

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const CP = read(path.join('extension', 'ui', 'control_panel.html'));
const ABOUT = read(path.join('showcase', 'angular', 'src', 'app', 'pages', 'about', 'about-page.component.html'));
const SUPPORT = read(path.join('showcase', 'angular', 'src', 'app', 'pages', 'support', 'support-page.component.html'));
const CSS = read(path.join('extension', 'ui', 'options.css'));

console.log('\n--- Phase 223 RBR-01: Nav label rename ---');

assert(
  CP.includes('<span>Remote Control <span class="feature-badge beta">Beta</span></span>'),
  '[RBR-01] control_panel.html nav-item label reads "Remote Control" with Beta badge (not "Agents")'
);
assert(
  !/<span>Agents <span class="feature-badge beta">Beta<\/span><\/span>/.test(CP),
  '[RBR-01] control_panel.html no longer contains the legacy "Agents <Beta>" nav label'
);

console.log('\n--- Phase 223 RBR-02: Beta badge reuse (no new variant) ---');

assert(
  /\.feature-badge\.beta\s*\{/.test(CSS),
  '[RBR-02] options.css continues to define .feature-badge.beta (reused, not duplicated)'
);
const newVariantMatches = CSS.match(/\.feature-badge\.[a-z-]+\s*\{/g) || [];
assert(
  newVariantMatches.length <= 4,
  '[RBR-02] no proliferation of new .feature-badge.* variants (cap at existing count)'
);

console.log('\n--- Phase 223 RBR-03: Section header + id retention ---');

assert(
  CP.includes('<h2>Remote Control</h2>'),
  '[RBR-03] section header reads "Remote Control" (not "Background Agents")'
);
assert(
  !/<h2>Background Agents<\/h2>/.test(CP),
  '[RBR-03] legacy "<h2>Background Agents</h2>" header removed'
);
// Deprecation card body copy ("Background agents have left the building.") is
// retained intentionally per research Pattern 3 / Open Question 4 -- do NOT
// assert it absent. Section id="background-agents" retained per research
// Pitfall 4 (CSS class rename out of scope).
assert(
  CP.includes('id="background-agents"'),
  '[RBR-03] section id="background-agents" retained (id rename out of scope; copy-only rebrand)'
);

console.log('\n--- Phase 223 RBR-04: Options page consistency ---');

assert(
  CP.includes('data-section="background-agents"') &&
  CP.includes('<span>Remote Control <span class="feature-badge beta">Beta</span></span>'),
  '[RBR-04] options page (control_panel.html) shows "Remote Control" copy on the data-section="background-agents" nav item'
);

console.log('\n--- Phase 223 RBR-05: Showcase mirror copy ---');

assert(
  ABOUT.includes('<i class="fa-solid fa-server"></i> Remote Control') &&
  !/<i class="fa-solid fa-server"><\/i> Agents/.test(ABOUT),
  '[RBR-05] about-page.component.html sidebar mockup reads "Remote Control" (not "Agents")'
);
assert(
  !ABOUT.includes('<h4>Background Agents</h4>'),
  '[RBR-05] about-page.component.html arch-box no longer reads "Background Agents"'
);
assert(
  !/<h3>What are Background Agents\?<\/h3>/.test(SUPPORT),
  '[RBR-05] support-page.component.html FAQ no longer asks "What are Background Agents?"'
);

console.log('\n--- Phase 223 RBR emoji guard (CLAUDE.md global rule) ---');

const emojiRe = /[\u{10000}-\u{10FFFF}]/u;
[['control_panel.html', CP], ['about-page', ABOUT], ['support-page', SUPPORT]].forEach(function (pair) {
  assert(!emojiRe.test(pair[1]), '[RBR-EMOJI] ' + pair[0] + ' contains no emoji (CLAUDE.md global rule)');
});

console.log('\n=== Phase 223 RBR rebrand results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
