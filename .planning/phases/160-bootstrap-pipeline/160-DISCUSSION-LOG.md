# Phase 160: Bootstrap Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 160-bootstrap-pipeline
**Areas discussed:** Bootstrap phase structure, Deferred init boundary, First interaction trigger, Startup debuggability

---

## Bootstrap Phase Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 4-Phase Sequential | SETTINGS / ENVIRONMENT / TOOLS / SESSIONS as named async functions inside a single swBootstrap() entry point. Replaces scattered onInstalled/onStartup duplication. | Yes |
| 2-Phase (Critical/Deferred) | Minimal: one critical init block, one deferred block. Simpler but doesn't satisfy the 4-phase debuggability criterion. | |
| 4-Phase with Parallel Batch | Settings+Environment run concurrently via Promise.all, then Tools, then Sessions. Marginal <50ms speed gain for added attribution complexity. | |

**User's choice:** 4-Phase Sequential (Recommended)
**Notes:** Research identified natural data dependencies: settings -> environment -> tools -> sessions. Single swBootstrap() consolidates three scattered init locations.

---

## Deferred Init Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Defer WS + analytics | Defer the two actual I/O operations at startup. Site guides and memory modules stay eager (no I/O in constructors). | Yes |
| Defer WebSocket only | Just move fsbWebSocket.connect() out of boot path. Analytics stays eager. | |
| Defer WS + analytics + memory | Aggressive deferral. Risk: memory retrieval runs in first AI iteration, causing silent quality degradation. | |

**User's choice:** Defer WS + analytics (Recommended)
**Notes:** User initially asked for clarification on what "deferred init boundary" means. After explanation of the two I/O operations (WebSocket network call + analytics storage read) that run on every SW wake even with no user present, user confirmed deferring both.

---

## First Interaction Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| First UI onMessage | Trigger on first getStatus from popup/sidepanel (fires on panel open). Secondary trigger in handleStartAutomation covers MCP path. | Yes |
| startAutomation only | Only trigger when first task starts. Tightest deferral but risks race on first command. | |
| You decide | Claude's discretion on trigger mechanism. | |

**User's choice:** First UI onMessage (Recommended)
**Notes:** None.

---

## Startup Debuggability

| Option | Description | Selected |
|--------|-------------|----------|
| logInit with timings | Use existing automationLogger.logInit(phase, status, {durationMs}) for each bootstrap phase. Zero new infrastructure. Explicit flush() at end. | Yes |
| logInit + storage.session state | Option A plus write phase state to chrome.storage.session for post-mortem querying. | |
| You decide | Claude's discretion on debuggability approach. | |

**User's choice:** logInit with timings (Recommended)
**Notes:** None.

---

## Claude's Discretion

- Exact refactoring of onInstalled vs onStartup handlers
- getAnalytics() lazy guard integration
- ensureWsConnected() placement
- Internal structure of _deferredInitDone guard

## Deferred Ideas

None -- discussion stayed within phase scope.
