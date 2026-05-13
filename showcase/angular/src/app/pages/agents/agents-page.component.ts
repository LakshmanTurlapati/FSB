import { Component, OnInit, Renderer2, inject, DOCUMENT, LOCALE_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

import { HOST, buildLocaleUrl, emitLocaleHead } from '../../core/seo/locale-seo';

const ROUTE_PATH = '/agents';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const OG_IMAGE_ALT = 'FSB Full Self-Browsing logo';
const SITE_NAME = 'FSB - Full Self-Browsing';

@Component({
  selector: 'app-agents-page',
  standalone: true,
  templateUrl: './agents-page.component.html',
  styleUrl: './agents-page.component.scss',
})
export class AgentsPageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);

  ngOnInit(): void {
    const url = buildLocaleUrl(this.localeId, ROUTE_PATH);
    // Marked via $localize so per-locale builds emit translated strings; embedded brand
    // tokens (FSB, OpenClaw, Claude, Codex, Cursor, MCP, Chrome) are preserved verbatim
    // by translators per showcase/angular/src/locale/DO-NOT-TRANSLATE.md.
    const t = $localize`:@@agents.meta.title:FSB - Agents (OpenClaw Skill + MCP)`;
    const d = $localize`:@@agents.meta.description:Drive your real Chrome from OpenClaw, Claude, Codex, Cursor, and more. Install the FSB OpenClaw skill in 3 steps and use 50+ MCP tools to act, observe, verify.`;
    this.applyMeta(t, d, url);
    this.injectAgentsPageJsonLd();
    this.injectInstallHowToJsonLd();
  }

  private applyMeta(t: string, d: string, url: string): void {
    this.title.setTitle(t);
    this.meta.updateTag({ name: 'description', content: d });
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE });
    this.meta.updateTag({ property: 'og:image:width', content: '1000' });
    this.meta.updateTag({ property: 'og:image:height', content: '1000' });
    this.meta.updateTag({ property: 'og:image:alt', content: OG_IMAGE_ALT });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: d });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE });
    this.meta.updateTag({ name: 'twitter:image:alt', content: OG_IMAGE_ALT });
    emitLocaleHead(this.renderer, this.doc, this.localeId, ROUTE_PATH);
  }

  private injectAgentsPageJsonLd(): void {
    if (this.doc.head.querySelector('script[data-ld="agents-page"]')) {
      return;
    }
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${HOST}/agents#fsb-skill`,
      name: 'FSB OpenClaw Skill',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Linux, Windows (via Node 18+)',
      url: `${HOST}/agents`,
      description: 'Canonical OpenClaw onboarding path for FSB. Doctor flow, stdio config printer, and consent-gated multi-host installer for the FSB MCP server.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${HOST}/#org` },
      isPartOf: { '@id': `${HOST}/#site` },
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'data-ld', 'agents-page');
    const text = this.renderer.createText(json);
    this.renderer.appendChild(script, text);
    this.renderer.appendChild(this.doc.head, script);
  }

  private injectInstallHowToJsonLd(): void {
    if (this.doc.head.querySelector('script[data-ld="agents-howto"]')) {
      return;
    }
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      '@id': `${HOST}/agents#install-howto`,
      name: 'Install FSB for OpenClaw and MCP clients',
      description: 'Three-step install: Chrome extension, FSB MCP server config, doctor verification.',
      totalTime: 'PT5M',
      url: `${HOST}/agents`,
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Install the FSB Chrome extension',
          text: 'Primary path: paste the Chrome Web Store URL into Chrome\u2019s address bar (chromewebstore.google.com/detail/badgafnfchcihdfnjneklogedcdkmjfk). Fallback: download the latest .zip from GitHub Releases and load unpacked at chrome://extensions with Developer mode on.',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Install the FSB MCP server config',
          text: 'Print the canonical OpenClaw stdio block with `node scripts/print-stdio.mjs` and paste it into your MCP host config. Or use the FSB CLI: `npx -y fsb-mcp-server install --list` to discover supported hosts, then `npx -y fsb-mcp-server install --claude-desktop` (or your host).',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Verify with the doctor',
          text: 'Run the six-layer diagnostic: `node scripts/doctor.mjs`. Expect [OK] on every layer. If any layer fails, the doctor prints a one-line next step; the full recovery table is in USAGE.md inside the skill.',
        },
      ],
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'data-ld', 'agents-howto');
    const text = this.renderer.createText(json);
    this.renderer.appendChild(script, text);
    this.renderer.appendChild(this.doc.head, script);
  }
}
