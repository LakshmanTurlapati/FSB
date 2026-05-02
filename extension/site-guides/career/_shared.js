/**
 * Shared Category Guidance: Career & Job Search
 * Category-level guidance that applies to all career and job search sites.
 */

registerCategoryGuidance({
  category: 'Career & Job Search',
  icon: 'fa-briefcase',
  guidance: `CAREER & JOB SEARCH INTELLIGENCE:

COOKIE BANNER DISMISSAL (DO THIS FIRST):
- Before interacting with ANY career page element, check for cookie consent or privacy banners
- Look for buttons with text: "Accept", "Accept All", "I Accept", "Got it", "OK", "Agree", "Close"
- Common cookie banner selectors: #onetrust-accept-btn-handler, [id*="cookie"] button, [class*="cookie-accept"]
- Click the accept/dismiss button. If no banner is visible, proceed immediately
- Do NOT spend more than one action on cookie dismissal. If the first click does not dismiss it, proceed with the task

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
- Skip roles that are clearly unrelated to the search term

ERROR REPORTING (use these exact formats):
- If search returns no results: report "NO RESULTS: [Company] career page returned 0 results for '[search term]'. Try broadening search terms or checking the career page directly at [URL]."
- If login/auth wall blocks access: report "AUTH REQUIRED: [Company] requires login to view job listings. Career page: [URL]"
- If career page is unreachable or broken: report "PAGE ERROR: Could not access [Company] career page at [URL]. The site may be temporarily unavailable."
- If no site guide exists for the company: report "NO GUIDE: No career intelligence for [Company]. Attempting Google search for '[Company] careers'..."
- NEVER silently fail. Always report what happened and suggest next steps.

AUTH REQUIRED HANDOFF:
- Keep the "AUTH REQUIRED:" wording, but if useful research is already complete treat it as a partial/manual handoff rather than a crash-style failure.
- Preserve the jobs or company research already collected, the exact blocker that stopped the last step, and the next step the user should take after logging in or getting access.
- If the wall appears before any useful results are gathered, use the "AUTH REQUIRED:" report directly. If it appears after useful work is done, preserve that work and end with partial_task semantics instead of discarding it.`,
  warnings: [
    'Sponsored/promoted job listings appear first on job boards -- skip unless no organic results match',
    'Many job boards require login to see full job descriptions or apply',
    'Do NOT construct company career URLs from guesswork -- always Google search first to find the actual careers page',
    'Job listings may have expired -- check the date posted',
    'Some career pages are single-page apps that load dynamically -- wait for content after navigation',
    'Cookie consent banners can block interaction with page elements -- dismiss BEFORE searching',
    'Report all failures explicitly -- never complete silently when no jobs were extracted'
  ]
});
