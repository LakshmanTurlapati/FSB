# Phase 213-02 Deferred Items

Out-of-scope discoveries surfaced during 213-02 execution. NOT fixed by this
plan; logged here per the GSD scope-boundary rule.

## Pre-existing failures in `tests/runtime-contracts.test.js`

**Discovered:** 2026-04-29 during Phase 213-02 plan-level verification

**Status:** PRE-EXISTING at base commit `65dd7669` (parent worktree HEAD before
any 213-02 edits). Reproduced by checking out the pre-edit `background.js` and
re-running the test -- identical 7/7 fail count. Not caused by the 213-02
runtime-action additions.

**Failing assertions (7):**

1. `createSessionHooks still instantiates SessionStateEmitter` -- expects
   `var emitter = new SessionStateEmitter();` somewhere in `background.js`
2. `tool progress hook still uses SessionStateEmitter` -- expects
   `createToolProgressHook(emitter)` in `background.js`
3. `iteration progress hook still uses SessionStateEmitter` -- expects
   `createIterationProgressHook(emitter)`
4. `completion progress hook still uses SessionStateEmitter` -- expects
   `createCompletionProgressHook(emitter)`
5. `error progress hook still uses SessionStateEmitter` -- expects
   `createErrorProgressHook(emitter)`
6. `createSessionHooks JSDoc matches the narrowed return contract` -- expects
   `@returns {{ hooks: HookPipeline }}`
7. `popup still consumes sessionStateEvent` -- expects
   `case 'sessionStateEvent':` in `ui/popup.js`

**Why deferred:** Out-of-scope for 213-02 (no overlap with the SYNC-02 runtime
contracts; the failing assertions cover `state-emitter.js` /
`hook-pipeline.js` plumbing that has been refactored separately and is not
referenced by Phase 213). A future maintenance plan should either:

- update `tests/runtime-contracts.test.js` assertions to reflect the current
  `background.js` / `popup.js` shape, OR
- restore the missing `SessionStateEmitter` plumbing if the refactor was
  unintentional.

**213-02 impact:** None. The new `tests/sync-tab-runtime.test.js` exits 0
(14 passed, 0 failed). The pre-existing `runtime-contracts.test.js` failures
predate this plan and would surface in `npm test` regardless of 213-02.
