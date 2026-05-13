---
phase: 265-translator-fill
gathered: 2026-05-12
status: ready-for-planning
mode: auto (locked by /gsd-autonomous --from 265)
requirements_addressed: [TRANS-01, CI-04]
---

# Phase 265: Translator Fill -- Context

## Phase Boundary

Populate every target XLIFF (`messages.{es,de,ja,zh-CN,zh-TW}.xlf`) with translations of all 420 source `<trans-unit>` elements from `messages.xlf`. Every `<target>` must:

1. Match the source semantically and tone-appropriately for the locale.
2. Preserve every inline `<x id="..."/>` placeholder verbatim, in the same positional sense (placeholders correspond to `translate="no"` wrappers around brand/CLI/machine tokens).
3. Preserve every `equiv-text`/`ctype` attribute on placeholders byte-equal (XLIFF round-trippability).
4. Render in the locale's natural script + casing; for CJK locales, use full-width punctuation where idiomatic but leave English-only placeholder values alone.

After all five target XLIFFs are filled, flip `i18nMissingTranslation` from `warning` to `error` in `showcase/angular/angular.json` so any future missed string breaks the build.

## Locked Decisions

### D-01 -- Translator strategy: Inline (user explicit choice "A")

The translations are produced inline within this conversation by Claude (the current session). Not via an external script, not via DeepL, not via a separate API call. Reason: user explicit override of all script-based alternatives in the autonomous handshake on 2026-05-12.

**Implication:** Each target XLIFF is written via a single `Write` tool call carrying the complete file. Five target XLIFFs => five Write calls. Five commits, one per locale, for atomic revert + clean git history.

**How to apply:** When executing, read source `messages.xlf` in full, then for each of the 5 target locales, emit a single file containing all 420 trans-units with both `<source>` (byte-equal copy) and a freshly translated `<target>`. Brand/CLI placeholders (`<x id="..."/>`) are copy-paste-preserved.

### D-02 -- Brand/CLI/machine token policy

The authoritative non-translation list lives at `showcase/angular/src/locale/DO-NOT-TRANSLATE.md`. Every entry there must appear verbatim in target strings. In the XLIFF, this is enforced structurally: brand/CLI tokens are already wrapped in `<x id="..."/>` placeholders by the extractor (154 such placeholders across the source XLIFF). The translator's only obligation is to:

- Keep each `<x ... />` byte-equal to the source (including `equiv-text`, `ctype`, `id` attributes).
- Place placeholders in positions that make the translated sentence grammatical (e.g., a placeholder representing a subject may move toward the start in SVO -> SOV restructuring for ja).
- Not introduce any new placeholders, IDs, or attributes.

**Why:** The DO-NOT-TRANSLATE list is normative; structural enforcement via XLIFF placeholders means the translator literally cannot mistranslate brand names because they are not in the translatable surface area.

### D-03 -- Per-locale tone register

Locked register conventions for translator voice across all 420 trans-units:

| Locale | Register | Notes |
|--------|----------|-------|
| es | Neutral Spanish (LATAM-leaning, no voseo). Formal "tu" / second-person plural avoided where possible -- favor impersonal "se" or imperative forms. | Marketing copy reads cleanly across Spain + Mexico + Argentina. |
| de | Formal "Sie" by default; "du" only in conversational micro-copy (e.g., button labels, headers where English uses imperative "Try it"). | Standard German tech-marketing register. |
| ja | です/ます form (polite/formal). Avoid sonkei-go (honorific) since the user is the audience, not the addressee. | Standard tech-product Japanese. |
| zh-CN | 简体中文, 现代书面语 (Simplified, modern written register). Use mainland tech-industry conventions (e.g., "网页" not "網頁"). | Tech-marketing tone. |
| zh-TW | 繁體中文, 台灣書面語 (Traditional, Taiwan written register). Use Taiwan tech vocabulary (e.g., "瀏覽器" matches both; "資料" not "数据"). | Distinct from zh-CN -- not just script conversion. |

**Why:** Without locked tone, output drifts across the 420 strings (some formal, some casual) and reviewers cannot meaningfully QA. Single-register output is uniformly judgable.

**How to apply:** Translator (= this session) keeps the register table at the top of every file's mental working set. If a string is impossible in the prescribed register (e.g., a one-word UI label that has no formal/informal distinction), use the most idiomatic form for that locale's tech UI conventions.

### D-04 -- Plurals + ICU expressions

ICU plural/select expressions in the source (none counted in current 420 trans-units, but if any sneak in) are kept structurally identical in the target -- only the literal phrases inside `{...}` branches are translated. The placeholder variable names (e.g., `{count}`) stay byte-equal.

### D-05 -- XLIFF structural conventions

Target XLIFFs use Angular's standard 1.2 dialect:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="{LOCALE}" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="{ID}" datatype="html">
        <source>...</source>
        <target>...</target>
        <context-group purpose="location">
          <context context-type="sourcefile">...</context>
          <context context-type="linenumber">...</context>
        </context-group>
      </trans-unit>
      ...
    </body>
  </file>
</xliff>
```

The existing skeleton's `<file target-language="..."/>` attribute stays. `<source>` is byte-equal copy from `messages.xlf` (preserves placeholders + escaping). `<target>` is new and translated. `<context-group>` is byte-equal copy.

**Why:** `ng build --localize` consumes this format; any deviation breaks the build. Existing successful XLIFFs in archived milestones (none in this project) would have set precedent -- we follow the Angular CLI default.

### D-06 -- `state` attribute on target

Set `<target state="translated">...</target>` on every populated target. Reason: the default `i18nMissingTranslation` policy treats absent `<target>` as missing, but a present `<target>` with `state="new"` is also flagged when policy is `error`. `state="translated"` is the all-clear signal.

### D-07 -- Order of trans-units in target

Same order as `messages.xlf`. Order is irrelevant to Angular's loader (it indexes by `id`), but byte-stable ordering lets `diff` against future re-extractions stay clean and lets reviewers eyeball-compare side-by-side.

### D-08 -- When to flip `i18nMissingTranslation: warning -> error`

Flip happens in the **same plan** as the last locale fill, in the **commit after** all five XLIFFs are committed. This way the build never breaks mid-phase: each per-locale commit lands clean (warning policy), then the policy flip commit is the final guard. If reverting becomes necessary, the policy flip is its own one-line revert.

### D-09 -- CI gate coupling (CI-04)

CI-04 requirement: any future re-extraction must not introduce new `<trans-unit>` IDs without a matching target translation. The mechanism is the `i18nMissingTranslation: error` flip itself -- `ng build` is already in CI, so missing targets break the build. **No new CI script needed.** Phase 266 verification simply asserts the policy is set to `error` in `angular.json`.

### D-10 -- Quality gate before commit

Before committing each target XLIFF:

1. `<trans-unit>` count must equal 420 (exact match with source).
2. Every `<source>` must be byte-equal to the corresponding source XLIFF entry.
3. Every `<target>` must be non-empty.
4. Every `<x id="..."/>` placeholder count in target must equal source for that trans-unit.
5. File must parse as XML (no `<`, `>`, `&` escaping errors).

Mechanical verification deferred to Phase 266 (`verify-xliff-targets.mjs` or equivalent assertions). For Phase 265, the in-session quality gate is a `grep`-based count check at the end of each Write.

### D-11 -- HTML entities + escaping

Source XLIFF uses `&apos;`, `&quot;`, `&amp;`, `&lt;`, `&gt;` where needed. Target keeps the same escaping discipline. Translators emit literal characters in non-Latin scripts directly (no entity needed); apostrophes inside Spanish/German prose are preserved as `&apos;` only if they appeared in source.

### D-12 -- Commit granularity (locked by D-01 implication)

Five commits: one per locale (`feat(265-NN-{locale}): translator fill -- {locale_name} target XLIFF`). Then one commit for the `i18nMissingTranslation` policy flip. Then one SUMMARY commit. Total: 7 commits for Phase 265 (matching execute-plan's preference for atomic increments).

### D-13 -- Plan count

One plan with sequential tasks (not parallel waves), since each locale's output is large and we want serialized review per locale. Task structure:

- Task 1: fill messages.es.xlf
- Task 2: fill messages.de.xlf
- Task 3: fill messages.ja.xlf
- Task 4: fill messages.zh-CN.xlf
- Task 5: fill messages.zh-TW.xlf
- Task 6: flip `i18nMissingTranslation` to `error` in `angular.json`

## Deferred Ideas

- **Translation memory / glossary tooling** -- a real i18n shop would use a TM database (Crowdin, Lokalise, etc.) to keep translations consistent across releases. Out of scope; this is a one-time fill. Future re-extractions get appended to the source and re-translated only for the new IDs.
- **Native-speaker review** -- the AI translations are not professionally reviewed. Acceptable risk for a marketing site (no contractual translations, no legal copy translated). If user-facing copy ever grows to contractual scope, route through a human translator.
- **Pluralization variants beyond default ICU** -- Russian, Arabic, etc. would require complex plural rules. None of the 5 target locales need more than `one/other` plurals (de, es) or no distinction (ja, zh-*).
- **Locale-specific brand variants** -- `Claude` stays `Claude` everywhere; no transliteration. Phase 263+ markets are romaji/pinyin-tolerant audiences.

## Specific Ideas Captured

- Brand/CLI tokens already structurally protected via XLIFF `<x>` placeholders.
- Tone registers locked per locale (D-03).
- Single inline session does the work (D-01).
- Final commit flips the build policy (D-08).
