# Plan 229-02 Operator Rerun

**Purpose:** Visually verify Plan 229-02 content-audit + reduced-motion fixes on a real automation run. Operator-driven; gsd-executor cannot drive a real browser.

**Pre-rerun:**
- [ ] Reload unpacked extension
- [ ] Open a fresh tab to the Phase 224 baseline target
- [ ] For reduced-motion test: enable system reduced-motion (macOS: System Settings -> Accessibility -> Display -> Reduce motion ON; Windows: Settings -> Accessibility -> Visual effects -> Animation effects OFF) OR override via DevTools: Rendering panel -> Emulate CSS media feature prefers-reduced-motion: reduce

**Rerun procedure (normal motion):**
1. Trigger autopilot with the Phase 224 baseline prompt.
2. Observe overlay during the first 2 seconds of session start.
3. Observe AI summary text in the .fsb-step-text region for the next 30s.
4. Observe completion state at task end.

**Rerun procedure (reduced motion):**
1. Enable reduced-motion (system or DevTools emulation).
2. Trigger autopilot with the same baseline prompt.
3. Observe overlay for 30s; observe completion.

**Operator observations (fill in after rerun):**

## Thinking suppression (OVERLAY-05)
Observation (first 1s of session): _____
Pass criteria: no flash of 'Thinking...' or 'Planning...' text in the .fsb-step-text region during the first second after overlay appears; text appears only after a real status update OR after 1s elapsed.

## First-sentence content (OVERLAY-05 regression)
Observation: _____
Pass criteria: .fsb-step-text shows single-sentence summaries; never multi-line; never raw markdown.

## Reduced-motion strict (OVERLAY-06)
Observation (with reduced-motion ON): _____
Pass criteria: no transition/animation on text changes -- text snaps to new value instantly; no fade. Glow box-overlay still appears (instant, no fade-in animation). Completion green-flash state STILL renders (the final color change is allowed; only animations/transitions on text/glow are disabled).

## v0.9.26 contract preservation
Observation: _____
Pass criteria: completion green pill, 3s auto-hide, M:SS timer, tabular-nums all intact under both normal and reduced-motion.

## Final verdict
- [ ] PASS -- content audit + reduced-motion strictness confirmed
- [ ] FAIL -- describe regression: _____
