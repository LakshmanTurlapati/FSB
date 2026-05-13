#!/usr/bin/env node
// Phase 265 / Plan 01 -- Assemble a target XLIFF from messages.xlf + a translations
// JSON map. Reads translations as {id: "translated target string"}, walks the source
// XLIFF, and emits a target XLIFF byte-equal in <source> / <context-group> / attribute
// structure but with a <target state="translated"> inserted after each <source>.
//
// Usage:
//   node scripts/assemble-xliff-target.mjs <locale> <translations.json> > messages.<locale>.xlf
//
// Example:
//   node scripts/assemble-xliff-target.mjs es src/locale/translations.es.json \
//     > src/locale/messages.es.xlf

import { readFileSync } from 'node:fs';

const [, , locale, jsonPath] = process.argv;
if (!locale || !jsonPath) {
  console.error('Usage: assemble-xliff-target.mjs <locale> <translations.json>');
  process.exit(2);
}

const SOURCE_XLIFF = 'src/locale/messages.xlf';
const source = readFileSync(SOURCE_XLIFF, 'utf8');
const translations = JSON.parse(readFileSync(jsonPath, 'utf8'));

// Patch <file ...> line to add target-language.
let out = source.replace(
  /<file\s+source-language="en"\s+datatype="plaintext"\s+original="ng2\.template">/,
  `<file source-language="en" target-language="${locale}" datatype="plaintext" original="ng2.template">`
);

// Walk each <trans-unit id="..."> ... </trans-unit> and inject <target> after </source>.
const missing = [];
const extra = new Set(Object.keys(translations));
out = out.replace(
  /<trans-unit id="([^"]+)" datatype="html">([\s\S]*?)<\/trans-unit>/g,
  (match, id, body) => {
    const target = translations[id];
    extra.delete(id);
    if (target === undefined) {
      missing.push(id);
      return match; // leave unchanged; build will error
    }
    // Inject <target> immediately after </source>.
    const patched = body.replace(
      /(<\/source>)/,
      `$1\n        <target state="translated">${target}</target>`
    );
    return `<trans-unit id="${id}" datatype="html">${patched}</trans-unit>`;
  }
);

if (missing.length > 0) {
  console.error(`FATAL: ${missing.length} trans-units missing translation in ${jsonPath}:`);
  for (const id of missing.slice(0, 20)) console.error(`  - ${id}`);
  if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
  process.exit(1);
}
if (extra.size > 0) {
  console.error(`WARNING: ${extra.size} keys in ${jsonPath} have no matching trans-unit:`);
  for (const id of [...extra].slice(0, 20)) console.error(`  - ${id}`);
}

process.stdout.write(out);
