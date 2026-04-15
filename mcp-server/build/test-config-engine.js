/**
 * Integration tests for config-writer.js covering TOML, YAML, and full lifecycle roundtrips.
 * JSON and JSONC formats are already covered by Task 1 inline verification.
 */
import { installToConfig, removeFromConfig } from './config-writer.js';
import { PLATFORMS } from './platforms.js';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

// --- Test 1: TOML roundtrip (Codex platform) ---
const tmpToml = mkdtempSync(join(tmpdir(), 'fsb-toml-'));
const tomlPath = join(tmpToml, 'config.toml');
writeFileSync(tomlPath, `[mcp_servers.other-tool]
command = "npx"
args = ["-y", "other-tool"]
`);

const codexPlatform = { ...PLATFORMS['codex'] };
const result1 = await installToConfig(tomlPath, codexPlatform, 'fsb');
if (result1.status !== 'created') {
  console.error('T1 fail: expected created, got', result1.status, result1.message);
  process.exit(1);
}
const tomlData = parseToml(readFileSync(tomlPath, 'utf-8'));
if (!tomlData.mcp_servers?.fsb?.command) {
  console.error('T1 fail: fsb entry missing in TOML');
  process.exit(1);
}
if (!tomlData.mcp_servers?.['other-tool']?.command) {
  console.error('T1 fail: other-tool lost in TOML merge');
  process.exit(1);
}
if (tomlData.mcp_servers['other-tool'].command !== 'npx') {
  console.error('T1 fail: other-tool command corrupted');
  process.exit(1);
}
console.log('T1 pass: TOML roundtrip with existing content preserved');

// --- Test 2: TOML idempotency ---
const result2 = await installToConfig(tomlPath, codexPlatform, 'fsb');
if (result2.status !== 'skipped') {
  console.error('T2 fail: expected skipped, got', result2.status);
  process.exit(1);
}
console.log('T2 pass: TOML idempotency skip');

// --- Test 3: YAML array roundtrip (Continue platform) ---
const tmpYaml = mkdtempSync(join(tmpdir(), 'fsb-yaml-'));
const yamlPath = join(tmpYaml, 'config.yaml');
writeFileSync(yamlPath, `mcpServers:
  - name: existing-server
    command: other
    args:
      - "-y"
      - "other-pkg"
`);

const continuePlatform = { ...PLATFORMS['continue'] };
const result3 = await installToConfig(yamlPath, continuePlatform, 'fsb');
if (result3.status !== 'created') {
  console.error('T3 fail: expected created, got', result3.status, result3.message);
  process.exit(1);
}
const yamlData = parseYaml(readFileSync(yamlPath, 'utf-8'));
if (!Array.isArray(yamlData.mcpServers)) {
  console.error('T3 fail: mcpServers should be an array');
  process.exit(1);
}
if (yamlData.mcpServers.length !== 2) {
  console.error('T3 fail: expected 2 entries, got', yamlData.mcpServers.length);
  process.exit(1);
}
const hasExisting = yamlData.mcpServers.some(s => s.name === 'existing-server');
const hasFsb = yamlData.mcpServers.some(s => s.name === 'fsb');
if (!hasExisting) {
  console.error('T3 fail: existing-server entry lost');
  process.exit(1);
}
if (!hasFsb) {
  console.error('T3 fail: fsb entry not added');
  process.exit(1);
}
console.log('T3 pass: YAML array roundtrip with existing entries preserved');

// --- Test 4: YAML idempotency ---
const result4 = await installToConfig(yamlPath, continuePlatform, 'fsb');
if (result4.status !== 'skipped') {
  console.error('T4 fail: expected skipped, got', result4.status);
  process.exit(1);
}
console.log('T4 pass: YAML idempotency skip');

// --- Test 5: Install-then-uninstall cycle (JSON) ---
const tmpCycle = mkdtempSync(join(tmpdir(), 'fsb-cycle-'));
const cyclePath = join(tmpCycle, 'config.json');
writeFileSync(cyclePath, '{}');

const claudePlatform = { ...PLATFORMS['claude-desktop'] };

// Install
const result5a = await installToConfig(cyclePath, claudePlatform, 'fsb');
if (result5a.status !== 'created') {
  console.error('T5a fail: expected created, got', result5a.status);
  process.exit(1);
}
const afterInstall = JSON.parse(readFileSync(cyclePath, 'utf-8'));
if (!afterInstall.mcpServers?.fsb) {
  console.error('T5a fail: fsb not present after install');
  process.exit(1);
}

// Remove
const result5b = await removeFromConfig(cyclePath, claudePlatform, 'fsb');
if (result5b.status !== 'removed') {
  console.error('T5b fail: expected removed, got', result5b.status);
  process.exit(1);
}
const afterRemove = JSON.parse(readFileSync(cyclePath, 'utf-8'));
if (afterRemove.mcpServers?.fsb) {
  console.error('T5b fail: fsb still present after remove');
  process.exit(1);
}
if (!afterRemove.mcpServers || typeof afterRemove.mcpServers !== 'object') {
  console.error('T5b fail: mcpServers key should still exist');
  process.exit(1);
}

// Remove again -- should be not-found
const result5c = await removeFromConfig(cyclePath, claudePlatform, 'fsb');
if (result5c.status !== 'not-found') {
  console.error('T5c fail: expected not-found, got', result5c.status);
  process.exit(1);
}
console.log('T5 pass: install-then-uninstall cycle (created -> removed -> not-found)');

console.log('All integration tests passed');
