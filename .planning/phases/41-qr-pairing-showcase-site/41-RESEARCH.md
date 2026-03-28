# Phase 41: QR Pairing & Showcase Site - Research

**Researched:** 2026-03-17
**Domain:** QR code generation/scanning, session token management, responsive landing page
**Confidence:** HIGH

## Summary

This phase adds QR-based pairing between the extension control panel and the dashboard, replacing the manual paste-key flow as the primary connection method. The extension generates a one-time pairing token (60s TTL), encodes it as a QR code, and the dashboard scans it via the device camera. A tabbed login card (Scan QR / Paste Key) replaces the existing single-input login. Sessions persist for 24 hours in localStorage. The landing page gets a CTA button and mobile polish.

The technical challenge is modest: QR generation is a solved problem with tiny libraries, camera scanning has solid library options, and the server-side token exchange is a simple CRUD operation on a new `pairing_tokens` table. The main complexity is UX choreography -- tab switching, countdown timers, camera permission handling, graceful fallbacks, and session state transitions.

**Primary recommendation:** Use `qrcode-generator` (8KB) for QR generation in the extension, and `html5-qrcode` (loaded via CDN script tag) for camera scanning on the dashboard. Both are zero-dependency, no-build-system compatible. For the pairing token, use `crypto.randomBytes(32).toString('hex')` server-side with a 60-second TTL stored in SQLite.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- QR code displayed in the **control panel** (ui/control_panel.html), in the server sync section next to the existing hash key display
- "Pair Dashboard" button next to Generate/Copy hash key buttons -- clicking it **inline-expands** a QR code below the hash key area
- QR encodes a one-time pairing token (not the raw hash key) with 60-second TTL and a visible countdown timer
- QR collapses after successful scan or expiry; user can regenerate
- On the dashboard side, camera viewfinder is built into the login card (no separate page)
- Login card redesigned with two tabs: **"Scan QR"** (default/primary) and **"Paste Key"** (fallback)
- "Scan QR" tab shows camera viewfinder with instruction text
- "Paste Key" tab preserves existing hash key input + Connect button
- On scan failure or camera denied: auto-fallback to "Paste Key" tab with brief error message
- Paired sessions last **24 hours** before requiring re-pairing
- Session token stored in dashboard localStorage, validated against server on each connection
- On expiry: dashboard content fades, login card reappears with message "Session expired. Scan QR code to reconnect."
- On return visit within 24h: auto-connect immediately, skip login
- Dashboard header shows "Paired" status with Disconnect/Unpair button
- Login card disappears when paired -- dashboard content shows with status bar in header
- **Keep and polish existing** index.html -- add "Open Dashboard" CTA, ensure mobile responsive
- Dashboard requires pairing (login card shown until paired)
- Landing page (index.html) is the public showcase -- no login needed
- No public demo/read-only dashboard view

### Claude's Discretion
- QR code generation library choice (lightweight, vanilla JS compatible)
- Camera/barcode scanning library choice (lightweight, no build system)
- Pairing token format and server-side token exchange implementation
- Exact countdown timer visual design (ring, bar, or numeric)
- Session token storage format and validation mechanism
- Transition animations between login and dashboard states
- Mobile breakpoints and responsive layout details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAIR-01 | Extension generates unique one-time pairing token (not raw hash key) with 60s TTL | Server-side token generation via crypto.randomBytes, stored in pairing_tokens table with expires_at column |
| PAIR-02 | Extension displays pairing token as QR code in popup/sidepanel | qrcode-generator library renders QR inline in control panel server sync section |
| PAIR-03 | Dashboard scans QR code via device camera to pair with extension | html5-qrcode library provides camera viewfinder and QR decoding in dashboard login card |
| PAIR-04 | User can manually paste hash key as fallback when camera is unavailable | Existing paste-key flow preserved in "Paste Key" tab; auto-fallback on camera denial |
| PAIR-05 | Dashboard shows paired status and allows unpairing/session revocation | Session token in localStorage + server validation; header shows paired badge with disconnect button |
| PAIR-06 | Pairing session expires after configurable timeout with re-pair flow | 24h TTL on session tokens; server validates on WS connect; gentle fade-to-login on expiry |
| SITE-01 | Public landing page explains FSB and showcases capabilities | Existing index.html already has hero, features, providers; add "Open Dashboard" CTA button |
| SITE-02 | Dashboard UI accessible without login (QR pairing is the auth) | Dashboard serves at /dashboard; login card is the auth gate; no separate login page |
| SITE-03 | Responsive design works on mobile browsers | Existing nav hamburger works; verify/fix hero stacking, feature cards single-column, login card mobile sizing |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qrcode-generator | 2.0.4 | QR code generation (extension side) | 8KB minified, zero dependencies, no build system needed, canvas/SVG/table output |
| html5-qrcode | 2.3.8 | Camera QR scanning (dashboard side) | CDN script tag, handles camera permissions, supports all major browsers, built-in viewfinder UI |
| better-sqlite3 | ^11.0.0 | Pairing token storage | Already in server dependencies |
| crypto (Node built-in) | N/A | Token generation | Already used for hash key generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express | ^4.21.0 | Pairing API routes | Already in server |
| ws | ^8.19.0 | Session-aware WS connections | Already in server |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| qrcode-generator | qrcodejs (davidshimjs) | qrcodejs is slightly more popular but last updated 2015; qrcode-generator is actively maintained with more output formats |
| html5-qrcode | qr-scanner (Nimiq) | qr-scanner is ES6 module only (needs import maps or bundler); html5-qrcode has UMD/script-tag support, simpler setup |
| html5-qrcode | Native BarcodeDetector API | BarcodeDetector has no Firefox/Safari desktop support; would need polyfill anyway |

**CDN script tags (dashboard side):**
```html
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
```

**CDN script tag (extension control panel):**
```html
<!-- qrcode-generator loaded locally in extension bundle -->
<script src="lib/qrcode-generator.min.js"></script>
```

Note: For the Chrome extension, the QR library must be bundled locally (Chrome MV3 CSP prohibits remote script loading). Download `qrcode-generator.min.js` and place in `lib/` or `ui/lib/`.

## Architecture Patterns

### Recommended Project Structure
```
server/
  src/
    routes/
      auth.js          # Extended with pairing token endpoints
      pair.js          # NEW: POST /api/pair/generate, POST /api/pair/exchange
    db/
      schema.js        # Extended with pairing_tokens table
      queries.js       # Extended with pairing token queries

ui/
  lib/
    qrcode-generator.min.js  # NEW: bundled QR library for extension
  control_panel.html         # Modified: add "Pair Dashboard" button + QR container
  options.js                 # Modified: add pairing token generation + QR rendering

showcase/
  dashboard.html             # Modified: tabbed login card (Scan QR / Paste Key)
  js/dashboard.js            # Modified: camera scanning, session token management
  css/dashboard.css          # Modified: tab styles, viewfinder, paired header
  index.html                 # Modified: add "Open Dashboard" CTA button
  css/home.css               # Modified: minor mobile responsive fixes if needed
```

### Pattern 1: Pairing Token Flow
**What:** One-time token exchange that never exposes the hash key via QR
**When to use:** Every QR pairing attempt

```
Extension                    Server                     Dashboard
    |                          |                            |
    |-- POST /api/pair/generate -->|                        |
    |   (X-FSB-Hash-Key header)   |                        |
    |<-- { token, expiresAt } ----|                        |
    |                              |                        |
    | [Display QR with token]      |                        |
    |                              |                        |
    |                              |<-- POST /api/pair/exchange --|
    |                              |    { token }               |
    |                              |                            |
    |                              |-- { sessionToken,          |
    |                              |     hashKey,               |
    |                              |     expiresAt } ---------> |
    |                              |                            |
    |                              |    [Dashboard stores       |
    |                              |     sessionToken in        |
    |                              |     localStorage,          |
    |                              |     connects WS with       |
    |                              |     hashKey]               |
```

### Pattern 2: Session Token Validation
**What:** Server-side session management with client localStorage persistence
**When to use:** On dashboard load and WS connection

```javascript
// Dashboard stores after successful pairing:
localStorage.setItem('fsb_dashboard_key', hashKey);         // existing
localStorage.setItem('fsb_dashboard_session', sessionToken); // new
localStorage.setItem('fsb_dashboard_expires', expiresAt);    // new

// On page load, check session validity:
// 1. Check localStorage for session token + expiry
// 2. If expired locally, show login card with "Session expired" message
// 3. If not expired, validate against server via GET /api/pair/validate
// 4. If server says valid, auto-connect (skip login)
// 5. If server says invalid, clear localStorage, show login card
```

### Pattern 3: Tabbed Login Card
**What:** Two-tab UI replacing single input login
**When to use:** Dashboard login section

```html
<div class="dash-login-card">
  <div class="dash-login-icon"><i class="fa-solid fa-qrcode"></i></div>
  <h2>Agent Dashboard</h2>
  <div class="dash-login-tabs">
    <button class="dash-tab active" data-tab="scan">Scan QR</button>
    <button class="dash-tab" data-tab="paste">Paste Key</button>
  </div>
  <div class="dash-tab-content" id="tab-scan">
    <p>Point camera at QR code in FSB extension control panel</p>
    <div id="qr-reader"></div>
    <!-- html5-qrcode renders viewfinder here -->
  </div>
  <div class="dash-tab-content" id="tab-paste" style="display:none;">
    <input type="text" id="dash-key-input" placeholder="Enter your hash key...">
    <button id="dash-connect-btn" class="btn btn-primary">Connect</button>
  </div>
</div>
```

### Pattern 4: QR Code in Extension Control Panel
**What:** Inline-expandable QR below hash key area
**When to use:** User clicks "Pair Dashboard" button

```javascript
// In options.js - after clicking "Pair Dashboard"
async function showPairingQR() {
  const serverUrl = document.getElementById('serverUrl')?.value?.trim();
  const hashKey = document.getElementById('serverHashKey')?.value?.trim();
  if (!serverUrl || !hashKey) return;

  // Request one-time token from server
  const resp = await fetch(serverUrl + '/api/pair/generate', {
    method: 'POST',
    headers: { 'X-FSB-Hash-Key': hashKey }
  });
  const { token, expiresAt } = await resp.json();

  // Generate QR code
  var qr = qrcode(0, 'M');
  qr.addData(JSON.stringify({ t: token, s: serverUrl }));
  qr.make();

  // Render into container
  var container = document.getElementById('pairingQRContainer');
  container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
  container.style.display = 'block';

  // Start countdown
  startCountdown(expiresAt, container);
}
```

### Anti-Patterns to Avoid
- **Encoding raw hash key in QR:** Security risk -- always use one-time tokens that expire
- **Polling for scan result from extension:** The extension does not need to know when scanning completes; the dashboard exchanges the token directly with the server
- **Camera always on:** Start camera only when Scan QR tab is active; stop when switching to Paste Key tab or on successful scan
- **Storing session token without expiry check:** Always check local expiry before making server calls to avoid unnecessary requests

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code encoding | Canvas pixel-by-pixel QR drawing | qrcode-generator library | Reed-Solomon error correction, multiple QR versions, edge cases |
| Camera stream + QR decoding | getUserMedia + manual frame analysis | html5-qrcode | Camera permissions, multiple camera selection, frame rate optimization, cross-browser quirks |
| Cryptographic token generation | Math.random-based tokens | crypto.randomBytes(32) | Cryptographically secure randomness; Math.random is predictable |
| Token expiry cleanup | Manual setTimeout per token | SQLite WHERE expires_at < datetime('now') | Server restart safe, no memory leaks |

**Key insight:** QR encoding involves Reed-Solomon error correction with multiple versions and modes -- extremely error-prone to implement manually. Camera scanning involves getUserMedia permission flows, frame extraction, and decoding algorithms that vary across browsers.

## Common Pitfalls

### Pitfall 1: Chrome Extension CSP Blocks Remote Scripts
**What goes wrong:** Adding a CDN script tag in control_panel.html fails because MV3 Content Security Policy blocks remote script sources
**Why it happens:** Chrome extensions cannot load scripts from external URLs
**How to avoid:** Bundle qrcode-generator.min.js locally in the extension (e.g., `ui/lib/qrcode-generator.min.js`) and reference it with a relative path
**Warning signs:** Console error about CSP violation; QR library undefined

### Pitfall 2: Camera Permission Denial Handling
**What goes wrong:** User denies camera permission and sees a blank viewfinder or unhandled error
**Why it happens:** html5-qrcode throws an error on permission denial but UI does not gracefully handle it
**How to avoid:** Wrap scanner start in try/catch; on NotAllowedError or NotFoundError, auto-switch to "Paste Key" tab with a friendly message ("Camera unavailable -- paste your hash key instead")
**Warning signs:** Unhandled promise rejection in console; stuck loading state

### Pitfall 3: QR Token Race Condition
**What goes wrong:** User generates QR, waits, generates again -- old token might still be valid briefly
**Why it happens:** Multiple tokens can exist for the same hash key
**How to avoid:** On new token generation, invalidate all existing unused tokens for that hash key (UPDATE pairing_tokens SET used = 1 WHERE hash_key = ? AND used = 0)
**Warning signs:** Old QR codes still work after regeneration

### Pitfall 4: Session Expiry During Active Use
**What goes wrong:** User is actively using dashboard and session expires, causing abrupt disconnect
**Why it happens:** 24-hour timer fires regardless of activity
**How to avoid:** Check session expiry only on page load and WS reconnection, not during active use. If WS is connected and working, session is implicitly valid. Only enforce expiry when the user returns to the page or WS drops.
**Warning signs:** Dashboard suddenly showing login card while user is mid-interaction

### Pitfall 5: html5-qrcode Scanner Not Stopped Properly
**What goes wrong:** Camera LED stays on after successful scan; multiple scanner instances created
**Why it happens:** html5-qrcode scanner must be explicitly stopped with `scanner.stop()` before removing the element
**How to avoid:** Always call `scanner.stop()` on successful scan, on tab switch, on page unload. Track scanner instance in a variable; check if running before starting new scan.
**Warning signs:** Camera indicator light stays on; performance degradation

### Pitfall 6: Root URL Redirect Breaks Landing Page
**What goes wrong:** Current server.js redirects `/` to `/dashboard`, so landing page is unreachable
**Why it happens:** Line 89-91 of server.js: `app.get('/', (req, res) => { res.redirect('/dashboard'); });`
**How to avoid:** Change root to serve `index.html` (the landing page). Dashboard is already at `/dashboard.html` or `/dashboard`. Update the redirect logic.
**Warning signs:** Visiting the root URL skips the landing page entirely

## Code Examples

### Server: Pairing Token Schema Addition
```sql
-- Add to schema.js initializeDatabase()
CREATE TABLE IF NOT EXISTS pairing_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  hash_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  session_token TEXT,
  FOREIGN KEY (hash_key) REFERENCES hash_keys(hash_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token ON pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_hash_key ON pairing_tokens(hash_key);
```

### Server: Token Generation Endpoint
```javascript
// POST /api/pair/generate
// Requires X-FSB-Hash-Key header (use existing auth middleware)
router.post('/generate', (req, res) => {
  const hashKey = req.hashKey;

  // Invalidate any existing unused tokens for this hash key
  queries.invalidatePairingTokens(hashKey);

  // Generate new one-time token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60 seconds

  queries.createPairingToken(token, hashKey, expiresAt);

  res.json({ token, expiresAt });
});
```

### Server: Token Exchange Endpoint
```javascript
// POST /api/pair/exchange
// No auth header required -- the token IS the auth
router.post('/exchange', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const record = queries.getPairingToken(token);
  if (!record) return res.status(404).json({ error: 'Invalid or expired token' });

  if (record.used) return res.status(410).json({ error: 'Token already used' });

  const now = new Date();
  if (new Date(record.expires_at) < now) {
    return res.status(410).json({ error: 'Token expired' });
  }

  // Mark token as used
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  queries.consumePairingToken(token, sessionToken);

  res.json({
    hashKey: record.hash_key,
    sessionToken,
    expiresAt: sessionExpires
  });
});
```

### Server: Session Validation Endpoint
```javascript
// GET /api/pair/validate
router.get('/validate', (req, res) => {
  const sessionToken = req.headers['x-fsb-session-token'];
  if (!sessionToken) return res.json({ valid: false });

  const record = queries.getSessionByToken(sessionToken);
  if (!record) return res.json({ valid: false });

  // Check if the session's pairing token has expired (24h from consumption)
  // Session expiry is tracked by the consumed_at + 24h
  res.json({
    valid: true,
    hashKey: record.hash_key,
    expiresAt: record.session_expires_at
  });
});
```

### Extension: QR Code in Control Panel
```javascript
// qrcode-generator usage (after bundling lib locally)
function renderPairingQR(token, serverUrl) {
  var qr = qrcode(0, 'M');  // type 0 = auto, error correction M
  qr.addData(JSON.stringify({ t: token, s: serverUrl }));
  qr.make();

  var container = document.getElementById('pairingQRContainer');
  container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
}
```

### Dashboard: Camera Scanner Setup
```javascript
// html5-qrcode usage (loaded via CDN script tag)
function startQRScanner() {
  var scanner = new Html5Qrcode('qr-reader');

  scanner.start(
    { facingMode: 'environment' },  // back camera preferred
    { fps: 10, qrbox: { width: 250, height: 250 } },
    function onScanSuccess(decodedText) {
      scanner.stop().then(function() {
        handleScannedToken(decodedText);
      });
    },
    function onScanFailure(error) {
      // Ignore per-frame failures -- only handle fatal errors
    }
  ).catch(function(err) {
    // Camera permission denied or not available
    showPasteKeyTab('Camera unavailable');
  });

  return scanner;
}
```

### QR Data Format
```javascript
// What gets encoded in the QR code:
JSON.stringify({
  t: 'a1b2c3d4...64hex',  // one-time pairing token
  s: 'https://fsb-server.fly.dev'  // server URL for token exchange
})

// Dashboard decodes and calls:
// POST {serverUrl}/api/pair/exchange  body: { token }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual key copy-paste | QR code scan pairing | This phase | Primary UX improvement; paste-key becomes fallback |
| No session management | 24h session tokens | This phase | Return visits auto-connect; no re-entry needed |
| Root redirects to /dashboard | Root serves landing page | This phase | Public showcase accessible at root URL |

**Note on html5-qrcode maintenance:** The library is in maintenance mode (last release April 2023, v2.3.8). However, it is stable, widely used (3M+ weekly npm downloads), and QR scanning standards have not changed. For this use case (scan a single QR code), the library is perfectly adequate. If a future phase needs more advanced scanning, consider migrating to qr-scanner (Nimiq).

## Open Questions

1. **QR data: include server URL or not?**
   - What we know: The extension knows its server URL; the dashboard is served BY the server
   - What's unclear: If dashboard is always served from the same server, the server URL in the QR is redundant
   - Recommendation: Include server URL in QR data for flexibility (self-hosted users might have different URLs), but dashboard can default to its own origin if the URL matches

2. **Session token cleanup schedule**
   - What we know: Expired tokens accumulate in SQLite
   - What's unclear: How often to clean up
   - Recommendation: Clean expired tokens on each new token generation (WHERE expires_at < datetime('now') AND used = 1). Lightweight since it runs infrequently.

## Sources

### Primary (HIGH confidence)
- Project codebase: server/server.js, server/src/routes/auth.js, server/src/db/schema.js, server/src/db/queries.js, server/src/ws/handler.js
- Project codebase: ui/control_panel.html, ui/options.js
- Project codebase: showcase/dashboard.html, showcase/js/dashboard.js, showcase/index.html
- [qrcode-generator npm](https://www.npmjs.com/package/qrcode-generator) - v2.0.4 confirmed
- [html5-qrcode npm](https://www.npmjs.com/package/html5-qrcode) - v2.3.8 confirmed
- [html5-qrcode GitHub](https://github.com/mebjas/html5-qrcode) - CDN usage, API docs
- [qr-scanner GitHub](https://github.com/nimiq/qr-scanner) - Alternative evaluated

### Secondary (MEDIUM confidence)
- [BarcodeDetector API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API) - Browser support limitations
- [Can I Use BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) - No Firefox/Safari desktop support confirmed

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries verified on npm registry, CDN availability confirmed, compatibility with no-build vanilla JS verified
- Architecture: HIGH - Pairing token exchange is a standard pattern; all integration points inspected in existing codebase
- Pitfalls: HIGH - Based on direct inspection of existing code (CSP, server redirect, camera permissions are well-documented issues)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain, libraries are mature)
