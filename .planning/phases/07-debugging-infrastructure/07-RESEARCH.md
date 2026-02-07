# Phase 7: Debugging Infrastructure - Research

**Researched:** 2026-02-04
**Domain:** Browser Automation Debugging, Action Logging, Element Inspection, Session Replay
**Confidence:** HIGH

## Summary

This research investigates how to implement debugging infrastructure for FSB that provides clear visibility into automation actions and failures. The domain draws from established patterns in testing frameworks (Playwright, Cypress, Puppeteer) and browser developer tools (Chrome DevTools Recorder, Inspector).

The existing FSB codebase already has substantial logging infrastructure in `automation-logger.js` (~940 lines) with comprehensive logging methods, session storage, and export capabilities. The options panel has a "Logs & Debugging" section with session history viewing. However, there are gaps: (1) action logging doesn't consistently capture selector tried, element found status, coordinates, and result; (2) no element inspection mode exists; (3) failure diagnostics are generic; (4) session replay is not implemented; (5) log export is basic JSON without human-readable formatting.

The standard approach in 2026 follows Playwright's trace format: capture complete state snapshots before/after each action, record all selectors tried with element-found status, store coordinates used, and organize data for step-by-step replay. Chrome DevTools Recorder provides the model for recording user flows with multiple selector fallbacks per step.

**Primary recommendation:** Enhance existing AutomationLogger with structured action records, implement ElementInspector class for click-to-inspect mode, add DiagnosticGenerator for clear failure messages, and extend session storage with replay-friendly data structure.

## Standard Stack

This phase uses only native browser APIs and builds on existing FSB infrastructure - no external libraries required.

### Core
| Technology | Purpose | Why Standard |
|------------|---------|--------------|
| `automation-logger.js` (existing) | Logging infrastructure | Already has session storage, export, log methods |
| `MutationObserver` | Real-time DOM change tracking | Native, event-driven |
| `chrome.storage.local` | Persistent session storage | Chrome Extension standard |
| `document.elementsFromPoint()` | Element inspection at coordinates | Native API for click-to-inspect |
| `getBoundingClientRect()` | Element coordinate capture | Native position data |
| `JSON.stringify()` / `Blob` | Export formatting | Native data serialization |

### Supporting
| Technology | Purpose | When to Use |
|------------|---------|-------------|
| `window.getComputedStyle()` | Capture element visibility state | For diagnostic details |
| `element.getAttribute()` | Read ARIA/data attributes | For element inspection |
| Shadow DOM query | Find elements in shadow roots | For complex component inspection |
| `querySelectorWithShadow()` (existing) | Shadow DOM-aware selection | For consistent element finding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom log storage | IndexedDB | IndexedDB is more complex; chrome.storage.local is simpler and sufficient for session logs |
| Full page screenshots | Canvas capture | Screenshots add significant storage; DOM snapshots are more useful for debugging |
| Video recording | MediaRecorder API | Heavy storage, complex; step-by-step logs are more actionable |

**No Installation Required** - All functionality uses native browser APIs and existing FSB infrastructure.

## Architecture Patterns

### Recommended Code Structure
```
content.js (modifications)
  // New debugging infrastructure
  ActionRecorder                # Structured action logging
  ElementInspector              # Click-to-inspect mode
  DiagnosticGenerator           # Clear failure messages

automation-logger.js (enhancements)
  // Enhanced session storage
  logActionAttempt()            # Log selector, found, coords, result
  getReplayData()               # Format session for replay
  exportHumanReadable()         # Generate readable report

options.js (enhancements)
  // Session replay UI
  renderSessionReplay()         # Step-by-step visualization
```

### Pattern 1: Structured Action Record
**What:** Every action attempt is logged with consistent structure capturing all debugging data
**When to use:** For every action execution in content.js handlers
**Example:**
```javascript
// Source: Playwright trace format + Chrome DevTools Recorder pattern
const actionRecord = {
  // Identity
  actionId: crypto.randomUUID(),
  sessionId: currentSessionId,
  timestamp: Date.now(),

  // What was requested
  tool: 'click',
  params: { selector: '#submit-btn', coordinates: { x: 150, y: 250 } },

  // Selector resolution
  selectorTried: '#submit-btn',
  alternativeSelectors: ['[data-testid="submit"]', '.btn-primary'],
  selectorUsed: '#submit-btn',
  selectorIndex: 0,

  // Element found status
  elementFound: true,
  elementDetails: {
    tagName: 'BUTTON',
    id: 'submit-btn',
    className: 'btn btn-primary',
    text: 'Submit',
    isVisible: true,
    isEnabled: true,
    isInViewport: true,
    boundingRect: { x: 100, y: 230, width: 100, height: 40 }
  },

  // Coordinates
  coordinatesUsed: { x: 150, y: 250 },
  coordinateSource: 'element-center', // or 'provided', 'fallback'

  // Result
  success: true,
  error: null,
  hadEffect: true,
  effectDetails: {
    urlChanged: false,
    contentChanged: true,
    focusChanged: true
  },

  // Timing
  duration: 45,
  waitedForStability: true,
  stabilityWaitTime: 200
};
```

### Pattern 2: Element Inspection Mode
**What:** User can click any element to see FSB's view of it (selectors, attributes, interactability)
**When to use:** DEBUG-02 requirement - toggle via keyboard shortcut or UI
**Example:**
```javascript
// Source: Chrome DevTools Inspector pattern + SelectorsHub approach
class ElementInspector {
  constructor() {
    this.isActive = false;
    this.inspectorOverlay = null;
    this.currentElement = null;
  }

  enable() {
    this.isActive = true;
    this.createOverlay();
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
  }

  disable() {
    this.isActive = false;
    this.removeOverlay();
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
  }

  handleMouseMove = (e) => {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element && element !== this.currentElement) {
      this.currentElement = element;
      this.updateOverlay(element);
    }
  };

  handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const element = document.elementFromPoint(e.clientX, e.clientY);
    this.showInspectionPanel(element);
  };

  getElementInspection(element) {
    // Generate the same data FSB would use for automation
    const selectors = generateSelectors(element); // existing function
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return {
      // Identity
      tagName: element.tagName,
      id: element.id,
      className: element.className,

      // Selectors FSB would try
      selectors: selectors,
      preferredSelector: selectors[0],

      // Attributes
      attributes: {
        'data-testid': element.getAttribute('data-testid'),
        'aria-label': element.getAttribute('aria-label'),
        'role': element.getAttribute('role'),
        'type': element.type,
        'name': element.name,
        'href': element.href,
        'value': element.value
      },

      // Interactability (same checks as Phase 2)
      isVisible: style.display !== 'none' && style.visibility !== 'hidden',
      isEnabled: !element.disabled,
      isInViewport: rect.top >= 0 && rect.left >= 0 &&
                    rect.bottom <= window.innerHeight &&
                    rect.right <= window.innerWidth,
      receivesPointerEvents: style.pointerEvents !== 'none',

      // Position
      boundingRect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },

      // Text content
      text: element.innerText?.substring(0, 100)
    };
  }
}
```

### Pattern 3: Diagnostic Messages
**What:** Clear, actionable failure messages instead of generic errors
**When to use:** When action fails - explain WHY with specific detail
**Example:**
```javascript
// Source: Playwright actionability logs + Cypress error messages
const DIAGNOSTIC_MESSAGES = {
  elementNotFound: (selector, alternatives) => ({
    message: 'Element not found',
    details: `Selector "${selector}" did not match any element on the page.`,
    tried: alternatives,
    suggestions: [
      'Element may not exist yet - check if page is still loading',
      'Selector may be stale - try refreshing the page state',
      'Element may be inside an iframe - check frame context'
    ]
  }),

  elementNotVisible: (element, style) => ({
    message: 'Element not visible',
    details: `Element exists but is not visible: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`,
    suggestions: [
      'Element may be hidden by CSS - check parent containers',
      'Element may require scroll into view',
      'Element may be covered by overlay or modal'
    ]
  }),

  elementDisabled: (element) => ({
    message: 'Element disabled',
    details: `Element has disabled=${element.disabled} or aria-disabled=${element.getAttribute('aria-disabled')}`,
    suggestions: [
      'Wait for element to become enabled',
      'Check if prerequisite actions are needed (form validation, etc.)'
    ]
  }),

  clickIntercepted: (element, coveringElement) => ({
    message: 'Click intercepted by overlay',
    details: `Click would hit ${coveringElement.tagName}.${coveringElement.className} instead of target`,
    suggestions: [
      'Close any modal or overlay first',
      'Scroll to bring element into view',
      'Wait for animation to complete'
    ],
    coveringElement: {
      tagName: coveringElement.tagName,
      className: coveringElement.className,
      id: coveringElement.id
    }
  }),

  noEffect: (action, changes) => ({
    message: 'Action had no effect',
    details: `${action} executed but no expected changes detected`,
    changesDetected: Object.entries(changes).filter(([k, v]) => v).map(([k]) => k),
    suggestions: [
      'Element may not be interactive (decoration only)',
      'JavaScript event handler may not be attached',
      'Try alternative selector or action method'
    ]
  })
};

function generateDiagnostic(failureType, context) {
  const generator = DIAGNOSTIC_MESSAGES[failureType];
  if (!generator) {
    return { message: failureType, details: JSON.stringify(context) };
  }
  return generator(...Object.values(context));
}
```

### Pattern 4: Replay-Friendly Session Data
**What:** Structure session data for step-by-step replay in UI
**When to use:** When saving sessions and when user views session history
**Example:**
```javascript
// Source: Chrome DevTools Recorder JSON format + Playwright trace
async function saveReplaySession(sessionId, sessionData) {
  const session = {
    version: '1.0',
    id: sessionId,

    // Session metadata
    metadata: {
      task: sessionData.task,
      startTime: sessionData.startTime,
      endTime: Date.now(),
      status: sessionData.status,
      url: sessionData.startUrl,
      iterationCount: sessionData.iterationCount
    },

    // Steps for replay
    steps: sessionData.actionHistory.map((action, index) => ({
      stepNumber: index + 1,

      // What was attempted
      action: {
        tool: action.tool,
        params: action.params,
        reasoning: action.reasoning
      },

      // Element targeting
      targeting: {
        selectorsTried: action.selectorsTried || [action.params?.selector],
        selectorUsed: action.selectorUsed,
        elementFound: action.elementFound,
        elementDetails: action.elementDetails,
        coordinatesUsed: action.coordinatesUsed
      },

      // Result
      result: {
        success: action.result?.success,
        error: action.result?.error,
        hadEffect: action.result?.hadEffect,
        diagnostic: action.diagnostic
      },

      // State snapshot (before action)
      stateBefore: {
        url: action.stateBefore?.url,
        bodyTextLength: action.stateBefore?.bodyTextLength,
        elementCount: action.stateBefore?.elementCount
      },

      // Timing
      timing: {
        timestamp: action.timestamp,
        duration: action.duration,
        waitTime: action.waitTime
      }
    })),

    // Summary
    summary: {
      totalSteps: sessionData.actionHistory.length,
      successfulSteps: sessionData.actionHistory.filter(a => a.result?.success).length,
      failedSteps: sessionData.actionHistory.filter(a => !a.result?.success).length,
      totalDuration: Date.now() - sessionData.startTime
    }
  };

  return session;
}
```

### Anti-Patterns to Avoid
- **Logging only on failure:** Log every action attempt for complete replay capability
- **Generic error messages:** Always include specific selector, found status, and diagnostic
- **Unbounded log growth:** Existing logger has maxLogs limit; maintain session-based cleanup
- **Synchronous heavy logging:** Keep logging lightweight; defer expensive serialization
- **Losing context on navigation:** Store session data to chrome.storage before navigation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Log storage | Custom file system | `chrome.storage.local` | Chrome's storage is optimized, persistent, and quota-managed |
| Selector generation | New selector algorithm | Existing `generateSelectors()` | Phase 1 already implemented comprehensive selector generation |
| Element interactability | New check functions | Existing `ensureElementReady()` | Phase 2 already implemented readiness checks |
| State capture | New state functions | Existing `captureActionState()` | Phase 6 already implemented state capture/verification |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Native API, cryptographically random |

**Key insight:** Much of the debugging infrastructure already exists in `automation-logger.js` (940 lines). The work is primarily: (1) ensuring action handlers populate logs consistently, (2) adding element inspection mode, (3) enhancing diagnostic messages, and (4) building replay UI.

## Common Pitfalls

### Pitfall 1: Storage Quota Exceeded
**What goes wrong:** Sessions with many actions exceed chrome.storage.local quota (5MB typically)
**Why it happens:** Storing full DOM snapshots or large objects per action
**How to avoid:**
1. Use existing `cleanOldSessions()` to limit to 50 sessions
2. Store only essential data per action (selector, found, coords, result)
3. Truncate long strings (text content, error messages)
4. Don't store full DOM - store metrics (element count, text length)
**Warning signs:** Storage write failures, missing sessions

### Pitfall 2: Performance Impact from Logging
**What goes wrong:** Automation slows down due to synchronous logging
**Why it happens:** Heavy serialization or storage operations in action path
**How to avoid:**
1. Keep action record creation lightweight (no deep cloning)
2. Use existing `persistLogs()` which stores asynchronously
3. Defer expensive operations (export formatting) to explicit user action
4. Only capture what's needed (don't log entire DOM)
**Warning signs:** Actions taking 100ms+ longer than expected

### Pitfall 3: Inspection Mode Interfering with Automation
**What goes wrong:** Element inspection mode captures clicks meant for automation
**Why it happens:** Event listeners in capture phase intercept all clicks
**How to avoid:**
1. Use separate activation (keyboard shortcut or button, not same as automation)
2. Clear indicator when inspection mode is active
3. Ensure inspection mode auto-disables when automation starts
4. Don't enable during active session
**Warning signs:** Actions fail during manual testing

### Pitfall 4: Missing Action Logs
**What goes wrong:** Some actions not logged, session replay incomplete
**Why it happens:** Inconsistent logging across different action handlers
**How to avoid:**
1. Use single entry point for all action logging
2. Call `logActionAttempt()` at start of every tool handler
3. Call `logActionResult()` after every action completes
4. Verify all 25+ tools have logging
**Warning signs:** Replay shows fewer steps than expected

### Pitfall 5: Diagnostics Not Actionable
**What goes wrong:** Error messages say "failed" without explaining why
**Why it happens:** Generic error handling without capturing specific failure reason
**How to avoid:**
1. Capture failure reason at point of failure (not found, not visible, disabled, intercepted)
2. Include selector tried, element state, and covering elements
3. Provide suggestions (not just error description)
4. Use DIAGNOSTIC_MESSAGES patterns consistently
**Warning signs:** Users can't understand why automation failed

## Code Examples

### Integrating Action Logging into Handlers
```javascript
// Source: Existing tools.click pattern + consistent logging
async function executeToolWithLogging(toolName, params, executeCore) {
  const actionId = crypto.randomUUID();
  const startTime = Date.now();

  // Log action attempt
  automationLogger.logActionExecution(currentSessionId, toolName, 'start', {
    actionId,
    params: { selector: params.selector, coordinates: params.coordinates }
  });

  // Track selector resolution
  const selectors = params.selectors || [params.selector];
  let selectorUsed = null;
  let elementDetails = null;
  let diagnostic = null;

  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    const element = querySelectorWithShadow(selector);

    if (!element) {
      automationLogger.logActionExecution(currentSessionId, toolName, 'selector_miss', {
        actionId, selector, index: i
      });
      continue;
    }

    selectorUsed = selector;
    elementDetails = captureElementDetails(element);

    automationLogger.logActionExecution(currentSessionId, toolName, 'selector_hit', {
      actionId, selector, index: i, elementDetails
    });

    // Check readiness
    const readiness = await ensureElementReady(element, toolName);
    if (!readiness.ready) {
      diagnostic = generateDiagnostic(readiness.failureReason, {
        element: elementDetails,
        checks: readiness.checks
      });
      automationLogger.logActionExecution(currentSessionId, toolName, 'not_ready', {
        actionId, diagnostic
      });
      continue;
    }

    // Execute action
    const preState = captureActionState(element, toolName);
    const result = await executeCore(element, params);
    const postState = captureActionState(element, toolName);

    // Verify effect
    const verification = verifyActionEffect(preState, postState, toolName);

    // Log complete result
    const actionRecord = {
      actionId,
      tool: toolName,
      selectorTried: params.selector,
      selectorUsed,
      selectorIndex: i,
      elementFound: true,
      elementDetails,
      coordinatesUsed: elementDetails?.boundingRect ? {
        x: elementDetails.boundingRect.x + elementDetails.boundingRect.width / 2,
        y: elementDetails.boundingRect.y + elementDetails.boundingRect.height / 2
      } : null,
      success: result.success && verification.verified,
      hadEffect: verification.verified,
      error: result.error,
      diagnostic: verification.verified ? null : generateDiagnostic('noEffect', { action: toolName, changes: verification.changes }),
      duration: Date.now() - startTime
    };

    automationLogger.logActionExecution(currentSessionId, toolName, 'complete', actionRecord);

    return {
      ...result,
      actionRecord
    };
  }

  // All selectors failed
  diagnostic = generateDiagnostic('elementNotFound', {
    selector: params.selector,
    alternatives: selectors
  });

  automationLogger.logActionExecution(currentSessionId, toolName, 'failed', {
    actionId,
    diagnostic,
    duration: Date.now() - startTime
  });

  return {
    success: false,
    error: diagnostic.message,
    diagnostic,
    actionRecord: {
      actionId,
      tool: toolName,
      selectorTried: params.selector,
      elementFound: false,
      success: false,
      diagnostic,
      duration: Date.now() - startTime
    }
  };
}

function captureElementDetails(element) {
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    text: element.innerText?.substring(0, 50),
    isVisible: style.display !== 'none' && style.visibility !== 'hidden',
    isEnabled: !element.disabled,
    isInViewport: rect.top >= 0 && rect.left >= 0 &&
                  rect.bottom <= window.innerHeight &&
                  rect.right <= window.innerWidth,
    boundingRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  };
}
```

### Human-Readable Log Export
```javascript
// Source: Existing formatSessionReport pattern + enhanced for debugging
function exportHumanReadable(session) {
  const lines = [];
  const divider = '='.repeat(80);

  lines.push(divider);
  lines.push('FSB AUTOMATION SESSION REPORT');
  lines.push(divider);
  lines.push('');
  lines.push(`Session ID: ${session.id}`);
  lines.push(`Task: ${session.metadata.task}`);
  lines.push(`Status: ${session.metadata.status}`);
  lines.push(`Duration: ${formatDuration(session.metadata.endTime - session.metadata.startTime)}`);
  lines.push(`Steps: ${session.summary.successfulSteps}/${session.summary.totalSteps} successful`);
  lines.push('');

  lines.push(divider);
  lines.push('STEP-BY-STEP EXECUTION');
  lines.push(divider);
  lines.push('');

  session.steps.forEach((step, i) => {
    const status = step.result.success ? '[OK]' : '[FAILED]';
    lines.push(`${status} Step ${step.stepNumber}: ${step.action.tool}`);
    lines.push(`    Selector: ${step.targeting.selectorUsed || step.action.params?.selector || 'N/A'}`);
    lines.push(`    Element Found: ${step.targeting.elementFound ? 'Yes' : 'No'}`);

    if (step.targeting.elementDetails) {
      const el = step.targeting.elementDetails;
      lines.push(`    Element: <${el.tagName}${el.id ? '#'+el.id : ''}${el.className ? '.'+el.className.split(' ')[0] : ''}>`);
    }

    if (step.targeting.coordinatesUsed) {
      lines.push(`    Coordinates: (${step.targeting.coordinatesUsed.x}, ${step.targeting.coordinatesUsed.y})`);
    }

    if (!step.result.success) {
      lines.push(`    Error: ${step.result.error}`);
      if (step.result.diagnostic) {
        lines.push(`    Details: ${step.result.diagnostic.details}`);
        if (step.result.diagnostic.suggestions) {
          lines.push(`    Suggestions:`);
          step.result.diagnostic.suggestions.forEach(s => {
            lines.push(`      - ${s}`);
          });
        }
      }
    }

    lines.push('');
  });

  // Add failure summary if any failures
  const failures = session.steps.filter(s => !s.result.success);
  if (failures.length > 0) {
    lines.push(divider);
    lines.push('FAILURE SUMMARY');
    lines.push(divider);
    lines.push('');

    failures.forEach(step => {
      lines.push(`Step ${step.stepNumber}: ${step.result.diagnostic?.message || step.result.error}`);
    });
  }

  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Console.log debugging | Structured action records with full context | ~2022 | Replayable, searchable logs |
| Generic error messages | Diagnostic messages with suggestions | ~2023 | Actionable debugging |
| Manual element inspection | Click-to-inspect with automation view | ~2020 (DevTools) | See what automation sees |
| Text logs only | Step-by-step visual replay | ~2021 (Playwright) | Understand flow visually |

**Deprecated/outdated:**
- Simple console.log debugging: Not sufficient for understanding automation failures
- Logs without selector information: Can't debug element targeting issues
- Post-mortem-only debugging: Real-time inspection is essential

## Open Questions

1. **Replay Visualization Depth**
   - What we know: Steps can be listed with action/result/diagnostic
   - What's unclear: Should replay show DOM snapshots? Screenshots? Element positions?
   - Recommendation: Start with structured data + element details; add visual snapshots if needed

2. **Element Inspection Activation**
   - What we know: Need keyboard shortcut or button toggle
   - What's unclear: Best key combo that doesn't conflict with sites
   - Recommendation: Use Ctrl+Shift+I (matches Chrome DevTools pattern) with visual indicator

3. **Log Retention Policy**
   - What we know: Current limit is 50 sessions, 5000 logs
   - What's unclear: Is this sufficient? Should old sessions auto-delete?
   - Recommendation: Keep current limits; add per-session log limit (1000 entries)

## Integration with Existing Code

### Existing in automation-logger.js
- **Log methods:** error, warn, info, debug - all implemented
- **Session storage:** saveSession, loadSession, listSessions, deleteSession - all implemented
- **Export:** exportLogs (JSON), formatSessionReport (text) - implemented
- **Timing:** logTiming for performance tracking - implemented
- **Action logging:** logAction, logActionExecution - partially implemented

### Existing in content.js
- **captureActionState:** Lines 2850-2940 - captures global state, element state, ARIA state
- **verifyActionEffect:** Lines 3055-3119 - verifies action had expected effect
- **tools handlers:** 25+ action handlers - need consistent logging

### Existing in options.html/js
- **Logs section:** Log display, filtering, export buttons
- **Session history:** List view, detail panel, download button

### Gap Analysis
| Capability | Currently | Needed |
|------------|-----------|--------|
| Action logging with selector/found/coords | Partial (click has state capture) | All handlers consistently |
| Element inspection mode | None | New ElementInspector class |
| Diagnostic messages | Generic errors | DiagnosticGenerator with suggestions |
| Session replay | List of logs | Step-by-step visualization |
| Human-readable export | JSON only | Formatted text report |

## Sources

### Primary (HIGH confidence)
- **Existing FSB automation-logger.js** - Complete logging infrastructure (940 lines)
- **Existing FSB content.js** - captureActionState, verifyActionEffect patterns
- **Chrome DevTools Recorder** - https://developer.chrome.com/docs/devtools/recorder
- **Playwright Trace Viewer** - https://playwright.dev/docs/trace-viewer

### Secondary (MEDIUM confidence)
- **Chrome DevTools Inspector** - https://developer.chrome.com/docs/devtools/inspect-mode
- **SelectorsHub patterns** - Element inspection with automation selectors
- **Cypress time-travel** - https://docs.cypress.io/ (debugging patterns)

### Tertiary (LOW confidence)
- General web search on browser automation debugging 2026

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing FSB infrastructure and native APIs
- Architecture patterns: HIGH - Based on established tools (Playwright, DevTools)
- Pitfalls: HIGH - Based on existing storage limits and performance considerations
- Code examples: HIGH - Adapted from existing FSB patterns

**Research date:** 2026-02-04
**Valid until:** 60 days (stable domain, patterns unlikely to change)
