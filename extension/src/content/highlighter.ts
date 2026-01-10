// extension/src/content/highlighter.ts
import { browser } from '../shared/browser';
import type { Citation } from '../shared/types';
import type { TextSegment } from './pageIndexer';

export class SafeHighlighter {
  private highlights = new Map<string, HTMLElement[]>();
  private didSetup = false;

  inject(
    citation: Citation,
    segment: TextSegment
  ): boolean {
    this.injectStyles();

    const node = this.resolveNode(segment.nodePath);
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      // Fallback: TreeWalker scan for citation text
      const result = this.fallbackSearch(citation.text);
      if (result) {
        const mark = this.wrapTextRange(result.node, result.start, result.end, citation.id);
        if (mark) {
          const existing = this.highlights.get(citation.id) || [];
          existing.push(mark);
          this.highlights.set(citation.id, existing);
          return true;
        }
      }
      return false;
    }

    const textNode = node as Text;
    const raw = textNode.textContent ?? '';

    // Try case-insensitive raw match first
    let matchIndex = raw.toLowerCase().indexOf(citation.text.toLowerCase());

    // Fall back to searching within the trimmed segment area
    if (matchIndex === -1) {
      const segmentStart = segment.textOffset;
      const segmentText = raw.slice(segmentStart);
      const relativeIndex = segmentText.toLowerCase().indexOf(citation.text.toLowerCase());
      if (relativeIndex !== -1) {
        matchIndex = segmentStart + relativeIndex;
      }
    }

    // Fallback: TreeWalker scan for citation text
    if (matchIndex === -1) {
      const result = this.fallbackSearch(citation.text);
      if (result) {
        const mark = this.wrapTextRange(result.node, result.start, result.end, citation.id);
        if (mark) {
          const existing = this.highlights.get(citation.id) || [];
          existing.push(mark);
          this.highlights.set(citation.id, existing);
          return true;
        }
      }
      return false;
    }

    const mark = this.wrapTextRange(
      textNode,
      matchIndex,
      matchIndex + citation.text.length,
      citation.id
    );

    if (!mark) return false;

    const existing = this.highlights.get(citation.id) || [];
    existing.push(mark);
    this.highlights.set(citation.id, existing);

    return true;
  }

  scrollTo(citationId: string): void {
    const marks = this.highlights.get(citationId);
    if (!marks || marks.length === 0) return;

    const firstMark = marks[0];
    firstMark.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Add pulse effect
    firstMark.classList.add('docmind-pulse');
    setTimeout(() => {
      firstMark.classList.remove('docmind-pulse');
    }, 900);
  }

  cleanup(citationId?: string): void {
    const toClean = citationId
      ? [[citationId, this.highlights.get(citationId)] as const]
      : Array.from(this.highlights.entries());

    for (const [id, marks] of toClean) {
      if (!marks) continue;

      marks.forEach(mark => this.unwrapMark(mark));
      this.highlights.delete(id);
    }
  }

  setupAutoCleanup(): void {
    if (this.didSetup) return;
    this.didSetup = true;

    browser.runtime.onMessage.addListener((msg: unknown) => {
      const message = msg as { type: string };
      if (message.type === 'CLEAR_HIGHLIGHTS') {
        this.cleanup();
      }
    });

    window.addEventListener('popstate', () => this.cleanup());
    window.addEventListener('hashchange', () => this.cleanup());
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  private injectStyles(): void {
    if (document.getElementById('docmind-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'docmind-highlight-styles';
    style.textContent = `
      .docmind-highlight {
        background-color: rgba(59, 130, 246, 0.3);
        border-radius: 2px;
        padding: 0 2px;
      }
      .docmind-pulse {
        animation: docmind-pulse-animation 900ms ease-out;
      }
      @keyframes docmind-pulse-animation {
        0% { background-color: rgba(59, 130, 246, 0.6); }
        100% { background-color: rgba(59, 130, 246, 0.3); }
      }
    `;
    document.head.appendChild(style);
  }

  private resolveNode(nodePath: number[]): Node | null {
    let current: Node = document.body;

    for (const index of nodePath) {
      if (!current.childNodes || index >= current.childNodes.length) {
        return null;
      }
      current = current.childNodes[index];
    }

    return current;
  }

  private fallbackSearch(text: string): { node: Text; start: number; end: number } | null {
    const searchLower = text.toLowerCase();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Text | null;
    let checked = 0;
    const MAX_FALLBACK = 500;

    while ((node = walker.nextNode() as Text) && checked < MAX_FALLBACK) {
      checked++;
      const content = node.textContent || '';
      const idx = content.toLowerCase().indexOf(searchLower);
      if (idx !== -1) {
        return { node, start: idx, end: idx + text.length };
      }
    }

    return null;
  }

  private wrapTextRange(
    textNode: Text,
    startOffset: number,
    endOffset: number,
    citationId: string
  ): HTMLElement | null {
    try {
      const text = textNode.textContent || '';

      if (startOffset < 0 || endOffset > text.length || startOffset >= endOffset) {
        return null;
      }

      const matchAndAfter = startOffset > 0
        ? textNode.splitText(startOffset)
        : textNode;

      const matchLength = endOffset - startOffset;
      if (matchAndAfter.textContent && matchAndAfter.textContent.length > matchLength) {
        matchAndAfter.splitText(matchLength);
      }

      const mark = document.createElement('mark');
      mark.className = 'docmind-highlight';
      mark.dataset.citationId = citationId;

      const parent = matchAndAfter.parentNode;
      if (!parent) return null;

      parent.insertBefore(mark, matchAndAfter);
      mark.appendChild(matchAndAfter);

      return mark;
    } catch (error) {
      console.warn('[DocMind] Text wrapping failed:', error);
      return null;
    }
  }

  private unwrapMark(mark: HTMLElement): void {
    const parent = mark.parentNode;
    if (!parent) return;

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}
