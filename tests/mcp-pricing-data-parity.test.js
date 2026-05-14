/**
 * CI gate -- enforces byte-exact parity between mcp/data/mcp-pricing-data.json
 * (source of truth) and extension/utils/mcp-pricing-data.json (extension bundle
 * copy).
 *
 * Phase 270 / v0.9.69. Fails the build on any divergence so contributors can't
 * update one copy without the other. If the test fails, the fix is a single
 * `cp` command (which the test prints).
 *
 * Run: node tests/mcp-pricing-data-parity.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MCP_PATH = path.join(__dirname, '../mcp/data/mcp-pricing-data.json');
const EXT_PATH = path.join(__dirname, '../extension/utils/mcp-pricing-data.json');

const mcpRaw = fs.readFileSync(MCP_PATH, 'utf-8');
const extRaw = fs.readFileSync(EXT_PATH, 'utf-8');

if (mcpRaw === extRaw) {
  console.log('PASS: mcp/data/mcp-pricing-data.json and extension/utils/mcp-pricing-data.json are byte-exact equal');
  process.exit(0);
}

// Divergence: emit a helpful unified-diff-style hint of the first 5 mismatching
// lines so the executor can immediately see what drifted.
const mcpLines = mcpRaw.split('\n');
const extLines = extRaw.split('\n');
console.error('FAIL: mcp/data and extension/utils JSON copies diverge.');
console.error('     Run: cp ' + MCP_PATH + ' ' + EXT_PATH);
console.error('First mismatching lines:');
const maxLines = Math.max(mcpLines.length, extLines.length);
let shown = 0;
for (let i = 0; i < maxLines && shown < 5; i++) {
  if (mcpLines[i] !== extLines[i]) {
    console.error('  line ' + (i + 1) + ':');
    console.error('    mcp: ' + (mcpLines[i] === undefined ? '<EOF>' : mcpLines[i]));
    console.error('    ext: ' + (extLines[i] === undefined ? '<EOF>' : extLines[i]));
    shown++;
  }
}
process.exit(1);
