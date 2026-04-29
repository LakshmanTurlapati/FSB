---
phase: 212-background-agents-sunset
plan: 04
subsystem: agents
tags: [agents, deprecation, gap-closure, sunset-notice, override, wr-01, agents-03]

# Dependency graph
requires:
  - phase: 212-background-agents-sunset
    plan: 02
    provides: initializeBackgroundAgentsDeprecation() function shell with textContent rendering loop, fsb_sunset_notice_dismissed scaffolding, and the Section 6 T-01 regression coverage that this plan extends
  - phase: 212-background-agents-sunset
    plan: 01
    provides: chrome.storage.local['bgAgents'] preservation (AGENTS-05) -- the data this plan now correctly reads
provides:
  - ui/options.js: shape-tolerant bgAgents coercion in initializeBackgroundAgentsDeprecation (Array.isArray | Object.values | empty fallback) -- closes WR-01 / Gap 1
  - tests/agent-sunset-control-panel.test.js: Section 7 enforces the storage-shape branch invariants on every run; existing 9 PASS sections (T-01 / D-15 / AGENTS-01..03 / annotation counts / no-emoji) are unchanged
  - .planning/phases/212-background-agents-sunset/212-VERIFICATION.md: frontmatter overrides[] block formally accepting D-11 deviation from ROADMAP SC #3; gap-2 status overridden; score 6/6
affects:
  - 212-VERIFICATION.md (re-verifier): on next run the verifier observes Gap 1 resolved (Tasks 1+2) + Gap 2 overridden (Task 3) and rewrites top-level status: from gaps_found to verified
  - Phase 213 (Sync tab build): D-15 invariant remains intact -- Server Sync wiring at ui/options.js:4189-4205 untouched; relocation to a dedicated <section id="sync"> remains unblocked

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-branch shape-tolerant coercion: Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []) -- preferred over Array.isArray-only narrowing when the historical writer produced an object map and a future writer might produce an array"
    - "Static-analysis storage-shape regression coverage: extract the renderer body via brace-walk, then string-search for Object.values( and Array.isArray( presence plus a literal absence check on the buggy old branch -- avoids jsdom dependency entirely while still catching reverts"
    - "Frontmatter overrides[] formalization: gap-status flip from failed to overridden requires (a) top-level overrides_applied counter increment, (b) per-entry rationale + decision_ref + confirmed_by audit trail, (c) gap entry status field flipped while truth/reason/artifacts/missing arrays preserved verbatim for audit"

key-files:
  created:
    - .planning/phases/212-background-agents-sunset/212-04-SUMMARY.md
  modified:
    - ui/options.js
    - tests/agent-sunset-control-panel.test.js
    - .planning/phases/212-background-agents-sunset/212-VERIFICATION.md

key-decisions:
  - "Worktree path resolution: the worktree did not have 212-VERIFICATION.md committed at HEAD (it lived only in the main repo working tree, written by the orchestrator). Copied the main-repo file into the worktree directly so the Edit tool could apply the three string-anchored frontmatter mutations under the worktree git tree. Final commit used git add -f because .planning/ is gitignored on the worktree (and confirmed prior phases (212-01 / 212-03 SUMMARY commits) used the same -f pattern -- see ls-tree HEAD output showing all .planning files are present in tree despite the .gitignore rule)."
  - "The acceptance criterion 'grep -c Array.isArray(raw) >= 1' was met with count=1 (the new defensive branch). The criterion 'grep -c Array.isArray(stored.bgAgents) == 0' was met with count=0 (old buggy literal removed). The full coercion landed verbatim per the plan's drafted patch -- no inline tweaks required."
  - "navigator.clipboard.writeText in ui/options.js: count=1 at line 4804, but this is the pre-existing copyHashKey() function (Server Sync hash key copy), present at HEAD before this plan ran. It is NOT in initializeBackgroundAgentsDeprecation. D-11 forbids clipboard in the SUNSET NOTICE specifically; the Server Sync card's clipboard usage is in Region 2 of initializeAgentSection (LIVE for Phase 213) and is out of scope. Confirmed via git show HEAD:ui/options.js | grep -c writeText returning 1 before the patch."
  - "Acceptance criterion 'grep -c overrides:$ == 1' was met with count=2 because the body of 212-VERIFICATION.md (line 188) contains an example yaml block with the same pattern (in the verifier's pre-existing Recommendation section). This is documentation, not frontmatter; the FRONTMATTER overrides: block is exactly 1. Treated as a benign criterion mismatch -- the intent (overrides block exists in frontmatter) is satisfied."

requirements-completed: [AGENTS-03]
# AGENTS-03 status flips from PARTIAL/BLOCKED to SATISFIED via Gap 1 fix (Tasks 1+2) + Gap 2 override (Task 3)

# Metrics
duration: ~30min
completed: 2026-04-29
---

# Phase 212 Plan 04: Background Agents Sunset Gap-Closure Summary

**Closed both gaps in 212-VERIFICATION.md against AGENTS-03 / ROADMAP SC #3 with one coercion patch, one extended test section, and one frontmatter override -- the sunset notice now unhides correctly on real upgrade profiles (object-map bgAgents shape, the only shape that ever existed in the wild) AND the D-11 clipboard-export deviation is now formally accepted in the verification frontmatter so the next verifier run returns a clean 6/6.**

## Decision Coverage

- **AGENTS-03 (was PARTIAL/BLOCKED, now SATISFIED):** Gap 1 (WR-01) closed by Task 1 + Task 2 -- the storage-shape coercion in `ui/options.js:4191` now handles BOTH the canonical legacy object-map shape (`Object.values(raw)`) AND a defensive array shape (`Array.isArray(raw)`); Section 7 of `tests/agent-sunset-control-panel.test.js` enforces both branches and guards against revert. Gap 2 (ROADMAP SC #3 clipboard requirement) closed by Task 3 -- the deviation from ROADMAP SC #3 is now formally accepted in `212-VERIFICATION.md` frontmatter via an `overrides:` array entry referencing `CONTEXT.md D-11` (locked decision) and `PITFALLS.md P11` (privacy posture).
- **ROADMAP Phase 212 SC #3:** Formally deviated per `CONTEXT.md D-11`. The decision_ref + confirmed_by audit trail is intact. The verifier on its next run will observe Gap 2 overridden and Gap 1 resolved -> 6/6 -> top-level `status:` flips from `gaps_found` to `verified`.

## Exact Diff Applied to `ui/options.js`

The single 1-line replacement at line 4191 expanded to 8 new lines (5 comment lines + 3 code lines) preserving every downstream invariant:

```diff
 chrome.storage.local.get(['bgAgents', 'fsb_sunset_notice_dismissed'], function (stored) {
   const dismissed = stored && stored.fsb_sunset_notice_dismissed === true;
-  const agents = (stored && Array.isArray(stored.bgAgents)) ? stored.bgAgents : [];
+  // Phase 212-04 (gap-closure / WR-01): bgAgents was historically written as an object map
+  // keyed by agentId (agents/agent-manager.js:86-91 -- the only writer that ever ran).
+  // Array.isArray({}) returns false, which suppressed the notice on the only profiles
+  // that matter. Accept both shapes defensively: array as-is, object map -> Object.values,
+  // anything else -> empty array.
+  const raw = stored && stored.bgAgents;
+  const agents = Array.isArray(raw)
+    ? raw
+    : (raw && typeof raw === 'object' ? Object.values(raw) : []);
   if (dismissed) return;        // D-09: never re-render after dismiss
   if (agents.length === 0) return; // D-10: skip entirely if no agents ever existed
```

The downstream `if (dismissed) return;` D-09 early-out, the `if (agents.length === 0) return;` D-10 early-out, the `while (namesList.firstChild) ... removeChild` cleanup, and the `for (let i = 0; i < agents.length; i++) ... li.textContent = name` rendering loop all remain unchanged. The T-01 XSS mitigation (`li.textContent = name` -- never `innerHTML`) is preserved verbatim.

## Exact `overrides:` YAML Block as Landed

```yaml
overrides_applied: 1
overrides:
  - gap_index: 2
    truth: "Sunset notice provides copy-to-clipboard export of agent names (ROADMAP SC #3 explicit text)"
    status: overridden
    rationale: |
      CONTEXT.md decision D-11 deliberately removed clipboard / download / copy-to-clipboard
      affordances from the sunset notice. The names list is an assurance affordance only
      ("your work isn't lost"), not a migration path -- OpenClaw and Claude Routines have
      their own onboarding flows. Per PITFALLS.md P11, surfacing only the agent NAMES
      (no task text, no schedule, no run history) avoids leaking credentials or sensitive
      prompt content; adding a clipboard export of the same names would not breach this
      posture but would conflict with the explicit "no clipboard" decision recorded in D-11.
      Phase 212-04 formalizes the deviation rather than re-adding the CTA.
    decision_ref: "CONTEXT.md D-11 (locked); ROADMAP.md Phase 212 SC #3 (overridden)"
    confirmed_by: "user via /gsd-plan-phase 212 --gaps interactive question (2026-04-29)"
```

The gap-2 entry below in `gaps:` had its `status` field flipped from `failed` to `overridden`; the `truth`, `reason`, `artifacts`, and `missing` arrays remain so the audit trail is intact. The top-level `score:` field was bumped from `5/6 must-haves verified` to `6/6 must-haves verified`. The top-level `status:` field stays at `gaps_found` -- only the verifier re-run flips that to `verified`, per the verifier contract; this plan does NOT pre-emptively touch top-level status.

## D-11 Honored: No Clipboard CTA Added

Confirmed by file inspection:

```
/usr/bin/grep -nE "navigator\.clipboard|writeText" ui/options.js
4804:    await navigator.clipboard.writeText(key);
```

The single hit at line 4804 is in the pre-existing `copyHashKey()` function (Server Sync hash-key copy in Region 2 of `initializeAgentSection`) -- it was present at HEAD before this plan ran (`git show HEAD:ui/options.js | grep -c writeText` returned 1 pre-edit) and is LIVE for Phase 213 relocation. It is NOT inside `initializeBackgroundAgentsDeprecation()` and is unrelated to D-11 (which forbids clipboard in the SUNSET NOTICE specifically). The deprecation rendering function continues to have zero clipboard surface.

## T-01 XSS Mitigation Continues to Hold

Section 6 of `tests/agent-sunset-control-panel.test.js` (T-01) PASSES on the new function body:

```
PASS - T-01 agent names rendered via textContent; no innerHTML assignment in initializeBackgroundAgentsDeprecation
```

The new Section 7 also reads the function body and would catch any accidental introduction of `innerHTML =` -- so T-01 has redundant coverage. `grep -cE "li\\.innerHTML\\s*=" ui/options.js` returns 0 lines. The patch only changed how `agents` is built from `stored.bgAgents`; the rendering loop is unchanged.

## D-15 Invariant Continues to Hold

All 5 LIVE Server Sync `getElementById` call sites confirmed present in `ui/options.js`:

```
btnPairDashboard:    1 LIVE
btnGenerateHashKey:  1 LIVE
btnCopyHashKey:      1 LIVE
btnTestConnection:   1 LIVE
btnCancelPairing:    1 LIVE
```

Section 4 of `tests/agent-sunset-control-panel.test.js` PASSES, confirming Phase 213 relocation remains unblocked. The patch did NOT touch lines 4189-4205 (the Server Sync wiring region) -- it only touched line 4191's storage coercion which lives inside the sunset-notice rendering callback above the Region 2 wiring.

## Test Results

`tests/agent-sunset-control-panel.test.js` -- 10/10 PASS lines, exit 0:

```
PASS - AGENTS-01 deprecation card present (CTAs + footer; rel=noopener noreferrer count=2)
PASS - No emojis in modified UI files (CLAUDE.md rule honored)
PASS - AGENTS-02 ui/options.js annotation count >= 11 (got 15)
PASS - AGENTS-02 ui/sidepanel.js annotation count >= 2 (got 6)
PASS - AGENTS-02 ui/popup.js annotation count >= 2 (got 6)
PASS - AGENTS-02 ui/options.css annotation count >= 1 (got 1)
PASS - D-15 Server Sync + pairing wiring preserved LIVE for Phase 213 relocation
PASS - AGENTS-03 names list scaffolding + rendering function present and called
PASS - T-01 agent names rendered via textContent; no innerHTML assignment in initializeBackgroundAgentsDeprecation
PASS - Gap1 / WR-01 storage-shape coercion handles object-map (Object.values) AND array (Array.isArray) shapes; old single-branch literal removed
```

Cross-phase regression chain (all exit 0):

| Test                                       | Phase  | Status |
| ------------------------------------------ | ------ | ------ |
| `tests/agent-sunset-back-end.test.js`      | 212-01 | PASS   |
| `tests/agent-sunset-control-panel.test.js` | 212-02 | PASS (10/10 with new Section 7) |
| `tests/agent-sunset-showcase.test.js`      | 212-03 | PASS   |
| `tests/qr-pairing.test.js`                 | 210    | PASS   |
| `tests/dom-stream-perf.test.js`            | 211-02 | PASS   |
| `tests/dashboard-runtime-state.test.js`    | 209    | PASS   |
| `tests/ws-client-decompress.test.js`       | 211-01 | PASS   |
| `tests/redact-for-log.test.js`             | 211-03 | PASS   |
| `tests/diagnostics-ring-buffer.test.js`    | 211-03 | PASS   |

`node --check ui/options.js` -- exits 0 (file still parses).

## Files Modified Count

- **3 source files modified, 0 new source files:**
  - `ui/options.js` (1-line replacement -> 9-line replacement at line 4191)
  - `tests/agent-sunset-control-panel.test.js` (Section 7 inserted before `// ---- Result ----`; 27 new lines)
  - `.planning/phases/212-background-agents-sunset/212-VERIFICATION.md` (frontmatter `overrides:` block added; gap-2 status flipped; score advanced)
- **1 new file artifact:** this SUMMARY.md.

## Task Commits

Each task committed atomically with `--no-verify` (parallel mode):

1. **Task 1 (`6270672`):** `fix(212-04): accept both array and object-map shapes for bgAgents in sunset notice renderer (Gap 1 / WR-01 / AGENTS-03)`
2. **Task 2 (`31fd469`):** `test(212-04): extend agent-sunset-control-panel Section 7 to cover bgAgents storage-shape coercion (Gap 1 / WR-01 regression coverage)`
3. **Task 3 (`12bbf99`):** `docs(212-04): add overrides: block to 212-VERIFICATION.md formalizing D-11 deviation from ROADMAP SC #3 (Gap 2 / clipboard); flip gap-2 status to overridden; advance score to 6/6`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base + worktree-vs-main-repo file path resolution**

- **Found during:** Task 1 setup -- the worktree's HEAD was 32 commits behind the expected base (`fdce48f`). The worktree was a previously-locked agent worktree that had not been advanced to the latest milestone state.
- **Issue:** `git merge-base HEAD fdce48f` returned my old HEAD (`3abb9c2`), confirming the expected base was AHEAD of mine, not behind. Additionally, the orchestrator-written planning files (`212-VERIFICATION.md`, `212-04-PLAN.md`, `212-REVIEW.md`) lived only in the main repo working tree, not in the worktree.
- **Fix (base):** `git reset --hard fdce48f152071820918f134aa0fa847951b71a18` -- this is a forward-only fast-forward (the expected base is a descendant of my HEAD), zero risk of work loss because the worktree had no uncommitted changes. Re-verified `git merge-base HEAD fdce48f` returned the expected base. Reset is safe in this case (no destructive intent; simply advancing to the expected base).
- **Fix (planning files):** Copied `212-VERIFICATION.md` from `/Users/lakshmanturlapati/Desktop/FSB/.planning/...` (main repo) to `.claude/worktrees/agent-a89dd751/.planning/...` (worktree). This was required because the Task 3 commit had to land in the worktree's git tree. Used `git add -f` because `.planning/` is gitignored (matching the prior 212-01 / 212-03 SUMMARY commit pattern, where `git ls-tree HEAD .planning/` shows `.planning/*` files DO live in the tree despite the gitignore -- they are tracked from before the rule was added).
- **Files modified:** none beyond the planned scope; the fix was operational (git reset + cp), not a code change.
- **Committed in:** N/A (no separate commit needed; the fix enabled all three planned commits).

**2. [Rule 3 - Blocking] Edit tool routed initial Task 1 patch to main repo path instead of worktree**

- **Found during:** Task 1 verification step -- `node --check` and `Read` reported the patch applied successfully, but direct `sed` / `md5` / `wc -l` on `ui/options.js` (relative path under the worktree) showed the OLD content. Investigation via `find` revealed that the absolute path I had passed to `Edit` (`/Users/lakshmanturlapati/Desktop/FSB/ui/options.js`) resolved to the MAIN repo, not the worktree (`/Users/lakshmanturlapati/Desktop/FSB/.claude/worktrees/agent-a89dd751/ui/options.js`).
- **Issue:** Tool-routing mismatch caused by the absolute path I supplied; the Read tool was returning a stale/cached view of the main-repo file (where the edit DID land), while Bash was reading the worktree file (where the edit had NOT landed). MD5 mismatch (`7cf2d7...` vs `cda0a9...`) confirmed the divergence.
- **Fix:** `git -C /Users/lakshmanturlapati/Desktop/FSB checkout -- ui/options.js` (restored main repo file from HEAD), then re-applied the Edit using the explicit worktree absolute path `/Users/lakshmanturlapati/Desktop/FSB/.claude/worktrees/agent-a89dd751/ui/options.js`. After the second edit, `md5` showed `7cf2d7...` on BOTH files (worktree successfully patched; main repo at HEAD). All subsequent Task 1 / 2 / 3 edits used explicit worktree paths.
- **Files modified:** worktree `ui/options.js` (intended target); main repo `ui/options.js` was incorrectly written then restored to HEAD (no net change).
- **Committed in:** Task 1 commit (`6270672`) -- the final patch landed correctly in the worktree git tree.

**3. [Info - benign criterion mismatch] grep -c "^overrides:$" returned 2 instead of 1**

- **Found during:** Task 3 verification.
- **Issue:** The plan's acceptance criterion expected exactly 1 occurrence of `^overrides:$` in `212-VERIFICATION.md`, but grep returned 2. Investigation showed the second occurrence is on line 188 inside a Markdown code-block in the body's pre-existing "Recommendation" section -- the verifier's own example yaml showing what an override should look like.
- **Decision:** No fix applied. The intent of the criterion (frontmatter overrides block exists exactly once) is met -- the body's example yaml is documentation in a fenced code block and is not part of the YAML frontmatter. Per the SCOPE BOUNDARY rule, I do not modify pre-existing body content unrelated to my task. Documenting the deviation here for the verifier's awareness on re-run.
- **Files modified:** none.

---

**Total deviations:** 3 -- two operational/blocking (worktree base + tool path routing) and one benign criterion mismatch (pre-existing body content). No scope creep; no new code introduced beyond the planned 1+1+1 task surface.
**Impact on plan:** All 14 acceptance criteria across the three tasks pass when the operational issues are accounted for. The frontmatter is structurally valid YAML (verified by the plan's automated Step E node script).

## Issues Encountered

- **Hook reminder noise:** The `PreToolUse:Edit hook additional context: READ-BEFORE-EDIT REMINDER...` system reminder fired multiple times even AFTER the file had been Read in this session. Each Edit still landed successfully (verified by Bash md5 / sed inspection). The reminder appears to be advisory rather than rejecting; behavior was: Edit succeeded -> system reminder appeared -> verification confirmed success.
- **No regression of any cross-phase contract:** All 9 regression tests (Phase 209 / 210 / 211-01 / 211-02 / 211-03 / 212-01 / 212-02 / 212-03) continue to exit 0. Phase 213's Server Sync hand-off is unaffected.

## User Setup Required

None. The patch is entirely client-side and the override is a documentation/frontmatter change. No environment variables, no manifest changes, no installer changes. Pre-existing `chrome.storage.local['bgAgents']` is preserved by Phase 212-01 and now correctly read by the patched function.

## Re-Verification Recommendation

The verifier should re-run on Phase 212. On observing Gap 1 resolved (Tasks 1+2 deliver the storage-shape fix + regression coverage) and Gap 2 overridden (Task 3 delivers the formal frontmatter override), the verifier will rewrite the top-level `status:` field from `gaps_found` to `verified` and confirm the score is 6/6. After re-verification, AGENTS-03 truth #3 in the verifier's "Goal Achievement" table flips from FAILED to VERIFIED.

## Next Phase Readiness

- **Phase 213 (Sync tab build) ready:** D-15 invariant intact; the 5 LIVE Server Sync `getElementById` calls + `pairingQROverlay` are untouched.
- **No blockers, no open questions.**

---
*Phase: 212-background-agents-sunset*
*Plan: 04 (Gap Closure: WR-01 Coercion Fix + ROADMAP SC #3 Override)*
*Completed: 2026-04-29*

## Self-Check: PASSED

All claimed files exist on disk:
- `ui/options.js` (modified) -- FOUND
- `tests/agent-sunset-control-panel.test.js` (modified) -- FOUND
- `.planning/phases/212-background-agents-sunset/212-VERIFICATION.md` (modified) -- FOUND
- `.planning/phases/212-background-agents-sunset/212-04-SUMMARY.md` (this file, created) -- FOUND

All claimed commits exist in git history:
- `6270672` (Task 1: fix(212-04): accept both array and object-map shapes for bgAgents) -- FOUND
- `31fd469` (Task 2: test(212-04): extend agent-sunset-control-panel Section 7) -- FOUND
- `12bbf99` (Task 3: docs(212-04): add overrides: block to 212-VERIFICATION.md) -- FOUND

All plan-level verification steps pass:
- `node --check ui/options.js` -- exit 0
- `node tests/agent-sunset-control-panel.test.js` -- exit 0 with 10/10 PASS lines (existing 9 + new Section 7)
- `node tests/agent-sunset-back-end.test.js` -- exit 0 (Phase 212-01 regression)
- `node tests/agent-sunset-showcase.test.js` -- exit 0 (Phase 212-03 regression)
- `node tests/qr-pairing.test.js` -- exit 0 (Phase 210 regression -- D-15 invariant)
- `node tests/dom-stream-perf.test.js` -- exit 0 (Phase 211-02 regression)
- `node tests/dashboard-runtime-state.test.js` -- exit 0 (Phase 209 regression)
- `node tests/ws-client-decompress.test.js` -- exit 0 (Phase 211-01 regression)
- `node tests/redact-for-log.test.js` -- exit 0 (Phase 211-03 regression)
- `node tests/diagnostics-ring-buffer.test.js` -- exit 0 (Phase 211-03 regression)
- `grep -cF "Object.values(raw)" ui/options.js` -- 1 (object-map branch present)
- `grep -cF "Array.isArray(raw)" ui/options.js` -- 1 (defensive array branch present)
- `grep -cF "Array.isArray(stored.bgAgents)" ui/options.js` -- 0 (old buggy branch removed)
- `grep -cF "li.textContent = name" ui/options.js` -- 1 (T-01 mitigation preserved)
- `grep -cE "li\.innerHTML\s*=" ui/options.js` -- 0 (T-01 invariant)
- `grep -c "Section 7" tests/agent-sunset-control-panel.test.js` -- 1
- `grep -c "handlesObjectMap" tests/agent-sunset-control-panel.test.js` -- 3
- `grep -c "handlesArray" tests/agent-sunset-control-panel.test.js` -- 3
- `grep -c "hasBuggyOldBranch" tests/agent-sunset-control-panel.test.js` -- 3
- `grep -c "^overrides_applied: 1$" 212-VERIFICATION.md` -- 1
- `grep -c "score: 6/6 must-haves verified" 212-VERIFICATION.md` -- 1
- `grep -c "score: 5/6 must-haves verified" 212-VERIFICATION.md` -- 0
- `grep -c "decision_ref:" 212-VERIFICATION.md` -- 1
- `grep -c "CONTEXT.md D-11" 212-VERIFICATION.md` -- 1
- `grep -c "confirmed_by:" 212-VERIFICATION.md` -- 1
- 4-byte UTF-8 codepoints (emoji proxy) in all three modified files -- 0 (CLAUDE.md no-emojis rule honored)

Note: The acceptance criterion `grep -c "^overrides:$" 212-VERIFICATION.md == 1` reports 2 because the body of the file (line 188) contains an example yaml block in the verifier's pre-existing Recommendation section. The frontmatter `overrides:` key is unique. Documented under Deviations.
