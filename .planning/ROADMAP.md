# Roadmap

**Status:** v0.9.69 Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix -- scoped 2026-05-14, roadmap approved, awaiting Phase 269 plan.

**Branch posture:** v0.9.69 work continues on `Refinements` (already 6 commits ahead of `origin/main` from quick task 260514-1nv plus version bump). The milestone-close PR merges `Refinements` -> `main`. Deploy targets remain showcase Angular + Express on Fly.io at `https://full-selfbrowsing.com`.

**Phase numbering:** Continues from v0.9.63's last phase (268). v0.9.69 phases begin at **269** and end at **276**.

---

## Active Milestone: v0.9.69 (Phases 269-276)

**Goal:** Stand up a privacy-preserving telemetry pipeline that flows MCP + extension usage metrics from end-user installs into the showcase server, render aggregates on the public `/stats` Easter-egg page, harden the Chrome Web Store privacy disclosures, and restore the broken DOM streaming in the showcase dashboard.

## Phases

- [x] **Phase 269: Install Identity + Opt-Out Scaffold** -- per-install UUIDv4 in `chrome.storage.local`; opt-out kill switch in Advanced Settings. ✓ shipped 2026-05-14 (35/35 tests, user-validated)
- [x] **Phase 270: MCP Pricing Module** -- `MODEL_PRICING` + `MCP_CLIENT_DEFAULT_MODEL` table with source-stamped 2026-05-14 rates. ✓ shipped 2026-05-14 (167/0 tests, 6 review fixes, parity gate green)
- [x] **Phase 271: MCPMetricsRecorder + Dispatcher Hooks + Unified Cost Surfacing** -- single chokepoint records every MCP dispatch into `fsbUsageData` alongside AI-provider calls. ✓ shipped 2026-05-14 (88/88 tests + 612 regression assertions, 1 BLOCKER fix landed)
- [x] **Phase 272: TelemetryCollector + Alarm + Queue Persistence** -- 5-min beat, MV3-SW-survivable queue in `chrome.storage.local`, minute-resolution timestamps, opt-out-aware flush. (completed 2026-05-14)
- [x] **Phase 273: Server Schema + Telemetry Routes + Salt Rotator + Rate Limiter + Housekeeper** -- ingest pipeline; `trust proxy`, `express-rate-limit@^8.3.0`, HMAC-SHA256 daily salt, k-anonymity-ready rollups. **HAS BLOCKERS #1, #2.** (completed 2026-05-14)
- [x] **Phase 274: Public Aggregates Endpoint + FSBTelemetryService Angular + /stats Toggle Group** -- `/api/public-stats/*` + `FSBTelemetryService` mirror of `GitHubStatsService` + 6 new chart views on `/stats` with i18n AI-fill. (completed 2026-05-14; 4 atomic commits; 6 new tests / 294 sub-assertions; AGG-01..09 + STATS-01..07)
- [ ] **Phase 275: Privacy Policy Page Update + CWS Listing Diff + CI Guard + Integration Smoke** -- `/privacy#telemetry-disclosure`, `listing-copy.md` data-collection section, `verify-store-listing.mjs` CI gate. **HAS BLOCKER #3.**
- [ ] **Phase 276: Dashboard DOM-Streaming Diagnostic + Minimum Patch** -- capture 3 logs, walk 7-hypothesis chain in rank order, apply minimum patch. **LOCKED LAST.**

## Phase Details

### Phase 269: Install Identity + Opt-Out Scaffold
**Goal**: Every FSB install carries a stable, anonymous identity gated by a visible user-controlled kill switch.
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, IDENT-05, CONS-01, CONS-02
**Success Criteria** (what must be TRUE):
  1. After a fresh install, the user can open the extension Control Panel "Advanced Settings" tab and see a "Send anonymous usage data" toggle that is ON by default.
  2. The user can flip the toggle OFF, and within 100ms the displayed state reflects the change with no "Apply" button and no nag screen.
  3. The user can reload the extension, the service worker can be evicted and revived, and the same install UUID is returned by `chrome.storage.local.fsb_install_uuid` -- no new UUID is minted.
  4. On an incognito or ephemeral profile where `chrome.storage.local` is unavailable, the telemetry collector silently no-ops without spawning errors visible to the user.
**Plans**: 1 plan
  - [ ] 269-01-PLAN.md — install-identity.js + background.js boot hooks + control_panel Privacy & Telemetry card + tests/install-identity.test.js
**UI hint**: yes

### Phase 270: MCP Pricing Module
**Goal**: A developer can attribute a USD cost to any MCP tool call by looking up the calling client and its assumed default model in a single auditable table.
**Depends on**: Nothing (PARALLEL with Phase 269; disjoint files, no shared writes)
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05
**Success Criteria** (what must be TRUE):
  1. A developer reading `mcp-pricing.js` can identify the per-million-token input + output rate for every Claude 4.x, GPT-5/5.x, Gemini 2.5, Grok 4.x, and DeepSeek V4 model on the May 2026 board, with a source URL + retrieval date comment beside each row.
  2. A developer can call the resolver with any client label from the v0.9.36 allowlist (`Claude`, `Codex`, `ChatGPT`, `Perplexity`, `Windsurf`, `Cursor`, `Antigravity`, `OpenCode`, `OpenClaw`, `Grok`, `Gemini`, `Hermes`) and receive an assumed default model plus a HIGH/MEDIUM/LOW confidence stamp.
  3. When the resolver is given an unknown `(client, model)` pair, the returned result has `cost: null` and `source: 'unknown'` -- never `$0` and never a default model row.
  4. Every resolver result carries the `PRICING_SOURCE_DATE = "2026-05-14"` constant so downstream consumers know when prices were last refreshed.
**Plans**: 1 plan
  - [ ] 270-01-PLAN.md — mcp-pricing-data.json + mcp/src/tools/pricing.ts + extension/utils/mcp-pricing.js + tests/mcp-pricing.test.js + tests/mcp-pricing-data-parity.test.js

### Phase 271: MCPMetricsRecorder + Dispatcher Hooks + Unified Cost Surfacing
**Goal**: Every MCP tool dispatch flows through a single recorder that contributes to the SAME analytics numbers the user already sees in the Control Panel.
**Depends on**: Phases 269 + 270 (needs UUID for telemetry summary + pricing for cost field)
**Requirements**: COST-01, COST-02, COST-03, COST-04, COST-05
**Success Criteria** (what must be TRUE):
  1. The user can run an MCP-driven task and watch the Control Panel "Total Tokens / Total Cost / Total Requests" hero numbers increment alongside AI-provider activity -- one set of hero numbers, two sources of activity.
  2. The user can audit any per-call MCP log row in the Control Panel and see only `{client, tool, tokens_in, tokens_out, cost_usd, ts}` -- no URLs, no prompts, no DOM payloads, no clipboard, no form values are visible anywhere.
  3. A developer reading `fsbUsageData` rows can distinguish MCP entries from AI-provider entries via the `source: 'mcp' | 'ai-provider'` discriminator without changing the rendered hero numbers.
  4. The user runs the same MCP tool 10 times and sees exactly 10 new rows in the Control Panel -- no double-counting from local persistence and outbound telemetry both writing.
**Plans**: 1 plan
- [ ] 271-01-PLAN.md — MCPMetricsRecorder + dispatcher hooks + analytics back-fill + tests
**UI hint**: yes

### Phase 272: TelemetryCollector + Alarm + Queue Persistence
**Goal**: The extension transmits a single anonymous beat every 5 minutes, surviving MV3 service-worker eviction and tab close, honoring the opt-out toggle live on every flush.
**Depends on**: Phase 271 (needs MCPMetricsRecorder to feed enqueue summaries)
**Requirements**: BEAT-01, BEAT-02, BEAT-03, BEAT-04, BEAT-05, BEAT-06, BEAT-07, BEAT-08, BEAT-09, BEAT-10
**Success Criteria** (what must be TRUE):
  1. After a fresh install, the user sees exactly one `install_announce` beat reach the server within the first 30s grace plus 5min alarm cycle.
  2. The user can close every Chrome tab and the service worker can be evicted, and on next wake-up the queue resumes from `chrome.storage.local.fsb_telemetry_queue_v1` with no events lost (up to the 200-event cap and 24h freshness window).
  3. The user can flip the opt-out toggle to OFF mid-session, and the next alarm tick clears the queue, makes no POST, and the alarm continues firing harmlessly.
  4. The user never sees a notification, badge, or higher-than-debug console log from telemetry activity during normal operation.
  5. The user can replay a server outage scenario (server returns 500) and verify the batch is re-enqueued via `keepalive: true` semantics with capped re-tries -- no infinite retry loop.
**Plans**: 1 plan
- [x] 272-01-PLAN.md — TelemetryCollector module + alarm + active-agent counter + tests

### Phase 273: Server Schema + Telemetry Routes + Salt Rotator + Rate Limiter + Housekeeper
**Goal**: The showcase server accepts anonymous telemetry batches with three release-gating safeguards: trusted-proxy IP handling, CVE-patched rate limiting, and never-persisted plaintext IPs.
**Depends on**: Phase 272 (needs client-side beat shape locked)
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07, INGEST-08, INGEST-09, INGEST-10, INGEST-11, INGEST-12, INGEST-13
**Success Criteria** (what must be TRUE):
  1. A developer can POST a valid 50-event batch to `https://full-selfbrowsing.com/api/telemetry/events` and see exactly 50 rows inserted into `telemetry_events` with hashed IPs and no plaintext IP anywhere on disk.
  2. A developer can POST 31 batches in one minute from the same IP-hash and see request 31 rejected with `429 Too Many Requests` carrying RFC 9239 RateLimit headers.
  3. A developer can POST a payload containing a 10th field (e.g. `prompt`) and see the request rejected with `400 unknown_field` -- the 9-field allowlist is enforced server-side.
  4. A developer can POST `{install_uuid: "<uuid>"}` to `/api/telemetry/forget` and `/api/telemetry/optout` and see a `204` response whether the UUID existed or not (no enumeration leak); subsequently see zero matching rows remain in `telemetry_events` and `telemetry_rollups_daily`.
  5. A developer can leave the server running for 25 hours and verify that yesterday's salt row has been deleted, today's salt is fresh, and `telemetry_global_aggregates` has been recomputed at least once by the hourly housekeeper.
**Plans**: 1 plan
  - [x] 273-01-PLAN.md — Trust proxy + 4 SQLite tables + WAL pragmas + hash/salt utils + express-rate-limit dep install + rate-limit middleware + 3 telemetry routes (/events, /optout, /forget) + housekeeper + 13 tests + CI grep gate (no IP leak)

### Phase 274: Public Aggregates Endpoint + FSBTelemetryService Angular + /stats Toggle Group
**Goal**: A visitor to `https://full-selfbrowsing.com/stats` can see live anonymous aggregate metrics about FSB usage, k-anonymity-floor-protected, in all six supported locales.
**Depends on**: Phase 273 (needs ingest pipeline producing aggregates)
**Requirements**: AGG-01, AGG-02, AGG-03, AGG-04, AGG-05, AGG-06, AGG-07, AGG-08, AGG-09, STATS-01, STATS-02, STATS-03, STATS-04, STATS-05, STATS-06, STATS-07
**Success Criteria** (what must be TRUE):
  1. A visitor can navigate to `https://full-selfbrowsing.com/stats` and see a new headline row reading "active right now: N · total users: N · tokens 24h: NM" alongside the existing GitHub views.
  2. A visitor can toggle between six new chart views (`fsb-active-now`, `fsb-tokens`, `fsb-agents-running`, `fsb-popular-agents`, `fsb-popular-mcp`, `fsb-avg-agents-per-user`) using the existing tab UI, and watch the data refresh every 5 minutes when the tab is visible (paused when hidden).
  3. A visitor opening `/stats` in es / de / ja / zh-CN / zh-TW sees the new headline and toggle labels in their locale, with the build-time `i18nMissingTranslation: error` invariant respected.
  4. A visitor querying `/api/public-stats/global` directly receives JSON with no auth, no cookies in response, ETag + `Cache-Control: max-age=60` headers, and the new path does not shadow the existing auth-gated `/api/stats`.
  5. A visitor cannot find `/stats` via search engines or `sitemap.xml`/`llms.txt`/`hreflang` -- the Easter-egg posture is preserved, footer link remains the only entry point.
**Plans**: 2 plans
  - [ ] 274-01-PLAN.md — Wave 1: server `active-tracker` + `public-stats` route (GET /global + /global/series, 30s memo + ETag + Cache-Control) + queries.js read paths + `recordSeen` hook in telemetry.js + server.js mount + Angular `FSBTelemetryService` + `fsb-telemetry.types.ts` + 5 new tests
  - [ ] 274-02-PLAN.md — Wave 2: stats-page component updates (6 toggle entries + headline row + section heading + scss) + i18n extract → AI-fill 5 non-en XLF locales (es/de/ja/zh-CN/zh-TW) + build smoke test (`i18nMissingTranslation: error` + Easter-egg crawler invariant)
**UI hint**: yes

### Phase 275: Privacy Policy Page Update + CWS Listing Diff + CI Guard + Integration Smoke
**Goal**: The Chrome Web Store listing, public privacy policy, and CI all reflect the new telemetry surface so v0.9.69 can be published without policy violation.
**Depends on**: Phase 274 (needs final endpoint URLs + payload schema locked)
**Requirements**: CONS-03, CONS-04, CONS-05, CONS-06, CONS-07
**Success Criteria** (what must be TRUE):
  1. A visitor opening `https://full-selfbrowsing.com/privacy` can read a new "Anonymous Usage Telemetry" section listing the 5 collected fields, the 6 explicitly-NOT-collected categories (URLs, prompts, DOM, plaintext IPs, names, emails), the retention policy (7d raw / 365d rollups / lifetime global), the kill-switch path, the GDPR Article 17 erasure curl recipe, and a Limited Use affirmation.
  2. A visitor opening the privacy policy can click a link reading "we publish aggregated metrics here" and land on `/stats`.
  3. A developer reading `store-assets/chrome-web-store/listing-copy.md` finds a "Data we collect" section mirroring the privacy page, and `store-assets/chrome-web-store/privacy-practices-evidence.md` records which CWS Privacy Practices checkboxes must be ticked at publish time.
  4. The CI chain runs `scripts/verify-store-listing.mjs` and fails the build if `listing-copy.md` lacks the Data Collection section or if the homepage URL doesn't terminate at `/privacy`.
  5. A user reading the privacy policy can copy a curl command and a documented Advanced-Settings path to read their UUID; no "forget my data" button exists in v0.9.69 (documented and explicitly deferred to v0.9.70+).
**Plans**: TBD
**UI hint**: yes

### Phase 276: Dashboard DOM-Streaming Diagnostic + Minimum Patch
**Goal**: A user pairing the showcase dashboard with an active extension on a non-restricted tab sees the live preview pane resume streaming within 3 seconds of pressing "wake".
**Depends on**: Phase 275 (LAST per locked phase order; only ships when everything else is green)
**Requirements**: STREAM-01, STREAM-02, STREAM-03, STREAM-04, STREAM-05, STREAM-06, STREAM-07
**Success Criteria** (what must be TRUE):
  1. A developer can read `.planning/phases/276-.../DIAGNOSTIC.md` and find three captured logs (showcase server stdout, extension diagnostics ring, dashboard transport-event history) plus the exact reproduction steps.
  2. A developer can read the same DIAGNOSTIC.md and walk the 7-hypothesis chain in rank order (hashKey room mismatch -> stream-tab not-ready -> no-tab forward -> domStreamReady pending-intent -> ext:status race -> LZ decompression -> stale-mutation loop), with predicted symptom + verification command + fix surface recorded for each.
  3. A user pairing the dashboard with an active extension on a non-restricted tab presses "wake" and sees the preview pane begin streaming live DOM within 3 seconds; the stream-state pill reads "streaming".
  4. A user hovering the stream-state pill sees a tooltip showing `last-frame-ago (s)`, mutations applied, apply failures, and stale-mutation count.
  5. If 5 fix attempts (one per hypothesis confirmation cycle) fail to confirm a root cause, the unresolved tail is explicitly re-scoped to v0.9.70 with a deferred-items entry rather than expanding scope inside this phase.
**Plans**: TBD
**UI hint**: yes

## Risks

Three formal **BLOCKERs** gate the v0.9.69 release tag to the Chrome Web Store. All three must be landed and verified before publish:

| ID | Blocker | Phase | What goes wrong if missed |
|----|---------|-------|---------------------------|
| **B1** | `app.set('trust proxy', 1)` MUST precede any telemetry route mount in `showcase/server/server.js` (immediately after `const app = express()`) | **273** | Without it, `req.ip` returns the Fly.io proxy IP for every request, ALL telemetry collapses into one synthetic user, IP-hash rate-limiter becomes a single-bucket system, per-IP daily budgets are meaningless. |
| **B2** | `express-rate-limit@^8.3.0` minimum (CVE-2026-30827) with custom `keyGenerator: req => hashIp(req.ip, db)` | **273** | Below 8.3.0, the default-keyGenerator IPv4-mapped-IPv6 collision collapses all IPv4 traffic into a single rate-limit bucket on dual-stack hosts. Fly.io is dual-stack. Even on 8.3.0, raw IP must never reach the rate-limiter; rate-bucket must align with the same HMAC-SHA256 identifier the storage layer sees. |
| **B3** | Updated CWS `listing-copy.md` + Privacy Practices evidence + privacy policy `#telemetry-disclosure` anchor must exist before CWS publish | **275** | Today's listing declares zero data collection. Publishing v0.9.69 without (a) ticking "Personally identifiable information" (the UUID is a regulated "identification number" under the CWS User Data FAQ), (b) providing a Privacy Policy URL covering the telemetry payload, retention, opt-out, and Limited Use compliance, and (c) ticking "Limited Use" certification is a direct policy violation -- soft-reject + re-review delay or hard-removal under sensitive-data policy. |

**Secondary risks (documented, not release-gating):**

- **GDPR opt-IN posture risk:** v0.9.69 ships opt-out-by-default globally. Defensible in the US under CCPA but contestable in the EU/UK under ePrivacy Article 5(3). Accepted risk per locked decision D-02; build `consentDecisionAt` precondition into Phase 273 schema so a future opt-in-per-locale feature flag does not require a schema migration.
- **Streaming-fix scope unknowable pre-repro:** Phase 276 is diagnostic-first. The 5-attempt hard cap (STREAM-07) protects the milestone close date; if the cap is hit, the unresolved tail re-scopes to v0.9.70 with a deferred-items.md entry.
- **DeepSeek V4-Pro 75% promo expires 2026-05-31:** Pricing table needs refresh sentinel; flagged for v0.9.70+ refresh cycle, not gating.
- **Grok 4 retires 2026-05-15:** Requests redirect to grok-4.3 pricing post-retirement; pricing table accommodates both.

## Parallelism

Phases 269 and 270 are **disjoint** (UUID storage bootstrap vs pure data table) and may run in parallel. All other phases run sequentially per the locked phase order (D-13).

## Progress

**Execution Order:**
Phases execute in numeric order with 269 || 270 (parallel) -> 271 -> 272 -> 273 -> 274 -> 275 -> 276.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 269. Install Identity + Opt-Out Scaffold | 1/1 | ✓ Complete | 2026-05-14 |
| 270. MCP Pricing Module | 1/1 | ✓ Complete | 2026-05-14 |
| 271. MCPMetricsRecorder + Dispatcher Hooks + Unified Cost Surfacing | 1/1 | ✓ Complete | 2026-05-14 |
| 272. TelemetryCollector + Alarm + Queue Persistence | 1/1 | Complete   | 2026-05-14 |
| 273. Server Schema + Telemetry Routes + Salt Rotator + Rate Limiter + Housekeeper | 1/1 | Complete   | 2026-05-14 |
| 274. Public Aggregates Endpoint + FSBTelemetryService Angular + /stats Toggle Group | 0/TBD | Not started | - |
| 275. Privacy Policy Page Update + CWS Listing Diff + CI Guard + Integration Smoke | 0/TBD | Not started | - |
| 276. Dashboard DOM-Streaming Diagnostic + Minimum Patch | 0/TBD | Not started | - |

---

## Latest milestone archive

[v0.9.63 -- Showcase i18n](milestones/v0.9.63-ROADMAP.md) -- 7 phases (261, 262, 264, 265, 266, 267, 268), 15 plans, 14/14 requirements satisfied, audit `passed`. Branch: `feat/showcase-i18n`. Marketing site (`showcase/angular`) now ships in en/es/de/ja/zh-CN/zh-TW with hreflang + canonical fan-out, AI-filled XLIFFs, hard-fail CI gates, and Accept-Language auto-detection. WARNING-02 (picker-cookie short-circuits bare-`/` redirect on fresh tabs) carried forward as deferred.

## Previous archives

- [v0.9.62 -- Implicit Visual Session Contract](milestones/v0.9.62-ROADMAP.md) -- 7 phases (254-260), 15 plans, 27/27 v1 requirements satisfied, audit `passed`. Branch: `refinements`. Final `npm publish fsb-mcp-server@0.9.0` remains user-gated.
- [v0.9.61 -- FSB Skill (OpenClaw)](milestones/v0.9.61-ROADMAP.md) -- 6 phases, 29/29 requirements, shipped 2026-05-08.
- [v0.9.60 -- Multi-Agent Tab Concurrency (MCP 0.8.0)](milestones/v0.9.60-ROADMAP.md) -- 11 phases, 42/42 requirements, shipped 2026-05-08.

See `.planning/MILESTONES.md` for the full milestone history.

---

## Backlog (carry-forward candidates for future milestones)

- **v0.9.70 (telemetry follow-up):** First-run privacy banner (deferred per D-02); "View what we send" live JSON preview; "Reset anonymous ID" button; "Wipe my telemetry data" in-extension UI button; region-gated opt-IN for EU/UK/CA installs; public versioned `/api/public-stats` documentation; per-day spark lines on `/stats`; geo heatmap (k>=100 floor).
- **v0.9.70 (streaming):** Full dashboard streaming rewrite if STREAM-07 hard cap is hit during Phase 276.
- **v0.9.64 (UX, carry-forward from v0.9.63):** revisit WARNING-02 -- picker-set `fsb-locale` cookie short-circuits the bare-`/` Accept-Language redirect on returning fresh-tab / shared-link visits.
- **v0.9.65 (dashboard i18n, carry-forward from v0.9.63):** translate `showcase/angular/src/app/pages/dashboard/**`; remove the `--ignore-pattern` in `package.json:lint:i18n`.
- **PRICING-REFRESH-CI:** 90-day CI gate that fails if `PRICING_SOURCE_DATE` is stale (deferred from v0.9.69 per user scope; manual refresh policy).
- **Carry-forward from prior milestones:**
  - `git push origin Refinements && git push origin v0.9.69` -- branch + tag (will land at milestone close).
  - `git push origin feat/showcase-i18n && git push origin v0.9.63` -- branch + tag NOT pushed (v0.9.63).
  - `git push origin refinements && git push origin v0.9.62` -- branch + tag NOT pushed (v0.9.62).
  - `npm publish fsb-mcp-server@0.9.0` -- in-tree at 0.9.0; final publish user-gated.
  - `clawhub publish "skills/FSB Skill"` -- carry-forward from v0.9.61.
  - 4 live-OpenClaw runtime UAT items carried from v0.9.61.
