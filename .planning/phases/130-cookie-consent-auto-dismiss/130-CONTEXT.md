# Phase 130: Cookie Consent Auto-Dismiss - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode)

<domain>
## Phase Boundary

Cookie consent overlays are detected and dismissed proactively before they block MCP tool interactions. Detection uses a 3-tier approach: CMP framework identifiers (OneTrust, Cookiebot, TrustArc), generic patterns, and text-based fallback. Only cookie consent is dismissed -- login prompts, newsletter popups, and paywalls are NOT touched.

</domain>

<decisions>
## Implementation Decisions

### Detection Strategy
- **D-01:** 3-tier detection: (1) CMP-specific IDs/classes (OneTrust, Cookiebot, TrustArc, CookieConsent, gdpr-cookie), (2) generic overlay patterns (fixed overlay + cookie keywords), (3) text-based fallback (button text matching "reject", "decline", "necessary only", "essential only").
- **D-02:** The existing cookie-opt-out.js site guide has CMP knowledge -- leverage those selectors.
- **D-03:** Detection runs as a lightweight function callable before read_page and interaction tools.

### Dismiss Strategy
- **D-04:** Click reject/decline/necessary-only buttons preferentially (minimize tracking). Fall back to "Accept" only as last resort if no reject button found.
- **D-05:** After dismiss click, wait briefly (~500ms) for overlay removal, then verify it's gone.

### Safety
- **D-06:** Non-cookie overlays must NOT be dismissed. Verify overlay contains cookie-related text before acting.
- **D-07:** Run proactively in the readPage stability pipeline and before interaction tools, not as a separate tool the AI must remember to call.

### Claude's Discretion
All implementation details not specified above are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/utilities/cookie-opt-out.js -- has CMP patterns and selector knowledge
- content/accessibility.js smartEnsureReady -- integration point for proactive dismiss
- content/messaging.js readPage handler -- integration point for pre-read dismiss

### Integration Points
- New function in content/actions.js or content/accessibility.js -- dismissCookieConsent()
- Call from messaging.js readPage handler (before extractPageText)
- Call from accessibility.js smartEnsureReady (before interaction tools)

</code_context>

<specifics>
## Specific Ideas

- Keep the CMP selector list lightweight (top 10 CMPs cover ~80% of sites)
- The function should be idempotent -- safe to call multiple times on the same page

</specifics>

<deferred>
## Deferred Ideas

- OVLY-05: Newsletter popup auto-dismiss (v2)
- OVLY-06: Paywall detection (v2)

</deferred>
