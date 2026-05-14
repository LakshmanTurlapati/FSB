/**
 * Phase 273 / INGEST-13 + D-Log-audit -- CI grep gate: no IP-leaking access-log
 * middleware in showcase/server/src/.
 *
 * The gate walks showcase/server/src/ recursively, strips comments from each
 * .js file, and fails the build if ANY of the following patterns match:
 *
 *   - require('morgan') / require('winston') / require('express-winston') /
 *     require('express-logger') / require('pino-http') / require('express-pino-logger')
 *     -- these libraries default to capturing req.ip in their access-log output
 *     (and adding a redact filter is too easy to miss in review).
 *   - fs.writeFile / fs.appendFile / fs.writeFileSync / fs.appendFileSync that
 *     reference req.ip in the same call -- direct plaintext leak.
 *   - this/module/exports/global container appended/added with req.ip.
 *
 * Explicitly ALLOWED:
 *   - console.log / console.error references (the request-log middleware in
 *     server.js itself uses console.log and only records method/path/status/duration,
 *     NOT req.ip). console.log isn't in the grep list.
 *   - req.ip read inside the hashIp(req.ip, db) call site (this lives in routes
 *     and middleware; that's the SOLE permitted plaintext touch point).
 *
 * Failure mode: process.exit(1) with the file path + line number + pattern name.
 *
 * Run: node tests/server-no-ip-leak.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'showcase', 'server', 'src');

const BANNED_MIDDLEWARE_PATTERNS = [
  { name: 'morgan',                re: /require\(\s*['"]morgan['"]\s*\)/ },
  { name: 'winston',               re: /require\(\s*['"]winston['"]\s*\)/ },
  { name: 'express-winston',       re: /require\(\s*['"]express-winston['"]\s*\)/ },
  { name: 'express-logger',        re: /require\(\s*['"]express-logger['"]\s*\)/ },
  { name: 'pino-http',             re: /require\(\s*['"]pino-http['"]\s*\)/ },
  { name: 'express-pino-logger',   re: /require\(\s*['"]express-pino-logger['"]\s*\)/ },
];

const LEAK_PATTERNS = [
  { name: 'fs.appendFile/writeFile + req.ip same call',
    re: /fs\.(append|write)File[\s\S]{0,400}?req\.ip/ },
  { name: 'fs.appendFileSync/writeFileSync + req.ip same call',
    re: /fs\.(append|write)FileSync[\s\S]{0,400}?req\.ip/ },
  { name: 'req.ip pushed/set/added to module/exports/this/global container',
    re: /\b(this|module|exports|global)\.[a-zA-Z_][a-zA-Z0-9_]*\.(push|set|add)\([^)]*req\.ip/ },
];

function stripComments(s) {
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return s;
}

function walkJsFiles(dir, out) {
  if (out === undefined) out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkJsFiles(full, out);
    else if (e.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

const violations = [];

const allFiles = walkJsFiles(ROOT);
for (const file of allFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const stripped = stripComments(src);

  for (const p of BANNED_MIDDLEWARE_PATTERNS) {
    const m = p.re.exec(stripped);
    if (m) {
      const idx = stripped.indexOf(m[0]);
      const line = stripped.slice(0, idx).split('\n').length;
      violations.push({ file: path.relative(path.join(__dirname, '..'), file), line, pattern: p.name });
    }
  }
  for (const p of LEAK_PATTERNS) {
    const m = p.re.exec(stripped);
    if (m) {
      const idx = stripped.indexOf(m[0]);
      const line = stripped.slice(0, idx).split('\n').length;
      violations.push({ file: path.relative(path.join(__dirname, '..'), file), line, pattern: p.name });
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: showcase/server/src/ contains IP-leak-prone patterns:');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -- pattern: ${v.pattern}`);
  }
  console.error('See Phase 273 CONTEXT.md "Log audit" + INGEST-13.');
  console.error('Fix the code; do NOT weaken this gate.');
  process.exit(1);
}

console.log(`PASS: scanned ${allFiles.length} .js files under showcase/server/src/`);
console.log(`  - 6 banned middleware patterns: morgan, winston, express-winston, express-logger, pino-http, express-pino-logger`);
console.log(`  - 3 leak-pattern checks: fs.write/append + req.ip, fs.write/appendSync + req.ip, container.{push|set|add}(req.ip)`);
console.log(`  - Files scanned: ${allFiles.map(f => path.relative(path.join(__dirname, '..'), f)).join(', ')}`);
process.exit(0);
