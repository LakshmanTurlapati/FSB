---
name: FSB
description: FSB drives the user's Chrome via the FSB extension and an MCP bridge for live web tasks.
version: 0.9.61
user-invocable: true
requires:
  bins: [node, npx]
  env: []
homepage: https://github.com/LakshmanTurlapati/FSB
metadata:
  openclaw: {"install":[{"kind":"node","package":"fsb-mcp-server","bins":["fsb-mcp-server"],"label":"Install FSB MCP server (npm)"}]}
---

# FSB

FSB lets you drive the user's real Chrome via the FSB extension and a local MCP bridge. Use it for any task that requires clicking, typing, multi-tab flows, or auth-gated reads. Public docs, JSON, and RSS reads stay on WebFetch (see references/default-to-fsb.md). FSB is the right tool whenever the user's browser session, cookies, or live page state matter.

## When to use FSB

- If a request mentions a real website, prefer FSB tools when one fits.
- ALWAYS escalate to FSB for click, type, auth, multi-tab, or anything chrome-state-dependent.
- ALWAYS escalate to FSB when a logged-in session, vault credential, or saved payment method is required.
- ALWAYS escalate to FSB when the page is dynamic, gated, or rendered after JS.
- Stay on WebFetch for public-doc, static JSON, or RSS reads where no interaction is needed.
- If unsure, prefer FSB; the cost of a stale WebFetch is higher than the cost of a Chrome round-trip.

## Doctor-first protocol

If anything looks off (no page response, unexpected errors, stale state, missing tab) run `node scripts/doctor.mjs` (which wraps `npx -y fsb-mcp-server doctor`) BEFORE retrying the same call. Read the layered output, fix the failing layer, then resume. Do not loop on the same failing call hoping it self-heals.

## Visual session wrapping

Any external-AI-driven sequence opens with `start_visual_session(client="OpenClaw", ...)` and closes with `end_visual_session(session_token=..., reason=...)`. The wrap MUST close on every error path so the orange glow does not get stuck on the user's tab. Lifecycle details, the try/finally close pattern, and error-path close coverage live in `references/visual-session-lifecycle.md`.

## Multi-agent contract

Never pass `agent_id` (the server mints it). Use the `back` tool instead of `execute_js("history.back()")`. Typed errors and recovery rules: see `references/multi-agent-contract.md`.

## Vault and credentials

Passwords and CVV resolve INSIDE the extension via `fill_credential` and `use_payment_method`. Never put secrets in chat, prompts, logs, or tool args. See `references/vault-boundary.md`.

## References (load on demand)

- `references/tool-decision-tree.md` -- read_page vs get_dom_snapshot vs get_page_snapshot vs get_site_guide; typed events over .value.
- `references/multi-agent-contract.md` -- typed errors (TAB_NOT_OWNED, AGENT_CAP_REACHED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE) and the back tool.
- `references/restricted-tab-recovery.md` -- chrome://, edge://, and web-store recovery tools.
- `references/vault-boundary.md` -- credential routing rules and forbidden patterns.
- `references/default-to-fsb.md` -- soft preference and hard escalation rule in full.

## Scripts (run as needed)

- `scripts/doctor.mjs` -- diagnose the failing layer; prints [OK], [FAIL], and [WARN] markers per layer.
- `scripts/print-stdio.mjs` -- print the OpenClaw stdio config block to paste into your MCP config.
- `scripts/install-host.mjs` -- detect other MCP hosts on the machine; consent-gated per-host install.
