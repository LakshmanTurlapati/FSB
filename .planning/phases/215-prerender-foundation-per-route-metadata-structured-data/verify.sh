#!/usr/bin/env bash
# Phase 215 umbrella verifier - sources every available sub-script.
# Safe to run after Plan 01 alone (only verify-pre.sh exists);
# verify-meta.sh and verify-ld.sh are added by Plans 02 + 03.
set -euo pipefail

PHASE_DIR=".planning/phases/215-prerender-foundation-per-route-metadata-structured-data"

echo "[215 umbrella] running available sub-verifiers"

# PRE: required (created by Plan 01).
bash "$PHASE_DIR/verify-pre.sh"

# META: created by Plan 02. Skip silently until present.
if [ -f "$PHASE_DIR/verify-meta.sh" ]; then
  bash "$PHASE_DIR/verify-meta.sh"
else
  echo "[215 umbrella] verify-meta.sh not present yet (Plan 02 creates it) - skipping"
fi

# LD: created by Plan 03. Skip silently until present.
if [ -f "$PHASE_DIR/verify-ld.sh" ]; then
  bash "$PHASE_DIR/verify-ld.sh"
else
  echo "[215 umbrella] verify-ld.sh not present yet (Plan 03 creates it) - skipping"
fi

echo "[215 umbrella] ALL AVAILABLE ASSERTIONS PASSED"
