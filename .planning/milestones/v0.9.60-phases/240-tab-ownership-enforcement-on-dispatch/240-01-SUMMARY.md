---
phase: 240-tab-ownership-enforcement-on-dispatch
plan: 01
subsystem: agent-registry
tags: [ownership-token, tab-metadata, legacy-agent, dispatch-gate-foundation]
requirements-completed: [OWN-04]
completed: 2026-05-05
status: complete
---

# Phase 240 Plan 01 Summary

Extended the Phase 237 AgentRegistry with the token and metadata surface required by the Phase 240 dispatch gate.

## Delivered

- `bindTab(agentId, tabId)` now returns `{ agentId, tabId, ownershipToken }` for successful binds.
- `isOwnedBy(tabId, agentId, ownershipToken)` verifies the tab owner and per-bind ownership token.
- `getTabMetadata(tabId)` exposes cached `ownershipToken`, `incognito`, `windowId`, and `boundAt` synchronously so the dispatch gate can reject without a Chrome API round trip.
- `getAgentWindowId(agentId)` pins an agent to the first bound window.
- `getOrRegisterLegacyAgent(surface)` is the explicit Phase 240 carve-out for `legacy:popup`, `legacy:sidepanel`, and `legacy:autopilot`.
- `releaseTab(tabId)` wipes ownership metadata and preserves the Phase 237 idempotent release behavior.

## Verification

- `tests/ownership-gate.test.js` covers token shape, fresh-token rebinding, metadata reads, legacy-agent carve-outs, and agent window pinning.
- `tests/agent-registry.test.js` covers the persisted metadata round trip.
- `tests/fixtures/run-task-harness.js` gained the owned-tab helper consumed by later ownership-gate tests.

## Outcome

Plan 01 provides the registry substrate used by Plan 02's same-microtask dispatch gate and Plan 03's legacy-surface synthesis. No user-facing behavior changes shipped in this plan by itself.
