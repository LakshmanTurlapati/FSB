# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Chrome Extension MV3 with Message-Passing Architecture

**Key Characteristics:**
- Service Worker background script orchestrates automation sessions
- Content scripts injected into web pages for DOM manipulation
- Multiple UI entry points (popup, sidepanel, options) communicate via message passing
- AI integration layer abstracts multiple LLM providers (xAI, OpenAI, Anthropic, Gemini)
- Event-driven automation loop with intelligent stuck detection and recovery

## Layers

**Background Layer (Service Worker):**
- Purpose: Central orchestrator for automation sessions, AI communication, and state management
- Location: `background.js`
- Contains: Session lifecycle management, message routing, AI integration, analytics tracking
- Depends on: `config.js`, `init-config.js`, `ai-integration.js`, `automation-logger.js`, `analytics.js`, `keyboard-emulator.js`
- Used by: Popup, Sidepanel, Options UI, Content scripts

**Content Script Layer:**
- Purpose: DOM analysis, action execution, page state monitoring
- Location: `content.js`, `automation-logger.js` (injected)
- Contains: DOM traversal, element identification, action tools (click, type, scroll, etc.), mutation observers
- Depends on: Background script via chrome.runtime messaging
- Used by: Background script for DOM reads and action execution

**AI Integration Layer:**
- Purpose: Abstract AI provider differences, handle prompt engineering, response parsing
- Location: `ai-integration.js`, `universal-provider.js`, `ai-providers.js`
- Contains: AIIntegration class, UniversalProvider class, provider configurations, tool documentation, task prompts
- Depends on: External AI APIs (xAI, OpenAI, Anthropic, Google)
- Used by: Background script for task planning

**UI Layer:**
- Purpose: User interaction, task input, status display
- Location: `popup.js`, `popup.html`, `popup.css`, `sidepanel.js`, `sidepanel.html`, `sidepanel.css`, `options.js`, `options.html`, `options.css`
- Contains: Chat interfaces, settings management, analytics dashboard, theme support
- Depends on: Background script via chrome.runtime messaging
- Used by: End users

**Configuration Layer:**
- Purpose: Settings persistence, API key management, model configuration
- Location: `config.js`, `secure-config.js`, `init-config.js`
- Contains: Config class, encrypted storage helpers, model listings, default settings
- Depends on: Chrome storage APIs
- Used by: All other layers

**Analytics/Logging Layer:**
- Purpose: Usage tracking, cost calculation, debugging, session logging
- Location: `analytics.js`, `automation-logger.js`
- Contains: FSBAnalytics class, AutomationLogger class, pricing data, performance metrics
- Depends on: Chrome storage APIs
- Used by: Background script, Options dashboard

## Data Flow

**Automation Task Flow:**

1. User enters task in Popup/Sidepanel UI (`popup.js` / `sidepanel.js`)
2. UI sends `startAutomation` message to background script (`background.js`)
3. Background creates session, ensures content script injected in target tab
4. Background requests DOM state from content script via `getStructuredDOM` message
5. Content script (`content.js`) analyzes DOM, returns structured data
6. Background passes DOM + task to AIIntegration (`ai-integration.js`)
7. AIIntegration builds prompt, calls AI provider via UniversalProvider (`universal-provider.js`)
8. AI returns planned actions (JSON with tool calls)
9. Background parses response, sends action commands to content script
10. Content script executes actions (click, type, etc.), returns results
11. Background checks completion, loops back to step 4 if not complete
12. Background sends status updates to UI throughout process

**Message Types:**
- `startAutomation`: UI -> Background (initiate task)
- `stopAutomation`: UI -> Background (cancel task)
- `getStatus`: UI -> Background (query session state)
- `getStructuredDOM`: Background -> Content (request page state)
- `executeAction`: Background -> Content (perform action)
- `statusUpdate`: Background -> UI (progress notification)
- `sessionResult`: Background -> UI (completion status)

**State Management:**
- Sessions stored in `activeSessions` Map (in-memory) + `chrome.storage.session` (persistence)
- DOM state tracked via `DOMStateManager` class in content script
- Conversation history maintained per-session in `AIIntegration` for multi-turn efficiency
- Analytics data persisted to `chrome.storage.local`

## Key Abstractions

**Session:**
- Purpose: Represents an active automation task with full state
- Examples: Created in `background.js` via `handleStartAutomation()`
- Pattern: State machine with status (running, stopped, completed), action history, stuck detection

**DOMStateManager:**
- Purpose: Efficient DOM comparison and delta generation
- Examples: `content.js` line ~20-450
- Pattern: Observer pattern with MutationObserver, hash-based change detection

**AIIntegration:**
- Purpose: AI communication with retry logic and caching
- Examples: `ai-integration.js` line ~150-900
- Pattern: Queue-based request processing, multi-turn conversation management

**UniversalProvider:**
- Purpose: Adapter for multiple AI APIs
- Examples: `universal-provider.js`
- Pattern: Strategy pattern - adapts request/response format per provider

**Tools:**
- Purpose: Browser action primitives executable by content script
- Examples: `content.js` `tools` object (~line 1755+)
- Pattern: Command pattern - each tool is a function with standard params/result interface

## Entry Points

**Extension Popup:**
- Location: `popup.html` loaded when extension icon clicked
- Triggers: User interaction
- Responsibilities: Quick task input, session status, settings access

**Side Panel:**
- Location: `sidepanel.html` opened via `chrome.sidePanel.open()`
- Triggers: User explicitly opens side panel
- Responsibilities: Persistent chat interface, extended automation sessions

**Options Page:**
- Location: `options.html` opened via extension settings
- Triggers: User clicks options, or right-click extension icon
- Responsibilities: API key configuration, model selection, analytics dashboard

**Background Service Worker:**
- Location: `background.js` registered in manifest
- Triggers: Extension install, browser startup, message reception, tab events
- Responsibilities: Session orchestration, AI calls, message routing, keep-alive

**Content Script:**
- Location: `content.js` injected per manifest `content_scripts` config
- Triggers: Page load (document_idle), or manual injection via `chrome.scripting.executeScript`
- Responsibilities: DOM analysis, action execution, page monitoring

## Error Handling

**Strategy:** Multi-level recovery with classification and specialized handlers

**Patterns:**
- `FAILURE_TYPES` enum classifies errors (communication, DOM, selector, network, timeout, bfcache)
- `RECOVERY_HANDLERS` map provides specialized recovery per error type
- `sendMessageWithRetry()` wraps all content script communication with automatic retry
- AI requests use exponential backoff (1s, 2s, 4s) with up to 3 retries
- Stuck detection triggers alternative action strategies
- Content script re-injection on communication failures
- Session persistence survives service worker restarts

**Error Classification (background.js ~line 528-545):**
```javascript
const FAILURE_TYPES = {
  COMMUNICATION: 'communication',
  DOM: 'dom',
  SELECTOR: 'selector',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  PERMISSION: 'permission',
  BF_CACHE: 'bfcache'
};
```

## Cross-Cutting Concerns

**Logging:**
- `AutomationLogger` class provides structured logging
- Methods: `logSessionStart`, `logIteration`, `logAction`, `logAIResponse`, `logStuckDetection`
- Logs persisted to chrome.storage and available for export
- Console output with level-based formatting

**Validation:**
- DOM state validated before AI calls
- AI responses validated via `isValidResponse()` before use
- Result validation via `isValidResult()` before marking task complete
- URL/page type validation via `isRestrictedURL()`

**Authentication:**
- API keys stored in chrome.storage.local
- Optional encryption via `secure-config.js` with master password
- Keys passed to AI providers via settings object, never logged

**Performance:**
- DOM delta optimization reduces payload size
- Response caching with context-aware keys
- Multi-turn conversations reuse context
- Smart delays adapt to action types and error rates
- Keep-alive mechanism prevents service worker shutdown during automation

---

*Architecture analysis: 2026-02-03*
