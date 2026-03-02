/**
 * CLI Validator Module for FSB v10.0 - Phase 19
 *
 * Test runner and validation framework for cross-provider CLI compliance.
 * Validates that AI responses from all supported providers (xAI, OpenAI,
 * Anthropic, Gemini) parse correctly through parseCliResponse and execute
 * correctly against mock DOM elements.
 *
 * Architecture:
 *   - FAILURE_TYPES: Categorized failure taxonomy for actionable debugging
 *   - MockElement: Simulates a DOM element that tracks action effects
 *   - MockDOM: Container of MockElements with action dispatch
 *   - CLIValidator: Test runner with suite registration, execution, reporting
 *   - DEFAULT_SUITES: Pre-defined test suites for all 6 task types
 *
 * Loaded via <script> tag in options.html (browser context, NOT service worker).
 * Depends on cli-parser.js being loaded before this module (provides
 * parseCliResponse and preprocessResponse on window scope).
 *
 * @module cli-validator
 */

// =============================================================================
// FAILURE TYPE TAXONOMY
// =============================================================================

/**
 * Categorized failure types for debugging non-compliant provider responses.
 * Each type identifies a specific pattern of failure for targeted fixes.
 *
 * @type {Object.<string, string>}
 */
const FAILURE_TYPES = {
  JSON_REVERT: 'Provider returned JSON instead of CLI commands',
  MARKDOWN_WRAP: 'Response wrapped in markdown code blocks (handled by preprocessor)',
  CONVERSATIONAL: 'Response includes conversational preamble/postscript (handled by preprocessor)',
  UNKNOWN_VERB: 'Response contains verbs not in COMMAND_REGISTRY',
  MALFORMED_ARGS: 'Command verb recognized but arguments are malformed',
  WRONG_ACTION: 'Commands parsed but target wrong elements or produce wrong params',
  EMPTY_RESPONSE: 'No commands found in response at all',
  PARTIAL_CLI: 'Mix of CLI commands and non-CLI text that partially parsed',
  SPECIAL_CHAR_MANGLED: 'Special characters in arguments were escaped or corrupted',
  URL_TRUNCATED: 'URL arguments were split or truncated at special characters',
};

// =============================================================================
// SECURITY SANITIZER (inlined from ai-integration.js)
// =============================================================================

/**
 * Standalone security sanitization for parsed actions.
 * Source: ai-integration.js sanitizeActions function.
 * Inlined here to avoid loading the entire ai-integration.js import chain
 * in the options page context.
 *
 * Blocks dangerous navigate URIs (data:, javascript:) and type actions
 * containing script injection patterns (<script, javascript:, onerror=).
 *
 * @param {Array<{tool: string, params: Object}>} actions - Parsed action array
 * @returns {Array<{tool: string, params: Object}>} Sanitized actions (dangerous ones removed)
 */
function sanitizeActions(actions) {
  if (!Array.isArray(actions)) return [];

  return actions.filter(action => {
    if (!action || !action.tool) return false;

    // Block navigate actions with data: or javascript: URIs
    if (action.tool === 'navigate' && action.params?.url) {
      const url = String(action.params.url).toLowerCase();
      if (url.startsWith('data:') || url.startsWith('javascript:')) {
        console.warn('[CLIValidator] Blocked suspicious navigate action:', action.params.url.substring(0, 100));
        return false;
      }
    }

    // Block type actions containing script injection patterns
    if (action.tool === 'type' && action.params?.text) {
      const text = String(action.params.text).toLowerCase();
      if (text.includes('<script') || text.includes('javascript:') || text.includes('onerror=')) {
        console.warn('[CLIValidator] Blocked suspicious type action with script content');
        return false;
      }
    }

    return true;
  });
}

// =============================================================================
// MOCK ELEMENT
// =============================================================================

/**
 * Simulates a DOM element that tracks action effects for validation.
 *
 * @class MockElement
 */
class MockElement {
  /**
   * @param {string} ref - Element ref (e.g., 'e5')
   * @param {string} type - Element type (e.g., 'input', 'button', 'a')
   * @param {string} text - Text content of the element
   * @param {Object} [attributes={}] - Element attributes (id, class, href, etc.)
   */
  constructor(ref, type, text, attributes = {}) {
    this.ref = ref;
    this.type = type;
    this.textContent = text;
    this.text = text;
    this.attributes = attributes;
    this.value = attributes.value || '';
    this.clicked = false;
    this.focused = false;
    this.typed = null;
    this.selectedOption = null;
    this.keyPressed = null;
    this.hovered = false;
    this.cleared = false;
    this.blurred = false;
    this.doubleClicked = false;
    this.rightClicked = false;
  }

  /**
   * Simulates an action effect on this element.
   *
   * @param {string} tool - The tool/action name
   * @param {Object} params - Action parameters
   * @returns {*} Result of the action (e.g., text content for getText)
   */
  applyAction(tool, params) {
    switch (tool) {
      case 'click':
      case 'clickSearchResult':
        this.clicked = true;
        return true;
      case 'doubleClick':
        this.doubleClicked = true;
        this.clicked = true;
        return true;
      case 'rightClick':
        this.rightClicked = true;
        return true;
      case 'type':
        this.value = params.text || '';
        this.typed = params.text || '';
        return true;
      case 'clearInput':
        this.value = '';
        this.cleared = true;
        return true;
      case 'selectOption':
        this.selectedOption = params.value || params.index;
        return true;
      case 'keyPress':
      case 'pressEnter':
      case 'sendSpecialKey':
        this.keyPressed = params.key || tool;
        return true;
      case 'getText':
        return this.textContent;
      case 'getAttribute':
        return this.attributes[params.attribute] || null;
      case 'focus':
        this.focused = true;
        return true;
      case 'blur':
        this.focused = false;
        this.blurred = true;
        return true;
      case 'hover':
        this.hovered = true;
        return true;
      case 'selectText':
        return true;
      case 'toggleCheckbox':
        this.clicked = true;
        return true;
      default:
        return true;
    }
  }
}

// =============================================================================
// MOCK DOM
// =============================================================================

/**
 * Container of MockElements that dispatches actions and tracks navigation.
 *
 * @class MockDOM
 */
class MockDOM {
  /**
   * @param {Array<{ref: string, type: string, text: string, attrs?: Object}>} elements
   */
  constructor(elements) {
    this.elements = new Map();
    this.navigations = [];
    this.searches = [];
    this.scrolls = [];
    this.keyPresses = [];
    this.storedData = [];
    this.signals = [];

    for (const el of elements) {
      const mockEl = new MockElement(el.ref, el.type, el.text, el.attrs || {});
      this.elements.set(el.ref, mockEl);
    }
  }

  /**
   * Resolves an element ref to a MockElement.
   *
   * @param {string} ref - Element ref (e.g., 'e5')
   * @returns {MockElement|null}
   */
  resolveRef(ref) {
    return this.elements.get(ref) || null;
  }

  /**
   * Applies an action to the mock DOM.
   * For element-targeted actions, resolves the ref and calls element.applyAction.
   * For non-element actions (navigate, scroll, searchGoogle, storeJobData),
   * tracks on the MockDOM directly.
   *
   * @param {Object} action - {tool: string, params: Object}
   * @returns {{success: boolean, element: MockElement|null, error: string|null, result: *}}
   */
  applyAction(action) {
    const { tool, params } = action;

    // Non-element actions tracked at DOM level
    if (tool === 'navigate') {
      this.navigations.push(params.url || params.selector || '');
      return { success: true, element: null, error: null, result: params.url };
    }

    if (tool === 'searchGoogle') {
      this.searches.push(params.query || '');
      return { success: true, element: null, error: null, result: params.query };
    }

    if (tool === 'scroll' || tool === 'scrollToTop' || tool === 'scrollToBottom') {
      this.scrolls.push(params.direction || tool);
      return { success: true, element: null, error: null, result: params.direction || tool };
    }

    if (tool === 'keyPress' || tool === 'sendSpecialKey') {
      // keyPress can target an element OR be global
      if (params.ref) {
        const el = this.resolveRef(params.ref);
        if (el) {
          el.applyAction(tool, params);
          return { success: true, element: el, error: null, result: true };
        }
      }
      this.keyPresses.push(params.key || '');
      return { success: true, element: null, error: null, result: params.key };
    }

    if (tool === 'pressEnter') {
      if (params.ref) {
        const el = this.resolveRef(params.ref);
        if (el) {
          el.applyAction(tool, params);
          return { success: true, element: el, error: null, result: true };
        }
      }
      this.keyPresses.push('Enter');
      return { success: true, element: null, error: null, result: 'Enter' };
    }

    if (tool === 'storeJobData') {
      this.storedData.push(params.data || {});
      return { success: true, element: null, error: null, result: params.data };
    }

    if (tool === 'fillSheetData' || tool === 'getStoredJobs') {
      return { success: true, element: null, error: null, result: true };
    }

    if (tool === 'refresh' || tool === 'goBack' || tool === 'goForward') {
      this.navigations.push(tool);
      return { success: true, element: null, error: null, result: tool };
    }

    if (tool === 'waitForElement' || tool === 'waitForDOMStable' || tool === 'detectLoadingState') {
      return { success: true, element: null, error: null, result: true };
    }

    if (tool === 'scrollToElement') {
      const ref = params.ref;
      if (ref) {
        const el = this.resolveRef(ref);
        if (el) {
          this.scrolls.push(`toElement:${ref}`);
          return { success: true, element: el, error: null, result: true };
        }
      }
      return { success: false, element: null, error: `Element not found: ${ref}`, result: null };
    }

    // Element-targeted actions
    const ref = params.ref || params.selector;
    if (!ref) {
      // Some actions may not require a ref (e.g., global key press already handled above)
      return { success: true, element: null, error: null, result: true };
    }

    const el = this.resolveRef(ref);
    if (!el) {
      return { success: false, element: null, error: `Element not found: ${ref}`, result: null };
    }

    const result = el.applyAction(tool, params);
    return { success: true, element: el, error: null, result };
  }
}

// =============================================================================
// CLI VALIDATOR
// =============================================================================

/**
 * Test runner for cross-provider CLI validation.
 * Registers test suites, loads golden responses, runs parseCliResponse,
 * validates parsing and execution, and generates detailed reports.
 *
 * @class CLIValidator
 */
class CLIValidator {
  constructor() {
    this.testSuites = [];
    this.results = [];
    this.mode = 'golden'; // 'golden' or 'live'
    this.onProgress = null;
  }

  /**
   * Registers a test suite for execution.
   *
   * @param {Object} suite - Test suite definition
   * @param {string} suite.name - Suite name
   * @param {string} suite.taskType - Task type identifier
   * @param {Array} suite.mockDOMElements - Mock DOM element definitions
   * @param {Object} suite.expected - Expected validation criteria
   */
  registerSuite(suite) {
    this.testSuites.push(suite);
  }

  /**
   * Loads a golden response file for a given provider and test name.
   *
   * @param {string} provider - Provider name (xai, openai, anthropic, gemini)
   * @param {string} testName - Test name matching golden response filename
   * @returns {Promise<string>} Raw golden response text
   */
  async loadGoldenResponse(provider, testName) {
    const url = chrome.runtime.getURL(`test-data/golden-responses/${provider}/${testName}.txt`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load golden response: ${provider}/${testName}.txt (${response.status})`);
    }
    return response.text();
  }

  /**
   * Loads a DOM snapshot YAML file from the test-data directory.
   *
   * @param {string} snapshotFile - Relative path to snapshot file
   * @returns {Promise<string>} Raw YAML text
   */
  async loadDOMSnapshot(snapshotFile) {
    const url = chrome.runtime.getURL(snapshotFile);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load DOM snapshot: ${snapshotFile} (${response.status})`);
    }
    return response.text();
  }

  /**
   * Builds a MockDOM from an array of element definitions.
   *
   * @param {Array<{ref: string, type: string, text: string, attrs?: Object}>} elements
   * @returns {MockDOM}
   */
  buildMockDOM(elements) {
    return new MockDOM(elements);
  }

  /**
   * Validates parsed CLI output against expected criteria.
   *
   * @param {Object} parsed - Output from parseCliResponse
   * @param {Object} expected - Expected validation criteria
   * @returns {{passed: boolean, failures: Array<{type: string, detail: string, expected: *, actual: *}>}}
   */
  validateParsing(parsed, expected) {
    const failures = [];

    // Check action count bounds
    if (expected.minActions !== undefined && parsed.actions.length < expected.minActions) {
      failures.push({
        type: FAILURE_TYPES.EMPTY_RESPONSE,
        detail: `Too few actions: expected at least ${expected.minActions}`,
        expected: `>= ${expected.minActions}`,
        actual: parsed.actions.length
      });
    }

    if (expected.maxActions !== undefined && parsed.actions.length > expected.maxActions) {
      failures.push({
        type: FAILURE_TYPES.WRONG_ACTION,
        detail: `Too many actions: expected at most ${expected.maxActions}`,
        expected: `<= ${expected.maxActions}`,
        actual: parsed.actions.length
      });
    }

    // Check required tools appear at least once
    if (expected.requiredTools) {
      const toolsUsed = new Set(parsed.actions.map(a => a.tool));
      for (const tool of expected.requiredTools) {
        if (!toolsUsed.has(tool)) {
          failures.push({
            type: FAILURE_TYPES.WRONG_ACTION,
            detail: `Required tool "${tool}" not found in actions`,
            expected: tool,
            actual: Array.from(toolsUsed).join(', ')
          });
        }
      }
    }

    // Check forbidden tools do not appear
    if (expected.forbiddenTools) {
      const toolsUsed = new Set(parsed.actions.map(a => a.tool));
      for (const tool of expected.forbiddenTools) {
        if (toolsUsed.has(tool)) {
          failures.push({
            type: FAILURE_TYPES.WRONG_ACTION,
            detail: `Forbidden tool "${tool}" found in actions`,
            expected: `not ${tool}`,
            actual: tool
          });
        }
      }
    }

    // Check no JSON in response (indicates JSON revert)
    if (expected.noJSON) {
      for (const action of parsed.actions) {
        if (action.params && typeof action.params === 'object') {
          // This is fine -- params are always objects
          // We check for JSON revert by looking at the raw response pattern
        }
      }
      // Check errors for JSON patterns
      for (const err of parsed.errors) {
        if (err.line && /^\s*\{/.test(err.line) && /"tool"/.test(err.line)) {
          failures.push({
            type: FAILURE_TYPES.JSON_REVERT,
            detail: 'Response contains JSON object patterns instead of CLI commands',
            expected: 'CLI commands',
            actual: err.line.substring(0, 100)
          });
        }
      }
    }

    // Check task completion signal
    if (expected.taskComplete !== undefined) {
      if (parsed.taskComplete !== expected.taskComplete) {
        failures.push({
          type: FAILURE_TYPES.WRONG_ACTION,
          detail: `Task completion signal mismatch`,
          expected: expected.taskComplete,
          actual: parsed.taskComplete
        });
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  /**
   * Validates parsed actions execute correctly against a MockDOM.
   *
   * @param {Array<{tool: string, params: Object}>} actions - Parsed actions
   * @param {MockDOM} mockDOM - Mock DOM to execute against
   * @returns {{passed: boolean, executedCount: number, failures: Array, elementStates: Map}}
   */
  validateExecution(actions, mockDOM) {
    const failures = [];
    let executedCount = 0;
    const sanitized = sanitizeActions(actions);

    for (const action of sanitized) {
      const result = mockDOM.applyAction(action);
      executedCount++;

      if (!result.success) {
        failures.push({
          type: FAILURE_TYPES.WRONG_ACTION,
          detail: `Action execution failed: ${action.tool} - ${result.error}`,
          expected: 'successful execution',
          actual: result.error
        });
      }
    }

    // Collect element states for inspection
    const elementStates = new Map();
    for (const [ref, el] of mockDOM.elements) {
      elementStates.set(ref, {
        ref: el.ref,
        clicked: el.clicked,
        typed: el.typed,
        focused: el.focused,
        value: el.value,
        selectedOption: el.selectedOption,
        keyPressed: el.keyPressed,
        hovered: el.hovered
      });
    }

    return {
      passed: failures.length === 0,
      executedCount,
      failures,
      elementStates
    };
  }

  /**
   * Categorizes a failure by analyzing the raw response and parsed result.
   *
   * @param {string} response - Raw AI response text
   * @param {Object} parsed - Output from parseCliResponse
   * @returns {string} One of the FAILURE_TYPES values
   */
  categorizeFailure(response, parsed) {
    if (!response || response.trim().length === 0) {
      return FAILURE_TYPES.EMPTY_RESPONSE;
    }

    // Check for JSON revert (provider returned JSON instead of CLI)
    if (/\{\s*"tool"\s*:/.test(response) || /\{\s*"actions"\s*:/.test(response)) {
      return FAILURE_TYPES.JSON_REVERT;
    }

    // Check for markdown wrapping
    if (/^```/.test(response.trim())) {
      return FAILURE_TYPES.MARKDOWN_WRAP;
    }

    // Check for empty parsed actions
    if (parsed.actions.length === 0 && parsed.errors.length === 0) {
      // Might be conversational
      if (response.trim().length > 0) {
        return FAILURE_TYPES.CONVERSATIONAL;
      }
      return FAILURE_TYPES.EMPTY_RESPONSE;
    }

    // Check for unknown verbs in errors
    if (parsed.errors.some(e => e.error && e.error.startsWith('Unknown command:'))) {
      return FAILURE_TYPES.UNKNOWN_VERB;
    }

    // Check for malformed args in errors
    if (parsed.errors.some(e => e.error && (e.error.includes('Missing required argument') || e.error.includes('Invalid')))) {
      return FAILURE_TYPES.MALFORMED_ARGS;
    }

    // Check for partial parsing (some actions + some errors)
    if (parsed.actions.length > 0 && parsed.errors.length > 0) {
      return FAILURE_TYPES.PARTIAL_CLI;
    }

    // Check for special character issues
    if (parsed.actions.some(a => a.tool === 'type' && a.params?.text && /\\['"<>&]/.test(a.params.text))) {
      return FAILURE_TYPES.SPECIAL_CHAR_MANGLED;
    }

    // Check for URL truncation
    if (parsed.actions.some(a => a.tool === 'navigate' && a.params?.url && !a.params.url.includes('://'))) {
      return FAILURE_TYPES.URL_TRUNCATED;
    }

    return FAILURE_TYPES.WRONG_ACTION;
  }

  /**
   * Runs a single test suite for a specific provider.
   *
   * @param {string} suiteName - Name of the registered suite
   * @param {string} provider - Provider to test (xai, openai, anthropic, gemini)
   * @param {Object} [options={}] - Options: { liveResponse: string }
   * @returns {Promise<Object>} Test result with parsing and execution details
   */
  async runSuite(suiteName, provider, options = {}) {
    const suite = this.testSuites.find(s => s.name === suiteName || s.taskType === suiteName);
    if (!suite) {
      return { error: `Suite not found: ${suiteName}`, passed: false };
    }

    const result = {
      suite: suite.name,
      provider,
      taskType: suite.taskType,
      passed: false,
      parsing: null,
      execution: null,
      failureType: null,
      customValidation: null,
      raw: null,
      parsed: null,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Load golden response or use live response
      let rawResponse;
      if (options.liveResponse) {
        rawResponse = options.liveResponse;
      } else {
        rawResponse = await this.loadGoldenResponse(provider, suite.taskType);
      }

      // Strip metadata comment header from golden response files
      const lines = rawResponse.split('\n');
      let contentStart = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('# Golden response') || lines[i].startsWith('# Provider:') ||
            lines[i].startsWith('# Task:') || lines[i].startsWith('# DOM:') ||
            lines[i].startsWith('# Captured:') || lines[i].startsWith('# Prompt version:')) {
          contentStart = i + 1;
        } else {
          break;
        }
      }
      const responseContent = lines.slice(contentStart).join('\n').trim();

      result.raw = responseContent;

      // Parse through the real parseCliResponse
      const parsed = parseCliResponse(responseContent);
      result.parsed = parsed;

      // Validate parsing
      const parsingResult = this.validateParsing(parsed, suite.expected);
      result.parsing = parsingResult;

      // Build MockDOM and validate execution
      const mockDOM = this.buildMockDOM(suite.mockDOMElements);
      const executionResult = this.validateExecution(parsed.actions, mockDOM);
      result.execution = executionResult;

      // Run custom validation if defined
      if (suite.expected.customValidation) {
        try {
          const customResult = suite.expected.customValidation(parsed, mockDOM, executionResult);
          result.customValidation = customResult;
        } catch (e) {
          result.customValidation = { passed: false, error: e.message };
        }
      }

      // Determine overall pass/fail
      const parsingPassed = parsingResult.passed;
      const executionPassed = executionResult.passed;
      const customPassed = result.customValidation ? result.customValidation.passed : true;
      result.passed = parsingPassed && executionPassed && customPassed;

      // Categorize failure if not passed
      if (!result.passed) {
        result.failureType = this.categorizeFailure(responseContent, parsed);
      }
    } catch (err) {
      result.error = err.message;
      result.passed = false;
    }

    result.duration = Date.now() - startTime;

    // Notify progress
    if (this.onProgress) {
      this.onProgress(result);
    }

    return result;
  }

  /**
   * Runs all registered test suites for each provider.
   *
   * @param {string[]} providers - Provider names to test
   * @returns {Promise<Array>} Full results array
   */
  async runAll(providers) {
    this.results = [];

    for (const provider of providers) {
      for (const suite of this.testSuites) {
        const result = await this.runSuite(suite.name, provider);
        this.results.push(result);
      }
    }

    return this.results;
  }

  /**
   * Generates a structured report from test results.
   *
   * @param {Array} results - Array of test results from runAll or runSuite
   * @returns {Object} Structured report with per-provider, per-task-type breakdowns
   */
  generateReport(results) {
    const report = {
      perProvider: {},
      perTaskType: {},
      perTest: [],
      failures: [],
      summary: {
        total: results.length,
        passed: 0,
        failed: 0,
        compliance: {}
      }
    };

    for (const r of results) {
      // Per-provider aggregation
      if (!report.perProvider[r.provider]) {
        report.perProvider[r.provider] = { passed: 0, failed: 0, total: 0 };
      }
      report.perProvider[r.provider].total++;
      if (r.passed) {
        report.perProvider[r.provider].passed++;
        report.summary.passed++;
      } else {
        report.perProvider[r.provider].failed++;
        report.summary.failed++;
      }

      // Per-task-type aggregation
      if (!report.perTaskType[r.taskType]) {
        report.perTaskType[r.taskType] = { passed: 0, failed: 0, total: 0 };
      }
      report.perTaskType[r.taskType].total++;
      if (r.passed) {
        report.perTaskType[r.taskType].passed++;
      } else {
        report.perTaskType[r.taskType].failed++;
      }

      // Per-test detail
      report.perTest.push({
        provider: r.provider,
        taskType: r.taskType,
        suite: r.suite,
        passed: r.passed,
        failureType: r.failureType,
        parsingFailures: r.parsing?.failures || [],
        executionFailures: r.execution?.failures || [],
        actionCount: r.parsed?.actions?.length || 0,
        errorCount: r.parsed?.errors?.length || 0,
        duration: r.duration
      });

      // Collect failures
      if (!r.passed) {
        report.failures.push({
          provider: r.provider,
          taskType: r.taskType,
          failureType: r.failureType,
          parsingFailures: r.parsing?.failures || [],
          executionFailures: r.execution?.failures || [],
          diff: r.parsed ? this.diffActions(
            r.parsing?.failures?.map(f => `${f.expected}`) || [],
            r.parsed.actions.map(a => `${a.tool}(${JSON.stringify(a.params)})`)
          ) : 'No parsed output'
        });
      }
    }

    // Compliance percentage per provider
    for (const [provider, stats] of Object.entries(report.perProvider)) {
      report.summary.compliance[provider] = stats.total > 0
        ? Math.round((stats.passed / stats.total) * 100)
        : 0;
    }

    return report;
  }

  /**
   * Produces human-readable diff between expected and actual action lists.
   *
   * @param {string[]} expected - Expected action descriptions
   * @param {string[]} actual - Actual action descriptions
   * @returns {string} Formatted diff text
   */
  diffActions(expected, actual) {
    const lines = [];
    const maxLen = Math.max(expected.length, actual.length);

    for (let i = 0; i < maxLen; i++) {
      const exp = i < expected.length ? expected[i] : '(none)';
      const act = i < actual.length ? actual[i] : '(none)';
      const marker = exp === act ? '  ' : '! ';
      lines.push(`${marker}[${i}] expected: ${exp}`);
      lines.push(`${marker}[${i}] actual:   ${act}`);
    }

    return lines.join('\n');
  }
}

// =============================================================================
// DEFAULT TEST SUITE DEFINITIONS
// =============================================================================

/**
 * Pre-defined test suites for all 6 task types.
 * Each suite includes realistic mock DOM elements (20-50 per suite)
 * and expected validation criteria.
 */
const DEFAULT_SUITES = [

  // -------------------------------------------------------------------------
  // 1. NAVIGATION
  // -------------------------------------------------------------------------
  {
    name: 'Navigation Test',
    taskType: 'navigation',
    domSnapshotFile: 'test-data/dom-snapshots/search-page.yaml',
    mockDOMElements: [
      { ref: 'e1', type: 'a', text: 'Home', attrs: { href: '/', class: 'nav-link' } },
      { ref: 'e2', type: 'a', text: 'Products', attrs: { href: '/products', class: 'nav-link' } },
      { ref: 'e3', type: 'a', text: 'About', attrs: { href: '/about', class: 'nav-link' } },
      { ref: 'e4', type: 'a', text: 'Contact', attrs: { href: '/contact', class: 'nav-link' } },
      { ref: 'e5', type: 'input', text: '', attrs: { type: 'search', placeholder: 'Search...', id: 'search-input' } },
      { ref: 'e6', type: 'button', text: 'Search', attrs: { type: 'submit', class: 'search-btn' } },
      { ref: 'e7', type: 'img', text: '', attrs: { src: '/logo.png', alt: 'Site Logo', class: 'logo' } },
      { ref: 'e8', type: 'a', text: 'Sign In', attrs: { href: '/login', class: 'auth-link' } },
      { ref: 'e9', type: 'a', text: 'Sign Up', attrs: { href: '/register', class: 'auth-link' } },
      { ref: 'e10', type: 'h1', text: 'Welcome to Example.com', attrs: { class: 'hero-title' } },
      { ref: 'e11', type: 'p', text: 'Browse our extensive product catalog', attrs: { class: 'hero-subtitle' } },
      { ref: 'e12', type: 'a', text: 'Shop Now', attrs: { href: '/products', class: 'cta-btn' } },
      { ref: 'e13', type: 'a', text: 'Learn More', attrs: { href: '/about', class: 'cta-btn secondary' } },
      { ref: 'e14', type: 'div', text: '', attrs: { class: 'category-list' } },
      { ref: 'e15', type: 'a', text: 'Electronics', attrs: { href: '/products/electronics', class: 'category-link' } },
      { ref: 'e16', type: 'a', text: 'Clothing', attrs: { href: '/products/clothing', class: 'category-link' } },
      { ref: 'e17', type: 'a', text: 'Books', attrs: { href: '/products/books', class: 'category-link' } },
      { ref: 'e18', type: 'a', text: 'Home & Garden', attrs: { href: '/products/home-garden', class: 'category-link' } },
      { ref: 'e19', type: 'footer', text: '', attrs: { class: 'site-footer' } },
      { ref: 'e20', type: 'a', text: 'Privacy Policy', attrs: { href: '/privacy', class: 'footer-link' } },
      { ref: 'e21', type: 'a', text: 'Terms of Service', attrs: { href: '/terms', class: 'footer-link' } },
      { ref: 'e22', type: 'a', text: 'Help Center', attrs: { href: '/help', class: 'footer-link' } },
      { ref: 'e23', type: 'span', text: '2026 Example.com', attrs: { class: 'copyright' } },
      { ref: 'e24', type: 'a', text: 'Facebook', attrs: { href: 'https://facebook.com/example', class: 'social-link' } },
      { ref: 'e25', type: 'a', text: 'Twitter', attrs: { href: 'https://twitter.com/example', class: 'social-link' } },
    ],
    expected: {
      minActions: 1,
      maxActions: 5,
      requiredTools: ['navigate'],
      forbiddenTools: [],
      noJSON: true,
      taskComplete: true,
      customValidation: null
    }
  },

  // -------------------------------------------------------------------------
  // 2. FORM FILL
  // -------------------------------------------------------------------------
  {
    name: 'Form Fill Test',
    taskType: 'form-fill',
    domSnapshotFile: 'test-data/dom-snapshots/form-page.yaml',
    mockDOMElements: [
      { ref: 'e1', type: 'a', text: 'Home', attrs: { href: '/', class: 'nav-link' } },
      { ref: 'e2', type: 'a', text: 'Contact', attrs: { href: '/contact', class: 'nav-link active' } },
      { ref: 'e3', type: 'a', text: 'About', attrs: { href: '/about', class: 'nav-link' } },
      { ref: 'e4', type: 'h1', text: 'Contact Us', attrs: { class: 'page-title' } },
      { ref: 'e5', type: 'p', text: 'Fill out the form below and we will get back to you', attrs: { class: 'form-desc' } },
      { ref: 'e6', type: 'label', text: 'Full Name', attrs: { for: 'name-input' } },
      { ref: 'e7', type: 'input', text: '', attrs: { type: 'text', id: 'name-input', name: 'fullname', placeholder: 'Enter your full name', required: 'true' } },
      { ref: 'e8', type: 'label', text: 'Email Address', attrs: { for: 'email-input' } },
      { ref: 'e9', type: 'input', text: '', attrs: { type: 'email', id: 'email-input', name: 'email', placeholder: 'you@example.com', required: 'true' } },
      { ref: 'e10', type: 'label', text: 'Phone Number', attrs: { for: 'phone-input' } },
      { ref: 'e11', type: 'input', text: '', attrs: { type: 'tel', id: 'phone-input', name: 'phone', placeholder: '+1 (555) 123-4567' } },
      { ref: 'e12', type: 'label', text: 'Subject', attrs: { for: 'subject-select' } },
      { ref: 'e13', type: 'select', text: '', attrs: { id: 'subject-select', name: 'subject' } },
      { ref: 'e14', type: 'option', text: 'General Inquiry', attrs: { value: 'general' } },
      { ref: 'e15', type: 'option', text: 'Technical Support', attrs: { value: 'support' } },
      { ref: 'e16', type: 'option', text: 'Sales', attrs: { value: 'sales' } },
      { ref: 'e17', type: 'label', text: 'Message', attrs: { for: 'message-textarea' } },
      { ref: 'e18', type: 'textarea', text: '', attrs: { id: 'message-textarea', name: 'message', placeholder: 'Type your message here...', rows: '5', required: 'true' } },
      { ref: 'e19', type: 'label', text: 'Subscribe to newsletter', attrs: { for: 'newsletter-checkbox' } },
      { ref: 'e20', type: 'input', text: '', attrs: { type: 'checkbox', id: 'newsletter-checkbox', name: 'newsletter' } },
      { ref: 'e21', type: 'button', text: 'Send Message', attrs: { type: 'submit', class: 'submit-btn', id: 'submit-btn' } },
      { ref: 'e22', type: 'button', text: 'Reset', attrs: { type: 'reset', class: 'reset-btn' } },
      { ref: 'e23', type: 'div', text: 'Required fields are marked with *', attrs: { class: 'form-note' } },
      { ref: 'e24', type: 'a', text: 'Privacy Policy', attrs: { href: '/privacy', class: 'footer-link' } },
      { ref: 'e25', type: 'a', text: 'Terms', attrs: { href: '/terms', class: 'footer-link' } },
      { ref: 'e26', type: 'span', text: '2026 Example.com', attrs: { class: 'copyright' } },
      { ref: 'e27', type: 'a', text: 'Facebook', attrs: { href: '#', class: 'social-link' } },
      { ref: 'e28', type: 'a', text: 'Twitter', attrs: { href: '#', class: 'social-link' } },
      { ref: 'e29', type: 'div', text: '', attrs: { class: 'form-group name-group' } },
      { ref: 'e30', type: 'div', text: '', attrs: { class: 'form-group email-group' } },
    ],
    expected: {
      minActions: 4,
      maxActions: 15,
      requiredTools: ['type'],
      forbiddenTools: [],
      noJSON: true,
      taskComplete: true,
      customValidation: null
    }
  },

  // -------------------------------------------------------------------------
  // 3. DATA EXTRACTION
  // -------------------------------------------------------------------------
  {
    name: 'Data Extraction Test',
    taskType: 'data-extraction',
    domSnapshotFile: 'test-data/dom-snapshots/data-table.yaml',
    mockDOMElements: [
      { ref: 'e1', type: 'a', text: 'Home', attrs: { href: '/', class: 'nav-link' } },
      { ref: 'e2', type: 'a', text: 'Products', attrs: { href: '/products', class: 'nav-link active' } },
      { ref: 'e3', type: 'h1', text: 'Product Catalog', attrs: { class: 'page-title' } },
      { ref: 'e4', type: 'input', text: '', attrs: { type: 'search', placeholder: 'Search products...', id: 'product-search' } },
      { ref: 'e5', type: 'select', text: '', attrs: { id: 'sort-by', name: 'sort' } },
      { ref: 'e6', type: 'option', text: 'Price: Low to High', attrs: { value: 'price-asc' } },
      { ref: 'e7', type: 'option', text: 'Price: High to Low', attrs: { value: 'price-desc' } },
      { ref: 'e8', type: 'table', text: '', attrs: { class: 'product-table', id: 'products' } },
      { ref: 'e9', type: 'th', text: 'Product Name', attrs: { class: 'col-name' } },
      { ref: 'e10', type: 'th', text: 'Price', attrs: { class: 'col-price' } },
      { ref: 'e11', type: 'th', text: 'Description', attrs: { class: 'col-desc' } },
      { ref: 'e12', type: 'th', text: 'Rating', attrs: { class: 'col-rating' } },
      { ref: 'e13', type: 'th', text: 'Availability', attrs: { class: 'col-avail' } },
      { ref: 'e14', type: 'td', text: 'Wireless Mouse Pro', attrs: { class: 'cell-name', 'data-row': '1' } },
      { ref: 'e15', type: 'td', text: '$49.99', attrs: { class: 'cell-price', 'data-row': '1' } },
      { ref: 'e16', type: 'td', text: 'Ergonomic wireless mouse with 16000 DPI sensor', attrs: { class: 'cell-desc', 'data-row': '1' } },
      { ref: 'e17', type: 'td', text: '4.5/5', attrs: { class: 'cell-rating', 'data-row': '1' } },
      { ref: 'e18', type: 'td', text: 'In Stock', attrs: { class: 'cell-avail', 'data-row': '1' } },
      { ref: 'e19', type: 'td', text: 'Mechanical Keyboard', attrs: { class: 'cell-name', 'data-row': '2' } },
      { ref: 'e20', type: 'td', text: '$129.99', attrs: { class: 'cell-price', 'data-row': '2' } },
      { ref: 'e21', type: 'td', text: 'Cherry MX Blue switches with RGB backlighting', attrs: { class: 'cell-desc', 'data-row': '2' } },
      { ref: 'e22', type: 'td', text: '4.8/5', attrs: { class: 'cell-rating', 'data-row': '2' } },
      { ref: 'e23', type: 'td', text: 'In Stock', attrs: { class: 'cell-avail', 'data-row': '2' } },
      { ref: 'e24', type: 'td', text: 'USB-C Hub', attrs: { class: 'cell-name', 'data-row': '3' } },
      { ref: 'e25', type: 'td', text: '$34.99', attrs: { class: 'cell-price', 'data-row': '3' } },
      { ref: 'e26', type: 'td', text: '7-in-1 USB-C hub with HDMI and SD card reader', attrs: { class: 'cell-desc', 'data-row': '3' } },
      { ref: 'e27', type: 'td', text: '4.2/5', attrs: { class: 'cell-rating', 'data-row': '3' } },
      { ref: 'e28', type: 'td', text: 'Low Stock', attrs: { class: 'cell-avail', 'data-row': '3' } },
      { ref: 'e29', type: 'td', text: 'Monitor Stand', attrs: { class: 'cell-name', 'data-row': '4' } },
      { ref: 'e30', type: 'td', text: '$79.99', attrs: { class: 'cell-price', 'data-row': '4' } },
      { ref: 'e31', type: 'td', text: 'Adjustable aluminum monitor stand with cable management', attrs: { class: 'cell-desc', 'data-row': '4' } },
      { ref: 'e32', type: 'td', text: '4.6/5', attrs: { class: 'cell-rating', 'data-row': '4' } },
      { ref: 'e33', type: 'td', text: 'In Stock', attrs: { class: 'cell-avail', 'data-row': '4' } },
      { ref: 'e34', type: 'td', text: 'Webcam HD', attrs: { class: 'cell-name', 'data-row': '5' } },
      { ref: 'e35', type: 'td', text: '$59.99', attrs: { class: 'cell-price', 'data-row': '5' } },
      { ref: 'e36', type: 'td', text: '1080p webcam with noise-canceling microphone', attrs: { class: 'cell-desc', 'data-row': '5' } },
      { ref: 'e37', type: 'td', text: '4.3/5', attrs: { class: 'cell-rating', 'data-row': '5' } },
      { ref: 'e38', type: 'td', text: 'In Stock', attrs: { class: 'cell-avail', 'data-row': '5' } },
      { ref: 'e39', type: 'a', text: 'Page 1', attrs: { href: '?page=1', class: 'pagination active' } },
      { ref: 'e40', type: 'a', text: 'Page 2', attrs: { href: '?page=2', class: 'pagination' } },
      { ref: 'e41', type: 'a', text: 'Next', attrs: { href: '?page=2', class: 'pagination next' } },
      { ref: 'e42', type: 'span', text: 'Showing 1-5 of 25 products', attrs: { class: 'result-count' } },
    ],
    expected: {
      minActions: 3,
      maxActions: 20,
      requiredTools: ['getText'],
      forbiddenTools: [],
      noJSON: true,
      taskComplete: true,
      customValidation: null
    }
  },

  // -------------------------------------------------------------------------
  // 4. SEARCH + CLICK
  // -------------------------------------------------------------------------
  {
    name: 'Search Click Test',
    taskType: 'search-click',
    domSnapshotFile: 'test-data/dom-snapshots/search-results.yaml',
    mockDOMElements: [
      { ref: 'e1', type: 'input', text: '', attrs: { type: 'search', name: 'q', id: 'search-box', value: 'wireless mouse', class: 'search-input' } },
      { ref: 'e2', type: 'button', text: 'Search', attrs: { type: 'submit', class: 'search-btn', id: 'search-submit' } },
      { ref: 'e3', type: 'a', text: 'Images', attrs: { href: '/images?q=wireless+mouse', class: 'nav-tab' } },
      { ref: 'e4', type: 'a', text: 'News', attrs: { href: '/news?q=wireless+mouse', class: 'nav-tab' } },
      { ref: 'e5', type: 'a', text: 'Shopping', attrs: { href: '/shopping?q=wireless+mouse', class: 'nav-tab' } },
      { ref: 'e6', type: 'span', text: 'About 12,500,000 results (0.42 seconds)', attrs: { class: 'result-count' } },
      { ref: 'e7', type: 'a', text: 'Best Wireless Mouse 2026 - Top 10 Reviews', attrs: { href: 'https://techreviews.com/best-wireless-mouse', class: 'result-title' } },
      { ref: 'e8', type: 'span', text: 'techreviews.com', attrs: { class: 'result-url' } },
      { ref: 'e9', type: 'p', text: 'Compare the top wireless mice of 2026. Expert reviews and buying guide...', attrs: { class: 'result-snippet' } },
      { ref: 'e10', type: 'a', text: 'Wireless Mouse Pro - Official Store', attrs: { href: 'https://shop.example.com/wireless-mouse-pro', class: 'result-title' } },
      { ref: 'e11', type: 'span', text: 'shop.example.com', attrs: { class: 'result-url' } },
      { ref: 'e12', type: 'p', text: 'Premium ergonomic wireless mouse. Free shipping on orders over $50...', attrs: { class: 'result-snippet' } },
      { ref: 'e13', type: 'a', text: 'Amazon.com: Wireless Mouse - Best Sellers', attrs: { href: 'https://www.amazon.com/wireless-mouse/dp/B09XYZ', class: 'result-title' } },
      { ref: 'e14', type: 'span', text: 'www.amazon.com', attrs: { class: 'result-url' } },
      { ref: 'e15', type: 'p', text: 'Shop wireless mice. Bluetooth and USB receiver options available...', attrs: { class: 'result-snippet' } },
      { ref: 'e16', type: 'a', text: 'How to Choose a Wireless Mouse - Buying Guide', attrs: { href: 'https://www.pcmag.com/how-to/wireless-mouse-guide', class: 'result-title' } },
      { ref: 'e17', type: 'span', text: 'www.pcmag.com', attrs: { class: 'result-url' } },
      { ref: 'e18', type: 'p', text: 'Everything you need to know about wireless mice. DPI, ergonomics, battery life...', attrs: { class: 'result-snippet' } },
      { ref: 'e19', type: 'a', text: 'Logitech MX Master 3S Review', attrs: { href: 'https://www.tomsguide.com/reviews/logitech-mx-master-3s', class: 'result-title' } },
      { ref: 'e20', type: 'span', text: 'www.tomsguide.com', attrs: { class: 'result-url' } },
      { ref: 'e21', type: 'p', text: 'The Logitech MX Master 3S is the best wireless mouse for productivity...', attrs: { class: 'result-snippet' } },
      { ref: 'e22', type: 'a', text: 'Razer DeathAdder V3 Pro - Gaming Mouse', attrs: { href: 'https://www.razer.com/gaming-mice/deathadder-v3-pro', class: 'result-title' } },
      { ref: 'e23', type: 'span', text: 'www.razer.com', attrs: { class: 'result-url' } },
      { ref: 'e24', type: 'p', text: 'Ultra-lightweight wireless gaming mouse with HyperSpeed technology...', attrs: { class: 'result-snippet' } },
      { ref: 'e25', type: 'a', text: 'Wireless Mouse Comparison Chart', attrs: { href: 'https://www.rtings.com/mouse/tools/compare', class: 'result-title' } },
      { ref: 'e26', type: 'span', text: 'www.rtings.com', attrs: { class: 'result-url' } },
      { ref: 'e27', type: 'p', text: 'Side-by-side comparison of the best wireless mice...', attrs: { class: 'result-snippet' } },
      { ref: 'e28', type: 'a', text: '2', attrs: { href: '?q=wireless+mouse&page=2', class: 'pagination' } },
      { ref: 'e29', type: 'a', text: '3', attrs: { href: '?q=wireless+mouse&page=3', class: 'pagination' } },
      { ref: 'e30', type: 'a', text: 'Next', attrs: { href: '?q=wireless+mouse&page=2', class: 'pagination next' } },
    ],
    expected: {
      minActions: 2,
      maxActions: 8,
      requiredTools: ['click'],
      forbiddenTools: [],
      noJSON: true,
      taskComplete: true,
      customValidation: null
    }
  },

  // -------------------------------------------------------------------------
  // 5. GOOGLE SHEETS
  // -------------------------------------------------------------------------
  {
    name: 'Google Sheets Test',
    taskType: 'google-sheets',
    domSnapshotFile: 'test-data/dom-snapshots/google-sheets.yaml',
    mockDOMElements: [
      { ref: 'e1', type: 'div', text: '', attrs: { class: 'docs-menubar', id: 'docs-menubar' } },
      { ref: 'e2', type: 'div', text: 'File', attrs: { class: 'menu-button', id: 'docs-file-menu' } },
      { ref: 'e3', type: 'div', text: 'Edit', attrs: { class: 'menu-button', id: 'docs-edit-menu' } },
      { ref: 'e4', type: 'div', text: 'View', attrs: { class: 'menu-button' } },
      { ref: 'e5', type: 'input', text: '', attrs: { type: 'text', class: 'jfk-textinput', id: 'name-box', 'aria-label': 'Name Box', 'hint': 'nameBox', value: 'A1' } },
      { ref: 'e6', type: 'div', text: '', attrs: { class: 'cell-input formula-bar-input', id: 'formula-bar', contenteditable: 'true' } },
      { ref: 'e7', type: 'button', text: 'Bold', attrs: { class: 'toolbar-btn', id: 'bold-btn', 'aria-label': 'Bold' } },
      { ref: 'e8', type: 'button', text: 'Italic', attrs: { class: 'toolbar-btn', id: 'italic-btn', 'aria-label': 'Italic' } },
      { ref: 'e9', type: 'button', text: 'Underline', attrs: { class: 'toolbar-btn', id: 'underline-btn' } },
      { ref: 'e10', type: 'select', text: '', attrs: { class: 'font-size-select', id: 'font-size' } },
      { ref: 'e11', type: 'button', text: 'Undo', attrs: { class: 'toolbar-btn', id: 'undo-btn' } },
      { ref: 'e12', type: 'button', text: 'Redo', attrs: { class: 'toolbar-btn', id: 'redo-btn' } },
      { ref: 'e13', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'A1', id: 'cell-A1' } },
      { ref: 'e14', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'B1', id: 'cell-B1' } },
      { ref: 'e15', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'C1', id: 'cell-C1' } },
      { ref: 'e16', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'D1', id: 'cell-D1' } },
      { ref: 'e17', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'E1', id: 'cell-E1' } },
      { ref: 'e18', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'A2', id: 'cell-A2' } },
      { ref: 'e19', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'B2', id: 'cell-B2' } },
      { ref: 'e20', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'C2', id: 'cell-C2' } },
      { ref: 'e21', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'D2', id: 'cell-D2' } },
      { ref: 'e22', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'E2', id: 'cell-E2' } },
      { ref: 'e23', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'A3', id: 'cell-A3' } },
      { ref: 'e24', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'B3', id: 'cell-B3' } },
      { ref: 'e25', type: 'div', text: '', attrs: { class: 'waffle-cell', 'data-cell': 'C3', id: 'cell-C3' } },
      { ref: 'e26', type: 'div', text: 'Sheet1', attrs: { class: 'sheet-tab active', id: 'sheet-tab-1' } },
      { ref: 'e27', type: 'div', text: 'Sheet2', attrs: { class: 'sheet-tab', id: 'sheet-tab-2' } },
      { ref: 'e28', type: 'button', text: '+', attrs: { class: 'add-sheet-btn', id: 'add-sheet' } },
      { ref: 'e29', type: 'div', text: '', attrs: { class: 'grid-container', id: 'grid' } },
      { ref: 'e30', type: 'div', text: 'All changes saved', attrs: { class: 'save-status' } },
      { ref: 'e31', type: 'button', text: 'Share', attrs: { class: 'share-btn', id: 'share-btn' } },
      { ref: 'e32', type: 'div', text: 'Row 1', attrs: { class: 'row-header', 'data-row': '1' } },
      { ref: 'e33', type: 'div', text: 'Row 2', attrs: { class: 'row-header', 'data-row': '2' } },
      { ref: 'e34', type: 'div', text: 'A', attrs: { class: 'col-header', 'data-col': 'A' } },
      { ref: 'e35', type: 'div', text: 'B', attrs: { class: 'col-header', 'data-col': 'B' } },
    ],
    expected: {
      minActions: 4,
      maxActions: 25,
      requiredTools: ['keyPress', 'type'],
      forbiddenTools: [],
      noJSON: true,
      taskComplete: true,
      customValidation: function(parsed, mockDOM) {
        // Verify Escape-first pattern (key "Escape" should appear)
        const hasEscape = parsed.actions.some(a =>
          (a.tool === 'keyPress' && a.params.key === 'Escape') ||
          (a.tool === 'keyPress' && a.params.key === 'escape')
        );
        // Verify Name Box click (e5)
        const hasNameBoxClick = parsed.actions.some(a =>
          a.tool === 'click' && a.params.ref === 'e5'
        );
        // Verify type into Name Box (e5) with cell reference
        const hasNameBoxType = parsed.actions.some(a =>
          a.tool === 'type' && a.params.ref === 'e5' && /^[A-Z]+\d+$/i.test(a.params.text || '')
        );
        return {
          passed: hasEscape && (hasNameBoxClick || hasNameBoxType),
          details: {
            hasEscape,
            hasNameBoxClick,
            hasNameBoxType
          }
        };
      }
    }
  },

  // -------------------------------------------------------------------------
  // 6. CAREER SEARCH
  // -------------------------------------------------------------------------
  {
    name: 'Career Search Test',
    taskType: 'career-search',
    domSnapshotFile: 'test-data/dom-snapshots/career-page.yaml',
    mockDOMElements: [
      { ref: 'e1', type: 'a', text: 'Google', attrs: { href: 'https://careers.google.com', class: 'logo-link' } },
      { ref: 'e2', type: 'a', text: 'Home', attrs: { href: '/', class: 'nav-link' } },
      { ref: 'e3', type: 'a', text: 'Teams', attrs: { href: '/teams', class: 'nav-link' } },
      { ref: 'e4', type: 'a', text: 'Locations', attrs: { href: '/locations', class: 'nav-link' } },
      { ref: 'e5', type: 'h1', text: 'Find your next role', attrs: { class: 'hero-title' } },
      { ref: 'e6', type: 'input', text: '', attrs: { type: 'text', placeholder: 'Search job titles, keywords', id: 'job-search', name: 'q', class: 'search-input' } },
      { ref: 'e7', type: 'select', text: '', attrs: { id: 'location-filter', name: 'location', class: 'filter-select' } },
      { ref: 'e8', type: 'option', text: 'All Locations', attrs: { value: '' } },
      { ref: 'e9', type: 'option', text: 'Mountain View, CA', attrs: { value: 'mountain-view' } },
      { ref: 'e10', type: 'option', text: 'New York, NY', attrs: { value: 'new-york' } },
      { ref: 'e11', type: 'option', text: 'Remote', attrs: { value: 'remote' } },
      { ref: 'e12', type: 'button', text: 'Search Jobs', attrs: { type: 'submit', class: 'search-btn', id: 'search-jobs-btn' } },
      { ref: 'e13', type: 'div', text: '', attrs: { class: 'job-results', id: 'results-container' } },
      { ref: 'e14', type: 'h3', text: 'Software Engineer, Frontend', attrs: { class: 'job-title' } },
      { ref: 'e15', type: 'span', text: 'Google', attrs: { class: 'company-name' } },
      { ref: 'e16', type: 'span', text: 'Mountain View, CA', attrs: { class: 'job-location' } },
      { ref: 'e17', type: 'span', text: 'Posted 2 days ago', attrs: { class: 'date-posted' } },
      { ref: 'e18', type: 'p', text: 'Build user-facing products using modern web technologies including React and TypeScript', attrs: { class: 'job-description' } },
      { ref: 'e19', type: 'a', text: 'Apply', attrs: { href: 'https://careers.google.com/jobs/123?src=online&utm_source=careers', class: 'apply-link' } },
      { ref: 'e20', type: 'h3', text: 'Site Reliability Engineer', attrs: { class: 'job-title' } },
      { ref: 'e21', type: 'span', text: 'Google', attrs: { class: 'company-name' } },
      { ref: 'e22', type: 'span', text: 'New York, NY', attrs: { class: 'job-location' } },
      { ref: 'e23', type: 'span', text: 'Posted 5 days ago', attrs: { class: 'date-posted' } },
      { ref: 'e24', type: 'p', text: 'Ensure reliability and availability of Google services at scale', attrs: { class: 'job-description' } },
      { ref: 'e25', type: 'a', text: 'Apply', attrs: { href: 'https://careers.google.com/jobs/456?src=online&utm_source=careers', class: 'apply-link' } },
      { ref: 'e26', type: 'h3', text: 'Machine Learning Engineer', attrs: { class: 'job-title' } },
      { ref: 'e27', type: 'span', text: 'Google', attrs: { class: 'company-name' } },
      { ref: 'e28', type: 'span', text: 'Remote', attrs: { class: 'job-location' } },
      { ref: 'e29', type: 'span', text: 'Posted 1 week ago', attrs: { class: 'date-posted' } },
      { ref: 'e30', type: 'p', text: 'Design and implement ML models for natural language processing and computer vision', attrs: { class: 'job-description' } },
      { ref: 'e31', type: 'a', text: 'Apply', attrs: { href: 'https://careers.google.com/jobs/789?src=online&utm_source=careers', class: 'apply-link' } },
      { ref: 'e32', type: 'a', text: 'Page 1', attrs: { href: '?page=1', class: 'pagination active' } },
      { ref: 'e33', type: 'a', text: 'Page 2', attrs: { href: '?page=2', class: 'pagination' } },
      { ref: 'e34', type: 'a', text: 'Next', attrs: { href: '?page=2', class: 'pagination next' } },
      { ref: 'e35', type: 'span', text: 'Showing 1-3 of 42 jobs', attrs: { class: 'result-count' } },
      { ref: 'e36', type: 'footer', text: '', attrs: { class: 'site-footer' } },
      { ref: 'e37', type: 'a', text: 'Privacy', attrs: { href: '/privacy', class: 'footer-link' } },
      { ref: 'e38', type: 'a', text: 'Terms', attrs: { href: '/terms', class: 'footer-link' } },
      { ref: 'e39', type: 'select', text: '', attrs: { id: 'team-filter', name: 'team', class: 'filter-select' } },
      { ref: 'e40', type: 'option', text: 'All Teams', attrs: { value: '' } },
      { ref: 'e41', type: 'option', text: 'Engineering', attrs: { value: 'engineering' } },
      { ref: 'e42', type: 'option', text: 'Product', attrs: { value: 'product' } },
    ],
    expected: {
      minActions: 3,
      maxActions: 25,
      requiredTools: ['storeJobData'],
      forbiddenTools: [],
      noJSON: true,
      taskComplete: true,
      customValidation: function(parsed, mockDOM) {
        // Check storeJobData has YAML data with required structure
        const storeAction = parsed.actions.find(a => a.tool === 'storeJobData');
        if (!storeAction || !storeAction.params.data) {
          return { passed: false, error: 'No storeJobData action with data found' };
        }
        const data = storeAction.params.data;
        const hasCompany = typeof data.company === 'string' && data.company.length > 0;
        const hasJobs = Array.isArray(data.jobs) && data.jobs.length > 0;
        let jobsValid = true;
        let urlsPreserved = true;
        if (hasJobs) {
          for (const job of data.jobs) {
            if (!job.title) jobsValid = false;
            if (job.applyLink && !job.applyLink.includes('?')) {
              urlsPreserved = false;
            }
          }
        }
        return {
          passed: hasCompany && hasJobs && jobsValid && urlsPreserved,
          details: {
            hasCompany,
            hasJobs,
            jobCount: data.jobs ? data.jobs.length : 0,
            jobsValid,
            urlsPreserved,
            company: data.company
          }
        };
      }
    }
  }
];

// =============================================================================
// MODULE EXPORTS (window scope for options page context)
// =============================================================================

window.CLIValidator = CLIValidator;
window.MockDOM = MockDOM;
window.MockElement = MockElement;
window.FAILURE_TYPES = FAILURE_TYPES;
window.DEFAULT_SUITES = DEFAULT_SUITES;

// CLI Validator Module v1.0.0 -- FSB v10.0 Phase 19
// Loaded via: <script src="utils/cli-validator.js"> in options.html
// Depends on: cli-parser.js (parseCliResponse on window/self scope)
