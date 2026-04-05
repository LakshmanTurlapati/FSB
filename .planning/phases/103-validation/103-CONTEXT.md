# Phase 103: Validation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a validation test harness and results template that enables running all 50 v0.9.7 edge case prompts through autopilot mode. The harness extracts prompts from diagnostic reports, provides a structured runner, and tracks pass/fail outcomes + metrics (parse failure rate, completion accuracy). User executes the tests manually in the browser.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure phase building test tooling. Key context:

- 50 diagnostic reports at .planning/phases/{47-96}-*/*-DIAGNOSTIC.md each contain a "Prompt Executed" field and "Requirement" ID
- The prompt needs to be adapted from MCP manual mode to autopilot mode (remove "using MCP manual tools" phrasing)
- Results need to track: pass/fail, CLI parse failures, completion validation accuracy
- The test harness should be a standalone file (not integrated into the extension) that generates a checklist
- Metrics calculation: pass rate (VALID-02), parse failure rate (VALID-03), completion accuracy (VALID-04)
- Requirements: VALID-01 (run all 50), VALID-02 (90%+ pass), VALID-03 (<5% parse failures), VALID-04 (90%+ completion accuracy)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 50 diagnostic reports with structured "Prompt Executed" and "Requirement" fields (phases 47-96)
- Categories: CANVAS-01 to CANVAS-10, MICRO-01 to MICRO-10, SCROLL-01 to SCROLL-10, CONTEXT-01 to CONTEXT-10, DARK-01 to DARK-10
- Each diagnostic has Outcome (PASS/FAIL) from MCP manual mode as baseline

### Integration Points
- Test results stored in .planning/phases/103-validation/ directory
- Metrics feed into milestone completion gate (90%+ pass rate is milestone gate)

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond decisions above

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
