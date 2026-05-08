---
phase: 250-usage-md-references-policy
plan: 01
subsystem: skill-docs
tags: [docs, usage, install, doctor, openclaw-skill]
dependency_graph:
  requires:
    - "Phase 248 USAGE.md placeholder (overwritten here)"
    - "Phase 249 SKILL.md framing (USAGE.md tone is consistent with body)"
    - "skills/FSB Skill/scripts/doctor.mjs (six-layer LAYERS + NEXT_STEPS source of truth)"
  provides:
    - "skills/FSB Skill/USAGE.md (human-facing 3-step install + try-it + recovery one-pager)"
  affects:
    - "skills/FSB Skill/USAGE.md"
tech_stack:
  added: []
  patterns:
    - "ASCII-only status markers ([OK] / [FAIL] / [WARN]); zero emojis"
    - "Markdown table for scannable six-layer recovery recipe"
    - "Manual-mode-first prompt examples; autopilot framed as explicit delegation only"
key_files:
  created: []
  modified:
    - "skills/FSB Skill/USAGE.md"
decisions:
  - "Used a markdown table (not an ordered list) for the six-layer recovery section -- matches CONTEXT.md recommendation for scannability"
  - "Added optional 'Re-run after each fix' pointer + GitHub Issues link at the end of the recovery section -- consistent with doctor.mjs's [WARN] exit branch"
  - "Inlined Web Store URL in both the install step and the extension recovery row so users do not need to scroll back up to copy it"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-08"
  tasks: 2
  files: 1
requirements: [DOCS-01, DOCS-02, DOCS-03]
---

# Phase 250 Plan 01: USAGE.md Authoring Summary

Replaced the Phase 248 placeholder USAGE.md with the full human-facing one-pager: who FSB is for, three-step install (Chrome extension via canonical Web Store URL plus GitHub Releases fallback, MCP stdio config, doctor verify), four try-it prompts (three manual mode plus one explicit autopilot delegation), and a six-row doctor-failure recovery table mirroring scripts/doctor.mjs.

## Final File Structure

`skills/FSB Skill/USAGE.md` -- 96 lines, plain ASCII, zero emojis.

Sections (top to bottom):

- `# FSB Skill -- Usage` (line 1) -- title plus one-sentence subtitle
- `## Who FSB is for` (line 5) -- framing paragraph; 5-minute green-doctor goal; WebFetch carve-out pointer
- `## Install (3 steps)` (line 13) -- numbered steps for extension, MCP server, doctor verify
- `## Try it` (line 63) -- entry to the prompt examples
  - `### Manual mode (default)` (line 67) -- three prompts hitting `read_page`, `click`, `type_text`
  - `### Autopilot (explicit delegation only)` (line 75) -- single `run_task` example with delegation framing
- `## Recover when the doctor fails` (line 83) -- six-row recovery table plus issues pointer

## Requirement Coverage

### DOCS-01: 3-step install with canonical URLs

USAGE.md ships exactly three numbered install steps. The Chrome Web Store URL appears verbatim in step 1 (and again in the recovery table for the `extension` layer). The GitHub Releases fallback link appears immediately under it.

Quoted snippet (step 1, primary path):

> Primary path -- Chrome Web Store. Paste this URL into Chrome's address bar and click `Add to Chrome`:
>
> ```
> https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk
> ```
>
> Fallback path -- GitHub Releases. ...
>
> ```
> https://github.com/LakshmanTurlapati/FSB/releases
> ```

Step 2 covers MCP server install (`node scripts/print-stdio.mjs`, `npx -y fsb-mcp-server install --list`, host-specific `--claude-desktop`). Step 3 is `node scripts/doctor.mjs` with the six-layer expectation.

### DOCS-02: Try-it prompts (manual mode + explicit autopilot)

USAGE.md `## Try it` section opens with a one-line "Once the doctor is green..." invitation, then splits into manual and autopilot subsections.

Manual mode quoted snippet:

> - Exercise `read_page`: "Open https://example.com and read the page. Summarize the visible text in two sentences."
> - Exercise `click`: "On https://example.com, click the 'More information...' link and tell me what page loads."
> - Exercise `type_text`: "Open https://duckduckgo.com, type `fsb-mcp-server` into the search box, and press Enter. Then list the first three result titles."

Autopilot quoted snippet:

> This delegates the WHOLE task to FSB autopilot. Use only when you are willing to hand off the full plan-and-execute loop to FSB rather than driving each step yourself.
>
> - Exercise `run_task`: "Use FSB autopilot to find the first GitHub repo for `fsb-mcp-server` and report a one-paragraph summary of its README."
>
> Autopilot is NOT the default entry point. For day-to-day work, use the manual mode prompts above.

Three manual prompts hit three distinct tools (`read_page`, `click`, `type_text`); exactly one autopilot example exercises `run_task` with explicit delegation framing.

### DOCS-03: Six-layer doctor recovery table

USAGE.md `## Recover when the doctor fails` section opens with one introductory line, then renders a markdown table with three columns (Layer, What it means, What to do) and six rows in the exact order of the LAYERS array in `scripts/doctor.mjs`:

1. `package` -- maps to `Run \`npx -y fsb-mcp-server --version\` ...` (matches NEXT_STEPS.package)
2. `bridge` -- maps to `Start the FSB extension and run \`npx -y fsb-mcp-server status --watch\` ...` (matches NEXT_STEPS.bridge)
3. `extension` -- maps to install via Web Store / Releases fallback then reopen session (matches NEXT_STEPS.extension)
4. `active-tab` -- maps to opening a normal `http(s)` tab and re-running `status --watch`; cross-links to `references/restricted-tab-recovery.md` (matches NEXT_STEPS['active-tab'])
5. `content-script` -- maps to "Reload the active tab" with the after-extension-install rationale (matches NEXT_STEPS['content-script'])
6. `config` -- maps to `npx -y fsb-mcp-server install --<host>` or pasting from `print-stdio.mjs` (matches NEXT_STEPS.config)

The section closes with a "Re-run after each fix; if it keeps flipping or shows [WARN]" pointer to GitHub Issues, matching doctor.mjs's exit-code-3 branch.

## Self-Check Highlights

- Web Store URL present (one match in install, one in recovery): `grep -F` returns 2 hits.
- GitHub Releases fallback present (install + recovery `extension` row): `grep -F` returns 2 hits.
- All six layer names appear in the recovery table rows.
- `read_page`, `click`, `type_text`, `run_task` all appear in the try-it section.
- Phase 248 placeholder text ("scaffolded by Phase 248") is gone.
- Emoji scan (`perl -CSD ... [\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]`) returns 0 matches.

## Deviations from Plan

None. Plan executed exactly as written.

Claude's Discretion was used for:

- Exact try-it prompt phrasing (CONTEXT.md DOCS-02 left wording free; the authored prompts hit `read_page`, `click`, `type_text`, and `run_task` as required).
- Exact framing of the "Who FSB is for" paragraph (CONTEXT.md left wording free; the authored copy reuses the same vocabulary as SKILL.md body so tone stays consistent).
- Choice of markdown table (vs. ordered list) for the six-layer recovery section (CONTEXT.md decisions block recommended a table for scannability).
- Inlining of the Web Store URL into the `extension` recovery row (avoids forcing users to scroll back to step 1 mid-recovery).

## Commits

- `e6b2adc`: docs(250-01): author USAGE.md framing + 3-step install (DOCS-01)
- `073138b`: docs(250-01): add try-it prompts and doctor recovery table (DOCS-02, DOCS-03)

## Self-Check: PASSED

- USAGE.md exists at `skills/FSB Skill/USAGE.md` (96 lines).
- Both commits exist on branch `worktree-agent-a3af17cb`.
- All six doctor layers appear in the recovery table.
- Both canonical URLs (Web Store, GitHub Releases) appear verbatim.
- Zero emojis; plain ASCII throughout.
