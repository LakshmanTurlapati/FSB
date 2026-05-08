# Stack Research -- v0.9.61 FSB Skill (OpenClaw)

**Domain:** OpenClaw skill package (text-based agent skill, not new code/tooling)
**Researched:** 2026-05-08
**Confidence:** HIGH for spec fields verified against official OpenClaw docs and ClawHub repo; MEDIUM for cross-platform script behavior (single-source ratification from `docs.openclaw.ai/tools/exec`); LOW for "is there a skill test harness" (multiple sources confirm absence -- treat as a negative-finding-with-evidence rather than a knowledge gap).

## Scope Discipline

**Already shipped, do NOT touch in this milestone:**
- `fsb-mcp-server@0.8.0` (npm package, stdio + Streamable HTTP, 60 MCP tools, 21-platform installer registry, doctor/status/wait-for-extension diagnostics, multi-agent contract).
- FSB Chrome extension (DOM analysis, vault, visual sessions, agent loop).
- Existing OpenClaw entry in `mcp/src/install.ts:413-420` (manual / unsupported -- intentionally preserved).

**This milestone adds ONE new artifact:** a directory `skills/FSB Skill/` containing `SKILL.md` (YAML frontmatter + Markdown body), `USAGE.md`, `references/`, and `scripts/`. No new MCP tools. No extension changes. No installer-registry changes (the skill calls the existing installer through `npx`, it does not become a new installer target).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OpenClaw skill format | current (May 2026) | Container format for the skill | The only format OpenClaw loads; spec is YAML frontmatter + Markdown body in a folder. ([Skills - OpenClaw](https://docs.openclaw.ai/tools/skills)) |
| YAML frontmatter (single-line JSON for `metadata`) | n/a | Declares skill identity + runtime requirements | OpenClaw's embedded-agent parser supports single-line frontmatter keys only; `metadata` MUST be expressed as single-line JSON inside the YAML block. ([Skills - OpenClaw](https://docs.openclaw.ai/tools/skills), corroborated by [LumaDock guide](https://lumadock.com/tutorials/openclaw-skills-guide)) |
| Markdown body | CommonMark | Skill instructions for the agent | Agent loads the body AFTER the description triggers; use progressive disclosure -- reference `references/` and `scripts/` from the body rather than inlining. ([skill-creator SKILL.md](https://github.com/openclaw/openclaw/blob/main/skills/skill-creator/SKILL.md)) |
| Node.js (`node`, `npx`) for `scripts/` | Node 18+ | One-shot diagnostic + install scripts | `node` is already mandatory because `fsb-mcp-server@0.8.0` requires Node 18+. Cross-platform without per-shell branching. Justified vs bash/PowerShell pair below. |
| `npx -y fsb-mcp-server` invocation | `fsb-mcp-server@^0.8.0` | The skill's runtime dependency, called from scripts and inline in SKILL.md | Reuses the existing installer/doctor/status surface verbatim -- no new code path needed. The skill is a thin orchestration layer above the package. |

### SKILL.md Frontmatter -- Verified Field Inventory

Required (per [skill-format.md](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)):

| Field | Value for FSB skill | Why |
|-------|---------------------|-----|
| `name` | `FSB` | Per milestone scope. Skill identifier; must match `name:` in frontmatter. |
| `description` | One sentence summarizing what the skill does + WHEN to invoke. Example: *"Drive the user's Chrome browser via the FSB extension and `fsb-mcp-server`. Use when the user asks to click, type, navigate, fill forms, read pages, autofill credentials, or run multi-step web tasks."* | This is THE trigger for activation -- the body only loads after `description` matches. Keep it specific to web automation triggers so the agent picks FSB tools by default. |
| `version` | `0.9.61` (align to FSB milestone) -- semver | ClawHub publishing supports versioned skills with `latest` tag. Aligning to the milestone version (NOT `fsb-mcp-server@0.8.0`) makes provenance obvious. ([clawhub README](https://github.com/openclaw/clawhub/blob/main/README.md)) |

Optional top-level keys (verified against [openclaw-ai.com skills doc](https://openclaw-ai.com/en/docs/tools/skills)):

| Field | Value for FSB skill | Why |
|-------|---------------------|-----|
| `homepage` | `https://github.com/LakshmanTurlapati/FSB` | Surfaces in the macOS Skills UI and ClawHub detail page. |
| `user-invocable` | `true` (default) | Allow `/fsb` slash command. |
| `disable-model-invocation` | omit (default `false`) | We WANT the model to discover FSB tools via description; do not disable. |
| `command-dispatch` | omit | We are NOT bypassing the model -- the skill teaches the model to choose FSB tools, it doesn't dispatch directly to a single tool. Setting `"tool"` would short-circuit decision logic. |
| `command-arg-mode` | omit (default `"raw"`) | Default `raw` forwards `{ command, commandName, skillName }` unparsed -- exactly what we want when the user types `/fsb open amazon and find a wireless mouse`. ([Skills - OpenClaw](https://docs.openclaw.ai/tools/skills)) Only one documented value as of May 2026; treat as a one-element enum. |

`metadata.openclaw` block (single-line JSON inside YAML, per parser constraint):

```yaml
metadata: { "openclaw": { "requires": { "bins": ["node", "npx"] }, "install": [ { "id": "fsb-mcp-server", "kind": "node", "package": "fsb-mcp-server", "bins": ["fsb-mcp-server"], "label": "Install FSB MCP server (npm)" } ], "homepage": "https://github.com/LakshmanTurlapati/FSB", "os": ["darwin", "linux", "win32"] } }
```

| Sub-field | Value | Why |
|-----------|-------|-----|
| `requires.bins: ["node", "npx"]` | All must exist on PATH | `requires.bins` semantics: every entry MUST resolve on PATH at skill load. ([Skills - OpenClaw](https://docs.openclaw.ai/tools/skills)) `npx` is what runs `fsb-mcp-server` and `node` is its prerequisite. Do NOT list `chrome` -- Chrome is detected at runtime by `doctor`, not at skill load (a missing browser must surface a friendly error, not block skill activation). Do NOT list `fsb-mcp-server` here -- that's resolved via `npx -y` which downloads on demand. |
| `requires.anyBins` | omit | We don't have an "either-or" binary requirement. |
| `requires.env` | omit | FSB has no required env vars; AI provider keys are stored inside the extension, not in the host shell. |
| `requires.config` | omit | No `openclaw.json` config keys are read by FSB. |
| `primaryEnv` | omit | No primary credential env. |
| `install[]` | one entry, `kind: "node"`, `package: "fsb-mcp-server"`, `bins: ["fsb-mcp-server"]` | Surfaces a one-click "Install FSB MCP server" button in the macOS Skills UI. The `node` installer kind shells out to the user's configured Node manager (npm/pnpm/yarn/bun). The `bins` array tells OpenClaw which executables to expect on PATH after install. Schema verified at [Skills - OpenClaw](https://docs.openclaw.ai/tools/skills) and [LumaDock guide](https://lumadock.com/tutorials/openclaw-skills-guide). |
| `install[].os` | omit (works on all three) | `fsb-mcp-server` is pure Node; no platform filter needed. |
| `os: ["darwin", "linux", "win32"]` | All three | Chrome runs everywhere; npm runs everywhere. |
| `always` | omit (default `false`) | We do NOT want FSB always-active in every conversation; description-triggered activation is correct. |
| `emoji` | omit | Global user rule (CLAUDE.md): no emojis in markdowns or terminal logs unless explicitly requested. |

**Critical confirmation on `version:`** — The OpenClaw spec does NOT strictly require `version:` for the skill to load locally. It IS expected by ClawHub for publishing (the registry uses semver for ordering and `latest` tagging). [skill-format.md](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md) lists `version` as required; [openclaw-ai.com](https://openclaw-ai.com/en/docs/tools/skills) lists only `name` + `description` as the absolute minimum. **Conclusion:** include `version: 0.9.61` to be ClawHub-publish-ready. **MEDIUM confidence** on whether ClawHub strictly enforces semver vs accepts arbitrary strings; safe path is semver.

### Supporting Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `USAGE.md` | User-facing one-pager: 3-step install, "try it" prompts, doctor recovery | Per milestone scope; referenced from SKILL.md body via `See USAGE.md`. Not parsed by OpenClaw -- it's documentation for humans browsing the skill folder. |
| `references/decision-tree.md` | "FSB tool selection" decision tree (`read_page` -> `get_dom_snapshot` -> typed events; `run_task` only on autopilot delegation) | Loaded on demand by the agent when it needs to choose between read-only and mutating tools. Progressive-disclosure pattern recommended by skill-creator. |
| `references/multi-agent-contract.md` | Documents `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`, the `back` tool, and the "do not pass `agent_id`" rule | Agent reads this when a typed error fires; keeps the SKILL.md body short. |
| `references/restricted-tab-recovery.md` | `list_tabs`/`navigate`/`open_tab`/`switch_tab`/`go_back`/`go_forward`/`refresh` recovery playbook | Loaded when `chrome://*` or restricted-tab errors appear. |
| `references/visual-session.md` | `start_visual_session(client="OpenClaw")` / `end_visual_session` lifecycle | Wraps any external-AI-driven sequence per milestone scope. The label `"OpenClaw"` is on the existing trusted allowlist (verified in `mcp/README.md` line 279). |
| `scripts/doctor.mjs` | Runs `npx -y fsb-mcp-server doctor` and parses the layered output | First-invocation flow per milestone goal #1. |
| `scripts/install-other-hosts.mjs` | Detects which other MCP hosts are on the machine and runs `npx -y fsb-mcp-server install --<host>` for each (with user confirmation) | Milestone goal #3. Wraps the existing installer; does NOT reimplement detection. |
| `scripts/print-openclaw-stdio.mjs` | Prints the canonical stdio config block (`command: npx`, `args: [-y, fsb-mcp-server]`) ready to paste | Milestone goal #2. Pure stdout, no side effects. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `clawhub` CLI | Publish, sync, login, search | Separate from `openclaw` CLI. Auth is GitHub OAuth (Convex Auth); GitHub account must be **at least one week old** to publish. ([clawhub README](https://github.com/openclaw/clawhub/blob/main/README.md)) |
| `clawhub skill publish <path>` | One-shot publish | Runs ClawHub's automated security checks (VirusTotal, ClawScan, static analysis) against the bundle. ([clawhub-skill-registry blog](https://www.openclawplaybook.ai/blog/clawhub-skill-registry-openclaw-agents/)) |
| `clawhub sync` | Update telemetry / install counts | Scans current workdir first; falls back to `~/openclaw/skills` and `~/.openclaw/skills`. Telemetry only fires when authenticated. |
| Local validation | Manual invocation only | **No first-party skill test harness exists** as of May 2026. ClawHub validates at publish time (metadata vs code consistency, dangerous-code scan); local pre-publish testing is "load it in OpenClaw and run `/fsb`". This is a **negative finding with evidence** -- multiple sources searched, none documented a harness. |

## Installation

```bash
# Local skill (no install -- it's a directory):
mkdir -p "skills/FSB Skill"
# Author SKILL.md, USAGE.md, references/*.md, scripts/*.mjs

# Publish to ClawHub (when ready):
npx -y clawhub login
npx -y clawhub skill publish "skills/FSB Skill"

# End user installs FSB skill from ClawHub:
npx -y clawhub install <slug>
# Skill lands in ./skills/<slug>/ which OpenClaw picks up at <workspace>/skills next session

# What the skill itself does on first invocation (per milestone scope):
npx -y fsb-mcp-server doctor               # branch on failing layer
npx -y fsb-mcp-server install --<host>     # for each detected non-OpenClaw host
# Print OpenClaw stdio config block to user
# Walk user to: https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk
```

## Cross-Platform Script Strategy

Three viable approaches, ranked:

**Option A: POSIX shell + PowerShell pair.** Ship `scripts/doctor.sh` (POSIX bash, works on macOS + Linux) AND `scripts/doctor.ps1` (Windows pwsh 7). The skill body chooses based on platform. PROS: tiny, native to OpenClaw's exec tool. CONS: two files per script; duplicate parsing logic; OpenClaw's exec tool selects shells per OS ([Exec tool - OpenClaw](https://docs.openclaw.ai/tools/exec) -- bash/sh on non-Windows avoiding fish, pwsh on Windows) but each script must be re-implemented.

**Option B (recommended): Node-only scripts.** Ship `scripts/doctor.mjs` and invoke via `node scripts/doctor.mjs`. PROS: one file per task, fully portable, can use the same JSON-parsing logic everywhere, contributors are already in Node mindset because `fsb-mcp-server` is TypeScript/Node. CONS: ~50-100ms cold-start vs bash, but `node` is already mandatory via `requires.bins` so the dep is "free."

**Option C: Inline everything in SKILL.md, no scripts/.** Tell the agent to literally run `npx -y fsb-mcp-server doctor` and parse the output via the model. PROS: zero scripts, zero portability concerns. CONS: agent has to re-derive parsing each time; brittle; unnecessarily expensive token-wise.

**Recommendation: Option B (Node-only).** Justification: (a) `node` is already mandatory via `requires.bins`, (b) one source of truth, (c) the existing `fsb-mcp-server` codebase is TypeScript/Node so contributors are already in Node mindset, (d) the milestone scope explicitly asked "Bash vs Node" and Node wins on portability. Use `.mjs` extension, shebang-less (invoked as `node scripts/doctor.mjs`).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Single skill (`FSB`) doing all six responsibilities | Split into multiple skills (`fsb-install`, `fsb-doctor`, `fsb-tools`) | Use multi-skill split if any single responsibility grows past ~300 lines of body content. For v0.9.61 a single skill is correct -- the responsibilities are tightly coupled (every flow starts from doctor branching). |
| Node `.mjs` scripts | POSIX `.sh` + PowerShell `.ps1` pair | Use the pair if Node startup latency becomes noticeable in interactive flows or if a contributor strongly prefers shell. Not for v0.9.61. |
| Reuse existing `npx -y fsb-mcp-server install --<host>` | Re-implement host detection inside the skill | Never -- the existing installer already enumerates 21 platforms with proper config-format handling (JSON/JSONC/TOML/YAML). Re-implementing is duplicate code and a future-debt magnet. |
| `command-arg-mode: raw` (default) | `command-arg-mode` set explicitly + `command-dispatch: tool` | Use the explicit dispatch ONLY if you want `/fsb <task>` to literally call ONE tool with `<task>` as the arg. We do NOT want that -- we want the model to read the body and decide which FSB tools to call. Default behavior is correct. |
| `version: 0.9.61` aligned to FSB milestone | `version: 0.8.0` aligned to `fsb-mcp-server` | Aligning to the milestone is clearer because the skill ships *with* the milestone, not with the npm package. The skill's MCP-server dep is constraint-pinned via `^0.8.0`-compatible behavior, not version-locked. |
| `kind: "node"` install spec | `kind: "brew"` | brew is macOS-only; we need cross-platform. Listed for completeness; not used. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `metadata.openclaw.install[].kind: "brew"` | macOS-only; FSB users are cross-platform. The package is on npm, not Homebrew. | `kind: "node"` with `package: "fsb-mcp-server"` -- works everywhere Node runs. |
| `requires.bins: ["chrome"]` or `["google-chrome"]` | Chrome binary name varies wildly across OS, and the extension itself is the requirement (not Chrome on PATH). Hard-failing skill load on missing Chrome would block users who have Chrome installed normally. | Detect Chrome + extension at runtime via `npx -y fsb-mcp-server doctor`, surface a recovery message. |
| Multi-line YAML for the `metadata` block | OpenClaw's parser supports single-line frontmatter keys only; multi-line `metadata` will silently fail to parse. ([LumaDock](https://lumadock.com/tutorials/openclaw-skills-guide)) | Single-line JSON inside YAML for `metadata: { ... }`. |
| `disable-model-invocation: true` | Would prevent the model from discovering FSB tools via natural-language matching against `description`. | Default `false` -- description-triggered activation is the intended path. |
| Emojis anywhere in SKILL.md / USAGE.md / scripts / logs | Global user rule (CLAUDE.md): never use emojis in markdowns or terminal logs unless explicitly requested. | Plain text headings, ASCII status markers like `[OK]`, `[FAIL]`, `[WARN]`. |
| A `package.json` in the skill folder | Adds confusion -- the skill is a directory of text files, not an npm package. The npm dep is `fsb-mcp-server`, invoked via `npx`, NOT a local install. | No `package.json`. Just `SKILL.md` + supporting files. |
| `plugin.json` / `openclaw.plugin.json` | That file is for OpenClaw *plugins* that ship multiple skills. We are shipping ONE skill. ([Skills - OpenClaw](https://docs.openclaw.ai/tools/skills)) | Not needed. |
| Adding a new `--openclaw` install flag to `fsb-mcp-server` | OpenClaw's MCP config shape is still unstable across builds (per existing comment at `mcp/src/install.ts:413-420`). The skill SOLVES this by printing the canonical stdio block at runtime. | Keep `mcp/src/install.ts` OpenClaw entry as-is (manual / unsupported). Skill prints the block. Re-evaluate after OpenClaw's MCP format stabilizes. |
| New MCP tools or extension changes | Out of scope for v0.9.61. | The skill orchestrates the existing 60-tool surface. Zero server-side or extension diffs. |
| Bundling `fsb-mcp-server` source into the skill | Skill bundles must be small and text-only; npm distribution is the canonical channel. | `npx -y fsb-mcp-server` invocation; npm handles caching. |

## Stack Patterns by Variant

**If user is on macOS Skills UI (clicks "Install" button on the skill detail page):**
- The `metadata.openclaw.install[0]` entry (kind `node`) drives the click -- OpenClaw shells out to the configured Node manager, runs `npm i -g fsb-mcp-server` (or `pnpm`/`yarn`/`bun` per user prefs), and verifies `bins: ["fsb-mcp-server"]` resolves on PATH.
- Skill body then runs `doctor` automatically.

**If user is on Linux/Windows running OpenClaw CLI:**
- macOS Skills UI is irrelevant; `install[]` is informational metadata only.
- Skill body runs `npx -y fsb-mcp-server doctor` -- `npx` handles per-invocation download.

**If user already has FSB MCP server installed for another host (e.g. Claude Desktop):**
- `doctor` returns green at the package layer.
- Skill skips install, prints OpenClaw stdio block, prompts to add it to OpenClaw's MCP config (since `--openclaw` install flag is "manual / unsupported"), and walks Chrome extension install if not detected.

**If user has FSB MCP server but extension is not connected:**
- `doctor` returns failing layer = `extension` or `bridge`.
- Skill walks Chrome Web Store install, then waits for `wait-for-extension` to flip green.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `fsb-mcp-server@^0.8.0` | OpenClaw skill format current (May 2026) | Multi-agent contract requires `>=0.8.0`. Earlier versions ship `agent_id` differently and lack `back`/`change_report`. |
| OpenClaw current build | Skills with single-line `metadata` JSON only | Parser limitation is upstream; do not multi-line `metadata`. |
| Node 18+ | `fsb-mcp-server@0.8.0` | Verified in `mcp/package.json` engines (existing). |
| Chrome 88+ | FSB extension (Manifest V3) | Existing extension constraint. |
| ClawHub publish | GitHub account >= 7 days old | Auth requirement. ([clawhub README](https://github.com/openclaw/clawhub/blob/main/README.md)) |

## Negative Findings (Verified Absences)

These are things searched for and confirmed NOT to exist as of May 2026:

1. **No first-party skill test harness.** OpenClaw provides no `clawhub validate` or `openclaw test-skill` command. Validation runs server-side at publish. Local pre-publish testing is manual: install the skill into a workspace, invoke it. (Searched [docs.openclaw.ai](https://docs.openclaw.ai/tools/skills), [clawhub README](https://github.com/openclaw/clawhub), and ecosystem guides.)
2. **No skill-level `package.json` convention.** Skills are text directories, not npm packages.
3. **No `plugin.json` needed for single-skill bundles.** `openclaw.plugin.json` is only for plugins that ship multiple skills under one umbrella.
4. **No formal version-field validation rule** beyond "ClawHub expects semver-shaped strings for ordering and `latest` tagging." Local OpenClaw installs tolerate skills without `version:`.
5. **No documented `command-arg-mode` value other than `"raw"`.** The default is the only documented option as of May 2026 -- treat as a one-element enum.

## Sources

- [Skills - OpenClaw](https://docs.openclaw.ai/tools/skills) -- canonical spec for SKILL.md frontmatter, `metadata.openclaw`, `install[]` schema, `command-arg-mode`, `command-dispatch`, `requires.bins`/`anyBins`/`env`/`config` -- HIGH confidence
- [Skills | OpenClaw Docs](https://openclaw-ai.com/en/docs/tools/skills) -- mirror with installer-kind enumeration, `os` filtering, install-array example -- HIGH confidence
- [clawhub/docs/skill-format.md](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md) -- registry-side requirements, `version` as required-for-publish, full optional field table -- HIGH confidence
- [clawhub/README.md](https://github.com/openclaw/clawhub/blob/main/README.md) -- CLI commands (login, publish, sync, search, install), GitHub-OAuth + 7-day-old account requirement, security scans -- HIGH confidence
- [Exec tool - OpenClaw](https://docs.openclaw.ai/tools/exec) -- shell selection across macOS/Linux/Windows, bash-vs-fish-vs-pwsh logic -- MEDIUM confidence (single source)
- [skill-creator SKILL.md](https://github.com/openclaw/openclaw/blob/main/skills/skill-creator/SKILL.md) -- real-world reference: minimal frontmatter (`name` + `description` only), progressive-disclosure body pattern -- HIGH confidence
- [LumaDock OpenClaw skills guide](https://lumadock.com/tutorials/openclaw-skills-guide) -- corroborates single-line-JSON `metadata` parser constraint, install-array example -- MEDIUM confidence (third-party)
- [ClawHub skill registry blog](https://www.openclawplaybook.ai/blog/clawhub-skill-registry-openclaw-agents/) -- security scanning model, registry size (~13k skills as of early 2026) -- MEDIUM confidence
- `/Users/lakshmanturlapati/Desktop/FSB/mcp/README.md` -- existing FSB MCP surface, trusted allowlist (`OpenClaw` is on it at line 279), 21-platform installer -- HIGH confidence
- `/Users/lakshmanturlapati/Desktop/FSB/mcp/src/install.ts` lines 413-420 -- existing OpenClaw "manual / unsupported" entry rationale -- HIGH confidence
- `/Users/lakshmanturlapati/Desktop/FSB/mcp/package.json` -- confirms `fsb-mcp-server@0.8.0`, ESM, Node 18+ engine -- HIGH confidence

---
*Stack research for: OpenClaw FSB skill package (milestone v0.9.61)*
*Researched: 2026-05-08*
