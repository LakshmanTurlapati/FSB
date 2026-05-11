# Phase 258 Deferred Items

Out-of-scope discoveries surfaced while executing Plan 258-02 (version bump 0.8.0 -> 0.9.0).

## 2026-05-11 -- mcp/build/install.js drift unrelated to version bump

**Discovered during:** Plan 258-02 Task 2 (`cd mcp && npm run build`).

**What:** The rebuild step regenerated `mcp/build/install.js` and the resulting diff is NOT the version bump. The diff is pure copy text in the OpenClaw section of `getSetupSections()` -- a few lines that look like they came from earlier work on `mcp/src/install.ts` (canonical install via skills/FSB Skill/, consent-gated install for other detected MCP hosts, manual stdio fallback). The source `mcp/src/install.ts` evidently changed in a prior commit but the build was never rerun + committed, so the next `npm run build` (this plan's) picked up the source-to-build drift.

**Diff (head only):**
```
-                'Status: manual / unsupported for now.',
+                'Canonical install: load the FSB skill from skills/FSB Skill/ in this repo.',
...
+                'Manual stdio fallback (if you cannot use the skill):',
+                '  ' + STDIO_COMMAND,
```

**Disposition:** Out of Plan 258-02 scope (this plan is strictly the version bump). The install.js drift is left unstaged for now -- a future plan owning the install copy work should:
1. Verify the install.ts source already carries the new copy (it must, because the build emits it).
2. Stage and commit `mcp/build/install.js` so source + build are in sync.
3. Tag the commit against whichever plan/phase owns the install copy change.

**Verification command:** `cd /Users/lakshmanturlapati/Desktop/FSB && git diff mcp/build/install.js | head -40` reproduces the unrelated drift.

**Why not auto-fixed by this plan:** Per Plan 258-02 scope boundary (only metadata + parity test), and per the GSD SCOPE BOUNDARY rule (only auto-fix issues DIRECTLY caused by the current task's changes). The install.js drift pre-dates the rebuild; it was unstaged at the start of the session (`M mcp/build/install.js` appeared in the initial git status). It is logged here so a future plan owner can pick it up.
