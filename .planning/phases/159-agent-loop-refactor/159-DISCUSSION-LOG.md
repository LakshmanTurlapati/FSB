# Phase 159: Agent Loop Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 159-agent-loop-refactor
**Areas discussed:** Wiring strategy, Session resumption scope, What stays in agent-loop.js, Hook emission points

---

## Wiring Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single clean cut (Recommended) | Replace all inline code with module calls at once | ✓ |
| Incremental by concern | Wire one module at a time across multiple plans | |
| You decide | Claude picks | |

**User's choice:** Single clean cut (Recommended)

---

## Session Resumption Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Resume from warm state (Recommended) | Read chrome.storage.session, rebuild from TranscriptStore | ✓ |
| Full replay | Replay all stored messages through API | |
| You decide | Claude picks | |

**User's choice:** Resume from warm state (Recommended)

### Follow-up: Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic (Recommended) | SW wakes up, detects warm session, auto-continues | ✓ |
| User-triggered | Show resume prompt in sidepanel | |
| You decide | Claude picks | |

**User's choice:** Automatic (Recommended)

---

## What Stays in agent-loop.js

| Option | Description | Selected |
|--------|-------------|----------|
| Iteration loop + tool dispatch (Recommended) | Keep runAgentLoop, runAgentIteration, buildSystemPrompt, callProviderWithTools, tool loop | ✓ |
| Everything except extracted functions | Only remove functions that now exist as standalone modules | |
| You decide | Claude picks | |

**User's choice:** Iteration loop + tool dispatch (Recommended)

---

## Hook Emission Points

| Option | Description | Selected |
|--------|-------------|----------|
| Await hooks inline (Recommended) | Await hook.emit() inside async runAgentIteration, setTimeout between iterations | ✓ |
| Fire-and-forget hooks | No await, faster but safety hooks can't halt | |
| You decide | Claude picks | |

**User's choice:** Await hooks inline (Recommended)

---

## Claude's Discretion

- Import/loading pattern for 8 new modules
- How to restructure the imports section
- Whether buildTurnMessages stays inline
- How background.js triggers auto-resumption
- Hook context objects per emission point
- Whether ~700 line target is exact or approximate

## Deferred Ideas

None -- discussion stayed within phase scope
