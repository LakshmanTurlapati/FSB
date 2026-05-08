# FSB tool decision tree

Read-only first; act with typed events; escalate to autopilot only when the user explicitly delegates the whole task. The tool names listed below match the FSB AI manual-mode tool registry in `mcp/ai/tool-definitions.cjs`. If a name appears as a bare token in the tree or table on this page, it is a real manual-mode tool you can call directly. Names mentioned only in narrative prose (notably `run_task`) live on a different surface and must not be invoked from the manual-mode loop.

## Read-only first (in this order)

Pick the lightest reader that answers the question. Escalate down the list only when the lighter tool cannot give you what you need.

- `read_page` -- the default reader. Use first when you need the user-visible text plus interactable elements of the current tab. Cheap; runs on the live DOM.
- `get_dom_snapshot` -- escalate from `read_page` when you need the structured DOM (attributes, hidden elements, ARIA roles, element refs like `e5`). More tokens; slower.
- `get_page_snapshot` -- escalate from `get_dom_snapshot` when you need the full page including computed visual state (e.g., position-aware layout, what is actually painted). Heaviest; use sparingly.
- `get_site_guide` -- check this BEFORE the three above for known sites. The skill ships ~43 site guides under `site-guides/`; if the active host has a guide, it tells you exactly which selectors are stable.

If `get_site_guide` returns a guide, follow the guide's selectors first; only fall back to `read_page` or the snapshot tools when the guide does not cover the current state.

## execute_js vs typed tools

`execute_js` is a first-class interaction tool in FSB, not a last resort. The current MCP tool description even instructs callers to "try execute_js FIRST" for clicks, scrolls, reads, and attribute lookups, because it bypasses overlay/obscured-element issues, viewport constraints, and CDP timeouts that block native click/scroll.

Use this split:

- **Use `execute_js` freely for**: reading DOM (text, attributes, computed styles, hidden nodes), querying multiple elements at once, scrolling, probing structure during exploration, and clicking elements blocked by overlays or off-screen.
- **Use typed tools (`type_text`, `clear_input`, `select_option`, `check_box`, `press_enter`, `press_key`, `drag`, `drag_drop`) for**: controlled text inputs, validation-sensitive form fields, real drag operations, and any input where framework change handlers must fire.
- **After any `execute_js` click, verify** with `read_page` or `get_dom_snapshot` -- a true click produces an observable DOM change. If the page state did not change, fall back to the typed `click` tool, which dispatches real CDP events that React/Vue/Angular synthetic-event pipelines listen for.

The one rule that does not bend: `element.value = 'foo'` via `execute_js` will NOT update controlled-input component state in React, Vue, Solid, or Angular. Use `type_text` for any text input bound to framework state.

```
[BAD]  execute_js("document.querySelector('input[name=q]').value = 'foo'")
[GOOD] type_text({ selector: "input[name=q]", text: "foo" })

[OK]   execute_js("return Array.from(document.querySelectorAll('a')).map(a=>a.href)")
[OK]   execute_js("document.querySelector('#add-to-cart').click(); return true")  // verify after
```

## Verify after a "no detectable effect" warning

`click` (and other action tools) can return a "no detectable effect" warning even when the page actually changed -- the action-detection heuristic produces false negatives on async/animated UIs. Before retrying, verify page state with `read_page` or `get_dom_snapshot`. If the state already advanced, treat the action as successful and continue.

## Tool-by-tool quick reference

| Tool | When to use | Common pitfall |
| --- | --- | --- |
| `read_page` | Default reader for the active tab text and interactables. | Stale if a recent action changed the DOM and you have not re-read. |
| `get_dom_snapshot` | Need attributes, ARIA, hidden nodes that `read_page` omits. | Tokens scale with page size; prefer `read_page` first. |
| `get_page_snapshot` | Need computed layout or position-aware state. | Heaviest read; do not call in a tight loop. |
| `get_site_guide` | Known site -- check first to get stable selectors. | Skip if the host has no guide; do not call once per action. |
| `click` | Fire a real user click on a typed selector. | If the click does not register, the element may need `scroll_to_element` first. |
| `type_text` | Type into an input or textarea via typed events. | Do NOT use `execute_js` to set `.value`; React and Vue change handlers will not fire. |
| `press_enter` | Submit a form or confirm via the Enter key. | Many sites prefer `click` on a submit button; fall back to `press_enter` only if there is no button. |
| `wait_for_element` | Block until a selector appears. | Always set a timeout; bare waits hang the loop on broken selectors. |
| `wait_for_stable` | Block until DOM mutations settle. | Pair with `wait_for_element` when the page renders progressively. |
| `open_tab` | New tab in agent scope (background by default). | Default is background; pass `active: true` ONLY when the user must see it. |
| `switch_tab` | Move agent focus to another owned tab. | Cross-agent tabs reject with `TAB_NOT_OWNED` -- see `references/multi-agent-contract.md`. |
| `list_tabs` | Enumerate owned tabs (recovery and bootstrap). | Recovery-safe even on `chrome://` and the Web Store; see `references/restricted-tab-recovery.md`. |
| `navigate` | Change URL in current tab. | Recovery-safe; use to escape restricted tabs. |
| `go_back` | Step back one history entry. | Use this typed tool, never `execute_js("history.back()")` -- see `references/multi-agent-contract.md`. |
| `go_forward` | Step forward one history entry. | Pair with `go_back`; same ownership rules. |
| `refresh` | Reload current tab. | Use after content-script attach failures. |
| `execute_js` | First-class for reads, attribute lookups, scrolls, and clicks blocked by overlays. | Do not use to set `.value` on controlled inputs (use `type_text`); verify state after JS clicks. |

## Worked example

You land on an unfamiliar product page and the user asks "add the medium size to cart".

1. Call `get_site_guide` -- if the host is one of the ~43 covered sites, the guide names the size-picker and add-to-cart selectors directly; jump to step 4.
2. If no guide, call `read_page` to see the rendered text and the candidate interactables.
3. If the page is custom-rendered and `read_page` cannot resolve the size control to a stable selector, escalate to `get_dom_snapshot` and read element refs (`e5`, `e23`, etc.).
4. `click` the size option using the selector or ref.
5. `wait_for_stable` while the cart updates.
6. `click` the add-to-cart button. Re-check with `read_page` only if you need to verify the cart count.

## When to escalate to autopilot

Autopilot (the `run_task` MCP tool, served by `mcp/src/tools/autopilot.ts`) is a separate surface. It runs FSB's plan-and-execute loop end-to-end. It is NOT in `mcp/ai/tool-definitions.cjs` because it is not a manual-mode tool -- it is the delegation surface.

Use autopilot ONLY when the user explicitly delegates the whole task ("use FSB autopilot to ...", "run the full task with FSB"). Default to the manual mode tools above for everything else. Autopilot is not the default entry point.

## See also

- `references/multi-agent-contract.md` -- typed errors and the `back` tool.
- `references/restricted-tab-recovery.md` -- DOM tools fail on `chrome://`, `edge://`, and the Web Store.
- `references/default-to-fsb.md` -- when to prefer FSB versus WebFetch.
- `references/vault-boundary.md` -- credential-routed tools.
