import type { Citation } from '../../shared/types';
import { browser, getActiveTab } from '../../shared/browser';

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  clickable?: boolean;
}

export function CitationBadge({ citation, index, clickable = true }: CitationBadgeProps) {
  const handleClick = async () => {
    if (!clickable) return;

    try {
      const tab = await getActiveTab();
      if (!tab?.id) return;

      await browser.tabs.sendMessage(tab.id, {
        type: 'SCROLL_TO',
        citationId: citation.id,
      });
    } catch {
      // Silently fail
    }
  };

  return (
    <button
      type="button"
      className={`citation-badge${!clickable ? ' citation-badge--disabled' : ''}`}
      onClick={handleClick}
      disabled={!clickable}
      title={!clickable ? 'Highlight not available on this page' : (citation.relevance || `Source ${index + 1}`)}
      aria-label={`Jump to source ${index + 1}${citation.relevance ? `: ${citation.relevance}` : ''}${!clickable ? ' (not available)' : ''}`}
    >
      <span className="citation-number">{index + 1}</span>
      <span className="citation-preview">
        {citation.text.length > 60 ? citation.text.slice(0, 57) + '...' : citation.text}
      </span>
    </button>
  );
}
