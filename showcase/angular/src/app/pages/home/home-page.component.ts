import { Component, OnInit, Renderer2, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const HOST = 'https://full-selfbrowsing.com';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const SITE_NAME = 'FSB \u2014 Full Self-Browsing';

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
    const d = 'Open-source Chrome extension that automates the browser through natural language. Multi-model AI (xAI, OpenAI, Anthropic, Gemini, local), 50+ actions, 142+ site guides.';
    this.applyMeta(t, d, url);
    // TODO(plan-03): inject SoftwareApplication JSON-LD per LD-02
  }

  private applyMeta(t: string, d: string, url: string): void {
    this.title.setTitle(t);
    this.meta.updateTag({ name: 'description', content: d });
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: d });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE });
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
}
