# Phase 250: USAGE.md + References + Policy - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) -- decisions locked at REQUIREMENTS.md + Phase 248/249 sign-offs; content authoring follows verified spec.

<domain>
## Phase Boundary

Author the human-facing surface of the FSB OpenClaw skill: a single `USAGE.md` for users + five `references/*.md` files that teach the OpenClaw model the right priors. After this phase, an OpenClaw user reading USAGE.md can install + try FSB end-to-end without leaving the skill, and an OpenClaw model has progressive-disclosure references for tool selection, multi-agent contracts, restricted-tab recovery, vault boundaries, and the default-to-FSB rule.

Out of scope for this phase: tests (Phase 251), README updates / repo discoverability (Phase 252), publish QA (Phase 253), live OpenClaw runtime validation (user task, deferred).

</domain>

<decisions>
## Implementation Decisions

### USAGE.md (DOCS-01..03)

- **3-step install** (DOCS-01):
  1. Install Chrome extension. Primary URL: `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk`. Fallback: GitHub Releases page link (`https://github.com/LakshmanTurlapati/FSB/releases`).
  2. Install FSB MCP. Run `npx -y fsb-mcp-server` to verify; paste the canonical OpenClaw stdio block (printed by `scripts/print-stdio.mjs`) into OpenClaw's MCP config; restart OpenClaw.
  3. Verify. Run `/fsb` (or whatever invokes the skill) and watch the doctor flow run; expect `[OK]` across all six layers.
- **Try-it prompts** (DOCS-02):
  * Manual mode: 3 prompts demonstrating `read_page`, `click`, `type_text` -- e.g., "open https://example.com and read the page", "click the 'More info' link", "type 'hello' into the search box on https://duckduckgo.com".
  * Autopilot example (single, restricted): one `run_task` example with explicit user delegation framing -- e.g., "use FSB autopilot to find the first GitHub repo for fsb-mcp-server and report its README". Frame as "explicit autopilot delegation"; reinforce that autopilot is NOT the default.
- **Doctor-failure recovery recipe** (DOCS-03):
  * Six-layer table mapping `[FAIL]` symptom -> likely cause -> next-step command (matches `scripts/doctor.mjs` six branches: package, bridge, extension, active-tab, content-script, config).
  * Each row: 1-line cause + 1-line action (`npx -y fsb-mcp-server install --<host>` / install Chrome extension / restart browser / run `status --watch`).
- Top-of-file framing: who FSB is for + what counts as a good FSB task vs. "ask another tool" task.
- ZERO emojis. Plain ASCII.

### references/tool-decision-tree.md (DOCS-04)

- Read-only first: `read_page` -> `get_dom_snapshot` -> `get_page_snapshot` -> `get_site_guide` (in that order).
- Typed events over `.value` -- explain why (anti-pattern: `execute_js("input.value = 'foo'")` doesn't fire React/Vue change handlers; use `type_text` instead).
- `get_site_guide` for known sites (43+ existing site guides reference).
- `run_task` is FOR EXPLICIT autopilot delegation only -- never the default entry point. Include 1-2 sentence "when to escalate to run_task" criteria.
- Tool names referenced MUST exist in `mcp/ai/tool-definitions.cjs` (Phase 251 TEST-04 enforces this).
- Format: bulleted decision tree + 1-row-per-tool table (tool name -> when to use -> common pitfall).

### references/multi-agent-contract.md (DOCS-05)

- v0.8.0 contract: never pass `agent_id` -- server mints; callers MUST NOT supply.
- Four typed errors documented with a one-line "what it means" + one-line "what to do":
  * `TAB_NOT_OWNED` -- tab is owned by another agent / legacy:sidepanel; either switch to a tab the caller owns or open a new one.
  * `AGENT_CAP_REACHED` -- concurrency cap hit; reduce parallel calls or raise the cap in extension settings.
  * `TAB_INCOGNITO_NOT_SUPPORTED` -- incognito tabs are rejected at dispatch boundary; use a normal-window tab.
  * `TAB_OUT_OF_SCOPE` -- cross-window tab; agent only sees tabs in its session window.
- `back` tool (v0.8.0): use `back` instead of `execute_js("history.back()")`. Explain why (typed result with status, history-depth tracking, ownership-gated, BF-cache aware).
- ZERO emojis.

### references/restricted-tab-recovery.md (DOCS-06)

- Why DOM tools fail on `chrome://*`, `edge://*`, web store URLs (no content-script attachability).
- Safe recovery tools that work even on restricted active tabs:
  * `list_tabs` -- list all owned tabs, find a normal one
  * `navigate` -- zero-owned navigate to a normal URL (works without content-script attachability per Phase 247)
  * `open_tab` -- new tab in agent scope (background by default)
  * `switch_tab` -- switch ownership-allowed
  * `go_back` / `go_forward` -- back/forward history
  * `refresh` -- reload current
- One-line example for each recovery tool.

### references/default-to-fsb.md (POLICY-01)

- Soft preference: when a click/type/auth/multi-tab task fits FSB's model, default to FSB tools. State the rule once explicitly.
- Hard escalation: ALL of these MUST escalate to FSB if the task is web automation:
  * Any click action
  * Any text input action
  * Any auth flow (login, MFA, vault credential lookup)
  * Any multi-tab orchestration
- Stay-with-WebFetch carve-out: public-doc reads / JSON / RSS / static APIs that don't require interaction. WebFetch is fine for those.
- Decision flowchart: "Is the task interactive web automation?" -> Y -> FSB; N -> existing tool. Include 2-3 concrete examples on each side.

### references/vault-boundary.md (POLICY-02)

- Passwords / CVV / payment details go through `fill_credential` and `use_payment_method` MCP tools ONLY. Never paste into `type_text`.
- No secrets in chat -- the model should never echo a credential value.
- `requires.env: []` is mandatory in SKILL.md frontmatter (already locked Phase 248). Vault values resolve inside the FSB Chrome extension's encrypted storage (`secure-config.js`); they do NOT cross into the MCP server process or the OpenClaw host process.
- Anti-pattern callouts: "Just type the password with type_text" -> NO; "Pass the API key via env var" -> NO.

### POLICY-03 (visual-session wrapping rule in SKILL.md body, NOT a new file)

- POLICY-03 is satisfied by SKILL.md body content (already authored Phase 249) referencing the visual-session lifecycle plus a `references/` link explaining lifecycle in detail.
- This phase MAY add a small `references/visual-session-lifecycle.md` (optional 6th reference file) that the SKILL.md body's visual-session pointer links to. Acceptable to include; not strictly required by REQUIREMENTS.md (POLICY-03 says "references/ link covers the lifecycle in detail" but doesn't pin the filename). Recommend: add `references/visual-session-lifecycle.md` for completeness.

### Anti-scope (do not do any of these in Phase 250)

- New SKILL.md frontmatter or body changes (Phase 249 owned that surface; small SKILL.md edits to fix broken pointers ARE acceptable).
- New scripts or script changes (Phase 249 owns).
- Tests (Phase 251 owns; tests will verify references/ files exist + reference correct tool names + USAGE.md has Web Store URL etc.).
- README / repo updates (Phase 252 owns).
- Pre-publish QA (Phase 253 owns).
- Auto-launching the Chrome Web Store URL (forever out of scope).
- Recommending `run_task` as default (forever out of scope).

### Claude's Discretion

- Exact try-it prompt wording in USAGE.md DOCS-02 (phrasing free; must hit `read_page` / `click` / `type_text` / single `run_task`).
- Exact wording of "what counts as a good FSB task" framing at top of USAGE.md.
- Whether to add the optional `references/visual-session-lifecycle.md` (recommend: yes, for completeness).
- Exact format of the doctor-failure recovery table in USAGE.md DOCS-03 (markdown table vs. ordered list -- recommend table for scannability).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `skills/FSB Skill/SKILL.md` -- already authored Phase 249; references/*.md files MUST match the pointer paths used in SKILL.md body.
- `skills/FSB Skill/scripts/doctor.mjs` -- six-layer dispatcher; USAGE.md DOCS-03 recovery table mirrors these six layers.
- `mcp/ai/tool-definitions.cjs` -- canonical tool name registry; `tool-decision-tree.md` MUST only reference names that exist here (Phase 251 TEST-04 enforces).
- `site-guides/` -- existing 43+ site guides; tool-decision-tree.md `get_site_guide` section can reference the count.
- v0.8.0 multi-agent typed errors -- already shipped (Phase 240, 241, 246, 247); error names + behaviors are stable.
- v0.9.36 visual-session lifecycle -- explicit start_visual_session + end_visual_session API; documented in `mcp/README.md`.

### Established Patterns

- Reference files in similar projects: progressive-disclosure short docs (~200-400 words each), bulleted lists + small tables, examples inlined.
- ASCII status markers in any code blocks: `[OK]` / `[FAIL]` / `[WARN]`.
- Project rule: ZERO emojis everywhere.

### Integration Points

- USAGE.md links to `scripts/doctor.mjs` output format (six layers).
- USAGE.md links to Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` (Phase 251 TEST-05 enforces presence).
- `references/*.md` files are loaded on demand by OpenClaw model as SKILL.md body's progressive-disclosure pointers.
- `references/multi-agent-contract.md` MUST mention every typed error name (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`) AND the `back` tool (Phase 251 TEST-04 enforces).

</code_context>

<specifics>
## Specific Ideas

- USAGE.md "try it" autopilot example should explicitly say "this delegates the WHOLE task to FSB autopilot" so users understand it's different from manual mode.
- Doctor recovery table should include the exact command users run (e.g., `npx -y fsb-mcp-server install --claude-desktop`) so it's copy-paste recoverable.
- `references/restricted-tab-recovery.md` should include a worked example (chrome://newtab → list_tabs → switch_tab to a normal URL → resume work) since this is the most common bootstrap-recovery scenario.
- `references/default-to-fsb.md` examples should be from FSB's own demo tasks (e.g., search-and-click-result, fill-and-submit-form) so the rule is concrete.
- `references/vault-boundary.md` should explicitly call out that the FSB Chrome extension surface (popup / sidepanel) is where users configure vault entries; the MCP / OpenClaw side never sees the values.
- All six (or seven, with optional visual-session-lifecycle) reference files should follow a consistent shape: H1 title + 1-paragraph framing + numbered/bulleted rules + worked example + "see also" cross-links.

</specifics>

<deferred>
## Deferred Ideas

- Anti-prompt-injection hardening of references content (treating references as untrusted by the skill itself) -- deferred past v0.9.61.
- Localised USAGE.md / references (i18n) -- deferred past v1.0.
- Per-site recovery playbooks (extending restricted-tab-recovery.md to specific known-bad sites) -- deferred to future milestone.
- Video / screencast versions of USAGE.md try-it prompts -- deferred.
- Live OpenClaw verification of the references' tool-name validity -- user-gated; Phase 251 TEST-04 covers static verification against `mcp/ai/tool-definitions.cjs`.

</deferred>
