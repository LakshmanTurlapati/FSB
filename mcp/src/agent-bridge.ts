import type { WebSocketBridge } from './bridge.js';
import type { AgentScope } from './agent-scope.js';
import type { MCPMessageType, MCPResponse } from './types.js';

type AgentScopedSendOptions = {
  timeout?: number;
  onProgress?: (p: MCPResponse) => void;
  targetTabId?: number | null;
  includeOwnershipToken?: boolean;
  retryOnAgentNotRegistered?: boolean;
  onAgentId?: (agentId: string) => void;
};

function isAgentNotRegistered(result: Record<string, unknown> | null | undefined): boolean {
  return result?.code === 'AGENT_NOT_REGISTERED'
    || result?.errorCode === 'AGENT_NOT_REGISTERED';
}

export function targetTabIdFromParams(params: Record<string, unknown>): number | null {
  if (typeof params.tab_id === 'number' && Number.isFinite(params.tab_id)) return params.tab_id;
  if (typeof params.tabId === 'number' && Number.isFinite(params.tabId)) return params.tabId;
  return null;
}

function currentOwnershipToken(agentScope: AgentScope, targetTabId: number | null): string | null {
  const specific = (typeof agentScope.ownershipTokenFor === 'function')
    ? agentScope.ownershipTokenFor(targetTabId)
    : null;
  if (specific) return specific;
  return (typeof agentScope.currentOwnershipToken === 'function')
    ? agentScope.currentOwnershipToken()
    : null;
}

function currentConnectionId(agentScope: AgentScope): string | null {
  return (typeof agentScope.currentConnectionId === 'function')
    ? agentScope.currentConnectionId()
    : null;
}

function captureOwnershipToken(agentScope: AgentScope, result: Record<string, unknown> | null | undefined): void {
  if (!result || typeof result.ownershipToken !== 'string') return;
  if (typeof agentScope.captureOwnershipToken !== 'function') return;
  agentScope.captureOwnershipToken(
    typeof result.tabId === 'number' ? result.tabId : null,
    result.ownershipToken,
  );
}

async function buildAgentPayload(
  bridge: WebSocketBridge,
  agentScope: AgentScope,
  basePayload: Record<string, unknown>,
  options: AgentScopedSendOptions,
): Promise<Record<string, unknown>> {
  const agentId = await agentScope.ensure(bridge);
  options.onAgentId?.(agentId);

  const payload: Record<string, unknown> = { ...basePayload, agentId };
  if (options.includeOwnershipToken !== false) {
    const ownershipToken = currentOwnershipToken(agentScope, options.targetTabId ?? null);
    if (ownershipToken) payload.ownershipToken = ownershipToken;
  }

  const connectionId = currentConnectionId(agentScope);
  if (connectionId) payload.connectionId = connectionId;
  return payload;
}

export async function sendAgentScopedBridgeMessage(
  bridge: WebSocketBridge,
  agentScope: AgentScope,
  type: MCPMessageType,
  basePayload: Record<string, unknown>,
  options: AgentScopedSendOptions = {},
): Promise<Record<string, unknown>> {
  const sendOptions = {
    timeout: options.timeout,
    onProgress: options.onProgress,
  };

  let payload = await buildAgentPayload(bridge, agentScope, basePayload, options);
  let result = await bridge.sendAndWait({ type, payload }, sendOptions);

  if (options.retryOnAgentNotRegistered !== false && isAgentNotRegistered(result)) {
    agentScope.reset();
    payload = await buildAgentPayload(bridge, agentScope, basePayload, options);
    result = await bridge.sendAndWait({ type, payload }, sendOptions);
  }

  captureOwnershipToken(agentScope, result);
  return result;
}
