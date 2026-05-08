# Phase 253: ClawHub Pre-Publish QA + User-Gated Publish - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) -- decisions locked at REQUIREMENTS.md + Phase 248 sign-off

<domain>
## Phase Boundary

Record a clean pre-publish QA pass against the ClawHub registry, ship a reproducible `npm run package:skill` build script, and document the one-liner publish sequence the user runs. The actual `clawhub publish` invocation is USER-GATED (mirrors v0.9.60 `npm publish fsb-mcp-server@0.8.0` posture).

</domain>

<decisions>
## Implementation Decisions

### PUB-01: Pre-publish QA recorded in `.planning/v0.9.61-CLAWHUB-PUBLISH-QA.md`

Local gates (run + record now):
- Name-collision recheck via `clawhub inspect fsb`. Result locked: "Skill not found" -> FSB available.
- Secret-grep across `skills/FSB Skill/` for credential patterns. Result: zero leaked secrets; matches are descriptive prose only (vault-boundary references the API surface).
- Invisible-unicode strip: zero hits across `skills/FSB Skill/` files. ASCII-only is also locked under CI by Phase 251 test.

Server-side gates (USER-GATED, fire when user runs `clawhub publish`):
- VirusTotal scan -- registry-side
- ClawScan -- registry-side
- GitHub account-age verification -- registry rejects accounts younger than 7 days

### PUB-02: `npm run package:skill` reproducible build

- New script: `scripts/package-skill.mjs`. Reads SKILL.md frontmatter, extracts version, zips `skills/FSB Skill/` into `dist/skill/FSB-Skill-<version>.zip`, excludes `.DS_Store`, `node_modules`, and `.git`.
- Wired into root `package.json` `"scripts.package:skill"`.
- Documented in `mcp/README.md` (OpenClaw section) so users learn about it from the same paragraph that references the skill.

### PUB-03: User-gated publish

- Documented sequence in `.planning/v0.9.61-CLAWHUB-PUBLISH-QA.md` Section 8:
  ```
  clawhub login
  clawhub whoami
  npm run package:skill   # optional artifact build
  clawhub publish "skills/FSB Skill"
  ```
- Autonomous mode does NOT run `clawhub publish`.

### Anti-scope

- No skill content changes (Phases 249/250 own).
- No test changes (Phase 251 owns).
- No new MCP tools, no extension changes (out of scope for milestone).
- No actual `clawhub publish` invocation.

</decisions>

<code_context>
## Existing Code Insights

- ClawHub CLI: `/opt/homebrew/bin/clawhub` v0.6.1 (verified locally).
- v0.9.60 user-gated publish pattern: `npm publish fsb-mcp-server@0.8.0` was left for the user to run; same posture here.
- `scripts/package-extension.mjs` -- existing reproducible-build sibling; `scripts/package-skill.mjs` follows the same pattern.
- `mcp/README.md` `### OpenClaw` paragraph (added in Phase 252) is the natural home for the package:skill + publish documentation.

</code_context>

<specifics>
## Specific Ideas

- Use the system `zip` binary with `-X` flag (strip extra file attributes) for reproducible builds across macOS/Linux. Windows users can run via WSL or use `7z` equivalent (out of scope to support natively here).
- Version stamping reads `SKILL.md` frontmatter so a future version bump in SKILL.md flows through automatically without script edits.
- The QA doc records server-side gates as `[USER-GATED]` rather than skipping them -- gives the user a checklist and explains the recovery path for each.

</specifics>

<deferred>
## Deferred Ideas

- A `--force` reinstall path baked into `clawhub install` -- defer past v0.9.61.
- Telemetry on publish events -- deferred (matches Phase 248 anti-feature list).
- A multi-skill split publish (one CLI invocation publishing FSB-Reader + FSB-Driver) -- deferred until there is a second skill.
- An automated post-publish smoke that verifies the listing on `clawhub.ai/skills/fsb` -- nice-to-have, defer to a follow-up milestone.

</deferred>
