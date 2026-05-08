---
plan: 253-01
phase: 253-clawhub-pre-publish-qa-user-gated-publish
status: complete
date: 2026-05-08
requirements: [PUB-01, PUB-02, PUB-03]
---

# Plan 253-01 Summary: ClawHub Pre-Publish QA + Build + Publish Docs

## What was built

Three deliverables:

1. **Pre-publish QA pass** at `.planning/v0.9.61-CLAWHUB-PUBLISH-QA.md` recording all 7 gates with explicit `[OK]` / `[USER-GATED]` / `[DOCUMENTED]` markers + a recovery section. Local gates passed clean: name collision (`clawhub inspect fsb` -> "Skill not found"), secret grep (zero leaked credentials, only descriptive prose matches), invisible-unicode scan (zero hits). Server-side gates (VirusTotal, ClawScan, GitHub account-age >= 7 days) fire when the user runs `clawhub publish`.

2. **Reproducible build script** `scripts/package-skill.mjs` + `npm run package:skill` wiring in root `package.json`. Reads version from SKILL.md frontmatter, zips `skills/FSB Skill/` into `dist/skill/FSB-Skill-<version>.zip` (verified output: 23473 bytes, 12+ files), excludes `.DS_Store`, `node_modules`, `.git`. Reproducible via `zip -X -r -q`.

3. **User-gated publish documentation** added to `mcp/README.md` `### OpenClaw` section. Documents `npm run package:skill` and the publish sequence (`clawhub login` -> `clawhub publish "skills/FSB Skill"`). References the QA doc.

## Verification

- Local QA gates ran clean (see QA doc for evidence).
- `npm run package:skill` succeeds; artifact exists at `dist/skill/FSB-Skill-0.9.61.zip`.
- `package.json` has `"scripts.package:skill"` field wired.
- `mcp/README.md` mentions `package:skill`, `clawhub publish`, and the QA doc.
- Phase 251 test still passes (ASCII-only enforcement preserved across all skill artifacts).

## User-gated next step

```
clawhub login
clawhub publish "skills/FSB Skill"
```

Autonomous mode does NOT run this. Mirrors v0.9.60 `npm publish fsb-mcp-server@0.8.0` user-gating pattern.

## Self-Check: PASSED

- All 3 PUB-XX requirements satisfied with concrete artifacts.
- No skill content changes, no test changes, no actual publish run.

## Files

- `.planning/v0.9.61-CLAWHUB-PUBLISH-QA.md` (NEW)
- `scripts/package-skill.mjs` (NEW)
- `package.json` (MODIFIED -- one-line `"package:skill"` script added)
- `mcp/README.md` (MODIFIED -- one paragraph added under `### OpenClaw`)
- `dist/skill/FSB-Skill-0.9.61.zip` (BUILD ARTIFACT)
