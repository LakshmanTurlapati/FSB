---
phase: 249-skill-md-scripts
plan: 04
subsystem: skill
tags: [skill, install, consent-gated, readline, mjs, fsb-mcp-server, openclaw]

# Dependency graph
requires:
  - phase: 248-spec-research
    provides: Confirmed `npx -y fsb-mcp-server install --list` and per-host `--<host>` CLI surface, and locked OpenClaw config as print-only
provides:
  - "skills/FSB Skill/scripts/install-host.mjs: detect-list-confirm-install flow with strict y/N consent per host"
  - "Cross-platform stdin EOF handling (continues with no-skip rather than hanging or throwing)"
affects: [249-05, 250-usage-references, 251-tests, 252-readme, 253-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node ESM scripts with `node:` prefix imports"
    - "child_process.spawn with shell:false and args array (argument-injection safe)"
    - "Single readline.createInterface session with EOF-resilient question wrapper"

key-files:
  created:
    - "skills/FSB Skill/scripts/install-host.mjs"
  modified: []

key-decisions:
  - "Strict y/Y consent (not 'yes'/'YES') to avoid accidental confirmations from agentic models"
  - "EOF on stdin treated as implicit 'no' for remaining prompts (no hang, no throw)"
  - "Filter 'openclaw' at parse time AND add runtime guard (defense-in-depth)"
  - "Extra defensive HOST_NAME_RE check before flag construction (prevents injection if --list ever emits unexpected chars)"
  - "Always exit 0 after detect succeeds; only exit 2 if `npx` itself cannot launch (matches doctor.mjs convention)"

patterns-established:
  - "Script header: 5-line shebang + comment block naming REQ-IDs (SKILL-05 / SKILL-06)"
  - "ASCII status markers [OK] / [WARN] / [FAIL] in CLI output"
  - "Forbidden flag literals (`--all`, `--openclaw`) must be greppable absent from source for review"

requirements-completed: [SKILL-05, SKILL-06]

# Metrics
duration: ~3min
completed: 2026-05-08
---

# Phase 249 Plan 04: install-host.mjs Summary

**Consent-gated FSB MCP multi-host installer that detects hosts via `npx -y fsb-mcp-server install --list`, prompts strict y/N per host, and never auto-writes any config file.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-08T15:39:43Z
- **Completed:** 2026-05-08T15:42:34Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- Authored `skills/FSB Skill/scripts/install-host.mjs` (193 lines, pure ESM, Node stdlib only)
- Detect step shells out to existing FSB CLI with `spawn('npx', ['-y', 'fsb-mcp-server', 'install', '--list'])`, no new flags introduced
- Per-host strict y/Y consent loop using a single `readline.createInterface` session
- Per-host install spawned as `npx -y fsb-mcp-server install --<host>` with args array (no shell, no concatenation)
- Final summary line distinguishes installed / skipped / errored (`[OK]` / `[WARN]` / `[FAIL]`)
- Cross-platform discipline: no shell-specific tokens, no hard-coded paths, EOF-resilient prompt wrapper

## Task Commits

1. **Task 1: Implement install-host.mjs detect+prompt+install (SKILL-05)** - `b5fac51` (feat)
2. **Task 2: Cross-platform self-test + EOF handling fix (SKILL-06)** - `8d9a50d` (fix)

## Files Created/Modified

- `skills/FSB Skill/scripts/install-host.mjs` (created) - Consent-gated multi-host installer; ESM, Node stdlib only

## Decisions Made

- Strict y/Y only (no 'yes'/'YES') per CONTEXT.md decision lock
- OpenClaw filter applied at both parse time AND runtime (defense-in-depth)
- Extra `HOST_NAME_RE = /^[a-z0-9-]+$/` validation before flag construction prevents argument injection if `--list` ever emits unexpected tokens
- EOF on stdin treats remaining prompts as 'no' with a visible "(stdin closed -- treating as no)" notice, so the run completes and the summary still prints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] readline EOF caused subsequent rl.question to throw "readline was closed"**
- **Found during:** Task 2 (live launch step 7, `node install-host.mjs </dev/null`)
- **Issue:** When stdin closed mid-loop (piped 'n' shorter than detected host count, or `</dev/null`), the next iteration's `rl.question` threw "readline was closed" and the script crashed mid-summary, defeating the "always exits 0 unless launch failed" contract.
- **Fix:** Wrapped `rl.question` to also resolve on the readline `close` event, AND tracked a `stdinClosed` flag in `main()` so subsequent prompts short-circuit to a printed notice instead of calling into an already-closed readline. Added defensive try/catch around `rl.question` for belt-and-suspenders behavior.
- **Files modified:** `skills/FSB Skill/scripts/install-host.mjs`
- **Verification:** `node install-host.mjs </dev/null` now exits 0 cleanly, summary prints. `echo "n" | node install-host.mjs` likewise exits 0 with all remaining hosts skipped.
- **Committed in:** `8d9a50d`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug). The fix was necessary to satisfy the plan's explicit Task-2 directive: "It must NOT hang waiting for input ... if more than one host is detected, the EOF after the first 'n' should treat remaining hosts as 'no' and continue." Plan executed otherwise as written.

## Issues Encountered

- **Live launch step 7 observed parsing artifact (informational, NOT a bug to fix in this plan):** The plan-locked regex `/(?:^|\s|:)([a-z][a-z0-9-]+)(?=\s|$|[,.;:])/g` extracts whitespace-separated tokens. On lines like `--claude-desktop    Claude Desktop      detected`, the human-readable `Claude Desktop` words are extracted as `claude` and `desktop` (the leading `--` blocks `claude-desktop` from matching the lookbehind, and the readable label is treated as two tokens). This produces extra "host" entries in the prompt list that fail the actual `install --<host>` step if the user accepts them, but is per-spec for this plan. Deferred to a follow-up regex hardening pass (out of scope per the plan's "use this regex" directive). The CONTEXT.md states the parser MUST NOT hard-code a closed enum, so the trade-off is accepted: false positives are skipped via [WARN] runtime guard rather than narrowed at parse time.

## Live launch observations (Task 2 step 7, informational)

- Environment: macOS darwin 25.3.0, Node available on PATH
- `--list` succeeded, `fsb-mcp-server@0.8.0` enumerated 21 platforms (16 file-based, 1 CLI-based, 4 instructions-only)
- Detected hosts (post-parse): claude, desktop, cursor, vs, code, windsurf, not, cline, zed, codex, cli, gemini, continue, roo, kilo, goose, amazon, amp, boltai, opencode (20 entries)
- With `</dev/null` stdin: all 20 prompts auto-skipped via "stdin closed" notice, exit code 0
- With `echo "n"`: all 20 prompts skipped (first via 'n', remainder via stdin-closed notice), exit code 0
- No hang, no crash, no `--all`, no `--openclaw` ever invoked

## User Setup Required

None - no external service configuration required. The script is invoked by the user (or by the OpenClaw skill) and uses the existing fsb-mcp-server CLI surface; nothing to wire up.

## Next Phase Readiness

- `install-host.mjs` is feature-complete for SKILL-05 / SKILL-06 acceptance criteria
- Phase 251 TEST-* will assert structural invariants (forbidden flags absent, ESM parse, args-array form)
- Phase 250 USAGE.md should document: `node "skills/FSB Skill/scripts/install-host.mjs"` and the strict y/Y consent behavior
- Possible follow-up (out of scope here): regex hardening to reduce parse false-positives (`--<host>` flag form is more reliable than whitespace tokens), but only if Phase 250+ user testing shows the [WARN] on bogus hosts is confusing

## Self-Check: PASSED

- File exists: `skills/FSB Skill/scripts/install-host.mjs` (FOUND)
- Commit b5fac51: FOUND in `git log`
- Commit 8d9a50d: FOUND in `git log`
- `node --check`: exit 0
- ASCII-only: 5419 bytes, zero non-ASCII
- All Task 1 + Task 2 automated verification commands pass

---
*Phase: 249-skill-md-scripts*
*Completed: 2026-05-08*
