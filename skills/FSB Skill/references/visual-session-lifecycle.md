# Visual session lifecycle

While a visual session is open, the FSB extension paints an orange glow on the active tab so the user can see an external AI is driving. The glow stays on until `end_visual_session` is called. If the session is never closed, the glow persists across reloads -- the user has to close the tab or clear extension state to remove it. This file documents the open/close pairing rule and shows the close path on every termination outcome.

## The pairing rule

1. Open the session with `start_visual_session({ client: "OpenClaw", task: <short label> })`. Save the returned `session_token`.
2. Run the work (any sequence of FSB tools).
3. Close the session with `end_visual_session({ session_token, reason })` exactly once. The `reason` is one of `ended` or `cancelled` (the only values the MCP schema accepts). Use whichever matches the actual termination state.

One open => exactly one close. No exceptions.

## Bootstrap: NO_OWNED_TAB on session open

`start_visual_session` requires the calling agent to already own a tab. On the first call of a new agent session there is no owned tab yet, so the open will fail with `NO_OWNED_TAB`. Recover by opening a tab first, then retrying the visual-session open:

```
list_tabs({})                                     // optional: see if anything is already owned
open_tab({ url: "<target>", active: false })      // claim a tab without stealing user focus
start_visual_session({ client: "OpenClaw", task: "..." })   // now succeeds
```

## Termination outcomes (always close)

The MCP `end_visual_session` schema accepts only two values; map each termination path onto one of them.

| Outcome                                          | reason value |
|--------------------------------------------------|--------------|
| Task finished successfully.                      | `ended`      |
| A typed error fired and the loop cannot recover. | `cancelled`  |
| The model decided to abort mid-sequence.         | `cancelled`  |
| The user cancelled (stop button, escape, etc.).  | `cancelled`  |

## Pattern: try/finally close

```
const { session_token } = await start_visual_session({ client: "OpenClaw", task: "<short label>" });
try {
  // ... FSB tool calls ...
  await end_visual_session({ session_token, reason: "ended" });
} catch (err) {
  await end_visual_session({ session_token, reason: "cancelled" });
  throw err;
}
```

Even when the model is reasoning across multiple turns, the close MUST run on every termination path. Defer the close into a finally-equivalent or wrap the whole turn-loop so the path is impossible to miss.

## Error-path close coverage

- Typed multi-agent error (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`, `NO_OWNED_TAB`, `AMBIGUOUS_TAB`) -- close with `reason: "cancelled"` and report the typed error.
- Restricted-tab attach failure (`chrome://`, `edge://`, Web Store, `data:`, `file:`) -- recover via `references/restricted-tab-recovery.md` first; only close if recovery itself fails.
- User cancel mid-task -- close with `reason: "cancelled"`.
- Model self-aborts (decides task is impossible) -- close with `reason: "cancelled"`.
- Network / bridge disconnect -- close with `reason: "cancelled"`. The bridge may have already invalidated the session; the close call is idempotent and safe to attempt anyway.

## Anti-patterns

```
[BAD]  start_visual_session({ client: "OpenClaw", task: "..." })
       // ... work ...
       // never call end_visual_session
       // result: orange glow stuck on the user's tab indefinitely.
[GOOD] always pair start with end on every termination path (see try/finally pattern above).
```

```
[BAD]  end_visual_session({ session_token, reason: "complete" })   // schema rejects this
[GOOD] end_visual_session({ session_token, reason: "ended" })      // or "cancelled"
```

## See also

- `SKILL.md` -- "Visual session wrapping" body paragraph.
- `references/multi-agent-contract.md` -- typed errors that trigger error-path closes.
- `references/restricted-tab-recovery.md` -- recover before closing on attach failures.
