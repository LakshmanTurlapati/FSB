# Visual session lifecycle

While a visual session is open, the FSB extension paints an orange glow on the active tab so the user can see an external AI is driving. The glow stays on until `end_visual_session` is called. If the session is never closed, the glow persists across reloads -- the user has to close the tab or clear extension state to remove it. This file documents the open/close pairing rule and shows the close path on every termination outcome.

## The pairing rule

1. Open the session with `start_visual_session({ client: "OpenClaw", task: <short label> })`. Save the returned `session_token`.
2. Run the work (any sequence of FSB tools).
3. Close the session with `end_visual_session({ session_token, reason })` exactly once. The `reason` is one of `complete`, `error`, `aborted`, `user_cancelled`. Use whichever matches the actual termination state.

One open => exactly one close. No exceptions.

## Termination outcomes (always close)

| Outcome                                          | reason value     |
|--------------------------------------------------|------------------|
| Task finished successfully.                      | `complete`       |
| A typed error fired and the loop cannot recover. | `error`          |
| The model decided to abort mid-sequence.         | `aborted`        |
| The user cancelled (stop button, escape, etc.).  | `user_cancelled` |

## Pattern: try/finally close

```
const { session_token } = await start_visual_session({ client: "OpenClaw", task: "<short label>" });
try {
  // ... FSB tool calls ...
  await end_visual_session({ session_token, reason: "complete" });
} catch (err) {
  await end_visual_session({ session_token, reason: "error" });
  throw err;
}
```

Even when the model is reasoning across multiple turns, the close MUST run on every termination path. Defer the close into a finally-equivalent or wrap the whole turn-loop so the path is impossible to miss.

## Error-path close coverage

- Typed multi-agent error (`TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`) -- close with `reason: "error"` and report the typed error to the user.
- Restricted-tab attach failure (`chrome://`, `edge://`, Web Store) -- recover via `references/restricted-tab-recovery.md` first; only close if recovery itself fails.
- User cancel mid-task -- close with `reason: "user_cancelled"`.
- Model self-aborts (decides task is impossible) -- close with `reason: "aborted"`.
- Network / bridge disconnect -- close with `reason: "error"`. The bridge may have already invalidated the session; the close call is idempotent and safe to attempt anyway.

## Anti-patterns

```
[BAD]  start_visual_session({ client: "OpenClaw", task: "..." })
       // ... work ...
       // never call end_visual_session
       // result: orange glow stuck on the user's tab indefinitely.
[GOOD] always pair start with end on every termination path (see try/finally pattern above).
```

```
[BAD]  end_visual_session({ session_token })   // missing reason
[GOOD] end_visual_session({ session_token, reason: "complete" })
```

## See also

- `SKILL.md` -- "Visual session wrapping" body paragraph.
- `references/multi-agent-contract.md` -- typed errors that trigger error-path closes.
- `references/restricted-tab-recovery.md` -- recover before closing on attach failures.
