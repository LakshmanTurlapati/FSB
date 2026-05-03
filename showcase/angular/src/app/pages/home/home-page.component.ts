import { Component, OnInit, Renderer2, inject, DOCUMENT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

import { APP_VERSION } from '../../core/seo/version';

const HOST = 'https://full-selfbrowsing.com';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const OG_IMAGE_ALT = 'FSB Full Self-Browsing logo';
const SITE_NAME = 'FSB \u2014 Full Self-Browsing';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@parzival5707';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);

  ngOnInit(): void {
    const url = HOST; // home canonical: 'https://full-selfbrowsing.com' (no trailing slash, per D-02)
    const t = 'FSB \u2014 Full Self-Browsing';
    const d = 'Open-source Chrome extension for AI-powered browser automation through natural language, with an MCP server for Claude Code, Codex, Cursor, and other agents.';
    this.applyMeta(t, d, url);
    this.injectSoftwareApplicationJsonLd();
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

  /**
   * Inject SoftwareApplication JSON-LD on the home route only (LD-02, D-13..D-17).
   * publisher.@id cross-references the Organization block in src/index.html (LD-01).
   * Escape rule per PITFALLS.md P4 + T-LD-01: JSON.stringify(...).replace(/</g, '\\u003c')
   * defeats </script> injection by escaping every '<' literal as the JSON Unicode escape \u003c.
   * Idempotent: data-ld attribute prevents double-injection on route revisits.
   */
  private injectSoftwareApplicationJsonLd(): void {
    if (this.doc.head.querySelector('script[data-ld="software-application"]')) {
      return;
    }
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'FSB',
      description: 'Open-source MCP browser automation layer that lets AI agents act, observe, verify, and iterate in a real Chrome browser',
      url: 'https://full-selfbrowsing.com',
      applicationCategory: 'BrowserApplication',
      applicationSubCategory: 'AI browser automation and MCP tools',
      operatingSystem: 'Chrome',
      softwareVersion: APP_VERSION,
      downloadUrl: 'https://github.com/lakshmanturlapati/FSB',
      sameAs: ['https://github.com/lakshmanturlapati/FSB', YOUTUBE_CHANNEL],
      featureList: [
        'MCP server for Claude Code, Codex, Cursor, Windsurf, and OpenClaw',
        'Real browser automation through a local Chrome extension',
        'Autonomous app testing loop with observation and verification',
        'DOM-based page understanding, browser actions, visual feedback, and local memory',
      ],
      keywords: 'MCP browser automation, AI browser agent, Claude Code browser testing, Codex browser testing, self-browsing automation',
      publisher: { '@id': 'https://full-selfbrowsing.com/#org' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };
    // T-LD-01 mitigation: escape '<' as '\u003c' to defeat </script> injection (PITFALLS.md P4).
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'data-ld', 'software-application');
    const text = this.renderer.createText(json);
    this.renderer.appendChild(script, text);
    this.renderer.appendChild(this.doc.head, script);
  }
}
