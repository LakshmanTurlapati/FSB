# Architecture Research: OpenClaw FSB Skill (v0.9.61)

**Domain:** OpenClaw skill package integrating into existing FSB monorepo (Chrome MV3 extension + `fsb-mcp-server` npm package + Angular showcase)
**Researched:** 2026-05-08
**Mode:** Project Research (subsequent milestone v0.9.61, branch `Claw`)
**Confidence:** HIGH on FSB-side integration points (codebase walked); MEDIUM on exact OpenClaw `metadata.openclaw` schema (per PROJECT.md it requires live-build verification before SKILL.md is finalized)

---

## 1. Scope and Constraints

This document answers a single question: **how does the new OpenClaw FSB skill plug into FSB's existing architecture?** It deliberately does not re-derive the extension/MCP/showcase architecture (covered in prior milestone research) and assumes the following invariants from `PROJECT.md`, `mcp/README.md`, `mcp/src/install.ts`, and root `README.md`:

- The MCP bridge contract (`ws://localhost:7225` extension <-> hub, `http://127.0.0.1:7226/mcp` Streamable HTTP) is fixed for this milestone. The skill consumes it; it does not change it.
- `fsb-mcp-server@0.8.0` is tag-ready but not yet published. `npm publish` remains user-gated.
- `mcp/src/install.ts` lines 412-421 declare OpenClaw status as `manual / unsupported`. Auto-writing into an OpenClaw config file is explicitly out of scope; the skill must print stdio config and let the user paste it.
- The 60 MCP tools (visual-session 2 + autopilot 4 + manual 37 + read-only 8 + observability 5 + vault 4) are the public surface the skill teaches. The skill does not register new tools.
- Multi-agent contract from v0.9.60 is mandatory boilerplate the skill must surface: callers must not pass `agent_id`; typed errors `TAB_NOT_OWNED` / `AGENT_CAP_REACHED` / `TAB_INCOGNITO_NOT_SUPPORTED` / `TAB_OUT_OF_SCOPE` must be explained; `back` tool replaces `execute_js("history.back()")`.
- Chrome extension is distributed via Web Store ID `badgafnfchcihdfnjneklogedcdkmjfk`. The skill cannot install it; it can only deep-link.
- Vault boundary: secrets never appear in chat; `fill_credential` and `use_payment_method` are the only legal autofill paths.

The skill is, by design, the thinnest possible adapter: a markdown spec with a few shell scripts that orchestrate calls into already-shipped FSB CLIs. It owns no new server logic, no new bridge messages, and no new MCP tools.

---

## 2. Recommended Repo Layout

### Recommendation: top-level `skills/FSB Skill/`

The monorepo currently has these top-level peers:

```
FSB/
├── extension/          # MV3 Chrome extension
├── mcp/                # fsb-mcp-server npm package (TypeScript)
├── showcase/           # Angular 20 marketing site + Express relay
├── server/             # (untracked, present in working tree)
├── server-py/          # legacy FastAPI prototype
├── tests/              # root-level tests covering all packages
├── scripts/            # repo maintenance + validate-extension.mjs
├── store-assets/       # (untracked, Chrome Web Store assets)
├── site-guides/        # (untracked, site-guide markdown corpus)
├── mcp-server/         # (untracked, transitional or legacy)
└── .planning/          # GSD planning + research
```

The skill should live at `FSB/skills/FSB Skill/` (note the literal space in the folder name, per milestone scope). Inside:

```
skills/FSB Skill/
├── SKILL.md                    # frontmatter: name: FSB, OpenClaw metadata
├── USAGE.md                    # user-facing one-pager (3-step install + try-it prompts)
├── references/
│   ├── tool-decision-tree.md   # read-only first → typed events → run_task last
│   ├── multi-agent-contract.md # TAB_NOT_OWNED / AGENT_CAP_REACHED / back tool / no agent_id
│   ├── restricted-tab-recovery.md  # list_tabs/navigate/open_tab/switch_tab playbook
│   ├── vault-boundary.md       # fill_credential / use_payment_method only
│   └── default-to-fsb.md       # soft preference + hard escalation rule
└── scripts/
    ├── doctor.sh               # wraps `npx -y fsb-mcp-server doctor`, parses layer, branches
    ├── install-host.sh         # optional: `npx -y fsb-mcp-server install --<host>`
    └── print-stdio.sh          # emits the OpenClaw stdio config block
```

### Pros and cons of each layout option

| Layout | Pros | Cons | Verdict |
|--------|------|------|---------|
| **`skills/FSB Skill/`** (top-level peer) | Matches OpenClaw's first-class concept of "skills"; symmetric with `extension/`, `mcp/`, `showcase/`; future skills (Claude Code, Codex) drop in alongside; easy to add to `package.json` `files` for any future skill bundle; clean ownership boundary in `CODEOWNERS` | Folder name has a space, which forces quoted paths in shell + CI; one more top-level entry to ignore in `.gitignore`/`tsconfig` includes | **Recommended.** Space-in-name is non-negotiable per milestone scope (matches what OpenClaw scans). |
| **`mcp/skills/FSB Skill/`** (under MCP) | Co-located with the binary the skill calls (`fsb-mcp-server`); easier to keep skill version aligned with MCP version | Conflates packaging boundaries: `mcp/` publishes to npm and uses `mcp/build/`; nesting a non-TS, non-published skill inside it adds noise to `.npmignore` and `npm pack` filtering; if OpenClaw later scans `<repo>/skills/`, this hides the skill | Reject. |
| **`FSB Skill/`** (top-level, no `skills/` parent) | Flattest possible | No room for additional skills later; folder name with space at top-level is the most disruptive variant; harder to glob (`skills/*/SKILL.md`) | Reject. |
| **`.planning/skills/`** | Keeps it out of shipping artifacts | Wrong semantics — `.planning/` is for GSD planning, not deliverables; OpenClaw cannot find it | Reject. |

The `skills/` parent gives a future-proof glob target (`skills/*/SKILL.md`) that the skill discovery code, CI lint, and any "list our skills" docs page can rely on without hardcoding the FSB skill name.

---

## 3. First-Run Boot Sequence

The skill's first-run flow is a **doctor-first branch tree**. The skill never blindly runs `install`; every branch is gated on the layer that `fsb-mcp-server doctor` reports failing. This matches the doctrine codified in `mcp/README.md` Diagnostics ("Only restart or reinstall the client when the reported layer points there") and is the same posture v0.9.35 hardened.

### 3.1 Ordered call graph

```
[user invokes "FSB" skill in OpenClaw]
        │
        ▼
[OpenClaw loader] reads SKILL.md
        │
        │ injects metadata.openclaw.requires.env (PATH, HOME, etc.)
        ▼
[scripts/doctor.sh]
        │
        ▼
   exec: npx -y fsb-mcp-server doctor
        │
        │ parses output → identifies failing layer
        ▼
   ┌────────────────────────────────────────────────┐
   │  Layer reported by doctor                      │
   ├────────────────────────────────────────────────┤
   │  package    → npm + Node available?            │── if no → stop, tell user to install Node 18+
   │  bridge     → ws://localhost:7225 reachable?   │── if no → instruct: ensure no other hub
   │  extension  → extension connected to bridge?   │── if no → branch A (Web Store install)
   │  active-tab → normal http(s) tab in foreground?│── if no → branch B (open a real tab)
   │  content-script → script injected on tab?     │── if no → instruct: refresh tab
   │  config     → host MCP config present?         │── if no → branch C (print stdio block)
   │  ALL GREEN  →                                   │── branch D (try-it prompt + USAGE.md)
   └────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────┐
   │  Branch A: extension missing             │
   │  - print Web Store URL                   │
   │  - URL: chromewebstore.google.com/.../   │
   │           badgafnfchcihdfnjneklogedcdkmjfk│
   │  - run `wait-for-extension` (poll bridge) │
   │  - re-run doctor on connection           │
   └──────────────────────────────────────────┘
   ┌──────────────────────────────────────────┐
   │  Branch B: restricted active tab         │
   │  - tell user to focus a normal tab       │
   │  - retry doctor                          │
   └──────────────────────────────────────────┘
   ┌──────────────────────────────────────────┐
   │  Branch C: OpenClaw stdio config missing │
   │  - print exactly:                        │
   │      command: npx                        │
   │      args:    -y fsb-mcp-server          │
   │  - tell user to paste into OpenClaw cfg  │
   │  - (optional) detect other MCP hosts on  │
   │    the same machine and offer            │
   │    `npx -y fsb-mcp-server install --<x>` │
   │    using install.ts flag matrix          │
   └──────────────────────────────────────────┘
   ┌──────────────────────────────────────────┐
   │  Branch D: all green — ready             │
   │  - read USAGE.md                         │
   │  - suggest 2-3 try-it prompts            │
   │  - reminder: start_visual_session(client │
   │    ="OpenClaw") for any sequence         │
   └──────────────────────────────────────────┘
```

### 3.2 Data flow per branch

| Step | Producer | Consumer | Payload |
|------|----------|----------|---------|
| 1 | OpenClaw loader | `scripts/doctor.sh` | env vars from `metadata.openclaw.requires.env` (PATH, HOME, NODE_PATH) |
| 2 | `scripts/doctor.sh` | `npx -y fsb-mcp-server doctor` (child process) | none (CLI invocation) |
| 3 | `fsb-mcp-server doctor` | parser in `doctor.sh` | stdout containing primary failing layer label |
| 4 | parser | branch dispatcher | `{layer: 'package'\|'bridge'\|'extension'\|'active-tab'\|'content-script'\|'config'\|'ok'}` |
| 5 (Branch A) | dispatcher | user (stdout) | Web Store URL + `wait-for-extension` instruction |
| 5 (Branch C) | dispatcher | user (stdout) | OpenClaw stdio block + (optional) detected-host install offers |
| 5 (Branch D) | dispatcher | user (stdout) | `USAGE.md` content + try-it prompts |
| 6 | user | OpenClaw runtime | (after manual paste/install) restart; on next invocation, doctor returns `ok` |
| 7 | OpenClaw runtime | FSB MCP tools | tool calls wrapped with `client="OpenClaw"` visual session |

### 3.3 Why doctor-first, not install-first

Three reasons that come directly from existing design decisions logged in `PROJECT.md`:

1. **v0.9.35 Phase 200** classified failures into `package/config/bridge/extension/content-script/tool-routing` and codified "guide operators through `doctor` and `status --watch` first". Re-running `install` when the bridge is the actual problem is the most common failure-multiplier.
2. **OpenClaw's status is `manual / unsupported`** in `mcp/src/install.ts:413-420`. There is no safe write target for `install --openclaw`, so the skill cannot install for OpenClaw the way it can for Claude Desktop. It must instruct the user.
3. **MV3 service-worker reality:** the bridge can be down because Chrome put the SW to sleep, not because the config is broken. Doctor distinguishes those; `install` cannot.

---

## 4. Cross-Tool Boundary

This table is the single source of truth for "who does what" during the skill lifecycle.

| Action | Who | How | Notes |
|--------|-----|-----|-------|
| Detect Node 18+ available | OpenClaw | `metadata.openclaw.requires.bins: [npx, node]` | Fail-fast at skill load if missing; skill never runs |
| Inject `PATH`, `HOME` | OpenClaw | `metadata.openclaw.requires.env` | Skill scripts assume these are present |
| Run preflight diagnostics | **Skill (direct)** | `scripts/doctor.sh` → spawns `npx -y fsb-mcp-server doctor` | Direct subprocess; parses stdout |
| Detect other MCP hosts | **Skill (direct)** | filesystem checks for known config paths (mirrors `install --list`) | Optional; `install --list` already does this — skill can shell out and parse |
| Install FSB MCP into other hosts | **Skill (direct, opt-in)** | `npx -y fsb-mcp-server install --<host>` per detected host, with user confirmation | Reuses existing 21-platform installer in `mcp/src/install.ts` |
| Install FSB MCP into OpenClaw itself | **User (manual)** | skill prints `command: npx`, `args: -y fsb-mcp-server`; user pastes into OpenClaw config | Forced by OpenClaw "manual / unsupported" entry at `install.ts:413-420` |
| Install Chrome extension | **User (manual)** | skill prints Web Store URL; user clicks "Add to Chrome" | Browser security: extensions cannot be sideloaded by a CLI |
| Wait for extension to come online | **Skill (direct)** | `npx -y fsb-mcp-server wait-for-extension` | Existing CLI; polls the bridge |
| Wrap a tool sequence with the trusted overlay | **Skill (instructs OpenClaw model)** | "before any sequence call `start_visual_session(client="OpenClaw", task=..., detail=...)`" | `OpenClaw` is on the v0.9.36 trusted-label allowlist (per `mcp/README.md`); end with `end_visual_session(session_token)` |
| Pick the right MCP tool for a step | **OpenClaw model (taught by skill)** | references/tool-decision-tree.md prompts: read-only first, typed events over `.value`, `run_task` only on explicit delegation | The skill is mostly a prompt-engineering artifact at this layer |
| Surface multi-agent typed errors | **Skill (instructs OpenClaw model)** | references/multi-agent-contract.md teaches: do not pass `agent_id`; on `TAB_NOT_OWNED` switch to a tab the agent already owns; on `AGENT_CAP_REACHED` increase cap or end an idle agent; never enter incognito | All error codes already shipped in v0.9.60 |
| Recover a restricted tab | **Skill (instructs OpenClaw model)** | references/restricted-tab-recovery.md prescribes the `list_tabs` → `navigate` / `open_tab` / `switch_tab` ladder | Bootstrap-safe per v0.9.60 Phase 247 |
| Autofill credentials | **Skill (instructs OpenClaw model)** | "always `fill_credential` / `use_payment_method`; never type the password into chat" | Vault boundary already enforced server-side; skill rule prevents accidental leak in transcripts |
| Default web-automation requests to FSB | **Skill (instructs OpenClaw model)** | references/default-to-fsb.md: soft preference if FSB tool fits; hard escalation for click/type/auth/multi-tab | Pure prompt rule; no runtime gate exists in OpenClaw to enforce it |

The clean separation: **the skill calls FSB CLIs as a subprocess; it tells the user what only the user can do; everything else is prompt content that travels with OpenClaw's invocation.**

---

## 5. Build/CI Integration

### 5.1 Does the skill need a build step?

No. The skill is markdown + shell. Treat it like `site-guides/` corpus: source-of-truth = filesystem; no transpile, no bundle.

If `metadata.openclaw.install[]` ever needs JSON injection from `mcp/src/version.ts` (e.g. to pin `fsb-mcp-server@0.8.0` in the printed stdio block), add a tiny templating step to `scripts/`. As of this milestone scope it is sufficient to hardcode `npx -y fsb-mcp-server` (no version pin), matching the pattern `mcp/src/install.ts` already uses for every host.

### 5.2 Should `npm run test:*` cover it?

Yes, with a minimal new test file:

```
tests/skill-fsb-spec.test.js
```

Verify:

- `skills/FSB Skill/SKILL.md` exists, has frontmatter `name: FSB`
- `metadata.openclaw.requires.bins` includes `npx`
- Stdio block printed by `scripts/print-stdio.sh` matches the canonical line `npx -y fsb-mcp-server` from `getSetupSections()` in `mcp/src/install.ts`
- Web Store URL (`chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk`) is referenced in SKILL.md and USAGE.md
- All four reference files exist and are non-empty
- USAGE.md mentions all four typed errors and the `back` tool

This is a static-content lint, not a runtime test. It belongs in the existing root `npm test` chain (the long string in `package.json` line ~26) so the `ci / all-green` gate naturally covers the skill on PRs to `main`.

A second smoke that actually shells out to `doctor` is desirable but should be opt-in: it depends on a live extension and a live bridge, which CI doesn't have. Mirror the existing `npm run test:mcp-smoke` pattern — keep it as a separate script for local/manual runs.

### 5.3 Packaging for ClawHub distribution

If/when ClawHub becomes a real distribution channel, packaging is a `zip` of `skills/FSB Skill/`. Add to `package.json`:

```json
"package:skill": "cd skills && zip -r ../fsb-skill-v0.9.61.zip 'FSB Skill' -x '*.DS_Store'"
```

This mirrors the existing `package` and `package:extension` scripts. No npm publish is needed: the skill is not a Node package.

For the milestone, a `package:skill` script + a one-line section in the release notes is enough; a real ClawHub publish workflow is out of scope until ClawHub itself stabilizes.

### 5.4 CI job in `ci / all-green`

No new job. Add the skill spec test to the existing `npm test` invocation in CI. The validation is fast (filesystem reads + frontmatter parse) and adds ~50ms. Creating a separate job introduces orchestration cost without corresponding signal value.

If the user later decides to split `tests/` per-package (already on the deferred list in `PROJECT.md`), then a `tests/skill/` subfolder lands naturally; for v0.9.61, keep it flat.

---

## 6. Versioning Alignment

### Recommendation: track the extension milestone (`0.9.61`), not the MCP package (`0.8.0`)

Three options were considered:

| Option | Pros | Cons |
|--------|------|------|
| Track `fsb-mcp-server` (`0.8.0`) | Skill is most tightly coupled to MCP tool surface; tool changes are exactly what would break the skill | MCP version moves slowly relative to skill content; skill copy will drift earlier than `0.8.x` rolls |
| **Track milestone (`0.9.61`)** | Aligns skill ship cadence with the rest of the FSB monorepo; users see one version when they look at the project; future skill bumps happen at milestone close, same as the rest | Skill version may be ahead of `fsb-mcp-server` semver — that is a feature, not a bug |
| Independent semver (`skill@1.0.0`) | OpenClaw norm if every skill author uses semver | One more version stream to keep in sync; no benefit if the only skill maintainer is the FSB project |

**Pick option 2.** Encode it in SKILL.md frontmatter as `version: 0.9.61` and bump it whenever the milestone version bumps. When MCP tool contracts change in a way that affects the skill, the milestone version will move anyway (per the existing release-sanity-checks rule in `README.md` "Change Guidelines").

### Upgrade story

When FSB MCP tools change:

1. The `mcp/README.md` "tool count contract" line forces a doc update.
2. Tests in `tests/tool-definitions-parity.test.js` and `tests/mcp-tool-routing-contract.test.js` catch contract drift.
3. The new skill spec test (`tests/skill-fsb-spec.test.js`) should include a check that any tool referenced by name in `references/*.md` still exists in `mcp/ai/tool-definitions.cjs`. This is the same shared-contract pattern `mcp/src/tools/schema-bridge.ts` already uses.

That trio means a tool rename or removal cannot ship without flagging the skill.

---

## 7. Documentation Surfaces — Every Doc That Must Change

| Doc | Why | What to change |
|-----|-----|----------------|
| `README.md` (root) | Quick Start TL;DR currently lists 7 MCP host install commands; OpenClaw is not in that table | Add an "OpenClaw users" line below the install table referencing the new skill (no `install --openclaw` command — it remains manual); link to `skills/FSB Skill/USAGE.md`. Also update the "Repository Layout" table to include `skills/`. |
| `README.md` (root) | Quick Start references "OpenCode and OpenClaw are supported through manual or unsupported fallback setup paths" (line ~322) | Augment with: "FSB also ships an OpenClaw skill at `skills/FSB Skill/` that automates the doctor → install → Web Store → ready flow." |
| `mcp/README.md` | OpenClaw is currently mentioned only in the trusted-label allowlist | Add a sentence pointing OpenClaw users at the skill instead of `install --openclaw` (which is intentionally unsupported). |
| `mcp/src/install.ts` line 413-420 | Currently says "Status: manual / unsupported for now" | Update fallback line to: "Use the FSB OpenClaw skill in `skills/FSB Skill/` for guided setup." Optional but valuable for users who run `install --list` first. |
| `skills/FSB Skill/SKILL.md` | NEW | Full skill spec with `name: FSB` frontmatter and OpenClaw metadata block |
| `skills/FSB Skill/USAGE.md` | NEW | 3-step user-facing install + try-it prompts + doctor recovery recipe |
| `skills/FSB Skill/references/*.md` | NEW | Five reference files per Section 2 layout |
| `skills/FSB Skill/scripts/*.sh` | NEW | doctor.sh, install-host.sh, print-stdio.sh |
| `.planning/MILESTONES.md` | Existing milestone log | Add v0.9.61 entry on milestone close (handled by `/gsd:complete-milestone`, not in research scope) |
| `showcase/.../llms.txt` (showcase) | Crawler-visible site map | Mention the OpenClaw skill as an integration path. Low priority — only if showcase content already cross-references MCP host install lines. |
| `showcase/.../llms-full.txt` | Same as above | Same as above |
| `store-assets/` | Untracked Web Store assets | Out of scope unless screenshots advertise OpenClaw integration. |
| `extension/manifest.json` | NO change | Skill does not change the extension. |
| `mcp/package.json` | NO change | Skill does not change the MCP server. The `0.8.0` ship plan is independent. |
| `extension/version.ts` / root version | NO change in research scope | The milestone close decides whether the extension version moves to 0.9.61; the skill ships under whichever number it lands on. |

The "must change" set is small: two READMEs, one TS string in `install.ts`, plus all NEW skill files. No existing test rewrites.

---

## 8. Dependency Graph for Build Order

This is the dependency graph between artifacts produced in this milestone. Read it as: "X must exist (or be confirmed unchanged) before Y can be authored without rework."

```
                    ┌───────────────────────────────────────┐
                    │ A. OpenClaw schema verification        │
                    │    (live build of OpenClaw)           │
                    │    Confirms metadata.openclaw.{       │
                    │      install[], requires.bins,        │
                    │      command-arg-mode}                │
                    └────────────────┬──────────────────────┘
                                     │
                                     ▼
                    ┌───────────────────────────────────────┐
                    │ B. SKILL.md frontmatter               │
                    │    Depends on: A (schema)             │
                    │    Depends on: existing               │
                    │      mcp/src/install.ts stdio cmd     │
                    │      = `npx -y fsb-mcp-server`        │
                    └────────────────┬──────────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
   ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ C. scripts/        │  │ D. references/   │  │ E. USAGE.md      │
   │   doctor.sh        │  │   tool-decision- │  │   user-facing    │
   │   install-host.sh  │  │   tree.md and    │  │   3-step + try-it│
   │   print-stdio.sh   │  │   peers          │  │                  │
   │ Deps:              │  │ Deps:            │  │ Deps:            │
   │ - doctor CLI       │  │ - mcp/README.md  │  │ - SKILL.md       │
   │   stdout shape     │  │   tool list      │  │ - scripts/       │
   │ - install --list   │  │ - v0.9.60 multi- │  │ - Web Store URL  │
   │   format           │  │   agent contract │  │                  │
   │ - getSetupSections │  │ - v0.9.36 trusted│  │                  │
   │   stdio command    │  │   label list     │  │                  │
   │ - chromewebstore   │  │ - v0.9.60 Phase  │  │                  │
   │   URL              │  │   247 recovery   │  │                  │
   └────────────────────┘  └──────────────────┘  └──────────────────┘
                ▼                    ▼                    ▼
            ┌─────────────────────────────────────────────────┐
            │ F. tests/skill-fsb-spec.test.js                 │
            │    Deps: B, C, D, E all in place                │
            │    Runs in existing `npm test` chain            │
            └─────────────────────┬───────────────────────────┘
                                  ▼
            ┌─────────────────────────────────────────────────┐
            │ G. Doc updates: README.md, mcp/README.md,       │
            │    mcp/src/install.ts:413-420                   │
            │    Deps: skill exists at known path             │
            └─────────────────────────────────────────────────┘
```

Key observation: **A (OpenClaw schema verification) gates everything.** Per `PROJECT.md`, the milestone explicitly calls this out as a target requirement ("OpenClaw skill spec verification: confirm exact schema of `metadata.openclaw.install[]`, `requires.bins` accepted values, and `command-arg-mode` behavior against a live OpenClaw build before finalizing SKILL.md frontmatter"). Doing A late means SKILL.md may need a rewrite.

---

## 9. Suggested Phase Decomposition

Five phases. Ordering follows the dependency graph in Section 8. Each phase ends with a green-test checkpoint so the milestone can land incrementally.

### Phase 248: OpenClaw Spec Pin + Repo Scaffolding

**Goal:** lock the schema; create empty skill skeleton.

- Verify against a live OpenClaw build:
  - exact key path `metadata.openclaw.install[]` (or whatever it actually is)
  - accepted values for `requires.bins`
  - behavior of `command-arg-mode`
- Create `skills/FSB Skill/` with empty SKILL.md (frontmatter only), USAGE.md, references/, scripts/.
- Add `skills/` to `.gitignore` exclusions (it should be tracked) and to any tsconfig include patterns that need to skip it.
- No tests yet.

**Exit:** schema captured in a short note inside `.planning/`; `git status` shows the new tree; nothing breaks existing CI.

### Phase 249: SKILL.md + scripts/

**Goal:** make the skill executable end-to-end against an existing FSB install.

- Write SKILL.md with full `metadata.openclaw` block, `name: FSB`, `version: 0.9.61`.
- Write `scripts/doctor.sh` with branch dispatcher (Section 3.1).
- Write `scripts/print-stdio.sh` (echoes the literal block from `getSetupSections()`).
- Write `scripts/install-host.sh` (wraps `npx -y fsb-mcp-server install --<host>` with confirmation; reuses `install --list` for detection).
- Hand-test on local machine: invoke skill in OpenClaw, confirm doctor → branch C prints stdio block, paste into OpenClaw, restart, re-run, see Branch D.

**Exit:** end-to-end happy path works locally; no automated tests yet.

### Phase 250: USAGE.md + references/

**Goal:** ship the prompt content that teaches OpenClaw to use FSB correctly.

- Write USAGE.md (3-step install, try-it prompts, doctor recovery recipe).
- Write the five references in `references/`:
  - `tool-decision-tree.md` (read-only first; typed events over `.value`; `run_task` only on explicit delegation)
  - `multi-agent-contract.md` (no `agent_id`; typed errors; `back` over `execute_js("history.back()")`)
  - `restricted-tab-recovery.md` (the `list_tabs` → recover ladder)
  - `vault-boundary.md` (`fill_credential` / `use_payment_method` only)
  - `default-to-fsb.md` (soft preference + hard escalation)
- All references must wrap any tool sequence example with `start_visual_session(client="OpenClaw")` / `end_visual_session(session_token)`.

**Exit:** skill can be read top-to-bottom and gives an LLM the right priors.

### Phase 251: Tests + CI Integration

**Goal:** lock the skill into the `ci / all-green` gate.

- Author `tests/skill-fsb-spec.test.js` per Section 5.2.
- Add it to the `npm test` chain in root `package.json`.
- Optional: author a separate `tests/skill-fsb-doctor-smoke.test.js` for local-only runs (mirrors `test:mcp-smoke` posture).
- Confirm CI green on a draft PR.

**Exit:** PR-blocking lint passes; skill content cannot regress silently.

### Phase 252: Doc Updates + Milestone Close

**Goal:** make the skill discoverable.

- Update `README.md` Quick Start TL;DR + Repository Layout.
- Update `mcp/README.md` OpenClaw paragraph.
- Update `mcp/src/install.ts:413-420` "OpenClaw" section to point at the skill.
- Update `showcase/.../llms.txt` and `llms-full.txt` if they cross-reference MCP host install lines.
- Optional: `package:skill` script in root `package.json` for ClawHub-ready zip.
- Run full `npm run ci`.
- Milestone audit + archive (handled by `/gsd:complete-milestone`).

**Exit:** v0.9.61 ships; users searching "OpenClaw FSB" find a single canonical entry point.

### Why five phases and not seven

- Splitting "scripts" from "SKILL.md" creates two PRs that can't ship independently — both are needed for end-to-end skill execution. Combined into Phase 249.
- Splitting "references" from "USAGE.md" similarly: USAGE.md links to references; they ship together. Combined into Phase 250.
- No phase for "extension changes" because there are none.
- No phase for "MCP changes" because there are none.

If the user prefers smaller phases, the natural further split is Phase 250 → 250a (USAGE.md) and 250b (references/). I would not split below that granularity.

---

## 10. Cross-Platform Implications

The skill ships shell scripts. The existing `mcp/src/install.ts` has Windows guards (`WINDOWS_STDIO_COMMAND = 'cmd /c npx -y fsb-mcp-server'` at line 29) that the skill must mirror.

| Surface | macOS / Linux | Windows | Mitigation |
|---------|---------------|---------|------------|
| `scripts/doctor.sh` | bash, runs as-is | needs WSL or a `.cmd` sibling | Ship `scripts/doctor.cmd` alongside, or use a Node entrypoint (`scripts/doctor.mjs`) that picks the right invocation |
| Stdio block printed | `npx -y fsb-mcp-server` | `cmd /c npx -y fsb-mcp-server` | Skill should detect `process.platform` and print the right line, mirroring `getSetupSections()` |
| Folder name with space | quoted paths in shell | quoted paths in cmd/PowerShell | Document in USAGE.md; CI on `ubuntu-latest` will catch any shell-quoting regressions |

**Recommendation:** prefer Node-based entrypoints (`scripts/*.mjs`) over `.sh`/`.cmd` pairs. OpenClaw already requires Node 18+ (it runs `npx`), so a Node script is portable by definition and matches how `mcp/` ships. Rewriting bash to Node is half a day of work and avoids permanent maintenance of two script families.

---

## 11. Anti-Patterns to Avoid

### Anti-Pattern 1: Shipping `install --openclaw` as a real installer

**What people do:** add a new platform entry to `mcp/src/platforms.ts` that writes into a guessed OpenClaw config path.
**Why it's wrong:** the entry at `install.ts:413-420` is `manual / unsupported` for a reason — OpenClaw config schema is not stable. A bad write would corrupt user state.
**Do this instead:** keep the print-the-stdio-block flow. Let the user paste. Revisit when/if OpenClaw publishes a stable config contract.

### Anti-Pattern 2: Re-implementing diagnostics in the skill

**What people do:** the skill probes `localhost:7225` directly, scans `chrome.storage`, etc.
**Why it's wrong:** duplicates `fsb-mcp-server doctor` logic; will drift as the diagnostics layer evolves; adds bugs the MCP server already solved (v0.9.35).
**Do this instead:** spawn `doctor` and parse its output. One source of truth.

### Anti-Pattern 3: Letting the skill register MCP tools

**What people do:** SKILL.md declares a new tool surface ("OpenClaw fsb_search" etc.).
**Why it's wrong:** breaks the tool-count contract in `mcp/README.md`; bypasses the canonical registry copied into `mcp/ai/tool-definitions.cjs`; multi-agent contract enforcement (`tab_id` ownership) sits in the dispatcher, which is invisible to skill-level tools.
**Do this instead:** the skill teaches the model how to call existing FSB tools. Period.

### Anti-Pattern 4: Hardcoding a pinned `fsb-mcp-server@X.Y.Z` in the stdio block

**What people do:** SKILL.md prints `npx -y fsb-mcp-server@0.8.0`.
**Why it's wrong:** `mcp/src/install.ts` deliberately uses unpinned `npx -y fsb-mcp-server` everywhere — users get the latest published version, which is the contract they expect. Pinning in the skill creates a third place that has to be bumped on every MCP release.
**Do this instead:** print unpinned. If pinning is ever needed, generate the version string from `mcp/src/version.ts` at script-runtime, not at skill-author-time.

### Anti-Pattern 5: Auto-installing into other MCP hosts without consent

**What people do:** Branch C automatically runs `install --all` after detecting other hosts.
**Why it's wrong:** writes user config files without confirmation; violates the principle of least surprise; the user already chose OpenClaw as their primary.
**Do this instead:** detect hosts (via `install --list`), present a list, require explicit `y/n` per host before invoking `install --<host>`.

---

## 12. Integration Points Summary

This is the table the orchestrator and downstream researchers should treat as authoritative.

### NEW components (skill ships these)

| Path | Type | Owner |
|------|------|-------|
| `skills/FSB Skill/SKILL.md` | markdown spec | skill |
| `skills/FSB Skill/USAGE.md` | markdown user-facing | skill |
| `skills/FSB Skill/references/tool-decision-tree.md` | markdown prompt content | skill |
| `skills/FSB Skill/references/multi-agent-contract.md` | markdown prompt content | skill |
| `skills/FSB Skill/references/restricted-tab-recovery.md` | markdown prompt content | skill |
| `skills/FSB Skill/references/vault-boundary.md` | markdown prompt content | skill |
| `skills/FSB Skill/references/default-to-fsb.md` | markdown prompt content | skill |
| `skills/FSB Skill/scripts/doctor.{sh,mjs}` | script | skill |
| `skills/FSB Skill/scripts/install-host.{sh,mjs}` | script | skill |
| `skills/FSB Skill/scripts/print-stdio.{sh,mjs}` | script | skill |
| `tests/skill-fsb-spec.test.js` | Node test | root tests |

### MODIFIED files (existing — minimal touches)

| Path | Change |
|------|--------|
| `README.md` | add OpenClaw skill row to Quick Start TL;DR; add `skills/` row to Repository Layout |
| `mcp/README.md` | one-line pointer to the skill from the OpenClaw mention |
| `mcp/src/install.ts:413-420` | update OpenClaw fallback text to point at the skill (still no auto-install) |
| `package.json` (root) | append `node tests/skill-fsb-spec.test.js` to the `test` script chain; optional new `package:skill` script |
| `showcase/.../llms.txt` and `llms-full.txt` | optional one-line addition |

### UNCHANGED (intentional non-touch list)

- `extension/**` — no manifest, content-script, or background changes
- `mcp/src/server.ts`, `mcp/src/tools/**` — no new tools, no schema changes
- `mcp/src/platforms.ts` — no new platform entry (OpenClaw stays manual)
- `mcp/package.json` — version stays at `0.8.0`
- `tests/mcp-*.test.js` — existing MCP contract tests untouched
- All AI provider, vault, memory, site-guide modules
- Showcase Angular app and Express relay

### Data flow changes

None at the runtime layer. The skill sits entirely above the MCP boundary:

```
[OpenClaw runtime] ──spawns──► [scripts/doctor.{mjs,sh}] ──spawns──► [npx -y fsb-mcp-server doctor]
                                                                              │
[OpenClaw runtime] ──MCP stdio──► [npx -y fsb-mcp-server] ──ws──► [extension] ──CDP──► [page]
       ▲
       │ (trusted client="OpenClaw" via start_visual_session)
       │
   reads: SKILL.md + USAGE.md + references/*.md  (prompt context)
```

The bridge protocol, MCP tool surface, and extension internals are untouched.

---

## 13. Open Questions for Downstream Researchers

These deliberately stay open because they require live OpenClaw artifacts, not training-data inference:

1. **Exact `metadata.openclaw.install[]` schema:** is it a list of `{step, command, args}` objects, or a flat list of shell commands, or something host-specific? Confirm against a current OpenClaw build before SKILL.md ships. (PROJECT.md target requirement.)
2. **`requires.bins` enum:** what values does the loader accept? `npx`? `node`? `npm`? Or arbitrary strings resolved via `PATH`? (PROJECT.md target requirement.)
3. **`command-arg-mode` semantics:** does it concatenate args or pass them through? Affects whether `print-stdio.sh` should print `npx -y fsb-mcp-server` as one string or `["npx", "-y", "fsb-mcp-server"]`. (PROJECT.md target requirement.)
4. **First-invocation hook:** does OpenClaw run a script automatically when a skill is loaded, or only when invoked? Determines whether `doctor.sh` is the "main" or whether SKILL.md must instruct the user to type a command. Empirical only.
5. **ClawHub publish format:** if the user wants ClawHub distribution, what is the package shape? Tarball, zip, git-repo, registry entry? Out of scope for this milestone but informs the optional `package:skill` script.

These are flagged in the PHASES section above as Phase 248 work.

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| `/Users/lakshmanturlapati/Desktop/FSB/.planning/PROJECT.md` (read full) | HIGH | Milestone scope, target features, validated capabilities, key decisions, multi-agent contract details |
| `/Users/lakshmanturlapati/Desktop/FSB/mcp/README.md` (read full) | HIGH | 60-tool surface breakdown, doctor/status/wait-for-extension CLI shape, multi-agent error codes, 21-platform installer behavior, trusted-label allowlist (includes `OpenClaw`) |
| `/Users/lakshmanturlapati/Desktop/FSB/mcp/src/install.ts` (read full) | HIGH | Stdio command literal `npx -y fsb-mcp-server`, Windows variant, 21-platform flag matrix, OpenClaw "manual / unsupported" entry at lines 412-421, `getSetupSections()` print format |
| `/Users/lakshmanturlapati/Desktop/FSB/README.md` (read full) | HIGH | Repository Layout, CI gate (`ci / all-green`), test chain composition, Web Store URL `badgafnfchcihdfnjneklogedcdkmjfk`, OpenClaw current treatment |
| `/Users/lakshmanturlapati/Desktop/FSB/package.json` (root, partial) | HIGH | Existing `npm test` chain shape, `test:mcp-smoke` posture, `package`/`package:extension` script convention |
| `.github/workflows/` directory listing | MEDIUM | Existence of `ci.yml`, `deploy.yml`, `npm-publish.yml`, `chrome-extension.yml` — confirms CI gate split |
| Live OpenClaw `metadata.openclaw.*` schema | LOW (deferred) | Phase 248 verification target — not done in this research, explicitly flagged in PROJECT.md |

---

*Architecture research for: OpenClaw FSB skill milestone v0.9.61*
*Researched: 2026-05-08 on branch `Claw`*
