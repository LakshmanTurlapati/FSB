---
plan: 251-01
phase: 251-tests-ci-integration
status: complete
date: 2026-05-08
requirements: [TEST-01, TEST-02, TEST-03, TEST-04, TEST-05]
---

# Plan 251-01 Summary: tests/skill-fsb-spec.test.js + CI wiring

## What was built

A single static-content test (`tests/skill-fsb-spec.test.js`, 188 lines, CommonJS, plain Node) that runs against the committed FSB OpenClaw skill artifacts and locks them against silent regression. Wired into root `package.json` `"test"` script chain (TEST-01) so the existing `ci / all-green` GitHub Actions PR gate covers the skill transitively.

## Test coverage

48 PASS, 0 FAIL on green run. Coverage:

- **TEST-02 (frontmatter):** `name === FSB`, `version === 0.9.61`, `requires.bins` includes `node` and `npx`, `requires.env` is empty, `metadata.openclaw` parses as JSON with `kind: node` and `package: fsb-mcp-server`. No `priority`, no `must-use` keys.
- **TEST-03 (stdio parity):** `print-stdio.mjs` and `mcp/src/install.ts` both have `"command": "npx"` and `"args": ["-y", "fsb-mcp-server"]`. `STDIO_COMMAND` constant verified verbatim in install.ts.
- **TEST-04 (references):** All 6 reference files exist. `multi-agent-contract.md` mentions all 4 typed errors verbatim + `back` tool. `tool-decision-tree.md` only references tool names that exist in `mcp/ai/tool-definitions.cjs` (51 defined tools detected; allowlist for non-tool words and 8 cross-surface MCP tools that live outside the AI registry).
- **TEST-05 (USAGE links):** Exact Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` present. GitHub Releases fallback link present.
- **ASCII enforcement:** All 9 skill artifacts (SKILL.md, USAGE.md, print-stdio.mjs, 6 references) verified zero non-ASCII bytes.

## CI integration

`package.json` `"test"` script chain extended with ` && node tests/skill-fsb-spec.test.js` at the end. Verified via:
```
node -e "const t=require('./package.json').scripts.test; if(!t.endsWith('node tests/skill-fsb-spec.test.js')) throw new Error('not wired')"
```
Returns clean. The existing `"ci"` script (`npm run validate:extension && npm test && npm run test:mcp-smoke && npm run showcase:build && npm run showcase:smoke`) picks up the new test transitively via `npm test`.

## Key decisions

- Single CommonJS test file (matches dominant project pattern; ~50 of 60+ existing tests are CJS).
- Inline minimal regex-based YAML parsing (no new dev deps, project has no build system).
- Allowlist for cross-surface MCP tools (`run_task`, `stop_task`, `start_visual_session`, `fill_credential`, etc.) that live in `mcp/src/tools/*.ts` rather than `mcp/ai/tool-definitions.cjs`. These are intentionally excluded from the AI registry per multi-surface architecture.

## Self-Check: PASSED

- Test file exists, runs green standalone (`node tests/skill-fsb-spec.test.js` exits 0).
- package.json `"test"` script ends with new test invocation.
- No new dev dependencies added.
- ASCII-only (zero non-ASCII bytes in test source).
- All 5 TEST-01..05 IDs covered.

## Files

- `tests/skill-fsb-spec.test.js` (NEW)
- `package.json` (MODIFIED -- one-line append to test script chain)
