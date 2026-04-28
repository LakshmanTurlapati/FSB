# Phase 211 Deferred Items

Discoveries logged during Phase 211 execution that are out of scope for the
current phase. Per the GSD scope-boundary rule, only failures DIRECTLY caused
by a task's changes are auto-fixed; pre-existing failures in unrelated files
are deferred.

## Pre-existing npm test failures (out of scope for Phase 211)

Discovered during Phase 211-01 execution while running `npm test` to verify
the new `tests/ws-client-decompress.test.js` integrates cleanly. The new test
itself passes (6/6 assertions). Seven pre-existing failures in unrelated
runtime contract tests were observed on the main branch BEFORE any Phase 211
edits (verified by git stash + re-run). They live in the
`tests/runtime-contracts.test.js` file (background contract cleanup +
direct consumer boundary sections) and check that `background.js` /
`ui/popup.js` have removed legacy `SessionStateEmitter` / `sessionStateEvent`
plumbing -- work that was scoped to v0.9.40 cleanup but landed only
partially:

- FAIL: createSessionHooks still instantiates SessionStateEmitter
- FAIL: tool progress hook still uses SessionStateEmitter
- FAIL: iteration progress hook still uses SessionStateEmitter
- FAIL: completion progress hook still uses SessionStateEmitter
- FAIL: error progress hook still uses SessionStateEmitter
- FAIL: createSessionHooks JSDoc matches the narrowed return contract
- FAIL: popup still consumes sessionStateEvent

These failures touch `background.js` and `ui/popup.js`, which are NOT in
Phase 211's file scope (Phase 211 touches `ws/ws-client.js`,
`content/dom-stream.js`, dialog/message-delivery `.catch` sites, and a new
`utils/redactForLog.js`). Fixing these is a separate cleanup task for
either the milestone owner or a follow-up phase.

The new Phase 211-01 test (`tests/ws-client-decompress.test.js`) exits 0
in isolation and is correctly wired into the npm test chain.
