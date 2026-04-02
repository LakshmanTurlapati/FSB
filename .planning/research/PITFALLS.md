# Domain Pitfalls: Showcase High-Fidelity Replicas

**Domain:** Adding pixel-accurate HTML/CSS/JS replicas of a Chrome extension UI and terminal session renders to an existing showcase/landing page
**Researched:** 2026-04-02
**Confidence:** HIGH (based on codebase analysis + verified patterns)

---

## Critical Pitfalls

Mistakes that cause visible breakage, require rewrites, or undermine the whole purpose of the replicas.

### Pitfall 1: CSS Custom Property Collision Between Showcase and Replicas

**What goes wrong:** The showcase site (`main.css`) and the real extension UI (`sidepanel.css`, `options.css`, `fsb-ui-core.css`) all define CSS custom properties on `:root` with overlapping names. When replica CSS is added to the showcase page, variable definitions from one system clobber the other. The showcase uses `--text-primary: #f1f5f9` (dark mode) while the sidepanel uses `--text-primary: #333` (light mode) and `fsb-ui-core.css` uses `--text-primary: var(--fsb-text-primary)` which resolves to `#1f1a17`. Whichever loads last wins.

**Evidence from codebase:**
- `showcase/css/main.css` defines `--bg-primary`, `--text-primary`, `--text-secondary`, `--border-color`, `--shadow-sm`, `--text-muted` on `:root`
- `ui/sidepanel.css` defines the **same variable names** on `:root` with **different values**
- `ui/options.css` defines `--primary-color`, `--bg-primary`, `--text-primary`, `--border-color` on `:root` with yet **different values**
- `shared/fsb-ui-core.css` creates compatibility aliases like `--primary: var(--fsb-primary)` on `:root`
- 82 occurrences of these collision-prone variables across 7 showcase CSS files alone

**Why it happens:** The extension UI files were designed to run in their own `chrome-extension://` context where they are the only stylesheet. The showcase site was designed independently with its own design token names. Both used common, generic variable names.

**Consequences:** Replica text becomes invisible (white text on white background, or dark text on dark background). Borders disappear or become too heavy. Shadows render wrong. The replica looks nothing like the real extension. Worse, the showcase's own nav, footer, and hero section may also break.

**Prevention:**
- Never load real extension CSS files directly into the showcase. Always use namespaced replica CSS.
- The existing `rec-` prefix strategy in `recreations.css` is the right approach. Extend it. Every CSS variable used by replicas must be prefixed: `--rec-*` for variables, `.rec-*` for classes.
- If copying CSS from `sidepanel.css` or `options.css`, replace every `--text-primary` with `--rec-text-primary` (or scope them under a container selector).
- Consider CSS `@scope` (Baseline since Firefox 146, Jan 2026) for true DOM-subtree scoping, but fallback to BEM-prefixed names for safety since some users may be on older browsers visiting the showcase.
- Do NOT use `@import` of the real extension CSS files.

**Detection:** Visual diff -- open showcase in both dark and light modes. If any text is invisible or the wrong color, variable collision is happening.


### Pitfall 2: Showcase Global Reset Corrupting Replica Internals

**What goes wrong:** The showcase's `main.css` applies a universal reset (`*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }`) and blanket typography rules (`h1, h2, h3 { font-weight: 700; line-height: 1.2; }`, `p { color: var(--text-secondary); }`). These cascade into every element inside the replica containers, overriding the extension's own spacing, font sizes, and colors.

**Evidence from codebase:**
- `main.css` line 72-76: universal box-sizing reset
- `main.css` line 120-128: blanket heading and paragraph styling
- `main.css` line 96-100: global `a` color set to `var(--primary)` with transition
- `main.css` line 130-133: global `p` color set to `var(--text-secondary)`
- The extension's `options.css` has its own independent reset (line 120-123) with different assumptions

**Why it happens:** Standard practice is to reset once at the top level. Nobody thinks about it until they embed a foreign UI component that had its own reset assumptions.

**Consequences:** Heading sizes inside the dashboard replica get forced to the showcase's clamp() values instead of the extension's pixel-based sizes. Paragraph colors inside replicas inherit the showcase's secondary text color. Links inside replicas get the showcase's orange color and transition instead of the extension's blue links. Spacing collapses or expands unexpectedly.

**Prevention:**
- Wrap each replica in a container with a specific class (e.g., `.rec-replica-sidepanel`).
- At the top of the replica's CSS, explicitly reset all inheritable properties on the container: `font-size`, `line-height`, `color`, `letter-spacing`, `word-spacing`, `text-align`, `font-weight`.
- Override the global `a`, `p`, `h1-h6` rules inside the replica container to match the extension's actual styling.
- Use `all: initial` on the replica container if desperate, but this breaks CSS variable inheritance too -- so it is a nuclear option with side effects.

**Detection:** Compare font sizes, line heights, and link colors between the real extension and the replica. Any deviation means cascade pollution.


### Pitfall 3: Fidelity Drift -- Replicas Falling Out of Sync With Real Extension

**What goes wrong:** The replica HTML/CSS is a snapshot of the extension UI at the time it was built. As the extension evolves (new tabs added to sidepanel, new dashboard sections, restyled buttons from the v0.9.21 UI retouch milestone), the replicas silently become inaccurate. The showcase advertises features that look different from what users actually see, or worse, shows features that no longer exist.

**Why it happens:** The replica and the real extension are completely separate codebases with no shared source of truth. There is no automated check. The person updating `sidepanel.html` does not know to also update `about.html`'s replica. The showcase is deployed on fly.io while the extension ships via Chrome.

**Consequences:** Prospects see the showcase, install the extension, and see a different UI. This destroys trust. "Is this even the same product?" Outdated replicas also accumulate over multiple milestones, making catch-up harder each time.

**Prevention:**
- Document a "replica sync" checklist in the milestone transition process. Every milestone that touches UI must flag whether replicas need updating.
- Add a comment block at the top of each replica section: `<!-- Replica of: ui/sidepanel.html | Last synced: v0.9.22 | Sync trigger: any change to sidepanel UI -->`.
- Keep replica CSS in a single file (`recreations.css`) rather than scattering it, so there is one place to update.
- If possible, extract shared structural constants (sidebar menu items, tab names, metric labels) into a JS data object that both the extension and the showcase consume. This is complex but prevents content drift.
- Pragmatic minimum: after each UI milestone, run a manual side-by-side screenshot comparison.

**Detection:** Version mismatch between the sync comment and the current extension version. Visual side-by-side comparison shows differences.


### Pitfall 4: Chrome Extension-Specific CSS That Breaks on Regular Web Pages

**What goes wrong:** The real extension UI uses CSS patterns that work inside `chrome-extension://` pages but fail or render differently on a regular web page. Key differences:
1. Extension pages have no competing stylesheets (no third-party ads, no CMS styles). The showcase does.
2. Extension uses `100vh` assuming a Chrome side panel viewport (narrow, full height). On the showcase, `100vh` means the entire browser viewport.
3. The extension's `options.css` uses `html { height: 100vh; }` and `body { height: 100vh; }` which would hijack the entire showcase page layout.
4. Extension popup/sidepanel dimensions are constrained by Chrome (popup max ~800x600, sidepanel ~400px wide). The replica has no such constraint.

**Evidence from codebase:**
- `ui/sidepanel.css` line 35-39: `body { width: 100%; height: 100vh; overflow: hidden; }` -- this would hide all showcase content below the fold
- `ui/options.css` line 127-142: `html/body` at `100vh` with specific `margin: 0; padding: 0;` -- stomps on showcase layout
- `ui/sidepanel.css` line 43-49: `.sidepanel-container { height: 100vh; }` -- fills entire viewport instead of its replica frame

**Why it happens:** Extension UI pages are standalone HTML documents. They own the entire viewport. Replicas are embedded components within a larger page.

**Consequences:** If extension CSS is copy-pasted without adaptation: the body becomes `overflow: hidden`, hiding the rest of the showcase. The replica container tries to fill the entire screen. Scrolling breaks. The replica bleeds outside its browser frame mockup.

**Prevention:**
- Never use `100vh` in replica CSS. Replace with explicit pixel heights or `100%` relative to the `.browser-content` container.
- Never apply styles to `html`, `body`, or `*` in replica CSS. All replica styles must target the replica container class or its descendants.
- Replace `position: fixed` (used in extension for overlays, toasts) with `position: absolute` relative to the replica container.
- Ensure the browser frame container has `overflow: hidden` so nothing bleeds out.

**Detection:** Scroll the showcase page. If scrolling stops working, or the replica fills the entire viewport, extension viewport CSS leaked.


---

## Moderate Pitfalls

Issues that cause visual degradation or maintenance headaches but are recoverable without rewrites.

### Pitfall 5: Terminal/CLI Mockup Monospace Font Rendering Inconsistency

**What goes wrong:** The MCP-in-Claude-Code terminal renders use monospace fonts that render at different sizes across browsers and platforms. Browsers historically render monospace fonts at 13px instead of the expected 16px base size. Mac and Windows render the same monospace font with up to 10px line-height difference. The terminal mockup looks correct on the developer's machine but wrong for visitors.

**Evidence:** The existing showcase already uses monospace: `font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;` (see `home.css` line 118). This font stack is macOS-biased. Windows users will fall back to the generic `monospace` keyword, which may render as Courier New at a different size.

**Why it happens:** Browsers apply a historical quirk where `monospace` alone triggers a smaller default size. Different operating systems have different default monospace fonts with different metrics.

**Prevention:**
- Use the double-monospace trick: `font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', 'Roboto Mono', monospace, monospace;` -- the second `monospace` prevents the browser from shrinking the font.
- Explicitly set `font-size` on all terminal elements (do not inherit).
- Set `line-height` to a fixed value (e.g., `1.5` or `20px`) rather than relying on the font's natural metrics.
- Include Windows-friendly fonts (`Cascadia Code`, `Consolas`) before the generic `monospace`.
- Test on Windows -- this is the most common platform for Chrome extension users.

**Detection:** View the terminal mockup on Windows Chrome. If text is noticeably smaller or line spacing is off compared to the design, this is the cause.


### Pitfall 6: Dark/Light Theme Toggle Not Reaching Replica Internals

**What goes wrong:** The showcase toggles themes by setting `data-theme="light"` on the `<html>` element. The recreation CSS already handles this with `[data-theme="light"]` selectors on its `--rec-*` variables. But if new replica sections are added and the developer forgets to add light-mode overrides for the new variables, the replica stays dark when the rest of the showcase goes light (or vice versa).

**Evidence from codebase:**
- `recreations.css` lines 8-70: has proper dark/light variable sets for `--rec-*` tokens
- The extension itself uses different theme attribute conventions: sidepanel uses `[data-theme="dark"]` (dark is the non-default), while the showcase uses `[data-theme="light"]` (light is the non-default)
- `options.css` uses `[data-theme="dark"]` to override its light-mode defaults

**Why it happens:** Theme attribute direction mismatch. The extension treats light as default and dark as the override. The showcase treats dark as default and light as the override. Copy-pasting theme logic without inverting the direction leaves one mode broken.

**Consequences:** Half the replica renders correctly in dark mode but has wrong colors in light mode, or vice versa. Specifically, backgrounds may stay dark when the page goes light, creating a jarring visual.

**Prevention:**
- Standardize: replicas follow the showcase's theme convention (dark default, `[data-theme="light"]` override).
- When adapting extension CSS to replica CSS, always invert the theme direction if needed.
- Test both themes for every replica section before considering it done.

**Detection:** Toggle the theme button on the showcase. If any replica section does not change appearance, theme overrides are missing.


### Pitfall 7: Animation/Transition Overload Causing Performance Problems

**What goes wrong:** The existing recreations already use multiple CSS animations (glow bars with `slideRight`/`slideDown` at 2s infinite, element pulse at 1.5s infinite, typing dots, viewport glow ambient). Adding more replicas (sidepanel chat, dashboard charts, terminal typing) multiplies the number of concurrent CSS animations. On lower-end devices or when multiple recreation sections are visible on the about page, this causes jank, increased GPU memory, and battery drain on mobile.

**Evidence from codebase:**
- `recreations.css`: 6+ `@keyframes` animations, all set to `infinite`
- `recreations.js`: IntersectionObserver-triggered JS animations (counter counting, message cascading)
- Every recreation section has a viewport glow with 4 animated border bars running continuously

**Why it happens:** Each animation looks fine in isolation. Nobody profiles the page with all sections scrolled into view simultaneously.

**Consequences:** Scroll jank on the about page, especially on mobile. Battery drain. Some browsers throttle background animations but not all.

**Prevention:**
- Use IntersectionObserver to pause animations when sections scroll out of view (not just to start them).
- Consider `animation-play-state: paused` triggered by a `.is-visible` class.
- Limit infinite animations to one per section (the most visually important one).
- Use `will-change` sparingly and remove it when animation completes.
- Measure: open Chrome DevTools > Performance > record a scroll. If frame rate drops below 30fps, cut animations.

**Detection:** Open DevTools Performance tab. Scroll through the about page. Green bars in the timeline indicate paint activity; red bars indicate jank.


### Pitfall 8: Responsive Breakpoint Mismatch Between Showcase and Replica

**What goes wrong:** The showcase has responsive breakpoints at 1024px, 768px, and 480px. The real extension UI has different assumptions: sidepanel is always ~400px wide (no responsive needed), options dashboard has its own breakpoints. When the showcase hits its 768px breakpoint and the feature grid goes single-column, the browser frame mockup shrinks but the replica inside it does not adapt, causing horizontal overflow or content clipping.

**Evidence from codebase:**
- `main.css`: breakpoints at 768px, 480px
- `home.css`: additional breakpoints at 1024px, 768px, 480px
- The existing `.rec-sidepanel` has `width: 320px` as a fixed value -- this does not shrink at narrow viewports
- `.browser-content { min-height: 400px }` -- fixed height on mobile where vertical space is precious

**Why it happens:** The browser frame mockup is designed at desktop scale. On mobile, there is no sensible way to show a "browser window with sidepanel" at 375px viewport width -- the mockup is inherently a desktop concept.

**Prevention:**
- At mobile breakpoints (below 768px), either: (a) hide the sidepanel portion and show only the page content with a note "Side panel shown on desktop," or (b) stack the page content and sidepanel vertically.
- Use `min-width: 0` on flex children to prevent the sidepanel from forcing the container wider than the viewport.
- Test at 375px (iPhone SE), 390px (iPhone 14), and 414px (iPhone Plus).
- For the dashboard replica: at mobile widths, hide the sidebar and show only the main content area.

**Detection:** View the about page on a phone or use Chrome DevTools responsive mode at 375px. If horizontal scrolling appears or content is clipped, the replica is not responsive.


---

## Minor Pitfalls

Issues that cause small visual imperfections or developer friction but are low-impact.

### Pitfall 9: External Asset Loading Failures in Replicas

**What goes wrong:** The existing Google Search recreation loads the Google logo from `https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png`. This external URL can be blocked by ad blockers, CSP policies, or simply be unavailable. The replica shows a broken image.

**Why it happens:** Using real URLs for realistic mockups, without considering that showcase visitors may have different network conditions.

**Prevention:**
- Host all assets locally in `showcase/assets/`. Never hotlink external images in mockups.
- Use inline SVGs for logos where possible (already done for the OpenAI logo in the showcase).
- Add `alt` text and a fallback background color on every image so broken images degrade gracefully.

**Detection:** Load the showcase with an ad blocker enabled. Check for broken image icons.


### Pitfall 10: Hardcoded Text Content Becoming Stale

**What goes wrong:** The dashboard replica shows metrics like "24,580 Total Tokens" and "142 Requests" and session tasks like "Search for flight prices SF to NYC." These are static, hardcoded values that may look outdated or implausible as the product evolves (e.g., if FSB now processes millions of tokens per session).

**Why it happens:** Mockup data is chosen once at build time and never revisited.

**Prevention:**
- Choose representative data that is plausible for a new user's first week (not too high, not too low).
- Add a comment next to hardcoded data: `<!-- Mock data: should represent a typical week of usage -->`.
- Review mockup data when updating replicas.

**Detection:** Ask: "Does this data still represent realistic usage?" If the product has grown significantly, update the numbers.


### Pitfall 11: Accessibility Regression in Decorative Replicas

**What goes wrong:** The replicas are non-interactive decorative elements, but screen readers try to announce every element inside them as if they were functional UI. Users with assistive technology hear a stream of meaningless "button," "text input," "link" announcements from fake UI elements.

**Prevention:**
- Add `role="img"` and a descriptive `aria-label` to each top-level replica container: `<div class="browser-frame" role="img" aria-label="Screenshot showing FSB automating a Google search">`.
- Add `aria-hidden="true"` to all elements inside the replica so screen readers skip them.
- Ensure the section header (`<h2>`) before each replica provides the necessary context for screen reader users.

**Detection:** Test with VoiceOver (macOS) or NVDA (Windows). If the screen reader reads out individual replica elements, accessibility attributes are missing.


### Pitfall 12: Terminal ANSI Color Rendering Without Proper Semantic Markup

**What goes wrong:** When creating MCP-in-Claude-Code terminal mockups, developers use `<span style="color: green">` for output coloring. This looks fine but has no semantic meaning, is hard to maintain, and does not adapt to the showcase's dark/light theme toggle.

**Prevention:**
- Define semantic CSS classes for terminal output types: `.term-prompt`, `.term-command`, `.term-output`, `.term-success`, `.term-error`, `.term-tool-name`, `.term-tool-result`.
- Map these classes to colors using CSS variables that respond to the theme toggle.
- Use `<pre><code>` blocks with these classes, not inline styles.
- For Claude Code output specifically: use a distinct style for tool invocations (e.g., slightly indented with a left border) versus user prompts (with a `>` prefix character).

**Detection:** Toggle the theme. If terminal colors do not change with the rest of the page, inline styles are being used instead of theme-aware variables.


---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|---|---|---|---|
| Sidepanel replica creation | CSS variable collision (#1), global reset corruption (#2), 100vh viewport hijack (#4) | Critical | Use `rec-` prefixed variables, scope all styles under `.rec-sidepanel`, never use `100vh` |
| Control panel (options) replica | Same collisions (#1), plus the options dashboard has a much more complex design token system (60+ variables) making collision surface area huge | Critical | Extract only the visual appearance, do not port the variable system. Rebuild using `rec-` tokens. |
| MCP terminal session renders | Monospace font inconsistency (#5), ANSI color theming (#12), no semantic structure | Moderate | Double-monospace trick, explicit font-size, semantic `.term-*` classes |
| Theme support for all replicas | Direction mismatch (#6), missing overrides for new sections | Moderate | Follow showcase convention (dark default), test both themes for every section |
| Responsive adaptation | Browser frame mockup does not fit mobile (#8) | Moderate | Stack or hide sidepanel at mobile breakpoints, test at 375px |
| Sync with future UI changes | Fidelity drift (#3) | Critical (long-term) | Version-stamped comments, sync checklist in milestone process |
| Performance with multiple replicas | Animation overload (#7) | Moderate | Pause off-screen animations, limit infinite animations |
| Audit of existing replicas | Existing recreations may have pre-existing instances of pitfalls #1-#8 | Moderate | Audit should come first, before adding new replicas, to establish a clean baseline |

---

## FSB-Specific Considerations

These pitfalls are informed by patterns unique to this codebase:

1. **Three different variable naming conventions coexist.** The showcase uses unprefixed names (`--primary`, `--text-primary`). The newer shared UI core uses `--fsb-` prefixed names. The original extension UI files use a mix. The replicas introduced `--rec-` prefixed names. Any integration work must be clear about which namespace it is working in.

2. **The `fsb-ui-core.css` compatibility aliases are a trap.** Lines 69-76 of `fsb-ui-core.css` set `--primary: var(--fsb-primary)` on `:root`. If this file is ever loaded on the showcase page (even accidentally through a shared import), it will override the showcase's own `--primary` value.

3. **The extension uses Shadow DOM for its in-page overlays** (orange glow highlighting), but the replicas do NOT use Shadow DOM. This means the replicas are more vulnerable to CSS interference than the actual extension is on real websites.

4. **The showcase is served from fly.io** while the extension runs locally. Font loading behavior differs: the extension can bundle fonts, the showcase depends on CDN availability (Font Awesome 6.6.0 from cdnjs, Phosphor Icons from unpkg). CDN outages would break icon rendering in replicas.

---

## Sources

- Codebase analysis: `showcase/css/main.css`, `showcase/css/recreations.css`, `showcase/css/home.css`, `ui/sidepanel.css`, `ui/options.css`, `shared/fsb-ui-core.css`
- [CSS @scope: Complete Guide - DevToolbox](https://devtoolbox.dedyn.io/blog/css-scope-complete-guide) -- @scope now Baseline (Newly Available) with Firefox 146
- [How to @scope CSS now that it is Baseline -- Web Standards](https://web-standards.dev/news/2026/01/scope-css-baseline/)
- [Monospace font sizing -- Alex Mansfield](https://alexmansfield.com/css/font-size-line-height-pre-code-monospace/) -- browser monospace font shrinking quirk
- [CSS Custom Properties Complete Guide - DevToolbox](https://devtoolbox.dedyn.io/blog/css-custom-properties-complete-guide) -- namespacing strategy for variable collisions
- [Chrome Content Scripts -- CSS Isolation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- isolated worlds and CSS merging behavior
- [Using CSS containment -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Using) -- CSS containment for rendering isolation
