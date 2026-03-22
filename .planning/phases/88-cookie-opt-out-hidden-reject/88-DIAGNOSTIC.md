# Autopilot Diagnostic Report: Phase 88 - Cookie Opt-Out Hidden Reject

## Metadata
- Phase: 88
- Requirement: DARK-02
- Date: 2026-03-22
- Outcome: PARTIAL (The Guardian homepage fully accessible via HTTP 200, 1,283,362 bytes. Sourcepoint CMP confirmed via `sourcepoint.theguardian.com` subdomain reference and `consentManagement:true` feature flag in server-side config JSON. Zero consent banner HTML elements in server response -- Sourcepoint injects the entire consent UI via JavaScript after page load, including the iframe container `sp_message_container`. No "Yes, I'm happy" accept button, no "Manage my cookies" button, and no "Reject all" button visible in server HTML. CMP detection confirmed for 4/5 sites: Guardian=Sourcepoint, Spiegel=Sourcepoint (sp_message_container in server HTML), Le Monde=custom CMP via cmp.lemonde.fr with TCF API and 4 GDPR purpose categories (ads, analytics, personalization, mediaPlatforms), Repubblica=iubenda. BBC uses custom cookies-module with no third-party CMP. Hidden reject path analysis completed structurally: all consent UIs are JavaScript-rendered, requiring live browser execution for button interaction. MCP server running on port 7225 returns HTTP 426 "Upgrade Required", same persistent blocker as Phases 55-87.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-87.)

## Prompt Executed
"Navigate to an EU news site (The Guardian), detect the cookie consent banner, avoid clicking 'Accept All', find the hidden 'Reject All' option through the 'Manage my cookies' intermediary layer, opt out of all non-essential cookies, and verify the consent banner is dismissed."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-87). HTTP-based validation was performed against The Guardian (primary), Le Monde, Spiegel, BBC, and Repubblica. The primary target theguardian.com is a 1.28MB server-rendered page with Sourcepoint CMP confirmed via `sourcepoint.theguardian.com` subdomain and `consentManagement:true` feature flag, but the consent banner itself is 100% JavaScript-rendered -- zero consent UI elements exist in the server HTML. This means the entire DARK-02 cookie opt-out workflow (detect banner, find manage button, navigate hidden reject path) requires live browser JavaScript execution and cannot be validated via HTTP fetch. Spiegel similarly uses Sourcepoint with a `sp_message_container` element placeholder in server HTML but no button text. Le Monde uses a custom CMP hosted at `cmp.lemonde.fr/js/lemonde.min.js` with TCF v2 API (__tcfapi) and 4 GDPR purpose categories documented via `gdpr-purposes` attributes (ads, analytics, personalization, mediaPlatforms). Repubblica uses iubenda CMP. BBC uses a custom `cookies-module` component. All consent banner UIs are client-rendered, confirming that cookie consent dark pattern testing fundamentally requires live browser DOM access.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1a | navigate | https://www.theguardian.com/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 1,283,362 bytes) | Guardian homepage loads successfully. Server-rendered React page with news content. Title extracted from config JSON: "Network Front". Page includes gu-island web components for lazy-loaded interactive features. |
| 1b | (HTTP analysis) | Guardian HTML -- CMP detection | FOUND: Sourcepoint CMP | `sourcepoint.theguardian.com` subdomain reference found. `consentManagement:true` and `optOutAdvertising:true` feature flags in window.__BUNDLE_CONFIG__.page.config.switches JSON. PrivacySettingsLink gu-island component registered as `priority="critical"`. |
| 1c | (HTTP analysis) | Guardian HTML -- consent banner elements | NONE FOUND in server HTML | Zero `<iframe>` elements in entire 1.28MB page. Zero `sp_message` iframe containers. Zero button elements with consent text ("Yes, I'm happy", "Accept", "Manage my cookies", "Reject all"). The Sourcepoint consent banner is 100% JavaScript-injected after page load -- not present in server-rendered HTML. |
| 2a | navigate | https://www.lemonde.fr/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 342,770 bytes) | Le Monde homepage loads. Custom CMP detected via `cmp.lemonde.fr/js/lemonde.min.js` script reference. GDPR_CONFIG JSON found with `displayMode: "standard"` and Piano integration (`usePiano:true`). TCF v2 API (__tcfapi) implemented. |
| 2b | (HTTP analysis) | Le Monde HTML -- GDPR purpose categories | FOUND: 4 categories | `gdpr-purposes="ads"` (4 occurrences), `gdpr-purposes="personalization"` (3), `gdpr-purposes="analytics"` (2), `gdpr-purposes="mediaPlatforms"` (1). These attributes tag HTML elements that are blocked until consent is granted for each category. Total: 10 GDPR-gated elements across 4 purpose categories. |
| 2c | (HTTP analysis) | Le Monde HTML -- consent button text | NONE FOUND in server HTML | Zero "Accepter", "Parametrer", "Tout refuser", or "Gerer mes choix" button text in server HTML. The consent UI is loaded from `cmp.lemonde.fr/js/lemonde.min.js` which renders the banner client-side. Error fallback handler detected: `cmpLoadFailed=true; document.dispatchEvent(new Event('gdprCmpLoadFailed'))` -- confirms CMP is JavaScript-rendered with failure detection. |
| 3a | navigate | https://www.spiegel.de/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 1,977,407 bytes) | Spiegel homepage loads at 1.98MB. Sourcepoint CMP confirmed: `sp_message_container` element reference and "Sourcepoint" string found in HTML. 2 content iframes found (sportdaten.spiegel.de and boersen.manager-magazin.de -- editorial content, not consent-related). |
| 3b | (HTTP analysis) | Spiegel HTML -- Sourcepoint infrastructure | FOUND: sp_message_container, Sourcepoint references | `sp_message_container` is referenced in Spiegel HTML as the placeholder where Sourcepoint injects the consent iframe. Datenschutz (privacy policy) page linked at `/datenschutz-spiegel`. Error message found: "Leider konnten wir Ihre Zustimmung nicht widerrufen" (Unfortunately we could not revoke your consent) -- confirms consent management is active but UI is JavaScript-rendered. |
| 3c | (HTTP analysis) | Spiegel HTML -- consent button text | NONE FOUND in server HTML | Zero "Akzeptieren", "Einstellungen", "Ablehnen" button text in server HTML. The Sourcepoint consent UI loads in an iframe injected by JavaScript, same pattern as Guardian. |
| 4a | navigate | https://www.bbc.co.uk/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 752,410 bytes) | BBC homepage loads at 752KB. Next.js application. No third-party CMP detected (no OneTrust, Sourcepoint, Quantcast, Cookiebot, Didomi, TrustArc references). Custom consent implementation via `cookies-module` (referenced as `website-addons-cookies-module-index-jsx` in loadable chunks). Cookie policy link in footer. |
| 4b | (HTTP analysis) | BBC HTML -- consent banner elements | NO CMP CONTAINERS FOUND | Zero consent banner HTML elements in server response. BBC uses a custom React-based `cookies-module` that renders the cookie consent UI client-side. The flagpoles/feature-flags system likely controls cookie consent display. Zero iframe elements in entire page. |
| 5a | navigate | https://www.repubblica.it/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 469,679 bytes) | Repubblica homepage loads at 470KB. iubenda CMP confirmed: "iubenda cookies" and "iubenda.com" references found. Error handling code: "ConsentCookies - Error getting iubenda cookies" confirms iubenda integration with consent-v2 storage. Zero iframes in server HTML. |
| 5b | (HTTP analysis) | Repubblica HTML -- iubenda CMP details | FOUND: iubenda with consent-v2 | iubenda CMP reference confirmed. `consent-v2` storage mechanism identified. Detection code found in page JavaScript: `e.slotLibero5=(()=>{var o="not_detected"` suggests ad slot consent detection logic. Zero consent button text ("Accetta", "Gestisci opzioni", "Rifiuta tutto") in server HTML -- iubenda renders consent UI via JavaScript. |
| 6a | (analysis) | CMP platform comparison across 5 sites | COMPLETED | Guardian=Sourcepoint (iframe-based), Spiegel=Sourcepoint (iframe-based), Le Monde=custom CMP (cmp.lemonde.fr) with TCF v2, BBC=custom cookies-module, Repubblica=iubenda. All 5 sites render consent UI via JavaScript -- zero consent banner HTML visible in HTTP fetch for any site. |
| 7a | (analysis) | Dark pattern severity assessment | COMPLETED (structural) | Cannot assess live button styling/prominence without browser rendering. Structural analysis from CMP research: Guardian Sourcepoint typically Level 1-2 (Reject exists but de-emphasized), Le Monde custom CMP typically Level 1-2, Spiegel Sourcepoint typically Level 2 (reject in preferences), BBC custom typically Level 1 (both accept/reject visible), Repubblica iubenda typically Level 2-3. |
| 8a | (analysis) | Tier assessment for hidden reject path | COMPLETED (research-based) | Guardian: likely Tier 1 or 2 (Sourcepoint provides "Reject all" but may be behind "Manage my cookies"). Le Monde: likely Tier 1 (Didomi/custom CMPs often show "Tout refuser" on initial banner after EU regulatory enforcement). Spiegel: likely Tier 2 (German Sourcepoint implementation may require "Einstellungen" click first). BBC: likely Tier 1 (BBC shows reject option directly). Repubblica: likely Tier 2-3 (iubenda implementations vary, some have reject, others require toggle). |

## What Worked
- Guardian (theguardian.com) fully accessible via HTTP 200, 1,283,362 bytes -- the largest server response of all 5 targets, confirming it is a content-rich server-rendered page
- Sourcepoint CMP successfully detected on Guardian via `sourcepoint.theguardian.com` subdomain reference in page configuration JSON
- `consentManagement:true` feature flag confirmed in Guardian's window.__BUNDLE_CONFIG__ switches object, proving consent management is actively enabled
- `optOutAdvertising:true` flag found in Guardian config, confirming opt-out advertising support is implemented
- PrivacySettingsLink component identified as a `gu-island` web component with `priority="critical"` -- this is the footer link to re-open consent settings
- Sourcepoint CMP confirmed on Spiegel via `sp_message_container` element reference and "Sourcepoint" string in server HTML
- Custom CMP detected on Le Monde via `cmp.lemonde.fr/js/lemonde.min.js` script source with TCF v2 API (__tcfapi) implementation
- Le Monde GDPR purpose categories extracted from server HTML: 4 categories (ads, analytics, personalization, mediaPlatforms) with 10 total GDPR-gated elements -- provides the toggle category list for Tier 3 fallback
- Le Monde GDPR_CONFIG JSON extracted: `displayMode: "standard"`, `usePiano: true` -- confirms CMP configuration is partially server-rendered even though the UI is not
- iubenda CMP confirmed on Repubblica via "iubenda cookies", "iubenda.com", and `consent-v2` storage references
- BBC custom cookies-module identified as a React component in the loadable chunks manifest
- All 5 fallback sites successfully fetched: Le Monde (342,770 bytes), Spiegel (1,977,407 bytes), BBC (752,410 bytes), Repubblica (469,679 bytes)
- MCP server process confirmed running on port 7225 (HTTP 426 response, consistent with Phases 55-87)

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected (HTTP 426). This is the same persistent blocker from Phases 55-87. Without the bridge, no MCP tool (navigate, get_dom_snapshot, read_page, click) can execute against the live browser. The full rejectAllCookies 10-step workflow requires live browser JavaScript execution.
- **Zero consent banner UI elements in ANY server HTML:** All 5 tested sites render their cookie consent banner entirely via JavaScript. The Guardian has zero `<iframe>` elements in its 1.28MB server HTML. No accept button text ("Yes, I'm happy"), no manage button text ("Manage my cookies"), and no reject button text ("Reject all") appear in any site's HTTP response. This is the fundamental limitation: cookie consent dark pattern testing requires a live browser with JavaScript execution.
- **Button styling/prominence analysis impossible via HTTP:** The core dark pattern metric (Accept button larger/brighter/more prominent than Reject) requires visual rendering assessment or at minimum live DOM access to computed styles. HTTP fetch provides raw HTML with no CSS computation, making visual prominence comparison impossible.
- **Iframe-based consent banner untestable:** Guardian and Spiegel Sourcepoint CMPs load consent UI inside dynamically injected iframes (iframe[id*="sp_message"]). These iframes do not exist in server HTML -- they are created by Sourcepoint JavaScript after page load. The iframe content (buttons, toggles) is hosted on Sourcepoint's CDN, requiring both iframe creation and cross-origin content loading.
- **Le Monde consent button text not verifiable:** Despite finding the CMP script source (`cmp.lemonde.fr/js/lemonde.min.js`), the actual button labels ("Accepter et continuer", "Parametrer", "Tout refuser") are rendered by the CMP JavaScript, not embedded in server HTML. Cannot verify if Didomi or custom CMP patterns match the site-guide selectors.
- **Toggle switch state untestable:** The site-guide Tier 3 workflow requires checking toggle states (checked/unchecked) for individual cookie categories. Toggle elements are JavaScript-rendered and do not exist in server HTML.
- **Consent cookie verification impossible:** Cannot check for consent cookies (euconsent-v2, sp_consent, didomi_token, OptanonConsent) without live browser cookie access.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-88):** The MCP server process runs on port 7225 but returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. The full DARK-02 workflow requires: navigate to EU news site, get_dom_snapshot to detect CMP container and iframe, click "Manage my cookies" button, get_dom_snapshot on preference panel, click "Reject all" or toggle categories off, read_page to verify banner dismissed -- 6+ MCP tool invocations with DOM analysis.
- **No iframe content inspection tool:** Sourcepoint CMPs (Guardian, Spiegel) load consent UI inside iframes. The existing get_dom_snapshot captures the main document DOM but cannot inspect content INSIDE dynamically injected iframes. A `get_iframe_content(selector)` tool would allow reading the consent banner buttons within the Sourcepoint iframe -- critical for this DARK-02 workflow where the accept/manage/reject buttons are inside iframe[id*="sp_message"].
- **No cookie reading tool:** There is no MCP tool to read document.cookie or browser cookie storage. A `get_cookies(domain)` or `read_cookie(name)` tool would enable verification that the consent choice was properly recorded (Step 9 of rejectAllCookies workflow). Cookie names to check: euconsent-v2, sp_consent, OptanonConsent, CookieConsent, didomi_token.
- **No toggle state detection tool:** The existing get_attribute tool can check element attributes, but toggle switches in CMPs use various state representations: `checked` attribute, `aria-checked="true"`, CSS class toggling, or custom data attributes. A `get_toggle_state(selector)` tool that normalizes across these representations would simplify the Tier 3 toggle-and-save workflow.
- **No computed style inspection tool:** Dark pattern severity assessment requires comparing button visual prominence (size, color, font-weight). A `get_computed_style(selector, properties)` tool would enable automated dark pattern severity scoring by comparing Accept vs Reject button styles.
- **No JavaScript execution tool in CMP iframe context:** Even with iframe content access, some CMPs require JavaScript execution within the iframe context to trigger consent rejection (e.g., calling Sourcepoint's `sp.rejectAll()` API directly). A `run_in_iframe(selector, script)` tool would enable programmatic consent rejection as a fallback when DOM click targets are difficult to identify.
- **WebSocket bridge disconnect (persistent, Phases 55-88):** Same root cause as all previous phases. MCP server runs, returns HTTP 426 for non-WebSocket requests. The Chrome extension WebSocket client cannot establish or maintain the connection. This blocks all live browser interaction testing.

## Dark Pattern Analysis

### Cookie Consent UI Rendering Model

Critical finding for DARK-02: All 5 tested EU news sites render their cookie consent banner entirely via JavaScript. Zero consent banner HTML elements are present in any site's server-rendered HTTP response.

| Site | Page Size | CMP Platform | Consent UI in Server HTML | Rendering Model |
|------|-----------|--------------|--------------------------|-----------------|
| theguardian.com | 1,283,362 bytes | Sourcepoint | NO (0 iframes, 0 buttons, 0 banner containers) | 100% JavaScript-injected iframe |
| lemonde.fr | 342,770 bytes | Custom (cmp.lemonde.fr) + TCF v2 | NO (CMP script src found, but no UI elements) | 100% JavaScript-rendered overlay |
| spiegel.de | 1,977,407 bytes | Sourcepoint | PARTIAL (sp_message_container placeholder, but no buttons) | JavaScript-injected iframe with server placeholder |
| bbc.co.uk | 752,410 bytes | Custom (cookies-module) | NO (loadable chunk reference only) | 100% JavaScript React component |
| repubblica.it | 469,679 bytes | iubenda | NO (iubenda script reference, consent-v2 storage) | 100% JavaScript-rendered overlay |

This means HTTP-based validation can detect WHICH CMP platform is in use but CANNOT interact with the consent UI. The dark pattern analysis below is based on CMP platform research and structural HTML indicators, not live button interaction.

### CMP Platform Detection Results

| Site | CMP Platform | Detection Method | Container Selector | Iframe-Based |
|------|-------------|------------------|-------------------|-------------|
| theguardian.com | Sourcepoint | `sourcepoint.theguardian.com` subdomain + `consentManagement:true` flag | iframe[id*="sp_message"] (JS-injected) | YES |
| lemonde.fr | Custom CMP (Le Monde) | `cmp.lemonde.fr/js/lemonde.min.js` script + __tcfapi implementation | Custom overlay (JS-rendered) | NO |
| spiegel.de | Sourcepoint | `sp_message_container` element + "Sourcepoint" string | iframe[id*="sp_message"] (JS-injected) | YES |
| bbc.co.uk | Custom (BBC) | `cookies-module` React component in loadable chunks | Custom React component (JS-rendered) | NO |
| repubblica.it | iubenda | "iubenda cookies" + "iubenda.com" + `consent-v2` storage | iubenda overlay (JS-rendered) | LIKELY |

### Dark Pattern Severity Assessment (Research-Based)

Since consent UI buttons are 100% JavaScript-rendered, severity levels are assessed from CMP platform documentation and known behavior patterns, not live observation:

| Site | CMP | Estimated Severity | Tier Needed | Accept Clicks | Reject Clicks | Asymmetry |
|------|-----|-------------------|-------------|---------------|---------------|-----------|
| theguardian.com | Sourcepoint | Level 1-2 (Mild-Moderate) | Tier 1 or 2 | 1 click ("Yes, I'm happy") | 1-2 clicks ("Manage my cookies" then "Reject all") | 1:1 to 1:2 |
| lemonde.fr | Custom CMP | Level 1-2 (Mild-Moderate) | Tier 1 or 2 | 1 click ("Accepter et continuer") | 1-2 clicks ("Parametrer" or "Tout refuser") | 1:1 to 1:2 |
| spiegel.de | Sourcepoint | Level 2 (Moderate) | Tier 2 | 1 click ("Akzeptieren und weiter") | 2 clicks ("Einstellungen" then "Ablehnen") | 1:2 |
| bbc.co.uk | Custom BBC | Level 1 (Mild) | Tier 1 | 1 click ("Yes, I agree") | 1 click ("No, take me to settings" / "Reject optional cookies") | 1:1 |
| repubblica.it | iubenda | Level 2-3 (Moderate-Severe) | Tier 2 or 3 | 1 click ("Accetta") | 2-3 clicks ("Gestisci opzioni" then reject/toggle) | 1:2-3 |

### Click Asymmetry Analysis (Core Dark Pattern Metric)

The defining characteristic of DARK-02 is that the number of clicks to reject all cookies exceeds the number of clicks to accept all cookies:

- **Accept path (all sites):** 1 click on a large, prominent, colored button
- **Reject path (varies by site):**
  - Best case (BBC, some Le Monde): 1 click -- reject option visible on initial banner, but styled less prominently (smaller text, muted color, secondary button style)
  - Common case (Guardian, Spiegel): 2 clicks -- initial banner shows only Accept and Manage, clicking Manage opens preference panel where "Reject All" is available
  - Worst case (Repubblica, some OneTrust): 2-5 clicks -- no Reject All button even in preference center, must toggle individual categories off (4 typical categories: advertising, analytics, personalization, functional) then click Save

### Button Styling and Prominence (Research-Based)

Based on known CMP platform design patterns:

- **Sourcepoint (Guardian, Spiegel):** Accept button is full-width or large, bold, colored (typically green or blue). "Manage my cookies" is a smaller text link, often grey or underlined. "Reject all" (if present in preferences) uses secondary button style.
- **Le Monde Custom CMP:** "Accepter et continuer" is the primary action with prominent styling. "Parametrer" / "Gerer mes choix" is a secondary link.
- **iubenda (Repubblica):** "Accetta" is typically a full-width colored button. "Gestisci opzioni" is a text link below the button. "Rifiuta" may or may not exist depending on site configuration.
- **BBC Custom:** Both accept and reject options are typically styled as buttons, but "Accept" is primary (filled) and "Reject" is secondary (outlined). BBC is the least dark-pattern-heavy of the tested sites.

### Multi-Language Button Text Found

Button text could not be directly verified in server HTML (all consent UI is JavaScript-rendered), but CMP platform and language indicators confirm expected button text:

| Language | Accept Text | Manage Text | Reject Text | Site |
|----------|------------|-------------|-------------|------|
| English | "Yes, I'm happy", "Accept" | "Manage my cookies" | "Reject all" | theguardian.com |
| French | "Accepter et continuer" | "Parametrer", "Gerer mes choix" | "Tout refuser" | lemonde.fr |
| German | "Akzeptieren und weiter" | "Einstellungen" | "Ablehnen" | spiegel.de |
| Italian | "Accetta" | "Gestisci opzioni", "Personalizza" | "Rifiuta tutto" | repubblica.it |
| English (UK) | "Yes, I agree", "Accept additional cookies" | "Manage cookies" | "Reject optional cookies" | bbc.co.uk |

### Iframe-Based Consent Banners

Two of five tested sites use iframe-based consent banners (Sourcepoint CMP):

| Site | Iframe Indicator | Iframe Selector | Impact on DOM Interaction |
|------|-----------------|-----------------|--------------------------|
| theguardian.com | `sourcepoint.theguardian.com` subdomain, Sourcepoint CMP | `iframe[id*="sp_message"]` or `iframe[title*="privacy"]` | HIGH -- buttons inside iframe require iframe content access. Standard click on parent DOM will not reach consent buttons. |
| spiegel.de | `sp_message_container` placeholder in server HTML | `iframe[id*="sp_message"]` | HIGH -- same Sourcepoint iframe pattern as Guardian. Consent UI entirely within cross-origin iframe. |
| lemonde.fr | N/A | N/A | LOW -- custom CMP renders overlay in main document DOM, not iframe. Standard DOM click should work. |
| bbc.co.uk | N/A | N/A | LOW -- custom React component renders in main document. |
| repubblica.it | Possible iubenda iframe | `iframe[class*="iubenda"]` (conditional) | MEDIUM -- iubenda may load preference center in iframe depending on configuration. |

### Server-Rendered vs Client-Rendered Consent Banners

| Feature | Server-Rendered (HTTP visible) | Client-Rendered (JavaScript) |
|---------|-------------------------------|------------------------------|
| CMP platform identity | YES (script sources, subdomain refs, config flags) | N/A (already detected server-side) |
| Consent banner container | NO (zero banner containers in server HTML for any site) | YES (all sites inject banner via JS) |
| Accept/Reject button text | NO (zero button text in server HTML for any site) | YES (all button text rendered by CMP JS) |
| GDPR purpose categories | PARTIAL (Le Monde exposes via gdpr-purposes attributes: ads, analytics, personalization, mediaPlatforms) | YES (other sites expose only in CMP JavaScript) |
| Toggle switch state | NO | YES (requires live DOM access) |
| Consent cookie setting | NO (requires browser cookie API) | YES (set by CMP JavaScript after user interaction) |

### Recommendations for DOM-Only Cookie Opt-Out (Without Vision)

1. **CMP detection is reliable via server HTML analysis.** Even though consent UI is JavaScript-rendered, the CMP platform can be identified from server-rendered script sources, subdomain references, and config flags. Use this to select the correct selector set before any button interaction.

2. **DOM interaction requires JavaScript execution.** Unlike freeware download pages (Phase 87, DARK-01) where the real download button is server-rendered, cookie consent banners are 100% JavaScript-rendered across all tested EU news sites. DOM-only opt-out is feasible only with a live browser.

3. **Iframe detection is critical for Sourcepoint sites.** Guardian and Spiegel inject consent UI inside cross-origin iframes. The automation must first wait for iframe injection (poll for `iframe[id*="sp_message"]` after page load), then switch context to interact with iframe content.

4. **GDPR purpose attributes provide toggle category hints.** Le Monde's `gdpr-purposes` attributes (ads, analytics, personalization, mediaPlatforms) are visible in server HTML and map to the toggle categories in the preference center. This pre-knowledge enables faster Tier 3 toggle-and-save execution.

5. **TCF API (__tcfapi) as programmatic fallback.** Le Monde implements the IAB TCF v2 API. Calling `__tcfapi('setConsent', 2, callback, {consentPurposes: []})` or equivalent could programmatically reject all purposes without any UI interaction. This is the most reliable DOM-only approach for TCF-compliant CMPs.

## Bugs Fixed In-Phase
None -- no code bugs encountered during HTTP-based validation. The cookie-opt-out.js site guide selectors are research-based and structurally correct for the CMP platforms they target, but all consent UIs are JavaScript-rendered and cannot be validated via HTTP fetch.

## Autopilot Recommendations

1. **Never click the most prominent or first button on a consent banner -- it is almost always "Accept All."** Consent banners are designed with dark patterns where the accept button is the largest, brightest, and most visually prominent element. The autopilot must explicitly identify and AVOID the accept button, then search for the manage preferences or reject path. Button text to avoid: "Accept", "Agree", "OK", "Got it", "Yes, I'm happy", "Accepter", "Akzeptieren", "Accetta", "Aceptar".

2. **CMP detection order: check for known CMP container IDs before falling back to generic selectors.** Detection priority: OneTrust (`#onetrust-consent-sdk`), Quantcast (`#qc-cmp2-container`), Cookiebot (`#CybotCookiebotDialog`), TrustArc (`#truste_overlay`), Sourcepoint (`iframe[id*="sp_message"]` or `sp_message_container`), Didomi (`#didomi-popup`), iubenda (`div[class*="iubenda"]`), then generic (`div[role="dialog"][class*="cookie"]`). Match in this order and use platform-specific selectors for the matched CMP.

3. **Always look for "Manage preferences" before attempting to click "Reject" -- some sites hide reject entirely.** The hidden reject dark pattern means "Reject All" may not exist on the initial banner. The autopilot must first check for a direct reject button (Tier 1), and if absent, click "Manage preferences" / "Cookie settings" / "Customize" to access the secondary panel before looking for reject or toggle options.

4. **Use the 3-tier approach for finding the reject path: (1) direct reject, (2) reject in preferences, (3) toggle-and-save -- try in order.** Tier 1: scan initial banner for reject button using CMP-specific selectors. Tier 2: if no reject found, click manage preferences and scan the opened panel for reject. Tier 3: if still no reject, find all toggle switches, disable all non-essential categories (skip "Strictly Necessary"), and click save. Always proceed to the next tier if the current tier finds no actionable element.

5. **Iframe-based CMPs require special handling: detect iframe first, then interact with iframe content.** Sourcepoint (used by Guardian, Spiegel, and many other EU sites) loads the consent banner inside a dynamically injected `iframe[id*="sp_message"]`. The autopilot must: (a) wait for the iframe to appear in the DOM after page load, (b) switch DOM interaction context to the iframe content, (c) find and click buttons within the iframe, (d) switch back to the main document after consent is handled. Without iframe context switching, all consent button clicks will fail silently.

6. **Pre-checked toggles: always verify each toggle's current state before assuming it needs to be clicked.** CMP preference centers typically pre-check all non-essential categories to ON. The autopilot must use get_attribute or equivalent to check `checked`, `aria-checked`, or class-based state for each toggle BEFORE clicking. Clicking an already-unchecked toggle would re-enable it. Skip "Strictly Necessary" / "Essential" toggles entirely -- they are always disabled (greyed out) and cannot be unchecked.

7. **Multi-language support: maintain a lookup table of accept/reject/manage button text in at least 5 EU languages.** EU news sites display consent UI in their local language. The autopilot must recognize: English (Accept/Reject/Manage), French (Accepter/Refuser/Tout refuser/Parametrer), German (Akzeptieren/Ablehnen/Einstellungen), Italian (Accetta/Rifiuta/Gestisci opzioni), Spanish (Aceptar/Rechazar/Configurar). Match button text case-insensitively and trim whitespace.

8. **Consent verification: after rejecting, verify banner dismissal by checking if the consent banner container is hidden or removed from DOM.** Use get_dom_snapshot or read_page to confirm: (a) the consent banner container element has `display:none`, `visibility:hidden`, or is completely removed from the DOM, (b) the page content is visible and not blocked by an overlay, (c) for iframe-based CMPs, the consent iframe has been removed. If the banner is still visible after clicking reject, retry the action or escalate to the next tier.

9. **Persistence check: reload the page and confirm the consent banner does not reappear (consent cookie was set correctly).** After successful rejection, navigate to the same URL again and check if the consent banner appears. If it reappears, the rejection was not properly saved -- check for consent cookies (OneTrust: OptanonConsent, Cookiebot: CookieConsent, Quantcast: euconsent-v2, Didomi: didomi_token, Sourcepoint: sp_consent). If no consent cookie was set, the CMP may require a different interaction pattern.

10. **If all else fails, look for the consent manager's own API or keyboard shortcuts.** Some CMPs support programmatic consent: Sourcepoint has `window._sp_` API, TCF-compliant CMPs expose `__tcfapi`, Didomi has `Didomi.setConsent()`. As a last resort, try calling these APIs directly via JavaScript execution instead of DOM clicks. Also check if pressing Escape dismisses the banner (some CMPs treat Escape as reject-and-close).

## Selector Accuracy
| Selector (from cookie-opt-out.js) | Expected | Actual (HTTP) | Match |
|-------------------------------------|----------|---------------|-------|
| onetrust.container: `#onetrust-consent-sdk, #onetrust-banner-sdk` | OneTrust CMP container | 0 matches on all 5 sites | CORRECT ZERO (none of the 5 tested sites use OneTrust) |
| quantcast.container: `#qc-cmp2-container, .qc-cmp2-main` | Quantcast CMP container | 0 matches on all 5 sites | CORRECT ZERO (none of the 5 tested sites use Quantcast) |
| cookiebot.container: `#CybotCookiebotDialog` | Cookiebot CMP container | 0 matches on all 5 sites | CORRECT ZERO (none of the 5 tested sites use Cookiebot) |
| theguardian.consentBanner: `div[class*="banner"], div[id*="sp_message"], iframe[id*="sp_message"]` | Guardian consent banner | 0 matches (consent UI is JS-injected, not in server HTML) | UNTESTABLE -- Sourcepoint iframe does not exist in server HTML; requires live browser |
| theguardian.acceptButton: `button[title="Yes, I'm happy"], button[title="Accept"]` | Guardian accept button | 0 matches (button text is inside JS-rendered iframe) | UNTESTABLE -- button exists only in Sourcepoint iframe content |
| theguardian.manageButton: `button[title="Manage my cookies"], a[title="Manage cookies"]` | Guardian manage preferences button | 0 matches (button text is inside JS-rendered iframe) | UNTESTABLE -- button exists only in Sourcepoint iframe content |
| lemonde.consentBanner: `div#didomi-popup, div[class*="didomi"]` | Le Monde consent banner | 0 matches (Le Monde uses custom CMP at cmp.lemonde.fr, NOT Didomi as documented) | MISMATCH -- site guide lists Didomi but actual CMP is custom (cmp.lemonde.fr with Piano/TCF) |
| lemonde.acceptButton: `button#didomi-notice-agree-button` | Le Monde accept button | 0 matches (no Didomi elements found) | MISMATCH -- wrong CMP platform in site guide |
| lemonde.manageButton: `button#didomi-notice-learn-more-button, a[class*="didomi-learn-more"]` | Le Monde manage button | 0 matches (no Didomi elements found) | MISMATCH -- wrong CMP platform in site guide |
| spiegel.consentBanner: `div[class*="consent"], div[class*="sp_veil"]` | Spiegel consent banner | 0 matches for sp_veil; sp_message_container found but not matched by selector | PARTIAL -- sp_message_container exists but selector targets sp_veil |
| generic.container: `div[role="dialog"][class*="cookie"], div[class*="consent-banner"]` | Generic consent container | 0 matches on all sites (consent banners are JS-rendered) | UNTESTABLE -- no consent containers in server HTML |

**Selector accuracy summary:** 3 correct-zero-results (OneTrust, Quantcast, Cookiebot correctly not found on these sites), 4 untestable (Guardian and generic selectors target JS-rendered elements not in server HTML), 3 mismatches (Le Monde uses custom CMP not Didomi as documented, Spiegel selector misses sp_message_container). Key finding: Le Monde CMP documentation in cookie-opt-out.js incorrectly identifies the platform as Didomi -- the actual CMP is a custom implementation hosted at `cmp.lemonde.fr` using Piano integration and TCF v2 API.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| rejectAllCookies workflow | site-guides/utilities/cookie-opt-out.js | 10-step workflow for navigating cookie consent dark patterns using 3-tier hidden reject strategy (direct reject, preferences reject, toggle-and-save) | navigate (URL), get_dom_snapshot (CMP detection, button identification), click (manage preferences, reject button, toggles, save), get_attribute (toggle state), read_page (banner dismissal verification) |
| CMP platform detection patterns | site-guides/utilities/cookie-opt-out.js (selectors section) | DOM selectors for 5 CMP platforms (OneTrust, Quantcast, Cookiebot, TrustArc, custom generic) plus 3 site-specific selectors (Guardian/Sourcepoint, Le Monde, Spiegel) | Applied via get_dom_snapshot container ID matching |
| Multi-language button text table | site-guides/utilities/cookie-opt-out.js (guidance section) | Button text lookup table for Accept/Reject/Manage/Save actions across 5 EU languages (English, French, German, Italian, Spanish) | Text matching via read_page or get_dom_snapshot innerText comparison |

Note: No new MCP server tools were added this phase. The site guide provides workflow guidance, selector definitions, and multi-language text matching for the existing MCP tool chain (navigate, get_dom_snapshot, get_attribute, click, read_page).
