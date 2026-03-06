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
  type:               { tool: 'type',               args: [{ name: 'ref', type: 'ref', optional: true }, { name: 'text', type: 'string' }] },
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
  readpage:           { tool: 'readPage',            args: [{ name: 'selector', type: 'string', optional: true }] },

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
  storejobdata:       { tool: 'storeJobData',       args: [{ name: 'data', type: 'json', optional: true }] },
  getstoredjobs:      { tool: 'getStoredJobs',      args: [] },
  fillsheetdata:      { tool: 'fillSheetData',      args: [] },

  // -- Signal commands (not dispatched as actions) --
  done:               { tool: '__done', args: [{ name: 'message', type: 'string', optional: true }], signal: 'done' },
  fail:               { tool: '__fail', args: [{ name: 'message', type: 'string', optional: true }], signal: 'fail' },
  help:               { tool: '__help', args: [{ name: 'verb', type: 'string', optional: true }], signal: 'help' },
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
// YAML BLOCK PARSER (for storeJobData multi-line data)
// =============================================================================

/**
 * Parses a YAML-style indented block following a storejobdata command line.
 *
 * Handles the storeJobData schema:
 *   company: string
 *   jobs: array of objects with title, location, datePosted, applyLink, description
 *
 * Rules:
 * - Top-level keys at 2+ space indent: `  key: value`
 * - Array items: `  - key: value` or `    - key: value` under a parent key
 * - Nested fields under array items: deeper indent `key: value`
 * - Only the FIRST colon on a line is the key-value separator (preserves URLs)
 * - Lines with less than 2-space indent terminate the block
 *
 * No external YAML library -- handles only storeJobData-shaped data.
 *
 * @param {string[]} lines - Full lines array of the CLI response
 * @param {number} startIndex - Index of the storejobdata command line (block starts at startIndex+1)
 * @returns {{data: Object, linesConsumed: number}}
 */
function parseYAMLBlock(lines, startIndex) {
  const data = {};
  let consumed = 0;
  let currentArrayKey = null;
  let currentItem = null;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const raw = lines[i];

    // Check for minimum 2-space indent (YAML block continuation)
    if (!raw || !/^ {2,}/.test(raw)) break;

    consumed++;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Detect indent level
    const indent = raw.search(/\S/);

    // Array item line: starts with "- "
    if (trimmed.startsWith('- ')) {
      const itemContent = trimmed.substring(2).trim();
      // Parse the key: value on the same line as the dash
      const colonIdx = itemContent.indexOf(':');
      if (colonIdx > 0) {
        currentItem = {};
        const key = itemContent.substring(0, colonIdx).trim();
        const val = itemContent.substring(colonIdx + 1).trim();
        currentItem[key] = val;
      } else {
        currentItem = {};
      }
      // Attach to the current array key
      if (currentArrayKey && Array.isArray(data[currentArrayKey])) {
        data[currentArrayKey].push(currentItem);
      }
      continue;
    }

    // Key-value line: split on first colon only
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.substring(0, colonIdx).trim();
      const val = trimmed.substring(colonIdx + 1).trim();

      if (val === '' || val === undefined) {
        // Key with no value -- this starts an array (e.g., "jobs:")
        currentArrayKey = key;
        data[key] = data[key] || [];
        currentItem = null;
      } else if (currentItem && currentArrayKey) {
        // Nested field under an array item
        currentItem[key] = val;
      } else {
        // Top-level scalar key-value
        data[key] = val;
        currentArrayKey = null;
        currentItem = null;
      }
    }
  }

  return { data, linesConsumed: consumed };
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

  // Ref-optional type disambiguation: if only one token was provided and it was consumed
  // as ref/selector but text is missing, check if it's actually text content
  if (def.tool === 'type' && params.text === undefined && (params.ref || params.selector)) {
    const target = params.ref || params.selector;
    const looksLikeRef = /^e\d+$/i.test(target);
    const looksLikeSelector = /^[#.\[]/.test(target);
    if (!looksLikeRef && !looksLikeSelector) {
      // Single token doesn't look like a ref/selector -- treat as text for focused element
      params.text = target;
      delete params.ref;
      delete params.selector;
    }
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
  // Also preserve indented lines (2+ spaces) as YAML block data for storejobdata
  let lastCmdIndex = -1;
  for (let i = commandLines.length - 1; i >= 0; i--) {
    const trimmed = commandLines[i].trim();
    if (!trimmed) continue; // Skip empty lines when searching backward
    if (trimmed.startsWith('#')) {
      lastCmdIndex = i;
      break;
    }
    // Indented lines are YAML block data -- keep searching backward
    if (/^ {2,}/.test(commandLines[i])) continue;
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    if (firstWord in COMMAND_REGISTRY) {
      // If the last non-empty line after this is indented, include those lines too
      lastCmdIndex = i;
      // Scan forward to find the end of any trailing YAML block
      for (let j = i + 1; j < commandLines.length; j++) {
        const jTrimmed = commandLines[j].trim();
        if (!jTrimmed) { lastCmdIndex = j; continue; }
        if (/^ {2,}/.test(commandLines[j])) { lastCmdIndex = j; continue; }
        break;
      }
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

      if (mapped.signal === 'help') {
        result.helpRequested = true;
        result.helpVerb = mapped.message || null;
        continue;
      }

      // YAML block handling for storejobdata: if storejobdata has no inline data,
      // consume subsequent indented lines as a YAML block
      if (mapped.tool === 'storeJobData' && !mapped.params.data) {
        // Check if next line is indented (YAML block follows)
        if (i + 1 < lines.length && /^ {2,}/.test(lines[i + 1])) {
          const yamlResult = parseYAMLBlock(lines, i);
          if (yamlResult.linesConsumed > 0 && Object.keys(yamlResult.data).length > 0) {
            mapped.params.data = yamlResult.data;
            i += yamlResult.linesConsumed; // Skip consumed YAML lines
          }
        }
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

// =============================================================================
// SELF-TEST UTILITY
// =============================================================================

/**
 * Internal validation test for the CLI parser module.
 *
 * NOT auto-executed. Call manually for debugging:
 *   const { _runSelfTest } = require('./ai/cli-parser.js');
 *   const results = _runSelfTest();
 *   console.log(results);
 *
 * Tests 10 representative cases covering all 6 CLI requirements.
 *
 * @returns {{passed: number, failed: number, failures: string[]}}
 */
function _runSelfTest() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(label, condition) {
    if (condition) {
      passed++;
    } else {
      failed++;
      failures.push(label);
    }
  }

  // a. Simple click
  const a = parseCliResponse('click e5');
  assert('a: click tool', a.actions[0].tool === 'click');
  assert('a: click ref', a.actions[0].params.ref === 'e5');

  // b. Type with quoted text
  const b = parseCliResponse('type e12 "hello world"');
  assert('b: type tool', b.actions[0].tool === 'type');
  assert('b: type text', b.actions[0].params.text === 'hello world');

  // c. Navigate URL with special chars
  const c = parseCliResponse('navigate "https://example.com/path?q=test&page=2#section"');
  assert('c: navigate tool', c.actions[0].tool === 'navigate');
  assert('c: navigate url has ?', c.actions[0].params.url.includes('?'));
  assert('c: navigate url has &', c.actions[0].params.url.includes('&'));
  assert('c: navigate url has =', c.actions[0].params.url.includes('='));
  assert('c: navigate url has #', c.actions[0].params.url.includes('#'));

  // d. Reasoning line
  const d = parseCliResponse('# This is my analysis');
  assert('d: reasoning captured', d.reasoning.length === 1);
  assert('d: reasoning text', d.reasoning[0] === 'This is my analysis');
  assert('d: no actions', d.actions.length === 0);

  // e. Done signal
  const e = parseCliResponse('done "task complete"');
  assert('e: taskComplete', e.taskComplete === true);
  assert('e: result', e.result === 'task complete');

  // f. Fail signal
  const f = parseCliResponse('fail "cannot proceed"');
  assert('f: taskComplete', f.taskComplete === true);
  assert('f: taskFailed', f.taskFailed === true);
  assert('f: result', f.result === 'cannot proceed');

  // g. Error isolation (CLI-06)
  const g = parseCliResponse('click e5\nbogus line here\ntype e3 "test"');
  assert('g: two valid actions', g.actions.length === 2);
  assert('g: one error', g.errors.length === 1);
  assert('g: first action click', g.actions[0].tool === 'click');
  assert('g: second action type', g.actions[1].tool === 'type');

  // h. Case insensitivity
  const h = parseCliResponse('CLICK e5');
  assert('h: case insensitive tool', h.actions[0].tool === 'click');

  // i. Alias resolution
  const i_r = parseCliResponse('goto "https://google.com"');
  assert('i: alias resolves', i_r.actions[0].tool === 'navigate');

  // j. Code fence stripping
  const j = parseCliResponse('```bash\nclick e5\n```');
  assert('j: code fence stripped', j.actions.length === 1);
  assert('j: action is click', j.actions[0].tool === 'click');

  // k. YAML block: basic storejobdata with company + 1 job
  const k = parseCliResponse(
    'storejobdata\n' +
    '  company: Acme Corp\n' +
    '  jobs:\n' +
    '    - title: Software Engineer\n' +
    '      location: Remote\n' +
    '      applyLink: https://acme.com/apply/123\n' +
    '      datePosted: 2026-03-01'
  );
  assert('k: storejobdata action', k.actions.length === 1);
  assert('k: storejobdata tool', k.actions[0].tool === 'storeJobData');
  assert('k: company parsed', k.actions[0].params.data && k.actions[0].params.data.company === 'Acme Corp');
  assert('k: jobs is array', Array.isArray(k.actions[0].params.data.jobs));
  assert('k: job title', k.actions[0].params.data.jobs[0].title === 'Software Engineer');
  assert('k: applyLink URL preserved', k.actions[0].params.data.jobs[0].applyLink === 'https://acme.com/apply/123');

  // l. YAML block: multiple jobs with URL colons
  const l = parseCliResponse(
    'storejobdata\n' +
    '  company: Google\n' +
    '  jobs:\n' +
    '    - title: SRE\n' +
    '      location: Mountain View, CA\n' +
    '      applyLink: https://careers.google.com/jobs/123?utm=source\n' +
    '      datePosted: 2026-02-28\n' +
    '    - title: Frontend Dev\n' +
    '      location: New York, NY\n' +
    '      applyLink: https://careers.google.com/jobs/456\n' +
    '      datePosted: 2026-02-27'
  );
  assert('l: two jobs parsed', l.actions[0].params.data.jobs.length === 2);
  assert('l: first job title', l.actions[0].params.data.jobs[0].title === 'SRE');
  assert('l: second job title', l.actions[0].params.data.jobs[1].title === 'Frontend Dev');
  assert('l: URL with query string', l.actions[0].params.data.jobs[0].applyLink.includes('?utm=source'));

  // m. Mixed: CLI commands + storejobdata YAML block + more CLI commands
  const m = parseCliResponse(
    '# Extracted job data\n' +
    'click e5\n' +
    'storejobdata\n' +
    '  company: Meta\n' +
    '  jobs:\n' +
    '    - title: ML Engineer\n' +
    '      location: Menlo Park\n' +
    'done "stored 1 job"'
  );
  assert('m: click + storejobdata + done', m.actions.length === 2);
  assert('m: first is click', m.actions[0].tool === 'click');
  assert('m: second is storeJobData', m.actions[1].tool === 'storeJobData');
  assert('m: company is Meta', m.actions[1].params.data.company === 'Meta');
  assert('m: task complete', m.taskComplete === true);

  return { passed, failed, failures };
}

// =============================================================================
// MODULE EXPORTS
// =============================================================================

// Export for service worker (background.js via importScripts)
if (typeof self !== 'undefined') {
  self.parseCliResponse = parseCliResponse;
  self.CLI_PARSER_VERSION = '1.0.0';
  self._runCliParserSelfTest = _runSelfTest;
}

// Export for testing / Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseCliResponse,
    tokenizeLine,
    mapCommand,
    parseYAMLBlock,
    COMMAND_REGISTRY,
    preprocessResponse,
    _runSelfTest
  };
}

// CLI Parser Module v1.0.0 -- FSB v10.0
// Loaded via: importScripts('ai/cli-parser.js') in background.js
// Public API: parseCliResponse(text) -> {actions, reasoning, errors, taskComplete, result}
