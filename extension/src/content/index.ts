// extension/src/content/index.ts
// Content script that runs on all pages for text extraction

import { browser } from '../shared/browser';
import type { ExtractionResult } from '../shared/types';

// Listen for extraction requests from background script
browser.runtime.onMessage.addListener(async (msg: unknown): Promise<unknown> => {
  const message = msg as { type: string };

  if (message.type === 'EXTRACT_TEXT') {
    return extractText();
  }

  return undefined;
});

function extractText(): ExtractionResult {
  const MAX_CHARS = 30000;

  const BOILERPLATE_SELECTORS = [
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '.nav',
    '.navbar',
    '.header',
    '.footer',
    '.sidebar',
    '.advertisement',
    '.ad',
    '.ads',
    '[class*="cookie"]',
    'script',
    'style',
    'noscript',
    'iframe',
  ];

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

  const isPDF =
    document.contentType === 'application/pdf' ||
    window.location.pathname.endsWith('.pdf');

  try {
    const clone = document.body.cloneNode(true) as HTMLElement;

    BOILERPLATE_SELECTORS.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    let text = clone.innerText.replace(/\s+/g, ' ').trim();

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
  } catch {
    return {
      success: false,
      text: '',
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: 'EXTRACTION_FAILED',
    };
  }
}

console.log('[DocMind] Content script loaded');
