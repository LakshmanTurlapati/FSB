---
quick_id: 260527-gue
description: Fix docs branch CI failures from stale showcase i18n and stats crawler metadata
date: 2026-05-27
branch: docs
status: planned
files_modified:
  - showcase/angular/src/locale/messages.xlf
  - showcase/angular/src/locale/messages.es.xlf
  - showcase/angular/src/locale/messages.de.xlf
  - showcase/angular/src/locale/messages.ja.xlf
  - showcase/angular/src/locale/messages.zh-CN.xlf
  - showcase/angular/src/locale/messages.zh-TW.xlf
  - showcase/angular/scripts/llms-full.source.md
  - showcase/angular/public/llms-full.txt
  - showcase/angular/public/llms.txt
must_haves:
  truths:
    - "CI's Angular extract-i18n diff is clean against showcase/angular/src/locale/messages.xlf."
    - "All non-English locale files compile with the current support FAQ placeholder shape."
    - "`/stats` remains a working hidden route but does not appear in crawler/prerender metadata."
  artifacts:
    - "showcase/angular/src/locale/messages.xlf mirrors the current support-page.component.html extraction."
    - "showcase/angular/src/locale/messages.{es,de,ja,zh-CN,zh-TW}.xlf have translated targets whose placeholders match the updated source units."
    - "showcase/angular/public/llms.txt and llms-full.txt contain no /stats entry; llms-full.txt is consistent with scripts/llms-full.source.md."
  key_links:
    - "support-page.component.html -> messages.xlf via `ng extract-i18n`."
    - "messages.xlf support trans-unit placeholder IDs -> each translated locale target."
    - "scripts/llms-full.source.md -> public/llms-full.txt generated metadata."
---

<objective>
Unblock docs-branch CI by bringing showcase Angular i18n and crawler metadata back in sync with the current source.

Purpose: The website CI job currently fails because `messages.xlf` is stale after support FAQ copy/markup changes, translated locale targets still carry the old placeholder shape for those FAQ units, and the smoke test rejects `/stats` in public crawler metadata.

Output: Updated i18n source/locale XLF files and crawler metadata only. Do not change CI, route definitions, stats page code, or the support template copy unless extraction proves the template itself is invalid.
</objective>

<context>
@.planning/STATE.md
@.github/workflows/ci.yml
@tests/showcase-build-smoke.test.js
@showcase/angular/src/app/pages/support/support-page.component.html
@showcase/angular/src/locale/messages.xlf
@showcase/angular/public/llms.txt
@showcase/angular/public/llms-full.txt
@showcase/angular/scripts/llms-full.source.md

Important observed failure surfaces:
- CI website job runs locale parity, `lint:i18n`, `ng extract-i18n` + `diff`, Angular build, hreflang verification, and bundle budget checks.
- `tests/showcase-build-smoke.test.js` requires `/stats` to be absent from `showcase/angular/prerender-routes.txt`, `showcase/angular/public/sitemap.xml`, `showcase/angular/public/llms.txt`, `showcase/angular/public/llms-full.txt`, and built `dist/`.
- `messages.xlf` is stale for support FAQ units whose template text now differs, especially `support.faq.q.install.a`, `support.faq.q.mcp.a`, `support.faq.q.ideSetup.a`, and `support.faq.q.openclawInstall.a`.
- `llms.txt`, `llms-full.txt`, and `llms-full.source.md` currently mention `/stats`; the smoke invariant says crawler metadata must not.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refresh extracted Angular i18n source</name>
  <files>showcase/angular/src/locale/messages.xlf</files>
  <action>
Run Angular extraction into a temporary directory and update `showcase/angular/src/locale/messages.xlf` so it exactly matches the current templates. Keep existing custom i18n IDs; do not rename IDs or hand-edit placeholder IDs when the extractor can produce them. Confirm the changed support FAQ source units reflect `support-page.component.html`, especially:
- `support.faq.q.install.a` now describes Chrome Web Store install plus Load unpacked only for local development/unreleased fixes.
- `support.faq.q.mcp.a` now describes the ClawHub path plus manual fallback wording.
- `support.faq.q.ideSetup.a` now starts with `install --list`, calls out ClawHub for OpenClaw, and keeps the `--openclaw` manual fallback rationale.
- `support.faq.q.openclawInstall.a` now starts with ClawHub first and removes the old "Three options, fastest first" strong-tag structure.
Do not change `support-page.component.html` unless extraction fails because the template markup is invalid.
  </action>
  <verify>
    <automated>mkdir -p /tmp/extract-check && npx --prefix showcase/angular ng extract-i18n --output-path /tmp/extract-check && diff -u showcase/angular/src/locale/messages.xlf /tmp/extract-check/messages.xlf</automated>
  </verify>
  <done>`diff` exits 0, and the support FAQ trans-units in `messages.xlf` match the current template source text and placeholder layout.</done>
</task>

<task type="auto">
  <name>Task 2: Repair translated locale placeholder parity for changed FAQ units</name>
  <files>showcase/angular/src/locale/messages.es.xlf, showcase/angular/src/locale/messages.de.xlf, showcase/angular/src/locale/messages.ja.xlf, showcase/angular/src/locale/messages.zh-CN.xlf, showcase/angular/src/locale/messages.zh-TW.xlf</files>
  <action>
For each non-English locale, update the same changed support FAQ trans-units from Task 1 so each source block matches the refreshed English `messages.xlf` source and each translated target uses the exact same placeholder IDs and nesting as that source. Preserve translated prose where possible, but rewrite the target sentence when the old translation still describes removed content or contains placeholders no longer present in the new source.

Focus first on `support.faq.q.install.a`, `support.faq.q.mcp.a`, `support.faq.q.ideSetup.a`, and `support.faq.q.openclawInstall.a`; if the build reports another support FAQ placeholder mismatch, fix that unit in all five locales too. Do not remove `<target state="translated">` and do not downgrade translations to source-language placeholders only.
  </action>
  <verify>
    <automated>npm --prefix showcase/angular run lint:i18n && npm --prefix showcase/angular run build --silent</automated>
  </verify>
  <done>Angular build exits 0 with `i18nMissingTranslation: error` honored, and all changed support FAQ targets remain `state="translated"` with placeholder IDs matching their refreshed source blocks.</done>
</task>

<task type="auto">
  <name>Task 3: Remove /stats from crawler metadata while preserving the hidden route</name>
  <files>showcase/angular/scripts/llms-full.source.md, showcase/angular/public/llms-full.txt, showcase/angular/public/llms.txt</files>
  <action>
Remove the public `/stats` mention from `showcase/angular/scripts/llms-full.source.md`, regenerate or update `showcase/angular/public/llms-full.txt` from that source, and remove the `[Stats](https://full-selfbrowsing.com/stats)` entry from `showcase/angular/public/llms.txt`.

Do not edit `showcase/angular/src/app/app.routes.ts`, `showcase/angular/src/app/app.routes.server.ts`, `showcase/angular/prerender-routes.txt`, `showcase/angular/public/sitemap.xml`, or stats page source. The route should remain reachable as an Easter egg/footer-only app route; this task only keeps crawler and LLM-ingest metadata from advertising it.
  </action>
  <verify>
    <automated>! rg -n "/stats" showcase/angular/scripts/llms-full.source.md showcase/angular/public/llms-full.txt showcase/angular/public/llms.txt showcase/angular/prerender-routes.txt showcase/angular/public/sitemap.xml && node tests/showcase-build-smoke.test.js</automated>
  </verify>
  <done>`/stats` is absent from crawler/LLM metadata checked above, `tests/showcase-build-smoke.test.js` exits 0, and no route/stats implementation files were changed.</done>
</task>

</tasks>

<verification>
Run the CI-equivalent website checks before summary:

```bash
node showcase/angular/scripts/verify-locale-sync.mjs
npm --prefix showcase/angular run lint:i18n
mkdir -p /tmp/extract-check && npx --prefix showcase/angular ng extract-i18n --output-path /tmp/extract-check && diff -u showcase/angular/src/locale/messages.xlf /tmp/extract-check/messages.xlf
npm --prefix showcase/angular run build --silent
npm --prefix showcase/angular run verify:hreflang
node showcase/angular/scripts/verify-bundle-budgets.mjs
node tests/showcase-build-smoke.test.js
```
</verification>

<success_criteria>
- Only i18n XLF files and crawler metadata files listed in `files_modified` change.
- The docs branch website CI path passes locally.
- `/stats` remains absent from crawler metadata but is not removed from the app route.
</success_criteria>
