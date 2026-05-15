# Feature Research — v0.9.69 Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix

**Domain:** Privacy-preserving anonymous telemetry for a Chrome extension + local MCP server, public aggregate dashboard on a marketing site, remote-browser live-preview UX.
**Researched:** 2026-05-14
**Milestone:** v0.9.69
**Confidence:** HIGH for table-stakes metrics and consent patterns (Plausible, Umami, GoatCounter, Homebrew, Next.js, Astro, Mozilla all corroborate independently); MEDIUM-HIGH for specific time-window thresholds (anchored to 1-3 named sources each); MEDIUM for the dashboard-streaming UX recommendation (Browserbase Live View + browserless config are the only widely-documented analogues — vendor docs, not academic consensus).

---

## Scope Note (read first)

This file maps the **feature landscape for v0.9.69 only**. Items already shipped in earlier milestones are explicitly excluded:

- AI-provider analytics hero in `extension/ui/control_panel.html` (lines 104-134) — **already ships** the "Total Tokens / Total Cost / Requests / Success Rate" cards plus cost-breakdown. MCP traffic is NOT counted there today; that gap is the entire point of the new Control-Panel MCP Logging capability.
- `extension/utils/analytics.js` `pricing` table — already exists for AI-provider models. The new `MODEL_PRICING` module researched here is the **MCP-client-defaults** lookup (Claude Code -> Sonnet 4.6, Codex -> GPT-5, etc.), which is a separate concern.
- `/stats` Easter-egg page (`showcase/angular/src/app/pages/stats/stats-page.component.ts`) — already ships with 7 GitHub-driven chart views (`stars-cumulative`, `stars-weekly`, `issues-open-vs-closed`, `forks-growth`, `prs-opened-vs-merged`, `commits-over-time`, `maintenance`). New FSB Telemetry views slot in as **additional toggle entries** alongside the 7 existing views, reusing the same 5-min visibility-aware polling primitive, `view-switcher` tablist, `chart-card[data-state]` skeleton/ready/rate-limited/error pattern, and Chart.js dynamic-import lazy-load contract.
- Dashboard surface (`showcase/angular/src/app/pages/dashboard/dashboard-page.component.{ts,html}`) — UI shell, login/pairing, task progress view, stats bar, deprecated-agents card all already ship. The **DOM-streaming pipe is broken** (`dash:dom-stream-*` WS messages, `ext:dom-mutations` apply, `staleMutationCount`/`mutationApplyFailures` resync triggers); the fix lives in Phase N of this milestone — the feature itself isn't new.

Privacy-impact notes are inline per feature. Numeric time windows have a single-source rationale anchored to a named precedent.

---

## Capability Group: Pricing & Cost (MCP)

The existing `extension/utils/analytics.js#pricing` table only contains models — it does not know which **MCP client** maps to which default model. Claude Code, Codex, Cursor, Continue, etc. each have a typical-user default that costs differ on. v0.9.69 needs a separate `MODEL_PRICING` lookup keyed by `(mcp_client, model)` so the control panel and server-side ingest can both compute a defensible cost figure when the MCP call doesn't carry an explicit model field.

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **`MODEL_PRICING` table** keyed `(client, model) -> {input, output, currency: 'USD', source_url, fetched_at}` covering Claude Code (Sonnet 4.6 default), Codex (GPT-5 default), Cursor, Continue, OpenClaw, Claude Desktop, Windsurf, Roo Code, Cline, manual `http://localhost:3030/mcp` callers | Cost numbers on the existing hero card are meaningless if MCP traffic is unpriced; today the hero already promises "Total Cost" so an unpriced MCP call shipping into that hero would silently zero the cost figure | Low | None — static module shipped with the extension binary. Source URLs (Anthropic pricing page, OpenAI pricing page, etc.) are stamped at build time and a comment per row says "verified 2026-05-14". |
| **Per-client default-model assumption** when the MCP `tools/call` payload doesn't carry an explicit `model` field (which is the common case — most MCP hosts don't pass model metadata down) | Without a default-model fallback, every cost figure for callers that don't volunteer a model would be `$0.00`, which is worse than approximate. | Low | None |
| **`source_url` + `fetched_at` per row** so the user can audit where the number came from | OSS norm — Plausible/Astro/Homebrew all stamp data provenance | Low | None |
| **Version-bump-updateable** (table is hardcoded in source, no live fetch) | Live pricing fetches would be a network call from the service worker, hostile to MV3 lifecycle, and could leak the user's UUID into Anthropic/OpenAI server logs | Low | Strong — no outbound traffic to AI providers from the extension just to refresh pricing |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **"Cost is approximate" hover tooltip** on every cost figure, explaining the default-model assumption and linking to `chrome-extension://.../control-panel.html#mcp-pricing` | Real cost depends on the actual model the MCP client routed to, which FSB can't observe. Tooltip prevents users from interpreting the figure as billable truth. | Low | None |
| **Manual "override default model for this client" picker** in the MCP section of the control panel (per-row dropdown next to each MCP-client identity) | Power users who route Claude Code to Opus 4.6 or Codex to GPT-5-mini will see numbers off by 5x without an override. | Medium | None — stored in `chrome.storage.local`, never sent server-side. |
| **Per-row "last verified" badge** that yellow-highlights when `fetched_at` is older than the extension build date by more than 60 days | Pricing drifts. A visible staleness signal forces a maintainer pricing-refresh PR before users see badly stale numbers. | Low | None |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| Live-fetching pricing from `api.anthropic.com` / `api.openai.com` / etc. | Outbound network from the SW just to look up pricing is gratuitous traffic and leaks "FSB is installed on this IP" to AI providers even when the user hasn't sent them a real request yet. | Hardcoded table, refreshed by version bump only. |
| Pulling pricing from a third-party aggregator API (e.g. OpenRouter price feeds) | Adds runtime dependency, third-party uptime risk, third-party-can-watch-FSB-installs telemetry. | Same — hardcoded. |
| Charging the user (or even displaying as if charging) cost for **local LM Studio / Ollama** rows | These are zero-cost-per-token; pretending otherwise is misleading. | Render `local` instead of `$0.00` for the cost column and skip the row from the "Total Cost" sum. |

---

## Capability Group: Control-Panel MCP Logging (extension-local, user sees their OWN usage)

This is the **per-user surface** in the extension control panel. It sits in a new section (recommended placement: between the existing "Dashboard" section and the "API Configuration" section, or as a subsection inside the Dashboard analytics-hero region). It is NOT the global aggregate — that lives on `/stats`.

The reference UI pattern in `control_panel.html` is the existing **analytics-hero card grid + chart-section combo** (lines 104-151). The new MCP section should mirror that pattern visually: hero metric cards on top, time-bucketed chart below, optional row-by-row breakdown table at the bottom.

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **MCP analytics hero** with 4 cards mirroring the existing AI analytics hero: `MCP Calls (total)`, `MCP Tokens (total)`, `MCP Cost (approx)`, `Top Client (24h)` | Visual symmetry with the existing hero. Users already know how to read the hero; no relearning. | Low | None — all data is local-only `chrome.storage.local` until the user opts INTO outbound telemetry separately. |
| **Per-MCP-client breakdown table** (one row per distinct `client` label seen, columns: `Client`, `Calls (24h / 7d / all)`, `Tokens (24h / 7d / all)`, `Cost (24h / 7d / all)`, `Last seen`) | Users with multiple MCP hosts (Claude Code + Codex) want to know which host costs them more. Plausible's "Top Sources" panel is the precedent — same shape, same density. | Medium | None — local only. |
| **Per-tool-name breakdown table** (one row per distinct `tool` name seen, columns: `Tool`, `Calls`, `Avg tokens/call`, `Last used`) covering `click`, `navigate`, `type_text`, `read_page`, `get_dom_snapshot`, `run_task`, `back`, `open_tab`, `list_tabs`, `switch_tab`, etc. | The existing extension already routes all MCP tools through a single dispatcher (`dispatchMcpToolRoute`); the per-tool counter is one `+= 1` in that path and is enormously useful for the user to see which tools their AI host actually uses. | Low | None — local only. |
| **Per-call log row stream** (most-recent-N table, default N=200, capped at 1000, columns: `Timestamp`, `Client`, `Tool`, `Tokens in`, `Tokens out`, `Cost`, `Status`) | Existing control panel already has a Sessions log table pattern at line 1020; mirror that. Users need a primary key to debug "why is my cost spiking?" | Medium | None — local only. Stored in `chrome.storage.local` ring buffer matching the existing `fsb_diagnostics_ring` convention (FIFO 100-1000 entries). |
| **Daily token-usage spark line** (last 7 days, one bar per day, MCP-tokens-only) above the per-MCP-client table | Symmetric with the existing `Token Usage Over Time` chart (line 137-151 in `control_panel.html`) but scoped to MCP traffic. | Low | None — local only. |
| **"Clear MCP Logs" debug button** in the same debug-controls strip at lines 1039-1056 of `control_panel.html` | The control panel already has `Clear Analytics Data`; mirror the convention. GDPR-defensible "user controls their local data." | Low | Strengthens privacy story. |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Weekly trend chip** next to each per-client / per-tool row: arrow up/down with % delta vs the prior 7-day window | Matches GoatCounter and Umami's "trend" indicators — table cells with a tiny green arrow + delta. Cheap to compute from the same ring buffer. | Low | None |
| **Click-through filter** — clicking a row in the per-MCP-client table filters the per-call log row stream to that client | Standard analytics drill-down. Two-line JS change given a single table component. | Low | None |
| **Export MCP Logs (JSON)** debug button next to "Clear" | Symmetric with the existing `Export Data` button at line 1052; gives users a way to take their data with them, a non-negotiable for transparency-first products | Low | Strengthens privacy story. |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| Per-call **prompt/response bodies** stored anywhere | Prompts contain user URLs, page contents, credentials in some flows — never store them. | Store only `(timestamp, client, tool, tokens_in, tokens_out, cost, status_code, error_class)`. No bodies. Period. |
| Per-call **target URL or page title** | Same — URL is PII-adjacent (which sites the user visits). | Store nothing about the page. The user knows what they did; FSB doesn't need to remind them. |
| **Pre-populated "Test MCP call" button that sends a real call to api.anthropic.com / api.openai.com** | Would charge the user real money on test click. | If a test affordance is needed at all, use a no-op `ping` tool that round-trips through the local MCP bridge only. |
| Server-side mirror of the per-call log (i.e. shipping the full call log to `showcase/server/` as part of the telemetry beat) | Per-call detail at user-call granularity is high-resolution PII even when stripped of bodies. | Server only ever sees the **aggregated counters** in the telemetry beat. Per-call detail stays local. |

---

## Capability Group: Anonymous Identity (the UUID, on-device)

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **UUIDv4 minted on first run**, persisted in `chrome.storage.local` under a single well-known key (suggest `fsb_telemetry_uuid`) | Every analyzed precedent (Next.js, Astro, Homebrew, Vue CLI, Storybook, .NET CLI) mints a per-install UUID. Required to deduplicate aggregates (otherwise "active users" is uncountable). | Low | UUIDv4 from `crypto.randomUUID()` carries 122 bits of entropy and is **not** derived from machine state, MAC, or hardware — therefore not a hardware fingerprint, therefore not PII under any meaningful read of GDPR Recital 26. |
| **No PII fields ever in the payload** — strictly allowlisted: `{uuid, tokens_used, active_agents, mcp_client_label, model, agent_name_set?}`. Anything not on the allowlist is silently dropped at the collector boundary. | Allowlist-not-blocklist is the only safe boundary because it survives developer mistakes; a blocklist of "things not to send" breaks the day someone adds a new field. | Low | This is the privacy contract. |
| **UUID never sent to any third party** (Google, AI providers, Sentry, anything except `showcase/server/`) | First-party-only is the contract. | Low | Strong |
| **Manual UUID rotation button** in the control panel privacy section (recommended copy: "Reset anonymous ID — your past data stays on our server but new data won't be linked to it") | This is the *de facto* GDPR Article 17 response for an anonymous-by-design system. See "Privacy / consent UX" group below for the long-form rationale. | Low | This IS the privacy stance. |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Reset-on-uninstall-reinstall** is automatic (UUID lives in `chrome.storage.local`, which is wiped on extension uninstall by Chrome) — documented explicitly in the privacy banner copy | Reassures the user that "uninstall is real deletion." Matches Astro / Vue CLI behaviour where deleting `~/.astro` rotates the ID. | Free (Chrome platform behavior) | Strong — surfaces an existing platform invariant. |
| **`fsb_telemetry_uuid_minted_at` timestamp** stored alongside the UUID, surfaced in the privacy panel as "Anonymous ID minted on YYYY-MM-DD" | Transparency. The user can see how long their ID has existed and decide if they want to rotate. | Low | Strong |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Hardware fingerprinting** (UA + screen + canvas + fonts + audio context hash) as a UUID-replacement when the user opts out | Defeats opt-out entirely. Combining ostensibly-anonymous signals into a stable fingerprint is exactly what regulators (and the EFF's Panopticlick) call out. | If user opts out, send NOTHING. Not even a one-off "opted out" ping. |
| **Sync the UUID across Chrome profiles via `chrome.storage.sync`** | Would create a cross-device cross-Chrome-profile link that is far more identifying than a per-install UUID. | `chrome.storage.local` only. One UUID per install. |
| **Pre-populate the UUID from `chrome.identity.getProfileUserInfo()` or any logged-in Google account** | That's a hard PII linkage. | Random UUIDv4 only. |
| **Cookie-based identity** (Set-Cookie from the telemetry endpoint) | Bridges the UUID to web-context tracking. The whole point of MV3 + extension-storage UUID is to keep it off the cookie jar. | Send the UUID as a request-body field, never as a Set-Cookie. |

---

## Capability Group: Telemetry Beat (the client-side periodic emit)

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **`chrome.alarms`-driven periodic beat** with `periodInMinutes: 5` (the MV3 minimum is 30s, so 5min is far inside the spec). The alarm listener is registered at the top level of the service-worker script per MV3 contract. | MV3 service workers can't use `setInterval` — they get evicted. `chrome.alarms` is the only supported periodic mechanism. | Low | Frequency-vs-cost tradeoff: a 5-min beat is also Plausible's "current visitors" window, which is the named precedent for what "now" means. |
| **Beat payload is strictly the allowlist**: `{uuid, ts_client, tokens_used_since_last_beat, active_agents_count, total_agents_lifetime, agent_name_set: string[], mcp_client_labels: string[], model_set: string[]}` — and nothing else | Allowlist-not-blocklist. Server-side validation rejects any unknown field as a defense-in-depth boundary. | Low | This is THE contract. |
| **Opt-out gate evaluated on every beat** (re-read `fsb_telemetry_enabled` from storage; do not cache) | If the user toggles off mid-session, the next beat must not fire even if the SW is mid-execution. Re-reading is cheap and correct. | Low | Strong |
| **No beat if there's nothing to report** (empty `agent_name_set` AND zero tokens-since-last-beat AND zero active agents → skip the post) | A "I exist" ping is itself a metric ("DAU = count of UUIDs that ever beat today"). Skipping when there's no activity makes the DAU number reflect actual usage, not install-counts. | Low | Strong — fewer outbound requests = less surveillance surface. |
| **Best-effort post; failures swallowed silently** (no retry, no exponential backoff queue) | Telemetry beat dropping on network failure should never degrade the user's actual FSB use. The next beat will pick up the unreported delta. | Low | Strong |
| **`navigator.sendBeacon`-style request semantics if possible** (small JSON POST with `keepalive: true` so SW eviction mid-flight doesn't drop it) | MV3 service workers can be evicted any time. Using `fetch(..., {keepalive: true})` lets the request complete even after eviction. | Low | None |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Jittered beat schedule** — instead of exactly-every-5-min, fire at `5min + uniform(0, 30s)` so simultaneous installs don't synchronize-hammer the server at the top of the minute | Server-side load smoothing. Industry standard for telemetry beats. | Low | Strong — adds noise to "this UUID always reports at HH:MM:00" temporal fingerprinting. |
| **"Send a beat now" debug button** in the privacy panel | Lets the user observe the live JSON payload in the "view what we send" panel without waiting 5 minutes. | Low | Strong — supports the transparency story. |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Beat-per-action** (one POST per `dispatchMcpToolRoute` call) | Tracks user actions in near-real-time on the server, defeats anonymization, drowns SW in network calls. | Aggregate locally; beat the aggregate every 5 min. |
| **Backfill of pre-opt-in usage** (sending tokens that were tracked locally BEFORE the user opted in) | Would retroactively share data the user hadn't consented to. | Drop the local pre-opt-in counters when the user opts in; start aggregation fresh from that moment. |
| **Beat ONLY on extension startup or popup open** | Misses long-running sessions; biases DAU toward popup-openers. | Time-based `chrome.alarms`. |
| **WebSocket persistent connection for telemetry** | Persistent connection = always-on identification beacon, even when there's nothing to report. | HTTPS POST, idempotent, fire-and-forget. |

---

## Capability Group: Server Ingest (`showcase/server/`)

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **`POST /api/telemetry/beat`** endpoint accepting the beat payload | Single ingest entry-point. | Low | The endpoint is rate-limited per-IP (suggest 12 req/min/IP = one beat per 5 min with 2x burst headroom). |
| **`POST /api/telemetry/optout`** endpoint accepting `{uuid}` only, recording an opt-out tombstone and dropping all prior beats for that UUID | This is the operational "reset my data" handler. See Privacy/Consent group. | Medium | Critical — it's the user's escape hatch. |
| **Server-side payload validation** — reject any beat carrying a field not on the allowlist with `400 unknown_field`, log the field name to a server-side error counter (NOT to a record tied to the UUID) | Defense-in-depth against a future client bug shipping a field that wasn't designed for collection. | Low | Strong |
| **IP hashing with daily-rotated salt** — store `SHA-256(IP + daily_salt)` where `daily_salt` is a per-day random value regenerated at UTC midnight and **the previous day's salt is destroyed**. Plaintext IP is never persisted to disk or to a log file. | The named precedent is Plausible's data-policy doc and the Litlyx implementation. Salt rotation makes prior-day hashes computationally infeasible to reverse even if the database is compromised. | Medium | This IS the GDPR defense for IP handling. |
| **Two SQLite tables**: a thin `telemetry_events` raw-events table (for the last N days, e.g. 30) and an aggregate `telemetry_rollups` table for the public `/stats` views. New beats write to `telemetry_events`; a cron-like job (or on-demand on read) rolls forward into `telemetry_rollups` so the public `/stats` queries scan precomputed buckets, not raw events. | The SQLite analytics-rollup pattern is well-trodden. Public aggregates that scan millions of raw events on every page load are unsustainable; rollups keep `/stats` cheap. | Medium | Strong — bounded retention of raw events; rollups are aggregated past the point of identifiability. |
| **30-day raw-event retention with hard delete** — `telemetry_events` rows older than 30 days are dropped by a daily housekeeping job; rollups are forever (they are not per-UUID). | Bounded retention is best-practice and a defensible answer to "how long do you keep my data?" | Low | Strong |
| **CORS lockdown** — `/api/telemetry/*` accepts requests from the extension origin (`chrome-extension://<id>`) only; no `*` allowed | Prevents the endpoint from being used as a generic anonymous logging service by random third parties. | Low | Strong |
| **No server-side logging of full request bodies to access logs** — the standard Express request logger should be configured to NOT include the request body on `/api/telemetry/*` paths | A misconfigured access log could leak the entire beat payload (with UUIDs) into log files for backup. Explicitly redact the path. | Low | Strong |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Schema-version field on the beat** (`schema: "v1"`) and server rejection of unrecognized schemas | Allows the beat shape to evolve in v0.9.70+ without breaking older installs that haven't auto-updated. | Low | None |
| **`X-FSB-Extension-Version` header sniffed (but NOT persisted) and used only to bucket malformed-beat rates by ext version for operator triage** | Lets us tell "is this bug just from one shipped extension version?" without storing the version per-row | Low | Header is not persisted; only its counter rollup is. |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Storing plaintext IP** anywhere — request body, access log, error log, anywhere | The promise on the privacy banner is "we never see your IP in plaintext after the request boundary." | Hash at the request-handler boundary; pass only the hash forward. |
| **Linking the hashed IP to the UUID** (storing both in the same row, allowing a join) | Would let an attacker who breaches one table reconstruct the other; defeats the salt rotation. | Store the hashed IP in a separate `telemetry_ips` table that is per-day, not per-event. The IP table just counts unique IP-hashes per day; the events table just stores the UUID. They are never joined. |
| **Reverse-proxy `X-Forwarded-For` trust without sanitization** | Fly.io / Cloudflare / Render passes `X-Forwarded-For`; trusting it blindly enables IP spoofing for cache poisoning. | Trust only the first (left-most) entry from a known reverse-proxy chain; harden Express `trust proxy` config. |
| **Server-side endpoint to query "what is in my UUID's events table?"** | Defeats the anonymity promise — if any caller can ask for events by UUID, the UUID becomes a useful identifier. | The opt-out endpoint takes a UUID but is **write-only**: it deletes that UUID's rows and returns `{deleted: N}`, never the data itself. |

---

## Capability Group: Aggregations (the queries that feed `/stats`)

This is the answer to the milestone's explicit question 2 — specific definitions with explicit time windows.

| Metric | Recommended definition | Time window & rationale |
|---|---|---|
| **Active users right now** | Count of distinct `uuid` that posted a beat in the last 5 minutes. | **5 minutes**, matching Plausible's "current visitors" definition (the most-named OSS analytics precedent for "now"). The FSB beat cadence is also 5min, so a UUID is in-window iff it has beat at most once ago — a natural fit. |
| **Active agents (right now)** | Sum of `active_agents_count` from the most recent beat per UUID, restricted to UUIDs whose most recent beat is in the last **2 beat cycles = 10 minutes**. | **10 minutes**, NOT 5. Rationale: an agent reported in beat T might still be alive in beat T+1; if we cap at 5 min we'd undercount any agent that started 4:59 ago and hasn't been re-reported. Two beat cycles is the standard "missed-one-heartbeat" tolerance pattern from Airflow's zombie-task detection and Temporal's heartbeat timeout — a single missed beat is normal jitter; two is dead. |
| **Total users (lifetime)** | Count of distinct `uuid` ever recorded in `telemetry_events` plus `telemetry_rollups` (i.e. including UUIDs already aged out of the 30-day raw table but preserved in lifetime rollup) | Lifetime — no window. |
| **Total agents (lifetime)** | `SUM(total_agents_lifetime_delta)` across all beats. Each beat carries the **delta since last beat**, not the install-lifetime cumulative, so SUM is well-defined and monotone. | Lifetime — no window. |
| **Total tokens used** | Three figures shown stacked, **Plausible-style toggleable headline metric**: `lifetime`, `last 24h`, `last 7 days`. | Three windows; user toggles. The 24h and 7d figures match the existing AI analytics-hero chart-time-range pattern (`24h / 7d / 30d`) so the design vocabulary is already established in FSB. |
| **Most popular agent (by name)** | Top 5 agent names by **count of UUIDs that have ever named at least one agent that name** (NOT by total invocations). Window: lifetime. | Counting by distinct-UUID-mentions instead of invocation-count prevents one heavy user from dominating the chart. Matches Homebrew's "install count" methodology (one install per UUID per period, not raw invocations). |
| **Most popular MCP** | Top 5 `mcp_client_label` values by **count of distinct UUIDs that have reported that label in the last 7 days**. | 7-day window so a one-time experimenter doesn't permanently inflate "popular MCP" — same rationale Homebrew uses with its 30-day install counts for popular-formula rankings. |
| **Avg agents per user** | `total_agents_lifetime / total_users_lifetime`, displayed to 1 decimal. | Lifetime. Caveat: include only UUIDs with at least one agent reported in their lifetime (denominator excludes "installed but never used agents"), otherwise the figure trends to 0 as install base grows. |

### Table stakes (MUST ship — the 8 aggregates above)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| All 8 metric definitions above, exposed as `GET /api/stats/telemetry` returning a single JSON object with `{active_users_5m, active_agents_10m, total_users_lifetime, total_agents_lifetime, tokens_lifetime, tokens_24h, tokens_7d, popular_agents: [...], popular_mcp_clients: [...], avg_agents_per_user}` | The /stats page needs one aggregator endpoint, not 8. | Medium | Strong — all aggregates are k-anonymous (no UUID ever appears in the response). |
| **`computed_at` timestamp** on every aggregate response | Tells the user when the snapshot was generated (matches the existing `stats-foot` 5-min auto-refresh note pattern). | Low | None |
| **k-anonymity floor** — `popular_agents` and `popular_mcp_clients` lists ONLY include entries with at least **5 distinct UUIDs** reporting that value. Entries below the threshold are bucketed into "other (N=...)". | Without a k-floor, a unique agent name reported by a single user is effectively identifying. Five is the standard minimum-cell-size threshold from k-anonymity research and from how Mozilla's public data report aggregates extension/add-on data. | Low | Critical — prevents accidental fingerprinting via rare agent names like "personal-banking-bot-jane-smith". |
| **All aggregate queries scan only `telemetry_rollups`, never `telemetry_events`** (with at most one exception: `active_users_5m` and `active_agents_10m` need recent raw data, so they scan only the last 15 minutes of events) | Public endpoint must be cheap, predictable, and not get slower as the dataset grows. | Medium | None — performance, not privacy. |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **DAU and 7d-rolling-WAU figures** in addition to "active right now" | Standard SaaS metric; gives a fuller picture of stickiness than the 5-min snapshot. The 7d windowed-count pattern is documented exhaustively in Cube/RisingWave/PostHog references. | Low | None — k-anonymity floor still applies. |
| **Tokens-by-MCP-client stacked chart view** on /stats | Tells the FSB maintainer (and curious users) "which MCP host's users consume the most tokens via FSB?" | Medium | k-anonymity floor still applies. |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **A queryable-by-UUID endpoint** (e.g. `GET /api/stats/uuid/<uuid>`) | Makes the UUID an addressable identifier, defeats the anonymous-only design. | UUIDs are write-only inputs; aggregate-only outputs. |
| **A "list all UUIDs" admin endpoint** | Even authenticated, this would create a UUID enumeration path that, combined with timing, could fingerprint behaviour. | Aggregate counts only. |
| **A "popular agent name leaderboard with full list, no k-floor"** | Single-mention agent names are identifying. | Top-N with k-anonymity floor, bucket rest into "other". |

---

## Capability Group: /stats Surface (the public consumption page)

`/stats` already ships on `Refinements` with 7 GitHub-driven views. v0.9.69 adds an "FSB Telemetry" toggle group that switches the chart-card to a new dataset family. The existing 5-min visibility-aware polling primitive, `view-switcher` tablist, `chart-card[data-state]` skeleton/ready/rate-limited/error rendering, and the Chart.js dynamic-import lazy-load contract all carry forward unchanged.

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **6 new toggle entries** appended to the existing `views` array in `stats-page.component.ts`: `fsb-active-now`, `fsb-tokens`, `fsb-agents-running`, `fsb-popular-agents`, `fsb-popular-mcp`, `fsb-avg-agents-per-user` | Reuse the existing pattern. Six is enough to cover the 8 aggregates without crowding the tab strip (active-users + active-agents fold into one view; popular_agents and popular_mcp are separate views). | Medium | None — public-facing aggregates only. |
| **"FSB Telemetry" section header** above the new toggles, visually distinct from the GitHub toggles (e.g. a horizontal separator or sub-heading inside `view-switcher`) | Makes it clear these are FSB-install stats, not GitHub repo stats. | Low | None |
| **Headline numbers row** above the chart (e.g. `active right now: 12 · total users: 1,247 · tokens 24h: 2.3M`) — mirrors Plausible's at-a-glance hero panel | Plausible's dashboard uses a top-row hero summary above the trend chart; that pattern lets viewers absorb the state in 1 second without parsing a chart. | Medium | k-anonymity floor still applies. |
| **`stats-foot` copy updated** to mention "Auto-refreshes every 5 min while this tab is visible · GitHub data + anonymous FSB usage telemetry" | Honest provenance line — discloses that the page is fed by both data sources. | Low | Strong — transparency. |
| **Existing 5-min visibility-aware polling primitive REUSED** (the same primitive that drives the GitHub stats refresh) so a single timer fans out to both GitHub and FSB-telemetry endpoints | Avoids two competing refresh loops. | Low | None |
| **Each FSB-telemetry view defaults to the cached snapshot** if `/api/stats/telemetry` is down or slow, with an `error-card` shown matching the existing `viewState === 'error'` branch | The existing stats page already has a clean error/loading/rate-limited/ready state machine. Inherit it. | Low | None |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Sparkline of tokens-per-day (last 30 days)** as a chart view | Matches Plausible's trend chart. Cheap given the rollup table already buckets per-day. | Low | None |
| **"Last updated N seconds ago" ticker** in the chart-card header, animating once per second | Honest freshness signal, doesn't drift like a static timestamp. | Low | None |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Geo heatmap of users** (even country-level) on the public page | Country-level heatmap with anything fewer than ~100 users per country becomes fingerprinting-adjacent. And FSB users in unusual countries become uniquely identifiable. | Defer to v0.9.70+, and only with a >100-UUID-per-country floor. See stretch list. |
| **Per-user public list** — UUIDs, agent names by UUID, individual install timelines | Anonymous-by-design means the public surface never names a UUID. | Aggregates only. |
| **Indexing the /stats page to search engines** for the telemetry views | The page already ships with `<meta name="robots" content="noindex, nofollow">` (see `stats-page.component.ts:111`) and is intentionally Easter-egg. Keep it that way. | Preserve the existing `noindex, nofollow` + crawler-invariant exclusion from sitemap.xml/llms.txt/llms-full.txt that the existing page documents at lines 12-15. |
| **Auth-gated views** for "advanced" telemetry | Adds friction without adding privacy (the aggregates are already k-anonymous). | One public surface, k-anonymity-floored. |

---

## Capability Group: Privacy / Consent UX

This is the **transparency-first** group. The recommended posture is: opt-out (i.e. enabled by default), but the first-run banner is unmissable, the "view what we send" panel is one click away, and the rotation/delete control is explicit. This matches the Homebrew / Astro / Next.js / Vue CLI posture (opt-out, default-on) but reinforced with a "view what we send" panel (a transparency pattern that Privacy Pioneer and Mozilla's about:telemetry both pioneered).

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **First-run privacy banner** in the control panel, recommended copy: <br><br> "FSB sends **anonymous usage stats** to help us understand how it's used. <br>We send: token counts, active-agent counts, MCP client labels (e.g. 'Claude Code'), agent names you set. <br>We DO NOT send: URLs, page content, your prompts, your API keys, your IP (it's hashed daily server-side and never stored). <br>You can turn this off anytime. <br>[ ] Allow anonymous telemetry (recommended) &nbsp; [ View what we send ] &nbsp; [ Privacy policy ]" | Chrome Web Store program policies require prominent in-product disclosure of data collection, distinct from the privacy policy text. The recommended copy mirrors the named-precedent style: Homebrew's `brew update` notice, Next.js's `next telemetry` first-run output, Astro's `astro telemetry` notice. | Medium | This is THE consent boundary. |
| **Opt-out toggle in the control panel** at a top-level section labelled "Privacy & Telemetry" (NOT buried under Debug Tools) | Firefox Extension Workshop and Chrome WebStore both recommend the opt-out be prominent. Burying it in Debug Tools is the kind of dark pattern regulators have started fining for. | Low | This is the user's ongoing control. |
| **"View what we send" panel** showing a **live JSON preview of the NEXT beat** (i.e. exactly the payload the next `chrome.alarms` tick will POST), rendered in a `<pre>` block with syntax highlighting | The named precedent is `NEXT_TELEMETRY_DEBUG=1` (Next.js prints the payload to stderr), `astro telemetry view`, and Mozilla's `about:telemetry`. Combined with the allowlist-only payload contract, this turns "trust us" into "verify us." | Medium | Strong — this is the transparency story made concrete. |
| **"Reset anonymous ID" button** with explicit copy: "This generates a new anonymous ID for future data. Past data on our server stays anonymous and is not deletable individually because it isn't linked to you in a way we can look up — see Privacy policy for details." | This is the GDPR Article 17 answer for an anonymous-by-design system. See "GDPR Article 17 stance" below. | Low | This IS the privacy stance. |
| **"Stop sending data" master switch** that, on flip-to-off, immediately (synchronously, before the next beat fires): (a) clears the `chrome.alarms` schedule, (b) issues a one-time `POST /api/telemetry/optout` with `{uuid}` to drop server-side rows for that UUID, (c) wipes local aggregation counters | Master switch must take effect immediately, not "next beat." | Medium | Strong — gives the user instant agency. |
| **Link to the privacy policy** below the banner. The privacy policy on `full-selfbrowsing.com/privacy` must be updated for v0.9.69 to cover the new collection. | Existing FSB `/privacy` page is prerendered (Phase 261-268 Showcase i18n migration mentions it). Updating it is in-scope. | Low | Strong — legal cover for the EU. |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Per-field opt-out toggles** ("I'm OK sending tokens but not agent names") | Some users want partial disclosure. Granularity is the gold-standard pattern. Mozilla's about:preferences#privacy ships this pattern. | High | Strong |
| **Toast notification on first beat** ("FSB just sent its first anonymous beat — click here to see what was sent") | Reinforces the transparency story right when the first transmission happens. | Medium | Strong |
| **"View server response" panel** showing the most recent HTTP response (e.g. `{"ok": true, "received_at": "..."}` ) so the user can confirm the round-trip works and isn't returning a tracking cookie | Reinforces "we send nothing on the back-channel either." | Low | Strong |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Opt-in via a banner that the user has to dismiss with a button labelled "OK / Accept"** with a buried "decline" link | Dark pattern. The two choices must be visually equal-weighted and the toggle defaults clearly stated. | "Allow (recommended)" + "Don't allow" buttons of equal weight, OR a single labelled toggle with a clear default state. |
| **Bury the opt-out under "Advanced settings"** | Firefox / Chrome web-store policy violation risk. | Top-level "Privacy & Telemetry" section. |
| **Send a "user declined" telemetry ping** | Self-defeating; the absence of a beat is the signal. | Send NOTHING when opted out. |
| **Re-ask consent on every extension update** | Annoying; the user already decided. | Show a small "Updated privacy practices" banner only if the data shape materially changes (i.e. schema-version bumps from v1 to v2). |
| **Trick consent into auto-on by hiding the toggle behind a sub-section** | Same dark-pattern risk. | The control is at the top level, default state is clearly indicated. |

### GDPR Article 17 stance (the "delete my data" button)

**Recommendation:** Provide a "Reset anonymous ID" button that (a) rotates the local UUID, (b) issues a one-time `POST /api/telemetry/optout` that the server uses to drop all `telemetry_events` rows matching the old UUID, and (c) keeps the rollup aggregates intact (because rollups are aggregate-only and not per-UUID).

**Honest copy for the button tooltip:** "This rotates your anonymous ID and asks our server to delete the raw events linked to your old ID. Aggregate stats are not affected — they aren't linked to individuals."

**Rationale:**
1. Plausible's published stance is that anonymous-by-design data is **outside GDPR Article 17's scope** because there's no personal data to erase — the data was never linked to a natural person in a way the controller can re-identify. (Cite: Plausible privacy doc.)
2. However, providing a button anyway is **good faith** and is what Homebrew, Vue CLI, and Astro all do (rotate-by-reinstall, with explicit docs).
3. The button does NOT promise "delete all data ever associated with you" because (a) the rollup aggregates are not individually identifiable and (b) the IP hash uses a daily rotated salt so prior-day hashes are computationally irreversible. Promising more than that would be a false statement on a legal page.

### Recommended banner copy block (drop-in)

```text
FSB · Anonymous Usage Telemetry

To help us understand how FSB is used, we send a small anonymous "beat" every 5
minutes containing:

  · A random anonymous ID (generated on this device, no link to your identity)
  · Token counts for AI and MCP usage in the period
  · Number of active FSB agents
  · Labels of MCP clients you use (e.g. "Claude Code", "Codex")
  · Names you've given to agents (e.g. "browse-shopping")

We DO NOT send:

  · URLs you visit, page contents, or your prompts
  · Your API keys or any credentials
  · Your IP address (the server hashes it with a salt that rotates daily, and
    the plaintext IP is never stored)
  · Your timezone, locale, or browser fingerprint

You can:
  · Turn this off any time in this section
  · Click "View what we send" to see the exact next beat as JSON
  · Click "Reset anonymous ID" to start fresh

By default, anonymous telemetry is ON. Toggle below to opt out.

[ Toggle: Send anonymous telemetry  · ON ]
[ Button: View what we send ]
[ Button: Reset anonymous ID ]
[ Link:   Privacy policy ]
```

---

## Capability Group: Dashboard Streaming Fix (last phase of v0.9.69)

The dashboard streaming pipeline (`dash:dom-stream-start/-pause/-resume`, `ext:dom-mutations`, `ext:stream-state`, `staleMutationCount`/`mutationApplyFailures` resync triggers) is implemented in `dashboard-page.component.ts:608-3501` and is currently broken in a way the milestone has to diagnose during repair. This research is about the **UX expectation around a fixed live preview**, not about the wire format itself.

### Table stakes (MUST ship)

| Feature | Why expected | Complexity | Privacy impact |
|---|---|---|---|
| **Working live DOM-mutation pipeline** with the existing 2-tier watchdog (Phase 211 of v0.9.45rc1: `chrome.alarms` SW-side + `setTimeout` content-side) restored to green | This is the milestone deliverable. The existing UX (`dash-preview-status`, `dash-preview-loading`, `dash-preview-disconnected`, `dash-preview-error`, `dash-preview-tooltip` "No stream data") is the UX expectation. | High | None — DOM stream is already same-user pipe. |
| **Stream-state pill showing one of:** `live · paused · disconnected · reconnecting · restricted` (matching the existing `previewState` machine) | Already implemented in the markup at `dashboard-page.component.html:148-152`. Just needs the wire pipeline restored. | Low | None |
| **Tooltip telemetry on the stream-status pill** showing: `last-frame ago: Ns`, `mutations applied: N (since stream-start)`, `stale-mutation count: N`, `apply-failures: N` | These already exist as private state in `dashboard-page.component.ts` (`mutationApplyFailures`, `staleMutationCount`) but are not surfaced. Browserless's docs cite `quality (1-100)` for JPEG mode; FSB equivalent is mutations-per-second + apply-failure-rate. | Medium | None |
| **"Resync now" button** that fires `dash:dom-stream-start` with `trigger: 'manual-resync'` (the existing `requestPreviewResync` pathway at line 994 already supports this) | When the auto-resync watchdog doesn't fire, give the user a manual escape. Browserless and Browserbase Live View both ship a reload affordance. | Low | None |

### Differentiators (SHOULD ship if scope allows)

| Feature | Value proposition | Complexity | Privacy impact |
|---|---|---|---|
| **Stream FPS-equivalent metric** — mutations applied per second over the last 5 seconds, displayed as "N mutations/s" in the stream-state tooltip | Browserless's JPEG quality / FPS analogue. For DOM-mutation streams the equivalent is mutations-per-second. Cheap rolling counter. | Low | None |
| **Bytes-per-second metric** — sum of `JSON.stringify(payload).length` over received `ext:dom-mutations` messages in the last 5 seconds | Diagnostic — heavy traffic = page is mutating fast = client should expect lag. | Low | None |
| **Last-frame-at timestamp** ("last frame: 2.3s ago", auto-updating once per second) | Browserless Live View has this. Tells the user "is this still alive?" without ambiguity. | Low | None |
| **"Stream health" colour chip** (green = live + <1s since last frame, yellow = paused or 1-5s lag, red = disconnected or >5s lag) | Industry-standard health-traffic-light pattern. | Low | None |

### Anti-features (NEVER ship)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Pixel/screenshot streaming as a fallback** (vs DOM-mutation cloning) | FSB's whole streaming model is DOM cloning with CDN images, not pixel capture (this is in PROJECT.md's Out-of-Scope list). | Restore DOM-mutation reliability; don't pivot architecture. |
| **A "record stream to disk" button** | Stream contains rendered page content from the user's tabs — recording it = PII in a file. | If a debug aid is needed, log only the `ext:stream-state` lifecycle envelope (no DOM payload) to the existing `fsb_diagnostics_ring`. |
| **Sharing stream state with the telemetry beat** (e.g. "this UUID streams to dashboard often") | Conflates the same-user remote-control surface with the anonymous-telemetry surface, defeating the separation of concerns. | Stream metrics stay client-side; telemetry beat carries only the allowlist. |

---

## Capability Group: Stretch Features (call out, defer to v0.9.70+)

The milestone brief explicitly asks for these to be called out and deferred:

| Stretch feature | Recommendation | Why defer | Earliest target |
|---|---|---|---|
| **Geo heatmap of users (country-level only)** | DEFER. | Requires (a) per-request country geolocation server-side (Cloudflare CF-IPCountry header is free and accurate, but introduces a CF dependency in the trust boundary), (b) k-anonymity floor of e.g. 100 UUIDs per country before a row is rendered. The floor calculus needs design time and the country-resolution path needs a deliberate "we look up country from your IP at request time, then drop the IP" disclosure on the privacy banner — which is a non-trivial copy expansion. | v0.9.70+, after install-base reaches a level where country-floor of ~100 is non-trivially populated. |
| **"FSB agents currently running RIGHT NOW" auto-refreshing ticker** | DEFER. | The aggregate is already in the v0.9.69 `/api/stats/telemetry` response. What's deferred is the *real-time stream* version (WebSocket or SSE) that updates every second instead of every 5 minutes. Polling at 1Hz from the public `/stats` page from many open tabs would multiply load by `(open-tabs × 1Hz × 60s)` per minute, dwarfing the beat-write load. | v0.9.70+, after rate-limit headroom is established. |
| **Per-day token-usage spark line on `/stats`** | LIST as a v0.9.69 differentiator (above, in `/stats Surface` group). | Already cheap (rollup table buckets per-day), worth shipping if scope allows. | v0.9.69 if scope allows; otherwise v0.9.70. |
| **Public API for the aggregates (read-only JSON endpoint)** | DEFER as a *separately-documented* endpoint. The `/api/stats/telemetry` endpoint already exists internally to feed the page — promoting it to a documented public API is one line of marketing copy plus a CORS policy decision. | The decision is: should we rate-limit, cache, version, and document the URL? Worth doing deliberately, not as a side-effect. | v0.9.70+, with a `/stats/api` docs page and `Cache-Control: public, max-age=300` headers. |

---

## Feature Dependencies (build order)

```
1. Pricing & Cost (MCP)          -> hardcoded table, no dependencies
2. Control-Panel MCP Logging     -> requires (1) for cost column
3. Anonymous Identity            -> independent
4. Telemetry Beat                -> requires (2) for what to send and (3) for who is sending
5. Server Ingest                 -> requires (4) for the wire shape
6. Aggregations                  -> requires (5) for the data tables
7. /stats Surface                -> requires (6) for the API
8. Privacy / Consent UX          -> requires (4)+(5) to have something to preview, but the BANNER ships ahead of beat firing
9. Dashboard Streaming Fix       -> independent, LAST phase per milestone constraints
```

Privacy gate: nothing in groups 4-7 emits any data until the consent toggle (group 8 banner) has been seen by the user **once**. First-run rule: telemetry beat is silently suppressed until the banner has been rendered.

---

## Real-world comparison points cited (≥3 OSS extensions / analytics products)

| Product | Cited for | Confidence |
|---|---|---|
| **Plausible Analytics** | 5-min "current visitors" window; daily-rotated IP salt; "delete my data is N/A by design" stance; top-N referrer panel pattern. | HIGH — official `plausible.io/docs/realtime-dashboard` and `plausible.io/data-policy` consulted directly. |
| **Umami** | Top-pages / top-sources panel pattern; under-2KB tracker; cookieless tracking precedent for GDPR; share-link / public-dashboard pattern (relevant if FSB ever wants to expose the aggregates publicly). | HIGH — multiple sources. |
| **GoatCounter** | Aggregate-only / no-individual-tracking stance; ~3.5KB tracker; "doesn't need a GDPR notice because it's aggregate-only" precedent. | HIGH — multiple sources including the GitHub README. |
| **Homebrew Analytics** | Public aggregate stats with 30/90/365-day windows; install-count methodology (one-per-UUID-per-period, not raw invocations); first-run consent-on-update banner precedent. | HIGH — `formulae.brew.sh/analytics/` and `docs.brew.sh/Analytics` consulted directly. |
| **Next.js telemetry** | Allowlist-only payload contract; `NEXT_TELEMETRY_DEBUG=1` "view what we send" precedent; opt-out posture by env var or CLI command. | HIGH — `nextjs.org/telemetry` consulted directly. |
| **Astro telemetry** | Allowlist-only payload with example JSON; CLI opt-out (`astro telemetry disable`) + env var; uninstall-rotates-UUID via local config wipe. | HIGH — `astro.build/telemetry` consulted directly. |
| **Mozilla Firefox about:telemetry** | "View what we send" UX pattern; user-facing transparency view of every field; public weekly data report precedent. | HIGH — Firefox source docs + Mozilla support kb. |
| **Browserbase Live View / browserless.io** | Live-preview UX expectation; quality slider 1-100; per-stream observability metrics. | MEDIUM — vendor docs only; not academic consensus. |
| **Airflow / Temporal worker heartbeat** | 2-beat-cycle staleness threshold for "agent is dead." | HIGH — multiple sources (Airflow `scheduler.zombie_task_threshold`, Temporal heartbeat timeout docs). |
| **Cube / RisingWave / PostHog DAU/MAU** | Rolling-window aggregation pattern (`trailing: '1 day' / '30 day'`); pre-aggregation rollup tables. | HIGH — multiple sources. |

---

## Sources

- [Plausible Analytics — Realtime dashboard documentation](https://plausible.io/docs/realtime-dashboard)
- [Plausible Analytics — Data policy & daily-rotated salt](https://plausible.io/data-policy)
- [Umami — Privacy-focused web analytics overview](https://umami.is/)
- [Umami documentation — Introduction & metrics](https://docs.umami.is/docs)
- [GoatCounter — Open source web analytics](https://www.goatcounter.com/)
- [GoatCounter on GitHub](https://github.com/arp242/goatcounter)
- [Homebrew Analytics — public stats](https://formulae.brew.sh/analytics/)
- [Homebrew Anonymous Analytics — docs](https://docs.brew.sh/Analytics)
- [Next.js Telemetry — official page](https://nextjs.org/telemetry)
- [Next.js Telemetry public dashboard](https://telemetry.nextjs.org/)
- [Astro Telemetry — official page](https://astro.build/telemetry/)
- [Astro Privacy Policy](https://astro.build/privacy/)
- [@astrojs/telemetry on npm](https://www.npmjs.com/package/@astrojs/telemetry)
- [Mozilla Firefox Telemetry source docs](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/)
- [Mozilla Telemetry portal](https://telemetry.mozilla.org/)
- [Manage technical and interaction data collection settings in Firefox](https://support.mozilla.org/en-US/kb/telemetry-clientid)
- [Browse Telemetry Firefox collects](https://www.ghacks.net/2020/01/28/browse-the-telemetry-that-firefox-collects/)
- [Browserbase — Live View documentation](https://docs.browserbase.com/features/session-live-view)
- [Browserbase Stagehand on GitHub](https://github.com/browserbase/stagehand)
- [browserless.io — Watching your sessions](https://docs.browserless.io/enterprise/watching-sessions)
- [browserless.io — Screen Recording with LiveURL](https://docs.browserless.io/baas/session-management/recording-liveurl)
- [PostHog — Session replay privacy controls](https://posthog.com/docs/session-replay/privacy)
- [PostHog — Browser extension guidance](https://posthog.com/docs/advanced/browser-extension)
- [PostHog — Controlling data collection](https://posthog.com/docs/privacy/data-collection)
- [Chromium Blog — Transparent privacy practices for Chrome Extensions](https://blog.chromium.org/2020/11/transparent-privacy-practices.html)
- [Chrome Web Store — User data privacy policy](https://developer.chrome.com/docs/webstore/user_data/)
- [Firefox Extension Workshop — Best practices for collecting user data consents](https://extensionworkshop.com/documentation/develop/best-practices-for-collecting-user-data-consents/)
- [Chrome — Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Storybook telemetry docs (opt-out pattern reference)](https://storybook.js.org/docs/configure/telemetry)
- [WP Statistics — Daily salt IP hashing](https://wp-statistics.com/2024/02/enhancing-privacy-with-our-updated-ip-hashing-mechanism/)
- [Privacy-Preserving Anonymization of System and Network Event Logs Using Salt-Based Hashing and Temporal Noise (arXiv:2507.21904)](https://arxiv.org/abs/2507.21904)
- [SQLite time-series rollup pattern — Dev.to](https://dev.to/zanzythebar/building-high-performance-time-series-on-sqlite-with-go-uuidv7-sqlc-and-libsql-3ejb)
- [Handling Time Series Data in SQLite Best Practices — MoldStud](https://moldstud.com/articles/p-handling-time-series-data-in-sqlite-best-practices)
- [Cube — DAU/WAU/MAU recipe (rolling window pattern)](https://cube.dev/docs/product/data-modeling/recipes/active-users)
- [RisingWave — Real-time DAU/MAU streaming SQL](https://risingwave.com/blog/real-time-dau-mau-calculation-streaming-sql/)
- [Apache Airflow — Zombie task / scheduler_zombie_task_threshold](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html)
- [Temporal — Worker heartbeat timeout discussion](https://community.temporal.io/t/worker-heartbeat-timeouts-and-activity-eviction-during-heavy-multitasking/19539)
- [Kestra — Liveness and heartbeat mechanism](https://kestra.io/blogs/2024-04-22-liveness-heartbeat)
- [Google Analytics — Realtime "users in last 5 minutes" vs "last 30 minutes"](https://support.google.com/analytics/answer/9271392)
- [GDPR Article 17 — noyb on Right to Erasure](https://noyb.eu/en/your-right-erasure-article-17)
- [Chrome MV3 alarms — Confusion regarding alarms in mv3 service workers](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/hWEe4I93P_E)
- [npm download counts methodology — TanStack blog](https://tanstack.com/blog/npm-stats-the-right-way)
