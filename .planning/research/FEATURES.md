# Feature Research

**Domain:** Chrome MV3 extension dev/automation tool — Sync surface, agent sunset, DOM streaming reliability
**Researched:** 2026-04-28
**Milestone:** v0.9.45rc1
**Confidence:** MEDIUM-HIGH (current FSB code: HIGH; comparable-product UX patterns: MEDIUM, derived from GitHub session mgmt, 2FAS browser pairing, Chrome Remote Desktop, rrweb, websockets/permessage-deflate)

## Scope Reminder

Five concrete feature areas in scope:
1. **Sync tab** — new top-level control panel tab consolidating QR pairing + remote-control state (currently buried as "Server Sync" inside the Background Agents tab at `ui/control_panel.html` line 700; QR pairing logic at `ui/options.js` lines 4198-4943).
2. **Background agents sunset card** — playful deprecation messaging in control panel + showcase, pointing to OpenClaw / Claude Routines.
3. **DOM streaming hardening** — mutation queue watchdog, large-DOM truncation perf, stale counter reset.
4. **WebSocket compression symmetry** — inbound `permessage-deflate` decompression to match outbound.
5. **Diagnostic logging** — replace silent `try/catch{}` swallowers in dialog relay + message delivery.

Not in scope: rebuilding pairing protocol, reinventing dashboard, building a new agents framework.

## Feature Landscape

### Table Stakes (Comparable Products All Have These)

| Feature | Why Expected | Complexity | Notes / FSB Dependency |
|---------|--------------|------------|------------------------|
| **Sync tab is top-level** (not nested under another concern) | Every "connected devices" pattern (GitHub Sessions, 2FAS, Chrome Remote Desktop) puts pairing/devices at the same nav depth as "Account" or "Settings". FSB currently buries pairing under Agents — wrong taxonomy. | LOW | Pure HTML/CSS — add `<li class="nav-item" data-section="sync">` and a `<section id="sync">` block. Move the existing card from `#background-agents` to `#sync`. **Depends on:** existing `nav-item` switching logic in `options.js`. |
| **Live connection status indicator** ("Connected" / "Disconnected" / "Reconnecting" with color dot) | Users need a single glanceable answer to "is the tunnel up?" GitHub mobile sessions, 2FAS, Chrome Remote Desktop all have this. The current `#connectionStatus` span is a passive text label updated only after pressing "Test Connection". | LOW-MEDIUM | Wire to `ext:remote-control-state` broadcast from Phase 209. **Depends on:** Phase 209 lifecycle broadcast (already shipped). Test by toggling network, observing dot turn red within ~5s. |
| **QR code is the primary pairing affordance, manual code is the fallback** | Industry consensus: QR for phone-camera proximity, alphanumeric code for typing/copy-paste. 2FAS, Chrome Remote Desktop, WhatsApp Web, Discord QR login all do this. | LOW | The current QR flow already exists (Phase 210). **Add:** display the same `pairingToken` underneath the QR as `XXXX-XXXX-XXXX` for manual entry on the dashboard. **Depends on:** server `/api/pair/generate` already returns the token; just render it. |
| **Last-paired timestamp + "paired as" identifier** | GitHub: "Last accessed 2 hours ago from Chrome on macOS". Users won't trust pairing they can't audit. | LOW-MEDIUM | Persist `lastPairedAt` + a UA string in `chrome.storage.local` when handshake succeeds. Render under the connection status. **Depends on:** existing handshake event (look up where the dashboard send first ACK). |
| **Manual reconnect button** | When connection drops, users want a button — not "wait 30 seconds for auto-retry". GitHub Codespaces, Chrome Remote Desktop, every IDE remote-host integration has this. | LOW | Wraps existing reconnect logic. Show only when status is `disconnected` or `reconnecting`. |
| **Test Connection (already exists)** | A diagnostic-style "ping" affordance is table stakes for any pairing UI. | (DONE) | Already wired (`#btnTestConnection`). Move it into the Sync tab. |
| **Hash Key Generate / Copy (already exists)** | Pre-pairing setup affordance. | (DONE) | Already wired (`#serverHashKey`, `#btnGenerateHashKey`, `#btnCopyHashKey`). Move into Sync tab. |
| **Deprecation card with date, alternatives, link out** | Standard sunset pattern. Microsoft/Google deprecations always state: (1) effective date, (2) named replacement, (3) "learn more" link. | LOW | Plain HTML card. **Depends on:** nothing — pure copy work. |
| **Inbound WebSocket decompression** matching outbound `permessage-deflate` | RFC 7692 spec: if a peer sends compressed frames, the receiver MUST decompress. Asymmetry = invisibly broken / dropped messages. Not a feature users see; it's table-stakes correctness. | MEDIUM | Find the `WebSocket` constructor in the bridge code; ensure handshake includes `permessage-deflate` extension on both sides; if FSB controls the relay, ensure relay->extension frames are decompressed by browser automatically (browser handles it if the extension was negotiated in handshake). Real fix is likely in the relay/server side asserting the extension. **Test:** observable as restored message delivery for large payloads (>1KB DOM snapshots); verifiable via Chrome DevTools Network → WS frames showing `Compressed: true`. |
| **Diagnostic console.warn with structured prefix** when a relay/dialog message fails to deliver | Replace `try { ... } catch (_) {}` with `try { ... } catch (err) { console.warn('[FSB][dialog-relay] delivery failed', { err, target, msg }); }`. Industry baseline for any production extension; required for debugging operator-reported "I clicked send and nothing happened". | LOW | Pure refactor. **Test:** synthetic failure (close target tab mid-send) produces a single, greppable warn line in the service worker console. |
| **DOM mutation queue watchdog** that detects "stuck queue" and emits one diagnostic event | rrweb / Replay.io users repeatedly hit the symptom: queue keeps growing, page hangs, no signal. Watchdog = "if queue depth has not decreased for N seconds and queue depth > threshold, emit `stream:stuck` once and reset". | MEDIUM | Add a counter on every flush; tick a timer; compare. **Test:** force-feed 10k mutations in a synthetic page; observe one diagnostic event, no thrash. **Depends on:** existing mutation observer in `content/` modules. |
| **Stale mutation counter reset on stream lifecycle transitions** | When the stream restarts (tab switch, reconnect), counters from the old session must NOT carry over and trigger a false "stuck" alarm. Standard hygiene for any long-running event source. | LOW | Reset hook on `streamStart` / `streamEnd` events. |

### Differentiators (FSB-Specific Notable Features)

| Feature | Value Proposition | Complexity | Notes / FSB Dependency |
|---------|-------------------|------------|------------------------|
| **Sync tab as the only place where remote-control lives** | FSB's promise is "your dashboard sees your browser live". Today that promise is split across Server Sync (under Agents) and remote control state messaging that has no UI home. Putting both in one tab = one mental model: "my browser <-> dashboard tunnel". | LOW | Reorganization, not new code. **Wins:** users stop asking "where do I pair?" — there's literally a tab labeled Sync. |
| **Live remote-control state pill** ("Idle" / "Active — clicking" / "Active — typing") inline in the Sync tab | Phase 209 already broadcasts `ext:remote-control-state`. Surfacing it in the Sync tab gives users confidence that "yes, what the dashboard does shows up here". No comparable extension does this — most stop at "connected/disconnected". | MEDIUM | Subscribe to `ext:remote-control-state` broadcast; render as a chip. **Depends on:** Phase 209 broadcast (shipped). **Anti-trap:** do NOT echo every CDP event — debounce to avoid flicker. |
| **Playful deprecation card with three rotating taglines** (random pick on render) | Most sunset notices are dry. FSB's brand voice is technical-but-friendly ("orange glow", "single-attempt reliability"). A randomly-picked tagline from a 3-item array makes the page feel alive, not abandoned. Differentiator vs Microsoft/Google sunset notices which feel like compliance text. | LOW | `const taglines = [...]; element.textContent = taglines[Math.floor(Math.random() * taglines.length)];`. See microcopy section below. |
| **Mirrored sunset messaging on the showcase/dashboard** (not just inside extension) | Users discovering FSB via the showcase shouldn't expect "background agents" only to learn after install they're gone. Mirroring on showcase = consistent brand promise. | LOW | Edit `showcase/angular/src/app/pages/{home,about,dashboard}` content blocks. **Depends on:** existing Angular shell (shipped v0.9.29). |
| **Stream health card in Sync tab** ("Mutations/s, queue depth, last flush") | rrweb users reverse-engineer this from network panels. Surfacing it inline is a meaningful trust signal for power users. | MEDIUM | Read from the new watchdog counters. Optional / can ship without. |
| **One-click "Unpair" / "Sign out of dashboard"** that revokes the hash key | GitHub session revocation is the gold standard. Today FSB has no way to forcibly disconnect short of regenerating the hash key. | LOW-MEDIUM | Calls `/api/pair/revoke` (may not exist server-side) or just clears local hash key + closes the WS. **Depends on:** server endpoint, OR pure-local fallback that clears state. |

### Anti-Features (Tempting But Wrong)

| Feature | Why Tempted | Why Wrong | Better Approach |
|---------|-------------|-----------|-----------------|
| **Auto-redirect away from "Background Agents" tab to a sunset URL** | Feels clean — "the page is gone". | Users have muscle memory + bookmarks. Hard 404 / redirect = loss of trust. Microsoft/Google all leave the deprecated nav entry visible with a sunset banner for 1+ release cycle. | Keep the tab in the sidebar; replace its body with the sunset card. Optionally rename to "Agents (Retired)" or hide after 1-2 milestones. |
| **Hide pairing UI behind "Advanced"** | Remote control feels like a power-user feature. | The new dashboard surface IS the headline UX. Burying it makes onboarding worse. Currently it's already buried under Agents — that's the bug. | Sync is a top-level nav item. Period. |
| **Force the user to scroll past a giant deprecation banner to reach the dashboard/sync UI** | "They need to know background agents are gone!" | Banner-blindness; feels naggy; blocks legitimate workflow. The current "blocked dashboard" failure mode (per the question) is a real anti-pattern. | Sunset card lives in its own tab body. Sync tab is independent. Dashboard surface is independent. No blocking modals. |
| **Show frame-stat overlays whenever inbound compression activates** | "It's a fix, let's celebrate it visibly!" | Compression should be invisible. Users don't care; they care that messages arrive. Adding a "compression: ON" indicator just adds clutter. | Decompression fix is silent. Optional: log once at handshake `console.info('[FSB][ws] permessage-deflate negotiated, both directions')`. |
| **Block UI interaction while reconnecting** ("Connecting..." spinner over everything) | Looks clean. | Users want to keep configuring while reconnect happens in background. GitHub, Slack, every modern client reconnects without freezing UI. | Status pill changes; rest of UI stays interactive. |
| **A "Disable Watchdog" toggle in Advanced settings** | Feels like good defensive engineering. | Watchdog is correctness, not a feature. Toggle = footgun. | Watchdog is always on. Threshold can be a constant. |
| **Toast notification every time the watchdog catches a stuck queue** | "User should know!" | Users don't have actionable response. Toast spam = ignored toast. | Single `console.warn` (diagnostic logging requirement covers this). Optional: a "stream health" pill in Sync tab. |
| **A fancy "What changed?" modal for the deprecation that requires a click to dismiss before using FSB** | Common in enterprise migration UX. | Friction tax on every install. Once-only modals are notorious for showing twice (storage bug) or never (storage missing). | Static card on the (former) Agents tab. No modal. No "I understand" button. |
| **Remove the deleted-code commits / wipe history** | "Clean codebase!" | Loses the receipt of what was tried; makes future revival harder if priorities shift. PROJECT.md explicitly mandates **comment out, don't delete** with deprecation annotation. | Comment out with `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines — see milestone notes` and preserve shared utilities. |
| **Rewriting the pairing protocol** | "Since we're touching this UI, let's improve the protocol." | Out of scope. Phase 210 is shipped + working. UI relocation only. | Strictly relocate + polish. |

## Deprecation Card Microcopy (3+ Tone-of-Voice Samples)

Required by the quality gate. All samples follow the canonical beats: **dated "as of"** + **named alternatives** + **link out** + **optional "why" disclosure** + **no nag**.

### Sample 1 — Dry & Direct (safest default)

> **Background Agents are retired as of v0.9.45rc1 (April 2026).**
>
> FSB's core value is reliable single-attempt browser execution. Scheduled background work is a different problem — and it's better solved by tools designed for it.
>
> We recommend:
> - **[OpenClaw](https://openclaw.example)** — for general-purpose AI-driven background workflows
> - **[Claude Routines](https://claude.com/routines)** — for Anthropic-native scheduled tasks
>
> Existing agent code is preserved (commented out) for future revival if priorities shift. [Read the full retirement note →]

### Sample 2 — Witty / Brand-Voice ("we're not reinventing this wheel")

> **We're not reinventing this wheel.**
>
> Background Agents shipped in v0.9.6, taught us a lot, and are stepping down with the v0.9.45rc1 release. Two products do scheduled-AI-work better than we can without distracting from FSB's main job:
>
> - **[OpenClaw](https://openclaw.example)** — open-source, multi-runtime, the agents-shaped hole we'd otherwise build
> - **[Claude Routines](https://claude.com/routines)** — first-party from Anthropic, deeply integrated with their model lifecycle
>
> FSB stays focused on what it does best: precise, single-attempt, dashboard-streamed browser automation.
>
> [Why we made this call →] (links to a brief retrospective)

### Sample 3 — Minimal / Just-the-Facts (for the showcase mirror)

> **Background Agents → moved on.**
> As of April 2026, FSB no longer ships background agents. For scheduled / unattended workflows, see [OpenClaw](https://openclaw.example) or [Claude Routines](https://claude.com/routines).

### Microcopy beats checklist (all three samples honor this)

- [x] Dated effective version + month
- [x] Named alternatives (two of them) with links
- [x] "Why" available but not forced (link, not a wall of text)
- [x] No "you should have" / blame language
- [x] No CTA that the user must dismiss
- [x] Card is informative, not blocking

### Anti-patterns to avoid in the copy

- "We've decided to deprecate..." — corporate, distancing
- "Unfortunately..." — apologetic
- "We hope you understand!" — needy
- A bullet list of all the reasons it didn't work — sounds like blame
- Crossed-out feature names — childish

## Feature Dependencies

```
Sync tab top-level nav entry
    └──requires──> nav-item switching logic in options.js (existing)
    └──relocates──> #serverUrl / #serverHashKey / #btnGenerateHashKey / #btnCopyHashKey
                    /#btnPairDashboard / #pairingQROverlay / #btnTestConnection / #connectionStatus
                    └──currently lives at──> #background-agents section (control_panel.html line 700-748)

Live connection status pill
    └──requires──> ext:remote-control-state broadcast (Phase 209, shipped)
    └──enhances──> existing #connectionStatus span (which only updates on Test Connection click)

Live remote-control state pill (differentiator)
    └──requires──> ext:remote-control-state broadcast (Phase 209, shipped)

Manual fallback pairing code
    └──requires──> /api/pair/generate response (Phase 210, shipped — already returns token)

Last-paired timestamp
    └──requires──> handshake-success event hook + chrome.storage.local persistence (new, ~10 lines)

Deprecation card (extension)
    └──requires──> the existing #background-agents section to be repurposed
    └──conflicts──> with leaving the agents form rendered (form must be hidden/removed)

Deprecation card (showcase)
    └──requires──> Angular content updates in src/app/pages/{home,about,dashboard}
    └──depends on──> v0.9.29 Angular shell

WebSocket inbound decompression
    └──requires──> bridge/relay handshake to negotiate permessage-deflate in BOTH directions
    └──invisible to──> users (no UI affordance)
    └──verifiable via──> DevTools Network panel WS frame view

Mutation queue watchdog
    └──requires──> the existing mutation observer in content/ modules
    └──depends on──> stream lifecycle events (streamStart, streamEnd, flush)
    └──enhances──> existing diagnostic logging (Phase 200's pattern)

Stale counter reset
    └──requires──> watchdog + stream lifecycle hooks
    └──depends on──> watchdog being implemented first (within same phase)

Diagnostic logging
    └──no dependencies──> pure refactor of existing try/catch blocks in dialog relay & message delivery
    └──depends on──> grep audit to find every silent catch
```

### Dependency Notes

- **Sync tab requires nothing new structurally** — it's a relocation + nav addition. The hardest part is making sure no other code path references `#background-agents` and expects to find pairing UI there.
- **Live status pill depends on Phase 209's broadcast contract** — if that broadcast isn't reliable across SW wake, the pill will lie. Worth a smoke test.
- **Sunset card on showcase depends on Angular shell** — that landed in v0.9.29 (Phase 173), so the surface is ready.
- **Watchdog and counter reset are tightly coupled** — must ship in the same plan; partial = false alarms.
- **Compression symmetry has no UI dependency** — it's a pure transport-layer fix; testable only via WS frame inspection or by sending a payload that previously failed.
- **Diagnostic logging is independent and parallelizable** — no blockers.

## MVP Definition (For This Milestone, Not the Whole Product)

### Must Ship in v0.9.45rc1 (P1)

- [x] **Sync tab top-level nav entry** with QR pairing + hash key + connection status moved in (table stakes; users currently can't find pairing easily)
- [x] **Live connection status pill** wired to `ext:remote-control-state` (table stakes; passive label is insufficient)
- [x] **Background Agents tab body replaced with deprecation card** (milestone scope mandate)
- [x] **Comment out (preserve) background-agent-only code paths** with deprecation annotation (PROJECT.md mandate, preserves shared utilities)
- [x] **Showcase/dashboard mirror of sunset messaging** (consistency requirement)
- [x] **DOM streaming watchdog + stale counter reset** (milestone scope mandate)
- [x] **WebSocket inbound decompression** (milestone scope mandate; correctness, not feature)
- [x] **Diagnostic console.warn replacing silent error swallowers** in dialog relay + message delivery (milestone scope mandate)

### Should Ship If Easy (P2)

- [ ] **Manual fallback pairing code** displayed under QR (small addition, big UX win for users without phone camera handy)
- [ ] **Last-paired timestamp + UA string** (10 lines of code; substantial trust win)
- [ ] **Manual Reconnect button** in Sync tab (visible only when disconnected)

### Defer to Future (P3)

- [ ] **Live remote-control state chip** ("clicking now / typing now") — high polish, adds complexity, can ship in v0.9.46
- [ ] **Stream health card** with mutations/s and queue depth — power-user nicety, not on critical path
- [ ] **One-click Unpair / Sign Out of Dashboard** — depends on server endpoint that may not exist; can be local-only later
- [ ] **Three rotating sunset taglines** — fun, but a single well-written tagline is sufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sync tab top-level (relocation) | HIGH | LOW | P1 |
| Live connection status pill | HIGH | LOW-MEDIUM | P1 |
| Sunset deprecation card (extension) | MEDIUM (avoids confusion) | LOW | P1 |
| Background-agent code preservation comments | LOW user / HIGH operator | LOW (mechanical) | P1 |
| Sunset mirror on showcase | MEDIUM | LOW | P1 |
| DOM mutation queue watchdog | MEDIUM (stability) | MEDIUM | P1 |
| Stale counter reset | MEDIUM (correctness) | LOW | P1 |
| WS inbound decompression | HIGH (silent breakage fix) | MEDIUM | P1 |
| Diagnostic logging refactor | HIGH (debuggability) | LOW | P1 |
| Manual fallback pairing code | MEDIUM | LOW | P2 |
| Last-paired timestamp | MEDIUM | LOW | P2 |
| Manual Reconnect button | MEDIUM | LOW | P2 |
| Live remote-control state chip | LOW-MEDIUM | MEDIUM | P3 |
| Stream health card | LOW | MEDIUM | P3 |
| Unpair / sign-out flow | MEDIUM | MEDIUM | P3 |
| Rotating sunset taglines | LOW (delight) | LOW | P3 |

## Comparable Product Feature Analysis

| Feature | GitHub Sessions | 2FAS Browser Pair | Chrome Remote Desktop | rrweb / Replay.io | FSB Approach |
|---------|----------------|-------------------|------------------------|-------------------|--------------|
| Top-level "devices/sessions" nav | Yes (Settings → Sessions) | Yes (Extension popup main view) | Yes (homepage tab) | N/A | **Yes — new top-level Sync tab** |
| QR pairing | N/A | Yes (primary) | N/A (uses Google Account) | N/A | Yes (already shipped Phase 210) |
| Manual code fallback | N/A | Yes (under QR) | Yes (access code) | N/A | **P2 — display token under QR** |
| Last-seen / last-paired | Yes (shown per session) | Implicit | Yes ("Last connected") | N/A | **P2 — add timestamp** |
| Manual revoke | Yes ("Revoke") | Yes ("Disconnect") | Yes ("Stop sharing") | N/A | **P3 — defer to follow-up** |
| Live connection status | N/A (sessions shown post-hoc) | Yes (color dot) | Yes (live during session) | N/A | **P1 — connection status pill** |
| Stuck-queue watchdog | N/A | N/A | N/A | **No — known pain point in rrweb #1447, #221** | **P1 — FSB ships this and is differentiated for it** |
| Sunset card pattern | (Used for old 2FA flows) | N/A | N/A | N/A | **P1 — dry, witty, or minimal sample provided** |

The comparable products converge on a clear signal: Sync/Devices is always top-level; status is always live; pairing always has both QR and a typeable code. FSB currently does none of these — that's exactly the gap this milestone closes. On the streaming side, FSB's mutation watchdog would be a genuine differentiator vs rrweb's known unsolved performance issues.

## Sources

### Current FSB code (HIGH confidence — direct file reads)
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/PROJECT.md` (lines 11-27 milestone scope, 252-262 sunset list, 183-190 active requirements)
- `/Users/lakshmanturlapati/Desktop/FSB/ui/control_panel.html` (lines 53-89 nav structure; lines 700-748 current Server Sync placement under Background Agents)
- `/Users/lakshmanturlapati/Desktop/FSB/ui/options.js` (lines 4190-4943 pairing implementation)
- `/Users/lakshmanturlapati/Desktop/FSB/showcase/angular/src/app/pages/dashboard/dashboard-page.component.html` (line 26 references "Server Sync" by current name)

### Comparable product UX patterns (MEDIUM confidence — WebSearch with verification)
- [GitHub: Viewing and managing your sessions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/viewing-and-managing-your-sessions) — last-seen, revoke, location per session
- [GitHub Changelog: New session and device management settings page (2022)](https://github.blog/changelog/2022-11-16-new-session-and-device-management-settings-page/) — top-level nav for device mgmt
- [2FAS browser extension pairing](https://2fas.com/support/browser-extension/how-to-pair-a-mobile-device-with-a-browser/) — QR + manual code + connection status
- [Chrome Remote Desktop](https://remotedesktop.google.com/) — access code as fallback to QR
- [rrweb Issue #1447: Performance with MutationObserver and rr-block](https://github.com/rrweb-io/rrweb/issues/1447) — confirms 10k+ mutations cause stuck queue (motivates watchdog)
- [rrweb Issue #221: Throttling/pausing of Mutation Events](https://github.com/rrweb-io/rrweb/issues/221) — long-running issue confirming buffer pressure is a real, unsolved class of bug
- [rrweb observer docs](https://github.com/rrweb-io/rrweb/blob/master/docs/observer.md) — confirms add/move/drop deduplication pattern; FSB watchdog complements not replaces it

### WebSocket compression (HIGH confidence — RFC + MDN)
- [RFC 7692: Compression Extensions for WebSocket](https://datatracker.ietf.org/doc/html/rfc7692) — canonical spec; both peers MUST support both directions if negotiated
- [MDN: Sec-WebSocket-Extensions](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-WebSocket-Extensions) — handshake negotiation; browser handles inbound decompression automatically once negotiated
- [Configuring & Optimizing WebSocket Compression — igvita.com](https://www.igvita.com/2013/11/27/configuring-and-optimizing-websocket-compression/) — practical asymmetry caveats

### Sunset / deprecation messaging patterns (MEDIUM confidence)
- [Microsoft: Project Online discontinuation guidance](https://www.holert.com/en/blog/microsoft-project-online-ends-alternatives) — example of named alternative + migration framing
- [Google: Update on Google Business Messages](https://developers.google.com/business-communications/business-messages/resources/release-notes/update-on-gbm) — example of dated retirement + redirect copy
- [Netlify: Deprecation of Post-processing Asset Optimization](https://www.netlify.com/blog/deprecation-of-post-processing-asset-optimization-feature/) — example of "as of [date]" + alternative phrasing

---
*Feature research for: FSB v0.9.45rc1 — Sync surface, agent sunset, stream reliability*
*Researched: 2026-04-28*
