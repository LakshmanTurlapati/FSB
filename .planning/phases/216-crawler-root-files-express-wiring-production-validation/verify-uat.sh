#!/usr/bin/env bash
# Phase 216 Plan 05 verifier: asserts the 216-HUMAN-UAT.md SCAFFOLD exists and
# is structurally complete. Does NOT assert the UAT has been executed -- the
# Status checkboxes remain `[ ] not yet run` until the human operator runs the
# live tests post-deploy and updates the file in place. This verifier exits 0
# with an informational "manual UAT pending" line so it can be chained into
# the umbrella verify.sh without blocking pre-deploy CI.
#
# Covers requirements:
#   - LD-03  (Rich Results Test on home page JSON-LD)
#   - SMOKE-04 (Search Console "Test live URL" on /, /about, /privacy, /support)
# Per CONTEXT.md D-13, both are MANUAL UAT items by design -- they require
# Google account auth + a browser session.

set -euo pipefail

PHASE_DIR=".planning/phases/216-crawler-root-files-express-wiring-production-validation"
F="$PHASE_DIR/216-HUMAN-UAT.md"

echo "[216] verify-uat.sh starting"

# 1. UAT-FILE-EXISTS
if [ ! -f "$F" ]; then
  echo "[216] FAIL: $F not found"
  exit 1
fi
echo "[216] CHECK: 216-HUMAN-UAT.md exists"

# 2. UAT-FRONTMATTER -- status: partial (per 215-HUMAN-UAT.md precedent)
if ! grep -q "^status: partial" "$F"; then
  echo "[216] FAIL: frontmatter missing 'status: partial'"
  exit 1
fi
echo "[216] CHECK: frontmatter status: partial present"

# 3. UAT-TESTS-BLOCK -- 5 entries in the Tests block (### 1.. ### 5.)
TESTS_COUNT=$(grep -c "^### [1-5]\. " "$F" || true)
if [ "$TESTS_COUNT" -ne 5 ]; then
  echo "[216] FAIL: Tests block must have exactly 5 entries (### 1. .. ### 5.); found $TESTS_COUNT"
  exit 1
fi
echo "[216] CHECK: Tests block has 5 entries"

# 4. UAT-COUNT -- exactly 5 detailed second-level UAT headings
UAT_COUNT=$(grep -c "^## UAT-216-" "$F" || true)
if [ "$UAT_COUNT" -ne 5 ]; then
  echo "[216] FAIL: expected 5 detailed '## UAT-216-' sections, found $UAT_COUNT"
  exit 1
fi
echo "[216] CHECK: 5 detailed UAT-216-XX sections present"

# 5. UAT-RICH-RESULTS -- references the Rich Results Test URL
if ! grep -q "search\.google\.com/test/rich-results" "$F"; then
  echo "[216] FAIL: Rich Results Test URL not referenced"
  exit 1
fi
echo "[216] CHECK: Rich Results Test URL referenced"

# 6. UAT-SEARCH-CONSOLE -- references Search Console URL
if ! grep -q "search\.google\.com/search-console" "$F"; then
  echo "[216] FAIL: Search Console URL not referenced"
  exit 1
fi
echo "[216] CHECK: Search Console URL referenced"

# 7. UAT-LD-COVERAGE -- Organization + SoftwareApplication mentioned
if ! grep -q "Organization" "$F"; then
  echo "[216] FAIL: Organization JSON-LD not mentioned"
  exit 1
fi
if ! grep -q "SoftwareApplication" "$F"; then
  echo "[216] FAIL: SoftwareApplication JSON-LD not mentioned"
  exit 1
fi
echo "[216] CHECK: Organization + SoftwareApplication coverage"

# 8. UAT-ASCII -- file is ASCII-only (no emojis per CLAUDE.md). Use perl
# because BSD grep on macOS lacks -P; perl is universally available.
if ! perl -ne 'exit 1 if /[^\x00-\x7F]/' "$F"; then
  echo "[216] FAIL: $F contains non-ASCII characters (emojis or smart-quotes)"
  exit 1
fi
echo "[216] CHECK: ASCII-only"

# 9. UAT-SIGNOFF -- Sign-off footer present
if ! grep -q "^## Sign-off" "$F"; then
  echo "[216] FAIL: Sign-off section missing"
  exit 1
fi
echo "[216] CHECK: Sign-off footer present"

# 10. INFORMATIONAL -- count Status states. The verifier does NOT require
# them to be checked; that is the operator's milestone gate.
NOT_RUN=$(grep -c "Status:\*\* \[ \] not yet run" "$F" || true)
PASSED=$(grep -c "result: \[passed\]" "$F" || true)
echo "[216] INFO: $NOT_RUN entries pending operator execution; $PASSED Tests-block entries marked passed"

echo "[216] verify-uat.sh: LD-03, SMOKE-04 scaffold ALL PRESENT"
echo "[216] verify-uat.sh: manual UAT pending -- operator runs the 5 entries post-deploy"
exit 0
