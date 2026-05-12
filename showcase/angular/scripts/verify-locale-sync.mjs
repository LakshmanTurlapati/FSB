// Phase 261 / ROUTE-02 CI invariant -- asserts Angular + Express locale registries are in lock-step.
// Invoked from CI before the Angular build. Exits 0 on parity, 1 on drift.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const NG = join(ROOT, 'showcase/angular/src/app/core/i18n/locale-constants.ts');
const EX = join(ROOT, 'showcase/server/src/utils/locale-constants.js');

function extractLocales(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const match = text.match(/LOCALES\s*[:=]\s*\[([^\]]+)\]/);
  if (!match) {
    throw new Error(`Could not find LOCALES array literal in ${filePath}`);
  }
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

const ngLocales = extractLocales(NG);
const exLocales = extractLocales(EX);
const same = ngLocales.length === exLocales.length
  && ngLocales.every((code, i) => code === exLocales[i]);

if (!same) {
  console.error('Locale registry drift detected.');
  console.error('  Angular:', JSON.stringify(ngLocales));
  console.error('  Express:', JSON.stringify(exLocales));
  process.exit(1);
}
console.log('Locale registry parity verified:', JSON.stringify(ngLocales));
