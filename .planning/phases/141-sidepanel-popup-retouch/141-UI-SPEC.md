---
phase: 141
slug: sidepanel-popup-retouch
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-02
---

# Phase 141 — UI Design Contract

> Visual and interaction contract for the sidepanel and popup retouch phase. This phase refines hierarchy and state clarity on the operator-facing chat surfaces without redesigning them.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (existing vanilla HTML/CSS/JS surfaces) |
| Icon library | Font Awesome 6.6.0 |
| Font | System sans-serif: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |
| Mono font | 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace |

---

## Spacing Scale

Declared values (stay on the dense existing 4px grid):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon gaps, compact inline spacing |
| sm | 8px | chip padding, compact button gaps |
| md | 12px | compact surface padding, message metadata |
| lg | 16px | default header and composer internals |
| xl | 20px | popup shell padding and compact panel spacing |
| 2xl | 24px | sidepanel header/composer spacing and section gaps |
| 3xl | 32px | major separation between dense surface blocks |

Exceptions: 36px and 44px remain valid for circular action targets and minimum touch-friendly controls.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.45-1.55 |
| Label | 11px-12px | 600 | 1.2-1.35 |
| Heading | 16px | 600-700 | 1.15-1.25 |
| Display | not used in this phase | n/a | n/a |

Surface label copy should be lighter and smaller than the product title. Footer metadata should remain tertiary, never compete with task content.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | shared FSB neutral surfaces from `shared/fsb-ui-core.css` | page and panel backgrounds |
| Secondary (30%) | elevated warm-neutral surfaces | header chrome, message rails, composer shells, history cards |
| Accent (10%) | `#ff6b35` and its shared soft/hover states | send CTA, active/pinned state emphasis, busy-state chrome, focus ring |
| Destructive | shared FSB destructive reds | stop, delete, and error states only |

Accent reserved for: send button, active state signals, pinned state emphasis, busy status chrome, and focused composer surfaces. Do not flood the entire header or footer with accent color.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Surface label | short, functional, non-marketing (`Side Panel`, `Quick Panel`) |
| Surface subtitle | one short descriptor for role clarity (`Persistent workspace`, `Fast task launch`) |
| Empty state heading | none added in this phase |
| Error state | existing direct FSB copy remains |
| Destructive confirmation | existing direct FSB copy remains |

Do not introduce promotional or playful copy. Keep the chat surfaces operational.

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
