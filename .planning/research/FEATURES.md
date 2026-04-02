# Feature Landscape: v0.9.22 Showcase High-Fidelity Replicas

**Domain:** Replacing outdated "See It in Action" renders with pixel-accurate HTML/CSS/JS replicas
**Researched:** 2026-04-02
**Confidence:** HIGH (based on direct source analysis of real extension UI, existing showcase code, MCP server tools, and industry patterns)

## Current State Analysis

The showcase site (about.html) has a "See It in Action" section with three CSS recreations:

1. **FSB on Google Search** -- Browser frame with Google results + sidepanel mockup showing automation messages
2. **Dashboard Analytics** -- Browser frame with options/control_panel sidebar, metrics cards, token chart, session history
3. **FSB Automating a Form** -- Browser frame with contact form + progress overlay + sidepanel mockup

These are hand-built HTML/CSS mockups using `rec-` prefixed classes in `recreations.css`. They have dedicated animation JS (`recreations.js`) with IntersectionObserver-triggered message cascades, counter animations, and progress bar fills.

### Specific Gaps Between Current Recreations and Real Extension

**Sidepanel recreation gaps:**
- Current mockup has only 3 icon buttons in header; real sidepanel has settings gear, debug toggle, theme toggle, and tab buttons (Chat/Agents/History)
- Current mockup shows simplified message types; real sidepanel has user/system/ai/action/error/status message styles with markdown rendering, collapsible action details, and token cost badges
- Missing: conversation tab bar (Chat, Agents, History), model selector in input area, voice input button, stop automation button, quick action chips
- Color tokens drift: recreation uses custom `--rec-*` tokens that approximate but don't match the real `sidepanel.css` design tokens (e.g., `--rec-sp-bg: #1f2937` vs real `--bg-primary: #262626` in dark mode)

**Control panel recreation gaps:**
- Shows only Dashboard tab content; missing the full sidebar with 7+ tabs (Dashboard, API Configuration, Passwords, Background Agents, Advanced Settings, Memory, Site Guides, Logs & Debugging)
- Metrics cards show static placeholder numbers, not realistic ranges
- Missing: header bar branding/logo, API test button styling, export dropdown, proper dark/light toggle matching real options.css
- Chart is a hard-coded SVG polyline; real dashboard uses dynamic SVG charts
- Session cards show simplified format; real ones have expandable details, cost per session, model badge

**Missing entirely:**
- MCP-in-Claude-Code examples (no terminal recreation exists)
- Real sidepanel tab views (Agents tab, History tab)
- The floating progress overlay as a standalone showcase element
- Visual feedback showcase (orange glow element highlighting, viewport glow border)

---

## Table Stakes

Features users expect in a "See It in Action" showcase. Missing any of these makes the showcase feel incomplete or misleading.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| 1:1 sidepanel replica (Chat view) | The sidepanel IS the primary user interface; visitors need to see exactly what they'll use | High | Real sidepanel.css analysis, rec- token alignment | Must match real header (FSB title, status dot, icon buttons), message bubble styles (user/ai/system/action/error), input area with model selector, and send button gradient |
| 1:1 control panel replica (Dashboard view) | Options dashboard is the second most visible surface; current recreation has significant drift | High | Real options.css analysis, sidebar nav items, metric card layout | Must show sidebar with all tab names, dashboard metrics matching real format, session history cards, chart area |
| MCP terminal example (autopilot: run_task) | MCP integration is a key differentiator called out on the landing page; no visual exists | Medium | Claude Code terminal styling research, MCP tool names from server.ts | Terminal mockup showing `claude` command, FSB tool call with progress output, completion summary |
| Theme-correct rendering (dark + light) | Site already has dark/light toggle; recreations must respect it | Medium | Existing `[data-theme="light"]` token overrides in recreations.css | Current recreation tokens partly handle this but have gaps -- real sidepanel dark uses #262626 not #1f2937 |
| Scroll-triggered entrance animations | Existing recreations already have IntersectionObserver animations; removing them would be a regression | Low | Existing recreations.js patterns | Keep message cascade, counter animation, progress bar fill |
| Responsive scaling | Recreations must work on mobile without breaking; current ones partially do | Low | Existing media queries in recreations.css | Browser frames shrink, sidepanel stacks below on narrow viewports |
| Accurate message type rendering | Real sidepanel has 5+ message types with distinct visual styling; mockup shows only 4 | Medium | Message CSS from sidepanel.css (user/ai/system/action/error/status) | Action messages need monospace font + green left border; AI messages need blue left border + blue tint background |

## Differentiators

Features that would set this showcase apart from a basic product screenshot gallery. Not expected by visitors, but create a "wow, this is real" impression.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| MCP terminal example (manual mode: multi-tool flow) | Shows FSB working as browser hands for Claude Code -- unique selling point no competitor has | Medium | Manual tool names from schema-bridge.ts | Show read_page -> click -> type_text -> read_page flow in terminal mockup, demonstrating Claude Code orchestrating browser actions step by step |
| MCP terminal example (agents: create + schedule) | Shows background agent creation from terminal -- "schedule a browser task from your IDE" | Medium | Agent tool names from agents.ts | Show create_agent with cron schedule, list_agents showing active agents |
| Animated typing effect in sidepanel messages | Messages appear with realistic typing animation, not just fade-in | Low | Extend existing message cascade JS | Character-by-character reveal for AI messages; instant reveal for action/system messages |
| Interactive tab switching in sidepanel replica | Click Chat/Agents/History tabs to see different sidepanel views | Medium | Content for each tab state | Agents tab shows agent cards with schedules; History tab shows past sessions list |
| Live element highlight pulse | Orange glow pulse animation on a targeted element in the form recreation | Low | Existing rec-element-highlight class | Enhance with pulsing border animation matching real Shadow DOM glow overlay |
| Progress overlay as standalone showcase | Show the floating progress overlay (task name, iteration counter, progress bar, ETA) as its own highlighted element | Low | Extract from form recreation or add as separate section | This is a unique visual that competitors don't have |
| Control panel tab navigation | Click sidebar items to switch visible content (Dashboard, API Config, Memory) | High | Build content states for multiple tabs | Significant content creation but shows depth of the product |
| Tool count badge on MCP terminal | Show "43 tools connected" or similar badge in terminal mockup | Low | Count from TOOL_REGISTRY length | Quick visual proof of breadth |

## Anti-Features

Features to explicitly NOT build. Building these would waste effort, mislead visitors, or create maintenance burden.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Actual working automation in the showcase | Would require API keys, active extension, real websites -- impossible for static showcase visitors | Use static HTML/CSS recreations with scripted animations that simulate the experience |
| Embedded iframe of real extension | Chrome extensions cannot be iframed; security model prevents it | Build pixel-accurate HTML/CSS replicas using real CSS tokens |
| Video recordings instead of replicas | Videos are heavy (10-50MB), don't respond to theme toggles, don't scale with CSS, can't be inspected | HTML/CSS recreations are lightweight, theme-aware, inspectable, and instantaneous |
| Auto-playing animation loops | Animations that repeat indefinitely are distracting and feel cheap | Use IntersectionObserver to trigger once when scrolled into view; hold final state |
| Clickable links inside recreations | Clicking "TechCrunch" in the fake Google results would confuse users -- is this the showcase or a real page? | Make recreation content inert (pointer-events: none on content, or clearly mark as demonstration) |
| Full options.html feature parity | The real control panel has 7+ tabs with hundreds of settings; recreating all of them is months of work | Show Dashboard tab (metrics + sessions) and optionally one more tab (API Config or Memory) to hint at depth |
| Reproducing real data/screenshots | Using real user data or screenshots in the showcase creates privacy concerns and staleness | Use realistic but clearly fictional sample data (placeholder names, round-number metrics) |
| Heavyweight JS animation libraries | GSAP, Lottie, or similar would add significant bundle size for marginal improvement | Stick with CSS animations + vanilla JS IntersectionObserver, matching existing pattern |

## Feature Dependencies

```
Theme token alignment -> All replicas (sidepanel, control panel, MCP terminal)
  Sidepanel message CSS analysis -> Sidepanel replica
  Options.css analysis -> Control panel replica
  MCP tool inventory (schema-bridge.ts, autopilot.ts, agents.ts) -> MCP terminal examples

Sidepanel replica (Chat view) -> Interactive tab switching [optional]
Control panel replica (Dashboard) -> Control panel tab navigation [optional]

MCP terminal autopilot example -> MCP manual mode example [build autopilot first, manual second]
MCP terminal autopilot example -> MCP agents example [autopilot is the simpler pattern]
```

## Detailed Feature Specifications

### Feature 1: Sidepanel Replica

**What to replicate from real sidepanel.css:**
- Header: "FSB" title (16px, 600 weight), status indicator (green dot + "Ready" or amber dot + "Automating"), icon buttons (gear, debug, theme, more) with 32x32 pill shape and border
- Tab bar: Chat / Agents / History text tabs with orange underline on active tab
- Message area: padding 20px, gap 16px between messages, flex column with scroll
- Message bubbles: max-width 90%, border-radius 18px, user messages right-aligned with orange gradient + white text, AI messages left-aligned with blue tint + blue left border, system messages with gray bg, action messages full-width monospace with green left border, error messages with red tint + red left border
- Input area: rounded pill input (border-radius 20px), send button (orange gradient circle, 28px), model name badge, voice input icon
- Dark theme: bg-primary #262626, bg-secondary #171717, text-primary #fafafa, border rgba(255,255,255,0.1)
- Light theme: bg-primary #ffffff, bg-secondary #f8f9fa, text-primary #333, border rgba(0,0,0,0.1)

**Sample conversation content for replica:**
1. User: "Search for wireless mouse on Amazon and add the cheapest one to cart"
2. System: "Connected to tab -- amazon.com"
3. AI: "I can see the Amazon homepage. I'll search for a wireless mouse first."
4. Action: `navigate("https://amazon.com")`
5. Action: `type("#twotabsearchtextbox", "wireless mouse")`
6. Action: `click("#nav-search-submit-button")`
7. AI: "Found search results. The cheapest wireless mouse is the Logitech M185 at $12.99. Clicking to add to cart..."
8. Action: `click("[data-asin='B004YAVF0C'] .a-button-input")`
9. Status: [typing dots] "Verifying cart addition..."

### Feature 2: Control Panel Replica

**What to replicate from real options.css:**
- Header bar: full-width top bar with logo area, status dot (connected/disconnected), Test API button, Export button, theme toggle
- Sidebar: dark bg (#171717 in dark), list of tab items with icons -- Dashboard (tachometer), API Configuration (key), Passwords (lock), Background Agents (robot), Advanced Settings (sliders), Memory (database), Site Guides (map), Logs & Debugging (terminal)
- Active tab: highlighted with orange accent color and slightly lighter background
- Dashboard content: 4 metric cards (Total Tokens, Total Cost, Requests, Success Rate) with large value and label
- Token chart: SVG line chart with gradient fill under the line, orange primary color
- Session history: cards with task name, timestamp, iteration count, duration, and status badge (Completed green, Stopped amber, Failed red)

**Sample data for replica:**
- 147,890 Total Tokens, $8.42 Total Cost, 312 Requests, 96.8% Success Rate
- 3 session cards with varied statuses

### Feature 3: MCP Terminal Examples

Three terminal mockups showing different MCP usage patterns, each in a `terminal-mockup` component (dark background, traffic light dots, monospace font).

**Example A: Autopilot mode (run_task)**
```
$ claude

> Use FSB to search for "best mechanical keyboards 2026" on Google
  and summarize the top 3 results.

[FSB] Calling run_task...
  task: "Search for 'best mechanical keyboards 2026' on Google and
        summarize the top 3 results"

[FSB] [Navigation] Navigating to Google...
[FSB] [Extraction] Reading search results... (ETA: ~8s)
[FSB] [Extraction] Clicking first result...
[FSB] [Writing] Composing summary... (ETA: ~3s)

Task completed successfully (12 iterations, 18.4s, $0.02)

Here are the top 3 results for "best mechanical keyboards 2026":

1. **Tom's Hardware** - Top pick: Keychron Q1 Max ($199)
2. **RTINGS** - Best overall: Wooting 80HE ($174)
3. **The Verge** - Editor's choice: HHKB Studio ($340)
```

**Example B: Manual mode (multi-tool orchestration)**
```
$ claude

> Read the current page in the browser, then click the "Sign In"
  button.

[FSB] Calling read_page...
  Page: GitHub - Sign in (https://github.com/login)
  Found 12 interactive elements including:
  - [ref3] input#login_field "Username or email"
  - [ref4] input#password "Password"
  - [ref7] input.btn "Sign in" (submit button)

[FSB] Calling click...
  selector: "input.btn[value='Sign in']"
  Result: Clicked successfully, page navigating...

[FSB] Calling read_page...
  Page: GitHub Dashboard (https://github.com)
  Signed in successfully.
```

**Example C: Agent creation**
```
$ claude

> Create an FSB agent that checks Hacker News for AI articles
  every 2 hours.

[FSB] Calling create_agent...
  name: "HN AI Monitor"
  task: "Go to news.ycombinator.com, find articles mentioning AI
        or LLM, and list the top 5 with scores"
  schedule_type: "interval"
  interval_minutes: 120

Agent created successfully.
  ID: agent_a7f2c9
  Status: Active
  Next run: in 2 hours

[FSB] 43 tools available | Extension connected
```

### Feature 4: Theme Token Alignment

The recreation CSS variables need to be updated to match the real extension's design tokens exactly:

| Token | Current Recreation | Real Sidepanel (dark) | Real Options (dark) | Action |
|-------|-------------------|-----------------------|---------------------|--------|
| Background | `--rec-sp-bg: #1f2937` | `--bg-primary: #262626` | `--bg-primary: var(--gray-900)` = #171717 | Align to #262626 for sidepanel, #171717 for control panel |
| Text primary | `--rec-text-primary: #f1f5f9` | `--text-primary: #fafafa` | `--text-primary: var(--gray-100)` = #f5f5f5 | Align to #fafafa |
| Border | `--rec-sp-border: rgba(255,255,255,0.06)` | `--border-color: rgba(255,255,255,0.1)` | `--border-color: var(--gray-700)` = #404040 | Align to rgba(255,255,255,0.1) |
| Primary color | Uses `var(--primary)` | `--primary-color: #ff6b35` | `--primary-color: #ff6b35` | Already correct |
| Input bg | `--rec-sp-input-bg: #111827` | (uses bg-secondary) #171717 | N/A | Align to #171717 |

## MVP Recommendation

Prioritize in this order:

1. **Theme token alignment** (prerequisite for everything looking correct)
   - Reason: Without correct tokens, all replicas will look "off" even if layout is perfect
   - Complexity: Low
   - Blocks: Everything else

2. **1:1 sidepanel replica (Chat view only)**
   - Reason: This is the primary interaction surface and what visitors will judge the product on
   - Complexity: High (but highest value -- replaces the most outdated recreation)
   - Blocks: Interactive tab switching (differentiator)

3. **1:1 control panel replica (Dashboard view only)**
   - Reason: Second most visible surface; current recreation has the most visible drift from reality
   - Complexity: High
   - Blocks: Control panel tab navigation (differentiator)

4. **MCP terminal example: autopilot (run_task)**
   - Reason: MCP integration is called out on the landing page with a dedicated callout card; there is zero visual evidence of it currently
   - Complexity: Medium
   - Blocks: Other MCP examples

5. **MCP terminal example: manual mode**
   - Reason: Shows the unique "Claude Code controls your browser" value prop that no competitor offers
   - Complexity: Medium

**Defer:**
- Interactive tab switching (sidepanel tabs, control panel sidebar): Significant content creation effort for a differentiator, not table-stakes. Add in a later pass.
- MCP agent creation example: Third-priority MCP example; autopilot and manual mode cover the essential story.
- Control panel tab navigation: Nice-to-have but Dashboard-only is sufficient for the showcase.

## Complexity Estimates

| Feature | New HTML | New CSS | New JS | Estimated Effort |
|---------|----------|---------|--------|------------------|
| Theme token alignment | 0 | ~50 lines of token updates | 0 | 1-2 hours |
| Sidepanel replica (Chat) | ~120 lines | ~200 lines (adapted from real sidepanel.css) | ~20 lines (adjust cascade timing) | 4-6 hours |
| Control panel replica (Dashboard) | ~150 lines | ~250 lines (adapted from real options.css) | ~30 lines (counter animation, chart) | 5-7 hours |
| MCP terminal: autopilot | ~60 lines | ~40 lines (terminal styling, extend existing) | ~30 lines (typing animation) | 2-3 hours |
| MCP terminal: manual mode | ~50 lines | 0 (reuses terminal styling) | ~20 lines (typing animation) | 1-2 hours |
| **Total MVP** | **~380 lines** | **~540 lines** | **~100 lines** | **13-20 hours** |

## Sources

- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ui/sidepanel.css` (real extension sidepanel styles)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ui/options.css` (real extension control panel styles)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/showcase/about.html` (existing recreations)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/showcase/css/recreations.css` (existing recreation styles)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/showcase/js/recreations.js` (existing recreation animations)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/mcp-server/src/tools/autopilot.ts` (run_task, stop_task, get_task_status tools)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/mcp-server/src/tools/manual.ts` (manual browser action tools from TOOL_REGISTRY)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/mcp-server/src/tools/agents.ts` (create_agent, list_agents, run_agent, etc.)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/mcp-server/src/tools/observability.ts` (list_sessions, search_memory, get_logs, etc.)
- Direct analysis: `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/mcp-server/src/tools/read-only.ts` (read_page, get_dom_snapshot, list_tabs, etc.)
- HTML interactive demos concept: https://docs.supademo.com/create/by-supademo-type/html-interactive-demos (pixel-perfect clone methodology)
- ANSI terminal to HTML: https://github.com/drudru/ansi_up, https://github.com/buildkite/terminal-to-html (terminal mockup styling patterns)
- Chrome extension landing page patterns: https://onepagelove.com/tag/chrome-extension
- Claude Code MCP integration docs: https://code.claude.com/docs/en/mcp
