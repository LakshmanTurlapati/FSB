# Pitfalls Research: Claude Code Architecture Adaptation to Chrome Extension

**Domain:** Adapting a desktop CLI agent architecture (Claude Code) to Chrome Extension MV3 browser automation (FSB)
**Researched:** 2026-04-02
**Confidence:** HIGH (based on direct source analysis of Research/claude-code/src/ and FSB codebase, verified against Chrome MV3 documentation)

---

## Critical Pitfalls

Mistakes that cause data loss, broken automation sessions, or require full subsystem rewrites.

### Pitfall 1: RuntimeSession Assumes Process Persistence -- Service Worker Gets Killed Mid-Session

**What goes wrong:**
Claude Code's `RuntimeSession` (runtime.py) is a long-lived Python dataclass that accumulates state across the entire session: `history`, `routed_matches`, `turn_result`, `stream_events`, `command_execution_messages`, `tool_execution_messages`. The `PortRuntime.bootstrap_session()` method creates this object once and keeps it alive in-process for the duration of the session. The `run_turn_loop()` method runs up to `max_turns` iterations synchronously.

In FSB's Chrome MV3 context, the service worker can be terminated after 30 seconds of inactivity. A single `RuntimeSession`-style object held in a JavaScript variable (`let activeSessions = new Map()`) is lost on every service worker restart. FSB already has this problem partially -- line 2248 of background.js comments "Restored sessions can only be stopped, not resumed (loop state is lost)".

Naively porting the RuntimeSession pattern means the entire session context (routing decisions, history log, execution state) vanishes on service worker kill. The session becomes a zombie -- the UI shows "running" but the automation loop is dead.

**Why it happens:**
Claude Code runs as a Node.js process that lives until the user closes it. Developers reading the RuntimeSession pattern see a clean, elegant object that holds all state. They port it directly, storing the equivalent `RuntimeSession` in a service worker global variable, not realizing that global is ephemeral.

**How to avoid:**
- Split RuntimeSession into two tiers: **hot state** (transient, in-memory) and **warm state** (serializable, persisted to `chrome.storage.session`).
- Hot state: WebSocket connections, active setTimeout handles, content script ports, streaming generators. These cannot be persisted. Accept they will be lost and design recovery paths.
- Warm state: conversation messages, routing decisions, iteration count, token usage, cost tracking. These MUST be persisted after every state change. FSB already does this partially (lines 2194-2233 of background.js) but only persists "essential fields" and the last 5 messages.
- The `run_turn_loop` synchronous multi-turn pattern must stay as FSB's existing `setTimeout` chaining (line 718 of agent-loop.js: "Uses setTimeout-chaining (not while-loop) for Chrome MV3 service worker compatibility"). Never convert it back to a synchronous loop.
- Add a `resume()` capability to restored sessions, not just `stop()`. This requires persisting enough conversation context to reconstruct the API call. FSB currently can't do this (line 2248: "Restored sessions can only be stopped, not resumed").

**Warning signs:**
- Sessions show "running" in UI but no actions are executing
- `session.isRestored === true` with no loop activity
- `activeSessions.size > 0` but no `setTimeout` handles are active
- Users report automation "freezing" after long AI response times

**Phase to address:**
Phase 1 (State and Context Management) -- this is foundational. Every other adaptation depends on sessions surviving service worker restarts.

---

### Pitfall 2: TranscriptStore.compact() Discards Critical Context in Token-Constrained Environments

**What goes wrong:**
Claude Code's `TranscriptStore` (transcript.py) uses a simple `compact(keep_last=10)` that drops all entries except the most recent 10. The `QueryEnginePort` (query_engine.py line 130-132) compounds this: `compact_messages_if_needed()` fires automatically when `mutable_messages` exceeds `compact_after_turns` (default 12). Claude Code can afford aggressive compaction because it operates in a 200K+ token context window where 12 turns of history is generous.

FSB's agent loop already has a more nuanced `compactHistory()` (agent-loop.js line 262) that:
- Triggers at 80% of token budget (not a turn count)
- Keeps the 5 most recent tool_result messages intact
- Replaces old tool results with one-liner summaries
- Never touches system prompt or current iteration messages

If you adopt Claude Code's simpler TranscriptStore.compact() pattern, you overwrite FSB's battle-tested compaction with a dumber version. FSB's 15K prompt budget (with 40/50/10 split for system/context/memory) means every token matters. Dropping messages by turn count rather than token budget wastes context capacity on short turns and blows the budget on long ones.

**Why it happens:**
The TranscriptStore pattern looks cleaner than FSB's sprawling `compactHistory()` function. A developer sees "keep last N" and thinks it is simpler and more maintainable. They miss that Claude Code's generous token budget (max_budget_tokens is 2000 in the Python port, but the real Claude Code uses 200K+) makes the simplistic approach viable there but not here.

**How to avoid:**
- Keep FSB's existing `compactHistory()` approach. It is more sophisticated and better suited to constrained contexts.
- If adopting any TranscriptStore-like abstraction, the `compact()` method must be token-budget-aware, not turn-count-based.
- The compaction strategy must differentiate message types: system prompts are sacred, recent tool results are high-value, old navigation results are expendable.
- Add compaction metrics: track how many tokens were saved per compaction event, and whether compacted sessions still complete successfully.

**Warning signs:**
- AI starts repeating actions it already performed (context about previous actions was compacted away)
- AI asks "what page are we on?" when the current URL was in a compacted message
- Task completion rate drops on multi-step tasks that exceed 10 iterations
- Token usage per turn increases (AI is doing redundant work because it lost context)

**Phase to address:**
Phase 3 (State and Context Management) -- compaction must be designed in tandem with conversation history persistence.

---

### Pitfall 3: File-System Session Store Pattern Breaks Against chrome.storage Constraints

**What goes wrong:**
Claude Code's `session_store.py` writes session data to the filesystem as JSON files (`DEFAULT_SESSION_DIR = Path('.port_sessions')`). The `save_session()` and `load_session()` functions use unrestricted file I/O with no size constraints. The `StoredSession` dataclass stores all messages as a tuple of strings.

Chrome Extensions have no filesystem access. The storage options are:
- `chrome.storage.session`: 10MB total, in-memory, survives SW restarts but cleared on browser close
- `chrome.storage.local`: 10MB default (unlimited with `unlimitedStorage` permission, which FSB has), persisted to disk, async-only
- IndexedDB: Unlimited but complex API

FSB currently persists to `chrome.storage.session` (line 2229 of background.js) with a deliberately slim subset: sessionId, task, tabId, status, startTime, conversationId, and only the last 5 messages. This works because sessions are short-lived.

If you adopt the full StoredSession pattern (storing ALL messages), a 20-turn automation session with DOM snapshots in tool results can easily hit 2-5MB per session. With 5 concurrent sessions, you blow through the 10MB session storage limit. Even with `chrome.storage.local` and `unlimitedStorage`, the serialization/deserialization cost of multi-MB JSON blobs on every state change creates perceptible UI jank.

**Why it happens:**
The file-system pattern makes persistence feel "free" -- write a file, read it back later. No size limits, no serialization overhead concerns. Developers porting this pattern to chrome.storage don't realize that every `chrome.storage.session.set()` call serializes the entire value, and reads deserialize it. With large objects, this adds 50-200ms of latency per read/write.

**How to avoid:**
- Never store full conversation history in `chrome.storage.session`. Keep the current "last N messages" approach.
- Use a tiered storage strategy:
  - `chrome.storage.session`: Minimal session metadata (status, IDs, iteration count, cost). Read on every wake.
  - `chrome.storage.local`: Conversation history for resumable sessions. Write incrementally (append new messages, don't rewrite all).
  - IndexedDB: DOM snapshots, large tool results, debug logs. Use for data that doesn't need to be read on every iteration.
- Implement storage quotas per session: cap stored messages at a byte budget (e.g., 500KB per session), compacting older messages when the budget is exceeded.
- Profile `chrome.storage.session.set()` latency with realistic payloads before committing to a persistence cadence.

**Warning signs:**
- `chrome.runtime.lastError` with "QUOTA_BYTES exceeded"
- Slow session resumption after service worker restart (100ms+ for storage reads)
- UI freezes during rapid tool execution (storage writes on every iteration)
- `chrome.storage.session.get(null)` returning multi-MB payloads

**Phase to address:**
Phase 1 (State and Context Management) -- storage architecture must be decided before building any higher-level features on top of it.

---

### Pitfall 4: Hook Pipeline Crossing Process Boundaries Creates Latency and Reliability Failures

**What goes wrong:**
Claude Code's hooks subsystem has 104 modules (hooks.json shows `module_count: 104`), including tool permission handlers (`PermissionContext.ts`, `coordinatorHandler.ts`, `interactiveHandler.ts`, `swarmWorkerHandler.ts`), notification hooks, and suggestion hooks. In Claude Code, these are synchronous or near-synchronous local function calls within a single Node.js process. A permission check is a function call that takes microseconds.

In FSB, the equivalent pipeline crosses process boundaries:
1. Background (service worker) decides to execute a tool
2. Sends message to content script via `chrome.tabs.sendMessage()` (async, ~5-15ms roundtrip)
3. Content script executes the action in the page context
4. Sends result back to background

Adding a pre-execution hook check (e.g., "is this action permitted on this origin?") to this pipeline doubles the message passing if the check also needs content script data (e.g., checking if the target element is in a sensitive form). Post-execution hooks that need to verify page state add another roundtrip.

Worse, Chrome MV3 message passing is unreliable:
- Content scripts become orphaned after extension updates
- Port connections timeout after 5 minutes
- BF cache can make tabs unreachable
- Service worker restart disconnects all active ports

**Why it happens:**
Claude Code's hook system looks like a clean pattern: define hooks, register handlers, fire hooks at lifecycle points. But the hooks are designed for in-process execution where failure means a caught exception. In Chrome Extensions, failure means a disconnected message channel that silently drops the hook result.

**How to avoid:**
- Classify hooks by their execution boundary:
  - **Background-only hooks**: Permission checks against configuration, cost tracking, rate limiting. These are cheap and reliable -- implement freely.
  - **Content-requiring hooks**: Anything that needs page DOM data. These are expensive -- batch them with the tool execution, not as separate roundtrips.
  - **Post-action hooks**: Verification, state capture. Bundle with the tool result response, not as separate messages.
- Never make a tool execution wait on a cross-process hook response before starting. Use optimistic execution with rollback if the hook fails.
- Design hooks to be fire-and-forget for non-critical paths (logging, analytics) and only block on critical paths (permission denial).
- FSB already uses a pattern where tool execution and result capture happen in one `chrome.tabs.sendMessage()` call. Hooks must piggyback on this, not add separate roundtrips.

**Warning signs:**
- Tool execution latency increases by 2x+ after adding hooks
- Intermittent "Could not establish connection" errors in hook responses
- Hooks silently failing on restored sessions (content script was orphaned)
- Automation "hangs" waiting for a hook response from a tab that navigated away

**Phase to address:**
Phase 4 (Hooks and Permissions Model) -- but the architecture decision (background-only vs cross-process) must be made in Phase 1 design.

---

### Pitfall 5: Permission Model Assumes Hierarchical File Paths -- Web Origins Are Flat and Dynamic

**What goes wrong:**
Claude Code's `ToolPermissionContext` (permissions.py) uses `deny_names` and `deny_prefixes` to gate tools. The permission model is path-based: deny a tool by name or by prefix match. This maps naturally to filesystem operations where `/home/user/sensitive/` can be denied as a prefix.

Web origins don't work this way. An origin like `https://bank.example.com` is either permitted or not -- there's no hierarchical relationship between `https://bank.example.com/accounts` and `https://bank.example.com/settings`. A prefix deny on `bank` would also block `https://bankofamerica.com` and `https://bankruptcy-info.org`. URL paths within an origin have no security significance (same-origin policy treats them identically).

Additionally, web permissions are dynamic: a page at `https://example.com` can embed iframes from `https://banking-widget.com`. The content script runs in the top frame's origin, but the user might want to block actions on the banking widget iframe. This has no analog in Claude Code's file-system model.

**Why it happens:**
File paths and URLs look syntactically similar. Both have hierarchical structure. But file permissions are enforced by the OS, while web permissions are enforced by the browser's same-origin policy -- a fundamentally different model. Developers porting the permission system map URL patterns to path patterns without recognizing the semantic mismatch.

**How to avoid:**
- Design permission rules around **origins** (scheme + host + port), not URL paths.
- Use Chrome's match patterns (`<all_urls>`, `*://*.example.com/*`) which are already well-understood in the extension ecosystem. The manifest already uses them for `host_permissions`.
- Permission categories should be:
  - **Origin allowlist/denylist**: Which sites FSB can automate on
  - **Tool restrictions per origin**: E.g., no `type_text` on banking sites, no `navigate` away from allowed origins
  - **Action-type gates**: E.g., no form submission on sensitive domains, no file downloads
- The `blocks(tool_name)` check from Claude Code is still useful for tool-level gating (deny `navigate` entirely in restricted mode). Keep this but add an `origin` parameter.
- Consider adopting Chrome's `declarativeNetRequest` patterns for expressing URL-based rules.

**Warning signs:**
- Permissions that work in testing fail on sites with CDN subdomains
- Users report automation being blocked on `www.example.com` but not `example.com`
- Permissions don't catch iframe-hosted content
- A "deny banking" rule blocks unrelated sites with "bank" in the domain

**Phase to address:**
Phase 4 (Hooks and Permissions Model) -- permission design must be origin-aware from the start.

---

### Pitfall 6: Deferred Init Pattern Creates Cold-Start Penalty That Stalls First Automation

**What goes wrong:**
Claude Code's `deferred_init.py` delays initialization of plugins, skills, MCP prefetch, and session hooks until after the first prompt is received. This makes startup feel fast (the REPL appears instantly) while heavy work happens in the background. The `DeferredInitResult` tracks what was deferred.

In FSB, the service worker is already cold on every restart (every 30 seconds of inactivity). There's no "startup" to optimize -- every automation request potentially starts from a cold service worker. If tool registration, site guide loading, or permission configuration is deferred, the first tool execution of every session hits an initialization wall.

FSB currently loads everything eagerly via `importScripts()` (background.js lines 1-100 show 90+ importScripts calls loading all site guides, tools, and utilities). This is by design: the service worker must be fully initialized before handling any message, because the next message might arrive 30 seconds after the last one (when the worker was killed and restarted).

**Why it happens:**
Deferred init is a well-known optimization pattern. Developers see Claude Code's clean separation of "init now" vs "init later" and want to apply it. They don't realize that in a service worker context, "later" might be "after the worker was killed and the state was lost," which means the deferred init runs again from scratch anyway.

**How to avoid:**
- Keep FSB's eager `importScripts()` loading for all tool definitions, site guides, and core modules. This is the correct pattern for a service worker that must handle messages immediately after wake.
- Deferred init is only appropriate for resources that are expensive AND rarely needed AND can be loaded on-demand without blocking the caller. In FSB, nothing fits this criteria for the core automation pipeline.
- If adopting any deferred pattern, it must be cache-aware: store the init result in `chrome.storage.session` so re-initialization after SW restart skips the work.
- Profile `importScripts()` cold start time. If it exceeds 500ms, consider code splitting by function (separate scripts for MCP server, dashboard relay, and autopilot core).

**Warning signs:**
- First automation command after browser startup takes 3-5x longer than subsequent ones
- "Tool not found" errors on restored sessions (tool registry wasn't re-initialized)
- `importScripts()` calls in the middle of message handlers (mixing initialization with execution)
- Site guide data is undefined when the first tool execution needs it

**Phase to address:**
Phase 2 (Tool Execution Pipeline) -- tool registration and init strategy must be settled before building the execution registry.

---

### Pitfall 7: Coordinator Multi-Turn Orchestration Assumes Stable Connection to AI Provider

**What goes wrong:**
Claude Code's `QueryEnginePort` (query_engine.py) maintains a stateful conversation: it accumulates `mutable_messages`, tracks `total_usage`, manages a `transcript_store`, and can `stream_submit_message` with generator-based streaming. The `submit_message` method checks `max_turns`, `max_budget_tokens`, and runs compaction -- all assuming the conversation state is maintained reliably between turns.

In FSB, the connection between the background service worker and the AI provider is fragile in multiple ways:
1. Service worker kill interrupts an in-flight API call. The `fetch()` response never arrives. The streaming connection is severed.
2. Network errors during long AI responses (the AI is "thinking" for 3-5 seconds on complex DOM analysis).
3. Rate limiting from AI providers mid-session (especially with Anthropic and OpenAI).
4. The AI provider returns a partial response (JSON truncation -- FSB already handles this in v0.2.1 fixes).

Claude Code can just crash and the user restarts. FSB needs to handle all of these gracefully because the user can't "restart" mid-automation -- they're watching a task execute.

**Why it happens:**
The QueryEnginePort pattern is designed for a request-response conversation model where each turn completes before the next begins. Developers adopt this clean turn-based model without adding the resilience layers that a browser automation context demands.

**How to avoid:**
- Every API call must have a timeout (FSB's existing 30-second timeouts are good).
- Implement turn-level checkpointing: before each API call, persist the current conversation state so it can be replayed if the call fails.
- For streaming responses, buffer chunks and persist partial results. If the service worker is killed mid-stream, the partial result can be used on restart to skip re-requesting.
- Build an explicit retry budget per session (FSB already has retry logic in v0.1.1). The coordinator must know "I've retried 3 times, degrade gracefully" rather than retrying indefinitely.
- Separate the coordinator's conversation state from the API client state. The coordinator should be able to swap AI providers mid-session if one fails.
- Add heartbeat checks: if no progress for 30 seconds, trigger stuck detection (FSB already has this at a higher level).

**Warning signs:**
- Sessions stuck at "Thinking..." for more than 30 seconds
- Token usage doubles on sessions that had mid-session interruptions (replaying context that wasn't checkpointed)
- Rate limit errors causing cascade failures across concurrent sessions
- Partial JSON responses causing action parse failures

**Phase to address:**
Phase 3 (Coordinator/Agent Loop Adaptation) -- resilience must be designed into the coordinator, not bolted on.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store full conversation in chrome.storage.session | Simple persistence model | 10MB limit hit with 3-5 active sessions; serialization jank on every write | Never -- use tiered storage from day one |
| Single global `activeSessions` Map for all state | Easy to access from any message handler | Lost on every SW restart; no concurrent access protection | Only for transient state (current timeout handles). Persist everything else. |
| Synchronous hook checks in message handlers | Simple control flow | Blocks message processing; service worker kill timer counts down during blocking hooks | Only for instant checks (config lookups, deny list matches) |
| Port file-path permission patterns to URL patterns | Familiar code structure from Claude Code | Mismatches with web origin model; false positives/negatives on permission checks | Never -- redesign for web origins |
| Deferred tool registration after first message | Faster perceived cold start | First automation always slow; tool-not-found race conditions | Never in service worker context |
| Compacting by turn count instead of token budget | Simpler compaction logic | Wastes tokens on short turns, blows budget on long turns | Only if all turns are similar size (they aren't in browser automation) |

## Integration Gotchas

Common mistakes when connecting Claude Code patterns to Chrome Extension APIs.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| RuntimeSession -> chrome.storage.session | Serializing the entire session object including non-serializable fields (Promises, setTimeout handles, WebSocket references) | Define explicit `toStorable()` and `fromStored()` methods that whitelist serializable fields. FSB already does this partially (line 2197: "Only persist essential fields"). |
| TranscriptStore -> Conversation persistence | Using TranscriptStore's `compact(keep_last=10)` directly, losing FSB's token-budget-aware compaction | Wrap TranscriptStore in a `BudgetAwareTranscript` that compacts based on estimated token usage, not message count. |
| ExecutionRegistry -> Tool dispatch | Building a Claude Code-style registry that resolves tools by string name at execution time, adding lookup overhead to every tool call | Pre-resolve tool references during registration. FSB's `TOOL_REGISTRY` array with direct object references is already faster than name-based lookup. |
| stream_submit_message -> Streaming responses | Using generator-based streaming (Python `yield`) in a service worker where the generator state is lost on SW kill | Use event-based streaming with explicit state. Each chunk received triggers a state update that is independently resumable. |
| HistoryLog -> Automation logging | Accumulating history events in memory like HistoryLog.events list | Write events to chrome.storage.local incrementally. FSB's `automationLogger` already does this correctly. |
| PortContext -> Extension context | Building context by scanning filesystem (Path.rglob('*.py')) | Build context from chrome.management, chrome.runtime, and known extension structure. No filesystem scanning possible. |

## Performance Traps

Patterns that work at small scale but fail as sessions grow longer or run concurrently.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Persisting full messages array on every iteration | UI jank, slow tool execution | Persist incrementally (append new messages only) | Sessions > 15 iterations with DOM snapshots |
| Loading all 90+ importScripts on every SW wake | 200-500ms cold start before any message can be handled | Code-split into core (always loaded) and optional (loaded on demand by feature) | Noticeable when service worker restarts frequently during active automation |
| Unbounded conversation history in memory | Memory usage grows 1-5MB per session | Token-budget compaction already in agent-loop.js; enforce memory budget too | Sessions > 30 iterations or 3+ concurrent sessions |
| Synchronous chrome.storage.session.get() chains | Each get() is async but they're awaited sequentially | Batch reads with `chrome.storage.session.get(['key1', 'key2', ...])` | Startup with 5+ persisted sessions to restore |
| String-based tool routing (match tool name against registry) | O(n) lookup on every tool call; 42 tools * multi-iteration sessions | Use a Map for O(1) lookup; FSB's `getToolByName()` already does linear scan | Not critical at 42 tools, but matters if tool count grows to 100+ |

## Security Mistakes

Domain-specific security issues when adapting Claude Code's permission model to browser automation.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating URL path as permission scope (like filesystem paths) | Actions permitted on `/public` also permitted on `/admin` because same origin | Permission checks must use origin (scheme+host+port), not URL paths. Path-based rules are cosmetic, not security boundaries. |
| Allowing `navigate` tool to any URL without origin check | Automation can navigate to `chrome://settings`, `file:///`, or `javascript:` URIs | Whitelist navigable schemes (http, https only). Block `chrome://`, `file://`, `data:`, `javascript:` URIs at the permission layer. |
| Storing API keys in session storage alongside session state | chrome.storage.session is accessible to any extension page (popup, options, sidepanel) | Keep API keys in `chrome.storage.local` with encryption (FSB already does this via secure-config.js). Never mix key storage with session state storage. |
| Trusting content script responses without validation | Compromised page could inject false tool results via DOM manipulation | Validate critical tool results in the background script. For sensitive operations (form submission, navigation), verify via chrome.tabs API, not content script report. |
| Permission bypass via tool chaining | Individual tools are gated but chaining `read_page` + `type_text` can exfiltrate data from a protected page | Permission checks must consider the session's accumulated actions, not just the current tool. Flag sessions that read sensitive pages then type into external forms. |

## UX Pitfalls

Common user experience mistakes when adapting Claude Code patterns to browser automation.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "compacting context..." during automation | User thinks the automation is stalling or broken | Compact silently. FSB's orange glow overlay should never show internal housekeeping operations. |
| Adopting Claude Code's multi-step permission prompts | Every tool execution asks "Allow click on bank.com?" -- automation becomes unusable | Use pre-session permission grants: "Allow FSB to automate on [origin]?" once, then all tools on that origin are permitted for the session. |
| Exposing turn counts or token budgets to the user | Users don't understand "12/30 turns used" or "80% context consumed" | Map to task-meaningful metrics: "Step 3 of ~8: filling out shipping address" (FSB's phase-weighted progress model from v0.9.5 already does this well). |
| Streaming raw AI responses to the chat UI during tool execution | User sees JSON tool calls, internal reasoning, DOM analysis text | Continue FSB's existing approach: show action descriptions ("Clicking 'Add to Cart'...") not raw AI output. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Session persistence:** Often missing conversation messages needed for resume -- verify restored sessions can actually continue automation, not just display status
- [ ] **Tool registry adaptation:** Often missing the `_route` metadata (content/cdp/background) that FSB needs -- verify every registered tool has execution routing, not just a name and schema
- [ ] **Compaction implementation:** Often missing token estimation for non-text content (DOM snapshots, tool results with HTML) -- verify compaction accounts for large tool results, not just message text
- [ ] **Permission model:** Often missing iframe-origin checks -- verify permission rules apply to actions inside iframes, not just the top-level page
- [ ] **Hook pipeline:** Often missing disconnection recovery -- verify hooks don't silently fail when content script port is broken
- [ ] **Coordinator pattern:** Often missing mid-stream interruption handling -- verify the coordinator can handle service worker kill during an active API call and resume cleanly
- [ ] **State management:** Often missing storage quota monitoring -- verify the extension monitors chrome.storage.session usage and degrades gracefully before hitting 10MB
- [ ] **Deferred init:** Often missing re-initialization after SW restart -- verify that deferred-init modules are re-initialized when the service worker wakes from termination

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Session state lost on SW kill | MEDIUM | Restore from chrome.storage.session; resume with last 5 messages as context; AI re-assesses current page state via `get_dom_snapshot` |
| Context compaction too aggressive | LOW | Re-read current page state (`read_page`); AI rebuilds understanding from fresh DOM snapshot; cost is 1 extra API call |
| Storage quota exceeded | MEDIUM | Emergency compaction: discard all sessions except the active one; alert user; persist only metadata for historical sessions |
| Hook pipeline broken (orphaned content script) | LOW | Re-inject content script via `chrome.scripting.executeScript()`; FSB already handles BF cache resilience (v0.9.11) |
| Permission model mismatch | HIGH | Requires redesign of permission storage format; migration script needed for existing user permissions; can't be hot-fixed |
| Deferred init stalls first command | LOW | Fall back to eager init; disable deferred loading for the session; re-enable on next cold start with cached init results |
| Coordinator loses API connection | LOW | Retry with exponential backoff; if 3 retries fail, surface error to user with option to retry or abort; persist conversation state for manual resume |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RuntimeSession process persistence | Phase 1: State and Context Management | Automated test: kill service worker during active session, verify session resumes within 2 iterations of where it stopped |
| TranscriptStore aggressive compaction | Phase 3: Coordinator/Agent Loop | Benchmark: run 30-iteration task, verify AI never asks about already-visited pages or repeats completed actions |
| File-system session store | Phase 1: State and Context Management | Load test: 5 concurrent sessions, measure chrome.storage.session total bytes, verify under 8MB |
| Hook pipeline latency | Phase 4: Hooks and Permissions | Timing test: measure tool execution latency with vs without hooks, verify less than 20% overhead |
| Permission model file-path assumption | Phase 4: Hooks and Permissions | Security test: verify `navigate` to `chrome://settings` is blocked; verify same-origin subpaths share permissions |
| Deferred init cold start | Phase 2: Tool Execution Pipeline | Timing test: measure first-tool-execution latency from cold SW start, verify under 500ms total |
| Coordinator connection fragility | Phase 3: Coordinator/Agent Loop | Chaos test: randomly kill service worker during active API calls, verify no data loss and session resumes |

## Sources

- [The extension service worker lifecycle - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Longer extension service worker lifetimes - Chrome for Developers](https://developer.chrome.com/blog/longer-esw-lifetimes)
- [chrome.storage API - Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Message passing - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- Claude Code reference source: `Research/claude-code/src/runtime.py` (RuntimeSession pattern)
- Claude Code reference source: `Research/claude-code/src/transcript.py` (TranscriptStore compaction)
- Claude Code reference source: `Research/claude-code/src/session_store.py` (file-system persistence)
- Claude Code reference source: `Research/claude-code/src/hooks/__init__.py` (104-module hook subsystem)
- Claude Code reference source: `Research/claude-code/src/permissions.py` (ToolPermissionContext)
- Claude Code reference source: `Research/claude-code/src/deferred_init.py` (deferred initialization)
- Claude Code reference source: `Research/claude-code/src/query_engine.py` (QueryEnginePort coordinator)
- FSB source: `background.js` lines 2100-2290 (session persistence and restoration)
- FSB source: `ai/agent-loop.js` lines 253-341 (compactHistory)
- FSB source: `ai/agent-loop.js` lines 718-942 (setTimeout-chaining for MV3)
- FSB source: `ai/tool-definitions.js` (42-tool canonical registry)
- FSB source: `ai/tool-executor.js` (content/cdp/background routing)
- FSB source: `manifest.json` (permissions, service_worker declaration)

---
*Pitfalls research for: Claude Code Architecture Adaptation to Chrome Extension (v0.9.24)*
*Researched: 2026-04-02*
