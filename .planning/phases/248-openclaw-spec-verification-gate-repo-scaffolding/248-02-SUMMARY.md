---
phase: 248-openclaw-spec-verification-gate-repo-scaffolding
plan: 02
subsystem: scaffolding
tags: [scaffold, skill, openclaw, placeholder]
requirements:
  - SCAFFOLD-05
dependency_graph:
  requires: []
  provides:
    - "skills/FSB Skill/ skeleton (4 placeholders) for Phases 249-250 to author against"
  affects:
    - "Phase 249 can author SKILL.md frontmatter and scripts/*.mjs"
    - "Phase 250 can author USAGE.md and references/*.md"
tech_stack:
  added: []
  patterns:
    - "One-line README placeholders instead of .gitkeep (per 248-CONTEXT.md)"
    - "Phase-marker convention: every placeholder names the future phase that fills it"
key_files:
  created:
    - "skills/FSB Skill/SKILL.md"
    - "skills/FSB Skill/USAGE.md"
    - "skills/FSB Skill/references/README.md"
    - "skills/FSB Skill/scripts/README.md"
  modified: []
decisions:
  - "Used one-line README placeholders (not .gitkeep) -- discoverable, self-documenting, sortable next to real Markdown"
  - "SKILL.md has NO YAML frontmatter -- frontmatter authoring is explicitly Phase 249's job"
  - "No top-level skills/FSB Skill/README.md created -- SKILL.md placeholder serves that role"
metrics:
  duration: "~3 minutes"
  completed: 2026-05-08
  tasks: 2
  files_created: 4
  files_modified: 0
---

# Phase 248 Plan 02: Repo Scaffolding -- skills/FSB Skill/ Skeleton Summary

Created the empty-but-committed `skills/FSB Skill/` skeleton at the repo top level with placeholder SKILL.md, USAGE.md, references/README.md, and scripts/README.md so Phases 249 and 250 can author against a known directory shape.

## What Was Built

A four-file structural skeleton at `skills/FSB Skill/` (literal space in directory name, sibling to `extension/`, `mcp/`, `showcase/`, `server/`). Each placeholder contains a single ASCII heading and a one-line "filled in Phase NNN" marker so anyone scanning the tree mid-milestone understands the staging.

### Directory Tree

```
skills/FSB Skill/
  SKILL.md                  -- placeholder; frontmatter authored in Phase 249
  USAGE.md                  -- placeholder; 3-step install authored in Phase 250
  references/
    README.md               -- placeholder; reference files authored in Phase 250
  scripts/
    README.md               -- placeholder; .mjs scripts authored in Phase 249
```

`git ls-files "skills/FSB Skill/"` confirms exactly four tracked files; no `.gitkeep`, no `package.json`, no `plugin.json`, no top-level skill README.

## Tasks Completed

| Task | Name                                                                       | Commit  | Files                                                                |
| ---- | -------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| 1    | Create `skills/FSB Skill/` skeleton + SKILL.md and USAGE.md placeholders   | 3c7fb35 | skills/FSB Skill/SKILL.md, skills/FSB Skill/USAGE.md                 |
| 2    | Add one-line README placeholders to references/ and scripts/ subdirectories | db1699d | skills/FSB Skill/references/README.md, skills/FSB Skill/scripts/README.md |

## Acceptance Evidence (grep-verifiable)

All 10 success-criteria checks pass:

1. `test -d "skills/FSB Skill"` -- OK
2. All four placeholder files exist -- OK
3. Each placeholder contains its `filled in Phase NNN` marker:
   - SKILL.md -> `filled in Phase 249`
   - USAGE.md -> `filled in Phase 250`
   - references/README.md -> `filled in Phase 250`
   - scripts/README.md -> `filled in Phase 249`
4. SKILL.md does NOT begin with `---` (no YAML frontmatter; Phase 249 owns this)
5. Zero non-ASCII bytes across all four files (perl regex check returns 0 matches)
6. No `package.json`, `plugin.json`, or `openclaw.plugin.json` inside `skills/FSB Skill/`
7. No `.gitkeep` files anywhere in the new tree
8. No top-level `skills/FSB Skill/README.md`
9. `git ls-files "skills/FSB Skill/"` shows exactly 4 entries (the four placeholders)
10. CI chain unaffected: no `package.json` and no test files added inside the skill folder, so `npm test` has no new path by which it could break

### First-line headings (verified exact match)

```
# FSB Skill -- placeholder
# FSB Skill USAGE -- placeholder
# references/ -- placeholder
# scripts/ -- placeholder
```

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Flags

None. This plan adds only placeholder text files at a new top-level directory; no new network endpoints, auth paths, file-access changes, or schema changes at trust boundaries.

## Handoff for Downstream Phases

The skeleton is committable and ready for parallel future work:

- **Phase 249 (SKILL.md + scripts):** Can overwrite `skills/FSB Skill/SKILL.md` with verified OpenClaw frontmatter authored against `.planning/v0.9.61-OPENCLAW-SPEC.md`, and drop `doctor.mjs`, `print-stdio.mjs`, `install-host.mjs` into `skills/FSB Skill/scripts/` (replacing or keeping the README placeholder per Phase 249's discretion).
- **Phase 250 (USAGE.md + references):** Can overwrite `skills/FSB Skill/USAGE.md` with the 3-step install / try-it / recovery doc, and add `tool-decision-tree.md`, `multi-agent-contract.md`, `restricted-tab-recovery.md`, `default-to-fsb.md`, `vault-boundary.md`, plus the visual-session lifecycle reference into `skills/FSB Skill/references/`.

The skeleton is the structural lock that lets Phases 249 and 250 proceed.

## Self-Check: PASSED

Files verified to exist:
- FOUND: skills/FSB Skill/SKILL.md
- FOUND: skills/FSB Skill/USAGE.md
- FOUND: skills/FSB Skill/references/README.md
- FOUND: skills/FSB Skill/scripts/README.md

Commits verified to exist:
- FOUND: 3c7fb35 (Task 1: SKILL.md + USAGE.md)
- FOUND: db1699d (Task 2: references/README.md + scripts/README.md)
