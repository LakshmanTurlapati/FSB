# Roadmap

**Status:** v0.9.63 Showcase i18n shipped 2026-05-13. No active milestone. Run `/gsd-new-milestone` to start the next cycle.

---

## Latest milestone archive

[v0.9.63 -- Showcase i18n](milestones/v0.9.63-ROADMAP.md) -- 7 phases (261, 262, 264, 265, 266, 267, 268), 15 plans, 14/14 requirements satisfied, audit `passed`. Branch: `feat/showcase-i18n`. Marketing site (`showcase/angular`) now ships in en/es/de/ja/zh-CN/zh-TW with hreflang + canonical fan-out, AI-filled XLIFFs, hard-fail CI gates, and Accept-Language auto-detection. WARNING-02 (picker-cookie short-circuits bare-`/` redirect on fresh tabs) carried forward as deferred.

## Previous archives

- [v0.9.62 -- Implicit Visual Session Contract](milestones/v0.9.62-ROADMAP.md) -- 7 phases (254-260), 15 plans, 27/27 v1 requirements satisfied, audit `passed`. Branch: `refinements`. Final `npm publish fsb-mcp-server@0.9.0` remains user-gated.
- [v0.9.61 -- FSB Skill (OpenClaw)](milestones/v0.9.61-ROADMAP.md) -- 6 phases, 29/29 requirements, shipped 2026-05-08.
- [v0.9.60 -- Multi-Agent Tab Concurrency (MCP 0.8.0)](milestones/v0.9.60-ROADMAP.md) -- 11 phases, 42/42 requirements, shipped 2026-05-08.

See `.planning/MILESTONES.md` for the full milestone history.

---

## Backlog (carry-forward candidates for future milestones)

- **v0.9.64 (UX):** revisit WARNING-02 -- picker-set `fsb-locale` cookie short-circuits the bare-`/` Accept-Language redirect on returning fresh-tab / shared-link visits; currently surfaces EN prerender at root. Locked per 267-CONTEXT D-02; flag for UX revisit.
- **v0.9.65 (dashboard i18n):** translate `showcase/angular/src/app/pages/dashboard/**`; remove the `--ignore-pattern` in `package.json:lint:i18n`.
- **Future CI hardening:** static-analysis pass flagging ad-hoc locale-list literals anywhere in `showcase/` outside `locale-constants.{ts,js}` to generalize the registry-parity invariant.
- **Carry-forward from prior milestones:**
  - `git push origin refinements && git push origin v0.9.62` -- branch + tag not pushed.
  - `npm publish fsb-mcp-server@0.9.0` -- in-tree at 0.9.0; final publish user-gated.
  - `clawhub publish "skills/FSB Skill"` -- carry-forward from v0.9.61.
  - 4 live-OpenClaw runtime UAT items carried from v0.9.61.
