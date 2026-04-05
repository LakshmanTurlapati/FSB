# Phase 158: Hook Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 158-hook-pipeline
**Areas discussed:** Hook registration pattern, Safety breaker migration, Progress consolidation scope, Hook error isolation

---

## Hook Registration Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Map of arrays (Recommended) | Map<eventName, handler[]>, registration order execution | ✓ |
| Priority-ordered handlers | Each handler has priority number, lower runs first | |
| You decide | Claude picks | |

**User's choice:** Map of arrays (Recommended)

### Follow-up: Class design

| Option | Description | Selected |
|--------|-------------|----------|
| New class (Recommended) | Separate HookPipeline in ai/hook-pipeline.js | ✓ |
| Extend emitter | Add hooks to SessionStateEmitter | |

**User's choice:** New class (Recommended)

---

## Safety Breaker Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap as hook handlers (Recommended) | Keep standalone functions, create thin wrappers | ✓ |
| Rewrite as pure hooks | Delete originals, rewrite as hook handlers | |
| You decide | Claude picks | |

**User's choice:** Wrap as hook handlers (Recommended)

---

## Progress Consolidation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Create hook only (Recommended) | Create hook, Phase 159 replaces sendStatus calls | ✓ |
| Create and replace all | Create hook AND replace all 10+ sendStatus calls now | |
| You decide | Claude picks | |

**User's choice:** Create hook only (Recommended)

---

## Hook Error Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Catch, log, continue (Recommended) | Try/catch per hook, errors logged, pipeline continues | ✓ |
| Fail the iteration | Throwing hook stops iteration immediately | |
| You decide | Claude picks | |

**User's choice:** Catch, log, continue (Recommended)

---

## Claude's Discretion

- Hook handler context parameter shape per event type
- sync vs async emit()
- LIFECYCLE_EVENTS constant design
- Hook wrapper function style
- Permission denial result format for AI

## Deferred Ideas

- Content-script-requiring hooks (Pitfall 4)
- Hook priority ordering
- Hook middleware pattern (context modification between hooks)
