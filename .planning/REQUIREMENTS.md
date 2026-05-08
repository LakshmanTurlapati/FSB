# Milestone v0.9.61 Requirements -- FSB Skill (OpenClaw)

**Goal:** Ship an OpenClaw skill that installs `fsb-mcp-server`, walks the user through FSB Chrome extension install, and defaults web-automation requests to FSB.

**Branch:** `Claw`
**Phase numbering:** continues from v0.9.60 (last phase 247) -- this milestone starts at Phase 248.

**Conventions:**
- REQ-ID format: `[CATEGORY]-[NUMBER]`
- Repo path for the skill: `skills/FSB Skill/` (top-level peer to `extension/`, `mcp/`, `showcase/`).
- SKILL.md `name:` field: `FSB` (with namespaced fallback `fsb-browser` + `displayName: FSB` if Phase 248 ClawHub check finds collision).
- All scripts are Node `.mjs` (cross-platform, single source of truth, `node` already required).
- `requires.env: []` is mandatory (provider keys live inside the FSB extension).
- `npx -y fsb-mcp-server` invocations stay unpinned (matches existing FSB convention).
- Plain text + ASCII status markers (`[OK]` / `[FAIL]` / `[WARN]`) -- no emojis anywhere in skill content, scripts, or logs.

---

## v1 Requirements

### Spec & Scaffold

- [ ] **SCAFFOLD-01**: A live OpenClaw build verifies the exact schema for `metadata.openclaw.install[]` (object shape, required fields, per-`kind` variants) before SKILL.md frontmatter is finalized; finding documented in `.planning/`.
- [ ] **SCAFFOLD-02**: A live OpenClaw build verifies the accepted enum values for `requires.bins[]` (whether `node`, `npx`, or both are accepted) before SKILL.md is committed.
- [ ] **SCAFFOLD-03**: A live OpenClaw build verifies whether `metadata.openclaw.install[]` runs at skill-add time or only at first invocation; finding shapes USAGE.md "3-step install" wording.
- [ ] **SCAFFOLD-04**: A `clawhub search fsb` (or equivalent) confirms whether the bare `name: FSB` is available; if collision, namespaced fallback `fsb-browser` with `displayName: FSB` is documented as the canonical name.
- [ ] **SCAFFOLD-05**: An empty `skills/FSB Skill/` directory exists at the repo top level (sibling to `extension/`, `mcp/`, `showcase/`), with `SKILL.md`, `USAGE.md`, `references/`, and `scripts/` subpaths placeholdered.

### SKILL.md & Scripts

- [ ] **SKILL-01**: `skills/FSB Skill/SKILL.md` ships with verified frontmatter: `name`, `description`, `version: 0.9.61`, `user-invocable: true`, `requires.bins: [node, npx]` (or whatever Phase 248 verifies), `requires.env: []`, `homepage`, single-line `metadata.openclaw{...}` JSON. No emoji, no `priority`, no `must-use` keys.
- [ ] **SKILL-02**: `SKILL.md` body stays under ~600 tokens and uses progressive disclosure -- pointing at `references/*.md` rather than inlining tool docs, multi-agent contract, or visual-session lifecycle.
- [ ] **SKILL-03**: `scripts/doctor.mjs` spawns `npx -y fsb-mcp-server doctor`, parses the failing layer (package / bridge / extension / active-tab / content-script / config / ok), and emits structured branch instructions with `[OK]`/`[FAIL]`/`[WARN]` markers.
- [ ] **SKILL-04**: `scripts/print-stdio.mjs` prints the canonical OpenClaw stdio config block; the printed block is sourced from `mcp/src/install.ts` `getSetupSections()` (or its build output) so it stays in sync with the rest of the installer.
- [ ] **SKILL-05**: `scripts/install-host.mjs` detects other MCP hosts on the machine via the existing `npx -y fsb-mcp-server install --list` output, lists them, asks `y/n` per host, and runs `npx -y fsb-mcp-server install --<host>` only on explicit yes; never `--all` without consent; never auto-writes OpenClaw config.
- [ ] **SKILL-06**: All three scripts are cross-platform (macOS / Linux / Windows) with no shell-specific assumptions; happy path runs end-to-end on a clean machine.

### USAGE.md & References

- [ ] **DOCS-01**: `USAGE.md` ships a 3-step install (extension, MCP, verify) with the Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` and a GitHub Releases fallback link.
- [ ] **DOCS-02**: `USAGE.md` includes "try it" prompts demonstrating manual mode (`read_page`, `click`, `type_text`) and a single autopilot example (`run_task`).
- [ ] **DOCS-03**: `USAGE.md` includes a doctor-failure recovery recipe matching the six-layer branching in `scripts/doctor.mjs`.
- [ ] **DOCS-04**: `references/tool-decision-tree.md` explains when to use `read_page` vs `get_dom_snapshot` vs `get_page_snapshot` vs `get_site_guide`; rules typed events over `.value`; restricts `run_task` to explicit autopilot delegation.
- [ ] **DOCS-05**: `references/multi-agent-contract.md` documents the v0.8.0 contract: never pass `agent_id`; handle the four typed errors (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`); use `back` instead of `execute_js("history.back()")`.
- [ ] **DOCS-06**: `references/restricted-tab-recovery.md` explains why DOM tools fail on `chrome://`/`edge://`/web store and lists the safe recovery tools (`list_tabs`, `navigate`, `open_tab`, `switch_tab`, `go_back`, `go_forward`, `refresh`).

### Default-to-FSB & Vault Policy

- [ ] **POLICY-01**: `references/default-to-fsb.md` defines a soft preference for FSB tools when one fits, plus a hard escalation rule for any click/type/auth/multi-tab task; explicitly carves out public-doc / JSON / RSS reads as stay-with-WebFetch.
- [ ] **POLICY-02**: `references/vault-boundary.md` documents the vault rule: passwords/CVV go through `fill_credential` / `use_payment_method` only; no secrets in chat; `requires.env` stays empty; secrets resolve inside the extension.
- [ ] **POLICY-03**: `SKILL.md` body includes the visual-session wrapping rule: any external-AI-driven sequence opens with `start_visual_session(client="OpenClaw", ...)` and closes with `end_visual_session(session_token=..., reason=...)`; `references/` link covers the lifecycle in detail.

### Tests & CI

- [ ] **TEST-01**: `tests/skill-fsb-spec.test.js` is wired into the root `npm test` chain (and therefore into the `ci / all-green` GitHub Actions gate); it does not require a network or a running FSB extension.
- [ ] **TEST-02**: The test verifies SKILL.md frontmatter (`name`, `description`, `version`, `requires.bins`, empty `requires.env`, single-line `metadata.openclaw` JSON parses).
- [ ] **TEST-03**: The test verifies the printed stdio block in `scripts/print-stdio.mjs` matches the canonical block produced by `mcp/src/install.ts` `getSetupSections()` so they cannot drift.
- [ ] **TEST-04**: The test verifies all five reference files exist; verifies `references/multi-agent-contract.md` mentions every typed error name and the `back` tool; verifies `references/tool-decision-tree.md` references only tool names that exist in `mcp/ai/tool-definitions.cjs`.
- [ ] **TEST-05**: The test verifies `USAGE.md` references the Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` and includes a GitHub Releases fallback link.

### Repo Integration & Doc Updates

- [ ] **INTEG-01**: `README.md` adds a Quick Start TL;DR mention of the FSB skill and a Repository Layout `skills/` row pointing at `skills/FSB Skill/`.
- [ ] **INTEG-02**: `mcp/README.md` updates its OpenClaw paragraph (the one that currently says `--openclaw` install is "manual / unsupported") to reference the new skill as the canonical OpenClaw path; manual stdio fallback stays.
- [ ] **INTEG-03**: `mcp/src/install.ts:413-420` (the `OpenClaw` block in `getSetupSections()`) is updated so the printed instructions point at the skill; manual stdio fallback line is preserved.
- [ ] **INTEG-04**: `showcase/angular/public/llms.txt` and `llms-full.txt` add a brief paragraph mentioning the FSB skill for AI-search discoverability.

### ClawHub Publication

- [ ] **PUB-01**: A pre-publish QA pass runs and is recorded in `.planning/`: VirusTotal scan (dry-run via `clawhub` CLI), ClawScan results, secret-grep across the skill folder, invisible-unicode strip, ClawHub-required GitHub-account-age verification, name-collision recheck.
- [ ] **PUB-02**: A `package:skill` (or equivalent) script reproducibly builds the publishable skill artifact from `skills/FSB Skill/` and is documented in `mcp/README.md` or top-level `README.md`.
- [ ] **PUB-03**: The actual `clawhub publish` invocation is **user-gated** (mirrors the `npm publish fsb-mcp-server` user-gating pattern from v0.9.60). The milestone ships everything required for the user to run a single command and publish; autonomous execution does not run the command.

---

## Future Requirements (deferred past v0.9.61)

- A `--openclaw` install flag in `mcp/src/install.ts` once OpenClaw publishes a stable MCP-config schema.
- A `--force` reinstall path that resets the skill state cleanly.
- A telemetry / opt-in observability channel for skill usage.
- Localised SKILL.md / USAGE.md (i18n).
- A multi-skill split (e.g., `FSB-Reader` + `FSB-Driver`).
- Anti-prompt-injection hardening of `references/` content (treating the references as untrusted by the skill itself, not just by the user).

---

## Out of Scope (explicit exclusions)

- **Auto-writing OpenClaw MCP config.** The skill must print, not write. Reason: OpenClaw's MCP config schema is unstable across builds (see `mcp/src/install.ts:413-420`).
- **New MCP tools or extension changes.** Zero new tools, zero extension diffs. The skill is purely additive documentation + scripts.
- **Embedding API keys / vault secrets in the skill folder.** `requires.env: []` is mandatory.
- **Auto-launching the Chrome Web Store URL** via `chrome://` or `open` on install. Print URL with copy affordance; let user click.
- **Recommending `run_task` as the default entry point.** `run_task` ONLY when user explicitly delegates the whole task to FSB.
- **Fabricating `agent_id` to "improve session tracking".** Server mints; callers MUST NOT pass it.
- **Bundling `fsb-mcp-server` source / `node_modules` into the skill.** Stay on `npx -y fsb-mcp-server`.
- **Custom WebSocket port discovery / multiple bridge endpoints.** Bridge stays at `ws://localhost:7225`.
- **Eager auto-install into detected MCP hosts.** Must be detect-list-confirm with explicit `y/n` per host.
- **A `package.json` inside the skill folder.** Skill is a directory of text files, not an npm package.
- **A `plugin.json` / `openclaw.plugin.json`.** Plugin format is for multi-skill bundles; we ship one.
- **Emojis** anywhere in SKILL.md, USAGE.md, scripts, or logs. Plain text + ASCII status markers only.
- **Localised content** (i18n).
- **Skill telemetry.**

---

## Traceability

(Filled by roadmapper -- maps each REQ-ID to a phase. See ROADMAP.md after roadmap is created.)
