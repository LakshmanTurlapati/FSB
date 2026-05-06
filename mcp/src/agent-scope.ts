// Phase 238: per-process agent_id minted via lazy agent:register round-trip.
// See .planning/phases/238-agentscope-bridge-wiring/238-CONTEXT.md D-01..D-04, D-12.
//
// Decisions honored:
//   D-01 per-process singleton lifetime (one AgentScope per MCP server process)
//   D-03 cached-promise race control (concurrent first callers share ONE in-flight register)
//   D-04 throw-on-failure, NO caching (rejected register allows next ensure() to retry cleanly)
//   D-12 caller does not supply agentId; the extension registry mints fresh
//
// Logging convention: ASCII only, no emojis (CLAUDE.md). Prefix [FSB AgentScope] follows
// the FSB family ([FSB AGT], [FSB DLG], [FSB BG], ...).

import type { WebSocketBridge } from './bridge.js';

const SCOPE_LOG_PREFIX = '[FSB AgentScope]';

export class AgentScope {
  private agentId: string | null = null;
  private pending: Promise<string> | null = null;

  /**
   * Returns the per-process agent_id, lazy-minting on first call via the
   * agent:register bridge message. Concurrent first callers share one
   * in-flight register; subsequent callers reuse the cached id.
   *
   * Throws if agent:register fails. Failure is NOT cached -- the next
   * ensure() call retries cleanly (D-04).
   */
  async ensure(bridge: WebSocketBridge): Promise<string> {
    if (this.agentId) return this.agentId;
    if (this.pending) return this.pending;

    this.pending = (async () => {
      try {
        const result = await bridge.sendAndWait(
          { type: 'agent:register', payload: {} },
          { timeout: 10_000 },
        );
        if (!result || result.success !== true || typeof result.agentId !== 'string') {
          const reason = result && typeof result.error === 'string' ? result.error : 'unknown';
          throw new Error('agent:register failed: ' + reason);
        }
        const minted = result.agentId;
        const shortLabel =
          typeof result.agentIdShort === 'string' && result.agentIdShort.length > 0
            ? result.agentIdShort
            : minted.slice(0, 12);
        this.agentId = minted;
        console.error(SCOPE_LOG_PREFIX + ' minted ' + shortLabel);
        return minted;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(SCOPE_LOG_PREFIX + ' mint failed: ' + message);
        throw err;
      } finally {
        // Clear the in-flight slot regardless of outcome:
        //   - success path: this.agentId is set, so the fast path covers all subsequent calls
        //   - failure path: clearing pending allows the next caller to retry (D-04 no-poison)
        this.pending = null;
      }
    })();

    return this.pending;
  }

  /** Sync read for diagnostics; null if not yet minted. */
  current(): string | null {
    return this.agentId;
  }

  /**
   * Test-only escape hatch; do NOT call from production code.
   * Clears both the cached id and any in-flight pending mint so a fresh
   * ensure() will round-trip a new agent:register.
   */
  reset(): void {
    this.agentId = null;
    this.pending = null;
  }
}
