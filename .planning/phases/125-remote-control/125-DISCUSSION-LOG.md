# Phase 125: Remote Control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 125-remote-control
**Areas discussed:** Click forwarding, Text input forwarding, Scroll forwarding, Interaction mode toggle

---

## Click Forwarding

| Option | Description | Selected |
|--------|-------------|----------|
| CDP dispatch (Recommended) | Use Input.dispatchMouseEvent via existing cdpClickAt. Reverse-scale coordinates. | Y |
| Content script dispatch | Find element at point, call element.click(). Simpler but less reliable. | |
| Hybrid | Try CDP first, fall back to content script. | |

**User's choice:** CDP dispatch
**Notes:** Most reliable, works on any element regardless of page JS.

---

## Text Input Forwarding

| Option | Description | Selected |
|--------|-------------|----------|
| CDP key events (Recommended) | Forward keydown/keyup as CDP Input.dispatchKeyEvent. | Y |
| Content script value set | Set input.value + dispatch input event. | |
| Focused element + CDP | Click first to focus, then forward keystrokes. | |

**User's choice:** CDP key events
**Notes:** Works regardless of which element is focused. User clicks first to focus.

---

## Scroll Forwarding

| Option | Description | Selected |
|--------|-------------|----------|
| Wheel events via CDP (Recommended) | Forward wheel events as CDP mouseWheel with deltaX/deltaY. | Y |
| Scroll position sync | Send absolute scrollTop/scrollLeft, content script does scrollTo. | |
| CDP + position fallback | Try CDP wheel first, fall back to scrollTo. | |

**User's choice:** Wheel events via CDP
**Notes:** Native browser scroll behavior preserved.

---

## Interaction Mode Toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle button (Recommended) | "Remote Control" button in preview header. ON: interactive, OFF: view-only. | Y |
| Always interactive | Remove pointer-events:none permanently. | |
| Hold-to-interact | Hold modifier key to temporarily enable. | |

**User's choice:** Toggle button
**Notes:** Alongside maximize/PiP buttons. Cursor changes to crosshair when active.

---

## Claude's Discretion

- Cursor indicator on preview
- Scroll debounce interval
- Modifier key forwarding
- Visual feedback for active mode
- Right-click / double-click forwarding

## Deferred Ideas

- Touch event forwarding -- future
- Drag and drop forwarding -- complex, future
- File input forwarding -- separate mechanism
- Multi-cursor collaboration -- future
