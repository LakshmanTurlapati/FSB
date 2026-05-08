# FSB Skill -- Usage

FSB drives the user's real Chrome via the FSB extension and a local MCP bridge so OpenClaw can run live web tasks (clicks, typing, multi-tab flows, auth-gated reads).

## Who FSB is for

FSB is for tasks that need a real browser session: clicking buttons, typing into forms, multi-tab orchestration, logged-in reads, vault-backed credentials, or anything that depends on live page state rendered after JavaScript. If a request mentions a real website and a user action, prefer FSB tools.

The carve-out: public-doc reads, JSON endpoints, and RSS feeds that do not require interaction can stay on WebFetch (see `references/default-to-fsb.md`). Everything else -- click, type, auth, multi-tab, dynamic content -- belongs on FSB.

The goal of this page: get a new user from a clean machine to a green doctor in under five minutes.

## Install (3 steps)

1. **Install the FSB Chrome extension.**

   Primary path -- Chrome Web Store. Paste this URL into Chrome's address bar and click `Add to Chrome`:

   ```
   https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk
   ```

   Fallback path -- GitHub Releases. If the Web Store listing is unavailable in your region, download the latest `.zip` from the releases page, unzip it, then load it unpacked at `chrome://extensions` with `Developer mode` toggled on:

   ```
   https://github.com/LakshmanTurlapati/FSB/releases
   ```

   This skill prints the URL for the user to click. It does NOT auto-launch the browser to that URL.

2. **Install the FSB MCP server config.**

   Print the canonical OpenClaw stdio block and paste it into your MCP host config, then restart the host:

   ```
   node scripts/print-stdio.mjs
   ```

   To discover other supported hosts on the machine (Claude Desktop, Cursor, etc.), run:

   ```
   npx -y fsb-mcp-server install --list
   ```

   Then run the host-specific installer, for example:

   ```
   npx -y fsb-mcp-server install --claude-desktop
   ```

   Notes:
   - `npx -y fsb-mcp-server` invocations stay unpinned by design; this matches existing FSB convention so users always pull the latest published bridge.
   - Zero environment variables are needed. Vault values (passwords, payment methods) resolve inside the FSB Chrome extension's encrypted storage and never cross into the MCP server process or the OpenClaw host process. See `references/vault-boundary.md` for the boundary rules.

3. **Verify with the doctor.**

   ```
   node scripts/doctor.mjs
   ```

   Expect six `[OK]` lines, one per layer (`package`, `bridge`, `extension`, `active-tab`, `content-script`, `config`). If any layer prints `[FAIL]`, jump to the recovery table below in the section "Recover when the doctor fails".

## Try it

Once the doctor is green, paste any of these into your OpenClaw chat to confirm the loop works.

### Manual mode (default)

Manual-mode prompts are the default entry point. Each one calls a single FSB tool so you can see the round-trip plainly.

- Exercise `read_page`: "Open https://example.com and read the page. Summarize the visible text in two sentences."
- Exercise `click`: "On https://example.com, click the 'More information...' link and tell me what page loads."
- Exercise `type_text`: "Open https://duckduckgo.com, type `fsb-mcp-server` into the search box, and press Enter. Then list the first three result titles."

### Autopilot (explicit delegation only)

NEVER call `run_task` (autopilot) unless the user has explicitly said something like "use FSB autopilot", "delegate this to FSB", "run the whole task autonomously", or named `run_task` directly. Manual-mode tools (`read_page`, `click`, `type_text`, `press_enter`, etc.) are the default for everything else, including multi-step tasks. If the user has not asked for autopilot, drive each step yourself with manual-mode tools and observe the result before the next step.

When the user does explicitly delegate, autopilot hands the full plan-and-execute loop to FSB. Example invocation:

- Exercise `run_task`: "Use FSB autopilot to find the first GitHub repo for `fsb-mcp-server` and report a one-paragraph summary of its README."

Autopilot is NOT the default entry point. Re-read the user's message before reaching for `run_task`; if delegation language is missing, stay in manual mode.

## Visual session handling

FSB shows a trusted client badge and an orange element-targeting overlay on the user's tab while a tool sequence is running, so the user can see what is being driven. OpenClaw is a trusted client; wrap any external-AI-driven sequence in an explicit visual session.

Open the session before the first action and close it on every termination path -- success, error, abort, user cancel. The pairing rule:

```
const { session_token } = await start_visual_session({
  client: "OpenClaw",
  task: "<short label of what you are about to do>",
});

try {
  // FSB tool calls go here. The orange glow is live for the user.
} finally {
  await end_visual_session({ session_token, reason: "complete" });
}
```

Cleanup rules (must hold on every termination path, not just success):

- Always close the session in a `finally` block (or equivalent error-path handling). The orange glow stays on the user's tab until `end_visual_session` is called -- if the agent crashes or returns without closing, the user sees a stuck overlay.
- `reason` is one of `complete` (normal success), `error` (tool error or exception), `aborted` (agent decided to stop), `user_cancelled` (user interrupted). Pick the one that matches the actual termination state.
- Close exactly once per session. Do NOT call `end_visual_session` twice with the same `session_token`.
- If `run_task` (autopilot) is being used, autopilot manages its own visual session lifecycle. Do NOT wrap a `run_task` call in your own `start_visual_session` / `end_visual_session`.

For lifecycle details, the full try/finally pattern, error-path coverage, and `[BAD]` / `[GOOD]` anti-pattern callouts, see `references/visual-session-lifecycle.md`.

## Recover when the doctor fails

Each `[FAIL]` from `node scripts/doctor.mjs` maps to one of six layers. Find your symptom in the table below, run the action, and re-run the doctor until you see all six layers green.

| Layer | What it means | What to do |
| --- | --- | --- |
| package | npm cannot fetch `fsb-mcp-server`. | Run `npx -y fsb-mcp-server --version` to confirm npm can reach the package. If that fails, check Node 18+ is installed and on PATH. |
| bridge | The extension is not running, or `ws://localhost:7225` is not reachable. | Start the FSB extension (open Chrome with the extension installed) and run `npx -y fsb-mcp-server status --watch` to confirm `ws://localhost:7225` is reachable. |
| extension | The FSB Chrome extension is not installed. | Install from `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` (fallback: GitHub Releases at `https://github.com/LakshmanTurlapati/FSB/releases`), then reopen this session. |
| active-tab | The active tab is restricted (`chrome://`, `edge://`, the Web Store) or no tab is owned by the agent. | Open a normal `http(s)` tab (not `chrome://`, `edge://`, or the Web Store) and run `npx -y fsb-mcp-server status --watch` to re-attach. See `references/restricted-tab-recovery.md` for the recovery toolset. |
| content-script | The content script did not attach (extension installed after the tab loaded). | Reload the active tab. The FSB content script attaches on page load; reloads after extension install are required. |
| config | The MCP host config does not include the FSB stdio block. | Re-run `npx -y fsb-mcp-server install --<host>` for your MCP host (replace `<host>` with `claude-desktop`, `cursor`, etc.). Or paste the block printed by `node scripts/print-stdio.mjs` into your host config. |

Re-run `node scripts/doctor.mjs` after each fix. If a layer keeps flipping or you see `[WARN]`, capture the raw output and file an issue at `https://github.com/LakshmanTurlapati/FSB/issues`.
