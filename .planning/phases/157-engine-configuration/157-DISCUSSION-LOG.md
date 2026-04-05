# Phase 157: Engine Configuration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 157-engine-configuration
**Areas discussed:** Tool pool filtering, Permission model, Cost tracker extraction, Execution mode formalization

---

## Tool Pool Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Task-type tiers (Recommended) | Classify task into type and return 12-20 tools | |
| Full set always | Keep sending all 42 tools every call | ✓ |
| AI-selected subset | AI requests tools dynamically via meta-tool | |

**User's choice:** Full set always
**Notes:** Token cost of ~2K for 42 tools is acceptable with grok-4-1-fast's 2M context.

### Follow-up: Module existence

| Option | Description | Selected |
|--------|-------------|----------|
| Thin wrapper (Recommended) | ToolPool class ready for future filtering | |
| Skip module | Keep getPublicTools() inline | ✓ |

**User's choice:** Skip module
**Notes:** No abstraction layer. Add filtering only when needed.

---

## Permission Model

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone module (Recommended) | Full PermissionContext with deny-list and Chrome match patterns | |
| Defer entirely | No permission module now | |
| Minimal stub | Module with isAllowed() that always returns true | ✓ |

**User's choice:** Minimal stub

### Follow-up: Rule storage

| Option | Description | Selected |
|--------|-------------|----------|
| chrome.storage.local (Recommended) | Persists across restarts, Options page manages | ✓ |
| Hardcoded defaults only | Rules in source code only | |
| You decide | Claude picks | |

**User's choice:** chrome.storage.local (Recommended)

---

## Cost Tracker Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Pure extraction (Recommended) | Move estimateCost/MODEL_PRICING to standalone module | ✓ |
| Extraction + budget warnings | Plus emit warnings at 50/75/90% thresholds | |
| Extraction + per-tool tracking | Track cost per tool call for analytics | |

**User's choice:** Pure extraction (Recommended)

### Follow-up: Session limits location

| Option | Description | Selected |
|--------|-------------|----------|
| Separate engine-config module (Recommended) | All limits in ai/engine-config.js | ✓ |
| Inline in cost tracker | Cost tracker owns costLimit, timeLimit stays inline | |
| You decide | Claude picks | |

**User's choice:** Separate engine-config module (Recommended)

---

## Execution Mode Formalization

| Option | Description | Selected |
|--------|-------------|----------|
| Named mode objects (Recommended) | EXECUTION_MODES with per-mode config | ✓ |
| Mode enum only | String enum, no per-mode config | |
| You decide | Claude picks from Claude Code patterns | |

**User's choice:** Named mode objects (Recommended)

### Follow-up: Mode file location

| Option | Description | Selected |
|--------|-------------|----------|
| In engine-config (Recommended) | EXECUTION_MODES in ai/engine-config.js | ✓ |
| Separate file | ai/execution-modes.js | |

**User's choice:** In engine-config (Recommended)

---

## Claude's Discretion

- Exact fields on EXECUTION_MODES mode objects
- CostTracker internal design (stateful vs stateless)
- engine-config loading strategy (eager vs lazy)
- Whether checkSafetyBreakers() moves to cost-tracker or stays for Phase 158 hooks

## Deferred Ideas

- Tool pool filtering by task type -- user chose full set always
- Budget warning events (50/75/90% thresholds)
- Per-tool cost tracking for analytics
