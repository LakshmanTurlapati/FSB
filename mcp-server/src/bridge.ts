import { WebSocketServer, type WebSocket as WsWebSocket } from 'ws';
import type { MCPMessage, MCPResponse } from './types.js';
import { FSB_ERROR_MESSAGES } from './errors.js';

interface PendingRequest {
  resolve: (value: MCPResponse) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class WebSocketBridge {
  private wss: WebSocketServer | null = null;
  private client: WsWebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private connected = false;
  private progressListeners = new Map<string, (progress: MCPResponse) => void>();
  private msgIdCounter = 0;

  /**
   * Create a WebSocket server on port 7225 and listen for extension
   * connections. The bridge is ready once the server starts listening;
   * it does not wait for a client to connect.
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.wss = new WebSocketServer({ port: 7225 });

      this.wss.on('listening', () => {
        console.error('[FSB MCP] WebSocket server listening on port 7225');
        resolve();
      });

      this.wss.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error('[FSB MCP] Port 7225 already in use. Is another MCP server running?');
        }
        reject(err);
      });

      this.wss.on('connection', (ws: WsWebSocket) => {
        // Only allow one connected client at a time
        if (this.client) {
          console.error('[FSB MCP] New client connected, closing previous connection');
          this.client.close();
        }

        this.client = ws;
        this.connected = true;
        console.error('[FSB MCP] Extension WebSocket connected');

        ws.on('message', (data: Buffer | string) => {
          let resp: MCPResponse;
          try {
            resp = JSON.parse(typeof data === 'string' ? data : data.toString()) as MCPResponse;
          } catch {
            console.error('[FSB MCP] Failed to parse incoming WebSocket message');
            return;
          }

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

        ws.on('close', () => {
          console.error('[FSB MCP] Extension WebSocket disconnected');
          this.client = null;
          this.connected = false;

          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Extension WebSocket disconnected'));
            this.pendingRequests.delete(id);
          }
          this.progressListeners.clear();
        });

        ws.on('error', (err: Error) => {
          console.error('[FSB MCP] WebSocket client error:', err.message);
        });
      });
    });
  }

  /**
   * Close all connected clients and the WebSocket server, reject
   * pending requests.
   */
  disconnect(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge disconnected'));
      this.pendingRequests.delete(id);
    }

    this.progressListeners.clear();
    this.connected = false;
    console.error('[FSB MCP] WebSocket bridge disconnected');
  }

  /**
   * Send a message to the extension via WebSocket and wait for a
   * response with the matching id.
   *
   * @param msg      Message without id (id is auto-generated)
   * @param options  Optional timeout (ms) and progress callback
   * @returns        The payload from the extension response
   */
  async sendAndWait(
    msg: Omit<MCPMessage, 'id'>,
    options?: { timeout?: number; onProgress?: (p: MCPResponse) => void },
  ): Promise<Record<string, unknown>> {
    if (!this.connected || !this.client) {
      throw new Error(FSB_ERROR_MESSAGES['extension_not_connected']);
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

      this.client!.send(JSON.stringify(fullMsg));
    });
  }

  /** Whether a WebSocket client is connected and ready. */
  get isConnected(): boolean {
    return this.connected;
  }

  /** Generate a unique message ID. */
  generateId(): string {
    return `mcp_${++this.msgIdCounter}_${Date.now()}`;
  }
}
