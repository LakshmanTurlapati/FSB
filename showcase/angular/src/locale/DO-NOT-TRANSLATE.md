# Do Not Translate -- showcase/angular i18n

This list is the authoritative source of terms that MUST NOT be translated when
preparing the per-locale XLIFF targets in Phase 265 (messages.es.xlf, .de.xlf,
.ja.xlf, .zh-CN.xlf, .zh-TW.xlf). When any of these appear inside a translatable
string, they are wrapped in `<span translate="no">...</span>` in the source HTML
so the XLIFF extractor preserves them as `<ph>` placeholders the translator must
keep verbatim.

**Phase 262 marking discipline:** brand names inside prose are wrapped inline;
code identifiers and CLI commands inside `<code>` are protected by `translate="no"`
on the `<code>` element itself. The default Angular i18n extractor preserves
`<ph>` placeholders for both forms.

**Lint-rule note (Plan 262-01 deviation, carries forward):** the project's
`@angular-eslint/template/i18n` rule runs with `checkAttributes: true` and flags
the static literal `translate="no"` on translatable elements as a missing
`i18n-translate` attribute (no such i18n semantic exists). Source HTML therefore
uses the equivalent property-binding form `[attr.translate]="'no'"` whenever the
translate attribute sits on an element that also carries an `i18n` marker. The
rendered DOM attribute is identical (`translate="no"`), the Phase 265 AI
translator hooks the rendered attribute, and the W3C semantics are preserved.
For plain wrapper spans whose only role is to opt out of translation (no `i18n`
attribute on the same element), the static form `<span translate="no">...</span>`
remains correct and is preferred.

## Brand and product names (alphabetized)

- Anthropic
- Brave
- BSL 1.1
- Chrome
- Chromium
- ClawHub
- Claude
- Claude Code
- Claude Desktop
- Claude Haiku 4.5
- Claude Opus 4.1
- Claude Opus 4.7
- Claude Routines
- Claude Sonnet 4.5
- Codex
- Codex MCP
- Computer Use
- Cursor
- Edge
- Firefox
- FSB
- Full Self-Browsing
- fsb-mcp-server
- Gemini
- GitHub
- Google
- Google Gemini
- Grok
- Grok 4.1
- Grok 4.1 Fast
- Grok Code Fast
- Issues
- Lakshman Turlapati
- LM Studio
- MCP
- MCP server
- npm
- npx
- OpenAI
- OpenClaw
- OpenCode
- OpenRouter
- Opera
- Operator
- Project Mariner
- Safari
- Vivaldi
- Antigravity
- xAI

## Code, CLI, and configuration identifiers

- All `<code>` element contents (CLI commands, config keys, file paths, URLs).
- `active-tab`, `bridge`, `config`, `content-script`, `extension`, `package` (Doctor layers).
- `AES-GCM`
- `chrome.storage.local`
- `chrome://extensions`
- Action API names in `pages/about/about-page.component.html` Action Library
  (~50 identifiers including `navigate`, `click`, `type`, `cdpMouseClick`,
  `getDomTree`, `waitForElement`, etc.).
- File paths, absolute URLs, npm package names.

## Inline-wrapping convention

When any term above appears inside a translatable sentence in source HTML,
wrap it inline:

```html
<p i18n="@@home.intro.body">
  Use <span translate="no">FSB</span> with <span translate="no">Claude Code</span>
  to drive a real browser.
</p>
```

When a whole element is brand-only AND carries an `i18n` marker, use the binding
form so the i18n lint rule does not flag a missing `i18n-translate` companion:

```html
<span i18n="@@shell.brand.text" [attr.translate]="'no'">FSB</span>
```

When a whole element is brand-only with NO i18n marker (a plain wrapper), the
static form is preferred:

```html
<span translate="no">FSB</span>
```

When a `<code>` element wraps a CLI command, mark `translate="no"` directly on
the `<code>` element:

```html
<pre><code translate="no">npx -y fsb-mcp-server install --claude-code</code></pre>
```

## How this file is used

- Phase 262 (this milestone): authors mark source HTML using these conventions
  so `ng extract-i18n` produces `<ph>` placeholders the translator cannot rewrite.
- Phase 265 (next milestone): the AI translation prompt receives this file as
  context; the translator output is gated on a CI invariant that confirms every
  target XLIFF preserves source `<ph>` placeholders byte-equal to the source.

## Maintenance

- New product or competitor names: add alphabetically.
- New code identifiers: keep wrapped in `<code translate="no">` in source HTML;
  no need to enumerate individual identifiers in this file unless ambiguous.
- File is reviewed at each milestone audit.
