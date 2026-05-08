# Phase 249: SKILL.md + Scripts - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) -- decisions locked at roadmap + Phase 248 sign-off; scripted authoring follows verified spec

<domain>
## Phase Boundary

Author the executable surface of the FSB OpenClaw skill: the SKILL.md frontmatter (name, version, requires.bins, requires.env, single-line metadata.openclaw JSON) plus three Node `.mjs` scripts (`scripts/doctor.mjs`, `scripts/print-stdio.mjs`, `scripts/install-host.mjs`) that, taken together, allow a fresh OpenClaw load to:

1. Run the doctor-first branch dispatcher end-to-end against a live FSB MCP server install (`scripts/doctor.mjs`).
2. Print the canonical OpenClaw stdio config block for the user to paste into OpenClaw's MCP config (`scripts/print-stdio.mjs`).
3. Detect other MCP hosts on the machine and offer consent-gated install per host (`scripts/install-host.mjs`).

Out of scope for this phase: USAGE.md (Phase 250), references/*.md prose (Phase 250), tests (Phase 251), README updates (Phase 252), publish QA (Phase 253), live OpenClaw runtime validation (user task, deferred).

</domain>

<decisions>
## Implementation Decisions

### Frontmatter (locked from Phase 248 + roadmap)

- `name: FSB` (bare; no namespace).
- `description:` short (one sentence) describing the skill purpose; keep under ~120 chars.
- `version: 0.9.61` (aligned to milestone, NOT to fsb-mcp-server@0.8.0).
- `user-invocable: true`.
- `requires.bins: [node, npx]` (open string array; HIGH confidence per Phase 248).
- `requires.env: []` (mandatory empty -- secrets resolve inside extension).
- `homepage:` -- use repo URL `https://github.com/LakshmanTurlapati/FSB` (or canonical equivalent).
- `metadata.openclaw{...}` -- single-line JSON inside YAML. Shape verified Phase 248: `{install: [{kind: "node", package: "fsb-mcp-server", bins: ["fsb-mcp-server"]}]}`. NO multi-line YAML; OpenClaw parser is single-line-only per Phase 248 finding.
- Forbidden keys: NO `priority`, NO `must-use` (do not exist in spec per Phase 248).
- ZERO emojis. Plain ASCII only.

### SKILL.md body (under ~600 tokens; progressive disclosure)

- Opens with one-paragraph "what FSB is and when to use it" framing.
- Single inlined "default-to-FSB" rule: soft preference for FSB tools when one fits; hard escalation for click/type/auth/multi-tab.
- Single inlined visual-session wrapping rule: external-AI sequences open with `start_visual_session(client="OpenClaw", ...)`, close with `end_visual_session(...)`. Phase 250 `references/` covers the lifecycle in detail.
- Single inlined doctor-first protocol: "if anything looks off, run /fsb doctor before retrying".
- Pointers (NOT inlined content) to Phase 250 references:
  - `references/tool-decision-tree.md` -- when to use which tool
  - `references/multi-agent-contract.md` -- typed errors + back tool
  - `references/restricted-tab-recovery.md` -- chrome:// recovery
  - `references/vault-boundary.md` -- credential routing
  - `references/default-to-fsb.md` -- soft/hard escalation rule
- Body must NOT inline tool docs, multi-agent error catalog, or visual-session lifecycle (those live in references/ and are loaded on demand by OpenClaw).

### scripts/doctor.mjs (SKILL-03)

- Spawns `npx -y fsb-mcp-server doctor` via `child_process.spawn` (not `exec` -- preserve stream for long output).
- Parses output for the failing layer using stable string anchors. Six branches per Phase 248 + v0.9.35 layered diagnostics:
  - `package` -- npm package not found / cannot install
  - `bridge` -- `ws://localhost:7225` not reachable
  - `extension` -- FSB Chrome extension not detected
  - `active-tab` -- no attachable active tab (chrome://, etc.)
  - `content-script` -- content script not injected
  - `config` -- malformed OpenClaw or extension config
  - `ok` -- all green
- Each branch prints structured ASCII output: `[OK]` / `[FAIL]` / `[WARN]` lines plus a one-line "next step" recommendation pointing at:
  - Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` (extension layer)
  - `npx -y fsb-mcp-server install --<host>` (config layer)
  - `npx -y fsb-mcp-server status --watch` (bridge / active-tab layers)
- Cross-platform: no shell-specific assumptions, no bash/PowerShell branches.
- Exit code: 0 if `[OK]`, non-zero if any layer fails (so OpenClaw can detect failure).

### scripts/print-stdio.mjs (SKILL-04)

- Prints a single canonical OpenClaw stdio config block to stdout. Block content (verbatim):
  ```
  {
    "mcpServers": {
      "fsb": {
        "command": "npx",
        "args": ["-y", "fsb-mcp-server"]
      }
    }
  }
  ```
- Block is sourced from `mcp/src/install.ts` constants `STDIO_COMMAND = 'npx -y fsb-mcp-server'` (line 28) and the per-host JSON shape (e.g., line 173-174). Implementation MAY hard-code the block in `print-stdio.mjs`; Phase 251 TEST-03 enforces parity by reading both files and comparing -- drift is caught at CI time, not at runtime.
- No build step required (matches "no build system" project constraint).
- Surrounding output: "Paste this into your OpenClaw MCP config" header before the block, "If your OpenClaw build documents a different shape, see <link>" footer.
- Cross-platform: pure stdout writes, no platform branches.

### scripts/install-host.mjs (SKILL-05)

- Detects other MCP hosts via `npx -y fsb-mcp-server install --list` (existing FSB CLI, no new flags).
- Parses host list from stdout; presents `y/n` prompt per detected host using `readline` from Node stdlib.
- On explicit `y`: runs `npx -y fsb-mcp-server install --<host>`.
- On `n` or any non-`y` input: skips that host.
- NEVER passes `--all`; NEVER auto-installs without explicit per-host yes.
- NEVER auto-writes OpenClaw's own MCP config (OpenClaw config schema unstable per Phase 248; print-only via `print-stdio.mjs`).
- Cross-platform: `readline` works identically on macOS/Linux/Windows.
- Exit code: 0 on completion regardless of how many hosts user accepted.

### Cross-platform discipline (SKILL-06)

- All three scripts use `import` syntax (ESM), no `require`.
- No `node:` prefix unless necessary (matches existing `mcp/scripts/*.mjs` convention).
- Path operations via `node:path` to handle Windows backslashes if any path manipulation is needed (none expected for these three scripts).
- No bash/PowerShell siblings; no `.sh` / `.cmd` files in `scripts/`.
- Happy path: each script runs on a clean macOS/Linux/Windows machine with `node` + `npx` available; no preinstall step.

### Anti-scope (do not do any of these in Phase 249)

- USAGE.md content (Phase 250 owns).
- `references/*.md` prose (Phase 250 owns; Phase 250 also handles `references/README.md` evolution beyond the placeholder Phase 248 created).
- Tests (`tests/skill-fsb-spec.test.js` lands in Phase 251).
- README updates / repo discoverability (Phase 252 owns).
- Pre-publish QA / `package:skill` build script / `clawhub publish` (Phase 253 owns).
- Auto-writing OpenClaw MCP config (forever out of scope -- print only).
- Bundling fsb-mcp-server source / node_modules into skill (forever out of scope -- npx -y unpinned).

### Claude's Discretion

- Exact wording of one-line "next step" recommendations inside `doctor.mjs` (must point at concrete commands/URLs but phrasing is free).
- Exact one-paragraph framing of "what FSB is and when to use it" at top of SKILL.md body.
- Whether to embed a minimal usage example in SKILL.md body or defer entirely to Phase 250 USAGE.md (recommend: defer; SKILL.md stays under 600 tokens).
- Whether `install-host.mjs` shows an end-of-run summary line ("Installed FSB MCP for: claude-desktop, cursor"); recommend yes for user feedback.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `mcp/src/install.ts:28` -- `STDIO_COMMAND = 'npx -y fsb-mcp-server'` constant.
- `mcp/src/install.ts:173-174` (and similar lines for other hosts) -- canonical JSON shape `{"command": "npx", "args": ["-y", "fsb-mcp-server"]}`.
- `mcp/src/install.ts:413-420` -- existing OpenClaw section in `getSetupSections()` (currently "manual / unsupported"); Phase 252 INTEG-03 updates this to point at the skill.
- `npx -y fsb-mcp-server doctor` -- existing FSB CLI; layered diagnostics from v0.9.35 Phase 200.
- `npx -y fsb-mcp-server install --list` -- existing host-detection output.
- `npx -y fsb-mcp-server install --<host>` flags -- existing per-host installer (Phase 198+ from v0.9.35).
- `mcp/scripts/*.mjs` -- existing Node ESM script conventions to follow.
- `.planning/v0.9.61-OPENCLAW-SPEC.md` -- canonical schema reference; SKILL.md frontmatter shape sourced from this.

### Established Patterns

- Cross-platform Node ESM scripts: `import` syntax, ES2021+, no transpilation.
- ASCII status markers in CLI output: `[OK]` / `[FAIL]` / `[WARN]` (v0.9.35 doctor output convention).
- `child_process.spawn` for streaming subprocess output (vs `exec` for buffered output).
- `readline` for interactive prompts (Node stdlib, cross-platform).
- File paths with literal spaces always quoted in shell -- `skills/FSB Skill/` has a literal space.
- v0.9.45rc1 sunset notice convention: clear `// DEPRECATED` comments. Not applicable to this phase but mentioned for project consistency.

### Integration Points

- `print-stdio.mjs` reads from / mirrors `mcp/src/install.ts` constants. Phase 251 TEST-03 verifies parity.
- `doctor.mjs` shells out to `npx -y fsb-mcp-server doctor`. Layered diagnostics output format already stable from v0.9.35.
- `install-host.mjs` shells out to `npx -y fsb-mcp-server install --list` and `--<host>`. CLI surface stable from v0.9.35.
- Skill is loaded by OpenClaw at runtime; no build artifact to ship beyond `skills/FSB Skill/` directory itself.

</code_context>

<specifics>
## Specific Ideas

- The four "Items requiring user validation against live OpenClaw" from Phase 248 sign-off remain user-gated; this phase does not block on them but Phase 251 tests should be tolerant of variance (e.g., test verifies SKILL.md frontmatter is valid YAML with required keys, not that it works on every OpenClaw build).
- `scripts/print-stdio.mjs` MAY include a one-line comment at the top noting the parity contract: `// Block parity with mcp/src/install.ts:28 STDIO_COMMAND -- enforced by tests/skill-fsb-spec.test.js`.
- `scripts/install-host.mjs` should print a final summary even if zero hosts were accepted: helps user understand the script ran but no installs happened.
- SKILL.md frontmatter `metadata.openclaw` JSON must be on a single line (Phase 248 finding). Confirm via JSON.parse-roundtrip in Phase 251 test.
- Each script has a `#!/usr/bin/env node` shebang line (cross-platform; Windows ignores shebang but Node still runs `.mjs` files explicitly).
- File header comment in each `.mjs`: 2-3 lines stating purpose + which REQ-ID it implements (helps reviewers / future-Claude).

</specifics>

<deferred>
## Deferred Ideas

- A `--force` reinstall path inside `doctor.mjs` -- explicitly deferred per REQUIREMENTS.md "Future Requirements" (hides root cause; doctor-first rule).
- Auto-write OpenClaw MCP config -- forever out of scope per Phase 248 + REQUIREMENTS.md (OpenClaw config schema unstable).
- Anti-prompt-injection hardening of references content -- deferred past v0.9.61.
- Localised SKILL.md / USAGE.md (i18n) -- deferred past v1.0.
- Skill telemetry / observability -- deferred past v1.0.
- `--openclaw` install flag in `mcp/src/install.ts` -- deferred until OpenClaw publishes stable MCP-config schema.
- Multi-skill split (FSB-Reader / FSB-Driver) -- deferred past v1.0.

</deferred>
