#!/usr/bin/env bash
# Phase 216 umbrella verifier - sources every available sub-script.
# Safe to run after Plan 01 alone (only verify-static.sh exists);
# verify-prebuild.sh, verify-server.sh, verify-smoke.sh, verify-uat.sh
# are added by Plans 02-05.
set -euo pipefail

PHASE_DIR=".planning/phases/216-crawler-root-files-express-wiring-production-validation"

echo "[216 umbrella] running available sub-verifiers"

# Static (Plan 01): required.
bash "$PHASE_DIR/verify-static.sh"

# Prebuild (Plan 02): created later. Skip silently until present.
if [ -f "$PHASE_DIR/verify-prebuild.sh" ]; then
  bash "$PHASE_DIR/verify-prebuild.sh"
else
  echo "[216 umbrella] verify-prebuild.sh not present yet (Plan 02 creates it) - skipping"
fi

# Server (Plan 03): created later. Skip silently until present.
if [ -f "$PHASE_DIR/verify-server.sh" ]; then
  bash "$PHASE_DIR/verify-server.sh"
else
  echo "[216 umbrella] verify-server.sh not present yet (Plan 03 creates it) - skipping"
fi

# Smoke (Plan 04): created later. Skip silently until present.
if [ -f "$PHASE_DIR/verify-smoke.sh" ]; then
  bash "$PHASE_DIR/verify-smoke.sh"
else
  echo "[216 umbrella] verify-smoke.sh not present yet (Plan 04 creates it) - skipping"
fi

# UAT (Plan 05): created later. Skip silently until present.
if [ -f "$PHASE_DIR/verify-uat.sh" ]; then
  bash "$PHASE_DIR/verify-uat.sh"
else
  echo "[216 umbrella] verify-uat.sh not present yet (Plan 05 creates it) - skipping"
fi

echo "[216 umbrella] ALL AVAILABLE ASSERTIONS PASSED"
