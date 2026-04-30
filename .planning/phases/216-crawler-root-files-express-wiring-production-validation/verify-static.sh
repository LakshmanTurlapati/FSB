#!/usr/bin/env bash
# Phase 216 Plan 01 verifier: CRAWL-01 robots.txt, CRAWL-03 llms.txt,
# CRAWL-04 llms-full.source.md content assertions.
# Run from repo root.
set -euo pipefail

ROBOTS="showcase/angular/public/robots.txt"
LLMS="showcase/angular/public/llms.txt"
LLMS_FULL_SRC="showcase/angular/scripts/llms-full.source.md"

ascii_only() {
  # Portable ASCII-only check (BSD grep on macOS lacks -P).
  # Print any line that contains a byte outside printable ASCII + whitespace; if grep matches, fail.
  if LC_ALL=C grep -q '[^[:print:][:space:]]' "$1"; then
    echo "[216] ASCII-only assertion FAILED for: $1"
    LC_ALL=C grep -n '[^[:print:][:space:]]' "$1" || true
    exit 1
  fi
}

echo "[216] CHECK: source files exist"
test -f "$ROBOTS"
test -f "$LLMS"
test -f "$LLMS_FULL_SRC"

echo "[216] CHECK: CRAWL-01-A robots.txt has all 15 named User-agent blocks"
for ua in GPTBot ChatGPT-User OAI-SearchBot ClaudeBot Claude-User Claude-SearchBot \
          PerplexityBot Perplexity-User Google-Extended Applebot-Extended \
          Amazonbot Bytespider CCBot Meta-ExternalAgent DuckAssistBot; do
  if ! grep -q "^User-agent: $ua\$" "$ROBOTS"; then
    echo "[216] MISSING bot: $ua"
    exit 1
  fi
done

echo "[216] CHECK: CRAWL-01-B robots.txt has wildcard + Sitemap directive"
grep -q '^User-agent: \*$' "$ROBOTS"
grep -q '^Sitemap: https://full-selfbrowsing\.com/sitemap\.xml$' "$ROBOTS"

echo "[216] CHECK: CRAWL-01-C robots.txt User-agent block count = 16"
ua_count=$(grep -c '^User-agent:' "$ROBOTS")
if [ "$ua_count" -ne 16 ]; then
  echo "[216] expected 16 User-agent blocks, got $ua_count"
  exit 1
fi

echo "[216] CHECK: CRAWL-03-A llms.txt H1"
first_line=$(head -1 "$LLMS")
if [ "$first_line" != "# FSB (Full Self-Browsing)" ]; then
  echo "[216] llms.txt H1 mismatch: '$first_line'"
  exit 1
fi

echo "[216] CHECK: CRAWL-03-B llms.txt verbatim D-01 closing fragment"
grep -q 'MIT-licensed, BYO API key\.' "$LLMS"

echo "[216] CHECK: CRAWL-03-C llms.txt Docs section + 5 link entries"
grep -q '^## Docs$' "$LLMS"
link_count=$(grep -c '^- \[' "$LLMS")
if [ "$link_count" -ne 5 ]; then
  echo "[216] expected 5 Docs links, got $link_count"
  exit 1
fi

echo "[216] CHECK: CRAWL-04-source-A llms-full.source.md six numbered sections in order"
grep -q '^# FSB (Full Self-Browsing)$' "$LLMS_FULL_SRC"
grep -q '^## 1\. Project Description$' "$LLMS_FULL_SRC"
grep -q '^## 2\. Capabilities$' "$LLMS_FULL_SRC"
grep -q '^## 3\. Install Instructions$' "$LLMS_FULL_SRC"
grep -q '^## 4\. Key Concepts$' "$LLMS_FULL_SRC"
grep -q '^## 5\. Comparison$' "$LLMS_FULL_SRC"
grep -q '^## 6\. Links$' "$LLMS_FULL_SRC"

echo "[216] CHECK: CRAWL-04-source-B llms-full.source.md size < 256000 bytes"
size=$(wc -c < "$LLMS_FULL_SRC")
if [ "$size" -ge 256000 ]; then
  echo "[216] llms-full.source.md too large: $size bytes (limit 256000)"
  exit 1
fi

echo "[216] CHECK: CRAWL-04-source-C comparison names Browser Use, Project Mariner, Operator"
grep -q 'Browser Use' "$LLMS_FULL_SRC"
grep -q 'Project Mariner' "$LLMS_FULL_SRC"
grep -q 'Operator' "$LLMS_FULL_SRC"

echo "[216] CHECK: ASCII-only on all three source files"
ascii_only "$ROBOTS"
ascii_only "$LLMS"
ascii_only "$LLMS_FULL_SRC"

echo "[216] verify-static.sh: CRAWL-01, CRAWL-03 source ALL PASSED"
