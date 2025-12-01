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

export type QueryResult = QueryResponse | QueryError;
