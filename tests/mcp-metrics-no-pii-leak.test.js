/**
 * Static-grep CI gate -- fails the build if extension/utils/mcp-metrics-recorder.js
 * source code (with comments stripped) contains any banned PII identifier.
 *
 * Phase 271 / v0.9.69. Enforces CONTEXT decision 6 + COST-03 + PITFALLS §10.1
 * items 1-4: the recorder is the sole MCP fact-emission site, and every row
 * it writes must come from a narrow allowlist (client label, tool name,
 * model id, token counts, cost, confidence, timestamp, dispatcher_route).
 * The recorder MUST NOT touch bodies, page DOM, request URLs, hrefs,
 * innerHTML/outerHTML, clipboard, cookie headers, Authorization headers, or
 * any .value property of any DOM-like object.
 *
 * Banned identifiers (case-insensitive unless noted; whole-word match):
 *   - prompt        (any case)
 *   - url           (any case)
 *   - href          (any case)
 *   - innerHTML     (case-sensitive)
 *   - outerHTML     (case-sensitive)
 *   - clipboard     (any case)
 *   - Cookie        (CASE-SENSITIVE -- header-style identifier)
 *   - Authorization (CASE-SENSITIVE -- header-style identifier)
 *   - .value        (whole-token .value read on any object)
 *
 * The gate strips line and block comments BEFORE scanning so legitimate
 * code-comment references (the heuristic table's `text.length` rule-of-thumb
 * comment) do not trip the gate. We care about RUNTIME references only.
 *
 * Failure mode: exit 1 with a list of which banned identifier(s) matched.
 * The fix is to repair the recorder, not the gate.
 *
 * Run: node tests/mcp-metrics-no-pii-leak.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RECORDER_PATH = path.join(__dirname, '..', 'extension', 'utils', 'mcp-metrics-recorder.js');
const src = fs.readFileSync(RECORDER_PATH, 'utf8');

// Strip /* ... */ blocks first (greedy across newlines is bounded by the */
// terminator), then // line comments. Order matters: stripping line comments
// first would prematurely chop the */ of an unterminated block.
function stripComments(s) {
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return s;
}
const code = stripComments(src);

// Banned identifiers per CONTEXT decision 6 + PITFALLS §10.1.
//   `text.length` is explicitly whitelisted by NOT including a bare `text`
//   entry -- we read only the integer length, never the string value, and
//   the variable name is intentional in the heuristic helper.
//   Cookie / Authorization are case-sensitive (header-style identifiers);
//   the rest are case-insensitive.
const BANNED = [
  { name: 'prompt',        re: /\bprompt\b/i },
  { name: 'url',           re: /\burl\b/i },
  { name: 'href',          re: /\bhref\b/i },
  { name: 'innerHTML',     re: /\binnerHTML\b/ },
  { name: 'outerHTML',     re: /\bouterHTML\b/ },
  { name: 'clipboard',     re: /\bclipboard\b/i },
  { name: 'Cookie',        re: /\bCookie\b/ },
  { name: 'Authorization', re: /\bAuthorization\b/ },
  // Generic ".value" read of an element-like object. Reading
  // `requestPayload.text.length` is fine (no .value). Any `.value` access
  // in recorder source is a hard fail.
  { name: '.value read',   re: /\.value\b/ }
];

const violations = [];
for (const b of BANNED) {
  const m = code.match(b.re);
  if (m) {
    violations.push("Banned identifier '" + b.name + "' (match: '" + m[0] + "') found in " + RECORDER_PATH);
  }
}

if (violations.length > 0) {
  console.error('FAIL: mcp-metrics-recorder.js contains banned PII identifier(s):');
  for (const v of violations) console.error('  - ' + v);
  console.error('See CONTEXT.md decision 6 + PITFALLS §10.1.');
  process.exit(1);
}

console.log('PASS: mcp-metrics-recorder.js source contains no banned PII identifiers.');
console.log('  - 9 banned patterns scanned: prompt, url, href, innerHTML, outerHTML, clipboard, Cookie, Authorization, .value');
console.log('  - Scanned bytes (stripped): ' + code.length + ' / raw: ' + src.length);
process.exit(0);
