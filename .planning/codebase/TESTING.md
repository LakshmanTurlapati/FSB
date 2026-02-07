# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Runner:**
- **No test framework configured**
- `package.json` shows: `"test": "echo \"Tests not implemented yet\" && exit 1"`
- No Jest, Vitest, Mocha, or other test framework dependencies

**Assertion Library:**
- Not configured

**Run Commands:**
```bash
npm test              # Currently exits with error - tests not implemented
npm run lint          # Currently echoes "Linting not configured yet"
```

## Test File Organization

**Location:**
- No test files detected (`*.test.*`, `*.spec.*` patterns found 0 files)
- No `__tests__` or `tests` directories exist

**Current Structure:**
```
FSB/
├── *.js              # Source files only, no co-located tests
├── Logs/             # Runtime logs, not test output
└── package.json      # No test configuration
```

## Manual Testing Approach

**Current Practice:**
The codebase relies on manual testing through:

1. **Console Logging:**
   - Extensive `AutomationLogger` class for debugging
   - Log files written to `Logs/` directory
   - Real-time console output with `[FSB ${level}]` prefix

2. **Debug Mode:**
   - Toggle via `debugMode` setting in options
   - Enables verbose logging output

3. **API Test Button:**
   - Options page includes "Test API" functionality
   - Tests connection to configured AI provider

## Verification Patterns

**Action Verification Module (`action-verification.js`):**
The codebase has built-in verification patterns that could serve as a testing foundation:

```javascript
/**
 * Captures the current state of the page for comparison
 */
function capturePageState() {
  return {
    url: window.location.href,
    title: document.title,
    bodyText: document.body.innerText.substring(0, 1000),
    elementCount: document.querySelectorAll('*').length,
    inputValues: {},
    visibleElements: [],
    timestamp: Date.now()
  };
}

/**
 * Compares two page states and returns what changed
 */
function comparePageStates(before, after) {
  const changes = {
    urlChanged: before.url !== after.url,
    titleChanged: before.title !== after.title,
    contentChanged: before.bodyText !== after.bodyText,
    elementCountChanged: Math.abs(before.elementCount - after.elementCount) > 5,
    // ...
  };
  return changes;
}

/**
 * Verifies a click action had an effect
 */
async function verifyClickEffect(selector, preClickState) {
  const stabilityResult = await waitForDOMStable();
  const postClickState = capturePageState();
  const changes = comparePageStates(preClickState, postClickState);

  return {
    verified: wasEffective,
    changes,
    effects: clickEffects,
    stabilityResult,
    selector,
    suggestion: wasEffective ? null : 'Click may not have had the intended effect'
  };
}
```

**DOM Stability Check:**
```javascript
async function waitForDOMStable(maxWait = 3000) {
  const startTime = Date.now();
  let lastChangeTime = Date.now();
  let previousHTML = document.body.innerHTML;

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const currentHTML = document.body.innerHTML;
      const elapsed = Date.now() - startTime;

      if (currentHTML !== previousHTML) {
        lastChangeTime = Date.now();
        previousHTML = currentHTML;
      }

      const stableTime = Date.now() - lastChangeTime;

      if (stableTime > 500 || elapsed > maxWait) {
        clearInterval(checkInterval);
        resolve({
          stable: stableTime > 500,
          waitTime: elapsed,
          reason: stableTime > 500 ? 'dom_stable' : 'timeout'
        });
      }
    }, 100);
  });
}
```

## Recommended Test Structure

**If implementing tests, follow this structure based on codebase patterns:**

```javascript
// Example test structure matching project conventions
describe('AIIntegration', () => {
  let ai;

  beforeEach(() => {
    ai = new AIIntegration({
      modelProvider: 'xai',
      modelName: 'grok-4-1-fast',
      apiKey: 'test-key'
    });
  });

  afterEach(() => {
    ai.clearConversationHistory();
  });

  describe('buildPrompt', () => {
    it('should create prompt with system and user components', () => {
      const prompt = ai.buildPrompt('search for weather', mockDomState, {});

      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.userPrompt).toBeDefined();
      expect(prompt.userPrompt).toContain('weather');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = ai.parseResponse('{"actions": [], "taskComplete": false}');

      expect(response.actions).toEqual([]);
      expect(response.taskComplete).toBe(false);
    });

    it('should handle markdown-wrapped JSON', () => {
      const response = ai.parseResponse('```json\n{"actions": []}\n```');

      expect(response.actions).toEqual([]);
    });
  });
});
```

## Mocking Patterns

**Chrome APIs would need mocking:**
```javascript
// Example mock setup for Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined)
    },
    session: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined)
    }
  },
  tabs: {
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    get: jest.fn().mockResolvedValue({ id: 1, status: 'complete' })
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

global.chrome = mockChrome;
```

**AI Provider Mocking:**
```javascript
// Mock for AI API calls
const mockAIResponse = {
  reasoning: 'Test reasoning',
  actions: [
    { tool: 'click', params: { selector: '#button' } }
  ],
  taskComplete: false,
  currentStep: 'Clicking button'
};

jest.spyOn(ai, 'callAPI').mockResolvedValue(mockAIResponse);
```

## Fixtures and Factories

**DOM State Fixture:**
```javascript
const mockDomState = {
  url: 'https://example.com',
  title: 'Test Page',
  elements: [
    {
      elementId: 'elem_1',
      type: 'button',
      text: 'Submit',
      selectors: ['#submit-btn', '.btn-primary'],
      position: { x: 100, y: 200, inViewport: true }
    }
  ],
  scrollPosition: { x: 0, y: 0 },
  viewport: { width: 1920, height: 1080 }
};
```

**Session Fixture:**
```javascript
const mockSession = {
  sessionId: 'test-session-123',
  task: 'Search for weather',
  tabId: 1,
  status: 'running',
  startTime: Date.now(),
  iterationCount: 0
};
```

## Coverage

**Requirements:**
- No coverage requirements enforced
- No coverage configuration

**To Enable Coverage (recommended setup):**
```bash
# Add to package.json
npm install --save-dev jest @types/jest
npm install --save-dev jest-environment-jsdom  # For DOM testing

# Run with coverage
jest --coverage
```

## Test Types

**Unit Tests (recommended for):**
- `ai-integration.js`: Prompt building, response parsing, retry logic
- `config.js`: Settings loading, validation, migration
- `analytics.js`: Cost calculation, usage tracking
- `universal-provider.js`: Request formatting, response handling
- `secure-config.js`: Encryption/decryption functions
- `action-verification.js`: State comparison logic

**Integration Tests (recommended for):**
- Background script message handling
- Content script to background communication
- Storage operations across contexts

**E2E Tests:**
- Not configured
- Would require Puppeteer or Playwright for Chrome extension testing
- Consider: https://github.com/nicholasruunu/jest-chrome

## Common Test Scenarios

**AI Response Parsing:**
```javascript
// Test cases for parseResponse()
const testCases = [
  { input: '{"actions": []}', expected: { actions: [] } },
  { input: '```json\n{"actions": []}\n```', expected: { actions: [] } },
  { input: 'Here is my response:\n{"actions": []}', expected: { actions: [] } },
  { input: 'Invalid', shouldThrow: true }
];
```

**Selector Generation:**
```javascript
// Test generateSelector() with various elements
const selectorTests = [
  { element: { id: 'btn' }, expected: '#btn' },
  { element: { className: 'submit primary' }, expected: '.submit.primary' },
  { element: { tagName: 'button', text: 'Click' }, expected: 'button:contains("Click")' }
];
```

**Error Recovery:**
```javascript
// Test failure type classification and recovery
const errorScenarios = [
  { error: 'Could not establish connection', expectedType: 'communication' },
  { error: 'No element found', expectedType: 'selector' },
  { error: 'Request timeout', expectedType: 'timeout' }
];
```

## Logging as Testing Aid

**Current approach for debugging automation:**
```javascript
// Use automation logger to trace issues
automationLogger.logPrompt(sessionId, systemPrompt, userPrompt, iteration);
automationLogger.logRawResponse(sessionId, rawResponse, parseSuccess, iteration);
automationLogger.logDOMState(sessionId, domState, iteration);

// Logs are persisted to chrome.storage and exported via options page
```

**Log Export:**
- Options page (`options.js`) provides log export functionality
- Logs can be filtered by level and time range
- Useful for debugging failed automation sessions

---

*Testing analysis: 2026-02-03*
