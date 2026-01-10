// extension/src/content/citationMatcher.ts
import type { Citation, MatchResult } from '../shared/types';
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

    let candidates: { segment: TextSegment; segmentIdx: number; score: number }[];

    if (quoteTokens.length < MIN_TOKENS_FOR_OVERLAP) {
      // Short quote: use substring matching
      const significantWords = quoteTokens.filter(t => t.length > 4);

      candidates = index.segments
        .map((s, idx) => ({ segment: s, segmentIdx: idx }))
        .filter(({ segment: s }) => s.type === 'prose')
        .filter(({ segment: s }) => {
          if (s.normalizedText.includes(normalizedQuote)) return true;
          if (significantWords.length >= 2) {
            const matches = significantWords.filter(w => s.normalizedText.includes(w));
            return matches.length >= 2;
          }
          return significantWords.some(w => s.normalizedText.includes(w));
        })
        .slice(0, 10)
        .map(c => ({ ...c, score: 0.5 }));
    } else {
      // Normal quote: use token overlap
      candidates = index.segments
        .map((s, idx) => ({ segment: s, segmentIdx: idx }))
        .filter(({ segment: s }) => s.type === 'prose')
        .map(c => ({ ...c, score: tokenOverlap(normalizedQuote, c.segment.normalizedText) }))
        .filter(c => c.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    // Phase 2: Precise match on candidates
    let bestMatch: MatchResult | null = null;
    let skipResult: MatchResult | null = null;

    for (const { segment, segmentIdx } of candidates) {
      if (couldSpanSegments(normalizedQuote, segmentIdx, index)) {
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
        const isMatch = similarity >= HIGHLIGHT_CONFIG.MIN_CONFIDENCE_THRESHOLD;
        bestMatch = {
          citationId: citation.id,
          status: isMatch ? 'matched' : 'low-confidence',
          confidence: similarity,
          segmentIndex: isMatch ? segmentIdx : undefined,
          skipReason: !isMatch ? 'confidence-below-threshold' : undefined,
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
  segmentIdx: number,
  index: PageIndex
): boolean {
  if (segmentIdx < 0 || segmentIdx >= index.segments.length - 1) {
    return false;
  }

  const currentSegment = index.segments[segmentIdx];
  const nextSegment = index.segments[segmentIdx + 1];
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
