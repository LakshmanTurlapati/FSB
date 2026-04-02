/**
 * AI start-route planner for automation tasks.
 * Chooses a safe initial URL when automation starts from a restricted page.
 */

const START_ROUTE_MODE_DIRECT = 'direct_url';
const START_ROUTE_MODE_SEARCH = 'search_url';
const START_ROUTE_MODE_STAY = 'stay_put';

function clampRouteConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function trimRouteText(value, maxLength = 160) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
}

function cleanRouteString(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function coerceHttpUrl(value) {
  const cleaned = cleanRouteString(value);
  if (!cleaned) return null;

  const candidate = /^[a-z]+:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    if (/^(chrome|about|edge|brave|chrome-extension):/i.test(candidate)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractRouteTargetLabel(route) {
  if (!route) return 'the selected page';
  if (route.mode === START_ROUTE_MODE_SEARCH) {
    return route.searchQuery ? `search results for "${route.searchQuery}"` : 'search results';
  }
  if (route.siteLabel) return route.siteLabel;
  if (!route.url) return 'the selected page';
  try {
    return new URL(route.url).hostname.replace(/^www\./, '');
  } catch {
    return 'the selected page';
  }
}

function buildSearchRoute(task, options = {}) {
  const searchQuery = trimRouteText(cleanRouteString(options.searchQuery || task || 'browser automation'), 200) || 'browser automation';
  return {
    mode: START_ROUTE_MODE_SEARCH,
    url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
    searchQuery,
    siteLabel: options.siteLabel || 'Google Search',
    confidence: clampRouteConfidence(options.confidence),
    reason: trimRouteText(options.reason || 'AI start route fell back to search.', 220) || 'AI start route fell back to search.',
    source: options.source || 'fallback'
  };
}

function sanitizeRouteDecision(rawDecision, task, options = {}) {
  if (options.explicitTargetUrl) {
    const explicitUrl = coerceHttpUrl(options.explicitTargetUrl);
    if (explicitUrl) {
      return {
        mode: START_ROUTE_MODE_DIRECT,
        url: explicitUrl,
        searchQuery: null,
        siteLabel: options.siteLabel || extractRouteTargetLabel({ url: explicitUrl }),
        confidence: 1,
        reason: trimRouteText(options.reason || 'Using explicit target URL.', 220) || 'Using explicit target URL.',
        source: options.source || 'explicit'
      };
    }
  }

  const fallback = buildSearchRoute(options.fallbackTask || task, {
    searchQuery: options.fallbackQuery,
    reason: options.fallbackReason || 'AI router returned an invalid destination.',
    confidence: 0,
    source: options.source || 'fallback'
  });

  if (!rawDecision || typeof rawDecision !== 'object') {
    return fallback;
  }

  const mode = trimRouteText(String(rawDecision.mode || ''), 32).toLowerCase();
  const reason = trimRouteText(
    rawDecision.reason ||
    rawDecision.rationale ||
    rawDecision.explanation ||
    fallback.reason,
    220
  ) || fallback.reason;
  const confidence = clampRouteConfidence(rawDecision.confidence);

  const inferredUrl = coerceHttpUrl(
    rawDecision.url ||
    rawDecision.targetUrl ||
    rawDecision.target_url ||
    ''
  );
  const searchQuery = trimRouteText(
    cleanRouteString(
      rawDecision.searchQuery ||
      rawDecision.search_query ||
      rawDecision.query ||
      ''
    ),
    200
  );
  const siteLabel = trimRouteText(
    cleanRouteString(rawDecision.siteLabel || rawDecision.site || rawDecision.label || ''),
    80
  );

  if ((mode === START_ROUTE_MODE_DIRECT || (!mode && inferredUrl)) && inferredUrl) {
    return {
      mode: START_ROUTE_MODE_DIRECT,
      url: inferredUrl,
      searchQuery: null,
      siteLabel: siteLabel || extractRouteTargetLabel({ url: inferredUrl }),
      confidence,
      reason,
      source: options.source || 'ai'
    };
  }

  if (mode === START_ROUTE_MODE_STAY && options.allowStayPut) {
    return {
      mode: START_ROUTE_MODE_STAY,
      url: null,
      searchQuery: null,
      siteLabel,
      confidence,
      reason,
      source: options.source || 'ai'
    };
  }

  if (mode === START_ROUTE_MODE_SEARCH || searchQuery) {
    return buildSearchRoute(task, {
      searchQuery: searchQuery || options.fallbackQuery,
      reason,
      confidence,
      source: options.source || 'ai',
      siteLabel: siteLabel || 'Google Search'
    });
  }

  return fallback;
}

function extractProviderText(providerKey, response) {
  switch (providerKey) {
    case 'gemini':
      return response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    case 'anthropic':
      return response?.content?.[0]?.text || '';
    default:
      return response?.choices?.[0]?.message?.content || '';
  }
}

function parseRouteJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

async function resolveTaskStartRoute(task, options = {}) {
  const sourceTask = trimRouteText(task, 400) || 'browser automation';
  if (options.explicitTargetUrl) {
    return sanitizeRouteDecision(null, sourceTask, {
      explicitTargetUrl: options.explicitTargetUrl,
      reason: options.reason || 'Using explicit target URL.',
      source: options.source || 'explicit'
    });
  }

  const settings = options.settings || null;
  if (!settings || typeof UniversalProvider === 'undefined') {
    return buildSearchRoute(sourceTask, {
      reason: 'AI route planner unavailable. Falling back to search.',
      source: options.source || 'fallback'
    });
  }

  const providerKey = settings.modelProvider || settings.provider || 'xai';
  const provider = new UniversalProvider(settings);
  const openTabs = Array.isArray(options.openTabs)
    ? options.openTabs
        .slice(0, 8)
        .map(tab => ({
          title: trimRouteText(tab?.title || '', 80),
          url: trimRouteText(tab?.url || '', 160)
        }))
        .filter(tab => tab.url)
    : [];

  const requestBody = await provider.buildRequest({
    systemPrompt: `You choose the best starting webpage for a browser automation task.

Return ONLY valid JSON:
{"mode":"direct_url|search_url","url":"https://...","searchQuery":"...","siteLabel":"...","confidence":0.0,"reason":"..."}

Rules:
- Use "direct_url" only when the task clearly points to a specific website or first-party page.
- Use "search_url" when the task is ambiguous, multi-site, comparative, or needs discovery.
- Prefer official first-party URLs over blogs, ads, or random deep links.
- Never invent unsupported URLs. If unsure, use "search_url".
- Use https URLs only.
- Keep reason short.`,
    userPrompt: JSON.stringify({
      task: sourceTask,
      triggerSource: options.triggerSource || 'extension',
      currentUrl: options.currentUrl || '',
      currentPageType: options.currentPageType || '',
      openTabs
    })
  }, {});

  if (requestBody.max_tokens) requestBody.max_tokens = 180;
  if (requestBody.generationConfig?.maxOutputTokens) requestBody.generationConfig.maxOutputTokens = 180;

  try {
    const response = await provider.sendRequest(requestBody, {
      timeout: options.timeout || 10000
    });
    const rawText = extractProviderText(providerKey, response);
    const parsed = parseRouteJson(rawText);
    return sanitizeRouteDecision(parsed, sourceTask, {
      fallbackTask: sourceTask,
      fallbackReason: 'AI router returned an invalid destination.',
      source: 'ai'
    });
  } catch (error) {
    return buildSearchRoute(sourceTask, {
      reason: `AI route planner failed: ${trimRouteText(error?.message || 'unknown error', 160)}`,
      source: 'fallback'
    });
  }
}

const taskRouter = {
  START_ROUTE_MODE_DIRECT,
  START_ROUTE_MODE_SEARCH,
  START_ROUTE_MODE_STAY,
  buildSearchRoute,
  sanitizeRouteDecision,
  resolveTaskStartRoute,
  extractRouteTargetLabel
};

if (typeof self !== 'undefined') {
  self.taskRouter = taskRouter;
  self.buildSearchRoute = buildSearchRoute;
  self.sanitizeRouteDecision = sanitizeRouteDecision;
  self.resolveTaskStartRoute = resolveTaskStartRoute;
  self.extractRouteTargetLabel = extractRouteTargetLabel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = taskRouter;
}
