/**
 * Site Guide: Cookie Opt-Out Hidden Reject
 * Per-site guide for navigating EU news site cookie consent banners that hide
 * the reject/decline option behind a "Manage preferences" secondary layer,
 * using DOM analysis to find the hidden reject path.
 *
 * Key challenge: Cookie consent banners (OneTrust, Quantcast, Cookiebot, TrustArc,
 * custom CMPs) make "Accept All" visually prominent while hiding "Reject All"
 * behind a secondary screen. The AI must detect the CMP platform, navigate through
 * the intermediary "Manage preferences" layer, and find the hidden reject button
 * or toggle all cookie categories off and save.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-02) -- the accept
 * button is large and brightly colored while the reject path requires extra clicks
 * through a secondary preferences panel. DOM analysis is required to find the
 * hidden opt-out path.
 *
 * Created for Phase 88, DARK-02 edge case validation.
 * Target: opt out of all non-essential cookies on an EU news site where the reject
 * option is hidden behind a "Manage preferences" intermediary layer.
 */

registerSiteGuide({
  site: 'Cookie Opt-Out Hidden Reject',
  category: 'Utilities',
  patterns: [
    /cookie.opt.out/i,
    /cookie.consent/i,
    /cookie.reject/i,
    /hidden.reject/i,
    /gdpr.consent/i,
    /theguardian\.com/i,
    /lemonde\.fr/i,
    /spiegel\.de/i,
    /bbc\.co\.uk/i,
    /repubblica\.it/i,
    /onetrust/i,
    /quantcast/i,
    /cookiebot/i,
    /manage.*cookies/i,
    /reject.*cookies/i
  ],

  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic DARK-02):
- [dark] NEVER click the prominent first button on consent banners -- it is always Accept All
- [dark] Use 3-tier reject path: direct reject > reject in preferences > toggle-and-save
- [dark] Sourcepoint CMPs load consent UI inside iframes -- detect iframe first, interact inside it
- [dark] Pre-checked toggles default ON -- verify each toggle state before clicking, skip Strictly Necessary
- [dark] Match button text across EU languages: Reject/Refuser/Ablehnen/Rifiuta/Rechazar

COOKIE OPT-OUT HIDDEN REJECT INTELLIGENCE (DARK-02):

DARK PATTERN CONTEXT (DARK-02):
Cookie consent banners on EU websites are legally required under GDPR/ePrivacy
Directive, but many sites implement "dark patterns" that make accepting all cookies
the easiest option while hiding the reject path. The dark pattern manifests in
several ways:

(a) The "Accept All" button is large, brightly colored (green, blue), and placed
    prominently on the initial consent banner. It requires exactly ONE click.
(b) The "Reject All" option is hidden behind a "Manage preferences" or "Cookie
    settings" secondary screen, requiring at least TWO clicks (open preferences,
    then reject or toggle off and save).
(c) Some sites style the "Manage preferences" link as plain text or a small link
    rather than a button, making it visually less prominent.
(d) Some sites have NO "Reject All" button at all -- even in the preference center.
    The user must toggle individual cookie categories off one by one, then click
    "Save preferences."
(e) Pre-checked toggles: preference panels default all non-essential categories to
    ON, requiring the user to actively disable each one.

The AI must NEVER click "Accept All" -- this is the exact dark pattern trap. Instead,
the AI must find the path to the hidden reject option using DOM analysis:
1. Detect which CMP (Consent Management Platform) is in use via DOM selectors
2. Locate the "Manage preferences" or equivalent button instead of "Accept All"
3. Navigate the secondary preferences layer
4. Find and click "Reject All" or toggle all categories off and save
5. Verify cookies were declined

CMP PLATFORM DETECTION:
Detect the consent management platform by checking for platform-specific DOM
container elements. Check in priority order:

Platform 1: OneTrust
  Container: div#onetrust-consent-sdk or div#onetrust-banner-sdk
  Accept button: button#onetrust-accept-btn-handler
  Manage preferences: button#onetrust-pc-btn-handler or a.onetrust-pc-btn-handler
    (opens the preference center overlay)
  Preference center: div#onetrust-pc-sdk
  Reject all: button.onetrust-close-btn-handler or button with class containing
    "ot-pc-refuse-all-handler" in the preference center
  Toggle switches: input.onetrust-toggle[type="checkbox"] or div.ot-toggle with
    nested input[type="checkbox"] -- the .ot-switch container wraps each toggle
  Save: button.save-preference-btn-handler or button with class containing
    "ot-pc-refuse-all-handler"
  Notes: OneTrust is the most widely used CMP globally. The preference center loads
    as an overlay on top of the page. Toggle switches are in .ot-switch containers.
    "Strictly Necessary" cookies category is always disabled (cannot be unchecked).

Platform 2: Quantcast (QC CMP2)
  Container: div#qc-cmp2-container or div.qc-cmp2-main
  Accept button: button[mode="primary"] or first button in .qc-cmp2-summary-buttons
  Manage preferences: button[mode="secondary"] or last button in
    .qc-cmp2-summary-buttons, or link in .qc-cmp2-footer-links
  Reject all: button[mode="secondary"] in the detail/preference panel, or
    "Object to all" / "Disagree" button
  Toggle switches: div.qc-cmp2-toggle with nested input[type="checkbox"]
  Save: button in .qc-cmp2-buttons container (labeled "Save & Exit" or
    "Confirm Choices")
  Notes: Quantcast uses mode="primary" and mode="secondary" attributes on buttons.
    The initial banner shows a summary; clicking preferences opens a detailed view
    with individual purpose toggles.

Platform 3: Cookiebot (Cybot)
  Container: div#CybotCookiebotDialog
  Accept button: a#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll or
    button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll
  Manage preferences: a.CybotCookiebotDialogBodyLevelButtonCustomize or
    button#CybotCookiebotDialogBodyLevelButtonCustomize (some sites label this
    "Customize")
  Reject all: a#CybotCookiebotDialogBodyButtonDecline or
    a#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll
    (NOTE: some Cookiebot implementations expose the decline button directly on
    the first screen -- check for it before clicking "Customize")
  Toggle switches: input.CybotCookiebotDialogBodyLevelButtonLevelOptinCheckbox
    (checkboxes for each cookie category: Preferences, Statistics, Marketing)
  Save: a#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection
    (labeled "Allow selection" -- saves only checked categories)
  Notes: Cookiebot uses <a> tags styled as buttons (not <button> elements).
    The "Necessary" checkbox is always checked and disabled.

Platform 4: TrustArc
  Container: div#truste_overlay or div#consent_blackbar
  Accept button: a#truste-consent-button or button.call
  Manage preferences: a#truste-show-consent or a.cookie-preferences (opens the
    TrustArc preference manager, sometimes in a new panel or iframe)
  Reject all: some TrustArc implementations have NO dedicated reject button.
    Instead, use "Required Only" radio button (input[value="0"]) in the preference
    manager to select the minimum cookies option.
  Toggle switches: input[name="purpose"] or input.toggle-checkbox
  Save: button.submit or a.close (labeled "Submit Preferences" or "Confirm")
  Notes: TrustArc preference manager may load in an iframe. The "Required Only"
    option is the closest equivalent to "Reject All" when no reject button exists.

Platform 5: Custom CMP / Generic Detection
  Container: div[role="dialog"][class*="cookie"], div[class*="consent-banner"],
    div[class*="consent"], div[class*="gdpr"], div[id*="cookie-banner"],
    div[id*="consent-banner"], div[id*="cookie-notice"]
  Accept button text: Accept, Agree, OK, Got it, Yes, I'm happy, Allow,
    Accepter, Akzeptieren, Accetta, Aceptar
  Manage preferences text: Manage, Settings, Preferences, Customize,
    More options, Cookie settings, Manage my cookies,
    Parametrer, Gerer mes choix, Einstellungen, Gestisci opzioni, Configurar
  Reject button text: Reject, Decline, Refuse, No thanks, Deny,
    Tout refuser, Refuser, Ablehnen, Rifiuta, Rifiuta tutto, Rechazar
  Save button text: Save, Confirm, Done, Apply,
    Enregistrer, Speichern, Salva, Guardar
  Notes: Generic detection is a fallback when no specific CMP platform is
    identified. Match button text by visible innerText content. Look for
    role="dialog" or aria-modal="true" as banner container indicators.

TARGET EU NEWS SITES:

Primary target: theguardian.com
  CMP: Sourcepoint (custom CMP, not OneTrust/Quantcast/Cookiebot)
  Banner: Appears on first visit as an overlay. The consent banner may load
    inside an iframe (iframe[id*="sp_message"] or iframe[title*="privacy"]).
    If inside an iframe, DOM interaction must target the iframe content.
  Accept button: button[title="Yes, I'm happy"] or button[title="Accept"]
    -- large, prominent, brightly colored
  Manage preferences: button[title="Manage my cookies"] or
    a[title="Manage cookies"] -- smaller, less prominent text link
  Hidden reject path: Click "Manage my cookies" to open preference panel.
    In the preference panel, look for:
    - button[title="Reject all"] or button.sp_choice_type_REJECT_ALL
    - If no "Reject all", toggle all cookie categories off and click
      button[title="Save and close"]
  Consent cookie: Records choice in euconsent-v2 or sp_consent cookies

Secondary target: lemonde.fr
  CMP: Didomi (French consent management platform)
  Banner: div#didomi-popup or div[class*="didomi"]
  Accept button: button#didomi-notice-agree-button (labeled "Accepter et
    continuer" -- Accept and continue)
  Manage preferences: button#didomi-notice-learn-more-button or
    a[class*="didomi-learn-more"] (labeled "Parametrer" or "Gerer mes choix")
  Hidden reject path: Click "Parametrer" to open preferences. Look for:
    - button#didomi-notice-disagree-button (labeled "Tout refuser" -- Reject all)
    - button.didomi-components-button--secondary for alternative reject path
  Consent cookie: Records choice in didomi_token or euconsent-v2

Fallback 1: spiegel.de
  CMP: Sourcepoint (similar to Guardian)
  Banner: div[class*="consent"] or div[class*="sp_veil"]
  Accept button: button[title="Akzeptieren und weiter"] or
    button.sp_choice_type_11 (labeled "Accept and continue" in German)
  Manage preferences: button[title="Einstellungen"] or
    button.sp_choice_type_12 (labeled "Settings" in German)
  Hidden reject path: Click "Einstellungen" to open preferences. Look for:
    - button[title="Ablehnen"] or button.sp_choice_type_REJECT_ALL
      (labeled "Reject" in German)
    - button[title="Speichern und weiter"] (labeled "Save and continue")
  Consent cookie: Records choice in sp_consent or euconsent-v2

Fallback 2: bbc.co.uk
  CMP: Custom BBC consent implementation
  Banner: Simple cookie banner on first visit for UK-specific pages
  Reject path varies: Some pages show "Reject optional cookies" directly on the
    banner, others require "Manage cookies" navigation to a settings page.
  Accept button: button containing "Yes, I agree" or "Accept additional cookies"
  Manage preferences: link containing "Manage cookies" or "Cookie preferences"
  Reject button: button containing "Reject optional cookies" or
    "No, take me to settings"

Fallback 3: repubblica.it
  CMP: iubenda or custom CMP
  Banner: Consent overlay on first visit
  Accept button: button containing "Accetta" (Accept) -- prominent, colored
  Manage preferences: button or link containing "Gestisci opzioni"
    (Manage options) or "Personalizza" (Customize)
  Hidden reject path: Open preferences, then look for "Rifiuta tutto"
    (Reject all) or toggle all categories off and save

MULTI-LANGUAGE BUTTON TEXT:
EU news sites use local languages for button labels. The AI must match button
text across multiple languages:

  Action     | English              | French                    | German              | Italian             | Spanish
  -----------|----------------------|---------------------------|---------------------|---------------------|--------------------
  Accept     | Accept, Agree, OK    | Accepter, J'accepte       | Akzeptieren, Zustimmen | Accetta, Accetto  | Aceptar, Acepto
  Reject     | Reject, Decline      | Refuser, Tout refuser     | Ablehnen            | Rifiuta, Rifiuta tutto | Rechazar
  Manage     | Manage, Settings     | Parametrer, Gerer mes choix | Einstellungen     | Gestisci opzioni   | Configurar, Ajustes
  Save       | Save, Confirm        | Enregistrer, Sauvegarder  | Speichern           | Salva, Conferma    | Guardar, Confirmar
  Necessary  | Strictly Necessary   | Strictement necessaire    | Unbedingt erforderlich | Strettamente necessari | Estrictamente necesarias

HIDDEN REJECT PATH STRATEGY:
The workflow uses a 3-tier approach to find the reject/opt-out option:

Tier 1: DIRECT REJECT (best case)
  Look for a "Reject All" or "Decline" button directly on the initial banner.
  Some CMP implementations (Cookiebot, newer Quantcast) expose a decline button
  on the first screen. Check for:
  - CMP-specific reject button selectors (see platform detection above)
  - Generic text matching: Reject, Decline, Refuse, Tout refuser, Ablehnen,
    Rifiuta, Rechazar, No thanks, Deny
  If found, click it and skip to verification (Step 8).

Tier 2: REJECT IN PREFERENCES (common case)
  If no direct reject button on the initial banner, click "Manage preferences" /
  "Cookie settings" to open the secondary panel. Then look for a "Reject All"
  button inside the preference center:
  - OneTrust: button with class containing "ot-pc-refuse-all-handler"
  - Quantcast: button[mode="secondary"] in the detail panel
  - Cookiebot: a#CybotCookiebotDialogBodyButtonDecline
  - Generic: button containing "Reject All", "Object to all", "Refuse all"
  If found, click it and skip to verification (Step 8).

Tier 3: TOGGLE AND SAVE (worst case -- full dark pattern)
  If no "Reject All" button exists even in the preference center, the site forces
  the user to manually toggle each cookie category off:
  1. Find all cookie category toggle switches (checkboxes or toggle buttons)
  2. For each toggle that is currently enabled (checked/on):
     - Check if it is a "Strictly Necessary" / "Essential" category -- SKIP these,
       they cannot and should not be disabled
     - Click the toggle to disable it (uncheck it)
  3. After all non-essential toggles are off, click "Save preferences" / "Confirm
     my choices" / "Save and close"
  This is the most labor-intensive path and the core of the DARK-02 dark pattern.

VERIFICATION:
After clicking reject/save, verify the opt-out was successful:

(a) Banner dismissed: Use read_page or get_dom_snapshot to confirm the consent
    banner container element is no longer visible (display:none, removed from
    DOM, or hidden). The page content should be accessible without an overlay.

(b) Page accessible: Verify the page content is visible and not blocked by a
    consent overlay. The URL should not have changed (some sites redirect after
    consent).

(c) Opt-out persistence: Reload the page and check if the consent banner appears
    again. If it reappears, the rejection was not properly saved. Check for
    consent cookies:
    - OneTrust: OptanonConsent cookie
    - Cookiebot: CookieConsent cookie
    - Quantcast: euconsent-v2 cookie
    - Didomi: didomi_token cookie
    - Generic: Look for cookies with "consent", "gdpr", or "cookie" in the name

IFRAME HANDLING:
Many cookie consent banners load inside iframes, especially Sourcepoint (used by
Guardian and Spiegel). If the banner is inside an iframe:
- Use get_dom_snapshot to detect iframe-based banners (iframe[id*="sp_message"],
  iframe[title*="privacy"], iframe[title*="consent"])
- DOM interaction must target the iframe content, not the parent page
- After iframe-based consent is resolved, the iframe is typically removed from
  the DOM entirely

NOTE ON DARK PATTERN DETECTION:
The defining characteristic of DARK-02 is that the "Accept All" button and the
"Reject" path have ASYMMETRIC effort:
- Accept: 1 click on a large, prominent, colored button
- Reject: 2-5 clicks through a hidden secondary panel with small text links
The AI must follow the reject path regardless of how many extra clicks it takes.`,

  selectors: {
    // OneTrust CMP selectors
    onetrust: {
      container: '#onetrust-consent-sdk, #onetrust-banner-sdk',
      acceptButton: '#onetrust-accept-btn-handler',
      manageButton: '#onetrust-pc-btn-handler, a.onetrust-pc-btn-handler',
      rejectButton: '.onetrust-close-btn-handler, button[class*="ot-pc-refuse-all-handler"]',
      toggleSwitches: 'input.onetrust-toggle, .ot-switch input[type="checkbox"]',
      saveButton: '.save-preference-btn-handler, .ot-pc-refuse-all-handler',
      preferenceCenter: '#onetrust-pc-sdk'
    },
    // Quantcast CMP2 selectors
    quantcast: {
      container: '#qc-cmp2-container, .qc-cmp2-main',
      acceptButton: 'button[mode="primary"], .qc-cmp2-summary-buttons button:first-child',
      manageButton: 'button[mode="secondary"], .qc-cmp2-summary-buttons button:last-child',
      rejectButton: 'button.qc-cmp2-buttons button[mode="secondary"]',
      toggleSwitches: '.qc-cmp2-toggle input[type="checkbox"]',
      saveButton: '.qc-cmp2-buttons button'
    },
    // Cookiebot (Cybot) selectors
    cookiebot: {
      container: '#CybotCookiebotDialog',
      acceptButton: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      manageButton: '.CybotCookiebotDialogBodyLevelButtonCustomize, #CybotCookiebotDialogBodyLevelButtonCustomize',
      rejectButton: '#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
      toggleSwitches: 'input.CybotCookiebotDialogBodyLevelButtonLevelOptinCheckbox',
      saveButton: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection'
    },
    // TrustArc selectors
    trustarc: {
      container: '#truste_overlay, #consent_blackbar',
      acceptButton: '#truste-consent-button',
      manageButton: '#truste-show-consent, a.cookie-preferences',
      rejectButton: 'input[value="0"]',
      saveButton: 'button.submit, a.close'
    },
    // Generic CMP selectors (fallback)
    generic: {
      container: 'div[role="dialog"][class*="cookie"], div[class*="consent-banner"], div[id*="cookie-banner"], div[class*="gdpr"]',
      acceptText: 'Accept|Agree|OK|Got it|Accepter|Akzeptieren|Accetta',
      manageText: 'Manage|Settings|Preferences|Customize|Parametrer|Einstellungen|Gestisci|More options|Cookie settings',
      rejectText: 'Reject|Decline|Refuse|Tout refuser|Ablehnen|Rifiuta|Rechazar',
      saveText: 'Save|Confirm|Enregistrer|Speichern|Salva|Guardar'
    },
    // Guardian-specific selectors
    theguardian: {
      consentBanner: 'div[class*="banner"], div[id*="sp_message"], iframe[id*="sp_message"]',
      acceptButton: 'button[title="Yes, I\'m happy"], button[title="Accept"]',
      manageButton: 'button[title="Manage my cookies"], a[title="Manage cookies"]',
      rejectButton: 'button[title="Reject all"], button.sp_choice_type_REJECT_ALL',
      saveButton: 'button[title="Save and close"]'
    },
    // Le Monde (Didomi) selectors
    lemonde: {
      consentBanner: 'div#didomi-popup, div[class*="didomi"]',
      acceptButton: 'button#didomi-notice-agree-button',
      manageButton: 'button#didomi-notice-learn-more-button, a[class*="didomi-learn-more"]',
      rejectButton: 'button#didomi-notice-disagree-button, button.didomi-components-button--secondary',
      saveButton: 'button.didomi-components-button'
    },
    // Spiegel (Sourcepoint) selectors
    spiegel: {
      consentBanner: 'div[class*="consent"], div[class*="sp_veil"]',
      acceptButton: 'button[title="Akzeptieren und weiter"], button.sp_choice_type_11',
      manageButton: 'button[title="Einstellungen"], button.sp_choice_type_12',
      rejectButton: 'button[title="Ablehnen"], button.sp_choice_type_REJECT_ALL',
      saveButton: 'button[title="Speichern und weiter"]'
    }
  },

  workflows: {
    rejectAllCookies: [
      {
        step: 1,
        name: 'NAVIGATE TO EU NEWS SITE',
        description: 'Navigate to the target EU news site (e.g., theguardian.com). Wait for the page to load and the cookie consent banner to appear. Most consent banners load within 1-3 seconds via JavaScript injection. Use navigate tool to go to the target URL.',
        tools: ['navigate'],
        expected: 'Page loads with cookie consent banner overlay visible'
      },
      {
        step: 2,
        name: 'DETECT COOKIE CONSENT BANNER',
        description: 'Use get_dom_snapshot to identify the cookie consent banner and determine which CMP platform is in use. Check in priority order: OneTrust (#onetrust-consent-sdk), Quantcast (#qc-cmp2-container), Cookiebot (#CybotCookiebotDialog), TrustArc (#truste_overlay), Guardian Sourcepoint (iframe[id*="sp_message"]), Didomi (#didomi-popup), then generic (div[role="dialog"] with cookie/consent/gdpr in class). Record which CMP platform was detected. If the banner is inside an iframe, note the iframe ID for targeted interaction.',
        tools: ['get_dom_snapshot', 'read_page'],
        expected: 'CMP platform identified, banner container element located'
      },
      {
        step: 3,
        name: 'CHECK FOR DIRECT REJECT BUTTON (Tier 1)',
        description: 'Before clicking "Manage preferences," check if the initial banner has a visible "Reject All" button directly available. Look for CMP-specific reject selectors and generic text matching: Reject, Decline, Refuse, Tout refuser, Ablehnen, Rifiuta, Rechazar. Use get_dom_snapshot or read_page to check button text. If a direct reject button is found, click it and skip to Step 8 (verification). If NOT found (the dark pattern is active), proceed to Step 4.',
        tools: ['get_dom_snapshot', 'click', 'read_page'],
        expected: 'Either: reject button found and clicked (skip to Step 8) OR no direct reject available (proceed to Step 4)'
      },
      {
        step: 4,
        name: 'CLICK MANAGE PREFERENCES BUTTON',
        description: 'The dark pattern hides the reject option behind "Manage preferences." Click the "Manage preferences" / "Cookie settings" / "Customize" button using CMP-specific selectors or generic text matching (Manage, Settings, Preferences, Parametrer, Einstellungen, Gestisci, Manage my cookies, Cookie settings). This opens the secondary preference panel. Wait 500ms-1s for the panel transition/animation to complete.',
        tools: ['click', 'get_dom_snapshot'],
        expected: 'Secondary preference panel opens with cookie category toggles and/or reject button'
      },
      {
        step: 5,
        name: 'DETECT PREFERENCE CENTER CONTENTS',
        description: 'Use get_dom_snapshot on the newly opened preference panel. Identify what is available: (a) a "Reject All" button in the preference center, (b) individual cookie category toggles/checkboxes, (c) a "Save" or "Confirm" button. Record which options exist -- this determines whether Tier 2 (reject in preferences) or Tier 3 (toggle-and-save) path is needed.',
        tools: ['get_dom_snapshot', 'read_page'],
        expected: 'Preference center contents mapped: reject button presence, toggle switches, save button'
      },
      {
        step: 6,
        name: 'CHECK FOR REJECT ALL IN PREFERENCES (Tier 2)',
        description: 'Look for a "Reject All" or "Object to all" button in the preference center panel. Use CMP-specific selectors: OneTrust (.ot-pc-refuse-all-handler), Quantcast (button[mode="secondary"] in detail panel), Cookiebot (#CybotCookiebotDialogBodyButtonDecline). Also check generic text: "Reject All", "Refuse all", "Object to all", "Tout refuser", "Ablehnen". If found, click it and skip to Step 8 (verification). If NOT found, proceed to Step 7 (Tier 3).',
        tools: ['get_dom_snapshot', 'click', 'read_page'],
        expected: 'Either: reject button found in preferences and clicked (skip to Step 8) OR no reject button exists (proceed to Step 7)'
      },
      {
        step: 7,
        name: 'TOGGLE ALL CATEGORIES OFF AND SAVE (Tier 3)',
        description: 'If no "Reject All" button exists in the preference center, find all cookie category toggle switches. For each toggle: (a) use get_attribute to check if it is currently enabled (checked attribute, aria-checked="true"), (b) if it is a "Strictly Necessary" or "Essential" category, SKIP it (these cannot be disabled and are required), (c) if it is enabled and non-essential, click it to disable (uncheck). After all non-essential toggles are off, click the "Save preferences" / "Confirm my choices" / "Save and close" button.',
        tools: ['get_dom_snapshot', 'get_attribute', 'click'],
        expected: 'All non-essential cookie categories toggled off, preferences saved'
      },
      {
        step: 8,
        name: 'VERIFY CONSENT BANNER DISMISSED',
        description: 'After clicking reject/save, verify: (a) use read_page to check that the consent banner container element is no longer visible (display:none, removed from DOM, or hidden), (b) the page content is accessible and not blocked by an overlay, (c) the page URL has not changed unexpectedly (some sites redirect after consent). If the banner is still visible, the reject action may not have registered -- retry.',
        tools: ['read_page', 'get_dom_snapshot'],
        expected: 'Consent banner dismissed, page content fully accessible'
      },
      {
        step: 9,
        name: 'VERIFY OPT-OUT EFFECTIVENESS',
        description: 'Additional verification: (a) reload the page using navigate to the same URL and check if the consent banner appears again (if it reappears, the rejection was not saved properly), (b) check for consent cookies that indicate rejection was recorded. Cookie names vary by CMP: OneTrust uses OptanonConsent, Cookiebot uses CookieConsent, Quantcast uses euconsent-v2, Didomi uses didomi_token. Use read_page to check if any consent banner elements exist after reload.',
        tools: ['navigate', 'read_page', 'get_dom_snapshot'],
        expected: 'Consent banner does not reappear on reload, opt-out persisted'
      },
      {
        step: 10,
        name: 'REPORT',
        description: 'State final outcome: which CMP platform was detected (OneTrust, Quantcast, Cookiebot, TrustArc, Sourcepoint, Didomi, custom), which tier was needed (Tier 1: direct reject, Tier 2: reject in preferences, Tier 3: toggle-and-save), how many cookie categories were toggled off (if Tier 3), whether the consent banner was successfully dismissed, and whether the opt-out persisted on reload.',
        tools: ['read_page'],
        expected: 'Complete report of CMP platform, rejection tier used, and verification results'
      }
    ]
  },

  warnings: [
    'DARK-02: NEVER click "Accept All" / "Yes, I am happy" / "Agree" -- this is the exact dark pattern trap. Always look for "Manage preferences" or "Reject" first.',
    'Many cookie consent banners load inside iframes (especially Sourcepoint/Guardian). If the banner is inside an iframe, DOM interaction must target the iframe content. Use get_dom_snapshot to detect iframe-based banners.',
    'The "Reject All" button may not exist on the initial banner -- this IS the dark pattern. Click "Manage preferences" to access the secondary panel where reject/decline options are available.',
    'Some CMP preference panels pre-check all cookie categories to ON by default. You MUST uncheck each non-essential category individually if no "Reject All" button exists. Essential/Strictly Necessary cookies cannot and should not be unchecked.',
    'EU news sites use local language buttons. Match button text in multiple languages: English (Reject), French (Refuser/Tout refuser), German (Ablehnen), Italian (Rifiuta), Spanish (Rechazar).'
  ],

  toolPreferences: ['navigate', 'click', 'read_page', 'get_dom_snapshot', 'get_attribute']
});
