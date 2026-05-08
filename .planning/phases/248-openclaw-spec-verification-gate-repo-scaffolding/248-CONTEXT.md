# Phase 248: OpenClaw Spec Verification Gate + Repo Scaffolding - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) -- decisions locked at roadmap reused; one open verification approach decided with user

<domain>
## Phase Boundary

Produce two deliverables that gate every downstream phase:

1. A documented set of OpenClaw spec findings (schema of `metadata.openclaw.install[]`, accepted `requires.bins[]` values, install-hook timing, ClawHub `FSB` name decision, and bonus findings on `command-arg-mode` + ClawHub publish QA gates) at `.planning/v0.9.61-OPENCLAW-SPEC.md`. Findings are best-effort web research; user validates against a live OpenClaw build before Phase 249 commits SKILL.md frontmatter.

2. An empty-but-committed `skills/FSB Skill/` skeleton at the repo root (sibling to `extension/`, `mcp/`, `showcase/`) with placeholder `SKILL.md`, `USAGE.md`, `references/`, and `scripts/` subpaths so all downstream phases can author against a known shape.

Out of scope for this phase: writing actual SKILL.md frontmatter (Phase 249), authoring `references/*.md` (Phase 250), tests (Phase 251), README updates (Phase 252), publish prep (Phase 253), running the live OpenClaw verification (user task between phases).

</domain>

<decisions>
## Implementation Decisions

### Spec Verification Approach (decided in autonomous discuss)

- **Method:** Best-effort web research using WebSearch / WebFetch against authoritative OpenClaw sources (docs.openclaw.ai, github.com/openclaw, clawhub.ai). No live OpenClaw runtime is available to the autonomous agent.
- **Confidence markers:** Every finding tagged `[HIGH]`, `[MEDIUM]`, `[LOW]`, `[ASSUMED]`, or `[UNVERIFIED]`. Plain ASCII markers per project rule.
- **Findings location:** `.planning/v0.9.61-OPENCLAW-SPEC.md` (single milestone-scoped findings doc; not per-phase RESEARCH.md, since the artifact is needed by Phases 249-253).
- **Validation gate:** A "Items requiring user validation against live OpenClaw" section at the bottom of the findings doc lists everything the user should verify locally before Phase 249 commits SKILL.md frontmatter. Validation is user-gated; not blocking for Phase 248 closeout.

### ClawHub Name (decided in autonomous discuss + research)

- **Locked choice:** `name: FSB` (bare, all-caps).
- **Rationale:** Direct fetch of `clawhub.ai/skills/fsb` returned no hit; two WebSearches across ~30 results found no existing FSB skill. ClawHub catalog (~13k skills) was sampled, not exhaustively searched, but evidence supports availability.
- **Fallback:** `fsb-browser` + `displayName: FSB` is documented in REQUIREMENTS.md SCAFFOLD-04 and stays ready to swap in if Phase 253 publish QA finds a collision. No swap until then.

### Schema Findings Summary (from research, full doc at .planning/v0.9.61-OPENCLAW-SPEC.md)

- **`metadata.openclaw.install[]`** [MEDIUM-HIGH]: Flat array of `{kind, package|formula|url, bins, label?, os?, id?}` objects. Supported `kind` values: `brew | node | go | uv | download`. NOT a shell-command list. FSB shape: `{kind: "node", package: "fsb-mcp-server", bins: ["fsb-mcp-server"]}`.
- **`requires.bins[]`** [HIGH]: Open string array (any executable name). `node` and `npx` both documented in real examples. Not a closed enum.
- **Install hook timing** [MEDIUM-LOW]: Runs on macOS Skills UI install button click / `openclaw skills install` -- NOT on every load and NOT on first `/fsb` invocation. No automatic install lifecycle hook (confirmed by openclaw issue #23926). USAGE.md "3-step install" wording must NOT assume auto-install.
- **`command-arg-mode`** [HIGH]: Only documented value is `"raw"`.
- **Schema keys to avoid** [HIGH]: `priority` and `must-use` do not exist in the spec; FSB correctly avoids them.
- **ClawHub publish QA**: VirusTotal scan + ClawScan + 7-day-old GitHub account requirement (used to scope Phase 253 PUB-01).

### Roadmap-Locked Decisions (do not re-debate)

- Repo path: `skills/FSB Skill/` (literal space) at repo root, sibling to `extension/`, `mcp/`, `showcase/`.
- Skill name: `FSB`; namespaced fallback `fsb-browser` + `displayName: FSB` stays in reserve.
- Scripts: Node `.mjs` only (cross-platform; no `.sh` / `.cmd` siblings).
- `metadata.openclaw.requires.env: []` is mandatory.
- `npx -y fsb-mcp-server` invocations stay unpinned.
- ASCII status markers (`[OK]` / `[FAIL]` / `[WARN]`); zero emojis.
- `version: 0.9.61` aligned to milestone (not `fsb-mcp-server@0.8.0`).

### Scaffold Shape (Phase 248 deliverable, not yet authored)

- `skills/FSB Skill/SKILL.md` -- placeholder (Phase 249 fills it).
- `skills/FSB Skill/USAGE.md` -- placeholder (Phase 250 fills it).
- `skills/FSB Skill/references/` -- empty directory marker (Phase 250 fills it).
- `skills/FSB Skill/scripts/` -- empty directory marker (Phase 249 adds `doctor.mjs`, `print-stdio.mjs`, `install-host.mjs`).
- Directory markers: prefer a one-line README placeholder per subdirectory rather than `.gitkeep`, since empty Markdown placeholders convey intent and are more discoverable.

### Claude's Discretion

- Exact structure of placeholder content inside `SKILL.md` and `USAGE.md` (must be enough to commit, not enough to mislead readers into thinking the skill is functional).
- Whether to include a top-level `README.md` inside `skills/FSB Skill/` summarising milestone status -- decision: skip; `SKILL.md` placeholder serves this role.
- Exact layout of the findings document beyond the structure already used in `.planning/v0.9.61-OPENCLAW-SPEC.md` (already written by research subagent).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `mcp/src/install.ts` `getSetupSections()` (lines 413-420) -- canonical OpenClaw stdio block source; Phase 249 `print-stdio.mjs` reads from this so the printed block stays in sync.
- `mcp/README.md` -- already documents `npx -y fsb-mcp-server doctor` flow; Phase 249 `doctor.mjs` wraps this.
- `npx -y fsb-mcp-server install --list` -- existing host-detection output; Phase 249 `install-host.mjs` parses this.
- v0.9.35 layered diagnostics (Phase 200) -- six-layer failure classification (package / bridge / extension / active-tab / content-script / config); Phase 249 doctor wrapper consumes these.
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `SUMMARY.md` -- comprehensive prior research; reuse to avoid re-research in downstream phases.

### Established Patterns

- Repo top-level peer pattern: `extension/`, `mcp/`, `showcase/` -- `skills/FSB Skill/` matches this.
- Cross-platform Node scripts: existing `mcp/scripts/*.mjs` use `import` syntax, ES2021+, no `node:` prefix unless needed; Phase 249 follows.
- ASCII status markers established in v0.9.35 doctor output: `[OK] / [FAIL] / [WARN]`.
- User-gated publish: v0.9.60 left `npm publish fsb-mcp-server@0.8.0` as a single user-run command; Phase 253 mirrors this for `clawhub publish`.

### Integration Points

- Future: Phase 252 INTEG-01..04 wires the skill into root `README.md`, `mcp/README.md`, `mcp/src/install.ts:413-420`, `showcase/angular/public/llms*.txt`. None of those edits land in Phase 248.
- `tests/` directory at repo root holds Jest specs; Phase 251 `skill-fsb-spec.test.js` lands there and is wired into root `npm test` chain.
- CI gate: `ci / all-green` GitHub Actions workflow already covers `tests/` via `npm test`; no workflow file edit needed.

</code_context>

<specifics>
## Specific Ideas

- The findings document at `.planning/v0.9.61-OPENCLAW-SPEC.md` already exists (written by research subagent during smart discuss). Phase 248 plan should treat that file as a starting artifact, not a deliverable to author from scratch -- it should be refined / lightly edited only if planning identifies gaps.
- The skeleton placeholders should each include a one-line "filled in Phase NNN" marker so readers seeing the directory mid-milestone understand the staging.
- No new MCP tools, no extension diffs, no `mcp/src/*.ts` changes beyond what Phase 252 explicitly handles. Phase 248 is content + structure only.
- `clawhub search "FSB"` (or equivalent) on a live ClawHub install is listed as a "validate against live build" item but does not block Phase 248 closeout.
- Items the user should validate against a live OpenClaw build (per findings doc):
  1. Install timing on Linux / Windows (does `install[]` no-op outside macOS Skills UI?).
  2. Definitive `clawhub search "FSB"` collision check across the full ~13k skill catalog.
  3. Whether `requires.bins: ["node","npx"]` hard-blocks vs warns on missing bins (real-world eligibility-check bugs documented in openclaw issue #29254).

</specifics>

<deferred>
## Deferred Ideas

- A `--openclaw` install flag in `mcp/src/install.ts` -- deferred past v0.9.61 (REQUIREMENTS.md "Future Requirements"). Stays "manual / unsupported" until OpenClaw publishes a stable MCP-config schema.
- A `--force` reinstall path that resets the skill state cleanly -- deferred (REQUIREMENTS.md "Future Requirements").
- Telemetry / opt-in observability for skill usage -- deferred.
- Localised SKILL.md / USAGE.md (i18n) -- deferred.
- Multi-skill split (`FSB-Reader` + `FSB-Driver`) -- deferred.
- Anti-prompt-injection hardening of `references/` content -- deferred.
- Live OpenClaw verification of the items listed under "validation gate" -- user task between Phase 248 and Phase 249; not a Phase 248 deliverable.

</deferred>
