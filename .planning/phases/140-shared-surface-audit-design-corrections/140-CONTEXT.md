# Phase 140: Shared Surface Audit & Design Corrections - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Normalize shared UI building blocks across the popup, sidepanel, control panel, and dashboard so they feel like the same product surface. This phase establishes the shared retouch baseline, removes obvious visual drift, and allows small proof-level per-surface cleanup where needed to validate the baseline. It does not redesign FSB, and it does not absorb the deeper surface-specific passes scheduled for Phases 141 and 142.

</domain>

<decisions>
## Implementation Decisions

### Shared visual baseline
- **D-01:** Phase 140 should normalize shared UI toward the control panel and `ui/options.css` token/surface treatment rather than inventing a new visual language.
- **D-02:** The retouch must preserve FSB's current aesthetic, tone, and orange-led identity; this is a cohesion pass, not a redesign.

### Retouch depth and scope
- **D-03:** Use a medium-strength cohesion pass focused on spacing, typography hierarchy, borders, shadows, and interaction states across audited surfaces.
- **D-04:** Phase 140 may include small per-surface cleanup when it is necessary to prove or land the shared system, but larger layout/composition work stays in Phases 141 and 142.

### Shared primitives to standardize
- **D-05:** Standardize all repeated shared primitives, including cards, buttons, inputs, tabs, badges, status chips, headers/section chrome, message bubbles, and dense list rows.
- **D-06:** Shared primitives should feel intentionally related in default, hover, active, disabled, and busy states, not merely token-matched.

### Claude's Discretion
- Exact token extraction and naming strategy for shared spacing, radius, border, shadow, and surface treatments
- Whether the baseline lands through CSS variable reuse, copied visual treatments, or limited markup cleanup on specific surfaces
- Which small per-surface proofs are strictly necessary in Phase 140 versus better left to Phases 141 and 142

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance criteria
- `.planning/PROJECT.md` — milestone-level constraints: preserve the current FSB aesthetic, improve UI cohesion, and keep the work in retouch territory rather than redesign
- `.planning/REQUIREMENTS.md` — COH-01, COH-02, and COH-03 define the shared-primitive cohesion and anti-drift acceptance criteria for Phase 140
- `.planning/ROADMAP.md` — Phase 140 scope boundary, success criteria, and the planned split between audit/baseline definition and implementation
- `.planning/STATE.md` — current milestone status and active focus for v0.9.21

### Existing UI baselines to audit
- `ui/control_panel.html` — control panel structure that currently best expresses the intended design-system direction
- `ui/options.css` — strongest existing token and surface baseline that Phase 140 should normalize toward
- `ui/sidepanel.html` — audited extension surface with shared controls, message states, and composer chrome
- `ui/sidepanel.css` — sidepanel treatments that have drifted from popup and control panel styling
- `ui/popup.html` — compact extension surface that should inherit the same shared visual primitives
- `ui/popup.css` — popup styles that overlap with sidepanel but currently diverge in multiple details
- `showcase/dashboard.html` — dashboard surface that must still read as the same product family
- `showcase/css/dashboard.css` — dashboard-specific card, badge, and status styling to align against the shared baseline

### Prior context and codebase references
- `.planning/codebase/CONVENTIONS.md` — current project conventions and reuse expectations that planning should preserve
- `.planning/codebase/STRUCTURE.md` — location of extension UI surfaces and supporting assets across the repo
- `.planning/phases/43-agent-dashboard/43-CONTEXT.md` — prior dashboard context that helps preserve established dashboard tone while retouching shared primitives

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/options.css` already contains the richest surface variables and treatments, making it the baseline candidate for shared UI normalization.
- `ui/sidepanel.css` and `ui/popup.css` already share many structures and interaction patterns; they are better candidates for normalization than for separate visual rewrites.
- `showcase/css/dashboard.css` already defines cards, badges, headers, and status treatments that can be mapped onto the same baseline instead of preserved as an isolated visual island.

### Established Patterns
- Each surface is currently a standalone HTML/CSS entrypoint rather than a shared component library, so Phase 140 is primarily a cross-file audit and CSS/system alignment effort.
- FSB already uses an orange accent/highlight language and a dense utility-oriented product tone; the retouch should refine that language rather than replace it.
- Sidepanel and popup clearly belong to the same product family today, but they have drifted in spacing, header framing, message treatments, and state styling.

### Integration Points
- Audit and baseline work centers on `ui/sidepanel.html`, `ui/popup.html`, `ui/control_panel.html`, and `showcase/dashboard.html`.
- Shared style corrections will likely touch `ui/options.css`, `ui/sidepanel.css`, `ui/popup.css`, and `showcase/css/dashboard.css`, with minimal HTML cleanup where CSS alone cannot resolve drift.
- `content/visual-feedback.js` was reviewed during discussion, but behavior changes there belong to Phase 143 unless a shared visual rule needs to be referenced only.

</code_context>

<specifics>
## Specific Ideas

- Keep the current aesthetic and style; fix inconsistencies across surfaces instead of reworking the whole UI.
- Start from the sidepanel, control panel/options dashboard, and other settings-heavy surfaces while preserving the current FSB character.
- Look for anything that feels visually wrong, inconsistent, or error-prone and make it feel cleaner, tighter, and more intentional.

</specifics>

<deferred>
## Deferred Ideas

- Phase 143 overlay direction: when automation targets inline text or a simple link, prefer orange text emphasis over a padded box around the surrounding element geometry.
- Full sidepanel and popup layout/composer/history retouch belongs in Phase 141.
- Dashboard- and control-panel-specific composition/responsive cleanup belongs in Phase 142.

</deferred>

---

*Phase: 140-shared-surface-audit-design-corrections*
*Context gathered: 2026-04-02*
