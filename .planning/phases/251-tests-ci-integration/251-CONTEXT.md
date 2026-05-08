# Phase 251: Tests + CI Integration - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) -- decisions locked at REQUIREMENTS.md + Phase 248-250 sign-offs

<domain>
## Phase Boundary

Author a single static-content test file at `tests/skill-fsb-spec.test.js` that locks the FSB OpenClaw skill against silent regression, then wire it into the root `npm test` chain so the existing `ci / all-green` GitHub Actions gate covers the skill.

Out of scope for this phase: README updates / repo discoverability (Phase 252), publish QA (Phase 253), live OpenClaw runtime validation (user task, deferred), runtime smoke tests against live FSB MCP (those are user-gated).

</domain>

<decisions>
## Implementation Decisions

### Test file location and runner (TEST-01)

- Single file: `tests/skill-fsb-spec.test.js` at repo root.
- Node native test (matches existing pattern -- all 60+ existing test files are plain Node scripts, no jest/vitest framework).
- Uses Node's `assert` from stdlib OR the project's existing pattern (read 1-2 existing test files to match style).
- Wired into root `package.json` `"test"` script by appending `&& node tests/skill-fsb-spec.test.js` to the existing chain.
- Does NOT require network. Does NOT require running FSB extension.
- Does NOT require `npm --prefix mcp run build` -- the test reads source files (`.ts`, `.cjs`, `.md`, `.mjs`) directly, no compilation needed.

### TEST-02: SKILL.md frontmatter

- Read `skills/FSB Skill/SKILL.md`.
- Extract YAML frontmatter (everything between the first two `---` lines).
- Parse via Node-compatible YAML reader (Node 22+ has no built-in YAML, so use a minimal regex-based parser OR read line by line; OR use `js-yaml` if it's already a dep -- but project has no build system so likely not). Recommendation: write a minimal frontmatter parser inline (regex extraction of key: value pairs, and JSON.parse for the single-line `metadata.openclaw` JSON).
- Assertions: `name === "FSB"`, `version === "0.9.61"`, `requires.bins` includes `node` and `npx`, `requires.env` is empty array, `metadata.openclaw` parses as valid JSON with expected structure (kind: "node", package: "fsb-mcp-server").
- No `priority`, no `must-use` keys (forbidden per Phase 248).

### TEST-03: Stdio block parity

- Read `skills/FSB Skill/scripts/print-stdio.mjs`.
- Read `mcp/src/install.ts`.
- Extract the canonical JSON block from `print-stdio.mjs` (look for `"command": "npx"` and `"args": ["-y", "fsb-mcp-server"]`).
- Extract the canonical block from `install.ts` (`STDIO_COMMAND` constant on line 28 + JSON shape on line 173-174 or similar).
- Assert deep equality of the JSON shape (parsed forms): both yield `{command: "npx", args: ["-y", "fsb-mcp-server"]}`.

### TEST-04: References completeness

- Assert all 6 reference files exist:
  - `skills/FSB Skill/references/tool-decision-tree.md`
  - `skills/FSB Skill/references/multi-agent-contract.md`
  - `skills/FSB Skill/references/restricted-tab-recovery.md`
  - `skills/FSB Skill/references/default-to-fsb.md`
  - `skills/FSB Skill/references/vault-boundary.md`
  - `skills/FSB Skill/references/visual-session-lifecycle.md` (optional 6th file added in Phase 250)
- Assert `multi-agent-contract.md` mentions all 4 typed errors verbatim: `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`. Mentions `back` tool name.
- Assert `tool-decision-tree.md` only references tool names that exist in `mcp/ai/tool-definitions.cjs`. Implementation: parse `tool-definitions.cjs` for `name: '<token>'` patterns; extract bare-token tool names from `tool-decision-tree.md` (e.g., from a markdown table column or inline backticks); assert subset relationship.

### TEST-05: USAGE.md links

- Assert `USAGE.md` contains exact Chrome Web Store URL: `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk`.
- Assert `USAGE.md` contains a GitHub Releases fallback link (matches `https://github.com/[^/]+/FSB/releases` or includes the literal `github.com/LakshmanTurlapati/FSB/releases`).

### Test style (matches project conventions)

- File starts with `#!/usr/bin/env node` shebang OR plain `'use strict';`-style header.
- Uses `import {strict as assert} from 'node:assert'` or CommonJS `const assert = require('assert/strict')` -- match whatever existing tests use.
- Logs `[OK]` per check + final `All checks passed.` line on success.
- Throws / `process.exit(1)` on first failure with specific error message.
- ZERO emojis. ASCII only.

### CI integration (TEST-01)

- Append `&& node tests/skill-fsb-spec.test.js` to the existing `"test"` script in root `package.json`.
- Position: append at the END of the chain (least disruptive).
- The existing `"ci"` script (`npm run validate:extension && npm test && npm run test:mcp-smoke && npm run showcase:build && npm run showcase:smoke`) will pick up the new test transitively via `npm test`.

### Anti-scope (do not do any of these in Phase 251)

- New skill content (Phase 249/250 owned that surface).
- README updates (Phase 252).
- Publish QA (Phase 253).
- Network-requiring tests (e.g., actually invoking `npx -y fsb-mcp-server`).
- Tests that run the FSB Chrome extension.
- Tests that load the skill into a live OpenClaw build (user-gated, deferred).
- Build/transpile steps -- read sources directly.
- Adding new dev dependencies (no `js-yaml` etc.; write minimal parsers inline).
- Splitting into multiple test files (REQUIREMENTS.md says "tests/skill-fsb-spec.test.js" singular).

### Claude's Discretion

- Exact import style (ESM vs CJS) -- match whatever the closest existing tests use.
- Inline YAML / JSON parsing approach (regex vs line-by-line scanner).
- Whether to add a single console.log summary block at the end (recommend yes for human readability when test runs as part of `npm test` chain).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- 60+ existing test files at `tests/*.test.js` -- read 1-2 (e.g., `tests/tool-definitions-parity.test.js` since it does similar source-parsing work) to match style and approach.
- Root `package.json` `"test"` script -- single long `&&` chain of `node tests/*.test.js` invocations.
- `mcp/ai/tool-definitions.cjs` -- canonical tool name source for TEST-04 cross-reference.
- `mcp/src/install.ts` lines 28 + 173-174 -- canonical stdio block source for TEST-03 parity check.

### Established Patterns

- Test files are plain Node scripts (no test runner framework). Each one assert-throws on first failure; success exits 0.
- `assert` import: most use either `import {strict as assert} from 'node:assert'` (ESM .test.js) or `const assert = require('assert/strict')` (CJS).
- Logging: `console.log('[OK] some check')` per assertion + final summary.
- File extensions: `.test.js` (CommonJS by default), some `.mjs` (ESM). Match the dominant pattern.
- ZERO emojis everywhere.

### Integration Points

- `tests/skill-fsb-spec.test.js` reads from:
  - `skills/FSB Skill/SKILL.md` (frontmatter)
  - `skills/FSB Skill/USAGE.md` (URL checks)
  - `skills/FSB Skill/references/*.md` (existence + content checks)
  - `skills/FSB Skill/scripts/print-stdio.mjs` (stdio block extraction)
  - `mcp/src/install.ts` (canonical parity source)
  - `mcp/ai/tool-definitions.cjs` (tool name registry)
- Failure mode: any check fails -> test exits non-zero -> `npm test` chain stops -> `ci / all-green` red.

</code_context>

<specifics>
## Specific Ideas

- The directory `skills/FSB Skill/` has a literal SPACE -- always quote in code (`path.join('skills/FSB Skill/', ...)` in JS handles this fine, but shell test invocations need quoted paths).
- For TEST-04 tool-name cross-reference: extract tokens from a markdown table column or backtick-wrapped names. Pattern: in `tool-decision-tree.md`, the table likely has tool tokens in backticks; grep `\`([a-z_]+)\`` and check each against the tool-definitions registry.
- Matching project convention from `tests/tool-definitions-parity.test.js` (closest analog -- reads `mcp/ai/tool-definitions.cjs` and verifies parity with another source) is the recommended starting point.
- Minimal YAML parser: for `name: FSB`, regex `^name:\s*(\S+)$` per line is sufficient. For `metadata.openclaw: { ... single-line JSON ... }`, regex captures the JSON tail and `JSON.parse()`.

</specifics>

<deferred>
## Deferred Ideas

- Live OpenClaw runtime test (loads skill into actual OpenClaw, runs doctor flow) -- user-gated, deferred.
- Test that `scripts/doctor.mjs` produces correct branch on simulated `[FAIL]` doctor output -- helpful but not required by REQUIREMENTS.md.
- Test that `scripts/install-host.mjs` correctly handles all `--list` output shapes -- helpful but deferred.
- Visual smoke (run print-stdio.mjs + JSON.parse the output) as part of test -- nice-to-have, recommend including.
- Localised content tests -- deferred past v1.0.

</deferred>
