// extension/src/shared/browser.ts
import Browser from 'webextension-polyfill';

export const browser = Browser;

/**
 * Send a message to a specific tab's content script.
 * Works on all browsers via webextension-polyfill.
 */
export async function sendMessageToTab(
  tabId: number,
  message: unknown
): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, message);
}

/**
 * Get the currently active tab in the current window.
 */
export async function getActiveTab(): Promise<Browser.Tabs.Tab | null> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab ?? null;
}
