---
phase: quick-260514-r6i
plan: 01
subsystem: showcase-server
tags: [csp, content-security-policy, github-api, stats-easter-egg, regression-guard]
status: complete
dependency_graph:
  requires:
    - "/stats Easter-egg page (quick-260514-1nv) + GitHubStatsService"
  provides:
    - "Production CSP connect-src directive that permits https://api.github.com so browser-side fetches from /stats succeed"
    - "tests/showcase-csp-allows-github-api.test.js -- Node-only regression guard wired into root npm test chain"
  affects:
    - "showcase/server/server.js (single directive + 8 comment lines)"
    - "package.json (1-token insertion into scripts.test chain, adjacent to showcase-build-smoke)"
tech_stack:
  added: []
  patterns:
    - "Text-parse-only regression test (no Express boot, no HTTP) -- mirrors showcase-build-smoke layer-3 invariant style"
key_files:
  created:
    - "tests/showcase-csp-allows-github-api.test.js"
  modified:
    - "showcase/server/server.js"
    - "package.json"
decisions:
  - "Single host on connect-src (api.github.com) -- not a wildcard, not *.github.com. The /stats page only calls https://api.github.com/repos/LakshmanTurlapati/FSB/... so adding raw.githubusercontent.com or other GitHub hosts would widen attack surface without benefit."
  - "Browser-direct fetch retained over server-side proxy. GitHub public-read endpoints return `access-control-allow-origin: *` and orchestrator pre-verified totals fit within MAX_PAGES=2, so no proxy needed. Proxy was explicitly out of scope per orchestrator (would be a phase, not a quick task)."
  - "Test text-parses showcase/server/server.js rather than booting Express. Avoids port allocation, listener cleanup, and async timing issues -- the invariant is a source-level CSP directive, so a source-level assertion is the right granularity."
  - "Test wired immediately AFTER showcase-build-smoke.test.js in scripts.test so both showcase text-parse tests run together. Easy to spot in CI logs as a grouped showcase block."
  - "Defense-in-depth assertion #6 (no bare `*`, no `data:`) added so accidentally widening connect-src to permit everything -- e.g., during a future debugging episode -- fails CI loud, not silent."
metrics:
  duration_min: 6
  completed_at: "2026-05-14T19:24:00Z"
commits:
  - hash: "a70d550"
    message: "fix(showcase-csp): allow api.github.com in connect-src so /stats charts can fetch"
---

# Quick Task 260514-r6i: Fix Showcase CSP to Unblock /stats GitHub Charts Summary

A one-directive change to the showcase Express server's Content-Security-Policy so the `/stats` Easter-egg page's browser-side `fetch()` calls to `https://api.github.com/repos/LakshmanTurlapati/FSB/...` are no longer blocked by the browser. Ships with a Node-only regression test (6 assertions) wired into the root `npm test` chain alongside the existing showcase-build-smoke text-parse test.

## What shipped

### Final diff (3 files, ~10 lines of net production change)

**Created (1):**
- `tests/showcase-csp-allows-github-api.test.js` (~110 lines) — text-parses `showcase/server/server.js`, locates the `SHOWCASE_CSP` array literal via regex, extracts the `connect-src` directive, asserts it contains BOTH `'self'` AND `https://api.github.com`, and rejects bare `*` / `data:` widening as defense-in-depth. Exits 0 with 6 PASSes on the new state.

**Modified (2):**
- `showcase/server/server.js` — line 67: `"connect-src 'self'"` → `"connect-src 'self' https://api.github.com"`. Lines 52–59: appended an 8-line explanatory paragraph to the existing CSP comment block that names the consumer (`GitHubStatsService`) and points to the regression test, so a future tightening sees the rationale BEFORE editing.
- `package.json` — `scripts.test` chain: inserted ` && node tests/showcase-csp-allows-github-api.test.js` immediately after the `showcase-build-smoke.test.js` invocation. One token change, exactly one occurrence (`grep -c` = 1), adjacency confirmed by `grep -oE "showcase-build-smoke.test.js && node tests/showcase-csp-allows-github-api.test.js"`.

### Why this fix

Production CSP header on `https://full-selfbrowsing.com/stats` was:

```
Content-Security-Policy: ... connect-src 'self' ...
```

Every browser-side `fetch('https://api.github.com/repos/LakshmanTurlapati/FSB/...')` from `GitHubStatsService` was rejected by the browser BEFORE the request even hit the network — symptom: the GitHub-stats card on `/stats` shows no data (orchestrator-verified via `curl -D - https://full-selfbrowsing.com/stats`). After the fix, the directive permits exactly one external host (`api.github.com`), which is the only host the /stats page calls. GitHub's public-read endpoints serve `access-control-allow-origin: *`, so no server-side proxy is needed — this is a pure CSP allowance.

## Verification

### Standalone test run

```
$ node tests/showcase-csp-allows-github-api.test.js
--- showcase-csp-allows-github-api (quick task 260514-r6i) ---
  PASS: showcase/server/server.js exists and is readable
  PASS: SHOWCASE_CSP array literal is present
  PASS: connect-src directive present in SHOWCASE_CSP
  PASS: connect-src directive contains 'self'
  PASS: connect-src directive contains https://api.github.com
  PASS: connect-src does not permit bare `*` wildcard or data: scheme

=== showcase-csp-allows-github-api results: 6 passed, 0 failed ===
exit=0
```

### Task 1 source-level checks

- `grep -n "connect-src" showcase/server/server.js` → 2 lines (1 comment at line 52, 1 directive at line 67). No leftover `'self'`-only entry.
- `grep -c "api.github.com" showcase/server/server.js` → 2 (one in the new comment block, one in the SHOWCASE_CSP array entry).
- `node -e "new Function(fs.readFileSync('showcase/server/server.js','utf8'))"` → `OK` (file still parses as valid JavaScript; the array literal wasn't broken).

### Task 2 wiring checks

- `grep -c "tests/showcase-csp-allows-github-api.test.js" package.json` → 1 (single occurrence in the chain; no accidental duplication).
- `grep -oE "showcase-build-smoke.test.js && node tests/showcase-csp-allows-github-api.test.js" package.json` → 1 match (adjacency confirmed; correct insertion point with `&&` glue intact).
- `node -e "require('./package.json').scripts.test.includes('showcase-csp-allows-github-api.test.js')"` → `OK` (JSON parses; new test is in the test script).

### Full regression sweep

Ran `SKIP_BUILD=1 npm test` (full chain, ~108 test files) — **exit 0, no FAIL lines anywhere**. Key observations:
- New test: **6 passed, 0 failed**.
- Adjacent text-parse test `showcase-build-smoke`: **130 passed, 0 failed** (the Easter-egg crawler invariants — no `/stats` in `prerender-routes.txt`, `public/sitemap.xml`, `public/llms.txt`, `public/llms-full.txt` — all green).
- No test in the chain was structurally affected by the `package.json` insertion (the chain is just a long `&&` chain of `node` invocations; an extra clause does not perturb others).

The `SKIP_BUILD=1` flag skips only the heavy Angular production build inside `showcase-build-smoke` (~30–90s). All source-level invariants (i18n + crawler-invisibility) still run and pass.

## /stats Easter-egg invariant: confirmed intact

This quick task touches only the CSP header on the showcase server. It does NOT modify any crawler-facing file:

- `showcase/angular/prerender-routes.txt` — unchanged, no `/stats`.
- `showcase/angular/public/sitemap.xml` — unchanged, no `/stats`.
- `showcase/angular/public/llms.txt` — unchanged, no `/stats`.
- `showcase/angular/public/llms-full.txt` — unchanged, no `/stats`.
- Angular `dist/.../stats` prerendered directory — still does NOT exist.

Verified by the unchanged `showcase-build-smoke.test.js` continuing to pass (130/130) inside the `npm test` run.

## Out-of-scope items honored (per orchestrator)

- Did **not** raise `MAX_PAGES` in `github-stats.service.ts` (verified safe at 2 by orchestrator diagnostics).
- Did **not** add a `/api/github-stats/*` server-side proxy (would be a phase, not a quick task).
- Did **not** add a comments chart UI (user meant commits — `commit-over-time` view already exists).
- Did **not** touch the `cors()` middleware (line 81 of server.js) — unrelated to CSP and stays unchanged.
- Did **not** modify any other CSP directive (`script-src`, `img-src`, `frame-src`, etc.) — single-directive edit.

## Deviations from plan

**None — plan executed exactly as written.** The diff matches the plan's "single directive edit + one comment paragraph in `showcase/server/server.js`, one new test file, one `&&`-chain insertion in `package.json`" success criterion verbatim.

One non-task environmental step occurred during verification: the worktree was freshly created without `mcp/node_modules` and `showcase/server/node_modules` populated, so `npm test` failed early in the chain on `tsc: command not found` and `Cannot find module 'better-sqlite3'`. Resolved by running `npm install` inside `mcp/` and `showcase/server/` (lockfiles unchanged in scope; the spurious `mcp/package-lock.json` version-string sync from 0.8.0 → 0.9.0 was reverted via `git checkout`). This is a pre-existing worktree-setup issue, not a regression caused by this task. The committed diff contains only the 3 task files.

## Post-deploy production smoke (user-gated)

After `main` deploys via the existing Fly.io workflow (no manual action needed — the showcase server change triggers `flyctl deploy --remote-only`), run:

```bash
curl -D - https://full-selfbrowsing.com/stats -o /dev/null 2>&1 | grep -i content-security-policy
```

Expected: the `Content-Security-Policy` header now contains `connect-src 'self' https://api.github.com`. The `/stats` charts (cumulative stars, weekly stars, issues, forks, PRs, commits-over-time, maintenance) should populate with data on the next 5-minute poll cycle.

## Self-Check: PASSED

- File `showcase/server/server.js` modified, line 67 now reads `"connect-src 'self' https://api.github.com",` — VERIFIED via `grep -n`.
- File `tests/showcase-csp-allows-github-api.test.js` created — VERIFIED via `ls` + standalone `node` run (6 passed).
- File `package.json` modified, `scripts.test` includes the new test exactly once adjacent to showcase-build-smoke — VERIFIED via `grep -c` and `grep -oE`.
- Commit `a70d550` exists on branch `worktree-agent-a2103e5877c40c368` — VERIFIED via `git log --oneline`.
- Full `npm test` chain exits 0 — VERIFIED, no FAIL lines.
