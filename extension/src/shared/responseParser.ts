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

    // Filter, validate, and clamp citations
    const validCitations: Citation[] = Array.isArray(parsed.citations)
      ? parsed.citations
          .filter((c: unknown): c is Citation =>
            typeof c === 'object' && c !== null &&
            typeof (c as Citation).id === 'string' &&
            /^cite-\d+$/.test((c as Citation).id) &&
            typeof (c as Citation).text === 'string' &&
            (c as Citation).text.length >= CITATION_LIMITS.MIN_TEXT_LENGTH &&
            (c as Citation).text.length <= CITATION_LIMITS.MAX_TEXT_LENGTH
          )
          .map((c: Citation) => ({
            ...c,
            relevance: typeof c.relevance === 'string' ? c.relevance : '',
          }))
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
