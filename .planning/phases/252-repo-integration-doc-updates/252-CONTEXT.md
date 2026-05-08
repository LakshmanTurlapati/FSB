# Phase 252: Repo Integration & Doc Updates - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) -- decisions locked at REQUIREMENTS.md

<domain>
## Phase Boundary

Make the FSB OpenClaw skill discoverable from every existing entry point an FSB user is likely to read first. Four mechanical edits across four files: root README Quick Start TL;DR + Repository Layout, `mcp/README.md` OpenClaw paragraph, the `OpenClaw` block in `mcp/src/install.ts:413-420` `getSetupSections()`, and the showcase llms*.txt files for AI-search discoverability.

Out of scope for this phase: skill content (Phase 249/250 owns), tests (Phase 251 owns), publish QA (Phase 253 owns), live OpenClaw runtime validation (user task, deferred).

</domain>

<decisions>
## Implementation Decisions

### INTEG-01: README.md (root)

- **Quick Start TL;DR (line 48-69 area)**: add a 1-paragraph mention of the FSB OpenClaw skill as the canonical OpenClaw onboarding path. Position: after the existing "one-command install" table, before or alongside the `--all` mention. Wording emphasizes: skill ships with `skills/FSB Skill/`, runs the doctor flow + prints the canonical stdio block + offers consent-gated install for other detected MCP hosts. Skill name `FSB`.
- **Repository Layout table (line 113-123 area)**: add ONE new row above or alongside the existing rows: `| [`skills/FSB Skill/`](./skills/FSB%20Skill/SKILL.md) | OpenClaw skill: doctor + stdio printer + consent-gated multi-host install. |` (or equivalent; markdown link can use URL-encoded space `FSB%20Skill` or unencoded if both render).

### INTEG-02: mcp/README.md OpenClaw paragraph

- mcp/README.md does NOT currently have a dedicated OpenClaw paragraph (verified: only one mention as a trusted-client label at line 279). REQUIREMENTS.md INTEG-02 says "updates its OpenClaw paragraph". Adapt: ADD a new short paragraph in the `One Command Install` / platform support area noting that OpenClaw users should install via the skill at `skills/FSB Skill/` (canonical path), with manual stdio fallback preserved as alternative.
- Wording: 2-3 sentences. Note that OpenClaw `--openclaw` install flag stays "manual / unsupported" because OpenClaw's MCP config schema is unstable across builds; the skill prints + asks user to paste, never auto-writes.

### INTEG-03: mcp/src/install.ts:413-420

- The `OpenClaw` block in `getSetupSections()` currently reads (verified):
  ```
  title: 'OpenClaw',
  lines: [
    'Status: manual / unsupported for now.',
    'Why:',
    '  Official MCP config and HTTP behavior are still unstable across current OpenClaw builds.',
    'Fallback:',
    '  Use the stdio command manually only if your OpenClaw build documents a stable MCP format.',
  ],
  ```
- Update to point at the skill while preserving the manual stdio fallback line. New lines (proposed):
  ```
  title: 'OpenClaw',
  lines: [
    'Canonical install: load the FSB skill from skills/FSB Skill/ in this repo.',
    '  The skill runs the doctor flow, prints the OpenClaw stdio block, and offers',
    '  consent-gated install for other detected MCP hosts.',
    'Status of the --openclaw install flag: still manual / unsupported.',
    'Why:',
    '  OpenClaw MCP config schema is unstable across builds; the skill prints + asks',
    '  the user to paste, never auto-writes the OpenClaw config.',
    'Manual stdio fallback (if you cannot use the skill):',
    '  ' + STDIO_COMMAND,
  ],
  ```
- Preserve the line referring to `STDIO_COMMAND` constant (already declared at line 28 as `'npx -y fsb-mcp-server'`).

### INTEG-04: showcase/angular/public/llms{,full}.txt

- Add a 2-3 sentence paragraph mentioning the FSB OpenClaw skill (path `skills/FSB Skill/`, role: canonical OpenClaw onboarding) for AI-search discoverability.
- Position: after the existing "MCP server" or similar high-level section, NOT inside any prerendered route content (those are HTML fragments).
- Both files (llms.txt is the short-form, llms-full.txt is the long-form) get the mention with appropriate verbosity.
- ASCII only. ZERO emojis.

### Anti-scope (do not do any of these in Phase 252)

- New skill content (Phase 249/250 owns).
- Test changes (Phase 251 owns -- test verifies static skill content, doesn't need to know about README).
- ClawHub publish prep (Phase 253 owns).
- Adding a `--openclaw` install flag in `mcp/src/install.ts` (REQUIREMENTS.md "Future Requirements" -- defer until OpenClaw publishes stable MCP-config schema).
- Auto-launching the Chrome Web Store URL anywhere.

### Claude's Discretion

- Exact wording of the README.md Quick Start mention (keep concise -- TL;DR is already long).
- Exact paragraph placement in `mcp/README.md` (recommend: before the platform table, in the One Command Install section).
- Whether to URL-encode the space in the README repo-layout link (`skills/FSB%20Skill/SKILL.md`) -- recommend yes for portability across renderers.
- Whether to add 1-line `skills/` mention to Repository Layout's existing table OR add a brand-new row -- recommend new row for visibility.

</decisions>

<code_context>
## Existing Code Insights

### File anchors

- `README.md:48` -- Quick Start TL;DR begins.
- `README.md:113` -- Repository Layout table begins.
- `mcp/README.md` -- no current OpenClaw paragraph; add one in "One Command Install" / platform section near the trusted-client label list.
- `mcp/src/install.ts:413-420` -- OpenClaw block in `getSetupSections()`. STDIO_COMMAND constant on line 28.
- `showcase/angular/public/llms.txt` and `llms-full.txt` -- AI-search discoverability files.

### Established Patterns

- README.md uses markdown tables with link cells; links to extension/, mcp/, showcase/ subdirectory READMEs are standard.
- mcp/src/install.ts setup sections use `lines` arrays of strings; STDIO_COMMAND constant is reused across blocks.
- llms.txt files have a "## Section Title" + paragraph structure (read existing for exact pattern).
- ZERO emojis everywhere.

</code_context>

<specifics>
## Specific Ideas

- Use repo-layout link target `./skills/FSB%20Skill/SKILL.md` (URL-encoded space) for cross-renderer compatibility.
- The README.md Quick Start mention should be a SHORT 1-2 sentence callout, not a full paragraph -- TL;DR is already dense.
- The mcp/README.md addition should preserve the existing platform table's flow; add the OpenClaw paragraph BEFORE the table or as a footnote below it.
- All 4 files end up under existing test coverage indirectly (npm test runs Phase 251 spec, which doesn't touch these files; CI green is preserved as long as the edits don't break parsing of any file -- install.ts must still compile, llms.txt are plain text).

</specifics>

<deferred>
## Deferred Ideas

- A `--openclaw` install flag in `mcp/src/install.ts` -- deferred per REQUIREMENTS.md "Future Requirements".
- Localised README sections / llms.txt files (i18n) -- deferred past v1.0.
- Per-route OG images mentioning the skill -- deferred.
- A dedicated `skills/README.md` index file (if multiple skills land later) -- deferred until there is a second skill.
- Structured machine-readable skill index in llms-full.txt -- deferred.

</deferred>
