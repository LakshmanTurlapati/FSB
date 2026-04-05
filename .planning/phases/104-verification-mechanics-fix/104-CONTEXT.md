# Phase 104: Verification Mechanics Fix - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three systemic issues found during Phase 103 validation testing: CDP tool action results incorrectly reporting failure, completion detection stuck on dynamic pages, and stale sessions blocking new task launches. These fixes enable the autopilot to achieve the 90%+ pass rate required by VALID-02.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure/bug-fix phase. Key diagnostic context:

**VMFIX-01: CDP Tool Action Results**
- CDP handlers in background.js (handleCDPMouseClick at line 12164) return `{success: true}` after successful debugger dispatch
- Content script cdpClickAt (content/actions.js:5244) sends chrome.runtime.sendMessage back to background, waits for response
- Round-trip: background→content(executeAction)→content calls cdpClickAt→sendMessage to background(cdpMouseClick)→CDP→response
- Possible failure points: chrome.debugger.attach fails if already attached, sendMessageWithRetry timeout, message port disconnection
- In validation testing, 100% of CDP actions reported success=false despite visible execution
- Fix should ensure CDP tools report success=true when dispatch completes without error

**VMFIX-02: Completion Detection**
- validateCompletion() at background.js:11275 uses multi-signal scoring (CMP-01 + CMP-02)
- After validation, waitForPageStability at line 11305 waits for DOM stability (500ms stable, 3000ms max)
- On real-time pages (TradingView, video players), DOM never stabilizes -- autopilot gets stuck at 74-78%
- AI emits "done" command but multi-signal validator + stability gate blocks it
- Fix should prioritize explicit AI done/fail signals over DOM stability on dynamic pages

**VMFIX-03: Session Auto-Expiry**
- Existing cleanup at background.js:2034 removes idle sessions after 30 minutes (STALE_THRESHOLD)
- Running sessions with no iteration progress can block new task launches
- Fix should add an inactivity timeout: if no new iteration in 5 minutes, mark session as expired

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- handleCDPMouseClick/Drag/etc. in background.js:12164+ -- CDP dispatch handlers returning {success: true/false}
- verifyActionEffect in content/actions.js:401 -- action verification (NOT called for CDP tools, but click/type/etc.)
- validateCompletion() in background.js (CMP-01/CMP-02) -- multi-signal completion validator
- waitForPageStability at background.js:11305 -- DOM stability gate before confirming completion
- Session cleanup interval at background.js:2034 -- existing 30min stale session cleanup

### Established Patterns
- Action results flow: background→content(executeAction)→tool→result→content→background→actionHistory
- CDP tools use chrome.debugger.attach/detach per action (stateless, no persistent debugger session)
- Completion signals: aiResponse.taskComplete, validateCompletion scoring, waitForPageStability gate
- Session tracking: activeSessions Map, status field (running/idle/error/stopped), periodic cleanup

### Integration Points
- content/actions.js CDP tool functions (5 tools: cdpClickAt, cdpClickAndHold, cdpDrag, cdpDragVariableSpeed, cdpScrollAt)
- background.js automation loop (action execution at line 10615-10660, completion check at line 11274-11310)
- background.js session cleanup interval (line 2034-2053)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- bug-fix phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
