# DocMind Beta – Product Requirements Document

**Version:** 2.2
**Status:** Ready for Implementation
**Last Updated:** January 2026

---

## 1. Summary

DocMind Beta extends the MVP Chrome extension with cross-browser support, in-page source highlighting, and conversational memory. The Beta phase focuses on three themes:

1. **Reach** – Expand to Edge and Firefox browsers
2. **Trust** – Add source highlighting so users can verify AI answers against the original document
3. **Continuity** – Enable multi-turn conversations within a session

The core product promise remains unchanged: AI-powered document Q&A that answers strictly from visible page content.

---

## 2. Beta Objectives

| Objective | Success Metric |
|-----------|----------------|
| Cross-browser availability | Extension works identically on Chrome, Edge, and Firefox |
| Source verification | Users can click citations to scroll to highlighted source text |
| Answer confidence | Highlights appear only when match confidence ≥ 85% |
| Session continuity | Users can ask follow-up questions with maintained context |
| Trust preservation | Under-highlight rather than over-highlight; clear messaging when highlighting unavailable |

---

## 3. Beta Phases Overview

### Phase 1: Polish & Easy Wins (1 week)
| Feature | Complexity | Notes |
|---------|------------|-------|
| Edge support | Low | Same codebase, publish to Microsoft Add-ons store |
| Copy answer to clipboard | Low | Single button, `navigator.clipboard.writeText()` |
| Dark mode | Low | CSS variables + `prefers-color-scheme` detection |
| Custom icons | Low | Replace placeholder PNGs with branded assets |

### Phase 2: Cross-Browser & Context Menu (2 weeks)
| Feature | Complexity | Notes |
|---------|------------|-------|
| Firefox support | Medium | Manifest V2, `webextension-polyfill`, pre-declared content scripts |
| Context menu integration | Medium | Right-click selected text → "Ask DocMind about this", requires `contextMenus` permission |

### Phase 3: Source Highlighting (3.5 weeks)

#### Phase 3a: Conservative Highlighting (2 weeks)
| Feature | Complexity | Notes |
|---------|------------|-------|
| Page indexing | Medium | `TreeWalker`, node paths (not refs), segment classification |
| Unsupported page detection | Low | Capped shadow DOM check, cheap heuristics |
| URL identity with meaningful params | Low | Whitelist `version`, `lang`, `platform`, etc. |
| Stale detection + reason | Medium | Path vs param changes, clear UX messaging |
| Citation extraction from LLM | Medium | Strict prompt, response validation |
| Two-phase matching | Medium | Token overlap filter → precise match on candidates |
| Single-segment constraint | Low | Explicit skip for cross-segment quotes |
| Safe text node wrapping | Medium | `splitText()` approach, no `surroundContents()` |
| Ephemeral range resolution | Medium | Rebuild ranges just-in-time, discard after injection |
| Robust cleanup | Medium | Popup close, navigation, visibility change |
| Manual retry | Low | "Page changed. Retry highlighting." button |
| Privacy transparency | Low | "Analyzed X characters from this page only" |

#### Phase 3b: Polish & Edge Cases (1.5 weeks)
| Feature | Complexity | Notes |
|---------|------------|-------|
| Multi-node highlighting | Medium-High | Quotes spanning elements |
| Code block highlighting | Medium | Different normalization, careful matching |
| Confidence indicators | Low-Medium | Visual distinction in UI |
| Performance caps | Medium | Chunked processing, hard timeouts |

### Phase 4: Conversational Memory (1.5 weeks)
| Feature | Complexity | Notes |
|---------|------------|-------|
| Multi-turn chat | Medium | Store conversation history in popup state |
| Context window management | Medium | Truncate older messages by char count (no summarization in Beta) |
| Follow-up UX | Low-Medium | "Ask a follow-up" prompt, conversation thread display in popup |

**Note:** Session continuity is scoped to the popup lifetime; closing the popup resets the conversation (no persistence in Beta). This aligns with the "no storage" permission posture.

#### Phase 4 Technical Design

**Extended API Contract:**

```typescript
type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  // Citations NOT included in history (too verbose, already grounded to page)
};

type QueryRequest = {
  pageText: string;              // truncated to MAX_PAGE_CHARS
  question: string;
  url?: string;
  mode?: 'qa' | 'summary' | 'eli5' | 'key-takeaways' | 'main-arguments';

  // Phase 4 Beta
  conversation?: {
    threadId: string;              // UUID, generated per popup session
    messages: ConversationMessage[]; // last N, capped by chars
    pageUrlIdentity: string;       // UrlIdentity.full at thread start
    mode: QueryRequest['mode'];    // locks mode for thread duration
  };
};
```

**Configuration:**

```typescript
export const CHAT_CONFIG = {
  MAX_PAGE_CHARS: 30_000,
  MAX_MESSAGES: 6,
  MAX_HISTORY_CHARS: 4_000,  // Char-based, not tokens (deterministic client-side)
} as const;
```

**Popup State:**

```typescript
interface ConversationState {
  threadId: string;
  messages: ConversationMessage[];
  pageUrlIdentity: string;  // UrlIdentity.full
  mode: QueryRequest['mode'];
}
```

**Reset Triggers (explicit):**
- Popup closes (per "no storage" rule)
- User clicks "New conversation"
- `UrlIdentity.full` changes (origin + pathname + meaningful params)
- Mode changes (thread is locked to initial mode; changing mode starts new thread)

**Truncation Strategy:**
- No summarization in Beta (extra LLM call, complexity)
- Drop oldest messages when `messages.length > MAX_MESSAGES`
- Drop oldest messages when total history chars exceed `MAX_HISTORY_CHARS`
- Keep most recent messages to preserve immediate context

---

## 4. Explicitly Out of Scope (Post-Beta)

| Feature | Reason |
|---------|--------|
| Safari support | Different architecture (Xcode/Swift), high effort |
| Multi-page PDF extraction | Requires pagination logic, defer to future |
| OCR for scanned PDFs | Needs OCR service integration, high complexity |
| User accounts / saved history | Backend infrastructure required |
| Offline mode / caching | Adds complexity, limited value for Beta |
| Cloud sync | Requires auth + database |

---

## 5. Cross-Browser Architecture

### 5.1 Directory Structure

```
extension/
├── src/
│   ├── shared/           # Cross-browser code
│   │   ├── types.ts
│   │   ├── extractor.ts
│   │   ├── normalizer.ts
│   │   └── browser.ts    # Browser API abstraction
│   ├── popup/
│   ├── background/
│   └── content/
│       ├── index.ts      # Entry point (declared in manifest)
│       ├── pageIndexer.ts
│       ├── pageClassifier.ts
│       ├── citationMatcher.ts
│       └── highlighter.ts
├── browsers/
│   ├── chrome/
│   │   └── manifest.json  # MV3
│   ├── edge/
│   │   └── manifest.json  # MV3 (nearly identical to Chrome)
│   └── firefox/
│       └── manifest.json  # MV2
├── build/
│   ├── chrome/
│   ├── edge/
│   └── firefox/
└── vite.config.ts
```

### 5.2 Browser API Abstraction

Firefox uses Promise-based `browser.*` APIs vs Chrome's callback-based `chrome.*` APIs.

**API Differences:**
- Chrome/Edge MV3: `scripting.executeScript()` for programmatic injection
- Firefox MV2: `tabs.executeScript()` OR pre-declared content scripts

**Beta recommendation:** Declare content scripts in both manifests and use message passing for cross-browser parity. Reserve programmatic injection as an MV3-only optimization post-Beta.

```typescript
// shared/browser.ts

import Browser from 'webextension-polyfill';

export const browser = Browser;

// Message-based communication (works on all browsers)
export async function sendMessageToTab(
  tabId: number,
  message: unknown
): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, message);
}

// For MV3-only features (Chrome/Edge) - not used in Beta
export async function executeScriptMV3<T>(
  tabId: number,
  func: () => T
): Promise<T[] | null> {
  if (!browser.scripting?.executeScript) {
    // MV2 (Firefox): Not available, use message passing instead
    return null;
  }

  const results = await browser.scripting.executeScript({
    target: { tabId },
    func,
  });
  return results.map(r => r.result as T);
}
```

### 5.3 Manifest Differences

**Chrome/Edge (Manifest V3):**
```json
{
  "manifest_version": 3,
  "name": "DocMind",
  "version": "2.2.0",
  "permissions": ["activeTab", "contextMenus"],
  "background": {
    "service_worker": "background/index.js"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "run_at": "document_idle"
  }]
}
```

**Firefox (Manifest V2):**
```json
{
  "manifest_version": 2,
  "name": "DocMind",
  "version": "2.2.0",
  "permissions": ["activeTab", "contextMenus"],
  "background": {
    "scripts": ["background/index.js"]
  },
  "browser_action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "run_at": "document_idle"
  }],
  "browser_specific_settings": {
    "gecko": {
      "id": "docmind@example.com",
      "strict_min_version": "109.0"
    }
  }
}
```

### 5.4 Context Menu Flow

**Goal:** Right-click selected text → "Ask DocMind about this" opens DocMind with the selection turned into a question. Full page text is still the grounding context (same as normal queries).

#### UX Behavior

1. User selects text on the page
2. Right-click → "Ask DocMind about this"
3. DocMind popup opens
4. Input box is pre-filled with: `What does this mean: "<selection>"?`
5. User can edit before submitting

#### Query Behavior

- `pageText`: extracted normally from the current page (same extraction path as clicking the extension icon)
- `question`: the pre-filled question above
- Selection is not a second "focus" field in Beta (no extra retrieval logic)
- If selection is very long, it is truncated before prefill

#### Constants

```typescript
const CONTEXT_MENU_CONFIG = {
  MAX_SELECTION_CHARS: 500,      // Truncate beyond this
  MIN_SELECTION_CHARS: 3,        // Below this, show toast
  PENDING_CONTEXT_TTL_MS: 30_000, // Expire after 30 seconds
} as const;
```

#### Context Menu Registration

```typescript
// background/service-worker.ts (runs once on install/update)
chrome.contextMenus.create({
  id: 'ask-docmind',
  title: 'Ask DocMind about this',
  contexts: ['selection'],  // Only shows when text is selected
});
```

#### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User selects text, right-clicks → "Ask DocMind about this"  │
│                           │                                     │
│                           ▼                                     │
│ 2. Background receives contextMenus.onClicked                   │
│    - Validates selection length (≥ MIN_SELECTION_CHARS)         │
│    - Stores { tabId, selectionText, createdAt } in memory       │
│    - Opens popup (best-effort, see note below)                  │
│                           │                                     │
│                           ▼                                     │
│ 3. Popup mounts, sends GET_PENDING_CONTEXT to background        │
│                           │                                     │
│                           ▼                                     │
│ 4. Background returns PENDING_CONTEXT                           │
│    - Checks TTL (expire if > 30s old)                           │
│    - Returns payload or null                                    │
│                           │                                     │
│                           ▼                                     │
│ 5. Popup pre-fills question input with selection                │
│    - Sends CLEAR_PENDING_CONTEXT                                │
│    - User can edit before submitting                            │
│    - Full page extraction proceeds normally                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Background State

```typescript
// Ephemeral, not persisted
const pendingContextByTabId = new Map<number, {
  selectionText: string;
  createdAt: number;
}>();

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ask-docmind' && info.selectionText && tab?.id) {
    const selection = info.selectionText.trim();

    if (selection.length < CONTEXT_MENU_CONFIG.MIN_SELECTION_CHARS) {
      // Optionally show notification: "Select some text first"
      return;
    }

    const truncated = selection.length > CONTEXT_MENU_CONFIG.MAX_SELECTION_CHARS
      ? selection.slice(0, CONTEXT_MENU_CONFIG.MAX_SELECTION_CHARS) + '...'
      : selection;

    pendingContextByTabId.set(tab.id, {
      selectionText: truncated,
      createdAt: Date.now(),
    });

    // Best-effort popup open (may fail on some browsers/contexts)
    chrome.action?.openPopup?.();  // MV3
  }
});

// Message handlers
if (message.type === 'GET_PENDING_CONTEXT') {
  const tabId = sender.tab?.id;
  const pending = tabId ? pendingContextByTabId.get(tabId) : null;

  // Check TTL
  if (pending && Date.now() - pending.createdAt > CONTEXT_MENU_CONFIG.PENDING_CONTEXT_TTL_MS) {
    pendingContextByTabId.delete(tabId!);
    return { type: 'PENDING_CONTEXT', payload: null };
  }

  return {
    type: 'PENDING_CONTEXT',
    payload: pending ? { kind: 'selection', tabId, ...pending } : null
  };
}

if (message.type === 'CLEAR_PENDING_CONTEXT') {
  const tabId = sender.tab?.id;
  if (tabId) pendingContextByTabId.delete(tabId);
}
```

#### Note on Opening the Popup

Programmatic popup opening is best-effort because API support varies:
- MV3 Chrome/Edge: `chrome.action.openPopup()` (may require user gesture)
- MV2 Firefox: `browser.browserAction.openPopup()` (may be restricted)

If programmatic open fails, the flow still works: user clicks the extension icon and the prefill is waiting. Do not make auto-open a hard requirement for Beta.

---

## 6. Source Highlighting Technical Design

### 6.1 Guiding Principle

> **Highlight when confident. Explain when not. Never guess silently.**

Under-highlighting preserves trust. Over-highlighting destroys it.

### 6.1a Phase 3a Non-Goals

To maintain trust and simplicity, Phase 3a explicitly does **not**:
- Highlight code blocks (prose only)
- Highlight quotes spanning multiple DOM nodes
- Attempt fuzzy fallback matching
- Auto-retry on stale detection

**Known limitation:** Cross-segment detection checks only the current segment plus the immediately following segment. Quotes spanning three or more segments may not be detected as cross-segment and could produce unexpected results. This is acceptable for Beta; robust multi-segment detection is deferred to Phase 3b.

These features may be added in Phase 3b or post-Beta.

### 6.1b Performance Budget

| Limit | Value | Rationale |
|-------|-------|-----------|
| `MAX_MATCH_TIME_MS` | 500ms | Never block main thread perceptibly |
| `MAX_DOM_NODES` | 10,000 | Cap worst-case scan time |
| `MAX_FALLBACK_CHECKS` | 500 | Limit retry search scope |
| `MAX_NODE_TEXT_LEN` | 20,000 | Skip oversized text nodes in fallback |
| `CONFIDENCE_THRESHOLD` | 0.85 | Under-highlight, never over-highlight |

`MAX_DOM_NODES` counts TreeWalker visits using `NodeFilter.SHOW_TEXT` (text nodes only, not elements). TreeWalker root is `<main>` or `<article>` if present; otherwise `document.body`. This prevents nav/footer bloat from consuming the budget.

### 6.1c Non-Functional Requirements

- Highlight injection must be reversible without layout breakage
- No DOM mutations persist after cleanup
- Matching must not block main thread longer than `MAX_MATCH_TIME_MS`
- All extension API calls must use the `shared/browser.ts` abstraction for cross-browser compatibility (applies to `runtime`, `tabs`, `contextMenus`, etc. — not DOM APIs)

### 6.1d Highlight Lifecycle States

Explicit states to keep popup/content/background in sync:

```typescript
type HighlightLifecycle =
  | { state: 'idle' }                                           // No highlights
  | { state: 'active'; citationIds: string[] }                  // Highlights injected
  | { state: 'stale'; reason: StaleReason }                     // Known stale, retry possible
  | { state: 'unsupported'; reason: UnsupportedReason };        // Cannot highlight

// State transitions:
// idle → active (after successful highlight injection)
// active → stale (on navigation, DOM change, expiry)
// active → idle (on cleanup)
// stale → active (on successful retry)
// stale → idle (on cleanup)
// * → unsupported (on classification failure or restricted page)
```

### 6.1e Scroll-to-Highlight Behavior

When user clicks a citation badge:

- **Scroll target:** First `<mark data-citation-id="cite-N">` matching the clicked citation
- **Scroll behavior:** `element.scrollIntoView({ block: 'center', behavior: 'smooth' })`
- **Pulse effect:** Add class `docmind-pulse` for 900ms, then remove
- **No match case:** If no mark exists (status was not `matched`), badge is disabled and click does nothing

### 6.2 Updated API Contract

```typescript
// Request
type QueryRequest = {
  pageText: string;
  question: string;
  url?: string;  // Optional context hint, not persisted (see Section 10.3)
  mode?: 'qa' | 'summary' | 'eli5' | 'key-takeaways' | 'main-arguments';
};

// Response (extended for Beta)
type QueryResponse = {
  answer: string;
  citations: Citation[];
  truncated: boolean;
  charactersAnalyzed: number;
};

type Citation = {
  id: string;           // "cite-1", "cite-2", etc.
  text: string;         // Exact quote from document (50-200 chars ideal)
  relevance: string;    // Brief label: "Definition", "Key stat", "Conclusion"
};
```

### 6.3 Updated LLM Prompt

```
SYSTEM:
You are DocMind, an AI assistant that answers questions strictly
using the provided text. Do not use outside knowledge.

When answering:
1. Provide a clear, direct answer
2. Include 1-5 citations from the document that support your answer
3. Copy citation text EXACTLY as it appears — do not paraphrase, summarize, or clean up
4. Include original punctuation, capitalization, and spacing in citations
5. Keep citations between 50-200 characters for optimal highlighting
6. If you cannot find an exact quote, omit the citation entirely
7. Never merge multiple sentences into one citation
8. If the answer cannot be found, respond with no citations

Return JSON:
{
  "answer": "Your answer here",
  "citations": [
    { "id": "cite-1", "text": "exact quote from document", "relevance": "Why this matters" }
  ]
}
```

### 6.3a Response Parsing

The LLM may return JSON wrapped in code fences, with leading/trailing prose, or malformed. This parser handles all cases defensively.

```typescript
type ParsedResponse =
  | { success: true; data: QueryResponse }
  | { success: false; error: 'JSON_PARSE_FAILED' | 'INVALID_RESPONSE' };

const CITATION_LIMITS = {
  MIN_COUNT: 1,
  MAX_COUNT: 5,
  MIN_TEXT_LENGTH: 20,
  MAX_TEXT_LENGTH: 300,
} as const;

function parseApiResponse(raw: string, pageCharCount: number): ParsedResponse {
  // Extract first JSON object from response (handles fences, prose before/after)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { success: false, error: 'JSON_PARSE_FAILED' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.answer !== 'string' || parsed.answer.length === 0) {
      return { success: false, error: 'INVALID_RESPONSE' };
    }

    // Filter and clamp citations
    const validCitations = Array.isArray(parsed.citations)
      ? parsed.citations
          .filter((c: unknown): c is Citation =>
            typeof c === 'object' && c !== null &&
            typeof (c as Citation).id === 'string' &&
            /^cite-\d+$/.test((c as Citation).id) &&
            typeof (c as Citation).text === 'string' &&
            (c as Citation).text.length >= CITATION_LIMITS.MIN_TEXT_LENGTH &&
            (c as Citation).text.length <= CITATION_LIMITS.MAX_TEXT_LENGTH
          )
          .slice(0, CITATION_LIMITS.MAX_COUNT)  // Clamp to max 5
      : [];

    return {
      success: true,
      data: {
        answer: parsed.answer,
        citations: validCitations,
        // These are computed client-side, not trusted from model
        truncated: pageCharCount > CHAT_CONFIG.MAX_PAGE_CHARS,
        charactersAnalyzed: Math.min(pageCharCount, CHAT_CONFIG.MAX_PAGE_CHARS),
      },
    };
  } catch {
    return { success: false, error: 'JSON_PARSE_FAILED' };
  }
}
```

**Notes:**
- `truncated` and `charactersAnalyzed` are computed client-side from extraction/truncation, not trusted from the model response
- JSON extraction uses `\{[\s\S]*\}` regex to find first complete object (handles code fences, leading/trailing prose)
- Citations are clamped to max 5 and validated against length bounds (20–300 chars)
- Citation IDs must match `^cite-\d+$` for consistent UI scroll mapping

**UX on parse failure:**
- Show error message: "DocMind couldn't process the response. Please try again."
- Treat as "no citations" — do not crash highlight flow
- Log error type for debugging
- Do not show raw response to user

### 6.4 Page Indexing

#### Types

```typescript
interface PageIdentity {
  tabId: number;
  origin: string;
  pathname: string;
  meaningfulParams: string;  // Sorted, filtered query string
  full: string;              // Complete normalized URL
  title: string;
  capturedAt: number;
}

interface TextSegment {
  text: string;
  normalizedText: string;
  type: 'prose' | 'code' | 'heading';
  nodePath: number[];  // Path from body via childNodes indices
  textOffset: number;  // Starting offset within that text node
}

interface PageIndex {
  identity: PageIdentity;
  segments: TextSegment[];
  fullText: string;
  normalizedFullText: string;
  isStale: boolean;
  builtAt: number;
}
```

#### URL Identity with Meaningful Params

```typescript
// UrlIdentity is the URL-only subset of PageIdentity, used for stale checks
interface UrlIdentity {
  origin: string;
  pathname: string;
  meaningfulParams: string;
  full: string;
}

const MEANINGFUL_PARAMS = new Set([
  'version', 'v',
  'lang', 'language',
  'platform',
  'view',
  'tab',
  'page',
]);

function parseUrlIdentity(url: string): UrlIdentity {
  try {
    const parsed = new URL(url);

    const meaningful: string[] = [];
    parsed.searchParams.forEach((value, key) => {
      if (MEANINGFUL_PARAMS.has(key.toLowerCase())) {
        meaningful.push(`${key}=${value}`);
      }
    });
    meaningful.sort();

    const meaningfulParams = meaningful.join('&');

    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      meaningfulParams,
      full: `${parsed.origin}${parsed.pathname}${meaningfulParams ? '?' + meaningfulParams : ''}`,
    };
  } catch {
    return { origin: '', pathname: url, meaningfulParams: '', full: url };
  }
}
```

#### Stale Detection

```typescript
type StaleCheckResult =
  | { stale: false }
  | { stale: true; reason: 'path-changed' | 'params-changed' | 'expired' | 'dom-changed' };

// Note: 'dom-changed' is set by a MutationObserver when meaningful DOM
// mutations occur after indexing (see PageIndexer.watchForChanges).
// "Meaningful" = text-affecting changes (added/removed text nodes, subtree
// changes under <main>/<article>), not attribute churn, animations, or timers.
// Observer watches <main> or <article> when present; otherwise falls back to
// document.body. Options: { childList: true, subtree: true } — attributes ignored.

// checkStale() only evaluates URL + age. PageIndex.isStale may be set by either:
// - checkStale() returning { stale: true, reason: 'path-changed' | 'params-changed' | 'expired' }
// - MutationObserver setting isStale = true with reason 'dom-changed'

function checkStale(
  stored: UrlIdentity,
  current: UrlIdentity,
  ageMs: number
): StaleCheckResult {
  if (stored.origin !== current.origin || stored.pathname !== current.pathname) {
    return { stale: true, reason: 'path-changed' };
  }

  if (stored.meaningfulParams !== current.meaningfulParams) {
    return { stale: true, reason: 'params-changed' };
  }

  if (ageMs > 5 * 60 * 1000) {
    return { stale: true, reason: 'expired' };
  }

  return { stale: false };
}
```

### 6.5 Text Normalization

#### Full Normalization (for matching)

```typescript
function normalizeForMatching(text: string, type: 'prose' | 'code' | 'heading'): string {
  let normalized = text
    .normalize('NFKD')
    // Remove combining diacritical marks
    .replace(/[\u0300-\u036f]/g, '')
    // Normalize whitespace characters
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    // Normalize quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Normalize dashes
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    // Normalize ellipsis
    .replace(/\u2026/g, '...');

  if (type === 'code') {
    // Preserve meaningful whitespace in code
    normalized = normalized.replace(/ +/g, ' ');
  } else {
    // Aggressive whitespace collapse for prose
    normalized = normalized.replace(/\s+/g, ' ');
  }

  return normalized.trim().toLowerCase();
}
```

#### Fallback Matching Note

In Beta, fallback range resolution uses **exact raw substring matching only** (case-insensitive) to avoid offset drift from normalization. This is conservative but reliable. Fuzzy fallback matching is deferred to post-Beta.

### 6.6 Page Classification

```typescript
type PageSupport =
  | { supported: true }
  | { supported: false; reason: UnsupportedReason };

type UnsupportedReason =
  | 'virtualized-content'
  | 'iframe-heavy'
  | 'shadow-dom-content'
  | 'insufficient-text'
  | 'too-large'
  | 'restricted-page';

// Indexing aborts when scanned nodes exceed MAX_DOM_NODES;
// page is treated as unsupported with reason 'too-large'.
// Note: classifyPage() checks structural heuristics; PageIndexer.buildIndex()
// can still return unsupported with 'too-large' if node budget is exceeded.
// 'restricted-page' is returned when content script cannot connect (chrome://,
// Web Store, about: pages, etc.).

function classifyPage(): PageSupport {
  const bodyText = document.body.innerText?.trim().length || 0;

  if (bodyText < 200) {
    return { supported: false, reason: 'insufficient-text' };
  }

  const hasVirtualScroll = document.querySelector(
    '[class*="virtual"], [class*="windowed"], [data-virtualized]'
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

  const bodyText = document.body.innerText?.trim().length || 0;
  if (bodyText < 200 && elements.length > 50) {
    return true;
  }

  return false;
}
```

### 6.7 Visibility Detection (Cached)

**Definition:** "Visible" means the element is not hidden by CSS (`display: none`, `visibility: hidden`, `opacity: 0`) and is rendered in the layout. This includes off-screen content (e.g., below the fold). Viewport visibility is not required — we index all rendered text, not just what's currently on screen.

```typescript
class PageIndexer {
  private visibilityCache = new WeakMap<Element, boolean>();

  private isVisible(node: Node): boolean {
    const element = node.nodeType === Node.ELEMENT_NODE
      ? node as Element
      : node.parentElement;

    if (!element) return false;

    if (this.visibilityCache.has(element)) {
      return this.visibilityCache.get(element)!;
    }

    const htmlElement = element as HTMLElement;

    if (htmlElement.offsetParent === null) {
      if (element.tagName !== 'BODY' && element.tagName !== 'HTML') {
        const position = getComputedStyle(element).position;
        if (position !== 'fixed' && position !== 'sticky') {
          this.visibilityCache.set(element, false);
          return false;
        }
      }
    }

    const style = getComputedStyle(element);
    const isInline = style.display === 'inline' || style.display === 'inline-block';

    if (!isInline && htmlElement.offsetWidth === 0 && htmlElement.offsetHeight === 0) {
      this.visibilityCache.set(element, false);
      return false;
    }

    const visible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    parseFloat(style.opacity) > 0;

    this.visibilityCache.set(element, visible);
    return visible;
  }
}
```

### 6.8 Citation Matching

#### Two-Phase Approach

Matching enforces `MAX_MATCH_TIME_MS` via `performance.now()` checks per citation; returns `match-timeout` status when exceeded.

```typescript
const MIN_TOKENS_FOR_OVERLAP = 6;
const CONFIDENCE_THRESHOLD = HIGHLIGHT_CONFIG.MIN_CONFIDENCE_THRESHOLD;

interface MatchResult {
  citationId: string;
  status: 'matched' | 'low-confidence' | 'not-found' | 'skipped';
  confidence: number;
  segment: TextSegment | null;
  skipReason?: HighlightSkipReason;
}

type HighlightSkipReason =
  | 'quote-spans-multiple-sections'
  | 'page-structure-unsupported'
  | 'confidence-below-threshold'
  | 'match-timeout';

function matchCitations(
  citations: Citation[],
  index: PageIndex
): MatchResult[] {
  const results: MatchResult[] = [];
  const start = performance.now();

  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i];

    // Timeout guard: bail out and mark all remaining citations as timeout
    if (performance.now() - start > HIGHLIGHT_CONFIG.MAX_MATCH_TIME_MS) {
      for (let j = i; j < citations.length; j++) {
        results.push({
          citationId: citations[j].id,
          status: 'skipped',
          confidence: 0,
          segment: null,
          skipReason: 'match-timeout',
        });
      }
      break;
    }

    const normalizedQuote = normalizeForMatching(citation.text, 'prose');
    const quoteTokens = normalizedQuote.split(/\s+/).filter(t => t.length > 2);

    let candidates: { segment: TextSegment; score: number }[];

    if (quoteTokens.length < MIN_TOKENS_FOR_OVERLAP) {
      // Short quote: skip token overlap, use substring matching
      const significantWords = quoteTokens.filter(t => t.length > 4);

      candidates = index.segments
        .filter(s => s.type === 'prose')
        .filter(s => {
          if (s.normalizedText.includes(normalizedQuote)) return true;
          if (significantWords.length >= 2) {
            const matches = significantWords.filter(w => s.normalizedText.includes(w));
            return matches.length >= 2;
          }
          return significantWords.some(w => s.normalizedText.includes(w));
        })
        .slice(0, 10)
        .map(s => ({ segment: s, score: 0.5 }));
    } else {
      // Normal quote: use token overlap to filter
      candidates = index.segments
        .filter(s => s.type === 'prose')
        .map(s => ({ segment: s, score: tokenOverlap(normalizedQuote, s.normalizedText) }))
        .filter(c => c.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    // Phase 2: Precise match on candidates
    let bestMatch: MatchResult | null = null;
    let skipResult: MatchResult | null = null;

    for (const { segment } of candidates) {
      // Check for cross-segment quote (Phase 3a constraint)
      // Note: Only checks current + next segment (see Section 6.1a limitations)
      if (couldSpanSegments(normalizedQuote, segment, index)) {
        skipResult = {
          citationId: citation.id,
          status: 'skipped',
          confidence: 0,
          segment: null,
          skipReason: 'quote-spans-multiple-sections',
        };
        break;
      }

      const similarity = preciseMatch(normalizedQuote, segment.normalizedText);

      if (similarity > (bestMatch?.confidence || 0)) {
        bestMatch = {
          citationId: citation.id,
          status: similarity >= CONFIDENCE_THRESHOLD ? 'matched' : 'low-confidence',
          confidence: similarity,
          segment,
          skipReason: similarity < CONFIDENCE_THRESHOLD ? 'confidence-below-threshold' : undefined,
        };

        if (similarity >= 0.95) break;
      }
    }

    // Single push per citation (fixes double-push bug)
    results.push(
      skipResult ||
      bestMatch ||
      { citationId: citation.id, status: 'not-found', confidence: 0, segment: null }
    );
  }

  return results;
}

function couldSpanSegments(
  quote: string,
  currentSegment: TextSegment,
  index: PageIndex
): boolean {
  // Note: Only checks current + next segment (Phase 3a limitation)
  const segmentIndex = index.segments.indexOf(currentSegment);
  if (segmentIndex === -1 || segmentIndex >= index.segments.length - 1) {
    return false;
  }

  const nextSegment = index.segments[segmentIndex + 1];
  const combined = currentSegment.normalizedText + ' ' + nextSegment.normalizedText;

  return combined.includes(quote) && !currentSegment.normalizedText.includes(quote);
}
```

#### Token Overlap (Sørensen-Dice)

```typescript
function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  return (2 * intersection) / (tokensA.size + tokensB.size);
}
```

#### Precise Match (Capped Levenshtein)

```typescript
function preciseMatch(needle: string, haystack: string): number {
  if (haystack.includes(needle)) return 1.0;

  const MAX_HAYSTACK = 2000;
  const truncatedHaystack = haystack.slice(0, MAX_HAYSTACK);
  const windowSize = Math.min(needle.length, truncatedHaystack.length);

  let maxSimilarity = 0;
  const words = truncatedHaystack.split(/\s+/);
  let position = 0;

  for (const word of words) {
    if (position + windowSize > truncatedHaystack.length) break;

    const window = truncatedHaystack.slice(position, position + windowSize);
    const distance = levenshteinDistance(needle, window);
    const similarity = 1 - (distance / Math.max(needle.length, window.length));

    maxSimilarity = Math.max(maxSimilarity, similarity);
    if (maxSimilarity >= 0.95) break;

    position += word.length + 1;
  }

  return maxSimilarity;
}
```

### 6.9 Safe Text Node Wrapping

`wrapTextRange(textNode, startOffset, endOffset)` expects **absolute offsets** relative to the original textNode. After splitting, offsets are converted internally to work on the post-split node.

```typescript
function wrapTextRange(
  textNode: Text,
  startOffset: number,
  endOffset: number,
  citationId: string
): HTMLElement | null {
  try {
    const text = textNode.textContent || '';

    if (startOffset < 0 || endOffset > text.length || startOffset >= endOffset) {
      return null;
    }

    // Split into [before][match][after]
    // After split, matchAndAfter starts at position 0 (not startOffset)
    const matchAndAfter = startOffset > 0
      ? textNode.splitText(startOffset)
      : textNode;

    // matchLength is the length of text to wrap (endOffset - startOffset)
    // We use this instead of endOffset directly since we're now at position 0
    const matchLength = endOffset - startOffset;
    if (matchAndAfter.textContent && matchAndAfter.textContent.length > matchLength) {
      matchAndAfter.splitText(matchLength);
    }

    const mark = document.createElement('mark');
    mark.className = 'docmind-highlight';
    mark.dataset.citationId = citationId;

    const parent = matchAndAfter.parentNode;
    if (!parent) return null;

    parent.insertBefore(mark, matchAndAfter);
    mark.appendChild(matchAndAfter);

    return mark;
  } catch (error) {
    console.warn('Text wrapping failed:', error);
    return null;
  }
}
```

### 6.10 Fallback Range Resolution (Simple)

In Beta, fallback range resolution uses **exact raw substring matching only** to avoid offset drift from normalization. This is conservative but reliable.

Fallback skips text nodes where `rawText.length < citation.text.length` (can't contain match) or `rawText.length > MAX_NODE_TEXT_LEN` (too costly to search).

```typescript
const MAX_NODE_TEXT_LEN = 20_000;

function findSegmentInCurrentDomSimple(
  citation: Citation
): Range | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const searchText = citation.text.toLowerCase();
  let node: Text | null;
  let checked = 0;
  const MAX_FALLBACK_CHECKS = 500;

  while ((node = walker.nextNode() as Text)) {
    if (++checked > MAX_FALLBACK_CHECKS) break;

    const rawText = node.textContent || '';

    // Skip nodes that can't contain the match or are too large
    if (rawText.length < citation.text.length) continue;
    if (rawText.length > MAX_NODE_TEXT_LEN) continue;

    const lowerRaw = rawText.toLowerCase();

    const matchIndex = lowerRaw.indexOf(searchText);
    if (matchIndex === -1) continue;

    try {
      const range = document.createRange();
      range.setStart(node, matchIndex);
      range.setEnd(node, matchIndex + citation.text.length);
      return range;
    } catch {
      continue;
    }
  }

  return null;
}
```

### 6.11 Highlight Cleanup

```typescript
import { browser } from '../shared/browser';

class SafeHighlighter {
  private highlights = new Map<string, HTMLElement[]>();
  private didSetup = false;

  cleanup(citationId?: string): void {
    const toClean = citationId
      ? [[citationId, this.highlights.get(citationId)]]
      : Array.from(this.highlights.entries());

    for (const [id, marks] of toClean) {
      if (!marks) continue;

      marks.forEach(mark => this.unwrapMark(mark));
      this.highlights.delete(id as string);
    }
  }

  private unwrapMark(mark: HTMLElement): void {
    const parent = mark.parentNode;
    if (!parent) return;

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }

  // Idempotent: must only register listeners once
  setupAutoCleanup(): void {
    if (this.didSetup) return;
    this.didSetup = true;

    // Use browser abstraction for cross-browser compatibility
    // Note: Background sends CLEAR_HIGHLIGHTS on popup close
    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'CLEAR_HIGHLIGHTS') {
        this.cleanup();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.cleanup();
    });

    // Navigation cleanup (covers SPAs, hash routers, page unload)
    window.addEventListener('popstate', () => this.cleanup());
    window.addEventListener('hashchange', () => this.cleanup());
    window.addEventListener('beforeunload', () => this.cleanup());
  }
}
```

### 6.12 Injected Styles

```css
.docmind-highlight {
  background-color: #fef08a;
  border-radius: 2px;
  padding: 0 2px;
  transition: background-color 0.3s ease;
}

.docmind-highlight.docmind-pulse {
  background-color: #fde047;
  box-shadow: 0 0 8px rgba(250, 204, 21, 0.6);
}

@media (prefers-color-scheme: dark) {
  .docmind-highlight {
    background-color: #854d0e;
    color: #fef9c3;
  }
  .docmind-highlight.docmind-pulse {
    background-color: #a16207;
  }
}
```

---

## 7. Citation Validation

Validation uses the pre-computed `normalizedFullText` from the page index for consistency with matching.

**Phase 3a constraint:** Citations are validated and matched against `prose` segments only. Citations that appear only inside `code` or `heading` segments are dropped. This ensures highlighting stays within the Phase 3a scope.

```typescript
function validateCitation(citation: Citation, index: PageIndex): boolean {
  const normalizedQuote = normalizeForMatching(citation.text, 'prose');

  // Use pre-computed normalized text from index (consistent with matching)
  if (!index.normalizedFullText.includes(normalizedQuote)) {
    console.warn(`Citation rejected: not found in page`);
    return false;
  }

  // Length bounds
  if (citation.text.length < 20) return false;
  if (citation.text.length > 300) return false;

  return true;
}

function processApiResponse(response: QueryResponse, index: PageIndex): QueryResponse {
  return {
    ...response,
    citations: response.citations.filter(c => validateCitation(c, index)),
  };
}
```

---

## 8. Risk Mitigations

### 8.1 Trust Risks

| Risk | Mitigation |
|------|------------|
| False confidence (wrong highlight) | Require confidence ≥ 0.85; skip rather than guess |
| LLM quote drift | Strict prompt; validate citations exist in page text |
| Trust regression | Freeze thresholds in config; require explicit code changes to lower |

### 8.2 Technical Risks

| Risk | Mitigation |
|------|------------|
| DOM volatility | Delay until `readyState === 'complete'`; MutationObserver + stale flag |
| Node path instability | Ephemeral ranges; simple fallback on retry |
| Quote fragility | NFKD normalization + character mapping; two-phase matching |
| Performance blame | Chunked processing; hard timeout (500ms); never block main thread |

### 8.3 UX Risks

| Risk | Mitigation |
|------|------------|
| Perceived inconsistency | Surface skip reasons; make non-highlighting feel intentional |
| Expectation lock-in | Copy: "Highlights show where DocMind found supporting text" |
| Stale highlights | Bind to page identity; clear on navigation; manual retry button |

### 8.4 Configuration (Frozen)

```typescript
export const HIGHLIGHT_CONFIG = {
  // 🔒 TRUST-CRITICAL: Do not lower without team review
  MIN_CONFIDENCE_THRESHOLD: 0.85,

  // 🔒 TRUST-CRITICAL: Abort before degrading UX
  MAX_MATCH_TIME_MS: 500,
  MAX_DOM_NODES: 10_000,
  MAX_FALLBACK_CHECKS: 500,
  MAX_NODE_TEXT_LEN: 20_000,
} as const;

Object.freeze(HIGHLIGHT_CONFIG);
```

---

## 9. UI Components

### 9.1 Citation Badge

Badge label is ordinal (1..N) for user display; click target uses `citation.id` (`cite-1`, etc.) for internal tracking.

```tsx
interface CitationBadgeProps {
  citation: Citation;
  index: number;
  status: 'matched' | 'low-confidence' | 'not-found' | 'skipped';
  onClickScroll: (id: string) => void;
}

function CitationBadge({ citation, index, status, onClickScroll }: CitationBadgeProps) {
  const isClickable = status === 'matched';

  return (
    <button
      onClick={() => isClickable && onClickScroll(citation.id)}
      disabled={!isClickable}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
                  rounded-full transition-colors ${
                    isClickable
                      ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 cursor-pointer'
                      : 'bg-gray-100 text-gray-500 cursor-default'
                  }`}
      title={isClickable ? 'Click to scroll to source' : citation.text}
    >
      <span>{index + 1}</span>
      {isClickable && <ArrowUpRight className="w-3 h-3" />}
    </button>
  );
}
```

### 9.2 Highlight Status

```tsx
type StaleReason = 'path-changed' | 'params-changed' | 'expired' | 'dom-changed';

const STALE_MESSAGES: Record<StaleReason, string> = {
  'path-changed': 'You navigated to a different page.',
  'params-changed': 'Page version or settings changed.',
  'expired': 'Highlights are from an earlier session.',
  'dom-changed': 'Page content may have updated.',
};

const UNSUPPORTED_MESSAGES: Record<UnsupportedReason, string> = {
  'virtualized-content': 'This page uses virtual scrolling.',
  'iframe-heavy': 'Content is embedded in frames.',
  'shadow-dom-content': "This page structure doesn't support highlighting.",
  'insufficient-text': 'Not enough text content found.',
  'too-large': 'This page is too large to safely highlight.',
  'restricted-page': "This page doesn't allow extensions to read or highlight content.",
};

function HighlightStatus({ status, staleReason, unsupportedReason, onRetry }) {
  if (status === 'active') return null;

  const getMessage = () => {
    if (status === 'unsupported') {
      return unsupportedReason
        ? UNSUPPORTED_MESSAGES[unsupportedReason]
        : 'Highlighting unavailable for this page.';
    }
    const reason = staleReason ? STALE_MESSAGES[staleReason] : 'Page may have changed.';
    return `${reason} Highlights are from a previous state.`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50
                    border-t border-amber-200 text-amber-800 text-xs">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1">{getMessage()}</span>
      {status === 'stale' && (
        <button
          onClick={onRetry}
          className="px-2 py-1 bg-amber-100 hover:bg-amber-200
                     rounded text-amber-700 font-medium transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

### 9.3 Privacy Indicator

```tsx
function ContextIndicator({ charactersAnalyzed, truncated }) {
  return (
    <div className="text-xs text-gray-500 flex items-center gap-1.5 px-3 py-2 border-t">
      <Lock className="w-3 h-3" />
      <span>
        Analyzed {charactersAnalyzed.toLocaleString()} characters from this page only
        {truncated && ' (truncated)'}
      </span>
    </div>
  );
}
```

---

## 10. Permissions & Privacy

### 10.1 Required Permissions

| Permission | Justification |
|------------|---------------|
| `activeTab` | Read current page content (user-gesture required) |
| `contextMenus` | Right-click "Ask DocMind" menu item |

### 10.2 NOT Requested

- `tabs` — not needed with `activeTab`
- No host permissions for background crawling or automated access. Content scripts are declared on `<all_urls>` for compatibility, but remain idle and do not extract or transmit data until explicit user action
- `storage` — no persistent user data in Beta
- `scripting` — not needed when using pre-declared content scripts

**Note on content scripts:** The `matches: ["<all_urls>"]` pattern in `content_scripts` allows passive injection, but content scripts only extract text **on explicit user action** (clicking the extension icon or context menu). There is no background crawling or automatic data collection. Content scripts do not transmit data and remain idle until they receive a user-initiated message.

Content scripts are pre-declared for cross-browser parity and reliable highlighting; extraction and highlighting only run after a user gesture and message from the extension. `activeTab` ensures extraction/highlighting can only occur after a user gesture, even though the content script is present for compatibility.

**Store review statement:** DocMind's content script is inert by default and only extracts/highlights page text after the user clicks the extension action or context menu.

### 10.3 Data Handling

- Page text extracted only on user-initiated query
- Text sent to API for current question only
- **URL may be sent to API for context hints (e.g., document type detection) but is not persisted or logged server-side**
- No page content stored persistently (client or server)
- No browsing history logged or tracked
- API key remains server-side only

---

## 11. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Cross-browser parity | All features work on Chrome, Edge, Firefox |
| Phase 1 polish | Dark mode, copy button, and custom icons shipped and verified on all browsers |
| Copy works | One-click copy to clipboard |
| Highlights appear | 1-5 citations per answer with clickable badges |
| Click-to-scroll works | Clicking citation scrolls and pulses source text |
| Confidence respected | Highlights only when confidence ≥ 85% |
| Graceful degradation | Clear messaging when highlighting unavailable |
| Dark mode | Respects system preference |
| Context menu | Right-click selected text invokes DocMind |
| Multi-turn | Follow-up questions maintain conversation context |

---

## 12. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1 | 1 week | Edge, copy, dark mode, icons |
| Phase 2 | 2 weeks | Firefox, context menu |
| Phase 3a | 2 weeks | Conservative highlighting |
| Phase 3b | 1.5 weeks | Highlight polish |
| Phase 4 | 1.5 weeks | Multi-turn memory |
| **Total** | **8 weeks** | Complete Beta |

---

## 13. Open Questions

1. Should we add keyboard shortcuts for quick actions?
2. Do we need analytics/telemetry for Beta feedback?
3. Should citation confidence scores be visible to users?
4. How do we handle very long documents (100k+ chars) for multi-turn context?

---

## Appendix A: Message Protocol

```typescript
// Popup → Background
type PopupMessage =
  | { type: 'QUERY'; payload: QueryRequest }
  | { type: 'HIGHLIGHT_CITATIONS'; citations: Citation[] }
  | { type: 'SCROLL_TO_CITATION'; citationId: string }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'REINDEX_PAGE' }
  | { type: 'GET_PENDING_CONTEXT' }    // Context menu flow
  | { type: 'CLEAR_PENDING_CONTEXT' }; // Context menu flow

// Background → Popup (responses)
type PendingContext = {
  kind: 'selection';
  tabId: number;
  selectionText: string;
  createdAt: number;
} | null;

type BackgroundResponse =
  | { type: 'PENDING_CONTEXT'; payload: PendingContext };

// Background → Content Script
type ContentMessage =
  | { type: 'EXTRACT_TEXT' }
  | { type: 'BUILD_INDEX' }
  | { type: 'INJECT_HIGHLIGHTS'; matches: MatchResult[] }
  | { type: 'SCROLL_TO'; citationId: string }
  | { type: 'CLEAR_HIGHLIGHTS' };

// Content Script → Background
type ContentResponse =
  | { type: 'TEXT_EXTRACTED'; text: string; charCount: number }
  | { type: 'INDEX_BUILT'; index: PageIndex }
  | { type: 'HIGHLIGHTS_INJECTED'; results: HighlightResult[] }
  | { type: 'PAGE_UNSUPPORTED'; reason: UnsupportedReason };
```

**Restricted page detection:** If `tabs.sendMessage` fails with "Receiving end does not exist" or "Could not establish connection", background returns `{ type: 'PAGE_UNSUPPORTED'; reason: 'restricted-page' }`. This occurs on `chrome://`, `about:`, Web Store pages, and similar restricted URLs where content scripts cannot run — even after user gesture with `activeTab`.

**Popup close handling:** Popup close triggers cleanup via `CLEAR_HIGHLIGHTS` message because content script cannot reliably observe popup lifecycle. Background sends this message on popup unmount.

---

## Appendix B: Levenshtein Distance Implementation

```typescript
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // substitution
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j] + 1       // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

---

## Appendix C: Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const browser = process.env.BROWSER || 'chrome';

  return {
    plugins: [react()],
    build: {
      outDir: `build/${browser}`,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
          content: resolve(__dirname, 'src/content/index.ts'),
        },
        output: {
          entryFileNames: '[name]/index.js',
        },
      },
    },
    define: {
      'process.env.BROWSER': JSON.stringify(browser),
    },
  };
});
```

**Note on background script naming:** The source file is `src/background/index.ts` and outputs to `background/index.js`. This file runs as a Service Worker on MV3 (Chrome/Edge) or as a persistent background page on MV2 (Firefox). Using `index.ts` instead of `service-worker.ts` avoids confusion since the same file serves both roles.

```typescript
// src/background/index.ts
// Runs as Service Worker (MV3) or persistent background page (MV2)
// Entry point for both Chrome/Edge and Firefox builds
```

**Build commands:**
```bash
# Chrome
BROWSER=chrome npm run build

# Edge
BROWSER=edge npm run build

# Firefox
BROWSER=firefox npm run build
```
