import { ExtractionResult } from "../shared/types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXTRACT_TEXT") {
    if (typeof message.tabId !== "number") {
      sendResponse({
        success: false,
        text: "",
        charCount: 0,
        truncated: false,
        isPDF: false,
        error: "CANNOT_ACCESS_PAGE",
      });
      return;
    }

    handleExtraction(message.tabId)
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          success: false,
          text: "",
          charCount: 0,
          truncated: false,
          isPDF: false,
          error: "EXTRACTION_FAILED",
        })
      );
    return true;
  }
});

async function handleExtraction(tabId: number): Promise<ExtractionResult> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractTextInPage,
    });

    if (!result || result.result == null) {
      return {
        success: false,
        text: "",
        charCount: 0,
        truncated: false,
        isPDF: false,
        error: "EXTRACTION_FAILED",
      };
    }

    return result.result as ExtractionResult;
  } catch {
    return {
      success: false,
      text: "",
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: "CANNOT_ACCESS_PAGE",
    };
  }
}

// This function runs in the PAGE context, not the service worker
// It must be completely self-contained (no imports, no external references)
function extractTextInPage() {
  const MAX_CHARS = 30000;

  const BOILERPLATE_SELECTORS = [
    "nav",
    "header",
    "footer",
    "aside",
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    ".nav",
    ".navbar",
    ".header",
    ".footer",
    ".sidebar",
    ".advertisement",
    ".ad",
    ".ads",
    '[class*="cookie"]',
    "script",
    "style",
    "noscript",
    "iframe",
  ];

  if (!document.body) {
    return {
      success: false,
      text: "",
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: "NO_BODY_ELEMENT",
    };
  }

  const isPDF =
    document.contentType === "application/pdf" ||
    window.location.pathname.endsWith(".pdf");

  try {
    const clone = document.body.cloneNode(true) as HTMLElement;

    BOILERPLATE_SELECTORS.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    let text = clone.innerText.replace(/\s+/g, " ").trim();

    if (!text || text.length < 100) {
      return {
        success: false,
        text: "",
        charCount: 0,
        truncated: false,
        isPDF,
        error: "NO_EXTRACTABLE_TEXT",
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
  } catch (e) {
    return {
      success: false,
      text: "",
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: "EXTRACTION_FAILED",
    };
  }
}
