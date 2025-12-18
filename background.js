// When extension icon is clicked, inject script to grab job details and copy to clipboard
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Inject the content script to extract job details
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractAndCopyJobDetails
    });

    // Check if we got results
    if (results && results[0] && results[0].result) {
      console.log('Job details copied to clipboard!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// This function runs in the context of the page
function extractAndCopyJobDetails() {
  let companyName = '';
  let roleName = '';
  let jobDescription = '';

  const url = window.location.href.toLowerCase();

  // LinkedIn job page detection - broader check to catch all LinkedIn job page variants
  if (url.includes('linkedin.com') && (url.includes('/jobs') || url.includes('/job'))) {
    // Get the full page text for parsing
    const fullPageText = document.body.innerText || document.body.textContent || '';

    // Company name - try multiple selectors for different LinkedIn layouts (updated for 2024/2025)
    const companySelectors = [
      // New LinkedIn UI selectors (2024/2025)
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__primary-description-container a',
      '.job-details-jobs-unified-top-card__primary-description a',
      // Job details panel selectors
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__primary-description a',
      // Legacy/alternative selectors
      '.topcard__org-name-link',
      '.top-card-layout__card .topcard__org-name-link',
      '[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '.jobs-company__name',
      '.jobs-details-top-card__company-url',
      '.job-view-layout .jobs-unified-top-card__company-name',
      '.artdeco-entity-lockup__subtitle',
      '.company-name-link',
      '.employer-name',
      // Generic company link fallback
      'a[href*="/company/"]'
    ];

    for (const selector of companySelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim() && el.textContent.trim().length < 150) {
        // Skip if it looks like a location or other metadata
        const text = el.textContent.trim();
        if (!text.includes('·') && !text.includes('applicant')) {
          companyName = text;
          break;
        }
      }
    }

    // Role/Job title - try multiple selectors (updated for 2024/2025)
    const roleSelectors = [
      // New LinkedIn UI selectors
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title a',
      '.job-details-jobs-unified-top-card__job-title',
      // Job details panel selectors
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title a',
      '.jobs-unified-top-card__job-title',
      // Legacy/alternative selectors
      '.topcard__title',
      '.top-card-layout__title',
      'h1.t-24',
      'h1.t-bold',
      '.job-view-layout .jobs-unified-top-card__job-title',
      '.artdeco-entity-lockup__title',
      // Generic h1 fallback for job title
      '.jobs-details h1',
      'h1[class*="job"]'
    ];

    for (const selector of roleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        roleName = el.textContent.trim();
        break;
      }
    }

    // If role not found via selectors, try to extract from text pattern
    // Look for text right after company name at the start of the page
    if (!roleName && companyName) {
      // Pattern: CompanyNameRoleName Location · time ago
      const companyIndex = fullPageText.indexOf(companyName);
      if (companyIndex !== -1) {
        const afterCompany = fullPageText.substring(companyIndex + companyName.length);
        // Extract text before location pattern (City, State or just · time ago)
        const locationMatch = afterCompany.match(/^([A-Za-z\s&\-,]+?)(?:\s+[A-Z][a-z]+,\s*[A-Z]{2}|\s+·|\s+\d+\s+(?:hour|day|week|month))/);
        if (locationMatch && locationMatch[1].trim().length > 3 && locationMatch[1].trim().length < 100) {
          roleName = locationMatch[1].trim();
        }
      }
    }

    // Job description - FIRST try CSS selectors (more reliable), then fall back to text parsing
    const descSelectors = [
      // New LinkedIn UI selectors (2024/2025)
      '.jobs-description__content',
      '.jobs-description-content__text',
      '.jobs-box__html-content',
      '.show-more-less-html__markup',
      '#job-details',
      '.description__text',
      '.jobs-description',
      // Additional fallback selectors
      '[class*="jobs-description"]',
      '[class*="job-description"]',
      '.job-view-layout [class*="description"]'
    ];

    for (const selector of descSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 100) {
        jobDescription = el.textContent.trim();
        // Clean up the description - remove excessive whitespace
        jobDescription = jobDescription.replace(/\n{3,}/g, '\n\n').trim();
        break;
      }
    }

    // Fallback: try text parsing if selectors didn't work
    if (!jobDescription || jobDescription.length < 100) {
      const aboutJobIndex = fullPageText.indexOf('About the job');
      if (aboutJobIndex !== -1) {
        let descText = fullPageText.substring(aboutJobIndex + 'About the job'.length);

        // Find where the job description ends (common footer/sidebar markers)
        const endMarkers = [
          'Benefits found in job post',
          'Set alert for similar jobs',
          'About the company',
          'People also viewed',
          'Similar jobs',
          'Job search faster with Premium',
          'Job search smarter with Premium',
          'Looking for talent?',
          'Interested in working with us',
          'About\nAccessibility',
          'LinkedIn Corporation',
          'Show more',
          'Show less'
        ];

        let endIndex = descText.length;
        for (const marker of endMarkers) {
          const markerIndex = descText.indexOf(marker);
          if (markerIndex !== -1 && markerIndex < endIndex) {
            endIndex = markerIndex;
          }
        }

        const parsedDesc = descText.substring(0, endIndex).trim().replace(/\n{3,}/g, '\n\n').trim();
        // Only use text parsing if it found more content
        if (parsedDesc.length > (jobDescription?.length || 0)) {
          jobDescription = parsedDesc;
        }
      }
    }
  }
  // Indeed job page detection
  else if (url.includes('indeed.com')) {
    const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"]') ||
      document.querySelector('.jobsearch-InlineCompanyRating-companyHeader') ||
      document.querySelector('.css-1saizt3');
    if (companyEl) companyName = companyEl.textContent.trim();

    const roleEl = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
      document.querySelector('.jobsearch-JobInfoHeader-title') ||
      document.querySelector('h1.jobsearch-JobInfoHeader-title');
    if (roleEl) roleName = roleEl.textContent.trim();

    const descEl = document.querySelector('#jobDescriptionText') ||
      document.querySelector('.jobsearch-jobDescriptionText');
    if (descEl) jobDescription = descEl.textContent.trim();
  }
  // Glassdoor job page detection
  else if (url.includes('glassdoor.com')) {
    const companyEl = document.querySelector('[data-test="employer-name"]') ||
      document.querySelector('.css-87uc0g');
    if (companyEl) companyName = companyEl.textContent.trim();

    const roleEl = document.querySelector('[data-test="job-title"]') ||
      document.querySelector('.css-1vg6q84');
    if (roleEl) roleName = roleEl.textContent.trim();

    const descEl = document.querySelector('.jobDescriptionContent') ||
      document.querySelector('[data-test="description"]');
    if (descEl) jobDescription = descEl.textContent.trim();
  }
  // Lever job page detection
  else if (url.includes('lever.co') || url.includes('jobs.lever.co')) {
    const companyEl = document.querySelector('.main-header-logo img');
    if (companyEl) companyName = companyEl.alt || '';

    const roleEl = document.querySelector('.posting-headline h2');
    if (roleEl) roleName = roleEl.textContent.trim();

    const descEl = document.querySelector('.posting-page') ||
      document.querySelector('.section-wrapper');
    if (descEl) jobDescription = descEl.textContent.trim();
  }
  // Greenhouse job page detection
  else if (url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')) {
    const companyEl = document.querySelector('.company-name') ||
      document.querySelector('#header .logo');
    if (companyEl) companyName = companyEl.textContent?.trim() || companyEl.alt || '';

    const roleEl = document.querySelector('.app-title') ||
      document.querySelector('h1.heading');
    if (roleEl) roleName = roleEl.textContent.trim();

    const descEl = document.querySelector('#content') ||
      document.querySelector('.job-post');
    if (descEl) jobDescription = descEl.textContent.trim();
  }
  // Generic fallback - try common patterns
  else {
    // Try to find company name
    const companySelectors = [
      '[class*="company"]', '[id*="company"]',
      '[class*="employer"]', '[class*="org-name"]'
    ];
    for (const sel of companySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length < 100) {
        companyName = el.textContent.trim();
        break;
      }
    }

    // Try to find job title - usually in h1
    const roleEl = document.querySelector('h1');
    if (roleEl) roleName = roleEl.textContent.trim();

    // Try to find job description
    const descSelectors = [
      '[class*="description"]', '[id*="description"]',
      '[class*="job-details"]', '[class*="posting"]',
      'main', 'article'
    ];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 200) {
        jobDescription = el.textContent.trim();
        break;
      }
    }
  }

  // Format the output
  const output = `Company: ${companyName || 'Not found'}

Role: ${roleName || 'Not found'}

Job Description:
${jobDescription || 'Not found'}`;

  // Copy to clipboard
  navigator.clipboard.writeText(output).then(() => {
    // Show a brief visual feedback
    const notification = document.createElement('div');
    notification.textContent = '✓ Job details copied!';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10B981;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);

    // Remove after 2 seconds
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  });

  return true;
}
