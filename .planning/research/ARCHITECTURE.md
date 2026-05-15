# Architecture Research: v0.9.69 Anonymous Telemetry Pipeline + Dashboard Streaming Fix

**Milestone:** v0.9.69 (subsequent milestone; existing FSB architecture preserved)
**Researched:** 2026-05-14
**Branch:** `Refinements`
**Confidence:** HIGH (codebase walked end-to-end for every integration point)

---

## 0. Scope

This document is exclusively about the NEW v0.9.69 features layered onto the existing FSB stack. The Chrome MV3 extension structure, Express + SQLite showcase server, Angular 20 standalone components, `ws` library at `/ws`, `LZString` envelope contract, and `chrome.storage.local` analytics store are **assumed**, not re-researched.

What we add:

1. **MCP request logger** in the extension (single source of truth for "an MCP tool was just dispatched").
2. **API pricing module** mapping `(MCP client label, tool, model) -> USD cost`.
3. **Anonymous telemetry collector** that batches events and POSTs them to the showcase server.
4. **Server ingest** at `/api/telemetry/*` with daily-salt IP hashing, raw event table, daily rollups, public aggregates.
5. **Public `/api/public-stats/*` endpoint** consumed by the existing `/stats` Easter-egg page via a new `FSBTelemetryService` paralleling `GitHubStatsService`.
6. **DOM-streaming-fix diagnosis** (last phase) of the `dash:dom-stream-*` pipeline.

---

## 1. Extension-side Data Flow for MCP Logging

### 1.1 The hook point: ONE chokepoint, both dispatchers

There are two dispatch entry points for an MCP request, and we must hook **both** (or hook a common upstream point that both call):

| Entry point | File / line | Used by |
|-------------|-------------|---------|
| `dispatchMcpToolRoute({ tool, params, client, tab, payload })` | `extension/ws/mcp-tool-dispatcher.js:285-301` | Tool-name routes (`navigate`, `open_tab`, `execute_js`, `run_task`, `read_page`, `get_dom_snapshot`, etc.) -- 28 entries in `MCP_PHASE199_TOOL_ROUTES` |
| `dispatchMcpMessageRoute({ type, payload, client, mcpMsgId })` | `extension/ws/mcp-tool-dispatcher.js:303-331` | Raw `mcp:` message types from `MCPBridgeClient._routeMessage` -- agent lifecycle, get-tabs, get-diagnostics, get-status, list-sessions, etc. |

Both are called from `MCPBridgeClient._routeMessage` in `extension/ws/mcp-bridge-client.js:373-485` -- some cases call `dispatchMcpMessageRoute` directly (lines 381, 384, 387, 390, 393), others call helper methods that ultimately call `dispatchMcpToolRoute` (line 851 inside `_handleExecuteBackground`, line 523 inside `_handleGetTabs`).

**Recommended hook point: `dispatchMcpToolRoute` and `dispatchMcpMessageRoute` themselves**, with a thin `MCPMetricsRecorder.recordDispatch({ surface, tool|type, params, payload, startedAt, result, durationMs })` invoked AFTER the route handler resolves but BEFORE returning to the caller.

Specifically:

```javascript
// extension/ws/mcp-tool-dispatcher.js:285
async function dispatchMcpToolRoute({ tool, params, client, tab, payload }) {
  // ... existing route lookup + ownership gate ...
  const startedAt = Date.now();
  let result, error;
  try {
    result = await route.handler({ tool, params: params || {}, client, tab, payload, route });
    return result;
  } catch (e) {
    error = e;
    throw e;
  } finally {
    // NEW (Phase v0.9.69):
    try {
      if (typeof globalThis.MCPMetricsRecorder !== 'undefined') {
        globalThis.MCPMetricsRecorder.recordDispatch({
          surface: 'tool',
          tool,
          params,
          payload,
          client,
          startedAt,
          durationMs: Date.now() - startedAt,
          result,
          error,
          routeFamily: route.routeFamily
        });
      }
    } catch (_e) { /* never let metrics break dispatch */ }
  }
}
```

The same `try/finally` pattern fires in `dispatchMcpMessageRoute` (line 303) with `surface: 'message'`.

**Why this is the right hook point** (not `MCPBridgeClient._handleMessage` and not the per-route handlers):

- **One chokepoint, both inbound flows.** Phase 199's existing architecture (D-06: "single dispatch chokepoint") already guarantees these two functions are the only ways an MCP call can reach a route handler. Anything that bypasses them is a contract violation that fails loud elsewhere.
- **Post-resolve, pre-return = success/failure both captured.** The `finally` block runs whether the route handler resolved successfully, returned an `{ success: false }` envelope, or threw. Token cost can only be estimated from the result envelope (see `change_report` / `result.tokensUsed` shapes that already exist on `run_task` outputs).
- **No double-counting risk.** A single MCP tool call enters the extension via the WebSocket, is parsed once in `_handleMessage`, routed once to either `dispatchMcpToolRoute` or `dispatchMcpMessageRoute` (never both -- they're mutually exclusive by `type` vs `tool` discriminator), and the result envelope is returned to `_handleMessage` exactly once for `mcp:result` / `mcp:error` emit. One dispatch -> one metrics record.
- **AI-side cost-tracker (`extension/ai/cost-tracker.js`) is orthogonal.** That tracker hooks `agent-loop.js` API calls. MCP-side metrics hook MCP dispatch. They cover disjoint surfaces (AI provider API call vs MCP tool dispatch). No overlap.

### 1.2 The new module: `MCPMetricsRecorder`

**Location:** `extension/utils/mcp-metrics-recorder.js`
**Registered:** Imported via `importScripts('utils/mcp-metrics-recorder.js')` in `background.js`, ordered AFTER `analytics.js` (`background.js:31`) and BEFORE `ws/mcp-bridge-client.js` (`background.js:40`).

**Shape (mirroring `CostTracker` in `extension/ai/cost-tracker.js:111` -- function/prototype pattern, NOT ES class, for `importScripts` compatibility):**

```javascript
// extension/utils/mcp-metrics-recorder.js
function MCPMetricsRecorder() {
  this._loaded = false;
  this._init();
}
MCPMetricsRecorder.prototype._init = async function() { /* hydrate from chrome.storage.local.fsbMcpUsageData */ };
MCPMetricsRecorder.prototype.recordDispatch = async function({ surface, tool, type, params, payload, client, startedAt, durationMs, result, error, routeFamily }) {
  // 1. Resolve client label from MCPBridgeClient.getConnectionId() + payload metadata
  //    (See Section 2.2 -- the bridge-side client label allowlist already exists at
  //    extension/utils/mcp-visual-session.js MCPVisualSessionUtils.normalizeMcpVisualClientLabel)
  // 2. Resolve cost via globalThis.MCP_PRICING.estimate({ client, tool, tokensIn, tokensOut })
  //    -- tokens harvested from result.tokensUsed for run_task; for non-run_task tools tokens=0,
  //    cost=0 (only the call count and tool name matter).
  // 3. Append to chrome.storage.local.fsbMcpUsageData (mirrors FSBAnalytics.usageData in utils/analytics.js:108)
  // 4. Broadcast { type: 'MCP_METRICS_UPDATE' } via chrome.runtime.sendMessage (mirrors
  //    broadcastAnalyticsUpdate at background.js:11440)
  // 5. Enqueue an anonymous summary into TelemetryCollector.enqueue(...) -- see Section 3.
};
MCPMetricsRecorder.prototype.getRecentCalls = function(limit) { /* read-back for control-panel UI */ };
MCPMetricsRecorder.prototype.getAggregates = function(timeRange) { /* totals for the hero */ };

// Expose on globalThis like FSBAnalytics does
globalThis.MCPMetricsRecorder = new MCPMetricsRecorder();
```

### 1.3 Write into the existing analytics store -- data flow

The existing AI analytics store is `chrome.storage.local.fsbUsageData` (`extension/utils/analytics.js:148`). It contains entries shaped `{ timestamp, model, provider, inputTokens, outputTokens, success, source, cost }`.

**DO NOT mix MCP entries into `fsbUsageData`.** Two different surfaces, two different schemas. Instead:

- New key: `chrome.storage.local.fsbMcpUsageData` (parallel to `fsbUsageData`).
- Entry shape: `{ timestamp, mcpClient, tool, routeFamily, surface, durationMs, success, errorCode, estimatedCost, estimatedTokensIn, estimatedTokensOut, modelAssumed }`.
- Read-back: control-panel UI reads BOTH `fsbUsageData` (AI calls) AND `fsbMcpUsageData` (MCP calls) and renders separately.

**Control-panel rendering flow** (mirrors existing `FSBAnalytics.updateDashboard` at `extension/utils/analytics.js:657-676`):

1. `chrome.runtime.onMessage` listener on `MCP_METRICS_UPDATE` (new, paralleling existing `ANALYTICS_UPDATE` listener) -- listener lives in `extension/ui/control_panel.html`'s page script.
2. On receipt, fetches `chrome.storage.local.fsbMcpUsageData`, computes aggregates, updates new hero tiles "MCP Calls", "MCP Cost", "Active MCP Clients" alongside the existing four (lines `extension/ui/control_panel.html:106-122`).
3. New section below the four hero tiles: "Per-MCP-Client Log" table -- timestamp, client badge, tool name, duration, cost. Mirrors the existing per-call table pattern that lives in the analytics section below the chart canvas (`#usageChart`, line 149).

### 1.4 Avoiding double-counting -- single source of truth

This is THE critical quality-gate constraint. The architecture:

```
                                  +------------------------------+
                                  |   MCPMetricsRecorder         |
                                  |   .recordDispatch(...)       |
                                  |  [extension/utils/mcp-       |
                                  |   metrics-recorder.js]       |
                                  +-------------+----------------+
                                                |
                       +------------------------+--------------------------+
                       |                        |                          |
                       v                        v                          v
        chrome.storage.local.        chrome.runtime.sendMessage   TelemetryCollector
        fsbMcpUsageData              ({type:'MCP_METRICS_UPDATE'})  .enqueue(summary)
        (local persistence;          (broadcast to control-panel)   (outbound batch)
         drives control-panel hero)
```

Both "control panel local analytics" AND "outbound telemetry beat" derive from the same `recordDispatch` call. The collector receives an in-memory summary directly from `recordDispatch` (NOT by re-reading storage; storage is a side effect, not a source). Single fact -> two consumers. No double-count possible because there's only one fact-generation site: the `finally` block of `dispatchMcpToolRoute` / `dispatchMcpMessageRoute`.

---

## 2. Anonymous Identity Bootstrap

### 2.1 Where the UUID lives

**File:** `extension/utils/install-identity.js` (new, registered via `importScripts` in `background.js` at the TOP of the dependency chain, BEFORE `analytics.js`, `mcp-bridge-client.js`, `ws-client.js`, and the new `mcp-metrics-recorder.js`).

**Init pattern** (mirrors the existing `FSBAnalytics.initialize` lazy-init at `extension/utils/analytics.js:121`):

```javascript
// extension/utils/install-identity.js
const FSB_INSTALL_UUID_KEY = 'fsb_install_uuid';
const FSB_TELEMETRY_OPT_OUT_KEY = 'fsb_telemetry_opt_out';

async function getOrCreateInstallUuid() {
  try {
    const data = await chrome.storage.local.get([FSB_INSTALL_UUID_KEY]);
    if (data && typeof data[FSB_INSTALL_UUID_KEY] === 'string' && data[FSB_INSTALL_UUID_KEY].length === 36) {
      return data[FSB_INSTALL_UUID_KEY];
    }
    const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : _fallbackUuid(); // hex(now) + hex(Math.random) -- never trigger in practice; mirrors mcp-bridge-client.js:124-126
    await chrome.storage.local.set({ [FSB_INSTALL_UUID_KEY]: uuid });
    return uuid;
  } catch (_e) {
    return null; // chrome.storage.local unavailable -- see 2.3
  }
}

async function isTelemetryOptedOut() {
  const data = await chrome.storage.local.get([FSB_TELEMETRY_OPT_OUT_KEY]);
  return data && data[FSB_TELEMETRY_OPT_OUT_KEY] === true;
}

globalThis.FSBInstallIdentity = { getOrCreateInstallUuid, isTelemetryOptedOut, FSB_INSTALL_UUID_KEY, FSB_TELEMETRY_OPT_OUT_KEY };
```

**Bootstrap call site:** `chrome.runtime.onInstalled` listener in `background.js:13015-13048`. Add `await FSBInstallIdentity.getOrCreateInstallUuid()` between `initializeAnalytics()` (line 13019) and `loadDebugMode()` (line 13022). Also fire in `chrome.runtime.onStartup` listener at line 13051 (idempotent -- the get-or-create is a no-op when the UUID already exists).

### 2.2 Sharing the UUID across surfaces

**Pattern: single getter on `globalThis`, never duplicated.** All three downstream consumers (`MCPMetricsRecorder`, `TelemetryCollector`, control-panel privacy UI) call `globalThis.FSBInstallIdentity.getOrCreateInstallUuid()` lazily on first use AND cache the value in-module for the lifetime of the service-worker incarnation.

Why one getter, not one cached top-level constant: the service worker can be evicted at any moment in MV3. A constant initialized at top-of-file would lose its value across eviction-revival. The getter pattern means each module fetches once-per-incarnation (cheap) without depending on module load order.

**Control panel UI** (`extension/ui/control_panel.html`) is a separate document context, NOT a service-worker context, so it must read the UUID directly via `chrome.storage.local.get('fsb_install_uuid')`. Mirrors the same direct-storage-read pattern that the existing analytics dashboard uses (`extension/utils/analytics.js:148` runs in document context when the page-side script loads).

### 2.3 Fallback when `chrome.storage.local` is unavailable

This is rare but real -- corrupted profiles, certain enterprise policy configurations. **Recommendation:**

| Scenario | Behaviour |
|----------|-----------|
| `chrome.storage.local` throws / returns undefined | `getOrCreateInstallUuid()` returns `null`; `TelemetryCollector.enqueue()` becomes a no-op when UUID is null; MCP local analytics still work (in-memory only, won't survive SW eviction but that's an existing limitation across all FSB storage paths). |
| User in incognito | The extension is not configured for `incognito: 'split'`, so service worker is not spawned for incognito windows -- moot. |
| `fsb_telemetry_opt_out === true` | UUID is still minted (needed for control-panel display "Your install ID: ..." so user can verify what's NOT being sent); `TelemetryCollector` checks `isTelemetryOptedOut()` at every enqueue and short-circuits. |

**Don't do "session-only UUID" -- it has no purpose.** A session UUID can't be correlated across beats so it offers no aggregation value, and re-minting per session pollutes the global "active installs" count. Either we have a stable UUID or we send nothing.

---

## 3. Telemetry Beat Schedule

### 3.1 Queue architecture

**Module:** `extension/utils/telemetry-collector.js` (new, `importScripts`'d after `install-identity.js` and `mcp-metrics-recorder.js`).

**Queue storage:** `chrome.storage.local.fsbTelemetryQueue` -- array of events, capped at 200 entries (~20 KB at typical event sizes). New events shift oldest if cap hit. Mirrors the `usageData` cleanup pattern at `extension/utils/analytics.js:189-192` (30-day rolling window there; here a 200-event hard cap).

**Why `chrome.storage.local` not in-memory:** MV3 service workers evict after 30s of idle. An in-memory queue would lose events on every eviction. `chrome.storage.local` persists across SW lifecycle and (separately from telemetry) is `unlimitedStorage`-permission-backed already (`extension/manifest.json:10`).

### 3.2 Beat trigger

**Recommended schedule: "every N events OR every M minutes, whichever fires first" with the following values:**

| Trigger | Value | Rationale |
|---------|-------|-----------|
| Event-count threshold | 20 events queued | Keeps payload size small enough to fit in a single 1MB Express body (`server.js:85`) with massive room to spare. |
| Time-based interval | Every 15 minutes | Long enough that idle installs barely contact the server (privacy + cost), short enough that "active users right now" aggregate (5-min window on server) catches active installs reliably. |
| Cold-start trigger | On `chrome.runtime.onStartup`, flush any queue from prior SW life | Recovers the "user uninstalled mid-beat" edge where the prior service worker queued events but never sent them. |
| Pre-eviction trigger | NO explicit pre-eviction flush | MV3 doesn't expose a pre-eviction hook; `chrome.alarms` is the only reliable scheduler -- see 3.3. |

### 3.3 Surviving MV3 service-worker eviction

Critical pitfall. The existing `MCPBridgeClient` already solves this via `chrome.alarms` (see `mcp-bridge-client.js:14` `MCP_RECONNECT_ALARM` + `_scheduleReconnectAlarm` at line 291-303). Mirror that pattern.

**Recommendation:**

```javascript
// extension/utils/telemetry-collector.js
const TELEMETRY_BEAT_ALARM = 'fsb-telemetry-beat';
chrome.alarms.create(TELEMETRY_BEAT_ALARM, { periodInMinutes: 15 });

// In background.js, add to chrome.alarms.onAlarm listener (chrome.alarms minimum is 30s
// but periodInMinutes:15 is well above that floor):
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TELEMETRY_BEAT_ALARM) {
    globalThis.TelemetryCollector?.flushBeat({ trigger: 'alarm' });
  }
});
```

The alarm fires whether the service worker is awake or not -- Chrome wakes the SW to deliver the alarm, the SW imports scripts, `TelemetryCollector` re-hydrates queue from storage, sends, marks sent, sleeps. This is the same lifecycle pattern that MCP bridge reconnect uses; it's proven.

### 3.4 Offline retry without leaking timing data

**Privacy concern:** if the server is unreachable and the queue grows, an attacker who later compromises the server could correlate "first received event at time T" with "queue contained events from time T-Xh" and infer when the user was offline.

**Mitigation:**

- On send-failure: leave the queue intact, retry on next 15-min alarm tick. Exponential backoff is NOT needed -- 15 min is already coarse.
- On send-success: clear ONLY the events that were successfully POSTed (server returns event IDs it accepted).
- **Per-event timestamps are batched at WHOLE-MINUTE resolution server-side** (see Section 4 schema). The event itself carries `tsMinute = Math.floor(Date.now() / 60000) * 60000` not `Date.now()`. A 60-second resolution is sufficient for "active users in last 5 min" and removes sub-minute fingerprinting.
- Hard upper bound: events older than 24 hours are dropped client-side at queue-load time (not sent), preventing infinite backlog from a long-offline install masquerading as a recent active user.

---

## 4. Server-side Ingestion Architecture

### 4.1 SQLite schema (new tables, added to `showcase/server/src/db/schema.js`)

The existing `initializeDatabase` function (`schema.js:5-87`) already follows an "additive only" migration pattern (lines 76-84 do `ALTER TABLE ADD COLUMN` inside `try/catch`). Add the new telemetry tables to the same function:

```sql
-- Raw events table: append-only, kept for 7 days, then deleted by daily housekeeper.
CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  install_uuid TEXT NOT NULL,           -- UUID v4 from extension; NEVER joined with hash_keys
  event_type TEXT NOT NULL,             -- 'mcp_call' | 'session_summary' | 'install_announce'
  ts_minute INTEGER NOT NULL,           -- floor(Date.now() / 60000) * 60000 -- minute-precision
  ip_hash TEXT NOT NULL,                -- SHA256(IP + daily_salt), 64 hex chars
  daily_salt_version INTEGER NOT NULL,  -- rotation counter so we can detect cross-day hashes
  payload TEXT NOT NULL,                -- JSON: tokens_in, tokens_out, mcp_client, model, tool, etc.
  received_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_ts_minute ON telemetry_events(ts_minute);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_install_uuid ON telemetry_events(install_uuid);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_ip_hash ON telemetry_events(ip_hash);

-- Per-UUID per-day rollups: populated by an hourly cron-like timer that reads from
-- telemetry_events and aggregates. Used to compute "most-popular agent / MCP client"
-- without scanning raw events.
CREATE TABLE IF NOT EXISTS telemetry_rollups_daily (
  install_uuid TEXT NOT NULL,
  day TEXT NOT NULL,                    -- 'YYYY-MM-DD' UTC
  mcp_client TEXT NOT NULL,             -- 'claude-code' | 'codex' | 'openclaw' | 'cursor' | 'unknown'
  model TEXT NOT NULL,                  -- 'claude-sonnet-4-5-20250929' etc.
  total_tokens_in INTEGER NOT NULL DEFAULT 0,
  total_tokens_out INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  total_calls INTEGER NOT NULL DEFAULT 0,
  active_agents_peak INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (install_uuid, day, mcp_client, model)
);

-- Global daily aggregates: the public stats page reads from here.
-- Recomputed by the same hourly timer.
CREATE TABLE IF NOT EXISTS telemetry_global_aggregates (
  day TEXT PRIMARY KEY,                 -- 'YYYY-MM-DD' UTC
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,        -- distinct install_uuid in this day
  total_users_lifetime INTEGER NOT NULL DEFAULT 0,
  active_agents_now INTEGER NOT NULL DEFAULT 0,   -- snapshot at recompute time
  total_agents_lifetime INTEGER NOT NULL DEFAULT 0,
  most_popular_mcp_client TEXT,
  most_popular_agent_label TEXT,
  avg_agents_per_user REAL NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL
);

-- Live in-flight cache (in-memory only, not persisted): seen_in_last_5_min for
-- "active users right now" aggregate. Implemented as a Map<install_uuid, last_seen_ts>
-- in showcase/server/src/telemetry/active-users.js. NOT SQLite -- it churns too fast.
```

**Why a separate rollup table** (and not just SQL aggregation queries against raw events on every read): the public `/stats` page is polled at 5-minute cadence by potentially many concurrent visitors. Each query scanning a multi-day raw events table is expensive. Pre-aggregating into `telemetry_rollups_daily` keeps the public read path on a tiny table (< 10K rows even at significant adoption).

**Why keep raw events for 7 days, not forever:** the rollups capture everything the public page needs. Raw events are kept short-term only for re-aggregation (if we discover a bucketing bug) and for the ip_hash rate-limit check. After 7 days, the rollups are authoritative; raw events are dropped by the daily housekeeper.

### 4.2 Daily salt rotation

**Location:** `showcase/server/data/salt.json` (gitignored; created with 0600 perms on first start by `showcase/server/src/telemetry/salt-rotator.js`).

```javascript
// showcase/server/src/telemetry/salt-rotator.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SALT_PATH = path.join(__dirname, '..', '..', 'data', 'salt.json');

function _readOrCreate() {
  try {
    const raw = fs.readFileSync(SALT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    // Rotate if last_rotated_at is older than 24 hours
    const ageMs = Date.now() - (parsed.last_rotated_at || 0);
    if (ageMs > 24 * 60 * 60 * 1000) {
      return _rotate(parsed.version || 1);
    }
    return parsed;
  } catch {
    return _rotate(0);
  }
}

function _rotate(prevVersion) {
  const next = {
    salt: crypto.randomBytes(32).toString('hex'),
    version: prevVersion + 1,
    last_rotated_at: Date.now()
  };
  fs.mkdirSync(path.dirname(SALT_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(SALT_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

function hashIp(ip) {
  const s = _readOrCreate();
  const h = crypto.createHash('sha256').update(ip + s.salt).digest('hex');
  return { hash: h, version: s.version };
}

module.exports = { hashIp };
```

**Why file (not env var):** the salt has to persist across restarts (otherwise yesterday's hashes are unverifiable), but must NOT be committed (otherwise the hash is reversible). A gitignored file with 0600 perms beside the SQLite DB is the cleanest fit; the same `data/` directory pattern is used for `DB_PATH` in `server.js:24`. An env var works but requires a separate persistence layer the user has to wire (env file -> deployment config) and doesn't auto-rotate.

**Don't rotate more often than daily.** The whole point of the daily salt is that hashes from the same IP yesterday and today look different to a database snooper. Sub-daily rotation buys no extra privacy and complicates the cron / "have we already rotated today" check.

### 4.3 Rate limiting

**Per `ip_hash` + per `install_uuid` -- belt-and-suspenders:**

- Max events per `install_uuid` per minute: 100 (one event per ~600ms, generous for a fast-running test session).
- Max events per `ip_hash` per minute: 500 (allows multiple installs behind the same NAT, e.g. a household).
- Implemented as a sliding-window counter in `showcase/server/src/telemetry/rate-limiter.js` (in-memory `Map<key, [ts1, ts2, ...]>`, sweep older-than-60s entries on each insert). For larger scale we'd swap to Redis, but for the current showcase server scale this is right-sized.
- On rate-limit hit: respond `429 Too Many Requests`. Client backs off via the 15-minute alarm cadence (it would normally retry the queue contents on next alarm -- no special-case code needed).
- Replay protection: events with `received_at - ts_minute > 24h` are rejected at ingest. The 24h client-side drop in 3.4 means honest clients never hit this; it bounds replay-attack value to 24 hours.

### 4.4 Retention

| Table | Retention | Reason |
|-------|-----------|--------|
| `telemetry_events` | 7 days | Re-aggregation buffer + ip_hash rate-limit; longer is creep |
| `telemetry_rollups_daily` | 365 days | Year-over-year comparisons on `/stats` |
| `telemetry_global_aggregates` | Forever (one row per day, ~365 rows/year, trivial) | Historical chart |
| `active_users` (in-memory) | 5 min sliding window | "Active right now" semantic |

Housekeeper: a single `setInterval` in `showcase/server/src/telemetry/housekeeper.js`, runs hourly, executes:

1. `DELETE FROM telemetry_events WHERE received_at < (now - 7d)`.
2. Re-aggregate `telemetry_rollups_daily` for today and yesterday (idempotent upsert).
3. Recompute `telemetry_global_aggregates` for today.
4. (Daily, separately) `SaltRotator.checkAndRotate()`.

---

## 5. Public `/stats` Aggregates Endpoint

### 5.1 Route choice

**NEW public path: `/api/public-stats/global` (no auth).** Do NOT extend the existing `/api/stats` (`server.js:106-113`) -- that path is gated by `authMiddleware` and ties to a hash key. The new endpoint serves global aggregates that have no per-user identity, so it must NOT carry the auth middleware.

```javascript
// showcase/server/src/routes/public-stats.js (new)
const express = require('express');

function createPublicStatsRouter(queries) {
  const router = express.Router();

  router.get('/global', (req, res) => {
    // queries.getGlobalTelemetryAggregates() reads from telemetry_global_aggregates +
    // active_users in-memory map (Section 4.1)
    const aggregates = queries.getGlobalTelemetryAggregates();
    res.set('Cache-Control', 'public, max-age=60');  // 60-second edge cache
    res.json(aggregates);
  });

  router.get('/global/series', (req, res) => {
    // Last 30 days of telemetry_global_aggregates rows for line charts
    const series = queries.getGlobalTelemetrySeries({ days: 30 });
    res.set('Cache-Control', 'public, max-age=300'); // 5-min edge cache; data is daily-stable
    res.json(series);
  });

  return router;
}
module.exports = createPublicStatsRouter;
```

Mount in `server.js` AFTER the auth-protected routes (so an accidental future change can't shadow public-stats with an auth wrapper):

```javascript
// server.js, after line 113:
app.use('/api/public-stats', createPublicStatsRouter(queries));
```

### 5.2 Caching strategy

| Layer | TTL | Reason |
|-------|-----|--------|
| HTTP `Cache-Control` header | 60s on `/global`, 5min on `/global/series` | Browser + any CDN respect the freshness. The 60s cadence matches the "active users in last 5 min" granularity perfectly -- a 60s-stale snapshot can't say someone is active who left 6 minutes ago. |
| In-process: SQLite query memo | 30s `Map<routeName, {data, expiresAt}>` in `routes/public-stats.js` | Burst-protection for many concurrent visitors hitting `/stats` -- one SQLite query per 30s window regardless of visitor count. |
| Server-side recompute | Hourly housekeeper (Section 4.4) | The underlying rollup tables are recomputed hourly anyway; in-process memo just avoids re-running aggregation reads. |

**No materialized views needed.** SQLite doesn't natively support them; the housekeeper-maintained `telemetry_global_aggregates` IS our materialized view, just via explicit row writes.

### 5.3 CORS stance

Existing CORS config at `server.js:80-84` is `cors({ origin: true, credentials: true })`. This reflects whatever Origin sends -- effectively any-origin with credentials.

**Recommendation for `/api/public-stats/*`: do not change anything.** The data is already public-by-design; allowing any origin to fetch is correct. If the `/stats` page is later embedded on a third-party blog as a widget, it'll just work.

**Privacy callout:** because `credentials: true` is on globally, the public-stats endpoint will reflect cookies that don't exist on a public visit anyway. Worth a one-line code comment in `public-stats.js` documenting that this endpoint does not use cookies (route is auth-free) and doesn't change behaviour based on session.

### 5.4 Angular consumer: `FSBTelemetryService`

**Location:** `showcase/angular/src/app/core/stats/fsb-telemetry.service.ts` (new, mirrors `github-stats.service.ts` exactly).

Copy the GitHubStatsService skeleton:

- `@Injectable({ providedIn: 'root' })`
- `PLATFORM_ID` injection + `isPlatformBrowser` SSR gate (mirror lines 74, 105 of github-stats.service.ts)
- `BehaviorSubject<DatasetState<...>>` per dataset -- four subjects: `globalAggregates$`, `globalSeries$`, `mostPopular$`, `activeNow$`
- `POLL_INTERVAL_MS = 5 * 60 * 1000` matching GitHub's 5-minute cadence
- Visibility-aware polling (mirror lines 116-138)
- `start()` / `stop()` lifecycle
- Endpoints: `${API_BASE}/api/public-stats/global` and `${API_BASE}/api/public-stats/global/series`
- ETag caching follows the existing pattern at lines 295-332 -- the new public-stats Express route should add ETag headers via Express's built-in support (`server.js:160` already has `etag: true` for static).

The stats page (`showcase/angular/src/app/pages/stats/stats-page.component.ts`) gains a toggle group "FSB Telemetry" -- subscribe to the same four BehaviorSubjects and render in chart/table widgets. No new chart libraries needed; reuse Chart.js the page already lazy-loads.

---

## 6. DOM-Streaming Fix -- Diagnostic Architecture

**Constraint:** the user wants this phase **last**. We do not fix in research -- we map the surface, identify suspected break points, and recommend an inspection order.

### 6.1 The actual message flow (extension -> server -> dashboard)

```
                                    EXTENSION SIDE
+--------------------------------------------------------------------------+
| extension/ws/ws-client.js                                                |
|                                                                          |
|   Outbound: ext:dom-snapshot / ext:dom-mutations / ext:dom-scroll /      |
|             ext:dom-overlay / ext:dom-dialog / ext:stream-state /        |
|             ext:page-ready                                               |
|   Inbound:  dash:dom-stream-start (line 1081) ->                         |
|             _handleDashboardStreamStart (line 1029) ->                   |
|             _forwardToContentScript('domStreamStart') (line 1054) ->     |
|             chrome.tabs.sendMessage(tabId, {action:'domStreamStart'})    |
|                                       |                                   |
|                                       v                                   |
|   extension/content/dom-stream.js (content-script side, mutation tap)    |
+--------------------------------------------------------------------------+
                                       |
                                       | WebSocket frames (LZ-compressed)
                                       v
+--------------------------------------------------------------------------+
|                          SHOWCASE SERVER                                  |
| showcase/server/src/ws/handler.js                                        |
|                                                                          |
|  rooms: Map<hashKey, {extensions: Set, dashboards: Set}>                 |
|  relayToRoom(hashKey, senderWs, rawMessage, messageType) line 251-259    |
|    - senderWs._fsbRole === 'extension' -> targets = room.dashboards      |
|    - senderWs._fsbRole === 'dashboard' -> targets = room.extensions      |
|  sendToClients(...) line 66-111: iterates ws.send() on each target       |
|                                                                          |
|  ! DEBUG log at line 202 already prints every relay's deliveredCount     |
|  ! and droppedCount per type -- this is the diagnostic surface to read   |
|    when reproducing the bug. Note: it's marked `TEMP DEBUG (Phase 212    |
|    diagnosis)` in a comment -- it's been there since the prior streaming |
|    work.                                                                  |
+--------------------------------------------------------------------------+
                                       |
                                       v
                                  DASHBOARD SIDE
+--------------------------------------------------------------------------+
| showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts     |
|                                                                          |
|  ws.onmessage (line 3315-3334) ->                                        |
|    LZ envelope decompression (line 3319-3325) ->                         |
|    handleWSMessage (line 3393) ->                                        |
|      ext:dom-snapshot -> handleDOMSnapshot (line 2802, srcdoc iframe)    |
|      ext:dom-mutations -> handleDOMMutations (line 3129, patch iframe)   |
|      ext:dom-scroll   -> handleDOMScroll (line 3193)                     |
|      ext:dom-overlay  -> handleDOMOverlay (line 3201)                    |
|      ext:dom-dialog   -> handleDOMDialog (line 3252)                     |
|      ext:stream-state -> handleRecoveredStreamState (line 2691)          |
|      ext:page-ready   -> auto-fires dash:dom-stream-start (line 3517)    |
+--------------------------------------------------------------------------+
```

### 6.2 Suspected break points (ranked by probability)

**HIGH PROBABILITY (read these first):**

1. **Pair handshake gating the room match.** `handler.js:151` requires `wss.handleUpgrade` to have been called with `{ hashKey, role }` from the URL params (server.js:241-262). If the dashboard's hashKey differs from the extension's hashKey -- because the user paired with a stale session or the auth middleware (`server.js:103-105` line `authMiddleware(queries)`) doesn't validate the same key both ends -- the dashboard and extension end up in DIFFERENT rooms and the relay log line at handler.js:202 will show `deliveredCount=0` for every extension->dashboard frame. **Inspection order #1: read the server logs while the bug repros and verify both extension and dashboard log connect events with the SAME `hashKey.substring(0,8)` prefix at lines 152 + 156.**

2. **Stream-tab resolution returns "not-ready" silently.** `extension/ws/ws-client.js:1029 _handleDashboardStreamStart` calls `_resolveStreamCandidate()` first (line 1030). If the candidate isn't ready, it emits `ext:stream-state` with `not-ready` and returns without calling `_forwardToContentScript` (lines 1032-1046). The dashboard's `handleRecoveredStreamState` (component line 2691) then renders the disconnected pane. **Inspection order #2: in dev tools network panel, watch for an outbound `ext:stream-state` message right after pressing the wake button -- if it carries `status: 'not-ready'`, the extension side never started the content-script tap.**

3. **`_forwardToContentScript` hits "no tab resolved" branch.** Line 1359-1376 of ws-client.js: if neither `_streamingTabId` nor `_dashboardTaskTabId` is set, the fallback `chrome.tabs.query({active:true})` runs but is famously unreliable from a service worker. Records `recordFSBTransportFailure('dom-forward-failed', {readyState: 'no-tab'})` and silently returns. **Inspection order #3: check `chrome.storage.local.fsbDiagnostics_ring` for `dom-forward-failed` entries (the Phase 211 diagnostics ring buffer at `extension/utils/diagnostics-ring-buffer.js` captures these).**

**MEDIUM PROBABILITY:**

4. **`ext:status` broadcast is missing or arrives before the dashboard's listener is wired.** `handler.js:158-163` broadcasts `ext:status {online:true}` when an extension connects. If the dashboard connects AFTER the extension, lines 166-172 send the snapshot. If the dashboard's `handleWSMessage` (component line 3411) is not yet registered (component constructor hasn't finished), the `extensionOnline = false` state persists, blocking `scheduleStreamRecovery` (component line 3425). **Inspection order #4: trace the order of `[WS] dashboard connected` and `[WS] extension connected` log lines from server.js console output.**

5. **LZ decompression failure on the dashboard side.** Component line 3319-3325 silently returns on decompress-failure with only a transport-error record. The user wouldn't see anything in the UI -- the frame appears to never arrive. **Inspection order #5: in the dashboard's transport-event ring (visible via the dashboard's existing diagnostic export, see component `recordTransportError` calls), look for `message-parse-failed` events with context `'parse'`.**

**LOW PROBABILITY:**

6. **Stale-mutation auto-resync loop.** Component lines 3144-3146 / 3162 / 3168 / 3175 trigger `requestPreviewResync` after 3 stale mutations. If the iframe doc is wiped between snapshot and a mutation arriving, every mutation goes stale, and the resync request itself is dropped by 1/2/3/4 above -- net result: dashboard sits at a stale snapshot forever. This is downstream of 1-5; fixing those should re-establish the chain.

7. **Mutation `data-fsb-nid` selector contract drift.** Lines 3142, 3153, 3161, 3167, 3174 of the dashboard use `'[data-fsb-nid="' + m.parentNid + '"]'` to find target nodes. If the content-script side (extension/content/dom-stream.js) emits a snapshot with a different attribute name or numbering scheme than the mutations, every patch fails. Worth grepping both files for `data-fsb-nid` once the upstream chain is verified intact.

### 6.3 Recommended inspection / fix order

Phase ordering (within the final fix phase, not across the milestone):

1. **Repro + capture three logs simultaneously:** server stdout (handler.js:152, 156, 202), extension diagnostics ring (`fsb_diagnostics_ring`), and dashboard transport events.
2. **Confirm hashKey parity** across the two `connected` lines (Break-point 1).
3. **Confirm `dash:dom-stream-start` reaches the extension** by reading server log line 202 -- look for `extension->dashboard ... type=ext:stream-state delivered=1` followed by the dashboard's reaction.
4. **If 2-3 are clean,** trace the content-script side: is `dom-stream.js` emitting `ext:dom-snapshot`? Add temporary logging at `extension/content/dom-stream.js:1063` (the `ext:page-ready -> dash:dom-stream-start auto-start chain` comment is already there).
5. **If snapshot arrives at dashboard** but iframe doesn't render: check `handleDOMSnapshot` line 2851-2856 iframe load handler -- a CSP block on the showcase domain could deny `srcdoc` content.

**Do NOT fix** anything outside the surface diagnosed by the above chain. The break-point ranking is hypotheses, not solutions; the actual root cause is one of these 7 points and must be confirmed by the inspection chain before code changes ship.

---

## 7. Phase Build Order Recommendation

### 7.1 Hard constraint

The milestone goal explicitly fixes the dashboard streaming fix LAST. Everything else must precede it.

### 7.2 Dependency graph

```
        Phase A: install-identity.js + opt-out plumbing
                    |
                    | (UUID available)
                    v
        Phase B: MCPMetricsRecorder + dispatcher hooks            +-- Phase C: mcp-pricing.js
                    |                                              |   (independent;
                    | (recordDispatch emits)                       |    pure data table)
                    +--------------------------+-------------------+
                                               |
                                               | (record + pricing both live)
                                               v
                            Phase D: TelemetryCollector + alarms + queue
                                               |
                                               | (events queueing)
                                               v
                            Phase E: Server ingest (/api/telemetry/* + schema + salt + rate-limit)
                                               |
                                               | (events accepted + rolled up)
                                               v
                            Phase F: Public aggregates endpoint + FSBTelemetryService Angular consumer
                                               |
                                               | (stats page renders aggregates)
                                               v
                            Phase G: Control-panel MCP analytics UI + opt-out toggle + first-run banner
                                               |
                                               | (operator can see + control everything)
                                               v
                            Phase H: Dashboard DOM-streaming fix (diagnostic + repair)
```

### 7.3 Parallelism opportunities

| Parallel pair | Why safe |
|---------------|----------|
| Phase A and Phase C | Pure data + storage bootstrap; no shared writes. UUID gen doesn't depend on pricing table; pricing table doesn't read storage. |
| Phase B and Phase E (after A, C done) | The extension-side recorder writes to chrome.storage; the server-side ingest creates SQLite tables. No coupling until Phase D wires the network call. |
| Phase F and Phase G | Different surfaces (Angular page vs control-panel HTML). Both read from already-existing data plumbing. |

### 7.4 Recommended phase numbering (continuing existing FSB phase counter)

Last phase shipped was **268** (v0.9.63 close). Suggested:

| # | Phase | Mode | Parallel-with |
|---|-------|------|---------------|
| 269 | Install identity + opt-out scaffold | Sequential | -- |
| 270 | API pricing module (`extension/ai/mcp-pricing.js`) | Parallel with 269 | 269 |
| 271 | MCPMetricsRecorder + dispatcher hooks + control-panel hero wiring | Sequential | -- |
| 272 | TelemetryCollector + alarm scheduling + queue persistence | Sequential | -- |
| 273 | Server schema + telemetry routes + salt rotator + rate limiter + housekeeper | Sequential | -- |
| 274 | Public aggregates endpoint + FSBTelemetryService Angular + `/stats` toggle group | Sequential | -- |
| 275 | First-run privacy banner + opt-out UX polish + integration smoke | Sequential | -- |
| 276 | Dashboard DOM-streaming diagnostic + fix | Sequential | -- (LAST per constraint) |

### 7.5 Phases that can shift if research surfaces new info

- **270 (pricing)** has the lowest risk and can move earlier or be folded into 271 if the pricing table proves trivial.
- **275 (privacy UX polish)** could fold into 274 if the toggle is a one-line addition to the existing control-panel; treat as optional split.
- **271-272 cannot merge** -- the metrics recorder writes a record-shape on every dispatch, the telemetry collector batches OUTBOUND. Conflating them would mean an outbound HTTP call on every MCP tool dispatch -- pathologically chatty and breaks the privacy story (the user expects batched anonymization, not real-time POSTs).

---

## 8. Integration Points Summary (for ROADMAP.md consumption)

| Touch point | Existing file | New code | Phase |
|-------------|---------------|----------|-------|
| MCP dispatch chokepoint -- tool routes | `extension/ws/mcp-tool-dispatcher.js:285-301` | `try/finally` around `route.handler(...)` call | 271 |
| MCP dispatch chokepoint -- message routes | `extension/ws/mcp-tool-dispatcher.js:303-331` | `try/finally` around `route.handler(...)` and `client[route.helperName](...)` | 271 |
| Service-worker boot | `extension/background.js:13015` (onInstalled) + `:13051` (onStartup) | `await FSBInstallIdentity.getOrCreateInstallUuid()` | 269 |
| Service-worker boot importScripts chain | `extension/background.js:4-65` | Insert `utils/install-identity.js`, `utils/mcp-metrics-recorder.js`, `utils/telemetry-collector.js`, `ai/mcp-pricing.js` | 269-272 |
| Analytics broadcast pattern (mirror) | `extension/background.js:11440-11447 broadcastAnalyticsUpdate` | New `broadcastMcpMetricsUpdate` -- emits `MCP_METRICS_UPDATE` | 271 |
| chrome.alarms beat scheduler (mirror) | `extension/ws/mcp-bridge-client.js:291-303 _scheduleReconnectAlarm` | `TELEMETRY_BEAT_ALARM` periodInMinutes:15 | 272 |
| Control panel analytics hero (additive) | `extension/ui/control_panel.html:104-122` | New "MCP Calls/Cost/Active Clients" tiles + per-call log section | 271, 275 |
| Server schema | `showcase/server/src/db/schema.js:9-73` | Add `telemetry_events`, `telemetry_rollups_daily`, `telemetry_global_aggregates` to the single `db.exec` block | 273 |
| Server queries | `showcase/server/src/db/queries.js:11-136 _prepareStatements` | New `insertTelemetryEvent`, `getGlobalTelemetryAggregates`, `getGlobalTelemetrySeries` prepared statements | 273 |
| Server routes mount | `showcase/server/server.js:99-113` | Add `app.use('/api/telemetry', createTelemetryRouter(queries))` (auth-NOT-required), `app.use('/api/public-stats', createPublicStatsRouter(queries))` | 273-274 |
| Salt + housekeeper init | `showcase/server/server.js:27-29` (post DB init) | `setInterval(housekeeper, 60*60*1000); housekeeper()` | 273 |
| Stats page consumer | `showcase/angular/src/app/pages/stats/stats-page.component.ts:32 import GitHubStatsService` | Add `import { FSBTelemetryService }`, new toggle group + view widgets | 274 |
| Existing dashboard streaming surface to diagnose | `showcase/server/src/ws/handler.js:175-203` (relay) + `extension/ws/ws-client.js:1029-1055` (start) + `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts:2802-3505` (consume) | Read-only diagnosis; targeted fix in one of these three files | 276 |

---

## 9. Outstanding Open Questions (to resolve during CONTEXT.md scoping)

1. **MCP client label allowlist.** The existing visual-session allowlist (`extension/utils/mcp-visual-session.js MCPVisualSessionUtils.normalizeMcpVisualClientLabel`) already covers "Claude Code", "Codex", "OpenClaw". Telemetry should reuse this exact list so the badge surface and the telemetry aggregation use identical labels. Verify the function is callable from `MCPMetricsRecorder` (it should be -- it's already imported by the dispatcher at `mcp-tool-dispatcher.js:42`).

2. **Should the first beat fire immediately or wait for the 15-min alarm?** Recommendation: fire on `chrome.runtime.onInstalled` and `onStartup` (after a 30-second idle grace so install_announce isn't conflated with first-actual-use) with a single `install_announce` event. Lets the server count total installs even from users who never use an MCP tool.

3. **`run_task` token harvesting shape.** The result envelope from `dispatchMcpToolRoute({tool:'run_task'})` ultimately resolves with `{sessionId, status, result, ...}` (from `_handleStartAutomation` in mcp-bridge-client.js:1196-1202). Where exactly inside `result` are token counts? Looks like they go through `automationComplete` message details -- verify path during Phase 271.

4. **Dashboard streaming fix scope.** The 7 break-points in Section 6.2 are an analytic ranking; the actual fix may be a one-liner OR may require a structural change to the pair-handshake. Final scope only knowable post-Phase-275 diagnostic. **Phase 276 must include a CONTEXT.md "diagnostic-first" plan** that decides scope after step 1-2 of Section 6.3.

---

**End of v0.9.69 architecture research.**
