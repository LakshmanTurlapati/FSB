# Phase 141: Sidepanel & Popup Retouch - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the sidepanel and popup as operator-facing chat surfaces so they feel like two intentional variants of the same FSB product surface. This phase improves hierarchy, spacing, state feedback, header/actions, history/composer treatments, and shared control behavior without changing automation behavior or redesigning the product.

</domain>

<decisions>
## Implementation Decisions

### Surface roles
- **D-01:** The sidepanel should read as the persistent workspace variant: roomier, calmer, and better able to carry history and longer-running task context.
- **D-02:** The popup should read as the compact quick-launch variant: denser, faster, and more action-forward, while still clearly belonging to the same product family as the sidepanel.

### Retouch emphasis
- **D-03:** Strengthen hierarchy through small chrome and spacing changes, not through layout reinvention. Minimal markup hooks are allowed where CSS alone is insufficient.
- **D-04:** Header, status, composer, footer, and message/action-state treatments are the primary focus areas; deeper dashboard/settings work remains in Phase 142.

### Interaction-state polish
- **D-05:** Busy, ready, error, pinned, and history-active states should feel deliberate and readable, not like incidental class changes.
- **D-06:** Shared controls must keep the same semantics and behavior; this phase improves visual feedback and hierarchy only.

### Sidepanel-specific direction
- **D-07:** The history view should feel like a first-class subview of the sidepanel, with clearer section chrome and better item/action affordances.
- **D-08:** The sidepanel footer can reinforce the persistent-workspace character, but it should stay subtle and informational.

### Popup-specific direction
- **D-09:** The popup should emphasize quick task entry, compact status clarity, and pin-window affordance without becoming visually crowded.
- **D-10:** Pinning/persistent-window status may be surfaced visually, but no new window-management behavior should be introduced.

### the agent's Discretion
- Exact header microcopy for surface labels and footer metadata
- Whether state-driven polish lands via body data attributes, container classes, or both
- Exact spacing/radius tweaks for message lists, composer chrome, and action-summary treatments

</decisions>

<specifics>
## Specific Ideas

- Keep the current FSB aesthetic and the Phase 140 baseline; this is a cleaner, tighter, more premium pass, not a redesign.
- The sidepanel should feel like the place where a user stays; the popup should feel like the place where a user starts.
- Busy states should read clearly in the header and composer instead of relying only on icon swaps.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope
- `.planning/PROJECT.md` — v0.9.21 remains a polish milestone, not a redesign
- `.planning/REQUIREMENTS.md` — SID-01, SID-02, POP-01, and POP-02 define the acceptance criteria for this phase
- `.planning/ROADMAP.md` — Phase 141 goal, scope boundary, and success criteria
- `.planning/phases/140-shared-surface-audit-design-corrections/140-CONTEXT.md` — locked baseline decisions from the shared-surface phase
- `.planning/phases/140-shared-surface-audit-design-corrections/140-UI-SPEC.md` — the approved shared retouch baseline and design-system rules

### Sidepanel sources
- `ui/sidepanel.html` — sidepanel structure, header actions, history view, chat area, footer
- `ui/sidepanel.css` — current sidepanel hierarchy, history surface, composer, state treatments
- `ui/sidepanel.js` — running/idle/error state changes, history toggling, replay/history behavior

### Popup sources
- `ui/popup.html` — popup structure, header actions, chat area, composer, footer
- `ui/popup.css` — current popup hierarchy, action states, completion states, compact surface treatments
- `ui/popup.js` — running/idle/error state changes, stop flow, test API, pin-window behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/fsb-ui-core.css` now provides the shared token and primitive layer; Phase 141 should build on it instead of introducing a new local system.
- `ui/sidepanel.css` and `ui/popup.css` already share large sections of message and composer styling, making them good candidates for tightly related retouch passes.

### Established Patterns
- Both surfaces use contenteditable chat input, the same message taxonomy, Font Awesome icons, and similar running/error state classes.
- The sidepanel swaps the send button into a stop button in-place; the popup uses a dedicated stop button. That semantic difference should remain, but both should feel intentional.

### Integration Points
- If visual state styling needs stronger hooks, the safest integration point is state/view data attributes set from `ui/sidepanel.js` and `ui/popup.js`.
- Sidepanel history polish should stay inside the existing `showHistoryView` / `showChatView` structure instead of rewriting navigation.

</code_context>

<deferred>
## Deferred Ideas

- Control panel and showcase/dashboard composition work belongs to Phase 142.
- Overlay precision changes for links/text targets belong to Phase 143.
- Final cross-surface polish fixes and regression cleanup belong to Phase 144.

</deferred>

---

*Phase: 141-sidepanel-popup-retouch*
*Context gathered: 2026-04-02*
