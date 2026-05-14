---
phase: quick-260514-pu4
plan: 01
status: complete
date: 2026-05-14
---

# Summary: CI showcase deps wire-up (v0.9.69 PR readiness)

## What changed

One edit to `.github/workflows/ci.yml` — added two install steps to the `extension` job so the expanded `npm test` chain (which now includes ~30 v0.9.69 tests that require showcase/server or showcase/angular deps) can find its dependencies on a fresh GitHub Actions runner.

**Before** the `extension` job had: root deps install → mcp deps install → validate extension → `npm test`.

**After**: root deps install → mcp deps install → **showcase/server deps install → showcase/angular deps install** → validate extension → `npm test`.

## Verification

- `npm test` local exit 0 (regression check passed after the YAML edit).
- `grep -c "npm --prefix showcase/server install" .github/workflows/ci.yml` → 1 (the new line, in the extension job).
- `grep -c "npm --prefix showcase/angular install" .github/workflows/ci.yml` → 2 (one new in extension, one pre-existing in website).
- The mcp-smoke and website jobs are unchanged.

## v0.9.69 deploy + DB readiness (verify-only confirmations for milestone-close PR)

These items were validated but required NO code changes:

| Concern | State | Why no change needed |
|---|---|---|
| Fly.io volume + DB path | `fly.toml` already has `[mounts] source='fsb_data' destination='/data'` and env `DB_PATH=/data/fsb-data.db`. | Pre-existing volume from prior milestones; new tables auto-create. |
| New SQLite tables (telemetry_events, _rollups_daily, _global_aggregates, _daily_salt) | `showcase/server/src/db/schema.js` uses `CREATE TABLE IF NOT EXISTS` for all 4 + indexes. | Schema is additive; first server boot after Refinements→main merge creates them. |
| Dockerfile picks up new deps | `npm ci` against both `showcase/angular/package.json` (now includes chart.js@^4.5.1) and `showcase/server/package.json` (now includes express-rate-limit@^8.3.0) in their respective build stages; native build tools (python3, make, g++) already present for better-sqlite3. | Lockfiles are committed; npm ci is deterministic. |
| Deploy trigger | `.github/workflows/deploy.yml` triggers on push to `main` with paths-ignore for .planning/*, *.md, tests/*, .gitignore. Production code paths trigger deploy. | When Refinements merges to main, the showcase/* changes will trigger `flyctl deploy --remote-only`. |
| CI checks on PR | `.github/workflows/ci.yml` runs on `pull_request: branches: [main]`. The 3 jobs (extension, mcp-smoke, website) gate the `all-green` check that's required for merge. With this CI fix, the extension job will run the full ~108-file `npm test` chain including all 30 new v0.9.69 tests. | Standard PR gating; v0.9.69 telemetry tests now properly validated on every PR to main. |

## Ready for next steps (user-gated)

1. `git push origin Refinements` — pushes the 89 commits (88 milestone + 1 CI fix).
2. `git push origin v0.9.69` — pushes the tag (currently at d343243 just BEFORE the chart.js fix at ca7d64f and this CI fix). Consider re-tagging at HEAD: `git tag -d v0.9.69 && git tag -a v0.9.69 -m "..." <HEAD>` so the tag includes the regression fixes.
3. Open PR `Refinements` → `main` via `gh pr create`. The body should reference:
   - 8 phases (269-276) shipped
   - 67/68 requirements Complete + STREAM-03 partial (human-gated by design)
   - All 3 release-gating BLOCKERs resolved (B1 trust proxy, B2 express-rate-limit CVE, B3 CWS listing)
   - Audit: `tech_debt` (Phase 274 + 276 await browser-repro verification)
   - CI extension job now installs showcase deps so PR checks validate all v0.9.69 changes
4. Once `all-green` passes, merge → triggers `flyctl deploy` → telemetry server live at `full-selfbrowsing.com/api/telemetry/*`.
5. CWS Developer Dashboard click-through (Privacy Practices tab) per `.planning/phases/275-…/275-VERIFICATION.md` `<human_verification>`.

## Files

- `.github/workflows/ci.yml` — 2 lines added.
