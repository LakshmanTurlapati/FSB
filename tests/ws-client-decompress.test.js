'use strict';

/**
 * Phase 211-01 -- WebSocket inbound _lz decompression symmetry test.
 * Validates WS-01, WS-02, WS-03 contracts in ws/ws-client.js.
 *
 * Static analysis confirms the symmetric inbound branch + WS-03 outbound
 * contract comment exist, and a round-trip exercise against the actual
 * vendored lib/lz-string.min.js confirms the compress -> envelope ->
 * decompress -> JSON.parse round-trip works for a payload large enough
 * to trip the >1024-byte outbound threshold.
 *
 * Run: node tests/ws-client-decompress.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const wsClientSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'ws', 'ws-client.js'),
  'utf8'
);

console.log('--- WS-01: inbound _lz envelope branch ---');
assert(
  wsClientSource.includes("raw && raw._lz === true && typeof raw.d === 'string'"),
  'inbound onmessage detects _lz envelope shape'
);
assert(
  wsClientSource.includes('LZString.decompressFromBase64(raw.d)'),
  'inbound branch invokes LZString.decompressFromBase64'
);
console.log('  PASS: inbound _lz envelope branch present');

console.log('--- WS-02: failure recording categories ---');
assert(
  wsClientSource.includes("recordFSBTransportFailure('decompress-failed'"),
  'decompress-failed category recorded via recordFSBTransportFailure'
);
assert(
  wsClientSource.includes("recordFSBTransportFailure('decompress-unavailable'"),
  'decompress-unavailable category recorded via recordFSBTransportFailure'
);
console.log('  PASS: WS-02 failure categories wired through recordFSBTransportFailure');

console.log('--- WS-03: outbound contract documentation ---');
assert(
  wsClientSource.includes('_lz envelope contract (round-trip)'),
  'WS-03 contract comment block present'
);
assert(
  wsClientSource.includes('PITFALLS.md P9'),
  'WS-03 contract references PITFALLS.md P9 (anti-deflate)'
);
console.log('  PASS: WS-03 outbound contract documented');

console.log('--- Anti-list (no permessage-deflate handshake or stateful deflate) ---');
assert(
  !wsClientSource.includes('Sec-WebSocket-Extensions'),
  'no Sec-WebSocket-Extensions header (anti-list)'
);
assert(
  !/\bpako\b/.test(wsClientSource),
  'no pako reference (anti-list)'
);
assert(
  !/\bDecompressionStream\b/.test(wsClientSource),
  'no DecompressionStream usage (anti-list)'
);
console.log('  PASS: anti-list constraints honored');

console.log('--- Round-trip: lib/lz-string.min.js compress -> envelope -> decompress ---');
const lzSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'lib', 'lz-string.min.js'),
  'utf8'
);
// lz-string.min.js is browser-targeted but plain ES5; eval into a local sandbox
// that exposes a `globalThis`-style binding. Mirrors how the SW loads it via
// importScripts in background.js:37.
var sandbox = {};
(new Function('var window = this; var globalThis = this;\n' + lzSource + '\nthis.LZString = LZString;')).call(sandbox);
assert(typeof sandbox.LZString === 'object' && typeof sandbox.LZString.compressToBase64 === 'function', 'LZString loaded into test sandbox');

var bigPayload = JSON.stringify({
  type: 'dash:task-submit',
  payload: { task: 'a'.repeat(2000) },
  ts: 12345
});
var compressed = sandbox.LZString.compressToBase64(bigPayload);
assert(typeof compressed === 'string' && compressed.length > 0, 'compress produces base64 string');
assert(compressed.length < bigPayload.length, 'compressed payload is smaller than raw (>1024 byte threshold met)');

var envelope = { _lz: true, d: compressed };
assert(envelope._lz === true && typeof envelope.d === 'string', 'envelope matches the shape ws-client.js inbound branch checks for');

var decoded = sandbox.LZString.decompressFromBase64(envelope.d);
assert(decoded === bigPayload, 'decompress round-trips exactly');

var parsed = JSON.parse(decoded);
assert(parsed.type === 'dash:task-submit', 'inner message type preserved through round-trip');
assert(parsed.payload.task.length === 2000, 'inner payload preserved through round-trip');
console.log('  PASS: compress -> envelope -> decompress -> parse round-trip');

console.log('--- Negative: malformed base64 returns falsy ---');
var bad = sandbox.LZString.decompressFromBase64('!!!not-valid!!!');
assert(!bad, 'malformed base64 returns null/empty (matches the failure branch in ws-client.js)');
console.log('  PASS: malformed envelope detected by the same falsy-check ws-client.js uses');

console.log('\nAll assertions passed.');
