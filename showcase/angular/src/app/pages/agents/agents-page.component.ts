import { Component, OnInit, Renderer2, inject, DOCUMENT } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

const HOST = 'https://full-selfbrowsing.com';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const OG_IMAGE_ALT = 'FSB Full Self-Browsing logo';
const SITE_NAME = 'FSB \u2014 Full Self-Browsing';

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

  ngOnInit(): void {
    const url = `${HOST}/agents`;
    const t = 'FSB \u2014 Agents (OpenClaw Skill + MCP)';
    const d = 'Drive your real Chrome from OpenClaw, Claude, Codex, Cursor, and more. Install the FSB OpenClaw skill in 3 steps and use 50+ MCP tools to act, observe, verify.';
    this.applyMeta(t, d, url);
    this.injectAgentsPageJsonLd();
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
    this.upsertCanonical(url);
  }

  private upsertCanonical(href: string): void {
    let link = this.doc.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.renderer.createElement('link') as HTMLLinkElement;
      this.renderer.setAttribute(link, 'rel', 'canonical');
      this.renderer.appendChild(this.doc.head, link);
    }
    this.renderer.setAttribute(link, 'href', href);
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
}
