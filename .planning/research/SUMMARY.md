# Project Research Summary

**Project:** FSB v0.9.61 -- FSB Skill (OpenClaw)
**Domain:** OpenClaw skill package layered above shipped FSB MCP surface (60 tools, `fsb-mcp-server@0.8.0`)
**Researched:** 2026-05-08
**Branch:** Claw

---

## Executive Summary

This milestone ships ONE new artifact: a top-level directory `skills/FSB Skill/` (literal space in folder name) containing one OpenClaw skill named `FSB`. It is a thin orchestration layer above already-shipped FSB capabilities -- no new MCP tools, no new extension code, no new installer registry entries, no new bridge messages.

The skill's job:
1. Make the existing 60-tool MCP surface reachable from inside OpenClaw.
2. Teach the OpenClaw model when/how to use FSB tools (decision tree, multi-agent contract, restricted-tab recovery, vault boundary, visual-session wrapping).
3. Walk first-time users through the doctor / extension-install / stdio-config-paste flow without ever auto-writing into OpenClaw's MCP config (officially "manual / unsupported" per `mcp/src/install.ts:413-420`).

All four researchers converged on:
- Doctor-first branch-on-failing-layer flow.
- Phase 248 spec-verification as the gate before SKILL.md frontmatter is finalized.
- Node-only `.mjs` scripts over bash/PowerShell pairs (cross-platform, single source of truth, `node` already in `requires.bins`).
- `requires.env: []` (provider keys live inside the extension, never in OpenClaw env).
- Namespacing risk for the bare `name: FSB` -- ClawHub collision check required.
- SKILL.md token discipline (under ~600 tokens; everything else lives in `references/` for progressive disclosure).
- `version: 0.9.61` aligned to milestone (not `fsb-mcp-server@0.8.0`).
- Unpinned `npx -y fsb-mcp-server` invocations (matches existing FSB convention).

Dominant risks are silent: OpenClaw schema drift (mitigated by Phase 248 gate), eager auto-install into other MCP hosts (mitigated by detect-list-confirm), prompt-injection escalating into skill-content trust (mitigated by explicit trust partition in SKILL.md), ClawHub VirusTotal/ClawScan flagging legitimate FSB diagnostic patterns at publish time (mitigated by deferring publication to a separate post-milestone step).

---

## Reconciled Phase Decomposition

Base structure: ARCHITECTURE's 5-phase plan (highest confidence -- grounded in concrete dependency graph, correctly starts at 248). FEATURES' 3-phase chunks fold into Phases 249-250; PITFALLS' verification concerns fold into 251 + a pre-close QA pass in 252.

| # | Phase | Rationale | Key deliverables |
|---|-------|-----------|------------------|
| **248** | OpenClaw Spec Verification Gate + Repo Scaffolding | Universal consensus across all four research files. Every downstream artifact depends on verified frontmatter shape. PROJECT.md target requirement. | Verified `metadata.openclaw.install[]` schema captured in `.planning/`; accepted `requires.bins` values; `command-arg-mode` semantics; ClawHub name-availability check for `FSB`; first-invocation hook timing confirmed; empty `skills/FSB Skill/` skeleton |
| **249** | SKILL.md + Scripts (end-to-end skill execution) | SKILL.md frontmatter and orchestration scripts are non-functional alone -- must ship together. Happy path runs after this phase. | Full `metadata.openclaw{...}` (single-line JSON), `version: 0.9.61`, `name: FSB` (or namespaced fallback per Phase 248 finding); `scripts/doctor.mjs` (six-layer branch dispatcher), `scripts/print-stdio.mjs` (echoes `getSetupSections()` block), `scripts/install-host.mjs` (consent-gated host wrapper); tight SKILL.md body with default-to-FSB rule + progressive-disclosure pointers |
| **250** | USAGE.md + References (prompt content) | USAGE.md links to references; they ship together. Where the skill goes from "executable" to "teaches the right priors". | USAGE.md (3-step install + try-it prompts + doctor recovery + multi-path Chrome install); five reference files: `tool-decision-tree.md`, `multi-agent-contract.md`, `restricted-tab-recovery.md`, `vault-boundary.md`, `default-to-fsb.md` |
| **251** | Tests + CI Integration | Skill cannot regress silently. Static-content lint adds ~50ms to existing `npm test` chain; belongs in `ci / all-green` gate. PITFALLS verification concerns fold here. | `tests/skill-fsb-spec.test.js` wired into root `package.json`; verifies frontmatter, `requires.bins` content, stdio block matches `getSetupSections()`, all five references exist + reference typed errors + `back` tool, USAGE.md references Web Store URL + GitHub Releases fallback; optional local-only doctor smoke; cross-platform sanity |
| **252** | Doc Updates + Milestone Close | Skill must be discoverable from existing READMEs and `install --list` output. ClawHub publication explicitly deferred to a separate post-milestone step with its own pre-publish QA pass. | `README.md` Quick Start TL;DR + Repository Layout `skills/` row; `mcp/README.md` OpenClaw paragraph pointing at skill; `mcp/src/install.ts:413-420` fallback text update; optional `package:skill` script; optional `showcase/.../llms*.txt`; full `npm run ci` green; milestone audit + archive |

**Why 5 and not 6 or 7:** Splitting SKILL.md from scripts produces non-shippable PRs (each is non-functional alone). Splitting USAGE.md from references same logic. No phase for extension changes, MCP-server changes, or new tools (none required by milestone scope).

---

## Top 5 Cross-Cutting Findings (Multi-Researcher Convergence)

1. **Phase 248 spec-verification gate is mandatory and goes first.** STACK, FEATURES, ARCHITECTURE, PITFALLS all flag this. Specifically: `metadata.openclaw.install[]` schema, accepted `requires.bins` values, `command-arg-mode` semantics, first-invocation hook timing must be verified against a live OpenClaw build BEFORE SKILL.md frontmatter is finalized. Doing this late forces SKILL.md rewrites.

2. **Doctor-first branch dispatcher is the correct first-run UX.** STACK, FEATURES, ARCHITECTURE all describe this exact flow: skill spawns `npx -y fsb-mcp-server doctor`, parses the failing layer (package / bridge / extension / active-tab / content-script / config), branches deterministically. Never run `install` blindly. Reuses already-shipped layer-aware diagnostics from v0.9.35 Phase 200.

3. **Print stdio config block -- never auto-write OpenClaw config.** All four researchers explicitly call this out. `mcp/src/install.ts:413-420` is "manual / unsupported" because OpenClaw's MCP config schema is unstable across builds. Auto-writing risks (a) silent key-shape mismatch, (b) format corruption, (c) duplicate entries on re-install. The skill must print and let the user paste -- no exceptions in this milestone.

4. **`metadata.openclaw.requires.env` must be empty.** STACK, FEATURES, PITFALLS all explicitly flag this. Provider API keys (xAI / Anthropic / OpenAI / Gemini) live inside the FSB Chrome extension's encrypted storage (`secure-config.js`), NOT in the MCP server process and NOT in the OpenClaw host process. Declaring them in `requires.env` creates a fake dependency AND a real leak surface (real OpenClaw bug echoing env values back through `skills.update` API responses).

5. **Token-budget discipline: SKILL.md under ~600 tokens; everything else lives in `references/` loaded on demand.** STACK, FEATURES, ARCHITECTURE, PITFALLS all converge on progressive disclosure. Inlining all 60 tool docs / multi-agent contract / visual-session lifecycle / restricted-tab playbook bloats every OpenClaw turn by 4-8k tokens whether or not FSB is invoked. SKILL.md is for the agent (tight); USAGE.md is for the human (3-step + try-it + recovery); they must be disjoint, not duplicates.

---

## Top 3 Unresolved Open Questions (Block SKILL.md, NOT Requirements)

These belong to Phase 248 spec-verification and do not block requirements scoping. Flagging them so the roadmapper assigns them to Phase 248.

1. **Exact `metadata.openclaw.install[]` schema** -- flat list of shell commands? `{step, command, args}` objects? Host-specific shape? Affects what `print-stdio.mjs` emits and whether the install hook can run `doctor` directly. Resolution: Phase 248 live-build verification before SKILL.md authoring (Phase 249).

2. **Skill-name availability on ClawHub for the bare `FSB`** -- three-letter all-caps names are high-collision. If `FSB` is taken (or auto-suffixed by ClawHub publish), the milestone must commit to a namespaced lowercase variant (e.g., `fsb-browser`) with `displayName: FSB`. Affects SKILL.md frontmatter, every reference file's self-mention, README copy, and any `/fsb` slash-command examples in USAGE.md. Resolution: `clawhub search fsb` (or equivalent) in Phase 248 before SKILL.md commits.

3. **First-invocation hook timing** -- does OpenClaw run `metadata.openclaw.install[]` automatically when the skill is loaded, or only when the user types `/fsb`? Determines whether `doctor.mjs` is the "main" entrypoint (auto-runs at install) or whether SKILL.md must instruct the user to explicitly invoke setup. Drives USAGE.md's "3-step install" wording. Resolution: Phase 248 live-build verification.

---

## Out of Scope for v0.9.61 (Anti-Feature List)

Explicitly NOT in this milestone -- temptations to resist:

- Auto-writing OpenClaw MCP config -- `--openclaw` install flag stays "manual / unsupported"; print stdio block only.
- New `--openclaw` install flag in `mcp/src/install.ts` -- defer until OpenClaw publishes a stable MCP-config schema.
- Re-running install/setup logic on every skill invocation -- only run on `/fsb setup` and on first install hook.
- Embedding AI provider API keys / vault secrets / installer credentials in the skill folder -- `requires.env` must be empty.
- Bypassing FSB's vault by encouraging the agent to type passwords with `type_text` -- passwords go through `fill_credential` only.
- Auto-launching the Chrome Web Store URL via `chrome://` or `open` on install -- print URL; let user click.
- Recommending `run_task` (autopilot) as the default entry point -- `run_task` ONLY when user explicitly delegates the whole task to FSB.
- Fabricating `agent_id` to "improve session tracking" -- server mints; callers MUST NOT pass it (v0.8.0 contract).
- Baking a `--force` reinstall path into setup -- hides root cause; doctor-first rule.
- Bundling `fsb-mcp-server` source / `node_modules` into the skill -- stay on `npx -y fsb-mcp-server`.
- Custom WebSocket port discovery / multiple bridge endpoints -- bridge stays at `ws://localhost:7225`.
- Cross-tab / multi-window orchestration logic inside the skill -- v0.8.0 already enforces tab ownership; document typed errors; let the agent obey them.
- Verbose auto-generated SKILL.md body -- anti-pattern; tighten boundaries.
- New MCP tools or extension changes -- zero new tools, zero extension diffs.
- Eager auto-install into detected MCP hosts -- must be detect-list-confirm with explicit `y/n` per host; no `--all` without consent.
- A `package.json` inside the skill folder -- skill is a directory of text files, not an npm package.
- A `plugin.json` / `openclaw.plugin.json` -- plugin format is for multi-skill bundles; we ship one.
- Emojis anywhere in SKILL.md / USAGE.md / scripts / logs -- global user rule: plain text + ASCII status markers (`[OK]` / `[FAIL]` / `[WARN]`).
- ClawHub publication itself -- deferred to a separate post-milestone step with its own pre-publish QA pass (VirusTotal + ClawScan + secret grep + invisible-unicode strip + GitHub-account-age check).
- Localised SKILL.md / USAGE.md (i18n) -- defer past v1.0.
- Skill telemetry / opt-in observability channel -- defer past v1.0.
- Multi-skill split (`FSB-Reader` + `FSB-Driver`) -- defer past v1.0.

---

## Confidence

| Area | Level | Reason |
|------|-------|--------|
| FSB-side integration points (CLIs, files, build/test surface) | HIGH | Codebase walked; line-numbered references throughout |
| First-run boot sequence (doctor branching) | HIGH | Built directly on `mcp/README.md` Diagnostics + v0.9.35 layered diagnostics |
| Repo layout (`skills/FSB Skill/` top-level) | HIGH | Matches existing peer pattern (`extension/`, `mcp/`, `showcase/`) |
| Versioning + script language choice | HIGH | Tradeoff matrices in STACK + ARCHITECTURE converge |
| OpenClaw frontmatter schema | LOW (deferred to Phase 248) | Live OpenClaw build verification required; PROJECT.md target requirement |
| ClawHub publishing path + name policy | MEDIUM | Multiple sources agree on shape; specific scan thresholds undocumented |
| Anti-feature list discipline | HIGH | All four researchers converged independently |

**Overall: MEDIUM-HIGH.** Sufficient to draft a roadmap; pending Phase 248 to finalize SKILL.md content.

---

## Source Files

- [STACK.md](STACK.md) -- OpenClaw skill spec, frontmatter, scripting language, dependency declarations
- [FEATURES.md](FEATURES.md) -- table-stakes / differentiators / anti-features for the skill
- [ARCHITECTURE.md](ARCHITECTURE.md) -- repo layout, first-run boot sequence, cross-tool boundary, build/CI, doc inventory, dependency graph, 5-phase decomposition
- [PITFALLS.md](PITFALLS.md) -- 17 critical pitfalls with warning-sign / prevention / phase mapping
- [PITFALLS-PREV-MILESTONES.md](PITFALLS-PREV-MILESTONES.md) -- archived prior-milestone pitfalls (preserved verbatim)
