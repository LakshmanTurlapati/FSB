#!/usr/bin/env node

/**
 * Native Host Shim -- thin relay between Chrome Native Messaging and Node IPC.
 *
 * Chrome spawns this process via the native host manifest. It reads
 * length-prefixed JSON messages from Chrome on stdin and forwards them
 * to the parent MCP server via Node IPC (process.send). Messages from
 * the MCP server arrive via process.on('message') and are written back
 * to Chrome on stdout using the length-prefixed format.
 */

import type { BridgeMessage } from './types.js';

// ---------------------------------------------------------------------------
// Native Messaging protocol: 4-byte LE length header + UTF-8 JSON body
// ---------------------------------------------------------------------------

let inputBuffer = Buffer.alloc(0);

/**
 * Read one length-prefixed JSON message from stdin.
 * Returns null when stdin closes (Chrome disconnected).
 */
function readNativeMessage(): Promise<object | null> {
  return new Promise((resolve) => {
    const tryRead = (): void => {
      // Need at least the 4-byte header
      if (inputBuffer.length < 4) return;

      const msgLen = inputBuffer.readUInt32LE(0);

      // Need the full message body
      if (inputBuffer.length < 4 + msgLen) return;

      const body = inputBuffer.subarray(4, 4 + msgLen);
      inputBuffer = inputBuffer.subarray(4 + msgLen);

      process.stdin.removeListener('readable', tryRead);
      process.stdin.removeListener('end', onEnd);

      try {
        resolve(JSON.parse(body.toString('utf8')));
      } catch {
        console.error('[FSB Native Host] Failed to parse message');
        resolve(null);
      }
    };

    const onEnd = (): void => {
      process.stdin.removeListener('readable', tryRead);
      resolve(null);
    };

    process.stdin.on('readable', tryRead);
    process.stdin.on('end', onEnd);

    // Accumulate any available data
    const onData = (): void => {
      let chunk: Buffer | null;
      while ((chunk = process.stdin.read() as Buffer | null) !== null) {
        inputBuffer = Buffer.concat([inputBuffer, chunk]);
      }
      tryRead();
    };

    // Kick off an initial read attempt with already-buffered data
    onData();

    // Also listen for future data
    process.stdin.removeListener('readable', tryRead);
    process.stdin.on('readable', onData);
  });
}

/**
 * Write a length-prefixed JSON message to stdout (back to Chrome).
 */
function writeNativeMessage(msg: object): void {
  const json = JSON.stringify(msg);
  const buf = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

// ---------------------------------------------------------------------------
// Main: bidirectional relay between Chrome (stdin/stdout) and MCP server (IPC)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (process.send) {
    // Forked by bridge.ts -- relay IPC <-> Native Messaging
    console.error('[FSB Native Host] Started in IPC relay mode');

    // MCP server -> Chrome: receive IPC messages and write to stdout
    process.on('message', (raw: unknown) => {
      const bridgeMsg = raw as BridgeMessage;
      if (bridgeMsg.channel === 'mcp-to-ext') {
        writeNativeMessage(bridgeMsg.data);
      }
    });

    // Chrome -> MCP server: read stdin and forward via IPC
    while (true) {
      const msg = await readNativeMessage();
      if (!msg) {
        console.error('[FSB Native Host] stdin closed, exiting');
        break;
      }
      process.send!({ channel: 'ext-to-mcp', data: msg });
    }
  } else {
    // Standalone mode (Chrome spawned us directly, no parent IPC)
    console.error('[FSB Native Host] Started in standalone mode (no IPC parent)');

    // In standalone mode, just echo messages back (useful for testing)
    while (true) {
      const msg = await readNativeMessage();
      if (!msg) break;
      console.error('[FSB Native Host] Received:', JSON.stringify(msg));
    }
  }

  process.exit(0);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.error('[FSB Native Host] SIGTERM received, exiting');
  process.exit(0);
});

main().catch((err: unknown) => {
  console.error('[FSB Native Host] Fatal:', err);
  process.exit(1);
});
