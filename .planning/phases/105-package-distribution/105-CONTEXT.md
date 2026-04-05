# Phase 105: Package & Distribution - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the FSB MCP server installable via `npx -y fsb-mcp-server` without cloning the repo. This means npm-ready package.json, build pipeline, .npmignore, and a GitHub Actions workflow that publishes to npm on tag push. This is a monorepo -- the extension repo contains the MCP server subdirectory.

</domain>

<decisions>
## Implementation Decisions

### CI/CD Trigger
- **D-01:** GitHub Actions publishes to npm on tag push (`v*` pattern)
- **D-02:** No GitHub Release creation required -- git tag push is the sole trigger
- **D-03:** Workflow runs from the monorepo root but operates within `mcp-server/` directory

### Version Strategy
- **D-04:** npm package version is independent from FSB extension version
- **D-05:** Start at `0.1.0` to signal early/beta status
- **D-06:** Bump to `1.0.0` when stable -- own semver lifecycle

### Published Files
- **D-07:** Include compiled JS, TypeScript declarations (.d.ts), source maps (.js.map), and README
- **D-08:** Full dev experience: consumers get autocompletion and debugging support
- **D-09:** `files` field in package.json: `["build/", "README.md"]` (build/ already contains .js, .d.ts, .js.map from tsconfig)

### Package Identity
- **D-10:** Unscoped package name: `fsb-mcp-server` (already in package.json)
- **D-11:** License: MIT (matching main project badges)
- **D-12:** Binary name: `fsb-mcp` (already in package.json `bin` field)

### Claude's Discretion
- Exact GitHub Actions workflow structure and job naming
- npm provenance configuration
- .npmignore contents (as long as source/dev artifacts are excluded)
- package.json keywords selection

</decisions>

<specifics>
## Specific Ideas

- Monorepo structure: GitHub Actions must `cd mcp-server` before running npm commands
- Shebang (`#!/usr/bin/env node`) already exists in `src/index.ts` line 1 -- verify it survives tsc compilation into `build/index.js`
- Tag format should match semver: `v0.1.0`, `v0.2.0`, etc.
- NPM_TOKEN secret must be configured in GitHub repo settings (manual step, document in workflow comments)

</specifics>

<canonical_refs>
## Canonical References

No external specs -- requirements are fully captured in decisions above.

### Existing code
- `mcp-server/package.json` -- Current package config (name, bin, main, scripts, deps)
- `mcp-server/tsconfig.json` -- TypeScript config (declaration: true, sourceMap: true already enabled)
- `mcp-server/src/index.ts` -- Entry point with existing shebang
- `.gitignore` -- Project gitignore patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` already has `name`, `bin`, `main`, `type: "module"` configured correctly
- `tsconfig.json` already emits declarations and source maps (`declaration: true`, `sourceMap: true`)
- Entry point shebang already present in source

### Established Patterns
- Build script is `tsc` -- simple, no bundler needed
- Dev script uses `tsx` for direct TypeScript execution
- ESM modules (`"type": "module"`) throughout

### Integration Points
- GitHub Actions workflow goes in `.github/workflows/` (directory doesn't exist yet)
- `.npmignore` goes in `mcp-server/` directory
- `package.json` modifications are additive (metadata fields)

</code_context>

<deferred>
## Deferred Ideas

- Smithery.ai listing -- after npm package is stable
- Automated tests in CI pipeline -- no test suite exists yet
- npm provenance attestation -- nice to have, not blocking

</deferred>

---

*Phase: 105-package-distribution*
*Context gathered: 2026-03-23*
