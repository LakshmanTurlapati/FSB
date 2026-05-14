#!/usr/bin/env node
/**
 * Phase 275 / Plan 04 -- CWS listing CI guard.
 *
 * Reads:
 *   - store-assets/chrome-web-store/listing-copy.md
 *   - store-assets/chrome-web-store/privacy-practices-evidence.md
 *   - extension/manifest.json
 *
 * Asserts:
 *   1. listing-copy.md contains a `## Data Collection` or `## Data we collect`
 *      heading (case-insensitive).
 *   2. listing-copy.md mentions `full-selfbrowsing.com/privacy`.
 *   3. The string `#telemetry-disclosure` appears in either listing-copy.md
 *      OR privacy-practices-evidence.md.
 *   4. privacy-practices-evidence.md exists and is non-empty.
 *   5. extension/manifest.json has `homepage_url`.
 *
 * Exit 0 on pass, exit 1 with descriptive errors on fail.
 *
 * Uses only Node built-ins (fs, path, process).
 */

'use strict';

import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const LISTING = resolve(ROOT, 'store-assets/chrome-web-store/listing-copy.md');
const EVIDENCE = resolve(ROOT, 'store-assets/chrome-web-store/privacy-practices-evidence.md');
const MANIFEST = resolve(ROOT, 'extension/manifest.json');

const failures = [];

function safeRead(path, label) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    failures.push(`${label}: cannot read ${path} (${err.code || err.message})`);
    return null;
  }
}

function nonEmpty(path, label) {
  try {
    const s = statSync(path);
    if (!s.isFile()) {
      failures.push(`${label}: ${path} is not a regular file`);
      return false;
    }
    if (s.size === 0) {
      failures.push(`${label}: ${path} is empty`);
      return false;
    }
    return true;
  } catch (err) {
    failures.push(`${label}: cannot stat ${path} (${err.code || err.message})`);
    return false;
  }
}

// 1 + 2: listing-copy.md
const listing = safeRead(LISTING, 'listing-copy.md');
if (listing !== null) {
  if (!/^##\s+(Data Collection|Data we collect)/im.test(listing)) {
    failures.push(
      `listing-copy.md: missing required heading. Expected one of:\n` +
      `    ## Data Collection\n` +
      `    ## Data we collect\n` +
      `  (case-insensitive, at column 0 of any line).`
    );
  }
  if (!listing.includes('full-selfbrowsing.com/privacy')) {
    failures.push(
      `listing-copy.md: missing required reference to 'full-selfbrowsing.com/privacy'.\n` +
      `  This URL must appear somewhere in the file so reviewers can navigate to the\n` +
      `  full privacy policy from the CWS listing.`
    );
  }
}

// 3: telemetry-disclosure anchor in listing OR evidence.
const evidence = safeRead(EVIDENCE, 'privacy-practices-evidence.md');
const listingHasAnchor =
  listing !== null && listing.includes('#telemetry-disclosure');
const evidenceHasAnchor =
  evidence !== null && evidence.includes('#telemetry-disclosure');
if (!listingHasAnchor && !evidenceHasAnchor) {
  failures.push(
    `Neither listing-copy.md nor privacy-practices-evidence.md contains the\n` +
    `  anchor '#telemetry-disclosure'. At least one of them must reference\n` +
    `  the privacy-page anchor where the telemetry surface is fully documented.`
  );
}

// 4: privacy-practices-evidence.md exists + non-empty.
nonEmpty(EVIDENCE, 'privacy-practices-evidence.md');

// 5: extension/manifest.json has homepage_url.
const manifestRaw = safeRead(MANIFEST, 'extension/manifest.json');
if (manifestRaw !== null) {
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (err) {
    failures.push(`extension/manifest.json: invalid JSON (${err.message})`);
    manifest = null;
  }
  if (manifest && (typeof manifest.homepage_url !== 'string' || manifest.homepage_url.length === 0)) {
    failures.push(
      `extension/manifest.json: missing or empty 'homepage_url'.\n` +
      `  The CWS listing requires a homepage URL (recommended: 'https://full-selfbrowsing.com').`
    );
  }
}

if (failures.length > 0) {
  console.error('verify-store-listing: FAIL');
  for (const f of failures) {
    console.error('  - ' + f);
  }
  process.exit(1);
}

console.log('verify-store-listing: PASS (5 checks green)');
process.exit(0);
