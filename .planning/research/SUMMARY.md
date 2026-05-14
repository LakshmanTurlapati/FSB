# v0.9.69 Project Research Summary

**Milestone:** v0.9.69 Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix
**Date:** 2026-05-14
**Synthesized from:** [STACK.md](STACK.md), [FEATURES.md](FEATURES.md), [ARCHITECTURE.md](ARCHITECTURE.md), [PITFALLS.md](PITFALLS.md)

---

## Executive Summary

v0.9.69 stands up a privacy-first telemetry pipeline (extension → server) feeding `/stats` plus repairs the broken `dash:dom-stream-*` pipe. The recommended approach is boring tech with a sharp privacy contract: `crypto.randomUUID()` in `chrome.storage.local`, `chrome.alarms` 5-min beat, HMAC-SHA256 + daily-rotated SQLite-stored salt server-side, pre-rolled daily aggregates with k≥5 anonymity floor before any public cell. The single biggest risk is regulatory — three formal BLOCKERs gate the v0.9.69 CWS release: (1) `app.set('trust proxy', 1)` before any telemetry route, (2) `express-rate-limit@^8.3.0` minimum (CVE-2026-30827), (3) updated CWS listing copy + Privacy Practices tab declaration. Dashboard-stream fix LOCKED at phase 276 (last); both ARCHITECTURE and PITFALLS independently converge on a 7-hypothesis rank with content-script-readiness race as the leading suspect.

### Roadmap Implications

**Suggested phases: 8** (continuing from last shipped phase 268)

1. **Phase 269 — Install Identity + Opt-Out Scaffold** — UUID lazy mint at `onInstalled`/`onStartup`; storage-backed; foundation for everything else.
2. **Phase 270 — MCP Pricing Module (PARALLEL with 269)** — pure data table + resolver; verbatim drop-in tables in SUMMARY.
3. **Phase 271 — MCPMetricsRecorder + dispatcher hooks + control-panel hero** — single-fact two-consumer pattern at the `try/finally` chokepoint of `dispatchMcpToolRoute`/`dispatchMcpMessageRoute`.
4. **Phase 272 — TelemetryCollector + alarm + queue persistence** — 5-min `chrome.alarms`, storage-backed queue, minute-resolution timestamps, jittered, `keepalive: true`.
5. **Phase 273 — Server schema + routes + salt rotator + rate limiter + housekeeper** — biggest phase; all 3 BLOCKERs land here.
6. **Phase 274 — Public aggregates endpoint + FSBTelemetryService Angular + `/stats` toggle group** — mirror `GitHubStatsService`; 6 new toggle entries; i18n AI-fill 5 non-en locales.
7. **Phase 275 — Privacy banner + opt-out UX + CWS listing + privacy policy + CI gates** — Blocker #3 lands here; release-prep.
8. **Phase 276 — Dashboard streaming fix (LAST)** — diagnostic-first; walk the 7-hypothesis chain in rank order; do NOT pre-write patches.

### Research Flags

- **Needs phase-level research:** Phase 273 (Fly.io `trust proxy` chain depth, morgan/access-log audit, salt storage final decision, disk-volume sizing), Phase 275 (legal copy review), Phase 276 (diagnostic-first; scope unknowable pre-repro)
- **Standard patterns (no research):** Phases 269, 270, 271, 272, 274 — all mirror existing FSB patterns

### Confidence

**Overall: HIGH** for shipping the telemetry pipeline; **MEDIUM** for dashboard-stream fix scope (knowable post-diagnostic only).

### Gaps

1. Salt storage final decision (SQLite row vs `data/salt.json` 0600) — STACK and ARCHITECTURE disagree slightly; SQLite row recommended.
2. `run_task` token-harvest path through `automationComplete` envelope — verify Phase 271 CONTEXT.md.
3. Backpressure baseline — is `ws.bufferedAmount > 0` observed in prod?
4. GDPR opt-IN region-gate — build `consentDecisionAt` precondition into Phase 273 schema; ship opt-out-default globally for MVP.
5. `morgan`/access-log audit for `req.ip` capture on telemetry routes — Phase 273 must verify pre-route.
6. OpenAI 5.x family pricing freshness (MEDIUM-confidence rows) — cross-check at Phase 270 ship.
7. DeepSeek V4-Pro 75% promo expires 2026-05-31 — refresh table sentinel.

### Ready for Requirements

SUMMARY.md content fully drafted below. **The parent orchestrator must persist this to `/Users/lakshman/Documents/Misc/FSB/.planning/research/SUMMARY.md`** (overwriting the stale v0.9.61 file) **and run the commit step** since direct `Write` and `Bash` git operations were blocked by the subagent runtime guard.

---

## Full SUMMARY.md Content (drop-in)

```markdown
# Project Research Summary

**Project:** FSB (Full Self-Browsing)
**Milestone:** v0.9.69 — Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix
**Domain:** Privacy-preserving anonymous telemetry from MV3 Chrome extension → Express + better-sqlite3, plus diagnosis of a regressed `ws` DOM-streaming pipeline
**Researched:** 2026-05-14
**Branch:** Refinements
**Confidence:** HIGH (4/4 research files anchored to live primary sources; streaming-fix surface diagnosed by code-walk, not runtime)

> **Note:** This file SUPERSEDES the prior v0.9.61 OpenClaw-Skill summary. v0.9.69 is an *additive* milestone on a validated stack — the only NEW production dependency is `express-rate-limit@^8.3.0`. All other primitives are Node built-ins or already-installed.

---

## Executive Summary

v0.9.69 stands up a privacy-first telemetry pipeline (extension → server) feeding the public `/stats` Easter-egg page, plus repairs the broken `dash:dom-stream-*` pipe in the showcase dashboard. The recommended approach is uniformly *boring tech, sharp privacy contract*: a per-install UUIDv4 from `crypto.randomUUID()` lives in `chrome.storage.local`, a `chrome.alarms`-driven 5-minute beat batches a strictly allowlisted payload, the server hashes `req.ip` with HMAC-SHA256 keyed by a daily-rotated salt stored in a SQLite row (not env-var), and aggregates are computed against pre-rolled daily summary tables with a `k≥5` anonymity floor before any cell is exposed publicly. No third-party analytics SDKs (PostHog, Segment, Mixpanel, Datadog, Sentry, GA) are introduced — they are categorically rejected by privacy mandate.

The single biggest risk is regulatory. A persistent UUID linked to behavior IS personal data under GDPR Recital 30, and the Chrome Web Store treats it as "any type of identification number" under the User Data FAQ. Publishing v0.9.69 to the CWS without (a) `app.set('trust proxy', 1)` landed before any telemetry route, (b) `express-rate-limit@^8.3.0` (CVE-2026-30827 patch baseline), and (c) updated listing copy + Privacy Practices tab declaration is an enforcement-action risk. These three items are formal BLOCKERs and gate the v0.9.69 release tag.

The dashboard-streaming fix is deliberately the LAST phase. Both ARCHITECTURE and PITFALLS independently land on the same hypothesis ranking — the leading suspect is a content-script-readiness race in `_handleDashboardStreamStart` (300 ms heuristic delay after `chrome.scripting.executeScript`, no readiness ping), followed by a missing `domStreamReady` re-arm path, with hashKey/room-mismatch as the third candidate. Diagnose first, fix second; do not pre-write a patch.

---

## Key Findings

### Recommended Stack (see STACK.md)

The runtime stack is already validated from prior milestones — Node ≥20, Express `^4.21.0`, `better-sqlite3@^11.0.0` (DO NOT upgrade to v12 — Node 24 build instability per WiseLibs#1376/#1411), `ws@^8.19.0`, `cors@^2.8.5`, `dotenv@^16.4.0`. Chrome MV3 + `chrome.storage.local` (already `unlimitedStorage`-permissioned in `manifest.json:9`) + `chrome.alarms` cover the extension side end-to-end.

**Core technologies (all built-in / pinned):**
- `crypto.randomUUID()` (Node 20+ / MV3 SW Chrome 92+): install UUID + event IDs. Zero deps, ~3× faster than `uuid@v9`. Already used at FSB extension sites.
- `crypto.createHmac('sha256', salt).update(ip).digest('hex')`: server-side IP hashing. HMAC over plain SHA-256 closes length-extension vector at zero cost.
- `chrome.storage.local` (unlimited): install UUID, event queue, opt-out flag. NOT `sync` (account-level conflation), NOT `session` (wiped on SW eviction).
- `chrome.alarms` with `periodInMinutes: 5`: beat wake. NOT `setInterval` (dies with SW). Lock to **5 minutes** (see Numeric Windows below).
- SQLite WAL + `synchronous=NORMAL` + `busy_timeout=5000` + prepared-statement transactions for telemetry inserts.

**ONE NEW PRODUCTION DEPENDENCY (server only):**
- **`express-rate-limit@^8.3.0`** — MUST be ≥ 8.3.0 (patches CVE-2026-30827 IPv4-mapped-IPv6 default-keyGenerator collision on dual-stack hosts; Fly.io is dual-stack). Custom `keyGenerator` required: rate-limit by the same HMAC-SHA256 IP-hash the rest of the system stores, never raw IP.

Extension side: **no new npm install.** MCP side: **no new npm install** (pricing module is pure data, a TS file at `mcp/src/tools/pricing.ts`).

### Pricing Snapshot — May 14, 2026 USD per 1M tokens (verbatim drop-in for the pricing-module phase)

| Provider | Model | Input ($/MTok) | Output ($/MTok) | Source confidence |
|---|---|---:|---:|---|
| **Anthropic** | claude-opus-4-7 | 5.00 | 25.00 | HIGH (platform.claude.com live 2026-05-14) |
| Anthropic | claude-opus-4-6 | 5.00 | 25.00 | HIGH |
| Anthropic | claude-opus-4-5 | 5.00 | 25.00 | HIGH |
| Anthropic | claude-opus-4-1 | 15.00 | 75.00 | HIGH |
| **Anthropic** | claude-sonnet-4-6 | 3.00 | 15.00 | HIGH |
| Anthropic | claude-sonnet-4-5 | 3.00 | 15.00 | HIGH |
| **Anthropic** | claude-haiku-4-5 | 1.00 | 5.00 | HIGH |
| **OpenAI** | gpt-5 | 1.25 | 10.00 | HIGH (OpenRouter mirror + 2 sources) |
| **OpenAI** | gpt-5-mini | 0.25 | 2.00 | HIGH |
| OpenAI | gpt-5-nano | 0.05 | 0.40 | MEDIUM |
| OpenAI | gpt-5.1 | n/a published | n/a published | LOW — TODO refresh |
| OpenAI | gpt-5.2 | 1.75 | 14.00 | MEDIUM (IntuitionLabs Feb 2026) |
| OpenAI | gpt-5.4 | 2.50 | 15.00 | MEDIUM |
| **OpenAI** | gpt-5.5 (Apr 2026+ flagship) | 5.00 | 30.00 | MEDIUM |
| OpenAI | gpt-5.5-codex | inherits gpt-5.5 | inherits gpt-5.5 | MEDIUM |
| **Google** | gemini-2.5-pro (≤200k) | 1.25 | 10.00 | HIGH (ai.google.dev live) |
| Google | gemini-2.5-pro (>200k) | 2.50 | 15.00 | HIGH |
| **Google** | gemini-2.5-flash | 0.30 text / 1.00 audio | 2.50 | HIGH |
| Google | gemini-2.5-flash-lite | 0.10 / 0.30 audio | 0.40 | HIGH |
| **xAI** | grok-4.3 | 1.25 | 2.50 | HIGH ≤200k; MEDIUM >200k (unpublished upper tier) |
| xAI | grok-4.20-* (3 variants) | 1.25 | 2.50 | HIGH |
| **xAI** | grok-4.1-fast-reasoning | 0.20 | 0.50 | HIGH |
| xAI | grok-4 (retiring 2026-05-15) | 3.00 | 15.00 | HIGH — REDIRECTS TO grok-4.3 after retirement |
| **DeepSeek** | deepseek-v4-flash | 0.14 miss / 0.0028 hit | 0.28 | HIGH (api-docs.deepseek.com live) |
| **DeepSeek** | deepseek-v4-pro | 0.435 miss / 0.003625 hit | 0.87 | HIGH — **75% promo expires 2026-05-31** |

**Notes for the pricing module:**
- Stamp `PRICING_SOURCE_DATE = "2026-05-14"` constant alongside the table.
- Opus 4.7 uses a new tokenizer that consumes up to 35% more tokens vs Opus 4.6 — per-token rate unchanged, effective cost-per-request can rise ~35%. Code-comment this.
- DeepSeek V3 / DeepSeek-R1 are NO LONGER LISTED on official docs as of 2026-05-14; do not include.
- Refresh policy: re-verify every milestone version bump; OpenAI's `platform.openai.com/docs/pricing/` returns 403 to WebFetch — use OpenRouter (`openrouter.ai/openai/gpt-5`) as the canonical mirror.
- Per-request surcharges (Anthropic web search $10/1k, Google grounding $35/1k, Opus Fast Mode 6× standard) are **OUT OF SCOPE** for v0.9.69 — token-only pricing. Document as a future-enrichment TODO.
- **Fallback policy for unknown client/model:** record `cost_usd = null` (NOT `0`). Display as "uncounted" on stats. The existing `extension/ai/cost-tracker.js` fallback to `grok-4-1-fast-reasoning` pricing must NOT be used for MCP rows — false zero distorts aggregates.

### MCP Client → Default-Model Mapping (verbatim drop-in)

The visual-session allowlist is the single source of truth (`mcp/src/tools/visual-session.ts:9-12`). The mapping below is what the pricing resolver uses when the MCP `tools/call` payload does not carry an explicit `model`. Recommend the schema carry TWO fields: `mcp_client` (the trusted allowlist label) + `assumed_model` (the default we mapped to). Future enrichment: optional `actual_model` if/when the MCP envelope carries it.

| Client Label | Assumed Default Model (May 2026) | Confidence | Rationale |
|---|---|---|---|
| **Claude** (Claude Code) | `claude-opus-4-7` | HIGH | Apr 23, 2026 Anthropic changelog default change for Enterprise PAYG + API |
| **Codex** (OpenAI Codex CLI/IDE) | `gpt-5.5` | HIGH | Codex docs recommend `gpt-5.5` since April 2026; `gpt-5.5-codex` for coding-specific flows |
| **ChatGPT** (API consumers) | `gpt-5` | MEDIUM | No canonical "ChatGPT" CLI; conservative standard-tier |
| **Perplexity** (Comet Agent / Pro) | `claude-sonnet-4-6` | MEDIUM | Comet default since 2026 Q1; computer-agent flow moved to GPT-5.5 in May (router) |
| **Windsurf** (Cascade) | `claude-sonnet-4-6` | **LOW** | SWE-1.5 has no public per-token price — conservative fallback |
| **Cursor** | `claude-sonnet-4-6` | **MEDIUM** | "Auto" mode routes across GPT-5.4 / Sonnet 4.6 / Opus 4.6 / Gemini 3.1 Pro — no fixed default |
| **Antigravity** (Google IDE) | `gemini-3.1-pro` | HIGH | Google Cloud Blog confirms default; Flash optional |
| **OpenCode** (SST CLI) | `claude-sonnet-4-6` | MEDIUM | User-configurable via `opencode.json`; docs example is Sonnet 4.6 |
| **OpenClaw / OpenClaw 🦀** | `claude-sonnet-4-6` | HIGH | OpenClaw docs + haimaker.ai both confirm primary-agent default |
| **Grok** (xAI grok CLI / OpenRouter) | `grok-4.3` | HIGH | Current flagship May 2026; replaces deprecated `grok-4` on May 15 |
| **Gemini** (Gemini CLI) | `gemini-2.5-pro` | MEDIUM | Gemini 3.x is documented for Antigravity; Gemini CLI still defaults to 2.5 Pro |
| **Hermes** (Nous Research Agent) | `claude-sonnet-4-6` | **LOW** | User-configurable across OpenRouter / Nemotron / Mimo — no single priceable default |

**Policy decision required during REQUIREMENTS.md scoping:** What to do with the 4 LOW/MEDIUM router rows (Windsurf, Cursor, OpenCode, Hermes). Two options:
1. **Accept the conservative Sonnet 4.6 fallback** and live with some over/under-estimation. Mark rows with `pricing_confidence: "fallback"`.
2. **Emit `cost_usd = null`** for these clients and surface as "uncounted" on stats.

Recommend option 1 for v0.9.69 (some signal is better than none); revisit when MCP envelope reliably carries `actual_model`.

### Definitive Numeric Windows (locked — one number per metric)

The 4 research files surfaced minor conflicts around beat cadence (5 min vs "every 20 events OR 15 min"). Resolution: **lock the beat to 5 minutes**, because the "Active users in last 5 min" metric requires the beat to be ≤5 min old to count.

| Concept | LOCKED Value | Rationale |
|---|---|---|
| **Beat cadence** | **5 minutes** (`chrome.alarms` `periodInMinutes: 5`) | Active-users-now window REQUIRES ≤5-min-old beats. The 15-min/20-event proposal in ARCHITECTURE §3.2 is OVERRIDDEN by the 5-min lock so the active-now aggregate stays correct. |
| **Active users right now** | **Last 5 minutes** | Plausible "current visitors" precedent + matches beat cadence exactly |
| **Active agents (right now)** | **Last 10 minutes** (= 2 beat cycles) | Standard "missed-one-heartbeat tolerance" pattern from Airflow zombie-task threshold / Temporal heartbeat — one missed beat is jitter, two is dead |
| **"Most popular X" window** | **7-day rolling**, k≥5 anonymity floor | Homebrew install-count methodology; prevents one-time experimenter from inflating |
| **Raw events retention** | **7 days** | Re-aggregation buffer; longer becomes data-minimization creep |
| **Daily rollup retention** | **365 days** | Year-over-year charts |
| **Global aggregates retention** | **Forever** (one row/day) | Trivial size; lifetime chart |
| **Daily salt retention** | **Today + yesterday only** (lazy cleanup deletes older) | Covers cross-midnight late-arriving batches; prior days computationally irreversible |
| **Per-IP-hash rate limit** | **30 batches/min/IP-hash** | Generous headroom over the 1-beat-per-5-min baseline (≈12/hour normal) |
| **Per-install daily budget** | **1000 events/day/UUID** | Normal usage is <100/day; cap prevents flood-amplification |
| **Batch size cap** | **50 events/POST** | Stays well under 1MB body limit; ARCHITECTURE §3.2 alignment |
| **Future timestamp tolerance** | **+5 minutes** | Clock-drift tolerance, drop beyond |
| **Past timestamp tolerance** | **−7 days** | Bounds replay-attack window |
| **k-anonymity floor** | **k ≥ 5 distinct UUIDs** | Standard public-dashboard threshold; below-k cells bucketed as "Other (N=...)" |
| **Active-agent bucketing** | **{0, 1, 2-4, 5-8, 9-16, 17-32, 33+}** | Defeats behavioral fingerprinting of high-concurrency users |
| **Install-date rounding** | **Week granularity** in any aggregate that exposes install cohorts | Prevents narrow-cohort identification |

### Expected Features (see FEATURES.md)

**Must have (table stakes for v0.9.69):**
- `MODEL_PRICING` table keyed `(client, model)` with `source_url + fetched_at` provenance per row (the table above is the seed data).
- Per-MCP-client default-model fallback when payload lacks `model`.
- MCP analytics hero in `control_panel.html` mirroring the existing 4-card AI analytics pattern (`MCP Calls`, `MCP Tokens`, `MCP Cost (approx)`, `Top Client (24h)`).
- Per-MCP-client breakdown table (24h / 7d / lifetime columns).
- Per-tool-name breakdown table.
- Per-call log row stream (FIFO 100–1000, NO prompt/response bodies, NO URLs — see Privacy Antipatterns below).
- Daily token-usage spark line (last 7 days, MCP-tokens only).
- UUIDv4 minted on first run, stored in `chrome.storage.local` under `fsb_install_uuid`. NEVER `chrome.storage.sync`.
- Strict payload allowlist: `{uuid, ts_minute, tokens_used, active_agents, mcp_client_label, model, agent_name_set, total_agents_lifetime_delta}` and nothing else. Server-side defense-in-depth rejects unknown fields with `400 unknown_field`.
- 5-minute `chrome.alarms` beat; skip beat when nothing to report.
- `app.set('trust proxy', 1)` (first code change before any route lands).
- Server `POST /api/telemetry/events` (rate-limited, schema-validated).
- Server `POST /api/telemetry/optout` (write-only delete by `{uuid}`, returns `{deleted: N}` not data).
- IP hashing via HMAC-SHA256 + daily salt stored in SQLite (NOT env var). Lazy daily rotation.
- 7-day raw event retention; pre-aggregated `telemetry_rollups_daily` + `telemetry_global_aggregates` for fast public-stats serving.
- Public `GET /api/public-stats/global` + `/global/series` (mounted SEPARATELY from `/api/stats/*` which is auth-gated).
- `/stats` page extension: 6 new toggle entries (`fsb-active-now`, `fsb-tokens`, `fsb-agents-running`, `fsb-popular-agents`, `fsb-popular-mcp`, `fsb-avg-agents-per-user`) reusing the existing visibility-aware 5-min polling primitive, `view-switcher` tablist, `chart-card[data-state]` machine, Chart.js dynamic-import contract.
- First-run privacy banner (opt-out, default-on), "View what we send" live JSON preview, "Reset anonymous ID" button, "Stop sending data" master switch.
- Updated `full-selfbrowsing.com/privacy` page covering the new collection.
- Updated `store-assets/chrome-web-store/listing-copy.md` data-collection section + CWS Developer Dashboard *Privacy practices* tab declaration.

**Should have (competitive, ship if scope allows):**
- Manual "override default model for this client" picker (per-row dropdown in control panel; local-only).
- Per-row "last verified" yellow-highlight badge when `fetched_at` is >60 days stale vs build date.
- "Cost is approximate" hover tooltip on every MCP-cost figure.
- Weekly trend chip (arrow + % delta vs prior 7d window) on per-client / per-tool rows.
- "Export MCP Logs (JSON)" + "Clear MCP Logs" debug buttons mirroring existing `Export Data` / `Clear Analytics Data`.
- Stream-state pill telemetry tooltip showing `last-frame ago`, mutations applied, stale-mutation count, apply-failures.
- "Resync now" button on the dashboard stream-state pill (the `requestPreviewResync` pathway already exists at line 994).
- Mutations/second + bytes/second metrics; last-frame-at ticker; "Stream health" colour chip.

**Defer (v2+ — to v0.9.70+):**
- Geo heatmap (country-level only, requires k≥100 floor + Cloudflare CF-IPCountry).
- Real-time "agents running RIGHT NOW" ticker (1Hz SSE/WS) — current 5-min polling sufficient.
- Public documented `/api/stats/api` endpoint with versioning + `Cache-Control: public, max-age=300`.
- Granular per-field opt-out matrix (binary opt-out is simpler and harder to dark-pattern).
- i18n of the new control-panel MCP tab strings (see i18n Decision below).

**Anti-features (NEVER ship — categorical):**
- Third-party analytics SDKs: PostHog, Segment, Mixpanel, Datadog, Sentry, GA, Amplitude, LogRocket, Cloudflare Insights.
- Live-fetching pricing from `api.anthropic.com` / `api.openai.com` (leaks "FSB is installed on this IP" to providers).
- Per-call prompt/response bodies, URLs, page titles, clipboard contents, form values stored anywhere (telemetry OR local).
- Hardware fingerprinting fallback on opt-out (send NOTHING, not a "I opted out" ping).
- UUID sync across Chrome profiles via `chrome.storage.sync`.
- Cookie-based identity (`Set-Cookie` from telemetry endpoint).
- Storing plaintext IP anywhere on disk — request body, access log, error log, anywhere.
- Linking hashed IP to UUID in the same row (defeats salt rotation; use separate `telemetry_ips` table per-day).
- Server-side endpoint to query "what's in my UUID's table?" (write-only opt-out is the only inbound for a UUID).
- Pixel/screenshot streaming fallback in the dashboard (FSB stays DOM-mutation cloning per PROJECT.md Out-of-Scope).

### Architecture Approach (see ARCHITECTURE.md)

The pipeline is a **single-fact, two-consumer** design: the existing `dispatchMcpToolRoute` / `dispatchMcpMessageRoute` chokepoint at `extension/ws/mcp-tool-dispatcher.js:285-301` and `:303-331` is the ONLY place an MCP call can reach a route handler. A new `MCPMetricsRecorder.recordDispatch(...)` invoked in the `finally` block writes once to (a) `chrome.storage.local.fsbMcpUsageData` for the control-panel hero, and (b) an in-memory summary to `TelemetryCollector.enqueue()` for the outbound batch. One fact → two consumers → no double-count.

**Major components:**
1. **`extension/utils/install-identity.js`** — top of `importScripts` chain; `getOrCreateInstallUuid()` lazy-init mirrors `FSBAnalytics.initialize` pattern. Called from `chrome.runtime.onInstalled:13015` AND `onStartup:13051` (idempotent). Falls back to `null` if `chrome.storage.local` throws; `TelemetryCollector` becomes a no-op on null UUID.
2. **`extension/ai/mcp-pricing.js` (or `mcp/src/tools/pricing.ts`)** — pure data table + resolver. Independent of all storage.
3. **`extension/utils/mcp-metrics-recorder.js`** — function/prototype pattern (NOT ES class, for `importScripts` compat). Imported AFTER `analytics.js` and BEFORE `ws/mcp-bridge-client.js` in `background.js`. Writes to NEW key `chrome.storage.local.fsbMcpUsageData` (NOT mixed into existing `fsbUsageData`). Broadcasts `MCP_METRICS_UPDATE` mirroring `broadcastAnalyticsUpdate` at `background.js:11440`.
4. **`extension/utils/telemetry-collector.js`** — queue persistence in `chrome.storage.local.fsbTelemetryQueue` (200-event cap, drop-oldest FIFO). `chrome.alarms.create('fsb-telemetry-beat', { periodInMinutes: 5 })`. Per-event timestamps batched at **whole-minute resolution** (`tsMinute = Math.floor(Date.now() / 60000) * 60000`) to defeat sub-minute fingerprinting. 24h client-side drop of stale events.
5. **`showcase/server/src/utils/telemetry-hash.js` + `telemetry-salt.js`** — HMAC-SHA256, daily UTC salt in SQLite `telemetry_daily_salt` table (NOT env var, NOT JSON file — though ARCHITECTURE.md also suggested gitignored `data/salt.json` at 0600; STACK.md's SQLite-row pattern is preferred for multi-process Fly auto-scale).
6. **`showcase/server/src/middleware/telemetry-rate-limit.js`** — `express-rate-limit@^8.3.0` with custom `keyGenerator: req => hashIp(req.ip, db)`. 30 batches/min/IP-hash. `standardHeaders: 'draft-7'`, `legacyHeaders: false`.
7. **`showcase/server/src/db/schema.js` additions** — `telemetry_events` (raw, 7-day TTL, indexed on `ts_minute`, `install_uuid`, `ip_hash`), `telemetry_rollups_daily` (primary key `install_uuid, day, mcp_client, model`, 365-day TTL), `telemetry_global_aggregates` (one row per day, forever). In-memory `Map<install_uuid, last_seen_ts>` for "active users right now" (NOT SQLite — churns too fast).
8. **`showcase/server/src/routes/public-stats.js`** — NEW path `/api/public-stats/global` + `/global/series`. Mounted SEPARATELY from auth-gated `/api/stats/*`. ETag + 60s `Cache-Control` on `/global`, 5min on `/global/series`. In-process `Map` memo with 30s TTL for burst protection.
9. **`showcase/angular/src/app/core/stats/fsb-telemetry.service.ts`** — Angular consumer mirroring `github-stats.service.ts` exactly (`PLATFORM_ID` + `isPlatformBrowser` SSR gate, `BehaviorSubject<DatasetState<...>>` per dataset, visibility-aware polling at 5-min cadence).

### Critical Pitfalls (see PITFALLS.md)

**Three formal BLOCKERs that must land before v0.9.69 can be published to the Chrome Web Store:**

1. **`app.set('trust proxy', 1)`** MUST land in `server.js` immediately after `const app = express()` BEFORE any telemetry route is registered. Without this, `req.ip` returns the Fly.io proxy IP and ALL telemetry collapses into one synthetic user; the IP-hash rate-limiter becomes a single-bucket system; per-IP daily budgets are meaningless. This is the single most critical Express config item for the entire pipeline.
2. **`express-rate-limit@^8.3.0` minimum.** Versions < 8.0.2 / 8.1.1 / 8.2.2 / 8.3.0 are vulnerable to **CVE-2026-30827** (IPv4-mapped-IPv6 default-keyGenerator collision — all IPv4 traffic collapses into one rate-limit bucket on dual-stack hosts). Fly.io is dual-stack. Custom `keyGenerator` using `hashIp(req.ip, db)` required even on 8.3.0 so the rate-limiter and the storage layer see the same identifier and raw IP is never handed to the rate-limiter at all.
3. **Chrome Web Store listing copy + *Privacy practices* tab MUST update before publishing v0.9.69 to CWS.** Today's `store-assets/chrome-web-store/listing-copy.md` declares zero data collection. Publishing the v0.9.69 build without (a) ticking "Personally identifiable information" (the UUID is a regulated "identification number" under the CWS User Data FAQ), (b) providing a Privacy Policy URL covering the telemetry payload, retention, opt-out, and Limited Use compliance, and (c) ticking "Limited Use" certification is a direct policy violation. CI gate: `scripts/verify-store-listing.mjs` diffing declared categories vs `extension/telemetry/payload-schema.json`.

**Privacy-disaster antipattern list (code-review gate — 15 items):**

1. Telemetry collector NEVER touches `request.task`, `session.task`, `session.userMessage`, `conversationHistory`, `aiResponse`, or any user-typed text. Code review grep for `task / prompt / message / content / userMessage / messages` — ZERO matches.
2. Telemetry NEVER captures URLs. Grep `url / tab.url / window.location / document.URL / referrer / document.referrer` — ZERO matches.
3. Telemetry NEVER captures clipboard contents. Grep `clipboard / navigator.clipboard / chrome.clipboardWrite / execCommand('paste')` — ZERO matches.
4. Telemetry NEVER captures form values or DOM payloads. `collector.js` must not `import` from `content/dom-stream.js`, `dom-snapshot.js`, or any selector/DOM module. Grep `serializeDOM / domSnapshot / formData / input.value / .value / getElementsBy` — ZERO matches.
5. Server NEVER writes plaintext IP to any disk-backed log, table, or file. Grep `req.ip / req.connection.remoteAddress / req.headers['x-forwarded-for']` — must be wrapped in `hashIp()` immediately, raw value not retained beyond function scope.
6. Server NEVER logs the request body of `/api/telemetry/*` to disk. No `console.log(req.body)`, no `fs.appendFile`, no `morgan`/`winston`/`pino` that captures body on this route.
7. Daily IP salt MUST use `crypto.randomBytes(32)`; KEEP yesterday's salt for ~25 hours (clock-drift tolerance); destroy older.
8. UUID generation MUST be `crypto.randomUUID()`. NOT `Math.random()`, NOT `Date.now()`-based, NOT a hash-of-something. Stored in `chrome.storage.local`, NEVER `chrome.storage.sync` (would propagate across Chrome accounts and create cross-device linkability).
9. Opt-out toggle MUST immediately (a) set `telemetryEnabled=false`, (b) clear queue (`chrome.storage.local.set({ fsb_telemetry_queue_v1: [] })`), (c) cancel the flush alarm (`chrome.alarms.clear('fsb-telemetry-flush')`). DO NOT send a final "user opted out" event — that itself is a tracking event.
10. "Wipe my data" endpoint MUST always return 204 regardless of whether UUID had rows (no enumeration).
11. NO third-party CDN scripts on `/stats` — no Google Fonts (FOIT + IP leak), no Cloudflare Insights, no Plausible CDN, no Sentry browser SDK.
12. NEVER call `chrome.identity.getProfileUserInfo` — that's the user's Chrome account email.
13. NEVER broadcast telemetry payload over the existing `fsbWebSocket` relay — that's room-keyed to dashboard pairing. Use a SEPARATE HTTPS POST; never `fsbWebSocket.send('ext:telemetry-event', ...)`.
14. NEVER include FSB version strings with pre-release suffixes (`0.9.69-pr-foo`). Regex-strip to `MAJOR.MINOR.PATCH` at client before send.
15. Server MUST canonicalize MCP-client labels against the visual-session allowlist. A custom string "MyCustomMCPClient_v3_for_user_lakshman" goes straight to `/stats` — 400 reject anything off the allowlist.

**Top regulatory/operational risks beyond the BLOCKERs above:**
- GDPR Article 4(1) + Recital 30 treat a persistent UUID as personal data. ePrivacy Article 5(3) sets opt-IN default for non-essential storage in EU. Recommended posture: opt-out-by-default globally for v0.9.69 MVP, but build `consentDecisionAt` as a required precondition server-side (reject first-beat with `412 Precondition Required` if missing) so the architecture can tighten to opt-in per-locale via feature flag later without a schema migration.
- Correlation deanonymization risk: low-prevalence tuples like `(Codex client, GPT-5, 47k tokens, 14:23:01 UTC)` are quasi-identifiers. Defense: minute-rounded timestamps client-side, 1k-token-bucket rounding client-side, k≥5 anonymity floor on every public aggregate cell, NEVER log User-Agent / Accept-Language / any HTTP header into the telemetry table.
- Active-agent count is a behavioral fingerprint — a user routinely running 16 concurrent agents (cap up to 64 per v0.9.60) is rare. Bucket BEFORE send: `{0, 1, 2-4, 5-8, 9-16, 17-32, 33+}`.
- Install date fingerprint — round to week granularity in any aggregate that joins to activity.

### Dashboard Streaming — 7 Break-Point Hypotheses (unified rank from ARCHITECTURE §6.2 + PITFALLS §8.1)

Both files independently land on the same hypothesis cluster. Ranked by probability, this is the order the streaming-fix phase should validate. **DO NOT start by writing a patch.** Start by reproducing and capturing three logs simultaneously: server stdout (`handler.js:152, 156, 202`), extension `fsb_diagnostics_ring`, dashboard transport events.

| Rank | Hypothesis | What to check first | If confirmed, fix surface |
|---|---|---|---|
| **#1 (highest)** | **Pair-handshake / hashKey room mismatch.** The dashboard's hashKey differs from the extension's; both connect to the relay but land in different rooms. Server log line 202 shows `deliveredCount=0` for every extension→dashboard frame. | Server log: BOTH connect events must show the SAME `hashKey.substring(0,8)` prefix at `handler.js:152` and `:156`. | `server.js:241-262` upgrade pair-handshake; `authMiddleware(queries)` at `server.js:103-105`. |
| **#2** | **Stream-tab "not-ready" silent return.** `_handleDashboardStreamStart` (`ws-client.js:1029`) calls `_resolveStreamCandidate()` first; if not ready it emits `ext:stream-state {status:'not-ready'}` and returns WITHOUT calling `_forwardToContentScript`. Dashboard renders disconnected. The 300ms `setTimeout` after `chrome.scripting.executeScript` (`ws-client.js:1406`) is a heuristic, not a synchronization. | DevTools network: look for outbound `ext:stream-state` with `status: 'not-ready'` right after pressing wake. Watch for "Content script not ready on tab N — injecting and retrying domStreamStart" followed by "Failed to inject content script" OR no further log. | Replace 300ms `setTimeout` with a readiness ping: poll `chrome.tabs.sendMessage(tabId, {action:'pingDomStream'}, {frameId:0})` until success (5s overall timeout). Add `case 'pingDomStream':` handler in `dom-stream.js:971`. |
| **#3** | **`_forwardToContentScript` "no tab resolved" branch.** Lines 1359-1376 of ws-client.js: if neither `_streamingTabId` nor `_dashboardTaskTabId` is set, fallback `chrome.tabs.query({active:true})` runs but is famously unreliable from a service worker. Records `recordFSBTransportFailure('dom-forward-failed', {readyState:'no-tab'})` and silently returns. | `chrome.storage.local.fsbDiagnostics_ring` for `dom-forward-failed` entries (Phase 211 diagnostics ring). | Stop falling back to active-tab query from SW; require explicit `_streamingTabId` set during pair handshake. |
| **#4** | **`domStreamReady` ping not re-arming a pending intent.** `dom-stream.js:1063-1070` correctly signals `chrome.runtime.sendMessage({action:'domStreamReady'})` on module load. `background.js:6179-6184` handles it by forwarding `ext:dom-ready` to relay — but there is NO branch that re-arms a pending `dash:dom-stream-start` if one came in BEFORE the content script was ready. | If dashboard sends `dash:dom-stream-start` while tab is mid-navigation, the intent is lost; user must click "start streaming" again. | Track pending intent flag `_pendingStreamStart = true`; on `domStreamReady` arrival call `_handleDashboardStreamStart(lastPayload)` again; clear on success/explicit stop. |
| **#5** | **`ext:status` broadcast race.** `handler.js:158-163` broadcasts `ext:status {online:true}` when extension connects. If dashboard connects AFTER extension and the dashboard's `handleWSMessage` (component line 3411) isn't yet registered, `extensionOnline=false` persists, blocking `scheduleStreamRecovery` (component line 3425). | Order of "[WS] dashboard connected" vs "[WS] extension connected" in server stdout. | Relay should ALSO emit `dash:online` to the extension side when a dashboard joins (`handler.js:166-173` currently only notifies dashboards of `ext:status`). |
| **#6** | **LZ decompression failure on dashboard side.** Component line 3319-3325 silently returns on decompress-failure with only a transport-error record. Frame appears to never arrive. | Dashboard transport-event ring for `message-parse-failed` events with context `'parse'`. | Decompression branch should record an `ext:stream-state {status:'error', reason:'decompress'}` and surface in stream-state pill. |
| **#7 (lowest)** | **Stale-mutation auto-resync loop / `data-fsb-nid` selector drift.** Component lines 3144-3146 / 3162 / 3168 / 3175 trigger `requestPreviewResync` after 3 stale mutations. If iframe doc wiped between snapshot and mutation, every mutation goes stale and the resync request is dropped by 1-5 above. Also: if content-script side emits snapshot with different `data-fsb-nid` attribute than mutations, every patch fails. | Verify 1-5 are clean first. Then grep both `dom-stream.js` and `dashboard-page.component.ts` for `data-fsb-nid`. | Re-establish upstream chain first; this is downstream and self-heals when 1-5 work. |

**Also in scope (defensive bonuses found alongside the streaming fix):**
- `background.js:12942-12945` watchdog-alarm handler currently only `console.log`s — recommend: on watchdog fire, request a fresh `ext:snapshot` if `_streamingActive` is true.
- `server.js handler.js:74-80` `sendToClients` doesn't check `ws.bufferedAmount`. Add: skip send if `client.bufferedAmount > 16MB` and increment a `backpressure-dropped` counter.

### i18n Decision

The new control-panel "MCP" tab strings + `/stats` telemetry copy will eventually need i18n. **Recommend en-only for v0.9.69; defer formal extraction to v0.9.70.** Rationale:
- Control-panel surface (`extension/ui/control_panel.html`) is OUTSIDE `showcase/angular/` and is already excluded from the i18n pipeline per v0.9.63 closeout (`lint:i18n --ignore-pattern src/app/pages/dashboard/**` carry-forward).
- `/stats` IS covered by the Angular i18n pipeline — the new "FSB Telemetry" toggle group + aggregate labels need `i18n` markers. Two paths:
  1. **Conservative (recommended):** AI-fill 5 non-en locales (matching v0.9.63 pattern) in the same phase that ships `/stats`. ~20-30 new trans-units. Build-time `i18nMissingTranslation: error` will fail otherwise.
  2. **Feature-flag path:** wrap the whole FSB Telemetry block behind a locale check that only renders for `en`. Punts to v0.9.70.

**Caveat:** If GDPR opt-IN region-gating is implemented (Section 2.1 of PITFALLS), the first-run privacy banner MUST exist in all 6 supported locales OR EU users get an untranslated banner (arguably non-compliant under GDPR's "informed consent" requirement). The minimal path is a tiny `extension/i18n.js` using Chrome native `_locales/<lang>/messages.json` for the banner copy ONLY (1 paragraph + 1 button + 1 toggle label) — independent of the Angular i18n pipeline. **Decision deferred to REQUIREMENTS.md scoping** (Phase 269 or 275).

---

## Implications for Roadmap

Both ARCHITECTURE (proposed 8 phases, 269-276) and STACK (proposed 7 phases) align on the same dependency graph; PITFALLS confirms "streaming fix LAST" is the right ordering. The synthesized recommendation is **8 phases, 269-276**, continuing from the last shipped phase 268. The dashboard-stream fix is locked to phase 276 (final).

### Phase 269 — Install Identity + Opt-Out Scaffold
**Rationale:** UUID must exist before any consumer can reference it; opt-out scaffold must exist before any telemetry can fire. Foundation work; everything else depends on it.
**Delivers:** `extension/utils/install-identity.js` with `getOrCreateInstallUuid()` + `isTelemetryOptedOut()`. `importScripts` wiring at TOP of `background.js` dependency chain (before `analytics.js`). `chrome.runtime.onInstalled` + `onStartup` lazy mint. `chrome.storage.local` keys: `fsb_install_uuid`, `fsb_telemetry_opt_out`. Initial control-panel privacy section markup (toggle + "View what we send" placeholder).
**Addresses:** Anonymous Identity feature group; "UUID never sent to any third party" contract.
**Avoids:** PITFALLS 10.1 item 8 (UUID source) + item 9 (opt-out semantics). PITFALLS 4.1 storage-backed-not-memory pattern.
**Parallelism:** Can run in parallel with Phase 270 (pricing).

### Phase 270 — MCP Pricing Module (PARALLEL with 269)
**Rationale:** Pure data table, zero dependencies. Safest to land early so 271 has its resolver available.
**Delivers:** `extension/ai/mcp-pricing.js` (or `mcp/src/tools/pricing.ts`) with `MCP_MODEL_PRICING` table + `MCP_CLIENT_DEFAULT_MODEL` map (verbatim from the tables above). `PRICING_SOURCE_DATE = "2026-05-14"` constant. `estimate({ client, tool, tokensIn, tokensOut })` resolver returning `{cost, source, pricing_confidence}`. Fallback policy: `{cost: null, source: 'unknown'}` (NEVER throws, NEVER defaults to a model row for MCP).
**Addresses:** Pricing & Cost (MCP) feature group; `(client, model) → cost` lookup contract.
**Avoids:** No pitfall surface; provenance gate (every entry cites URL + date in code comment).
**Parallelism:** With 269. Both write to disjoint files.

### Phase 271 — MCPMetricsRecorder + Dispatcher Hooks + Control-Panel Hero Wiring
**Rationale:** Single fact-generation site (the `finally` block of `dispatchMcpToolRoute` / `dispatchMcpMessageRoute`) must land before the collector or the rendering can consume it.
**Delivers:** `extension/utils/mcp-metrics-recorder.js` (function/prototype pattern). `try/finally` wrappers in `mcp-tool-dispatcher.js:285-301` + `:303-331`. New `chrome.storage.local.fsbMcpUsageData` key (separate from `fsbUsageData`). `broadcastMcpMetricsUpdate` mirroring `broadcastAnalyticsUpdate:11440`. Control-panel: 4-card MCP analytics hero + per-client / per-tool tables + per-call log row stream (NO bodies, NO URLs) + 7-day token spark line.
**Addresses:** Control-Panel MCP Logging feature group.
**Avoids:** Privacy antipatterns 1-4 (no task/prompt/URL/clipboard/DOM). `extension/telemetry/payload-schema.json` allowlist locked here; CI gate `tests/telemetry-no-pii-leak.test.js` checks via static grep.
**Sequential after 269+270.**

### Phase 272 — TelemetryCollector + Alarm Scheduling + Queue Persistence
**Rationale:** The collector is the outbound boundary; must come after the recorder (271) and before the server ingest (273).
**Delivers:** `extension/utils/telemetry-collector.js`. `chrome.alarms.create('fsb-telemetry-beat', { periodInMinutes: 5 })` (LOCKED at 5 min). Queue in `chrome.storage.local.fsb_telemetry_queue_v1` (200-event cap, drop-oldest FIFO). Minute-resolution timestamps client-side (`tsMinute = Math.floor(Date.now() / 60000) * 60000`). 24h stale-event drop at queue-load. `enqueue / flush / reenqueue` with serialized `queueLock` Promise chain. `fetch(..., {keepalive: true})`. Client-side `event_id = crypto.randomUUID()` for server-side dedupe. Skip-beat-when-empty. Re-read `fsb_telemetry_opt_out` on every flush (do not cache). Jittered 5min + uniform(0,30s) to avoid synchronized hammer. First beat fires `install_announce` event on `onInstalled` after a 30s idle grace.
**Addresses:** Anonymous Identity + Telemetry Beat feature groups.
**Avoids:** PITFALLS 4.1 (in-memory queue loss on SW eviction), 4.2 (reliable flush triggers), 4.3 (event_id dedupe; alarm re-arm in `onInstalled`).
**Sequential after 271.**

### Phase 273 — Server Schema + Telemetry Routes + Salt Rotator + Rate Limiter + Housekeeper
**Rationale:** The biggest single phase. Must land all server-side primitives together because they are interlocked: rate-limiter needs IP-hash, IP-hash needs salt, salt needs the daily salt table, route needs all of the above. **THIS IS WHERE THE 3 BLOCKERs LIVE.**
**Delivers:**
  - **BLOCKER #1:** `app.set('trust proxy', 1)` in `server.js` immediately after `const app = express()`, BEFORE any route mount.
  - **BLOCKER #2:** `npm install express-rate-limit@^8.3.0` in `showcase/server/`; custom `keyGenerator` = `hashIp(req.ip, db)`.
  - `showcase/server/src/utils/telemetry-hash.js` (HMAC-SHA256 + daily salt).
  - `showcase/server/src/utils/telemetry-salt.js` (lazy UTC-daily rotation, SQLite-row storage, cleanup of pre-yesterday salts).
  - `showcase/server/src/middleware/telemetry-rate-limit.js` (30 batches/min/IP-hash).
  - `showcase/server/src/db/schema.js` additions: `telemetry_events`, `telemetry_rollups_daily`, `telemetry_global_aggregates`, `telemetry_daily_salt`. WAL mode + `synchronous=NORMAL` + `busy_timeout=5000` + `cache_size=-64000` + `temp_store=MEMORY` + `mmap_size=30000000000` PRAGMAs on every new Database() connection.
  - `showcase/server/src/routes/telemetry.js`: `POST /api/telemetry/events` (32KB body limit, 50-event batch cap, schema strict-validate, `INSERT OR IGNORE` on UNIQUE `event_id`, drop on `ts > now+5min` OR `< now-7d`, reject incognito-flagged events, daily 1000-event/UUID budget per `install_uuid`), `POST /api/telemetry/optout` (write-only, returns `{deleted: N}`, always 204 on miss).
  - `showcase/server/src/telemetry/housekeeper.js` setInterval(1h): delete `telemetry_events` older than 7d, re-aggregate today + yesterday in `telemetry_rollups_daily`, recompute `telemetry_global_aggregates`, lazy salt rotation.
  - Sec-GPC `1` header → silently drop with 204 (future-safe for California AB 566).
  - Server-side payload allowlist: `event_id, install_uuid, ts_minute, mcp_client, model, tokens_in, tokens_out, active_agent_count, event_type`. Reject ANY extra field with `400 unknown_field`.
  - In-memory `Map<install_uuid, last_seen_ts>` for active-users-now (NOT SQLite).
**Addresses:** Server Ingest feature group; all 8 aggregate definitions seeded.
**Avoids:** PITFALLS 5.1 (DoS), 5.2 (replay via UNIQUE event_id), 5.3 (disk fill), 6.1 (pragma), 6.2 (prepared stmt + transaction), 10.1 items 5-7 (IP hashing + salt).
**Sequential after 272.**

### Phase 274 — Public Aggregates Endpoint + FSBTelemetryService Angular + `/stats` Toggle Group
**Rationale:** Now that data exists server-side, expose it. Must come before banner polish (275) so the "View what we send" panel can render real data.
**Delivers:**
  - `showcase/server/src/routes/public-stats.js`: `GET /api/public-stats/global` + `/global/series`. Mounted SEPARATELY from auth-gated `/api/stats/*`. ETag + 60s `Cache-Control` on `/global`, 5min on `/global/series`. In-process `Map` memo with 30s TTL. k≥5 anonymity floor on `popular_agents` + `popular_mcp_clients`; below-k bucketed as "Other (N=...)".
  - `showcase/angular/src/app/core/stats/fsb-telemetry.service.ts` mirroring `github-stats.service.ts` exactly (`PLATFORM_ID`, `BehaviorSubject<DatasetState<...>>`, visibility-aware 5-min polling).
  - `showcase/angular/src/app/pages/stats/stats-page.component.ts`: append 6 toggle entries (`fsb-active-now`, `fsb-tokens`, `fsb-agents-running`, `fsb-popular-agents`, `fsb-popular-mcp`, `fsb-avg-agents-per-user`). "FSB Telemetry" section header. Headline numbers row above chart (`active right now: N · total users: N · tokens 24h: NM`). Update `stats-foot` copy to mention "GitHub data + anonymous FSB usage telemetry". Preserve existing `<meta name="robots" content="noindex, nofollow">`.
  - i18n: 20-30 new trans-units AI-filled across the 5 non-en locales (`lint:i18n` + `i18nMissingTranslation: error` will fail otherwise).
**Addresses:** Aggregations + /stats Surface feature groups.
**Avoids:** PITFALLS 3.1 (k-anonymity floor enforced in SQL `HAVING COUNT(DISTINCT install_uuid) >= 5`), 3.2 (active-agent bucketing), 3.3 (install-date weekly rounding), 7.1 (rolling counter via `telemetry_rollups_daily` UPSERT in the same transaction), 7.2 (server-side in-process cache with 30s TTL + client-side jitter), 7.3 (5-min active-now window locked).
**Sequential after 273.**

### Phase 275 — First-Run Privacy Banner + Opt-Out UX Polish + Listing Copy + Privacy Policy + Integration Smoke
**Rationale:** **BLOCKER #3 lives here.** All consent/disclosure surfaces ship together so the release tag isn't gated on a hanging legal review.
**Delivers:**
  - First-run privacy banner in `extension/ui/control_panel.html` Privacy & Telemetry section (top-level, NOT under Debug). Drop-in copy block from FEATURES.md §Privacy/Consent UX.
  - "View what we send" live JSON preview panel rendering the NEXT beat's exact payload.
  - "Reset anonymous ID" button (rotates local UUID + `POST /api/telemetry/optout` for old UUID).
  - "Stop sending data" master switch with immediate effect (sync: clear alarm + queue + opt-out POST).
  - "Wipe my telemetry data" button → `POST /api/telemetry/forget` with `{uuid}`; always 204 (no enumeration).
  - **Updated `store-assets/chrome-web-store/listing-copy.md`** with Data Collection section covering: UUID-per-install (not PII like name/email), MCP client label, model name, token counts, active-agent count, hashed IP server-side, opt-out toggle.
  - **CWS Developer Dashboard "Privacy practices" tab updates** (manual; archived as screenshot in `.planning/milestones/v0.9.69-RELEASE-EVIDENCE.md`): tick "Personally identifiable information" (UUID), do NOT tick "Web history" (no URL logging), provide Privacy Policy URL, tick "Limited Use" certification.
  - **Updated `full-selfbrowsing.com/privacy`** with: identity & contact, categories collected, NOT collected, legal basis (Article 6(1)(f) legitimate interest), retention period, right to access/erasure/portability/objection, cross-border transfer disclosure (Fly.io regions), Limited Use affirmation, CCPA non-sale statement, stable `#telemetry-disclosure` anchor.
  - CI gates: `scripts/verify-store-listing.mjs`, `tests/showcase-privacy-page.test.js` (200 + literal "FSB Telemetry" present), `tests/telemetry-payload-schema.test.js`, `tests/telemetry-k-anonymity.test.js`, `tests/telemetry-queue-persistence.test.js`, `tests/telemetry-event-id-uniqueness.test.js`, `tests/telemetry-rate-limit.test.js`, `tests/telemetry-no-pii-leak.test.js`, `tests/showcase-stats-cache.test.js`.
**Addresses:** Privacy / Consent UX feature group; CWS + GDPR + CCPA compliance.
**Avoids:** PITFALLS 1.1-1.3 (CWS policy), 2.1-2.3 (GDPR/CCPA), 10.1 items 9-10 (opt-out & forget semantics), 10.2 items 11-15.
**Sequential after 274.**

### Phase 276 — Dashboard DOM-Streaming Diagnostic + Fix (LAST per milestone constraint)
**Rationale:** Independent of the telemetry pipeline. User wants the streaming fix LAST so all the telemetry work isn't gated on a tricky live debug. ARCHITECTURE + PITFALLS independently confirm this ordering.
**Delivers:** Pure diagnosis FIRST. Reproduce + capture three logs (server stdout `handler.js:152, 156, 202`, extension `fsb_diagnostics_ring`, dashboard transport events). Walk the 7-hypothesis chain in rank order. Land the minimum patch for whichever hypothesis confirms. Bonus defensives (low-risk, may include depending on time): watchdog-alarm handler at `background.js:12942-12945` to actually request fresh snapshot when `_streamingActive`; `handler.js:74-80` `sendToClients` to skip when `client.bufferedAmount > 16MB` with `backpressure-dropped` counter. New diagnostic surfaces: stream-state pill tooltip (`last-frame ago`, mutations applied, stale-mutation count, apply-failures), "Resync now" button (the `requestPreviewResync` pathway at line 994 already supports it).
**Addresses:** Dashboard Streaming Fix feature group.
**Avoids:** PITFALLS 8.1 (failure mode A/B/C diagnosis pre-patch), 8.2 (WS bug gates), 8.3 (regression-source phase review).
**Sequential, MUST BE LAST.**

### Phase Ordering Rationale

- **269 + 270 in parallel** (install-identity + pricing-module) — disjoint files, no shared writes.
- **271 sequential after both** — needs the UUID (269) for recorder identity and the pricing module (270) for cost-column rendering.
- **272 sequential after 271** — needs the recorder to enqueue from.
- **273 sequential after 272** — server can't validate beats it has no shape contract for.
- **274 sequential after 273** — Angular service can't poll an endpoint that doesn't exist.
- **275 sequential after 274** — "View what we send" panel needs real data; listing copy diff needs locked schema.
- **276 LAST** — explicit milestone constraint; also independent dependency-wise.

### Research Flags

**Phases that need deeper research during planning (gsd-research-phase candidates):**

- **Phase 273 (Server schema + routes + salt + rate-limit + housekeeper)** — biggest single phase, most BLOCKERs concentrated. Worth a phase-level research pass to lock: (a) exact `trust proxy` value for Fly.io chain depth (1 vs 'loopback, linklocal, uniquelocal'), (b) whether existing `morgan` / access logging already captures `req.ip` (audit + redact pre-route), (c) Fly.io disk volume size + 90-day retention sizing, (d) salt storage final decision (SQLite row vs `data/salt.json` 0600 — ARCHITECTURE and STACK disagree slightly; lock during planning).
- **Phase 276 (Dashboard streaming fix)** — diagnostic-first. CONTEXT.md must explicitly plan to defer scope until step 1-2 of the inspection chain confirms which hypothesis. The 7-rank list is hypotheses, not solutions; fix surface only knowable post-repro.
- **Phase 275 (Privacy banner + CWS listing)** — legal copy review needed. Banner copy in FEATURES.md is a strong draft but the `/privacy` page additions should be reviewed against current EU/CA case law (last verified 2026-05-14; nothing imminent on the horizon).

**Phases with standard patterns (skip phase-level research, just write CONTEXT.md):**

- **Phase 269** — straightforward storage init + alarms; pattern already used by `MCPBridgeClient._scheduleReconnectAlarm`.
- **Phase 270** — pure data table; just transcribe the tables in this SUMMARY.md.
- **Phase 271** — mirror existing `FSBAnalytics` + `broadcastAnalyticsUpdate` pattern; the `try/finally` chokepoint is already-mapped (`mcp-tool-dispatcher.js:285-331`).
- **Phase 272** — mirror existing `MCP_RECONNECT_ALARM` pattern from `mcp-bridge-client.js:291-303`.
- **Phase 274** — exact mirror of `GitHubStatsService` skeleton; just instantiate for the new endpoint.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All deps already validated in prior milestones; only NEW production add is `express-rate-limit@^8.3.0` with primary-source CVE rationale |
| Anthropic / Gemini / xAI / DeepSeek pricing | **HIGH** | Live-fetched from primary docs 2026-05-14 |
| OpenAI pricing (GPT-5 / GPT-5-mini) | **HIGH** | platform.openai.com 403s WebFetch; OpenRouter mirror + 2 independent sources agree to the cent |
| OpenAI pricing (GPT-5.x family) | **MEDIUM** | Single-tier verification only (IntuitionLabs, The Register) |
| Grok pricing >200k tier | **MEDIUM** | docs.x.ai acknowledges tiered pricing at 200k but does not publish the upper rate; TODO-flag for refresh |
| Client default-model mapping | **HIGH** for Claude/Codex/Antigravity/OpenClaw/Grok; **MEDIUM** for Perplexity/ChatGPT/Gemini; **LOW** for Windsurf/Cursor/OpenCode/Hermes (router-based) |
| Features | **HIGH** for table-stakes (Plausible, Umami, GoatCounter, Homebrew, Next.js, Astro, Mozilla — 7+ independent OSS analytics products corroborate); **MEDIUM-HIGH** for specific numeric windows (anchored to 1-3 named sources each, locked in this SUMMARY) |
| Architecture | **HIGH** — every integration point line-numbered from codebase walk; no inferred surface |
| Pitfalls (regulatory) | **HIGH** — CWS User Data FAQ + GDPR Recital 30 + CCPA + ePrivacy 5(3) primary-sourced |
| Pitfalls (SQLite / better-sqlite3) | **HIGH** — primary docs |
| Pitfalls (streaming diagnosis) | **MEDIUM** — code-reading only, NOT verified at runtime. 7-hypothesis ranking is plausible but unconfirmed; phase 276 must repro before patching |

**Overall confidence:** **HIGH** for shipping the telemetry pipeline; **MEDIUM** for the dashboard-stream fix scope (knowable only post-diagnostic).

### Gaps to Address

1. **Salt storage final decision** — STACK.md recommends SQLite row (multi-process Fly auto-scale); ARCHITECTURE.md recommends gitignored `data/salt.json` at 0600. Lock during Phase 273 CONTEXT.md. SQLite row is preferred (audit-friendly, no env-rotation churn, future-proof against multi-instance), but document the call.
2. **`run_task` token-harvest path** — ARCHITECTURE §9 Q3: result envelope from `dispatchMcpToolRoute({tool:'run_task'})` ultimately resolves through `automationComplete` message details. Exact path to `tokensIn`/`tokensOut` needs verification during Phase 271 CONTEXT.md.
3. **Backpressure baseline** — is `ws.bufferedAmount` ever observed > 0 in production? If yes, the relay needs an explicit backpressure-drop policy in Phase 276; if no, defer the bonus to v0.9.70.
4. **GDPR opt-IN region-gate** — recommended posture: build `consentDecisionAt` precondition into the server schema in Phase 273 so we CAN tighten later, but ship v0.9.69 as opt-out-default-on globally with banner gate. EU enforcement risk is real but acceptable for MVP IF the banner is genuinely prominent. Locale-specific `412 Precondition Required` behavior is a Phase 275 decision.
5. **Existing `morgan` / access log audit** — Phase 273 MUST verify `showcase/server/` access logging does NOT already capture `req.ip` or POST bodies on telemetry routes. If `morgan` is present, redact `/api/telemetry/*` paths explicitly.
6. **OpenAI 5.x family pricing freshness** — MEDIUM-confidence rows for GPT-5.1 / 5.2 / 5.4 / 5.5 carry single-tier verification. Worth one more cross-check at Phase 270 ship.
7. **DeepSeek V4-Pro promo expiry 2026-05-31** — refresh table BEFORE the promo ends; embed a sentinel comment in `mcp-pricing.js`.

---

## Sources

### Primary (HIGH confidence)

**Pricing (verified live 2026-05-14):**
- [Claude API Pricing (platform.claude.com)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Gemini API Pricing (ai.google.dev)](https://ai.google.dev/gemini-api/docs/pricing)
- [xAI Grok Models (docs.x.ai)](https://docs.x.ai/developers/models)
- [DeepSeek Pricing (api-docs.deepseek.com)](https://api-docs.deepseek.com/quick_start/pricing)
- [OpenRouter GPT-5](https://openrouter.ai/openai/gpt-5) + [GPT-5 mini](https://openrouter.ai/openai/gpt-5-mini) — primary mirror for platform.openai.com (403 to WebFetch)

**MCP client defaults:**
- [OpenAI Codex Models](https://developers.openai.com/codex/models) — Codex CLI default = GPT-5.5
- [Claude Code Model Config](https://code.claude.com/docs/en/model-config) — Claude Code default = Opus 4.7 (April 23, 2026)
- [Antigravity / Gemini CLI (Google Cloud Blog)](https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli)
- [OpenClaw / Claude Sonnet 4.6 (haimaker.ai)](https://haimaker.ai/blog/claude-sonnet-4-6-openclaw/)

**Stack & security:**
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [MDN Crypto.randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- [express-rate-limit CVE-2026-30827 advisory](https://advisories.gitlab.com/pkg/npm/express-rate-limit/CVE-2026-30827/)
- [GHSA-46wh-pxpv-q5gq](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-46wh-pxpv-q5gq) — fixed-version list
- [Chrome MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md)
- [SQLite WAL mode performance considerations](https://www.sqlite.org/wal.html#performance_considerations)

**Privacy / regulatory:**
- [Chrome Web Store User Data Policy & FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store Limited Use Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [GDPR Article 4 (definitions)](https://gdpr-info.eu/art-4-gdpr/)
- [GDPR Recital 30 (online identifiers)](https://gdpr-info.eu/recitals/no-30/)
- [CCPA — California Attorney General overview](https://oag.ca.gov/privacy/ccpa)
- [Plausible Data Policy](https://plausible.io/data-policy) — canonical daily-rotated salt + SHA-256 pattern
- [Fathom anonymization writeup](https://usefathom.com/blog/anonymization)
- [Litlyx Data Policy](https://litlyx.com/data-policy)

**Analytics feature precedents:**
- [Plausible Realtime dashboard](https://plausible.io/docs/realtime-dashboard) — 5-min "current visitors" precedent
- [Homebrew Anonymous Analytics](https://docs.brew.sh/Analytics) + [public stats](https://formulae.brew.sh/analytics/) — install-count methodology
- [Next.js Telemetry](https://nextjs.org/telemetry) — allowlist-only payload + `NEXT_TELEMETRY_DEBUG=1` "view what we send" precedent
- [Astro Telemetry](https://astro.build/telemetry/) — CLI opt-out + uninstall-rotates-UUID
- [Mozilla Firefox Telemetry source docs](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/)
- [Apache Airflow Zombie task threshold](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html) — 2-beat-cycle staleness pattern

### Secondary (MEDIUM confidence; multi-source cross-checked)

- [BenchLM Claude Pricing (April 2026)](https://benchlm.ai/blog/posts/claude-api-pricing) — cross-check
- [MetaCTO Claude API Pricing (May 12, 2026)](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [IntuitionLabs AI API Pricing Comparison (Feb 28, 2026)](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [The Register: GPT-5.5 cost analysis (2026-05-08)](https://www.theregister.com/ai-and-ml/2026/05/08/gpt-55-may-burn-fewer-tokens-but-it-always-burns-more-cash/5237498)
- [DevTk 2026 OpenAI Pricing Guide](https://devtk.ai/en/blog/openai-api-pricing-guide-2026/)
- [mem0 xAI Grok API Pricing (March 5, 2026)](https://mem0.ai/blog/xai-grok-api-pricing)
- [Cursor Available Models](https://cursor.com/help/models-and-usage/available-models)
- [OpenCode Config docs](https://opencode.ai/docs/config/)
- [Perplexity Changelog Feb 6, 2026](https://www.perplexity.ai/changelog/what-we-shipped---february-6th-2026)
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)
- [Browserbase Live View documentation](https://docs.browserbase.com/features/session-live-view) — vendor-doc precedent for stream-state UX
- [browserless.io watching sessions](https://docs.browserless.io/enterprise/watching-sessions)
- [WP Statistics — Daily salt IP hashing](https://wp-statistics.com/2024/02/enhancing-privacy-with-our-updated-ip-hashing-mechanism/)
- [Privacy-Preserving Anonymization (arXiv:2507.21904)](https://arxiv.org/abs/2507.21904)
- [k-anonymity overview — Wikipedia](https://en.wikipedia.org/wiki/K-anonymity) — k≥5 threshold rationale
- [ePrivacy Directive (EU Cookie Law)](https://en.wikipedia.org/wiki/EPrivacy_Directive) — opt-IN default discussion
- [Cube DAU/WAU/MAU recipe](https://cube.dev/docs/product/data-modeling/recipes/active-users)
- [Storybook telemetry docs](https://storybook.js.org/docs/configure/telemetry)
- [Firefox Extension Workshop user-data-consents best practices](https://extensionworkshop.com/documentation/develop/best-practices-for-collecting-user-data-consents/)
- [phiresky SQLite performance tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)

### Tertiary (LOW confidence; needs validation during planning)

- Streaming-bug diagnosis (PITFALLS §8.1 / ARCHITECTURE §6.2) — code-reading only; phase 276 MUST repro before patching.
- Grok 4.3 >200k upper-tier pricing — acknowledged-but-unpublished on docs.x.ai; flag for xAI direct contact OR conservative `pricing_confidence: "estimated"` row.
- ePrivacy Article 5(3) opt-IN-default applicability to MV3 storage of an analytics UUID — recommend independent counsel review before EU regional rollout (not a v0.9.69 blocker because v0.9.69 ships globally opt-out-default with consent gate).

---

*Research completed: 2026-05-14*
*Ready for REQUIREMENTS.md + ROADMAP.md: yes*
*Phases proposed: 269-276 (8 phases, dashboard-stream fix LOCKED at 276)*
*Parallel opportunities: 269 ∥ 270*
*BLOCKERs gating release: 3 (trust-proxy, express-rate-limit@^8.3.0, CWS listing + Privacy Practices tab)*
```