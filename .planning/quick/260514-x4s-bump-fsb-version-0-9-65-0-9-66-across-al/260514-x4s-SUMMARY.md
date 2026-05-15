---
phase: quick-260514-x4s
plan: 01
status: complete
date: 2026-05-15
---

# Summary: FSB version bump 0.9.65 → 0.9.66

Mechanical version bump across 8 user-visible surfaces. Zero scope drift.

## Files changed

| File | Refs bumped |
|------|-------------|
| `package.json` | 3 (version, zip filename, badge URL) |
| `extension/manifest.json` | 2 (name, version) |
| `README.md` | 3 (title, badge, status banner) |
| `extension/README.md` | 1 |
| `store-assets/chrome-web-store/listing-copy.md` | 1 (line 5; line 83 v0.9.69 milestone ref untouched) |
| `mcp/README.md` | 1 (line 534 cross-reference) |
| `showcase/angular/package.json` | 1 |
| `showcase/angular/package-lock.json` | 2 (top-level + packages[''].version) |

**Total:** 14 line changes, 8 files.

## Verification

- All 4 modified JSON files parse cleanly (`node -e "JSON.parse(...)"` exit 0).
- `tests/mcp-version-parity.test.js` → 10/10 PASS.
- `grep -rn "0\.9\.65"` across tracked source (excluding node_modules / .planning / dist / .git / .angular) returns zero residual hits.
- `mcp/src/version.ts` confirmed unchanged at `FSB_MCP_VERSION = '0.9.0'` (independent versioning preserved).
- `showcase/angular/src/app/core/seo/version.ts` not manually edited — will auto-regenerate from `extension/manifest.json` on next showcase build.

## Commit

`7758deb` `chore(release): bump version 0.9.65 -> 0.9.66`

No Co-Authored-By trailer (per user's global CLAUDE.md rule).

## Mirrors

Prior commit `858e692` (0.9.64 → 0.9.65) — identical file set and diff shape.
