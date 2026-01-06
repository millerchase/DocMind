# DocMind Beta Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend DocMind MVP with cross-browser support (Edge, Firefox), source highlighting, context menu integration, and conversational memory.

**Architecture:** The extension uses Vite + React for the popup UI, a background service worker for message routing and API calls, and content scripts for page interaction. Beta introduces `webextension-polyfill` for cross-browser compatibility, a content script for highlighting, and state management for multi-turn conversations.

**Tech Stack:** TypeScript, React 18, Vite, webextension-polyfill, CSS variables for theming

---

## Prerequisites

Before starting implementation, ensure you have:
- Node.js 18+ installed
- The extension builds successfully: `cd extension && npm run build`
- Chrome loaded with the `dist/` folder as an unpacked extension for testing

---

## Phase 1: Polish & Easy Wins

### Task 1.1: Add webextension-polyfill Dependency

**Files:**
- Modify: `extension/package.json`

**Step 1: Install webextension-polyfill**

Run:
```bash
cd extension && npm install webextension-polyfill && npm install -D @anthropic-ai/sdk @anthropic-ai/bedrock-sdk webextension-polyfill
```

Wait, that's wrong. Let me fix:

Run:
```bash
cd extension && npm install webextension-polyfill && npm install -D @anthropic-ai/sdk
```

Expected: Package installed successfully

**Step 2: Verify package.json updated**

Check that `package.json` includes `"webextension-polyfill": "^0.12.0"` (or similar) in dependencies.

**Step 3: Commit**

```bash
git add extension/package.json extension/package-lock.json
git commit -m "$(cat <<'EOF'
feat(extension): add webextension-polyfill for cross-browser support

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Create Browser Abstraction Module

**Files:**
- Create: `extension/src/shared/browser.ts`

**Step 1: Create the browser abstraction**

```typescript
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
```

**Step 2: Verify the file compiles**

Run: `cd extension && npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add extension/src/shared/browser.ts
git commit -m "$(cat <<'EOF'
feat(extension): add browser abstraction for cross-browser support

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Add Copy to Clipboard Button

**Files:**
- Modify: `extension/src/popup/components/ResponseDisplay.tsx`
- Modify: `extension/src/popup/styles/popup.css`

**Step 1: Update ResponseDisplay component**

```typescript
// extension/src/popup/components/ResponseDisplay.tsx
import { useState } from 'react';
import { RESULT_MESSAGES } from '../constants';

interface ResponseDisplayProps {
  answer: string;
}

export function ResponseDisplay({ answer }: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);
  const isNoAnswer = answer === RESULT_MESSAGES.noAnswer;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail - clipboard may not be available
    }
  };

  return (
    <div
      className={`response ${isNoAnswer ? 'no-answer' : ''}`}
      role="region"
      aria-label="AI response"
      aria-live="polite"
    >
      <div className="response-header">
        <button
          type="button"
          onClick={handleCopy}
          className="copy-button"
          aria-label={copied ? 'Copied!' : 'Copy answer'}
          disabled={isNoAnswer}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="answer-text">{answer}</div>
    </div>
  );
}
```

**Step 2: Add CSS for copy button**

Add to `extension/src/popup/styles/popup.css`:

```css
/* Copy button styles */
.response-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.copy-button {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.copy-button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.copy-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 3: Verify it builds**

Run: `cd extension && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add extension/src/popup/components/ResponseDisplay.tsx extension/src/popup/styles/popup.css
git commit -m "$(cat <<'EOF'
feat(popup): add copy to clipboard button for answers

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Add Dark Mode Support

**Files:**
- Modify: `extension/src/popup/styles/popup.css`

**Step 1: Add CSS variables for theming**

Add at the TOP of `extension/src/popup/styles/popup.css`:

```css
/* Theme variables */
:root {
  /* Light theme (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-hover: #e8e8e8;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;
  --border-color: #e0e0e0;
  --border-hover: #c0c0c0;
  --accent-color: #2563eb;
  --accent-hover: #1d4ed8;
  --error-bg: #fef2f2;
  --error-text: #dc2626;
  --success-bg: #f0fdf4;
  --success-text: #16a34a;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2a2a2a;
    --bg-hover: #3a3a3a;
    --text-primary: #f5f5f5;
    --text-secondary: #a0a0a0;
    --text-muted: #707070;
    --border-color: #404040;
    --border-hover: #505050;
    --accent-color: #3b82f6;
    --accent-hover: #2563eb;
    --error-bg: #451a1a;
    --error-text: #f87171;
    --success-bg: #14532d;
    --success-text: #4ade80;
  }
}
```

**Step 2: Update existing CSS to use variables**

Replace hardcoded colors throughout `popup.css` with the CSS variables. Key replacements:

- `background: #fff` → `background: var(--bg-primary)`
- `background: #f5f5f5` → `background: var(--bg-secondary)`
- `color: #333` or similar → `color: var(--text-primary)`
- `color: #666` → `color: var(--text-secondary)`
- `border-color: #e0e0e0` → `border-color: var(--border-color)`
- Blue accent colors → `var(--accent-color)`

**Step 3: Verify it builds and renders**

Run: `cd extension && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add extension/src/popup/styles/popup.css
git commit -m "$(cat <<'EOF'
feat(popup): add dark mode support via CSS variables

Respects prefers-color-scheme system preference

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Update Types for Beta API Contract

**Files:**
- Modify: `extension/src/shared/types.ts`

**Step 1: Extend types for citations and Beta features**

```typescript
// extension/src/shared/types.ts

export interface ExtractionResult {
  success: boolean;
  text: string;
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
  error?: ErrorCode;
}

export type ErrorCode =
  | 'NO_EXTRACTABLE_TEXT'
  | 'NO_BODY_ELEMENT'
  | 'CANNOT_ACCESS_PAGE'
  | 'EXTRACTION_FAILED'
  | 'INSUFFICIENT_TEXT'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'UNEXPECTED_RESPONSE'
  | 'TIMEOUT'
  | 'JSON_PARSE_FAILED'
  | 'INVALID_RESPONSE';

// Mode replaces Action for Beta (aligns with PRD terminology)
export type Mode = 'qa' | 'summary' | 'eli5' | 'key-takeaways' | 'main-arguments';

// Deprecated: kept for backward compatibility during migration
export type Action = 'ask' | 'summarize' | 'takeaways' | 'eli5' | 'arguments';

// Beta: Citation from LLM response
export interface Citation {
  id: string;           // "cite-1", "cite-2", etc.
  text: string;         // Exact quote from document (50-200 chars ideal)
  relevance: string;    // Brief label: "Definition", "Key stat", "Conclusion"
}

// Beta: Extended query request
export interface QueryRequest {
  pageText: string;
  question: string;
  url?: string;
  mode?: Mode;
  // Phase 4: Conversation support (added later)
  conversation?: ConversationPayload;
}

// Phase 4: Conversation message
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Phase 4: Conversation payload
export interface ConversationPayload {
  threadId: string;
  messages: ConversationMessage[];
  pageUrlIdentity: string;
  mode: Mode;
}

// Beta: Extended query response
export interface QueryResponse {
  answer: string;
  citations: Citation[];
  truncated: boolean;
  charactersAnalyzed: number;
}

export interface QueryError {
  error: ErrorCode;
  message?: string;
}

export type QueryResult = QueryResponse | QueryError;

// Highlight lifecycle states
export type HighlightLifecycle =
  | { state: 'idle' }
  | { state: 'active'; citationIds: string[] }
  | { state: 'stale'; reason: StaleReason }
  | { state: 'unsupported'; reason: UnsupportedReason };

export type StaleReason = 'path-changed' | 'params-changed' | 'expired' | 'dom-changed';

export type UnsupportedReason =
  | 'virtualized-content'
  | 'iframe-heavy'
  | 'shadow-dom-content'
  | 'insufficient-text'
  | 'too-large'
  | 'restricted-page';

// Match result from citation matching
export interface MatchResult {
  citationId: string;
  status: 'matched' | 'low-confidence' | 'not-found' | 'skipped';
  confidence: number;
  skipReason?: HighlightSkipReason;
}

export type HighlightSkipReason =
  | 'quote-spans-multiple-sections'
  | 'page-structure-unsupported'
  | 'confidence-below-threshold'
  | 'match-timeout';
```

**Step 2: Verify types compile**

Run: `cd extension && npm run typecheck`
Expected: No type errors

**Step 3: Commit**

```bash
git add extension/src/shared/types.ts
git commit -m "$(cat <<'EOF'
feat(types): extend types for Beta API contract

- Add Citation type for source highlighting
- Add Mode type (replaces Action)
- Add highlight lifecycle and match result types
- Add Phase 4 conversation types (stubs)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.6: Create Edge Manifest

**Files:**
- Create: `extension/browsers/edge/manifest.json`
- Create: `extension/browsers/chrome/manifest.json`
- Modify: `extension/vite.config.ts`

**Step 1: Create browsers directory structure**

Run:
```bash
mkdir -p extension/browsers/chrome extension/browsers/edge extension/browsers/firefox
```

**Step 2: Create Chrome manifest (copy from public)**

```json
// extension/browsers/chrome/manifest.json
{
  "manifest_version": 3,
  "name": "DocMind",
  "version": "2.0.0",
  "description": "AI-powered document Q&A with source highlighting",

  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "permissions": [
    "activeTab",
    "contextMenus"
  ],

  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "run_at": "document_idle"
  }],

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Step 3: Create Edge manifest (nearly identical to Chrome)**

```json
// extension/browsers/edge/manifest.json
{
  "manifest_version": 3,
  "name": "DocMind",
  "version": "2.0.0",
  "description": "AI-powered document Q&A with source highlighting",

  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "permissions": [
    "activeTab",
    "contextMenus"
  ],

  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "run_at": "document_idle"
  }],

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Step 4: Create Firefox manifest (MV2)**

```json
// extension/browsers/firefox/manifest.json
{
  "manifest_version": 2,
  "name": "DocMind",
  "version": "2.0.0",
  "description": "AI-powered document Q&A with source highlighting",

  "browser_action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "permissions": [
    "activeTab",
    "contextMenus"
  ],

  "background": {
    "scripts": ["background/index.js"]
  },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "run_at": "document_idle"
  }],

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "browser_specific_settings": {
    "gecko": {
      "id": "docmind@example.com",
      "strict_min_version": "109.0"
    }
  }
}
```

**Step 5: Commit**

```bash
git add extension/browsers/
git commit -m "$(cat <<'EOF'
feat(extension): add browser-specific manifests

- Chrome MV3 manifest
- Edge MV3 manifest (identical to Chrome)
- Firefox MV2 manifest with gecko settings

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.7: Update Vite Config for Multi-Browser Builds

**Files:**
- Modify: `extension/vite.config.ts`
- Modify: `extension/package.json`

**Step 1: Update vite.config.ts**

```typescript
// extension/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const browser = process.env.BROWSER || 'chrome';
  const validBrowsers = ['chrome', 'edge', 'firefox'];

  if (!validBrowsers.includes(browser)) {
    throw new Error(`Invalid BROWSER env: ${browser}. Must be one of: ${validBrowsers.join(', ')}`);
  }

  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: `browsers/${browser}/manifest.json`, dest: '.' },
          { src: 'public/icons/*', dest: 'icons' },
        ],
      }),
    ],

    build: {
      outDir: `build/${browser}`,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          'popup/index': resolve(__dirname, 'src/popup/index.html'),
          'background/index': resolve(__dirname, 'src/background/index.ts'),
          'content/index': resolve(__dirname, 'src/content/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      'process.env.BROWSER': JSON.stringify(browser),
    },
  };
});
```

**Step 2: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "BROWSER=chrome vite build --watch",
    "dev:chrome": "BROWSER=chrome vite build --watch",
    "dev:edge": "BROWSER=edge vite build --watch",
    "dev:firefox": "BROWSER=firefox vite build --watch",
    "build": "npm run build:chrome && npm run build:edge && npm run build:firefox",
    "build:chrome": "BROWSER=chrome vite build",
    "build:edge": "BROWSER=edge vite build",
    "build:firefox": "BROWSER=firefox vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 3: Create stub content script**

Create `extension/src/content/index.ts`:

```typescript
// extension/src/content/index.ts
// Content script entry point
// This file is intentionally minimal - highlighting logic added in Phase 3

import { browser } from '../shared/browser';

// Content script is loaded but idle until it receives a message
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }
  return false;
});

console.log('[DocMind] Content script loaded');
```

**Step 4: Verify builds work**

Run:
```bash
cd extension && npm run build:chrome
```
Expected: Build succeeds, output in `build/chrome/`

**Step 5: Commit**

```bash
git add extension/vite.config.ts extension/package.json extension/src/content/index.ts
git commit -m "$(cat <<'EOF'
feat(extension): add multi-browser build configuration

- Vite config accepts BROWSER env var
- Separate build outputs per browser
- Add stub content script for Phase 3

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.8: Rename Background Script

**Files:**
- Rename: `extension/src/background/service-worker.ts` → `extension/src/background/index.ts`
- Modify: `extension/src/background/index.ts` (update to use browser polyfill)

**Step 1: Rename the file**

Run:
```bash
mv extension/src/background/service-worker.ts extension/src/background/index.ts
```

**Step 2: Update background script to use browser polyfill**

```typescript
// extension/src/background/index.ts
// Runs as Service Worker (MV3) or persistent background page (MV2)

import { browser } from '../shared/browser';
import type { ExtractionResult } from '../shared/types';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_TEXT') {
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
    return true;
  }
  return false;
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
```

**Step 3: Verify it compiles**

Run: `cd extension && npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add extension/src/background/
git commit -m "$(cat <<'EOF'
refactor(background): rename to index.ts, use browser polyfill

- Rename service-worker.ts to index.ts for cross-browser clarity
- Use webextension-polyfill for browser API abstraction

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.9: Update Popup to Use Browser Polyfill

**Files:**
- Modify: `extension/src/popup/hooks/useDocMind.ts`

**Step 1: Update useDocMind hook**

```typescript
// extension/src/popup/hooks/useDocMind.ts
import { useState, useEffect } from 'react';
import { browser, getActiveTab } from '../../shared/browser';
import { ExtractionResult, ErrorCode, Action } from '../../shared/types';
import { fetchAnswer } from '../api';

type BaseExtracted = {
  text: string;
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
};

export type State =
  | { status: 'idle' }
  | { status: 'extracting' }
  | ({ status: 'extracted' } & BaseExtracted)
  | ({ status: 'querying'; action: Action } & BaseExtracted)
  | ({ status: 'success'; answer: string; action: Action } & BaseExtracted)
  | ({
      status: 'error';
      error: ErrorCode;
      lastAction?: Action;
      lastQuestion?: string;
    } & Partial<BaseExtracted>);

export function useDocMind() {
  const [state, setState] = useState<State>({ status: 'idle' });

  // Auto-extract on mount
  useEffect(() => {
    extract();
  }, []);

  async function extract() {
    setState({ status: 'extracting' });

    try {
      const tab = await getActiveTab();

      if (!tab?.id) {
        setState({ status: 'error', error: 'CANNOT_ACCESS_PAGE' });
        return;
      }

      const result = (await browser.runtime.sendMessage({
        type: 'EXTRACT_TEXT',
        tabId: tab.id,
      })) as ExtractionResult;

      if (!result.success) {
        setState({
          status: 'error',
          error: result.error || 'EXTRACTION_FAILED',
        });
        return;
      }

      setState({
        status: 'extracted',
        text: result.text,
        charCount: result.charCount,
        truncated: result.truncated,
        isPDF: result.isPDF,
      });
    } catch {
      setState({ status: 'error', error: 'EXTRACTION_FAILED' });
    }
  }

  async function runAction(action: Action, question?: string) {
    if (state.status !== 'extracted' && state.status !== 'success') return;

    const { text, charCount, truncated, isPDF } = state;
    setState({ status: 'querying', text, charCount, truncated, isPDF, action });

    const result = await fetchAnswer(text, action, question);

    if ('error' in result) {
      setState({
        status: 'error',
        error: result.error,
        text,
        charCount,
        truncated,
        isPDF,
        lastAction: action,
        lastQuestion: question,
      });
      return;
    }

    setState({
      status: 'success',
      answer: result.answer,
      action,
      text,
      charCount,
      truncated,
      isPDF,
    });
  }

  function retry() {
    if (state.status === 'error' && state.lastAction && state.text) {
      runAction(state.lastAction, state.lastQuestion);
      return;
    }

    if ('text' in state && state.text) {
      setState({
        status: 'extracted',
        text: state.text,
        charCount: state.charCount!,
        truncated: state.truncated!,
        isPDF: state.isPDF!,
      });
    } else {
      extract();
    }
  }

  return { state, extract, runAction, retry };
}
```

**Step 2: Verify it compiles**

Run: `cd extension && npm run typecheck`
Expected: No errors

**Step 3: Build and test**

Run: `cd extension && npm run build:chrome`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add extension/src/popup/hooks/useDocMind.ts
git commit -m "$(cat <<'EOF'
refactor(popup): use browser polyfill in useDocMind hook

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Cross-Browser & Context Menu

### Task 2.1: Add Context Menu Registration

**Files:**
- Modify: `extension/src/background/index.ts`
- Create: `extension/src/shared/constants.ts`

**Step 1: Create shared constants**

```typescript
// extension/src/shared/constants.ts
export const CONTEXT_MENU_CONFIG = {
  MAX_SELECTION_CHARS: 500,
  MIN_SELECTION_CHARS: 3,
  PENDING_CONTEXT_TTL_MS: 30_000,
} as const;

export const CHAT_CONFIG = {
  MAX_PAGE_CHARS: 30_000,
  MAX_MESSAGES: 6,
  MAX_HISTORY_CHARS: 4_000,
} as const;

export const HIGHLIGHT_CONFIG = {
  MIN_CONFIDENCE_THRESHOLD: 0.85,
  MAX_MATCH_TIME_MS: 500,
  MAX_DOM_NODES: 10_000,
  MAX_FALLBACK_CHECKS: 500,
  MAX_NODE_TEXT_LEN: 20_000,
} as const;

Object.freeze(HIGHLIGHT_CONFIG);

export const CITATION_LIMITS = {
  MIN_COUNT: 1,
  MAX_COUNT: 5,
  MIN_TEXT_LENGTH: 20,
  MAX_TEXT_LENGTH: 300,
} as const;
```

**Step 2: Add context menu to background script**

Update `extension/src/background/index.ts` to add context menu registration and handling:

```typescript
// extension/src/background/index.ts
// Add these imports and code at the top, after existing imports

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

// Update message listener to handle context menu messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_TEXT') {
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
    return true;
  }

  if (message.type === 'GET_PENDING_CONTEXT') {
    const tabId = lastPendingTabId;
    const pending = tabId ? pendingContextByTabId.get(tabId) : null;

    // Check TTL
    if (pending && Date.now() - pending.createdAt > CONTEXT_MENU_CONFIG.PENDING_CONTEXT_TTL_MS) {
      pendingContextByTabId.delete(tabId!);
      lastPendingTabId = null;
      sendResponse({ type: 'PENDING_CONTEXT', payload: null });
      return true;
    }

    sendResponse({
      type: 'PENDING_CONTEXT',
      payload: pending ? { kind: 'selection', tabId, ...pending } : null,
    });
    return true;
  }

  if (message.type === 'CLEAR_PENDING_CONTEXT') {
    if (lastPendingTabId) {
      pendingContextByTabId.delete(lastPendingTabId);
      lastPendingTabId = null;
    }
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// ... rest of existing code (handleExtraction, extractTextInPage)
```

**Step 3: Commit**

```bash
git add extension/src/shared/constants.ts extension/src/background/index.ts
git commit -m "$(cat <<'EOF'
feat(extension): add context menu integration

- Register "Ask DocMind about this" context menu on install
- Store pending context with TTL for popup prefill
- Handle GET_PENDING_CONTEXT and CLEAR_PENDING_CONTEXT messages

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Update Popup to Handle Context Menu Prefill

**Files:**
- Modify: `extension/src/popup/hooks/useDocMind.ts`
- Modify: `extension/src/popup/components/QuestionInput.tsx`
- Modify: `extension/src/popup/App.tsx`

**Step 1: Add pending context handling to useDocMind**

Add a new function and state to handle prefilled questions:

```typescript
// In extension/src/popup/hooks/useDocMind.ts
// Add to the hook:

const [prefillQuestion, setPrefillQuestion] = useState<string | null>(null);

// Add this effect after the extract() effect:
useEffect(() => {
  async function checkPendingContext() {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_PENDING_CONTEXT',
      }) as { type: string; payload: { selectionText: string } | null };

      if (response?.payload?.selectionText) {
        const question = `What does this mean: "${response.payload.selectionText}"?`;
        setPrefillQuestion(question);

        // Clear the pending context so it doesn't persist
        await browser.runtime.sendMessage({ type: 'CLEAR_PENDING_CONTEXT' });
      }
    } catch {
      // Silently fail - context menu flow is optional
    }
  }

  checkPendingContext();
}, []);

// Update return to include prefillQuestion:
return { state, extract, runAction, retry, prefillQuestion, clearPrefill: () => setPrefillQuestion(null) };
```

**Step 2: Update QuestionInput to accept initial value**

```typescript
// extension/src/popup/components/QuestionInput.tsx
import { useState, useEffect, FormEvent } from 'react';
import { PLACEHOLDERS } from '../constants';

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  disabled: boolean;
  initialValue?: string | null;
  onInitialValueUsed?: () => void;
}

export function QuestionInput({
  onSubmit,
  disabled,
  initialValue,
  onInitialValueUsed
}: QuestionInputProps) {
  const [question, setQuestion] = useState('');

  // Handle initial value from context menu
  useEffect(() => {
    if (initialValue) {
      setQuestion(initialValue);
      onInitialValueUsed?.();
    }
  }, [initialValue, onInitialValueUsed]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setQuestion('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="question-form">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={PLACEHOLDERS.questionInput}
        disabled={disabled}
        className="question-input"
        aria-label="Ask a question about this page"
        autoFocus
      />
      <button
        type="submit"
        disabled={disabled || !question.trim()}
        className="submit-button"
      >
        Ask
      </button>
    </form>
  );
}
```

**Step 3: Update App.tsx to pass prefill**

```typescript
// In extension/src/popup/App.tsx
// Update the component to use prefillQuestion:

export default function App() {
  const { state, runAction, retry, prefillQuestion, clearPrefill } = useDocMind();

  // ... existing code ...

  // In the return, update QuestionInput:
  <QuestionInput
    onSubmit={handleAsk}
    disabled={isBusy}
    initialValue={prefillQuestion}
    onInitialValueUsed={clearPrefill}
  />
}
```

**Step 4: Verify it compiles**

Run: `cd extension && npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add extension/src/popup/hooks/useDocMind.ts extension/src/popup/components/QuestionInput.tsx extension/src/popup/App.tsx
git commit -m "$(cat <<'EOF'
feat(popup): handle context menu prefill

- Check for pending context on popup mount
- Prefill question input with selected text
- Clear pending context after use

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3a: Conservative Source Highlighting

### Task 3a.1: Create URL Identity Utilities

**Files:**
- Create: `extension/src/shared/urlIdentity.ts`

**Step 1: Create URL identity module**

```typescript
// extension/src/shared/urlIdentity.ts

export interface UrlIdentity {
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

export function parseUrlIdentity(url: string): UrlIdentity {
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

export type StaleCheckResult =
  | { stale: false }
  | { stale: true; reason: 'path-changed' | 'params-changed' | 'expired' | 'dom-changed' };

export function checkStale(
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

**Step 2: Commit**

```bash
git add extension/src/shared/urlIdentity.ts
git commit -m "$(cat <<'EOF'
feat(shared): add URL identity utilities for stale detection

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.2: Create Text Normalizer

**Files:**
- Create: `extension/src/content/normalizer.ts`

**Step 1: Create normalizer module**

```typescript
// extension/src/content/normalizer.ts

export function normalizeForMatching(
  text: string,
  type: 'prose' | 'code' | 'heading'
): string {
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

**Step 2: Commit**

```bash
git add extension/src/content/normalizer.ts
git commit -m "$(cat <<'EOF'
feat(content): add text normalizer for citation matching

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.3: Create Page Classifier

**Files:**
- Create: `extension/src/content/pageClassifier.ts`

**Step 1: Create page classifier**

```typescript
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

  const bodyText = document.body?.innerText?.trim().length || 0;
  if (bodyText < 200 && elements.length > 50) {
    return true;
  }

  return false;
}
```

**Step 2: Commit**

```bash
git add extension/src/content/pageClassifier.ts
git commit -m "$(cat <<'EOF'
feat(content): add page classifier for highlight support detection

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.4: Create Page Indexer

**Files:**
- Create: `extension/src/content/pageIndexer.ts`

**Step 1: Create page indexer**

```typescript
// extension/src/content/pageIndexer.ts
import { normalizeForMatching } from './normalizer';
import { parseUrlIdentity, type UrlIdentity } from '../shared/urlIdentity';
import { HIGHLIGHT_CONFIG } from '../shared/constants';

export interface TextSegment {
  text: string;
  normalizedText: string;
  type: 'prose' | 'code' | 'heading';
  nodePath: number[];
  textOffset: number;
}

export interface PageIdentity extends UrlIdentity {
  tabId: number;
  title: string;
  capturedAt: number;
}

export interface PageIndex {
  identity: PageIdentity;
  segments: TextSegment[];
  fullText: string;
  normalizedFullText: string;
  isStale: boolean;
  builtAt: number;
}

export class PageIndexer {
  private visibilityCache = new WeakMap<Element, boolean>();

  buildIndex(tabId: number): PageIndex | { error: 'too-large' | 'insufficient-text' } {
    const urlIdentity = parseUrlIdentity(window.location.href);
    const segments: TextSegment[] = [];
    const root = document.querySelector('main') || document.querySelector('article') || document.body;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    let nodeCount = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text)) {
      if (++nodeCount > HIGHLIGHT_CONFIG.MAX_DOM_NODES) {
        return { error: 'too-large' };
      }

      if (!this.isVisible(node)) continue;

      const text = node.textContent?.trim();
      if (!text || text.length < 10) continue;

      const type = this.classifyNode(node);
      if (type === 'code') continue; // Phase 3a: prose only

      const segment: TextSegment = {
        text,
        normalizedText: normalizeForMatching(text, type),
        type,
        nodePath: this.getNodePath(node),
        textOffset: 0,
      };

      segments.push(segment);
    }

    if (segments.length === 0) {
      return { error: 'insufficient-text' };
    }

    const fullText = segments.map(s => s.text).join(' ');
    const normalizedFullText = segments.map(s => s.normalizedText).join(' ');

    return {
      identity: {
        ...urlIdentity,
        tabId,
        title: document.title,
        capturedAt: Date.now(),
      },
      segments,
      fullText,
      normalizedFullText,
      isStale: false,
      builtAt: Date.now(),
    };
  }

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

  private classifyNode(node: Text): 'prose' | 'code' | 'heading' {
    let parent = node.parentElement;
    while (parent) {
      const tag = parent.tagName.toLowerCase();
      if (tag === 'code' || tag === 'pre' || tag === 'samp' || tag === 'kbd') {
        return 'code';
      }
      if (/^h[1-6]$/.test(tag)) {
        return 'heading';
      }
      parent = parent.parentElement;
    }
    return 'prose';
  }

  private getNodePath(node: Node): number[] {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== document.body) {
      const parent = current.parentNode;
      if (parent) {
        const children = Array.from(parent.childNodes);
        path.unshift(children.indexOf(current as ChildNode));
      }
      current = parent;
    }

    return path;
  }
}
```

**Step 2: Commit**

```bash
git add extension/src/content/pageIndexer.ts
git commit -m "$(cat <<'EOF'
feat(content): add page indexer for text segment extraction

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.5: Create Citation Matcher

**Files:**
- Create: `extension/src/content/citationMatcher.ts`

**Step 1: Create citation matcher**

```typescript
// extension/src/content/citationMatcher.ts
import type { Citation, MatchResult, HighlightSkipReason } from '../shared/types';
import type { PageIndex, TextSegment } from './pageIndexer';
import { normalizeForMatching } from './normalizer';
import { HIGHLIGHT_CONFIG } from '../shared/constants';

const MIN_TOKENS_FOR_OVERLAP = 6;

export function matchCitations(
  citations: Citation[],
  index: PageIndex
): MatchResult[] {
  const results: MatchResult[] = [];
  const start = performance.now();

  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i];

    // Timeout guard
    if (performance.now() - start > HIGHLIGHT_CONFIG.MAX_MATCH_TIME_MS) {
      for (let j = i; j < citations.length; j++) {
        results.push({
          citationId: citations[j].id,
          status: 'skipped',
          confidence: 0,
          skipReason: 'match-timeout',
        });
      }
      break;
    }

    const normalizedQuote = normalizeForMatching(citation.text, 'prose');
    const quoteTokens = normalizedQuote.split(/\s+/).filter(t => t.length > 2);

    let candidates: { segment: TextSegment; score: number }[];

    if (quoteTokens.length < MIN_TOKENS_FOR_OVERLAP) {
      // Short quote: use substring matching
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
      // Normal quote: use token overlap
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
      if (couldSpanSegments(normalizedQuote, segment, index)) {
        skipResult = {
          citationId: citation.id,
          status: 'skipped',
          confidence: 0,
          skipReason: 'quote-spans-multiple-sections',
        };
        break;
      }

      const similarity = preciseMatch(normalizedQuote, segment.normalizedText);

      if (similarity > (bestMatch?.confidence || 0)) {
        bestMatch = {
          citationId: citation.id,
          status: similarity >= HIGHLIGHT_CONFIG.MIN_CONFIDENCE_THRESHOLD ? 'matched' : 'low-confidence',
          confidence: similarity,
          skipReason: similarity < HIGHLIGHT_CONFIG.MIN_CONFIDENCE_THRESHOLD
            ? 'confidence-below-threshold'
            : undefined,
        };

        if (similarity >= 0.95) break;
      }
    }

    results.push(
      skipResult ||
      bestMatch ||
      { citationId: citation.id, status: 'not-found', confidence: 0 }
    );
  }

  return results;
}

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

function couldSpanSegments(
  quote: string,
  currentSegment: TextSegment,
  index: PageIndex
): boolean {
  const segmentIndex = index.segments.indexOf(currentSegment);
  if (segmentIndex === -1 || segmentIndex >= index.segments.length - 1) {
    return false;
  }

  const nextSegment = index.segments[segmentIndex + 1];
  const combined = currentSegment.normalizedText + ' ' + nextSegment.normalizedText;

  return combined.includes(quote) && !currentSegment.normalizedText.includes(quote);
}

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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

**Step 2: Commit**

```bash
git add extension/src/content/citationMatcher.ts
git commit -m "$(cat <<'EOF'
feat(content): add two-phase citation matcher

- Token overlap filter for candidate selection
- Levenshtein-based precise matching
- Cross-segment detection

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.6: Create Highlighter

**Files:**
- Create: `extension/src/content/highlighter.ts`

**Step 1: Create highlighter module**

```typescript
// extension/src/content/highlighter.ts
import { browser } from '../shared/browser';
import type { Citation } from '../shared/types';
import { HIGHLIGHT_CONFIG } from '../shared/constants';

export class SafeHighlighter {
  private highlights = new Map<string, HTMLElement[]>();
  private didSetup = false;

  inject(citation: Citation): boolean {
    const range = this.findRangeForCitation(citation);
    if (!range) return false;

    const textNode = range.startContainer as Text;
    const mark = this.wrapTextRange(
      textNode,
      range.startOffset,
      range.endOffset,
      citation.id
    );

    if (!mark) return false;

    const existing = this.highlights.get(citation.id) || [];
    existing.push(mark);
    this.highlights.set(citation.id, existing);

    return true;
  }

  scrollTo(citationId: string): void {
    const marks = this.highlights.get(citationId);
    if (!marks || marks.length === 0) return;

    const firstMark = marks[0];
    firstMark.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Add pulse effect
    firstMark.classList.add('docmind-pulse');
    setTimeout(() => {
      firstMark.classList.remove('docmind-pulse');
    }, 900);
  }

  cleanup(citationId?: string): void {
    const toClean = citationId
      ? [[citationId, this.highlights.get(citationId)] as const]
      : Array.from(this.highlights.entries());

    for (const [id, marks] of toClean) {
      if (!marks) continue;

      marks.forEach(mark => this.unwrapMark(mark));
      this.highlights.delete(id);
    }
  }

  setupAutoCleanup(): void {
    if (this.didSetup) return;
    this.didSetup = true;

    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'CLEAR_HIGHLIGHTS') {
        this.cleanup();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.cleanup();
    });

    window.addEventListener('popstate', () => this.cleanup());
    window.addEventListener('hashchange', () => this.cleanup());
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  private findRangeForCitation(citation: Citation): Range | null {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const searchText = citation.text.toLowerCase();
    let node: Text | null;
    let checked = 0;

    while ((node = walker.nextNode() as Text)) {
      if (++checked > HIGHLIGHT_CONFIG.MAX_FALLBACK_CHECKS) break;

      const rawText = node.textContent || '';
      if (rawText.length < citation.text.length) continue;
      if (rawText.length > HIGHLIGHT_CONFIG.MAX_NODE_TEXT_LEN) continue;

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

  private wrapTextRange(
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

      const matchAndAfter = startOffset > 0
        ? textNode.splitText(startOffset)
        : textNode;

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
      console.warn('[DocMind] Text wrapping failed:', error);
      return null;
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
}
```

**Step 2: Commit**

```bash
git add extension/src/content/highlighter.ts
git commit -m "$(cat <<'EOF'
feat(content): add safe highlighter with auto-cleanup

- Text node wrapping via splitText
- Scroll-to with pulse effect
- Auto-cleanup on visibility change and navigation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.7: Create Highlight Styles

**Files:**
- Create: `extension/src/content/highlight.css`
- Modify: `extension/src/content/index.ts`

**Step 1: Create highlight CSS**

```css
/* extension/src/content/highlight.css */
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

**Step 2: Update content script to inject styles**

```typescript
// extension/src/content/index.ts
import { browser } from '../shared/browser';
import { SafeHighlighter } from './highlighter';
import { PageIndexer } from './pageIndexer';
import { classifyPage } from './pageClassifier';
import { matchCitations } from './citationMatcher';
import type { Citation, MatchResult, UnsupportedReason } from '../shared/types';

// Inject styles
const styleId = 'docmind-highlight-styles';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
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
  `;
  document.head.appendChild(style);
}

const highlighter = new SafeHighlighter();
const indexer = new PageIndexer();
let currentIndex: ReturnType<typeof indexer.buildIndex> | null = null;

highlighter.setupAutoCleanup();

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }

  if (message.type === 'BUILD_INDEX') {
    const support = classifyPage();
    if (!support.supported) {
      sendResponse({ type: 'PAGE_UNSUPPORTED', reason: support.reason });
      return true;
    }

    const result = indexer.buildIndex(message.tabId);
    if ('error' in result) {
      sendResponse({ type: 'PAGE_UNSUPPORTED', reason: result.error as UnsupportedReason });
      return true;
    }

    currentIndex = result;
    sendResponse({ type: 'INDEX_BUILT', index: result });
    return true;
  }

  if (message.type === 'INJECT_HIGHLIGHTS') {
    const citations = message.citations as Citation[];
    const results: { citationId: string; injected: boolean }[] = [];

    for (const citation of citations) {
      const injected = highlighter.inject(citation);
      results.push({ citationId: citation.id, injected });
    }

    sendResponse({ type: 'HIGHLIGHTS_INJECTED', results });
    return true;
  }

  if (message.type === 'MATCH_CITATIONS') {
    if (!currentIndex || 'error' in currentIndex) {
      sendResponse({ type: 'MATCH_RESULTS', results: [] });
      return true;
    }

    const citations = message.citations as Citation[];
    const results = matchCitations(citations, currentIndex);
    sendResponse({ type: 'MATCH_RESULTS', results });
    return true;
  }

  if (message.type === 'SCROLL_TO') {
    highlighter.scrollTo(message.citationId);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLEAR_HIGHLIGHTS') {
    highlighter.cleanup();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

console.log('[DocMind] Content script loaded');
```

**Step 3: Commit**

```bash
git add extension/src/content/
git commit -m "$(cat <<'EOF'
feat(content): complete content script with highlighting support

- Inject highlight styles on load
- Handle BUILD_INDEX, INJECT_HIGHLIGHTS, MATCH_CITATIONS messages
- Support SCROLL_TO and CLEAR_HIGHLIGHTS

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.8: Add Response Parser

**Files:**
- Create: `extension/src/shared/responseParser.ts`

**Step 1: Create response parser**

```typescript
// extension/src/shared/responseParser.ts
import type { QueryResponse, Citation } from './types';
import { CITATION_LIMITS, CHAT_CONFIG } from './constants';

export type ParsedResponse =
  | { success: true; data: QueryResponse }
  | { success: false; error: 'JSON_PARSE_FAILED' | 'INVALID_RESPONSE' };

export function parseApiResponse(raw: string, pageCharCount: number): ParsedResponse {
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
          .slice(0, CITATION_LIMITS.MAX_COUNT)
      : [];

    return {
      success: true,
      data: {
        answer: parsed.answer,
        citations: validCitations,
        truncated: pageCharCount > CHAT_CONFIG.MAX_PAGE_CHARS,
        charactersAnalyzed: Math.min(pageCharCount, CHAT_CONFIG.MAX_PAGE_CHARS),
      },
    };
  } catch {
    return { success: false, error: 'JSON_PARSE_FAILED' };
  }
}
```

**Step 2: Commit**

```bash
git add extension/src/shared/responseParser.ts
git commit -m "$(cat <<'EOF'
feat(shared): add API response parser with citation validation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.9: Update API Prompt for Citations

**Files:**
- Modify: `api/app/api/query/route.ts`

**Step 1: Update system prompt**

```typescript
// api/app/api/query/route.ts
// Update SYSTEM_PROMPT to request citations:

const SYSTEM_PROMPT = `You are DocMind, an AI assistant that answers questions strictly using the provided document text. Do not use outside knowledge.

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
}`;
```

**Step 2: Update response handling**

Update the POST handler to return the raw JSON response:

```typescript
// In POST function, after getting textBlock:
return NextResponse.json(
  { raw: textBlock.text },
  { headers: corsHeaders }
);
```

**Step 3: Commit**

```bash
git add api/app/api/query/route.ts
git commit -m "$(cat <<'EOF'
feat(api): update prompt for citation extraction

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.10: Update Popup API Client

**Files:**
- Modify: `extension/src/popup/api.ts`

**Step 1: Update API client to parse citations**

```typescript
// extension/src/popup/api.ts
import type { Action, ErrorCode, QueryResponse, Citation } from '../shared/types';
import { parseApiResponse } from '../shared/responseParser';

const PROD_URL = import.meta.env.VITE_DOCMIND_API_URL;

const API_URL =
  import.meta.env.PROD && PROD_URL
    ? PROD_URL
    : 'http://localhost:3000/api/query';

export async function fetchAnswer(
  text: string,
  action: Action,
  question?: string
): Promise<QueryResponse | { error: ErrorCode }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, action, question }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: (data.error as ErrorCode) || 'API_ERROR' };
    }

    const data = await response.json().catch(() => ({}));

    // Handle new raw response format
    if (typeof data.raw === 'string') {
      const parsed = parseApiResponse(data.raw, text.length);
      if (!parsed.success) {
        return { error: parsed.error };
      }
      return parsed.data;
    }

    // Fallback for legacy response format
    if (typeof data.answer === 'string') {
      return {
        answer: data.answer,
        citations: [],
        truncated: text.length > 30000,
        charactersAnalyzed: Math.min(text.length, 30000),
      };
    }

    return { error: 'UNEXPECTED_RESPONSE' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'TIMEOUT' };
    }
    return { error: 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 2: Commit**

```bash
git add extension/src/popup/api.ts
git commit -m "$(cat <<'EOF'
feat(popup): update API client to parse citations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.11: Create Citation Badge Component

**Files:**
- Create: `extension/src/popup/components/CitationBadge.tsx`

**Step 1: Create citation badge component**

```typescript
// extension/src/popup/components/CitationBadge.tsx
import type { Citation, MatchResult } from '../../shared/types';

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  status: MatchResult['status'];
  onClickScroll: (id: string) => void;
}

export function CitationBadge({
  citation,
  index,
  status,
  onClickScroll
}: CitationBadgeProps) {
  const isClickable = status === 'matched';

  return (
    <button
      type="button"
      onClick={() => isClickable && onClickScroll(citation.id)}
      disabled={!isClickable}
      className={`citation-badge ${isClickable ? 'clickable' : 'disabled'}`}
      title={isClickable ? 'Click to scroll to source' : citation.text}
      aria-label={`Citation ${index + 1}${isClickable ? ', click to scroll' : ''}`}
    >
      <span className="citation-number">{index + 1}</span>
      {isClickable && (
        <span className="citation-arrow" aria-hidden="true">↗</span>
      )}
    </button>
  );
}
```

**Step 2: Add CSS for citation badges**

Add to `extension/src/popup/styles/popup.css`:

```css
/* Citation badge styles */
.citation-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 9999px;
  border: none;
  transition: background-color 0.2s, border-color 0.2s;
}

.citation-badge.clickable {
  background: var(--citation-bg, #fef08a);
  color: var(--citation-text, #854d0e);
  cursor: pointer;
}

.citation-badge.clickable:hover {
  background: var(--citation-bg-hover, #fde047);
}

.citation-badge.disabled {
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: default;
}

.citation-arrow {
  font-size: 10px;
}

/* Dark mode citation colors */
@media (prefers-color-scheme: dark) {
  :root {
    --citation-bg: #854d0e;
    --citation-text: #fef9c3;
    --citation-bg-hover: #a16207;
  }
}
```

**Step 3: Commit**

```bash
git add extension/src/popup/components/CitationBadge.tsx extension/src/popup/styles/popup.css
git commit -m "$(cat <<'EOF'
feat(popup): add citation badge component

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3a.12: Update ResponseDisplay for Citations

**Files:**
- Modify: `extension/src/popup/components/ResponseDisplay.tsx`

**Step 1: Update ResponseDisplay to show citations**

```typescript
// extension/src/popup/components/ResponseDisplay.tsx
import { useState } from 'react';
import { RESULT_MESSAGES } from '../constants';
import { CitationBadge } from './CitationBadge';
import type { Citation, MatchResult } from '../../shared/types';

interface ResponseDisplayProps {
  answer: string;
  citations?: Citation[];
  matchResults?: MatchResult[];
  onScrollToCitation?: (citationId: string) => void;
}

export function ResponseDisplay({
  answer,
  citations = [],
  matchResults = [],
  onScrollToCitation
}: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);
  const isNoAnswer = answer === RESULT_MESSAGES.noAnswer;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const getMatchStatus = (citationId: string): MatchResult['status'] => {
    const result = matchResults.find(r => r.citationId === citationId);
    return result?.status || 'not-found';
  };

  return (
    <div
      className={`response ${isNoAnswer ? 'no-answer' : ''}`}
      role="region"
      aria-label="AI response"
      aria-live="polite"
    >
      <div className="response-header">
        <button
          type="button"
          onClick={handleCopy}
          className="copy-button"
          aria-label={copied ? 'Copied!' : 'Copy answer'}
          disabled={isNoAnswer}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="answer-text">{answer}</div>

      {citations.length > 0 && (
        <div className="citations-section">
          <div className="citations-label">Sources:</div>
          <div className="citations-list">
            {citations.map((citation, index) => (
              <CitationBadge
                key={citation.id}
                citation={citation}
                index={index}
                status={getMatchStatus(citation.id)}
                onClickScroll={onScrollToCitation || (() => {})}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add CSS for citations section**

Add to `extension/src/popup/styles/popup.css`:

```css
/* Citations section */
.citations-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.citations-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.citations-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
```

**Step 3: Commit**

```bash
git add extension/src/popup/components/ResponseDisplay.tsx extension/src/popup/styles/popup.css
git commit -m "$(cat <<'EOF'
feat(popup): update ResponseDisplay with citation badges

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Conversational Memory

### Task 4.1: Add Conversation State to useDocMind

**Files:**
- Modify: `extension/src/popup/hooks/useDocMind.ts`

**Step 1: Extend state types for conversation**

Add conversation state management to the hook. This includes:
- `ConversationState` interface
- Thread ID generation
- Message history management
- Reset triggers

(Implementation details follow the PRD Section 4 Technical Design)

**Step 2: Commit**

```bash
git add extension/src/popup/hooks/useDocMind.ts
git commit -m "$(cat <<'EOF'
feat(popup): add multi-turn conversation state management

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: Update API for Conversation Context

**Files:**
- Modify: `extension/src/popup/api.ts`
- Modify: `api/app/api/query/route.ts`

**Step 1: Update API client to send conversation history**

**Step 2: Update API route to include history in prompt**

**Step 3: Commit**

```bash
git add extension/src/popup/api.ts api/app/api/query/route.ts
git commit -m "$(cat <<'EOF'
feat(api): add conversation history to API contract

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.3: Create Conversation Thread UI

**Files:**
- Create: `extension/src/popup/components/ConversationThread.tsx`
- Modify: `extension/src/popup/App.tsx`

**Step 1: Create conversation thread component**

Display conversation history with user/assistant message bubbles.

**Step 2: Update App.tsx to show thread**

**Step 3: Commit**

```bash
git add extension/src/popup/components/ConversationThread.tsx extension/src/popup/App.tsx
git commit -m "$(cat <<'EOF'
feat(popup): add conversation thread UI

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Steps

### Task F.1: Build All Browsers

Run:
```bash
cd extension && npm run build
```

Expected: Builds for chrome, edge, and firefox in `build/` directory

### Task F.2: Manual Testing Checklist

1. **Chrome**: Load `build/chrome/` as unpacked extension
   - [ ] Popup opens and extracts text
   - [ ] Dark mode toggles with system preference
   - [ ] Copy button works
   - [ ] Context menu appears on text selection
   - [ ] Context menu prefills question
   - [ ] Citations appear in response
   - [ ] Clickable citations scroll to source

2. **Edge**: Load `build/edge/` as unpacked extension
   - [ ] All above tests pass

3. **Firefox**: Load `build/firefox/` via about:debugging
   - [ ] All above tests pass (except programmatic popup open)

### Task F.3: Final Commit

```bash
git add .
git commit -m "$(cat <<'EOF'
chore: DocMind Beta implementation complete

Phase 1: Edge support, copy button, dark mode
Phase 2: Firefox support, context menu
Phase 3a: Conservative source highlighting
Phase 4: Multi-turn conversation memory

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Notes for Implementer

1. **Test incrementally**: After each task, run `npm run typecheck` and `npm run build:chrome` to catch errors early.

2. **Browser testing**: Chrome is the primary target. Test Edge/Firefox after major milestones.

3. **PRD reference**: The full PRD is at `docs/plans/2026-01-05-docmind-beta-design.md` - consult it for edge cases and rationale.

4. **Highlight trust**: The 85% confidence threshold is frozen. Do not lower it without explicit approval.

5. **Content script idempotency**: The content script style injection checks for existing styles to prevent duplicates on SPA navigation.
