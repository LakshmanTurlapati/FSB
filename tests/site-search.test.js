/**
 * Tests for detectSiteSearchInput and tools.siteSearch
 *
 * These tests validate the site-aware search functionality:
 * - detectSiteSearchInput: 5-tier DOM heuristic cascade for finding search inputs
 * - tools.siteSearch: site-native search with Google fallback
 *
 * Run in browser console on any page after FSB content scripts are loaded,
 * or use as a specification reference.
 */

/* eslint-disable no-console */

(function runSiteSearchTests() {
  'use strict';

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`  PASS: ${message}`);
    } else {
      failed++;
      console.error(`  FAIL: ${message}`);
    }
  }

  function assertEqual(actual, expected, message) {
    assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
  }

  // -- Test 1: detectSiteSearchInput finds input[type="search"] --
  console.log('Test 1: detectSiteSearchInput finds input[type="search"]');
  (function() {
    const container = document.createElement('div');
    container.innerHTML = '<input type="search" id="test-search-1" />';
    document.body.appendChild(container);

    const result = FSB.detectSiteSearchInput();
    assert(result !== null, 'Should find search input');
    if (result) {
      assertEqual(result.element.id, 'test-search-1', 'Should find the correct element');
      assertEqual(result.tier, 1, 'Should match tier 1');
    }

    container.remove();
  })();

  // -- Test 2: Priority -- visible in-viewport input preferred --
  console.log('Test 2: When multiple search inputs exist, returns visible in-viewport one');
  (function() {
    const container = document.createElement('div');
    // Hidden input
    container.innerHTML = `
      <input type="search" id="hidden-search" style="display:none" />
      <input type="search" id="visible-search" />
    `;
    document.body.appendChild(container);

    const result = FSB.detectSiteSearchInput();
    assert(result !== null, 'Should find a search input');
    if (result) {
      assertEqual(result.element.id, 'visible-search', 'Should prefer visible input');
    }

    container.remove();
  })();

  // -- Test 3: Selector cascade priority --
  console.log('Test 3: detectSiteSearchInput tries selectors in priority order');
  (function() {
    const container = document.createElement('div');
    // Only tier 3 and tier 4 present -- should pick tier 3
    container.innerHTML = `
      <input name="q" id="tier3-input" />
      <input placeholder="Search..." id="tier4-input" />
    `;
    document.body.appendChild(container);

    const result = FSB.detectSiteSearchInput();
    assert(result !== null, 'Should find an input');
    if (result) {
      assertEqual(result.element.id, 'tier3-input', 'Should prefer tier 3 over tier 4');
      assertEqual(result.tier, 3, 'Should report correct tier');
    }

    container.remove();
  })();

  // -- Test 4: Returns null when no search input exists --
  console.log('Test 4: detectSiteSearchInput returns null on page with no search input');
  (function() {
    // Create a clean container with only non-search elements
    const container = document.createElement('div');
    container.innerHTML = '<input type="text" id="not-search" /><button>Click</button>';
    document.body.appendChild(container);

    // Remove any existing search inputs temporarily
    const existingSearchInputs = document.querySelectorAll(
      'input[type="search"], [role="search"] input, input[name="q"], input[name="query"], input[name="search_query"], input[name="search"], input[name="keyword"], input[name="keywords"]'
    );
    const hidden = [];
    existingSearchInputs.forEach(el => {
      hidden.push({ el, display: el.style.display });
      el.style.display = 'none';
    });

    // Also hide placeholder-based matches
    const placeholderMatches = document.querySelectorAll(
      'input[placeholder*="Search" i], input[aria-label*="search" i], textarea[placeholder*="Search" i]'
    );
    placeholderMatches.forEach(el => {
      hidden.push({ el, display: el.style.display });
      el.style.display = 'none';
    });

    // Also hide form[action*=search] matches
    const formMatches = document.querySelectorAll(
      'form[action*="search"] input[type="text"], form[action*="search"] input:not([type])'
    );
    formMatches.forEach(el => {
      hidden.push({ el, display: el.style.display });
      el.style.display = 'none';
    });

    const result = FSB.detectSiteSearchInput();
    // Note: result may not be null if the host page has search inputs we didn't hide
    // This test is best run on a blank page

    // Restore hidden elements
    hidden.forEach(({ el, display }) => { el.style.display = display; });
    container.remove();

    assert(result === null, 'Should return null when no search input visible');
  })();

  // -- Test 5: tools.siteSearch success path --
  console.log('Test 5: tools.siteSearch focuses input, types query, submits');
  (async function() {
    const container = document.createElement('div');
    container.innerHTML = `
      <form id="test-form" action="/search">
        <input type="search" id="test-site-search" />
        <button type="submit">Go</button>
      </form>
    `;
    document.body.appendChild(container);

    // Prevent actual navigation
    const form = container.querySelector('form');
    form.addEventListener('submit', (e) => e.preventDefault());

    const result = await FSB.tools.siteSearch({ query: 'test query' });

    assert(result.success === true, 'Should return success');
    assertEqual(result.method, 'site-search', 'Should use site-search method');
    assertEqual(result.query, 'test query', 'Should echo the query');

    container.remove();
  })();

  // -- Test 6: tools.siteSearch fallback to Google --
  console.log('Test 6: tools.siteSearch falls back to Google when no search input');
  (async function() {
    // Hide all search inputs
    const allSearchable = document.querySelectorAll(
      'input[type="search"], [role="search"] input, input[name="q"], input[name="query"], input[name="search"], input[placeholder*="Search" i], form[action*="search"] input'
    );
    const hidden = [];
    allSearchable.forEach(el => {
      hidden.push({ el, display: el.style.display });
      el.style.display = 'none';
    });

    // Mock searchGoogle to prevent actual navigation
    const originalSearchGoogle = FSB.tools.searchGoogle;
    let searchGoogleCalled = false;
    FSB.tools.searchGoogle = (params) => {
      searchGoogleCalled = true;
      return { success: true, searchingFor: params.query, url: `https://www.google.com/search?q=${encodeURIComponent(params.query)}` };
    };

    const result = await FSB.tools.siteSearch({ query: 'fallback test' });

    assert(searchGoogleCalled, 'Should call searchGoogle as fallback');
    assert(result.success === true, 'Should return success from fallback');
    assertEqual(result.method, 'google-fallback', 'Should report google-fallback method');

    // Restore
    FSB.tools.searchGoogle = originalSearchGoogle;
    hidden.forEach(({ el, display }) => { el.style.display = display; });
  })();

  // -- Summary --
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  return { passed, failed };
})();
