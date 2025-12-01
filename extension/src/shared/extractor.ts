import { ExtractionResult } from './types';

const MAX_CHARS = 30000;

const BOILERPLATE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.nav', '.navbar', '.header', '.footer', '.sidebar',
  '.advertisement', '.ad', '.ads', '[class*="cookie"]',
  'script', 'style', 'noscript', 'iframe',
];

export function extractText(): ExtractionResult {
  // Guard against null body
  if (!document.body) {
    return {
      success: false,
      text: '',
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: 'NO_BODY_ELEMENT',
    };
  }

  // Detect PDF viewer once, before try block
  const isPDF =
    document.contentType === 'application/pdf' ||
    window.location.pathname.endsWith('.pdf');

  try {
    // Clone body to avoid modifying actual page
    const clone = document.body.cloneNode(true) as HTMLElement;

    // Remove boilerplate elements
    BOILERPLATE_SELECTORS.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Get text content, normalize whitespace
    let text = clone.innerText.replace(/\s+/g, ' ').trim();

    // Handle empty/short content
    if (!text || text.length < 100) {
      return {
        success: false,
        text: '',
        charCount: 0,
        truncated: false,
        isPDF,
        error: 'NO_EXTRACTABLE_TEXT',
      };
    }

    // Truncate if needed
    const truncated = text.length > MAX_CHARS;
    if (truncated) {
      text = text.slice(0, MAX_CHARS);
    }

    return {
      success: true,
      text,
      charCount: text.length,
      truncated,
      isPDF,
    };
  } catch (e) {
    return {
      success: false,
      text: '',
      charCount: 0,
      truncated: false,
      isPDF,
      error: 'EXTRACTION_FAILED',
    };
  }
}
