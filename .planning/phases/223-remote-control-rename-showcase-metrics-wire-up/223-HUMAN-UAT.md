# Phase 223 Human UAT — Remote Control rename + showcase metrics wire-up

## Pre-flight

- [ ] Plans 01, 02, 03 marked complete (SUMMARY files exist).
- [ ] `npm test`, `npm run validate:extension`, `npm run showcase:build` all green locally (Plan 04 Task 1).
- [ ] Chrome with the unpacked extension loaded from `extension/` directory.
- [ ] Showcase running locally (operator starts via `npm run showcase:serve` or equivalent — NOT an automated step).

## ROADMAP Phase 223 Success Criterion 1: Rebrand visible end-to-end

1. Open the extension options page (right-click extension icon -> Options, or chrome://extensions -> FSB -> Details -> Extension options).
2. Confirm the left-nav shows "Remote Control" with a Beta badge between "Sync" and "Passwords". No "Agents" word visible.
3. Click the "Remote Control" nav item.
4. Confirm the section header reads "Remote Control" (not "Background Agents").
5. Below the header, confirm the deprecation card is intact ("Background agents have left the building." + OpenClaw / Claude Routines CTAs). This copy is intentional.
6. Open `https://full-selfbrowsing.com/about` (or local showcase /about). In the dashboard mockup sidebar, confirm "Remote Control" appears where "Agents" used to be.
7. On /about, scroll to the architecture diagram. Confirm one of the arch-boxes is now labeled "Remote Control" (not "Background Agents").
8. Open /support. In the FAQ, confirm the entry "What is Remote Control?" exists and the legacy "What are Background Agents?" entry is gone.

PASS condition: items 1-8 all observed.

## ROADMAP Phase 223 Success Criterion 2: Metrics live on connect

1. Open the showcase /dashboard in a browser tab.
2. Pair the extension via QR or paste-key flow (existing pairing UI).
3. Within one render cycle of pairing complete, observe the four stat cards (Active, Runs Today, Success Rate, Total Cost) populate with non-placeholder values that reflect the extension's analytics state. (If the extension is fresh, "Runs Today" may legitimately be 0 — the test is whether the cost card matches `analytics.getStats('24h').totalCost` from the extension options analytics view.)
4. Open chrome://extensions -> FSB -> service worker console. Trigger the remote-control attach flow on a tab. Verify the dashboard's "Active" card flips to 1 and an active-tab indicator (URL) becomes available in the next ext:metrics emit (after chrome.tabs.get resolves).

PASS condition: stat cards reflect live values; "Active" reflects remote-control attach state.

## ROADMAP Phase 223 Success Criterion 3: Disconnect transitions to no-data

1. With the dashboard live and metrics populated, click "Disconnect" in the extension (or close the WS by closing the SW context).
2. Within one render cycle, confirm the four stat cards reset to the no-data placeholders: Active=0, Runs Today=0, Success Rate=0%, Total Cost=$0.00.

PASS condition: cards transition to placeholders without retaining stale ghost values from the previous session.

## ROADMAP Phase 223 Success Criterion 4: Phase 209 contract + CI matrix green

1. Confirm `npm test` passed locally (Plan 04 Task 1).
2. Confirm `tests/sync-tab-runtime.test.js` was part of that run and passed — this is the Phase 209 trip-wire.
3. On the milestone PR, confirm the GitHub Actions matrix (`extension`, `mcp-smoke`, `website`, `all-green`) is green.

PASS condition: all green.

## Sign-off

- [ ] All four ROADMAP success criteria observed PASS.
- [ ] Operator name: ____________________
- [ ] Date: ____________________
- [ ] Notes (any deferred follow-up items):
