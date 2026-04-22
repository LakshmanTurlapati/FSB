import type { WebSocketBridge } from './bridge.js';
import { WebSocketBridge as Bridge } from './bridge.js';
import type { BridgeTopologyState } from './types.js';
import {
  DEFAULT_HTTP_HOST,
  DEFAULT_HTTP_PORT,
  FSB_EXTENSION_BRIDGE_URL,
} from './version.js';

export type BridgeDiagnostics = {
  checkedAt: string;
  bridgeUrl: string;
  bridgeMode: 'hub' | 'relay' | 'disconnected';
  extensionConnected: boolean;
  bridgeTopology: BridgeTopologyState;
  hubConnected: boolean;
  relayCount: number;
  activeHubInstanceId: string | null;
  lastExtensionHeartbeatAt: number | null;
  lastDisconnectReason: string | null;
  extensionConfig?: Record<string, unknown> | null;
  tabsSummary?: { totalTabs: number; activeTabId: number | null };
  error?: string;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForExtensionConnection(
  bridge: WebSocketBridge,
  timeoutMs: number,
  pollMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (bridge.isConnected) return true;
    await sleep(pollMs);
  }
  return bridge.isConnected;
}

export async function collectBridgeDiagnostics(options: {
  waitForExtensionMs?: number;
  includeConfig?: boolean;
  includeTabs?: boolean;
} = {}): Promise<BridgeDiagnostics> {
  const bridge = new Bridge();
  const waitForExtensionMs = options.waitForExtensionMs ?? 1500;

  try {
    await bridge.connect();
    if (!bridge.isConnected && waitForExtensionMs > 0) {
      await waitForExtensionConnection(bridge, waitForExtensionMs);
    }

    const topology = bridge.topology;
    const diagnostics: BridgeDiagnostics = {
      checkedAt: new Date().toISOString(),
      bridgeUrl: FSB_EXTENSION_BRIDGE_URL,
      bridgeMode: topology.mode,
      extensionConnected: topology.extensionConnected,
      bridgeTopology: topology,
      hubConnected: topology.hubConnected,
      relayCount: topology.relayCount,
      activeHubInstanceId: topology.activeHubInstanceId,
      lastExtensionHeartbeatAt: topology.lastExtensionHeartbeatAt,
      lastDisconnectReason: topology.lastDisconnectReason,
    };

    if (bridge.isConnected && options.includeConfig) {
      try {
        const config = await bridge.sendAndWait(
          { type: 'mcp:get-config', payload: {} },
          { timeout: 5_000 },
        );
        diagnostics.extensionConfig = (config.config as Record<string, unknown>) ?? config;
      } catch (err) {
        diagnostics.error = `Connected to extension, but config probe failed: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }
    }

    if (bridge.isConnected && options.includeTabs) {
      try {
        const tabs = await bridge.sendAndWait(
          { type: 'mcp:get-tabs', payload: {} },
          { timeout: 5_000 },
        );
        const tabList = Array.isArray(tabs.tabs) ? tabs.tabs as Array<Record<string, unknown>> : [];
        const active = tabList.find((tab) => tab.active === true);
        diagnostics.tabsSummary = {
          totalTabs: tabList.length,
          activeTabId: typeof active?.id === 'number' ? active.id : null,
        };
      } catch (err) {
        diagnostics.error = `Connected to extension, but tab probe failed: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }
    }

    return diagnostics;
  } catch (err) {
    const topology = bridge.topology;
    return {
      checkedAt: new Date().toISOString(),
      bridgeUrl: FSB_EXTENSION_BRIDGE_URL,
      bridgeMode: topology.mode,
      extensionConnected: topology.extensionConnected,
      bridgeTopology: topology,
      hubConnected: topology.hubConnected,
      relayCount: topology.relayCount,
      activeHubInstanceId: topology.activeHubInstanceId,
      lastExtensionHeartbeatAt: topology.lastExtensionHeartbeatAt,
      lastDisconnectReason: topology.lastDisconnectReason,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    bridge.disconnect();
  }
}

export function getLocalHttpEndpoint(host = DEFAULT_HTTP_HOST, port = DEFAULT_HTTP_PORT): string {
  return `http://${host}:${port}/mcp`;
}
