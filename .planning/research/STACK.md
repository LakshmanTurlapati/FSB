# Technology Stack — v0.9.69 Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix

**Project:** FSB (Full Self-Browsing)
**Milestone:** v0.9.69 — Anonymous Telemetry Pipeline + Showcase Dashboard Streaming Fix
**Researched:** 2026-05-14
**Confidence:** HIGH (pricing from primary sources; runtime stack already validated in prior milestones)

> **Note:** This file supersedes the prior v0.9.61 STACK research. The earlier v0.9.61 OpenClaw-skill stack notes are archived under `.planning/milestones/v0.9.61-*`.

---

## Executive Summary

v0.9.69 is an **additive** milestone on a fully validated existing stack. The only new server-side dependency required is `express-rate-limit` (telemetry-endpoint DoS protection). Everything else — UUID generation, IP hashing, SQLite, batched POST + WS — is satisfied by Node built-ins (`crypto`) and the already-installed deps (`better-sqlite3@^11.0.0`, `express@^4.21.0`, `ws@^8.19.0`). On the extension side, `chrome.storage.local` is the correct primitive for both the install UUID and the batched event queue; `unlimitedStorage` is already in `manifest.json`. **No third-party analytics SDKs** are introduced (PostHog / Segment / Mixpanel / Datadog explicitly excluded by privacy mandate).

The new MCP-pricing module is **pure data** — a code-only `MCP_MODEL_PRICING` table mirroring the existing `extension/ai/cost-tracker.js` `MODEL_PRICING` pattern, refreshed to May 2026 rates. The existing `cost-tracker.js` is reusable as the cost-estimation engine; this milestone augments its lookup table with MCP-default-model rows and a new per-client → per-model resolution function.

---

## 1. MCP Model Pricing (May 2026, USD per 1M tokens)

> All rates are **non-batch, non-cache-hit standard list price** unless otherwise noted. Batch / cache-hit discounts are documented per-provider below; the FSB cost estimator records the raw standard rate and may optionally apply a multiplier in a future milestone.

### 1a. Anthropic — Confirmed via `platform.claude.com/docs/en/about-claude/pricing` (fetched 2026-05-14)

| Model | Input ($/MTok) | Output ($/MTok) | 5m Cache Write | 1h Cache Write | Cache Hit | Batch Input | Batch Output |
|---|---:|---:|---:|---:|---:|---:|---:|
| **claude-opus-4-7** | $5.00 | $25.00 | $6.25 | $10.00 | $0.50 | $2.50 | $12.50 |
| claude-opus-4-6 | $5.00 | $25.00 | $6.25 | $10.00 | $0.50 | $2.50 | $12.50 |
| claude-opus-4-5 | $5.00 | $25.00 | $6.25 | $10.00 | $0.50 | $2.50 | $12.50 |
| claude-opus-4-1 | $15.00 | $75.00 | $18.75 | $30.00 | $1.50 | $7.50 | $37.50 |
| **claude-sonnet-4-6** | $3.00 | $15.00 | $3.75 | $6.00 | $0.30 | $1.50 | $7.50 |
| claude-sonnet-4-5 | $3.00 | $15.00 | $3.75 | $6.00 | $0.30 | $1.50 | $7.50 |
| **claude-haiku-4-5** | $1.00 | $5.00 | $1.25 | $2.00 | $0.10 | $0.50 | $2.50 |

**Caveats Anthropic flags directly:**
- Opus 4.7 uses a **new tokenizer that consumes up to 35% more tokens** for the same input text vs 4.6. Per-token rate is unchanged but effective cost-per-request can rise ~35%. Note this in code comments for the pricing table.
- `inference_geo: "us"` adds a 1.1× multiplier on 4.5+ models. Not relevant unless we ever proxy MCP calls server-side — we don't.
- 1M-token context window included at standard pricing on Opus 4.7, Opus 4.6, Sonnet 4.6 — no over-context surcharge.

**Source:** [Claude API Pricing docs (platform.claude.com)](https://platform.claude.com/docs/en/about-claude/pricing) — confirmed live 2026-05-14. Confidence: **HIGH** (primary source).

### 1b. OpenAI — Confirmed via OpenRouter mirror (platform.openai.com behind 403 to WebFetch)

| Model | Input ($/MTok) | Cached Input | Output ($/MTok) | Source confidence |
|---|---:|---:|---:|---|
| **gpt-5** | $1.25 | $0.13 | $10.00 | HIGH (OpenRouter primary mirror + multi-source agree) |
| **gpt-5-mini** | $0.25 | — | $2.00 | HIGH (OpenRouter primary mirror + multi-source agree) |
| gpt-5-nano | $0.05 | — | $0.40 | MEDIUM (DevTk + GPTBreeze + AI Cost Check agree) |
| gpt-5.1 | n/a published | — | n/a published | LOW — newer family, retain manual refresh |
| gpt-5.2 | $1.75 | — | $14.00 | MEDIUM (IntuitionLabs Feb 2026 snapshot) |
| gpt-5.4 | $2.50 | — | $15.00 | MEDIUM (multi May 2026 third-party comps) |
| **gpt-5.5** (current flagship Apr 2026+) | $5.00 | — | $30.00 | MEDIUM (multi May 2026 third-party comps) |
| **gpt-5.5-codex** (Codex CLI default) | (inherits gpt-5.5 rates) | — | (inherits gpt-5.5 rates) | MEDIUM |

**Note:** OpenAI's public pricing page (`https://platform.openai.com/docs/pricing/` and `https://openai.com/api/pricing/`) currently returns **HTTP 403 to non-browser fetch**, so OpenAI's official prices could not be **directly** verified. The numbers above are confirmed from **two independent third-party trackers** (OpenRouter and AI Cost Check), which agree to the cent for GPT-5 / GPT-5-mini. Confidence is **HIGH for GPT-5/mini/nano** (multiple agreeing sources + OpenRouter primary mirror), **MEDIUM for the GPT-5.x family** (single-tier verification only).

**Sources:**
- [OpenRouter GPT-5 model page](https://openrouter.ai/openai/gpt-5) — confirmed 2026-05-14
- [OpenRouter GPT-5 mini model page](https://openrouter.ai/openai/gpt-5-mini) — confirmed 2026-05-14
- [DevTk 2026 OpenAI Pricing Guide](https://devtk.ai/en/blog/openai-api-pricing-guide-2026/)
- [The Register: GPT-5.5 cost analysis (2026-05-08)](https://www.theregister.com/ai-and-ml/2026/05/08/gpt-55-may-burn-fewer-tokens-but-it-always-burns-more-cash/5237498)

### 1c. Google Gemini — Confirmed via `ai.google.dev/gemini-api/docs/pricing` (fetched 2026-05-14)

| Model | Input (≤200k) | Input (>200k) | Output (≤200k) | Output (>200k) | Batch Input | Batch Output |
|---|---:|---:|---:|---:|---:|---:|
| **gemini-2.5-pro** | $1.25 | $2.50 | $10.00 | $15.00 | $0.625 / $1.25 | $5.00 / $7.50 |
| **gemini-2.5-flash** | $0.30 (text/image/video) / $1.00 (audio) | — | $2.50 | — | $0.15 / $0.50 | $1.25 |
| gemini-2.5-flash-lite | $0.10 (text/image/video) / $0.30 (audio) | — | $0.40 | — | $0.05 / $0.15 | $0.20 |

**Context caching (Gemini 2.5 Pro):** $0.125 (≤200k) / $0.25 (>200k) per 1M tokens, plus $4.50 / 1M tokens / hour storage.

**Source:** [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) — confirmed live 2026-05-14. Confidence: **HIGH** (primary source).

### 1d. xAI Grok — Confirmed via `docs.x.ai/developers/models` (fetched 2026-05-14)

| Model | Input ($/MTok) | Output ($/MTok) | Notes |
|---|---:|---:|---|
| **grok-4.3** | $1.25 | $2.50 | Current flagship (May 2026); 1M context; **>200k token requests billed at higher tier** (exact higher rate not published on docs.x.ai) |
| grok-4.20-0309-reasoning | $1.25 | $2.50 | |
| grok-4.20-0309-non-reasoning | $1.25 | $2.50 | |
| grok-4.20-multi-agent-0309 | $1.25 | $2.50 | |
| **grok-4.1-fast-reasoning** | $0.20 | $0.50 | |
| grok-4.1-fast-non-reasoning | $0.20 | $0.50 | |
| grok-4-fast | $0.20 | $0.50 | 2M context (per mem0 March snapshot) |
| grok-4 (deprecated) | $3.00 | $15.00 | **Retiring May 15, 2026** — requests redirect to grok-4.3 pricing |
| grok-3 | $3.00 | $15.00 | 131k context |
| grok-3-mini | $0.30 | $0.50 | 131k context |

**Caveat:** Grok 4.3 has tiered pricing at the **200k-token boundary** (similar shape to Gemini 2.5 Pro), but `docs.x.ai` does not publish the exact >200k rate as of fetch time. Treat the $1.25/$2.50 number as the ≤200k rate and **TODO-flag** the upper-tier number for refresh.

**Source:** [docs.x.ai/developers/models](https://docs.x.ai/developers/models) — confirmed live 2026-05-14. Confidence: **HIGH** for ≤200k pricing; **MEDIUM** for the >200k upper tier (acknowledged-but-unpublished).

### 1e. DeepSeek — Confirmed via `api-docs.deepseek.com` (fetched 2026-05-14)

| Model | Input (cache hit) | Input (cache miss) | Output |
|---|---:|---:|---:|
| deepseek-v4-flash | $0.0028 | $0.14 | $0.28 |
| **deepseek-v4-pro** | $0.003625 | $0.435 | $0.87 (75% promo discount applied; promo ends 2026-05-31) |

**Caveats:**
- DeepSeek V3 and DeepSeek-R1 are **no longer listed** on the official pricing docs as of 2026-05-14; V4-Flash / V4-Pro have replaced them.
- DeepSeek-V4-Pro has a **time-bounded 75% discount expiring 2026-05-31** — flag for refresh at next milestone.

**Source:** [api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing) — confirmed live 2026-05-14. Confidence: **HIGH** (primary source).

### 1f. Fallback / "Unknown Client" Policy

**When a client label or model is not in `MCP_MODEL_PRICING`:**

1. **Unknown client label** but known to be in the visual-session allowlist: fall back to the family-of-origin's **mid-tier model** (e.g. Sonnet 4.6 for any Anthropic-flavored unknown). Mark cost rows with `pricing_confidence: "fallback"`.
2. **Truly unknown client + truly unknown model**: record the call with **`cost_usd = null`** rather than $0 (false zero distorts aggregates). On the stats page, display these calls as "uncounted" with a tooltip.
3. **Estimator never throws**: it returns `{ cost: null, source: "unknown" }` rather than failing.

This mirrors the current `estimateCost()` graceful-fallback pattern in `extension/ai/cost-tracker.js:69-93`, which falls back to `grok-4-1-fast-reasoning` pricing for any unknown model. **For the new MCP pricing table, change that final fallback to `null` rather than a default model row** — $0 falsely suggests "free call" in telemetry aggregates, and the existing cost-tracker fallback was for AI-provider calls (which we always know we're paying for); MCP calls come from external clients where we may genuinely not know the model.

### 1g. Per-Request Pricing (Edge Cases)

| Provider | Per-request charges that aren't per-token |
|---|---|
| Anthropic | Web search: $10 / 1,000 searches. Code execution: $0.05/hour after free 1,550 hours. Fast mode (Opus 4.6/4.7 preview): **6× standard rates** ($30/$150 per MTok). |
| Google | Grounding with Google Search: $35 / 1,000 grounded prompts after free tier. |
| OpenAI | Tool calls priced by underlying tokens; no flat per-request surcharge in standard pricing. |
| xAI | Text models priced per-token only; image/voice models have per-second / per-minute rates (not relevant for MCP). |

**Decision:** MCP pricing table is **token-only**. Per-request surcharges are out of scope for v0.9.69 (they would require parsing usage envelopes per-tool, which the MCP server does not surface in the response shape today). Document as a TODO under "future telemetry enrichment."

---

## 2. MCP Client → Default-Model Mapping

The visual-session allowlist (single source of truth at `mcp/src/tools/visual-session.ts:9-12`) is:

> `Claude`, `Codex`, `ChatGPT`, `Perplexity`, `Windsurf`, `Cursor`, `Antigravity`, `OpenCode`, `OpenClaw`, `OpenClaw 🦀`, `Grok`, `Gemini`, `Hermes`

### Confirmed Mappings

| Client Label | Default Model (May 2026) | Confidence | Source |
|---|---|---|---|
| **Claude** (Claude Code) | `claude-opus-4-7` (Apr 23, 2026 change for Enterprise PAYG + API users) | HIGH | [Claude Code Model Config docs](https://code.claude.com/docs/en/model-config); confirmed in Anthropic changelog |
| **Codex** (OpenAI Codex CLI/IDE) | `gpt-5.5` (recommended default since April 2026; falls back to `gpt-5.5-codex` for coding-specific flows) | HIGH | [OpenAI Codex Models docs](https://developers.openai.com/codex/models) |
| **ChatGPT** (API consumers labeled this way) | `gpt-5` (the cheapest current default; previous-gen flagship still GA) | MEDIUM | No canonical "ChatGPT" CLI; Codex docs default to 5.5; conservative choice keeps it on standard-tier |
| **Perplexity** (Comet Agent / Pro) | `claude-sonnet-4-6` (Comet Agent default for Pro users since 2026 Q1) | MEDIUM | [Perplexity Changelog Feb 6, 2026](https://www.perplexity.ai/changelog/what-we-shipped---february-6th-2026); Computer agent moved to GPT-5.5 in May |
| **Windsurf** (Cascade) | `SWE-1.5` (Codeium-proprietary, **NO published per-token price**) → conservative fallback: `claude-sonnet-4-6` | LOW | [Windsurf docs](https://docs.windsurf.com/windsurf/cascade/cascade); SWE-1.5 has no public token price |
| **Cursor** | **Auto** mode (router across GPT-5.4 / Claude Sonnet 4.6 / Opus 4.6 / Gemini 3.1 Pro) — **no fixed default**; conservative fallback: `claude-sonnet-4-6` | MEDIUM | [Cursor models docs](https://cursor.com/help/models-and-usage/available-models) |
| **Antigravity** (Google IDE) | `gemini-3.1-pro` (default; Flash optional) | HIGH | [Google Cloud Blog: Antigravity vs Gemini CLI](https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli) |
| **OpenCode** (SST OpenCode CLI) | **No fixed default** — user-configured via `model` in `opencode.json`; conservative fallback: `claude-sonnet-4-6` (the example in OpenCode docs) | MEDIUM | [opencode.ai/docs/config](https://opencode.ai/docs/config/) |
| **OpenClaw** / **OpenClaw 🦀** | `claude-sonnet-4-6` (per OpenClaw docs primary-agent default) | HIGH | [OpenClaw config docs](https://docs.openclaw.ai/cli/mcp); haimaker.ai blog on OpenClaw + Sonnet 4.6 |
| **Grok** (xAI grok CLI / OpenRouter) | `grok-4.3` (current flagship May 2026; replaces deprecated `grok-4` on May 15) | HIGH | docs.x.ai models page |
| **Gemini** (Gemini CLI) | `gemini-2.5-pro` (Gemini 3.x family rollout is documented for Antigravity; Gemini CLI still defaults to 2.5 Pro) | MEDIUM | Conservative — 3.x Pro is documented for Antigravity, 2.5 Pro is the safer Gemini CLI assumption |
| **Hermes** (Nous Research Hermes Agent) | **No fixed default** — Hermes Agent lets the user wire OpenRouter / Nemotron / Mimo / etc. Conservative fallback: `claude-sonnet-4-6` (no Hermes-side single price-able default exists) | LOW | [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/) |

### Recommended Code Shape (TypeScript-ready since the MCP server is TS)

```typescript
// mcp/src/tools/pricing.ts (NEW)
export const MCP_CLIENT_DEFAULT_MODEL: Record<string, string> = {
  Claude: 'claude-opus-4-7',
  Codex: 'gpt-5.5',
  ChatGPT: 'gpt-5',
  Perplexity: 'claude-sonnet-4-6',
  Windsurf: 'claude-sonnet-4-6',          // conservative fallback; SWE-1.5 unpriced
  Cursor: 'claude-sonnet-4-6',            // conservative fallback; Auto-mode router
  Antigravity: 'gemini-3.1-pro',
  OpenCode: 'claude-sonnet-4-6',          // conservative; user-configurable
  OpenClaw: 'claude-sonnet-4-6',
  'OpenClaw 🦀': 'claude-sonnet-4-6',
  Grok: 'grok-4.3',
  Gemini: 'gemini-2.5-pro',
  Hermes: 'claude-sonnet-4-6',            // conservative fallback
};
```

### Confidence Discipline

The current code shape forces each client label to **one** assumed model. In reality, callers may override (Cursor Auto routes anywhere; OpenCode lets you pin any model). Recommend **two fields per telemetry event** rather than just one:

- `mcp_client` — the trusted allowlist label (already enforced).
- `assumed_model` — the default we mapped to (the lookup above).
- *(Future enrichment, NOT this milestone)*: an optional `actual_model` if the MCP request envelope ever carries it.

This keeps the pricing module honest about its assumption boundaries.

---

## 3. Server Stack — Confirmations and Additions

Current `showcase/server/package.json` (HIGH confidence — read directly):

```json
{
  "name": "fsb-server",
  "version": "0.9.50",
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "ws": "^8.19.0"
  }
}
```

### 3a. Already Present (No Changes Needed)

| Library | Pinned | Role in v0.9.69 | Status |
|---|---|---|---|
| `better-sqlite3` | `^11.0.0` | Telemetry tables (events, daily rollups, salt) — same DB file (`fsb-data.db`) | KEEP. v11 is fine; v12.10.0 exists but is **NOT recommended** to upgrade in this milestone (Node 24 build instability per WiseLibs#1376, #1411). |
| `express` | `^4.21.0` | New `/api/telemetry/*` routes mount alongside existing `/api/agents`, `/api/auth`, `/api/pair` | KEEP. |
| `ws` | `^8.19.0` | Dashboard streaming fix uses existing `/ws` handler; no library change | KEEP. |
| `cors` | `^2.8.5` | Telemetry endpoint accepts chrome-extension origin | KEEP. `cors({ origin: true })` already echoes the request origin — works for chrome-extension origins. |
| `dotenv` | `^16.4.0` | Existing env loading | KEEP. |
| `body-parser` (via `express.json`) | bundled in Express 4.21 | Telemetry POST bodies (UUID + event batch) — current `app.use(express.json({ limit: '1mb' }))` covers it | KEEP. Consider **raising limit to `2mb`** for batched payloads (50 events × ~10KB headroom). |

### 3b. NEW Dependency: `express-rate-limit`

**Add to `showcase/server/package.json`:**

```json
"dependencies": {
  "express-rate-limit": "^8.3.0"
}
```

**Why:**
- Telemetry endpoint will be a public `POST /api/telemetry/events` accepting anonymous batches from millions of installs. **No authentication** — adding one would create a tracking vector. Without rate-limiting, a single malicious actor can write-amplify the SQLite DB.
- **MUST be `^8.3.0`** — versions before 8.0.2/8.1.1/8.2.2/8.3.0 are vulnerable to **CVE-2026-30827**: a default-keyGenerator bug collapses **all IPv4 traffic into a single rate-limit bucket** on dual-stack servers. Fly.io (FSB's deploy target per v0.9.6/P40) is dual-stack. v8.3.0+ ships the patched keyGenerator.
- **Custom `keyGenerator` REQUIRED** even on 8.3.0: rate-limit by the IP-hash we already compute (HMAC-SHA256(IP, daily-salt)), not raw IP. This ensures the rate-limiter sees the same identifier the rest of the system sees, and avoids handing the rate-limiter raw IPs at all.

```javascript
// showcase/server/src/middleware/telemetry-rate-limit.js (NEW)
const rateLimit = require('express-rate-limit');
const { hashIp } = require('../utils/telemetry-hash');

module.exports = (db) => rateLimit({
  windowMs: 60_000,                              // 1-minute window
  max: 30,                                       // 30 batches/minute/IP-hash
  keyGenerator: (req) => hashIp(req.ip, db),     // already-hashed IP, never raw
  standardHeaders: 'draft-7',                    // RFC 9239 RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});
```

**Trust-proxy setup:** Express MUST `app.set('trust proxy', 1)` so `req.ip` returns the **client** IP, not Fly.io's proxy. This is **not** currently set in `server.js` — must be added near the top of the file, right after `app = express()`. Without this, ALL telemetry collapses into one synthetic user (the proxy).

**Source:** [express-rate-limit CVE-2026-30827 advisory](https://advisories.gitlab.com/pkg/npm/express-rate-limit/CVE-2026-30827/) ; [GitHub security advisory GHSA-46wh-pxpv-q5gq](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-46wh-pxpv-q5gq).

### 3c. UUID Generation — Decision: Node Built-in `crypto.randomUUID()`

**Do NOT add `nanoid` or `uuid` to dependencies.** Use Node 20+ built-in `crypto.randomUUID()`.

| Approach | Verdict | Reason |
|---|---|---|
| **`crypto.randomUUID()`** (Node 20+, MV3 service worker via `globalThis.crypto`) | **RECOMMENDED** | Zero deps. RFC 4122 v4 compliant. ~3× faster than npm `uuid@v9.x` (350ns vs 1030ns per UUID per dev.to benchmark). Already used in FSB extension at multiple sites (v0.9.60 agent IDs minted via `crypto.randomUUID()`, per PROJECT.md line 305) and server-side in `showcase/server/src/utils/hash.js:7` (`crypto.randomBytes(32)`). |
| `nanoid` | REJECTED | Adds dep. Non-RFC ergonomics. Mixing v4 UUIDs (Chrome side) with nanoid IDs (server side) creates a needless inconsistency. |
| `uuid` (npm) | REJECTED | Adds dep. Slower than native. Pre-Node 14 holdover; obsolete for Node 20+. |

**Code shape (extension side, MV3 service worker):**
```javascript
// extension/telemetry/install-uuid.js (NEW)
async function getOrCreateInstallId() {
  const { fsb_install_uuid } = await chrome.storage.local.get('fsb_install_uuid');
  if (fsb_install_uuid) return fsb_install_uuid;
  const id = globalThis.crypto.randomUUID();   // Available in MV3 SW since Chrome 92
  await chrome.storage.local.set({ fsb_install_uuid: id });
  return id;
}
```

**Code shape (server side):**
```javascript
// showcase/server/src/utils/telemetry-id.js (NEW)
const { randomUUID } = require('crypto');
exports.newEventId = () => randomUUID();
```

**Source:** [MDN Crypto.randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID); [dev.to crypto-randomuuid vs uuid v4 benchmark](https://dev.to/galkin/crypto-randomuuid-vs-uuid-v4-47i5).

---

## 4. IP Hashing — `crypto.createHmac('sha256')` + Daily-Rotated Salt

**Pattern adopted:** Plausible / Fathom / Litlyx — `hash(daily_salt + ip [+ optional UA])`, salt is regenerated and **destroyed** every 24h.

### 4a. Hash Function — Use HMAC-SHA256, Not Plain SHA-256

```javascript
// showcase/server/src/utils/telemetry-hash.js (NEW)
const crypto = require('crypto');
const { getCurrentSalt } = require('./telemetry-salt');

function hashIp(ip, db) {
  if (!ip) return null;
  const salt = getCurrentSalt(db);                         // rotated daily
  return crypto.createHmac('sha256', salt)
    .update(ip)
    .digest('hex');
}

module.exports = { hashIp };
```

**Why HMAC-SHA256 over plain `createHash('sha256').update(salt + ip)`:**
- HMAC is the textbook construction for "secret + message" hashing. It is **immune to length-extension attacks** on Merkle-Damgård hashes (Plausible et al. use the plain construction — fine in practice, but HMAC is one line of code and strictly safer).
- Output is still 64 hex chars (256 bits) — fits comfortably in SQLite TEXT.

**Why SHA-256 over SHA-1 / MD5:** SHA-1 is deprecated; MD5 is broken. SHA-256 is the analytics-industry-standard.

### 4b. Daily Salt Storage and Rotation

**Storage layer:** SQLite table, not env var, not config file. Reasons:
- Future-proofs against multiple Express processes (Fly autoscale) needing the **same** salt for the day.
- The salt must be **destroyed** at end of day — easier as a delete-row than a config rewrite.
- Audit-friendly: a single SQL query verifies "no salt older than 24h exists."
- An env-var salt would be **forever-leaked** if `.env` ever exposes — SQLite rotation cleans up after itself.

**Schema (additive to existing `showcase/server/src/db/schema.js`):**
```sql
CREATE TABLE IF NOT EXISTS telemetry_daily_salt (
  utc_day TEXT PRIMARY KEY,            -- 'YYYY-MM-DD'
  salt    TEXT NOT NULL,               -- 64 hex chars = 32 bytes, single-day use
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Rotation cadence:**
- **One salt per UTC day.** Rotation is automatic on day boundary (lazy: `getCurrentSalt()` checks today's UTC date, inserts a new row if missing, returns it). No cron job needed.
- **Cleanup of old salts:** Lazy cleanup in the same `getCurrentSalt()` call deletes rows where `utc_day < today - 1 day`. We keep today + yesterday transiently (covers late-arriving cross-midnight batches), then nuke older.
- **Salt generation:** `crypto.randomBytes(32).toString('hex')` (32 bytes = 256 bits entropy; matches the existing hash-key pattern in `utils/hash.js:7`).

**Code shape:**
```javascript
// showcase/server/src/utils/telemetry-salt.js (NEW)
const crypto = require('crypto');

let saltCache = { day: null, salt: null };  // process-local memo

function getCurrentSalt(db) {
  const today = new Date().toISOString().slice(0, 10);  // 'YYYY-MM-DD' UTC
  if (saltCache.day === today && saltCache.salt) return saltCache.salt;

  let row = db.prepare('SELECT salt FROM telemetry_daily_salt WHERE utc_day = ?').get(today);
  if (!row) {
    const salt = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO telemetry_daily_salt (utc_day, salt) VALUES (?, ?)').run(today, salt);
    // Lazy cleanup: drop anything older than yesterday
    db.prepare("DELETE FROM telemetry_daily_salt WHERE utc_day < date('now', '-1 day')").run();
    row = { salt };
  }
  saltCache = { day: today, salt: row.salt };
  return row.salt;
}

module.exports = { getCurrentSalt };
```

**Note on UTC vs local:** Use **UTC** for the day boundary so that all server processes (Fly may move workloads across regions) agree on when "today" starts. Drift across time zones would create a brief window where two valid salts exist — not a security issue, but a correctness one for aggregation.

**Source:** [Plausible Data Policy](https://plausible.io/data-policy) (canonical published pattern); [Fathom anonymization writeup](https://usefathom.com/blog/anonymization); [Litlyx Data Policy](https://litlyx.com/data-policy).

### 4c. Trust-Proxy Reminder

Without `app.set('trust proxy', ...)`, `req.ip` returns the **Fly.io proxy** IP for every request, collapsing all telemetry into a single "user." This is the **single most critical Express config item** for telemetry. Add to `server.js` right after `const app = express()`:

```javascript
// Fly.io injects X-Forwarded-For; trust one hop.
app.set('trust proxy', 1);
```

Phase 1 plans should treat this as a **first** code change before any telemetry route lands.

---

## 5. Extension Storage — `chrome.storage.local`

**Decision: `chrome.storage.local` for both install UUID and the batched event queue.**

| Option | Verdict | Reason |
|---|---|---|
| **`chrome.storage.local`** | **RECOMMENDED for both UUID and queue** | Survives SW eviction. Survives extension restart (UUID must be stable across these). 10MB quota by default; **FSB has `unlimitedStorage` already in `manifest.json:9`** — quota effectively unbounded. Async, MV3-native, works in SW context. |
| `chrome.storage.sync` | REJECTED for UUID | Cross-device sync would merge UUIDs across the same Google account → ambiguous user counting. We want one UUID per **install** (one extension on one device), not one per Google account. |
| `chrome.storage.sync` | REJECTED for queue | 100KB / 8KB-per-key quota → events overflow in minutes. |
| `chrome.storage.session` | REJECTED | In-memory only since Chrome 102 — wiped on SW restart. UUID must persist. |
| `IndexedDB` | NOT NEEDED | Overkill for this payload shape. Whole event queue is small JSON blobs; chrome.storage.local serializes JSON natively. IndexedDB adds boilerplate without benefit. |
| `localStorage` | UNAVAILABLE | Not exposed in MV3 service workers. |

### 5a. Install UUID Pattern

```javascript
// extension/telemetry/install-uuid.js (NEW)
async function getOrCreateInstallId() {
  const { fsb_install_uuid } = await chrome.storage.local.get('fsb_install_uuid');
  if (fsb_install_uuid) return fsb_install_uuid;
  const id = globalThis.crypto.randomUUID();
  await chrome.storage.local.set({ fsb_install_uuid: id });
  return id;
}
```

### 5b. Batched Event Queue with Offline Retry

```javascript
// extension/telemetry/queue.js (NEW; shape only)
const QUEUE_KEY = 'fsb_telemetry_queue';
const MAX_QUEUE_BYTES = 256 * 1024;          // 256KB cap; well under unlimitedStorage
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;     // 5 minutes
const MAX_BATCH_SIZE = 50;

async function enqueue(event) { /* read, append, write back, drop oldest on cap overflow */ }
async function flush() { /* POST batch; on success drop; on failure keep with backoff */ }

// Wake schedule via chrome.alarms (MV3 SW-safe):
chrome.alarms.create('fsb-telemetry-flush', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'fsb-telemetry-flush') flush(); });
```

**Wake mechanism:** Use **`chrome.alarms`** with a 5-minute period, not `setInterval` (which dies with the SW). FSB already uses `chrome.alarms` extensively (manifest permissions line 17 + Phase 211 watchdog pattern). **Minimum period for MV3 alarms is 30 seconds.**

**Cap behavior:** When queue exceeds 256KB, drop **oldest** events first (newest are most valuable for "active right now" metrics). Record a counter `dropped_count` in storage so the next successful flush can include it as a sentinel.

**Source:** [Chrome storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage); [MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

---

## 6. Libraries to AVOID

Per the privacy mandate, **none of the following may be added** to extension or server:

| Library / SDK | Why excluded |
|---|---|
| **PostHog SDK** (`posthog-js`, `posthog-node`) | Third-party hosted analytics ingest. Even self-hosted PostHog defaults send to `app.posthog.com`. Contradicts "no PII, ever, no third-party trackers." |
| **Segment** (`@segment/analytics-node`, `analytics-js`) | Event-router-to-vendors model — by design a fanout vector to third parties. |
| **Mixpanel** (`mixpanel-browser`, `mixpanel`) | Hosted analytics, IP-correlated by default. |
| **Datadog** (`@datadog/browser-rum`, `dd-trace`) | Sends to Datadog SaaS, user-session-bound. |
| **Google Analytics** (`gtag.js`, `ga4`) | Cookies + Google-side IP retention. |
| **Sentry** | Even error-only beacons carry breadcrumbs / IP / user context by default — wrong primitive for **anonymous** telemetry. |
| **Amplitude** | Same fanout-to-vendor concern as Segment/Mixpanel. |
| `node-cron` | Not needed — `chrome.alarms` covers extension; server uses lazy-on-request rotation (no daemon needed). |
| `uuid` npm package | Native `crypto.randomUUID()` is faster and dep-free (see §3c). |
| `nanoid` | Same reason as `uuid` — adds dep with no benefit. |
| `node-fetch` | Node 18+ has `fetch` global. Not used in this milestone anyway. |
| `lodash` | No new lodash usage. Server doesn't depend on it; extension is vanilla JS per the no-build-system constraint (PROJECT.md:467-471). |
| `axios` | Server uses native; extension uses `fetch`. No need. |

**Decision rule for any new lib proposal during phase planning:**
1. Is it a privacy / analytics vendor SDK? → **reject.**
2. Does Node ≥20 or Chrome MV3 already cover it natively? → **reject.**
3. Is it the minimum addition that solves a security issue (e.g. `express-rate-limit`)? → **accept with pinned version.**

---

## Recommended Stack — Final Summary Table

### Core Framework (no changes)

| Technology | Version | Purpose | Status |
|---|---|---|---|
| Node.js | ≥20 (current runtime) | Server-side; `crypto.randomUUID()` requires 14.17+, present | UNCHANGED |
| Express | `^4.21.0` | HTTP server | UNCHANGED |
| Chrome MV3 | manifest_version 3 | Extension | UNCHANGED |

### Database (no changes)

| Technology | Version | Purpose | Status |
|---|---|---|---|
| better-sqlite3 | `^11.0.0` | telemetry tables co-located in `fsb-data.db` | UNCHANGED — DO NOT upgrade to v12 in this milestone (Node 24 build instability per WiseLibs#1376, #1411) |

### Infrastructure (no changes)

| Technology | Version | Purpose | Status |
|---|---|---|---|
| `ws` | `^8.19.0` | dashboard streaming fix (existing `/ws` handler) | UNCHANGED |
| `cors` | `^2.8.5` | telemetry POST accepts chrome-extension origin | UNCHANGED |
| `dotenv` | `^16.4.0` | env loading | UNCHANGED |

### NEW Supporting Libraries

| Library | Version | Purpose | Why this version |
|---|---|---|---|
| **`express-rate-limit`** | **`^8.3.0`** | telemetry-endpoint DoS protection on `/api/telemetry/events` | **MUST be ≥ 8.3.0** to avoid CVE-2026-30827 IPv4-mapped collision. Custom keyGenerator required. |

### Built-ins We Newly Rely On (zero new deps)

| Primitive | Where | Purpose |
|---|---|---|
| `crypto.randomUUID()` | Node + MV3 SW | UUID v4 generation for install ID and event IDs |
| `crypto.randomBytes(32)` | Node server | Daily salt generation (already used in `utils/hash.js:7`) |
| `crypto.createHmac('sha256', salt).update(ip).digest('hex')` | Node server | IP hashing |
| `chrome.storage.local` | MV3 SW | Install UUID + batched event queue persistence |
| `chrome.alarms` | MV3 SW | 5-minute periodic flush wakeup |
| `fetch` (global) | MV3 SW | POST telemetry batches to server |

---

## Alternatives Considered (Brief)

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Rate-limit lib | `express-rate-limit ^8.3.0` | `rate-limiter-flexible` | Heavier API surface; we don't need Redis-backed multi-process counting yet (single Fly process). |
| UUID gen | `crypto.randomUUID()` | `nanoid`, `uuid` | Adds deps; native is faster and stable. |
| Salt storage | SQLite row, rotated daily | Env var (`TELEMETRY_SALT`) | Env-var salts are **forever-leaked** if `.env` exposes; SQLite rotation cleans up after itself. |
| IP hash | HMAC-SHA256 | SHA-1 / MD5 / SHA-256 plain | SHA-1/MD5 too weak; HMAC over plain SHA-256 is marginally safer (no length-ext vector) at zero cost. |
| Extension storage | `chrome.storage.local` | `chrome.storage.sync`, IndexedDB | sync conflates accounts; IndexedDB overkill for KB-scale JSON. |
| Cost-tracker engine | Extend existing `extension/ai/cost-tracker.js` | Build new module | Pattern is already shipped, tested, and used in dashboard analytics — reuse the `MODEL_PRICING` schema and add MCP rows + a new resolver function. |

---

## Installation

**Server side (`showcase/server/`):**
```bash
cd showcase/server
npm install express-rate-limit@^8.3.0
```

**Extension side:** **No new npm install.** All extension code uses Chrome MV3 + Node built-ins.

**MCP side:** **No new npm install.** Pricing module is a TypeScript file added to `mcp/src/tools/pricing.ts`.

---

## Pre-Submission Confidence Audit

| Area | Confidence | Verification |
|---|---|---|
| Anthropic pricing (Opus 4.7, Sonnet 4.6, Haiku 4.5) | **HIGH** | platform.claude.com docs fetched live + cross-checked vs BenchLM + MetaCTO (3 sources agree to the cent) |
| Google Gemini pricing (2.5 Pro, 2.5 Flash, 2.5 Flash-Lite) | **HIGH** | ai.google.dev/gemini-api/docs/pricing fetched live |
| xAI Grok pricing (4.3, 4.1-fast) | **HIGH** for ≤200k; **MEDIUM** for >200k upper tier | docs.x.ai fetched live; upper-tier rate not published |
| OpenAI pricing (GPT-5, GPT-5 mini, GPT-5.5) | **HIGH** for 5/5-mini (OpenRouter + multi-source); **MEDIUM** for 5.x family | platform.openai.com returns 403; cross-verified via OpenRouter + AI Cost Check + DevTk |
| DeepSeek pricing (V4-Flash, V4-Pro) | **HIGH** for current; **TIME-BOUNDED** — V4-Pro discount expires 2026-05-31 | api-docs.deepseek.com fetched live |
| Client default-model mapping | **HIGH** Claude/Codex/Antigravity/OpenClaw/Grok; **MEDIUM** Perplexity/ChatGPT/Gemini; **LOW** Windsurf/Cursor/OpenCode/Hermes (router-based or user-configurable) | Per-client docs fetched/searched; LOW-confidence rows use family-of-origin fallback |
| Server runtime deps (Express, ws, better-sqlite3, cors, dotenv) | **HIGH** | Read from `package.json` directly |
| `express-rate-limit` ≥8.3.0 requirement | **HIGH** | NIST + GitHub advisory directly confirmed CVE-2026-30827 and fixed-version list |
| `crypto.randomUUID()` native availability | **HIGH** | Node 14.17+; MDN-confirmed for MV3 SW (Chrome 92+) |
| `chrome.storage.local` for UUID + queue | **HIGH** | Chrome dev docs + MV3 lifecycle docs |
| Daily-salt rotation pattern | **HIGH** | Plausible / Fathom / Litlyx all publish this exact pattern (3 independent sources) |
| Trust-proxy requirement on Fly.io | **HIGH** | Standard Express deployment guidance + Fly.io's dual-stack reality |

**Refresh policy for pricing:** Embed a `PRICING_SOURCE_DATE: "2026-05-14"` constant alongside `MCP_MODEL_PRICING`. On every milestone version bump, the release checklist re-verifies the pricing-page URLs above and updates the date stamp. Pricing volatility is high in this market (DeepSeek V4-Pro 75% discount expires May 31; Grok 4 retires May 15).

---

## Open Questions Flagged for Phase Planning

1. **Cursor / Windsurf default-model accounting:** Both run router architectures with no single pinned default. Phase 1 plan should decide whether to (a) accept the conservative fallback (Sonnet 4.6) and live with some over/under-estimation, or (b) emit `null` cost for these clients and surface them as "uncounted" on the stats page.
2. **Grok >200k tier:** docs.x.ai doesn't publish the upper-tier number. Either email xAI for the rate or treat any request crossing 200k as a `pricing_confidence: "estimated"` row.
3. **Opus 4.7 35% tokenizer drift:** If FSB ever stops trusting MCP-reported token counts and starts retokenizing locally, this drift matters. For v0.9.69 we accept reported tokens at face value.
4. **OpenAI pricing-page 403:** Future automated refresh script should hit OpenRouter as the OpenAI mirror, not platform.openai.com directly. Document this in the refresh-checklist.
5. **GPT-5.5 vs GPT-5 for Codex telemetry:** Codex CLI defaults to 5.5 since April 2026. We should pin `Codex → gpt-5.5`, but earlier installs may still be on 5.0; consider whether to allow a `release_window` tag.

---

## Sources

### Primary (HIGH confidence)
- [Claude API Pricing (platform.claude.com)](https://platform.claude.com/docs/en/about-claude/pricing) — Anthropic official, fetched 2026-05-14
- [Gemini API Pricing (ai.google.dev)](https://ai.google.dev/gemini-api/docs/pricing) — Google official, fetched 2026-05-14
- [xAI Grok Models (docs.x.ai)](https://docs.x.ai/developers/models) — xAI official, fetched 2026-05-14
- [DeepSeek Pricing (api-docs.deepseek.com)](https://api-docs.deepseek.com/quick_start/pricing) — DeepSeek official, fetched 2026-05-14
- [OpenRouter GPT-5](https://openrouter.ai/openai/gpt-5) and [OpenRouter GPT-5 mini](https://openrouter.ai/openai/gpt-5-mini) — primary mirror (platform.openai.com returns 403)
- [OpenAI Codex Models](https://developers.openai.com/codex/models) — confirms Codex CLI default = GPT-5.5
- [Claude Code Model Config](https://code.claude.com/docs/en/model-config) — confirms Claude Code default = Opus 4.7 (April 23, 2026)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — quota + MV3 semantics
- [MDN Crypto.randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) — native UUID availability
- [express-rate-limit CVE-2026-30827 advisory](https://advisories.gitlab.com/pkg/npm/express-rate-limit/CVE-2026-30827/) — required-version baseline
- [GHSA-46wh-pxpv-q5gq](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-46wh-pxpv-q5gq) — fixed-versions list

### Secondary (MEDIUM confidence; multi-source cross-checked)
- [BenchLM Claude Pricing (April 2026)](https://benchlm.ai/blog/posts/claude-api-pricing)
- [MetaCTO Claude API Pricing (May 12, 2026)](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [IntuitionLabs AI API Pricing Comparison (Feb 28, 2026)](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [mem0 xAI Grok API Pricing (March 5, 2026)](https://mem0.ai/blog/xai-grok-api-pricing)
- [DevTk OpenAI API Pricing Guide 2026](https://devtk.ai/en/blog/openai-api-pricing-guide-2026/)
- [The Register: GPT-5.5 cost analysis (2026-05-08)](https://www.theregister.com/ai-and-ml/2026/05/08/gpt-55-may-burn-fewer-tokens-but-it-always-burns-more-cash/5237498)
- [Cursor Available Models](https://cursor.com/help/models-and-usage/available-models)
- [OpenCode Config docs](https://opencode.ai/docs/config/)
- [Antigravity / Gemini CLI (Google Cloud Blog)](https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli)
- [OpenClaw config / Claude Sonnet 4.6 (haimaker.ai)](https://haimaker.ai/blog/claude-sonnet-4-6-openclaw/)
- [Perplexity Changelog Feb 6, 2026](https://www.perplexity.ai/changelog/what-we-shipped---february-6th-2026)
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)

### Privacy / Hashing Pattern (HIGH — pattern confirmed by multiple analytics vendors)
- [Plausible Data Policy](https://plausible.io/data-policy) — canonical daily-salt + SHA-256 pattern
- [Fathom anonymization writeup](https://usefathom.com/blog/anonymization)
- [Litlyx Data Policy](https://litlyx.com/data-policy)

### Performance / Benchmarks
- [crypto.randomUUID() vs uuid v4 benchmark](https://dev.to/galkin/crypto-randomuuid-vs-uuid-v4-47i5)
- [WiseLibs/better-sqlite3 Node 24 compat issue #1376](https://github.com/WiseLibs/better-sqlite3/issues/1376) — reason to stay on v11
