---
plan: 252-01
phase: 252-repo-integration-doc-updates
status: complete
date: 2026-05-08
requirements: [INTEG-01, INTEG-02, INTEG-03, INTEG-04]
---

# Plan 252-01 Summary: Repo Integration & Doc Updates

## What was built

Five mechanical edits across five files making the FSB OpenClaw skill discoverable from every existing entry point an FSB user is likely to read first.

## Files modified

- **README.md** (INTEG-01):
  - Quick Start TL;DR: added a callout paragraph mentioning the FSB skill at `skills/FSB Skill/` for OpenClaw users; explains the doctor flow, stdio printer, and consent-gated multi-host install.
  - Repository Layout table: added a new row above showcase: `[skills/FSB Skill/](./skills/FSB%20Skill/SKILL.md) | OpenClaw skill: doctor + stdio printer + consent-gated multi-host install.`
- **mcp/README.md** (INTEG-02):
  - Added a new `### OpenClaw` paragraph in the Supported Clients section pointing OpenClaw users at `skills/FSB Skill/`. Notes that `--openclaw` install flag stays manual / unsupported because OpenClaw's MCP config schema is unstable; skill prints + user pastes, never auto-writes.
- **mcp/src/install.ts** (INTEG-03):
  - OpenClaw block in `getSetupSections()` (lines ~412-425) updated. Replaced "manual / unsupported for now" with three new content blocks: canonical install (skill load), status of `--openclaw` flag, manual stdio fallback line still references `STDIO_COMMAND` constant (line 28).
- **showcase/angular/public/llms.txt** (INTEG-04):
  - Added a 2-sentence paragraph after the MCP-layer mention pointing at the FSB skill as the canonical OpenClaw onboarding path.
- **showcase/angular/scripts/llms-full.source.md** + **showcase/angular/public/llms-full.txt** (INTEG-04):
  - Added a new `### OpenClaw skill` subsection in the source markdown with full context (frontmatter shape, never auto-writes, `requires.env: []`).
  - Regenerated `public/llms-full.txt` via `node showcase/angular/scripts/build-crawler-files.mjs` so the prerendered file matches.

## Verification

- All 5 files contain literal `skills/FSB Skill/` (verified via grep).
- Phase 251 test still passes: `node tests/skill-fsb-spec.test.js` -> 48 PASS, 0 FAIL.
- ASCII-only enforcement preserved across edited markdown files.
- No emojis added.
- `mcp/src/install.ts` STDIO_COMMAND constant still referenced (line 28 + new fallback line in OpenClaw block).

## Self-Check: PASSED

- Each of the 4 INTEG-XX requirements satisfied with concrete edits.
- No regressions in skill-fsb-spec test.
- Anti-scope honored: no skill content changes, no test changes, no publish prep.

## Files

- `README.md` (MODIFIED)
- `mcp/README.md` (MODIFIED)
- `mcp/src/install.ts` (MODIFIED)
- `showcase/angular/public/llms.txt` (MODIFIED)
- `showcase/angular/scripts/llms-full.source.md` (MODIFIED)
- `showcase/angular/public/llms-full.txt` (REGENERATED)
