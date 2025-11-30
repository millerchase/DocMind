# DocMind MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that extracts text from web pages and PDFs, then answers questions using Claude AI.

**Architecture:** Chrome Extension (Manifest V3) with React popup, service worker for message passing, and content script for text extraction. Separate Next.js API route on Vercel proxies requests to Claude API.

**Tech Stack:** TypeScript, React, Vite, Chrome Extension APIs, Next.js (App Router), Anthropic SDK

---

## Phase 1: Project Setup

### Task 1: Initialize Extension Package

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/.gitignore`

**Step 1: Create extension directory and package.json**

```bash
mkdir -p extension
```

Create `extension/package.json`:

```json
{
  "name": "docmind-extension",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-static-copy": "^1.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**Step 3: Create .gitignore**

Create `extension/.gitignore`:

```
node_modules/
dist/
.env.local
.env.production.local
*.log
```

**Step 4: Install dependencies**

Run: `cd extension && npm install`
Expected: Dependencies installed, node_modules created

**Step 5: Commit**

```bash
git add extension/package.json extension/tsconfig.json extension/.gitignore
git commit -m "chore: initialize extension package with dependencies"
```

---

### Task 2: Configure Vite Build

**Files:**
- Create: `extension/vite.config.ts`

**Step 1: Create Vite configuration**

Create `extension/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'public/manifest.json', dest: '.' },
        { src: 'public/icons/*', dest: 'icons' },
      ],
    }),
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
```

**Step 2: Commit**

```bash
git add extension/vite.config.ts
git commit -m "chore: add Vite build configuration"
```

---

### Task 3: Create Extension Manifest and Icons

**Files:**
- Create: `extension/public/manifest.json`
- Create: `extension/public/icons/` (placeholder icons)

**Step 1: Create public directory and manifest**

```bash
mkdir -p extension/public/icons
```

Create `extension/public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "DocMind",
  "version": "1.0.0",
  "description": "AI-powered document Q&A and summaries",

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
    "scripting"
  ],

  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Step 2: Create placeholder icons**

For MVP, create simple colored square PNGs (16x16, 48x48, 128x128). You can use any image editor or online tool. Place them at:
- `extension/public/icons/icon-16.png`
- `extension/public/icons/icon-48.png`
- `extension/public/icons/icon-128.png`

Note: These are placeholders. Replace with proper branding before Web Store submission.

**Step 3: Commit**

```bash
git add extension/public/
git commit -m "chore: add extension manifest and placeholder icons"
```

---

## Phase 2: Shared Types and Extraction Logic

### Task 4: Create Shared Types

**Files:**
- Create: `extension/src/shared/types.ts`

**Step 1: Create shared directory and types file**

```bash
mkdir -p extension/src/shared
```

Create `extension/src/shared/types.ts`:

```typescript
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
  | 'TIMEOUT';

export type Action = 'ask' | 'summarize' | 'takeaways' | 'eli5' | 'arguments';

export interface QueryRequest {
  text: string;
  question?: string;
  action: Action;
}

export interface QueryResponse {
  answer: string;
}

export interface QueryError {
  error: ErrorCode;
  message?: string;
}
```

**Step 2: Commit**

```bash
git add extension/src/shared/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 5: Implement Text Extractor

**Files:**
- Create: `extension/src/shared/extractor.ts`

**Step 1: Create extractor implementation**

Create `extension/src/shared/extractor.ts`:

```typescript
import { ExtractionResult } from './types';

const MAX_CHARS = 30000;

const BOILERPLATE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.nav', '.navbar', '.header', '.footer', '.sidebar',
  '.advertisement', '.ad', '.ads', '[class*="cookie"]',
  'script', 'style', 'noscript', 'iframe',
];

export function extractText(): ExtractionResult {
  // Guard against null body
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

  try {
    // Detect PDF viewer
    const isPDF =
      document.contentType === 'application/pdf' ||
      window.location.pathname.endsWith('.pdf');

    // Clone body to avoid modifying actual page
    const clone = document.body.cloneNode(true) as HTMLElement;

    // Remove boilerplate elements
    BOILERPLATE_SELECTORS.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Get text content, normalize whitespace
    let text = clone.innerText.replace(/\s+/g, ' ').trim();

    // Handle empty/short content
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

    // Truncate if needed
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
      text: '',
      charCount: 0,
      truncated: false,
      isPDF: false,
      error: 'EXTRACTION_FAILED',
    };
  }
}
```

**Step 2: Commit**

```bash
git add extension/src/shared/extractor.ts
git commit -m "feat: implement text extraction with boilerplate removal"
```

---

## Phase 3: Service Worker

### Task 6: Implement Service Worker

**Files:**
- Create: `extension/src/background/service-worker.ts`

**Step 1: Create background directory and service worker**

```bash
mkdir -p extension/src/background
```

Create `extension/src/background/service-worker.ts`:

```typescript
import { extractText } from '../shared/extractor';
import { ExtractionResult } from '../shared/types';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    return true; // Keep channel open for async response
  }
});

async function handleExtraction(tabId: number): Promise<ExtractionResult> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractText,
    });

    return result.result as ExtractionResult;
  } catch (err) {
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
```

**Step 2: Commit**

```bash
git add extension/src/background/service-worker.ts
git commit -m "feat: implement service worker with message handling"
```

---

## Phase 4: Popup UI

### Task 7: Create Popup Entry Point

**Files:**
- Create: `extension/src/popup/index.html`
- Create: `extension/src/popup/index.tsx`

**Step 1: Create popup directory and HTML entry**

```bash
mkdir -p extension/src/popup
```

Create `extension/src/popup/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DocMind</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
```

**Step 2: Create React entry point**

Create `extension/src/popup/index.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/popup.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 3: Commit**

```bash
git add extension/src/popup/index.html extension/src/popup/index.tsx
git commit -m "feat: add popup entry point"
```

---

### Task 8: Create Popup Constants

**Files:**
- Create: `extension/src/popup/constants.ts`

**Step 1: Create constants file**

Create `extension/src/popup/constants.ts`:

```typescript
import { ErrorCode, Action } from '../shared/types';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NO_EXTRACTABLE_TEXT:
    'No readable text found on this page. If this is a PDF, it may be scanned or image-based (OCR not supported).',
  NO_BODY_ELEMENT:
    "The page isn't fully loaded yet. Try refreshing and opening DocMind again.",
  CANNOT_ACCESS_PAGE:
    'DocMind cannot access this page. Chrome restricts extensions on internal pages and the Web Store.',
  EXTRACTION_FAILED:
    'Something went wrong while reading the page. Please refresh and try again.',
  INSUFFICIENT_TEXT:
    'Not enough text to analyze. The page needs at least 100 characters of content.',
  RATE_LIMITED: 'Too many requests. Please wait 30 seconds and try again.',
  API_ERROR:
    'Could not reach the AI service. Please check your connection and try again.',
  NETWORK_ERROR:
    'Network error. Please check your internet connection and try again.',
  UNEXPECTED_RESPONSE:
    'Got an unexpected response from the AI. Please try again.',
  TIMEOUT:
    'Request timed out. The page may be too long or the AI is busy. Please try again.',
};

export const LOADING_MESSAGES = {
  extracting: 'Reading page...',
  querying: 'Analyzing...',
} as const;

export const STATUS_MESSAGES = {
  charCount: (count: number) => `${count.toLocaleString()} characters extracted`,
  truncated:
    'Analyzed 30,000 characters (page was longer; results based on first part)',
} as const;

export const QUICK_ACTIONS: Array<{ action: Action; label: string }> = [
  { action: 'summarize', label: 'Summarize' },
  { action: 'takeaways', label: 'Key Takeaways' },
  { action: 'eli5', label: 'ELI5' },
  { action: 'arguments', label: 'Main Arguments' },
];

export const PLACEHOLDERS = {
  questionInput: 'Ask a question about this page...',
} as const;

export const RESULT_MESSAGES = {
  noAnswer: 'The answer does not appear in the provided document.',
} as const;
```

**Step 2: Commit**

```bash
git add extension/src/popup/constants.ts
git commit -m "feat: add popup UI constants and messages"
```

---

### Task 9: Create API Client

**Files:**
- Create: `extension/src/popup/api.ts`
- Create: `extension/.env.production`

**Step 1: Create API client**

Create `extension/src/popup/api.ts`:

```typescript
import { Action, ErrorCode } from '../shared/types';

const API_URL = import.meta.env.PROD
  ? import.meta.env.VITE_DOCMIND_API_URL
  : 'http://localhost:3000/api/query';

export async function fetchAnswer(
  text: string,
  action: Action,
  question?: string
): Promise<{ answer: string } | { error: ErrorCode }> {
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

    return await response.json();
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

**Step 2: Create environment file**

Create `extension/.env.production`:

```
VITE_DOCMIND_API_URL=https://your-vercel-app.vercel.app/api/query
```

Note: Update this URL after deploying the API.

**Step 3: Commit**

```bash
git add extension/src/popup/api.ts extension/.env.production
git commit -m "feat: add API client with timeout handling"
```

---

### Task 10: Create useDocMind Hook

**Files:**
- Create: `extension/src/popup/hooks/useDocMind.ts`

**Step 1: Create hooks directory and useDocMind**

```bash
mkdir -p extension/src/popup/hooks
```

Create `extension/src/popup/hooks/useDocMind.ts`:

```typescript
import { useState, useEffect } from 'react';
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
  | ({ status: 'error'; error: ErrorCode } & Partial<BaseExtracted>);

export function useDocMind() {
  const [state, setState] = useState<State>({ status: 'idle' });

  // Auto-extract on mount
  useEffect(() => {
    extract();
  }, []);

  async function extract() {
    setState({ status: 'extracting' });

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        setState({ status: 'error', error: 'CANNOT_ACCESS_PAGE' });
        return;
      }

      const result = (await chrome.runtime.sendMessage({
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
    } catch (err) {
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

**Step 2: Commit**

```bash
git add extension/src/popup/hooks/useDocMind.ts
git commit -m "feat: add useDocMind hook with state machine"
```

---

### Task 11: Create UI Components

**Files:**
- Create: `extension/src/popup/components/LoadingSpinner.tsx`
- Create: `extension/src/popup/components/ErrorBanner.tsx`
- Create: `extension/src/popup/components/StatusBar.tsx`
- Create: `extension/src/popup/components/QuickActions.tsx`
- Create: `extension/src/popup/components/QuestionInput.tsx`
- Create: `extension/src/popup/components/ResponseDisplay.tsx`

**Step 1: Create components directory**

```bash
mkdir -p extension/src/popup/components
```

**Step 2: Create LoadingSpinner**

Create `extension/src/popup/components/LoadingSpinner.tsx`:

```typescript
import React from 'react';

interface LoadingSpinnerProps {
  message: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="loading" aria-live="polite" aria-busy="true">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}
```

**Step 3: Create ErrorBanner**

Create `extension/src/popup/components/ErrorBanner.tsx`:

```typescript
import React from 'react';
import { ErrorCode } from '../../shared/types';
import { ERROR_MESSAGES } from '../constants';

interface ErrorBannerProps {
  error: ErrorCode;
  onRetry: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <p>{ERROR_MESSAGES[error]}</p>
      <button onClick={onRetry} className="retry-button">
        Try Again
      </button>
    </div>
  );
}
```

**Step 4: Create StatusBar**

Create `extension/src/popup/components/StatusBar.tsx`:

```typescript
import React from 'react';
import { STATUS_MESSAGES } from '../constants';

interface StatusBarProps {
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
}

export function StatusBar({ charCount, truncated, isPDF }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span className="char-count">
        {STATUS_MESSAGES.charCount(charCount)}
        {isPDF && ' (PDF)'}
      </span>
      {truncated && (
        <span className="truncation-notice">{STATUS_MESSAGES.truncated}</span>
      )}
    </div>
  );
}
```

**Step 5: Create QuickActions**

Create `extension/src/popup/components/QuickActions.tsx`:

```typescript
import React from 'react';
import { Action } from '../../shared/types';
import { QUICK_ACTIONS } from '../constants';

interface QuickActionsProps {
  onAction: (action: Action) => void;
  disabled: boolean;
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {QUICK_ACTIONS.map(({ action, label }) => (
        <button
          key={action}
          onClick={() => onAction(action)}
          disabled={disabled}
          className="quick-action-button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Step 6: Create QuestionInput**

Create `extension/src/popup/components/QuestionInput.tsx`:

```typescript
import React, { useState, FormEvent } from 'react';
import { PLACEHOLDERS } from '../constants';

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  disabled: boolean;
}

export function QuestionInput({ onSubmit, disabled }: QuestionInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      onSubmit(question.trim());
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

**Step 7: Create ResponseDisplay**

Create `extension/src/popup/components/ResponseDisplay.tsx`:

```typescript
import React from 'react';
import { RESULT_MESSAGES } from '../constants';

interface ResponseDisplayProps {
  answer: string;
}

export function ResponseDisplay({ answer }: ResponseDisplayProps) {
  const isNoAnswer = answer === RESULT_MESSAGES.noAnswer;

  return (
    <div className={`response ${isNoAnswer ? 'no-answer' : ''}`}>
      <p>{answer}</p>
    </div>
  );
}
```

**Step 8: Commit**

```bash
git add extension/src/popup/components/
git commit -m "feat: add popup UI components"
```

---

### Task 12: Create Main App Component

**Files:**
- Create: `extension/src/popup/App.tsx`

**Step 1: Create App component**

Create `extension/src/popup/App.tsx`:

```typescript
import React from 'react';
import { useDocMind } from './hooks/useDocMind';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBanner } from './components/ErrorBanner';
import { StatusBar } from './components/StatusBar';
import { QuickActions } from './components/QuickActions';
import { QuestionInput } from './components/QuestionInput';
import { ResponseDisplay } from './components/ResponseDisplay';
import { LOADING_MESSAGES } from './constants';
import { Action } from '../shared/types';

export default function App() {
  const { state, runAction, retry } = useDocMind();

  const handleAsk = (question: string) => {
    runAction('ask', question);
  };

  const handleQuickAction = (action: Action) => {
    runAction(action);
  };

  // Extracting state
  if (state.status === 'idle' || state.status === 'extracting') {
    return (
      <div className="container">
        <h1 className="title">DocMind</h1>
        <LoadingSpinner message={LOADING_MESSAGES.extracting} />
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="container">
        <h1 className="title">DocMind</h1>
        <ErrorBanner error={state.error} onRetry={retry} />
      </div>
    );
  }

  // Querying state
  if (state.status === 'querying') {
    return (
      <div className="container">
        <h1 className="title">DocMind</h1>
        <StatusBar
          charCount={state.charCount}
          truncated={state.truncated}
          isPDF={state.isPDF}
        />
        <LoadingSpinner message={LOADING_MESSAGES.querying} />
      </div>
    );
  }

  // Extracted or Success state
  return (
    <div className="container">
      <h1 className="title">DocMind</h1>
      <StatusBar
        charCount={state.charCount}
        truncated={state.truncated}
        isPDF={state.isPDF}
      />

      {state.status === 'success' && <ResponseDisplay answer={state.answer} />}

      <QuestionInput onSubmit={handleAsk} disabled={false} />
      <QuickActions onAction={handleQuickAction} disabled={false} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add extension/src/popup/App.tsx
git commit -m "feat: add main App component with state rendering"
```

---

### Task 13: Create Popup Styles

**Files:**
- Create: `extension/src/popup/styles/popup.css`

**Step 1: Create styles directory and CSS**

```bash
mkdir -p extension/src/popup/styles
```

Create `extension/src/popup/styles/popup.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 360px;
  min-height: 200px;
  max-height: 500px;
  overflow-y: auto;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  background: #fff;
}

.container {
  padding: 16px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1a1a1a;
}

/* Loading */
.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  color: #666;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e0e0e0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error */
.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.error-banner p {
  color: #991b1b;
  margin-bottom: 8px;
}

.retry-button {
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.retry-button:hover {
  background: #dc2626;
}

/* Status Bar */
.status-bar {
  background: #f5f5f5;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #666;
}

.truncation-notice {
  display: block;
  margin-top: 4px;
  color: #b45309;
}

/* Question Input */
.question-form {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.question-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.question-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.submit-button {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.submit-button:hover:not(:disabled) {
  background: #2563eb;
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-action-button {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.quick-action-button:hover:not(:disabled) {
  background: #e5e7eb;
}

.quick-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Response */
.response {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.response.no-answer {
  background: #fefce8;
  border-color: #fef08a;
  color: #854d0e;
  font-style: italic;
}

/* Accessibility */
.question-input:focus-visible,
.submit-button:focus-visible,
.quick-action-button:focus-visible,
.retry-button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

**Step 2: Commit**

```bash
git add extension/src/popup/styles/popup.css
git commit -m "feat: add popup CSS styles"
```

---

### Task 14: Build and Test Extension

**Step 1: Build the extension**

Run: `cd extension && npm run build`
Expected: Build completes, `dist/` directory created

**Step 2: Verify build output**

Run: `ls extension/dist/`
Expected: Should contain `manifest.json`, `icons/`, `popup/`, `background/`

**Step 3: Load in Chrome**

1. Open Chrome, go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `extension/dist/` folder
5. Extension should appear in toolbar

**Step 4: Test extraction**

1. Navigate to any article (e.g., Wikipedia)
2. Click DocMind icon
3. Should see "Reading page..." then character count

Note: Q&A won't work yet - API not deployed. Extraction should work.

**Step 5: Commit build verification**

```bash
git add -A
git commit -m "chore: verify extension builds successfully"
```

---

## Phase 5: API Backend

### Task 15: Initialize API Package

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/.gitignore`
- Create: `api/.env.local`

**Step 1: Create api directory and package.json**

```bash
mkdir -p api
```

Create `api/package.json`:

```json
{
  "name": "docmind-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "next": "^14.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create .gitignore**

Create `api/.gitignore`:

```
node_modules/
.next/
.env.local
.env.production.local
*.log
```

**Step 4: Create .env.local template**

Create `api/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Note: Replace with your actual API key. Never commit this file.

**Step 5: Install dependencies**

Run: `cd api && npm install`
Expected: Dependencies installed

**Step 6: Commit (without .env.local)**

```bash
git add api/package.json api/tsconfig.json api/.gitignore
git commit -m "chore: initialize API package"
```

---

### Task 16: Create Next.js Config

**Files:**
- Create: `api/next.config.mjs`
- Create: `api/next-env.d.ts`

**Step 1: Create Next.js config**

Create `api/next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

**Step 2: Create Next.js type declarations**

Create `api/next-env.d.ts`:

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
```

**Step 3: Commit**

```bash
git add api/next.config.mjs api/next-env.d.ts
git commit -m "chore: add Next.js configuration"
```

---

### Task 17: Implement API Route

**Files:**
- Create: `api/app/api/query/route.ts`
- Create: `api/app/layout.tsx` (required by Next.js)

**Step 1: Create app directory structure**

```bash
mkdir -p api/app/api/query
```

**Step 2: Create minimal layout (required)**

Create `api/app/layout.tsx`:

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Step 3: Create API route**

Create `api/app/api/query/route.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const MAX_CHARS = 30000;

const SYSTEM_PROMPT = `You are DocMind, an AI assistant that answers questions strictly using the provided document text. Do not use outside knowledge.

Rules:
- Only use information from the provided document
- If the answer cannot be found in the document, you MUST respond exactly: "The answer does not appear in the provided document."
- When possible, quote or reference specific passages from the document
- Be concise and direct`;

const allowedActions = new Set([
  'ask',
  'summarize',
  'takeaways',
  'eli5',
  'arguments',
] as const);

interface QueryRequest {
  text: string;
  question?: string;
  action?: string;
}

export async function POST(req: NextRequest) {
  // Guard: API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return NextResponse.json(
      { error: 'Server configuration error: API key not configured' },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const body: QueryRequest = await req.json();
    const { text, question } = body;

    // Validation
    if (!text || text.length < 100) {
      return NextResponse.json({ error: 'INSUFFICIENT_TEXT' }, { status: 400 });
    }

    // Server-side truncation (defense in depth)
    const safeText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

    // Validate action
    const rawAction = body.action ?? 'ask';
    const action = allowedActions.has(rawAction as any) ? rawAction : 'ask';

    // Build user prompt
    const userPrompt = buildPrompt(safeText, question, action);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Defensive response handling
    const textBlock = response.content.find((block) => block.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'UNEXPECTED_RESPONSE' }, { status: 500 });
    }

    return NextResponse.json({ answer: textBlock.text });
  } catch (err) {
    console.error('API error:', err);

    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
      }

      return NextResponse.json(
        { error: 'API_ERROR', message: err.message },
        { status: err.status || 500 }
      );
    }

    return NextResponse.json({ error: 'API_ERROR' }, { status: 500 });
  }
}

function buildPrompt(
  text: string,
  question: string | undefined,
  action: string
): string {
  const docBlock = `<document>\n${text}\n</document>`;

  switch (action) {
    case 'summarize':
      return `${docBlock}\n\nProvide a concise summary of this document in 3-5 paragraphs.`;
    case 'takeaways':
      return `${docBlock}\n\nList the 5-7 key takeaways from this document as bullet points.`;
    case 'eli5':
      return `${docBlock}\n\nExplain this document in simple terms that a 5-year-old could understand.`;
    case 'arguments':
      return `${docBlock}\n\nIdentify and list the main arguments or claims made in this document.`;
    default:
      return `${docBlock}\n\nQuestion: ${question}`;
  }
}
```

**Step 4: Commit**

```bash
git add api/app/
git commit -m "feat: implement API query route with Claude integration"
```

---

### Task 18: Test API Locally

**Step 1: Start API server**

Run: `cd api && npm run dev`
Expected: Server starts on http://localhost:3000

**Step 2: Test with curl**

In a new terminal:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test document about artificial intelligence. AI is transforming many industries including healthcare, finance, and transportation. Machine learning algorithms can analyze vast amounts of data to find patterns.", "action": "summarize"}'
```

Expected: JSON response with `answer` field containing a summary

**Step 3: Test error handling**

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"text": "short", "action": "summarize"}'
```

Expected: `{"error":"INSUFFICIENT_TEXT"}` with 400 status

**Step 4: Stop server and commit**

```bash
git add -A
git commit -m "chore: verify API works locally"
```

---

## Phase 6: Deployment

### Task 19: Deploy API to Vercel

**Step 1: Push to GitHub**

Create a GitHub repository and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/docmind.git
git push -u origin feature/mvp
```

**Step 2: Deploy on Vercel**

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Set "Root Directory" to `api`
4. Add environment variable: `ANTHROPIC_API_KEY` = your API key
5. Deploy

**Step 3: Get deployment URL**

After deployment, note the URL (e.g., `https://docmind-api.vercel.app`)

**Step 4: Update extension environment**

Update `extension/.env.production`:

```
VITE_DOCMIND_API_URL=https://YOUR-DEPLOYMENT.vercel.app/api/query
```

**Step 5: Rebuild extension**

Run: `cd extension && npm run build`

**Step 6: Commit**

```bash
git add extension/.env.production
git commit -m "chore: update API URL for production"
```

---

### Task 20: Final Integration Test

**Step 1: Reload extension in Chrome**

1. Go to `chrome://extensions/`
2. Click refresh icon on DocMind
3. Or remove and re-add from `extension/dist/`

**Step 2: Test full flow**

1. Navigate to a long article
2. Click DocMind icon
3. Wait for extraction
4. Click "Summarize" - should get AI response
5. Type a question and click "Ask" - should get answer
6. Try on a restricted page (chrome://settings) - should see error

**Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: complete DocMind MVP implementation"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Project setup, Vite config, manifest |
| 2 | 4-5 | Shared types and extraction logic |
| 3 | 6 | Service worker implementation |
| 4 | 7-14 | Complete popup UI with React |
| 5 | 15-18 | API backend with Claude integration |
| 6 | 19-20 | Deployment and integration testing |

**Total Tasks:** 20
**Estimated Commits:** ~20-25
