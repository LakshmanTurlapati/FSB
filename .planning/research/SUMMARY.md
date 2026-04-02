# Project Research Summary

**Project:** FSB v0.9.22 — Showcase High-Fidelity Replicas
**Domain:** Static UI replica integration into existing showcase site
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

The v0.9.22 milestone is a focused visual fidelity upgrade to the FSB showcase site. The task is replacing approximate CSS mockups of the extension's sidepanel and control panel with pixel-accurate HTML/CSS replicas, and adding a net-new MCP-in-Claude-Code terminal section that has zero visual representation today. This is not a new-technology problem — the existing showcase infrastructure (pure vanilla HTML/CSS/JS, no build system, `rec-` namespaced CSS classes, IntersectionObserver animations) already handles everything needed. The core challenge is accurate color token mapping and structural alignment between the real extension CSS and the recreation CSS.

The recommended approach is to extend the existing `recreations.css` and `recreations.js` patterns in place rather than extracting real extension CSS directly. This preserves the working isolation strategy (`--rec-*` variable namespace, `[data-theme]` toggle convention, browser-frame container pattern) and avoids introducing Chrome extension runtime dependencies into a static web context. All changes are confined to three existing files: `showcase/about.html`, `showcase/css/recreations.css`, and `showcase/js/recreations.js`. No new files, no new libraries, no build step.

The critical risks are CSS variable collisions if any extension CSS is copied without namespace translation, and fidelity drift in future milestones when extension UI evolves but replicas are not updated. Both are mitigated through the `rec-` prefix discipline already established in the codebase and version-stamped sync comments in the HTML. The MCP terminal section is well-scoped as a net-new component: pure CSS colored spans with a new `initTerminalAnimation()` function following the existing IIFE typing animation pattern.

## Key Findings

### Recommended Stack

No new dependencies. The entire milestone uses the existing showcase stack. The real extension source files (`ui/sidepanel.html`, `ui/sidepanel.css`, `ui/options.css`, `shared/fsb-ui-core.css`) serve as read-only reference material for exact color values, font sizes, border radii, and shadows.

**Core technologies:**
- Vanilla CSS (`recreations.css`): All replica styling with `--rec-*` token namespace — already proven, extends naturally without a build step
- Vanilla JS (`recreations.js`, ES2021+, IIFE pattern): Typing animations and IntersectionObserver cascades — existing functions cover most animation needs
- Font Awesome 6.6.0: Icon library already loaded via CDN on all showcase pages — no new CDN links needed
- CSS Custom Properties with `[data-theme]`: Theme-aware styling for dark/light toggle — established pattern in showcase
- Inline SVG (native): Charts in dashboard replica — existing `rec-line-svg` polyline pattern, no chart.js needed

**Technologies evaluated and rejected:**
- xterm.js: 180KB+ interactive terminal emulator — overkill for static showcase animations
- Termynal.js: Cannot represent Claude Code's nested tool-use block structure; external dependency for something `recreations.js` already handles
- marked.js in showcase: Runtime markdown parsing for statically known content — unnecessary 35KB dependency
- chart.js: Full charting library for a single static SVG polyline

### Expected Features

Research identified a clear priority order based on visitor impact and implementation dependencies. See FEATURES.md for detailed specifications, sample content, and complexity estimates.

**Must have (table stakes):**
- 1:1 sidepanel replica (Chat view): The primary user interface. Current replica has header button gaps, missing mic/footer elements, and color drift (`--rec-sp-bg: #1f2937` vs real `--bg-primary: #262626`).
- 1:1 control panel replica (Dashboard view): Second most visible surface. Current replica has icon mismatches (`fa-database` vs real `fa-brain` for Memory), missing nav items ("Help & Documentation"), and warm/cool color palette drift.
- MCP terminal example (autopilot: `run_task`): MCP integration is called out on the landing page with a dedicated callout card but has zero visual evidence. Highest-impact missing element relative to effort.
- Theme-correct rendering (dark + light): Site has a working theme toggle. Replicas must respect it. Specific token gaps identified in both replicas.
- Scroll-triggered entrance animations: Existing IntersectionObserver cascade pattern. Removing would be a regression.

**Should have (differentiators):**
- MCP terminal example (manual mode: multi-tool orchestration): Shows the unique "Claude Code controls your browser" value proposition with `read_page` + `click` flow.
- Animated typing effect in sidepanel messages: Character-by-character reveal using existing cascade infrastructure.
- Live element highlight pulse: Orange glow pulse on targeted element in form recreation — matches real Shadow DOM glow overlay.

**Defer (v2+):**
- Interactive tab switching in sidepanel replica (Chat/Agents/History tabs): Significant content creation for a differentiator, not table-stakes.
- MCP agent creation terminal example: Third-priority MCP example. Autopilot and manual mode cover the essential story.
- Control panel tab navigation beyond Dashboard: Dashboard-only view is sufficient for the showcase.
- Full options page feature parity: Recreating all 7+ tabs is months of work for marginal showcase value.

### Architecture Approach

All changes are confined to existing files within the `showcase/` directory. Three CSS namespaces coexist and must remain separate: the showcase design system (`--primary`, `--bg-primary`), recreation mockups (`--rec-*`), and the real extension UI (`--fsb-*`, per-surface variables). The strategy is to audit real extension CSS for exact values and manually port those values into the existing `rec-` namespace rather than extracting or importing extension files directly. See ARCHITECTURE.md for complete data flow diagrams, component interaction maps, and integration points.

**Major components (all existing files, MODIFY-only):**
1. `showcase/about.html` — Page shell. Update Recreation 1-3 HTML structure; add MCP terminal section.
2. `showcase/css/recreations.css` (currently 1282 lines) — All replica styling. Port exact color/size/radius/shadow values; add `rec-mcp-*` terminal classes.
3. `showcase/js/recreations.js` — Animation logic. Add `initTerminalAnimation()` function following existing IIFE + IntersectionObserver pattern.

**New component to build within existing files:**
- `.rec-mcp-terminal`: Dark terminal window with macOS chrome (reusing `.browser-frame`), monospace `<pre>` blocks, semantic CSS classes (`.term-prompt`, `.term-tool-block`, `.term-result-block`, `.term-cursor`), IntersectionObserver-triggered typing animation.

**Data flow:** fully static. No API calls, no runtime state. User visits about.html → CSS loads → `main.js` triggers theme toggle and scroll reveal → `recreations.js` IntersectionObserver fires → message cascade, counter animation, terminal typing animation run once → final state holds.

### Critical Pitfalls

Top pitfalls for this milestone. Full analysis with codebase-specific evidence in PITFALLS.md.

1. **CSS variable collision between showcase and extension CSS** — `main.css` and the real `sidepanel.css`/`options.css` define the same variable names (`--text-primary`, `--bg-primary`, `--border-color`) on `:root` with conflicting values. 82 collision-prone occurrences identified. Never import or copy extension CSS directly. Always translate into `--rec-*` namespace.

2. **Extension viewport CSS hijacking showcase layout** — Real extension CSS uses `body { height: 100vh; overflow: hidden; }` and `.sidepanel-container { height: 100vh; }`. Porting verbatim would hide all showcase content below the fold. Never apply styles to `html`, `body`, or `*` in replica CSS. Replace `100vh` with explicit pixel heights relative to `.browser-content`.

3. **Theme direction mismatch** — Extension treats light as default with `[data-theme="dark"]` override. Showcase treats dark as default with `[data-theme="light"]` override. Copy-pasting theme logic without inverting the direction leaves one mode broken. All replica CSS must follow the showcase convention.

4. **Fidelity drift in future milestones** — Replicas are snapshots; the real extension evolves independently. Prevention: add version-stamped sync comments to each replica section in HTML (`<!-- Replica of: ui/sidepanel.html | Last synced: v0.9.22 -->`) and include a replica sync step in every UI milestone checklist.

5. **Global reset cascade pollution** — `main.css` applies a universal reset and blanket typography rules that cascade into replica containers. Prevention: explicitly override `font-size`, `line-height`, `color`, and `font-weight` at the replica container level for each new replica section.

## Implications for Roadmap

Architecture research provides a clear 4-phase build order. Phases 1 and 2 are independent and can be run in parallel. Phase 3 is net-new. Phase 4 is the quality gate and must be last.

### Phase 1: Sidepanel Replica Audit and Rebuild

**Rationale:** The sidepanel is the primary user interface and the first thing visitors evaluate. It has the most identified gaps and the most structurally complex CSS. Fixing it first establishes the correct `rec-` token values for dark/light modes that Phase 2 and 3 will build alongside.
**Delivers:** Pixel-accurate sidepanel Chat view matching real `sidepanel.html` + `sidepanel.css`. Correct header (FSB title, status dot, history/new-chat/settings icon buttons), all 5 message bubble types (user/ai/system/action/error), input bar with mic button and model selector, footer text. Updated `--rec-sp-*` tokens matching real `#262626`/`#171717` dark mode values.
**Addresses:** Table-stakes features: 1:1 sidepanel replica, theme-correct rendering, scroll animations.
**Avoids:** Pitfalls 1 (CSS collision), 2 (global reset pollution), 4 (viewport CSS hijack), 6 (theme direction mismatch).
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`
**Estimated effort:** 4-6 hours

### Phase 2: Control Panel Replica Audit and Rebuild

**Rationale:** Second most visible surface. Independent of Phase 1 — can run in parallel. The warm-toned vs cool-toned palette drift is the most visible gap and is addressed by porting values from `fsb-ui-core.css` (`--fsb-surface-base: #fffdfb`, `--fsb-gray-50: #faf8f6`) into `--rec-opt-*` tokens.
**Delivers:** Pixel-accurate Dashboard view matching real `control_panel.html` + `options.css`. Correct sidebar (8 nav items with accurate icons: `fa-brain` for Memory, `fa-server` for Background Agents, added "Help & Documentation"), analytics hero cards, SVG line chart, session history cards with status badges.
**Addresses:** Table-stakes features: 1:1 control panel replica, theme-correct rendering.
**Avoids:** Pitfalls 1 (CSS collision), 2 (global reset pollution), 4 (viewport CSS hijack), 6 (theme direction mismatch).
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`
**Estimated effort:** 5-7 hours

### Phase 3: MCP Terminal Section (New Component)

**Rationale:** MCP integration is the key differentiator called out on the landing page with no supporting visual. This is the highest-impact gap relative to effort. It is a clean build — no legacy to audit — using the established `.browser-frame` pattern and IIFE animation conventions.
**Delivers:** New section in `about.html` with 2 terminal mockup blocks. Autopilot example (`run_task` with a search task, progress output, and completion summary). Manual mode example (multi-tool `read_page` + `click` flow). New `rec-mcp-*` CSS classes using semantic `.term-*` subclasses. New `initTerminalAnimation()` function in `recreations.js`.
**Addresses:** Table-stakes feature: MCP terminal autopilot example. Differentiator: MCP manual mode orchestration example.
**Avoids:** Pitfall 5 (monospace font inconsistency — use double-monospace stack and explicit `font-size`), Pitfall 12 (ANSI color rendering — use semantic `.term-*` classes not inline styles), Pitfall 6 (theme handling — dark terminal stays dark in both modes by convention).
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`, `showcase/js/recreations.js`
**Estimated effort:** 3-5 hours

### Phase 4: Gap Audit and Final Sweep

**Rationale:** Catches drift between phases. Surfaces missed visual discrepancies. Required before the milestone is considered complete. Cannot run earlier — it is only meaningful when Phases 1-3 are done.
**Delivers:** Side-by-side comparison of all replicas vs real extension in both dark and light modes. Responsive testing at 375px, 390px, 414px viewports. Version number update in page footer. Accessibility attributes added to all replica containers (`role="img"`, `aria-label`, `aria-hidden="true"` on internals). Version-stamped sync comments added to each replica section.
**Avoids:** Pitfalls 3 (fidelity drift — sync comments), 7 (animation overload — audit for infinite loops), 8 (responsive breakpoints), 9 (external asset loading), 10 (stale mockup data), 11 (accessibility regression).
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`, possibly `showcase/css/about.css`
**Estimated effort:** 2-3 hours

### Phase Ordering Rationale

- Phases 1 and 2 are independent and can be run in parallel. Sequential ordering reduces cognitive load (Phase 1 token fixes establish a color baseline) but is not strictly required.
- Phase 3 is ordered after Phases 1/2 because it benefits from the updated sidepanel color palette for visual consistency, but it has no hard technical dependency on either.
- Phase 4 must be last — it verifies the combined output of all three preceding phases.
- The three existing recreations (Google Search, Dashboard, Form) are audited and updated within Phases 1 and 2 respectively, not as separate phases, because their sidepanel and dashboard components share the same CSS being upgraded.

### Research Flags

No phases in this milestone require `/gsd:research-phase` during planning. All technical decisions are resolved and all reference material is in the local codebase.

Phases with well-documented patterns (skip research-phase):
- **Phase 1 (Sidepanel):** `ui/sidepanel.css` is the authoritative source of truth. Established `rec-` extension pattern.
- **Phase 2 (Control Panel):** `ui/options.css` and `ui/control_panel.html` are the authoritative source of truth. Same pattern.
- **Phase 3 (MCP Terminal):** `.terminal-mockup` pattern already exists in `home.css`. IIFE typing animation pattern exists in `recreations.js`. Color palette documented in STACK.md.
- **Phase 4 (Gap Audit):** Mechanical verification work. Checklist-driven.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Primary sources are the actual codebase files. No external dependencies to evaluate. All alternatives evaluated and rejected with clear reasoning. |
| Features | HIGH | Direct analysis of real extension HTML/CSS vs existing showcase recreations. Every gap is concretely enumerated with specific file/property references. |
| Architecture | HIGH | Full codebase available and analyzed. Deployment config (Dockerfile, fly.toml) confirmed. CSS namespacing strategy validated against existing working patterns. |
| Pitfalls | HIGH | Every pitfall has specific file/line evidence from the actual codebase — not theoretical. Variable collision occurrences counted (82). Viewport hijack line numbers cited. |

**Overall confidence:** HIGH

### Gaps to Address

The research is comprehensive. These are minor uncertainties that do not affect planning:

- **`recreations.css` size growth:** Currently 1282 lines. After v0.9.22 additions it will reach approximately 1600-1800 lines. No action needed yet. If a future milestone adds more replicas, splitting into per-component CSS files should be considered at the ~2500 line mark.
- **`fsb-ui-core.css` compatibility alias trap:** Lines 69-76 of `fsb-ui-core.css` define `--primary: var(--fsb-primary)` on `:root`. If this file is accidentally referenced in a future showcase page, it will silently override the showcase's `--primary`. Current policy (never import it) is correct. Flag for any developer adding new showcase pages.
- **CDN font availability:** Font Awesome 6.6.0 is loaded from cdnjs.cloudflare.com. CDN unavailability would break icon rendering across all replicas. This is an accepted risk for the showcase (not the extension). No mitigation planned.

## Sources

### Primary (HIGH confidence)
- `ui/sidepanel.html` + `ui/sidepanel.css` — Real sidepanel HTML structure and CSS values for pixel matching
- `ui/control_panel.html` + `ui/options.css` — Real control panel structure and CSS values
- `shared/fsb-ui-core.css` — Shared design tokens (`--fsb-*` variables, warm gray scale, orange primary)
- `showcase/about.html` — Existing recreations HTML to audit and update
- `showcase/css/recreations.css` (1282 lines) — Existing recreation styles and `--rec-*` token system
- `showcase/js/recreations.js` — Existing animation functions (typing, cascade, counters)
- `showcase/css/main.css` — Showcase design system (82 collision-prone variable occurrences identified)
- `mcp-server/src/tools/autopilot.ts`, `manual.ts`, `agents.ts`, `read-only.ts` — MCP tool names and signatures for realistic terminal content
- [CSS Typewriter Effect — CSS-Tricks](https://css-tricks.com/snippets/css/typewriter-effect/) — Confirms existing typing animation pattern is standard
- [CSS Custom Properties theming — CSS IRL](https://css-irl.info/quick-and-easy-dark-mode-with-css-custom-properties/) — Confirms `[data-theme]` approach is standard

### Secondary (MEDIUM confidence)
- [Termynal.js](https://github.com/ines/termynal) — Evaluated, rejected. Good for generic terminal animations; lacks nested block support for Claude Code tool-use structure.
- [CSS @scope: Complete Guide](https://devtoolbox.dedyn.io/blog/css-scope-complete-guide) — `@scope` is now Baseline (Firefox 146, Jan 2026), viable as future isolation strategy but not used here given established `rec-` prefix approach.
- [Monospace font sizing quirk](https://alexmansfield.com/css/font-size-line-height-pre-code-monospace/) — Confirms double-monospace trick to prevent browser font shrinking.
- [Chrome Content Scripts CSS Isolation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Confirms extension CSS is designed for isolated worlds, not shared web page contexts.
- [Claude Code terminal config docs](https://code.claude.com/docs/en/terminal-config) — Color palette reference for terminal mockup styling.
- [Claude Code ANSI theme discussion](https://github.com/anthropics/claude-code/issues/4553) — Color palette cross-reference.

### Tertiary (LOW confidence)
- [HTML interactive demos concept](https://docs.supademo.com/create/by-supademo-type/html-interactive-demos) — Pixel-perfect clone methodology reference.
- [Chrome extension landing page patterns](https://onepagelove.com/tag/chrome-extension) — Visual context for showcase conventions.

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
