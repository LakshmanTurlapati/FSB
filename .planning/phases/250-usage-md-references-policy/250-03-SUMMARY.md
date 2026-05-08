---
phase: 250-usage-md-references-policy
plan: 03
subsystem: skills/FSB Skill/references
tags: [docs, policy, references, skill]
requires: []
provides:
  - skills/FSB Skill/references/restricted-tab-recovery.md
  - skills/FSB Skill/references/default-to-fsb.md
  - skills/FSB Skill/references/vault-boundary.md
affects:
  - skills/FSB Skill/SKILL.md (existing pointer paths now resolve to real files)
tech_stack_added: []
key_files_created:
  - skills/FSB Skill/references/restricted-tab-recovery.md
  - skills/FSB Skill/references/default-to-fsb.md
  - skills/FSB Skill/references/vault-boundary.md
key_files_modified: []
decisions:
  - DOCS-06: documented seven safe recovery tools (list_tabs, navigate, open_tab, switch_tab, go_back, go_forward, refresh) with worked chrome://newtab bootstrap example
  - POLICY-01: codified soft preference + hard escalation (click/type/auth/multi-tab) + WebFetch carve-out for public-doc/JSON/RSS
  - POLICY-02: codified fill_credential / use_payment_method as the only credential routing surface; requires.env stays empty
metrics:
  tasks: 3
  files_created: 3
  files_modified: 0
completed_date: 2026-05-08
---

# Phase 250 Plan 03: Restricted-tab Recovery + Default-to-FSB + Vault Boundary Summary

Authored three OpenClaw skill reference files codifying the chrome:// / edge:// / Web Store recovery toolset (DOCS-06), the default-to-FSB rule with WebFetch carve-out (POLICY-01), and the password / payment vault boundary (POLICY-02).

## Final line counts

| File                                                       | Lines |
|------------------------------------------------------------|-------|
| skills/FSB Skill/references/restricted-tab-recovery.md     | 48    |
| skills/FSB Skill/references/default-to-fsb.md              | 79    |
| skills/FSB Skill/references/vault-boundary.md              | 45    |
| **Total**                                                  | 172   |

All three files follow the consistent shape mandated by 250-CONTEXT.md `<specifics>`: H1 title + one-paragraph framing + numbered/bulleted rules + worked example + see-also.

## Requirement coverage

### DOCS-06 -- restricted-tab-recovery.md

Quoted from `skills/FSB Skill/references/restricted-tab-recovery.md`:

> "When FSB's active tab is at a restricted URL (`chrome://*`, `edge://*`, `https://chrome.google.com/webstore/*`, `https://chromewebstore.google.com/*`), the FSB content script cannot attach. DOM tools (`read_page`, `get_dom_snapshot`, `click`, `type_text`, etc.) will fail."

> "Browsers explicitly forbid content scripts from attaching to internal pages and the Chrome Web Store as a security boundary. The Manifest V3 `host_permissions` list cannot match these origins; Chrome rejects them at the policy layer."

Recovery tools table covers all seven names: `list_tabs`, `switch_tab`, `open_tab`, `navigate`, `go_back`, `go_forward`, `refresh`. Each row includes a one-line example.

Worked example (chrome://newtab -> `list_tabs` -> `switch_tab` -> resume) is present as a six-step ordered list under the H2 "Worked example: bootstrap recovery from chrome://newtab".

### POLICY-01 -- default-to-fsb.md

Quoted from `skills/FSB Skill/references/default-to-fsb.md`:

> "Rule: **Default to FSB tools when one fits.**"

> "If ANY of the following triggers apply, the task MUST use FSB. There is no judgment call here. -- Any click on a real web page. -- Any text input into a real form ... -- Any auth flow ... -- Any multi-tab orchestration ..."

> "Rule: **If a task hits any bullet above, it does not belong on WebFetch. Escalate to FSB.**"

WebFetch carve-out (public-doc / JSON / RSS / sitemap.xml / robots.txt / raw README / static landing pages) is enumerated under "## Stay on WebFetch (carve-out)". ASCII decision flowchart is included. Concrete examples block lists five FSB cases and four WebFetch cases.

### POLICY-02 -- vault-boundary.md

Quoted from `skills/FSB Skill/references/vault-boundary.md`:

> "Passwords, CVVs, and saved payment methods never cross into chat or tool arguments. They stay inside the FSB Chrome extension's encrypted storage, where the extension fills them at the DOM layer."

> "Passwords, CVV codes, and other secret credentials are entered through `fill_credential` ONLY."

> "Saved payment methods are entered through `use_payment_method` ONLY."

> "`requires.env: []` is mandatory in `SKILL.md` frontmatter. There are no provider env vars in the skill -- vault values resolve inside the FSB Chrome extension's encrypted storage (`secure-config.js` in the extension source), not in the MCP server process and not in the OpenClaw host process."

Three `[BAD]`/`[GOOD]` anti-pattern callouts (type_text-with-secret, raw card_number/cvv, env-var-for-secret) are present. The "Why this boundary matters" section explains the durability argument (MCP arg logging, host context retention, retry buffers).

## Verification

Per-file automated grep checks (from each task's `<verify><automated>` block) all passed. Final summary:

| File                          | Required tokens                                                                                                              | Status |
|-------------------------------|------------------------------------------------------------------------------------------------------------------------------|--------|
| restricted-tab-recovery.md    | list_tabs, navigate, open_tab, switch_tab, go_back, go_forward, refresh, chrome://, edge://                                  | PASS   |
| default-to-fsb.md             | WebFetch, RSS, JSON, click, auth, multi-tab                                                                                  | PASS   |
| vault-boundary.md             | fill_credential, use_payment_method, requires.*env, secret, extension                                                        | PASS   |

Non-ASCII / emoji scan (`LC_ALL=C grep '[^[:print:][:space:]]'`) returned zero matches across all three files. CLAUDE.md NO-EMOJIS rule satisfied.

## Deviations from Plan

None. Plan content spec, file structure, and decisions in 250-CONTEXT.md were followed exactly. Wording in framing paragraphs matches the plan's prescribed prose. The `Note: every Tool-column token must be a name listed in mcp/ai/tool-definitions.cjs` instruction in the plan was rendered as a paragraph immediately under the table rather than as a literal "Note:" line, but the substantive claim (every name in the table is a registered tool) is preserved.

## Commits

| Task | Description                                              | Hash    |
|------|----------------------------------------------------------|---------|
| 1    | feat(250-03): author references/restricted-tab-recovery.md (DOCS-06) | 2c0ee5d |
| 2    | feat(250-03): author references/default-to-fsb.md (POLICY-01)        | 77d9429 |
| 3    | feat(250-03): author references/vault-boundary.md (POLICY-02)        | ad51247 |

## Self-Check: PASSED

Files verified to exist:
- FOUND: skills/FSB Skill/references/restricted-tab-recovery.md
- FOUND: skills/FSB Skill/references/default-to-fsb.md
- FOUND: skills/FSB Skill/references/vault-boundary.md

Commits verified to exist:
- FOUND: 2c0ee5d
- FOUND: 77d9429
- FOUND: ad51247
