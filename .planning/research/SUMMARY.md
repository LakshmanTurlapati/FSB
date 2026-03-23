# Project Research Summary

**Project:** FSB v0.9.9 — Excalidraw Mastery Milestone
**Domain:** Canvas-based diagramming automation via Chrome Extension (CDP)
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

FSB v0.9.9 targets full Excalidraw drawing mastery using only the tools already in the FSB codebase — zero new dependencies. The milestone is not a tooling problem; it is an intelligence augmentation problem. All necessary CDP primitives (`press_key`, `cdpDrag`, `cdpInsertText`, `cdpClickAt`) exist and are proven. The scope of work is: (1) fixing two broken code paths in the existing FSB engine, (2) massively expanding the Excalidraw site guide with complete keyboard shortcut maps, text entry workflows, styling selectors, and layout conventions, and (3) building toward natural language diagram generation as the capstone deliverable.

The critical technical discovery is that Excalidraw's text editor is a standard `<textarea>` (class `excalidraw-wysiwyg`) created transiently by React — not a contenteditable div. FSB's `type` tool cannot reach it, but `cdpInsertText` (using `Input.insertText` CDP command) works directly because the textarea auto-focuses when created. The entire text entry problem reduces to a focus-and-wait sequence. The second critical finding is that Excalidraw renders shapes on `<canvas>`, making DOM-based progress detection completely blind to drawing activity. FSB will abort tasks after 6 "no progress" iterations unless `isCanvasEditorUrl()` is extended to include `excalidraw.com` — a one-line regex fix.

The main risk is sequencing, not capability. Two hard-blocking code fixes (canvas editor progress detection, `isCanvasBasedEditor()` expansion) must land in Phase 1 before any multi-step automation is viable. Without them the automation loop breaks regardless of how well the site guide is written. Coordinate precision is a second risk: zoom level and canvas pan shift all CDP coordinates, so every session must reset zoom and pan before drawing. With those two blockers resolved and a solid site guide in place, the path to natural language diagram generation is straightforward and well-defined.

## Key Findings

### Recommended Stack

No new technologies are required. FSB v0.9.9 is a zero-dependency milestone. All interaction with Excalidraw flows through existing CDP tools: keyboard shortcuts via `press_key`, shape drawing via `cdpDrag`, text insertion via `cdpInsertText`, point clicks via `cdpClickAt`, and DOM state checks via `getAttribute`/`getText`. The project constraint of vanilla JS with no build system is fully preserved.

The guiding principle from research is keyboard-first, DOM-fallback: Excalidraw has comprehensive keyboard shortcuts for nearly every operation. Dispatching shortcuts via `press_key` is faster, more reliable, and version-stable compared to targeting React-generated DOM selectors that change across Excalidraw releases.

**Core technologies:**
- `press_key` (keyboard emulator): Tool selection (R, D, O, A, L, P, T, F, E) and all canvas operations — primary interaction method, version-stable
- `cdpDrag`: Shape drawing and multi-element rubber-band selection — proven in existing codebase
- `cdpInsertText` (CDP `Input.insertText`): Excalidraw text entry into auto-focused transient textarea — works focus-based, no selector needed
- `cdpClickAt`: Canvas point interactions, toolbar/menu clicks at coordinates
- `waitForDOMStable`: Wait for React re-renders after Excalidraw state mutations
- `getAttribute`/`getText`: DOM state verification (textarea presence, toolbar active state, dialog state)

**No additions required:** No npm packages, no Chrome APIs, no new tools to build.

### Expected Features

All table-stakes features are achievable with existing tools. The feature dependency chain is strict: text entry must work before shape labels work; shapes must work before connectors work; all primitives must work before natural language generation is viable.

**Must have (table stakes):**
- Draw rectangles, ellipses, diamonds — `press_key` + `cdpDrag`
- Draw arrows and lines with shape binding — `press_key A` + edge-to-edge `cdpDrag`
- Add text labels to shapes — text mode activation + `cdpInsertText` on transient textarea
- Select, move, delete elements — selection tool + `cdpDrag`
- Undo/redo — `Ctrl+Z` / `Ctrl+Y`
- Change stroke and background colors — `S`/`G` shortcuts + DOM click on color swatches
- Export as PNG — `Shift+Alt+C` (clipboard, zero DOM interaction needed)
- Multi-select and align — `Ctrl+A` or rubber-band drag, then `Ctrl+Shift+Arrow` shortcuts

**Should have (differentiators):**
- Connected arrows with auto-routing and binding to shape edges
- Elbow (orthogonal) arrow routing for professional diagram appearance
- Style copy/paste (`Ctrl+Alt+C` / `Ctrl+Alt+V`) for consistent visual language
- Group/ungroup (`Ctrl+G` / `Ctrl+Shift+G`)
- Distribute elements evenly (alignment panel buttons after multi-select)
- Natural language diagram generation — "draw a flowchart for user login" produces a complete, labeled, connected diagram

**Defer (v2+):**
- Custom library shapes (complex multi-step import workflow)
- Image insertion (file picker complexity)
- Mermaid/PlantUML import (direct shape generation is simpler)
- Excalidraw+ paid features (authentication-gated)
- Pixel-perfect layout (AI coordinates are approximate by nature)
- Screenshot verification (no pipeline exists; action counting suffices)

### Architecture Approach

No new architectural components are needed. The work lives entirely within two areas: the `site-guides/design/excalidraw.js` file (major expansion) and two targeted bug fixes in `background.js` and `content/messaging.js`. The existing data flow — user prompt to AI to CLI command emission to CDP tool dispatch — remains unchanged. The site guide injection mechanism in `ai-integration.js` carries all new Excalidraw intelligence to the AI without modification.

**Major components:**
1. `site-guides/design/excalidraw.js` — THE primary work product; will contain the full keyboard shortcut reference, text entry workflow, shape drawing patterns, connector patterns, styling workflow, alignment workflow, export workflow, canvas operations, verification selectors, and layout planning grid convention
2. `background.js` (line 11074, `isCanvasEditorUrl()`) — NEEDS FIX: extend regex to include `excalidraw.com`; also unify with the `canvasUrl` regex at line 4908 to eliminate inconsistency
3. `content/messaging.js` (line 217, `isCanvasBasedEditor()`) — NEEDS FIX: add Excalidraw hostname detection to trigger the CDP direct path in the `type` tool
4. `background.js` (lines 12267-12358, CDP debugger management) — MEDIUM priority: shared debugger lock prevents intermittent "already attached" errors during rapid keyboard+CDP interleaving

**Layout planning convention established by research:** AI should use 150px horizontal spacing, 120px vertical spacing, and 150x80px default shape size for consistent diagram layouts.

### Critical Pitfalls

1. **Transient textarea fails with `type` tool** — Excalidraw creates `<textarea class="excalidraw-wysiwyg">` dynamically; it is absent from DOM snapshots. Use `cdpInsertText` after waiting 200-400ms for textarea mount. Fix `isCanvasBasedEditor()` in `content/messaging.js` to trigger the CDP direct path. (Phase 1 gating issue.)

2. **Progress detector aborts all multi-step tasks** — `isCanvasEditorUrl()` in `background.js` only matches `docs.google.com`. Sessions abort after 6 iterations despite successful drawing. Extend the regex to include `excalidraw\.com` and treat successful `cdpDrag`/`cdpClickAt`/`press_key` as progress signals. (Phase 1 gating issue.)

3. **Tool auto-switch after each shape draw** — Excalidraw reverts to selection tool (V) after every draw operation. A second consecutive `cdpDrag` without re-pressing the tool key creates a selection box, not a shape. CDP reports `success: true` regardless. The site guide must enforce re-pressing the tool key as a hard rule between every shape draw.

4. **Coordinate precision failures from zoom/pan state** — Excalidraw's internal coordinate system is offset by zoom level and canvas scroll position. Reset zoom (`Ctrl+0`) and fit to screen (`Shift+1`) at the start of every session. Minimum 50px drag distance in both axes to clear the click/drag threshold.

5. **Welcome dialog and localStorage contamination** — Excalidraw shows modals on first load and restores previous session content from localStorage on every visit. Every session must begin: press Escape (dismiss modals) then clear canvas (`Ctrl+A` then Delete) then reset zoom. This is a mandatory session setup sequence.

## Implications for Roadmap

Based on research, the natural phase structure follows the feature dependency chain. Two phases are gating and must complete before normal automation is viable.

### Phase 1: Engine Fixes and Session Foundation

**Rationale:** Two code bugs in `background.js` and `content/messaging.js` make multi-step Excalidraw automation non-functional regardless of site guide quality. These are not enhancements — they are existing breaks that silently abort sessions. Must resolve first.

**Delivers:** A functional automation loop that does not abort after 6 iterations; text entry via CDP; clean session state on every run; token-efficient DOM snapshots.

**Addresses:** Text labels (table stakes), session reliability.

**Avoids:** Pitfall 1 (transient textarea), Pitfall 2 (canvas state not DOM-observable), Pitfall 3 (isCanvasBasedEditor miss), Pitfall 11 (modals block all input), Pitfall 12 (localStorage contamination), Pitfall 17 (token explosion from React DOM), Pitfall 18 (progress detection treats drawing as no progress).

**Specific fixes required:**
- Extend `isCanvasEditorUrl()` in `background.js` (line 11074) to include `excalidraw\.com`
- Unify with `canvasUrl` regex at line 4908 into a single shared utility
- Expand `isCanvasBasedEditor()` in `content/messaging.js` (line 217)
- Add DOM snapshot filtering for `.layer-ui__wrapper` subtree
- Document and enforce session setup sequence in Excalidraw site guide

### Phase 2: Drawing Primitives and Text Entry

**Rationale:** With the engine fixed, implement all basic drawing operations and the text entry workflow. These are table stakes — every diagram requires shapes with labels. Text entry is the most complex primitive because of the transient textarea sequence.

**Delivers:** Reliable drawing of all shape types (rectangle, ellipse, diamond, line, arrow); text labels on standalone text elements and as shape labels via double-click; undo/redo; canvas clear, zoom, pan.

**Addresses:** All table-stakes drawing features.

**Avoids:** Pitfall 5 (tool auto-switch), Pitfall 7 (coordinate precision from zoom/pan), Pitfall 8 (minimum 50px drag threshold).

**Site guide sections to write:** KEYBOARD SHORTCUTS, TEXT ENTRY WORKFLOW, SHAPE DRAWING PATTERNS, CANVAS OPERATIONS, VERIFICATION SELECTORS.

### Phase 3: Multi-Element Operations and Styling

**Rationale:** Once single shapes and text work reliably, layer in connected arrows, multi-select, alignment, and color/styling. Connected arrows require shapes to already exist and have known positions. Alignment requires multi-select which has its own pitfalls around coordinate precision.

**Delivers:** Connected arrows that bind to shape edges and auto-route; multi-element rubber-band selection; alignment and distribution; stroke/fill color changes; style copy/paste.

**Addresses:** Connected arrows (differentiator), elbow routing, alignment/distribution, color styling (table stakes).

**Avoids:** Pitfall 4 (debugger conflicts from rapid key+CDP interleaving), Pitfall 6 (canvas clear via Ctrl+A unreliable without canvas focus), Pitfall 10 (shift+click misses shape centers), Pitfall 14 (arrow endpoint binding requires landing on shape boundary), Pitfall 16 (color picker uses custom components, not standard inputs).

**Site guide sections to write:** CONNECTOR/ARROW PATTERNS, STYLING WORKFLOW, ALIGNMENT WORKFLOW.

### Phase 4: Export and Natural Language Diagram Generation

**Rationale:** Export is the final table-stakes item with its own pitfalls around file dialogs. Natural language diagram generation is the capstone differentiator — it requires all primitives working reliably and a defined coordinate grid convention for the AI to plan layouts.

**Delivers:** PNG export via `Shift+Alt+C` clipboard shortcut (zero DOM interaction); SVG export via menu flow; natural language diagram generation with AI-planned layout on a 150px x 120px coordinate grid.

**Addresses:** Export (table stakes), natural language generation (key differentiator).

**Avoids:** Pitfall 13 (file dialog barriers — use clipboard path), Pitfall 15 (layout planning unbounded without grid convention).

**Site guide sections to write:** EXPORT WORKFLOW, LAYOUT PLANNING GUIDE.

### Phase Ordering Rationale

- Phase 1 (engine fixes) gates everything. Without progress detection, the loop aborts on any multi-step task. Non-negotiable first.
- Phases 2-4 follow the explicit dependency chain documented in FEATURES.md: canvas operations -> primitives -> text -> connectors -> styling -> alignment -> export -> natural language generation.
- No new architectural components means zero integration risk across all phases. Each phase is purely site guide expansion plus at most a small code edit.
- The minimum drag threshold (50px) and coordinate grid convention (150px x 120px spacing, 150x80px shapes) established in Phase 2 are inherited by all subsequent phases.

### Research Flags

Phases with well-documented patterns (skip additional research-phase):
- **Phase 1 (engine fixes):** Exact file names, function names, and line numbers identified in PITFALLS-EXCALIDRAW.md. Implementation is mechanical regex/hostname extension.
- **Phase 2 (drawing primitives):** Text entry workflow verified from Excalidraw source (`textWysiwyg.tsx`). Keyboard shortcuts verified from official documentation. Implementation is mechanical site guide writing.
- **Phase 3 (multi-element/styling):** Arrow binding behavior verified by Excalidraw team. Color picker architecture understood; needs live DOM validation of selectors only.

Phases that may benefit from targeted research during planning:
- **Phase 4 (natural language diagram generation):** The AI prompt engineering for coordinate layout planning is an inference challenge. The grid convention provides a starting point, but AI adherence to multi-step layout rules needs live iteration. Consider a brief pass on few-shot prompting strategies for coordinate-based layout before writing the LAYOUT PLANNING GUIDE section.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed. All tools verified in FSB codebase and against Excalidraw source. |
| Features | HIGH | Complete dependency chain defined. MVP scope well-bounded. Anti-features explicitly identified. |
| Architecture | HIGH | No new components needed. Two specific code fix locations identified with file names and line numbers. |
| Pitfalls | HIGH | 18 pitfalls catalogued with FSB source-verified line numbers for the 5 critical ones. |

**Overall confidence:** HIGH

### Gaps to Address

- **Color picker exact selectors:** `[data-testid="background-color"]` and `[data-testid="stroke-color"]` are MEDIUM confidence (from DeepWiki source analysis, not live DOM testing). Validate against live `excalidraw.com` DOM before writing the styling workflow section of the site guide.
- **Export dialog internal selectors:** The export dialog's download button and format selection buttons are not fully mapped. The `Shift+Alt+C` clipboard path avoids this for PNG, but SVG export via menu requires live DOM inspection.
- **Arrow binding precision threshold:** Documented as requiring endpoint landing on shape boundary, but exact tolerance and whether `cdpDrag` step count (currently 20+) affects binding reliability needs live testing in Phase 3.
- **Debugger conflict frequency in practice:** Pitfall 4 (CDP debugger attachment conflicts) is documented with code evidence but real-world frequency during Excalidraw workflows is unknown. Existing retry logic may be sufficient; assess during Phase 2 testing before building a full shared debugger manager.
- **AI layout adherence:** Whether the AI reliably follows the 150px x 120px grid convention for natural language diagram generation is an empirical question. Plan for prompt engineering iteration in Phase 4.

## Sources

### Primary (HIGH confidence)
- [Excalidraw source: textWysiwyg.tsx](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx) — textarea element creation, class names, focus behavior
- [Excalidraw source: DefaultItems.tsx](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/main-menu/DefaultItems.tsx) — main menu data-testid attributes
- [Excalidraw arrow binding behavior](https://x.com/excalidraw/status/1786055557645824177) — official team confirmation of edge binding mechanics
- [Excalidraw MainMenu docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/main-menu) — API component documentation
- [Excalidraw undo/redo v0.18.0 release](https://github.com/excalidraw/excalidraw/releases/tag/v0.18.0) — CaptureUpdateAction history manager
- [Chrome DevTools Protocol: Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) — Input.insertText, Input.dispatchKeyEvent
- FSB codebase (`content/actions.js`, `content/messaging.js`, `background.js`, `site-guides/design/excalidraw.js`, `utils/action-verification.js`) — specific line numbers verified against source

### Secondary (MEDIUM confidence)
- [Excalidraw keyboard shortcuts (csswolf.com)](https://csswolf.com/excalidraw-keyboard-shortcuts-pdf/) — third-party shortcut compilation
- [DeepWiki: Excalidraw export system](https://deepwiki.com/excalidraw/excalidraw/6.6-export-system) — export dialog structure
- [DeepWiki: Properties and color picker](https://deepwiki.com/zsviczian/excalidraw/4.6-properties-and-color-picker) — property panel structure
- [DeepWiki: Actions and toolbars](https://deepwiki.com/excalidraw/excalidraw/4.1-actions-and-toolbars) — toolbar DOM structure
- [Excalidraw localStorage persistence issue](https://github.com/excalidraw/excalidraw/issues/10255) — autosave behavior
- [Excalidraw state management](https://dev.to/karataev/excalidraw-state-management-1842) — React state architecture
- [1337skills Excalidraw cheatsheet](https://1337skills.com/cheatsheets/excalidraw/) — shortcut reference
- [HackMD Excalidraw guide](https://hackmd.io/@alkemio/SJuewkPwn) — usage patterns
- [CDP Input.insertText focus issues](https://github.com/ChromeDevTools/devtools-protocol/issues/45) — focus-based insertion behavior

### Tertiary (LOW confidence)
- [Canvas automation testing challenges (PixiJS discussion)](https://github.com/pixijs/pixijs/discussions/10788) — canvas automation principles (different library, same fundamental problem)

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
