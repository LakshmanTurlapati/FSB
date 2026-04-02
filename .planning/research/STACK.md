# Technology Stack: v0.9.22 Showcase High-Fidelity Replicas

**Project:** FSB (Full Self-Browsing) -- Pixel-accurate HTML/CSS replicas for showcase site
**Researched:** 2026-04-02
**Mode:** Ecosystem (UI replica techniques, terminal mockup rendering)
**Confidence:** HIGH

## Executive Summary

This milestone requires ZERO new dependencies. The showcase site is a pure static HTML/CSS/JS site (no build system, no npm, no bundler) and this constraint must remain. The existing `recreations.css` and `recreations.js` infrastructure already provides all the patterns needed -- browser chrome frames, sidepanel mockups, dashboard analytics recreations, viewport glow effects, typing animations, and IntersectionObserver-triggered cascades. The v0.9.22 work is extending these proven patterns to higher fidelity, not introducing a new rendering pipeline.

For the Claude Code terminal mockups specifically, the approach is pure CSS + vanilla JS (matching the existing `recreations.js` style), not a library like xterm.js or termynal.js. Those libraries solve interactive terminal problems that do not apply here -- we need static, scripted showcase animations with Claude Code's specific visual structure (tool-use blocks, nested results, colored parameters).

The core technical challenge is not "what tools to use" but "accurate color token mapping" between the real extension UIs and the showcase recreation CSS namespace.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vanilla CSS (`recreations.css`) | n/a | All UI replica styling | Already proven in the codebase. Extends naturally. No build step. CSS custom properties handle dark/light theme toggle via `[data-theme]` attribute. The existing `--rec-*` token system maps cleanly to the extension's `--fsb-*` tokens. |
| Vanilla JS (`recreations.js`) | ES2021+ | Typing animations, IntersectionObserver cascades, counter animations, tab switching | Already in production. IIFE pattern, no modules needed. Works without bundler. Existing functions (`initTerminalTyping`, `initMessageCascade`, `initProgressBars`, `initChartBars`, `initCounters`) cover most animation needs. |
| Font Awesome 6.6.0 | 6.6.0 (CDN) | Icons in replica UIs | Already loaded in all showcase pages via `cdnjs.cloudflare.com`. Sidepanel and options page both use FA icons (`fa-cog`, `fa-clock-rotate-left`, `fa-plus`, `fa-arrow-up`, `fa-microphone`, `fa-tachometer-alt`, `fa-key`, `fa-robot`, `fa-database`, `fa-terminal`, etc.). No additional icon library needed. |
| Phosphor Icons 2.1.1 | 2.1.1 (unpkg CDN) | Theme toggle icon | Already loaded in all showcase pages. Used for the sun/moon theme toggle button. |
| CSS Custom Properties | Native | Theme-aware styling for all replicas | Showcase uses `--rec-*` design tokens with `[data-theme="light"]` overrides. Extension uses `--fsb-*` tokens from `fsb-ui-core.css`. Replicas map extension values into the `--rec-*` namespace for isolation. |
| Inline SVG | Native | Charts in dashboard replica | Already used in the existing dashboard recreation (`rec-line-svg` polyline with gradient fill). No chart.js needed for static visuals. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | -- | -- | The existing stack handles everything needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Chrome DevTools | Side-by-side pixel comparison of real extension UI vs replica | Open extension's actual sidepanel/options page alongside the showcase replica. Use the device toolbar to match sidepanel width (default ~420px). |
| PixelParallel (Chrome Extension) | Optional overlay verification | Free tool for overlaying a reference image on the live page. Useful for final verification, not required for development. |

## What This Milestone Adds

### 1. High-Fidelity Sidepanel Replica (CSS + HTML)

**Source of truth:** `ui/sidepanel.html` + `ui/sidepanel.css` + `shared/fsb-ui-core.css`

The existing `.rec-sidepanel` class in `recreations.css` already renders a simplified sidepanel mockup. It has a header (title + status dot + gear icon), a message list (user/system/ai/action/status types), and an input bar. The v0.9.22 upgrade:

- **Spacing and sizing audit.** Match the real sidepanel's exact padding (`16px 20px` for header), font sizes (`16px` h1, `10px` status dot), and border radii.
- **Add missing elements.** The real sidepanel has: history button (`fa-clock-rotate-left`), new-chat button (`fa-plus`), settings button (`fa-cog`), microphone button, voice input button, `contenteditable` input wrapper, and author footer. The current replica only has one gear icon.
- **Refine message styling.** The real sidepanel renders markdown via `marked.min.js` but the replica only needs static pre-rendered HTML that looks like rendered output (bold text, code blocks, bullet lists). Style with CSS, no runtime parsing.
- **Color token accuracy.** The current `--rec-sp-bg: #1f2937` does not match the real sidepanel dark mode `--bg-primary: #262626`. Update to match.

**Approach:** Extend existing CSS classes. Add new HTML in `about.html`. No new files or libraries.

### 2. High-Fidelity Control Panel / Options Page Replica (CSS + HTML)

**Source of truth:** `ui/options.css` + `ui/options.js`

The existing `.rec-dashboard` class already renders a dashboard mockup with sidebar navigation, metrics cards, charts, and session history cards. The v0.9.22 upgrade:

- **Expand sidebar items.** The real options page has: Dashboard, API Configuration, Passwords (Beta badge), Background Agents, Advanced Settings, Memory, Site Guides, Logs & Debugging. The current replica has most of these but should add Site Guides.
- **Add tab content detail.** Show at least two tabs in detail (Dashboard is already done; add API Configuration or Background Agents with realistic form fields, model dropdowns, and cost indicators).
- **Match warm neutral palette.** The real options page uses warm grays from `fsb-ui-core.css` (`--fsb-gray-50: #faf8f6`, `--fsb-surface-base: #fffdfb`). The current recreation uses cooler blue-grays. Map the warm tokens.
- **Tab switching interaction.** Vanilla JS click handler toggles `.active` class on sidebar items and shows/hides corresponding content divs. This follows the existing FAQ accordion pattern in `recreations.js`.

**Approach:** Extend existing CSS classes. Add tab-switching logic to `recreations.js`. No new files or libraries.

### 3. Claude Code Terminal Mockup (CSS + HTML + JS) -- NEW COMPONENT

**This is entirely new.** No existing recreation covers terminal sessions. Build as a new `.rec-terminal` component following established patterns.

**Visual structure of a Claude Code MCP session:**
- Dark terminal window with macOS-style chrome (reuse `.browser-frame` pattern)
- Terminal title bar showing `~/Projects/FSB -- claude` instead of a URL
- Prompt line with `>` prefix in muted color
- User input in bright white text
- Tool use blocks: bordered containers with tool name header in blue, parameters indented below
- Tool result blocks: indented text showing the FSB response
- Response text from Claude in light gray
- Blinking cursor during typing animation

**CSS approach:**
```
.rec-terminal           -- container, dark bg (#0d1117), monospace font
.rec-terminal pre       -- content area, no margin, preserve whitespace
.term-prompt            -- $ or > prefix, #8b949e
.term-input             -- user text, #e6edf3
.term-response          -- Claude text, #c9d1d9
.term-tool-block        -- bordered container, border-left: 3px solid #58a6ff
.term-tool-header       -- "Using mcp__fsb__run_task", color: #58a6ff
.term-tool-param        -- indented key:value, key in #7ee787, value in #a5d6ff
.term-result-block      -- bordered container, border-left: 3px solid #3fb950
.term-result            -- result text, #c9d1d9
.term-cursor            -- blinking block cursor via CSS animation
```

**JS approach:** Extend `recreations.js` with a new `initTerminalAnimation()` function that:
1. Finds `.rec-terminal` containers
2. Uses IntersectionObserver to trigger when scrolled into view
3. Reveals lines sequentially: prompt appears instantly, user input types character-by-character (reusing existing typing pattern), tool blocks fade in after a delay, results appear, then Claude's response types out
4. Uses the same IIFE pattern as existing functions

**Realistic MCP content to display:**
```
> Navigate to amazon.com and find the best-rated wireless mouse under $30

  Using mcp__fsb__run_task
    task: "Navigate to amazon.com and find the best-rated wireless mouse under $30"

  Result:
    Task completed successfully in 12 iterations.
    Navigated to amazon.com, searched for "wireless mouse under $30",
    sorted by average customer review. Top result: Logitech M185
    Wireless Mouse - $14.99 (4.6 stars, 82,451 ratings)

> Now read the product page details

  Using mcp__fsb__read_page

  Result: (truncated)
    Title: Logitech M185 Wireless Mouse
    Price: $14.99
    Rating: 4.6 out of 5 stars
    ...
```

**Terminal stays dark in both themes.** This is intentional -- terminals are dark by convention, and it creates visual contrast with the page. No `[data-theme="light"]` overrides needed for the terminal content, only for the surrounding section.

## Color Token Mapping Reference

The recreation CSS must accurately map the real extension's colors. Current mismatches to fix:

| Real Extension Token | Real Value (Dark) | Current Recreation Token | Current Value | Action |
|---------------------|-------------------|--------------------------|---------------|--------|
| `--bg-primary` (sidepanel) | `#262626` | `--rec-sp-bg` | `#1f2937` | Update `--rec-sp-bg` to `#262626` |
| `--bg-secondary` (sidepanel) | `#171717` | `--rec-sp-input-bg` | `#111827` | Update to `#171717` |
| `--primary-color` | `#ff6b35` | `--primary` | `#ff6b35` | Already matches |
| `--fsb-surface-base` (options light) | `#fffdfb` | `--rec-main-bg` | `#0a0a0a` (dark only) | Add light override: `#fffdfb` |
| `--fsb-gray-50` (options light) | `#faf8f6` | `--rec-sidebar-bg` | `#f8fafc` (light) | Update to `#faf8f6` for warm tone |
| `--fsb-text-primary` (options) | `#1f1a17` | n/a | n/a | Add new `--rec-opt-text` token |

### Terminal Color Palette (New)

| Element | Color | CSS Class |
|---------|-------|-----------|
| Terminal background | `#0d1117` | `.rec-terminal` |
| Prompt symbol | `#8b949e` | `.term-prompt` |
| User input text | `#e6edf3` | `.term-input` |
| Claude response text | `#c9d1d9` | `.term-response` |
| Tool use border/header | `#58a6ff` | `.term-tool-header` |
| Tool name | `#79c0ff` | `.term-tool-name` |
| Parameter key | `#7ee787` | `.term-param-key` |
| Parameter value | `#a5d6ff` | `.term-param-value` |
| Result border | `#3fb950` | `.term-result-block` border |
| Success indicator | `#3fb950` | `.term-success` |
| Error text | `#f85149` | `.term-error` |
| Divider/border | `#30363d` | `.term-border` |
| Cursor | `#e6edf3` | `.term-cursor` |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pure CSS colored spans for terminal | ansi_up 6.0.6 (npm) | Only if rendering actual captured ANSI terminal output. We hand-author mockup content, so ANSI parsing adds a dependency for zero benefit. |
| Pure CSS colored spans for terminal | xterm.js 5.x | Only if building a real interactive terminal emulator. 180KB+ minified, massive overkill for static showcase animations. |
| Pure CSS colored spans for terminal | Termynal.js (~5KB) | Closest viable alternative. Nice typing animations, MIT license, no deps. Rejected because: (a) does not support Claude Code's nested tool-use block visual structure, (b) adds an external dependency when existing `recreations.js` already has the typing animation pattern, (c) its HTML API uses flat `data-ty` lines and cannot represent indented/bordered blocks. If the team prefers faster implementation and simpler visuals, Termynal is reasonable. |
| Extend `recreations.css` | Copy real extension CSS verbatim | Tempting but wrong. Extension CSS uses Chrome extension contexts (`chrome-extension://` URLs, `chrome.runtime` API assumptions in JS). The recreation CSS adapts designs to standalone web contexts. Verbatim copy creates maintenance burden. |
| CSS custom properties for theming | Separate light/dark CSS files | Showcase already uses `[data-theme]` attribute switching with CSS custom property overrides. This is established. Adding a second mechanism creates confusion. |
| Static pre-rendered HTML | Include marked.js in showcase | Replica does not need runtime markdown parsing. Content is known at author time. Pre-render to HTML and style with CSS. Avoids a 35KB dependency. |
| Inline SVG charts | chart.js in showcase | Static visuals only. Inline SVG polylines (already used) are simpler, lighter, and render identically. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| xterm.js | 180KB+ for a static mockup. Interactive terminal emulation is not needed. | `<pre>` blocks with colored `<span>` elements and CSS animations. |
| ansi_up | Parses ANSI escape codes. We author styled HTML directly, not parsing terminal captures. | Semantic CSS classes (`.term-prompt`, `.term-tool-name`, etc.). |
| Termynal.js | External dependency for something the existing typing animation pattern handles. Cannot represent Claude Code's nested tool-use blocks. | Extend `initTerminalTyping()` in `recreations.js`. |
| React / Vue / any framework | Showcase is static HTML. A framework requires a build system, violating project constraints. | Vanilla JS (already working in the IIFE pattern). |
| marked.js in showcase | Runtime markdown parsing for content known at author time. Adds 35KB for no runtime benefit. | Pre-rendered HTML with CSS styling. |
| chart.js in showcase | Full charting library for a single static chart. | Inline SVG polylines (existing `rec-line-svg` pattern). |
| Importing `fsb-ui-core.css` directly | Different CSS property namespace, designed for extension runtime context. | Map `--fsb-*` values into `--rec-*` tokens in `recreations.css`. |
| `contenteditable` in replicas | Real sidepanel uses it for input. Replica input is non-interactive. | Styled `<div>` with placeholder text appearance. |

## File Organization

All changes happen in existing files:

```
showcase/
  about.html              -- Add new recreation sections (enhanced sidepanel, enhanced dashboard, terminal)
  css/
    recreations.css        -- Extend with .rec-terminal, refined .rec-sidepanel, refined .rec-dashboard
  js/
    recreations.js         -- Extend with initTerminalAnimation(), tab switching for dashboard
```

If `recreations.css` exceeds ~800 lines (currently ~500), consider splitting:

```
showcase/
  css/
    recreations.css        -- Shared base (browser frame, common patterns, design tokens)
    rec-terminal.css       -- Terminal mockup specific (new component)
```

Only split if readability demands it. The existing single-file pattern is fine for moderate growth.

## Integration Points

### With Existing Showcase Infrastructure

- **Theme toggle:** The existing `main.js` handles `[data-theme]` toggling and localStorage persistence. New recreation CSS just needs `[data-theme="light"]` blocks for light-mode overrides. Terminal mockup content stays dark in both modes.
- **Scroll reveal:** The existing `main.js` has a `.reveal` class with IntersectionObserver. New sections use `class="reveal"` and `class="reveal-scale"` for entrance animations.
- **Browser frame:** Reuse `.browser-frame`, `.browser-topbar`, `.browser-dots`, `.browser-address` for both UI replicas and terminal chrome.
- **CDN resources:** No new CDN links. Font Awesome 6.6.0 and Phosphor Icons 2.1.1 are already loaded on all pages.

### With Real Extension Source (Reference Only)

The real extension files are reference material, not runtime dependencies:
- `ui/sidepanel.html` -- HTML structure to replicate
- `ui/sidepanel.css` -- Spacing/sizing/color values to match
- `ui/options.css` -- Spacing/sizing/color values to match
- `shared/fsb-ui-core.css` -- Design token values to map
- `mcp-server/src/tools/` -- Tool names and descriptions for realistic terminal content

## Sources

- Real extension source inspected: `ui/sidepanel.html`, `ui/sidepanel.css`, `ui/options.css`, `shared/fsb-ui-core.css` -- HIGH confidence (primary source)
- Existing showcase inspected: `showcase/about.html`, `showcase/css/recreations.css`, `showcase/js/recreations.js`, `showcase/css/main.css` -- HIGH confidence (primary source)
- MCP server tools: `mcp-server/src/tools/autopilot.ts`, `mcp-server/src/tools/manual.ts` -- HIGH confidence (tool names for terminal content)
- [Termynal.js](https://github.com/ines/termynal) -- Evaluated, rejected. 1.8K stars, MIT, ~5KB. Good for generic terminal animations but lacks nested block support.
- [ansi_up 6.0.6](https://www.npmjs.com/package/ansi_up) -- Evaluated, rejected. Zero-dep ANSI-to-HTML converter. Solves wrong problem (parsing vs authoring).
- [xterm.js](https://xtermjs.org/) -- Evaluated, rejected. Full terminal emulator, 180KB+.
- [Claude Code terminal config docs](https://code.claude.com/docs/en/terminal-config) -- MEDIUM confidence. Referenced for visual structure.
- [Claude Code ANSI theme discussion](https://github.com/anthropics/claude-code/issues/4553) -- MEDIUM confidence. Color palette reference.
- [CSS Typewriter Effect](https://css-tricks.com/snippets/css/typewriter-effect/) -- HIGH confidence. Well-known CSS technique.
- [CSS Custom Properties theming](https://css-irl.info/quick-and-easy-dark-mode-with-css-custom-properties/) -- HIGH confidence. Confirms existing pattern is standard.

---
*Stack research for: v0.9.22 Showcase High-Fidelity Replicas*
*Researched: 2026-04-02*
