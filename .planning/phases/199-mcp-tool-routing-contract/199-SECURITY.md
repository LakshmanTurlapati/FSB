---
phase: 199
slug: mcp-tool-routing-contract
status: verified
threats_open: 0
threats_total: 13
threats_closed: 13
asvs_level: 1
block_on: none
created: 2026-04-23
updated: 2026-04-23
---

# Phase 199 - Security

Per-phase security contract for Phase 199: MCP tool routing contract.

Config note: no explicit `<config>` block was present in the supplied artifacts. This report uses the GSD SECURITY template default `asvs_level: 1` and records `block_on: none`.

## Scope

Audited plans:

- `.planning/phases/199-mcp-tool-routing-contract/199-01-PLAN.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-02-PLAN.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-03-PLAN.md`

Audited summaries and review artifacts:

- `.planning/phases/199-mcp-tool-routing-contract/199-01-SUMMARY.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-02-SUMMARY.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-03-SUMMARY.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-VERIFICATION.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-REVIEW.md`
- `.planning/phases/199-mcp-tool-routing-contract/199-REVIEW-FIX.md`

Implementation and tests were read-only for this audit. `npm --prefix mcp-server run build` regenerated tracked build artifacts during verification; that build drift was restored before this report was written.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness -> extension VM/module | Node tests load extension routing code without Chrome privileges. | Route metadata and sanitized responses |
| MCP server error mapper -> MCP client | Structured extension errors are converted into user-facing MCP responses. | Error code, route metadata, recovery hints |
| Public tool registry -> route contract | Registered public MCP tools are compared against direct route declarations. | Tool names and route families |
| MCP bridge message -> extension dispatcher | Local MCP requests cross into service-worker route handlers. | Tool/message payloads |
| Dispatcher -> Chrome tabs/windows APIs | Browser routes can navigate, create, switch, or inspect tabs. | Tab IDs, URLs, domains, titles |
| Dispatcher response -> MCP server | Browser/tab metadata leaves the extension. | Sanitized tab metadata |
| MCP bridge message -> automation/session handlers | Autopilot and observability requests reach extension internals. | Task/session/log/memory requests |
| Extension memory/session/log state -> MCP client | Read-only data leaves the extension. | Filtered logs, bounded session metadata, bounded memory entries |
| Restricted-page response -> MCP server error mapper | Restricted recovery guidance is mapped to MCP text. | `validRecoveryTools`, `currentUrl`, `pageType` |
| Route dispatcher -> task progress notifications | Long-running automation progress flows back through MCP notifications. | Progress payload `{ taskId, progress, phase, eta, action }` |

## Threat Register

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-199-01-01 | Spoofing | `tests/mcp-tool-routing-contract.test.js` | mitigate | closed | Public and message route lists are executable contract inputs at `tests/mcp-tool-routing-contract.test.js:32` and `tests/mcp-tool-routing-contract.test.js:53`; missing routes fail through `hasMcpToolRoute` / `hasMcpMessageRoute` assertions at `tests/mcp-tool-routing-contract.test.js:237`. Dispatcher allowlists exist at `ws/mcp-tool-dispatcher.js:14` and `ws/mcp-tool-dispatcher.js:40`. |
| T-199-01-02 | Information Disclosure | `tests/mcp-restricted-tab.test.js` | mitigate | closed | Restricted responses are built from a fixed small shape at `ws/mcp-tool-dispatcher.js:144` with `currentUrl`, `pageType`, `tool`, and `validRecoveryTools`; tests assert navigation-only tools, `currentUrl`, `pageType`, and no `run_task` at `tests/mcp-restricted-tab.test.js:115`. |
| T-199-01-03 | Elevation of Privilege | Route fallback behavior | mitigate | closed | Restricted tests install failing content-dispatch stubs at `tests/mcp-restricted-tab.test.js:41` and call the real read/DOM routes at `tests/mcp-restricted-tab.test.js:151`. Background tools dispatch through the direct route allowlist at `ws/mcp-bridge-client.js:480`; unsupported background routes return `mcp_route_unavailable` at `ws/mcp-bridge-client.js:494`. |
| T-199-01-04 | Denial of Service | Route queue/progress behavior | mitigate | closed | `run_task`, `stop_task`, and `get_task_status` are covered in route contracts at `tests/mcp-tool-routing-contract.test.js:95`; `run_task` preserves the five-minute timeout and progress payload at `ws/mcp-bridge-client.js:611` and `ws/mcp-bridge-client.js:624`; lifecycle regression covers progress/completion at `tests/mcp-bridge-client-lifecycle.test.js:304`. |
| T-199-02-01 | Spoofing | `dispatchMcpToolRoute` | mitigate | closed | `dispatchMcpToolRoute` uses `MCP_PHASE199_TOOL_ROUTES` as a strict allowlist and returns `createMcpRouteError` for unknown tools at `ws/mcp-tool-dispatcher.js:101`; route errors include `errorCode`, `tool`, `routeFamily`, and `recoveryHint` at `ws/mcp-tool-dispatcher.js:55`. Unknown route spot-check returned no supplied secret params. |
| T-199-02-02 | Information Disclosure | Browser/tab responses | mitigate | closed | Tab output is reduced by `sanitizeTab` and `sanitizeSingleTab` at `ws/mcp-tool-dispatcher.js:243` and `ws/mcp-tool-dispatcher.js:253`; `list_tabs` returns sanitized tabs, `activeTabId`, and `totalTabs` at `ws/mcp-tool-dispatcher.js:362`. No raw Chrome tab object is returned. |
| T-199-02-03 | Elevation of Privilege | Route fallback | mitigate | closed | `_handleExecuteBackground` routes allowlisted Phase 199 tools through `dispatchMcpToolRoute` at `ws/mcp-bridge-client.js:480`; only explicit vault/payment routes remain on the older background path at `ws/mcp-bridge-client.js:484`; unsupported background tools fail with structured route metadata at `ws/mcp-bridge-client.js:494`. Dispatcher is loaded before the bridge client at `background.js:9`. |
| T-199-02-04 | Denial of Service | Navigation/history handlers | mitigate | closed | `go_back`, `go_forward`, and `refresh` call Chrome history/reload verbs once and catch failures into `navigation_unavailable` responses at `ws/mcp-tool-dispatcher.js:288`. |
| T-199-03-01 | Spoofing | Autopilot route invocation | mitigate | closed | Autopilot public aliases and message routes are allowlisted at `ws/mcp-tool-dispatcher.js:23` and `ws/mcp-tool-dispatcher.js:45`; `mcp:start-automation` calls `handleStartAutomation` with `source: 'mcp'` at `ws/mcp-tool-dispatcher.js:536`; unknown routes return `mcp_route_unavailable` at `ws/mcp-tool-dispatcher.js:114`. |
| T-199-03-02 | Information Disclosure | Logs/sessions/memory routes | mitigate | closed | Prompt/raw-response logs are filtered and capped at `ws/mcp-tool-dispatcher.js:398` and `ws/mcp-tool-dispatcher.js:432`; session metadata removes raw `logs` and `actionHistory` before rebuilding bounded action metadata at `ws/mcp-tool-dispatcher.js:440` and `ws/mcp-tool-dispatcher.js:448`; memory text is capped at `ws/mcp-tool-dispatcher.js:477`; search and memory list limits are bounded at `ws/mcp-tool-dispatcher.js:648` and `ws/mcp-tool-dispatcher.js:668`. Vault/payment tools are excluded from Phase 199 direct expansion at `ws/mcp-tool-dispatcher.js:12`. |
| T-199-03-03 | Elevation of Privilege | Route fallback bypass | mitigate | closed | Phase 199 read/autopilot/observability bridge handlers call `dispatchMcpMessageRoute` at `ws/mcp-bridge-client.js:595`, `ws/mcp-bridge-client.js:658`, `ws/mcp-bridge-client.js:667`, `ws/mcp-bridge-client.js:684`, `ws/mcp-bridge-client.js:693`, `ws/mcp-bridge-client.js:702`, `ws/mcp-bridge-client.js:711`, `ws/mcp-bridge-client.js:720`, and `ws/mcp-bridge-client.js:729`; remaining `_dispatchToBackground` usage is scoped to agent/vault/payment handlers outside Phase 199. |
| T-199-03-04 | Denial of Service | Route queue/progress behavior | mitigate | closed | `run_task` keeps the existing completion listener and five-minute timeout at `ws/mcp-bridge-client.js:609`; progress payload shape is `{ taskId, progress, phase, eta, action }` at `ws/mcp-bridge-client.js:624`; observability list/log/memory limits are bounded at `ws/mcp-tool-dispatcher.js:605`, `ws/mcp-tool-dispatcher.js:634`, and `ws/mcp-tool-dispatcher.js:691`. |
| T-199-03-05 | Tampering | Restricted-tab recovery accuracy | mitigate | closed | `MCP_NAVIGATION_RECOVERY_TOOLS` is fixed to `navigate`, `open_tab`, `switch_tab`, and `list_tabs` at `ws/mcp-tool-dispatcher.js:10`; read/DOM routes check restricted active tabs before helper/content dispatch at `ws/mcp-tool-dispatcher.js:114`; restricted URL detection covers blank/new-tab and browser-internal pages at `ws/mcp-tool-dispatcher.js:207`; server mapping filters `run_task` at `mcp-server/src/errors.ts:80`; tests assert no `run_task` in responses and mapped text at `tests/mcp-restricted-tab.test.js:118` and `tests/mcp-restricted-tab.test.js:198`. |

## Accepted Risks Log

No accepted risks.

## Unregistered Flags

None. All three summaries explicitly record no unplanned threat flags:

- `199-01-SUMMARY.md:116`
- `199-02-SUMMARY.md:133`
- `199-03-SUMMARY.md:140`

## Verification Commands

| Command | Result |
|---------|--------|
| `npm --prefix mcp-server run build` | passed |
| `node --check ws/mcp-tool-dispatcher.js` | passed |
| `node --check ws/mcp-bridge-client.js` | passed |
| `node --check background.js` | passed |
| `node tests/mcp-tool-routing-contract.test.js` | 130 passed, 0 failed |
| `node tests/mcp-restricted-tab.test.js` | 74 passed, 0 failed |
| `node tests/mcp-bridge-client-lifecycle.test.js` | 35 passed, 0 failed |
| Unknown-route secret spot-check | passed; `mcp_route_unavailable` response omitted supplied secret params |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-23 | 13 | 13 | 0 | Codex security auditor |

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-04-23
