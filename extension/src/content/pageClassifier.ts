// extension/src/content/pageClassifier.ts
import type { UnsupportedReason } from '../shared/types';

export type PageSupport =
  | { supported: true }
  | { supported: false; reason: UnsupportedReason };

export function classifyPage(): PageSupport {
  const bodyText = document.body?.innerText?.trim().length || 0;

  if (bodyText < 200) {
    return { supported: false, reason: 'insufficient-text' };
  }

  const hasVirtualScroll = document.querySelector(
    '[data-virtualized], [class*="virtualized"], [class*="react-window"], [class*="react-virtual"], [class*="windowed"]'
  ) !== null;
  if (hasVirtualScroll) {
    return { supported: false, reason: 'virtualized-content' };
  }

  if (detectShadowDomContent()) {
    return { supported: false, reason: 'shadow-dom-content' };
  }

  const iframes = document.querySelectorAll('iframe').length;
  if (iframes > 3 && bodyText < 500) {
    return { supported: false, reason: 'iframe-heavy' };
  }

  return { supported: true };
}

function detectShadowDomContent(): boolean {
  if (!document.body) return false;

  const elements = document.body.getElementsByTagName('*');
  let shadowHostCount = 0;
  let customElementCount = 0;
  const MAX_CHECKS = 200;

  for (let i = 0; i < Math.min(elements.length, MAX_CHECKS); i++) {
    const el = elements[i];
    if (!el.tagName.includes('-')) continue;

    customElementCount++;
    if (el.shadowRoot) shadowHostCount++;
    if (shadowHostCount >= 10) return true;
  }

  if (shadowHostCount >= 5 && customElementCount > 0 &&
      shadowHostCount / customElementCount > 0.2) {
    return true;
  }

  const bodyTextLen = document.body?.innerText?.trim().length || 0;
  if (bodyTextLen < 200 && elements.length > 50) {
    return true;
  }

  return false;
}
