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

export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? 'An unknown error occurred.';
}
