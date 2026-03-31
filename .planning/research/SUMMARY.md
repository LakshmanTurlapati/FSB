# Research Summary: v0.9.11 MCP Tool Quality

**Domain:** Browser automation tool reliability improvements
**Researched:** 2026-03-31
**Overall confidence:** HIGH

## Executive Summary

FSB's MCP manual mode has 7 systemic tool quality issues discovered during a 30-site audit. This research investigated how the browser automation ecosystem (Playwright, Puppeteer, Chrome extension APIs) handles each failure class, and maps those patterns onto FSB's existing architecture to determine the minimal, high-impact fixes.

The core finding is that most of these issues have well-established solutions in the ecosystem, and FSB already has the building blocks for all 7 fixes. The search tool hardcodes Google when site-specific search is a DOM heuristic problem. The read_page tool skips a stability wait that FSB already implements in `waitForPageStability()`. BF cache failures are reactive when Chrome 123+ provides proactive signals via `webNavigation.onCommitted` and the `pageshow` event. Content extraction lacks the scoring heuristic that Readability.js pioneered but can be implemented in ~100 lines. Cookie consent handling exists in autopilot prompts but not in MCP mode's tool layer.

Notably, Playwright's approach to these problems is instructive: it auto-waits before every action (visible, stable, enabled, receives events), scrolls into view automatically, and never hardcodes application-level logic like search routing. FSB's `smartEnsureReady` function in `accessibility.js` already mirrors Playwright's actionability checks. The gap is not architectural -- it is wiring: existing functions are not called at the right time, and reactive recovery should become proactive prevention.

The recommended implementation order prioritizes cookie consent dismissal first (unblocks all other tools), then stability-before-read (single-line fix), then site-aware search (high user visibility), then BF cache proactive injection (eliminates most common failure), then the remaining fixes in decreasing impact order.

## Key Findings

**Stack:** No new libraries needed. All fixes use existing Chrome Extension APIs, existing FSB functions, and lightweight DOM heuristics. Zero external dependencies.

**Architecture:** The content script module system (`accessibility.js`, `actions.js`, `lifecycle.js`, `messaging.js`) already contains all needed primitives. Fixes are wiring changes and new ~50-150 line functions, not architectural changes.

**Critical pitfall:** Cookie consent overlays are the #1 silent failure in MCP mode. They block every interaction tool but are invisible to the AI because `dom-analysis.js` already filters them from snapshots. The AI cannot see the blocker, so it cannot work around it.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Cookie Consent Auto-Dismiss** - Highest impact, unblocks all tools
   - Addresses: Feature 7 (cookie dismiss)
   - Avoids: False positive dismissal of non-cookie overlays

2. **read_page Stability + Content Scoring** - Two related content improvements
   - Addresses: Features 2 (stability) and 6 (truncation)
   - Avoids: Over-engineering with full Readability.js library

3. **Site-Aware Search** - Replaces hardcoded Google redirect
   - Addresses: Feature 1 (site search)
   - Avoids: AI-powered detection (too slow, deterministic heuristics sufficient)

4. **Click Navigation Resilience** - Proactive BF cache handling
   - Addresses: Feature 3 (BF cache)
   - Avoids: Multi-strategy recovery chains (single proactive path)

5. **Interaction Polish** - press_enter fallback + hover viewport
   - Addresses: Features 4 (viewport) and 5 (press_enter)
   - Avoids: Over-scoping viewport fix if hover already works

**Phase ordering rationale:**
- Cookie dismiss must come first because it blocks all other tool testing
- Stability + content are linked (stability feeds content extraction)
- Search is independent but high visibility
- BF cache is important but existing reactive handling provides a safety net
- Interaction polish is lowest risk, existing implementations nearly work

**Research flags for phases:**
- Phase 1 (cookie): Needs testing across actual GDPR sites -- selector lists need real-world validation
- Phase 2 (content scoring): Likely needs iteration on scoring weights -- initial heuristic may under/over-extract
- Phase 3 (search): Standard patterns, unlikely to need additional research
- Phase 4 (BF cache): Standard Chrome API patterns, well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies, all Chrome Extension APIs are well-documented |
| Features | HIGH | 7 clear issues with clear ecosystem precedent for each fix |
| Architecture | HIGH | Existing codebase already has primitives; fixes are wiring changes |
| Pitfalls | MEDIUM | Cookie dismiss false positives and content scoring edge cases need real-world testing |

## Gaps to Address

- Content scoring heuristic weights need empirical tuning on diverse page types (articles, dashboards, social feeds, email)
- Cookie CMP selector coverage needs testing against live sites -- selectors may have changed since site guide was written
- Nested scroll container behavior in `scrollIntoViewIfNeeded` not fully investigated -- may need phase-specific research if hover viewport fix is non-trivial
- `readPage` becoming async: verify all callers handle the promise correctly (messaging.js already awaits, but need to check autopilot path)
