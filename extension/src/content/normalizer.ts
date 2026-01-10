// extension/src/content/normalizer.ts

export function normalizeForMatching(
  text: string,
  type: 'prose' | 'code' | 'heading'
): string {
  let normalized = text
    .normalize('NFKD')
    // Remove combining diacritical marks
    .replace(/[\u0300-\u036f]/g, '')
    // Normalize whitespace characters
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    // Normalize quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Normalize dashes
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    // Normalize ellipsis
    .replace(/\u2026/g, '...')
    // Remove ZWJ, ZWNJ, and BOM
    .replace(/[\u200C\u200D\uFEFF]/g, '');

  if (type === 'code') {
    // Light normalization for code (collapse runs, reduce noise)
    normalized = normalized.replace(/ +/g, ' ');
  } else {
    // Aggressive whitespace collapse for prose
    normalized = normalized.replace(/\s+/g, ' ');
  }

  return normalized.trim().toLowerCase();
}
