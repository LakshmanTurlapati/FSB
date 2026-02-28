/**
 * CLI Parser Module for FSB v10.0
 *
 * Converts line-based CLI text commands into {tool, params} action objects
 * compatible with FSB's content script dispatch (FSB.tools[tool](params)).
 *
 * Architecture:
 *   Layer 1 - Tokenizer: Character-by-character state machine that splits
 *     a single command line into {verb, tokens[], flags{}}.
 *   Layer 2 - Command Registry: Lookup table mapping every CLI verb and
 *     alias to canonical tool names and argument schemas.
 *   Layer 3 - Command Mapper: Bridges tokenizer output to {tool, params}
 *     using the registry's arg schemas.
 *
 * No external dependencies -- pure vanilla JavaScript.
 *
 * @module cli-parser
 */

// =============================================================================
// LAYER 1: TOKENIZER
// =============================================================================

/**
 * Tokenizes a single CLI command line into verb, positional arguments, and flags.
 *
 * Handles double-quoted strings, single-quoted strings, backslash escaping
 * (in NORMAL and DOUBLE_QUOTED states only -- not in SINGLE_QUOTED per shell
 * convention), and --flag extraction with value consumption.
 *
 * @param {string} line - A single command line (should be trimmed by caller)
 * @returns {{verb: string, tokens: string[], flags: Object}}
 * @throws {Error} If quotes are unclosed (strict parsing)
 */
function tokenizeLine(line) {
  const tokens = [];
  const flags = {};
  let current = '';
  let state = 'NORMAL'; // NORMAL | DOUBLE_QUOTED | SINGLE_QUOTED
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && state !== 'SINGLE_QUOTED') {
      escaped = true;
      continue;
    }

    switch (state) {
      case 'NORMAL':
        if (ch === '"') {
          state = 'DOUBLE_QUOTED';
        } else if (ch === "'") {
          state = 'SINGLE_QUOTED';
        } else if (ch === ' ' || ch === '\t') {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
        } else {
          current += ch;
        }
        break;

      case 'DOUBLE_QUOTED':
        if (ch === '"') {
          state = 'NORMAL';
        } else {
          current += ch;
        }
        break;

      case 'SINGLE_QUOTED':
        if (ch === "'") {
          state = 'NORMAL';
        } else {
          current += ch;
        }
        break;
    }
  }

  // Push final token if any
  if (current.length > 0) {
    tokens.push(current);
  }

  // Unclosed quote is a parse error (strict parsing)
  if (state !== 'NORMAL') {
    throw new Error('Unclosed quote in command');
  }

  // Extract verb (first token)
  const verb = tokens.shift() || '';

  // Separate flags from positional tokens
  const positional = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].startsWith('--')) {
      const flagName = tokens[i].substring(2);
      // Check if next token is a value (not another flag and not end)
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        flags[flagName] = tokens[i + 1];
        i++; // Skip value token
      } else {
        flags[flagName] = true; // Boolean flag
      }
    } else {
      positional.push(tokens[i]);
    }
  }

  return { verb, tokens: positional, flags };
}

// =============================================================================
// LAYER 2: COMMAND REGISTRY
// =============================================================================

/**
 * Complete lookup table mapping every CLI verb (and alias) to canonical tool
 * names and argument schemas.
 *
 * Each entry:
 *   tool     - Canonical tool name matching FSB.tools key in content/actions.js
 *   args     - Ordered array of argument definitions:
 *                name     - Param name for the output object
 *                type     - 'ref' | 'string' | 'number' | 'json'
 *                optional - If true, missing arg is not an error
 *   signal   - For signal commands (done/fail): 'done' or 'fail'
 *   defaults - Pre-populated params (e.g., scroll direction shorthands)
 *
 * Arg types:
 *   'ref'    - Element ref (e5) or CSS selector ("#btn") -- auto-classified
 *   'string' - Any string value (text, URL, query, etc.)
 *   'number' - Numeric value (parsed with Number())
 *   'json'   - Raw JSON payload (remaining tokens joined and parsed)
 *
 * All keys are lowercase for case-insensitive lookup.
 *
 * @type {Object.<string, {tool: string, args: Array<{name: string, type: string, optional?: boolean}>, signal?: string, defaults?: Object}>}
 */
const COMMAND_REGISTRY = {
  // -- Element interaction --
  click:              { tool: 'click',              args: [{ name: 'ref', type: 'ref' }] },
  rclick:             { tool: 'rightClick',         args: [{ name: 'ref', type: 'ref' }] },
  rightclick:         { tool: 'rightClick',         args: [{ name: 'ref', type: 'ref' }] },
  dblclick:           { tool: 'doubleClick',        args: [{ name: 'ref', type: 'ref' }] },
  doubleclick:        { tool: 'doubleClick',        args: [{ name: 'ref', type: 'ref' }] },
  type:               { tool: 'type',               args: [{ name: 'ref', type: 'ref' }, { name: 'text', type: 'string' }] },
  clear:              { tool: 'clearInput',         args: [{ name: 'ref', type: 'ref' }] },
  clearinput:         { tool: 'clearInput',         args: [{ name: 'ref', type: 'ref' }] },
  focus:              { tool: 'focus',              args: [{ name: 'ref', type: 'ref' }] },
  blur:               { tool: 'blur',               args: [{ name: 'ref', type: 'ref' }] },
  hover:              { tool: 'hover',              args: [{ name: 'ref', type: 'ref' }] },
  selecttext:         { tool: 'selectText',         args: [{ name: 'ref', type: 'ref' }] },
  select:             { tool: 'selectOption',       args: [{ name: 'ref', type: 'ref' }, { name: 'value', type: 'string' }] },
  selectoption:       { tool: 'selectOption',       args: [{ name: 'ref', type: 'ref' }, { name: 'value', type: 'string' }] },
  check:              { tool: 'toggleCheckbox',     args: [{ name: 'ref', type: 'ref' }] },
  togglecheckbox:     { tool: 'toggleCheckbox',     args: [{ name: 'ref', type: 'ref' }] },
  enter:              { tool: 'pressEnter',         args: [{ name: 'ref', type: 'ref', optional: true }] },
  pressenter:         { tool: 'pressEnter',         args: [{ name: 'ref', type: 'ref', optional: true }] },
  gettext:            { tool: 'getText',            args: [{ name: 'ref', type: 'ref' }] },
  getattr:            { tool: 'getAttribute',       args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }] },
  getattribute:       { tool: 'getAttribute',       args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }] },
  setattr:            { tool: 'setAttribute',       args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }, { name: 'value', type: 'string' }] },
  setattribute:       { tool: 'setAttribute',       args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }, { name: 'value', type: 'string' }] },
  clicksearchresult:  { tool: 'clickSearchResult',  args: [{ name: 'ref', type: 'ref' }] },

  // -- Navigation --
  navigate:           { tool: 'navigate',           args: [{ name: 'url', type: 'string' }] },
  goto:               { tool: 'navigate',           args: [{ name: 'url', type: 'string' }] },
  search:             { tool: 'searchGoogle',       args: [{ name: 'query', type: 'string' }] },
  searchgoogle:       { tool: 'searchGoogle',       args: [{ name: 'query', type: 'string' }] },
  refresh:            { tool: 'refresh',            args: [] },
  back:               { tool: 'goBack',             args: [] },
  goback:             { tool: 'goBack',             args: [] },
  forward:            { tool: 'goForward',          args: [] },
  goforward:          { tool: 'goForward',          args: [] },

  // -- Scrolling (shorthand verbs per user decision) --
  scroll:             { tool: 'scroll',             args: [{ name: 'direction', type: 'string', optional: true }] },
  scrolldown:         { tool: 'scroll',             args: [], defaults: { direction: 'down' } },
  scrollup:           { tool: 'scroll',             args: [], defaults: { direction: 'up' } },
  scrolltotop:        { tool: 'scrollToTop',        args: [] },
  scrolltobottom:     { tool: 'scrollToBottom',     args: [] },
  scrolltoelement:    { tool: 'scrollToElement',    args: [{ name: 'ref', type: 'ref' }] },

  // -- Keyboard --
  key:                { tool: 'keyPress',           args: [{ name: 'key', type: 'string' }] },
  keypress:           { tool: 'keyPress',           args: [{ name: 'key', type: 'string' }] },
  presskeysequence:   { tool: 'pressKeySequence',   args: [{ name: 'keys', type: 'string' }] },
  typewithkeys:       { tool: 'typeWithKeys',       args: [{ name: 'text', type: 'string' }] },
  special:            { tool: 'sendSpecialKey',     args: [{ name: 'specialKey', type: 'string' }] },
  sendspecialkey:     { tool: 'sendSpecialKey',     args: [{ name: 'specialKey', type: 'string' }] },
  arrowup:            { tool: 'arrowUp',            args: [] },
  arrowdown:          { tool: 'arrowDown',          args: [] },
  arrowleft:          { tool: 'arrowLeft',          args: [] },
  arrowright:         { tool: 'arrowRight',         args: [] },

  // -- Mouse --
  movemouse:          { tool: 'moveMouse',          args: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }] },

  // -- Waiting/Detection --
  wait:               { tool: 'waitForElement',     args: [{ name: 'selector', type: 'string' }] },
  waitforelement:     { tool: 'waitForElement',     args: [{ name: 'selector', type: 'string' }] },
  waitstable:         { tool: 'waitForDOMStable',   args: [] },
  waitfordomstable:   { tool: 'waitForDOMStable',   args: [] },
  detectloadingstate: { tool: 'detectLoadingState', args: [] },
  verifymessagesent:  { tool: 'verifyMessageSent',  args: [] },

  // -- Information --
  geteditorcontent:   { tool: 'getEditorContent',   args: [] },

  // -- CAPTCHA --
  captcha:            { tool: 'solveCaptcha',       args: [] },
  solvecaptcha:       { tool: 'solveCaptcha',       args: [] },

  // -- Multi-tab --
  opentab:            { tool: 'openNewTab',         args: [{ name: 'url', type: 'string', optional: true }] },
  opennewtab:         { tool: 'openNewTab',         args: [{ name: 'url', type: 'string', optional: true }] },
  switchtab:          { tool: 'switchToTab',        args: [{ name: 'tabId', type: 'number' }] },
  switchtotab:        { tool: 'switchToTab',        args: [{ name: 'tabId', type: 'number' }] },
  closetab:           { tool: 'closeTab',           args: [{ name: 'tabId', type: 'number' }] },
  tabs:               { tool: 'listTabs',           args: [] },
  listtabs:           { tool: 'listTabs',           args: [] },
  getcurrenttab:      { tool: 'getCurrentTab',      args: [] },
  waitfortabload:     { tool: 'waitForTabLoad',     args: [{ name: 'tabId', type: 'number' }] },

  // -- Game --
  game:               { tool: 'gameControl',        args: [{ name: 'action', type: 'string' }] },
  gamecontrol:        { tool: 'gameControl',        args: [{ name: 'action', type: 'string' }] },

  // -- Data tools (background-handled) --
  storejobdata:       { tool: 'storeJobData',       args: [{ name: 'data', type: 'json' }] },
  getstoredjobs:      { tool: 'getStoredJobs',      args: [] },
  fillsheetdata:      { tool: 'fillSheetData',      args: [] },

  // -- Signal commands (not dispatched as actions) --
  done:               { tool: '__done', args: [{ name: 'message', type: 'string', optional: true }], signal: 'done' },
  fail:               { tool: '__fail', args: [{ name: 'message', type: 'string', optional: true }], signal: 'fail' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Classifies a target token as either an element ref (e5, e123) or a CSS selector.
 *
 * Refs follow the eN pattern established by FSB's DOM snapshot system.
 * Everything else is treated as a CSS selector string.
 *
 * @param {string} token - The target token to classify
 * @returns {{ref: string}|{selector: string}}
 */
function classifyTarget(token) {
  if (/^e\d+$/i.test(token)) {
    return { ref: token.toLowerCase() };
  }
  return { selector: token };
}

/**
 * Coerces a token value to the expected argument type.
 *
 * @param {string} value - Raw string token from the tokenizer
 * @param {string} type - Expected type: 'number', 'ref', 'json', or 'string'
 * @returns {*} Coerced value (number, {ref}|{selector} object, parsed JSON, or string)
 * @throws {Error} If coercion fails (NaN for number, invalid JSON)
 */
function coerceValue(value, type) {
  switch (type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) throw new Error(`Expected number, got: "${value}"`);
      return num;
    }
    case 'ref':
      return classifyTarget(value);
    case 'json':
      return JSON.parse(value);
    case 'string':
    default:
      return value;
  }
}

// =============================================================================
// LAYER 3: COMMAND MAPPER
// =============================================================================

/**
 * Modifier flag name mapping for keyPress commands.
 * Short CLI flags (--ctrl) map to full param names (ctrlKey).
 * @type {Object.<string, string>}
 */
const MODIFIER_FLAG_MAP = {
  ctrl: 'ctrlKey',
  shift: 'shiftKey',
  alt: 'altKey',
  meta: 'metaKey',
};

/**
 * Maps tokenized CLI output to a {tool, params} action object using
 * COMMAND_REGISTRY schemas.
 *
 * Handles:
 * - Positional argument assignment based on arg schema order
 * - Ref vs CSS selector discrimination for 'ref' type args
 * - Type coercion (number, json, string)
 * - Flag merging with special handling for keyPress modifiers
 * - selectOption --by-value / --by-index flags
 * - toggleCheckbox --checked / --unchecked flags
 * - Signal commands (done, fail) returning {signal, message}
 * - pressKeySequence comma-separated key splitting
 * - Scroll shorthand defaults
 *
 * @param {{verb: string, tokens: string[], flags: Object}} tokenized - Output from tokenizeLine()
 * @returns {{tool: string, params: Object}|{signal: string, message: string|null}|{error: string}}
 */
function mapCommand(tokenized) {
  const verb = tokenized.verb.toLowerCase();
  const def = COMMAND_REGISTRY[verb];

  if (!def) {
    return { error: `Unknown command: ${tokenized.verb}` };
  }

  // Start params with defaults (e.g., scroll direction shorthands)
  const params = Object.assign({}, def.defaults || {});

  // Assign positional tokens based on arg schema
  let tokenIndex = 0;
  for (let i = 0; i < def.args.length; i++) {
    const argDef = def.args[i];

    // JSON type: join ALL remaining positional tokens (JSON may have been split)
    if (argDef.type === 'json') {
      if (tokenIndex < tokenized.tokens.length) {
        const jsonStr = tokenized.tokens.slice(tokenIndex).join(' ');
        tokenIndex = tokenized.tokens.length; // Consume all remaining
        try {
          params[argDef.name] = coerceValue(jsonStr, 'json');
        } catch (e) {
          return { error: `Invalid JSON for argument "${argDef.name}": ${e.message}` };
        }
      } else if (!argDef.optional) {
        return { error: `Missing required argument: ${argDef.name} for command: ${tokenized.verb}` };
      }
      continue;
    }

    // No more positional tokens available
    if (tokenIndex >= tokenized.tokens.length) {
      if (!argDef.optional) {
        return { error: `Missing required argument: ${argDef.name} for command: ${tokenized.verb}` };
      }
      continue;
    }

    const token = tokenized.tokens[tokenIndex];
    tokenIndex++;

    // Handle ref type: classify as ref or selector
    if (argDef.type === 'ref') {
      const classified = coerceValue(token, 'ref');
      if (classified.ref) {
        params.ref = classified.ref;
      } else {
        params.selector = classified.selector;
      }
      continue;
    }

    // Handle number type
    if (argDef.type === 'number') {
      try {
        params[argDef.name] = coerceValue(token, 'number');
      } catch (e) {
        return { error: `Invalid value for argument "${argDef.name}": ${e.message}` };
      }
      continue;
    }

    // Handle string type (default)
    params[argDef.name] = token;
  }

  // Merge flags into params with special handling
  for (const [flagName, flagValue] of Object.entries(tokenized.flags)) {
    // keyPress modifier key flags: --ctrl -> ctrlKey, --shift -> shiftKey, etc.
    if (MODIFIER_FLAG_MAP[flagName] && def.tool === 'keyPress') {
      params[MODIFIER_FLAG_MAP[flagName]] = true;
      continue;
    }

    // selectOption: --by-value flag renames the second positional arg to 'value'
    if (flagName === 'by-value' && def.tool === 'selectOption') {
      // The positional arg was already assigned to params.value by schema name,
      // so this flag is a no-op (value is the default schema name).
      // However, if the schema used 'text' as default, we would rename here.
      continue;
    }

    // selectOption: --by-index flag renames and coerces the second positional arg
    if (flagName === 'by-index' && def.tool === 'selectOption') {
      // Rename: move the 'value' param to 'index' and coerce to number
      if (params.value !== undefined) {
        try {
          params.index = coerceValue(params.value, 'number');
        } catch (e) {
          return { error: `Invalid index value for selectOption: ${e.message}` };
        }
        delete params.value;
      }
      continue;
    }

    // toggleCheckbox: --checked / --unchecked flags
    if (flagName === 'checked' && def.tool === 'toggleCheckbox') {
      params.checked = true;
      continue;
    }
    if (flagName === 'unchecked' && def.tool === 'toggleCheckbox') {
      params.checked = false;
      continue;
    }

    // General flag: assign to params
    params[flagName] = flagValue;
  }

  // pressKeySequence special handling: split comma-separated keys into array
  if (def.tool === 'pressKeySequence' && typeof params.keys === 'string') {
    params.keys = params.keys.split(',').map(k => k.trim());
  }

  // Signal commands: return {signal, message} instead of {tool, params}
  if (def.signal) {
    return { signal: def.signal, message: params.message || null };
  }

  return { tool: def.tool, params };
}

// =============================================================================
// LAYER 4: RESPONSE PRE-PROCESSOR
// =============================================================================

/**
 * Strips provider-specific wrapping from raw AI text before line parsing.
 *
 * Handles:
 * - Markdown code fences (Gemini pattern): ```bash, ```shell, ```text, ```cli, bare ```
 * - Conversational preamble (Grok pattern): leading text before first recognized command
 * - Trailing conversational text: text after last recognized command
 *
 * @param {string} text - Raw AI response text
 * @returns {string} Cleaned text ready for line-by-line parsing
 */
function preprocessResponse(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // Strip markdown code fences (Gemini pattern)
  cleaned = cleaned.replace(/^```(?:bash|shell|text|cli)?\s*$/gm, '');

  // Split into lines for preamble/trailing stripping
  const lines = cleaned.split('\n');

  // Find the first line that is a recognized command, reasoning (#), or empty
  const firstCmdIndex = lines.findIndex(l => {
    const trimmed = l.trim();
    if (!trimmed) return true; // Empty lines are part of command block
    if (trimmed.startsWith('#')) return true; // Reasoning lines
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    return firstWord in COMMAND_REGISTRY;
  });

  // Discard lines before the first recognized line (conversational preamble)
  let commandLines = lines;
  if (firstCmdIndex > 0) {
    commandLines = lines.slice(firstCmdIndex);
  }

  // Find the LAST line whose first word is in COMMAND_REGISTRY or starts with #
  let lastCmdIndex = -1;
  for (let i = commandLines.length - 1; i >= 0; i--) {
    const trimmed = commandLines[i].trim();
    if (!trimmed) continue; // Skip empty lines when searching backward
    if (trimmed.startsWith('#')) {
      lastCmdIndex = i;
      break;
    }
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    if (firstWord in COMMAND_REGISTRY) {
      lastCmdIndex = i;
      break;
    }
  }

  // Discard lines after the last recognized command (trailing conversational text)
  if (lastCmdIndex >= 0 && lastCmdIndex < commandLines.length - 1) {
    commandLines = commandLines.slice(0, lastCmdIndex + 1);
  }

  return commandLines.join('\n').trim();
}

// =============================================================================
// LAYER 5: RESPONSE PARSER (PUBLIC API)
// =============================================================================

/**
 * Parses a complete AI CLI response into structured actions, reasoning, and errors.
 *
 * This is the public entry point for the CLI parser module. Takes raw AI text
 * output (potentially multi-line, potentially wrapped in code fences or
 * conversational text) and produces a structured result compatible with the
 * existing automation loop.
 *
 * Per-line error isolation (CLI-06): a malformed line does NOT prevent valid
 * commands before and after from being parsed.
 *
 * @param {string} text - Raw AI response text
 * @returns {{
 *   actions: Array<{tool: string, params: Object}>,
 *   reasoning: string[],
 *   errors: Array<{line: string, lineNumber: number, error: string}>,
 *   taskComplete: boolean,
 *   taskFailed: boolean,
 *   result: string|null,
 *   confidence: string,
 *   situationAnalysis: string,
 *   goalAssessment: string,
 *   assumptions: Array,
 *   fallbackPlan: string
 * }}
 */
function parseCliResponse(text) {
  const cleaned = preprocessResponse(text);
  const lines = cleaned.split('\n');

  // Initialize result with compatibility stubs for normalizeResponse shape
  const result = {
    actions: [],
    reasoning: [],
    errors: [],
    taskComplete: false,
    taskFailed: false,
    result: null,
    confidence: 'medium',
    situationAnalysis: '',
    goalAssessment: '',
    assumptions: [],
    fallbackPlan: ''
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip empty / whitespace-only lines silently
    if (!trimmed) continue;

    // Capture reasoning lines (# prefix)
    if (trimmed.startsWith('#')) {
      result.reasoning.push(trimmed.substring(1).trim());
      continue;
    }

    // Parse command line with per-line error isolation (CLI-06)
    try {
      const tokenized = tokenizeLine(trimmed);
      const mapped = mapCommand(tokenized);

      if (mapped.error) {
        result.errors.push({ line: trimmed, lineNumber: i + 1, error: mapped.error });
        continue;
      }

      if (mapped.signal === 'done') {
        result.taskComplete = true;
        result.result = mapped.message || 'Task completed';
        continue;
      }

      if (mapped.signal === 'fail') {
        result.taskComplete = true;
        result.taskFailed = true;
        result.result = mapped.message || 'Task failed';
        continue;
      }

      result.actions.push({ tool: mapped.tool, params: mapped.params });
    } catch (err) {
      result.errors.push({ line: trimmed, lineNumber: i + 1, error: err.message });
    }
  }

  // Set situationAnalysis from reasoning for compatibility
  result.situationAnalysis = result.reasoning.join(' ');

  return result;
}
