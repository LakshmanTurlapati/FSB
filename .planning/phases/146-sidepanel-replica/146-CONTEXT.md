# Phase 146: Sidepanel Replica - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Pixel-accurate recreation of the real FSB sidepanel Chat view in the showcase "See It in Action" section. The replica must be visually indistinguishable from the real sidepanel in both dark and light themes, using the corrected rec- token baseline from Phase 145.

</domain>

<decisions>
## Implementation Decisions

### Sidepanel Content & State
- Show mid-automation state (messages flowing, amber status dot) -- more engaging for visitors
- Display 4-5 message bubbles: 1 user + 2 AI + 1 action + 1 system -- covers all bubble types concisely
- Show model selector in input bar with "grok-4-1-fast" as selected model -- matches real default
- Include footer attribution text "Powered by FSB v0.9.22" matching real footer

### Animation & Interaction
- Sequential fade-in with 200ms stagger per message -- matches existing cascade pattern in recreations.js
- Include CSS-only pulsing amber status dot animation
- Show subtle orange glow highlight on the target element in the last action message

### Claude's Discretion
- Exact message content text (should be realistic automation scenario)
- CSS class naming within the rec- namespace
- Whether to add new animation function or extend existing initSidepanelAnimation()

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- showcase/css/recreations.css -- rec-sidepanel classes already exist, corrected tokens from Phase 145
- showcase/js/recreations.js -- initSidepanelAnimation() with IntersectionObserver cascade
- showcase/about.html -- existing Recreation 1 section with browser-frame container
- .planning/phases/145-fresh-ui-audit-token-baseline/145-TOKENS.md -- token reference document

### Established Patterns
- .browser-frame > .browser-header > .browser-content container pattern
- --rec-sp-* CSS variable namespace for sidepanel tokens
- IntersectionObserver with threshold 0.3 for scroll-triggered animations
- Message cascade with staggered opacity transitions

### Integration Points
- Replace existing Recreation 1 HTML in about.html "See It in Action" section
- Update rec-sidepanel CSS in recreations.css
- Add/update animation in recreations.js

</code_context>

<specifics>
## Specific Ideas

From 145-TOKENS.md structural gap analysis, the sidepanel replica is missing:
- surface-subtitle element below header title
- historyBtn, newChatBtn icon buttons in header
- mic-btn in input bar
- author-footer at bottom
- Correct AI message border color (--fsb-primary-soft not old blue)
- Correct action message border color (--fsb-info not old blue)

</specifics>

<deferred>
## Deferred Ideas

- Interactive tab switching (Chat/Agents/History) -- deferred to future per requirements scope
- Functional typing in input bar -- static replica only

</deferred>
