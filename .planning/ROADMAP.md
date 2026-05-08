# Roadmap -- v0.9.61 FSB Skill (OpenClaw)

**Milestone:** v0.9.61 FSB Skill (OpenClaw)
**Branch:** `Claw`
**Granularity:** fine
**Phases:** 6 (numbered 248-253; continues from v0.9.60 last phase 247)
**Coverage:** 29/29 v1 requirements mapped
**Created:** 2026-05-08

---

## Goal

Ship an OpenClaw skill at `skills/FSB Skill/` that installs `fsb-mcp-server`, walks the user through FSB Chrome extension install, defaults web-automation requests to FSB, and is ready for ClawHub publication (publish itself remains user-gated). Zero new MCP tools, zero extension changes, zero `mcp/src/server.ts` or `mcp/src/tools/*.ts` diffs.

## Hard Constraints (apply to every phase)

- Repo path: `skills/FSB Skill/` (literal space).
- SKILL.md `name:` field: `FSB` (or namespaced fallback `fsb-browser` + `displayName: FSB` if Phase 248 finds collision).
- All scripts are Node `.mjs` (cross-platform, no shell-specific assumptions).
- `metadata.openclaw.requires.env: []` is mandatory.
- `npx -y fsb-mcp-server` invocations stay unpinned.
- ASCII status markers only (`[OK]` / `[FAIL]` / `[WARN]`); no emojis anywhere in files, scripts, or logs.
- No new MCP tools, no extension diffs, no edits to `mcp/src/server.ts` or `mcp/src/tools/*.ts`.

## Hard Gate

**Phase 248 is a hard gate.** Phases 249-253 cannot start until Phase 248 lands. The OpenClaw schema, `requires.bins` enum, install timing, and ClawHub name decision must be captured in `.planning/` before any SKILL.md frontmatter is authored.

---

## Phases

- [x] **Phase 248: OpenClaw Spec Verification Gate + Repo Scaffolding** -- Verify OpenClaw skill schema against a live build and stand up the empty `skills/FSB Skill/` skeleton. (completed 2026-05-08)
- [ ] **Phase 249: SKILL.md + Scripts** -- Author SKILL.md frontmatter and the three `.mjs` orchestration scripts so the skill is end-to-end executable on a clean machine.
- [ ] **Phase 250: USAGE.md + References + Policy** -- Ship the human-facing one-pager and the five reference files that teach OpenClaw the FSB priors (tools, multi-agent contract, restricted-tab recovery, vault boundary, default-to-FSB rule, visual-session lifecycle).
- [ ] **Phase 251: Tests + CI Integration** -- Wire `tests/skill-fsb-spec.test.js` into the root `npm test` chain so the skill is covered by the `ci / all-green` gate.
- [ ] **Phase 252: Repo Integration & Doc Updates** -- Update `README.md`, `mcp/README.md`, `mcp/src/install.ts:413-420`, and showcase `llms.txt`/`llms-full.txt` so the skill is discoverable from existing entry points.
- [ ] **Phase 253: ClawHub Pre-Publish QA + User-Gated Publish** -- Run the pre-publish QA pass (VirusTotal, ClawScan, secret-grep, invisible-unicode strip, GitHub-account-age, name-collision recheck), document the `package:skill` build, and leave the actual `clawhub publish` user-gated.

---

## Phase Details

### Phase 248: OpenClaw Spec Verification Gate + Repo Scaffolding

**Goal**: A documented, verified set of OpenClaw spec findings (schema of `metadata.openclaw.install[]`, accepted `requires.bins` values, install-hook timing, and ClawHub name decision for `FSB`) plus an empty but committed `skills/FSB Skill/` skeleton, so all downstream phases can author against a known-good shape.

**Depends on**: Nothing (gate phase; first phase of milestone).

**Requirements**: SCAFFOLD-01, SCAFFOLD-02, SCAFFOLD-03, SCAFFOLD-04, SCAFFOLD-05.

**Success Criteria** (what must be TRUE):
  1. A finding document under `.planning/` lists, for each of the four open questions (`metadata.openclaw.install[]` schema, `requires.bins` enum, install-timing, `command-arg-mode` semantics), the exact answer captured against a live OpenClaw build, with the build version recorded.
  2. The ClawHub name-availability check for the bare `FSB` is recorded with a yes/no decision; if collision, the namespaced fallback (`fsb-browser` + `displayName: FSB`) is committed as the canonical name for the rest of the milestone.
  3. `skills/FSB Skill/` exists at the repo top level (sibling to `extension/`, `mcp/`, `showcase/`) with `SKILL.md`, `USAGE.md`, `references/`, and `scripts/` as empty placeholders; `git status` shows the new tree; nothing in the existing CI chain breaks.
  4. Phase 248 is closed with an explicit "schema pinned" sign-off so Phases 249+ can start; no SKILL.md frontmatter has been authored yet.

**Plans**: 2 plans (parallel, both autonomous)

Plans:
- [x] 248-01-PLAN.md -- Refine and pin the OpenClaw spec verification findings doc (.planning/v0.9.61-OPENCLAW-SPEC.md); add schema-pinned sign-off; record ClawHub name decision (covers SCAFFOLD-01..04)
- [x] 248-02-PLAN.md -- Stand up empty skills/FSB Skill/ skeleton (SKILL.md, USAGE.md, references/README.md, scripts/README.md placeholders); no frontmatter, no scripts (covers SCAFFOLD-05)

---

### Phase 249: SKILL.md + Scripts

**Goal**: A working OpenClaw skill that, when loaded into a fresh OpenClaw, can execute the doctor-first branch dispatcher end-to-end, print the canonical OpenClaw stdio block, and offer consent-gated install into other detected MCP hosts -- using only the verified spec from Phase 248.

**Depends on**: Phase 248 (schema, `requires.bins`, install timing, name decision pinned).

**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06.

**Success Criteria** (what must be TRUE):
  1. `skills/FSB Skill/SKILL.md` parses with verified frontmatter: `name`, `description`, `version: 0.9.61`, `user-invocable: true`, `requires.bins` matching the Phase 248 finding, `requires.env: []`, `homepage`, and a single-line `metadata.openclaw{...}` JSON block; SKILL.md body stays under ~600 tokens and uses progressive disclosure (pointers into `references/`, no inlined tool docs).
  2. Running `npx -y fsb-mcp-server doctor` from inside an OpenClaw session that has loaded the skill, via `scripts/doctor.mjs`, shows the failing layer (`package` / `bridge` / `extension` / `active-tab` / `content-script` / `config` / `ok`) and prints the correct next-step instructions with `[OK]`/`[FAIL]`/`[WARN]` markers.
  3. `scripts/print-stdio.mjs` prints the canonical OpenClaw stdio config block sourced from `mcp/src/install.ts` `getSetupSections()` so it cannot drift from the rest of the installer; the printed `command/args` is unpinned `npx -y fsb-mcp-server` (Windows variant uses `cmd /c npx -y fsb-mcp-server` per existing convention).
  4. `scripts/install-host.mjs` detects other MCP hosts via `npx -y fsb-mcp-server install --list`, lists them, prompts `y/n` per host, and only invokes `npx -y fsb-mcp-server install --<host>` on explicit yes; never `--all` without consent; never auto-writes OpenClaw config.
  5. All three scripts run end-to-end on macOS, Linux, and Windows happy paths using `.mjs` only (no `.sh`/`.cmd` siblings); re-running the install end-to-end on a fully-installed system produces zero file mutations and only "already configured" lines.

**Plans**: 4 plans (all Wave 1, autonomous, files_modified disjoint)

Plans:
- [ ] 249-01-PLAN.md -- Author SKILL.md frontmatter (verified OpenClaw shape) and concise body with progressive-disclosure pointers (covers SKILL-01, SKILL-02)
- [ ] 249-02-PLAN.md -- Implement scripts/doctor.mjs (six-layer dispatcher wrapping `npx -y fsb-mcp-server doctor` with [OK]/[FAIL]/[WARN] markers) (covers SKILL-03, SKILL-06)
- [ ] 249-03-PLAN.md -- Implement scripts/print-stdio.mjs (canonical OpenClaw stdio block, parity-locked with mcp/src/install.ts) (covers SKILL-04, SKILL-06)
- [ ] 249-04-PLAN.md -- Implement scripts/install-host.mjs (consent-gated detect-list-confirm flow, never --all, never --openclaw) (covers SKILL-05, SKILL-06)

---

### Phase 250: USAGE.md + References + Policy

**Goal**: The skill teaches OpenClaw the right priors -- the human-facing 3-step install + try-it + recovery recipe in `USAGE.md`, and five reference files that codify the tool decision tree, multi-agent contract, restricted-tab recovery, vault boundary, default-to-FSB rule, and the visual-session wrapping policy.

**Depends on**: Phase 249 (SKILL.md exists and points into `references/`).

**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, POLICY-01, POLICY-02, POLICY-03.

**Success Criteria** (what must be TRUE):
  1. A new user reading `skills/FSB Skill/USAGE.md` from a clean machine can complete a 3-step install (Chrome extension via the canonical Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` plus a GitHub Releases fallback link, then MCP server, then verify), run the try-it prompts (manual `read_page`/`click`/`type_text` plus a single `run_task` autopilot example), and recover from any of the six doctor-failure layers using the documented recipe.
  2. `references/tool-decision-tree.md` explains when to use `read_page` vs `get_dom_snapshot` vs `get_page_snapshot` vs `get_site_guide`, rules typed events over `.value`, and restricts `run_task` to explicit autopilot delegation; every tool name it references exists in `mcp/ai/tool-definitions.cjs`.
  3. `references/multi-agent-contract.md` documents the v0.8.0 contract: never pass `agent_id`; explicitly handles the four typed errors `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`; and shows `back` as the typed replacement for `execute_js("history.back()")`. `references/restricted-tab-recovery.md` lists the seven safe recovery tools (`list_tabs`, `navigate`, `open_tab`, `switch_tab`, `go_back`, `go_forward`, `refresh`) and explains why DOM tools fail on `chrome://`/`edge://`/web-store pages.
  4. `references/default-to-fsb.md` codifies the soft preference for FSB tools when one fits plus a hard escalation rule for any click/type/auth/multi-tab task, with explicit carve-outs for public-doc / JSON / RSS reads (stay-with-WebFetch). `references/vault-boundary.md` documents that passwords/CVV go through `fill_credential` / `use_payment_method` only, no secrets in chat, `requires.env` stays empty, and secrets resolve inside the extension.
  5. `SKILL.md` body includes the visual-session wrapping rule: any external-AI-driven sequence opens with `start_visual_session(client="OpenClaw", ...)` and closes with `end_visual_session(session_token=..., reason=...)`; a `references/` link covers the lifecycle in detail and shows pairing on every error path so the orange glow never gets stuck on a page.

**Plans**: TBD

---

### Phase 251: Tests + CI Integration

**Goal**: The skill cannot regress silently -- a static-content test verifies SKILL.md frontmatter, the printed stdio block parity, the five reference files, USAGE.md links, and the multi-agent typed errors; it is wired into the root `npm test` chain so the existing `ci / all-green` PR gate covers the skill.

**Depends on**: Phase 250 (SKILL.md, USAGE.md, all five `references/*.md`, and all three `scripts/*.mjs` exist).

**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05.

**Success Criteria** (what must be TRUE):
  1. A draft PR touching any file under `skills/FSB Skill/` triggers `tests/skill-fsb-spec.test.js` via the existing `npm test` chain, the test runs without network or a live FSB extension, and the PR is blocked by `ci / all-green` if the test fails.
  2. The test parses SKILL.md frontmatter and verifies presence + shape of `name`, `description`, `version`, `requires.bins`, empty `requires.env`, and that `metadata.openclaw` is a single line of valid JSON.
  3. The test verifies that the stdio block printed by `scripts/print-stdio.mjs` matches the canonical block produced by `mcp/src/install.ts` `getSetupSections()` byte-for-byte (or via shared comparator), so the two sources cannot drift.
  4. The test asserts all five `references/*.md` files exist; verifies `references/multi-agent-contract.md` mentions every typed error name (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`) and the `back` tool; and verifies `references/tool-decision-tree.md` references only tool names that exist in `mcp/ai/tool-definitions.cjs`.
  5. The test verifies `USAGE.md` references the canonical Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` and includes a GitHub Releases fallback link.

**Plans**: TBD

---

### Phase 252: Repo Integration & Doc Updates

**Goal**: The skill is discoverable from every existing entry point an FSB user is likely to read first -- root README Quick Start TL;DR + Repository Layout, `mcp/README.md` OpenClaw paragraph, the `OpenClaw` block in `mcp/src/install.ts:413-420` (`getSetupSections()`), and the showcase LLM-discovery files.

**Depends on**: Phase 251 (skill is locked behind CI before being advertised).

**Requirements**: INTEG-01, INTEG-02, INTEG-03, INTEG-04.

**Success Criteria** (what must be TRUE):
  1. `README.md` Quick Start TL;DR mentions the FSB skill as the canonical OpenClaw onboarding path, and the Repository Layout table includes a `skills/` row pointing at `skills/FSB Skill/`.
  2. `mcp/README.md` updates its OpenClaw paragraph (currently flagging `--openclaw` install as "manual / unsupported") to reference the new skill as the canonical OpenClaw path, while preserving the manual stdio fallback.
  3. The `OpenClaw` block in `mcp/src/install.ts` `getSetupSections()` (lines 413-420 today) is updated so the printed instructions point at the skill directory; the manual stdio fallback line is preserved verbatim.
  4. `showcase/angular/public/llms.txt` and `llms-full.txt` add a brief paragraph mentioning the FSB skill so AI-search crawlers can surface it; the showcase build still succeeds.

**Plans**: TBD

---

### Phase 253: ClawHub Pre-Publish QA + User-Gated Publish

**Goal**: Everything required to ship to ClawHub is in place and recorded -- a clean pre-publish QA pass, a reproducible `package:skill` build script, and a one-command publish flow -- but the actual `clawhub publish` invocation is gated on the user (mirrors the v0.9.60 `npm publish fsb-mcp-server@0.8.0` user-gating pattern).

**Depends on**: Phase 252 (skill is discoverable and CI-green before publish QA runs).

**Requirements**: PUB-01, PUB-02, PUB-03.

**Success Criteria** (what must be TRUE):
  1. A pre-publish QA report under `.planning/` records: VirusTotal scan via `clawhub` CLI dry-run (no findings), ClawScan results (no findings), secret-grep across `skills/FSB Skill/` (no findings -- including no `*_API_KEY`, no `BEGIN PRIVATE KEY`, no `Bearer ` strings), invisible-unicode strip pass, ClawHub-required GitHub-account-age verification result, and a name-collision recheck that confirms the Phase 248 name decision still holds.
  2. A `package:skill` (or equivalent) script in `package.json` reproducibly builds the publishable skill artifact from `skills/FSB Skill/` (e.g. zip without `.DS_Store`), and the build is documented in `mcp/README.md` or top-level `README.md` so the user can rebuild it without rediscovering the command.
  3. A clean `clawhub publish --dry-run` (or equivalent) run completes without findings; the actual `clawhub publish` invocation is left for the user to run as a single command, and is explicitly recorded in the milestone close as user-gated (same posture as the v0.9.60 `npm publish` user-gate).

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 248. OpenClaw Spec Verification Gate + Repo Scaffolding | 2/2 | Complete    | 2026-05-08 |
| 249. SKILL.md + Scripts | 0/4 | Planned                    | - |
| 250. USAGE.md + References + Policy | 0/0 | Not started (gated on 249) | - |
| 251. Tests + CI Integration | 0/0 | Not started (gated on 250) | - |
| 252. Repo Integration & Doc Updates | 0/0 | Not started (gated on 251) | - |
| 253. ClawHub Pre-Publish QA + User-Gated Publish | 0/0 | Not started (gated on 252) | - |

---

## Coverage Validation

29 v1 requirements -> 6 phases -> 100% coverage, no orphans, no duplicates.

| Category | Count | Phase | REQ-IDs |
|----------|-------|-------|---------|
| Spec & Scaffold | 5 | 248 | SCAFFOLD-01, SCAFFOLD-02, SCAFFOLD-03, SCAFFOLD-04, SCAFFOLD-05 |
| SKILL.md & Scripts | 6 | 249 | SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06 |
| USAGE.md & References | 6 | 250 | DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06 |
| Default-to-FSB & Vault Policy | 3 | 250 | POLICY-01, POLICY-02, POLICY-03 |
| Tests & CI | 5 | 251 | TEST-01, TEST-02, TEST-03, TEST-04, TEST-05 |
| Repo Integration & Doc Updates | 4 | 252 | INTEG-01, INTEG-02, INTEG-03, INTEG-04 |
| ClawHub Publication | 3 | 253 | PUB-01, PUB-02, PUB-03 |
| **Total** | **29** | -- | -- |

Mapped: 29/29. No orphans.

### Why POLICY-01..03 ride with Phase 250 (not their own phase)

The policy artifacts (`references/default-to-fsb.md`, `references/vault-boundary.md`, and the `SKILL.md` visual-session paragraph + `references/` link) are the same kind of progressive-disclosure reference content that DOCS-04..06 already produce. Splitting them into their own phase would produce a non-shippable PR -- the policy references are pure prose that ships alongside the rest of `references/`, and `SKILL.md` already has to be edited in Phase 250 for the visual-session rule. Pairing them keeps shippable PR boundaries.

### Why ClawHub publication is its own phase (Phase 253)

The user accepted ClawHub publication into the milestone, but the actual publish is gated -- a separate phase makes the QA pass + user-gated trigger the explicit unit of work, mirroring how v0.9.60 handled the `npm publish` user-gate.

---

## Dependencies & Order

Strict linear order, with Phase 248 as a hard gate:

```
248 (gate) -> 249 -> 250 -> 251 -> 252 -> 253
```

Cross-phase invariants:

- Phase 249-253 cannot start until Phase 248's findings + name decision are written into `.planning/`.
- Phase 251 (tests) reads SKILL.md, all five `references/*.md`, all three `scripts/*.mjs`, and USAGE.md -- so Phases 249 and 250 must both land first.
- Phase 252 (doc updates) advertises the skill -- so Phase 251's CI lock must be in before public surfaces point at it.
- Phase 253 (publish QA) runs against the same artifact discovery surface Phase 252 documents -- so Phase 252 must land first.

---

## Anti-Scope (do not add to any phase)

- New MCP tools, new dispatcher routes, new bridge messages.
- Edits to `mcp/src/server.ts` or `mcp/src/tools/*.ts`.
- Changes to `extension/**`, `extension/manifest.json`, content scripts, or background.js.
- Auto-writing OpenClaw MCP config files (skill prints stdio block; user pastes).
- A new `--openclaw` install flag in `mcp/src/install.ts`.
- Embedding API keys / vault secrets in the skill folder. `requires.env: []` is mandatory.
- Auto-launching the Chrome Web Store URL via `chrome://` or `open` on install.
- Recommending `run_task` (autopilot) as the default entry point.
- Fabricating `agent_id` from the skill (server mints; callers MUST NOT pass).
- Bundling `fsb-mcp-server` source / `node_modules` into the skill.
- Custom WebSocket port discovery; bridge stays at `ws://localhost:7225`.
- Eager auto-install into detected MCP hosts (must be detect-list-confirm with explicit `y/n` per host).
- A `package.json` or `plugin.json` inside the skill folder.
- Emojis anywhere in SKILL.md, USAGE.md, scripts, or logs.
- Localised content (i18n).
- Skill telemetry.

---

*Roadmap created: 2026-05-08 -- branch `Claw` -- continues from v0.9.60 last phase 247.*
