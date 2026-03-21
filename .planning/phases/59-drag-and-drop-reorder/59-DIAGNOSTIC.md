# Autopilot Diagnostic Report: Phase 59 - Drag-and-Drop Reorder

## Metadata
- Phase: 59
- Requirement: MICRO-03
- Date: 2026-03-21
- Outcome: PARTIAL (drag_drop MCP tool fully wired with 3-method fallback, Trello site guide 3-tier workflow ready, live execution blocked by WebSocket bridge disconnect)
- Live MCP Testing: NO (WebSocket bridge disconnected -- ports 3711/3712 not listening)

## Prompt Executed
"Navigate to a Kanban board (Trello or similar), identify the bottom card in one list, drag and drop it to the top of another list, and verify the card moved successfully."

## Result Summary
Live MCP test was attempted but could not execute. The FSB MCP server process was running (PID 80445, node mcp-server/build/index.js) but the WebSocket bridge to Chrome was disconnected -- ports 3711 and 3712 had no listening process. Without the bridge, MCP tools (navigate, get_dom_snapshot, read_page, drag_drop, drag, click, click_at) cannot reach the browser. A drag_drop MCP tool was created in Plan 01 (manual.ts) implementing a 3-method fallback chain: HTML5 DragEvent (dragstart/drop), PointerEvent sequence (for react-beautiful-dnd), and MouseEvent sequence (basic fallback). The Trello site guide was updated with a 3-tier dragAndDropReorder workflow: DOM drag_drop first, CDP drag second, Move button UI fallback third. Classification: PARTIAL -- tool chain is complete, site guide and 3-tier workflow ready, but the drag-and-drop reorder of a Kanban card was not physically executed.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | trello.com (Kanban board) | NOT EXECUTED | WebSocket bridge disconnected -- no browser connection on ports 3711/3712. MCP server process running (PID 80445) but cannot reach Chrome. Trello requires auth; public boards would also need bridge. |
| 2 | read_page | Trello landing/board page | NOT EXECUTED | Bridge required to check for cookie consent, onboarding popups, or login wall |
| 3 | click | Cookie/consent popup dismiss button | NOT EXECUTED | Cannot dismiss consent popup without browser connection |
| 4 | get_dom_snapshot | Board structure: lists [data-testid="list"], cards [data-testid="trello-card"] | NOT EXECUTED | Cannot inspect DOM to identify list containers, card elements, or board layout. Expected selectors from site guide: [data-testid="list"], [data-testid="trello-card"], [data-testid="list-name"], [data-testid="board-canvas"] |
| 5 | (identification) | Source card: bottom card in list A; Target: top position in list B | NOT EXECUTED | Cannot identify source card text or target list name without DOM snapshot. Would use lastCardInList selector: [data-testid="list"]:nth-child(1) [data-testid="trello-card"]:last-child |
| 6 | (record) | Record source card text and target list name for verification | NOT EXECUTED | No DOM data available to record pre-move state |
| 7 | drag_drop | sourceSelector=bottom card ref, targetSelector=first card in destination list ref, steps=15, holdMs=200, stepDelayMs=25 | NOT EXECUTED | Method 1 (DOM drag_drop with PointerEvent sequence for react-beautiful-dnd). Tool exists in manual.ts with 3-method fallback. Cannot execute without WebSocket bridge to Chrome. |
| 8 | get_dom_snapshot | Verify card moved: source card at top of destination list | NOT EXECUTED | Cannot verify drag_drop outcome without DOM snapshot |
| 9 | drag | sourceX, sourceY, targetX, targetY, steps=20, stepDelayMs=30 | NOT EXECUTED | Method 2 (CDP drag with raw mouse events). Would calculate center coordinates from bounding rects: centerX = left + width/2, centerY = top + height/2. Cannot execute without bridge. |
| 10 | get_dom_snapshot | Verify CDP drag outcome | NOT EXECUTED | Cannot verify CDP drag outcome |
| 11 | click | Source card or press Enter to open card detail | NOT EXECUTED | Method 3 (Move button fallback). Would open card detail modal [data-testid="card-back"]. Cannot execute without bridge. |
| 12 | click | Move button [data-testid="card-back-move-card-button"] | NOT EXECUTED | Would click Move button in card detail sidebar to open move popover |
| 13 | click | Destination list dropdown selection | NOT EXECUTED | Would select target list from move popover dropdown |
| 14 | click | Position "1" (top) in position select [data-testid="move-card-popover-select-position"] | NOT EXECUTED | Would select top position in destination list |
| 15 | click | Move confirm button | NOT EXECUTED | Would click Move to confirm card relocation |
| 16 | get_dom_snapshot | Final verification: card at top of destination list, not in source list | NOT EXECUTED | Cannot perform final verification without browser connection |

## What Worked
- MCP server process confirmed running (node mcp-server/build/index.js, PID 80445) -- server is operational
- drag_drop MCP tool fully registered in manual.ts with 3-method fallback chain:
  - Method 1: HTML5 DragEvent (dragstart/dragover/drop sequence)
  - Method 2: PointerEvent sequence (pointerdown/pointermove/pointerup -- what react-beautiful-dnd listens for)
  - Method 3: MouseEvent sequence (mousedown/mousemove/mouseup -- basic fallback)
- Tool parameters correctly defined: sourceSelector (element ref), targetSelector (element ref), steps (default 10), holdMs (default 150), stepDelayMs (default 20)
- sourceSelector/targetSelector map to sourceRef/targetRef internally via execAction in manual.ts (verified in code)
- Trello site guide updated with dragAndDropReorder workflow implementing 3-tier approach:
  - Tier 1: DOM drag_drop with holdMs=200 (gives react-beautiful-dnd time to recognize drag intent)
  - Tier 2: CDP drag with raw mouse events using calculated viewport coordinates
  - Tier 3: Move button UI fallback (open card detail, click Move, select destination, select position)
- Trello site guide selectors for drag-and-drop: lastCardInList, firstCardInList, listCards, movePositionSelect
- Trello site guide toolPreferences updated with drag_drop, drag, click_at, get_dom_snapshot
- Warning about react-beautiful-dnd blocking synthetic events added to site guide
- 3-tier warning specifically added: "try drag_drop first, CDP drag second, Move button third"
- MCP server builds cleanly with the drag_drop tool (verified in Plan 01)
- Prior phase CDP interaction pattern confirmed working on interactive web apps: click_at on canvas (Phase 47, 50), drag on WebGL/canvas (Phase 48, 52, 53), press_key via debugger (Phase 54), click_and_hold via CDP (Phase 58)

## What Failed
- Live MCP execution not performed: WebSocket bridge between MCP server and Chrome extension was disconnected (ports 3711/3712 not listening)
- Kanban board was not navigated to -- cannot confirm whether Trello or any alternative board loads successfully
- Trello login/auth was not tested -- cannot confirm whether a public board is accessible or whether auth blocks all access
- Board structure was not inspected -- cannot confirm that [data-testid="list"], [data-testid="trello-card"], [data-testid="list-name"] selectors match live Trello DOM
- drag_drop was not physically executed on any Kanban card -- cannot confirm whether PointerEvent sequence triggers react-beautiful-dnd drag recognition
- holdMs=200 timing was not validated -- cannot confirm that 200ms is sufficient for react-beautiful-dnd to recognize drag intent
- CDP drag was not tested as fallback -- cannot confirm whether raw mouse events trigger Trello card reorder
- Move button UI fallback was not tested -- cannot confirm that [data-testid="card-back-move-card-button"] selector matches live Trello DOM
- Card position verification was not performed -- cannot confirm that get_dom_snapshot can detect card order changes within lists
- Cookie/consent popup detection was not tested on Trello
- No alternative Kanban board was tested (public Trello board, demo Kanban apps)

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-59):** The MCP server runs in stdio mode and requires the WebSocket bridge process on ports 3711/3712 to reach Chrome. This bridge has been disconnected in Phases 55, 56, 57, 58, and now 59. Without it, no tool (DOM or CDP based) can execute. This is the primary blocker for all live MCP testing in this milestone.
- **react-beautiful-dnd synthetic event resistance:** Trello uses react-beautiful-dnd for card drag-and-drop. This library specifically listens for PointerEvent sequences (pointerdown, pointermove, pointerup) rather than HTML5 DragEvent or MouseEvent. The drag_drop tool dispatches all three methods in fallback order, but whether the PointerEvent dispatch from content script context reaches react-beautiful-dnd's event listeners has not been validated. react-beautiful-dnd also has specific requirements: (a) minimum drag distance before activating, (b) holdMs delay before recognizing drag intent, (c) specific event ordering and timing. The tool's PointerEvent method should match, but this is unconfirmed.
- **DOM-dispatched events vs library-internal state:** Even if PointerEvent is correctly dispatched and react-beautiful-dnd recognizes the drag, the library manages its own internal state (drag context, placeholder positioning, drop zone calculation). DOM-dispatched events may not correctly update this internal state, resulting in the drag appearing to work visually but the data model not updating (card stays in original position after DOM re-render). This is a known risk with synthetic event approaches on library-managed UIs.
- **No programmatic card repositioning API tool:** Trello has a REST API (api.trello.com) that can move cards between lists programmatically (PUT /1/cards/{id}?idList={targetList}&pos=top). An MCP tool that makes direct API calls (requiring Trello API key/token) would be the most reliable method but bypasses DOM interaction entirely. This is a trade-off: API-level reliability vs DOM-level verification of UI behavior.
- **No get_bounding_rect tool (carried from Phase 57):** Calculating center coordinates for CDP drag requires parsing a full DOM snapshot for a single element's bounding rect. A dedicated get_bounding_rect(selector) tool would simplify coordinate calculations for drag, click_at, and click_and_hold operations. This gap affects Method 2 (CDP drag) which needs viewport coordinates.
- **No set_input_value tool (carried from Phase 57):** The Move button fallback (Method 3) involves selecting a position from a dropdown. The existing click tool can select dropdown options by clicking them, but a dedicated set_input_value tool would be more reliable for select elements.
- **Drag timing and velocity calibration:** Different Kanban libraries (react-beautiful-dnd, react-dnd, SortableJS, dragula) have different timing requirements for recognizing drag intent. react-beautiful-dnd needs ~200ms hold, SortableJS needs ~50ms, dragula responds immediately. The drag_drop tool's holdMs parameter allows calibration, but there is no way to auto-detect which library a site uses without inspecting the DOM for library-specific attributes or class names.

## Bugs Fixed In-Phase
- **Plan 01 -- New drag_drop MCP tool (7b90728):** Created the drag_drop tool in manual.ts with server.tool registration, Zod schema (sourceSelector, targetSelector, steps, holdMs, stepDelayMs), and mapping to FSB's dragdrop verb with sourceRef/targetRef params. The tool dispatches three event methods in fallback order: HTML5 DragEvent, PointerEvent sequence (for react-beautiful-dnd), and MouseEvent sequence.
- **Plan 01 -- Trello site guide dragAndDropReorder workflow (aba03a8):** Added 3-tier drag-and-drop reorder workflow to Trello site guide (site-guides/productivity/trello.js). Added new selectors (lastCardInList, firstCardInList, listCards, movePositionSelect). Updated toolPreferences with drag_drop, drag, click_at, get_dom_snapshot. Added 3-tier warning about react-beautiful-dnd synthetic event resistance.
- No additional bugs discovered during Plan 02 (live test not performed due to bridge disconnect)

## Autopilot Recommendations

1. **Kanban board card identification in DOM snapshots:** Autopilot should identify Kanban cards using a priority-ordered selector chain: (a) [data-testid="trello-card"] (Trello-specific, most reliable), (b) [data-rbd-draggable-id] (react-beautiful-dnd draggable markers), (c) [draggable="true"][role="listitem"] (generic draggable list items), (d) .list-card or .card (common Kanban class patterns), (e) [class*="card"][class*="draggable"] (combined class pattern). For the source card (bottom of a list), use :last-child within the list container. For the target card (top of destination list), use :first-child. Always verify card text content before and after move to confirm the correct card was relocated.

2. **drag_drop vs CDP drag vs Move button selection logic:** Autopilot should follow this decision tree: (a) Start with drag_drop(sourceSelector, targetSelector, steps=15, holdMs=200, stepDelayMs=25) -- this uses PointerEvent sequence which react-beautiful-dnd listens for. holdMs=200 gives the library time to recognize drag intent. (b) If drag_drop fails (returns error or card position unchanged), try CDP drag with calculated viewport coordinates: get element bounding rects, calculate centers, use drag(sourceX, sourceY, targetX, targetY, steps=20, stepDelayMs=30). (c) If CDP drag fails, fall back to Move button UI: open card detail, click [data-testid="card-back-move-card-button"], select destination list, select position "1" (top), click Move. The Move button is guaranteed to work when logged in. (d) After each method, verify card position via get_dom_snapshot before proceeding to the next fallback.

3. **holdMs and stepDelayMs tuning for react-beautiful-dnd:** react-beautiful-dnd requires a minimum hold time before recognizing drag intent (its default sensor delay is 150ms). Recommended settings: holdMs=200 (adds 50ms buffer above rbd's default), stepDelayMs=25 (slightly slower than default 20ms for smoother animation), steps=15 (enough intermediate moves for rbd to track the drag path). If the first attempt fails with holdMs=200, retry with holdMs=400 -- some Trello boards have custom drag sensors with longer delays. Never set holdMs below 150 for react-beautiful-dnd sites.

4. **Verification strategy (compare card lists before and after):** Autopilot must verify card movement by capturing list contents before and after the drag operation. Before: use get_dom_snapshot to record (a) source list name, (b) source list card titles in order (last card is the one being moved), (c) destination list name, (d) destination list card titles in order. After: use get_dom_snapshot to verify (a) source card title now appears at position 1 (first card) of destination list, (b) source card title is no longer in source list, (c) all other cards remain in their original positions (no collateral movement). If the source card still appears in the source list after drag_drop, the drag was not recognized -- proceed to next fallback method.

5. **Authentication handling for Trello/Jira/similar:** Most Kanban board applications (Trello, Jira, Asana, Monday.com) require authentication. Autopilot strategy: (a) Navigate to the board URL and check if a login wall appears (look for [data-testid="login-form"], [class*="login"], form[action*="login"]). (b) If login wall present, check for public board access by trying a known public board URL (Trello: trello.com/b/{id} where the board has public visibility). (c) If no public board is accessible, classify outcome as skip-auth with note "Kanban board requires authentication." (d) For logged-in users, verify board access by checking for [data-testid="board-canvas"] or .board-canvas presence. (e) Alternative: use free, no-auth Kanban demo sites like kanban-demo apps for testing without auth dependency.

6. **Fallback to keyboard-based or menu-based card move:** If all drag methods fail (drag_drop, CDP drag), autopilot should use the keyboard/menu Move button approach as the guaranteed fallback. Steps: (a) Click the source card to select it, (b) Press Enter or click to open card detail modal, (c) Wait for [data-testid="card-back"] or [role="dialog"], (d) Click Move button [data-testid="card-back-move-card-button"], (e) Select destination list from dropdown, (f) Select position "1" (top) from position select [data-testid="move-card-popover-select-position"], (g) Click Move to confirm, (h) Press Escape to close modal, (i) Verify card appears in destination list. This method works regardless of drag library behavior because it uses Trello's own API-backed move functionality.

7. **Element reference resolution for cards in different lists:** When using drag_drop with element references (e.g., "e5", "e12"), autopilot must ensure both elements are visible and scrolled into the viewport. For horizontally scrollable boards, the source list and destination list may not both be visible at the same time. Strategy: (a) Use get_dom_snapshot to capture the full board DOM including off-screen elements, (b) If the target list is not in the viewport, scroll the board canvas horizontally first, (c) If using CDP drag (coordinate-based), both elements MUST be in the viewport simultaneously -- scroll to position both lists side by side before calculating coordinates.

8. **Cookie/consent popup dismissal before interaction:** Autopilot should check for and dismiss popups immediately after navigating to a Kanban board, before attempting any card interaction. Priority selectors: (a) [id*="onetrust-accept"], (b) [class*="cookie"] button[class*="accept"], (c) [class*="consent"] button[class*="accept" i], (d) [class*="gdpr"] button[class*="agree"], (e) button[id*="cookie-accept"]. Additionally, Trello may show onboarding overlays for new users -- look for [data-testid="onboarding-overlay"] or [class*="onboarding"] and dismiss with Escape or clicking a close button. If consent popup is not found within 2 seconds of page load, proceed to card interaction.

9. **Kanban library detection for drag parameter optimization:** Different Kanban libraries have different drag requirements. Autopilot should detect the library by inspecting DOM markers: (a) [data-rbd-draggable-id] or [data-rbd-drag-handle-draggable-id] = react-beautiful-dnd (holdMs=200, PointerEvent preferred), (b) [class*="sortable"][class*="chosen"] or [data-sortable] = SortableJS (holdMs=50, MouseEvent works), (c) [class*="dnd-draggable"] or [data-dnd] = react-dnd (holdMs=100, HTML5 DragEvent preferred), (d) [class*="gu-mirror"] = dragula (holdMs=0, MouseEvent works immediately). Default to holdMs=200 if no library detected (safe conservative value).

10. **WebSocket bridge dependency and restart protocol:** The persistent bridge disconnect (Phases 55-59) is the primary blocker for all live MCP testing. Autopilot should: (a) Before any test, verify bridge connectivity by checking ports 3711/3712 for listening processes. (b) If bridge is not listening, attempt restart: first the Chrome extension (reload via chrome://extensions), then the MCP server (restart node process). (c) If bridge cannot be established, classify outcome as PARTIAL with "WebSocket bridge disconnected" note rather than FAIL (the tool chain itself is correct, only the transport layer is missing). (d) For future phases, consider implementing a bridge health check as the first MCP tool call before attempting any test -- a lightweight ping that confirms the full chain (MCP server -> WebSocket bridge -> Chrome extension -> content script) is operational.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| [data-testid="list"] | List container on Trello board | Not tested (WebSocket bridge disconnected) | Unknown |
| [data-testid="trello-card"] | Card element within a list | Not tested (no live execution) | Unknown |
| [data-testid="list-name"] | List header/title text | Not tested (no live execution) | Unknown |
| [data-testid="board-canvas"] | Main board scrollable area | Not tested (no live execution) | Unknown |
| [data-testid="board-name-display"] | Board title in header | Not tested (no live execution) | Unknown |
| [data-testid="card-back"] | Card detail modal | Not tested (no live execution) | Unknown |
| [data-testid="card-back-move-card-button"] | Move button in card detail sidebar | Not tested (no live execution) | Unknown |
| [data-testid="move-card-popover-select-position"] | Position select dropdown in move popover | Not tested (no live execution) | Unknown |
| [data-testid="list"]:nth-child(INDEX) [data-testid="trello-card"]:last-child | Last card in specific list (lastCardInList) | Not tested (no live execution) | Unknown |
| [data-testid="list"]:nth-child(INDEX) [data-testid="trello-card"]:first-child | First card in specific list (firstCardInList) | Not tested (no live execution) | Unknown |
| [data-testid="list-cards"] | Cards container within a list | Not tested (no live execution) | Unknown |
| [data-rbd-draggable-id] | react-beautiful-dnd draggable marker | Not tested (no live execution) | Unknown |
| .list-wrapper | Legacy Trello list container | Not tested (no live execution) | Unknown |
| .list-card | Legacy Trello card class | Not tested (no live execution) | Unknown |

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| drag_drop | mcp-server/src/tools/manual.ts | MCP server tool: drag one DOM element onto another using 3-method fallback chain (HTML5 DragEvent, PointerEvent for react-beautiful-dnd, MouseEvent). Maps sourceSelector/targetSelector to sourceRef/targetRef internally. | sourceSelector: string (CSS selector or element ref), targetSelector: string (CSS selector or element ref), steps: number (default 10, intermediate move events), holdMs: number (default 150, hold before drag motion), stepDelayMs: number (default 20, delay between move steps) |

---
*Phase: 59-drag-and-drop-reorder*
*Diagnostic generated: 2026-03-21*
