# DocMind

AI-powered Chrome extension for document Q&A and summaries. Extract text from any web page or PDF and get instant answers using Claude AI.

## Features

- **Text Extraction** - Automatically extracts readable text from web pages, filtering out navigation, headers, footers, and ads
- **Ask Questions** - Ask natural language questions about the page content
- **Quick Actions**
  - **Summarize** - Get a concise 3-5 paragraph summary
  - **Key Takeaways** - Extract 5-7 bullet-point takeaways
  - **ELI5** - Explain the content in simple terms
  - **Main Arguments** - Identify the core arguments and claims
- **PDF Support** - Works with browser-rendered PDFs (text-based, not scanned images)
- **Smart Truncation** - Handles long documents by analyzing the first 30,000 characters

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   Popup     │───▶│   Service   │───▶│  Content Script │  │
│  │  (React)    │    │   Worker    │    │  (Extraction)   │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                                    │
└─────────│────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel API                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Next.js API Route                       │    │
│  │                /api/query                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│                   Anthropic Claude API                       │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Extension | TypeScript, React 18, Vite, Chrome Extension Manifest V3 |
| API | Next.js 14 (App Router), Anthropic SDK |
| Hosting | Vercel (API), Chrome Web Store (Extension) |
| AI Model | Claude Sonnet 4 |

## Project Structure

```
docmind/
├── extension/              # Chrome extension
│   ├── src/
│   │   ├── background/     # Service worker
│   │   ├── popup/          # React UI
│   │   │   ├── components/ # UI components
│   │   │   ├── hooks/      # useDocMind state management
│   │   │   └── styles/     # CSS
│   │   └── shared/         # Shared types and utilities
│   ├── public/             # Static assets (manifest, icons)
│   └── dist/               # Built extension (load this in Chrome)
│
├── api/                    # Next.js API backend
│   └── app/
│       └── api/
│           └── query/      # POST /api/query endpoint
│
└── docs/                   # Documentation and plans
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Chrome browser
- Anthropic API key

### Installation

#### 1. Clone the repository

```bash
git clone https://github.com/millerchase/DocMind.git
cd DocMind
```

#### 2. Set up the API

```bash
cd api
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and add your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-your-key-here

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000/api/query`

#### 3. Set up the Extension

```bash
cd extension
npm install

# For development (uses localhost API)
npm run dev

# For production build
npm run build
```

#### 4. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/dist/` folder
5. The DocMind icon should appear in your toolbar

### Configuration

#### Extension Environment

Edit `extension/.env.production` to set your production API URL:

```
VITE_DOCMIND_API_URL=https://your-app.vercel.app/api/query
```

#### API Environment

Required environment variables for `api/.env.local`:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |

## Usage

1. Navigate to any web page with text content
2. Click the DocMind extension icon in your toolbar
3. Wait for text extraction (usually instant)
4. Either:
   - Type a question and click "Ask"
   - Click a quick action button (Summarize, Key Takeaways, etc.)
5. View the AI-generated response

### Limitations

- **Restricted pages**: Cannot access `chrome://` URLs, the Chrome Web Store, or other protected pages
- **Scanned PDFs**: OCR is not supported; only text-based PDFs work
- **Content length**: Very long pages are truncated to 30,000 characters
- **Rate limits**: Subject to Anthropic API rate limits

## Development

### Extension Commands

```bash
cd extension

# Watch mode (rebuilds on changes)
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

### API Commands

```bash
cd api

# Development server with hot reload
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

### Testing the API

```bash
# Test with curl
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your document text here (at least 100 characters)...",
    "action": "summarize"
  }'

# Test question answering
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your document text here...",
    "action": "ask",
    "question": "What is the main topic?"
  }'
```

## API Reference

### POST /api/query

Process document text and return AI-generated response.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Document text (min 100 chars, max 30,000) |
| `action` | string | Yes | One of: `ask`, `summarize`, `takeaways`, `eli5`, `arguments` |
| `question` | string | If action=ask | The question to answer |

#### Response

**Success (200)**
```json
{
  "answer": "The AI-generated response..."
}
```

**Error (4xx/5xx)**
```json
{
  "error": "ERROR_CODE",
  "message": "Optional details"
}
```

#### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INSUFFICIENT_TEXT` | 400 | Text is missing or less than 100 characters |
| `RATE_LIMITED` | 429 | Too many requests, wait and retry |
| `API_ERROR` | 500 | Claude API error |
| `UNEXPECTED_RESPONSE` | 500 | Malformed response from Claude |

## Deployment

### API (Vercel)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/new)
3. Set the root directory to `api`
4. Add environment variable: `ANTHROPIC_API_KEY`
5. Deploy

### Extension (Chrome Web Store)

1. Run `npm run build` in the extension directory
2. Zip the contents of `extension/dist/`
3. Submit to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Anthropic](https://anthropic.com) for Claude AI
- [Vite](https://vitejs.dev) for the blazing fast build tooling
- [React](https://react.dev) for the UI framework
