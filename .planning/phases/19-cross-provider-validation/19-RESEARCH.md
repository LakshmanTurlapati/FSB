# Phase 19: Cross-Provider Validation - Research

**Researched:** 2026-03-01
**Domain:** Cross-provider CLI compliance testing, token measurement, edge case validation for browser automation extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Automated test harness built inside the extension (hidden debug/validation panel)
- Both live API mode and saved golden response mode -- a --live flag (or toggle) switches between them
- Saved snapshots for repeatable regression; live mode for initial validation and periodic smoke tests
- All task types tested per provider: navigation, form fill, data extraction, search+click, and Google Sheets workflows
- Each provider must be tested against all task types, not just 3
- Use a local tokenizer library (like tiktoken) to count tokens in prompt and response strings
- Compare CLI-format prompts vs reconstructed JSON-format equivalents on the same DOM data (Claude's discretion on best comparison approach)
- 40% average token reduction target across all providers as stated in success criteria
- Display token comparison results during test runs only -- leverage existing analytics module for persistent tracking in production
- No separate persistent report file needed for test runs
- Special characters in typed text must roundtrip exactly -- character-for-character identical at the input field, no escaping or mangling
- URL handling in CLI arguments: Claude's discretion based on existing parser implementation
- Multi-line AI reasoning with # comments: Claude's discretion on whether comments are stripped, preserved in logs, or both
- Google Sheets and career search workflows: saved DOM snapshots for regression, live pages as optional smoke test
- Test both parsing AND execution -- full execution validation against mock DOM, not just parse checking
- Detailed reporting with diffs: show expected vs actual CLI output for failures, full command breakdown per test
- Failure categorization: Claude's discretion on the most useful failure types
- Full execution validation: parse provider responses into action objects AND execute against mock DOM to verify end-to-end correctness
- Test panel is power-user accessible via settings toggle or hidden keyboard shortcut -- not developer-only, but not prominently visible

### Claude's Discretion
- Best approach for CLI vs JSON token comparison baseline (synthetic reconstruction vs historical data)
- URL argument handling strategy in CLI parser (quoting rules vs auto-detection)
- Comment line handling in multi-line responses (strip, preserve in logs, or both)
- Failure categorization taxonomy for non-compliant provider responses
- Exact tokenizer library choice
- Test panel UI design and access mechanism (settings toggle vs keyboard shortcut)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | CLI command compliance is validated across xAI Grok, OpenAI GPT-4o, Anthropic Claude, and Google Gemini with at least 3 task types per provider | Test harness sends identical DOM snapshots + task prompts to each provider, parses responses through parseCliResponse, and validates that actions execute against mock DOM. Golden response files enable repeatable regression without live API calls. The existing analytics module tracks per-provider success rates. |
| TEST-02 | Token reduction is measured per provider comparing CLI vs previous JSON format on identical tasks | gpt-tokenizer library (bundled as UMD in lib/) counts tokens on actual prompt strings. CLI prompt is the real prompt sent to the AI. JSON baseline is synthetically reconstructed from the same DOM data using the old JSON tool documentation format and generateCompactSnapshot data re-encoded as verbose JSON. The 40% target is compared as (json_tokens - cli_tokens) / json_tokens >= 0.40. |
| TEST-03 | Edge cases are tested: special characters in typed text, URLs as arguments, multi-line reasoning, Google Sheets workflows, career search workflows | Dedicated test cases with saved golden AI responses exercising: quotes/angle brackets in type commands, URLs with ?/&/= in navigate, # comment lines parsed as reasoning, Google Sheets Name Box + cell edit sequences (from site guide patterns), storeJobData YAML blocks with multi-site career data. Execution validation confirms actions produce correct {tool, params} objects AND execute against mock DOM elements. |
</phase_requirements>

## Summary

Phase 19 builds a test harness inside the FSB Chrome extension to empirically validate that the CLI command format (implemented in Phases 15-18) works correctly across all four supported AI providers. The harness operates in two modes: golden response mode (using saved AI response snapshots for deterministic regression testing) and live API mode (calling real provider endpoints for smoke testing). Token reduction is measured using a local BPE tokenizer comparing actual CLI prompts against synthetically reconstructed JSON-format equivalents.

The core technical challenge is threefold: (1) building a test execution engine that runs inside the Chrome extension's service worker context without disrupting the normal automation flow, (2) constructing realistic DOM snapshots and task prompts that exercise all task types including specialized workflows (Google Sheets, career search), and (3) establishing a fair token comparison baseline since the old JSON format has been deleted.

The project uses vanilla JavaScript with no build system, so all test infrastructure must work via `importScripts()` in the service worker and standard `<script>` tags in the options page. The tokenizer library (gpt-tokenizer) is available as a UMD bundle that can be included in the `lib/` directory, consistent with the existing pattern of bundling chart.min.js, marked.min.js, etc.

**Primary recommendation:** Build a `utils/cli-validator.js` test module loaded via importScripts in background.js. Create a `test-data/` directory with golden response files and DOM snapshot fixtures. Add a "CLI Validation" section to the options page (hidden behind existing debugMode toggle). Use gpt-tokenizer's o200k_base encoding for token counting (matches GPT-4o; closest approximation for cross-provider comparison since BPE token counts are within 5-15% across provider tokenizers).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gpt-tokenizer | 3.x (UMD) | BPE token counting for prompt/response strings | Pure JS, no WASM, works in service workers. UMD bundle loadable via script tag. Supports o200k_base (GPT-4o), cl100k_base (GPT-4/Claude approximate). Smallest footprint of all JS tiktoken implementations. |
| Vanilla JavaScript | ES2021+ | Test harness, test runner, assertion framework | Project mandate: no build system, no bundler. importScripts pattern. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cli-parser.js (self) | Phase 15 | Parsing provider responses into actions | Core of what is being tested -- response goes through parseCliResponse |
| analytics.js (self) | v9.0.2 | Persistent token tracking in production | Existing infrastructure -- test harness leverages for production token tracking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gpt-tokenizer (BPE) | Character-count estimation (chars/3.5) | Character-count is already used in ai-integration.js (line 4527). Gives ~15-25% error. BPE tokenizer gives exact counts for GPT-4o and close approximation for other providers. User decision requires "local tokenizer library." |
| Bundled UMD file | CDN import | CDN requires network access. Extension manifest doesn't guarantee CDN availability. Bundled file is self-contained and consistent with existing lib/ pattern. |
| o200k_base encoding | Per-provider tokenizer (e.g., Gemini uses SentencePiece) | Provider-specific tokenizers are not available as JS libraries. o200k_base is a reasonable proxy -- BPE token counts differ by 5-15% across modern models. The comparison is CLI vs JSON on the SAME tokenizer, so the relative difference is accurate regardless of which tokenizer is used. |

**Installation:** Download gpt-tokenizer UMD bundle for o200k_base encoding and place in `lib/gpt-tokenizer.min.js`. Load via `<script>` in options.html for the test panel UI, and optionally via `importScripts()` in background.js if token counting is needed in the service worker.

## Architecture Patterns

### Recommended Project Structure
```
utils/
  cli-validator.js       # Test runner: test definitions, execution engine, reporter
test-data/
  golden-responses/      # Saved AI responses per provider per task type
    xai/
      navigation.txt
      form-fill.txt
      data-extraction.txt
      search-click.txt
      google-sheets.txt
      career-search.txt
    openai/
      ...
    anthropic/
      ...
    gemini/
      ...
  dom-snapshots/         # Saved DOM snapshots (YAML format) for test tasks
    search-results.yaml
    form-page.yaml
    google-sheets.yaml
    career-page.yaml
    data-table.yaml
  json-baselines/        # Reconstructed JSON-format prompts for token comparison
    search-results.json
    form-page.json
    ...
  edge-cases/            # Edge case test data
    special-chars.txt    # Golden responses with quotes, angle brackets, etc.
    url-arguments.txt    # Golden responses with complex URLs
    yaml-block.txt       # Golden responses with storeJobData YAML blocks
lib/
  gpt-tokenizer.min.js  # BPE tokenizer UMD bundle (o200k_base encoding)
ui/
  options.html           # Add "CLI Validation" section (hidden behind debugMode or settings toggle)
  options.js             # Add test panel controller logic
  options.css            # Add test panel styles
```

### Pattern 1: Two-Mode Test Execution (Golden + Live)
**What:** The test runner operates in two modes. Golden mode reads saved response files and validates parsing + execution deterministically. Live mode calls real provider APIs and validates the actual AI output.
**When to use:** Golden mode for regression testing (always). Live mode for initial validation and periodic smoke tests (requires API keys).

```javascript
// Test runner architecture
class CLIValidator {
  constructor() {
    this.testSuites = [];   // Array of test suite definitions
    this.results = [];       // Test results accumulator
    this.mode = 'golden';   // 'golden' or 'live'
    this.tokenizer = null;  // gpt-tokenizer instance (lazy loaded)
  }

  async runSuite(suiteName, provider) {
    const suite = this.testSuites.find(s => s.name === suiteName);
    for (const testCase of suite.tests) {
      const response = this.mode === 'golden'
        ? await this.loadGoldenResponse(provider, testCase.name)
        : await this.callLiveAPI(provider, testCase.prompt, testCase.domSnapshot);

      const parsed = parseCliResponse(response);
      const sanitized = sanitizeActions(parsed.actions);

      // Validate parsing
      const parseResult = this.validateParsing(parsed, testCase.expected);

      // Validate execution against mock DOM
      const execResult = await this.validateExecution(sanitized, testCase.mockDOM);

      this.results.push({ provider, test: testCase.name, parseResult, execResult });
    }
  }
}
```

### Pattern 2: Token Comparison via Synthetic JSON Baseline
**What:** Since the old JSON format has been deleted, reconstruct a JSON-format equivalent from the same DOM data to compare token counts. The CLI prompt is the actual prompt being tested. The JSON baseline is what the old system would have sent.
**When to use:** For every test case, to measure token reduction per provider.

```javascript
// Token comparison approach
function measureTokenReduction(cliPrompt, domSnapshot, taskDescription) {
  // Reconstruct what the JSON prompt would have looked like
  const jsonBaseline = reconstructJSONPrompt(domSnapshot, taskDescription);

  const cliTokens = tokenizer.countTokens(cliPrompt);
  const jsonTokens = tokenizer.countTokens(jsonBaseline);

  const reduction = (jsonTokens - cliTokens) / jsonTokens;
  return { cliTokens, jsonTokens, reduction, meetsTarget: reduction >= 0.40 };
}

// JSON baseline reconstruction:
// 1. Take the same DOM data used in the CLI YAML snapshot
// 2. Format it as the old verbose JSON structure (elements array with full attributes)
// 3. Wrap in the old JSON tool documentation system prompt (~400 lines)
// 4. This gives a fair apples-to-apples comparison on the same page content
```

### Pattern 3: Mock DOM for Execution Validation
**What:** Create lightweight mock DOM objects that verify action execution produces the correct effects. Not a full browser DOM -- just enough to confirm that `{tool: 'click', params: {ref: 'e5'}}` would target the right element and `{tool: 'type', params: {ref: 'e12', text: 'hello'}}` would type the right text.
**When to use:** For every test case, after parsing.

```javascript
// Mock DOM element for execution validation
class MockElement {
  constructor(ref, type, text, attributes = {}) {
    this.ref = ref;
    this.type = type;
    this.textContent = text;
    this.attributes = attributes;
    this.value = '';         // For input elements
    this.clicked = false;
    this.focused = false;
  }
}

class MockDOM {
  constructor(elements) {
    this.elements = new Map(); // ref -> MockElement
    for (const el of elements) {
      this.elements.set(el.ref, new MockElement(el.ref, el.type, el.text, el.attrs));
    }
  }

  resolveRef(ref) { return this.elements.get(ref); }
}
```

### Pattern 4: Failure Categorization Taxonomy
**What:** Categorize non-compliant provider responses into distinct failure types for actionable debugging.
**When to use:** When a test case fails, classify the failure type.

```javascript
// Failure types (recommendation for Claude's Discretion area)
const FAILURE_TYPES = {
  JSON_REVERT: 'Provider returned JSON instead of CLI commands',
  MARKDOWN_WRAP: 'Response wrapped in markdown code blocks (stripped by preprocessor)',
  CONVERSATIONAL: 'Response includes conversational preamble/postscript (stripped by preprocessor)',
  UNKNOWN_VERB: 'Response contains verbs not in COMMAND_REGISTRY',
  MALFORMED_ARGS: 'Command verb recognized but arguments are malformed',
  WRONG_ACTION: 'Commands parsed but target wrong elements or produce wrong params',
  EMPTY_RESPONSE: 'No commands found in response at all',
  PARTIAL_CLI: 'Mix of CLI commands and non-CLI text that partially parsed',
  SPECIAL_CHAR_MANGLED: 'Special characters in arguments were escaped or corrupted',
  URL_TRUNCATED: 'URL arguments were split or truncated at special characters',
};
```

### Pattern 5: Test Panel in Options Page
**What:** Add a "CLI Validation" section to the options page, hidden behind the existing debugMode toggle. Shows test results, token comparison, and per-provider status.
**When to use:** Power users access via Settings > Advanced > Debug Mode toggle, then the CLI Validation nav item appears.

```javascript
// Options page integration -- the section is conditionally visible
// In options.html sidebar nav:
//   <li class="nav-item debug-only" data-section="cli-validation" style="display: none;">
//     <i class="fas fa-flask"></i>
//     <span>CLI Validation</span>
//   </li>
// Shown when debugMode checkbox is checked

// Alternative: keyboard shortcut (Ctrl+Shift+V) toggles visibility
```

### Anti-Patterns to Avoid
- **Testing only parsing, not execution:** The user decision explicitly requires "full execution validation against mock DOM, not just parse checking." Every test must validate the complete pipeline: raw text -> parseCliResponse -> sanitizeActions -> mock execution.
- **Sharing test infrastructure with production code:** The validator module should be isolated. Do NOT modify the main automation loop for testing. Tests call parseCliResponse and sanitizeActions as library functions.
- **Using character-count for token measurement:** The user decision says "Use a local tokenizer library (like tiktoken)." Character-count estimation (chars/3.5) is NOT acceptable. Use the BPE tokenizer.
- **Hard-coding expected token counts:** Token counts change if prompts change. Compare CLI vs JSON dynamically on the same data, not against fixed numbers.
- **Testing with trivial DOM snapshots:** Use realistic DOM data. A search results page has 50-100+ interactive elements. A Google Sheets page has specific Name Box / formula bar elements. Career pages have job listing structures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BPE token counting | Character-count estimation or custom tokenizer | gpt-tokenizer UMD bundle | Accurate BPE counting is extremely complex (merge rules, vocabulary tables, byte-pair encoding). The library is 100KB and handles it correctly. |
| CLI response parsing | New test-specific parser | parseCliResponse from cli-parser.js | The parser IS what we're testing. Use the real parser, not a test double. |
| JSON baseline reconstruction | Saving old JSON prompts before deletion | Reconstruct from DOM data + old prompt template | The old code is deleted. Reconstruction from the documented format (Phase 15 research has the full old structure) is straightforward and ensures the comparison uses identical page content. |
| Action sanitization | Test-specific sanitizer | sanitizeActions from ai-integration.js | Same rationale -- test the real code path. |

**Key insight:** This phase tests the REAL code, not test doubles. The test harness feeds data into the real parseCliResponse, real sanitizeActions, and validates the output against expected results. The only thing being mocked is the DOM (for execution validation) and optionally the AI provider (golden responses).

## Common Pitfalls

### Pitfall 1: Golden Response Staleness
**What goes wrong:** Golden response files become stale when the system prompt or CLI command table changes. A response that was valid under the old prompt may reference different element refs or use deprecated syntax.
**Why it happens:** Golden responses are captured at a point in time. The system prompt evolves with each phase.
**How to avoid:** Golden responses should be tightly coupled to the DOM snapshot they were generated from. The test validates parsing and action correctness, not the AI's reasoning. As long as the CLI commands in the golden file are valid CLI syntax, the test is valid. Version the golden files with a header comment noting the prompt version.
**Warning signs:** Tests fail after prompt changes with "unknown command" errors.

### Pitfall 2: Token Comparison Unfairness
**What goes wrong:** The JSON baseline is reconstructed too minimally (making CLI look better) or too verbosely (making the comparison meaningless).
**Why it happens:** The old JSON format varied in verbosity depending on configuration. There was a "compact" mode and a full DOM mode.
**How to avoid:** Reconstruct the JSON baseline using the SAME DOM elements that appear in the CLI YAML snapshot. Include the old system prompt (~400 lines of JSON tool documentation from Phase 15 research). Include the old element list format with full attributes. This produces a fair comparison because both prompts describe the same page with the same elements -- only the encoding format differs.
**Warning signs:** Token reduction consistently above 70% (probably too minimal JSON baseline) or below 20% (probably missing system prompt overhead in comparison).

### Pitfall 3: Provider API Rate Limits During Live Testing
**What goes wrong:** Running all test suites in live mode against all 4 providers triggers rate limits, especially with free-tier Gemini or budget xAI models.
**Why it happens:** Each test case is an API call. 6 task types x 4 providers = 24 API calls minimum.
**How to avoid:** Live mode should: (1) have configurable delays between calls (e.g., 2-5 seconds), (2) skip providers without configured API keys, (3) save successful live responses as new golden files for future regression runs, (4) show rate limit errors clearly in the test report.
**Warning signs:** Live test run fails partway through with 429 errors. Test report shows provider X "worked" (first 2 tests) then "failed" (rate limited).

### Pitfall 4: Mock DOM Too Simple
**What goes wrong:** Mock DOM has 5 elements. Real pages have 50-200+. The test passes but real-world automation fails because the AI's response references element refs (e50, e100) that the mock doesn't contain.
**Why it happens:** Building a realistic mock DOM is tedious. Shortcuts are tempting.
**How to avoid:** Extract mock DOM data directly from the golden DOM snapshot files. Each snapshot has element refs, types, and text. The mock DOM constructor should accept the same format. This way the mock DOM is always consistent with what the AI "sees."
**Warning signs:** All tests pass with mock DOM but live execution fails with "element not found."

### Pitfall 5: Service Worker Context Limitations
**What goes wrong:** The test runner needs access to parseCliResponse (service worker scope via importScripts), the tokenizer (needs to be loaded), and the options page UI (document scope). These are different execution contexts.
**Why it happens:** Chrome extensions have distinct contexts: service worker (background.js), extension pages (options.html), and content scripts. They communicate via chrome.runtime.sendMessage.
**How to avoid:** Split the test infrastructure: (1) Test definitions and assertion logic live in the options page context (options.js + a test module loaded by script tag). (2) The options page calls parseCliResponse directly since it can load cli-parser.js via script tag. (3) The tokenizer also loads in the options page context. (4) For live API mode, the options page sends a message to the background service worker which calls the AI provider and returns the raw response. The options page then runs parsing and validation locally. This avoids needing to load the tokenizer in the service worker.
**Warning signs:** "importScripts is not defined" errors. "parseCliResponse is not defined" errors.

### Pitfall 6: Measuring Prompt Tokens vs Response Tokens
**What goes wrong:** Token reduction is measured only on the system prompt, ignoring the DOM snapshot (which is a major contributor to input token count).
**Why it happens:** The system prompt is the most obvious CLI vs JSON difference. But the DOM snapshot (YAML vs JSON) is actually the larger token difference.
**How to avoid:** Measure the FULL prompt: system prompt + DOM snapshot + user message. The CLI format benefits from both the compact system prompt AND the YAML DOM snapshot. Both contribute to the 40% target.
**Warning signs:** Token reduction is 20-30% when only system prompt is compared. Jumps to 50-60% when DOM snapshot is included.

## Code Examples

### Example 1: Test Case Definition

```javascript
// A single test case structure
const navigationTest = {
  name: 'navigation',
  taskType: 'navigation',
  task: 'Navigate to https://example.com and search for "wireless mouse"',
  domSnapshot: 'test-data/dom-snapshots/search-results.yaml',
  mockDOMElements: [
    { ref: 'e1', type: 'link', text: 'Home', attrs: { href: '/' } },
    { ref: 'e5', type: 'input', text: '', attrs: { placeholder: 'Search...', type: 'text' } },
    { ref: 'e7', type: 'button', text: 'Search', attrs: { type: 'submit' } },
  ],
  expected: {
    minActions: 1,
    maxActions: 4,
    requiredTools: ['navigate'], // At least one navigate action
    forbiddenTools: [],
    noJSON: true, // Response must NOT contain JSON objects
  }
};
```

### Example 2: Token Comparison Function

```javascript
// Using gpt-tokenizer for accurate BPE token counting
// Assumes gpt-tokenizer UMD is loaded and available as GPTTokenizer_o200k_base
function compareTokenUsage(cliSystemPrompt, cliDOMSnapshot, cliUserMessage,
                            jsonSystemPrompt, jsonDOMSnapshot, jsonUserMessage) {
  const tokenizer = GPTTokenizer_o200k_base;

  const cliTokens = tokenizer.countTokens(cliSystemPrompt)
                  + tokenizer.countTokens(cliDOMSnapshot)
                  + tokenizer.countTokens(cliUserMessage);

  const jsonTokens = tokenizer.countTokens(jsonSystemPrompt)
                   + tokenizer.countTokens(jsonDOMSnapshot)
                   + tokenizer.countTokens(jsonUserMessage);

  const reduction = (jsonTokens - cliTokens) / jsonTokens;
  return {
    cliTokens,
    jsonTokens,
    reduction: Math.round(reduction * 100),
    meetsTarget: reduction >= 0.40,
    breakdown: {
      systemPromptReduction: Math.round(
        (tokenizer.countTokens(jsonSystemPrompt) - tokenizer.countTokens(cliSystemPrompt))
        / tokenizer.countTokens(jsonSystemPrompt) * 100
      ),
      domSnapshotReduction: Math.round(
        (tokenizer.countTokens(jsonDOMSnapshot) - tokenizer.countTokens(cliDOMSnapshot))
        / tokenizer.countTokens(jsonDOMSnapshot) * 100
      ),
    }
  };
}
```

### Example 3: Golden Response File Format

```
# Golden response file: xai/navigation.txt
# Provider: xai (grok-4-1-fast)
# Task: Navigate to example.com and search for "wireless mouse"
# DOM: test-data/dom-snapshots/search-results.yaml
# Captured: 2026-03-01
# Prompt version: v10.0 CLI

# Navigating to the search page and entering query
navigate "https://example.com"
type e5 "wireless mouse"
click e7
```

### Example 4: Edge Case Test for Special Characters

```javascript
// Edge case: special characters roundtrip in type command
const specialCharsTest = {
  name: 'special-characters',
  taskType: 'edge-case',
  goldenResponse: `# Entering text with special characters
type e12 "He said \\"hello\\" & she replied <yes>"
type e15 "Price: $9.99 (50% off)"
type e18 "Path: C:\\Users\\test\\file.txt"
done "entered special character text"`,
  expected: {
    actions: [
      { tool: 'type', params: { ref: 'e12', text: 'He said "hello" & she replied <yes>' } },
      { tool: 'type', params: { ref: 'e15', text: 'Price: $9.99 (50% off)' } },
      { tool: 'type', params: { ref: 'e18', text: 'Path: C:\\Users\\test\\file.txt' } },
    ],
    taskComplete: true,
  }
};
```

### Example 5: Google Sheets Workflow Test

```javascript
// Google Sheets: Name Box navigation + cell data entry
const googleSheetsTest = {
  name: 'google-sheets',
  taskType: 'sheets',
  goldenResponse: `# Navigate to cell A1 via Name Box
key "Escape"
click e5
type e5 "A1"
enter
# Enter data in cell A1
type e10 "Software Engineer"
key "Tab"
# Move to B1 and enter company name
type e10 "Google"
key "Tab"
# Move to C1 and enter location
type e10 "Mountain View, CA"
key "Enter"
done "filled row 1 with job data"`,
  mockDOMElements: [
    { ref: 'e5', type: 'input', text: 'A1', attrs: { id: 't-name-box' } },
    { ref: 'e8', type: 'div', text: '', attrs: { class: 'cell-input' } },
    { ref: 'e10', type: 'div', text: '', attrs: { class: 'waffle-cell' } },
  ],
  expected: {
    minActions: 8, // key, click, type, enter, type, key, type, key, type, key
    requiredTools: ['keyPress', 'click', 'type', 'pressEnter'],
    taskComplete: true,
  }
};
```

### Example 6: Career Search with storeJobData YAML

```javascript
// Career workflow: multi-site search + storeJobData YAML block
const careerSearchTest = {
  name: 'career-search',
  taskType: 'career',
  goldenResponse: `# Extracting job listings from search results
click e15
# Reading job details from the page
gettext e22
gettext e25
gettext e28
# Storing extracted job data
storejobdata
  company: Google
  jobs:
    - title: Software Engineer
      location: Mountain View, CA
      datePosted: 2026-02-28
      applyLink: https://careers.google.com/jobs/results/123?q=swe
      description: Build scalable distributed systems
    - title: Senior Frontend Developer
      location: New York, NY
      datePosted: 2026-02-27
      applyLink: https://careers.google.com/jobs/results/456?q=frontend&loc=ny
      description: Lead UI architecture for Google Workspace
done "stored 2 jobs from Google careers"`,
  expected: {
    requiredTools: ['click', 'getText', 'storeJobData'],
    taskComplete: true,
    customValidation: (parsed) => {
      const storeAction = parsed.actions.find(a => a.tool === 'storeJobData');
      if (!storeAction || !storeAction.params.data) return 'storeJobData missing data';
      if (storeAction.params.data.company !== 'Google') return 'company mismatch';
      if (!Array.isArray(storeAction.params.data.jobs) || storeAction.params.data.jobs.length !== 2)
        return 'expected 2 jobs';
      if (!storeAction.params.data.jobs[0].applyLink.includes('?q=swe'))
        return 'URL query string truncated';
      return null; // Pass
    }
  }
};
```

## Tokenizer Library Analysis

### Recommendation: gpt-tokenizer (o200k_base encoding)

**Why o200k_base:**
- Used by GPT-4o, the most common cross-provider reference point
- Modern encoding optimized for multilingual and code content
- Token counts on o200k_base and Anthropic's tokenizer (likely similar BPE variant) are within 5-15% of each other for English text
- Since we compare CLI vs JSON on the SAME tokenizer, the relative difference is accurate regardless of provider

**Loading strategy for Chrome extension (no npm/bundler):**
- Download the UMD build of gpt-tokenizer for o200k_base encoding
- Place in `lib/gpt-tokenizer.min.js`
- Load via `<script src="../lib/gpt-tokenizer.min.js">` in options.html
- The global `GPTTokenizer_o200k_base` becomes available with `countTokens()`, `encode()`, etc.
- Do NOT load in the service worker unless needed -- keep background.js lean

**Bundle size concern:**
- The encoding file for o200k_base is the largest part (~4MB uncompressed for the full vocabulary)
- However, gpt-tokenizer stores encodings in a compact format that is significantly smaller
- If the UMD bundle exceeds 1MB, consider using the character-estimation fallback (chars/3.5) as a secondary metric shown alongside BPE counts
- Alternative: use the `isWithinTokenLimit()` API which does lazy streaming and avoids loading the full vocabulary into memory at once

**Fallback: If bundling is impractical:**
- Use the existing character-estimation method (chars/3.5) from ai-integration.js line 4527
- Label results as "estimated" vs "exact BPE"
- The 40% target should still be achievable with estimation since the difference between CLI and JSON is structural (compact YAML vs verbose JSON), not dependent on precise tokenization

### Cross-Provider Token Count Accuracy

| Provider | Native Tokenizer | o200k_base Accuracy | Notes |
|----------|-----------------|---------------------|-------|
| xAI (Grok) | Unknown / likely similar BPE | ~90-95% | Grok models trained on similar data, likely similar tokenization |
| OpenAI (GPT-4o) | o200k_base | 100% | Exact match -- same tokenizer |
| Anthropic (Claude) | Proprietary BPE variant | ~85-95% | Claude uses its own tokenizer, but BPE on English text is similar |
| Google (Gemini) | SentencePiece | ~80-90% | Different algorithm but comparable token counts for English |

The comparison is CLI vs JSON on the SAME tokenizer, so absolute accuracy per provider does not affect the reduction percentage. A 50% reduction on o200k_base implies a similar reduction on any BPE-family tokenizer.

## JSON Baseline Reconstruction Strategy

Since the old JSON format code has been deleted (Phase 18), we need to reconstruct what the JSON prompt would have looked like. The approach:

### Components to Reconstruct

1. **System Prompt (~400 lines of JSON tool documentation)**
   - Phase 15 research documents the old JSON tool documentation format
   - The old system prompt defined 30+ tools with JSON schema examples
   - Approximate by: writing a static string representing the old TOOL_DOCUMENTATION constant

2. **DOM Snapshot (verbose JSON)**
   - The old format used generateCompactSnapshot() which produced `[e1] button "Submit"` lines
   - BUT the JSON format also included: full element attributes, position data, visibility data, interaction state, multiple selectors, form IDs, label text
   - The old htmlContext included: pageStructure with title/url/forms/navigation/headings, relevantElements array
   - Reconstruct by: taking the YAML snapshot data and expanding it back to the verbose JSON structure

3. **User Message**
   - Roughly equivalent in both formats: task description + current URL + iteration context
   - Difference is small; include for completeness

### Estimated Token Comparison

Based on Phase 15 research and YAML-05 requirement (40% snapshot reduction):
- Old system prompt with JSON tool docs: ~2,000-3,000 tokens
- New system prompt with CLI command table: ~800-1,200 tokens (60% reduction on prompt)
- Old JSON DOM snapshot for 100-element page: ~4,000-8,000 tokens
- New YAML DOM snapshot for same page: ~1,500-3,000 tokens (50-60% reduction on snapshot)
- Combined: 6,000-11,000 old vs 2,300-4,200 new = 55-65% reduction
- This comfortably exceeds the 40% target

## Test Execution Context Architecture

### Where Each Component Runs

```
OPTIONS PAGE (document context):                    SERVICE WORKER (background.js context):
+-------------------------------------------+      +------------------------------------+
| options.html                              |      | background.js                      |
|   <script src="lib/gpt-tokenizer.min.js"> |      |   importScripts('ai/cli-parser.js') |
|   <script src="utils/cli-validator.js">   |      |   importScripts('ai/ai-integration.js')|
|   <script src="ui/options.js">            |      |                                    |
|                                           |      | Handles:                           |
| Has access to:                            |      |   - Live API calls via provider    |
|   - parseCliResponse (via script tag)     |      |   - Returns raw text response      |
|   - sanitizeActions (via script tag)      |      |                                    |
|   - gpt-tokenizer (via script tag)        |      +------------------------------------+
|   - DOM for UI rendering                  |             ^
|   - Golden response files (via fetch)     |             |
|   - Test runner logic                     |     chrome.runtime.sendMessage
|                                           |             |
| Flow:                                     |      (for live mode only)
|   1. Load golden response or request      |
|      live response from service worker    |
|   2. Run parseCliResponse locally         |
|   3. Validate actions against expected    |
|   4. Count tokens with gpt-tokenizer     |
|   5. Render results in test panel UI      |
+-------------------------------------------+
```

### Loading cli-parser.js in Options Page

cli-parser.js uses `self.parseCliResponse = parseCliResponse` for service worker export. In the options page, `self` is `window`, so `window.parseCliResponse` will be available after loading:

```html
<!-- In options.html, BEFORE options.js -->
<script src="../ai/cli-parser.js"></script>
<script src="../ai/ai-integration.js"></script>
```

Wait -- ai-integration.js calls `importScripts('ai/ai-providers.js')` which would fail in a document context. Need to load cli-parser.js alone:

```html
<!-- Load ONLY the parser module, not the full AI integration stack -->
<script src="../ai/cli-parser.js"></script>
```

This provides parseCliResponse, tokenizeLine, COMMAND_REGISTRY, preprocessResponse, parseYAMLBlock in the window scope. The sanitizeActions function lives in ai-integration.js which requires the full import chain. Solution: either (a) extract sanitizeActions to a separate small file, or (b) copy the 20-line function into the validator module since it's simple security logic.

## Test File Loading Strategy

### Golden Response Files

Golden response files are plain text (.txt) stored in `test-data/golden-responses/`. The options page loads them via `fetch()`:

```javascript
async loadGoldenResponse(provider, testName) {
  const url = chrome.runtime.getURL(`test-data/golden-responses/${provider}/${testName}.txt`);
  const response = await fetch(url);
  return response.text();
}
```

This requires the files to be declared in `web_accessible_resources` or use `chrome.runtime.getURL` from an extension page (which has access without web_accessible_resources).

Actually, extension pages (options.html) can access their own files via relative paths or chrome.runtime.getURL without needing web_accessible_resources. web_accessible_resources is only needed for content scripts and web pages.

### DOM Snapshot Files

DOM snapshots can be plain text files (YAML format) loaded the same way. They provide the "page state" that would normally come from the content script's buildYAMLSnapshot.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual testing across diverse websites | Automated test harness with golden responses | This phase | Repeatable validation without live API calls; regression testing on each code change |
| Character-count token estimation (chars/3.5) | BPE tokenizer (gpt-tokenizer o200k_base) | This phase | Accurate token counts within 5% for GPT-4o, reasonable proxy for other providers |
| No cross-provider validation | 4-provider x 6-task-type matrix | This phase | Systematic coverage of all provider/task combinations |
| JSON format with 5-strategy parser | CLI format with single-path parser | Phases 15-18 | Reduced parsing complexity from ~650 lines to ~200 lines; single code path for all providers |

**Deprecated/outdated after this phase:**
- Manual per-provider testing: replaced by automated harness
- Character-count token estimation for comparison: supplemented (not replaced) by BPE tokenizer

## Open Questions

1. **gpt-tokenizer UMD bundle size for o200k_base**
   - What we know: The library claims "smallest footprint." Available via unpkg/jsdelivr as UMD. Supports o200k_base encoding.
   - What's unclear: Exact file size of the o200k_base UMD bundle. BPE vocabulary files can be 1-5MB. If too large, impacts extension size.
   - Recommendation: Download and measure during planning. If over 2MB, consider: (a) loading from CDN at test time only (not bundled), (b) using a lightweight custom character-count function labeled as "estimated," or (c) using the tokenizer's streaming/lazy API that doesn't load full vocabulary.

2. **Live mode API key access from options page**
   - What we know: API keys are stored in chrome.storage.local (and optionally encrypted via secure-config.js). The options page already reads them for the "Test API" button.
   - What's unclear: Whether the options page can directly instantiate UniversalProvider and call the API, or must delegate to the service worker.
   - Recommendation: Delegate to the service worker. Send a message like `{action: 'CLI_VALIDATION_LIVE_TEST', provider: 'xai', prompt: {...}}` and have the service worker use the existing provider infrastructure. This avoids duplicating provider logic.

3. **How to capture initial golden responses**
   - What we know: Golden responses need to be real AI outputs that represent what each provider actually generates.
   - What's unclear: Whether to capture them programmatically (run live mode once and save) or craft them manually.
   - Recommendation: Craft the initial golden responses manually based on what each provider is known to produce (from the pitfalls research in Phase 15). Include known quirks: Gemini markdown wrapping, Grok conversational preamble, Claude clean CLI, GPT-4o with occasional extra flags. This ensures the test cases exercise the preprocessResponse cleaning paths. Then optionally capture real responses via live mode and save them to update the golden files.

4. **sanitizeActions accessibility in options page**
   - What we know: sanitizeActions is defined in ai-integration.js (line 181). ai-integration.js requires importScripts chain that only works in the service worker.
   - What's unclear: How to access sanitizeActions in the options page context for execution validation.
   - Recommendation: The sanitizeActions function is ~25 lines of pure logic (blocks javascript: URIs and script injection). Either: (a) inline it in the validator module, or (b) extract it to a separate `utils/sanitize-actions.js` file that both ai-integration.js and the options page can load. Option (b) is cleaner but adds a file. Option (a) is simpler and the function is small enough to maintain in two places.

## Sources

### Primary (HIGH confidence)
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/cli-parser.js` -- Full CLI parser implementation: parseCliResponse, preprocessResponse, COMMAND_REGISTRY, parseYAMLBlock, tokenizeLine. 40 self-tests passing.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/ai-integration.js` -- CLI-only pipeline (Phase 18), sanitizeActions function, token tracking, provider infrastructure, buildPrompt system prompt.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/universal-provider.js` -- Provider configurations (xAI, OpenAI, Anthropic, Gemini, custom), parseResponse returns raw text, rate limit handling.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/utils/analytics.js` -- FSBAnalytics class with pricing, trackUsage, calculateCost. Existing token tracking infrastructure.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ui/options.html` -- Options page structure: sidebar navigation, debug mode toggle, section-based layout.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ui/options.js` -- defaultSettings with debugMode, section initialization, event listeners.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/site-guides/productivity/google-sheets.js` -- Google Sheets site guide with Name Box navigation, cell editing, Tab/Enter patterns, formula bar verification.
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/site-guides/career/_shared.js` -- Career category guidance with search workflow, required data fields, storeJobData usage.
- Phase 15 research (15-RESEARCH.md) -- Full CLI parser architecture, COMMAND_REGISTRY, tool-to-CLI mapping, provider wrapping patterns.
- Phase 18 research (18-RESEARCH.md) -- AI integration wiring, response flow before/after, YAML block parsing, conversation history format.
- Phase 18 verification (18-VERIFICATION.md) -- Confirmed all INTEG requirements satisfied, CLI-only pipeline verified.

### Secondary (MEDIUM confidence)
- gpt-tokenizer GitHub (https://github.com/niieani/gpt-tokenizer) -- UMD availability, o200k_base support, browser compatibility, countTokens API. Verified via WebFetch.
- jsDelivr CDN (https://www.jsdelivr.com/package/npm/gpt-tokenizer) -- CDN distribution confirmed available.
- Bundlephobia (https://bundlephobia.com/package/gpt-tokenizer) -- Attempted but unable to extract exact size. Bundle size remains an open question.

### Tertiary (LOW confidence)
- Cross-provider BPE accuracy estimates (5-15% variance) -- Based on general knowledge of BPE tokenization across providers. Not empirically verified for these specific models. The comparison methodology (same tokenizer for both CLI and JSON) makes absolute accuracy irrelevant for the reduction measurement.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- gpt-tokenizer verified as pure JS UMD library, compatible with extension context. Project patterns for bundling libs confirmed (lib/ directory).
- Architecture: HIGH -- Test harness architecture based on direct codebase analysis of options page structure, service worker context, and CLI parser API. All integration points verified.
- Pitfalls: HIGH -- Based on Phase 15/18 research pitfalls and direct codebase analysis of context boundaries, import chains, and provider API patterns.
- Token comparison: MEDIUM -- JSON baseline reconstruction is well-defined but untested. Estimated token reduction (55-65%) exceeds target but depends on realistic DOM snapshots.

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable -- internal testing infrastructure, no external API changes expected)
