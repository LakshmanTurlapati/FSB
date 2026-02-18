---
status: resolved
trigger: "The automation's completion validator overrides the AI's taskComplete=true signal. The AI correctly identifies the task as done but the validator rejects it with a low score, causing the automation to continue running indefinitely."
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: classifyTask unit tests pass 11/11. Syntax checks pass. Score replay shows 0.85 (approved) vs old 0.30 (rejected).
expecting: Automation will stop on first AI taskComplete=true with empty actions for multitab tasks.
next_action: Archive session.

## Symptoms

expected: When the AI sets taskComplete=true and has no more actions, the automation should stop and report success to the user.
actual: The completion validator rejects taskComplete=true with scores as low as 0.30. The automation keeps running for 12 iterations even though the AI said "complete" 3 separate times (iterations 6, 8, and 9). Eventually times out.
errors: Completion validation result: score 0.30, approved: false. Evidence: ["AI: task complete", "Page: stable"]. Task incorrectly classified as "messaging" instead of "multitab".
reproduction: Task "check elon's latest post and summarize it in google doc" -- after successfully typing into Google Docs, the AI says complete but the validator keeps rejecting.
timeline: Systemic issue with completion validation logic.

## Eliminated

(No hypotheses were eliminated -- first hypothesis was confirmed directly.)

## Evidence

- timestamp: 2026-02-17T00:00:30Z
  checked: classifyTask() in background.js (line 3022-3044)
  found: Returns only 8 types (email, messaging, form, shopping, career, search, extraction, navigation, general). NO multitab, gaming types. The word "post" in task matches /message|send|text|chat|reply|comment|dm\b|post/ -> returns "messaging"
  implication: Task is misclassified as "messaging" instead of "multitab"

- timestamp: 2026-02-17T00:00:35Z
  checked: detectTaskType() in ai-integration.js (line 3822-3940)
  found: Has full multitab detection with outputDestinations and gatherActions. Would correctly classify "check elon's latest post and summarize it in google doc" as multitab.
  implication: The two classifiers are out of sync -- ai-integration knows multitab, background.js does not.

- timestamp: 2026-02-17T00:00:40Z
  checked: computeCompletionScore() (line 3273-3315)
  found: Weights: URL(0.3), DOM(0.25), AI(0.2), ActionChain(0.15), PageStable(0.1). Threshold is 0.50. For this task: URL=0, DOM=0, AI=0.20, ActionChain=0 (messaging checks for send/submit click), PageStable=0.10. Total = 0.30.
  implication: Score of 0.30 exactly matches the log. The 0.50 threshold requires multiple signals but multitab tasks have no URL/DOM signals in Google Docs.

- timestamp: 2026-02-17T00:00:45Z
  checked: checkActionChainComplete() for messaging (line 3180-3186)
  found: Messaging check requires clicking a send/submit/post/reply button. Google Docs typing has none of these.
  implication: actionChainComplete=false because wrong task type's chain is evaluated

- timestamp: 2026-02-17T00:00:50Z
  checked: Validator dispatch map (line 3420-3431)
  found: No multitab validator exists. multitab falls through to generalValidator which has no bonuses.
  implication: Even if classifyTask returned multitab, there would be no validator for it

- timestamp: 2026-02-17T00:01:00Z
  checked: outputDestinations keyword matching
  found: Arrays used plural "google docs" but user task had singular "google doc". String.includes() with "google docs" would NOT match "google doc" (shorter string). Needed singular forms so "google doc" matches both "google doc" and "google docs".
  implication: Additional bug in both classifiers (background.js AND ai-integration.js) -- singular task phrasing would bypass multitab detection.

- timestamp: 2026-02-17T00:01:30Z
  checked: session.urlHistory structure
  found: Entries are objects { url, timestamp, iteration }, not plain strings. Needed .map(e => e.url) to extract URLs.
  implication: Initial multitab validator code would have failed to count unique hosts without this fix.

- timestamp: 2026-02-17T00:02:00Z
  checked: Unit tests for classifyTask (11 scenarios)
  found: All 11 pass including the critical "check elons latest post and summarize it in google doc" -> "multitab"
  implication: Fix verified at the classification level.

## Resolution

root_cause: |
  THREE ISSUES converging:
  1. classifyTask() in background.js (completion validation's classifier) was out of sync with detectTaskType() in ai-integration.js. It lacked multitab detection entirely, and "post" in the task text triggered the /post/ regex in the messaging pattern, returning "messaging" instead of "multitab".
  2. No multitab validator existed in the validator dispatch map, so even correct classification would fall through to generalValidator with no bonuses.
  3. For cross-site workflows (navigate site A -> extract -> navigate site B -> type), neither URL patterns, DOM success signals, nor action chain patterns triggered because: (a) Google Docs URLs do not match success patterns, (b) Google Docs does not emit success toast/confirmation for typing, (c) messaging action chain checks for send/submit button clicks.
  BONUS: outputDestinations arrays used plural forms ("google docs") that would not match singular user phrasing ("google doc").
  Result: Only AI self-report (0.20) and page stability (0.10) fired, giving 0.30 < 0.50 threshold -> rejected.

fix: |
  1. Added multitab and gaming detection to classifyTask() in background.js, placed BEFORE messaging regex to prevent "post" from matching messaging first. Ported cross-site detection logic from detectTaskType().
  2. Added multitabValidator with bonuses for cross-site navigation (2+ unique hosts) and extract+write patterns (getText + type actions).
  3. Added multitab case to checkActionChainComplete() checking for 2+ unique hosts + data actions.
  4. Added AI "no remaining actions" boost (+0.15) to computeCompletionScore() when AI says taskComplete=true with empty actions array.
  5. Added multitab and gaming entries to validator dispatch map.
  6. Fixed outputDestinations to use singular forms ("google doc" not "google docs") so String.includes() matches both singular and plural. Applied in background.js AND ai-integration.js.
  7. Fixed urlHistory access to extract .url from objects instead of treating entries as strings.

  Post-fix score replay for the failing scenario:
  - AI report: 0.20 + AI empty actions boost: 0.15 + Action chain (multitab): 0.15 + Page stable: 0.10 = 0.60 base
  - multitabValidator bonus: cross-site +0.15, extract+write +0.10 = 0.85 final
  - 0.85 >= 0.50 -> APPROVED

verification: |
  - Syntax check: both background.js and ai-integration.js pass node -c
  - Unit tests: 11/11 classifyTask scenarios pass
  - Score replay: original 0.30 -> fixed 0.85 for the failing task
  - Regression: messaging ("post a comment on reddit") still classified as messaging
  - Regression: extraction ("check the price of Bitcoin") still classified as extraction

files_changed: [background.js, ai/ai-integration.js]
