# Plan 229-01 Operator Rerun

**Purpose:** Visually verify Plan 229-01 dynamics fixes (debounce, monotonic, glow memoization, counter batching) on a real automation run after extension reload. The gsd-executor cannot drive a browser; this scaffold is operator-driven.

**Pre-rerun:**
- [ ] Reload unpacked extension at chrome://extensions
- [ ] Open a fresh tab to https://excalidraw.com (PROMPT-04 baseline) OR the form-fill target page (PROMPT-02 baseline)
- [ ] Open DevTools Performance panel (optional but recommended for CLS measurement)

**Rerun procedure:**
1. Trigger autopilot with the Phase 224 baseline prompt (e.g. PROMPT-04 Excalidraw or PROMPT-02 form-fill).
2. Observe overlay for 30 seconds of normal automation.
3. Optionally: capture Performance trace for the same 30 seconds and read CLS on the overlay region.

**Operator observations (fill in after rerun):**

## Status text cadence (OVERLAY-01)
Observation: _____
Pass criteria: text changes feel paced (~2-3 changes per second max), no rapid-fire flicker, no mid-sentence flash.

## Glow position stability (OVERLAY-02)
Observation: _____
Pass criteria: glow does not jitter between actions on the same target; glow follows target only on real layout change (scroll/resize).

## Progress bar monotonicity (OVERLAY-03)
Observation: _____
Pass criteria: bar never visibly retreats; phase reclassification (e.g. extraction -> navigation) does not cause backwards jump.

## Action counter cadence (OVERLAY-04)
Observation: _____
Pass criteria: "Actions: N" advances once per iteration, not per-tool-call within an iteration; no rapid stair-step flicker.

## v0.9.26 contract preservation
Observation: _____
Pass criteria: completion green-flash fires, "Done" pill appears, overlay auto-hides after 3s, M:SS timer ticks smoothly, tabular-nums alignment intact.

## CLS measurement (optional)
CLS on overlay region: _____ (target: 0)

## Final verdict
- [ ] PASS - all four fixes confirmed visually steady
- [ ] FAIL - describe regression: _____
