---
status: resolved
trigger: "gdocs-formatted-paste-not-firing - clipboard HTML paste code not executing, plain CDP insertText used instead"
created: 2026-02-17T17:30:00Z
updated: 2026-02-17T17:35:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: Removed `!isContentEditable` from canvas editor bypass gate at content.js line 6080
expecting: Canvas editor bypass now fires for Google Docs elements with contenteditable="true", enabling formatted paste path
next_action: Verification via manual test (reload extension, run task with markdown text on Google Docs)

## Symptoms

expected: When typing markdown-formatted text into Google Docs, the code should detect markdown, convert to HTML, write to clipboard, and paste via Ctrl+V to get formatted text.
actual: Plain CDP insertText is used. Raw markdown syntax appears literally in the Google Doc. No log entries for "clipboard", "formatted_paste", "hasMarkdown", or "method" appear in the session log.
errors: No errors -- typing succeeds but uses wrong method (plain text instead of formatted paste).
reproduction: Task "check elon's latest post and summarize it in google doc" -- the type action inserts literal asterisks visible.
started: The formatted paste code was implemented but placed behind a gate that prevents execution.

## Eliminated

- hypothesis: Functions don't exist in content.js
  evidence: Found hasMarkdownFormatting (line 2349), markdownToHTML (line 2388), clipboardPasteHTML (line 2518), stripMarkdown (line 2570) -- all present
  timestamp: 2026-02-17T17:30:30Z

- hypothesis: Functions exist but aren't called from any type path
  evidence: Found call site at lines 6085-6124 inside the canvas_editor_cdp_direct block -- they ARE called but the enclosing if-block never executes
  timestamp: 2026-02-17T17:31:00Z

## Evidence

- timestamp: 2026-02-17T17:30:30Z
  checked: content.js grep for hasMarkdownFormatting/markdownToHTML/clipboardPasteHTML/stripMarkdown
  found: All four functions exist. Call site exists at lines 6085-6124 inside the canvas editor bypass block (line 6077).
  implication: The functions themselves are not the problem -- it is the gate condition.

- timestamp: 2026-02-17T17:31:00Z
  checked: The gate condition at line 6077: `canvasEditor && !isInput && !isContentEditable`
  found: `.kix-appview-editor` has `contenteditable="true"`, making `isContentEditable=true` at line 6065. The `!isContentEditable` in the gate evaluates to `false`, blocking the entire canvas editor bypass including the formatted paste code.
  implication: ROOT CAUSE. The gate was designed to bypass the element input check for canvas editors, but it accidentally blocks canvas editors that also have contenteditable (which Google Docs does).

- timestamp: 2026-02-17T17:31:30Z
  checked: The actual execution path when isContentEditable=true
  found: Falls to line 6431 `else if (isContentEditable)` branch. Tries execCommand, clipboard paste simulation, Range/Selection API, direct manipulation -- all fail on Google Docs canvas. Then CDP fallback at line 6702 fires plain cdpInsertText. Returns with method `cdp_fallback_canvas` (line 6734) or exits via the standard success path at line 6812 which has NO method field.
  implication: Confirms the session log evidence -- no formatted paste log entries, and no method field in the result.

- timestamp: 2026-02-17T17:31:45Z
  checked: manifest.json for clipboardWrite permission
  found: Present at line 18
  implication: Permission is not the issue.

- timestamp: 2026-02-17T17:33:00Z
  checked: Regression safety of removing !isContentEditable from gate
  found: (1) isCanvasBasedEditor() only returns true for docs.google.com and Sheets/Slides kix/waffle classes -- sufficiently specific. (2) Google Docs title field (.docs-title-input) is an INPUT element, so isInput=true excludes it from canvas bypass. (3) Google Sheets cell editor is textarea/input, also excluded by isInput. (4) Formatted paste further guards with isGoogleDocs && pathname.startsWith('/document/'), so Sheets/Slides get plain CDP correctly.
  implication: No regression risk. The fix is safe.

## Resolution

root_cause: The canvas editor bypass gate at content.js line 6077 had condition `canvasEditor && !isInput && !isContentEditable`. Google Docs' `.kix-appview-editor` element has `contenteditable="true"`, making `isContentEditable=true`, which caused `!isContentEditable` to evaluate to `false`. The entire canvas editor bypass block -- including the formatted paste code (hasMarkdownFormatting, markdownToHTML, clipboardPasteHTML) -- was never entered. Instead, the code fell through to the standard `isContentEditable` branch which uses execCommand/DOM methods that fail on Google Docs canvas, then fell back to plain CDP insertText, inserting raw markdown text with literal asterisks.

fix: Changed the gate condition from `canvasEditor && !isInput && !isContentEditable` to `canvasEditor && !isInput`. Added a comment explaining why `!isContentEditable` must not be included: Google Docs' editor div has contenteditable="true" but is a canvas-based editor that needs CDP insertion. The `isCanvasBasedEditor()` check is already specific enough (Google Docs/Sheets/Slides).

verification: Code review confirms (1) the formatted paste path will now execute for Google Docs elements with contenteditable="true", (2) no regression for Google Sheets (guarded by pathname check), (3) no regression for non-canvas contentEditable elements (not caught by isCanvasBasedEditor), (4) no regression for input elements (guarded by !isInput). Manual test required: reload extension, run markdown-producing task on Google Docs.

files_changed:
- content.js: Line 6080 -- changed gate from `canvasEditor && !isInput && !isContentEditable` to `canvasEditor && !isInput`, added explanatory comment (lines 6075-6078)
