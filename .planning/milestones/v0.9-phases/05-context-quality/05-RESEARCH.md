# Phase 5: Context Quality - Research

**Researched:** 2026-02-04
**Domain:** DOM filtering, semantic element descriptions, AI context optimization
**Confidence:** HIGH

## Summary

This phase addresses a critical bottleneck in FSB's browser automation: the AI receives too much DOM noise (300+ elements) when it only needs approximately 50 relevant ones. The research investigated how modern browser automation tools (Browser-Use, Skyvern, Vercel's agent-browser) solve this problem and identified established patterns for DOM filtering, semantic element descriptions, and context structuring.

The codebase already contains substantial infrastructure for this work - `inferElementPurpose()`, `generateElementDescription()`, `detectPageContext()`, and the `DOMStateManager` class. However, these capabilities are underutilized and the filtering is not aggressive enough. The primary recommendation is to apply a layered filtering strategy that reduces elements in stages (visibility -> interactivity -> task relevance -> viewport priority) and generates semantic descriptions that combine element type, purpose, and relationship context.

**Primary recommendation:** Implement a 3-stage element reduction pipeline (Raw DOM -> Interactive Filter -> Task-Relevant Filter) targeting 50 elements maximum, with semantic descriptions in the format "Submit button [primary-action:submit] in checkout form".

## Standard Stack

This phase works with existing browser APIs and does not require external libraries.

### Core
| API/Pattern | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| DOM APIs | Native | Element traversal and filtering | Browser-native, no dependencies |
| ARIA/Accessibility APIs | W3C Standard | Semantic role extraction | Industry standard for describing element purpose |
| Intersection Observer | Native | Viewport detection | Performance-optimized visibility checking |
| MutationObserver | Native | Change tracking | Already implemented in codebase |

### Supporting
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Element Reference Tokens | Compact AI context | When token count is critical |
| Hierarchical JSON | Structured context | For page structure summaries |
| Purpose-based grouping | Organized element lists | For task-relevant filtering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DOM parsing | Vision models (like Skyvern) | Vision requires screenshots, adds latency, but handles dynamic UIs better |
| Full accessibility tree | Selective ARIA extraction | Full tree is comprehensive but expensive; selective is faster but may miss elements |
| CSS selectors | Semantic locators (@e1, @e2) | Semantic refs are more stable but require mapping layer |

**Installation:**
No new packages required - this phase uses existing browser APIs.

## Architecture Patterns

### Recommended Module Structure
```
content.js additions:
  - elementFilter.js (new)     # Layered filtering pipeline
  - semanticDescriber.js (new) # Enhanced description generation
  - contextBuilder.js (new)    # AI context structuring

ai-integration.js modifications:
  - formatSemanticContext()    # Enhanced context formatting
  - buildPrompt()              # Use filtered elements
```

### Pattern 1: Three-Stage Element Reduction Pipeline

**What:** A progressive filtering approach that reduces elements in stages, each with clear criteria.

**When to use:** Every DOM capture before sending to AI.

**Example:**
```javascript
// Stage 1: Visibility Filter (300 -> ~150 elements)
function filterByVisibility(elements) {
  return elements.filter(el => {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    return rect.width > 0 &&
           rect.height > 0 &&
           styles.display !== 'none' &&
           styles.visibility !== 'hidden' &&
           parseFloat(styles.opacity) > 0 &&
           !el.getAttribute('aria-hidden');
  });
}

// Stage 2: Interactivity Filter (150 -> ~80 elements)
function filterByInteractivity(elements) {
  const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
  const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio',
                            'combobox', 'listbox', 'menuitem', 'tab'];

  return elements.filter(el => {
    if (interactiveTags.includes(el.tagName)) return true;
    if (interactiveRoles.includes(el.getAttribute('role'))) return true;
    if (el.onclick || el.hasAttribute('onclick')) return true;
    if (el.tabIndex >= 0) return true;
    if (el.contentEditable === 'true') return true;
    return false;
  });
}

// Stage 3: Task-Relevance Filter (80 -> ~50 elements)
function filterByTaskRelevance(elements, taskType, pageContext) {
  // Priority scoring based on task type
  const scored = elements.map(el => ({
    element: el,
    score: calculateRelevanceScore(el, taskType, pageContext)
  }));

  // Sort by score, take top 50
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map(item => item.element);
}
```

### Pattern 2: Semantic Description Format

**What:** A structured description format that combines element type, purpose classification, and relationship context.

**When to use:** For every element returned to the AI.

**Example:**
```javascript
// Format: "[type] [purpose:intent] [location context]"
function generateSemanticDescription(element, parentContext) {
  const parts = [];

  // 1. Element type with specificity
  const typeDesc = getTypeDescription(element);
  parts.push(typeDesc);

  // 2. Purpose classification from inferElementPurpose()
  const purpose = inferElementPurpose(element);
  if (purpose.role !== 'unknown') {
    parts.push(`[${purpose.role}:${purpose.intent}]`);
  }

  // 3. Primary label/text
  const label = element.getAttribute('aria-label') ||
                element.textContent?.trim().slice(0, 30) ||
                element.placeholder;
  if (label) {
    parts.push(`"${label}"`);
  }

  // 4. Relationship context
  const context = getRelationshipContext(element);
  if (context) {
    parts.push(context);
  }

  return parts.join(' ');
}

// Examples:
// "button [primary-action:submit] 'Complete Purchase' in checkout form"
// "text input [credential-input:email] with placeholder 'Enter email' in login form"
// "link [navigation:next-step] 'Continue' in checkout-steps navigation"
```

### Pattern 3: Hierarchical Page Structure Summary

**What:** A compact summary of page regions and their contents for AI context.

**When to use:** At the start of each page context, before element list.

**Example:**
```javascript
function generatePageStructureSummary(pageContext, elements) {
  return {
    pageType: pageContext.pageIntent,
    pageState: summarizePageState(pageContext.pageState),
    regions: {
      header: summarizeRegion(elements, 'header'),
      navigation: summarizeRegion(elements, 'nav'),
      main: summarizeRegion(elements, 'main'),
      forms: summarizeForms(elements),
      footer: summarizeRegion(elements, 'footer')
    },
    primaryActions: pageContext.primaryActions.slice(0, 3),
    warnings: getPageWarnings(pageContext)
  };
}

// Output format:
{
  "pageType": "checkout",
  "pageState": "ready",
  "regions": {
    "header": "logo, cart icon (2 items), account menu",
    "navigation": "breadcrumb: Home > Cart > Checkout",
    "main": "payment form with 5 fields, order summary",
    "forms": [{"id": "payment-form", "fields": 5, "hasSubmit": true}],
    "footer": "help links, legal links"
  },
  "primaryActions": [
    {"text": "Complete Purchase", "type": "submit", "selector": "#checkout-btn"}
  ],
  "warnings": []
}
```

### Pattern 4: Element Reference Token System

**What:** Short, stable references (@e1, @e2) that map to elements, reducing context size.

**When to use:** When further token reduction is needed (optional optimization).

**Example:**
```javascript
class ElementReferenceManager {
  constructor() {
    this.refs = new Map();
    this.counter = 0;
  }

  assignRef(element, description) {
    const ref = `@e${++this.counter}`;
    this.refs.set(ref, {
      selector: element.selectors[0],
      description: description
    });
    return ref;
  }

  // Output for AI:
  // @e1: button "Submit" [primary-action]
  // @e2: input[email] "Email address"
  // @e3: link "Forgot password"

  resolveRef(ref) {
    return this.refs.get(ref);
  }
}
```

### Anti-Patterns to Avoid

- **Sending all DOM elements:** Causes token bloat (15,000+ tokens per page)
- **Filtering only by visibility:** Still includes many non-interactive elements
- **Generic element descriptions:** "button" is less useful than "submit button in checkout form"
- **Ignoring element relationships:** Context like "in navigation" or "in form" is critical
- **Static filtering:** Should adapt based on task type (search vs form fill vs navigation)

## Don't Hand-Roll

Problems that look simple but have existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element purpose classification | Keyword matching | `inferElementPurpose()` | Already handles 20+ intent patterns |
| Page type detection | URL pattern matching | `detectPageContext()` | Already detects 11 page types |
| Element descriptions | String concatenation | `generateElementDescription()` | Already handles type, aria, text |
| Visibility checking | Manual style checks | `isElementVisible()` | Already handles display, visibility, opacity |
| Selector generation | Manual ID/class extraction | `generateSelectors()` | Already handles ARIA, data-testid, semantic |

**Key insight:** The codebase has comprehensive infrastructure; the task is to wire these together into a coherent pipeline and make filtering more aggressive.

## Common Pitfalls

### Pitfall 1: Over-filtering Critical Elements
**What goes wrong:** Aggressive filtering removes elements the AI needs for the task.
**Why it happens:** Static filtering rules don't consider task context.
**How to avoid:**
- Always include elements matching primary action patterns for the task type
- Keep form fields when task involves data entry
- Keep navigation links when task involves browsing
**Warning signs:** AI asks for elements that exist but weren't provided.

### Pitfall 2: Inconsistent Element Identifiers
**What goes wrong:** Element IDs change between captures, confusing the AI.
**Why it happens:** Using position-based or auto-incremented IDs.
**How to avoid:**
- Use semantic IDs based on element properties (already implemented as `generateSemanticElementId()`)
- Hash stable properties (tag, aria-label, text content, role)
**Warning signs:** AI references "submit button" but selector points to wrong element.

### Pitfall 3: Missing Relationship Context
**What goes wrong:** AI clicks wrong "Submit" button because multiple exist.
**Why it happens:** Description doesn't include parent form or region context.
**How to avoid:**
- Always include nearest structural ancestor (form, nav, section)
- Include form ID or name when element is in a form
- Include region type (header, footer, sidebar, main)
**Warning signs:** AI selects first matching element instead of contextually correct one.

### Pitfall 4: Token Bloat in Action History
**What goes wrong:** Context window fills up with action history, leaving no room for DOM.
**Why it happens:** Including full selector and result details for each action.
**How to avoid:**
- Limit action history to 5 recent actions (already implemented but verify)
- Summarize results instead of full detail
- Only include relevant actions for current step
**Warning signs:** Prompts exceed 10,000 tokens, API timeouts.

### Pitfall 5: Ignoring Dynamic Content
**What goes wrong:** AI operates on stale element list after page update.
**Why it happens:** Filtering happens once, doesn't account for AJAX/SPA updates.
**How to avoid:**
- Re-filter after significant DOM changes
- Use MutationObserver to detect changes (already implemented)
- Mark elements that appeared after last action
**Warning signs:** AI tries to click elements that no longer exist.

## Code Examples

### Element Filtering Pipeline (Complete Implementation)
```javascript
// Source: Synthesized from agent-browser and browser-use patterns
function getFilteredElements(options = {}) {
  const {
    maxElements = 50,
    prioritizeViewport = true,
    taskType = 'general'
  } = options;

  // Stage 1: Get all potentially relevant elements
  const allElements = document.querySelectorAll(
    'button, a, input, select, textarea, ' +
    '[role="button"], [role="link"], [role="textbox"], ' +
    '[onclick], [tabindex]:not([tabindex="-1"]), ' +
    'label, [contenteditable="true"]'
  );

  // Stage 2: Apply visibility filter
  const visible = Array.from(allElements).filter(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const styles = getComputedStyle(el);
    if (styles.display === 'none') return false;
    if (styles.visibility === 'hidden') return false;
    if (parseFloat(styles.opacity) === 0) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;

    return true;
  });

  // Stage 3: Score by relevance
  const scored = visible.map(el => ({
    element: el,
    score: calculateElementScore(el, taskType, prioritizeViewport)
  }));

  // Stage 4: Sort and limit
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxElements)
    .map(item => item.element);
}

function calculateElementScore(element, taskType, prioritizeViewport) {
  let score = 0;

  // Viewport bonus
  if (prioritizeViewport) {
    const rect = element.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
      score += 10;
    }
  }

  // Purpose-based scoring using existing inferElementPurpose
  const purpose = inferElementPurpose(element);
  if (purpose.priority === 'high') score += 8;
  if (purpose.priority === 'medium') score += 4;

  // Task-type alignment
  if (taskType === 'search' && purpose.role === 'search-input') score += 5;
  if (taskType === 'form' && purpose.role.includes('input')) score += 5;
  if (taskType === 'navigation' && purpose.role === 'navigation-link') score += 5;

  // Interactive element bonus
  if (['BUTTON', 'A', 'INPUT'].includes(element.tagName)) score += 3;

  // Has accessible name
  if (element.getAttribute('aria-label') || element.textContent?.trim()) score += 2;

  return score;
}
```

### Enhanced Semantic Description
```javascript
// Source: Enhanced version of existing generateElementDescription
function generateEnhancedDescription(element) {
  const purpose = inferElementPurpose(element);
  const parts = [];

  // Type with specificity
  const type = getElementType(element);
  parts.push(type);

  // Purpose classification
  if (purpose.role !== 'unknown') {
    parts.push(`[${purpose.role}:${purpose.intent}]`);
  }

  // Flags for sensitive/danger
  if (purpose.sensitive) parts.push('[SENSITIVE]');
  if (purpose.danger) parts.push('[DANGER]');

  // Primary label
  const label = getAccessibleName(element);
  if (label && label.length <= 40) {
    parts.push(`"${label}"`);
  }

  // Relationship context
  const relationship = getRelationshipContext(element);
  if (relationship) {
    parts.push(relationship);
  }

  return parts.join(' ');
}

function getRelationshipContext(element) {
  // Check for form context
  const form = element.closest('form');
  if (form) {
    const formId = form.id || form.name || form.getAttribute('aria-label');
    if (formId) return `in "${formId}" form`;
    const formAction = form.action;
    if (formAction?.includes('login')) return 'in login form';
    if (formAction?.includes('search')) return 'in search form';
    if (formAction?.includes('checkout')) return 'in checkout form';
    return 'in form';
  }

  // Check for navigation context
  const nav = element.closest('nav, [role="navigation"]');
  if (nav) {
    const navLabel = nav.getAttribute('aria-label');
    if (navLabel) return `in "${navLabel}" navigation`;
    return 'in navigation';
  }

  // Check for region context
  const region = element.closest('header, footer, main, aside, [role="region"]');
  if (region) {
    return `in ${region.tagName.toLowerCase()}`;
  }

  return null;
}

function getAccessibleName(element) {
  // Priority order for accessible name
  return element.getAttribute('aria-label') ||
         element.getAttribute('title') ||
         element.textContent?.trim() ||
         element.placeholder ||
         element.alt ||
         element.value;
}
```

### Page Structure Summary
```javascript
// Source: Enhanced version of existing detectPageContext
function generatePageSummary() {
  const pageContext = detectPageContext();

  return {
    type: pageContext.pageIntent,
    state: getPageStateDescription(pageContext.pageState),
    structure: {
      forms: summarizeForms(),
      navigation: summarizeNavigation(),
      mainContent: summarizeMainContent()
    },
    primaryActions: pageContext.primaryActions.slice(0, 3).map(a => ({
      label: a.text,
      type: a.type,
      selector: a.selector
    })),
    errors: pageContext.pageState.errorMessages || [],
    warnings: getPageWarnings(pageContext)
  };
}

function summarizeForms() {
  const forms = document.querySelectorAll('form');
  return Array.from(forms).map(form => {
    const fields = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');

    return {
      id: form.id || form.name || null,
      fieldCount: fields.length,
      hasSubmit: !!submitBtn,
      submitLabel: submitBtn?.textContent?.trim() || submitBtn?.value
    };
  });
}

function getPageStateDescription(pageState) {
  if (pageState.hasCaptcha) return 'CAPTCHA present - may need human intervention';
  if (pageState.hasErrors) return 'Errors displayed - check error messages';
  if (pageState.isLoading) return 'Loading content - wait before acting';
  if (pageState.hasModal) return 'Modal/dialog open - interact with modal first';
  if (pageState.hasSuccess) return 'Success state - action may be complete';
  return 'Ready for interaction';
}
```

### Action History for AI Context
```javascript
// Source: Enhanced version for ai-integration.js
function formatActionHistoryForAI(actionHistory, maxActions = 5) {
  if (!actionHistory || actionHistory.length === 0) {
    return 'No actions taken yet.';
  }

  const recent = actionHistory.slice(-maxActions);
  const skipped = actionHistory.length - recent.length;

  let output = `Recent actions (last ${recent.length} of ${actionHistory.length}):`;
  if (skipped > 0) {
    output += ` (${skipped} earlier actions omitted)`;
  }
  output += '\n';

  recent.forEach((action, i) => {
    const status = action.result?.success ? 'OK' : 'FAILED';
    const target = summarizeTarget(action);
    const effect = summarizeEffect(action.result);

    output += `${i + 1}. ${action.tool}(${target}) -> ${status}`;
    if (effect) output += ` [${effect}]`;
    if (!action.result?.success && action.result?.error) {
      output += ` Error: ${action.result.error.slice(0, 50)}`;
    }
    output += '\n';
  });

  return output;
}

function summarizeTarget(action) {
  if (action.params?.selector) {
    // Shorten selector for readability
    const sel = action.params.selector;
    if (sel.length > 30) {
      return sel.slice(0, 27) + '...';
    }
    return sel;
  }
  if (action.params?.text) {
    return `"${action.params.text.slice(0, 20)}..."`;
  }
  if (action.params?.url) {
    return action.params.url.split('/').slice(-2).join('/');
  }
  return 'target';
}

function summarizeEffect(result) {
  if (!result) return null;
  if (result.hadEffect === false) return 'no visible change';
  if (result.validationPassed === false) return 'value not entered';
  if (result.navigationOccurred) return 'page changed';
  if (result.formSubmitted) return 'form submitted';
  return null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full DOM dump | Filtered interactive elements | 2024-2025 | 93% token reduction |
| CSS selectors | Semantic locators (ARIA) | 2024-2025 | More stable element targeting |
| Generic descriptions | Purpose-based descriptions | 2025 | Better AI decision making |
| Static filtering | Task-adaptive filtering | 2025-2026 | Higher automation success rate |
| Raw accessibility tree | Pruned semantic tree | 2025 | Fits in context windows |

**Deprecated/outdated:**
- Sending full page HTML to AI (too many tokens)
- Position-based element IDs (unstable across renders)
- Fixed element count limits (should be adaptive to task)

## Open Questions

1. **Optimal element count threshold**
   - What we know: 50 is a common target, but may vary by task complexity
   - What's unclear: Should limit be 50, 30, or adaptive per page?
   - Recommendation: Start with 50, add telemetry, adjust based on success rate

2. **Element reference tokens (@e1, @e2)**
   - What we know: Vercel's agent-browser uses this for 93% token savings
   - What's unclear: Whether this adds complexity that hurts FSB's reliability
   - Recommendation: Implement as optional optimization, not primary approach

3. **Vision model fallback**
   - What we know: Skyvern uses vision for layout understanding
   - What's unclear: Whether FSB should add vision for complex UIs
   - Recommendation: Defer to future phase; DOM approach is sufficient for now

## Sources

### Primary (HIGH confidence)
- FSB codebase analysis: `content.js:5831-6012` (inferElementPurpose)
- FSB codebase analysis: `content.js:6015-6069` (generateElementDescription)
- FSB codebase analysis: `content.js:6587-6720` (detectPageContext)
- FSB codebase analysis: `content.js:6973-7400` (getStructuredDOM)
- FSB codebase analysis: `ai-integration.js:1556-1661` (formatSemanticContext)

### Secondary (MEDIUM confidence)
- [Browser-Use DOM handling](https://www.oreateai.com/blog/technical-principles-and-application-practices-of-the-browser-automation-tool-browseruse-for-large-models/2f624547f3a8b9e61afcffcf39acd4cd) - State Representation Engine, semantic labeling
- [Vercel agent-browser](https://github.com/vercel-labs/agent-browser) - Element reference tokens, filtering options
- [Context efficiency patterns](https://paddo.dev/blog/agent-browser-context-efficiency/) - Token reduction strategies
- [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots) - Accessibility tree representations
- [GPT-ARIA experiment](https://taras.glek.net/posts/gpt-aria-experiment/) - ARIA tree for LLM context

### Tertiary (LOW confidence)
- [AI browser automation 2026](https://www.browserless.io/blog/state-of-ai-browser-automation-2026) - Industry trends
- [Addy Osmani LLM workflow](https://addyo.substack.com/p/my-llm-coding-workflow-going-into) - Context packing principles

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing browser APIs, no external dependencies
- Architecture patterns: HIGH - Based on established patterns and existing codebase
- Pitfalls: MEDIUM - Based on experience with similar systems, some extrapolation
- Code examples: HIGH - Built on existing codebase functions

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable domain, patterns unlikely to change)
