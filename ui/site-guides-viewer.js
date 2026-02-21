/**
 * Site Guides Viewer
 * Read-only viewer for built-in site guides displayed in the Memory tab.
 * Renders all registered site guides grouped by category with
 * accordion detail panels and collapsible sub-sections.
 */

(function () {
  'use strict';

  // Local HTML escaper (viewer loads before options.js)
  function _escapeGuideHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Category display order -- defines the order categories appear in the viewer.
   */
  const CATEGORY_ORDER = [
    'E-Commerce & Shopping',
    'Social Media',
    'Finance & Trading',
    'Travel & Booking',
    'Email Platforms',
    'Coding Platforms',
    'Career & Job Search',
    'Gaming Platforms',
    'Productivity Tools'
  ];

  /**
   * Initialize the site guides viewer. Called on DOMContentLoaded.
   */
  function initSiteGuidesViewer() {
    if (typeof getSiteGuidesByCategory !== 'function') return;

    const groupedGuides = getSiteGuidesByCategory();
    const totalCount = (typeof getTotalSiteCount === 'function') ? getTotalSiteCount() : 0;

    // Update header count
    const countEl = document.getElementById('siteGuideCount');
    if (countEl) countEl.textContent = totalCount;

    // Render the guide list
    const listEl = document.getElementById('siteGuidesList');
    if (listEl) {
      renderSiteGuidesList(listEl, groupedGuides);
    }

    // Hook into existing memory search input
    const searchInput = document.getElementById('memorySearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        filterSiteGuides(searchInput.value);
      });
    }
  }

  /**
   * Render all categories and sites into the container element.
   * @param {HTMLElement} container - The #siteGuidesList element
   * @param {Object} groupedGuides - Category-name-keyed object of guide arrays
   */
  function renderSiteGuidesList(container, groupedGuides) {
    let html = '';

    // Render categories in defined order, then any remaining
    const orderedCategories = CATEGORY_ORDER.filter(cat => groupedGuides[cat]);
    const extraCategories = Object.keys(groupedGuides).filter(cat => !CATEGORY_ORDER.includes(cat));
    const allCategories = orderedCategories.concat(extraCategories);

    for (const category of allCategories) {
      const guides = groupedGuides[category];
      if (!guides || guides.length === 0) continue;

      const catMeta = (typeof getCategoryGuidance === 'function') ? getCategoryGuidance(category) : null;
      const iconClass = catMeta && catMeta.icon ? catMeta.icon : 'fa-folder';

      html += '<div class="guide-category" data-category="' + _escapeGuideHtml(category) + '">';
      html += '<div class="guide-category-header">';
      html += '<i class="fas fa-chevron-down guide-category-chevron"></i>';
      html += '<i class="fas ' + _escapeGuideHtml(iconClass) + ' guide-category-icon"></i>';
      html += '<span class="guide-category-name">' + _escapeGuideHtml(category) + '</span>';
      html += '<span class="guide-category-count">(' + guides.length + ' site' + (guides.length !== 1 ? 's' : '') + ')</span>';
      html += '</div>';
      html += '<div class="guide-category-sites">';

      for (let i = 0; i < guides.length; i++) {
        const guide = guides[i];
        const siteName = guide.site || 'Unknown';
        // Short badge label: strip common suffixes from category name
        const badgeText = category.replace(/ & .*$/, '').replace(/ Platforms?$/, '').replace(/ Tools?$/, '');

        html += '<div class="guide-item" data-site-index="' + i + '" data-category="' + _escapeGuideHtml(category) + '" data-site-name="' + _escapeGuideHtml(siteName) + '">';
        html += '<div class="guide-item-content">';
        html += '<span class="guide-item-name">' + _escapeGuideHtml(siteName) + '</span>';
        html += '<span class="guide-item-badge">' + _escapeGuideHtml(badgeText) + '</span>';
        html += '</div>';
        html += '<i class="fas fa-chevron-right detail-toggle-icon"></i>';
        html += '</div>';
      }

      html += '</div>'; // guide-category-sites
      html += '</div>'; // guide-category
    }

    container.innerHTML = html;

    // Attach event listeners for category headers and site items
    const categoryHeaders = container.querySelectorAll('.guide-category-header');
    categoryHeaders.forEach(function (header) {
      header.addEventListener('click', function () {
        const category = header.parentElement;
        category.classList.toggle('collapsed');
      });
    });

    const siteItems = container.querySelectorAll('.guide-item');
    siteItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const catName = item.getAttribute('data-category');
        const siteIndex = parseInt(item.getAttribute('data-site-index'), 10);
        const guides = groupedGuides[catName];
        if (guides && guides[siteIndex]) {
          toggleGuideDetail(item, guides[siteIndex]);
        }
      });
    });
  }

  /**
   * Toggle a site guide detail panel (accordion -- one at a time).
   * @param {HTMLElement} siteItem - The .guide-item element
   * @param {Object} guide - The site guide data object
   */
  function toggleGuideDetail(siteItem, guide) {
    // If already expanded, collapse it
    if (siteItem.classList.contains('guide-expanded')) {
      collapseGuideDetail(siteItem);
      return;
    }

    // Collapse any other expanded site (accordion behavior)
    const existingExpanded = document.querySelector('.guide-item.guide-expanded');
    if (existingExpanded) {
      collapseGuideDetail(existingExpanded);
    }

    // Create and insert detail panel
    const panelHtml = renderGuideDetailPanel(guide);
    const panelDiv = document.createElement('div');
    panelDiv.className = 'guide-detail-panel';
    panelDiv.innerHTML = panelHtml;
    siteItem.classList.add('guide-expanded');
    siteItem.after(panelDiv);

    // Attach sub-section toggle handlers
    const subHeaders = panelDiv.querySelectorAll('.guide-subsection-header');
    subHeaders.forEach(function (header) {
      header.addEventListener('click', function () {
        header.parentElement.classList.toggle('collapsed');
      });
    });
  }

  /**
   * Collapse a site guide detail panel.
   * @param {HTMLElement} siteItem - The .guide-item element
   */
  function collapseGuideDetail(siteItem) {
    siteItem.classList.remove('guide-expanded');
    const panel = siteItem.nextElementSibling;
    if (panel && panel.classList.contains('guide-detail-panel')) {
      panel.remove();
    }
  }

  /**
   * Render the detail panel content for a site guide.
   * Sub-sections: Category Guidance, Selectors, Workflows, Warnings, Site Guidance.
   * All sub-sections collapsed by default.
   * @param {Object} guide - The site guide data
   * @returns {string} HTML string
   */
  function renderGuideDetailPanel(guide) {
    let html = '';
    const category = guide.category || '';
    const catMeta = (typeof getCategoryGuidance === 'function') ? getCategoryGuidance(category) : null;

    // 1. Category Guidance (from _shared.js)
    if (catMeta && catMeta.guidance) {
      let catContent = '<pre class="guide-guidance-pre">' + _escapeGuideHtml(catMeta.guidance) + '</pre>';
      if (catMeta.warnings && catMeta.warnings.length > 0) {
        catContent += '<div style="margin-top: 8px;"><strong>Category Warnings:</strong></div>';
        catContent += '<ul class="guide-warnings-list">';
        for (const w of catMeta.warnings) {
          catContent += '<li>' + _escapeGuideHtml(w) + '</li>';
        }
        catContent += '</ul>';
      }
      html += renderGuideSubSection('Category Guidance', catContent, null);
    }

    // 2. Selectors
    if (guide.selectors && typeof guide.selectors === 'object') {
      const entries = Object.entries(guide.selectors);
      if (entries.length > 0) {
        let tableHtml = '<table class="detail-table"><tbody>';
        for (const [name, selector] of entries) {
          tableHtml += '<tr><td class="detail-code">' + _escapeGuideHtml(name) + '</td>';
          tableHtml += '<td class="detail-code">' + _escapeGuideHtml(selector) + '</td></tr>';
        }
        tableHtml += '</tbody></table>';
        html += renderGuideSubSection('Selectors', tableHtml, entries.length);
      }
    }

    // 3. Workflows
    if (guide.workflows && typeof guide.workflows === 'object') {
      const workflowEntries = Object.entries(guide.workflows);
      if (workflowEntries.length > 0) {
        let wfHtml = '';
        for (const [name, steps] of workflowEntries) {
          wfHtml += '<div class="guide-workflow">';
          wfHtml += '<div class="detail-label">' + _escapeGuideHtml(name) + '</div>';
          if (Array.isArray(steps)) {
            wfHtml += '<ol class="detail-list detail-list-ordered">';
            for (const step of steps) {
              wfHtml += '<li>' + _escapeGuideHtml(step) + '</li>';
            }
            wfHtml += '</ol>';
          }
          wfHtml += '</div>';
        }
        html += renderGuideSubSection('Workflows', wfHtml, workflowEntries.length);
      }
    }

    // 4. Warnings
    if (guide.warnings && Array.isArray(guide.warnings) && guide.warnings.length > 0) {
      let warnHtml = '<ul class="guide-warnings-list">';
      for (const w of guide.warnings) {
        warnHtml += '<li>' + _escapeGuideHtml(w) + '</li>';
      }
      warnHtml += '</ul>';
      html += renderGuideSubSection('Warnings', warnHtml, guide.warnings.length);
    }

    // 5. Site Guidance
    if (guide.guidance) {
      const guidanceHtml = '<pre class="guide-guidance-pre">' + _escapeGuideHtml(guide.guidance) + '</pre>';
      html += renderGuideSubSection('Site Guidance', guidanceHtml, null);
    }

    return html;
  }

  /**
   * Render a collapsible sub-section within a guide detail panel.
   * @param {string} title - Sub-section title
   * @param {string} content - Inner HTML content
   * @param {number|null} count - Item count to show in header, or null to omit
   * @returns {string} HTML string
   */
  function renderGuideSubSection(title, content, count) {
    const countBadge = (count !== null && count !== undefined) ? ' (' + count + ')' : '';
    return '<div class="guide-subsection collapsed">' +
      '<div class="guide-subsection-header">' +
      '<i class="fas fa-chevron-right guide-subsection-chevron"></i>' +
      '<span>' + _escapeGuideHtml(title) + countBadge + '</span>' +
      '</div>' +
      '<div class="guide-subsection-content">' +
      content +
      '</div>' +
      '</div>';
  }

  /**
   * Filter site guides based on a search query.
   * Matches against site names and category names (case-insensitive).
   * Uses CSS class toggle, not re-rendering, to preserve collapse state.
   * @param {string} query - Search query string
   */
  function filterSiteGuides(query) {
    const q = (query || '').toLowerCase().trim();
    const categories = document.querySelectorAll('#siteGuidesList .guide-category');

    categories.forEach(function (catEl) {
      const catName = (catEl.getAttribute('data-category') || '').toLowerCase();
      const catMatchesQuery = q === '' || catName.includes(q);
      let hasVisibleSite = false;

      const siteItems = catEl.querySelectorAll('.guide-item');
      siteItems.forEach(function (item) {
        const siteName = (item.getAttribute('data-site-name') || '').toLowerCase();
        if (q === '' || siteName.includes(q) || catMatchesQuery) {
          item.classList.remove('guide-hidden');
          hasVisibleSite = true;
        } else {
          item.classList.add('guide-hidden');
        }
      });

      if (hasVisibleSite || q === '') {
        catEl.classList.remove('guide-hidden');
      } else {
        catEl.classList.add('guide-hidden');
      }
    });
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteGuidesViewer);
  } else {
    initSiteGuidesViewer();
  }
})();
