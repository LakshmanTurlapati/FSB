#!/usr/bin/env node
// Phase 265 -- Extract {id: source_text} from messages.xlf as a JSON map.
// Used as the input the translator (Claude in-session) fills with translations.
//
// Usage: node scripts/extract-translation-skeleton.mjs > /tmp/sources.json
import { readFileSync } from 'node:fs';
const source = readFileSync('src/locale/messages.xlf', 'utf8');
const out = {};
const re = /<trans-unit id="([^"]+)" datatype="html">\s*<source>([\s\S]*?)<\/source>/g;
let m;
while ((m = re.exec(source)) !== null) {
  out[m[1]] = m[2];
}
process.stdout.write(JSON.stringify(out, null, 2));
