# Project Research Summary

**Project:** FSB v0.9.2 - Productivity Site Intelligence
**Domain:** Chrome Extension site guide system -- adding intelligence for 7 productivity web apps
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH

## Executive Summary

FSB v0.9.2 adds site intelligence for 7 productivity apps (Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, Jira) to the existing site guide system. The research is unambiguous on the approach: the existing `registerSiteGuide()` / `fsbElements` / `findElementByStrategies()` pipeline is architecturally sufficient with one surgical infrastructure change -- the Stage 1b fsbElements injection in `dom-analysis.js` is hardcoded to Google Sheets URLs and must be generalized to fire for any site guide that provides fsbElements. This is a ~30-line refactor that unlocks the entire system for all 7 new apps. Zero new dependencies, zero new Chrome APIs, zero new mechanical tools are needed.

The 7 apps fall into three complexity tiers that dictate build order. Tier 1 (Google Keep, Todoist) uses standard DOM and works with keyboard shortcuts alone -- these validate the generalized pipeline with minimal risk. Tier 2 (Trello, Google Calendar) adds modal overlays and lazy loading. Tier 3 (Notion, Jira, Airtable) has the most fragile selectors (React CSS Modules, virtual scrolling grids, ProseMirror editors) and needs the most robust multi-strategy selector definitions. All 7 apps are keyboard-first automatable -- the primary guidance strategy is shortcuts over selector-heavy clicking, mirroring the lesson learned from Google Sheets where Name Box + keyboard beats cell clicking.

The top risks are: (1) fsbElements silently ignored if the Stage 1b gate is not generalized first, (2) selector fragility on Notion and Airtable due to CSS Module hashing and virtual scrolling, (3) Todoist's 20+ single-key shortcuts intercepting typed text if input focus is lost, and (4) Jira's ongoing UI migration making selectors a moving target. All four are mitigable through infrastructure-first sequencing, aria/role-first selector strategies, focus-verification warnings, and building for the new Jira UI only.

## Key Findings

### Recommended Stack

No new technologies are needed. The entire milestone operates within the existing vanilla JS / Chrome MV3 / no-build-system constraint. The only infrastructure change is generalizing Stage 1b injection from a Sheets-specific URL gate to a guide-aware fsbElements presence check. Seven new site guide files (~200-300 lines each) follow the established `registerSiteGuide()` pattern from Google Sheets. Five existing files need minor modifications (dom-analysis.js, _shared.js, index.js, background.js, options.html).

**Core technologies (unchanged):**
- Vanilla JS (ES2021+): all site guide code -- no build system, no new dependencies
- Chrome Extension MV3: extension framework -- no new permissions or APIs needed
- `findElementByStrategies()`: multi-strategy selector resolution -- already generic, just unreachable for non-Sheets URLs
- `registerSiteGuide()`: URL pattern matching + guide loading -- works for any site, no changes needed

**Critical version/file requirements:**
- `content/dom-analysis.js` Stage 1b: must remove `/spreadsheets\/d\//` URL gate (~20 lines)
- `site-guides/productivity/_shared.js`: must rewrite to cover non-canvas app paradigms
- `site-guides/index.js`: must add 7 app names to `categoryKeywords` strong/weak lists

### Expected Features

**Must have (table stakes) -- every guide needs these:**
- fsbElements with multi-strategy selectors for key UI anchors (toolbar, search, create buttons)
- Keyboard shortcut documentation in guidance text (verified from official docs, HIGH confidence)
- Create item workflow (page/event/card/note/task/record/issue) -- the #1 user task across all apps
- Edit item workflow -- #2-3 user task
- Navigation guidance between views/sections/items
- Search/filter workflow
- Modal/popover interaction patterns with timing awareness
- Edit mode escape patterns to prevent stuck states
- Warnings about drag-and-drop (anti-feature -- always provide keyboard alternatives)

**Should have (differentiators):**
- Inline shortcut awareness: Todoist Quick Add parsing (`#project @label p1 tomorrow`), Notion slash commands, Calendar natural language dates
- View-specific guidance: board vs list vs calendar views in multi-view apps (Airtable, Jira, Trello)
- Workflow chaining for multi-step operations (create event + invite attendees + set reminder)
- Stuck recovery patterns per app

**Defer (v2+):**
- Mechanical tools for Airtable/Notion databases (keyboard navigation is sufficient for v1)
- Cross-app workflow support (copy Jira issues to Airtable)
- Template-aware creation (Notion templates, Jira issue templates)
- Per-field-type mechanical tools for Airtable's rich field types

### Architecture Approach

All 7 apps integrate into the existing `site-guides/productivity/` category with no structural changes to the registry, guide format, or loading pipeline. The core data flow is: URL match triggers guide loading, Stage 1b injects fsbElements into DOM snapshot via `findElementByStrategies()`, scoring boosts fsbRole elements, and the AI receives guidance text plus annotated snapshot. The only architectural change is lifting Stage 1b out of the `isCanvasBasedEditor()` gate so it runs for any guide with fsbElements -- a ~30-line refactor. Nothing else in the pipeline (actions.js, messaging.js, accessibility.js) needs modification because the existing contenteditable detection already handles Notion/Airtable/Jira typing, and the existing click/type commands work on standard DOM elements.

**Major components:**
1. `content/dom-analysis.js` Stage 1b -- generalize fsbElements injection gate (the prerequisite for everything)
2. 7 new `site-guides/productivity/{app}.js` files -- guidance, fsbElements, selectors, workflows, warnings per app
3. `site-guides/productivity/_shared.js` -- rewrite to cover canvas, block editor, keyboard-first, and card-based paradigms
4. `site-guides/index.js` -- add app names and task keywords to `categoryKeywords`
5. `background.js` + `options.html` -- mechanical additions (7 importScripts lines, 7 script tags)

### Critical Pitfalls

1. **fsbElements injection hardcoded to Sheets URLs** -- Adding fsbElements to any new guide file has ZERO effect until the `/spreadsheets\/d\//` gate in dom-analysis.js is replaced with `if (guideSelectors?.fsbElements)`. This is the single most important infrastructure change and MUST be done before any guide work. (Pitfalls 1, 2, 3)

2. **Selector fragility on React/CSS Module apps** -- Notion (CRITICAL) and Airtable (CRITICAL) use hashed CSS class names that change on every deploy. Jira (HIGH) changes DOM structure with each bi-weekly release. All three need 5-strategy selectors prioritizing aria > role > data-attributes > structural position > class. Class-based selectors should be last resort only. (Pitfalls 7, 10, 11)

3. **Todoist single-key shortcut interception** -- 20+ unmodified single-key shortcuts (Q, E, A, M, etc.) are intercepted by a global keydown listener. If input focus is lost for even one frame, typing "Monday" opens the sidebar (M) and dumps "onday" into search. The guide MUST instruct the AI to always verify input focus before typing. (Pitfall 12)

4. **Drag-and-drop is not automatable** -- Five of 7 apps rely on drag-and-drop for core operations. CDP synthetic events do not work with react-beautiful-dnd and similar libraries. Every drag operation must have a documented keyboard/menu alternative. (Pitfall 16)

5. **Modal/popover timing across all apps** -- All 7 apps use animated overlays (100-400ms render time). Every workflow step that triggers a modal/popover needs waitForElement guidance targeting `[role="dialog"]` or `[role="menu"]`. (Pitfall 15)

## Implications for Roadmap

Based on research, the work decomposes into 4 phases ordered by dependency and complexity.

### Phase 1: Infrastructure Generalization
**Rationale:** Every subsequent phase depends on the Stage 1b fsbElements injection working for non-Sheets URLs. This is the prerequisite. Doing it first also lets us regression-test Google Sheets before any new code is added.
**Delivers:** Generalized fsbElements pipeline, updated shared category guidance, keyword routing for 7 apps, script registration
**Addresses:** fsbElements injection gate removal, _shared.js rewrite, categoryKeywords update, background.js/options.html registration
**Avoids:** Pitfalls 1, 2, 3, 5, 19, 22 (silent fsbElements failure, misleading shared guidance, missing keywords, Google subdomain confusion)
**Estimated scope:** ~5 files modified, ~100 lines changed total. Small but high-impact.

### Phase 2: Simple Apps (Google Keep + Todoist)
**Rationale:** Lowest DOM complexity, best keyboard shortcut coverage, minimal-to-zero fsbElements needed. These validate the generalized pipeline with minimum risk.
**Delivers:** 2 fully functional site guides with guidance, workflows, and warnings
**Addresses:** Table stakes features (create/edit/search/navigate) for 2 apps. Todoist's Quick Add inline syntax is a strong differentiator.
**Avoids:** Pitfalls 12 (Todoist shortcut conflicts via focus-first warnings), 13 (Keep card expansion timing via open-then-edit pattern)
**Estimated scope:** ~400 lines of new guide code.

### Phase 3: Medium Complexity Apps (Trello + Google Calendar)
**Rationale:** Adds modal overlay patterns and SPA routing complexity, but still standard DOM. Trello's `data-testid` selectors are the most stable of all 7 apps.
**Delivers:** 2 site guides with moderate fsbElements (3-5 for Trello, 10-12 for Calendar)
**Addresses:** Modal interaction patterns, SPA URL routing across views, popover timing workflows
**Avoids:** Pitfalls 8 (Calendar time grid via keyboard-first creation), 9 (Trello card modal via broad URL patterns), 16 (drag-and-drop via keyboard alternatives)
**Estimated scope:** ~450 lines of new guide code.

### Phase 4: Complex Apps (Notion + Jira + Airtable)
**Rationale:** Most fragile selectors, most complex interaction patterns, most unknowns. Benefits from pipeline being battle-tested on 4 simpler apps first.
**Delivers:** 3 site guides with extensive fsbElements (12-18 each), rich workflow definitions, and comprehensive warnings
**Addresses:** Block editor patterns (Notion), ProseMirror integration (Jira), virtualized grid navigation (Airtable), view-specific guidance
**Avoids:** Pitfalls 6, 7 (Notion slash commands + hashed CSS), 10 (Airtable virtual scroll), 11 (Jira UI migration), 17, 18 (contenteditable diversity, rate limiting)
**Estimated scope:** ~900 lines of new guide code. Each app needs live DOM inspection.

### Phase Ordering Rationale

- Infrastructure first because the fsbElements gate blocks everything -- no guide's fsbElements work without it
- Simple apps second because they validate the pipeline with minimal selector complexity and serve as templates
- Medium apps third because they introduce modal/popover patterns that inform the complex app guides
- Complex apps last because they have the most unknowns and benefit from lessons learned on simpler apps
- Within Phase 4, Notion before Airtable because block editing is closer to established contenteditable patterns

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Notion):** Block editor contenteditable boundaries, slash command interception, and database view virtualization need live DOM inspection
- **Phase 4 (Airtable):** Canvas vs virtualized DOM rendering is unresolved -- live inspection needed to determine actual approach
- **Phase 4 (Jira):** New UI rollout status and data-testid stability need verification against a live instance

Phases with standard patterns (skip research-phase):
- **Phase 1:** Pure infrastructure refactor of known codebase, no unknowns
- **Phase 2 (Google Keep):** Simplest app, standard DOM, well-documented shortcuts
- **Phase 2 (Todoist):** Excellent official documentation, Quick Add pattern well-understood
- **Phase 3 (Trello):** Atlassian data-testid convention is well-documented and stable

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. Infrastructure refactor verified by reading actual code paths. |
| Features | HIGH | Table stakes from official keyboard shortcut docs. Anti-features well-justified. |
| Architecture | HIGH | Thorough codebase analysis. Stage 1b generalization verified as sufficient. |
| Pitfalls | MEDIUM-HIGH | Infrastructure pitfalls HIGH from code reading. Per-app DOM pitfalls MEDIUM -- need live inspection. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Live DOM selector validation:** All 7 apps need Chrome DevTools inspection to confirm exact fsbElement selector values. Research provides strategy priorities but not concrete selector strings. Each app needs 30-60 minutes of live inspection.
- **Airtable rendering engine:** STACK.md says DOM-based, ARCHITECTURE.md says canvas-rendered. Must resolve via live inspection before deciding keyboard-only vs mechanical tool approach.
- **isCanvasBasedEditor() scope:** If Airtable IS canvas-based, it may need readiness/obscuration bypass additions. Depends on resolving the rendering engine question.
- **Google Calendar shortcut opt-in:** Keyboard shortcuts must be enabled in Calendar settings. Guide needs detection/warning mechanism not yet designed.
- **Jira new UI coverage:** Building for new UI only means old-UI organizations get broken selectors. Accepted tradeoff with no planned mitigation.

## Sources

### Primary (HIGH confidence)
- FSB codebase: `content/dom-analysis.js` Stage 1b (lines 1758-1870), `content/actions.js` type handler (lines 1590-1710), `content/messaging.js` isCanvasBasedEditor (line 217), `background.js` guide resolution (line 8478-8483), `site-guides/index.js`, `site-guides/productivity/google-sheets.js`
- [Notion Keyboard Shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- [Google Calendar Keyboard Shortcuts](https://support.google.com/calendar/answer/37034)
- [Trello Keyboard Shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)
- [Todoist Keyboard Shortcuts](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2)
- [Airtable Keyboard Shortcuts](https://support.airtable.com/docs/airtable-keyboard-shortcuts)
- [Jira Cloud Keyboard Shortcuts](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/)
- [Google Keep Keyboard Shortcuts](https://support.google.com/keep/answer/12862970)

### Secondary (MEDIUM confidence)
- [Jira Cloud Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
- [Jira 2025 UI Evolution](https://community.atlassian.com/forums/Jira-articles/Jira-s-ever-evolving-UI-2025-Edition/ba-p/2966105)
- [Playwright contenteditable bug #36715](https://github.com/microsoft/playwright/issues/36715)
- [Notion Block API](https://developers.notion.com/reference/block)
- [CSS Modules selector fragility](https://github.com/css-modules/css-modules/issues/194)

### Tertiary (LOW confidence -- needs validation)
- Notion DOM class names (`notion-selectable`, `data-block-id`) -- inferred from community tools
- Airtable rendering engine (canvas vs virtualized DOM) -- conflicting findings
- Jira `data-testid` stability across new UI releases
- Google Calendar `data-datekey`, `data-eventid` attributes
- Google Keep `data-id` on note cards

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
