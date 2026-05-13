# Roadmap

**Current milestone:** v0.9.63 -- Showcase i18n. Branch: `feat/showcase-i18n`. Goal: mark every visible marketing string with `$localize` / `i18n`, gate drift in CI, and produce target XLIFFs for es/de/ja/zh-CN/zh-TW with hreflang + canonical fan-out.

**Requirements:** see `.planning/REQUIREMENTS.md`.

## Phases

| # | Phase | Status | Plans |
|---|-------|--------|-------|
| 261 | i18n-scaffold | DONE | 4/4 -- LocaleService, picker mount, DO-NOT-TRANSLATE, ESLint + extract-i18n |
| 262 | marketing-strings | DONE | 5/5 -- shell, home/about, agents/privacy/support, CI gates + TS SEO markers |
| 264 | per-locale-bootstrap | TODO | hreflang + canonical fan-out for `index.html` per-locale render |
| 265 | translator-fill | TODO | AI translator fills target XLIFFs (es/de/ja/zh-CN/zh-TW); flips `i18nMissingTranslation: warning -> error` |
| 266 | verification-baseline | TODO | lint:i18n 0 errors, extract-clean 0 diff, build emits 30 prerendered HTMLs |

## Latest milestone archive

[v0.9.62 -- Implicit Visual Session Contract](milestones/v0.9.62-ROADMAP.md) -- 7 phases (254-260), 15 plans, 27/27 v1 requirements satisfied, audit `passed`. Branch: `refinements`. Final `npm publish fsb-mcp-server@0.9.0` remains user-gated.

## Previous archives

- [v0.9.61 -- FSB Skill (OpenClaw)](milestones/v0.9.61-ROADMAP.md) -- 6 phases, 29/29 requirements, shipped 2026-05-08
- [v0.9.60 -- Multi-Agent Tab Concurrency (MCP 0.8.0)](milestones/v0.9.60-ROADMAP.md) -- 11 phases, 42/42 requirements, shipped 2026-05-08

See `.planning/MILESTONES.md` for the full milestone history.
