// extension/src/background/index.ts
// Runs as Service Worker (MV3) or persistent background page (MV2)
// NOTE: Needs refactoring for Firefox cross-browser support (browser.scripting API differences)

import { browser } from '../shared/browser';
import type { ExtractionResult } from '../shared/types';
import { CONTEXT_MENU_CONFIG } from '../shared/constants';

// Ephemeral state for context menu flow
const pendingContextByTabId = new Map<number, {
  selectionText: string;
  createdAt: number;
}>();
let lastPendingTabId: number | null = null;

// Register context menu on install
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'ask-docmind',
    title: 'Ask DocMind about this',
    contexts: ['selection'],
  });
});

// Context menu click handler
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ask-docmind' && info.selectionText && tab?.id) {
    const selection = info.selectionText.trim();

    if (selection.length < CONTEXT_MENU_CONFIG.MIN_SELECTION_CHARS) {
      return;
    }

    const truncated = selection.length > CONTEXT_MENU_CONFIG.MAX_SELECTION_CHARS
      ? selection.slice(0, CONTEXT_MENU_CONFIG.MAX_SELECTION_CHARS) + '...'
      : selection;

    pendingContextByTabId.set(tab.id, {
      selectionText: truncated,
      createdAt: Date.now(),
    });
    lastPendingTabId = tab.id;

    // Best-effort popup open (MV3 Chrome/Edge only)
    if (typeof chrome !== 'undefined' && chrome.action?.openPopup) {
      chrome.action.openPopup().catch(() => {
        // Silently fail - user can click icon manually
      });
    }
  }
});

// Message types
interface ExtractTextMessage {
  type: 'EXTRACT_TEXT';
  tabId: number;
}

interface GetPendingContextMessage {
  type: 'GET_PENDING_CONTEXT';
}

interface ClearPendingContextMessage {
  type: 'CLEAR_PENDING_CONTEXT';
}

type BackgroundMessage = ExtractTextMessage | GetPendingContextMessage | ClearPendingContextMessage;

// Message listener - uses async pattern for webextension-polyfill compatibility
browser.runtime.onMessage.addListener(async (msg: unknown): Promise<unknown> => {
  const message = msg as BackgroundMessage;

  if (message.type === 'EXTRACT_TEXT') {
    try {
      return await handleExtraction(message.tabId);
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

  if (message.type === 'GET_PENDING_CONTEXT') {
    const tabId = lastPendingTabId;
    const pending = tabId ? pendingContextByTabId.get(tabId) : null;

    // Check TTL
    if (pending && Date.now() - pending.createdAt > CONTEXT_MENU_CONFIG.PENDING_CONTEXT_TTL_MS) {
      pendingContextByTabId.delete(tabId!);
      lastPendingTabId = null;
      return { type: 'PENDING_CONTEXT', payload: null };
    }

    return {
      type: 'PENDING_CONTEXT',
      payload: pending ? { kind: 'selection', tabId, ...pending } : null,
    };
  }

  if (message.type === 'CLEAR_PENDING_CONTEXT') {
    if (lastPendingTabId) {
      pendingContextByTabId.delete(lastPendingTabId);
      lastPendingTabId = null;
    }
    return { success: true };
  }

  return undefined;
});

async function handleExtraction(tabId: number): Promise<ExtractionResult> {
  if (typeof tabId !== 'number') {
    return {
      success: false,
      text: '',
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: 'CANNOT_ACCESS_PAGE',
    };
  }

  try {
    // Use scripting API for MV3, fallback handled by polyfill
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: extractTextInPage,
    });

    const result = results?.[0]?.result;
    if (!result) {
      return {
        success: false,
        text: '',
        charCount: 0,
        truncated: false,
        isPDF: false,
        error: 'EXTRACTION_FAILED',
      };
    }

    return result as ExtractionResult;
  } catch {
    return {
      success: false,
      text: '',
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: 'CANNOT_ACCESS_PAGE',
    };
  }
}

// This function runs in the PAGE context, not the service worker
// It must be completely self-contained (no imports, no external references)
function extractTextInPage(): ExtractionResult {
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
