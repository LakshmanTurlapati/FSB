/**
 * Sitemap Refiner (Tier 2) - AI-powered site map enrichment
 * Takes a Tier 1 sitePattern and raw research data, sends a single
 * focused prompt to the user's configured AI model, and merges
 * workflow detection, navigation strategies, and tips back into
 * the sitePattern.
 *
 * Uses the existing UniversalProvider class from ai/universal-provider.js
 * to call whichever provider the user has configured.
 *
 * Throws on failure so callers can handle errors explicitly.
 */

const REFINER_TIMEOUT_MS = 30000;

/**
 * Build a concise prompt payload from Tier 1 data.
 * We deliberately omit raw element arrays to keep token usage low.
 */
function buildRefinerPrompt(sitePattern, researchData) {
  // Summarise pages
  const pageSummary = {};
  if (sitePattern.pages) {
    for (const [path, info] of Object.entries(sitePattern.pages)) {
      pageSummary[path] = {
        title: info.title || '',
        elements: info.elementCount || 0,
        forms: info.formCount || 0,
        links: info.linkCount || 0
      };
    }
  }

  // Summarise navigation
  const navItems = (sitePattern.navigation || []).map(n => `${n.label} -> ${n.path}`);

  // Summarise forms
  const formSummary = (sitePattern.forms || []).map(f => ({
    page: f.page,
    fields: f.fields,
    action: f.action
  }));

  const userContent = [
    `Domain: ${sitePattern.domain || 'unknown'}`,
    '',
    'Pages:',
    JSON.stringify(pageSummary, null, 2),
    '',
    'Navigation items:',
    navItems.length > 0 ? navItems.join('\n') : '(none detected)',
    '',
    'Forms:',
    formSummary.length > 0 ? JSON.stringify(formSummary, null, 2) : '(none detected)'
  ].join('\n');

  return {
    systemPrompt: [
      'You are a web automation expert. Analyze the following site map and provide navigation intelligence.',
      'Respond with ONLY valid JSON, no markdown fences, no explanation. The JSON must have these keys:',
      '- "workflows": array of strings describing common user flows (e.g. "Job search: /jobs -> use search form -> click result -> /jobs/view/{id}")',
      '- "tips": array of strings with automation-relevant observations (AJAX loading, multi-step forms, etc.)',
      '- "pagePurposes": object mapping path to a short description of what the page does',
      '- "selectorPreferences": object with a "note" key describing which selectors the site favours (data-testid, aria-label, etc.)',
      '- "navigationStrategy": a single string describing the best way to navigate this site'
    ].join('\n'),
    userPrompt: userContent
  };
}

/**
 * Read the user's AI configuration from chrome.storage.local and
 * return a settings object compatible with UniversalProvider.
 */
async function loadProviderSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'modelProvider', 'modelName', 'apiKey',
      'geminiApiKey', 'openaiApiKey', 'anthropicApiKey',
      'customApiKey', 'customEndpoint'
    ], (result) => {
      resolve({
        modelProvider: result.modelProvider || 'xai',
        modelName: result.modelName || 'grok-4-1-fast-reasoning',
        apiKey: result.apiKey || '',
        geminiApiKey: result.geminiApiKey || '',
        openaiApiKey: result.openaiApiKey || '',
        anthropicApiKey: result.anthropicApiKey || '',
        customApiKey: result.customApiKey || '',
        customEndpoint: result.customEndpoint || ''
      });
    });
  });
}

/**
 * Refine a Tier 1 sitePattern with AI-generated intelligence.
 *
 * @param {Object} sitePattern - The Tier 1 site pattern from convertToSiteMap()
 * @param {Object|null} researchData - Optional raw research data for extra context
 * @param {Object} [config] - Optional override config (provider settings)
 * @returns {Promise<Object>} Enriched sitePattern with refined: true
 * @throws {Error} On missing API key, provider unavailability, or AI response issues
 */
async function refineSiteMapWithAI(sitePattern, researchData, config) {
  if (!sitePattern) throw new Error('No site pattern provided');

  // Load provider settings (config override or from storage)
  const settings = config || await loadProviderSettings();

  // Validate API key exists for selected provider
  const provider_name = settings.modelProvider || 'xai';
  const keyMap = {
    xai: settings.apiKey,
    gemini: settings.geminiApiKey,
    openai: settings.openaiApiKey,
    anthropic: settings.anthropicApiKey,
    custom: settings.customApiKey
  };
  const activeKey = keyMap[provider_name] || settings.apiKey || '';
  if (!activeKey) {
    throw new Error('No API key configured for ' + provider_name + '. Set it in Settings.');
  }

  // Ensure UniversalProvider is available
  if (typeof UniversalProvider === 'undefined') {
    throw new Error('AI provider not loaded. Reload the extension.');
  }

  const provider = new UniversalProvider(settings);
  const prompt = buildRefinerPrompt(sitePattern, researchData);

  // Build and send the request with a hard 30s timeout
  const requestBody = await provider.buildRequest(prompt);
  const rawResponse = await provider.sendRequest(requestBody, { timeout: REFINER_TIMEOUT_MS });
  const parsed = provider.parseResponse(rawResponse);

  // Extract AI output -- parsed.content should already be an object
  // Fallback: if content is a string, try to parse it as JSON
  let aiData = parsed.content || {};
  if (typeof aiData === 'string') {
    try {
      aiData = JSON.parse(aiData);
    } catch {
      throw new Error('AI returned non-JSON response');
    }
  }

  // Merge AI output into a copy of the sitePattern
  const refined = Object.assign({}, sitePattern);
  refined.workflows = Array.isArray(aiData.workflows) ? aiData.workflows : sitePattern.workflows || [];
  refined.tips = Array.isArray(aiData.tips) ? aiData.tips : sitePattern.tips || [];
  refined.pagePurposes = (aiData.pagePurposes && typeof aiData.pagePurposes === 'object')
    ? aiData.pagePurposes
    : sitePattern.pagePurposes || {};
  refined.selectorPreferences = (aiData.selectorPreferences && typeof aiData.selectorPreferences === 'object')
    ? aiData.selectorPreferences
    : sitePattern.selectorPreferences || {};
  refined.navigationStrategy = (typeof aiData.navigationStrategy === 'string')
    ? aiData.navigationStrategy
    : sitePattern.navigationStrategy || '';

  refined.refined = true;
  refined.refinedAt = Date.now();

  console.log('[SitemapRefiner] Refinement complete for', sitePattern.domain || 'unknown');
  return refined;
}

// Export for page contexts (options page loads this via <script> tag)
if (typeof self !== 'undefined') {
  self.refineSiteMapWithAI = refineSiteMapWithAI;
}
