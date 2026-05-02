'use strict';

/**
 * Static analysis test for Phase 209 remote control handlers in ws/ws-client.js.
 *
 * Validates the structural contract for the 5 dashboard remote control
 * handlers without booting Chrome. The implementation must:
 *   - Define handleRemoteControlStart/Stop/Click/Key/Scroll as top-level
 *     functions reachable from the bare-function call sites in
 *     ws-client.js _handleMessage.
 *   - Dispatch input via the shared CDP entry points (cdpClickAt,
 *     cdpScrollAt, cdpInsertText, Input.dispatchKeyEvent).
 *   - Validate payloads, decompose dashboard bitmask modifiers, guard
 *     on _remoteControlActive, and broadcast lifecycle state back to
 *     the dashboard via ext:remote-control-state.
 *
 * Run: node tests/remote-control-handlers.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const wsClientSource = fs.readFileSync(path.join(__dirname, '..', 'extension', 'ws', 'ws-client.js'), 'utf8');

console.log('--- remote control handler existence ---');

// RC-04: Lifecycle handlers exist
assert(wsClientSource.includes('function handleRemoteControlStart'), 'handleRemoteControlStart function exists');
assert(wsClientSource.includes('function handleRemoteControlStop'), 'handleRemoteControlStop function exists');

// RC-01: Click handler exists with CDP dispatch
assert(wsClientSource.includes('function handleRemoteClick'), 'handleRemoteClick function exists');
assert(
  wsClientSource.includes("tool: 'cdpClickAt'") || wsClientSource.includes('tool: "cdpClickAt"'),
  'handleRemoteClick uses cdpClickAt CDP verb'
);

// RC-02: Key handler exists with CDP dispatch
assert(wsClientSource.includes('function handleRemoteKey'), 'handleRemoteKey function exists');
assert(wsClientSource.includes('Input.dispatchKeyEvent'), 'handleRemoteKey dispatches CDP keyboard events');
assert(
  wsClientSource.includes("tool: 'cdpInsertText'") || wsClientSource.includes('tool: "cdpInsertText"'),
  'handleRemoteKey uses cdpInsertText for text insertion'
);

// RC-03: Scroll handler exists with CDP dispatch
assert(wsClientSource.includes('function handleRemoteScroll'), 'handleRemoteScroll function exists');
assert(
  wsClientSource.includes("tool: 'cdpScrollAt'") || wsClientSource.includes('tool: "cdpScrollAt"'),
  'handleRemoteScroll uses cdpScrollAt CDP verb'
);

console.log('--- remote control state management ---');

// State variables
assert(wsClientSource.includes('_remoteControlActive'), 'remote control active state variable exists');
assert(wsClientSource.includes('_lastRemoteControlState'), 'last remote control state variable exists');

// State broadcast
assert(wsClientSource.includes('ext:remote-control-state'), 'handlers send ext:remote-control-state to dashboard');
assert(
  wsClientSource.includes("'ready'") || wsClientSource.includes('"ready"'),
  'start handler sets reason to ready'
);
assert(
  wsClientSource.includes("'user-stop'") || wsClientSource.includes('"user-stop"'),
  'stop handler sets reason to user-stop'
);

console.log('--- remote control input validation ---');

// Payload validation
assert(wsClientSource.includes('Number.isFinite'), 'handlers validate coordinates are finite numbers');
const isFiniteMatches = wsClientSource.match(/Number\.isFinite/g) || [];
assert(
  isFiniteMatches.length >= 4,
  'at least 4 Number.isFinite checks (click x, click y, scroll x, scroll y), found ' + isFiniteMatches.length
);

// Modifier decomposition for click (dashboard sends bitmask, cdpClickAt expects booleans)
assert(
  wsClientSource.includes('mods & 1') || wsClientSource.includes('modifiers & 1'),
  'click handler decomposes alt modifier from bitmask'
);
assert(
  wsClientSource.includes('mods & 2') || wsClientSource.includes('modifiers & 2'),
  'click handler decomposes ctrl modifier from bitmask'
);
assert(
  wsClientSource.includes('mods & 8') || wsClientSource.includes('modifiers & 8'),
  'click handler decomposes shift modifier from bitmask'
);

// Guard on remote control active (declaration + 5 handler guards = 6 minimum)
const activeGuardCount = (wsClientSource.match(/_remoteControlActive/g) || []).length;
assert(
  activeGuardCount >= 6,
  'at least 6 references to _remoteControlActive (declaration + 5 handler guards), found ' + activeGuardCount
);

console.log('--- remote control error handling ---');

// Error handling (no crashes)
assert(wsClientSource.includes('[FSB RC]'), 'handlers use [FSB RC] log prefix');
const warnCount = (wsClientSource.match(/console\.warn.*FSB RC/g) || []).length;
assert(
  warnCount >= 5,
  'at least 5 console.warn for validation/error paths, found ' + warnCount
);

console.log('--- remote control WebSocket instance access ---');
assert(
  wsClientSource.includes('__fsbWsInstance'),
  'handlers access WebSocket instance via globalThis.__fsbWsInstance'
);

console.log('\nAll remote control handler tests passed.');
