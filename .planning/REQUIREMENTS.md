# Requirements: v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up

**Milestone goal:** Rebrand the extension's "Agents" surface to "Remote Control (Beta)" and stream connect-time control-panel metrics into the showcase site dashboard.

**Started:** 2026-05-02

---

## v1 Requirements

### Rebrand (RBR)

The extension's residual "Agents" copy is replaced by "Remote Control" with a Beta marker, end-to-end across the control-panel surface.

- [ ] **RBR-01**: User sees "Remote Control" (not "Agents") as the dashboard tab label in the extension control panel (sidepanel + popup if applicable).
- [ ] **RBR-02**: User sees a "Beta" badge next to the "Remote Control" label, styled consistently with the existing FSB design system (no new colors, reuse existing badge token if one exists; otherwise add a single small variant).
- [ ] **RBR-03**: User no longer sees "Agents" copy on any sub-element of the renamed surface (panel headings, body copy, empty states, tooltips).
- [ ] **RBR-04**: Extension options page navigation (if it references the surface) reflects the rename, so the user encounters one consistent name across all extension entry points.
- [ ] **RBR-05**: Showcase mirror copy (any string in `showcase/angular/` that referred to "Agents" as the surface name) is updated to "Remote Control" so site and extension stay in sync.

### Metrics Wire-up (MET)

On connect, the extension control panel pushes its live metrics to the showcase `/dashboard` so the site renders real data instead of static placeholders.

- [ ] **MET-01**: On WebSocket connect / pairing complete, the extension emits a metrics payload to the showcase dashboard channel — does not wait for a polling tick.
- [ ] **MET-02**: Payload includes **connection state**: connected boolean, paired client identifier, connect timestamp.
- [ ] **MET-03**: Payload includes **session counters**: active sessions, completed tasks, error count (sourced from existing automation-logger / session state, not a new collection layer).
- [ ] **MET-04**: Payload includes **cost / token usage**: total tokens and cost-to-date, sourced from `extension/analytics.js` (do not duplicate the calculation).
- [ ] **MET-05**: Payload includes **active tab metadata**: currently controlled tab id + URL (only when remote control is attached; omit field when detached rather than sending stale data).
- [ ] **MET-06**: Showcase `/dashboard` Angular component renders each of the four metric groups with a clear "live" vs "no data yet" state, so the user can tell whether the extension is connected.
- [ ] **MET-07**: When the extension disconnects, the showcase dashboard transitions back to the "no data yet" state within one render cycle (no stale ghost values).
- [ ] **MET-08**: Metrics push does NOT regress the existing Phase 209 `remoteControlStateChanged` broadcast contract or the `ext:remote-control-state` WS frame shape (verified by existing `tests/sync-tab-runtime.test.js`).

### Quality Gates (QA)

- [ ] **QA-01**: All existing PR-gating CI jobs (`extension`, `mcp-smoke`, `showcase`, `all-green`) remain green on the milestone PR.
- [ ] **QA-02**: `npm run validate:extension` passes (manifest sanity + `node --check` over JS).
- [ ] **QA-03**: Showcase `npm run showcase:build` completes successfully with the new dashboard wiring.

---

## Future Requirements (deferred)

- **MET-FUTURE-01**: Historical / time-series metrics chart on showcase dashboard (current scope is live-only snapshot on connect).
- **MET-FUTURE-02**: Multi-extension multiplexing on the showcase dashboard (current scope assumes one paired client at a time).
- **RBR-FUTURE-01**: Promote "Remote Control" out of Beta once stability metrics meet a defined bar (TBD next milestone).

## Out of Scope

- Reintroducing background agents — explicitly retired in v0.9.45rc1; the rename reinforces this direction.
- New metrics-collection infrastructure — reuse existing `analytics.js`, session state, and Phase 209 broadcast plumbing.
- Authentication/authorization changes on the showcase dashboard — existing pairing flow gates the channel.

---

## Traceability

_Filled by roadmap after Phase 223 plan creation._

| REQ-ID | Phase | Plan |
|--------|-------|------|
| RBR-01..05 | 223 | TBD |
| MET-01..08 | 223 | TBD |
| QA-01..03 | 223 | TBD |
