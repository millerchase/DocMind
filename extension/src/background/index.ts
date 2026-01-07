// extension/src/background/index.ts
// Runs as Service Worker (MV3) or persistent background page (MV2)
// Uses message-passing to content script for cross-browser compatibility

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
    // Send message to content script for extraction
    // Works on both MV2 and MV3 via webextension-polyfill
    const result = await browser.tabs.sendMessage(tabId, { type: 'EXTRACT_TEXT' });
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
