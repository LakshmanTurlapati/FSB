import { Component, OnInit, Renderer2, inject, DOCUMENT } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';


const HOST = 'https://full-selfbrowsing.com';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const SITE_NAME = 'FSB \u2014 Full Self-Browsing';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
})
export class PrivacyPageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);

  ngOnInit(): void {
    const url = `${HOST}/privacy`;
    const t = 'FSB \u2014 Privacy';
    const d = 'How FSB handles your data: API keys encrypted in Chrome local storage, no telemetry, automation runs locally in your browser. BYO key, BYO browser.';
    this.applyMeta(t, d, url);
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
