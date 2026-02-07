# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

### AI Language Model Providers

**xAI (Primary - Recommended):**
- Endpoint: `https://api.x.ai/v1/chat/completions`
- SDK/Client: Native fetch via `universal-provider.js`
- Auth: Bearer token in `Authorization` header
- Env var: `apiKey` in Chrome storage
- Models:
  - `grok-4-1-fast` - Recommended for automation (2M context, $0.20/$0.50 per 1M tokens)
  - `grok-4-1-fast-reasoning` - With multi-step reasoning
  - `grok-4` - Complex reasoning ($3/$15)
  - `grok-code-fast-1` - Code-focused ($0.20/$1.50)
  - `grok-3`, `grok-3-mini` - Legacy models

**Google Gemini:**
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- SDK/Client: Native fetch via `universal-provider.js`
- Auth: API key in query string (`key=`)
- Env var: `geminiApiKey` in Chrome storage
- Models:
  - `gemini-2.5-flash` - Latest with thinking ($0.30/$2.50)
  - `gemini-2.5-pro` - Most powerful, 2M context ($1.25/$10)
  - `gemini-2.0-flash` - FREE experimental (until May 2025)
  - `gemini-2.0-flash-exp` - FREE experimental

**OpenAI:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- SDK/Client: Native fetch via `universal-provider.js`
- Auth: Bearer token in `Authorization` header
- Env var: `openaiApiKey` in Chrome storage
- Models:
  - `gpt-4o` - Most capable ($5/$20)
  - `chatgpt-4o-latest` - Always newest version
  - `gpt-4o-mini` - Budget option ($0.15/$0.60)
  - `gpt-4-turbo` - Previous flagship ($10/$30)

**Anthropic:**
- Endpoint: `https://api.anthropic.com/v1/messages`
- SDK/Client: Native fetch via `universal-provider.js`
- Auth: `x-api-key` header (no Bearer prefix)
- Env var: `anthropicApiKey` in Chrome storage
- Models:
  - `claude-sonnet-4-5` - Latest flagship ($3/$15)
  - `claude-haiku-4-5` - Fast and cost-effective ($1/$5)
  - `claude-opus-4-1` - Most powerful ($15/$75)

**Custom Endpoints:**
- Supports any OpenAI-compatible API
- Configurable endpoint URL
- Env vars: `customApiKey`, `customEndpoint` in Chrome storage

### Provider Implementation

**Universal Provider Pattern:**
Location: `universal-provider.js`

```javascript
// Provider configurations
const PROVIDER_CONFIGS = {
  xai: {
    endpoint: 'https://api.x.ai/v1/chat/completions',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    keyField: 'apiKey'
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    authQuery: 'key',
    keyField: 'geminiApiKey',
    customFormat: true
  },
  // ... other providers
};
```

**Features:**
- Automatic request format adaptation per provider
- Parameter discovery and retry on errors
- Rate limit handling with exponential backoff
- Response normalization across providers
- Request timeout: 45 seconds default

## Data Storage

**Databases:**
- None (no server-side database)

**Local Storage:**
- Chrome Storage API (`chrome.storage.local`)
  - Configuration and settings
  - API keys (optionally encrypted)
  - Usage analytics data (30-day rolling)
  - Session logs

**File Storage:**
- Local filesystem only (for logs in `Logs/` directory)
- No cloud storage integration

**Caching:**
- In-memory response cache (`ai-integration.js`)
  - Max size: 50 entries
  - Max age: 5 minutes (adjusts based on context)
- Parameter cache per model (`universal-provider.js`)
- DOM state cache for diffing (`dom-state-manager.js`)

## Authentication & Identity

**Auth Provider:**
- None (extension has no user accounts)

**API Key Management:**
- Storage: `chrome.storage.local`
- Optional encryption: AES-GCM with PBKDF2 key derivation
- Implementation: `secure-config.js`
- Master password stored in memory only (never persisted)

**Sensitive Keys Tracked:**
```javascript
// From secure-config.js
sensitiveKeys = [
  'apiKey',
  'openaiApiKey',
  'captchaApiKey',
  'capsolverApiKey',
  'twocaptchaApiKey'
]
```

## CAPTCHA Services (Framework Ready)

**Supported Solvers:**
- CapSolver - `capsolverApiKey`
- 2Captcha - `twocaptchaApiKey`
- None (default)

**Status:** Framework implemented, solver integration planned for v0.3

## Monitoring & Observability

**Error Tracking:**
- Console logging with structured format
- `automation-logger.js` provides categorized logging
- Log persistence to Chrome storage and optional file export

**Logs:**
- In-memory ring buffer (5000 entries max)
- Structured JSON format with timestamps
- Exportable to file via UI
- Categories: error, warn, info, debug

**Analytics:**
- `analytics.js` - Usage tracking and cost calculation
- Tracks: requests, tokens, costs, success rate
- 30-day data retention
- Chart.js visualization in options page

## CI/CD & Deployment

**Hosting:**
- Self-hosted Chrome Extension (load unpacked)
- Chrome Web Store (planned for v0.4)

**CI Pipeline:**
- None currently configured

**Build Process:**
```bash
# From package.json
npm run package  # Creates fsb-v0.9.0.zip for distribution
```

## Environment Configuration

**Required env vars (Chrome Storage):**
- At least one AI provider API key:
  - `apiKey` (xAI) - OR
  - `geminiApiKey` (Google) - OR
  - `openaiApiKey` (OpenAI) - OR
  - `anthropicApiKey` (Anthropic)

**Optional env vars:**
- `captchaApiKey` - For CAPTCHA solving
- `customEndpoint` - For custom AI providers
- `customApiKey` - For custom AI providers

**Secrets location:**
- All secrets stored in `chrome.storage.local`
- Optional encryption via master password
- Never committed to repository

## Webhooks & Callbacks

**Incoming:**
- None (extension does not expose endpoints)

**Outgoing:**
- AI API calls only
- No webhook notifications
- No telemetry or analytics to external services

## Chrome Extension Permissions

**From `manifest.json`:**
```json
{
  "permissions": [
    "activeTab",      // Access current tab
    "scripting",      // Inject content scripts
    "storage",        // Chrome storage API
    "tabs",           // Tab management
    "windows",        // Window management
    "sidePanel",      // Side panel UI
    "debugger",       // DevTools Protocol (keyboard emulation)
    "webNavigation"   // Navigation events
  ],
  "host_permissions": [
    "<all_urls>"      // Access to all websites
  ]
}
```

## Rate Limiting & Quotas

**Implementation:** `universal-provider.js`

```javascript
// Rate limit handling
const MAX_RATE_LIMIT_RETRIES = 3;
const DEFAULT_REQUEST_TIMEOUT = 45000;

// Exponential backoff: 1s, 2s, 4s, 8s (max 60s)
waitTime = Math.min(state.backoff * Math.pow(2, attemptNumber - 1), 60000);
```

**Per-Provider Limits:**
- xAI: Varies by model and account tier
- Gemini: Free tier has usage limits
- OpenAI: Account-based rate limits
- Anthropic: Account-based rate limits

---

*Integration audit: 2026-02-03*
