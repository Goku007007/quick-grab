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
      // Latest LinkedIn UI selectors (December 2024/2025)
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.artdeco-entity-lockup__subtitle a',
      '.artdeco-entity-lockup__subtitle span a',
      // Company name in the top card area - new structure
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.t-black a[href*="/company/"]',
      // Primary description container
      '.job-details-jobs-unified-top-card__primary-description-container a',
      '.job-details-jobs-unified-top-card__primary-description a',
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
      // Generic company link fallback - look for company page link near job header
      'a[href*="/company/"][class*="app-aware"]'
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

    // Fallback: Find company name by looking for company links in the top card area
    if (!companyName) {
      // Look for a link that goes to /company/ within the job details area
      const topCardArea = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane') ||
        document.querySelector('.jobs-unified-top-card') ||
        document.querySelector('[class*="top-card"]') ||
        document.querySelector('main');

      if (topCardArea) {
        const companyLinks = topCardArea.querySelectorAll('a[href*="/company/"]');
        for (const link of companyLinks) {
          const text = link.textContent.trim();
          // Skip if it's not a reasonable company name
          if (text && text.length > 2 && text.length < 100 && !text.includes('·')) {
            companyName = text;
            break;
          }
        }
      }
    }

    // Ultimate fallback: Search all elements for text that appears before the location
    if (!companyName) {
      // In LinkedIn job pages, company name typically appears right after the job title
      // Look for pattern: "Company Name" followed by location info
      const allLinks = Array.from(document.querySelectorAll('a'));
      const companyLink = allLinks.find(el =>
        el.href && el.href.includes('/company/') &&
        el.textContent.trim().length > 2 &&
        el.textContent.trim().length < 100 &&
        !el.textContent.includes('·') &&
        !el.textContent.includes('applicant')
      );
      if (companyLink) {
        companyName = companyLink.textContent.trim();
      }
    }

    // Role/Job title - try multiple selectors (updated for 2024/2025)
    const roleSelectors = [
      // Latest LinkedIn UI selectors (December 2024/2025)
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title a',
      '.job-details-jobs-unified-top-card__job-title',
      '.artdeco-entity-lockup__title h1',
      '.artdeco-entity-lockup__title a',
      '.artdeco-entity-lockup__title',
      // Job details panel selectors
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title a',
      '.jobs-unified-top-card__job-title',
      // H1 with common LinkedIn title classes
      'h1.t-24.t-bold',
      'h1.t-24',
      'h1.t-bold',
      // Legacy/alternative selectors
      '.topcard__title',
      '.top-card-layout__title',
      '.job-view-layout .jobs-unified-top-card__job-title',
      // Generic h1 fallback for job title
      '.jobs-details h1',
      'h1[class*="job"]',
      // Main content area h1 as last resort
      'main h1'
    ];

    for (const selector of roleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        const text = el.textContent.trim();
        const textLower = text.toLowerCase();
        // Filter out LinkedIn UI elements
        if (text.length >= 2 && text.length < 100 &&
          !text.includes('·') &&
          !text.includes('applicant') &&
          !textLower.includes('job search') &&
          !textLower.includes('premium') &&
          !textLower.includes('use ai to assess') &&
          !textLower.includes('how you fit') &&
          !textLower.includes('match details') &&
          !textLower.includes('help me stand out') &&
          !textLower.includes('people you can reach') &&
          !textLower.includes('meet the hiring') &&
          !textLower.includes('compare to') &&
          !textLower.includes('clicked apply') &&
          !textLower.includes('reactivate premium') &&
          !textLower.includes('about the job') &&
          !textLower.includes('about the company')) {
          roleName = text;
          break;
        }
      }
    }

    // NEW FALLBACK: Find role by looking for text element near company link
    // Some LinkedIn pages use <p> tags with obfuscated classes for job titles
    if (!roleName && companyName) {
      // Find the company link element
      const companyLink = Array.from(document.querySelectorAll('a')).find(el =>
        el.href && el.href.includes('/company/') &&
        el.textContent.trim() === companyName
      );

      if (companyLink) {
        // Look for siblings or nearby elements that could be the job title
        // The job title is usually a sibling of the company link's parent
        let parent = companyLink.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          // Look for text elements within this container
          const textElements = parent.querySelectorAll('h1, h2, h3, p, span, a');
          for (const el of textElements) {
            const text = el.textContent.trim();
            const textLower = text.toLowerCase();
            // Job titles are short, don't contain certain patterns, and aren't the company name
            if (text && text.length >= 3 && text.length < 80 &&
              text !== companyName &&
              !text.includes('·') &&
              !text.includes('applicant') &&
              !text.includes('ago') &&
              !textLower.includes('on-site') &&
              !textLower.includes('remote') &&
              !textLower.includes('hybrid') &&
              !textLower.includes('full-time') &&
              !textLower.includes('part-time') &&
              !textLower.includes('contract') &&
              !textLower.includes('apply') &&
              !textLower.includes('save') &&
              !textLower.includes('promoted') &&
              !textLower.includes('responses') &&
              !textLower.includes('job search') &&
              !textLower.includes('premium') &&
              !textLower.includes('use ai') &&
              !textLower.includes('about the job') &&
              !textLower.includes('about the company') &&
              // Check if it's short enough to be a job title and doesn't look like a location
              !text.match(/^[A-Z][a-z]+,\s+[A-Z]{2}$/) && // e.g., "Austin, TX"
              !text.match(/^\d+/) // Doesn't start with a number
            ) {
              roleName = text;
              break;
            }
          }
          if (roleName) break;
          parent = parent.parentElement;
        }
      }
    }

    // Fallback: Find role by looking for h1/h2 in the top card or main content area
    if (!roleName) {
      const topCardArea = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane') ||
        document.querySelector('.jobs-unified-top-card') ||
        document.querySelector('[class*="top-card"]') ||
        document.querySelector('main');

      if (topCardArea) {
        // Look for h1 or h2 elements that could be job titles
        const headings = topCardArea.querySelectorAll('h1, h2');
        for (const heading of headings) {
          const text = heading.textContent.trim();
          const textLower = text.toLowerCase();
          // Job titles are typically 2-100 characters and don't contain certain patterns
          // Exclude LinkedIn UI elements that appear as headings
          if (text && text.length >= 2 && text.length < 100 &&
            !text.includes('·') &&
            !text.includes('applicant') &&
            !textLower.includes('job search') &&
            !textLower.includes('premium') &&
            !textLower.includes('use ai to assess') &&
            !textLower.includes('how you fit') &&
            !textLower.includes('match details') &&
            !textLower.includes('help me stand out') &&
            !textLower.includes('people you can reach') &&
            !textLower.includes('meet the hiring') &&
            !textLower.includes('compare to') &&
            !textLower.includes('clicked apply') &&
            !textLower.includes('reactivate premium')) {
            roleName = text;
            break;
          }
        }
      }
    }

    // Ultimate fallback: Look for the first meaningful h1 on the page
    if (!roleName) {
      const allH1s = Array.from(document.querySelectorAll('h1'));
      for (const h1 of allH1s) {
        const text = h1.textContent.trim();
        const textLower = text.toLowerCase();
        if (text && text.length >= 2 && text.length < 100 &&
          !text.includes('·') &&
          !textLower.includes('job search') &&
          !textLower.includes('premium') &&
          !textLower.includes('linkedin') &&
          !textLower.includes('use ai to assess') &&
          !textLower.includes('how you fit') &&
          !textLower.includes('match details') &&
          !textLower.includes('help me stand out') &&
          !textLower.includes('people you can reach') &&
          !textLower.includes('meet the hiring') &&
          !textLower.includes('compare to') &&
          !textLower.includes('clicked apply') &&
          !textLower.includes('reactivate premium')) {
          roleName = text;
          break;
        }
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

    // Helper function to convert HTML to formatted text
    function htmlToFormattedText(element) {
      // Clone the element to avoid modifying the original
      const clone = element.cloneNode(true);

      // Replace <br> with newlines
      clone.querySelectorAll('br').forEach(br => {
        br.replaceWith('\n');
      });

      // Add newlines before and after block elements
      const blockElements = clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, ul, ol, section, article');
      blockElements.forEach(el => {
        // For list items, add a bullet point
        if (el.tagName === 'LI') {
          el.prepend('• ');
        }
        // Add newline after block elements
        const textNode = document.createTextNode('\n');
        if (el.nextSibling) {
          el.parentNode.insertBefore(textNode, el.nextSibling);
        } else {
          el.parentNode.appendChild(textNode);
        }
      });

      // Get the text content and clean it up
      let text = clone.textContent || clone.innerText || '';

      // Clean up excessive whitespace while preserving intentional line breaks
      text = text
        .replace(/[ \t]+/g, ' ')          // Replace multiple spaces/tabs with single space
        .replace(/\n /g, '\n')            // Remove leading space after newlines
        .replace(/ \n/g, '\n')            // Remove trailing space before newlines
        .replace(/\n{3,}/g, '\n\n')       // Replace 3+ newlines with double newline
        .trim();

      return text;
    }

    for (const selector of descSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 100) {
        jobDescription = htmlToFormattedText(el);
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
