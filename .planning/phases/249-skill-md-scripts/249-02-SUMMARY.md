---
phase: 249-skill-md-scripts
plan: 02
subsystem: skill
tags: [skill, doctor, layered-diagnostics, cross-platform, mjs, child-process, spawn]

# Dependency graph
requires:
  - phase: 248-skill-foundation
    provides: scaffolded `skills/FSB Skill/scripts/` directory with placeholder README
provides:
  - `skills/FSB Skill/scripts/doctor.mjs` -- Node ESM dispatcher wrapping `npx -y fsb-mcp-server doctor`
  - Layered branch summary with [OK]/[FAIL]/[WARN] markers and one-line next-step
  - Documented exit-code contract (0 ok, 1 known-layer-fail, 2 launch-fail, 3 unparseable)
affects: [249-03 print-stdio.mjs, 249-04 install-host.mjs, 250 USAGE.md, 251 skill spec tests, 252 README integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Node ESM `.mjs` script with `#!/usr/bin/env node` shebang
    - `child_process.spawn` (shell:false) for streaming subprocess output
    - Cross-platform npx invocation without `cmd /c` shimming
    - ASCII-only CLI markers `[OK]` / `[FAIL]` / `[WARN]`
    - Layered-diagnostics anchor parsing (prefer explicit `Layer:` line over heuristics)

key-files:
  created:
    - "skills/FSB Skill/scripts/doctor.mjs"
  modified: []

key-decisions:
  - "Anchor on doctor's explicit `Layer: <name>` line first; line-by-line failure-marker scan only as fallback (prevents false matches from verbose `[FSB Bridge ...]` runtime logs)."
  - "Skip lines starting with `[fsb bridge` prefix during the heuristic pass to keep future bridge log noise from masquerading as a `bridge`-layer failure."
  - "Use `shell: false` and let Node resolve `npx` cross-platform via PATHEXT on Windows; no `cmd /c` shimming."
  - "Stream stdout/stderr through unchanged so user still sees raw doctor output, then append a fenced summary block (`--- FSB skill doctor summary ---`)."
  - "Exit codes are meaningful and documented at the top of the file: 0=ok, 1=known-layer-fail, 2=launch-fail, 3=unparseable."

patterns-established:
  - "Pattern: Skill scripts wrap CLI tools with structured branch summaries -- raw output plus fenced [OK]/[FAIL]/[WARN] line and a single concrete next-step (URL or command)."
  - "Pattern: Parse layered diagnostics via the producer's own explicit anchor first, fall back to substring heuristics only when anchor missing."
  - "Pattern: Cross-platform Node ESM scripts use `import` syntax, `node:` prefixed stdlib imports, and `shell:false` spawn -- no .sh/.cmd siblings."

requirements-completed:
  - SKILL-03
  - SKILL-06

# Metrics
duration: ~30min
completed: 2026-05-08
---

# Phase 249 Plan 02: scripts/doctor.mjs Summary

**Node ESM dispatcher that spawns `npx -y fsb-mcp-server doctor`, streams the raw output through, then appends a focused [OK]/[FAIL]/[WARN] branch with a single concrete next-step (Chrome Web Store URL, `status --watch`, or `install --<host>`).**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-08T15:35:00Z (approx)
- **Completed:** 2026-05-08T15:42:00Z (approx)
- **Tasks:** 2 (Task 1 implementation + Task 2 cross-platform self-test)
- **Files modified:** 1 (one new file: `skills/FSB Skill/scripts/doctor.mjs`)

## Accomplishments

- New executable `skills/FSB Skill/scripts/doctor.mjs` (157 lines, ASCII-only ESM) that:
  - Spawns `npx -y fsb-mcp-server doctor` via `child_process.spawn` (shell:false) and streams stdout/stderr through unchanged.
  - Parses six layered diagnostics (`package`, `bridge`, `extension`, `active-tab`, `content-script`, `config`) plus the `ok` happy path.
  - Emits a fenced summary block `--- FSB skill doctor summary ---` followed by a `[OK]/[FAIL]/[WARN]` line and a one-line next-step pointing at concrete URLs / commands (Chrome Web Store URL, `status --watch`, `install --<host>`).
  - Handles ENOENT (missing `npx`) via `child.on('error', ...)` and exits with code 2 + a launch-failure hint.
  - Documents and enforces a 4-state exit code contract (0 / 1 / 2 / 3).
- Cross-platform discipline verified: ESM only, no shell-specific tokens, no hard-coded OS paths, ENOENT handler present, all four contract exit codes present.
- Live smoke launch on the executor machine confirmed end-to-end behavior: doctor ran, parser correctly identified failing layer = `config` (matching the doctor's own `Layer: config` line), wrapper printed the fenced summary + `[FAIL] failing layer: config` + `install --<host>` next-step, and exited 1.

## Task Commits

Tasks were committed atomically. Task 2 is a non-mutating self-test gate; its only commit is the parser-fix bug it surfaced (logged as a Rule 1 deviation against Task 1's file).

1. **Task 1: Implement doctor.mjs spawn + capture + layer parser** -- `22fad34` (feat)
2. **Task 2: Cross-platform self-test for doctor.mjs (SKILL-06)** -- no-mutation gate; exposed parser bug fixed in `e31cfc3` (fix, Rule 1)

**Final docs commit (SUMMARY.md):** pending after self-check

## Files Created/Modified

- `skills/FSB Skill/scripts/doctor.mjs` -- new Node ESM dispatcher wrapping `fsb-mcp-server doctor`. Stable interface: zero CLI args, exit codes 0/1/2/3, fenced `--- FSB skill doctor summary ---` block on stdout.

## Decisions Made

- **Explicit-anchor-first parser:** When the doctor emits `Layer: <name>` near the end of its output, that anchor wins over the substring + failure-marker heuristic. The heuristic is a fallback only. Rationale: live smoke testing showed verbose `[FSB Bridge ...]` runtime logs contained both `bridge` and `error` substrings on the same line, which faked a `bridge`-layer match even when the doctor's own `Layer:` line said `config`. Anchoring on the producer's explicit value eliminates this class of false positive.
- **`[fsb bridge` prefix skip:** The heuristic pass now skips lines starting with the literal `[fsb bridge` prefix to keep future bridge log noise from masquerading as a `bridge`-layer failure.
- **No shell wrapping:** Use `spawn('npx', ['-y', 'fsb-mcp-server', 'doctor'], { shell: false })`. Node resolves `npx` via PATHEXT on Windows automatically; `cmd /c` shimming would be both unnecessary and a cross-platform foot-gun.
- **Streaming + buffered:** Pipe each stdout/stderr chunk straight to `process.stdout` / `process.stderr` for user visibility, AND buffer into `combined` for parsing. Best of both: raw output is preserved, summary is computed.
- **Exit code contract:** Documented at the top of the file as a 4-line comment block. OpenClaw / future tooling can rely on these without parsing the textual summary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Layer parser misclassified `config` failure as `bridge` due to runtime log noise**

- **Found during:** Task 2, step 5 (live launch dry-run smoke test) -- this is exactly what the smoke test is for.
- **Issue:** The original line-by-line scan returned the first `<layer-keyword>` + `<failure-marker>` co-occurrence on the same line. The FSB bridge subsystem emits verbose runtime logs like `[FSB Bridge a0d56fee] << Response: mcp:get-tabs ... success=false error="AGENT_NOT_REGISTERED"`, which contains both `bridge` (lowercased from `Bridge`) and `error`. The parser fired on that line and reported `bridge`, even though the doctor's own summary line at the bottom said `Layer: config`.
- **Fix:** Added a Pass 0 to `parseFailingLayer()` that anchors on the doctor's own explicit `Layer: <name>` line via `/(^|\s)layer:\s*([a-z\-]+)/`, with the substring heuristic as a Pass 1 fallback. Pass 1 also now skips lines starting with the literal `[fsb bridge` prefix as belt-and-suspenders against future bridge log noise.
- **Files modified:** `skills/FSB Skill/scripts/doctor.mjs` (parseFailingLayer function only)
- **Verification:** Re-ran live smoke launch; wrapper now correctly emits `[FAIL] failing layer: config` matching the doctor's reported `Layer: config`. All Task 1 + Task 2 static checks still pass.
- **Committed in:** `e31cfc3` (fix, Rule 1)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was essential for the wrapper to correctly point users at the right next-step. Discovered through Task 2's live smoke test (exactly the contract for that step). No scope creep -- fix is local to the existing `parseFailingLayer()` function.

## Issues Encountered

- macOS BSD `grep` does not support `-P` (PCRE), so the in-plan automated verifier line that used `LC_ALL=C grep -P "[^\x00-\x7F]"` exits with usage error rather than reliably detecting non-ASCII. Worked around by running the same check via `python3` byte scan; result confirmed ASCII-only at 5734 bytes. The in-plan verifier line will pass on Linux/CI where GNU `grep -P` is available.

## Smoke Test Outcome (Task 2 step 5, informational)

- Environment: macOS (Darwin 25.3.0), Node 18+ on PATH, FSB extension reachable on the local machine, doctor reports configuration layer not yet set up.
- First wrapper line: `[FAIL] failing layer: config`
- Exit code: `1` (matches contract -- known layer failed)
- Branch summary correctly fenced and rendered after raw doctor output.

## User Setup Required

None -- no external service configuration required for this plan. The script itself surfaces user setup hints (via the next-step recommendations) when the doctor reports a non-`ok` layer.

## Next Phase Readiness

- `scripts/doctor.mjs` is wired up and verified live; ready to be referenced from SKILL.md's doctor-first protocol (Phase 248 SKILL.md body) and from `references/restricted-tab-recovery.md` (Phase 250).
- Plan 249-03 (`scripts/print-stdio.mjs`) and 249-04 (`scripts/install-host.mjs`) are unblocked.
- The exit-code contract documented at the top of the file (0/1/2/3) is the stable interface that Phase 251 spec tests will assert against.

## Self-Check: PASSED

- FOUND: `skills/FSB Skill/scripts/doctor.mjs`
- FOUND: `.planning/phases/249-skill-md-scripts/249-02-SUMMARY.md`
- FOUND commit: `22fad34` (Task 1: implement doctor.mjs spawn + capture + layer parser)
- FOUND commit: `e31cfc3` (Rule 1 fix: anchor parser on doctor's explicit `Layer:` line)
- ASCII-only verified on both `doctor.mjs` (5734 bytes) and `249-02-SUMMARY.md` (9750 bytes).
- All Task 1 structural checks pass (shebang, ESM import, six layer keywords, [OK]/[FAIL]/[WARN], Web Store URL, status --watch, install --, no `require(`, no `execSync`).
- All Task 2 cross-platform checks pass (no `cmd.exe`/`powershell`/`bash`/`sh -c`, no `/usr/`/`/bin/`/`C:\\`/`D:\\` paths, ENOENT handler present, all four `process.exit(0|1|2|3)` calls present).
- Live smoke launch verified: doctor wrapper correctly reported `[FAIL] failing layer: config` with exit code 1.

---
*Phase: 249-skill-md-scripts*
*Plan: 02*
*Completed: 2026-05-08*
