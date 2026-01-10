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
  segmentIndex?: number;  // Index into PageIndex.segments for highlighting
}

export type HighlightSkipReason =
  | 'quote-spans-multiple-sections'
  | 'page-structure-unsupported'
  | 'confidence-below-threshold'
  | 'match-timeout';
