---
phase: 250-usage-md-references-policy
plan: 04
subsystem: skills/FSB Skill
tags: [skill, references, visual-session, policy-03, lifecycle]
requires: [skills/FSB Skill/SKILL.md (Phase 249 SKILL-02 body content)]
provides:
  - skills/FSB Skill/references/visual-session-lifecycle.md (new lifecycle reference)
  - SKILL.md body pointer that resolves to the new file
affects: [POLICY-03 coverage]
tech-stack:
  added: []
  patterns: [progressive-disclosure references, try/finally close pattern]
key-files:
  created:
    - skills/FSB Skill/references/visual-session-lifecycle.md
  modified:
    - skills/FSB Skill/SKILL.md
decisions:
  - Added optional references/visual-session-lifecycle.md (CONTEXT decision: recommend yes for completeness)
  - Single-sentence rewrite of SKILL.md visual-session paragraph; zero other body changes
  - Frontmatter (lines 1-12) byte-identical to Phase 249 SKILL-02 output
metrics:
  duration: ~6 minutes
  completed: 2026-05-08
  tasks: 2
  files: 2
requirements: [POLICY-03]
---

# Phase 250 Plan 04: Visual Session Lifecycle Reference Summary

POLICY-03 coverage closed by adding `references/visual-session-lifecycle.md` (open/close pairing rule, try/finally pattern, error-path close coverage) and rewriting one sentence in the SKILL.md "Visual session wrapping" paragraph so its `references/` pointer resolves to a concrete filename.

## Files

### Created

- `skills/FSB Skill/references/visual-session-lifecycle.md` (64 lines)

### Modified

- `skills/FSB Skill/SKILL.md` (one-sentence rewrite in the "Visual session wrapping" body section; frontmatter and all other sections untouched)

## visual-session-lifecycle.md structure

64 lines, plain ASCII. Section outline:

1. `# Visual session lifecycle` (H1) + framing paragraph (orange-glow behavior, persistence-across-reloads warning).
2. `## The pairing rule` -- numbered 3-step list (open / run / close) + "One open => exactly one close. No exceptions." line.
3. `## Termination outcomes (always close)` -- markdown table mapping outcome to `reason` value (`complete`, `error`, `aborted`, `user_cancelled`).
4. `## Pattern: try/finally close` -- canonical pseudocode in fenced block + multi-turn close-deferral note.
5. `## Error-path close coverage` -- bulleted list naming typed multi-agent errors (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`), restricted-tab failures, user cancel, model self-abort, network/bridge disconnect.
6. `## Anti-patterns` -- two `[BAD]/[GOOD]` callouts: missing close (orange glow stuck) and missing `reason` field.
7. `## See also` -- cross-links to SKILL.md, multi-agent-contract.md, restricted-tab-recovery.md.

## SKILL.md edit (exact one-sentence diff)

BEFORE (last sentence of "## Visual session wrapping" body section):

> Lifecycle details and recovery steps live in `references/`.

AFTER (replacement):

> Lifecycle details, the try/finally close pattern, and error-path close coverage live in `references/visual-session-lifecycle.md`.

That is the only change to SKILL.md in this plan.

## POLICY-03 coverage confirmation

REQUIREMENTS.md POLICY-03 (verbatim):

> "SKILL.md body includes the visual-session wrapping rule: any external-AI-driven sequence opens with start_visual_session(client=\"OpenClaw\", ...) and closes with end_visual_session(session_token=..., reason=...); references/ link covers the lifecycle in detail."

Coverage evidence:

- SKILL.md body still contains (Phase 249 SKILL-02 content):
  > Any external-AI-driven sequence opens with `start_visual_session(client="OpenClaw", ...)` and closes with `end_visual_session(session_token=..., reason=...)`.
- SKILL.md body now points explicitly at the lifecycle file:
  > Lifecycle details, the try/finally close pattern, and error-path close coverage live in `references/visual-session-lifecycle.md`.
- `references/visual-session-lifecycle.md` exists and covers:
  - Open/close pairing rule (numbered 3 steps + "One open => exactly one close. No exceptions.").
  - Try/finally close pattern (canonical pseudocode).
  - Error-path close coverage (typed errors, restricted tabs, user cancel, model abort, bridge disconnect).
  - Anti-patterns showing the orange-glow-stuck failure mode.

## Anti-scope adherence

- Frontmatter (`skills/FSB Skill/SKILL.md` lines 1-12) is byte-identical to Phase 249 SKILL-02 output: `name: FSB`, `description: ...`, `version: 0.9.61`, `user-invocable: true`, `requires.bins: [node, npx]`, `requires.env: []`, `homepage`, `metadata.openclaw`.
- Body sections "When to use FSB", "Doctor-first protocol", "Multi-agent contract", "Vault and credentials", "Scripts (run as needed)" are untouched.
- The bottom "## References (load on demand)" list still enumerates the original five reference files (tool-decision-tree, multi-agent-contract, restricted-tab-recovery, vault-boundary, default-to-fsb). visual-session-lifecycle.md is intentionally NOT added to that list -- the pointer to it lives in the visual-session-wrapping paragraph itself.
- No new scripts, no test changes, no README/USAGE.md edits.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Description                                                          | Commit  |
| ---- | -------------------------------------------------------------------- | ------- |
| 1    | docs(250-04): add references/visual-session-lifecycle.md             | b09b670 |
| 2    | docs(250-04): point SKILL.md visual-session paragraph at lifecycle   | 9615f54 |

## Verification

- `test -f "skills/FSB Skill/references/visual-session-lifecycle.md"` -> OK.
- `grep -F 'references/visual-session-lifecycle.md' "skills/FSB Skill/SKILL.md"` -> match found.
- `grep -F 'start_visual_session(client="OpenClaw"' "skills/FSB Skill/SKILL.md"` -> match found (Phase 249 content preserved).
- `grep -F 'end_visual_session(session_token=' "skills/FSB Skill/SKILL.md"` -> match found.
- `head -12 "skills/FSB Skill/SKILL.md"` -> confirms `version: 0.9.61` and `requires:` block intact.
- visual-session-lifecycle.md grep coverage: `start_visual_session`, `end_visual_session`, `session_token`, `try`, `error`, `orange` -- all present.
- Non-printable byte scan (`LC_ALL=C grep -c '[^[:print:][:space:]]'`) on both files: 0. Plain ASCII; zero emojis.

## Self-Check: PASSED

- File `skills/FSB Skill/references/visual-session-lifecycle.md`: FOUND.
- File `skills/FSB Skill/SKILL.md`: FOUND with required pointer.
- Commit b09b670: FOUND in `git log`.
- Commit 9615f54: FOUND in `git log`.
- Frontmatter byte-identical to Phase 249: confirmed (lines 1-12 unchanged).
- Zero emojis / non-ASCII: confirmed.
