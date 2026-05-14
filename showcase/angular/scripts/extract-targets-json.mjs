#!/usr/bin/env node
// Phase 274 / Plan 02 -- helper: walk a target XLIFF (messages.{lang}.xlf) and
// emit a JSON object { id: target_text } so we can merge new translations
// authored elsewhere and then re-run assemble-xliff-target.mjs.
//
// Usage:
//   node scripts/extract-targets-json.mjs src/locale/messages.es.xlf > /tmp/es-existing.json

import { readFileSync } from 'node:fs';

const [, , filePath] = process.argv;
if (!filePath) {
  console.error('Usage: extract-targets-json.mjs <messages.xx.xlf>');
  process.exit(2);
}

const text = readFileSync(filePath, 'utf8');
const out = {};

// Walk every <trans-unit id="..."> ... </trans-unit> block and pull out the
// <target ...>...</target> body verbatim. The body MAY contain <x> placeholders
// and entity references; we copy bytes as-is.
const transUnitRe = /<trans-unit id="([^"]+)" datatype="html">([\s\S]*?)<\/trans-unit>/g;
let m;
while ((m = transUnitRe.exec(text)) !== null) {
  const id = m[1];
  const body = m[2];
  // First <target ...>...</target> in the body.
  const tgtMatch = body.match(/<target[^>]*>([\s\S]*?)<\/target>/);
  if (tgtMatch) {
    out[id] = tgtMatch[1];
  }
}

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
