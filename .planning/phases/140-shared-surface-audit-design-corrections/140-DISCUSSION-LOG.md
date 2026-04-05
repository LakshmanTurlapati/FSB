# Phase 140: Shared Surface Audit & Design Corrections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 140-shared-surface-audit-design-corrections
**Areas discussed:** Visual baseline, retouch strength, shared primitives, phase boundary, overlay direction

---

## Visual Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| A | Normalize shared UI toward the control panel / `ui/options.css` token style | ✓ |
| B | Keep each surface distinct and only fix obvious inconsistencies | |
| C | Adopt shared tokens and surfaces, but keep each page's personality more separate | |

**User's choice:** A
**Notes:** Use the control panel and `ui/options.css` as the baseline reference for shared visual primitives.

---

## Retouch Strength

| Option | Description | Selected |
|--------|-------------|----------|
| A | Conservative polish only, with minimal layout change | |
| B | Medium cohesion pass covering spacing, typography hierarchy, borders, shadows, and states | ✓ |
| C | Stronger cleanup as long as the current aesthetic stays recognizable | |

**User's choice:** B
**Notes:** The user wants visible polish and tighter cohesion without turning this into a redesign pass.

---

## Shared Primitives

| Option | Description | Selected |
|--------|-------------|----------|
| A | Cards, buttons, inputs, tabs, badges, and status chips only | |
| B | The above plus headers, section chrome, empty states, and callouts | |
| C | Everything shared, including message bubbles and dense list rows | ✓ |

**User's choice:** C
**Notes:** The shared baseline should extend across all repeated UI primitives, not just the obvious top-level controls.

---

## Phase Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| A | Keep Phase 140 strictly to shared primitives and audit fixes; surface-specific cleanup stays in later phases | |
| B | Allow a small amount of per-surface cleanup in Phase 140 when needed to prove the shared system | ✓ |
| C | Fold any obvious surface fixes into Phase 140 as they are discovered | |

**User's choice:** B
**Notes:** Small proof-level cleanup is allowed in this phase, but the main surface-specific retouch still belongs to later phases.

---

## Overlay Direction

| Option | Description | Selected |
|--------|-------------|----------|
| A | Prefer text-first emphasis when the target is inline text or a simple link | ✓ |
| B | Keep box highlight everywhere and only make it tighter/smarter | |
| C | Use text-style emphasis for inline targets and box highlight for controls/containers | |

**User's choice:** A
**Notes:** This direction belongs to Phase 143 by the roadmap, so it is recorded as a deferred cross-phase design constraint rather than a Phase 140 implementation requirement.

---

## Claude's Discretion

- Exact token extraction strategy
- Exact CSS/HTML split for landing shared baseline changes
- Which proof-level per-surface corrections are worth doing in Phase 140

## Deferred Ideas

- For inline text and simple links, replace boxy overlay emphasis with orange text-centric highlighting during Phase 143
