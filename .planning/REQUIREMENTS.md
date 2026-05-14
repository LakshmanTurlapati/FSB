# Milestone v0.9.69 Requirements

**Milestone:** v0.9.69 Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix
**Status:** Defined 2026-05-14 -- ready for roadmap
**Source-of-truth research:** [.planning/research/SUMMARY.md](research/SUMMARY.md) (synthesized from STACK / FEATURES / ARCHITECTURE / PITFALLS)
**Continues phase numbering from:** v0.9.63 last phase = 268. v0.9.69 phases begin at **269**.

---

## Locked Decisions (cannot be revisited downstream)

| # | Decision | Source |
|---|----------|--------|
| D-01 | Identity = `crypto.randomUUID()` v4 stored in `chrome.storage.local` on first run. NEVER `chrome.storage.sync` (would create cross-device linkability). | User Q1 + PITFALLS 10.1 |
| D-02 | Consent = OPT-OUT, on by default globally. Kill switch lives in extension Control Panel "Advanced Settings" tab. NO first-run privacy banner. NO region-gated opt-in. | User Q2 + Q3 |
| D-03 | Server = extend existing `showcase/server/` (Express CJS + SQLite + WS on `/ws`). NO new microservice. | User Q3 |
| D-04 | MCP request cost+token accounting MERGES into existing AI-provider analytics surface (single `fsbUsageData` key). Existing "Total Tokens / Total Cost / Total Requests" hero numbers now include MCP-driven calls. | User scope Q (Control Panel) |
| D-05 | Beat cadence = **5 minutes**, exactly matches the "active users in last 5 min" aggregation window. LOCKED. | SUMMARY §Definitive Windows |
| D-06 | Active-agents staleness = **10 minutes** (2 missed beats). | SUMMARY §Definitive Windows |
| D-07 | k-anonymity floor = **k >= 5** distinct UUIDs for any "most popular X" cell. Below-k bucketed as `"Other (N=...)"`. | PITFALLS 3.1 |
| D-08 | Raw events retention = **7 days**. Daily rollups = 365 days. Global aggregates (1 row/day) = forever. | SUMMARY §Definitive Windows |
| D-09 | IP plaintext NEVER persisted. Server reads `req.ip` once, HMAC-SHA256 with daily-rotated salt, stores hash, discards plaintext. | PITFALLS 2.3 + 10.1 |
| D-10 | Pricing fallback policy = `cost = null` (NOT `$0`, NOT a default model row) for unknown models, so /stats can honestly surface "uncounted" calls. | STACK §Pricing Fallback Policy |
| D-11 | `chrome.storage.sync` is FORBIDDEN for any new telemetry storage (linkability risk). All new state goes in `chrome.storage.local`. | PITFALLS 3.4 |
| D-12 | Plaintext URLs, prompts, DOM, clipboard, form values are FORBIDDEN payload fields. Strict server-side allowlist of 9 fields rejects anything else with 400 `unknown_field`. | PITFALLS 10.1-10.2 |
| D-13 | Phase order = telemetry pipeline first (269-275), dashboard streaming fix LAST (276). LOCKED by user. | User original scope |
| D-14 | GDPR Article 17 erasure = backend-only `POST /api/telemetry/forget` endpoint; documented curl recipe in privacy policy; NO UI button in v0.9.69. | User Q5 |
| D-15 | CWS listing update = in-repo `listing-copy.md` diff + `verify-store-listing.mjs` CI guard; actual CWS Developer Dashboard click-through is user-gated at publish time. | User Q7 |
| D-16 | Streaming fix scope = diagnostic-first (capture 3 logs, walk 7-hypothesis chain), then minimum patch for confirmed hypothesis. Hard cap: 5 fix attempts before re-scoping to v0.9.70. | User Q6 |

---

## v0.9.69 Requirements

### Pricing & Cost (MCP) -- PRICE

- [ ] **PRICE-01**: User can estimate USD cost per MCP tool call -- system has a static `MODEL_PRICING` table covering Claude 4.x (Sonnet 4.6, Opus 4.7, Haiku 4.5), GPT-5 / GPT-5 mini / GPT-5.5, Gemini 2.5 Pro / Flash, Grok 4, DeepSeek V4 with per-million-token input + output rates as of 2026-05-14.
- [ ] **PRICE-02**: User can attribute an MCP call to a default model -- system has a `MCP_CLIENT_DEFAULT_MODEL` map covering every label in the v0.9.36 allowlist (Claude, Codex, ChatGPT, Perplexity, Windsurf, Cursor, Antigravity, OpenCode, OpenClaw, Grok, Gemini, Hermes) with HIGH/MEDIUM/LOW confidence stamps.
- [ ] **PRICE-03**: Developer audits the price table -- every row in `MODEL_PRICING` has a code comment with the source URL + retrieval date for traceability.
- [ ] **PRICE-04**: System gracefully reports cost-unknown -- when an MCP call's (client, model) is missing from the lookup, the pricing resolver returns `{cost: null, source: 'unknown'}` (NEVER `$0`, NEVER a default model row).
- [ ] **PRICE-05**: Developer knows when prices are stale -- module exports `PRICING_SOURCE_DATE = "2026-05-14"` constant; resolver attaches it to every result.

### Unified Cost Accounting (MCP + AI provider) -- COST

- [ ] **COST-01**: User sees a single set of analytics numbers in the extension Control Panel -- MCP tool dispatches and AI provider completions write into the SAME `fsbUsageData` key. The existing "Total Tokens / Total Cost / Total Requests" hero numbers now include both.
- [ ] **COST-02**: Every MCP call that the extension processes is recorded -- a single chokepoint inside `extension/ws/mcp-tool-dispatcher.js` (`dispatchMcpToolRoute` + `dispatchMcpMessageRoute`) writes one row per resolved call with `{client, tool, tokens_in, tokens_out, cost_usd, ts}` to `fsbUsageData`. Success and error both recorded.
- [ ] **COST-03**: User can audit MCP call rows without PII -- per-call log rows carry only client label, tool name, token counts, cost estimate, timestamp. NO prompts, NO URLs, NO DOM payloads, NO clipboard, NO form values. Static grep CI gate enforces.
- [ ] **COST-04**: Developer can distinguish MCP vs AI rows post-hoc -- each row carries a `source: 'mcp' | 'ai-provider'` discriminator field. No separate UI section; same hero numbers.
- [ ] **COST-05**: User does not see double-counting -- a single `MCPMetricsRecorder.recordDispatch()` is the only fact-emission site. Local persistence AND outbound telemetry both derive from this call; never from each other.

### Anonymous Identity -- IDENT

- [ ] **IDENT-01**: User has a stable anonymous identity per install -- on first run, extension generates `crypto.randomUUID()` and stores it under `chrome.storage.local.fsb_install_uuid`.
- [ ] **IDENT-02**: UUID survives extension reload -- lazy mint in BOTH `chrome.runtime.onInstalled` and `chrome.runtime.onStartup` handlers; existing value reused if present.
- [ ] **IDENT-03**: Telemetry no-ops when storage is unavailable -- on incognito / ephemeral profiles where `chrome.storage.local` is absent, `getOrCreateInstallUuid()` returns `null`; `TelemetryCollector.enqueue()` becomes a silent no-op. NO session-only UUID fallback (no aggregation value).
- [ ] **IDENT-04**: Cross-device linkability is impossible -- the UUID is in `chrome.storage.local` only. Any attempt to add `chrome.storage.sync` for telemetry-related keys is rejected at code review (and by a CI grep gate over `extension/utils/telemetry-*`).
- [ ] **IDENT-05**: UUID is never bundled with any field that could externally identify the user -- payload allowlist (see INGEST-09) is the gate.

### Telemetry Beat (extension side) -- BEAT

- [x] **BEAT-01**: Extension transmits a beat every 5 minutes -- `chrome.alarms.create('fsb-telemetry-beat', { periodInMinutes: 5 })`. Uniform 0-30s jitter added to flush start to avoid synchronized spikes.
- [x] **BEAT-02**: Beat persists across MV3 service-worker eviction -- queue lives in `chrome.storage.local.fsb_telemetry_queue_v1` (NEVER in SW memory). Alarm wakes a fresh SW which re-loads the queue from storage and flushes.
- [x] **BEAT-03**: Queue is bounded -- cap at 200 events; drop-oldest FIFO on overflow.
- [x] **BEAT-04**: Events de-dup on the server -- every event carries a client-minted `event_id = crypto.randomUUID()`. Server `INSERT OR IGNORE` on a UNIQUE constraint handles double-send after eviction.
- [x] **BEAT-05**: Timestamps don't fingerprint timing -- client rounds every `ts` to the minute (`tsMinute = Math.floor(Date.now() / 60000) * 60000`).
- [x] **BEAT-06**: Stale events are dropped -- on queue-load, drop events older than 24h.
- [x] **BEAT-07**: Opt-out is read live, not cached -- every flush re-reads `chrome.storage.local.fsb_telemetry_opt_out`. When true: queue is cleared, NO POST is made, alarm continues firing harmlessly.
- [x] **BEAT-08**: Flush survives tab close -- `fetch(..., { keepalive: true })` used for the POST; on rejection, batch is re-enqueued (capped re-tries to prevent infinite loops).
- [x] **BEAT-09**: First beat fires after install -- on `onInstalled`, an `install_announce` event enqueues after a 30s idle grace, then the alarm takes over.
- [x] **BEAT-10**: Beat is invisible to the user UI -- no notifications, no badges, no console logs at level higher than debug.

### Server Ingest (BLOCKERs live here) -- INGEST

- [ ] **INGEST-01** (BLOCKER #1): Showcase server trusts the Fly.io proxy -- `app.set('trust proxy', 1)` is set in `showcase/server/server.js` IMMEDIATELY after `const app = express()`, BEFORE any route or middleware mount. Without this, every install collapses into Fly's proxy IP and rate-limiting + IP-hashing are broken.
- [ ] **INGEST-02** (BLOCKER #2): Rate-limiter pinned to CVE-fixed version -- `showcase/server/package.json` adds `express-rate-limit: ^8.3.0` (minimum 8.3.0; below this is CVE-2026-30827 IPv4-in-IPv6 collision). Custom `keyGenerator` returns `hashIp(req.ip, db)` so rate buckets align with anonymous identity.
- [ ] **INGEST-03**: Server hashes IPs before storage -- `showcase/server/src/utils/telemetry-hash.js` uses HMAC-SHA256 with a daily-rotated salt fetched from a SQLite row in `telemetry_daily_salt`. Plaintext IP read from `req.ip` once, hash computed, plaintext discarded same statement.
- [ ] **INGEST-04**: Salt rotates daily, lazily, in-process -- `showcase/server/src/utils/telemetry-salt.js` checks on every hash whether today's UTC salt exists; if not, mints `crypto.randomBytes(32)`, INSERTs the row, deletes salts older than yesterday. NO cron daemon required.
- [ ] **INGEST-05**: SQLite schema is additive -- `showcase/server/src/db/schema.js` adds 4 new tables: `telemetry_events`, `telemetry_rollups_daily`, `telemetry_global_aggregates`, `telemetry_daily_salt`. NO existing table is altered.
- [ ] **INGEST-06**: SQLite is tuned for write throughput -- every new `Database()` connection PRAGMAs: `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `cache_size=-64000`, `temp_store=MEMORY`, `mmap_size=30000000000`.
- [ ] **INGEST-07**: Public POST endpoint enforces abuse limits -- `POST /api/telemetry/events` is unauthenticated but layered: (a) body size cap 32KB, (b) batch size cap 50 events, (c) per-IP-hash rate limit 30 batches/min, (d) per-UUID daily budget 1000 events/day, (e) timestamp tolerance: reject `ts > now+5min` OR `ts < now-7d`, (f) `INSERT OR IGNORE` on UNIQUE `event_id` for replay dedup.
- [ ] **INGEST-08**: Optout endpoint deletes by UUID -- `POST /api/telemetry/optout` body `{install_uuid}` deletes all matching rows from `telemetry_events` and `telemetry_rollups_daily`. Returns 204 always (no enumeration leak: same response whether UUID existed or not).
- [ ] **INGEST-09**: Server enforces a strict payload allowlist -- exactly 9 fields permitted per event: `event_id, install_uuid, ts_minute, mcp_client, model, tokens_in, tokens_out, active_agent_count, event_type`. Any unknown field returns `400 unknown_field`. Server-side Zod or hand-rolled validator.
- [ ] **INGEST-10**: Sec-GPC=1 header is honored -- requests carrying `Sec-GPC: 1` are silently dropped with 204 (future-safe for California AB 566 + Connecticut CTDPA).
- [ ] **INGEST-11**: Server has a housekeeper -- `showcase/server/src/telemetry/housekeeper.js` runs `setInterval(1h)`: deletes `telemetry_events` older than 7 days; re-aggregates today + yesterday rows in `telemetry_rollups_daily`; recomputes `telemetry_global_aggregates`; nudges salt rotation.
- [ ] **INGEST-12** (BLOCKER #3 backend): Erasure endpoint exists for GDPR Article 17 -- `POST /api/telemetry/forget` body `{install_uuid}` deletes from all 3 telemetry tables (events + rollups + nothing in global_aggregates since not joinable). 204 always. Documented in privacy policy with a curl recipe.
- [ ] **INGEST-13**: Server does not log raw `req.ip` to disk -- audit of any `morgan` / access logger middleware mounted before the telemetry route MUST redact `req.ip` from log lines that touch `/api/telemetry/*`. CI test (`tests/server-no-ip-leak.test.js`) asserts via grep.

### Aggregations (server side) -- AGG

- [ ] **AGG-01**: User can see total tokens used by all FSB users -- aggregated across all `telemetry_events` rows: 24h, 7d, lifetime. Surfaced as 3 metrics.
- [ ] **AGG-02**: User can see active users right now -- in-memory `Map<install_uuid, last_seen_ts>` updated on every ingest; "active right now" = count of UUIDs with `last_seen_ts > now - 5min`. NOT a SQLite query.
- [ ] **AGG-03**: User can see active agents right now -- sum of `active_agent_count` field across UUIDs with `last_seen_ts > now - 10min`. Result bucketed for display (`{0, 1, 2-4, 5-8, 9-16, 17-32, 33+}`).
- [ ] **AGG-04**: User can see total unique installs lifetime -- `SELECT COUNT(DISTINCT install_uuid) FROM telemetry_rollups_daily`.
- [ ] **AGG-05**: User can see total agent activations lifetime -- `SUM(daily_max_active_agent_count) FROM telemetry_rollups_daily` summed across UUIDs.
- [ ] **AGG-06**: User can see most-popular AI agent name (7d rolling) -- GROUP BY agent name (when available in payload) over last 7 days WITH `HAVING COUNT(DISTINCT install_uuid) >= 5`. Below-k labels bucket as `"Other (N=<count>)"`.
- [ ] **AGG-07**: User can see most-popular MCP client (7d rolling) -- GROUP BY `mcp_client` over last 7 days WITH `HAVING COUNT(DISTINCT install_uuid) >= 5`. Same below-k bucketing as AGG-06.
- [ ] **AGG-08**: User can see avg agents per active user -- mean of `active_agent_count` over UUIDs seen in last 5 minutes; rounded to 1 decimal.
- [ ] **AGG-09**: Aggregations are cached -- in-process `Map` memo with 30s TTL on the public aggregates endpoint; HTTP `Cache-Control: max-age=60` on response. Client-side already polls at 5min with visibility-aware pause.

### /stats Page Surface -- STATS

- [ ] **STATS-01**: User can view 6 new FSB telemetry chart views on /stats -- toggle entries: `fsb-active-now`, `fsb-tokens`, `fsb-agents-running`, `fsb-popular-agents`, `fsb-popular-mcp`, `fsb-avg-agents-per-user`. Appended to the existing 7 GitHub views.
- [ ] **STATS-02**: User sees headline numbers above the chart -- new headline row renders `active right now: N · total users: N · tokens 24h: NM`. Refreshes on every poll (5 min visibility-aware).
- [ ] **STATS-03**: User experiences the new views with the existing visibility-aware polling -- `FSBTelemetryService` mirrors `GitHubStatsService` (PLATFORM_ID guard, `BehaviorSubject<DatasetState<T>>`, `afterNextRender` bootstrap, ETag cache, pause on document.hidden, 5min interval).
- [ ] **STATS-04**: Server exposes public aggregates as JSON -- `GET /api/public-stats/global` (headline numbers) + `GET /api/public-stats/global/series` (time-series for chart views). NO auth. CORS open. ETag + Cache-Control headers. Mounted on a NEW path -- does NOT shadow the existing auth-gated `/api/stats`.
- [ ] **STATS-05**: New strings are translated -- 20-30 new trans-units added to `messages.xlf` with `i18n` markers; AI-filled across 5 non-en locales (es, de, ja, zh-CN, zh-TW). Build-time `i18nMissingTranslation: error` invariant respected.
- [ ] **STATS-06**: /stats remains Easter-egg-invisible -- existing `<meta name="robots" content="noindex, nofollow">` preserved; `prerender-routes.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `verify-hreflang.mjs` are NOT touched. Footer link remains the only entry point.
- [ ] **STATS-07**: Public JSON API documentation is explicitly DEFERRED -- no documented public API contract in v0.9.69 (the endpoint exists but is not advertised as stable). Future milestone may version + advertise.

### Consent / Privacy UX (minimal, per D-02) -- CONS

- [ ] **CONS-01**: User can disable telemetry via kill switch -- extension Control Panel "Advanced Settings" tab gains a "Send anonymous usage data" toggle. ON by default. When OFF: `chrome.storage.local.fsb_telemetry_opt_out = true`; alarm continues firing but flush is a no-op; queue is cleared.
- [ ] **CONS-02**: User can verify the kill switch is honored -- toggle state is reflected in the toggle UI within 100ms of click (sync write to storage). No "Apply" button. No nag screen.
- [ ] **CONS-03**: Public privacy policy page is updated -- `showcase/angular/src/app/pages/privacy/privacy-page.component.html` gains a "Anonymous Usage Telemetry" section covering: what we collect (UUID + tokens + active-agent count + MCP client label + model name), what we explicitly do NOT collect (URLs, prompts, DOM, IPs in plaintext, names, emails), retention (7d raw, 365d rollups, lifetime global aggregates), kill-switch path (Control Panel > Advanced Settings), erasure recipe (curl command for `POST /api/telemetry/forget`), and Limited Use affirmation.
- [ ] **CONS-04**: Public privacy policy page links to /stats -- "we publish aggregated metrics here" pointer added below the telemetry section.
- [ ] **CONS-05** (BLOCKER #3 listing): CWS listing copy is updated in-repo -- `store-assets/chrome-web-store/listing-copy.md` gets a "Data we collect" section mirroring CONS-03. New file `store-assets/chrome-web-store/privacy-practices-evidence.md` documents which CWS Privacy Practices checkboxes must be ticked (Personally identifiable information YES = UUID; Web history NO; Limited Use YES; Privacy Policy URL = `https://full-selfbrowsing.com/privacy#telemetry-disclosure`).
- [ ] **CONS-06**: CWS listing diff is CI-gated -- `scripts/verify-store-listing.mjs` is added to the website CI chain; fails if `listing-copy.md` lacks the new Data Collection section OR if the privacy-policy URL in `manifest.json`-listed homepage_url doesn't end with `/privacy`.
- [ ] **CONS-07**: GDPR Article 17 erasure is reachable -- privacy policy page documents the curl recipe (`curl -X POST https://server/api/telemetry/forget -d '{"install_uuid":"<your-uuid>"}'`) plus the in-extension path to copy the UUID (read-only field in Advanced Settings). NO "forget my data" button UI in v0.9.69 -- documented and deferred to v0.9.70+.

### Dashboard DOM-Streaming Fix -- STREAM

- [ ] **STREAM-01**: Developer captures reproducible logs BEFORE patching -- Phase 276 produces `.planning/phases/276-.../DIAGNOSTIC.md` with three simultaneous logs: (a) showcase server stdout around `handler.js:152, 156, 202`, (b) extension diagnostics ring (`chrome.storage.local.fsbDiagnostics_ring`), (c) dashboard transport-event history. Reproduction steps explicit.
- [ ] **STREAM-02**: Hypothesis chain is validated in rank order -- 7 ranked candidates from SUMMARY §Dashboard Streaming. Steps: #1 hashKey room mismatch -> #2 stream-tab `not-ready` -> #3 `_forwardToContentScript` no-tab -> #4 `domStreamReady` pending-intent -> #5 `ext:status` race -> #6 LZ decompression -> #7 stale-mutation loop. Each step: predicted symptom + verification command + fix surface.
- [ ] **STREAM-03**: User sees the dashboard preview start streaming again -- whichever hypothesis confirms, the minimum patch lands. Acceptance smoke: click "wake" on the dashboard with an active extension on a non-restricted tab; preview pane shows live DOM within 3 seconds; stream-state pill reads "streaming".
- [ ] **STREAM-04**: User sees stream health metrics in the pill tooltip -- existing `dash-preview-tooltip` element gains: last-frame-ago (s), mutations applied total, apply failures total, stale-mutation count. All values already exist as component state (`mutationApplyFailures`, `staleMutationCount`) per `dashboard-page.component.ts`.
- [ ] **STREAM-05** (defensive bonus, only if time allows): Background watchdog re-requests snapshot on stale stream -- `background.js:12942-12945` watchdog-alarm handler upgraded from `console.log` to: if `_streamingActive` true, send `ext:request-snapshot` to relay.
- [ ] **STREAM-06** (defensive bonus, only if time allows): Server WS skips clients with backpressure -- `showcase/server/src/ws/handler.js:74-80` `sendToClients` checks `client.bufferedAmount > 16MB` and increments a `backpressure-dropped` counter, drops the frame to that client.
- [ ] **STREAM-07**: Scope is hard-capped -- maximum 5 fix attempts (1 per hypothesis confirmation cycle) before re-scoping the unresolved tail to v0.9.70 with explicit deferred-items.md entry.

---

## Future Requirements (deferred, NOT v0.9.69)

These were named in research as table-stakes-for-someday but explicitly out of this milestone:

- **TELEMETRY-FUTURE-01**: First-run privacy banner with copy from FEATURES.md §Privacy/Consent UX (deferred per D-02; user wants kill-switch-only for v0.9.69).
- **TELEMETRY-FUTURE-02**: "View what we send" live JSON preview panel in Control Panel.
- **TELEMETRY-FUTURE-03**: "Reset anonymous ID" button (rotates local UUID + POSTs forget for old one).
- **TELEMETRY-FUTURE-04**: "Wipe my telemetry data" in-extension button (uses existing INGEST-12 backend endpoint).
- **TELEMETRY-FUTURE-05**: Region-gated opt-IN for EU/UK/CA installs (ePrivacy Article 5(3) compliance).
- **TELEMETRY-FUTURE-06**: Public versioned JSON API documentation for `/api/public-stats/global`.
- **TELEMETRY-FUTURE-07**: Per-day spark lines next to each headline number on `/stats`.
- **TELEMETRY-FUTURE-08**: Geo heatmap of installs (country-level only, k>=100 floor) -- needs install-base size to justify.
- **TELEMETRY-FUTURE-09**: 1Hz "agents currently running RIGHT NOW" auto-refreshing ticker on `/stats`.
- **DASHBOARD-FUTURE-01**: Full dashboard streaming rewrite if STREAM-07 hard cap is hit (current scope is diagnose + minimum patch only).
- **DASHBOARD-FUTURE-02**: Dashboard surface i18n -- `showcase/angular/src/app/pages/dashboard/**` translation; remove `--ignore-pattern` from `lint:i18n` (carry-forward from v0.9.63).
- **UX-FUTURE-01**: Picker-cookie short-circuit fix on bare-`/` Accept-Language redirect (carry-forward from v0.9.63 WARNING-02).
- **PRICING-REFRESH-CI**: 90-day CI gate that fails if `PRICING_SOURCE_DATE` is stale (deferred per user scope; manual refresh policy).

---

## Out of Scope (explicit exclusions)

| Item | Why excluded |
|------|--------------|
| First-run privacy banner UI | User explicitly chose kill-switch-only (D-02). Deferred to v0.9.70+. |
| Region-gated opt-in for EU | Same as above. Documented legal risk: opt-out-by-default in GDPR jurisdictions is contestable under ePrivacy Article 5(3); user accepts this risk for v0.9.69. |
| Reset anonymous ID button | Out of consent UX scope (D-02). Backend supports it via `/forget` (INGEST-12). |
| Geo heatmap of installs | Requires k>=100 floor + Cloudflare CF-IPCountry trust-boundary decision. Premature with current install-base. |
| New microservice for telemetry | Decided server = extend `showcase/server/` (D-03). |
| Auth on `/api/telemetry/events` | Public endpoint by design (anonymous). Layered abuse mitigations (INGEST-07) replace auth. |
| `chrome.storage.sync` for ANY new key | Cross-device linkability risk (D-11). |
| Logging user prompts, URLs, DOM, clipboard, form values | PII leak; not the system's purpose (D-12). |
| Dashboard streaming rewrite | Scope is diagnose-then-minimum-patch (D-16); rewrite belongs to v0.9.70+ if needed. |
| Bumping fsb-mcp-server version | v0.9.0 was just published in v0.9.62; no contract changes here. |
| Touching frozen contract anchors (v0.9.36, v0.9.60-62) | Historical phase markers; immutable. |

---

## Traceability

Every v0.9.69 REQ-ID maps to exactly one phase. Phase numbering continues from v0.9.63 (last phase = 268); v0.9.69 phases are 269-276.

**Coverage:** 68/68 v0.9.69 requirements mapped (100%); no orphans.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PRICE-01 | 270 | Pending |
| PRICE-02 | 270 | Pending |
| PRICE-03 | 270 | Pending |
| PRICE-04 | 270 | Pending |
| PRICE-05 | 270 | Pending |
| COST-01 | 271 | Pending |
| COST-02 | 271 | Pending |
| COST-03 | 271 | Pending |
| COST-04 | 271 | Pending |
| COST-05 | 271 | Pending |
| IDENT-01 | 269 | Pending |
| IDENT-02 | 269 | Pending |
| IDENT-03 | 269 | Pending |
| IDENT-04 | 269 | Pending |
| IDENT-05 | 269 | Pending |
| BEAT-01 | 272 | Complete |
| BEAT-02 | 272 | Complete |
| BEAT-03 | 272 | Complete |
| BEAT-04 | 272 | Complete |
| BEAT-05 | 272 | Complete |
| BEAT-06 | 272 | Complete |
| BEAT-07 | 272 | Complete |
| BEAT-08 | 272 | Complete |
| BEAT-09 | 272 | Complete |
| BEAT-10 | 272 | Complete |
| INGEST-01 | 273 | Pending |
| INGEST-02 | 273 | Pending |
| INGEST-03 | 273 | Pending |
| INGEST-04 | 273 | Pending |
| INGEST-05 | 273 | Pending |
| INGEST-06 | 273 | Pending |
| INGEST-07 | 273 | Pending |
| INGEST-08 | 273 | Pending |
| INGEST-09 | 273 | Pending |
| INGEST-10 | 273 | Pending |
| INGEST-11 | 273 | Pending |
| INGEST-12 | 273 | Pending |
| INGEST-13 | 273 | Pending |
| AGG-01 | 274 | Pending |
| AGG-02 | 274 | Pending |
| AGG-03 | 274 | Pending |
| AGG-04 | 274 | Pending |
| AGG-05 | 274 | Pending |
| AGG-06 | 274 | Pending |
| AGG-07 | 274 | Pending |
| AGG-08 | 274 | Pending |
| AGG-09 | 274 | Pending |
| STATS-01 | 274 | Pending |
| STATS-02 | 274 | Pending |
| STATS-03 | 274 | Pending |
| STATS-04 | 274 | Pending |
| STATS-05 | 274 | Pending |
| STATS-06 | 274 | Pending |
| STATS-07 | 274 | Pending |
| CONS-01 | 269 | Pending |
| CONS-02 | 269 | Pending |
| CONS-03 | 275 | Pending |
| CONS-04 | 275 | Pending |
| CONS-05 | 275 | Pending |
| CONS-06 | 275 | Pending |
| CONS-07 | 275 | Pending |
| STREAM-01 | 276 | Pending |
| STREAM-02 | 276 | Pending |
| STREAM-03 | 276 | Pending |
| STREAM-04 | 276 | Pending |
| STREAM-05 | 276 | Pending |
| STREAM-06 | 276 | Pending |
| STREAM-07 | 276 | Pending |

### Phase summary (REQ count per phase)

| Phase | REQ count | Categories |
|-------|-----------|------------|
| 269 Install Identity + Opt-Out Scaffold | 7 | IDENT-01..05, CONS-01, CONS-02 |
| 270 MCP Pricing Module | 5 | PRICE-01..05 |
| 271 MCPMetricsRecorder + Dispatcher Hooks + Unified Cost Surfacing | 5 | COST-01..05 |
| 272 TelemetryCollector + Alarm + Queue Persistence | 10 | BEAT-01..10 |
| 273 Server Schema + Telemetry Routes + Salt Rotator + Rate Limiter + Housekeeper | 13 | INGEST-01..13 (BLOCKERs #1, #2) |
| 274 Public Aggregates Endpoint + FSBTelemetryService Angular + /stats Toggle Group | 16 | AGG-01..09, STATS-01..07 |
| 275 Privacy Policy Page Update + CWS Listing Diff + CI Guard + Integration Smoke | 5 | CONS-03..07 (BLOCKER #3) |
| 276 Dashboard DOM-Streaming Diagnostic + Minimum Patch | 7 | STREAM-01..07 |
| **Total** | **68** | **100% coverage, no orphans** |

---

*Generated: 2026-05-14 -- v0.9.69 milestone start. Source-of-truth research at .planning/research/SUMMARY.md. Traceability filled by gsd-roadmapper.*
