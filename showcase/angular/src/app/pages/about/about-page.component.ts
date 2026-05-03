import { Component, OnInit, Renderer2, inject, DOCUMENT } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

const HOST = 'https://full-selfbrowsing.com';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const OG_IMAGE_ALT = 'FSB Full Self-Browsing logo';
const SITE_NAME = 'FSB \u2014 Full Self-Browsing';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@parzival5707';

const DEMO_VIDEOS = [
  {
    id: '_iQ4_LSXcTU',
    name: 'FSB: E-Commerce Autopilot by Grok 4.1',
    alternateName: 'FSB Test 2',
    description: 'FSB drives a shopping workflow from instruction to browser actions, showing the practical side of full self-browsing.',
    uploadDate: '2026-05-03T05:31:01-07:00',
  },
  {
    id: 'WbpOrFwgGME',
    name: 'Flight Booking: Powered by Codex MCP',
    alternateName: 'FSB Flight Booking',
    description: 'Codex uses FSB through MCP as the browser layer, turning coding-agent reasoning into real page interaction.',
    uploadDate: '2026-05-03T05:57:48-07:00',
  },
  {
    id: 'PNTGCWGopf8',
    name: 'OpenClaw Monitoring Doge Price',
    alternateName: 'FSB OpenClaw',
    description: 'OpenClaw can provide the agent loop while FSB supplies the live browser control surface for real-world monitoring tasks.',
    uploadDate: '2026-05-03T05:56:22-07:00',
  },
  {
    id: 'mD9oGB2JqVM',
    name: 'An Aha Moment by Claude Opus 4.7',
    alternateName: 'FSB Test #1',
    description: "Claude pairs reasoning with FSB's browser execution so the agent can learn from the page and keep iterating.",
    uploadDate: '2026-05-02T23:10:58-07:00',
  },
] as const;

@Component({
  selector: 'app-about-page',
  standalone: true,
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.scss',
})
export class AboutPageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);

  ngOnInit(): void {
    const url = `${HOST}/about`;
    const t = 'FSB \u2014 About';
    const d = 'Watch real FSB demos: Grok 4.1 e-commerce autopilot, Codex MCP flight booking, OpenClaw monitoring, and Claude-powered browser iteration.';
    this.applyMeta(t, d, url);
    this.injectDemoVideoJsonLd();
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

  private injectDemoVideoJsonLd(): void {
    if (this.doc.head.querySelector('script[data-ld="about-demo-videos"]')) {
      return;
    }
    const payload = {
      '@context': 'https://schema.org',
      '@graph': DEMO_VIDEOS.map((video) => ({
        '@type': 'VideoObject',
        '@id': `${HOST}/about#demo-${video.id}`,
        name: video.name,
        alternateName: video.alternateName,
        description: video.description,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        embedUrl: `https://www.youtube.com/embed/${video.id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        uploadDate: video.uploadDate,
        publisher: { '@id': `${HOST}/#org` },
        author: {
          '@type': 'Person',
          name: 'Parzival',
          url: YOUTUBE_CHANNEL,
        },
      })),
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'data-ld', 'about-demo-videos');
    const text = this.renderer.createText(json);
    this.renderer.appendChild(script, text);
    this.renderer.appendChild(this.doc.head, script);
  }
}
