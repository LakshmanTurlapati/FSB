---
phase: 140
slug: shared-surface-audit-design-corrections
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-02
---

# Phase 140 — UI Design Contract

> Visual and interaction contract for the shared-surface retouch baseline. This phase normalizes existing FSB primitives; it does not redesign the product.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (existing vanilla HTML/CSS/JS surfaces) |
| Icon library | Font Awesome 6.6.0, plus existing dashboard icon usage |
| Font | System sans-serif: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |
| Mono font | 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace |

---

## Spacing Scale

Declared values (must stay on the existing dense 4px grid):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon spacing, compact chip padding |
| sm | 8px | compact control gaps, inline actions |
| md | 12px | dense card internals, compact rows |
| lg | 16px | default control padding, message padding |
| xl | 24px | section/card padding, header spacing |
| 2xl | 32px | major surface gaps |
| 3xl | 48px | page-level section breaks |

Exceptions: 20px and 44px remain valid for touch-target heights and circular action buttons.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px-16px | 400 | 1.45-1.6 |
| Label | 11px-12px | 600 | 1.2-1.35 |
| Heading | 16px-20px | 600-700 | 1.15-1.25 |
| Display | 24px-32px | 700 | 1.05-1.15 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | neutral white / charcoal surfaces already used by FSB | page and panel backgrounds |
| Secondary (30%) | soft elevated neutral surfaces | cards, header controls, input backgrounds |
| Accent (10%) | `#ff6b35` with warmer hover/soft states | primary actions, focus rings, active pills, selected surfaces, progress emphasis |
| Destructive | `#dc2626` to `#ef4444` range | delete, error, destructive confirmations only |

Accent reserved for: primary CTA fills, selected/active state emphasis, focus rings, progress/highlight signals, and status accents that already use FSB orange.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | action-first, concise, existing product wording retained |
| Empty state heading | neutral and direct; do not introduce marketing copy |
| Empty state body | explain next action in one sentence |
| Error state | describe problem and the immediate recovery path |
| Destructive confirmation | explicit action name + consequence |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-02
