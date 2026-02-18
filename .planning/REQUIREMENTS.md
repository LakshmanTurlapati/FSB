# Requirements: v9.0.2 AI Situational Awareness

**Created:** 2026-02-14
**Milestone goal:** Give the AI complete context and the ability to understand what's happening on the page -- see everything, remember what it did, and know when it's done.

## v1 Requirements

### Signal Accuracy (Phase 1)

- [x] **SIG-01**: Fix viewport detection for split-pane layouts (Gmail, LinkedIn, Slack) using overlap-based check with 25% visibility threshold instead of simple bounds check
- [x] **SIG-02**: Eliminate false CAPTCHA detection by requiring visible, interactive, dimension-verified CAPTCHA elements with `data-sitekey` attribute -- drop CSS class-name-only matching
- [x] **SIG-03**: Make `waitForElement` resolve Shadow DOM elements consistently with `click` by using `querySelectorWithShadow()` for both paths

### DOM Serialization Pipeline (Phase 2)

- [x] **DOM-01**: Raise HARD_PROMPT_CAP from 5000 to ~15000 characters with proportional budget allocation (80% elements, 20% HTML context of remaining budget)
- [x] **DOM-02**: Implement priority-aware truncation that never cuts mid-element -- elements are included or excluded whole, with task-relevant elements prioritized
- [x] **DOM-03**: Increase element text truncation limits: 150 chars for list items (contacts, search results), 80 chars for buttons/links, adaptive based on element context
- [x] **DOM-04**: Make element budget dynamic based on page complexity -- simple pages get full coverage, complex pages get higher budget (50-150) with heavier per-element compression

### Change Detection (Phase 3)

- [x] **CHG-01**: Replace coarse `urlPath|title|elementCount|topTypes` DOM hash with multi-signal hash: content sampling, interaction state signatures, and page state flags
- [x] **CHG-02**: Remove viewport-relative position from element fingerprints -- use structural path (`body>main>form>input:nth-of-type(2)`) plus stable attributes (id, data-testid, role, name)
- [x] **CHG-03**: Generate structured change descriptors for the AI: what elements appeared/disappeared/changed, not just boolean `domChanged`
- [x] **CHG-04**: Reduce false stuck detections by using multi-signal change data instead of single hash comparison

### Conversation Memory (Phase 4)

- [x] **MEM-01**: Fix compaction to produce meaningful summaries -- minimum length validation, retry on short output, local extractive fallback when AI compaction fails
- [x] **MEM-02**: Improve sessionMemory extraction from fragile regex to structured action results -- every action recorded with element text, selector, and verification outcome
- [x] **MEM-03**: Add "hard facts" section exempt from compaction: original task goal, critical action outcomes (send/submit/purchase), discovered working selectors
- [x] **MEM-04**: Integrate long-term memory retrieval at session start -- query MemoryManager for domain-specific procedural memories and inject as site knowledge

### Task Completion Verification (Phase 5)

- [x] **CMP-01**: Build task-type-specific completion validators: messaging checks for "sent" confirmation, navigation verifies URL, forms check for success banners
- [x] **CMP-02**: Implement multi-signal completion scoring: URL patterns (0.3), DOM success indicators (0.25), AI self-report (0.2), action chain analysis (0.15), page stability (0.1)
- [x] **CMP-03**: Create critical action registry -- irrevocable actions (send, submit, purchase) recorded with verification results, always included in AI prompt, with cooldown preventing re-execution
- [x] **CMP-04**: Add enhanced progress tracking using multi-signal change descriptors to reduce false hard-stop triggers

### Differentiators

- [x] **DIF-01**: Proactive completion signals -- system detects success messages, confirmation pages, form resets, toast notifications and surfaces evidence to AI instead of waiting for AI to notice
- [x] **DIF-02**: Page intent-driven context -- extend existing `inferPageIntent()` to influence DOM serialization strategy and completion detection hints (e.g., `success-confirmation` intent triggers completion candidate check)
- [x] **DIF-03**: Task-adaptive DOM content modes -- send different DOM representations based on current sub-task: text_only for reading/extraction, input_fields for form filling, full for navigation

## v2 Requirements (Deferred to v0.10+)

- **DEFER-01**: Confidence-scored completion with verification actions -- AI reports confidence score, system runs verification checks, discrepancy triggers re-check
- **DEFER-02**: Selective vision augmentation -- screenshot capture for pages where DOM text is insufficient (canvas, charts, image galleries)
- **DEFER-03**: Full accessibility tree DOM via CDP -- `chrome.debugger` API for richer tree structure
- **DEFER-04**: Hierarchical change summaries with natural language -- template-based "critical/significant/minor" change descriptions

## Traceability

| Requirement | Phase | Status | Systemic Issue(s) Addressed |
|-------------|-------|--------|-----------------------------|
| SIG-01 | 1: Signal Accuracy | Complete | #7 Off-screen detection broken for split-pane layouts |
| SIG-02 | 1: Signal Accuracy | Complete | #3 False CAPTCHA detection on every LinkedIn page |
| SIG-03 | 1: Signal Accuracy | Complete | #8 waitForElement times out on elements click finds |
| DOM-01 | 2: DOM Serialization | Complete | #4 Prompt truncated to 5K chars (74% DOM lost) |
| DOM-02 | 2: DOM Serialization | Complete | #4 Prompt truncated to 5K chars (74% DOM lost) |
| DOM-03 | 2: DOM Serialization | Complete | #5 Element text truncated to ~50 chars |
| DOM-04 | 2: DOM Serialization | Complete | #4, #5 Context quality |
| DIF-03 | 2: DOM Serialization | Complete | #4 Context optimization |
| CHG-01 | 3: Change Detection | Complete | #2 domHash says "no change" after successful actions |
| CHG-02 | 3: Change Detection | Complete | #2 Hash instability from scroll |
| CHG-03 | 3: Change Detection | Complete | #2 AI lacks awareness of what changed |
| CHG-04 | 3: Change Detection | Complete | #2 False stuck detection |
| MEM-01 | 4: Memory | Complete | #6 Conversation history compacted to 27 chars |
| MEM-02 | 4: Memory | Complete | #6 AI loses operational memory |
| MEM-03 | 4: Memory | Complete | #9 No verification pattern between type and send |
| MEM-04 | 4: Memory | Complete | #10 No navigation strategy hints |
| CMP-01 | 5: Completion | Complete | #1 No task completion detection beyond AI self-report |
| CMP-02 | 5: Completion | Complete | #1 No independent verification |
| CMP-03 | 5: Completion | Complete | #1, #9 Duplicate action prevention |
| CMP-04 | 5: Completion | Complete | #1 False hard stops |
| DIF-01 | 5: Completion | Complete | #1 System-level completion evidence |
| DIF-02 | 5: Completion | Complete | #4, #1 Context optimization |

**Coverage:**
- Systemic issues addressed: 10/10
- v1 requirements: 22 total (19 base + 3 differentiators)
- Phase 1 (Signal Accuracy): 3
- Phase 2 (DOM Serialization): 5 (DOM-01 through DOM-04 + DIF-03)
- Phase 3 (Change Detection): 4
- Phase 4 (Memory): 4
- Phase 5 (Completion): 6 (CMP-01 through CMP-04 + DIF-01 + DIF-02)
- Orphaned: 0

---
*Created: 2026-02-14 from research synthesis*
*Updated: 2026-02-14 -- added Status column and corrected phase counts after roadmap creation*
