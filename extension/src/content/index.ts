// extension/src/content/index.ts
// Content script that runs on all pages for text extraction and highlighting

import { browser } from '../shared/browser';
import type { ExtractionResult, Citation, UnsupportedReason, MatchResult } from '../shared/types';
import { SafeHighlighter } from './highlighter';
import { PageIndexer, type PageIndex } from './pageIndexer';
import { classifyPage } from './pageClassifier';
import { matchCitations } from './citationMatcher';

const highlighter = new SafeHighlighter();
const indexer = new PageIndexer();
let currentIndex: PageIndex | null = null;

highlighter.setupAutoCleanup();

// Listen for messages from background script and popup
browser.runtime.onMessage.addListener(async (msg: unknown): Promise<unknown> => {
  const message = msg as { type: string; tabId?: number; citations?: Citation[]; citationId?: string };

  if (message.type === 'EXTRACT_TEXT') {
    return extractText();
  }

  if (message.type === 'PING') {
    return { type: 'PONG' };
  }

  if (message.type === 'BUILD_INDEX') {
    const support = classifyPage();
    if (!support.supported) {
      return { type: 'PAGE_UNSUPPORTED', reason: support.reason };
    }

    const result = indexer.buildIndex(message.tabId ?? 0);
    if ('error' in result) {
      return { type: 'PAGE_UNSUPPORTED', reason: result.error as UnsupportedReason };
    }

    currentIndex = result;
    return { type: 'INDEX_BUILT', segmentCount: result.segments.length };
  }

  if (message.type === 'MATCH_CITATIONS') {
    if (!currentIndex) {
      return { type: 'MATCH_RESULTS', results: [] };
    }

    const citations = message.citations ?? [];
    const results = matchCitations(citations, currentIndex);
    return { type: 'MATCH_RESULTS', results };
  }

  if (message.type === 'INJECT_HIGHLIGHTS') {
    highlighter.cleanup();

    if (!currentIndex) {
      return { type: 'HIGHLIGHTS_INJECTED', results: [] };
    }

    const citations = message.citations ?? [];
    const matchResults = matchCitations(citations, currentIndex);
    const matchMap = new Map(matchResults.map(r => [r.citationId, r]));

    // Sort injections by segmentIndex descending to reduce DOM mutation issues
    const plan = citations
      .map(citation => ({ citation, match: matchMap.get(citation.id) }))
      .filter((p): p is { citation: Citation; match: MatchResult } =>
        p.match?.status === 'matched' && p.match.segmentIndex !== undefined)
      .sort((a, b) => b.match.segmentIndex! - a.match.segmentIndex!);

    const injectedById = new Map<string, boolean>();

    for (const { citation, match } of plan) {
      const segment = currentIndex.segments[match.segmentIndex!];
      injectedById.set(citation.id, highlighter.inject(citation, segment));
    }

    const results = citations.map(c => ({
      citationId: c.id,
      injected: injectedById.get(c.id) ?? false,
    }));

    return { type: 'HIGHLIGHTS_INJECTED', results };
  }

  if (message.type === 'SCROLL_TO') {
    if (message.citationId) {
      highlighter.scrollTo(message.citationId);
    }
    return { success: true };
  }

  if (message.type === 'CLEAR_HIGHLIGHTS') {
    highlighter.cleanup();
    return { success: true };
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
