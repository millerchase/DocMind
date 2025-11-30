# DocMind Chrome Extension - Design Document

**Date:** 2025-11-29
**Status:** Ready for implementation

## Overview

DocMind is a Chrome extension that enables AI-powered document Q&A and summaries directly in the browser. Users can extract text from any web page or PDF, ask questions, and get grounded answers based solely on the document content.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│  ┌──────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │  Popup   │───▶│ Service Worker  │───▶│ Content Script │  │
│  │  (React) │    │   (message hub) │    │  (extraction)  │  │
│  └────┬─────┘    └─────────────────┘    └────────────────┘  │
│       │                                                      │
└───────┼──────────────────────────────────────────────────────┘
        │ HTTPS
        ▼
┌─────────────────┐
│  Vercel API     │
│  (Next.js)      │───▶ Claude API
└─────────────────┘
```

## Project Structure

```
DocMind/
├── extension/
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   │       ├── icon-16.png
│   │       ├── icon-48.png
│   │       └── icon-128.png
│   ├── src/
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── index.tsx
│   │   │   ├── App.tsx
│   │   │   ├── api.ts
│   │   │   ├── constants.ts
│   │   │   ├── components/
│   │   │   │   ├── QuestionInput.tsx
│   │   │   │   ├── QuickActions.tsx
│   │   │   │   ├── ResponseDisplay.tsx
│   │   │   │   ├── StatusBar.tsx
│   │   │   │   ├── ErrorBanner.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useDocMind.ts
│   │   │   └── styles/
│   │   │       └── popup.css
│   │   ├── background/
│   │   │   └── service-worker.ts
│   │   └── shared/
│   │       ├── types.ts
│   │       └── extractor.ts
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env.production
│   └── .gitignore
│
├── api/
│   ├── app/
│   │   └── api/
│   │       └── query/
│   │           └── route.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── .env.local
│   └── .gitignore
│
└── README.md
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Extension popup | React + TypeScript |
| Build tool | Vite |
| Extension type | Manifest V3 |
| API backend | Next.js (App Router) |
| Deployment | Vercel |
| LLM | Claude Sonnet via Anthropic SDK |

## Extension Manifest

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

**Permissions rationale:**
- `activeTab` - Access current tab only when user clicks extension
- `scripting` - Inject content script via `chrome.scripting.executeScript()`

**Not included (minimal permissions for Web Store approval):**
- `tabs` - Not needed; popup queries active tab via `chrome.tabs.query()`
- `<all_urls>` - Not needed; `activeTab` is sufficient
- `storage` - MVP has no persistence
- `clipboardWrite` - `navigator.clipboard` works from popup

**Build notes:**
- Content script is injected on-demand via `chrome.scripting.executeScript()` - no static `content_scripts` registration
- Vite must output `service-worker.js` as a separate self-contained entry point

## Text Extraction

### Types

```typescript
// shared/types.ts

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
```

### Extractor (Single Source of Truth)

```typescript
// shared/extractor.ts

import { ExtractionResult } from './types';

const MAX_CHARS = 30000;

const BOILERPLATE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.nav', '.navbar', '.header', '.footer', '.sidebar',
  '.advertisement', '.ad', '.ads', '[class*="cookie"]',
  'script', 'style', 'noscript', 'iframe'
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
    const isPDF = document.contentType === 'application/pdf' ||
                  window.location.pathname.endsWith('.pdf');

    // Clone body to avoid modifying actual page
    const clone = document.body.cloneNode(true) as HTMLElement;

    // Remove boilerplate elements
    BOILERPLATE_SELECTORS.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Get text content, normalize whitespace
    let text = clone.innerText
      .replace(/\s+/g, ' ')
      .trim();

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

**PDF handling:** Chrome's built-in PDF viewer exposes selectable text in the DOM. Scanned/image/DRM PDFs return `NO_EXTRACTABLE_TEXT` - this is expected behavior, not a bug.

## Service Worker

```typescript
// background/service-worker.ts

import { extractText } from '../shared/extractor';
import { ExtractionResult } from '../shared/types';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_TEXT') {
    handleExtraction(message.tabId)
      .then(sendResponse)
      .catch(err => sendResponse({
        success: false,
        error: 'EXTRACTION_FAILED'
      }));
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

## API Proxy

```typescript
// api/app/api/query/route.ts

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
      return NextResponse.json(
        { error: 'INSUFFICIENT_TEXT' },
        { status: 400 }
      );
    }

    // Server-side truncation (defense in depth)
    const safeText = text.length > MAX_CHARS
      ? text.slice(0, MAX_CHARS)
      : text;

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
    const textBlock = response.content.find(
      (block) => block.type === 'text'
    );

    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'UNEXPECTED_RESPONSE' },
        { status: 500 }
      );
    }

    return NextResponse.json({ answer: textBlock.text });

  } catch (err) {
    console.error('API error:', err);

    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        return NextResponse.json(
          { error: 'RATE_LIMITED' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'API_ERROR', message: err.message },
        { status: err.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'API_ERROR' },
      { status: 500 }
    );
  }
}

function buildPrompt(text: string, question: string | undefined, action: string): string {
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

## Popup UI

### State Machine

```typescript
// popup/hooks/useDocMind.ts

import { useState } from 'react';
import { ExtractionResult, ErrorCode, Action } from '../../shared/types';
import { fetchAnswer } from '../api';

type BaseExtracted = {
  text: string;
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
};

type State =
  | { status: 'idle' }
  | { status: 'extracting' }
  | ({ status: 'extracted' } & BaseExtracted)
  | ({ status: 'querying'; action: Action } & BaseExtracted)
  | ({ status: 'success'; answer: string; action: Action } & BaseExtracted)
  | ({ status: 'error'; error: ErrorCode } & Partial<BaseExtracted>);

export function useDocMind() {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function extract() {
    setState({ status: 'extracting' });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      setState({ status: 'error', error: 'CANNOT_ACCESS_PAGE' });
      return;
    }

    const result = await chrome.runtime.sendMessage({
      type: 'EXTRACT_TEXT',
      tabId: tab.id
    }) as ExtractionResult;

    if (!result.success) {
      setState({ status: 'error', error: result.error || 'EXTRACTION_FAILED' });
      return;
    }

    setState({
      status: 'extracted',
      text: result.text,
      charCount: result.charCount,
      truncated: result.truncated,
      isPDF: result.isPDF,
    });
  }

  async function runAction(action: Action, question?: string) {
    if (state.status !== 'extracted' && state.status !== 'success') return;

    const { text, charCount, truncated, isPDF } = state;
    setState({ status: 'querying', text, charCount, truncated, isPDF, action });

    const result = await fetchAnswer(text, action, question);

    if ('error' in result) {
      setState({ status: 'error', error: result.error, text, charCount, truncated, isPDF });
      return;
    }

    setState({
      status: 'success',
      answer: result.answer,
      action,
      text,
      charCount,
      truncated,
      isPDF
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

### API Client

```typescript
// popup/api.ts

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
      return { error: data.error || 'API_ERROR' };
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

### Constants

```typescript
// popup/constants.ts

import { ErrorCode, Action } from '../shared/types';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NO_EXTRACTABLE_TEXT: 'No readable text found on this page. If this is a PDF, it may be scanned or image-based (OCR not supported).',
  NO_BODY_ELEMENT: "The page isn't fully loaded yet. Try refreshing and opening DocMind again.",
  CANNOT_ACCESS_PAGE: 'DocMind cannot access this page. Chrome restricts extensions on internal pages and the Web Store.',
  EXTRACTION_FAILED: 'Something went wrong while reading the page. Please refresh and try again.',
  INSUFFICIENT_TEXT: 'Not enough text to analyze. The page needs at least 100 characters of content.',
  RATE_LIMITED: 'Too many requests. Please wait 30 seconds and try again.',
  API_ERROR: 'Could not reach the AI service. Please check your connection and try again.',
  NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
  UNEXPECTED_RESPONSE: 'Got an unexpected response from the AI. Please try again.',
  TIMEOUT: 'Request timed out. The page may be too long or the AI is busy. Please try again.',
};

export const LOADING_MESSAGES = {
  extracting: 'Reading page...',
  querying: 'Analyzing...',
} as const;

export const STATUS_MESSAGES = {
  charCount: (count: number) => `${count.toLocaleString()} characters extracted`,
  truncated: 'Analyzed 30,000 characters (page was longer; results based on first part)',
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

### Popup Styles

```css
/* popup/styles/popup.css */

body {
  width: 360px;
  min-height: 200px;
  max-height: 500px;
  overflow-y: auto;
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 16px;
  background: #fff;
  color: #1a1a1a;
}

/* High contrast text (min 4.5:1 ratio) */
```

## Vite Configuration

```typescript
// extension/vite.config.ts

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
        { src: 'public/icons', dest: '.' },
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

**Alternative:** Consider `@crxjs/vite-plugin` for simpler config and HMR support.

## Environment Variables

### Extension

```bash
# extension/.env.production
VITE_DOCMIND_API_URL=https://docmind-api.vercel.app/api/query
```

### API

```bash
# api/.env.local (not committed)
ANTHROPIC_API_KEY=sk-ant-...
```

## Deployment

### API (Vercel)

1. Push `api/` to GitHub
2. Create new Vercel project, set root directory to `api/`
3. Add `ANTHROPIC_API_KEY` in Vercel Environment Variables
4. Deploy

### Extension

1. Run `npm run build` in `extension/`
2. Load `dist/` as unpacked extension in Chrome for testing
3. Package for Chrome Web Store submission

## Design Decisions Summary

| Aspect | Decision |
|--------|----------|
| Extension framework | Vanilla Chrome Extension (Manifest V3) |
| Popup UI | React + Vite |
| Backend | Next.js API route on Vercel |
| LLM | Claude Sonnet via Anthropic SDK |
| Permissions | `activeTab`, `scripting` only |
| Text extraction | `shared/extractor.ts`, injected via `executeScript({ func })` |
| Max input | 30,000 characters (truncated with notice) |
| Error handling | Typed error codes → user-friendly messages |
| State management | `useDocMind` hook with explicit state machine |

## Out of Scope (Post-MVP)

- OCR for scanned PDFs
- Context menu integration
- Multi-page PDF extraction
- Multi-turn chat memory
- User login or saved history
- Offline mode
- Firefox/Safari versions
- Markdown rendering in responses
- Copy answer button
- Dark mode
