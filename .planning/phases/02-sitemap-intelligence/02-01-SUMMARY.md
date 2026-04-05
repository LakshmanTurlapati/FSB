# Plan 2-01 Summary: Pre-bundled Site Maps + Local Converter (Tier 1)

**Status:** Completed
**Duration:** ~5 min
**Date:** 2026-02-18

## What Was Done

1. **Extended memory schema** (`lib/memory/memory-schemas.js`):
   - Added `createSiteMapMemory(domain, sitePattern, metadata)` factory function
   - Wraps `createSemanticMemory()` with category `'site_map'` and sitePattern in typeData
   - Confidence: 0.95 for refined maps, 0.8 for unrefined
   - Exported via `self.createSiteMapMemory`

2. **Built local site map converter** (`lib/memory/sitemap-converter.js` -- NEW):
   - `convertToSiteMap(research)` transforms Site Explorer research data into structured sitePattern
   - Extracts pages (keyed by pathname), navigation (deduplicated), forms, and key selectors
   - Sets `source: 'recon'`, `refined: false`, empty `workflows` and `tips` (for Tier 2)
   - Exported via `self.convertToSiteMap`

3. **Created pre-bundled site map directory** (`site-maps/` -- NEW):
   - `site-maps/_template.json` with the expected format
   - Added `site-maps/*.json` to `manifest.json` `web_accessible_resources`

4. **Added "Save to Memory" button on research results** (`ui/options.js`):
   - Brain icon button in research list items (alongside View/Download/Delete)
   - Event delegation handler routes `saveMemory` action to `saveResearchToMemory()`
   - Function: fetches research data, converts via `convertToSiteMap`, saves via `memoryStorage.add()`
   - Visual feedback: button changes to checkmark on success, shows toast

5. **Wired script loading** (`ui/options.html`):
   - Added `<script src="../lib/memory/sitemap-converter.js"></script>` before memory-storage.js

6. **Added CSS** (`ui/options.css`):
   - Hover style for `.save-memory` button
   - `.saved` state style (green checkmark, reduced opacity)

## Files Changed
- `lib/memory/memory-schemas.js` -- added createSiteMapMemory function + export
- `lib/memory/sitemap-converter.js` -- NEW, convertToSiteMap function
- `site-maps/_template.json` -- NEW, template for bundled site maps
- `manifest.json` -- added site-maps/*.json to web_accessible_resources
- `ui/options.js` -- Save to Memory button, event handler, saveResearchToMemory function
- `ui/options.html` -- script tag for sitemap-converter.js
- `ui/options.css` -- save-memory and saved button styles

## Verification
- `createSiteMapMemory` defined and exported in memory-schemas.js
- `convertToSiteMap` defined and exported in sitemap-converter.js
- Script loaded in options.html before memory-storage.js
- Event delegation wired for saveMemory action
- manifest.json valid JSON with site-maps resources
- All JS files pass syntax check
