---
phase: 261-i18n-scaffold
plan: 03
subsystem: showcase-angular
tags: [eslint, i18n, ci, two-step-activation]
requirements: [CI-03]
requirements_addressed: [CI-03]
dependency_graph:
  requires:
    - "Plan 261-02 (@angular/localize devDep + polyfills array entry + i18n block in angular.json)"
  provides:
    - "ESLint v9 flat config infrastructure for showcase/angular"
    - "@angular-eslint/template/i18n rule wired at severity error with checkId/checkText/checkAttributes = true"
    - "npm run lint:i18n script (runnable, not yet a CI gate)"
  affects:
    - "showcase/angular/package.json (devDeps + scripts)"
    - "showcase/angular/package-lock.json"
    - "showcase/angular/eslint.config.js (new file)"
tech_stack:
  added:
    - "eslint@^9.39.4"
    - "typescript-eslint@^8.59.3"
    - "angular-eslint@^20.7.0"
    - "(transitive) @angular-eslint/eslint-plugin@^20.7.0"
    - "(transitive) @angular-eslint/eslint-plugin-template@^20.7.0"
    - "(transitive) @angular-eslint/template-parser@^20.7.0"
  patterns:
    - "ESLint v9 flat config (CommonJS module.exports + tseslint.config() helper)"
    - "Two-step activation: Phase 261 ships rule + script; Phase 262 promotes to CI hard-block"
key_files:
  created:
    - "showcase/angular/eslint.config.js"
  modified:
    - "showcase/angular/package.json"
    - "showcase/angular/package-lock.json"
decisions:
  - "Used verbatim Pattern 5 from RESEARCH.md (lines 443-475) for eslint.config.js -- CommonJS, two rule blocks (TS + HTML), explicit option flags for self-documentation"
  - "Two-step activation honored: rule configured but lint:i18n script is NOT added to CI in Plan 03; Plan 04 explicitly excludes lint:i18n from its CI wiring; Phase 262 promotes after string marking"
  - "Script name locked at 'lint:i18n' (with colon) for Phase 262 CI step to reference by exact name"
metrics:
  duration: "approximately 2 minutes wall-clock (npm install dominated by network)"
  tasks: 3
  files_changed: 3
  commits: 3
  start: "2026-05-12T13:12:53Z"
  end: "2026-05-12T13:14:55Z"
  completed: "2026-05-12T13:14:55Z"
---

# Phase 261 Plan 03: ESLint i18n Rule Wiring (Two-Step Activation) Summary

ESLint v9 flat config wired with `@angular-eslint/template/i18n` rule at severity `error` and locked options (`checkId: true`, `checkText: true`, `checkAttributes: true`), shipped alongside an `npm run lint:i18n` script that runs the rule against `src/**/*.html` -- honoring the CONTEXT-locked two-step activation (rule installed and runnable in Phase 261, CI promotion deferred to Phase 262 after string marking).

## What Shipped

### Task 1: Install ESLint v9 + typescript-eslint + angular-eslint as devDependencies

- Installed three packages via `npm install --save-dev` from `showcase/angular/`:
  - `eslint@^9.39.4` (resolved; flat config host)
  - `typescript-eslint@^8.59.3` (resolved; required peer of `angular-eslint@20`)
  - `angular-eslint@^20.7.0` (Angular-20-aligned meta package; pulls plugin + plugin-template + template-parser transitively)
- 111 packages added net (transitive plugin deps included).
- Verified all three landed in `devDependencies` (not `dependencies`).
- Verified transitive plugin resolution: `require.resolve('@angular-eslint/eslint-plugin-template')` and `require.resolve('@angular-eslint/template-parser')` both succeed from `showcase/angular/`.
- Plan 02 artifacts (`@angular/localize@^20.3.19` devDep, `@angular/localize/init` polyfills entry) unchanged.
- Commit: `e2f78cf`

### Task 2: Create eslint.config.js with @angular-eslint/template/i18n rule

- New file at `showcase/angular/eslint.config.js`, written verbatim from RESEARCH.md Pattern 5 (lines 443-475).
- CommonJS (`module.exports = tseslint.config(...)`).
- Two rule blocks:
  - `**/*.ts`: extends `eslint.configs.recommended` + `tseslint.configs.recommended` + `angular.configs.tsRecommended`; declares `processor: angular.processInlineTemplates` so inline `@Component({ template: '...' })` strings are still scanned by template rules.
  - `**/*.html`: extends `angular.configs.templateRecommended`; declares `@angular-eslint/template/i18n` at severity `error` with all three locked options (`checkId: true`, `checkText: true`, `checkAttributes: true`) -- explicit even though defaults match, for in-source documentation of the CI-03 lock.
- File header references Phase 261 / CI-03 and cites the angular-eslint flat-config guide.
- Verified loadability: `require('./eslint.config.js')` returns an array (10 blocks after `tseslint.config()` expansion).
- Commit: `9728c41`

### Task 3: Add lint:i18n script to package.json

- Added `"lint:i18n": "eslint \"src/**/*.html\""` to `showcase/angular/package.json` scripts (preserves the inner glob quoting required so the shell does not pre-expand).
- All seven pre-existing scripts byte-identical: `ng`, `start`, `prebuild`, `build`, `test`, `smoke:crawler`, `serve:ssr:showcase-angular`.
- NO generic `lint` script added (two-step activation per CONTEXT lock; only the i18n-specific script ships in Phase 261).
- Ran `npm --prefix showcase/angular run lint:i18n` -- exit code `1`, **704 errors** all from `@angular-eslint/template/i18n`. Rule is wired correctly and surfaces the expected unmarked-string violations across the showcase HTML templates and `src/index.html`. This is the GREEN-LIGHT signal per Pitfall 4: Phase 262 drives this count to zero by marking strings.
- Plan 03 commits did NOT modify `.github/workflows/ci.yml` (verified via `git log e2f78cf^..HEAD --name-only`). The worktree's separate unstaged change to ci.yml comes from parallel Plan 04 (Wave 2), which explicitly excludes `lint:i18n` from its CI wiring per the locked CONTEXT decision.
- Commit: `93e7478`

## Verification Results

| # | Check | Outcome |
|---|-------|---------|
| 1 | `node -e "const p=require('./showcase/angular/package.json'); console.log(p.devDependencies['eslint'], p.devDependencies['typescript-eslint'], p.devDependencies['angular-eslint']);"` | `^9.39.4 ^8.59.3 ^20.7.0` |
| 2 | `node -e "const cfg=require('./showcase/angular/eslint.config.js'); console.log(cfg.length, 'config blocks');"` | `10 config blocks` (flat-config expansion is expected; HTML block with the i18n rule confirmed present) |
| 3 | `node -e "const p=require('./showcase/angular/package.json'); console.log(p.scripts['lint:i18n']);"` | `eslint "src/**/*.html"` |
| 4 | `npm --prefix showcase/angular run lint:i18n` exit code | `1` (non-zero) -- output mentions `@angular-eslint/template/i18n` (704 occurrences) |
| 5 | `git log e2f78cf^..HEAD --name-only` includes `.github/workflows/ci.yml` | NO -- Plan 03 commits did not touch CI workflow |

All five pass.

## Lint Violation Snapshot (informational; Phase 262 drives to zero)

- Total errors: **704** (704 errors, 0 warnings) -- all from `@angular-eslint/template/i18n`.
- 567 errors are `--fix`-eligible (the rule offers an auto-fix that scaffolds `i18n` attributes; Phase 262 may use this as a starting point rather than hand-marking).
- Distribution spans component templates under `src/app/` and `src/index.html` (head meta + footer link `rel` attributes).
- The two error sub-types observed:
  - "Each element containing text node should have an i18n attribute." (visible-string coverage)
  - "Attribute X has no corresponding i18n attribute." (attribute coverage, e.g., `content`, `rel`)
- Full log captured at `/tmp/261-03-lint.log` during execution (ephemeral; not committed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted Task 2 verification logic (config-file content unchanged)**
- **Found during:** Task 2 verification step
- **Issue:** The plan's verification one-liner used `cfg.find(b => b.files && b.files.includes('**/*.html'))` to locate the HTML block. After `tseslint.config()` flattens the `extends: [...angular.configs.templateRecommended]` chain, three blocks match `files: ['**/*.html']` (the three blocks emitted by `angular.configs.templateRecommended` plus our final rule block). `.find()` returns the first match, which is NOT the one holding our `@angular-eslint/template/i18n` rule -- so the naive script reports a false negative.
- **Fix:** Switched the verification finder to `htmlBlocks.filter(...).find(b => b.rules && b.rules['@angular-eslint/template/i18n'])` to locate the specific block holding our rule. Result: rule present with severity `error` and options `{checkId:true, checkText:true, checkAttributes:true}` -- exactly as the locked CI-03 spec requires.
- **Files modified:** None (the eslint.config.js file content was already correct -- it is the verbatim Pattern 5 from RESEARCH.md). Only the verification approach was corrected.
- **Commit:** N/A (no file change; verification reasoning logged in this Summary)

## Authentication Gates

None encountered.

## Forward References

- **Phase 262 (Marketing Strings + Locale-Aware Shell)** will mark every visible string with `i18n` / `@@id` attributes, driving the `lint:i18n` violation count from 704 to 0.
- **Phase 262 (or the phase that finishes string marking)** will add `npm --prefix showcase/angular run lint:i18n` as a CI step in `.github/workflows/ci.yml`, promoting the rule from "runnable" to "blocking" -- closing the CI-03 invariant fully.
- **Phase 265 exit** flips `i18nMissingTranslation` from `warning` to `error` per CI-04 (separate from the ESLint rule; runtime translation policy).

## Plan 02 Regression Check

| Plan 02 artifact | State after Plan 03 |
|------------------|---------------------|
| `@angular/localize@^20.3.19` in devDependencies | Present, unchanged |
| `@angular/localize/init` in `polyfills` array of `angular.json` | Present, unchanged |
| `i18n` block on `projects.showcase-angular` in `angular.json` | Untouched |
| `src/locale/messages.*.xlf` seed files | Untouched |

No Plan 02 regressions.

## CI Workflow Posture

`.github/workflows/ci.yml` is NOT modified by Plan 03. The worktree may show ci.yml as modified during/after the Wave 2 window because parallel Plan 04 owns the CI-wiring scope (lockfile-aware npm install + verify-locale-sync.mjs + verify-bundle-budgets.mjs steps) and explicitly excludes `lint:i18n` per the two-step activation lock. Verification scoped to Plan 03 commits: `git log e2f78cf^..HEAD --name-only` does not list `.github/workflows/ci.yml`.

## Self-Check: PASSED

Verified after writing this SUMMARY:

- File `showcase/angular/eslint.config.js` exists (created by Task 2).
- File `showcase/angular/package.json` exists and contains `"lint:i18n"` script.
- Commit `e2f78cf` exists (Task 1 -- chore(261-03): add eslint v9 + typescript-eslint + angular-eslint devDeps).
- Commit `9728c41` exists (Task 2 -- feat(261-03): add eslint.config.js with @angular-eslint/template/i18n rule).
- Commit `93e7478` exists (Task 3 -- feat(261-03): add lint:i18n script invoking eslint on src/**/*.html).
- Plan 03 commits did not modify `.github/workflows/ci.yml`.
