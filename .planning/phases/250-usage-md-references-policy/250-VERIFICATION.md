---
phase: 250-usage-md-references-policy
verified: 2026-05-08T00:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 250: USAGE.md + References + Policy Verification Report

**Phase Goal:** The skill teaches OpenClaw the right priors -- the human-facing 3-step install + try-it + recovery recipe in USAGE.md, and reference files that codify the tool decision tree, multi-agent contract, restricted-tab recovery, vault boundary, default-to-FSB rule, and the visual-session wrapping policy.
**Verified:** 2026-05-08
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth                                                                                                                                                          | Status     | Evidence                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | USAGE.md has 3-step install with Chrome Web Store URL `https://chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk` + GitHub Releases fallback   | VERIFIED   | USAGE.md lines 13-61: numbered "Install (3 steps)" section. Web Store URL appears verbatim at line 20 and line 91 (recovery row). GitHub Releases URL appears at line 26 and line 91. Three numbered steps: extension, MCP server config, doctor verify.                          |
| 2   | USAGE.md has try-it prompts (manual + autopilot)                                                                                                               | VERIFIED   | USAGE.md lines 63-81. "Manual mode (default)" subsection has three prompts exercising `read_page` (line 71), `click` (line 72), `type_text` (line 73). "Autopilot (explicit delegation only)" subsection has exactly one `run_task` example (line 79) with explicit framing.    |
| 3   | USAGE.md has 6-layer doctor recovery                                                                                                                           | VERIFIED   | USAGE.md lines 83-96. Six-row markdown table with all six layer names in correct order (package, bridge, extension, active-tab, content-script, config), each with cause + copy-pasteable action mirroring scripts/doctor.mjs NEXT_STEPS.                                       |
| 4   | references/tool-decision-tree.md exists and references real tool names from mcp/ai/tool-definitions.cjs                                                        | VERIFIED   | File exists (73 lines). All 24 bare tool tokens in tree/table cross-checked against tool-definitions.cjs `name:` fields -- all confirmed present (read_page line 856, get_dom_snapshot line 944, get_page_snapshot line 986, get_site_guide line 1007, click line 163, etc.).    |
| 5   | references/multi-agent-contract.md mentions all 4 typed errors + back tool                                                                                     | VERIFIED   | File exists (62 lines). All four typed errors as H3 subsection titles: TAB_NOT_OWNED (line 20), AGENT_CAP_REACHED (line 25), TAB_INCOGNITO_NOT_SUPPORTED (line 30), TAB_OUT_OF_SCOPE (line 35). `back` tool covered in dedicated H2 section (lines 40-51). `agent_id` rule stated. |
| 6   | references/restricted-tab-recovery.md exists with safe recovery tools list                                                                                     | VERIFIED   | File exists (48 lines). Seven safe recovery tools all in table at lines 17-23: list_tabs, switch_tab, open_tab, navigate, go_back, go_forward, refresh. chrome:// and edge:// named at line 3. Worked bootstrap example at lines 27-36.                                          |
| 7   | references/default-to-fsb.md has soft preference + hard escalation + WebFetch carve-out                                                                        | VERIFIED   | File exists (79 lines). "Soft preference" H2 (lines 5-9) with "Default to FSB tools when one fits." rule. "Hard escalation rule" H2 (lines 11-22) lists click, text input, auth, multi-tab triggers. "Stay on WebFetch (carve-out)" H2 (lines 24-35) names public-doc, JSON, RSS, sitemap. |
| 8   | references/vault-boundary.md mentions fill_credential / use_payment_method                                                                                     | VERIFIED   | File exists (45 lines). `fill_credential` named at line 7 + line 21. `use_payment_method` named at line 8 + line 27. `requires.env: []` rule at line 10. "No secrets in chat" rule at line 9. Three [BAD]/[GOOD] anti-pattern callouts at lines 18-34.                              |
| 9   | references/visual-session-lifecycle.md exists; SKILL.md body points at it                                                                                      | VERIFIED   | File exists (64 lines) with start_visual_session/end_visual_session, session_token, try/finally pattern, error-path coverage, anti-patterns. SKILL.md line 33 contains: "Lifecycle details, the try/finally close pattern, and error-path close coverage live in `references/visual-session-lifecycle.md`." |
| 10  | ZERO emojis everywhere; ASCII only                                                                                                                             | VERIFIED   | Python regex scan covering U+1F300-U+1FAFF, U+2600-U+27BF, U+1F000-U+1F2FF, U+1F900-U+1F9FF over all 8 deliverable files returned 0 matches. ASCII-only status markers ([OK], [FAIL], [WARN]) used throughout.                                                                  |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                                              | Expected                                                                  | Status     | Details                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `skills/FSB Skill/USAGE.md`                                           | 3-step install + try-it + 6-layer recovery, ASCII only                    | VERIFIED   | 96 lines. Contains canonical Web Store URL (2x), GitHub Releases URL (2x), six-layer recovery table, three manual prompts + one autopilot example.    |
| `skills/FSB Skill/references/tool-decision-tree.md`                   | Read-only-first decision tree; only registry tools as bare tokens         | VERIFIED   | 73 lines. Read-only escalation order, typed-events-over-.value [BAD]/[GOOD] block, 17-row tool quick-reference table, autopilot escalation prose only. |
| `skills/FSB Skill/references/multi-agent-contract.md`                 | agent_id rule, 4 typed errors, back tool                                  | VERIFIED   | 62 lines. All four typed errors verbatim, agent_id rule with [BAD]/[GOOD], back vs execute_js section with anti-pattern.                              |
| `skills/FSB Skill/references/restricted-tab-recovery.md`              | 7 safe recovery tools + worked example                                    | VERIFIED   | 48 lines. All 7 tools in table; chrome://, edge://, Web Store named; chrome://newtab bootstrap example present.                                       |
| `skills/FSB Skill/references/default-to-fsb.md`                       | Soft preference + hard escalation + WebFetch carve-out                    | VERIFIED   | 79 lines. All three rules stated; ASCII decision flowchart; concrete examples on each side.                                                            |
| `skills/FSB Skill/references/vault-boundary.md`                       | fill_credential / use_payment_method routing + requires.env empty         | VERIFIED   | 45 lines. Both vault tools named; requires.env rule restated; three [BAD]/[GOOD] anti-pattern callouts; "no secrets in chat" rule.                    |
| `skills/FSB Skill/references/visual-session-lifecycle.md`             | Pairing rule + try/finally + error-path coverage                          | VERIFIED   | 64 lines. Numbered pairing rule, termination outcomes table, try/finally pseudocode, error-path coverage list, two [BAD]/[GOOD] anti-patterns.        |
| `skills/FSB Skill/SKILL.md` (body pointer to visual-session-lifecycle) | Body paragraph points to references/visual-session-lifecycle.md           | VERIFIED   | Line 33 contains explicit pointer. Frontmatter (lines 1-12) untouched per Phase 249 contract.                                                          |

### Key Link Verification

| From                                       | To                                                  | Via                                                                                | Status | Details                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USAGE.md                                   | scripts/doctor.mjs                                  | Six-layer recovery table mirrors LAYERS array order                                | WIRED  | Six rows in exact order (package -> bridge -> extension -> active-tab -> content-script -> config). Cause/action wording matches NEXT_STEPS map.                      |
| USAGE.md                                   | github.com/LakshmanTurlapati/FSB/releases           | GitHub Releases fallback link in step 1                                            | WIRED  | URL appears verbatim at line 26 (install step) and line 91 (recovery row).                                                                                            |
| references/tool-decision-tree.md           | mcp/ai/tool-definitions.cjs                         | Every bare tool token must match a `name:` field                                   | WIRED  | All 24 tokens (read_page, get_dom_snapshot, get_page_snapshot, get_site_guide, click, type_text, press_enter, press_key, select_option, check_box, hover, focus, clear_input, wait_for_element, wait_for_stable, open_tab, switch_tab, list_tabs, navigate, go_back, go_forward, refresh, execute_js, scroll_to_element) confirmed in registry. |
| references/multi-agent-contract.md         | SKILL.md                                            | SKILL.md body links via relative path                                              | WIRED  | SKILL.md line 37 + line 46 reference the file by relative path.                                                                                                       |
| references/restricted-tab-recovery.md      | mcp/ai/tool-definitions.cjs                         | Seven recovery tools must all be `name:` fields                                    | WIRED  | All 7 (list_tabs, switch_tab, open_tab, navigate, go_back, go_forward, refresh) confirmed in registry.                                                                |
| references/vault-boundary.md               | SKILL.md                                            | `requires.env: []` is the contract this file documents                             | WIRED  | SKILL.md line 7 contains `env: []`; vault-boundary.md line 10 documents the rule explicitly.                                                                          |
| SKILL.md (body)                            | references/visual-session-lifecycle.md              | "Visual session wrapping" paragraph adds explicit pointer                          | WIRED  | SKILL.md line 33 contains the literal substring `references/visual-session-lifecycle.md`. Target file exists.                                                         |

### Behavioral Spot-Checks

| Behavior                                                              | Command                                                                          | Result   | Status |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- | ------ |
| All 6 reference files + USAGE.md exist on disk                        | `ls "skills/FSB Skill/references/"` + USAGE.md presence                          | 7 files exist (6 referenced + README.md placeholder) | PASS |
| Web Store URL appears verbatim in USAGE.md                            | grep canonical URL string                                                        | 2 hits (install + recovery row)                      | PASS |
| All 4 typed errors appear in multi-agent-contract.md                  | grep each name                                                                   | 4/4 hits as H3 titles                                 | PASS |
| Tool tokens in tool-decision-tree.md match tool-definitions.cjs       | Cross-reference name: fields                                                     | 24/24 matched                                         | PASS |
| Zero emojis across all 8 phase deliverables                           | Python regex scan over emoji code-point ranges                                   | 0 matches in any file                                 | PASS |
| Seven safe recovery tools all in restricted-tab-recovery.md table     | grep each name                                                                   | 7/7 hits                                              | PASS |
| SKILL.md frontmatter untouched (`requires.env: []`, version: 0.9.61)  | head -12 SKILL.md                                                                | Frontmatter intact                                    | PASS |

### Requirements Coverage

| Requirement | Source Plan      | Description                                                                                              | Status     | Evidence                                                                                                                                                                  |
| ----------- | ---------------- | -------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOCS-01     | 250-01-PLAN.md   | 3-step install with Chrome Web Store + GitHub Releases fallback                                          | SATISFIED  | USAGE.md lines 13-61: three numbered install steps; Web Store URL verbatim; GitHub Releases fallback present.                                                              |
| DOCS-02     | 250-01-PLAN.md   | Try-it prompts (3 manual + 1 autopilot)                                                                  | SATISFIED  | USAGE.md lines 63-81: read_page, click, type_text manual prompts; one explicit run_task autopilot example with delegation framing.                                         |
| DOCS-03     | 250-01-PLAN.md   | 6-layer doctor recovery recipe                                                                           | SATISFIED  | USAGE.md lines 83-96: six-row table mirroring scripts/doctor.mjs LAYERS array, cause/action align with NEXT_STEPS map.                                                     |
| DOCS-04     | 250-02-PLAN.md   | tool-decision-tree.md references only registry tools                                                     | SATISFIED  | All 24 bare tokens cross-verified against tool-definitions.cjs name: fields. run_task scoped to autopilot prose only.                                                     |
| DOCS-05     | 250-02-PLAN.md   | multi-agent-contract.md mentions 4 typed errors + back tool + agent_id rule                              | SATISFIED  | All four error names verbatim as H3 titles; back tool covered in own H2; agent_id rule with [BAD]/[GOOD] block.                                                            |
| DOCS-06     | 250-03-PLAN.md   | restricted-tab-recovery.md with safe recovery tools list                                                 | SATISFIED  | Seven recovery tools in table; chrome://newtab bootstrap example present; restricted prefixes (chrome://, edge://, Web Store) named.                                       |
| POLICY-01   | 250-03-PLAN.md   | default-to-fsb.md soft preference + hard escalation + WebFetch carve-out                                 | SATISFIED  | All three rules stated explicitly; ASCII decision flowchart; concrete examples on each side; click/auth/multi-tab triggers all named.                                      |
| POLICY-02   | 250-03-PLAN.md   | vault-boundary.md mentions fill_credential / use_payment_method routing                                  | SATISFIED  | Both vault tools as exclusive routing surface; requires.env: [] rule; no-secrets-in-chat rule; three [BAD]/[GOOD] callouts; extension-internal resolution model documented. |
| POLICY-03   | 250-04-PLAN.md   | SKILL.md visual-session wrapping rule + references/ link covers lifecycle                                | SATISFIED  | SKILL.md body paragraph names start_visual_session(client="OpenClaw"...) and end_visual_session(session_token=..., reason=...); pointer to references/visual-session-lifecycle.md present; that file documents pairing rule + try/finally + error-path coverage. |

REQUIREMENTS.md table (lines 123-131) maps DOCS-01..06 + POLICY-01..03 to Phase 250. All 9 IDs claimed by plans (250-01: DOCS-01..03; 250-02: DOCS-04..05; 250-03: DOCS-06 + POLICY-01..02; 250-04: POLICY-03). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

None found. All deliverables are substantive (45-96 lines each), follow the prescribed shape (H1 + framing + rules + worked example + see-also), use ASCII status markers exclusively, and contain zero TODO/FIXME/placeholder/emoji content. SKILL.md frontmatter is byte-identical to Phase 249 output (anti-scope respected).

### Gaps Summary

No gaps. All 10 roadmap success criteria are met by concrete, substantive content in the expected files. The phase delivered:

- **USAGE.md** (96 lines) covering 3-step install, try-it prompts, and 6-layer doctor recovery -- the human-facing surface a new user reads first.
- **6 reference files** (45-79 lines each) covering the OpenClaw priors: tool decision tree, multi-agent contract, restricted-tab recovery, default-to-FSB rule, vault boundary, and visual-session lifecycle.
- **One-sentence SKILL.md body edit** wiring the visual-session paragraph to the new lifecycle reference, with frontmatter untouched.

Tool-name registry alignment is exact (24/24 tokens validated against `mcp/ai/tool-definitions.cjs`). All four typed errors appear verbatim. Both canonical URLs (Web Store + GitHub Releases) appear in USAGE.md. Phase 251 TEST-04 grep checks pre-pass against all files. The "ZERO emojis" project rule is honored throughout.

The phase goal -- "the skill teaches OpenClaw the right priors" -- is achieved end-to-end: a new user can read USAGE.md cleanly, and an OpenClaw model loading any of the six reference files gets the correct decision/contract/policy guidance without re-reading the SKILL.md body.

---

_Verified: 2026-05-08_
_Verifier: Claude (gsd-verifier)_
