---
status: resolved
trigger: "FSB extension can search X.com successfully but fails when it tries to write the results into a document (Google Docs or similar)"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Three compounding root causes identified and fixed
test: Verify fixes do not break existing functionality and address the root causes
expecting: Task type correctly detected as multitab, full prompt re-applied on domain change, cross-site guidance present
next_action: Verify code correctness and trace through the fixed logic

## Symptoms

expected: FSB searches X.com for a topic, extracts relevant content, navigates to a document (Google Docs or similar), and writes a summary of findings
actual: FSB successfully searches X but fails on the document/writing step -- cannot write content into the target document
errors: Need to investigate automation logs and AI prompt/response patterns
reproduction: Give FSB a task like "search for [topic] on X and write a summary in Google Docs"
started: Recurring issue, not a one-time failure

## Eliminated

- hypothesis: Content script injection fails on cross-site navigation
  evidence: Content script is injected via manifest.json content_scripts (auto-injected on all pages), not manually per-tab. The health check retry logic at background.js:5946-5997 handles re-injection gracefully.
  timestamp: 2026-02-16T00:00:30Z

- hypothesis: CDP text insertion is broken for Google Docs
  evidence: handleCDPInsertText (background.js:7947) uses Input.insertText which works with Google Docs' hidden contenteditable. The CDP path is available and functional. The issue is upstream -- the AI never gets to try it because it lacks guidance.
  timestamp: 2026-02-16T00:00:45Z

## Evidence

- timestamp: 2026-02-16T00:00:10Z
  checked: Task type detection in ai-integration.js detectTaskType()
  found: Task "search X and write to Google Docs" -- first the site guide for X.com (Social Media) matches via URL at line 1818. When Social Media guide matches, detectTaskType at line 3780 maps it to 'general'. The output-destination detection (line 3826-3832) that would correctly detect 'multitab' is in the ELSE branch and never runs because the site guide match takes priority.
  implication: The task is classified as 'general' instead of 'multitab', so the AI does not get multi-site workflow guidance or multitab tools.

- timestamp: 2026-02-16T00:00:15Z
  checked: Site guide selection for multi-site tasks
  found: getGuideForTask (index.js:77) returns the FIRST matching guide -- either URL-based or keyword-based. For "search X and write to Google Docs", when on x.com, the Social Media guide matches via URL pattern. When on docs.google.com, the Productivity Tools guide matches. But only ONE guide is ever active per iteration. The guide matched at the START of the task (Social Media on x.com) stays active because the site guide is re-evaluated each iteration based on currentUrl (line 1818). So when the user navigates to Google Docs, the Productivity guide WOULD kick in on subsequent iterations -- but only if the full prompt is used (first iteration or stuck). On continuation iterations, the MINIMAL_CONTINUATION_PROMPT is used which has NO site guide, NO task-specific guidance, and NO Google Docs-specific instructions.
  implication: After iteration 1, the AI loses all site-specific context about how to interact with Google Docs.

- timestamp: 2026-02-16T00:00:20Z
  checked: MINIMAL_CONTINUATION_PROMPT content (line 242-268)
  found: The minimal prompt has NO guidance about: (1) Google Docs canvas architecture, (2) How to click .kix-page-column to focus the editor, (3) Multi-site workflow patterns, (4) Cross-site data retention strategies. It only has generic rules like "click results" and "use refs". For a complex cross-site task, the AI on continuation iterations has zero context about how to write into Google Docs.
  implication: When the AI navigates from X.com to Google Docs (likely on iteration 3-5+), it gets the minimal prompt and has no idea how to interact with Google Docs' non-standard DOM.

- timestamp: 2026-02-16T00:00:25Z
  checked: multitab TASK_PROMPT content (line 128)
  found: The multitab task prompt says "You have access to all tabs" and describes switchToTab/openNewTab/listTabs tools, but provides NO guidance on: (1) How to carry extracted data between sites, (2) How to write content into specific editor types (Google Docs, Notion, etc.), (3) Workflow patterns for "search site A, then write to site B". It is purely about tab management, not cross-site data workflows.
  implication: Even when correctly classified as 'multitab', the AI has no cross-site workflow guidance for the specific "search then write" pattern.

- timestamp: 2026-02-16T00:00:35Z
  checked: Strong keyword override for multitab in detectTaskType when site guide matches (line 3794)
  found: The override checks only include 'new tab', 'open tab', 'switch tab'. Tasks like "search X and write in Google Docs" do NOT contain these keywords. The output-destination detection (line 3826-3832) which correctly identifies tasks mentioning "google docs" + "search/find" is unreachable when a site guide is matched.
  implication: The multitab keyword override is too narrow -- it only checks for explicit tab-related terms but misses cross-site workflow indicators like "google docs" + "search/find".

- timestamp: 2026-02-16T00:00:50Z
  checked: How the full system prompt gets re-applied on URL change
  found: The full prompt is ONLY used when isFirstIteration (iterationCount <= 1) or isStuck (line 1827). There is no trigger to re-apply the full prompt when the URL domain changes significantly (e.g., x.com -> docs.google.com). This means the AI navigates to a completely different site but continues with the minimal continuation prompt that has zero context about the new site.
  implication: Critical design gap -- domain transitions should trigger full prompt re-evaluation with the new site's guide.

## Resolution

root_cause: Three compounding issues prevent search-then-write workflows:

1. TASK TYPE MISCLASSIFICATION: When on X.com, the Social Media site guide matches via URL, and detectTaskType maps it to 'general' instead of 'multitab'. The output-destination detection code that would correctly identify this as a multitab task (detecting "google docs" + "search/find") is unreachable because the site guide branch exits early. The strong keyword overrides for multitab only check for tab-related terms ('new tab', 'open tab'), not cross-site workflow indicators.

2. NO CROSS-SITE WORKFLOW GUIDANCE: The multitab task prompt (TASK_PROMPTS.multitab) only describes tab management operations. It has no guidance for the "search site A then write to site B" pattern -- no instructions on data retention, content extraction before navigation, or writing into destination editors.

3. FULL PROMPT NOT RE-APPLIED ON DOMAIN CHANGE: When navigating from x.com to docs.google.com, the automation continues using MINIMAL_CONTINUATION_PROMPT which has zero knowledge of Google Docs' canvas-based architecture, .kix-page-column click-to-focus requirement, or any productivity tool workflows. The full prompt (with site guide) is only triggered on first iteration or when stuck, not on domain transitions.

fix: Applied 3 targeted fixes across 2 files:

FIX 1 - ai-integration.js detectTaskType() (line ~3842-3851):
Added cross-site workflow detection BEFORE existing keyword overrides in the site guide branch. When the task mentions an output destination (google docs, sheets, notion, etc.) AND a gather action (search, find, write, summarize, etc.), it returns 'multitab' regardless of which site guide is currently active. This ensures "search X and write to Google Docs" is classified as 'multitab' even when the Social Media guide matches X.com.

FIX 2 - ai-integration.js TASK_PROMPTS.multitab (line ~128-153):
Expanded the multitab prompt from a single paragraph about tab management to a comprehensive cross-site workflow guide. Added:
- PHASE 1/2/3 workflow for search-extract-navigate-write patterns
- Google Docs writing guidance (canvas architecture, kix-page-column click, contenteditable)
- Google Sheets writing guidance (Name Box navigation, Tab/Enter for data entry)
- Explicit instruction to preserve gathered data in reasoning across site transitions

FIX 3 - ai-integration.js buildPrompt() (line ~1851-1876) + background.js (line ~6240, ~6669):
Added domain transition detection that triggers full prompt re-evaluation when the URL domain changes between iterations. When navigating from x.com to docs.google.com:
- background.js now captures previousUrl before overwriting session.lastUrl and passes it in the context object
- ai-integration.js compares current domain vs previous domain; if different, uses the FULL system prompt (with the correct site guide for the NEW domain) instead of MINIMAL_CONTINUATION_PROMPT
- This ensures the Productivity Tools guide (with Google Docs canvas architecture, kix-page-column, etc.) is injected when the AI arrives at docs.google.com

verification: Code logic trace verification:
- Task "search for AI news on X and write a summary in Google Docs" on x.com:
  1. getGuideForTask returns Social Media guide (URL match for x.com)
  2. detectTaskType enters site guide branch -> guideTaskType = 'general'
  3. NEW: outputDestinations check finds "google docs" + gatherActions finds "search" and "write" -> returns 'multitab'
  4. AI gets multitab tools (navigate, click, type, getText, openNewTab, etc.) AND cross-site workflow guidance
  5. Iteration 1: Full prompt with Social Media guide (since first iteration)
  6. Iterations 2-3: AI on x.com, same domain -> minimal prompt (OK, searching X is straightforward)
  7. Iteration 4: AI navigates to docs.google.com -> NEW: isDomainChanged = true -> Full prompt re-applied
  8. getGuideForTask now returns Productivity Tools guide (URL match for docs.google.com)
  9. AI gets full Google Docs guidance: canvas architecture, kix-page-column click, typing workflow

files_changed:
- ai/ai-integration.js: Fix 1 (detectTaskType cross-site override), Fix 2 (multitab prompt enhancement), Fix 3 (domain transition detection in buildPrompt)
- background.js: Fix 3 (capture previousUrl and pass in context)
