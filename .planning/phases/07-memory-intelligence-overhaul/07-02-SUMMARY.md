---
phase: "07"
plan: "02"
subsystem: "memory-intelligence"
tags: ["cross-site", "pattern-analysis", "sitemap", "heuristics", "consolidation"]
dependency-graph:
  requires: ["07-01"]
  provides: ["cross-site-pattern-analysis", "consolidation-enrichment"]
  affects: ["07-03", "07-04", "07-07"]
tech-stack:
  added: []
  patterns: ["domain-grouping", "intersection-analysis", "typeof-guard-pattern"]
key-files:
  created:
    - "lib/memory/cross-site-patterns.js"
  modified:
    - "lib/memory/memory-manager.js"
decisions:
  - id: "07-02-01"
    decision: "Pure heuristic analysis with no AI calls for cross-site patterns"
    rationale: "Avoids API costs during consolidation; pattern classification uses keyword matching"
  - id: "07-02-02"
    decision: "typeof guard for analyzeCrossSitePatterns in consolidate()"
    rationale: "Module may not be loaded yet; degrades gracefully without breaking consolidation"
  - id: "07-02-03"
    decision: "Update existing cross-site pattern memory instead of creating new one"
    rationale: "Prevents duplicate accumulation on repeated consolidations"
metrics:
  duration: "1.9 min"
  completed: "2026-02-21"
---

# Phase 7 Plan 2: Cross-Site Pattern Analysis Summary

Cross-site heuristic module groups sitemaps by domain, extracts form/nav/selector/page patterns, finds intersection across 2+ domains, and stores results as a semantic memory during consolidation.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create cross-site-patterns.js module | 42f4bed | New module with analyzeCrossSitePatterns, groupSitemapsByDomain, extractDomainPatterns |
| 2 | Wire cross-site analysis into consolidate() | 946fd04 | MemoryManager.consolidate() runs pattern analysis after standard cleanup |

## Decisions Made

1. **Pure heuristic analysis** -- No AI calls in cross-site-patterns.js. Form classification uses keyword matching (password->login, search->search, etc.). Selector strategies identified by pattern (data-testid, aria-label, role attributes). Page types classified by path and title keywords.

2. **typeof guard pattern** -- `typeof analyzeCrossSitePatterns === 'function'` check in consolidate() ensures the feature degrades gracefully if cross-site-patterns.js is not loaded in the service worker yet (integration wiring is deferred to plan 07-07).

3. **Upsert pattern for pattern memory** -- On re-consolidation, existing cross_site_pattern memory is updated rather than creating a duplicate. Found via `allMemories.find(m => m.typeData.category === 'cross_site_pattern')`.

## Deviations from Plan

None -- plan executed exactly as written.

## Key Implementation Details

### cross-site-patterns.js Architecture

- **analyzeCrossSitePatterns(allMemories)**: Filters site_map memories, groups by domain, extracts patterns per domain, finds intersection, creates semantic memory
- **groupSitemapsByDomain(sitemapMemories)**: Groups by `metadata.domain` field
- **extractDomainPatterns(sitemapMemory)**: Returns `{ formTypes, navPatterns, selectorPatterns, pageTypes }`
- **Internal helpers**: classifyForms, classifyNavigation, classifySelectorStrategies, classifyPages, findCommonItems

### Pattern Categories Detected

| Category | Examples |
|----------|----------|
| Form types | login, registration, search, contact, newsletter, checkout |
| Nav patterns | rich/standard/minimal-navigation, has-home-link, has-settings, has-auth-links |
| Selector strategies | uses-data-testid, uses-aria-attributes, uses-role-attributes, uses-id-selectors |
| Page types | landing-page, auth-page, list-page, detail-page, dashboard-page, form-page |

### Memory Output Format

```javascript
{
  type: 'semantic',
  text: 'Cross-site patterns: N domains analyzed, M common patterns found',
  metadata: { domain: null, tags: ['cross-site', 'patterns', 'auto-generated'], confidence: 0.7 },
  typeData: {
    category: 'cross_site_pattern',
    sitePattern: {
      domains: ['example.com', 'other.com'],
      commonFormTypes: ['login', 'search'],
      sharedSelectorPatterns: ['uses-data-testid'],
      commonNavPatterns: ['standard-navigation'],
      commonWorkflows: ['list-page', 'detail-page'],
      analyzedAt: 1708500000000
    }
  }
}
```

## Next Phase Readiness

Plan 07-03 (Memory detail viewers) can proceed independently. Plan 07-07 (integration) will wire cross-site-patterns.js into manifest.json and options.html script tags.

## Self-Check: PASSED
