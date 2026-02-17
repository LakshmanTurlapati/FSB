# Roadmap: FSB v0.9.1 AI Situational Awareness

## Overview

This milestone gives the AI complete context about the page and the ability to know when its task is done. The build follows a strict data dependency chain: fix broken signals first (so downstream data is accurate), expand DOM serialization capacity (so the AI sees the full page), improve change detection (so the AI knows what changed), strengthen memory (so the AI remembers what it did), and finally add task completion verification (so the AI knows when to stop). Every phase modifies existing functions across three files -- background.js, content.js, and ai/ai-integration.js -- with no new files and no new dependencies.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Signal Accuracy Fixes** - Fix viewport, CAPTCHA, and Shadow DOM detection so downstream data is trustworthy
- [x] **Phase 2: DOM Serialization Pipeline** - Deliver 3-4x more page context to the AI with budget-based prompt allocation
- [x] **Phase 3: DOM Change Detection** - Replace coarse hash with multi-signal change detection that tells the AI what changed
- [x] **Phase 4: Conversation Memory** - Fix compaction failures and enrich session memory so the AI remembers what it did
- [x] **Phase 5: Task Completion Verification** - Add system-level verification so the AI knows when the task is actually done
- [x] **Phase 6: Unified Session Continuity** - Keep all logs/sessions unified within the same conversation instead of creating new sessions per command
- [x] **Phase 7: Session History UI** - Add conversation history panel to sidepanel with previous sessions list and delete functionality
- [x] **Phase 8: Session Replay** - Use stored memory, action history, and successful action recordings to enable session replay of previously successful automation flows
- [x] **Phase 9: Career Page Search + Google Sheets Data Entry** - Search company career pages for job listings, extract structured data, and enter it into Google Sheets
- [ ] **Phase 10: Memory Tab Population** - Populate the empty Memory tab in the control panel with data from session logs, conversation history, action recordings, hard facts, working selectors, and session replay data

## Phase Details

### Phase 1: Signal Accuracy Fixes
**Goal**: The AI receives accurate signals about viewport visibility, CAPTCHA presence, and element existence -- eliminating false data that corrupts every downstream decision
**Depends on**: Nothing (first phase)
**Requirements**: SIG-01, SIG-02, SIG-03
**Success Criteria** (what must be TRUE):
  1. On Gmail split-pane layout, elements partially visible (25%+ overlap) are classified as in-viewport and appear in the AI prompt
  2. LinkedIn pages no longer report `captchaPresent: true` -- only pages with a visible, interactive CAPTCHA challenge trigger the flag
  3. `waitForElement` finds Shadow DOM elements that `click` can find -- no more timeouts on elements that exist
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md -- Fix viewport detection, CAPTCHA detection, and waitForElement Shadow DOM resolution

**Files changed:**
- `content.js`: `isElementInViewport()` -- overlap-based check with 25% threshold
- `content.js`: Page-level CAPTCHA detection (~line 10098) -- visibility-gated with dimension checks, drop `.captcha-container`/`.captcha-challenge`
- `content.js`: Element-level CAPTCHA detection (~line 10740) -- require `data-sitekey` + size/visibility check
- `content.js`: `waitForElement` handler (~line 6714) -- use `querySelectorWithShadow()` instead of `document.querySelector()`

---

### Phase 2: DOM Serialization Pipeline
**Goal**: The AI sees 3-4x more page context through budget-based prompt allocation, priority-aware truncation, and task-adaptive content modes -- so it can identify elements it previously could not see
**Depends on**: Phase 1 (correct viewport classification means more elements enter the budget)
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04, DIF-03
**Success Criteria** (what must be TRUE):
  1. On a LinkedIn messaging page, the AI prompt contains the full compose area, recipient info, send button, and recent messages -- not just 26% of the page
  2. Element text is long enough to distinguish between similar items: contact names show full "First Last - Title at Company" (up to 150 chars for list items)
  3. No element is ever cut mid-field -- elements are included whole or excluded entirely, prioritized by task relevance
  4. On a simple page (under 30 interactive elements), every element appears in the prompt; on a complex page (100+ elements), the budget scales up with heavier per-element compression
  5. When the AI is filling a form, the prompt emphasizes input fields and labels; when reading content, it emphasizes text; when navigating, it emphasizes links
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Raise HARD_PROMPT_CAP from 5000 to 15000 and add adaptive text limits per element type
- [x] 02-02-PLAN.md -- Budget-partitioned buildPrompt with priority-aware formatElements and budget-aware formatHTMLContext
- [x] 02-03-PLAN.md -- Task-adaptive content modes and dynamic element counts in buildMinimalUpdate

**Files changed:**
- `ai/ai-integration.js`: `HARD_PROMPT_CAP` (~line 1898) -- increase from 5000 to ~15000
- `ai/ai-integration.js`: `buildPrompt()` (~line 1318) -- restructure with tiered budget allocation (40% system, 50% page context, 10% memory)
- `ai/ai-integration.js`: `formatElements()` (~line 2069) -- accept char budget parameter, priority-aware truncation
- `ai/ai-integration.js`: `formatHTMLContext()` (~line 2172) -- accept char budget parameter
- `ai/ai-integration.js`: `buildMinimalUpdate()` (~line 340) -- budget-based element selection with task-adaptive content modes

**Pitfall mitigations:**
- Pitfall 2 (format changes break AI): Increase budget first (5 min, immediate gain), then restructure format. Never change format and prompt instructions in the same step.
- Pitfall 9 (over-aggressive filtering): Dynamic element budget based on page complexity.
- Pitfall 12 (text truncation): Adaptive limits by element type -- 150 chars for list items, 80 chars for buttons/links.

---

### Phase 3: DOM Change Detection
**Goal**: The AI receives structured change descriptors that explain what appeared, disappeared, or changed on the page -- replacing the boolean `domChanged` flag that missed real changes and triggered false stuck detections
**Depends on**: Phase 2 (richer DOM data makes change detection meaningful -- the hash input quality depends on what elements are captured)
**Requirements**: CHG-01, CHG-02, CHG-03, CHG-04
**Success Criteria** (what must be TRUE):
  1. After clicking "Send" on a compose form, the change detector reports specific signals: "compose panel removed, success message appeared" -- not just `domChanged: true`
  2. Scrolling the page does not trigger false "everything changed" signals -- element fingerprints use structural path (not viewport-relative position)
  3. When a success toast appears or a modal opens, the change detector flags the specific state change (content, state, or page-state signal) even if the element count is identical
  4. The stuck detector no longer fires false positives when the AI successfully completed actions that changed content but not element types/counts
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Structural-path element fingerprinting and multi-signal DOM hash (data layer: CHG-02 + CHG-01)
- [x] 03-02-PLAN.md -- Structured change descriptors and multi-signal stuck detection (consumer layer: CHG-03 + CHG-04)

**Files changed:**
- `background.js`: `createDOMHash()` (~line 4494) -- multi-signal hash: content sampling, interaction state signatures, page state flags
- `background.js`: Stuck detection block (~line 5073-5123) -- use structured change signals instead of single hash comparison
- `background.js`: Context object assembly (~line 5376-5401) -- pass `changeSignals` object alongside `domChanged`
- `content.js`: `hashElement()` (~line 222-237) -- remove viewport-relative position, use structural path + stable attributes (id, data-testid, role, name)

**Pitfall mitigations:**
- Pitfall 6 (MutationObserver performance): Bound `pendingMutations` array, debounce processing, release node references.
- Pitfall 7 (hash instability after scroll): Structural path fingerprinting eliminates scroll-induced invalidation.
- Pitfall 11 (diff type-switching): Structured change descriptors provide consistent change information regardless of underlying format.

---

### Phase 4: Conversation Memory
**Goal**: The AI retains meaningful operational history across iterations -- compaction never destroys critical context, every action is described with enough detail to avoid repetition, and hard facts survive indefinitely
**Depends on**: Phase 3 (richer change detection data means richer action descriptions and better verification outcomes to remember)
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04
**Success Criteria** (what must be TRUE):
  1. On a 15+ iteration task, the AI at iteration 12 can reference what text it typed, which buttons it clicked, and which pages it visited -- not just "clicked element" x 10
  2. When compaction fails (API timeout, bad response), a local extractive fallback produces a summary of at least 500 characters preserving action sequence and outcomes
  3. The original task goal, any critical action outcomes (send/submit/purchase with verification result), and discovered working selectors are always present in the AI prompt regardless of how many compaction cycles have run
  4. At session start on a previously-visited domain, the AI receives site-specific procedural memories (e.g., "LinkedIn compose: click message icon, type in compose box, click Send") from MemoryManager
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Data flow fix: enrich slimActionResult, pass lastActionResult, rewrite updateSessionMemory and describeAction for rich action recording (MEM-02)
- [x] 04-02-PLAN.md -- Compaction hardening with retry + local fallback, hard facts section exempt from compaction, long-term memory injection in first-iteration prompt (MEM-01 + MEM-03 + MEM-04)

**Files changed:**
- `background.js`: `slimActionResult()` (~line 1430) -- preserve elementText (50 chars) and selectorUsed
- `background.js`: Context object assembly (~line 5573) -- add lastActionResult to context
- `ai/ai-integration.js`: `updateSessionMemory()` (~line 671) -- fix logic bug, use lastActionResult instead of iterating aiResponse.actions, use _currentTask for task goal
- `ai/ai-integration.js`: `describeAction()` (~line 739) -- include element text and selector context
- `ai/ai-integration.js`: `triggerCompaction()` (~line 757) -- min length validation, retry on short output, local extractive fallback
- `ai/ai-integration.js`: `_localExtractiveFallback()` -- new method for synchronous fallback extraction
- `ai/ai-integration.js`: `buildMemoryContext()` (~line 829) -- hard facts section at top, exempt from compaction
- `ai/ai-integration.js`: `buildPrompt()` (~line 1362) -- inject long-term memories as SITE KNOWLEDGE in first-iteration prompt

**Pitfall mitigations:**
- Pitfall 3 (compaction destroys context): Minimum context floor, local fallback, hard facts section.
- Pitfall 8 (verification-action gap): Structured action recording with verification outcomes feeds into critical action registry (Phase 5).
- Pitfall 10 (compaction API failure): Retry + local extractive fallback guarantees non-empty summary.

---

### Phase 5: Task Completion Verification
**Goal**: The system independently verifies task completion using page signals, action chain analysis, and task-type-specific validators -- so the AI stops when the task is done and continues when it is not, regardless of AI self-report accuracy
**Depends on**: Phase 4 (memory provides the action chain and critical action outcomes that completion verification needs; all prior phases provide the accurate DOM, change, and memory data that validators consume)
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, DIF-01, DIF-02
**Success Criteria** (what must be TRUE):
  1. After sending a LinkedIn message, the system detects the compose window closing and success indicators without waiting for the AI to self-report -- and the session ends within 1-2 iterations of the actual send
  2. For a form submission task, the completion validator checks for URL change, success banner, or form reset before accepting the AI's `taskComplete: true` flag
  3. Irrevocable actions (send, submit, purchase) are recorded in a critical action registry that persists across iterations, is always included in the AI prompt, and blocks re-execution of the same action for 3 iterations
  4. The progress tracker uses multi-signal change data from Phase 3 to distinguish "no progress" from "progress that the old hash missed" -- reducing false hard-stop triggers
  5. When the page shows a success message, confirmation toast, or navigates to a receipt/confirmation URL, the system surfaces this evidence to the AI as a completion signal rather than waiting for the AI to notice
  6. Page intent classification (via `inferPageIntent()`) influences both DOM serialization strategy and completion detection -- a `success-confirmation` page intent triggers a completion candidate check
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- classifyTask() utility, critical action registry with cooldown, enhanced progress tracking with changeSignals (CMP-03 + CMP-04)
- [x] 05-02-PLAN.md -- detectCompletionSignals() proactive scanner, enhanced inferPageIntent() with text validation, completionSignals in DOM response (DIF-01 + DIF-02)
- [x] 05-03-PLAN.md -- validateCompletion() dispatcher with task-type validators, multi-signal scoring, prompt injection of completion signals and critical action warnings (CMP-01 + CMP-02)

**Files changed:**
- `background.js`: Completion validation block (~line 6178-6330) -- restructure with task-type-specific validators (messaging, navigation, form, extraction, search)
- `background.js`: New utility function `classifyTask()` -- map task strings to task types for validator selection
- `background.js`: Progress tracking (~line 6010-6060) -- integrate multi-signal change descriptors from Phase 3
- `background.js`: Critical action registry -- record irrevocable actions with verification results, cooldown mechanism
- `ai/ai-integration.js`: Prompt engineering -- inject completion signals and critical action warnings into AI context
- `content.js`: Proactive completion signal detection -- scan for success messages, confirmation pages, toast notifications, form resets after each action

**Pitfall mitigations:**
- Pitfall 1 (AI self-report unreliable): Multi-signal scoring replaces sole reliance on `taskComplete` boolean.
- Pitfall 8 (duplicate side effects): Critical action registry with cooldown prevents re-execution of send/submit/purchase.

---

### Phase 6: Unified Session Continuity

**Goal:** Keep all logs and sessions in the same file/session as long as follow-up commands are passed in the same conversation, instead of creating a new log/session for each command
**Depends on:** Phase 5 (completion verification determines session boundaries)
**Success Criteria** (what must be TRUE):
  1. Follow-up commands in the same conversation reuse the existing session -- same sessionId, same AI instance, same log entry
  2. AI conversation history, hard facts, and working selectors survive across commands within the same conversation
  3. Per-command counters (iterationCount, stuckCounter) reset on follow-up while cumulative state (actionHistory, AI history) is preserved
  4. Popup restores conversationId after close/reopen so session continuity works across popup lifecycle
  5. Sidepanel "New Chat" button starts a fresh conversation with a new conversationId
  6. Session logs in Options page show a single unified entry per conversation, not one per command
  7. Idle sessions auto-cleanup after 10 minutes of inactivity
**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md -- Session continuity engine: conversationSessions Map, reactivateSession, idleSession with deferred cleanup, AI follow-up context injection
- [x] 06-02-PLAN.md -- UI wiring and logger: conversationId generation/persistence in popup and sidepanel, logger append mode for follow-up commands

**Files changed:**
- `background.js`: `conversationSessions` Map, `handleStartAutomation()` session reuse, `reactivateSession()`, `idleSession()` with deferred cleanup, completion paths use `idleSession()` instead of `cleanupSession()`
- `ai/ai-integration.js`: `injectFollowUpContext()` method for follow-up conversation separator
- `ui/popup.js`: Generate/persist `conversationId` to `chrome.storage.session`, send with `startAutomation`, preserve `currentSessionId` across completions
- `ui/sidepanel.js`: Same as popup.js, plus new `conversationId` on `startNewChat()`
- `utils/automation-logger.js`: `saveSession()` append mode for existing sessions, `logFollowUpCommand()` method

**Pitfall mitigations:**
- Pitfall 1 (service worker restart): `conversationSessions` persisted to `chrome.storage.session` and restored on startup
- Pitfall 2 (memory leak): FIFO cap of 5 conversation sessions + 10-minute idle timeout
- Pitfall 3 (stale state on reactivation): Explicit `reactivateSession()` resets per-command fields, preserves cumulative state
- Pitfall 5 (popup close/reopen): `conversationId` persisted to `chrome.storage.session`
- Pitfall 7 (stale AI context): Follow-up commands inject `[FOLLOW-UP COMMAND]` separator in AI conversation

---

### Phase 7: Session History UI

**Goal:** Add conversation history panel to sidepanel with previous sessions list and delete functionality
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:
- [x] 07-01-PLAN.md -- Session history view toggle, session list display, delete individual/all sessions

**Files changed:**
- `ui/sidepanel.html`: History button in header-actions, history-view container
- `ui/sidepanel.js`: View toggle, session loading from chrome.storage.local, delete functions, helper utilities
- `ui/sidepanel.css`: History view layout, item styles, status badges, active button state, empty state, dark theme

---

### Phase 8: Session Replay

**Goal:** Enable users to select a previous session from history and replay it, re-executing the same sequence of successful actions on the current page. Leverages existing automation-logger session data, actionHistory with enriched results (tool, elementText, selectorUsed), hard facts, and working selectors to reproduce previously successful automation flows.
**Depends on:** Phase 7 (session history UI provides the session selection interface; Phase 4 memory provides enriched action recordings; Phase 6 session continuity provides unified session data)
**Success Criteria** (what must be TRUE):
  1. actionHistory is persisted in fsbSessionLogs when any session is saved
  2. User sees a "Replay" button on sessions with actions in history view
  3. Clicking "Replay" re-executes the successful actions from that session on the current tab
  4. Replay progress is shown step-by-step in the sidepanel chat with percentage
  5. Replay completes with a summary of steps executed successfully and steps skipped
  6. Replay is isolated from normal automation state (no AI involvement, no token cost)
  7. Stop button works during replay to abort
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md -- Persist actionHistory in saveSession, build replay engine (handleReplaySession, executeReplaySequence, loadReplayableSession)
- [x] 08-02-PLAN.md -- Add replay button to history items, wire UI trigger and progress display

**Files changed:**
- `utils/automation-logger.js`: `saveSession()` -- persist actionHistory (filtered to successful, capped at 100)
- `background.js`: `handleReplaySession()`, `executeReplaySequence()`, `loadReplayableSession()`, `getReplayDelay()`, `replaySession` case in message handler
- `ui/sidepanel.js`: `startReplay()` function, replay button in `loadHistoryList()`, replay click event delegation
- `ui/sidepanel.css`: `.history-replay-btn` styles with dark theme variant

**Pitfall mitigations:**
- Pitfall 1 (actionHistory not persisted): saveSession now stores actionHistory alongside logs
- Pitfall 2 (stale selectors): Relies on content.js existing selector fallback chain; non-critical failures skipped
- Pitfall 4 (replay leaks into normal state): isReplay flag, no AI instances, no conversationSessions registration
- Pitfall 5 (type without clearInput): clearInput prepended before every type action during replay
- Pitfall 6 (storage quota): actionHistory capped at 100 entries per session, only successful actions stored

---

### Phase 9: Career Page Search + Google Sheets Data Entry

**Goal:** Enable FSB to search company career pages for relevant job listings, extract structured data, and enter it into Google Sheets -- prioritizing direct company sites over third-party aggregators
**Depends on:** Phase 5 (completion verification), Phase 4 (memory for multi-step workflows)
**Success Criteria** (what must be TRUE):
  1. Task "find jobs at Stripe" navigates to stripe.com/careers before trying Indeed
  2. AI extracts 6 required fields per job: company, role, date, location, description, apply link
  3. AI navigates to Google Sheets via Name Box (not direct cell clicks) and enters data row by row
  4. Career guide activates on Indeed/Glassdoor/BuiltIn URLs and direct company career pages
  5. Productivity guide activates on docs.google.com/spreadsheets URLs
  6. careerValidator detects completion when data is entered into Sheets
**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md -- Site guides for career pages (career.js) and Google Sheets (productivity.js)
- [x] 09-02-PLAN.md -- Career task prompt, classification, and completion validator

**Files changed:**
- `site-guides/career.js`: NEW -- Career & Job Search site guide with URL patterns, selectors, workflows
- `site-guides/productivity.js`: NEW -- Productivity Tools site guide for Google Sheets/Docs
- `background.js`: importScripts for career.js and productivity.js, career classification in classifyTask, careerValidator function and dispatch entry
- `site-guides/index.js`: Career & Job Search and Productivity Tools keyword arrays
- `ai/ai-integration.js`: Career task prompt in TASK_PROMPTS, guide-to-task-type mapping, career keyword detection in detectTaskType

---

### Phase 10: Memory Tab Population

**Goal:** Populate the existing Memory tab in the control panel (options.html) with meaningful data from all available sources -- session logs, conversation history, action recordings, hard facts, working selectors, and replay data -- so the Memory section actually shows useful information instead of being empty
**Depends on:** Phase 9 (all prior phases provide the data sources: Phase 4 memory, Phase 6 session continuity, Phase 7 history, Phase 8 replay)
**Success Criteria** (what must be TRUE):
  1. After completing an automation session, the Memory tab shows episodic memories (what task was done, outcome, duration)
  2. Semantic memories capture learned facts: working selectors per domain, site navigation patterns, form field mappings
  3. Procedural memories capture reusable workflows: multi-step action sequences that succeeded
  4. Memory stats bar shows accurate counts by type, storage usage, and capacity
  5. Search and type filtering work across all populated memories
  6. Consolidate button merges duplicate/stale memories
  7. Export button downloads all memories as JSON
  8. Memories persist across browser restarts and are available for AI retrieval via MemoryManager
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 10 to break down)

**Details:**
The Memory tab UI and lib/memory/ module infrastructure already exist (memory-manager.js, memory-extractor.js, memory-storage.js, memory-retriever.js, memory-consolidator.js). The issue is that the extraction pipeline either isn't triggering properly or isn't producing useful memories from session data. This phase needs to: (a) verify the extraction pipeline fires on session completion, (b) ensure extractAndStoreMemories produces all three memory types from real session data, (c) wire the options.js Memory tab to actually load and display stored memories via the MemoryManager API, and (d) feed richer data into the extraction -- including hard facts, working selectors, action sequences, and site-specific patterns discovered during automation.

---

## Coverage

**All 22 requirements mapped:**

| Requirement | Phase | Description |
|-------------|-------|-------------|
| SIG-01 | 1 | Viewport overlap-based detection |
| SIG-02 | 1 | CAPTCHA visibility gating |
| SIG-03 | 1 | waitForElement Shadow DOM consistency |
| DOM-01 | 2 | Raise HARD_PROMPT_CAP to ~15000 |
| DOM-02 | 2 | Priority-aware whole-element truncation |
| DOM-03 | 2 | Adaptive element text limits |
| DOM-04 | 2 | Dynamic element budget by page complexity |
| DIF-03 | 2 | Task-adaptive DOM content modes |
| CHG-01 | 3 | Multi-signal DOM hash |
| CHG-02 | 3 | Structural path element fingerprints |
| CHG-03 | 3 | Structured change descriptors for AI |
| CHG-04 | 3 | Reduce false stuck detections |
| MEM-01 | 4 | Resilient compaction with retry and fallback |
| MEM-02 | 4 | Structured action results in session memory |
| MEM-03 | 4 | Hard facts section exempt from compaction |
| MEM-04 | 4 | Long-term memory retrieval at session start |
| CMP-01 | 5 | Task-type-specific completion validators |
| CMP-02 | 5 | Multi-signal completion scoring |
| CMP-03 | 5 | Critical action registry with cooldown |
| CMP-04 | 5 | Enhanced progress tracking |
| DIF-01 | 5 | Proactive completion signals |
| DIF-02 | 5 | Page intent-driven context and completion |

**Orphaned requirements:** None
**Duplicate mappings:** None

## Progress

**Execution Order:** 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 (strict sequential, each phase's output feeds the next)

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Signal Accuracy Fixes | 1/1 | Complete | 2026-02-14 |
| 2. DOM Serialization Pipeline | 3/3 | Complete | 2026-02-14 |
| 3. DOM Change Detection | 2/2 | Complete | 2026-02-14 |
| 4. Conversation Memory | 2/2 | Complete | 2026-02-14 |
| 5. Task Completion Verification | 3/3 | Complete | 2026-02-15 |
| 6. Unified Session Continuity | 2/2 | Complete | 2026-02-16 |
| 7. Session History UI | 1/1 | Complete | 2026-02-15 |
| 8. Session Replay | 2/2 | Complete | 2026-02-16 |
| 9. Career Page Search + Sheets | 2/2 | Complete | 2026-02-16 |
| 10. Memory Tab Population | 0/0 | Not planned | - |
