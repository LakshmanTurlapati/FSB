# Architecture Patterns: v0.9.22 Showcase High-Fidelity Replicas

**Domain:** Static UI replica integration into existing showcase site
**Researched:** 2026-04-02
**Confidence:** HIGH (based on direct codebase analysis, no external dependencies)

## Current Architecture (As-Is)

### Showcase Site Structure

The showcase site lives at `showcase/` in the repo root and is deployed via Docker (`COPY showcase/ ./public/`) to fly.io, where the Node server serves it as static files from `/app/public/`.

```
showcase/
  index.html          -- Landing page (hero, features, providers, CTA)
  about.html          -- "See It in Action" page (3 recreations + architecture + action library)
  dashboard.html      -- Remote dashboard (QR pairing, live control)
  privacy.html        -- Privacy policy
  support.html        -- Support page
  css/
    main.css          -- Design system, nav, footer, utilities (design tokens)
    home.css          -- Hero, features grid, comparison, providers
    about.css         -- About page header, recreation section wrappers, architecture diagram, action library
    recreations.css   -- ALL recreation component styles (browser frame, sidepanel mockup, dashboard mockup, Google search mockup, form mockup, glow effects, progress overlay) -- 1282 lines
    dashboard.css     -- Remote dashboard styles
    privacy.css       -- Privacy page styles
    support.css       -- Support page styles
  js/
    main.js           -- Nav, mobile menu, scroll reveal, theme toggle
    recreations.js    -- Typing effect, message cascade, progress bars, chart bars, counters, FAQ accordion
    dashboard.js      -- Remote dashboard logic
    lz-string.min.js  -- LZ compression for dashboard
  assets/             -- Images, logos, provider icons
```

### Extension UI Structure

```
ui/
  sidepanel.html/js/css    -- Persistent chat panel (references ../shared/fsb-ui-core.css)
  popup.html/js/css        -- Quick chat popup
  control_panel.html       -- Options dashboard (references ../shared/fsb-ui-core.css + options.css)
  options.css              -- 1000+ lines, complete dashboard styling
  options.js               -- Dashboard logic
  markdown-renderer.js     -- Markdown rendering for chat
  markdown.css             -- Markdown display styles
  speech-to-text.js        -- Voice input
  site-guides-viewer.js    -- Site guides UI
  unlock.html/js           -- Extension unlock flow
  lib/                     -- Third-party libs (qrcode-generator, marked, purify, mermaid, chart)

shared/
  fsb-ui-core.css          -- Shared design tokens (warm-toned gray scale, orange primary, spacing, shadows)
```

### Existing Recreations (What is Already Built)

The about.html page currently has THREE recreations:

1. **"FSB on Google Search"** -- Browser frame with a Google results page + FSB sidepanel showing message cascade during an automation
2. **"Dashboard Analytics"** -- Browser frame with the control panel dashboard (sidebar, analytics hero, line chart, session history)
3. **"FSB Automating a Form"** -- Browser frame with a contact form being filled + progress overlay + element glow + sidepanel

All three use the `rec-` CSS prefix namespace to avoid conflicts with the showcase main styles. They are entirely hand-crafted HTML/CSS mockups in `recreations.css` with their own design token set (`--rec-*` variables). They are NOT extracted from the real extension CSS -- they are independent re-implementations that approximate the real UI.

### Key Observation: Three Separate CSS Worlds

| CSS World | Token Prefix | Used By |
|-----------|-------------|---------|
| Showcase design system | `--primary`, `--bg-body`, `--text-*` | `main.css`, `home.css`, `about.css` |
| Recreation mockups | `--rec-*` | `recreations.css` |
| Extension UI | `--fsb-*` (shared), `--primary-color`, `--bg-primary` (per-surface) | `fsb-ui-core.css`, `sidepanel.css`, `options.css` |

The recreation CSS (`--rec-*`) was designed to be **self-contained** within `.browser-frame` containers, which is the correct isolation strategy. The real extension CSS (`sidepanel.css`, `options.css`) uses different variable names and different color values in some cases (warm-toned grays in `fsb-ui-core.css` vs neutral grays in the recreation mockups).

## Recommended Architecture (To-Be)

### Strategy: Replace Approximate Mockups with Pixel-Accurate Replicas

The existing recreations are "good enough" impressions but do not match the real extension UI pixel-for-pixel. The v0.9.22 goal is **1:1 fidelity**. There are two viable approaches:

**Option A: Extract and transplant real CSS** -- Copy the real `sidepanel.css` and `options.css` into the showcase, scope them under a container class.

**Option B: Update recreation CSS to match real CSS** -- Audit every `rec-*` style against the real extension CSS and bring them into alignment.

**Recommendation: Option B (update recreation CSS in place).** Reasons:

1. **The real extension CSS depends on Chrome extension runtime** -- `sidepanel.css` assumes `100vh` body height, Chrome extension scrollbar behavior, and runtime-injected content. Transplanting it directly would require extensive overrides.
2. **The `rec-` prefix namespace isolation already works** -- It prevents clashes with the showcase design system. Abandoning it means re-testing all CSS specificity.
3. **The recreation CSS already handles dark/light theme** via `[data-theme]` selectors matching the showcase toggle, whereas the real extension CSS uses a different toggle mechanism (`data-theme="dark"` vs the showcase default-dark approach).
4. **No build system** -- The project deliberately avoids build tools. Extracting and auto-syncing CSS would require a build step. Manual sync is acceptable for a static showcase.
5. **MCP terminal examples are net-new** -- No existing CSS to extract from. They will be pure HTML/CSS creations regardless.

### Component Boundaries

| Component | Location | Responsibility | Communicates With |
|-----------|----------|---------------|-------------------|
| **about.html** | `showcase/about.html` | Page shell, section ordering, nav/footer | Links `recreations.css`, `about.css`, `main.css` |
| **recreations.css** | `showcase/css/recreations.css` | All replica styling with `rec-` prefix | Consumes `main.css` design tokens for page-level vars |
| **recreations.js** | `showcase/js/recreations.js` | Scroll-triggered animations (cascade, counters, bars) | Observes DOM elements in `about.html` |
| **main.css** | `showcase/css/main.css` | Design tokens, nav, footer, buttons, utilities | Consumed by all pages |
| **main.js** | `showcase/js/main.js` | Nav scroll, theme toggle, reveal animations | Consumes theme state from localStorage |

### New Components to Create/Modify

| Component | Action | Purpose |
|-----------|--------|---------|
| `showcase/about.html` | **MODIFY** | Replace existing Recreation 1 and 2 HTML with pixel-accurate markup; add MCP terminal section |
| `showcase/css/recreations.css` | **MODIFY** | Update `rec-sidepanel`, `rec-dashboard`, add `rec-mcp-terminal` styles to match real UI |
| `showcase/js/recreations.js` | **MODIFY** | Add terminal typing animation for MCP examples |
| Real extension CSS files | **READ ONLY** | Reference sources for pixel-matching; do not modify |

No new files are required. All changes fit within existing file structure.

### Data Flow

```
User visits about.html
    |
    v
Browser loads main.css (design tokens) + recreations.css (replica styles) + about.css (layout)
    |
    v
main.js: scroll reveal, theme toggle
    |
    v
recreations.js: IntersectionObserver triggers
    |-- message cascade (staggered fade-in)
    |-- counter animation (metric values)
    |-- progress bar fill
    |-- terminal typing effect (NEW for MCP)
    |
    v
Static HTML renders as pixel-accurate replicas
```

No API calls, no JavaScript state, no runtime data. Everything is static HTML + CSS + scroll animations.

## Detailed Design for Each Replica

### 1. Sidepanel Replica (Recreation 1 and 3 update)

**Current state:** `rec-sidepanel` in recreations.css approximates the sidepanel but differs from real `sidepanel.css` in:
- Header layout (missing history + new chat buttons, only shows gear icon)
- Status indicator (uses `rec-status-dot` instead of Font Awesome `fa-circle`)
- Message bubbles (slightly different border-radius, font sizes, colors)
- Input area (different padding, border-radius, missing mic button)
- Footer (missing "Made by Lakshman Turlapati" text)
- Session history view (not shown at all)

**Target state:** Match real `sidepanel.html` + `sidepanel.css` exactly:
- Header: "FSB" title + status dot + "Ready"/"Automating" text + history/new-chat/settings buttons
- Messages: exact color values, border-radius (18px user, 6px bottom-corner), shadow values
- User message: `#ff6b35` background, white text, `box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3)`
- AI message: `#e3f2fd` bg, `#1565c0` text, `3px solid #2196f3` left border
- Action message: `#f0f8f0` bg, `#2e7d32` text, monospace, `3px solid #4caf50` left border
- Status message: `#f0f9ff` bg, 4px left border in primary color, typing dots
- Input: `contenteditable` div with placeholder, mic button + send button in pill-shaped container
- Footer: "Made by Lakshman Turlapati" centered text

**Integration approach:**
- Update `rec-sidepanel` CSS rules to match exact values from `sidepanel.css`
- Add HTML for missing elements (history/new-chat buttons, mic button, footer)
- Keep `rec-` prefix -- just make the values match

### 2. Control Panel Replica (Recreation 2 update)

**Current state:** `rec-dashboard` shows a simplified control panel with:
- Basic header bar (status dot, Test API, Export, theme toggle)
- Sidebar with 7 nav items
- Analytics hero (4 metrics), line chart, 3 session cards

**Target state:** Match real `control_panel.html` + `options.css`:
- Header: connection status dot, "Test API" button, "Export" button, theme toggle
- Sidebar: 8 nav items (Dashboard, Background Agents, API Configuration, Passwords (Beta), Advanced Settings, Memory, Logs & Debugging, Help & Documentation) -- currently has 7, missing "Help & Documentation"
- Dashboard content: Analytics hero cards with proper gradient styling
- Real sidebar item icons should match (e.g., Memory uses `fa-brain` in real, `fa-database` in recreation)

**Integration approach:**
- Audit sidebar items against `control_panel.html` lines 51-88
- Fix icon mismatches (`fa-database` -> `fa-brain` for Memory, `fa-robot` -> `fa-server` for Background Agents)
- Add "Help & Documentation" nav item
- Match analytics hero gradient (real uses a card-style layout from `options.css`)
- Ensure chart and session cards match the real dashboard styling

### 3. MCP-in-Claude-Code Terminal Examples (NEW)

**No existing component** -- this is entirely new.

**Design:** A terminal mockup (reusing the existing `.terminal-mockup` pattern from `home.css`) showing realistic Claude Code sessions using FSB MCP tools.

**Structure:**
```html
<div class="browser-frame">
  <div class="browser-topbar">
    <div class="browser-dots">...</div>
    <div class="browser-address">Terminal -- Claude Code</div>
  </div>
  <div class="rec-mcp-terminal">
    <div class="rec-mcp-line prompt">$ claude</div>
    <div class="rec-mcp-line output">Claude Code v1.0.8</div>
    <div class="rec-mcp-line user">> Use FSB to search for flights from SF to NYC on Google Flights</div>
    <div class="rec-mcp-line tool-call">
      <span class="rec-mcp-tool-name">fsb_run_task</span>
      <span class="rec-mcp-tool-args">{"task": "Search Google Flights for SF to NYC..."}</span>
    </div>
    <div class="rec-mcp-line tool-result">
      Task completed. Found 12 flights...
    </div>
    <div class="rec-mcp-line assistant">
      I found 12 flights from SF to NYC. The cheapest is...
    </div>
  </div>
</div>
```

**Styling approach:**
- Dark background (#0d1117) matching existing terminal mockup
- Green prompt text for `$` lines
- Blue for Claude's output
- Orange highlight for FSB tool calls
- Monospace font throughout
- Typing animation on the user input line (via `recreations.js`)

**Recommended examples (2-3 terminal blocks):**
1. **Browser automation via MCP:** `fsb_run_task` with a search task
2. **Page reading via MCP:** `fsb_read_page` extracting content
3. **Multi-step workflow:** Navigate + extract + summarize

### 4. Audit of Existing "See It in Action" Section

**Issues found in current about.html:**

| Issue | Location | Fix |
|-------|----------|-----|
| Recreation sidepanel only shows gear icon, missing history/new-chat buttons | Recreation 1 and 3 `rec-sp-actions` | Add two more icon buttons |
| Mic button missing from sidepanel input | Recreation 1 and 3 `rec-sp-input` | Add mic button before send |
| Footer "Made by Lakshman Turlapati" missing from sidepanel | All recreations | Add footer div |
| Dashboard sidebar Memory icon uses `fa-database`, real uses `fa-brain` | Recreation 2 sidebar | Fix icon class |
| Dashboard sidebar Background Agents icon uses `fa-robot`, real uses `fa-server` | Recreation 2 sidebar | Fix icon class |
| Dashboard sidebar missing "Help & Documentation" item | Recreation 2 sidebar | Add nav item |
| Version shown as "v9.0.2" in footer | Page footer | Update to current version |
| Dark theme message colors differ from real sidepanel.css | `recreations.css` dark overrides | Match exact values |
| User message shadow differs (rec uses generic, real uses `rgba(255, 107, 53, 0.3)`) | `recreations.css` `.rec-msg.user` | Update shadow value |

## Patterns to Follow

### Pattern 1: Scoped CSS with `rec-` Prefix

**What:** All recreation CSS classes use the `rec-` prefix to avoid specificity conflicts with the showcase design system and hypothetical real extension CSS.

**When:** Always, for any new recreation component.

**Example:**
```css
/* CORRECT -- scoped to recreation namespace */
.rec-mcp-terminal { ... }
.rec-mcp-line { ... }
.rec-mcp-tool-name { ... }

/* WRONG -- would conflict with main.css or extension CSS */
.terminal { ... }
.mcp-line { ... }
```

### Pattern 2: Theme Variables with `[data-theme]` Selectors

**What:** Each recreation component defines both dark (default) and light theme colors. The showcase is dark by default; `[data-theme="light"]` overrides apply when the user toggles the theme.

**When:** For every color, background, and border value in recreation CSS.

**Example:**
```css
.rec-mcp-terminal {
  background: #0d1117;
  color: #e6edf3;
}

[data-theme="light"] .rec-mcp-terminal {
  background: #f6f8fa;
  color: #24292f;
}
```

### Pattern 3: IntersectionObserver-Triggered Animations

**What:** Animations (typing, fade-in, counters) only start when the element scrolls into view. This is the pattern used by `recreations.js` throughout.

**When:** For any new animated component (MCP terminal typing).

**Example:**
```javascript
if ('IntersectionObserver' in window) {
  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !started) {
      started = true;
      startAnimation();
      observer.disconnect();
    }
  }, { threshold: 0.3 });
  observer.observe(element);
}
```

### Pattern 4: Browser Frame Container

**What:** All recreations are wrapped in a `.browser-frame` with a `.browser-topbar` (dots + address bar) and `.browser-content`. This provides visual context ("this is what it looks like in a browser").

**When:** For sidepanel and control panel recreations. The MCP terminal can use a simpler terminal frame (already exists as `.terminal-mockup` in `home.css`).

### Pattern 5: No External Dependencies for Recreations

**What:** Recreations use only Font Awesome (already loaded), CSS animations, and vanilla JavaScript. No additional libraries.

**When:** Always. The showcase site has no build system. Keep it simple.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Importing Real Extension CSS Directly

**What:** Linking to or copying `sidepanel.css` / `options.css` into the showcase page.

**Why bad:** These files assume Chrome extension runtime (100vh body, extension scrollbar, message passing for dynamic content). They also use different CSS variable names that would clash with `main.css` design tokens. Additionally, they include ~2500 lines of styling for features not shown in the recreation (login prompts, recon suggestions, action summaries, etc.).

**Instead:** Manually match the exact CSS values in the `rec-` prefixed recreation styles. Only port the specific properties (colors, border-radius, font-size, shadows) that affect visual appearance.

### Anti-Pattern 2: Creating a Shared CSS File Between Extension and Showcase

**What:** Making `fsb-ui-core.css` a dependency of both the extension and the showcase.

**Why bad:** The showcase uses a different design system (dark-first with true black backgrounds) while the extension uses warm-toned grays. Making them share a CSS file would create coupling between the showcase's visual language and the extension's. Changes to the extension theme would break the showcase.

**Instead:** Keep them separate. The showcase recreations are snapshots of what the extension looks like. They do not need to be kept in sync automatically -- they are updated manually at milestone boundaries.

### Anti-Pattern 3: Over-Engineering with JavaScript Interactivity

**What:** Making recreation sidepanels clickable, message inputs functional, or adding simulated automation loops.

**Why bad:** Scope creep. The goal is visual fidelity, not functional replicas. Interactive demos would require maintaining a mini-application within the showcase.

**Instead:** Static HTML with scroll-triggered animations. The typing animation and message cascade already give the impression of "live" behavior without needing actual logic.

### Anti-Pattern 4: Using iframes to Embed Real Extension Pages

**What:** Embedding `sidepanel.html` or `control_panel.html` in iframes within the showcase.

**Why bad:** These pages depend on Chrome extension APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`). They would throw errors outside the extension context. Even with mock APIs, the pages would need network requests and background script connections to render properly.

**Instead:** Pure HTML/CSS recreations that look identical but have no runtime dependencies.

## CSS Strategy Decision

### Do NOT Share CSS. Do NOT Duplicate Entire Files. Manually Port Values.

The correct approach is a middle ground:

1. **Read** the real `sidepanel.css` and `options.css` for exact values
2. **Port** specific properties (colors, sizes, radii, shadows, fonts) into `recreations.css` rules
3. **Keep** the `rec-` prefix namespace
4. **Keep** the showcase's `[data-theme]` toggle mechanism
5. **Document** in a code comment which real CSS file each recreation section corresponds to

This gives pixel accuracy without creating maintenance coupling.

## Scalability Considerations

| Concern | Current (3 recreations) | After v0.9.22 (3 updated + 1 new) | Future |
|---------|------------------------|-----------------------------------|--------|
| `recreations.css` size | 1282 lines | ~1600-1800 lines | Manageable; consider splitting into per-recreation files if exceeding 2500 lines |
| Animation JS | 257 lines, 7 animation types | ~320 lines with MCP typing | No concern |
| Page load performance | Fine (all CSS is <100KB combined) | Fine | No concern until 10+ recreations |
| Theme maintenance | All recreations have light/dark | Same | Same pattern; mechanical but straightforward |

## Build Order (Suggested Phase Sequence)

The following order respects dependencies:

### Phase 1: Sidepanel Replica Audit and CSS Fix

**Dependencies:** None -- self-contained.
**Scope:** Audit `sidepanel.css` vs `rec-sidepanel` in `recreations.css`. Port exact color values, font sizes, border-radius, shadows. Update HTML in `about.html` recreations 1 and 3 to include missing elements (history/new-chat buttons, mic button, footer).
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`

### Phase 2: Control Panel Replica Audit and CSS Fix

**Dependencies:** None (parallel with Phase 1 if desired).
**Scope:** Audit `options.css` + `control_panel.html` vs `rec-dashboard` in `recreations.css`. Fix sidebar icons and items. Match analytics hero styling. Update session card layout.
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`

### Phase 3: MCP Terminal Recreation (New Section)

**Dependencies:** None for CSS; the `terminal-mockup` pattern already exists in `home.css`. Can run in parallel.
**Scope:** Add a new section to `about.html` with 2-3 MCP terminal examples. Create `rec-mcp-*` CSS classes in `recreations.css`. Add typing animation function in `recreations.js`.
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`, `showcase/js/recreations.js`

### Phase 4: Gap Audit and Final Sweep

**Dependencies:** Phases 1-3 complete.
**Scope:** Side-by-side comparison of all recreations vs real extension. Fix any remaining visual discrepancies. Test dark/light theme toggle for all recreations. Test responsive breakpoints. Update version number in footer.
**Files modified:** `showcase/about.html`, `showcase/css/recreations.css`, potentially `showcase/css/about.css`

### Why This Order

- Phases 1 and 2 are updates to existing recreations -- lower risk, clear reference points
- Phase 3 is a net-new component -- benefits from having the updated sidepanel CSS as context for maintaining visual consistency
- Phase 4 is the quality gate -- catches drift between phases

## Integration Points Summary

| From | To | Integration Type | Notes |
|------|----|-----------------|-------|
| `sidepanel.css` (real) | `recreations.css` (showcase) | Manual value porting | Colors, sizes, radii, shadows only |
| `options.css` (real) | `recreations.css` (showcase) | Manual value porting | Layout proportions, color scheme |
| `control_panel.html` (real) | `about.html` (showcase) | Structural reference | Sidebar items, section names |
| `sidepanel.html` (real) | `about.html` (showcase) | Structural reference | Header layout, input area structure |
| `home.css` `.terminal-mockup` | `recreations.css` `.rec-mcp-terminal` | Pattern reuse | Dark terminal aesthetic |
| `main.css` design tokens | `recreations.css` `--rec-*` tokens | Indirect consumption | `var(--primary)` used in some rec styles |
| `main.js` theme toggle | `recreations.css` `[data-theme]` | Event-driven | Theme switch applies to all recreations |
| `recreations.js` animations | `about.html` DOM elements | IntersectionObserver | Scroll-triggered animations |

## New vs Modified Components

| File | Action | What Changes |
|------|--------|-------------|
| `showcase/about.html` | MODIFY | Update recreation 1-3 HTML, add MCP section |
| `showcase/css/recreations.css` | MODIFY | Port exact CSS values, add MCP terminal styles |
| `showcase/js/recreations.js` | MODIFY | Add MCP terminal typing animation |
| `showcase/css/about.css` | POSSIBLY MODIFY | Add section styling for MCP recreation if needed |
| `showcase/css/main.css` | NO CHANGE | Design system is stable |
| `showcase/js/main.js` | NO CHANGE | Core functionality is stable |
| `ui/sidepanel.css` | READ ONLY | Reference for pixel matching |
| `ui/sidepanel.html` | READ ONLY | Reference for HTML structure |
| `ui/options.css` | READ ONLY | Reference for pixel matching |
| `ui/control_panel.html` | READ ONLY | Reference for HTML structure |
| `shared/fsb-ui-core.css` | READ ONLY | Reference for design token values |

## Sources

- Direct codebase analysis of:
  - `showcase/about.html` (existing recreations)
  - `showcase/css/recreations.css` (1282 lines of recreation styles)
  - `showcase/css/main.css` (showcase design system)
  - `showcase/js/recreations.js` (animation logic)
  - `ui/sidepanel.html` + `ui/sidepanel.css` (real sidepanel)
  - `ui/control_panel.html` + `ui/options.css` (real control panel)
  - `shared/fsb-ui-core.css` (shared design tokens)
  - `Dockerfile` (deployment confirms `showcase/` -> `/app/public/`)
  - `fly.toml` (deployment config)
