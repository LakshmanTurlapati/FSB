/**
 * Shared Category Guidance: Career & Job Search
 * Category-level guidance that applies to all career and job search sites.
 */

registerCategoryGuidance({
  category: 'Career & Job Search',
  icon: 'fa-briefcase',
  guidance: `CAREER & JOB SEARCH INTELLIGENCE:

STRATEGY PRIORITY -- ALWAYS follow this order:
1. DIRECT COMPANY CAREER PAGE (PRIMARY): Navigate to [company].com/careers or [company].com/jobs first.
   - Google search: "[company name] careers" or "[company name] jobs"
   - Click the OFFICIAL company careers link (not Indeed/Glassdoor mirrors)
   - Company career pages have the most accurate, up-to-date listings
2. THIRD-PARTY JOB BOARDS (FALLBACK ONLY): Use Indeed, Glassdoor, BuiltIn, LinkedIn Jobs only if:
   - The company does not have a direct careers page
   - The direct careers page has no relevant listings
   - The user explicitly requests a specific job board

REQUIRED DATA FIELDS (extract ALL 6 for each job):
1. Company Name -- the employer
2. Role/Title -- exact job title as listed
3. Date Posted -- when the listing was posted (or "Not listed" if unavailable)
4. Location -- city/state, "Remote", or "Hybrid"
5. Description Summary -- 1-2 sentence summary of the role responsibilities
6. Apply Link -- the direct URL to apply

SEARCH & FILTER WORKFLOW:
- Look for search/filter inputs on career pages (role, location, department)
- Type the relevant search term (e.g., "software engineer", "product manager")
- Apply location filters if the user specified a location
- Scroll through results to find matching positions
- Click into individual job listings to extract full details

RELEVANCE FILTERING:
- If user says "find jobs at [company]" with no role specified, extract the first 3-5 listings
- If user specifies a role, only extract matching roles
- Skip internships unless explicitly requested
- Skip roles that are clearly unrelated to the search term`,
  warnings: [
    'Sponsored/promoted job listings appear first on job boards -- skip unless no organic results match',
    'Many job boards require login to see full job descriptions or apply',
    'Do NOT construct company career URLs from guesswork -- always Google search first to find the actual careers page',
    'Job listings may have expired -- check the date posted',
    'Some career pages are single-page apps that load dynamically -- wait for content after navigation'
  ]
});
