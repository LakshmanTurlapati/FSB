# FSB Showcase

The marketing site at [full-selfbrowsing.com](https://full-selfbrowsing.com).

## Layout

| Path | Purpose |
|------|---------|
| `angular/` | Angular 19 site with SSR and prerender for `/`, `/about`, `/privacy`, `/support`. |
| `server/` | Express + better-sqlite3 + ws deploy backend (handles dashboard pairing + relay). |
| `assets/` | Static images, logos, screenshots referenced by the prerendered HTML. |
| `css/`, `js/`, `*.html` | Legacy static surfaces still served alongside the Angular app (privacy, about, dashboard). |
| `dist/` | Build output (gitignored). Populated by `angular/` build. |

## Develop

```bash
cd angular
npm install
npm start
```

The dev server runs at `http://localhost:4200` with hot reload.

## Build

```bash
npm --prefix angular run build
```

Runs Angular's SSR + prerender pipeline for the static routes. Output lands in `angular/dist/`.

The `prebuild` lifecycle hook also runs `angular/scripts/build-crawler-files.mjs`, which generates the SEO/GEO surfaces:

- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`
- `/llms-full.txt`

`Organization` and `SoftwareApplication` JSON-LD blocks are baked into every prerendered HTML page. See `.planning/milestones/v0.9.46-ROADMAP.md` for the SEO/GEO milestone history.

## Deploy

Production runs on fly.io. The repo root `fly.toml` and `Dockerfile` build a container that serves `showcase/server/server.js` (Express + WebSocket relay).

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `flyctl deploy --remote-only`. No manual steps required.

## Smoke Test

After deploy, hit production with a crawler user agent to confirm prerender + JSON-LD survived:

```bash
curl -A GPTBot -sI https://full-selfbrowsing.com/ | head -1
curl -A GPTBot -s  https://full-selfbrowsing.com/llms.txt | head -5
```

The npm helper `npm --prefix angular run smoke:crawler` runs the full crawler smoke matrix used in the v0.9.46 UAT.

## Repository Layout

See the root [`README.md`](../README.md) for the full repo overview, including the Chrome extension (`extension/`) and MCP server (`mcp/`).
