# Feature Research

**Domain:** OpenClaw skill package wrapping the FSB Chrome extension + `fsb-mcp-server` (Agent-Skills-compatible bundle, manual MCP install posture)
**Researched:** 2026-05-08
**Milestone:** v0.9.61 FSB Skill (OpenClaw)
**Confidence:** MEDIUM-HIGH

The frontmatter schema, install-lifecycle, slash-command behaviour, `command-arg-mode: raw` semantics, and progressive-disclosure pattern are all corroborated by official OpenClaw docs and the Anthropic Agent Skills spec (HIGH). Specific ClawHub publishing rituals and the exact diagnostic-output JSON shape for a `command-dispatch: tool` skill are documented loosely (MEDIUM); no live OpenClaw build was exercised — Phase 0 of the milestone is correctly tasked with verifying the literal frontmatter against a running build before SKILL.md is finalized.

---

## Scope Note (read first)

This file maps features the **skill itself** must expose. The underlying browser-automation tool surface — visual sessions, autopilot, manual mode, vault, observability, multi-agent contract, `back` tool, `change_report`, restricted-tab recovery — is already shipped in `fsb-mcp-server@0.8.0` and is **not re-evaluated here**. The skill's job is to (a) make sure that surface is reachable from OpenClaw, (b) teach the agent *when* and *how* to use it, and (c) fail loudly when something is wrong rather than pretend everything works.

Two architectural facts shape every feature below:

1. **OpenClaw MCP support is "manual / unsupported"** in FSB's installer (`mcp/src/install.ts:413-420`). There is no `--openclaw` flag. The skill cannot rely on the same one-command auto-install pattern Claude Desktop / Cursor / Codex enjoy — it must print a canonical stdio config block and walk the user through dropping it into OpenClaw's MCP registry by hand.
2. **OpenClaw skill installer metadata (`metadata.openclaw.install[]`) runs at `openclaw skills install` time, not at every invocation.** First-run UX is therefore split: install-time hooks (idempotent prerequisite checks) vs. invocation-time hooks (doctor / extension verify / config print).

---

## Feature Landscape

### Table Stakes (Users Expect These)

The OpenClaw user installed an FSB skill expecting a one-command path from "I added FSB" to "Claude / OpenClaw can drive my browser." Anything missing here makes the skill feel half-finished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Valid `SKILL.md` with `name: FSB`, frontmatter parse-clean against current OpenClaw build | Without this, OpenClaw rejects the skill at load time and the user sees nothing | LOW | Phase 0 milestone task already calls for live-build verification of `metadata.openclaw.install[]` shape, `requires.bins` accepted values, and `command-arg-mode` behaviour. Don't ship without this gate. |
| `description:` written as task-trigger phrases ("automate Chrome", "click on a webpage", "fill a form", "log into a site", "drive the browser") | OpenClaw pre-loads `name + description` into system prompt; this is the SOLE signal for auto-invocation | LOW | Anthropic Agent Skills guidance: "describe the task to a coworker"; avoid marketing copy. Include the nouns users actually type. |
| Idempotent install-time prerequisite check (`requires.bins: ["node", "npx"]`, optional `requires.env`) | Skill should refuse to "install OK" if the box can't run the MCP server | LOW | Native to OpenClaw: skill load filters on `requires.bins` (each must exist on PATH). Costs nothing, prevents support tickets later. |
| `metadata.openclaw.install[]` entry that runs `npx -y fsb-mcp-server doctor` and surfaces output | At install-time, validate the MCP package can fetch and the bridge can attempt connection | LOW-MEDIUM | Doctor exits with structured layer output (package / bridge / extension / active-tab / content-script / config). Map non-zero to a clear "what to do next" message. |
| Canonical OpenClaw stdio config block printed during install / `/fsb setup` | The OpenClaw installer flag does not exist; user must paste config themselves. Skill must hand them the exact block. | LOW | Block is `{ command: "npx", args: ["-y", "fsb-mcp-server"] }` plus whatever wrapping OpenClaw's MCP registry expects. Phase 0 verifies that wrapper. |
| Chrome Web Store install link (`https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk`) shown verbatim with copy affordance | Without the extension installed, the MCP bridge has nothing to connect to and every browser tool fails | LOW | Single static string; do not auto-launch a URL — print and let the user click. |
| `fsb-mcp-server wait-for-extension` step (or equivalent polling) before declaring setup complete | Many users will install the extension *after* MCP is wired; skill must wait for the handshake | LOW | Existing CLI command. Time-bound (e.g. 60s) with a clear "still waiting -- did you reload Chrome?" message. |
| `/fsb` slash command exposed via `user-invocable: true` | Users on slash-command-driven hosts expect the skill name to be invocable directly | LOW | Confirmed in OpenClaw docs: `user-invocable` defaults to `true`; setting it explicit communicates intent. |
| Doctor recovery recipe surfaced *before* "reinstall" suggestion | `fsb-mcp-server` already pinpoints the failing layer; skill must not regress to "try reinstalling" | LOW | Reuse the README's failure-mode table verbatim -- don't re-author. |
| `USAGE.md` (3-step install / "try it" prompts / doctor recipe) | OpenClaw / ClawHub UIs render skill folder content; users browse before they invoke | LOW | Anthropic Agent Skills convention: USAGE.md / README.md are user-facing; SKILL.md is agent-facing. Keep them disjoint to avoid context bloat in the agent. |
| Default-to-FSB rule documented in SKILL.md body ("for any web automation request, prefer FSB tools") | Without this guidance, the agent will use whatever browser tool is loaded first; skill exists *because* FSB is the right default | LOW | This is descriptive guidance, not a config knob -- there is no "priority" / "must-use" field. Effectiveness depends on the description + body wording. |
| Multi-agent contract documentation: callers MUST NOT pass `agent_id`; explain `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE` | v0.8.0 enforces this server-side; agents that try to fabricate `agent_id` get ignored, but ones that retry-loop on typed errors will spin | LOW (pure docs) | Already explained in `mcp/README.md`; copy-paste into a `references/multi-agent.md`. |
| Vault boundary policy in SKILL.md body ("route credentials through `fill_credential` / `use_payment_method`; never put secrets in chat") | This is a hard product invariant -- secrets do not leave the extension | LOW | Already enforced by the MCP server; documenting it in the skill prevents the agent from suggesting workarounds. |
| Secrets-out-of-skill discipline (no API keys, no `.env` smuggled into `scripts/`) | OpenClaw security stance treats community skills as code dependencies; embedded secrets are a flagged anti-pattern | LOW | Use `requires.env` to declare what env vars the skill *expects* the user to set; never bake values. |
| `version:` pinned in frontmatter, aligned with extension/MCP milestone (e.g. `0.9.61`) | Skills are dependencies; users (and ClawHub) need a version to pin against / scan / update | LOW | Anti-pattern: tracking `latest`. Bump on every milestone alongside `fsb-mcp-server` and the extension. |
| First-invocation read-only-first decision tree (`read_page` -> `get_dom_snapshot` -> `get_page_snapshot` -> `get_site_guide`) | Existing FSB tool selection guide already encodes this; skill must surface it so the agent doesn't reach for `execute_js` first | LOW | Place in `references/decision-tree.md`; SKILL.md body links with one short sentence. Progressive disclosure keeps tokens low. |
| Restricted-tab recovery playbook (`list_tabs` / `navigate` / `open_tab` / `switch_tab` / `go_back` / `go_forward` / `refresh`) | Hitting `chrome://newtab/` with `read_page` is the #1 footgun; v0.9.60 Phase 247 ships the recovery surface | LOW | Reference doc, two-paragraph max -- agent loads on demand. |

### Differentiators (Competitive Advantage)

These are what make the skill feel *crafted* rather than auto-generated. Every item below leverages an existing FSB capability — there's no new browser code to write.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `command-dispatch: tool` + `command-arg-mode: raw` for `/fsb <admin-verb>` to forward raw args to a setup/diag tool | Lets users trigger doctor / setup / re-pair without round-tripping the model -- fast and deterministic | MEDIUM | Phase 0 must verify exact OpenClaw build supports this. Risk: if `command-dispatch` is taken, model can't intervene with intent -- use only for unambiguous admin verbs (`/fsb doctor`, `/fsb setup`, `/fsb status`), not for actual browser tasks. |
| Visual-session auto-wrapping: skill body teaches "for any external-AI-driven sequence, call `start_visual_session(client="OpenClaw")` first, `end_visual_session` last" | Users *see* what's happening -- orange glow, badge, action overlay -- turning an opaque MCP call into a trusted live demo | LOW (docs) | Allowlist already includes `OpenClaw` (per `mcp/README.md` line 279). Skill just has to remember to use it. |
| Cross-host MCP install detection + opt-in install: skill optionally offers to run `npx -y fsb-mcp-server install --claude-desktop / --cursor / --codex / ...` for other hosts on the same machine | A user who installed FSB skill once gets FSB everywhere with one prompt | MEDIUM | 21-platform installer already exists. Skill detects via `install --list`; presents detected hosts as opt-in checkboxes/prompts. Must be opt-in -- auto-installing across hosts without consent is an anti-feature. |
| Decision tree for tool selection embedded as a `references/tool-selection.md` reference file | Picks between `read_page` vs `get_dom_snapshot` vs `get_page_snapshot` vs `get_site_guide`; nudges to typed events (`type_text`) over `.value`; flags `run_task` as user-explicit-only | LOW | Lifts FSB's existing tool-selection guide (already in extension's autopilot system prompt) into reference form. Reuses, doesn't re-author. |
| `get_site_guide` first-class hint: "before any non-trivial site automation, call `get_site_guide` for known patterns" | 50+ site guides ship with FSB; agent ignoring them is the difference between flaky and reliable | LOW | One-line guidance in SKILL.md body + sample in references. `fsb://site-guides` resource already exposes the catalog. |
| `back` tool steering: "use `back` instead of `execute_js("history.back()")`" | v0.9.60 ships ownership-gated `back`; using `execute_js` bypasses ownership and loses the typed status (`ok`/`no_history`/`cross_origin`/`bf_cache`/`fragment_only`) | LOW (docs) | Strong differentiator -- most skills wouldn't know to call this out. |
| `change_report` awareness: "after every action, FSB returns a change report; you don't need to call `read_page` again unless the report says `truncated: true`" | Halves tokens-per-task on action sequences -- measurable user-visible cost win | LOW (docs) | Already documented in `mcp/README.md`; surface it explicitly to OpenClaw. |
| Soft preference + hard escalation rule: "for any web read, FSB tools are preferred; for any click/type/auth/multi-tab task, FSB tools are required" | Stops the agent from inventing its own `fetch()` calls or asking for screenshots when FSB is sitting right there | LOW (docs) | Phrasing matters -- write it as the agent's own checklist, not as marketing. |
| Doctor-first recovery flow: skill instructs agent "if a tool returns an error, call `npx -y fsb-mcp-server doctor` *before* suggesting reinstall" | Existing FSB diagnostics are layer-aware; skill teaches the agent to use them | LOW (docs) | Prevents the failure mode where the agent suggests "try reinstalling the extension" on every transient failure. |
| Branded skill emoji (`metadata.openclaw.emoji`) + homepage link | Polish -- the skill shows up in OpenClaw's UI with FSB's identity | LOW | Use the FSB logo / a browser glyph; homepage = `https://full-selfbrowsing.com` (already prerendered, SEO-ready per v0.9.46). |
| `references/sample-prompts.md` with 5–10 verified working "try it" prompts | First-touch trust: user copy-pastes a known-good prompt and sees the orange glow | LOW | Pull from existing dashboard demos / showcase. |
| Idempotent setup: re-running `/fsb setup` is safe (detects existing install, only fixes the broken layer) | Users will run setup multiple times; skill must not corrupt state on the 2nd run | MEDIUM | Implementation discipline: every install-time / setup-time action is "check then conditionally apply" not "always apply." |
| Live verification step at end of setup: skill performs a tiny round-trip (`list_tabs` or `read_page` against `about:blank`-equivalent) and reports green/red | Ends setup with a real signal, not just "config written" | LOW | Uses already-shipped tools; no new code. |
| `disable-model-invocation: false` (default) intentionally documented | Decision: we *want* the model to auto-invoke FSB when it sees a browser task; we are NOT opting out of model invocation | LOW | Documenting the choice in CHANGELOG / decision log makes the auto-invocation behaviour intentional. |

### Anti-Features (Commonly Requested, Often Problematic)

The skill milestone is small. These are the temptations to NOT chase.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Run `npx -y fsb-mcp-server install --openclaw` automatically | Symmetry with the 17 existing `--<host>` flags; "one-click install" is a strong UX | OpenClaw's MCP support is officially "manual / unsupported" in FSB (`mcp/src/install.ts:413-420`); guessing at OpenClaw's MCP registry path will silently corrupt user config | Print canonical stdio config block; let the user paste it. Re-evaluate when OpenClaw stabilises an MCP file path FSB can write to. |
| Re-run installer/setup logic on every skill invocation | Self-healing; "always make sure setup is good" | Anti-pattern flagged by Agent Skills guide ("running install at every invocation is wasteful"); slows down every prompt; risks infinite loops on partial failures | Run setup only on `/fsb setup` and on first `metadata.openclaw.install[]` execution; on tool failure, suggest `/fsb doctor` instead of silent re-install. |
| Embed AI provider API keys / vault secrets / installer credentials in the skill folder | "Out-of-the-box" polish | OpenClaw security guide flags this explicitly; ClawHub scanners will block; secrets in skills are a known attack vector | Use `requires.env` to declare expected env vars; user supplies via `~/.openclaw/openclaw.json` `skills.entries.<key>.env`. FSB's vault is already the right place for credentials and lives inside the extension. |
| Bypass FSB's vault by encouraging the agent to type passwords with `type_text` | "Simpler" -- fewer tools to learn | Defeats the entire point of the vault boundary; passwords would flow through MCP transport in cleartext | Hard rule in SKILL.md: passwords go through `fill_credential` only. Vault returns metadata only, never raw secrets -- this is a product invariant. |
| Auto-launch the Chrome Web Store URL via `chrome://` or `open` on install | Hands-off UX | OpenClaw skills run install-time hooks in user contexts that may not have a browser, may be remote SSH, may be CI; auto-launching surprises users; failure modes are hard to detect | Print the URL with copy affordance; let the user click. |
| Recommend `run_task` (autopilot) as the default entry point | "Autopilot is the headline feature" | Two failure modes: (a) user wanted manual control, FSB just took over; (b) external agent's plan and FSB's plan fight each other | SKILL.md body: "use `run_task` ONLY when the user explicitly delegates the whole task to FSB; otherwise stay in manual mode." |
| Have the skill fabricate `agent_id` to "improve session tracking" | Looks like a multi-tenant feature | v0.8.0 explicitly ignores caller-supplied `agent_id` and mints its own; passing one is at best dead code, at worst a misleading log line | Document that `agent_id` is server-issued; the skill never touches it. |
| Bake a `--force` reinstall path into setup | Easier troubleshooting | Hides root cause; users will reach for `--force` instead of running doctor | Doctor-first rule. `--force` only as a last-resort flag the user has to type explicitly. |
| Ship the skill bundling its own copy of `fsb-mcp-server` source / `node_modules` | "Offline install" | Bloats the skill folder, drifts from npm releases, defeats `npx -y` cache, and breaks the version-pin discipline | Stay on `npx -y fsb-mcp-server@<pinned-version>`; npm is the source of truth. |
| Custom WebSocket port discovery / multiple bridge endpoints | "Configurability" | The bridge is intentionally `ws://localhost:7225` -- fixed, well-known, single-instance with hub/relay promotion (already shipped). Adding configurability fragments the contract | Stay on the canonical port. If the user has a port conflict, that's a doctor finding, not a skill feature. |
| Cross-tab / multi-window orchestration logic inside the skill | "Power user" feature | v0.8.0 already enforces tab ownership and handles cross-window with `TAB_OUT_OF_SCOPE`; adding skill-side orchestration races the extension | Document the typed errors; let the agent obey them. |
| Verbose, "optimistic" auto-generated SKILL.md body | Easy to produce; looks comprehensive | Anti-pattern flagged in OpenClaw skills authoring guide ("auto-generated skills are verbose and optimistic"); inflates context, dilutes auto-invocation signal | Tighten boundaries; require explicit input over guessing; clear stop conditions. |

---

## Feature Dependencies

```
[Chrome Web Store Extension Install]
    └──required-by──> [WebSocket bridge handshake]
                          └──required-by──> [any tool call beyond `doctor`/`status`]

[fsb-mcp-server reachable via npx]
    └──required-by──> [OpenClaw stdio config block being meaningful]
                          └──required-by──> [/fsb working at all]

[Valid SKILL.md frontmatter (Phase 0 verification)]
    └──required-by──> [skill loads in OpenClaw]
                          └──required-by──> [everything else]

[wait-for-extension polling]
    └──enhances──> [first-run setup UX]
        └──enhances──> [user trust]

[get_site_guide reference]
    └──enhances──> [tool-selection decision tree]
        └──enhances──> [first-attempt success rate]

[Visual session wrapping (start_visual_session "OpenClaw")]
    └──enhances──> [user-visible feedback during MCP-driven sessions]

[change_report awareness]
    └──enhances──> [tool-selection guidance: "no follow-up read needed"]

[Multi-agent contract docs]
    └──conflicts──> [skill code that sets/forwards agent_id] (the skill must not pass it)

[command-dispatch: tool + raw args]
    └──conflicts──> [model auto-invocation on the same /fsb command]
        # Mitigation: only use for admin verbs (/fsb setup, /fsb doctor),
        # leave plain task prompts for the model
```

### Dependency Notes

- **Chrome extension install gates everything past doctor/status:** Without it, the bridge has nothing to connect to. Setup flow must verify extension presence (via `wait-for-extension`) before declaring success -- otherwise the user gets a green check and a non-functional skill.
- **OpenClaw MCP "manual" posture inverts the usual install order:** For most hosts, FSB writes config and the host picks it up. For OpenClaw, the *user* writes config and FSB (the skill) prints it. This means the install-time hook's job is to *generate and display* the config, not to mutate any OpenClaw file.
- **`get_site_guide` enhances `read_page`/`get_dom_snapshot`:** The decision tree should call `get_site_guide` *first* on known sites; the read tools fill in the rest. Documenting them out of order in the skill body produces worse first-attempt success.
- **`command-dispatch: tool` blocks model intervention:** If `/fsb` is dispatched directly to a tool, the user prompt after `/fsb` does not flow through the model. This is desirable for `/fsb doctor` and `/fsb setup` (admin verbs); undesirable for actual browser tasks. The cleanest split is: model handles auto-invocation on intent, slash command handles admin verbs only -- or use sub-commands (`/fsb setup`, `/fsb doctor`, `/fsb status`) and let plain language prompts reach the model normally.
- **`change_report` awareness reduces follow-up reads:** Documenting it well is dependency-free *for the skill* but compounds value when paired with the read-only-first decision tree.

---

## MVP Definition

### Launch With (v0.9.61)

Minimum viable skill — what the milestone ROADMAP.md should require to ship.

- [ ] **Valid `SKILL.md` with `name: FSB`** — parse-clean against live OpenClaw build (Phase 0 verification gate)
- [ ] **Trigger-phrase `description:`** including "Chrome", "browser", "automate", "click", "fill form", "log into", "navigate", and "drive a webpage" — these are the nouns users type
- [ ] **`requires.bins: ["node", "npx"]` + `metadata.openclaw.requires`** — fail-loud at skill-load if Node toolchain is absent
- [ ] **`metadata.openclaw.install[]` running `npx -y fsb-mcp-server doctor`** — first-run prerequisite check that pins the failing layer
- [ ] **Canonical OpenClaw stdio config block** printed (verbatim from Phase 0 verification of OpenClaw's MCP registry shape) with copy affordance
- [ ] **Chrome Web Store install link** (`https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk`) printed verbatim
- [ ] **`fsb-mcp-server wait-for-extension`** step (or polling equivalent) before declaring setup complete
- [ ] **`USAGE.md`** — 3-step install / "try it" prompts / doctor recipe
- [ ] **`references/decision-tree.md`** — read-only-first tool selection (read_page → get_dom_snapshot → get_page_snapshot → get_site_guide; type_text over .value; run_task only when user explicitly delegates)
- [ ] **`references/multi-agent.md`** — `TAB_NOT_OWNED` / `AGENT_CAP_REACHED` / `TAB_INCOGNITO_NOT_SUPPORTED` / `TAB_OUT_OF_SCOPE` decoded; "do not pass agent_id" rule
- [ ] **`references/restricted-tabs.md`** — recovery playbook (`list_tabs`, `navigate`, `open_tab`, `switch_tab`, `go_back`, `go_forward`, `refresh`)
- [ ] **`references/vault-policy.md`** — credentials via `fill_credential` / `use_payment_method` only; no secrets in chat
- [ ] **Default-to-FSB rule** in SKILL.md body — soft preference for reads, hard escalation for click/type/auth/multi-tab
- [ ] **Visual-session wrapping** — body teaches `start_visual_session(client="OpenClaw")` for external-AI-driven sequences
- [ ] **`back` tool over `execute_js("history.back()")`** — explicit guidance with the typed-status payoff
- [ ] **`version: 0.9.61`** pinned, aligned with extension/MCP milestone
- [ ] **Idempotent setup discipline** — every install/setup action is check-then-apply; re-running `/fsb setup` is safe
- [ ] **Live verification at end of setup** — tiny round-trip (`list_tabs` or read against an open tab) reporting green/red

### Add After Validation (v0.9.62 / v0.9.63)

Reach for these once v0.9.61 is in users' hands and we have feedback signal.

- [ ] **`command-dispatch: tool` + `command-arg-mode: raw`** for admin verbs (`/fsb doctor`, `/fsb setup`, `/fsb status`) — defer until Phase 0 has live-verified OpenClaw behaves consistently across the verbs
- [ ] **Cross-host MCP install opt-in** — "We detect Claude Desktop / Cursor / Codex on this machine; install FSB there too?" — wires existing 21-platform installer into the skill
- [ ] **`metadata.openclaw.emoji` + homepage** branding polish
- [ ] **`references/sample-prompts.md`** — 5–10 verified "try it" prompts pulled from showcase / dashboard demos
- [ ] **`change_report`-aware guidance** explicit in body — once we have telemetry showing it actually reduces follow-up reads
- [ ] **Trigger when OpenClaw publishes its MCP registry shape** — promote skill from "manual config print" to a real `--openclaw` installer flag in `mcp/src/install.ts`; collapse the workaround

### Future Consideration (v1.0+)

Defer until product-market fit is established for the skill itself.

- [ ] **Localised SKILL.md / USAGE.md** (i18n) — only valuable once English version has demonstrably good auto-invocation rates
- [ ] **Skill telemetry** (which tools the agent actually picked, where it stalled) — requires an opt-in observability channel; cuts against the "no secrets, no surprise network calls" stance of skills
- [ ] **Multi-skill split** (e.g. `FSB-Reader` read-only skill + `FSB-Driver` mutating skill) — only if data shows users want a "safe mode" that can't click anything
- [ ] **ClawHub publication with verified-publisher badge** — once the skill is stable and we have a maintenance commitment
- [ ] **Allow-list integration** if OpenClaw introduces a per-skill tool allowlist surface — currently no such field is documented

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Valid SKILL.md frontmatter (Phase 0 live-verified) | HIGH | LOW | P1 |
| Trigger-phrase description for auto-invocation | HIGH | LOW | P1 |
| Install-time `doctor` hook | HIGH | LOW | P1 |
| Canonical stdio config block printout | HIGH | LOW | P1 |
| Chrome Web Store extension link | HIGH | LOW | P1 |
| `wait-for-extension` setup gate | HIGH | LOW | P1 |
| USAGE.md (3-step install + recovery) | HIGH | LOW | P1 |
| Default-to-FSB rule in body | HIGH | LOW | P1 |
| Tool-selection decision tree reference | HIGH | LOW | P1 |
| Multi-agent contract reference | HIGH | LOW | P1 |
| Restricted-tab recovery reference | HIGH | LOW | P1 |
| Vault-policy reference | HIGH | LOW | P1 |
| Visual-session wrapping guidance | MEDIUM | LOW | P1 |
| `back` tool guidance | MEDIUM | LOW | P1 |
| Version pin (0.9.61) | MEDIUM | LOW | P1 |
| Idempotent setup discipline | HIGH | MEDIUM | P1 |
| Live-verification round-trip at end of setup | MEDIUM | LOW | P1 |
| `requires.bins` + `requires.env` declarations | MEDIUM | LOW | P1 |
| `command-dispatch: tool` for admin verbs | MEDIUM | MEDIUM | P2 |
| Cross-host MCP install opt-in | HIGH | MEDIUM | P2 |
| Branded emoji + homepage in metadata | LOW | LOW | P2 |
| `change_report` awareness in body | MEDIUM | LOW | P2 |
| Sample-prompts reference file | MEDIUM | LOW | P2 |
| Skill telemetry | LOW | HIGH | P3 |
| i18n SKILL.md | LOW | MEDIUM | P3 |
| ClawHub publication | MEDIUM | MEDIUM | P3 |
| Multi-skill split (Reader / Driver) | LOW | HIGH | P3 |

**Priority key:**
- **P1**: Required for v0.9.61 milestone close. Skill does not feel polished without these.
- **P2**: Add in next milestone after the skill ships and we have user feedback.
- **P3**: Nice to have; defer past v1.0 unless data forces the issue.

---

## Competitor / Sibling-Pattern Feature Analysis

Comparison is across **agent-skill-shaped wrappers for browser-automation MCP servers** rather than against FSB's actual competitors (Browser Use, Project Mariner, Stagehand, BrowserOS — those compare at the *product* layer, not the skill layer).

| Feature | Anthropic reference skills (e.g. `docx`, `pdf`) | OpenClaw stock skills (`coding-agent`) | Browser-MCP wrappers (Playwright MCP, BrowserMCP) | FSB Skill (planned) |
|---------|--------------------------------------------------|----------------------------------------|----------------------------------------------------|---------------------|
| Folder layout | SKILL.md + scripts/ + references/ | SKILL.md only, lean | Generally README-only | SKILL.md + USAGE.md + references/ + (optional scripts/) |
| Install hook | None — pure docs/scripts | Limited — `requires.bins` only | Manual config edit | `metadata.openclaw.install[]` running doctor + config printout |
| Description style | Task-trigger phrases | Task-trigger phrases | Marketing copy | Task-trigger phrases (verified against Anthropic guidance) |
| Auto-invocation strategy | Description-driven | Description-driven | Often N/A (no skill wrapper) | Description-driven; default-to-FSB body rule |
| Diagnostics surface | None | None | None | Doctor-first via existing layer-aware CLI |
| Dependency on external runtime | Usually self-contained | Usually self-contained | Yes, but wrapped invisibly | Yes (extension + MCP server), made explicit and verified |
| Visual feedback during use | None | None | None | `start_visual_session` "OpenClaw" badge + glow |
| Vault/secret handling | N/A | `requires.env` declaration | Plain config | `requires.env` + extension-resident vault (no secrets cross MCP) |
| Multi-agent / concurrency contract | N/A | N/A | Mostly absent | Documented (typed errors, server-issued agent_id) |

**Takeaway:** The FSB skill differentiates on *operational rigor* — diagnostics-first recovery, visible feedback, vault discipline, multi-agent contract — not on browser-tool count. That alignment with FSB's existing strengths is correct.

---

## Sources

OpenClaw skill specification & frontmatter:
- [OpenClaw Skills documentation](https://docs.openclaw.ai/tools/skills) — primary source for `user-invocable`, `disable-model-invocation`, `command-dispatch`, `metadata.openclaw` shape
- [openclaw/openclaw `docs/tools/skills.md` on GitHub](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) — confirmed `requires.bins` are PATH-checked binaries; install scanner runs at `skills install` time
- [OpenClaw Docs (open-claw.bot mirror)](https://open-claw.bot/docs/tools/skills/) — overlap with primary docs; confirms managed lifecycle vs. local override layout
- [OpenClaw Skills (LearnClawDBot mirror)](https://www.learnclawdbot.org/docs/tools/skills) — confirms `command-arg-mode: raw` semantics and the `{ command, commandName, skillName }` payload shape

Anthropic Agent Skills foundation (the broader spec OpenClaw is compatible with):
- [Anthropic Agent Skills overview (platform.claude.com)](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — progressive disclosure (description → SKILL.md → scripts/refs); `disable-model-invocation` semantics
- [anthropics/skills GitHub repo](https://github.com/anthropics/skills) — canonical folder layout and SKILL.md frontmatter shape
- [Agent Skills Specification (DeepWiki)](https://deepwiki.com/anthropics/skills/6.1-agent-skills-specification) — description as routing signal

Authoring guidance:
- [AI Agent Skills Guide 2026 — The Prompt Index](https://www.thepromptindex.com/how-to-use-ai-agent-skills-the-complete-guide.html) — three-tier progressive disclosure; precondition validation pattern; anti-patterns (install-on-every-invoke, embedded secrets, false-success reporting)
- [OpenClaw skills guide — LumaDock](https://lumadock.com/tutorials/openclaw-skills-guide) — description as "trigger phrases not marketing copy"; security stance on community skill folders; secrets via `openclaw.json` env injection

Internal context (already-built FSB capabilities, not re-researched):
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/PROJECT.md` — milestone goals, `mcp/src/install.ts:413-420` reference for OpenClaw "manual / unsupported" posture
- `/Users/lakshmanturlapati/Desktop/FSB/mcp/README.md` — 60-tool surface; multi-agent contract; visual-session allowlist (includes `OpenClaw`); doctor / status / wait-for-extension diagnostics; restricted-tab recovery surface

---

*Feature research for: OpenClaw skill package wrapping FSB extension + fsb-mcp-server*
*Researched: 2026-05-08*
