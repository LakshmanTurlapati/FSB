#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'Logs');
const GUIDES_DIR = path.join(__dirname, '..', 'site-guides', 'career');

// Domains to skip entirely (not career pages)
const SKIP_DOMAINS = ['docs.google.com', 'www.qatarairways.com'];
const GOOGLE_DOMAIN = 'www.google.com';

// ============================================================================
// Step 1: Scan -- Read all research log files
// ============================================================================

function scanLogFiles() {
  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.startsWith('fsb-research-') && f.endsWith('.json'))
    .filter(f => !f.startsWith('fsb-session-'));

  const logs = [];
  const googleLogs = [];

  for (const file of files) {
    const filePath = path.join(LOGS_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.warn('  SKIP (parse error): ' + file);
      continue;
    }

    const domain = data.domain || '';

    if (SKIP_DOMAINS.includes(domain)) {
      console.log('  SKIP (non-career domain): ' + file);
      continue;
    }

    if (domain === GOOGLE_DOMAIN) {
      googleLogs.push({ file, data });
      console.log('  GOOGLE SEARCH LOG: ' + file);
      continue;
    }

    logs.push({ file, data });
    console.log('  CAREER LOG: ' + file + ' (' + domain + ')');
  }

  return { logs, googleLogs };
}

// ============================================================================
// Step 2: Group by company domain
// ============================================================================

function groupByCompany(logs) {
  const groups = new Map();

  for (const { file, data } of logs) {
    const domain = data.domain || '';
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain).push({ file, data });
  }

  // Sort sessions by endTime (most recent last) for conflict resolution
  for (const [, sessions] of groups) {
    sessions.sort((a, b) => (a.data.endTime || 0) - (b.data.endTime || 0));
  }

  return groups;
}

// ============================================================================
// Step 3: Parse each log -- extract elements from all pages
// ============================================================================

function parseLog(logData) {
  const pages = logData.pages || [];
  const allElements = [];
  const allLinks = [];
  const allForms = [];
  const allHeadings = [];
  const pageMetadata = [];

  for (const page of pages) {
    const depth = page.depth || 0;
    const url = page.url || '';
    const title = page.title || '';

    pageMetadata.push({ url, title, depth });

    for (const elem of (page.interactiveElements || [])) {
      allElements.push({ ...elem, pageDepth: depth, pageUrl: url });
    }

    for (const link of (page.internalLinks || [])) {
      allLinks.push({ ...link, pageDepth: depth });
    }

    for (const form of (page.forms || [])) {
      allForms.push({ ...form, pageDepth: depth });
    }

    for (const heading of (page.headings || [])) {
      allHeadings.push({ ...heading, pageDepth: depth });
    }
  }

  return { allElements, allLinks, allForms, allHeadings, pageMetadata };
}

// ============================================================================
// Step 4: Filter career-relevant elements
// ============================================================================

const CAREER_CATEGORIES = {
  searchBox: {
    keywords: ['search', 'keyword', 'find job', 'query', 'find role', 'what', 'job title'],
    typeHint: ['input', 'textarea']
  },
  locationFilter: {
    keywords: ['location', 'city', 'state', 'where', 'region', 'country', 'zip', 'postal'],
    typeHint: ['input', 'select', 'button']
  },
  departmentFilter: {
    keywords: ['department', 'team', 'category', 'area', 'function', 'group', 'profession', 'business'],
    typeHint: ['select', 'button', 'input', 'a']
  },
  jobCards: {
    keywords: ['job', 'position', 'opening', 'listing', 'result', 'posting', 'role', 'career', 'opportunity', 'vacancy'],
    typeHint: ['a', 'div', 'li', 'article']
  },
  jobTitle: {
    keywords: ['title', 'role', 'position name'],
    typeHint: ['a', 'h2', 'h3', 'h4', 'span']
  },
  applyButton: {
    keywords: ['apply', 'submit application', 'interested', 'apply now', 'apply for'],
    typeHint: ['a', 'button']
  },
  pagination: {
    keywords: ['next', 'page', 'previous', 'prev', 'show more', 'load more', 'view more', 'see more'],
    typeHint: ['a', 'button']
  },
  resultsContainer: {
    keywords: ['results', 'listings', 'openings', 'positions', 'jobs list'],
    typeHint: ['div', 'ul', 'section']
  }
};

const COOKIE_KEYWORDS = ['cookie', 'accept', 'consent', 'dismiss', 'gdpr', 'privacy policy'];

// Elements that are definitely not career-relevant
const EXCLUDE_KEYWORDS = [
  'newsletter', 'subscribe to', 'sign up for updates',
  'share on', 'tweet', 'facebook share', 'linkedin share',
  'feedback', 'survey', 'chat with us', 'live chat',
  'google apps', 'search labs', 'search by voice', 'search by image',
  'go to google home'
];

function getElementText(elem) {
  const parts = [];
  if (elem.text) parts.push(elem.text.toLowerCase());
  if (elem.id) parts.push(elem.id.toLowerCase());
  if (elem.class) parts.push(elem.class.toLowerCase());
  // Check selectors for aria-labels
  for (const sel of (elem.selectors || [])) {
    const ariaMatch = sel.match(/aria-label="([^"]+)"/i);
    if (ariaMatch) parts.push(ariaMatch[1].toLowerCase());
    const nameMatch = sel.match(/name="([^"]+)"/i);
    if (nameMatch) parts.push(nameMatch[1].toLowerCase());
    const placeholderMatch = sel.match(/placeholder[*]?="([^"]+)"/i);
    if (placeholderMatch) parts.push(placeholderMatch[1].toLowerCase());
  }
  return parts.join(' ');
}

function isExcluded(textBlob) {
  return EXCLUDE_KEYWORDS.some(kw => textBlob.includes(kw));
}

function categorizeElement(elem) {
  const textBlob = getElementText(elem);

  if (isExcluded(textBlob)) return null;

  // Check cookie dismiss first (it gets its own special handling)
  if (COOKIE_KEYWORDS.some(kw => textBlob.includes(kw))) {
    return 'cookieDismiss';
  }

  // Score each category
  const scores = {};
  for (const [cat, { keywords }] of Object.entries(CAREER_CATEGORIES)) {
    let score = 0;
    for (const kw of keywords) {
      if (textBlob.includes(kw)) score++;
    }
    if (score > 0) scores[cat] = score;
  }

  if (Object.keys(scores).length === 0) return null;

  // Return category with highest score
  let bestCat = null;
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }

  return bestCat;
}

function filterCareerElements(allElements) {
  const categorized = {
    searchBox: [],
    locationFilter: [],
    departmentFilter: [],
    jobCards: [],
    jobTitle: [],
    applyButton: [],
    pagination: [],
    resultsContainer: [],
    cookieDismiss: []
  };

  // Deduplicate by selector string
  const seenSelectors = new Set();

  for (const elem of allElements) {
    const selectorKey = (elem.selectors || []).sort().join('|');
    if (seenSelectors.has(selectorKey) && selectorKey !== '') continue;
    if (selectorKey) seenSelectors.add(selectorKey);

    const category = categorizeElement(elem);
    if (category && categorized[category]) {
      categorized[category].push(elem);
    }
  }

  return categorized;
}

// ============================================================================
// Step 5: Classify selector stability
// ============================================================================

const HASHED_CLASS_PATTERN = /[a-zA-Z]+-[a-f0-9]{5,}|[a-f0-9]{5,}[a-zA-Z]+|css-[a-z0-9]+|sc-[a-z0-9]+/;

function classifySelector(selector) {
  if (!selector || typeof selector !== 'string') return 'UNSTABLE';

  const trimmed = selector.trim();

  // ID selector
  if (trimmed.startsWith('#')) return 'STABLE';

  // ARIA attributes
  if (trimmed.startsWith('[aria-')) return 'STABLE';

  // Role attribute
  if (trimmed.startsWith('[role=')) return 'STABLE';

  // Data attributes
  if (trimmed.startsWith('[data-')) return 'STABLE';

  // Name attribute
  if (trimmed.startsWith('[name=')) return 'STABLE';

  // XPath selectors
  if (trimmed.startsWith('//')) {
    if (/normalize-space|contains\(text\(\)|contains\(\.,/.test(trimmed)) {
      return 'STABLE';
    }
    return 'UNSTABLE';
  }

  // Class-based selectors
  if (trimmed.startsWith('.')) {
    if (HASHED_CLASS_PATTERN.test(trimmed)) {
      return 'UNSTABLE';
    }
    return 'MODERATE';
  }

  // Attribute selectors with type, placeholder, etc.
  if (trimmed.startsWith('[')) return 'MODERATE';

  // Tag selectors
  if (/^[a-z]+(\[|$)/i.test(trimmed)) return 'MODERATE';

  return 'MODERATE';
}

function sortSelectorsByStability(selectors) {
  const order = { STABLE: 0, MODERATE: 1, UNSTABLE: 2 };
  return [...selectors].sort((a, b) => {
    return (order[classifySelector(a)] ?? 2) - (order[classifySelector(b)] ?? 2);
  });
}

function computeStabilityStats(allSelectors) {
  let stable = 0;
  let moderate = 0;
  let unstable = 0;

  for (const sel of allSelectors) {
    const cls = classifySelector(sel);
    if (cls === 'STABLE') stable++;
    else if (cls === 'MODERATE') moderate++;
    else unstable++;
  }

  const total = stable + moderate + unstable;
  return {
    stable,
    moderate,
    unstable,
    total,
    stableRatio: total > 0 ? stable / total : 0
  };
}

// ============================================================================
// Step 6: Detect ATS platform
// ============================================================================

function detectATS(logData) {
  const pages = logData.pages || [];
  const urlText = pages.map(p => p.url || '').join(' ').toLowerCase();

  // URL pattern detection (highest confidence)
  if (/myworkdayjobs\.com/.test(urlText)) return 'workday';
  if (/boards\.greenhouse\.io|grnh\.se/.test(urlText)) return 'greenhouse';
  if (/jobs\.lever\.co|lever\.co\//.test(urlText)) return 'lever';
  if (/icims\.com|jobs-.*\.icims\.com/.test(urlText)) return 'icims';
  if (/taleo\.net|oracle.*taleo/.test(urlText)) return 'taleo';

  // DOM signature detection (keyword frequency in full log)
  const fullText = JSON.stringify(logData).toLowerCase();

  const counts = {
    workday: (fullText.match(/workday/g) || []).length,
    greenhouse: (fullText.match(/greenhouse/g) || []).length,
    lever: (fullText.match(/lever/g) || []).length,
    icims: (fullText.match(/icims/g) || []).length,
    taleo: (fullText.match(/taleo/g) || []).length
  };

  // Find the best match above threshold (>10 occurrences)
  let bestATS = null;
  let bestCount = 10;
  for (const [ats, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      bestATS = ats;
    }
  }

  return bestATS;
}

// ============================================================================
// Step 7: Compute confidence score
// ============================================================================

function computeConfidence(categorized, stabilityStats) {
  const coverageCategories = [
    'searchBox', 'locationFilter', 'departmentFilter', 'jobCards',
    'jobTitle', 'applyButton', 'pagination', 'resultsContainer'
  ];

  let coverage = 0;
  for (const cat of coverageCategories) {
    if (categorized[cat] && categorized[cat].length > 0) {
      coverage++;
    }
  }

  const stableRatio = stabilityStats.stableRatio;
  const totalElements = stabilityStats.total;

  if (coverage >= 4 && stableRatio >= 0.5) return 'HIGH';
  if (coverage >= 2 || (coverage >= 1 && stableRatio >= 0.3)) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// Step 8: Generate guide files
// ============================================================================

// Map domain to company name and file name
const DOMAIN_COMPANY_MAP = {
  'careers.bankofamerica.com': { name: 'Bank of America', file: 'bankofamerica' },
  'careers.homedepot.com': { name: 'Home Depot', file: 'homedepot' },
  'careers.jnj.com': { name: 'Johnson & Johnson', file: 'jnj' },
  'careers.mastercard.com': { name: 'Mastercard', file: 'mastercard' },
  'careers.mckesson.com': { name: 'McKesson', file: 'mckesson' },
  'careers.microsoft.com': { name: 'Microsoft', file: 'microsoft' },
  'careers.mrcooper.com': { name: 'Mr. Cooper', file: 'mrcooper' },
  'careers.ti.com': { name: 'Texas Instruments', file: 'ti' },
  'careers.unitedhealthgroup.com': { name: 'UnitedHealth Group', file: 'unitedhealthgroup' },
  'careers.walmart.com': { name: 'Walmart', file: 'walmart' },
  'jobs.boeing.com': { name: 'Boeing', file: 'boeing' },
  'jobs.cvshealth.com': { name: 'CVS Health', file: 'cvshealth' },
  'jobs.lowes.com': { name: "Lowe's", file: 'lowes' },
  'jobs.target.com': { name: 'Target', file: 'target' },
  'openai.com': { name: 'OpenAI', file: 'openai' },
  'usa.visa.com': { name: 'Visa', file: 'visa' },
  'www.amazon.jobs': { name: 'Amazon', file: 'amazon' },
  'www.apple.com': { name: 'Apple', file: 'apple' },
  'www.att.jobs': { name: 'AT&T', file: 'att' },
  'www.capitalonecareers.com': { name: 'Capital One', file: 'capitalone' },
  'www.costco.com': { name: 'Costco', file: 'costco' },
  'www.deloitte.com': { name: 'Deloitte', file: 'deloitte' },
  'www.goldmansachs.com': { name: 'Goldman Sachs', file: 'goldmansachs' },
  'www.ibm.com': { name: 'IBM', file: 'ibm' },
  'www.jpmorganchase.com': { name: 'JPMorgan Chase', file: 'jpmorganchase' },
  'www.lockheedmartinjobs.com': { name: 'Lockheed Martin', file: 'lockheedmartin' },
  'www.metacareers.com': { name: 'Meta', file: 'meta' },
  'www.morganstanley.com': { name: 'Morgan Stanley', file: 'morganstanley' },
  'www.nvidia.com': { name: 'NVIDIA', file: 'nvidia' },
  'www.oracle.com': { name: 'Oracle', file: 'oracle' },
  'www.pfizer.com': { name: 'Pfizer', file: 'pfizer' },
  'www.tesla.com': { name: 'Tesla', file: 'tesla' },
  'www.verizon.com': { name: 'Verizon', file: 'verizon' }
};

function getCompanyInfo(domain) {
  if (DOMAIN_COMPANY_MAP[domain]) {
    return DOMAIN_COMPANY_MAP[domain];
  }
  // Fallback: derive from domain
  const parts = domain.replace(/^www\./, '').split('.');
  const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const file = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
  return { name, file };
}

function extractCareerUrl(logData, allLinks) {
  // First try startUrl
  const startUrl = logData.startUrl || '';
  if (startUrl && !startUrl.includes('google.com')) {
    return startUrl;
  }

  // Try to find career URL from internal links
  const careerPatterns = [/\/careers/i, /\/jobs/i, /\/job-search/i, /\/openings/i, /\/hiring/i];
  for (const link of allLinks) {
    if (link.url) {
      for (const pat of careerPatterns) {
        if (pat.test(link.url)) return link.url;
      }
    }
  }

  // Fall back to page URLs
  const pages = logData.pages || [];
  for (const page of pages) {
    if (page.url) {
      for (const pat of careerPatterns) {
        if (pat.test(page.url)) return page.url;
      }
    }
  }

  return startUrl || '';
}

function buildDomainPattern(domain, careerUrl) {
  // Make pattern specific to career URLs to avoid matching non-career pages
  const escapedDomain = domain.replace(/\./g, '\\.');

  // If domain is career-specific (careers.X.com, jobs.X.com), just match the domain
  if (/^(careers|jobs)\./i.test(domain)) {
    return escapedDomain;
  }

  // For general domains (apple.com, openai.com), include career path
  try {
    const urlObj = new URL(careerUrl);
    const pathname = urlObj.pathname;
    if (pathname && pathname !== '/' && pathname.length > 1) {
      const pathPart = pathname.split('/').filter(Boolean)[0];
      if (pathPart) {
        return escapedDomain + '\\/' + pathPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
  } catch (e) {
    // ignore
  }

  return escapedDomain;
}

function buildSelectorsObject(categorized) {
  const selectors = {};

  for (const [cat, elements] of Object.entries(categorized)) {
    if (cat === 'cookieDismiss') continue; // handled separately in workflows
    if (elements.length === 0) continue;

    // Collect all selectors for this category, deduplicated
    const allSels = new Set();
    for (const elem of elements) {
      for (const sel of (elem.selectors || [])) {
        allSels.add(sel);
      }
    }

    if (allSels.size === 0) continue;

    // Sort by stability (STABLE first)
    const sorted = sortSelectorsByStability([...allSels]);

    // Take top selectors (limit to avoid bloat)
    const limited = sorted.slice(0, 6);
    selectors[cat] = limited.join(', ');
  }

  return selectors;
}

function buildGuidanceString(companyName, categorized, ats, careerUrl) {
  const lines = [companyName.toUpperCase() + ' CAREER NAVIGATION:'];

  if (careerUrl) {
    lines.push('Start: ' + careerUrl);
  }

  if (ats) {
    lines.push('ATS: ' + ats);
  }

  const catDescriptions = {
    searchBox: 'Search: use searchBox selectors for job keyword input',
    locationFilter: 'Location: use locationFilter selectors to set location',
    departmentFilter: 'Department: use departmentFilter to narrow by team/category',
    jobCards: 'Results: jobCards selectors target individual job listings',
    jobTitle: 'Titles: jobTitle selectors target the job title elements',
    applyButton: 'Apply: applyButton selectors for application links',
    pagination: 'Pagination: use pagination selectors to navigate result pages',
    resultsContainer: 'Container: resultsContainer wraps the job listings area'
  };

  for (const [cat, desc] of Object.entries(catDescriptions)) {
    if (categorized[cat] && categorized[cat].length > 0) {
      lines.push(desc);
    }
  }

  return lines.join('\\n');
}

function buildWorkflows(categorized, careerUrl, hasCookie) {
  const steps = [];

  if (careerUrl) {
    steps.push('Navigate to ' + careerUrl);
  }

  if (hasCookie) {
    steps.push('Dismiss cookie banner if present');
  }

  if (categorized.searchBox && categorized.searchBox.length > 0) {
    steps.push('Enter job keywords in the search box');
  }

  if (categorized.locationFilter && categorized.locationFilter.length > 0) {
    steps.push('Set location filter if specified');
  }

  if (categorized.departmentFilter && categorized.departmentFilter.length > 0) {
    steps.push('Apply department/category filter if specified');
  }

  steps.push('Wait for results to load');

  if (categorized.jobCards && categorized.jobCards.length > 0) {
    steps.push('Scan job cards for relevant positions');
  }

  if (categorized.jobTitle && categorized.jobTitle.length > 0) {
    steps.push('Click job title to view details');
  }

  if (categorized.applyButton && categorized.applyButton.length > 0) {
    steps.push('Locate apply button for application link');
  }

  if (categorized.pagination && categorized.pagination.length > 0) {
    steps.push('Use pagination to view additional results');
  }

  return steps;
}

function buildWarnings(stabilityStats, ats, categorized) {
  const warnings = [];

  if (stabilityStats.unstable > 0) {
    warnings.push(
      stabilityStats.unstable + ' selector(s) flagged as UNSTABLE -- may break on site updates'
    );
  }

  if (ats) {
    warnings.push('Uses ' + ats + ' ATS platform -- expect dynamic loading and potential iframes');
  }

  if (!categorized.searchBox || categorized.searchBox.length === 0) {
    warnings.push('No search box detected -- may need to browse listings manually or use URL parameters');
  }

  if (!categorized.applyButton || categorized.applyButton.length === 0) {
    warnings.push('No apply button detected -- application may redirect to external ATS');
  }

  return warnings;
}

function escapeForJS(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
}

function generateGuideContent(companyName, domain, confidence, ats, careerUrl, pattern,
                              selectorsObj, workflows, warnings) {
  const lines = [];
  lines.push('registerSiteGuide({');
  lines.push("  site: '" + escapeForJS(companyName) + "',");
  lines.push("  category: 'Career & Job Search',");
  lines.push("  confidence: '" + confidence + "',");

  if (ats) {
    lines.push("  ats: '" + ats + "',");
  } else {
    lines.push('  ats: null,');
  }

  lines.push("  careerUrl: '" + escapeForJS(careerUrl) + "',");
  lines.push('  patterns: [');
  lines.push('    /' + pattern + '/i');
  lines.push('  ],');

  // Guidance
  const guidance = buildGuidanceString(companyName, {}, ats, careerUrl);
  lines.push("  guidance: `" + guidance + "`,");

  // Selectors (only if non-empty)
  const selectorKeys = Object.keys(selectorsObj);
  if (selectorKeys.length > 0) {
    lines.push('  selectors: {');
    for (let i = 0; i < selectorKeys.length; i++) {
      const key = selectorKeys[i];
      const val = selectorsObj[key];
      const comma = i < selectorKeys.length - 1 ? ',' : '';
      lines.push("    " + key + ": '" + escapeForJS(val) + "'" + comma);
    }
    lines.push('  },');
  }

  // Workflows
  if (workflows.length > 0) {
    lines.push('  workflows: {');
    lines.push('    searchJobs: [');
    for (let i = 0; i < workflows.length; i++) {
      const comma = i < workflows.length - 1 ? ',' : '';
      lines.push("      '" + escapeForJS(workflows[i]) + "'" + comma);
    }
    lines.push('    ]');
    lines.push('  },');
  }

  // Warnings
  if (warnings.length > 0) {
    lines.push('  warnings: [');
    for (let i = 0; i < warnings.length; i++) {
      const comma = i < warnings.length - 1 ? ',' : '';
      lines.push("    '" + escapeForJS(warnings[i]) + "'" + comma);
    }
    lines.push('  ],');
  }

  lines.push("  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']");
  lines.push('});');

  return lines.join('\n') + '\n';
}

function generateLowConfidenceGuide(companyName, domain, careerUrl, pattern, ats, selectorsObj) {
  const lines = [];
  lines.push('registerSiteGuide({');
  lines.push("  site: '" + escapeForJS(companyName) + "',");
  lines.push("  category: 'Career & Job Search',");
  lines.push("  confidence: 'LOW',");

  if (ats) {
    lines.push("  ats: '" + ats + "',");
  } else {
    lines.push('  ats: null,');
  }

  lines.push("  careerUrl: '" + escapeForJS(careerUrl) + "',");
  lines.push('  patterns: [');
  lines.push('    /' + pattern + '/i');
  lines.push('  ],');
  lines.push("  guidance: `" + companyName.toUpperCase() + " CAREER NAVIGATION:\\nLOW confidence guide -- use generic ATS fallback for interaction patterns.\\nStart: " + escapeForJS(careerUrl) + "`,");

  // Include whatever selectors exist (even if few)
  const selectorKeys = Object.keys(selectorsObj);
  if (selectorKeys.length > 0) {
    lines.push('  selectors: {');
    for (let i = 0; i < selectorKeys.length; i++) {
      const key = selectorKeys[i];
      const val = selectorsObj[key];
      const comma = i < selectorKeys.length - 1 ? ',' : '';
      lines.push("    " + key + ": '" + escapeForJS(val) + "'" + comma);
    }
    lines.push('  },');
  }

  lines.push('  workflows: {');
  lines.push('    searchJobs: [');
  lines.push("      'Navigate to " + escapeForJS(careerUrl) + "',");
  lines.push("      'Use generic ATS fallback interaction patterns',");
  lines.push("      'Look for search box, location filter, and job listings',");
  lines.push("      'Scan results and click into relevant positions'");
  lines.push('    ]');
  lines.push('  },');
  lines.push("  warnings: ['LOW confidence -- selectors may be incomplete or unstable'],");
  lines.push("  toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement']");
  lines.push('});');

  return lines.join('\n') + '\n';
}

// ============================================================================
// Google search log handler: extract career URLs for URL-only guides
// ============================================================================

function handleGoogleSearchLogs(googleLogs) {
  const guides = [];

  for (const { file, data } of googleLogs) {
    // Extract career URL from combobox text field
    const pages = data.pages || [];
    let careerUrl = '';
    let companyName = '';

    for (const page of pages) {
      for (const elem of (page.interactiveElements || [])) {
        if (elem.type === 'textarea' || elem.type === 'input') {
          const text = (elem.text || '').trim().split(/\s/)[0];
          if (text.startsWith('http') && text.includes('career')) {
            careerUrl = text;
          } else if (text.startsWith('http')) {
            careerUrl = text;
          }
        }
      }
    }

    if (!careerUrl) continue;

    // Derive company name from URL
    try {
      const urlObj = new URL(careerUrl);
      const host = urlObj.hostname.replace(/^www\./, '');
      if (host.includes('citi.com')) {
        companyName = 'Citi';
      } else if (host.includes('google.com')) {
        companyName = 'Google Careers';
      } else if (host.includes('aexpcareers.com') || host.includes('americanexpress.com')) {
        companyName = 'American Express';
      } else {
        const parts = host.split('.');
        companyName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    } catch (e) {
      continue;
    }

    // File name
    let fileName;
    if (companyName === 'Citi') fileName = 'citi';
    else if (companyName === 'Google Careers') fileName = 'google-careers';
    else if (companyName === 'American Express') fileName = 'amex';
    else fileName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Domain pattern for URL matching
    let pattern;
    try {
      const urlObj = new URL(careerUrl);
      pattern = urlObj.hostname.replace(/^www\./, '').replace(/\./g, '\\.');
    } catch (e) {
      pattern = fileName.replace(/-/g, '\\.');
    }

    const content = generateLowConfidenceGuide(companyName, '', careerUrl, pattern, null, {});

    guides.push({ fileName: fileName + '.js', content, companyName });
  }

  return guides;
}

// ============================================================================
// Step 9: Main pipeline
// ============================================================================

function processCompany(domain, sessions) {
  // Merge data from all sessions (union selectors, most recent wins for ordering)
  const mergedElements = [];
  const mergedLinks = [];
  const mergedForms = [];
  const mergedHeadings = [];
  const allPageMeta = [];

  // Process sessions in order (earliest first, most recent last)
  for (const { data } of sessions) {
    const parsed = parseLog(data);
    mergedElements.push(...parsed.allElements);
    mergedLinks.push(...parsed.allLinks);
    mergedForms.push(...parsed.allForms);
    mergedHeadings.push(...parsed.allHeadings);
    allPageMeta.push(...parsed.pageMetadata);
  }

  // Use the most recent session for logData reference (ATS detection, startUrl, etc.)
  const primaryLog = sessions[sessions.length - 1].data;

  // Filter career-relevant elements
  const categorized = filterCareerElements(mergedElements);

  // Collect all selectors for stability analysis
  const allSelectors = [];
  for (const [, elements] of Object.entries(categorized)) {
    for (const elem of elements) {
      for (const sel of (elem.selectors || [])) {
        allSelectors.push(sel);
      }
    }
  }

  // Stability stats
  const stabilityStats = computeStabilityStats(allSelectors);

  // ATS detection
  const ats = detectATS(primaryLog);

  // Confidence scoring
  const confidence = computeConfidence(categorized, stabilityStats);

  // Career URL
  const careerUrl = extractCareerUrl(primaryLog, mergedLinks);

  // Company info
  const info = getCompanyInfo(domain);

  // Domain pattern
  const pattern = buildDomainPattern(domain, careerUrl);

  // Build selectors object
  const selectorsObj = buildSelectorsObject(categorized);

  // Build workflows
  const hasCookie = categorized.cookieDismiss && categorized.cookieDismiss.length > 0;
  const workflows = buildWorkflows(categorized, careerUrl, hasCookie);

  // Build warnings
  const warnings = buildWarnings(stabilityStats, ats, categorized);

  // Generate guide content
  let content;
  if (confidence === 'LOW') {
    content = generateLowConfidenceGuide(info.name, domain, careerUrl, pattern, ats, selectorsObj);
  } else {
    content = generateGuideContent(
      info.name, domain, confidence, ats, careerUrl, pattern,
      selectorsObj, workflows, warnings
    );
  }

  return {
    fileName: info.file + '.js',
    content,
    companyName: info.name,
    confidence,
    ats,
    selectorCount: allSelectors.length,
    categories: Object.keys(categorized).filter(k => categorized[k].length > 0 && k !== 'cookieDismiss')
  };
}

function main() {
  console.log('=== FSB Research Log Parser ===');
  console.log('');

  // Step 1: Scan
  console.log('Step 1: Scanning research logs...');
  const { logs, googleLogs } = scanLogFiles();
  console.log('  Found ' + logs.length + ' career logs, ' + googleLogs.length + ' Google search logs');
  console.log('');

  // Step 2: Group by company
  console.log('Step 2: Grouping by company...');
  const groups = groupByCompany(logs);
  console.log('  ' + groups.size + ' unique companies');
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(GUIDES_DIR)) {
    fs.mkdirSync(GUIDES_DIR, { recursive: true });
  }

  // Process each company
  console.log('Step 3-8: Processing companies...');
  const results = [];
  const generatedFiles = [];

  for (const [domain, sessions] of groups) {
    const result = processCompany(domain, sessions);
    results.push(result);

    const filePath = path.join(GUIDES_DIR, result.fileName);
    fs.writeFileSync(filePath, result.content, 'utf8');
    generatedFiles.push(result.fileName);

    console.log('  ' + result.companyName.padEnd(25) +
      ' [' + result.confidence + '] ' +
      (result.ats ? 'ATS:' + result.ats + ' ' : '') +
      result.selectorCount + ' selectors, ' +
      result.categories.length + ' categories -> ' +
      result.fileName);
  }

  // Handle Google search logs
  console.log('');
  console.log('Processing Google search logs...');
  const googleGuides = handleGoogleSearchLogs(googleLogs);
  for (const guide of googleGuides) {
    const filePath = path.join(GUIDES_DIR, guide.fileName);
    fs.writeFileSync(filePath, guide.content, 'utf8');
    generatedFiles.push(guide.fileName);
    results.push({
      fileName: guide.fileName,
      companyName: guide.companyName,
      confidence: 'LOW',
      ats: null,
      selectorCount: 0,
      categories: []
    });
    console.log('  ' + guide.companyName.padEnd(25) + ' [LOW] URL-only guide -> ' + guide.fileName);
  }

  // Step 9: Print importScripts lines for background.js reference
  console.log('');
  console.log('=== Generated ' + generatedFiles.length + ' guide files ===');
  console.log('');

  // Summary
  const highCount = results.filter(r => r.confidence === 'HIGH').length;
  const medCount = results.filter(r => r.confidence === 'MEDIUM').length;
  const lowCount = results.filter(r => r.confidence === 'LOW').length;
  console.log('Confidence breakdown: HIGH=' + highCount + ', MEDIUM=' + medCount + ', LOW=' + lowCount);

  const atsCompanies = results.filter(r => r.ats);
  if (atsCompanies.length > 0) {
    console.log('ATS detected: ' + atsCompanies.map(r => r.companyName + '(' + r.ats + ')').join(', '));
  }

  console.log('');
  console.log('importScripts lines for background.js (add after existing career guides, before generic.js):');
  console.log('');

  // Sort alphabetically for clean output
  generatedFiles.sort();
  for (const file of generatedFiles) {
    console.log("importScripts('site-guides/career/" + file + "');");
  }

  console.log('');
  console.log('Done.');
}

main();
