#!/usr/bin/env python3
"""Extract key metrics from an FSB session detail JSON file."""
import json, sys

if len(sys.argv) < 2:
    print("Usage: python3 extract-session.py <session-detail-file>")
    sys.exit(1)

data = json.load(open(sys.argv[1]))
s = json.loads(data[0]['text'])['session']
ah = s.get('actionHistory', [])

from collections import Counter
tools = Counter(a.get('tool', '?') for a in ah)
ok = sum(1 for a in ah if (a.get('result') or {}).get('success'))
fail = sum(1 for a in ah if not (a.get('result') or {}).get('success'))

# Check for CLI parse failures in logs
logs = s.get('logs', [])
parse_fails = sum(1 for l in logs if 'parse' in str(l.get('message', '')).lower() and 'fail' in str(l.get('message', '')).lower())
# Also check for retry hints (ROBUST-04)
retry_hints = sum(1 for l in logs if 'simplified_hint' in str(l).lower() or 'Format error' in str(l.get('message', '')))

result = {
    'status': s['status'],
    'iterations': s['iterationCount'],
    'actions': s['actionCount'],
    'history_len': len(ah),
    'ok': ok,
    'fail': fail,
    'cost': round(s['totalCost'], 4),
    'tokens_in': s['totalInputTokens'],
    'tokens_out': s['totalOutputTokens'],
    'tools': dict(tools.most_common(8)),
    'parse_fails': parse_fails,
    'retry_hints': retry_hints,
    'last_3': [(a.get('tool'), 'OK' if a.get('success') else 'FAIL') for a in ah[-3:]]
}
print(json.dumps(result, indent=2))
