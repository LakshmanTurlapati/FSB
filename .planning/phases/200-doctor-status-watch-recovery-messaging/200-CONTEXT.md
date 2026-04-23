# Phase 200: Doctor, Status Watch & Recovery Messaging - Context

**Gathered:** 2026-04-23T17:45:15Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 200 makes MCP diagnostics tell users which layer is actually broken and what to do next, without guessing whether the fix belongs in the package, client config, local bridge, browser extension, current page, or tool routing path.

This phase does not add new MCP capabilities, reopen Phase 198 bridge lifecycle/topology behavior, or reopen Phase 199 route-contract semantics. It clarifies diagnosis, live status visibility, recovery wording, and MCP version parity for the existing install and runtime surface.

</domain>

<decisions>
## Implementation Decisions

### Failure Layer Classification
- **D-01:** [auto] `doctor` should classify failures in a fixed layer order: package/runtime availability, client/platform config, bridge bind/ownership, extension attachment, content-script readiness, then tool-routing/handler availability.
- **D-02:** [auto] Diagnostics should stop on one primary failed layer and explain why that layer was chosen, rather than dumping a flat list of unrelated warnings.
- **D-03:** [auto] Content-script failures stay distinct from extension attachment failures. A connected extension with stale or missing page readiness is not the same diagnosis as "extension not connected."
- **D-04:** [auto] Phase 199 route-contract failures such as `mcp_route_unavailable` remain their own tool-routing diagnosis, not a generic extension or page failure.

### Doctor And Status Watch Surface
- **D-05:** [auto] `doctor` is a one-shot diagnostic command: collect a snapshot, classify the broken layer, and give one best next action.
- **D-06:** [auto] `status --watch` is an operational live view, not a scrolling remediation essay. Each update should stream bridge mode, extension connection, last-heartbeat age, hub/relay state, active hub identity, and recent disconnect reason.
- **D-07:** [auto] Human-readable watch output should default to a compact scan-friendly stream or table refresh, while `--json` stays opt-in for machine-readable snapshots.
- **D-08:** [auto] `status`, `status --watch`, and `doctor` should share the same underlying diagnostic field names and ordering so one-shot and live views are mentally consistent.

### Recovery Messaging Policy
- **D-09:** [auto] Recovery guidance must be tied to the detected layer and prefer one concrete next action over generic restart-everything advice.
- **D-10:** [auto] Human-facing diagnostic copy should follow a short "Detected / Why / Next action" structure whenever possible.
- **D-11:** [auto] Restricted-page and content-script failures should prefer navigation, refresh, reinjection, or retry guidance before browser or host restarts, consistent with Phase 199 recovery-tool limits.
- **D-12:** [auto] `mcp-server/src/errors.ts` remains the shared MCP tool-error wording surface; Phase 200 should enrich it with layer-aware recovery hints instead of introducing a separate parallel copy system.

### Version Parity Contract
- **D-13:** [auto] Treat the MCP package version surface as a parity contract: `mcp-server/package.json`, `mcp-server/src/version.ts`, `mcp-server/server.json`, CLI output, and package docs must agree before release.
- **D-14:** [auto] Root project docs may still talk about the broader extension milestone, but any explicit `fsb-mcp-server` version reference in root docs must either match the MCP package/runtime version or be removed in favor of package-scoped docs.
- **D-15:** [auto] Phase 200 should add an explicit automated parity check so MCP version drift fails fast instead of being discovered manually after docs or publish steps diverge.

### the agent's Discretion
- Exact terminal rendering style for `status --watch` (line refresh, compact table, or equivalent) as long as it stays scan-friendly and stable.
- Exact helper/function names for the layer classifier, heartbeat-age formatter, and version-parity checks.
- Whether `status --watch` polls the existing diagnostics collector or adds a small shared watch wrapper around it, as long as field semantics stay aligned.
- Whether version parity is enforced with one focused Node assertion script, a build check, or both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Handoff
- `.planning/ROADMAP.md` - Phase 200 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` - DIAG-01 through DIAG-04 plus VALID-04 documentation expectations.
- `.planning/PROJECT.md` - Current milestone goal and the requirement that diagnostics replace guesswork with exact next actions.
- `.planning/STATE.md` - Current phase focus and readiness state.
- `.planning/phases/199-mcp-tool-routing-contract/199-CONTEXT.md` - Phase 199 route-contract decisions, especially D-19 handing final polished diagnostic wording to Phase 200.

### CLI Diagnostics And Runtime Telemetry
- `mcp-server/src/index.ts` - Current CLI commands, help text, `status`/`doctor` formatting, and `--json` behavior.
- `mcp-server/src/diagnostics.ts` - Shared bridge diagnostic collector, config probe, tab probe, and current topology payload.
- `mcp-server/src/bridge.ts` - Hub/relay ownership, `lastExtensionHeartbeatAt`, `lastDisconnectReason`, and topology state source of truth.
- `mcp-server/src/http.ts` - Existing `/health` topology payload and queue/session status surface.
- `background.js` - Content-script readiness, heartbeats, reinjection, and the failure boundary between extension-attached and page-not-ready states.

### Recovery Copy And Route Errors
- `mcp-server/src/errors.ts` - Structured MCP error mapping, restricted-tab recovery guidance, and current content-script/bridge/tool-route error text.

### Version Parity Surface
- `mcp-server/src/version.ts` - Runtime `FSB_MCP_VERSION` and MCP server identity constants.
- `mcp-server/package.json` - MCP package metadata currently drifting from runtime metadata.
- `mcp-server/server.json` - Published server registry metadata and version field.
- `mcp-server/src/install.ts` - Install/uninstall output that prints the reported server version.
- `mcp-server/README.md` - Package-level install and diagnostics docs, including explicit MCP version references.
- `README.md` - Root project docs that also mention the MCP package and currently contain version drift.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp-server/src/diagnostics.ts` already centralizes bridge diagnostics and optional config/tab probes; Phase 200 should build classification and watch behavior on top of this rather than starting a second diagnostics path.
- `mcp-server/src/bridge.ts` already tracks hub vs relay mode, extension connectivity, active hub instance, relay count, heartbeat timestamp, and disconnect reason in one topology object.
- `mcp-server/src/errors.ts` already maps structured tool failures to human-readable MCP responses and recovery hints; this is the natural place to sharpen layer-specific recovery wording.
- `mcp-server/src/http.ts` already exposes `/health` with bridge topology and queue/session state, which can keep HTTP diagnostics and CLI diagnostics aligned.
- `background.js` already tracks main-frame content-script ports, heartbeats, ready state, reinjection attempts, and restricted-page behavior needed to separate extension failures from page-level failures.

### Established Patterns
- CLI commands default to human-readable output and expose `--json` as the machine-readable escape hatch.
- Bridge runtime state is expressed through `BridgeTopologyState`; new diagnostics should reuse that field vocabulary instead of inventing parallel names.
- MCP failures already prefer structured `errorCode` plus contextual placeholders over ad hoc string matching alone.
- Focused regression coverage uses plain Node assertion scripts instead of a heavyweight test framework.

### Integration Points
- `mcp-server/src/index.ts` for new `status --watch` flag handling, shared output helpers, and `doctor` presentation.
- `mcp-server/src/diagnostics.ts` for layer classification inputs, snapshot normalization, and watch polling.
- `mcp-server/src/errors.ts` for tool-error recovery messaging tied to detected failure layers.
- `background.js` if extra content-script health detail or explicit diagnostics probes are needed to distinguish extension-connected from content-script-unavailable states.
- `mcp-server/package.json`, `mcp-server/src/version.ts`, `mcp-server/server.json`, `mcp-server/src/install.ts`, `mcp-server/README.md`, and `README.md` for version-parity cleanup and tests.

</code_context>

<specifics>
## Specific Ideas

- The user wanted zero-friction continuation, so all gray areas were auto-selected and the recommended defaults were accepted for this phase.
- Phase 199 already locked restricted-page recovery semantics; Phase 200 should improve wording without reintroducing `run_task` as a blank-page fallback.
- The diagnostic outcome should tell users which component to act on next: MCP package, host config, bridge owner, extension, current page, or route contract.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 200 scope.

</deferred>

---

*Phase: 200-doctor-status-watch-recovery-messaging*
*Context gathered: 2026-04-23*
