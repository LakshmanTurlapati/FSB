import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MCPMessage, MCPResponse, BridgeMessage } from './types.js';
import { FSB_ERROR_MESSAGES } from './errors.js';

interface PendingRequest {
  resolve: (value: MCPResponse) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class NativeMessagingBridge {
  private shim: ChildProcess | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private connected = false;
  private progressListeners = new Map<string, (progress: MCPResponse) => void>();
  private msgIdCounter = 0;

  /**
   * Fork the native-host-shim as a child process and set up IPC message
   * handling. The shim acts as the Chrome Native Messaging host -- it
   * reads/writes length-prefixed JSON on stdin/stdout with Chrome, and
   * relays messages to/from this bridge over Node IPC.
   */
  async connect(): Promise<void> {
    const shimPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'native-host-shim.js',
    );

    this.shim = fork(shimPath, [], { stdio: ['pipe', 'pipe', 'inherit', 'ipc'] });

    this.shim.on('message', (raw: unknown) => {
      const msg = raw as BridgeMessage;
      if (msg.channel !== 'ext-to-mcp') return;

      const resp = msg.data as MCPResponse;

      // Progress notifications go to listeners, not pending resolvers
      if (resp.type === 'mcp:progress') {
        const listener = this.progressListeners.get(resp.id);
        if (listener) listener(resp);
        return;
      }

      // Final result -- resolve the pending request
      const pending = this.pendingRequests.get(resp.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(resp.id);
        this.progressListeners.delete(resp.id);
        pending.resolve(resp);
      }
    });

    this.shim.on('exit', (code) => {
      console.error(`[FSB MCP] Native host shim exited with code ${code}`);
      this.connected = false;

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Native host shim exited'));
        this.pendingRequests.delete(id);
      }
      this.progressListeners.clear();
      this.shim = null;
    });

    this.connected = true;
    console.error('[FSB MCP] Native messaging bridge connected');
  }

  /**
   * Kill the shim process and reject all pending requests.
   */
  disconnect(): void {
    if (this.shim) {
      this.shim.kill();
      this.shim = null;
    }

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge disconnected'));
      this.pendingRequests.delete(id);
    }

    this.progressListeners.clear();
    this.connected = false;
    console.error('[FSB MCP] Native messaging bridge disconnected');
  }

  /**
   * Send a message to the extension via the native host shim and wait
   * for a response with the matching id.
   *
   * @param msg      Message without id (id is auto-generated)
   * @param options  Optional timeout (ms) and progress callback
   * @returns        The payload from the extension response
   */
  async sendAndWait(
    msg: Omit<MCPMessage, 'id'>,
    options?: { timeout?: number; onProgress?: (p: MCPResponse) => void },
  ): Promise<Record<string, unknown>> {
    if (!this.connected || !this.shim) {
      throw new Error(FSB_ERROR_MESSAGES['native_messaging_error']);
    }

    const id = this.generateId();
    const fullMsg: MCPMessage = { id, ...msg };
    const timeoutMs = options?.timeout ?? 30_000;

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.progressListeners.delete(id);
        reject(new Error(`Request ${id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (resp: MCPResponse) => resolve(resp.payload),
        reject,
        timeout: timer,
      });

      if (options?.onProgress) {
        this.progressListeners.set(id, options.onProgress);
      }

      this.shim!.send({ channel: 'mcp-to-ext', data: fullMsg } satisfies BridgeMessage);
    });
  }

  /** Whether the bridge is connected to the native host shim. */
  get isConnected(): boolean {
    return this.connected;
  }

  /** Generate a unique message ID. */
  generateId(): string {
    return `mcp_${++this.msgIdCounter}_${Date.now()}`;
  }
}
