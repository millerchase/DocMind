// extension/src/shared/urlIdentity.ts

export const URL_IDENTITY_TTL_MS = 5 * 60 * 1000;

export interface UrlIdentity {
  origin: string;
  pathname: string;
  meaningfulParams: string;
  full: string;
}

const MEANINGFUL_PARAMS = new Set([
  'version', 'v',
  'lang', 'language',
  'platform',
  'view',
  'tab',
  'page',
]);

export function parseUrlIdentity(url: string): UrlIdentity {
  try {
    const parsed = new URL(url);

    const meaningful: string[] = [];
    parsed.searchParams.forEach((value, key) => {
      const k = key.toLowerCase();
      if (MEANINGFUL_PARAMS.has(k)) {
        meaningful.push(`${k}=${value}`);
      }
    });
    meaningful.sort();

    const meaningfulParams = meaningful.join('&');

    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      meaningfulParams,
      full: `${parsed.origin}${parsed.pathname}${meaningfulParams ? '?' + meaningfulParams : ''}`,
    };
  } catch {
    return { origin: '', pathname: url, meaningfulParams: '', full: url };
  }
}

export type StaleCheckResult =
  | { stale: false }
  | { stale: true; reason: 'path-changed' | 'params-changed' | 'expired' | 'dom-changed' };

export function checkStale(
  stored: UrlIdentity,
  current: UrlIdentity,
  ageMs: number
): StaleCheckResult {
  if (stored.origin !== current.origin || stored.pathname !== current.pathname) {
    return { stale: true, reason: 'path-changed' };
  }

  if (stored.meaningfulParams !== current.meaningfulParams) {
    return { stale: true, reason: 'params-changed' };
  }

  if (ageMs > URL_IDENTITY_TTL_MS) {
    return { stale: true, reason: 'expired' };
  }

  return { stale: false };
}
