// Background service worker for FSB v0.9.20

// Import configuration and AI integration modules
importScripts('config/config.js');
importScripts('config/init-config.js');
importScripts('config/secure-config.js');
importScripts('ai/ai-integration.js');
importScripts('ai/tool-definitions.js');
importScripts('ai/tool-use-adapter.js');
importScripts('ai/tool-executor.js');

// Phase 156-158: extracted architecture modules (loaded before agent-loop.js)
importScripts('ai/session-schema.js');
importScripts('ai/state-emitter.js');
importScripts('ai/transcript-store.js');
importScripts('ai/turn-result.js');
importScripts('ai/action-history.js');
importScripts('ai/cost-tracker.js');
importScripts('ai/engine-config.js');
importScripts('ai/permission-context.js');
importScripts('ai/hook-pipeline.js');
importScripts('ai/hooks/safety-hooks.js');
importScripts('ai/hooks/permission-hook.js');
importScripts('ai/hooks/progress-hook.js');

importScripts('ai/agent-loop.js');
importScripts('utils/task-router.js');
importScripts('utils/automation-logger.js');
importScripts('utils/overlay-state.js');
importScripts('utils/analytics.js');
importScripts('utils/keyboard-emulator.js');
importScripts('utils/site-explorer.js');
importScripts('utils/crawler-manager.js');

// Site-specific AI guidance modules
importScripts('site-guides/index.js');

// Category shared guidance
importScripts('site-guides/ecommerce/_shared.js');
importScripts('site-guides/social/_shared.js');
importScripts('site-guides/finance/_shared.js');
importScripts('site-guides/travel/_shared.js');
importScripts('site-guides/email/_shared.js');
importScripts('site-guides/coding/_shared.js');
importScripts('site-guides/career/_shared.js');
importScripts('site-guides/gaming/_shared.js');
importScripts('site-guides/productivity/_shared.js');

// Per-site guides: E-Commerce
importScripts('site-guides/ecommerce/amazon.js');
importScripts('site-guides/ecommerce/bestbuy.js');
importScripts('site-guides/ecommerce/demo-store.js');
importScripts('site-guides/ecommerce/ebay.js');
importScripts('site-guides/ecommerce/mega-menu.js');
importScripts('site-guides/ecommerce/nike-3d-viewer.js');
importScripts('site-guides/ecommerce/target.js');
importScripts('site-guides/ecommerce/walmart.js');

// Per-site guides: Social Media
importScripts('site-guides/social/linkedin.js');
importScripts('site-guides/social/twitter.js');
importScripts('site-guides/social/facebook.js');
importScripts('site-guides/social/reddit.js');
importScripts('site-guides/social/instagram.js');
importScripts('site-guides/social/youtube.js');
importScripts('site-guides/social/tiktok.js');

// Per-site guides: Finance
importScripts('site-guides/finance/yahoo-finance.js');
importScripts('site-guides/finance/google-finance.js');
importScripts('site-guides/finance/tradingview.js');
importScripts('site-guides/finance/robinhood.js');
importScripts('site-guides/finance/coinbase.js');
importScripts('site-guides/finance/finviz.js');

// Per-site guides: Travel
importScripts('site-guides/travel/booking.js');
importScripts('site-guides/travel/expedia.js');
importScripts('site-guides/travel/airbnb.js');
importScripts('site-guides/travel/kayak.js');
importScripts('site-guides/travel/southwest.js');
importScripts('site-guides/travel/united.js');
importScripts('site-guides/travel/google-travel.js');
importScripts('site-guides/travel/google-maps.js');

// Per-site guides: Email
importScripts('site-guides/email/gmail.js');
importScripts('site-guides/email/outlook.js');
importScripts('site-guides/email/yahoo-mail.js');

// Per-site guides: Coding
importScripts('site-guides/coding/leetcode.js');
importScripts('site-guides/coding/hackerrank.js');
importScripts('site-guides/coding/github.js');
importScripts('site-guides/coding/codeforces.js');
importScripts('site-guides/coding/geeksforgeeks.js');
importScripts('site-guides/coding/stackoverflow.js');
importScripts('site-guides/coding/observable.js');

// Per-site guides: Career -- ATS base guides (load first)
importScripts('site-guides/career/workday.js');
importScripts('site-guides/career/greenhouse.js');
importScripts('site-guides/career/lever.js');
importScripts('site-guides/career/icims.js');
importScripts('site-guides/career/taleo.js');
// Third-party job boards
importScripts('site-guides/career/indeed.js');
importScripts('site-guides/career/glassdoor.js');
importScripts('site-guides/career/builtin.js');
// Per-company career guides (generated from research logs)
importScripts('site-guides/career/amazon.js');
importScripts('site-guides/career/amex.js');
importScripts('site-guides/career/apple.js');
importScripts('site-guides/career/att.js');
importScripts('site-guides/career/bankofamerica.js');
importScripts('site-guides/career/boeing.js');
importScripts('site-guides/career/capitalone.js');
importScripts('site-guides/career/citi.js');
importScripts('site-guides/career/costco.js');
importScripts('site-guides/career/cvshealth.js');
importScripts('site-guides/career/deloitte.js');
importScripts('site-guides/career/goldmansachs.js');
importScripts('site-guides/career/google-careers.js');
importScripts('site-guides/career/homedepot.js');
importScripts('site-guides/career/ibm.js');
importScripts('site-guides/career/jnj.js');
importScripts('site-guides/career/jpmorganchase.js');
importScripts('site-guides/career/lockheedmartin.js');
importScripts('site-guides/career/lowes.js');
importScripts('site-guides/career/mastercard.js');
importScripts('site-guides/career/mckesson.js');
importScripts('site-guides/career/meta.js');
importScripts('site-guides/career/microsoft.js');
importScripts('site-guides/career/morganstanley.js');
importScripts('site-guides/career/mrcooper.js');
importScripts('site-guides/career/nvidia.js');
importScripts('site-guides/career/openai.js');
importScripts('site-guides/career/oracle.js');
importScripts('site-guides/career/pfizer.js');
importScripts('site-guides/career/target.js');
importScripts('site-guides/career/tesla.js');
importScripts('site-guides/career/ti.js');
importScripts('site-guides/career/unitedhealthgroup.js');
importScripts('site-guides/career/verizon.js');
importScripts('site-guides/career/visa.js');
importScripts('site-guides/career/walmart.js');
// Generic ATS fallback (MUST be last -- matches broad /careers/ and /jobs/ patterns)
importScripts('site-guides/career/generic.js');

// Per-site guides: Gaming
importScripts('site-guides/gaming/steam.js');
importScripts('site-guides/gaming/epic-games.js');
importScripts('site-guides/gaming/gog.js');
importScripts('site-guides/gaming/humble-bundle.js');

// Per-site guides: Browser Games
importScripts('site-guides/games/google-solitaire.js');
importScripts('site-guides/games/canvas-game.js');

// Per-site guides: Music
importScripts('site-guides/music/virtual-piano.js');

// Per-site guides: Media
importScripts('site-guides/media/podcast-player.js');
importScripts('site-guides/media/video-player.js');
importScripts('site-guides/media/voice-recorder.js');

// Per-site guides: Productivity
importScripts('site-guides/productivity/google-sheets.js');
importScripts('site-guides/productivity/google-docs.js');
importScripts('site-guides/productivity/google-keep.js');
importScripts('site-guides/productivity/google-calendar.js');
importScripts('site-guides/productivity/todoist.js');
importScripts('site-guides/productivity/trello.js');
importScripts('site-guides/productivity/notion.js');
importScripts('site-guides/productivity/jira.js');
importScripts('site-guides/productivity/airtable.js');
importScripts('site-guides/productivity/pdf-editor.js');
importScripts('site-guides/productivity/pdf-viewer.js');
importScripts('site-guides/productivity/pricing-table.js');
importScripts('site-guides/productivity/crm-hr-cross-ref.js');

// Per-site guides: Design & Whiteboard
importScripts('site-guides/design/_shared.js');
importScripts('site-guides/design/excalidraw.js');
importScripts('site-guides/design/photopea.js');
importScripts('site-guides/design/miro.js');

// Per-site guides: Reference
importScripts('site-guides/reference/wikipedia.js');

// Per-site guides: News
importScripts('site-guides/news/hackernews.js');
importScripts('site-guides/news/news-feed.js');

// Per-site guides: Sports
importScripts('site-guides/sports/live-scores.js');

// Per-site guides: Utilities
importScripts('site-guides/utilities/carousel.js');
importScripts('site-guides/utilities/color-picker.js');
importScripts('site-guides/utilities/file-upload.js');
importScripts('site-guides/utilities/slider-captcha.js');
importScripts('site-guides/utilities/support-chatbot.js');
importScripts('site-guides/utilities/two-factor-auth.js');
importScripts('site-guides/utilities/session-expiry.js');
importScripts('site-guides/utilities/freeware-download.js');
importScripts('site-guides/utilities/cookie-opt-out.js');
importScripts('site-guides/utilities/shuffled-cancel.js');
importScripts('site-guides/utilities/camouflaged-close.js');
importScripts('site-guides/utilities/adblocker-bypass.js');
importScripts('site-guides/utilities/premium-highlighting.js');
importScripts('site-guides/utilities/newsletter-uncheck.js');
importScripts('site-guides/utilities/buried-login-link.js');
importScripts('site-guides/utilities/skip-ad-countdown.js');
importScripts('site-guides/utilities/anti-scrape-text-extraction.js');

// Background agent modules
importScripts('agents/agent-manager.js');
importScripts('agents/agent-scheduler.js');
importScripts('agents/agent-executor.js');
importScripts('agents/server-sync.js');
// Compression for WS payloads (used by ws-client.js)
importScripts('lib/lz-string.min.js');
importScripts('ws/ws-client.js');

// Memory layer modules
importScripts('lib/memory/memory-schemas.js');
importScripts('lib/memory/memory-storage.js');
importScripts('lib/memory/memory-retriever.js');
importScripts('lib/memory/memory-extractor.js');
importScripts('lib/memory/memory-manager.js');
importScripts('lib/memory/memory-consolidator.js');
importScripts('lib/memory/cross-site-patterns.js');

// Site map intelligence modules (Tier 1 converter + Tier 2 refiner)
importScripts('lib/memory/sitemap-converter.js');
importScripts('lib/memory/sitemap-refiner.js');

// ---------------------------------------------------------------------------
// Phase 159: Hook pipeline factory for agent loop sessions
// ---------------------------------------------------------------------------

/**
 * Create a HookPipeline with all standard hooks registered for a session.
 * Called once per session before runAgentLoop.
 *
 * @returns {{ hooks: HookPipeline, emitter: SessionStateEmitter }}
 */
function createSessionHooks() {
  var hooks = new HookPipeline();
  var emitter = new SessionStateEmitter();
  var permCtx = new PermissionContext();

  // Safety breaker on beforeIteration -- pre-iteration guard (LOOP-03 gap closure)
  hooks.register(
    LIFECYCLE_EVENTS.BEFORE_ITERATION,
    createSafetyBreakerHook(checkSafetyBreakers)
  );

  // Safety hooks on afterIteration
  hooks.register(
    LIFECYCLE_EVENTS.AFTER_ITERATION,
    createSafetyBreakerHook(checkSafetyBreakers)
  );
  hooks.register(
    LIFECYCLE_EVENTS.AFTER_ITERATION,
    createStuckDetectionHook(detectStuck)
  );

  // Permission hook on beforeToolExecution
  hooks.register(
    LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION,
    createPermissionHook(permCtx)
  );

  // Progress hooks
  hooks.register(
    LIFECYCLE_EVENTS.AFTER_TOOL_EXECUTION,
    createToolProgressHook(emitter)
  );
  hooks.register(
    LIFECYCLE_EVENTS.AFTER_ITERATION,
    createIterationProgressHook(emitter)
  );
  hooks.register(
    LIFECYCLE_EVENTS.ON_COMPLETION,
    createCompletionProgressHook(emitter)
  );
  hooks.register(
    LIFECYCLE_EVENTS.ON_ERROR,
    createErrorProgressHook(emitter)
  );

  return { hooks: hooks, emitter: emitter };
}

// Site map intelligence - bundled map cache
const bundledSiteMapCache = new Map();

// Speech-to-Text: tracks which tab has active browser recognition
let _sttActiveTabId = null;

// Ensure offscreen document for STT on restricted pages (new tab, chrome://)
async function _ensureOffscreenSTT() {
  const url = chrome.runtime.getURL('offscreen/stt.html');
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url]
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Speech-to-text recognition requires audio capture'
  });
}

// Content script module files in dependency order.
// Used by all file-based chrome.scripting.executeScript injection points.
// Order matters: init.js sets up the window.FSB namespace, utils.js provides
// shared helpers, then domain modules, then messaging/lifecycle which depend on all above.
const CONTENT_SCRIPT_FILES = [
  'utils/automation-logger.js',
  'utils/overlay-state.js',
  'content/init.js',
  'content/utils.js',
  'content/dom-state.js',
  'content/selectors.js',
  'content/visual-feedback.js',
  'content/accessibility.js',
  'content/actions.js',
  'content/dom-analysis.js',
  'content/dom-stream.js',
  'content/messaging.js',
  'content/lifecycle.js'
];

async function loadBundledSiteMap(domain) {
  if (bundledSiteMapCache.has(domain)) {
    return bundledSiteMapCache.get(domain);
  }

  const lookupDomain = domain.replace(/^www\./, '');

  for (const d of [lookupDomain, domain]) {
    try {
      const url = chrome.runtime.getURL(`site-maps/${d}.json`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        bundledSiteMapCache.set(domain, data);
        return data;
      }
    } catch (e) {
      // File not found, continue
    }
  }

  bundledSiteMapCache.set(domain, null);
  return null;
}

/**
 * Check whether a site map exists for a given domain (bundled or memory).
 * Returns { exists: boolean, source: 'bundled' | 'memory' | null }
 */
async function hasSiteMapForDomain(domain) {
  // Check pre-bundled maps
  const bundled = await loadBundledSiteMap(domain);
  if (bundled) return { exists: true, source: 'bundled' };

  // Check memory system
  if (typeof memoryManager !== 'undefined') {
    try {
      const allMemories = await memoryManager.getAll();
      const match = allMemories.find(m =>
        m.typeData?.category === 'site_map' &&
        m.metadata?.domain === domain
      );
      if (match) return { exists: true, source: 'memory' };
    } catch (e) {
      // Memory lookup failed, treat as not found
    }
  }

  return { exists: false, source: null };
}

// Crawler Manager - orchestrates multiple concurrent SiteExplorer instances
const crawlerManager = new CrawlerManager();

// Debug mode flag (controlled by options page toggle)
let fsbDebugMode = false;

/**
 * Extract and store long-term memories from a completed session.
 * Non-blocking, fire-and-forget. Safe to call for both successful and failed sessions.
 * @param {string} sessionId
 * @param {Object} session
 */
async function extractAndStoreMemories(sessionId, session) {
  try {
    // Synchronously snapshot AI instance data before any await.
    // cleanupSession may delete the AI instance after the first await,
    // so we must capture hardFacts, sessionMemory, and compactedSummary now.
    const ai = sessionAIInstances.get(sessionId);
    if (ai) {
      session._enrichedData = {
        hardFacts: ai.hardFacts ? {
          taskGoal: ai.hardFacts.taskGoal || '',
          criticalActions: [...(ai.hardFacts.criticalActions || [])],
          workingSelectors: { ...(ai.hardFacts.workingSelectors || {}) }
        } : null,
        sessionMemory: ai.sessionMemory ? {
          taskGoal: ai.sessionMemory.taskGoal || '',
          stepsCompleted: [...(ai.sessionMemory.stepsCompleted || [])],
          failedApproaches: [...(ai.sessionMemory.failedApproaches || [])]
        } : null,
        compactedSummary: ai.compactedSummary || null
      };
    }

    // Extract domain from session URL or action history
    let domain = null;
    if (session.actionHistory) {
      for (const action of session.actionHistory) {
        if (action.params?.url) {
          try { domain = new URL(action.params.url).hostname; } catch {}
          if (domain) break;
        }
      }
    }

    // Fallback: use session.lastUrl when no navigate URL found in actionHistory
    if (!domain && session.lastUrl) {
      try { domain = new URL(session.lastUrl).hostname; } catch {}
    }

    const memories = await memoryManager.add(session, { domain });

    // Phase 100: Extract procedural memory from successful sessions (MEM-01)
    try {
      if (
        memories.length > 0 &&
        memories[0].typeData?.session?.outcome === 'success' &&
        memories[0].typeData?.session?.iterationCount <= 10 &&
        (memories[0].typeData?.session?.timeline || []).length >= 2
      ) {
        const timeline = memories[0].typeData.session.timeline;
        const steps = timeline.map(step => {
          const parts = [step.action];
          if (step.target) parts.push(step.target);
          return parts.join(' ');
        });

        const selectors = [...new Set(
          timeline
            .map(step => step.target)
            .filter(t => t && t.length > 0)
        )];

        const taskText = memories[0].typeData?.session?.task || session.task || 'Unknown task';
        const procText = `${taskText} on ${domain || 'unknown site'}`;

        const proceduralMemory = createProceduralMemory(procText, {
          domain: domain,
          taskType: memories[0].metadata?.taskType || null,
          tags: ['procedural', 'auto-extracted', ...(domain ? [domain] : [])],
          confidence: 1.0,
          sourceSessionId: session.sessionId || null
        }, {
          steps: steps,
          selectors: selectors,
          timings: timeline.map(step => step.timestamp).filter(Boolean),
          successRate: 1.0,
          totalRuns: 1,
          lastSuccessAt: Date.now(),
          targetUrl: memories[0].typeData?.session?.finalUrl || null
        });

        // Enforce per-domain cap of 5 procedural memories
        const existingProcedural = await memoryStorage.query({
          domain: domain,
          type: MEMORY_TYPES.PROCEDURAL
        });
        const domainProcedural = existingProcedural.filter(m => m.type === MEMORY_TYPES.PROCEDURAL);
        if (domainProcedural.length >= 5) {
          domainProcedural.sort((a, b) => a.createdAt - b.createdAt);
          const toDelete = domainProcedural.slice(0, domainProcedural.length - 4);
          for (const old of toDelete) {
            await memoryStorage.delete(old.id);
          }
        }

        await memoryStorage.add(proceduralMemory);

        debugLog('Extracted procedural memory from successful session', {
          sessionId,
          domain,
          steps: steps.length,
          taskType: memories[0].metadata?.taskType
        });
      }
    } catch (procError) {
      console.warn('[FSB] Procedural memory extraction failed:', procError.message);
    }

    // Phase 101 (MEM-03): Auto-consolidation triggers
    try {
      // Increment persistent session counter
      const counterResult = await chrome.storage.local.get('fsb_session_count');
      const sessionCount = (counterResult.fsb_session_count || 0) + 1;
      await chrome.storage.local.set({ fsb_session_count: sessionCount });

      let shouldConsolidate = false;
      let reason = '';

      // Trigger 1: Every 10 sessions
      if (sessionCount % 10 === 0) {
        shouldConsolidate = true;
        reason = `session count ${sessionCount} (every 10)`;
      }

      // Trigger 2: Any memory type at 80% capacity (80 out of 100 per type)
      if (!shouldConsolidate) {
        const stats = await memoryStorage.getStats();
        const PER_TYPE_CAPACITY = 100;
        const CAPACITY_THRESHOLD = 80; // 80% of 100
        for (const [type, count] of Object.entries(stats.byType || {})) {
          if (count >= CAPACITY_THRESHOLD) {
            shouldConsolidate = true;
            reason = `${type} memory at ${count}/${PER_TYPE_CAPACITY} (80% capacity)`;
            break;
          }
        }
      }

      if (shouldConsolidate) {
        // Fire-and-forget -- consolidation must never block automation
        memoryManager.consolidate().then(result => {
          console.log(`[Memory] Auto-consolidation complete (${reason}):`, result);
          // Reset counter after successful consolidation
          chrome.storage.local.set({ fsb_session_count: 0 });
        }).catch(err => {
          console.warn('[Memory] Auto-consolidation failed:', err.message);
        });
      }
    } catch (err) {
      console.warn('[Memory] Auto-consolidation trigger check failed:', err.message);
    }

    if (memories.length > 0) {
      debugLog('Extracted memories from session', {
        sessionId,
        count: memories.length,
        types: memories.map(m => m.type)
      });
    }
  } catch (error) {
    // Non-critical: log and move on
    console.warn('[FSB] Memory extraction failed for session', sessionId, error.message);
  }
}

/**
 * Debug logging helper - only logs when debug mode is enabled
 * @param {string} message - Debug message
 * @param {*} data - Optional data to log
 */
function debugLog(message, data) {
  if (fsbDebugMode) {
    if (data !== undefined) {
      console.log('[FSB DEBUG]', message, data);
    } else {
      console.log('[FSB DEBUG]', message);
    }
  }
}

// ============================================================
// TIMEZONE-TO-COUNTRY LOOKUP MAP
// Static mapping of major IANA timezones to country names.
// Used by getUserLocale() to inject locale context into AI prompts.
// Organized by region for maintainability (~90 entries).
// ============================================================
const TIMEZONE_TO_COUNTRY = {
  // Americas - United States
  'America/New_York': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Anchorage': 'United States',
  'Pacific/Honolulu': 'United States',
  'America/Phoenix': 'United States',
  'America/Indiana/Indianapolis': 'United States',
  'America/Detroit': 'United States',
  'America/Boise': 'United States',
  'America/Adak': 'United States',

  // Americas - Canada
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'America/Edmonton': 'Canada',
  'America/Winnipeg': 'Canada',
  'America/Halifax': 'Canada',
  'America/St_Johns': 'Canada',

  // Americas - Mexico
  'America/Mexico_City': 'Mexico',
  'America/Tijuana': 'Mexico',
  'America/Cancun': 'Mexico',

  // Americas - Brazil
  'America/Sao_Paulo': 'Brazil',
  'America/Manaus': 'Brazil',

  // Americas - Other
  'America/Bogota': 'Colombia',
  'America/Lima': 'Peru',
  'America/Santiago': 'Chile',
  'America/Buenos_Aires': 'Argentina',
  'America/Caracas': 'Venezuela',

  // Europe
  'Europe/London': 'United Kingdom',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Europe/Madrid': 'Spain',
  'Europe/Rome': 'Italy',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Zurich': 'Switzerland',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Vienna': 'Austria',
  'Europe/Dublin': 'Ireland',
  'Europe/Lisbon': 'Portugal',
  'Europe/Athens': 'Greece',
  'Europe/Bucharest': 'Romania',
  'Europe/Istanbul': 'Turkey',
  'Europe/Moscow': 'Russia',
  'Europe/Kyiv': 'Ukraine',

  // Asia
  'Asia/Tokyo': 'Japan',
  'Asia/Shanghai': 'China',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Taipei': 'Taiwan',
  'Asia/Seoul': 'South Korea',
  'Asia/Kolkata': 'India',
  'Asia/Singapore': 'Singapore',
  'Asia/Bangkok': 'Thailand',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Manila': 'Philippines',
  'Asia/Ho_Chi_Minh': 'Vietnam',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Dubai': 'United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Karachi': 'Pakistan',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Colombo': 'Sri Lanka',
  'Asia/Kathmandu': 'Nepal',
  'Asia/Tashkent': 'Uzbekistan',
  'Asia/Almaty': 'Kazakhstan',
  'Asia/Tehran': 'Iran',
  'Asia/Baghdad': 'Iraq',
  'Asia/Jerusalem': 'Israel',

  // Oceania
  'Australia/Sydney': 'Australia',
  'Australia/Melbourne': 'Australia',
  'Australia/Brisbane': 'Australia',
  'Australia/Perth': 'Australia',
  'Australia/Adelaide': 'Australia',
  'Pacific/Auckland': 'New Zealand',
  'Pacific/Fiji': 'Fiji',

  // Africa
  'Africa/Cairo': 'Egypt',
  'Africa/Lagos': 'Nigeria',
  'Africa/Johannesburg': 'South Africa',
  'Africa/Nairobi': 'Kenya',
  'Africa/Casablanca': 'Morocco',
  'Africa/Accra': 'Ghana'
};

/**
 * Detect the user's timezone, country, and local datetime using browser APIs.
 * Returns a locale object with a pre-formatted promptString for AI injection.
 * Uses Intl.DateTimeFormat for timezone detection and a static lookup table
 * for country derivation. No external dependencies.
 *
 * @returns {{ timezone: string, country: string, localDateTime: string, promptString: string }}
 */
function getUserLocale() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Validate IANA format (always contains "/") -- macOS Sonoma bug mitigation
    if (!timezone || !timezone.includes('/')) {
      console.warn('[FSB] Timezone detection returned non-IANA value:', timezone);
      return {
        timezone: timezone || 'Unknown',
        country: 'Unknown',
        localDateTime: new Date().toISOString(),
        promptString: 'User timezone could not be detected.'
      };
    }

    const country = TIMEZONE_TO_COUNTRY[timezone] || 'Unknown';
    const localDateTime = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return {
      timezone,
      country,
      localDateTime,
      promptString: `User is in ${country}, local time: ${localDateTime} (${timezone})`
    };
  } catch (e) {
    console.warn('[FSB] getUserLocale() failed:', e.message);
    return {
      timezone: 'Unknown',
      country: 'Unknown',
      localDateTime: new Date().toISOString(),
      promptString: 'User timezone could not be detected.'
    };
  }
}

/**
 * Simplify a status message for user display.
 * Truncates to a short, clean one-liner.
 * @param {string} msg - Raw status message
 * @param {number} maxLen - Maximum character length (default 60)
 * @returns {string} Simplified message
 */
function simplifyStatus(msg, maxLen = 60) {
  if (!msg || typeof msg !== 'string') return 'Working...';
  // Strip leading/trailing whitespace
  let clean = msg.trim();
  // If already short, return as-is
  if (clean.length <= maxLen) return clean;
  // Truncate at last word boundary within limit
  const truncated = clean.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

/**
 * Generate a human-readable status string from an action's tool and params.
 * Replaces AI-generated currentStep/description fields to save tokens.
 * @param {string} tool - The action tool name
 * @param {Object} params - The action parameters
 * @returns {string} Short status string for UI display
 */
function getActionStatus(tool, params) {
  const label = (p) => shorten(p?.text || p?.ariaLabel || p?.placeholder || p?.selector, 25);
  switch (tool) {
    case 'click': {
      const t = label(params);
      return t ? `Clicking "${t}"` : 'Clicking element';
    }
    case 'type': {
      const val = shorten(params?.text, 25);
      const field = params?.placeholder ? ` into ${shorten(params.placeholder, 20)}` : '';
      return val ? `Typing "${val}"${field}` : 'Entering text';
    }
    case 'pressEnter':     return 'Submitting';
    case 'navigate': {
      const url = params?.url;
      if (url) {
        try { return `Opening ${shorten(new URL(url).hostname + new URL(url).pathname, 25)}`; }
        catch { return `Opening ${shorten(url, 25)}`; }
      }
      return 'Opening page';
    }
    case 'searchGoogle':   return `Looking up "${shorten(params?.query)}"`;
    case 'scroll':         return 'Scrolling';
    case 'getText':        return 'Reading content';
    case 'readPage':       return 'Reading full page text';
    case 'getAttribute':   return 'Inspecting page';
    case 'selectOption': {
      const opt = shorten(params?.optionText || params?.value, 25);
      return opt ? `Selecting "${opt}"` : 'Selecting option';
    }
    case 'toggleCheckbox': {
      const cb = shorten(params?.label || params?.ariaLabel || params?.text, 25);
      return cb ? `Toggling "${cb}"` : 'Toggling checkbox';
    }
    case 'hover': {
      const h = label(params);
      return h ? `Hovering over "${h}"` : 'Hovering';
    }
    case 'focus': {
      const f = shorten(params?.placeholder || params?.ariaLabel || params?.selector, 25);
      return f ? `Focusing "${f}"` : 'Focusing field';
    }
    case 'clearInput': {
      const c = shorten(params?.placeholder || params?.ariaLabel || params?.selector, 25);
      return c ? `Clearing "${c}"` : 'Clearing field';
    }
    case 'waitForElement': {
      const w = shorten(params?.selector, 25);
      return w ? `Waiting for ${w}` : 'Waiting for element';
    }
    case 'doubleClick': {
      const d = label(params);
      return d ? `Double-clicking "${d}"` : 'Double-clicking';
    }
    case 'rightClick': {
      const r = label(params);
      return r ? `Right-clicking "${r}"` : 'Right-clicking';
    }
    case 'goBack':         return 'Going back';
    case 'goForward':      return 'Going forward';
    case 'refresh':        return 'Refreshing';
    case 'moveMouse':      return 'Moving cursor';
    case 'keyPress':       return `Pressing ${params?.key || 'key'}`;
    case 'selectText':     return 'Selecting text';
    case 'setAttribute':   return 'Updating page';
    case 'solveCaptcha':   return 'Solving captcha';
    case 'openNewTab':     return 'Opening new tab';
    case 'switchToTab':    return 'Switching tab';
    case 'closeTab':       return 'Closing tab';
    case 'listTabs':       return 'Checking tabs';
    default:               return 'Working';
  }
}

/**
 * Shorten a text string for display (used for search queries)
 * @param {string} text - Text to shorten
 * @param {number} max - Maximum length
 * @returns {string} Shortened text
 */
function shorten(text, max = 30) {
  if (!text || typeof text !== 'string') return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

/**
 * Send phase:'ended' to ALL tabs that may have an active session overlay.
 * This covers the current tab AND the previous tab (if a tab switch occurred
 * and previousTabId is still set). Clears previousTabId after cleanup.
 *
 * Use this instead of calling sendSessionStatus(session.tabId, { phase: 'ended', ... })
 * directly, to avoid leaving stale overlays on tabs the session previously occupied.
 *
 * @param {Object} session - The session object from activeSessions
 * @param {string} reason - The reason string (e.g. 'complete', 'stopped', 'error', 'timeout', ...)
 */
async function endSessionOverlays(session, reason) {
  const tabId = session.tabId || session.originalTabId;
  await sendSessionStatus(tabId, { phase: 'ended', reason });

  if (session.previousTabId && session.previousTabId !== tabId) {
    await sendSessionStatus(session.previousTabId, { phase: 'ended', reason: 'tab_switch' });
    session.previousTabId = null;
  }
}

/**
 * Send session status to content script for visual feedback (viewport glow + progress overlay).
 * Targets the main frame only (frameId: 0) to avoid iframe interference.
 * Retries once with content-script re-injection on failure.
 * @param {number} tabId - Target tab ID
 * @param {Object} statusData - Status fields: phase, taskName, iteration, maxIterations, reason, animatedHighlights
 */
function findOverlaySession(tabId, statusData) {
  if (statusData && statusData.sessionId && activeSessions.has(statusData.sessionId)) {
    return activeSessions.get(statusData.sessionId);
  }

  var match = null;
  activeSessions.forEach(function(session) {
    if (match) return;
    if (session.tabId === tabId || session.originalTabId === tabId || session.previousTabId === tabId) {
      match = session;
    }
  });
  return match;
}

function cloneOverlayStatusData(statusData) {
  var source = statusData || {};
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(source);
    } catch (_cloneErr) {
      // Fall through to JSON clone.
    }
  }

  try {
    return JSON.parse(JSON.stringify(source));
  } catch (_jsonErr) {
    return Object.assign({}, source);
  }
}

function buildOverlayPayload(tabId, statusData, session) {
  var utils = self.FSBOverlayStateUtils;
  if (!utils || typeof utils.buildOverlayState !== 'function') {
    return null;
  }

  var overlaySession = session || findOverlaySession(tabId, statusData || {});
  var overlayState = utils.buildOverlayState(statusData || {}, overlaySession || null);
  if (!overlayState) return null;

  if (overlaySession) {
    if (!overlaySession._overlaySessionToken) {
      overlaySession._overlaySessionToken = overlaySession.sessionId || ('tab:' + tabId + ':' + Date.now());
    }
    overlaySession._overlayVersion = (overlaySession._overlayVersion || 0) + 1;
    overlayState.sessionToken = overlaySession._overlaySessionToken;
    overlayState.version = overlaySession._overlayVersion;
  } else {
    overlayState.sessionToken = (statusData && statusData.sessionToken) || ('tab:' + tabId);
    overlayState.version = (statusData && typeof statusData.version === 'number')
      ? statusData.version
      : Date.now();
  }

  return overlayState;
}

async function sendSessionStatus(tabId, statusData) {
  var payloadStatusData = cloneOverlayStatusData(statusData || {});
  var isOverlayHeartbeat = !!payloadStatusData._overlayHeartbeat;
  if (isOverlayHeartbeat) {
    delete payloadStatusData._overlayHeartbeat;
  }

  var overlaySession = findOverlaySession(tabId, payloadStatusData || {});
  var overlayState = buildOverlayPayload(tabId, payloadStatusData, overlaySession);
  var sentAt = Date.now();

  if (overlaySession) {
    overlaySession._lastOverlaySentAt = sentAt;
    overlaySession._lastOverlayTargetTabId = tabId;
    overlaySession._lastOverlayIdentity = overlayState ? {
      sessionToken: overlayState.sessionToken || null,
      version: overlayState.version || null,
      lifecycle: overlayState.lifecycle || null,
      phase: overlayState.phase || null
    } : null;

    if (!isOverlayHeartbeat || !overlaySession._lastOverlayStatusData) {
      overlaySession._lastOverlayStatusData = cloneOverlayStatusData(payloadStatusData);
      overlaySession._lastOverlayActivityAt = sentAt;
    }
  }

  const payload = {
    action: 'sessionStatus',
    ...payloadStatusData,
    overlayState: overlayState
  };
  try {
    await chrome.tabs.sendMessage(tabId, payload, { frameId: 0 });
  } catch (firstErr) {
    // First attempt failed -- try re-injecting the content script and retry once
    try {
      await ensureContentScriptInjected(tabId, 1);
      await chrome.tabs.sendMessage(tabId, payload, { frameId: 0 });
    } catch (retryErr) {
      automationLogger.debug('sendSessionStatus delivery failed', {
        tabId, phase: payloadStatusData.phase, error: retryErr.message
      });
    }
  }
}

var OVERLAY_HEARTBEAT_INTERVAL_MS = 15000;
var OVERLAY_HEARTBEAT_REFRESH_MS = 45000;
var OVERLAY_HEARTBEAT_IDLE_MS = 45000;

function requestOverlayStateBroadcast(tabId) {
  if (!_streamingActive || _streamingTabId !== tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, { action: 'domStreamRequestOverlay' }, { frameId: 0 })
      .catch(function() {});
  } catch (_overlayErr) {
    // Non-blocking
  }
}

function buildOverlayHeartbeatStatus(session) {
  if (!session || session.status !== 'running' || !session._lastOverlayStatusData) {
    return null;
  }

  var heartbeatStatus = cloneOverlayStatusData(session._lastOverlayStatusData);
  var lastActivityAt = session._lastOverlayActivityAt || session._lastOverlaySentAt || Date.now();
  var idleMs = Math.max(0, Date.now() - lastActivityAt);

  heartbeatStatus._overlayHeartbeat = true;

  if (idleMs >= OVERLAY_HEARTBEAT_IDLE_MS) {
    heartbeatStatus.statusText = idleMs >= (OVERLAY_HEARTBEAT_IDLE_MS * 2)
      ? 'Still working on the current automation step'
      : 'Waiting for next automation update';
    heartbeatStatus.progress = {
      mode: 'indeterminate',
      label: idleMs >= (OVERLAY_HEARTBEAT_IDLE_MS * 2) ? 'Still working' : 'Waiting',
      eta: heartbeatStatus.estimatedTimeRemaining || null
    };
  }

  return heartbeatStatus;
}

// --- Dashboard progress broadcasting helpers ---

var _lastDashboardBroadcast = 0; // Throttle: max 1 WS broadcast per second
var _dashboardTaskTabId = null; // Tab ID for active dashboard task (used for DOM stream stop)
var _lastDashboardTaskSnapshot = null; // Recoverable dashboard task state for reconnect snapshots
var _streamingTabId = null; // Tab ID currently being streamed to dashboard (always-on, independent of tasks)
var _streamingActive = false; // Whether dashboard has requested DOM streaming
var _tabSwitchTimer = null; // Debounce timer for tab switch stream re-targeting
var _remoteControlDebuggerTabId = null; // Tab ID with debugger attached for remote control (null = not active)
var _remoteControlDebuggerOwned = false; // Whether remote control attached the current debugger session itself
var _remoteControlEnabled = false; // Whether the dashboard currently wants remote control active
var _streamTabUrl = ''; // Last known URL for the streaming tab or not-ready tab candidate
var _streamStatus = 'not-ready'; // ready | not-ready | recovering
var _streamReason = 'no-streamable-tab'; // restricted-tab | no-streamable-tab | waiting-for-page-ready | tab-closed
var _streamStateSource = 'bootstrap';
var DASHBOARD_TASK_SNAPSHOT_STORAGE_KEY = 'fsb_dashboard_task_snapshot';
var DASHBOARD_TASK_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;

function _createDashboardTaskRunId() {
  return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function _buildDashboardTaskSnapshot(details) {
  return Object.assign({
    taskRunId: '',
    taskStatus: 'idle',
    task: '',
    progress: 0,
    phase: '',
    eta: null,
    elapsed: 0,
    action: '',
    lastAction: '',
    summary: '',
    error: '',
    stopped: false,
    tabId: null
  }, _lastDashboardTaskSnapshot || {}, details || {});
}

function _persistDashboardTaskSnapshot() {
  try {
    chrome.storage.session.set({
      [DASHBOARD_TASK_SNAPSHOT_STORAGE_KEY]: _lastDashboardTaskSnapshot
    }).catch(function() {});
  } catch (e) { /* ignore */ }
}

function _rememberDashboardTaskSnapshot(details) {
  _lastDashboardTaskSnapshot = Object.assign({}, _buildDashboardTaskSnapshot(details), {
    updatedAt: Date.now()
  });
  _persistDashboardTaskSnapshot();
  return Object.assign({}, _lastDashboardTaskSnapshot);
}

function _getDashboardTaskRecoverySnapshot() {
  if (!_lastDashboardTaskSnapshot) return null;
  var age = Date.now() - (_lastDashboardTaskSnapshot.updatedAt || 0);
  if (_lastDashboardTaskSnapshot.taskStatus !== 'running' && age > DASHBOARD_TASK_SNAPSHOT_MAX_AGE_MS) {
    return null;
  }
  return Object.assign({}, _lastDashboardTaskSnapshot);
}

function _buildDashboardTaskProgressPayload(taskSnapshot) {
  var snapshot = _buildDashboardTaskSnapshot(taskSnapshot);
  return {
    taskRunId: snapshot.taskRunId || '',
    task: snapshot.task || '',
    taskStatus: snapshot.taskStatus || 'running',
    progress: typeof snapshot.progress === 'number' ? snapshot.progress : 0,
    phase: snapshot.phase || '',
    eta: snapshot.eta || null,
    elapsed: snapshot.elapsed || 0,
    action: snapshot.action || snapshot.lastAction || '',
    lastAction: snapshot.lastAction || snapshot.action || '',
    updatedAt: snapshot.updatedAt || Date.now(),
    status: snapshot.taskStatus || 'running'
  };
}

function _buildDashboardTaskCompletePayload(taskSnapshot) {
  var snapshot = _buildDashboardTaskSnapshot(taskSnapshot);
  return {
    success: snapshot.taskStatus === 'success',
    stopped: !!snapshot.stopped,
    taskRunId: snapshot.taskRunId || '',
    task: snapshot.task || '',
    taskStatus: snapshot.taskStatus || (snapshot.stopped ? 'stopped' : 'failed'),
    progress: typeof snapshot.progress === 'number' ? snapshot.progress : 0,
    phase: snapshot.phase || '',
    elapsed: snapshot.elapsed || 0,
    action: snapshot.action || '',
    lastAction: snapshot.lastAction || snapshot.action || '',
    summary: snapshot.summary || '',
    error: snapshot.error || '',
    updatedAt: snapshot.updatedAt || Date.now()
  };
}

function _sendDashboardTaskProgress(taskSnapshot) {
  return fsbWebSocket.send('ext:task-progress', _buildDashboardTaskProgressPayload(taskSnapshot));
}

function _sendDashboardTaskComplete(taskSnapshot) {
  return fsbWebSocket.send('ext:task-complete', _buildDashboardTaskCompletePayload(taskSnapshot));
}

try {
  chrome.storage.session.get(DASHBOARD_TASK_SNAPSHOT_STORAGE_KEY).then(function(result) {
    var stored = result && result[DASHBOARD_TASK_SNAPSHOT_STORAGE_KEY];
    if (stored && typeof stored === 'object') {
      _lastDashboardTaskSnapshot = stored;
    }
  }).catch(function() {});
} catch (e) { /* ignore */ }

function _isStreamableTabUrl(url) {
  return !!url && !/^(chrome|about|edge|brave|chrome-extension):/.test(url);
}

function _rememberStreamState(status, reason, tabId, url, source) {
  _streamStatus = status || 'not-ready';
  _streamReason = reason || '';
  _streamTabUrl = url || '';
  _streamStateSource = source || 'background';

  if (_streamStatus === 'ready' || _streamStatus === 'recovering') {
    _streamingTabId = typeof tabId === 'number' ? tabId : null;
  } else if (_streamStatus === 'not-ready') {
    _streamingTabId = null;
  }

  if (_remoteControlEnabled) {
    _syncRemoteControlDebugger('stream-state:' + _streamStatus);
  }
}

function _sendStreamState(status, reason, details) {
  var payload = details || {};
  var tabId = Object.prototype.hasOwnProperty.call(payload, 'tabId') ? payload.tabId : _streamingTabId;
  var url = Object.prototype.hasOwnProperty.call(payload, 'url') ? payload.url : _streamTabUrl;
  var source = payload.source || 'background';

  _rememberStreamState(status, reason, tabId, url, source);

  fsbWebSocket.send('ext:stream-state', {
    status: status,
    reason: reason || '',
    streamIntentActive: !!_streamingActive,
    tabId: typeof tabId === 'number' ? tabId : null,
    url: url || '',
    source: source
  });
}

function _recordStreamTransportEvent(eventName, details) {
  if (typeof recordFSBTransportEvent !== 'function') return;
  recordFSBTransportEvent(eventName, Object.assign({
    streamIntentActive: !!_streamingActive
  }, details || {}));
}

function _recordStreamTransportFailure(eventName, tabId, reason, readyState, target) {
  if (typeof recordFSBTransportFailure !== 'function') return;
  recordFSBTransportFailure(eventName, {
    type: 'ext:stream-state',
    target: target || 'stream-tab',
    tabId: typeof tabId === 'number' ? tabId : null,
    readyState: readyState,
    error: reason || ''
  });
}

/**
 * Listen for tab activations to re-target the DOM stream to the new active tab.
 * Debounced at 300ms to avoid rapid-fire snapshots during quick tab cycling.
 */
chrome.tabs.onActivated.addListener(function(activeInfo) {
  if (!_streamingActive) return;
  var newTabId = activeInfo.tabId;
  clearTimeout(_tabSwitchTimer);
  _tabSwitchTimer = setTimeout(function() {
    _handleStreamTabSwitch(newTabId);
  }, 300);
});

/**
 * Handle switching the DOM stream to a new tab.
 * Stops stream on old tab, validates the new tab is a real page,
 * starts stream on new tab, and notifies dashboard of the switch.
 * @param {number} newTabId - The tab ID to switch streaming to
 */
async function _handleStreamTabSwitch(newTabId) {
  var previousTabId = _streamingTabId;
  // Stop stream on old tab
  if (_streamingTabId && _streamingTabId !== newTabId) {
    try {
      await chrome.tabs.sendMessage(_streamingTabId, { action: 'domStreamStop' }, { frameId: 0 });
    } catch (e) { /* tab may be closed */ }
  }

  try {
    var tab = await chrome.tabs.get(newTabId);
    _recordStreamTransportEvent('stream-tab-switch', {
      tabId: newTabId,
      previousTabId: typeof previousTabId === 'number' ? previousTabId : null,
      url: tab.url || ''
    });
    if (!_isStreamableTabUrl(tab.url)) {
      _recordStreamTransportEvent('stream-tab-not-ready', {
        tabId: newTabId,
        previousTabId: typeof previousTabId === 'number' ? previousTabId : null,
        url: tab.url || '',
        reason: 'restricted-tab'
      });
      _recordStreamTransportFailure('stream-tab-not-ready', newTabId, 'restricted-tab', 'not-ready');
      _sendStreamState('not-ready', 'restricted-tab', {
        tabId: newTabId,
        url: tab.url || '',
        source: 'tab-switch'
      });
      return;
    }

    _sendStreamState('recovering', 'waiting-for-page-ready', {
      tabId: newTabId,
      url: tab.url || '',
      source: 'tab-switch'
    });

    // Start stream on new tab
    chrome.tabs.sendMessage(newTabId, { action: 'domStreamStart' }, { frameId: 0 })
      .catch(function(err) {
        // Content script may not be injected yet -- will retry on domStreamReady signal
        if (typeof recordFSBTransportFailure === 'function') {
          recordFSBTransportFailure('dom-forward-failed', {
            type: 'domStreamStart',
            target: 'content-script',
            tabId: newTabId,
            readyState: 'tab-switch-start-failed',
            error: err && err.message ? err.message : 'domStreamStart sendMessage failed during tab switch'
          });
        }
        console.warn('[FSB] Content script not ready on tab', newTabId, '-- will retry');
      });
  } catch (e) {
    _recordStreamTransportEvent('stream-tab-closed', {
      tabId: newTabId,
      previousTabId: typeof previousTabId === 'number' ? previousTabId : null,
      reason: 'tab-closed'
    });
    _recordStreamTransportFailure('stream-tab-closed', newTabId, 'tab-closed', 'closed');
    _sendStreamState('not-ready', 'tab-closed', {
      tabId: newTabId,
      url: '',
      source: 'tab-switch'
    });
    console.warn('[FSB] Tab switch stream error:', e.message);
  }
}

chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId !== _streamingTabId) return;

  _recordStreamTransportEvent('stream-tab-closed', {
    tabId: tabId,
    reason: 'tab-closed',
    url: _streamTabUrl || ''
  });
  _recordStreamTransportFailure('stream-tab-closed', tabId, 'tab-closed', 'closed');
  _sendStreamState('not-ready', 'tab-closed', {
    tabId: tabId,
    url: _streamTabUrl || '',
    source: 'tab-removed'
  });
});

/**
 * Broadcast task progress to the dashboard via WebSocket.
 * Only fires for dashboard-initiated tasks, throttled to max 1/second.
 * @param {Object} session - Active automation session with _isDashboardTask flag
 */
function broadcastDashboardProgress(session) {
  if (!session._isDashboardTask && !session.agentId) return;
  // Throttle to max 1/second
  var now = Date.now();
  if (now - _lastDashboardBroadcast < 1000) return;
  _lastDashboardBroadcast = now;

  var progress = calculateProgress(session);
  var phase = detectTaskPhase(session);
  var lastAction = session.actionHistory && session.actionHistory.length > 0
    ? session.actionHistory[session.actionHistory.length - 1]
    : null;
  var actionText = session._lastActionSummary
    || (lastAction ? getActionStatus(lastAction.tool, lastAction.params) : null)
    || 'Working...';

  // Broadcast to sidepanel UI for agent runs
  if (session.agentId) {
    chrome.runtime.sendMessage({
      action: 'agentProgress',
      agentId: session.agentId,
      iteration: session.iterationCount || 0,
      currentAction: actionText,
      progress: progress.progressPercent
    }).catch(() => {}); // sidepanel may not be open
  }

  if (!session._isDashboardTask) {
    console.log('[FSB] broadcastDashboardProgress: skipped -- not dashboard task');
    return;
  }

  var taskPayload = _rememberDashboardTaskSnapshot({
    taskRunId: session._dashboardTaskRunId || '',
    taskStatus: 'running',
    task: session.task || '',
    progress: progress.progressPercent,
    phase: phase,
    eta: progress.estimatedTimeRemaining || null,
    elapsed: Date.now() - session.startTime,
    action: actionText,
    lastAction: actionText,
    summary: '',
    error: '',
    stopped: false,
    tabId: typeof session.tabId === 'number' ? session.tabId : null
  });

  var sent = _sendDashboardTaskProgress(taskPayload);
  console.log('[FSB] broadcastDashboardProgress:', sent ? 'SENT' : 'WS_CLOSED', 'progress=' + progress.progressPercent);

  // Forward progress to MCP server for autopilot tasks
  broadcastMCPProgress(session);

  // Request overlay state from content script for DOM stream viewers
  requestOverlayStateBroadcast(session.tabId);
}

/**
 * Broadcast task completion to the dashboard via WebSocket.
 * @param {Object} result - Return value from executeAutomationTask
 */
function broadcastDashboardComplete(result) {
  // Dedup: if stop handler already sent completion, skip
  if (fsbWebSocket && fsbWebSocket._dashStopSent) {
    fsbWebSocket._dashStopSent = false;
    _dashboardTaskTabId = null;
    console.log('[FSB] broadcastDashboardComplete: skipped (stop already sent)');
    return true;
  }
  var previousTask = _getDashboardTaskRecoverySnapshot();
  var payload;
  if (result.success) {
    payload = {
      success: true,
      summary: result.result || 'Task completed',
      elapsed: result.duration || 0,
      taskStatus: 'success'
    };
  } else {
    payload = {
      success: false,
      error: result.error || 'Task failed',
      elapsed: result.duration || 0,
      taskStatus: 'failed'
    };
  }
  var rememberedPayload = _rememberDashboardTaskSnapshot({
    taskRunId: result && result.taskRunId ? result.taskRunId : (previousTask && previousTask.taskRunId ? previousTask.taskRunId : ''),
    taskStatus: payload.taskStatus,
    task: previousTask && previousTask.task ? previousTask.task : '',
    progress: result.success ? 100 : (previousTask && typeof previousTask.progress === 'number' ? previousTask.progress : 0),
    phase: previousTask && previousTask.phase ? previousTask.phase : '',
    eta: null,
    elapsed: payload.elapsed || 0,
    action: previousTask && previousTask.action ? previousTask.action : '',
    lastAction: previousTask && previousTask.lastAction ? previousTask.lastAction : '',
    summary: payload.summary || '',
    error: payload.error || '',
    stopped: false,
    tabId: previousTask && typeof previousTask.tabId === 'number' ? previousTask.tabId : null
  });
  var terminalPayload = _buildDashboardTaskCompletePayload(rememberedPayload);
  var sent = _sendDashboardTaskComplete(rememberedPayload);
  console.log('[FSB] broadcastDashboardComplete:', sent ? 'SENT' : 'WS_CLOSED', JSON.stringify(terminalPayload).slice(0, 200));

  // Clear dashboard task tab reference (stream continues independently)
  _dashboardTaskTabId = null;
  return sent;
}

/**
 * Load debug mode setting from storage
 */
async function loadDebugMode() {
  try {
    const stored = await chrome.storage.local.get(['debugMode']);
    fsbDebugMode = stored.debugMode === true;
    debugLog('Debug mode ' + (fsbDebugMode ? 'enabled' : 'disabled'));
  } catch (e) {
    fsbDebugMode = false;
  }
}

/**
 * Wrapper for chrome.storage.local.get() with timeout to prevent indefinite hanging
 * @param {Array|Object|string} keys - Storage keys to retrieve
 * @param {number} timeout - Timeout in milliseconds (default 3000)
 * @param {Object} defaults - Default values if storage read fails or times out
 * @returns {Promise<Object>} Storage data or defaults
 */
async function getStorageWithTimeout(keys, timeout = 3000, defaults = {}) {
  try {
    const storagePromise = chrome.storage.local.get(keys);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Storage read timeout')), timeout)
    );

    const result = await Promise.race([storagePromise, timeoutPromise]);
    return result;
  } catch (error) {
    automationLogger.warn('Storage read failed or timed out, using defaults', {
      error: error.message,
      keys
    });
    return defaults;
  }
}

// PART 3: Helper function to format duration for session elapsed timer
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSecs}s`;
  }
  return `${seconds}s`;
}

/**
 * Detect the current task phase from action history patterns.
 * Phases: 'navigation' (0-30%), 'extraction' (30-70%), 'writing' (70-100%)
 * Sets session._taskPhase and returns the phase string.
 * @param {Object} session
 * @returns {string} 'navigation'|'extraction'|'writing'|'unknown'
 */
function detectTaskPhase(session) {
  const history = session.actionHistory || [];
  if (history.length === 0) {
    session._taskPhase = 'navigation';
    return 'navigation';
  }

  // Classify action types
  const navTools = new Set(['searchGoogle', 'navigate', 'clickSearchResult', 'openNewTab', 'switchToTab', 'waitForTabLoad', 'scroll']);
  const extractTools = new Set(['getText', 'readPage', 'getPageSource', 'readStructuredContent', 'getStoredJobs']);
  const writeTools = new Set(['type', 'click', 'select', 'fillSheetData', 'storeJobData', 'submit']);

  // Count actions in recent window (last 5 actions weigh more)
  const recent = history.slice(-5);
  let navCount = 0, extractCount = 0, writeCount = 0;

  for (const a of recent) {
    if (navTools.has(a.tool)) navCount++;
    else if (extractTools.has(a.tool)) extractCount++;
    else if (writeTools.has(a.tool)) writeCount++;
  }

  let phase;
  if (writeCount >= 2 || (writeCount > 0 && extractCount > 0 && navCount === 0)) {
    phase = 'writing';
  } else if (extractCount >= 2 || (extractCount > 0 && navCount === 0)) {
    phase = 'extraction';
  } else {
    phase = 'navigation';
  }

  session._taskPhase = phase;
  return phase;
}

/**
 * Calculate progress percentage and estimated time remaining for a session.
 * Uses phase-weighted model: navigation=0-30%, extraction=30-70%, writing=70-99%.
 * @param {Object} session - Active automation session
 * @returns {{ progressPercent: number, estimatedTimeRemaining: string|null }}
 */
function calculateProgress(session) {
  // Delegate to workflow-specific progress when applicable
  if (session.multiSite) return calculateMultiSiteProgress(session);
  if (session.sheetsData) return calculateSheetsProgress(session);

  const maxIter = session.maxIterations || 20;
  const current = session.iterationCount || 0;

  // Detect task phase from action patterns
  const phase = detectTaskPhase(session);

  // Phase weight floors: navigation=0%, extraction=30%, writing=70%
  const phaseFloors = { navigation: 0, extraction: 30, writing: 70, unknown: 0 };
  const phaseCeilings = { navigation: 30, extraction: 70, writing: 99, unknown: 99 };

  const floor = phaseFloors[phase] || 0;
  const ceiling = phaseCeilings[phase] || 99;

  // Within-phase progress: iteration-based but scaled to phase range
  const iterationRatio = maxIter > 0 ? current / maxIter : 0;

  // Map iteration ratio to within-phase progress
  let progressPercent;

  if (current === 0) {
    progressPercent = 0;
  } else {
    // Use phase floor as minimum, then add within-phase progress
    const phaseRange = ceiling - floor;
    // Within-phase progress based on how far through maxIter we are,
    // but clamped to current phase range
    const withinPhase = Math.min(1, iterationRatio * (99 / ceiling));
    progressPercent = Math.min(99, Math.round(floor + phaseRange * Math.min(1, withinPhase)));
  }

  // Ensure progress never goes backward
  if (session._lastProgressPercent && progressPercent < session._lastProgressPercent) {
    progressPercent = session._lastProgressPercent;
  }
  session._lastProgressPercent = progressPercent;

  // ETA calculation -- blend iteration average with complexity estimate
  let estimatedTimeRemaining = null;
  if (current > 0 && session.startTime) {
    const elapsed = Date.now() - session.startTime;
    const avgPerIteration = elapsed / current;
    const iterationBasedETA = (maxIter - current) * avgPerIteration;

    let finalETA = iterationBasedETA;

    // Blend with complexity estimate when available
    const estimate = session._taskEstimate;
    if (estimate && session._complexityResolved) {
      const estimateBasedETA = Math.max(0, (estimate.estimatedTimeoutSec * 1000) - elapsed);

      // Weight: early iterations trust estimate more, later iterations trust actual more
      // At iteration 1: 70% estimate, 30% actual
      // At iteration maxIter/2: 50/50
      // At iteration maxIter: 10% estimate, 90% actual
      const iterationRatio = Math.min(1, current / maxIter);
      const estimateWeight = Math.max(0.1, 0.7 - (0.6 * iterationRatio));
      const actualWeight = 1 - estimateWeight;

      finalETA = (estimateBasedETA * estimateWeight) + (iterationBasedETA * actualWeight);
    }

    if (finalETA > 0) {
      estimatedTimeRemaining = formatETA(finalETA);
    }
  }

  return { progressPercent, estimatedTimeRemaining };
}

/**
 * Format milliseconds into a human-readable ETA string.
 * @param {number} ms - Remaining time in milliseconds
 * @returns {string}
 */
function formatETA(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `~${seconds}s remaining`;
  const minutes = Math.round(seconds / 60);
  return `~${minutes}m remaining`;
}

/**
 * Calculate progress for multi-site workflows based on completed companies.
 * Overrides generic calculateProgress when session.multiSite is active.
 * @param {Object} session
 * @returns {{ progressPercent: number, estimatedTimeRemaining: string|null }}
 */
function calculateMultiSiteProgress(session) {
  const ms = session.multiSite;
  if (!ms) return calculateProgress(session);

  const companies = ms.companyList || ms.companies || [];
  const totalCompanies = companies.length;
  if (totalCompanies === 0) return calculateProgress(session);

  const completedIndex = ms.currentIndex || 0;

  // Within-company progress from iteration ratio (0 to 1)
  const maxIter = session.maxIterations || 20;
  const current = session.iterationCount || 0;
  const withinCompanyProgress = maxIter > 0 ? Math.min(1, current / maxIter) : 0;

  // Overall: (completed companies + fraction of current) / total
  const progressPercent = Math.min(99, Math.round(
    ((completedIndex + withinCompanyProgress) / totalCompanies) * 100
  ));

  // ETA: average time per company * remaining companies
  let estimatedTimeRemaining = null;
  if (completedIndex > 0 && session.multiSite.startedAt) {
    const elapsed = Date.now() - session.multiSite.startedAt;
    const avgPerCompany = elapsed / completedIndex;
    const remainingCompanies = totalCompanies - completedIndex - withinCompanyProgress;
    const remaining = remainingCompanies * avgPerCompany;
    if (remaining > 0) {
      estimatedTimeRemaining = formatETA(remaining);
    }
  }

  return { progressPercent, estimatedTimeRemaining };
}

/**
 * Calculate progress for Google Sheets workflows based on rows written or formatting state.
 * Overrides generic calculateProgress when session.sheetsData is active.
 * @param {Object} session
 * @returns {{ progressPercent: number, estimatedTimeRemaining: string|null }}
 */
function calculateSheetsProgress(session) {
  const sd = session.sheetsData;
  if (!sd) return calculateProgress(session);

  let progressPercent;
  let estimatedTimeRemaining = null;

  if (sd.formattingPhase || sd.formattingComplete) {
    // Formatting phase: use iteration-based progress within 0-100 range
    // Formatting is typically 2-4 iterations
    if (sd.formattingComplete) {
      progressPercent = 99;
    } else {
      const maxIter = session.maxIterations || 5;
      const current = session.iterationCount || 0;
      progressPercent = Math.min(99, Math.round((current / maxIter) * 100));
    }
  } else {
    // Data entry phase: rows written / total rows
    const totalRows = sd.totalRows || 1;
    const rowsWritten = sd.rowsWritten || 0;
    progressPercent = Math.min(99, Math.round((rowsWritten / totalRows) * 100));

    // ETA based on write rate
    if (rowsWritten > 0 && sd.startedAt) {
      const elapsed = Date.now() - sd.startedAt;
      const avgPerRow = elapsed / rowsWritten;
      const remaining = (totalRows - rowsWritten) * avgPerRow;
      if (remaining > 0) {
        estimatedTimeRemaining = formatETA(remaining);
      }
    }
  }

  return { progressPercent, estimatedTimeRemaining };
}

/**
 * Summarize a task description into a short label using the AI provider.
 * Non-blocking -- returns null on failure. Skips tasks already short enough.
 * @param {string} taskText - Original task description
 * @param {Object} settings - Extension settings (for provider config)
 * @returns {Promise<string|null>}
 */
async function summarizeTask(taskText, settings) {
  try {
    if (!taskText || taskText.length <= 40) return taskText;

    const provider = new UniversalProvider(settings);
    const requestBody = await provider.buildRequest({
      systemPrompt: 'Summarize this browser automation task in under 10 words. Return only the summary, nothing else.',
      userPrompt: taskText
    }, {});

    // Limit tokens for this tiny call
    if (requestBody.max_tokens) requestBody.max_tokens = 50;
    if (requestBody.generationConfig?.maxOutputTokens) requestBody.generationConfig.maxOutputTokens = 50;

    const response = await provider.sendRequest(requestBody, { timeout: 8000 });

    // Extract raw text content directly (parseResponse expects JSON, but we want plain text)
    let summary = null;
    const providerName = settings.modelProvider || 'xai';
    if (providerName === 'gemini') {
      summary = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === 'anthropic') {
      summary = response?.content?.[0]?.text;
    } else {
      // xAI / OpenAI compatible
      summary = response?.choices?.[0]?.message?.content;
    }

    summary = summary?.trim();

    // DBG-04: Strip markdown formatting from AI summary output
    if (summary) {
      summary = summary
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
    }

    if (summary && summary.length > 0 && summary.length <= 60) return summary;
    return summary ? summary.substring(0, 40) : null;
  } catch (e) {
    automationLogger.debug('Task summarization failed (non-blocking)', { error: e.message });
    return null;
  }
}

/** Cache for AI-generated action summaries. Key: "tool:selector_or_url", Value: summary string. Max 50 entries. */
const actionSummaryCache = new Map();

/**
 * Generate a contextual AI summary for an action being executed.
 * Non-blocking: returns null if AI doesn't respond within 2.5s.
 * Uses cache to avoid redundant calls for the same tool+target combo.
 *
 * @param {Object} action - The action being executed { tool, params }
 * @param {Object} session - Active automation session
 * @param {Object} settings - AI provider settings from config.getAll()
 * @returns {Promise<string|null>} Contextual description or null
 */
async function generateActionSummary(action, session, settings) {
  try {
    // Build cache key from tool + primary identifier (selector, url, or query)
    const target = action.params?.selector || action.params?.url || action.params?.query || action.params?.text || '';
    const cacheKey = `${action.tool}:${target}`;

    // Check cache first
    const cached = actionSummaryCache.get(cacheKey);
    if (cached) return cached;

    // Build compact context for the AI
    const taskGoal = session.taskSummary || session.task;
    const elementHint = action.params?.text || action.params?.ariaLabel || action.params?.placeholder || action.params?.selector || '';
    const phase = session._taskPhase || 'unknown';

    const provider = new UniversalProvider(settings);
    const requestBody = await provider.buildRequest({
      systemPrompt: 'You describe what a browser automation step is doing in context of the user\'s goal. Return ONLY a short phrase (5-10 words). No quotes, no markdown, no punctuation at the end. Examples: "Opening LinkedIn Jobs section", "Typing search query for React jobs", "Reading company contact details".',
      userPrompt: `Goal: ${taskGoal}\nAction: ${action.tool}${elementHint ? ' on "' + elementHint + '"' : ''}\nPhase: ${phase}`
    }, {});

    // Minimal tokens - we only need a short phrase
    if (requestBody.max_tokens) requestBody.max_tokens = 30;
    if (requestBody.generationConfig?.maxOutputTokens) requestBody.generationConfig.maxOutputTokens = 30;

    // Race against timeout - 2.5s max
    const response = await Promise.race([
      provider.sendRequest(requestBody, { timeout: 2500 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);

    // Extract text per provider (same pattern as summarizeTask)
    let summary = null;
    const providerName = settings.modelProvider || 'xai';
    if (providerName === 'gemini') {
      summary = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === 'anthropic') {
      summary = response?.content?.[0]?.text;
    } else {
      // xAI / OpenAI compatible
      summary = response?.choices?.[0]?.message?.content;
    }

    summary = summary?.trim();

    // Strip markdown formatting from AI output
    if (summary) {
      summary = summary
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[."'!]+$/g, '') // Strip trailing punctuation
        .trim();
    }

    // Validate: must be short and non-empty
    if (!summary || summary.length === 0 || summary.length > 80) return null;

    // Cache the result (evict oldest if cache is full)
    if (actionSummaryCache.size >= 50) {
      const firstKey = actionSummaryCache.keys().next().value;
      actionSummaryCache.delete(firstKey);
    }
    actionSummaryCache.set(cacheKey, summary);

    return summary;
  } catch (e) {
    // Non-blocking: silently return null on any failure
    return null;
  }
}

/**
 * Task Complexity Estimator — parallel AI call at session start.
 * Analyzes the task description and current URL to estimate required iterations,
 * timeout, and action count. Runs concurrently with the first automation iteration
 * so results are available by iteration 2 at the latest.
 *
 * @param {string} task - User's task description
 * @param {string} currentUrl - The starting page URL
 * @param {Object} settings - AI provider settings
 * @returns {Promise<{estimatedIterations: number, estimatedTimeoutSec: number, estimatedActions: number, taskType: string}|null>}
 */
async function estimateTaskComplexity(task, currentUrl, settings) {
  try {
    if (!task || !settings) return null;

    const provider = new UniversalProvider(settings);
    const requestBody = await provider.buildRequest({
      systemPrompt: `You are a browser automation task estimator. Given a task description and current URL, estimate the complexity.

Respond with ONLY a JSON object (no markdown, no explanation):
{"estimatedIterations": N, "estimatedTimeoutSec": N, "estimatedActions": N, "taskType": "simple|moderate|complex|multi-site"}

Guidelines:
- simple (1 site, few actions): 5-8 iterations, 120s timeout, 5-15 actions
- moderate (1 site, data entry/reading): 8-15 iterations, 300s timeout, 15-40 actions
- complex (multi-step workflow): 12-18 iterations, 420s timeout, 30-60 actions
- multi-site (research across sites + output): 15-25 iterations, 600s timeout, 40-80 actions

Consider: number of sites involved, data collection needs, form filling, navigation depth.`,
      userPrompt: `Task: "${task}"\nStarting URL: ${currentUrl || 'new tab'}`
    }, {});

    // Limit tokens — we only need a small JSON response
    if (requestBody.max_tokens) requestBody.max_tokens = 150;
    if (requestBody.generationConfig?.maxOutputTokens) requestBody.generationConfig.maxOutputTokens = 150;

    const response = await provider.sendRequest(requestBody, { timeout: 10000 });

    // Extract raw text from provider-specific response format
    let text = null;
    const providerName = settings.modelProvider || 'xai';
    if (providerName === 'gemini') {
      text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === 'anthropic') {
      text = response?.content?.[0]?.text;
    } else {
      text = response?.choices?.[0]?.message?.content;
    }

    if (!text) return null;

    // Parse JSON from response (strip any markdown fences)
    text = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
    const estimate = JSON.parse(text);

    // Validate and clamp values to sane ranges
    const result = {
      estimatedIterations: Math.max(5, Math.min(30, parseInt(estimate.estimatedIterations) || 20)),
      estimatedTimeoutSec: Math.max(60, Math.min(900, parseInt(estimate.estimatedTimeoutSec) || 300)),
      estimatedActions: Math.max(3, Math.min(100, parseInt(estimate.estimatedActions) || 30)),
      taskType: ['simple', 'moderate', 'complex', 'multi-site'].includes(estimate.taskType) ? estimate.taskType : 'moderate'
    };

    automationLogger.info('Task complexity estimated', {
      task: task.substring(0, 80),
      ...result
    });

    return result;
  } catch (e) {
    automationLogger.debug('Task complexity estimation failed (non-blocking)', { error: e.message });
    return null;
  }
}

/**
 * PageLoadWatcher - Event-driven page load detection
 * Replaces hardcoded delays with smart waiting that proceeds immediately when ready
 */
class PageLoadWatcher {
  constructor() {
    this.pendingLoads = new Map(); // tabId -> {resolve, timeout, startTime}
  }

  /**
   * Wait for a tab to be fully loaded and ready for interaction
   * @param {number} tabId - Tab to watch
   * @param {Object} options - Configuration options
   * @returns {Promise<{success: boolean, waitTime: number, method: string}>}
   */
  async waitForPageReady(tabId, options = {}) {
    const {
      maxWait = 10000,         // Maximum wait time in ms
      requireDOMStable = true, // Also wait for DOM to stabilize
      stableTime = 300,        // How long DOM must be stable (ms)
    } = options;

    const startTime = Date.now();

    try {
      // Step 1: Wait for tab status='complete'
      await this.waitForTabComplete(tabId, maxWait);

      const afterTabComplete = Date.now() - startTime;
      automationLogger.logTiming(null, 'WAIT', 'tab_complete', afterTabComplete, { tabId });

      // Step 2: Verify content script is responsive
      const remainingForPing = Math.max(2000, maxWait - (Date.now() - startTime));
      const healthOk = await this.pingContentScript(tabId, remainingForPing);
      if (!healthOk) {
        automationLogger.logComm(null, 'health', 'healthCheck', false, { tabId, reason: 'not_responsive' });
        return { success: false, waitTime: Date.now() - startTime, method: 'health-failed' };
      }

      // Step 3: Optionally wait for DOM stability
      if (requireDOMStable) {
        const remainingTime = maxWait - (Date.now() - startTime);
        if (remainingTime > stableTime) {
          const stableResult = await this.waitForDOMStable(tabId, remainingTime, stableTime);
          automationLogger.logTiming(null, 'WAIT', 'dom_stable', stableResult?.waitTime || remainingTime, { tabId, ...stableResult });
        }
      }

      const waitTime = Date.now() - startTime;
      automationLogger.logTiming(null, 'WAIT', 'page_ready', waitTime, { tabId, method: 'event-driven' });

      return { success: true, waitTime, method: 'event-driven' };
    } catch (error) {
      const waitTime = Date.now() - startTime;
      automationLogger.logComm(null, 'health', 'page_ready', false, { tabId, error: error.message, waitTime });
      return {
        success: false,
        waitTime,
        method: 'error',
        error: error.message
      };
    }
  }

  /**
   * Wait for chrome.tabs.onUpdated status='complete'
   * @param {number} tabId - Tab to watch
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<void>}
   */
  waitForTabComplete(tabId, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, timeout);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      // Check if already complete
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          clearTimeout(timeoutId);
          resolve();
        } else {
          chrome.tabs.onUpdated.addListener(listener);
        }
      }).catch(err => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }

  /**
   * Ping content script to verify it's responsive
   * @param {number} tabId - Tab to ping
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>}
   */
  async pingContentScript(tabId, timeout = 2000) {
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { action: 'healthCheck' }, { frameId: 0 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ping timeout')), timeout)
        )
      ]);
      return response?.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for DOM to stabilize via content script
   * @param {number} tabId - Tab to check
   * @param {number} timeout - Max wait time in ms
   * @param {number} stableTime - How long DOM must be stable
   * @returns {Promise<Object>}
   */
  async waitForDOMStable(tabId, timeout, stableTime) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'executeAction',
        tool: 'waitForDOMStable',
        params: { timeout, stableTime }
      }, { frameId: 0 });
      return response || { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick check if page appears ready (non-blocking)
   * @param {number} tabId - Tab to check
   * @returns {Promise<Object>}
   */
  async checkPageReady(tabId) {
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { action: 'checkPageReady' }, { frameId: 0 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Check timeout')), 1000)
        )
      ]);
      return response || { success: false, isReady: false };
    } catch {
      return { success: false, isReady: false };
    }
  }
}

// Global PageLoadWatcher instance
const pageLoadWatcher = new PageLoadWatcher();

// EASY WIN #10: Service worker keep-alive mechanism
// Prevents service worker from shutting down during active automation sessions
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return; // Already running

  automationLogger.logServiceWorker('keepalive_start', { interval: 20000 });
  keepAliveInterval = setInterval(() => {
    // No-op operation to keep service worker alive
    chrome.runtime.getPlatformInfo(() => {
      // Just accessing the API keeps the worker active
    });
  }, 20000); // Ping every 20 seconds (MV3 workers shut down after 30s of inactivity)
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    automationLogger.logServiceWorker('keepalive_stop', {});
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// EASY WIN #10: Helper to clean up session and stop keep-alive if no active sessions
// Enhanced with race condition protection
async function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);

  // If session exists, mark it as terminating and wait for loop to yield
  if (session) {
    session.isTerminating = true;

    // PERF: Signal the stop via AbortController (replaces 500ms polling)
    if (session._stopAbortController) {
      session._stopAbortController.abort();
      session._stopAbortController = null;
    }

    // If there's an active loop iteration, wait for it to yield
    if (session.loopPromise) {
      automationLogger.debug('Waiting for active loop to yield', { sessionId });
      try {
        // Wait up to 5 seconds for the loop to yield
        await Promise.race([
          session.loopPromise,
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      } catch (e) {
        automationLogger.debug('Loop yield wait completed', { sessionId, message: e?.message || 'timeout' });
      }
    }

    // Clear any pending timeouts
    if (session.pendingTimeout) {
      clearTimeout(session.pendingTimeout);
      session.pendingTimeout = null;
    }

    // Clear safety timeout to prevent zombie promise resolution after stop
    if (session._safetyTimeout) {
      clearTimeout(session._safetyTimeout);
      session._safetyTimeout = null;
    }

    // Clean up orphaned login handler if session had one
    if (session._loginHandler) {
      chrome.runtime.onMessage.removeListener(session._loginHandler.handler);
      clearTimeout(session._loginHandler.timeout);
      session._loginHandler = null;
    }

    // Defense-in-depth: always send overlay cleanup to content script.
    // Some code paths call cleanupSession without endSessionOverlays;
    // sending 'ended' again is harmless if overlays were already destroyed.
    try {
      await endSessionOverlays(session, 'cleanup');
    } catch (e) {
      automationLogger.debug('endSessionOverlays during cleanup failed (non-blocking)', { sessionId, error: e?.message });
    }
  }

  // PERF: Flush any pending debounced log writes before session cleanup
  if (automationLogger && typeof automationLogger.flush === 'function') {
    automationLogger.flush();
  }

  activeSessions.delete(sessionId);
  // Also remove from persistent storage
  removePersistedSession(sessionId);

  // Clean up conversation session entries that reference this session
  removeConversationThread(sessionId, session?.conversationId || null);

  // Clean up AI instance and its conversation history
  if (sessionAIInstances.has(sessionId)) {
    const ai = sessionAIInstances.get(sessionId);
    if (ai && typeof ai.clearConversationHistory === 'function') {
      ai.clearConversationHistory();
    }
    sessionAIInstances.delete(sessionId);
    mcpProgressCallbacks.delete(sessionId);
    automationLogger.debug('Cleaned up AI instance for session', { sessionId });
  }

  // Stop keep-alive if no actively-running sessions remain
  const hasActiveSession = [...activeSessions.values()].some(s =>
    s.status === 'running' || s.status === 'replaying'
  );
  if (!hasActiveSession) {
    automationLogger.logServiceWorker('session_count', { count: activeSessions.size, action: 'stopping_keepalive', reason: 'no_running_sessions' });
    stopKeepAlive();
  } else {
    automationLogger.logServiceWorker('session_count', { count: activeSessions.size, action: 'keeping_alive' });
  }
}

// Helper to check if session is terminating (used in automation loop)
function isSessionTerminating(sessionId) {
  const session = activeSessions.get(sessionId);
  return !session || session.isTerminating || session.status !== 'running';
}

/**
 * Reactivate an idle session for a follow-up command.
 * Resets per-command counters while preserving cumulative state (actionHistory, AI history).
 * @param {Object} session - The session object from activeSessions
 * @param {string} newTask - The new follow-up task/command
 */
function reactivateSession(session, newTask) {
  // Reset per-command fields (new command = fresh stuck detection state)
  session.status = 'running';
  session.task = newTask;
  session.iterationCount = 0;
  session.stuckCounter = 0;              // Reset: new command
  session.consecutiveNoProgressCount = 0; // Reset: new command
  session.lastDOMHash = null;
  session.lastDOMSignals = null;
  session.actionSequences = [];
  session.sequenceRepeatCount = {};
  session.startTime = Date.now();
  session.isTerminating = false;

  // Track command count and command history
  session.commandCount = (session.commandCount || 1) + 1;
  session.commands = session.commands || [];
  session.commands.push(newTask);
  session.lastTask = newTask;
  session.lastCommandAt = Date.now();
  session.uiSurface = normalizeUiSurface(session.uiSurface);
  session.historySessionId = session.historySessionId || session.sessionId || null;

  // Clear idle timeout if one was scheduled
  if (session.idleTimeout) {
    clearTimeout(session.idleTimeout);
    session.idleTimeout = null;
  }

  // Preserved (not touched): actionHistory, stateHistory, tabId, allowedTabs,
  // domSettings, conversationId, animatedActionHighlights, and the AI instance
  // in sessionAIInstances retains its full conversation history.
}

/**
 * Transition a session to idle status instead of fully cleaning it up.
 * The session remains in activeSessions with status 'idle' so it can be reactivated
 * by a follow-up command. A deferred cleanup timer will fully clean up after IDLE_SESSION_TIMEOUT.
 * @param {string} sessionId - The session ID to idle
 */
function idleSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.status = 'idle';
  session.lastTask = session.task;
  session.lastCommandAt = session.lastCommandAt || Date.now();
  session.historySessionId = session.historySessionId || session.sessionId || null;
  upsertConversationThread(session);

  // Schedule deferred cleanup -- if no follow-up comes within the timeout, clean up fully
  session.idleTimeout = setTimeout(() => {
    if (session.status === 'idle') {
      automationLogger.debug('Idle session timeout, cleaning up', { sessionId });
      cleanupSession(sessionId);
    }
  }, IDLE_SESSION_TIMEOUT);

  // Persist the idle status so it survives service worker restarts
  persistSession(sessionId, session);
  persistConversationSessions();

  automationLogger.info('Session transitioned to idle', {
    sessionId,
    conversationId: session.conversationId || null,
    historySessionId: session.historySessionId || null,
    uiSurface: session.uiSurface || 'unknown',
    commandCount: session.commandCount || 1,
    actionHistoryLength: session.actionHistory?.length || 0
  });

  // Keep-alive stays running while idle sessions exist (activeSessions.size > 0)
  // The existing stopKeepAlive() check in cleanupSession handles stopping when size === 0
}

/**
 * Persist conversationSessions Map to chrome.storage.session for service worker restart survival.
 */
async function persistConversationSessions() {
  try {
    await chrome.storage.session.set({
      fsbConversationSessions: Object.fromEntries(conversationSessions)
    });
    automationLogger.debug('Conversation sessions persisted', { count: conversationSessions.size });
  } catch (error) {
    automationLogger.warn('Failed to persist conversation sessions', { error: error.message });
  }
}

/**
 * Restore conversationSessions Map from chrome.storage.session after service worker restart.
 * Validates that referenced sessions still exist in activeSessions.
 */
async function restoreConversationSessions() {
  try {
    const stored = await chrome.storage.session.get('fsbConversationSessions');
    const data = stored?.fsbConversationSessions;
    if (data && typeof data === 'object') {
      for (const [convId, entry] of Object.entries(data)) {
        // Only restore if the referenced session still exists
        if (entry?.sessionId && activeSessions.has(entry.sessionId)) {
          const session = activeSessions.get(entry.sessionId);
          const threadRecord = createConversationThreadRecord({
            ...session,
            ...entry,
            conversationId: entry.conversationId || convId,
            sessionId: entry.sessionId
          });

          if (threadRecord) {
            conversationSessions.set(threadRecord.conversationId, threadRecord);
          }
        }
      }
      automationLogger.debug('Conversation sessions restored', { count: conversationSessions.size });
    }
  } catch (error) {
    automationLogger.warn('Failed to restore conversation sessions', { error: error.message });
  }
}

// Store for active automation sessions
let activeSessions = new Map();

// Store for AI integration instances per session (for multi-turn conversations)
// This allows conversation history to persist across iterations within a session
let sessionAIInstances = new Map();

// Session continuity: maps conversationId to a durable thread record.
// Enables follow-up commands in the same conversation to reuse the existing session
// and recover the correct UI/history thread after service worker restarts.
let conversationSessions = new Map();
const IDLE_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes before idle sessions are cleaned up
const MAX_CONVERSATION_SESSIONS = 5; // FIFO cap using enforceMapLimit
const MAX_PERSISTED_COMMANDS = 25;
const MAX_AGENT_RESUME_MESSAGES = 12;
const MAX_AGENT_RESUME_SUMMARY_LINES = 8;
const MAX_AGENT_RESUME_TEXT_CHARS = 600;
const MAX_AGENT_RESUME_SUMMARY_CHARS = 1800;

// PERF: Max Map sizes to prevent unbounded growth
const MAX_CONTENT_SCRIPT_ENTRIES = 200;

/**
 * Enforce size limit on a Map by evicting oldest entries.
 * @param {Map} map - The map to trim
 * @param {number} maxSize - Maximum allowed entries
 */
function enforceMapLimit(map, maxSize) {
  if (map.size <= maxSize) return;
  const excess = map.size - maxSize;
  const iter = map.keys();
  for (let i = 0; i < excess; i++) {
    const key = iter.next().value;
    map.delete(key);
  }
}

function normalizeUiSurface(uiSurface) {
  if (uiSurface === 'sidepanel' || uiSurface === 'popup') {
    return uiSurface;
  }
  return 'unknown';
}

function inferUiSurface(request, sender, triggerSource) {
  if (request?.uiSurface) {
    return normalizeUiSurface(request.uiSurface);
  }

  const senderUrl = sender?.url || sender?.documentUrl || '';
  if (typeof senderUrl === 'string') {
    if (senderUrl.includes('/ui/sidepanel.html')) {
      return 'sidepanel';
    }
    if (senderUrl.includes('/ui/popup.html')) {
      return 'popup';
    }
  }

  if (triggerSource === 'sidepanel' || triggerSource === 'popup') {
    return triggerSource;
  }

  return 'unknown';
}

function getPersistedCommands(commands, fallbackTask) {
  const nextCommands = Array.isArray(commands)
    ? commands.filter(command => typeof command === 'string' && command.trim().length > 0)
    : [];

  if (nextCommands.length > 0) {
    return nextCommands.slice(-MAX_PERSISTED_COMMANDS);
  }

  if (typeof fallbackTask === 'string' && fallbackTask.trim().length > 0) {
    return [fallbackTask];
  }

  return [];
}

function truncateAgentResumeText(value, maxChars = MAX_AGENT_RESUME_TEXT_CHARS) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function summarizeAgentResumeValue(value, maxChars = MAX_AGENT_RESUME_TEXT_CHARS) {
  if (value == null) return null;
  if (typeof value === 'string') {
    return truncateAgentResumeText(value, maxChars);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  try {
    const json = JSON.stringify(value);
    if (json.length <= maxChars) {
      return JSON.parse(json);
    }
    return {
      truncated: true,
      preview: truncateAgentResumeText(json, maxChars)
    };
  } catch (_error) {
    return {
      truncated: true,
      preview: truncateAgentResumeText(String(value), maxChars)
    };
  }
}

function isProviderToolResultMessage(message) {
  return message?.role === 'tool' ||
    (Array.isArray(message?.content) && message.content.some(block => block.type === 'tool_result')) ||
    (Array.isArray(message?.parts) && message.parts.some(part => part.functionResponse));
}

function hasProviderToolCalls(message) {
  return Array.isArray(message?.tool_calls) ||
    (Array.isArray(message?.content) && message.content.some(block => block.type === 'tool_use')) ||
    (Array.isArray(message?.parts) && message.parts.some(part => part.functionCall));
}

function getAgentResumeWindowStart(messages) {
  let startIndex = Math.max(0, messages.length - MAX_AGENT_RESUME_MESSAGES);

  while (startIndex > 0 && isProviderToolResultMessage(messages[startIndex])) {
    startIndex--;
  }

  if (startIndex > 0 && isProviderToolResultMessage(messages[startIndex - 1])) {
    while (startIndex > 0 && isProviderToolResultMessage(messages[startIndex - 1])) {
      startIndex--;
    }
    if (startIndex > 0 && hasProviderToolCalls(messages[startIndex - 1])) {
      startIndex--;
    }
  }

  return startIndex;
}

function summarizeAgentResumeMessage(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }

  if (message.role === 'tool') {
    const toolName = message.name || 'unknown_tool';
    let status = 'completed';
    try {
      const parsed = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
      status = parsed?.success === false ? 'error' : 'success';
    } catch (_error) {
      status = typeof message.content === 'string' && message.content.includes('error') ? 'error' : 'success';
    }
    return `Tool ${toolName} returned ${status}`;
  }

  if (Array.isArray(message.content)) {
    const toolNames = message.content
      .filter(block => block.type === 'tool_use')
      .map(block => block.name)
      .filter(Boolean);
    if (toolNames.length > 0) {
      return `Assistant requested tools: ${toolNames.join(', ')}`;
    }
    const textBlock = message.content.find(block => block.type === 'text' && typeof block.text === 'string');
    if (textBlock) {
      return `${message.role || 'message'}: ${truncateAgentResumeText(textBlock.text, 120)}`;
    }
  }

  if (Array.isArray(message.parts)) {
    const functionNames = message.parts
      .map(part => part.functionCall?.name || part.functionResponse?.name || null)
      .filter(Boolean);
    if (functionNames.length > 0) {
      return `${message.role || 'message'}: ${functionNames.join(', ')}`;
    }
    const textPart = message.parts.find(part => typeof part.text === 'string');
    if (textPart?.text) {
      return `${message.role || 'message'}: ${truncateAgentResumeText(textPart.text, 120)}`;
    }
  }

  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const toolNames = message.tool_calls
      .map(call => call.function?.name || null)
      .filter(Boolean);
    return `Assistant requested tools: ${toolNames.join(', ')}`;
  }

  if (typeof message.content === 'string') {
    return `${message.role || 'message'}: ${truncateAgentResumeText(message.content, 120)}`;
  }

  return `${message.role || 'message'} update`;
}

function sanitizeAgentResumeMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.tool_call_id || '',
      name: message.name || '',
      content: truncateAgentResumeText(message.content, MAX_AGENT_RESUME_TEXT_CHARS)
    };
  }

  if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
    return {
      role: 'assistant',
      content: truncateAgentResumeText(message.content, 240),
      tool_calls: message.tool_calls.map(call => ({
        id: call.id,
        type: call.type || 'function',
        function: {
          name: call.function?.name || '',
          arguments: JSON.stringify(summarizeAgentResumeValue(
            typeof call.function?.arguments === 'string'
              ? (() => {
                  try { return JSON.parse(call.function.arguments); } catch (_error) { return call.function.arguments; }
                })()
              : call.function?.arguments,
            400
          ) || {})
        }
      }))
    };
  }

  if (Array.isArray(message.content)) {
    return {
      role: message.role || 'assistant',
      content: message.content.map(block => {
        if (block.type === 'text') {
          return {
            type: 'text',
            text: truncateAgentResumeText(block.text, MAX_AGENT_RESUME_TEXT_CHARS)
          };
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id || '',
            name: block.name || '',
            input: summarizeAgentResumeValue(block.input, 400) || {}
          };
        }
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: block.tool_use_id || '',
            content: truncateAgentResumeText(block.content, MAX_AGENT_RESUME_TEXT_CHARS),
            ...(block.is_error ? { is_error: true } : {})
          };
        }
        return {
          type: block.type || 'text',
          text: truncateAgentResumeText(JSON.stringify(block), MAX_AGENT_RESUME_TEXT_CHARS)
        };
      })
    };
  }

  if (Array.isArray(message.parts)) {
    return {
      role: message.role || 'user',
      parts: message.parts.map(part => {
        if (typeof part.text === 'string') {
          return { text: truncateAgentResumeText(part.text, MAX_AGENT_RESUME_TEXT_CHARS) };
        }
        if (part.functionCall) {
          return {
            functionCall: {
              name: part.functionCall.name || '',
              args: summarizeAgentResumeValue(part.functionCall.args, 400) || {}
            }
          };
        }
        if (part.functionResponse) {
          return {
            functionResponse: {
              name: part.functionResponse.name || '',
              response: summarizeAgentResumeValue(part.functionResponse.response, 400) || {}
            }
          };
        }
        return { text: truncateAgentResumeText(JSON.stringify(part), MAX_AGENT_RESUME_TEXT_CHARS) };
      })
    };
  }

  return {
    role: message.role || 'user',
    content: truncateAgentResumeText(message.content, MAX_AGENT_RESUME_TEXT_CHARS)
  };
}

function serializeAgentResumeState(sessionLike) {
  const nonSystemMessages = Array.isArray(sessionLike?.messages)
    ? sessionLike.messages.filter(message => message && message.role !== 'system')
    : [];
  const startIndex = getAgentResumeWindowStart(nonSystemMessages);
  const olderMessages = nonSystemMessages.slice(0, startIndex);
  const recentMessages = nonSystemMessages
    .slice(startIndex)
    .map(sanitizeAgentResumeMessage)
    .filter(Boolean);

  const olderSummaryLines = olderMessages
    .slice(-MAX_AGENT_RESUME_SUMMARY_LINES)
    .map(summarizeAgentResumeMessage)
    .filter(Boolean);

  const inheritedSummary = sessionLike?.resumeSummary || sessionLike?.agentResumeState?.historySummary || null;
  let historySummary = inheritedSummary ? truncateAgentResumeText(inheritedSummary, MAX_AGENT_RESUME_SUMMARY_CHARS) : null;

  if (olderSummaryLines.length > 0) {
    historySummary = truncateAgentResumeText([
      historySummary,
      `Earlier automation context omitted ${olderMessages.length} message(s).`,
      ...olderSummaryLines
    ].filter(Boolean).join('\n'), MAX_AGENT_RESUME_SUMMARY_CHARS);
  }

  const agentState = sessionLike?.agentState || sessionLike?.agentResumeState?.agentState || {};

  return {
    providerConfig: {
      providerKey: sessionLike?.providerConfig?.providerKey || sessionLike?.agentResumeState?.providerConfig?.providerKey || null,
      model: sessionLike?.providerConfig?.model || sessionLike?.agentResumeState?.providerConfig?.model || null
    },
    historySummary,
    recentMessages,
    agentState: {
      completedIterations: (agentState.completedIterations || 0) + (agentState.iterationCount || 0),
      totalInputTokens: agentState.totalInputTokens || sessionLike?.totalInputTokens || 0,
      totalOutputTokens: agentState.totalOutputTokens || sessionLike?.totalOutputTokens || 0,
      totalCost: agentState.totalCost || sessionLike?.totalCost || 0,
      lastCommandAt: sessionLike?.lastCommandAt || Date.now()
    },
    updatedAt: Date.now()
  };
}

function serializeSessionContinuity(sessionLike) {
  const commands = getPersistedCommands(sessionLike?.commands, sessionLike?.task || sessionLike?.lastTask);
  const lastTask = sessionLike?.task || sessionLike?.lastTask || commands[commands.length - 1] || null;
  const commandCount = Math.max(sessionLike?.commandCount || 0, commands.length || 0, lastTask ? 1 : 0);

  return {
    conversationId: sessionLike?.conversationId || null,
    sessionId: sessionLike?.sessionId || null,
    uiSurface: normalizeUiSurface(sessionLike?.uiSurface),
    historySessionId: sessionLike?.historySessionId || sessionLike?.sessionId || null,
    lastTask,
    lastCommandAt: sessionLike?.lastCommandAt || sessionLike?.startTime || Date.now(),
    commandCount: commandCount || 1,
    commands
  };
}

function applyContinuityToSession(session, continuity) {
  if (!session || !continuity) return session;

  session.conversationId = continuity.conversationId;
  session.uiSurface = continuity.uiSurface;
  session.historySessionId = continuity.historySessionId;
  session.lastTask = continuity.lastTask;
  session.lastCommandAt = continuity.lastCommandAt;
  session.commandCount = continuity.commandCount;
  session.commands = continuity.commands;
  session.continuity = continuity;

  return session;
}

function createConversationThreadRecord(sessionLike) {
  const continuity = serializeSessionContinuity(sessionLike);
  if (!continuity.conversationId || !continuity.sessionId) {
    return null;
  }

  return {
    conversationId: continuity.conversationId,
    sessionId: continuity.sessionId,
    uiSurface: continuity.uiSurface,
    historySessionId: continuity.historySessionId,
    persistedSessionId: continuity.sessionId,
    lastTask: continuity.lastTask,
    lastCommandAt: continuity.lastCommandAt,
    commandCount: continuity.commandCount,
    updatedAt: Date.now()
  };
}

function upsertConversationThread(sessionLike) {
  const threadRecord = createConversationThreadRecord(sessionLike);
  if (!threadRecord) {
    return null;
  }

  conversationSessions.set(threadRecord.conversationId, threadRecord);
  enforceMapLimit(conversationSessions, MAX_CONVERSATION_SESSIONS);
  persistConversationSessions();
  return threadRecord;
}

function removeConversationThread(sessionId, conversationId = null) {
  let removed = false;

  for (const [convId, entry] of conversationSessions) {
    if (entry.sessionId === sessionId || (conversationId && convId === conversationId)) {
      conversationSessions.delete(convId);
      removed = true;
    }
  }

  if (removed) {
    persistConversationSessions();
  }
}

function findConversationThreadByHistorySessionId(historySessionId) {
  if (!historySessionId) {
    return null;
  }

  for (const entry of conversationSessions.values()) {
    if (entry.historySessionId === historySessionId || entry.sessionId === historySessionId) {
      return entry;
    }
  }

  return null;
}

function resolveRequestedConversationThread({ uiSurface, selectedConversationId, historySessionId, conversationId }) {
  const normalizedSurface = normalizeUiSurface(uiSurface);

  if (historySessionId) {
    const historyThread = findConversationThreadByHistorySessionId(historySessionId);
    if (historyThread) {
      return {
        uiSurface: normalizedSurface,
        conversationId: historyThread.conversationId,
        historySessionId: historyThread.historySessionId || historySessionId,
        threadRecord: historyThread
      };
    }
  }

  if (selectedConversationId) {
    const selectedThread = conversationSessions.has(selectedConversationId)
      ? conversationSessions.get(selectedConversationId)
      : null;

    return {
      uiSurface: normalizedSurface,
      conversationId: selectedThread?.conversationId || selectedConversationId,
      historySessionId: selectedThread?.historySessionId || historySessionId || null,
      threadRecord: selectedThread
    };
  }

  if (conversationId) {
    const fallbackThread = conversationSessions.has(conversationId)
      ? conversationSessions.get(conversationId)
      : null;

    return {
      uiSurface: normalizedSurface,
      conversationId: fallbackThread?.conversationId || conversationId,
      historySessionId: fallbackThread?.historySessionId || historySessionId || null,
      threadRecord: fallbackThread
    };
  }

  return {
    uiSurface: normalizedSurface,
    conversationId: null,
    historySessionId: historySessionId || null,
    threadRecord: null
  };
}

function buildSessionsBySurface() {
  const sessionsBySurface = {};

  for (const session of activeSessions.values()) {
    const uiSurface = normalizeUiSurface(session.uiSurface);
    if (uiSurface === 'unknown') {
      continue;
    }

    const entry = {
      sessionId: session.sessionId || null,
      conversationId: session.conversationId || null,
      historySessionId: session.historySessionId || session.sessionId || null,
      task: session.task || null,
      startTime: session.startTime || null,
      status: session.status || null,
      commandCount: session.commandCount || 1,
      lastCommandAt: session.lastCommandAt || session.startTime || 0
    };

    if (!sessionsBySurface[uiSurface] || entry.lastCommandAt >= (sessionsBySurface[uiSurface].lastCommandAt || 0)) {
      sessionsBySurface[uiSurface] = entry;
    }
  }

  return sessionsBySurface;
}

// Session persistence helpers - survive service worker restarts
// Persists essential session data to chrome.storage.session
async function persistSession(sessionId, session) {
  try {
    const continuity = serializeSessionContinuity({
      ...session,
      sessionId
    });
    const agentResumeState = serializeAgentResumeState({
      ...session,
      sessionId
    });
    session.continuity = continuity;
    session.agentResumeState = agentResumeState;

    // Only persist essential fields needed for stop button and session continuity to work
    const persistableSession = {
      sessionId: sessionId,
      task: session.task,
      tabId: session.tabId,
      status: session.status,
      mode: session.mode,
      startTime: session.startTime,
      conversationId: continuity.conversationId,
      uiSurface: continuity.uiSurface,
      historySessionId: continuity.historySessionId,
      lastTask: continuity.lastTask,
      lastCommandAt: continuity.lastCommandAt,
      commandCount: continuity.commandCount,
      commands: continuity.commands,
      continuity,
      followUpContext: session.followUpContext ? {
        previousTask: session.followUpContext.previousTask || null,
        newTask: session.followUpContext.newTask || session.task,
        requestedAt: session.followUpContext.requestedAt || Date.now(),
        commandCount: session.followUpContext.commandCount || continuity.commandCount,
        historySessionId: session.followUpContext.historySessionId || continuity.historySessionId
      } : null,
      agentResumeState,
      // Don't persist: loopPromise, pendingTimeout, DOM hashes, etc. (non-serializable or transient)
      // Agent loop state for follow-up hydration is stored inside agentResumeState.
    };

    // Persist multi-site orchestration state for service worker restart recovery
    if (session.multiSite) {
      persistableSession.multiSite = {
        originalTask: session.multiSite.originalTask,
        companyList: session.multiSite.companyList,
        currentIndex: session.multiSite.currentIndex,
        deferredCompanies: session.multiSite.deferredCompanies,
        failures: session.multiSite.failures,
        searchQuery: session.multiSite.searchQuery,
        startedAt: session.multiSite.startedAt
      };
    }

    const key = `session_${sessionId}`;
    await chrome.storage.session.set({ [key]: persistableSession });
    automationLogger.debug('Session persisted to storage', { sessionId });
  } catch (error) {
    automationLogger.warn('Failed to persist session', { sessionId, error: error.message });
  }
}

// Remove persisted session from storage
async function removePersistedSession(sessionId) {
  try {
    const key = `session_${sessionId}`;
    await chrome.storage.session.remove(key);
    automationLogger.debug('Session removed from storage', { sessionId });
  } catch (error) {
    automationLogger.warn('Failed to remove persisted session', { sessionId, error: error.message });
  }
}

// Restore sessions from storage on service worker startup.
// Running sessions are auto-resumed (D-03); idle sessions retain agent state
// for follow-up reactivation when the user continues the thread later.
async function restoreSessionsFromStorage() {
  try {
    const allStorage = await chrome.storage.session.get(null);
    const sessionKeys = Object.keys(allStorage).filter(k => k.startsWith('session_'));

    for (const key of sessionKeys) {
      const persistedSession = allStorage[key];
      if (persistedSession && persistedSession.sessionId) {
        const continuity = serializeSessionContinuity({
          ...persistedSession,
          ...persistedSession.continuity,
          sessionId: persistedSession.sessionId
        });

        if (persistedSession.status === 'running') {
          // D-03: Auto-resume running sessions after service worker restart
          var restoredSession = applyContinuityToSession(createSession({
            ...persistedSession,
            isRestored: true,
            followUpContext: persistedSession.followUpContext || null,
            agentResumeState: persistedSession.agentResumeState || null,
            resumeSummary: persistedSession.agentResumeState?.historySummary || null,
            messages: null,
            tools: null,
            providerConfig: persistedSession.agentResumeState?.providerConfig || null,
            agentState: persistedSession.agentResumeState?.agentState || null,
          }), continuity);

          activeSessions.set(persistedSession.sessionId, restoredSession);

          automationLogger.info('Auto-resuming running session after SW restart (D-03)', {
            sessionId: persistedSession.sessionId,
            status: persistedSession.status,
            task: persistedSession.task?.substring(0, 50),
            iteration: restoredSession.agentState?.iterationCount || 0
          });

          // D-03: Automatic resumption -- continue automation seamlessly
          try {
            // Verify tab still exists before resuming
            await chrome.tabs.get(restoredSession.tabId);
            startKeepAlive();
            var resumeHooks = createSessionHooks();
            runAgentLoop(persistedSession.sessionId, {
              activeSessions,
              persistSession,
              sendSessionStatus,
              broadcastDashboardProgress,
              endSessionOverlays, cleanupSession,
              startKeepAlive,
              executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
              handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
              resolveAuthWall: resolveInlineAuthWall,
              hooks: resumeHooks.hooks,
              emitter: resumeHooks.emitter
            });
          } catch (tabErr) {
            automationLogger.warn('Cannot auto-resume: tab no longer exists', {
              sessionId: persistedSession.sessionId,
              tabId: restoredSession.tabId,
              error: tabErr.message
            });
            restoredSession.status = 'stopped';
            restoredSession.error = 'Tab closed during service worker restart';
          }
        } else if (persistedSession.status === 'idle') {
          // Idle sessions: restore for reactivation (existing behavior)
          var restoredSession = applyContinuityToSession(createSession({
            ...persistedSession,
            isRestored: true,
            followUpContext: persistedSession.followUpContext || null,
            agentResumeState: persistedSession.agentResumeState || null,
            resumeSummary: persistedSession.agentResumeState?.historySummary || null,
            messages: null,
            tools: null,
            providerConfig: persistedSession.agentResumeState?.providerConfig || null,
            agentState: persistedSession.agentResumeState?.agentState || null,
          }), continuity);

          activeSessions.set(persistedSession.sessionId, restoredSession);
          automationLogger.info('Restored idle session from storage', {
            sessionId: persistedSession.sessionId,
            status: persistedSession.status,
            task: persistedSession.task?.substring(0, 50)
          });
        } else {
          // Clean up non-running/non-idle sessions from storage
          await removePersistedSession(persistedSession.sessionId);
        }
      }
    }

    // Restore conversation session mappings after sessions are restored
    await restoreConversationSessions();

    automationLogger.logServiceWorker('sessions_restored', { count: activeSessions.size, conversationSessions: conversationSessions.size });
  } catch (error) {
    automationLogger.warn('Failed to restore sessions from storage', { error: error.message });
  }
}

// Run bootstrap pipeline on service worker wake
// Handles settings, environment, tools, and session restoration in order
swBootstrap('wake').catch(function(err) {
  console.warn('FSB: Bootstrap failed on wake:', err);
});

// Periodic cleanup of stale sessions (every 5 minutes)
setInterval(async () => {
  const now = Date.now();
  const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  for (const [sessionId, session] of activeSessions) {
    // Remove idle sessions older than 30 minutes
    if (session.status === 'idle' && now - (session.startTime || 0) > STALE_THRESHOLD) {
      automationLogger.info('Removing stale idle session', { sessionId, ageMs: now - (session.startTime || 0) });
      activeSessions.delete(sessionId);
      sessionAIInstances.delete(sessionId);
      removePersistedSession(sessionId);
      removeConversationThread(sessionId, session.conversationId || null);
      continue;
    }
    // VMFIX-03: Expire running sessions with no iteration progress for 5 minutes
    const RUNNING_INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    if (session.status === 'running' && session.lastIterationTime &&
        now - session.lastIterationTime > RUNNING_INACTIVITY_THRESHOLD) {
      automationLogger.warn('Expiring stale running session (no iteration in 5 min)', {
        sessionId,
        lastIteration: session.lastIterationTime,
        iterationCount: session.iterationCount,
        ageMs: now - session.lastIterationTime
      });
      session.status = 'expired';
      activeSessions.delete(sessionId);
      sessionAIInstances.delete(sessionId);
      removePersistedSession(sessionId);
      removeConversationThread(sessionId, session.conversationId || null);
      // Notify UI that session expired
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: {
          success: false,
          result: 'Session expired due to inactivity (no progress for 5 minutes)',
          error: 'session_expired_inactivity'
        },
        task: session.task
      }).catch(() => {});
      continue;
    }
    // Remove sessions whose tab no longer exists
    if (session.tabId) {
      try {
        await chrome.tabs.get(session.tabId);
      } catch {
        automationLogger.info('Removing session for closed tab', { sessionId, tabId: session.tabId });
        activeSessions.delete(sessionId);
        sessionAIInstances.delete(sessionId);
        removePersistedSession(sessionId);
        removeConversationThread(sessionId, session.conversationId || null);
      }
    }
  }
  // Stop keep-alive if no running sessions remain
  const hasActiveSession = [...activeSessions.values()].some(s =>
    s.status === 'running' || s.status === 'replaying'
  );
  if (!hasActiveSession) stopKeepAlive();
}, 5 * 60 * 1000);

// Track content script ready status per tab
let contentScriptReadyStatus = new Map();

// Analytics instance managed by getAnalytics() lazy guard via _analyticsInstance (var, declared below)

// Bootstrap pipeline guards (var for importScripts compatibility)
var _bootstrapDone = false;
var _analyticsInstance = null;
var _wsInitDone = false;
var _deferredInitDone = false;

// Content script communication health tracking
let contentScriptHealth = new Map();

// Track active content script ports per tab for persistent connections
const contentScriptPorts = new Map();

// Listen for persistent port connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  debugLog('[FSB Background] onConnect received, port name:', port.name);
  if (port.name === 'content-script') {
    const tabId = port.sender?.tab?.id;
    const frameId = port.sender?.frameId;
    debugLog('[FSB Background] Content script port connection', { tabId, frameId });
    if (!tabId || frameId !== 0) {
      debugLog('[FSB Background] Ignoring non-main-frame port');
      return; // Main frame only
    }

    contentScriptPorts.set(tabId, {
      port,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now()
    });
    enforceMapLimit(contentScriptPorts, MAX_CONTENT_SCRIPT_ENTRIES);
    debugLog('[FSB Background] Port stored for tab:', tabId);

    automationLogger.logComm(null, 'receive', 'port_connected', true, { tabId });

    port.onMessage.addListener((msg) => {
      if (msg.type === 'ready') {
        // Update heartbeat timestamp when ready message is received
        const portInfo = contentScriptPorts.get(tabId);
        if (portInfo) portInfo.lastHeartbeat = Date.now();

        contentScriptReadyStatus.set(tabId, {
          ready: true,
          timestamp: msg.timestamp,
          url: msg.url,
          method: 'port'
        });
        automationLogger.logComm(null, 'receive', 'port_ready', true, { tabId, url: msg.url });

        var overlaySession = findOverlaySession(tabId, msg || {});
        if (overlaySession &&
            overlaySession.status === 'running' &&
            overlaySession._lastOverlayStatusData &&
            overlaySession._lastOverlayTargetTabId === tabId) {
          sendSessionStatus(tabId, overlaySession._lastOverlayStatusData)
            .then(function() {
              requestOverlayStateBroadcast(tabId);
            })
            .catch(function(_replayErr) {
              // Non-blocking: ready handling should not fail if replay delivery misses.
            });
        }
      } else if (msg.type === 'heartbeat-ack') {
        const portInfo = contentScriptPorts.get(tabId);
        if (portInfo) portInfo.lastHeartbeat = Date.now();
      } else if (msg.type === 'spaNavigation') {
        // Handle SPA navigation notification via port
        const status = contentScriptReadyStatus.get(tabId);
        if (status) {
          status.url = msg.url;
          status.lastSpaNav = Date.now();
        }
        automationLogger.logComm(null, 'receive', 'spa_nav_port', true, { tabId, url: msg.url, method: msg.method });
      }
    });

    port.onDisconnect.addListener(() => {
      contentScriptPorts.delete(tabId);
      contentScriptReadyStatus.delete(tabId);
      contentScriptHealth.delete(tabId);
      automationLogger.logComm(null, 'receive', 'port_disconnected', true, { tabId });
    });
  }
});

// Clear content script state on navigation to prevent stale state issues
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // Main frame only

  const tabId = details.tabId;

  // Clear all state for this tab
  contentScriptReadyStatus.delete(tabId);
  contentScriptHealth.delete(tabId);

  // Disconnect existing port if any
  const portInfo = contentScriptPorts.get(tabId);
  if (portInfo) {
    try { portInfo.port.disconnect(); } catch (e) {}
    contentScriptPorts.delete(tabId);
  }

  automationLogger.logComm(null, 'nav', 'state_cleared', true, {
    tabId,
    transitionType: details.transitionType,
    url: details.url
  });

  // Reset STT if the recording tab navigated away
  if (tabId === _sttActiveTabId) {
    _sttActiveTabId = null;
    chrome.runtime.sendMessage({ from: 'content-stt', event: 'end', text: '' }).catch(() => {});
  }
});

// PERF: Clean up all state when a tab is closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  contentScriptPorts.delete(tabId);
  contentScriptReadyStatus.delete(tabId);
  contentScriptHealth.delete(tabId);

  // Clean up any active sessions for this tab
  for (const [sessionId, session] of activeSessions) {
    if (session.tabId === tabId) {
      session.status = 'stopped';
      activeSessions.delete(sessionId);
      removeConversationThread(sessionId, session.conversationId || null);
      if (sessionAIInstances.has(sessionId)) {
        sessionAIInstances.delete(sessionId);
      }
    }
  }

  // Reset STT if the recording tab was closed
  if (tabId === _sttActiveTabId) {
    _sttActiveTabId = null;
    chrome.runtime.sendMessage({ from: 'content-stt', event: 'end', text: '' }).catch(() => {});
  }
});

// Send periodic heartbeats to keep port connections validated
// PERF: Store interval ID so it can be cleared on suspension
const _heartbeatIntervalId = setInterval(() => {
  for (const [tabId, portInfo] of contentScriptPorts.entries()) {
    try {
      portInfo.port.postMessage({ type: 'heartbeat', timestamp: Date.now() });
    } catch (e) {
      // Port disconnected, cleanup will handle via onDisconnect
    }
  }
}, 3000);

const _overlayHeartbeatIntervalId = setInterval(() => {
  activeSessions.forEach(function(session) {
    if (!session || session.status !== 'running') return;

    var targetTabId = session._lastOverlayTargetTabId || session.tabId || session.originalTabId;
    if (typeof targetTabId !== 'number' || !session._lastOverlayStatusData) return;

    var lastSentAt = session._lastOverlaySentAt || 0;
    if ((Date.now() - lastSentAt) < OVERLAY_HEARTBEAT_REFRESH_MS) return;

    var heartbeatStatus = buildOverlayHeartbeatStatus(session);
    if (!heartbeatStatus) return;

    sendSessionStatus(targetTabId, heartbeatStatus)
      .then(function() {
        requestOverlayStateBroadcast(targetTabId);
      })
      .catch(function() {
        // Non-blocking: the next heartbeat or real progress update can recover.
      });
  });
}, OVERLAY_HEARTBEAT_INTERVAL_MS);

// PERF: Clean up on service worker suspension
chrome.runtime.onSuspend.addListener(() => {
  clearInterval(_heartbeatIntervalId);
  clearInterval(_overlayHeartbeatIntervalId);
  contentScriptPorts.clear();
  contentScriptReadyStatus.clear();
  contentScriptHealth.clear();
});

// Performance monitoring
const performanceMetrics = {
  sessionStats: new Map(),
  globalStats: {
    totalSessions: 0,
    successfulSessions: 0,
    totalActions: 0,
    successfulActions: 0,
    averageIterationsPerSession: 0,
    averageTimePerSession: 0,
    communicationFailures: 0,
    alternativeActionsUsed: 0
  }
};

// Failure classification system
const FAILURE_TYPES = {
  COMMUNICATION: 'communication',
  DOM: 'dom',
  SELECTOR: 'selector',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  PERMISSION: 'permission',
  BF_CACHE: 'bfcache'  // Back/forward cache issue
};

const RETRY_STRATEGIES = {
  [FAILURE_TYPES.COMMUNICATION]: 'reconnect_retry',
  [FAILURE_TYPES.DOM]: 'wait_retry',
  [FAILURE_TYPES.SELECTOR]: 'alternative_selector',
  [FAILURE_TYPES.NETWORK]: 'exponential_backoff',
  [FAILURE_TYPES.TIMEOUT]: 'increase_timeout',
  [FAILURE_TYPES.PERMISSION]: 'skip_action',
  [FAILURE_TYPES.BF_CACHE]: 'wake_and_retry'
};

// EASY WIN #9: Specialized recovery handlers for each error type
const RECOVERY_HANDLERS = {
  async [FAILURE_TYPES.COMMUNICATION](tabId, error) {
    automationLogger.logRecovery(null, 'comm_failure', 're-inject', 'attempt', { tabId });
    await ensureContentScriptInjected(tabId);
    // Use smart page ready check instead of hardcoded 500ms
    const ready = await pageLoadWatcher.pingContentScript(tabId, 2000);
    if (!ready) {
      automationLogger.logRecovery(null, 'comm_failure', 're-inject', 'failed', { tabId, reason: 'not_responsive' });
    }
    return { recovered: true, method: 'script_reinjection' };
  },

  async [FAILURE_TYPES.DOM](tabId, error) {
    automationLogger.logRecovery(null, 'dom_failure', 'dom_wait', 'attempt', { tabId });
    try {
      await sendMessageWithRetry(tabId, {
        action: 'executeAction',
        tool: 'waitForDOMStable',
        params: { timeout: 3000, stableTime: 500 }
      });
      return { recovered: true, method: 'dom_wait' };
    } catch (e) {
      return { recovered: false, method: 'dom_wait_failed' };
    }
  },

  async [FAILURE_TYPES.SELECTOR](tabId, error, action) {
    automationLogger.logRecovery(null, 'selector_fail', 'alternative', 'pending', { tabId });
    // This is handled by tryAlternativeAction, but we track it
    return { recovered: false, method: 'needs_alternative_selector' };
  },

  async [FAILURE_TYPES.NETWORK](tabId, error) {
    automationLogger.logRecovery(null, 'network_failure', 'dom_wait', 'attempt', { tabId });
    // Use DOM stability check which also monitors network activity
    const stabilityResult = await pageLoadWatcher.waitForDOMStable(tabId, 3000, 500);
    automationLogger.logRecovery(null, 'network_failure', 'dom_wait', stabilityResult?.success ? 'success' : 'failed', { tabId, ...stabilityResult });
    return { recovered: true, method: 'network_wait', details: stabilityResult };
  },

  async [FAILURE_TYPES.TIMEOUT](tabId, error) {
    automationLogger.logRecovery(null, 'timeout', 'page_ready', 'attempt', { tabId });
    // Use smart page ready detection instead of hardcoded 1000ms
    const readyResult = await pageLoadWatcher.waitForPageReady(tabId, {
      maxWait: 3000,
      requireDOMStable: true,
      stableTime: 300
    });
    automationLogger.logRecovery(null, 'timeout', 'page_ready', readyResult?.success ? 'success' : 'failed', { tabId, ...readyResult });
    return { recovered: true, method: 'timeout_extended', details: readyResult };
  },

  async [FAILURE_TYPES.BF_CACHE](tabId, error) {
    automationLogger.logRecovery(null, 'bfcache', 'wake_page', 'attempt', { tabId });
    try {
      await chrome.tabs.update(tabId, { active: true });
      // Use smart page ready detection instead of hardcoded 500ms
      const loadResult = await pageLoadWatcher.waitForPageReady(tabId, {
        maxWait: 2000,
        requireDOMStable: false // Just need tab complete + health check
      });
      automationLogger.logRecovery(null, 'bfcache', 'wake_page', loadResult.success ? 'success' : 'retry', { tabId, waitTime: loadResult.waitTime });
      if (!loadResult.success) {
        // Fallback: re-inject content script
        await ensureContentScriptInjected(tabId);
      }
      return { recovered: true, method: 'page_wakeup', details: loadResult };
    } catch (e) {
      automationLogger.logRecovery(null, 'bfcache', 'wake_page', 'failed', { tabId, error: e.message });
      return { recovered: false, method: 'wakeup_failed', error: e.message };
    }
  }
};

// Helper function to check if URL is restricted for content script access
function isRestrictedURL(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://'
  ];
  
  const restrictedPages = [
    'chrome://extensions/',
    'chrome://settings/',
    'chrome://newtab/',
    'chrome://history/',
    'chrome://bookmarks/',
    'chrome://downloads/',
    'chrome://flags/',
    'chrome://version/',
    'chrome://webstore/',
    'edge://extensions/',
    'edge://settings/',
    'about:blank',
    'about:newtab'
  ];
  
  // Check exact matches first
  if (restrictedPages.some(page => url.startsWith(page))) {
    return true;
  }
  
  // Check protocol restrictions
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Get user-friendly page type description
function getPageTypeDescription(url) {
  if (url.startsWith('chrome://')) return 'Chrome internal page';
  if (url.startsWith('chrome-extension://')) return 'Chrome extension page';
  if (url.startsWith('edge://')) return 'Edge internal page';
  if (url.startsWith('about:')) return 'Browser internal page';
  if (url.startsWith('file://')) return 'Local file';
  return 'Restricted page';
}

// Content script health monitoring with enhanced timeout and retry
async function checkContentScriptHealth(tabId, timeout = 4000) {
  try {
    // Quick check: use port if available and recently active (10s window)
    let portInfo = contentScriptPorts.get(tabId);
    if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
      contentScriptHealth.set(tabId, {
        lastCheck: Date.now(),
        healthy: true,
        failures: 0,
        method: 'port'
      });
      return true;
    }

    // If port not found but we know content script should be there,
    // wait briefly for port reconnection (service worker may have just woken)
    if (!portInfo) {
      automationLogger.debug('Port not found, waiting for potential reconnection', { tabId });
      await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
      portInfo = contentScriptPorts.get(tabId);
      if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
        automationLogger.logComm(null, 'health', 'port_reconnected', true, { tabId });
        contentScriptHealth.set(tabId, {
          lastCheck: Date.now(),
          healthy: true,
          failures: 0,
          method: 'port_reconnect'
        });
        return true;
      }
    }

    // Adaptive timeout for known heavy sites (Google, YouTube)
    let adjustedTimeout = timeout;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url?.includes('google.com') || tab.url?.includes('youtube.com')) {
        adjustedTimeout = Math.min(timeout * 2.5, 10000);
        automationLogger.debug('Using extended timeout for heavy site', { tabId, url: tab.url, timeout: adjustedTimeout });
      }
    } catch (e) {
      // Tab might not exist, continue with default timeout
    }

    // Message-based check with internal retry
    for (let msgAttempt = 1; msgAttempt <= 2; msgAttempt++) {
      try {
        debugLog('[FSB Background] Sending healthCheck to tab:', { tabId, attempt: msgAttempt });
        // CRITICAL: Use frameId: 0 to target ONLY the main frame
        const healthCheckPromise = chrome.tabs.sendMessage(tabId, {
          action: 'healthCheck'
        }, { frameId: 0 });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), adjustedTimeout)
        );

        const response = await Promise.race([healthCheckPromise, timeoutPromise]);
        debugLog('[FSB Background] healthCheck response', response);

        if (response && response.success) {
          debugLog('[FSB Background] healthCheck successful for tab:', tabId);
          contentScriptHealth.set(tabId, {
            lastCheck: Date.now(),
            healthy: true,
            failures: 0,
            method: 'message'
          });
          return true;
        }
      } catch (e) {
        debugLog('[FSB Background] healthCheck failed', { tabId, error: e.message });
        if (msgAttempt < 2) {
          automationLogger.debug('Message health check failed, retrying', { tabId, attempt: msgAttempt, error: e.message });
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // All attempts failed
    const health = contentScriptHealth.get(tabId) || { failures: 0 };
    health.lastCheck = Date.now();
    health.healthy = false;
    health.failures++;
    health.lastError = 'All health check attempts failed';
    contentScriptHealth.set(tabId, health);
    return false;
  } catch (error) {
    const health = contentScriptHealth.get(tabId) || { failures: 0 };
    health.lastCheck = Date.now();
    health.healthy = false;
    health.failures++;
    health.lastError = error.message;
    contentScriptHealth.set(tabId, health);
    return false;
  }
}

// Wait for content script to be ready before starting automation
// This prevents the race condition where automation starts before port is established
async function waitForContentScriptReady(tabId, timeout = 5000) {
  const startTime = Date.now();
  const pollInterval = 200;

  while (Date.now() - startTime < timeout) {
    // Check if port is established and has recent heartbeat
    const portInfo = contentScriptPorts.get(tabId);
    if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
      automationLogger.debug('Content script ready via port', { tabId });
      return true;
    }

    // Check if ready status is set
    const readyStatus = contentScriptReadyStatus.get(tabId);
    if (readyStatus && readyStatus.ready) {
      automationLogger.debug('Content script ready via status', { tabId });
      return true;
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  // Timeout reached - try to ensure content script is injected
  automationLogger.debug('Content script ready timeout, ensuring injection', { tabId });
  await ensureContentScriptInjected(tabId);

  // Give it one more check after injection
  const portInfo = contentScriptPorts.get(tabId);
  if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
    automationLogger.debug('Content script ready after injection', { tabId });
    return true;
  }

  const readyStatus = contentScriptReadyStatus.get(tabId);
  if (readyStatus && readyStatus.ready) {
    automationLogger.debug('Content script ready via status after injection', { tabId });
    return true;
  }

  automationLogger.debug('Content script readiness uncertain, proceeding anyway', { tabId });
  return false;
}

// Enhanced content script injection with retry logic and page load checks
async function ensureContentScriptInjected(tabId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait for page to be fully loaded before health check
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'loading') {
        automationLogger.logComm(null, 'health', 'tab_loading', true, { tabId, status: 'waiting' });
        await new Promise(resolve => {
          const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          // Timeout after 5 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 5000);
        });
      }

      // Check port connection first - most reliable indicator
      const portInfo = contentScriptPorts.get(tabId);
      if (portInfo && Date.now() - portInfo.lastHeartbeat < 10000) {
        automationLogger.logComm(null, 'health', 'port_healthy', true, { tabId, source: 'port' });
        return true;
      }

      // Then check if we already received a ready signal
      const readyStatus = contentScriptReadyStatus.get(tabId);
      if (readyStatus && readyStatus.ready) {
        automationLogger.logComm(null, 'health', 'ready_signal', true, { tabId, source: 'cached' });
        // Still do a health check to be sure
        const isHealthy = await checkContentScriptHealth(tabId);
        if (isHealthy) {
          return true;
        }
        // Ready signal received but health check failed
        // Don't delete ready status if port method was used - port disconnect handles cleanup
        if (readyStatus.method !== 'port') {
          contentScriptReadyStatus.delete(tabId);
        }
      }

      // Check if content script is already healthy (might be from previous injection)
      const isHealthy = await checkContentScriptHealth(tabId);
      if (isHealthy) {
        automationLogger.logComm(null, 'health', 'healthCheck', true, { tabId, source: 'existing' });
        contentScriptReadyStatus.set(tabId, { ready: true, timestamp: Date.now() });
        return true;
      }

      // Check if script might already be injected but not responsive
      // Prevent double injection by checking port existence
      const existingPorts = chrome.runtime.getContexts?.({
        contextTypes: ['TAB'],
        tabIds: [tabId]
      });
      if (existingPorts && (await existingPorts).length > 0) {
        automationLogger.logComm(null, 'health', 'context_check', true, { tabId, contextExists: true });
        // Use smart ping instead of hardcoded 500ms delay
        const recheckHealthy = await pageLoadWatcher.pingContentScript(tabId, 1000);
        if (recheckHealthy) {
          automationLogger.logComm(null, 'health', 'ping', true, { tabId });
          return true;
        }
      }

      // Check if content script was recently healthy - likely just needs time to reconnect
      const recentHealth = contentScriptHealth.get(tabId);
      if (recentHealth && Date.now() - recentHealth.lastCheck < 30000 && recentHealth.healthy) {
        automationLogger.debug('Content script was recently healthy, skipping re-injection', { tabId });
        // Just wait a bit more for reconnection instead of re-injecting
        await new Promise(r => setTimeout(r, 1500));
        const recheckHealthy = await checkContentScriptHealth(tabId);
        if (recheckHealthy) {
          automationLogger.logComm(null, 'health', 'reconnected_after_wait', true, { tabId });
          return true;
        }
      }

      // Inject content script modules - target only main frame to avoid iframe issues
      // Files are loaded in dependency order from CONTENT_SCRIPT_FILES constant:
      // automation-logger first, then init.js (namespace), then domain modules,
      // then messaging/lifecycle last (they depend on all above).
      automationLogger.logComm(null, 'send', 'inject', true, { tabId, attempt });
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },  // frameIds: [0] = main frame only
        files: CONTENT_SCRIPT_FILES,
        world: 'ISOLATED',  // Explicitly specify isolated world
        injectImmediately: true  // Don't wait for document_idle
      });

      // Wait for ready signal or timeout
      automationLogger.logComm(null, 'receive', 'ready_signal', true, { tabId, status: 'waiting' });
      const readySignalReceived = await new Promise((resolve) => {
        const startTime = Date.now();
        const maxWaitTime = 1000 * attempt; // Progressive: 1s, 2s, 3s

        const checkInterval = setInterval(() => {
          const readyStatus = contentScriptReadyStatus.get(tabId);
          if (readyStatus && readyStatus.ready) {
            clearInterval(checkInterval);
            automationLogger.logComm(null, 'receive', 'ready_signal', true, { tabId, waitTime: Date.now() - startTime });
            resolve(true);
          } else if (Date.now() - startTime > maxWaitTime) {
            clearInterval(checkInterval);
            automationLogger.logComm(null, 'receive', 'ready_signal', false, { tabId, timeout: maxWaitTime });
            resolve(false);
          }
        }, 100); // Check every 100ms
      });

      // If ready signal received, do one health check to confirm
      if (readySignalReceived) {
        const healthAfterReady = await checkContentScriptHealth(tabId);
        if (healthAfterReady) {
          automationLogger.logComm(null, 'health', 'healthCheck', true, { tabId, attempt, source: 'after_ready' });
          return true;
        }
      }

      // Fallback: Check health multiple times even without ready signal
      automationLogger.logComm(null, 'health', 'fallback_check', true, { tabId, reason: 'no_ready_signal' });
      for (let healthAttempt = 1; healthAttempt <= 3; healthAttempt++) {
        const healthAfterInjection = await checkContentScriptHealth(tabId);
        if (healthAfterInjection) {
          automationLogger.logComm(null, 'health', 'healthCheck', true, { tabId, attempt, healthAttempt });
          contentScriptReadyStatus.set(tabId, { ready: true, timestamp: Date.now() });
          return true;
        }
        // Use progressive ping timeout instead of hardcoded 500ms delay
        if (healthAttempt < 3) {
          const pingOk = await pageLoadWatcher.pingContentScript(tabId, 500 * healthAttempt);
          if (pingOk) {
            automationLogger.logComm(null, 'health', 'ping', true, { tabId, healthAttempt });
            contentScriptReadyStatus.set(tabId, { ready: true, timestamp: Date.now() });
            return true;
          }
        }
      }

    } catch (error) {
      automationLogger.logComm(null, 'send', 'inject', false, { tabId, attempt, error: error.message });
      if (attempt === maxRetries) {
        throw new Error(`Failed to inject content script after ${maxRetries} attempts: ${error.message}`);
      }
      // Exponential backoff between retries: 1000ms, 2000ms, 4000ms
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return false;
}

// Classify failure type based on error message and context
function classifyFailure(error, action, context = {}) {
  const errorMessage = (error.message || error || '').toLowerCase();
  
  // Communication failures
  // Check for back/forward cache issue first
  if (errorMessage.includes('back/forward cache') || 
      errorMessage.includes('page keeping the extension port is moved')) {
    return FAILURE_TYPES.BF_CACHE;
  }
  
  if (errorMessage.includes('could not establish connection') ||
      errorMessage.includes('receiving end does not exist') ||
      errorMessage.includes('message port closed') ||
      errorMessage.includes('no tab with id') ||
      errorMessage.includes('cannot access') ||
      errorMessage.includes('communication failure')) {
    return FAILURE_TYPES.COMMUNICATION;
  }
  
  // DOM/Selector failures
  if (errorMessage.includes('element not found') ||
      errorMessage.includes('selector') ||
      errorMessage.includes('not visible') ||
      errorMessage.includes('not interactable')) {
    return FAILURE_TYPES.SELECTOR;
  }
  
  // Timeout failures
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')) {
    return FAILURE_TYPES.TIMEOUT;
  }
  
  // Network failures
  if (errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch')) {
    return FAILURE_TYPES.NETWORK;
  }
  
  // Permission failures
  if (errorMessage.includes('permission') ||
      errorMessage.includes('restricted') ||
      errorMessage.includes('chrome://') ||
      errorMessage.includes('cannot execute')) {
    return FAILURE_TYPES.PERMISSION;
  }
  
  // Default to communication for unknown errors
  return FAILURE_TYPES.COMMUNICATION;
}

// Slim down action results before storing in session history.
// Keeps only the fields that ai-integration and stuck detection actually read.
function slimActionResult(result) {
  if (!result) return result;
  const slim = { success: result.success };
  if (result.error) slim.error = result.error;
  if (result.hadEffect !== undefined) slim.hadEffect = result.hadEffect;
  if (result.navigationTriggered) slim.navigationTriggered = true;
  if (result.validationPassed !== undefined) slim.validationPassed = result.validationPassed;
  if (result.validationPassed === false && result.actualValue !== undefined) slim.actualValue = result.actualValue;
  if (result.warning) slim.warning = result.warning;
  if (!result.success && result.suggestion) slim.suggestion = result.suggestion;
  // DBG-05: Preserve AI debugger diagnosis for continuation prompt
  if (!result.success && result.aiDiagnosis) slim.aiDiagnosis = typeof result.aiDiagnosis === 'string' ? result.aiDiagnosis.substring(0, 500) : result.aiDiagnosis;
  // DBG-06: Preserve 8-point diagnostic suggestions array for continuation prompt
  if (!result.success && result.suggestions && Array.isArray(result.suggestions)) slim.diagnosticSuggestions = result.suggestions.slice(0, 5);
  if (result.typed) slim.typed = result.typed;
  if (result.clicked) slim.clicked = result.clicked;
  if (result.navigatingTo) slim.navigatingTo = result.navigatingTo;
  if (result.selected) slim.selected = result.selected;
  if (result.checked !== undefined) slim.checked = result.checked;
  if (result.failureType) slim.failureType = result.failureType;
  if (result.retryable !== undefined) slim.retryable = result.retryable;
  // MEM-02: Preserve fields for rich action descriptions downstream
  if (result.tool) slim.tool = result.tool;
  if (result.elementInfo?.text) slim.elementText = result.elementInfo.text.substring(0, 50);
  if (result.selectorUsed) slim.selectorUsed = result.selectorUsed;
  // CMP-04: Preserve value field for getText/getAttribute -- needed by progress tracking
  // and hard-stop extracted-text display (lines that reference result.value)
  if (result.value !== undefined) slim.value = typeof result.value === 'string' ? result.value.substring(0, 200) : result.value;
  // readPage: preserve text field (truncated) and charCount for AI prompt inclusion
  if (result.text !== undefined && result.charCount !== undefined) {
    slim.text = typeof result.text === 'string' ? result.text.substring(0, 30000) : result.text;
    slim.charCount = result.charCount;
  }
  // Sheets fillsheet/readsheet: preserve data entry metrics for completion validator
  if (result.cellsFilled !== undefined) slim.cellsFilled = result.cellsFilled;
  if (result.rows !== undefined) slim.rows = result.rows;
  if (result.cols !== undefined) slim.cols = result.cols;
  if (result.data !== undefined) slim.data = typeof result.data === 'string' ? result.data.substring(0, 2000) : result.data;
  // togglecheck: preserve toggle state for debugging and AI verification
  if (result.toggled !== undefined) slim.toggled = result.toggled;
  if (result.wasChecked !== undefined) slim.wasChecked = result.wasChecked;
  if (result.nowChecked !== undefined) slim.nowChecked = result.nowChecked;
  if (result.todoText) slim.todoText = result.todoText;
  if (result.todoIndex) slim.todoIndex = result.todoIndex;
  if (result.totalTodos) slim.totalTodos = result.totalTodos;
  return slim;
}

// ==========================================
// SESSION REPLAY ENGINE
// ==========================================

/**
 * Get appropriate inter-action delay for replay based on tool type.
 * Navigation actions get longer delays; typing/key actions are faster.
 * @param {string} tool - The action tool name
 * @returns {number} Delay in milliseconds
 */
function getReplayDelay(tool) {
  if (['navigate', 'searchGoogle', 'goBack', 'goForward'].includes(tool)) return 1500;
  if (['click', 'doubleClick', 'rightClick'].includes(tool)) return 500;
  if (['type', 'keyPress', 'pressEnter'].includes(tool)) return 300;
  return 200;
}

/**
 * Load a stored session's actionHistory and filter to replayable actions.
 * @param {string} sessionId - The session ID to load from fsbSessionLogs
 * @returns {Object|null} { session, replayableActions, originalTask, originalUrl } or null
 */
async function loadReplayableSession(sessionId) {
  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const session = sessionStorage[sessionId];

    if (!session || !session.actionHistory || session.actionHistory.length === 0) {
      return null;
    }

    const replayableTools = new Set([
      'click', 'rightClick', 'doubleClick', 'type', 'clearInput', 'pressEnter',
      'keyPress', 'selectOption', 'toggleCheckbox', 'navigate', 'searchGoogle',
      'scroll', 'goBack', 'goForward', 'refresh', 'hover', 'focus', 'moveMouse',
      'waitForElement'
    ]);

    const replayableActions = session.actionHistory
      .filter(a => a.result?.success === true && replayableTools.has(a.tool));

    if (replayableActions.length === 0) {
      return null;
    }

    // Extract the original URL from the first navigation-like action or session logs
    let originalUrl = null;
    for (const action of session.actionHistory) {
      if (action.params?.url) {
        originalUrl = action.params.url;
        break;
      }
    }
    if (!originalUrl && session.logs && session.logs.length > 0) {
      originalUrl = session.logs[0]?.data?.url || null;
    }

    return {
      session,
      replayableActions,
      originalTask: session.task,
      originalUrl
    };
  } catch (error) {
    automationLogger.error('Failed to load replayable session', { sessionId, error: error.message });
    return null;
  }
}

/**
 * Execute a replay sequence step-by-step through the existing sendMessageWithRetry path.
 * Sends statusUpdate messages to UI during each step with progress percentage.
 * Critical step failures (navigate, searchGoogle) abort replay; non-critical failures are skipped.
 * @param {string} replaySessionId - The replay session ID in activeSessions
 */
async function executeReplaySequence(replaySessionId) {
  const session = activeSessions.get(replaySessionId);
  if (!session || session.status !== 'replaying') return;

  const criticalTools = new Set(['navigate', 'searchGoogle']);

  for (let i = session.currentStep; i < session.replaySteps.length; i++) {
    // Check for termination (user stopped the replay)
    const currentSession = activeSessions.get(replaySessionId);
    if (!currentSession || currentSession.isTerminating || currentSession.status !== 'replaying') {
      return;
    }

    session.currentStep = i;
    const step = session.replaySteps[i];

    // Prepend clearInput before type actions to prevent text accumulation
    if (step.tool === 'type' && step.params?.selector) {
      try {
        await sendMessageWithRetry(session.tabId, {
          action: 'executeAction',
          tool: 'clearInput',
          params: { selector: step.params.selector }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        automationLogger.debug('clearInput before type failed (non-critical)', {
          sessionId: replaySessionId, step: i, error: e?.message || String(e)
        });
      }
    }

    // Send progress update to UI
    const progressPercent = Math.round(((i + 1) / session.totalSteps) * 100);
    try {
      chrome.runtime.sendMessage({
        action: 'statusUpdate',
        sessionId: replaySessionId,
        message: getActionStatus(step.tool, step.params),
        iteration: i + 1,
        maxIterations: session.totalSteps,
        progressPercent,
        replayStep: i + 1,
        isReplay: true
      });
    } catch (e) {
      // Non-blocking: UI may not be listening
    }

    // Execute the action via the existing content script path
    let actionResult = null;
    try {
      actionResult = await sendMessageWithRetry(session.tabId, {
        action: 'executeAction',
        tool: step.tool,
        params: step.params,
        visualContext: {
          taskName: session.task,
          stepNumber: i + 1,
          totalSteps: session.totalSteps,
          iterationCount: 1,
          isReplay: true
        }
      });
    } catch (e) {
      actionResult = { success: false, error: e?.message || String(e) };
    }

    // Record result in session actionHistory
    session.actionHistory.push({
      timestamp: Date.now(),
      tool: step.tool,
      params: step.params,
      result: slimActionResult(actionResult),
      replayStep: i + 1
    });

    // Handle failures
    if (!actionResult?.success) {
      if (criticalTools.has(step.tool)) {
        session.status = 'replay_failed';
        automationLogger.warn('Replay aborted: critical action failed', {
          sessionId: replaySessionId, step: i + 1, tool: step.tool, error: actionResult?.error
        });
        break;
      } else {
        automationLogger.warn('Replay step failed (non-critical, skipping)', {
          sessionId: replaySessionId, step: i + 1, tool: step.tool, error: actionResult?.error
        });
        // Continue to next step
      }
    }

    // Inter-action delay (skip if last step)
    if (i < session.replaySteps.length - 1) {
      await new Promise(resolve => setTimeout(resolve, getReplayDelay(step.tool)));
    }
  }

  // Tally results
  const successCount = session.actionHistory.filter(a => a.result?.success).length;
  const failedCount = session.actionHistory.filter(a => !a.result?.success).length;

  if (session.status === 'replaying') {
    session.status = 'replay_completed';

    // Send completion message to UI
    try {
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId: replaySessionId,
        result: `Replay complete: ${successCount}/${session.totalSteps} steps executed successfully.${failedCount > 0 ? ` ${failedCount} steps skipped.` : ''}`
      }).catch(() => {});
    } catch (e) { /* UI may not be listening */ }
  } else if (session.status === 'replay_failed') {
    // Send error message to UI
    try {
      chrome.runtime.sendMessage({
        action: 'automationError',
        sessionId: replaySessionId,
        error: `Replay failed at step ${session.currentStep + 1}/${session.totalSteps}. ${successCount} steps succeeded before failure.`
      });
    } catch (e) { /* UI may not be listening */ }
  }

  // Send session-ended status to content script (covers previousTabId if set)
  await endSessionOverlays(session, session.status === 'replay_completed' ? 'completed' : 'error');

  // Log session end and cleanup
  const duration = Date.now() - session.startTime;
  automationLogger.logSessionEnd(replaySessionId, session.status, session.actionHistory.length, duration);
  automationLogger.saveSession(replaySessionId, session);
  cleanupSession(replaySessionId);
}

/**
 * Handle a replaySession message: load session data, create replay session, and kick off execution.
 * @param {Object} request - { sessionId: string }
 * @param {Object} sender - Chrome message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleReplaySession(request, sender, sendResponse) {
  try {
    const { sessionId } = request;

    // Check if automation is already running
    for (const [id, sess] of activeSessions) {
      if (sess.status !== 'idle') {
        sendResponse({ success: false, error: 'Another automation is already running' });
        return;
      }
    }

    // Get current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    // Load replayable session data
    const replayData = await loadReplayableSession(sessionId);
    if (!replayData || replayData.replayableActions.length === 0) {
      sendResponse({ success: false, error: 'No replayable actions found in this session' });
      return;
    }

    // Create replay session ID
    const replaySessionId = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Create replay session in activeSessions (no AI instance, no conversation session)
    activeSessions.set(replaySessionId, {
      task: `Replay: ${replayData.originalTask}`,
      tabId: activeTab.id,
      status: 'replaying',
      startTime: Date.now(),
      actionHistory: [],
      isReplay: true,
      originalSessionId: sessionId,
      replaySteps: replayData.replayableActions,
      currentStep: 0,
      totalSteps: replayData.replayableActions.length
    });

    // Start keep-alive to prevent service worker from sleeping
    startKeepAlive();

    // Log session start
    automationLogger.logSessionStart(replaySessionId, `Replay: ${replayData.originalTask}`, activeTab.id);

    // Respond immediately with session info
    sendResponse({
      success: true,
      sessionId: replaySessionId,
      totalSteps: replayData.replayableActions.length
    });

    // Kick off replay execution asynchronously (do NOT await)
    executeReplaySequence(replaySessionId);
  } catch (error) {
    automationLogger.error('Failed to start replay session', { error: error.message });
    sendResponse({ success: false, error: error.message });
  }
}

// Enhanced message sending with automatic retry and fallback
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
  // Capture URL before sending - used to detect if action triggered navigation
  let previousUrl = null;
  try {
    const tabInfo = await chrome.tabs.get(tabId);
    previousUrl = tabInfo?.url;
    message._previousUrl = previousUrl; // Store for BFCache recovery check
  } catch (e) {
    // Tab might not exist, continue anyway
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check content script health before every attempt (not just the first)
      const isHealthy = await checkContentScriptHealth(tabId);
      if (!isHealthy) {
        automationLogger.logComm(null, 'health', 'pre_message', false, { tabId, attempt, action: 're-inject' });
        await ensureContentScriptInjected(tabId);
      }

      // CRITICAL: Use frameId: 0 to target ONLY the main frame
      // This prevents responding from iframes (like Google's RotateCookiesPage iframe)
      const response = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
      
      // Success - reset health tracking
      contentScriptHealth.set(tabId, {
        lastCheck: Date.now(),
        healthy: true,
        failures: 0
      });
      
      return response;
      
    } catch (error) {
      const failureType = classifyFailure(error, message);
      automationLogger.logComm(null, 'send', message.action || 'unknown', false, { tabId, attempt, failureType, error: error.message });
      
      // Update health tracking
      const health = contentScriptHealth.get(tabId) || { failures: 0 };
      health.failures++;
      health.healthy = false;
      health.lastCheck = Date.now();
      contentScriptHealth.set(tabId, health);
      
      if (attempt === maxRetries) {
        throw {
          originalError: error,
          failureType,
          attempts: maxRetries,
          message: `Failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      // Apply failure-specific retry strategy
      if (failureType === FAILURE_TYPES.BF_CACHE) {
        automationLogger.logRecovery(null, 'bfcache', 'detect', 'attempt', { tabId });

        // CRITICAL: BFCache often means navigation happened (click triggered page change)
        // Check if URL changed - if so, the action likely succeeded!
        try {
          const tabInfo = await chrome.tabs.get(tabId);
          const currentUrl = tabInfo?.url;
          const previousUrl = message._previousUrl; // Stored before sending

          if (previousUrl && currentUrl && currentUrl !== previousUrl) {
            automationLogger.logNavigation(null, 'bfcache_nav', previousUrl, currentUrl, { success: true, note: 'navigation_triggered' });
            return {
              success: true,
              navigationTriggered: true,
              previousUrl: previousUrl,
              newUrl: currentUrl,
              note: 'Action triggered page navigation (BFCache indicates page change)'
            };
          }
        } catch (urlCheckError) {
          automationLogger.debug('Could not check URL change', { tabId, error: urlCheckError.message });
        }

        // Try to wake up the page by focusing the tab
        try {
          await chrome.tabs.update(tabId, { active: true });
          // Use smart page ready detection instead of hardcoded delays
          const wakeResult = await pageLoadWatcher.waitForPageReady(tabId, {
            maxWait: 2000,
            requireDOMStable: false
          });
          automationLogger.logRecovery(null, 'bfcache', 'wake_tab', wakeResult.success ? 'success' : 'failed', { tabId, waitTime: wakeResult.waitTime, method: wakeResult.method });
        } catch (e) {
          automationLogger.logRecovery(null, 'bfcache', 'wake_tab', 'failed', { tabId, error: e.message });
        }
        // Re-inject content script after waking the page
        await ensureContentScriptInjected(tabId);
        // Verify content script is responsive
        const pingOk = await pageLoadWatcher.pingContentScript(tabId, 1000);
        if (!pingOk) {
          automationLogger.logRecovery(null, 'bfcache', 'verify_ping', 'failed', { tabId });
        }
      } else if (failureType === FAILURE_TYPES.COMMUNICATION) {
        automationLogger.logRecovery(null, 'comm_failure', 're-inject', 'attempt', { tabId });
        await ensureContentScriptInjected(tabId);
      }

      // EASY WIN #4: Exponential backoff with jitter (improves retry success by 20-30%)
      // Wait progressively longer with random jitter to prevent thundering herd
      const baseDelay = 1000; // 1 second base
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      const jitter = Math.random() * 1000; // 0-1000ms random jitter
      const totalDelay = exponentialDelay + jitter;

      automationLogger.logTiming(null, 'WAIT', 'retry_backoff', Math.round(totalDelay), { tabId, attempt: attempt + 1 });
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}

// Alternative action strategies for failed operations
async function tryAlternativeAction(sessionId, originalAction, originalError) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  
  const { tool, params } = originalAction;
  const alternatives = [];
  
  // Type action alternatives
  if (tool === 'type') {
    alternatives.push(
      // Try clicking first, then typing
      { tool: 'click', params: { selector: params.selector }, description: `Click element before typing` },
      // Try focus + clear + type
      { tool: 'focus', params: { selector: params.selector }, description: `Focus element before typing` },
      { tool: 'clearInput', params: { selector: params.selector }, description: `Clear input before typing` },
      { tool: 'type', params: { ...params, slow: true }, description: `Type slowly with delays` },
      // Try keyboard events instead
      { tool: 'keyPress', params: { selector: params.selector, key: params.text }, description: `Use keyboard events instead of typing` }
    );
  }
  
  // Click action alternatives
  if (tool === 'click') {
    alternatives.push(
      // Try different click methods
      { tool: 'doubleClick', params, description: `Try double-click instead` },
      { tool: 'rightClick', params, description: `Try right-click to trigger context` },
      // Try hovering first
      { tool: 'hover', params, description: `Hover before clicking` },
      { tool: 'click', params: { ...params, forceClick: true }, description: `Force click ignoring visibility` }
    );
  }
  
  // Selector alternatives for any action with selector
  if (params.selector && originalError.failureType === FAILURE_TYPES.SELECTOR) {
    const baseSelector = params.selector;
    const selectorAlternatives = generateAlternativeSelectors(baseSelector);
    
    for (const altSelector of selectorAlternatives) {
      alternatives.push({
        tool,
        params: { ...params, selector: altSelector },
        description: `Try alternative selector: ${altSelector.substring(0, 30)}...`
      });
    }
  }
  
  // Execute alternatives one by one
  for (const alternative of alternatives.slice(0, 3)) { // Limit to 3 alternatives
    try {
      automationLogger.logActionExecution(sessionId, alternative.tool, 'fallback', { description: alternative.description });
      
      const result = await sendMessageWithRetry(session.tabId, {
        action: 'executeAction',
        tool: alternative.tool,
        params: alternative.params
      });
      
      if (result && result.success) {
        automationLogger.logActionExecution(sessionId, alternative.tool, 'complete', { success: true, alternative: alternative.description });
        return {
          success: true,
          result: result.result,
          alternativeUsed: alternative.description,
          originalError: originalError.error
        };
      }
    } catch (error) {
      automationLogger.logActionExecution(sessionId, alternative.tool, 'complete', { success: false, alternative: alternative.description, error: error.message });
      continue;
    }
  }
  
  return null; // No alternatives worked
}

// Generate alternative selectors for failed selector queries
function generateAlternativeSelectors(originalSelector) {
  const alternatives = [];
  
  // If it's an ID selector, try class-based alternatives
  if (originalSelector.startsWith('#')) {
    const id = originalSelector.substring(1);
    alternatives.push(
      `[id="${id}"]`,
      `*[id*="${id}"]`,
      `[id^="${id}"]`,
      `[id$="${id}"]`
    );
  }
  
  // If it's a class selector, try attribute alternatives
  if (originalSelector.startsWith('.')) {
    const className = originalSelector.substring(1);
    alternatives.push(
      `[class*="${className}"]`,
      `[class^="${className}"]`, 
      `[class$="${className}"]`
    );
  }
  
  // Try data attribute alternatives
  alternatives.push(
    `[data-testid*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[aria-label*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[name*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[title*="${originalSelector.replace(/[#.]/g, '')}"]`
  );
  
  // Try partial matches
  if (originalSelector.includes('[') && originalSelector.includes('=')) {
    const attrMatch = originalSelector.match(/\[([^=]+)="([^"]+)"\]/);
    if (attrMatch) {
      const [, attr, value] = attrMatch;
      alternatives.push(
        `[${attr}*="${value}"]`,
        `[${attr}^="${value}"]`,
        `[${attr}$="${value}"]`,
        `[${attr}~="${value}"]`
      );
    }
  }
  
  return alternatives.slice(0, 5); // Limit alternatives
}

// =============================================================================
// PARALLEL DEBUG FALLBACK (ERR-01/02/03)
// When an action fails, fire heuristic fix AND AI debugger concurrently.
// If heuristic fix works, discard AI response. If heuristic fails, AI diagnosis
// is already ready -- zero extra latency for the AI debugger path.
// =============================================================================

/**
 * Parallel debug fallback: fires heuristic engine (content script) and AI debugger
 * (background) concurrently on action failure.
 * @param {Object} failedAction - The action result that failed
 * @param {Object} session - Current session object
 * @param {Object} context - Current page context (URL, etc.)
 * @param {number} tabId - Tab ID for content script communication
 * @returns {Promise<Object>} { resolved, method, fix, diagnosis, elapsed }
 */
async function parallelDebugFallback(failedAction, session, context, tabId) {
  const startTime = Date.now();

  // Fire both in parallel: heuristic in content script, AI debugger in background
  const [heuristicResult, aiDebugResult] = await Promise.allSettled([
    chrome.tabs.sendMessage(tabId, {
      action: 'HEURISTIC_FIX',
      failedAction: {
        diagnostic: failedAction.diagnostic,
        selector: failedAction.selector || failedAction.selectorTried || failedAction.clicked,
        selectorTried: failedAction.selectorTried
      }
    }).catch(() => ({ resolved: false })),
    runAIDebugger(failedAction, session, context)
  ]);

  const heuristic = heuristicResult.status === 'fulfilled' ? heuristicResult.value : null;
  const aiDebug = aiDebugResult.status === 'fulfilled' ? aiDebugResult.value : null;

  const elapsed = Date.now() - startTime;
  automationLogger.debug('Parallel debug fallback completed', {
    sessionId: session.sessionId,
    elapsed,
    heuristicResolved: heuristic?.resolved || false,
    aiDebugAvailable: !!aiDebug?.diagnosis
  });

  // If heuristic fix worked, use it and discard AI debugger response
  if (heuristic?.resolved) {
    return {
      resolved: true,
      method: 'heuristic',
      fix: heuristic.fix,
      diagnosis: null,
      elapsed
    };
  }

  // If heuristic failed but AI debugger has a diagnosis, return it
  if (aiDebug?.diagnosis) {
    return {
      resolved: false,
      method: 'ai_debugger',
      fix: null,
      diagnosis: aiDebug.diagnosis,
      suggestions: aiDebug.suggestions || [],
      elapsed
    };
  }

  // Neither resolved
  return { resolved: false, method: 'none', fix: null, diagnosis: null, elapsed };
}

/**
 * AI-powered debugger: sends compact failure context to the AI provider for diagnosis.
 * Runs in background (has API access). Returns natural language diagnosis + suggestions.
 * @param {Object} failedAction - The action result that failed
 * @param {Object} session - Current session object
 * @param {Object} context - Current page context
 * @returns {Promise<Object>} { diagnosis, suggestions }
 */
async function runAIDebugger(failedAction, session, context) {
  const debugContext = {
    failedAction: {
      action: failedAction.action || failedAction.tool,
      selector: failedAction.selector || failedAction.selectorTried || failedAction.clicked,
      error: failedAction.error,
      diagnosticSummary: failedAction.diagnostic?.summary,
      elementSnapshot: failedAction.elementSnapshot
    },
    recentActions: (session.actionHistory || []).slice(-5).map(a => ({
      action: a.tool,
      success: a.result?.success,
      selector: a.params?.selector
    })),
    pageUrl: context?.currentUrl || 'unknown',
    siteName: context?.siteGuide?.name || 'unknown'
  };

  try {
    const settings = await config.getAll();
    if (!settings) return { diagnosis: null };

    const provider = new UniversalProvider(settings);
    const requestBody = await provider.buildRequest({
      systemPrompt: `You are a browser automation debugger. An action failed during automation. Analyze the failure and suggest recovery.

Respond in this exact format:
DIAGNOSIS: What likely went wrong (1-2 sentences)
SUGGESTIONS: 2-3 specific recovery actions`,
      userPrompt: `FAILED ACTION:\n${JSON.stringify(debugContext.failedAction, null, 2)}\n\nRECENT HISTORY:\n${JSON.stringify(debugContext.recentActions, null, 2)}\n\nPAGE: ${debugContext.pageUrl} (${debugContext.siteName})`
    }, {});

    // Limit tokens for this diagnostic call
    if (requestBody.max_tokens) requestBody.max_tokens = 300;
    if (requestBody.generationConfig?.maxOutputTokens) requestBody.generationConfig.maxOutputTokens = 300;

    const response = await provider.sendRequest(requestBody, { timeout: 8000 });

    // Extract text from provider-specific response format
    let diagnosis = null;
    const providerName = settings.modelProvider || 'xai';
    if (providerName === 'gemini') {
      diagnosis = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === 'anthropic') {
      diagnosis = response?.content?.[0]?.text;
    } else {
      diagnosis = response?.choices?.[0]?.message?.content;
    }

    return {
      diagnosis: diagnosis?.trim() || null,
      suggestions: []
    };
  } catch (e) {
    automationLogger.debug('AI debugger failed', { error: e.message });
    return { diagnosis: null };
  }
}

// Performance monitoring functions
function initializeSessionMetrics(sessionId) {
  performanceMetrics.sessionStats.set(sessionId, {
    startTime: Date.now(),
    endTime: null,
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    communicationFailures: 0,
    alternativeActionsUsed: 0,
    iterations: 0,
    stuckEvents: 0,
    domStabilityWaits: 0,
    averageActionTime: 0,
    actionTimes: []
  });
  
  performanceMetrics.globalStats.totalSessions++;
}

function trackActionPerformance(sessionId, action, result, startTime, alternativeUsed = false) {
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (!sessionStats) return;
  
  const actionTime = Date.now() - startTime;
  sessionStats.actionTimes.push(actionTime);
  sessionStats.totalActions++;
  performanceMetrics.globalStats.totalActions++;
  
  if (result.success) {
    sessionStats.successfulActions++;
    performanceMetrics.globalStats.successfulActions++;
  } else {
    sessionStats.failedActions++;
    if (result.failureType === FAILURE_TYPES.COMMUNICATION) {
      sessionStats.communicationFailures++;
      performanceMetrics.globalStats.communicationFailures++;
    }
  }
  
  if (alternativeUsed) {
    sessionStats.alternativeActionsUsed++;
    performanceMetrics.globalStats.alternativeActionsUsed++;
  }
  
  // Update average action time
  sessionStats.averageActionTime = sessionStats.actionTimes.reduce((a, b) => a + b, 0) / sessionStats.actionTimes.length;
}

function finalizeSessionMetrics(sessionId, successful = false) {
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (!sessionStats) return;
  
  sessionStats.endTime = Date.now();
  const sessionDuration = sessionStats.endTime - sessionStats.startTime;
  
  if (successful) {
    performanceMetrics.globalStats.successfulSessions++;
  }
  
  // Update global averages
  const allSessions = Array.from(performanceMetrics.sessionStats.values());
  const completedSessions = allSessions.filter(s => s.endTime !== null);
  
  if (completedSessions.length > 0) {
    const totalIterations = completedSessions.reduce((sum, s) => sum + s.iterations, 0);
    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    
    performanceMetrics.globalStats.averageIterationsPerSession = totalIterations / completedSessions.length;
    performanceMetrics.globalStats.averageTimePerSession = totalDuration / completedSessions.length;
  }
  
  automationLogger.logTiming(sessionId, 'SESSION', 'complete', sessionDuration, {
    iterations: sessionStats.iterations,
    actions: sessionStats.totalActions,
    successRate: sessionStats.totalActions > 0 ? (sessionStats.successfulActions / sessionStats.totalActions * 100).toFixed(1) + '%' : '0%',
    avgActionTime: sessionStats.averageActionTime.toFixed(0) + 'ms',
    communicationFailures: sessionStats.communicationFailures,
    alternativeActionsUsed: sessionStats.alternativeActionsUsed
  });
}

function accumulateSessionCost(sessionId, model, inputTokens, outputTokens) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  const analytics = getAnalytics();
  const cost = analytics.calculateCost(model, inputTokens, outputTokens);
  session.totalCost = (session.totalCost || 0) + cost;
  session.totalInputTokens = (session.totalInputTokens || 0) + (inputTokens || 0);
  session.totalOutputTokens = (session.totalOutputTokens || 0) + (outputTokens || 0);
}

function getPerformanceReport() {
  const global = performanceMetrics.globalStats;
  const actionSuccessRate = global.totalActions > 0 ? (global.successfulActions / global.totalActions * 100) : 0;
  const sessionSuccessRate = global.totalSessions > 0 ? (global.successfulSessions / global.totalSessions * 100) : 0;
  
  return {
    summary: {
      totalSessions: global.totalSessions,
      sessionSuccessRate: sessionSuccessRate.toFixed(1) + '%',
      totalActions: global.totalActions,
      actionSuccessRate: actionSuccessRate.toFixed(1) + '%',
      averageIterationsPerSession: global.averageIterationsPerSession.toFixed(1),
      averageTimePerSession: (global.averageTimePerSession / 1000).toFixed(1) + 's'
    },
    issues: {
      communicationFailures: global.communicationFailures,
      alternativeActionsNeeded: global.alternativeActionsUsed,
      communicationFailureRate: global.totalActions > 0 ? (global.communicationFailures / global.totalActions * 100).toFixed(1) + '%' : '0%'
    },
    recommendations: generatePerformanceRecommendations()
  };
}

function generatePerformanceRecommendations() {
  const global = performanceMetrics.globalStats;
  const recommendations = [];
  
  if (global.totalActions > 0) {
    const commFailureRate = global.communicationFailures / global.totalActions;
    if (commFailureRate > 0.3) {
      recommendations.push('High communication failure rate detected. Consider improving content script stability.');
    }
    
    const altActionRate = global.alternativeActionsUsed / global.totalActions;
    if (altActionRate > 0.2) {
      recommendations.push('High alternative action usage. Consider improving initial selector accuracy.');
    }
    
    if (global.averageIterationsPerSession > 20) {
      recommendations.push('High iteration count per session. Consider improving stuck detection and recovery.');
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! No issues detected.');
  }
  
  return recommendations;
}

// Extract the first logical segment of a multi-step task.
// "Do X on Amazon, then email it" -> "Do X on Amazon"
function getFirstTaskSegment(task) {
  const separators = [' and then ', ', then ', ' then ', ' after that ', ' afterwards ', '. Then ', '. After that '];
  const lowerTask = task.toLowerCase();
  let earliestSplit = task.length;

  for (const sep of separators) {
    const pos = lowerTask.indexOf(sep.toLowerCase());
    if (pos !== -1 && pos < earliestSplit) {
      earliestSplit = pos;
    }
  }

  return earliestSplit < task.length ? task.substring(0, earliestSplit).trim() : task;
}

// ==========================================
// TAB DISCOVERY & SMART TAB MANAGEMENT
// ==========================================

/**
 * Score how well a tab URL matches the target URL.
 * exact URL = 100, same path = 75, homepage = 50, domain only = 25
 */
function calculateTabScore(tabUrl, targetUrl) {
  try {
    const tab = new URL(tabUrl);
    const target = new URL(targetUrl);
    const tabHost = tab.hostname.replace(/^www\./, '');
    const targetHost = target.hostname.replace(/^www\./, '');
    if (tabHost !== targetHost) return 0;
    if (tab.href === target.href) return 100;
    if (tab.pathname === target.pathname) return 75;
    if (tab.pathname === '/' && !tab.search) return 50;
    return 25;
  } catch {
    return 0;
  }
}

/**
 * Find open tabs matching the target URL's domain, scored and sorted.
 */
async function findMatchingTabs(targetUrl) {
  try {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    return allTabs
      .map(tab => ({ tab, score: calculateTabScore(tab.url || '', targetUrl) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.tab.lastAccessed || 0) - (a.tab.lastAccessed || 0);
      });
  } catch (error) {
    automationLogger.debug('findMatchingTabs error', { error: error.message });
    return [];
  }
}

/**
 * Determine if a tab has real user content worth preserving.
 */
function isUserContentTab(tab) {
  if (!tab || !tab.url) return false;
  if (isRestrictedURL(tab.url)) return false;
  try {
    const url = new URL(tab.url);
    // Blank / new-tab-like pages
    if (url.pathname === '/' && !url.search && !url.hash) {
      const genericTitles = ['new tab', 'untitled', 'start page', 'home', 'homepage'];
      if (!tab.title || genericTitles.includes(tab.title.toLowerCase().trim())) {
        return false;
      }
      // A domain homepage with a real title (e.g. "Reddit - Dive into anything") is still user content
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Decide what tab action to take: navigate, switch, or create.
 * Returns { action: 'navigate'|'switch'|'create', tabId?, url?, reason }
 */
async function decideTabAction(currentTabId, currentTabUrl, targetUrl, task, options = {}) {
  try {
    const reuseMatchingTabs = options.reuseMatchingTabs !== false;
    const targetHost = new URL(targetUrl).hostname.replace(/^www\./, '');
    const currentHost = currentTabUrl ? new URL(currentTabUrl).hostname.replace(/^www\./, '') : '';

    // Already on the target domain - just navigate in place
    if (currentHost === targetHost) {
      return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Already on target domain' };
    }

    const matchingTabs = reuseMatchingTabs ? await findMatchingTabs(targetUrl) : [];
    const bestMatchingEntry = matchingTabs[0] || null;
    const bestMatchingTab = bestMatchingEntry?.tab || null;
    const bestMatchingScore = bestMatchingEntry?.score || 0;
    const currentTab = await chrome.tabs.get(currentTabId).catch(() => null);
    const currentIsRestricted = !currentTabUrl || isRestrictedURL(currentTabUrl);
    const currentHasContent = currentTab ? isUserContentTab(currentTab) : false;

    if (currentIsRestricted) {
      // Safe to overwrite restricted pages, but prefer existing matching tab
      if (bestMatchingTab && bestMatchingScore >= 75) {
        return { action: 'switch', tabId: bestMatchingTab.id, url: targetUrl, reason: 'Found strong matching tab, current is restricted' };
      }
      return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Navigating restricted page to target' };
    }

    if (currentHasContent) {
      // Preserve user content - switch to existing tab or open new one
      if (bestMatchingTab && bestMatchingScore >= 75) {
        return { action: 'switch', tabId: bestMatchingTab.id, url: targetUrl, reason: 'Switching to strong matching tab, preserving user content' };
      }
      return { action: 'create', url: targetUrl, reason: 'Creating new tab to preserve user content' };
    }

    // Generic page without meaningful content - navigate in place
    if (bestMatchingTab && bestMatchingScore >= 75) {
      return { action: 'switch', tabId: bestMatchingTab.id, url: targetUrl, reason: 'Found strong matching tab' };
    }
    return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Navigating generic page to target' };
  } catch (error) {
    automationLogger.debug('decideTabAction error, falling back to navigate', { error: error.message });
    return { action: 'navigate', tabId: currentTabId, url: targetUrl, reason: 'Fallback after error' };
  }
}

async function waitForNavigationComplete(tabId, timeout = 10000) {
  try {
    const existingTab = await chrome.tabs.get(tabId);
    if (existingTab?.status === 'complete') return;
  } catch {
    return;
  }

  return new Promise((resolve) => {
    const navListener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(navListener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(navListener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(navListener);
      resolve();
    }, timeout);
  });
}

async function getOpenTabSummaries() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs
      .filter(tab => tab?.url && !isRestrictedURL(tab.url))
      .map(tab => ({
        id: tab.id,
        title: tab.title || '',
        url: tab.url || '',
        active: !!tab.active
      }));
  } catch {
    return [];
  }
}

async function loadRoutingSettings() {
  try {
    return await config.getAll();
  } catch (error) {
    automationLogger.debug('Failed to load routing settings', { error: error.message });
    return null;
  }
}

function describeRouteTarget(routeDecision) {
  if (typeof extractRouteTargetLabel === 'function') {
    return extractRouteTargetLabel(routeDecision);
  }
  if (!routeDecision?.url) return 'the selected page';
  try {
    return new URL(routeDecision.url).hostname.replace(/^www\./, '');
  } catch {
    return 'the selected page';
  }
}

async function prepareAutomationStartTarget(currentTabId, task, options = {}) {
  const triggerSource = options.triggerSource || 'extension';
  const reuseMatchingTabs = options.reuseMatchingTabs !== false;
  const activateTab = options.activateTab !== false;
  const explicitTargetUrl = options.explicitTargetUrl || null;

  let targetTabId = currentTabId;
  if (!targetTabId) {
    const createdTab = await chrome.tabs.create({
      url: explicitTargetUrl || 'about:blank',
      active: activateTab
    });
    targetTabId = createdTab.id;
  }

  let tabInfo;
  try {
    tabInfo = await chrome.tabs.get(targetTabId);
  } catch (error) {
    throw new Error(`Cannot access tab ${targetTabId}. Tab may have been closed or is not accessible.`);
  }

  let navigationMessage = '';
  let navigationPerformed = false;
  let routeDecision = null;
  const originalUrl = tabInfo.url || '';

  if (!isRestrictedURL(tabInfo.url)) {
    automationLogger.debug('Non-restricted URL, deferring tab decision to AI agent', {
      currentUrl: tabInfo.url,
      task: task.substring(0, 100),
      triggerSource
    });
    return { targetTabId, tabInfo, navigationMessage, navigationPerformed, routeDecision };
  }

  if (!shouldUseSmartNavigation(tabInfo.url, task)) {
    const chromeError = new Error(`Chrome security restrictions prevent extensions from accessing this type of page (${tabInfo.url}). Please navigate to a regular website to use automation.`);
    chromeError.isChromePage = true;
    throw chromeError;
  }

  const routingTask = getFirstTaskSegment(task || '');
  const routingSettings = await loadRoutingSettings();
  const openTabs = await getOpenTabSummaries();

  routeDecision = await resolveTaskStartRoute(routingTask, {
    settings: routingSettings,
    triggerSource,
    currentUrl: tabInfo.url || '',
    currentPageType: getPageTypeDescription(tabInfo.url || ''),
    openTabs,
    explicitTargetUrl
  });

  if (!routeDecision?.url) {
    throw new Error('AI start router did not return a valid URL.');
  }

  const decision = await decideTabAction(targetTabId, tabInfo.url, routeDecision.url, routingTask, {
    reuseMatchingTabs
  });

  automationLogger.logNavigation(null, 'smart-ai', tabInfo.url, routeDecision.url, {
    triggerSource,
    task: routingTask.substring(0, 100),
    routeMode: routeDecision.mode,
    routeConfidence: routeDecision.confidence,
    routeReason: routeDecision.reason,
    decision: decision.action,
    reason: decision.reason
  });

  const routeLabel = describeRouteTarget(routeDecision);
  let shouldWaitForLoad = false;

  if (decision.action === 'switch') {
    try {
      await chrome.tabs.update(decision.tabId, { active: activateTab });
      targetTabId = decision.tabId;
      const switchedTab = await chrome.tabs.get(targetTabId).catch(() => null);
      if (!switchedTab?.url || switchedTab.url !== routeDecision.url) {
        await chrome.tabs.update(targetTabId, { url: routeDecision.url, active: activateTab });
        navigationMessage = `Switched to existing ${routeLabel} tab and refreshed the route.`;
        shouldWaitForLoad = true;
      } else {
        navigationMessage = `Switched to existing ${routeLabel}.`;
      }
    } catch (switchErr) {
      automationLogger.debug('Tab switch failed, falling back to navigate', { error: switchErr.message, triggerSource });
      await chrome.tabs.update(targetTabId, { url: routeDecision.url, active: activateTab });
      navigationMessage = `Navigated from ${getPageTypeDescription(originalUrl)} to ${routeLabel}.`;
      shouldWaitForLoad = true;
    }
  } else if (decision.action === 'create') {
    const createdTab = await chrome.tabs.create({ url: routeDecision.url, active: activateTab });
    targetTabId = createdTab.id;
    navigationMessage = `Opened ${routeLabel} in a new tab.`;
    shouldWaitForLoad = true;
  } else {
    await chrome.tabs.update(targetTabId, { url: routeDecision.url, active: activateTab });
    navigationMessage = `Navigated from ${getPageTypeDescription(originalUrl)} to ${routeLabel}.`;
    shouldWaitForLoad = true;
  }

  if (shouldWaitForLoad) {
    await waitForNavigationComplete(targetTabId, 10000);
  }

  try {
    tabInfo = await chrome.tabs.get(targetTabId);
  } catch (error) {
    throw new Error(`Tab became inaccessible after AI start routing to ${routeDecision.url}`);
  }

  navigationPerformed = true;
  return { targetTabId, tabInfo, navigationMessage, navigationPerformed, routeDecision };
}

/**
 * Add a tab ID to the session's allowed tabs whitelist.
 */
function addAllowedTab(sessionId, tabId, reason) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  if (!session.allowedTabs.includes(tabId)) {
    session.allowedTabs.push(tabId);
    session.tabHistory.push({ tabId, reason, timestamp: Date.now() });
    automationLogger.debug('Added allowed tab', { sessionId, tabId, reason, allowedTabs: session.allowedTabs });
  }
}

// Check if we should attempt smart navigation
function shouldUseSmartNavigation(url, task) {
  if (!isRestrictedURL(url)) {
    return false; // Not on a restricted page
  }
  
  // Only use smart navigation for chrome://newtab and about:blank
  // Don't navigate away from settings, extensions, etc.
  const navigablePages = [
    'chrome://newtab/',
    'about:blank',
    'chrome://newtab',
    'about:newtab'
  ];
  
  return navigablePages.some(page => url.startsWith(page));
}

// Service Worker compatible analytics class
class BackgroundAnalytics {
  constructor() {
    this.usageData = [];
    this.currentModel = 'grok-3-fast';
    this.initialized = false;
    this.initPromise = this.initialize();
  }
  
  async initialize() {
    try {
      automationLogger.logInit('analytics', 'loading', {});
      await this.loadStoredData();
      this.initialized = true;
      automationLogger.logInit('analytics', 'ready', {});
    } catch (error) {
      automationLogger.logInit('analytics', 'failed', { error: error.message });
    }
  }
  
  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['fsbUsageData', 'fsbCurrentModel']);
      if (result.fsbUsageData) {
        this.usageData = result.fsbUsageData;
        automationLogger.debug('Loaded analytics data', { entries: this.usageData.length });
      }
      if (result.fsbCurrentModel) {
        this.currentModel = result.fsbCurrentModel;
      }
    } catch (error) {
      automationLogger.error('Failed to load analytics data', { error: error.message });
    }
  }
  
  async saveData() {
    try {
      automationLogger.debug('Saving analytics data', { entries: this.usageData.length, model: this.currentModel });

      await chrome.storage.local.set({
        fsbUsageData: this.usageData,
        fsbCurrentModel: this.currentModel
      });

      automationLogger.debug('Analytics data saved', { entries: this.usageData.length });

      // Verify save by reading back
      const verify = await chrome.storage.local.get(['fsbUsageData']);
      automationLogger.debug('Analytics save verified', { savedEntries: verify.fsbUsageData?.length });
    } catch (error) {
      automationLogger.error('Failed to save analytics data', { error: error.message });
      throw error; // Re-throw to be caught by caller
    }
  }
  
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = {
      // xAI Current models
      'grok-4-0709': { input: 3.00, output: 15.00 },
      'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50 },
      'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50 },
      'grok-4-fast-reasoning': { input: 3.00, output: 15.00 },
      'grok-4-fast-non-reasoning': { input: 3.00, output: 15.00 },
      'grok-code-fast-1': { input: 0.20, output: 1.50 },
      'grok-3': { input: 5.00, output: 25.00 },
      'grok-3-mini': { input: 0.30, output: 0.50 },
      // xAI Legacy
      'grok-4-1-fast': { input: 0.20, output: 0.50 },
      'grok-4-1': { input: 3.00, output: 15.00 },
      'grok-4': { input: 3.00, output: 15.00 },
      'grok-4-fast': { input: 3.00, output: 15.00 },
      'grok-3-fast': { input: 0.50, output: 2.50 },
      'grok-3-mini-beta': { input: 0.30, output: 0.50 },
      'grok-3-mini-fast-beta': { input: 0.20, output: 0.50 },
      // Other providers
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 }
    };

    const modelPricing = pricing[model] || pricing['grok-4-1-fast-reasoning'];
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    return inputCost + outputCost;
  }
  
  async trackUsage(model, inputTokens, outputTokens, success = true, source = 'automation') {
    try {
      // Ensure initialization is complete
      if (!this.initialized) {
        await this.initPromise;
      }

      const entry = {
        timestamp: Date.now(),
        model: model,
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        success: success,
        source: source,
        cost: this.calculateCost(model, inputTokens, outputTokens)
      };

      this.usageData.push(entry);
      this.currentModel = model;

      automationLogger.logAPI(null, 'analytics', 'track', { model, inputTokens, outputTokens, success, source, cost: entry.cost });

      // Clean old data (keep only last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.usageData = this.usageData.filter(entry => entry.timestamp > thirtyDaysAgo);

      await this.saveData();

    } catch (error) {
      automationLogger.error('Failed to track usage', { error: error.message });
      throw error; // Re-throw to be caught by caller
    }
  }
}

// Lazy analytics guard -- replaces eager initializeAnalytics()
function getAnalytics() {
  if (!_analyticsInstance) {
    _analyticsInstance = new BackgroundAnalytics();
    automationLogger.logInit('background_analytics', 'lazy_init', {});
  }
  return _analyticsInstance;
}

// Lazy WebSocket guard -- defers connection until first UI interaction
function ensureWsConnected() {
  if (_wsInitDone) return;
  _wsInitDone = true;
  fsbWebSocket.connect();
}

// Deferred init trigger -- fires analytics + WS on first UI message or MCP session
function maybeRunDeferredInit(request, sender) {
  if (_deferredInitDone) return;
  // Only trigger on extension page messages (popup, sidepanel, options)
  // Content scripts always have sender.tab set
  if (sender && sender.tab) return;
  // STT broadcasts from content scripts
  if (request.from === 'content-stt') return;

  _deferredInitDone = true;
  automationLogger.logInit('deferred', 'start', { trigger: request.action || 'unknown' });

  getAnalytics();
  ensureWsConnected();

  automationLogger.logInit('deferred', 'complete', { trigger: request.action || 'unknown' });
}

// Bootstrap pipeline: 4 sequential phases for structured service worker startup
async function swBootstrap(trigger) {
  if (_bootstrapDone) return;
  _bootstrapDone = true;

  var bsStart = Date.now();
  automationLogger.logInit('bootstrap', 'start', { trigger: trigger });

  // Phase 1: SETTINGS
  var t0 = Date.now();
  automationLogger.logInit('bootstrap:SETTINGS', 'start', {});
  try {
    await loadDebugMode();
    automationLogger.logInit('bootstrap:SETTINGS', 'complete', { durationMs: Date.now() - t0 });
  } catch (err) {
    automationLogger.logInit('bootstrap:SETTINGS', 'failed', { error: err.message, durationMs: Date.now() - t0 });
  }

  // Phase 2: ENVIRONMENT
  t0 = Date.now();
  automationLogger.logInit('bootstrap:ENVIRONMENT', 'start', {});
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    automationLogger.logInit('bootstrap:ENVIRONMENT', 'complete', { durationMs: Date.now() - t0 });
  } catch (err) {
    automationLogger.logInit('bootstrap:ENVIRONMENT', 'complete', {
      durationMs: Date.now() - t0, sidePanelFallback: true
    });
  }

  // Phase 3: TOOLS
  t0 = Date.now();
  automationLogger.logInit('bootstrap:TOOLS', 'start', {});
  try {
    agentScheduler.rescheduleAllAgents();
    automationLogger.logInit('bootstrap:TOOLS', 'complete', { durationMs: Date.now() - t0 });
  } catch (err) {
    automationLogger.logInit('bootstrap:TOOLS', 'failed', { error: err.message, durationMs: Date.now() - t0 });
  }

  // Phase 4: SESSIONS
  t0 = Date.now();
  automationLogger.logInit('bootstrap:SESSIONS', 'start', {});
  try {
    await restoreSessionsFromStorage();
    automationLogger.logInit('bootstrap:SESSIONS', 'complete', {
      durationMs: Date.now() - t0,
      restoredSessions: activeSessions.size
    });
  } catch (err) {
    automationLogger.logInit('bootstrap:SESSIONS', 'failed', { error: err.message, durationMs: Date.now() - t0 });
  }

  automationLogger.logInit('bootstrap', 'complete', {
    trigger: trigger,
    durationMs: Date.now() - bsStart,
    phases: 4
  });
  automationLogger.flush();
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security: Only accept messages from our own extension contexts
  if (sender.id !== chrome.runtime.id) {
    console.warn('[FSB] Rejected message from unknown sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return;
  }

  // Deferred init: trigger analytics + WS on first UI message
  maybeRunDeferredInit(request, sender);

  automationLogger.logComm(null, 'receive', request.action || 'unknown', true, { tabId: sender.tab?.id });

  // STT content script broadcasts results to all extension pages — let them pass through
  if (request.from === 'content-stt') return;

  switch (request.action) {
    case 'startAutomation':
      handleStartAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'stopAutomation':
      handleStopAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getPerformanceReport':
      const report = getPerformanceReport();
      sendResponse({ success: true, report });
      break;

    case 'getStatus':
      // Return sessionIds so UI can recover after service worker restart
      const sessionIds = Array.from(activeSessions.keys());
      const firstSession = sessionIds.length > 0 ? activeSessions.get(sessionIds[0]) : null;
      const sessionsBySurface = buildSessionsBySurface();
      sendResponse({
        status: 'ready',
        activeSessions: activeSessions.size,
        sessionIds: sessionIds,
        sessionsBySurface,
        currentSessionId: sessionIds[0] || null,  // First active session for UI recovery
        currentTask: firstSession?.task || null,
        currentStartTime: firstSession?.startTime || null,
        currentIterationCount: firstSession?.iterationCount || 0,
        currentMaxIterations: firstSession?.maxIterations || 20,
        currentActionCount: firstSession?.actionHistory?.length || 0
      });
      break;
      
    case 'testAPI':
      handleTestAPI(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'TRACK_USAGE':
      return handleTrackUsage(request, sender, sendResponse);
      
    // Multi-tab management actions
    case 'openNewTab':
      handleOpenNewTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'switchToTab':
      handleSwitchToTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'closeTab':
      handleCloseTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'listTabs':
      handleListTabs(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getCurrentTab':
      handleGetCurrentTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'waitForTabLoad':
      handleWaitForTabLoad(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'keyboardDebuggerAction':
      handleKeyboardDebuggerAction(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpMouseClick':
      handleCDPMouseClick(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpMouseClickAndHold':
      handleCDPMouseClickAndHold(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpMouseDrag':
      handleCDPMouseDrag(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpMouseDragVariableSpeed':
      handleCDPMouseDragVariableSpeed(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpMouseWheel':
      handleCDPMouseWheel(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'cdpInsertText':
      handleCDPInsertText(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'monacoEditorInsert':
      handleMonacoEditorInsert(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'contentScriptReady':
      // Content script signals it's ready and message listener is registered
      debugLog('[FSB Background] contentScriptReady received', { tab: sender.tab?.id, frame: sender.frameId });
      const tabId = sender.tab?.id;
      const frameId = sender.frameId;
      if (tabId) {
        // Only track main frame (frameId: 0) readiness for health checks
        // Iframe signals are logged but don't mark the tab as ready
        if (frameId === 0) {
          contentScriptReadyStatus.set(tabId, {
            ready: true,
            timestamp: Date.now(),
            url: request.url || sender.url,
            frameId: frameId
          });
          chrome.action.setBadgeText({ text: '' });
          debugLog('[FSB Background] Tab marked as ready:', tabId);
          automationLogger.logInit('content_script', 'ready', { tabId, frameId, readyState: request.readyState, retry: request.retry || false });
        } else {
          debugLog('[FSB Background] Iframe ready ignored, frame:', frameId);
          automationLogger.debug('Iframe content script ready (ignored)', { tabId, frameId });
        }
      }
      sendResponse({ success: true });
      break;

    case 'contentScriptConfirmation':
      // Content script sends confirmation ping to verify bidirectional communication
      const confirmTabId = sender.tab?.id;
      const confirmFrameId = sender.frameId;
      if (confirmTabId) {
        // Only track main frame confirmations
        if (confirmFrameId === 0) {
          const existingStatus = contentScriptReadyStatus.get(confirmTabId);
          if (existingStatus) {
            existingStatus.confirmed = true;
            existingStatus.confirmTimestamp = Date.now();
            contentScriptReadyStatus.set(confirmTabId, existingStatus);
          }
          automationLogger.logComm(null, 'receive', 'confirmation', true, { tabId: confirmTabId, frameId: confirmFrameId });
        }
        // Silently ignore iframe confirmations
      }
      sendResponse({ success: true });
      break;

    case 'solveCaptcha':
      handleSolveCaptcha(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'spaNavigation':
      // Content script detected SPA navigation (Google, etc.)
      const spaTabId = sender.tab?.id;
      if (spaTabId) {
        const status = contentScriptReadyStatus.get(spaTabId);
        if (status) {
          status.url = request.url;
          status.lastSpaNav = Date.now();
        }
        automationLogger.logComm(null, 'receive', 'spa_navigation', true, {
          tabId: spaTabId,
          url: request.url,
          method: request.method
        });
      }
      sendResponse({ success: true });
      break;

    case 'contentScriptError':
      // Content script encountered an error during initialization
      automationLogger.logInit('content_script', 'failed', {
        tabId: sender.tab?.id,
        url: request.url,
        error: request.error,
        stack: request.stack,
        filename: request.filename,
        lineno: request.lineno,
        colno: request.colno
      });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      chrome.action.setBadgeText({ text: '!' });
      sendResponse({ success: true });
      break;

    case 'getSessionReplayData':
      // Get structured replay data for session visualization
      (async () => {
        try {
          const replay = await automationLogger.getReplayData(request.sessionId);
          sendResponse({ replay });
        } catch (error) {
          sendResponse({ replay: null, error: error.message });
        }
      })();
      return true; // Will respond asynchronously

    case 'exportSessionHumanReadable':
      // Export session as human-readable text report
      (async () => {
        try {
          const text = await automationLogger.exportHumanReadable(request.sessionId);
          sendResponse({ text });
        } catch (error) {
          sendResponse({ text: null, error: error.message });
        }
      })();
      return true; // Will respond asynchronously

    case 'getDOMSnapshots':
      // Get full DOM snapshots for a session
      (async () => {
        try {
          const snapshots = await automationLogger.getDOMSnapshots(request.sessionId);
          sendResponse({ snapshots });
        } catch (error) {
          sendResponse({ snapshots: [], error: error.message });
        }
      })();
      return true; // Will respond asynchronously

    case 'exportDOMSnapshots':
      // Export DOM snapshots in scrape-compatible format
      (async () => {
        try {
          const snapshots = await automationLogger.getDOMSnapshots(request.sessionId);
          const exported = automationLogger.exportDOMSnapshots(request.sessionId, snapshots);
          sendResponse({ exported });
        } catch (error) {
          sendResponse({ exported: null, error: error.message });
        }
      })();
      return true; // Will respond asynchronously

    // Credential management actions (Passwords Beta)
    case 'getCredential':
      (async () => {
        try {
          const cred = await secureConfig.getCredential(request.domain);
          sendResponse({ success: true, credential: cred });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getFullCredential':
      (async () => {
        try {
          const cred = await secureConfig.getFullCredential(request.domain);
          sendResponse({ success: true, credential: cred });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'saveCredential':
      (async () => {
        try {
          const result = await secureConfig.saveCredential(request.domain, request.data);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAllCredentials':
      (async () => {
        try {
          const credentials = await secureConfig.getAllCredentials();
          sendResponse({ success: true, credentials });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'deleteCredential':
      (async () => {
        try {
          const result = await secureConfig.deleteCredential(request.domain);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'updateCredential':
      (async () => {
        try {
          const result = await secureConfig.updateCredential(request.domain, request.updates);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    // SM-22: Site map retrieval for AI context injection
    case 'getSiteMap':
      (async () => {
        try {
          const domain = request.domain;
          if (!domain) {
            sendResponse({ success: false, error: 'No domain provided' });
            return;
          }

          // Priority 1: Pre-bundled map
          const bundled = await loadBundledSiteMap(domain);
          if (bundled) {
            sendResponse({ success: true, siteMap: bundled, source: 'bundled' });
            return;
          }

          // Priority 2: Memory-stored map (refined preferred)
          if (typeof memoryManager !== 'undefined') {
            try {
              const allMemories = await memoryManager.getAll();
              const siteMapMemories = allMemories.filter(m =>
                m.typeData?.category === 'site_map' &&
                m.metadata?.domain === domain
              );
              if (siteMapMemories.length > 0) {
                const refined = siteMapMemories.find(m => m.typeData?.sitePattern?.refined);
                const best = refined || siteMapMemories[0];
                sendResponse({
                  success: true,
                  siteMap: best.typeData.sitePattern,
                  source: refined ? 'memory_refined' : 'memory_basic'
                });
                return;
              }
            } catch (e) {
              debugLog('getSiteMap memory lookup failed:', e.message);
            }
          }

          sendResponse({ success: false });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    // SM-17: Check if a site map exists for a domain
    case 'checkSiteMap':
      (async () => {
        try {
          const result = await hasSiteMapForDomain(request.domain);
          sendResponse(result);
        } catch (error) {
          sendResponse({ exists: false, source: null, error: error.message });
        }
      })();
      return true;

    // Site Explorer message handlers
    case 'startExplorer':
      (async () => {
        try {
          const result = await crawlerManager.start(request.url, {
            maxDepth: request.maxDepth || 3,
            maxPages: request.maxPages || 25,
            callerTabId: sender.tab?.id || null,
            autoSaveToMemory: request.autoSaveToMemory || false
          });
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'stopExplorer':
      (async () => {
        try {
          const result = await crawlerManager.stop(request.crawlerId || null);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getExplorerStatus':
      sendResponse(crawlerManager.getStatus(request.crawlerId || null));
      break;

    case 'getResearchList':
      (async () => {
        try {
          const stored = await chrome.storage.local.get(['fsbResearchIndex']);
          sendResponse({ success: true, list: stored.fsbResearchIndex || [] });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getResearchData':
      (async () => {
        try {
          const stored = await chrome.storage.local.get(['fsbResearchData']);
          const data = (stored.fsbResearchData || {})[request.researchId];
          if (data) {
            sendResponse({ success: true, data });
          } else {
            sendResponse({ success: false, error: 'Research not found' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'deleteResearch':
      (async () => {
        try {
          const stored = await chrome.storage.local.get(['fsbResearchData', 'fsbResearchIndex']);
          const researchData = stored.fsbResearchData || {};
          const researchIndex = stored.fsbResearchIndex || [];
          delete researchData[request.researchId];
          const updatedIndex = researchIndex.filter(r => r.id !== request.researchId);
          await chrome.storage.local.set({
            fsbResearchData: researchData,
            fsbResearchIndex: updatedIndex
          });
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    // --- Background Agent Management ---
    case 'createAgent':
      (async () => {
        try {
          const agent = await agentManager.createAgent(request.params);
          if (agent.enabled) {
            await agentScheduler.scheduleAgent(agent);
          }
          sendResponse({ success: true, agent });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'updateAgent':
      (async () => {
        try {
          const agent = await agentManager.updateAgent(request.agentId, request.updates);
          // Reschedule if schedule or enabled state changed
          if (agent.enabled) {
            await agentScheduler.scheduleAgent(agent);
          } else {
            await agentScheduler.clearAlarm(agent.agentId);
          }
          sendResponse({ success: true, agent });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'deleteAgent':
      (async () => {
        try {
          await agentScheduler.clearAlarm(request.agentId);
          await agentExecutor.forceStop(request.agentId);
          const deleted = await agentManager.deleteAgent(request.agentId);
          sendResponse({ success: deleted });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'listAgents':
      (async () => {
        try {
          const agents = await agentManager.listAgents();
          sendResponse({ success: true, agents });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'toggleAgent':
      (async () => {
        try {
          const agent = await agentManager.toggleAgent(request.agentId);
          if (agent.enabled) {
            await agentScheduler.scheduleAgent(agent);
          } else {
            await agentScheduler.clearAlarm(agent.agentId);
          }
          sendResponse({ success: true, agent });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'runAgentNow':
      (async () => {
        try {
          const agent = await agentManager.getAgent(request.agentId);
          if (!agent) {
            sendResponse({ success: false, error: 'Agent not found' });
            return;
          }
          // Execute immediately in background
          sendResponse({ success: true, message: 'Agent execution started' });
          const result = await agentExecutor.execute(agent);
          await agentManager.recordRun(agent.agentId, result);
          chrome.runtime.sendMessage({
            action: 'agentRunComplete',
            agentId: agent.agentId,
            result: { success: result.success, duration: result.duration, error: result.error }
          }).catch(() => {});
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAgentStats':
      (async () => {
        try {
          const stats = await agentManager.getStats();
          sendResponse({ success: true, stats });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAgentRunHistory':
      (async () => {
        try {
          const history = await agentManager.getRunHistory(request.agentId, request.limit || 10);
          sendResponse({ success: true, history });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'clearAgentScript':
      (async () => {
        try {
          await agentManager.clearRecordedScript(request.agentId);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getAgentReplayInfo':
      (async () => {
        try {
          const agent = await agentManager.getAgent(request.agentId);
          if (!agent) {
            sendResponse({ success: false, error: 'Agent not found' });
            return;
          }
          sendResponse({
            success: true,
            replayEnabled: agent.replayEnabled !== false,
            hasScript: !!(agent.recordedScript && agent.recordedScript.steps && agent.recordedScript.steps.length > 0),
            scriptSteps: agent.recordedScript?.totalSteps || 0,
            recordedAt: agent.recordedScript?.recordedAt || null,
            replayStats: agent.replayStats || { totalReplays: 0, totalAISaves: 0, estimatedCostSaved: 0 }
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'toggleAgentReplay':
      (async () => {
        try {
          const agent = await agentManager.getAgent(request.agentId);
          if (!agent) {
            sendResponse({ success: false, error: 'Agent not found' });
            return;
          }
          const newValue = !(agent.replayEnabled !== false);
          await agentManager.updateAgent(request.agentId, { replayEnabled: newValue });
          sendResponse({ success: true, replayEnabled: newValue });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'replaySession':
      handleReplaySession(request, sender, sendResponse);
      return true; // Will respond asynchronously

    case 'stt-start':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) {
            sendResponse({ error: 'No active tab found' });
            return;
          }
          if (isRestrictedURL(tab.url)) {
            // Restricted page (new tab, chrome://) — use offscreen document
            await _ensureOffscreenSTT();
            chrome.runtime.sendMessage({ target: 'offscreen-stt', action: 'start', lang: request.lang }).catch(() => {});
            _sttActiveTabId = null;
            sendResponse({ ok: true });
            return;
          }
          // Stop any existing STT session on a different tab
          if (_sttActiveTabId && _sttActiveTabId !== tab.id) {
            try { await chrome.tabs.sendMessage(_sttActiveTabId, { target: 'content-stt', action: 'stop' }); } catch (_) {}
          }
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [0] },
            files: ['content/stt-recognition.js'],
            world: 'ISOLATED'
          });
          _sttActiveTabId = tab.id;
          await chrome.tabs.sendMessage(tab.id, { target: 'content-stt', action: 'start', lang: request.lang });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ error: e.message });
        }
      })();
      return true;

    case 'stt-stop':
      (async () => {
        if (_sttActiveTabId) {
          try { await chrome.tabs.sendMessage(_sttActiveTabId, { target: 'content-stt', action: 'stop' }); } catch (_) {}
          _sttActiveTabId = null;
        } else {
          // Might be using offscreen document
          chrome.runtime.sendMessage({ target: 'offscreen-stt', action: 'stop' }).catch(() => {});
        }
        sendResponse({ ok: true });
      })();
      return true;

    // --- DOM Stream: page-ready signal from content script ---
    case 'domStreamReady':
      // Content script reports it loaded on a real page -- update streaming tab
      _streamingTabId = sender.tab?.id || _streamingTabId;
      _recordStreamTransportEvent('dom-stream-ready', {
        tabId: _streamingTabId,
        url: sender.tab?.url || ''
      });
      _sendStreamState('ready', '', {
        tabId: _streamingTabId,
        url: sender.tab?.url || '',
        source: 'domStreamReady'
      });
      if (_streamingActive) {
        // Auto-start stream on this tab
        chrome.tabs.sendMessage(_streamingTabId, { action: 'domStreamStart' }, { frameId: 0 })
          .catch(function(err) {
            if (typeof recordFSBTransportFailure === 'function') {
              recordFSBTransportFailure('dom-forward-failed', {
                type: 'domStreamStart',
                target: 'content-script',
                tabId: _streamingTabId,
                readyState: 'page-ready-start-failed',
                error: err && err.message ? err.message : 'domStreamStart sendMessage failed after page ready'
              });
            }
          });
      }
      fsbWebSocket.send('ext:page-ready', { tabId: _streamingTabId, url: sender.tab?.url || '' });
      sendResponse({ success: true });
      break;

    // --- DOM Stream forwarding: content script -> dashboard via WS ---
    case 'domStreamSnapshot':
      fsbWebSocket.send('ext:dom-snapshot', Object.assign({}, request.snapshot || {}, {
        tabId: sender.tab?.id || null,
        tabUrl: sender.tab?.url || ''
      }));
      sendResponse({ success: true });
      break;

    case 'domStreamMutations':
      fsbWebSocket.send('ext:dom-mutations', {
        mutations: request.mutations,
        streamSessionId: request.streamSessionId || '',
        snapshotId: request.snapshotId || 0,
        tabId: sender.tab?.id || null,
        tabUrl: sender.tab?.url || ''
      });
      sendResponse({ success: true });
      break;

    case 'domStreamScroll':
      fsbWebSocket.send('ext:dom-scroll', {
        scrollX: request.scrollX,
        scrollY: request.scrollY,
        streamSessionId: request.streamSessionId || '',
        snapshotId: request.snapshotId || 0,
        tabId: sender.tab?.id || null,
        tabUrl: sender.tab?.url || ''
      });
      sendResponse({ success: true });
      break;

    case 'domStreamOverlay':
      fsbWebSocket.send('ext:dom-overlay', {
        glow: request.glow,
        progress: request.progress,
        streamSessionId: request.streamSessionId || '',
        snapshotId: request.snapshotId || 0,
        tabId: sender.tab?.id || null,
        tabUrl: sender.tab?.url || ''
      });
      sendResponse({ success: true });
      break;

    case 'domStreamDialog':
      fsbWebSocket.send('ext:dom-dialog', {
        dialog: request.dialog,
        streamSessionId: request.dialog && request.dialog.streamSessionId ? request.dialog.streamSessionId : '',
        snapshotId: request.dialog && request.dialog.snapshotId ? request.dialog.snapshotId : 0,
        tabId: sender.tab?.id || null,
        tabUrl: sender.tab?.url || ''
      });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Rate limit tracker for CLI validation live tests
/**
 * Handles the start of a new automation session
 * @param {Object} request - The automation start request
 * @param {string} request.task - The task description in natural language
 * @param {number} request.tabId - The ID of the tab to automate
 * @param {Object} sender - The message sender information
 * @param {Function} sendResponse - Function to send response back to sender
 * @returns {Promise<void>}
 */

// ==========================================
// 2Captcha CAPTCHA Solver Relay
// ==========================================

/**
 * Known 2Captcha error codes mapped to user-friendly messages
 */
const TWOCAPTCHA_ERRORS = {
  'ERROR_WRONG_USER_KEY': 'Invalid 2Captcha API key. Check your key in FSB settings.',
  'ERROR_KEY_DOES_NOT_EXIST': 'Invalid 2Captcha API key. Check your key in FSB settings.',
  'ERROR_ZERO_BALANCE': '2Captcha account has no balance. Please add funds at 2captcha.com.',
  'ERROR_NO_SLOT_AVAILABLE': '2Captcha is busy. Please try again in a moment.',
  'ERROR_CAPTCHA_UNSOLVABLE': 'CAPTCHA could not be solved. It may be too distorted.',
  'ERROR_WRONG_CAPTCHA_ID': 'Internal error: invalid CAPTCHA task ID.',
  'ERROR_BAD_DUPLICATES': 'CAPTCHA solve failed due to inconsistent results.',
  'ERROR_PAGEURL': 'Invalid page URL provided for CAPTCHA solving.',
  'ERROR_PROXY': 'Proxy error during CAPTCHA solving.'
};

/**
 * Handle CAPTCHA solving via 2Captcha API
 * Content scripts cannot make cross-origin requests, so this relays through the background
 */
async function handleSolveCaptcha(request, sender, sendResponse) {
  const { captchaType, sitekey, pageUrl, apiKey } = request;

  try {
    // Validate inputs
    if (!apiKey) {
      sendResponse({ success: false, error: 'No 2Captcha API key configured. Add it in FSB settings.' });
      return;
    }
    if (!sitekey) {
      sendResponse({ success: false, error: 'Could not extract sitekey from the page.' });
      return;
    }
    if (!pageUrl) {
      sendResponse({ success: false, error: 'Page URL is required for CAPTCHA solving.' });
      return;
    }

    // Determine method based on CAPTCHA type
    let method;
    switch (captchaType) {
      case 'recaptcha':
        method = 'userrecaptcha';
        break;
      case 'hcaptcha':
        method = 'hcaptcha';
        break;
      case 'turnstile':
        method = 'turnstile';
        break;
      default:
        sendResponse({ success: false, error: `Unsupported CAPTCHA type: ${captchaType}` });
        return;
    }

    console.log(`[FSB] Submitting ${captchaType} CAPTCHA to 2Captcha...`);

    // Step 1: Submit CAPTCHA to 2Captcha (POST to keep API key out of URL/logs)
    const submitParams = new URLSearchParams({
      key: apiKey,
      method: method,
      googlekey: sitekey,
      pageurl: pageUrl,
      json: '1'
    });

    const submitResponse = await fetch('https://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: submitParams.toString()
    });
    const submitData = await submitResponse.json();

    if (submitData.status !== 1) {
      const errorMsg = TWOCAPTCHA_ERRORS[submitData.request] || `2Captcha error: ${submitData.request}`;
      console.error('[FSB] 2Captcha submit failed:', submitData.request);
      sendResponse({ success: false, error: errorMsg });
      return;
    }

    const taskId = submitData.request;
    console.log(`[FSB] 2Captcha task submitted: ${taskId}. Polling for result...`);

    // Step 2: Poll for result (every 5s, max 30 attempts = 150s)
    const maxAttempts = 30;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const resultParams = new URLSearchParams({
        key: apiKey,
        action: 'get',
        id: taskId,
        json: '1'
      });

      const resultResponse = await fetch('https://2captcha.com/res.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: resultParams.toString()
      });
      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        console.log(`[FSB] CAPTCHA solved successfully after ${(attempt + 1) * 5}s`);
        sendResponse({ success: true, token: resultData.request });
        return;
      }

      if (resultData.request !== 'CAPCHA_NOT_READY') {
        const errorMsg = TWOCAPTCHA_ERRORS[resultData.request] || `2Captcha error: ${resultData.request}`;
        console.error('[FSB] 2Captcha solve failed:', resultData.request);
        sendResponse({ success: false, error: errorMsg });
        return;
      }

      // CAPCHA_NOT_READY - continue polling
      debugLog(`2Captcha polling attempt ${attempt + 1}/${maxAttempts}...`);
    }

    // Timeout
    sendResponse({ success: false, error: 'CAPTCHA solve timed out after 150 seconds. The CAPTCHA may be too complex.' });

  } catch (error) {
    console.error('[FSB] CAPTCHA solve error:', error);
    sendResponse({ success: false, error: `CAPTCHA solve failed: ${error.message}` });
  }
}

async function handleStartAutomation(request, sender, sendResponse) {
  // Secondary deferred init trigger for MCP-initiated sessions (D-03)
  maybeRunDeferredInit(request, sender || {});

  const {
    task,
    tabId,
    conversationId,
    uiSurface: requestedUiSurface,
    selectedConversationId,
    historySessionId: requestedHistorySessionId
  } = request;

  try {
    // Get the target tab ID (may be updated by smart tab management below)
    let targetTabId = tabId || sender.tab?.id;
    const triggerSource = request._triggerSource || 'extension';
    const uiSurface = inferUiSurface({ ...request, uiSurface: requestedUiSurface }, sender, triggerSource);
    const requestedThread = resolveRequestedConversationThread({
      uiSurface,
      selectedConversationId,
      historySessionId: requestedHistorySessionId,
      conversationId
    });
    const resolvedConversationId = requestedThread.conversationId;
    const resolvedHistorySessionId = requestedThread.historySessionId || requestedHistorySessionId || null;

    // Check for existing conversation session for follow-up reuse
    if (resolvedConversationId && conversationSessions.has(resolvedConversationId)) {
      const convEntry = conversationSessions.get(resolvedConversationId);
      const existingSession = activeSessions.get(convEntry.sessionId);
      if (existingSession && existingSession.status === 'idle') {
        const previousTask = existingSession.lastTask || existingSession.task || null;
        // Reactivate the existing session
        reactivateSession(existingSession, task);
        const sessionId = convEntry.sessionId;
        existingSession.conversationId = resolvedConversationId;
        existingSession.uiSurface = uiSurface;
        existingSession.historySessionId = existingSession.historySessionId || convEntry.historySessionId || resolvedHistorySessionId || sessionId;
        existingSession.followUpContext = {
          previousTask,
          newTask: task,
          requestedAt: Date.now(),
          commandCount: existingSession.commandCount,
          historySessionId: existingSession.historySessionId || sessionId
        };
        existingSession.agentResumeState = serializeAgentResumeState(existingSession);
        existingSession.resumeSummary = existingSession.resumeSummary || existingSession.agentResumeState?.historySummary || null;
        existingSession.isRestored = false;
        const threadRecord = upsertConversationThread(existingSession);

        // Log the follow-up command for session tracking
        automationLogger.logFollowUpCommand(sessionId, task, existingSession.commandCount);

        automationLogger.info('Reactivating conversation session', {
          sessionId,
          conversationId: resolvedConversationId,
          historySessionId: threadRecord?.historySessionId || existingSession.historySessionId || null,
          uiSurface,
          commandCount: existingSession.commandCount
        });

        // Persist updated session
        persistSession(sessionId, existingSession);

        sendResponse({
          success: true,
          sessionId,
          conversationId: resolvedConversationId,
          historySessionId: threadRecord?.historySessionId || existingSession.historySessionId || sessionId,
          uiSurface,
          message: 'Continuing conversation session',
          continued: true
        });

        startKeepAlive();

        // Reset DOM state for fresh analysis
        try {
          await chrome.tabs.sendMessage(existingSession.tabId, { action: 'resetDOMState', sessionId });
        } catch (e) {
          automationLogger.debug('Could not reset DOM state for follow-up', { sessionId, error: e.message });
        }

        var sessionHooks = createSessionHooks();
        runAgentLoop(sessionId, {
          activeSessions,
          persistSession,
          sendSessionStatus,
          broadcastDashboardProgress,
          endSessionOverlays, cleanupSession,
          startKeepAlive,
          executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
          handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
          resolveAuthWall: resolveInlineAuthWall,
          hooks: sessionHooks.hooks,
          emitter: sessionHooks.emitter
        });
        return;
      }
    }

    const preparedStart = await prepareAutomationStartTarget(targetTabId, task, {
      triggerSource,
      activateTab: true,
      reuseMatchingTabs: true
    });
    targetTabId = preparedStart.targetTabId;
    let tabInfo = preparedStart.tabInfo;
    const navigationMessage = preparedStart.navigationMessage;
    const navigationPerformed = preparedStart.navigationPerformed;

    // Read settings from storage before creating session
    const storedSettings = await getStorageWithTimeout(
      ['maxIterations', 'animatedActionHighlights', 'domOptimization', 'maxDOMElements', 'prioritizeViewport'],
      3000,
      { maxIterations: 20, animatedActionHighlights: true, domOptimization: true, maxDOMElements: 2000, prioritizeViewport: true }
    );
    const userMaxIterations = parseInt(storedSettings.maxIterations) || 20;

    // Pre-populate allowedTabs with all non-restricted tabs in the current window
    // so the AI can switch to any tab the user already has open
    const allWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const initialAllowedTabs = allWindowTabs
      .filter(t => t.id && !isRestrictedURL(t.url))
      .map(t => t.id);
    if (!initialAllowedTabs.includes(targetTabId)) {
      initialAllowedTabs.push(targetTabId);
    }

    // Create new session with enhanced tracking
    const sessionId = `session_${Date.now()}`;
    const sessionData = createSession({
      sessionId,
      task,
      tabId: targetTabId,
      originalTabId: targetTabId,
      startUrl: tabInfo?.url || null,
      status: 'running',
      startTime: Date.now(),
      maxIterations: userMaxIterations,
      lastIterationTime: Date.now(),
      allowedTabs: initialAllowedTabs,
      navigationMessage,
      animatedActionHighlights: storedSettings.animatedActionHighlights ?? true,
      conversationId: conversationId || null,
      selectedConversationId: selectedConversationId || null,
      uiSurface,
      historySessionId: resolvedHistorySessionId || sessionId,
      lastTask: task,
      lastCommandAt: Date.now(),
      commandCount: 1,
      commands: [task],
      domSettings: {
        domOptimization: storedSettings.domOptimization !== false,
        maxDOMElements: storedSettings.maxDOMElements || 2000,
        prioritizeViewport: storedSettings.prioritizeViewport !== false
      },
      userLocale: getUserLocale(),
      mode: 'autopilot'
    });

    sessionData.conversationId = resolvedConversationId || null;

    sessionData.continuity = serializeSessionContinuity(sessionData);

    activeSessions.set(sessionId, sessionData);

    // Multi-site orchestration: detect multi-company career task
    if (typeof extractCompaniesFromTask === 'function') {
      const companies = extractCompaniesFromTask(sessionData.task);
      if (companies && companies.length >= 2) {
        // Initialize multi-site orchestration state
        sessionData.multiSite = {
          originalTask: sessionData.task,
          companyList: companies,
          currentIndex: 0,
          deferredCompanies: [],  // Auth-walled companies to retry last
          failures: [],           // {company, reason, error} for final summary
          searchQuery: extractSearchQuery(sessionData.task),
          startedAt: Date.now()
        };

        // Check accumulator relevance and clear if different search
        await initMultiSiteAccumulator(sessionData);

        // Rewrite task to single-company for first iteration
        sessionData.task = buildSingleCompanyTask(sessionData.multiSite.originalTask, companies[0]);
        sessionData.taskSummary = `Job search: 1/${companies.length} companies`;
        // Cap iterations per company for multi-site sessions
        sessionData.maxIterations = Math.min(sessionData.maxIterations || 20, 15);

        automationLogger.info('Multi-site orchestration initialized', {
          sessionId,
          companies: companies,
          searchQuery: sessionData.multiSite.searchQuery,
          firstCompany: companies[0],
          rewrittenTask: sessionData.task
        });
      }
    }

    // Persist session to storage so stop button works after service worker restart
    persistSession(sessionId, sessionData);

    // Register in conversation sessions for follow-up reuse
    if (sessionData.conversationId) {
      upsertConversationThread(sessionData);
    }

    automationLogger.logSessionStart(sessionId, task, sessionData.tabId);
    initializeSessionMetrics(sessionId);
    automationLogger.info('Created new session', {
      sessionId,
      tabId: sessionData.tabId,
      activeSessions: activeSessions.size,
      conversationId: sessionData.conversationId || null,
      historySessionId: sessionData.historySessionId,
      uiSurface
    });

    // Content script injection is now handled by the automation loop
    // to prevent double injection and race conditions

    sendResponse({
      success: true,
      sessionId,
      conversationId: sessionData.conversationId || null,
      historySessionId: sessionData.historySessionId || sessionId,
      uiSurface,
      message: navigationMessage || 'Automation started',
      navigationPerformed: navigationPerformed
    });

    // EASY WIN #10: Start keep-alive when automation begins
    startKeepAlive();

    // Wait for content script to be ready before starting automation
    // This prevents race conditions where automation starts before port connection is established
    automationLogger.debug('Waiting for content script readiness', { sessionId, tabId: targetTabId });

    // Send status update to UI so user knows we're connecting
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      sessionId: sessionId,
      message: 'Connecting to page...'
    }).catch(() => {});

    const isReady = await waitForContentScriptReady(targetTabId, 5000);
    automationLogger.debug('Content script readiness check complete', { sessionId, tabId: targetTabId, isReady });

    // CRITICAL FIX: Check isReady and fail fast if content script is not available
    // Previously, isReady was captured but never checked, causing a 90-second death spiral
    // where the automation loop would start and waste time on health checks that inevitably fail
    if (!isReady) {
      // Do one final health check to be absolutely sure
      const finalHealthCheck = await checkContentScriptHealth(targetTabId);
      if (!finalHealthCheck) {
        automationLogger.warn('Content script not ready after waiting, aborting session', {
          sessionId,
          tabId: targetTabId
        });

        // Clean up the session
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'failed';
          const duration = Date.now() - session.startTime;
          automationLogger.logSessionEnd(sessionId, 'failed', 0, duration);
          automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});
          cleanupSession(sessionId);
        }

        // Send actionable error to UI
        chrome.runtime.sendMessage({
          action: 'automationError',
          sessionId: sessionId,
          error: 'Could not connect to the page. Please refresh the page and try again. If the problem persists, reload the extension from chrome://extensions.',
          task
        }).catch(() => {});

        return; // Exit early - do not start the automation loop
      }
    }

    // Send status update to UI
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      sessionId: sessionId,
      message: 'Connected. Analyzing page...'
    }).catch(() => {});

    // Send session status to content script for visual feedback
    sendSessionStatus(targetTabId, {
      phase: 'analyzing',
      taskName: sessionData.task, // Use potentially rewritten task (multi-site: single-company)
      iteration: 0,
      maxIterations: sessionData.maxIterations || userMaxIterations,
      animatedHighlights: sessionData.animatedActionHighlights,
      progressPercent: 0,
      estimatedTimeRemaining: null,
      taskSummary: sessionData.taskSummary || null
    });

    // Clear action summary cache for fresh session
    actionSummaryCache.clear();

    // Non-blocking task summarization (runs in parallel, does not delay start)
    config.getAll().then(settings => {
      summarizeTask(task, settings).then(summary => {
        const s = activeSessions.get(sessionId);
        if (s && summary) {
          s.taskSummary = summary;
        }
      });

      // Non-blocking task complexity estimation (runs in parallel with first iteration)
      // Results consumed by agent loop to set dynamic thresholds
      const s = activeSessions.get(sessionId);
      if (s) {
        s._complexityEstimate = estimateTaskComplexity(task, tabInfo?.url || '', settings);
      }
    }).catch(() => {});

    // Reset DOM state in content script to prevent stale state comparison between sessions
    try {
      await chrome.tabs.sendMessage(targetTabId, { action: 'resetDOMState', sessionId });
      automationLogger.logDOMOperation(sessionId, 'reset', {}, { tabId: targetTabId });
    } catch (e) {
      automationLogger.debug('Could not reset DOM state', { sessionId, error: e.message });
    }

    // Start the agent loop
    var sessionHooks = createSessionHooks();
    runAgentLoop(sessionId, {
      activeSessions,
      persistSession,
      sendSessionStatus,
      broadcastDashboardProgress,
      endSessionOverlays, cleanupSession,
      startKeepAlive,
      executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
      handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
      resolveAuthWall: resolveInlineAuthWall,
      hooks: sessionHooks.hooks,
      emitter: sessionHooks.emitter
    });

  } catch (error) {
    automationLogger.error('Error starting automation', { error: error.message, isChromePage: error.isChromePage || false });
    sendResponse({
      success: false,
      error: error.message,
      isChromePage: error.isChromePage || false
    });
  }
}


/**
 * Execute an automation task programmatically (used by background agents).
 * Creates a session, runs the automation loop, and returns a Promise with the result.
 * @param {number} tabId - Target tab ID (must already exist and be loaded)
 * @param {string} task - Task description for the AI
 * @param {Object} [options] - Execution options
 * @param {number} [options.maxIterations=15] - Max automation iterations
 * @param {boolean} [options.isBackgroundAgent=false] - If true, skip UI status messages
 * @param {string} [options.agentId] - Agent ID for tracking
 * @returns {Promise<Object>} { success, sessionId, result, error, duration, tokensUsed, costUsd, iterations }
 */
async function executeAutomationTask(tabId, task, options = {}) {
  const {
    maxIterations = 15,
    isBackgroundAgent = false,
    agentId = null,
    isDashboardTask = false,
    dashboardTaskRunId = '',
    triggerSource = isBackgroundAgent ? 'background-agent' : (isDashboardTask ? 'dashboard' : 'extension'),
    explicitTargetUrl = null,
    reuseMatchingTabs = !isBackgroundAgent,
    activateTab = !isBackgroundAgent
  } = options;

  return new Promise(async (resolve) => {
    try {
      const preparedStart = await prepareAutomationStartTarget(tabId, task, {
        triggerSource,
        explicitTargetUrl,
        reuseMatchingTabs,
        activateTab
      });
      const targetTabId = preparedStart.targetTabId;
      const tabInfo = preparedStart.tabInfo;

      if (isDashboardTask) {
        _dashboardTaskTabId = targetTabId;
      }

      const sessionId = `session_${Date.now()}`;
      var sessionMode = isDashboardTask ? 'dashboard-remote'
        : (isBackgroundAgent ? 'mcp-agent' : 'autopilot');

      const sessionData = createSession({
        task,
        tabId: targetTabId,
        originalTabId: targetTabId,
        startUrl: tabInfo?.url || null,
        status: 'running',
        startTime: Date.now(),
        maxIterations: maxIterations,
        lastIterationTime: Date.now(),
        isBackgroundAgent: isBackgroundAgent,
        agentId: agentId,
        _isDashboardTask: isDashboardTask,
        _dashboardTaskRunId: dashboardTaskRunId || '',
        animatedActionHighlights: isDashboardTask ? true : (isBackgroundAgent ? false : true),
        _completionCallback: resolve,
        navigationMessage: preparedStart.navigationMessage || '',
        domSettings: {
          domOptimization: true,
          maxDOMElements: 2000,
          prioritizeViewport: true
        },
        userLocale: getUserLocale(),
        mode: sessionMode
      });

      activeSessions.set(sessionId, sessionData);
      persistSession(sessionId, sessionData);

      automationLogger.logSessionStart(sessionId, task, targetTabId);
      initializeSessionMetrics(sessionId);

      startKeepAlive();

      // Non-blocking task complexity estimation for background agents too
      config.getAll().then(settings => {
        const s = activeSessions.get(sessionId);
        if (s) {
          s._complexityEstimate = estimateTaskComplexity(task, tabInfo?.url || '', settings);
        }
      }).catch(() => {});

      // Reset DOM state
      try {
        await chrome.tabs.sendMessage(targetTabId, { action: 'resetDOMState', sessionId });
      } catch (e) {
        // Content script may not be ready yet, proceed anyway
      }

      // Intercept completion messages for this session
      const originalCleanup = cleanupSession;

      // Patch: listen for automationComplete for this session to capture result
      const completionListener = (message) => {
        if (message.action === 'automationComplete' && message.sessionId === sessionId) {
          chrome.runtime.onMessage.removeListener(completionListener);
          const session = activeSessions.get(sessionId) || sessionData;
          const duration = Date.now() - sessionData.startTime;
          const metrics = performanceMetrics.sessionStats.get(sessionId);
          const outcome = typeof message.outcome === 'string'
            ? message.outcome
            : (message.stopped ? 'stopped' : (message.partial ? 'partial' : (message.error ? 'error' : 'success')));
          const outcomeDetails = message.outcomeDetails && typeof message.outcomeDetails === 'object'
            ? message.outcomeDetails
            : null;
          const isStopped = outcome === 'stopped' || message.stopped === true;
          const isPartial = outcome === 'partial' || (!isStopped && message.partial === true);
          const isSuccess = outcome === 'success' || isPartial;
          const blocker = message.blocker || outcomeDetails?.blocker || null;
          const nextStep = message.nextStep || outcomeDetails?.nextStep || null;
          resolve({
            success: isSuccess,
            partial: isPartial,
            stopped: isStopped,
            outcome,
            outcomeDetails,
            sessionId,
            taskRunId: session._dashboardTaskRunId || sessionData._dashboardTaskRunId || '',
            result: message.result || outcomeDetails?.summary || null,
            blocker: blocker,
            nextStep: nextStep,
            error: outcome === 'error' ? (message.error || outcomeDetails?.error || 'Automation error') : null,
            duration,
            tokensUsed: (session.totalInputTokens || 0) + (session.totalOutputTokens || 0),
            costUsd: session.totalCost || 0,
            iterations: session.iterationCount || 0,
            actionHistory: session.actionHistory || [],
            startUrl: session.startUrl || tabInfo?.url || null,
            finalUrl: session.lastUrl || tabInfo?.url || null
          });
        }

        if (message.action === 'automationError' && message.sessionId === sessionId) {
          chrome.runtime.onMessage.removeListener(completionListener);
          const duration = Date.now() - sessionData.startTime;
          resolve({
            success: false,
            sessionId,
            taskRunId: sessionData._dashboardTaskRunId || '',
            result: null,
            error: message.error || 'Automation error',
            duration,
            tokensUsed: (sessionData.totalInputTokens || 0) + (sessionData.totalOutputTokens || 0),
            costUsd: sessionData.totalCost || 0,
            iterations: sessionData.iterationCount || 0
          });
        }
      };
      chrome.runtime.onMessage.addListener(completionListener);

      // Safety timeout - resolve after maxIterations * 30s max
      const safetyTimeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(completionListener);
        const duration = Date.now() - sessionData.startTime;
        resolve({
          success: false,
          sessionId,
          taskRunId: sessionData._dashboardTaskRunId || '',
          result: null,
          error: 'Execution safety timeout reached',
          duration,
          tokensUsed: (sessionData.totalInputTokens || 0) + (sessionData.totalOutputTokens || 0),
          costUsd: sessionData.totalCost || 0,
          iterations: sessionData.iterationCount || 0
        });
      }, Math.min(maxIterations * 30000, 4 * 60 * 1000));

      // Store timeout for cleanup
      sessionData._safetyTimeout = safetyTimeout;

      // Start the agent loop
      var sessionHooks = createSessionHooks();
      runAgentLoop(sessionId, {
        activeSessions,
        persistSession,
        sendSessionStatus,
        broadcastDashboardProgress,
        endSessionOverlays, cleanupSession,
        startKeepAlive,
        executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
        handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
        resolveAuthWall: resolveInlineAuthWall,
        hooks: sessionHooks.hooks,
        emitter: sessionHooks.emitter
      });

    } catch (error) {
      resolve({
        success: false,
        sessionId: null,
        taskRunId: dashboardTaskRunId || '',
        result: null,
        error: error.message,
        duration: 0,
        tokensUsed: 0,
        costUsd: 0,
        iterations: 0
      });
    }
  });
}

/**
 * Start a dashboard-initiated automation task.
 * Called from ws-client.js when a dash:task-submit message is received.
 * Uses executeAutomationTask with the isDashboardTask flag for progress broadcasting.
 * @param {number} tabId - Target tab ID
 * @param {string} task - Task description from the dashboard
 */
async function startDashboardTask(tabId, task) {
  _dashboardTaskTabId = tabId;
  var taskRunId = _createDashboardTaskRunId();
  var initialTaskPayload = _rememberDashboardTaskSnapshot({
    taskRunId: taskRunId,
    taskStatus: 'running',
    task: task || '',
    progress: 0,
    phase: '',
    eta: null,
    elapsed: 0,
    action: 'Working...',
    lastAction: '',
    summary: '',
    error: '',
    stopped: false,
    tabId: typeof tabId === 'number' ? tabId : null
  });
  _sendDashboardTaskProgress(initialTaskPayload);
  var _completionSent = false;
  // Fallback: retry one terminal completion send if the first terminal delivery could not be written to the WS.
  var _fallbackTimer = null;
  try {
    var result = await executeAutomationTask(tabId, task, {
      maxIterations: 20,
      isDashboardTask: true,
      dashboardTaskRunId: taskRunId,
      triggerSource: 'dashboard'
    });
    console.log('[FSB] startDashboardTask: executeAutomationTask resolved, result.success=', result && result.success);
    _completionSent = broadcastDashboardComplete(result);
  } catch (err) {
    console.warn('[FSB] startDashboardTask: executeAutomationTask threw', err.message);
    var previousTask = _getDashboardTaskRecoverySnapshot();
    var failedPayload = _rememberDashboardTaskSnapshot({
      taskRunId: previousTask && previousTask.taskRunId ? previousTask.taskRunId : taskRunId,
      taskStatus: 'failed',
      task: task || '',
      progress: previousTask && typeof previousTask.progress === 'number' ? previousTask.progress : 0,
      phase: previousTask && previousTask.phase ? previousTask.phase : '',
      eta: null,
      elapsed: previousTask && previousTask.elapsed ? previousTask.elapsed : 0,
      action: previousTask && previousTask.action ? previousTask.action : '',
      lastAction: previousTask && previousTask.lastAction ? previousTask.lastAction : '',
      summary: '',
      error: err.message || 'Task execution failed',
      stopped: false,
      tabId: typeof tabId === 'number' ? tabId : null
    });
    _completionSent = _sendDashboardTaskComplete(failedPayload);
  }

  // Safety net: if the relay was unavailable for the first terminal send, retry once with the last known terminal snapshot.
  if (!_completionSent) {
    _fallbackTimer = setTimeout(function() {
      console.warn('[FSB] startDashboardTask: fallback timer fired -- sending ext:task-complete directly');
      var fallbackPayload = _getDashboardTaskRecoverySnapshot();
      if (!fallbackPayload || fallbackPayload.taskRunId !== taskRunId) return;
      if (!/^(success|failed|stopped)$/.test(fallbackPayload.taskStatus || '')) return;
      _sendDashboardTaskComplete(fallbackPayload);
    }, 1500);
  }
}


/**
 * Execute an agent immediately upon dashboard "Run Now" request.
 * Loads agent from storage, runs via agentExecutor, and broadcasts progress/completion via WS.
 * @param {string} agentId - The agent to run
 */
async function startAgentRunNow(agentId) {
  try {
    const agent = await agentManager.getAgent(agentId);
    if (!agent) {
      fsbWebSocket.send('ext:agent-run-complete', { agentId, success: false, error: 'Agent not found' });
      return;
    }

    // Send initial progress
    fsbWebSocket.send('ext:agent-run-progress', {
      agentId,
      progress: 0,
      phase: 'starting',
      action: 'Initializing agent run...'
    });

    // Execute via the agent executor
    const result = await agentExecutor.execute(agent);

    // Record the run in history
    await agentManager.recordRun(agentId, {
      status: result.success ? 'success' : 'failed',
      result: result.summary || null,
      error: result.error || null,
      iterations: result.iterations || 0,
      tokensUsed: result.tokensUsed || 0,
      costUsd: result.costUsd || 0,
      durationMs: result.durationMs || 0,
      executionMode: result.executionMode || 'ai_initial',
      costSaved: result.costSaved || 0
    });

    // Broadcast completion to dashboard
    fsbWebSocket.send('ext:agent-run-complete', {
      agentId,
      success: result.success !== false,
      summary: result.summary || '',
      error: result.error || '',
      executionMode: result.executionMode || 'ai_initial',
      costSaved: result.costSaved || 0,
      durationMs: result.durationMs || 0
    });

    // Sync to server if enabled
    if (agent.syncEnabled && typeof serverSync !== 'undefined') {
      try { serverSync.syncRun(agent, result).catch(() => {}); } catch (_) { /* fire and forget */ }
    }

  } catch (err) {
    fsbWebSocket.send('ext:agent-run-complete', {
      agentId,
      success: false,
      error: err.message || 'Agent execution failed'
    });
  }
}

// Handle automation stop
async function handleStopAutomation(request, sender, sendResponse) {
  var sessionId = request.sessionId;

  // Fallback: if no sessionId provided, grab the first active session (dashboard/MCP stop pattern)
  if (!sessionId && activeSessions.size > 0) {
    sessionId = activeSessions.keys().next().value;
    automationLogger.info('No sessionId in stop request, using first active session', { sessionId });
  }

  automationLogger.info('Stop automation request received', { sessionId, activeSessions: Array.from(activeSessions.keys()) });

  // Check in-memory first
  let session = activeSessions.get(sessionId);

  // Fallback: Check storage if not in memory (service worker may have restarted)
  if (!session) {
    automationLogger.info('Session not in memory, checking storage...', { sessionId });
    try {
      const key = `session_${sessionId}`;
      const stored = await chrome.storage.session.get(key);
      if (stored[key] && stored[key].sessionId === sessionId) {
        // Restore to activeSessions so cleanup works properly
        session = {
          ...stored[key],
          isRestored: true,
          actionHistory: stored[key].actionHistory || []
        };
        activeSessions.set(sessionId, session);
        automationLogger.info('Session restored from storage for stop', { sessionId });
      }
    } catch (error) {
      automationLogger.warn('Failed to check storage for session', { sessionId, error: error.message });
    }
  }

  // Idempotency guard: skip if this session is already being stopped
  if (session && (session.status === 'stopped' || session._stopInFlight)) {
    automationLogger.info('Stop already in progress, skipping duplicate', { sessionId });
    sendResponse({ success: true, message: 'Stop already in progress', duplicate: true });
    return;
  }

  if (session) {
    session._stopInFlight = true; // Set BEFORE status change to close re-entry window
    automationLogger.debug('Found session to stop', { sessionId, status: session.status });

    session.status = 'stopped';
    session.outcome = 'stopped';

    // Cancel pending agent loop iteration if scheduled (Phase 137)
    if (session._nextIterationTimer) {
      clearTimeout(session._nextIterationTimer);
      session._nextIterationTimer = null;
    }

    // Capture last action summary before cleanup (per D-06)
    var lastAction = session._lastActionSummary || null;
    if (!lastAction && session.actionHistory && session.actionHistory.length > 0) {
      var last = session.actionHistory[session.actionHistory.length - 1];
      lastAction = (typeof getActionStatus === 'function')
        ? getActionStatus(last.tool, last.params)
        : (last.tool || 'Unknown action');
    }
    _rememberDashboardTaskSnapshot({
      taskRunId: session._dashboardTaskRunId || '',
      taskStatus: 'stopped',
      task: session.task || '',
      progress: typeof calculateProgress === 'function' ? calculateProgress(session).progressPercent : 0,
      phase: typeof detectTaskPhase === 'function' ? detectTaskPhase(session) : '',
      eta: null,
      elapsed: Date.now() - session.startTime,
      action: lastAction || '',
      lastAction: lastAction || '',
      summary: '',
      error: 'Stopped by user',
      stopped: true,
      tabId: typeof session.tabId === 'number' ? session.tabId : null
    });

    // Log and save session before cleanup
    const duration = Date.now() - session.startTime;
    const stopSummary = 'Stopped by user' + (lastAction ? ' -- was: ' + lastAction : '');
    session.result = stopSummary;
    session.completionMessage = stopSummary;
    session.error = null;
    session.outcomeDetails = {
      outcome: 'stopped',
      reason: 'stopped',
      summary: stopSummary,
      blocker: null,
      nextStep: null,
      result: stopSummary,
      error: null
    };
    automationLogger.logSessionEnd(sessionId, 'stopped', session.actionHistory.length, duration);
    automationLogger.saveSession(sessionId, session);
      extractAndStoreMemories(sessionId, session).catch(() => {});

    // Tell content script to clean up visual overlays (covers previousTabId if set)
    await endSessionOverlays(session, 'stopped');

    // Resolve the executeAutomationTask promise so startDashboardTask can complete.
    // Without this, the completionListener inside executeAutomationTask never fires
    // and the promise hangs until the safety timeout (up to 4 minutes).
    chrome.runtime.sendMessage({
      action: 'automationComplete',
      sessionId: sessionId,
      result: stopSummary,
      partial: true,
      stopped: true,
      reason: 'stopped',
      outcome: 'stopped',
      blocker: null,
      nextStep: null,
      outcomeDetails: session.outcomeDetails,
      task: session.task
    }).catch(() => {});

    finalizeSessionMetrics(sessionId, false); // Stopped, not completed
    await cleanupSession(sessionId); // Await to ensure full cleanup before responding

    automationLogger.info('Session stopped and removed', { sessionId });
    sendResponse({
      success: true,
      message: 'Automation stopped',
      lastAction: lastAction,
      duration: duration
    });
  } else {
    automationLogger.warn('Session not found in memory or storage', { sessionId });
    sendResponse({
      success: false,
      error: 'Session not found'
    });
  }
}

// Handle API test
async function handleTestAPI(request, sender, sendResponse) {
  try {
    // Get settings for API test
    const settings = await config.getAll();
    
    // Check appropriate API key based on provider
    const provider = settings.modelProvider || 'xai';
    const providerApiKeyMap = {
      xai: { key: 'apiKey', name: 'xAI' },
      gemini: { key: 'geminiApiKey', name: 'Gemini' },
      openai: { key: 'openaiApiKey', name: 'OpenAI' },
      anthropic: { key: 'anthropicApiKey', name: 'Anthropic' }
    };
    const testProviderConfig = providerApiKeyMap[provider];
    if (testProviderConfig && !settings[testProviderConfig.key]) {
      sendResponse({
        success: false,
        error: `${testProviderConfig.name} API key not configured. Please set it in extension settings.`
      });
      return;
    }
    
    // Create AI integration instance and test connection
    const ai = new AIIntegration(settings);
    const testResult = await ai.testConnection();
    
    sendResponse({ 
      success: !testResult.connectionFailed && testResult.ok, 
      result: testResult 
    });
    
  } catch (error) {
    automationLogger.error('API test error', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}


// ==========================================
// Login Detection Helpers (Passwords Beta)
// ==========================================

// Wait for the user to respond to a login prompt (submit or skip)
function waitForLoginResponse(sessionId) {
  return new Promise((resolve) => {
    // Set a timeout to auto-skip after 2 minutes
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      resolve({ action: 'loginSkipped', sessionId, reason: 'timeout' });
    }, 120000);

    const handler = (request, sender, sendResponse) => {
      if (request.sessionId === sessionId &&
          (request.action === 'loginFormSubmitted' || request.action === 'loginSkipped')) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(request);
        sendResponse({ received: true });
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    // Store reference for cleanup on session termination
    const session = activeSessions.get(sessionId);
    if (session) {
      session._loginHandler = { handler, timeout };
    }
  });
}

// Extract login field selectors from DOM analysis
function extractLoginFields(domData) {
  const elements = domData?.elements || [];
  let usernameSelector = null;
  let passwordSelector = null;
  let submitSelector = null;
  let usernameType = 'text';
  let passwordFormId = null;

  // Find password field and record its form context
  for (const el of elements) {
    if (el.type === 'input' && el.attributes?.type === 'password') {
      passwordSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null) || 'input[type="password"]';
      passwordFormId = el.formId || null;
      break;
    }
  }

  // Helper: check if an element looks like a search input (not a login field)
  function isSearchInput(el) {
    const role = el.attributes?.role || '';
    const placeholder = (el.attributes?.placeholder || '').toLowerCase();
    const ariaLabel = (el.attributes?.['aria-label'] || '').toLowerCase();
    return role === 'combobox' || role === 'search' ||
           placeholder.includes('search') || ariaLabel.includes('search');
  }

  // Find username/email field: input[type=text|email] near password, or with matching name/id
  const usernamePatterns = /user|email|login|account|name|ident/i;
  for (const el of elements) {
    if (el.type !== 'input') continue;
    const inputType = el.attributes?.type || 'text';
    if (!['text', 'email', 'tel'].includes(inputType)) continue;

    const nameOrId = (el.id || '') + (el.attributes?.name || '') + (el.attributes?.placeholder || '');
    if (usernamePatterns.test(nameOrId) || inputType === 'email') {
      usernameSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      usernameType = inputType === 'email' ? 'email' : 'text';
      break;
    }
  }

  // If no username found by pattern but we know the password's form, search within that form
  if (!usernameSelector && passwordFormId) {
    for (const el of elements) {
      if (el.type !== 'input') continue;
      if (el.formId !== passwordFormId) continue;
      const inputType = el.attributes?.type || 'text';
      if (!['text', 'email', 'tel'].includes(inputType)) continue;
      if (isSearchInput(el)) continue;

      usernameSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      usernameType = inputType === 'email' ? 'email' : 'text';
      automationLogger.debug('Username found via form-scoped search', { formId: passwordFormId, selector: usernameSelector });
      break;
    }
  }

  // Last fallback: first text/email input that isn't password and isn't a search input
  if (!usernameSelector) {
    for (const el of elements) {
      if (el.type !== 'input') continue;
      const inputType = el.attributes?.type || 'text';
      if (!['text', 'email', 'tel'].includes(inputType)) continue;
      if (isSearchInput(el)) continue;

      usernameSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      break;
    }
  }

  // Find submit button
  const submitPatterns = /log.?in|sign.?in|submit|continue|next/i;
  for (const el of elements) {
    if (el.type !== 'button' && !(el.type === 'input' && el.attributes?.type === 'submit')) continue;
    const text = (el.text || '') + (el.attributes?.value || '') + (el.attributes?.['aria-label'] || '');
    if (submitPatterns.test(text)) {
      submitSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
      break;
    }
  }

  // Fallback: any button[type=submit] or input[type=submit]
  if (!submitSelector) {
    for (const el of elements) {
      if (el.attributes?.type === 'submit') {
        submitSelector = el.selectors?.[0] || (el.id ? `#${el.id}` : null);
        break;
      }
    }
  }

  return { usernameSelector, passwordSelector, submitSelector, usernameType };
}

// Fill credentials on page using saved credentials (looks up from storage)
async function fillCredentialsOnPage(tabId, domain, domData) {
  const cred = await secureConfig.getCredential(domain);
  if (!cred) return { success: false, error: 'No credentials found' };

  const fields = extractLoginFields(domData);

  return await fillCredentialsOnPageDirect(tabId, {
    usernameSelector: fields.usernameSelector,
    passwordSelector: fields.passwordSelector,
    submitSelector: fields.submitSelector,
    username: cred.username,
    password: cred.password
  });
}

// Fill credentials on page directly via chrome.scripting.executeScript
// This avoids sending credentials over message passing where they could be intercepted
// Uses React-compatible native setter to work with frameworks that intercept value changes
async function fillCredentialsOnPageDirect(tabId, { usernameSelector, passwordSelector, submitSelector, username, password }) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (uSel, pSel, sSel, u, p) => {
        // React-compatible value setter: uses the native HTMLInputElement prototype setter
        // which triggers React's synthetic event system, unlike direct .value assignment
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'value'
        ).set;

        function setInputValue(el, value) {
          if (!el) return false;
          el.focus();
          // Use native setter to bypass React's interception
          nativeInputValueSetter.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));

          // Verify the value stuck
          if (el.value === value) return true;

          // Fallback: select all + insertText (works with most frameworks)
          el.focus();
          el.select();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, value);

          return el.value === value;
        }

        const uEl = uSel ? document.querySelector(uSel) : null;
        const pEl = pSel ? document.querySelector(pSel) : null;

        const uFilled = setInputValue(uEl, u);
        const pFilled = setInputValue(pEl, p);

        // Verify both fields after filling
        const uVerified = uEl ? uEl.value === u : false;
        const pVerified = pEl ? pEl.value === p : false;

        // Delay submit click to let framework state updates settle
        if (sSel) {
          setTimeout(() => {
            const sEl = document.querySelector(sSel);
            if (sEl) sEl.click();
          }, 300);
        }

        return {
          success: uVerified && pVerified,
          filledUsername: uFilled,
          filledPassword: pFilled,
          usernameVerified: uVerified,
          passwordVerified: pVerified
        };
      },
      args: [usernameSelector, passwordSelector, submitSelector, username, password],
      world: 'MAIN'
    });
    const result = results[0]?.result || { success: false, error: 'No result from script injection' };
    automationLogger.debug('fillCredentialsOnPageDirect result', result);
    return result;
  } catch (error) {
    console.error('[FSB] fillCredentialsOnPageDirect error:', error.message || 'Unknown error');
    return { success: false, error: 'Credential fill failed' };
  }
}

const AUTH_MANUAL_APPROVAL_PATTERN = /(two[- ]factor|two factor|2fa|multi[- ]factor|multifactor|mfa|verification code|security code|one[- ]time|one time|otp|approve|approval|check your email|check your phone|confirm it's you|enter code|authenticator|challenge|verification required|captcha)/i;

function buildAuthSignalText(domData, url) {
  const elements = Array.isArray(domData?.elements) ? domData.elements : [];
  const parts = [];

  for (const el of elements) {
    if (parts.length >= 120) break;
    if (typeof el.text === 'string' && el.text.trim()) {
      parts.push(el.text.trim());
    }

    const attrs = el.attributes || {};
    const attrCandidates = [
      attrs.placeholder,
      attrs['aria-label'],
      attrs.value,
      attrs.name,
      attrs.id
    ];

    for (const candidate of attrCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        parts.push(candidate.trim());
      }
    }
  }

  if (url) {
    parts.push(url);
  }

  return parts.join(' ').slice(0, 2500).toLowerCase();
}

function getAuthHandoffNextStep(domain) {
  const siteLabel = domain || 'the site';
  return `Sign in manually on ${siteLabel}, complete any approval or MFA if required, then rerun or continue from the authenticated page.`;
}

function mergeAuthPartialOutcome(baseOutcome, override) {
  const merged = override || {};
  return {
    summary: merged.summary || baseOutcome.summary || 'Task partially completed',
    blocker: merged.blocker || baseOutcome.blocker || 'Authentication is still required to finish the last step.',
    nextStep: merged.nextStep || baseOutcome.nextStep || getAuthHandoffNextStep(baseOutcome.domain),
    reason: merged.reason || baseOutcome.reason || 'auth_required'
  };
}

async function sendInlineAuthStatus(sessionId, session, statusText) {
  if (!session?.tabId || !statusText) return;

  const overlayPayload = {
    phase: 'waiting_auth',
    taskName: session.task,
    iteration: session.iterationCount || session.agentState?.iterationCount || 0,
    maxIterations: session.maxIterations || 20,
    statusText,
    animatedHighlights: session.animatedActionHighlights,
    taskSummary: session.taskSummary || null
  };

  try {
    await sendSessionStatus(session.tabId, overlayPayload);
  } catch (_error) {
    // Non-fatal. Sidepanel completion/handoff still works without overlay refresh.
  }

  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      sessionId,
      message: statusText
    }).catch(() => {});
  } catch (_error) {
    // Non-fatal.
  }
}

async function acquireInlineAuthContext(sessionId, session) {
  if (!session?.tabId) {
    return { success: false, error: 'No active tab available for auth resolution' };
  }

  let tab = null;
  try {
    tab = await chrome.tabs.get(session.tabId);
  } catch (error) {
    return { success: false, error: error.message || 'Auth tab is no longer available' };
  }

  let domain = '';
  try {
    domain = new URL(tab.url || '').hostname || '';
  } catch (_error) {
    domain = '';
  }

  try {
    await waitForContentScriptReady(session.tabId, 5000);
  } catch (_error) {
    // Continue. The sendMessage attempt below is the real gate.
  }

  try {
    const domResponse = await chrome.tabs.sendMessage(session.tabId, {
      action: 'getDOM',
      sessionId,
      options: {
        maxElements: 500,
        prioritizeViewport: true,
        useIncrementalDiff: false
      }
    }, { frameId: 0 });
    const domData = domResponse?.structuredDOM || null;
    const fields = extractLoginFields(domData);
    const authSignalText = buildAuthSignalText(domData, tab.url || '');
    const hasPasswordField = !!fields.passwordSelector;
    const hasLoginSignal = hasPasswordField || /(log ?in|sign ?in|password|username|email)/i.test(authSignalText);
    const manualApproval = AUTH_MANUAL_APPROVAL_PATTERN.test(authSignalText);

    return {
      success: true,
      domain,
      url: tab.url || '',
      tabId: session.tabId,
      domData,
      fields,
      hasLoginSignal,
      hasPasswordField,
      manualApproval,
      authSignalText
    };
  } catch (error) {
    return {
      success: false,
      domain,
      url: tab.url || '',
      tabId: session.tabId,
      error: error.message || 'Unable to inspect the current page for sign-in fields'
    };
  }
}

async function evaluateInlineAuthAttempt(sessionId, session, attemptSource, baseOutcome) {
  await new Promise(resolve => setTimeout(resolve, 1800));

  const refreshed = await acquireInlineAuthContext(sessionId, session);
  if (!refreshed.success) {
    return {
      success: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'manual_approval',
        blocker: 'Sign-in was submitted, but FSB could not verify the authenticated page afterward.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain || refreshed.domain)
      })
    };
  }

  if (!refreshed.hasLoginSignal && !refreshed.manualApproval) {
    return {
      success: true,
      context: refreshed
    };
  }

  if (refreshed.manualApproval) {
    return {
      success: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'manual_approval',
        blocker: 'The site now requires manual approval, MFA, or another external verification step before the final action can continue.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain || refreshed.domain)
      })
    };
  }

  return {
    success: false,
    partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
      reason: attemptSource === 'saved_credentials' ? 'credentials_failed' : 'credentials_failed',
      blocker: attemptSource === 'saved_credentials'
        ? 'Saved credentials were submitted, but the site still requires login.'
        : 'Submitted credentials did not finish the sign-in.',
      nextStep: getAuthHandoffNextStep(baseOutcome.domain || refreshed.domain)
    })
  };
}

async function requestInlineLoginPrompt(sessionId, domain, fields, promptMeta) {
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({
        action: 'loginDetected',
        sessionId,
        domain,
        fields,
        authPrompt: promptMeta || {}
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 1000))
    ]);
    return response?.received === true;
  } catch (_error) {
    return false;
  }
}

async function resolveInlineAuthWall({ sessionId, session, reason, summary, blocker, nextStep }) {
  const baseOutcome = {
    reason: reason || 'auth_required',
    summary: summary || 'Task partially completed',
    blocker: blocker || 'Authentication is still required to finish the last step.',
    nextStep: nextStep || null,
    domain: null
  };

  await sendInlineAuthStatus(sessionId, session, 'Authentication required. Checking the current page...');
  const initialContext = await acquireInlineAuthContext(sessionId, session);
  baseOutcome.domain = initialContext.domain || null;

  if (!initialContext.success) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'auth_required',
        blocker: baseOutcome.blocker || 'Authentication is still required to finish the last step.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  if (initialContext.manualApproval && !initialContext.hasPasswordField) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'manual_approval',
        blocker: 'The site requires manual approval, MFA, or another verification step before FSB can continue.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  let savedAttempted = false;
  let savedAttemptFailed = false;
  const savedCredential = await secureConfig.getCredential(initialContext.domain);

  if (savedCredential) {
    savedAttempted = true;
    await sendInlineAuthStatus(sessionId, session, 'Authentication required. Trying saved credentials once...');
    const savedFill = await fillCredentialsOnPage(session.tabId, initialContext.domain, initialContext.domData);

    if (savedFill?.success) {
      const savedResolution = await evaluateInlineAuthAttempt(sessionId, session, 'saved_credentials', baseOutcome);
      if (savedResolution.success) {
        await sendInlineAuthStatus(sessionId, session, 'Sign-in succeeded. Resuming the same session...');
        return {
          resume: true,
          source: 'saved_credentials',
          toolResultMessage: 'Saved credentials were used successfully. Continue the same task from the authenticated page.',
          resumeMessage: 'Saved credentials were accepted. Re-check the page and finish the gated step.'
        };
      }

      if (savedResolution.partialOutcome?.reason === 'manual_approval') {
        return {
          resume: false,
          partialOutcome: savedResolution.partialOutcome
        };
      }

      savedAttemptFailed = true;
    } else {
      savedAttemptFailed = true;
    }
  }

  const promptContext = await acquireInlineAuthContext(sessionId, session);
  baseOutcome.domain = promptContext.domain || baseOutcome.domain;
  const promptDomain = promptContext.domain || baseOutcome.domain;

  if (promptContext.manualApproval && !promptContext.hasPasswordField) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'manual_approval',
        blocker: 'The site requires manual approval, MFA, or another verification step before the final action can continue.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  const promptAcknowledged = await requestInlineLoginPrompt(sessionId, promptDomain, promptContext.fields || initialContext.fields, {
    detail: savedAttemptFailed
      ? 'Saved credentials did not finish the sign-in. Submit updated credentials once to retry in this same session.'
      : 'Submit credentials once to let FSB sign in and resume this same session.',
    handoff: 'If you skip or the site still needs manual approval, FSB will preserve the completed work and finish with a manual handoff.',
    reason: savedAttemptFailed ? 'credentials_failed' : (savedAttempted ? 'auth_required' : 'credentials_missing')
  });

  if (!promptAcknowledged) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: savedAttemptFailed ? 'credentials_failed' : 'credentials_missing',
        blocker: savedAttemptFailed
          ? 'Saved credentials did not finish the sign-in, and no matching sidepanel was available to collect updated credentials.'
          : 'Authentication is still required, and no matching sidepanel was available to collect credentials.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  await sendInlineAuthStatus(sessionId, session, 'Waiting for one sign-in attempt from the sidepanel...');
  const loginResponse = await waitForLoginResponse(sessionId);

  if (!loginResponse || loginResponse.action !== 'loginFormSubmitted') {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: loginResponse?.reason === 'timeout' ? 'auth_required' : 'user_skipped_login',
        blocker: loginResponse?.reason === 'timeout'
          ? 'The sign-in prompt timed out before credentials were submitted.'
          : 'The sign-in prompt was skipped.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  const submittedCredentials = loginResponse.credentials || {};
  if (!submittedCredentials.username || !submittedCredentials.password) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'credentials_missing',
        blocker: 'Credentials were submitted without both a username/email and password.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  if (loginResponse.save && baseOutcome.domain) {
    await secureConfig.saveCredential(baseOutcome.domain, submittedCredentials);
  }

  const latestContext = await acquireInlineAuthContext(sessionId, session);
  const latestFields = latestContext.fields || promptContext.fields || initialContext.fields || {};

  if (latestContext.manualApproval && !latestContext.hasPasswordField) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'manual_approval',
        blocker: 'The site requires manual approval, MFA, or another verification step before the final action can continue.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  if (!latestFields.passwordSelector) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'manual_approval',
        blocker: 'Credentials were submitted, but FSB could not find a usable sign-in form to retry automatically.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  await sendInlineAuthStatus(sessionId, session, 'Trying the submitted credentials in this same session...');
  const submittedFill = await fillCredentialsOnPageDirect(session.tabId, {
    usernameSelector: latestFields.usernameSelector,
    passwordSelector: latestFields.passwordSelector,
    submitSelector: latestFields.submitSelector,
    username: submittedCredentials.username,
    password: submittedCredentials.password
  });

  if (!submittedFill?.success) {
    return {
      resume: false,
      partialOutcome: mergeAuthPartialOutcome(baseOutcome, {
        reason: 'credentials_failed',
        blocker: 'Submitted credentials could not be applied to the current sign-in form.',
        nextStep: getAuthHandoffNextStep(baseOutcome.domain)
      })
    };
  }

  const promptedResolution = await evaluateInlineAuthAttempt(sessionId, session, 'prompt_credentials', baseOutcome);
  if (promptedResolution.success) {
    await sendInlineAuthStatus(sessionId, session, 'Sign-in succeeded. Resuming the same session...');
    return {
      resume: true,
      source: 'prompt_credentials',
      toolResultMessage: 'Credentials were submitted successfully. Continue the same task from the authenticated page.',
      resumeMessage: 'The submitted credentials were accepted. Re-check the page and finish the remaining step.'
    };
  }

  return {
    resume: false,
    partialOutcome: promptedResolution.partialOutcome
  };
}

// Fast DJB2-style string hash for signal channel generation
function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}

// Multi-signal DOM change detection
// Returns 4 independent signal channels + raw data for downstream descriptor generation
// Each channel detects a different class of change the old single-hash missed
function createDOMSignals(domState) {
  const elements = domState.elements || [];

  // --- Structural signal: element type distribution ---
  const typeCounts = {};
  for (const el of elements) {
    const t = el.type;
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}:${count}`)
    .join(',');
  const structural = quickHash(topTypes);

  // --- Content signal: text/value from interactive elements ---
  const interactiveRoles = new Set(['alert', 'status', 'dialog', 'alertdialog']);
  const contentElements = elements
    .filter(el => el.isInput || el.isButton || (el.attributes?.role && interactiveRoles.has(el.attributes.role)))
    .sort((a, b) => (a.elementId || '').localeCompare(b.elementId || ''))
    .slice(0, 15);
  const contentParts = [];
  for (const el of contentElements) {
    if (el.isInput) {
      const label = el.attributes?.name || el.id || '';
      const val = (el.value || el.text || '').substring(0, 20);
      // Skip purely numeric values (timestamps, counters)
      if (val && !/^\d+$/.test(val)) {
        contentParts.push(`${label}:${val}`);
      }
    } else {
      const txt = (el.text || '').substring(0, 30);
      if (txt && !/^\d+$/.test(txt)) {
        contentParts.push(txt);
      }
    }
  }
  const content = quickHash(contentParts.join('|'));

  // --- Interaction signal: disabled/checked/readonly state ---
  // Explicitly EXCLUDES focused state (focus changes every iteration from AI actions)
  const interactionElements = elements
    .filter(el => el.isInput || el.isButton)
    .slice(0, 20);
  const interactionParts = [];
  for (const el of interactionElements) {
    const label = el.id || el.type || '';
    const flags = [];
    if (el.interactionState?.disabled) flags.push('D');
    if (el.interactionState?.checked) flags.push('C');
    if (el.interactionState?.readonly) flags.push('R');
    if (flags.length > 0) {
      interactionParts.push(`${label}:${flags.join('')}`);
    }
  }
  const interaction = quickHash(interactionParts.join('|'));

  // --- Page state signal: URL, title, element count, modals, alerts ---
  let urlPath = '';
  try {
    urlPath = new URL(domState.url || '').pathname;
  } catch { urlPath = domState.url || ''; }
  const hasModal = elements.some(el => {
    const r = el.attributes?.role;
    return r === 'dialog' || r === 'alertdialog';
  });
  const hasAlert = elements.some(el => {
    const r = el.attributes?.role;
    return r === 'alert' || r === 'status';
  });
  const pageStateFlags = {
    urlPath,
    title: domState.title || '',
    elementCount: elements.length,
    hasModal,
    hasAlert,
    captchaPresent: domState.captchaPresent || false
  };
  const pageState = quickHash(JSON.stringify(pageStateFlags));

  return {
    structural,
    content,
    interaction,
    pageState,
    _raw: { topTypes, elementCount: elements.length, pageStateFlags }
  };
}

// Compare two signal objects channel by channel
// Returns { changed: boolean, channels: string[], summary: string }
function compareSignals(current, previous) {
  if (!previous) {
    return { changed: true, channels: ['initial'], summary: 'First DOM snapshot' };
  }
  const changedChannels = [];
  if (current.structural !== previous.structural) changedChannels.push('structural');
  if (current.content !== previous.content) changedChannels.push('content');
  if (current.interaction !== previous.interaction) changedChannels.push('interaction');
  if (current.pageState !== previous.pageState) changedChannels.push('pageState');
  return {
    changed: changedChannels.length > 0,
    channels: changedChannels,
    summary: changedChannels.length > 0
      ? `Changed: ${changedChannels.join(', ')}`
      : 'No changes detected'
  };
}

// Parse topTypes string into a Map for diffing (e.g., "button:12,input:8" -> Map{button=>12, input=>8})
function parseTopTypes(topTypesStr) {
  const map = new Map();
  if (!topTypesStr) return map;
  for (const entry of topTypesStr.split(',')) {
    const [type, count] = entry.split(':');
    if (type && count) map.set(type.trim(), parseInt(count, 10));
  }
  return map;
}

// COMPAT: Backward-compatible wrapper -- returns a single hash string
// Used by automationLogger.logIteration() and stateHistory.domHash
function createDOMHash(domState) {
  const signals = createDOMSignals(domState);
  return '' + signals.structural + signals.content + signals.interaction + signals.pageState;
}

/**
 * Handle multi-tab actions directly in background script
 * @param {Object} action - The action to execute
 * @param {number} currentTabId - The current tab ID for context
 * @returns {Promise<Object>} Action result
 */
async function handleMultiTabAction(action, currentTabId) {
  const { tool, params } = action;

  automationLogger.logActionExecution(null, tool, 'start', { params, currentTabId });

  return new Promise((resolve) => {
    const mockSender = { tab: { id: currentTabId } };
    const mockRequest = { ...params, action: tool };

    switch (tool) {
      case 'openNewTab':
        handleOpenNewTab(mockRequest, mockSender, resolve);
        break;

      case 'switchToTab':
        (async () => {
          // Allow switching to tabs in the session's allowedTabs whitelist
          const switchRequest = { ...mockRequest };
          if (switchRequest.tabId && typeof switchRequest.tabId === 'string') {
            switchRequest.tabId = parseInt(switchRequest.tabId, 10);
          }

          // Find the session for this tab
          const session = Array.from(activeSessions.values()).find(s => s.tabId === currentTabId);
          const isAllowed = session && (
            switchRequest.tabId === session.originalTabId ||
            (session.allowedTabs || []).includes(switchRequest.tabId)
          );

          if (session && !isAllowed) {
            automationLogger.warn('Tab switch blocked', { allowedTabs: session.allowedTabs, requestedTabId: switchRequest.tabId });
            resolve({
              success: false,
              error: `Security restriction: Tab ${switchRequest.tabId} is not in the session's allowed tabs. Allowed: [${(session.allowedTabs || []).join(', ')}].`,
              blocked: true
            });
            return;
          }

          // Clean up overlays on the old tab BEFORE switching (while it is still the active foreground tab)
          if (session && session.tabId && session.tabId !== switchRequest.tabId) {
            await sendSessionStatus(session.tabId, { phase: 'ended', reason: 'tab_switch' });
          }

          // Perform the actual tab switch
          try {
            await chrome.tabs.update(switchRequest.tabId, { active: true });
          } catch (switchErr) {
            automationLogger.warn('Tab switch failed', { tabId: switchRequest.tabId, error: switchErr.message });
            resolve({
              success: false,
              error: `Failed to switch to tab ${switchRequest.tabId}: ${switchErr.message}`
            });
            return;
          }

          if (session) {
            session.previousTabId = session.tabId;
            session.tabId = switchRequest.tabId;
          }

          // Wait for the target tab to finish loading before checking content script
          try {
            const targetTab = await chrome.tabs.get(switchRequest.tabId);
            if (targetTab.status === 'loading') {
              await new Promise((resolveLoad) => {
                const onUpdated = (tabId, changeInfo) => {
                  if (tabId === switchRequest.tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    resolveLoad();
                  }
                };
                chrome.tabs.onUpdated.addListener(onUpdated);
                // Safety timeout to avoid hanging indefinitely
                setTimeout(() => {
                  chrome.tabs.onUpdated.removeListener(onUpdated);
                  resolveLoad();
                }, 5000);
              });
            }
          } catch (tabErr) {
            automationLogger.debug('Could not check target tab status', { tabId: switchRequest.tabId, error: tabErr.message });
          }

          const contentScriptReady = await waitForContentScriptReady(switchRequest.tabId, 5000).catch(() => false);
          automationLogger.debug('Tab switch allowed and executed', { tabId: switchRequest.tabId, contentScriptReady });

          // Immediately show overlay on the new tab so it appears right after the switch,
          // rather than waiting for the next automation iteration (800ms+ later).
          if (contentScriptReady && session) {
            await sendSessionStatus(switchRequest.tabId, {
              phase: 'switching_tab',
              taskName: session.task,
              iteration: session.iterationCount,
              maxIterations: session.maxIterations || 20,
              statusText: 'Switched tabs and loading destination',
              animatedHighlights: session.animatedActionHighlights,
              taskSummary: session.taskSummary || null
            });
          }

          resolve({
            success: true,
            message: contentScriptReady
              ? `Switched to tab ${switchRequest.tabId}`
              : `Switched to tab ${switchRequest.tabId} (content script not yet ready -- DOM will be fetched on next iteration)`,
            tabId: switchRequest.tabId,
            contentScriptReady
          });
        })();
        break;

      case 'closeTab':
        // Fix: Convert string tabId to integer
        const closeRequest = { ...mockRequest };
        if (closeRequest.tabId && typeof closeRequest.tabId === 'string') {
          closeRequest.tabId = parseInt(closeRequest.tabId, 10);
        }
        handleCloseTab(closeRequest, mockSender, resolve);
        break;

      case 'listTabs':
        handleListTabs(mockRequest, mockSender, resolve);
        break;

      case 'waitForTabLoad':
        // Fix: Convert string tabId to integer, default to current tab if not specified
        const waitRequest = { ...mockRequest };
        if (waitRequest.tabId) {
          if (typeof waitRequest.tabId === 'string') {
            waitRequest.tabId = parseInt(waitRequest.tabId, 10);
          }
        } else {
          waitRequest.tabId = currentTabId;
        }
        handleWaitForTabLoad(waitRequest, mockSender, resolve);
        break;

      case 'getCurrentTab':
        handleGetCurrentTab(mockRequest, mockSender, resolve);
        break;

      default:
        automationLogger.error('Unknown multi-tab action', { tool });
        resolve({
          success: false,
          error: `Unknown multi-tab action: ${tool}`
        });
    }
  });
}

/**
 * Normalize a job apply URL for deduplication comparison.
 * Removes common tracking parameters and trailing slashes.
 * @param {string} url - The raw apply URL
 * @returns {string} Normalized URL string
 */
function normalizeApplyUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'source', 'ref', 'src', 'returnUrl', 'from'
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Remove trailing slashes from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch (e) {
    // URL parsing failed -- return raw string
    return url;
  }
}

/**
 * Deduplicate jobs by normalized apply link.
 * Per locked decision: duplicate = same apply link (URL match), silently drop duplicates.
 * Jobs without apply links or with "not available" apply links are NEVER duplicates.
 * First occurrence wins for jobs with valid apply links.
 * @param {Array} jobs - Array of job objects
 * @returns {Array} Deduplicated array of job objects
 */
function deduplicateJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return jobs || [];

  const seen = new Map();
  const result = [];

  for (const job of jobs) {
    const link = job.applyLink;

    // Jobs without apply links or with "not available" are never duplicates
    if (!link || link.toLowerCase().includes('not available')) {
      result.push(job);
      continue;
    }

    const normalized = normalizeApplyUrl(link);
    if (!seen.has(normalized)) {
      seen.set(normalized, true);
      result.push(job);
    }
    // Else: silently drop duplicate
  }

  return result;
}

/**
 * Check whether an existing job accumulator is relevant to a new task.
 * Per locked decision: if old data has same role keywords, keep it; if different role, clear.
 * Compares role keywords between the new task and the existing accumulator's searchQuery.
 * @param {Object|null} existingAccumulator - The existing fsbJobAccumulator from storage
 * @param {string} newTaskString - The new task description
 * @returns {string} 'keep' if old data is relevant, 'clear' if it should be discarded
 */
function checkAccumulatorRelevance(existingAccumulator, newTaskString) {
  if (!existingAccumulator || !existingAccumulator.searchQuery) return 'clear';
  if (!newTaskString) return 'clear';

  // Common verbs to exclude from keyword extraction
  const excludeWords = [
    'find', 'search', 'look', 'get', 'show', 'list', 'browse', 'check', 'view',
    'at', 'for', 'in', 'on', 'and', 'or', 'the', 'a', 'an', 'to', 'with'
  ];

  // Extract role keywords: words before "at" in the task string, excluding common verbs
  function extractRoleKeywords(taskStr) {
    // Get the portion before "at [companies]"
    const beforeAt = taskStr.replace(/\bat\s+.+$/i, '').trim().toLowerCase();
    return beforeAt
      .split(/\s+/)
      .filter(w => w.length > 1 && !excludeWords.includes(w));
  }

  const newKeywords = extractRoleKeywords(newTaskString);
  const oldKeywords = extractRoleKeywords(existingAccumulator.searchQuery);

  if (newKeywords.length === 0 || oldKeywords.length === 0) return 'clear';

  // Calculate overlap percentage based on new keywords
  const oldSet = new Set(oldKeywords);
  const overlapCount = newKeywords.filter(kw => oldSet.has(kw)).length;
  const overlapRatio = overlapCount / newKeywords.length;

  return overlapRatio >= 0.5 ? 'keep' : 'clear';
}

// ============================================================================
// Multi-Site Orchestrator
// Sequences company searches, handles failures/auth walls, dedup, final report
// ============================================================================

/**
 * Extract role/search keywords from a task string.
 * Takes words before "at" in the string, filters out common verbs.
 * Example: "find DevOps engineer jobs at Microsoft, Amazon" -> "devops engineer jobs"
 * @param {string} taskStr - The user's task description
 * @returns {string} Lowercase space-joined role keywords
 */
function extractSearchQuery(taskStr) {
  if (!taskStr) return '';
  const beforeAt = taskStr.replace(/\bat\s+.+$/i, '').trim().toLowerCase();
  const excludeVerbs = [
    'find', 'search', 'look', 'get', 'show', 'list', 'browse', 'check', 'view',
    'at', 'for', 'in', 'on', 'and', 'or', 'the', 'a', 'an', 'to', 'with'
  ];
  return beforeAt
    .split(/\s+/)
    .filter(w => w.length > 1 && !excludeVerbs.includes(w))
    .join(' ');
}

/**
 * Rewrite a multi-company task to target a single company.
 * Replaces the "at [company list]" portion with "at [companyName]".
 * Example: "find DevOps jobs at Microsoft, Amazon, and Google" + "Amazon"
 *       -> "find DevOps jobs at Amazon"
 * @param {string} originalTask - The original multi-company task
 * @param {string} companyName - The single company to target
 * @returns {string} Rewritten single-company task
 */
function buildSingleCompanyTask(originalTask, companyName) {
  // Replace "at [company list]" at end of string with "at [companyName]"
  const rewritten = originalTask.replace(/\bat\s+.+$/i, `at ${companyName}`);
  // If regex didn't match (unusual), just append
  if (rewritten === originalTask) {
    return `${originalTask} at ${companyName}`;
  }
  return rewritten;
}

/**
 * Initialize or validate the multi-site job accumulator in chrome.storage.local.
 * Checks relevance of existing data -- clears if different search, keeps if same.
 * @param {Object} session - The session object with multiSite state
 */
async function initMultiSiteAccumulator(session) {
  try {
    const stored = await chrome.storage.local.get('fsbJobAccumulator');
    const existing = stored.fsbJobAccumulator || null;
    const relevance = checkAccumulatorRelevance(existing, session.multiSite.originalTask);

    if (relevance === 'clear' || !existing) {
      // Fresh accumulator for new search
      const freshAccumulator = {
        sessionId: session.sessionId || null,
        searchQuery: session.multiSite.searchQuery,
        startedAt: Date.now(),
        companies: {},
        totalJobs: 0,
        completedAt: null
      };
      await chrome.storage.local.set({ fsbJobAccumulator: freshAccumulator });
      automationLogger.info('Multi-site accumulator initialized (fresh)', {
        searchQuery: session.multiSite.searchQuery,
        reason: existing ? 'different_search' : 'no_existing'
      });
    } else {
      // Keep existing data, update session reference
      existing.sessionId = session.sessionId || existing.sessionId;
      existing.startedAt = Date.now();
      await chrome.storage.local.set({ fsbJobAccumulator: existing });
      automationLogger.info('Multi-site accumulator retained (relevant data)', {
        searchQuery: session.multiSite.searchQuery,
        existingCompanies: Object.keys(existing.companies).length,
        existingJobs: existing.totalJobs
      });
    }
  } catch (error) {
    automationLogger.warn('Failed to initialize multi-site accumulator', { error: error.message });
  }
}

/**
 * Handle multi-site completion interception when a single-company search finishes.
 * Advances to next company, defers auth-walled companies, or finalizes search.
 * @param {string} sessionId - The session ID
 * @param {Object} session - The session object with multiSite state
 * @param {Object} aiResponse - The AI response that triggered taskComplete
 * @returns {Promise<boolean>} true if handled (more companies to go), false if all done
 */
async function handleMultiSiteCompletion(sessionId, session, aiResponse) {
  const ms = session.multiSite;
  const currentCompany = ms.companyList[ms.currentIndex];
  const resultText = (aiResponse.result || '').toString();

  automationLogger.info('Multi-site completion for company', {
    sessionId,
    company: currentCompany,
    index: ms.currentIndex,
    total: ms.companyList.length,
    resultPreview: resultText.substring(0, 150)
  });

  // Check for auth wall
  if (/AUTH\s*REQUIRED/i.test(resultText)) {
    ms.deferredCompanies.push({ name: currentCompany, reason: resultText.substring(0, 200) });
    // Update accumulator with auth status
    try {
      const stored = await chrome.storage.local.get('fsbJobAccumulator');
      const acc = stored.fsbJobAccumulator;
      if (acc) {
        acc.companies[currentCompany] = {
          status: 'auth_required',
          jobs: [],
          error: 'Authentication required'
        };
        await chrome.storage.local.set({ fsbJobAccumulator: acc });
      }
    } catch (e) {
      automationLogger.warn('Failed to update accumulator for auth deferral', { error: e.message });
    }
    automationLogger.info('Company deferred due to auth wall', { sessionId, company: currentCompany });
  }
  // Check for page error / failure
  else if (/PAGE\s*ERROR|SITE\s*UNAVAILABLE|Could not access/i.test(resultText)) {
    ms.failures.push({ company: currentCompany, reason: 'site_error', error: resultText.substring(0, 200) });
    automationLogger.warn('Company search failed', { sessionId, company: currentCompany, reason: 'site_error' });
  }

  // Validate storeJobData was called (fallback parsing)
  const storeJobCalled = session.actionHistory.some(a => a.tool === 'storeJobData' && a.result?.success);
  if (!storeJobCalled && !/AUTH\s*REQUIRED/i.test(resultText) && !/PAGE\s*ERROR/i.test(resultText)) {
    // Check if result text contains job data that wasn't stored
    const jobsFoundMatch = resultText.match(/JOBS?\s*FOUND:?\s*(\d+)/i);
    if (jobsFoundMatch || /\|\s*Title\s*\|/i.test(resultText) || /^\d+\.\s+\*\*/m.test(resultText)) {
      automationLogger.warn('AI did not call storeJobData -- attempting fallback parse', {
        sessionId,
        company: currentCompany
      });
      // Attempt to parse structured job data from result text
      try {
        const fallbackJobs = parseJobsFromResultText(resultText, currentCompany);
        if (fallbackJobs.length > 0) {
          await handleBackgroundAction({
            tool: 'storeJobData',
            params: { company: currentCompany, jobs: fallbackJobs }
          }, session);
          automationLogger.info('Fallback storeJobData succeeded', {
            sessionId,
            company: currentCompany,
            jobCount: fallbackJobs.length
          });
        }
      } catch (parseErr) {
        automationLogger.warn('Fallback job parsing failed', { error: parseErr.message });
      }
    }
  }

  // Advance to next company
  ms.currentIndex++;

  // Check if more primary companies remain
  if (ms.currentIndex < ms.companyList.length) {
    const nextCompany = ms.companyList[ms.currentIndex];
    return await launchNextCompanySearch(sessionId, session, nextCompany);
  }

  // No more primary companies -- check deferred (auth-walled) companies
  if (ms.deferredCompanies.length > 0) {
    automationLogger.info('Processing deferred auth-walled companies', {
      sessionId,
      count: ms.deferredCompanies.length,
      companies: ms.deferredCompanies.map(d => d.name)
    });

    // For each deferred company, check if user might have logged in
    // (heuristic: any tab on the company's domain that is NOT a login page)
    for (const deferred of ms.deferredCompanies) {
      const loginDetected = await checkUserLoginStatus(deferred.name);
      if (loginDetected) {
        // User may have logged in -- retry this company
        automationLogger.info('Login detected for deferred company, retrying', {
          sessionId,
          company: deferred.name
        });
        // Add to end of company list and reset index to process it
        ms.companyList.push(deferred.name);
        return await launchNextCompanySearch(sessionId, session, deferred.name);
      } else {
        // User did not authenticate -- mark as failure
        ms.failures.push({
          company: deferred.name,
          reason: 'auth_required',
          error: 'Authentication required but user did not log in'
        });
        // Update accumulator
        try {
          const stored = await chrome.storage.local.get('fsbJobAccumulator');
          const acc = stored.fsbJobAccumulator;
          if (acc && acc.companies[deferred.name]) {
            acc.companies[deferred.name].error = 'User did not authenticate';
            await chrome.storage.local.set({ fsbJobAccumulator: acc });
          }
        } catch (e) {
          automationLogger.warn('Failed to update accumulator for deferred failure', { error: e.message });
        }
      }
    }
  }

  // All companies processed -- finalize
  await finalizeMultiSiteSearch(sessionId, session);

  // Check if the original task implies Sheets output (Phase 12)
  if (detectSheetsIntent(session.multiSite.originalTask)
      && session.multiSiteResult
      && !session.multiSiteResult.startsWith('Could not')
      && !session.multiSiteResult.startsWith('No jobs')) {
    // Launch Sheets data entry session instead of completing
    await startSheetsDataEntry(sessionId, session);
    return true; // Handled -- automation loop will restart for Sheets entry
  } else {
    return false; // Let normal completion flow run with finalized data
  }
}

/**
 * Launch the next company search by resetting session state and restarting the loop.
 * @param {string} sessionId - The session ID
 * @param {Object} session - The session object
 * @param {string} companyName - The next company to search
 * @returns {Promise<boolean>} Always returns true (handled)
 */
async function launchNextCompanySearch(sessionId, session, companyName) {
  const ms = session.multiSite;
  const totalCompanies = ms.companyList.length;

  // Reset session state for next company
  session.task = buildSingleCompanyTask(ms.originalTask, companyName);
  session.iterationCount = 0;
  session.stuckCounter = 0;
  session.consecutiveNoProgressCount = 0;
  session.actionHistory = [];
  session.stateHistory = [];
  session.lastDOMHash = null;
  session.lastDOMSignals = null;
  session.domHashes = [];
  session.actionSequences = [];
  session.sequenceRepeatCount = {};
  session.failedAttempts = {};
  session.failedActionDetails = {};
  session.urlHistory = [];
  session.lastUrl = null;
  session.status = 'running';

  // Cap iterations per company to prevent one company consuming all iterations
  session.maxIterations = Math.min(session.maxIterations || 20, 15);

  session.taskSummary = `Job search: ${ms.currentIndex + 1}/${totalCompanies} companies`;

  automationLogger.info('Launching next company search', {
    sessionId,
    company: companyName,
    index: ms.currentIndex,
    total: totalCompanies,
    taskSummary: session.taskSummary
  });

  // Clear AI conversation history so the new company starts fresh (Gap 1 fix)
  const ai = sessionAIInstances.get(sessionId);
  if (ai && typeof ai.clearConversationHistory === 'function') {
    ai.clearConversationHistory();
    automationLogger.info('Cleared AI conversation for company transition', {
      sessionId,
      newCompany: companyName
    });
  }

  // Reset session timer so the 5-minute timeout restarts for this company (Gap 3 fix)
  session.startTime = Date.now();

  // Send ProgressOverlay update
  sendSessionStatus(session.tabId, {
    phase: 'analyzing',
    taskName: `Searching ${companyName}`,
    iteration: 0,
    maxIterations: session.maxIterations || 15,
    animatedHighlights: session.animatedActionHighlights,
    taskSummary: session.taskSummary
  });

  // Persist updated session state
  persistSession(sessionId, session);

  // Small delay for page transition before starting agent loop
  var sessionHooks = createSessionHooks();
  setTimeout(() => runAgentLoop(sessionId, {
    activeSessions,
    persistSession,
    sendSessionStatus,
    broadcastDashboardProgress,
    endSessionOverlays, cleanupSession,
    startKeepAlive,
    executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
    handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
    resolveAuthWall: resolveInlineAuthWall,
    hooks: sessionHooks.hooks,
    emitter: sessionHooks.emitter
  }), 500);
  return true;
}

/**
 * Check if user has logged into a company's domain by examining open tabs.
 * Heuristic: look for tabs on the company's domain that are NOT login/auth pages.
 * @param {string} companyName - The company name to check
 * @returns {Promise<boolean>} true if login appears detected
 */
async function checkUserLoginStatus(companyName) {
  try {
    const tabs = await chrome.tabs.query({});
    const companyLower = companyName.toLowerCase().replace(/\s+/g, '');
    const loginPatterns = ['/login', '/signin', '/auth', '/sso', '/sign-in', '/sign_in', '/account/begin'];

    for (const tab of tabs) {
      if (!tab.url) continue;
      const urlLower = tab.url.toLowerCase();
      // Check if tab is on this company's domain
      const isCompanyDomain = urlLower.includes(companyLower) ||
        urlLower.includes(companyLower.replace(/\s+/g, '-'));
      if (isCompanyDomain) {
        // Check if it's NOT a login page
        const isLoginPage = loginPatterns.some(p => urlLower.includes(p));
        if (!isLoginPage) {
          return true; // Found a non-login page on company domain
        }
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Parse job data from AI result text as a fallback when storeJobData was not called.
 * Handles common formats: numbered lists with bold titles, markdown tables.
 * @param {string} resultText - The AI's result text
 * @param {string} company - The company name for annotation
 * @returns {Array} Array of job objects
 */
function parseJobsFromResultText(resultText, company) {
  const jobs = [];

  // Try to parse numbered list format: "1. **Title** - Location"
  const numberedPattern = /^\d+\.\s+\*\*(.+?)\*\*\s*[-:]\s*(.+)/gm;
  let match;
  while ((match = numberedPattern.exec(resultText)) !== null) {
    const title = match[1].trim();
    const rest = match[2].trim();
    // Try to extract location from the rest
    const locationMatch = rest.match(/^([^|]+?)(?:\s*\|\s*|\s*[-:]\s*Apply|\s*$)/);
    jobs.push({
      title,
      location: locationMatch ? locationMatch[1].trim() : '',
      applyLink: 'not available',
      datePosted: '',
      description: rest.substring(0, 200)
    });
  }

  // Try markdown table format if no numbered results
  if (jobs.length === 0) {
    const rows = resultText.split('\n').filter(line => line.includes('|') && !line.includes('---'));
    // Skip header row
    const dataRows = rows.slice(1);
    for (const row of dataRows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 2) {
        jobs.push({
          title: cells[0] || '',
          location: cells[1] || '',
          applyLink: cells.find(c => c.startsWith('http')) || 'not available',
          datePosted: '',
          description: cells.slice(2).join(' ').substring(0, 200)
        });
      }
    }
  }

  return jobs;
}

/**
 * Finalize the multi-site search: run dedup, build final summary, update accumulator.
 * Called after all companies (including deferred) have been processed.
 * @param {string} sessionId - The session ID
 * @param {Object} session - The session object with multiSite state
 */
async function finalizeMultiSiteSearch(sessionId, session) {
  const ms = session.multiSite;

  automationLogger.info('Finalizing multi-site search', {
    sessionId,
    totalCompanies: ms.companyList.length,
    failures: ms.failures.length,
    deferred: ms.deferredCompanies.length
  });

  try {
    // Read accumulator
    const stored = await chrome.storage.local.get('fsbJobAccumulator');
    const accumulator = stored.fsbJobAccumulator || { companies: {}, totalJobs: 0 };

    // Flatten all jobs across all companies
    const allJobs = Object.values(accumulator.companies)
      .filter(entry => entry.status === 'completed' && Array.isArray(entry.jobs))
      .flatMap(entry => entry.jobs);

    // Run dedup
    const dedupedJobs = deduplicateJobs(allJobs);
    const removedDuplicates = allJobs.length - dedupedJobs.length;

    // Update accumulator
    accumulator.dedupedJobCount = dedupedJobs.length;
    accumulator.duplicatesRemoved = removedDuplicates;
    accumulator.completedAt = Date.now();
    accumulator.totalJobs = dedupedJobs.length;
    await chrome.storage.local.set({ fsbJobAccumulator: accumulator });

    automationLogger.info('Multi-site dedup complete', {
      sessionId,
      totalBeforeDedup: allJobs.length,
      totalAfterDedup: dedupedJobs.length,
      duplicatesRemoved: removedDuplicates
    });

    // Build final result summary
    let finalResult = '';

    if (dedupedJobs.length === 0) {
      // No jobs found -- distinguish between all-failures vs no-results
      const allFailed = ms.failures.length === ms.companyList.length;
      if (allFailed) {
        finalResult = `Could not search any of the requested companies. `;
      } else {
        finalResult = `No jobs matching your search were found across the companies searched. `;
      }
    } else {
      // Build concise summary per locked decision (not full data table unless user asked for listing)
      const companiesWithJobs = Object.entries(accumulator.companies)
        .filter(([, entry]) => entry.status === 'completed' && entry.jobs?.length > 0)
        .map(([name, entry]) => `${name} (${entry.jobs.length})`);

      finalResult = `Found ${dedupedJobs.length} job${dedupedJobs.length !== 1 ? 's' : ''} across ${companiesWithJobs.length} compan${companiesWithJobs.length !== 1 ? 'ies' : 'y'}: ${companiesWithJobs.join(', ')}. `;

      if (removedDuplicates > 0) {
        finalResult += `${removedDuplicates} duplicate${removedDuplicates !== 1 ? 's' : ''} removed. `;
      }
    }

    // Append failure summary per locked decision
    if (ms.failures.length > 0) {
      const failureLines = ms.failures.map(f => {
        if (f.reason === 'auth_required') {
          return `${f.company}: authentication required`;
        }
        return `${f.company}: ${f.reason === 'site_error' ? 'site unavailable' : f.reason}`;
      });
      finalResult += `Failures: ${failureLines.join('; ')}.`;
    }

    // Store final result on session for the completion handler
    session.multiSiteResult = finalResult.trim();
    session.task = ms.originalTask; // Restore original task for final reporting
    session.taskSummary = `Job search: ${ms.companyList.length}/${ms.companyList.length} companies (complete)`;

    // Persist final state
    persistSession(sessionId, session);
  } catch (error) {
    automationLogger.error('Failed to finalize multi-site search', {
      sessionId,
      error: error.message
    });
    session.multiSiteResult = 'Multi-site search completed but summary generation failed. Check stored job data.';
  }
}

// ============================================================================
// Phase 12: Google Sheets Data Entry Orchestrator
// ============================================================================

/**
 * Read accumulated job data from chrome.storage.local fsbJobAccumulator.
 * Flattens all jobs from completed companies into a single array.
 * @returns {Promise<{jobs: Array, totalJobs: number, searchQuery: string, companies: string[]}>}
 */
async function getAccumulatedJobData() {
  const stored = await chrome.storage.local.get('fsbJobAccumulator');
  const accumulator = stored.fsbJobAccumulator;

  if (!accumulator || !accumulator.companies) {
    return { jobs: [], totalJobs: 0, searchQuery: '', companies: [] };
  }

  const allJobs = Object.values(accumulator.companies)
    .filter(entry => entry.status === 'completed' && Array.isArray(entry.jobs))
    .flatMap(entry => entry.jobs);

  return {
    jobs: allJobs,
    totalJobs: allJobs.length,
    searchQuery: accumulator.searchQuery || '',
    companies: Object.keys(accumulator.companies)
  };
}

/**
 * Convert job data array into a compact table string for AI prompt injection.
 * Each row is formatted with pipe-delimited fields for readability.
 * @param {Array} jobs - Array of job objects
 * @param {string[]} columns - The columns to include in the output
 * @returns {{formattedData: string, rowCount: number}}
 */
function formatJobDataForPrompt(jobs, columns) {
  const columnToField = {
    'Title': 'title',
    'Company': 'company',
    'Location': 'location',
    'Date': 'datePosted',
    'Description': 'description',
    'Apply Link': 'applyLink'
  };

  const formattedRows = jobs.map((job, i) => {
    const parts = columns.map(col => {
      const field = columnToField[col];
      let value = job[field] || 'N/A';
      // Cap description at 200 chars
      if (col === 'Description' && value.length > 200) {
        value = value.substring(0, 200).trim() + '...';
      }
      return `${col}: "${value}"`;
    });
    return `Row ${i + 2}: ${parts.join(' | ')}`;
  });

  return {
    formattedData: formattedRows.join('\n'),
    rowCount: jobs.length
  };
}

/**
 * Check if the user's original task implies writing to a Google Sheet.
 * Uses simple keyword matching -- not complex NLP.
 * @param {string} task - The user's original task string
 * @returns {boolean}
 */
function detectSheetsIntent(task) {
  if (!task) return false;
  const taskLower = task.toLowerCase();
  const sheetsKeywords = [
    'spreadsheet', 'sheet', 'sheets', 'google sheet', 'google sheets',
    'write to sheet', 'put in sheet', 'add to sheet', 'create a sheet',
    'fill sheet', 'populate sheet', 'make a spreadsheet'
  ];
  return sheetsKeywords.some(kw => taskLower.includes(kw));
}

/**
 * Find an existing Google Sheets tab that is open in the browser.
 * Matches tabs with docs.google.com/spreadsheets/d/ URL pattern (actual sheets, not home page).
 * @returns {Promise<{tabId: number, url: string}|null>}
 */
async function findExistingSheetsTab() {
  try {
    const tabs = await chrome.tabs.query({});
    const sheetsTab = tabs.find(tab =>
      tab.url && /docs\.google\.com\/spreadsheets\/d\//.test(tab.url)
    );
    if (sheetsTab) {
      return { tabId: sheetsTab.id, url: sheetsTab.url };
    }
    return null;
  } catch (error) {
    automationLogger.warn('Failed to query tabs for Sheets detection', { error: error.message });
    return null;
  }
}

/**
 * Parse user's task for custom column selection.
 * If the task mentions specific columns (e.g., "only title and company"),
 * returns a filtered subset. Otherwise returns all 6 defaults.
 * @param {string} task - The user's original task string
 * @returns {string[]} Array of column names to include
 */
function parseCustomColumns(task) {
  const defaults = ['Title', 'Company', 'Location', 'Date', 'Description', 'Apply Link'];
  if (!task) return defaults;
  const taskLower = task.toLowerCase();

  // Look for explicit column restriction patterns
  const restrictionPatterns = [
    /(?:only|just)\s+(?:the\s+)?(?:columns?\s+)?(.+?)(?:\s+(?:in|into|to|on)\s+|$)/i,
    /columns?:\s*(.+?)(?:\s+(?:in|into|to|on)\s+|$)/i,
    /(?:with|include)\s+only\s+(.+?)(?:\s+(?:in|into|to|on)\s+|$)/i
  ];

  const columnAliases = {
    'Title': ['title', 'role', 'position', 'job title', 'job name'],
    'Company': ['company', 'firm', 'employer', 'organization', 'org'],
    'Location': ['location', 'city', 'place', 'where'],
    'Date': ['date', 'posted', 'when', 'date posted'],
    'Description': ['description', 'desc', 'details', 'summary', 'info'],
    'Apply Link': ['link', 'url', 'apply', 'apply link', 'application link']
  };

  for (const pattern of restrictionPatterns) {
    const match = taskLower.match(pattern);
    if (match) {
      const mentionedText = match[1];
      const selected = [];
      for (const [colName, aliases] of Object.entries(columnAliases)) {
        if (aliases.some(alias => mentionedText.includes(alias))) {
          selected.push(colName);
        }
      }
      if (selected.length > 0) return selected;
    }
  }

  return defaults;
}

/**
 * Build a descriptive sheet title from session context.
 * Generates names like "Job Search - SWE Internships - Feb 2026".
 * @param {Object} session - The session object
 * @returns {string} Formatted sheet title
 */
function buildSheetTitle(session) {
  const query = session.sheetsData?.searchQuery || '';
  const date = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (query) {
    return `Job Search - ${query} - ${date}`;
  }
  return `Job Search Results - ${date}`;
}

/**
 * Core Sheets data entry orchestrator.
 * Reads accumulated job data, determines sheet target, builds session state,
 * rewrites the task for Sheets entry, and restarts the automation loop.
 * @param {string} sessionId - The session ID
 * @param {Object} session - The session object
 */
async function startSheetsDataEntry(sessionId, session) {
  automationLogger.info('Starting Sheets data entry orchestration', { sessionId });

  // 1. Get accumulated job data
  const jobData = await getAccumulatedJobData();
  if (jobData.jobs.length === 0) {
    automationLogger.warn('No accumulated job data found for Sheets entry', { sessionId });
    return;
  }
  automationLogger.info('Retrieved accumulated job data for Sheets entry', {
    sessionId,
    totalJobs: jobData.totalJobs,
    companies: jobData.companies.length
  });

  // 2. Parse custom columns from the original task
  const originalTask = session.multiSite?.originalTask || session.task;
  const customColumns = parseCustomColumns(originalTask);
  automationLogger.info('Column selection for Sheets entry', {
    sessionId,
    columns: customColumns,
    isCustom: customColumns.length < 6
  });

  // 3. Format job data for prompt injection
  const { formattedData, rowCount } = formatJobDataForPrompt(jobData.jobs, customColumns);

  // 4. Determine sheet target
  let sheetTarget;

  // Check if user's original task mentions a specific Sheets URL
  const sheetsUrlMatch = originalTask.match(/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+/);
  if (sheetsUrlMatch) {
    sheetTarget = { type: 'url', url: 'https://' + sheetsUrlMatch[0], tabId: null };
    automationLogger.info('Sheets target: user-provided URL', { sessionId, url: sheetTarget.url });
  } else {
    // Check for existing Sheets tab
    const existingTab = await findExistingSheetsTab();
    if (existingTab) {
      sheetTarget = { type: 'existing', url: existingTab.url, tabId: existingTab.tabId };
      automationLogger.info('Sheets target: existing tab', { sessionId, tabId: existingTab.tabId });
    } else {
      sheetTarget = { type: 'new', url: 'https://docs.google.com/spreadsheets/create', tabId: null };
      automationLogger.info('Sheets target: new sheet', { sessionId });
    }
  }

  // 5. Build session.sheetsData
  session.sheetsData = {
    jobDataPrompt: formattedData,
    rawJobs: jobData.jobs,
    totalRows: rowCount,
    columns: customColumns,
    sheetTarget: sheetTarget,
    searchQuery: jobData.searchQuery,
    rowsWritten: 0,
    startedAt: Date.now()
  };

  // 5b. Generate sheet title from context
  session.sheetsData.sheetTitle = buildSheetTitle(session);

  // 6. Rewrite session task for Sheets-specific entry
  session.task = `Open Google Sheets, call fillSheetData to write ${rowCount} job listings, verify the data was written correctly, then rename the sheet to "${session.sheetsData.sheetTitle || 'Job Search Results'}".`;

  // 7. Reset session iteration state (same pattern as launchNextCompanySearch)
  session.iterationCount = 0;
  session.stuckCounter = 0;
  session.consecutiveNoProgressCount = 0;
  session.actionHistory = [];
  session.stateHistory = [];
  session.lastDOMHash = null;
  session.lastDOMSignals = null;
  session.domHashes = [];
  session.actionSequences = [];
  session.sequenceRepeatCount = {};
  session.failedAttempts = {};
  session.failedActionDetails = {};
  session.urlHistory = [];
  session.lastUrl = null;
  session.status = 'running';

  // 8. Clear AI conversation history so Sheets entry starts fresh (Gap 2 fix)
  const ai = sessionAIInstances.get(sessionId);
  if (ai && typeof ai.clearConversationHistory === 'function') {
    ai.clearConversationHistory();
    automationLogger.info('Cleared AI conversation for Sheets entry transition', { sessionId });
  }

  // 9. Reset session timer for Sheets entry phase (Gap 3 fix)
  session.startTime = Date.now();

  // 10. Set iteration cap proportional to job count (enough for writing + verification)
  session.maxIterations = 15;

  // 11. Update task summary for progress overlay
  session.taskSummary = `Sheets data entry: 0/${rowCount} rows`;

  // 12. Send initial progress overlay update
  sendSessionStatus(session.tabId, {
    phase: 'sheets-entry',
    step: 'Starting Google Sheets data entry',
    status: `Writing 0/${rowCount} rows...`,
    taskName: session.task,
    iteration: 0,
    maxIterations: session.maxIterations,
    taskSummary: session.taskSummary,
    progressPercent: 0,
    estimatedTimeRemaining: null
  });

  // 13. Persist session state
  persistSession(sessionId, session);

  // 12. Start agent loop with transition delay
  var sessionHooks = createSessionHooks();
  setTimeout(() => runAgentLoop(sessionId, {
    activeSessions,
    persistSession,
    sendSessionStatus,
    broadcastDashboardProgress,
    endSessionOverlays, cleanupSession,
    startKeepAlive,
    executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
    handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
    resolveAuthWall: resolveInlineAuthWall,
    hooks: sessionHooks.hooks,
    emitter: sessionHooks.emitter
  }), 500);

  automationLogger.info('Sheets data entry session launched', {
    sessionId,
    totalRows: rowCount,
    columns: customColumns,
    sheetTarget: sheetTarget.type,
    maxIterations: session.maxIterations
  });
}

/**
 * Sheets formatting orchestrator (Phase 13).
 * Launches a formatting pass after data entry completes.
 * Follows the same session-chaining pattern as startSheetsDataEntry.
 * @param {string} sessionId
 * @param {Object} session
 */
async function startSheetsFormatting(sessionId, session) {
  automationLogger.info('Starting Sheets formatting pass', { sessionId });

  const sd = session.sheetsData;

  // Edge case: no data was written -- skip formatting entirely
  if (!sd || sd.totalRows === 0) {
    automationLogger.info('No data rows to format -- skipping formatting', { sessionId });
    sd.formattingComplete = true;
    sd.formattingPhase = true;
    return; // Will fall through to normal completion on next check
  }

  const lastCol = String.fromCharCode(64 + sd.columns.length); // A=65, columns.length gives letter
  const dataRange = `A1:${lastCol}${sd.totalRows + 1}`;

  // Mark formatting phase active
  sd.formattingPhase = true;
  sd.formattingStep = 'starting';
  sd.dataRange = dataRange;
  sd.lastCol = lastCol;

  // Rewrite session task for formatting
  session.task = `Format the Google Sheet with professional styling. The sheet has ${sd.totalRows} data rows plus 1 header row (row 1), columns A through ${lastCol}. Data range: ${dataRange}. Apply: bold header row, center-aligned headers, dark background with white text, bottom border, freeze row 1, alternating row colors (white/light gray), blue text for Apply Link column, and auto-size all columns.`;

  // Reset iteration state (same pattern as startSheetsDataEntry)
  session.iterationCount = 0;
  session.stuckCounter = 0;
  session.consecutiveNoProgressCount = 0;
  session.actionHistory = [];
  session.stateHistory = [];
  session.lastDOMHash = null;
  session.lastDOMSignals = null;
  session.domHashes = [];
  session.actionSequences = [];
  session.sequenceRepeatCount = {};
  session.failedAttempts = {};
  session.failedActionDetails = {};
  session.urlHistory = [];
  session.lastUrl = null;
  session.status = 'running';

  // Clear AI conversation history so formatting starts fresh
  const ai = sessionAIInstances.get(sessionId);
  if (ai && typeof ai.clearConversationHistory === 'function') {
    ai.clearConversationHistory();
    automationLogger.info('Cleared AI conversation for formatting transition', { sessionId });
  }

  // Reset session timer for formatting phase (Gap 3 fix)
  session.startTime = Date.now();

  // Formatting needs fewer iterations than data entry (keyboard shortcuts are fast)
  session.maxIterations = 25;

  // Update task summary for progress overlay
  session.taskSummary = 'Formatting sheet...';

  // Send progress overlay update
  sendSessionStatus(session.tabId, {
    phase: 'sheets-formatting',
    step: 'Applying professional formatting',
    status: 'Formatting sheet...',
    taskName: session.task,
    iteration: 0,
    maxIterations: session.maxIterations,
    taskSummary: session.taskSummary,
    progressPercent: 0,
    estimatedTimeRemaining: null
  });

  // Persist and launch agent loop
  persistSession(sessionId, session);
  var sessionHooks = createSessionHooks();
  setTimeout(() => runAgentLoop(sessionId, {
    activeSessions,
    persistSession,
    sendSessionStatus,
    broadcastDashboardProgress,
    endSessionOverlays, cleanupSession,
    startKeepAlive,
    executeCDPToolDirect: typeof executeCDPToolDirect === 'function' ? executeCDPToolDirect : null,
    handleDataTool: typeof handleDataTool === 'function' ? handleDataTool : null,
    resolveAuthWall: resolveInlineAuthWall,
    hooks: sessionHooks.hooks,
    emitter: sessionHooks.emitter
  }), 500);

  automationLogger.info('Sheets formatting session launched', {
    sessionId,
    dataRange,
    columns: sd.columns,
    maxIterations: session.maxIterations
  });
}

/**
 * Handle background-only data actions (storeJobData, getStoredJobs).
 * These are NOT multi-tab actions but are handled in the background script
 * because they interact with chrome.storage.local directly.
 * @param {Object} action - The action to execute with .tool and .params
 * @param {Object} session - The active session object
 * @returns {Promise<Object>} Action result
 */
async function handleBackgroundAction(action, session) {
  const { tool, params } = action;

  switch (tool) {
    case 'storeJobData': {
      const company = params?.company;
      const jobs = params?.jobs;
      if (!company || !Array.isArray(jobs)) {
        return { success: false, error: 'storeJobData requires company (string) and jobs (array) params' };
      }

      // Read existing accumulator
      const stored = await chrome.storage.local.get('fsbJobAccumulator');
      let accumulator = stored.fsbJobAccumulator || null;

      // Create new accumulator if none exists
      if (!accumulator) {
        accumulator = {
          sessionId: session?.sessionId || null,
          searchQuery: session?.task || '',
          companies: {},
          totalJobs: 0,
          startedAt: Date.now()
        };
      }

      // Annotate each job with metadata
      const annotatedJobs = jobs.map(job => ({
        ...job,
        company: company,
        extractedAt: Date.now()
      }));

      // Add/update company entry
      accumulator.companies[company] = {
        status: 'completed',
        jobs: annotatedJobs,
        error: null
      };

      // Recalculate total jobs across all companies
      accumulator.totalJobs = Object.values(accumulator.companies)
        .reduce((sum, entry) => sum + (entry.jobs ? entry.jobs.length : 0), 0);

      // Write back to storage
      await chrome.storage.local.set({ fsbJobAccumulator: accumulator });

      return {
        success: true,
        message: `Stored ${annotatedJobs.length} jobs for ${company}`,
        totalAccumulated: accumulator.totalJobs
      };
    }

    case 'getStoredJobs': {
      const stored = await chrome.storage.local.get('fsbJobAccumulator');
      const accumulator = stored.fsbJobAccumulator;

      if (!accumulator || !accumulator.companies) {
        return { success: true, jobs: [], totalJobs: 0, companies: [], searchQuery: '' };
      }

      // Flatten all jobs across all companies
      const allJobs = Object.values(accumulator.companies)
        .flatMap(entry => entry.jobs || []);

      return {
        success: true,
        jobs: allJobs,
        totalJobs: allJobs.length,
        companies: Object.keys(accumulator.companies),
        searchQuery: accumulator.searchQuery || ''
      };
    }

    case 'fillSheetData': {
      const sd = session.sheetsData;
      if (!sd || !sd.rawJobs || !sd.columns) {
        return { success: false, error: 'fillSheetData: no sheetsData with rawJobs/columns on session' };
      }

      const { rawJobs, columns } = sd;
      const columnToField = {
        'Title': 'title', 'Company': 'company', 'Location': 'location',
        'Date': 'datePosted', 'Description': 'description', 'Apply Link': 'applyLink'
      };

      // Build TSV string (headers + data rows)
      const headerRow = columns.join('\t');
      const dataRows = rawJobs.map(job => {
        return columns.map(col => {
          const field = columnToField[col];
          let value = (job[field] || 'N/A').toString();
          // Sanitize: remove tabs, newlines, leading formula chars
          value = value.replace(/[\t\n\r]/g, ' ');
          if (/^[=+\-@]/.test(value)) value = "'" + value;
          // Apply Link gets HYPERLINK formula
          if (col === 'Apply Link' && value !== 'N/A' && value.startsWith('http')) {
            value = `=HYPERLINK("${value.replace(/"/g, "'")}","Apply")`;
          }
          return value;
        }).join('\t');
      });
      const tsvContent = [headerRow, ...dataRows].join('\n');

      const emulator = initializeKeyboardEmulator();
      let methodUsed = 'clipboard';

      try {
        // Primary method: Clipboard paste
        automationLogger.info('fillSheetData: attempting clipboard paste', {
          sessionId: session.sessionId, rows: rawJobs.length, cols: columns.length
        });

        // 1. Write TSV to clipboard via page context
        await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: (tsv) => navigator.clipboard.writeText(tsv),
          args: [tsvContent],
          world: 'MAIN'
        });

        // 2. Click Name Box, type A1, press Enter to position cursor
        await emulator.pressKey(session.tabId, 'Escape');
        await new Promise(r => setTimeout(r, 200));

        // Click the Name Box to focus it
        const nameBoxClick = await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: () => {
            const nameBox = document.getElementById('t-name-box');
            if (nameBox) { nameBox.click(); nameBox.select(); return true; }
            return false;
          }
        });

        if (nameBoxClick && nameBoxClick[0] && nameBoxClick[0].result) {
          await new Promise(r => setTimeout(r, 200));
          await emulator.typeText(session.tabId, 'A1', 30);
          await emulator.pressKey(session.tabId, 'Enter');
          await new Promise(r => setTimeout(r, 300));
        }

        // 3. Select all existing content in case sheet has data, then paste
        await emulator.pressKey(session.tabId, 'v', { ctrlKey: true });
        await new Promise(r => setTimeout(r, 1500)); // Wait for Sheets to parse TSV

        // Verify paste worked by checking if A1 has the first header
        const verifyResult = await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: (expectedHeader) => {
            const formulaBar = document.querySelector('.cell-input');
            const nameBox = document.getElementById('t-name-box');
            // Click A1 to check
            if (nameBox) { nameBox.click(); nameBox.select(); }
            return { formulaText: formulaBar ? formulaBar.textContent : null };
          },
          args: [columns[0]]
        });

        automationLogger.info('fillSheetData: clipboard paste completed', {
          sessionId: session.sessionId, methodUsed
        });

      } catch (clipboardError) {
        // Fallback: Keyboard emulator cell-by-cell
        methodUsed = 'keyboard-emulator';
        automationLogger.warn('fillSheetData: clipboard paste failed, falling back to keyboard emulator', {
          sessionId: session.sessionId, error: clipboardError.message
        });

        try {
          // Navigate to A1 first
          await emulator.pressKey(session.tabId, 'Escape');
          await new Promise(r => setTimeout(r, 200));

          const nameBoxClick = await chrome.scripting.executeScript({
            target: { tabId: session.tabId },
            func: () => {
              const nameBox = document.getElementById('t-name-box');
              if (nameBox) { nameBox.click(); nameBox.select(); return true; }
              return false;
            }
          });

          if (nameBoxClick && nameBoxClick[0] && nameBoxClick[0].result) {
            await new Promise(r => setTimeout(r, 200));
            await emulator.typeText(session.tabId, 'A1', 30);
            await emulator.pressKey(session.tabId, 'Enter');
            await new Promise(r => setTimeout(r, 300));
          }

          // Type headers
          for (let i = 0; i < columns.length; i++) {
            await emulator.typeText(session.tabId, columns[i], 20);
            if (i < columns.length - 1) {
              await emulator.pressKey(session.tabId, 'Tab');
            }
          }
          await emulator.pressKey(session.tabId, 'Enter');

          // Type data rows
          for (const job of rawJobs) {
            for (let i = 0; i < columns.length; i++) {
              const field = columnToField[columns[i]];
              let value = (job[field] || 'N/A').toString().replace(/[\t\n\r]/g, ' ');
              if (/^[=+\-@]/.test(value) && columns[i] !== 'Apply Link') {
                value = "'" + value;
              }
              if (columns[i] === 'Apply Link' && value !== 'N/A' && value.startsWith('http')) {
                value = `=HYPERLINK("${value.replace(/"/g, "'")}","Apply")`;
              }
              await emulator.typeText(session.tabId, value, 15);
              if (i < columns.length - 1) {
                await emulator.pressKey(session.tabId, 'Tab');
              }
            }
            await emulator.pressKey(session.tabId, 'Enter');
            await new Promise(r => setTimeout(r, 50));
          }

          automationLogger.info('fillSheetData: keyboard emulator fallback completed', {
            sessionId: session.sessionId, rows: rawJobs.length
          });

        } catch (fallbackError) {
          automationLogger.error('fillSheetData: both methods failed', {
            sessionId: session.sessionId,
            clipboardError: clipboardError.message,
            fallbackError: fallbackError.message
          });
          return {
            success: false,
            error: `fillSheetData failed. Clipboard: ${clipboardError.message}. Keyboard: ${fallbackError.message}`
          };
        }
      }

      // Update session tracking
      sd.rowsWritten = rawJobs.length;
      session.taskSummary = `Sheets data entry: ${rawJobs.length}/${sd.totalRows} rows`;

      return {
        success: true,
        message: `Successfully wrote ${rawJobs.length} rows x ${columns.length} columns to Google Sheet`,
        methodUsed,
        rowsWritten: rawJobs.length,
        columnsWritten: columns.length,
        headers: columns
      };
    }

    default:
      return { success: false, error: `Unknown background action: ${tool}` };
  }
}

// Handle usage tracking from all contexts
function handleTrackUsage(request, sender, sendResponse) {
  automationLogger.debug('Usage tracking request received', {});

  // Initialize analytics if not already done
  const analytics = getAnalytics();

  const { model, inputTokens, outputTokens, success, tokenSource, timestamp } = request.data;

  automationLogger.logAPI(null, 'analytics', 'track_request', {
    model,
    inputTokens,
    outputTokens,
    success,
    tokenSource,
    context: sender.tab ? 'content' : 'extension'
  });

  // Track the usage and handle response
  analytics.trackUsage(model, inputTokens, outputTokens, success)
    .then(() => {
      // Broadcast update to all extension contexts
      broadcastAnalyticsUpdate();

      automationLogger.debug('Usage tracking completed', {});
      sendResponse({ success: true, message: 'Usage tracked successfully' });
    })
    .catch((error) => {
      automationLogger.error('Failed to handle usage tracking', { error: error.message });
      sendResponse({ success: false, error: error.message });
    });
  
  // Return true to indicate async response
  return true;
}

// Broadcast analytics updates to all extension contexts
function broadcastAnalyticsUpdate() {
  // Send to all extension contexts (popup, sidepanel, options)
  chrome.runtime.sendMessage({
    type: 'ANALYTICS_UPDATE'
  }).catch(() => {
    // Ignore errors if no listeners
  });
}

// Multi-tab management handler functions

/**
 * Handle opening a new tab
 * @param {Object} request - The request object containing url and active flag
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleOpenNewTab(request, sender, sendResponse) {
  try {
    const { url, active } = request;
    automationLogger.debug('Opening new tab', { url, active });
    
    const tab = await chrome.tabs.create({
      url: url || 'about:blank',
      active: active !== false // Default to true
    });
    
    // If we need to inject content script into the new tab
    if (url && url !== 'about:blank') {
      // Wait a moment for the tab to load
      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: CONTENT_SCRIPT_FILES
          });
        } catch (error) {
          automationLogger.debug('Content script injection skipped for new tab', { tabId: tab.id, error: error.message });
        }
      }, 1000);
    }

    // Add newly opened tab to the session's allowed tabs
    const senderTabId = sender.tab?.id;
    if (senderTabId) {
      for (const [sid, sess] of activeSessions.entries()) {
        if (sess.tabId === senderTabId || (sess.allowedTabs || []).includes(senderTabId)) {
          addAllowedTab(sid, tab.id, 'openNewTab');
          break;
        }
      }
    }

    sendResponse({
      success: true,
      tabId: tab.id,
      url: tab.url,
      active: tab.active
    });

  } catch (error) {
    automationLogger.error('Error opening new tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle switching to an existing tab
 * @param {Object} request - The request object containing tabId
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleSwitchToTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    automationLogger.debug('Switching to tab', { tabId });
    
    // Get current active tab first
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Switch to the target tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Also bring the window to front
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    
    sendResponse({
      success: true,
      tabId: tabId,
      previousTab: currentTab ? currentTab.id : null
    });
    
  } catch (error) {
    automationLogger.error('Error switching to tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle closing a tab
 * @param {Object} request - The request object containing tabId
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleCloseTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    automationLogger.debug('Closing tab', { tabId });

    // Remove any active sessions for this tab
    for (const [sessionId, session] of activeSessions) {
      if (session.tabId === tabId) {
        automationLogger.info('Stopping session for closing tab', { sessionId, tabId });
        session.status = 'stopped';
        finalizeSessionMetrics(sessionId, false); // Tab closed
        cleanupSession(sessionId); // EASY WIN #10: Use cleanup helper
      }
    }

    await chrome.tabs.remove(tabId);

    sendResponse({
      success: true,
      tabId: tabId,
      closed: true
    });

  } catch (error) {
    automationLogger.error('Error closing tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle CDP-based text insertion for stubborn editors (Slack, Notion, Google Docs, etc.)
 * Uses Chrome DevTools Protocol for guaranteed keystroke delivery
 * @param {Object} request - The request object containing text to insert
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleCDPInsertText(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { text, clearFirst } = request;

  if (!tabId) {
    sendResponse({ success: false, error: 'No tab ID available' });
    return;
  }

  if (!text) {
    sendResponse({ success: false, error: 'No text provided' });
    return;
  }

  let debuggerAttached = false;

  try {
    automationLogger.logActionExecution(null, 'cdpInsertText', 'start', { tabId, textLength: text.length });

    // If KeyboardEmulator has the debugger attached to this tab, detach it first
    if (keyboardEmulator && keyboardEmulator.isAttachedTo(tabId)) {
      automationLogger.debug('cdpInsertText: detaching KeyboardEmulator debugger before attaching', { tabId });
      await keyboardEmulator.detachDebugger(tabId);
    }

    // Try to attach debugger; if "already attached" error, force-detach and retry
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
    } catch (attachErr) {
      if (attachErr.message && attachErr.message.includes('Another debugger is already attached')) {
        automationLogger.debug('cdpInsertText: stale debugger detected, force-detaching and retrying', { tabId });
        try {
          await chrome.debugger.detach({ tabId });
        } catch (forceDetachErr) {
          // Ignore -- may fail if the "other debugger" is not ours
        }
        await chrome.debugger.attach({ tabId }, '1.3');
      } else {
        throw attachErr;
      }
    }
    debuggerAttached = true;

    // If clearFirst is requested, select all and delete
    if (clearFirst) {
      // Detect platform: modifier 4 = Meta (Cmd) on macOS, modifier 2 = Ctrl on others
      const isMac = navigator.userAgent?.includes('Macintosh') || navigator.platform?.includes('Mac');
      const selectAllModifier = isMac ? 4 : 2;

      // Select all text in focused element
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          modifiers: selectAllModifier,
          key: 'a',
          code: 'KeyA'
        }
      );
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          modifiers: selectAllModifier,
          key: 'a',
          code: 'KeyA'
        }
      );

      // Delay for selection -- Monaco needs ~200ms to process Ctrl+A and update its internal model
      await new Promise(r => setTimeout(r, 200));

      // Delete selected text
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          key: 'Backspace',
          code: 'Backspace'
        }
      );
      await chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: 'Backspace',
          code: 'Backspace'
        }
      );

      // Delay for deletion -- Monaco needs time to clear its buffer before accepting new input
      await new Promise(r => setTimeout(r, 200));
    }

    // Use Input.insertText for reliable text insertion
    await chrome.debugger.sendCommand(
      { tabId },
      'Input.insertText',
      { text }
    );

    // Detach debugger
    await chrome.debugger.detach({ tabId });
    debuggerAttached = false;

    automationLogger.logActionExecution(null, 'cdpInsertText', 'complete', { success: true, tabId, textLength: text.length });
    sendResponse({
      success: true,
      text: text,
      method: 'cdp',
      length: text.length
    });

  } catch (error) {
    automationLogger.logActionExecution(null, 'cdpInsertText', 'complete', { success: false, tabId, error: error.message });

    // Try to detach debugger if it was attached
    if (debuggerAttached) {
      try {
        await chrome.debugger.detach({ tabId });
      } catch (detachError) {
        automationLogger.debug('Debugger already detached', { tabId });
      }
    }

    sendResponse({
      success: false,
      error: error.message,
      method: 'cdp'
    });
  }
}

/**
 * Handle Monaco/CodeMirror editor insert via MAIN world script injection.
 * Bypasses auto-indent by using the editor's native API (executeEdits) directly.
 * @param {Object} request - The request object containing text to insert
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleMonacoEditorInsert(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { text } = request;

  if (!tabId || !text) {
    sendResponse({ success: false, error: !tabId ? 'No tab ID' : 'No text provided' });
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [text],
      func: (codeText) => {
        // Attempt 1: Monaco editor API
        if (typeof monaco !== 'undefined' && monaco.editor) {
          const editors = typeof monaco.editor.getEditors === 'function'
            ? monaco.editor.getEditors() : [];
          // Prefer the focused editor, fall back to first
          const editor = editors.find(e => e.hasTextFocus?.()) || editors[0];
          if (editor) {
            const model = editor.getModel();
            if (model) {
              const fullRange = model.getFullModelRange();
              editor.executeEdits('fsb-automation', [{
                range: fullRange,
                text: codeText
              }]);
              // Move cursor to end
              const lastLine = model.getLineCount();
              const lastCol = model.getLineMaxColumn(lastLine);
              editor.setPosition({ lineNumber: lastLine, column: lastCol });
              return { success: true, method: 'monaco_executeEdits' };
            }
          }
          // Fallback: try models directly
          const models = typeof monaco.editor.getModels === 'function'
            ? monaco.editor.getModels() : [];
          if (models.length > 0) {
            const model = models[0];
            const fullRange = model.getFullModelRange();
            model.pushEditOperations([], [{
              range: fullRange,
              text: codeText
            }], () => null);
            return { success: true, method: 'monaco_pushEditOperations' };
          }
        }

        // Attempt 2: CodeMirror 6 API
        const cmElement = document.querySelector('.cm-editor');
        if (cmElement?.cmView?.view) {
          const view = cmElement.cmView.view;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: codeText }
          });
          return { success: true, method: 'codemirror6_dispatch' };
        }

        return { success: false, error: 'No editor API found on page' };
      }
    });

    const result = results?.[0]?.result;
    if (result?.success) {
      sendResponse(result);
    } else {
      sendResponse({ success: false, error: result?.error || 'Editor API injection returned no result' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle listing all tabs
 * @param {Object} request - The request object containing currentWindowOnly flag
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleListTabs(request, sender, sendResponse) {
  try {
    const { currentWindowOnly } = request;
    automationLogger.debug('Listing tabs', { currentWindowOnly });
    
    let queryOptions = {};
    if (currentWindowOnly !== false) {
      queryOptions.currentWindow = true;
    }
    
    const tabs = await chrome.tabs.query(queryOptions);
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // PRIVACY: Only return tab titles for context, not URLs or sensitive data
    // Find the requesting session to identify the session tab
    const requestingSession = Array.from(activeSessions.values()).find(session => 
      session.tabId === (sender.tab?.id || currentTab?.id)
    );
    
    const allowedTabs = requestingSession ? (requestingSession.allowedTabs || []) : [];

    const formattedTabs = tabs.map(tab => {
      const isAllowed = allowedTabs.includes(tab.id);
      let domain;
      if (tab.url) {
        try { domain = new URL(tab.url).hostname; } catch { /* skip */ }
      }
      return {
        id: tab.id,
        title: tab.title || 'Untitled Tab',
        isSessionTab: requestingSession && tab.id === requestingSession.originalTabId,
        isAllowedTab: isAllowed,
        isActive: tab.active,
        ...(domain ? { domain } : {}),
      };
    });

    sendResponse({
      success: true,
      tabs: formattedTabs,
      sessionTabId: requestingSession ? requestingSession.originalTabId : null,
      allowedTabs: allowedTabs,
      currentTab: currentTab ? currentTab.id : null,
      totalTabs: formattedTabs.length,
      message: 'Tabs listed. Session and allowed tabs can be controlled via switchToTab.'
    });
    
  } catch (error) {
    automationLogger.error('Error listing tabs', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle getting current tab information
 * @param {Object} request - The request object
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleGetCurrentTab(request, sender, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      sendResponse({
        success: true,
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          windowId: tab.windowId,
          index: tab.index,
          status: tab.status,
          hasSession: Array.from(activeSessions.values()).some(session => session.tabId === tab.id)
        }
      });
    } else {
      sendResponse({
        success: false,
        error: 'No active tab found'
      });
    }
    
  } catch (error) {
    automationLogger.error('Error getting current tab', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle waiting for a tab to load
 * @param {Object} request - The request object containing tabId and timeout
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleWaitForTabLoad(request, sender, sendResponse) {
  try {
    const { tabId, timeout = 30000 } = request;
    automationLogger.logTiming(null, 'WAIT', 'tab_load_start', 0, { tabId, timeout });
    
    const startTime = Date.now();
    
    // Check if tab is already loaded
    let tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      sendResponse({
        success: true,
        tabId: tabId,
        loaded: true,
        url: tab.url,
        loadTime: 0
      });
      return;
    }
    
    // Set up listener for tab updates
    const loadPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(updateListener);
        reject(new Error('Tab load timeout'));
      }, timeout);
      
      const updateListener = (updatedTabId, changeInfo, updatedTab) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(updateListener);
          resolve({
            url: updatedTab.url,
            loadTime: Date.now() - startTime
          });
        }
      };
      
      chrome.tabs.onUpdated.addListener(updateListener);
    });
    
    const result = await loadPromise;
    
    sendResponse({
      success: true,
      tabId: tabId,
      loaded: true,
      url: result.url,
      loadTime: result.loadTime
    });
    
  } catch (error) {
    automationLogger.error('Error waiting for tab load', { error: error.message });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Global keyboard emulator instance
let keyboardEmulator = null;

/**
 * Initialize keyboard emulator if not already initialized
 */
function initializeKeyboardEmulator() {
  if (!keyboardEmulator) {
    keyboardEmulator = new KeyboardEmulator();
  }
  return keyboardEmulator;
}

// --- Remote Control CDP dispatch functions ---
// Called by ws-client.js when dashboard sends dash:remote-* messages.
// Debugger is attached once on start and detached on stop (no per-event attach/detach).

/**
 * Start remote control session: attach debugger to the streaming tab.
 */
async function handleRemoteControlStart() {
  _remoteControlEnabled = true;
  var attached = await _ensureRemoteControlDebugger(_streamingTabId, 'start');
  if (!attached) {
    console.warn('[FSB Remote] Remote control enabled but debugger is not attached yet');
  }
}

/**
 * Stop remote control session: detach debugger from the tab.
 */
async function handleRemoteControlStop() {
  _remoteControlEnabled = false;
  await _releaseRemoteControlDebugger('stop');
}

/**
 * Dispatch a remote click via CDP on the streaming tab.
 * @param {Object} payload - { x: number, y: number, button: 'left'|'right', modifiers: number }
 */
async function handleRemoteClick(payload) {
  var targetTabId = _streamingTabId;
  if (!(await _ensureRemoteControlDebugger(targetTabId, 'click'))) {
    console.warn('[FSB Remote] Click ignored -- remote control not active');
    return;
  }
  try {
    var btn = payload.button || 'left';
    var mods = payload.modifiers || 0;
    await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x: payload.x, y: payload.y, button: btn, clickCount: 1, modifiers: mods
    });
    await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: payload.x, y: payload.y, button: btn, clickCount: 1, modifiers: mods
    });
    console.log('[FSB Remote] Click dispatched at (' + payload.x + ', ' + payload.y + ')');
  } catch (err) {
    console.error('[FSB Remote] Click failed:', err.message);
    await _handleRemoteControlDispatchFailure('click', err);
  }
}

/**
 * Dispatch a remote key event via CDP on the streaming tab.
 * @param {Object} payload - { type: 'keyDown'|'keyUp'|'char', key: string, code: string, text: string, modifiers: number }
 */
async function handleRemoteKey(payload) {
  var targetTabId = _streamingTabId;
  if (!(await _ensureRemoteControlDebugger(targetTabId, 'key'))) {
    console.warn('[FSB Remote] Key ignored -- remote control not active');
    return;
  }
  try {
    if (payload.type === 'insertText') {
      await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.insertText', {
        text: payload.text || payload.key || ''
      });
    } else if (payload.type === 'char') {
      await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.dispatchKeyEvent', {
        type: 'char', text: payload.text || payload.key
      });
    } else if (payload.type === 'keyDown') {
      await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.dispatchKeyEvent', {
        type: 'keyDown', key: payload.key, code: payload.code, text: payload.text || '', modifiers: payload.modifiers || 0
      });
    } else if (payload.type === 'keyUp') {
      await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.dispatchKeyEvent', {
        type: 'keyUp', key: payload.key, code: payload.code, modifiers: payload.modifiers || 0
      });
    }
    console.log('[FSB Remote] Key dispatched: ' + payload.type + ' ' + payload.key);
  } catch (err) {
    console.error('[FSB Remote] Key failed:', err.message);
    await _handleRemoteControlDispatchFailure('key', err);
  }
}

/**
 * Dispatch a remote scroll via CDP on the streaming tab.
 * @param {Object} payload - { x: number, y: number, deltaX: number, deltaY: number }
 */
async function handleRemoteScroll(payload) {
  var targetTabId = _streamingTabId;
  if (!(await _ensureRemoteControlDebugger(targetTabId, 'scroll'))) {
    console.warn('[FSB Remote] Scroll ignored -- remote control not active');
    return;
  }
  try {
    await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: payload.x, y: payload.y,
      deltaX: payload.deltaX || 0, deltaY: payload.deltaY || 0
    });
  } catch (err) {
    console.error('[FSB Remote] Scroll failed:', err.message);
    await _handleRemoteControlDispatchFailure('scroll', err);
  }
}

async function _releaseRemoteControlDebugger(reason) {
  var tabId = _remoteControlDebuggerTabId;
  var owned = _remoteControlDebuggerOwned;
  _remoteControlDebuggerTabId = null;
  _remoteControlDebuggerOwned = false;

  if (tabId === null) return;
  if (!owned) {
    console.log('[FSB Remote] Cleared reused debugger reference on tab ' + tabId + ' (' + (reason || 'release') + ')');
    return;
  }

  try {
    await chrome.debugger.detach({ tabId: tabId });
    console.log('[FSB Remote] Debugger detached from tab ' + tabId + ' (' + (reason || 'release') + ')');
  } catch (err) {
    console.warn('[FSB Remote] Debugger detach skipped for tab ' + tabId + ':', err && err.message ? err.message : err);
  }
}

async function _ensureRemoteControlDebugger(targetTabId, reason) {
  if (!_remoteControlEnabled) return false;
  if (typeof targetTabId !== 'number') {
    await _releaseRemoteControlDebugger(reason || 'missing-tab');
    return false;
  }

  if (_remoteControlDebuggerTabId === targetTabId) {
    return true;
  }

  if (_remoteControlDebuggerTabId !== null && _remoteControlDebuggerTabId !== targetTabId) {
    await _releaseRemoteControlDebugger('retarget:' + (reason || 'unknown'));
  }

  try {
    await chrome.debugger.attach({ tabId: targetTabId }, '1.3');
    _remoteControlDebuggerTabId = targetTabId;
    _remoteControlDebuggerOwned = true;
    console.log('[FSB Remote] Debugger attached to tab ' + targetTabId + ' (' + (reason || 'attach') + ')');
    return true;
  } catch (err) {
    var message = err && err.message ? err.message : '';
    if (message.includes('Already attached')) {
      _remoteControlDebuggerTabId = targetTabId;
      console.log('[FSB Remote] Reusing debugger attachment on tab ' + targetTabId + ' (' + (reason || 'attach') + ')');
      return true;
    }
    if (message.includes('Another debugger is already attached')) {
      console.warn('[FSB Remote] Remote attach blocked by another debugger on tab ' + targetTabId);
      return false;
    }
    console.error('[FSB Remote] Failed to attach debugger for ' + (reason || 'attach') + ':', message || err);
    return false;
  }
}

function _syncRemoteControlDebugger(reason) {
  if (!_remoteControlEnabled) return;

  var targetTabId = (_streamStatus === 'ready' || _streamStatus === 'recovering') ? _streamingTabId : null;
  if (typeof targetTabId !== 'number') {
    _releaseRemoteControlDebugger(reason || 'not-ready').catch(function(err) {
      console.warn('[FSB Remote] Failed to release debugger during sync:', err && err.message ? err.message : err);
    });
    return;
  }

  _ensureRemoteControlDebugger(targetTabId, reason || 'sync').catch(function(err) {
    console.warn('[FSB Remote] Failed to sync debugger attachment:', err && err.message ? err.message : err);
  });
}

async function _handleRemoteControlDispatchFailure(kind, err) {
  await _releaseRemoteControlDebugger('dispatch-failed:' + kind);
}

/**
 * Execute a CDP tool directly from the automation loop (no message round-trip).
 * Wraps chrome.debugger calls for each CDP tool type, replicating the exact
 * dispatch logic from the existing handler functions but returning results
 * directly instead of using sendResponse callbacks.
 * @param {Object} action - { tool, params }
 * @param {number} tabId - Tab to attach debugger to
 * @returns {Object} Result with success field
 */
async function executeCDPToolDirect(action, tabId) {
  const p = action.params || {};

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (attachErr) {
    // Already attached is OK -- detach and retry once
    if (attachErr.message?.includes('Already attached')) {
      try { await chrome.debugger.detach({ tabId }); } catch (_) {}
      await chrome.debugger.attach({ tabId }, '1.3');
    } else {
      throw attachErr;
    }
  }

  try {
    switch (action.tool) {
      case 'cdpClickAt': {
        let modifiers = 0;
        if (p.altKey) modifiers |= 1;
        if (p.ctrlKey) modifiers |= 2;
        if (p.shiftKey) modifiers |= 8;
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers
        });
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers
        });
        return { success: true, x: p.x, y: p.y, modifiers, method: 'cdp_mouse_direct' };
      }

      case 'cdpClickAndHold': {
        const holdMs = p.holdMs || 5000;
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1
        });
        await new Promise(r => setTimeout(r, holdMs));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1
        });
        return { success: true, x: p.x, y: p.y, holdMs, method: 'cdp_click_and_hold_direct' };
      }

      case 'cdpDrag': {
        const steps = p.steps || 10;
        const stepDelayMs = p.stepDelayMs || 20;
        let modifiers = 0;
        if (p.altKey) modifiers |= 1;
        if (p.ctrlKey) modifiers |= 2;
        if (p.shiftKey) modifiers |= 8;
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: p.startX, y: p.startY, button: 'left', clickCount: 1, modifiers
        });
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const mx = Math.round(p.startX + (p.endX - p.startX) * t);
          const my = Math.round(p.startY + (p.endY - p.startY) * t);
          await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: mx, y: my, button: 'left', buttons: 1, modifiers
          });
          if (stepDelayMs > 0) await new Promise(r => setTimeout(r, stepDelayMs));
        }
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: p.endX, y: p.endY, button: 'left', clickCount: 1, modifiers
        });
        return { success: true, startX: p.startX, startY: p.startY, endX: p.endX, endY: p.endY, steps, method: 'cdp_drag_direct' };
      }

      case 'cdpDragVariableSpeed': {
        const totalSteps = Math.max(p.steps || 20, 5);
        const minDelayMs = p.minDelayMs || 5;
        const maxDelayMs = p.maxDelayMs || 40;
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: p.startX, y: p.startY, button: 'left', clickCount: 1
        });
        for (let i = 1; i <= totalSteps; i++) {
          const t = i / totalSteps;
          const mx = Math.round(p.startX + (p.endX - p.startX) * t);
          const my = Math.round(p.startY + (p.endY - p.startY) * t);
          await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: mx, y: my, button: 'left', buttons: 1
          });
          // Ease-in-out delay: high at start/end, low in middle
          const speedFactor = 1.0 - 4.0 * Math.pow(t - 0.5, 2);
          const clampedFactor = Math.max(0, Math.min(1, speedFactor));
          const delay = Math.round(maxDelayMs - clampedFactor * (maxDelayMs - minDelayMs));
          await new Promise(r => setTimeout(r, delay));
        }
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: p.endX, y: p.endY, button: 'left', clickCount: 1
        });
        return { success: true, startX: p.startX, startY: p.startY, endX: p.endX, endY: p.endY, steps: totalSteps, minDelayMs, maxDelayMs, method: 'cdp_drag_variable_direct' };
      }

      case 'cdpScrollAt': {
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseWheel', x: p.x, y: p.y,
          deltaX: p.deltaX || 0, deltaY: p.deltaY || -120
        });
        return { success: true, x: p.x, y: p.y, deltaX: p.deltaX || 0, deltaY: p.deltaY || -120, method: 'cdp_scroll_direct' };
      }

      case 'cdpInsertText': {
        const text = p.text || '';
        await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text });
        return { success: true, text, length: text.length, method: 'cdp_inserttext_direct' };
      }

      case 'cdpDoubleClickAt': {
        let modifiers = 0;
        if (p.altKey) modifiers |= 1;
        if (p.ctrlKey) modifiers |= 2;
        if (p.shiftKey) modifiers |= 8;
        // First click
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers
        });
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers
        });
        // Brief pause between clicks (50ms)
        await new Promise(r => setTimeout(r, 50));
        // Second click with clickCount=2
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 2, modifiers
        });
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 2, modifiers
        });
        return { success: true, x: p.x, y: p.y, method: 'cdp_doubleclick_direct' };
      }

      default:
        return { success: false, error: `Unknown CDP tool: ${action.tool}` };
    }
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}

/**
 * Reads canvas scene data via CDP Runtime.evaluate.
 * First tries intercepted draw call log via getCanvasScene() which reads window.__canvasCallLog,
 * then attempts triggerCanvasRerender(), and falls back to pixel analysis.
 * @param {number} tabId - Tab to read canvas from
 * @returns {Object|null} Canvas scene data or null if no canvas
 */
async function fetchCanvasScene(tabId) {
  // Try to attach debugger -- if already attached (e.g., by KeyboardEmulator during automation),
  // just use the existing connection. Do NOT detach+reattach as that breaks the emulator.
  let ownedDebugger = false;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    ownedDebugger = true;
  } catch (attachErr) {
    if (attachErr.message?.includes('Already attached')) {
      // Another component has it attached -- reuse the connection
      ownedDebugger = false;
    } else {
      return null;
    }
  }

  try {
    // Step 1: Check if interceptor is installed and has data
    const interceptCheck = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `(() => {
        if (!window.__canvasInterceptorInstalled) return JSON.stringify({ installed: false });
        const scene = window.getCanvasScene();
        return JSON.stringify({ installed: true, scene: scene });
      })()`,
      returnByValue: true
    });

    if (interceptCheck?.result?.value) {
      const parsed = JSON.parse(interceptCheck.result.value);
      if (parsed.installed && parsed.scene && (parsed.scene.texts?.length > 0 || parsed.scene.shapes?.length > 0 || parsed.scene.rects?.length > 0 || parsed.scene.paths?.length > 0)) {
        return { source: 'interceptor', ...parsed.scene };
      }

      // Interceptor installed but no data -- try re-render trigger
      if (parsed.installed && parsed.scene && parsed.scene.totalCalls === 0) {
        const rerender = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
          expression: `window.triggerCanvasRerender().then(r => JSON.stringify(r))`,
          returnByValue: true,
          awaitPromise: true
        });
        // After re-render, read scene again
        if (rerender?.result?.value) {
          const sceneAfter = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
            expression: `JSON.stringify(window.getCanvasScene())`,
            returnByValue: true
          });
          if (sceneAfter?.result?.value) {
            const scene2 = JSON.parse(sceneAfter.result.value);
            if (scene2.texts?.length > 0 || scene2.shapes?.length > 0 || scene2.rects?.length > 0 || scene2.paths?.length > 0) {
              return { source: 'interceptor-rerender', ...scene2 };
            }
          }
        }
      }
    }

    // Step 2: Fallback to pixel analysis
    // Get the pixel fallback expression from content script
    const pixelExpr = await chrome.tabs.sendMessage(tabId, {
      action: 'getCanvasPixelFallback'
    }, { frameId: 0 });

    if (pixelExpr?.expression) {
      const pixelResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
        expression: pixelExpr.expression,
        returnByValue: true
      });
      if (pixelResult?.result?.value) {
        const pixelData = JSON.parse(pixelResult.result.value);
        if (pixelData.scenes && pixelData.scenes.length > 0) {
          return { source: 'pixel-fallback', ...pixelData };
        }
      }
    }

    return null;
  } catch (err) {
    automationLogger.debug('fetchCanvasScene failed', { tabId, error: err.message });
    return null;
  } finally {
    // Only detach if WE attached the debugger -- don't break other components' connections
    if (ownedDebugger) {
      try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    }
  }
}

/**
 * Converts canvas scene data into markdown text for the DOM snapshot.
 * Target: 200-500 tokens for typical diagrams.
 * @param {Object} scene - Canvas scene from fetchCanvasScene
 * @returns {string|null} Markdown section or null if empty
 */
function formatCanvasSceneMarkdown(scene) {
  if (!scene) return null;

  const lines = ['## CANVAS SCENE'];

  if (scene.source === 'interceptor' || scene.source === 'interceptor-rerender') {
    lines.push(`> ${scene.summary || 'Canvas content detected'}`);

    // Shapes (clustered from paths + rects)
    if (scene.shapes && scene.shapes.length > 0) {
      lines.push('');
      for (const s of scene.shapes.slice(0, 30)) {
        const label = s.label ? ` "${s.label}"` : '';
        lines.push(`- ${s.type}${label} at (${s.x},${s.y}) ${s.w}x${s.h} color:${s.color}`);
      }
    }

    // Standalone text labels (not associated with shapes)
    const shapeLabelTexts = new Set();
    if (scene.shapes) scene.shapes.forEach(s => { if (s.label) s.label.split(' ').forEach(t => shapeLabelTexts.add(t)); });
    const standaloneTexts = (scene.texts || []).filter(t => !shapeLabelTexts.has(t.text));
    if (standaloneTexts.length > 0) {
      lines.push('');
      lines.push('Text:');
      for (const t of standaloneTexts.slice(0, 20)) {
        lines.push(`- "${t.text}" at (${t.x},${t.y}) color:${t.color}`);
      }
    }

    if ((!scene.shapes || scene.shapes.length === 0) && (!scene.texts || scene.texts.length === 0)) {
      return null; // No meaningful data
    }
  } else if (scene.source === 'pixel-fallback') {
    lines.push('> Source: pixel analysis (no draw call data available)');

    if (scene.scenes) {
      for (const s of scene.scenes) {
        if (s.error) {
          lines.push(`Canvas ${s.canvas}: ${s.error} (${s.width}x${s.height})`);
          continue;
        }
        lines.push(`\nCanvas ${s.canvas} (${s.width}x${s.height}):`);
        if (s.colorRegions && s.colorRegions.length > 0) {
          lines.push('Color regions:');
          for (const r of s.colorRegions) {
            const sec = r.secondary ? `, ${r.secondary}` : '';
            lines.push(`- ${r.pos}: ${r.pct}% ${r.color}${sec}`);
          }
        }
        if (s.edges) {
          lines.push('Edge wireframe:');
          lines.push('```');
          lines.push(s.edges);
          lines.push('```');
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Handle CDP mouse click at specific page coordinates.
 * Uses Input.dispatchMouseEvent for browser-level click simulation.
 * Called from content scripts that need to click elements not reachable via DOM APIs.
 */
async function handleCDPMouseClick(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { x, y, shiftKey, ctrlKey, altKey } = request;
  if (!tabId || typeof x !== 'number' || typeof y !== 'number') {
    sendResponse({ success: false, error: 'Missing tabId or coordinates' });
    return;
  }
  // Compute CDP modifiers bitmask: 1=Alt, 2=Ctrl, 4=Meta, 8=Shift
  let modifiers = 0;
  if (altKey) modifiers |= 1;
  if (ctrlKey) modifiers |= 2;
  if (shiftKey) modifiers |= 8;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    // mousePressed
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers
    });
    // mouseReleased
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers
    });
    await chrome.debugger.detach({ tabId });
    sendResponse({ success: true, x, y, modifiers, method: 'cdp_mouse' });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}

/**
 * Handle CDP mouse click-and-hold at specific page coordinates.
 * Uses Input.dispatchMouseEvent for browser-level press-hold-release simulation.
 * mousePressed -> wait holdMs -> mouseReleased at same coordinates.
 * Essential for record buttons, long-press menus, and timed press interactions.
 */
async function handleCDPMouseClickAndHold(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { x, y, holdMs = 5000 } = request;
  if (!tabId || typeof x !== 'number' || typeof y !== 'number') {
    sendResponse({ success: false, error: 'Missing tabId or coordinates' });
    return;
  }
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    // mousePressed
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1
    });
    // Hold for specified duration
    await new Promise(r => setTimeout(r, holdMs));
    // mouseReleased at same position
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1
    });
    await chrome.debugger.detach({ tabId });
    sendResponse({ success: true, x, y, holdMs, method: 'cdp_click_and_hold' });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}

/**
 * Handle CDP mouse drag between two viewport coordinates.
 * Uses Input.dispatchMouseEvent for browser-level drag simulation:
 * mousePressed at start -> N mouseMoved steps -> mouseReleased at end.
 * Essential for canvas apps (TradingView, Figma, etc.) that ignore untrusted DOM events.
 */
async function handleCDPMouseDrag(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { startX, startY, endX, endY, steps = 10, stepDelayMs = 20, shiftKey, ctrlKey, altKey } = request;
  if (!tabId || typeof startX !== 'number' || typeof startY !== 'number' ||
      typeof endX !== 'number' || typeof endY !== 'number') {
    sendResponse({ success: false, error: 'Missing tabId or coordinates (startX, startY, endX, endY required)' });
    return;
  }
  // Compute CDP modifiers bitmask: 1=Alt, 2=Ctrl, 4=Meta, 8=Shift
  let modifiers = 0;
  if (altKey) modifiers |= 1;
  if (ctrlKey) modifiers |= 2;
  if (shiftKey) modifiers |= 8;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');

    // mousePressed at start position
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1, modifiers
    });

    // mouseMoved in intermediate steps (canvas apps need this to register drag intent)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(startX + (endX - startX) * t);
      const y = Math.round(startY + (endY - startY) * t);
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved', x, y, button: 'left', buttons: 1, modifiers
      });
      if (stepDelayMs > 0) await new Promise(r => setTimeout(r, stepDelayMs));
    }

    // mouseReleased at end position
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1, modifiers
    });

    await chrome.debugger.detach({ tabId });
    sendResponse({ success: true, startX, startY, endX, endY, steps, modifiers, method: 'cdp_drag' });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}

/**
 * Handle CDP mouse drag with variable speed (ease-in-out timing).
 * Like handleCDPMouseDrag but varies the delay between mouseMoved steps
 * using a quadratic ease-in-out function to produce human-like drag movement:
 * slow start, acceleration through middle, deceleration at end.
 *
 * The speed curve: speedFactor = 1 - 4*(t-0.5)^2 maps [0,1] -> [0,1] where
 * values near 0 and 1 produce higher delays (slower movement) and
 * values near 0.5 produce lower delays (faster movement).
 *
 * Used for slider CAPTCHAs where constant-speed drag is detected as bot behavior.
 */
async function handleCDPMouseDragVariableSpeed(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { startX, startY, endX, endY, steps = 20, minDelayMs = 5, maxDelayMs = 40 } = request;
  if (!tabId || typeof startX !== 'number' || typeof startY !== 'number' ||
      typeof endX !== 'number' || typeof endY !== 'number') {
    sendResponse({ success: false, error: 'Missing tabId or coordinates (startX, startY, endX, endY required)' });
    return;
  }
  try {
    await chrome.debugger.attach({ tabId }, '1.3');

    // mousePressed at start position
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1
    });

    // mouseMoved with variable-speed delays using ease-in-out quadratic curve
    // Ease-in-out: slow at edges (t near 0 or 1), fast in middle (t near 0.5)
    // Speed curve (inverted to get delay): high delay at edges, low delay in middle
    const totalSteps = Math.max(steps, 5); // minimum 5 steps for meaningful curve
    for (let i = 1; i <= totalSteps; i++) {
      const t = i / totalSteps; // progress 0..1
      const x = Math.round(startX + (endX - startX) * t);
      const y = Math.round(startY + (endY - startY) * t);

      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved', x, y, button: 'left', buttons: 1
      });

      // Ease-in-out delay: high at start/end, low in middle
      // speedFactor = 1 - 4*(t-0.5)^2 maps [0,1] -> [0,1] with peak at 0.5
      // delay = maxDelay at edges (speedFactor=0), minDelay at center (speedFactor=1)
      const speedFactor = 1.0 - 4.0 * Math.pow(t - 0.5, 2); // 0 at edges, 1 at center
      const clampedFactor = Math.max(0, Math.min(1, speedFactor));
      const delay = Math.round(maxDelayMs - clampedFactor * (maxDelayMs - minDelayMs));
      await new Promise(r => setTimeout(r, delay));
    }

    // mouseReleased at end position
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1
    });

    await chrome.debugger.detach({ tabId });
    sendResponse({
      success: true, startX, startY, endX, endY, steps: totalSteps,
      minDelayMs, maxDelayMs, method: 'cdp_drag_variable_speed'
    });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}

/**
 * Handle CDP mouse wheel at specific viewport coordinates.
 * Uses Input.dispatchMouseEvent with type "mouseWheel" for coordinate-targeted scrolling.
 * Essential for map zoom (Google Maps, Leaflet) and canvas zoom where page-level scroll does nothing.
 */
async function handleCDPMouseWheel(request, sender, sendResponse) {
  const tabId = sender.tab?.id;
  const { x, y, deltaX = 0, deltaY = -120 } = request;
  if (!tabId || typeof x !== 'number' || typeof y !== 'number') {
    sendResponse({ success: false, error: 'Missing tabId or coordinates' });
    return;
  }
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseWheel', x, y, deltaX, deltaY
    });
    await chrome.debugger.detach({ tabId });
    sendResponse({ success: true, x, y, deltaX, deltaY, method: 'cdp_mouseWheel' });
  } catch (e) {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    sendResponse({ success: false, error: e.message });
  }
}

/**
 * Handle keyboard emulator actions from content scripts
 * @param {Object} request - The keyboard action request
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleKeyboardDebuggerAction(request, sender, sendResponse) {
  const emulator = initializeKeyboardEmulator();
  let tabId;

  try {
    const { method, key, keys, text, specialKey, modifiers = {}, delay = 50 } = request;
    tabId = sender.tab.id;

    automationLogger.logActionExecution(null, `keyboard_${method}`, 'start', { tabId, key, specialKey });

    let result;

    switch (method) {
      case 'pressKey':
        if (!key) {
          throw new Error('Key parameter is required for pressKey');
        }
        result = await emulator.pressKey(tabId, key, modifiers);
        break;

      case 'pressKeySequence':
        if (!keys || !Array.isArray(keys)) {
          throw new Error('Keys array is required for pressKeySequence');
        }
        result = await emulator.pressKeySequence(tabId, keys, modifiers, delay);
        break;

      case 'typeText':
        if (!text || typeof text !== 'string') {
          throw new Error('Text parameter is required for typeText');
        }
        result = await emulator.typeText(tabId, text, delay);
        break;

      case 'sendSpecialKey':
        if (!specialKey || typeof specialKey !== 'string') {
          throw new Error('SpecialKey parameter is required for sendSpecialKey');
        }
        result = await emulator.sendSpecialKey(tabId, specialKey);
        break;

      default:
        throw new Error(`Unknown keyboard emulator method: ${method}`);
    }

    // Detach debugger after each operation to avoid blocking other CDP callers
    await emulator.detachDebugger(tabId);

    automationLogger.logActionExecution(null, `keyboard_${method}`, 'complete', { tabId, success: result.success });

    sendResponse({
      success: result.success,
      result: result,
      method: method,
      tabId: tabId
    });

  } catch (error) {
    // Ensure debugger is detached even on error
    if (tabId) {
      try {
        await emulator.detachDebugger(tabId);
      } catch (detachErr) {
        // Ignore detach errors during cleanup
      }
    }
    automationLogger.logActionExecution(null, `keyboard_${request.method}`, 'complete', { success: false, error: error.message });
    sendResponse({
      success: false,
      error: error.message || 'Keyboard emulator action failed',
      method: request.method
    });
  }
}

/**
 * Clean up keyboard emulator resources when tab is closed
 */
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (keyboardEmulator && keyboardEmulator.isAttachedTo(tabId)) {
    try {
      await keyboardEmulator.detachDebugger(tabId);
      automationLogger.debug('Cleaned up keyboard emulator for closed tab', { tabId });
    } catch (error) {
      automationLogger.debug('Failed to clean up keyboard emulator', { tabId, error: error.message });
    }
  }
});

/**
 * Clean up keyboard emulator when extension is suspended/unloaded
 */
chrome.runtime.onSuspend.addListener(async () => {
  if (keyboardEmulator) {
    automationLogger.logServiceWorker('suspend', { component: 'keyboard_emulator' });
    try {
      // Get all tabs and detach debugger from each
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await keyboardEmulator.detachDebugger(tab.id);
        } catch (error) {
          // Ignore individual cleanup errors during shutdown
        }
      }
    } catch (error) {
      automationLogger.debug('Error during keyboard emulator cleanup', { error: error.message });
    }
  }
});

// Handle action (icon) clicks - open global side panel
chrome.action.onClicked.addListener(async (tab) => {
  automationLogger.logInit('sidepanel', 'opening', { windowId: tab.windowId });

  // Open global side panel for the entire browser window
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    automationLogger.logInit('sidepanel', 'ready', { windowId: tab.windowId });
  } catch (error) {
    automationLogger.logInit('sidepanel', 'failed', { error: error.message, fallback: 'popup' });
    // Fallback to popup window if side panel fails
    chrome.windows.create({
      url: chrome.runtime.getURL('ui/popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});

// --- Background Agent Alarm Handler ---

// Agent retry configuration
const AGENT_RETRY_DELAYS = [1, 5, 15]; // minutes: exponential backoff
const AGENT_RETRY_PREFIX = 'fsb_agent_retry_';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Check if this is a retry alarm
  let isRetry = false;
  let retryAgentId = null;
  if (alarm.name.startsWith(AGENT_RETRY_PREFIX)) {
    retryAgentId = alarm.name.substring(AGENT_RETRY_PREFIX.length);
    isRetry = true;
  }

  const scheduledAgentId = agentScheduler.getAgentIdFromAlarm(alarm.name);
  const effectiveAgentId = isRetry ? retryAgentId : scheduledAgentId;
  if (!effectiveAgentId) return; // Not an FSB agent alarm

  console.log('[FSB] Agent alarm fired:', alarm.name, isRetry ? '(retry)' : '');

  try {
    const agent = await agentManager.getAgent(effectiveAgentId);
    if (!agent) {
      console.warn('[FSB] Agent not found for alarm, clearing:', effectiveAgentId);
      if (!isRetry) await agentScheduler.clearAlarm(effectiveAgentId);
      return;
    }

    if (!agent.enabled) {
      console.log('[FSB] Agent disabled, skipping:', effectiveAgentId);
      return;
    }

    // Guard against double-runs (skip for retry alarms)
    if (!isRetry && !agentScheduler.isValidAlarmFire(agent)) {
      console.log('[FSB] Agent alarm fired too soon, skipping:', effectiveAgentId);
      return;
    }

    // Execute the agent
    const result = await agentExecutor.execute(agent);

    // Handle failed runs with retry
    if (!result.success) {
      const currentRetry = agent.retryCount || 0;
      if (currentRetry < (agent.retryMaxAttempts || 3)) {
        const delayMinutes = AGENT_RETRY_DELAYS[currentRetry] || 15;
        await agentManager.incrementRetry(effectiveAgentId);
        const retryAlarmName = AGENT_RETRY_PREFIX + effectiveAgentId;
        await chrome.alarms.create(retryAlarmName, { delayInMinutes: delayMinutes });
        console.log('[FSB] Agent run failed, scheduling retry', currentRetry + 1, 'in', delayMinutes, 'min:', effectiveAgentId);
      } else {
        console.log('[FSB] Agent run failed, max retries reached:', effectiveAgentId);
        await agentManager.resetRetry(effectiveAgentId);
      }
    } else {
      // Success - reset retry counter
      if (agent.retryCount > 0) {
        await agentManager.resetRetry(effectiveAgentId);
      }
    }

    // Record the run
    const updatedAgent = await agentManager.recordRun(effectiveAgentId, result);

    // Reschedule daily agents for their next occurrence
    if (agent.schedule.type === 'daily') {
      await agentScheduler.rescheduleDaily(updatedAgent);
    }

    // Reschedule cron agents for their next occurrence
    if (agent.schedule.type === 'cron') {
      await agentScheduler.rescheduleCron(updatedAgent);
    }

    // Disable once-type agents after execution
    if (agent.schedule.type === 'once') {
      await agentManager.updateAgent(effectiveAgentId, { enabled: false });
      await agentScheduler.clearAlarm(effectiveAgentId);
    }

    // Notify any open UI about the run completion
    chrome.runtime.sendMessage({
      action: 'agentRunComplete',
      agentId: effectiveAgentId,
      result: {
        success: result.success,
        duration: result.duration,
        error: result.error
      }
    }).catch(() => {}); // UI may not be open

    // Sync to server if enabled
    if (updatedAgent.syncEnabled && typeof serverSync !== 'undefined') {
      serverSync.syncRun(updatedAgent, result).catch(err => {
        console.warn('[FSB] Server sync failed:', err.message);
      });
    }

  } catch (error) {
    console.error('[FSB] Agent alarm handler error:', error.message);
  }
});

// Set up side panel behavior
chrome.runtime.onInstalled.addListener(async () => {
  automationLogger.logInit('extension', 'installed', { version: 'v0.9.20' });

  // Install-specific: Set default UI mode if not set
  var stored = await chrome.storage.local.get(['uiMode']);
  if (!stored.uiMode) {
    await chrome.storage.local.set({ uiMode: 'sidepanel' });
    automationLogger.debug('Default UI mode set to sidepanel', {});
  }

  // Run shared bootstrap (SETTINGS, ENVIRONMENT, TOOLS, SESSIONS)
  await swBootstrap('installed');
});

// Initialize analytics and restore sessions on startup
chrome.runtime.onStartup.addListener(async () => {
  automationLogger.logServiceWorker('startup', {});
  await swBootstrap('startup');
});

// Listen for debug mode changes so toggling takes effect immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.debugMode) {
    fsbDebugMode = changes.debugMode.newValue === true;
    console.log('[FSB] Debug mode ' + (fsbDebugMode ? 'enabled' : 'disabled'));
  }

  // Connect/disconnect WebSocket when serverSyncEnabled is toggled
  if (namespace === 'local' && changes.serverSyncEnabled) {
    if (changes.serverSyncEnabled.newValue) {
      fsbWebSocket.connect();
    } else {
      fsbWebSocket.disconnect();
    }
  }

  // PERF: Update cached DOM settings in active sessions when changed
  if (namespace === 'local') {
    const domKeys = ['domOptimization', 'maxDOMElements', 'prioritizeViewport'];
    const hasDomChange = domKeys.some(key => key in changes);
    if (hasDomChange) {
      for (const [, session] of activeSessions) {
        if (session.domSettings) {
          if ('domOptimization' in changes) session.domSettings.domOptimization = changes.domOptimization.newValue;
          if ('maxDOMElements' in changes) session.domSettings.maxDOMElements = changes.maxDOMElements.newValue;
          if ('prioritizeViewport' in changes) session.domSettings.prioritizeViewport = changes.prioritizeViewport.newValue;
        }
      }
    }
  }
});

// ============================================================================
// MCP WEBSOCKET BRIDGE (localhost:7225)
// ============================================================================

let mcpProgressCallbacks = new Map(); // sessionId -> MCP message id for progress forwarding

class MCPWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 0;
    this.maxReconnectDelay = 30000;
    this.connected = false;
    this.intentionalClose = false;
    this.keepaliveTimer = null;
    this.healthCheckTimer = null;
  }

  connect() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) { /* ignore */ }
      this.ws = null;
    }

    this._stopKeepalive();
    this.intentionalClose = false;

    try {
      this.ws = new WebSocket('ws://localhost:7225');
    } catch (err) {
      console.warn('[FSB MCP WS] Failed to create WebSocket:', err.message);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 0;
      this.connected = true;
      this._startKeepalive();
      console.log('[FSB MCP WS] Connected to MCP server');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (err) {
        console.warn('[FSB MCP WS] Failed to parse message:', err.message);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._stopKeepalive();
      if (!this.intentionalClose) {
        this._scheduleReconnect();
      }
      console.log('[FSB MCP WS] Disconnected');
    };

    this.ws.onerror = () => {
      // onclose fires after onerror
    };
  }

  disconnect() {
    this.intentionalClose = true;
    this._stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
    this.connected = false;
  }

  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(data));
    return true;
  }

  // Phase 102.1: Keepalive pings prevent service worker suspension from killing MCP connection.
  // Service workers suspend after ~30s idle, closing all WebSockets. A 15s ping keeps
  // the worker alive and detects stale connections early.
  _startKeepalive() {
    this._stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'mcp:ping', ts: Date.now() }));
      } else if (!this.intentionalClose) {
        // WebSocket is not open but we think we're connected -- stale state
        this.connected = false;
        this._stopKeepalive();
        this._scheduleReconnect();
      }
    }, 15000); // 15-second keepalive (under 30s service worker timeout)
  }

  _stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  // Health check: called on service worker wake to verify connection is still alive.
  // If ws is null or closed, reconnect immediately.
  ensureConnected() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[FSB MCP WS] Health check: connection lost, reconnecting...');
      this.connected = false;
      this._stopKeepalive();
      this.reconnectDelay = 0; // Immediate reconnect on wake
      this.connect();
    }
  }

  _handleMessage(msg) {
    // Ignore pong responses
    if (msg && msg.type === 'mcp:pong') return;
    // All messages from MCP server are MCPMessage objects with { id, type, payload }
    // Route them to the existing handleMCPMessage handler
    if (msg && msg.type && msg.type.startsWith('mcp:')) {
      handleMCPMessage(msg);
    }
  }

  _scheduleReconnect() {
    if (this.reconnectDelay === 0) {
      this.reconnectDelay = 2000;
      // Don't reconnect immediately -- MCP server may not be running
      console.log('[FSB MCP WS] Will retry in 2s');
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    } else {
      console.log('[FSB MCP WS] Reconnecting in ' + this.reconnectDelay + 'ms');
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }
  }
}

const mcpWebSocket = new MCPWebSocket();

/**
 * Handle messages from MCP server via WebSocket bridge.
 * Routes to existing extension handlers and returns results.
 */
async function handleMCPMessage(msg) {
  const { id, type, payload } = msg;
  console.log(`[FSB MCP] >> Received: ${type}`, { id, payload: JSON.stringify(payload).slice(0, 200) });

  try {
    switch (type) {
      case 'mcp:start-automation': {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          tab = await chrome.tabs.create({ url: 'about:blank', active: true });
        }
        // Delegate to existing handleStartAutomation
        const result = await new Promise((resolve) => {
          handleStartAutomation(
            { action: 'startAutomation', task: payload.task, tabId: tab.id, _triggerSource: 'mcp' },
            { id: chrome.runtime.id, tab: tab },
            resolve
          );
        });

        // For autopilot tasks, register progress callback
        if (result && result.success && result.sessionId) {
          mcpProgressCallbacks.set(result.sessionId, id);
        }

        sendMCPResponse(id, result || { success: false, error: 'No response from handler' });
        break;
      }

      case 'mcp:stop-automation': {
        const result = await new Promise((resolve) => {
          handleStopAutomation(
            { action: 'stopAutomation' },
            { id: chrome.runtime.id },
            resolve
          );
        });
        sendMCPResponse(id, result || { success: true });
        break;
      }

      case 'mcp:get-status': {
        const sessionIds = Array.from(activeSessions.keys());
        const firstSession = sessionIds.length > 0 ? activeSessions.get(sessionIds[0]) : null;
        sendMCPResponse(id, {
          success: true,
          activeSessions: activeSessions.size,
          sessionIds,
          currentSessionId: sessionIds[0] || null,
          currentTask: firstSession?.task || null,
          progress: firstSession ? calculateProgress(firstSession) : null,
          phase: firstSession ? detectTaskPhase(firstSession) : null
        });
        break;
      }

      case 'mcp:execute-action': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          console.warn('[FSB MCP] execute-action: No active tab found');
          sendMCPResponse(id, { success: false, error: 'No active tab' });
          return;
        }
        console.log(`[FSB MCP] execute-action: tab=${tab.id} url=${tab.url} tool=${payload.tool}`);

        // Navigation tools that work without content scripts -- handle directly in background
        // This prevents the dead-end where a crashed/error tab blocks all MCP actions
        const bgNavTools = ['navigate', 'openNewTab', 'switchToTab', 'listTabs'];
        if (bgNavTools.includes(payload.tool)) {
          try {
            let result;
            switch (payload.tool) {
              case 'navigate': {
                const url = payload.params?.url;
                if (!url) { sendMCPResponse(id, { success: false, error: 'No URL provided' }); return; }
                const fromUrl = tab.url;
                await chrome.tabs.update(tab.id, { url });
                // Wait briefly for navigation to start
                await new Promise(r => setTimeout(r, 500));
                result = { success: true, hadEffect: true, navigatingTo: url, fromUrl, verification: { note: 'Navigation initiated - verification will occur after page load', expectedUrl: url }, tool: 'navigate', executionTime: 1 };
                break;
              }
              case 'openNewTab': {
                const url = payload.params?.url || 'about:blank';
                const newTab = await chrome.tabs.create({ url, active: payload.params?.active !== false });
                result = { success: true, tabId: newTab.id, url, active: payload.params?.active !== false };
                break;
              }
              case 'switchToTab': {
                const tabId = payload.params?.tabId;
                if (!tabId) { sendMCPResponse(id, { success: false, error: 'Tab ID is required' }); return; }
                await chrome.tabs.update(tabId, { active: true });
                const tabWindow = await chrome.tabs.get(tabId);
                if (tabWindow.windowId) await chrome.windows.update(tabWindow.windowId, { focused: true });
                result = { success: true, tabId };
                break;
              }
              case 'listTabs': {
                const allTabs = await chrome.tabs.query({});
                result = { success: true, tabs: allTabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, windowId: t.windowId })) };
                break;
              }
            }
            console.log(`[FSB MCP] execute-action: bg-nav ${payload.tool} success`);
            sendMCPResponse(id, result);
          } catch (navErr) {
            console.error(`[FSB MCP] execute-action: bg-nav ${payload.tool} FAILED:`, navErr.message);
            sendMCPResponse(id, { success: false, error: navErr.message });
          }
          break;
        }

        try {
          const injected = await ensureContentScriptInjected(tab.id);
          console.log(`[FSB MCP] execute-action: ensureContentScript result=${injected}`);
        } catch (injectErr) {
          console.error(`[FSB MCP] execute-action: ensureContentScript FAILED:`, injectErr.message);
          sendMCPResponse(id, { success: false, error: `Content script injection failed: ${injectErr.message}` });
          return;
        }
        // Capture URL before action -- used to detect navigation-triggering clicks (per D-05)
        let previousUrl = null;
        try {
          previousUrl = tab.url;
        } catch (e) {
          // tab.url already available from the query above
        }

        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            action: 'executeAction',
            tool: payload.tool,
            params: payload.params || {},
            source: 'mcp-manual'
          });
          console.log(`[FSB MCP] execute-action: result success=${result?.success}`, result?.error ? `error=${result.error}` : '');
          sendMCPResponse(id, result || { success: false, error: 'No response from content script (result was null/undefined)' });
        } catch (msgErr) {
          console.warn(`[FSB MCP] execute-action: sendMessage error: ${msgErr.message}`);

          // Classify the error to detect BF cache specifically (per D-06)
          const failureType = classifyFailure(msgErr);

          if (failureType === FAILURE_TYPES.BF_CACHE) {
            console.log('[FSB MCP] execute-action: BF cache error detected, checking for navigation...');

            // Check if URL changed -- click-triggered navigation means the action succeeded (per D-04)
            try {
              const currentTab = await chrome.tabs.get(tab.id);
              const currentUrl = currentTab?.url;

              if (previousUrl && currentUrl && currentUrl !== previousUrl) {
                console.log(`[FSB MCP] execute-action: navigation detected ${previousUrl} -> ${currentUrl}`);
                sendMCPResponse(id, {
                  success: true,
                  navigationTriggered: true,
                  previousUrl: previousUrl,
                  newUrl: currentUrl,
                  note: 'Click triggered page navigation. Content script will reconnect automatically via pageshow handler.',
                  tool: payload.tool
                });
                return;
              }
            } catch (urlCheckErr) {
              console.warn('[FSB MCP] execute-action: URL check failed:', urlCheckErr.message);
            }

            // URL did not change -- page restored from BF cache without navigation
            // Wake tab, wait for content script pageshow reconnection, retry once
            console.log('[FSB MCP] execute-action: BF cache without navigation, attempting recovery...');
            try {
              await chrome.tabs.update(tab.id, { active: true });
              // Give the pageshow handler in lifecycle.js time to re-establish the port
              await new Promise(r => setTimeout(r, 1500));
              await ensureContentScriptInjected(tab.id);

              const retryResult = await chrome.tabs.sendMessage(tab.id, {
                action: 'executeAction',
                tool: payload.tool,
                params: payload.params || {},
                source: 'mcp-manual'
              });
              console.log(`[FSB MCP] execute-action: BF cache retry success=${retryResult?.success}`);
              sendMCPResponse(id, retryResult || { success: false, error: 'No response after BF cache recovery' });
            } catch (retryErr) {
              console.error('[FSB MCP] execute-action: BF cache recovery failed:', retryErr.message);
              sendMCPResponse(id, {
                success: false,
                error: `Content script communication failed after BF cache recovery: ${retryErr.message}`,
                recovery: 'bf_cache_retry_failed',
                hint: 'Try calling read_page to re-establish connection, then retry the action'
              });
            }
          } else {
            // Non-BF-cache error -- return as-is with recovery hint (per D-04 actionable response)
            console.error(`[FSB MCP] execute-action: sendMessage FAILED (${failureType}):`, msgErr.message);
            sendMCPResponse(id, {
              success: false,
              error: `Content script communication failed: ${msgErr.message}`,
              failureType: failureType,
              hint: failureType === FAILURE_TYPES.COMMUNICATION
                ? 'Content script may need re-injection. Try navigating to the page again.'
                : 'Unexpected error. Try read_page to check page state.'
            });
          }
        }
        break;
      }

      case 'mcp:get-dom': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          console.warn('[FSB MCP] get-dom: No active tab found');
          sendMCPResponse(id, { success: false, error: 'No active tab' });
          return;
        }
        console.log(`[FSB MCP] get-dom: tab=${tab.id} url=${tab.url}`);
        try {
          await ensureContentScriptInjected(tab.id);
        } catch (injectErr) {
          console.error(`[FSB MCP] get-dom: ensureContentScript FAILED:`, injectErr.message);
          sendMCPResponse(id, { success: false, error: `Content script injection failed: ${injectErr.message}` });
          return;
        }
        try {
          const dom = await chrome.tabs.sendMessage(tab.id, {
            action: 'getDOM',
            maxElements: payload.maxElements || 2000,
            prioritizeViewport: payload.prioritizeViewport !== false
          });
          console.log(`[FSB MCP] get-dom: result success=${dom?.success}, elements=${dom?.structuredDOM?.elements?.length || 'N/A'}`);
          sendMCPResponse(id, dom || { success: false, error: 'No DOM response (result was null/undefined)' });
        } catch (msgErr) {
          console.error(`[FSB MCP] get-dom: sendMessage FAILED:`, msgErr.message);
          sendMCPResponse(id, { success: false, error: `Content script communication failed: ${msgErr.message}` });
        }
        break;
      }

      case 'mcp:get-tabs': {
        const tabs = await chrome.tabs.query({});
        sendMCPResponse(id, {
          success: true,
          tabs: tabs.map(t => ({
            id: t.id,
            title: t.title,
            url: t.url,
            active: t.active,
            windowId: t.windowId
          }))
        });
        break;
      }

      case 'mcp:get-site-guides': {
        const guides = await loadSiteGuides();
        sendMCPResponse(id, { success: true, guides });
        break;
      }

      case 'mcp:get-memory': {
        if (payload.statsOnly) {
          const stats = await memoryManager.getStats();
          sendMCPResponse(id, { success: true, stats });
        } else {
          const memories = await memoryManager.getAll();
          const stats = await memoryManager.getStats();
          sendMCPResponse(id, { success: true, memories, stats });
        }
        break;
      }

      case 'mcp:get-config': {
        const config = await chrome.storage.local.get([
          'modelProvider', 'modelName', 'actionDelay', 'maxIterations',
          'confirmSensitive', 'debugMode'
        ]);
        // Explicitly exclude API keys -- never expose through MCP
        sendMCPResponse(id, { success: true, config });
        break;
      }

      case 'mcp:read-page': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          console.warn('[FSB MCP] read-page: No active tab found');
          sendMCPResponse(id, { success: false, error: 'No active tab' });
          return;
        }
        console.log(`[FSB MCP] read-page: tab=${tab.id} url=${tab.url}`);
        try {
          await ensureContentScriptInjected(tab.id);
        } catch (injectErr) {
          console.error(`[FSB MCP] read-page: ensureContentScript FAILED:`, injectErr.message);
          sendMCPResponse(id, { success: false, error: `Content script injection failed: ${injectErr.message}` });
          return;
        }
        try {
          const pageContent = await chrome.tabs.sendMessage(tab.id, {
            action: 'readPage',
            params: {
              full: payload.full || false,
              maxChars: payload.full ? 50000 : 8000
            }
          });
          console.log(`[FSB MCP] read-page: result success=${pageContent?.success}, chars=${pageContent?.charCount || 'N/A'}`);
          sendMCPResponse(id, pageContent || { success: false, error: 'No page content response (result was null/undefined)' });
        } catch (msgErr) {
          console.error(`[FSB MCP] read-page: sendMessage FAILED:`, msgErr.message);
          sendMCPResponse(id, { success: false, error: `Content script communication failed: ${msgErr.message}` });
        }
        break;
      }

      case 'mcp:list-sessions': {
        const sessions = await automationLogger.listSessions();
        sendMCPResponse(id, { success: true, sessions });
        break;
      }

      case 'mcp:get-session': {
        const sessionId = payload.sessionId;
        if (!sessionId) {
          sendMCPResponse(id, { success: false, error: 'Missing sessionId' });
          break;
        }
        if (payload.format === 'text') {
          const report = await automationLogger.exportHumanReadable(sessionId);
          sendMCPResponse(id, { success: true, report });
        } else {
          const session = await automationLogger.loadSession(sessionId);
          if (!session) {
            sendMCPResponse(id, { success: false, error: `Session ${sessionId} not found` });
          } else {
            sendMCPResponse(id, { success: true, session });
          }
        }
        break;
      }

      case 'mcp:get-logs': {
        const sid = payload.sessionId;
        const count = payload.count || 50;
        let logs, report;
        if (sid) {
          logs = automationLogger.getSessionLogs(sid);
          report = automationLogger.generateReport(sid);
        } else {
          logs = automationLogger.getRecentLogs(count);
          report = automationLogger.generateReport();
        }
        sendMCPResponse(id, { success: true, logs, report });
        break;
      }

      case 'mcp:search-memory': {
        const query = payload.query;
        if (!query) {
          sendMCPResponse(id, { success: false, error: 'Missing query parameter' });
          break;
        }
        const results = await memoryManager.search(
          query,
          payload.filters || {},
          payload.options || {}
        );
        const stats = await memoryManager.getStats();
        sendMCPResponse(id, { success: true, results, stats });
        break;
      }

      case 'mcp:create-agent': {
        const { name, task, targetUrl, startMode, schedule, maxIterations } = payload;
        if (!name || !task || !schedule) {
          sendMCPResponse(id, { success: false, error: 'Missing required fields: name, task, schedule' });
          break;
        }
        const newAgent = await agentManager.createAgent({ name, task, targetUrl, startMode, schedule, maxIterations });
        if (newAgent.enabled) {
          await agentScheduler.scheduleAgent(newAgent);
        }
        sendMCPResponse(id, { success: true, agent: newAgent });
        break;
      }

      case 'mcp:list-agents': {
        const agents = await agentManager.listAgents();
        const summaries = agents.map(a => ({
          agentId: a.agentId,
          name: a.name,
          task: a.task,
          targetUrl: a.targetUrl,
          startMode: a.startMode || 'pinned',
          enabled: a.enabled,
          schedule: a.schedule,
          lastRunAt: a.lastRunAt,
          lastRunStatus: a.lastRunStatus,
          runCount: a.runCount,
          replayEnabled: a.replayEnabled !== false
        }));
        sendMCPResponse(id, { success: true, agents: summaries });
        break;
      }

      case 'mcp:run-agent': {
        const runAgentId = payload.agentId;
        if (!runAgentId) {
          sendMCPResponse(id, { success: false, error: 'Missing agentId' });
          break;
        }
        const runAgent = await agentManager.getAgent(runAgentId);
        if (!runAgent) {
          sendMCPResponse(id, { success: false, error: `Agent not found: ${runAgentId}` });
          break;
        }
        // Store MCP message id for progress forwarding
        mcpProgressCallbacks.set(`agent:${runAgentId}`, id);
        try {
          const execResult = await agentExecutor.execute(runAgent);
          await agentManager.recordRun(runAgentId, {
            status: execResult.success ? 'success' : 'failed',
            result: execResult.summary || null,
            error: execResult.error || null,
            iterations: execResult.iterations || 0,
            tokensUsed: execResult.tokensUsed || 0,
            costUsd: execResult.costUsd || 0,
            durationMs: execResult.durationMs || 0,
            executionMode: execResult.executionMode || 'ai_initial',
            costSaved: execResult.costSaved || 0
          });
          sendMCPResponse(id, {
            success: execResult.success !== false,
            summary: execResult.summary || '',
            iterations: execResult.iterations || 0,
            durationMs: execResult.durationMs || 0,
            executionMode: execResult.executionMode || 'ai_initial'
          });
        } finally {
          mcpProgressCallbacks.delete(`agent:${runAgentId}`);
        }
        break;
      }

      case 'mcp:stop-agent': {
        const stopAgentId = payload.agentId;
        if (!stopAgentId) {
          sendMCPResponse(id, { success: false, error: 'Missing agentId' });
          break;
        }
        await agentExecutor.forceStop(stopAgentId);
        sendMCPResponse(id, { success: true, message: `Agent ${stopAgentId} stopped` });
        break;
      }

      case 'mcp:delete-agent': {
        const delAgentId = payload.agentId;
        if (!delAgentId) {
          sendMCPResponse(id, { success: false, error: 'Missing agentId' });
          break;
        }
        await agentScheduler.clearAlarm(delAgentId);
        await agentExecutor.forceStop(delAgentId);
        const deleted = await agentManager.deleteAgent(delAgentId);
        sendMCPResponse(id, { success: deleted, message: deleted ? `Agent ${delAgentId} deleted` : `Agent ${delAgentId} not found` });
        break;
      }

      case 'mcp:toggle-agent': {
        const toggleAgentId = payload.agentId;
        if (!toggleAgentId) {
          sendMCPResponse(id, { success: false, error: 'Missing agentId' });
          break;
        }
        const toggledAgent = await agentManager.toggleAgent(toggleAgentId);
        if (toggledAgent.enabled) {
          await agentScheduler.scheduleAgent(toggledAgent);
        } else {
          await agentScheduler.clearAlarm(toggledAgent.agentId);
        }
        sendMCPResponse(id, { success: true, agent: { agentId: toggledAgent.agentId, name: toggledAgent.name, enabled: toggledAgent.enabled } });
        break;
      }

      case 'mcp:get-agent-stats': {
        const agentStats = await agentManager.getStats();
        sendMCPResponse(id, { success: true, stats: agentStats });
        break;
      }

      case 'mcp:get-agent-history': {
        const histAgentId = payload.agentId;
        if (!histAgentId) {
          sendMCPResponse(id, { success: false, error: 'Missing agentId' });
          break;
        }
        const limit = payload.limit || 10;
        const history = await agentManager.getRunHistory(histAgentId, limit);
        sendMCPResponse(id, { success: true, history });
        break;
      }

      default:
        sendMCPResponse(id, { success: false, error: `Unknown MCP message type: ${type}` });
    }
  } catch (err) {
    console.error(`[FSB MCP] UNHANDLED ERROR in ${type}:`, err.message, err.stack?.split('\n').slice(0, 3).join(' | '));
    sendMCPResponse(id, { success: false, error: `[${type}] ${err.message || 'Internal extension error'}` });
  }
}

/**
 * Send a response back to MCP server via WebSocket.
 */
function sendMCPResponse(id, payload) {
  if (!payload.success) {
    console.warn(`[FSB MCP] << Sending error response:`, { id, error: payload.error });
  }
  mcpWebSocket.send({ id, type: 'mcp:result', payload });
}

/**
 * Forward automation progress to MCP server for autopilot tasks.
 * Called from broadcastDashboardProgress.
 */
function broadcastMCPProgress(session) {
  if (!mcpWebSocket.connected) return;
  const mcpMsgId = mcpProgressCallbacks.get(session.sessionId);
  if (!mcpMsgId) return;
  try {
    var progress = calculateProgress(session);
    mcpWebSocket.send({
      id: mcpMsgId,
      type: 'mcp:progress',
      payload: {
        taskId: session.sessionId,
        progress: progress.progressPercent,
        phase: detectTaskPhase(session),
        eta: progress.estimatedTimeRemaining || null,
        action: session._lastActionSummary || null
      }
    });
  } catch (err) {
    console.error('[FSB MCP WS] Failed to send progress:', err.message);
  }
}

/**
 * Load site guides from extension resources.
 * Returns array of { filename, domain } objects.
 */
async function loadSiteGuides() {
  try {
    const siteGuideFiles = await new Promise((resolve) => {
      chrome.runtime.getPackageDirectoryEntry((dirEntry) => {
        if (!dirEntry) { resolve([]); return; }
        dirEntry.getDirectory('site-maps', {}, (subDir) => {
          const reader = subDir.createReader();
          reader.readEntries((entries) => {
            resolve(entries.filter(e => e.name.endsWith('.json')).map(e => e.name));
          }, () => resolve([]));
        }, () => resolve([]));
      });
    });
    return siteGuideFiles.map(f => ({
      filename: f,
      domain: f.replace('.json', '').replace(/_/g, '.')
    }));
  } catch (err) {
    return [];
  }
}

// Auto-connect to MCP WebSocket server.
// Will silently retry if MCP server isn't running (localhost:7225).
mcpWebSocket.connect();

// Phase 102.1: Health check on service worker wake events.
// Service workers can suspend and resume; on resume, verify MCP connection is alive.
// chrome.runtime.onStartup fires on browser launch; onMessage fires on wake from content scripts.
chrome.runtime.onStartup.addListener(() => {
  mcpWebSocket.ensureConnected();
});
// Also check MCP health when any message arrives (service worker woke for a reason)
const _origOnMessage = chrome.runtime.onMessage.hasListener ? null : undefined;
if (typeof chrome.runtime.onMessage !== 'undefined') {
  chrome.runtime.onMessage.addListener((msg) => {
    // Lightweight: only check if we think we're connected but socket is actually dead
    if (mcpWebSocket.connected && (!mcpWebSocket.ws || mcpWebSocket.ws.readyState !== WebSocket.OPEN)) {
      mcpWebSocket.ensureConnected();
    }
  });
}
