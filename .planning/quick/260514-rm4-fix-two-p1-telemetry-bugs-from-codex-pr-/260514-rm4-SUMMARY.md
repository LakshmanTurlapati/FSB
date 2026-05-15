---
quick_id: 260514-rm4
plan: 01
type: execute
status: complete
date: "2026-05-14"
duration_minutes: 28
commits:
  - c6fb1f1: "fix(extension-mcp-metrics-recorder): serialize fsbUsageData append to avoid concurrent-dispatch row loss (Codex PR #50 P1)"
  - 2e514c1: "fix(telemetry-collector): strip attempts field from POST body so server allowlist doesn't reject retries (Codex PR #50 P1)"
files_changed:
  - extension/utils/mcp-metrics-recorder.js
  - extension/utils/telemetry-collector.js
  - tests/extension-record-dispatch-serializes.test.js
  - tests/telemetry-collector-strips-internal-fields.test.js
  - package.json
requirements_satisfied: [CODEX-PR50-P1A, CODEX-PR50-P1B]
tests_added:
  - tests/extension-record-dispatch-serializes.test.js
  - tests/telemetry-collector-strips-internal-fields.test.js
tests_regression_sweep:
  - tests/mcp-metrics-recorder.test.js
  - tests/mcp-metrics-no-pii-leak.test.js
  - tests/telemetry-collector.test.js
  - tests/telemetry-payload-allowlist.test.js
  - tests/server-telemetry-allowlist.test.js
  - tests/extension-record-dispatch-serializes.test.js
  - tests/telemetry-collector-strips-internal-fields.test.js
---

# Quick Task 260514-rm4 — Fix two Codex P1 telemetry bugs from PR #50

## One-liner

Fixed two P1 telemetry pipeline bugs surfaced by Codex on PR #50: (1) a row-loss
race in `mcp-metrics-recorder.recordDispatch` resolved by serialising the
get→push→set rmw + ANALYTICS_UPDATE broadcast through a module-level promise
chain lock; (2) a wire-payload leak in `telemetry-collector._runFlush` resolved
by an explicit 9-field `wireEvents` projection inserted before
`JSON.stringify({events})` — the in-memory `attempts` retry counter no longer
reaches the server's 9-field allowlist gate.

## What changed

### Commit 1: `c6fb1f1` — Recorder concurrency lock

`extension/utils/mcp-metrics-recorder.js`
- Added module-level `_recordLock = Promise.resolve()` plus `_withRecordLock(fn)`
  helper that mirrors the proven `_flushLock` / `_withLock` pattern from
  `telemetry-collector.js:142-150`. Both branches of `.then(fn, fn)` route to
  the same handler so a rejection does not skip the next caller; `.catch` on
  the assignment side keeps the chain alive.
- Refactored `recordDispatch` to wrap ONLY the storage rmw + broadcast block
  inside `await _withRecordLock(async function () { ... })`. All synchronous
  setup (input validation, label coercion, token estimate, pricing lookup, row
  assembly) stays OUTSIDE the lock — it has no shared state.
- Broadcast still fires INSIDE the locked region, AFTER the `set()`, so per-row
  Control Panel hero refresh ordering matches storage-write order.
- Outer never-throw try/catch preserved unchanged.
- `_recordLock` / `_withRecordLock` are intentionally NOT exported.

`tests/extension-record-dispatch-serializes.test.js` (NEW)
- Deliberately racy chrome.storage.local shim with `setImmediate`-deferred
  `get()`/`set()` AND deep-clone semantics on read (matches real
  chrome.storage.local serialisation — without this, both writers share the
  same array reference and the race "self-heals" silently, yielding a false
  negative).
- Fires 20 `recordDispatch` calls via `Promise.all` against the racy shim.
- Asserts: 20 rows persisted (no loss), every row source='mcp' with numeric
  ts, 20 broadcasts fired with canonical type, broadcast #i observes
  `_store.fsbUsageData.length >= i+1` at fire time (storage-write ordering
  preserved).
- Authoritative: verified to FAIL on the legacy code path (1/20 rows
  recorded; broadcast misorder at index 1) and PASS on the fixed code
  (7/7 assertions, exit 0).

### Commit 2: `2e514c1` — Wire-payload projection + package.json wiring

`extension/utils/telemetry-collector.js`
- Inserted a `wireEvents` projection immediately above the `fetchFn(...)`
  call in `_runFlush()`. The for-loop (index `w` to avoid shadowing the
  surrounding `i`/`s`/`r`) walks `snapshot` and pushes a NEW object with
  EXACTLY the 9 ALLOWED_EVENT_KEYS per event — explicit per-field copy,
  no spread, no `Object.assign(row)`. Object-literal key order mirrors
  the server's `ALLOWED_EVENT_FIELDS` Set at
  `showcase/server/src/routes/telemetry.js:41-44` for code-review clarity.
- Changed `body: JSON.stringify({ events: snapshot })` →
  `body: JSON.stringify({ events: wireEvents })`. Verified via grep:
  `events: snapshot` no longer appears anywhere.
- Projection is READ-ONLY over `snapshot`. The in-memory queue retains
  `attempts` so `_bumpAttempts` + `_applyAttemptsCap` continue to function
  unchanged on POST failure. `snapshotIds` (the post-POST residue removal
  driver) is unchanged.

`tests/telemetry-collector-strips-internal-fields.test.js` (NEW)
- Mirrors `telemetry-collector.test.js` harness verbatim (`passAssert*`,
  `freshRequire`, `makeShim`, `makeFetchShim`, `makeIdentityShim`,
  `wireShims`).
- Scenario A (wire shape): queue seeded with 2 events bearing
  `attempts: 2`. After `flush()`, asserts (a) exactly 1 POST issued,
  (b) `body.events.length === 2`, (c) each event's `Object.keys().sort()`
  deep-equals the alphabetically-sorted 9-key allowlist, (d) NO `attempts`
  key in any event.
- Scenario B (in-memory queue retention): same shape with fetch returning
  500. After flush, asserts the residue queue still holds the event with
  the SAME event_id and `attempts` bumped 2 → 3 — proves the projection is
  read-only and `_bumpAttempts` still sees the in-memory field. Also
  re-asserts the wire body had no `attempts` even on the failure path.
- Authoritative: verified to FAIL on the legacy code path (5 of 15
  assertions fail in Scenarios A+B's wire-shape checks; exit 1) and PASS
  on the fixed code (15/15 assertions, exit 0).

`package.json`
- One-line edit inside `scripts.test`: inserted
  `&& node tests/telemetry-collector-strips-internal-fields.test.js`
  IMMEDIATELY AFTER the existing `telemetry-collector.test.js` anchor, and
  `&& node tests/extension-record-dispatch-serializes.test.js`
  IMMEDIATELY AFTER the existing `telemetry-payload-allowlist.test.js`
  anchor. The `showcase-csp-allows-github-api.test.js` anchor the
  orchestrator mentioned is NOT present on origin/main; the
  telemetry-cluster fallback specified in the plan was used.
- No version, manifest, description, or other field touched.

## Verification

### Authoritative test runs (each new test was stash-verified)

| Test                                                            | Legacy code | Fixed code | Authoritative |
| --------------------------------------------------------------- | ----------- | ---------- | ------------- |
| `tests/extension-record-dispatch-serializes.test.js`            | FAIL exit 1 (1/20 rows recorded; broadcast misorder) | PASS exit 0 (7/7 assertions) | YES |
| `tests/telemetry-collector-strips-internal-fields.test.js`      | FAIL exit 1 (5 of 15 wire-shape assertions fail)     | PASS exit 0 (15/15 assertions)| YES |

### Full in-scope regression sweep (post-fix)

All 7 tests exit 0:

| Test                                                            | Result            |
| --------------------------------------------------------------- | ----------------- |
| `tests/mcp-metrics-recorder.test.js`                            | 88 passed, 0 failed |
| `tests/mcp-metrics-no-pii-leak.test.js`                         | PASS (banned-pattern scan clean) |
| `tests/telemetry-collector.test.js`                             | 71 passed, 0 failed |
| `tests/telemetry-payload-allowlist.test.js`                     | PASS (allowlist + banned-pattern scan clean) |
| `tests/server-telemetry-allowlist.test.js`                      | 15 passed, 0 failed |
| `tests/extension-record-dispatch-serializes.test.js`            | 7 passed, 0 failed  |
| `tests/telemetry-collector-strips-internal-fields.test.js`      | 15 passed, 0 failed |

Note: `tests/server-telemetry-allowlist.test.js` requires `better-sqlite3` from
`showcase/server/node_modules`. The worktree did not have those deps installed;
I ran `npm --prefix showcase/server install --no-audit --no-fund` once
locally to populate them (the directory is gitignored so no working-tree
change resulted). CI runs install these as part of `npm --prefix showcase/server install`.

### Plan acceptance gates

- **Bug-1 race fixed:** `node tests/extension-record-dispatch-serializes.test.js` exits 0
  on the fixed code; exits 1 on the legacy code (verified by stash-pop test).
- **Bug-2 wire-leak fixed:** `node tests/telemetry-collector-strips-internal-fields.test.js`
  exits 0; POST body keys equal the 9 allowlisted keys per event, no `attempts`;
  in-memory queue retains `attempts` after failed POST (scenario B).
- **No existing regression:** All 7 tests above pass.
- **No scope creep:** `git diff --stat 68a3807..HEAD` lists exactly 5 paths
  (the 5 expected files).
- **Atomic review-friendly history:** 2 commits atop 68a3807; commit subjects
  match plan exactly; neither contains `Co-Authored-By`.
- **No server-side change:** `git diff 68a3807..HEAD -- showcase/server/` is empty (0 lines).
- **No version/manifest churn:** `git diff 68a3807..HEAD -- package.json` is a
  single-line change inside the `scripts.test` value.

## Deviations from plan

**None.** Plan executed exactly as written. The plan's contingency for the
`showcase-csp-allows-github-api.test.js` anchor was triggered (the anchor is
not on origin/main yet; PR #52's branch only), so the telemetry-cluster
fallback was used as specified by the plan.

## Commit option chosen

**Option A** per plan Task 3 step 4 / orchestrator constraint: Task 3
(package.json wiring) was folded INTO the Task 2 commit (`2e514c1`).
Final commit count = 2 (matching the orchestrator's "two atomic commits
expected" target).

## Branch state

- Branch: `worktree-agent-a40373724e4e7073f` (per-agent worktree branch)
- Base: `68a3807`
- 2 new commits, working tree clean
- NOT pushed; PR creation handled by the orchestrator

## Self-Check: PASSED

- Commit `c6fb1f1` exists in `git log --oneline` ✓
- Commit `2e514c1` exists in `git log --oneline` ✓
- `extension/utils/mcp-metrics-recorder.js` contains `_recordLock` (7 references) ✓
- `extension/utils/telemetry-collector.js` contains `wireEvents` (3 references) ✓
- `extension/utils/telemetry-collector.js` no longer contains `events: snapshot` (0 occurrences) ✓
- `tests/extension-record-dispatch-serializes.test.js` exists (215 lines) ✓
- `tests/telemetry-collector-strips-internal-fields.test.js` exists (258 lines) ✓
- `package.json` references both new tests exactly once each ✓
- No `Co-Authored-By` in either commit message ✓
- All 7 in-scope regression tests exit 0 ✓
