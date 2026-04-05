---
phase: 105-package-distribution
verified: 2026-03-24T10:15:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "npx -y fsb-mcp-server downloads and starts the MCP server on a clean machine"
    status: partial
    reason: "Package has not been published to npm registry yet — no v* tag has been pushed. The CI/CD pipeline is fully wired and local artifacts are complete, but the published package does not exist on npmjs.com. Additionally, mcp-server/README.md does not exist (Phase 106 scope), so the files whitelist includes README.md but the file is absent from the pack output."
    artifacts:
      - path: ".github/workflows/publish-mcp.yml"
        issue: "Workflow exists and is correct, but NPM_TOKEN secret has not been configured in GitHub repo settings (manual prerequisite documented in 105-02-SUMMARY.md). No v* tag has been pushed, so no publish has run."
      - path: "mcp-server/README.md"
        issue: "File does not exist. Phase 106 (Documentation) is responsible for creating it. The files field in package.json lists README.md, but npm pack --dry-run confirms it is absent from the tarball."
    missing:
      - "Push a v* semver tag (e.g., v0.1.0) to trigger the GitHub Actions publish workflow"
      - "Configure NPM_TOKEN secret in GitHub repo settings before first tag push"
      - "After first publish, verify `npx -y fsb-mcp-server` executes on a clean machine"
      - "Create mcp-server/README.md (Phase 106 scope) so it is included in published tarball"
  - truth: "Requirements PKG-01, PKG-02, PKG-03, PKG-04, DIST-01, DIST-02, DIST-03 are defined in REQUIREMENTS.md"
    status: failed
    reason: "REQUIREMENTS.md only contains v0.9.9 Excalidraw requirements (ENGINE-*, DRAW-*, TEXT-*, etc.). None of PKG-01 through PKG-04 or DIST-01 through DIST-03 are defined anywhere in REQUIREMENTS.md. They are referenced only in ROADMAP.md and the phase PLAN frontmatter. The requirement IDs are orphaned -- they have no definition."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "Missing requirement definitions for PKG-01, PKG-02, PKG-03, PKG-04, DIST-01, DIST-02, DIST-03"
    missing:
      - "Add PKG-01 through PKG-04 and DIST-01 through DIST-03 definitions to REQUIREMENTS.md with descriptions and phase traceability"
human_verification:
  - test: "npx invocation after first publish"
    expected: "Running `npx -y fsb-mcp-server` on a clean machine (no local clone) downloads the package from npm and starts the MCP server without errors"
    why_human: "Package is not yet published to npm. Cannot verify actual npx download and execution behavior without a real published package."
  - test: "NPM_TOKEN secret configuration"
    expected: "GitHub repo Settings > Secrets and variables > Actions shows NPM_TOKEN configured"
    why_human: "Cannot inspect GitHub repository secret values programmatically."
---

# Phase 105: Package & Distribution Verification Report

**Phase Goal:** Users can install and run the FSB MCP server via `npx -y fsb-mcp-server` without cloning the repo
**Verified:** 2026-03-24T10:15:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `npm pack --dry-run` shows only build output files and README (no source, no dev artifacts) | VERIFIED | pack output lists 37 files: 35 under `build/` (.js, .d.ts, .js.map), plus `package.json`. No `src/` files, no `tsconfig.json`. README.md absent from pack (does not yet exist -- Phase 106 scope). |
| 2   | `node build/index.js` runs successfully with shebang at line 1 | VERIFIED | `head -1 build/index.js` returns `#!/usr/bin/env node`. Binary started, connected to relay hub, and shut down cleanly (exit 0) in smoke test. |
| 3   | `npm run prepublishOnly` compiles TypeScript without errors | VERIFIED | `npm run prepublishOnly` exits cleanly with no TypeScript errors. All 9 package.json metadata checks pass (version 0.1.0, MIT, files whitelist, prepublishOnly script, engines, repository, bin, name). |
| 4   | GitHub Actions workflow triggers on release tag and publishes to npm registry | VERIFIED | `.github/workflows/publish-mcp.yml` exists (47 lines), triggers on `v*` tag push, uses `working-directory: mcp-server`, runs `npm ci`, `npm run build`, shebang verification, pack dry-run, and `npm publish --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. No GitHub Release action present. |
| 5   | `npx -y fsb-mcp-server` downloads and starts the MCP server on a clean machine | PARTIAL | Local pipeline is complete and correct. However, the package has not been published to npm (no v* tag pushed, NPM_TOKEN secret not yet configured). The command cannot succeed until first publish occurs. mcp-server/README.md also does not exist yet (files whitelist references it but it is absent from tarball). |

**Score:** 4/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `mcp-server/package.json` | npm-publishable package metadata | VERIFIED | version 0.1.0, MIT license, author, repository with directory, 6 keywords, engines >=18.0.0, files whitelist `["build/","README.md"]`, prepublishOnly script `"tsc"`, bin `fsb-mcp -> build/index.js`, name `fsb-mcp-server` |
| `mcp-server/.npmignore` | npm publish exclusion rules | VERIFIED | 26 lines. Excludes `src/`, `tsconfig.json`, `.eslintrc*`, `.prettierrc*`, test files, IDE artifacts, `.env.*`, `*.tsbuildinfo` |
| `.github/workflows/publish-mcp.yml` | CI/CD pipeline for npm publishing | VERIFIED | 47 lines, all required steps present: checkout@v4, setup-node@v4 with node 20 and registry URL, npm ci, npm run build, shebang verify, pack dry-run verify, npm publish --access public |
| `mcp-server/build/index.js` | Compiled entry point with shebang | VERIFIED | Line 1 is `#!/usr/bin/env node`. File is 2.2kB, includes .d.ts and .js.map variants. |
| `mcp-server/README.md` | Package README (referenced in files whitelist) | MISSING | Does not exist. Phase 106 (Documentation) is responsible. Currently absent from npm pack --dry-run output. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `mcp-server/package.json` | `mcp-server/build/index.js` | `main` and `bin` fields | VERIFIED | `"main": "build/index.js"` and `"bin": {"fsb-mcp": "build/index.js"}` both present. build/index.js exists. |
| `mcp-server/package.json` | `mcp-server/build/` | `files` field restricting published content | VERIFIED | `"files": ["build/", "README.md"]` present. npm pack --dry-run confirms only build/ files in tarball. |
| `.github/workflows/publish-mcp.yml` | `mcp-server/package.json` | npm publish reads package metadata | VERIFIED | `working-directory: mcp-server` in job defaults. All npm commands execute within mcp-server directory. |
| `.github/workflows/publish-mcp.yml` | `NPM_TOKEN` | GitHub secret for npm registry auth | VERIFIED (code) / UNCONFIRMED (secret value) | `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` present in workflow. Whether the GitHub secret is actually configured in repo settings cannot be verified programmatically. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PKG-01 | 105-01-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. Referenced only in ROADMAP.md Phase 105 requirements list. |
| PKG-02 | 105-01-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. |
| PKG-03 | 105-01-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. |
| PKG-04 | 105-01-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. |
| DIST-01 | 105-02-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. |
| DIST-02 | 105-01-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. |
| DIST-03 | 105-02-PLAN.md | Undefined in REQUIREMENTS.md | ORPHANED | No definition exists in REQUIREMENTS.md. |

**Finding:** REQUIREMENTS.md covers only v0.9.9 Excalidraw requirements. The v0.9.8.1 npm Publishing milestone requirements (PKG-*, DIST-*) were never added to REQUIREMENTS.md. The requirement IDs exist in ROADMAP.md and PLAN frontmatter but have no canonical definitions or descriptions anywhere. This is a documentation gap -- implementation evidence strongly supports what each ID likely covers, but formal traceability is broken.

**Implementation coverage by inferred intent:**

| Inferred Requirement | Likely Covers | Implementation Status |
| -------------------- | ------------- | --------------------- |
| PKG-01 | Package name `fsb-mcp-server` unscoped, version 0.1.0 | SATISFIED -- name and version confirmed in package.json |
| PKG-02 | npm publish metadata (license, author, repository, keywords, engines) | SATISFIED -- all metadata present in package.json |
| PKG-03 | files whitelist restricts published content to build/ and README.md | SATISFIED -- files field confirmed, pack dry-run clean |
| PKG-04 | prepublishOnly hook ensures fresh TypeScript build before every publish | SATISFIED -- prepublishOnly: tsc present, compiles cleanly |
| DIST-01 | GitHub Actions CI/CD workflow publishes on tag push | SATISFIED -- workflow exists with v* trigger |
| DIST-02 | .npmignore excludes source files and dev artifacts | SATISFIED -- 26-line .npmignore present with src/, tsconfig.json, test, IDE exclusions |
| DIST-03 | npm publish uses NPM_TOKEN secret for authentication | SATISFIED (code) -- NODE_AUTH_TOKEN wired to secrets.NPM_TOKEN; secret must be configured manually |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `mcp-server/package.json` | 28-31 | `files` includes `"README.md"` but file does not exist | Info | README.md absent from npm tarball until Phase 106 creates it. Not a blocker for package functionality -- `npx fsb-mcp-server` will still execute. |

No TODO, FIXME, placeholder, stub implementations, or empty handlers found in phase artifacts.

### Human Verification Required

#### 1. npx Installation on Clean Machine

**Test:** On a machine with no FSB repo clone, run `npx -y fsb-mcp-server` after the package has been published
**Expected:** npm downloads `fsb-mcp-server@0.1.0`, executes `build/index.js`, server starts and waits for stdio MCP input
**Why human:** Package has not been published to npm registry. Cannot test actual npx download and execution without a live published package.

#### 2. NPM_TOKEN GitHub Secret

**Test:** Navigate to GitHub repo Settings > Secrets and variables > Actions, verify NPM_TOKEN exists
**Expected:** NPM_TOKEN secret is configured with a valid npm Automation token
**Why human:** Cannot inspect GitHub repository secret values programmatically. First tag push will fail if not configured.

### Gaps Summary

**Gap 1 -- Unpublished package (partially blocking goal):** The phase goal states users can install via `npx -y fsb-mcp-server`. All local infrastructure is complete and verified. The gap is that no v* tag has been pushed yet, so no publish has run. This is expected at end-of-phase (the CI workflow exists to automate publication), but the literal goal statement cannot be confirmed true until first publish. The NPM_TOKEN secret must also be configured manually before the first tag push.

**Gap 2 -- Orphaned requirement IDs (documentation gap):** PKG-01 through PKG-04 and DIST-01 through DIST-03 are referenced in ROADMAP.md Phase 105 and in both PLAN files but are not defined in REQUIREMENTS.md. The active REQUIREMENTS.md covers only v0.9.9 Excalidraw scope. This means requirement traceability for the entire v0.9.8.1 milestone is broken at the requirements document level. Implementation evidence strongly suggests all 7 IDs are satisfied by what was built, but there are no formal requirement descriptions to verify against.

**Gap 3 -- Missing README.md (minor, next-phase scope):** mcp-server/README.md does not exist. The files whitelist references it, so it will be included in the tarball once Phase 106 creates it. This does not block package functionality but means the published tarball currently ships without a README.

---

_Verified: 2026-03-24T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
