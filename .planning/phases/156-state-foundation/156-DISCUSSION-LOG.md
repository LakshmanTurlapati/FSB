# Phase 156: State Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 156-state-foundation
**Areas discussed:** Session schema design, Transcript compaction, State event model, Persistence strategy

---

## Session Schema Design

| Option | Description | Selected |
|--------|-------------|----------|
| Full typed schema | Define every session field upfront with defaults. createSession() returns complete typed object. Mirrors Claude Code's RuntimeSession. | x |
| Partial schema + extensible | Define core fields but allow ad-hoc properties for provider-specific data. More flexible, less structured. | |
| You decide | Claude picks the right balance based on codebase needs | |

**User's choice:** Full typed schema (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Annotated in schema | Each field tagged as hot or warm. Schema IS the persistence contract. | x |
| Persistence layer decides | Session object flat. Separate serializer picks fields via whitelist. | |
| You decide | Claude picks based on cleanest SW lifecycle approach | |

**User's choice:** Annotated in schema (Recommended)
**Notes:** None

---

## Transcript Compaction

| Option | Description | Selected |
|--------|-------------|----------|
| Class per session | TranscriptStore instance holds messages[], exposes append/compact/replay/flush. Mirrors Claude Code. | x |
| Stateless utility | Functions that operate on plain message arrays. Simpler but caller manages array. | |
| You decide | Claude picks based on integration with session schema | |

**User's choice:** Class per session (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Separate TurnResult class | Turn results are own typed objects. Transcript stores raw messages. TurnResult wraps iteration metadata separately. | |
| Embedded in transcript | Transcript store knows about turn boundaries. Each turn is structured entry with metadata. | |
| You decide | Claude picks cleanest separation of concerns | x |

**User's choice:** You decide
**Notes:** Claude has discretion on TurnResult placement

---

## State Event Model

| Option | Description | Selected |
|--------|-------------|----------|
| EventEmitter in background | Simple EventEmitter class. Components register via chrome.runtime.onMessage. Emitter translates events to messages. | x |
| Direct chrome.runtime messages | Keep chrome.runtime.sendMessage but standardize event shape. No emitter class. | |
| You decide | Claude picks based on subscriber count and patterns | |

**User's choice:** EventEmitter in background (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Delta events | Events carry only what changed. Subscribers maintain own state view. Lower bandwidth. | x |
| Full snapshot events | Every event carries full session state. Simpler but heavier over WebSocket. | |
| You decide | Claude picks based on subscriber needs | |

**User's choice:** Delta events (Recommended)
**Notes:** None

---

## Persistence Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| After every tool result | Persist after each tool execution. At most one tool call lost on SW kill. ~47ms overhead. | x |
| After every N iterations | Persist every 3-5 iterations. Faster but could lose multiple results. | |
| You decide | Claude picks based on benchmarking | |

**User's choice:** After every tool result (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| chrome.storage.session | Fast, auto-cleared on browser close, 1MB limit fine for active session. History to local on end. | x |
| chrome.storage.local only | Single target. Persistent. Needs manual cleanup. 10MB shared. | |
| You decide | Claude picks based on payload sizes | |

**User's choice:** chrome.storage.session (Recommended)
**Notes:** None

---

## Claude's Discretion

- TurnResult placement (separate class vs embedded in transcript)
- Exact session schema field names/types
- Action history event object shape
- TranscriptStore.compact() trigger mechanism
- EventEmitter implementation details

## Deferred Ideas

None
