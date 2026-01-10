import type { Action, ErrorCode, QueryResponse, QueryError, Mode } from '../shared/types';
import { parseApiResponse } from '../shared/responseParser';

const PROD_URL = import.meta.env.VITE_DOCMIND_API_URL;

const API_URL =
  import.meta.env.PROD && PROD_URL
    ? PROD_URL
    : 'http://localhost:3000/api/query';

// Map legacy Action to new Mode for backward compatibility
const ACTION_TO_MODE: Record<Action, Mode> = {
  ask: 'qa',
  summarize: 'summary',
  takeaways: 'key-takeaways',
  eli5: 'eli5',
  arguments: 'main-arguments',
};

export async function fetchAnswer(
  pageText: string,
  pageCharCount: number,
  action: Action,
  question?: string,
  url?: string
): Promise<QueryResponse | QueryError> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const mode = ACTION_TO_MODE[action];

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageText, mode, question, url }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: (data.error as ErrorCode) || 'API_ERROR' };
    }

    const data = await response.json().catch(() => ({}));

    if (typeof data.raw !== 'string') {
      return { error: 'UNEXPECTED_RESPONSE' };
    }

    const parsed = parseApiResponse(data.raw, pageCharCount);

    if (!parsed.success) {
      return { error: parsed.error };
    }

    return parsed.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'TIMEOUT' };
    }
    return { error: 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
}
