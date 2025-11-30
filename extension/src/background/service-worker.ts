import { extractText } from '../shared/extractor';
import { ExtractionResult } from '../shared/types';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_TEXT') {
    if (typeof message.tabId !== 'number') {
      sendResponse({
        success: false,
        text: '',
        charCount: 0,
        truncated: false,
        isPDF: false,
        error: 'CANNOT_ACCESS_PAGE',
      });
      return;
    }

    handleExtraction(message.tabId)
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          success: false,
          text: '',
          charCount: 0,
          truncated: false,
          isPDF: false,
          error: 'EXTRACTION_FAILED',
        })
      );
    return true; // Keep channel open for async response
  }
});

async function handleExtraction(tabId: number): Promise<ExtractionResult> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractText,
    });

    if (!result || result.result == null) {
      return {
        success: false,
        text: '',
        charCount: 0,
        truncated: false,
        isPDF: false,
        error: 'EXTRACTION_FAILED',
      };
    }

    return result.result as ExtractionResult;
  } catch {
    // Handle restricted pages (chrome://, Web Store, etc.)
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
