import { Action, ErrorCode } from '../shared/types';

const PROD_URL = import.meta.env.VITE_DOCMIND_API_URL;

const API_URL =
  import.meta.env.PROD && PROD_URL
    ? PROD_URL
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

    const data = await response.json().catch(() => ({}));

    if (typeof data.answer === 'string') {
      return { answer: data.answer };
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
