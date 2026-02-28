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
