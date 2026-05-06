import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { AgentScope } from '../agent-scope.js';
import { mapFSBError } from '../errors.js';

// Must exceed the extension-side 120_000ms payment confirmation gate.
const PAYMENT_CONFIRMATION_TIMEOUT_MS = 125_000;

/**
 * Register vault tools: list_credentials, fill_credential,
 * list_payment_methods, use_payment_method.
 *
 * SECURITY: These tools are registered directly (not via TOOL_REGISTRY)
 * to maintain an explicit security boundary. Raw secrets never traverse
 * the WebSocket bridge -- only opaque IDs and masked metadata.
 */
export function registerVaultTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
  agentScope: AgentScope,
): void {
  // Phase 238 D-06: scope discipline — vault is signature-parity only;
  // no agentScope.ensure() injection here per CONTEXT.md.
  void agentScope;
  // list_credentials -- returns domain + username pairs only (MCP-01)
  // Password field is NEVER present in the response.
  server.tool(
    'list_credentials',
    'List saved credentials. Returns domain and username pairs only -- passwords are never included in the response. Use fill_credential to autofill a login form.',
    {},
    async () => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      const result = await bridge.sendAndWait(
        { type: 'mcp:list-credentials', payload: {} },
        { timeout: 5_000 },
      );
      return mapFSBError(result);
    },
  );

  // fill_credential -- triggers autofill on the active tab (MCP-02)
  // Password travels background.js -> content script only, never over WebSocket.
  server.tool(
    'fill_credential',
    'Auto-fill login form on the active tab with a saved credential. The password is resolved inside the extension and injected directly into the page -- it never crosses the WebSocket bridge. The domain parameter is accepted for backward compatibility but the actual lookup domain is derived from the active tab URL for security. Requires the credential vault to be unlocked.',
    {
      domain: z.string().optional().describe('Hint for which credential to fill. Ignored for security -- the actual domain is derived from the active tab URL. Kept for backward compatibility.'),
    },
    async ({ domain }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('fill_credential', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:fill-credential', payload: { domain } },
          { timeout: 15_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  // list_payment_methods -- returns last 4 + brand only (MCP-03)
  // Full card data is NEVER present in the response.
  server.tool(
    'list_payment_methods',
    'List saved payment methods. Returns card brand, last 4 digits, and cardholder name only -- full card numbers and CVV are never included. Use use_payment_method to fill a checkout form.',
    {},
    async () => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      const result = await bridge.sendAndWait(
        { type: 'mcp:list-payments', payload: {} },
        { timeout: 5_000 },
      );
      return mapFSBError(result);
    },
  );

  // use_payment_method -- terminal confirmation before fill (MCP-04)
  // Fill domain is derived from chrome.tabs.get inside the extension,
  // NOT from this MCP request payload.
  server.tool(
    'use_payment_method',
    'Fill checkout form on the active tab with a saved payment method. Shows a confirmation prompt with card brand, last 4 digits, and merchant domain before any fill occurs. The fill domain is derived from the active tab URL inside the extension, not from this request. Requires both credential vault and payment access to be unlocked.',
    {
      payment_method_id: z.string().describe('ID of the payment method to use (from list_payment_methods)'),
    },
    async ({ payment_method_id }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('use_payment_method', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:use-payment-method', payload: { paymentMethodId: payment_method_id } },
          { timeout: PAYMENT_CONFIRMATION_TIMEOUT_MS },
        );
        return mapFSBError(result);
      });
    },
  );
}
