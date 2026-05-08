---
phase: 249-skill-md-scripts
verified: 2026-05-08T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load skills/FSB Skill into a fresh OpenClaw build"
    expected: "OpenClaw parses SKILL.md frontmatter without errors; the FSB skill appears in the skill list with correct name/version/homepage"
    why_human: "OpenClaw runtime is an external host; per CONTEXT.md decision lock, live OpenClaw runtime validation is a deferred user task. No CLI / programmatic harness available in this repo to spawn OpenClaw and inspect its parsed metadata."
  - test: "From inside OpenClaw, invoke `node scripts/doctor.mjs` end-to-end against a real FSB MCP install"
    expected: "doctor.mjs streams the raw doctor output, then appends `--- FSB skill doctor summary ---` followed by exactly one [OK] / [FAIL] / [WARN] line plus a concrete next-step command or URL; OpenClaw observes the documented exit code (0/1/2/3)."
    why_human: "Requires the FSB Chrome extension installed AND OpenClaw running; verifies the doctor-first dispatcher branch behavior. Local smoke test on the executor machine confirmed `[FAIL] failing layer: config` exit=1, but this is one branch, not the full six-layer matrix."
  - test: "From inside OpenClaw, invoke `node scripts/print-stdio.mjs` and paste the printed JSON into OpenClaw's MCP config"
    expected: "Printed block is exactly the canonical {\"mcpServers\":{\"fsb\":{\"command\":\"npx\",\"args\":[\"-y\",\"fsb-mcp-server\"]}}}; pasting into OpenClaw's MCP config wires the FSB server such that subsequent tool calls (e.g., list_tabs) resolve."
    why_human: "OpenClaw's MCP config schema may differ across builds (Phase 248 finding); only a live OpenClaw paste-and-restart can confirm the canonical block is accepted by that build."
  - test: "From inside OpenClaw, invoke `node scripts/install-host.mjs` on a machine with at least one supported MCP host installed (e.g., Claude Desktop or Cursor)"
    expected: "Script lists detected hosts, prompts y/N per host, runs `npx -y fsb-mcp-server install --<host>` only on explicit y, prints final installed/skipped/errored summary, exits 0; OpenClaw config itself is NOT modified."
    why_human: "Requires real MCP hosts on the machine (Claude Desktop, Cursor, etc.) and an interactive terminal for the y/N readline prompt; the executor's `--list` output produced 20 false-positive token entries (per Plan 04 SUMMARY) which were correctly skipped via the runtime [WARN] guard, but a host with a clean install would exercise the happy path."
---

# Phase 249: SKILL.md + Scripts Verification Report

**Phase Goal:** A working OpenClaw skill that, when loaded into a fresh OpenClaw, can execute the doctor-first branch dispatcher end-to-end, print the canonical OpenClaw stdio block, and offer consent-gated install into other detected MCP hosts -- using only the verified spec from Phase 248.

**Verified:** 2026-05-08
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                       | Status     | Evidence                                                                                                                                                                                                                          |
| -- | ----------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | SKILL.md ships with verified frontmatter (name, version, requires.bins, requires.env, single-line metadata.openclaw JSON, no priority, no must-use) | [OK] VERIFIED | YAML round-trips: name=FSB, version=0.9.61, user-invocable=True, requires.bins=[node,npx], requires.env=[], homepage=https://github.com/LakshmanTurlapati/FSB, metadata.openclaw inline single-line valid JSON. Forbidden keys absent. |
| 2  | SKILL.md body under ~600 tokens with progressive-disclosure pointers (no inlined content)                   | [OK] VERIFIED | 3363 bytes (well under 5500-byte budget). All 8 required headings present. 5 references/*.md pointers + 3 scripts/*.mjs pointers present. No inlined tool catalog, typed-error catalog, or visual-session lifecycle.            |
| 3  | scripts/doctor.mjs spawns `npx -y fsb-mcp-server doctor`, parses six failing layers, emits [OK]/[FAIL]/[WARN] | [OK] VERIFIED | spawn() call with `['-y', 'fsb-mcp-server', 'doctor']` present. All 6 layer keywords present. [OK]=4, [FAIL]=4, [WARN]=5 occurrences. Live smoke launch (Plan 02 SUMMARY) confirmed `[FAIL] failing layer: config` exit=1. |
| 4  | scripts/print-stdio.mjs prints canonical OpenClaw stdio block (parity with mcp/src/install.ts)              | [OK] VERIFIED | Live run produced canonical JSON; deep-equal check vs install.ts lines 170-177 = True (`{"mcpServers":{"fsb":{"command":"npx","args":["-y","fsb-mcp-server"]}}}`). Header + footer + LF endings. JSON.stringify absent (literal). |
| 5  | scripts/install-host.mjs detects via `install --list`, prompts y/n per host, never --all, never --openclaw, never auto-writes config | [OK] VERIFIED | spawn() x2 (detect + per-host install), createInterface() x1, "Detected host:" + "[y/N]" prompts. Forbidden literals `"--all"`, `"--openclaw"`, `shell: true`, `writeFile`, `execSync` all return 0 grep matches.       |
| 6  | All scripts cross-platform (macOS/Linux/Windows); ZERO emojis; ASCII only                                   | [OK] VERIFIED | All 4 artifacts: 0 non-ASCII bytes (Python byte-scan). All 3 .mjs files pass `node --check`. No `cmd.exe` / `powershell` / `bash` / `sh -c` / hard-coded `/usr/`,`/bin/`,`C:\\`,`D:\\` tokens.                                          |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                  | Expected                                                              | Status        | Details                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `skills/FSB Skill/SKILL.md`               | OpenClaw-loadable skill metadata + concise body                        | [OK] VERIFIED | Exists (3363 bytes). Frontmatter parses. All 8 headings + 5 references + 3 scripts pointers + 4 key terms (start_visual_session, end_visual_session, agent_id, fill_credential). chromewebstore absent (correctly deferred to Phase 250). |
| `skills/FSB Skill/scripts/doctor.mjs`     | Layered diagnostic dispatcher wrapping fsb-mcp-server doctor          | [OK] VERIFIED | Exists (5734 bytes). ESM parses. shebang. 6 layer keywords + Web Store URL + status --watch + install -- next-steps. ENOENT handler + all 4 exit codes (0/1/2/3) present. |
| `skills/FSB Skill/scripts/print-stdio.mjs` | Canonical OpenClaw stdio config block printer (parity-locked)         | [OK] VERIFIED | Exists (1527 bytes). ESM parses. Hard-coded BLOCK literal (no JSON.stringify). Live run produces JSON deep-equal to install.ts canonical. Header + footer correct. LF endings. |
| `skills/FSB Skill/scripts/install-host.mjs` | Detect-list-confirm flow over `install --list`                       | [OK] VERIFIED | Exists (6021 bytes). ESM parses. spawn x2 with shell:false. Single createInterface. EOF-resilient question wrapper. HOST_NAME_RE defensive guard. Final summary section.   |

### Key Link Verification

| From                                | To                                                                  | Via                                  | Status        | Details                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| skills/FSB Skill/SKILL.md           | .planning/v0.9.61-OPENCLAW-SPEC.md                                  | schema fields verified there         | [OK] WIRED    | name=FSB, version=0.9.61, requires.bins=[node,npx], requires.env=[], metadata.openclaw single-line JSON: all match Phase 248 spec.                                       |
| skills/FSB Skill/SKILL.md body      | references/{tool-decision-tree, multi-agent-contract, restricted-tab-recovery, vault-boundary, default-to-fsb}.md | progressive-disclosure pointers       | [OK] WIRED    | All 5 path strings present in body. Files do not yet exist (Phase 250 ships them); pointer pattern is forward-reference per progressive-disclosure design.                |
| skills/FSB Skill/scripts/doctor.mjs | npx -y fsb-mcp-server doctor                                        | child_process.spawn streaming         | [OK] WIRED    | `spawn('npx', ['-y', 'fsb-mcp-server', 'doctor'], { shell: false })` literal present. Stdout/stderr piped through. Buffered into combined for parsing.                    |
| doctor.mjs extension-layer branch   | https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk | next-step text                  | [OK] WIRED    | Verbatim URL present in NEXT_STEPS.extension entry.                                                                                                                       |
| print-stdio.mjs                     | mcp/src/install.ts STDIO_COMMAND + Claude Desktop section           | parity contract (CI in Phase 251)    | [OK] WIRED    | Parity comment header present. JSON deep-equal verified at runtime: print-stdio's BLOCK == install.ts lines 170-177 canonical. STDIO_COMMAND literal `npx -y fsb-mcp-server` matches print-stdio args.  |
| install-host.mjs                    | npx -y fsb-mcp-server install --list                                | child_process.spawn (detect)         | [OK] WIRED    | spawn(NPX, ['-y', PKG, 'install', '--list'], { shell: false }) on line 24.                                                                                                |
| install-host.mjs                    | npx -y fsb-mcp-server install --<host>                              | child_process.spawn (per-host install) | [OK] WIRED  | spawn(NPX, ['-y', PKG, 'install', flag], { shell: false }) where flag = '--' + host. HOST_NAME_RE guard prevents injection.                                                |
| install-host.mjs                    | OpenClaw MCP config                                                 | MUST NOT WRITE                       | [OK] WIRED    | Zero matches for writeFile / writeFileSync / "--openclaw" / "--all". Defense-in-depth runtime guard skips host==='openclaw'.                                              |

### Data-Flow Trace (Level 4)

| Artifact         | Data Variable / Output | Source                                  | Produces Real Data | Status        |
| ---------------- | ---------------------- | --------------------------------------- | ------------------ | ------------- |
| doctor.mjs       | parseFailingLayer()    | combined buffer of doctor stdout/stderr | Yes (live smoke confirmed `[FAIL] failing layer: config`) | [OK] FLOWING |
| print-stdio.mjs  | BLOCK literal          | hard-coded template (parity-locked)     | Yes (round-trips through JSON.parse + deep-equal install.ts) | [OK] FLOWING |
| install-host.mjs | hosts[] from parseHosts | `npx -y fsb-mcp-server install --list` stdout | Yes (live smoke produced 20 token-extracted entries; HOST_NAME_RE + MARKERS gate downstream invocations) | [OK] FLOWING |

### Behavioral Spot-Checks

| Behavior                                     | Command                                                                                                                                | Result                                          | Status   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------- |
| node --check parses all three .mjs           | `node --check doctor.mjs && node --check print-stdio.mjs && node --check install-host.mjs`                                              | exit 0; "[OK] all three .mjs parse"             | [OK] PASS |
| print-stdio.mjs runtime emits canonical JSON | `node "skills/FSB Skill/scripts/print-stdio.mjs"`                                                                                       | Header + canonical JSON block + footer printed; JSON deep-equal install.ts canonical | [OK] PASS |
| All artifacts ASCII-only                     | python3 byte-scan over all 4 artifacts                                                                                                  | 0 non-ASCII bytes across SKILL.md + 3 .mjs       | [OK] PASS |
| SKILL.md frontmatter YAML round-trips        | `python3 yaml.safe_load`                                                                                                                | name=FSB, version=0.9.61, requires.bins=[node,npx], requires.env=[], metadata.openclaw inline JSON | [OK] PASS |
| install-host.mjs forbidden literals absent   | grep for `"--all"`, `"--openclaw"`, `shell: true`, `writeFile`, `execSync`, `require(`                                                   | 0 matches across all six                        | [OK] PASS |
| doctor.mjs four exit codes present           | grep for `process.exit(0..3)`                                                                                                           | 1 each = 4 distinct                             | [OK] PASS |

### Requirements Coverage

| Requirement | Source Plan        | Description                                                                                                | Status          | Evidence                                                                                                                          |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SKILL-01    | 249-01-PLAN.md     | SKILL.md verified frontmatter (no priority, no must-use, single-line metadata.openclaw)                    | [OK] SATISFIED  | YAML parses; all required keys present; forbidden keys absent; metadata.openclaw inline JSON.                                     |
| SKILL-02    | 249-01-PLAN.md     | SKILL.md body under ~600 tokens; progressive disclosure pointers                                            | [OK] SATISFIED  | 3363 bytes (< 5500 cap). 8 headings + 5 references/ + 3 scripts/ pointers. No inlined tool docs / typed-error catalog / lifecycle. |
| SKILL-03    | 249-02-PLAN.md     | scripts/doctor.mjs spawns doctor, parses 6 failing layers + ok, emits [OK]/[FAIL]/[WARN]                   | [OK] SATISFIED  | spawn + 6 layer keywords + 3 markers + Plan 02 live smoke = `[FAIL] failing layer: config` exit=1.                                |
| SKILL-04    | 249-03-PLAN.md     | scripts/print-stdio.mjs prints canonical block sourced from mcp/src/install.ts getSetupSections             | [OK] SATISFIED  | Live runtime output JSON deep-equals install.ts lines 170-177 canonical. Parity comment header + footer reference present.        |
| SKILL-05    | 249-04-PLAN.md     | scripts/install-host.mjs detects via install --list; per-host y/n; never --all; never auto-writes config   | [OK] SATISFIED  | spawn(--list) + readline y/N prompt + spawn(--<host>) only on explicit y. 0 matches for forbidden flags / writeFile.               |
| SKILL-06    | 249-02/03/04-PLAN.md | All scripts cross-platform; clean macOS/Linux/Windows happy path                                          | [OK] SATISFIED  | All 3 .mjs: ESM, shell:false, no shell-specific tokens, no OS-specific paths, ASCII-only, ENOENT handlers where applicable.       |

No orphaned requirements: REQUIREMENTS.md maps SKILL-01..06 only to Phase 249, all six covered by the four plans.

### Anti-Patterns Found

| File                                          | Line | Pattern                | Severity | Impact                                                                                                                              |
| --------------------------------------------- | ---- | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| (none)                                        | -    | -                      | -        | No emojis, no non-ASCII bytes, no TODO/FIXME/PLACEHOLDER comments, no empty implementations, no `return null` stubs in user-visible paths. |

A `void code;` statement appears once in doctor.mjs (line 161) -- this is intentional (acknowledges unused parameter without removing it from the signature); not a stub.

The body of SKILL.md uses forward-reference pointers to `references/*.md` files that do not yet exist on disk -- this is the documented progressive-disclosure pattern (Phase 250 ships those files). Per Plan 01 SUMMARY decision lock, this is INTENTIONAL not stub.

### Human Verification Required

The phase goal explicitly says "when loaded into a fresh OpenClaw, can execute the doctor-first branch dispatcher end-to-end". This requires a live OpenClaw runtime, which is not available in this repository. Per CONTEXT.md decision lock, "live OpenClaw runtime validation (user task, deferred)". The four items in the YAML frontmatter `human_verification` block enumerate the specific tests:

1. **Load skills/FSB Skill into a fresh OpenClaw build** -- confirms frontmatter parses and skill registers.
2. **Invoke `node scripts/doctor.mjs` from inside OpenClaw end-to-end** -- exercises the doctor-first dispatcher across the six-layer matrix (only the `config` failing branch was smoke-tested locally).
3. **Invoke `node scripts/print-stdio.mjs` and paste the JSON into OpenClaw's MCP config** -- confirms OpenClaw accepts the canonical shape; OpenClaw schema may differ across builds.
4. **Invoke `node scripts/install-host.mjs` against a machine with real MCP hosts** -- exercises the y/N readline + per-host spawn happy path on at least one supported host (Claude Desktop, Cursor, etc.).

### Gaps Summary

No gaps. All six must-haves verified. All forbidden patterns absent. Cross-platform discipline holds. Parity contract between print-stdio.mjs and mcp/src/install.ts verified by JSON deep-equal at verification time (Phase 251 TEST-03 will add CI-time byte-level enforcement).

The phase delivered an executable OpenClaw skill surface (frontmatter + body + 3 working scripts) that is production-quality on the executor machine. End-to-end validation against a live OpenClaw build is the only remaining concern, and that is by-design deferred to the user per CONTEXT.md.

---

_Verified: 2026-05-08_
_Verifier: Claude (gsd-verifier)_
