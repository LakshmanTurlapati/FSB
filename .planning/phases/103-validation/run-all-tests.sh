#!/bin/bash
# Run all 50 validation tests via FSB MCP run_task
# Waits 3 min per test, extracts results, appends to results file

RESULTS_FILE="/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/.planning/phases/103-validation/test-results-v2.csv"
EXTRACT="/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/.planning/phases/103-validation/extract-session.py"
TOOL_RESULTS="/Users/lakshmanturlapati/.claude/projects/-Users-lakshmanturlapati-Documents-Codes-Extensions-FSB/e3d10060-99c4-40a4-b898-da548cf0bdfb/tool-results"

echo "num,req,status,iterations,actions,ok,fail,cost,parse_fails,tools" > "$RESULTS_FILE"

# Results so far (from manual runs)
echo "1,CANVAS-01,PASS,6,16,16,0,0.0137,0,waitForDOMStable:6 cdpClickAt:2 scroll:2" >> "$RESULTS_FILE"
echo "2,CANVAS-02,PASS,9,25,25,0,0.0181,0,keyPress:9 cdpDrag:3 readPage:3" >> "$RESULTS_FILE"
echo "3,CANVAS-03,PASS,4,9,9,0,0.008,0,waitForDOMStable:3 click:2 navigate:1" >> "$RESULTS_FILE"
echo "4,CANVAS-04,FAIL,2,1,1,0,0.0016,0,navigate:1 -- solitaire.google.com error page" >> "$RESULTS_FILE"

echo "Manual results recorded. Remaining tests need to be run via MCP."
